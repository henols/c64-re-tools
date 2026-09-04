#!/usr/bin/env node
// sleigh-compile-gate.test.ts
//
// Phase 36, plan 36-01 (OPC-01, OPC-04): the phase's EARLIEST gate. Per
// D-36-03, this is a hermetic test that invokes `support/sleigh` DIRECTLY --
// the same "a test may invoke a host binary directly" precedent
// `dxa-build-gate.test.ts` already established for `vendor/dxa/build.bash`.
// It needs no host-tool seam change whatsoever; the `.ldefs` id and the
// `-processor` seam change land in the SAME commit (OPC-04), but this gate
// itself is pure filesystem + one direct child-process invocation.
//
// TWO HALVES, per this plan's own `<action>`:
//
// The STRUCTURAL half runs UNCONDITIONALLY, with no Ghidra installation
// present -- it is what keeps this file non-vacuous on a machine with no
// Ghidra at all. It asserts the committed vendored tree's shape: the exact
// six-file set, the two include lines, the `.ldefs` id, and that no `.sla`
// is tracked anywhere in the repository.
//
// The COMPILE half is gated on a `SKIP_REASON` computed ONCE from
// `GHIDRA_HOME` being set and `support/sleigh` existing at the resolved
// path, passed through node:test's own `{ skip }` option on EVERY case --
// never a hand-rolled early return, which would report a false PASS rather
// than a SKIP (mirrors `dxa-live.test.ts`'s own SKIP_REASON idiom). It
// copies the vendored tree into a fresh `mkdtempSync` scratch directory
// (mirroring `dxa-build-gate.test.ts`'s own `makeScratchTree()` discipline),
// copies the three stock 6502 language files in beside it, runs
// `support/sleigh` there, and tears the whole scratch root down in a
// `finally`. This host's `/tmp` is a RAM-backed filesystem whose ageing is
// disabled, so an untorn-down scratch tree is leaked memory, not leaked
// disk -- torn down anyway, always.
//
// THE PASS SIGNAL is three CONJOINED conditions, never a digest comparison
// (unlike `dxa-build-gate.test.ts`'s own build gate): exit status 0, AND the
// `.sla` present on disk after the run, AND the `.sla`'s mtime STRICTLY
// NEWER than every input's mtime (the `.slaspec`, the included `.sinc`, and
// the three copied stock files). A digest against a moving target (Ghidra's
// own compiler, not pinned by this project) cannot catch the failure this
// gate exists for -- a FAILED `sleigh` leaves the PREVIOUS `.sla` in place,
// and only the mtime-ordering half of this three-part condition can catch
// that specific failure mode.
//
// Phase 36, plan 36-01, Task 2 (OPC-01 criterion 2): the planted-violation
// case near the bottom of this file is the RED OBSERVATION the compile gate
// must produce before its own fix is trusted -- reverting one of the eight
// sized-local fixes in a SCRATCH copy (never the committed tree) reproduces
// "Could not resolve at least 1 variable size" naming that constructor's
// own line, and the gate's own three-part condition is asserted NOT
// satisfied. See evidence/36-01-sleigh-gate-red.md for the hand-run
// transcript this test case's assertions were verified against.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { GHIDRA_STOCK_6502_LANGUAGE_FILES } from "./ghidra-project.mts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const VENDOR_DIR = join(HERE, "vendor", "ghidra-ext");
const LANGUAGES_DIR = join(VENDOR_DIR, "data", "languages");

// ---------------------------------------------------------------------------
// STRUCTURAL half -- runs unconditionally, no Ghidra installation required.
// ---------------------------------------------------------------------------

/** Recursively lists every FILE (never a directory) under `dir`, as paths
 * relative to `dir` with forward-slash separators -- so the assertion below
 * is platform-independent and order-independent (sorted before comparison). */
function listFilesRelative(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRelative(abs).map((p) => join(entry.name, p)));
    } else if (entry.isFile()) {
      out.push(entry.name);
    }
  }
  return out.map((p) => p.split(sep).join("/")).sort();
}

const EXPECTED_VENDOR_FILES = [
  "Module.manifest",
  "data/languages/6502_nmos.ldefs",
  "data/languages/6502_nmos.slaspec",
  "data/languages/6502_undocumented.sinc",
  "data/sleighArgs.txt",
  "extension.properties",
].sort();

test("the vendored ghidra-ext tree contains EXACTLY the six committed files -- no more, no less", () => {
  const actual = listFilesRelative(VENDOR_DIR);
  assert.deepEqual(actual, EXPECTED_VENDOR_FILES, `expected exactly ${EXPECTED_VENDOR_FILES.join(", ")}; found ${actual.join(", ")}`);
});

test('6502_nmos.slaspec\'s two lines name "6502.slaspec" and "6502_undocumented.sinc", in that order', () => {
  const text = readFileSync(join(LANGUAGES_DIR, "6502_nmos.slaspec"), "utf8");
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  assert.equal(lines.length, 2, `expected exactly two non-blank lines; got ${lines.length}: ${JSON.stringify(lines)}`);
  assert.match(lines[0]!, /^@include\s+"6502\.slaspec"$/, `expected the first line to include "6502.slaspec"; got ${JSON.stringify(lines[0])}`);
  assert.match(
    lines[1]!,
    /^@include\s+"6502_undocumented\.sinc"$/,
    `expected the second line to include "6502_undocumented.sinc"; got ${JSON.stringify(lines[1])}`,
  );
});

test('6502_nmos.ldefs declares exactly one <language> element with id="6502:LE:16:nmos" and slafile="6502_nmos.sla"', () => {
  const text = readFileSync(join(LANGUAGES_DIR, "6502_nmos.ldefs"), "utf8");
  const languageOpenTags = text.match(/<language\b/g) ?? [];
  assert.equal(languageOpenTags.length, 1, `expected exactly one <language> element; found ${languageOpenTags.length}`);
  assert.match(text, /id="6502:LE:16:nmos"/, 'expected id="6502:LE:16:nmos"');
  assert.match(text, /slafile="6502_nmos\.sla"/, 'expected slafile="6502_nmos.sla"');
});

test("git ls-files reports no tracked path ending in .sla anywhere in the repository", () => {
  const r = spawnSync("git", ["ls-files", "--", "*.sla"], { cwd: REPO_ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, `git ls-files failed: ${r.stderr}`);
  assert.equal(r.stdout.trim(), "", `expected no tracked .sla files; found: ${r.stdout}`);
});

// ---------------------------------------------------------------------------
// COMPILE half -- gated on SKIP_REASON, computed once. Every case below
// passes it through node:test's own `{ skip }` option, never a hand-rolled
// early return (which would report a false PASS rather than a SKIP).
// ---------------------------------------------------------------------------

const GHIDRA_HOME = process.env.GHIDRA_HOME;
const SLEIGH_PATH = GHIDRA_HOME !== undefined && GHIDRA_HOME !== "" ? join(GHIDRA_HOME, "support", "sleigh") : undefined;

const SKIP_REASON: string | false =
  GHIDRA_HOME === undefined || GHIDRA_HOME === ""
    ? "sleigh-compile-gate.test.ts's COMPILE half is opt-in and skipped -- set GHIDRA_HOME to a Ghidra installation directory to run it."
    : !existsSync(SLEIGH_PATH!)
      ? `GHIDRA_HOME is set but "support/sleigh" does not exist at the resolved path (${SLEIGH_PATH}) -- COMPILE half skipped.`
      : false;

const STOCK_LANGUAGES_DIR = GHIDRA_HOME !== undefined ? join(GHIDRA_HOME, "Ghidra", "Processors", "6502", "data", "languages") : undefined;

interface ScratchTree {
  /** Top-level scratch directory -- removed whole in removeScratchTree(). */
  root: string;
  /** The vendored-tree COPY's own data/languages/ directory -- every
   * degenerate case below mutates a file inside THIS directory, never the
   * committed tree. */
  languagesDir: string;
}

/** Copies the REAL vendored extension tree (the six committed files) into a
 * fresh scratch directory, then copies the three stock 6502 language files
 * (`GHIDRA_STOCK_6502_LANGUAGE_FILES`, the SAME list `ghidra.installExtension`
 * itself copies -- host-tool.mts) in beside it, mirroring D-36-02's
 * "materialised at build/install time, never committed" rule. Torn down by
 * the caller in a `finally`. */
function makeScratchTree(): ScratchTree {
  const root = mkdtempSync(join(tmpdir(), "sleigh-compile-gate-test-"));
  const dir = join(root, "ext-copy");
  cpSync(VENDOR_DIR, dir, { recursive: true });
  const languagesDir = join(dir, "data", "languages");
  for (const name of GHIDRA_STOCK_6502_LANGUAGE_FILES) {
    cpSync(join(STOCK_LANGUAGES_DIR!, name), join(languagesDir, name));
  }
  return { root, languagesDir };
}

function removeScratchTree(tree: ScratchTree): void {
  rmSync(tree.root, { recursive: true, force: true });
}

interface SleighRunResult {
  status: number | null;
  output: string;
}

/** Runs the HOST's real `support/sleigh` directly against `slaspecPath`,
 * producing `slaPath` -- never a shell string, an argv array of two already-
 * validated absolute paths. */
function runSleigh(slaspecPath: string, slaPath: string): SleighRunResult {
  const r = spawnSync(SLEIGH_PATH!, [slaspecPath, slaPath], { encoding: "utf8", timeout: 60_000 });
  return { status: r.status, output: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

test(
  "COMPILE: support/sleigh compiles the vendored extension with exit 0, zero errors, and produces a .sla whose mtime is strictly newer than every input",
  { skip: SKIP_REASON },
  () => {
    const tree = makeScratchTree();
    try {
      const slaspecPath = join(tree.languagesDir, "6502_nmos.slaspec");
      const slaPath = join(tree.languagesDir, "6502_nmos.sla");
      const r = runSleigh(slaspecPath, slaPath);

      assert.equal(r.status, 0, `expected exit status 0. Output:\n${r.output}`);
      assert.doesNotMatch(r.output, /^ERROR/m, `expected zero errors. Output:\n${r.output}`);
      // The only two warnings this compile should produce (per this plan's
      // own MEASURED transcript) -- a third, pre-existing "Unreferenced
      // table: 'ADDR8'" warning is inherited from STOCK 6502.slaspec itself
      // (confirmed this session: it appears even compiling 6502.slaspec
      // alone) and is deliberately NOT asserted against here.
      assert.match(r.output, /NOP constructors found/, `expected the "NOP constructors found" warning. Output:\n${r.output}`);
      assert.match(
        r.output,
        /wrote to temporaries that were not read/,
        `expected the "wrote to temporaries that were not read" warning. Output:\n${r.output}`,
      );

      assert.ok(existsSync(slaPath), `expected ${slaPath} to be produced`);
      const slaMtimeMs = statSync(slaPath).mtimeMs;

      const inputs = [
        slaspecPath,
        join(tree.languagesDir, "6502_undocumented.sinc"),
        ...GHIDRA_STOCK_6502_LANGUAGE_FILES.map((name) => join(tree.languagesDir, name)),
      ];
      for (const input of inputs) {
        const inputMtimeMs = statSync(input).mtimeMs;
        assert.ok(
          slaMtimeMs > inputMtimeMs,
          `expected the .sla's mtime (${slaMtimeMs}) to be strictly newer than ${relative(tree.root, input)}'s (${inputMtimeMs})`,
        );
      }
    } finally {
      removeScratchTree(tree);
    }
  },
);

// ---------------------------------------------------------------------------
// Degenerate inputs (must_haves.truths, backstop): each must produce a NAMED
// refusal or a NAMED skip from the gate, never a silent pass. Two of the
// three (empty .sinc, stock-only .slaspec) MEASURE as a successful,
// non-extended sleigh compile -- the "never silently accepted as
// equivalent" property is the gate's own assertion that the degenerate
// output is materially SMALLER than a real extended compile, never treated
// as if it were the real extension. The third (absent input file) is a
// genuine sleigh-level refusal.
// ---------------------------------------------------------------------------

test(
  "COMPILE degenerate: an empty .sinc still compiles (sleigh accepts an empty include), but the produced .sla is materially SMALLER than the real extended one -- never silently indistinguishable",
  { skip: SKIP_REASON },
  () => {
    const tree = makeScratchTree();
    try {
      writeFileSync(join(tree.languagesDir, "6502_undocumented.sinc"), "", "utf8");
      const slaspecPath = join(tree.languagesDir, "6502_nmos.slaspec");
      const slaPath = join(tree.languagesDir, "6502_nmos.sla");
      const r = runSleigh(slaspecPath, slaPath);
      assert.equal(r.status, 0, `expected exit 0 for an empty (but syntactically valid) include. Output:\n${r.output}`);
      assert.ok(existsSync(slaPath), `expected ${slaPath} to still be produced`);
      const degenerateSize = statSync(slaPath).size;
      // MEASURED this plan: a stock-only compile (no extension content at
      // all) produces a 5094-byte .sla; the real extended compile produces
      // one comfortably larger (8000+ bytes). 6000 sits strictly between
      // the two, so this assertion discriminates a real regression (the
      // extension silently compiling to nothing) from the genuine feature.
      assert.ok(
        degenerateSize < 6000,
        `expected an empty-.sinc compile to be materially smaller than a real extended compile (got ${degenerateSize} bytes) -- ` +
          `a size at or above this bound would mean the empty .sinc was silently treated as if it carried the real extension`,
      );
    } finally {
      removeScratchTree(tree);
    }
  },
);

test(
  "COMPILE degenerate: a .slaspec whose only line is the stock @include (the extension's own @include omitted) compiles, but omits the extension entirely -- never silently indistinguishable",
  { skip: SKIP_REASON },
  () => {
    const tree = makeScratchTree();
    try {
      writeFileSync(join(tree.languagesDir, "6502_nmos.slaspec"), '@include "6502.slaspec"\n', "utf8");
      const slaspecPath = join(tree.languagesDir, "6502_nmos.slaspec");
      const slaPath = join(tree.languagesDir, "6502_nmos.sla");
      const r = runSleigh(slaspecPath, slaPath);
      assert.equal(r.status, 0, `expected exit 0 for a stock-only .slaspec. Output:\n${r.output}`);
      assert.ok(existsSync(slaPath), `expected ${slaPath} to still be produced`);
      const degenerateSize = statSync(slaPath).size;
      assert.ok(
        degenerateSize < 6000,
        `expected a stock-only .slaspec's compile to be materially smaller than a real extended compile (got ${degenerateSize} bytes) -- ` +
          `a size at or above this bound would mean the missing extension @include was silently indistinguishable from the real thing`,
      );
    } finally {
      removeScratchTree(tree);
    }
  },
);

test("COMPILE degenerate: an absent input file is refused by sleigh itself with a non-zero exit naming the missing file, and produces no .sla", { skip: SKIP_REASON }, () => {
  const tree = makeScratchTree();
  try {
    const missingSlaspecPath = join(tree.languagesDir, "does-not-exist.slaspec");
    const slaPath = join(tree.languagesDir, "absent-input.sla");
    const r = runSleigh(missingSlaspecPath, slaPath);
    assert.notEqual(r.status, 0, `expected a non-zero exit for a missing input file. Output:\n${r.output}`);
    assert.match(r.output, /File does not exist/, `expected sleigh to name the missing file. Output:\n${r.output}`);
    assert.equal(existsSync(slaPath), false, "expected no .sla to be produced for an absent input file");
  } finally {
    removeScratchTree(tree);
  }
});

// ---------------------------------------------------------------------------
// Phase 36, plan 36-01, Task 2 (OPC-01 criterion 2): the planted-violation
// case. Reverting ONE of the eight sized-local fixes in a SCRATCH copy
// reproduces "Could not resolve at least 1 variable size" naming that
// constructor's own line -- observed here as a test case, and by hand in
// evidence/36-01-sleigh-gate-red.md. The revert happens ONLY inside the
// scratch copy; the committed tree is never touched (asserted separately by
// this task's own <verify> via `git status --porcelain`).
// ---------------------------------------------------------------------------

/** The fixed form of the `:NOP imm16` constructor (doc line 220, this
 * plan's own committed `.sinc` line 232) -- one of the eight sites named in
 * `36-RESEARCH.md`'s "The 8 failing SLEIGH constructors and the verified
 * fix". Reverting it to its PRE-fix form (passing the raw `imm16` token
 * field directly to the dereference, with no sized local) is the planted
 * violation. */
const FIXED_NOP_ABSOLUTE = ':NOP imm16 is op=0x0c; imm16\n{\n    local a16:2 = imm16;\n    local ignored:1 = *:1 a16;\n}';
const REVERTED_NOP_ABSOLUTE = ':NOP imm16 is op=0x0c; imm16\n{\n    local ignored:1 = *:1 imm16;\n}';

test(
  'PLANTED VIOLATION: reverting the ":NOP imm16" (op=0x0c) sized-local fix reddens the compile gate, naming "Could not resolve at least 1 variable size" and the reverted constructor\'s own line',
  { skip: SKIP_REASON },
  () => {
    const tree = makeScratchTree();
    try {
      const sincPath = join(tree.languagesDir, "6502_undocumented.sinc");
      const original = readFileSync(sincPath, "utf8");
      assert.ok(original.includes(FIXED_NOP_ABSOLUTE), "expected the committed .sinc to still carry the fixed form -- has the source drifted?");
      const reverted = original.replace(FIXED_NOP_ABSOLUTE, REVERTED_NOP_ABSOLUTE);
      writeFileSync(sincPath, reverted, "utf8");

      const slaspecPath = join(tree.languagesDir, "6502_nmos.slaspec");
      const slaPath = join(tree.languagesDir, "6502_nmos.sla");
      const r = runSleigh(slaspecPath, slaPath);

      // The gate's three-part condition (exit 0 AND .sla present AND mtime
      // newer) must NOT be satisfied -- asserted on the compiler's OWN error
      // text, never merely on a differing exit status.
      assert.notEqual(r.status, 0, `expected a non-zero exit on the reverted (planted-violation) tree. Output:\n${r.output}`);
      assert.match(r.output, /Could not resolve at least 1 variable size/, `expected the compiler's own size-resolution error. Output:\n${r.output}`);
      // The reverted constructor starts at line 232 in the committed tree
      // (MEASURED, this plan); the compiler's own diagnostic quotes that
      // line number twice -- once for the constructor, once for the failing
      // statement inside it.
      assert.match(r.output, /6502_undocumented\.sinc:232/, `expected the error to name line 232 (the reverted constructor). Output:\n${r.output}`);
      assert.equal(existsSync(slaPath), false, "expected no .sla to be produced on the reverted tree -- a failed sleigh must leave nothing behind here");
    } finally {
      removeScratchTree(tree);
    }
  },
);
