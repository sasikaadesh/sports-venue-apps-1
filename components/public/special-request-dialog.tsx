"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  CheckCircle2,
  MessageSquarePlus,
  Send,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/admin/native-select";
import { LinkButton } from "@/components/link-button";
import { submitSpecialRequest } from "@/app/(public)/courts/[id]/actions";
import {
  specialRequestSchema,
  type SpecialRequestInput,
} from "@/lib/validations";

/**
 * "Special request" entry point on a court page: a short form that files a
 * manual request with the admin. It books nothing — the copy says so, and the
 * server action never touches the booking tables.
 *
 * Signed-out visitors get a sign-in link that returns them to this court,
 * because the request is filed against their account.
 */
export function SpecialRequestDialog({
  courtId,
  courtName,
  playerOptions,
  signedIn,
  returnTo,
  defaultDate,
  minDate,
}: {
  courtId: string;
  courtName: string;
  playerOptions: number[];
  signedIn: boolean;
  returnTo: string;
  defaultDate: string;
  minDate: string;
}) {
  if (!signedIn) {
    return (
      <LinkButton
        href={`/login?next=${encodeURIComponent(returnTo)}`}
        variant="outline"
        size="sm"
        className="h-9 w-fit"
      >
        <MessageSquarePlus />
        Sign in to send a special request
      </LinkButton>
    );
  }

  return (
    <SignedInDialog
      courtId={courtId}
      courtName={courtName}
      playerOptions={playerOptions}
      defaultDate={defaultDate}
      minDate={minDate}
    />
  );
}

function SignedInDialog({
  courtId,
  courtName,
  playerOptions,
  defaultDate,
  minDate,
}: {
  courtId: string;
  courtName: string;
  playerOptions: number[];
  defaultDate: string;
  minDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const defaults: SpecialRequestInput = {
    courtId,
    preferredDate: defaultDate,
    preferredTime: "18:00",
    playerCount: playerOptions[0] ?? 2,
    message: "",
  };

  const form = useForm<SpecialRequestInput>({
    mode: "onTouched",
    resolver: zodResolver(specialRequestSchema),
    defaultValues: defaults,
  });
  const errors = form.formState.errors;

  function onOpenChange(next: boolean) {
    setOpen(next);
    // Reopening after a send starts a fresh form rather than the thank-you.
    if (next && sent) {
      setSent(false);
      form.reset(defaults);
    }
    if (next) setServerError(null);
  }

  function onSubmit(values: SpecialRequestInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await submitSpecialRequest(values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      setSent(true);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" className="h-9 w-fit" />}
      >
        <MessageSquarePlus />
        Special request
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        {sent ? (
          <div className="flex flex-col items-start gap-4">
            {/* Solid green chip: green on pale green is too low-contrast. */}
            <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
              <CheckCircle2 className="size-5" />
            </span>
            <DialogHeader>
              <DialogTitle>Request sent</DialogTitle>
              <DialogDescription>
                Your request has been sent to the college admin — they&apos;ll
                be in touch.
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Nothing has been booked yet.
            </p>
            <DialogClose render={<Button variant="outline" className="h-10" />}>
              Done
            </DialogClose>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Special request</DialogTitle>
              <DialogDescription>
                Need a time outside the listed hours, or something the booking
                grid can&apos;t do? Ask the college admin directly. This is a
                request, not a booking — nothing is reserved.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
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

              <Field>
                <FieldLabel htmlFor="sr-court" className="text-sm font-medium">
                  Court
                </FieldLabel>
                <Input
                  id="sr-court"
                  value={courtName}
                  readOnly
                  className="h-10 rounded-xl bg-muted/50 px-3.5 text-muted-foreground"
                />
                <input type="hidden" {...form.register("courtId")} />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={!!errors.preferredDate}>
                  <FieldLabel htmlFor="sr-date" className="text-sm font-medium">
                    Preferred date
                  </FieldLabel>
                  <Input
                    id="sr-date"
                    type="date"
                    min={minDate}
                    className="h-10 rounded-xl px-3.5"
                    {...form.register("preferredDate")}
                  />
                  {errors.preferredDate && (
                    <FieldError>{errors.preferredDate.message}</FieldError>
                  )}
                </Field>

                <Field data-invalid={!!errors.preferredTime}>
                  <FieldLabel htmlFor="sr-time" className="text-sm font-medium">
                    Preferred time
                  </FieldLabel>
                  <Input
                    id="sr-time"
                    type="time"
                    step={60}
                    className="h-10 rounded-xl px-3.5"
                    {...form.register("preferredTime")}
                  />
                  {errors.preferredTime && (
                    <FieldError>{errors.preferredTime.message}</FieldError>
                  )}
                </Field>
              </div>

              <Field data-invalid={!!errors.playerCount}>
                <FieldLabel
                  htmlFor="sr-players"
                  className="text-sm font-medium"
                >
                  Number of players
                </FieldLabel>
                {playerOptions.length > 0 ? (
                  <NativeSelect
                    id="sr-players"
                    {...form.register("playerCount", { valueAsNumber: true })}
                  >
                    {playerOptions.map((n) => (
                      <option key={n} value={n}>
                        {n} players
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  <Input
                    id="sr-players"
                    type="number"
                    min={1}
                    max={100}
                    className="h-10 rounded-xl px-3.5"
                    {...form.register("playerCount", { valueAsNumber: true })}
                  />
                )}
                {errors.playerCount && (
                  <FieldError>{errors.playerCount.message}</FieldError>
                )}
              </Field>

              <Field data-invalid={!!errors.message}>
                <FieldLabel
                  htmlFor="sr-message"
                  className="text-sm font-medium"
                >
                  Reason / message
                </FieldLabel>
                <Textarea
                  id="sr-message"
                  rows={4}
                  maxLength={1000}
                  placeholder="What do you need, and why? e.g. a school team practice before the weekend match."
                  className="rounded-xl px-3.5 py-2.5"
                  {...form.register("message")}
                />
                {errors.message && (
                  <FieldError>{errors.message.message}</FieldError>
                )}
              </Field>

              <p className="text-xs text-muted-foreground">
                The admin will contact you using the email and phone number on
                your account.
              </p>

              <div className="flex flex-wrap justify-end gap-2">
                <DialogClose
                  render={<Button variant="outline" className="h-10" />}
                >
                  Cancel
                </DialogClose>
                <Button type="submit" disabled={pending} className="h-10">
                  <Send />
                  {pending ? "Sending…" : "Send request"}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
