"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { GoogleButton } from "@/components/google-button";
import type { AuthFormState } from "@/app/(auth)/actions";

type AuthFormProps = {
  mode: "login" | "signup";
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  next?: string;
  initialError?: string;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending} className="h-11 w-full text-sm">
      {pending ? (
        <>
          <Loader2 className="animate-spin" />
          Just a moment
        </>
      ) : (
        <>
          {label}
          <ArrowRight />
        </>
      )}
    </Button>
  );
}

export function AuthForm({ mode, action, next, initialError }: AuthFormProps) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(action, {
    error: initialError,
  });

  const isSignup = mode === "signup";

  return (
    <div className="flex flex-col gap-6">
      {/* Google sits in its own form — a nested <form> is invalid HTML, and
          this one posts to a different action. */}
      <GoogleButton next={next} />

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          or with email
        </span>
        <span className="h-px flex-1 bg-border" />
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

        {state.notice && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-3 text-sm text-foreground"
          >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
            {state.notice}
          </p>
        )}

        <FieldGroup>
          {isSignup && (
            <Field>
              <FieldLabel htmlFor="name" className="text-sm font-medium">
                Full name
              </FieldLabel>
              <Input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Nimal Perera"
                required
                minLength={2}
                maxLength={80}
                className="h-11 rounded-xl px-3.5"
              />
            </Field>
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
              className="h-11 rounded-xl px-3.5"
            />
          </Field>

          {isSignup && (
            <>
              <Field>
                <FieldLabel htmlFor="phone" className="text-sm font-medium">
                  Phone
                </FieldLabel>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="077 123 4567"
                  required
                  maxLength={30}
                  className="h-11 rounded-xl px-3.5"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="address" className="text-sm font-medium">
                  Address
                </FieldLabel>
                <Textarea
                  id="address"
                  name="address"
                  rows={2}
                  autoComplete="street-address"
                  placeholder="12 Galle Road, Colombo 03"
                  required
                  minLength={5}
                  maxLength={300}
                  className="rounded-xl px-3.5 py-2.5"
                />
              </Field>
            </>
          )}

          <Field>
            {/* On login the label shares its row with the recovery link — the
                moment someone needs it is the moment the password fails. */}
            <div className="flex items-baseline justify-between gap-3">
              <FieldLabel htmlFor="password" className="text-sm font-medium">
                Password
              </FieldLabel>
              {!isSignup && (
                <Link
                  href="/forgot-password"
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Forgot password?
                </Link>
              )}
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder={isSignup ? "At least 8 characters" : "••••••••"}
              minLength={isSignup ? 8 : undefined}
              required
              className="h-11 rounded-xl px-3.5"
            />
          </Field>
        </FieldGroup>

        <SubmitButton label={isSignup ? "Create account" : "Log in"} />

        <p className="text-sm text-muted-foreground">
          {isSignup ? "Already have an account? " : "New here? "}
          <Link
            href={isSignup ? "/login" : "/signup"}
            className="font-medium text-foreground underline decoration-primary decoration-2 underline-offset-4 hover:text-primary"
          >
            {isSignup ? "Log in" : "Create an account"}
          </Link>
        </p>
      </form>
    </div>
  );
}
