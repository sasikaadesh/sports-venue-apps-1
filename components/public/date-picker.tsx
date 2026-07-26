"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addDays } from "@/lib/time";

/**
 * Date picker for the availability view.
 *
 * Selection lives in the URL, so the page stays server-rendered and a chosen
 * date is shareable and survives a refresh.
 */
export function AvailabilityDatePicker({
  date,
  today,
  maxDate,
}: {
  date: string;
  today: string;
  maxDate: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function go(next: string) {
    if (next < today || next > maxDate) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", next);
    router.push(`?${params.toString()}`, { scroll: false });
  }

  const prev = addDays(date, -1);
  const next = addDays(date, 1);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="size-10 shrink-0"
        aria-label="Previous day"
        disabled={prev < today}
        onClick={() => go(prev)}
      >
        <ChevronLeft />
      </Button>

      <Input
        type="date"
        value={date}
        min={today}
        max={maxDate}
        onChange={(e) => go(e.target.value)}
        aria-label="Booking date"
        className="h-10 w-auto rounded-xl"
      />

      <Button
        variant="outline"
        size="icon"
        className="size-10 shrink-0"
        aria-label="Next day"
        disabled={next > maxDate}
        onClick={() => go(next)}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
