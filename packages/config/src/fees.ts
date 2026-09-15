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
    customerFeePercent: 8,
    providerCommissionPercent: 0,
    minFeeAmount: 1500,
    maxFeeAmount: 40000,
  },
  {
    countryCode: "EC",
    customerFeePercent: 8,
    providerCommissionPercent: 0,
    minFeeAmount: 1,
  },
  {
    countryCode: "US",
    customerFeePercent: 10,
    providerCommissionPercent: 5,
    minFeeAmount: 2,
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
