// node:test coverage of repo-root.ts's repoRoot() ladder, the path-anchor
// hop count it falls back to as a last resort, and the resources/-versus-
// tools/ path-agreement regression. repoRoot() is the one shared path
// resolver every module in this tree (vice-proxy.ts, install-resources.ts's
// caller) derives its state directory through.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { repoRoot } from "../../src/mcp/vice/repo-root.ts";
import { installResources } from "../../src/mcp/vice/install-resources.ts";

const execFileP = promisify(execFile);
const REPO_ROOT_MODULE_URL = new URL("../../src/mcp/vice/repo-root.ts", import.meta.url).href;

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
// and need no other module.
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

test("repoRoot(): C64RE_PROJECT_ROOT wins over CLAUDE_PROJECT_DIR, the .git walk and a containing CONTAINER_WORKSPACE_PATH", () => {
  const checkout = mkdtempSync(join(tmpdir(), "reporoot-c64re-checkout-"));
  mkdirSync(join(checkout, ".git"));
  const from = join(checkout, "src", "mcp", "vice");
  mkdirSync(from, { recursive: true });
  const project = mkdtempSync(join(tmpdir(), "reporoot-c64re-project-"));
  const claude = mkdtempSync(join(tmpdir(), "reporoot-c64re-claude-"));

  assert.equal(repoRoot({ from, env: { C64RE_PROJECT_ROOT: project, CLAUDE_PROJECT_DIR: claude } }), project);
  assert.equal(repoRoot({ from, env: { C64RE_PROJECT_ROOT: project, CONTAINER_WORKSPACE_PATH: checkout } }), project);
  // Without it, CLAUDE_PROJECT_DIR still applies.
  assert.equal(repoRoot({ from, env: { CLAUDE_PROJECT_DIR: claude } }), claude);
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

test("repoRoot() last-resort fallback counts its three hops from the PACKAGE directory: the compiled copy in <package>/dist climbs from <package>, not from dist/", () => {
  // buildServer() compiles this module into dist/, one level below the
  // package directory. The package.json marker picks the package directory,
  // so the hop count stays a property of the package's depth.
  const root = mkdtempSync(join(tmpdir(), "reporoot-dist-"));
  const packageDir = join(root, "src", "mcp", "vice");
  const distDir = join(packageDir, "dist");
  mkdirSync(distDir, { recursive: true });
  const exists = (p: string): boolean => p === join(packageDir, "package.json");

  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal(repoRoot({ from: distDir, env: {}, exists }), root);
    assert.equal(repoRoot({ from: packageDir, env: {}, exists }), root);
  } finally {
    console.error = originalError;
    rmSync(root, { recursive: true, force: true });
  }
});

// ============================================================================
// Path agreement (D-2, D-3): proves the Node side (repo-root.ts's
// supervisorDir()) and the shell side (tools/vice-launcher.sh's
// --print-paths, via its own inlined resolve_repo_root()) resolve the SAME
// repo root, and therefore the same .c64-re-tools/supervisor directory.
//
// The launcher has no supervisor_dir/pool_dir concept of its own (it only
// resolves repo_root, self_dir and broker_artifact -- see
// vice-launcher.sh's own header), so the test derives the expected state
// dir from the launcher's own printed repo_root and compares it against
// Node's directly, since the launcher is the only shell-side resolver.
// The test keeps: the VICE_-prefixed env strip, the fresh-child-process
// Node evaluation, the self-sufficient installResources() call, the
// .git-walk-only variant, and the final not-under-.claude assertion.
// ============================================================================

test("path agreement (D-3, D-6, THE regression this task exists to catch): the launcher's own repo_root (resources/ and tools/ copies) agrees with Node's supervisorDir(), and the agreed path is not under .claude", async () => {
  // Self-sufficient about the deployed copies (quick-260730-q4b): this makes
  // the test pass in a fresh clone that has never run any skill .mjs file,
  // rather than depending on whether the runner happened to set
  // VICE_SKIP_RESOURCE_INSTALL=1 first. installResources() never overwrites
  // an already-present target, so calling it here is safe even when the real
  // tools/ copies already exist (and were hand-verified moments ago).
  installResources({ root: repoRoot() });

  const launcherScript = join(repoRoot(), ".c64-re-tools", "local", "bin", "vice-launcher.sh");
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
  delete cleanEnv.C64RE_PROJECT_ROOT;
  delete cleanEnv.CLAUDE_PROJECT_DIR;

  const { stdout: launcherOut } = await execFileP("bash", [launcherScript, "--print-paths"], { env: cleanEnv });
  const { stdout: resourcesLauncherOut } = await execFileP("bash", [resourcesLauncherScript, "--print-paths"], { env: cleanEnv });
  const launcherVals = parseKeyValueLines(launcherOut);

  // The launcher's --print-paths output is NOT expected to be byte-identical
  // between the two copies: self_dir/broker_artifact are deliberately
  // resolved as SIBLINGS of whichever copy is actually running (see
  // vice-launcher.sh's own header comment -- a launcher run from resources/ must
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
  // supervisorDir() (repo-root.ts) is the Node-side derivation that survives
  // from the original (poolDir()/sessionFilePath() went with D-02, and
  // vice-errors.mts's EPOCH_FILE went when the epoch moved onto the socket).
  const nodeSrc = `
    import { supervisorDir } from ${JSON.stringify(REPO_ROOT_MODULE_URL)};
    console.log(JSON.stringify({
      supervisorDir: supervisorDir(),
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
  // supervisor_dir/pool_dir/supervisorDir() cross-check, now that
  // the launcher is the only shell-side repo-root resolver left.
  const expectedStateDir = join(launcherVals.repo_root, ".c64-re-tools", "supervisor");
  assert.equal(nodeVals.supervisorDir, expectedStateDir, "Node supervisorDir() must equal <launcher repo_root>/.c64-re-tools/supervisor");
  assert.ok(
    !nodeVals.supervisorDir.includes(".claude"),
    `the agreed directory must not sit under .claude -- got ${nodeVals.supervisorDir} (the exact regression a naive move would introduce)`
  );
});

test("path agreement without CONTAINER_WORKSPACE_PATH (D-6): the .git-walk branch -- the ONLY branch that ever runs on the real host -- still agrees between resources/ and tools/", async () => {
  const resourcesLauncherScript = join(repoRoot(), "src", "mcp", "vice", "resources", "vice-launcher.sh");
  const launcherScript = join(repoRoot(), ".c64-re-tools", "local", "bin", "vice-launcher.sh");

  const hostEnv = { ...process.env };
  for (const k of Object.keys(hostEnv)) {
    if (k.startsWith("VICE_")) delete hostEnv[k];
  }
  delete hostEnv.CONTAINER_WORKSPACE_PATH;
  delete hostEnv.C64RE_PROJECT_ROOT;
  delete hostEnv.CLAUDE_PROJECT_DIR;

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
