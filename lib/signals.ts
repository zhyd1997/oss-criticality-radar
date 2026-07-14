import {
  getGitHubToken,
  githubGraphql,
  githubRest,
  GitHubError,
  monthsBetween,
  parseLastPage,
  round,
} from "./github";
import type { CriticalitySignals, RepoMeta } from "./types";

const MAX_CONTRIBUTOR_LIMIT = 5000;
const MAX_ISSUES_LIMIT = 5000;
const MAX_TOP_CONTRIBUTORS = 15;
const TOO_MANY_CONTRIBUTORS_ORG_COUNT = 10;
const TOO_MANY_COMMENTS_FREQUENCY = 2.0;
const ISSUE_LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;
const RELEASE_LOOKBACK_MS = 365 * 24 * 60 * 60 * 1000;
const COMMIT_LOOKBACK_MS = 365 * 24 * 60 * 60 * 1000;

type BasicRepoGraphql = {
  repository: {
    name: string;
    url: string;
    description: string | null;
    stargazerCount: number;
    createdAt: string;
    owner: { login: string };
    licenseInfo: { name: string } | null;
    primaryLanguage: { name: string } | null;
    defaultBranchRef: {
      target: {
        authoredDate: string;
        recentCommits: { totalCount: number };
      } | null;
    } | null;
    tags: { totalCount: number };
    releases: {
      nodes: Array<{ createdAt: string }>;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  } | null;
};

const BASIC_QUERY = `
query BasicRepo(
  $owner: String!
  $name: String!
  $since: GitTimestamp!
  $releaseFirst: Int!
) {
  repository(owner: $owner, name: $name) {
    name
    url
    description
    stargazerCount
    createdAt
    owner { login }
    licenseInfo { name }
    primaryLanguage { name }
    defaultBranchRef {
      target {
        ... on Commit {
          authoredDate
          recentCommits: history(since: $since) {
            totalCount
          }
        }
      }
    }
    tags: refs(refPrefix: "refs/tags/") {
      totalCount
    }
    releases(orderBy: { direction: DESC, field: CREATED_AT }, first: $releaseFirst) {
      nodes { createdAt }
      pageInfo { hasNextPage endCursor }
    }
  }
}
`;

const MORE_RELEASES_QUERY = `
query MoreReleases($owner: String!, $name: String!, $after: String!) {
  repository(owner: $owner, name: $name) {
    releases(orderBy: { direction: DESC, field: CREATED_AT }, first: 100, after: $after) {
      nodes { createdAt }
      pageInfo { hasNextPage endCursor }
    }
  }
}
`;

type Contributor = {
  login?: string | null;
  type?: string;
  contributions?: number;
};

type UserCompany = { company: string | null };

/**
 * Collect OpenSSF criticality score signals for a GitHub repository.
 * Equivalent to: criticality_score -depsdev-disable https://github.com/owner/repo
 * (deps.dev disabled; uses GitHub commit-mention count as dependents proxy).
 */
export async function collectSignals(
  owner: string,
  name: string,
): Promise<{ repo: RepoMeta; signals: CriticalitySignals }> {
  const token = getGitHubToken();
  if (!token) {
    throw new GitHubError(
      "GitHub token required. Set GITHUB_AUTH_TOKEN or GITHUB_TOKEN in your environment.",
      401,
    );
  }

  const now = new Date();
  const commitSince = new Date(now.getTime() - COMMIT_LOOKBACK_MS).toISOString();

  const basic = await githubGraphql<BasicRepoGraphql>(
    BASIC_QUERY,
    {
      owner,
      name,
      since: commitSince,
      releaseFirst: 100,
    },
    token,
  );

  if (!basic.repository) {
    throw new GitHubError(`Repository ${owner}/${name} not found`, 404);
  }

  const repo = basic.repository;
  const createdAt = new Date(repo.createdAt);
  const lastCommitDate = repo.defaultBranchRef?.target?.authoredDate
    ? new Date(repo.defaultBranchRef.target.authoredDate)
    : createdAt;

  const recentCommits =
    repo.defaultBranchRef?.target?.recentCommits.totalCount ?? 0;
  const commitFrequency = round(recentCommits / 52, 2);

  // Recent releases in last year (paginate if needed)
  let recentReleaseCount = countReleasesSince(
    repo.releases.nodes.map((n) => n.createdAt),
    now,
  );
  let cursor = repo.releases.pageInfo.endCursor;
  let hasMore = repo.releases.pageInfo.hasNextPage;
  // Only paginate while releases might still be within the lookback window
  while (hasMore && cursor && recentReleaseCount >= 100) {
    const more = await githubGraphql<{
      repository: {
        releases: {
          nodes: Array<{ createdAt: string }>;
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      } | null;
    }>(MORE_RELEASES_QUERY, { owner, name, after: cursor }, token);

    const releases = more.repository?.releases;
    if (!releases) break;

    const dates = releases.nodes.map((n) => n.createdAt);
    const cutoff = now.getTime() - RELEASE_LOOKBACK_MS;
    let hitOld = false;
    for (const d of dates) {
      if (new Date(d).getTime() >= cutoff) {
        recentReleaseCount++;
      } else {
        hitOld = true;
        break;
      }
    }
    if (hitOld) break;
    hasMore = releases.pageInfo.hasNextPage;
    cursor = releases.pageInfo.endCursor;
  }

  // Fallback when no formal releases: estimate from tags (matches criticality_score)
  if (recentReleaseCount === 0) {
    const daysSinceCreated = Math.floor(
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysSinceCreated > 0) {
      recentReleaseCount = Math.floor(
        (repo.tags.totalCount * 365) / daysSinceCreated,
      );
    }
  }

  // Parallel REST fetches for remaining signals
  const [
    contributorCount,
    orgCount,
    closedIssues,
    updatedIssues,
    commentFrequency,
    mentionCount,
  ] = await Promise.all([
    fetchContributorCount(owner, name, token),
    fetchOrgCount(owner, name, token),
    fetchIssueCount(owner, name, "closed", token),
    fetchIssueCount(owner, name, "all", token),
    fetchCommentFrequency(owner, name, token),
    fetchGithubMentionCount(owner, name, token),
  ]);

  // comment frequency needs updated issues count
  let issueCommentFrequency = 0;
  if (updatedIssues === 0) {
    issueCommentFrequency = 0;
  } else if (commentFrequency === "too_many") {
    issueCommentFrequency = TOO_MANY_COMMENTS_FREQUENCY;
  } else {
    issueCommentFrequency = round(commentFrequency / updatedIssues, 2);
  }

  const signals: CriticalitySignals = {
    created_since: monthsBetween(now, createdAt),
    updated_since: monthsBetween(now, lastCommitDate),
    contributor_count: contributorCount,
    org_count: orgCount,
    commit_frequency: commitFrequency,
    recent_release_count: recentReleaseCount,
    updated_issues_count: updatedIssues,
    closed_issues_count: closedIssues,
    issue_comment_frequency: issueCommentFrequency,
    github_mention_count: mentionCount,
  };

  const meta: RepoMeta = {
    owner: repo.owner.login,
    name: repo.name,
    url: repo.url,
    language: repo.primaryLanguage?.name ?? null,
    license: repo.licenseInfo?.name ?? null,
    stars: repo.stargazerCount,
    description: repo.description,
  };

  return { repo: meta, signals };
}

function countReleasesSince(dates: string[], now: Date): number {
  const cutoff = now.getTime() - RELEASE_LOOKBACK_MS;
  return dates.filter((d) => new Date(d).getTime() >= cutoff).length;
}

async function fetchContributorCount(
  owner: string,
  name: string,
  token: string,
): Promise<number> {
  try {
    const { data, headers } = await githubRest<Contributor[]>(
      `/repos/${owner}/${name}/contributors?anon=1&per_page=1`,
      token,
    );

    const last = parseLastPage(headers.get("link"));
    if (last === null) {
      return Array.isArray(data) ? data.length : 0;
    }
    return Math.min(last, MAX_CONTRIBUTOR_LIMIT);
  } catch (err) {
    if (err instanceof GitHubError && err.status === 403) {
      // "list is too large" or similar
      if (err.message.toLowerCase().includes("too large")) {
        return MAX_CONTRIBUTOR_LIMIT;
      }
    }
    // Empty / 204 for empty repos
    if (err instanceof GitHubError && (err.status === 204 || err.status === 404)) {
      return 0;
    }
    throw err;
  }
}

async function fetchOrgCount(
  owner: string,
  name: string,
  token: string,
): Promise<number> {
  try {
    const { data } = await githubRest<Contributor[]>(
      `/repos/${owner}/${name}/contributors?per_page=${MAX_TOP_CONTRIBUTORS}`,
      token,
    );

    if (!Array.isArray(data) || data.length === 0) return 0;

    const logins = data
      .map((c) => c.login)
      .filter((login): login is string => !!login && !login.endsWith("[bot]"));

    if (logins.length === 0) return 0;

    // Batch company lookup via GraphQL
    const aliases = logins.map((login, i) => {
      const alias = `u${i}`;
      return `${alias}: user(login: "${login}") { company }`;
    });
    const query = `query { ${aliases.join("\n")} }`;

    type BatchUsers = Record<string, UserCompany | null>;
    const result = await githubGraphql<BatchUsers>(query, {}, token);

    const orgFilter = (company: string) =>
      company
        .toLowerCase()
        .replace(/inc\./g, "")
        .replace(/llc/g, "")
        .replace(/@/g, "")
        .replace(/ /g, "")
        .replace(/,+$/, "");

    const orgs = new Set<string>();
    for (const value of Object.values(result)) {
      if (value?.company) {
        const org = orgFilter(value.company);
        if (org) orgs.add(org);
      }
    }
    return orgs.size;
  } catch (err) {
    if (err instanceof GitHubError && err.status === 403) {
      if (err.message.toLowerCase().includes("too large")) {
        return TOO_MANY_CONTRIBUTORS_ORG_COUNT;
      }
    }
    if (err instanceof GitHubError && (err.status === 204 || err.status === 404)) {
      return 0;
    }
    throw err;
  }
}

async function fetchIssueCount(
  owner: string,
  name: string,
  state: "all" | "open" | "closed",
  token: string,
): Promise<number> {
  const since = new Date(Date.now() - ISSUE_LOOKBACK_MS).toISOString();
  try {
    const { data, headers } = await githubRest<unknown[]>(
      `/repos/${owner}/${name}/issues?state=${state}&since=${encodeURIComponent(since)}&per_page=1`,
      token,
    );

    const last = parseLastPage(headers.get("link"));
    if (last === null) {
      return Array.isArray(data) ? data.length : 0;
    }
    return Math.min(last, MAX_ISSUES_LIMIT);
  } catch (err) {
    // GitHub returns 5xx when there are too many issues
    if (err instanceof GitHubError && err.status >= 500 && err.status < 600) {
      return MAX_ISSUES_LIMIT;
    }
    throw err;
  }
}

async function fetchCommentFrequency(
  owner: string,
  name: string,
  token: string,
): Promise<number | "too_many"> {
  const since = new Date(Date.now() - ISSUE_LOOKBACK_MS).toISOString();
  try {
    const { data, headers } = await githubRest<unknown[]>(
      `/repos/${owner}/${name}/issues/comments?since=${encodeURIComponent(since)}&per_page=1`,
      token,
    );

    const last = parseLastPage(headers.get("link"));
    if (last === null) {
      return Array.isArray(data) ? data.length : 0;
    }
    return last;
  } catch (err) {
    if (err instanceof GitHubError && err.status >= 500 && err.status < 600) {
      return "too_many";
    }
    throw err;
  }
}

async function fetchGithubMentionCount(
  owner: string,
  name: string,
  token: string,
): Promise<number> {
  // Search commits for mentions of "owner/name" — same as criticality_score githubmentions
  const q = encodeURIComponent(`"${owner}/${name}"`);
  try {
    const { data } = await githubRest<{ total_count: number }>(
      `/search/commits?q=${q}&per_page=1`,
      token,
      {
        headers: {
          Accept: "application/vnd.github.cloak-preview+json",
        },
      },
    );
    return data.total_count ?? 0;
  } catch (err) {
    // Search API can be flaky; don't fail the whole score
    if (err instanceof GitHubError && (err.status === 422 || err.status === 403)) {
      return 0;
    }
    throw err;
  }
}
