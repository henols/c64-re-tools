#!/usr/bin/env node
// petcat.test.ts -- coverage for this skill script's own CLI plumbing
// Added in a code-review fix pass:
// petcat.ts shipped in the same phase as c1541.ts, wrapping the SAME
// host-tool seam pattern (invokeSeam(), commonAncestorDir()/toRel(),
// selfPath()), but had no test file at all -- c1541.ts's own
// c1541.test.ts was the model this file mirrors.
//
// Two tiers, deliberately separated (same split as c1541.test.ts):
//
//   1. PURE unit tests against the exported `parseOpts()` -- never call the
//      seam, never need `petcat` installed, ALWAYS run (keeps this file safe
//      under CI's `node --test 'skills/*/scripts/*.test.ts'` glob,
//      which has no VICE install at all).
//   2. LIVE end-to-end cases that run the real `decode` CLI verb over the
//      real seam against the committed fixtures (`fixtures/dxa/basic-stub.prg`,
//      `fixtures/petcat/computed-sys.prg`, `fixtures/petcat/not-basic.prg`),
//      gated on `petcat` actually being resolvable on PATH, skipped with a
//      named reason otherwise -- mirrors c1541.test.ts's own live-test skip
//      convention verbatim, never a hand-rolled early return that would
//      report a false PASS. (The real dispatch resolves `petcat` as a
//      sibling of whichever `x64sc` backend-detect.mts resolves, not via a
//      bare PATH search -- this PATH check is the SAME imperfect-but-
//      accepted go/no-go proxy c1541.test.ts already uses for `c1541`.)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { parseOpts } from "../../../skills/c64-basic/scripts/petcat.ts";
import type { HostToolResponse } from "../../../skills/c64-project/scripts/mcp-module.ts";
import { projectRoot } from "../../../skills/c64-project/scripts/project-paths.ts";
import { startHarnessBroker } from "../../../src/mcp/vice/broker-harness.ts";
import type { HarnessBroker } from "../../../src/mcp/vice/broker-harness.ts";

const execFileP = promisify(execFile);

const HERE = dirname(fileURLToPath(import.meta.url));
// The scripts under test live in the skill folder; this test lives in test/skills/.
const SCRIPT_DIR = join(HERE, "..", "..", "..", "skills", "c64-basic", "scripts");
const SCRIPT = join(SCRIPT_DIR, "petcat.ts");
const LITERAL_SYS_FIXTURE = join(projectRoot(), "src", "mcp", "vice", "fixtures", "dxa", "basic-stub.prg");
const COMPUTED_SYS_FIXTURE = join(projectRoot(), "src", "mcp", "vice", "fixtures", "petcat", "computed-sys.prg");
const NOT_BASIC_FIXTURE = join(projectRoot(), "src", "mcp", "vice", "fixtures", "petcat", "not-basic.prg");

// ---------------------------------------------------------------------------
// Tier 1: pure CLI-option parsing, no seam call, no petcat install needed.
// ---------------------------------------------------------------------------

test("parseOpts: --image and --out-dir are read positionally after their flag, --json defaults false", () => {
  assert.deepEqual(parseOpts(["--image", "a.prg", "--out-dir", "out"]), { json: false, image: "a.prg", outDir: "out" });
});

test("parseOpts: --json sets the flag true regardless of position", () => {
  assert.deepEqual(parseOpts(["--json", "--image", "a.prg"]), { json: true, image: "a.prg" });
  assert.deepEqual(parseOpts(["--image", "a.prg", "--json"]), { json: true, image: "a.prg" });
});

test("parseOpts: an empty argv yields only the json:false default -- no image/outDir keys at all", () => {
  assert.deepEqual(parseOpts([]), { json: false });
});

test("parseOpts: --out-dir is optional and independent of --image", () => {
  assert.deepEqual(parseOpts(["--out-dir", "out"]), { json: false, outDir: "out" });
});

// ---------------------------------------------------------------------------
// Tier 2: LIVE, gated on petcat actually being resolvable. CI has no VICE
// install (40-02/40-03's own SUMMARYs) -- this skips there, never fails.
// ---------------------------------------------------------------------------

function findPetcatOnPath() {
  for (const dir of (process.env.PATH ?? "").split(":")) {
    const candidate = join(dir, "petcat");
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const PETCAT_SKIP_REASON = findPetcatOnPath() === null ? "petcat is not resolvable on PATH -- decode's live seam calls are skipped" : false;

// The LIVE cases reach the tool only through the broker's fixed endpoint, so
// they run against this file's OWN harness broker (never a machine broker),
// started once when the tool is resolvable.
let broker: HarnessBroker | null = null;
before(async () => {
  if (PETCAT_SKIP_REASON) return;
  broker = await startHarnessBroker();
});
after(async () => {
  await broker?.stop();
});
const execScript = (args: string[]) => execFileP(process.execPath, args, { env: broker?.childEnv ?? process.env });

// decode's own exit code is response.ok ? 0 : 1 (unlike c1541's `audit`
// verb, which always exits 0) -- execFile's promisified form rejects on a
// non-zero exit, so a refused decode is read off the REJECTED error's own
// `.stdout`, not a resolved value.
async function runDecodeCli(imagePath: string, outDir: string): Promise<HostToolResponse> {
  const args = [SCRIPT, "decode", "--image", imagePath, "--out-dir", outDir, "--json"];
  try {
    const { stdout } = await execScript(args);
    return JSON.parse(stdout.trim().split("\n").pop() ?? "");
  } catch (err) {
    const errStdout: unknown = typeof err === "object" && err !== null && "stdout" in err ? err.stdout : undefined;
    if (typeof errStdout === "string" && errStdout.trim() !== "") {
      return JSON.parse(errStdout.trim().split("\n").pop() ?? "");
    }
    throw err;
  }
}

test("LIVE: decode against the committed literal-SYS fixture resolves a numeric entry point", { skip: PETCAT_SKIP_REASON }, async () => {
  const outDir = mkdtempSync(join(tmpdir(), "petcat-literal-"));
  try {
    const result = await runDecodeCli(LITERAL_SYS_FIXTURE, outDir);
    assert.equal(result.ok, true, result.ok ? "" : result.message);
    assert.equal(result.entrypoint, 2064, "the literal fixture's SYS argument must resolve to exactly 2064");
    assert.match(result.entrypointReason ?? "", /literal SYS argument/);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

test(
  "LIVE: decode against the committed computed-SYS fixture declines by name, never guessing an address",
  { skip: PETCAT_SKIP_REASON },
  async () => {
    const outDir = mkdtempSync(join(tmpdir(), "petcat-computed-"));
    try {
      const result = await runDecodeCli(COMPUTED_SYS_FIXTURE, outDir);
      assert.equal(result.ok, true, result.ok ? "" : result.message);
      assert.equal(result.entrypoint, null, "a computed SYS argument must never resolve to a guessed address");
      assert.match(result.entrypointReason ?? "", /peek\(43\)/, "the decline must quote the unresolved expression verbatim");
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  },
);

test("LIVE: decode against the committed non-BASIC fixture is refused by the full seam, never a false success", { skip: PETCAT_SKIP_REASON }, async () => {
  const outDir = mkdtempSync(join(tmpdir(), "petcat-not-basic-"));
  try {
    const result = await runDecodeCli(NOT_BASIC_FIXTURE, outDir);
    assert.equal(result.ok, false, "the planted-failure fixture must be refused, not reported as a success");
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});
