// project-local.mts
//
// WHY THIS FILE EXISTS: a project's .c64-re-tools/ holds two kinds of thing,
// kept in separate folders so a project can commit the first wholesale:
//
//   .c64-re-tools/          the project's own artifacts, committed with it
//                           (today: annotations.db);
//   .c64-re-tools/local/    what is specific to this machine or regenerable
//                           -- tools.json, deployed launchers, snapshots,
//                           host-tool output -- never committed.
//
// `ensureLocalDir()` creates local/ with a `.gitignore` of `*` inside it, so
// committing .c64-re-tools/ needs no rule in the project's own .gitignore.
//
// WHAT NOT TO DO:
//   - Never write a generated or machine-specific file at the .c64-re-tools/
//     root. Everything a tool writes on its own goes under local/.
//   - Never create local/ without its .gitignore: go through
//     `ensureLocalDir()`, which every writer here does.
//   - Never import anything but node built-ins here. Host-bound modules and
//     client modules both import this leaf.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** The machine-local folder's name, under a project's .c64-re-tools/. */
export const LOCAL_DIR_NAME = "local";

/** What local/'s own .gitignore holds: everything in it, itself included. */
export const LOCAL_GITIGNORE = "# Machine-specific and regenerable c64-re-tools output. Never committed.\n*\n";

/** `<toolsDir>/local`, for a project's .c64-re-tools/ at `toolsDir`. */
export function localDirUnder(toolsDir: string): string {
  return join(toolsDir, LOCAL_DIR_NAME);
}

/** Creates `<toolsDir>/local` when absent, with its .gitignore, and returns
 * it. A .gitignore already there is left alone. */
export function ensureLocalDir(toolsDir: string): string {
  const dir = localDirUnder(toolsDir);
  mkdirSync(dir, { recursive: true });
  const ignore = join(dir, ".gitignore");
  if (!existsSync(ignore)) writeFileSync(ignore, LOCAL_GITIGNORE);
  return dir;
}
