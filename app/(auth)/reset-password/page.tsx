import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RecoveryGate } from "@/components/recovery-gate";
import { ResetLinkExpired, describeResetError } from "@/components/reset-link-expired";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { getCurrentUser } from "@/lib/auth";
import { RESET_PASSWORD_PATH } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Set a new password — Courtside",
};

// The whole point of this page is reading a just-set session cookie. Anything
// cached would serve the previous visitor's state.
export const dynamic = "force-dynamic";

/**
 * Step two of password recovery — the target of the emailed link.
 *
 * Supabase can deliver the recovery token in three different shapes, decided by
 * the SDK version, the flow type and whether the email template was customised
 * — not by this app. All three are handled:
 *
 *  1. **`?code=…`** — PKCE, what `@supabase/ssr` uses when
 *     `resetPasswordForEmail` runs on the server. Forwarded to /auth/callback,
 *     which is the only place that can turn it into a session cookie (a Server
 *     Component cannot write cookies).
 *  2. **`?token_hash=…&type=recovery`** — from a template using
 *     `{{ .TokenHash }}`. Also forwarded to /auth/callback, for `verifyOtp`.
 *  3. **`#access_token=…`** — the implicit flow, and what this project's
 *     Supabase returns today. A fragment never reaches the server, so this page
 *     genuinely cannot see it. `RecoveryGate` resolves it in the browser.
 *
 * **The page only asserts what it can prove.** It renders "expired" in exactly
 * one case: Supabase itself came back with an error. A missing session is *not*
 * evidence of a bad link — it is the normal first render of case 3 — so that
 * branch hands over to `RecoveryGate` rather than guessing. Guessing was the
 * false "Link Expired".
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{
    code?: string;
    token_hash?: string;
    type?: string;
    error?: string;
    error_code?: string;
    error_description?: string;
  }>;
}) {
  const params = await searchParams;

  // Supabase rejected the token before it ever reached us — the one case the
  // server can call expired on its own authority.
  if (params.error || params.error_code) {
    return (
      <ResetLinkExpired
        message={describeResetError(params.error_code, params.error_description)}
      />
    );
  }

  // Transports 1 and 2: hand the token to the one route that can turn it into
  // a session cookie, and come back here with a clean URL.
  if (params.code) {
    redirect(
      `/auth/callback?code=${encodeURIComponent(params.code)}&next=${encodeURIComponent(RESET_PASSWORD_PATH)}`
    );
  }

  if (params.token_hash) {
    redirect(
      `/auth/callback?token_hash=${encodeURIComponent(params.token_hash)}&type=${encodeURIComponent(params.type ?? "recovery")}&next=${encodeURIComponent(RESET_PASSWORD_PATH)}`
    );
  }

  const user = await getCurrentUser();

  // A session is proof: show the form, and name the account it belongs to.
  if (user) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl leading-none">Set a new password</h1>
          <p className="text-muted-foreground">
            For {user.email}. Choose something at least 8 characters long.
          </p>
        </div>

        <ResetPasswordForm />
      </div>
    );
  }

  // No session and no parameters. That is either transport 3 mid-flight or a
  // genuinely dead link, and only the browser can tell the two apart.
  return <RecoveryGate />;
}
