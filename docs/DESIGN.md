# DESIGN — Clean & Sporty

Direction: bright, energetic, confident. Modern athletic-brand feel. Lots of white space, one bold accent, big bold headings, strong photography. The site should look intentionally designed, not templated.

## Color

- **Accent (primary):** electric green — start with `#16DB65` (adjust to taste). Used for primary buttons, active states, key highlights. **One** accent — don't add a second competing bright color.
- **Ink (text/dark):** near-black `#0A0A0A` for headings and body text.
- **Neutrals:** white `#FFFFFF` backgrounds; zinc grays (`#F4F4F5`, `#71717A`) for surfaces, borders, secondary text.
- **Optional secondary accent** for rare emphasis only (e.g. a warm orange `#FF6A00`) — use sparingly, if at all.

**Never:** purple→blue gradients, rainbow palettes, low-contrast gray-on-gray.

### Dark mode

Same direction, inverted: near-black zinc surfaces, light zinc text, the **same single green accent**. Not a different design — the same one after dark.

Both themes live entirely in `app/globals.css` as CSS custom properties (`:root` and `.dark`). Components reference tokens (`bg-card`, `text-muted-foreground`, …) and therefore theme themselves; a `dark:` utility in a component is the exception, not the rule, and each one carries a comment saying why.

| Token | Light | Dark | Notes |
| --- | --- | --- | --- |
| `--background` | `oklch(1 0 0)` white | `oklch(0.145 0.004 285.8)` near-black | |
| `--foreground` | `oklch(0.145 0 0)` ink | `oklch(0.98 0.001 286)` | |
| `--card` | white | `oklch(0.196 0.004 285.8)` | one step above background |
| `--popover` | white | `oklch(0.216 0.005 285.8)` | one step above card |
| `--primary` | `oklch(0.78 0.214 149.4)` `#16DB65` | `oklch(0.8 0.2 149.4)` | brighter in dark — the same hue reads duller on black |
| `--primary-foreground` | ink | ink | near-black on green in both — 9.2:1 |
| `--muted` | `oklch(0.967 …)` | `oklch(0.255 0.006 285.8)` | |
| `--muted-foreground` | `oklch(0.53 0.016 285.938)` | `oklch(0.72 0.012 286)` | 5.4:1 / 7.4:1 — both clear AA |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.7 0.19 22.2)` | lighter red for a dark field |
| `--border` | `oklch(0.92 0.004 286.32)` | `oklch(1 0 0 / 12%)` | |
| `--input` | same as border | `oklch(1 0 0 / 18%)` | |
| `--ring` | primary | primary | |

Three rules that make it hold together:

1. **Elevation is lightness, not shadow.** background → card → popover step up (0.145 → 0.196 → 0.216). Shadows are nearly invisible on dark surfaces, so a dropdown or dialog that doesn't get lighter dissolves into the page.
2. **`color-scheme` is set on both `:root` and `.dark`.** Native controls — `<select>` popups, the `<input type="date">` calendar, scrollbars — are painted by the OS and ignore CSS tokens entirely. Without this the date picker stays light-on-light in dark mode.
3. **Color over photography is fixed, never tokenised.** The home hero, the auth split-screen and the dialog scrim use literal `black`/`white`. `bg-foreground/45` + `text-background` looks token-correct but inverts in dark mode — the scrim turns white and washes the photo out. Text on an image is always light over a dark veil, in both themes.

**Never in dark mode:** pure `#000` backgrounds (near-black zinc has depth, true black flattens), tinting a photograph with a themed scrim, or a `/5`–`/10` accent wash as the only marker of a selected state — it vanishes against near-black, so pair it with a border or ring.

### The toggle

Light / dark / **system**, persisted, in the header — `components/theme-toggle.tsx`, driven by `next-themes` (`attribute="class"`). A three-way segmented control, not a cycling icon button: "system" is a real choice and one button cannot show which of the three is active. It appears in the site header, the admin header and the auth layout — the last renders outside the site header and would otherwise be a dead end. The account page carries no toggle of its own: it renders inside the site header (`app/account/layout.tsx`), which already has one.

## Typography

- **Headings:** a bold geometric/grotesque sans — **Space Grotesk** or **Sora** (both free via `next/font/google`). Large, tight tracking, heavy weight. Headlines should feel confident and big.
- **Body:** **Inter** (via `next/font/google`), comfortable size and line-height.
- Establish a real type scale with clear hierarchy — don't let headings and body blur together.

## Layout & shape

- Generous, consistent spacing (a clear spacing scale). Let sections breathe.
- **Low, simple hero** — a clean band, not a full-screen takeover. Booking dropdown lives here.
- Court **thumbnails** in a tidy grid; consistent aspect-ratio images.
- Cards: medium radius (`rounded-xl`), subtle borders/shadows — not pill-shaped everything, not flat gray boxes.
- Left-align most content; avoid centering everything on the page.

## Imagery

- Real, energetic sports photography. **Unsplash placeholders for now** (`images.unsplash.com`), swapped for the client's real court photos later via the admin panel.
- Always via Next.js `<Image>` (sizing, lazy-load, egress-friendly).

## Icons & details

- **lucide-react** icons (ships with shadcn/ui). **No emoji as icons.**
- Subtle hover states (slight lift/scale on cards and buttons), smooth but minimal motion — no gratuitous animation.
- Considered empty states and loading states — they signal care.

## shadcn/ui

Use it as the component base, but **theme it with the tokens above** (colors, radius, fonts). Do not ship default shadcn styling — the un-themed look is itself becoming a recognizable "generated" tell.

## Quick anti-generic checklist

- [ ] Distinctive heading font, not system default
- [ ] One committed accent, no default gradient
- [ ] Real whitespace and hierarchy
- [ ] lucide icons, no emoji
- [ ] Themed shadcn, not defaults
- [ ] Left-aligned, varied layout (not everything centered)
- [ ] Hover/empty/loading states considered
- [ ] Renders correctly in **both** themes, and switches cleanly both ways
