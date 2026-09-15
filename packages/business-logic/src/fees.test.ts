import { describe, expect, it } from "vitest";
import { calculatePriceBreakdown } from "./fees";

describe("calculatePriceBreakdown", () => {
  it("charges the Colombian 8% customer fee on a standard haircut price", () => {
    const result = calculatePriceBreakdown({ servicePrice: 35000, currency: "COP", countryCode: "CO" });
    expect(result.customerFee).toBe(2800); // 8% of 35000
    expect(result.total).toBe(37800);
    expect(result.providerPayout).toBe(35000); // 0% provider commission in CO by default
  });

  it("clamps the customer fee to the configured minimum", () => {
    const result = calculatePriceBreakdown({ servicePrice: 5000, currency: "COP", countryCode: "CO" });
    // 8% of 5000 = 400, below the 1500 minimum
    expect(result.customerFee).toBe(1500);
    expect(result.total).toBe(6500);
  });

  it("clamps the customer fee to the configured maximum", () => {
    const result = calculatePriceBreakdown({ servicePrice: 1000000, currency: "COP", countryCode: "CO" });
    // 8% of 1,000,000 = 80,000, above the 40,000 maximum
    expect(result.customerFee).toBe(40000);
    expect(result.total).toBe(1040000);
  });

  it("applies provider commission where configured (US)", () => {
    const result = calculatePriceBreakdown({ servicePrice: 100, currency: "USD", countryCode: "US" });
    expect(result.providerCommission).toBe(5); // 5%
    expect(result.providerPayout).toBe(95);
    expect(result.customerFee).toBe(10); // 10%
  });

  it("throws for a negative service price", () => {
    expect(() => calculatePriceBreakdown({ servicePrice: -1, currency: "COP", countryCode: "CO" })).toThrow();
  });

  it("throws for an unsupported country", () => {
    expect(() => calculatePriceBreakdown({ servicePrice: 1000, currency: "COP", countryCode: "ZZ" })).toThrow();
  });
});
