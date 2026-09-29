#!/usr/bin/env node
// sibling.ts
//
// WHY THIS FILE EXISTS: this skill uses modules from the c64-project
// skill. `npx skills add` can install one skill alone, and a static import of
// a missing sibling crashes with ERR_MODULE_NOT_FOUND before any script code
// runs. loadSibling() turns exactly that case into a refusal that names the
// missing skill and the command that installs it.
//
// WHAT NOT TO DO:
//   - Never swallow any other error. A sibling that IS installed but throws
//     while loading (e.g. no project root) must surface as itself.
//   - Never pass a computed specifier. The thunk holds a literal import() so
//     tsc still types the loaded module.
//   - Keep every copy identical by hand; no test compares them. Each
//     consuming skill carries one because the helper cannot
//     live in c64-project itself.

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type SiblingLoad<T> = { ok: true; mod: T } | { ok: false; message: string };

/** The one skill the other skills reach into. */
export const SIBLING_SKILL = "c64-project";

/** Runs `load` (a literal `() => import("../../c64-project/scripts/<file>")`).
 * Returns the module, or a refusal when `file` itself is not installed.
 * `who` names the calling skill in the refusal. */
export async function loadSibling<T>(load: () => Promise<T>, file: string, who: string): Promise<SiblingLoad<T>> {
  try {
    return { ok: true, mod: await load() };
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    const message = String(err.message);
    if (err.code === "ERR_MODULE_NOT_FOUND" && message.includes(SIBLING_SKILL) && message.includes(file)) {
      return {
        ok: false,
        message:
          `${who} needs the "${SIBLING_SKILL}" skill, which is not installed next to it (${file} not found). ` +
          `Install it: npx skills add henols/c64-re-tools --skill ${SIBLING_SKILL}`,
      };
    }
    throw e;
  }
}

/** For a script that needs a sibling at import time: the module, or, when the
 * sibling is missing, a refusal. As the process entry point it prints the
 * refusal and exits 1; when imported it throws it. Pass `import.meta.url`. */
export function siblingOrRefuse<T>(load: SiblingLoad<T>, importMetaUrl: string): T {
  if (load.ok) return load.mod;
  // realpathSync(): the entry point may run through a symlinked install.
  if (process.argv[1] !== undefined && realpathSync(process.argv[1]) === fileURLToPath(importMetaUrl)) {
    console.error(`error: ${load.message}`);
    process.exit(1);
  }
  throw new Error(load.message);
}
