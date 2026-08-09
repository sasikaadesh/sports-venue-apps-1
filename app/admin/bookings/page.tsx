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
  getBookingFilterOptions,
  hasActiveBookingFilters,
  listAdminBookings,
  type BookingFilters,
} from "@/lib/admin-bookings";
import {
  ADMIN_PAGE_SIZE,
  BOOKING_SORT_DEFAULT_DIRECTION,
  buildAdminHref,
  flipDirection,
  parseBookingSort,
  parseDateParam,
  parseIdParam,
  parsePage,
  parsePaymentFilter,
  parseSearchParam,
  parseSortDirection,
  type BookingSort,
} from "@/lib/admin-filters";
import { dateToTimeString, formatDate, formatPrice } from "@/lib/time";
import type { BookingStatus } from "@/lib/generated/prisma/enums";

export const metadata = { title: "Bookings — Admin" };

const PATH = "/admin/bookings";

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
  if (status === "cancelled" || status === "expired")
    return "destructive" as const;
  return "secondary" as const;
}

type BookingSearchParams = {
  status?: string;
  court?: string;
  user?: string;
  uq?: string;
  pay?: string;
  from?: string;
  to?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

/**
 * Every booking and admin block.
 *
 * Filtering, sorting and paging all happen in Postgres — see
 * `lib/admin-bookings.ts`. The page holds no list state of its own: the query
 * string is the state, it is parsed into a fixed vocabulary by
 * `lib/admin-filters.ts`, and the *parsed* values are what both the query and
 * every link on the page are built from.
 */
export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<BookingSearchParams>;
}) {
  await requireAdmin(PATH);

  const params = await searchParams;

  const filters: BookingFilters = {
    status: STATUSES.includes(params.status as BookingStatus)
      ? (params.status as BookingStatus)
      : undefined,
    courtId: parseIdParam(params.court),
    userId: parseIdParam(params.user),
    userQuery: parseSearchParam(params.uq),
    payment: parsePaymentFilter(params.pay),
    from: parseDateParam(params.from),
    to: parseDateParam(params.to),
  };

  const sort = parseBookingSort(params.sort);
  const direction = parseSortDirection(
    params.dir,
    BOOKING_SORT_DEFAULT_DIRECTION[sort]
  );
  const page = parsePage(params.page);

  const [options, { rows, total, pageCount }] = await Promise.all([
    getBookingFilterOptions(),
    listAdminBookings({ filters, sort, direction, page }),
  ]);

  // The canonical, sanitised view state. Every link below is built from this,
  // so junk someone hand-typed into the URL is dropped the moment they click
  // anything, and no link can carry a value the parsers would reject.
  const view = {
    status: filters.status,
    court: filters.courtId,
    user: filters.userId,
    // Only one of the two is ever set — see `FilterCombobox`.
    uq: filters.userId ? undefined : filters.userQuery,
    pay: filters.payment === "all" ? undefined : filters.payment,
    from: filters.from,
    to: filters.to,
    sort,
    dir: direction,
    page: page > 1 ? page : undefined,
  };

  /** Clicking the active column reverses it; any other column starts at its own default. */
  function sortHref(column: BookingSort): string {
    const next =
      column === sort
        ? flipDirection(direction)
        : BOOKING_SORT_DEFAULT_DIRECTION[column];

    // Re-sorting returns to page 1 — page 4 of the old order is meaningless in
    // the new one.
    return buildAdminHref(PATH, view, {
      sort: column,
      dir: next,
      page: undefined,
    });
  }

  const isFiltered = hasActiveBookingFilters(filters);

  return (
    <>
      <PageHeader
        title="Bookings"
        description="All bookings and admin blocks, newest first by default. Use the filters, or click a column heading to sort, to find a particular booking. Slot blocks appear here as rows with the status “blocked”."
      />

      <div className="flex flex-col gap-6">
        <BookingFilterBar
          statuses={STATUSES}
          options={options}
          filters={filters}
          sort={sort}
          direction={direction}
          resetHref={PATH}
          isFiltered={isFiltered}
        />

        {rows.length === 0 ? (
          // Three ways to be empty, and they want different advice: nothing
          // matched, nothing exists yet, or the page number in the URL is past
          // the end of a list that does have results.
          <EmptyState
            icon={<CalendarDays className="size-5" />}
            title={
              total > 0
                ? "That page is past the end of the list"
                : isFiltered
                  ? "No bookings match these filters"
                  : "No bookings yet"
            }
            description={
              total > 0
                ? `There ${total === 1 ? "is 1 booking" : `are ${total} bookings`} to show, but not on this page.`
                : isFiltered
                  ? "Nothing in the table fits every filter you have set. Widen the date range, or use “Reset filters” to start again."
                  : "Once the public booking flow is live, reservations will appear here. Admin slot blocks show up here as well."
            }
            action={
              total > 0 ? (
                <LinkButton
                  href={buildAdminHref(PATH, view, { page: undefined })}
                  size="sm"
                  variant="secondary"
                >
                  Back to the first page
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
                        column does not breathe as rows gain or lose actions. */}
                    <TableHead className="w-[4.5rem] pr-5 text-right">
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
                        <TableCell className="pr-5 text-right">
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
