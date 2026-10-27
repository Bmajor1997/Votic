import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { create_usage_store } from "../app_parts/ai_usage.js";

const script = fileURLToPath(new URL("../security/ops-check.js", import.meta.url));
const monitor = path => spawnSync(process.execPath, [script], {
  encoding: "utf8", env: { ...process.env, VOTIC_AI_USAGE_DB: path }, timeout: 10_000,
});
test("operations monitor fails closed for a missing or invalid ledger without creating/replacing it", () => {
  const dir = mkdtempSync(join(tmpdir(), "votic-monitor-")), path = join(dir, "missing.sqlite");
  try {
    assert.notEqual(monitor(path).status, 0);
    assert.equal(existsSync(path), false);
    writeFileSync(path, "not a database");
    assert.notEqual(monitor(path).status, 0);
    assert.equal(readFileSync(path, "utf8"), "not a database");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test("operations monitor exits nonzero on reported failures and outputs aggregate evidence only", () => {
  const dir = mkdtempSync(join(tmpdir(), "votic-monitor-")), path = join(dir, "live.sqlite");
  const store = create_usage_store({ VOTIC_AI_USAGE_DB: path });
  try {
    assert.equal(monitor(path).status, 0);
    store.recordReport({ user_id: "private-account", reason: "other", answer: "Private document contents" });
    store.recordClientEvent("screen-render", 1);
    const result = monitor(path);
    assert.equal(result.status, 1);
    const { status, alerts } = JSON.parse(result.stdout);
    assert.equal(status.reports.open, 1);
    assert.ok(alerts.some(alert => alert.includes("screen failures")));
    assert.doesNotMatch(result.stdout, /private-account|Private document contents/);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});
