// host-tool.test.ts
//
// Phase 34, plan 34-01, task 2: every edge row this plan owns, as a case
// that can fail -- the typed allowlist's refusals (SEAM-02), the
// deterministic argv construction, the byte-vs-character digest contract
// (SEAM-03), and the lease-isolation claim (SEAM-01) as a spy assertion
// rather than a sentence.
//
// Reaches the executor as the BUILT artifact (A-04, this plan's own
// decision), copying broker-state.test.ts's own `await import(new URL(...))`
// shape verbatim rather than inventing a second one -- host-tool.mts value-
// imports a sibling host-bound module (ghidra-project.mjs, plan 34-03) by
// its `.mjs` specifier, which only resolves inside resources/, never
// against the unbuilt source.
//
// Phase 34, plan 34-03 (SEAM-04): extended (not a second executor suite)
// with the `ghidra.analyze` tool-id cases below -- an unknown args key
// refused by name, a runId escaping via a separator refused, a dot-prefixed
// repoRoot refused with the offending segment named, a well-formed argv
// carrying the project location/name first and `-deleteProject`, and a
// GHIDRA_HOME-unset refusal before any launch is attempted.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync, statSync, readFileSync, symlinkSync, readdirSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, basename, isAbsolute, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import { build } from "./build.ts";
import { startControlListener, type StartControlListenerResult, type AcquireOutcome, type RecycleOutcome, type StatusInstanceEntry, type HostStateFields, type MonitorClaimOutcome, type MonitorReleaseOutcome } from "./broker-control.mts";
import { hostToolOverControlPlane, hostToolRequestTimeoutMs } from "./host-tool-client.ts";
import { brokerJsonPath, CONTROL_CONNECT_TIMEOUT_MS } from "./vice-broker-client.ts";
import { acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./acme-gate.ts";
// 34-10 Task 2 (CR-05): a container-side import into a container-side test
// file -- legal here, and anno-types.ts names no node:sqlite specifier, so
// anno-seam.test.ts's TEST_FILES_NAMING_SQLITE list is untouched. Drives the
// OTHER implementation of the same ancestor-realpath walk for the
// equivalence table below.
import { storePathWithinWorkspace, AnnoStorePathError } from "./anno-types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// Reach ACME only through the shared seam -- never a second hand-rolled probe.
const SKIP_REASON: string | false = acmeSkipReasonFor("host-tool.test.ts");

test("ACME availability gate (mirrors skill-acme-build-cli.test.ts's own gate) -- always runs, never skips", () => {
  assertAcmeRequiredIfEnvSet(assert);
});

// Build BEFORE importing the artifact -- broker-state.test.ts's own idiom --
// so this suite never reaches a stale committed resources/host-tool.mjs.
build();
const hostTool = (await import(new URL("./resources/host-tool.mjs", import.meta.url).href)) as unknown as {
  // 34-08 (Task 3): the census tables themselves -- plain data, not a
  // response shape, so no narrowing hazard from widening this cast.
  HOST_TOOL_IDS: readonly string[];
  HOST_TOOL_ARG_KEYS: Readonly<Record<string, readonly string[]>>;
  HOST_TOOL_PATH_ARG_KEYS: Readonly<Record<string, readonly string[]>>;
  // 34-09 (CR-04): the server-side per-tool budget table and its resolver.
  HOST_TOOL_TIMEOUT_MS: Readonly<Record<string, number>>;
  hostToolTimeoutMs: (tool: string, override?: number) => number;
  DEFAULT_HOST_TOOL_TIMEOUT_MS: number;
  normaliseHostToolRequest: (raw: unknown) => { ok: true; request: { tool: string; args: Record<string, unknown> } } | { ok: false; message: string };
  resolveWorkspacePath: (repoRoot: string, relative: string) => { ok: true; path: string } | { ok: false; message: string };
  buildHostToolArgv: (
    request: { tool: string; args: Record<string, unknown> },
    // Widened to a generic bag (plan 34-03): ghidra.analyze's resolved
    // shape (importPath/projectLocation/projectName) differs from
    // acme.build's own (sourcePath/outDirPath) -- this cast is test-file-
    // local typing only, not the module's own exported type.
    resolved: Record<string, unknown>,
  ) => { ok: true; toolPath: string; argv: string[]; outputs: string[] } | { ok: false; message: string };
  runHostTool: (
    raw: unknown,
    deps: { repoRoot: string; log?: (line: string) => void; timeoutMs?: number },
  ) => Promise<
    | { ok: true; tool: string; exitStatus: number | null; results: Array<{ path: string; sha256: string; byteLength: number }>; stderrTail: string }
    | { ok: false; message: string }
  >;
};
const {
  normaliseHostToolRequest,
  resolveWorkspacePath,
  buildHostToolArgv,
  runHostTool,
  HOST_TOOL_IDS,
  HOST_TOOL_ARG_KEYS,
  HOST_TOOL_PATH_ARG_KEYS,
  HOST_TOOL_TIMEOUT_MS,
  hostToolTimeoutMs,
  DEFAULT_HOST_TOOL_TIMEOUT_MS,
} = hostTool;

/** 34-08 (CR-01): a SEPARATELY-typed alias to the SAME runtime function --
 * oracle.probe/oracle.run's response shapes (`{ available, command, version,
 * reason }` / `{ ok, stdout, reason }`, mirroring packer-finding.mjs's own
 * pre-existing contracts) are deliberately NOT folded into `runHostTool`'s
 * shared return type above: that type's generic `tool: string` envelope
 * member would then satisfy every oracle-shaped narrowing check too (a wide
 * `string` is never excluded by an equality/`in` narrow), silently
 * un-narrowing every PRE-EXISTING acme.build/ghidra.analyze case that reads
 * `response.message` after `if (!response.ok)`. */
const runOracleHostTool = runHostTool as unknown as (
  raw: unknown,
  deps: { repoRoot: string; log?: (line: string) => void; timeoutMs?: number },
) => Promise<
  | { ok: true; tool: "oracle.probe"; available: boolean; command: string | null; version: string | null; reason: string | null }
  | { ok: boolean; tool: "oracle.run"; stdout: string; reason: string | null }
  | { ok: false; message: string }
>;

// --------------------------------------------------------------- test helpers

async function withTempDir<T>(fn: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "host-tool-test-"));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** 34-10 (CR-05): a fixture for the live planted-symlink cases. `symlinkSync`
 * is called BARE by every case that uses this helper -- a filesystem without
 * symlink support must make those cases FAIL, never skip, because a
 * silently skipped confinement control is the state CR-05 was reported
 * from.
 *
 * The mkdtempSync root is wrapped in realpathSync for the same reason
 * anno-confinement.test.ts:101-105 gives: a fixture root reached through a
 * link would make every assertion below it assert something other than
 * what it means, now that resolveWorkspacePath() returns the walked
 * (real) path. `ws` is the workspace root the case confines against;
 * `outside` is a sibling directory outside it, the target every escaping
 * link in this file points at.
 *
 * This host's /tmp is a tmpfs whose periodic cleanup is disabled, so a
 * leaked fixture is leaked RAM until reboot -- the unconditional `finally
 * rmSync` is load-bearing, not tidiness. */
async function withSymlinkFixture<T>(fn: (ws: string, outside: string) => Promise<T> | T): Promise<T> {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "host-tool-symlink-test-")));
  const ws = join(root, "ws");
  const outside = join(root, "outside");
  mkdirSync(ws, { recursive: true });
  mkdirSync(outside, { recursive: true });
  try {
    return await fn(ws, outside);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** Temporarily overrides ACME_BIN so runHostTool's spawn resolves to a
 * controllable fake rather than real ACME -- this is what lets the non-zero-
 * exit, zero-byte-output and multi-byte-UTF-8 cases run deterministically,
 * with no dependence on real ACME being installed. Restored in `finally`
 * regardless of outcome. */
async function withFakeAcme<T>(acmeBinOverride: string, fn: () => Promise<T> | T): Promise<T> {
  const previous = process.env.ACME_BIN;
  process.env.ACME_BIN = acmeBinOverride;
  try {
    return await fn();
  } finally {
    if (previous === undefined) delete process.env.ACME_BIN;
    else process.env.ACME_BIN = previous;
  }
}

/** Writes a small, executable, controllable stand-in for the real `acme`
 * binary: it locates its own `-o <path>` flag (the same flag
 * buildHostToolArgv() always emits) and behaves per `mode`, so a test can
 * drive runHostTool()'s digest/exit-status handling without depending on
 * real ACME being installed or on constructing a source file that actually
 * triggers the scenario in question. */
/** `dir` also holds the "echoargv" mode's output file (`echoed-argv.json`) --
 * `readEchoedArgv()` below reads it back. */
function echoedArgvPath(dir: string): string {
  return join(dir, "echoed-argv.json");
}

function readEchoedArgv(dir: string): string[] {
  return JSON.parse(readFileSync(echoedArgvPath(dir), "utf8")) as string[];
}

function writeFakeAcme(dir: string, mode: "nonzero" | "zerobyte" | "utf8" | "echoargv"): string {
  const scriptPath = join(dir, "fake-acme.mjs");
  const utf8Text = "héllo wörld 日本語\n";
  const echoPath = echoedArgvPath(dir);
  writeFileSync(
    scriptPath,
    [
      "#!/usr/bin/env node",
      'import { writeFileSync } from "node:fs";',
      "const argv = process.argv.slice(2);",
      'const oIdx = argv.indexOf("-o");',
      "const outPath = oIdx !== -1 ? argv[oIdx + 1] : null;",
      `const mode = ${JSON.stringify(mode)};`,
      `const echoPath = ${JSON.stringify(echoPath)};`,
      'if (mode === "nonzero") {',
      '  process.stderr.write("fake acme: simulated compile error\\n");',
      "  process.exit(1);",
      "}",
      'if (mode === "zerobyte") {',
      "  if (outPath) writeFileSync(outPath, Buffer.alloc(0));",
      "  process.exit(0);",
      "}",
      'if (mode === "utf8") {',
      `  if (outPath) writeFileSync(outPath, ${JSON.stringify(utf8Text)}, "utf8");`,
      "  process.exit(0);",
      "}",
      // 34-07 (CR-03): echoes the FULL argv this invocation received to
      // `echoPath`, so a test can assert on what an include flag's value
      // actually was -- runHostTool()'s own response shape never surfaces
      // argv, only the digested outputs.
      'if (mode === "echoargv") {',
      "  writeFileSync(echoPath, JSON.stringify(argv));",
      "  if (outPath) writeFileSync(outPath, Buffer.alloc(0));",
      "  process.exit(0);",
      "}",
      "process.exit(0);",
      "",
    ].join("\n"),
    "utf8",
  );
  chmodSync(scriptPath, 0o755);
  return scriptPath;
}

// ---------------------------------------------------------------------------
// normaliseHostToolRequest -- empty/null/malformed inputs (edge: empty)
// ---------------------------------------------------------------------------

test("normaliseHostToolRequest(null) is refused, naming the accepted shape", () => {
  const result = normaliseHostToolRequest(null);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /tool/);
});

test("normaliseHostToolRequest(undefined) is refused, naming the accepted shape", () => {
  const result = normaliseHostToolRequest(undefined);
  assert.equal(result.ok, false);
});

test("normaliseHostToolRequest({}) is refused, naming the accepted shape", () => {
  const result = normaliseHostToolRequest({});
  assert.equal(result.ok, false);
});

test("normaliseHostToolRequest([]) is refused -- an array is not a plain object", () => {
  const result = normaliseHostToolRequest([]);
  assert.equal(result.ok, false);
});

test('normaliseHostToolRequest({ tool: "" }) is refused', () => {
  const result = normaliseHostToolRequest({ tool: "" });
  assert.equal(result.ok, false);
});

test("normaliseHostToolRequest({ tool: 42 }) is refused -- never coerced to a string", () => {
  const result = normaliseHostToolRequest({ tool: 42 });
  assert.equal(result.ok, false);
});

// ---------------------------------------------------------------------------
// Exact, case-sensitive tool-id matching (edge: adjacency)
// ---------------------------------------------------------------------------

test('normaliseHostToolRequest({ tool: "ACME.BUILD" }) is refused -- exact case-sensitive match, no merge', () => {
  const result = normaliseHostToolRequest({ tool: "ACME.BUILD", args: { source: "a.a" } });
  assert.equal(result.ok, false);
});

test('normaliseHostToolRequest({ tool: "acme.build", args: { source: "a.a" } }) is accepted', () => {
  const result = normaliseHostToolRequest({ tool: "acme.build", args: { source: "a.a" } });
  assert.equal(result.ok, true);
});

// ---------------------------------------------------------------------------
// Prototype-pollution-shaped tool ids refused by name (T-34-04)
// ---------------------------------------------------------------------------

test('normaliseHostToolRequest({ tool: "__proto__" }) is refused', () => {
  const result = normaliseHostToolRequest({ tool: "__proto__" });
  assert.equal(result.ok, false);
});

test('normaliseHostToolRequest({ tool: "constructor" }) is refused', () => {
  const result = normaliseHostToolRequest({ tool: "constructor" });
  assert.equal(result.ok, false);
});

test('normaliseHostToolRequest({ tool: "toString" }) is refused', () => {
  const result = normaliseHostToolRequest({ tool: "toString" });
  assert.equal(result.ok, false);
});

// ---------------------------------------------------------------------------
// Unknown / wrong-typed args -- refused BY NAME, never coerced, never dropped
// ---------------------------------------------------------------------------

test("an unknown args key is refused BY NAME, never dropped", () => {
  const result = normaliseHostToolRequest({ tool: "acme.build", args: { source: "a.a", bogusKey: "x" } });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /bogusKey/);
});

test('a wrong-typed known key (noReport: "yes") is refused, never coerced to a boolean', () => {
  const result = normaliseHostToolRequest({ tool: "acme.build", args: { source: "a.a", noReport: "yes" } });
  assert.equal(result.ok, false);
});

test('a wrong-typed known key (defines: "X" where an array is required) is refused, never coerced', () => {
  const result = normaliseHostToolRequest({ tool: "acme.build", args: { source: "a.a", defines: "X" } });
  assert.equal(result.ok, false);
});

// ---------------------------------------------------------------------------
// resolveWorkspacePath -- absolute / escaping / plain in-root paths
// ---------------------------------------------------------------------------

test("resolveWorkspacePath refuses an absolute input", () => {
  const result = resolveWorkspacePath("/repo", "/etc/passwd");
  assert.equal(result.ok, false);
});

test("resolveWorkspacePath refuses an input that escapes the root via parent-directory segments", () => {
  const result = resolveWorkspacePath("/repo/sub", "../../etc/passwd");
  assert.equal(result.ok, false);
});

test("resolveWorkspacePath accepts a plain in-root relative path", () => {
  const result = resolveWorkspacePath("/repo", "src/a.a");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.path, join("/repo", "src", "a.a"));
});

// ---------------------------------------------------------------------------
// buildHostToolArgv -- deterministic, ordered (edge: ordering)
// ---------------------------------------------------------------------------

test("buildHostToolArgv is deterministic: the same request and resolved paths yield two deepEqual argv arrays", () => {
  const request = { tool: "acme.build", args: { source: "a.a", format: "cbm", defines: ["FOO", "BAR"], includes: ["inc1", "inc2"] } };
  const resolved = { sourcePath: "/repo/a.a", outDirPath: "/repo" };
  const first = buildHostToolArgv(request, resolved);
  const second = buildHostToolArgv(request, resolved);
  assert.deepEqual(first, second);
});

test("buildHostToolArgv orders fixed flags first, then repeated defines/includes in caller-given order, then the source path last", () => {
  const request = { tool: "acme.build", args: { source: "a.a", format: "cbm", defines: ["FOO", "BAR"], includes: ["inc1", "inc2"] } };
  // 34-07 (CR-03): includes now flow through resolved.includePaths only --
  // never through request.args.includes -- so the resolved paths below,
  // NOT the raw wire strings "inc1"/"inc2", are what the argv must carry.
  const resolved = { sourcePath: "/repo/a.a", outDirPath: "/repo", includePaths: ["/repo/inc1", "/repo/inc2"] };
  const built = buildHostToolArgv(request, resolved);
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.deepEqual(built.argv.slice(0, 8), ["--cpu", "6510", "-f", "cbm", "-Wtype-mismatch", "--strict-segments", "--msvc", "-v1"]);
  assert.equal(built.argv[built.argv.length - 1], "/repo/a.a");
  const defineFooIdx = built.argv.indexOf("-DFOO");
  const defineBarIdx = built.argv.indexOf("-DBAR");
  assert.ok(defineFooIdx !== -1 && defineBarIdx !== -1 && defineFooIdx < defineBarIdx, "defines must appear in caller-given order");
  const include1Idx = built.argv.indexOf("/repo/inc1");
  const include2Idx = built.argv.indexOf("/repo/inc2");
  assert.ok(include1Idx !== -1 && include2Idx !== -1 && include1Idx < include2Idx, "includes must appear in caller-given order, as the RESOLVED paths");
  assert.ok(!built.argv.includes("inc1") && !built.argv.includes("inc2"), "argv must never carry the raw wire include strings");
});

// ---------------------------------------------------------------------------
// acme.build `includes` -- resolved through resolveWorkspacePath() by
// runHostTool(), read by buildHostToolArgv() ONLY from resolved.includePaths
// (Task 1, CR-03).
// ---------------------------------------------------------------------------

test("buildHostToolArgv's acme.build branch reads includes from resolved.includePaths, never from request.args.includes -- proven by a case where they disagree", () => {
  const request = { tool: "acme.build", args: { source: "a.a", includes: ["wire-inc-1", "wire-inc-2"] } };
  const resolved = { sourcePath: "/repo/a.a", outDirPath: "/repo", includePaths: ["/repo/resolved-inc-1", "/repo/resolved-inc-2"] };
  const built = buildHostToolArgv(request, resolved);
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.ok(built.argv.includes("/repo/resolved-inc-1"));
  assert.ok(built.argv.includes("/repo/resolved-inc-2"));
  assert.ok(!built.argv.includes("wire-inc-1"));
  assert.ok(!built.argv.includes("wire-inc-2"));
});

test("buildHostToolArgv: includePaths: [] and an absent includePaths key both produce deepEqual argv arrays, with no -I flag in either", () => {
  const request = { tool: "acme.build", args: { source: "a.a" } };
  const resolvedWithEmptyArray = { sourcePath: "/repo/a.a", outDirPath: "/repo", includePaths: [] as string[] };
  const resolvedWithoutKey = { sourcePath: "/repo/a.a", outDirPath: "/repo" };
  const builtEmptyArray = buildHostToolArgv(request, resolvedWithEmptyArray);
  const builtAbsentKey = buildHostToolArgv(request, resolvedWithoutKey);
  assert.deepEqual(builtEmptyArray, builtAbsentKey);
  assert.equal(builtEmptyArray.ok, true);
  if (builtEmptyArray.ok) assert.ok(!builtEmptyArray.argv.includes("-I"));
});

test("runHostTool: an acme.build request whose includes contains an escaping entry is refused with the workspace-escape message, and the log spy recorded zero lines", async () => {
  await withTempDir(async (dir) => {
    writeFileSync(join(dir, "a.a"), "; test source\n", "utf8");
    const logLines: string[] = [];
    const response = await runHostTool(
      { tool: "acme.build", args: { source: "a.a", includes: ["../outside"] } },
      { repoRoot: dir, log: (line) => logLines.push(line) },
    );
    assert.equal(response.ok, false);
    if (!response.ok) assert.match(response.message, /escapes the workspace root/);
    assert.equal(logLines.length, 0, "no child was spawned, so no log line should have been recorded");
  });
});

test("runHostTool: an acme.build request whose includes contains an absolute entry is refused with the not-absolute message", async () => {
  await withTempDir(async (dir) => {
    writeFileSync(join(dir, "a.a"), "; test source\n", "utf8");
    const response = await runHostTool({ tool: "acme.build", args: { source: "a.a", includes: ["/etc"] } }, { repoRoot: dir });
    assert.equal(response.ok, false);
    if (!response.ok) assert.match(response.message, /must be relative to the workspace root, not absolute/);
  });
});

test('runHostTool: an acme.build request whose includes contains "" is refused with the array-of-strings message, never silently skipped', async () => {
  await withTempDir(async (dir) => {
    writeFileSync(join(dir, "a.a"), "; test source\n", "utf8");
    const result = normaliseHostToolRequest({ tool: "acme.build", args: { source: "a.a", includes: [""] } });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /must be an array of strings/);
    const response = await runHostTool({ tool: "acme.build", args: { source: "a.a", includes: [""] } }, { repoRoot: dir });
    assert.equal(response.ok, false);
  });
});

test("runHostTool: an acme.build include of \".\" (resolving EXACTLY to the workspace root) is accepted, and a sibling directory whose name merely begins with the workspace root's own name is REFUSED (adjacency)", async () => {
  await withTempDir(async (dir) => {
    writeFileSync(join(dir, "a.a"), "; test source\n", "utf8");
    const fakeAcme = writeFakeAcme(dir, "zerobyte");
    await withFakeAcme(fakeAcme, async () => {
      const acceptedResponse = await runHostTool({ tool: "acme.build", args: { source: "a.a", includes: ["."], noReport: true } }, { repoRoot: dir });
      assert.equal(acceptedResponse.ok, true);
    });
    const evilSibling = `../${basename(dir)}-evil`;
    const refusedResponse = await runHostTool({ tool: "acme.build", args: { source: "a.a", includes: [evilSibling] } }, { repoRoot: dir });
    assert.equal(refusedResponse.ok, false);
    if (!refusedResponse.ok) assert.match(refusedResponse.message, /escapes the workspace root/);
  });
});

test("runHostTool: an accepted in-workspace acme.build include reaches the spawned argv as an absolute resolved path, never the bare relative string", async () => {
  await withTempDir(async (dir) => {
    mkdirSync(join(dir, "inc"), { recursive: true });
    writeFileSync(join(dir, "a.a"), "; test source\n", "utf8");
    const fakeAcme = writeFakeAcme(dir, "echoargv");
    await withFakeAcme(fakeAcme, async () => {
      const response = await runHostTool({ tool: "acme.build", args: { source: "a.a", includes: ["inc"], noReport: true } }, { repoRoot: dir });
      assert.equal(response.ok, true);
      const echoedArgv = readEchoedArgv(dir);
      const includeFlagIdx = echoedArgv.indexOf("-I");
      assert.ok(includeFlagIdx !== -1);
      const includeValue = echoedArgv[includeFlagIdx + 1];
      assert.ok(isAbsolute(includeValue));
      assert.equal(includeValue, resolvePath(dir, "inc"));
      assert.ok(!echoedArgv.includes("inc"), "argv must never carry the bare relative include string");
    });
  });
});

test("runHostTool: acme.build includes keep caller order in the spawned argv, and two entries resolving to the SAME directory both appear (no dedupe, no reordering)", async () => {
  await withTempDir(async (dir) => {
    mkdirSync(join(dir, "b"), { recursive: true });
    mkdirSync(join(dir, "a"), { recursive: true });
    mkdirSync(join(dir, "inc"), { recursive: true });
    writeFileSync(join(dir, "a.a"), "; test source\n", "utf8");
    const fakeAcme = writeFakeAcme(dir, "echoargv");
    await withFakeAcme(fakeAcme, async () => {
      const orderedResponse = await runHostTool({ tool: "acme.build", args: { source: "a.a", includes: ["b", "a"], noReport: true } }, { repoRoot: dir });
      assert.equal(orderedResponse.ok, true);
      const orderedArgv = readEchoedArgv(dir);
      const bIdx = orderedArgv.indexOf(resolvePath(dir, "b"));
      const aIdx = orderedArgv.indexOf(resolvePath(dir, "a"));
      assert.ok(bIdx !== -1 && aIdx !== -1 && bIdx < aIdx, "resolved 'b' must precede resolved 'a', matching caller order");

      const dupeResponse = await runHostTool({ tool: "acme.build", args: { source: "a.a", includes: ["inc", "inc"], noReport: true } }, { repoRoot: dir });
      assert.equal(dupeResponse.ok, true);
      const dupeArgv = readEchoedArgv(dir);
      const includeFlagCount = dupeArgv.filter((a) => a === "-I").length;
      assert.equal(includeFlagCount, 2, "two equal-resolving includes must both appear -- no dedupe");
    });
  });
});

// ---------------------------------------------------------------------------
// CR-05 (34-10, 34-VERIFICATION.md gap 3): resolveWorkspacePath() is
// symlink-blind against a REAL, on-disk symlink. Four live cases: the
// read-key refusal, the write-key refusal (the reproduced defect was a
// file created OUTSIDE the workspace root, not merely an un-errored call),
// the discriminating follow (an inside-pointing link is accepted and
// resolved to its real location), and the never-throw case (an unreadable
// ancestor refuses rather than throws). None is gated on SKIP_REASON --
// each uses writeFakeAcme/withFakeAcme, so real ACME is never required.
// ---------------------------------------------------------------------------

test("runHostTool: a real symlink planted inside the workspace, pointing outside it, makes an acme.build request whose source is written through the link REFUSED -- read key, live link on disk", async () => {
  await withSymlinkFixture(async (ws, outside) => {
    writeFileSync(join(outside, "seed.a"), "; seeded outside file\n", "utf8");
    symlinkSync(outside, join(ws, "escape"), "dir");
    const logLines: string[] = [];
    const response = await runHostTool(
      { tool: "acme.build", args: { source: "escape/seed.a" } },
      { repoRoot: ws, log: (line) => logLines.push(line) },
    );
    assert.equal(response.ok, false);
    if (!response.ok) assert.match(response.message, /escapes the workspace root/);
    assert.equal(logLines.length, 0, "no child was started");
    assert.deepEqual(readdirSync(outside).sort(), ["seed.a"], "the outside directory's own contents are unchanged -- nothing new was created there");
  });
});

test("runHostTool: the same planted link used as acme.build's outDir is REFUSED, and the outside directory is still empty afterwards -- write key, the reproduced defect was a file created OUTSIDE the workspace root", async () => {
  await withSymlinkFixture(async (ws, outside) => {
    writeFileSync(join(ws, "a.a"), "; test source\n", "utf8");
    symlinkSync(outside, join(ws, "escape"), "dir");
    const response = await runHostTool({ tool: "acme.build", args: { source: "a.a", outDir: "escape" } }, { repoRoot: ws });
    assert.equal(response.ok, false);
    if (!response.ok) assert.match(response.message, /escapes the workspace root/);
    assert.deepEqual(readdirSync(outside), [], "the assertion that carries the finding: outside must still be EMPTY, not merely errored");
  });
});

test("runHostTool: a symlink pointing INSIDE the workspace is FOLLOWED -- the request is accepted and the spawned include is the link's REAL location, not the path as written through the link (discriminating case)", async () => {
  await withSymlinkFixture(async (ws, outside) => {
    void outside;
    mkdirSync(join(ws, "real"), { recursive: true });
    symlinkSync(join(ws, "real"), join(ws, "link"), "dir");
    writeFileSync(join(ws, "a.a"), "; test source\n", "utf8");
    const fakeAcme = writeFakeAcme(ws, "echoargv");
    await withFakeAcme(fakeAcme, async () => {
      const response = await runHostTool({ tool: "acme.build", args: { source: "a.a", includes: ["link"], noReport: true } }, { repoRoot: ws });
      assert.equal(response.ok, true, "the easy wrong fix -- refusing any path containing a link -- fails this case, which is what makes the two refusals above meaningful");
      const echoedArgv = readEchoedArgv(ws);
      const includeFlagIdx = echoedArgv.indexOf("-I");
      assert.ok(includeFlagIdx !== -1);
      assert.equal(echoedArgv[includeFlagIdx + 1], join(ws, "real"));
    });
  });
});

test("resolveWorkspacePath: an unreadable ancestor directory refuses by name rather than throwing (never-throw case)", async () => {
  await withSymlinkFixture(async (ws) => {
    const locked = join(ws, "locked");
    mkdirSync(locked, { recursive: true });
    chmodSync(locked, 0o000);
    try {
      // Non-vacuity pin, exactly as anno-confinement.test.ts:601 does: a run
      // as a user who can read the "locked" directory anyway (e.g. root)
      // must FAIL loudly here rather than pass silently below for the wrong
      // reason.
      assert.throws(() => statSync(join(locked, "x", "a.a")), /EACCES/, "this case measures nothing unless the locked directory is genuinely unreadable by the running user");
      const result = resolveWorkspacePath(ws, "locked/x/a.a");
      assert.equal(result.ok, false);
      if (!result.ok) assert.match(result.message, /locked/);
    } finally {
      chmodSync(locked, 0o755);
    }
    assert.doesNotThrow(() => readdirSync(locked), "the finally must have restored access");
  });
});

// ---------------------------------------------------------------------------
// CR-05 (34-10 Task 2): the edge cases that make the control a control --
// adjacency, empty/degenerate, not-yet-existing ancestors, dangling (three
// ways), cycles (two positions), normalisation, and a cross-implementation
// equivalence table against anno-types.ts's storePathWithinWorkspace(). No
// production code here -- if a case cannot be made to pass, Task 1's walk is
// wrong.
// ---------------------------------------------------------------------------

test("resolveWorkspacePath: adjacency -- \".\" resolves EXACTLY to the realpath'd workspace root, and a REAL sibling directory whose name merely begins with the root's own name is refused", async () => {
  await withSymlinkFixture(async (ws) => {
    const here = resolveWorkspacePath(ws, ".");
    assert.equal(here.ok, true);
    if (here.ok) assert.equal(here.path, ws);

    const evilSibling = join(dirname(ws), `${basename(ws)}-evil`);
    mkdirSync(evilSibling, { recursive: true });
    try {
      const refused = resolveWorkspacePath(ws, `../${basename(ws)}-evil`);
      assert.equal(refused.ok, false);
      if (!refused.ok) assert.match(refused.message, /escapes the workspace root/);
    } finally {
      rmSync(evilSibling, { recursive: true, force: true });
    }
  });
});

test("resolveWorkspacePath: empty and absolute inputs are refused with their existing wordings BEFORE any filesystem access, against a repoRoot that does not exist on disk", () => {
  const nonExistentRoot = join(tmpdir(), "host-tool-does-not-exist-" + process.pid);
  const empty = resolveWorkspacePath(nonExistentRoot, "");
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.match(empty.message, /must be a non-empty relative string/);
  const absolute = resolveWorkspacePath(nonExistentRoot, "/etc/passwd");
  assert.equal(absolute.ok, false);
  if (!absolute.ok) assert.match(absolute.message, /not absolute/);
});

test("resolveWorkspacePath: a candidate several levels below the deepest existing directory is ACCEPTED -- confinement never requires the target to exist", async () => {
  await withSymlinkFixture(async (ws) => {
    const deep = resolveWorkspacePath(ws, "build/out/deep/a.prg");
    assert.equal(deep.ok, true);
    if (deep.ok) assert.equal(deep.path, join(ws, "build", "out", "deep", "a.prg"));
  });
});

test("runHostTool: an acme.build request whose outDir names an uncreated in-workspace directory is still accepted end to end", async () => {
  await withSymlinkFixture(async (ws) => {
    writeFileSync(join(ws, "a.a"), "; test source\n", "utf8");
    const fakeAcme = writeFakeAcme(ws, "zerobyte");
    await withFakeAcme(fakeAcme, async () => {
      const response = await runHostTool({ tool: "acme.build", args: { source: "a.a", outDir: "not/yet/created" } }, { repoRoot: ws });
      assert.equal(response.ok, true);
    });
  });
});

test("resolveWorkspacePath: a dangling LEAF link whose target is outside the workspace is refused (dangling, 1 of 3)", async () => {
  await withSymlinkFixture(async (ws) => {
    symlinkSync(join("..", "outside", "x.a"), join(ws, "dangling-leaf"));
    const leafRefused = resolveWorkspacePath(ws, "dangling-leaf");
    assert.equal(leafRefused.ok, false);
    if (!leafRefused.ok) assert.match(leafRefused.message, /escapes the workspace root/);
  });
});

test("resolveWorkspacePath: a dangling DIRECTORY link whose target (once existing, since removed) was outside the workspace is refused (dangling, 2 of 3)", async () => {
  await withSymlinkFixture(async (ws) => {
    const removedTarget = join(dirname(ws), "removed-outside");
    mkdirSync(removedTarget, { recursive: true });
    symlinkSync(removedTarget, join(ws, "dangling-dir"), "dir");
    rmSync(removedTarget, { recursive: true, force: true });
    const dirRefused = resolveWorkspacePath(ws, "dangling-dir/x.a");
    assert.equal(dirRefused.ok, false);
    if (!dirRefused.ok) assert.match(dirRefused.message, /escapes the workspace root/);
  });
});

test("resolveWorkspacePath: a dangling link whose target is INSIDE the workspace and does not exist yet is ACCEPTED -- discriminates against the over-broad 'refuse whenever the stopping entry is a symlink' fix, which passes the two dangling-outside cases and fails this one (dangling, 3 of 3)", async () => {
  await withSymlinkFixture(async (ws) => {
    symlinkSync(join(ws, "not-yet-created"), join(ws, "dangling-inside"), "dir");
    const insideAccepted = resolveWorkspacePath(ws, "dangling-inside/tail.a");
    assert.equal(insideAccepted.ok, true, "a dangling link pointing INSIDE the workspace must be accepted, or the fix is over-broad");
  });
});

test("resolveWorkspacePath: a symlink cycle in the LEAF position refuses, naming the hop bound (cycle, 1 of 2)", async () => {
  await withSymlinkFixture(async (ws) => {
    symlinkSync(join(ws, "b"), join(ws, "a"));
    symlinkSync(join(ws, "a"), join(ws, "b"));
    const leafCycle = resolveWorkspacePath(ws, "a");
    assert.equal(leafCycle.ok, false);
    if (!leafCycle.ok) {
      assert.match(leafCycle.message, /40/);
      assert.match(leafCycle.message, /hops/);
    }
  });
});

test("resolveWorkspacePath: a symlink cycle in an ANCESTOR position also refuses -- by the KERNEL's own ELOOP surfaced through the walk's refusal path, a different route through the same function than the manual hop counter (cycle, 2 of 2)", async () => {
  await withSymlinkFixture(async (ws) => {
    symlinkSync(join(ws, "b"), join(ws, "a"));
    symlinkSync(join(ws, "a"), join(ws, "b"));
    const ancestorCycle = resolveWorkspacePath(ws, "a/child/x.a");
    assert.equal(ancestorCycle.ok, false, "an ancestor-position cycle must also refuse -- a different route through the same function");
  });
});

test("resolveWorkspacePath: redundant separators, \".\" and \"..\" segments all resolve to the ONE accepted real path a canonical spelling would", async () => {
  await withSymlinkFixture(async (ws) => {
    mkdirSync(join(ws, "sub"), { recursive: true });
    const canonical = resolveWorkspacePath(ws, "sub/x");
    assert.equal(canonical.ok, true);
    for (const spelling of ["sub/./x", "./sub/x", "other/../sub/x"]) {
      const result = resolveWorkspacePath(ws, spelling);
      assert.equal(result.ok, true, `spelling ${JSON.stringify(spelling)} must be accepted`);
      if (result.ok && canonical.ok) assert.equal(result.path, canonical.path, `spelling ${JSON.stringify(spelling)} must resolve to the same real path as the canonical spelling`);
    }
    const trailingSlash = resolveWorkspacePath(ws, "sub/");
    const noTrailingSlash = resolveWorkspacePath(ws, "sub");
    assert.equal(trailingSlash.ok, true);
    assert.equal(noTrailingSlash.ok, true);
    if (trailingSlash.ok && noTrailingSlash.ok) assert.equal(trailingSlash.path, noTrailingSlash.path);
    // Residual, not a covered case: the comparison is byte-wise and applies
    // no Unicode normalisation, so two spellings differing only in
    // normalisation form are two distinct paths here -- the same residual
    // anno-confinement.test.ts records for the same comparison. Not
    // assertable without a filesystem that normalises on its own.
  });
});

test("resolveWorkspacePath and anno-types.ts's storePathWithinWorkspace() agree: refusal for refusal, acceptance for acceptance, and identical resolved paths where both accept (equivalence table, A-15)", async () => {
  await withSymlinkFixture(async (ws) => {
    mkdirSync(join(ws, "sub"), { recursive: true });
    symlinkSync(join(ws, "sub"), join(ws, "inside-link"), "dir");
    const outsideDir = join(dirname(ws), "equiv-outside");
    mkdirSync(outsideDir, { recursive: true });
    try {
      symlinkSync(outsideDir, join(ws, "outside-link"), "dir");
      symlinkSync(join("..", "equiv-outside", "missing"), join(ws, "dangling-outside-link"));
      symlinkSync(join(ws, "missing-inside"), join(ws, "dangling-inside-link"), "dir");
      symlinkSync(join(ws, "cycle-b"), join(ws, "cycle-a"));
      symlinkSync(join(ws, "cycle-a"), join(ws, "cycle-b"));

      // Scope of the claimed equivalence, stated precisely: this covers the
      // CONFINEMENT VERDICT and the RESOLVED PATH for a relative-derived
      // candidate, and deliberately NOT the input-validation layer --
      // resolveWorkspacePath refuses "" and an absolute path where
      // storePathWithinWorkspace has no such contract, so those two are not
      // in this table.
      const table: string[] = [
        "sub/x.a",
        "inside-link/x.a",
        "outside-link/x.a",
        "dangling-outside-link",
        "dangling-inside-link/x.a",
        "cycle-a",
        ".",
        "build/not/yet/created/x.a",
      ];
      assert.ok(table.length >= 8, "the table must have at least 8 rows");

      let executedComparisons = 0;
      for (const rel of table) {
        const seamResult = resolveWorkspacePath(ws, rel);
        let annoAccepted: string | null = null;
        let annoThrew = false;
        try {
          annoAccepted = storePathWithinWorkspace(join(ws, rel), ws);
        } catch (e) {
          assert.ok(e instanceof AnnoStorePathError, `anno-types.ts's confinement must throw AnnoStorePathError for row ${JSON.stringify(rel)}, got ${(e as Error).constructor.name}`);
          annoThrew = true;
        }
        executedComparisons += 1;
        assert.equal(seamResult.ok, !annoThrew, `verdict must agree for row ${JSON.stringify(rel)}: resolveWorkspacePath ok=${seamResult.ok}, storePathWithinWorkspace threw=${annoThrew}`);
        if (seamResult.ok && !annoThrew) {
          assert.equal(seamResult.path, annoAccepted, `resolved path must agree for row ${JSON.stringify(rel)}`);
        }
      }
      assert.equal(executedComparisons, table.length, "a short-circuited loop must not pass silently");
    } finally {
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });
});

test(
  "END TO END: an acme.build request whose includes escapes the workspace root is refused at the container-side caller with ok: false, over the real control-plane route, with all seven VICE callbacks provably uncalled -- no skip option, since nothing is ever spawned",
  async () => {
    await withTempDir(async (dir) => {
      writeFileSync(join(dir, "a.a"), "!cpu 6510\n* = $0801\nlda #$01\nsta $d020\nrts\n", "utf8");
      const { listener, token, spies } = await startListenerWithSpies(dir);
      try {
        const stateDir = mkdtempSync(join(tmpdir(), "host-tool-broker-json-"));
        try {
          writeFileSync(brokerJsonPath(stateDir), JSON.stringify({ control_host: "127.0.0.1", control_port: listener.port, control_token: token }));
          const response = await hostToolOverControlPlane(stateDir, "acme.build", { source: "a.a", includes: ["../outside"] });
          assert.equal(response.ok, false);
          assertAllSpiesEmpty(spies);
        } finally {
          rmSync(stateDir, { recursive: true, force: true });
        }
      } finally {
        listener.server.close();
      }
    });
  },
);

// ---------------------------------------------------------------------------
// runHostTool -- exit status, zero-byte digest, byte-vs-character length
// ---------------------------------------------------------------------------

test("runHostTool against a tool that exits non-zero resolves (never rejects) with the non-zero exitStatus reported", async () => {
  await withTempDir(async (dir) => {
    writeFileSync(join(dir, "a.a"), "; test source\n", "utf8");
    const fakeAcme = writeFakeAcme(dir, "nonzero");
    await withFakeAcme(fakeAcme, async () => {
      const response = await runHostTool({ tool: "acme.build", args: { source: "a.a" } }, { repoRoot: dir });
      assert.equal(response.ok, true);
      if (!response.ok) return;
      assert.equal(response.exitStatus, 1);
      assert.deepEqual(response.results, []);
    });
  });
});

test("runHostTool against a zero-byte output file reports byteLength: 0 and the sha256 of the empty byte string", async () => {
  await withTempDir(async (dir) => {
    writeFileSync(join(dir, "a.a"), "; test source\n", "utf8");
    const fakeAcme = writeFakeAcme(dir, "zerobyte");
    await withFakeAcme(fakeAcme, async () => {
      const response = await runHostTool({ tool: "acme.build", args: { source: "a.a" } }, { repoRoot: dir });
      assert.equal(response.ok, true);
      if (!response.ok) return;
      assert.equal(response.results.length, 1);
      assert.equal(response.results[0].byteLength, 0);
      assert.equal(response.results[0].sha256, createHash("sha256").update(Buffer.alloc(0)).digest("hex"));
    });
  });
});

test("runHostTool's byteLength equals what statSync reports for a file with multi-byte UTF-8 sequences -- a byte count, not a character count", async () => {
  await withTempDir(async (dir) => {
    writeFileSync(join(dir, "a.a"), "; test source\n", "utf8");
    const fakeAcme = writeFakeAcme(dir, "utf8");
    await withFakeAcme(fakeAcme, async () => {
      const response = await runHostTool({ tool: "acme.build", args: { source: "a.a" } }, { repoRoot: dir });
      assert.equal(response.ok, true);
      if (!response.ok) return;
      assert.equal(response.results.length, 1);
      const stat = statSync(response.results[0].path);
      assert.equal(response.results[0].byteLength, stat.size);
      // "héllo wörld 日本語\n" has fewer UTF-16 code units
      // than UTF-8 bytes -- proving byteLength tracks the byte count, not
      // JS's own (UTF-16 code-unit) string .length.
      const utf8Text = "héllo wörld 日本語\n";
      assert.notEqual(stat.size, utf8Text.length);
    });
  });
});

// ---------------------------------------------------------------------------
// End-to-end: a real control-plane round trip, all seven VICE callbacks
// provably uncalled (SEAM-01). Skipped with a named reason when ACME is
// absent; hard-fails under VICE_REQUIRE_ACME via the always-runs gate above.
// ---------------------------------------------------------------------------

interface CallbackSpies {
  onAcquire: unknown[];
  onRelease: unknown[];
  onRecycle: unknown[];
  onStatus: unknown[];
  onHostState: unknown[];
  onMonitorClaim: unknown[];
  onMonitorRelease: unknown[];
}

async function startListenerWithSpies(repoRootForHostTool: string): Promise<{ listener: StartControlListenerResult; token: string; spies: CallbackSpies }> {
  const spies: CallbackSpies = { onAcquire: [], onRelease: [], onRecycle: [], onStatus: [], onHostState: [], onMonitorClaim: [], onMonitorRelease: [] };
  const token = "host-tool-test-token";
  const listener = await startControlListener({
    host: "127.0.0.1",
    port: 0,
    token,
    onAcquire: async (): Promise<AcquireOutcome> => {
      spies.onAcquire.push(true);
      return { ok: false, reason: "internal" };
    },
    onRelease: (): void => {
      spies.onRelease.push(true);
    },
    onRecycle: async (): Promise<RecycleOutcome> => {
      spies.onRecycle.push(true);
      return { port: null, pid: null, viceBin: null, killStage: "no_signal", epochBefore: null, outcome: "grant_lookup_failed", reason: "spy" };
    },
    onStatus: (): StatusInstanceEntry[] => {
      spies.onStatus.push(true);
      return [];
    },
    onHostState: (): HostStateFields => {
      spies.onHostState.push(true);
      return { pid: process.pid, startedAt: "2026-01-01T00:00:00Z", nodeVersion: process.version, viceBin: "x64sc", warmFloor: 1, maxInstances: 1, basePort: 6600, backend: "fork" };
    },
    onMonitorClaim: (): MonitorClaimOutcome => {
      spies.onMonitorClaim.push(true);
      return { ok: false, code: "internal" };
    },
    onMonitorRelease: (): MonitorReleaseOutcome => {
      spies.onMonitorRelease.push(true);
      return { ok: false, code: "internal" };
    },
    onHostTool: (raw: unknown) => runHostTool(raw, { repoRoot: repoRootForHostTool }),
  });
  return { listener, token, spies };
}

function assertAllSpiesEmpty(spies: CallbackSpies): void {
  for (const [name, calls] of Object.entries(spies)) {
    assert.equal(calls.length, 0, `${name} must never be called by a host_tool request -- it recorded ${calls.length} call(s)`);
  }
}

test(
  "END TO END: a real control-plane round trip assembles a real source file with real ACME and returns a response whose sha256 matches an independent digest of the produced .prg, with all seven VICE callbacks provably uncalled",
  { skip: SKIP_REASON },
  async () => {
    await withTempDir(async (dir) => {
      writeFileSync(join(dir, "a.a"), "!cpu 6510\n* = $0801\nlda #$01\nsta $d020\nrts\n", "utf8");
      const { listener, token, spies } = await startListenerWithSpies(dir);
      try {
        const stateDir = mkdtempSync(join(tmpdir(), "host-tool-broker-json-"));
        try {
          writeFileSync(brokerJsonPath(stateDir), JSON.stringify({ control_host: "127.0.0.1", control_port: listener.port, control_token: token }));
          const response = await hostToolOverControlPlane(stateDir, "acme.build", { source: "a.a", noReport: true });
          assert.equal(response.ok, true);
          if (!response.ok) return;
          assert.equal(response.results.length, 1);
          const producedBytes = statSync(response.results[0].path);
          assert.ok(producedBytes.size > 0);
          const independentSha256 = createHash("sha256")
            .update(readFileSync(response.results[0].path))
            .digest("hex");
          assert.equal(response.results[0].sha256, independentSha256);
          assertAllSpiesEmpty(spies);
        } finally {
          rmSync(stateDir, { recursive: true, force: true });
        }
      } finally {
        listener.server.close();
      }
    });
  },
);

test(
  "two overlapping host_tool requests on the same listener both resolve, write to distinct output paths, and leave all seven VICE-callback spies at zero calls",
  { skip: SKIP_REASON },
  async () => {
    await withTempDir(async (dir) => {
      writeFileSync(join(dir, "a.a"), "!cpu 6510\n* = $0801\nlda #$01\nsta $d020\nrts\n", "utf8");
      writeFileSync(join(dir, "b.a"), "!cpu 6510\n* = $0801\nlda #$02\nsta $d021\nrts\n", "utf8");
      const { listener, token, spies } = await startListenerWithSpies(dir);
      try {
        const stateDir = mkdtempSync(join(tmpdir(), "host-tool-broker-json-"));
        try {
          writeFileSync(brokerJsonPath(stateDir), JSON.stringify({ control_host: "127.0.0.1", control_port: listener.port, control_token: token }));
          const [responseA, responseB] = await Promise.all([
            hostToolOverControlPlane(stateDir, "acme.build", { source: "a.a", noReport: true }),
            hostToolOverControlPlane(stateDir, "acme.build", { source: "b.a", noReport: true }),
          ]);
          assert.equal(responseA.ok, true);
          assert.equal(responseB.ok, true);
          if (!responseA.ok || !responseB.ok) return;
          assert.equal(responseA.results.length, 1);
          assert.equal(responseB.results.length, 1);
          assert.notEqual(responseA.results[0].path, responseB.results[0].path);
          assertAllSpiesEmpty(spies);
        } finally {
          rmSync(stateDir, { recursive: true, force: true });
        }
      } finally {
        listener.server.close();
      }
    });
  },
);

// ---------------------------------------------------------------------------
// ghidra.analyze -- the second HOST_TOOL_IDS entry (SEAM-04, plan 34-03).
// Reaches the dot-segment rule and the per-run project location through
// ghidra-project.mjs, never a copy in host-tool.mts itself.
// ---------------------------------------------------------------------------

/** Temporarily overrides GHIDRA_HOME and creates a fake, non-executed
 * `support/analyzeHeadless` file inside it (buildHostToolArgv() only checks
 * existsSync -- it never spawns), so the argv-construction case below runs
 * with no real Ghidra installation present. Restored/removed in `finally`
 * regardless of outcome.
 *
 * 34-09 (CR-04): `opts.sleepSeconds`, when given, makes the fake launcher
 * sleep that many seconds before exiting zero -- the slow variant this
 * plan's END-TO-END and kill-on-expiry cases both need. Omitted (the
 * default), the launcher exits immediately exactly as before -- every
 * pre-existing Ghidra case is unaffected. */
async function withFakeGhidraHome<T>(fn: (ghidraHome: string) => Promise<T> | T, opts: { sleepSeconds?: number } = {}): Promise<T> {
  const previous = process.env.GHIDRA_HOME;
  return withTempDir(async (dir) => {
    const supportDir = join(dir, "support");
    mkdirSync(supportDir, { recursive: true });
    // `exec sleep N` -- NOT `sleep N; exit 0` -- replaces the shell's own
    // process image with `sleep` (execve, no fork) rather than forking a
    // CHILD of the shell to run it. A forked grandchild would inherit the
    // SAME stdout/stderr pipe file descriptors spawnHostTool() reads; on
    // kill-on-expiry, SIGKILL only reaches the immediate child (the shell)
    // -- the orphaned `sleep` grandchild would keep those pipe fds open
    // until its own natural exit, delaying node's "close" event for the
    // full sleep regardless of the kill. `exec` makes the killed process
    // and the sleeping process the SAME pid, so SIGKILL actually terminates
    // the sleep promptly (observed live while writing the kill-on-expiry
    // case below -- the naive `sleep N; exit 0` form measured a ~6s "kill").
    const launcherBody = opts.sleepSeconds ? `#!/bin/sh\nexec sleep ${opts.sleepSeconds}\n` : "#!/bin/sh\nexit 0\n";
    writeFileSync(join(supportDir, "analyzeHeadless"), launcherBody, "utf8");
    chmodSync(join(supportDir, "analyzeHeadless"), 0o755);
    process.env.GHIDRA_HOME = dir;
    try {
      return await fn(dir);
    } finally {
      if (previous === undefined) delete process.env.GHIDRA_HOME;
      else process.env.GHIDRA_HOME = previous;
    }
  });
}

test('normaliseHostToolRequest({ tool: "ghidra.analyze", args: { runId: "r1", importPath: "x.bin", bogusKey: "x" } }) is refused BY NAME, never dropped', () => {
  const result = normaliseHostToolRequest({ tool: "ghidra.analyze", args: { runId: "r1", importPath: "x.bin", bogusKey: "x" } });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /bogusKey/);
});

test('normaliseHostToolRequest({ tool: "ghidra.analyze", args: { runId: "r1", importPath: "x.bin" } }) is accepted', () => {
  const result = normaliseHostToolRequest({ tool: "ghidra.analyze", args: { runId: "r1", importPath: "x.bin" } });
  assert.equal(result.ok, true);
});

test("runHostTool: a ghidra.analyze runId that escapes via a path separator is refused", async () => {
  await withTempDir(async (dir) => {
    writeFileSync(join(dir, "x.bin"), "tiny\n", "utf8");
    const response = await runHostTool({ tool: "ghidra.analyze", args: { runId: "a/b", importPath: "x.bin" } }, { repoRoot: dir });
    assert.equal(response.ok, false);
  });
});

test("runHostTool: a dot-prefixed repoRoot is refused for ghidra.analyze, naming the offending segment", async () => {
  await withTempDir(async (dir) => {
    const dottedRepoRoot = join(dir, ".vice-supervisor", "nested");
    mkdirSync(dottedRepoRoot, { recursive: true });
    writeFileSync(join(dottedRepoRoot, "x.bin"), "tiny\n", "utf8");
    const response = await runHostTool({ tool: "ghidra.analyze", args: { runId: "r1", importPath: "x.bin" } }, { repoRoot: dottedRepoRoot });
    assert.equal(response.ok, false);
    if (!response.ok) assert.match(response.message, /\.vice-supervisor/);
  });
});

test("runHostTool: ghidra.analyze with GHIDRA_HOME unset is refused by name, never attempting a launch", async () => {
  const previous = process.env.GHIDRA_HOME;
  delete process.env.GHIDRA_HOME;
  try {
    await withTempDir(async (dir) => {
      writeFileSync(join(dir, "x.bin"), "tiny\n", "utf8");
      const response = await runHostTool({ tool: "ghidra.analyze", args: { runId: "r1", importPath: "x.bin" } }, { repoRoot: dir });
      assert.equal(response.ok, false);
      if (!response.ok) assert.match(response.message, /GHIDRA_HOME/);
    });
  } finally {
    if (previous === undefined) delete process.env.GHIDRA_HOME;
    else process.env.GHIDRA_HOME = previous;
  }
});

test("buildHostToolArgv: a well-formed ghidra.analyze request produces an argv whose first two elements are the project location and project name and which contains -deleteProject", async () => {
  await withFakeGhidraHome(async () => {
    const request = { tool: "ghidra.analyze", args: { runId: "r1", importPath: "x.bin" } };
    const resolved = { importPath: "/repo/tools/ghidra-runs/r1/x.bin", projectLocation: "/repo/tools/ghidra-runs/r1", projectName: "r1" };
    const built = buildHostToolArgv(request, resolved);
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.equal(built.argv[0], "/repo/tools/ghidra-runs/r1");
    assert.equal(built.argv[1], "r1");
    assert.ok(built.argv.includes("-deleteProject"));
    assert.ok(built.toolPath.endsWith(join("support", "analyzeHeadless")));
  });
});

// ---------------------------------------------------------------------------
// 34-09 (CR-04): the round trip that could not complete before this plan --
// a ghidra.analyze invocation whose tool outlives the TCP-connect budget,
// observed completing over the REAL control-plane route, plus the
// kill-on-expiry backstop that proves raising the budget never removed the
// bound.
// ---------------------------------------------------------------------------

test(
  "END TO END (slow): a ghidra.analyze request whose fake launcher sleeps longer than the connect-timeout constant resolves ok:true over the real control-plane route, with all seven VICE callbacks provably uncalled",
  async () => {
    await withTempDir(async (dir) => {
      writeFileSync(join(dir, "x.bin"), "tiny\n", "utf8");
      const { listener, token, spies } = await startListenerWithSpies(dir);
      try {
        await withFakeGhidraHome(
          async () => {
            const stateDir = mkdtempSync(join(tmpdir(), "host-tool-broker-json-"));
            try {
              writeFileSync(brokerJsonPath(stateDir), JSON.stringify({ control_host: "127.0.0.1", control_port: listener.port, control_token: token }));
              const startedAt = Date.now();
              const response = await hostToolOverControlPlane(stateDir, "ghidra.analyze", { runId: "slow-e2e-run", importPath: "x.bin" });
              const elapsedMs = Date.now() - startedAt;
              assert.equal(response.ok, true, response.ok ? "" : (response as { ok: false; message: string }).message);
              // The exact round trip that could not complete before this
              // plan: the fake launcher sleeps 6s, comfortably longer than
              // CONTROL_CONNECT_TIMEOUT_MS (5000ms) -- a measured elapsed
              // time above that constant is proof the connect timer was
              // cleared and replaced by the larger request-deadline timer,
              // not merely reasoned about.
              assert.ok(elapsedMs > CONTROL_CONNECT_TIMEOUT_MS, `expected elapsed (${elapsedMs}ms) to exceed the connect-timeout constant (${CONTROL_CONNECT_TIMEOUT_MS}ms)`);
              assertAllSpiesEmpty(spies);
            } finally {
              rmSync(stateDir, { recursive: true, force: true });
            }
          },
          { sleepSeconds: 6 },
        );
      } finally {
        listener.server.close();
      }
    });
  },
);

test("runHostTool: a slow ghidra.analyze launcher killed on expiry names the small budget it was given, and returns well under the launcher's own sleep", async () => {
  await withFakeGhidraHome(
    async (ghidraHome) => {
      await withTempDir(async (dir) => {
        writeFileSync(join(dir, "x.bin"), "tiny\n", "utf8");
        const startedAt = Date.now();
        const response = await runHostTool(
          { tool: "ghidra.analyze", args: { runId: "kill-on-expiry-run", importPath: "x.bin" } },
          { repoRoot: dir, timeoutMs: 500 },
        );
        const elapsedMs = Date.now() - startedAt;
        assert.equal(response.ok, false);
        if (!response.ok) assert.match(response.message, /500/, `expected the refusal to name the 500ms budget it was given; got: ${response.message}`);
        assert.ok(elapsedMs < 3000, `expected a prompt kill well under the launcher's 6s sleep; took ${elapsedMs}ms (GHIDRA_HOME=${ghidraHome})`);
      });
    },
    { sleepSeconds: 6 },
  );
});

test("hostToolOverControlPlane rejects with a connect-phase message naming the connect-timeout constant when nothing accepts the connection within it", async () => {
  const stateDir = mkdtempSync(join(tmpdir(), "host-tool-connect-timeout-"));
  // 10.255.255.1 is a private-range address with no route configured in
  // this sandbox -- the TCP handshake never completes and never errors, so
  // the connect TIMER (not the socket "error" handler) is what settles this
  // promise. Empirically confirmed to hang (not fail fast) in this
  // environment before this test was written.
  const previousDialHost = process.env.VICE_BROKER_CONTROL_DIAL_HOST;
  process.env.VICE_BROKER_CONTROL_DIAL_HOST = "10.255.255.1";
  try {
    writeFileSync(brokerJsonPath(stateDir), JSON.stringify({ control_host: "10.255.255.1", control_port: 65000, control_token: "unused" }));
    const startedAt = Date.now();
    await assert.rejects(hostToolOverControlPlane(stateDir, "acme.build", { source: "a.a", noReport: true }), (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /connect phase/);
      assert.match(err.message, new RegExp(String(CONTROL_CONNECT_TIMEOUT_MS)));
      return true;
    });
    const elapsedMs = Date.now() - startedAt;
    assert.ok(elapsedMs >= CONTROL_CONNECT_TIMEOUT_MS, `expected at least ${CONTROL_CONNECT_TIMEOUT_MS}ms, took ${elapsedMs}ms`);
  } finally {
    if (previousDialHost === undefined) delete process.env.VICE_BROKER_CONTROL_DIAL_HOST;
    else process.env.VICE_BROKER_CONTROL_DIAL_HOST = previousDialHost;
    rmSync(stateDir, { recursive: true, force: true });
  }
});

test("host-tool-client.ts's connect-phase and request-deadline rejection messages are textually distinct, each naming its own budget", () => {
  const source = readFileSync(new URL("./host-tool-client.ts", import.meta.url), "utf8");
  assert.match(source, /no connection within \$\{CONTROL_CONNECT_TIMEOUT_MS\}ms \(connect phase\)/);
  assert.match(source, /no response within \$\{requestTimeoutMs\}ms \(request deadline\)/);
});

test("hostToolRequestTimeoutMs: every tool id's client request deadline is a positive finite number", () => {
  for (const tool of HOST_TOOL_IDS) {
    const ms = hostToolRequestTimeoutMs(tool);
    assert.ok(Number.isFinite(ms) && ms > 0, `${tool}: expected a positive finite request deadline, got ${ms}`);
  }
});

// ---------------------------------------------------------------------------
// ghidra.analyze `preScript`/`postScript` -- resolved through
// resolveWorkspacePath() by runHostTool(), read by buildHostToolArgv() ONLY
// from resolved.preScriptPath/postScriptPath (Task 2, CR-02).
// ---------------------------------------------------------------------------

test("buildHostToolArgv: ghidra.analyze reads preScript/postScript from resolved.preScriptPath/postScriptPath, never from request.args -- proven by a case where they disagree", async () => {
  await withFakeGhidraHome(async () => {
    const request = {
      tool: "ghidra.analyze",
      args: { runId: "r1", importPath: "x.bin", preScript: "wire-pre.java", postScript: "wire-post.java" },
    };
    const resolved = {
      importPath: "/repo/tools/ghidra-runs/r1/x.bin",
      projectLocation: "/repo/tools/ghidra-runs/r1",
      projectName: "r1",
      preScriptPath: "/repo/some/resolved-pre.java",
      postScriptPath: "/repo/some/resolved-post.java",
    };
    const built = buildHostToolArgv(request, resolved);
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.ok(built.argv.includes("/repo/some/resolved-pre.java"));
    assert.ok(built.argv.includes("/repo/some/resolved-post.java"));
    assert.ok(!built.argv.includes("wire-pre.java"));
    assert.ok(!built.argv.includes("wire-post.java"));
  });
});

test("runHostTool: a ghidra.analyze preScript that escapes the workspace root is refused with the workspace-escape message, and the log spy recorded zero lines", async () => {
  await withTempDir(async (dir) => {
    writeFileSync(join(dir, "x.bin"), "tiny\n", "utf8");
    const logLines: string[] = [];
    const response = await runHostTool(
      { tool: "ghidra.analyze", args: { runId: "r1", importPath: "x.bin", preScript: "../../etc/evil.java" } },
      { repoRoot: dir, log: (line) => logLines.push(line) },
    );
    assert.equal(response.ok, false);
    if (!response.ok) assert.match(response.message, /escapes the workspace root/);
    assert.equal(logLines.length, 0, "no child was spawned, so no log line should have been recorded");
  });
});

test("runHostTool: an absolute ghidra.analyze postScript is refused with the not-absolute message", async () => {
  await withTempDir(async (dir) => {
    writeFileSync(join(dir, "x.bin"), "tiny\n", "utf8");
    const response = await runHostTool(
      { tool: "ghidra.analyze", args: { runId: "r1", importPath: "x.bin", postScript: "/etc/evil.java" } },
      { repoRoot: dir },
    );
    assert.equal(response.ok, false);
    if (!response.ok) assert.match(response.message, /must be relative to the workspace root, not absolute/);
  });
});

test("runHostTool: an accepted in-workspace ghidra.analyze preScript reaches the spawned argv as an absolute resolved path, never the bare relative string", async () => {
  await withTempDir(async (dir) => {
    const previousGhidraHome = process.env.GHIDRA_HOME;
    const supportDir = join(dir, "support");
    mkdirSync(supportDir, { recursive: true });
    const echoPath = join(dir, "echoed-argv.json");
    // A real (Node-executed, not real Ghidra) analyzeHeadless stand-in that
    // echoes the FULL argv it received -- runHostTool()'s own response
    // shape never surfaces argv, only exitStatus/results/stderrTail.
    writeFileSync(
      join(supportDir, "analyzeHeadless"),
      ["#!/usr/bin/env node", 'import { writeFileSync } from "node:fs";', `writeFileSync(${JSON.stringify(echoPath)}, JSON.stringify(process.argv.slice(2)));`, "process.exit(0);", ""].join("\n"),
      "utf8",
    );
    chmodSync(join(supportDir, "analyzeHeadless"), 0o755);
    process.env.GHIDRA_HOME = dir;
    try {
      writeFileSync(join(dir, "x.bin"), "tiny\n", "utf8");
      writeFileSync(join(dir, "pre.java"), "// pre\n", "utf8");
      const response = await runHostTool({ tool: "ghidra.analyze", args: { runId: "r1", importPath: "x.bin", preScript: "pre.java" } }, { repoRoot: dir });
      assert.equal(response.ok, true);
      const echoedArgv = JSON.parse(readFileSync(echoPath, "utf8")) as string[];
      const preIdx = echoedArgv.indexOf("-preScript");
      assert.ok(preIdx !== -1);
      const preValue = echoedArgv[preIdx + 1];
      assert.ok(isAbsolute(preValue));
      assert.equal(preValue, resolvePath(dir, "pre.java"));
      assert.ok(!echoedArgv.includes("pre.java"), "argv must never carry the bare relative preScript string");
    } finally {
      if (previousGhidraHome === undefined) delete process.env.GHIDRA_HOME;
      else process.env.GHIDRA_HOME = previousGhidraHome;
    }
  });
});

// ---------------------------------------------------------------------------
// oracle.probe / oracle.run -- CR-01 closure (34-08, Task 1). The wire key is
// gone; the oracle's location is now decided HOST-SIDE by
// resolveOracleCommand(), consulted by both branches. "unp64" below is the
// module's own DEFAULT_ORACLE_COMMAND, not re-exported -- hardcoded here
// exactly as the plan's own <read_first> names it.
// ---------------------------------------------------------------------------

const EXPECTED_ORACLE_BINARY_NAME = "unp64";

/** Temporarily sets one oracle environment variable and restores it (or
 * removes it, if it was previously unset) in `finally` -- the same
 * set-and-restore idiom `withFakeAcme`/`withFakeGhidraHome` use for theirs. */
async function withOracleEnv<T>(varName: string, value: string, fn: () => Promise<T> | T): Promise<T> {
  const previous = process.env[varName];
  process.env[varName] = value;
  try {
    return await fn();
  } finally {
    if (previous === undefined) delete process.env[varName];
    else process.env[varName] = previous;
  }
}

/** Removes BOTH oracle environment variables for the duration of `fn`,
 * restoring each in `finally` -- used by cases that must observe the
 * no-configuration (bare search-path) behaviour regardless of what the
 * ambient test environment happens to carry. */
async function withNoOracleEnv<T>(fn: () => Promise<T> | T): Promise<T> {
  const previousUnp64 = process.env.UNP64;
  const previousUnp64Path = process.env.UNP64_PATH;
  delete process.env.UNP64;
  delete process.env.UNP64_PATH;
  try {
    return await fn();
  } finally {
    if (previousUnp64 === undefined) delete process.env.UNP64;
    else process.env.UNP64 = previousUnp64;
    if (previousUnp64Path === undefined) delete process.env.UNP64_PATH;
    else process.env.UNP64_PATH = previousUnp64Path;
  }
}

/** Writes a small, executable, controllable stand-in for the real oracle
 * binary INSIDE `dir`, named EXACTLY `binaryName` -- the caller passes a
 * fresh subdirectory per fake, so one temp root can hold both a
 * correctly-named and a wrongly-named fake at once. `mode: "version"`
 * answers `--version` with a banner (the oracle.probe shape); `mode:
 * "stdout"` ignores its argv and writes `stdoutLine` to its own stdout (the
 * oracle.run shape) -- proving WHICH binary actually ran. */
function writeFakeOracle(dir: string, binaryName: string, mode: "version" | "stdout", stdoutLine = ""): string {
  const scriptPath = join(dir, binaryName);
  writeFileSync(
    scriptPath,
    [
      "#!/usr/bin/env node",
      `const mode = ${JSON.stringify(mode)};`,
      `const stdoutLine = ${JSON.stringify(stdoutLine)};`,
      'if (mode === "version") {',
      '  process.stdout.write("fake-oracle version 1.0.0\\n");',
      "  process.exit(0);",
      "}",
      'if (mode === "stdout") {',
      "  process.stdout.write(stdoutLine + \"\\n\");",
      "  process.exit(0);",
      "}",
      "process.exit(0);",
      "",
    ].join("\n"),
    "utf8",
  );
  chmodSync(scriptPath, 0o755);
  return scriptPath;
}

test('normaliseHostToolRequest({ tool: "oracle.probe", args: { command: "/usr/local/bin/unp64" } }) is refused, naming the retired key and the accepted shape', () => {
  const result = normaliseHostToolRequest({ tool: "oracle.probe", args: { command: "/usr/local/bin/unp64" } });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /command/);
    assert.match(result.message, /accepted shape/);
  }
});

test('normaliseHostToolRequest({ tool: "oracle.probe" }) is accepted -- the tool takes no arguments at all', () => {
  const result = normaliseHostToolRequest({ tool: "oracle.probe" });
  assert.equal(result.ok, true);
});

test('normaliseHostToolRequest({ tool: "oracle.probe", args: {} }) is accepted', () => {
  const result = normaliseHostToolRequest({ tool: "oracle.probe", args: {} });
  assert.equal(result.ok, true);
});

test("runHostTool: oracle.probe with no oracle environment variable set resolves the bare expected binary name and reports oracle-absent, never a rejection", async () => {
  await withNoOracleEnv(async () => {
    const response = await runOracleHostTool({ tool: "oracle.probe" }, { repoRoot: "/tmp" });
    assert.equal(response.ok, true);
    if (response.ok && response.tool === "oracle.probe") {
      assert.equal(response.available, false);
      assert.equal(response.command, null);
      assert.match(response.reason ?? "", new RegExp(EXPECTED_ORACLE_BINARY_NAME));
    }
  });
});

test("runHostTool: oracle.probe with a host-side variable naming an existing file whose base name is NOT the expected binary reports oracle-absent, and the configured path appears nowhere in the response", async () => {
  await withTempDir(async (dir) => {
    const wrongPath = join(dir, "not-the-right-name");
    writeFileSync(wrongPath, "#!/bin/sh\nexit 0\n", "utf8");
    chmodSync(wrongPath, 0o755);
    await withOracleEnv("UNP64", wrongPath, async () => {
      const response = await runOracleHostTool({ tool: "oracle.probe" }, { repoRoot: dir });
      assert.equal(response.ok, true);
      if (response.ok && response.tool === "oracle.probe") {
        assert.equal(response.available, false);
        assert.ok(!JSON.stringify(response).includes(wrongPath), "a configured path must never be echoed back");
      }
    });
  });
});

test("runHostTool: oracle.probe with a host-side variable naming a non-existent path (correctly named, but absent on disk) reports oracle-absent, the reason names the variable, and the path appears nowhere in the response", async () => {
  await withTempDir(async (dir) => {
    // Correctly named ("unp64") so this exercises the EXISTENCE check, not
    // the basename check above.
    const missingPath = join(dir, "does-not-exist-here", EXPECTED_ORACLE_BINARY_NAME);
    await withOracleEnv("UNP64", missingPath, async () => {
      const response = await runOracleHostTool({ tool: "oracle.probe" }, { repoRoot: dir });
      assert.equal(response.ok, true);
      if (response.ok && response.tool === "oracle.probe") {
        assert.equal(response.available, false);
        assert.match(response.reason ?? "", /UNP64/);
        assert.ok(!JSON.stringify(response).includes(missingPath), "a configured path must never be echoed back");
      }
    });
  });
});

test("runHostTool: oracle.probe with a host-side variable naming an existing, executable fake NAMED as the expected binary reports available with that resolved path as command", async () => {
  await withTempDir(async (dir) => {
    const fakeDir = join(dir, "fake-correctly-named");
    mkdirSync(fakeDir, { recursive: true });
    const fakePath = writeFakeOracle(fakeDir, EXPECTED_ORACLE_BINARY_NAME, "version");
    await withOracleEnv("UNP64", fakePath, async () => {
      const response = await runOracleHostTool({ tool: "oracle.probe" }, { repoRoot: dir });
      assert.equal(response.ok, true);
      if (response.ok && response.tool === "oracle.probe") {
        assert.equal(response.available, true);
        assert.equal(response.command, fakePath);
      }
    });
  });
});

test("runHostTool: oracle.run spawns the SAME resolved command oracle.probe would -- a fake named as the expected binary writes a known stdout line, and oracle.run returns it", async () => {
  await withTempDir(async (dir) => {
    const fakeDir = join(dir, "fake-for-run");
    mkdirSync(fakeDir, { recursive: true });
    const knownLine = "FAKE-ORACLE-KNOWN-STDOUT-LINE";
    const fakePath = writeFakeOracle(fakeDir, EXPECTED_ORACLE_BINARY_NAME, "stdout", knownLine);
    writeFileSync(join(dir, "input.bin"), "tiny\n", "utf8");
    await withOracleEnv("UNP64", fakePath, async () => {
      const response = await runOracleHostTool({ tool: "oracle.run", args: { source: "input.bin" } }, { repoRoot: dir });
      assert.equal(response.ok, true);
      if (response.ok && response.tool === "oracle.run") {
        assert.ok(response.stdout.includes(knownLine), "oracle.run must have spawned the SAME configured fake oracle.probe resolved, not a bare search-path name");
      }
    });
  });
});

test(
  'END TO END: an oracle.probe request carrying the retired "command" key is refused at the container-side caller with ok: false naming the key, over the real control-plane route, with all seven VICE callbacks provably uncalled',
  async () => {
    await withTempDir(async (dir) => {
      const { listener, token, spies } = await startListenerWithSpies(dir);
      try {
        const stateDir = mkdtempSync(join(tmpdir(), "host-tool-broker-json-"));
        try {
          writeFileSync(brokerJsonPath(stateDir), JSON.stringify({ control_host: "127.0.0.1", control_port: listener.port, control_token: token }));
          const response = await hostToolOverControlPlane(stateDir, "oracle.probe", { command: "/usr/local/bin/unp64" });
          assert.equal(response.ok, false);
          if (!response.ok) assert.match(response.message, /command/);
          assertAllSpiesEmpty(spies);
        } finally {
          rmSync(stateDir, { recursive: true, force: true });
        }
      } finally {
        listener.server.close();
      }
    });
  },
);

// ---------------------------------------------------------------------------
// HOST_TOOL_PATH_ARG_KEYS -- the census that makes "no argv passthrough
// anywhere" a mechanism rather than three point fixes (34-08, Task 3).
// ---------------------------------------------------------------------------

/** Pinned per-tool remainder: `HOST_TOOL_ARG_KEYS[tool]` minus
 * `HOST_TOOL_PATH_ARG_KEYS[tool]`. A newly added argument key lands
 * unclassified in NEITHER list until a maintainer adds it here (or to the
 * path-key table) -- the completeness case below reds until they do. */
const HOST_TOOL_ARG_KEYS_REMAINDER: Readonly<Record<string, readonly string[]>> = {
  "acme.build": Object.freeze(["format", "setpc", "defines", "noReport"]),
  "ghidra.analyze": Object.freeze(["runId"]),
  "oracle.probe": Object.freeze([]),
  "oracle.run": Object.freeze([]),
};

/** A minimal, otherwise-valid `args` object per tool -- just enough for
 * `runHostTool()` to reach EVERY declared path key's own resolution site
 * without tripping on an unrelated missing-required-field refusal. No file
 * needs to exist on disk for any of these: `resolveWorkspacePath()` never
 * calls `existsSync()`, so a refusal for the deliberately-bad key under
 * test is always what actually fires. */
const HOST_TOOL_MINIMAL_VALID_ARGS: Readonly<Record<string, () => Record<string, unknown>>> = {
  "acme.build": () => ({ source: "a.a" }),
  "ghidra.analyze": () => ({ runId: "census-run", importPath: "x.bin" }),
  "oracle.probe": () => ({}),
  "oracle.run": () => ({ source: "a.bin" }),
};

/** The include list needs a single-element ARRAY where every other declared
 * path key needs a plain string -- this is the one place that distinction is
 * made, so the loop below stays tool/key-agnostic otherwise. */
function censusEscapingValue(key: string): unknown {
  return key === "includes" ? ["../outside"] : "../outside";
}
function censusAbsoluteValue(key: string): unknown {
  return key === "includes" ? ["/etc/passwd"] : "/etc/passwd";
}

/** Reads a refusal's human-readable text from whichever field that tool's
 * OWN response shape uses -- `message` for acme.build/ghidra.analyze,
 * `reason` for oracle.run (host-tool.mts's own two response shapes). */
function censusRefusalText(response: { ok: boolean; message?: string; reason?: string | null }): string {
  if (response.ok) return "";
  if ("message" in response && typeof response.message === "string") return response.message;
  if ("reason" in response && typeof response.reason === "string") return response.reason;
  return "";
}

test("HOST_TOOL_PATH_ARG_KEYS: every declared path key is a member of that tool's accepted-key list, and accepted-minus-path equals a pinned remainder, in BOTH directions", () => {
  assert.deepEqual([...HOST_TOOL_IDS].sort(), Object.keys(HOST_TOOL_PATH_ARG_KEYS).sort(), "HOST_TOOL_PATH_ARG_KEYS must have an entry for every HOST_TOOL_IDS member");
  let totalDeclared = 0;
  for (const tool of HOST_TOOL_IDS) {
    const accepted = HOST_TOOL_ARG_KEYS[tool];
    const pathKeys = HOST_TOOL_PATH_ARG_KEYS[tool];
    totalDeclared += pathKeys.length;
    for (const key of pathKeys) {
      assert.ok(accepted.includes(key), `declared path key "${key}" for "${tool}" must be a member of HOST_TOOL_ARG_KEYS["${tool}"]`);
    }
    const computedRemainder = [...accepted.filter((k) => !pathKeys.includes(k))].sort();
    const pinnedRemainder = [...HOST_TOOL_ARG_KEYS_REMAINDER[tool]].sort();
    // Both directions: every computed-remainder key must be in the pinned
    // set, AND every pinned key must be in the computed remainder -- a
    // newly added accepted key that is classified as NEITHER path-bearing
    // NOR pinned shows up on the computed side only, reddening this.
    assert.deepEqual(computedRemainder, pinnedRemainder, `accepted-minus-path for "${tool}" must equal its pinned remainder in both directions`);
  }
  assert.equal(totalDeclared, 7, "the declared path-key total across all tools must be 7 -- a different count means a key was added or dropped without updating this census");
});

test("HOST_TOOL_PATH_ARG_KEYS: every declared path key refuses an escaping value and an absolute value, with the executed-assertion count equal to twice the declared total (non-vacuity)", async () => {
  const previousGhidraHome = process.env.GHIDRA_HOME;
  delete process.env.GHIDRA_HOME;
  try {
    await withTempDir(async (dir) => {
      let executed = 0;
      let totalDeclared = 0;
      for (const tool of HOST_TOOL_IDS) {
        const pathKeys = HOST_TOOL_PATH_ARG_KEYS[tool];
        totalDeclared += pathKeys.length;
        for (const key of pathKeys) {
          const baseArgs = HOST_TOOL_MINIMAL_VALID_ARGS[tool]();

          const escapingResponse = await runOracleHostTool({ tool, args: { ...baseArgs, [key]: censusEscapingValue(key) } }, { repoRoot: dir });
          assert.equal(escapingResponse.ok, false, `${tool}.${key} escaping value must be refused`);
          assert.match(censusRefusalText(escapingResponse), /escapes the workspace root/, `${tool}.${key} escaping refusal must carry the workspace-escape wording`);
          executed++;

          const absoluteResponse = await runOracleHostTool({ tool, args: { ...baseArgs, [key]: censusAbsoluteValue(key) } }, { repoRoot: dir });
          assert.equal(absoluteResponse.ok, false, `${tool}.${key} absolute value must be refused`);
          assert.match(censusRefusalText(absoluteResponse), /not absolute/, `${tool}.${key} absolute refusal must carry the not-absolute wording`);
          executed++;
        }
      }
      // Non-vacuity: the executed count is asserted against the declared
      // total, so an empty or short-circuited table cannot pass silently --
      // a loop body that never ran would leave `executed` at 0.
      assert.equal(totalDeclared, 7, "sanity: the declared path-key total must still be 7");
      assert.equal(executed, totalDeclared * 2, "the executed-assertion count must equal twice the declared total (one escaping + one absolute check per key)");
    });
  } finally {
    if (previousGhidraHome === undefined) delete process.env.GHIDRA_HOME;
    else process.env.GHIDRA_HOME = previousGhidraHome;
  }
});

test("HOST_TOOL_PATH_ARG_KEYS: the ghidra.analyze path keys' refusals are observed with GHIDRA_HOME unset, proving the refusal precedes any launcher lookup", async () => {
  const previousGhidraHome = process.env.GHIDRA_HOME;
  delete process.env.GHIDRA_HOME;
  try {
    await withTempDir(async (dir) => {
      for (const key of HOST_TOOL_PATH_ARG_KEYS["ghidra.analyze"]) {
        const baseArgs = HOST_TOOL_MINIMAL_VALID_ARGS["ghidra.analyze"]();
        const response = await runOracleHostTool({ tool: "ghidra.analyze", args: { ...baseArgs, [key]: censusEscapingValue(key) } }, { repoRoot: dir });
        assert.equal(response.ok, false, `ghidra.analyze.${key} escaping value must be refused with GHIDRA_HOME unset`);
        const text = censusRefusalText(response);
        assert.match(text, /escapes the workspace root/, `ghidra.analyze.${key} must refuse for the workspace-escape reason`);
        assert.doesNotMatch(text, /GHIDRA_HOME/, `the refusal for ghidra.analyze.${key} must precede any GHIDRA_HOME/launcher lookup, not be caused by one`);
      }
    });
  } finally {
    if (previousGhidraHome === undefined) delete process.env.GHIDRA_HOME;
    else process.env.GHIDRA_HOME = previousGhidraHome;
  }
});

// ---------------------------------------------------------------------------
// 34-09 (CR-04, task 2): the applied budget is observable, every tool has an
// explicit server-side entry, the two sides of the seam are ordered by an
// iterating assertion (not a comment), and two overlapping slow
// ghidra.analyze invocations both complete on their own deadlines.
// ---------------------------------------------------------------------------

test("runHostTool: a ghidra.analyze run with no override logs a line whose timeout_ms equals HOST_TOOL_TIMEOUT_MS[\"ghidra.analyze\"]", async () => {
  await withFakeGhidraHome(async () => {
    await withTempDir(async (dir) => {
      writeFileSync(join(dir, "x.bin"), "tiny\n", "utf8");
      const logLines: string[] = [];
      const response = await runHostTool(
        { tool: "ghidra.analyze", args: { runId: "log-budget-ghidra", importPath: "x.bin" } },
        { repoRoot: dir, log: (line) => logLines.push(line) },
      );
      assert.equal(response.ok, true, response.ok ? "" : (response as { ok: false; message: string }).message);
      assert.equal(logLines.length, 1, "exactly one log line per attempted invocation");
      assert.match(logLines[0], new RegExp(`timeout_ms=${HOST_TOOL_TIMEOUT_MS["ghidra.analyze"]}(\\D|$)`));
    });
  });
});

test("runHostTool: an acme.build run with no override logs a line whose timeout_ms equals DEFAULT_HOST_TOOL_TIMEOUT_MS", async () => {
  await withTempDir(async (dir) => {
    writeFileSync(join(dir, "a.a"), "; test source\n", "utf8");
    const fakeAcme = writeFakeAcme(dir, "zerobyte");
    await withFakeAcme(fakeAcme, async () => {
      const logLines: string[] = [];
      const response = await runHostTool({ tool: "acme.build", args: { source: "a.a", noReport: true } }, { repoRoot: dir, log: (line) => logLines.push(line) });
      assert.equal(response.ok, true, response.ok ? "" : (response as { ok: false; message: string }).message);
      assert.equal(logLines.length, 1);
      assert.match(logLines[0], new RegExp(`timeout_ms=${DEFAULT_HOST_TOOL_TIMEOUT_MS}(\\D|$)`));
    });
  });
});

test("runHostTool: an explicit deps.timeoutMs is what gets logged, not the table entry -- the test seam and the table cannot be confused", async () => {
  await withFakeGhidraHome(async () => {
    await withTempDir(async (dir) => {
      writeFileSync(join(dir, "x.bin"), "tiny\n", "utf8");
      const logLines: string[] = [];
      const response = await runHostTool(
        { tool: "ghidra.analyze", args: { runId: "log-explicit-override", importPath: "x.bin" } },
        { repoRoot: dir, log: (line) => logLines.push(line), timeoutMs: 12345 },
      );
      assert.equal(response.ok, true, response.ok ? "" : (response as { ok: false; message: string }).message);
      assert.equal(logLines.length, 1);
      assert.match(logLines[0], /timeout_ms=12345(\D|$)/);
    });
  });
});

const HOST_TOOL_BUDGET_CEILING_MS = 900_000;

test("HOST_TOOL_TIMEOUT_MS: every HOST_TOOL_IDS member has a server-side table entry, and every entry is finite and at or below a stated ceiling", () => {
  for (const tool of HOST_TOOL_IDS) {
    const ms = HOST_TOOL_TIMEOUT_MS[tool];
    assert.ok(Number.isFinite(ms), `${tool}: missing a server-side HOST_TOOL_TIMEOUT_MS entry`);
    assert.ok(ms > 0 && ms <= HOST_TOOL_BUDGET_CEILING_MS, `${tool}: budget ${ms}ms must be positive and at or below the ${HOST_TOOL_BUDGET_CEILING_MS}ms ceiling`);
  }
});

test("cross-seam ordering: for every HOST_TOOL_IDS member, the client-side request deadline (host-tool-client.ts) is strictly greater than the server-side budget (host-tool.mts)", () => {
  for (const tool of HOST_TOOL_IDS) {
    const serverBudget = HOST_TOOL_TIMEOUT_MS[tool];
    const clientDeadline = hostToolRequestTimeoutMs(tool);
    assert.ok(
      clientDeadline > serverBudget,
      `${tool}: client deadline (${clientDeadline}ms) must be strictly greater than the server budget (${serverBudget}ms) -- the side that owns the budget must be the side that reports the verdict`,
    );
  }
});

test(
  "two overlapping slow ghidra.analyze host_tool requests over the real control-plane route both resolve ok:true, reserve distinct project locations, and the pair completes in appreciably less than the sum of the two sleeps",
  async () => {
    await withTempDir(async (dir) => {
      writeFileSync(join(dir, "x.bin"), "tiny\n", "utf8");
      const { listener, token, spies } = await startListenerWithSpies(dir);
      const sleepSeconds = 3;
      try {
        await withFakeGhidraHome(
          async () => {
            const stateDir = mkdtempSync(join(tmpdir(), "host-tool-broker-json-"));
            try {
              writeFileSync(brokerJsonPath(stateDir), JSON.stringify({ control_host: "127.0.0.1", control_port: listener.port, control_token: token }));
              const runIdA = "overlap-run-a";
              const runIdB = "overlap-run-b";
              const startedAt = Date.now();
              const [responseA, responseB] = await Promise.all([
                hostToolOverControlPlane(stateDir, "ghidra.analyze", { runId: runIdA, importPath: "x.bin" }),
                hostToolOverControlPlane(stateDir, "ghidra.analyze", { runId: runIdB, importPath: "x.bin" }),
              ]);
              const elapsedMs = Date.now() - startedAt;
              assert.equal(responseA.ok, true, responseA.ok ? "" : (responseA as { ok: false; message: string }).message);
              assert.equal(responseB.ok, true, responseB.ok ? "" : (responseB as { ok: false; message: string }).message);
              // resolveGhidraProject() reserves the run directory as the
              // LAST step of a successful resolution (ghidra-project.mts) --
              // its presence on disk is the observable proof the two runs
              // used distinct project locations, since the response itself
              // carries no project-location field for ghidra.analyze.
              assert.ok(statSync(join(dir, "tools", "ghidra-runs", runIdA)).isDirectory());
              assert.ok(statSync(join(dir, "tools", "ghidra-runs", runIdB)).isDirectory());
              assert.ok(
                elapsedMs < sleepSeconds * 2 * 1000,
                `expected the overlapping pair to finish well under the summed sleeps (${sleepSeconds * 2}s); took ${elapsedMs}ms`,
              );
              assertAllSpiesEmpty(spies);
            } finally {
              rmSync(stateDir, { recursive: true, force: true });
            }
          },
          { sleepSeconds },
        );
      } finally {
        listener.server.close();
      }
    });
  },
);
