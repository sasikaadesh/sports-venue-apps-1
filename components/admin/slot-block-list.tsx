"use client";

import { useTransition } from "react";
import { Ban, CircleCheck, Lock, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/time";
import { blockSlotAction, unblockSlotAction } from "@/app/admin/blocks/actions";

export type BlockableSlot = {
  slotId: string;
  startTime: string;
  endTime: string;
  price: string;
  isActive: boolean;
  /** Set when something already occupies this slot on this date. */
  occupied?: {
    bookingId: string;
    status: "pending" | "confirmed" | "blocked";
    who: string | null;
  };
  /**
   * Shared facilities only: people booked into this hour (bookings there are
   * a head count, not an occupant). Undefined on an exclusive court.
   */
  sharedPeople?: number;
};

export function SlotBlockList({
  courtId,
  date,
  slots,
}: {
  courtId: string;
  date: string;
  slots: BlockableSlot[];
}) {
  const [pending, startTransition] = useTransition();

  function handleBlock(slotId: string) {
    startTransition(async () => {
      const result = await blockSlotAction({
        courtId,
        slotId,
        bookingDate: date,
      });
      if (result.ok) toast.success("Slot blocked.");
      else toast.error(result.error);
    });
  }

  function handleUnblock(bookingId: string) {
    startTransition(async () => {
      const result = await unblockSlotAction(bookingId);
      if (result.ok) toast.success("Slot unblocked.");
      else toast.error(result.error);
    });
  }

  return (
    <ul className="flex flex-col gap-2">
      {slots.map((slot) => {
        const blocked = slot.occupied?.status === "blocked";
        const booked =
          slot.occupied && slot.occupied.status !== "blocked" ? slot.occupied : null;
        const sharedBooked = !blocked && (slot.sharedPeople ?? 0) > 0;

        return (
          <li
            key={slot.slotId}
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card px-5 py-3.5"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-sm font-medium">
                {slot.startTime} – {slot.endTime}
              </span>
              <span className="text-sm text-muted-foreground">
                {formatPrice(slot.price)}
              </span>

              {!slot.isActive && <Badge variant="outline">Slot inactive</Badge>}

              {blocked && (
                <Badge variant="secondary">
                  <Lock />
                  Blocked
                </Badge>
              )}

              {booked && (
                <Badge variant="secondary">
                  {booked.status === "confirmed" ? "Booked" : "On hold"}
                  {booked.who ? ` · ${booked.who}` : ""}
                </Badge>
              )}

              {sharedBooked && (
                <Badge variant="secondary">
                  {slot.sharedPeople} booked
                </Badge>
              )}

              {!slot.occupied && !sharedBooked && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <CircleCheck className="size-3.5 text-primary" />
                  Open
                </span>
              )}
            </div>

            {blocked ? (
              <Button
                variant="outline"
                className="h-9"
                disabled={pending}
                onClick={() => handleUnblock(slot.occupied!.bookingId)}
              >
                <RotateCcw />
                Unblock
              </Button>
            ) : booked ? (
              // A real booking is never silently overwritten — cancel it from
              // the Bookings page first, which is an explicit, logged action.
              <span className="text-xs text-muted-foreground">
                Cancel the booking to free this slot
              </span>
            ) : sharedBooked ? (
              // Same rule for a shared session (enforced in blockSlot too).
              <span className="text-xs text-muted-foreground">
                Cancel its bookings to block this session
              </span>
            ) : (
              <Button
                variant="outline"
                className="h-9"
                disabled={pending}
                onClick={() => handleBlock(slot.slotId)}
              >
                <Ban />
                Block
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
