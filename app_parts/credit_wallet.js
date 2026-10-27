import { DatabaseSync } from "node:sqlite";
import { createHash, timingSafeEqual } from "node:crypto";

/** The account-deletion marker, shared with the AI usage ledger in the same database. */
export const account_deletion_key = (uid) => createHash("sha256").update(uid).digest("hex");
/** Purchased credits. The AI credit ledger spends from these same tables inside its own transactions. */
export const CREDIT_WALLET_SCHEMA = `
    CREATE TABLE IF NOT EXISTS credit_grants (
      event_id TEXT PRIMARY KEY, uid TEXT NOT NULL, transaction_id TEXT NOT NULL UNIQUE,
      product_id TEXT NOT NULL, credits INTEGER NOT NULL, created_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS credit_refund_states (
      transaction_id TEXT NOT NULL, uid TEXT NOT NULL, product_id TEXT NOT NULL,
      revoked INTEGER NOT NULL, event_timestamp_ms INTEGER NOT NULL,
      PRIMARY KEY(transaction_id, uid, product_id)
    );
    CREATE INDEX IF NOT EXISTS credit_refund_states_uid ON credit_refund_states(uid);
    CREATE TABLE IF NOT EXISTS credit_spends (
      request_id TEXT PRIMARY KEY, uid TEXT NOT NULL, credits INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS account_deletions (
      uid_hash TEXT PRIMARY KEY, anonymous_id TEXT NOT NULL, requested_at TEXT NOT NULL, completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS credit_grants_uid ON credit_grants(uid);
    CREATE INDEX IF NOT EXISTS credit_spends_uid ON credit_spends(uid);`;

/** Server-owned, durable, idempotent RevenueCat purchase wallet. */
export function create_credit_wallet(env, { now = Date.now } = {}) {
  const path = env.VOTIC_AI_USAGE_DB;
  if (!path || path === ":memory:") throw new Error("Credit purchases require a persistent VOTIC_AI_USAGE_DB.");
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA busy_timeout=5000;${CREDIT_WALLET_SCHEMA}`);
  const products = JSON.parse(env.VOTIC_CREDIT_PRODUCTS_JSON || "{}");
  if (!products || Array.isArray(products) || typeof products !== "object" ||
      Object.values(products).some(v => !Number.isSafeInteger(v) || v <= 0 || v > 100000))
    throw new Error("Invalid VOTIC_CREDIT_PRODUCTS_JSON.");
  const balance = uid => {
    const grants = db.prepare("SELECT COALESCE(SUM(credits),0) AS n FROM credit_grants WHERE uid=? AND revoked=0").get(uid).n;
    const spends = db.prepare("SELECT COALESCE(SUM(credits),0) AS n FROM credit_spends WHERE uid=?").get(uid).n;
    return Math.max(0, grants - spends);
  };
  const recognized = (event, allowSandbox) => {
    if (!event || (event.environment !== "PRODUCTION" && !(allowSandbox && event.environment === "SANDBOX"))) return false;
    return typeof event.product_id === "string" && Object.hasOwn(products, event.product_id);
  };
  const valid_identity = (event) => {
    if (![event.app_user_id, event.transaction_id, event.id].every(v => typeof v === "string" && v.length > 0 && v.length < 512) ||
        event.app_user_id.startsWith("$RCAnonymousID:")) throw new Error("Purchase has no verified Votic account.");
    return !db.prepare("SELECT 1 FROM account_deletions WHERE uid_hash=?").get(account_deletion_key(event.app_user_id));
  };
  const atomic = work => {
    db.exec("BEGIN IMMEDIATE");
    try { const result = work(); db.exec("COMMIT"); return result; }
    catch (error) { db.exec("ROLLBACK"); throw error; }
  };
  return {
    balance,
    grant(event, { allowSandbox = false } = {}) {
      // RevenueCat reports one-time purchases only as NON_RENEWING_PURCHASE.
      if (!event || event.type !== "NON_RENEWING_PURCHASE") return { processed: false };
      // Store test purchases are free (TestFlight, Play testers), so they never grant real credits unless a test
      // server explicitly allows them.
      if (!recognized(event, allowSandbox)) return { processed: false };
      const uid = event.app_user_id, transaction = event.transaction_id, eventId = event.id;
      const product = event.product_id, credits = Object.hasOwn(products, product) ? products[product] : null;
      if (!credits) return { processed: false };
      // Serialize the deletion marker check and grant with account deletion in every server process.
      return atomic(() => {
        // A purchase reported after its account was deleted has no account to credit.
        if (!valid_identity(event)) return { processed: false };
        // One SQLite statement makes a late grant observe any refund already recorded by another process.
        db.prepare(`INSERT OR IGNORE INTO credit_grants(event_id,uid,transaction_id,product_id,credits,created_at,revoked)
          VALUES(?,?,?,?,?,?,COALESCE((SELECT revoked FROM credit_refund_states WHERE transaction_id=? AND uid=? AND product_id=?),0))`)
          .run(eventId, uid, transaction, product, credits, new Date(now()).toISOString(), transaction, uid, product);
        return { processed: true };
      });
    },
    /** Refund state survives missing grants, retries, restarts and out-of-order webhook delivery. */
    refund(event, { allowSandbox = false } = {}) {
      if (!["CANCELLATION", "REFUND_REVERSED"].includes(event?.type) || !recognized(event, allowSandbox)) return { processed: false };
      if (!Number.isSafeInteger(event.event_timestamp_ms) || event.event_timestamp_ms < 0)
        throw new Error("Refund has no valid event timestamp.");
      const revoked = event.type === "CANCELLATION" ? 1 : 0;
      const args = [event.transaction_id, event.app_user_id, event.product_id];
      return atomic(() => {
        if (!valid_identity(event)) return { processed: false };
        // Equal timestamps are resolved conservatively in favor of revocation, independent of delivery order.
        db.prepare(`INSERT INTO credit_refund_states(transaction_id,uid,product_id,revoked,event_timestamp_ms) VALUES(?,?,?,?,?)
          ON CONFLICT(transaction_id,uid,product_id) DO UPDATE SET revoked=excluded.revoked,event_timestamp_ms=excluded.event_timestamp_ms
          WHERE excluded.event_timestamp_ms>credit_refund_states.event_timestamp_ms OR
            (excluded.event_timestamp_ms=credit_refund_states.event_timestamp_ms AND excluded.revoked>credit_refund_states.revoked)`)
          .run(...args, revoked, event.event_timestamp_ms);
        const state = db.prepare("SELECT revoked FROM credit_refund_states WHERE transaction_id=? AND uid=? AND product_id=?").get(...args);
        db.prepare("UPDATE credit_grants SET revoked=? WHERE transaction_id=? AND uid=? AND product_id=?").run(state.revoked, ...args);
        return { processed: true };
      });
    },
    spend(uid, requestId, credits = 1) {
      if (!Number.isSafeInteger(credits) || credits <= 0) throw new Error("Invalid credit cost.");
      db.exec("BEGIN IMMEDIATE");
      try {
        if (db.prepare("SELECT 1 FROM credit_spends WHERE request_id=?").get(requestId)) { db.exec("COMMIT"); return true; }
        if (balance(uid) < credits) { db.exec("COMMIT"); return false; }
        db.prepare("INSERT INTO credit_spends(request_id,uid,credits,created_at) VALUES(?,?,?,?)")
          .run(requestId, uid, credits, new Date(now()).toISOString());
        db.exec("COMMIT");
        return true;
      } catch (error) { db.exec("ROLLBACK"); throw error; }
    },
    revoke(transactionId) {
      db.prepare("UPDATE credit_grants SET revoked=1 WHERE transaction_id=?").run(transactionId);
    },
    /** A refund the store reversed (REFUND_REVERSED, App Store only) restores that purchase's credits. */
    restore(transactionId) {
      db.prepare("UPDATE credit_grants SET revoked=0 WHERE transaction_id=?").run(transactionId);
    },
    deleteAccount(uid) {
      db.prepare("DELETE FROM credit_refund_states WHERE uid=?").run(uid);
      db.prepare("DELETE FROM credit_spends WHERE uid=?").run(uid);
      db.prepare("DELETE FROM credit_grants WHERE uid=?").run(uid);
    },
    close() { db.close(); },
  };
}

export function authorized_revenuecat_webhook(header, secret) {
  if (typeof secret !== "string" || secret.length < 24 || typeof header !== "string") return false;
  const a = Buffer.from(header), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
