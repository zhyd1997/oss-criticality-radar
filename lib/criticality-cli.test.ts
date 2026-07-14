import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseCliStdoutJson,
  scoreResultFromCliJson,
} from "./criticality-cli";

const SAMPLE = {
  default_score: "0.30137",
  legacy: {
    closed_issues_count: 0,
    commit_frequency: 6.04,
    contributor_count: 6,
    created_since: 55,
    github_mention_count: 6,
    issue_comment_frequency: 0,
    org_count: 1,
    recent_release_count: 0,
    updated_issues_count: 0,
    updated_since: 0,
  },
  repo: {
    created_at: "2021-12-20T02:15:12Z",
    language: "TypeScript",
    license: "Apache License 2.0",
    star_count: 157,
    updated_at: "2026-07-07T22:16:34Z",
    url: "https://github.com/softmaple/softmaple",
  },
};

describe("parseCliStdoutJson", () => {
  it("parses clean JSON stdout", () => {
    const got = parseCliStdoutJson(JSON.stringify(SAMPLE));
    assert.equal(
      (got as { default_score: string }).default_score,
      "0.30137",
    );
  });

  it("extracts JSON when surrounded by noise", () => {
    const got = parseCliStdoutJson(`noise\n${JSON.stringify(SAMPLE)}\n`);
    assert.ok(got && typeof got === "object");
  });

  it("throws on empty stdout", () => {
    assert.throws(() => parseCliStdoutJson("  "), /empty stdout/);
  });
});

describe("scoreResultFromCliJson", () => {
  it("maps CLI JSON to ScoreResult for the UI", () => {
    const result = scoreResultFromCliJson(
      SAMPLE,
      "https://github.com/softmaple/softmaple",
    );

    assert.equal(result.score, 0.30137);
    assert.equal(result.repo.owner, "softmaple");
    assert.equal(result.repo.name, "softmaple");
    assert.equal(result.repo.stars, 157);
    assert.equal(result.repo.language, "TypeScript");
    assert.equal(result.signals.contributor_count, 6);
    assert.equal(result.signals.commit_frequency, 6.04);
    assert.equal(result.partial, false);
    assert.equal(result.contributions.length, 10);
  });

  it("marks missing github_mention_count as partial", () => {
    const raw = {
      ...SAMPLE,
      legacy: { ...SAMPLE.legacy },
    };
    delete (raw.legacy as { github_mention_count?: number })
      .github_mention_count;

    const result = scoreResultFromCliJson(
      raw,
      "https://github.com/softmaple/softmaple",
    );
    assert.equal(result.partial, true);
    assert.deepEqual(result.unavailableSignals, ["github_mention_count"]);
    assert.equal(result.signals.github_mention_count, null);
  });
});
