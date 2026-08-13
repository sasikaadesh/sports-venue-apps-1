# CLAUDE.md

Standing instructions for Claude Code. Read this at the start of every session and follow it on every task.

## Project

A sports-court booking web app. Users browse courts (Cricket, Tennis, Table Tennis, etc.), check availability by date and time slot, book a slot, and pay via PayHere. Admins manage courts, court types, time-slot templates, images, and slot blocking through an admin panel. Built for a school first; may be sold to other clubs later, so keep code clean and multi-tenant-friendly where cheap to do so (but do NOT build full multi-tenancy in v1).

## Tech stack

- **Framework:** Next.js (App Router) + TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui + lucide-react icons
- **Database:** Supabase (Postgres)
- **Auth:** Supabase Auth (email + optional social), with an admin/user role
- **File storage:** Supabase Storage (court images)
- **ORM/migrations:** Prisma
- **Forms/validation:** React Hook Form + Zod
- **Payments:** PayHere JavaScript SDK (onsite checkout)
- **Hosting:** Vercel

## Commands

```bash
npm run dev            # local dev server
npm run build          # production build
npm run lint           # eslint
npm run format         # prettier — format the whole project
npm run format:check   # prettier — list unformatted files, change nothing
npx prisma migrate dev # create/apply a migration (uses DIRECT_URL)
npx prisma studio      # inspect the DB
```

## Project structure (target)

```
/app            # routes: public site, /admin, /api (route handlers)
/components     # UI components (shadcn/ui-based)
/lib           # server logic: booking service, payhere, supabase clients, auth
/prisma         # schema.prisma + migrations
/docs           # PRD.md, ARCHITECTURE.md, DESIGN.md, TASKS.md
```

## Critical rules — never violate these

**Payments**

- The PayHere **merchant secret is server-only**. Never import it into, or expose it to, client code.
- Generate the PayHere **hash on the server** (a route handler / server action).
- A booking is confirmed **only** by the server-to-server `notify_url` webhook, after verifying `md5sig`. **Never** confirm a booking based on the `return_url` redirect — the redirect can be spoofed.

**Bookings**

- Every booking write goes through the single booking service in `/lib`. No ad-hoc inserts from routes/components.
- Enforce the DB **unique constraint on `(court_id, booking_date, slot_id)`** — this is the anti-double-booking guarantee. Booking logic must handle the constraint-violation error gracefully (slot just taken).
- A new booking starts as `pending`; it becomes `confirmed` only on verified payment. A cleanup job releases `pending` bookings that were never paid.
- Admin slot blocks are bookings with status `blocked`, owned by the admin.

**Auth / security**

- Authorization is enforced in **server actions/route handlers AND Postgres Row Level Security** — never rely on Next.js middleware alone (ref: CVE-2025-29927).
- Admin-only operations must check the user's role server-side, not just hide UI.

**Images**

- Use the Next.js `<Image>` component, never raw `<img>`. Whitelist `images.unsplash.com` (dev placeholders) and the Supabase storage domain in `next.config.js`.

## Performance

- Vercel functions are pinned to **`bom1` (Mumbai)** in `vercel.json`, the same AWS region as the Supabase database. Do not remove this — the default (`iad1`) puts ~220 ms of network on every single query.
- Catalogue reads (courts, court types, slot templates) go through `lib/catalogue.ts`, which is cached and tag-invalidated. Any new admin action that writes one of those must call `revalidateCatalogue()`.
- **Availability is never cached**, anywhere. See `docs/ARCHITECTURE.md` → "What is cached, and what must never be".

## Environment variables

Server-only (never `NEXT_PUBLIC_`): `DATABASE_URL`, `DIRECT_URL`, `PAYHERE_MERCHANT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`.
Prisma uses the **pooled** connection for `DATABASE_URL` (runtime) and the **direct** connection for `DIRECT_URL` (migrations). See `.env.example`.

## Design

Follow the **`brand` skill** (`.claude/skills/brand/SKILL.md`) for the visual identity and `docs/DESIGN.md` for how it is applied here. Direction: **St. Sebastian's College — traditional/institutional, green & gold**.

- **Never hardcode a colour.** Every colour in the app resolves from the palette block at the top of `app/globals.css`; that block, `public/logo.png` and `lib/brand.ts` are the entire rebrand surface. The only sanctioned exceptions are `lib/email/templates.tsx` (an inbox cannot resolve a CSS variable) and `lib/reports/bookings-pdf.tsx` (paper), both of which mirror the palette and say so.
- Elegant serif headings (Lora) over Inter body — the serif _is_ the brand, do not swap it for a sans.
- Gold is a _rare_ accent: buttons for the single most important action, and the footer hairline. Do not flood the page with it.
- Theme shadcn/ui with the project's tokens — do not ship default shadcn styling. No purple/blue gradients, no emoji icons, no everything-centered layouts.

## Workflow

- Build **one phase at a time** per `docs/TASKS.md`. Do not scaffold the whole app in one pass.
- After each working piece, stop so it can be verified, then commit to git.
- Treat the booking and payment phases as high-risk — build them incrementally and test each step.
- When unsure about product scope, consult `docs/PRD.md`; when unsure about a flow or the data model, consult `docs/ARCHITECTURE.md`.

## Claude Code tooling

Three helpers are configured in `.claude/`. They are tooling only — none of them affect application behaviour. `.claude/README.md` explains each one in full (it also serves as the comment header for `.claude/settings.json`, which is strict JSON and cannot carry comments of its own).

- **Prettier auto-format hook** — after every Write/Edit, `.claude/hooks/format-with-prettier.mjs` formats the edited file. Config: `prettier.config.mjs`, `.prettierignore`. Prettier loads `prettier-plugin-tailwindcss`, which sorts Tailwind class lists in `className` and in `cn()`/`cva()`/`clsx()` calls.
- **`code-reviewer` sub-agent** (`.claude/agents/code-reviewer.md`) — read-only review of changed code against the payment, authorization and booking rules above. Ask for it by name; it never edits.
- **`brand` skill** (`.claude/skills/brand/SKILL.md`) — loads automatically for UI work so new components stay on-brand. It is the source of truth for the visual identity (currently St. Sebastian's College, Moratuwa — green & gold); `docs/DESIGN.md` records how that identity is applied in this codebase. Keep exactly one brand skill.
