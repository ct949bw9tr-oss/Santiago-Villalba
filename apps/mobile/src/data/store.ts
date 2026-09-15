import { create } from "zustand";
import {
  applyBookingTransition,
  BookingActor,
  calculateCancellationOutcome,
  calculatePriceBreakdown,
  checkReviewEligibility,
} from "@taskswift/business-logic";
import {
  Address,
  AppMode,
  Booking,
  BookingStatus,
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
import { CITY_COORDS, jitter, uuidFrom } from "@taskswift/seed-data";
import { categories, services, subcategories } from "./catalog";
import { addresses, portfolioItems, providerProfiles, providerServices, serviceAreas, availabilitySlots, users } from "./entities";
import { bookings, favorites, messages, notifications, reviews } from "./bookings";

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

  // reference data (static for the MVP demo, but modeled as state for a
  // consistent read pattern that mirrors how a real API-backed store would work)
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

  // mutable marketplace state
  bookings: Booking[];
  reviews: Review[];
  messages: Message[];
  notifications: Notification[];
  favorites: Favorite[];

  login: (userId: string) => void;
  loginOrRegisterByPhone: (phone: string) => string;
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
  }) => void;
  toggleOnline: (providerId: string) => void;
  toggleAvailabilityDay: (providerId: string, dayOfWeek: number) => void;
  addAddress: (input: Omit<Address, "id" | "createdAt" | "updatedAt">) => Address;

  createBooking: (input: CreateBookingInput) => Booking;
  respondToRequest: (bookingId: string, action: "accept" | "decline") => void;
  markEnRoute: (bookingId: string) => void;
  startService: (bookingId: string) => void;
  markProviderComplete: (bookingId: string) => void;
  confirmCompletion: (bookingId: string) => void;
  cancelBooking: (bookingId: string, actor: "customer" | "provider", reason?: string) => void;

  sendMessage: (bookingId: string, senderId: string | "system", body: string) => void;
  markMessagesRead: (bookingId: string, readerId: string) => void;

  submitReview: (bookingId: string, authorId: string, ratings: ReviewRatings, comment?: string) => { ok: true } | { ok: false; reason: string };
  toggleFavorite: (customerId: string, providerId: string) => void;
  markNotificationsRead: (userId: string) => void;
}

function transition(booking: Booking, to: BookingStatus, actor: BookingActor) {
  booking.status = applyBookingTransition(booking.status, to, actor);
  booking.updatedAt = new Date().toISOString();
}

export const useTaskSwiftStore = create<TaskSwiftState>((set, get) => ({
  currentUserId: null,
  activeMode: "customer",

  categories,
  subcategories,
  services,
  users,
  providerProfiles,
  providerServices,
  serviceAreas,
  availabilitySlots,
  portfolioItems,
  addresses,

  bookings,
  reviews,
  messages,
  notifications,
  favorites,

  login: (userId) => {
    const user = get().users.find((u) => u.id === userId);
    set({ currentUserId: userId, activeMode: user?.isProvider ? user.activeMode : "customer" });
  },
  loginOrRegisterByPhone: (rawPhone) => {
    const digits = rawPhone.replace(/\D/g, "").slice(-10);
    const state = get();
    const existing = state.users.find((u) => u.phone && u.phone.replace(/\D/g, "").endsWith(digits) && digits.length >= 7);
    if (existing) {
      get().login(existing.id);
      return existing.id;
    }
    const now = new Date().toISOString();
    const newUser: User = {
      id: uuidFrom(`user:phone:${digits}:${Date.now()}`),
      phone: `+57${digits}`,
      firstName: "Nuevo",
      lastName: "Usuario",
      locale: "es-CO",
      countryCode: "CO",
      authProviders: ["phone"],
      isProvider: false,
      activeMode: "customer",
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ users: [...s.users, newUser], currentUserId: newUser.id, activeMode: "customer" }));
    return newUser.id;
  },
  logout: () => set({ currentUserId: null }),
  switchMode: (mode) => set({ activeMode: mode }),

  becomeProvider: (input) =>
    set((state) => {
      const now = new Date().toISOString();
      const providerProfile: ProviderProfile = {
        id: input.userId,
        headline: input.headline,
        bio: input.bio,
        languages: ["es"],
        verificationState: "phone_verified",
        isVerified: false,
        ratingAverage: 0,
        ratingCount: 0,
        completedJobsCount: 0,
        isOnline: true,
        acceptsInstantRequests: true,
        travelsToCustomer: true,
        customerTravelsToProvider: false,
        offersRemoteService: false,
        countryCode: "CO",
        createdAt: now,
        updatedAt: now,
      };
      const providerService: ProviderService = {
        id: uuidFrom(`provider_service:runtime:${input.userId}`),
        providerId: input.userId,
        serviceId: input.serviceId,
        pricingModel: input.pricingModel,
        price: input.price,
        currency: "COP",
        estimatedDurationMinutes: 45,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      const center = jitter(CITY_COORDS[input.city] ?? CITY_COORDS["Bogotá"]!, `area:runtime:${input.userId}`);
      const serviceArea: ProviderServiceArea = {
        id: uuidFrom(`area:runtime:${input.userId}`),
        providerId: input.userId,
        center,
        radiusKm: 8,
        city: input.city,
        createdAt: now,
      };
      const newSlots: ProviderAvailabilitySlot[] = Array.from({ length: 6 }, (_, i) => ({
        id: uuidFrom(`slot:runtime:${input.userId}:${i + 1}`),
        providerId: input.userId,
        dayOfWeek: (i + 1) as ProviderAvailabilitySlot["dayOfWeek"],
        startTime: "09:00",
        endTime: "18:00",
        isActive: true,
      }));

      return {
        users: state.users.map((u) => (u.id === input.userId ? { ...u, isProvider: true, activeMode: "provider" } : u)),
        providerProfiles: [...state.providerProfiles, providerProfile],
        providerServices: [...state.providerServices, providerService],
        serviceAreas: [...state.serviceAreas, serviceArea],
        availabilitySlots: [...state.availabilitySlots, ...newSlots],
        activeMode: "provider",
      };
    }),

  toggleOnline: (providerId) =>
    set((state) => ({
      providerProfiles: state.providerProfiles.map((p) => (p.id === providerId ? { ...p, isOnline: !p.isOnline } : p)),
    })),

  toggleAvailabilityDay: (providerId, dayOfWeek) =>
    set((state) => ({
      availabilitySlots: state.availabilitySlots.map((slot) =>
        slot.providerId === providerId && slot.dayOfWeek === dayOfWeek ? { ...slot, isActive: !slot.isActive } : slot
      ),
    })),

  addAddress: (input) => {
    const address: Address = {
      ...input,
      id: uuidFrom(`address:runtime:${input.userId}:${Date.now()}`),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({ addresses: [...state.addresses, address] }));
    return address;
  },

  createBooking: (input) => {
    const state = get();
    const ps = state.providerServices.find((s) => s.id === input.providerServiceId);
    if (!ps) throw new Error("Unknown provider service");
    const provider = state.providerProfiles.find((p) => p.id === input.providerId);
    if (!provider) throw new Error("Unknown provider");
    const address = state.addresses.find((a) => a.id === input.addressId);
    if (!address) throw new Error("Unknown address");
    const category = state.services.find((s) => s.id === ps.serviceId);
    const subcategory = state.subcategories.find((sc) => sc.id === category?.subcategoryId);
    const categoryId = subcategory?.categoryId ?? state.categories[0]!.id;

    const servicePrice = ps.price ?? 0;
    const priceBreakdown = calculatePriceBreakdown({ servicePrice, currency: ps.currency, countryCode: "CO" });

    const now = new Date().toISOString();
    const booking: Booking = {
      id: uuidFrom(`booking:runtime:${input.customerId}:${input.providerId}:${Date.now()}`),
      requestId: uuidFrom(`request:runtime:${Date.now()}`),
      customerId: input.customerId,
      providerId: input.providerId,
      providerServiceId: ps.id,
      categoryId,
      status: "requested",
      timing: input.timing,
      scheduledFor: input.scheduledFor,
      address,
      locationSnapshot: address.location,
      notes: input.notes,
      photoUrls: [],
      priceBreakdown,
      countryCode: "CO",
      createdAt: now,
      updatedAt: now,
    };

    set((s) => ({
      bookings: [booking, ...s.bookings],
      notifications: [
        {
          id: uuidFrom(`notif:new_request:runtime:${booking.id}`),
          userId: input.providerId,
          type: "new_request",
          title: "Nueva solicitud",
          body: `Tienes una nueva solicitud de servicio.`,
          bookingId: booking.id,
          createdAt: now,
        },
        ...s.notifications,
      ],
    }));

    return booking;
  },

  respondToRequest: (bookingId, action) =>
    set((state) => {
      const booking = state.bookings.find((b) => b.id === bookingId);
      if (!booking) return state;
      const updated = { ...booking };
      if (updated.status === "requested") {
        transition(updated, "pending_provider", "provider");
      }
      if (action === "accept") {
        transition(updated, "accepted", "provider");
        updated.acceptedAt = new Date().toISOString();
      } else {
        transition(updated, "cancelled_provider", "provider");
        updated.cancelledAt = new Date().toISOString();
        updated.cancelledBy = updated.providerId;
      }
      return {
        bookings: state.bookings.map((b) => (b.id === bookingId ? updated : b)),
        notifications: [
          {
            id: uuidFrom(`notif:respond:${bookingId}:${Date.now()}`),
            userId: updated.customerId,
            type: action === "accept" ? "request_accepted" : "request_declined",
            title: action === "accept" ? "Solicitud aceptada" : "Solicitud rechazada",
            body: action === "accept" ? "El proveedor aceptó tu solicitud." : "El proveedor no pudo aceptar tu solicitud.",
            bookingId,
            createdAt: new Date().toISOString(),
          },
          ...state.notifications,
        ],
      };
    }),

  markEnRoute: (bookingId) =>
    set((state) => ({
      bookings: state.bookings.map((b) => {
        if (b.id !== bookingId) return b;
        const updated = { ...b, enRouteAt: new Date().toISOString() };
        transition(updated, "provider_en_route", "provider");
        return updated;
      }),
      notifications: [
        ...notifFor(get_(state, bookingId)?.customerId, "provider_arriving", "El proveedor está en camino", "Tu proveedor va en camino a tu ubicación.", bookingId),
        ...state.notifications,
      ],
    })),

  startService: (bookingId) =>
    set((state) => ({
      bookings: state.bookings.map((b) => {
        if (b.id !== bookingId) return b;
        const updated = { ...b, startedAt: new Date().toISOString() };
        transition(updated, "in_progress", "provider");
        return updated;
      }),
    })),

  markProviderComplete: (bookingId) =>
    set((state) => ({
      bookings: state.bookings.map((b) => {
        if (b.id !== bookingId) return b;
        const updated = { ...b, completedByProviderAt: new Date().toISOString() };
        transition(updated, "awaiting_completion_confirmation", "provider");
        return updated;
      }),
      notifications: [
        ...notifFor(get_(state, bookingId)?.customerId, "task_completed", "Servicio completado", "El proveedor marcó el servicio como completado. Confírmalo para finalizar.", bookingId),
        ...state.notifications,
      ],
    })),

  confirmCompletion: (bookingId) =>
    set((state) => {
      const booking = state.bookings.find((b) => b.id === bookingId);
      if (!booking) return state;
      const updated: Booking = { ...booking, completedByCustomerAt: new Date().toISOString() };
      transition(updated, "completed", "customer");

      const provider = state.providerProfiles.find((p) => p.id === updated.providerId);
      const updatedProviderProfiles = provider
        ? state.providerProfiles.map((p) => (p.id === provider.id ? { ...p, completedJobsCount: p.completedJobsCount + 1 } : p))
        : state.providerProfiles;

      return {
        bookings: state.bookings.map((b) => (b.id === bookingId ? updated : b)),
        providerProfiles: updatedProviderProfiles,
        notifications: [
          ...notifFor(updated.customerId, "payment_processed", "Pago procesado", `Tu pago de la orden fue procesado con éxito.`, bookingId),
          ...notifFor(updated.providerId, "payout_sent", "Ganancia disponible", "Recibiste el pago por un servicio completado.", bookingId),
          ...state.notifications,
        ],
      };
    }),

  cancelBooking: (bookingId, actor, reason) =>
    set((state) => {
      const booking = state.bookings.find((b) => b.id === bookingId);
      if (!booking) return state;
      const outcome = calculateCancellationOutcome(booking, actor, new Date());
      const updated: Booking = {
        ...booking,
        cancelledAt: new Date().toISOString(),
        cancelledBy: actor === "customer" ? booking.customerId : booking.providerId,
        cancellationReason: reason ?? (outcome.isLate ? "Cancelación tardía" : "Cancelación dentro de la ventana gratuita"),
      };
      transition(updated, actor === "customer" ? "cancelled_customer" : "cancelled_provider", actor);
      return { bookings: state.bookings.map((b) => (b.id === bookingId ? updated : b)) };
    }),

  sendMessage: (bookingId, senderId, body) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: uuidFrom(`msg:runtime:${bookingId}:${Date.now()}`),
          bookingId,
          senderId,
          type: "text",
          body,
          createdAt: new Date().toISOString(),
        },
      ],
    })),

  markMessagesRead: (bookingId, readerId) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.bookingId === bookingId && m.senderId !== readerId && !m.readAt ? { ...m, readAt: new Date().toISOString() } : m
      ),
    })),

  submitReview: (bookingId, authorId, ratings, comment) => {
    const state = get();
    const booking = state.bookings.find((b) => b.id === bookingId);
    if (!booking) return { ok: false, reason: "Booking not found" };
    const eligibility = checkReviewEligibility({ booking, authorId, existingReviews: state.reviews });
    if (!eligibility.eligible) return { ok: false, reason: eligibility.reason };

    const review: Review = {
      id: uuidFrom(`review:runtime:${bookingId}:${authorId}`),
      bookingId,
      authorId,
      subjectId: eligibility.subjectId,
      direction: eligibility.direction,
      ratings,
      comment,
      createdAt: new Date().toISOString(),
    };

    set((s) => {
      const nextReviews = [...s.reviews, review];
      let nextProviderProfiles = s.providerProfiles;
      if (eligibility.direction === "customer_to_provider") {
        const providerReviews = nextReviews.filter((r) => r.subjectId === eligibility.subjectId && r.direction === "customer_to_provider");
        const avg = providerReviews.reduce((sum, r) => sum + r.ratings.overall, 0) / providerReviews.length;
        nextProviderProfiles = s.providerProfiles.map((p) =>
          p.id === eligibility.subjectId ? { ...p, ratingAverage: Math.round(avg * 10) / 10, ratingCount: providerReviews.length } : p
        );
      }
      return { reviews: nextReviews, providerProfiles: nextProviderProfiles };
    });

    return { ok: true };
  },

  toggleFavorite: (customerId, providerId) =>
    set((state) => {
      const existing = state.favorites.find((f) => f.customerId === customerId && f.providerId === providerId);
      if (existing) {
        return { favorites: state.favorites.filter((f) => f.id !== existing.id) };
      }
      return {
        favorites: [
          ...state.favorites,
          { id: uuidFrom(`favorite:runtime:${customerId}:${providerId}`), customerId, providerId, createdAt: new Date().toISOString() },
        ],
      };
    }),

  markNotificationsRead: (userId) =>
    set((state) => ({
      notifications: state.notifications.map((n) => (n.userId === userId && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)),
    })),
}));

function get_(state: TaskSwiftState, bookingId: string) {
  return state.bookings.find((b) => b.id === bookingId);
}

function notifFor(userId: string | undefined, type: Notification["type"], title: string, body: string, bookingId: string): Notification[] {
  if (!userId) return [];
  return [{ id: uuidFrom(`notif:${type}:${bookingId}:${Date.now()}`), userId, type, title, body, bookingId, createdAt: new Date().toISOString() }];
}
