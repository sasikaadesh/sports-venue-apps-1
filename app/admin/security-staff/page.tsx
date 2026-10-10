import { ShieldAlert } from "lucide-react";

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
import { SecurityStaffCreateForm } from "@/components/admin/security-staff-create-form";
import { SecurityStaffRowActions } from "@/components/admin/security-staff-row-actions";
import { requireSuperAdmin } from "@/lib/auth";
import { listSecurityStaff } from "@/lib/security-staff/service";
import { formatDateOnly, isFuture } from "@/lib/time";

export const metadata = { title: "Security staff — Admin" };

/**
 * Super-admin-only: create, disable, reset the PIN of, or remove a
 * security-staff login. Plain `admin` is bounced to `/admin?denied=super_admin`
 * by `requireSuperAdmin`, same as every other super-admin-only page.
 *
 * These logins are not Supabase Auth accounts and carry no `Role` — see
 * `SecurityStaff` in schema.prisma and docs/ARCHITECTURE.md → "Security
 * staff" for why. The only thing a login may ever do with it is sign in at
 * `/security-login` and view `/bookings`.
 */
export default async function SecurityStaffPage() {
  await requireSuperAdmin("/admin/security-staff");

  const staff = await listSecurityStaff();

  return (
    <>
      <PageHeader
        title="Security staff"
        description="Individual username + PIN logins for security staff. Each one can only view the Bookings overview — nothing else in this panel."
      />

      <div className="flex flex-col gap-6">
        <SecurityStaffCreateForm />

        {staff.length === 0 ? (
          <EmptyState
            icon={<ShieldAlert className="size-5" />}
            title="No security logins yet"
            description="Create one above and hand the username and PIN to that person directly."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Username</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="pr-5 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((row) => {
                  const locked = isFuture(row.lockedUntil);

                  return (
                    <TableRow key={row.id}>
                      <TableCell className="pl-5 font-mono text-sm font-medium">
                        {row.username}
                      </TableCell>
                      <TableCell className="max-w-[24ch] truncate text-muted-foreground">
                        {row.label ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant={row.isActive ? "default" : "secondary"}
                          >
                            {row.isActive ? "Active" : "Disabled"}
                          </Badge>
                          {locked && (
                            <Badge variant="destructive">Locked</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateOnly(row.createdAt)}
                        {row.createdBy && (
                          <span className="block text-xs">
                            by {row.createdBy.name ?? row.createdBy.email}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="pr-5">
                        <SecurityStaffRowActions
                          id={row.id}
                          username={row.username}
                          isActive={row.isActive}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
