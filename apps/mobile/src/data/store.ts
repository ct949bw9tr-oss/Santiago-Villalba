import { create } from "zustand";
import {
  applyBookingTransition,
  calculateCancellationOutcome,
  calculatePriceBreakdown,
  checkReviewEligibility,
} from "@taskswift/business-logic";
import {
  Address,
  AppMode,
  Booking,
  Category,
  Favorite,
  Message,
  Notification,
  PortfolioItem,
  ProviderAvailabilitySlot,
  ProviderProfile,
  ProviderService,
  ProviderServiceArea,
  Review,
  ReviewRatings,
  Service,
  Subcategory,
  User,
} from "@taskswift/types";
import { PricingModel } from "@taskswift/types";
import { CITY_COORDS, jitter } from "@taskswift/seed-data";
import { claimDemoUser, registerByPhone } from "../lib/auth";
import * as remote from "./remote";

export type { AppMode };

interface CreateBookingInput {
  customerId: string;
  providerId: string;
  providerServiceId: string;
  timing: "scheduled" | "now";
  scheduledFor?: string;
  addressId: string;
  notes?: string;
}

interface TaskSwiftState {
  currentUserId: string | null;
  activeMode: AppMode;
  isPublicDataReady: boolean;

  categories: Category[];
  subcategories: Subcategory[];
  services: Service[];
  users: User[];
  providerProfiles: ProviderProfile[];
  providerServices: ProviderService[];
  serviceAreas: ProviderServiceArea[];
  availabilitySlots: ProviderAvailabilitySlot[];
  portfolioItems: PortfolioItem[];
  addresses: Address[];

  bookings: Booking[];
  reviews: Review[];
  messages: Message[];
  notifications: Notification[];
  favorites: Favorite[];

  hydratePublic: () => Promise<void>;
  hydratePrivate: (userId: string) => Promise<void>;

  login: (userId: string) => Promise<void>;
  loginOrRegisterByPhone: (phone: string) => Promise<string>;
  logout: () => void;
  switchMode: (mode: AppMode) => void;
  becomeProvider: (input: {
    userId: string;
    headline: string;
    bio?: string;
    serviceId: string;
    pricingModel: PricingModel;
    price: number | null;
    city: string;
  }) => Promise<void>;
  addProviderService: (input: {
    providerId: string;
    serviceId: string;
    pricingModel: PricingModel;
    price: number | null;
  }) => Promise<void>;
  updateProviderService: (id: string, update: { pricingModel?: PricingModel; price?: number | null; isActive?: boolean }) => Promise<void>;
  toggleOnline: (providerId: string) => Promise<void>;
  toggleAvailabilityDay: (providerId: string, dayOfWeek: number) => Promise<void>;
  addAddress: (input: Omit<Address, "id" | "createdAt" | "updatedAt">) => Promise<Address>;

  createBooking: (input: CreateBookingInput) => Promise<Booking>;
  respondToRequest: (bookingId: string, action: "accept" | "decline") => Promise<void>;
  markEnRoute: (bookingId: string) => Promise<void>;
  startService: (bookingId: string) => Promise<void>;
  markProviderComplete: (bookingId: string) => Promise<void>;
  confirmCompletion: (bookingId: string) => Promise<void>;
  cancelBooking: (bookingId: string, actor: "customer" | "provider", reason?: string) => Promise<void>;

  sendMessage: (bookingId: string, senderId: string | "system", body: string) => Promise<void>;
  markMessagesRead: (bookingId: string, readerId: string) => Promise<void>;

  submitReview: (
    bookingId: string,
    authorId: string,
    ratings: ReviewRatings,
    comment?: string
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  toggleFavorite: (customerId: string, providerId: string) => Promise<void>;
  markNotificationsRead: (userId: string) => Promise<void>;
}

export const useTaskSwiftStore = create<TaskSwiftState>((set, get) => ({
  currentUserId: null,
  activeMode: "customer",
  isPublicDataReady: false,

  categories: [],
  subcategories: [],
  services: [],
  users: [],
  providerProfiles: [],
  providerServices: [],
  serviceAreas: [],
  availabilitySlots: [],
  portfolioItems: [],
  addresses: [],

  bookings: [],
  reviews: [],
  messages: [],
  notifications: [],
  favorites: [],

  hydratePublic: async () => {
    const [catalog, directory, portfolioItems, availabilitySlots, reviews] = await Promise.all([
      remote.fetchCatalog(),
      remote.fetchProviderDirectory(),
      remote.fetchPortfolioItems(),
      remote.fetchAvailabilitySlots(),
      remote.fetchAllReviews(),
    ]);
    set({
      categories: catalog.categories,
      subcategories: catalog.subcategories,
      services: catalog.services,
      users: directory.users,
      providerProfiles: directory.providerProfiles,
      providerServices: directory.providerServices,
      serviceAreas: directory.serviceAreas,
      portfolioItems,
      availabilitySlots,
      reviews,
      isPublicDataReady: true,
    });
  },

  hydratePrivate: async (userId) => {
    const [me, addresses, favorites, notifications, bookings, messages] = await Promise.all([
      remote.fetchOwnUser(userId),
      remote.fetchAddresses(userId),
      remote.fetchFavorites(userId),
      remote.fetchNotifications(userId),
      remote.fetchBookings(),
      remote.fetchMessages(),
    ]);

    const state = get();
    const known = new Set(state.users.map((u) => u.id));
    const missing = new Set<string>();
    for (const b of bookings) {
      if (!known.has(b.customerId)) missing.add(b.customerId);
      if (!known.has(b.providerId)) missing.add(b.providerId);
    }
    missing.delete(me.id);
    const extraUsers = missing.size > 0 ? await remote.fetchUserPublicNames([...missing]) : [];

    set((s) => ({
      users: [...s.users.filter((u) => u.id !== me.id), me, ...extraUsers.filter((u) => !s.users.some((su) => su.id === u.id))],
      addresses,
      favorites,
      notifications,
      bookings,
      messages,
    }));
  },

  login: async (userId) => {
    await claimDemoUser(userId);
    await get().hydratePrivate(userId);
    const user = get().users.find((u) => u.id === userId);
    set({ currentUserId: userId, activeMode: user?.isProvider ? user.activeMode : "customer" });
  },

  loginOrRegisterByPhone: async (rawPhone) => {
    const digits = rawPhone.replace(/\D/g, "").slice(-10);
    // Demo mode: phone OTP is not a real SMS provider, so this always creates a fresh
    // account for the number rather than looking one up (users' own rows are the only
    // ones a client is allowed to read, so "does this phone already exist" can't be
    // checked from here).
    const row = await registerByPhone({ phone: `+57${digits}`, firstName: "Nuevo", lastName: "Usuario", countryCode: "CO" });
    await get().hydratePrivate(row.id);
    set({ currentUserId: row.id, activeMode: "customer" });
    return row.id;
  },

  logout: () => set({ currentUserId: null }),
  switchMode: (mode) => set({ activeMode: mode }),

  becomeProvider: async (input) => {
    const center = jitter(CITY_COORDS[input.city] ?? CITY_COORDS["Bogotá"]!, `area:runtime:${input.userId}`);
    const { profile, service } = await remote.becomeProviderRemote({
      userId: input.userId,
      headline: input.headline,
      bio: input.bio,
      serviceId: input.serviceId,
      pricingModel: input.pricingModel,
      price: input.price,
      currency: "COP",
      city: input.city,
      center,
    });
    const now = new Date().toISOString();
    const serviceArea: ProviderServiceArea = {
      id: `area:${input.userId}`,
      providerId: input.userId,
      center,
      radiusKm: 8,
      city: input.city,
      createdAt: now,
    };
    const newSlots: ProviderAvailabilitySlot[] = Array.from({ length: 6 }, (_, i) => ({
      id: `slot:${input.userId}:${i + 1}`,
      providerId: input.userId,
      dayOfWeek: (i + 1) as ProviderAvailabilitySlot["dayOfWeek"],
      startTime: "09:00",
      endTime: "18:00",
      isActive: true,
    }));

    set((state) => ({
      users: state.users.map((u) => (u.id === input.userId ? { ...u, isProvider: true, activeMode: "provider" } : u)),
      providerProfiles: [...state.providerProfiles, profile],
      providerServices: [...state.providerServices, service],
      serviceAreas: [...state.serviceAreas, serviceArea],
      availabilitySlots: [...state.availabilitySlots, ...newSlots],
      activeMode: "provider",
    }));
  },

  addProviderService: async (input) => {
    const currency = get().providerServices.find((s) => s.providerId === input.providerId)?.currency ?? "COP";
    const service = await remote.addProviderServiceRemote({
      providerId: input.providerId,
      serviceId: input.serviceId,
      pricingModel: input.pricingModel,
      price: input.price,
      currency,
    });
    set((state) => ({ providerServices: [...state.providerServices, service] }));
  },

  updateProviderService: async (id, update) => {
    const service = await remote.updateProviderServiceRemote(id, update);
    set((state) => ({ providerServices: state.providerServices.map((s) => (s.id === id ? service : s)) }));
  },

  toggleOnline: async (providerId) => {
    const profile = get().providerProfiles.find((p) => p.id === providerId);
    if (!profile) return;
    const next = !profile.isOnline;
    await remote.toggleOnlineRemote(providerId, next);
    set((state) => ({
      providerProfiles: state.providerProfiles.map((p) => (p.id === providerId ? { ...p, isOnline: next } : p)),
    }));
  },

  toggleAvailabilityDay: async (providerId, dayOfWeek) => {
    const slot = get().availabilitySlots.find((s) => s.providerId === providerId && s.dayOfWeek === dayOfWeek);
    const next = !(slot?.isActive ?? false);
    await remote.toggleAvailabilityDayRemote(providerId, dayOfWeek, next);
    set((state) => ({
      availabilitySlots: state.availabilitySlots.map((slot) =>
        slot.providerId === providerId && slot.dayOfWeek === dayOfWeek ? { ...slot, isActive: next } : slot
      ),
    }));
  },

  addAddress: async (input) => {
    const address = await remote.insertAddress(input);
    set((state) => ({ addresses: [...state.addresses, address] }));
    return address;
  },

  createBooking: async (input) => {
    const state = get();
    const ps = state.providerServices.find((s) => s.id === input.providerServiceId);
    if (!ps) throw new Error("Unknown provider service");
    const address = state.addresses.find((a) => a.id === input.addressId);
    if (!address) throw new Error("Unknown address");
    const svc = state.services.find((s) => s.id === ps.serviceId);
    const subcategory = state.subcategories.find((sc) => sc.id === svc?.subcategoryId);
    const categoryId = subcategory?.categoryId ?? state.categories[0]!.id;

    const servicePrice = ps.price ?? 0;
    const priceBreakdown = calculatePriceBreakdown({ servicePrice, currency: ps.currency, countryCode: "CO" });

    const booking = await remote.createBookingRemote({
      customerId: input.customerId,
      providerId: input.providerId,
      providerServiceId: ps.id,
      categoryId,
      timing: input.timing,
      scheduledFor: input.scheduledFor,
      address,
      notes: input.notes,
      pricingModel: ps.pricingModel,
      estimatedDurationMinutes: ps.estimatedDurationMinutes ?? svc?.defaultDurationMinutes,
      priceBreakdown,
      countryCode: "CO",
    });

    set((s) => ({ bookings: [booking, ...s.bookings] }));
    return booking;
  },

  respondToRequest: async (bookingId, action) => {
    const booking = get().bookings.find((b) => b.id === bookingId);
    if (!booking) return;
    const updated: Booking = { ...booking };
    if (updated.status === "requested") {
      updated.status = applyBookingTransition(updated.status, "pending_provider", "provider");
    }
    const now = new Date().toISOString();
    updated.updatedAt = now;
    if (action === "accept") {
      updated.status = applyBookingTransition(updated.status, "accepted", "provider");
      updated.acceptedAt = now;
      await remote.updateBookingRemote(bookingId, { status: updated.status, acceptedAt: now });
    } else {
      updated.status = applyBookingTransition(updated.status, "cancelled_provider", "provider");
      updated.cancelledAt = now;
      updated.cancelledBy = updated.providerId;
      await remote.updateBookingRemote(bookingId, { status: updated.status, cancelledAt: now, cancelledBy: updated.providerId });
    }
    await remote.insertNotificationRemote({
      userId: updated.customerId,
      type: action === "accept" ? "request_accepted" : "request_declined",
      title: action === "accept" ? "Solicitud aceptada" : "Solicitud rechazada",
      body: action === "accept" ? "El proveedor aceptó tu solicitud." : "El proveedor no pudo aceptar tu solicitud.",
      bookingId,
    });
    set((s) => ({ bookings: s.bookings.map((b) => (b.id === bookingId ? updated : b)) }));
  },

  markEnRoute: async (bookingId) => {
    const booking = get().bookings.find((b) => b.id === bookingId);
    if (!booking) return;
    const now = new Date().toISOString();
    const updated: Booking = { ...booking, enRouteAt: now, updatedAt: now };
    updated.status = applyBookingTransition(updated.status, "provider_en_route", "provider");
    await remote.updateBookingRemote(bookingId, { status: updated.status, enRouteAt: now });
    await remote.insertNotificationRemote({
      userId: updated.customerId,
      type: "provider_arriving",
      title: "El proveedor está en camino",
      body: "Tu proveedor va en camino a tu ubicación.",
      bookingId,
    });
    set((s) => ({ bookings: s.bookings.map((b) => (b.id === bookingId ? updated : b)) }));
  },

  startService: async (bookingId) => {
    const booking = get().bookings.find((b) => b.id === bookingId);
    if (!booking) return;
    const now = new Date().toISOString();
    const updated: Booking = { ...booking, startedAt: now, updatedAt: now };
    updated.status = applyBookingTransition(updated.status, "in_progress", "provider");
    await remote.updateBookingRemote(bookingId, { status: updated.status, startedAt: now });
    set((s) => ({ bookings: s.bookings.map((b) => (b.id === bookingId ? updated : b)) }));
  },

  markProviderComplete: async (bookingId) => {
    const booking = get().bookings.find((b) => b.id === bookingId);
    if (!booking) return;
    const now = new Date().toISOString();
    const updated: Booking = { ...booking, completedByProviderAt: now, updatedAt: now };
    updated.status = applyBookingTransition(updated.status, "awaiting_completion_confirmation", "provider");
    await remote.updateBookingRemote(bookingId, { status: updated.status, completedByProviderAt: now });
    await remote.insertNotificationRemote({
      userId: updated.customerId,
      type: "task_completed",
      title: "Servicio completado",
      body: "El proveedor marcó el servicio como completado. Confírmalo para finalizar.",
      bookingId,
    });
    set((s) => ({ bookings: s.bookings.map((b) => (b.id === bookingId ? updated : b)) }));
  },

  confirmCompletion: async (bookingId) => {
    const booking = get().bookings.find((b) => b.id === bookingId);
    if (!booking) return;
    const now = new Date().toISOString();
    const updated: Booking = { ...booking, completedByCustomerAt: now, updatedAt: now };
    updated.status = applyBookingTransition(updated.status, "completed", "customer");
    await remote.updateBookingRemote(bookingId, { status: updated.status, completedByCustomerAt: now });
    await remote.insertNotificationRemote({
      userId: updated.customerId,
      type: "payment_processed",
      title: "Pago procesado",
      body: "Tu pago de la orden fue procesado con éxito.",
      bookingId,
    });
    await remote.insertNotificationRemote({
      userId: updated.providerId,
      type: "payout_sent",
      title: "Ganancia disponible",
      body: "Recibiste el pago por un servicio completado.",
      bookingId,
    });
    const providerProfile = await remote.fetchProviderProfile(updated.providerId).catch(() => null);
    set((s) => ({
      bookings: s.bookings.map((b) => (b.id === bookingId ? updated : b)),
      providerProfiles: providerProfile
        ? s.providerProfiles.map((p) => (p.id === providerProfile.id ? providerProfile : p))
        : s.providerProfiles,
    }));
  },

  cancelBooking: async (bookingId, actor, reason) => {
    const booking = get().bookings.find((b) => b.id === bookingId);
    if (!booking) return;
    const outcome = calculateCancellationOutcome(booking, actor, new Date());
    const now = new Date().toISOString();
    const cancelledBy = actor === "customer" ? booking.customerId : booking.providerId;
    const cancellationReason = reason ?? (outcome.isLate ? "Cancelación tardía" : "Cancelación dentro de la ventana gratuita");
    const updated: Booking = { ...booking, cancelledAt: now, cancelledBy, cancellationReason, updatedAt: now };
    updated.status = applyBookingTransition(updated.status, actor === "customer" ? "cancelled_customer" : "cancelled_provider", actor);
    await remote.updateBookingRemote(bookingId, { status: updated.status, cancelledAt: now, cancelledBy, cancellationReason });
    set((s) => ({ bookings: s.bookings.map((b) => (b.id === bookingId ? updated : b)) }));
  },

  sendMessage: async (bookingId, senderId, body) => {
    const message = await remote.insertMessageRemote(bookingId, senderId, body);
    set((s) => ({ messages: [...s.messages, message] }));
  },

  markMessagesRead: async (bookingId, readerId) => {
    await remote.markMessagesReadRemote(bookingId, readerId);
    set((state) => ({
      messages: state.messages.map((m) =>
        m.bookingId === bookingId && m.senderId !== readerId && !m.readAt ? { ...m, readAt: new Date().toISOString() } : m
      ),
    }));
  },

  submitReview: async (bookingId, authorId, ratings, comment) => {
    const state = get();
    const booking = state.bookings.find((b) => b.id === bookingId);
    if (!booking) return { ok: false, reason: "Booking not found" };
    const eligibility = checkReviewEligibility({ booking, authorId, existingReviews: state.reviews });
    if (!eligibility.eligible) return { ok: false, reason: eligibility.reason };

    const review = await remote.insertReviewRemote({
      bookingId,
      authorId,
      subjectId: eligibility.subjectId,
      direction: eligibility.direction,
      ratings,
      comment,
    });

    const providerProfile =
      eligibility.direction === "customer_to_provider" ? await remote.fetchProviderProfile(eligibility.subjectId).catch(() => null) : null;

    set((s) => ({
      reviews: [...s.reviews, review],
      providerProfiles: providerProfile
        ? s.providerProfiles.map((p) => (p.id === providerProfile.id ? providerProfile : p))
        : s.providerProfiles,
    }));

    return { ok: true };
  },

  toggleFavorite: async (customerId, providerId) => {
    const existing = get().favorites.find((f) => f.customerId === customerId && f.providerId === providerId);
    await remote.toggleFavoriteRemote(customerId, providerId, !!existing);
    set((state) => {
      if (existing) return { favorites: state.favorites.filter((f) => f.id !== existing.id) };
      return {
        favorites: [
          ...state.favorites,
          { id: `local:${customerId}:${providerId}`, customerId, providerId, createdAt: new Date().toISOString() },
        ],
      };
    });
  },

  markNotificationsRead: async (userId) => {
    await remote.markNotificationsReadRemote(userId);
    set((state) => ({
      notifications: state.notifications.map((n) => (n.userId === userId && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)),
    }));
  },
}));
