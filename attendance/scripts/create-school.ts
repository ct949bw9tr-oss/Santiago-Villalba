// Onboard a new school and its first administrator.
//
//   npm run school:create -- --name "Colegio San José" --slug colegio-san-jose \
//     --admin-email rectoria@example.edu.co --admin-name "Ana Gómez" \
//     [--timezone America/Bogota] [--locale es-CO] [--password <pw>]
//
// Without --password the admin receives an invitation email and chooses a
// password at /account/password. With --password the account is created
// ready to use (handy for local development).

import { parseArgs } from "node:util";
import { z } from "zod";
import { adminClient, check, findOrCreateUser, isValidTimeZone } from "./lib/admin";

const argsSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug must be lowercase letters, digits and dashes").max(63),
  timezone: z.string().refine(isValidTimeZone, "unknown IANA timezone"),
  locale: z.string().min(2),
  "admin-email": z.email(),
  "admin-name": z.string().trim().min(1),
  password: z.string().min(10).optional(),
});

async function main() {
  const { values } = parseArgs({
    options: {
      name: { type: "string" },
      slug: { type: "string" },
      timezone: { type: "string", default: "America/Bogota" },
      locale: { type: "string", default: "es-CO" },
      "admin-email": { type: "string" },
      "admin-name": { type: "string" },
      password: { type: "string" },
    },
  });

  const parsed = argsSchema.safeParse(values);
  if (!parsed.success) {
    console.error(z.prettifyError(parsed.error));
    process.exit(1);
  }
  const args = parsed.data;
  const supabase = adminClient();

  const taken = check(await supabase.from("schools").select("id").eq("slug", args.slug).maybeSingle(), "Checking slug");
  if (taken) {
    console.error(`A school with slug "${args.slug}" already exists.`);
    process.exit(1);
  }

  const admin = await findOrCreateUser(supabase, {
    email: args["admin-email"],
    fullName: args["admin-name"],
    password: args.password,
  });

  const schoolId = check(
    await supabase.rpc("provision_school", {
      p_name: args.name,
      p_slug: args.slug,
      p_timezone: args.timezone,
      p_locale: args.locale,
      p_admin_user_id: admin.id,
    }),
    "Provisioning school",
  );

  console.log(`Created school "${args.name}" (${args.slug}) id=${schoolId}`);
  console.log(
    admin.invited
      ? `Invitation sent to ${args["admin-email"]}.`
      : admin.created
        ? `Admin account ${args["admin-email"]} created.`
        : `Existing account ${args["admin-email"]} added as admin.`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
