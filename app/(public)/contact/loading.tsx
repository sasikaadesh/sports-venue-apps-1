/**
 * Instant feedback for the header's "Contact" link.
 *
 * The page awaits `getCurrentUser()` (to pre-fill the form), which is a call
 * out to Supabase Auth plus a profile read — enough that the click otherwise
 * sits there doing nothing.
 */
export default function ContactLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading contact page"
      className="mx-auto w-full max-w-6xl animate-pulse px-6 py-16 sm:px-8"
    >
      <div className="flex max-w-2xl flex-col gap-4">
        <div className="h-11 w-72 max-w-full rounded-lg bg-muted" />
        <div className="h-5 w-full rounded bg-muted/70" />
        <div className="h-5 w-2/3 rounded bg-muted/70" />
      </div>

      <div className="mt-14 grid gap-14 lg:grid-cols-[1.15fr_1fr] lg:gap-20">
        <div className="flex flex-col gap-4">
          <div className="h-11 rounded-xl border bg-card" />
          <div className="h-11 rounded-xl border bg-card" />
          <div className="h-32 rounded-xl border bg-card" />
          <div className="h-10 w-40 rounded-lg bg-muted" />
        </div>
        <div className="flex flex-col gap-4">
          <div className="h-24 rounded-xl border bg-card" />
          <div className="h-24 rounded-xl border bg-card" />
        </div>
      </div>
    </div>
  );
}
