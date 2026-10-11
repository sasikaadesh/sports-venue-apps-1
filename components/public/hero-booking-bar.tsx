"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect } from "@/components/admin/native-select";
import type { SlotAvailability } from "@/lib/availability";
import { formatPrice } from "@/lib/time";

/**
 * Hero booking bar: court -> date -> start hour -> end hour -> players.
 *
 * Availability is fetched from /api/availability whenever the court or date
 * changes, so the start- and end-hour dropdowns only ever offer whole-hour slot
 * boundaries that are actually free. The end-hour dropdown offers only hours
 * that keep the whole start→end range continuously available (and within the
 * max session length); the booking stays a run of fixed 1-hour slots, with the
 * duration derived from end − start. The running total shown here is a
 * **preview** computed from the prices the API returned — the authoritative
 * total is summed on the server, on the review page and again inside the
 * booking service.
 *
 * Submitting reserves nothing. It carries the selection to /book, which
 * re-derives everything server-side and asks for confirmation.
 *
 * Note the shape of the state: the dependent fields hold what the user *asked
 * for*, and what is actually *used* is derived below. Availability shifts under
 * this form — an hour gets booked, a court is switched — and deriving means a
 * stale request quietly falls back to something valid instead of needing
 * effects to chase it.
 */

type AvailabilityResponse = {
  date: string;
  playerOptions: number[];
  slots: SlotAvailability[];
  /** Set when the date is today and the same-day cutoff has passed. */
  closedMessage: string | null;
};

/** A fetch result tagged with the selection it belongs to. */
type Loaded = { key: string; data: AvailabilityResponse | null };

export function HeroBookingBar({
  courts,
  today,
  maxDate,
}: {
  courts: { id: string; name: string }[];
  today: string;
  maxDate: string;
}) {
  const router = useRouter();

  const [courtId, setCourtId] = useState(courts[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [wantedSlotId, setWantedSlotId] = useState("");
  const [wantedDuration, setWantedDuration] = useState(1);
  const [wantedPlayers, setWantedPlayers] = useState<number | null>(null);

  const [loaded, setLoaded] = useState<Loaded | null>(null);

  // What the currently selected court and date are called, as one value. The
  // fetch tags its result with this, which is how "am I loading?" is answered
  // without a loading flag that has to be flipped in an effect.
  const key = `${courtId}|${date}`;

  useEffect(() => {
    if (!courtId || !date) return;

    const controller = new AbortController();

    fetch(
      `/api/availability?courtId=${encodeURIComponent(courtId)}&date=${encodeURIComponent(date)}`,
      { signal: controller.signal }
    )
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("failed"))
      )
      .then((data: AvailabilityResponse) => setLoaded({ key, data }))
      .catch(() => {
        // An aborted request is a superseded one, not a failure.
        if (controller.signal.aborted) return;
        setLoaded({ key, data: null });
      });

    return () => controller.abort();
  }, [courtId, date, key]);

  // Anything tagged with a different key belongs to a previous selection.
  const current = loaded?.key === key ? loaded : null;
  const loading = current === null;
  const failed = current !== null && current.data === null;
  const data = current?.data ?? null;

  const slots = data?.slots ?? [];
  const openSlots = slots.filter((s) => s.available);
  const playerOptions = data?.playerOptions ?? [];

  // --- Derived selections ---------------------------------------------------
  const selected =
    openSlots.find((s) => s.slotId === wantedSlotId) ?? openSlots[0] ?? null;

  // A 3-hour run shrinks to 1 the moment someone books the middle hour.
  const maxDuration = selected?.maxDuration ?? 1;
  const duration = Math.min(Math.max(wantedDuration, 1), maxDuration);

  const players =
    wantedPlayers !== null && playerOptions.includes(wantedPlayers)
      ? wantedPlayers
      : (playerOptions[0] ?? null);

  // Preview total: the chosen hour plus the ones after it. Safe to slice by
  // position, because maxDuration was itself computed by walking this array
  // and stopping at the first gap in the clock.
  const startIndex = selected ? slots.indexOf(selected) : -1;
  const chain =
    startIndex === -1 ? [] : slots.slice(startIndex, startIndex + duration);
  const total = chain.reduce((sum, slot) => sum + Number(slot.price), 0);
  const endsAt = chain.at(-1)?.endTime;

  // End-hour options: one per bookable duration 1..maxDuration. Each entry's
  // end time is the end of the run's last hour, so the dropdown lists only
  // whole-hour boundaries that keep start→end continuously free.
  const endOptions =
    selected && startIndex !== -1
      ? Array.from({ length: maxDuration }, (_, i) => ({
          duration: i + 1,
          endTime: slots[startIndex + i].endTime,
        }))
      : [];

  // Changing the start hour resets the end to +1 hour, so the range is always
  // valid for the new start rather than clamping a stale duration.
  function pickStart(slotId: string) {
    setWantedSlotId(slotId);
    setWantedDuration(1);
  }

  const canBook = Boolean(courtId && selected && players !== null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || players === null) return;

    const params = new URLSearchParams({
      courtId,
      date,
      slotId: selected.slotId,
      duration: String(duration),
      players: String(players),
    });

    router.push(`/book?${params.toString()}`);
  }

  // Small uppercase, letter-spaced label — the same treatment the brand's
  // "eyebrow" uses above a heading, scaled down for a form field, so the row
  // reads as designed rather than a stock browser form.
  const labelClass =
    "text-xs font-semibold tracking-wide text-muted-foreground uppercase";
  const fieldClass = "h-11";

  return (
    <form
      onSubmit={submit}
      className="relative flex flex-col gap-6 overflow-hidden rounded-xl border border-border/70 bg-card p-6 shadow-lg shadow-black/5 sm:p-7 dark:shadow-black/20"
    >
      {/* The one gold touch on this panel, echoing the footer's own rule —
          thin, top-of-card, green-to-gold. A signature, not decoration. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary via-primary to-gold"
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <Field>
          <FieldLabel htmlFor="hero-court" className={labelClass}>
            Court
          </FieldLabel>
          <NativeSelect
            id="hero-court"
            value={courtId}
            onChange={(e) => setCourtId(e.target.value)}
            className={fieldClass}
          >
            {courts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor="hero-date" className={labelClass}>
            Date
          </FieldLabel>
          <Input
            id="hero-date"
            type="date"
            value={date}
            min={today}
            max={maxDate}
            onChange={(e) => setDate(e.target.value)}
            className={fieldClass}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="hero-start" className={labelClass}>
            Start
          </FieldLabel>
          <NativeSelect
            id="hero-start"
            value={selected?.slotId ?? ""}
            disabled={loading || openSlots.length === 0}
            onChange={(e) => pickStart(e.target.value)}
            className={fieldClass}
          >
            {openSlots.length === 0 ? (
              <option value="">{loading ? "Loading…" : "None free"}</option>
            ) : (
              openSlots.map((slot) => (
                <option key={slot.slotId} value={slot.slotId}>
                  {slot.startTime}
                </option>
              ))
            )}
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor="hero-end" className={labelClass}>
            End
          </FieldLabel>
          <NativeSelect
            id="hero-end"
            value={String(duration)}
            disabled={!selected}
            onChange={(e) => setWantedDuration(Number(e.target.value))}
            className={fieldClass}
          >
            {/* Only end hours that keep every hour in between free and contiguous. */}
            {endOptions.map((opt) => (
              <option key={opt.duration} value={opt.duration}>
                {opt.endTime}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor="hero-players" className={labelClass}>
            Players
          </FieldLabel>
          <NativeSelect
            id="hero-players"
            value={players === null ? "" : String(players)}
            disabled={playerOptions.length === 0}
            onChange={(e) => setWantedPlayers(Number(e.target.value))}
            className={fieldClass}
          >
            {playerOptions.length === 0 ? (
              <option value="">—</option>
            ) : (
              // Driven by the court's type, so it changes with the court.
              playerOptions.map((count) => (
                <option key={count} value={count}>
                  {count} {count === 1 ? "person" : "players"}
                </option>
              ))
            )}
          </NativeSelect>
        </Field>
      </div>

      <div className="flex flex-col gap-4 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite" className="min-w-0">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Checking availability…
            </p>
          ) : failed ? (
            <p className="text-sm text-muted-foreground">
              Could not load availability. Try again.
            </p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This court has no slots on that day.
            </p>
          ) : !selected && data?.closedMessage ? (
            <p className="text-sm text-muted-foreground">
              {data.closedMessage}
            </p>
          ) : !selected ? (
            <p className="text-sm text-muted-foreground">
              Fully booked that day — try another date.
            </p>
          ) : (
            // Hierarchy: the time/duration line is supporting detail, kept
            // small and muted; the price is the number people actually came
            // for, so it gets the serif-adjacent weight and the brand green.
            <div className="flex flex-col gap-0.5">
              <p className="font-mono text-sm text-muted-foreground">
                {selected.startTime} – {endsAt ?? selected.endTime}
                {" · "}
                {duration} {duration === 1 ? "hour" : "hours"}
              </p>
              <p className="text-2xl font-semibold text-primary">
                {formatPrice(total)}
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  total
                </span>
              </p>
            </div>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          className="h-11 w-full px-6 shadow-sm transition-shadow hover:shadow-md sm:w-auto"
          disabled={!canBook}
        >
          Continue
          <ArrowRight />
        </Button>
      </div>
    </form>
  );
}
