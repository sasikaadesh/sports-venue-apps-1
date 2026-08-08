"use client";

import { useTransition } from "react";
import { RotateCcw, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  cancelBookingAction,
  deleteBookingAction,
  removeBlockAction,
} from "@/app/admin/bookings/actions";

/**
 * Row controls for the Bookings table.
 *
 * Which buttons appear is presentation only. Every rule below — a block uses
 * Unblock, a confirmed or paid booking can never be deleted — is re-decided
 * from the database inside `lib/booking-service.ts` on every call, so hiding a
 * button is a courtesy and never the boundary. See `adminDeleteBooking`.
 *
 * The actions are server actions wrapped in a transition, and each one
 * revalidates `/admin/bookings`, so the table re-renders with the new state as
 * soon as the write lands — no local copy of the row to keep in step.
 */
export function BookingRowActions({
  bookingId,
  status,
  /** True when the booking has a successful payment, whatever its status. */
  isPaid,
}: {
  bookingId: string;
  status: string;
  isPaid: boolean;
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
            if (result.ok) toast.success("Block removed — the hour is free.");
            else toast.error(result.error);
          })
        }
      >
        <RotateCcw />
        Unblock
      </Button>
    );
  }

  // Cancelling is only meaningful while the booking still holds its hours.
  const canCancel = status === "pending" || status === "confirmed";

  // A confirmed booking is a payment record, and so is a cancelled one that was
  // paid for — both are refund-only. Everything else that no longer holds an
  // hour, plus an unpaid hold, can go.
  const canRemove =
    !isPaid &&
    (status === "pending" || status === "cancelled" || status === "expired");

  return (
    <div className="flex items-center justify-end gap-1">
      {canCancel && (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          className="text-muted-foreground hover:text-destructive"
          onClick={() =>
            startTransition(async () => {
              const result = await cancelBookingAction(bookingId);
              if (result.ok)
                toast.success("Booking cancelled — its hours are free again.");
              else toast.error(result.error);
            })
          }
        >
          <XCircle />
          Cancel
        </Button>
      )}

      {canRemove && (
        <Dialog>
          <DialogTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                className="text-muted-foreground hover:text-destructive"
              />
            }
          >
            <Trash2 />
            Remove
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete this booking permanently?</DialogTitle>
              <DialogDescription>
                This cannot be undone.
                {status === "pending"
                  ? " The booking is still holding its hours; deleting it puts them back on sale immediately."
                  : " The row disappears from this table and from your booking history."}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Keep it
              </DialogClose>
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteBookingAction(bookingId);
                    if (result.ok) toast.success("Booking deleted.");
                    else toast.error(result.error);
                  })
                }
              >
                <Trash2 />
                Delete permanently
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* A confirmed-and-paid row has nothing to offer but Cancel, and a paid
          cancelled row nothing at all — say so rather than leaving the cell
          blank, which reads as a rendering fault. */}
      {!canCancel && !canRemove && (
        <span className="text-xs text-muted-foreground">
          {isPaid ? "Paid — refund only" : "—"}
        </span>
      )}
    </div>
  );
}
