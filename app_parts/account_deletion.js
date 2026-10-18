export class AccountDeletionError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}

/** Delete only the identity verified by Firebase, never an account ID from the request body. */
export async function delete_account_data({ uid, auth_time, phase, env, store, fetchImpl = fetch, now = Date.now() }) {
  if (!uid) throw new AccountDeletionError(401, "Sign in before deleting your account.");
  if (!Number.isFinite(auth_time) || auth_time > now / 1000 + 60 || now / 1000 - auth_time > 300)
    throw new AccountDeletionError(409, "Sign out and sign back in using your usual method, then retry account deletion.", "REAUTH_REQUIRED");
  if (!env.REVENUECAT_SECRET_API_KEY || (env.NODE_ENV === "production" && (!env.VOTIC_AI_USAGE_DB || env.VOTIC_AI_USAGE_DB === ":memory:")))
    throw new AccountDeletionError(503, "Account deletion is not configured on this server. Please contact Votic support.");
  if (phase === "prepare") return { ready: true };
  store.beginAccountDeletion(uid);
  const controller = new AbortController();
  let timer;
  try {
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new AccountDeletionError(503, "Account deletion was interrupted. Please retry to finish deleting your account.")); }, 8000);
    });
    const remove = async () => {
      const response = await fetchImpl(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${env.REVENUECAT_SECRET_API_KEY}` },
        signal: controller.signal, redirect: "error",
      });
      // Retrying a deletion of an already absent customer is successful.
      if (!response.ok && response.status !== 404) throw new AccountDeletionError(503, "Votic could not finish deleting billing-profile data. Please retry; your store subscription is managed separately.");
      await response.body?.cancel().catch(() => {});
    };
    await Promise.race([remove(), deadline]);
    store.completeAccountDeletion(uid);
    return { deleted: true };
  } catch (error) {
    if (error instanceof AccountDeletionError) throw error;
    throw new AccountDeletionError(503, "Account deletion was interrupted. Please retry to finish deleting your account.");
  } finally { clearTimeout(timer); }
}
