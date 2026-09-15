import { ISODateTime, UUID } from "./common";

export type AdminRole = "super_admin" | "operations" | "support" | "finance";

export interface AdminUser {
  id: UUID;
  email: string;
  firstName: string;
  lastName: string;
  role: AdminRole;
  createdAt: ISODateTime;
}

export interface AdminDashboardMetrics {
  totalUsers: number;
  activeProviders: number;
  completedServices: number;
  gmv: number; // gross merchandise value, minor-unit-free
  currency: string;
  platformRevenue: number;
  averageOrderValue: number;
  cancellationRate: number; // 0-1
  repeatCustomerRate: number; // 0-1
  activeDisputes: number;
  providerAcceptanceRate: number; // 0-1
  periodStart: ISODateTime;
  periodEnd: ISODateTime;
}
