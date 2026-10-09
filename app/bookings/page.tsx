import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CourtColorDot } from "@/components/court-color-dot";
import { CourtLegend } from "@/components/court-legend";
import {
  getBookingsOverview,
  getCourtLegend,
  type BookingsOverviewTab,
} from "@/lib/security-bookings";
import { formatDate, formatDateOnly, dateStringToDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Bookings overview" };

const TABS: { value: BookingsOverviewTab; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
];

function statusVariant(status: string) {
  if (status === "confirmed") return "default" as const;
  if (status === "blocked") return "secondary" as const;
  return "outline" as const;
}

/**
 * The one page a security login may reach. Two tabs — Today and This Week
 * (Sri Lanka time, Monday–Sunday) — both read-only, both sorted by time.
 *
 * Gated in `app/bookings/layout.tsx` (`requireBookingsAccess`), not here —
 * every page under this layout shares the same single gate.
 */
export default async function BookingsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const tab: BookingsOverviewTab = tabParam === "week" ? "week" : "today";

  const [{ rows, range }, legendCourts] = await Promise.all([
    getBookingsOverview(tab),
    getCourtLegend(),
  ]);

  const rangeLabel =
    tab === "today"
      ? formatDate(dateStringToDate(range.from))
      : `${formatDateOnly(dateStringToDate(range.from))} – ${formatDateOnly(
          dateStringToDate(range.to)
        )}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          Bookings
        </h1>
        <p className="text-sm text-muted-foreground">{rangeLabel}</p>
      </div>

      <nav aria-label="Range" className="flex items-center gap-1 border-b">
        {TABS.map(({ value, label }) => {
          const active = value === tab;
          return (
            <Link
              key={value}
              href={value === "today" ? "/bookings" : `/bookings?tab=${value}`}
              aria-current={active ? "page" : undefined}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <CourtLegend courts={legendCourts} />

      {rows.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed px-6 py-10">
          <span className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
            <CalendarDays className="size-5" />
          </span>
          <p className="font-heading text-lg font-bold tracking-tight">
            {tab === "today" ? "No bookings today" : "No bookings this week"}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {tab === "week" && <TableHead className="pl-5">Date</TableHead>}
                <TableHead className={tab === "today" ? "pl-5" : undefined}>
                  Court
                </TableHead>
                <TableHead>Time slot</TableHead>
                <TableHead>Booking reference</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="pr-5">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  {tab === "week" && (
                    <TableCell className="pl-5 whitespace-nowrap">
                      {formatDateOnly(row.bookingDate)}
                    </TableCell>
                  )}
                  <TableCell
                    className={
                      tab === "today" ? "pl-5 font-medium" : "font-medium"
                    }
                  >
                    <span className="flex items-center gap-2">
                      <CourtColorDot color={row.courtColor} />
                      {row.courtName}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.startTime && row.endTime
                      ? `${row.startTime} – ${row.endTime}`
                      : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.bookingReference ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[20ch] truncate">
                    {row.name}
                  </TableCell>
                  <TableCell>{row.contact}</TableCell>
                  <TableCell className="pr-5">
                    <Badge variant={statusVariant(row.status)}>
                      {row.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
