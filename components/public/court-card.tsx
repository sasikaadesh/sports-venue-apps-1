import Image from "next/image";
import Link from "next/link";
import { ImageOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
      className="group flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      {/* Consistent 4:3 across the grid, per DESIGN.md. */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
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

      <div className="flex flex-1 flex-col gap-2 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-heading text-lg leading-tight font-bold tracking-tight">
            {court.name}
          </h3>
          <Badge variant="secondary" className="mt-0.5 shrink-0">
            {court.typeName}
          </Badge>
        </div>

        <span className="text-sm text-muted-foreground">
          {court.fromPrice
            ? `From ${formatPrice(court.fromPrice)} / hour`
            : "Schedule coming soon"}
        </span>
      </div>
    </Link>
  );
}
