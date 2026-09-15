import { CurrencyCode, ISODateTime, UUID } from "./common";

export type PaymentMethodType = "card" | "pse" | "cash" | "apple_pay" | "google_pay" | "mock";

export interface PaymentMethod {
  id: UUID;
  userId: UUID;
  type: PaymentMethodType;
  provider: "wompi" | "mercadopago" | "payu" | "stripe" | "mock";
  /** Opaque token from the payment provider; TaskSwift never stores raw card data. */
  providerToken: string;
  last4?: string;
  brand?: string;
  isDefault: boolean;
  createdAt: ISODateTime;
}

export type PaymentStatus =
  | "pending"
  | "authorized"
  | "paid"
  | "held"
  | "completed"
  | "refunded"
  | "partially_refunded"
  | "failed"
  | "disputed";

export interface Payment {
  id: UUID;
  bookingId: UUID;
  customerId: UUID;
  paymentMethodId: UUID;
  status: PaymentStatus;
  amount: number;
  currency: CurrencyCode;
  providerReference?: string; // gateway transaction id
  authorizedAt?: ISODateTime;
  capturedAt?: ISODateTime;
  refundedAt?: ISODateTime;
  failureReason?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type TransactionType =
  | "charge"
  | "platform_fee"
  | "provider_payout"
  | "refund"
  | "adjustment";

export interface Transaction {
  id: UUID;
  bookingId: UUID;
  paymentId: UUID;
  type: TransactionType;
  amount: number;
  currency: CurrencyCode;
  relatedUserId: UUID; // customer or provider this transaction line belongs to
  createdAt: ISODateTime;
}

export type PayoutStatus = "pending" | "in_transit" | "paid" | "failed";

export interface Payout {
  id: UUID;
  providerId: UUID;
  amount: number;
  currency: CurrencyCode;
  status: PayoutStatus;
  bookingIds: UUID[];
  scheduledFor: ISODateTime;
  paidAt?: ISODateTime;
  failureReason?: string;
  createdAt: ISODateTime;
}

export interface PlatformFeeConfig {
  id: UUID;
  countryCode: string;
  categoryId?: UUID; // null = applies to all categories in the country
  customerFeePercent: number; // e.g. 8 for 8%
  providerCommissionPercent: number;
  minFeeAmount: number;
  maxFeeAmount?: number;
  isActive: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
