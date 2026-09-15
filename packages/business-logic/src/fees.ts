import { PriceBreakdown } from "@taskswift/types";
import { findFeeRule } from "@taskswift/config";

export interface FeeCalculationInput {
  servicePrice: number;
  currency: string;
  countryCode: string;
  categorySlug?: string;
}

/**
 * Computes the full customer/provider price breakdown for a service request.
 * Fee percentages and min/max clamps come from the (admin-configurable)
 * platform_fees table via findFeeRule — never hard-code a percentage here.
 */
export function calculatePriceBreakdown(input: FeeCalculationInput): PriceBreakdown {
  if (input.servicePrice < 0) {
    throw new Error("servicePrice must be >= 0");
  }

  const rule = findFeeRule(input.countryCode, input.categorySlug);

  let customerFee = round(input.servicePrice * (rule.customerFeePercent / 100));
  customerFee = Math.max(customerFee, rule.minFeeAmount);
  if (rule.maxFeeAmount !== undefined) {
    customerFee = Math.min(customerFee, rule.maxFeeAmount);
  }

  const providerCommission = round(input.servicePrice * (rule.providerCommissionPercent / 100));
  const providerPayout = input.servicePrice - providerCommission;
  const total = input.servicePrice + customerFee;

  return {
    servicePrice: input.servicePrice,
    customerFee,
    total,
    currency: input.currency,
    providerCommission,
    providerPayout,
  };
}

function round(n: number): number {
  return Math.round(n);
}
