// node:test structural coverage of the tracked host shell scripts that
// survive D-02 -- rescued from vice-pool.test.mjs (quick-260801-qpq Task 3)
// before that file is deleted wholesale in plan 04. vice-pool.sh itself is
// deleted per D-02 and dropped from this file entirely; vice-supervisor.sh
// and the bash broker (resources/vice-broker.sh) kept the assertions
// vice-pool.sh used to share for a while, and the launcher
// (resources/vice-launcher.sh, created in plan 01) joined the shared script
// list. Plan 03 extended this file with the one-shell-script allowlist and
// the ignore-set parity gate. Plan 11 deletes both retiring daemons: the
// one-shell-script allowlist now holds exactly one entry (the launcher), and
// every assertion whose subject was one of the two retiring scripts is gone
// with them -- see the two comment blocks below for exactly what and why.
//
// Nothing here imports vice-pool.mjs or vice-session.mjs, or drives the real
// emulator -- every process spawned below is the script itself run with
// `--dry-run`/`--print-paths`/`-n`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

// install-resources.ts (Plan 03 of 01.6.1): the scoped @ts-expect-error that
// used to sit on this import (added Plan 01, when install-resources.mjs was
// still untyped) is now GONE -- the moment Plan 03 landed a typed
// install-resources.ts, that directive would have become a loud TS2578
// ("unused '@ts-expect-error' directive") error, which was the whole point
// of using @ts-expect-error over a declare-module shim in the first place:
// a self-cancelling signal to remove it, never a silent suppression that
// outlives its cause.
import { DEPLOY_MANIFEST_NAME, resourceEntries } from "./install-resources.ts";

const execFileP = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));

// REPO-ROOT RESOLUTION, DELIBERATELY NOT `repoRoot()` FROM THE SIBLING
// `repo-root.ts`: that resolver's documented precedence checks
// `CONTAINER_WORKSPACE_PATH` FIRST and returns it whenever this file's
// location resolves inside it -- which, in THIS devcontainer, is
// unconditionally true regardless of which git worktree is actually
// executing. A parallel executor running inside an isolated worktree would
// have `.gitignore`/`git ls-files` below silently redirected to the SHARED
// devcontainer mount's main checkout instead of the worktree's own tree --
// exactly the quiet-wrong-answer class this project's own conventions
// reject elsewhere (see vice-mcp-selector-docs.test.mjs's identical
// rationale). `findRepoRoot()` is the plain `.git`-marker walk ONLY (no
// env-var short-circuit), so this gate always inspects the tree it is
// actually running from, worktree or not.
function findRepoRoot(from: string): string {
  let dir = from;
  while (true) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`findRepoRoot: no .git ancestor found above ${from}`);
    }
    dir = parent;
  }
}

const REPO_ROOT = findRepoRoot(HERE);

// ============================================================================
// Plan 11: the retiring per-instance supervisor's signal-handling test
// (vice-supervisor.sh: a SIGHUP terminates the running child...), the
// trap-registration loop (both retiring daemons registering EXIT/HUP/INT/
// TERM), and the syntax-check loop (bash -n over every surviving script) are
// ALL removed here -- their common driver, the SURVIVING_HOST_SCRIPTS array,
// enumerated exactly the two retiring daemons plus the launcher, and two of
// those three no longer exist. Dispositions, per 01.6.2-VALIDATION.md's own
// ledger (row 11 and neighbours):
//   - The SIGHUP signal-handling test: RE-OBSERVED by broker-kill.test.ts's
//     own shutdown()/registerShutdownHandlers() tests, which cover every
//     catchable signal path (SIGTERM/SIGINT/SIGHUP) against the real broker
//     process, not one signal against a per-instance shell supervisor.
//   - The trap-registration loop: DELETED outright for the two retiring
//     daemons (no subject survives); the ONE assertion in that loop whose
//     subject survives -- vice-launcher.sh execing into node, which is what
//     makes signal delivery pass straight through to the broker process with
//     no bash trap of its own needed -- is kept below as its own standalone
//     test, load-bearing in its own right.
//   - The syntax-check loop: DELETED as redundant. vice-broker-launch.test.ts
//     already has its own "bash -n exits 0 for the launcher" test covering
//     the one surviving script's syntax.
// ============================================================================

test("structural: vice-launcher.sh execs into the node entry point, so signal delivery passes straight through to the broker process with no bash trap of its own needed", () => {
  const src = readFileSync(join(HERE, "resources", "vice-launcher.sh"), "utf8");
  // exec REPLACES the process image in place (same pid), so INT/TERM/HUP/
  // EXIT are delivered straight to the node process with no bash trap in
  // between. This is the one assertion the retiring trap-registration loop
  // carried whose subject survives the deletion -- the other two entries
  // (the retiring bash broker and per-instance supervisor) registered their
  // own traps, which have no equivalent shape to keep once neither script
  // exists.
  assert.match(src, /\bexec\s+node\b/, "vice-launcher.sh must exec into node so signal delivery passes through unchanged");
});

// ============================================================================
// Plan 03, Task 2, gate 1: `.gitignore` and the deployed set are in two-way
// parity. A one-way check would let a stale entry survive a deletion (plan
// 04's removal of vice-pool.sh must be able to shrink the ignore list with
// it); this gate enforces BOTH directions.
// ============================================================================

/** The deployed-path lines in `.gitignore` -- every line under the "deployed
 * copies of .claude/mcp/vice/resources/" block starts with `/tools/`.
 * Filtering on that prefix (rather than reading the whole file) keeps this
 * gate from tripping on unrelated entries elsewhere in .gitignore
 * (.vice-supervisor/, node_modules/, ...). */
function deployedIgnoreLines(gitignoreText: string): string[] {
  return gitignoreText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("/tools/"));
}

test("`.gitignore` and install-resources.ts's deployed set (resourceEntries() + the deploy manifest) are in two-way parity", () => {
  const gitignoreText = readFileSync(join(REPO_ROOT, ".gitignore"), "utf8");
  const ignoreLines = deployedIgnoreLines(gitignoreText);
  const ignoreSet = new Set(ignoreLines);

  const expectedLines = new Set([
    ...resourceEntries().map((entry: string) => `/tools/${entry}`),
    `/tools/${DEPLOY_MANIFEST_NAME}`,
  ]);

  // Direction 1: every current resource (and the manifest) has an ignore line.
  for (const expected of expectedLines) {
    assert.ok(
      ignoreSet.has(expected),
      `.gitignore is missing ${expected} -- a deployed artifact with no ignore line shows up as ` +
        "untracked noise in git status in whatever commit happens to follow. Add the line to " +
        ".gitignore's deployed-path block (see install-resources.ts's resourceEntries())."
    );
  }

  // Direction 2: every deployed-path ignore line still names something real.
  for (const line of ignoreLines) {
    assert.ok(
      expectedLines.has(line),
      `.gitignore's ${line} names neither a current resources/ entry nor the deployment manifest -- ` +
        "a stale ignore line silently outlives the deleted artifact it used to cover. Remove it from " +
        ".gitignore's deployed-path block."
    );
  }
});

// ============================================================================
// Plan 03, Task 2, gate 2: the one-shell-script structural check, using the
// RIGHT predicate. C6's own phrasing ("find . -name '*.sh' ... excluding
// gitignored tools/") is wrong: tools/ is a MIXED directory holding both
// gitignored deployment output (the .sh copies this same file's other tests
// read straight out of resources/) AND tracked reverse-engineering tooling
// (d64-parse.mjs, diff-images.mjs, watch-loads.mjs, recovery-schema.mjs,
// releases.mjs and their tests) -- a directory-exclusion predicate cannot
// tell those apart and would pass a gate that should fail. `git ls-files`
// enumerates TRACKED files instead, which is the right question: deployed
// copies under the real (untracked, gitignored) tools/ and any stray
// `.claude/worktrees/` copy are excluded structurally, not by a hand-
// maintained exclusion list.
// ============================================================================

// Named constant per plan 03's instruction: this array SHRINKS as scripts
// retire -- by one in plan 04 (vice-pool.sh's deletion), down to this single
// entry now that plan 11 folds the remaining bash daemons (and their two
// shared libraries) into the TypeScript broker. This is the single entry the
// array's own history has been anticipating since it was first written.
// Every change to it must be a deliberate edit with a commit behind it, not
// a silent widening to make a red gate pass.
// In this plugin repo the tracked shell-script set is exactly three: the
// host-side VICE launcher (deployed from resources/), the SessionStart
// dependency-provisioning script the plugin runs on the consumer, and the
// packaging script that validates the manifests and builds the release zip.
// Unlike the originating project this carries no `.devcontainer/` provisioning
// scripts -- a plugin is installed into someone else's workspace, not shipped
// with its own container image -- so the old ".devcontainer/-exactly-2"
// assertion is gone. This array still shrinks/grows only by a deliberate,
// committed edit.
const EXPECTED_TRACKED_SHELL_SCRIPTS = [
  ".claude/mcp/vice/resources/vice-launcher.sh",
  "scripts/ensure-mcp-deps.sh",
  "scripts/package.sh",
].sort();

test("structural: git ls-files enumerates the tracked shell-script set as exactly EXPECTED_TRACKED_SHELL_SCRIPTS", async () => {
  const { stdout } = await execFileP("git", ["ls-files", "--", "*.sh"], { cwd: REPO_ROOT });
  const tracked = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  assert.deepEqual(
    [...tracked].sort(),
    EXPECTED_TRACKED_SHELL_SCRIPTS,
    "the tracked shell-script set has drifted from EXPECTED_TRACKED_SHELL_SCRIPTS -- " +
      "update this array only as part of the commit that actually adds or retires the script, " +
      "never to silently paper over an unexpected drift."
  );
});

// ============================================================================
// Plan 01.6.2-09 (T-01.6.2-54): a structural gate proving neither retiring
// daemon filename (the per-instance supervisor, vice-supervisor.sh, or the
// bash broker, vice-broker.sh) appears anywhere in the module directory's
// non-test TypeScript source -- not merely that the eight known message
// builders were fixed by hand. Enumerated from the directory itself (the
// same idiom vice-proxy.test.ts's own "structural: the set of source
// files..." test and vice-broker-client.test.ts's own closure gate already
// use), so a future message reintroducing a dead filename is caught the
// moment it lands, with no test file to remember to update.
//
// WIDENED, plan 11: resources/ used to be DELIBERATELY OUT OF SCOPE (a
// subdirectory this shallow, non-recursive readdirSync(HERE) never reached)
// because it still held both retiring scripts' own bytes -- of course their
// own filenames appeared there, that was never a violation. That reason is
// gone now that both files are deleted, so the exclusion goes with it: the
// gate now also scans resources/'s surviving files (the compiled broker
// artifacts and the one hand-authored launcher) as defense-in-depth against
// a dead filename being reintroduced anywhere this module tree deploys from.
//
// Comment lines are filtered out before matching, so a header sentence
// NAMING a retiring filename (as this very comment does, deliberately, to
// explain what changed and why -- and as vice-launcher.sh's own header does,
// recording what it copied from the retiring bash broker) cannot make the
// gate self-invalidating. resources/'s one surviving shell file uses `#`
// comments, not `//`/`/* */`, so it gets its own stripping pass.
// ============================================================================

const RETIRING_DAEMON_FILENAMES: string[] = ["vice-supervisor.sh", "vice-broker.sh"];

/** Strips `//` line comments and `/* ... *\/` block comments before matching
 * -- matches vice-broker-client.test.ts's own stripComments() idiom
 * exactly (plan 07's closure gate precedent). Deliberately simple: the
 * retiring filenames never legitimately appear inside a runtime string
 * literal in this module set outside the messages this gate polices, so a
 * comment-stripping pass is enough to serve this one gate. */
function stripCommentsForDaemonGate(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

/** Strips `#` line comments -- the shell equivalent of
 * stripCommentsForDaemonGate() above, deliberately just as simple (no
 * attempt to skip a `#` inside a string literal; this gate's retiring
 * filenames never legitimately appear inside one). Applied only to
 * resources/'s one surviving `.sh` file, which uses shell comment syntax,
 * not the double-slash or slash-star style the flat TypeScript module set
 * uses. */
function stripShellCommentsForDaemonGate(source: string): string {
  return source
    .split("\n")
    .map((line) => line.replace(/#.*$/, ""))
    .join("\n");
}

test("structural: neither retiring daemon filename (vice-supervisor.sh, vice-broker.sh) appears anywhere in the module's non-test TypeScript source or in resources/'s surviving deployed files", () => {
  const flatFiles = readdirSync(HERE)
    .filter((f) => /\.[cm]?[jt]s$/.test(f) && !/\.test\.[cm]?[jt]s$/.test(f))
    .sort()
    .map((f) => ({ file: f, text: stripCommentsForDaemonGate(readFileSync(join(HERE, f), "utf8")) }));
  assert.ok(flatFiles.length > 0, "module directory enumerated as empty -- glob or path resolution is broken");

  const resourcesDir = join(HERE, "resources");
  const resourcesDirents = readdirSync(resourcesDir, { withFileTypes: true }).filter((d) => d.isFile());
  assert.ok(resourcesDirents.length > 0, "resources/ enumerated as empty -- glob or path resolution is broken");
  const resourceFiles = resourcesDirents
    .map((d) => d.name)
    .sort()
    .map((name) => {
      const text = readFileSync(join(resourcesDir, name), "utf8");
      const stripped = name.endsWith(".sh") ? stripShellCommentsForDaemonGate(text) : stripCommentsForDaemonGate(text);
      return { file: `resources/${name}`, text: stripped };
    });

  const offenders: { file: string; filename: string }[] = [];
  for (const { file, text: stripped } of [...flatFiles, ...resourceFiles]) {
    for (const filename of RETIRING_DAEMON_FILENAMES) {
      const escaped = filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(escaped).test(stripped)) {
        offenders.push({ file, filename });
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `a retiring daemon filename reappeared in non-test source: ${JSON.stringify(offenders)} -- ` +
      "every agent-facing or operator-facing message must name the surviving launcher (vice-launcher.sh) instead."
  );
});
