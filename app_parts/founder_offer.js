import { account_deletion_key } from "./credit_wallet.js";

/**
 * Founder lifetime offer: a one-time purchase that unlocks Votic Plus for good, offered only to beta testers,
 * for a limited window and to a limited number of people.
 *
 * Settings (all server-side, nothing the phone can change):
 * - VOTIC_FOUNDER_PRODUCT_ID: the store product for the founder lifetime purchase. Unset = no founder offer.
 * - VOTIC_FOUNDER_ENDS_AT: when the offer closes (ISO date and time, e.g. 30 days after launch). Required.
 * - VOTIC_FOUNDER_LIMIT: how many founder purchases before the offer closes. Default 100.
 */
export function founder_offer_config(env = {}) {
  const productId = String(env.VOTIC_FOUNDER_PRODUCT_ID || "").trim();
  if (!productId) return null;
  if (!/^[A-Za-z0-9_.:-]+$/.test(productId)) throw new Error("VOTIC_FOUNDER_PRODUCT_ID must be a store product identifier.");
  const endsAt = Date.parse(String(env.VOTIC_FOUNDER_ENDS_AT || ""));
  if (!Number.isFinite(endsAt)) throw new Error("VOTIC_FOUNDER_ENDS_AT must be a date and time when VOTIC_FOUNDER_PRODUCT_ID is set.");
  const rawLimit = String(env.VOTIC_FOUNDER_LIMIT ?? "").trim();
  const limit = rawLimit ? Number(rawLimit) : 100;
  if (!Number.isInteger(limit) || limit < 1) throw new Error("VOTIC_FOUNDER_LIMIT must be a whole number of 1 or more.");
  return { productId, endsAt, limit };
}

/** Google Play reports "sku:base-plan" for subscriptions; a one-time product is just the sku. */
export const is_founder_product = (config, productId) =>
  Boolean(config && typeof productId === "string" && (productId === config.productId || productId.split(":")[0] === config.productId));

/**
 * Who counts as a beta tester and how many founder spots are taken. Accounts are stored only as the same one-way
 * hash used for account deletion, never the raw UID.
 */
export function create_founder_store(db, { now = () => new Date() } = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS founder_beta_testers (uid_hash TEXT PRIMARY KEY, first_seen_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS founder_purchases (uid_hash TEXT PRIMARY KEY, product_id TEXT NOT NULL, recorded_at TEXT NOT NULL);`);
  const key = account_deletion_key;
  return {
    /** Remember that this account used Votic during the beta, so it stays eligible after beta access ends. */
    remember_beta_tester(uid) {
      db.prepare("INSERT OR IGNORE INTO founder_beta_testers(uid_hash, first_seen_at) VALUES (?, ?)").run(key(uid), now().toISOString());
    },
    was_beta_tester(uid) { return Boolean(db.prepare("SELECT 1 FROM founder_beta_testers WHERE uid_hash=?").get(key(uid))); },
    /** Counted once per account, the first time the server verifies its founder purchase with the store. */
    record_purchase(uid, productId) {
      db.prepare("INSERT OR IGNORE INTO founder_purchases(uid_hash, product_id, recorded_at) VALUES (?, ?, ?)").run(key(uid), productId, now().toISOString());
    },
    purchase_count() { return db.prepare("SELECT COUNT(*) AS count FROM founder_purchases").get().count; },
    /** Deleting an account forgets its beta-tester mark. A founder spot it used stays taken (only the hash is kept). */
    remove_user(uid) { db.prepare("DELETE FROM founder_beta_testers WHERE uid_hash=?").run(key(uid)); },
  };
}

/** The offer this account may see right now, or null. Never shown to someone who already has access. */
export function founder_offer_for(config, store, { uid, betaAllowed, nowMs = Date.now() }) {
  if (!config || !store || typeof uid !== "string" || !uid) return null;
  if (nowMs >= config.endsAt) return null;
  if (!betaAllowed && !store.was_beta_tester(uid)) return null;
  const remaining = config.limit - store.purchase_count();
  if (remaining <= 0) return null;
  return { productId: config.productId, endsAt: new Date(config.endsAt).toISOString(), remaining };
}
