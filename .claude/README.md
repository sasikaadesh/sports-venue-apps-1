<!--
  ===========================================================================
  PLAIN-ENGLISH EXPLANATION OF THIS FILE.

  This is the guide to the `.claude/` folder — the Claude Code tooling for this
  project. It exists mainly because `.claude/settings.json` is strict JSON and
  strict JSON cannot contain comments, so the explanation of that file has to
  live somewhere else. That somewhere is here.

  Nothing in `.claude/` is application code. None of it is imported, bundled or
  deployed. Deleting the whole folder would change how Claude Code behaves in
  this repo and would change nothing about the running app.

  Read this file when you want to know what the tooling does or how to switch
  a piece of it off.
  ===========================================================================
-->

# `.claude/` — Claude Code tooling for this project

Three features are configured here. None of them touch application behaviour.

| What                  | File                                     | Runs                                         |
| --------------------- | ---------------------------------------- | -------------------------------------------- |
| Prettier auto-format  | `settings.json` + `hooks/`               | automatically, after every file Claude edits |
| `code-reviewer` agent | `agents/code-reviewer.md`                | only when you ask for a review               |
| Brand / theme skill   | `skills/clean-and-sporty-brand/SKILL.md` | automatically, whenever UI work is happening |

---

## 1. `settings.json` — the auto-format hook

**This is the explanation of `settings.json`.** That file is strict JSON, so it
cannot carry its own comment header; this section is its comment header.

### What it says

```jsonc
{
  "hooks": {
    // "PostToolUse" = run this AFTER a tool call has succeeded.
    "PostToolUse": [
      {
        // Only for tools that change files. Reading, searching and running
        // commands do not trigger it.
        "matcher": "Write|Edit|MultiEdit|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            // Runs our small Node script, which formats the edited file.
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/format-with-prettier.mjs\"",
            "shell": "bash",
            // Give up after 30 seconds rather than holding up the session.
            "timeout": 30,
            // Text shown in the spinner while it runs.
            "statusMessage": "Formatting with Prettier",
          },
        ],
      },
    ],
  },
}
```

`$CLAUDE_PROJECT_DIR` is set by Claude Code to the root of this repository, so
the path works regardless of where the session was started from.

### What actually happens

1. Claude writes or edits a file.
2. Claude Code pipes a small JSON description of that edit into
   `.claude/hooks/format-with-prettier.mjs`.
3. That script pulls the file path out of the JSON, checks the file is a type
   Prettier understands and is not listed in `.prettierignore`, formats it, and
   saves it if anything changed.
4. Anything unexpected — an unknown file type, a missing file, a syntax error —
   is ignored silently. The hook can never fail or block an edit.

The script itself is heavily commented; read
`.claude/hooks/format-with-prettier.mjs` for the details.

### Using Prettier by hand

```bash
npm run format         # format the whole project
npm run format:check   # list files that are not formatted, change nothing
```

Configuration lives in `prettier.config.mjs`; exclusions in `.prettierignore`.
Both are at the project root and both are commented.

### Tailwind class sorting

`prettier.config.mjs` loads `prettier-plugin-tailwindcss`, the official Tailwind
plugin. It sorts the utility classes inside `className` strings — and inside
`cn()`, `cva()` and `clsx()` calls — into Tailwind's recommended order and
collapses stray whitespace between them. It only rewrites places it knows hold
class lists, so ordinary strings (URLs, messages, SQL) are never touched, and
class order has no effect on the rendered CSS. Because this project is on
Tailwind v4 (no `tailwind.config.js`), the config points the plugin at the CSS
entry point via `tailwindStylesheet: "./app/globals.css"`.

### Turning it off

Open `/hooks` in Claude Code, or delete the `"PostToolUse"` block from
`settings.json`. Prettier itself stays available either way.

---

## 2. `agents/code-reviewer.md` — the review sub-agent

A read-only reviewer with its own context window. It reads the changed code and
reports problems by severity — payment security first (the PayHere secret
staying server-side, `md5sig` verification, server-side role checks), then
booking correctness (atomicity, no double-booking, price integrity), then
general quality.

It is given only read tools, so it cannot modify anything. It proposes fixes;
you decide.

Trigger it by asking: _"use the code-reviewer agent on my changes"_, or just
_"review this before I commit"_.

---

## 3. `skills/clean-and-sporty-brand/SKILL.md` — the brand skill

The project's visual identity, distilled from `docs/DESIGN.md`: the color
tokens (one electric-green accent), Space Grotesk headings with Inter body, the
spacing and shape rules, how to theme shadcn/ui, dark-mode rules, and the
anti-generic checklist.

Claude loads it by itself whenever UI work is happening, so new components come
out on-brand without being reminded. You can also load it deliberately with
`/clean-and-sporty-brand`.

`docs/DESIGN.md` stays the source of truth — if the design changes, update that
first, then bring the skill in line.

---

## A note on file layout

`agents/*.md` and `skills/*/SKILL.md` begin with a `---` block ("YAML
frontmatter") holding the name and description. **That block must be the very
first thing in the file** — Claude Code cannot read the configuration
otherwise. The plain-English explanation in those files therefore sits directly
below the block rather than above it.

## `settings.json` vs `settings.local.json`

- `settings.json` — shared team configuration. Commit it.
- `settings.local.json` — your own machine's permission grants. Personal; it is
  reasonable to add it to `.gitignore` rather than commit it.
