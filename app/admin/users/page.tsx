import { ShieldAlert, Users as UsersIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { UserRowActions } from "@/components/admin/user-row-actions";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Users — Admin" };

const ROLE_LABEL = {
  user: "user",
  admin: "admin",
  super_admin: "super admin",
} as const;

/**
 * Registered accounts.
 *
 * Visible to any admin — knowing who has an account is ordinary staff need.
 * *Acting* on an admin account is super-admin only, decided per row below and
 * re-checked from the database inside every action.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const actor = await requireAdmin("/admin/users");
  const { denied } = await searchParams;

  const users = await prisma.user.findMany({
    orderBy: [{ role: "desc" }, { createdAt: "desc" }],
    take: 500,
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      createdAt: true,
      _count: { select: { bookings: true } },
    },
  });

  const actorIsSuperAdmin = actor.role === "super_admin";
  const adminCount = users.filter((u) => u.role !== "user").length;

  return (
    <>
      <PageHeader
        title="Users"
        description={
          actorIsSuperAdmin
            ? "Everyone with an account. As a super admin you can promote a user to admin, demote an admin, and remove accounts."
            : "Everyone with an account. You can remove user accounts; only a super admin can manage administrators."
        }
      />

      <div className="flex flex-col gap-6">
        {denied === "super_admin" && (
          <p
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              That action is restricted to super admins. It was refused on the
              server, not just hidden here.
            </span>
          </p>
        )}

        {users.length === 0 ? (
          <EmptyState
            icon={<UsersIcon className="size-5" />}
            title="No accounts yet"
            description="Everyone who signs up — by email or with Google — appears here."
          />
        ) : (
          <>
            <dl className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
              <Stat label="Accounts" value={users.length} />
              <Stat label="Administrators" value={adminCount} />
              <Stat
                label="Your role"
                value={ROLE_LABEL[actor.role]}
              />
            </dl>

            <div className="rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Bookings</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="pr-5 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {users.map((u) => {
                    const isSelf = u.id === actor.id;
                    // Mirrors `loadTarget` in the actions: a plain admin may
                    // only act on plain users.
                    const canManage =
                      !isSelf && (actorIsSuperAdmin || u.role === "user");

                    return (
                      <TableRow key={u.id}>
                        <TableCell className="pl-5 font-medium">
                          {u.name ?? (
                            <span className="font-normal text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[22ch] truncate text-muted-foreground">
                          {u.email}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.phone ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              u.role === "user" ? "secondary" : "default"
                            }
                          >
                            {ROLE_LABEL[u.role]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {u._count.bookings}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(u.createdAt)}
                        </TableCell>
                        <TableCell className="pr-5 text-right">
                          <UserRowActions
                            userId={u.id}
                            email={u.email}
                            role={u.role}
                            isSelf={isSelf}
                            canManage={canManage}
                            actorIsSuperAdmin={actorIsSuperAdmin}
                            bookingCount={u._count.bookings}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <p className="max-w-prose text-sm text-muted-foreground">
              The super admin role is never handed out from this panel — it is
              granted with database access (<code className="font-mono text-xs">npm run make-admin -- &lt;email&gt; super_admin</code>),
              so the panel can never mint an account able to remove you.
            </p>
          </>
        )}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-card px-5 py-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-heading text-2xl font-bold tabular-nums">
        {value}
      </dd>
    </div>
  );
}
