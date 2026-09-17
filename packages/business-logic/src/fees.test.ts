import { describe, expect, it } from "vitest";
import { calculatePriceBreakdown } from "./fees";

describe("calculatePriceBreakdown", () => {
  it("charges no customer fee and takes an 8% provider commission on a standard haircut price", () => {
    const result = calculatePriceBreakdown({ servicePrice: 35000, currency: "COP", countryCode: "CO" });
    expect(result.customerFee).toBe(0);
    expect(result.total).toBe(35000); // customer pays exactly the service price
    expect(result.providerCommission).toBe(2800); // 8% of 35000
    expect(result.providerPayout).toBe(32200);
  });

  it("applies the same 8% provider commission in every configured country", () => {
    for (const countryCode of ["CO", "EC", "US"]) {
      const result = calculatePriceBreakdown({ servicePrice: 100, currency: "USD", countryCode });
      expect(result.customerFee).toBe(0);
      expect(result.total).toBe(100);
      expect(result.providerCommission).toBe(8);
      expect(result.providerPayout).toBe(92);
    }
  });

  it("throws for a negative service price", () => {
    expect(() => calculatePriceBreakdown({ servicePrice: -1, currency: "COP", countryCode: "CO" })).toThrow();
  });

  it("throws for an unsupported country", () => {
    expect(() => calculatePriceBreakdown({ servicePrice: 1000, currency: "COP", countryCode: "ZZ" })).toThrow();
  });
});
