// node:test coverage of the host launcher (resources/vice-launcher.sh) and
// the ignore-set parity check for the deployed resource set.
//
// Nothing here drives the real emulator or starts a broker -- every process
// spawned below is the launcher run against a stub interpreter, or with
// `--print-paths`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readFileSync,
  mkdtempSync,
  writeFileSync,
  chmodSync,
  symlinkSync,
  rmSync,
  accessSync,
  constants as fsConstants,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile, execFileSync, spawn } from "node:child_process";
import { promisify } from "node:util";

// install-resources.ts: the deployed resource set the parity gate below
// checks against `.gitignore`.
import { DEPLOY_MANIFEST_NAME, resourceEntries, installTargetDir } from "../../src/mcp/vice/install-resources.ts";
import { REPO_ROOT, VICE_DIR } from "./paths.ts";

const execFileP = promisify(execFile);

// ============================================================================
// Interpreter resolution: the launcher no longer trusts PATH blindly. It
// resolves an explicit interpreter (VICE_BROKER_NODE override, then `node`
// on PATH), gates the result against a floor mirroring package.json's
// `engines.node`, and refuses by name -- before exec -- when nothing usable
// resolved. Every case below is safe by construction: cases that refuse do
// so BEFORE exec (they can never start a broker), and the --print-paths
// cases spawn no broker either -- they only run a `--version` probe on a
// candidate binary.
// ============================================================================

const LAUNCHER_PATH = join(VICE_DIR, "resources", "vice-launcher.sh");

// Resolved once, at module load, rather than assumed as "bash"/"dirname"/
// "basename" bare names -- the whole point of the tests below is to control
// PATH precisely, so the harness invoking the launcher (and the harness's
// own stub interpreters) must not itself depend on the ambient PATH the
// test runner happens to have.
const BASH_BIN = execFileSync("sh", ["-c", "command -v bash"], { encoding: "utf8" }).trim();
const DIRNAME_BIN = execFileSync("sh", ["-c", "command -v dirname"], { encoding: "utf8" }).trim();
const BASENAME_BIN = execFileSync("sh", ["-c", "command -v basename"], { encoding: "utf8" }).trim();

async function runLauncher(
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileP(BASH_BIN, [LAUNCHER_PATH, ...args], { env });
    return { code: 0, stdout, stderr };
  } catch (err) {
    const e = err as { code?: number; stdout?: string; stderr?: string };
    return { code: typeof e.code === "number" ? e.code : 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

/** Writes a fake `node` that always prints a fixed `--version` string,
 * regardless of any argument it's called with -- enough to drive the
 * launcher's own version probe without a real Node interpreter. */
function writeStubNode(dir: string, version: string): string {
  const stubPath = join(dir, "node");
  writeFileSync(stubPath, `#!${BASH_BIN}\necho "${version}"\n`);
  chmodSync(stubPath, 0o755);
  return stubPath;
}

const RE_META = /[.*+?^${}()|[\]\\]/g;
function escapeForRegExp(s: string): string {
  return s.replace(RE_META, "\\$&");
}

/** The major of package.json's `engines.node` floor, the floor the launcher
 * must enforce. */
function enginesFloorMajor(): number {
  const pkg = JSON.parse(readFileSync(join(VICE_DIR, "package.json"), "utf8")) as { engines?: { node?: string } };
  const match = pkg.engines?.node?.match(/(\d+)/);
  assert.ok(match, `could not read a major version from engines.node in src/mcp/vice/package.json ("${pkg.engines?.node}")`);
  return Number(match![1]);
}

/** Writes a fake `node` that prints `version` for `--version`. Called any
 * other way, it prints its own pid on the first line and then each argument
 * on a line of its own, so a test can see which process ran and with what. */
function writeRecordingNode(dir: string, version: string): string {
  const stubPath = join(dir, "node");
  writeFileSync(
    stubPath,
    `#!${BASH_BIN}\nif [ "$1" = "--version" ]; then echo "${version}"; exit 0; fi\necho "$$"\nprintf '%s\\n' "$@"\n`,
  );
  chmodSync(stubPath, 0o755);
  return stubPath;
}

/** A PATH directory that holds only dirname and basename, the two external
 * commands the launcher needs. No `node` resolves from it. */
function writeMinimalPath(dir: string): string {
  symlinkSync(DIRNAME_BIN, join(dir, "dirname"));
  symlinkSync(BASENAME_BIN, join(dir, "basename"));
  return dir;
}

/** Runs the launcher and returns the pid of the process it started in. */
function runLauncherWithPid(
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<{ pid: number; code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(BASH_BIN, [LAUNCHER_PATH, ...args], { env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ pid: child.pid!, code, stdout, stderr }));
  });
}

test("the launcher replaces its own process with the interpreter it resolved, passing the broker artifact, --repo-root and every argument", async () => {
  const stubDir = mkdtempSync(join(tmpdir(), "vice-launcher-test-stub-"));
  const minDir = mkdtempSync(join(tmpdir(), "vice-launcher-test-minpath-"));
  try {
    const stubPath = writeRecordingNode(stubDir, `v${enginesFloorMajor()}.0.0`);
    // No `node` on this PATH: if the launcher ran a bare `node` instead of
    // the interpreter it resolved, nothing would start and the test fails.
    const { pid, code, stdout, stderr } = await runLauncherWithPid(["--state-dir", "/x y"], {
      PATH: writeMinimalPath(minDir),
      VICE_BROKER_NODE: stubPath,
    });

    assert.equal(code, 0, `the stub interpreter must run and exit 0; stderr: ${stderr}`);
    const lines = stdout.replace(/\n$/, "").split("\n");
    assert.equal(lines[0], String(pid), "the interpreter must run in the launcher's own process (exec), so signals reach it directly");
    assert.deepEqual(lines.slice(1), [join(VICE_DIR, "resources", "vice-broker.mjs"), "--repo-root", REPO_ROOT, "--state-dir", "/x y"]);
  } finally {
    rmSync(stubDir, { recursive: true, force: true });
    rmSync(minDir, { recursive: true, force: true });
  }
});

test("the launcher accepts an interpreter at the engines.node floor of package.json and refuses one a major below it", async () => {
  const floor = enginesFloorMajor();
  const atFloorDir = mkdtempSync(join(tmpdir(), "vice-launcher-test-stub-"));
  const belowDir = mkdtempSync(join(tmpdir(), "vice-launcher-test-stub-"));
  const minDir = mkdtempSync(join(tmpdir(), "vice-launcher-test-minpath-"));
  try {
    const path = writeMinimalPath(minDir);

    const atFloor = await runLauncherWithPid([], { PATH: path, VICE_BROKER_NODE: writeRecordingNode(atFloorDir, `v${floor}.0.0`) });
    assert.equal(atFloor.code, 0, `an interpreter at v${floor}.0.0 must be accepted; stderr: ${atFloor.stderr}`);
    assert.equal(atFloor.stdout.split("\n")[0], String(atFloor.pid), "the accepted interpreter must be started");

    const below = await runLauncherWithPid([], { PATH: path, VICE_BROKER_NODE: writeRecordingNode(belowDir, `v${floor - 1}.99.0`) });
    assert.equal(below.code, 4, "an interpreter one major below the floor must be refused with exit 4");
    assert.match(below.stderr, new RegExp(`v${floor}\\b`), "the refusal must name the floor");
    assert.equal(below.stdout, "", "the refused interpreter must never be started");
  } finally {
    rmSync(atFloorDir, { recursive: true, force: true });
    rmSync(belowDir, { recursive: true, force: true });
    rmSync(minDir, { recursive: true, force: true });
  }
});

test("below-floor override: refuses before exec, naming the stub's path, its reported version, the floor, and the override variable", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-launcher-test-stub-"));
  try {
    const stubPath = writeStubNode(dir, "v20.0.0");

    const { code, stdout, stderr } = await runLauncher([], {
      PATH: process.env.PATH,
      VICE_BROKER_NODE: stubPath,
    });

    assert.notEqual(code, 0, "a below-floor interpreter must be refused, not started");
    assert.match(stderr, new RegExp(escapeForRegExp(stubPath)), "refusal must name the stub's own path");
    assert.match(stderr, /v20\.0\.0/, "refusal must name the version the stub reported");
    assert.match(stderr, /24/, "refusal must name the floor");
    assert.match(stderr, /VICE_BROKER_NODE/, "refusal must name the override variable");
    assert.doesNotMatch(stdout, /vice-broker\.mjs/, "the broker artifact must never be named on stdout -- it was never reached");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("override points at nothing: refuses, naming the variable, the path, and requiring an absolute path to an executable", async () => {
  const missingPath = join(tmpdir(), "vice-launcher-test-does-not-exist", "node");
  const { code, stderr } = await runLauncher([], {
    PATH: process.env.PATH,
    VICE_BROKER_NODE: missingPath,
  });

  assert.notEqual(code, 0);
  assert.match(stderr, /VICE_BROKER_NODE/);
  assert.match(stderr, new RegExp(escapeForRegExp(missingPath)));
  assert.match(stderr, /executable/);
});

test("nothing resolvable: a PATH with only dirname/basename (no node, no override) refuses, naming both remedies", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-launcher-test-minpath-"));
  try {
    symlinkSync(DIRNAME_BIN, join(dir, "dirname"));
    symlinkSync(BASENAME_BIN, join(dir, "basename"));

    const { code, stderr } = await runLauncher([], { PATH: dir });

    assert.notEqual(code, 0, "with no node resolvable at all, the launcher must refuse rather than proceed");
    assert.match(stderr, /install/i, "refusal must name the install remedy");
    assert.match(stderr, /VICE_BROKER_NODE/, "refusal must name the override remedy");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("--print-paths stays total: exits 0 reporting a below-floor stub, and separately exits 0 reporting nothing found, rather than ever refusing", async () => {
  const stubDir = mkdtempSync(join(tmpdir(), "vice-launcher-test-stub-"));
  const minDir = mkdtempSync(join(tmpdir(), "vice-launcher-test-minpath-"));
  try {
    const stubPath = writeStubNode(stubDir, "v20.0.0");
    symlinkSync(DIRNAME_BIN, join(minDir, "dirname"));
    symlinkSync(BASENAME_BIN, join(minDir, "basename"));

    const withStub = await runLauncher(["--print-paths"], {
      PATH: minDir,
      VICE_BROKER_NODE: stubPath,
    });
    assert.equal(withStub.code, 0, "the diagnostic must not refuse even when the resolved interpreter is below the floor");
    assert.match(withStub.stdout, /^node_bin=.*node$/m);
    assert.match(withStub.stdout, /^node_version=v20\.0\.0$/m);

    const withNothing = await runLauncher(["--print-paths"], { PATH: minDir });
    assert.equal(withNothing.code, 0, "the diagnostic must not refuse when nothing at all resolved");
    assert.match(withNothing.stdout, /^node_bin=$/m);
    assert.match(withNothing.stdout, /^node_version=$/m);
  } finally {
    rmSync(stubDir, { recursive: true, force: true });
    rmSync(minDir, { recursive: true, force: true });
  }
});

test("happy path: --print-paths with the real environment prints an absolute, executable node_bin and a node_version matching that binary's own --version", async () => {
  const { code, stdout } = await runLauncher(["--print-paths"], process.env);
  assert.equal(code, 0);

  const binMatch = stdout.match(/^node_bin=(.+)$/m);
  assert.ok(binMatch, "expected a node_bin= line in --print-paths output");
  const nodeBin = binMatch![1];
  assert.ok(nodeBin.startsWith("/"), "node_bin must be an absolute path");
  assert.doesNotThrow(() => accessSync(nodeBin, fsConstants.X_OK), "node_bin must be an executable file");

  const versionMatch = stdout.match(/^node_version=(.+)$/m);
  assert.ok(versionMatch, "expected a node_version= line in --print-paths output");
  const reportedVersion = versionMatch![1];

  const { stdout: ownVersion } = await execFileP(nodeBin, ["--version"]);
  assert.equal(reportedVersion, ownVersion.trim(), "node_version= must match the resolved binary's own --version output");
});

// ============================================================================
// Plan 03, Task 2, gate 1: `.gitignore` and the deployed set are in two-way
// parity. A one-way check would let a stale entry survive a deletion (a
// removed script must be able to shrink the ignore list with it); this gate
// enforces BOTH directions.
//
// REWORKED 2026-09-08 (D-33, plan 40-01): the twelve per-file `/tools/*`
// entries this gate used to compare against `resourceEntries()` name-for-name
// collapsed into ONE directory stanza (`/.c64-re-tools/`) when the deploy
// target moved from `<repoRoot>/tools/` to `<repoRoot>/.c64-re-tools/bin/`
// (D-33) -- a per-file relation is unexpressible against a single directory
// line, so per the owner's own instruction this gate is replaced with a
// relation over the deployed DIRECTORY rather than deleted: direction 1 (every
// deployed entry resolves under the one ignored deployment directory) and
// direction 2 (the ignore file names that directory EXACTLY once, so a
// collapse-gone-wrong that duplicated the stanza per writer still fails
// here) -- both directions still fail independently, matching the original
// gate's own two-way discipline.
// ============================================================================

/** The literal prefix every deployed artifact's absolute path must fall
 * under -- `<repoRoot>/.c64-re-tools/` -- derived from a synthetic root via
 * installTargetDir() rather than hardcoded a second time, so this test
 * cannot silently drift from install-resources.ts's own definition. */
function deployedDirPrefix(repoRootAbs: string): string {
  return join(repoRootAbs, ".c64-re-tools") + "/";
}

test("`.gitignore` and install-resources.ts's deployed set (resourceEntries() + the deploy manifest) are in two-way parity over the deployed DIRECTORY", () => {
  const gitignoreText = readFileSync(join(REPO_ROOT, ".gitignore"), "utf8");
  const stanzaLines = gitignoreText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line === "/.c64-re-tools/");

  // Direction 1: every current resource (and the manifest) resolves UNDER
  // the one ignored deployment directory -- an artifact whose deploy target
  // drifted outside .c64-re-tools/ would show up as untracked noise in git
  // status in whatever commit happens to follow.
  const syntheticRoot = "/synthetic-repo-root-for-parity-check";
  const target = installTargetDir(syntheticRoot);
  const prefix = deployedDirPrefix(syntheticRoot);
  const deployedNames = [...resourceEntries(), DEPLOY_MANIFEST_NAME];
  assert.ok(deployedNames.length > 0, "expected at least one deployed resource plus the manifest -- otherwise this direction is vacuous");
  for (const name of deployedNames) {
    const absolute = join(target, name);
    assert.ok(
      absolute === prefix.slice(0, -1) || absolute.startsWith(prefix),
      `${name} resolves to ${absolute}, which does not fall under the single ignored deployment directory ` +
        `${prefix} -- a deployed artifact outside it shows up as untracked noise in git status. ` +
        "Check installTargetDir() (install-resources.ts) and .gitignore's single stanza agree."
    );
  }

  // Direction 2: the ignore file names the deployment directory EXACTLY
  // ONCE -- a stale per-writer duplicate (the shape this gate replaced)
  // would survive a naive re-collapse and silently reintroduce the mess
  // this stanza exists to prevent.
  assert.equal(
    stanzaLines.length,
    1,
    `.gitignore must name the single tool-written root's deployment stanza (/.c64-re-tools/) exactly once; found ${stanzaLines.length}`
  );
});
