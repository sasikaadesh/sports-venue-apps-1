"use client";

import { useState, useTransition } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { createSecurityStaffAction } from "@/app/admin/security-staff/actions";

/**
 * Creates one security-staff login: a username and a PIN, both chosen by the
 * super admin here and then given to that person directly — there is no
 * email round trip, because there is no email account at all
 * (lib/security-staff/*).
 */
export function SecurityStaffCreateForm() {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [label, setLabel] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await createSecurityStaffAction({ username, pin, label });
      if (result.ok) {
        toast.success(`Created login “${username.toLowerCase()}”.`);
        setUsername("");
        setPin("");
        setLabel("");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-4 rounded-xl border bg-card p-5"
    >
      <h2 className="font-heading text-lg font-bold tracking-tight">
        New security login
      </h2>

      <FieldGroup className="sm:grid sm:grid-cols-3 sm:gap-3 sm:space-y-0">
        <Field>
          <FieldLabel htmlFor="ss-username" className="text-sm font-medium">
            Username
          </FieldLabel>
          <Input
            id="ss-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="gate1"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={24}
            className="h-10"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="ss-pin" className="text-sm font-medium">
            PIN (4–6 digits)
          </FieldLabel>
          <Input
            id="ss-pin"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="4821"
            required
            minLength={4}
            maxLength={6}
            className="h-10"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="ss-label" className="text-sm font-medium">
            Label (optional)
          </FieldLabel>
          <Input
            id="ss-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Main gate — night shift"
            maxLength={60}
            className="h-10"
          />
        </Field>
      </FieldGroup>

      <div>
        <Button type="submit" disabled={pending} className="h-9">
          {pending ? <Loader2 className="animate-spin" /> : <UserPlus />}
          Create login
        </Button>
      </div>
    </form>
  );
}
