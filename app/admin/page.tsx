import { Ban, CalendarDays, Home, Plus, Shapes } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/link-button";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dateStringToDate, formatDate, todayString } from "@/lib/time";

export default async function AdminOverviewPage() {
  const admin = await requireAdmin("/admin");

  const today = dateStringToDate(todayString());

  const [courtTypes, courts, activeCourts, slots, upcoming, pendingCount] =
    await Promise.all([
      prisma.courtType.count(),
      prisma.court.count(),
      prisma.court.count({ where: { isActive: true } }),
      prisma.slotTemplate.count(),
      prisma.booking.findMany({
        where: { bookingDate: { gte: today }, status: { in: ["confirmed", "pending", "blocked"] } },
        orderBy: [{ bookingDate: "asc" }],
        take: 5,
        select: {
          id: true,
          bookingDate: true,
          status: true,
          court: { select: { name: true } },
          user: { select: { email: true } },
        },
      }),
      prisma.booking.count({ where: { status: "pending" } }),
    ]);

  const stats = [
    { label: "Court types", value: courtTypes, href: "/admin/court-types" },
    {
      label: "Courts",
      value: courts,
      hint: courts > 0 ? `${activeCourts} active` : undefined,
      href: "/admin/courts",
    },
    { label: "Slots defined", value: slots, href: "/admin/courts" },
    { label: "Pending holds", value: pendingCount, href: "/admin/bookings?status=pending" },
  ];

  const setupIncomplete = courtTypes === 0 || courts === 0 || slots === 0;

  return (
    <>
      <PageHeader
        title="Overview"
        description={`Signed in as ${admin.email}.`}
      />

      <div className="flex flex-col gap-10">
        <dl className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-card px-5 py-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </dt>
              <dd className="mt-1 flex items-baseline gap-2">
                <span className="font-heading text-2xl font-bold tabular-nums">
                  {stat.value}
                </span>
                {stat.hint && (
                  <span className="text-xs text-muted-foreground">
                    {stat.hint}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        {setupIncomplete && (
          <section className="flex flex-col gap-4 rounded-xl border bg-card px-6 py-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg">Finish setting up</h2>
              <p className="max-w-prose text-sm text-muted-foreground">
                A court is bookable once it has a type, a photo or two, and a
                weekly slot schedule.
              </p>
            </div>

            <ol className="flex flex-col gap-3">
              <SetupStep
                done={courtTypes > 0}
                icon={<Shapes className="size-4" />}
                title="Create a court type"
                detail="Tennis, Cricket, Table Tennis — with the player counts each allows."
                href="/admin/court-types"
              />
              <SetupStep
                done={courts > 0}
                icon={<Home className="size-4" />}
                title="Add a court"
                detail="Name it, pick its type, upload photos."
                href="/admin/courts/new"
              />
              <SetupStep
                done={slots > 0}
                icon={<CalendarDays className="size-4" />}
                title="Give it a slot schedule"
                detail="Weekly repeating time slots with prices."
                href="/admin/courts"
              />
            </ol>
          </section>
        )}

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg">Coming up</h2>
            <LinkButton
              href="/admin/bookings"
              variant="ghost"
              size="sm"
              className="h-8"
            >
              View all bookings
            </LinkButton>
          </div>

          {upcoming.length === 0 ? (
            <p className="rounded-xl border border-dashed px-5 py-6 text-sm text-muted-foreground">
              Nothing booked or blocked from today onwards.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {upcoming.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-5 py-3.5"
                >
                  <span className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-medium">{formatDate(b.bookingDate)}</span>
                    <span className="text-muted-foreground">{b.court.name}</span>
                    <span className="text-muted-foreground">
                      {b.status === "blocked"
                        ? "admin block"
                        : (b.user?.email ?? "—")}
                    </span>
                  </span>
                  <Badge variant="secondary">{b.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-wrap gap-2">
          <LinkButton href="/admin/courts/new" className="h-10">
            <Plus />
            New court
          </LinkButton>
          <LinkButton href="/admin/blocks" variant="outline" className="h-10">
            <Ban />
            Block a slot
          </LinkButton>
        </section>
      </div>
    </>
  );
}

function SetupStep({
  done,
  icon,
  title,
  detail,
  href,
}: {
  done: boolean;
  icon: React.ReactNode;
  title: string;
  detail: string;
  href: string;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
      <span className="flex items-center gap-3">
        <span
          className={
            done
              ? "grid size-8 place-items-center rounded-lg bg-primary/15 text-foreground"
              : "grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground"
          }
        >
          {icon}
        </span>
        <span className="flex flex-col">
          <span className="text-sm font-medium">{title}</span>
          <span className="text-xs text-muted-foreground">{detail}</span>
        </span>
      </span>

      {done ? (
        <Badge variant="secondary">Done</Badge>
      ) : (
        <LinkButton href={href} variant="outline" size="sm" className="h-8">
          Set up
        </LinkButton>
      )}
    </li>
  );
}
