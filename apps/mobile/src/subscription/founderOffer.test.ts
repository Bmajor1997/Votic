import { describe, expect, it } from "vitest";
import { entitlement_from_customer_info, has_access } from "./entitlement";
import { founder_availability, founder_offer_from } from "./founderText";

const lifetime = {
  entitlements: {
    active: {
      premium: {
        isActive: true,
        willRenew: false,
        periodType: "NORMAL",
        expirationDateMillis: null,
        billingIssueDetectedAt: null,
        productIdentifier: "votic_founder_lifetime",
      },
    },
    all: {},
  },
  managementURL: null,
};

describe("founder lifetime", () => {
  it("is lifetime access, not a cancelled subscription", () => {
    const entitlement = entitlement_from_customer_info(lifetime, "premium");
    expect(entitlement.status).toBe("lifetime");
    expect(has_access(entitlement.status)).toBe(true);
  });

  it("only trusts a well-formed offer from the server", () => {
    const offer = { productId: "votic_founder_lifetime", endsAt: "2027-01-31T00:00:00.000Z", remaining: 40 };
    expect(founder_offer_from(offer)).toEqual(offer);
    expect(founder_offer_from(undefined)).toBeNull();
    expect(founder_offer_from({ ...offer, remaining: 0 })).toBeNull();
    expect(founder_offer_from({ ...offer, endsAt: "soon" })).toBeNull();
    expect(founder_offer_from({ ...offer, productId: "" })).toBeNull();
  });

  it("says when it ends, and how many spots are left once few remain", () => {
    const endsAt = new Date(2027, 0, 31, 12).toISOString();
    expect(founder_availability({ productId: "x", endsAt, remaining: 80 })).toMatch(
      /^Ends .* · Limited founder spots$/,
    );
    expect(founder_availability({ productId: "x", endsAt, remaining: 12 })).toMatch(
      /· 12 founder spots left$/,
    );
    expect(founder_availability({ productId: "x", endsAt, remaining: 1 })).toMatch(/· 1 founder spot left$/);
  });
});
