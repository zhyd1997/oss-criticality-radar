import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildScoreResult, normalizeSignal, scoreSignals } from "./scorer";
import type { CriticalitySignals } from "./types";

const fullSignals: CriticalitySignals = {
  created_since: 87,
  updated_since: 0,
  contributor_count: 3999,
  org_count: 5,
  commit_frequency: 97.2,
  recent_release_count: 70,
  updated_issues_count: 5395,
  closed_issues_count: 3062,
  issue_comment_frequency: 5.5,
  github_mention_count: 454393,
};

describe("normalizeSignal", () => {
  it("returns 1 at upper bound", () => {
    assert.equal(normalizeSignal(120, 120), 1);
  });

  it("returns 0 at lower bound", () => {
    assert.equal(normalizeSignal(0, 120), 0);
  });

  it("inverts for smallerIsBetter", () => {
    assert.equal(normalizeSignal(0, 120, 0, true), 1);
    assert.equal(normalizeSignal(120, 120, 0, true), 0);
  });
});

describe("scoreSignals", () => {
  it("scores a fully populated signal set in (0, 1]", () => {
    const { score, unavailableSignals, contributions } =
      scoreSignals(fullSignals);
    assert.equal(unavailableSignals.length, 0);
    assert.ok(score > 0.8 && score <= 1);
    assert.equal(contributions.length, 10);
    assert.ok(contributions.every((c) => !c.excluded));
  });

  it("excludes null github_mention_count and marks partial", () => {
    const withMissing: CriticalitySignals = {
      ...fullSignals,
      github_mention_count: null,
    };
    const full = scoreSignals(fullSignals);
    const partial = scoreSignals(withMissing);

    assert.deepEqual(partial.unavailableSignals, ["github_mention_count"]);
    assert.ok(partial.contributions.find((c) => c.key === "github_mention_count")?.excluded);
    // Excluding a high weight-2 signal changes the score vs treating as 0
    const asZero = scoreSignals({ ...fullSignals, github_mention_count: 0 });
    assert.notEqual(partial.score, asZero.score);
    assert.notEqual(partial.score, full.score);
  });

  it("buildScoreResult sets partial flag", () => {
    const result = buildScoreResult(
      {
        owner: "o",
        name: "r",
        url: "https://github.com/o/r",
        language: null,
        license: null,
        stars: 0,
        description: null,
        createdAt: "2021-12-20T02:15:12.000Z",
        updatedAt: "2026-07-07T22:16:34.000Z",
      },
      { ...fullSignals, github_mention_count: null },
    );
    assert.equal(result.partial, true);
    assert.deepEqual(result.unavailableSignals, ["github_mention_count"]);
    assert.equal(typeof result.score, "number");
  });
});
