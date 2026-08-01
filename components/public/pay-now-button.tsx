"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { AlertCircle, CreditCard, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { startCheckoutAction } from "@/app/(public)/payments/actions";

/**
 * PayHere's onsite-checkout SDK, as much of it as we use.
 *
 * The callbacks are assigned as properties on the global rather than passed in
 * — that is the API the library exposes, and it is why they are (re)assigned
 * on every click below rather than once at mount.
 */
type PayHereSdk = {
  startPayment: (params: Record<string, string | boolean>) => void;
  onCompleted?: (orderId: string) => void;
  onDismissed?: () => void;
  onError?: (message: string) => void;
};

declare global {
  interface Window {
    payhere?: PayHereSdk;
  }
}

/**
 * "Pay now" — opens the PayHere popup for a held booking.
 *
 * The button carries no payment details of its own. It asks the server for the
 * checkout parameters (amount, order id and hash all computed there from the
 * stored booking), hands them to the SDK, and then gets out of the way: what
 * the popup reports back is used for navigation only. The booking is confirmed
 * by the `notify_url` webhook or not at all, so `onCompleted` sends the user to
 * a status page rather than claiming success.
 */
export function PayNowButton({
  bookingId,
  amountLabel,
}: {
  bookingId: string;
  amountLabel: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scriptReady = useRef(false);

  const pay = useCallback(async () => {
    setError(null);

    const sdk = window.payhere;
    if (!sdk) {
      setError(
        scriptReady.current
          ? "The payment window could not start. Reload the page and try again."
          : "Still loading the payment window — try again in a moment."
      );
      return;
    }

    setPending(true);

    const result = await startCheckoutAction(bookingId);

    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }

    sdk.onCompleted = () => {
      // NOT a confirmation — only PayHere's server-to-server callback can
      // confirm. The status page reads the booking and waits for it.
      router.push(`/payments/return?booking=${bookingId}`);
    };

    sdk.onDismissed = () => {
      // Closed the popup without paying. The hold is still live, so leaving
      // the page exactly as it is (with the button ready again) is correct.
      setPending(false);
      router.refresh();
    };

    sdk.onError = (message: string) => {
      setError(message || "PayHere reported an error. Please try again.");
      setPending(false);
    };

    sdk.startPayment({ ...result.data });
  }, [bookingId, router]);

  return (
    <div className="flex flex-col gap-3">
      <Script
        src={process.env.NEXT_PUBLIC_PAYHERE_JS ?? "https://www.payhere.lk/lib/payhere.js"}
        strategy="afterInteractive"
        onReady={() => {
          scriptReady.current = true;
        }}
        onError={() =>
          setError("Could not load PayHere. Check your connection and reload.")
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="lg"
          className="h-11"
          disabled={pending}
          onClick={pay}
        >
          {pending ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <CreditCard />
          )}
          {pending ? "Opening PayHere" : `Pay now — ${amountLabel}`}
        </Button>

        <span className="text-sm text-muted-foreground">
          Secure card payment via PayHere.
        </span>
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
