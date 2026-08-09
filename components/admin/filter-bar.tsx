"use client";

import { useId, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { cn } from "@/lib/utils";

/**
 * The building blocks of an admin table's filter bar.
 *
 * One `<form method="GET">` holding every control, which means the whole bar
 * has a single, obvious contract: **submitting it replaces the URL's query
 * string**, and the server component above re-runs its query. Filters therefore
 * combine (AND) for free — they are all just fields of one form — and the page
 * needs no client-side filtering state at all.
 *
 * Three details make it behave:
 *
 *  1. **Empty fields are dropped** on submit, so the unfiltered view is a bare
 *     `/admin/bookings` rather than a URL of empty `&court=&status=` pairs.
 *  2. **`page` is not a field**, so changing any filter necessarily returns to
 *     page 1 — landing on "page 4 of 1 result" is the standard bug here.
 *  3. **`sort`/`dir` are hidden fields**, so filtering preserves the column an
 *     admin sorted by instead of silently resetting it.
 *
 * The form works with JavaScript off — it is a real GET form pointed at the
 * page — and the `onSubmit` handler is an upgrade, turning a full document load
 * into a client-side navigation.
 */

export function FilterForm({
  action,
  children,
}: {
  /** Path the form submits to, e.g. "/admin/bookings". */
  action: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function submit(form: HTMLFormElement) {
    const params = new URLSearchParams();

    for (const [key, value] of new FormData(form).entries()) {
      if (typeof value !== "string") continue;
      const trimmed = value.trim();
      if (trimmed) params.set(key, trimmed);
    }

    const query = params.toString();
    router.push(query ? `${action}?${query}` : action, { scroll: false });
  }

  return (
    <form
      // Remount when the URL changes. The controls are uncontrolled
      // (`defaultValue`/`defaultChecked`), which React sets once and never
      // touches again — so after a "Reset filters" click, or a back button, the
      // inputs would otherwise still show the previous selection while the
      // table below showed the new one.
      key={searchParams.toString()}
      method="GET"
      action={action}
      onSubmit={(event) => {
        event.preventDefault();
        submit(event.currentTarget);
      }}
      // Picking from a dropdown, a chip or a date field is a complete decision,
      // so apply it immediately. Typing in the search box is not — that one
      // waits for Enter or the Apply button, rather than firing a query per
      // keystroke.
      onChange={(event) => {
        const target = event.target;
        const isImmediate =
          target instanceof HTMLSelectElement ||
          (target instanceof HTMLInputElement &&
            (target.type === "radio" || target.type === "date"));

        if (isImmediate) submit(event.currentTarget);
      }}
      // Controls, not content: hidden when the page itself is printed. The
      // printed *report* states its filters in words instead — see
      // /admin/bookings/print.
      className="flex flex-col gap-5 rounded-xl border bg-card p-4 sm:p-5 print:hidden"
    >
      {children}
    </form>
  );
}

/** Heading row: the bar's title, and the Apply/Reset controls. */
export function FilterBarHeader({
  resetHref,
  isFiltered,
  summary,
  actions,
}: {
  /** Where "Reset filters" goes — the page with no query string. */
  resetHref: string;
  isFiltered: boolean;
  summary?: string;
  /**
   * Extra controls that act on the filtered set — the Bookings bar puts Print
   * here. They sit before Apply so the two buttons that change the view stay
   * together at the end of the row.
   */
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="size-4 text-muted-foreground" />
        <h2 className="font-heading text-sm font-bold tracking-tight">
          Filters
        </h2>
        {summary && (
          <span className="text-sm text-muted-foreground">{summary}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {actions}

        {/* No-JS fallback and the way to commit a typed search term. */}
        <Button type="submit" size="sm" variant="secondary">
          Apply
        </Button>

        {isFiltered ? (
          <LinkButton href={resetHref} size="sm" variant="ghost">
            <RotateCcw data-icon="inline-start" />
            Reset filters
          </LinkButton>
        ) : (
          // Held in the layout even when there is nothing to reset, so applying
          // a filter does not shift the Apply button sideways.
          <span aria-hidden className="h-7 w-[7.5rem]" />
        )}
      </div>
    </div>
  );
}

/** A labelled control in the filter grid. */
export function FilterField({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

/** The grid the labelled controls sit in. */
export function FilterGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
  );
}

/**
 * A native `<select>`, themed to match `components/ui/input.tsx`.
 *
 * Native rather than the Radix-based `Select`: this is a plain GET form, and a
 * native select is the only one that submits its value without a shadow hidden
 * input. Its popup is drawn by the OS, which is why `color-scheme` is set on
 * `:root` and `.dark` in globals.css — see DESIGN.md.
 */
export function FilterSelect({
  id,
  name,
  defaultValue,
  children,
}: {
  id?: string;
  name: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        className={cn(
          "h-8 w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent py-1 pr-8 pl-2.5 text-sm transition-colors outline-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          // Matches Input's own dark treatment: a transparent field disappears
          // against the dark card, so it gets the faint input fill instead.
          "dark:bg-input/30"
        )}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

/** A text input in the filter bar, matching the select's metrics. */
export function FilterInput({
  id,
  name,
  defaultValue,
  placeholder,
  type = "text",
}: {
  id?: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  type?: "text" | "search" | "date";
}) {
  return (
    <input
      id={id}
      name={name}
      type={type}
      defaultValue={defaultValue}
      placeholder={placeholder}
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none",
        "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        // See FilterSelect — same reason.
        "dark:bg-input/30"
      )}
    />
  );
}

export type ComboOption = { id: string; label: string };

/**
 * A searchable select: type to narrow, or open it and pick.
 *
 * Built on a native `<datalist>` rather than a scripted listbox. The list here
 * is people, it can be hundreds long, and the browser's own control already
 * does substring matching, keyboard navigation and touch behaviour correctly —
 * a hand-rolled combobox would be a lot of ARIA to arrive back where this
 * starts.
 *
 * It submits **two possible fields, never both**:
 *
 *   - `name` (hidden) carries the chosen person's **id**, the moment what has
 *     been typed exactly matches one of the options. An id is exact — two
 *     accounts can share a display name, and a filter that quietly matched both
 *     would be wrong.
 *   - `queryName` carries the **raw text** when it matches nobody in the list,
 *     and the server falls back to matching it against name and email. That is
 *     what makes the control keep working past the cap on how many people are
 *     listed: someone not in the list can still be searched for by typing them.
 *
 * The text field drops its `name` once a person is resolved, so a submit
 * carries the id alone and the URL never grows a redundant copy of the label.
 *
 * Like the other text inputs it waits for Enter or Apply rather than querying
 * per keystroke — see `FilterForm`.
 */
export function FilterCombobox({
  id,
  name,
  queryName,
  options,
  selectedId,
  query,
  placeholder,
}: {
  id?: string;
  /** Field name for the resolved id. */
  name: string;
  /** Field name for the unresolved free text. */
  queryName: string;
  options: readonly ComboOption[];
  selectedId?: string;
  query?: string;
  placeholder?: string;
}) {
  const listId = useId();

  // Whichever of the two the current URL carries: a chosen person shows their
  // label, an unresolved search shows what was typed.
  const [text, setText] = useState(
    () =>
      (selectedId
        ? options.find((option) => option.id === selectedId)?.label
        : query) ?? ""
  );

  const match = options.find((option) => option.label === text);

  return (
    <>
      <input type="hidden" name={name} value={match?.id ?? ""} />
      <input
        id={id}
        // Omitting `name` keeps a field out of the submission entirely, which
        // is how "id or text, never both" is enforced.
        name={match ? undefined : queryName}
        type="search"
        list={listId}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={cn(
          "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none",
          "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          // See FilterSelect — same reason.
          "dark:bg-input/30"
        )}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.id} value={option.label} />
        ))}
      </datalist>
    </>
  );
}

export type ChipOption = { value: string; label: string };

/**
 * A chip group — radio inputs wearing the existing filter-chip styling.
 *
 * Radios rather than the links the status chips used to be, because links carry
 * only their own value: clicking a status link would have thrown away whatever
 * was typed in the date fields next to it. As form fields they all submit
 * together, which is what makes the filters combine.
 *
 * The selected state carries a **border as well as** the accent wash. A /10
 * tint on its own vanishes against the near-black dark surface (DESIGN.md).
 */
export function FilterChips({
  name,
  label,
  options,
  value,
}: {
  name: string;
  label: string;
  options: readonly ChipOption[];
  value: string;
}) {
  return (
    <fieldset className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
      <legend className="sr-only">{label}</legend>
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>

      <div className="flex flex-wrap items-center gap-1.5">
        {options.map((option) => (
          <label key={option.value || "all"} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={value === option.value}
              className="peer sr-only"
            />
            <span
              className={cn(
                "block rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground capitalize transition-colors",
                "hover:text-foreground",
                "peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-foreground",
                "peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50"
              )}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Carries the current sort through a filter change.
 *
 * Without these the form would submit a query string with no `sort`/`dir`, and
 * every filter tweak would silently drop the admin back to the default order.
 */
export function SortPassthrough({
  sort,
  direction,
}: {
  sort: string;
  direction: string;
}) {
  return (
    <>
      <input type="hidden" name="sort" value={sort} />
      <input type="hidden" name="dir" value={direction} />
    </>
  );
}
