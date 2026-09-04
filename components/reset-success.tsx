"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";

import { LinkButton } from "@/components/link-button";

/** `?reset=1` is what makes the login form say the password was changed. */
export const LOGIN_AFTER_RESET = "/login?reset=1";

/**
 * The "your password was changed" screen, reached only by
 * `/reset-password?done=1` — a URL that `updatePassword` redirects to after
 * Supabase accepted the new password.
 *
 * It is a *route*, not a piece of component state, and that is the whole point.
 * The success used to live in `useActionState` inside the form; a successful
 * reset signs every session out, and the re-render that every server action
 * sends back then found the page signed out and swapped the form for
 * `RecoveryGate`, which reported "That link has expired" over a reset that had
 * just worked. A URL survives that re-render — nothing can reinterpret it.
 *
 * Nothing here reads a session, because by design there is no longer one.
 */
export function ResetSuccess() {
  const router = useRouter();

  // Send them on to the login form a moment after they can read this — long
  // enough to take it in, short enough not to feel stuck. The button below is
  // the same destination, so the timer is a convenience and never the only way
  // out.
  useEffect(() => {
    const timer = setTimeout(() => router.replace(LOGIN_AFTER_RESET), 2500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl leading-none">Password updated</h1>
        <p className="text-muted-foreground">Your new password is saved.</p>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-4">
          <CheckCircle2 className="size-5 text-primary" />
          <div className="flex flex-col gap-1.5">
            <p role="status" className="font-medium">
              You can log in now
            </p>
            <p className="text-sm text-muted-foreground">
              Every device that was signed in has been logged out. Log in again
              with your new password — taking you there now.
            </p>
          </div>
        </div>

        <LinkButton
          href={LOGIN_AFTER_RESET}
          size="lg"
          className="h-11 w-full text-sm"
        >
          Go to log in
        </LinkButton>
      </div>
    </div>
  );
}
