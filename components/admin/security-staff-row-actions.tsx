"use client";

import { useState, useTransition } from "react";
import { KeyRound, Loader2, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  removeSecurityStaffAction,
  resetSecurityStaffPinAction,
  setSecurityStaffActiveAction,
} from "@/app/admin/security-staff/actions";
import type { ActionResult } from "@/lib/validations";

export function SecurityStaffRowActions({
  id,
  username,
  isActive,
}: {
  id: string;
  username: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [pin, setPin] = useState("");

  function run(action: () => Promise<ActionResult>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(success);
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={pending}
        title={isActive ? "Disable login" : "Re-enable login"}
        aria-label={isActive ? "Disable login" : "Re-enable login"}
        onClick={() =>
          run(
            () => setSecurityStaffActiveAction(id, !isActive),
            isActive ? `Disabled “${username}”.` : `Re-enabled “${username}”.`
          )
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <Power />}
      </Button>

      <Dialog>
        <DialogTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              title="Reset PIN"
              aria-label="Reset PIN"
            />
          }
        >
          <KeyRound />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset PIN for “{username}”</DialogTitle>
            <DialogDescription>
              Choose a new 4–6 digit PIN. The old one stops working immediately,
              and any lockout on this account is cleared.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="New PIN"
            minLength={4}
            maxLength={6}
            className="h-10"
          />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <DialogClose
              render={
                <Button
                  disabled={pin.length < 4}
                  onClick={() =>
                    run(
                      () => resetSecurityStaffPinAction({ id, pin }),
                      `PIN reset for “${username}”.`
                    )
                  }
                />
              }
            >
              Reset PIN
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-destructive hover:text-destructive"
              title="Remove login"
              aria-label="Remove login"
            />
          }
        >
          <Trash2 />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove “{username}”?</DialogTitle>
            <DialogDescription>
              This permanently deletes the login. If this person still needs
              access, disable it instead — that can be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Keep it
            </DialogClose>
            <DialogClose
              render={
                <Button
                  variant="destructive"
                  onClick={() =>
                    run(
                      () => removeSecurityStaffAction(id),
                      `Removed “${username}”.`
                    )
                  }
                />
              }
            >
              Remove
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
