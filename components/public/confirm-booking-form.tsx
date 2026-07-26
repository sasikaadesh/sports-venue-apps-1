"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, LoaderCircle, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createBookingAction } from "@/app/(public)/book/actions";
import type { CreateBookingInput } from "@/lib/validations";

/**
 * Confirm button for the review page.
 *
 * Holds no price and computes nothing — it posts the identifiers and lets the
 * booking service do the work. On success the action redirects to the booking,
 * so the only thing handled here is the failure case, which is expected and
 * normal: someone else can take one of these hours while this page is open.
 */
export function ConfirmBookingForm({
  input,
  holdMinutes,
}: {
  input: CreateBookingInput;
  holdMinutes: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);

    startTransition(async () => {
      const result = await createBookingAction(input);
      // A successful action redirects, so reaching here means it failed.
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="button"
          size="lg"
          className="h-11 px-6"
          disabled={pending}
          onClick={confirm}
        >
          {pending ? (
            <>
              <LoaderCircle className="animate-spin" />
              Holding your slot…
            </>
          ) : (
            <>
              <CheckCircle2 />
              Confirm booking
            </>
          )}
        </Button>

        <p className="text-sm text-muted-foreground">
          Held for {holdMinutes} minutes. Payment arrives in the next release.
        </p>
      </div>
    </div>
  );
}
