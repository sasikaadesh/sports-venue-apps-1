"use client";

import { useRef, useState, useTransition } from "react";
import {
  CalendarPlus,
  Check,
  ChevronDown,
  Copy,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, FieldLabel } from "@/components/ui/field";
import { DAY_NAMES, formatPrice } from "@/lib/time";
import {
  clearDaySchedule,
  copyDaySchedule,
  deleteSlotTemplate,
  generateDaySchedule,
  setAllDaysRate,
  setDayActive,
  setDayRate,
  setSlotActive,
  updateSlotPrice,
} from "@/app/admin/courts/actions";

export type SlotRow = {
  id: string;
  dayOfWeek: number;
  startTime: string; // "09:00"
  endTime: string; // "10:00"
  price: string;
  isActive: boolean;
  bookingCount: number;
};

// Monday-first so the schedule reads like a normal week; Sunday (0) trails.
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function SlotTemplateManager({
  courtId,
  slots,
}: {
  courtId: string;
  slots: SlotRow[];
}) {
  const byDay = DISPLAY_ORDER.map((day) => ({
    day,
    name: DAY_NAMES[day],
    slots: slots
      .filter((s) => s.dayOfWeek === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
  }));

  return (
    <div className="flex flex-col gap-4">
      {byDay.map((group) =>
        group.slots.length === 0 ? (
          <EmptyDay
            key={group.day}
            courtId={courtId}
            day={group.day}
            name={group.name}
          />
        ) : (
          <DaySection
            key={group.day}
            courtId={courtId}
            day={group.day}
            name={group.name}
            slots={group.slots}
          />
        )
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// A weekday with no schedule yet — offer to generate one from a range + rate.
// ---------------------------------------------------------------------------

function EmptyDay({
  courtId,
  day,
  name,
}: {
  courtId: string;
  day: number;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState("06:00");
  const [end, setEnd] = useState("22:00");
  const [rate, setRate] = useState("1000");
  const [pending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      const result = await generateDaySchedule({
        courtId,
        dayOfWeek: day,
        startTime: start,
        endTime: end,
        price: Number(rate),
      });
      if (result.ok) {
        toast.success(`${name}: ${result.data.count} hourly slots created.`);
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <section className="rounded-2xl border border-dashed bg-card/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium">{name}</h3>
          <span className="text-xs text-muted-foreground">
            Closed — no hours yet
          </span>
        </div>
        {!open && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <CalendarPlus />
            Set up
          </Button>
        )}
      </div>

      {open && (
        <div className="mt-5 grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field>
            <FieldLabel htmlFor={`open-${day}`} className="text-sm font-medium">
              Opens
            </FieldLabel>
            <Input
              id={`open-${day}`}
              type="time"
              step={3600}
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="h-10 rounded-xl"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`close-${day}`} className="text-sm font-medium">
              Closes
            </FieldLabel>
            <Input
              id={`close-${day}`}
              type="time"
              step={3600}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="h-10 rounded-xl"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`rate-${day}`} className="text-sm font-medium">
              Rate / hour (LKR)
            </FieldLabel>
            <Input
              id={`rate-${day}`}
              type="number"
              min={0}
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="h-10 rounded-xl"
            />
          </Field>
          <div className="flex items-center gap-2">
            <Button onClick={generate} disabled={pending} className="h-10">
              <Check />
              {pending ? "Generating…" : "Generate"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-10"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// A weekday with a schedule — per-hour controls plus whole-day operations.
// ---------------------------------------------------------------------------

function DaySection({
  courtId,
  day,
  name,
  slots,
}: {
  courtId: string;
  day: number;
  name: string;
  slots: SlotRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const anyActive = slots.some((s) => s.isActive);

  // Is every hour on the day the same price? That decides both the summary line
  // and what the primary rate input shows.
  const prices = slots.map((s) => s.price);
  const uniform = prices.every((p) => p === prices[0]);
  const uniformPrice = uniform ? prices[0] : null;

  // The primary control: the day's rate. When the hours share a price it shows
  // that; when they differ it starts blank and the summary reads "mixed rates".
  const [rate, setRate] = useState(uniformPrice ?? "");
  // Keep the input in step with the server value, so an "Apply to all days"
  // fired from another weekday updates this one's field too. Guarded so it only
  // resyncs when the underlying uniform price actually changes.
  const syncedTo = useRef(uniformPrice);
  if (syncedTo.current !== uniformPrice) {
    syncedTo.current = uniformPrice;
    setRate(uniformPrice ?? "");
  }

  function flashSaved(message: string) {
    setSaved(message);
    window.setTimeout(() => setSaved((s) => (s === message ? null : s)), 2500);
  }

  function toggleDay(open: boolean) {
    startTransition(async () => {
      const result = await setDayActive({
        courtId,
        dayOfWeek: day,
        isActive: open,
      });
      if (result.ok) toast.success(open ? `${name} opened.` : `${name} closed.`);
      else toast.error(result.error);
    });
  }

  function applyToDay() {
    if (rate.trim() === "") {
      toast.error("Enter a rate first.");
      return;
    }
    startTransition(async () => {
      const result = await setDayRate({
        courtId,
        dayOfWeek: day,
        price: Number(rate),
      });
      if (result.ok) {
        flashSaved(`Saved — ${name} at ${formatPrice(rate)}/hour`);
        toast.success(`${name}: all ${result.data.count} hours updated.`);
      } else {
        toast.error(result.error);
      }
    });
  }

  function applyToAll() {
    if (rate.trim() === "") {
      toast.error("Enter a rate first.");
      return;
    }
    startTransition(async () => {
      const result = await setAllDaysRate({ courtId, price: Number(rate) });
      if (result.ok) {
        flashSaved(`Saved — every day at ${formatPrice(rate)}/hour`);
        toast.success(`Every weekday updated (${result.data.count} hours).`);
      } else {
        toast.error(result.error);
      }
    });
  }

  const summary = uniform
    ? `${slots.length} hour${slots.length === 1 ? "" : "s"} · ${formatPrice(
        prices[0]
      )}/hour`
    : `${slots.length} hours · mixed rates`;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium">{name}</h3>
          {!anyActive && <Badge variant="outline">Closed</Badge>}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={anyActive}
              disabled={pending}
              onCheckedChange={toggleDay}
            />
            <span className="font-medium">{anyActive ? "Open" : "Closed"}</span>
          </label>
          <CopyControl courtId={courtId} day={day} name={name} />
          <ClearControl
            courtId={courtId}
            day={day}
            name={name}
            canClear={slots.every((s) => s.bookingCount === 0)}
          />
        </div>
      </div>

      {/* Primary control: one rate for the whole day, applied immediately. */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-muted/30 p-4">
        <Field className="w-40">
          <FieldLabel htmlFor={`rate-${day}`} className="text-sm font-medium">
            Rate (LKR/hour)
          </FieldLabel>
          <Input
            id={`rate-${day}`}
            type="number"
            min={0}
            step="0.01"
            value={rate}
            disabled={pending}
            placeholder={uniform ? undefined : "mixed"}
            onChange={(e) => setRate(e.target.value)}
            className="h-10 rounded-xl"
          />
        </Field>

        <Button onClick={applyToDay} disabled={pending} className="h-10">
          <Check />
          Apply to this day
        </Button>
        <Button
          variant="outline"
          onClick={applyToAll}
          disabled={pending}
          className="h-10"
        >
          Apply to all days
        </Button>

        {saved && (
          <span
            role="status"
            aria-live="polite"
            className="flex items-center gap-1.5 text-sm font-medium text-primary"
          >
            <Check className="size-4" />
            {saved}
          </span>
        )}
      </div>

      {/* Individual hours are opt-in — most days want one flat rate. */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-2 self-start text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          aria-expanded={expanded}
        >
          <SlidersHorizontal className="size-4" />
          Customize individual hours
          <ChevronDown
            className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
          {!expanded && (
            <span className="font-normal text-muted-foreground/80">
              — {summary}
            </span>
          )}
        </button>

        {expanded && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {slots.map((slot) => (
              // Key on the price so a bulk update remounts the row and its
              // input shows the new value immediately, not the stale local one.
              <HourRow key={`${slot.id}:${slot.price}`} slot={slot} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function HourRow({ slot }: { slot: SlotRow }) {
  const [pending, startTransition] = useTransition();
  const [price, setPrice] = useState(slot.price);

  function commitPrice() {
    if (price.trim() === "" || price === slot.price) {
      setPrice(slot.price);
      return;
    }
    startTransition(async () => {
      const result = await updateSlotPrice({
        slotId: slot.id,
        price: Number(price),
      });
      if (result.ok) toast.success("Rate updated.");
      else {
        toast.error(result.error);
        setPrice(slot.price);
      }
    });
  }

  function toggle(active: boolean) {
    startTransition(async () => {
      const result = await setSlotActive(slot.id, active);
      if (!result.ok) toast.error(result.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteSlotTemplate(slot.id);
      if (result.ok) toast.success("Hour removed.");
      else toast.error(result.error);
    });
  }

  return (
    <li
      data-inactive={!slot.isActive}
      className="flex items-center justify-between gap-3 rounded-xl border bg-background px-3.5 py-2.5 data-[inactive=true]:opacity-60"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="font-mono text-sm font-medium">
          {slot.startTime}–{slot.endTime}
        </span>
        {!slot.isActive && (
          <Badge variant="secondary" className="px-1.5 text-[10px]">
            Off
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border bg-muted/40 pl-2">
          <span className="text-[10px] font-medium text-muted-foreground">
            LKR
          </span>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={price}
            disabled={pending}
            aria-label={`Rate for ${slot.startTime}`}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={commitPrice}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="h-8 w-20 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
          />
        </div>

        <Switch
          checked={slot.isActive}
          disabled={pending}
          onCheckedChange={toggle}
          aria-label={`Toggle ${slot.startTime}`}
        />

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={remove}
          disabled={pending || slot.bookingCount > 0}
          title={
            slot.bookingCount > 0
              ? "This hour has bookings — switch it off instead"
              : "Remove this hour"
          }
          aria-label="Remove hour"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Whole-day controls: copy-to-days, clear.
// ---------------------------------------------------------------------------

function CopyControl({
  courtId,
  day,
  name,
}: {
  courtId: string;
  day: number;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<number[]>([]);
  const [pending, startTransition] = useTransition();

  const others = DISPLAY_ORDER.filter((d) => d !== day);

  function toggleTarget(d: number, checked: boolean) {
    setTargets((prev) =>
      checked ? [...prev, d] : prev.filter((x) => x !== d)
    );
  }

  function copy() {
    if (targets.length === 0) {
      toast.error("Pick at least one day.");
      return;
    }
    startTransition(async () => {
      const result = await copyDaySchedule({
        courtId,
        fromDay: day,
        toDays: targets,
      });
      if (result.ok) {
        toast.success(
          `Copied ${name} to ${result.data.days} day${
            result.data.days === 1 ? "" : "s"
          }.`
        );
        setOpen(false);
        setTargets([]);
      } else {
        toast.error(result.error);
      }
    });
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Copy />
        Copy to…
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-background p-3">
      <p className="text-xs text-muted-foreground">
        Overwrite these days with {name}&apos;s hours and rates:
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {others.map((d) => (
          <label key={d} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={targets.includes(d)}
              onCheckedChange={(checked) => toggleTarget(d, checked === true)}
            />
            <span>{DAY_NAMES[d]}</span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={copy} disabled={pending} className="h-9">
          <Copy />
          {pending ? "Copying…" : "Copy schedule"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={() => {
            setOpen(false);
            setTargets([]);
          }}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ClearControl({
  courtId,
  day,
  name,
  canClear,
}: {
  courtId: string;
  day: number;
  name: string;
  canClear: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function clear() {
    startTransition(async () => {
      const result = await clearDaySchedule({ courtId, dayOfWeek: day });
      if (result.ok) toast.success(`${name} cleared.`);
      else toast.error(result.error);
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <Button
          variant="destructive"
          size="sm"
          className="h-9"
          onClick={clear}
          disabled={pending}
        >
          {pending ? "Clearing…" : "Confirm clear"}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setConfirming(false)}
          disabled={pending}
          aria-label="Cancel"
        >
          <X />
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setConfirming(true)}
      disabled={!canClear}
      title={
        canClear
          ? "Delete this day's schedule"
          : "Some hours have bookings — switch them off instead"
      }
      className="text-muted-foreground hover:text-destructive"
    >
      <Trash2 />
      Clear
    </Button>
  );
}
