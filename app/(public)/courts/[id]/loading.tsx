/**
 * Instant feedback for every court card and every "Change" link back here.
 *
 * This is the most-clicked navigation on the site and it was the one route with
 * nothing to prefetch: a dynamic segment with no loading boundary gives `<Link>`
 * no shell to fetch ahead of time, so a click sat on the old page — looking
 * broken — until the availability query came back. The skeleton mirrors the real
 * two-column layout (gallery left, availability right) so the arriving page
 * settles into the same shape rather than jumping.
 */
export default function CourtDetailLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading court"
      className="mx-auto w-full max-w-6xl animate-pulse px-6 py-10 sm:px-8"
    >
      <div className="mb-8 h-4 w-24 rounded bg-muted/70" />

      <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
        {/* Left: identity, photos, description */}
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-56 max-w-full rounded-lg bg-muted" />
              <div className="h-6 w-20 rounded-md bg-muted/70" />
            </div>
            <div className="h-4 w-32 rounded bg-muted/70" />
          </div>

          <div className="aspect-[16/10] w-full rounded-lg bg-muted" />

          <div className="flex flex-col gap-2">
            <div className="h-5 w-40 rounded bg-muted" />
            <div className="h-4 w-full max-w-prose rounded bg-muted/70" />
            <div className="h-4 w-4/5 max-w-prose rounded bg-muted/70" />
          </div>
        </div>

        {/* Right: availability */}
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <div className="h-7 w-40 rounded-lg bg-muted" />
            <div className="h-4 w-48 rounded bg-muted/70" />
          </div>

          <div className="h-10 w-full rounded-lg bg-muted" />

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} className="h-12 rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
