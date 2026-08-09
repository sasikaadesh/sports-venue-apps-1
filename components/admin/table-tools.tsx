import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
} from "lucide-react";

import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SortDirection } from "@/lib/admin-filters";

/**
 * Sorting and paging chrome shared by the admin tables.
 *
 * Both are **server components** made of plain `<Link>`s. Sorting a table is a
 * different database query, not a client-side reshuffle of rows already
 * downloaded, so there is nothing here for JavaScript to do — and a sorted,
 * paged view stays a URL an admin can bookmark or send on.
 */

/**
 * A clickable column heading.
 *
 * The indicator is always present, not hover-only: a column with no arrow is
 * the only way to tell "this table is not sorted by me" from "this column
 * cannot sort", and hiding the affordance until hover leaves that unanswerable
 * on a touch screen. Inactive columns show a muted double chevron, which is the
 * standard "sortable" glyph, and the arrow they *would* apply on click is
 * announced through `aria-sort` for a screen reader.
 */
export function SortableHeader({
  label,
  href,
  direction,
  align = "left",
  className,
}: {
  label: string;
  href: string;
  /** The direction this column is currently sorted by, or null when inactive. */
  direction: SortDirection | null;
  align?: "left" | "right";
  className?: string;
}) {
  const Icon =
    direction === "asc"
      ? ArrowUp
      : direction === "desc"
        ? ArrowDown
        : ChevronsUpDown;

  return (
    <TableHead
      aria-sort={
        direction === "asc"
          ? "ascending"
          : direction === "desc"
            ? "descending"
            : "none"
      }
      className={cn(align === "right" && "text-right", className)}
    >
      <Link
        href={href}
        scroll={false}
        className={cn(
          "-mx-1.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 font-medium transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
          align === "right" && "flex-row-reverse",
          direction ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        <Icon
          aria-hidden
          className={cn("size-3.5", direction ? "text-primary" : "opacity-50")}
        />
        <span className="sr-only">
          {direction === "asc"
            ? " — sorted ascending, click to reverse"
            : direction === "desc"
              ? " — sorted descending, click to reverse"
              : " — click to sort"}
        </span>
      </Link>
    </TableHead>
  );
}

/**
 * Page N of M, with the row range spelled out.
 *
 * `total` is a `COUNT` over the same `where` as the page query, so the numbers
 * describe the *filtered* set — "26–50 of 61 bookings" after a filter means 61
 * matched, not 61 exist.
 */
export function PaginationBar({
  page,
  pageCount,
  total,
  pageSize,
  prevHref,
  nextHref,
  noun,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  prevHref: string | null;
  nextHref: string | null;
  noun: string;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    // Paging is a screen concept — on paper the sheets are the pages.
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">
          {from}–{to}
        </span>{" "}
        of <span className="tabular-nums">{total}</span> {noun}
      </p>

      <div className="flex items-center gap-2">
        <span className="mr-1 text-sm text-muted-foreground tabular-nums">
          Page {page} of {pageCount}
        </span>
        <PageLink href={prevHref} label="Previous page">
          <ChevronLeft className="size-4" />
        </PageLink>
        <PageLink href={nextHref} label="Next page">
          <ChevronRight className="size-4" />
        </PageLink>
      </div>
    </div>
  );
}

/**
 * One pager arrow. A `null` href is the end of the list, rendered as a real
 * disabled control rather than a link that goes nowhere — `aria-disabled` on an
 * `<a>` still lets it be clicked, so at the ends this is a `<span>`.
 */
function PageLink({
  href,
  label,
  children,
}: {
  href: string | null;
  label: string;
  children: React.ReactNode;
}) {
  const shape =
    "grid size-8 place-items-center rounded-lg border transition-colors";

  if (!href) {
    return (
      <span
        aria-hidden
        className={cn(shape, "border-border/60 text-muted-foreground/40")}
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      scroll={false}
      aria-label={label}
      className={cn(
        shape,
        "border-border text-muted-foreground outline-none hover:border-primary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      )}
    >
      {children}
    </Link>
  );
}
