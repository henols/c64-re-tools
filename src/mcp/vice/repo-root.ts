// repo-root.ts
//
// The one place a client module resolves the project root, and the
// tool-written directory under it. See repoRoot() for the precedence.
//
// WHAT NOT TO DO: never replace this resolver with a fixed `".."` hop count
// relative to a module's own file. A wrong count errors nowhere: every
// reader just sees an empty directory and every command keeps "succeeding".
//
// The npm package compiles this module into dist/, one level below the
// package directory, so the last-resort branch counts its hops from the
// package directory (see packageDirFor()).
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, sep } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

// Gates the two "last resort" stderr notes below so a long-running process
// (or a test suite driving this module many times) emits each at most once,
// rather than spamming stderr on every single call.
let warnedEnvOutsideFrom = false;
let warnedNoMarkerFound = false;

/** Options accepted by repoRoot()/supervisorDir(): `from` overrides the
 * caller location the ladder resolves relative to (defaults to this file's
 * own location, HERE), and `env` overrides the environment it reads
 * the project-root variables and CONTAINER_WORKSPACE_PATH from (defaults to
 * process.env) -- both exist so the ladder is testable without mutating real
 * process state. */
export interface RepoRootOptions {
  from?: string;
  env?: NodeJS.ProcessEnv;
  /** Test seam for the marker walk; production uses node:fs existsSync. */
  exists?: (path: string) => boolean;
}

/**
 * True iff `child` is `parent` itself or lies inside it, compared as plain
 * resolved path strings (no filesystem access) -- deliberately not a symlink-
 * aware realpath comparison, since CONTAINER_WORKSPACE_PATH and this file's
 * own location are both already resolved, non-symlinked container paths in
 * every case this project runs in.
 */
function isInside(child: string, parent: string): boolean {
  const c = resolve(child);
  const p = resolve(parent);
  return c === p || c.startsWith(p.endsWith(sep) ? p : p + sep);
}

/** The package directory the last-resort branch counts its hops from: `from` when it
 * holds a package.json, else `from`'s parent when that one does (the
 * compiled copy in dist/), else `from` unchanged. */
function packageDirFor(from: string, exists: (path: string) => boolean): string {
  const here = resolve(from);
  if (exists(join(here, "package.json"))) return here;
  const parent = dirname(here);
  if (exists(join(parent, "package.json"))) return parent;
  return here;
}

/**
 * Resolves the project root. Precedence, in order:
 *
 *   1. `env.C64RE_PROJECT_ROOT`, when set -- the explicit override a user or
 *      a caller sets to name the project.
 *   2. `env.CLAUDE_PROJECT_DIR`, when set -- the project Claude Code exports
 *      for the workspace it drives. This is the branch that is right when this
 *      module runs from an installed plugin, outside the user's project.
 *   3. `env.CONTAINER_WORKSPACE_PATH`, when set AND `from` resolves inside it.
 *   4. Otherwise, walk up from `from` and return the first directory holding
 *      a `.git` entry (a directory, or a worktree's `.git` file).
 *   5. Otherwise, `env.CONTAINER_WORKSPACE_PATH` if it is set at all, with a
 *      one-time stderr note naming both paths.
 *   6. Otherwise, three levels up from the package directory, with a
 *      one-time stderr note -- the shape `<root>/src/mcp/<server>/` implies.
 *
 * `from` stays the start of the `.git` walk whatever the environment holds.
 */
export function repoRoot({ from = HERE, env = process.env, exists = existsSync }: RepoRootOptions = {}): string {
  const explicitRoot = env.C64RE_PROJECT_ROOT;
  if (explicitRoot) {
    return resolve(explicitRoot);
  }

  const projectDir = env.CLAUDE_PROJECT_DIR;
  if (projectDir) {
    return resolve(projectDir);
  }

  const cwp = env.CONTAINER_WORKSPACE_PATH;

  if (cwp && isInside(from, cwp)) {
    return resolve(cwp);
  }

  let dir = resolve(from);
  while (true) {
    if (exists(join(dir, ".git"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break; // reached the filesystem root -- no .git found anywhere above `from`
    dir = parent;
  }

  if (cwp) {
    if (!warnedEnvOutsideFrom) {
      warnedEnvOutsideFrom = true;
      console.error(
        `warn: CONTAINER_WORKSPACE_PATH is set (${cwp}) but does not contain ${from}, and no .git ` +
          `ancestor was found either -- falling back to CONTAINER_WORKSPACE_PATH itself as the repo root. ` +
          `This is expected for an exported copy of this skill living outside its mounted workspace; if ` +
          `that is not the situation here, the repo root this resolved to may be wrong.`
      );
    }
    return resolve(cwp);
  }

  const packageDir = packageDirFor(from, exists);
  const fallback = resolve(packageDir, "..", "..", "..");
  if (!warnedNoMarkerFound) {
    warnedNoMarkerFound = true;
    console.error(
      `warn: could not find a .git ancestor above ${from} and CONTAINER_WORKSPACE_PATH is not set -- ` +
        `falling back to three levels up (${fallback}), the shape <root>/src/mcp/<server>/ implies. ` +
        `This is a last resort; if it's wrong, set CONTAINER_WORKSPACE_PATH or run from inside a git repo.`
    );
  }
  return fallback;
}

/** The project's tool-written root: `join(repoRoot(...), ".c64-re-tools")`.
 * Host-bound modules cannot import this container-side file, so the few that
 * need the same directory name join the literal themselves. Ghidra projects
 * never live here: Ghidra refuses a project location with a dot-prefixed
 * segment, so the broker keeps them under broker-home.mts's
 * `brokerGhidraDir()`. */
export function toolsDir(opts: RepoRootOptions = {}): string {
  return toolsDirUnder(repoRoot(opts));
}

/** The same tool-written root, under an explicit `root` rather than one
 * found by walking up for `.git` -- for callers (dxa-run.ts, ghidra-run.ts)
 * that are handed their root. Shares this file's single occurrence of the
 * directory name. */
export function toolsDirUnder(root: string): string {
  return join(root, ".c64-re-tools");
}

/** The one shared directory name every module in this skill reads/writes
 * host-synchronised state through -- `join(toolsDir(...), "supervisor")`,
 * a subdirectory of the single tool-written root `toolsDir()` owns. */
export function supervisorDir(opts: RepoRootOptions = {}): string {
  return join(toolsDir(opts), "supervisor");
}
