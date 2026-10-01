import Image from "next/image";
import Link from "next/link";
import { ImageOff } from "lucide-react";

import { formatPrice } from "@/lib/time";

export type PublicCourt = {
  id: string;
  name: string;
  typeName: string;
  image: string | null;
  /** Cheapest slot price across the week, or null when no slots exist yet. */
  fromPrice: string | null;
};

export function CourtCard({
  court,
  priority = false,
}: {
  court: PublicCourt;
  priority?: boolean;
}) {
  return (
    <Link
      href={`/courts/${court.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-lg border bg-card transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      {/* One ratio across the grid, per DESIGN.md — 3:2, a little shorter than
          4:3 so a full grid stays compact. object-cover crops, never stretches. */}
      <div className="relative aspect-[3/2] overflow-hidden bg-muted">
        {court.image ? (
          <Image
            src={court.image}
            alt={court.name}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            priority={priority}
          />
        ) : (
          <span className="grid size-full place-items-center text-muted-foreground">
            <ImageOff className="size-6" />
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 px-5 py-3.5">
        <h3 className="font-heading text-lg leading-tight font-bold tracking-tight">
          {court.name}
        </h3>

        <span className="text-sm text-muted-foreground">
          {court.fromPrice
            ? `From ${formatPrice(court.fromPrice)} / hour`
            : "Schedule coming soon"}
        </span>
      </div>
    </Link>
  );
}
