import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { validate_evidence, REQUIRED } = createRequire(import.meta.url)("../security/check-release-evidence.cjs");
const commit = "a".repeat(40);
test("release evidence rejects missing, stale-commit and future attestations", () => {
  const evidence = { version: 1, commit, platforms: ["android", "ios"], checks: Object.fromEntries(REQUIRED.map(id => [id, {
    status: "verified", reviewer: "test reviewer", evidence: "test-only evidence reference", checkedAt: "2026-10-20T00:00:00Z",
  }])) };
  const now = Date.parse("2026-10-21T00:00:00Z");
  assert.equal(validate_evidence(evidence, commit, now), true);
  assert.throws(() => validate_evidence(evidence, "b".repeat(40), now), /exact release commit/);
  evidence.checks[REQUIRED[0]].status = "pending";
  assert.throws(() => validate_evidence(evidence, commit, now), /incomplete/);
  evidence.checks[REQUIRED[0]].status = "verified";
  evidence.checks[REQUIRED[0]].checkedAt = "2099-01-01";
  assert.throws(() => validate_evidence(evidence, commit, now), /incomplete/);
});
