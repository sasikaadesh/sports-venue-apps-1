// ---------------------------------------------------------------------------
// Claude Code hook — auto-format edited files with Prettier.
//
// WHAT THIS DOES
//   Every time Claude Code writes or edits a file in this project, this script
//   runs Prettier on that one file and saves the formatted result. The effect
//   is that Claude's edits come out matching the project's code style
//   automatically — nobody has to remember to tidy the file up afterwards.
//   Formatting only changes layout (indentation, quotes, line wrapping); it
//   never changes what the code does.
//
// WHEN IT RUNS
//   Automatically, after a successful Write, Edit, MultiEdit or NotebookEdit
//   tool call. It is wired up by the "PostToolUse" hook in
//   `.claude/settings.json`, which runs:
//
//       node "$CLAUDE_PROJECT_DIR/.claude/hooks/format-with-prettier.mjs"
//
//   Claude Code pipes a small JSON object into this script on standard input,
//   describing the tool call that just happened. This script reads the edited
//   file's path out of that JSON and formats it.
//
// HOW TO USE IT
//   You don't — it is fully automatic. To see it work: ask Claude to edit a
//   .ts/.tsx file with sloppy indentation, then open the file; it will already
//   be tidy. To format the whole project by hand instead, run
//   `npm run format`. To turn the hook off, open `/hooks` in Claude Code, or
//   delete the "PostToolUse" block from `.claude/settings.json`.
//
// WHY IT NEVER BREAKS ANYTHING
//   * It only touches file types Prettier genuinely understands (.ts, .tsx,
//     .js, .jsx, .mjs, .cjs, .json, .css, .md, .mdx, .yml, .yaml, .html).
//     Anything else — images, .env files, Prisma schemas, lockfiles — is left
//     completely alone.
//   * It respects `.prettierignore`, so generated code (the Prisma client,
//     .next build output) is never rewritten.
//   * If anything at all goes wrong — a syntax error mid-edit, a missing file,
//     Prettier not installed — it stays silent and exits successfully. A
//     formatter must never block or fail an edit.
//
// This file is tooling only. It has no effect on the running application.
// ---------------------------------------------------------------------------

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// This script lives at <project>/.claude/hooks/, so the project root is three
// directories up. Deriving it this way (rather than trusting the current
// working directory) means the hook works no matter where it is launched from.
const PROJECT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

// File types Prettier is allowed to touch. Everything else is skipped.
const FORMATTABLE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".jsonc",
  ".css",
  ".scss",
  ".md",
  ".mdx",
  ".yml",
  ".yaml",
  ".html",
]);

/** Read the whole of standard input as a string. */
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const raw = await readStdin();
  if (!raw.trim()) return;

  // The hook payload looks like:
  //   { "tool_name": "Edit",
  //     "tool_input":    { "file_path": "C:/.../lib/slots.ts" },
  //     "tool_response": { "filePath":  "C:/.../lib/slots.ts" } }
  // Different tools fill in different fields, so try each in turn.
  const payload = JSON.parse(raw);
  const filePath =
    payload?.tool_response?.filePath ??
    payload?.tool_input?.file_path ??
    payload?.tool_input?.notebook_path;

  if (typeof filePath !== "string" || filePath.length === 0) return;
  if (!FORMATTABLE_EXTENSIONS.has(path.extname(filePath).toLowerCase())) return;

  // Load Prettier from the project's own node_modules (Node resolves upwards
  // from this file, so it finds the copy installed at the project root).
  const prettier = await import("prettier");

  // Honour .prettierignore — never reformat generated or vendored code.
  const info = await prettier.getFileInfo(filePath, {
    ignorePath: path.join(PROJECT_DIR, ".prettierignore"),
    resolveConfig: true,
  });
  if (info.ignored || !info.inferredParser) return;

  const options = await prettier.resolveConfig(filePath, { editorconfig: true });
  const source = await readFile(filePath, "utf8");
  const formatted = await prettier.format(source, {
    ...options,
    filepath: filePath,
  });

  // Only write when something actually changed, so file timestamps (and any
  // dev-server file watcher) stay quiet on already-tidy files.
  if (formatted !== source) await writeFile(filePath, formatted, "utf8");
}

// Never let a formatting problem interrupt Claude's work: swallow every error
// and always report success.
main().catch(() => {});
