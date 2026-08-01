"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { ResetLinkExpired } from "@/components/reset-link-expired";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { createClient } from "@/lib/supabase/client";

/**
 * Decides, in the browser, whether there is a usable recovery session.
 *
 * **This exists because the page cannot know.** Supabase's implicit flow
 * returns the token in the URL *fragment* (`#access_token=…`), and a fragment
 * is never transmitted to the server — not in the request line, not in a
 * header. So a server render of a perfectly good recovery link sees no session
 * and no parameters, which is indistinguishable from a dead link.
 *
 * The previous version rendered "That link has expired" in that state and let
 * a `useEffect` correct it a moment later. That is the false-expired bug: the
 * server's guess was displayed as fact. The token was fine — it had been
 * consumed exactly once and the session was valid — but the first paint said
 * otherwise, and any hiccup in the follow-up refresh left it saying so.
 *
 * Now nothing is asserted until it is known. Three states, and "expired" is
 * only ever reached by *checking*:
 *
 *  - `checking` — first paint, and while `setSession` is in flight.
 *  - `ready`    — a session exists; show the form. Set from this component's
 *                 own knowledge, so it does not depend on the server re-render
 *                 landing (that still happens, to fill in the email).
 *  - `expired`  — there is no token in the fragment and no session anywhere.
 *
 * Rendering `checking` on both the server and the first client pass is what
 * keeps hydration matching; the effect runs afterwards.
 */
export function RecoveryGate() {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "ready" | "expired">(
    "checking"
  );

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function resolve() {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");

      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (cancelled) return;

        if (!error) {
          // Drop the tokens out of the address bar: they are live credentials
          // and have no business in history or in a referrer. Done only after
          // the exchange succeeded, so a failure can still be retried by
          // reloading.
          window.history.replaceState(null, "", window.location.pathname);
          setState("ready");
          // Let the server catch up so the heading can name the account. The
          // form does not wait on this.
          router.refresh();
          return;
        }

        console.warn("[recovery] token in the URL was rejected:", error.message);
      }

      // No token in the fragment — but the cookie may already hold a session
      // the server render missed (it is written by this same client, and a
      // refresh can race it). Ask before concluding anything.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      setState(data.session ? "ready" : "expired");
    }

    resolve();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state === "ready") {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl leading-none">Set a new password</h1>
          <p className="text-muted-foreground">
            Choose something at least 8 characters long.
          </p>
        </div>

        <ResetPasswordForm />
      </div>
    );
  }

  if (state === "expired") {
    return (
      <ResetLinkExpired message="Reset links can be used once and last about an hour. Request a fresh one and it will work." />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl leading-none">Checking your link</h1>
        <p className="flex items-center gap-2 text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          One moment.
        </p>
      </div>

      {/* Without JavaScript the fragment can never be read, so the check above
          cannot run and this would spin forever. Say so instead. */}
      <noscript>
        <p className="rounded-xl border bg-muted px-4 py-3 text-sm">
          This page needs JavaScript to read your reset link. Enable it and
          reload, or{" "}
          <a href="/forgot-password" className="underline underline-offset-4">
            request a new link
          </a>
          .
        </p>
      </noscript>
    </div>
  );
}
