// The ONE shared place every module in this directory resolves the repo
// root through (D-2). Everything else in this module tree -- vice.mjs's
// EPOCH_FILE, vice-broker-client.mjs's brokerRootDir() (and, before their
// 2026-08-02 deletion, vice-pool.mjs's poolDir() and vice-session.mjs's
// sessionFilePath()) -- derives its `.vice-supervisor` path through
// supervisorDir() below, so there is exactly one definition of both "where
// is the repo root" and "what is the shared state directory called".
//
// WHY THIS FILE EXISTS AT ALL: originally, each of the three modules
// resolved the repo root with a fixed `resolve(dirname(SELF), "..", ...)` --
// ONE level up from the module's own file. That was correct while the
// modules lived in `tools/` (one level up from `tools/` IS the repo root),
// but a move put them THREE levels deeper, at `.claude/skills/vice-session/`'s
// `scripts/` directory (the original, now-retired home; plan 01.1-04
// relocated it again, into the `vice-mcp-selector` skill, at the same
// depth). A naive move that kept the old fixed `".."` would have silently
// resolved to `.claude/skills/.vice-supervisor` or
// `.claude/skills/vice-session/.vice-supervisor` instead of
// `<repo>/.vice-supervisor` -- a directory the host-side shell launcher
// (`tools/vice-launcher.sh`, plan 11's surviving script -- the paired
// implementation this era's now-retired `tools/vice-supervisor.sh` and
// `tools/vice-pool.sh` used to be) never writes to. NOTHING would have
// errored: the container would just read a permanently-empty
// epoch/registry/session directory, and restart detection (and the pool,
// and sessions) would quietly stop working while every command kept
// "succeeding". That failure mode -- a broken invariant with no error
// anywhere -- is exactly the class of bug this codebase keeps rejecting
// elsewhere (see vice.mjs's MachineRestartedError, vice-session.mjs's
// epoch-continuity guard). Do not reintroduce a fixed `".."` (or any other
// relative-to-this-file hop count) in place of this resolver; if the
// directory depth of this module tree ever changes again, the ladder below
// still gets the right answer without anyone having to count directories by
// hand.
//
// THIRD MOVE (quick-260731-p8a): the implementation relocated again, out of
// the `vice-mcp-selector` skill's `scripts/` into a new, flattened,
// non-skill `.claude/mcp/vice/` directory -- ONE level SHALLOWER than the
// old `.claude/skills/<skill>/scripts/` shape, since flattening removed the
// `scripts/` segment. Branch 4's hop count below moved from four levels to
// three to match. Branches 1-3 are depth-independent (an env var check, then
// a `.git` ancestor walk) and needed no change.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, sep } from "node:path";

import { ensureResourcesInstalled } from "./install-resources.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// Gates the two "last resort" stderr notes below so a long-running process
// (or a test suite driving this module many times) emits each at most once,
// rather than spamming stderr on every single call.
let warnedEnvOutsideFrom = false;
let warnedNoMarkerFound = false;

/** Options accepted by repoRoot()/supervisorDir(): `from` overrides the
 * caller location the ladder resolves relative to (defaults to this file's
 * own location, HERE), and `env` overrides the environment it reads
 * CONTAINER_WORKSPACE_PATH from (defaults to process.env) -- both exist so
 * the ladder is deterministically testable without mutating real process
 * state, per repo-root.test.ts's own injection idiom. */
export interface RepoRootOptions {
  from?: string;
  env?: NodeJS.ProcessEnv;
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

/**
 * Resolve the repository root. Precedence, in order (D-2):
 *
 *   0. `env.CLAUDE_PROJECT_DIR`, when set -- the authoritative project root
 *      Claude Code exports for the workspace it is driving. This is the ONLY
 *      branch that is correct when this module is consumed as an installed
 *      plugin: the MCP's own files then live under the plugin install dir
 *      (e.g. `~/.claude/plugins/<marketplace>/<plugin>/.claude/mcp/vice/`),
 *      NOT inside the project the user is working in, so neither the
 *      `from`-relative `.git` walk (branch 2, which would find the plugin's
 *      OWN checkout) nor a CONTAINER_WORKSPACE_PATH containment check
 *      (branch 1, which fails the containment test) can reach the project
 *      root. In the in-repo, non-plugin layout this variable is either unset
 *      (the test injections below, a bare host) or already equal to the repo
 *      root, so honouring it first is a safe no-op there and the branches
 *      below are unchanged.
 *   1. `env.CONTAINER_WORKSPACE_PATH`, when set AND `from` resolves inside
 *      it -- this devcontainer sets it (`.devcontainer/devcontainer.json`'s
 *      `containerEnv`, value `/workspaces/c64-project`), and it is the most
 *      explicit signal available.
 *   2. Otherwise, walk up from `from` toward the filesystem root, returning
 *      the first directory containing a `.git` entry (`existsSync` on the
 *      joined path -- matches both a real `.git` directory and a worktree's
 *      `.git` file). This is what keeps the skill correct once exported into
 *      a project that sets no such variable at all.
 *   3. Otherwise, `env.CONTAINER_WORKSPACE_PATH` if it is set at all (just
 *      not containing `from` -- an exported copy of this skill living
 *      outside the mounted workspace the variable names). Silence here would
 *      be exactly the quiet-wrong-answer failure class this file exists to
 *      prevent, so this path emits a one-time stderr note naming both paths.
 *   4. Otherwise, three levels up from `from`, with a one-time stderr note.
 *      Last resort only -- three levels is what `<root>/.claude/mcp/<server>/`
 *      implies. In this repo branch 4 never actually runs (there is always a
 *      `.git` ancestor), which is exactly why the paired synthetic test in
 *      repo-root.test.ts is the only thing that would catch a wrong hop
 *      count here.
 */
export function repoRoot({ from = HERE, env = process.env }: RepoRootOptions = {}): string {
  // Branch 0 (plugin-consumption signal): Claude Code sets CLAUDE_PROJECT_DIR
  // to the root of the workspace it is driving. When this module runs as an
  // installed plugin its own files sit outside that workspace, so this is the
  // only signal that points at the user's project rather than the plugin's
  // install dir. Unset / equal-to-root in the in-repo layout, so it is a
  // no-op there.
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
    if (existsSync(join(dir, ".git"))) {
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

  if (!warnedNoMarkerFound) {
    warnedNoMarkerFound = true;
    const fallback = resolve(from, "..", "..", "..");
    console.error(
      `warn: could not find a .git ancestor above ${from} and CONTAINER_WORKSPACE_PATH is not set -- ` +
        `falling back to three levels up (${fallback}), the shape <root>/.claude/mcp/<server>/ implies. ` +
        `This is a last resort; if it's wrong, set CONTAINER_WORKSPACE_PATH or run from inside a git repo.`
    );
  }
  return resolve(from, "..", "..", "..");
}

/** The one shared directory name every module in this skill reads/writes
 * host-synchronised state through -- `join(repoRoot(...), ".vice-supervisor")`,
 * so the literal directory name also has exactly one definition. */
export function supervisorDir(opts: RepoRootOptions = {}): string {
  return join(repoRoot(opts), ".vice-supervisor");
}

// Fires once per process, on whatever entry point happens to import THIS
// module -- which is vice.mjs and vice-broker-client.mjs already (both
// import repoRoot()/supervisorDir()), among other modules in this tree,
// plus vice-probe.ts's own side-effect-only import (see that file). This
// one call is what makes the
// deploy-on-first-use check (quick-260730-q4b, D-3) fire for every skill
// .mjs entry point without any of them referencing install-resources.ts
// directly.
//
// POSITION IS LOAD-BEARING: this must run at the BOTTOM of this module body,
// after HERE, repoRoot() and supervisorDir() are all initialised. Moving it
// above HERE's initialisation reintroduces the exact module-cycle TDZ crash
// install-resources.ts's own header describes ("Cannot access 'HERE' before
// initialization") -- install-resources.ts takes the repo root as an
// argument specifically so it never needs to import this file back.
try {
  ensureResourcesInstalled({ root: repoRoot() });
} catch {
  // ensureResourcesInstalled() already never throws (D-3) -- this catch is
  // belt-and-suspenders against a future change to that contract, not a
  // signal that one is expected.
}
