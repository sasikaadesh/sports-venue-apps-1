"use client";

import { useTransition } from "react";
import { ShieldMinus, ShieldPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  ConfirmRowAction,
  RowActionNote,
  RowActions,
  RowActionSpacer,
} from "@/components/admin/row-actions";
import { removeUserAction, setUserRoleAction } from "@/app/admin/users/actions";

/**
 * Row controls for the Users tab — one "Actions" cell, icon buttons only,
 * matching the Bookings table.
 *
 * Everything here is presentation: `canManage` and `actorIsSuperAdmin` only
 * decide what is *drawn*. The same rules are re-derived from the database in
 * `app/admin/users/actions.ts` on every call, so hiding a button is a courtesy
 * and never the boundary.
 *
 * Two slots, in the same order on every row: the role toggle, then Remove. The
 * role toggle now confirms as well — it did not need to when it was a button
 * with the word "admin" written on it, but an icon that grants administrator
 * rights on one click is not something to leave un-guarded.
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
      <RowActions columns={2}>
        <RowActionNote>
          That is your own account — you cannot act on it here
        </RowActionNote>
        <RowActionSpacer />
      </RowActions>
    );
  }

  if (!canManage) {
    return (
      <RowActions columns={2}>
        <RowActionNote>
          Super admin only — this account is an administrator
        </RowActionNote>
        <RowActionSpacer />
      </RowActions>
    );
  }

  const isAdminAccount = role === "admin";

  return (
    <RowActions columns={2}>
      {/* --- Slot 1: promote or demote --- */}
      {actorIsSuperAdmin && role !== "super_admin" ? (
        <ConfirmRowAction
          icon={isAdminAccount ? <ShieldMinus /> : <ShieldPlus />}
          label={isAdminAccount ? "Remove admin rights" : "Make admin"}
          tone={isAdminAccount ? "danger" : "default"}
          pending={pending}
          title={
            isAdminAccount
              ? `Remove admin rights from ${email}?`
              : `Make ${email} an administrator?`
          }
          description={
            isAdminAccount
              ? "They keep their account and their bookings, but lose the admin panel — no courts, no bookings, no other accounts. You can grant it again at any time."
              : "They get the whole admin panel: courts, bookings, slot blocks and every account on this page. They will not be able to promote anyone else, or touch a super admin."
          }
          confirmLabel={isAdminAccount ? "Remove admin rights" : "Make admin"}
          confirmIcon={isAdminAccount ? <ShieldMinus /> : <ShieldPlus />}
          cancelLabel="Leave the role as it is"
          onConfirm={() =>
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
        />
      ) : (
        <RowActionSpacer />
      )}

      {/* --- Slot 2: remove the account --- */}
      {role !== "super_admin" ? (
        <ConfirmRowAction
          icon={<Trash2 />}
          label="Remove account"
          tone="danger"
          pending={pending}
          title={`Remove ${email}?`}
          description={
            <>
              This deletes their sign-in permanently — they will not be able to
              log in again, and there is no undo.
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
            </>
          }
          confirmLabel="Remove account"
          confirmIcon={<Trash2 />}
          cancelLabel="Keep the account"
          onConfirm={() =>
            startTransition(async () => {
              const result = await removeUserAction(userId);
              if (result.ok) toast.success(`${email} removed.`);
              else toast.error(result.error);
            })
          }
        />
      ) : (
        <RowActionSpacer />
      )}
    </RowActions>
  );
}
