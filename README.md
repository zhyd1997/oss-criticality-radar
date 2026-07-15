# OSS Criticality Radar

Web UI for the [OpenSSF Criticality Score](https://github.com/ossf/criticality_score). Paste a GitHub repository (`owner/repo` or full URL) to see its criticality score and signal breakdown — no need to run:

```bash
criticality_score -depsdev-disable https://github.com/owner/repo
```

Scores range from **0** (least critical) to **1** (most critical), using Rob Pike’s weighted arithmetic mean with zipfian normalization and the default OpenSSF weights.

## Features

- Accepts `owner/repo`, `github.com/owner/repo`, or `https://github.com/owner/repo`
- Scores via the official OpenSSF `criticality_score` CLI (**deps.dev disabled**)
- Overall score plus per-signal breakdown

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local:
#   GITHUB_AUTH_TOKEN=...          # used by score-service / CLI
#   SCORE_SERVICE_URL=http://localhost:8080
#   SCORE_SERVICE_TOKEN=dev-shared-secret
```

Create a [GitHub personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) with read access to public repositories. Without it, the CLI hits strict rate limits.

`SCORE_SERVICE_URL` is **required** for the Next.js app. `SCORE_SERVICE_TOKEN` must match the token configured for score-service (Bearer auth on `POST /score`).

### 3. Start the score-service backend

```bash
cd score-service
docker compose up --build
```

Compose loads `../.env.local` for `GITHUB_AUTH_TOKEN` and `SCORE_SERVICE_TOKEN`.

### 4. Run the Next.js dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## API

The `url` field accepts a full GitHub URL or `owner/repo` shorthand:

```http
POST /api/score
Content-Type: application/json

{ "url": "softmaple/softmaple" }
```

```http
POST /api/score
Content-Type: application/json

{ "url": "https://github.com/softmaple/softmaple" }
```

Or:

```http
GET /api/score?url=softmaple/softmaple
```

```http
GET /api/score?url=https://github.com/softmaple/softmaple
```

The BFF proxies to score-service, parses CLI JSON, and returns the UI shape:

Example fields: `score`, `partial`, `unavailableSignals`, `repo`, `signals`, `contributions`.

- If commit-search mentions are unavailable, `github_mention_count` is `null`, `partial` is `true`, and that weight-2 signal is **excluded** from the mean (not treated as zero).
- Responses are cached in-process for 15 minutes per `owner/name`.
- Basic per-IP rate limiting protects the backend (10 req/min).

## Tests

```bash
pnpm test
```

## How scoring works

Scoring is performed by OpenSSF’s CLI inside Docker. The frontend maps CLI output into a signal table using the same default / `original_pike` weights:

| Signal | Weight | Max | Notes |
|--------|-------:|----:|-------|
| created_since (months) | 1 | 120 | |
| updated_since (months) | 1 | 120 | smaller is better |
| contributor_count | 2 | 5000 | |
| org_count | 1 | 10 | top contributors’ companies |
| commit_frequency | 1 | 1000 | commits/week over last year |
| recent_release_count | 0.5 | 26 | last year |
| updated_issues_count | 0.5 | 5000 | last 90 days |
| closed_issues_count | 0.5 | 5000 | last 90 days |
| issue_comment_frequency | 1 | 15 | last 90 days |
| github_mention_count | 2 | 500000 | commit search for `owner/repo` |

**Note:** deps.dev dependent counts are not used (same as `-depsdev-disable`).

## Stack

- [Next.js](https://nextjs.org) (App Router) BFF
- [OpenSSF Criticality Score](https://github.com/ossf/criticality_score) CLI (Go, Docker)
- TypeScript
- Tailwind CSS

## License

This project’s code is independent of OpenSSF’s repository; the scoring methodology is from [ossf/criticality_score](https://github.com/ossf/criticality_score) (Apache-2.0).
