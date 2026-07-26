"use client";

import { useTransition } from "react";
import { RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  cancelBookingAction,
  removeBlockAction,
} from "@/app/admin/bookings/actions";

export function BookingRowActions({
  bookingId,
  status,
}: {
  bookingId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();

  if (status === "blocked") {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await removeBlockAction(bookingId);
            if (result.ok) toast.success("Block removed.");
            else toast.error(result.error);
          })
        }
      >
        <RotateCcw />
        Unblock
      </Button>
    );
  }

  // Cancelled and expired bookings are already off the slot; nothing to do.
  if (status === "cancelled" || status === "expired") return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      className="text-muted-foreground hover:text-destructive"
      onClick={() =>
        startTransition(async () => {
          const result = await cancelBookingAction(bookingId);
          if (result.ok) toast.success("Booking cancelled.");
          else toast.error(result.error);
        })
      }
    >
      <XCircle />
      Cancel
    </Button>
  );
}
