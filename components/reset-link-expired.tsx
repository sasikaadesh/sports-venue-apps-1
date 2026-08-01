import { KeyRound } from "lucide-react";

import { LinkButton } from "@/components/link-button";

/**
 * The "this link is no good" state, shared by the two places that can reach
 * that conclusion: the server page (when Supabase itself rejected the token)
 * and the client gate (when there is no token anywhere in the URL).
 *
 * Shared rather than duplicated because the whole bug this replaced was the two
 * paths disagreeing about when the state applies — one component makes that
 * impossible to drift again.
 */
export function ResetLinkExpired({ message }: { message: string }) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl leading-none">That link has expired</h1>
        <p className="text-muted-foreground">{message}</p>
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

/** Turn Supabase's error codes into something a person can act on. */
export function describeResetError(code?: string, description?: string): string {
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
