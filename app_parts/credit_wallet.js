import { DatabaseSync } from "node:sqlite";
import { timingSafeEqual } from "node:crypto";

/** Server-owned, durable, idempotent RevenueCat purchase wallet. */
export function create_credit_wallet(env, { now = Date.now } = {}) {
  const path = env.VOTIC_AI_USAGE_DB;
  if (!path || path === ":memory:") throw new Error("Credit purchases require a persistent VOTIC_AI_USAGE_DB.");
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS credit_grants (
      event_id TEXT PRIMARY KEY, uid TEXT NOT NULL, transaction_id TEXT NOT NULL UNIQUE,
      product_id TEXT NOT NULL, credits INTEGER NOT NULL, created_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS credit_spends (
      request_id TEXT PRIMARY KEY, uid TEXT NOT NULL, credits INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS credit_grants_uid ON credit_grants(uid);
    CREATE INDEX IF NOT EXISTS credit_spends_uid ON credit_spends(uid);`);
  const products = JSON.parse(env.VOTIC_CREDIT_PRODUCTS_JSON || "{}");
  if (!products || Array.isArray(products) || typeof products !== "object" ||
      Object.values(products).some(v => !Number.isSafeInteger(v) || v <= 0 || v > 100000))
    throw new Error("Invalid VOTIC_CREDIT_PRODUCTS_JSON.");
  const balance = uid => {
    const grants = db.prepare("SELECT COALESCE(SUM(credits),0) AS n FROM credit_grants WHERE uid=? AND revoked=0").get(uid).n;
    const spends = db.prepare("SELECT COALESCE(SUM(credits),0) AS n FROM credit_spends WHERE uid=?").get(uid).n;
    return Math.max(0, grants - spends);
  };
  return {
    balance,
    grant(event, { allowSandbox = false } = {}) {
      // RevenueCat reports one-time purchases only as NON_RENEWING_PURCHASE.
      if (!event || event.type !== "NON_RENEWING_PURCHASE") return { processed: false };
      // Store test purchases are free (TestFlight, Play testers), so they never grant real credits unless a test
      // server explicitly allows them.
      if (event.environment !== "PRODUCTION" && !allowSandbox) return { processed: false };
      const uid = event.app_user_id, transaction = event.transaction_id, eventId = event.id;
      const product = event.product_id, credits = Object.hasOwn(products, product) ? products[product] : null;
      if (!credits) return { processed: false };
      if (![uid, transaction, eventId].every(v => typeof v === "string" && v.length > 0 && v.length < 512) ||
          uid.startsWith("$RCAnonymousID:")) throw new Error("Purchase has no verified Votic account.");
      db.prepare("INSERT OR IGNORE INTO credit_grants(event_id,uid,transaction_id,product_id,credits,created_at) VALUES(?,?,?,?,?,?)")
        .run(eventId, uid, transaction, product, credits, new Date(now()).toISOString());
      return { processed: true };
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
