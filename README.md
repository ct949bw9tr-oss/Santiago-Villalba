# TaskSwift

TaskSwift is a mobile-first local-services marketplace — find and book a nearby
independent professional (barber, cleaner, handyman, tutor, makeup artist...)
almost as easily as requesting a ride. This repo is the MVP monorepo: a
customer/provider mobile app, an operations admin dashboard, a Postgres schema
designed for Supabase, and the shared business logic (fees, booking state
machine, cancellation policy, review eligibility) that both would run on in
production.

Launch market: Colombia (COP, es-CO). The data model is built to expand to
Ecuador, the US, and beyond without an app rebuild — see
[`packages/config`](./packages/config).

## Repo layout

```
apps/
  mobile/            Expo Router app (customer + provider) — React Native + TypeScript
  admin/              Next.js App Router admin dashboard
packages/
  types/              Shared TypeScript domain model (User, Booking, Payment, ...)
  config/              Countries, launch categories, fee defaults, money formatting
  business-logic/     Fee calculation, booking state machine, cancellation policy,
                       review eligibility, availability/distance — pure, unit-tested
  seed-data/           The fixture data (20 providers, 8 customers, 7 bookings) shared
                       by the SQL seed generator and the mobile app's mock backend
supabase/
  migrations/          Full Postgres schema (numbered, applies in order)
  seed.sql             Generated seed data (see "Regenerating the seed" below)
scripts/
  generate-seed.ts     Generates supabase/seed.sql from packages/config + seed-data
  db-migrate.sh        Applies every migration in supabase/migrations/ to $DATABASE_URL
  db-seed.sh           Applies supabase/seed.sql to $DATABASE_URL
```

## Requirements

- Node.js >= 18.18, [pnpm](https://pnpm.io) 9.x
- A Postgres 14+ instance (local Postgres, Docker, or a Supabase project) for
  the admin dashboard and for deploying the schema. The mobile app does **not**
  need a live database to run — see below.
- For the mobile app: the [Expo Go](https://expo.dev/go) app on your phone, or
  Xcode/Android Studio simulators. It also runs in a browser via
  `expo start --web`.

## Install

```bash
pnpm install
```

## Environment variables

```bash
cp .env.example .env
```

See [`.env.example`](./.env.example) for the full list. Nothing here is
required to run the mobile app locally (it ships with an in-memory mock
backend — see "How the mobile app runs without a backend" below). `DATABASE_URL`
is required for the admin dashboard and for applying migrations/seed data.

**Never commit `.env`. Never put secret keys (Supabase service role, payment
provider secret keys) anywhere client-side — they belong in `apps/admin` or a
future server/edge-function runtime only.**

## Database setup

Point `DATABASE_URL` at a Postgres instance (local, Docker, or a Supabase
project's connection string), then:

```bash
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/taskswift_dev
pnpm db:migrate   # applies supabase/migrations/*.sql in order
pnpm db:seed      # applies supabase/seed.sql — 5 categories, 20 services,
                  # 20 providers, 8 customers, 7 bookings spanning the full
                  # booking lifecycle (requested → accepted → in progress →
                  # completed, plus a cancellation), reviews, chat messages,
                  # and payment/transaction records
```

Both scripts are safe to re-run against a database that already has this
seed — catalog/config rows upsert, and seeded users/bookings use deterministic
IDs so re-applying doesn't create duplicates.

If you don't have Postgres installed locally, the quickest option is Docker:

```bash
docker run -d --name taskswift-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=taskswift_dev -p 5432:5432 postgres:16
```

On a real [Supabase](https://supabase.com) project, run the same migrations
via the Supabase SQL editor or `supabase db push`, and use the project's
connection string / service role key instead.

### Regenerating the seed

`supabase/seed.sql` is generated, not hand-written. If you change
`packages/config` (categories, fee rules) or `packages/seed-data` (the demo
providers/customers/bookings), regenerate it:

```bash
pnpm generate:seed
```

## Running the mobile app

```bash
pnpm mobile          # expo start
# or, to run in a browser without a simulator:
pnpm --filter @taskswift/mobile web
```

### How the mobile app runs without a backend

There's no live Supabase project wired up for this MVP, so the mobile app
ships with a small in-memory "mock backend" (`apps/mobile/src/data`) that:

- Builds realistic domain objects (users, provider profiles, bookings,
  reviews, messages...) from `packages/seed-data`, the exact same fixture
  data the SQL seed uses.
- Runs the *real* business logic from `packages/business-logic` for every
  action — fee calculation on booking creation, the booking state machine on
  every status transition, cancellation-fee calculation, review-eligibility
  checks. None of that is faked; only persistence is in-memory.
- Is exposed through a single [zustand](https://github.com/pmndrs/zustand)
  store (`apps/mobile/src/data/store.ts`) with one action per real backend
  operation (`createBooking`, `respondToRequest`, `markEnRoute`,
  `confirmCompletion`, `submitReview`, ...), so swapping in a real
  Supabase-backed client later means implementing the same interface, not
  rewriting the screens.

State resets when the app reloads — this is a local development / demo
convenience, not a production data store.

**Demo login:** the login screen has a phone/OTP flow (any 6-digit code is
accepted), plus two "quick login" shortcuts for testing both sides of the
marketplace immediately: **Santiago Villalba** (customer) and **Andrés
Ramírez** (barber/provider).

### Demo script (the full P0 loop)

1. Log in as **Santiago Villalba** (customer).
2. Search "barbero", open **Andrés Ramírez**'s profile (portfolio, reviews,
   pricing).
3. Tap **Solicitar servicio**, pick a time slot and address, review the price
   breakdown (service price + TaskSwift fee), submit.
4. Log out, log back in as **Andrés Ramírez** (provider).
5. Go to **Solicitudes**, open Santiago's request, **Aceptar**.
6. Open the chat, send a message. Go back, **Marcar en camino** →
   **Iniciar servicio** → **Marcar como completado**.
7. Check **Ganancias** — earnings reflect the (still-pending-confirmation)
   booking.
8. Switch back to customer mode, log in as Santiago, open **Reservas**, open
   the booking, **Confirmar finalización**, then **Calificar servicio**.
9. Log back in as Andrés — **Ganancias** now shows the completed payout.

## Running the admin dashboard

Requires `DATABASE_URL` (see "Database setup" above) — the admin app queries
Postgres directly from server components/server actions; there is no
client-side data fetching and no secrets reach the browser.

```bash
pnpm admin           # next dev, http://localhost:3000
```

Pages: Dashboard (GMV, platform revenue, cancellation/repeat-customer/
provider-acceptance rates), Usuarios, Proveedores (with manual identity
verification approve/reject), Reservas, Pagos, Reseñas, Disputas, Categorías,
Comisiones (per-country/category fee editing — takes effect immediately, no
app release needed).

## Tests & checks

```bash
pnpm -r run typecheck   # TypeScript across every package/app
pnpm -r run test        # business-logic unit tests (fees, booking state
                         # machine, cancellation policy, review eligibility,
                         # availability, distance) — 37 tests
pnpm --filter @taskswift/admin lint
```

## Architecture notes

- **Country/currency/payment-provider expansion** is table-driven
  (`packages/config/src/countries.ts` ↔ the `countries` /
  `payment_provider_configs` tables) — adding Ecuador or the US means adding a
  row, not shipping new app logic.
- **Fees** (customer service fee %, provider commission %, min/max) are
  per-country and optionally per-category, editable by admins at runtime
  (`platform_fees` table, `apps/admin/app/fees`).
- **Booking state machine** (`packages/business-logic/src/bookingStateMachine.ts`)
  is the single source of truth for which actor can move a booking from which
  status to which — both the mobile mock backend and (eventually) a real
  server enforce transitions through it, not ad hoc status writes.
- **Payments** are abstracted per country/provider (Wompi for Colombia at
  launch; Mercado Pago, PayU, Stripe modeled for other markets) — see
  `payment_provider_configs` and `packages/types/src/payment.ts`. No live
  payment integration is wired up in this MVP; the mobile app's checkout step
  shows a mock payment method and the price breakdown a real integration would
  use.
- **Row Level Security**: every table a client could query is covered by RLS
  policies (`supabase/migrations/0008_rls_policies.sql`) scoped to the
  authenticated user — customers/providers only ever see their own bookings,
  messages, payments, etc. Catalog data is public-read. Admin mutations run
  through a service-role connection (the admin app's `DATABASE_URL`), which
  bypasses RLS by design.

## Known limitations (MVP)

- The mobile app's data layer is in-memory (see above) — there is no live
  Supabase project connected in this environment. The schema, RLS policies,
  and seed data are all written and verified against a real Postgres
  instance, ready to point a Supabase-backed client at.
- No live payment provider is integrated; checkout shows a mocked payment
  method. Wompi (Colombia) is the intended first integration — see
  `packages/config/src/countries.ts` and `.env.example`.
- Portfolio images use placeholder URLs (no object storage wired up yet).
- Map view is not implemented; discovery is list-based with distance/rating/
  price sorting and filters (available now, verified only). `react-native-maps`
  is included as a dependency for a follow-up "Map/List toggle."
- Promo codes, business accounts, dispute resolution workflows, and
  provider-side custom-quote negotiation are modeled in the schema
  (`promo_codes`, `disputes`, `pricing_model = 'custom_quote'`) but don't have
  dedicated UI yet — P1/P2 per the build plan.
