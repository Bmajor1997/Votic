/** Optional server-owned catalog. No configured catalog means existing limits and no upgrade offer. */
export function subscription_tiers(env) {
  const entries = JSON.parse(env.VOTIC_SUBSCRIPTION_TIERS_JSON || "[]");
  if (!Array.isArray(entries) || entries.length > 50) throw new Error("Invalid subscription tier catalog.");
  const ids = new Set();
  for (const tier of entries) {
    if (!valid_tier(tier) || ids.has(`${tier.store}:${tier.productId}`)) throw new Error("Invalid subscription tier catalog.");
    ids.add(`${tier.store}:${tier.productId}`);
  }
  return entries;
}
function valid_tier(tier) {
  if (!tier || typeof tier !== "object" || Array.isArray(tier)) return false;
  return typeof tier.productId === "string" && tier.productId.length > 0 && tier.productId.length <= 200 &&
    typeof tier.name === "string" && tier.name.trim().length > 0 && tier.name.length <= 60 &&
    ["app_store", "play_store"].includes(tier.store) &&
    Number.isSafeInteger(tier.monthlyTokens) && tier.monthlyTokens > 0 &&
    (tier.monthlyCredits === undefined || (Number.isSafeInteger(tier.monthlyCredits) && tier.monthlyCredits > 0)) &&
    typeof tier.monthlyBudgetUsd === "number" && Number.isFinite(tier.monthlyBudgetUsd) && tier.monthlyBudgetUsd > 0;
}
export function verified_tier(catalog, profile) {
  if (!profile?.allowed) return null;
  return catalog.find(tier => tier.productId === profile.productId && tier.store === profile.store) ?? null;
}
export function upgrade_options(catalog, current) {
  if (!current) return [];
  return catalog.filter(tier => tier.store === current.store && tier.monthlyTokens > current.monthlyTokens &&
    tier.monthlyBudgetUsd > current.monthlyBudgetUsd).map(tier => ({
      productId: tier.productId, name: tier.name,
      capacityMultiplier: tier.monthlyTokens / current.monthlyTokens === tier.monthlyBudgetUsd / current.monthlyBudgetUsd
        ? tier.monthlyTokens / current.monthlyTokens : null,
    }));
}
