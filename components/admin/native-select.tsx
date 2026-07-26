import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A native <select> themed to match the rest of the admin UI.
 *
 * Native rather than the Base UI popup: these are short, static lists inside
 * forms, and the native control keeps keyboard, mobile and form-reset
 * behaviour for free. Styled with the project tokens, so it does not read as
 * an unstyled default.
 */
export function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          "h-10 w-full appearance-none rounded-xl border border-input bg-transparent py-1 pr-9 pl-3 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
