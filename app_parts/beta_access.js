/** Beta access is evaluated only against the UID returned by Firebase verification. */
export function beta_access_config(env = {}) {
  const mode = env.VOTIC_BETA_ACCESS_MODE || "off";
  if (!["off", "allowlist", "all-signed-in"].includes(mode))
    throw new Error("VOTIC_BETA_ACCESS_MODE must be off, allowlist, or all-signed-in.");
  const uids = new Set(String(env.VOTIC_BETA_TESTER_UIDS || "").split(",").map(v => v.trim()).filter(Boolean));
  if (mode === "allowlist" && !uids.size) throw new Error("VOTIC_BETA_TESTER_UIDS is required in allowlist mode.");
  return { mode, allows: uid => typeof uid === "string" && Boolean(uid) && (mode === "all-signed-in" || (mode === "allowlist" && uids.has(uid))) };
}
