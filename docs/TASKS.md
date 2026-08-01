# TASKS — Build Plan

Build one phase at a time. Finish and verify a phase (its "Done when") before starting the next. Commit after each working piece.

## Phase 0 — Accounts & tools (do outside the codebase)
- [ ] PayHere **sandbox** account + domain/app registered (start early — approval takes time)
- [ ] Supabase project created; pooled + direct connection strings and keys saved
- [ ] Node LTS, GitHub repo, Vercel account
- **Done when:** all accounts exist and keys are saved.

## Phase 1 — Scaffold
- [ ] `create-next-app` (TypeScript, Tailwind, App Router, ESLint)
- [ ] Init shadcn/ui + lucide-react
- [ ] Install & init Prisma; wire `DATABASE_URL` (pooled) + `DIRECT_URL` (direct)
- [ ] `.env.local` (real) and `.env.example` (documented, committed)
- [ ] git init, first commit, push
- **Done when:** dev server runs and shows a page; repo is on GitHub.

## Phase 2 — Foundation docs
- [ ] Add CLAUDE.md, PRD.md, ARCHITECTURE.md, DESIGN.md, TASKS.md to the repo
- **Done when:** docs are in the repo (this set).

## Phase 3 — Data model & migrations
- [ ] Prisma schema per ARCHITECTURE.md (Users, CourtType, Court, SlotTemplate, Booking, Payment)
- [ ] Add the **UNIQUE (courtId, bookingDate, slotId)** constraint
- [ ] Run migration; confirm tables in Supabase
- **Done when:** tables exist and the unique constraint is enforced.

## Phase 4 — Auth & roles
- [x] Supabase Auth: signup/login
- [x] user vs admin role; server-side role checks
- [x] RLS policies (own bookings for users; full access for admins)
- **Done when:** you can register, log in, and role gates work (verified, not just UI-hidden).
- Promote an account: `npm run make-admin -- you@example.com`

## Phase 5 — Admin panel
- [x] CRUD: courts (with image upload to Supabase Storage), court types + player options
- [x] Slot templates per court
- [x] Block slots; view/manage all bookings
- **Done when:** an admin can create a real court + slots with zero code.
- Storage bucket `court-images` is created by migration — no manual dashboard setup.

## Phase 6 — Public site
- [x] Landing page + low clean hero (per DESIGN.md)
- [x] Court thumbnail grid + court details pages
- [x] Availability view (court + date → open slots)
- **Done when:** visitors can browse admin-created courts and see availability.
- Hero booking bar is court + date for now; Phase 7 adds slot + players into the same container.

## Phase 7 — Booking flow
- [x] Hero booking dropdown (court → date → slot → duration → players)
- [x] Player options driven by CourtType
- [x] Booking service creates `pending` hold; unique constraint blocks double-booking
- **Done when:** a user can reserve a slot; two users cannot grab the same one.
- Multi-hour bookings landed here: migration `20260722120000_multi_hour_bookings` split `Booking` / `BookingSlot`. Payment is NOT wired up — a booking stops at `pending`.

## Phase 7.5 — Accounts, roles & contact
- [x] Profile fields (`name`, `phone`, `address`) on signup, account page and a `/complete-profile` step
- [x] Google (Gmail) sign-in via Supabase Auth OAuth
- [x] Log out in the account area and the admin header
- [x] Public `/contact` page → `ContactMessage` → admin Messages tab
- [x] Admin Users tab: list, remove (confirmed), promote/demote
- [x] `super_admin` role above `admin`, enforced in server actions **and** RLS **and** a trigger
- **Done when:** a Google user is asked for phone/address before continuing; a plain admin cannot touch another admin from the panel *or* through the anon key.
- Google OAuth credentials are configured outside the codebase — see ARCHITECTURE.md → Google sign-in. Contact details in `lib/contact-details.ts` are **placeholders**.

## Phase 8 — PayHere  ← *(consider adding a security-reviewer subagent here)*
- [x] Server-side hash generation (secret stays server-only)
- [x] Checkout popup for a pending booking
- [x] `notify_url` webhook: verify `md5sig`, then flip booking to `confirmed`
- [x] Status page on `return_url` (never confirms)
- [x] Confirmation email on `confirmed`, via the existing Resend setup
- **Done when:** browse → book → pay (sandbox test card) → booking becomes `confirmed`.
- `POST /api/payhere/notify` and `/payments/return?booking=<id>`. The webhook path is verified against signed fixtures locally, but the **end-to-end sandbox run needs a public URL** (`notify_url` cannot reach `localhost`) — do it on the Vercel deployment or a tunnel. See ARCHITECTURE.md → Payment flow → As built.

## Phase 9 — Polish, deploy, cleanup
- [ ] UI polish against DESIGN.md checklist
- [ ] Deploy to Vercel; whitelist image domains
- [ ] Vercel Cron: expire unpaid `pending` holds (+ Supabase keep-alive)
- [ ] Full end-to-end sandbox test
- **Done when:** the full flow works on the deployed URL.

## Phase 10 — Go-live (when real)
- [ ] Supabase → Pro (backups + no inactivity pause)
- [ ] PayHere sandbox → live credentials
- [ ] Real domain
- **Done when:** live site takes real bookings and payments.
