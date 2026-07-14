const GITHUB_API = "https://api.github.com";
const GITHUB_GRAPHQL = "https://api.github.com/graphql";

export function getGitHubToken(): string | undefined {
  return (
    process.env.GITHUB_AUTH_TOKEN ||
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN
  );
}

export class GitHubError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
  }
}

function authHeaders(token?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "oss-criticality-radar",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function githubRest<T>(
  path: string,
  token?: string,
  init?: RequestInit,
): Promise<{ data: T; headers: Headers; status: number }> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      ...authHeaders(token),
      ...(init?.headers as Record<string, string> | undefined),
    },
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
    throw new GitHubError(`GitHub API error: ${detail}`, res.status);
  }

  // 204 No Content
  if (res.status === 204) {
    return { data: null as T, headers: res.headers, status: res.status };
  }

  const data = (await res.json()) as T;
  return { data, headers: res.headers, status: res.status };
}

export async function githubGraphql<T>(
  query: string,
  variables: Record<string, unknown>,
  token?: string,
): Promise<T> {
  const res = await fetch(GITHUB_GRAPHQL, {
    method: "POST",
    headers: {
      ...authHeaders(token),
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
}

/** Parse Link header Last page number (used for total counts with per_page=1). */
export function parseLastPage(linkHeader: string | null): number | null {
  if (!linkHeader) return null;
  // rel="last"
  const match = linkHeader.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

export function monthsBetween(a: Date, b: Date): number {
  const ms = Math.abs(a.getTime() - b.getTime());
  // criticality_score uses SinceDuration = 30 days
  return Math.floor(ms / (1000 * 60 * 60 * 24 * 30));
}

export function round(v: number, p: number): number {
  const m = 10 ** p;
  return Math.round(v * m) / m;
}
