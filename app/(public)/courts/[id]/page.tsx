import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarOff,
  CircleCheck,
  Clock,
  Users,
} from "lucide-react";

import { Eyebrow } from "@/components/brand/eyebrow";
import { Badge } from "@/components/ui/badge";
import { CourtGallery } from "@/components/public/court-gallery";
import { CourtBookingPanel } from "@/components/public/court-booking-panel";
import { AvailabilityDatePicker } from "@/components/public/date-picker";
import { SpecialRequestDialog } from "@/components/public/special-request-dialog";
import { getCurrentUser } from "@/lib/auth";
import { getCourtAvailability } from "@/lib/availability";
import { getCourtDetail } from "@/lib/catalogue";
import { courtRulesFor } from "@/lib/court-rules";
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
  // Same cached read the page itself uses, so generating metadata costs no
  // extra database round trip.
  const court = await getCourtDetail(id);

  if (!court) return { title: "Court not found" };

  return {
    title: `${court.name}`,
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

  // The court's own record (name, photos, type, which weekdays it runs) is
  // cached and tag-invalidated; inactive courts are hidden from the public site
  // entirely. Availability below is NOT cached — it is read live, per date.
  const court = await getCourtDetail(id);

  if (!court) notFound();

  const today = todayString();
  const maxDate = addDays(today, BOOKING_WINDOW_DAYS);

  // Clamp whatever the URL says into the bookable window.
  const requested = query.date && DATE_RE.test(query.date) ? query.date : today;
  const date =
    requested < today ? today : requested > maxDate ? maxDate : requested;

  const [availability, user] = await Promise.all([
    getCourtAvailability(court.id, dateStringToDate(date)),
    getCurrentUser(),
  ]);

  // A selection carried back from the review page's "Change" link — used to
  // pre-fill the panel so nothing is lost on the round trip. Only clean positive
  // integers are passed through; anything else is dropped and the panel falls
  // back to sensible defaults.
  const posInt = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : undefined);
  const initialSelection = {
    slotId: query.slotId,
    duration: posInt(query.duration),
    players: posInt(query.players),
  };

  // Which weekdays this court runs at all — useful when the chosen day is bare.
  const activeDays = court.activeDays;

  const { rules: courtRules } = courtRulesFor(court.rules, court.typeName);

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
              {/* Only shown when it adds information — a court named after its
                  own type (e.g. a "Badminton" court of type "Badminton") would
                  otherwise repeat the title right next to it. */}
              {court.typeName.toLowerCase() !== court.name.toLowerCase() && (
                <Badge variant="secondary">{court.typeName}</Badge>
              )}
            </div>

            {court.playerOptions.length > 0 && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="size-4" />
                {court.playerOptions.join(" or ")}{" "}
                {court.playerOptions.length === 1 &&
                court.playerOptions[0] === 1
                  ? "person per booking"
                  : "players"}
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

          {court.amenities && (
            <div className="flex flex-col gap-2">
              <h2 className="text-lg">Amenities</h2>
              <div className="flex flex-wrap gap-1.5">
                {court.amenities
                  .split(",")
                  .map((a) => a.trim())
                  .filter(Boolean)
                  .map((amenity) => (
                    <Badge key={amenity} variant="outline">
                      {amenity}
                    </Badge>
                  ))}
              </div>
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

          {/* Court rules — the court's own list, or the standard set. The
              venue-wide rules (parking, medical, weather) live on /rules and
              are linked rather than repeated on every court. */}
          <section
            aria-labelledby="court-rules-heading"
            className="flex flex-col gap-4 rounded-lg border border-border bg-tint-strong p-6 sm:p-7"
          >
            <div className="flex flex-col gap-1.5">
              <Eyebrow tone="green">Before you play</Eyebrow>
              <h2 id="court-rules-heading" className="text-xl leading-snug">
                Court rules
              </h2>
            </div>

            <ul className="flex flex-col gap-2.5">
              {courtRules.map((rule) => (
                <li
                  key={rule}
                  className="flex items-start gap-2.5 text-[0.9375rem] leading-relaxed"
                >
                  <CircleCheck
                    aria-hidden="true"
                    className="mt-1 size-4 shrink-0 text-primary"
                  />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>

            <p className="border-t border-border pt-4 text-sm text-muted-foreground">
              The venue rules apply too — parking, medical cover and bad
              weather.{" "}
              <Link
                href="/rules"
                className="font-medium text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary"
              >
                Read the rules &amp; regulations
              </Link>
            </p>
          </section>
        </div>

        {/* Right: availability */}
        <aside className="flex flex-col gap-5 lg:sticky lg:top-8 lg:self-start">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl leading-none">Availability</h2>
            <p className="text-sm text-muted-foreground">
              {formatDate(dateStringToDate(date))}
              {availability.slots.length > 0 &&
                ` · ${availability.openCount} of ${availability.slots.length} Available`}
            </p>
          </div>

          <p className="rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground">
            Click an hour to book it. Click a second hour to stretch the
            selection into one block — up to {MAX_DURATION_HOURS} consecutive
            available hours. Click again to start over. Nothing is reserved
            until you confirm.
            {availability.bookingMode === "shared" &&
              " This is a shared facility: booking reserves your place in the session, and the hour stays open to other members."}
          </p>

          <AvailabilityDatePicker date={date} today={today} maxDate={maxDate} />

          {availability.closedMessage && availability.slots.length > 0 && (
            <p
              role="status"
              className="flex items-start gap-2 rounded-xl border px-4 py-3 text-sm"
            >
              <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              {availability.closedMessage}
            </p>
          )}

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
              playerOptions={court.playerOptions}
              initial={initialSelection}
            />
          )}

          <div className="flex flex-col items-start gap-2 border-t pt-5">
            <p className="text-sm text-muted-foreground">
              Need something the times above don&apos;t cover?
            </p>
            <SpecialRequestDialog
              courtId={court.id}
              courtName={court.name}
              playerOptions={court.playerOptions}
              signedIn={!!user}
              returnTo={`/courts/${court.id}`}
              defaultDate={date}
              minDate={today}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
