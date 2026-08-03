"use client";

import { useState, useTransition } from "react";
import { Loader2, Lock, MessageSquarePlus, Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/admin/star-rating";
import {
  getUserRatingsAction,
  rateUserAction,
  type SerializedUserRating,
} from "@/app/admin/users/actions";
import { cn } from "@/lib/utils";

/**
 * The conduct record for one user: history, average, and the form to add to it.
 *
 * ADMIN-ONLY. This component is only ever mounted inside /admin/users (itself
 * behind `requireAdmin()` in the layout and the page), and both actions it
 * calls re-check the role on the server. Nothing here is a security boundary —
 * it is the view onto one.
 *
 * The history is fetched when the dialog opens rather than shipped with the
 * table. Conduct comments about 500 people have no business sitting in the
 * HTML of a page that shows one line each.
 */
export function UserConductDialog({
  userId,
  label,
  average,
  count,
  canRate,
}: {
  userId: string;
  /** The user's name or email — what the dialog is titled with. */
  label: string;
  average: number | null;
  count: number;
  /** False for accounts this admin may not act on (and for your own row). */
  canRate: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<SerializedUserRating[] | null>(null);
  const [pending, startTransition] = useTransition();

  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const result = await getUserRatingsAction(userId);
    setLoading(false);

    if (result.ok) setHistory(result.data.ratings);
    else {
      setHistory([]);
      toast.error(result.error);
    }
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) void load();
  }

  function submit() {
    setFormError(null);

    // Mirrored on the server by `userRatingSchema` — this copy only saves a
    // round trip.
    if (stars < 1) {
      setFormError("Pick a star rating from 1 to 5.");
      return;
    }
    if (comment.trim().length < 5) {
      setFormError("Say why — a rating without a reason helps nobody later.");
      return;
    }

    startTransition(async () => {
      const result = await rateUserAction({ userId, rating: stars, comment });

      if (!result.ok) {
        setFormError(result.error);
        return;
      }

      toast.success(`Rating saved for ${label}.`);
      setStars(0);
      setComment("");
      await load();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2 px-2 font-normal"
          />
        }
      >
        {average === null ? (
          <span className="text-xs text-muted-foreground">Not rated</span>
        ) : (
          <>
            <StarRating value={average} />
            <span className="text-xs tabular-nums text-muted-foreground">
              {average.toFixed(1)} ({count})
            </span>
          </>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Conduct record — {label}</DialogTitle>
          <DialogDescription className="flex items-start gap-2">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Internal to the administration. This user cannot see their rating,
              their comments, or that any of this exists.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {/* --- Add a rating --- */}
          {canRate ? (
            <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">Add a rating</span>
                <StarPicker value={stars} onChange={setStars} />
              </div>

              <Textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={1000}
                placeholder="What happened? Whoever reads this in six months will only have these words."
                className="rounded-lg px-3 py-2 text-sm"
              />

              {formError && (
                <p role="alert" className="text-sm text-destructive">
                  {formError}
                </p>
              )}

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Saved against your name and today&rsquo;s date.
                </p>
                <Button size="sm" disabled={pending} onClick={submit}>
                  {pending ? <Loader2 className="animate-spin" /> : <MessageSquarePlus />}
                  {pending ? "Saving…" : "Save rating"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              You can read this record but not add to it — rating an
              administrator is restricted to super admins, and nobody rates
              their own account.
            </p>
          )}

          {/* --- History --- */}
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">
              History
              {history && history.length > 0 && (
                <span className="ml-2 font-normal text-muted-foreground">
                  {history.length} entr{history.length === 1 ? "y" : "ies"},
                  newest first
                </span>
              )}
            </h3>

            {loading && (
              <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading the record…
              </p>
            )}

            {!loading && history?.length === 0 && (
              <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                Nothing recorded yet. The first rating you add appears here.
              </p>
            )}

            {!loading && !!history?.length && (
              <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
                {history.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-col gap-1.5 rounded-xl border bg-card px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <StarRating value={entry.rating} />
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString("en-GB", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{entry.comment}</p>
                    <p className="text-xs text-muted-foreground">
                      {/* Null when that admin's account has since been removed —
                          the note survives, it just stops naming them. */}
                      {entry.adminName ?? entry.adminEmail ?? "a former administrator"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The 1–5 picker. Real buttons, so it is keyboard- and screen-reader-usable. */
function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          aria-pressed={value === n}
          onMouseEnter={() => setHover(n)}
          onFocus={() => setHover(n)}
          onBlur={() => setHover(0)}
          onClick={() => onChange(n)}
          className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Star
            className={cn(
              "size-5",
              n <= shown
                ? "fill-primary text-primary"
                : "text-muted-foreground/40"
            )}
          />
        </button>
      ))}
    </div>
  );
}
