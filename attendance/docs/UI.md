# EduTrack UI

The web app's presentation layer. Server logic, routes, the scan API and the
database are unchanged by the redesign; pages only changed how they render.

## Stack

- Next.js App Router, React Server Components; plain CSS (`src/app/globals.css`)
  with design tokens on `:root` (no CSS framework).
- Icons: `lucide-react`. Font: Inter via `next/font/google`.
- Charts: dependency-free SVG components (`src/components/ui/charts.tsx`),
  server-rendered.
- UI language: Spanish (`es-CO` formatting via `src/lib/ui/format.ts`).

## Design tokens (globals.css)

| Token | Use |
|---|---|
| `--navy-900` | Sidebar, NFC stage, toasts |
| `--primary` (#2f5bea) | Main accent, links, primary buttons, active nav |
| `--success` / `--warning` / `--danger` / `--violet` | Present / late / absent / excused, and alerts |
| `--bg`, `--surface`, `--border` | Page background, cards, hairlines |
| `--r-*`, `--shadow-*` | Radii (6–20px) and very soft shadows |

## Components

| Component | File |
|---|---|
| App shell: sidebar, top bar (search, notifications, school selector, account), mobile bottom nav + drawer | `src/app/s/[schoolSlug]/layout.tsx`, `src/components/shell/*` |
| Navigation per role (single source of truth) | `src/components/shell/nav.ts` |
| KPI card, status badge, avatar/person, card, tabs, empty state, skeleton, rate bar | `src/components/ui/*` |
| Confirmation modal (used by every destructive `ActionForm`) and toasts | `src/components/ui/confirm-modal.tsx`, `toast.tsx` |
| Server-action form with inline + toast feedback | `src/components/action-form.tsx` |
| NFC attendance stage + confirmation card | `src/app/s/[schoolSlug]/admin/simulator/simulator.tsx` |

## Screens → routes

| Menu | Route | Data |
|---|---|---|
| Inicio | `/s/[school]/admin` (teachers: `/teacher`, students: `/student`) | real |
| Asistencia | `/s/[school]/admin/simulator` | real (same scan API as readers) |
| Estudiantes | `/s/[school]/admin/students`, `…/students/[id]?tab=` | real |
| Clases (Clases · Cursos · Docentes) | `/admin/classes`, `/admin/courses`, `/admin/teachers` | real |
| Calendario | `/s/[school]/calendar` | real (class sessions, filtered by RLS) |
| Analytics | `/s/[school]/admin/attendance` (+ CSV export) | real |
| Configuración (Reglas · Lectores NFC) | `/admin/rules`, `/admin/devices` | real |
| Búsqueda | `/s/[school]/search?q=` | real |
| Reportes, Disciplina, Comunicación, EduTrack AI | `/reports`, `/discipline`, `/messages`, `/ai` | **Próximamente** — no tables exist yet, so these pages describe the module and never show invented data |

## Rules for new screens

- Never invent data. If a module has no backend, show an honest empty or
  "Próximamente" state.
- Pages keep calling `requireRole()` / `requireSchoolAccess()`; navigation is
  only links.
- Anything that modifies data asks for confirmation when destructive (`confirmText`
  on `ActionForm`). EduTrack AI must show a confirmation card before any write
  and run with the user's own session and permissions.
