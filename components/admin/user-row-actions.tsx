"use client";

import { useTransition } from "react";
import { ShieldMinus, ShieldPlus, Trash2 } from "lucide-react";
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
import { removeUserAction, setUserRoleAction } from "@/app/admin/users/actions";

/**
 * Row controls for the Users tab.
 *
 * Everything here is presentation: `canManage` and `actorIsSuperAdmin` only
 * decide what is *drawn*. The same rules are re-derived from the database in
 * `app/admin/users/actions.ts` on every call, so hiding a button is a courtesy
 * and never the boundary.
 */
export function UserRowActions({
  userId,
  email,
  role,
  isSelf,
  canManage,
  actorIsSuperAdmin,
  bookingCount,
}: {
  userId: string;
  email: string;
  role: "user" | "admin" | "super_admin";
  isSelf: boolean;
  canManage: boolean;
  actorIsSuperAdmin: boolean;
  bookingCount: number;
}) {
  const [pending, startTransition] = useTransition();

  if (isSelf) {
    return (
      <span className="text-xs text-muted-foreground">That&rsquo;s you</span>
    );
  }

  if (!canManage) {
    return (
      <span className="text-xs text-muted-foreground">
        Super admin only
      </span>
    );
  }

  const isAdminAccount = role === "admin";

  return (
    <div className="flex items-center justify-end gap-1">
      {actorIsSuperAdmin && role !== "super_admin" && (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await setUserRoleAction(
                userId,
                isAdminAccount ? "user" : "admin"
              );
              if (result.ok) {
                toast.success(
                  isAdminAccount
                    ? `${email} is no longer an admin.`
                    : `${email} is now an admin.`
                );
              } else {
                toast.error(result.error);
              }
            })
          }
        >
          {isAdminAccount ? <ShieldMinus /> : <ShieldPlus />}
          {isAdminAccount ? "Remove admin" : "Make admin"}
        </Button>
      )}

      {role !== "super_admin" && (
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
            Remove
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove {email}?</DialogTitle>
              <DialogDescription>
                This deletes their sign-in permanently — they will not be able
                to log in again, and there is no undo.
                {bookingCount > 0 ? (
                  <>
                    {" "}
                    Their {bookingCount} booking
                    {bookingCount === 1 ? "" : "s"} stay in the records for your
                    history and payment trail, but stop naming a person.
                  </>
                ) : (
                  " They have no bookings on file."
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Keep the account
              </DialogClose>
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await removeUserAction(userId);
                    if (result.ok) toast.success(`${email} removed.`);
                    else toast.error(result.error);
                  })
                }
              >
                <Trash2 />
                Remove account
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
