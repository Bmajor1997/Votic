import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

test("native analysis gate fails on absent, malformed, incomplete and actionable evidence", () => {
  const dir = mkdtempSync(join(tmpdir(), "votic-sarif-"));
  const check = () => spawnSync(process.execPath, ["security/check-sarif.cjs", dir], { encoding: "utf8" });
  const write = report => writeFileSync(join(dir, "native.sarif"), JSON.stringify(report));
  const run = { tool: { driver: { name: "CodeQL" } }, results: [] };
  try {
    assert.notEqual(check().status, 0);
    write({ version: "2.1.0", runs: [{}] });
    assert.notEqual(check().status, 0);
    write({ version: "2.1.0", runs: [{ ...run, invocations: [{executionSuccessful: false}] }] });
    assert.notEqual(check().status, 0);
    write({ version: "2.1.0", runs: [{ ...run, results: [{ruleId: "unsafe", message: {text: "Finding"}}] }] });
    assert.notEqual(check().status, 0);
    write({ version: "2.1.0", runs: [run] });
    assert.equal(check().status, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
