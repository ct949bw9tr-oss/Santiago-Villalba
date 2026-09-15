import { CountryConfig } from "@taskswift/types";

/**
 * Country configuration is the seam that lets TaskSwift expand beyond Colombia
 * without app rebuilds: currency, locale, payment providers, and legal docs are
 * all keyed off `countryCode` and read at runtime (mirrors the `countries` DB table).
 */
export const COUNTRIES: Record<string, CountryConfig> = {
  CO: {
    countryCode: "CO",
    name: "Colombia",
    currency: "COP",
    defaultLocale: "es-CO",
    supportedLocales: ["es-CO", "en-US"],
    isLive: true,
    cities: ["Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena"],
    paymentProviders: [
      { provider: "wompi", enabled: true, supportsCards: true, supportsBankTransfer: true, supportsCash: false, publicKeyEnvVar: "WOMPI_PUBLIC_KEY" },
      { provider: "mercadopago", enabled: false, supportsCards: true, supportsBankTransfer: true, supportsCash: false, publicKeyEnvVar: "MERCADOPAGO_PUBLIC_KEY" },
      { provider: "mock", enabled: true, supportsCards: true, supportsBankTransfer: true, supportsCash: true },
    ],
    legal: {
      requiresTaxId: false,
      requiresInsurance: false,
    },
  },
  EC: {
    countryCode: "EC",
    name: "Ecuador",
    currency: "USD",
    defaultLocale: "es-EC",
    supportedLocales: ["es-EC"],
    isLive: false,
    cities: ["Quito", "Guayaquil", "Cuenca"],
    paymentProviders: [
      { provider: "payu", enabled: false, supportsCards: true, supportsBankTransfer: false, supportsCash: false },
      { provider: "mock", enabled: true, supportsCards: true, supportsBankTransfer: false, supportsCash: true },
    ],
    legal: {
      requiresTaxId: false,
      requiresInsurance: false,
    },
  },
  US: {
    countryCode: "US",
    name: "United States",
    currency: "USD",
    defaultLocale: "en-US",
    supportedLocales: ["en-US", "es-US"],
    isLive: false,
    cities: ["Miami", "New York", "Los Angeles"],
    paymentProviders: [
      { provider: "stripe", enabled: false, supportsCards: true, supportsBankTransfer: true, supportsCash: false, publicKeyEnvVar: "STRIPE_PUBLIC_KEY" },
      { provider: "mock", enabled: true, supportsCards: true, supportsBankTransfer: false, supportsCash: false },
    ],
    legal: {
      requiresTaxId: true,
      requiresInsurance: true,
    },
  },
};

export const DEFAULT_COUNTRY_CODE = "CO";

export function getCountryConfig(countryCode: string): CountryConfig {
  const config = COUNTRIES[countryCode];
  if (!config) {
    throw new Error(`Unsupported country code: ${countryCode}`);
  }
  return config;
}
