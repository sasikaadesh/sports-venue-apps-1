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
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { BookingRowActions } from "@/components/admin/booking-row-actions";
import { BookingStatusFilter } from "@/components/admin/booking-status-filter";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dateToTimeString, formatDate, formatPrice } from "@/lib/time";
import type { BookingStatus } from "@/lib/generated/prisma/enums";

export const metadata = { title: "Bookings — Admin" };

const STATUSES: BookingStatus[] = [
  "pending",
  "confirmed",
  "cancelled",
  "blocked",
  "expired",
];

/** Colour-code status so the table scans quickly. */
function statusVariant(status: string) {
  if (status === "confirmed") return "default" as const;
  if (status === "cancelled" || status === "expired") return "destructive" as const;
  return "secondary" as const;
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin("/admin/bookings");

  const { status } = await searchParams;
  const activeStatus = STATUSES.includes(status as BookingStatus)
    ? (status as BookingStatus)
    : undefined;

  const bookings = await prisma.booking.findMany({
    where: activeStatus ? { status: activeStatus } : undefined,
    orderBy: [{ bookingDate: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      bookingDate: true,
      playerCount: true,
      durationHours: true,
      totalPrice: true,
      status: true,
      createdAt: true,
      court: { select: { name: true } },
      // The hours this booking holds, in clock order. A released booking
      // (cancelled/expired) has none — it gave its hours back.
      slots: {
        orderBy: { slot: { startTime: "asc" } },
        select: { id: true, slot: { select: { startTime: true, endTime: true } } },
      },
      user: { select: { email: true } },
      // Latest payment attempt is the one whose status matters.
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, amount: true },
      },
    },
  });

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Every booking and admin block, newest first. Blocks appear here too — they are bookings with status 'blocked'."
      />

      <div className="flex flex-col gap-6">
        <BookingStatusFilter statuses={STATUSES} active={activeStatus} />

        {bookings.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="size-5" />}
            title={activeStatus ? `No ${activeStatus} bookings` : "No bookings yet"}
            description={
              activeStatus
                ? "Nothing matches this filter right now."
                : "Once the public booking flow is live, reservations will appear here. Admin slot blocks show up here as well."
            }
          />
        ) : (
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Date</TableHead>
                  <TableHead>Court</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead className="text-right">Players</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="pr-5 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {bookings.map((b) => {
                  const payment = b.payments[0];
                  const first = b.slots[0];
                  const last = b.slots[b.slots.length - 1];

                  return (
                    <TableRow key={b.id}>
                      <TableCell className="pl-5 font-medium">
                        {formatDate(b.bookingDate)}
                      </TableCell>
                      <TableCell>{b.court.name}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {first && last ? (
                          <>
                            {dateToTimeString(first.slot.startTime)}–
                            {dateToTimeString(last.slot.endTime)}
                            {b.durationHours > 1 && (
                              <span className="ml-1.5 font-sans text-muted-foreground">
                                {b.durationHours}h
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">released</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[18ch] truncate text-muted-foreground">
                        {b.status === "blocked" ? "— admin block —" : (b.user?.email ?? "—")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {b.status === "blocked" ? "—" : b.playerCount}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(b.status)}>{b.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {payment ? (
                          <span className="flex items-center gap-2">
                            <Badge
                              variant={
                                payment.status === "success"
                                  ? "default"
                                  : payment.status === "failed" ||
                                      payment.status === "cancelled"
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {payment.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatPrice(payment.amount.toString())}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {/* No payment row yet, so show what is owed —
                                the summed price of the booked hours. */}
                            {b.status === "blocked"
                              ? "—"
                              : `${formatPrice(b.totalPrice.toString())} unpaid`}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        <BookingRowActions bookingId={b.id} status={b.status} />
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
