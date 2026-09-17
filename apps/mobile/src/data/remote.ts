import { supabase } from "../lib/supabase";
import {
  Address,
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
import { PriceBreakdown } from "@taskswift/types";

function check<T>(res: { data: T; error: null } | { data: null; error: { message: string } }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// ---------- mappers (snake_case DB rows -> camelCase app types) ----------

function mapUser(r: any): User {
  return {
    id: r.id,
    phone: r.phone ?? undefined,
    email: r.email ?? undefined,
    firstName: r.first_name,
    lastName: r.last_name,
    avatarUrl: r.avatar_url ?? undefined,
    locale: r.locale,
    countryCode: r.country_code,
    authProviders: r.auth_providers ?? [],
    isProvider: r.is_provider,
    activeMode: r.active_mode,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at ?? undefined,
  };
}

function mapProviderProfile(r: any): ProviderProfile {
  return {
    id: r.id ?? r.provider_id,
    headline: r.headline,
    bio: r.bio ?? undefined,
    yearsExperience: r.years_experience ?? undefined,
    languages: r.languages ?? ["es"],
    verificationState: r.verification_state ?? (r.is_verified ? "identity_verified" : "phone_verified"),
    isVerified: r.is_verified,
    ratingAverage: Number(r.rating_average ?? 0),
    ratingCount: r.rating_count ?? 0,
    completedJobsCount: r.completed_jobs_count ?? 0,
    responseTimeMinutes: r.response_time_minutes ?? undefined,
    isOnline: r.is_online,
    acceptsInstantRequests: r.accepts_instant_requests ?? true,
    travelsToCustomer: r.travels_to_customer ?? true,
    customerTravelsToProvider: r.customer_travels_to_provider ?? false,
    offersRemoteService: r.offers_remote_service ?? false,
    countryCode: r.country_code ?? "CO",
    createdAt: r.created_at ?? new Date().toISOString(),
    updatedAt: r.updated_at ?? new Date().toISOString(),
  };
}

function mapProviderService(r: any): ProviderService {
  return {
    id: r.id ?? r.provider_service_id,
    providerId: r.provider_id,
    serviceId: r.service_id,
    pricingModel: r.pricing_model,
    price: r.price === null || r.price === undefined ? null : Number(r.price),
    currency: r.currency,
    estimatedDurationMinutes: r.estimated_duration_minutes ?? undefined,
    isActive: r.is_active ?? true,
    createdAt: r.created_at ?? new Date().toISOString(),
    updatedAt: r.updated_at ?? new Date().toISOString(),
  };
}

function mapAddress(r: any): Address {
  return {
    id: r.id,
    userId: r.user_id,
    label: r.label,
    line1: r.line1,
    line2: r.line2 ?? undefined,
    city: r.city,
    state: r.state ?? undefined,
    countryCode: r.country_code,
    postalCode: r.postal_code ?? undefined,
    location: { lat: r.lat, lng: r.lng },
    isDefault: r.is_default,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapCategory(r: any): Category {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    nameEn: r.name_en,
    icon: r.icon,
    sortOrder: r.sort_order,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapSubcategory(r: any): Subcategory {
  return {
    id: r.id,
    categoryId: r.category_id,
    slug: r.slug,
    name: r.name,
    nameEn: r.name_en,
    sortOrder: r.sort_order,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapService(r: any): Service {
  return {
    id: r.id,
    subcategoryId: r.subcategory_id,
    slug: r.slug,
    name: r.name,
    nameEn: r.name_en,
    description: r.description ?? undefined,
    defaultDurationMinutes: r.default_duration_minutes ?? undefined,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapPortfolioItem(r: any): PortfolioItem {
  return {
    id: r.id,
    providerId: r.provider_id,
    categoryId: r.category_id ?? undefined,
    mediaType: r.media_type,
    mediaUrl: r.media_url,
    beforeMediaUrl: r.before_media_url ?? undefined,
    caption: r.caption ?? undefined,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  };
}

function mapAvailabilitySlot(r: any): ProviderAvailabilitySlot {
  return {
    id: r.id,
    providerId: r.provider_id,
    dayOfWeek: r.day_of_week,
    startTime: r.start_time,
    endTime: r.end_time,
    isActive: r.is_active,
  };
}

function priceBreakdownFromRow(r: any): PriceBreakdown {
  return {
    servicePrice: Number(r.service_price),
    customerFee: Number(r.customer_fee),
    total: Number(r.total_amount),
    currency: r.currency,
    providerCommission: Number(r.provider_commission),
    providerPayout: Number(r.provider_payout),
  };
}

function mapBooking(r: any, address: Address): Booking {
  return {
    id: r.id,
    requestId: r.request_id,
    customerId: r.customer_id,
    providerId: r.provider_id,
    providerServiceId: r.provider_service_id,
    categoryId: r.category_id,
    status: r.status,
    timing: r.timing,
    scheduledFor: r.scheduled_for ?? undefined,
    address,
    locationSnapshot: { lat: r.location_lat, lng: r.location_lng },
    notes: r.notes ?? undefined,
    photoUrls: r.photo_urls ?? [],
    priceBreakdown: priceBreakdownFromRow(r),
    quoteAmount: r.quote_amount ?? undefined,
    countryCode: r.country_code,
    acceptedAt: r.accepted_at ?? undefined,
    enRouteAt: r.en_route_at ?? undefined,
    startedAt: r.started_at ?? undefined,
    completedByProviderAt: r.completed_by_provider_at ?? undefined,
    completedByCustomerAt: r.completed_by_customer_at ?? undefined,
    cancelledAt: r.cancelled_at ?? undefined,
    cancelledBy: r.cancelled_by ?? undefined,
    cancellationReason: r.cancellation_reason ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapReview(r: any): Review {
  return {
    id: r.id,
    bookingId: r.booking_id,
    authorId: r.author_id,
    subjectId: r.subject_id,
    direction: r.direction,
    ratings: {
      overall: r.rating_overall,
      quality: r.rating_quality ?? undefined,
      punctuality: r.rating_punctuality ?? undefined,
      communication: r.rating_communication ?? undefined,
      professionalism: r.rating_professionalism ?? undefined,
    },
    comment: r.comment ?? undefined,
    createdAt: r.created_at,
  };
}

function mapFavorite(r: any): Favorite {
  return { id: r.id, customerId: r.customer_id, providerId: r.provider_id, createdAt: r.created_at };
}

function mapMessage(r: any): Message {
  return {
    id: r.id,
    bookingId: r.booking_id,
    senderId: r.sender_id ?? "system",
    type: r.type,
    body: r.body,
    readAt: r.read_at ?? undefined,
    createdAt: r.created_at,
  };
}

function mapNotification(r: any): Notification {
  return {
    id: r.id,
    userId: r.user_id,
    type: r.type,
    title: r.title,
    body: r.body,
    bookingId: r.booking_id ?? undefined,
    readAt: r.read_at ?? undefined,
    createdAt: r.created_at,
  };
}

// ---------- public (no-login-required) reads ----------

export async function fetchCatalog() {
  const [categories, subcategories, services] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("subcategories").select("*").order("sort_order"),
    supabase.from("services").select("*"),
  ]);
  return {
    categories: check(categories).map(mapCategory),
    subcategories: check(subcategories).map(mapSubcategory),
    services: check(services).map(mapService),
  };
}

export async function fetchProviderDirectory() {
  const rows = check(await supabase.rpc("list_providers"));
  const users = new Map<string, User>();
  const providerProfiles = new Map<string, ProviderProfile>();
  const providerServices: ProviderService[] = [];
  const serviceAreas = new Map<string, ProviderServiceArea>();

  for (const r of rows as any[]) {
    if (!users.has(r.provider_id)) {
      users.set(r.provider_id, {
        id: r.provider_id,
        firstName: r.first_name,
        lastName: r.last_name,
        avatarUrl: r.avatar_url ?? undefined,
        locale: "es-CO",
        countryCode: "CO",
        authProviders: [],
        isProvider: true,
        activeMode: "provider",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      providerProfiles.set(r.provider_id, mapProviderProfile(r));
    }
    providerServices.push({
      id: r.provider_service_id,
      providerId: r.provider_id,
      serviceId: r.service_id,
      pricingModel: r.pricing_model,
      price: r.price === null ? null : Number(r.price),
      currency: r.currency,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (r.area_lat !== null && !serviceAreas.has(r.provider_id)) {
      serviceAreas.set(r.provider_id, {
        id: `area:${r.provider_id}`,
        providerId: r.provider_id,
        center: { lat: r.area_lat, lng: r.area_lng },
        radiusKm: Number(r.radius_km ?? 8),
        city: r.city,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return {
    users: [...users.values()],
    providerProfiles: [...providerProfiles.values()],
    providerServices,
    serviceAreas: [...serviceAreas.values()],
    // service/category names for search, keyed by provider_service_id
    serviceNameByProviderServiceId: new Map((rows as any[]).map((r) => [r.provider_service_id, r.service_name])),
    categorySlugByProviderServiceId: new Map((rows as any[]).map((r) => [r.provider_service_id, r.category_slug])),
  };
}

export async function fetchPortfolioItems(): Promise<PortfolioItem[]> {
  return check(await supabase.from("portfolio_items").select("*")).map(mapPortfolioItem);
}

export async function fetchAvailabilitySlots(): Promise<ProviderAvailabilitySlot[]> {
  return check(await supabase.from("provider_availability_slots").select("*")).map(mapAvailabilitySlot);
}

export async function fetchProviderReviews(providerId: string): Promise<{ reviews: Review[]; authorNames: Map<string, { firstName: string; lastName: string }> }> {
  const rows = check(await supabase.rpc("list_provider_reviews", { target_provider_id: providerId })) as any[];
  const authorNames = new Map<string, { firstName: string; lastName: string }>();
  for (const r of rows) authorNames.set(r.author_id, { firstName: r.author_first_name, lastName: r.author_last_name });
  return {
    reviews: rows.map((r) =>
      mapReview({
        id: r.id,
        booking_id: r.booking_id,
        author_id: r.author_id,
        subject_id: providerId,
        direction: "customer_to_provider",
        rating_overall: r.rating_overall,
        rating_quality: r.rating_quality,
        rating_punctuality: r.rating_punctuality,
        rating_communication: r.rating_communication,
        rating_professionalism: r.rating_professionalism,
        comment: r.comment,
        created_at: r.created_at,
      })
    ),
    authorNames,
  };
}

export async function fetchUserPublicNames(ids: string[]): Promise<User[]> {
  if (ids.length === 0) return [];
  const rows = check(await supabase.rpc("list_user_public_names", { target_ids: ids })) as any[];
  return rows.map((r) => ({
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    avatarUrl: r.avatar_url ?? undefined,
    locale: "es-CO",
    countryCode: "CO",
    authProviders: [],
    isProvider: false,
    activeMode: "customer",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

// ---------- private (per-logged-in-user) reads ----------

export async function fetchOwnUser(userId: string): Promise<User> {
  return mapUser(check(await supabase.from("users").select("*").eq("id", userId).single()));
}

export async function fetchAddresses(userId: string): Promise<Address[]> {
  return check(await supabase.from("addresses").select("*").eq("user_id", userId)).map(mapAddress);
}

export async function fetchFavorites(userId: string): Promise<Favorite[]> {
  return check(await supabase.from("favorites").select("*").eq("customer_id", userId)).map(mapFavorite);
}

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  return check(await supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false })).map(
    mapNotification
  );
}

export async function fetchBookings(): Promise<Booking[]> {
  const rows = check(await supabase.from("bookings").select("*").order("created_at", { ascending: false })) as any[];
  const addresses = await Promise.all(
    rows.map(async (r) => {
      const addrRows = check(await supabase.rpc("get_booking_address", { target_booking_id: r.id })) as any[];
      return addrRows[0] ? mapAddress(addrRows[0]) : mapAddress({ id: r.address_id, user_id: r.customer_id, label: "Dirección", line1: "", city: "", country_code: r.country_code, lat: r.location_lat, lng: r.location_lng, is_default: true, created_at: r.created_at, updated_at: r.created_at });
    })
  );
  return rows.map((r, i) => mapBooking(r, addresses[i]!));
}

export async function fetchMessages(): Promise<Message[]> {
  return check(await supabase.from("messages").select("*").order("created_at")).map(mapMessage);
}

export async function fetchAllReviews(): Promise<Review[]> {
  return check(await supabase.from("reviews").select("*")).map(mapReview);
}

// ---------- writes ----------

export async function insertAddress(input: Omit<Address, "id" | "createdAt" | "updatedAt">): Promise<Address> {
  const row = check(
    await supabase
      .from("addresses")
      .insert({
        user_id: input.userId,
        label: input.label,
        line1: input.line1,
        line2: input.line2 ?? null,
        city: input.city,
        state: input.state ?? null,
        country_code: input.countryCode,
        postal_code: input.postalCode ?? null,
        lat: input.location.lat,
        lng: input.location.lng,
        is_default: input.isDefault,
      })
      .select()
      .single()
  );
  return mapAddress(row);
}

export async function becomeProviderRemote(input: {
  userId: string;
  headline: string;
  bio?: string;
  serviceId: string;
  pricingModel: string;
  price: number | null;
  currency: string;
  city: string;
  center: { lat: number; lng: number };
}) {
  await check(
    await supabase.from("users").update({ is_provider: true, active_mode: "provider" }).eq("id", input.userId).select().single()
  );
  const profileRow = check(
    await supabase
      .from("provider_profiles")
      .insert({
        id: input.userId,
        headline: input.headline,
        bio: input.bio ?? null,
        languages: ["es"],
        verification_state: "phone_verified",
        is_verified: false,
        is_online: true,
        accepts_instant_requests: true,
        travels_to_customer: true,
        country_code: "CO",
      })
      .select()
      .single()
  );
  const serviceRow = check(
    await supabase
      .from("provider_services")
      .insert({
        provider_id: input.userId,
        service_id: input.serviceId,
        pricing_model: input.pricingModel,
        price: input.price,
        currency: input.currency,
        estimated_duration_minutes: 45,
        is_active: true,
      })
      .select()
      .single()
  );
  await check(
    await supabase
      .from("provider_service_areas")
      .insert({ provider_id: input.userId, center_lat: input.center.lat, center_lng: input.center.lng, radius_km: 8, city: input.city })
      .select()
      .single()
  );
  const slots = Array.from({ length: 6 }, (_, i) => ({
    provider_id: input.userId,
    day_of_week: i + 1,
    start_time: "09:00",
    end_time: "18:00",
    is_active: true,
  }));
  await check(await supabase.from("provider_availability_slots").insert(slots).select());

  return { profile: mapProviderProfile(profileRow), service: mapProviderService(serviceRow) };
}

export async function fetchProviderProfile(providerId: string): Promise<ProviderProfile> {
  return mapProviderProfile(check(await supabase.from("provider_profiles").select("*").eq("id", providerId).single()));
}

export async function toggleOnlineRemote(providerId: string, isOnline: boolean) {
  await check(await supabase.from("provider_profiles").update({ is_online: isOnline }).eq("id", providerId).select().single());
}

export async function toggleAvailabilityDayRemote(providerId: string, dayOfWeek: number, isActive: boolean) {
  await check(
    await supabase
      .from("provider_availability_slots")
      .update({ is_active: isActive })
      .eq("provider_id", providerId)
      .eq("day_of_week", dayOfWeek)
      .select()
  );
}

export interface CreateBookingRemoteInput {
  customerId: string;
  providerId: string;
  providerServiceId: string;
  categoryId: string;
  timing: "scheduled" | "now";
  scheduledFor?: string;
  address: Address;
  notes?: string;
  pricingModel: string;
  estimatedDurationMinutes?: number;
  priceBreakdown: PriceBreakdown;
  countryCode: string;
}

export async function createBookingRemote(input: CreateBookingRemoteInput): Promise<Booking> {
  const requestRow = check<any>(
    await supabase
      .from("service_requests")
      .insert({
        customer_id: input.customerId,
        provider_id: input.providerId,
        provider_service_id: input.providerServiceId,
        timing: input.timing,
        scheduled_for: input.scheduledFor ?? null,
        address_id: input.address.id,
        location_lat: input.address.location.lat,
        location_lng: input.address.location.lng,
        notes: input.notes ?? null,
        estimated_duration_minutes: input.estimatedDurationMinutes ?? null,
        pricing_model: input.pricingModel,
        service_price: input.priceBreakdown.servicePrice,
        customer_fee: input.priceBreakdown.customerFee,
        total_amount: input.priceBreakdown.total,
        currency: input.priceBreakdown.currency,
        provider_commission: input.priceBreakdown.providerCommission,
        provider_payout: input.priceBreakdown.providerPayout,
      })
      .select()
      .single()
  );

  const bookingRow = check<any>(
    await supabase
      .from("bookings")
      .insert({
        request_id: requestRow.id,
        customer_id: input.customerId,
        provider_id: input.providerId,
        provider_service_id: input.providerServiceId,
        category_id: input.categoryId,
        status: "requested",
        timing: input.timing,
        scheduled_for: input.scheduledFor ?? null,
        address_id: input.address.id,
        location_lat: input.address.location.lat,
        location_lng: input.address.location.lng,
        notes: input.notes ?? null,
        service_price: input.priceBreakdown.servicePrice,
        customer_fee: input.priceBreakdown.customerFee,
        total_amount: input.priceBreakdown.total,
        currency: input.priceBreakdown.currency,
        provider_commission: input.priceBreakdown.providerCommission,
        provider_payout: input.priceBreakdown.providerPayout,
        country_code: input.countryCode,
      })
      .select()
      .single()
  );

  await supabase.from("notifications").insert({
    user_id: input.providerId,
    type: "new_request",
    title: "Nueva solicitud",
    body: "Tienes una nueva solicitud de servicio.",
    booking_id: bookingRow.id,
  });

  return mapBooking(bookingRow, input.address);
}

export interface BookingUpdate {
  status: BookingStatus;
  acceptedAt?: string;
  enRouteAt?: string;
  startedAt?: string;
  completedByProviderAt?: string;
  completedByCustomerAt?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
}

export async function updateBookingRemote(bookingId: string, update: BookingUpdate) {
  const patch: Record<string, unknown> = { status: update.status };
  if (update.acceptedAt) patch.accepted_at = update.acceptedAt;
  if (update.enRouteAt) patch.en_route_at = update.enRouteAt;
  if (update.startedAt) patch.started_at = update.startedAt;
  if (update.completedByProviderAt) patch.completed_by_provider_at = update.completedByProviderAt;
  if (update.completedByCustomerAt) patch.completed_by_customer_at = update.completedByCustomerAt;
  if (update.cancelledAt) patch.cancelled_at = update.cancelledAt;
  if (update.cancelledBy) patch.cancelled_by = update.cancelledBy;
  if (update.cancellationReason) patch.cancellation_reason = update.cancellationReason;
  await check(await supabase.from("bookings").update(patch).eq("id", bookingId).select().single());
}

export async function insertNotificationRemote(input: { userId: string; type: string; title: string; body: string; bookingId?: string }) {
  await supabase.from("notifications").insert({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    booking_id: input.bookingId ?? null,
  });
}

export async function insertMessageRemote(bookingId: string, senderId: string | "system", body: string): Promise<Message> {
  const row = check(
    await supabase
      .from("messages")
      .insert({ booking_id: bookingId, sender_id: senderId === "system" ? null : senderId, type: "text", body })
      .select()
      .single()
  );
  return mapMessage(row);
}

export async function markMessagesReadRemote(bookingId: string, readerId: string) {
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("booking_id", bookingId)
    .neq("sender_id", readerId)
    .is("read_at", null);
}

export async function insertReviewRemote(input: {
  bookingId: string;
  authorId: string;
  subjectId: string;
  direction: "customer_to_provider" | "provider_to_customer";
  ratings: ReviewRatings;
  comment?: string;
}): Promise<Review> {
  const row = check(
    await supabase
      .from("reviews")
      .insert({
        booking_id: input.bookingId,
        author_id: input.authorId,
        subject_id: input.subjectId,
        direction: input.direction,
        rating_overall: input.ratings.overall,
        rating_quality: input.ratings.quality ?? null,
        rating_punctuality: input.ratings.punctuality ?? null,
        rating_communication: input.ratings.communication ?? null,
        rating_professionalism: input.ratings.professionalism ?? null,
        comment: input.comment ?? null,
      })
      .select()
      .single()
  );
  return mapReview(row);
}

export async function toggleFavoriteRemote(customerId: string, providerId: string, isFavoriteNow: boolean) {
  if (isFavoriteNow) {
    await supabase.from("favorites").delete().eq("customer_id", customerId).eq("provider_id", providerId);
  } else {
    await supabase.from("favorites").insert({ customer_id: customerId, provider_id: providerId });
  }
}

export async function markNotificationsReadRemote(userId: string) {
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
}
