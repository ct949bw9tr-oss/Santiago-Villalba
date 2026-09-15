import { LAUNCH_CATEGORIES } from "@taskswift/config";
import { Category, Service, Subcategory } from "@taskswift/types";
import { uuidFrom } from "@taskswift/seed-data";

const now = new Date().toISOString();

export const categories: Category[] = [];
export const subcategories: Subcategory[] = [];
export const services: Service[] = [];

/** category slug -> id */
export const categoryIdBySlug = new Map<string, string>();
/** "categorySlug/subcategorySlug" -> id */
export const subcategoryIdByKey = new Map<string, string>();
/** "categorySlug/subcategorySlug/serviceSlug" -> id */
export const serviceIdByKey = new Map<string, string>();

let categorySort = 0;
for (const category of LAUNCH_CATEGORIES) {
  const categoryId = uuidFrom(`category:${category.slug}`);
  categoryIdBySlug.set(category.slug, categoryId);
  categories.push({
    id: categoryId,
    slug: category.slug,
    name: category.name,
    nameEn: category.nameEn,
    icon: category.icon,
    sortOrder: categorySort++,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  let subSort = 0;
  for (const sub of category.subcategories) {
    const subcategoryId = uuidFrom(`subcategory:${category.slug}/${sub.slug}`);
    subcategoryIdByKey.set(`${category.slug}/${sub.slug}`, subcategoryId);
    subcategories.push({
      id: subcategoryId,
      categoryId,
      slug: sub.slug,
      name: sub.name,
      nameEn: sub.nameEn,
      sortOrder: subSort++,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    for (const service of sub.services) {
      const serviceId = uuidFrom(`service:${category.slug}/${sub.slug}/${service.slug}`);
      serviceIdByKey.set(`${category.slug}/${sub.slug}/${service.slug}`, serviceId);
      services.push({
        id: serviceId,
        subcategoryId,
        slug: service.slug,
        name: service.name,
        nameEn: service.nameEn,
        defaultDurationMinutes: service.defaultDurationMinutes,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}
