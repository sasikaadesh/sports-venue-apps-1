"use client";

import { useTransition } from "react";
import { Mail, MailOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import {
  deleteMessageAction,
  setMessageReadAction,
} from "@/app/admin/messages/actions";

export function MessageActions({
  id,
  isRead,
  from,
}: {
  id: string;
  isRead: boolean;
  from: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await setMessageReadAction(id, !isRead);
            if (result.ok) toast.success(isRead ? "Marked unread." : "Marked read.");
            else toast.error(result.error);
          })
        }
      >
        {isRead ? <Mail /> : <MailOpen />}
        {isRead ? "Unread" : "Read"}
      </Button>

      <Dialog>
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              className="text-muted-foreground hover:text-destructive"
            />
          }
        >
          <Trash2 />
          Delete
        </DialogTrigger>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this message?</DialogTitle>
            <DialogDescription>
              The message from {from} is removed permanently. Nothing is emailed
              and there is no undo — copy anything you still need first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Keep it</DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteMessageAction(id);
                  if (result.ok) toast.success("Message deleted.");
                  else toast.error(result.error);
                })
              }
            >
              <Trash2 />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
