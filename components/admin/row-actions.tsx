"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * The Actions cell shared by the admin tables: icon buttons, one per action.
 *
 * Icons rather than labelled buttons because an Actions column of words is
 * wider than the columns that carry the actual information, and it pushed both
 * tables into a horizontal scrollbar. Three things make the icons safe:
 *
 *   - **Every action opens a confirmation dialog.** Nothing fires on a single
 *     click, so a mis-aimed click in a dense table costs a dismissal, not a
 *     booking or an account.
 *   - **Every button carries an `aria-label` as well as a tooltip.** The
 *     tooltip is the mouse shortcut; the label is what a screen reader and a
 *     touch user (no hover) get, and it says the same words.
 *   - **The cell is a fixed grid.** Each action owns a column, and a row
 *     without that action renders an empty cell of the same size, so the icons
 *     line up down the table instead of shuffling row by row.
 *
 * None of this is a permission boundary. Which buttons a row gets is decided
 * again from the database inside every server action.
 */
export function RowActions({
  columns,
  children,
}: {
  /** How many action slots this table's rows have. */
  columns: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="ml-auto inline-grid items-center gap-1"
      style={{ gridTemplateColumns: `repeat(${columns}, 1.75rem)` }}
    >
      {children}
    </div>
  );
}

/** Holds a slot open on rows that do not offer that action. */
export function RowActionSpacer() {
  return <span aria-hidden className="size-7" />;
}

/**
 * A slot that explains itself instead of acting — for rows where nothing is
 * offered at all. A blank Actions cell reads as a rendering fault, so it says
 * why in a `title` and to a screen reader.
 */
export function RowActionNote({ children }: { children: string }) {
  return (
    <span
      className="grid size-7 place-items-center text-xs text-muted-foreground"
      title={children}
    >
      <span aria-hidden>—</span>
      <span className="sr-only">{children}</span>
    </span>
  );
}

/**
 * One icon button that opens a confirmation before it does anything.
 *
 * The confirm button closes the dialog as it fires: the action runs in a
 * transition and reports through a toast, and the row it acted on is
 * re-rendered by `revalidatePath`, so there is nothing left for the dialog to
 * show.
 */
export function ConfirmRowAction({
  icon,
  label,
  tone = "default",
  pending,
  title,
  description,
  confirmLabel,
  confirmIcon,
  cancelLabel = "Keep it as it is",
  onConfirm,
}: {
  icon: React.ReactNode;
  /** Tooltip text and `aria-label` — the same words for everyone. */
  label: string;
  tone?: "default" | "danger";
  pending: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  confirmIcon: React.ReactNode;
  cancelLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={label}
                  disabled={pending}
                  className={cn(
                    "text-muted-foreground",
                    tone === "danger"
                      ? "hover:bg-destructive/10 hover:text-destructive"
                      : "hover:text-foreground"
                  )}
                />
              }
            />
          }
        >
          {icon}
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {cancelLabel}
          </DialogClose>
          <DialogClose
            render={
              <Button
                variant={tone === "danger" ? "destructive" : "default"}
                disabled={pending}
                onClick={onConfirm}
              />
            }
          >
            {confirmIcon}
            {confirmLabel}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
