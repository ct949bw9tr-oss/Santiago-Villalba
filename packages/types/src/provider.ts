import { CountryCode, GeoPoint, ISODateTime, UUID } from "./common";
import { VerificationState } from "./user";

export interface ProviderProfile {
  id: UUID; // == users.id
  headline: string; // "Barbero" / "Maquilladora profesional"
  bio?: string;
  yearsExperience?: number;
  languages: string[];
  verificationState: VerificationState;
  isVerified: boolean;
  ratingAverage: number; // denormalized, 0-5
  ratingCount: number;
  completedJobsCount: number;
  responseTimeMinutes?: number; // denormalized rolling average
  isOnline: boolean;
  acceptsInstantRequests: boolean;
  travelsToCustomer: boolean;
  customerTravelsToProvider: boolean;
  offersRemoteService: boolean;
  countryCode: CountryCode;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ProviderServiceArea {
  id: UUID;
  providerId: UUID;
  center: GeoPoint;
  radiusKm: number;
  city: string;
  createdAt: ISODateTime;
}

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

export interface ProviderAvailabilitySlot {
  id: UUID;
  providerId: UUID;
  dayOfWeek: DayOfWeek;
  startTime: string; // "09:00"
  endTime: string; // "18:00"
  isActive: boolean;
}

export interface ProviderAvailabilityException {
  id: UUID;
  providerId: UUID;
  date: string; // "2026-09-20"
  isAvailable: boolean; // false = blocked day (vacation), true = extra availability
  startTime?: string;
  endTime?: string;
  reason?: string;
}

export type PortfolioMediaType = "image" | "video";

export interface PortfolioItem {
  id: UUID;
  providerId: UUID;
  categoryId?: UUID;
  mediaType: PortfolioMediaType;
  mediaUrl: string;
  beforeMediaUrl?: string; // for before/after pairs
  caption?: string;
  sortOrder: number;
  createdAt: ISODateTime;
}
