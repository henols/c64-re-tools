// vice-cli.test.ts
//
// Covers vice-cli (source vice-cli.mts, compiled bin vice-cli.mjs): the version-arithmetic pure functions directly (no
// process spawn needed for those), and a real spawn only for the cases that
// genuinely require a real process -- the below-floor refusal (driven via
// vice-cli.mjs's own test-only simulated-major escape hatch, never by
// installing a second interpreter), the broker-subcommand delegation, and
// the annotation-subcommand delegation's byte-for-byte equivalence with
// calling the proxy directly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { HOST_BOUND_ARTIFACTS, ENTRY_ARTIFACTS } from "../../src/mcp/vice/build.ts";
import { floorMajorFromEngineRange, resolveFloorMajor, meetsFloor, brokerArgvFrom, FLOOR_REFUSAL_EXIT_CODE } from "../../src/mcp/vice/vice-cli.mts";
import { VICE_DIR } from "./paths.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = join(VICE_DIR, "vice-cli.mjs");
const PROXY_PATH = join(VICE_DIR, "vice-proxy.ts");
const REAL_PACKAGE_JSON_PATH = join(VICE_DIR, "package.json");

// The bash launcher's own floor-refusal exit code (resources/vice-launcher.sh),
// asserted independently of vice-cli.mjs's own exported constant so a future
// accidental edit to ONE of the two cannot silently drift from the other
// without a red test.
const LAUNCHER_FLOOR_EXIT_CODE = 4;

// ---------------------------------------------------------------------------
// Pure-function unit tests -- no process spawn.
// ---------------------------------------------------------------------------

test("floorMajorFromEngineRange extracts the leading major from a semver range", () => {
  assert.equal(floorMajorFromEngineRange(">=24.0.0"), 24);
  assert.equal(floorMajorFromEngineRange(">=6.0.0"), 6);
  assert.equal(floorMajorFromEngineRange("24.x"), 24);
});

test("floorMajorFromEngineRange returns null for anything with no parseable integer, rather than throwing", () => {
  assert.equal(floorMajorFromEngineRange(undefined), null);
  assert.equal(floorMajorFromEngineRange(null), null);
  assert.equal(floorMajorFromEngineRange(""), null);
  assert.equal(floorMajorFromEngineRange("not-a-version"), null);
  assert.equal(floorMajorFromEngineRange(42), null);
});

test("resolveFloorMajor derives the floor from a fixture manifest's engines.node field, and changes when the fixture changes", () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-cli-floor-fixture-"));
  try {
    const lowPath = join(dir, "low.json");
    const highPath = join(dir, "high.json");
    writeFileSync(lowPath, JSON.stringify({ engines: { node: ">=18.0.0" } }));
    writeFileSync(highPath, JSON.stringify({ engines: { node: ">=99.0.0" } }));

    assert.equal(resolveFloorMajor(lowPath), 18);
    assert.equal(resolveFloorMajor(highPath), 99);
    assert.notEqual(resolveFloorMajor(lowPath), resolveFloorMajor(highPath), "changing the fixture's range must change the derived floor");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("resolveFloorMajor degrades to null (never throws) for a missing or malformed manifest", () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-cli-floor-missing-"));
  try {
    assert.equal(resolveFloorMajor(join(dir, "does-not-exist.json")), null);
    const malformedPath = join(dir, "malformed.json");
    writeFileSync(malformedPath, "{ not valid json");
    assert.equal(resolveFloorMajor(malformedPath), null);
    const noEnginesPath = join(dir, "no-engines.json");
    writeFileSync(noEnginesPath, JSON.stringify({ name: "x" }));
    assert.equal(resolveFloorMajor(noEnginesPath), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("resolveFloorMajor against this package's REAL manifest derives the same floor package.json's engines.node declares", () => {
  const pkg = JSON.parse(readFileSync(REAL_PACKAGE_JSON_PATH, "utf8")) as { engines: { node: string } };
  const expected = floorMajorFromEngineRange(pkg.engines.node);
  assert.equal(resolveFloorMajor(REAL_PACKAGE_JSON_PATH), expected);
  assert.ok(Number.isInteger(expected) && (expected as number) > 0, "the real manifest must declare a derivable floor");
});

test("meetsFloor: at or above the floor is true, below is false", () => {
  assert.equal(meetsFloor(24, 24), true);
  assert.equal(meetsFloor(25, 24), true);
  assert.equal(meetsFloor(23, 24), false);
  assert.equal(meetsFloor(NaN, 24), false);
  assert.equal(meetsFloor(24, NaN), false);
});

test("brokerArgvFrom strips exactly the subcommand token, leaving the rest of the vector untouched", () => {
  assert.deepEqual(brokerArgvFrom(["/usr/bin/node", "/path/vice-cli.mjs", "broker"]), []);
  assert.deepEqual(brokerArgvFrom(["/usr/bin/node", "/path/vice-cli.mjs", "broker", "--repo-root", "/x"]), ["--repo-root", "/x"]);
  assert.deepEqual(
    brokerArgvFrom(["/usr/bin/node", "/path/vice-cli.mjs", "broker", "--state-dir", "/y", "--dry-run"]),
    ["--state-dir", "/y", "--dry-run"],
  );
});

// ---------------------------------------------------------------------------
// Real-process spawn tests.
// ---------------------------------------------------------------------------

test("running the entry with a simulated below-floor version exits with the bash launcher's own floor-refusal code and names the package, the observed version and the required floor", () => {
  const result = spawnSync(process.execPath, [CLI_PATH], {
    encoding: "utf8",
    env: { ...process.env, VICE_CLI_TEST_SIMULATED_NODE_MAJOR: "1" },
  });
  assert.equal(result.status, FLOOR_REFUSAL_EXIT_CODE, `stderr: ${result.stderr}`);
  assert.equal(result.status, LAUNCHER_FLOOR_EXIT_CODE, "vice-cli.mjs's own exported exit code must match the bash launcher's literal");
  assert.match(result.stderr, /@henols\/vice-mcp/, "stderr must name the package");
  assert.match(result.stderr, new RegExp(process.versions.node.replace(/\./g, "\\.")), "stderr must name the ACTUAL observed Node version");
  const pkg = JSON.parse(readFileSync(REAL_PACKAGE_JSON_PATH, "utf8")) as { engines: { node: string } };
  const floor = floorMajorFromEngineRange(pkg.engines.node);
  assert.match(result.stderr, new RegExp(`v${floor}\\.x`), "stderr must name the required floor");
});

test("running the entry at or above the floor with no subcommand does not refuse on the floor check (never reaches the broker's own long-lived listener)", () => {
  // No subcommand -> delegates to vice-proxy.ts, which starts a real stdio
  // MCP server that never exits on its own -- spawnSync would hang. This
  // case is instead proven negatively and quickly: closing stdin immediately
  // gives the proxy nothing to do and it is killed on a short timeout,
  // which is enough to prove the floor check itself did not refuse (a floor
  // refusal exits well within the timeout, with the refusal text on
  // stderr; a real proxy start produces neither within the timeout).
  const result = spawnSync(process.execPath, [CLI_PATH], {
    encoding: "utf8",
    input: "",
    timeout: 2000,
    env: { ...process.env, VICE_SKIP_RESOURCE_INSTALL: "1", MASTRA_TELEMETRY_DISABLED: "1" },
  });
  assert.doesNotMatch(result.stderr ?? "", /refusing to start/, `floor check must not refuse under a real, in-range interpreter; stderr: ${result.stderr}`);
});

test("running the entry with the broker subcommand strips the subcommand before the broker artifact ever sees its argv (proven via --check-container's own report path)", () => {
  const result = spawnSync(process.execPath, [CLI_PATH, "broker", "--check-container"], {
    encoding: "utf8",
    env: { ...process.env, CONTAINER_WORKSPACE_PATH: HERE },
  });
  // If the subcommand token were NOT stripped, the broker's own parseArgs()
  // would see "broker" as a stray positional token and refuse with a usage
  // line (exit 1) instead of ever reaching the container-guard report path
  // (exit 3, "verdict: CONTAINER").
  assert.equal(result.status, 3, `stderr: ${result.stderr}`);
  assert.match(result.stderr, /verdict: CONTAINER/);
  assert.doesNotMatch(result.stderr, /usage:/);
});

test("running the entry with the annotation subcommand produces byte-identical output to invoking the proxy directly, for a deterministic invocation", () => {
  const env = { ...process.env, VICE_SKIP_RESOURCE_INSTALL: "1", MASTRA_TELEMETRY_DISABLED: "1" };
  const viaCli = spawnSync(process.execPath, [CLI_PATH, "anno", "--help"], { encoding: "utf8", env });
  const viaProxy = spawnSync(process.execPath, [PROXY_PATH, "anno", "--help"], { encoding: "utf8", env });
  assert.equal(viaCli.status, viaProxy.status);
  assert.equal(viaCli.stdout, viaProxy.stdout, "stdout must be byte-identical between the two entry points for the same annotation invocation");
});

// ---------------------------------------------------------------------------
// Manifest / packaging assertions.
// ---------------------------------------------------------------------------

test("package.json's binary map has exactly one key, pointing at vice-cli.mjs, and main matches", () => {
  const pkg = JSON.parse(readFileSync(REAL_PACKAGE_JSON_PATH, "utf8")) as { bin: Record<string, string>; main: string };
  assert.deepEqual(Object.keys(pkg.bin), ["vice-mcp"]);
  assert.equal(pkg.bin["vice-mcp"], "vice-cli.mjs");
  assert.equal(pkg.main, "vice-cli.mjs");
});

test("vice-cli.mjs IS present in package.json's files[] array", () => {
  const pkg = JSON.parse(readFileSync(REAL_PACKAGE_JSON_PATH, "utf8")) as { files: string[] };
  assert.ok(Array.isArray(pkg.files));
  assert.equal(pkg.files.includes("vice-cli.mjs"), true, "vice-cli.mjs is the package's own binary/main entry and must ship");
});

test("package.json files[] ships no TypeScript source: an npm install runs dist/ and resources/*.mjs", () => {
  // Node never strips types under node_modules, so a shipped .ts file is dead
  // weight. smoke-packed.ts proves the packed tarball runs without one.
  const pkg = JSON.parse(readFileSync(REAL_PACKAGE_JSON_PATH, "utf8")) as { files: string[] };
  assert.deepEqual(pkg.files.filter((entry) => /\.m?ts$/.test(entry)), []);
  assert.ok(pkg.files.includes("dist/"), "the compiled server build must ship");
  assert.ok(pkg.files.includes("resources"), "the compiled host-bound modules must ship");
});

test("vice-cli.mjs is NOT a host-bound artifact -- it is an entry artifact, compiled beside its source", () => {
  assert.equal(HOST_BOUND_ARTIFACTS.includes("vice-cli.mjs"), false);
  assert.equal(HOST_BOUND_ARTIFACTS.includes("vice-cli.mts"), false);
  assert.ok(ENTRY_ARTIFACTS.some((a) => a.source === "src/mcp/vice/vice-cli.mts" && a.emitted === "src/mcp/vice/vice-cli.mjs"));
});

test("D-04's verdict is recorded, not executed: the per-project deployment module and its module-load side effect are both still present", () => {
  const installResourcesPath = join(VICE_DIR, "install-resources.ts");
  const repoRootPath = join(VICE_DIR, "repo-root.ts");
  assert.doesNotThrow(() => readFileSync(installResourcesPath, "utf8"), "install-resources.ts must still exist -- Phase 62 deletes nothing (D-04)");
  const repoRootSource = readFileSync(repoRootPath, "utf8");
  assert.match(
    repoRootSource,
    /ensureResourcesInstalled\(/,
    "repo-root.ts must still contain its module-load ensureResourcesInstalled() call -- D-04's deletion is Phase 66's work, not this phase's",
  );
});
