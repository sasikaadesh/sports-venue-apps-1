"use client";

import { useState, useTransition } from "react";
import { CalendarX2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { blockFullDayAction } from "@/app/admin/blocks/actions";

/**
 * Blocks every slot a court runs on one date, in a single click. Scoped to
 * the court currently picked above — never every court — so the blast
 * radius matches what the admin is already looking at.
 *
 * Two-step confirm rather than window.confirm(), same reasoning as
 * DeleteCourtButton: a blocking browser dialog looks nothing like the rest
 * of the UI.
 */
export function BlockFullDayButton({
  courtId,
  courtName,
  date,
  dayLabel,
  disabled,
}: {
  courtId: string;
  courtName: string;
  date: string;
  dayLabel: string;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function handleBlock() {
    startTransition(async () => {
      const result = await blockFullDayAction({ courtId, bookingDate: date });
      if (result.ok) {
        const { blocked, skipped } = result.data;
        toast.success(
          skipped > 0
            ? `Blocked ${blocked} slot${blocked === 1 ? "" : "s"}, ${skipped} already booked or blocked left alone.`
            : `Blocked all ${blocked} slot${blocked === 1 ? "" : "s"} for ${dayLabel}.`
        );
      } else {
        toast.error(result.error);
      }
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Block every open slot for {courtName} on {dayLabel}?
        </span>
        <Button
          variant="destructive"
          className="h-9"
          disabled={pending}
          onClick={handleBlock}
        >
          {pending ? "Blocking…" : "Yes, block the day"}
        </Button>
        <Button
          variant="ghost"
          className="h-9"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      className="h-9"
      disabled={disabled}
      onClick={() => setConfirming(true)}
    >
      <CalendarX2 />
      Block full day
    </Button>
  );
}
