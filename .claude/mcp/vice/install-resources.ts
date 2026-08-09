#!/usr/bin/env node
// Deploys this skill's resources/ (the host-side shell launchers) into
// <repo>/tools/ the first time any skill .mjs entry point runs, so a copy of
// this skill directory alone is sufficient -- nobody has to remember to also
// copy three shell scripts from somewhere else (D-1, quick-260730-q4b).
//
// HOSTING CHOICE (D-3): this check lives in a DEDICATED module, triggered
// from repo-root.mjs, for two reasons. First, repo-root.mjs is a pure path
// resolver, and inlining filesystem-writing side effects into it would make
// every importer of a path function also a file writer. Second and decisive:
// this module needs the repo root, and repo-root.mjs is where the repo root
// is computed -- hosting this logic INSIDE repo-root.mjs and importing it
// back from there would be a module cycle. In that cycle, this module would
// evaluate while repo-root.mjs's `const HERE` is still in its temporal dead
// zone, and every entry point would die with
// "Cannot access 'HERE' before initialization".
//
// THE CYCLE IS AVOIDED STRUCTURALLY: this module takes the repo root as an
// ARGUMENT and imports NOTHING from repo-root.mjs. Do not "clean this up" by
// adding `import { repoRoot } from "./repo-root.mjs"` here -- that importable
// convenience is exactly the cycle described above.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  statSync,
  chmodSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, isAbsolute, resolve, sep } from "node:path";

import { hostPath, SET_ENV_HINT } from "./hostpath.ts";
import { HOST_BOUND_ARTIFACTS } from "./build.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** true iff `value` is a well-formed, generic JSON object -- not null, not
 * an array. Narrows JSON.parse()'s otherwise-`any` result before any field
 * on it is touched, matching vice-broker.mts's isPlainObject() idiom
 * exactly (PATTERNS.md "Narrowing unknown, not casting"). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The on-disk shape of `.vice-deployed.json`, as read/written by
 * readDeployManifest()/writeDeployManifest() below. */
export interface DeployManifest {
  entries: string[];
}

/** Per-entry outcome of a copy attempt: which resources/ entries landed,
 * were left alone (already present, or a hand-authored divergence refused
 * without force -- see isGeneratedEntry() in installResources() for why a
 * DIVERGED GENERATED entry lands in `installed` instead, not here), or
 * failed -- returned by both installResources() and, for the prune half,
 * pruneResources(). */
export interface InstallResourcesResult {
  installed: string[];
  skipped: string[];
  diverged: string[];
  failed: string[];
  pruned: string[];
}

export interface PruneResourcesResult {
  pruned: string[];
  skipped: string[];
  failed: string[];
}

/** missing | present (byte-identical to the resource) | diverged (exists,
 * differs) -- statusForEntry()'s own return type, reused by resourcesStatus(). */
export type ResourceStatus = "missing" | "present" | "diverged";

/** This module directory's resources/ subdirectory -- a plain SIBLING of this
 * module (scripts/ was flattened away in the .claude/mcp/vice/ move), the
 * tracked source of truth every deployed tools/ file is copied from. Getting
 * this hop wrong is silent and total: readdirSync() throws inside
 * resourceEntries(), but ensureResourcesInstalled() catches everything by
 * contract (D-3 above), so every command keeps reporting success while
 * nothing is ever deployed. */
export const RESOURCES_DIR = join(HERE, "resources");

/** Where resources/ gets deployed to, for a given repo root. Always
 * `<root>/tools` -- the host's existing muscle-memory location. */
export function installTargetDir(root: string): string {
  return join(root, "tools");
}

/** Recursive walk of RESOURCES_DIR, returning the relative path (posix-style,
 * "/"-joined) of every regular file underneath it -- a WALK, not a hardcoded
 * list, so a file added under resources/lib/ later deploys with no code
 * change here. */
function walk(dir: string, base = ""): string[] {
  const out: string[] = [];
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${dirent.name}` : dirent.name;
    const abs = join(dir, dirent.name);
    if (dirent.isDirectory()) {
      out.push(...walk(abs, rel));
    } else if (dirent.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

export function resourceEntries(): string[] {
  return walk(RESOURCES_DIR);
}

/** missing | present (byte-identical to the resource) | diverged (exists,
 * differs). An unreadable target is treated as "diverged" -- conservative on
 * purpose, so a permissions oddity never gets silently reported as
 * "present" and skipped. */
function statusForEntry(entry: string, root: string): ResourceStatus {
  const src = join(RESOURCES_DIR, entry);
  const target = join(installTargetDir(root), entry);
  if (!existsSync(target)) return "missing";
  try {
    return readFileSync(src).equals(readFileSync(target)) ? "present" : "diverged";
  } catch {
    return "diverged";
  }
}

/** Per-entry status against a given repo root, without writing anything. */
export function resourcesStatus({ root }: { root: string }): Record<string, ResourceStatus> {
  const out: Record<string, ResourceStatus> = {};
  for (const entry of resourceEntries()) {
    out[entry] = statusForEntry(entry, root);
  }
  return out;
}

/** The D-4 host-launch instructions, as prose covering: the host path to
 * run, that it cannot run inside the container and will refuse with exit 2,
 * --check-container as the diagnostic, and that Ctrl-C stops it cleanly.
 * hostPath() (devcontainer-host-path skill) translates the deployed
 * launcher's container path into the HOST path a human should actually
 * type -- the same cross-skill shape tools/recover.mjs already uses -- and
 * degrades to the container path plus hostpath.mjs's own SET_ENV_HINT when
 * translation fails (e.g. no /proc/self/mountinfo, or an unmapped mount).
 *
 * 01.6.2-09 (D-23, T-01.6.2-56): this used to return TWO paragraphs, one
 * per script -- the broker launcher (start the on-demand broker) and the
 * per-instance supervisor (a "standalone (non-MCP) recovery pipeline"). The
 * supervisor paragraph is DELETED here, not repointed: the standalone
 * pipeline it advertised (vice-pool.mjs/vice-session.mjs) was already
 * deleted behind a zero-consumers gate in an earlier phase
 * (01.6-CONTEXT.md D-02), so repointing its path would keep advertising a
 * capability that no longer exists. Only ONE script survives
 * (resources/vice-launcher.sh, deployed to tools/vice-launcher.sh), and its
 * own broker now performs both jobs: on-demand acquisition (what the old
 * broker paragraph promised) and launch/supervise/respawn-with-backoff
 * (what the old supervisor paragraph promised). Exactly one resolved host
 * path is returned as a result -- asserted directly in
 * install-resources.test.ts. */
export function hostLaunchInstructions(root: string): string {
  const target = join(installTargetDir(root), "vice-launcher.sh");
  let displayPath: string;
  try {
    displayPath = hostPath(target, { workspaceRoot: root });
  } catch {
    displayPath = `${target}\n  (host path could not be determined -- ${SET_ENV_HINT})`;
  }
  return [
    `vice-mcp-selector: deployed host launcher scripts to ${installTargetDir(root)}`,
    "vice-mcp-selector: for MCP-mediated access (mcp__vice__* tools), start the on-demand broker from the HOST workspace, e.g.:",
    `  ${displayPath}`,
    "vice-mcp-selector: the broker launches a boot-fresh instance per session on demand, supervises it, and respawns a crashed one with backoff, while keeping a warm floor of spare instances ready.",
    "vice-mcp-selector: it cannot run inside the container -- the container guard refuses with exit 2.",
    "vice-mcp-selector: if it refuses when it should not, run it with --check-container for the full per-signal diagnostic.",
    "vice-mcp-selector: press Ctrl-C to stop it -- SIGINT/SIGTERM are handled and it shuts down cleanly.",
  ].join("\n");
}

/** The manifest's basename -- a dotfile under the deployment target,
 * gitignored alongside every other deployed path (see .gitignore's
 * deployed-path block). It is the ONLY thing pruneResources() below is ever
 * allowed to consult when deciding what to delete (T-01.6-11): never a
 * directory walk of installTargetDir(), which also holds tracked reverse-
 * engineering tooling sharing the same `tools/` directory. */
export const DEPLOY_MANIFEST_NAME = ".vice-deployed.json";

/** Where the manifest lives, for a given repo root -- always beneath
 * installTargetDir(root), same as every other deployed entry. */
export function deployManifestPath(root: string): string {
  return join(installTargetDir(root), DEPLOY_MANIFEST_NAME);
}

/** Reads and parses the deploy manifest, returning its recorded relative-path
 * entries. Never throws (D-3, and this codebase's standing never-throw-on-
 * untrusted-read discipline -- the manifest is untrusted input by
 * construction, T-01.6-13): a missing file, an unreadable file, malformed
 * JSON, a non-object top-level shape, and an `entries` field that isn't an
 * array are ALL treated identically as "nothing has been recorded here yet"
 * -- an empty array. Two nested try/catch layers: the outer catches a read
 * failure (ENOENT, EACCES, a directory at that path, ...), the inner catches
 * a JSON.parse failure -- matching readJsonMaybe()'s posture elsewhere in
 * this module tree (vice-broker-client.mjs) exactly. */
export function readDeployManifest(root: string): string[] {
  let raw: string;
  try {
    raw = readFileSync(deployManifestPath(root), "utf8");
  } catch {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) return [];
    if (!Array.isArray(parsed.entries)) return [];
    return parsed.entries as string[];
  } catch {
    return [];
  }
}

/** Writes the deploy manifest through the same tmp-sibling, mode-restricted,
 * rename sequence every other state file in this subsystem uses
 * (vice-broker.mts's writeBrokerRecord(): tmp file created empty, chmod 0600
 * BEFORE any content reaches it, then content written, then renamed into
 * place -- so the manifest is never briefly world-readable, V4). `entries`
 * is sorted before being written so the on-disk manifest is stable and
 * diff-friendly across runs that deploy the same resource set in a
 * different enumeration order. */
export function writeDeployManifest(root: string, entries: Iterable<string>): void {
  const target = deployManifestPath(root);
  mkdirSync(dirname(target), { recursive: true });
  const tmpPath = `${target}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmpPath, "");
  chmodSync(tmpPath, 0o600);
  writeFileSync(tmpPath, JSON.stringify({ entries: [...entries].sort() }, null, 2) + "\n");
  renameSync(tmpPath, target);
}

/** True iff `entry` is a safe manifest candidate: a plain relative path (no
 * leading "/" and no drive-letter-style absolute form), containing no
 * parent-directory ("..") path segment, whose resolved absolute location
 * sits AT OR BENEATH `targetDir` -- rejecting an absolute path, a
 * `..`-escaping path, and anything else that would resolve outside the
 * deployment target (T-01.6-12). Every check here runs BEFORE any
 * filesystem access is attempted on `entry`. */
function isSafeManifestCandidate(entry: unknown, targetDir: string): entry is string {
  if (typeof entry !== "string" || entry.length === 0) return false;
  if (isAbsolute(entry)) return false;
  if (entry.split(/[\\/]/).includes("..")) return false;
  const resolved = resolve(targetDir, entry);
  return resolved === targetDir || resolved.startsWith(targetDir.endsWith(sep) ? targetDir : targetDir + sep);
}

/**
 * Removes a deployed file this installer previously placed under
 * installTargetDir(root) but which no longer corresponds to a current
 * resources/ entry -- the delete half installResources() alone never had
 * (RESEARCH.md's Runtime State Inventory: "install-resources.mjs's current
 * installResources() only ever adds/overwrites -- it has no delete/prune
 * step"; a retired executable would otherwise linger on the host forever).
 *
 * The candidate set is EXACTLY `readDeployManifest(root)` minus the current
 * `resourceEntries()` -- never a directory walk of `installTargetDir(root)`,
 * which is a MIXED directory also holding tracked reverse-engineering
 * tooling (d64-parse.mjs, diff-images.mjs, watch-loads.mjs,
 * recovery-schema.mjs, releases.mjs and their tests). A file present in the
 * target but ABSENT from the manifest is therefore left untouched no matter
 * what it is: the prune can only ever reach a path it recorded having placed
 * there itself (T-01.6-11).
 *
 * Every candidate is validated by isSafeManifestCandidate() BEFORE any
 * unlink is attempted; a rejected candidate is pushed to `skipped` (nothing
 * was attempted) with the reason named in the warning, never to `failed`.
 * Each unlink that IS attempted is individually wrapped in its own
 * try/catch: a failure is pushed to `failed` and warned through `log`,
 * never thrown (D-3) -- the same per-entry posture `installResources()`
 * already applies to each copy. Never removes a directory.
 *
 * Returns { pruned, skipped, failed }, arrays of the candidate's manifest-
 * recorded relative path.
 */
export function pruneResources({
  root,
  log = console.error,
}: {
  root: string;
  log?: (message: string) => void;
}): PruneResourcesResult {
  const pruned: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  const manifestEntries = readDeployManifest(root);
  const currentEntries = new Set(resourceEntries());
  const targetDir = installTargetDir(root);

  for (const entry of manifestEntries) {
    if (currentEntries.has(entry)) continue; // still a current resource -- nothing to prune

    if (!isSafeManifestCandidate(entry, targetDir)) {
      skipped.push(entry);
      log(
        `warn: install-resources: prune refused manifest entry ${JSON.stringify(entry)} -- it is not a ` +
          "plain relative path resolving beneath the deployment target (absolute path, parent-directory " +
          "hop, or an escape outside the target). Refusing rather than acting on it (T-01.6-12)."
      );
      continue;
    }

    const resolvedTarget = resolve(targetDir, entry);
    try {
      unlinkSync(resolvedTarget);
      pruned.push(entry);
    } catch (e) {
      failed.push(entry);
      log(
        `warn: install-resources: prune failed to remove retired entry ${entry} from ${resolvedTarget} -- ` +
          `${(e as Error).message}. Continuing; a failed prune must never break the caller.`
      );
    }
  }

  return { pruned, skipped, failed };
}

/** True iff `entry` is one of the tsc-compiled, banner-carrying artifacts
 * build.ts emits into resources/ -- the GENERATED half of this skill's
 * resources/ directory, as distinct from the one hand-authored survivor,
 * `vice-launcher.sh` (CLAUDE.md's three-tier `.claude/mcp/` rule: "resources/
 * is generated, but committed ... The one exception is
 * resources/vice-launcher.sh, which stays hand-authored").
 *
 * Derived from build.ts's own `HOST_BOUND_ARTIFACTS` rather than a
 * hardcoded filename here, because that list is already the ENFORCED source
 * of truth for "what tsc emits": build()'s own "build: emitted file set
 * does not match HOST_BOUND_ARTIFACTS" assertion throws if the compiler's
 * real output ever differs from it, and resources-sync.test.ts separately
 * asserts committed resources/ matches a fresh build using this same list.
 * A maintainer who adds a new compiled artifact must already extend this
 * list for build() to succeed at all, so this check cannot silently drift
 * out of sync with reality without also breaking the build.
 *
 * DISCLOSED LIMITATION (autonomy contract): this is a closed-list check,
 * not a content-sniffed one -- it does not itself inspect the generated
 * banner text (build.ts's GENERATED_BANNER()). A hypothetical future
 * resources/ entry that is hand-authored but happens to share a relative
 * path with something tsc emits would be misclassified as generated; there
 * is no such collision today, and the one real hand-authored survivor
 * (`vice-launcher.sh`) is a `.sh` file, so it cannot collide with the
 * `.mjs`-only compiled set by construction. A more robust version would
 * additionally require the source file's content to start with the
 * GENERATED_BANNER() prefix; left as a follow-up rather than done here to
 * avoid introducing a second, independently-driftable banner check. */
function isGeneratedEntry(entry: string): boolean {
  return (HOST_BOUND_ARTIFACTS as readonly string[]).includes(entry);
}

/**
 * Copies every `missing` entry, every `present`/`diverged` one when `force`
 * is true, and -- new as of the 260805 stale-deploy fix -- every `diverged`
 * GENERATED entry even WITHOUT force. `present` (force or not) leaves the
 * target alone (D-5). Parent directories are created as needed, and each
 * target's permission bits are set from its source.
 *
 * WHY diverged-but-generated is overwritten by default: CLAUDE.md's
 * `.claude/mcp/` contract says resources/'s generated half (everything
 * built by build.ts) and tools/ are "never hand-edited". If nothing may be
 * hand-edited there, a `diverged` GENERATED entry cannot mean "a local edit
 * worth protecting" -- staleness is the only thing divergence can mean for
 * it, so refusing it (the old default) was silently no-op'ing on exactly
 * the files that most needed refreshing (see
 * .planning/todos/pending/2026-08-05-installresources-cannot-refresh-a-stale-deploy-without-force.md).
 * The one HAND-AUTHORED entry, `vice-launcher.sh`, keeps the original
 * refuse-on-divergence posture -- see isGeneratedEntry() above for how the
 * two are told apart.
 *
 * Every copy is individually wrapped in its own try/catch: a failure is
 * pushed to `failed` and warned through `log`, never thrown (D-3) -- a
 * read-only filesystem must never turn a working `ping` into an error.
 *
 * After the copy loop, prunes any manifest-recorded entry that is no longer
 * a current resource, then rewrites the manifest from the current
 * `resourceEntries()` -- so the manifest always reflects "what this
 * installer would deploy right now", ready for the NEXT call's prune to
 * compare against. The manifest write itself is wrapped separately (never
 * throws, D-3): an unwritable target that already made every copy above
 * fail must not ALSO throw out of the manifest write.
 *
 * Returns { installed, skipped, diverged, failed, pruned }, arrays of the
 * resource's relative path (or, for `pruned`, the manifest's recorded path).
 * `diverged` now means "refused" (hand-authored divergence only) rather
 * than "seen diverged, whether or not overwritten" -- nothing in this
 * module tree ever read the old broader meaning (checked before this
 * change), so this is not a breaking change to any known caller.
 */
export function installResources({
  root,
  force = false,
  log = console.error,
}: {
  root: string;
  force?: boolean;
  log?: (message: string) => void;
}): InstallResourcesResult {
  const installed: string[] = [];
  const skipped: string[] = [];
  const diverged: string[] = [];
  const failed: string[] = [];

  for (const entry of resourceEntries()) {
    const src = join(RESOURCES_DIR, entry);
    const target = join(installTargetDir(root), entry);
    const status = statusForEntry(entry, root);

    if (!force && status === "present") {
      skipped.push(entry);
      continue;
    }
    if (!force && status === "diverged" && !isGeneratedEntry(entry)) {
      // Hand-authored (e.g. vice-launcher.sh): a divergence here MIGHT be a
      // real local edit, so the original refuse-and-report posture stands.
      diverged.push(entry);
      log(
        `warn: install-resources: refusing to overwrite ${entry} -- it diverges from resources/ and is NOT ` +
          "a generated artifact (hand-authored; see resources/vice-launcher.sh's documented exception in " +
          "CLAUDE.md's .claude/mcp/ contract). Nothing was deployed for this entry. Pass force:true to " +
          "overwrite deliberately; this installer will never do so on its own for a hand-authored file."
      );
      continue;
    }
    if (!force && status === "diverged" && isGeneratedEntry(entry)) {
      // Generated (tsc-compiled): divergence can only mean staleness here --
      // CLAUDE.md says this half of resources/ (and all of tools/) is never
      // hand-edited -- so fall through to the copy below instead of
      // refusing it like the hand-authored branch above.
      log(
        `note: install-resources: ${entry} was diverged (stale) from resources/ -- refreshing it automatically ` +
          "because it is a generated artifact, and a generated artifact can only diverge by going stale."
      );
    }

    // Reached for status === "missing" (always copied, force or not), for
    // "present"/"diverged" when force === true (the only overwrite path for
    // a hand-authored file), and for a "diverged" GENERATED artifact even
    // without force (staleness is the only thing divergence can mean for
    // it, per the WHY note above).
    try {
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(src, target);
      chmodSync(target, statSync(src).mode & 0o777);
      installed.push(entry);
    } catch (e) {
      failed.push(entry);
      log(
        `warn: install-resources: failed to deploy ${entry} to ${target} -- ${(e as Error).message}. ` +
          "Continuing; a failed deployment must never break the caller."
      );
    }
  }

  // Make a refused (hand-authored) divergence impossible to skim past: this
  // is the one remaining case where installResources() intentionally
  // deploys nothing for an entry while reporting failed: [] -- the exact
  // shape that read as silent success before this fix (installed: [],
  // diverged: [N], failed: []). The per-entry warning above already names
  // each one; this is the loud, count-carrying summary line.
  if (diverged.length > 0) {
    log(
      `warn: install-resources: ${diverged.length} hand-authored entrie(s) refused (diverged, no force): ` +
        `${JSON.stringify(diverged)}. Nothing was deployed for these -- resolve the divergence manually, or ` +
        "pass force:true if overwriting is intentional."
    );
  }

  const { pruned } = pruneResources({ root, log });

  // Never throws (D-3): an unwritable root that already made every copy
  // above fail must not ALSO throw out of the manifest write. Nothing here
  // is added to `failed` -- that array's existing meaning is "a resource
  // copy failed", and a manifest-write failure is a distinct, best-effort
  // bookkeeping step the next call's prune degrades gracefully from (an
  // unwritten manifest reads back as empty, per readDeployManifest()).
  try {
    writeDeployManifest(root, resourceEntries());
  } catch (e) {
    log(
      `warn: install-resources: failed to write the deploy manifest -- ${(e as Error).message}. ` +
        "Continuing; a failed manifest write must never break the caller."
    );
  }

  // The default `log` is console.error, and NOTHING in this module writes to
  // stdout (D-4): `tools --json` and `pool status` emit machine-readable
  // output on stdout, and a stray banner there would corrupt it. This is the
  // one place that condition matters -- only print when something actually
  // changed (installed OR pruned).
  if (installed.length > 0 || pruned.length > 0) {
    log(hostLaunchInstructions(root));
  }

  return { installed, skipped, diverged, failed, pruned };
}

// Fire-once latch: set BEFORE any work is attempted, so a throw partway
// through installResources() can never cause a second attempt in the same
// process. ES-module caching already makes this redundant for the import
// path (a module body runs once per process no matter how many times it is
// imported) -- this latch is what also makes a direct, repeated call to
// ensureResourcesInstalled() itself a no-op, which module caching alone does
// not guarantee.
let _resourcesInstallAttempted = false;

/**
 * The fire-once entry point, wired from the bottom of repo-root.ts's module
 * body. Never throws (D-3): the whole body runs inside a try/catch that
 * degrades to a stderr warning. Does nothing at all when
 * VICE_SKIP_RESOURCE_INSTALL=1 (D-7's env opt-out), and does nothing on any
 * call after the first in this process.
 */
export function ensureResourcesInstalled({ root }: { root: string }): void {
  if (_resourcesInstallAttempted) return;
  _resourcesInstallAttempted = true;
  if (process.env.VICE_SKIP_RESOURCE_INSTALL === "1") return;
  try {
    installResources({ root });
  } catch (e) {
    console.error(`warn: install-resources: ensureResourcesInstalled failed -- ${(e as Error).message}`);
  }
}
