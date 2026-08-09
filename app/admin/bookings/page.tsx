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
import { BookingFilterBar } from "@/components/admin/booking-filter-bar";
import { BookingRowActions } from "@/components/admin/booking-row-actions";
import { PaginationBar, SortableHeader } from "@/components/admin/table-tools";
import { LinkButton } from "@/components/link-button";
import { requireAdmin } from "@/lib/auth";
import {
  BOOKING_STATUSES,
  getBookingFilterOptions,
  listAdminBookings,
  parseBookingView,
  type BookingSearchParams,
} from "@/lib/admin-bookings";
import {
  ADMIN_PAGE_SIZE,
  BOOKING_SORT_DEFAULT_DIRECTION,
  buildAdminHref,
  flipDirection,
  type BookingSort,
} from "@/lib/admin-filters";
import {
  dateToTimeString,
  formatDate,
  formatMonth,
  formatPrice,
  todayString,
} from "@/lib/time";

export const metadata = { title: "Bookings — Admin" };

const PATH = "/admin/bookings";
const PRINT_PATH = "/admin/bookings/print";

/**
 * The whole table, no date range at all.
 *
 * `dates=set` is the marker that says the empty range is deliberate — without
 * it this link would land back on the current month. See `parseBookingView`.
 */
const ALL_DATES_HREF = `${PATH}?dates=set`;

/** Colour-code status so the table scans quickly. */
function statusVariant(status: string) {
  if (status === "confirmed") return "default" as const;
  if (status === "cancelled" || status === "expired")
    return "destructive" as const;
  return "secondary" as const;
}

/**
 * Every booking and admin block.
 *
 * Filtering, sorting and paging all happen in Postgres — see
 * `lib/admin-bookings.ts`. The page holds no list state of its own: the query
 * string is the state, it is parsed into a fixed vocabulary by
 * `parseBookingView`, and the *parsed* values are what both the query and every
 * link on the page are built from — including the Print link, which is this
 * same view handed to `/admin/bookings/print`.
 *
 * With no date range in the URL the view opens on the **current month**. See
 * `parseBookingView` for why that default cannot trap you.
 */
export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<BookingSearchParams>;
}) {
  await requireAdmin(PATH);

  const params = await searchParams;
  const { filters, sort, direction, page, monthDefault, isFiltered, view } =
    parseBookingView(params);

  const [options, { rows, total, pageCount }] = await Promise.all([
    getBookingFilterOptions(),
    listAdminBookings({ filters, sort, direction, page }),
  ]);

  /** Clicking the active column reverses it; any other column starts at its own default. */
  function sortHref(column: BookingSort): string {
    const next =
      column === sort
        ? flipDirection(direction)
        : BOOKING_SORT_DEFAULT_DIRECTION[column];

    // Re-sorting returns to page 1 — page 4 of the old order is meaningless in
    // the new one.
    return buildAdminHref(PATH, view, { sort: column, dir: next });
  }

  // The report is this exact view, unpaged: same filters, same order.
  const printHref = buildAdminHref(PRINT_PATH, view);

  // A month with nothing in it is not the same as an empty table, and the way
  // out is different — widen the range rather than reset filters that are not
  // set.
  const emptyMonth = monthDefault && !isFiltered && total === 0;

  return (
    <>
      <PageHeader
        title="Bookings"
        // One line at desktop width — see PageHeader. The detail it used to
        // carry (blocks appear as rows, headings sort) is visible in the table
        // itself the moment you look at it.
        description="All bookings and admin blocks — filter and sort to find any booking."
      />

      <div className="flex flex-col gap-6">
        <BookingFilterBar
          statuses={BOOKING_STATUSES}
          options={options}
          filters={filters}
          sort={sort}
          direction={direction}
          resetHref={PATH}
          isFiltered={isFiltered}
          monthDefault={monthDefault}
          printHref={printHref}
          printable={total > 0}
        />

        {rows.length === 0 ? (
          // Four ways to be empty, and they want different advice: this month
          // happens to be quiet, nothing matched the filters, nothing exists
          // yet, or the page number in the URL is past the end of a list that
          // does have results.
          <EmptyState
            icon={<CalendarDays className="size-5" />}
            title={
              total > 0
                ? "That page is past the end of the list"
                : emptyMonth
                  ? `Nothing booked in ${formatMonth(todayString())}`
                  : isFiltered
                    ? "No bookings match these filters"
                    : "No bookings yet"
            }
            description={
              total > 0
                ? `There ${total === 1 ? "is 1 booking" : `are ${total} bookings`} to show, but not on this page.`
                : emptyMonth
                  ? "This page opens on the current month. Change the dates above, or show every booking on record."
                  : isFiltered
                    ? "Nothing in the table fits every filter you have set. Widen the date range, or use “Reset filters” to start again."
                    : "Once the public booking flow is live, reservations will appear here. Admin slot blocks show up here as well."
            }
            action={
              total > 0 ? (
                <LinkButton
                  href={buildAdminHref(PATH, view)}
                  size="sm"
                  variant="secondary"
                >
                  Back to the first page
                </LinkButton>
              ) : emptyMonth ? (
                <LinkButton href={ALL_DATES_HREF} size="sm" variant="secondary">
                  Show every date
                </LinkButton>
              ) : isFiltered ? (
                <LinkButton href={PATH} size="sm" variant="secondary">
                  Reset filters
                </LinkButton>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader
                      label="Date"
                      href={sortHref("date")}
                      direction={sort === "date" ? direction : null}
                      className="pl-5"
                    />
                    <SortableHeader
                      label="Court"
                      href={sortHref("court")}
                      direction={sort === "court" ? direction : null}
                    />
                    <TableHead>Time</TableHead>
                    <SortableHeader
                      label="Who"
                      href={sortHref("who")}
                      direction={sort === "who" ? direction : null}
                    />
                    <TableHead className="text-right">Players</TableHead>
                    <SortableHeader
                      label="Status"
                      href={sortHref("status")}
                      direction={sort === "status" ? direction : null}
                    />
                    <SortableHeader
                      label="Payment"
                      href={sortHref("amount")}
                      direction={sort === "amount" ? direction : null}
                    />
                    {/* Two icon slots plus the cell padding — fixed so the
                        column does not breathe as rows gain or lose actions.
                        Buttons mean nothing on paper, so the column goes. */}
                    <TableHead className="w-[4.5rem] pr-5 text-right print:hidden">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {rows.map((b) => {
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
                            <span className="text-muted-foreground">
                              released
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[18ch] truncate text-muted-foreground">
                          {b.status === "blocked"
                            ? "— admin block —"
                            : (b.user?.email ?? "—")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {b.status === "blocked" ? "—" : b.playerCount}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(b.status)}>
                            {b.status}
                          </Badge>
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
                        <TableCell className="pr-5 text-right print:hidden">
                          <BookingRowActions
                            bookingId={b.id}
                            status={b.status}
                            isPaid={b._count.payments > 0}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <PaginationBar
              page={page}
              pageCount={pageCount}
              total={total}
              pageSize={ADMIN_PAGE_SIZE}
              noun="bookings"
              prevHref={
                page > 1
                  ? // Page 1 is the bare URL, not `?page=1`.
                    buildAdminHref(PATH, view, {
                      page: page - 1 > 1 ? page - 1 : undefined,
                    })
                  : null
              }
              nextHref={
                page < pageCount
                  ? buildAdminHref(PATH, view, { page: page + 1 })
                  : null
              }
            />
          </>
        )}
      </div>
    </>
  );
}
