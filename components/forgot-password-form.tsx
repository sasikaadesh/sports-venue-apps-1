"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, ArrowLeft, ArrowRight, Loader2, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { GoogleButton } from "@/components/google-button";
import { requestPasswordReset, type ResetRequestState } from "@/app/(auth)/actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending} className="h-11 w-full text-sm">
      {pending ? (
        <>
          <Loader2 className="animate-spin" />
          Sending
        </>
      ) : (
        <>
          Send reset link
          <ArrowRight />
        </>
      )}
    </Button>
  );
}

function BackToLogin() {
  return (
    <Link
      href="/login"
      className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Back to log in
    </Link>
  );
}

/**
 * Step one of password recovery: ask for the address, send the link.
 *
 * Three end states, each replacing the form rather than sitting under it:
 * sent, Google-only, and error (the only one you can retry from in place).
 */
export function ForgotPasswordForm({ initialError }: { initialError?: string }) {
  const [state, formAction] = useActionState<ResetRequestState, FormData>(
    requestPasswordReset,
    { error: initialError }
  );

  if (state.sentTo) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-4">
          <MailCheck className="size-5 text-primary" />
          <div className="flex flex-col gap-1.5">
            <p role="status" className="font-medium">
              Check your email for a reset link
            </p>
            <p className="text-sm text-muted-foreground">
              We sent it to{" "}
              <span className="font-medium text-foreground">{state.sentTo}</span>
              . The link works once and expires in about an hour.
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Nothing in your inbox after a minute or two? Check spam, or{" "}
          <Link
            href="/forgot-password"
            className="font-medium text-foreground underline decoration-primary decoration-2 underline-offset-4 hover:text-primary"
          >
            send another link
          </Link>
          .
        </p>

        <BackToLogin />
      </div>
    );
  }

  if (state.googleOnly) {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-xl border bg-muted/50 px-4 py-4">
          <p role="status" className="font-medium">
            That account signs in with Google
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            There is no Courtside password to reset — Google handles it. Use the
            button below, and change your password with Google if you need to.
          </p>
        </div>

        <GoogleButton />

        <BackToLogin />
      </div>
    );
  }

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

      <Field>
        <FieldLabel htmlFor="email" className="text-sm font-medium">
          Email
        </FieldLabel>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@school.lk"
          required
          autoFocus
          className="h-11 rounded-xl px-3.5"
        />
      </Field>

      <SubmitButton />

      <BackToLogin />
    </form>
  );
}
