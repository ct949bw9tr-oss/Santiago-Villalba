import { haversineDistanceKm } from "@taskswift/business-logic";
import { Booking, GeoPoint, ProviderProfile, ProviderService, User } from "@taskswift/types";
import { useTaskSwiftStore } from "./store";

export interface ProviderSearchResult {
  user: User;
  profile: ProviderProfile;
  service: ProviderService;
  serviceName: string;
  categorySlug: string;
  distanceKm: number | null;
  location: GeoPoint | null;
}

export interface ProviderSearchFilters {
  query?: string;
  categorySlug?: string;
  availableNow?: boolean;
  verifiedOnly?: boolean;
  near?: GeoPoint;
  sort?: "recommended" | "closest" | "rating" | "price";
}

export function searchProviders(filters: ProviderSearchFilters): ProviderSearchResult[] {
  const state = useTaskSwiftStore.getState();
  const q = filters.query?.trim().toLowerCase();

  let results: ProviderSearchResult[] = state.providerServices
    .map((service) => {
      const profile = state.providerProfiles.find((p) => p.id === service.providerId);
      const user = state.users.find((u) => u.id === service.providerId);
      const svc = state.services.find((s) => s.id === service.serviceId);
      const subcategory = state.subcategories.find((sc) => sc.id === svc?.subcategoryId);
      const category = state.categories.find((c) => c.id === subcategory?.categoryId);
      if (!profile || !user || !svc || !category) return null;
      const area = state.serviceAreas.find((a) => a.providerId === service.providerId);
      const distanceKm = filters.near && area ? haversineDistanceKm(filters.near, area.center) : null;
      return {
        user,
        profile,
        service,
        serviceName: svc.name,
        categorySlug: category.slug,
        distanceKm,
        location: area?.center ?? null,
      } satisfies ProviderSearchResult;
    })
    .filter((r): r is ProviderSearchResult => r !== null);

  if (filters.categorySlug) {
    results = results.filter((r) => r.categorySlug === filters.categorySlug);
  }
  if (filters.availableNow) {
    results = results.filter((r) => r.profile.isOnline);
  }
  if (filters.verifiedOnly) {
    results = results.filter((r) => r.profile.isVerified);
  }
  if (q) {
    results = results.filter(
      (r) =>
        r.user.firstName.toLowerCase().includes(q) ||
        r.profile.headline.toLowerCase().includes(q) ||
        r.serviceName.toLowerCase().includes(q) ||
        r.categorySlug.includes(q)
    );
  }

  switch (filters.sort) {
    case "closest":
      results.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
      break;
    case "rating":
      results.sort((a, b) => b.profile.ratingAverage - a.profile.ratingAverage);
      break;
    case "price":
      results.sort((a, b) => (a.service.price ?? Infinity) - (b.service.price ?? Infinity));
      break;
    default:
      results.sort((a, b) => b.profile.ratingAverage * b.profile.ratingCount - a.profile.ratingAverage * a.profile.ratingCount);
  }

  return results;
}

export function getBookingsForUser(userId: string, mode: "customer" | "provider"): Booking[] {
  const state = useTaskSwiftStore.getState();
  return state.bookings
    .filter((b) => (mode === "customer" ? b.customerId === userId : b.providerId === userId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export interface EarningsSummary {
  today: number;
  thisWeek: number;
  thisMonth: number;
  totalJobs: number;
  averageJobValue: number;
  currency: string;
}

export function getEarningsSummary(providerId: string): EarningsSummary {
  const state = useTaskSwiftStore.getState();
  const completed = state.bookings.filter((b) => b.providerId === providerId && b.status === "completed");
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - startOfDay.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const sumSince = (since: Date) =>
    completed.filter((b) => new Date(b.completedByCustomerAt ?? b.createdAt) >= since).reduce((sum, b) => sum + b.priceBreakdown.providerPayout, 0);

  const total = completed.reduce((sum, b) => sum + b.priceBreakdown.providerPayout, 0);

  return {
    today: sumSince(startOfDay),
    thisWeek: sumSince(startOfWeek),
    thisMonth: sumSince(startOfMonth),
    totalJobs: completed.length,
    averageJobValue: completed.length > 0 ? Math.round(total / completed.length) : 0,
    currency: "COP",
  };
}
