import { Platform } from "react-native";
import { Entitlement } from "./subscriptionTypes";

/** Where people manage a store subscription when the store doesn't give Votic a direct link. */
export const STORE_SUBSCRIPTIONS_URL =
  Platform.OS === "ios"
    ? "https://apps.apple.com/account/subscriptions"
    : "https://play.google.com/store/account/subscriptions";

function formatDate(time: number) {
  return new Date(time).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

/** The subscription as the store reports it, in plain words. */
export function subscriptionStatus(entitlement: Entitlement) {
  const until = entitlement.expiresAt ? formatDate(entitlement.expiresAt) : null;
  switch (entitlement.status) {
    case "trial":
      return until ? `Free trial · ends ${until}` : "Free trial";
    case "active":
      return until ? `Active · renews ${until}` : "Active";
    case "cancelled-active":
      return until ? `Cancelled · access until ${until}` : "Cancelled · access until the end of this period";
    case "billing-issue":
      return "There's a problem with your payment. Update it in your store account to keep Votic Premium.";
    case "expired":
      return "Ended";
    case "none":
      return "Not subscribed";
    default:
      return "Status unavailable right now";
  }
}
