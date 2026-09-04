"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { updatePassword, type UpdatePasswordState } from "@/app/(auth)/actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending}
      className="h-11 w-full text-sm"
    >
      {pending ? (
        <>
          <Loader2 className="animate-spin" />
          Saving
        </>
      ) : (
        <>
          <ShieldCheck />
          Update password
        </>
      )}
    </Button>
  );
}

/**
 * Step two: set the new password with the session the recovery link created.
 *
 * This component only ever renders the form or an inline error. Success is not
 * a state here — `updatePassword` redirects to `/reset-password?done=1` — and
 * that is deliberate: a successful reset signs every session out, so the
 * re-render that comes back with any server action's result would find this
 * page signed out and replace the whole subtree, taking a client-held success
 * panel with it. Whatever replaced it then read the missing session as a dead
 * link. See `components/reset-success.tsx`.
 */
export function ResetPasswordForm() {
  const [state, formAction] = useActionState<UpdatePasswordState, FormData>(
    updatePassword,
    {}
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      )}

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="password" className="text-sm font-medium">
            New password
          </FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            minLength={8}
            required
            autoFocus
            className="h-11 rounded-xl px-3.5"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="confirmPassword" className="text-sm font-medium">
            Confirm new password
          </FieldLabel>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            minLength={8}
            required
            className="h-11 rounded-xl px-3.5"
          />
        </Field>
      </FieldGroup>

      <SubmitButton />

      <p className="text-sm text-muted-foreground">
        Changed your mind?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline decoration-primary decoration-2 underline-offset-4 hover:text-primary"
        >
          Back to log in
        </Link>
      </p>
    </form>
  );
}
