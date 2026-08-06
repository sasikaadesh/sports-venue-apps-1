---
name: clean-and-sporty-brand
description: The "Clean & Sporty" visual brand for this sports-court booking app — color tokens (single electric-green accent), fonts (Space Grotesk headings, Inter body), spacing and shape rules, how to theme shadcn/ui, dark mode, and the anti-generic rules. Use whenever building, restyling, reviewing or extending any UI: a new page, a new component, a shadcn component being added or customised, a layout change, adding colors or fonts, empty/loading/hover states, or any question about how something should look. Also use when checking that existing UI is on-brand.
---

<!--
  ===========================================================================
  PLAIN-ENGLISH EXPLANATION OF THIS FILE — Claude Code skill
  "clean-and-sporty-brand".

  (Note on placement: this explanation sits just below the `---` block rather
  than at the very top, because the `---` block is YAML "frontmatter" and has
  to be the first thing in the file or Claude Code cannot read the skill's
  configuration.)

  WHAT THIS IS
    A skill is a set of instructions Claude loads on demand, when the work at
    hand matches it. This one packages the project's visual brand — the exact
    colors, fonts, spacing, shapes and rules from `docs/DESIGN.md` — so that
    any UI Claude builds comes out looking like the rest of the app instead of
    looking like generic AI output.

  WHEN IT RUNS
    Automatically, whenever the work is UI work. Claude reads the
    `description:` line in the block above and loads this file when it matches
    what you asked for — building a page, adding or restyling a component,
    choosing colors, adjusting a layout, or reviewing how something looks.
    You can also load it deliberately by typing `/clean-and-sporty-brand`, or
    by saying "use the brand skill".

  HOW TO USE IT
    Usually you do nothing — just ask for the UI you want ("add a court
    detail page", "restyle the booking dialog") and the brand rules are
    applied for you. Load it by name when you want to check existing UI
    against the brand, or when you are about to do a lot of styling work and
    want the rules in context from the start.

  HOW TO EDIT IT
    `docs/DESIGN.md` remains the source of truth for the design direction.
    This file is the working checklist distilled from it. If the design
    changes, update `docs/DESIGN.md` first, then bring this file in line.

  This file is tooling only. It has no effect on the running application.
  ===========================================================================
-->

# Clean & Sporty

The direction: bright, energetic, confident — a modern athletic-brand feel.
Lots of white space, one bold accent, big bold headings, strong photography.
The site must look intentionally designed, not templated.

`docs/DESIGN.md` is the full source of truth. This is the working checklist.

## The one rule that matters most

**Never hard-code a color.** Every color in the app is a CSS custom property
defined in `app/globals.css`, once for light mode (`:root`) and once for dark
(`.dark`). Components reference the Tailwind token that maps to it —
`bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`,
`bg-primary`, `border-border` — and therefore theme themselves.

A `dark:` utility inside a component is the exception, not the rule, and each
one carries a comment explaining why it was unavoidable.

If a new color is genuinely needed, it is added to `app/globals.css` as a
token in **both** `:root` and `.dark`, and used through that token everywhere.

## Color

| Role                      | Token                  | Value                                                |
| ------------------------- | ---------------------- | ---------------------------------------------------- |
| Accent / primary action   | `--primary`            | electric green `#16DB65` = `oklch(0.78 0.214 149.4)` |
| Text on the accent        | `--primary-foreground` | ink — near-black, 9.2:1 on green, in both themes     |
| Ink (headings, body text) | `--foreground`         | `oklch(0.145 0 0)` ≈ `#0A0A0A`                       |
| Page background           | `--background`         | white in light, near-black zinc in dark              |
| Surfaces                  | `--card`, `--popover`  | step up in lightness from the background             |
| Secondary text            | `--muted-foreground`   | zinc — 5.4:1 light / 7.4:1 dark, both clear AA       |
| Lines                     | `--border`, `--input`  | zinc / low-opacity white in dark                     |
| Focus                     | `--ring`               | the primary green                                    |

**One accent, committed.** Electric green carries primary buttons, active
states and key highlights. Do not introduce a second competing bright color.
A warm orange (`#FF6A00`) exists as an optional secondary for rare emphasis —
use it sparingly, if at all.

**Never:** purple→blue gradients. Rainbow palettes. Low-contrast gray-on-gray.

## Dark mode

Not a different design — the same one after dark. Same single green accent,
near-black zinc surfaces, light zinc text.

Three rules that make it hold together:

1. **Elevation is lightness, not shadow.** background → card → popover step up
   (0.145 → 0.196 → 0.216). Shadows are nearly invisible on dark surfaces, so
   a dropdown or dialog that does not get lighter dissolves into the page.
2. **`color-scheme` is set on both `:root` and `.dark`.** Native controls —
   `<select>` popups, the `<input type="date">` calendar, scrollbars — are
   painted by the OS and ignore CSS tokens entirely. Without this the date
   picker stays light-on-light in dark mode.
3. **Color over photography is fixed, never tokenised.** The home hero, the
   auth split-screen and the dialog scrim use literal `black`/`white`.
   `bg-foreground/45` + `text-background` looks token-correct but inverts in
   dark mode — the scrim turns white and washes the photo out. Text on an
   image is always light over a dark veil, in both themes.

**Never in dark mode:** pure `#000` backgrounds (near-black zinc has depth,
true black flattens). Tinting a photograph with a themed scrim. A `/5`–`/10`
accent wash as the only marker of a selected state — it vanishes against
near-black, so pair it with a border or ring.

Every new screen must be checked in **both** themes, and switch cleanly both
ways. The toggle is a three-way segmented control (light / dark / system),
`components/theme-toggle.tsx`, driven by `next-themes`.

## Typography

- **Headings:** Space Grotesk, via the `font-heading` utility. Large, heavy
  weight, tight tracking (`tracking-tight`). Headlines should feel confident
  and big. `app/globals.css` already applies this to `h1`–`h6`.
- **Body:** Inter, via `font-sans` — applied on `body`, so it is the default.
- **Mono:** Geist Mono, via `font-mono`, for code and reference numbers only.
- Keep a real type scale with clear hierarchy. Headings and body must not blur
  together. Do not add a fourth typeface.

## Layout, spacing and shape

- **Generous, consistent spacing.** Let sections breathe. Stay on Tailwind's
  scale; prefer the established page rhythm (`px-6 sm:px-8`, `py-4`, section
  gaps of `gap-6`/`gap-8`) over one-off values. No arbitrary `p-[13px]`.
- **Page width:** content sits in `mx-auto w-full max-w-6xl`.
- **Low, simple hero** — a clean band, not a full-screen takeover.
- **Cards:** `rounded-xl` (the radius scale is driven by `--radius: 0.75rem`),
  subtle borders, restrained shadows. Not pill-shaped everything, not flat
  gray boxes.
- **Left-align most content.** Avoid centering everything on the page.
- Court thumbnails in a tidy grid, consistent aspect ratios.

## Imagery

Real, energetic sports photography — Unsplash placeholders for now
(`images.unsplash.com`), swapped for the client's own court photos later
through the admin panel.

Always the Next.js `<Image>` component, never a raw `<img>`. Give it explicit
sizes so layout does not shift.

## Icons and detail

- **lucide-react** icons only. **No emoji as icons — ever.**
- Subtle hover states: a slight lift or scale on cards and buttons. Motion is
  smooth and minimal; no gratuitous animation.
- Empty states and loading states are designed, not omitted. They are the
  clearest signal that a product was cared about.

## shadcn/ui

Use it as the component base, but **theme it with the tokens above**. Shipping
default shadcn styling is not acceptable — the un-themed look has itself become
a recognisable "generated" tell.

When adding a component: install it, then check its variants against the tokens
(radius, primary color, border, focus ring) and against both themes before
using it. Components live in `components/ui/`.

## Before calling any UI work done

- [ ] Distinctive heading font (`font-heading`), not the system default
- [ ] One committed accent — no second bright color, no default gradient
- [ ] Real whitespace and a clear hierarchy
- [ ] lucide icons, no emoji
- [ ] Themed shadcn, not defaults
- [ ] Left-aligned, varied layout — not everything centered
- [ ] Hover, empty and loading states considered
- [ ] No hard-coded colors; tokens only (any `dark:` utility justified in a
      comment)
- [ ] `next/image`, never `<img>`
- [ ] Renders correctly in **both** themes and switches cleanly both ways
