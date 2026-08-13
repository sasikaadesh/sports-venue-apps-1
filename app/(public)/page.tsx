import { ArrowRight } from "lucide-react";

import { CtaBand } from "@/components/brand/cta-band";
import { Eyebrow } from "@/components/brand/eyebrow";
import { FeatureCard } from "@/components/brand/feature-card";
import { ProcessSteps } from "@/components/brand/process-steps";
import {
  TestimonialsBand,
  type Testimonial,
} from "@/components/brand/testimonials-band";
import { LinkButton } from "@/components/link-button";
import { CourtCard } from "@/components/public/court-card";
import { HeroBookingBar } from "@/components/public/hero-booking-bar";
import { HeroCarousel } from "@/components/public/hero-carousel";
import { BRAND } from "@/lib/brand";
import { BOOKING_WINDOW_DAYS } from "@/lib/booking-service";
import { getActiveCourtsNewestFirst } from "@/lib/catalogue";
import { addDays, todayString } from "@/lib/time";

// Rendered per request: the header reads the session, and the booking bar's
// today/maxDate must be the real current date. The court list underneath comes
// from the tagged catalogue cache (lib/catalogue.ts) rather than the database —
// the *availability* the booking bar shows is still fetched live, per date,
// from /api/availability.
export const dynamic = "force-dynamic";

/**
 * Placeholder testimonials. Hardcoded on purpose — there is no reviews table
 * and no plan for one; when the school supplies real quotes, edit them here.
 */
const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "I used to ring the office twice to find out whether a net was free. Now I check the page on the way to work and the slot is booked before I reach the gate.",
    name: "Nilanthi Perera",
    role: "Parent",
  },
  {
    quote:
      "Four of us play tennis most Saturdays. Pick the hour, pay online, done — it takes about a minute, and the court is genuinely ours when we arrive.",
    name: "Dinesh Fernando",
    role: "Old Boy, 2009",
  },
  {
    quote:
      "Blocking the courts for practice used to mean a note on a clipboard that someone always missed. The schedule is in one place now, and the boys can see it too.",
    name: "Roshan de Silva",
    role: "Cricket Coach",
  },
];

export default async function HomePage() {
  const courts = await getActiveCourtsNewestFirst();

  const featured = courts.slice(0, 6);
  const today = todayString();
  const maxDate = addDays(today, BOOKING_WINDOW_DAYS);

  return (
    <>
      {/* Low, simple hero — a clean band, not a full-screen takeover. */}
      <section className="border-b">
        {/* Headline band: photo carousel behind, white text over a dark overlay.
            The white here is intentionally literal and identical in both
            themes — it sits on photography, not on a themed surface. */}
        <div className="relative isolate overflow-hidden">
          <HeroCarousel />
          <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-8 lg:py-28">
            <div className="flex max-w-2xl flex-col items-start gap-5">
              {/* Fixed light-on-photo, as with the headline below it. */}
              <p className="text-xs font-semibold tracking-[0.18em] text-white/75 uppercase">
                {BRAND.name} &middot; Established {BRAND.established}
              </p>
              <h1 className="text-5xl leading-[1.1] text-white sm:text-6xl">
                The courts are
                <br />
                <span className="text-photo-gold italic">open to you.</span>
              </h1>
              <p className="max-w-lg text-lg leading-relaxed text-white/80">
                Cricket nets, tennis, table tennis and more. Check what is free,
                reserve your slot, and pay online — no phone calls, no
                clipboard.
              </p>
            </div>
          </div>
        </div>

        {/* Booking bar band: solid surface, kept clear of the carousel. */}
        <div className="bg-tint">
          <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-8">
            {courts.length > 0 ? (
              <HeroBookingBar
                courts={courts.map((c) => ({ id: c.id, name: c.name }))}
                today={today}
                maxDate={maxDate}
              />
            ) : (
              <p className="rounded-xl border border-dashed bg-card px-5 py-6 text-sm text-muted-foreground">
                No courts are published yet. Once an admin adds one, it shows up
                here and across the site.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Court grid */}
      <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4 pb-8">
          <div className="flex flex-col gap-3">
            <Eyebrow tone="green">Facilities</Eyebrow>
            <h2 className="text-3xl">
              {courts.length > 0 ? "Our courts" : "Courts"}
            </h2>
            <p className="max-w-prose text-muted-foreground">
              Pick a court to see its photos, prices and open times.
            </p>
          </div>

          {courts.length > featured.length && (
            <LinkButton href="/courts" variant="outline" className="h-10">
              All {courts.length} courts
              <ArrowRight />
            </LinkButton>
          )}
        </div>

        {courts.length === 0 ? (
          <p className="rounded-lg border border-dashed px-6 py-10 text-sm text-muted-foreground">
            Nothing to show yet.
          </p>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((court, i) => (
              <li key={court.id}>
                <CourtCard
                  priority={i < 3}
                  court={{
                    id: court.id,
                    name: court.name,
                    typeName: court.typeName,
                    image: court.images[0] ?? null,
                    fromPrice: court.fromPrice,
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Signature component 2 — the numbered process. Booking genuinely has
          this order, which is the condition for using numerals at all. */}
      <section className="border-y bg-tint-strong">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8 lg:py-20">
          <div className="flex max-w-xl flex-col gap-3 pb-12">
            <Eyebrow tone="green">How it works</Eyebrow>
            <h2 className="text-3xl">Your slot, in three steps.</h2>
          </div>

          <ProcessSteps
            steps={[
              {
                title: "Find a court",
                body: "Browse by sport, check the photographs and the hourly rate.",
              },
              {
                title: "Pick your slot",
                body: "Choose a date and see exactly which hours are still open.",
              },
              {
                title: "Pay and play",
                body: "Confirm online. Your slot is held for you while you check out.",
              },
            ]}
          />
        </div>
      </section>

      {/* Signature component 1 — labelled feature cards. Unordered, so they are
          cards rather than numbered steps. */}
      {/* <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8">
        <div className="flex max-w-xl flex-col gap-3 pb-10">
          <Eyebrow tone="green">Why book online</Eyebrow>
          <h2 className="text-3xl">Built around the school day.</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            label="Availability"
            title="Live, never guessed"
            href="/courts"
            linkLabel="See what is free"
          >
            Court availability is read fresh on every request, so the hours you
            see are the hours that are genuinely open — no stale timetable, no
            double bookings.
          </FeatureCard>

          <FeatureCard
            label="Payment"
            title="Settled before you play"
            href="/courts"
            linkLabel="Browse courts"
          >
            Pay securely online when you book. Your slot is held while you check
            out and confirmed the moment the payment clears.
          </FeatureCard>

          <FeatureCard
            label="Your record"
            title="Every booking in one place"
            href="/account"
            linkLabel="Go to your account"
          >
            Past and upcoming bookings, receipts and cancellations live in your
            account — for students, staff and old boys alike.
          </FeatureCard>
        </div>
      </section> */}

      {/* Compact deep-green band closing the page, flush against the footer.
          Static copy for now — placeholders, to be replaced with real quotes. */}
      <TestimonialsBand
        label="What people say"
        title="From the people who use the courts."
        testimonials={TESTIMONIALS}
      />
    </>
  );
}
