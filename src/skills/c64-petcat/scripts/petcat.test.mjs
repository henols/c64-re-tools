#!/usr/bin/env node
// petcat.test.mjs -- coverage for this skill script's own CLI plumbing
// (IN-01, 40-REVIEW.md). Added in the fix pass for Phase 40's code review:
// petcat.mjs shipped in the same phase as c1541.mjs, wrapping the SAME
// host-tool seam pattern (invokeSeam(), commonAncestorDir()/toRel(),
// selfPath()), but had no test file at all -- c1541.mjs's own
// c1541.test.mjs was the model this file mirrors.
//
// Two tiers, deliberately separated (same split as c1541.test.mjs):
//
//   1. PURE unit tests against the exported `parseOpts()` -- never call the
//      seam, never need `petcat` installed, ALWAYS run (keeps this file safe
//      under CI's `node --test 'src/skills/*/scripts/*.test.mjs'` glob,
//      which has no VICE install at all).
//   2. LIVE end-to-end cases that run the real `decode` CLI verb over the
//      real seam against the committed fixtures (`fixtures/dxa/basic-stub.prg`,
//      `fixtures/petcat/computed-sys.prg`, `fixtures/petcat/not-basic.prg`),
//      gated on `petcat` actually being resolvable on PATH, skipped with a
//      named reason otherwise -- mirrors c1541.test.mjs's own live-test skip
//      convention verbatim, never a hand-rolled early return that would
//      report a false PASS. (The real dispatch resolves `petcat` as a
//      sibling of whichever `x64sc` backend-detect.mts resolves, not via a
//      bare PATH search -- this PATH check is the SAME imperfect-but-
//      accepted go/no-go proxy c1541.test.mjs already uses for `c1541`.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { parseOpts } from "./petcat.mjs";
import { projectRoot } from "../../c64-ram-capture/scripts/project-paths.mjs";

const execFileP = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "petcat.mjs");
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

// decode's own exit code is response.ok ? 0 : 1 (unlike c1541's `audit`
// verb, which always exits 0) -- execFile's promisified form rejects on a
// non-zero exit, so a refused decode is read off the REJECTED error's own
// `.stdout`, not a resolved value.
async function runDecodeCli(imagePath, outDir) {
  const args = [SCRIPT, "decode", "--image", imagePath, "--out-dir", outDir, "--json"];
  try {
    const { stdout } = await execFileP(process.execPath, args);
    return JSON.parse(stdout.trim().split("\n").pop());
  } catch (err) {
    if (typeof err.stdout === "string" && err.stdout.trim() !== "") {
      return JSON.parse(err.stdout.trim().split("\n").pop());
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
    assert.match(result.entrypointReason, /literal SYS argument/);
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
      assert.match(result.entrypointReason, /peek\(43\)/, "the decline must quote the unresolved expression verbatim");
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
