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
import { mkdtempSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  const pluginFrom = join(pluginRoot, ".claude", "mcp", "vice");
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

test("repoRoot() last-resort fallback (quick-260731-p8a, path-anchor regression): climbs THREE levels from a <root>/.claude/mcp/<server> path, not four", () => {
  // Deliberately has no .git ancestor and no CONTAINER_WORKSPACE_PATH, so the
  // ladder falls all the way through to branch 4 -- the fixed-hop last
  // resort this move touched. The relocated tree is one level shallower than
  // the old <root>/.claude/skills/<skill>/scripts shape (scripts/ was
  // flattened away), so a naive move that kept the old four-level hop would
  // land on <tmpdir>/.claude/mcp instead of <tmpdir> itself, which is exactly
  // the silent-wrong-directory failure this file's header forbids.
  //
  // THIS ASSERTION IS ALSO WHY authored TypeScript stayed FLAT in
  // .claude/mcp/vice/ (siblings of resources/) rather than moving into a
  // src/ subdirectory during the 01.6.1 conversion: doing so would add a
  // FOURTH level and silently break this exact hop count again. A future
  // reader proposing that move should read this comment before doing it.
  const root = mkdtempSync(join(tmpdir(), "reporoot-threelevel-"));
  const moduleDir = join(root, ".claude", "mcp", "vice");
  mkdirSync(moduleDir, { recursive: true });

  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal(repoRoot({ from: moduleDir, env: {} }), root);
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
// and therefore the same .vice-supervisor directory.
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

  const launcherScript = join(repoRoot(), "tools", "vice-launcher.sh");
  const resourcesLauncherScript = join(repoRoot(), ".claude", "mcp", "vice", "resources", "vice-launcher.sh");
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
  const expectedStateDir = join(launcherVals.repo_root, ".vice-supervisor");
  assert.equal(nodeVals.supervisorDir, expectedStateDir, "Node supervisorDir() must equal <launcher repo_root>/.vice-supervisor");
  assert.equal(nodeVals.epochDir, expectedStateDir, "dirname(EPOCH_FILE) must equal <launcher repo_root>/.vice-supervisor");
  assert.ok(
    !nodeVals.supervisorDir.includes(".claude"),
    `the agreed directory must not sit under .claude -- got ${nodeVals.supervisorDir} (the exact regression a naive move would introduce)`
  );
});

test("path agreement without CONTAINER_WORKSPACE_PATH (D-6): the .git-walk branch -- the ONLY branch that ever runs on the real host -- still agrees between resources/ and tools/", async () => {
  const resourcesLauncherScript = join(repoRoot(), ".claude", "mcp", "vice", "resources", "vice-launcher.sh");
  const launcherScript = join(repoRoot(), "tools", "vice-launcher.sh");

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
