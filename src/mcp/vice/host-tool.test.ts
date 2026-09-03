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
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync, statSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, basename, isAbsolute, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import { build } from "./build.ts";
import { startControlListener, type StartControlListenerResult, type AcquireOutcome, type RecycleOutcome, type StatusInstanceEntry, type HostStateFields, type MonitorClaimOutcome, type MonitorReleaseOutcome } from "./broker-control.mts";
import { hostToolOverControlPlane } from "./host-tool-client.ts";
import { brokerJsonPath } from "./vice-broker-client.ts";
import { acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./acme-gate.ts";

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
const { normaliseHostToolRequest, resolveWorkspacePath, buildHostToolArgv, runHostTool } = hostTool;

// --------------------------------------------------------------- test helpers

async function withTempDir<T>(fn: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "host-tool-test-"));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
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
 * regardless of outcome. */
async function withFakeGhidraHome<T>(fn: (ghidraHome: string) => Promise<T> | T): Promise<T> {
  const previous = process.env.GHIDRA_HOME;
  return withTempDir(async (dir) => {
    const supportDir = join(dir, "support");
    mkdirSync(supportDir, { recursive: true });
    writeFileSync(join(supportDir, "analyzeHeadless"), "#!/bin/sh\nexit 0\n", "utf8");
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
