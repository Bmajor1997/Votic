/** Server-owned Premium verification. Never trust an entitlement sent by the phone. */
export class PremiumVerificationError extends Error {
  constructor() {
    super("Votic could not verify Premium right now. Please try again shortly.");
    this.status = 503;
  }
}

export function has_premium_entitlement(customer, entitlement_id, now = Date.now()) {
  const entitlements = customer?.subscriber?.entitlements;
  if (!entitlements || typeof entitlements !== "object" || Array.isArray(entitlements))
    throw new PremiumVerificationError();
  const entitlement = Object.hasOwn(entitlements, entitlement_id) ? entitlements[entitlement_id] : null;
  if (!entitlement) return false;
  // A missing/malformed expiry is not a lifetime purchase. RevenueCat explicitly sends null for lifetime.
  if (typeof entitlement.purchase_date !== "string" || !Number.isFinite(Date.parse(entitlement.purchase_date)))
    throw new PremiumVerificationError();
  if (Date.parse(entitlement.purchase_date) > now) return false;
  if (entitlement.expires_date === null) return true;
  const expiry = Date.parse(entitlement.expires_date);
  if (!Number.isFinite(expiry)) throw new PremiumVerificationError();
  const grace = entitlement.grace_period_expires_date == null ? 0 : Date.parse(entitlement.grace_period_expires_date);
  if (!Number.isFinite(grace)) throw new PremiumVerificationError();
  // Cancellation does not remove paid-through access; trials and billing grace count too.
  return Math.max(expiry, grace) > now;
}

export function create_premium_authorizer(env, { fetchImpl = fetch, timeoutMs = 5000, now = Date.now } = {}) {
  const key = String(env.REVENUECAT_SECRET_API_KEY || "").trim();
  const entitlementId = String(env.REVENUECAT_ENTITLEMENT_ID || "pro").trim();
  return async (uid) => {
    if (typeof uid !== "string" || !uid) return false;
    if (!key) throw new PremiumVerificationError();
    const controller = new AbortController();
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new PremiumVerificationError()); }, timeoutMs);
    });
    try {
      // Use a separate transport from paid AI calls. The key is backend-only and never logged.
      const read = async () => {
        const response = await fetchImpl(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, {
          headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
          signal: controller.signal,
          redirect: "error",
        });
        if (!response.ok) throw new PremiumVerificationError();
        return has_premium_entitlement(await response.json(), entitlementId, now());
      };
      // The deadline covers headers AND body, including a transport that ignores AbortSignal.
      return await Promise.race([read(), deadline]);
    } catch {
      throw new PremiumVerificationError();
    } finally { clearTimeout(timer); }
  };
}
