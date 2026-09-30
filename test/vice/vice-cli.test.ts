// vice-cli.test.ts
//
// Covers vice-cli (source vice-cli.mts, compiled bin vice-cli.mjs): the
// version-arithmetic pure functions directly, and a real spawn for the
// broker-subcommand delegation, a run through a symlink, and the
// annotation-subcommand delegation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { floorMajorFromEngineRange, resolveFloorMajor, meetsFloor, brokerArgvFrom, FLOOR_REFUSAL_EXIT_CODE } from "../../src/mcp/vice/vice-cli.mts";
import { build, buildEntries } from "../../src/mcp/vice/build.ts";
import { VICE_DIR } from "./paths.ts";

// The spawn tests run the compiled bin and broker, so compile them first.
build();
buildEntries();

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = join(VICE_DIR, "vice-cli.mjs");
const PROXY_PATH = join(VICE_DIR, "vice-proxy.ts");
const REAL_PACKAGE_JSON_PATH = join(VICE_DIR, "package.json");

// The bash launcher's own floor-refusal exit code (resources/vice-launcher.sh),
// asserted independently of vice-cli.mjs's own exported constant so a future
// accidental edit to ONE of the two cannot silently drift from the other
// without a red test.
const LAUNCHER_FLOOR_EXIT_CODE = 4;

test("the entry's floor-refusal exit code matches the launcher's", () => {
  assert.equal(FLOOR_REFUSAL_EXIT_CODE, LAUNCHER_FLOOR_EXIT_CODE);
});

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
    env: { ...process.env, MASTRA_TELEMETRY_DISABLED: "1" },
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

test("the bin run through a symlink, as npm installs it, still dispatches to the broker", () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-cli-link-"));
  try {
    const link = join(dir, "vice-mcp");
    symlinkSync(CLI_PATH, link);
    const result = spawnSync(process.execPath, [link, "broker", "--no-such-flag"], { encoding: "utf8" });
    assert.equal(result.status, 1, `stderr: ${result.stderr}`);
    assert.match(result.stderr, /usage: vice-broker/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the broker artifact run through a symlink still runs its own main", () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-broker-link-"));
  try {
    const link = join(dir, "vice-broker.mjs");
    symlinkSync(join(VICE_DIR, "resources", "vice-broker.mjs"), link);
    const result = spawnSync(process.execPath, [link, "--no-such-flag"], { encoding: "utf8" });
    assert.equal(result.status, 1, `stderr: ${result.stderr}`);
    assert.match(result.stderr, /usage: vice-broker/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("running the entry with the annotation subcommand produces byte-identical output to invoking the proxy directly, for a deterministic invocation", () => {
  const env = { ...process.env, VICE_SKIP_RESOURCE_INSTALL: "1", MASTRA_TELEMETRY_DISABLED: "1" };
  const viaCli = spawnSync(process.execPath, [CLI_PATH, "anno", "--help"], { encoding: "utf8", env });
  const viaProxy = spawnSync(process.execPath, [PROXY_PATH, "anno", "--help"], { encoding: "utf8", env });
  assert.equal(viaCli.status, viaProxy.status);
  assert.equal(viaCli.stdout, viaProxy.stdout, "stdout must be byte-identical between the two entry points for the same annotation invocation");
});

