import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarOff, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CourtGallery } from "@/components/public/court-gallery";
import { CourtBookingPanel } from "@/components/public/court-booking-panel";
import { AvailabilityDatePicker } from "@/components/public/date-picker";
import { getCourtAvailability } from "@/lib/availability";
import { prisma } from "@/lib/prisma";
import { MAX_DURATION_HOURS } from "@/lib/slots";
import {
  DAY_NAMES,
  addDays,
  dateStringToDate,
  formatDate,
  todayString,
} from "@/lib/time";

export const dynamic = "force-dynamic";

/** How far ahead the public may look. */
const BOOKING_WINDOW_DAYS = 60;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const court = await prisma.court.findFirst({
    where: { id, isActive: true },
    select: { name: true, description: true },
  });

  if (!court) return { title: "Court not found — Courtside" };

  return {
    title: `${court.name} — Courtside`,
    description:
      court.description ?? `Check availability and book ${court.name}.`,
  };
}

export default async function CourtDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    date?: string;
    slotId?: string;
    duration?: string;
    players?: string;
  }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  const court = await prisma.court.findFirst({
    // Inactive courts are hidden from the public site entirely.
    where: { id, isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      images: true,
      courtType: { select: { name: true, playerOptions: true } },
      slots: {
        where: { isActive: true },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        select: { dayOfWeek: true, price: true },
      },
    },
  });

  if (!court) notFound();

  const today = todayString();
  const maxDate = addDays(today, BOOKING_WINDOW_DAYS);

  // Clamp whatever the URL says into the bookable window.
  const requested = query.date && DATE_RE.test(query.date) ? query.date : today;
  const date =
    requested < today ? today : requested > maxDate ? maxDate : requested;

  const availability = await getCourtAvailability(
    court.id,
    dateStringToDate(date)
  );

  // A selection carried back from the review page's "Change" link — used to
  // pre-fill the panel so nothing is lost on the round trip. Only clean positive
  // integers are passed through; anything else is dropped and the panel falls
  // back to sensible defaults.
  const posInt = (v?: string) =>
    v && /^\d+$/.test(v) ? Number(v) : undefined;
  const initialSelection = {
    slotId: query.slotId,
    duration: posInt(query.duration),
    players: posInt(query.players),
  };

  // Which weekdays this court runs at all — useful when the chosen day is bare.
  const activeDays = [...new Set(court.slots.map((s) => s.dayOfWeek))].sort();

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-8">
      <Link
        href="/courts"
        className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All courts
      </Link>

      <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
        {/* Left: identity, photos, description */}
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl leading-none">{court.name}</h1>
              <Badge variant="secondary">{court.courtType.name}</Badge>
            </div>

            {court.courtType.playerOptions.length > 0 && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="size-4" />
                {court.courtType.playerOptions.join(" or ")} players
              </p>
            )}
          </div>

          <CourtGallery images={court.images} courtName={court.name} />

          {court.description && (
            <div className="flex flex-col gap-2">
              <h2 className="text-lg">About this court</h2>
              <p className="max-w-prose leading-relaxed whitespace-pre-line text-muted-foreground">
                {court.description}
              </p>
            </div>
          )}

          {activeDays.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-lg">Open on</h2>
              <div className="flex flex-wrap gap-1.5">
                {activeDays.map((day) => (
                  <Badge key={day} variant="outline">
                    {DAY_NAMES[day]}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: availability */}
        <aside className="flex flex-col gap-5 lg:sticky lg:top-8 lg:self-start">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl leading-none">Availability</h2>
            <p className="text-sm text-muted-foreground">
              {formatDate(dateStringToDate(date))}
              {availability.slots.length > 0 &&
                ` · ${availability.openCount} of ${availability.slots.length} open`}
            </p>
          </div>

          <AvailabilityDatePicker date={date} today={today} maxDate={maxDate} />

          {availability.slots.length === 0 ? (
            <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed px-5 py-8 text-sm text-muted-foreground">
              <CalendarOff className="size-5" />
              <span className="font-medium text-foreground">
                No slots on this day
              </span>
              <span>
                {activeDays.length > 0
                  ? `This court runs on ${activeDays.map((d) => DAY_NAMES[d]).join(", ")}. Try one of those.`
                  : "This court has no schedule set up yet."}
              </span>
            </div>
          ) : (
            <CourtBookingPanel
              courtId={court.id}
              date={date}
              slots={availability.slots}
              playerOptions={court.courtType.playerOptions}
              initial={initialSelection}
            />
          )}

          <p className="rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground">
            Click an hour to book it. Click a second hour to stretch the
            selection into one block — up to {MAX_DURATION_HOURS} consecutive
            open hours. Click again to start over. Nothing is reserved until you
            confirm.
          </p>
        </aside>
      </div>
    </div>
  );
}
