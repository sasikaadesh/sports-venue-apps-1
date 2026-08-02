"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/app/(auth)/actions";

/**
 * Log out.
 *
 * Signing out is genuinely a server round-trip — Supabase has to clear the
 * session and the cookie is rewritten on the way back — so the button says so
 * instead of sitting there looking ignored. `useFormStatus` reads the pending
 * state of the enclosing form, which means the auth path itself is untouched:
 * this is still the same `signOut` server action posted from a real form, and
 * it still works if the click lands before hydration.
 */
function SubmitButton({
  label,
  className,
  compact,
}: {
  label: string;
  className?: string;
  compact: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="ghost"
      size="lg"
      disabled={pending}
      aria-label={label}
      className={className}
    >
      {pending ? <LoaderCircle className="animate-spin" /> : <LogOut />}
      <span className={compact ? "hidden sm:inline" : undefined}>
        {pending ? "Signing out…" : label}
      </span>
    </Button>
  );
}

export function LogoutButton({
  className,
  /** Hide the label below `sm` — for the header, where space is tight. */
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <form action={signOut}>
      <SubmitButton label="Log out" className={className} compact={compact} />
    </form>
  );
}
