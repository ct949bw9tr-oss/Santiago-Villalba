/**
 * One-off fix for text that got mangled (UTF-8 bytes read as Latin-1) somewhere in the
 * manual copy/paste path into Supabase's SQL editor. Regenerates UPDATE statements for
 * every accented text field from the same source-of-truth packages the original seed
 * used, so the corrected values match exactly. Run with `pnpm tsx scripts/generate-encoding-fix.ts`.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { LAUNCH_CATEGORIES } from "@taskswift/config";
import { CITY_COORDS, SEED_CUSTOMERS, SEED_PROVIDERS, customerKey, providerKey, uuidFrom } from "@taskswift/seed-data";

// Emits pure-ASCII SQL Unicode-escape string literals (U&'...\00E1...') instead of
// literal accented characters, so the file survives copy/paste through anything that
// might mis-detect its encoding along the way (which is what corrupted the original
// seed data's Spanish text in the first place).
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

const lines: string[] = ["begin;"];

for (const category of LAUNCH_CATEGORIES) {
  const categoryId = uuidFrom(`category:${category.slug}`);
  lines.push(`update categories set name = ${s(category.name)} where id = ${s(categoryId)};`);
  for (const sub of category.subcategories) {
    const subcategoryId = uuidFrom(`subcategory:${category.slug}/${sub.slug}`);
    lines.push(`update subcategories set name = ${s(sub.name)} where id = ${s(subcategoryId)};`);
    for (const service of sub.services) {
      const serviceId = uuidFrom(`service:${category.slug}/${sub.slug}/${service.slug}`);
      lines.push(`update services set name = ${s(service.name)} where id = ${s(serviceId)};`);
    }
  }
}

for (const p of SEED_PROVIDERS) {
  const key = providerKey(p);
  const userId = uuidFrom(`user:provider:${key}`);
  lines.push(`update users set first_name = ${s(p.firstName)}, last_name = ${s(p.lastName)} where id = ${s(userId)};`);
  lines.push(`update provider_profiles set headline = ${s(p.headline)}, bio = ${s(p.bio)} where id = ${s(userId)};`);
  const areaId = uuidFrom(`area:${key}`);
  lines.push(`update provider_service_areas set city = ${s(p.city)} where id = ${s(areaId)};`);
  const homeAddrId = uuidFrom(`address:provider:${key}`);
  lines.push(`update addresses set city = ${s(p.city)} where id = ${s(homeAddrId)};`);
}

for (const c of SEED_CUSTOMERS) {
  const key = customerKey(c);
  const userId = uuidFrom(`user:customer:${key}`);
  lines.push(`update users set first_name = ${s(c.firstName)}, last_name = ${s(c.lastName)} where id = ${s(userId)};`);
  const addrId = uuidFrom(`address:customer:${key}`);
  lines.push(`update addresses set city = ${s(c.city)} where id = ${s(addrId)};`);
}

lines.push("commit;");

const out = resolve(__dirname, "../supabase/fix-encoding.sql");
writeFileSync(out, lines.join("\n") + "\n");
console.log(`Wrote ${out} (${lines.length} statements)`);
