/**
 * The URL shape of a booking selection.
 *
 * A selection (court, date, start hour, duration, players) lives entirely in
 * the query string — nothing about it is held server-side until the user
 * confirms and the booking service writes a `pending` hold. That is what lets
 * the selection survive a sign-in round trip: the return URL *is* the
 * selection, so there is no half-made booking to reconcile afterwards and the
 * hold/double-booking logic is never entered by a signed-out visitor.
 *
 * These two builders exist so the review page, the court page's "Change" link
 * and the booking action cannot drift apart on the parameter names — a
 * mismatch would silently drop the user's choice back to a default.
 */

export type BookingSelection = {
  courtId: string;
  /** `YYYY-MM-DD`, the venue's calendar date. */
  bookingDate: string;
  startSlotId: string;
  durationHours: number;
  playerCount: number;
};

/** The review step — `/book`, which re-validates and re-prices server-side. */
export function bookingReviewPath(selection: BookingSelection): string {
  const params = selectionParams(selection);
  params.set("courtId", selection.courtId);
  return `/book?${params}`;
}

/**
 * The court's availability page with the selection re-filled, so any one field
 * can be adjusted without losing the other four.
 */
export function courtSelectionPath(selection: BookingSelection): string {
  // No `courtId` parameter — the path already names the court.
  return `/courts/${selection.courtId}?${selectionParams(selection)}`;
}

/** The four fields both paths share. `/book` adds `courtId` on top. */
function selectionParams({
  bookingDate,
  startSlotId,
  durationHours,
  playerCount,
}: BookingSelection): URLSearchParams {
  return new URLSearchParams({
    date: bookingDate,
    slotId: startSlotId,
    duration: String(durationHours),
    players: String(playerCount),
  });
}
