# ARCHITECTURE

Technical design. When implementing, follow this; if reality forces a change, update this doc.

## Overview

Single Next.js (App Router) app on Vercel. Server logic lives in route handlers and server actions under `/app` and `/lib`. Supabase provides Postgres, Auth, and Storage. Prisma manages schema and migrations. PayHere handles payments via its onsite-checkout JS SDK.

## Data model

Illustrative schema (starting point — refine in `prisma/schema.prisma`):

```
User
  id            uuid (from Supabase Auth)
  email
  name          string?   # nullable — see "Profile fields" below
  phone         string?
  address       string?
  role          enum('user','admin','super_admin')  default 'user'
  createdAt

ContactMessage          # public "Contact us" submissions
  id
  name
  email
  message
  createdAt
  readAt        timestamp?   # null = unread

CourtType
  id
  name          e.g. "Tennis", "Cricket", "Table Tennis"
  playerOptions int[]  e.g. [2,4] for singles/doubles
  # drives the "number of players" dropdown

Court
  id
  name
  courtTypeId   -> CourtType
  description
  images        string[]  (Supabase Storage URLs; Unsplash placeholders for now)
  isActive      boolean default true
  createdAt

SlotTemplate           # per-court recurring schedule
  id
  courtId       -> Court
  dayOfWeek     0..6
  startTime     time    e.g. 09:00
  endTime       time    e.g. 10:00
  price         decimal (LKR)
  isActive      boolean

Booking                   # ONE reservation; may cover several consecutive hours
  id
  courtId       -> Court
  bookingDate   date
  userId        -> User
  playerCount   int
  durationHours int        # number of consecutive slots, minimum 1
  totalPrice    decimal    # sum of the covered slots' prices, frozen at booking time
  status        enum('pending','confirmed','cancelled','blocked','expired')
  holdExpiresAt timestamp  # for pending holds
  createdAt

BookingSlot               # one row per reserved HOUR — this is the protected row
  id
  bookingId     -> Booking (ON DELETE CASCADE)
  slotId        -> SlotTemplate
  courtId       -> Court   # denormalised from the parent Booking
  bookingDate   date       # denormalised from the parent Booking
  price         decimal    # that hour's price, frozen at booking time
  UNIQUE (courtId, bookingDate, slotId)   # <-- anti double-booking, per hour

Payment
  id
  bookingId     -> Booking
  orderId       string   # merchant order id sent to PayHere
  amount        decimal
  currency      'LKR'
  status        enum('pending','success','failed','cancelled')
  payhereRef    string   # payment_id from PayHere
  createdAt
```

Notes:
- **Slots are fixed 1-hour blocks.** A `SlotTemplate` is exactly one bookable hour. A user picks a *start* slot plus a *duration* of N consecutive hours (minimum 1).
- **`Booking` is the reservation; `BookingSlot` is the hour.** One booking row, N child rows. The unique constraint lives on the child, so every occupied hour is independently protected — a 3-hour booking holds three protected rows.
- **`courtId` and `bookingDate` are denormalised onto `BookingSlot`** so the unique constraint can be evaluated within a single row. They must always match the parent `Booking`; treat the parent as the source of truth and write them together in the same transaction. (`UNIQUE (bookingDate, slotId)` would in fact suffice, since a `SlotTemplate` already belongs to exactly one court — the `courtId` is kept to match the constraint named in CLAUDE.md and to keep availability queries on one table.)
- **Prices are frozen at booking time.** `BookingSlot.price` copies the template's price and `Booking.totalPrice` is their sum. Editing a `SlotTemplate`'s price later must never retroactively change what someone already booked and paid.
- **Blocked slots reuse the same two tables** (status `blocked`), so availability logic handles them for free. An admin block is a `Booking` with one `BookingSlot` per blocked hour.
- **A block is owned by the admin who made it** — `userId` is the admin's id, not null, per CLAUDE.md. Owning the row gives a free audit trail of who blocked what, and costs nothing. `playerCount` is `0` and `totalPrice` is `0` for a block.
- **Player options come from CourtType**, so the players dropdown is data-driven.

Shipped in migration `20260722120000_multi_hour_bookings`, which moved `slotId` and the unique constraint off `Booking` and onto the new `BookingSlot` table, carrying any existing one-hour bookings across as single child rows.

## Demo data (`prisma/seed.mts`)

`npm run db:seed` (or `npx prisma db seed`) populates court types, courts and their hourly schedules — Cricket Nets, Basketball, Table Tennis and Badminton Court 1, with Unsplash placeholder images.

It is idempotent, so it can be re-run against a populated database: court types upsert on their unique `name`; courts are matched by name (`Court.name` is not unique, so this is find-then-create/update) and keep their id, so anything already booked stays valid; slot templates are generated for a weekday **only when that weekday has no templates**, exactly as `generateDaySchedule` does — a day is always either empty or a clean hourly grid, and a rate an admin has since adjusted is never overwritten.

## Availability computation

Slots are defined as templates, not stored per-day. To get availability for a court + date:

1. Take the `SlotTemplate`s for that court matching the date's `dayOfWeek` (and `isActive`), ordered by `startTime`.
2. Load the `BookingSlot`s for that court + date whose parent `Booking` has status `confirmed`, `pending` (unexpired hold), or `blocked`.
3. A single hour is **free** if no such `BookingSlot` occupies it.

**Availability for a chosen duration N:** a start slot is bookable at duration N only if *every* hour in the range is free. Concretely, walking forward from the start slot, all N slots must:

- exist as templates for that court and weekday, and be `isActive`;
- be **contiguous in time** — each slot's `endTime` equals the next slot's `startTime`;
- be free per step 3.

If any one hour fails, that start slot is not offered at that duration. Contiguity has to be checked against the clock, not against list position: a court with 09:00–10:00 and then 14:00–15:00 has two slots that are adjacent in the ordered list but are *not* two consecutive hours, and must never be sold as a 2-hour booking.

This keeps the DB small and the admin panel simple.

## Public site (Phase 6)

Routes live in the `(public)` route group: `/` (landing), `/courts`, `/courts/[id]`, `/contact`. No auth gate — visitors browse, check availability and send a message signed out (PRD).

- **`lib/availability.ts`** computes per-slot availability, reusing `getOccupyingSlots` from the booking service so the public site and admin panel can never disagree about what is taken.
- **Only active rows are public.** Inactive courts 404; inactive slot templates are not listed.
- **Past slots are excluded**, judged against the venue's wall clock (`VENUE_TIME_ZONE`, `nowAtVenue()` in `lib/time.ts`) — not UTC and not the visitor's zone, or a 09:00 slot would keep looking bookable into the afternoon.
- **Date lives in the URL** (`?date=`), clamped server-side to `[today, today + 60 days]`, so pages stay server-rendered and a date is shareable.
- Pages are `force-dynamic`: availability changes as people book, so nothing here may be cached.
- `next.config.ts` whitelists `images.unsplash.com` and the Supabase Storage host (derived from `NEXT_PUBLIC_SUPABASE_URL`) for `next/image`.

## Booking flow

1. User selects court + date + **start slot** + **duration N hours** + player count (validated against `CourtType.playerOptions`).
2. Server booking service (in `/lib`) resolves the N slot templates starting at the chosen slot and re-validates them server-side: same court, active, contiguous in time, N ≥ 1. The client's duration is never trusted, and neither is a client-supplied price.
3. **In one transaction**, the service creates the `Booking` (status `pending`, short `holdExpiresAt` — e.g. 10 min, `totalPrice` = sum of the N slot prices) together with all N `BookingSlot` rows.
4. The **unique constraint on `BookingSlot`** guarantees only one reservation per (court, date, hour). If any one of the N rows collides, the whole transaction rolls back — the booking is **all-or-nothing**, never a partial reservation of some hours. Catch the constraint error and tell the user that one of those hours was just taken.
5. Proceed to payment for that pending booking.

The atomicity in step 4 is the reason the insert must be a single transaction rather than a loop of inserts: two users requesting overlapping ranges at the same moment would otherwise each grab a subset of the hours and both fail, leaving stray rows behind.

### As built (Phase 7)

- **`quoteBooking()`** is the single definition of "is this a legal booking, and what does it cost": it re-resolves the chain, checks the court is active, the player count is one the `CourtType` offers, the date is inside the window, and the start hour has not already passed at the venue's wall clock. It returns the per-hour breakdown and the total. The review page renders it, and `createBooking` calls it again immediately before writing — so the total the user confirmed is the total that gets stored, by construction rather than by agreement.
- **The price is never an input.** `createBookingSchema` has no amount field at all. The total is `Prisma.Decimal` arithmetic over the slot templates, and each hour's price is frozen onto its own `BookingSlot`.
- **The occupancy check in `quoteBooking` is advisory** — it exists so the common case gets a readable message. Between that read and the insert another request can commit; the unique constraint is the guarantee, and `P2002` is translated into "one of those hours was just taken". This path is exercised, not assumed: two concurrent overlapping 2-hour requests produce exactly one winner, and the loser holds zero rows.
- **UI** — three places select the same booking, all deriving the used values from what was asked (a stale pick falls back to something valid rather than breaking), and all showing the **actual booked range** (`start – computed end` for the chosen duration) and the summed total, never the operating range:
  - `components/public/hero-booking-bar.tsx` — home page, court → date → start → duration → players, fed by `GET /api/availability`. Start-time options read as full hour ranges (`06:00 – 07:00`).
  - `components/public/court-booking-panel.tsx` — the court detail page's Availability section. The user picks a start hour, duration and players **on the court page itself** (no detour to the home page), off the availability already computed server-side; the date picker owns `?date=` and reloads.
  - `/book` — server-rendered review + total via `quoteBooking`. A **"Change"** link returns to the court page with `date`, `slotId`, `duration` and `players` in the URL, so the panel re-fills and any field can be adjusted without losing the selection.
  - `/bookings/[id]` — summary, hold expiry, release-your-hold.
- **`maxDuration`** comes back with each slot from `getCourtAvailability`: the longest run of free, clock-contiguous hours starting there. The duration dropdown offers exactly `1..maxDuration`. The walk itself lives in `lib/slots.ts` as pure functions, so the view and the writer cannot drift apart.

## Payment flow (PayHere onsite checkout)

1. Client requests checkout for a `pending` booking.
2. **Server** creates a `Payment` (status `pending`), generates the PayHere **hash** from merchant_id + order_id + amount + currency + hashed merchant_secret, and returns the payment params (never the secret). The amount is read from `Booking.totalPrice` on the server — never accepted from the client, or a user could pay for one hour and reserve six.
3. Client opens the PayHere popup with those params.
4. PayHere calls the **`notify_url`** webhook server-to-server. The webhook:
   - verifies `md5sig`,
   - on success: marks `Payment` `success` and flips the `Booking` to `confirmed`,
   - on failure/cancel: marks `Payment` accordingly and leaves/returns the slot.
5. `return_url` only shows the user a status page — it never confirms the booking.

**Dev note:** `notify_url` must be publicly reachable, so test against the deployed Vercel URL or a tunnel (ngrok/cloudflared), not `localhost`. Merchant Secret is domain-specific.

### As built (Phase 8)

Three modules, split by who is allowed to call them:

- **`lib/payhere.ts`** — config plus the two digests. `payhereConfig()` returns `null` when unconfigured (the button reports it rather than the page crashing) and treats anything that is not literally `live` as sandbox, so a typo cannot start taking real money. `verifyNotificationSignature` compares in constant time. MD5 is PayHere's specification, not a choice.
- **`lib/payment-service.ts`** — the only writer of `Payment`. `startCheckout()` for a signed-in owner; `applyPayHereNotification()` for the webhook.
- **`lib/booking-service.ts`** gained the three booking transitions payment needs — `extendHoldForPayment`, `confirmPaidBooking`, `releaseUnpaidBooking` — because every `Booking` write goes through that one module (CLAUDE.md).

**Routes.** `POST /api/payhere/notify` (server-to-server) and `/payments/return?booking=<id>` (the browser). The return page reads booking + payment status and renders it; it has no write path at all, and "the webhook has not landed yet" is a first-class state there, polled by `router.refresh()` for up to a minute.

- **`Payment.orderId` is a uuid** and is uniquely indexed, so the webhook resolves an order with one lookup and cannot match two rows. A repeated Pay click reuses the existing `pending` payment at the same amount rather than littering a row per click.
- **The amount is `Booking.totalPrice`**, read on the server. It is never a parameter, so the "pay for one hour, reserve six" attack has no input to attack.
- **The webhook's checks are ordered and total**: our merchant id → `md5sig` → known order → amount *and* currency match what we stored → only then does `status_code` mean anything. Failing one of the first two answers 403 (that request is not from PayHere); anything merely unknown answers 200, because PayHere retries non-2xx and retrying will not make an unknown order known.
- **Confirmation is a compare-and-set.** `confirmPaidBooking` uses `updateMany` matching `status: 'pending'`, so it races safely against the expiry sweep and is idempotent under PayHere's retries — which is also what stops the confirmation email going out twice.
- **The hold is extended to 20 minutes when checkout opens** (`PAYMENT_HOLD_MINUTES`), because card entry, OTP and the bank redirect all happen inside it.
- **Paid-but-unconfirmable is handled explicitly.** If the hold lapsed and the sweep released the hours before the notification arrived, the payment is still recorded `success` but the booking is **not** confirmed — the hours may already belong to someone else. It logs `PAID BUT UNCONFIRMABLE … Refund required`, and both the booking page and the status page tell the user plainly that the office will contact them. Confirming anyway would sell one hour twice.
- **A chargeback (`-3`) is recorded, not acted on.** It arrives against a booking that is usually already `confirmed`, and releasing paid hours automatically is exactly the decision that belongs to an admin with a refund trail (see the paid/unpaid divide above).
- **Email** on confirmation goes through `lib/email/booking.ts`, which — like the contact emails — never throws and never reports failure upward. A Resend outage must not make the webhook return non-2xx, or PayHere would retry a notification we have already acted on.
- **Verified without PayHere.** A harness POSTed signed notifications at the running webhook: success, retry/replay, forged `md5sig`, a tampered amount, a correctly-signed underpayment, cancel, fail, foreign merchant id, unknown order, and the lapsed-hold case. Only the correctly signed success confirmed anything, and the replay was a no-op.

## Releasing a booking (holds, cancellations, unblocks)

**A `BookingSlot` row exists only while its booking actually holds that hour.** Releasing a booking — an expired hold, a cancellation, an unblock — *deletes* its `BookingSlot` rows. The parent stays behind as the record, with status `expired` / `cancelled`.

This is forced by the constraint. `UNIQUE (courtId, bookingDate, slotId)` is evaluated on the `BookingSlot` row alone and cannot consult the parent's status, so a released booking that kept its hour-rows would make those hours permanently unsellable — availability would show them free and every insert would fail with a constraint error. Deleting the rows is what keeps the constraint and the availability view telling the same story.

(An earlier draft of this doc said only the parent row changes. That was wrong, and the Phase 7 implementation is what surfaced it.)

- `releaseExpiredHolds()` in the booking service does the sweep: `pending` past `holdExpiresAt` → delete hour-rows, set status `expired`. Every writer calls it scoped to the court and date it is about to touch, so a lapsed hold can never block a genuinely free hour.
- Phase 9 adds a Vercel Cron running the same sweep globally, which also doubles as the Supabase keep-alive during the free-tier phase.
- Reads do not sweep. `getOccupyingSlots` simply ignores `pending` rows whose hold has lapsed, so rendering a page never writes.

### Who may remove a booking — the paid/unpaid divide

Whether a user can undo their own booking depends entirely on whether money has changed hands:

- **Unpaid (`pending`) — the user may remove it freely.** Nothing has been charged, so a `pending` booking is the user's to cancel at will. Removal follows the release path above: delete its `BookingSlot` rows (freeing the hours immediately) and set the parent to `cancelled`. This is also what an abandoned selection becomes on its own once `holdExpiresAt` passes (`expired`) — a deliberate remove just does it now instead of on the sweep.
- **Paid (`confirmed`) — the user may *not* self-remove it.** Once payment is verified and the booking is `confirmed`, the hours are genuinely sold; letting the user delete the row would release a paid slot with no money returned and no record of why. Instead the user **requests a refund with a reason**, which an **admin reviews** and approves or declines. Only on an approved refund does the booking release its slots (→ `cancelled`) — so a confirmed slot never frees up without an explicit, audited admin decision.

**Refund flow (implemented after Phase 8).** A confirmed booking gains a user-initiated *refund request* (a reason + status), surfaced to admins for review. On approval the admin issues the refund through **PayHere's Refund API** and the booking is released; on decline the booking stays `confirmed` and the reason is recorded. This reuses the release mechanics above — the only new parts are the request record, the admin review step, and the PayHere refund call. Exact schema (a `RefundRequest` model vs. fields on `Booking`/`Payment`) is decided when the flow is built; until then, `confirmed` bookings are terminal from the user's side.

## Auth & roles

Supabase Auth owns credentials; the app owns the role.

- **Profile rows.** A trigger on `auth.users` (`on_auth_user_created`) inserts the matching `public."User"` row with `role = 'user'`. The app never creates it during signup, so it cannot be skipped. A matching delete trigger keeps the two in sync.
- **Where the role lives.** In the `User` table only — never in JWT user metadata, which the client can edit.
- **Three Supabase clients** in `/lib/supabase`: `client.ts` (browser, anon key), `server.ts` (server components/actions/handlers, anon key + cookies, so RLS applies as the logged-in user), `admin.ts` (service-role, bypasses RLS, guarded by `import "server-only"`).
- **Checks live in `/lib/auth.ts`**: `getCurrentUser`, `roleIsAdmin`, `isAdmin`, `isSuperAdmin`, `profileIsComplete`, `requireUser`, `requireAdmin`, `requireSuperAdmin`, `requireCompleteProfile` (pages/actions), `requireAdminApi` (route handlers → 401/403). Every protected route calls one directly.
- **`proxy.ts` refreshes the session and nothing else.** It makes no authorization decisions — this layer is bypassable via a forged `x-middleware-subrequest` header (CVE-2025-29927).

### The role ladder (`20260726120100_super_admin_role`)

| role | can |
| --- | --- |
| `user` | book courts, edit own profile |
| `admin` | everything about courts, types, slots, bookings, contact messages; remove **user** accounts |
| `super_admin` | all of `admin`, plus promote a user to admin, demote an admin, remove an admin account |

- **`super_admin` is a strict superset of `admin`.** `is_admin()` in Postgres and `roleIsAdmin()` in TypeScript both mean "admin *or* super admin", so every pre-existing admin gate covers super admins without being touched. Only the genuinely extra powers check for `super_admin` specifically.
- **A plain admin can never touch an admin.** Enforced three times over, because each layer covers a path the others do not:
  - **Server actions** (`app/admin/users/actions.ts`) re-read *both* roles from the database on every call — never from the form, never from the row the client claims to be looking at. This is the layer that covers Prisma, which bypasses RLS.
  - **RLS** narrows the old "any admin may update any profile" policy to `is_super_admin() OR (is_admin() AND role = 'user')`, in `USING` *and* `WITH CHECK`. Checking the pre- and post-update row both closes the escalation: a plain admin can neither modify an existing admin nor turn a user into one. This covers the anon-key path.
  - **A trigger**, `protect_last_super_admin`, refuses to demote or delete the last super admin. This is the only layer on the service-role path, which bypasses RLS entirely — and account removal runs there.
- **`super_admin` is never assignable from the app.** `assignableRoleSchema` is `enum(['user','admin'])`, so the role cannot even be *expressed* in a request. It is granted by migration or `npm run make-admin -- <email> super_admin`, both of which need database access. The panel therefore cannot mint a peer able to remove you.
- **Nobody may act on their own account** in the Users tab — not demote, not remove. That is what stops the venue locking itself out of its own panel.
- **Removal deletes the `auth.users` row** (service-role, after the checks above), not the profile row. Deleting only the profile would leave a live auth user who could still sign in and would simply get a fresh profile on the next request; going this way round, the existing `on_auth_user_deleted` trigger clears the profile for us. `Booking.userId` is `ON DELETE SET NULL`, so booking and payment history survives — it just stops naming a person.
- **`sasikaadesh@gmail.com` is seeded as the first super admin** by the migration. That `UPDATE` is a no-op on a database where the account has not signed up yet, so run the `make-admin` script afterwards in that case.

### Profile fields and the "complete your profile" gate

`name`, `phone` and `address` are nullable on `User`, which is a consequence of where the row comes from rather than a preference: the row is created by a database trigger the instant Supabase Auth creates the user, and **Google supplies no phone number and no address**.

- **Email/password signup collects all three up front.** They are passed as Supabase Auth user metadata and `handle_new_user()` copies them into `public."User"` — so the app still never INSERTs the profile row itself, and profile creation stays unskippable.
- **`profileIsComplete()` means "has a phone and an address"**. `NULLIF(TRIM(...), '')` in the trigger keeps an empty metadata string from counting as filled in, or blanks would walk straight through the gate.
- **Anything incomplete is routed to `/complete-profile`**, carrying its original destination in `?next=`. Both the OAuth callback and the two password actions check this, so it also catches accounts created before these columns existed. That page guards with `requireUser`, *not* `requireCompleteProfile` — the latter redirects to it, and would loop.
- **Users edit their own profile through a server action** (`app/account/actions.ts`), which takes the id from `requireUser()` and never from the form, and whose schema has no `role` field. Users still have **no write policy on `User`**, so the invariant "nobody can promote themselves through the anon key" holds literally: there is no self-UPDATE path to abuse.

### Google sign-in (Supabase Auth OAuth)

- `signInWithGoogle` (a server action) calls `supabase.auth.signInWithOAuth`, which only *builds* the provider URL; the action then redirects to it. Doing it server-side means the callback URL is composed on the server and the button works with JS disabled.
- Google returns to **`/auth/callback`**, the single landing point for every out-of-app auth hop (email confirmation uses it too). It exchanges the code for a session, then sends an incomplete profile to `/complete-profile` and everyone else to `next`.
- `next` is run through `safeNextPath()` — relative single-slash paths only. An open redirect here would be handed to every new user by email.
- `siteOrigin()` (`lib/site-url.ts`) prefers `NEXT_PUBLIC_BASE_URL` and falls back to the forwarded host so previews work unconfigured. That fallback is not a security boundary: Supabase only honours a `redirectTo` matching its own Redirect URLs allow list, which is what actually stops a spoofed host header redirecting the callback elsewhere. Keep that list tight.
- **Setup lives outside the codebase** — Google Cloud OAuth client + Supabase provider config. The authorized redirect URI is Supabase's own callback (`https://<project-ref>.supabase.co/auth/v1/callback`), *not* an app URL; the app URL goes in Supabase's Site URL / Redirect URLs instead.

## Contact Us

- Public page at `/contact`: a form (name, email, message) beside static venue details from `lib/contact-details.ts` (one module, so the page and footer cannot disagree — and swapping them for the next club is a one-file change). **The shipped details are placeholders.**
- `submitContactMessage` is the app's one **unauthenticated write** — the person most likely to be asking a question is exactly the one without an account. It is kept narrow accordingly: only the three validated fields are written, `readAt` is not settable from it, there is no id so it can only ever insert, lengths are bounded by Zod, and a hidden honeypot field silently drops naive bots (answering `ok`, so they get no signal to retry).
- Admins read the inbox at `/admin/messages` (mark read/unread, delete), with an unread count on the nav tab. **Admin-level, not super-admin-level** — answering enquiries is ordinary staff work. The panel remains the system of record; email is a notification layer on top of it (below).
- RLS on `ContactMessage`: insert for `anon` + `authenticated`, select/update/delete admin-only. There is deliberately no public SELECT policy — a sender cannot read the inbox back, not even their own message.

### Transactional email (Resend + React Email)

**Provider: [Resend](https://resend.com), templates in [React Email](https://react.email).** Resend is the only mail dependency; React Email supplies the components the templates are written with. Nothing here runs in the browser.

Flow, on a successful `submitContactMessage`:

1. The `ContactMessage` row is written — **first, and always**. This is the record of the enquiry.
2. `sendContactEmails()` (`lib/email/contact.ts`) then sends two messages via Resend:
   - **To `ADMIN_CONTACT_EMAIL`** — subject `New contact message from {name}`, carrying the sender's name, email and message, with **`replyTo` set to the sender** so answering is one keystroke.
   - **To the address the visitor typed** — a short confirmation echoing their message back.
3. The action returns `{ ok: true }` and the form shows "Message sent".

- **Email can never fail the submission.** `sendContactEmails` throws nothing and returns nothing the caller acts on. Both failure modes are caught and `console.error`-ed: a thrown error (network, bad key) *and* Resend's returned `error` object, which does not throw and would otherwise pass for success. A missing `RESEND_API_KEY` or `ADMIN_CONTACT_EMAIL` logs a warning and skips that send, so the app runs unconfigured. The consequence of an outage is a row in the panel that nobody was pinged about — never a lost message or a false error shown to a visitor who in fact got through.
- **It is `await`ed, not fired and forgotten.** A serverless function can be frozen the instant it responds, which would kill a floating promise mid-flight.
- **The two sends are sequential.** Resend's free tier allows 2 requests/second; firing both at once sits exactly on the limit. The admin notification goes first — if only one gets through, it should be the one carrying information nobody else has.
- **Server-only by construction.** `lib/email/client.ts` carries `import "server-only"`, so `RESEND_API_KEY` cannot reach a client bundle — importing it from a client component is a build error, not a runtime leak.
- **Templates** live in `lib/email/templates.tsx`: inline style objects, single column, the project palette (`#0A0A0A` ink, `#16DB65` green) written out literally — email clients strip `<style>` blocks and understand nothing of Tailwind or CSS custom properties. Each email also ships a plain-text alternative, which text-only clients render and which lowers the spam score.
- **Sender: Resend's shared test address (`onboarding@resend.dev`) for now.** It needs no DNS setup but **only delivers to the email address that owns the Resend account** — so the visitor confirmation will not arrive for anyone else. **A verified domain is required before production**: add the venue's domain in Resend → Domains, publish the DKIM/SPF (and, once trusted, DMARC) records it prints, then set `CONTACT_FROM_EMAIL` to an address on that domain. Until that is done, treat the confirmation email as untested for real users.
- **Env vars** (all server-only, none `NEXT_PUBLIC_`): `RESEND_API_KEY`, `ADMIN_CONTACT_EMAIL`, `CONTACT_FROM_EMAIL` (optional; defaults to the shared test sender).

## Admin panel (Phase 5)

Lives under `/app/admin`, gated by `requireAdmin()` in the layout **and** in every page **and** in every server action — an action is its own HTTP endpoint and never runs the layout that guards the pages.

- **Tabs:** Overview, Court types, Courts, Block slots, Bookings, **Users**, **Messages**. The header carries the signed-in email (linked to `/account`) and a **Log out** control on a single row.
- **Users** lists every account and is where the role ladder above is applied. What a row draws (`canManage`, `actorIsSuperAdmin`) is presentation only; the same rules are re-derived from the database inside each action.

- **Booking writes** — `/lib/booking-service.ts` is the only module that writes `Booking` or `BookingSlot`. Admin actions (block, unblock, cancel) validate and authorize, then delegate. `blockSlot` rejects a slot that belongs to another court or does not recur on the chosen weekday, and translates the unique-constraint violation (Prisma `P2002`) into "already booked or blocked".
- **Slot templates are strictly one hour.** A `SlotTemplate` is exactly one bookable hour; the admin never hand-builds an oversized range. Per weekday the admin sets an operating range and one hourly rate, and the server (`generateDaySchedule`) expands it into individual 1-hour slots — 06:00–22:00 → sixteen slots. Rates are adjustable afterwards: bulk for a weekday (`setDayRate`) or per hour (`updateSlotPrice`). Generation refuses to run on a weekday that already has slots, so a day is always either empty or a clean hourly grid. The migration `20260723120000_hourly_slot_templates` removed the legacy multi-hour seed template so no oversized block survives.
- **Active/inactive is exposed at both levels.** An individual hour toggles via `setSlotActive`; a whole weekday opens/closes via `setDayActive` (which flips every hour on it). Inactive templates are filtered out of public availability and the booking service (`isActive: true` everywhere they are read), so a closed hour or day is neither shown nor bookable — the row stays for history and can be switched back on.
- **Copying a weekday** (`copyDaySchedule`) overwrites one or more target days with a source day's hours, rates and active flags, so a full week is a few clicks. A target that has any booked hour is refused (its `SlotTemplate` rows hold history and the FK is RESTRICT); unbooked target days are replaced atomically (delete-then-recreate in one transaction). The Block-slots page shows nothing for a weekday with no templates — which is correct, and is why the copy action exists: populate the day and its slots appear.
- **No-overlap rule** — creating or editing a slot rejects a time range overlapping another on the same court and weekday. Overlaps would offer the same wall-clock time under two different slot ids, which the `(courtId, bookingDate, slotId)` constraint cannot catch. This rule is also what makes "N consecutive hours" well-defined: with no overlaps, walking forward by `endTime == next startTime` yields exactly one unambiguous chain of hours.
- **Time columns** — `SlotTemplate.start/endTime` are `TIME`, `Booking.bookingDate` is `DATE`; Prisma maps both to `Date`. All conversion goes through `/lib/time.ts`, which reads and writes exclusively via UTC accessors. Mixing in local-time accessors shifts slots and lands bookings on the wrong day.
- **Serialization** — Prisma `Decimal` and `Date` are converted to strings in server components before crossing into client components.

## Court images (Supabase Storage)

- Bucket `court-images`, **created by migration** (`20260721140000_court_images_storage`), not by hand — a fresh Supabase project is fully configured by `prisma migrate deploy`.
- Public-read (court photos are shown to signed-out visitors, and public objects are CDN-served). 5 MB per file; MIME allowlist `image/jpeg|png|webp|avif` enforced by the bucket itself, so the limit holds even if an app-level check is missed.
- Uploads run server-side with the service-role key **after** `requireAdmin()`; storage RLS additionally restricts writes to admins. Object keys are `<courtId>/<uuid>.<ext>`, with the extension derived from the sniffed MIME type rather than the uploaded filename.
- Image uploads post through a server action, so `next.config.ts` raises `serverActions.bodySizeLimit` above the 1 MB default.

## Security

- Authorization enforced in server actions/handlers **and** Postgres RLS. Never trust middleware/proxy alone (CVE-2025-29927).
- RLS: users read/write only their own bookings; only admins manage courts, types, templates, and see all bookings.
- Policies use `public.is_admin()` / `public.is_super_admin()` `SECURITY DEFINER` helpers — required so the `User` table's own policies don't recurse.
- **Prisma bypasses RLS** (it connects as `postgres`). RLS constrains the anon-key path — i.e. anything a browser could call directly. Both layers are needed; neither alone is sufficient. RLS is deliberately not `FORCE`d, or Prisma queries would fail with a NULL `auth.uid()`.
- Users have **no write policy on `User`**, so nobody can promote themselves through the anon key. Promotion to `admin` happens in the Users tab (super admin only) or with the service-role key (`npm run make-admin -- <email> [user|admin|super_admin]`); `super_admin` only ever from the script or a migration.
- `public."User"` is never granted `DELETE` to `authenticated` at all. Removal runs server-side against `auth.users` with the service-role key after the checks above — no policy is stricter than the absent grant.
- Merchant secret and service-role key are server-only env vars.

## Connections (Prisma + Supabase)

- `DATABASE_URL` = Supabase **pooled** connection (runtime).
- `DIRECT_URL` = Supabase **direct** connection (migrations).
Getting these swapped is the most common setup error — keep them distinct.
