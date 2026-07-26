import { ArrowRight, CalendarCheck, CreditCard, Search } from "lucide-react";

import { LinkButton } from "@/components/link-button";
import { CourtCard } from "@/components/public/court-card";
import { HeroBookingBar } from "@/components/public/hero-booking-bar";
import { HeroCarousel } from "@/components/public/hero-carousel";
import { BOOKING_WINDOW_DAYS } from "@/lib/booking-service";
import { prisma } from "@/lib/prisma";
import { addDays, todayString } from "@/lib/time";

// Availability changes as people book, so never serve a cached landing page.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const courts = await prisma.court.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      images: true,
      courtType: { select: { name: true } },
      slots: {
        where: { isActive: true },
        orderBy: { price: "asc" },
        take: 1,
        select: { price: true },
      },
    },
  });

  const featured = courts.slice(0, 6);
  const today = todayString();
  const maxDate = addDays(today, BOOKING_WINDOW_DAYS);

  return (
    <>
      {/* Low, simple hero — a clean band, not a full-screen takeover. */}
      <section className="border-b">
        {/* Headline band: photo carousel behind, white text over a dark overlay. */}
        <div className="relative isolate overflow-hidden">
          <HeroCarousel />
          <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-8 lg:py-28">
            <div className="flex max-w-2xl flex-col items-start gap-5">
              <h1 className="text-5xl leading-[1.02] text-white sm:text-6xl">
                Your court.
                <br />
                Your slot.
                <br />
                <span className="text-primary">Sorted.</span>
              </h1>
              <p className="max-w-lg text-lg leading-relaxed text-white/80">
                Cricket nets, tennis, table tennis and more. See what&apos;s
                free, grab the slot, and pay online — no phone calls, no
                clipboard.
              </p>
            </div>
          </div>
        </div>

        {/* Booking bar band: solid surface, kept clear of the carousel. */}
        <div className="bg-muted/40">
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
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl leading-none">
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
          <p className="rounded-xl border border-dashed px-6 py-10 text-sm text-muted-foreground">
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
                    typeName: court.courtType.name,
                    image: court.images[0] ?? null,
                    fromPrice: court.slots[0]?.price.toString() ?? null,
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* How it works — three steps, left-aligned, no centred everything. */}
      <section className="border-t bg-muted/40">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8">
          <h2 className="pb-8 text-3xl leading-none">How it works</h2>

          <ol className="grid gap-8 sm:grid-cols-3">
            {[
              {
                icon: Search,
                title: "Find a court",
                body: "Browse by sport, check the photos and the hourly price.",
              },
              {
                icon: CalendarCheck,
                title: "Pick your slot",
                body: "Choose a date and see exactly which hours are still open.",
              },
              {
                icon: CreditCard,
                title: "Pay and play",
                body: "Confirm online. Your slot is held while you check out.",
              },
            ].map((step, i) => (
              <li key={step.title} className="flex flex-col items-start gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
                  <step.icon className="size-5" />
                </span>
                <h3 className="text-lg">
                  <span className="text-muted-foreground">0{i + 1}. </span>
                  {step.title}
                </h3>
                <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
