/**
 * Default marketplace fee configuration. This mirrors the `platform_fees` DB
 * table and is used as a fallback / seed — admins can override per country and
 * per category at runtime without an app release. See packages/business-logic
 * for the calculation itself.
 */
export interface DefaultFeeRule {
  countryCode: string;
  categorySlug?: string; // undefined = applies to all categories
  customerFeePercent: number;
  providerCommissionPercent: number;
  minFeeAmount: number;
  maxFeeAmount?: number;
}

export const DEFAULT_FEE_RULES: DefaultFeeRule[] = [
  {
    countryCode: "CO",
    customerFeePercent: 0,
    providerCommissionPercent: 8,
    minFeeAmount: 0,
  },
  {
    countryCode: "EC",
    customerFeePercent: 0,
    providerCommissionPercent: 8,
    minFeeAmount: 0,
  },
  {
    countryCode: "US",
    customerFeePercent: 0,
    providerCommissionPercent: 8,
    minFeeAmount: 0,
  },
];

export function findFeeRule(countryCode: string, categorySlug?: string): DefaultFeeRule {
  const categoryMatch = categorySlug
    ? DEFAULT_FEE_RULES.find((r) => r.countryCode === countryCode && r.categorySlug === categorySlug)
    : undefined;
  const countryMatch = DEFAULT_FEE_RULES.find((r) => r.countryCode === countryCode && !r.categorySlug);
  const rule = categoryMatch ?? countryMatch;
  if (!rule) {
    throw new Error(`No fee rule configured for country ${countryCode}`);
  }
  return rule;
}
