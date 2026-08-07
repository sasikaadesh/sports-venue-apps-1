// ---------------------------------------------------------------------------
// Prettier configuration — the code formatting rules for this project.
//
// WHAT THIS DOES
//   Prettier is an automatic code formatter. It rewrites the *layout* of a file
//   (indentation, quotes, semicolons, line wrapping) without ever changing what
//   the code actually does. This file tells Prettier which style to use, so
//   every file in the repo looks the same no matter who (or what) wrote it.
//
// WHEN IT RUNS
//   1. Automatically — the Claude Code hook in `.claude/settings.json` runs
//      Prettier on every file Claude edits or writes.
//   2. Manually — `npx prettier --write .` formats the whole project,
//      `npx prettier --check .` reports files that are not formatted.
//   3. In your editor — VS Code / Cursor with the Prettier extension will pick
//      this file up automatically and format on save.
//
// HOW TO CHANGE IT
//   Edit a value below and re-run `npx prettier --write .`. Each setting was
//   picked by measuring it against the code that was already in this repo, so
//   Prettier agrees with the existing style rather than fighting it. Values
//   are written out explicitly, even where they match Prettier's own defaults,
//   so the whole style is visible at a glance.
//
//   Note: `.prettierignore` (next to this file) lists what Prettier must NOT
//   touch — generated code, build output, lockfiles.
//
// This file is tooling only. It has no effect on the running application.
// ---------------------------------------------------------------------------

/** @type {import("prettier").Config} */
const config = {
  // End every statement with a semicolon (matches the existing app/ and lib/ code).
  semi: true,
  // Use "double quotes" for strings, not 'single quotes'.
  singleQuote: false,
  // Indent with 2 spaces, never tabs.
  tabWidth: 2,
  useTabs: false,
  // Wrap lines that go beyond 80 characters.
  printWidth: 80,
  // Add a trailing comma after the last item in multi-line objects, arrays and
  // import lists, but NOT after the last function parameter. Prettier's default
  // ("all") would add those parameter commas too and rewrite ~20 extra existing
  // files for no benefit, so "es5" is the setting that matches this repo.
  trailingComma: "es5",
  // Spaces inside object braces: { a: 1 } rather than {a: 1}.
  bracketSpacing: true,
  // Always wrap a single arrow-function argument in parens: (x) => x.
  arrowParens: "always",
  // Keep whatever line endings a file already has (Windows CRLF or Unix LF).
  // This repo is developed on Windows and currently contains a mix of both;
  // forcing one style would rewrite every line of most files the first time
  // the formatter touches them, producing enormous, meaningless diffs.
  endOfLine: "auto",

  // ---- Tailwind class sorting -------------------------------------------
  // The official Tailwind Prettier plugin. It sorts the utility classes inside
  // className strings into Tailwind's own recommended order (layout → box →
  // typography → colors → states) and collapses stray whitespace between them.
  // It understands Tailwind specifically: it only rewrites places it knows hold
  // class lists, so ordinary strings (URLs, messages, SQL, PayHere fields) are
  // left byte-for-byte alone. Sorting is purely cosmetic — CSS specificity in
  // Tailwind comes from the stylesheet, not from class order.
  //
  // This plugin must stay LAST in the plugins array; it wraps whatever other
  // Prettier plugins run before it.
  plugins: ["prettier-plugin-tailwindcss"],
  // Tailwind v4 has no tailwind.config.js — the theme lives in the CSS entry
  // point, so point the plugin at it. Without this the plugin cannot see the
  // project's custom utilities/tokens and sorts them as unknown classes.
  tailwindStylesheet: "./app/globals.css",
  // Also sort class lists passed to these helpers, not just className="…".
  // `cn` is this repo's clsx + tailwind-merge helper in lib/utils.ts; `cva` and
  // `clsx` are used directly by the shadcn/ui components.
  tailwindFunctions: ["cn", "cva", "clsx"],
};

export default config;
