import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { setInterval, clearInterval } from "node:timers";
export const AI_EXECUTION_TIMEOUT_MS = 60_000;
export const AI_EXECUTION_LEASE_MS = 90_000;
const deletion_key = (uid) => createHash("sha256").update(uid).digest("hex");

export class AiLimitError extends Error {
  constructor(message) { super(message); this.status = 429; this.headers = { "Retry-After": "60" }; }
}

// USD per million tokens, Standard processing, verified 2026-10-05.
const PRICES = {
  "gpt-6-luna": { input: 0.10, cached: 0.01, cache_write: 0.125, output: 0.50 },
  "gpt-4o-mini-transcribe": { input: 1.25, cached: 1.25, cache_write: 1.25, output: 5 },
};
export function model_prices(model, env = {}) {
  const overrides = JSON.parse(env.VOTIC_AI_PRICES_JSON || "{}");
  const rates = overrides[model] || PRICES[model];
  if (!rates) throw new Error("Configure VOTIC_AI_PRICES_JSON before enabling an unpriced model.");
  if (![rates.input, rates.cached, rates.cache_write, rates.output].every((v) => typeof v === "number" && Number.isFinite(v) && v >= 0))
    throw new Error("AI prices must contain nonnegative input, cached, cache_write, and output rates.");
  return rates;
}
export function token_usage(result) {
  const u = result?.usage;
  if (!u || ![u.input_tokens, u.output_tokens, u.total_tokens].every((n) => Number.isSafeInteger(n) && n >= 0)) return null;
  const cached = u.input_tokens_details?.cached_tokens ?? u.input_token_details?.cached_tokens ?? 0;
  const writes = u.input_tokens_details?.cache_write_tokens ?? 0;
  if (![cached, writes].every((n) => Number.isSafeInteger(n) && n >= 0) || cached + writes > u.input_tokens || u.total_tokens !== u.input_tokens + u.output_tokens) return null;
  return { input_tokens: u.input_tokens, output_tokens: u.output_tokens, cached_tokens: cached, cache_write_tokens: writes, total_tokens: u.total_tokens };
}
export function estimate_cost(usage, rates) {
  // Long-context premium applies to the entire request above 272K input tokens.
  const input_multiplier = usage.input_tokens > 272000 ? 2 : 1;
  const output_multiplier = usage.input_tokens > 272000 ? 1.5 : 1;
  return ((usage.input_tokens - usage.cached_tokens - usage.cache_write_tokens) * rates.input * input_multiplier
    + usage.cached_tokens * rates.cached * input_multiplier + usage.cache_write_tokens * rates.cache_write * input_multiplier
    + usage.output_tokens * rates.output * output_multiplier) / 1e6;
}
function number_setting(env, name, fallback) {
  const n = env[name] == null || env[name] === "" ? fallback : Number(env[name]);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be a positive number.`);
  return n;
}

/** Atomic reservations and completion in a private SQLite ledger. Share one file between local workers.
 * Pending/unknown calls retain their full reservation, including after a crash; never reset them blindly.
 * Usage rows contain no document text, questions, audio, authentication tokens, or provider error bodies.
 * The separate reports table stores only answers explicitly submitted for review.
 */
export function create_usage_store(env = {}, { now = () => new Date(), path = env.VOTIC_AI_USAGE_DB || ":memory:" } = {}) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS ai_usage (
      request_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, feature TEXT NOT NULL, model TEXT NOT NULL,
      started_at TEXT NOT NULL, completed_at TEXT, status TEXT NOT NULL, provider_request_id TEXT, response_id TEXT,
      input_tokens INTEGER, output_tokens INTEGER, cached_tokens INTEGER, cache_write_tokens INTEGER, total_tokens INTEGER,
      reserved_tokens INTEGER NOT NULL, allowance_tokens INTEGER NOT NULL, reserved_cost REAL NOT NULL,
      estimated_cost_usd REAL NOT NULL, usage_known INTEGER NOT NULL DEFAULT 0, pricing_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ai_usage_user_time ON ai_usage(user_id, started_at);
    CREATE INDEX IF NOT EXISTS ai_usage_time ON ai_usage(started_at);
    CREATE TABLE IF NOT EXISTS ai_reports (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL,
      reason TEXT NOT NULL, answer TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open'
    );
    CREATE TABLE IF NOT EXISTS account_deletions (
      uid_hash TEXT PRIMARY KEY, anonymous_id TEXT NOT NULL, requested_at TEXT NOT NULL, completed_at TEXT
    );`);
  // Keep only the bounded financial-control window for anonymized deleted-account rows.
  const prune = () => {
    db.prepare("DELETE FROM ai_usage WHERE user_id LIKE 'deleted:%' AND started_at<?")
      .run(new Date(now().getTime() - 90 * 86400000).toISOString());
    db.prepare("DELETE FROM ai_reports WHERE created_at<?").run(new Date(now().getTime() - 30 * 86400000).toISOString());
  };
  prune();
  const retentionTimer = setInterval(() => { try { prune(); } catch { console.warn("Private ledger retention is waiting for storage; it will retry."); } }, 3600000);
  retentionTimer.unref();
  const limits = {
    user_tokens: number_setting(env, "VOTIC_AI_MONTHLY_TOKENS", 2000000),
    global_cost: number_setting(env, "VOTIC_AI_MONTHLY_BUDGET_USD", 100),
    user_cost: number_setting(env, "VOTIC_AI_USER_MONTHLY_BUDGET_USD", 5),
    user_daily: number_setting(env, "VOTIC_AI_CLIENT_DAILY_LIMIT", 100),
    global_daily: number_setting(env, "VOTIC_AI_DAILY_LIMIT", 1000),
    user_rate: number_setting(env, "VOTIC_AI_USER_RATE_LIMIT", 20),
    concurrency: number_setting(env, "VOTIC_AI_USER_CONCURRENCY", 2),
  };
  return {
    reserve({ user_id, feature, model, input_bound, output_bound, rates }) {
      const started_at = now().toISOString(), month = started_at.slice(0, 7) + "-01T00:00:00.000Z", day = started_at.slice(0, 10) + "T00:00:00.000Z";
      const minute = new Date(Date.parse(started_at) - 60000).toISOString();
      const reserved_tokens = input_bound + output_bound;
      // Reserve the most expensive input category; cache writes can cost more than uncached input.
      const reserved_cost = estimate_cost({ input_tokens: input_bound, output_tokens: output_bound, cached_tokens: 0, cache_write_tokens: 0 }, { ...rates, input: Math.max(rates.input, rates.cached, rates.cache_write) });
      db.exec("BEGIN IMMEDIATE");
      try {
        if (user_id.startsWith("user:") && this.accountDeletion(user_id.slice(5))) throw new AiLimitError("This account is being deleted.");
        // A dead request stops consuming execution capacity, but retains its full cost/token reservation.
        const expired = new Date(Date.parse(started_at) - AI_EXECUTION_LEASE_MS).toISOString();
        db.prepare("UPDATE ai_usage SET status='unknown',completed_at=? WHERE status='pending' AND started_at<=?").run(started_at, expired);
        const sums = db.prepare(`SELECT COALESCE(SUM(allowance_tokens),0) AS tokens, COALESCE(SUM(estimated_cost_usd),0) AS cost FROM ai_usage WHERE user_id=? AND started_at>=?`).get(user_id, month);
        const global = db.prepare("SELECT COALESCE(SUM(estimated_cost_usd),0) AS cost FROM ai_usage WHERE started_at>=?").get(month);
        const counts = db.prepare(`SELECT SUM(started_at>=?) AS daily, SUM(started_at>=?) AS minute, SUM(status='pending') AS active FROM ai_usage WHERE user_id=?`).get(day, minute, user_id);
        const global_daily = db.prepare("SELECT COUNT(*) AS count FROM ai_usage WHERE started_at>=?").get(day).count;
        if (sums.tokens + reserved_tokens > limits.user_tokens || sums.cost + reserved_cost > limits.user_cost)
          throw new AiLimitError("You've reached your monthly AI allowance. Try again next month.");
        if (global.cost + reserved_cost > limits.global_cost) throw new AiLimitError("Votic's monthly AI budget has been reached. Try again next month.");
        if (counts.daily >= limits.user_daily || global_daily >= limits.global_daily) throw new AiLimitError("Today's AI allowance has been reached. Try again tomorrow.");
        if (counts.minute >= limits.user_rate || counts.active >= limits.concurrency) throw new AiLimitError("Too many AI requests. Please try again shortly.");
        const request_id = randomUUID();
        db.prepare(`INSERT INTO ai_usage (request_id,user_id,feature,model,started_at,status,reserved_tokens,allowance_tokens,reserved_cost,estimated_cost_usd,pricing_json) VALUES (?,?,?,?,?,'pending',?,?,?,?,?)`)
          .run(request_id, user_id, feature, model, started_at, reserved_tokens, reserved_tokens, reserved_cost, reserved_cost, JSON.stringify(rates));
        db.exec("COMMIT");
        return request_id;
      } catch (error) { db.exec("ROLLBACK"); throw error; }
    },
    finish(request_id, { status, result, provider_request_id = null, rejected = false }) {
      const row = db.prepare("SELECT * FROM ai_usage WHERE request_id=? AND status IN ('pending','unknown') AND usage_known=0").get(request_id);
      if (!row) return;
      const usage = token_usage(result);
      const estimated_cost_usd = usage ? estimate_cost(usage, JSON.parse(row.pricing_json)) : rejected ? 0 : row.reserved_cost;
      db.prepare(`UPDATE ai_usage SET completed_at=?,status=?,provider_request_id=?,response_id=?,input_tokens=?,output_tokens=?,cached_tokens=?,cache_write_tokens=?,total_tokens=?,allowance_tokens=?,estimated_cost_usd=?,usage_known=? WHERE request_id=? AND status IN ('pending','unknown') AND usage_known=0`)
        .run(now().toISOString(), status, row.user_id.startsWith("deleted:") ? null : provider_request_id, !row.user_id.startsWith("deleted:") && typeof result?.id === "string" ? result.id : null,
          usage?.input_tokens ?? null, usage?.output_tokens ?? null, usage?.cached_tokens ?? null, usage?.cache_write_tokens ?? null, usage?.total_tokens ?? null,
          usage?.total_tokens ?? (rejected ? 0 : row.reserved_tokens), estimated_cost_usd, usage ? 1 : 0, request_id);
    },
    records() { return db.prepare("SELECT * FROM ai_usage ORDER BY started_at, request_id").all(); },
    purgeReports() { db.prepare("DELETE FROM ai_reports WHERE created_at<?").run(new Date(now().getTime() - 30 * 86400000).toISOString()); },
    recordReport({ user_id, reason, answer }) {
      this.purgeReports();
      const id = randomUUID();
      db.exec("BEGIN IMMEDIATE");
      try {
        if (this.accountDeletion(user_id)) throw new Error("This account is being deleted.");
        db.prepare("INSERT INTO ai_reports(id,user_id,created_at,reason,answer) VALUES(?,?,?,?,?)").run(id, user_id, now().toISOString(), reason, answer);
        db.exec("COMMIT");
      } catch (error) { db.exec("ROLLBACK"); throw error; }
      return id;
    },
    reports() { this.purgeReports(); return db.prepare("SELECT * FROM ai_reports ORDER BY (status='open') DESC,created_at DESC LIMIT 100").all(); },
    resolveReport(id) { db.prepare("UPDATE ai_reports SET status='reviewed' WHERE id=?").run(id); },
    accountDeletion(uid) { return db.prepare("SELECT completed_at FROM account_deletions WHERE uid_hash=?").get(deletion_key(uid)) || null; },
    beginAccountDeletion(uid) {
      db.exec("BEGIN IMMEDIATE");
      try {
        db.prepare("INSERT OR IGNORE INTO account_deletions(uid_hash,anonymous_id,requested_at) VALUES(?,?,?)")
          .run(deletion_key(uid), "deleted:" + randomUUID(), now().toISOString());
        const row = db.prepare("SELECT anonymous_id FROM account_deletions WHERE uid_hash=?").get(deletion_key(uid));
        db.prepare("DELETE FROM ai_reports WHERE user_id=?").run(uid);
        // Preserve global spending limits, without the original account identifier or provider linkage.
        db.prepare("UPDATE ai_usage SET user_id=?,provider_request_id=NULL,response_id=NULL WHERE user_id IN (?,?)")
          .run(row.anonymous_id, uid, "user:" + uid);
        db.exec("COMMIT");
      } catch (error) { db.exec("ROLLBACK"); throw error; }
    },
    completeAccountDeletion(uid) {
      // Unlink the financial alias from the retained revocation hash after cleanup.
      db.prepare("UPDATE account_deletions SET completed_at=?,anonymous_id=? WHERE uid_hash=?")
        .run(now().toISOString(), "deleted:" + randomUUID(), deletion_key(uid));
    },
    close() { clearInterval(retentionTimer); db.close(); },
  };
}
