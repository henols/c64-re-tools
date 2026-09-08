// node:test coverage of repo-root.ts's repoRoot() ladder, the path-anchor
// hop count it falls back to as a last resort, and the resources/-versus-
// tools/ path-agreement regression -- rescued from vice-pool.test.mjs
// (quick-260730-oga Task 2, quick-260731-p8a) before that file is deleted
// wholesale in plan 04 (D-02). repoRoot() itself SURVIVES D-02/D-05: it is
// the one shared path resolver every remaining module in this tree
// (vice.mjs, vice-probe.ts, install-resources.ts's caller) derives its
// state directory through. Nothing here imports vice-pool.mjs or
// vice-session.mjs -- both are deleted in plan 04.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { repoRoot } from "./repo-root.ts";
import { installResources } from "./install-resources.ts";

const execFileP = promisify(execFile);
const REPO_ROOT_MODULE_URL = new URL("./repo-root.ts", import.meta.url).href;
const VICE_MODULE_URL = new URL("./vice.ts", import.meta.url).href;

/** Parse `key=value` lines (one per line, as `--print-paths` emits) into a
 * plain object. */
function parseKeyValueLines(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.trim().split("\n")) {
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    out[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return out;
}

// ============================================================================
// repoRoot() ladder (D-2) and the last-resort path-anchor hop count
// (quick-260731-p8a). Both drive repoRoot({ from, env }) injection directly
// and need no other module -- carried over unchanged from vice-pool.test.mjs.
// ============================================================================

test("repoRoot() ladder: a .git ancestor resolves with no env set; a containing CONTAINER_WORKSPACE_PATH wins over a NEARER .git; a non-containing CONTAINER_WORKSPACE_PATH loses to the .git walk", () => {
  const outer = mkdtempSync(join(tmpdir(), "reporoot-"));
  mkdirSync(join(outer, ".git"));
  const inner = join(outer, "sub", "deeper");
  mkdirSync(inner, { recursive: true });

  // 1. No env set at all -> the .git walk finds `outer`.
  assert.equal(repoRoot({ from: inner, env: {} }), outer);

  // 2. A CONTAINER_WORKSPACE_PATH containing `from` wins over an even
  //    NEARER .git ancestor -- the env var is checked FIRST and wins
  //    whenever `from` resolves inside it, regardless of what a marker walk
  //    would have found.
  const envRoot = mkdtempSync(join(tmpdir(), "reporoot-env-"));
  const envInner = join(envRoot, "a", "b");
  mkdirSync(envInner, { recursive: true });
  mkdirSync(join(envInner, ".git")); // nearer than envRoot -- must still lose
  assert.equal(repoRoot({ from: envInner, env: { CONTAINER_WORKSPACE_PATH: envRoot } }), envRoot);

  // 3. A CONTAINER_WORKSPACE_PATH that does NOT contain `from` loses to the
  //    .git walk (the ambiguous, one-time-stderr-note branch) -- silenced
  //    here since only the returned path is under test.
  const unrelated = mkdtempSync(join(tmpdir(), "reporoot-unrelated-"));
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal(repoRoot({ from: inner, env: { CONTAINER_WORKSPACE_PATH: unrelated } }), outer);
  } finally {
    console.error = originalError;
  }
});

test("repoRoot() branch 0: CLAUDE_PROJECT_DIR wins over BOTH a .git walk and a containing CONTAINER_WORKSPACE_PATH -- the plugin-consumption case where `from` sits outside the user's project", () => {
  // Model the installed-plugin shape: the module's own location (`from`) is a
  // plugin install dir with its OWN .git ancestor, entirely outside the
  // project Claude Code is driving. CLAUDE_PROJECT_DIR names that project, and
  // must win regardless of what the .git walk or CONTAINER_WORKSPACE_PATH say.
  const pluginRoot = mkdtempSync(join(tmpdir(), "reporoot-plugin-"));
  mkdirSync(join(pluginRoot, ".git")); // the plugin's own checkout -- branch 2 would return this
  const pluginFrom = join(pluginRoot, "src", "mcp", "vice");
  mkdirSync(pluginFrom, { recursive: true });

  const project = mkdtempSync(join(tmpdir(), "reporoot-project-"));

  // 1. CLAUDE_PROJECT_DIR alone -> the project, not the plugin's .git root.
  assert.equal(repoRoot({ from: pluginFrom, env: { CLAUDE_PROJECT_DIR: project } }), project);

  // 2. Even with a CONTAINER_WORKSPACE_PATH also set (and not containing
  //    `from`), CLAUDE_PROJECT_DIR still wins -- branch 0 precedes branch 1.
  const otherWorkspace = mkdtempSync(join(tmpdir(), "reporoot-ws-"));
  assert.equal(
    repoRoot({ from: pluginFrom, env: { CLAUDE_PROJECT_DIR: project, CONTAINER_WORKSPACE_PATH: otherWorkspace } }),
    project
  );
});

test("repoRoot() last-resort fallback (quick-260731-p8a, path-anchor regression; phase 16-04 rebuilt this fixture at src/mcp/vice): climbs THREE levels from a <root>/src/mcp/<server> path, not four", () => {
  // Deliberately has no .git ancestor and no CONTAINER_WORKSPACE_PATH, so the
  // ladder falls all the way through to branch 4 -- the fixed-hop last
  // resort this move touched. The relocated tree is one level shallower than
  // the old <root>/.claude/skills/<skill>/scripts shape (scripts/ was
  // flattened away), so a naive move that kept the old four-level hop would
  // land on <tmpdir>/src/mcp instead of <tmpdir> itself, which is exactly
  // the silent-wrong-directory failure this file's header forbids.
  //
  // THE DISTINCTION THIS COMMENT MUST DRAW (phase 16-04): what breaks this
  // hop count is adding a FOURTH level INSIDE the flat module directory --
  // nesting authored TypeScript one level deeper than `src/mcp/vice/` itself
  // (siblings of resources/), the exact move the 01.6.1-era version of this
  // comment warned against. What does NOT break it is relocating the same
  // three-segment shape elsewhere directly under the repo root, which is
  // what phase 16-04 did: `.claude/mcp/vice/` -> `src/mcp/vice/`, still three
  // segments below the root. A future reader proposing to nest sources one
  // level deeper inside this module directory should still read this
  // comment before doing it; a future reader merely relocating this same
  // three-segment directory elsewhere under the root is not the move this
  // comment forbids.
  const root = mkdtempSync(join(tmpdir(), "reporoot-threelevel-"));
  const moduleDir = join(root, "src", "mcp", "vice");
  mkdirSync(moduleDir, { recursive: true });

  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal(repoRoot({ from: moduleDir, env: {}, exists: () => false }), root);
  } finally {
    console.error = originalError;
  }
});

test("repoRoot() last-resort fallback pins the HOP COUNT as a property of depth, not of one particular directory name: the OLD .claude/mcp/vice three-segment shape also still climbs three levels", () => {
  // Added by phase 16-04 alongside the rebuilt-at-the-new-shape test above,
  // so this hop count is pinned as "three segments below the root", not
  // "the directory happens to be named src/mcp/vice". Any future reader
  // relocating this module tree again to a different three-segment name
  // still has this assertion's shape as a template.
  const root = mkdtempSync(join(tmpdir(), "reporoot-threelevel-old-shape-"));
  const moduleDir = join(root, ".claude", "mcp", "vice");
  mkdirSync(moduleDir, { recursive: true });

  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal(repoRoot({ from: moduleDir, env: {}, exists: () => false }), root);
  } finally {
    console.error = originalError;
  }
});

// ============================================================================
// Path agreement (D-2, D-3, quick-260730-oga Task 2, narrowed for D-02,
// narrowed AGAIN for plan 11's deletion of vice-supervisor.sh/vice-broker.sh):
// proves the Node side (repo-root.ts's supervisorDir(), plus vice.ts's
// EPOCH_FILE) and the shell side (tools/vice-launcher.sh's --print-paths,
// via its own now-inlined resolve_repo_root()) resolve the SAME repo root,
// and therefore the same .c64-re-tools/supervisor directory.
//
// NARROWED again from the vice-supervisor.sh/vice-broker.sh-era version:
// that version also cross-checked the two retiring daemons' own
// supervisor_dir/pool_dir fields, which had a direct Node-side counterpart
// to compare byte-for-byte. Neither retiring script survives plan 11's
// deletion, and the surviving launcher has no supervisor_dir/pool_dir
// concept of its own (it only resolves repo_root, self_dir and
// broker_artifact -- see vice-launcher.sh's own header). The property this
// test proves is unchanged (Node and the shell agree on one repo root, and
// therefore on one state directory) -- only the shell-side anchor moves from
// "compare two scripts' own printed state-dir fields" to "derive the
// expected state dir from the launcher's own printed repo_root and compare
// against Node's directly", since the launcher is the only shell-side
// resolver left. Every structural property of the original regression is
// kept: the VICE_-prefixed env strip, the fresh-child-process Node
// evaluation, the self-sufficient installResources() call, the
// .git-walk-only variant, and the final not-under-.claude assertion.
// ============================================================================

test("path agreement (D-3, D-6, THE regression this task exists to catch): the launcher's own repo_root (resources/ and tools/ copies) agrees with Node's supervisorDir()/dirname(EPOCH_FILE), and the agreed path is not under .claude", async () => {
  // Self-sufficient about the deployed copies (quick-260730-q4b): this makes
  // the test pass in a fresh clone that has never run any skill .mjs file,
  // rather than depending on whether the runner happened to set
  // VICE_SKIP_RESOURCE_INSTALL=1 first. installResources() never overwrites
  // an already-present target, so calling it here is safe even when the real
  // tools/ copies already exist (and were hand-verified moments ago).
  installResources({ root: repoRoot() });

  const launcherScript = join(repoRoot(), ".c64-re-tools", "bin", "vice-launcher.sh");
  const resourcesLauncherScript = join(repoRoot(), "src", "mcp", "vice", "resources", "vice-launcher.sh");
  for (const p of [launcherScript, resourcesLauncherScript]) {
    assert.ok(existsSync(p), `expected ${p} to exist (resolved via repoRoot())`);
  }

  // Strip every VICE_* env var so neither the shell script nor the Node
  // child below can be pointed anywhere by a sibling test's leftover
  // override -- this test asserts on the TRUE no-configuration defaults.
  const cleanEnv = { ...process.env };
  for (const k of Object.keys(cleanEnv)) {
    if (k.startsWith("VICE_")) delete cleanEnv[k];
  }

  const { stdout: launcherOut } = await execFileP("bash", [launcherScript, "--print-paths"], { env: cleanEnv });
  const { stdout: resourcesLauncherOut } = await execFileP("bash", [resourcesLauncherScript, "--print-paths"], { env: cleanEnv });
  const launcherVals = parseKeyValueLines(launcherOut);

  // The launcher's --print-paths output is NOT expected to be byte-identical
  // between the two copies: self_dir/broker_artifact are deliberately
  // resolved as SIBLINGS of whichever copy is actually running (see vice-
  // launcher.sh's own header comment -- a launcher run from resources/ must
  // launch the resources/ broker artifact, not silently reach across to a
  // possibly-stale tools/ copy). Only repo_root, the one key derived purely
  // from resolve_repo_root() rather than from the running script's own
  // location, must agree between the two copies.
  const resourcesLauncherVals = parseKeyValueLines(resourcesLauncherOut);
  assert.equal(
    resourcesLauncherVals.repo_root,
    launcherVals.repo_root,
    "resources/vice-launcher.sh and tools/vice-launcher.sh must agree on repo_root even though self_dir/broker_artifact deliberately differ"
  );

  // Node-side values computed in a FRESH child process, not via this test
  // file's own already-imported modules -- immune to env mutation or
  // module-load ordering from sibling tests sharing this process.
  // supervisorDir() (repo-root.ts) and EPOCH_FILE (vice.ts) are the two
  // Node-side derivations that survive from the original (poolDir()/
  // sessionFilePath() went with D-02).
  const nodeSrc = `
    import { supervisorDir } from ${JSON.stringify(REPO_ROOT_MODULE_URL)};
    import { EPOCH_FILE } from ${JSON.stringify(VICE_MODULE_URL)};
    import { dirname } from "node:path";
    console.log(JSON.stringify({
      supervisorDir: supervisorDir(),
      epochDir: dirname(EPOCH_FILE),
    }));
  `;
  const { stdout: nodeOut } = await execFileP(process.execPath, ["--input-type=module", "-e", nodeSrc], {
    env: cleanEnv,
  });
  const nodeLines = nodeOut.trim().split("\n").filter(Boolean);
  const nodeVals = JSON.parse(nodeLines[nodeLines.length - 1]);

  // The expected state directory is derived from the launcher's own printed
  // repo_root (the launcher has no supervisor_dir/pool_dir field of its
  // own) -- this is the direct successor of the old byte-for-byte
  // supervisor_dir/pool_dir/supervisorDir()/EPOCH_FILE cross-check, now that
  // the launcher is the only shell-side repo-root resolver left.
  const expectedStateDir = join(launcherVals.repo_root, ".c64-re-tools", "supervisor");
  assert.equal(nodeVals.supervisorDir, expectedStateDir, "Node supervisorDir() must equal <launcher repo_root>/.c64-re-tools/supervisor");
  assert.equal(nodeVals.epochDir, expectedStateDir, "dirname(EPOCH_FILE) must equal <launcher repo_root>/.c64-re-tools/supervisor");
  assert.ok(
    !nodeVals.supervisorDir.includes(".claude"),
    `the agreed directory must not sit under .claude -- got ${nodeVals.supervisorDir} (the exact regression a naive move would introduce)`
  );
});

test("path agreement without CONTAINER_WORKSPACE_PATH (D-6): the .git-walk branch -- the ONLY branch that ever runs on the real host -- still agrees between resources/ and tools/", async () => {
  const resourcesLauncherScript = join(repoRoot(), "src", "mcp", "vice", "resources", "vice-launcher.sh");
  const launcherScript = join(repoRoot(), ".c64-re-tools", "bin", "vice-launcher.sh");

  const hostEnv = { ...process.env };
  for (const k of Object.keys(hostEnv)) {
    if (k.startsWith("VICE_")) delete hostEnv[k];
  }
  delete hostEnv.CONTAINER_WORKSPACE_PATH;

  const { stdout: resourcesOut } = await execFileP("bash", [resourcesLauncherScript, "--print-paths"], { env: hostEnv });
  const { stdout: toolsOut } = await execFileP("bash", [launcherScript, "--print-paths"], { env: hostEnv });
  const resourcesVals = parseKeyValueLines(resourcesOut);
  const toolsVals = parseKeyValueLines(toolsOut);
  assert.equal(
    resourcesVals.repo_root,
    toolsVals.repo_root,
    "with CONTAINER_WORKSPACE_PATH unset, resources/ and tools/ copies of the launcher must still agree on repo_root via the .git walk"
  );
  // Portable check: the launcher's bash .git walk must land on the SAME root
  // Node's own .git-walk branch resolves (env forced empty so neither
  // CLAUDE_PROJECT_DIR nor CONTAINER_WORKSPACE_PATH short-circuits it). This
  // replaced a hardcoded project-name match (`/example-project$/`) so the suite
  // travels with the module instead of asserting one repo's name.
  assert.equal(
    resourcesVals.repo_root,
    repoRoot({ env: {} }),
    "the launcher's .git walk must land on the same repo root Node's .git-walk branch resolves"
  );
});

// ============================================================================
// Census gate on toolsDir()'s doc comment (gap G-40-1, plan 40-10, threat
// T-40-10-02): the comment above toolsDir() used to claim the literal
// ".c64-re-tools" had "exactly one non-comment occurrence" in this codebase.
// That was never measured and was false. This gate reads the CORRECTED
// comment's own claimed count and file list, computes the real count and
// file list by walking the tree, and asserts the two agree -- so the next
// time a writer joins this literal directly (or the comment drifts without
// a writer changing), a test fails by name instead of a comment quietly
// going wrong a second time.
//
// The predicates below RETURN their findings instead of asserting
// internally (docs-linerefs.test.ts's own shape, `docs-linerefs.test.ts:32-
// 38`) so the planted-violation test below drives the SAME comparison code
// the real assertion uses, rather than re-implementing the rule locally and
// proving nothing about the rule the real check applies.
// ============================================================================

const CENSUS_LITERAL = '".c64-re-tools"';
const CENSUS_SCAN_DIR = dirname(fileURLToPath(import.meta.url)); // src/mcp/vice, this file's own directory

/** One qualifying (non-comment) line's occurrence count for CENSUS_LITERAL
 * in `text`. A line is "comment" and excluded when its trimmed content
 * starts with `//`, `*`, or `/*` -- covers every `//` line comment and every
 * line of a `/** ... *\/` block this codebase's own style produces (verified
 * by hand against every comment-only hit `grep -anI '"\.c64-re-tools"'`
 * found in the real tree at plan time). Deliberately NUL-tolerant: operates
 * on a JS string decoded via `Buffer#toString("utf8")`, which keeps an
 * embedded NUL character as a normal code unit rather than truncating or
 * refusing the read -- unlike a plain `grep` (no `-a`), which treats a file
 * containing a NUL byte as binary and silently skips it. This repository's
 * own anno-memmap-render.ts carries two embedded NUL bytes and has already
 * caused one wrong decision here by being silently skipped by a naive scan
 * (see MEMORY note "NUL byte hides a source file from grep"). */
function countNonCommentLiteralOccurrences(text: string): { total: number; lines: number } {
  let total = 0;
  let lines = 0;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;
    const hits = line.split(CENSUS_LITERAL).length - 1;
    if (hits > 0) {
      total += hits;
      lines += 1;
    }
  }
  return { total, lines };
}

/** Census result over a directory: every non-comment occurrence of
 * CENSUS_LITERAL in every top-level `.ts`/`.mts` file, excluding test files
 * (`*.test.ts`/`*.test.mts`) per the task's own exclusion instruction --
 * this gate is about PRODUCTION writers agreeing with the comment, not
 * every synthetic literal a test file happens to construct for its own
 * fixtures. `scannedFiles` names every file the walk actually opened, so a
 * test can prove a NUL-carrying file was scanned (not silently dropped)
 * even when it contributed zero occurrences. */
function censusCodebase(dir: string, read: (path: string) => Buffer = readFileSync): {
  totalOccurrences: number;
  files: string[];
  perFile: Record<string, number>;
  scannedFiles: string[];
} {
  const names = readdirSync(dir).filter(
    (n) => (n.endsWith(".ts") || n.endsWith(".mts")) && !n.endsWith(".test.ts") && !n.endsWith(".test.mts")
  );
  const perFile: Record<string, number> = {};
  const scannedFiles: string[] = [];
  for (const name of names.sort()) {
    const text = read(join(dir, name)).toString("utf8");
    scannedFiles.push(name);
    const { total } = countNonCommentLiteralOccurrences(text);
    perFile[name] = total;
  }
  const files = Object.keys(perFile)
    .filter((f) => perFile[f] > 0)
    .sort();
  const totalOccurrences = files.reduce((sum, f) => sum + perFile[f], 0);
  return { totalOccurrences, files, perFile, scannedFiles };
}

/** Extracts toolsDir()'s own claimed count ("exactly N non-comment
 * occurrences") and its enumerated file list (the `*   - <file> -- ...`
 * bullets immediately below that sentence) from the doc comment's raw
 * source text. Returns `null` when either half cannot be found, rather than
 * defaulting to zero -- a silently-vacuous "0 == 0" pass is exactly the
 * failure class this gate exists to end. */
function parseCensusClaim(commentText: string): { count: number; files: string[] } | null {
  // Normalize JSDoc line-wrapping (` *\n * ` continuation prefixes) into
  // plain spaces before matching the count sentence -- the prose itself is
  // free to wrap across multiple `/** ... */` lines without this parser
  // caring where the wrap fell.
  const flattened = commentText.replace(/\n\s*\*\s?/g, " ");
  const countMatch = flattened.match(/exactly (\d+) non-comment occurrences/);
  if (!countMatch) return null;
  const files: string[] = [];
  const bulletRe = /^\s*\*\s*-\s*`?([A-Za-z0-9._-]+\.m?ts)`?\s*--/gm;
  for (const m of commentText.matchAll(bulletRe)) {
    files.push(m[1]);
  }
  if (files.length === 0) return null;
  return { count: Number(countMatch[1]), files: [...new Set(files)].sort() };
}

/** Compares a parsed claim against a computed census, returning problem
 * strings (empty = agreement). Returned rather than asserted so the
 * planted-violation test drives this SAME function with synthetic input. */
function compareCensusClaim(
  claim: { count: number; files: string[] } | null,
  actual: { totalOccurrences: number; files: string[] }
): string[] {
  const problems: string[] = [];
  if (!claim) {
    problems.push("could not parse a census claim (count + file list) out of the comment text");
    return problems;
  }
  if (claim.count !== actual.totalOccurrences) {
    problems.push(`comment claims ${claim.count} occurrences; the tree actually has ${actual.totalOccurrences}`);
  }
  const claimSet = new Set(claim.files);
  const actualSet = new Set(actual.files);
  for (const f of claim.files) {
    if (!actualSet.has(f)) problems.push(`comment names ${f} as holding an occurrence, but the tree shows none`);
  }
  for (const f of actual.files) {
    if (!claimSet.has(f)) problems.push(`the tree shows an occurrence in ${f}, but the comment does not name it`);
  }
  return problems;
}

test("census gate: toolsDir()'s doc comment claims the EXACT count and file list of \".c64-re-tools\" non-comment occurrences, and the real tree agrees", () => {
  const repoRootSource = readFileSync(join(CENSUS_SCAN_DIR, "repo-root.ts"), "utf8");
  const claim = parseCensusClaim(repoRootSource);
  assert.ok(claim, "expected to parse a census claim (count + enumerated file list) out of repo-root.ts's own toolsDir() comment");

  const actual = censusCodebase(CENSUS_SCAN_DIR);
  const problems = compareCensusClaim(claim, actual);
  assert.deepEqual(
    problems,
    [],
    `toolsDir()'s comment and the real tree disagree on the ".c64-re-tools" literal census:\n${problems.join("\n")}`
  );
});

test("census gate planted-violation control: the SAME comparison predicate fires on a synthetic extra occurrence and a synthetic phantom file, and fires on NEITHER for the real comment/tree pair", () => {
  // Real pair -- must report zero problems, proving the control below is
  // exercising the same code path that the real assertion above uses, not a
  // separately-reimplemented rule that could pass while the real one fails.
  const realSource = readFileSync(join(CENSUS_SCAN_DIR, "repo-root.ts"), "utf8");
  const realClaim = parseCensusClaim(realSource);
  const realActual = censusCodebase(CENSUS_SCAN_DIR);
  assert.deepEqual(compareCensusClaim(realClaim, realActual), []);

  // Planted violation A: a synthetic TREE with an extra occurrence the
  // comment's claim does not account for (surplus in the tree).
  const claimSaysFive = { count: 5, files: ["repo-root.ts", "install-resources.ts", "vice-broker.mts", "ghidra-project.mts", "host-tool.mts"] };
  const treeWithExtra = {
    totalOccurrences: 6,
    files: ["repo-root.ts", "install-resources.ts", "vice-broker.mts", "ghidra-project.mts", "host-tool.mts", "surprise-writer.mts"],
  };
  const problemsA = compareCensusClaim(claimSaysFive, treeWithExtra);
  assert.ok(problemsA.length > 0, "an extra tree occurrence not named in the comment must be reported");
  assert.ok(
    problemsA.some((p) => p.includes("surprise-writer.mts")),
    "the surplus writer must be named in the reported problem"
  );

  // Planted violation B: a synthetic COMMENT naming a file the tree holds
  // none in (phantom entry, comment overclaims).
  const claimWithPhantom = { count: 6, files: [...claimSaysFive.files, "phantom-writer.mts"] };
  const realTreeShape = { totalOccurrences: 6, files: claimSaysFive.files };
  const problemsB = compareCensusClaim(claimWithPhantom, realTreeShape);
  assert.ok(problemsB.length > 0, "a comment-named file the tree does not actually hold an occurrence in must be reported");
  assert.ok(
    problemsB.some((p) => p.includes("phantom-writer.mts")),
    "the phantom file must be named in the reported problem"
  );
});

test("census gate is NUL-tolerant: a NUL byte earlier in a source file's text does not hide a later occurrence, and the real anno-memmap-render.ts (which carries two embedded NUL bytes) is scanned, not silently skipped", () => {
  // Direct unit proof: an embedded NUL before the literal must not truncate
  // or otherwise defeat the scan.
  const withEmbeddedNul = "const x = 1;\n" + "\u0000" + '  const y = join(root, ".c64-re-tools", "runs");\n';
  const { total } = countNonCommentLiteralOccurrences(withEmbeddedNul);
  assert.equal(total, 1, "a NUL byte earlier in the text must not hide a later non-comment occurrence of the literal");

  // Integration proof against the real, on-disk NUL-carrying file: it must
  // appear in scannedFiles (proving the walk opened it) with a defined
  // (present-but-zero) count -- not simply absent because the read skipped
  // it, which is what a plain `grep` (no `-a`) would do.
  const result = censusCodebase(CENSUS_SCAN_DIR);
  assert.ok(
    result.scannedFiles.includes("anno-memmap-render.ts"),
    "anno-memmap-render.ts (embedded NUL bytes) must be scanned, not silently skipped by the census walk"
  );
  assert.equal(
    result.perFile["anno-memmap-render.ts"],
    0,
    "anno-memmap-render.ts holds no occurrence of the literal -- this asserts it was actually read (key present) rather than dropped"
  );
});
