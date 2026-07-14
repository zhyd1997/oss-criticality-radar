# OSS Criticality Radar

Web UI for the [OpenSSF Criticality Score](https://github.com/ossf/criticality_score). Paste a GitHub repository URL to see its criticality score and signal breakdown — no need to run:

```bash
criticality_score -depsdev-disable https://github.com/owner/repo
```

Scores range from **0** (least critical) to **1** (most critical), using Rob Pike’s weighted arithmetic mean with zipfian normalization and the default OpenSSF weights.

## Features

- Input any GitHub repo URL (or `owner/repo`)
- Collects the same legacy signals as `criticality_score` with **deps.dev disabled**
- Overall score plus per-signal breakdown
- Radar chart of normalized signals

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure a GitHub token

Create a [GitHub personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) with read access to public repositories, then:

```bash
cp .env.example .env.local
# Edit .env.local and set GITHUB_AUTH_TOKEN=...
```

Without a token, GitHub API rate limits are too low for reliable scoring.

### 3. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## API

```http
POST /api/score
Content-Type: application/json

{ "url": "https://github.com/softmaple/softmaple" }
```

Or:

```http
GET /api/score?url=https://github.com/softmaple/softmaple
```

Example response fields: `score`, `partial`, `unavailableSignals`, `repo`, `signals`, `contributions`.

- If commit-search mentions are rate-limited, `github_mention_count` is `null`, `partial` is `true`, and that weight-2 signal is **excluded** from the mean (not treated as zero).
- Responses are cached in-process for 15 minutes per `owner/name`.
- Basic per-IP rate limiting protects the shared GitHub token (10 req/min).

## Tests

```bash
pnpm test
```

## How scoring works

Equivalent to OpenSSF’s default / `original_pike` config:

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

Each signal is clamped, optionally inverted, then normalized with \(\log(1+x)\). The final score is the weighted average of those normalized values.

**Note:** deps.dev dependent counts are not used (same as `-depsdev-disable`). Mentions in GitHub commit messages are used as the dependency proxy.

## Stack

- [Next.js](https://nextjs.org) (App Router)
- TypeScript
- Tailwind CSS
- GitHub REST + GraphQL APIs

## License

This project’s code is independent of OpenSSF’s repository; the scoring methodology is from [ossf/criticality_score](https://github.com/ossf/criticality_score) (Apache-2.0).
