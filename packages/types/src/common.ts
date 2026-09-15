export type UUID = string;
export type ISODateTime = string;

/** ISO 4217 currency code, e.g. "COP", "USD" */
export type CurrencyCode = string;

/** BCP-47 locale tag, e.g. "es-CO", "en-US" */
export type LocaleTag = string;

/** ISO 3166-1 alpha-2 country code, e.g. "CO", "EC", "US" */
export type CountryCode = string;

export interface Money {
  /** Integer minor-unit-free amount for zero-decimal currencies like COP; for decimal
   * currencies (USD) this is stored in cents. Always pair with `currency`. */
  amount: number;
  currency: CurrencyCode;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Address {
  id: UUID;
  userId: UUID;
  label: string; // "Casa", "Trabajo", "Universidad"
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  countryCode: CountryCode;
  postalCode?: string;
  location: GeoPoint;
  isDefault: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
