import { getCourtAvailability } from "@/lib/availability";
import { BOOKING_WINDOW_DAYS } from "@/lib/booking-service";
import { prisma } from "@/lib/prisma";
import { addDays, dateStringToDate, todayString } from "@/lib/time";

/**
 * Availability for a court on a date, for the hero booking bar.
 *
 * The hero lets you change court and date without a page load, so it needs
 * availability client-side. Everything here is public catalogue data — the
 * public site is browsable signed out (PRD) — so there is no auth gate. It is
 * strictly read-only: it can tell you an hour is free, it cannot reserve it.
 *
 * The response is advisory. The booking service re-derives the chain, the
 * duration and the price from the database before writing, so a doctored
 * response buys nothing.
 */

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const courtId = searchParams.get("courtId") ?? "";
  const requestedDate = searchParams.get("date") ?? "";

  if (!UUID_RE.test(courtId)) {
    return Response.json({ error: "Unknown court." }, { status: 400 });
  }

  if (!DATE_RE.test(requestedDate)) {
    return Response.json({ error: "Invalid date." }, { status: 400 });
  }

  // Clamp into the bookable window rather than trusting the query string.
  const today = todayString();
  const maxDate = addDays(today, BOOKING_WINDOW_DAYS);
  const date =
    requestedDate < today
      ? today
      : requestedDate > maxDate
        ? maxDate
        : requestedDate;

  const court = await prisma.court.findFirst({
    where: { id: courtId, isActive: true },
    select: {
      id: true,
      name: true,
      courtType: { select: { playerOptions: true } },
    },
  });

  if (!court) {
    return Response.json({ error: "Unknown court." }, { status: 404 });
  }

  const availability = await getCourtAvailability(
    court.id,
    dateStringToDate(date)
  );

  return Response.json(
    {
      courtId: court.id,
      date: availability.date,
      // The players dropdown is driven by the court's type, so it has to come
      // back with the slots — the selected court can change client-side.
      playerOptions: court.courtType.playerOptions,
      slots: availability.slots,
      openCount: availability.openCount,
    },
    // Availability changes as people book; a cached answer would offer hours
    // that are already gone.
    { headers: { "Cache-Control": "no-store" } }
  );
}
