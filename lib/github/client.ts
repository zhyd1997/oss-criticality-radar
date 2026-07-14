const GITHUB_API = "https://api.github.com";
const GITHUB_GRAPHQL = "https://api.github.com/graphql";

export class GitHubError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
  }
}

export type GitHubClient = {
  readonly token: string;
  rest: <T>(
    path: string,
    init?: { headers?: Record<string, string> },
  ) => Promise<{ data: T; headers: Headers; status: number }>;
  graphql: <T>(
    query: string,
    variables?: Record<string, unknown>,
  ) => Promise<T>;
};

function readTokenFromEnv(): string | undefined {
  return (
    process.env.GITHUB_AUTH_TOKEN ||
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN
  );
}

/** Create an authenticated GitHub client. Token is required. */
export function createGitHubClient(token = readTokenFromEnv()): GitHubClient {
  if (!token) {
    throw new GitHubError(
      "GitHub token required. Set GITHUB_AUTH_TOKEN or GITHUB_TOKEN in your environment.",
      401,
    );
  }

  const baseHeaders: Record<string, string> = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "oss-criticality-radar",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  return {
    token,

    async rest<T>(
      path: string,
      init?: { headers?: Record<string, string> },
    ) {
      const res = await fetch(`${GITHUB_API}${path}`, {
        headers: { ...baseHeaders, ...init?.headers },
        cache: "no-store",
      });

      if (!res.ok) {
        let detail = res.statusText;
        try {
          const body = (await res.json()) as { message?: string };
          if (body.message) detail = body.message;
        } catch {
          // ignore parse errors
        }
        throw new GitHubError(`GitHub API error: ${detail}`, res.status);
      }

      if (res.status === 204) {
        return { data: null as T, headers: res.headers, status: res.status };
      }

      const data = (await res.json()) as T;
      return { data, headers: res.headers, status: res.status };
    },

    async graphql<T>(
      query: string,
      variables: Record<string, unknown> = {},
    ) {
      const res = await fetch(GITHUB_GRAPHQL, {
        method: "POST",
        headers: {
          ...baseHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
        cache: "no-store",
      });

      if (!res.ok) {
        let detail = res.statusText;
        try {
          const body = (await res.json()) as { message?: string };
          if (body.message) detail = body.message;
        } catch {
          // ignore
        }
        throw new GitHubError(`GitHub GraphQL error: ${detail}`, res.status);
      }

      const body = (await res.json()) as {
        data?: T;
        errors?: Array<{ message: string; type?: string }>;
      };

      if (body.errors?.length) {
        const msg = body.errors.map((e) => e.message).join("; ");
        const notFound = body.errors.some(
          (e) =>
            e.type === "NOT_FOUND" ||
            e.message.toLowerCase().includes("could not resolve"),
        );
        throw new GitHubError(msg, notFound ? 404 : 400);
      }

      if (!body.data) {
        throw new GitHubError("Empty GraphQL response", 500);
      }

      return body.data;
    },
  };
}

/** Parse Link header last page (used with per_page=1 for totals). */
export function parseLastPage(linkHeader: string | null): number | null {
  if (!linkHeader) return null;
  const match = linkHeader.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  if (!match) return null;
  return parseInt(match[1], 10);
}
