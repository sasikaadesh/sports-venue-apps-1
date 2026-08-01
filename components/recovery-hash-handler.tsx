"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Picks up a recovery token delivered in the **URL fragment**.
 *
 * Supabase's implicit flow returns `#access_token=…&refresh_token=…&type=recovery`.
 * A fragment is never transmitted to the server — not in the request line, not
 * in a header — so no server component, route handler or proxy can see it. It
 * has to be read in the browser, which is the entire reason this component
 * exists. The PKCE (`?code=`) and `token_hash` transports are handled on the
 * server and never reach here.
 *
 * `createBrowserClient` from `@supabase/ssr` writes the session to cookies
 * rather than localStorage, so once `setSession` resolves the server sees the
 * user too — which is what lets `router.refresh()` re-render the page into the
 * "set a new password" state.
 *
 * Renders nothing and holds no state — it is a side effect, not UI. The page
 * it sits on already shows the "link expired" copy, which stays put if the
 * exchange fails and is replaced by the form when it succeeds. The cost is
 * that the expired copy is on screen for the fraction of a second the exchange
 * takes; the alternative is showing nothing at all to someone whose link
 * really has expired, or to anyone without JavaScript.
 */
export function RecoveryHashHandler() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes("access_token")) return;

    const params = new URLSearchParams(hash.slice(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (!access_token || !refresh_token) return;

    let cancelled = false;

    createClient()
      .auth.setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (cancelled) return;

        if (error) {
          console.warn("[recovery] could not use the token in the URL:", error.message);
          return;
        }

        // Drop the tokens out of the address bar before re-rendering: they are
        // live credentials and have no business sitting in history or being
        // handed to anything as a referrer.
        window.history.replaceState(null, "", window.location.pathname);
        router.refresh();
      })
      .catch((error) => {
        if (!cancelled) console.warn("[recovery] setSession failed:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
