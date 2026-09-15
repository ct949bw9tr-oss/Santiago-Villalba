import { useTaskSwiftStore } from "./store";

export function useCurrentUser() {
  return useTaskSwiftStore((s) => {
    if (!s.currentUserId) return null;
    return s.users.find((u) => u.id === s.currentUserId) ?? null;
  });
}

export function useCurrentProviderProfile() {
  return useTaskSwiftStore((s) => {
    if (!s.currentUserId) return null;
    return s.providerProfiles.find((p) => p.id === s.currentUserId) ?? null;
  });
}

export function useProviderBundle(providerId: string | undefined) {
  return useTaskSwiftStore((s) => {
    if (!providerId) return null;
    const user = s.users.find((u) => u.id === providerId);
    const profile = s.providerProfiles.find((p) => p.id === providerId);
    const service = s.providerServices.find((ps) => ps.providerId === providerId);
    const svc = service ? s.services.find((x) => x.id === service.serviceId) : undefined;
    const area = s.serviceAreas.find((a) => a.providerId === providerId);
    const portfolio = s.portfolioItems.filter((p) => p.providerId === providerId);
    const providerReviews = s.reviews.filter((r) => r.subjectId === providerId && r.direction === "customer_to_provider");
    if (!user || !profile || !service || !svc) return null;
    return { user, profile, service, serviceDefinition: svc, area, portfolio, reviews: providerReviews };
  });
}

export function useIsFavorite(customerId: string | undefined, providerId: string | undefined) {
  return useTaskSwiftStore((s) => !!customerId && !!providerId && s.favorites.some((f) => f.customerId === customerId && f.providerId === providerId));
}

export function useUnreadNotificationCount(userId: string | undefined) {
  return useTaskSwiftStore((s) => (userId ? s.notifications.filter((n) => n.userId === userId && !n.readAt).length : 0));
}
