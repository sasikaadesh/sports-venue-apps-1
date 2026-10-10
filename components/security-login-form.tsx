"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, ArrowRight, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  securityLoginAction,
  type SecurityLoginFormState,
} from "@/app/(auth)/security-login/actions";

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
          Checking
        </>
      ) : (
        <>
          Log in
          <ArrowRight />
        </>
      )}
    </Button>
  );
}

/**
 * Security staff sign-in — username + PIN, nothing else. No email field, no
 * "create an account" link: these logins only exist because a super admin
 * created one (`/admin/security-staff`).
 */
export function SecurityLoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<SecurityLoginFormState, FormData>(
    securityLoginAction,
    {}
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <ShieldCheck className="size-4" />
        <span className="text-xs font-medium tracking-wide uppercase">
          Security staff
        </span>
      </div>

      <form action={formAction} className="flex flex-col gap-6">
        {next && <input type="hidden" name="next" value={next} />}

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
            <FieldLabel htmlFor="username" className="text-sm font-medium">
              Username
            </FieldLabel>
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="gate1"
              required
              maxLength={24}
              className="h-11 px-3.5"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="pin" className="text-sm font-medium">
              PIN
            </FieldLabel>
            <Input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="••••"
              required
              minLength={4}
              maxLength={6}
              className="h-11 px-3.5"
            />
          </Field>
        </FieldGroup>

        <SubmitButton />
      </form>
    </div>
  );
}
