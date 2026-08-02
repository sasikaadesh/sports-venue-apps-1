/**
 * Shown the instant /account is clicked, until the server render arrives.
 *
 * The page is `force-dynamic` and its data is behind `getUser()` plus two
 * queries, so a click used to leave the previous page on screen with nothing
 * happening. A loading boundary also gives `<Link>` something to prefetch for a
 * dynamic route — without one there is nothing to prefetch at all.
 *
 * The shape deliberately matches the real page (heading, tab bar, two cards) so
 * the swap reads as content arriving, not as the layout jumping.
 */
export default function AccountLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading your account"
      className="mx-auto w-full max-w-4xl animate-pulse px-6 py-12 sm:px-8 sm:py-16"
    >
      <div className="flex flex-col gap-3">
        <div className="h-9 w-64 rounded-lg bg-muted" />
        <div className="h-4 w-48 rounded bg-muted/70" />
      </div>

      <div className="mt-10 flex w-fit items-center gap-1 rounded-xl border bg-muted/50 p-1">
        <div className="h-9 w-28 rounded-lg bg-muted" />
        <div className="h-9 w-36 rounded-lg bg-muted/60" />
      </div>

      <div className="mt-8 flex flex-col gap-3">
        <div className="h-24 rounded-xl border bg-card" />
        <div className="h-24 rounded-xl border bg-card" />
        <div className="h-24 rounded-xl border bg-card" />
      </div>
    </div>
  );
}
