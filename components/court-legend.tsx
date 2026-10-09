import { CourtColorDot } from "@/components/court-color-dot";

export type LegendCourt = { id: string; name: string; color: string };

/**
 * The key mapping each dot to a court name — every page that shows
 * `CourtColorDot` carries one of these, so the colour is never the only
 * place that information lives.
 */
export function CourtLegend({ courts }: { courts: LegendCourt[] }) {
  if (courts.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border bg-card px-4 py-3">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Courts
      </span>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {courts.map((court) => (
          <li key={court.id} className="flex items-center gap-1.5 text-sm">
            <CourtColorDot color={court.color} />
            {court.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
