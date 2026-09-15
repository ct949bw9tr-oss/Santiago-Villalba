import { describe, expect, it } from "vitest";
import { haversineDistanceKm, isWithinServiceArea } from "./distance";

describe("haversineDistanceKm", () => {
  it("returns ~0 for the same point", () => {
    expect(haversineDistanceKm({ lat: 4.711, lng: -74.0721 }, { lat: 4.711, lng: -74.0721 })).toBeCloseTo(0, 3);
  });

  it("computes a realistic distance between two Bogotá points", () => {
    // Chapinero to Usaquén, roughly 6-8km apart
    const distance = haversineDistanceKm({ lat: 4.6486, lng: -74.0628 }, { lat: 4.6947, lng: -74.0303 });
    expect(distance).toBeGreaterThan(4);
    expect(distance).toBeLessThan(10);
  });
});

describe("isWithinServiceArea", () => {
  it("returns true when the customer is within the provider's radius", () => {
    const providerCenter = { lat: 4.6486, lng: -74.0628 };
    const customer = { lat: 4.65, lng: -74.063 };
    expect(isWithinServiceArea(customer, providerCenter, 5)).toBe(true);
  });

  it("returns false when the customer is outside the provider's radius", () => {
    const providerCenter = { lat: 4.6486, lng: -74.0628 };
    const farCustomer = { lat: 4.9, lng: -74.3 };
    expect(isWithinServiceArea(farCustomer, providerCenter, 5)).toBe(false);
  });
});
