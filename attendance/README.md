# School Attendance

Multi-school SaaS for class attendance via NFC cards. Next.js (App Router,
TypeScript) + Supabase (Postgres, Auth, RLS), deployed on Vercel.

Design, API contract and roadmap: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

**Status: Phase 4 complete** — schema, tenant isolation, authentication, admin
screens, the attendance engine (one scan API for NFC readers and the web
simulator, automatic absences), and the **teacher's live class view** with
manual corrections (reason required, audited, never overwritten by card taps).
API contract: [`docs/API.md`](./docs/API.md). Next: reports and exports (Phase 5).

## What's here

| Area | Where |
|---|---|
| Database schema (all core tables), RLS, audit triggers, provisioning RPCs | `supabase/migrations/` |
| Database tests: tenant isolation, per-role access, integrity, provisioning | `supabase/tests/` |
| Session + authorization layer (every page/action goes through it) | `src/server/auth/session.ts` |
| Supabase clients: user-scoped (RLS) and admin (bypasses RLS, server-only) | `src/server/db/` |
| Pages: login, invite acceptance, school picker, admin / teacher / student homes | `src/app/` |
| Operator scripts: onboard a school, seed a demo school | `scripts/` |

## Local development

Requirements: Node 20.9+, the [Supabase CLI](https://supabase.com/docs/guides/cli) and Docker.

```bash
cd attendance
npm install
supabase start              # local Supabase; prints API URL + keys
supabase db reset           # applies supabase/migrations
cp .env.example .env.local  # fill in the URL, publishable key and secret key from `supabase status`
npm run seed:demo           # demo school with users, classes, sessions and NFC cards
npm run dev                 # http://localhost:3000
```

Demo sign-ins (password `demo-password-2026`): `admin+demo@example.com`,
`teacher1+demo@example.com`, `teacher2+demo@example.com`, `student+demo@example.com`.
Invitation emails in local dev are caught by Inbucket at http://localhost:54324.

## Onboarding a real school

```bash
npm run school:create -- --name "Colegio San José" --slug colegio-san-jose \
  --admin-email rectoria@example.edu.co --admin-name "Ana Gómez"
```

Creates the school (with its default attendance rule and simulator device)
and emails the first admin an invitation. Add `--password <pw>` to create the
account directly instead (development only). Defaults: `--timezone America/Bogota --locale es-CO`.

## Deploying (Supabase + Vercel)

1. **Supabase project** (use separate projects for staging and production):
   - `supabase link --project-ref <ref>` then `supabase db push` to apply migrations.
     No CLI (e.g. on a tablet)? Paste `supabase/setup-all.sql` into Dashboard → SQL Editor and Run once
     (regenerate it with `bash scripts/build-setup-sql.sh` after adding migrations). For an existing
     project, run only the migrations it doesn't have yet, in order.
   - Teacher invitations produce a one-time sign-in link for the admin to share, so no SMTP setup is
     needed. Set `APP_URL` (e.g. `https://your-app.vercel.app`) if links should use a fixed domain.
   - Authentication → Sign In / Providers: **disable "Allow new users to sign up"** (accounts are invite-only).
   - Authentication → URL Configuration: Site URL = your app URL; add `<app-url>/auth/confirm` to redirect URLs.
   - Authentication → Emails: paste `supabase/templates/invite.html` and `recovery.html` into the Invite and Reset Password templates.
2. **Vercel project**: import the repo, set **Root Directory = `attendance`**, and add the three variables from
   `.env.example`. `SUPABASE_SECRET_KEY` must never get a `NEXT_PUBLIC_` prefix.
3. Run `npm run school:create` from a trusted machine with the production env to onboard the first school.

## Tests

```bash
npm run lint && npm run typecheck && npm test            # app
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run test:db
```

`test:db` builds a throwaway database on any Postgres 15+ server (a small
shim stands in for Supabase's `auth` schema and roles), applies every
migration, loads a two-school fixture and runs `supabase/tests/NN_*.sql`.
CI (`.github/workflows/attendance-ci.yml`) runs both on every change under `attendance/`.

## Security rules for contributors

- **Tenant data**: every tenant table has `school_id`, `unique (school_id, id)`, and references parents with
  composite FKs `(school_id, parent_id)`. Add new tables to the lists in `supabase/tests/01_tenant_isolation.sql`.
- **Privileges**: Supabase grants new `public` tables to `anon`/`authenticated` by default. Every migration that
  creates a table must `revoke all ... from anon, authenticated`, grant only what's needed, and `enable row level security`.
- **Never trust the browser** for `school_id`, roles or user ids. Use `requireRole()` / `requireSchoolAccess()` in
  every page and Server Action; the school comes from the caller's memberships in the database.
- **Always filter by `access.school.id`** in queries: RLS allows every school a user belongs to, and one person can
  belong to several (or be admin *and* teacher in one).
- **Admin client** (`createSupabaseAdminClient`) bypasses RLS: only in server code where the tenant comes from a
  verified credential, never from input.
- Attendance and scan rows are never written directly by API users; audit and scan logs are append-only.
