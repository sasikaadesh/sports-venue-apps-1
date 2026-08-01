"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

/**
 * Re-reads the booking while the webhook is still in flight.
 *
 * PayHere's server-to-server callback usually lands within a couple of seconds
 * of the popup closing, but the user is already looking at the page by then.
 * Rather than ask them to refresh, this re-renders the server component every
 * few seconds — a read, never a write, so polling cannot confirm anything.
 *
 * It gives up after a minute and offers a manual refresh instead: a webhook
 * that has not arrived by then is a problem to surface, not to spin on
 * forever.
 */
const INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 20;

export function PaymentStatusPoller() {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (attempts >= MAX_ATTEMPTS) return;

    const timer = setTimeout(() => {
      setAttempts((n) => n + 1);
      router.refresh();
    }, INTERVAL_MS);

    return () => clearTimeout(timer);
  }, [attempts, router]);

  if (attempts >= MAX_ATTEMPTS) {
    return (
      <button
        type="button"
        onClick={() => {
          setAttempts(0);
          router.refresh();
        }}
        className="w-fit text-sm font-medium underline decoration-primary decoration-2 underline-offset-4"
      >
        Still nothing — check again
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin" />
      Checking with PayHere…
    </span>
  );
}
