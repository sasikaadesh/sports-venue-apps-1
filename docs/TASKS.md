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
- [ ] Supabase Auth: signup/login
- [ ] user vs admin role; server-side role checks
- [ ] RLS policies (own bookings for users; full access for admins)
- **Done when:** you can register, log in, and role gates work (verified, not just UI-hidden).

## Phase 5 — Admin panel
- [ ] CRUD: courts (with image upload to Supabase Storage), court types + player options
- [ ] Slot templates per court
- [ ] Block slots; view/manage all bookings
- **Done when:** an admin can create a real court + slots with zero code.

## Phase 6 — Public site
- [ ] Landing page + low clean hero (per DESIGN.md)
- [ ] Court thumbnail grid + court details pages
- [ ] Availability view (court + date → open slots)
- **Done when:** visitors can browse admin-created courts and see availability.

## Phase 7 — Booking flow
- [ ] Hero booking dropdown (court → date → slot → players)
- [ ] Player options driven by CourtType
- [ ] Booking service creates `pending` hold; unique constraint blocks double-booking
- **Done when:** a user can reserve a slot; two users cannot grab the same one.

## Phase 8 — PayHere  ← *(consider adding a security-reviewer subagent here)*
- [ ] Server-side hash generation (secret stays server-only)
- [ ] Checkout popup for a pending booking
- [ ] `notify_url` webhook: verify `md5sig`, then flip booking to `confirmed`
- [ ] Status page on `return_url` (never confirms)
- **Done when:** browse → book → pay (sandbox test card) → booking becomes `confirmed`.

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
