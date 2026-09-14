import {
  CalendarDays,
  Clock,
  MessageSquarePlus,
  Phone,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { SpecialRequestStatus } from "@/components/admin/special-request-status";
import { SPECIAL_REQUEST_STATUS_LABELS as STATUS_LABELS } from "@/lib/validations";
import { BRAND } from "@/lib/brand";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateTime, formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Special requests — Admin" };

/**
 * Special requests from court pages. Read-only apart from the status: each one
 * is handled by hand (the admin contacts the member), and none of them is a
 * booking. `requireAdmin()` runs here as well as in the layout.
 */
export default async function AdminSpecialRequestsPage() {
  await requireAdmin("/admin/special-requests");

  const requests = await prisma.specialRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      courtName: true,
      name: true,
      email: true,
      phone: true,
      preferredDate: true,
      preferredTime: true,
      playerCount: true,
      message: true,
      status: true,
      createdAt: true,
      // Live name if the account still has one; the snapshot otherwise.
      user: { select: { name: true, phone: true } },
    },
  });

  const open = requests.filter((r) => r.status === "new").length;

  return (
    <>
      <PageHeader
        title="Special requests"
        description={
          requests.length === 0
            ? "Requests sent from a court page land here."
            : `${requests.length} request${requests.length === 1 ? "" : "s"}, ${open} new. None of these is a booking — contact the member, then update the status.`
        }
      />

      {requests.length === 0 ? (
        <EmptyState
          icon={<MessageSquarePlus className="size-5" />}
          title="No special requests yet"
          description="When a member uses “Special request” on a court page, it appears here with their contact details, the court, the time they asked for and why."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((r) => {
            const name = r.user?.name ?? r.name;
            const phone = r.user?.phone ?? r.phone;

            return (
              <li
                key={r.id}
                className={cn(
                  "flex flex-col gap-4 rounded-xl border bg-card px-5 py-4",
                  r.status === "new" && "border-primary/40"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-medium">{name ?? r.email}</span>
                      <Badge
                        variant={
                          r.status === "new"
                            ? "default"
                            : r.status === "contacted"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {STATUS_LABELS[r.status]}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <a
                        href={`mailto:${r.email}?subject=${encodeURIComponent(`Your special request — ${r.courtName}, ${BRAND.name}`)}`}
                        className="truncate underline underline-offset-4 hover:text-foreground"
                      >
                        {r.email}
                      </a>
                      {phone ? (
                        <a
                          href={`tel:${phone}`}
                          className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
                        >
                          <Phone className="size-3.5" />
                          {phone}
                        </a>
                      ) : (
                        <span>No phone on file</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(r.createdAt)}
                    </span>
                    <SpecialRequestStatus id={r.id} status={r.status} />
                  </div>
                </div>

                <dl className="grid gap-px overflow-hidden rounded-lg border bg-border text-sm sm:grid-cols-4">
                  <Detail label="Court" value={r.courtName} />
                  <Detail
                    label="Date"
                    value={formatDate(r.preferredDate)}
                    icon={<CalendarDays className="size-3.5" />}
                  />
                  <Detail
                    label="Time"
                    value={formatTime(r.preferredTime)}
                    icon={<Clock className="size-3.5" />}
                  />
                  <Detail
                    label="Players"
                    value={String(r.playerCount)}
                    icon={<Users className="size-3.5" />}
                  />
                </dl>

                {/* whitespace-pre-line keeps the member's paragraph breaks; the
                    text itself is escaped by React. */}
                <p className="max-w-prose text-sm leading-relaxed whitespace-pre-line">
                  {r.message}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function Detail({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 bg-card px-3.5 py-2.5">
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="flex items-center gap-1.5 font-medium">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        {value}
      </dd>
    </div>
  );
}
