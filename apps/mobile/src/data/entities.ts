import {
  Address,
  DayOfWeek,
  PortfolioItem,
  ProviderAvailabilitySlot,
  ProviderProfile,
  ProviderService,
  ProviderServiceArea,
  User,
} from "@taskswift/types";
import {
  CITY_COORDS,
  SEED_CUSTOMERS,
  SEED_PROVIDERS,
  customerKey,
  hashInt,
  jitter,
  providerKey,
  slugify,
  uuidFrom,
} from "@taskswift/seed-data";
import { categoryIdBySlug, serviceIdByKey } from "./catalog";

const now = new Date().toISOString();

export const users: User[] = [];
export const providerProfiles: ProviderProfile[] = [];
export const providerServices: ProviderService[] = [];
export const serviceAreas: ProviderServiceArea[] = [];
export const availabilitySlots: ProviderAvailabilitySlot[] = [];
export const portfolioItems: PortfolioItem[] = [];
export const addresses: Address[] = [];

/** "First Last" -> user id, for both providers and customers */
export const userIdByName = new Map<string, string>();
/** provider user id -> the provider_services row offered by that provider (MVP: one each) */
export const providerServiceByProviderId = new Map<string, ProviderService>();
/** user id -> default address id */
export const defaultAddressIdByUserId = new Map<string, string>();

for (const p of SEED_PROVIDERS) {
  const key = providerKey(p);
  const userId = uuidFrom(`user:provider:${key}`);
  userIdByName.set(key, userId);
  const phone = `+57300${String(Math.abs(hashInt(key)) % 10000000).padStart(7, "0")}`;

  users.push({
    id: userId,
    phone,
    firstName: p.firstName,
    lastName: p.lastName,
    locale: "es-CO",
    countryCode: "CO",
    authProviders: ["phone"],
    isProvider: true,
    activeMode: "provider",
    createdAt: now,
    updatedAt: now,
  });

  const verificationState = p.verified ? "identity_verified" : "phone_verified";
  providerProfiles.push({
    id: userId,
    headline: p.headline,
    bio: p.bio,
    yearsExperience: p.years,
    languages: ["es"],
    verificationState,
    isVerified: p.verified,
    ratingAverage: p.rating,
    ratingCount: p.ratingCount,
    completedJobsCount: p.completedJobs,
    responseTimeMinutes: p.responseMinutes,
    isOnline: hashInt(key) % 3 !== 0,
    acceptsInstantRequests: true,
    travelsToCustomer: true,
    customerTravelsToProvider: false,
    offersRemoteService: false,
    countryCode: "CO",
    createdAt: now,
    updatedAt: now,
  });

  const serviceKey = `${p.category}/${p.subcategory}/${p.service}`;
  const serviceId = serviceIdByKey.get(serviceKey)!;
  const providerServiceId = uuidFrom(`provider_service:${key}`);
  const ps: ProviderService = {
    id: providerServiceId,
    providerId: userId,
    serviceId,
    pricingModel: p.pricingModel,
    price: p.price,
    currency: "COP",
    estimatedDurationMinutes: 45,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  providerServices.push(ps);
  providerServiceByProviderId.set(userId, ps);

  const center = jitter(CITY_COORDS[p.city]!, `area:${key}`);
  serviceAreas.push({
    id: uuidFrom(`area:${key}`),
    providerId: userId,
    center,
    radiusKm: 8 + (Math.abs(hashInt(key)) % 5),
    city: p.city,
    createdAt: now,
  });

  for (let day = 1; day <= 6; day++) {
    availabilitySlots.push({
      id: uuidFrom(`slot:${key}:${day}`),
      providerId: userId,
      dayOfWeek: day as DayOfWeek,
      startTime: "09:00",
      endTime: "18:00",
      isActive: true,
    });
  }

  const homeAddrId = uuidFrom(`address:provider:${key}`);
  const home = jitter(CITY_COORDS[p.city]!, `home:${key}`);
  addresses.push({
    id: homeAddrId,
    userId,
    label: "Base",
    line1: `Calle ${10 + (Math.abs(hashInt(key)) % 80)} #${(Math.abs(hashInt(key + "x")) % 40) + 1}-${(Math.abs(hashInt(key + "y")) % 90) + 1}`,
    city: p.city,
    countryCode: "CO",
    location: home,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  });
  defaultAddressIdByUserId.set(userId, homeAddrId);

  for (let i = 1; i <= 3; i++) {
    portfolioItems.push({
      id: uuidFrom(`portfolio:${key}:${i}`),
      providerId: userId,
      categoryId: categoryIdBySlug.get(p.category),
      mediaType: "image",
      mediaUrl: `https://images.taskswift.dev/portfolio/${slugify(key)}-${i}.jpg`,
      caption: `Trabajo de ${p.headline.toLowerCase()}`,
      sortOrder: i,
      createdAt: now,
    });
  }
}

for (const c of SEED_CUSTOMERS) {
  const key = customerKey(c);
  const userId = uuidFrom(`user:customer:${key}`);
  userIdByName.set(key, userId);
  const phone = `+57301${String(Math.abs(hashInt(key)) % 10000000).padStart(7, "0")}`;

  users.push({
    id: userId,
    phone,
    firstName: c.firstName,
    lastName: c.lastName,
    locale: "es-CO",
    countryCode: "CO",
    authProviders: ["phone"],
    isProvider: false,
    activeMode: "customer",
    createdAt: now,
    updatedAt: now,
  });

  const addrId = uuidFrom(`address:customer:${key}`);
  const home = jitter(CITY_COORDS[c.city]!, `chome:${key}`);
  addresses.push({
    id: addrId,
    userId,
    label: "Casa",
    line1: `Carrera ${5 + (Math.abs(hashInt(key)) % 60)} #${(Math.abs(hashInt(key + "x")) % 30) + 1}-${(Math.abs(hashInt(key + "y")) % 80) + 1}`,
    city: c.city,
    countryCode: "CO",
    location: home,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  });
  defaultAddressIdByUserId.set(userId, addrId);
}

export function userById(id: string): User | undefined {
  return users.find((u) => u.id === id);
}
export function providerProfileById(id: string): ProviderProfile | undefined {
  return providerProfiles.find((p) => p.id === id);
}
