import { NextRequest, NextResponse } from "next/server";
import { GitHubError } from "@/lib/github";
import { parseGitHubRepo } from "@/lib/parse-repo";
import { buildScoreResult } from "@/lib/scorer";
import { collectSignals } from "@/lib/signals";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body. Expected { url: string }" },
      { status: 400 },
    );
  }

  const url =
    typeof body === "object" &&
    body !== null &&
    "url" in body &&
    typeof (body as { url: unknown }).url === "string"
      ? (body as { url: string }).url
      : null;

  if (!url) {
    return NextResponse.json(
      { error: "Missing required field: url" },
      { status: 400 },
    );
  }

  try {
    const { owner, name } = parseGitHubRepo(url);
    const { repo, signals } = await collectSignals(owner, name);
    const result = buildScoreResult(repo, signals);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof GitHubError) {
      return NextResponse.json(
        { error: err.message, code: "github_error" },
        { status: err.status >= 400 && err.status < 600 ? err.status : 502 },
      );
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Unexpected error while computing criticality score" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json(
      {
        error: "Missing query parameter: url",
        usage: "GET /api/score?url=https://github.com/owner/repo",
      },
      { status: 400 },
    );
  }

  // Reuse POST logic
  const fakeRequest = new NextRequest(request.url, {
    method: "POST",
    body: JSON.stringify({ url }),
    headers: { "Content-Type": "application/json" },
  });
  return POST(fakeRequest);
}
