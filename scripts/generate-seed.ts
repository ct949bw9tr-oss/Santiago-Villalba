/**
 * Generates supabase/seed.sql from the shared config (@taskswift/config) and fixture
 * data (@taskswift/seed-data) so the database seed never drifts from the category
 * catalog / fee rules / demo data the apps use. Run with `pnpm generate:seed`, then
 * apply with `pnpm db:seed` (or paste into the Supabase SQL editor).
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { COUNTRIES, DEFAULT_FEE_RULES, LAUNCH_CATEGORIES } from "@taskswift/config";
import { calculatePriceBreakdown } from "@taskswift/business-logic";
import {
  CITY_COORDS,
  SEED_BOOKINGS,
  SEED_CUSTOMERS,
  SEED_PROVIDERS,
  customerKey,
  hashInt,
  jitter,
  providerKey,
  slugify,
  uuidFrom,
} from "@taskswift/seed-data";

// ---------- SQL string helpers ----------

function s(value: string | null | undefined): string {
  if (value === null || value === undefined) return "null";
  return `'${value.replace(/'/g, "''")}'`;
}

function arr(values: string[]): string {
  if (values.length === 0) return "'{}'";
  return `ARRAY[${values.map((v) => s(v)).join(",")}]::text[]`;
}

function n(value: number | null | undefined): string {
  return value === null || value === undefined ? "null" : String(value);
}

const lines: string[] = [];
function emit(sql: string) {
  lines.push(sql.trim());
}
function section(title: string) {
  emit(`\n-- ===== ${title} =====`);
}

// ---------- 0. cleanup: append-only tables have no natural unique key, so we delete
// anything scoped to our deterministic seed IDs before inserting, making this script
// safe to re-run against a database that already has this seed ----------

section("Cleanup (idempotency): remove previously-seeded append-only rows before re-inserting");
const seedProviderIds = SEED_PROVIDERS.map((p) => uuidFrom(`user:provider:${providerKey(p)}`));
const seedBookingIds = SEED_BOOKINGS.map((b) => uuidFrom(`booking:${b.key}`));
const bookingIdArray = `ARRAY[${seedBookingIds.map((id) => s(id)).join(",")}]::uuid[]`;
const providerIdArray = `ARRAY[${seedProviderIds.map((id) => s(id)).join(",")}]::uuid[]`;
emit(`delete from booking_status_history where booking_id = any(${bookingIdArray});`);
emit(`delete from messages where booking_id = any(${bookingIdArray});`);
emit(`delete from notifications where booking_id = any(${bookingIdArray});`);
emit(`delete from transactions where booking_id = any(${bookingIdArray});`);
emit(`delete from portfolio_items where provider_id = any(${providerIdArray});`);
emit(`delete from provider_availability_slots where provider_id = any(${providerIdArray});`);
emit(`delete from provider_service_areas where provider_id = any(${providerIdArray});`);

// ---------- 1. countries / currencies / payment providers / app settings ----------

section("Countries, currencies, payment providers, app settings");
for (const country of Object.values(COUNTRIES)) {
  emit(`insert into countries (country_code, name, currency_code, default_locale, supported_locales, is_live, cities, legal)
values (${s(country.countryCode)}, ${s(country.name)}, ${s(country.currency)}, ${s(country.defaultLocale)}, ${arr(country.supportedLocales)}, ${country.isLive}, ${arr(country.cities)}, ${s(JSON.stringify(country.legal))}::jsonb)
on conflict (country_code) do update set name = excluded.name, is_live = excluded.is_live;`);
}

const currencySeen = new Set<string>();
for (const country of Object.values(COUNTRIES)) {
  if (currencySeen.has(country.currency)) continue;
  currencySeen.add(country.currency);
  emit(`insert into currencies (currency_code, name, is_zero_decimal) values (${s(country.currency)}, ${s(country.currency)}, ${country.currency === "COP"}) on conflict (currency_code) do nothing;`);
}

for (const country of Object.values(COUNTRIES)) {
  for (const p of country.paymentProviders) {
    emit(`insert into payment_provider_configs (country_code, provider, enabled, supports_cards, supports_bank_transfer, supports_cash, public_key_env_var)
values (${s(country.countryCode)}, ${s(p.provider)}, ${p.enabled}, ${p.supportsCards}, ${p.supportsBankTransfer}, ${p.supportsCash}, ${s(p.publicKeyEnvVar)})
on conflict (country_code, provider) do update set enabled = excluded.enabled;`);
  }
}

emit(`insert into app_settings (key, value, description) values
  ('instant_request_radius_km', '5', 'Default search radius for "need it now" dispatch'),
  ('instant_request_timeout_minutes', '15', 'How long a "now" request stays open before expiring'),
  ('cancellation_free_window_minutes', '60', 'Minutes before scheduled time a customer can cancel for free'),
  ('cancellation_late_fee_percent', '20', 'Late cancellation fee as % of service price')
on conflict (key) do nothing;`);

const adminId = uuidFrom("admin:ops@taskswift.co");
emit(`insert into admin_users (id, email, first_name, last_name, role) values
  (${s(adminId)}, ${s("ops@taskswift.co")}, ${s("TaskSwift")}, ${s("Operations")}, ${s("super_admin")})
on conflict (email) do nothing;`);

// ---------- 2. catalog ----------

section("Categories, subcategories, services");
const categoryIds = new Map<string, string>();
const subcategoryIds = new Map<string, string>();
const serviceIds = new Map<string, string>(); // key: category/subcategory/service

let categorySort = 0;
for (const category of LAUNCH_CATEGORIES) {
  const categoryId = uuidFrom(`category:${category.slug}`);
  categoryIds.set(category.slug, categoryId);
  emit(`insert into categories (id, slug, name, name_en, icon, sort_order) values
  (${s(categoryId)}, ${s(category.slug)}, ${s(category.name)}, ${s(category.nameEn)}, ${s(category.icon)}, ${categorySort++})
on conflict (slug) do update set name = excluded.name;`);

  let subSort = 0;
  for (const sub of category.subcategories) {
    const subcategoryId = uuidFrom(`subcategory:${category.slug}/${sub.slug}`);
    subcategoryIds.set(`${category.slug}/${sub.slug}`, subcategoryId);
    emit(`insert into subcategories (id, category_id, slug, name, name_en, sort_order) values
  (${s(subcategoryId)}, ${s(categoryId)}, ${s(sub.slug)}, ${s(sub.name)}, ${s(sub.nameEn)}, ${subSort++})
on conflict (category_id, slug) do update set name = excluded.name;`);

    for (const service of sub.services) {
      const serviceId = uuidFrom(`service:${category.slug}/${sub.slug}/${service.slug}`);
      serviceIds.set(`${category.slug}/${sub.slug}/${service.slug}`, serviceId);
      emit(`insert into services (id, subcategory_id, slug, name, name_en, default_duration_minutes) values
  (${s(serviceId)}, ${s(subcategoryId)}, ${s(service.slug)}, ${s(service.name)}, ${s(service.nameEn)}, ${n(service.defaultDurationMinutes)})
on conflict (subcategory_id, slug) do update set name = excluded.name;`);
    }
  }
}

section("Platform fees");
for (const rule of DEFAULT_FEE_RULES) {
  emit(`insert into platform_fees (country_code, category_id, customer_fee_percent, provider_commission_percent, min_fee_amount, max_fee_amount) values
  (${s(rule.countryCode)}, null, ${rule.customerFeePercent}, ${rule.providerCommissionPercent}, ${rule.minFeeAmount}, ${n(rule.maxFeeAmount)})
on conflict (country_code, category_id) do update set customer_fee_percent = excluded.customer_fee_percent;`);
}

// ---------- 3. providers & customers ----------

const providerUserIds = new Map<string, string>(); // "firstName lastName" -> id
const customerUserIds = new Map<string, string>();
const customerAddressIds = new Map<string, string>();
const providerServiceIds = new Map<string, string>(); // provider full name -> provider_services.id

section("Users: providers");
for (const p of SEED_PROVIDERS) {
  const key = providerKey(p);
  const userId = uuidFrom(`user:provider:${key}`);
  providerUserIds.set(key, userId);
  const phone = `+57300${String(Math.abs(hashInt(key)) % 10000000).padStart(7, "0")}`;
  emit(`insert into users (id, phone, first_name, last_name, locale, country_code, auth_providers, is_provider, active_mode) values
  (${s(userId)}, ${s(phone)}, ${s(p.firstName)}, ${s(p.lastName)}, ${s("es-CO")}, ${s("CO")}, ${arr(["phone"])}, true, ${s("provider")})
on conflict (id) do nothing;`);

  const verificationState = p.verified ? "identity_verified" : "phone_verified";
  emit(`insert into provider_verifications (provider_id, state, document_type, reviewed_by, reviewed_at) values
  (${s(userId)}, ${s(verificationState)}, ${p.verified ? s("cedula") : "null"}, ${p.verified ? s(adminId) : "null"}, ${p.verified ? "now()" : "null"});`);

  emit(`insert into provider_profiles (id, headline, bio, years_experience, languages, verification_state, is_verified, rating_average, rating_count, completed_jobs_count, response_time_minutes, is_online, accepts_instant_requests, travels_to_customer, customer_travels_to_provider, offers_remote_service, country_code) values
  (${s(userId)}, ${s(p.headline)}, ${s(p.bio)}, ${p.years}, ${arr(["es"])}, ${s(verificationState)}, ${p.verified}, ${p.rating}, ${p.ratingCount}, ${p.completedJobs}, ${p.responseMinutes}, ${hashInt(key) % 3 !== 0}, true, true, false, false, ${s("CO")})
on conflict (id) do nothing;`);

  const serviceKey = `${p.category}/${p.subcategory}/${p.service}`;
  const serviceId = serviceIds.get(serviceKey);
  if (!serviceId) throw new Error(`Unknown service ${serviceKey} for provider ${key}`);
  const providerServiceId = uuidFrom(`provider_service:${key}`);
  providerServiceIds.set(key, providerServiceId);
  emit(`insert into provider_services (id, provider_id, service_id, pricing_model, price, currency, estimated_duration_minutes) values
  (${s(providerServiceId)}, ${s(userId)}, ${s(serviceId)}, ${s(p.pricingModel)}, ${n(p.price)}, ${s("COP")}, 45)
on conflict (provider_id, service_id) do nothing;`);

  const center = jitter(CITY_COORDS[p.city]!, `area:${key}`);
  emit(`insert into provider_service_areas (provider_id, center_lat, center_lng, radius_km, city) values
  (${s(userId)}, ${center.lat}, ${center.lng}, ${8 + (Math.abs(hashInt(key)) % 5)}, ${s(p.city)});`);

  for (let day = 1; day <= 6; day++) {
    emit(`insert into provider_availability_slots (provider_id, day_of_week, start_time, end_time) values (${s(userId)}, ${day}, '09:00', '18:00');`);
  }

  const homeAddrId = uuidFrom(`address:provider:${key}`);
  const home = jitter(CITY_COORDS[p.city]!, `home:${key}`);
  emit(`insert into addresses (id, user_id, label, line1, city, country_code, lat, lng, is_default) values
  (${s(homeAddrId)}, ${s(userId)}, ${s("Base")}, ${s(`Calle ${10 + (Math.abs(hashInt(key)) % 80)} #${(Math.abs(hashInt(key + "x")) % 40) + 1}-${(Math.abs(hashInt(key + "y")) % 90) + 1}`)}, ${s(p.city)}, ${s("CO")}, ${home.lat}, ${home.lng}, true)
on conflict (id) do nothing;`);

  for (let i = 1; i <= 2; i++) {
    emit(`insert into portfolio_items (provider_id, category_id, media_type, media_url, caption, sort_order) values
  (${s(userId)}, ${s(categoryIds.get(p.category)!)}, ${s("image")}, ${s(`https://images.taskswift.dev/portfolio/${slugify(key)}-${i}.jpg`)}, ${s(`Trabajo de ${p.headline.toLowerCase()}`)}, ${i});`);
  }
}

section("Users: customers");
for (const c of SEED_CUSTOMERS) {
  const key = customerKey(c);
  const userId = uuidFrom(`user:customer:${key}`);
  customerUserIds.set(key, userId);
  const phone = `+57301${String(Math.abs(hashInt(key)) % 10000000).padStart(7, "0")}`;
  emit(`insert into users (id, phone, first_name, last_name, locale, country_code, auth_providers, is_provider, active_mode) values
  (${s(userId)}, ${s(phone)}, ${s(c.firstName)}, ${s(c.lastName)}, ${s("es-CO")}, ${s("CO")}, ${arr(["phone"])}, false, ${s("customer")})
on conflict (id) do nothing;`);

  const addrId = uuidFrom(`address:customer:${key}`);
  customerAddressIds.set(key, addrId);
  const home = jitter(CITY_COORDS[c.city]!, `chome:${key}`);
  emit(`insert into addresses (id, user_id, label, line1, city, country_code, lat, lng, is_default) values
  (${s(addrId)}, ${s(userId)}, ${s("Casa")}, ${s(`Carrera ${5 + (Math.abs(hashInt(key)) % 60)} #${(Math.abs(hashInt(key + "x")) % 30) + 1}-${(Math.abs(hashInt(key + "y")) % 80) + 1}`)}, ${s(c.city)}, ${s("CO")}, ${home.lat}, ${home.lng}, true)
on conflict (id) do nothing;`);
}

// ---------- 4. favorites ----------

section("Favorites");
emit(`insert into favorites (customer_id, provider_id) values
  (${s(customerUserIds.get("Santiago Villalba")!)}, ${s(providerUserIds.get("Andrés Ramírez")!)}),
  (${s(customerUserIds.get("Juan Pablo Duarte")!)}, ${s(providerUserIds.get("Valentina Morales")!)})
on conflict do nothing;`);

// ---------- 5. bookings across the full lifecycle ----------

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

section("Service requests, bookings, status history, payments, reviews, messages, notifications");
for (const b of SEED_BOOKINGS) {
  const customerId = customerUserIds.get(b.customer)!;
  const providerId = providerUserIds.get(b.provider)!;
  const providerSeed = SEED_PROVIDERS.find((p) => providerKey(p) === b.provider)!;
  const providerServiceId = providerServiceIds.get(b.provider)!;
  const categoryId = categoryIds.get(providerSeed.category)!;
  const addressId = customerAddressIds.get(b.customer)!;
  const custHome = CITY_COORDS[SEED_CUSTOMERS.find((c) => customerKey(c) === b.customer)!.city]!;

  const servicePrice = providerSeed.price ?? 60000; // custom_quote placeholder before provider quotes
  const breakdown = calculatePriceBreakdown({ servicePrice, currency: "COP", countryCode: "CO" });

  const requestId = uuidFrom(`request:${b.key}`);
  const bookingId = uuidFrom(`booking:${b.key}`);
  const scheduledFor = b.timing === "scheduled" ? `now() + interval '${b.daysFromNow} days'` : "null";
  const createdAt = `now() + interval '${b.daysFromNow - 1} days'`;

  emit(`insert into service_requests (id, customer_id, provider_id, provider_service_id, timing, scheduled_for, address_id, location_lat, location_lng, notes, pricing_model, service_price, customer_fee, total_amount, currency, provider_commission, provider_payout, created_at) values
  (${s(requestId)}, ${s(customerId)}, ${s(providerId)}, ${s(providerServiceId)}, ${s(b.timing)}, ${scheduledFor}, ${s(addressId)}, ${custHome.lat}, ${custHome.lng}, ${s("Generado por datos de prueba de TaskSwift")}, ${s(providerSeed.pricingModel)}, ${breakdown.servicePrice}, ${breakdown.customerFee}, ${breakdown.total}, ${s("COP")}, ${breakdown.providerCommission}, ${breakdown.providerPayout}, ${createdAt})
on conflict (id) do nothing;`);

  const reachedIndex = STATUS_ORDER.indexOf(b.status === "cancelled_customer" ? "accepted" : b.status);
  const acceptedAt = reachedIndex >= STATUS_ORDER.indexOf("accepted") ? createdAt : "null";
  const startedAt = reachedIndex >= STATUS_ORDER.indexOf("in_progress") ? createdAt : "null";
  const completedProviderAt = b.status === "completed" ? createdAt : "null";
  const completedCustomerAt = b.status === "completed" ? createdAt : "null";
  const cancelledAt = b.status === "cancelled_customer" ? createdAt : "null";

  emit(`insert into bookings (id, request_id, customer_id, provider_id, provider_service_id, category_id, status, timing, scheduled_for, address_id, location_lat, location_lng, notes, service_price, customer_fee, total_amount, currency, provider_commission, provider_payout, country_code, accepted_at, started_at, completed_by_provider_at, completed_by_customer_at, cancelled_at, cancelled_by, cancellation_reason, created_at) values
  (${s(bookingId)}, ${s(requestId)}, ${s(customerId)}, ${s(providerId)}, ${s(providerServiceId)}, ${s(categoryId)}, ${s(b.status)}, ${s(b.timing)}, ${scheduledFor}, ${s(addressId)}, ${custHome.lat}, ${custHome.lng}, ${s("Generado por datos de prueba de TaskSwift")}, ${breakdown.servicePrice}, ${breakdown.customerFee}, ${breakdown.total}, ${s("COP")}, ${breakdown.providerCommission}, ${breakdown.providerPayout}, ${s("CO")}, ${acceptedAt}, ${startedAt}, ${completedProviderAt}, ${completedCustomerAt}, ${cancelledAt}, ${b.status === "cancelled_customer" ? s(customerId) : "null"}, ${b.status === "cancelled_customer" ? s("El cliente canceló el servicio") : "null"}, ${createdAt})
on conflict (id) do nothing;`);

  emit(`insert into booking_status_history (booking_id, from_status, to_status, changed_by, created_at) values (${s(bookingId)}, null, 'requested', ${s(customerId)}, ${createdAt});`);
  if (b.status !== "requested") {
    emit(`insert into booking_status_history (booking_id, from_status, to_status, changed_by, created_at) values (${s(bookingId)}, 'requested', 'pending_provider', ${s(providerId)}, ${createdAt});`);
  }
  if (["accepted", "in_progress", "completed", "cancelled_customer"].includes(b.status)) {
    emit(`insert into booking_status_history (booking_id, from_status, to_status, changed_by, created_at) values (${s(bookingId)}, 'pending_provider', 'accepted', ${s(providerId)}, ${createdAt});`);
  }
  if (["in_progress", "completed"].includes(b.status)) {
    emit(`insert into booking_status_history (booking_id, from_status, to_status, changed_by, created_at) values (${s(bookingId)}, 'accepted', 'in_progress', ${s(providerId)}, ${createdAt});`);
  }
  if (b.status === "completed") {
    emit(`insert into booking_status_history (booking_id, from_status, to_status, changed_by, created_at) values (${s(bookingId)}, 'in_progress', 'awaiting_completion_confirmation', ${s(providerId)}, ${createdAt});`);
    emit(`insert into booking_status_history (booking_id, from_status, to_status, changed_by, created_at) values (${s(bookingId)}, 'awaiting_completion_confirmation', 'completed', ${s(customerId)}, ${createdAt});`);
  }
  if (b.status === "cancelled_customer") {
    emit(`insert into booking_status_history (booking_id, from_status, to_status, changed_by, created_at) values (${s(bookingId)}, 'accepted', 'cancelled_customer', ${s(customerId)}, ${createdAt});`);
  }

  if (b.status === "completed") {
    const paymentMethodId = uuidFrom(`pm:${b.customer}`);
    emit(`insert into payment_methods (id, user_id, type, provider, provider_token, last4, brand, is_default) values
  (${s(paymentMethodId)}, ${s(customerId)}, ${s("mock")}, ${s("mock")}, ${s(`mock_tok_${slugify(b.customer)}`)}, ${s("4242")}, ${s("Visa")}, true)
on conflict (id) do nothing;`);

    const paymentId = uuidFrom(`payment:${b.key}`);
    emit(`insert into payments (id, booking_id, customer_id, payment_method_id, status, amount, currency, provider_reference, authorized_at, captured_at) values
  (${s(paymentId)}, ${s(bookingId)}, ${s(customerId)}, ${s(paymentMethodId)}, ${s("completed")}, ${breakdown.total}, ${s("COP")}, ${s(`mock_ref_${b.key}`)}, ${createdAt}, ${createdAt})
on conflict (id) do nothing;`);

    emit(`insert into transactions (booking_id, payment_id, type, amount, currency, related_user_id, created_at) values
  (${s(bookingId)}, ${s(paymentId)}, ${s("charge")}, ${breakdown.total}, ${s("COP")}, ${s(customerId)}, ${createdAt}),
  (${s(bookingId)}, ${s(paymentId)}, ${s("platform_fee")}, ${breakdown.customerFee}, ${s("COP")}, ${s(customerId)}, ${createdAt}),
  (${s(bookingId)}, ${s(paymentId)}, ${s("provider_payout")}, ${breakdown.providerPayout}, ${s("COP")}, ${s(providerId)}, ${createdAt});`);

    emit(`insert into notifications (user_id, type, title, body, booking_id) values
  (${s(customerId)}, ${s("payment_processed")}, ${s("Pago procesado")}, ${s(`Tu pago de $${breakdown.total.toLocaleString("es-CO")} COP fue procesado con éxito.`)}, ${s(bookingId)}),
  (${s(providerId)}, ${s("payout_sent")}, ${s("Ganancia disponible")}, ${s(`Recibiste $${breakdown.providerPayout.toLocaleString("es-CO")} COP por un servicio completado.`)}, ${s(bookingId)});`);
  }

  if (b.withReview) {
    emit(`insert into reviews (booking_id, author_id, subject_id, direction, rating_overall, rating_quality, rating_punctuality, rating_communication, rating_professionalism, comment) values
  (${s(bookingId)}, ${s(customerId)}, ${s(providerId)}, ${s("customer_to_provider")}, 5, 5, 5, 5, 5, ${s(`Excelente servicio de ${providerSeed.headline.toLowerCase()}, muy recomendado!`)})
on conflict (booking_id, author_id, direction) do nothing;`);
  }

  if (b.withChat) {
    emit(`insert into messages (booking_id, sender_id, type, body, created_at) values
  (${s(bookingId)}, null, ${s("system")}, ${s(`${providerSeed.firstName} aceptó tu solicitud.`)}, ${createdAt}),
  (${s(bookingId)}, ${s(customerId)}, ${s("text")}, ${s("¡Hola! Confirmo la dirección para el servicio.")}, ${createdAt}),
  (${s(bookingId)}, ${s(providerId)}, ${s("text")}, ${s("¡Perfecto! Ahí estaré a la hora acordada.")}, ${createdAt});`);
  }

  if (["requested", "pending_provider"].includes(b.status)) {
    emit(`insert into notifications (user_id, type, title, body, booking_id) values
  (${s(providerId)}, ${s("new_request")}, ${s("Nueva solicitud")}, ${s(`${SEED_CUSTOMERS.find((c) => customerKey(c) === b.customer)!.firstName} solicitó tu servicio.`)}, ${s(bookingId)});`);
  }
}

// ---------- write file ----------

const header = `-- TaskSwift seed data
-- Generated by scripts/generate-seed.ts — do not hand-edit, regenerate with \`pnpm generate:seed\`.
-- Safe to re-run: catalog/config rows upsert, seed users/bookings use deterministic
-- UUIDs and skip on conflict (append-only child rows are deleted and re-inserted).

begin;
`;
const footer = `\ncommit;\n`;

writeFileSync(resolve(__dirname, "../supabase/seed.sql"), header + lines.join("\n\n") + footer);
console.log(`Wrote supabase/seed.sql (${lines.length} statements)`);
