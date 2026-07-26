"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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

/**
 * "Remove" (clear selection) control with a confirmation step.
 *
 * The trigger opens a dialog; only the dialog's Remove button runs `onConfirm`.
 * A selection here is unconfirmed and unpaid — nothing is reserved yet, so
 * clearing it discards local UI state only. (Once payments exist, releasing a
 * held/paid booking will be a separate, server-side path.)
 */
export function RemoveSelectionDialog({
  onConfirm,
  triggerLabel = "Remove",
  title = "Remove this selection?",
  description = "This clears the hours you picked. Nothing has been reserved or paid, so nothing is lost — you can choose again anytime.",
  triggerVariant = "ghost",
  triggerSize = "default",
  triggerClassName,
}: {
  onConfirm: () => void;
  triggerLabel?: string;
  title?: string;
  description?: string;
  triggerVariant?: "ghost" | "outline" | "destructive";
  triggerSize?: "default" | "sm" | "lg";
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={triggerVariant}
            size={triggerSize}
            className={triggerClassName}
          />
        }
      >
        <Trash2 />
        {triggerLabel}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Keep it
          </DialogClose>
          <Button
            variant="destructive"
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            <Trash2 />
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
