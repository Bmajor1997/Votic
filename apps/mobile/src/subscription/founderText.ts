import { FounderOffer } from "./subscriptionTypes";

function format_end(endsAt: string) {
  return new Date(endsAt).toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

/** Plain-language availability: when it ends, and how many spots are left once they're running low. */
export function founder_availability(offer: FounderOffer) {
  const ends = `Ends ${format_end(offer.endsAt)}`;
  if (offer.remaining <= 25)
    return `${ends} · ${offer.remaining} founder ${offer.remaining === 1 ? "spot" : "spots"} left`;
  return `${ends} · Limited founder spots`;
}

/** The server's founder offer for this account, or null. Anything malformed is treated as no offer. */
export function founder_offer_from(value: unknown): FounderOffer | null {
  if (!value || typeof value !== "object") return null;
  const { productId, endsAt, remaining } = value as Record<string, unknown>;
  if (
    typeof productId !== "string" ||
    !productId ||
    typeof endsAt !== "string" ||
    !Number.isFinite(Date.parse(endsAt))
  )
    return null;
  if (typeof remaining !== "number" || !Number.isInteger(remaining) || remaining < 1) return null;
  return { productId, endsAt, remaining };
}
