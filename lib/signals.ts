import {
  countViaLinkHeader,
  createGitHubClient,
  GitHubError,
  type GitHubClient,
} from "./github";
import { monthsBetween, round } from "./math";
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
};

/**
 * Collect OpenSSF criticality score signals for a GitHub repository.
 * Equivalent to: criticality_score -depsdev-disable https://github.com/owner/repo
 */
export async function collectSignals(
  owner: string,
  name: string,
  client: GitHubClient = createGitHubClient(),
): Promise<{ repo: RepoMeta; signals: CriticalitySignals }> {
  const now = new Date();
  const commitSince = new Date(now.getTime() - COMMIT_LOOKBACK_MS).toISOString();

  const basic = await client.graphql<BasicRepoGraphql>(BASIC_QUERY, {
    owner,
    name,
    since: commitSince,
    releaseFirst: 100,
  });

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

  const recentReleaseCount = await countRecentReleases(
    client,
    owner,
    name,
    repo,
    createdAt,
    now,
  );

  const [
    contributorCount,
    orgCount,
    closedIssues,
    updatedIssues,
    commentCount,
    mentionCount,
  ] = await Promise.all([
    fetchContributorCount(client, owner, name),
    fetchOrgCount(client, owner, name),
    fetchIssueCount(client, owner, name, "closed"),
    fetchIssueCount(client, owner, name, "all"),
    fetchCommentCount(client, owner, name),
    fetchGithubMentionCount(client, owner, name),
  ]);

  const issueCommentFrequency = computeCommentFrequency(
    updatedIssues,
    commentCount,
  );

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

function computeCommentFrequency(
  updatedIssues: number,
  commentCount: number | "capped",
): number {
  if (updatedIssues === 0) return 0;
  if (commentCount === "capped") return TOO_MANY_COMMENTS_FREQUENCY;
  return round(commentCount / updatedIssues, 2);
}

function countReleasesInWindow(dates: string[], now: Date): number {
  const cutoff = now.getTime() - RELEASE_LOOKBACK_MS;
  return dates.filter((d) => new Date(d).getTime() >= cutoff).length;
}

async function countRecentReleases(
  client: GitHubClient,
  owner: string,
  name: string,
  repo: NonNullable<BasicRepoGraphql["repository"]>,
  createdAt: Date,
  now: Date,
): Promise<number> {
  let recentReleaseCount = countReleasesInWindow(
    repo.releases.nodes.map((n) => n.createdAt),
    now,
  );
  let cursor = repo.releases.pageInfo.endCursor;
  let hasMore = repo.releases.pageInfo.hasNextPage;

  // Paginate only while the full page may still fall inside the lookback window.
  while (hasMore && cursor && recentReleaseCount >= 100) {
    const more = await client.graphql<{
      repository: {
        releases: {
          nodes: Array<{ createdAt: string }>;
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      } | null;
    }>(MORE_RELEASES_QUERY, { owner, name, after: cursor });

    const releases = more.repository?.releases;
    if (!releases) break;

    const pageCount = countReleasesInWindow(
      releases.nodes.map((n) => n.createdAt),
      now,
    );
    recentReleaseCount += pageCount;

    // If this page had older releases, further pages are older too.
    if (pageCount < releases.nodes.length) break;

    hasMore = releases.pageInfo.hasNextPage;
    cursor = releases.pageInfo.endCursor;
  }

  // Fallback when no formal releases: estimate from tags (matches criticality_score).
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

  return recentReleaseCount;
}

async function fetchContributorCount(
  client: GitHubClient,
  owner: string,
  name: string,
): Promise<number> {
  const result = await countViaLinkHeader(
    client,
    `/repos/${owner}/${name}/contributors?anon=1&per_page=1`,
    {
      maxExact: MAX_CONTRIBUTOR_LIMIT,
      onOverflow: {
        mode: "cap",
        value: MAX_CONTRIBUTOR_LIMIT,
        reason: "contributor_list_too_large",
      },
    },
  );
  if (result.kind === "unavailable") return 0;
  return result.value;
}

async function fetchOrgCount(
  client: GitHubClient,
  owner: string,
  name: string,
): Promise<number> {
  try {
    const { data } = await client.rest<Contributor[]>(
      `/repos/${owner}/${name}/contributors?per_page=${MAX_TOP_CONTRIBUTORS}`,
    );

    if (!Array.isArray(data) || data.length === 0) return 0;

    const logins = data
      .map((c) => c.login)
      .filter((login): login is string => !!login && !login.endsWith("[bot]"));

    if (logins.length === 0) return 0;

    // GraphQL aliases with variables — logins never interpolated into the query string.
    const selections = logins
      .map((_, i) => `u${i}: user(login: $login${i}) { company }`)
      .join("\n");
    const varDefs = logins.map((_, i) => `$login${i}: String!`).join(", ");
    const query = `query UserCompanies(${varDefs}) {\n${selections}\n}`;
    const variables: Record<string, string> = {};
    logins.forEach((login, i) => {
      variables[`login${i}`] = login;
    });

    type BatchUsers = Record<string, { company: string | null } | null>;
    const result = await client.graphql<BatchUsers>(query, variables);

    const orgs = new Set<string>();
    for (const value of Object.values(result)) {
      if (value?.company) {
        const org = normalizeCompany(value.company);
        if (org) orgs.add(org);
      }
    }
    return orgs.size;
  } catch (err) {
    if (
      err instanceof GitHubError &&
      err.status === 403 &&
      err.message.toLowerCase().includes("too large")
    ) {
      return TOO_MANY_CONTRIBUTORS_ORG_COUNT;
    }
    if (err instanceof GitHubError && (err.status === 204 || err.status === 404)) {
      return 0;
    }
    throw err;
  }
}

function normalizeCompany(company: string): string {
  return company
    .toLowerCase()
    .replace(/inc\./g, "")
    .replace(/llc/g, "")
    .replace(/@/g, "")
    .replace(/ /g, "")
    .replace(/,+$/, "");
}

async function fetchIssueCount(
  client: GitHubClient,
  owner: string,
  name: string,
  state: "all" | "open" | "closed",
): Promise<number> {
  const since = new Date(Date.now() - ISSUE_LOOKBACK_MS).toISOString();
  const result = await countViaLinkHeader(
    client,
    `/repos/${owner}/${name}/issues?state=${state}&since=${encodeURIComponent(since)}&per_page=1`,
    {
      maxExact: MAX_ISSUES_LIMIT,
      onOverflow: {
        mode: "cap",
        value: MAX_ISSUES_LIMIT,
        reason: "issue_list_too_large",
      },
    },
  );
  if (result.kind === "unavailable") return MAX_ISSUES_LIMIT;
  return result.value;
}

async function fetchCommentCount(
  client: GitHubClient,
  owner: string,
  name: string,
): Promise<number | "capped"> {
  const since = new Date(Date.now() - ISSUE_LOOKBACK_MS).toISOString();
  const result = await countViaLinkHeader(
    client,
    `/repos/${owner}/${name}/issues/comments?since=${encodeURIComponent(since)}&per_page=1`,
    {
      onOverflow: {
        mode: "unavailable",
        reason: "comment_list_too_large",
      },
    },
  );
  if (result.kind === "unavailable") return "capped";
  return result.value;
}

/**
 * Commit-search mention count (dependents proxy when deps.dev is disabled).
 * Returns null when search is rate-limited / forbidden so the scorer excludes
 * this weight-2 signal instead of treating it as zero.
 */
async function fetchGithubMentionCount(
  client: GitHubClient,
  owner: string,
  name: string,
): Promise<number | null> {
  const q = encodeURIComponent(`"${owner}/${name}"`);
  try {
    const { data } = await client.rest<{ total_count: number }>(
      `/search/commits?q=${q}&per_page=1`,
      {
        headers: {
          Accept: "application/vnd.github.cloak-preview+json",
        },
      },
    );
    return data.total_count ?? 0;
  } catch (err) {
    if (
      err instanceof GitHubError &&
      (err.status === 422 || err.status === 403)
    ) {
      return null;
    }
    throw err;
  }
}
