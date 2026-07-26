"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

/** Status filter chips. Plain links so the page stays server-rendered. */
export function BookingStatusFilter({
  statuses,
  active,
}: {
  statuses: readonly string[];
  active?: string;
}) {
  const options = [{ label: "All", value: undefined }, ...statuses.map((s) => ({ label: s, value: s }))];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((option) => {
        const isActive = active === option.value;

        return (
          <Link
            key={option.label}
            href={
              option.value
                ? `/admin/bookings?status=${option.value}`
                : "/admin/bookings"
            }
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium capitalize transition-colors",
              isActive
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
