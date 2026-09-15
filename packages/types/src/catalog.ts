import { ISODateTime, UUID } from "./common";

export interface Category {
  id: UUID;
  slug: string;
  name: string; // es-CO display name
  nameEn: string;
  icon: string; // icon name for the UI layer
  sortOrder: number;
  isActive: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Subcategory {
  id: UUID;
  categoryId: UUID;
  slug: string;
  name: string;
  nameEn: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** A sellable service definition within a subcategory, e.g. "Corte de cabello". */
export interface Service {
  id: UUID;
  subcategoryId: UUID;
  slug: string;
  name: string;
  nameEn: string;
  description?: string;
  defaultDurationMinutes?: number;
  isActive: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type PricingModel = "fixed" | "starting_at" | "hourly" | "custom_quote";

/** A provider's offering of a given service, with their own pricing. */
export interface ProviderService {
  id: UUID;
  providerId: UUID;
  serviceId: UUID;
  pricingModel: PricingModel;
  /** Minor-unit-free amount in the provider's operating currency; null for custom_quote. */
  price: number | null;
  currency: string;
  estimatedDurationMinutes?: number;
  isActive: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
