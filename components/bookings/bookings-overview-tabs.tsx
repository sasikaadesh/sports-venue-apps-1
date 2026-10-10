"use client";

import { useState, useTransition } from "react";
import { CalendarDays, Loader2, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CourtColorDot } from "@/components/court-color-dot";
import { CourtLegend, type LegendCourt } from "@/components/court-legend";
import { refreshBookingsOverviewAction } from "@/app/bookings/actions";
import type {
  BookingsOverview,
  BookingsOverviewTab,
} from "@/lib/security-bookings";
import { formatDate, formatDateOnly, dateStringToDate } from "@/lib/time";

const TABS: { value: BookingsOverviewTab; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "nextWeek", label: "Next week" },
];

function statusVariant(status: string) {
  if (status === "confirmed") return "default" as const;
  if (status === "blocked") return "secondary" as const;
  return "outline" as const;
}

function rangeLabel(
  tab: BookingsOverviewTab,
  range: { from: string; to: string }
) {
  return tab === "today"
    ? formatDate(dateStringToDate(range.from))
    : `${formatDateOnly(dateStringToDate(range.from))} – ${formatDateOnly(
        dateStringToDate(range.to)
      )}`;
}

const EMPTY_MESSAGE: Record<BookingsOverviewTab, string> = {
  today: "No bookings today",
  week: "No bookings this week",
  nextWeek: "No bookings next week",
};

/**
 * All three tabs' data is fetched together, once, by the server component
 * above and handed in here — switching tabs is then just a state flip with
 * no server round trip, which is what made clicking between them feel slow
 * before (every click re-ran `requireBookingsAccess` plus two queries).
 *
 * "Refresh" is the one button that does a genuine fetch, since bookings can
 * change while this page is left open; it only touches the active tab.
 */
export function BookingsOverviewTabs({
  initialData,
  legendCourts,
}: {
  initialData: Record<BookingsOverviewTab, BookingsOverview>;
  legendCourts: LegendCourt[];
}) {
  const [tab, setTab] = useState<BookingsOverviewTab>("today");
  const [data, setData] = useState(initialData);
  const [pending, startTransition] = useTransition();

  const { rows, range } = data[tab];

  function refresh() {
    startTransition(async () => {
      const fresh = await refreshBookingsOverviewAction(tab);
      setData((prev) => ({ ...prev, [tab]: fresh }));
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            Bookings
          </h1>
          <p className="text-sm text-muted-foreground">
            {rangeLabel(tab, range)}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={pending}
          onClick={refresh}
        >
          {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Refresh
        </Button>
      </div>

      <nav aria-label="Range" className="flex items-center gap-1 border-b">
        {TABS.map(({ value, label }) => {
          const active = value === tab;
          return (
            <button
              key={value}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => setTab(value)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
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
            {EMPTY_MESSAGE[tab]}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {tab !== "today" && (
                  <TableHead className="pl-5">Date</TableHead>
                )}
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
                  {tab !== "today" && (
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
