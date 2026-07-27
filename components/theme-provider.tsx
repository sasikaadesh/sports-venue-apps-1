"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Thin client wrapper around next-themes so the root layout can stay a server
 * component.
 *
 * The provider writes `class="dark"` onto <html> (matching the
 * `@custom-variant dark` rule in globals.css) and persists the choice in
 * localStorage, so a reload keeps the theme. Its inline script runs before
 * paint, which is what stops a light flash on a dark-themed reload — and is why
 * <html> needs `suppressHydrationWarning`: the script edits the class attribute
 * the server just rendered.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
