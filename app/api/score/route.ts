import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { ScoreServiceError } from "@/lib/score-service-client";
import { scoreRepoUrl } from "@/lib/score";

// Allow waiting on score-service (CLI timeout is 90s).
export const maxDuration = 120;

function clientKey(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anonymous"
  );
}

function errorResponse(err: unknown): NextResponse {
  if (err instanceof ScoreServiceError) {
    const status =
      err.status >= 400 && err.status < 600 ? err.status : 502;
    return NextResponse.json(
      {
        error: err.message,
        code: err.code ?? "score_service_error",
      },
      { status },
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

async function handleScore(url: string, request: NextRequest) {
  const limit = checkRateLimit(clientKey(request));
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded. Try again shortly.",
        code: "rate_limited",
      },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSec) },
      },
    );
  }

  try {
    const result = await scoreRepoUrl(url);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

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

  return handleScore(url, request);
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json(
      {
        error: "Missing query parameter: url",
        usage: "GET /api/score?url=owner/repo (or https://github.com/owner/repo)",
      },
      { status: 400 },
    );
  }

  return handleScore(url, request);
}
