/**
 * Emits INSERT statements for a single new category (with its subcategories/services)
 * from packages/config's LAUNCH_CATEGORIES, so a newly-added category can be pushed to
 * an already-seeded Supabase project without re-running the full seed. Run with
 * `pnpm tsx scripts/generate-new-category.ts <category-slug>`.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { LAUNCH_CATEGORIES } from "@taskswift/config";
import { uuidFrom } from "@taskswift/seed-data";

function s(value: string): string {
  let out = "";
  let needsUnicode = false;
  for (const ch of value) {
    const code = ch.codePointAt(0)!;
    if (ch === "'") {
      out += "''";
    } else if (code > 0x7e) {
      needsUnicode = true;
      out += code > 0xffff ? `\\+${code.toString(16).padStart(6, "0")}` : `\\${code.toString(16).padStart(4, "0")}`;
    } else {
      out += ch;
    }
  }
  return needsUnicode ? `U&'${out}'` : `'${out}'`;
}

const targetSlug = process.argv[2];
if (!targetSlug) {
  console.error("Usage: tsx scripts/generate-new-category.ts <category-slug>");
  process.exit(1);
}
const category = LAUNCH_CATEGORIES.find((c) => c.slug === targetSlug);
if (!category) {
  console.error(`No category with slug "${targetSlug}" in LAUNCH_CATEGORIES`);
  process.exit(1);
}

const lines: string[] = ["begin;"];
const categoryId = uuidFrom(`category:${category.slug}`);
const sortOrder = LAUNCH_CATEGORIES.findIndex((c) => c.slug === category.slug);
lines.push(
  `insert into categories (id, slug, name, name_en, icon, sort_order, is_active) values (${s(categoryId)}, ${s(category.slug)}, ${s(category.name)}, ${s(category.nameEn)}, ${s(category.icon)}, ${sortOrder}, true) on conflict (id) do nothing;`
);

category.subcategories.forEach((sub, subIndex) => {
  const subcategoryId = uuidFrom(`subcategory:${category.slug}/${sub.slug}`);
  lines.push(
    `insert into subcategories (id, category_id, slug, name, name_en, sort_order, is_active) values (${s(subcategoryId)}, ${s(categoryId)}, ${s(sub.slug)}, ${s(sub.name)}, ${s(sub.nameEn)}, ${subIndex}, true) on conflict (id) do nothing;`
  );
  sub.services.forEach((service) => {
    const serviceId = uuidFrom(`service:${category.slug}/${sub.slug}/${service.slug}`);
    lines.push(
      `insert into services (id, subcategory_id, slug, name, name_en, default_duration_minutes, is_active) values (${s(serviceId)}, ${s(subcategoryId)}, ${s(service.slug)}, ${s(service.name)}, ${s(service.nameEn)}, ${service.defaultDurationMinutes ?? "null"}, true) on conflict (id) do nothing;`
    );
  });
});

lines.push("commit;");

const out = resolve(__dirname, `../supabase/new-category-${targetSlug}.sql`);
writeFileSync(out, lines.join("\n") + "\n");
console.log(`Wrote ${out} (${lines.length} statements)`);
