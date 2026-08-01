import type { Metadata } from "next";
import { KeyRound } from "lucide-react";

import { LinkButton } from "@/components/link-button";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Set a new password — Courtside",
};

/**
 * Step two of password recovery — the target of the emailed link.
 *
 * /auth/callback has already exchanged the recovery code for a session by the
 * time anyone gets here, so the gate is simply "is there a session?". No
 * session means the link was never opened, was opened twice, or has expired.
 */
export default async function ResetPasswordPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl leading-none">Link expired</h1>
          <p className="text-muted-foreground">
            Reset links can be used once and last about an hour. Request a fresh
            one and it will work.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <LinkButton
            href="/forgot-password"
            size="lg"
            className="h-11 w-full text-sm"
          >
            <KeyRound />
            Send a new link
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
