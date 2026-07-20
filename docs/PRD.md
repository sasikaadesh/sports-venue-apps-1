# PRD — Sports Court Booking App

## Goal

Let people find and book sports courts online, pay for the booking, and let an admin manage everything (courts, time slots, availability) without touching code. Simple, fast, and clean.

## Users

- **Visitor** — anyone browsing the public site (no login required to look).
- **User** — a registered person who books and pays for courts.
- **Admin** — manages courts, court types, time slots, images, and bookings.

## Core features (v1)

### Public site
- Simple landing page with a **low, clean hero** and a booking dropdown in the hero (court → date → time slot → number of players).
- Courts shown as **thumbnails** in a grid, each linking to a **court details page**.
- **Availability view:** pick a court and date, see which time slots are open.
- All court content (name, type, description, images, slots) is admin-managed — nothing hard-coded.

### Accounts
- Sign up / log in (email; social optional).
- Role-based access: **user** vs **admin**.

### Booking
- Select court, date, an available time slot, and number of players.
- **Number of players options depend on the court type** (defined by admin per type).
- Booking is held as `pending`, then confirmed after payment.
- A user can view their own bookings.

### Payment
- Pay for a booking via **PayHere** (sandbox first, live later).
- Booking is confirmed only after payment is verified server-side.

### Admin panel
- Add / edit / remove **courts** (name, type, description, images, active toggle).
- Manage **court types** and the **player-count options** allowed for each.
- Define **time-slot templates per court** (slots can differ per court).
- **Block** slots (e.g. maintenance) and view/manage all bookings.
- Upload court images.

## User stories

- As a visitor, I can browse courts and see details without an account.
- As a user, I can register, log in, check availability for a date, book an open slot, choose a valid number of players, and pay.
- As a user, I can see my bookings and their status.
- As an admin, I can add a new court with images and set its time-slot schedule.
- As an admin, I can define that "Tennis" allows 2 or 4 players and "Cricket" allows a different set.
- As an admin, I can block a slot so no one can book it.
- As an admin, I can see all bookings and payment statuses.

## Out of scope for v1 (do later)

- Full multi-tenant SaaS (separate isolated clubs) — design cheaply toward it, don't build it.
- Recurring/subscription bookings, memberships, loyalty.
- Refunds/cancellations flow with money back (v1 can cancel a `pending`/unpaid hold only).
- Email/SMS notifications (nice-to-have, not required for v1).
- Reviews/ratings, coaching, equipment rental.
- Native mobile app.

## Success criteria for v1

- An admin can set up a court + slots with zero code.
- A user can complete: browse → book → pay (PayHere sandbox) → see a `confirmed` booking.
- Two users cannot book the same slot at the same time.
- Unpaid holds are released automatically.
- The site looks intentional and clean (see DESIGN.md), not templated.
