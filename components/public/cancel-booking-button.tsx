"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cancelOwnBookingAction } from "@/app/(public)/book/actions";

/**
 * Release your own hold.
 *
 * Two clicks rather than a modal: a native `confirm()` would block the page,
 * and this is a cheap, reversible action (re-book the hours if they are still
 * free) that does not warrant a dialog.
 */
export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function cancel() {
    setError(null);

    startTransition(async () => {
      const result = await cancelOwnBookingAction(bookingId);
      if (!result.ok) {
        setError(result.error);
        setArmed(false);
        return;
      }
      router.refresh();
    });
  }

  if (!armed) {
    return (
      <Button
        type="button"
        variant="ghost"
        className="h-10 text-muted-foreground"
        onClick={() => setArmed(true)}
      >
        Release this hold
      </Button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="destructive"
        className="h-10"
        disabled={pending}
        onClick={cancel}
      >
        {pending ? <LoaderCircle className="animate-spin" /> : <X />}
        Yes, release it
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="h-10"
        disabled={pending}
        onClick={() => setArmed(false)}
      >
        Keep it
      </Button>
      {error && (
        <span role="alert" className="text-sm text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
