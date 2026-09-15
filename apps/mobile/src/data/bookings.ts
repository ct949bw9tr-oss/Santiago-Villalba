import { calculatePriceBreakdown } from "@taskswift/business-logic";
import { Booking, Favorite, Message, Notification, Review } from "@taskswift/types";
import { CITY_COORDS, SEED_BOOKINGS, SEED_CUSTOMERS, SEED_PROVIDERS, customerKey, providerKey, uuidFrom } from "@taskswift/seed-data";
import { categoryIdBySlug } from "./catalog";
import { defaultAddressIdByUserId, providerServiceByProviderId, userIdByName } from "./entities";

export const bookings: Booking[] = [];
export const reviews: Review[] = [];
export const messages: Message[] = [];
export const notifications: Notification[] = [];
export const favorites: Favorite[] = [];

const STATUS_ORDER = [
  "draft",
  "requested",
  "pending_provider",
  "accepted",
  "provider_en_route",
  "in_progress",
  "awaiting_completion_confirmation",
  "completed",
] as const;

function reached(status: (typeof STATUS_ORDER)[number], target: (typeof STATUS_ORDER)[number]): boolean {
  return STATUS_ORDER.indexOf(status) >= STATUS_ORDER.indexOf(target);
}

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

for (const b of SEED_BOOKINGS) {
  const customerId = userIdByName.get(b.customer)!;
  const providerId = userIdByName.get(b.provider)!;
  const providerSeed = SEED_PROVIDERS.find((p) => providerKey(p) === b.provider)!;
  const ps = providerServiceByProviderId.get(providerId)!;
  const categoryId = categoryIdBySlug.get(providerSeed.category)!;
  const addressId = defaultAddressIdByUserId.get(customerId)!;
  const custHome = CITY_COORDS[SEED_CUSTOMERS.find((c) => customerKey(c) === b.customer)!.city]!;

  const servicePrice = providerSeed.price ?? 60000;
  const breakdown = calculatePriceBreakdown({ servicePrice, currency: "COP", countryCode: "CO" });

  const bookingId = uuidFrom(`booking:${b.key}`);
  const createdAt = isoDaysFromNow(b.daysFromNow - 1);
  const scheduledFor = b.timing === "scheduled" ? isoDaysFromNow(b.daysFromNow) : undefined;

  const effectiveStatus = b.status === "cancelled_customer" ? "accepted" : b.status;
  const booking: Booking = {
    id: bookingId,
    requestId: uuidFrom(`request:${b.key}`),
    customerId,
    providerId,
    providerServiceId: ps.id,
    categoryId,
    status: b.status,
    timing: b.timing,
    scheduledFor,
    address: {
      id: addressId,
      userId: customerId,
      label: "Casa",
      line1: "",
      city: SEED_CUSTOMERS.find((c) => customerKey(c) === b.customer)!.city,
      countryCode: "CO",
      location: custHome,
      isDefault: true,
      createdAt,
      updatedAt: createdAt,
    },
    locationSnapshot: custHome,
    notes: "Generado por datos de prueba de TaskSwift",
    photoUrls: [],
    priceBreakdown: breakdown,
    countryCode: "CO",
    acceptedAt: reached(effectiveStatus, "accepted") ? createdAt : undefined,
    startedAt: reached(effectiveStatus, "in_progress") ? createdAt : undefined,
    completedByProviderAt: b.status === "completed" ? createdAt : undefined,
    completedByCustomerAt: b.status === "completed" ? createdAt : undefined,
    cancelledAt: b.status === "cancelled_customer" ? createdAt : undefined,
    cancelledBy: b.status === "cancelled_customer" ? customerId : undefined,
    cancellationReason: b.status === "cancelled_customer" ? "El cliente canceló el servicio" : undefined,
    createdAt,
    updatedAt: createdAt,
  };
  bookings.push(booking);

  if (b.status === "completed") {
    reviews.push({
      id: uuidFrom(`review:${b.key}`),
      bookingId,
      authorId: customerId,
      subjectId: providerId,
      direction: "customer_to_provider",
      ratings: { overall: 5, quality: 5, punctuality: 5, communication: 5, professionalism: 5 },
      comment: `Excelente servicio de ${providerSeed.headline.toLowerCase()}, muy recomendado!`,
      createdAt,
    });
    notifications.push(
      {
        id: uuidFrom(`notif:payment:${b.key}`),
        userId: customerId,
        type: "payment_processed",
        title: "Pago procesado",
        body: `Tu pago fue procesado con éxito.`,
        bookingId,
        createdAt,
      },
      {
        id: uuidFrom(`notif:payout:${b.key}`),
        userId: providerId,
        type: "payout_sent",
        title: "Ganancia disponible",
        body: `Recibiste el pago por un servicio completado.`,
        bookingId,
        createdAt,
      }
    );
  }

  if (b.withChat) {
    messages.push(
      {
        id: uuidFrom(`msg:${b.key}:1`),
        bookingId,
        senderId: "system",
        type: "system",
        body: `${providerSeed.firstName} aceptó tu solicitud.`,
        createdAt,
      },
      {
        id: uuidFrom(`msg:${b.key}:2`),
        bookingId,
        senderId: customerId,
        type: "text",
        body: "¡Hola! Confirmo la dirección para el servicio.",
        createdAt,
      },
      {
        id: uuidFrom(`msg:${b.key}:3`),
        bookingId,
        senderId: providerId,
        type: "text",
        body: "¡Perfecto! Ahí estaré a la hora acordada.",
        createdAt,
      }
    );
  }

  if (b.status === "requested" || b.status === "pending_provider") {
    notifications.push({
      id: uuidFrom(`notif:new_request:${b.key}`),
      userId: providerId,
      type: "new_request",
      title: "Nueva solicitud",
      body: `${SEED_CUSTOMERS.find((c) => customerKey(c) === b.customer)!.firstName} solicitó tu servicio.`,
      bookingId,
      createdAt,
    });
  }
}

favorites.push(
  {
    id: uuidFrom("favorite:1"),
    customerId: userIdByName.get("Santiago Villalba")!,
    providerId: userIdByName.get("Andrés Ramírez")!,
    createdAt: isoDaysFromNow(-10),
  },
  {
    id: uuidFrom("favorite:2"),
    customerId: userIdByName.get("Juan Pablo Duarte")!,
    providerId: userIdByName.get("Valentina Morales")!,
    createdAt: isoDaysFromNow(-10),
  }
);
