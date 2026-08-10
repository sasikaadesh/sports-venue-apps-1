import Link from "next/link";
import {
  Ban,
  CalendarDays,
  CircleAlert,
  Home,
  Minus,
  Plus,
  Shapes,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LinkButton } from "@/components/link-button";
import { PageHeader } from "@/components/admin/page-header";
import {
  BookingsTrendChart,
  CourtMixChart,
} from "@/components/admin/dashboard-charts";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getAdminDashboard,
  type CourtPerformance,
} from "@/lib/admin-dashboard";
import {
  dateStringToDate,
  formatDate,
  formatMonth,
  formatPrice,
  formatPriceCompact,
  todayString,
} from "@/lib/time";

/**
 * The admin Overview — the venue's month on one screen.
 *
 * Everything on it is measured, not decorated: four figures management asks
 * for, the six-month shape behind them, where the bookings actually went, and
 * the two queues that need somebody to act. The setup checklist and the
 * "Coming up" list stay, because a half-configured venue needs the checklist
 * more than it needs a chart.
 *
 * Every number comes from `lib/admin-dashboard.ts`, which also carries the
 * definitions — what counts as a booking, what counts as revenue, and which
 * month a booking belongs to. Those definitions are restated in plain words on
 * the page itself (under the per-court table): a dashboard whose tiles cannot
 * be reconciled with the Bookings table is one nobody trusts twice. Each tile
 * therefore also links to the filtered Bookings view that produced it.
 */

/** How many courts the donut names before the rest fold into "Other". */
const MIX_SLICE_LIMIT = 5;

/**
 * `dates=set` means "the date range in this URL is deliberate" — /admin/bookings
 * defaults to the current month without it. See `parseBookingView`.
 */
const ALL_DATES = "dates=set";

/** Every unpaid hold on record, not just this month's. */
const PENDING_HOLDS_HREF = `/admin/bookings?status=pending&${ALL_DATES}`;

/** Cancelled bookings that were paid for — the refund queue. */
const REFUNDS_HREF = `/admin/bookings?status=cancelled&pay=success&${ALL_DATES}`;

export default async function AdminOverviewPage() {
  const admin = await requireAdmin("/admin");

  const today = todayString();
  const todayDate = dateStringToDate(today);

  // The three counts drive the setup checklist only — how many courts are
  // *live* is now visible in the per-court table below, court by court.
  const [dashboard, courtTypes, courts, slots, upcoming] = await Promise.all([
    getAdminDashboard(),
    prisma.courtType.count(),
    prisma.court.count(),
    prisma.slotTemplate.count(),
    prisma.booking.findMany({
      where: {
        bookingDate: { gte: todayDate },
        status: { in: ["confirmed", "pending", "blocked"] },
      },
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
  ]);

  const { month, bookings, revenue, utilisation, attention, trend } = dashboard;

  // The month's own bookings, whatever the resting default of that page is.
  const monthHref = `/admin/bookings?from=${month.from}&to=${month.to}`;

  const mix = courtMix(dashboard.courts);
  const hasTrend = trend.some(
    (point) => point.bookings > 0 || point.revenue > 0
  );

  const setupIncomplete = courtTypes === 0 || courts === 0 || slots === 0;

  return (
    <>
      <PageHeader
        title="Overview"
        description={`${formatMonth(today)} · signed in as ${admin.email}.`}
        action={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/admin/courts/new" className="h-10">
              <Plus />
              New court
            </LinkButton>
            <LinkButton href="/admin/blocks" variant="outline" className="h-10">
              <Ban />
              Block a slot
            </LinkButton>
          </div>
        }
      />

      <div className="flex flex-col gap-8">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Bookings this month"
            value={String(bookings.value)}
            change={bookings.changePercent}
            hint={
              bookings.previous === null
                ? "no earlier month to compare"
                : `${bookings.previous} last month`
            }
            href={monthHref}
          />

          <StatCard
            label="Revenue this month"
            value={formatPriceCompact(revenue.value)}
            title={formatPrice(revenue.value)}
            change={revenue.changePercent}
            hint={
              revenue.previous === null
                ? "no earlier month to compare"
                : `${formatPriceCompact(revenue.previous)} last month`
            }
            href={`${monthHref}&pay=success`}
          />

          <StatCard
            label="Court utilisation"
            value={
              utilisation.percent === null
                ? "—"
                : formatPercent(utilisation.percent)
            }
            hint={
              utilisation.percent === null
                ? "no slot schedule yet"
                : `${utilisation.bookedHours} of ${utilisation.capacityHours} slot hours`
            }
            href="/admin/courts"
          />

          <StatCard
            label="Needs attention"
            value={String(attention.total)}
            icon={
              attention.total > 0 ? (
                <CircleAlert className="size-4" />
              ) : undefined
            }
            hint={
              attention.total === 0
                ? "nothing waiting"
                : `${attention.pendingHolds} unpaid hold${attention.pendingHolds === 1 ? "" : "s"} · ${attention.refundsRequired} to refund`
            }
            /*
              Opens whichever of the two queues actually has something in it.
              A tile that counts both but always opens the empty one sends an
              admin looking for work that is not there.
            */
            href={
              attention.pendingHolds === 0 && attention.refundsRequired > 0
                ? REFUNDS_HREF
                : PENDING_HOLDS_HREF
            }
          />
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

        <div className="grid gap-4 lg:grid-cols-5">
          <Panel
            className="lg:col-span-3"
            title="Last six months"
            description="Bookings taken and money received, by the month the court was booked for."
          >
            {hasTrend ? (
              <BookingsTrendChart data={trend} />
            ) : (
              <Placeholder>No bookings yet in the last six months.</Placeholder>
            )}
          </Panel>

          <Panel
            className="lg:col-span-2"
            title="Where this month went"
            description="Bookings by court — which courts carry the venue, and which are idle."
          >
            {mix.length > 0 ? (
              <CourtMixChart data={mix} />
            ) : (
              <Placeholder>Nothing booked this month yet.</Placeholder>
            )}
          </Panel>
        </div>

        <Panel
          title="By court, this month"
          description="Same month as the tiles above."
          action={
            <LinkButton
              href={monthHref}
              variant="ghost"
              size="sm"
              className="h-8"
            >
              Open in Bookings
            </LinkButton>
          }
        >
          {dashboard.courts.length === 0 ? (
            <Placeholder>No courts yet.</Placeholder>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Court</TableHead>
                    <TableHead className="text-right">Bookings</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Utilisation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.courts.map((court) => (
                    <TableRow key={court.id}>
                      <TableCell>
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{court.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {court.typeName}
                          </span>
                          {!court.isActive && (
                            <Badge variant="secondary">retired</Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {court.bookings}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {court.bookedHours}
                        {court.capacityHours > 0 && (
                          <span className="text-muted-foreground">
                            {" / "}
                            {court.capacityHours}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPrice(court.revenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        <UtilisationBar value={court.utilisation} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* The rules behind every figure above, in one line — so a tile can
              always be reconciled against the Bookings table. */}
          <p className="max-w-prose text-xs text-muted-foreground">
            Bookings counted are those that stand — confirmed or held; admin
            blocks, cancellations and expired holds are excluded. Revenue is
            money actually received through PayHere. Utilisation is booked hours
            over the hours the weekly schedule offers this month
            {utilisation.blockedHours > 0 &&
              `, of which ${utilisation.blockedHours} ${
                utilisation.blockedHours === 1 ? "hour is" : "hours are"
              } blocked by an admin`}
            .
          </p>
        </Panel>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg">Coming up</h2>
            <LinkButton
              href={`/admin/bookings?${ALL_DATES}`}
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
                    <span className="font-medium">
                      {formatDate(b.bookingDate)}
                    </span>
                    <span className="text-muted-foreground">
                      {b.court.name}
                    </span>
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
      </div>
    </>
  );
}

/**
 * The donut's data: the busiest courts by name, everything else as one slice.
 *
 * Named slices are capped because a venue with a dozen courts produces a
 * legend longer than the chart and a ring of slivers — and the answer to
 * "which courts carry the venue" is in the first few either way. Courts with no
 * bookings are dropped rather than drawn as a zero-width slice; the table above
 * is where an idle court is visible, which is the point of having both.
 */
function courtMix(courts: CourtPerformance[]) {
  const booked = courts
    .filter((court) => court.bookings > 0)
    .sort((a, b) => b.bookings - a.bookings);

  if (booked.length <= MIX_SLICE_LIMIT) {
    return booked.map((court) => ({ name: court.name, value: court.bookings }));
  }

  const named = booked.slice(0, MIX_SLICE_LIMIT);
  const rest = booked.slice(MIX_SLICE_LIMIT);

  return [
    ...named.map((court) => ({ name: court.name, value: court.bookings })),
    {
      name: `${rest.length} other courts`,
      value: rest.reduce((sum, court) => sum + court.bookings, 0),
    },
  ];
}

/**
 * A percentage, rounded to where it still says something.
 *
 * Whole numbers once past 10%, one decimal below it: a venue that has sold six
 * of its 1,330 slot hours is at 0.5%, and rounding that to a flat "0%" reads as
 * a broken tile rather than as a quiet month.
 */
function formatPercent(value: number): string {
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)}%`;
}

/** One KPI tile: a figure, what moved it, and a way through to the rows behind it. */
function StatCard({
  label,
  value,
  title,
  hint,
  change,
  href,
  icon,
}: {
  label: string;
  value: string;
  /** Full-precision value for the `title` tooltip, when `value` is abbreviated. */
  title?: string;
  hint?: string;
  /** Percentage change against last month, or null when there is nothing to compare. */
  change?: number | null;
  href: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card transition-colors hover:border-foreground/20">
      {/* The whole tile is the link — a KPI that cannot be opened is a number
          an admin has to go and re-find by hand. */}
      <Link
        href={href}
        className="flex flex-col gap-2 rounded-xl px-5 py-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <dt className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {icon}
          {label}
        </dt>
        <dd className="flex flex-wrap items-baseline gap-2">
          <span
            title={title}
            className="font-heading text-3xl font-bold tracking-tight tabular-nums"
          >
            {value}
          </span>
          {change !== undefined && change !== null && (
            <ChangeBadge value={change} />
          )}
        </dd>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </Link>
    </div>
  );
}

/**
 * "+18% vs last month", with the arrow.
 *
 * Up is the accent green and down is the destructive red — the one place a
 * second colour earns its keep, because the direction *is* the message and a
 * monochrome arrow makes an admin read the sign character by character.
 */
function ChangeBadge({ value }: { value: number }) {
  const rounded = Math.round(value);
  const Icon = rounded > 0 ? TrendingUp : rounded < 0 ? TrendingDown : Minus;
  const tone =
    rounded > 0
      ? "text-primary"
      : rounded < 0
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <span
      className={`flex items-center gap-1 text-xs font-medium tabular-nums ${tone}`}
      title="Compared with the same measure last month"
    >
      <Icon className="size-3.5" aria-hidden />
      {rounded > 0 ? "+" : ""}
      {rounded}%
    </span>
  );
}

/**
 * A court's utilisation as a number and a bar.
 *
 * The bar is what makes the column scannable — "which courts are idle" is a
 * shape question, and reading a column of percentages is not how anyone answers
 * it. Capped at 100% width so a court that somehow oversold (a schedule
 * shortened after bookings were taken) still draws inside its track.
 */
function UtilisationBar({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-sm text-muted-foreground">no schedule</span>;
  }

  return (
    <span className="flex items-center justify-end gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-primary"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </span>
      <span className="w-12 text-right text-sm tabular-nums">
        {formatPercent(value)}
      </span>
    </span>
  );
}

/** A titled card. The dashboard's unit of layout. */
function Panel({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`flex flex-col gap-4 rounded-xl border bg-card px-5 py-5 ${className ?? ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-base font-bold tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="max-w-prose text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** What a chart shows before the venue has any history. */
function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed px-5 py-10 text-sm text-muted-foreground">
      {children}
    </p>
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
