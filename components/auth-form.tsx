"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFormStatus } from "react-dom";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { GoogleButton } from "@/components/google-button";
import { NativeSelect } from "@/components/admin/native-select";
import {
  AFFILIATIONS,
  signInSchema,
  signUpSchema,
  type SignUpInput,
} from "@/lib/validations";
import type { AuthFormState } from "@/app/(auth)/actions";

type AuthFormProps = {
  mode: "login" | "signup";
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  next?: string;
  initialError?: string;
  initialNotice?: string;
};

function SubmitButton({ label }: { label: string }) {
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

/**
 * The email/password form, shared by /login and /signup.
 *
 * **The server action stays the submit path.** The form still posts through
 * `useActionState`, so authentication is unchanged and the form keeps working
 * with JavaScript disabled. React Hook Form is layered on top purely to tell
 * the user about a bad field *as they leave it* rather than after a round trip
 * — `mode: "onTouched"` validates a field on first blur and then re-checks it
 * on every keystroke, so the message clears as soon as it is fixed instead of
 * waiting for another blur. The native `required` / `minLength` attributes are
 * kept as the synchronous submit gate, and the same Zod schemas run again in
 * the server action, which is the check that actually decides.
 */
export function AuthForm({
  mode,
  action,
  next,
  initialError,
  initialNotice,
}: AuthFormProps) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(action, {
    error: initialError,
    notice: initialNotice,
  });

  const isSignup = mode === "signup";

  // One form component, two field sets, so the state is typed against the
  // wider (signup) shape. In login mode only `email` and `password` are
  // registered and the narrower schema validates them; the resolver is
  // therefore never handed the profile keys, which is the part the type system
  // cannot express — hence the cast. It affects nothing at runtime: the schema
  // that actually decides is the one re-run in the server action.
  const form = useForm<SignUpInput>({
    mode: "onTouched",
    resolver: zodResolver(
      isSignup ? signUpSchema : signInSchema
    ) as unknown as Resolver<SignUpInput>,
  });

  const { errors } = form.formState;

  // Carry the intended destination onto the other form too. Someone who lands
  // here from a booking and decides they need the *other* form must not lose
  // the selection they came with (docs/ARCHITECTURE.md → Booking flow).
  const otherHref = `${isSignup ? "/login" : "/signup"}${
    next ? `?next=${encodeURIComponent(next)}` : ""
  }`;

  return (
    <div className="flex flex-col gap-6">
      {/* Google sits in its own form — a nested <form> is invalid HTML, and
          this one posts to a different action. It is offered on both login and
          signup: for a new user, "Continue with Google" *is* the signup. */}
      <GoogleButton next={next} />

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
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
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="name" className="text-sm font-medium">
                Full name
              </FieldLabel>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                placeholder="Nimal Perera"
                required
                minLength={2}
                maxLength={80}
                className="h-11 rounded-xl px-3.5"
                {...form.register("name")}
              />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>
          )}

          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email" className="text-sm font-medium">
              Email
            </FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@school.lk"
              required
              className="h-11 rounded-xl px-3.5"
              {...form.register("email")}
            />
            {errors.email && <FieldError>{errors.email.message}</FieldError>}
          </Field>

          {isSignup && (
            <>
              <Field data-invalid={!!errors.phone}>
                <FieldLabel htmlFor="phone" className="text-sm font-medium">
                  Phone
                </FieldLabel>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="077 123 4567"
                  required
                  maxLength={30}
                  className="h-11 rounded-xl px-3.5"
                  {...form.register("phone")}
                />
                {errors.phone && (
                  <FieldError>{errors.phone.message}</FieldError>
                )}
              </Field>

              <Field data-invalid={!!errors.address}>
                <FieldLabel htmlFor="address" className="text-sm font-medium">
                  Address
                </FieldLabel>
                <Textarea
                  id="address"
                  rows={2}
                  autoComplete="street-address"
                  placeholder="12 Galle Road, Colombo 03"
                  required
                  minLength={5}
                  maxLength={300}
                  className="rounded-xl px-3.5 py-2.5"
                  {...form.register("address")}
                />
                {errors.address && (
                  <FieldError>{errors.address.message}</FieldError>
                )}
              </Field>

              <Field data-invalid={!!errors.affiliation}>
                <FieldLabel
                  htmlFor="affiliation"
                  className="text-sm font-medium"
                >
                  Affiliation
                </FieldLabel>
                {/* No pre-selected option — `required` on a select only bites
                    when the chosen option has an empty value, so the
                    placeholder is what makes this an actual answer. */}
                <NativeSelect
                  id="affiliation"
                  required
                  defaultValue=""
                  className="h-11 rounded-xl px-3.5"
                  {...form.register("affiliation")}
                >
                  <option value="" disabled>
                    Choose one…
                  </option>
                  {AFFILIATIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
                {errors.affiliation && (
                  <FieldError>{errors.affiliation.message}</FieldError>
                )}
              </Field>
            </>
          )}

          <Field data-invalid={!!errors.password}>
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
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder={isSignup ? "At least 8 characters" : "••••••••"}
              minLength={isSignup ? 8 : undefined}
              required
              className="h-11 rounded-xl px-3.5"
              {...form.register("password")}
            />
            {errors.password && (
              <FieldError>{errors.password.message}</FieldError>
            )}
          </Field>
        </FieldGroup>

        <SubmitButton label={isSignup ? "Create account" : "Log in"} />

        <p className="text-sm text-muted-foreground">
          {isSignup ? "Already have an account? " : "New here? "}
          <Link
            href={otherHref}
            className="font-medium text-foreground underline decoration-primary decoration-2 underline-offset-4 hover:text-primary"
          >
            {isSignup ? "Log in" : "Create an account"}
          </Link>
        </p>
      </form>
    </div>
  );
}
