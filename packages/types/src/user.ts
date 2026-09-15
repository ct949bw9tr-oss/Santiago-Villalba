import { CountryCode, ISODateTime, LocaleTag, UUID } from "./common";

export type AppMode = "customer" | "provider";

export type AuthProvider = "email" | "phone" | "google" | "apple";

export interface User {
  id: UUID;
  phone?: string;
  email?: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  locale: LocaleTag;
  countryCode: CountryCode;
  authProviders: AuthProvider[];
  isProvider: boolean;
  activeMode: AppMode;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  deletedAt?: ISODateTime;
}

export type VerificationState =
  | "unverified"
  | "phone_verified"
  | "identity_pending"
  | "identity_verified"
  | "rejected"
  | "suspended";

export interface ProviderVerification {
  id: UUID;
  providerId: UUID;
  state: VerificationState;
  documentType?: "cedula" | "passport" | "other";
  documentRef?: string;
  reviewedBy?: UUID; // admin_users.id
  reviewedAt?: ISODateTime;
  rejectionReason?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
