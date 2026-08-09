"use client";

import { useTransition } from "react";
import { Banknote, RotateCcw, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";

import {
  ConfirmRowAction,
  RowActionNote,
  RowActions,
  RowActionSpacer,
} from "@/components/admin/row-actions";
import type { ActionResult } from "@/lib/validations";
import {
  cancelBookingAction,
  deleteBookingAction,
  removeBlockAction,
} from "@/app/admin/bookings/actions";

/**
 * Row controls for the Bookings table — one "Actions" cell, icon buttons only.
 *
 * Which buttons appear is presentation only. Every rule below — a block uses
 * Unblock, a confirmed or paid booking can never be deleted — is re-decided
 * from the database inside `lib/booking-service.ts` on every call, so hiding a
 * button is a courtesy and never the boundary. See `adminDeleteBooking`.
 *
 * Two slots, in the same order on every row:
 *
 *   1. the cancel family — plain Cancel, or "Cancel & mark for refund" once
 *      money has actually been taken;
 *   2. Remove, or Unblock on an admin block.
 *
 * See `components/admin/row-actions.tsx` for why these are icons and what keeps
 * that honest.
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

  /** Run a server action, then report either way. */
  function run(action: () => Promise<ActionResult>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(success);
      else toast.error(result.error);
    });
  }

  // Cancelling is only meaningful while the booking still holds its hours.
  const canCancel = status === "pending" || status === "confirmed";

  // A confirmed booking is a payment record, and so is a cancelled one that was
  // paid for — both are refund-only. Everything else that no longer holds an
  // hour, plus an unpaid hold, can go.
  const canRemove =
    !isPaid &&
    (status === "pending" || status === "cancelled" || status === "expired");

  const isBlock = status === "blocked";

  return (
    <RowActions columns={2}>
      {/* --- Slot 1: cancel, or cancel-and-refund when money changed hands --- */}
      {canCancel ? (
        isPaid ? (
          <ConfirmRowAction
            icon={<Banknote />}
            label="Cancel & mark for refund"
            tone="danger"
            pending={pending}
            title="Cancel this paid booking and mark it for refund?"
            description="The hours go back on sale straight away and the booking is recorded as cancelled. The successful payment stays on the row as the record of what was charged — this app never moves money, so the refund itself is made in PayHere by whoever handles the accounts."
            confirmLabel="Cancel & mark for refund"
            confirmIcon={<Banknote />}
            cancelLabel="Leave the booking"
            onConfirm={() =>
              run(
                () => cancelBookingAction(bookingId),
                "Cancelled and marked for refund — refund the payment in PayHere."
              )
            }
          />
        ) : (
          <ConfirmRowAction
            icon={<XCircle />}
            label="Cancel booking"
            tone="danger"
            pending={pending}
            title="Cancel this booking?"
            description="Its hours go straight back on sale and the row stays in the table as cancelled. The guest is not messaged automatically."
            confirmLabel="Cancel booking"
            confirmIcon={<XCircle />}
            cancelLabel="Leave the booking"
            onConfirm={() =>
              run(
                () => cancelBookingAction(bookingId),
                "Booking cancelled — its hours are free again."
              )
            }
          />
        )
      ) : !canRemove && !isBlock ? (
        // A paid, already-cancelled row: nothing left to do here.
        <RowActionNote>
          {isPaid
            ? "Paid — refund only, nothing to do here"
            : "No actions available"}
        </RowActionNote>
      ) : (
        <RowActionSpacer />
      )}

      {/* --- Slot 2: remove, or unblock for an admin block --- */}
      {isBlock ? (
        <ConfirmRowAction
          icon={<RotateCcw />}
          label="Unblock"
          pending={pending}
          title="Remove this block?"
          description="The hour goes back on sale immediately and anyone can book it. You can block it again from Block slots."
          confirmLabel="Remove block"
          confirmIcon={<RotateCcw />}
          cancelLabel="Keep it blocked"
          onConfirm={() =>
            run(
              () => removeBlockAction(bookingId),
              "Block removed — the hour is free."
            )
          }
        />
      ) : canRemove ? (
        <ConfirmRowAction
          icon={<Trash2 />}
          label="Remove permanently"
          tone="danger"
          pending={pending}
          title="Delete this booking permanently?"
          description={
            status === "pending"
              ? "This cannot be undone. The booking is still holding its hours; deleting it puts them back on sale immediately."
              : "This cannot be undone. The row disappears from this table and from the guest's booking history."
          }
          confirmLabel="Delete permanently"
          confirmIcon={<Trash2 />}
          cancelLabel="Keep it"
          onConfirm={() =>
            run(() => deleteBookingAction(bookingId), "Booking deleted.")
          }
        />
      ) : (
        <RowActionSpacer />
      )}
    </RowActions>
  );
}
