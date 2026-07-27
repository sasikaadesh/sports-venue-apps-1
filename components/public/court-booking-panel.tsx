"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Clock, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect } from "@/components/admin/native-select";
import { RemoveSelectionDialog } from "@/components/public/remove-selection-dialog";
import type { SlotAvailability } from "@/lib/availability";
import { MAX_DURATION_HOURS } from "@/lib/slots";
import { formatPrice } from "@/lib/time";

/**
 * Interactive availability + booking selector for the court detail page.
 *
 * The hourly list *is* the selector: click an open hour to book it (1 hour),
 * click a second open hour to stretch the selection into one continuous block
 * from the earlier to the later hour, click again to start over. There are no
 * Start/End dropdowns here — the range is the selection.
 *
 * A range is only allowed when every hour inside it is open and the hours are
 * back-to-back on the clock, up to `MAX_DURATION_HOURS`. An attempt that
 * crosses a booked/blocked/past hour or a break in the schedule is refused with
 * a message and leaves the first pick in place, so the user can try another
 * second hour without starting over.
 *
 * Still one booking only: one court, one run of consecutive hours. Nothing is
 * reserved here — "Review booking" carries `slotId` + `duration` to /book,
 * which re-derives the chain, re-prices it and reserves it atomically
 * server-side. This component only changes how that pair gets chosen.
 */

type Selection = {
  /** Index into `slots` of the first hour. */
  start: number;
  /** Index into `slots` of the last hour (inclusive). */
  end: number;
  /**
   * False right after the first click: the next click on an open hour extends
   * this selection. True once a range is settled: the next click starts fresh.
   */
  complete: boolean;
};

export function CourtBookingPanel({
  courtId,
  date,
  slots,
  playerOptions,
  initial,
}: {
  courtId: string;
  date: string;
  slots: SlotAvailability[];
  playerOptions: number[];
  initial?: { slotId?: string; duration?: number; players?: number };
}) {
  const router = useRouter();

  /**
   * Why a range of `slots` indices can't be booked, or null when it can.
   * Used both to judge a click and to re-check a selection on every render, so
   * an hour taken out from under the user can't survive as a stale selection.
   */
  function rangeProblem(lo: number, hi: number): string | null {
    if (lo < 0 || hi >= slots.length) return "That hour is no longer offered.";

    if (hi - lo + 1 > MAX_DURATION_HOURS) {
      return `One booking can run up to ${MAX_DURATION_HOURS} consecutive hours.`;
    }

    for (let i = lo; i <= hi; i++) {
      if (!slots[i].available) {
        return `${slots[i].startTime} isn't available, so it can't be part of a booking. Pick hours that are open end to end.`;
      }
    }

    // Contiguity is judged on the clock, not on position in the list — a court
    // that runs 09:00–10:00 then 14:00–15:00 has no 2-hour booking there.
    for (let i = lo; i < hi; i++) {
      if (slots[i].endTime !== slots[i + 1].startTime) {
        return `There's a break in the schedule after ${slots[i].endTime} — a booking has to be back-to-back hours.`;
      }
    }

    return null;
  }

  // A selection carried back from the review page arrives as slotId + duration;
  // turn it into a range once, and drop it if it no longer holds up.
  const [selection, setSelection] = useState<Selection | null>(() => {
    const start = slots.findIndex((s) => s.slotId === initial?.slotId);
    if (start === -1) return null;
    const end = start + Math.max(initial?.duration ?? 1, 1) - 1;
    if (rangeProblem(start, end)) return null;
    return { start, end, complete: true };
  });
  const [wantedPlayers, setWantedPlayers] = useState<number | null>(
    initial?.players ?? null
  );
  // Why the last click was refused. Cleared by any click that lands.
  const [refused, setRefused] = useState<string | null>(null);
  // Hovered row while a second click is pending, for a live preview.
  const [hovered, setHovered] = useState<number | null>(null);

  // Re-validate every render: the slots prop is fresh from the server on each
  // date change, and a selection that no longer works is no selection.
  const range = selection && !rangeProblem(selection.start, selection.end)
    ? selection
    : null;

  const players =
    wantedPlayers !== null && playerOptions.includes(wantedPlayers)
      ? wantedPlayers
      : (playerOptions[0] ?? null);

  const chain = range ? slots.slice(range.start, range.end + 1) : [];
  const duration = chain.length;
  const total = chain.reduce((sum, slot) => sum + Number(slot.price), 0);

  // Preview of the range the hovered row would produce, while the second click
  // is still pending. Shown even when it's refused, so the gap is visible.
  const pending = range && !range.complete ? range : null;
  const preview =
    pending && hovered !== null
      ? {
          lo: Math.min(pending.start, hovered),
          hi: Math.max(pending.start, hovered),
        }
      : null;
  const previewProblem = preview ? rangeProblem(preview.lo, preview.hi) : null;

  /**
   * Click an open hour. First click picks a 1-hour booking; the second sets the
   * range; a click after that starts fresh.
   */
  function pick(index: number) {
    setHovered(null);

    if (!range || range.complete) {
      setSelection({ start: index, end: index, complete: false });
      setRefused(null);
      return;
    }

    const lo = Math.min(range.start, index);
    const hi = Math.max(range.start, index);

    const problem = rangeProblem(lo, hi);
    if (problem) {
      // Keep the first pick so a different second hour can be tried.
      setRefused(problem);
      return;
    }

    setSelection({ start: lo, end: hi, complete: true });
    setRefused(null);
  }

  /** Clear the (unconfirmed, unpaid) selection back to the empty state. */
  function clearSelection() {
    setSelection(null);
    setWantedPlayers(null);
    setRefused(null);
    setHovered(null);
  }

  const canBook = Boolean(range && players !== null);

  function review() {
    if (!range || players === null) return;
    const params = new URLSearchParams({
      courtId,
      date,
      slotId: slots[range.start].slotId,
      duration: String(duration),
      players: String(players),
    });
    router.push(`/book?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {slots.map((slot, index) => {
          if (!slot.available) {
            return (
              <li
                key={slot.slotId}
                className="flex items-center justify-between gap-4 rounded-xl border border-dashed bg-muted/40 px-4 py-3"
              >
                <span className="flex items-center gap-2.5">
                  <Clock className="size-4 text-muted-foreground" />
                  <span className="font-mono text-sm text-muted-foreground line-through">
                    {slot.startTime} – {slot.endTime}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {formatPrice(slot.price)}
                  </span>
                  <Badge variant="secondary">
                    {slot.reason === "past"
                      ? "Passed"
                      : slot.reason === "blocked"
                        ? "Unavailable"
                        : "Booked"}
                  </Badge>
                </span>
              </li>
            );
          }

          const inRange = Boolean(
            range && index >= range.start && index <= range.end
          );
          const inPreview = Boolean(
            preview && index >= preview.lo && index <= preview.hi
          );
          // A refused preview paints red rather than green, so the reason (a
          // taken hour in the middle) is visible before the click.
          const bad = inPreview && previewProblem !== null;
          const good = inRange || (inPreview && !previewProblem);

          // The block reads as one piece: a rail through the gap joins each
          // selected hour to the next one.
          const joined =
            good &&
            index < slots.length - 1 &&
            ((inRange && range && index < range.end) ||
              (inPreview && preview && index < preview.hi));

          const label =
            !inRange || !range
              ? null
              : range.start === range.end
                ? "Selected"
                : index === range.start
                  ? "Start"
                  : index === range.end
                    ? "End"
                    : null;

          return (
            <li key={slot.slotId} className="relative">
              <button
                type="button"
                onClick={() => pick(index)}
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() =>
                  setHovered((h) => (h === index ? null : h))
                }
                onFocus={() => setHovered(index)}
                onBlur={() => setHovered((h) => (h === index ? null : h))}
                aria-pressed={inRange}
                className={`flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-colors ${
                  // A 5% tint is legible on white but vanishes against a
                  // near-black surface, so the dark theme gets a stronger one.
                  // The border and ring carry the state in both.
                  bad
                    ? "cursor-not-allowed border-destructive bg-destructive/5 ring-1 ring-destructive dark:bg-destructive/15"
                    : good
                      ? "border-primary bg-primary/5 ring-1 ring-primary dark:bg-primary/15"
                      : "bg-card hover:border-primary"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Clock
                    className={`size-4 ${bad ? "text-destructive" : "text-primary"}`}
                  />
                  <span className="font-mono text-sm font-medium">
                    {slot.startTime} – {slot.endTime}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-sm font-medium">
                    {formatPrice(slot.price)}
                  </span>
                  {label ? (
                    <Badge variant="default">{label}</Badge>
                  ) : inRange ? (
                    <Badge variant="secondary">Included</Badge>
                  ) : (
                    <Badge variant="outline">Open</Badge>
                  )}
                </span>
              </button>

              {joined && (
                <span
                  aria-hidden
                  className={`absolute top-full left-6 h-2 w-0.5 ${
                    bad ? "bg-destructive" : "bg-primary"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ul>

      {refused && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {refused}
        </p>
      )}

      {range && (
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <Field className="w-40">
              <FieldLabel htmlFor="panel-players" className="text-sm font-medium">
                Players
              </FieldLabel>
              <NativeSelect
                id="panel-players"
                value={players === null ? "" : String(players)}
                disabled={playerOptions.length === 0}
                onChange={(e) => setWantedPlayers(Number(e.target.value))}
              >
                {playerOptions.length === 0 ? (
                  <option value="">—</option>
                ) : (
                  playerOptions.map((count) => (
                    <option key={count} value={count}>
                      {count} players
                    </option>
                  ))
                )}
              </NativeSelect>
            </Field>

            {!range.complete && (
              <p className="text-xs text-muted-foreground">
                Click another open hour to extend the block, or review it as one
                hour.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              <span className="font-mono text-foreground">
                {chain[0].startTime} – {chain[chain.length - 1].endTime}
              </span>
              {" · "}
              <span className="text-foreground">
                {duration} {duration === 1 ? "hour" : "hours"}
              </span>
              {" · "}
              <span className="font-medium text-foreground">
                {formatPrice(total)}
              </span>{" "}
              total
            </p>

            <div className="flex items-center gap-2">
              <RemoveSelectionDialog
                onConfirm={clearSelection}
                triggerClassName="h-10"
              />
              <Button onClick={review} disabled={!canBook} className="h-10 px-5">
                Review booking
                <ArrowRight />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
