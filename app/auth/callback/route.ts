import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, profileIsComplete } from "@/lib/auth";
import { RESET_PASSWORD_PATH, safeNextPath } from "@/lib/site-url";

/**
 * The single landing point for every out-of-app auth hop: email confirmation
 * links, the Google OAuth redirect, and password recovery all come back here.
 *
 * Supabase sends either `?code=` (PKCE / OAuth) or `?token_hash=&type=`
 * depending on the project's email template, so both are handled. This is the
 * only place either one can be turned into a session, because only a route
 * handler can write the cookie — a Server Component cannot. The reset page
 * therefore forwards its token here rather than trying to exchange it itself.
 *
 * The third transport, a token in the URL *fragment*, never reaches the server
 * at all and is handled in the browser (`components/recovery-gate.tsx`).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Only relative paths — an open redirect here would be handed to every new
  // user by email.
  const next = safeNextPath(searchParams.get("next"));

  // A recovery hop is told apart by where it is going, or by the OTP type.
  // Both are needed: the PKCE link carries `next` and no type, the
  // `token_hash` link carries the type.
  const isRecovery = next === RESET_PASSWORD_PATH || type === "recovery";

  // The provider can hand back its own failure instead of a code.
  const providerError =
    searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) {
    // Send a failed recovery back to "email me a link", not to the login form
    // — the whole reason they are here is that they cannot log in.
    return NextResponse.redirect(
      isRecovery
        ? `${origin}/forgot-password?error=${encodeURIComponent(providerError)}`
        : `${origin}/login?error=${encodeURIComponent(providerError)}`
    );
  }

  const supabase = await createClient();

  let signedIn = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    signedIn = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    signedIn = !error;
  }

  if (!signedIn) {
    // A dead recovery link belongs back on "email me a link", not on the login
    // form — the whole point is that they cannot log in.
    return isRecovery
      ? NextResponse.redirect(
          `${origin}/forgot-password?error=${encodeURIComponent("That reset link is invalid or has expired. Request a new one.")}`
        )
      : NextResponse.redirect(
          `${origin}/login?error=${encodeURIComponent("That sign-in link is invalid or has expired.")}`
        );
  }

  // A recovery link goes straight to "set a new password" — someone locked out
  // of their account should not be asked for a phone number first, and the
  // recovery session is short-lived enough that the detour could expire it.
  if (isRecovery) {
    return NextResponse.redirect(`${origin}${RESET_PASSWORD_PATH}`);
  }

  // Google gives us an email and usually a name, but never a phone number or
  // address — so a first Google sign-in always lands here incomplete and gets
  // routed through "Complete your profile" before continuing to `next`.
  // `getCurrentUser()` also creates the profile row if the trigger somehow did
  // not, so this read is what guarantees there is a row to check.
  const user = await getCurrentUser();
  if (user && !profileIsComplete(user)) {
    return NextResponse.redirect(
      `${origin}/complete-profile?next=${encodeURIComponent(next)}`
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
