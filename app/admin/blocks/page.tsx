import { CalendarOff, Home } from "lucide-react";

import { LinkButton } from "@/components/link-button";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { BlockPicker } from "@/components/admin/block-picker";
import {
  SlotBlockList,
  type BlockableSlot,
} from "@/components/admin/slot-block-list";
import { PaginationBar } from "@/components/admin/table-tools";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOccupyingSlots } from "@/lib/booking-service";
import { buildAdminHref, pageCountFor, parsePage } from "@/lib/admin-filters";
import {
  DAY_NAMES,
  dateStringToDate,
  dateToTimeString,
  dayOfWeekForDate,
  formatDate,
  todayString,
} from "@/lib/time";

export const metadata = { title: "Block slots — Admin" };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Slots per page.
 *
 * Ten, not the 25 the admin tables use: these rows are tall (a badge row and a
 * button each), and a court with a long opening day would otherwise be a
 * scroll to reach the evening hours.
 */
const BLOCKS_PAGE_SIZE = 10;

export default async function BlocksPage({
  searchParams,
}: {
  searchParams: Promise<{ courtId?: string; date?: string; page?: string }>;
}) {
  await requireAdmin("/admin/blocks");

  const params = await searchParams;

  const courts = await prisma.court.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  if (courts.length === 0) {
    return (
      <>
        <PageHeader
          title="Block slots"
          description="Take a court's slot off the market for a specific date — maintenance, a fixture, bad weather."
        />
        <EmptyState
          icon={<Home className="size-5" />}
          title="No courts to block"
          description="Create a court and give it a slot schedule first."
          action={
            <LinkButton
              href="/admin/courts"
              variant="outline"
              className="mt-1 h-10"
            >
              Go to courts
            </LinkButton>
          }
        />
      </>
    );
  }

  // Fall back to the first court and today when the URL says nothing valid.
  const courtId =
    courts.find((c) => c.id === params.courtId)?.id ?? courts[0].id;
  const date =
    params.date && DATE_RE.test(params.date) ? params.date : todayString();

  const bookingDate = dateStringToDate(date);
  const dayOfWeek = dayOfWeekForDate(bookingDate);

  const [slots, occupying] = await Promise.all([
    prisma.slotTemplate.findMany({
      where: { courtId, dayOfWeek },
      orderBy: { startTime: "asc" },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        price: true,
        isActive: true,
      },
    }),
    getOccupyingSlots(courtId, bookingDate),
  ]);

  // One entry per occupied hour. A multi-hour booking contributes several,
  // each pointing back at the same parent booking.
  const occupiedBySlot = new Map(occupying.map((o) => [o.slotId, o]));

  const rows: BlockableSlot[] = slots.map((slot) => {
    const occupied = occupiedBySlot.get(slot.id);

    return {
      slotId: slot.id,
      startTime: dateToTimeString(slot.startTime),
      endTime: dateToTimeString(slot.endTime),
      price: slot.price.toString(),
      isActive: slot.isActive,
      occupied: occupied
        ? {
            bookingId: occupied.bookingId,
            status: occupied.status as "pending" | "confirmed" | "blocked",
            who: occupied.status === "blocked" ? null : occupied.userEmail,
          }
        : undefined,
    };
  });

  // Page the day's slots. The picker's form carries only `courtId` and `date`,
  // so changing either drops `page` and lands back on the first page — which is
  // what you want, since page 2 of Tuesday means nothing on Wednesday.
  const pageCount = pageCountFor(rows.length, BLOCKS_PAGE_SIZE);
  const page = Math.min(parsePage(params.page), pageCount);
  const pageRows = rows.slice(
    (page - 1) * BLOCKS_PAGE_SIZE,
    page * BLOCKS_PAGE_SIZE
  );

  const view = { courtId, date };
  const pageHref = (n: number) =>
    buildAdminHref("/admin/blocks", view, { page: n > 1 ? n : undefined });

  return (
    <>
      <PageHeader
        title="Block slots"
        description="Take a court's slot off the market for a specific date — maintenance, a fixture, bad weather. Blocks are stored as bookings, so availability handles them automatically."
      />

      <div className="flex flex-col gap-8">
        <BlockPicker courts={courts} courtId={courtId} date={date} />

        <div className="flex flex-col gap-4">
          <h2 className="text-lg">
            {DAY_NAMES[dayOfWeek]} &middot;{" "}
            <span className="text-muted-foreground">
              {formatDate(bookingDate)}
            </span>
          </h2>

          {rows.length === 0 ? (
            <EmptyState
              icon={<CalendarOff className="size-5" />}
              title={`No slots on ${DAY_NAMES[dayOfWeek]}`}
              description="This court has no slot templates for this weekday, so there is nothing to block. Add slots on the court's page."
              action={
                <LinkButton
                  href={`/admin/courts/${courtId}`}
                  variant="outline"
                  className="mt-1 h-10"
                >
                  Edit this court
                </LinkButton>
              }
            />
          ) : (
            <>
              <SlotBlockList courtId={courtId} date={date} slots={pageRows} />

              {pageCount > 1 && (
                <PaginationBar
                  page={page}
                  pageCount={pageCount}
                  total={rows.length}
                  pageSize={BLOCKS_PAGE_SIZE}
                  noun="slots"
                  prevHref={page > 1 ? pageHref(page - 1) : null}
                  nextHref={page < pageCount ? pageHref(page + 1) : null}
                />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
