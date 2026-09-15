import { ISODateTime, UUID } from "./common";

export interface ReviewRatings {
  overall: number; // 1-5
  quality?: number;
  punctuality?: number;
  communication?: number;
  professionalism?: number;
}

export type ReviewDirection = "customer_to_provider" | "provider_to_customer";

export interface Review {
  id: UUID;
  bookingId: UUID;
  authorId: UUID;
  subjectId: UUID;
  direction: ReviewDirection;
  ratings: ReviewRatings;
  comment?: string;
  createdAt: ISODateTime;
}

export interface Favorite {
  id: UUID;
  customerId: UUID;
  providerId: UUID;
  createdAt: ISODateTime;
}

export interface RecentSearch {
  id: UUID;
  userId: UUID;
  query: string;
  categoryId?: UUID;
  createdAt: ISODateTime;
}

export type MessageType = "text" | "image" | "system";

export interface Message {
  id: UUID;
  bookingId: UUID;
  senderId: UUID | "system";
  type: MessageType;
  body: string; // text content, or image URL when type === "image"
  readAt?: ISODateTime;
  createdAt: ISODateTime;
}

export type NotificationType =
  | "new_request"
  | "request_accepted"
  | "request_declined"
  | "message_received"
  | "booking_reminder"
  | "provider_arriving"
  | "task_completed"
  | "payment_processed"
  | "payout_sent"
  | "review_request"
  | "dispute_update";

export interface Notification {
  id: UUID;
  userId: UUID;
  type: NotificationType;
  title: string;
  body: string;
  bookingId?: UUID;
  readAt?: ISODateTime;
  createdAt: ISODateTime;
}

export type ReportReason =
  | "harassment"
  | "fraud"
  | "unsafe_behavior"
  | "inappropriate_service"
  | "payment_issue"
  | "no_show"
  | "other";

export interface Report {
  id: UUID;
  reporterId: UUID;
  reportedUserId?: UUID;
  bookingId?: UUID;
  reason: ReportReason;
  description: string;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  createdAt: ISODateTime;
  resolvedAt?: ISODateTime;
}

export type DisputeStatus = "open" | "investigating" | "resolved_refund" | "resolved_no_refund" | "closed";

export interface Dispute {
  id: UUID;
  bookingId: UUID;
  raisedBy: UUID;
  reason: string;
  status: DisputeStatus;
  resolutionNotes?: string;
  resolvedBy?: UUID;
  createdAt: ISODateTime;
  resolvedAt?: ISODateTime;
}

export interface PromoCode {
  id: UUID;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  countryCode?: string;
  maxRedemptions?: number;
  redemptionCount: number;
  expiresAt?: ISODateTime;
  isActive: boolean;
  createdAt: ISODateTime;
}
