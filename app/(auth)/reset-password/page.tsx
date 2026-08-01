import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";

import { LinkButton } from "@/components/link-button";
import { RecoveryHashHandler } from "@/components/recovery-hash-handler";
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
 * Supabase can deliver the recovery token in **three different shapes**,
 * depending on the SDK version, the flow type the link was generated with, and
 * whether the project's email template was customised. This page handles all
 * three, because which one arrives is not something the app gets to decide:
 *
 *  1. **`?code=…`** — the PKCE flow. `@supabase/ssr` uses this when
 *     `resetPasswordForEmail` runs on the server. Exchanged for a session by
 *     /auth/callback, which is the only place that can write the cookie.
 *  2. **`?token_hash=…&type=recovery`** — what a template customised to use
 *     `{{ .TokenHash }}` produces. Verified with `verifyOtp`, also in
 *     /auth/callback. This one needs no PKCE verifier, so it survives being
 *     opened in a different browser than the one that asked for the link.
 *  3. **`#access_token=…&refresh_token=…`** — the implicit flow. The fragment
 *     is never sent to the server, so no amount of server code can see it;
 *     `RecoveryHashHandler` picks it up in the browser and calls `setSession`.
 *
 * Supabase can also redirect here with `?error=…&error_code=otp_expired` when
 * it rejected the token itself — most often because the link had already been
 * opened once, including by a mail scanner.
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

  // --- Transports 1 and 2: hand the token to the one route that can turn it
  // into a session cookie, and come back here with a clean URL. -------------
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

  // Supabase rejected the token before it ever reached us.
  const supabaseError = params.error ?? params.error_code;

  if (!user) {
    return (
      <div className="flex flex-col gap-8">
        {/* Transport 3. Renders nothing unless the URL fragment actually holds
            a recovery token; when it does, it sets the session and reloads,
            and this branch is not taken on the second pass. */}
        <RecoveryHashHandler />

        <div className="flex flex-col gap-2">
          <h1 className="text-4xl leading-none">
            {supabaseError ? "That link has expired" : "Link expired"}
          </h1>
          <p className="text-muted-foreground">
            {describeError(params.error_code, params.error_description)}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <LinkButton
            href="/forgot-password"
            size="lg"
            className="h-11 w-full text-sm"
          >
            <KeyRound />
            Request a new link
          </LinkButton>

          <LinkButton
            href="/login"
            variant="outline"
            size="lg"
            className="h-11 w-full text-sm"
          >
            Back to log in
          </LinkButton>
        </div>
      </div>
    );
  }

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

/** Turn Supabase's error codes into something a person can act on. */
function describeError(code?: string, description?: string): string {
  if (code === "otp_expired") {
    return "Reset links last about an hour and can only be opened once — some email apps follow links automatically, which uses them up. Request a fresh one below.";
  }

  if (code === "access_denied") {
    return "That link is no longer valid. Request a fresh one below and open it in this browser.";
  }

  if (description) {
    // Supabase sends these `+`-encoded and human-readable.
    return `${description.replace(/\+/g, " ")}. Request a fresh link below.`;
  }

  return "Reset links can be used once and last about an hour. Request a fresh one and it will work.";
}
