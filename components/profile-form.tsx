"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { NativeSelect } from "@/components/admin/native-select";
import { updateProfileAction } from "@/app/account/actions";
import {
  AFFILIATIONS,
  profileSchema,
  type ProfileInput,
} from "@/lib/validations";

/**
 * Edit your own name, phone, address and affiliation.
 *
 * Shared by the account page and the "Complete your profile" step so the two
 * cannot drift — same fields, same schema, same server action. Feedback is
 * inline rather than a toast because neither page mounts a Toaster.
 *
 * Every field starts empty-tolerant (`?? ""`): an account created before the
 * affiliation column existed simply arrives with it blank, and the form asks
 * for it like any other missing value.
 */
export function ProfileForm({
  defaultValues,
  submitLabel = "Save changes",
  redirectTo,
}: {
  defaultValues: Partial<ProfileInput>;
  submitLabel?: string;
  /** When set, navigate here after a successful save instead of staying put. */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const form = useForm<ProfileInput>({
    // Validate a field when it is left, then on each keystroke once it has
    // been flagged. The server action re-validates with the same schema.
    mode: "onTouched",
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: defaultValues.name ?? "",
      phone: defaultValues.phone ?? "",
      address: defaultValues.address ?? "",
      // No default option: an unset affiliation must read as "not answered
      // yet", not as a silent "Old Boy" for every legacy account.
      affiliation:
        defaultValues.affiliation ?? ("" as ProfileInput["affiliation"]),
    },
  });

  function onSubmit(values: ProfileInput) {
    setServerError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await updateProfileAction(values);

      if (!result.ok) {
        setServerError(result.error);
        return;
      }

      if (redirectTo) {
        router.push(redirectTo);
        // Keep the button disabled through the navigation rather than
        // flashing "Saved" for the instant before the page changes.
        return;
      }

      setSaved(true);
      form.reset(values);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-5"
    >
      {serverError && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {serverError}
        </p>
      )}

      {saved && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-3 text-sm text-foreground"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
          Profile saved.
        </p>
      )}

      <Field data-invalid={!!form.formState.errors.name}>
        <FieldLabel htmlFor="profile-name" className="text-sm font-medium">
          Full name
        </FieldLabel>
        <Input
          id="profile-name"
          autoComplete="name"
          placeholder="Nimal Perera"
          className="h-11 rounded-xl px-3.5"
          {...form.register("name")}
        />
        {form.formState.errors.name && (
          <FieldError>{form.formState.errors.name.message}</FieldError>
        )}
      </Field>

      <Field data-invalid={!!form.formState.errors.phone}>
        <FieldLabel htmlFor="profile-phone" className="text-sm font-medium">
          Phone
        </FieldLabel>
        <Input
          id="profile-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="077 123 4567"
          className="h-11 rounded-xl px-3.5"
          {...form.register("phone")}
        />
        {form.formState.errors.phone && (
          <FieldError>{form.formState.errors.phone.message}</FieldError>
        )}
      </Field>

      <Field data-invalid={!!form.formState.errors.address}>
        <FieldLabel htmlFor="profile-address" className="text-sm font-medium">
          Address
        </FieldLabel>
        <Textarea
          id="profile-address"
          rows={3}
          autoComplete="street-address"
          placeholder="12 Galle Road, Colombo 03"
          className="rounded-xl px-3.5 py-2.5"
          {...form.register("address")}
        />
        {form.formState.errors.address && (
          <FieldError>{form.formState.errors.address.message}</FieldError>
        )}
      </Field>

      <Field data-invalid={!!form.formState.errors.affiliation}>
        <FieldLabel
          htmlFor="profile-affiliation"
          className="text-sm font-medium"
        >
          Affiliation
        </FieldLabel>
        <NativeSelect
          id="profile-affiliation"
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
        {form.formState.errors.affiliation && (
          <FieldError>{form.formState.errors.affiliation.message}</FieldError>
        )}
      </Field>

      <div>
        <Button type="submit" disabled={pending} className="h-10">
          <Save />
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
