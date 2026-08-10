"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatPrice, formatPriceCompact } from "@/lib/time";

/**
 * The two charts on the admin Overview.
 *
 * The only client components on that page: every number is computed on the
 * server (`lib/admin-dashboard.ts`) and handed down already aggregated, so what
 * ships to the browser is the drawing, not the data set.
 *
 * **Colour comes from the theme, never from Recharts.** Each series is a
 * `var(--chart-N)` token — the ramp defined in `app/globals.css`, which runs
 * from the electric-green accent through zinc rather than through a second
 * bright hue (docs/DESIGN.md: one accent, committed). CSS variables resolve at
 * paint time in SVG exactly as they do in HTML, which is what lets these charts
 * follow the light/dark toggle with no JavaScript and no `dark:` classes.
 */

/** Green first, then down the zinc ramp. Beyond five, slices fold into "Other". */
const SLICE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/** Shared axis/grid treatment — quiet lines, readable labels, in both themes. */
const AXIS_PROPS = {
  tick: { fill: "var(--muted-foreground)", fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const;

/**
 * The tooltip, themed by hand.
 *
 * Recharts' default is a white box with a grey border and would be unreadable
 * in dark mode. This one sits on `--popover`, which is a step lighter than the
 * card beneath it — elevation is lightness here, not shadow (DESIGN.md).
 */
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; dataKey?: string | number; value?: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-sm">
      {label && <p className="mb-1 font-medium">{label}</p>}
      <ul className="flex flex-col gap-0.5">
        {payload.map((entry) => (
          <li
            key={String(entry.dataKey ?? entry.name)}
            className="flex items-center gap-3 tabular-nums"
          >
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto font-medium">
              {entry.dataKey === "revenue"
                ? formatPrice(entry.value ?? 0)
                : (entry.value ?? 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A legend swatch and label, used by both charts. */
function LegendItem({ color, children }: { color: string; children: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        aria-hidden
        className="size-2.5 rounded-[3px]"
        style={{ backgroundColor: color }}
      />
      {children}
    </span>
  );
}

export type TrendDatum = {
  label: string;
  bookings: number;
  revenue: number;
};

/**
 * Six months of bookings (bars) against revenue (line).
 *
 * Two series on two axes, because they are measured in different things and the
 * question management asks is whether they move together — a month where
 * bookings held up but revenue fell is the one worth a meeting. Bookings take
 * the accent and the visual weight; revenue is a thin zinc line over the top,
 * so the chart still reads as one accent rather than two competing colours.
 */
export function BookingsTrendChart({ data }: { data: TrendDatum[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <LegendItem color="var(--chart-1)">Bookings</LegendItem>
        <LegendItem color="var(--chart-4)">Revenue</LegendItem>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: -8 }}
        >
          {/* Horizontal rules only: vertical ones add ink without helping a
              six-point series. */}
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          <XAxis dataKey="label" {...AXIS_PROPS} />
          <YAxis
            yAxisId="bookings"
            allowDecimals={false}
            width={40}
            {...AXIS_PROPS}
          />
          <YAxis
            yAxisId="revenue"
            orientation="right"
            width={64}
            tickFormatter={(value: number) => formatPriceCompact(value)}
            {...AXIS_PROPS}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          />
          <Bar
            yAxisId="bookings"
            dataKey="bookings"
            name="Bookings"
            fill="var(--chart-1)"
            radius={[6, 6, 0, 0]}
            maxBarSize={48}
          />
          <Line
            yAxisId="revenue"
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke="var(--chart-4)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--chart-4)", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export type MixDatum = { name: string; value: number };

/**
 * This month's bookings split by court — which courts carry the venue.
 *
 * A donut rather than a pie: the hole carries the total, so the chart answers
 * "how many, and how are they spread" in one glance. The legend is HTML beside
 * the SVG rather than Recharts' own, because it has to carry a count and a
 * share per court and stay readable at small sizes.
 */
export function CourtMixChart({ data }: { data: MixDatum[] }) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  const share = (value: number) =>
    total > 0 ? `${Math.round((value / total) * 100)}%` : "0%";

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative shrink-0">
        <ResponsiveContainer width={180} height={180}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={54}
              outerRadius={84}
              paddingAngle={2}
              // The card colour between slices, so adjacent zinc tones stay
              // separable without a stroke that would look like an outline.
              stroke="var(--card)"
              strokeWidth={2}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={SLICE_COLORS[index % SLICE_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-heading text-xl font-bold tabular-nums">
            {total}
          </span>
          <span className="text-xs text-muted-foreground">bookings</span>
        </div>
      </div>

      <ul className="flex min-w-0 flex-1 flex-col gap-2">
        {data.map((entry, index) => (
          <li key={entry.name} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{
                backgroundColor: SLICE_COLORS[index % SLICE_COLORS.length],
              }}
            />
            <span className="truncate">{entry.name}</span>
            <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
              {entry.value} · {share(entry.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
