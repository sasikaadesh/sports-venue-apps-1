import Link from "next/link";

import { cn } from "@/lib/utils";
import type { UserRatingFilter, UserSort } from "@/lib/validations";

/**
 * Sort and filter the Users tab by conduct.
 *
 * Plain links carrying `?sort=` and `?rated=`, so the page stays entirely
 * server-rendered and a view an admin wants to come back to — "everyone at 2.5
 * stars or below, worst first" — is a URL they can bookmark or send to a
 * colleague. Both values are parsed and clamped server-side; anything else in
 * the query string falls back to the defaults.
 */

const SORTS: { value: UserSort; label: string }[] = [
  { value: "recent", label: "Newest" },
  { value: "name", label: "Name" },
  { value: "rating_low", label: "Lowest rated" },
  { value: "rating_high", label: "Highest rated" },
];

const FILTERS: { value: UserRatingFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "flagged", label: "Flagged" },
  { value: "rated", label: "Rated" },
  { value: "unrated", label: "Not rated" },
];

function href(sort: UserSort, filter: UserRatingFilter): string {
  const params = new URLSearchParams();
  if (sort !== "recent") params.set("sort", sort);
  if (filter !== "all") params.set("rated", filter);
  const query = params.toString();
  return query ? `/admin/users?${query}` : "/admin/users";
}

export function UserSortFilter({
  sort,
  filter,
}: {
  sort: UserSort;
  filter: UserRatingFilter;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <Group label="Show">
        {FILTERS.map((option) => (
          <Chip
            key={option.value}
            href={href(sort, option.value)}
            active={filter === option.value}
          >
            {option.label}
          </Chip>
        ))}
      </Group>

      <Group label="Sort by">
        {SORTS.map((option) => (
          <Chip
            key={option.value}
            href={href(option.value, filter)}
            active={sort === option.value}
          >
            {option.label}
          </Chip>
        ))}
      </Group>
    </div>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
        // The border carries the selected state as well as the wash: a /10
        // accent tint alone disappears against the near-black dark surface
        // (DESIGN.md).
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </Link>
  );
}
