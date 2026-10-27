import { AiLimitError } from "./ai_errors.js";
import { CREDIT_WALLET_SCHEMA } from "./credit_wallet.js";

/**
 * Votic Plus AI credits: the person-facing allowance. Provider tokens and dollars stay in ai_usage.js as
 * safeguards; credits are what a subscriber sees and spends. See docs/ai-credit-policy.md for the rationale.
 *
 * Fixed prices, decided before any AI work from the request's size, so the same action always costs the same.
 */
export const CREDIT_COSTS = {
  "help": 1, // a question about using Votic, without a document
  "document-small": 2, // a question or summary of a document request up to DOCUMENT_SMALL_BYTES
  "document-large": 5, // a larger document request (bounded by VOTIC_MAX_JSON_BYTES)
  "scan-ocr": 3, // one camera page
  "pdf-ocr-small": 10, "pdf-ocr-medium": 20, "pdf-ocr-large": 30, // scanned PDF by upload size
  "ask-votic-transcription": 1, // one spoken question (60 seconds at most)
};
export const DOCUMENT_SMALL_BYTES = 100_000;
/** A reservation whose request died (crash, lost process) gives its credits back after this long. */
export const CREDIT_HOLD_MS = 10 * 60_000;
/** Worst-case provider cost per credit under the current prices, with headroom; see the policy document. */
export const MAX_USD_PER_CREDIT = 0.005, MAX_TOKENS_PER_CREDIT = 40_000;
// A renewal can be reported slightly before the previous period's end; anything earlier is the same period.
const RENEWAL_TOLERANCE_MS = 24 * 3600_000;

export function credit_cost(feature, bytes = 0) {
  if (feature === "ask-votic" || feature === "catch-me-up" || feature === "document-review")
    return CREDIT_COSTS[bytes > DOCUMENT_SMALL_BYTES ? "document-large" : "document-small"];
  if (feature === "pdf-ocr") return CREDIT_COSTS[bytes <= 3_000_000 ? "pdf-ocr-small" : bytes <= 8_000_000 ? "pdf-ocr-medium" : "pdf-ocr-large"];
  const cost = CREDIT_COSTS[feature];
  if (!cost) throw new Error(`No credit price for ${feature}.`);
  return cost;
}

/** Whole percent remaining, rounded down so Votic never shows more than is left. */
export function percent_remaining(allowance, used) {
  if (!Number.isSafeInteger(allowance) || allowance <= 0) return null;
  const remaining = Math.min(allowance, Math.max(0, allowance - used));
  return Math.floor((remaining * 100) / allowance);
}

const iso = (time) => new Date(time).toISOString();
/** Store periods longer than this (annual plans) are split into monthly allowance cycles. */
const MONTHLY_PERIOD_MAX_MS = 45 * 86400_000;

/**
 * The same day-of-month and time `months` later, clamped to the month's last day (Jan 31 -> Feb 28 or 29 ->
 * Mar 31). Always counted from the anchor, never chained, so a short month doesn't shift later cycles.
 */
export function add_months(anchor, months) {
  const date = new Date(anchor);
  const target = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1);
  const year = new Date(target).getUTCFullYear(), month = new Date(target).getUTCMonth();
  const last_day = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(year, month, Math.min(date.getUTCDate(), last_day), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds());
}

/**
 * The monthly allowance cycle containing `now` inside a verified store period. A monthly plan's period is one
 * cycle. An annual plan gets twelve, each starting on the subscription's monthly anniversary; the last one ends
 * with the store period. After the period ends (billing grace) the last cycle continues; no new allowance.
 */
export function allowance_cycle(start, end, now) {
  if (end - start <= MONTHLY_PERIOD_MAX_MS) return { start, end };
  let index = 0;
  while (add_months(start, index + 1) <= now && add_months(start, index + 1) < end) index += 1;
  return { start: add_months(start, index), end: Math.min(add_months(start, index + 1), end) };
}
function calendar_month(now) {
  const date = new Date(now);
  return { start: Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1), end: Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) };
}

/** Shares the AI usage ledger's connection, so credit and token reservations live in one private database. */
export function create_credit_ledger(db, { now = () => new Date() } = {}) {
  db.exec(`${CREDIT_WALLET_SCHEMA}
    CREATE TABLE IF NOT EXISTS credit_periods (
      uid TEXT NOT NULL, period_start TEXT NOT NULL, period_end TEXT NOT NULL, allowance INTEGER NOT NULL,
      verified INTEGER NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(uid, period_start)
    );
    CREATE TABLE IF NOT EXISTS credit_charges (
      request_id TEXT PRIMARY KEY, uid TEXT NOT NULL, feature TEXT NOT NULL, period_start TEXT NOT NULL,
      subscription_credits INTEGER NOT NULL, purchased_credits INTEGER NOT NULL, status TEXT NOT NULL,
      created_at TEXT NOT NULL, settled_at TEXT
    );
    CREATE INDEX IF NOT EXISTS credit_charges_period ON credit_charges(uid, period_start);
    CREATE INDEX IF NOT EXISTS credit_charges_time ON credit_charges(uid, created_at);`);
  const transaction = (work) => {
    db.exec("BEGIN IMMEDIATE");
    try { const result = work(); db.exec("COMMIT"); return result; }
    catch (error) { db.exec("ROLLBACK"); throw error; }
  };
  const release_rows = (where, args) => {
    const at = now().toISOString();
    for (const row of db.prepare(`SELECT request_id FROM credit_charges WHERE status='reserved' AND ${where}`).all(...args)) {
      db.prepare("DELETE FROM credit_spends WHERE request_id=?").run(row.request_id);
      db.prepare("UPDATE credit_charges SET status='released',settled_at=? WHERE request_id=? AND status='reserved'").run(at, row.request_id);
    }
  };
  const release_stale = (uid) => release_rows("uid=? AND created_at<?", [uid, iso(now().getTime() - CREDIT_HOLD_MS)]);
  const used = (uid, period_start) => db.prepare(`SELECT COALESCE(SUM(subscription_credits),0) AS n FROM credit_charges
    WHERE uid=? AND period_start=? AND status IN ('reserved','charged')`).get(uid, period_start).n;
  const purchased = (uid) => {
    const grants = db.prepare("SELECT COALESCE(SUM(credits),0) AS n FROM credit_grants WHERE uid=? AND revoked=0").get(uid).n;
    const spends = db.prepare("SELECT COALESCE(SUM(credits),0) AS n FROM credit_spends WHERE uid=?").get(uid).n;
    return Math.max(0, grants - spends);
  };
  return {
    /**
     * The verified allowance cycle this request belongs to, recorded once: the billing period itself for a monthly
     * plan, the current monthly cycle of an annual one. Renewal (or the next monthly cycle) starts a fresh allowance;
     * repeated verification, delayed or stale data, early-reported renewals and mid-cycle plan switches never do.
     */
    period(uid, profile, allowance) {
      if (!Number.isSafeInteger(allowance) || allowance <= 0) throw new Error("Invalid monthly credit allowance.");
      let start = Date.parse(profile?.periodStart ?? ""), end = profile?.periodEnd == null ? NaN : Date.parse(profile.periodEnd);
      const verified = Number.isFinite(start) && Number.isFinite(end) && end > start;
      // A plan without a billing end (or malformed dates) resets on the UTC calendar month instead.
      if (!verified) ({ start, end } = calendar_month(now().getTime()));
      else ({ start, end } = allowance_cycle(start, end, now().getTime()));
      return transaction(() => {
        const latest = db.prepare("SELECT * FROM credit_periods WHERE uid=? ORDER BY period_start DESC LIMIT 1").get(uid);
        if (latest && latest.period_start !== iso(start)) {
          const latest_start = Date.parse(latest.period_start), latest_end = Date.parse(latest.period_end);
          // Older data (a cached profile) or an overlapping restart stays in the period already granted.
          if (start < latest_start || start < latest_end - RENEWAL_TOLERANCE_MS) {
            if (end > latest_end) db.prepare("UPDATE credit_periods SET period_end=? WHERE uid=? AND period_start=?").run(iso(end), uid, latest.period_start);
            const row = db.prepare("SELECT * FROM credit_periods WHERE uid=? AND period_start=?").get(uid, latest.period_start);
            return { start: row.period_start, end: row.period_end, allowance: row.allowance, verified: Boolean(row.verified) };
          }
        }
        db.prepare("INSERT OR IGNORE INTO credit_periods(uid,period_start,period_end,allowance,verified,created_at) VALUES(?,?,?,?,?,?)")
          .run(uid, iso(start), iso(end), allowance, verified ? 1 : 0, now().toISOString());
        const row = db.prepare("SELECT * FROM credit_periods WHERE uid=? AND period_start=?").get(uid, iso(start));
        return { start: row.period_start, end: row.period_end, allowance: row.allowance, verified: Boolean(row.verified) };
      });
    },
    /**
     * Holds the cost before any AI work. Monthly credits are used first (they expire at renewal); purchased
     * credits cover the rest. One request_id is held at most once. Throws when the person cannot afford it.
     */
    reserve({ uid, request_id, feature, credits, period }) {
      if (!Number.isSafeInteger(credits) || credits <= 0) throw new Error("Invalid credit cost.");
      return transaction(() => {
        const existing = db.prepare("SELECT * FROM credit_charges WHERE request_id=?").get(request_id);
        if (existing) {
          if (existing.uid !== uid) throw new Error("Credit request belongs to another account.");
          return { request_id, status: existing.status };
        }
        release_stale(uid);
        const monthly = Math.max(0, period.allowance - used(uid, period.start));
        const from_monthly = Math.min(monthly, credits), from_purchased = credits - from_monthly;
        if (from_purchased > purchased(uid)) {
          const error = new AiLimitError("You've used this month's AI allowance.", "AI_CREDITS_EXHAUSTED", period.end);
          error.purchased = purchased(uid) > 0;
          throw error;
        }
        const at = now().toISOString();
        if (from_purchased) db.prepare("INSERT INTO credit_spends(request_id,uid,credits,created_at) VALUES(?,?,?,?)").run(request_id, uid, from_purchased, at);
        db.prepare("INSERT INTO credit_charges(request_id,uid,feature,period_start,subscription_credits,purchased_credits,status,created_at) VALUES(?,?,?,?,?,?,'reserved',?)")
          .run(request_id, uid, feature, period.start, from_monthly, from_purchased, at);
        return { request_id, status: "reserved" };
      });
    },
    /** The person received the AI result. Idempotent; a released hold is never charged later. */
    charge(request_id) {
      db.prepare("UPDATE credit_charges SET status='charged',settled_at=? WHERE request_id=? AND status='reserved'").run(now().toISOString(), request_id);
    },
    /** No result reached the person (rejected, failed, canceled, timed out): give the credits back. Idempotent. */
    release(request_id) { transaction(() => release_rows("request_id=?", [request_id])); },
    summary(uid, period) {
      return transaction(() => {
        release_stale(uid);
        const spent = period ? Math.min(period.allowance, used(uid, period.start)) : 0;
        return { allowance: period?.allowance ?? null, used: spent, remaining: period ? period.allowance - spent : null, purchased: purchased(uid) };
      });
    },
    /** Provider safeguards that grow with the credits actually spent this calendar month, never past their cost bound. */
    safeguards(uid, floor) {
      const { start } = calendar_month(now().getTime());
      const credits = db.prepare(`SELECT COALESCE(SUM(subscription_credits+purchased_credits),0) AS n FROM credit_charges
        WHERE uid=? AND created_at>=? AND status IN ('reserved','charged')`).get(uid, iso(start)).n;
      return { monthlyTokens: Math.max(floor.monthlyTokens, credits * MAX_TOKENS_PER_CREDIT), monthlyBudgetUsd: Math.max(floor.monthlyBudgetUsd, credits * MAX_USD_PER_CREDIT) };
    },
    records(uid) { return db.prepare("SELECT * FROM credit_charges WHERE uid=? ORDER BY created_at, request_id").all(uid); },
    /** Account deletion: no credit history stays linked to the account. Called inside the deletion transaction. */
    remove_user(uid) {
      for (const table of ["credit_charges", "credit_periods", "credit_spends", "credit_grants", "credit_refund_states"]) db.prepare(`DELETE FROM ${table} WHERE uid=?`).run(uid);
    },
  };
}
