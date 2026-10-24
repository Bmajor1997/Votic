import type { SubscriptionOptions } from "../api/voticApi";
import type { SubscriptionPlan } from "./subscriptionTypes";

/** A monthly upgrade must increase BOTH server allowance caps and be available in this device's store. */
export function upgrade_offers(options: SubscriptionOptions, plans: SubscriptionPlan[], platform: string) {
  const store = platform === "ios" ? "app_store" : platform === "android" ? "play_store" : null;
  if (!store || options.current?.store !== store) return [];
  return options.upgrades.flatMap((upgrade) => {
    const plan = plans.find(
      (item) =>
        item.productId === upgrade.productId &&
        item.billingPeriod?.unit === "month" &&
        item.billingPeriod.count === 1 &&
        Boolean(item.priceString.trim()),
    );
    return plan ? [{ ...upgrade, plan }] : [];
  });
}
