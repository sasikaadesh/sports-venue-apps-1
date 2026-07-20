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
  role          enum('user','admin')  default 'user'
  createdAt

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

Booking
  id
  courtId       -> Court
  bookingDate   date
  slotId        -> SlotTemplate     # which slot on that date
  userId        -> User (null when status='blocked' by admin)
  playerCount   int
  status        enum('pending','confirmed','cancelled','blocked','expired')
  holdExpiresAt timestamp   # for pending holds
  createdAt
  UNIQUE (courtId, bookingDate, slotId)   # <-- anti double-booking

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
- **Blocked slots reuse the Booking table** (status `blocked`, no user) so availability logic handles them for free.
- **Player options come from CourtType**, so the players dropdown is data-driven.

## Availability computation

Slots are defined as templates, not stored per-day. To get availability for a court + date:

1. Take the `SlotTemplate`s for that court matching the date's `dayOfWeek` (and `isActive`).
2. Load `Booking`s for that court + date whose status is `confirmed`, `pending` (unexpired hold), or `blocked`.
3. A template slot is **available** if no such booking occupies it.

This keeps the DB small and the admin panel simple.

## Booking flow

1. User selects court + date + open slot + player count (validated against `CourtType.playerOptions`).
2. Server booking service (in `/lib`) creates a `Booking` with status `pending` and a short `holdExpiresAt` (e.g. 10 min), inside a transaction.
3. The **unique constraint** guarantees only one booking per (court, date, slot). If a second request loses the race, catch the constraint error and tell the user the slot was just taken.
4. Proceed to payment for that pending booking.

## Payment flow (PayHere onsite checkout)

1. Client requests checkout for a `pending` booking.
2. **Server** creates a `Payment` (status `pending`), generates the PayHere **hash** from merchant_id + order_id + amount + currency + hashed merchant_secret, and returns the payment params (never the secret).
3. Client opens the PayHere popup with those params.
4. PayHere calls the **`notify_url`** webhook server-to-server. The webhook:
   - verifies `md5sig`,
   - on success: marks `Payment` `success` and flips the `Booking` to `confirmed`,
   - on failure/cancel: marks `Payment` accordingly and leaves/returns the slot.
5. `return_url` only shows the user a status page — it never confirms the booking.

**Dev note:** `notify_url` must be publicly reachable, so test against the deployed Vercel URL or a tunnel (ngrok/cloudflared), not `localhost`. Merchant Secret is domain-specific.

## Hold cleanup

A scheduled job (Vercel Cron) periodically expires `pending` bookings past `holdExpiresAt` (status → `expired`), freeing the slot. This same cron can double as the Supabase keep-alive during the free-tier phase.

## Security

- Authorization enforced in server actions/handlers **and** Postgres RLS. Never trust middleware alone (CVE-2025-29927).
- RLS: users read/write only their own bookings; only admins manage courts, types, templates, and see all bookings.
- Merchant secret and service-role key are server-only env vars.

## Connections (Prisma + Supabase)

- `DATABASE_URL` = Supabase **pooled** connection (runtime).
- `DIRECT_URL` = Supabase **direct** connection (migrations).
Getting these swapped is the most common setup error — keep them distinct.
