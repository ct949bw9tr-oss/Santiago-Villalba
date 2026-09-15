import { CountryCode, CurrencyCode, LocaleTag } from "./common";

export interface PaymentProviderConfig {
  provider: "wompi" | "mercadopago" | "payu" | "stripe" | "mock";
  enabled: boolean;
  supportsCards: boolean;
  supportsBankTransfer: boolean;
  supportsCash: boolean;
  /** Public key only; secrets live server-side in env vars, never in this record. */
  publicKeyEnvVar?: string;
}

export interface CountryConfig {
  countryCode: CountryCode;
  name: string;
  currency: CurrencyCode;
  defaultLocale: LocaleTag;
  supportedLocales: LocaleTag[];
  paymentProviders: PaymentProviderConfig[];
  isLive: boolean;
  cities: string[];
  legal: {
    termsUrl?: string;
    providerAgreementUrl?: string;
    privacyUrl?: string;
    requiresTaxId: boolean;
    requiresInsurance: boolean;
  };
}
