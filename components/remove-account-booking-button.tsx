"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertCircle, LoaderCircle, Trash2 } from "lucide-react";

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
import { removeOwnBookingAction } from "@/app/account/actions";

/**
 * Remove one unpaid booking from your own list, behind a confirmation dialog.
 *
 * This button is only rendered for a `pending` or `cancelled` booking, but that
 * is presentation only — `removeOwnBookingAction` re-checks both the owner and
 * the status server-side, so a paid booking cannot be removed by calling the
 * action directly (docs/ARCHITECTURE.md → the paid/unpaid divide).
 *
 * A dialog rather than the two-click "arm" pattern used for releasing a hold on
 * the booking page: this one clears the booking out of the list for good, so it
 * deserves a sentence explaining what happens to the hours.
 */
export function RemoveAccountBookingButton({
  bookingId,
  courtName,
  /** True while the booking still holds its hours — i.e. a live `pending` hold. */
  holdsHours,
}: {
  bookingId: string;
  courtName: string;
  holdsHours: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    setError(null);

    startTransition(async () => {
      const result = await removeOwnBookingAction(bookingId);

      if (!result.ok) {
        // Keep the dialog open and say why — the usual cause is that the
        // booking changed underneath (paid, or swept) while it was open.
        setError(result.error);
        return;
      }

      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setError(null);
        setOpen(next);
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
          />
        }
      >
        <Trash2 />
        Remove
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove this booking?</DialogTitle>
          <DialogDescription>
            {holdsHours
              ? `Your hold on ${courtName} is released straight away and the hours go back on sale. Nothing has been charged, so nothing is lost — you can book again while the time is free.`
              : `This booking is removed from your list. It was never paid for, so no money is involved.`}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>
            Keep it
          </DialogClose>
          <Button variant="destructive" disabled={pending} onClick={remove}>
            {pending ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
            {pending ? "Removing…" : "Remove booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
