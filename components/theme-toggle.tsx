"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Light / dark switcher for the site, auth and admin headers.
 *
 * A two-way segmented control rather than a cycling icon button, so the active
 * choice is always visible. Rendered as a radiogroup, so arrow keys work and
 * screen readers announce the current selection.
 *
 * Light is the default and there is no "system" option. Anything other than an
 * explicit "dark" — no stored value, or a "system" left in localStorage from
 * before that option was removed — renders light, so it marks Light active.
 * Until mount, next-themes cannot know the stored value, so we render the same
 * shell with nothing selected: same size, no layout shift, no hydration
 * mismatch.
 */

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
] as const;

/**
 * True only after hydration. `useSyncExternalStore` with a never-firing
 * subscription is the sanctioned way to ask this — the older
 * `useState(false)` + `useEffect(() => setMounted(true))` pair is a cascading
 * render, which the React compiler lint rejects.
 */
const NEVER_CHANGES = () => () => {};

function useHydrated() {
  return useSyncExternalStore(
    NEVER_CHANGES,
    () => true,
    () => false
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useHydrated();
  const current = theme === "dark" ? "dark" : "light";

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className={cn(
        // Square, like every other button in the app.
        "inline-flex items-center gap-0.5 border border-border bg-muted/50 p-0.5",
        className
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = mounted && current === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${label} theme`}
            title={`${label} theme`}
            onClick={() => setTheme(value)}
            className={cn(
              "grid size-7 place-items-center text-muted-foreground transition-colors outline-none",
              "hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
              active && "bg-background text-foreground shadow-sm"
            )}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
