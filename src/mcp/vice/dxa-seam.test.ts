// dxa-seam.test.ts
//
// Phase 35, plan 35-01, Task 2 (DXA-02): the HERMETIC typed-allowlist gate
// for `dxa.disassemble` -- no network, no built vendored `dxa` binary
// required. Reaches the executor as the COMMITTED artifact
// (resources/host-tool.mjs), following host-tool.test.ts's own
// import-and-cast shape (tsconfig.json excludes `resources`, which is why
// the cast below exists).
//
// NEVER REQUIRES THE REAL VENDORED BINARY. The one case that needs a
// spawned child to actually complete (the success-response shape case)
// plants a throwaway, self-cleaning executable at the FIRST location
// findDxaBinary() (host-tool.mts) probes -- resources/vendor/dxa/dxa, which
// this repository never populates itself -- so it wins over the real
// vendor/dxa/dxa (the SECOND candidate) without ever touching it. Removed
// in a `finally` unconditionally.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { build } from "./build.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// Build BEFORE importing the artifact -- host-tool.test.ts's own idiom --
// so this suite never reaches a stale committed resources/host-tool.mjs.
build();
const hostTool = (await import(new URL("./resources/host-tool.mjs", import.meta.url).href)) as unknown as {
  normaliseHostToolRequest: (raw: unknown) => { ok: true; request: { tool: string; args: Record<string, unknown> } } | { ok: false; message: string };
  buildHostToolArgv: (
    request: { tool: string; args: Record<string, unknown> },
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
const { normaliseHostToolRequest, buildHostToolArgv, runHostTool } = hostTool;

async function withTempDir<T>(fn: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "dxa-seam-test-"));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Mirrors host-tool.test.ts's own idioms for the census-style refusal
 * cases below -- reimplemented locally rather than imported, since
 * host-tool.test.ts's copies are module-private. `includes` has no
 * dxa.disassemble analogue (none of its five path keys is an array), so
 * these are always plain strings here. */
function censusEscapingValue(): string {
  return "../outside";
}
function censusAbsoluteValue(): string {
  return "/etc/passwd";
}

const DXA_PATH_KEYS = ["image", "entrypointsPath", "datablocksPath", "labelsPath", "outDir"] as const;

// ---------------------------------------------------------------------------
// buildHostToolArgv() -- deterministic, typed argv construction.
// ---------------------------------------------------------------------------

test('dxa.disassemble with imageKind: "flat64k": argv contains -g immediately followed by 0000', () => {
  const resolved = { imagePath: "/ws/x.bin", outDirPath: "/ws" };
  const built = buildHostToolArgv({ tool: "dxa.disassemble", args: { image: "x.bin", imageKind: "flat64k" } }, resolved);
  assert.equal(built.ok, true, built.ok ? "" : (built as { ok: false; message: string }).message);
  if (!built.ok) return;
  const gIdx = built.argv.indexOf("-g");
  assert.notEqual(gIdx, -1, "expected -g in the flat64k argv");
  assert.equal(built.argv[gIdx + 1], "0000", "expected -g immediately followed by 0000");
});

test('dxa.disassemble with imageKind: "prg": argv contains NO -g at all', () => {
  const resolved = { imagePath: "/ws/x.prg", outDirPath: "/ws" };
  const built = buildHostToolArgv({ tool: "dxa.disassemble", args: { image: "x.prg", imageKind: "prg" } }, resolved);
  assert.equal(built.ok, true, built.ok ? "" : (built as { ok: false; message: string }).message);
  if (!built.ok) return;
  // Explicit ABSENCE, not merely "the flat64k case has it" -- the two
  // directions are asserted by two separate cases (this file's own
  // acceptance criterion).
  assert.equal(built.argv.includes("-g"), false, "expected NO -g flag anywhere in the prg-kind argv");
});

test("dxa.disassemble argv is byte-identical across two successive buildHostToolArgv() calls on the same request", () => {
  const request = { tool: "dxa.disassemble", args: { image: "x.prg", imageKind: "prg" as const, entrypointsPath: "/ws/e.txt" } };
  const resolved = { imagePath: "/ws/x.prg", outDirPath: "/ws", entrypointsPath: "/ws/e.txt" };
  const first = buildHostToolArgv(request, resolved);
  const second = buildHostToolArgv(request, resolved);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (first.ok && second.ok) {
    assert.deepEqual(first.argv, second.argv, "two successive calls on the same request must yield deepEqual argv arrays");
    assert.deepEqual(first.outputs, second.outputs);
  }
});

test("dxa.disassemble argv orders fixed flags first, -R/-B/-l for present optional paths in that order, then -a dump, then the image path last", () => {
  const resolved = {
    imagePath: "/ws/x.prg",
    outDirPath: "/ws",
    entrypointsPath: "/ws/entries.txt",
    datablocksPath: "/ws/blocks.txt",
    labelsPath: "/ws/labels.txt",
  };
  const built = buildHostToolArgv(
    { tool: "dxa.disassemble", args: { image: "x.prg", imageKind: "prg", entrypointsPath: "e", datablocksPath: "b", labelsPath: "l" } },
    resolved,
  );
  assert.equal(built.ok, true, built.ok ? "" : (built as { ok: false; message: string }).message);
  if (!built.ok) return;
  assert.deepEqual(
    built.argv,
    [
      "-p",
      "all-nmos6502",
      "-d",
      "skip-scanning",
      "-t",
      "detect-internal",
      "-R",
      "/ws/entries.txt",
      "-B",
      "/ws/blocks.txt",
      "-l",
      "/ws/labels.txt",
      "-a",
      "dump",
      "/ws/x.prg",
    ],
  );
});

// ---------------------------------------------------------------------------
// normaliseHostToolRequest() -- the typed allowlist's refusals.
// ---------------------------------------------------------------------------

test("dxa.disassemble with an unknown argument key is refused BY NAME, never dropped", () => {
  const result = normaliseHostToolRequest({ tool: "dxa.disassemble", args: { image: "x.prg", imageKind: "prg", bogusKey: "x" } });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /bogusKey/);
});

test('dxa.disassemble with imageKind: "PRG" (upper-case) is refused -- the enum is exact and case-sensitive, "PRG" and "prg" never merge', () => {
  const result = normaliseHostToolRequest({ tool: "dxa.disassemble", args: { image: "x.prg", imageKind: "PRG" } });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /imageKind/);
});

test("dxa.disassemble planted violation: a synthetic request whose imageKind is outside the two-member enum is reported by the SAME narrowing function the real path calls", () => {
  // Proves the acceptance cases above are actually capable of catching a
  // real violation -- if this fails, normaliseHostToolRequest() stopped
  // validating imageKind at all and every case above would pass vacuously.
  const result = normaliseHostToolRequest({ tool: "dxa.disassemble", args: { image: "x.prg", imageKind: "not-a-real-kind" } });
  assert.equal(result.ok, false, "a planted out-of-enum imageKind must be refused by the real narrowing function");
});

test("HOST_TOOL_PATH_ARG_KEYS[dxa.disassemble]: every declared path key refuses an escaping value and an absolute value, with a non-vacuous executed-assertion count", async () => {
  await withTempDir(async (dir) => {
    let executed = 0;
    for (const key of DXA_PATH_KEYS) {
      const baseArgs: Record<string, unknown> = { image: "x.prg", imageKind: "prg" };

      const escapingResponse = await runHostTool({ tool: "dxa.disassemble", args: { ...baseArgs, [key]: censusEscapingValue() } }, { repoRoot: dir });
      assert.equal(escapingResponse.ok, false, `dxa.disassemble.${key} escaping value must be refused`);
      if (!escapingResponse.ok) assert.match(escapingResponse.message, /escapes the workspace root/, `dxa.disassemble.${key} escaping refusal wording`);
      executed++;

      const absoluteResponse = await runHostTool({ tool: "dxa.disassemble", args: { ...baseArgs, [key]: censusAbsoluteValue() } }, { repoRoot: dir });
      assert.equal(absoluteResponse.ok, false, `dxa.disassemble.${key} absolute value must be refused`);
      if (!absoluteResponse.ok) assert.match(absoluteResponse.message, /not absolute/, `dxa.disassemble.${key} absolute refusal wording`);
      executed++;
    }
    // Non-vacuity: an empty DXA_PATH_KEYS array would leave executed at 0.
    assert.equal(executed, DXA_PATH_KEYS.length * 2, "executed-assertion count must equal twice the declared path-key total");
  });
});

// ---------------------------------------------------------------------------
// runHostTool() success-response shape -- no listing text on the wire, ever.
// ---------------------------------------------------------------------------

/** Plants a throwaway, deterministic fake `dxa` at the FIRST location
 * findDxaBinary() (host-tool.mts) probes -- resources/vendor/dxa/dxa, which
 * this repository never populates itself -- so this case never touches the
 * real vendor/dxa/dxa (the SECOND candidate) and never requires it to have
 * been built. */
function plantFakeDxaBinary(): { binPath: string; cleanupDir: string } {
  const vendorDir = join(HERE, "resources", "vendor", "dxa");
  mkdirSync(vendorDir, { recursive: true });
  const binPath = join(vendorDir, "dxa");
  writeFileSync(binPath, `#!/usr/bin/env bash\nprintf '0801 0b 08 0a \\t.byt \\$0b,\\$08,\\$0a\\n'\n`, "utf8");
  spawnSync("chmod", ["+x", binPath]);
  return { binPath, cleanupDir: join(HERE, "resources", "vendor") };
}

test("dxa.disassemble success response carries results[].path/.sha256/.byteLength and NO field holding listing text -- the response object's own key set is asserted", async () => {
  const fake = plantFakeDxaBinary();
  try {
    await withTempDir(async (dir) => {
      writeFileSync(join(dir, "tracer.prg"), "tiny\n", "utf8");
      const response = await runHostTool({ tool: "dxa.disassemble", args: { image: "tracer.prg", imageKind: "prg" } }, { repoRoot: dir });
      assert.equal(response.ok, true, response.ok ? "" : (response as { ok: false; message: string }).message);
      if (!response.ok) return;
      assert.deepEqual(Object.keys(response).sort(), ["exitStatus", "ok", "results", "stderrTail", "tool"].sort());
      assert.equal(response.results.length, 1, "expected exactly one output result -- the one listing file");
      const result = response.results[0]!;
      assert.deepEqual(
        Object.keys(result).sort(),
        ["path", "sha256", "byteLength"].sort(),
        "a future field carrying listing text must be reported here, not tolerated",
      );
      assert.equal(typeof result.path, "string");
      assert.match(result.sha256, /^[0-9a-f]{64}$/);
      assert.equal(typeof result.byteLength, "number");
      assert.ok(result.byteLength > 0);
    });
  } finally {
    rmSync(fake.cleanupDir, { recursive: true, force: true });
  }
});
