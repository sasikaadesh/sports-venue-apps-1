"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { submitContactMessage } from "@/app/(public)/contact/actions";
import {
  contactMessageSchema,
  type ContactMessageInput,
} from "@/lib/validations";

export function ContactForm({
  defaultName = "",
  defaultEmail = "",
}: {
  defaultName?: string;
  defaultEmail?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const form = useForm<ContactMessageInput>({
    resolver: zodResolver(contactMessageSchema),
    defaultValues: { name: defaultName, email: defaultEmail, message: "" },
  });

  function onSubmit(
    values: ContactMessageInput,
    event?: React.BaseSyntheticEvent
  ) {
    setServerError(null);

    // The honeypot is read straight off the submitted <form>, not through
    // react-hook-form or a ref: it is not part of the schema and must never
    // reach the validated payload, and FormData needs no extra state.
    const honeypot =
      event?.target instanceof HTMLFormElement
        ? String(new FormData(event.target).get("website") ?? "")
        : "";

    startTransition(async () => {
      const result = await submitContactMessage({ ...values, website: honeypot });

      if (!result.ok) {
        setServerError(result.error);
        return;
      }

      setSent(true);
      form.reset({ name: values.name, email: values.email, message: "" });
    });
  }

  if (sent) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-primary/40 bg-primary/10 px-6 py-8">
        {/* Solid green chip rather than `bg-primary/20 text-primary`: green on
            pale green is ~2:1 in light mode. Ink on solid green is 9:1 in both. */}
        <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
          <CheckCircle2 className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg">Message sent</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            Thanks — we have it. Someone from the sports office will get back to
            you at {form.getValues("email")}.
          </p>
        </div>
        <Button variant="outline" className="h-10" onClick={() => setSent(false)}>
          Send another
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {serverError && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {serverError}
        </p>
      )}

      {/* Honeypot. Hidden from people (and from screen readers via
          aria-hidden + tabIndex), irresistible to naive bots. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        defaultValue=""
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field data-invalid={!!form.formState.errors.name}>
          <FieldLabel htmlFor="contact-name" className="text-sm font-medium">
            Your name
          </FieldLabel>
          <Input
            id="contact-name"
            autoComplete="name"
            placeholder="Nimal Perera"
            className="h-11 rounded-xl px-3.5"
            {...form.register("name")}
          />
          {form.formState.errors.name && (
            <FieldError>{form.formState.errors.name.message}</FieldError>
          )}
        </Field>

        <Field data-invalid={!!form.formState.errors.email}>
          <FieldLabel htmlFor="contact-email" className="text-sm font-medium">
            Email
          </FieldLabel>
          <Input
            id="contact-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="h-11 rounded-xl px-3.5"
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <FieldError>{form.formState.errors.email.message}</FieldError>
          )}
        </Field>
      </div>

      <Field data-invalid={!!form.formState.errors.message}>
        <FieldLabel htmlFor="contact-message" className="text-sm font-medium">
          Message
        </FieldLabel>
        <Textarea
          id="contact-message"
          rows={6}
          placeholder="Which court are you asking about, and what do you need?"
          className="rounded-xl px-3.5 py-2.5"
          {...form.register("message")}
        />
        {form.formState.errors.message && (
          <FieldError>{form.formState.errors.message.message}</FieldError>
        )}
      </Field>

      <div>
        <Button type="submit" size="lg" disabled={pending} className="h-11">
          <Send />
          {pending ? "Sending…" : "Send message"}
        </Button>
      </div>
    </form>
  );
}
