/**
 * Instant feedback for the header's "Courts" link.
 *
 * /courts is `force-dynamic` and reads every active court with its cheapest
 * slot, so the click had nothing to show until that returned. The grid below
 * mirrors the real card layout (image block, then two lines) so the arriving
 * page settles into the same shape.
 */
export default function CourtsLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading courts"
      className="mx-auto w-full max-w-6xl animate-pulse px-6 py-16 sm:px-8"
    >
      <div className="flex flex-col gap-3 pb-10">
        <div className="h-9 w-40 rounded-lg bg-muted" />
        <div className="h-4 w-80 max-w-full rounded bg-muted/70" />
      </div>

      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <li
            key={i}
            className="overflow-hidden rounded-xl border bg-card"
          >
            <div className="aspect-[4/3] w-full bg-muted" />
            <div className="flex flex-col gap-2 px-5 py-4">
              <div className="h-5 w-32 rounded bg-muted" />
              <div className="h-4 w-20 rounded bg-muted/70" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
