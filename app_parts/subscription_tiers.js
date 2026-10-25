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
  const valid_text = (value, max) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
  const positive_integer = (value) => Number.isSafeInteger(value) && value > 0;
  const positive_budget = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
  return valid_text(tier.productId, 200) && valid_text(tier.name, 60) &&
    ["app_store", "play_store"].includes(tier.store) &&
    positive_integer(tier.monthlyTokens) &&
    (tier.monthlyCredits === undefined || positive_integer(tier.monthlyCredits)) &&
    positive_budget(tier.monthlyBudgetUsd);
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
