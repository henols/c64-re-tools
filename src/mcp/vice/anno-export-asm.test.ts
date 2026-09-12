// anno-export-asm.test.ts -- the exporter's own gates.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// `anno-export-asm.ts` produces text that CLAIMS to reassemble. The previous
// export route was withdrawn in Phase 29 precisely because that claim was
// never checked by an assembler. This file is where the claim is settled, and
// it is settled the only way that means anything: a REAL ACME 0.97 assembles
// the exporter's own output and the resulting bytes are compared, octet by
// octet, against bytes taken from the IMAGE.
//
// The `*`-assertion tests are the second half of the same idea. A byte-diff
// proves the bytes agree; the `!if * != $XXXX` brackets prove that a
// length-changing mistake INSIDE a block cannot shift everything after it
// while the totals still look right. Both planted-violation tests below exist
// to show that those brackets genuinely bite -- an assertion nobody has ever
// seen fail is indistinguishable from an assertion that cannot fail.
//
// ---------------------------------------------------------------------------
// WHAT THIS FILE IS THE ONE AUTHORITATIVE PLACE FOR
// ---------------------------------------------------------------------------
// Whether `exportAsm()`'s output reassembles byte-identically, and whether the
// controls it carries (the block brackets, the symbol-definition width rule,
// the typed-data emitter, the comment refusals) do what they say. Nothing here
// re-implements the exporter's logic to check it -- every positive verdict
// comes from a real assembler run plus a byte comparison.
//
// ---------------------------------------------------------------------------
// GATE
// ---------------------------------------------------------------------------
// Exactly ONE test always runs and is never skipped: "ACME availability gate".
// With VICE_REQUIRE_ACME set (CI's Test step) a missing ACME FAILS that test.
// Locally, with no ACME installed, every other ACME-dependent test skips with
// a named reason through node:test's own `{ skip }` option. SKIP_REASON is
// computed ONCE at module scope by the shared `acme-gate.ts` seam -- never a
// hand-rolled `if (!available) return`, which would report a false PASS where
// a SKIP is the truth.
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO
// ---------------------------------------------------------------------------
//   - Never hardcode a static list where the source table can drive the
//     assertions. The twelve-member data-type suite iterates `DATA_TYPES`
//     imported from `anno-types.ts`, so a thirteenth member added later is
//     covered the next time this file runs. A copied list would silently stop
//     covering the vocabulary the moment it grew.
//   - Never hardcode a static "known unassemblable" list for the 256-opcode
//     suite, in the same voice `disasm-roundtrip.test.ts:33-37` uses it. Every
//     assertion there is driven from `disasm-opcodes.ts`'s own `OPCODES` table,
//     so a future correction to that table is automatically re-verified the
//     next time this file runs -- and that matters here more than anywhere: an
//     internally-verified version of that table shipped FOURTEEN wrong entries,
//     caught only by running its output through a real assembler.
//   - Never treat an ACME stderr WARNING as a failure. ACME 0.97 emits
//     `Warning (Zone <untitled>): Wrong type - expected address.` and
//     `Using oversized addressing mode.` on legal, byte-correct output at exit
//     0. A positive case here is proved by `outcome === "ok"` with
//     `byteDiff.equal === true`, never by an exit status.
//   - Never call `verifyAcmeAssembles()` anywhere but inside
//     `verifyExportText()`. That helper always supplies the REQUIRED
//     `expectedSegments`, so the unanimity rule against ACME's own per-segment
//     lines has exactly one place to be right and cannot be dropped from a
//     later test by omission. `verifyExport()` is a one-line delegation to it
//     for the common "verify this export's own source" case; a test that needs
//     to verify MUTATED source text against an UNMUTATED export's expectations
//     calls `verifyExportText()` directly rather than growing a second call
//     site.
//   - Never interpolate a source string into a shell command. `assembleRaw()`
//     writes it to a file and spawns ACME with an argv array.
//   - Never write the eleven auto-name prefixes as an array literal in this
//     file. They are PARSED out of `AUTO_NAME_PREFIX_RE.source`'s own
//     alternation, so a twelfth prefix added to that regex is covered the next
//     time this file runs and a five-prefix copy anywhere is caught. A literal
//     list here would be the very reimplementation the structural scan below
//     exists to detect -- committed in the file that detects it.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "./build.ts";
import { ACME_BIN, acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./acme-gate.ts";
import { ACME_VERIFY_ARGV_FLAGS, parseAcmeDiagnostics, verifyAcmeAssembles, type AcmeVerifyResult } from "./acme-verify.ts";
import {
  assertDataTypeForExport,
  assertExportableCommentText,
  EXCLUSION_MARKER_PREFIX,
  exportAsm,
  exportAsmTree,
  ROOT_FILE_NAME,
  SYMBOLS_FILE_NAME,
  UNSCOPED_FILE_NAME,
  scopeFileName,
  substituteImmediateEnum,
  type ExportAsmOptions,
  type ExportAsmResult,
  type ExportAsmTreeResult,
  type ExportBlock,
} from "./anno-export-asm.ts";
import { AUTO_NAME_PREFIX_RE } from "./anno-coverage.ts";
// Phase 46 plan 06 (BUILD-07): the real ledger reader, used by the
// TEST-ONLY filtering variant below to decide which ranges to drop -- never
// re-derived, on the same "re-check, never re-define" terms this file
// already applies elsewhere.
import { provenanceForRange, readProvenanceLedger } from "./anno-provenance-ledger.ts";
// Phase 46 plan 06 (BUILD-07): the ONE comment-and-string-literal stripper
// in this tree (shipped-modules.ts's own header), so the structural guard
// below cannot be satisfied or invalidated by this module's own prose
// discussing the forbidden shape at length.
import { codeOnly } from "./shipped-modules.ts";
// BUILD-05 (phase 46 plan 01): `renderLedger()` is the ONE writer of the
// generated tier this fixture must satisfy exactly (its own three refusal
// preconditions -- non-empty UNKNOWN reasons, agreeing_releases >= 2 for
// ORIGINAL, and full $0000-$FFFF coverage with no gap or overlap). A TEST
// importing the skill tree is precedented -- `skill-memory-mapping-cli.test.ts`
// does exactly this for `c64-memory-mapping`'s own `driver.mjs` -- and tests
// are not in `package.json`'s `files[]`, so the shipped-closure rule this
// file's own header names is untouched.
// diff-images.mjs has no declaration file (a plain, unmodified skill script);
// the single suppression below is scoped to this one import line, never a
// project-wide relaxation.
// @ts-expect-error -- diff-images.mjs (a plain skill script, left unmodified) has no .d.mts
import { renderLedger } from "../../skills/c64-provenance-diff/scripts/diff-images.mjs";
import {
  addExcludedRange,
  addScope,
  applyEnumUsage,
  createProjectEnum,
  openStore,
  closeStore,
  listComments,
  listEnumUsage,
  listLabels,
  listRanges,
  setComment,
  setDataType,
  setLabel,
} from "./anno-store.ts";
import { AnnoCommentError, DATA_TYPES } from "./anno-types.ts";
// D-16/D-17 (plan 45-05): the ONE owning decoder's own test-only cache reset,
// used ONLY to construct a synthetic register table for the one collision
// scenario the REAL committed anno-regbits.json cannot reach (see the test
// that uses it for why -- decomposeRegisterValue()'s name<->value mapping is
// a bijection for any one real, well-formed field, so "same name, different
// value" can only be reproduced with a deliberately non-injective synthetic
// token table, exactly `anno-enum-gen.test.ts`'s own sanctioned technique).
import { __resetRegBitsCacheForTests } from "./anno-enum-gen.ts";
import type { RegBitsTable } from "./anno-regbits-gen.ts";
import { decode } from "./disasm-decoder.ts";
import { OPCODES } from "./disasm-opcodes.ts";

/** Computed exactly once, by the shared seam. Every ACME-dependent test in
 * this file passes this through node:test's own `{ skip }` option. */
const SKIP_REASON: string | false = acmeSkipReasonFor("anno-export-asm.test.ts");

const HERE = dirname(fileURLToPath(import.meta.url));

/** The committed self-modifying fixture and the ACME source it was assembled
 * from. See `fixtures/export-asm/README.md` for the provenance table. */
const SMC_DIR = join(HERE, "fixtures", "export-asm");
const SMC_SOURCE_PATH = join(SMC_DIR, "smc.a");
const SMC_PRG_PATH = join(SMC_DIR, "smc.prg");

// ---------------------------------------------------------------------------
// Phase 47, plan 47-01 (criterion 1): the byte-diff oracle for a WRITTEN
// TREE must be reached through `runHostTool()`, never through
// `acme-verify.ts` (which is single-file by design and never widened -- hard
// scope fence 3). Reached as the BUILT artifact, copying host-tool.test.ts's
// own `build()`-then-`import("./resources/host-tool.mjs")` idiom verbatim
// rather than inventing a second one.
// ---------------------------------------------------------------------------
build();
const hostToolModule = (await import(new URL("./resources/host-tool.mjs", import.meta.url).href)) as unknown as {
  runHostTool: (
    raw: unknown,
    deps: { repoRoot: string; log?: (line: string) => void; timeoutMs?: number },
  ) => Promise<
    | { ok: true; tool: string; exitStatus: number | null; results: Array<{ path: string; sha256: string; byteLength: number }>; stderrTail: string }
    | { ok: false; message: string }
  >;
};
const { runHostTool } = hostToolModule;

test("ACME availability gate", () => {
  assertAcmeRequiredIfEnvSet(assert);
});

// ---------------------------------------------------------------------------
// One temp directory for the whole file, removed in `after()`. This host's
// `/tmp` is RAM-backed, so a leaked directory is leaked memory (T-30-07).
// ---------------------------------------------------------------------------

let workDir: string | undefined;
let dirCounter = 0;

/** A fresh, empty subdirectory of this file's single work directory. */
function freshDir(tag: string): string {
  if (!workDir) workDir = mkdtempSync(join(tmpdir(), "anno-export-asm-"));
  const dir = join(workDir, `${tag}-${dirCounter++}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

after(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

/** What `buildStore()` writes: a `.prg` body at `origin`, plus the store rows
 * the export is supposed to read. */
interface StoreSpec {
  origin: number;
  body: readonly number[];
  ranges: readonly { start: number; endInclusive: number; dataType: string }[];
  labels?: readonly { address: number; name: string }[];
  comments?: readonly { address: number; commentType: string; text: string }[];
  enums?: readonly { name: string; variants: Record<string, string> }[];
  enumUsage?: readonly { address: number; name: string }[];
  /** BUILD-07 (phase 46 plan 05): recorded through `addExcludedRange()` --
   * the store's own public write verb, never raw SQL -- for the same reason
   * this doc-comment already gives for every other row here: a fixture
   * built this way has passed the same validators a live `anno_*` tool call
   * would have passed it through. */
  exclusions?: readonly { start: number; endInclusive: number; reason: string }[];
  /** Phase 47, plan 47-01: recorded through `addScope()` -- the store's own
   * public write verb, on the same "never raw SQL" terms every other row
   * here already follows. */
  scopes?: readonly { start: number; endInclusive: number }[];
}

interface StoreFixture {
  dir: string;
  storePath: string;
  imagePath: string;
}

/**
 * Writes a `.prg` (2-byte little-endian load address then `body`) and a REAL
 * store carrying `spec`'s rows, through the store's own public write verbs --
 * never raw SQL, so every row in a fixture has passed the same validators a
 * live `anno_*` tool call would have passed it through.
 */
function buildStore(dir: string, spec: StoreSpec): StoreFixture {
  mkdirSync(dir, { recursive: true });
  const imagePath = join(dir, "game.prg");
  writeFileSync(imagePath, Buffer.from([spec.origin & 0xff, (spec.origin >> 8) & 0xff, ...spec.body]));

  const storePath = join(dir, "anno.sqlite");
  const handle = openStore(storePath, { workspaceRoot: dir });
  try {
    for (const range of spec.ranges) setDataType(handle, range);
    for (const label of spec.labels ?? []) setLabel(handle, { ...label, kind: "User" });
    for (const comment of spec.comments ?? []) setComment(handle, comment);
    for (const projectEnum of spec.enums ?? []) createProjectEnum(handle, projectEnum);
    for (const usage of spec.enumUsage ?? []) applyEnumUsage(handle, usage);
    for (const exclusion of spec.exclusions ?? []) addExcludedRange(handle, exclusion);
    for (const scope of spec.scopes ?? []) addScope(handle, scope);
  } finally {
    closeStore(handle);
  }

  return { dir, storePath, imagePath };
}

/**
 * A store built in a fresh temp directory over an image ALREADY ON DISK.
 *
 * The committed fixtures are the point of the tests that use this: their bytes
 * are what a real assembler wrote, not a `body` array this file invented, so
 * the store has to be attached to the file rather than the file synthesised
 * from the store.
 */
function buildStoreOverImage(tag: string, imagePath: string, spec: Omit<StoreSpec, "origin" | "body">): StoreFixture {
  const dir = freshDir(tag);
  const storePath = join(dir, "anno.sqlite");
  const handle = openStore(storePath, { workspaceRoot: dir });
  try {
    for (const range of spec.ranges) setDataType(handle, range);
    for (const label of spec.labels ?? []) setLabel(handle, { ...label, kind: "User" });
    for (const comment of spec.comments ?? []) setComment(handle, comment);
    for (const projectEnum of spec.enums ?? []) createProjectEnum(handle, projectEnum);
    for (const usage of spec.enumUsage ?? []) applyEnumUsage(handle, usage);
    for (const exclusion of spec.exclusions ?? []) addExcludedRange(handle, exclusion);
  } finally {
    closeStore(handle);
  }
  return { dir, storePath, imagePath };
}

/** What a raw ACME run tells us when the verdict layer is deliberately out of
 * the way: its own exit status, its own streams, and whether it wrote a file. */
interface RawAssembly {
  status: number | null;
  stdout: string;
  stderr: string;
  outputExists: boolean;
}

/**
 * Assembles `source` with the real `ACME_BIN` and reports ACME's OWN exit
 * status, streams and output-file existence.
 *
 * This exists for the planted-violation tests only. They are about what the
 * assembler does when the source is wrong, and the verdict layer deliberately
 * never exposes the exit status as a verdict -- so those observations have to
 * be taken here, one level below it. Every POSITIVE case in this file goes
 * through `verifyExport()` instead.
 */
function assembleRaw(source: string): RawAssembly {
  const dir = freshDir("raw");
  const srcPath = join(dir, "planted.a");
  const outPath = join(dir, "planted.bin");
  writeFileSync(srcPath, source, "utf8");
  const r = spawnSync(ACME_BIN, [...ACME_VERIFY_ARGV_FLAGS, "-o", outPath, srcPath], { encoding: "utf8", timeout: 30_000 });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "", outputExists: existsSync(outPath) };
}

/**
 * The ONE place this file reaches the verify primitive.
 *
 * It always passes `expectedSegments: result.blocks`, which is what keeps the
 * unanimity rule against ACME's own per-segment result lines from being
 * dropped by omission in some later test. It passes no `acmeBin`, so every
 * round trip in this file runs against the real assembler.
 *
 * `source` IS A SEPARATE PARAMETER FROM `result` ON PURPOSE. The negative
 * controls in this file take a valid export and apply ONE documented mutation
 * to its text, then ask whether the assembler still reproduces the bytes the
 * UNMUTATED export said it must. Both halves have to come from the same call:
 * mutating `result.source` in place would move the expectations along with the
 * mutation and the control would prove nothing.
 *
 * A test that wants a DELIBERATELY mismatched segment list passes it
 * explicitly at its own call site rather than editing this helper -- widening
 * the one correct call is how the rule stops being run everywhere.
 */
function verifyExportText(result: ExportAsmResult, source: string): AcmeVerifyResult {
  return verifyAcmeAssembles({
    source,
    expectedBytes: result.expectedBytes,
    expectedSegments: result.blocks,
  });
}

/** The common case: verify an export's own source against its own
 * expectations. A one-line delegation, so the call site above does not
 * multiply. */
function verifyExport(result: ExportAsmResult): AcmeVerifyResult {
  return verifyExportText(result, result.source);
}

/**
 * The `name = $XXXX` definition line for `name`, with any trailing marker
 * comment split off.
 *
 * An auto-generated name's definition carries a fixed trailing comment (the
 * annotation-backlog marker), so a test about the DEFINITION -- its hex-digit
 * count, its presence, its position -- compares the part before the comment
 * rather than the whole line. Split on the two-space `;` separator this module
 * uses everywhere, so a definition that never grew a comment compares
 * unchanged.
 */
function definitionOf(lines: readonly string[], name: string): string | undefined {
  return lines.find((line) => line.startsWith(`${name} = `))?.split("  ;")[0];
}

/** A verdict rendered for a failure message: everything a human needs to see
 * why, without re-running anything. */
function context(result: ExportAsmResult, verdict: AcmeVerifyResult): string {
  return (
    `\n  outcome: ${verdict.outcome}` +
    `\n  reason: ${verdict.reason}` +
    `\n  diagnostics: ${verdict.diagnostics.join(" | ") || "(none)"}` +
    `\n  acmeResultLines: ${verdict.acmeResultLines.join(" | ") || "(none)"}` +
    `\n  source:\n${result.source}`
  );
}

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

/** `lda #$00` / `sta $d020` / `rts` -- six bytes covering $0801..$0806, so the
 * block's EXCLUSIVE end is $0807. */
const SHAPE_BODY = [0xa9, 0x00, 0x8d, 0x20, 0xd0, 0x60] as const;

/**
 * `lda #$00` / `lda $90` / `sta $0090` / `rts` -- eight bytes covering
 * $0801..$0808, exclusive end $0809.
 *
 * Deliberately carries BOTH operand shapes for the same zero-page address:
 * a zeropage-mode operand, which `disasm-renderer.ts` renders as a hex literal
 * and never substitutes a symbol into (D-11), and an absolute-mode operand
 * below $0100, which it renders with ACME's `+2` size-forcing postfix. The two
 * planted violations below each attack one of them.
 */
const PLANTED_BODY = [0xa9, 0x00, 0xa5, 0x90, 0x8d, 0x90, 0x00, 0x60] as const;

function shapeFixture(tag: string): StoreFixture {
  return buildStore(freshDir(tag), {
    origin: 0x0801,
    body: SHAPE_BODY,
    ranges: [{ start: 0x0801, endInclusive: 0x0806, dataType: "code" }],
    labels: [{ address: 0x0801, name: "entry" }],
  });
}

function plantedFixture(tag: string): StoreFixture {
  return buildStore(freshDir(tag), {
    origin: 0x0801,
    body: PLANTED_BODY,
    ranges: [{ start: 0x0801, endInclusive: 0x0808, dataType: "code" }],
    labels: [
      { address: 0x0090, name: "zpf_90" },
      { address: 0x0801, name: "entry" },
    ],
  });
}

/** Phase 47, plan 47-01: `shapeFixture()`'s own body/range, plus ONE scope
 * covering the whole range -- the simplest case `exportAsmTree()`'s tree-file-
 * set test needs. */
function oneScopeFixture(tag: string): StoreFixture {
  return buildStore(freshDir(tag), {
    origin: 0x0801,
    body: SHAPE_BODY,
    ranges: [{ start: 0x0801, endInclusive: 0x0806, dataType: "code" }],
    labels: [{ address: 0x0801, name: "entry" }],
    scopes: [{ start: 0x0801, endInclusive: 0x0806 }],
  });
}

// ---------------------------------------------------------------------------
// Shape: the block brackets. No assembler needed -- these assert the exact
// text, so a later reformat cannot quietly drop an assertion.
// ---------------------------------------------------------------------------

test("one block is bracketed: the symbol header, then `* =`, the origin assertion, the block's lines, and the end assertion at endInclusive + 1", () => {
  const { dir, storePath, imagePath } = shapeFixture("shape-one");
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  const lines = result.source.split("\n");

  const originLine = lines.indexOf("* = $0801");
  const originAssert = lines.indexOf('!if * != $0801 { !error "export-asm: block origin drifted, expected $0801" }');
  const endAssert = lines.indexOf('!if * != $0807 { !error "export-asm: block end drifted, expected $0807" }');

  assert.ok(originLine >= 0, `the origin line must be emitted verbatim:\n${result.source}`);
  assert.ok(originAssert >= 0, `the origin assertion must be emitted verbatim:\n${result.source}`);
  assert.ok(
    endAssert >= 0,
    `the end assertion names the EXCLUSIVE end -- $0807 for a range whose endInclusive is $0806, which is the ` +
      `inclusive-to-exclusive conversion this project carries at six boundaries:\n${result.source}`,
  );

  assert.equal(originAssert, originLine + 1, "the origin assertion sits immediately after the `* =` it checks");
  assert.ok(endAssert > originAssert + 1, "the block's own lines sit between the two assertions");
  assert.equal(endAssert, lines.length - 2, "the end assertion is the last line of a one-block export (the trailing newline makes the last element empty)");

  // Every symbol definition is emitted BEFORE the first `* =` -- Pitfall 4's
  // mitigation, which the end assertion is the backstop for.
  const definition = lines.indexOf("entry = $0801");
  assert.ok(definition >= 0 && definition < originLine, `symbol definitions belong in a header block before the first \`* =\`:\n${result.source}`);
});

test("two blocks are bracketed independently, and `blocks.length === 2`", () => {
  const body = [0xa9, 0x00, 0x60, ...Array(12).fill(0xee), 0xea];
  const { dir, storePath, imagePath } = buildStore(freshDir("shape-two"), {
    origin: 0x0801,
    body,
    ranges: [
      { start: 0x0801, endInclusive: 0x0803, dataType: "code" },
      { start: 0x0810, endInclusive: 0x0810, dataType: "code" },
    ],
    labels: [],
  });
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  assert.equal(result.blocks.length, 2);
  for (const expected of [
    "* = $0801",
    '!if * != $0801 { !error "export-asm: block origin drifted, expected $0801" }',
    '!if * != $0804 { !error "export-asm: block end drifted, expected $0804" }',
    "* = $0810",
    '!if * != $0810 { !error "export-asm: block origin drifted, expected $0810" }',
    '!if * != $0811 { !error "export-asm: block end drifted, expected $0811" }',
  ]) {
    assert.ok(result.source.split("\n").includes(expected), `missing line ${JSON.stringify(expected)}:\n${result.source}`);
  }
});

test("a symbol below $0100 is defined with TWO hex digits and one at or above with FOUR -- the definition's width decides the operand's width", () => {
  const { dir, storePath, imagePath } = plantedFixture("width");
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  const lines = result.source.split("\n");

  // Compared on the DEFINITION only, with any trailing marker comment split
  // off: `zpf_90` matches the auto-name prefix set, so its line also carries
  // the backlog marker. The digit count is what this test is about, and a
  // comment cannot change a byte.
  assert.equal(
    definitionOf(lines, "zpf_90"),
    "zpf_90 = $90",
    `measured on ACME 0.97: \`zpf = $10\` then \`lda zpf\` is 2 bytes (zeropage) while \`zpf = $0010\` then the same line is ` +
      `3 bytes (absolute), so the DEFINITION's digit count is a byte-width decision:\n${result.source}`,
  );
  assert.ok(lines.includes("entry = $0801"), `an address at or above $0100 takes four digits:\n${result.source}`);
  assert.equal(result.symbolCount, 2);
});

test("running the exporter twice over an unchanged store and image produces byte-identical source", () => {
  const { dir, storePath, imagePath } = plantedFixture("determinism");
  const first = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  const second = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  assert.equal(second.source, first.source, "emission order is derived from sorted addresses, never from row insertion order");
});

// ---------------------------------------------------------------------------
// Round trip: the positive case, proved by the byte-diff and never by an exit
// status.
// ---------------------------------------------------------------------------

test("the bracketed export reassembles byte-identically through real ACME", { skip: SKIP_REASON }, () => {
  const { dir, storePath, imagePath } = plantedFixture("roundtrip");
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  const verdict = verifyExport(result);

  assert.equal(verdict.outcome, "ok", `the bracketed export must round-trip:${context(result, verdict)}`);
  assert.equal(verdict.byteDiff?.equal, true, `the byte-diff IS the verdict:${context(result, verdict)}`);
});

// ---------------------------------------------------------------------------
// Planted violations: proof the end assertion can bite.
// ---------------------------------------------------------------------------

test("PLANTED VIOLATION 1: removing the `+2` width force shrinks an instruction, and the end assertion fires on real ACME", { skip: SKIP_REASON }, () => {
  const { dir, storePath, imagePath } = plantedFixture("planted-1");
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  // The PAIRED direction first: an unmodified export assembles cleanly. Without
  // it, a red below could just as well be a broken fixture as a working control.
  const clean = assembleRaw(result.source);
  assert.equal(clean.status, 0, `the UNMODIFIED export must assemble:\n  stderr: ${clean.stderr}\n${result.source}`);
  assert.equal(clean.outputExists, true, "the unmodified export must write an output file");

  // ONE documented substitution: drop ACME's `+2` size-forcing postfix from the
  // absolute operand below $0100. ACME then re-encodes `sta $0090` to zeropage
  // -- two bytes where the original was three -- and everything after it shifts.
  const forced = "sta+2 zpf_90";
  assert.ok(result.source.includes(forced), `the fixture must actually carry the width force, or the substitution tests nothing:\n${result.source}`);
  const planted = result.source.replace(forced, "sta zpf_90");
  assert.notEqual(planted, result.source, "the substitution must change the source");

  const widened = assembleRaw(planted);
  assert.equal(widened.status, 1, `ACME must REFUSE the shifted source:\n  stdout: ${widened.stdout}\n  stderr: ${widened.stderr}`);
  assert.ok(
    widened.stderr.includes("!error: export-asm: block end drifted"),
    `the end assertion's OWN message must be what stopped it:\n  stderr: ${widened.stderr}`,
  );
  assert.equal(widened.outputExists, false, "a failed !error assertion writes NO output file -- there is nothing for a stale-file read to find");
});

test("PLANTED VIOLATION 2: a symbol substituted into a zeropage operand with its definition moved below the first `* =` widens the instruction, and the end assertion fires", { skip: SKIP_REASON }, () => {
  const { dir, storePath, imagePath } = plantedFixture("planted-2");
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  // RESEARCH.md Pitfall 4, reproduced on this exporter's own output. Two
  // things have to be undone at once, and that is the finding rather than an
  // inconvenience: `disasm-renderer.ts` never substitutes a symbol into a
  // zeropage operand (D-11), AND every definition is emitted before the first
  // `* =`. Undo BOTH and ACME assembles `lda zpf_90` as absolute -- three bytes
  // where the original was two, with only
  //   `Warning (Zone <untitled>): Using oversized addressing mode.`
  // to show for it at exit 0 in isolation. Here the end assertion converts that
  // silent widening into a refusal.
  // The definition line is READ OUT OF THE EXPORT rather than retyped: `zpf_90`
  // matches the auto-name prefix set, so its line also carries the backlog
  // marker, and a retyped literal would silently match nothing -- leaving the
  // source unmodified and the "violation" passing for the wrong reason.
  const zpDefinitionLine = result.source.split("\n").find((line) => line.startsWith("zpf_90 = "));
  assert.ok(zpDefinitionLine !== undefined, `the fixture must define zpf_90:\n${result.source}`);

  const planted = result.source
    .replace(`${zpDefinitionLine}\n`, "")
    .replace("        lda $90", "        lda zpf_90")
    .replace("        rts\n", `        rts\n${zpDefinitionLine}\n`);
  assert.ok(planted.includes("        lda zpf_90"), `the zeropage operand must actually carry the symbol:\n${planted}`);
  assert.ok(planted.indexOf("zpf_90 = $90") > planted.indexOf("* = $0801"), `the definition must sit below the first \`* =\`:\n${planted}`);

  const widened = assembleRaw(planted);
  assert.equal(widened.status, 1, `ACME must REFUSE the widened source:\n  stdout: ${widened.stdout}\n  stderr: ${widened.stderr}`);
  assert.ok(
    widened.stderr.includes("!error: export-asm: block end drifted"),
    `the end assertion's OWN message must be what stopped it:\n  stderr: ${widened.stderr}`,
  );
  assert.equal(widened.outputExists, false, "no output file survives a failed !error assertion");

  // The MEASURED counter-case, recorded because it is the reason the two
  // mitigations are both needed: the definition move ALONE, with the `+2` force
  // intact, assembles at exit 0 with byte-identical output. The header block
  // and the width force cover the same hazard from different sides, and the
  // block brackets are what covers losing both.
  const moveOnly = result.source.replace(`${zpDefinitionLine}\n`, "").replace("        rts\n", `        rts\n${zpDefinitionLine}\n`);
  const survived = assembleRaw(moveOnly);
  assert.equal(survived.status, 0, `the move alone must NOT fire -- the \`+2\` force already holds the width:\n  stderr: ${survived.stderr}`);
  assert.equal(survived.outputExists, true, "the move alone still produces an output file");
});

// ---------------------------------------------------------------------------
// Phase 47, plan 47-04 (BUILD-03): every in-tree reference goes through a
// symbol, or the export refuses by name. `jsr`/`jmp`/a relative branch/a
// data reference/an indirect vector all read the SAME `referencedAddress()`
// extraction and the SAME `isInTree()` boundary test inside `exportAsm()`;
// each case below exercises one operand shape so a future change that only
// fixed one of them cannot pass silently. A reference to an address OUTSIDE
// every emitted block -- fixed hardware, never moved by a rebuild -- is the
// paired non-vacuity control: it must NOT refuse, or this whole rule would
// make every real export impossible.
// ---------------------------------------------------------------------------

test("symbol rule: an in-tree `jsr` with no label at its target makes exportAsm() throw, naming both addresses and the count", () => {
  const { dir, storePath, imagePath } = buildStore(freshDir("symrule-jsr-unresolved"), {
    origin: 0x0801,
    // jsr $0806 / nop / nop / nop / rts -- $0806 (the `rts`) is inside the
    // $0801..$0807 block and carries no label.
    body: [0x20, 0x06, 0x08, 0xea, 0xea, 0xea, 0x60],
    ranges: [{ start: 0x0801, endInclusive: 0x0807, dataType: "code" }],
    labels: [],
  });

  assert.throws(
    () => exportAsm({ storePath, imagePath, workspaceRoot: dir }),
    (e: unknown) => {
      assert.ok(e instanceof Error);
      assert.match(e.message, /^exportAsm: /, "every refusal from this module is prefixed `exportAsm:`");
      assert.ok(e.message.includes("$0801"), `the refusal names the REFERRING address: ${e.message}`);
      assert.ok(e.message.includes("$0806"), `the refusal names the TARGET address: ${e.message}`);
      assert.ok(e.message.includes("1 of 1"), `the refusal states the count: ${e.message}`);
      return true;
    },
  );
});

test("symbol rule: the same `jsr` store with a label recorded at the target exports cleanly, renders the symbol, and reassembles byte-identically", { skip: SKIP_REASON }, () => {
  const { dir, storePath, imagePath } = buildStore(freshDir("symrule-jsr-resolved"), {
    origin: 0x0801,
    body: [0x20, 0x06, 0x08, 0xea, 0xea, 0xea, 0x60],
    ranges: [{ start: 0x0801, endInclusive: 0x0807, dataType: "code" }],
    labels: [{ address: 0x0806, name: "target" }],
  });

  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  assert.ok(result.source.includes("jsr target"), `the resolved reference must render through the symbol:\n${result.source}`);

  const verdict = verifyExport(result);
  assert.equal(verdict.outcome, "ok", `a resolved in-tree reference must round-trip:${context(result, verdict)}`);
  assert.equal(verdict.byteDiff?.equal, true, `the byte-diff IS the verdict:${context(result, verdict)}`);
});

test("symbol rule: a reference to an address OUTSIDE every emitted block renders as a hex literal and does NOT refuse", { skip: SKIP_REASON }, () => {
  // `shapeFixture()`'s own body is `lda #$00` / `sta $d020` / `rts` -- $d020
  // is a hardware register, well outside the $0801..$0806 block, so this is
  // the paired non-vacuity control: the rule must never fire here.
  const { dir, storePath, imagePath } = shapeFixture("symrule-out-of-tree");
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  assert.ok(result.source.includes("sta $d020"), `an out-of-tree reference must still render as a hex literal:\n${result.source}`);

  const verdict = verifyExport(result);
  assert.equal(verdict.outcome, "ok", `an out-of-tree reference must not be refused, and must still round-trip:${context(result, verdict)}`);
  assert.equal(verdict.byteDiff?.equal, true, `the byte-diff IS the verdict:${context(result, verdict)}`);
});

test("symbol rule: a relative BRANCH whose resolved target is in-tree with no label there refuses too -- the rule covers branches, not only jsr/jmp", () => {
  const { dir, storePath, imagePath } = buildStore(freshDir("symrule-branch-unresolved"), {
    origin: 0x0801,
    // bne +2 (resolvedTarget = $0801 + 2 + 2 = $0805) / nop / nop / rts --
    // $0805 (the `rts`) is inside the block and carries no label.
    body: [0xd0, 0x02, 0xea, 0xea, 0x60],
    ranges: [{ start: 0x0801, endInclusive: 0x0805, dataType: "code" }],
    labels: [],
  });

  assert.throws(
    () => exportAsm({ storePath, imagePath, workspaceRoot: dir }),
    (e: unknown) => {
      assert.ok(e instanceof Error);
      assert.ok(e.message.includes("$0801"), `the refusal names the REFERRING address: ${e.message}`);
      assert.ok(e.message.includes("$0805"), `the refusal names the TARGET address: ${e.message}`);
      return true;
    },
  );
});

test("symbol rule: a data reference -- an absolute operand that is not a control-flow target -- in-tree with no label there refuses", () => {
  const { dir, storePath, imagePath } = buildStore(freshDir("symrule-data-unresolved"), {
    origin: 0x0801,
    // lda $0805 (absolute, not jmp/jsr) / nop / rts -- $0805 (the `rts`) is
    // inside the block and carries no label.
    body: [0xad, 0x05, 0x08, 0xea, 0x60],
    ranges: [{ start: 0x0801, endInclusive: 0x0805, dataType: "code" }],
    labels: [],
  });

  assert.throws(
    () => exportAsm({ storePath, imagePath, workspaceRoot: dir }),
    (e: unknown) => {
      assert.ok(e instanceof Error);
      assert.ok(e.message.includes("$0801"), `the refusal names the REFERRING address: ${e.message}`);
      assert.ok(e.message.includes("$0805"), `the refusal names the TARGET address: ${e.message}`);
      return true;
    },
  );
});

test("symbol rule: an indirect `jmp` whose VECTOR address is in-tree with no label there refuses", () => {
  const { dir, storePath, imagePath } = buildStore(freshDir("symrule-indirect-unresolved"), {
    origin: 0x0801,
    // jmp ($0805) / nop / rts -- $0805 (the `rts`) is the VECTOR address,
    // inside the block, and carries no label.
    body: [0x6c, 0x05, 0x08, 0xea, 0x60],
    ranges: [{ start: 0x0801, endInclusive: 0x0805, dataType: "code" }],
    labels: [],
  });

  assert.throws(
    () => exportAsm({ storePath, imagePath, workspaceRoot: dir }),
    (e: unknown) => {
      assert.ok(e instanceof Error);
      assert.ok(e.message.includes("$0801"), `the refusal names the REFERRING address: ${e.message}`);
      assert.ok(e.message.includes("$0805"), `the refusal names the VECTOR address: ${e.message}`);
      return true;
    },
  );
});

test("symbol rule: the refusal message contains no byte value from the image and no store comment text", () => {
  const { dir, storePath, imagePath } = buildStore(freshDir("symrule-no-disclosure"), {
    origin: 0x0801,
    body: [0x20, 0x06, 0x08, 0xea, 0xea, 0xea, 0x60],
    ranges: [{ start: 0x0801, endInclusive: 0x0807, dataType: "code" }],
    labels: [],
    comments: [{ address: 0x0801, commentType: "line", text: "TOP SECRET STORE TEXT" }],
  });

  assert.throws(
    () => exportAsm({ storePath, imagePath, workspaceRoot: dir }),
    (e: unknown) => {
      assert.ok(e instanceof Error);
      assert.equal(e.message.includes("TOP SECRET"), false, `the store's own comment text must never be quoted: ${e.message}`);
      // Every image byte this fixture carries, checked for absence as a raw
      // two-hex-digit token distinct from the addresses the message DOES
      // name ($0801/$0806) -- `$20`/`$06`/`$08`/`$ea`/`$60` are the opcode
      // and operand bytes themselves, never the referring/target address.
      for (const byteHex of ["$20", "$ea", "$60"]) {
        assert.equal(e.message.includes(byteHex), false, `no raw image byte may appear in the refusal: ${e.message}`);
      }
      return true;
    },
  );
});

test("symbol rule: an immediate operand is never treated as a reference -- a store loading an immediate equal to a block address exports cleanly", { skip: SKIP_REASON }, () => {
  const { dir, storePath, imagePath } = buildStore(freshDir("symrule-immediate-not-a-reference"), {
    origin: 0x0008,
    // lda #$08 -- the immediate VALUE $08 equals this very block's own start
    // address $0008. If an immediate were ever treated as a reference, this
    // would refuse; it must not.
    body: [0xa9, 0x08, 0x60],
    ranges: [{ start: 0x0008, endInclusive: 0x000a, dataType: "code" }],
    labels: [],
  });

  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  assert.ok(result.source.includes("lda #$08"), `the immediate operand must render unchanged:\n${result.source}`);

  const verdict = verifyExport(result);
  assert.equal(verdict.outcome, "ok", `an immediate operand must never trigger the in-tree rule:${context(result, verdict)}`);
  assert.equal(verdict.byteDiff?.equal, true, `the byte-diff IS the verdict:${context(result, verdict)}`);
});

// ---------------------------------------------------------------------------
// The typed data-range emitter. Every one of the twelve `DATA_TYPES` members
// must reassemble byte-identically, and the suite is driven from the
// vocabulary's OWN source so a thirteenth member is covered automatically.
// ---------------------------------------------------------------------------

/**
 * Eight bytes covering $0801..$0808, deliberately non-trivial: `$00` and `$ff`
 * are both present (the two values a lazy emitter most easily gets wrong), and
 * the `$34 $12` / `$c0 $00` pairs are non-palindromic, so an emitter that split
 * them in the wrong byte order would produce different bytes rather than the
 * same ones. The length is EVEN because `assertRangeShape()` requires an even
 * byte count for the four split-table layouts.
 */
const DATA_BODY = [0x00, 0xff, 0x34, 0x12, 0xc0, 0x00, 0x01, 0x08] as const;

test("the data-type suite is driven from `DATA_TYPES` itself -- a thirteenth member must arrive with a thirteenth case", () => {
  assert.equal(
    DATA_TYPES.length,
    12,
    "the vocabulary grew. This file iterates it rather than copying it, so the new member is already covered -- update this pinned count and " +
      "confirm the new case round-trips, rather than adding a name to a list here.",
  );
});

for (const dataType of DATA_TYPES) {
  // Phase 47, plan 47-03: `external_file` is EXCLUDED from this generic
  // single-file loop. Its own emitted line is `!binary "data_XXXX.bin"`,
  // naming a sibling file that only `exportAsmTree()` writes -- `acme-
  // verify.ts` (which `verifyExport()` below calls) is single-file by design
  // (hard scope fence 3) and never writes one, so this loop would see ACME's
  // own "Cannot open input file" for this one type, every time, regardless
  // of whether the emission itself is correct. Its round trip is proved
  // separately, through `exportAsmTree()`, in the "binary emission:" suite
  // below -- reached through the right verifier, never skipped.
  if (dataType === "external_file") continue;
  test(`data type round trip: a \`${dataType}\` range reassembles byte-identically`, { skip: SKIP_REASON }, () => {
    const { dir, storePath, imagePath } = buildStore(freshDir(`dt-${dataType}`), {
      origin: 0x0801,
      body: DATA_BODY,
      ranges: [{ start: 0x0801, endInclusive: 0x0808, dataType }],
      labels: [],
    });
    const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
    const verdict = verifyExport(result);

    assert.equal(verdict.outcome, "ok", `a \`${dataType}\` range must round-trip byte-identically:${context(result, verdict)}`);
    assert.equal(verdict.byteDiff?.equal, true, `\`${dataType}\`: the byte-diff IS the verdict:${context(result, verdict)}`);
  });
}

test("`word` and `address` of EVEN length emit `!word` in little-endian order, with the type named verbatim", () => {
  for (const dataType of ["word", "address"]) {
    const { dir, storePath, imagePath } = buildStore(freshDir(`word-${dataType}`), {
      origin: 0x0801,
      body: DATA_BODY,
      ranges: [{ start: 0x0801, endInclusive: 0x0808, dataType }],
      labels: [],
    });
    const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

    assert.ok(
      result.source.includes(`!word $ff00, $1234, $00c0, $0801  ; ${dataType}`),
      `a \`${dataType}\` range must assemble each little-endian PAIR into one value, and name its type:\n${result.source}`,
    );
    assert.equal(result.dataByteCount, 8, "every byte went out through the data path");
  }
});

test("`word` of ODD length falls back to `!byte`, says why, and still reassembles byte-identically", { skip: SKIP_REASON }, () => {
  const { dir, storePath, imagePath } = buildStore(freshDir("word-odd"), {
    origin: 0x0801,
    body: DATA_BODY,
    ranges: [{ start: 0x0801, endInclusive: 0x0803, dataType: "word" }],
    labels: [],
  });
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  assert.ok(result.source.includes("!byte $00, $ff, $34"), `an odd byte count cannot be emitted as pairs:\n${result.source}`);
  // Matched as a DIRECTIVE at the start of a line, not as a substring: the
  // fallback's own trailing comment says the words "!word emits PAIRS", and an
  // assertion that trips over the explanation instead of the emission would be
  // reporting on the comment.
  const wordDirectives = result.source.split("\n").filter((line) => /^\s*!word\b/.test(line));
  assert.deepEqual(wordDirectives, [], `the fallback must not ALSO emit a \`!word\` directive:\n${result.source}`);
  assert.ok(result.source.includes("odd byte count"), `the fallback must say why it happened:\n${result.source}`);

  const verdict = verifyExport(result);
  assert.equal(verdict.outcome, "ok", `the fallback must still round-trip:${context(result, verdict)}`);
  assert.equal(verdict.byteDiff?.equal, true, `the fallback's byte-diff must be equal:${context(result, verdict)}`);
});

test("no `!text` directive is ever emitted -- a conversion table this exporter does not control cannot back a byte-identical claim", () => {
  for (const dataType of ["petscii", "screencode"]) {
    const { dir, storePath, imagePath } = buildStore(freshDir(`text-${dataType}`), {
      origin: 0x0801,
      body: DATA_BODY,
      ranges: [{ start: 0x0801, endInclusive: 0x0808, dataType }],
      labels: [],
    });
    const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

    assert.equal(result.source.includes("!text"), false, `\`${dataType}\` must go out as bytes, not through ACME's conversion table:\n${result.source}`);
    assert.ok(result.source.includes(`  ; ${dataType}`), `the type must be named verbatim on the emitted line:\n${result.source}`);
  }
});

test("`dataByteCount` counts every byte emitted through the data path, and nothing a code block emitted", { skip: SKIP_REASON }, () => {
  const { dir, storePath, imagePath } = buildStore(freshDir("databytes"), {
    origin: 0x0801,
    body: [...SHAPE_BODY, ...DATA_BODY],
    ranges: [
      { start: 0x0801, endInclusive: 0x0806, dataType: "code" },
      { start: 0x0807, endInclusive: 0x080e, dataType: "byte" },
    ],
    labels: [],
  });
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  assert.equal(result.dataByteCount, 8, "the six code bytes are not data bytes");
  const verdict = verifyExport(result);
  assert.equal(verdict.outcome, "ok", `a mixed code/data export must round-trip:${context(result, verdict)}`);
  assert.equal(verdict.byteDiff?.equal, true, `mixed code/data byte-diff:${context(result, verdict)}`);
});

// ---------------------------------------------------------------------------
// Empty inputs. Both are "nothing to emit" cases that must still produce a
// source a real assembler reproduces -- an exporter that only works when the
// store is richly annotated is an exporter that fails on a fresh project.
// ---------------------------------------------------------------------------

test("a store with ZERO labels emits no symbol definitions and renders every operand as a hex literal, and still round-trips", { skip: SKIP_REASON }, () => {
  const { dir, storePath, imagePath } = buildStore(freshDir("no-labels"), {
    origin: 0x0801,
    body: PLANTED_BODY,
    ranges: [{ start: 0x0801, endInclusive: 0x0808, dataType: "code" }],
    labels: [],
  });
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  assert.equal(result.symbolCount, 0);
  // A definition line is `name = $XXXX` at column zero. Matched by shape rather
  // than by the substring `" = $"`, which the `* = $0801` origin line also
  // carries -- an assertion that fires on a correct export proves nothing.
  const definitions = result.source.split("\n").filter((line) => /^[A-Za-z_][A-Za-z0-9_]* = \$/.test(line));
  assert.deepEqual(definitions, [], `no symbol-definition line may be emitted for a store with no labels:\n${result.source}`);
  assert.ok(result.source.includes("sta+2 $0090"), `every operand falls back to a hex literal -- with the width force intact:\n${result.source}`);

  const verdict = verifyExport(result);
  assert.equal(verdict.outcome, "ok", `a label-free export must round-trip:${context(result, verdict)}`);
  assert.equal(verdict.byteDiff?.equal, true, `label-free byte-diff:${context(result, verdict)}`);
});

test("a store with ZERO comments emits no comment line, and still round-trips", { skip: SKIP_REASON }, () => {
  const { dir, storePath, imagePath } = buildStore(freshDir("no-comments"), {
    origin: 0x0801,
    body: PLANTED_BODY,
    ranges: [{ start: 0x0801, endInclusive: 0x0808, dataType: "code" }],
    labels: [{ address: 0x0801, name: "entry" }],
  });
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  const commentLines = result.source.split("\n").filter((line) => line.trimStart().startsWith(";"));
  assert.deepEqual(commentLines, [], `no line may be a comment when the store holds none:\n${result.source}`);

  const verdict = verifyExport(result);
  assert.equal(verdict.outcome, "ok", `a comment-free export must round-trip:${context(result, verdict)}`);
  assert.equal(verdict.byteDiff?.equal, true, `comment-free byte-diff:${context(result, verdict)}`);
});

// ---------------------------------------------------------------------------
// 30-REVIEW IN-02 -- data-line comments lost their address.
//
// For a `!byte` line covering up to 16 addresses, every `line` comment in that
// span was pushed above the directive with no record of WHICH address it
// annotated, so `n` comments on `n` distinct data bytes emitted as `n`
// indistinguishable lines. The information was not recoverable from the
// artefact. The code path attaches each comment to its own instruction and is
// unaffected -- it calls `withComments()` with a span of exactly one address.
// ---------------------------------------------------------------------------

test("comments on DIFFERENT bytes of one `!byte` line are distinguishable by address (30-REVIEW IN-02)", () => {
  const fixture = buildStore(freshDir("data-comment-addresses"), {
    origin: 0x0801,
    body: [0x11, 0x22, 0x33, 0x44],
    ranges: [{ start: 0x0801, endInclusive: 0x0804, dataType: "byte" }],
    comments: [
      { address: 0x0801, commentType: "line", text: "the first byte" },
      { address: 0x0803, commentType: "line", text: "the third byte" },
    ],
  });
  const result = exportAsm({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir });
  const lines = result.source.split("\n");

  // Precondition: all four bytes really are on ONE directive, or the finding
  // does not apply to this fixture and the assertions below are vacuous.
  const directives = lines.filter((l) => l.trimStart().startsWith("!byte"));
  assert.equal(directives.length, 1, `this fixture must produce ONE !byte line:\n${result.source}`);

  assert.ok(lines.includes(`        ; $0801: the first byte`), `the comment must carry its own address:\n${result.source}`);
  assert.ok(lines.includes(`        ; $0803: the third byte`), `the comment must carry its own address:\n${result.source}`);
  assert.equal(result.commentCount, 2);
});

test("a comment on a CODE line is NOT address-qualified -- the span is one address and already unambiguous (30-REVIEW IN-02)", () => {
  // The paired direction. Qualifying every code comment with an address it
  // already sits next to is noise, and this is what pins that the change is
  // scoped to the ambiguous case.
  const fixture = buildStore(freshDir("code-comment-unqualified"), {
    origin: 0x0801,
    body: [...SHAPE_BODY],
    ranges: [{ start: 0x0801, endInclusive: 0x0806, dataType: "code" }],
    comments: [{ address: 0x0801, commentType: "line", text: "set the border" }],
  });
  const result = exportAsm({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir });
  assert.ok(
    result.source.split("\n").includes("        ; set the border"),
    `a code-path comment stays exactly as written:\n${result.source}`,
  );
  assert.equal(
    result.source.includes("; $0801: set the border"),
    false,
    `a one-address span must not be qualified:\n${result.source}`,
  );
});

test("ROUND TRIP: address-qualified data comments are still just comments (30-REVIEW IN-02)", { skip: SKIP_REASON }, () => {
  const fixture = buildStore(freshDir("data-comment-roundtrip"), {
    origin: 0x0801,
    body: [0x11, 0x22, 0x33, 0x44],
    ranges: [{ start: 0x0801, endInclusive: 0x0804, dataType: "byte" }],
    comments: [
      { address: 0x0801, commentType: "line", text: "the first byte" },
      { address: 0x0804, commentType: "side", text: "the last byte" },
    ],
  });
  const result = exportAsm({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir });
  const verdict = verifyExport(result);
  assert.equal(verdict.outcome, "ok", `${verdict.reason}\n${result.source}`);
  assert.equal(verdict.byteDiff?.equal, true, `${verdict.reason}\n${result.source}`);
});

// ---------------------------------------------------------------------------
// 30-REVIEW IN-03 -- hex case was inconsistent within one emitted document:
// `formatSymbolDefinition()` emitted uppercase (`start = $C000`) while
// `hex2()`/`hex4()`/`hexExtent()` emit lowercase (`* = $0801`, `!byte $a9`).
// Both assemble identically; the mixed casing in one generated file was the
// only cost. Lowercase is chosen because three emitters already use it.
// ---------------------------------------------------------------------------

test("every hex literal in one emitted document uses ONE case (30-REVIEW IN-03)", () => {
  // Deliberately over a store with symbol definitions ABOVE $0100 carrying
  // letter digits -- the only shape where the two conventions were visibly
  // different. `$0801` is all digits and would pass either way.
  const fixture = buildStore(freshDir("hex-case"), {
    origin: 0xc000,
    body: [...SHAPE_BODY],
    ranges: [{ start: 0xc000, endInclusive: 0xc005, dataType: "code" }],
    labels: [{ address: 0xc000, name: "entry" }],
  });
  const result = exportAsm({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir });

  const uppercase = result.source.match(/\$[0-9a-fA-F]*[A-F][0-9a-fA-F]*/g) ?? [];
  assert.deepEqual(
    uppercase,
    [],
    `every emitted hex literal must be lowercase, matching hex2()/hex4()/hexExtent():\n${result.source}`,
  );

  // Non-vacuity: the document really does contain a letter-bearing literal, so
  // a scan finding nothing is finding nothing FOR THE RIGHT REASON.
  assert.ok(
    result.source.includes("entry = $c000"),
    `this fixture exists to carry a letter-bearing definition; if it stops, the scan above is vacuous:\n${result.source}`,
  );
});

// ---------------------------------------------------------------------------
// 30-REVIEW IN-04 -- the fixture generator's ACME probe was narrower than the
// gate's: it accepted only `acme --version` exiting 0, while `acme-gate.ts`
// falls back to `--help` because "ACME 0.97 prints its banner to either
// depending on build". On such a build the generator refused to regenerate a
// fixture that would have assembled fine.
//
// The generator cannot IMPORT the gate (the gate is test-only and asserts its
// own absence from `files[]`; the generator sits under a path the packer
// walks), so the ladder is mirrored -- and this is what keeps the two mirrors
// in step.
// ---------------------------------------------------------------------------

test("the fixture generator's ACME probe ladder matches the gate's (30-REVIEW IN-04)", () => {
  const gate = readFileSync(join(HERE, "acme-gate.ts"), "utf8");
  const generator = readFileSync(join(SMC_DIR, "make-export-asm-fixtures.mjs"), "utf8");

  // Both rungs of the ladder, and the banner test, present on both sides.
  for (const [label, needle] of [
    ["the --version rung", /\["--version"\]/],
    ["the --help fallback rung", /\["--help"\]/],
    ["the case-insensitive acme banner test", /\/acme\/i/],
  ] as const) {
    assert.match(gate, needle, `precondition: acme-gate.ts must still have ${label}`);
    assert.match(
      generator,
      needle,
      `make-export-asm-fixtures.mjs is missing ${label} -- its probe is narrower than the gate's again (IN-04)`,
    );
  }

  // And the narrow form the finding was about must not come back: a bare
  // `status !== 0` verdict on the --version probe.
  assert.doesNotMatch(
    generator,
    /probe\.error \|\| probe\.status !== 0/,
    "the generator must not go back to accepting only `--version` exiting 0 (IN-04)",
  );
});

// ---------------------------------------------------------------------------
// 30-REVIEW WR-07 -- `decode()` was handed an EXCLUSIVE end for a parameter
// documented as INCLUSIVE.
//
// `DecodeOptions.end` is compared with `if (end !== undefined && address >
// end) break` and documented as "an instruction starting past `end` is dropped
// ... an instruction starting AT OR BEFORE `end` is emitted in full" -- an
// inclusive bound. Passing `block.endExclusive` therefore permitted one
// instruction more than intended.
//
// It was INERT, because `slice` is exactly the block's bytes and `decode()`'s
// own `offset < bytes.length` loop condition bounds it first -- so the guard
// was doing nothing at all, and the next maintainer to hand `decode()` a wider
// slice would inherit a silent one-instruction overrun.
//
// The test is therefore about `decode()`'s CONTRACT rather than about the
// exporter's output: it drives the decoder directly with a WIDE slice and both
// bound spellings, which is the situation the exporter's inert guard would
// have failed in.
// ---------------------------------------------------------------------------

test("decode()'s `end` is INCLUSIVE, so the exclusive end permits one instruction too many (30-REVIEW WR-07)", () => {
  // Six bytes, three two-byte instructions at $0801, $0803, $0805.
  const bytes = new Uint8Array([0xa9, 0x00, 0xa9, 0x01, 0xa9, 0x02]);
  const blockStart = 0x0801;
  const blockEndExclusive = 0x0805; // the block is $0801..$0804, TWO instructions

  const withInclusive = decode(bytes, blockStart, { end: blockEndExclusive - 1 });
  assert.deepEqual(
    withInclusive.map((i) => i.address),
    [0x0801, 0x0803],
    "the inclusive bound must stop at the block's last byte -- two instructions",
  );

  const withExclusive = decode(bytes, blockStart, { end: blockEndExclusive });
  assert.deepEqual(
    withExclusive.map((i) => i.address),
    [0x0801, 0x0803, 0x0805],
    "the EXCLUSIVE bound admits a THIRD instruction starting at the block's exclusive end -- the WR-07 overrun, " +
      "measured. This is what the exporter's guard would have done the moment its slice stopped being the bound",
  );
  assert.notDeepEqual(
    withInclusive.map((i) => i.address),
    withExclusive.map((i) => i.address),
    "if the two spellings ever agree, this test has gone vacuous and WR-07 is unguarded again",
  );
});

test("the exporter hands decode() the INCLUSIVE bound (30-REVIEW WR-07)", () => {
  // Structural, over the module's own source: the two spellings produce
  // identical output for every store this exporter can build (the slice bounds
  // it first), so no behavioural test can tell them apart at the exportAsm()
  // level. That is precisely why the wrong one survived, and why the guard has
  // to read the call.
  const source = readFileSync(join(HERE, "anno-export-asm.ts"), "utf8");
  assert.match(
    source,
    /decode\(slice, block\.start, \{ end: block\.endExclusive - 1 \}\)/,
    "the ONE decode() call must pass an INCLUSIVE end -- `end: block.endExclusive` is WR-07",
  );
});

// ---------------------------------------------------------------------------
// 30-REVIEW WR-10 -- an enum variant symbol colliding with a label name was
// acknowledged in a comment and never checked.
//
// That comment named the hazard exactly ("every extra emitted symbol is one
// more chance to collide with a label name and turn a correct export into
// ACME's `Symbol already defined.`") and then did not look:
// `definedEnumSymbols` dedupes enum symbols against EACH OTHER but never
// against the store's labels. Since the CLI verb runs no assembler, the
// collision produced a file that exited 0 and failed wherever the user
// assembled it, with no pointer back to the store rows that caused it.
// ---------------------------------------------------------------------------

test("an enum variant symbol colliding with a LABEL name is REFUSED, naming both (30-REVIEW WR-10)", () => {
  // `viccolor_BLACK` as a label name AND as the composed enum variant symbol.
  const fixture = buildStore(freshDir("enum-label-collision"), {
    origin: 0x0801,
    body: [...SHAPE_BODY],
    ranges: [{ start: 0x0801, endInclusive: 0x0806, dataType: "code" }],
    labels: [{ address: 0x0806, name: "viccolor_BLACK" }],
    enums: [{ name: VICCOLOR.name, variants: { ...VICCOLOR.variants } }],
    enumUsage: [{ address: 0x0801, name: VICCOLOR.name }],
  });
  assert.throws(
    () => exportAsm({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir }),
    (e: unknown) => {
      assert.ok(e instanceof Error);
      assert.match(e.message, /^exportAsm: /);
      assert.ok(e.message.includes("viccolor_BLACK"), `the refusal names the colliding SYMBOL: ${e.message}`);
      assert.ok(e.message.includes("viccolor"), `the refusal names the ENUM: ${e.message}`);
      assert.ok(e.message.includes("BLACK"), `the refusal names the VARIANT: ${e.message}`);
      assert.ok(e.message.includes("$0801"), `the refusal names the usage ADDRESS: ${e.message}`);
      assert.match(e.message, /Symbol already defined/, `the refusal names what ACME would have said: ${e.message}`);
      return true;
    },
  );
});

test("EXTERNAL ORACLE: real ACME refuses that same collision with `Symbol already defined.` and exit 1 (30-REVIEW WR-10)", { skip: SKIP_REASON }, () => {
  // The refusal above is only worth having if the thing it predicts is real.
  // Hand-composed source carrying both definitions, assembled for real -- the
  // same shape `anno-export-asm.test.ts` already uses for duplicate labels.
  const raw = assembleRaw([
    "!cpu 6510",
    "viccolor_BLACK = $00",
    "* = $0801",
    "        lda #viccolor_BLACK",
    "viccolor_BLACK = $0806",
    "        rts",
  ].join("\n"));
  assert.equal(raw.status, 1, `real ACME must refuse the collision: ${raw.stderr}`);
  assert.match(raw.stderr, /Symbol already defined/i, raw.stderr);
  assert.equal(raw.outputExists, false, "a refused assembly writes no output file");
});

test("PAIRED DIRECTION: a NON-colliding label and enum still export (30-REVIEW WR-10 non-vacuity)", () => {
  // An exporter that refused every enum-plus-label store would pass the
  // refusal test above.
  const fixture = buildStore(freshDir("enum-label-no-collision"), {
    origin: 0x0801,
    body: [...SHAPE_BODY],
    ranges: [{ start: 0x0801, endInclusive: 0x0806, dataType: "code" }],
    labels: [{ address: 0x0806, name: "not_a_collision" }],
    enums: [{ name: VICCOLOR.name, variants: { ...VICCOLOR.variants } }],
    enumUsage: [{ address: 0x0801, name: VICCOLOR.name }],
  });
  const result = exportAsm({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir });
  assert.equal(result.enumSubstitutionCount, 1);
  assert.ok(result.source.includes("        lda #viccolor_BLACK"), result.source);
});

// ---------------------------------------------------------------------------
// 30-REVIEW WR-04 -- `hexExtent()`'s `$10000` case, the only reason it
// existed, was untested and rested on an unmeasured assumption. Measured, the
// assumption was FALSE.
//
// `hexExtent()` padded without masking so that a range ending at `$ffff`
// produced `!if * != $10000`, justified by the claim that `hex4()`'s mask
// "would render that as `$0000` -- an assertion no assembly can ever satisfy,
// firing on a correct export". No test in this file used an address above
// `$d020`; grep for `ffff`/`10000` returned nothing.
//
// MEASURED against real ACME 0.97 while fixing this (2026-08-31): ACME's `*`
// is a 16-bit program counter and WRAPS. After `* = $fffe` and two bytes, `*`
// is `$0000`. The `$10000` form fails with `!error: end drifted` and writes no
// output file, so the UNMASKED assertion is the one that fired on a correct
// export -- for every range touching the top of memory, with a failure that
// looks like an exporter bug.
//
// ACME's own `-v2` line prints the unwrapped extent (`Saving 2 (0x2) bytes
// (0xfffe - 0x10000 exclusive)`), which is presumably where the assumption
// came from. That is ACME describing a SEGMENT; `*` is a different thing.
//
// These tests are the measurement, kept: the round trip goes through real
// ACME, so it is the assembler and the byte-diff that settle it, not a string
// match on the emitted assertion.
// ---------------------------------------------------------------------------

/** A flat 64K capture whose last two bytes are `$aa $bb`, with the store
 * carrying the single range `$fffe..$ffff` -- the top-of-memory shape whose
 * exclusive end is `$10000`. Also exercises `decode()`'s 16-bit address wrap.
 * `.raw` is the flat-image extension `loadImage()` dispatches on. */
function topOfMemoryFixture(tag: string, dataType: string): StoreFixture {
  const dir = freshDir(tag);
  const imagePath = join(dir, "capture.raw");
  const flat = Buffer.alloc(65536);
  flat[0xfffe] = 0xaa;
  flat[0xffff] = 0xbb;
  writeFileSync(imagePath, flat);

  const storePath = join(dir, "anno.sqlite");
  const handle = openStore(storePath, { workspaceRoot: dir });
  try {
    setDataType(handle, { start: 0xfffe, endInclusive: 0xffff, dataType });
  } finally {
    closeStore(handle);
  }
  return { dir, storePath, imagePath };
}

test("a range ending at $ffff emits the block-end assertion ACME's WRAPPED `*` can satisfy (30-REVIEW WR-04)", () => {
  const { dir, storePath, imagePath } = topOfMemoryFixture("top-of-memory-shape", "byte");
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  assert.ok(
    result.source.includes('!if * != $0000 { !error "export-asm: block end drifted, expected $0000" }'),
    `the exclusive end $10000 must be emitted MASKED, because ACME's \`*\` wraps to $0000 there:\n${result.source}`,
  );
  assert.equal(
    result.source.includes("$10000"),
    false,
    `an unmasked $10000 is an assertion real ACME never satisfies -- it fires on a CORRECT export:\n${result.source}`,
  );
  assert.equal(result.blocks[0]!.endExclusive, 0x10000, "the BLOCK still carries the true exclusive end; only its RENDERING is masked");
});

test("ROUND TRIP: a range at the very top of memory reassembles byte-identically through real ACME (30-REVIEW WR-04)", { skip: SKIP_REASON }, () => {
  // The measurement itself, and the only thing that settles it. Before the
  // fix this exited 1 with `!error: block end drifted, expected $10000` and
  // wrote no output file, which the verdict layer reports as `failed`.
  const { dir, storePath, imagePath } = topOfMemoryFixture("top-of-memory-roundtrip", "byte");
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  const verdict = verifyExport(result);
  assert.equal(verdict.outcome, "ok", `${verdict.reason}\n${result.source}`);
  assert.equal(verdict.byteDiff?.equal, true, `${verdict.reason}\n${result.source}`);
});

test("ROUND TRIP: a CODE range at the top of memory reassembles too -- decode()'s 16-bit address wrap (30-REVIEW WR-04)", { skip: SKIP_REASON }, () => {
  // `$aa $bb` decodes as `ldx #$bb` -- a two-byte instruction that exactly
  // fills $fffe..$ffff, so the code path reaches the same wrapped end
  // assertion the data path does.
  const { dir, storePath, imagePath } = topOfMemoryFixture("top-of-memory-code", "code");
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  const verdict = verifyExport(result);
  assert.equal(verdict.outcome, "ok", `${verdict.reason}\n${result.source}`);
  assert.equal(verdict.byteDiff?.equal, true, `${verdict.reason}\n${result.source}`);
});

test("NON-VACUITY: the top-of-memory end assertion still BITES -- a corrupted byte count is refused by real ACME (30-REVIEW WR-04)", { skip: SKIP_REASON }, () => {
  // Masking the extent must not make the top-of-memory assertion satisfiable
  // by anything. One byte removed from the emitted source leaves `*` at
  // $ffff, and ACME must exit 1 and write NO output file -- measured
  // separately at the raw-assembly level while fixing WR-04, and asserted
  // here through the same verdict layer every other planted violation uses.
  const { dir, storePath, imagePath } = topOfMemoryFixture("top-of-memory-bite", "byte");
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  const shortened = result.source.replace("!byte $aa, $bb", "!byte $aa");
  assert.notEqual(shortened, result.source, "the planted violation must actually change the source");

  const verdict = verifyExportText(result, shortened);
  assert.equal(
    verdict.outcome,
    "failed",
    `a block one byte short at the top of memory must be REFUSED, or the masked assertion is vacuous:\n${shortened}`,
  );
});

// ---------------------------------------------------------------------------
// 30-REVIEW WR-03 -- a store's `dataType` reached emitted ACME source text
// unvalidated.
//
// `listRanges()` casts `row.data_type as DataType` with no `assertDataType()`
// call, so a store whose `anno_range.data_type` column was edited on disk
// carried an ARBITRARY string into `emitDataLines()`, which interpolates it
// verbatim into the emitted block comment. A value containing a line break
// emits arbitrary text at column zero of the generated ACME source -- the same
// mechanism invariant 7 refuses for comment text, through a column nobody had
// checked.
//
// The asymmetry is what made this a defect rather than a theoretical: the very
// next function, `withComments()`, ALREADY defends the analogous `commentType`
// case by name, with the comment "Unreachable through the type, and reachable
// through a store file somebody edited. Refusing beats guessing." The same
// reasoning applies to `dataType` and had not been applied.
//
// DRIVEN AT THE PREDICATE, NOT THROUGH A CORRUPTED STORE, deliberately:
// `anno-store.ts` is the ONE module in this repo permitted to name
// `node:sqlite`, so a test cannot manufacture the corrupted row without
// breaking a stated architectural constraint to prove a point about
// robustness. The predicate is what the call site calls.
// ---------------------------------------------------------------------------

test("a range whose dataType is not in the store's vocabulary is REFUSED by name at the export boundary (30-REVIEW WR-03)", () => {
  // The line-break case is the one that actually corrupts the source: a
  // dataType carrying a newline puts everything after it at column zero, as
  // assembler input.
  const hostile: unknown[] = [
    "code\n* = $c000\n        jmp $ffd2",
    "not-a-real-data-type",
    "",
    "CODE",
    undefined,
    null,
    42,
    { toString: () => "code" },
  ];
  for (const dataType of hostile) {
    assert.throws(
      () => assertDataTypeForExport({ start: 0x0801, endInclusive: 0x0806, dataType }),
      (e: unknown) => {
        assert.ok(e instanceof Error);
        assert.match(e.message, /^exportAsm: /);
        assert.ok(e.message.includes("$0801"), `the refusal names the range so a human can find the row: ${e.message}`);
        assert.ok(e.message.includes("$0806"), `the refusal names the range so a human can find the row: ${e.message}`);
        // The store validator's own message quotes the offending value; this
        // boundary's must not, for `assertExportableCommentText()`'s reason.
        assert.equal(
          e.message.includes("jmp $ffd2"),
          false,
          `the refusal must not echo the offending value back -- that is a content-disclosure oracle: ${e.message}`,
        );
        return true;
      },
      `dataType ${JSON.stringify(dataType)} must be refused, not interpolated into ACME source text`,
    );
  }
});

test("every REAL data type still passes the export boundary, one assertion per type (30-REVIEW WR-03 non-vacuity)", () => {
  // Built from DATA_TYPES itself -- the store's own vocabulary, its one home --
  // so a validator that refused everything would fail HERE rather than pass
  // the refusal test above vacuously, and a thirteenth type added later is
  // covered with no edit.
  assert.ok(DATA_TYPES.length > 0, "the vocabulary must be non-empty for this control to mean anything");
  for (const dataType of DATA_TYPES) {
    assert.equal(
      assertDataTypeForExport({ start: 0x0801, endInclusive: 0x0806, dataType }),
      dataType,
      `the real data type ${JSON.stringify(dataType)} must pass the export boundary unchanged`,
    );
  }
});

// ---------------------------------------------------------------------------
// Comments. Two placements, one refusal at each of the two boundaries, and a
// round trip -- because a comment cannot change a byte, and the byte-diff is
// what proves the emission did not accidentally change one anyway.
// ---------------------------------------------------------------------------

function commentedFixture(tag: string, comments: readonly { address: number; commentType: string; text: string }[]): StoreFixture {
  return buildStore(freshDir(tag), {
    origin: 0x0801,
    body: PLANTED_BODY,
    ranges: [{ start: 0x0801, endInclusive: 0x0808, dataType: "code" }],
    labels: [{ address: 0x0801, name: "entry" }],
    comments,
  });
}

test("a `line` comment sits on its own line immediately before its instruction; a `side` comment appends to that instruction's line", () => {
  const { dir, storePath, imagePath } = commentedFixture("comments-shape", [
    { address: 0x0801, commentType: "line", text: "the entry point" },
    { address: 0x0803, commentType: "side", text: "read the flag" },
  ]);
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  const lines = result.source.split("\n");

  const lineComment = lines.indexOf("        ; the entry point");
  const firstInstruction = lines.indexOf("        lda #$00");
  assert.ok(lineComment >= 0, `the line comment must be emitted at the block's indent:\n${result.source}`);
  assert.equal(lineComment + 1, firstInstruction, "a line comment sits IMMEDIATELY before the line for its address");

  assert.ok(
    lines.some((line) => line.startsWith("        lda $90") && line.endsWith("  ; read the flag")),
    `a side comment appends to its own instruction's line:\n${result.source}`,
  );
  assert.equal(result.commentCount, 2);
});

test("an export carrying both comment kinds still reassembles byte-identically", { skip: SKIP_REASON }, () => {
  const { dir, storePath, imagePath } = commentedFixture("comments-roundtrip", [
    { address: 0x0801, commentType: "line", text: "the entry point" },
    { address: 0x0803, commentType: "side", text: "read the flag" },
    { address: 0x0808, commentType: "line", text: "back to the caller" },
  ]);
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  const verdict = verifyExport(result);

  assert.equal(verdict.outcome, "ok", `comments cannot change a byte, and this is the proof:${context(result, verdict)}`);
  assert.equal(verdict.byteDiff?.equal, true, `commented byte-diff:${context(result, verdict)}`);
  assert.equal(result.commentCount, 3);
});

test("assertExportableCommentText() REFUSES a line break at the export boundary and returns a clean string UNCHANGED", () => {
  // Both directions in one test: a control that only ever refuses is
  // indistinguishable from one that is broken in the accepting direction.
  assert.throws(
    () => assertExportableCommentText("raster split\nlda #$00", 0x0801),
    (e: unknown) => {
      assert.ok(e instanceof Error);
      assert.match(e.message, /^exportAsm: /, "every refusal from this module is prefixed `exportAsm:`");
      assert.ok(e.message.includes("$0801"), `the refusal names the ADDRESS, which is a fact about the comment: ${e.message}`);
      assert.match(e.message, /line break|newline/i, `the refusal names the mechanism: ${e.message}`);
      assert.equal(e.message.includes("raster split"), false, "the refusal must NOT quote the stored text back (CR-03)");
      return true;
    },
  );

  assert.equal(assertExportableCommentText("raster split at line $64", 0x0801), "raster split at line $64");
});

test("the export boundary re-checks rather than trusting the store: a store written BEFORE the refusal existed is refused at export", { skip: SKIP_REASON }, () => {
  const { dir, storePath, imagePath } = commentedFixture("comments-legacy", [{ address: 0x0801, commentType: "line", text: "clean at write time" }]);

  // Rewrite the row behind the store's own write verb, exactly as a store
  // written before Part A's refusal existed would already hold it. This is the
  // ONE place this file goes around a public write verb, and it does so to
  // reproduce a state the public verbs can no longer create.
  const handle = openStore(storePath, { workspaceRoot: dir });
  try {
    handle.db.prepare("update anno_comment set text = ?").run("raster split\nlda #$00");
  } finally {
    closeStore(handle);
  }

  assert.throws(
    () => exportAsm({ storePath, imagePath, workspaceRoot: dir }),
    (e: unknown) => {
      assert.ok(e instanceof Error);
      assert.match(e.message, /^exportAsm: /);
      assert.ok(e.message.includes("$0801"), `the refusal names the address: ${e.message}`);
      return true;
    },
    "the export boundary is the last place before the bytes become assembler input",
  );
});

test("defence in depth: writing a newline-bearing comment through the store's public write verb is refused before it reaches disk", () => {
  const dir = freshDir("comments-store-refusal");
  const { storePath } = buildStore(dir, {
    origin: 0x0801,
    body: PLANTED_BODY,
    ranges: [{ start: 0x0801, endInclusive: 0x0808, dataType: "code" }],
    labels: [],
  });

  const handle = openStore(storePath, { workspaceRoot: dir });
  try {
    assert.throws(
      () => setComment(handle, { address: 0x0801, commentType: "line", text: "raster split\nlda #$00" }),
      (e: unknown) => {
        assert.ok(e instanceof AnnoCommentError, `expected AnnoCommentError, got ${String(e)}`);
        assert.equal(e.reason, "embedded newline");
        return true;
      },
    );
    assert.deepEqual(listComments(handle), [], "the refused write left NOTHING on disk");
  } finally {
    closeStore(handle);
  }
});

test("a comment the export cannot place is refused BY NAME, never dropped from the output while the export reports success", () => {
  // $0802 is the operand byte of the two-byte `lda #$00` at $0801 -- there is no
  // emitted line whose address is $0802. Placing it silently on the neighbouring
  // instruction would move a human's note onto a different instruction.
  const { dir, storePath, imagePath } = commentedFixture("comments-unplaceable", [
    { address: 0x0802, commentType: "line", text: "mid-instruction" },
  ]);

  assert.throws(
    () => exportAsm({ storePath, imagePath, workspaceRoot: dir }),
    (e: unknown) => {
      assert.ok(e instanceof Error);
      assert.match(e.message, /^exportAsm: /);
      assert.ok(e.message.includes("$0802"), `the refusal names the address it could not place: ${e.message}`);
      assert.equal(e.message.includes("mid-instruction"), false, "the refusal must not quote the stored text back (CR-03)");
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// Mid-instruction `=*+$NN` labels, on a fixture that GENUINELY SELF-MODIFIES.
//
// Criterion 3 is explicit that emitting the idiom is not the criterion. A
// fixture that merely CONTAINS `=*+$01` would keep every test below green if
// the line were emitted on the wrong instruction, in the wrong place, or for an
// address no instruction owns. So the fixture's self-modification is proved
// FROM ITS BYTES, the round trip is proved by the byte-diff, and the placement
// rule is proved by a negative control that ACME accepts at exit 0.
// ---------------------------------------------------------------------------

test("FIXTURE INTEGRITY: smc.prg genuinely self-modifies -- an `inc` writes to an earlier `lda #`'s own immediate operand byte, proved FROM THE BYTES", () => {
  const raw = new Uint8Array(readFileSync(SMC_PRG_PATH));
  assert.ok(raw.length > 2, `the fixture must carry a payload:\n  length: ${raw.length}`);
  assert.equal(raw[0], 0x01, "the `.prg` load address is little-endian, low byte first");
  assert.equal(raw[1], 0x08, "the fixture loads at $0801");

  const origin = raw[0]! | (raw[1]! << 8);
  assert.equal(origin, 0x0801);

  const instructions = decode(raw.subarray(2), origin);

  // Which addresses are the IMMEDIATE operand byte of some instruction, and
  // which instruction owns each. Derived from the decode, never from a
  // hand-written offset -- an offset would keep agreeing with itself after the
  // fixture stopped self-modifying.
  const immediateOperandOwner = new Map<number, number>();
  for (const instr of instructions) {
    if (instr.operand?.role === "immediate") immediateOperandOwner.set(instr.address + 1, instr.address);
  }
  assert.ok(immediateOperandOwner.size > 0, "the fixture must contain at least one immediate-operand instruction");

  const selfModifyingWrites = instructions.filter((instr) => instr.operand?.role === "absolute" && immediateOperandOwner.has(instr.operand.value));
  assert.equal(
    selfModifyingWrites.length,
    1,
    "smc.prg must contain EXACTLY ONE instruction whose absolute write target is another instruction's immediate operand byte. " +
      "If this is 0 the fixture has stopped self-modifying and every test over it is now testing nothing; if it is more than 1 the " +
      "assertions below no longer name a unique write target. Fix smc.a, then regenerate with " +
      `\`node fixtures/export-asm/make-export-asm-fixtures.mjs\`.\n  decoded: ${instructions.map((i) => `$${i.address.toString(16)} ${i.mnemonic}`).join(", ")}`,
  );

  const writer = selfModifyingWrites[0]!;
  const target = writer.operand!.value;
  const owner = immediateOperandOwner.get(target)!;
  assert.ok(
    owner < writer.address,
    `the modified instruction must come BEFORE the instruction that modifies it: owner $${owner.toString(16)}, writer $${writer.address.toString(16)}`,
  );
  assert.equal(target, 0x0802, "the write target is the `lda #$00` operand byte at $0802");
  assert.equal(writer.mnemonic, "inc");
});

test("REGENERATOR AGREEMENT: re-assembling smc.a reproduces the committed smc.prg byte-for-byte", { skip: SKIP_REASON }, () => {
  const dir = freshDir("smc-regen");
  const outPath = join(dir, "smc.prg");
  // `-f cbm` deliberately, NOT ACME_VERIFY_ARGV_FLAGS' `-f plain`: the fixture
  // is a real `.prg` and carries its two-byte load address, which is what the
  // integrity test above reads.
  const r = spawnSync(ACME_BIN, ["--cpu", "6510", "-f", "cbm", "-o", outPath, SMC_SOURCE_PATH], { encoding: "utf8", timeout: 30_000 });
  assert.equal(r.status, 0, `smc.a must assemble:\n  stderr: ${r.stderr ?? ""}`);
  assert.equal(existsSync(outPath), true, "ACME must write an output file");

  assert.deepEqual(
    [...new Uint8Array(readFileSync(outPath))],
    [...new Uint8Array(readFileSync(SMC_PRG_PATH))],
    "smc.a and smc.prg have drifted apart. The committed image is only evidence while it is EXACTLY what its source assembles to; " +
      "regenerate with `cd src/mcp/vice && node fixtures/export-asm/make-export-asm-fixtures.mjs`.",
  );
});

/** The store the round-trip and negative-control tests share: the whole
 * eleven-byte fixture as one code range, an ordinary label at the entry point,
 * and the mid-instruction label naming the self-modified operand byte. */
function smcFixture(tag: string): StoreFixture {
  return buildStoreOverImage(tag, SMC_PRG_PATH, {
    ranges: [{ start: 0x0801, endInclusive: 0x080b, dataType: "code" }],
    labels: [
      { address: 0x0801, name: "entry" },
      { address: 0x0802, name: "smc_operand" },
    ],
  });
}

test("a label strictly inside an instruction is emitted as `name =*+$NN` on the line IMMEDIATELY BEFORE its host, and is NOT restated in the header", () => {
  const { dir, storePath, imagePath } = smcFixture("smc-shape");
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  const lines = result.source.split("\n");

  const definition = lines.indexOf("smc_operand =*+$01");
  const host = lines.indexOf("        lda #$00");
  assert.ok(definition >= 0, `the mid-instruction label must use the golden witness's compact spelling:\n${result.source}`);
  assert.equal(
    definition + 1,
    host,
    `the definition sits IMMEDIATELY BEFORE the instruction whose operand byte it names -- placed after it, it would name the NEXT instruction's operand:\n${result.source}`,
  );

  assert.ok(lines.includes("        inc smc_operand"), `the self-modifying write must render through the substituted name:\n${result.source}`);

  // Defined inline, so it must NOT also appear in the header -- two definitions
  // of one name is ACME's `Symbol already defined.`
  const headerDefinitions = lines.filter((line) => /^[A-Za-z_][A-Za-z0-9_]* = \$/.test(line));
  assert.deepEqual(headerDefinitions, ["entry = $0801"], `only the ordinary label belongs in the header block:\n${result.source}`);

  assert.equal(result.midInstructionLabelCount, 1);
  assert.equal(result.symbolCount, 2, "`symbolCount` counts every store label the source defines, header and inline alike");
});

test("ROUND TRIP: the self-modifying fixture reassembles BYTE-IDENTICALLY with its write target named by a mid-instruction label", { skip: SKIP_REASON }, () => {
  const { dir, storePath, imagePath } = smcFixture("smc-roundtrip");
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  const verdict = verifyExport(result);

  assert.equal(verdict.outcome, "ok", `a genuinely self-modifying program must round-trip:${context(result, verdict)}`);
  assert.equal(verdict.byteDiff?.equal, true, `the byte-diff IS the verdict -- "ACME exits 0" is nowhere the proof:${context(result, verdict)}`);
});

test("NEGATIVE CONTROL: moving the `=*+$01` line to AFTER its host instruction changes the bytes, and ACME exits 0 anyway", { skip: SKIP_REASON }, () => {
  const { dir, storePath, imagePath } = smcFixture("smc-negative");
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  // ONE documented move: the definition goes from immediately BEFORE its host
  // to immediately AFTER it. `*` is then $0803 rather than $0801, so the symbol
  // takes the value $0804 -- the operand byte of the NEXT instruction.
  const moved = result.source.replace("smc_operand =*+$01\n", "").replace("        lda #$00\n", "        lda #$00\nsmc_operand =*+$01\n");
  assert.notEqual(moved, result.source, "the move must change the source");
  const movedLines = moved.split("\n");
  assert.equal(
    movedLines.indexOf("smc_operand =*+$01"),
    movedLines.indexOf("        lda #$00") + 1,
    `the moved definition must sit immediately AFTER its former host:\n${moved}`,
  );

  const verdict = verifyExportText(result, moved);

  assert.equal(
    verdict.outcome,
    "failed",
    `the wrong placement must be REFUSED:\n  outcome: ${verdict.outcome}\n  reason: ${verdict.reason}\n  exitStatus: ${verdict.exitStatus}\n${moved}`,
  );
  assert.equal(
    verdict.exitStatus,
    0,
    "ACME ACCEPTED the wrongly-placed label -- the instruction's LENGTH is unchanged, so the per-block `*` assertions cannot fire and " +
      `the assembler has nothing to complain about. Only the byte-diff tells the two placements apart.\n  reason: ${verdict.reason}`,
  );
  assert.equal(verdict.byteDiff?.equal, false, `the bytes must disagree:\n  reason: ${verdict.reason}`);
  assert.equal(
    verdict.byteDiff?.firstDifferingOffset,
    3,
    "offset 3 from the block start $0801 is $0804 -- the low byte of the `inc` operand, which now points at the NEXT instruction's " +
      `operand byte instead of the first one's.\n  byteDiff: ${JSON.stringify(verdict.byteDiff)}`,
  );
});

test("a mid-instruction label below $0100 is REFUSED BY NAME rather than emitted", () => {
  // $0081 is the immediate operand byte of the `lda #$00` at $0080. A `=*+$01`
  // label is defined INLINE, so this exporter's own two-hex-digit header
  // definition rule cannot hold the referencing operand's width, and the only
  // remaining defence is a `disasm-renderer.ts` invariant this module does not
  // own. Measured on ACME 0.97, the unforced form assembles `inc smc_operand`
  // to `e6 81` -- two bytes where the original was three -- at exit 0 with NO
  // diagnostic at all.
  const { dir, storePath, imagePath } = buildStore(freshDir("smc-zeropage"), {
    origin: 0x0080,
    body: [0xa9, 0x00, 0x60],
    ranges: [{ start: 0x0080, endInclusive: 0x0082, dataType: "code" }],
    labels: [{ address: 0x0081, name: "zpf_81" }],
  });

  assert.throws(
    () => exportAsm({ storePath, imagePath, workspaceRoot: dir }),
    (e: unknown) => {
      assert.ok(e instanceof Error);
      assert.match(e.message, /^exportAsm: /, "every refusal from this module is prefixed `exportAsm:`");
      assert.ok(e.message.includes("$0081"), `the refusal names the ADDRESS it refused: ${e.message}`);
      assert.ok(e.message.includes("zpf_81"), `the refusal names the LABEL, so a human can find the row: ${e.message}`);
      assert.ok(e.message.includes("$0100"), `the refusal names the floor: ${e.message}`);
      return true;
    },
  );
});

test("a store with no mid-instruction label reports `midInstructionLabelCount` zero -- the counter is not a constant", () => {
  const { dir, storePath, imagePath } = shapeFixture("smc-count-zero");
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  assert.equal(result.midInstructionLabelCount, 0);
  assert.equal(result.source.includes("=*+$"), false, `no inline definition may be emitted when no label sits inside an instruction:\n${result.source}`);
});

// ---------------------------------------------------------------------------
// 30-REVIEW WR-01 and WR-02 -- two ExportAsmResult counters that did not mean
// what their own JSDoc said, printed verbatim to the user as the CLI's success
// summary.
//
// The doc comments in this tree ARE the maintenance contract, so a counter
// contradicting its own doc is a defect, not a style note.
//
// This ONE fixture is the only shape where all three readings diverge: two
// labels at ONE mid-instruction address, plus an enum (whose definition is a
// header line but not a store label). Before the fix it produced
//   symbolCount 3            (doc: "definitions the header carries"; header had 1)
//   midInstructionLabelCount 1  (doc: "labels EXCLUDED from the header"; 2 were)
//
// `anno_label` is `unique` on NAME only and `setLabel()` refuses only a name
// already bound to a DIFFERENT address, so two names at one address is a
// SUPPORTED store state reached through the ordinary public write verbs -- this
// needs no hand-edited store.
// ---------------------------------------------------------------------------

/** Two labels at the one mid-instruction address $0802, plus an enum on the
 * immediate operand at $0801 so a header definition exists that is NOT a store
 * label. The one shape where `symbolCount`, `headerDefinitionCount` and
 * `midInstructionLabelCount` all differ. */
function aliasedSmcFixture(tag: string): StoreFixture {
  return buildStoreOverImage(tag, SMC_PRG_PATH, {
    ranges: [{ start: 0x0801, endInclusive: 0x080b, dataType: "code" }],
    labels: [
      { address: 0x0801, name: "entry" },
      { address: 0x0802, name: "smc_operand" },
      { address: 0x0802, name: "smc_alias" },
    ],
    enums: [{ name: VICCOLOR.name, variants: { ...VICCOLOR.variants } }],
    enumUsage: [{ address: 0x0801, name: VICCOLOR.name }],
  });
}

test("PRECONDITION: two labels at ONE address really is a supported store state, reached through setLabel() (30-REVIEW WR-02)", () => {
  // If the store ever starts refusing this, the divergence tests below become
  // vacuous -- so the precondition is asserted rather than assumed.
  const { dir, storePath, imagePath } = aliasedSmcFixture("alias-precondition");
  assert.ok(existsSync(storePath) && existsSync(imagePath));
  const handle = openStore(storePath, { workspaceRoot: dir });
  try {
    const atAddress = listLabels(handle).filter((l) => l.address === 0x0802).map((l) => l.name).sort();
    assert.deepEqual(atAddress, ["smc_alias", "smc_operand"], "both names must really be in the store at $0802");
  } finally {
    closeStore(handle);
  }
});

test("`midInstructionLabelCount` counts EMITTED INLINE DEFINITIONS, not distinct addresses (30-REVIEW WR-02)", () => {
  const { dir, storePath, imagePath } = aliasedSmcFixture("alias-mid-count");
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  const lines = result.source.split("\n");

  const inline = lines.filter((line) => line.includes("=*+$"));
  assert.equal(inline.length, 2, `both labels at $0802 must be defined inline:\n${result.source}`);
  assert.equal(
    result.midInstructionLabelCount,
    2,
    "the doc says this is 'equal to the number of labels EXCLUDED from the header' -- two were excluded, so it is 2. " +
      "It reported 1 before the fix, because it was `midInstructionLabelAddresses.size`, a set of ADDRESSES",
  );

  // The doc's own claim, asserted directly: exactly the inline-defined labels
  // are missing from the header.
  const headerDefinitions = lines.filter((line) => /^[A-Za-z_][A-Za-z0-9_]* = \$/.test(line));
  assert.equal(
    headerDefinitions.some((l) => l.startsWith("smc_operand ") || l.startsWith("smc_alias ")),
    false,
    `an inline-defined label must not ALSO be defined in the header -- that is ACME's \`Symbol already defined.\`:\n${result.source}`,
  );
});

test("`symbolCount` and `headerDefinitionCount` are separate numbers, and each matches its own doc (30-REVIEW WR-01)", () => {
  const { dir, storePath, imagePath } = aliasedSmcFixture("alias-symbol-count");
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  const lines = result.source.split("\n");

  assert.equal(
    result.symbolCount,
    3,
    "`symbolCount` is documented as every STORE LABEL the export carries, header and inline together -- entry, smc_operand, smc_alias",
  );

  // Counted off the EMITTED TEXT, so this asserts the field against the source
  // rather than against another copy of the same expression.
  const headerDefinitions = lines.filter((line) => /^[A-Za-z_][A-Za-z0-9_]* = \$/.test(line));
  assert.equal(
    result.headerDefinitionCount,
    headerDefinitions.length,
    `\`headerDefinitionCount\` must equal the definition lines the header really carries:\n${result.source}`,
  );
  assert.deepEqual(
    headerDefinitions.map((l) => l.split(" ")[0]).sort(),
    ["entry", "viccolor_BLACK"],
    `the header carries the ordinary label and the enum variant, and neither inline label:\n${result.source}`,
  );
  assert.notEqual(
    result.symbolCount,
    result.headerDefinitionCount,
    "this fixture exists BECAUSE the two numbers differ -- if they stop differing the test has gone vacuous",
  );
});

test("an ALIASED address records the collision and the pick in the emitted source, rather than choosing in silence (30-REVIEW WR-02)", () => {
  const { dir, storePath, imagePath } = aliasedSmcFixture("alias-marker");
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  const marked = result.source.split("\n").filter((line) => line.includes("ALIAS: this address also carries"));
  assert.equal(marked.length, 2, `BOTH definitions at the aliased address carry the marker:\n${result.source}`);
  for (const line of marked) {
    assert.ok(line.includes("smc_operand"), `the marker names every colliding label: ${line}`);
    assert.ok(line.includes("smc_alias"), `the marker names every colliding label: ${line}`);
    assert.match(
      line,
      /references render through smc_operand/,
      `the marker states WHICH name references resolve to, so the pick is not invisible: ${line}`,
    );
  }

  // And the pick itself is the FIRST name, stably -- not whichever sorted last.
  assert.ok(
    result.source.includes("        inc smc_operand"),
    `the reference renders through the first-indexed name:\n${result.source}`,
  );

  // Paired negative control: an UNALIASED store emits no marker at all, so the
  // assertions above cannot pass for a marker that is always present.
  const plain = smcFixture("alias-marker-control");
  const plainResult = exportAsm({ storePath: plain.storePath, imagePath: plain.imagePath, workspaceRoot: plain.dir });
  assert.equal(
    plainResult.source.includes("ALIAS:"),
    false,
    `a store with one label per address must carry no alias marker:\n${plainResult.source}`,
  );
});

test("ROUND TRIP: the ALIASED store still reassembles byte-identically -- a marker is a comment, not a byte", { skip: SKIP_REASON }, () => {
  // The markers and the second inline definition are both text. If either
  // changed a byte, this is where it shows -- and the byte-diff, not any
  // string match above, is what settles it.
  const { dir, storePath, imagePath } = aliasedSmcFixture("alias-roundtrip");
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  const verdict = verifyExport(result);
  assert.equal(verdict.outcome, "ok", `${verdict.reason}\n${result.source}`);
});

// ---------------------------------------------------------------------------
// The eleven typed auto-name prefixes, read from their ONE home.
//
// `anno-types.ts:93-99` forbids restating them and names the failure a short
// reimplementation causes: a five-prefix copy silently under-counts, breaking
// `routine-queue-walker`'s backlog construction while every test keeps passing.
// The structural scan below is what turns that from a rule into a check, and it
// has THREE directions -- including the comment-only control that stops it
// degrading into a substring search which passes by counting its own prose.
// ---------------------------------------------------------------------------

const EXPORTER_PATH = join(HERE, "anno-export-asm.ts");

/**
 * A quote-aware comment stripper, the shape `anno-cli-path-consumers.test.ts`
 * uses. A COPY rather than an import: that helper is not exported, and widening
 * another test file's surface for this one is a larger change than the twenty
 * lines below.
 */
function stripComments(src: string): string {
  let out = "";
  const n = src.length;
  let i = 0;
  let quote: string | null = null;
  while (i < n) {
    const c = src[i]!;
    if (quote) {
      out += c;
      if (c === "\\") {
        out += src[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * The eleven prefix tokens, parsed out of `AUTO_NAME_PREFIX_RE`'s OWN
 * alternation. Never a literal list -- see this file's WHAT NOT TO DO.
 */
function parseAutoNamePrefixes(): string[] {
  const match = /^\^\(([^)]+)\)$/.exec(AUTO_NAME_PREFIX_RE.source);
  assert.ok(
    match,
    `AUTO_NAME_PREFIX_RE is no longer a single anchored alternation, so this file can no longer derive the prefix set from it: ` +
      `${AUTO_NAME_PREFIX_RE.source}`,
  );
  return match[1]!.split("|");
}

/**
 * Regex literals in already-stripped TypeScript source, matched only where a
 * regex may legally BEGIN (start of line, or after an operator-ish character).
 * Without that guard the `/` inside a string like `"./anno-store.ts"` opens a
 * phantom literal and the scan reports on text that is not a regex at all.
 */
function regexLiteralBodies(strippedSrc: string): string[] {
  const bodies: string[] = [];
  for (const m of strippedSrc.matchAll(/(^|[=(,:[!&|?{;+\s])\/((?:\\.|\[[^\]]*\]|[^/\n\\])+)\/[dgimsuvy]*/gm)) {
    bodies.push(m[2]!);
  }
  return bodies;
}

/**
 * THE ONE PREDICATE. The real scan and BOTH controls call this same function,
 * so there is exactly one definition of "restates the auto-name prefixes rather
 * than importing them" -- the discipline `anno-cli-path-consumers.test.ts`
 * states: a structural test and its own proof must share the checked logic
 * rather than each carry a copy.
 *
 * `true` means VIOLATION: the source either does not import
 * `AUTO_NAME_PREFIX_RE` at all, or it carries a regex literal whose body names
 * two or more of the prefix tokens -- which is what a hand-rolled
 * reimplementation looks like.
 */
function restatesAutoNamePrefixes(strippedSrc: string, prefixes: readonly string[]): boolean {
  const importsTheRegex = /import\s*\{[^}]*\bAUTO_NAME_PREFIX_RE\b[^}]*\}\s*from/.test(strippedSrc);
  const restatingLiteral = regexLiteralBodies(strippedSrc).some((body) => prefixes.filter((prefix) => body.includes(prefix)).length >= 2);
  return !importsTheRegex || restatingLiteral;
}

test("the auto-name prefix set is parsed from AUTO_NAME_PREFIX_RE's own alternation: exactly eleven, `L_` absent, ASCII case-sensitive", () => {
  const prefixes = parseAutoNamePrefixes();
  assert.equal(
    prefixes.length,
    11,
    `the prefix vocabulary changed size. It is PARSED from AUTO_NAME_PREFIX_RE rather than copied, so the new member is already covered ` +
      `everywhere in this file -- update this pinned count and confirm the new prefix round-trips.\n  parsed: ${prefixes.join(", ")}`,
  );
  assert.equal(prefixes.includes("L_"), false, "`L_` must stay absent -- upstream gives it to predefined AND user-defined labels alike, so it cannot distinguish auto from user");
  assert.equal(AUTO_NAME_PREFIX_RE.test("L_main_loop"), false);

  // ASCII case-sensitive: an uppercased auto name is a user rename.
  assert.equal(AUTO_NAME_PREFIX_RE.test("s_0820"), true);
  assert.equal(AUTO_NAME_PREFIX_RE.test("S_0820"), false, "matching is ASCII case-sensitive, exactly as upstream emits the prefixes");
});

test("STRUCTURAL SCAN, all three directions: the exporter imports the prefix regex, a planted five-prefix copy is reported, and a comment-only mention is NOT", () => {
  const prefixes = parseAutoNamePrefixes();
  const real = stripComments(readFileSync(EXPORTER_PATH, "utf8"));

  // Direction 1: the real source is clean.
  assert.equal(
    restatesAutoNamePrefixes(real, prefixes),
    false,
    "anno-export-asm.ts must import AUTO_NAME_PREFIX_RE from its one home and carry no regex literal restating the prefixes. " +
      "A five-prefix copy under-counts silently and breaks routine-queue-walker's backlog construction while every test keeps passing.",
  );

  // Direction 2: a planted FIVE-prefix regex literal is reported. Built from the
  // parsed tokens, so it is a genuine short copy of the real vocabulary rather
  // than five names typed here.
  const plantedBody = `/^(${prefixes.slice(0, 5).join("|")})/`;
  const plantedSource = `${real}\nconst LOCAL_AUTO_PREFIX_RE = ${plantedBody};\n`;
  assert.equal(
    restatesAutoNamePrefixes(plantedSource, prefixes),
    true,
    `the scan must REPORT a five-prefix reimplementation, or it is not checking anything:\n  planted: ${plantedBody}`,
  );

  // Direction 3: the SAME text inside a comment is NOT reported. This is the
  // control that stops the scan degrading into a substring search that passes by
  // counting the module's own prose about the prefixes.
  const commentOnly = stripComments(`${readFileSync(EXPORTER_PATH, "utf8")}\n// a note mentioning ${plantedBody} in prose only\n`);
  assert.equal(
    restatesAutoNamePrefixes(commentOnly, prefixes),
    false,
    "a comment naming the prefixes is documentation, not a reimplementation -- a scan that cannot tell them apart would fire on the " +
      "module's own WHAT-NOT-TO-DO paragraph",
  );

  // And the planted violation must be caught for the RIGHT reason: a source with
  // the import removed is also a violation, by the other half of the predicate.
  assert.equal(
    restatesAutoNamePrefixes(real.replace("AUTO_NAME_PREFIX_RE", "SOMETHING_ELSE"), prefixes),
    true,
    "dropping the import is a violation too -- the predicate has two halves and both must bite",
  );
});

test("every one of the parsed prefixes round-trips as a label name, is MARKED in the source, and `L_`/uppercase names are not counted", { skip: SKIP_REASON }, () => {
  const prefixes = parseAutoNamePrefixes();

  // One label per parsed prefix, at addresses OUTSIDE the code range so no
  // substitution or mid-instruction rule is engaged -- this test is about the
  // marking, not about operand rendering.
  const autoLabels = prefixes.map((prefix, i) => ({ address: 0x2000 + i, name: `${prefix}${i.toString(16).padStart(2, "0")}` }));
  const { dir, storePath, imagePath } = buildStore(freshDir("prefixes"), {
    origin: 0x0801,
    body: SHAPE_BODY,
    ranges: [{ start: 0x0801, endInclusive: 0x0806, dataType: "code" }],
    labels: [
      ...autoLabels,
      // Both deliberate non-matches: `L_` is excluded from the vocabulary, and
      // matching is ASCII case-sensitive.
      { address: 0x2100, name: "L_0801" },
      { address: 0x2101, name: "S_0820" },
    ],
  });
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  const lines = result.source.split("\n");

  for (const label of autoLabels) {
    const line = lines.find((l) => l.startsWith(`${label.name} = `));
    assert.ok(line !== undefined, `every prefixed label must reach the source:\n${result.source}`);
    assert.notEqual(line.split("  ;")[1], undefined, `\`${label.name}\` must be MARKED as auto-generated:\n  line: ${line}`);
  }

  assert.equal(definitionOf(lines, "L_0801"), "L_0801 = $2100");
  assert.equal(lines.find((l) => l.startsWith("L_0801 = "))?.includes("  ;"), false, "`L_` is not an auto-name prefix, so its definition carries no marker");
  assert.equal(lines.find((l) => l.startsWith("S_0820 = "))?.includes("  ;"), false, "prefix matching is ASCII case-sensitive, so `S_0820` is a user rename");

  assert.equal(result.autoNamedSymbolCount, prefixes.length, "one marked definition per parsed prefix, and neither of the two non-matches");
  assert.equal(result.symbolCount, prefixes.length + 2);

  const verdict = verifyExport(result);
  assert.equal(verdict.outcome, "ok", `a store full of auto-named labels must still round-trip:${context(result, verdict)}`);
  assert.equal(verdict.byteDiff?.equal, true, `auto-name marking is a COMMENT and cannot change a byte:${context(result, verdict)}`);
});

// ---------------------------------------------------------------------------
// Enums, on the IMMEDIATE operand only.
//
// Measured on ACME 0.97: `lda #viccolor_BLACK` with `viccolor_BLACK = $00` is
// byte-identical to `lda #$00`, while the same symbol moved onto a following
// `sta` encodes as ZEROPAGE -- two bytes where the absolute original was three.
// The wrong-operand case changes both the bytes AND the instruction length.
// ---------------------------------------------------------------------------

/** `viccolor` over the two values the shape fixture's `lda #$00` can take. */
const VICCOLOR = { name: "viccolor", variants: { $00: "BLACK", $01: "WHITE" } } as const;

function enumFixture(tag: string, usageAddress: number): StoreFixture {
  return buildStore(freshDir(tag), {
    origin: 0x0801,
    body: SHAPE_BODY,
    ranges: [{ start: 0x0801, endInclusive: 0x0806, dataType: "code" }],
    labels: [{ address: 0x0801, name: "entry" }],
    enums: [{ name: VICCOLOR.name, variants: { ...VICCOLOR.variants } }],
    enumUsage: [{ address: usageAddress, name: VICCOLOR.name }],
  });
}

test("an enum on an IMMEDIATE operand renders as `#<enum>_<VARIANT>`, defines the variant in the header, and produces the SAME bytes as the plain form", { skip: SKIP_REASON }, () => {
  const withEnum = enumFixture("enum-immediate", 0x0801);
  const enumResult = exportAsm({ storePath: withEnum.storePath, imagePath: withEnum.imagePath, workspaceRoot: withEnum.dir });

  const plain = shapeFixture("enum-plain");
  const plainResult = exportAsm({ storePath: plain.storePath, imagePath: plain.imagePath, workspaceRoot: plain.dir });

  const lines = enumResult.source.split("\n");
  assert.ok(lines.includes("        lda #viccolor_BLACK"), `the immediate operand must render through the variant name:\n${enumResult.source}`);
  assert.equal(definitionOf(lines, "viccolor_BLACK"), "viccolor_BLACK = $00", `the variant is defined with TWO hex digits, per the width rule:\n${enumResult.source}`);
  assert.equal(lines.indexOf("viccolor_BLACK = $00") < lines.indexOf("* = $0801"), true, "the variant definition belongs in the header block, before the first `* =`");
  assert.equal(enumResult.enumSubstitutionCount, 1);
  assert.equal(enumResult.source.includes("lda #$00"), false, "the hex literal must be REPLACED, not merely accompanied");

  // The two exports must expect the SAME bytes: a name is not a value.
  assert.deepEqual([...enumResult.expectedBytes], [...plainResult.expectedBytes]);

  const enumVerdict = verifyExport(enumResult);
  const plainVerdict = verifyExport(plainResult);
  assert.equal(enumVerdict.outcome, "ok", `the enum form must round-trip:${context(enumResult, enumVerdict)}`);
  assert.equal(plainVerdict.outcome, "ok", `the plain form must round-trip:${context(plainResult, plainVerdict)}`);
  assert.equal(enumVerdict.byteDiff?.equal, true);
  assert.equal(plainVerdict.byteDiff?.equal, true);
});

test("an enum bound to a NON-IMMEDIATE operand is REFUSED by name, naming the address and the operand role", () => {
  // $0803 is the `sta $d020` -- an absolute operand.
  const { dir, storePath, imagePath } = enumFixture("enum-wrong-operand", 0x0803);
  assert.throws(
    () => exportAsm({ storePath, imagePath, workspaceRoot: dir }),
    (e: unknown) => {
      assert.ok(e instanceof Error);
      assert.match(e.message, /^exportAsm: /);
      assert.ok(e.message.includes("$0803"), `the refusal names the ADDRESS: ${e.message}`);
      assert.ok(e.message.includes("absolute"), `the refusal names the OPERAND ROLE it refused: ${e.message}`);
      assert.ok(e.message.includes("viccolor"), `the refusal names the ENUM, so a human can find the row: ${e.message}`);
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// 30-REVIEW CR-02 -- an enum bound to an UNEXPRESSIBLE immediate opcode was
// substituted into the trailing COMMENT and the export reported success.
//
// `decode()` assigns `role: "immediate"` from the addressing mode alone,
// independently of `acmeExpressible`, so the role gate above passed for six
// opcodes that `renderLine()` emits as a `!byte` DIRECTIVE with the mnemonic
// and its `#$xx` operand moved into the trailing comment. `indexOf("#$00")`
// then found the literal in the comment and rewrote it THERE. Reproduced
// against the committed code before this fix:
//
//   !byte $eb, $00  ; sbc #viccolor_BLACK  [illegal opcode | not expressible ...]
//   === enumSubstitutionCount: 1
//
// The enum symbol never reached the assembler, an unreferenced
// `viccolor_BLACK = $00` went into the header, the usage counted as applied
// and the CLI exited 0. The BYTES stay correct, so the byte-diff oracle
// cannot catch it and a round-trip test goes green -- which is precisely why
// this control asserts the REFUSAL rather than the bytes.
//
// All six are covered, not just the one reproduced first: a fix that hardened
// $eb alone would leave the shape armed under the other five.
const UNEXPRESSIBLE_IMMEDIATE_OPCODES: readonly { byte: number; mnemonic: string }[] = [
  { byte: 0x2b, mnemonic: "anc" },
  { byte: 0x82, mnemonic: "nop" },
  { byte: 0x89, mnemonic: "nop" },
  { byte: 0xc2, mnemonic: "nop" },
  { byte: 0xe2, mnemonic: "nop" },
  { byte: 0xeb, mnemonic: "sbc" },
];

test("PRECONDITION: every opcode in UNEXPRESSIBLE_IMMEDIATE_OPCODES really is `mode: immediate` AND `acmeExpressible: false`", () => {
  // Derived from the real table, so this list cannot silently drift from the
  // opcodes it claims to cover -- and a SEVENTH such opcode added later fails
  // here by name instead of going untested.
  const actual = Object.entries(OPCODES)
    .filter(([, entry]) => entry !== undefined && entry.mode === "immediate" && entry.acmeExpressible === false)
    .map(([key]) => Number(key))
    .sort((a, b) => a - b);
  assert.deepEqual(
    actual,
    UNEXPRESSIBLE_IMMEDIATE_OPCODES.map((o) => o.byte).sort((a, b) => a - b),
    "the unexpressible-immediate opcode set in disasm-opcodes.ts changed -- update this control's list",
  );
});

test("an enum bound to an UNEXPRESSIBLE immediate opcode is REFUSED by name, never substituted into the comment (30-REVIEW CR-02)", () => {
  for (const { byte, mnemonic } of UNEXPRESSIBLE_IMMEDIATE_OPCODES) {
    // `<opcode> #$00` then `rts` -- the enum's $00 variant matches the operand,
    // so every gate ABOVE the expressibility one passes and this test is
    // exercising exactly the gate it names.
    const fixture = buildStore(freshDir(`enum-unexpressible-${byte.toString(16)}`), {
      origin: 0x0801,
      body: [byte, 0x00, 0x60],
      ranges: [{ start: 0x0801, endInclusive: 0x0803, dataType: "code" }],
      enums: [{ name: VICCOLOR.name, variants: { ...VICCOLOR.variants } }],
      enumUsage: [{ address: 0x0801, name: VICCOLOR.name }],
    });
    assert.throws(
      () => exportAsm({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir }),
      (e: unknown) => {
        assert.ok(e instanceof Error);
        assert.match(e.message, /^exportAsm: /);
        assert.ok(e.message.includes("$0801"), `the refusal names the ADDRESS: ${e.message}`);
        assert.ok(e.message.includes("viccolor"), `the refusal names the ENUM, so a human can find the row: ${e.message}`);
        assert.ok(e.message.includes(mnemonic), `the refusal names the MNEMONIC it refused: ${e.message}`);
        assert.match(
          e.message,
          /NOT EXPRESSIBLE/,
          `the refusal must name expressibility as the reason, not the operand role (which is "immediate" here): ${e.message}`,
        );
        return true;
      },
      `opcode $${byte.toString(16).padStart(2, "0")} (${mnemonic} #imm) must be REFUSED, not silently substituted into its trailing comment`,
    );
  }
});

test("substituteImmediateEnum() refuses a literal that lives only in the trailing comment (30-REVIEW CR-02, defence in depth)", () => {
  // The renderer shape the CR-02 reproduction produced, handed to the
  // substitution directly: the assembler-visible half carries no `#$00` at
  // all, only the trailing comment does. A search over the WHOLE line finds
  // it and returns a line whose `!byte` list is untouched; a search confined
  // to the directive half refuses.
  const line = "        !byte $eb, $00  ; sbc #$00  [illegal opcode | not expressible in ACME !cpu 6510]";
  assert.throws(
    () => substituteImmediateEnum(line, 0x00, "viccolor_BLACK", 0x0801),
    (e: unknown) => {
      assert.ok(e instanceof Error);
      assert.match(e.message, /ASSEMBLER-VISIBLE/);
      assert.ok(e.message.includes("$0801"), `the refusal names the address: ${e.message}`);
      return true;
    },
    "a `#$xx` that exists only in the trailing comment must be refused, not rewritten where the assembler never reads it",
  );

  // Paired positive control: the ordinary expressible shape still substitutes,
  // so a substituteImmediateEnum() that threw unconditionally would fail here
  // rather than pass the refusal above vacuously.
  assert.equal(
    substituteImmediateEnum("        lda #$00  ; a note", 0x00, "viccolor_BLACK", 0x0801),
    "        lda #viccolor_BLACK  ; a note",
    "the directive half's literal is still substituted, and the trailing comment is left alone",
  );
});

test("WRONG-OPERAND CONTROL: hand-moving the enum symbol onto a following `sta` is REFUSED at the source-text boundary", { skip: SKIP_REASON }, () => {
  const { dir, storePath, imagePath } = enumFixture("enum-control", 0x0801);
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  // ONE documented move: the symbol leaves the immediate operand it belongs on
  // and lands on the absolute operand of the following `sta`.
  const moved = result.source.replace("        lda #viccolor_BLACK", "        lda #$00").replace("        sta $d020", "        sta viccolor_BLACK");
  assert.notEqual(moved, result.source, "the move must change the source");
  assert.ok(moved.includes("        sta viccolor_BLACK"), `the sta must actually carry the symbol:\n${moved}`);

  const verdict = verifyExportText(result, moved);

  // WHAT IS LOAD-BEARING AND ASSERTED UNCONDITIONALLY: the mutation is REFUSED,
  // and nothing about the run reads as a pass.
  assert.equal(
    verdict.outcome,
    "failed",
    `the wrong-operand emission must be REFUSED:\n  outcome: ${verdict.outcome}\n  reason: ${verdict.reason}\n  exitStatus: ${verdict.exitStatus}\n${moved}`,
  );
  assert.notEqual(verdict.outcome, "ok");
  assert.notEqual(verdict.byteDiff?.equal, true);

  // WHICH RULE PRODUCED THE VERDICT IS OBSERVED, NEVER PINNED IN ADVANCE. Two
  // refusals are in play and they disagree about the exit code. `viccolor_BLACK`
  // is $00, so `sta viccolor_BLACK` re-encodes as ZEROPAGE -- two bytes where
  // the absolute original was three -- and the block's own `!if * != $0807` end
  // assertion fires first. That is a STRONGER catch than the byte-diff, not a
  // weaker one: ACME exits 1 and writes no output file at all. Recorded as
  // measured; the `*` assertion is NOT silenced to manufacture an exit-0
  // observation, because that would disable one instrument to demonstrate
  // another.
  if (verdict.exitStatus === 1) {
    assert.ok(
      verdict.diagnostics.some((d) => d.includes("export-asm: block end drifted")),
      `at exit 1, the per-block \`*\` assertion must be the rule that produced the verdict:\n  diagnostics: ${verdict.diagnostics.join(" | ")}`,
    );
  } else {
    assert.equal(verdict.exitStatus, 0, `ACME's exit status is one of the two measured outcomes:\n  reason: ${verdict.reason}`);
    assert.equal(verdict.byteDiff?.equal, false, `at exit 0, the byte-diff must be the rule that produced the verdict:\n  reason: ${verdict.reason}`);
  }
});

test("an enum carrying a variant above $ff is REFUSED for an immediate operand, and real ACME refuses the same shape with `Number does not fit in 8 bits.`", { skip: SKIP_REASON }, () => {
  const { dir, storePath, imagePath } = buildStore(freshDir("enum-wide"), {
    origin: 0x0801,
    body: SHAPE_BODY,
    ranges: [{ start: 0x0801, endInclusive: 0x0806, dataType: "code" }],
    labels: [],
    enums: [{ name: "viccolor", variants: { $00: "BLACK", $0100: "WIDE" } }],
    enumUsage: [{ address: 0x0801, name: "viccolor" }],
  });

  assert.throws(
    () => exportAsm({ storePath, imagePath, workspaceRoot: dir }),
    (e: unknown) => {
      assert.ok(e instanceof Error);
      assert.match(e.message, /^exportAsm: /);
      assert.ok(e.message.includes("WIDE"), `the refusal names the VARIANT: ${e.message}`);
      assert.ok(e.message.includes("$0801"), `the refusal names the ADDRESS: ${e.message}`);
      return true;
    },
  );

  // THE EXTERNAL ORACLE, agreeing with the internal one. The exporter refuses
  // first so its message can name the store row; ACME refuses the same shape
  // with its own words and its own exit status.
  const wide = assembleRaw("!cpu 6510\nviccolor_WIDE = $0100\n* = $0801\n        lda #viccolor_WIDE\n        rts\n");
  assert.equal(wide.status, 1, `real ACME must refuse a >$ff value on an immediate operand:\n  stdout: ${wide.stdout}\n  stderr: ${wide.stderr}`);
  assert.ok(
    wide.stderr.includes("Number does not fit in 8 bits."),
    `ACME's OWN message must be what refused it:\n  stderr: ${wide.stderr}`,
  );

  // The paired direction: the same source with a value that DOES fit assembles,
  // so the red above is one changed value and nothing else.
  const narrow = assembleRaw("!cpu 6510\nviccolor_WIDE = $01\n* = $0801\n        lda #viccolor_WIDE\n        rts\n");
  assert.equal(narrow.status, 0, `the same shape with a byte value must assemble:\n  stderr: ${narrow.stderr}`);
});

test("an enum usage with no decoded instruction at its address is REFUSED by name, never silently dropped", () => {
  // $0802 is the operand byte of the `lda #$00` at $0801 -- no emitted line
  // starts there.
  const { dir, storePath, imagePath } = enumFixture("enum-unplaceable", 0x0802);
  assert.throws(
    () => exportAsm({ storePath, imagePath, workspaceRoot: dir }),
    (e: unknown) => {
      assert.ok(e instanceof Error);
      assert.match(e.message, /^exportAsm: /);
      assert.ok(e.message.includes("$0802"), `the refusal names the address it could not attach to: ${e.message}`);
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// D-16/D-17 (plan 45-05): the OR-ed multi-bit decomposition. `decomposeRegisterValue()`
// (`anno-enum-gen.ts`, plan 45-03) is the ONE owning decoder; this module never
// decodes a bit itself -- see the header import comment and `grep -ac
// 'field.mask'` (must stay 0). An enum usage whose NAME has the shape
// `registerKeyFor().slice(1)` produces (four uppercase hex digits) is
// attempted through that decoder; a register with two or more fields (D-18
// has three) renders as OR-ed named constants PLUS a decoded comment -- both
// halves, never either alone (D-17).
// ---------------------------------------------------------------------------

/** `lda #$04` / `sta $d018` / `rts` -- $D018 with value $04 decodes (per the
 * real committed `anno-regbits.json`) to THREE numeric-kind terms:
 * `SELECT_UPPER_LOWER_CHARACTER_SET` = 0, `CHARACTER_DOT_DATA_BASE_ADDRESS` =
 * 2 (masked contribution $04), `VIDEO_MATRIX_BASE_ADDRESS` = 0. Every field is
 * `kind: "numeric"`, so every one of the three ALWAYS emits a term regardless
 * of whether its own decoded value is zero -- unlike a `flag` field's
 * silent-by-design empty token. */
const D018_BODY = [0xa9, 0x04, 0x8d, 0x18, 0xd0, 0x60] as const;

const D018_SELECT = "D018_SELECT_UPPER_LOWER_CHARACTER_SET0";
const D018_CHARDATA = "D018_CHARACTER_DOT_DATA_BASE_ADDRESS2";
const D018_MATRIX = "D018_VIDEO_MATRIX_BASE_ADDRESS0";

function d018Fixture(tag: string, extra: Partial<StoreSpec> = {}): StoreFixture {
  return buildStore(freshDir(tag), {
    origin: 0x0801,
    body: D018_BODY,
    ranges: [{ start: 0x0801, endInclusive: 0x0806, dataType: "code" }],
    enums: [{ name: "D018", variants: {} }],
    enumUsage: [{ address: 0x0801, name: "D018" }],
    ...extra,
  });
}

/** The directive half of a line -- everything before `disasm-renderer.ts`'s
 * own `"  ; "` comment separator, the same split `substituteImmediateEnum()`
 * confines its own search to. */
function directiveHalf(line: string): string {
  return line.split("  ; ")[0]!;
}

test("D-17 Test 1/2: a multi-field register write renders OR-ed term names in ascending bit order, with no `$` hex literal in the operand, plus a trailing decoded comment naming every field", { skip: SKIP_REASON }, () => {
  const { dir, storePath, imagePath } = d018Fixture("d018-basic");
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  const lines = result.source.split("\n");
  const ldaLine = lines.find((l) => l.includes("lda #"));
  assert.ok(ldaLine !== undefined, `the lda line must be present:\n${result.source}`);

  const expectedOperand = `#${D018_SELECT} | ${D018_CHARDATA} | ${D018_MATRIX}`;
  assert.ok(directiveHalf(ldaLine!).includes(expectedOperand), `the operand must be the OR-ed term names in ascending bit order:\n${ldaLine}`);
  assert.ok(!directiveHalf(ldaLine!).includes("$"), `the operand must carry no hex literal at all:\n${ldaLine}`);
  assert.equal(result.source.includes("lda #$04"), false, "the hex literal must be REPLACED, not merely accompanied");

  assert.ok(ldaLine!.includes("  ; $D018: "), `a trailing mechanical-decode comment must be present:\n${ldaLine}`);
  for (const fragment of ["SELECT_UPPER_LOWER_CHARACTER_SET=0", "CHARACTER_DOT_DATA_BASE_ADDRESS=2", "VIDEO_MATRIX_BASE_ADDRESS=0"]) {
    assert.ok(ldaLine!.includes(fragment), `the comment must name every field and its decoded value (${fragment}):\n${ldaLine}`);
  }

  assert.equal(result.enumSubstitutionCount, 1);
  assert.equal(result.enumDecompositionCount, 1);

  const verdict = verifyExport(result);
  assert.equal(verdict.outcome, "ok", `the OR-ed decomposition must round-trip byte-identically:${context(result, verdict)}`);
  assert.equal(verdict.byteDiff?.equal, true, `the byte-diff IS D-17's proof:${context(result, verdict)}`);
});

test("D-17 Test 3: each per-field constant is defined exactly once in the header, even when two instructions write the same field value", { skip: SKIP_REASON }, () => {
  const body = [
    ...D018_BODY, // lda #$04 / sta $d018 / rts, $0801..$0806
    0xa9, 0x04, // a SECOND lda #$04 at $0807..$0808
    0x8d, 0x18, 0xd0, // sta $d018 at $0809..$080b
    0x60, // rts at $080c
  ];
  const { dir, storePath, imagePath } = buildStore(freshDir("d018-repeat"), {
    origin: 0x0801,
    body,
    ranges: [{ start: 0x0801, endInclusive: 0x080c, dataType: "code" }],
    enums: [{ name: "D018", variants: {} }],
    enumUsage: [
      { address: 0x0801, name: "D018" },
      { address: 0x0807, name: "D018" },
    ],
  });
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  assert.equal(result.enumSubstitutionCount, 2, "both instructions substituted");
  assert.equal(result.enumDecompositionCount, 2, "both instructions decomposed");

  for (const term of [D018_SELECT, D018_CHARDATA, D018_MATRIX]) {
    const occurrences = result.source.split("\n").filter((l) => l.startsWith(`${term} = `));
    assert.equal(occurrences.length, 1, `${term} must be defined EXACTLY ONCE, not once per instruction that used it:\n${result.source}`);
  }

  const verdict = verifyExport(result);
  assert.equal(verdict.outcome, "ok", `two identical decomposed writes must still round-trip:${context(result, verdict)}`);
  assert.equal(verdict.byteDiff?.equal, true);
});

test("D-16 Test 4: a SINGLE-field register still renders the existing single `<enum>_<VARIANT>` symbol -- the old path is not replaced", { skip: SKIP_REASON }, () => {
  // $DC00 ("Data Port A") has exactly ONE field spanning the whole byte in the
  // real committed anno-regbits.json -- `decomposeRegisterValue(0xdc00,
  // ...).multiField === false`. The old path uses the STORE's own
  // hand-authored variant name ("ALLOW_ALL"), never
  // `decomposeRegisterValue()`'s own field-token naming -- proof the two
  // paths are genuinely different code, not the same rendering under two
  // names.
  const { dir, storePath, imagePath } = buildStore(freshDir("dc00-single-field"), {
    origin: 0x0801,
    body: [0xa9, 0x00, 0x8d, 0x00, 0xdc, 0x60], // lda #$00 / sta $dc00 / rts
    ranges: [{ start: 0x0801, endInclusive: 0x0806, dataType: "code" }],
    enums: [{ name: "DC00", variants: { $00: "ALLOW_ALL" } }],
    enumUsage: [{ address: 0x0801, name: "DC00" }],
  });
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  const lines = result.source.split("\n");

  assert.ok(lines.some((l) => directiveHalf(l).includes("lda #DC00_ALLOW_ALL")), `the OLD single-symbol path must still fire:\n${result.source}`);
  assert.equal(definitionOf(lines, "DC00_ALLOW_ALL"), "DC00_ALLOW_ALL = $00");
  assert.equal(result.enumSubstitutionCount, 1);
  assert.equal(result.enumDecompositionCount, 0, "a single-field register is not a decomposition, however register-shaped its name is");

  const verdict = verifyExport(result);
  assert.equal(verdict.outcome, "ok", `the single-field old path must still round-trip:${context(result, verdict)}`);
  assert.equal(verdict.byteDiff?.equal, true);
});

test("D-17 Test 5: an authored side comment at the decomposed instruction renders FIRST, then the mechanical decode after a ` -- ` separator -- neither is dropped", { skip: SKIP_REASON }, () => {
  const { dir, storePath, imagePath } = d018Fixture("d018-authored-comment", {
    comments: [{ address: 0x0801, commentType: "side", text: "set 40-col screen at $0400" }],
  });
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  const lines = result.source.split("\n");
  const ldaLine = lines.find((l) => l.includes("lda #"));
  assert.ok(ldaLine !== undefined, `the lda line must be present:\n${result.source}`);

  const authoredAt = ldaLine!.indexOf("set 40-col screen at $0400");
  const mechanicalAt = ldaLine!.indexOf("$D018: SELECT_UPPER_LOWER_CHARACTER_SET=0");
  assert.ok(authoredAt >= 0, `the authored comment must survive:\n${ldaLine}`);
  assert.ok(mechanicalAt >= 0, `the mechanical decode must survive:\n${ldaLine}`);
  assert.ok(authoredAt < mechanicalAt, `the authored comment renders FIRST:\n${ldaLine}`);
  assert.ok(
    ldaLine!.includes("set 40-col screen at $0400 -- $D018:"),
    `the two are joined by a \` -- \` separator on the SAME trailing comment:\n${ldaLine}`,
  );

  const verdict = verifyExport(result);
  assert.equal(verdict.outcome, "ok", `a merged authored+mechanical comment must not change a byte:${context(result, verdict)}`);
  assert.equal(verdict.byteDiff?.equal, true);
});

test("D-17 Test 6: a decomposition that would define one term name with two different values is REFUSED, naming the symbol and both values", () => {
  // The REAL committed $D011/$D018 tables cannot reach this: for any single
  // real field, decomposeRegisterValue()'s name<->value mapping is a
  // bijection (the name embeds the decoded number, or is a table lookup this
  // project's own exhaustive test proves injective across all 256 values --
  // see 45-03-SUMMARY.md). Reaching a genuine "same name, different value"
  // collision therefore needs a deliberately non-injective synthetic table --
  // the SAME sanctioned technique `anno-enum-gen.test.ts` uses for its own
  // synthetic-register tests.
  const synthetic: RegBitsTable = {
    $E000: {
      label: "synthetic ambiguous-token register (test-only, plan 45-05)",
      fields: [
        { mask: 0x01, shift: 0, name: "FLAG", kind: "flag", tokens: { 0: "SAME", 1: "SAME" } },
        { mask: 0x02, shift: 1, name: "OTHER", kind: "flag", tokens: { 0: "", 1: "OTHER" } },
      ],
    },
  };
  __resetRegBitsCacheForTests(synthetic);
  try {
    const { dir, storePath, imagePath } = buildStore(freshDir("e000-collision"), {
      origin: 0x0801,
      body: [
        0xa9, 0x00, // lda #$00 @ $0801
        0x8d, 0x20, 0xd0, // sta $d020 @ $0803 (arbitrary; the usage binds to the LOAD)
        0xa9, 0x01, // lda #$01 @ $0806
        0x8d, 0x21, 0xd0, // sta $d021 @ $0808
        0x60, // rts @ $080b
      ],
      ranges: [{ start: 0x0801, endInclusive: 0x080b, dataType: "code" }],
      enums: [{ name: "E000", variants: {} }],
      enumUsage: [
        { address: 0x0801, name: "E000" },
        { address: 0x0806, name: "E000" },
      ],
    });

    assert.throws(
      () => exportAsm({ storePath, imagePath, workspaceRoot: dir }),
      (e: unknown) => {
        assert.ok(e instanceof Error);
        assert.match(e.message, /^exportAsm: /);
        assert.ok(e.message.includes("E000_SAME"), `the refusal names the colliding SYMBOL: ${e.message}`);
        assert.ok(e.message.includes("$00") && e.message.includes("$01"), `the refusal names BOTH conflicting values: ${e.message}`);
        return true;
      },
    );
  } finally {
    __resetRegBitsCacheForTests(undefined);
  }
});

test("D-17 Test 7: `enumSubstitutionCount` and `enumDecompositionCount` are two separately-reported numbers, never combined", { skip: SKIP_REASON }, () => {
  const { dir, storePath, imagePath } = buildStore(freshDir("mixed-counts"), {
    origin: 0x0801,
    body: [
      ...D018_BODY, // decomposed write, $0801..$0806
      0xa9, 0x00, // lda #$00 @ $0807 -- the OLD single-symbol enum path
      0x8d, 0x20, 0xd0, // sta $d020 @ $0809
      0x60, // rts @ $080c
    ],
    ranges: [{ start: 0x0801, endInclusive: 0x080c, dataType: "code" }],
    enums: [
      { name: "D018", variants: {} },
      { name: "viccolor", variants: { $00: "BLACK" } },
    ],
    enumUsage: [
      { address: 0x0801, name: "D018" },
      { address: 0x0807, name: "viccolor" },
    ],
  });
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  assert.equal(result.enumSubstitutionCount, 2, "both usages substituted -- decomposed and single-symbol alike");
  assert.equal(result.enumDecompositionCount, 1, "only the D018 write is a decomposition");
  assert.notEqual(
    result.enumSubstitutionCount,
    result.enumDecompositionCount,
    "the two figures disagree here on purpose -- proof neither is computed as a copy of the other",
  );

  const verdict = verifyExport(result);
  assert.equal(verdict.outcome, "ok", `a store mixing both enum paths must still round-trip:${context(result, verdict)}`);
  assert.equal(verdict.byteDiff?.equal, true);
});

// ---------------------------------------------------------------------------
// 45-REVIEW CR-01 (fixed 2026-09-11): the decomposition attempt is gated on
// TABLE MEMBERSHIP (`hasRegBitsEntry()`), not name shape alone. Before this
// fix, a register-shaped enum name for a register `anno-regbits.json` simply
// does not cover (e.g. `$D020`, one of the most commonly hand-annotated C64
// registers) made `decomposeRegisterValue()` throw its "no bit-name table
// entry" error, and the export re-threw it fatally instead of falling
// through to the pre-existing single-symbol path. The two tests below cover
// both branches the fix distinguishes: absent-from-table (falls through, no
// throw, no substitution counted) and present-but-incomplete (still refuses
// loudly -- T-45-21's invariant, unaffected by this fix).
// ---------------------------------------------------------------------------

test("CR-01 Fix Test A: a register-shaped enum name for a register anno-regbits.json has NO entry for ($D020) falls through to the single-symbol path, counts no decomposition, and does not throw", { skip: SKIP_REASON }, () => {
  const { dir, storePath, imagePath } = buildStore(freshDir("d020-absent"), {
    origin: 0x0801,
    body: [0xa9, 0x00, 0x8d, 0x20, 0xd0, 0x60], // lda #$00 / sta $d020 / rts
    ranges: [{ start: 0x0801, endInclusive: 0x0806, dataType: "code" }],
    enums: [{ name: "D020", variants: { $00: "BLACK" } }],
    enumUsage: [{ address: 0x0801, name: "D020" }],
  });
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  const lines = result.source.split("\n");

  assert.ok(
    lines.some((l) => directiveHalf(l).includes("lda #D020_BLACK")),
    `an absent-from-table register-shaped enum must still render through the PLAIN single-symbol path:\n${result.source}`,
  );
  assert.equal(definitionOf(lines, "D020_BLACK"), "D020_BLACK = $00");
  assert.equal(result.enumSubstitutionCount, 1, "the plain substitution still counts");
  assert.equal(
    result.enumDecompositionCount,
    0,
    "a register absent from anno-regbits.json is never a decomposition, however register-shaped its name is (45-REVIEW CR-01)",
  );

  const verdict = verifyExport(result);
  assert.equal(verdict.outcome, "ok", `the fallback path must still round-trip:${context(result, verdict)}`);
  assert.equal(verdict.byteDiff?.equal, true);
});

test("CR-01 Fix Test B: a register PRESENT in the table but not fully covered by its fields ($DD00, bits #0-#1 uncovered) still refuses loudly -- the membership-test fix does not weaken T-45-21", () => {
  const { dir, storePath, imagePath } = buildStore(freshDir("dd00-incomplete"), {
    origin: 0x0801,
    body: [0xa9, 0x01, 0x8d, 0x00, 0xdd, 0x60], // lda #$01 (bit #0 set) / sta $dd00 / rts
    ranges: [{ start: 0x0801, endInclusive: 0x0806, dataType: "code" }],
    enums: [{ name: "DD00", variants: {} }],
    enumUsage: [{ address: 0x0801, name: "DD00" }],
  });

  assert.throws(
    () => exportAsm({ storePath, imagePath, workspaceRoot: dir }),
    (e: unknown) => {
      assert.ok(e instanceof Error);
      assert.match(e.message, /^exportAsm: /);
      assert.ok(
        e.message.includes("decomposing the enum usage") && e.message.includes("bit-name table failed"),
        `the refusal must be the genuine decomposition failure, not the fallback path: ${e.message}`,
      );
      assert.ok(e.message.includes("DD00"), `the refusal names the register/enum: ${e.message}`);
      assert.ok(e.message.includes("not fully covered"), `the refusal names the real cause (incomplete field coverage): ${e.message}`);
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// Task 2 (plan 45-05): THE REAL-ACME BYTE-DIFF ORACLE, criterion 5's own
// proof. `fixtures/ghidra/charset-phantom.a`'s `start` writes BOTH `$D011`
// and `$D018` -- criterion 5's only home among the committed fixtures
// (45-RESEARCH.md Flag 3) -- and this case reproduces those same two
// register writes over a small synthetic image, through the SAME oracle
// machinery every other positive case in this file uses
// (`verifyExport()` -> `verifyAcmeAssembles()`), never a second one.
//
// THE NON-VACUITY CONTROL IS THE POINT: a byte-diff alone would pass
// IDENTICALLY on a regression that silently stopped decomposing and emitted
// plain hex literals instead -- `lda #$04` and `lda #$1b` produce the exact
// same bytes as the OR-ed form (that IS the proof the decomposition is
// arithmetically correct). The ` | ` assertions below are what makes this
// case fail on that regression even though the bytes would still match.
// ---------------------------------------------------------------------------

test("TASK 2 ORACLE: the OR-ed decomposition for BOTH $D011 and $D018 reassembles byte-identically through real ACME, and the exported text is proven non-vacuous", { skip: SKIP_REASON }, () => {
  const body = [
    0xa9, 0x04, // lda #$04         @ $0801..$0802
    0x8d, 0x18, 0xd0, // sta $d018  @ $0803..$0805
    0xa9, 0x1b, // lda #$1b         @ $0806..$0807
    0x8d, 0x11, 0xd0, // sta $d011  @ $0808..$080a
    0x60, // rts                    @ $080b
  ];
  const { dir, storePath, imagePath } = buildStore(freshDir("d011-d018-oracle"), {
    origin: 0x0801,
    body,
    ranges: [{ start: 0x0801, endInclusive: 0x080b, dataType: "code" }],
    // Installed through the SAME public write path `generateEnumsFromStore()`
    // (D-15, plan 45-03) uses -- `createProjectEnum()` + `applyEnumUsage()` --
    // never raw SQL, matching every other fixture in this file.
    enums: [
      { name: "D018", variants: {} },
      { name: "D011", variants: {} },
    ],
    enumUsage: [
      { address: 0x0801, name: "D018" },
      { address: 0x0806, name: "D011" },
    ],
  });
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  // NON-VACUITY FIRST: both instructions must actually carry an OR
  // expression, or the byte-diff below would be proving nothing about D-17's
  // rendering.
  assert.ok(result.source.includes(`#${D018_SELECT} | ${D018_CHARDATA} | ${D018_MATRIX}`), `the $D018 write must render OR-ed:\n${result.source}`);
  assert.ok(
    result.source.includes("#D011_YSCROLL3 | D011_ROW25 | D011_SCREENON | D011_TEXT"),
    `the $D011 write must render OR-ed:\n${result.source}`,
  );
  assert.equal(result.source.includes("lda #$04"), false, "the $D018 hex literal must be REPLACED");
  assert.equal(result.source.includes("lda #$1b"), false, "the $D011 hex literal must be REPLACED");
  assert.equal(result.enumDecompositionCount, 2, "both writes are decompositions");

  // THE PROOF: real ACME assembles the exported source, and the produced
  // bytes equal the source image byte for byte.
  const verdict = verifyExport(result);
  assert.equal(verdict.outcome, "ok", `criterion 5's own proof must round-trip:${context(result, verdict)}`);
  assert.equal(verdict.byteDiff?.equal, true, `the byte-diff IS the proof the decomposition is arithmetically correct:${context(result, verdict)}`);
});

test("a store with no enums reports `enumSubstitutionCount` zero and `autoNamedSymbolCount` zero -- neither counter is a constant", () => {
  const { dir, storePath, imagePath } = shapeFixture("enum-count-zero");
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  assert.equal(result.enumSubstitutionCount, 0);
  assert.equal(result.autoNamedSymbolCount, 0, "`entry` is a user-chosen name and matches no auto prefix");
});

test("a store with an EMPTY enum set still reassembles byte-identically -- an exporter that only works on a richly annotated store fails on a fresh project", { skip: SKIP_REASON }, () => {
  const { dir, storePath, imagePath } = shapeFixture("empty-enums");
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  assert.equal(result.enumSubstitutionCount, 0);
  const definitions = result.source.split("\n").filter((line) => /^[A-Za-z_][A-Za-z0-9_]* = \$/.test(line));
  assert.deepEqual(definitions, ["entry = $0801"], `no enum variant definition may be emitted when the store holds no enums:\n${result.source}`);

  const verdict = verifyExport(result);
  assert.equal(verdict.outcome, "ok", `an enum-free export must round-trip:${context(result, verdict)}`);
  assert.equal(verdict.byteDiff?.equal, true, `enum-free byte-diff:${context(result, verdict)}`);
});

test("a SINGLE-ELEMENT range -- one byte, one instruction -- exports bracketed and reassembles byte-identically", { skip: SKIP_REASON }, () => {
  const { dir, storePath, imagePath } = buildStore(freshDir("single-element"), {
    origin: 0x0801,
    body: [0x60],
    ranges: [{ start: 0x0801, endInclusive: 0x0801, dataType: "code" }],
    labels: [],
  });
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  assert.equal(result.blocks.length, 1);
  assert.equal(result.blocks[0]?.endExclusive, 0x0802, "endExclusive is one past the last byte, even for a one-byte range");
  assert.equal(result.expectedBytes.length, 1);
  assert.ok(
    result.source.split("\n").includes('!if * != $0802 { !error "export-asm: block end drifted, expected $0802" }'),
    `a one-byte block is bracketed like any other:\n${result.source}`,
  );

  const verdict = verifyExport(result);
  assert.equal(verdict.outcome, "ok", `a single-element range must round-trip:${context(result, verdict)}`);
  assert.equal(verdict.byteDiff?.equal, true, `single-element byte-diff:${context(result, verdict)}`);
});

// ---------------------------------------------------------------------------
// All 256 opcodes through the exporter, in ONE image and ONE ACME invocation.
//
// This is the control that caught FOURTEEN wrong entries in `disasm-opcodes.ts`
// during phase 04: two `jam`/`anc` duplicate groups and four `nop` subgroups
// were corrected from an untested seed by a real-ACME round trip. Every
// assertion below is driven from the `OPCODES` table itself, so a future
// correction to that table is automatically re-verified the next time this file
// runs.
// ---------------------------------------------------------------------------

const RENDERER_PATH = join(HERE, "disasm-renderer.ts");

/** `disasm-renderer.ts`'s FIXED note vocabulary for the two flags that put an
 * instruction on the `!byte` path. Not exported from that module, so the
 * strings are asserted present in its source below before anything matches on
 * them -- the `acme-gate.test.ts` non-vacuity technique. */
const UNASSEMBLABLE_NOTE = "not expressible in ACME !cpu 6510";
const ILLEGAL_NOTE = "illegal opcode";

/** `$xx`, matching `disasm-renderer.ts`'s own `!byte` operand spelling. */
function byteHex(value: number): string {
  return `$${(value & 0xff).toString(16).padStart(2, "0")}`;
}

/**
 * ONE image in which every opcode `$00..$ff` decodes at a known address, in
 * opcode order: the opcode byte followed by `OPCODES[b].length - 1` filler
 * bytes, so the linear decode stays aligned. `disasm-roundtrip.test.ts`'s
 * Suite C is the model.
 *
 * The filler is `$00`, which keeps every relative branch's target at
 * `address + 2` -- inside the block and trivially in range -- and every
 * absolute operand at `$0000`, which `disasm-renderer.ts` renders with its
 * `+2` width force.
 */
function everyOpcodeImage(origin: number): { bytes: number[]; addressOf: number[] } {
  const bytes: number[] = [];
  const addressOf: number[] = [];
  for (let op = 0; op <= 0xff; op++) {
    addressOf[op] = origin + bytes.length;
    bytes.push(op);
    for (let i = 1; i < OPCODES[op]!.length; i++) bytes.push(0x00);
  }
  return { bytes, addressOf };
}

/**
 * Phase 47, plan 47-04 (BUILD-03): every relative-mode opcode's own resolved
 * target -- `address + 2`, per `everyOpcodeImage()`'s own doc-comment -- is
 * an address INSIDE this block, and the new in-tree symbol rule refuses an
 * in-tree reference with no label at its target. One label per relative
 * opcode's target is therefore not optional annotation here: it is what
 * keeps this fixture exporting at all under the rule Task 1 added. Each
 * target is the START of the next opcode's own instruction (never
 * mid-instruction), so every one of these is a HEADER definition only --
 * `content.length` below stays 256, unchanged by adding them.
 */
function everyOpcodeBranchTargetLabels(addressOf: readonly number[]): { address: number; name: string }[] {
  const labels: { address: number; name: string }[] = [];
  for (let op = 0; op <= 0xff; op++) {
    if (OPCODES[op]!.mode === "relative") {
      labels.push({ address: addressOf[op]! + 2, name: `lbl_${(addressOf[op]! + 2).toString(16)}` });
    }
  }
  return labels;
}

test("the `!byte` note vocabulary matched below is really present in disasm-renderer.ts (so this file cannot pass for the wrong reason)", () => {
  const src = readFileSync(RENDERER_PATH, "utf8");
  for (const note of [UNASSEMBLABLE_NOTE, ILLEGAL_NOTE]) {
    assert.ok(src.includes(note), `disasm-renderer.ts no longer contains the note text this file matches on (${JSON.stringify(note)}) -- update both together, never only one`);
  }
});

test("ALL 256 OPCODES: every `acmeExpressible: false` entry goes out as `!byte` with a naming comment, and the whole export reassembles byte-identically", { skip: SKIP_REASON }, () => {
  const origin = 0x1000;
  const { bytes, addressOf } = everyOpcodeImage(origin);
  const { dir, storePath, imagePath } = buildStore(freshDir("all-opcodes"), {
    origin,
    body: bytes,
    ranges: [{ start: origin, endInclusive: origin + bytes.length - 1, dataType: "code" }],
    // The 8 relative-branch self-references (phase 47 plan 47-04, BUILD-03)
    // -- every other opcode's own operand/resolvedTarget is out-of-tree
    // ($0000, below `origin`), so this is the fixture's complete label set.
    labels: everyOpcodeBranchTargetLabels(addressOf),
  });

  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  const lines = result.source.split("\n");

  const originAssert = lines.findIndex((l) => l.startsWith("!if * != ") && l.includes("block origin drifted"));
  const endAssert = lines.findIndex((l) => l.startsWith("!if * != ") && l.includes("block end drifted"));
  assert.ok(originAssert >= 0 && endAssert > originAssert, `the block must be bracketed:\n${result.source}`);
  const content = lines.slice(originAssert + 1, endAssert);
  assert.equal(
    content.length,
    256,
    "one emitted line per opcode -- every label this store carries is a HEADER-only definition at an instruction START (phase 47 " +
      "plan 47-04's branch-target labels) and no comment is in this store, so the mapping is still one-to-one",
  );

  // Computed from the table in this same test, never pinned. 35 against the
  // current table; a correction to `acmeExpressible` moves both sides together.
  const unexpressibleFromTable = OPCODES.filter((entry) => !entry.acmeExpressible).length;
  assert.equal(
    result.unexpressibleCount,
    unexpressibleFromTable,
    `every \`acmeExpressible: false\` entry the layout covered must be counted:\n  from OPCODES: ${unexpressibleFromTable}\n  reported: ${result.unexpressibleCount}`,
  );

  const wrongDirective: string[] = [];
  const missingBytes: string[] = [];
  const missingComment: string[] = [];

  for (let op = 0; op <= 0xff; op++) {
    const entry = OPCODES[op]!;
    const line = content[op]!;
    const where = `$${op.toString(16).padStart(2, "0")} (${entry.mnemonic}/${entry.mode}) at $${addressOf[op]!.toString(16)}`;
    const isByteDirective = /^\s*!byte\b/.test(line);

    if (!entry.acmeExpressible) {
      if (!isByteDirective) {
        wrongDirective.push(`${where}: acmeExpressible:false must go out as !byte, got: ${line}`);
        continue;
      }
      // Every one of the instruction's bytes, in the renderer's own spelling.
      const own = bytes.slice(addressOf[op]! - origin, addressOf[op]! - origin + entry.length).map(byteHex).join(", ");
      if (!line.includes(own)) missingBytes.push(`${where}: expected all ${entry.length} byte(s) as \`${own}\`, got: ${line}`);
      // The mnemonic and the note text, in the trailing comment.
      const comment = line.split("  ; ")[1] ?? "";
      if (!comment.includes(entry.mnemonic)) missingComment.push(`${where}: the trailing comment must name the mnemonic, got: ${line}`);
      if (!comment.includes(UNASSEMBLABLE_NOTE)) missingComment.push(`${where}: the trailing comment must carry the fixed note text, got: ${line}`);
      if (entry.illegal && !comment.includes(ILLEGAL_NOTE)) missingComment.push(`${where}: an illegal opcode's note must say so, got: ${line}`);
    } else if (isByteDirective) {
      wrongDirective.push(`${where}: acmeExpressible:true must render as a mnemonic line, got: ${line}`);
    }
  }

  assert.deepEqual(wrongDirective, [], `wrong directive for these opcodes:\n${wrongDirective.join("\n")}`);
  assert.deepEqual(missingBytes, [], `a \`!byte\` substitution must carry EVERY byte, or the following instruction lands at the wrong address:\n${missingBytes.join("\n")}`);
  assert.deepEqual(missingComment, [], `the mnemonic a human reader needs must move into the trailing comment:\n${missingComment.join("\n")}`);

  // No invented mnemonic anywhere on a `!byte` line: the DIRECTIVE half of
  // every such line is bytes and nothing else, so an unassemblable mnemonic
  // cannot have leaked out of the comment and into the assembler's input.
  const malformed = content.filter((line) => /^\s*!byte\b/.test(line)).filter((line) => !/^\s*!byte \$[0-9a-f]{2}(, \$[0-9a-f]{2})*\s*$/.test(line.split("  ; ")[0] ?? ""));
  assert.deepEqual(malformed, [], `a \`!byte\` line's directive half must be hex bytes only -- anything else is a mnemonic ACME would reject:\n${malformed.join("\n")}`);

  const verdict = verifyExport(result);
  assert.equal(
    verdict.outcome,
    "ok",
    "THIS is the control that caught fourteen wrong entries in disasm-opcodes.ts: an internally-verified opcode table still shipped " +
      `two \`jam\`/\`anc\` duplicate groups and four \`nop\` subgroups wrong, and only a real assembler found them.${context(result, verdict)}`,
  );
  assert.equal(verdict.byteDiff?.equal, true, `all 256 opcodes must reassemble byte-identically:${context(result, verdict)}`);
});

// ---------------------------------------------------------------------------
// The duplicate-label refusal, confirmed by real ACME.
//
// A REFINEMENT OF RESEARCH.md's ASSUMPTION A5, recorded here rather than left
// implicit. `anno_label.name` carries a `unique` DDL constraint
// (`anno-store.ts:266`) ON TOP OF `setLabel()`'s own guard, so the store cannot
// hold two rows with one name AT ALL and a store-level plant can never reach
// ACME. The external observation is therefore produced at the SOURCE-TEXT
// boundary, which is the only place the duplicate can exist.
//
// That is a refinement, not a departure from criterion 5: criterion 5 asks for
// the external oracle to CONFIRM the internal one, and it does -- the store
// refuses the duplicate by name, and real ACME independently refuses the same
// duplicate with its own words and its own exit status.
// ---------------------------------------------------------------------------

const STORE_PATH_ON_DISK = join(HERE, "anno-store.ts");

/** `setLabel()`'s own refusal wording, read out of the module source rather
 * than retyped from memory -- the `acme-gate.test.ts` technique. Retyping is
 * how a test ends up passing for the wrong reason: any throw would satisfy an
 * `assert.throws()` with no message predicate. */
const SET_LABEL_REFUSAL = "is already bound to address";

test("the store's duplicate-label refusal wording asserted below is really present in anno-store.ts (so this file cannot pass for the wrong reason)", () => {
  const src = readFileSync(STORE_PATH_ON_DISK, "utf8");
  assert.ok(
    src.includes(SET_LABEL_REFUSAL),
    `anno-store.ts no longer contains the refusal wording this file matches on (${JSON.stringify(SET_LABEL_REFUSAL)}) -- update both together, never only one`,
  );
});

test("INTERNAL REFUSAL: setLabel() refuses a name already bound to a DIFFERENT address, and does NOT refuse the same name at the same address", () => {
  const dir = freshDir("dup-store");
  const { storePath } = buildStore(dir, {
    origin: 0x0801,
    body: [...SHAPE_BODY],
    ranges: [{ start: 0x0801, endInclusive: 0x0806, dataType: "code" }],
    labels: [{ address: 0x0801, name: "entry" }],
  });

  const handle = openStore(storePath, { workspaceRoot: dir });
  try {
    assert.throws(
      () => setLabel(handle, { address: 0x0803, name: "entry", kind: "User" }),
      (e: unknown) => {
        assert.ok(e instanceof Error);
        assert.ok(e.message.includes(SET_LABEL_REFUSAL), `the store's OWN refusal must be what fired: ${e.message}`);
        assert.ok(e.message.includes("$0801"), `the refusal names the address the name is already bound to: ${e.message}`);
        assert.ok(e.message.includes("$0803"), `and the address it was asked to also name: ${e.message}`);
        return true;
      },
    );

    // THE PAIRED DIRECTION. A guard that refuses everything is indistinguishable
    // from one that works, so the accepting case is asserted in the same test.
    assert.doesNotThrow(
      () => setLabel(handle, { address: 0x0801, name: "entry", kind: "User" }),
      "rebinding the SAME name to the SAME address is a no-op, not a collision",
    );
  } finally {
    closeStore(handle);
  }
});

test("EXTERNAL ORACLE: real ACME refuses the same duplicate at the source-text boundary with `Symbol already defined.` and exit 1", { skip: SKIP_REASON }, () => {
  const { dir, storePath, imagePath } = shapeFixture("dup-acme");
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  // The paired direction FIRST: the un-duplicated source assembles and verifies,
  // so the red below is ONE line of difference and nothing else.
  const clean = verifyExport(result);
  assert.equal(clean.outcome, "ok", `the un-duplicated export must verify:${context(result, clean)}`);
  assert.equal(clean.byteDiff?.equal, true);

  // ONE documented mutation: the same symbol name defined a second time, at a
  // different address. The store cannot hold this state -- `anno_label.name` is
  // `unique` -- so the source text is the only place it can exist.
  const duplicated = result.source.replace("entry = $0801\n", "entry = $0801\nentry = $0900\n");
  assert.notEqual(duplicated, result.source, "the duplication must change the source");

  const run = assembleRaw(duplicated);
  assert.equal(run.status, 1, `real ACME must REFUSE a duplicate symbol:\n  stdout: ${run.stdout}\n  stderr: ${run.stderr}`);
  assert.equal(run.outputExists, false, "a refused assembly writes no output file");

  const diagnostics = parseAcmeDiagnostics(run.stderr);
  assert.ok(
    diagnostics.some((d) => d.severity === "Error" && d.message.includes("Symbol already defined.")),
    `ACME's OWN duplicate-symbol message, in its --msvc spelling, must be what refused it:\n  stderr: ${run.stderr}\n  parsed: ${JSON.stringify(diagnostics)}`,
  );
});

// ---------------------------------------------------------------------------
// BUILD-05 (phase 46 plan 01): the provenance carry.
//
// Proves the whole seam thinly, end to end, on ONE path: a synthetic
// `recovery/PROVENANCE.md` is built through `renderLedger()`'s own pure API
// (zero filesystem I/O for the SOURCE data -- the markdown is written to a
// temp file only because `readProvenanceLedger()` reads a path, exactly as
// the store reads a path), joined to the exporter's blocks by address, and
// its Verdict plus Confidence appear as visible comment text inside every
// emitted block -- with real ACME still reproducing the bytes.
// ---------------------------------------------------------------------------

/**
 * A store with THREE ranges, laid out so each one lands in its own emitted
 * block: `code` at $0801-$0806 (`SHAPE_BODY`), then two `byte` ranges at
 * $0807-$0808 and $0809-$080a. Built directly against `dir` (not through
 * `freshDir()` internally) so the ledger fixture below can be written
 * alongside it in the SAME directory.
 */
function ledgerCarryStore(dir: string): StoreFixture {
  return buildStore(dir, {
    origin: 0x0801,
    body: [...SHAPE_BODY, 0xaa, 0xbb, 0xcc, 0xdd],
    ranges: [
      { start: 0x0801, endInclusive: 0x0806, dataType: "code" },
      { start: 0x0807, endInclusive: 0x0808, dataType: "byte" },
      { start: 0x0809, endInclusive: 0x080a, dataType: "byte" },
    ],
  });
}

/**
 * The generated-tier rows fed to `renderLedger()`: five rows covering
 * exactly $0000-$FFFF with no gap or overlap (its own refusal precondition),
 * with the three MIDDLE rows aligned exactly onto `ledgerCarryStore()`'s
 * three blocks -- an `ORIGINAL`/`HIGH` row over the code block, an
 * `UNKNOWN`/`LOW` row over the first byte block, and a `CRACKER-PATCH` row
 * (confidence is `renderLedger()`'s own fixed compound string for that
 * verdict) over the second. The two OUTER rows are padding so the ledger, as
 * a whole, satisfies `renderLedger()`'s full-coverage precondition -- they
 * overlap no store range and this fixture makes no claim about them.
 */
const LEDGER_GENERATED_RANGES = [
  {
    start: 0x0000,
    end: 0x0800,
    kind: "unused",
    verdict: "ORIGINAL",
    agreeing_releases: 2,
    evidence: "padding before the annotated range, byte-identical across releases",
  },
  {
    start: 0x0801,
    end: 0x0806,
    kind: "game",
    verdict: "ORIGINAL",
    agreeing_releases: 3,
    evidence: "matches both independently-cracked releases byte for byte",
  },
  {
    start: 0x0807,
    end: 0x0808,
    kind: "game",
    verdict: "UNKNOWN",
    agreeing_releases: 0,
    reason: "insufficient evidence to classify -- treated as UNKNOWN rather than guessed",
  },
  {
    start: 0x0809,
    end: 0x080a,
    kind: "game",
    verdict: "CRACKER-PATCH",
    agreeing_releases: 0,
    evidence: "loader table entry rewritten by the cracker",
  },
  {
    start: 0x080b,
    end: 0xffff,
    kind: "unused",
    verdict: "ORIGINAL",
    agreeing_releases: 2,
    evidence: "padding after the annotated range, byte-identical across releases",
  },
];

/** Writes `LEDGER_GENERATED_RANGES` (or a caller-supplied override) through
 * `renderLedger()`'s own pure, filesystem-free API, then writes the result to
 * `dir/PROVENANCE.md` -- the one place this fixture touches a filesystem,
 * because `readProvenanceLedger()` reads a PATH. */
function writeLedgerFixture(dir: string, generatedRanges: readonly unknown[] = LEDGER_GENERATED_RANGES): string {
  const markdown: string = renderLedger({ generatedRanges, gapTolerance: 16, prose: "synthetic fixture, phase 46 plan 01" });
  const ledgerPath = join(dir, "PROVENANCE.md");
  writeFileSync(ledgerPath, markdown, "utf8");
  return ledgerPath;
}

/**
 * The text of the ONE block whose ACME origin is `startHex` (e.g. `"$0809"`),
 * from the block's own `* = ` line up to (not including) the next block's
 * `* = ` line, or the end of `source` for the last block. Lets a test assert
 * "this marker is INSIDE this specific block" rather than merely "this marker
 * is somewhere in the source".
 */
function blockSourceFor(source: string, startHex: string): string {
  const marker = `* = ${startHex}`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `block origin ${startHex} must appear in the source:\n${source}`);
  const next = source.indexOf("* = ", start + marker.length);
  return next === -1 ? source.slice(start) : source.slice(start, next);
}

test("PRECONDITION: the fixture ledger really carries a CRACKER-PATCH row overlapping the store's own third range (non-vacuity, anno-coverage.test.ts:918-923 shape)", () => {
  const range = { start: 0x0809, endInclusive: 0x080a };
  const hit = LEDGER_GENERATED_RANGES.find(
    (r) => r.verdict === "CRACKER-PATCH" && r.start <= range.endInclusive && r.end >= range.start,
  );
  assert.ok(
    hit,
    "the fixture must actually carry a CRACKER-PATCH row overlapping a real store range -- otherwise the assertions below measure an empty input, not a genuine carry",
  );
});

test("PROVENANCE CARRY Test 1: a ledger-mode export carries the ledger's CRACKER-PATCH verdict and confidence, verbatim, inside the block it overlaps", () => {
  const dir = freshDir("provenance-1");
  const { storePath, imagePath } = ledgerCarryStore(dir);
  const ledgerPath = writeLedgerFixture(dir);

  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir, ledgerPath });

  const patchBlock = blockSourceFor(result.source, "$0809");
  assert.match(patchBlock, /; PROVENANCE LEDGER: /, "the CRACKER-PATCH block must carry a provenance marker line");
  assert.match(patchBlock, /verdict=CRACKER-PATCH\b/, "the marker must name the CRACKER-PATCH verdict verbatim");
  assert.match(
    patchBlock,
    /confidence=HIGH \(patch\), MEDIUM-LOW \(what original there replaced\)/,
    "the marker must carry the CRACKER-PATCH confidence cell verbatim",
  );
});

test("PROVENANCE CARRY Test 2: EVERY block carries a provenance marker, not only the CRACKER-PATCH one", () => {
  const dir = freshDir("provenance-2");
  const { storePath, imagePath } = ledgerCarryStore(dir);
  const ledgerPath = writeLedgerFixture(dir);

  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir, ledgerPath });

  const markerCount = result.source.split("\n").filter((line) => line.includes("; PROVENANCE LEDGER: ")).length;
  assert.ok(
    markerCount >= result.blocks.length,
    `every emitted block must carry at least one provenance marker -- found ${markerCount} marker(s) across ${result.blocks.length} block(s)`,
  );
});

test("PROVENANCE CARRY Test 3: an ORIGINAL/HIGH row and an UNKNOWN/LOW row are BOTH annotated with their own two cells verbatim (A3's superset reading)", () => {
  const dir = freshDir("provenance-3");
  const { storePath, imagePath } = ledgerCarryStore(dir);
  const ledgerPath = writeLedgerFixture(dir);

  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir, ledgerPath });

  const originalBlock = blockSourceFor(result.source, "$0801");
  assert.match(originalBlock, /verdict=ORIGINAL\b/, "the code block's marker must name ORIGINAL verbatim");
  assert.match(originalBlock, /confidence=HIGH\b/, "the code block's marker must name HIGH confidence verbatim");

  const unknownBlock = blockSourceFor(result.source, "$0807");
  assert.match(unknownBlock, /verdict=UNKNOWN\b/, "the first byte block's marker must name UNKNOWN verbatim");
  assert.match(unknownBlock, /confidence=LOW\b/, "the first byte block's marker must name LOW confidence verbatim");
});

test("PROVENANCE CARRY Test 4: real ACME still reassembles the ledger-annotated export byte-identically", { skip: SKIP_REASON }, () => {
  const dir = freshDir("provenance-4");
  const { storePath, imagePath } = ledgerCarryStore(dir);
  const ledgerPath = writeLedgerFixture(dir);

  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir, ledgerPath });
  const verdict = verifyExport(result);
  assert.equal(verdict.outcome, "ok", `the ledger-annotated export must verify:${context(result, verdict)}`);
  assert.equal(verdict.byteDiff?.equal, true, `the ledger-annotated export must reassemble byte-identically:${context(result, verdict)}`);
});

test("PROVENANCE CARRY Test 5: omitting ledgerPath emits no PROVENANCE LEDGER text at all, and blocks.length is unchanged", () => {
  const dir = freshDir("provenance-5");
  const { storePath, imagePath } = ledgerCarryStore(dir);
  writeLedgerFixture(dir); // written but never passed -- proves omission is what matters, not absence of a ledger on disk

  const withLedger = exportAsm({ storePath, imagePath, workspaceRoot: dir, ledgerPath: join(dir, "PROVENANCE.md") });
  const withoutLedger = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  assert.ok(!withoutLedger.source.includes("PROVENANCE LEDGER"), "omitting ledgerPath must emit no PROVENANCE LEDGER text at all");
  assert.equal(
    withoutLedger.blocks.length,
    withLedger.blocks.length,
    "the ledger changes comment text and nothing else -- block count must be identical either way",
  );
});

test("PROVENANCE CARRY Test 6: a block the ledger leaves uncovered is refused BY NAME, never emitted unannotated or with an invented verdict", () => {
  const dir = freshDir("provenance-6");
  const { storePath, imagePath } = ledgerCarryStore(dir);

  // A ledger that is otherwise well-formed but has had the UNKNOWN row over
  // the FIRST byte block ($0807-$0808) deleted after rendering -- something
  // `renderLedger()` itself would never produce (it refuses unless the
  // generated tier covers exactly $0000-$FFFF with no gap). Plan 46-02 gave
  // `readProvenanceLedger()` the matching accept-time coverage assertion, so
  // THIS FILE NOW REFUSES ONE LAYER EARLIER than it did when this test was
  // written: the reader itself throws the "does not cover $0000..$FFFF"
  // refusal before `exportAsm()`'s own per-block "no row overlaps this
  // block" refusal ever gets a chance to run. The two assertions below still
  // hold at either layer -- the path is named and no row's own text leaks --
  // which is the reason this test needed no code change, only this comment,
  // when plan 46-02 landed. See `anno-provenance-ledger.test.ts` for the
  // reader-level tests of that coverage assertion directly.
  const fullMarkdown: string = renderLedger({
    generatedRanges: LEDGER_GENERATED_RANGES,
    gapTolerance: 16,
    prose: "synthetic fixture, phase 46 plan 01",
  });
  const gappedMarkdown = fullMarkdown
    .split("\n")
    .filter((line) => !line.startsWith("| $0807 |"))
    .join("\n");
  const ledgerPath = join(dir, "PROVENANCE-gapped.md");
  writeFileSync(ledgerPath, gappedMarkdown, "utf8");

  assert.throws(
    () => exportAsm({ storePath, imagePath, workspaceRoot: dir, ledgerPath }),
    (e: unknown) => {
      assert.ok(e instanceof Error);
      assert.ok(e.message.includes(ledgerPath), `the refusal must name the ledger path: ${e.message}`);
      assert.ok(
        !e.message.includes("insufficient evidence to classify"),
        `the refusal must never quote a ledger row's own Evidence/Reason text: ${e.message}`,
      );
      assert.ok(
        !e.message.includes("loader table entry rewritten by the cracker"),
        `the refusal must never quote ANY fixture row's Evidence/Reason text, not only the uncovered block's own: ${e.message}`,
      );
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// Phase 46 plan 02: BUILD-05's three edge classes -- adjacency, empty, and
// ordering -- pinned end to end through the real `exportAsm()`, extending
// this file's own ledger section rather than starting a new one. The
// unit-level `provenanceForRange()` cases already live in
// `anno-provenance-ledger.test.ts`; every test below is named for the class
// it belongs to so a verifier reading `node --test` output can map a result
// to a criterion.
// ---------------------------------------------------------------------------

/** Invokes `fn`, asserts it throws, and returns the thrown error's message --
 * the shape every "compare two refusal messages" test below needs, rather
 * than repeating an `assert.throws()` predicate closure just to smuggle the
 * message out of it. */
function captureThrowMessage(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof Error, `expected an Error, got: ${String(e)}`);
    return (e as Error).message;
  }
  assert.fail("expected the function to throw, but it returned normally");
}

// ---------------------------------------------------------------------------
// adjacency
// ---------------------------------------------------------------------------

/**
 * A store with TWO one-byte "byte" ranges, 16 bytes apart: `$1000` (the
 * "touching" edge below) and `$1010` (the "one-byte overlap" edge below).
 * One narrow image proves both edges without two separate fixtures --
 * `exportAsm()` pads any uncovered image byte between declared ranges with
 * `$00` (this file's own header states the precedent), so the 15 bytes
 * between the two ranges need no range of their own.
 */
function adjacencyStore(dir: string): StoreFixture {
  return buildStore(dir, {
    origin: 0x1000,
    body: new Array(0x11).fill(0xaa), // $1000..$1010 inclusive, 17 bytes; content is irrelevant for "byte" ranges
    ranges: [
      { start: 0x1000, endInclusive: 0x1000, dataType: "byte" },
      { start: 0x1010, endInclusive: 0x1010, dataType: "byte" },
    ],
  });
}

/**
 * Four rows tiling $0000-$FFFF exactly, cut so that:
 *   - row A ($0000-$0FFF) ENDS exactly one below the $1000 block's start --
 *     touching, not overlapping (bullet 1's negative case).
 *   - row B ($1000-$100F) covers the $1000 block AND itself ends exactly one
 *     below the $1010 block's start -- the SAME row is both the $1000
 *     block's covering row and the $1010 block's touching-from-below row.
 *   - row C ($1010-$1010) covers ONLY the $1010 block, by exactly its one
 *     byte -- since the block IS one byte wide, "overlaps by exactly one
 *     byte" and "is the block's sole covering row" are the same fact here
 *     (bullet 2's positive case).
 *   - row D ($1011-$FFFF) STARTS exactly one above the $1010 block's end --
 *     touching from the other side, contributing nothing to either block.
 * Each row's Evidence names itself (`"row A:"` etc.) so a test can assert
 * WHICH row's marker appears in a block, not merely how many.
 */
const ADJACENCY_LEDGER_RANGES = [
  {
    start: 0x0000,
    end: 0x0fff,
    kind: "unused",
    verdict: "ORIGINAL",
    agreeing_releases: 2,
    evidence: "row A: ends one below the $1000 block -- touching, not overlapping",
  },
  {
    start: 0x1000,
    end: 0x100f,
    kind: "game",
    verdict: "ORIGINAL",
    agreeing_releases: 3,
    evidence: "row B: covers the $1000 block; ends one below the $1010 block",
  },
  {
    start: 0x1010,
    end: 0x1010,
    kind: "game",
    verdict: "CRACKER-PATCH",
    agreeing_releases: 0,
    evidence: "row C: covers the $1010 block by exactly its one byte",
  },
  {
    start: 0x1011,
    end: 0xffff,
    kind: "unused",
    verdict: "ORIGINAL",
    agreeing_releases: 2,
    evidence: "row D: starts one above the $1010 block -- touching, not overlapping",
  },
];

test("adjacency: a ledger row ending exactly one below a store range's start contributes ZERO PROVENANCE LEDGER lines to that block", () => {
  const dir = freshDir("adjacency-touching");
  const { storePath, imagePath } = adjacencyStore(dir);
  const ledgerPath = writeLedgerFixture(dir, ADJACENCY_LEDGER_RANGES);

  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir, ledgerPath });

  const block = blockSourceFor(result.source, "$1000");
  const markerLines = block.split("\n").filter((line) => line.includes("; PROVENANCE LEDGER: "));
  assert.equal(markerLines.length, 1, `the $1000 block must carry exactly one marker (from covering row B), not from touching row A:\n${block}`);
  assert.ok(markerLines[0]!.includes("row B:"), `the one marker must be row B's own text: ${markerLines[0]}`);
  assert.ok(!block.includes("row A:"), `row A (the touching row) must contribute ZERO lines to the $1000 block:\n${block}`);
});

test("adjacency: a ledger row overlapping by exactly one byte contributes exactly ONE PROVENANCE LEDGER line -- a one-byte overlap is an overlap", () => {
  const dir = freshDir("adjacency-overlap");
  const { storePath, imagePath } = adjacencyStore(dir);
  const ledgerPath = writeLedgerFixture(dir, ADJACENCY_LEDGER_RANGES);

  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir, ledgerPath });

  const block = blockSourceFor(result.source, "$1010");
  const markerLines = block.split("\n").filter((line) => line.includes("; PROVENANCE LEDGER: "));
  assert.equal(markerLines.length, 1, `the one-byte-wide $1010 block must carry exactly one marker, from row C:\n${block}`);
  assert.ok(markerLines[0]!.includes("row C:"), `the one marker must be row C's own text: ${markerLines[0]}`);
  assert.ok(
    !block.includes("row B:") && !block.includes("row D:"),
    `the rows touching from either side must contribute ZERO lines to the $1010 block:\n${block}`,
  );
});

test("adjacency: a store range spanning a ledger row boundary is overlapped by exactly two rows, emitted in ascending row-start order with one ambiguity line naming the count 2", () => {
  const dir = freshDir("adjacency-ambiguity");
  const { storePath, imagePath } = buildStore(dir, {
    origin: 0x2000,
    body: new Array(0x100).fill(0xaa), // $2000..$20ff, 256 bytes, "byte" content irrelevant
    ranges: [{ start: 0x2000, endInclusive: 0x20ff, dataType: "byte" }],
  });
  // The ledger's own row boundary falls INSIDE the store block, at $2080 --
  // row one covers the block's first half, row two covers its second half,
  // so BOTH overlap the one $2000..$20ff block.
  const ambiguityRanges = [
    { start: 0x0000, end: 0x207f, kind: "game", verdict: "ORIGINAL", agreeing_releases: 2, evidence: "first half: covers $2000..$207f of the block" },
    { start: 0x2080, end: 0xffff, kind: "game", verdict: "UNKNOWN", agreeing_releases: 0, reason: "second half: covers $2080..$20ff of the block" },
  ];
  const ledgerPath = writeLedgerFixture(dir, ambiguityRanges);

  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir, ledgerPath });

  const block = blockSourceFor(result.source, "$2000");
  const markerLines = block.split("\n").filter((line) => line.includes("; PROVENANCE LEDGER: "));
  const ambiguityLines = block.split("\n").filter((line) => line.includes("; PROVENANCE LEDGER AMBIGUITY: "));
  assert.equal(markerLines.length, 2, `exactly two rows overlap the block -- neither dropped, neither chosen:\n${block}`);
  assert.ok(markerLines[0]!.includes("first half"), `the first marker (ascending row-start order) must be the first-half row: ${markerLines[0]}`);
  assert.ok(markerLines[1]!.includes("second half"), `the second marker must be the second-half row: ${markerLines[1]}`);
  assert.equal(ambiguityLines.length, 1, `exactly one ambiguity line, never one per overlapping row:\n${block}`);
  assert.match(ambiguityLines[0]!, /\b2\b/, `the ambiguity line's own text must name the count 2: ${ambiguityLines[0]}`);
});

// ---------------------------------------------------------------------------
// empty
// ---------------------------------------------------------------------------

test("empty: omitting ledgerPath over a multi-range store emits zero PROVENANCE LEDGER text and succeeds", () => {
  const dir = freshDir("empty-omitted");
  const { storePath, imagePath } = ledgerCarryStore(dir);

  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  assert.ok(!result.source.includes("PROVENANCE LEDGER"), "omitting ledgerPath must emit no PROVENANCE LEDGER text at all");
  assert.ok(result.blocks.length > 0, "the export must still succeed and emit blocks");
});

test("empty: a ledger with the header and ZERO data rows throws the named zero-rows refusal, distinguishable from the absent-file refusal", () => {
  const dir = freshDir("empty-zero-rows");
  const { storePath, imagePath } = ledgerCarryStore(dir);

  const fullMarkdown: string = renderLedger({
    generatedRanges: LEDGER_GENERATED_RANGES,
    gapTolerance: 16,
    prose: "phase 46 plan 02 zero-rows fixture",
  });
  const zeroRowsMarkdown = fullMarkdown
    .split("\n")
    .filter((line) => !line.startsWith("| $"))
    .join("\n");
  assert.notEqual(zeroRowsMarkdown, fullMarkdown, "the row-stripping mutation must actually change the text");
  const zeroRowsPath = join(dir, "PROVENANCE-zero-rows.md");
  writeFileSync(zeroRowsPath, zeroRowsMarkdown, "utf8");
  const absentPath = join(dir, "PROVENANCE-never-written.md"); // never written

  const zeroRowsMessage = captureThrowMessage(() => exportAsm({ storePath, imagePath, workspaceRoot: dir, ledgerPath: zeroRowsPath }));
  const absentMessage = captureThrowMessage(() => exportAsm({ storePath, imagePath, workspaceRoot: dir, ledgerPath: absentPath }));

  assert.notEqual(zeroRowsMessage, absentMessage, '"the table parsed to no rows" must not read the same as "the file does not exist"');
  assert.ok(
    zeroRowsMessage.includes("zero data rows") && !absentMessage.includes("zero data rows"),
    `"zero data rows" must be present in the zero-rows message and absent from the absent-file message:\nzero-rows: ${zeroRowsMessage}\nabsent: ${absentMessage}`,
  );
  assert.ok(
    absentMessage.includes("could not read") && !zeroRowsMessage.includes("could not read"),
    `"could not read" must be present in the absent-file message and absent from the zero-rows message:\nzero-rows: ${zeroRowsMessage}\nabsent: ${absentMessage}`,
  );
});

test("empty: a store with zero ranges still raises the pre-existing no-ranges refusal, unchanged, whether or not ledgerPath was supplied", () => {
  const dir = freshDir("empty-zero-ranges");
  const imagePath = join(dir, "game.prg");
  writeFileSync(imagePath, Buffer.from([0x01, 0x08, 0x00])); // load address plus the minimum one payload byte a .prg needs
  const storePath = join(dir, "anno.sqlite");
  const handle = openStore(storePath, { workspaceRoot: dir });
  closeStore(handle); // zero ranges written -- the store exists but is empty

  // Never written: if the ledger option moved the zero-ranges boundary, this
  // path would have to be read, and reading it would throw ENOENT instead.
  const neverReadLedgerPath = join(dir, "PROVENANCE-never-read.md");

  const withoutLedger = captureThrowMessage(() => exportAsm({ storePath, imagePath, workspaceRoot: dir }));
  const withLedger = captureThrowMessage(() => exportAsm({ storePath, imagePath, workspaceRoot: dir, ledgerPath: neverReadLedgerPath }));

  assert.equal(withoutLedger, withLedger, "the ledger option must not move the zero-ranges boundary");
  assert.match(withoutLedger, /holds no ranges/, `must be the pre-existing no-ranges refusal, unchanged: ${withoutLedger}`);
});

test("empty: a single-range store against a single-row ledger tiling all of $0000..$FFFF emits exactly one block carrying exactly one PROVENANCE LEDGER line", () => {
  const dir = freshDir("empty-single-row");
  const { storePath, imagePath } = buildStore(dir, {
    origin: 0x0801,
    body: [...SHAPE_BODY],
    ranges: [{ start: 0x0801, endInclusive: 0x0806, dataType: "code" }],
  });
  const singleRowRanges = [
    { start: 0x0000, end: 0xffff, kind: "unused", verdict: "ORIGINAL", agreeing_releases: 2, evidence: "one row tiling everything" },
  ];
  const ledgerPath = writeLedgerFixture(dir, singleRowRanges);

  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir, ledgerPath });

  assert.equal(result.blocks.length, 1, "a single-range store emits exactly one block");
  const markerCount = result.source.split("\n").filter((line) => line.includes("; PROVENANCE LEDGER: ")).length;
  assert.equal(markerCount, 1, "the one block must carry exactly one marker from the single tiling row");
});

// ---------------------------------------------------------------------------
// ordering
// ---------------------------------------------------------------------------

/**
 * A store built from TWO deliberately OVERLAPPING `setDataType()` writes, in
 * an order that forces `retype()` to carve: writing "code" over the WHOLE
 * $0801..$0810 span first, then "byte" over the MIDDLE $0805..$0808 subrange,
 * splits the first write into a head ($0801..$0804) and a tail
 * ($0809..$0810) remainder plus the new middle range -- three disjoint rows
 * from two spans written, per `retype()`'s own measured behaviour
 * (`anno-store.ts:2160-2245`, read in this plan's `<read_first>`).
 */
function orderingStore(dir: string): StoreFixture {
  const imagePath = join(dir, "game.prg");
  writeFileSync(imagePath, Buffer.from([0x01, 0x08, ...new Array(0x10).fill(0xea)])); // $0801..$0810, all NOP -- decodes cleanly as "code"
  const storePath = join(dir, "anno.sqlite");
  const handle = openStore(storePath, { workspaceRoot: dir });
  try {
    setDataType(handle, { start: 0x0801, endInclusive: 0x0810, dataType: "code" });
    setDataType(handle, { start: 0x0805, endInclusive: 0x0808, dataType: "byte" });
  } finally {
    closeStore(handle);
  }
  return { dir, storePath, imagePath };
}

test("ordering: emitted block starts are strictly ascending with no two equal, over a store retype() carved from overlapping writes", () => {
  const dir = freshDir("ordering-carve");
  const { storePath, imagePath } = orderingStore(dir);

  const handle = openStore(storePath, { workspaceRoot: dir });
  let finalRanges;
  try {
    finalRanges = listRanges(handle);
  } finally {
    closeStore(handle);
  }

  // NON-VACUITY, asserted BEFORE the export: the store must really hold more
  // than one range, and the carve must really have produced a DIFFERENT row
  // set than the two spans written -- neither of which (0801..0810,
  // 0805..0808) survives intact -- or the ascent asserted below is about an
  // input that never exercised retype()'s carve path at all.
  assert.equal(finalRanges.length, 3, `retype() must have carved three disjoint rows from the two overlapping spans written, got ${finalRanges.length}`);
  const finalStarts = finalRanges.map((r) => r.start).sort((a, b) => a - b);
  assert.deepEqual(finalStarts, [0x0801, 0x0805, 0x0809], "the carved row set must differ from both spans originally written");

  const singleRowRanges = [
    { start: 0x0000, end: 0xffff, kind: "unused", verdict: "ORIGINAL", agreeing_releases: 2, evidence: "ordering test: one row tiling everything" },
  ];
  const ledgerPath = writeLedgerFixture(dir, singleRowRanges);

  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir, ledgerPath });

  assert.equal(result.blocks.length, finalRanges.length, "result.blocks.length must equal the row count listRanges() returns");
  const blockStarts = result.blocks.map((b) => b.start);
  for (let i = 1; i < blockStarts.length; i++) {
    assert.ok(
      blockStarts[i]! > blockStarts[i - 1]!,
      `block starts must be strictly ascending with no two equal -- retype() guarantees disjoint rows, so the exporter's ` +
        `\`a.start - b.start\` comparator needs no tie-break: ${blockStarts.join(", ")}`,
    );
  }
});

test("ordering: running the same ledger-mode export twice produces byte-identical result.source", () => {
  const dir = freshDir("ordering-repeat");
  const { storePath, imagePath } = orderingStore(dir);
  const singleRowRanges = [
    { start: 0x0000, end: 0xffff, kind: "unused", verdict: "ORIGINAL", agreeing_releases: 2, evidence: "ordering test: one row tiling everything" },
  ];
  const ledgerPath = writeLedgerFixture(dir, singleRowRanges);

  const first = exportAsm({ storePath, imagePath, workspaceRoot: dir, ledgerPath });
  const second = exportAsm({ storePath, imagePath, workspaceRoot: dir, ledgerPath });

  assert.equal(second.source, first.source, "a stable sort over a totally ordered key must be reproducible across two identical runs");
});

// ---------------------------------------------------------------------------
// BUILD-07 (phase 46 plan 05): the exclusion marker -- "exclude" means
// "emit, and say so", never "omit".
//
// Every test below proves criterion 2's own words: a recorded exclusion's
// "identity and extent [are] readable in the output, marked as something the
// user asked for -- never as a silent hole. Reading the export back recovers
// what was excluded and why." The load-bearing assertions (Test 2, Test 3)
// compare BYTE ARRAYS and block lists directly, never source text, because
// the wrong implementation -- "exclude" reads, in isolation, like "do not
// emit" -- is the obvious one, and text alone cannot tell the two apart.
// ---------------------------------------------------------------------------

/**
 * A store with THREE ranges, each landing in its own emitted block: `code` at
 * $0801-$0806 (`SHAPE_BODY`), then two `byte` ranges at $0807-$0808 and
 * $0809-$080a -- the same shape `ledgerCarryStore()` uses above, kept as a
 * SEPARATE builder because this section's fixtures are about exclusions, not
 * the provenance ledger, even though the two never interact.
 */
function exclusionStore(dir: string, exclusions: readonly { start: number; endInclusive: number; reason: string }[] = []): StoreFixture {
  return buildStore(dir, {
    origin: 0x0801,
    body: [...SHAPE_BODY, 0xaa, 0xbb, 0xcc, 0xdd],
    ranges: [
      { start: 0x0801, endInclusive: 0x0806, dataType: "code" },
      { start: 0x0807, endInclusive: 0x0808, dataType: "byte" },
      { start: 0x0809, endInclusive: 0x080a, dataType: "byte" },
    ],
    exclusions,
  });
}

test("EXCLUSION Test 1: a recorded exclusion over the middle range's full extent emits exactly one marker naming its extent and reason verbatim", () => {
  const dir = freshDir("exclusion-1");
  const reason = "cracked loader stub, not original game code";
  const { storePath, imagePath } = exclusionStore(dir, [{ start: 0x0807, endInclusive: 0x0808, reason }]);

  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  const markerLines = result.source.split("\n").filter((line) => line.startsWith(EXCLUSION_MARKER_PREFIX));
  assert.equal(markerLines.length, 1, `exactly one marker line expected, source:\n${result.source}`);
  assert.equal(markerLines[0], `${EXCLUSION_MARKER_PREFIX}$0807..$0808 ${reason}`);
});

test("EXCLUSION Test 2 (LOAD-BEARING): result.expectedBytes is byte-identical between an export with a recorded exclusion and the same store exported with none", () => {
  const dirWith = freshDir("exclusion-2-with");
  const dirWithout = freshDir("exclusion-2-without");
  const reason = "cracked loader stub, not original game code";
  const withExclusion = exclusionStore(dirWith, [{ start: 0x0807, endInclusive: 0x0808, reason }]);
  const withoutExclusion = exclusionStore(dirWithout, []);

  const resultWith = exportAsm({ storePath: withExclusion.storePath, imagePath: withExclusion.imagePath, workspaceRoot: dirWith });
  const resultWithout = exportAsm({ storePath: withoutExclusion.storePath, imagePath: withoutExclusion.imagePath, workspaceRoot: dirWithout });

  assert.deepEqual(
    [...resultWith.expectedBytes],
    [...resultWithout.expectedBytes],
    "an exclusion adds comment lines and changes NOTHING else -- expectedBytes must be byte-identical, not merely same-length",
  );
});

test("EXCLUSION Test 3: result.blocks.length and every block's start/endExclusive are identical between an export with a recorded exclusion and one with none", () => {
  const dirWith = freshDir("exclusion-3-with");
  const dirWithout = freshDir("exclusion-3-without");
  const reason = "cracked loader stub, not original game code";
  const withExclusion = exclusionStore(dirWith, [{ start: 0x0807, endInclusive: 0x0808, reason }]);
  const withoutExclusion = exclusionStore(dirWithout, []);

  const resultWith = exportAsm({ storePath: withExclusion.storePath, imagePath: withExclusion.imagePath, workspaceRoot: dirWith });
  const resultWithout = exportAsm({ storePath: withoutExclusion.storePath, imagePath: withoutExclusion.imagePath, workspaceRoot: dirWithout });

  assert.equal(resultWith.blocks.length, resultWithout.blocks.length, "the block COUNT must be identical");
  assert.deepEqual(
    resultWith.blocks.map((b) => ({ start: b.start, endExclusive: b.endExclusive })),
    resultWithout.blocks.map((b) => ({ start: b.start, endExclusive: b.endExclusive })),
    "every block's start/endExclusive must be identical -- an exclusion never moves a block boundary",
  );
});

test("EXCLUSION Test 4: the excluded block's emitted content lines are the same as the no-exclusion export's for that block, modulo the marker line", () => {
  const dirWith = freshDir("exclusion-4-with");
  const dirWithout = freshDir("exclusion-4-without");
  const reason = "cracked loader stub, not original game code";
  const withExclusion = exclusionStore(dirWith, [{ start: 0x0807, endInclusive: 0x0808, reason }]);
  const withoutExclusion = exclusionStore(dirWithout, []);

  const resultWith = exportAsm({ storePath: withExclusion.storePath, imagePath: withExclusion.imagePath, workspaceRoot: dirWith });
  const resultWithout = exportAsm({ storePath: withoutExclusion.storePath, imagePath: withoutExclusion.imagePath, workspaceRoot: dirWithout });

  const withBlock = blockSourceFor(resultWith.source, "$0807");
  const withoutBlock = blockSourceFor(resultWithout.source, "$0807");
  const withBlockNoMarker = withBlock
    .split("\n")
    .filter((line) => !line.startsWith(EXCLUSION_MARKER_PREFIX))
    .join("\n");

  assert.equal(
    withBlockNoMarker,
    withoutBlock,
    "stripping only the marker line must leave the block's origin, bytes and end assertion identical to the no-exclusion export -- a shortened slice would fail this",
  );
});

test("EXCLUSION Test 5: an exclusion covering only PART of a store range still emits that range's full block, with the marker naming the exclusion's own narrower extent", () => {
  const dir = freshDir("exclusion-5");
  const reason = "only the first byte of this range was cracker-patched";
  // The third range is $0809..$080a (bytes 0xcc, 0xdd); the exclusion covers
  // ONLY its first byte, $0809.
  const { storePath, imagePath } = exclusionStore(dir, [{ start: 0x0809, endInclusive: 0x0809, reason }]);

  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  const markerLines = result.source.split("\n").filter((line) => line.startsWith(EXCLUSION_MARKER_PREFIX));
  assert.equal(markerLines.length, 1);
  assert.equal(
    markerLines[0],
    `${EXCLUSION_MARKER_PREFIX}$0809..$0809 ${reason}`,
    "the marker must name the EXCLUSION's own extent ($0809..$0809), never the containing block's ($0809..$080a)",
  );

  const block = blockSourceFor(result.source, "$0809");
  assert.match(block, /\$cc, \$dd/, "the block must still carry BOTH bytes of its full extent, not only the un-excluded one");
});

test("EXCLUSION Test 6: result.excludedRangeCount counts only exclusion records overlapping an emitted block, not every record in the store", () => {
  const dir = freshDir("exclusion-6");
  const { storePath, imagePath } = exclusionStore(dir, [
    { start: 0x0807, endInclusive: 0x0808, reason: "overlaps the middle range" },
    { start: 0x0900, endInclusive: 0x0901, reason: "outside every annotated range -- never emitted, never counted" },
  ]);

  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  assert.equal(result.excludedRangeCount, 1, "only the one record overlapping an emitted block may be counted, even though the store holds two");
});

test("EXCLUSION Test 7: a store whose exclusion reason was edited on disk to contain a line break is refused BY NAME at the export boundary", () => {
  const dir = freshDir("exclusion-7");
  const { storePath, imagePath } = exclusionStore(dir, [{ start: 0x0807, endInclusive: 0x0808, reason: "clean at write time" }]);

  // Rewrite the row behind the store's own write verb -- the ONE place this
  // file goes around a public write verb, to reproduce a state the public
  // verbs (addExcludedRange's own assertCommentText() call) can no longer
  // create, exactly as the sibling comment-corruption test above does.
  const handle = openStore(storePath, { workspaceRoot: dir });
  try {
    handle.db.prepare("update anno_excluded_range set reason = ?").run("raster split\nlda #$00");
  } finally {
    closeStore(handle);
  }

  assert.throws(
    () => exportAsm({ storePath, imagePath, workspaceRoot: dir }),
    (e: unknown) => {
      assert.ok(e instanceof Error);
      assert.match(e.message, /^exportAsm: /, "every refusal from this module is prefixed `exportAsm:`");
      assert.equal(e.message.includes("raster split"), false, "the refusal must NOT quote the stored reason back (CR-03)");
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// EXCLUSION READBACK -- criterion 2's own words, made into a test: "Reading
// the export back recovers what was excluded and why."
// ---------------------------------------------------------------------------

/** One exclusion marker as recovered from `result.source` alone. */
interface ParsedExclusionMarker {
  start: string;
  endInclusive: string;
  reason: string;
}

/**
 * Criterion 2's own words, made into code. Takes ONLY the source string --
 * no store handle, no second export, nothing but the text -- because a
 * parser that also consulted the store would be proving the STORE
 * remembers, not that the ARTEFACT carries the fact. Anchored on the
 * imported `EXCLUSION_MARKER_PREFIX`, never a retyped literal, so a spelling
 * change in the real constant reds this helper's own tests instead of
 * silently un-anchoring it.
 */
function readBackExclusions(source: string): ParsedExclusionMarker[] {
  const out: ParsedExclusionMarker[] = [];
  for (const line of source.split("\n")) {
    if (!line.startsWith(EXCLUSION_MARKER_PREFIX)) continue;
    const rest = line.slice(EXCLUSION_MARKER_PREFIX.length);
    const match = /^(\$[0-9a-f]{2,4})\.\.(\$[0-9a-f]{2,4}) (.*)$/.exec(rest);
    assert.ok(match, `a line starting with the exclusion marker prefix must match the marker's own shape: ${JSON.stringify(line)}`);
    out.push({ start: match![1]!, endInclusive: match![2]!, reason: match![3]! });
  }
  return out;
}

test("EXCLUSION READBACK: parsing result.source alone recovers every excluded extent and its reason (criterion 2)", () => {
  const dir = freshDir("exclusion-readback");
  const reasonA = "cracked loader stub, not original game code";
  const reasonB = "trainer patch inserted by this release's cracker";
  const { storePath, imagePath } = buildStore(dir, {
    origin: 0x0801,
    body: [...SHAPE_BODY, 0xaa, 0xbb, 0xcc, 0xdd, 0x11, 0x22],
    ranges: [
      { start: 0x0801, endInclusive: 0x0806, dataType: "code" },
      { start: 0x0807, endInclusive: 0x0808, dataType: "byte" },
      { start: 0x0809, endInclusive: 0x080a, dataType: "byte" },
      { start: 0x080b, endInclusive: 0x080c, dataType: "byte" },
    ],
    exclusions: [
      { start: 0x0807, endInclusive: 0x0808, reason: reasonA },
      { start: 0x080b, endInclusive: 0x080c, reason: reasonB },
    ],
  });

  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  // NON-VACUITY FIRST: a parser that silently matched nothing cannot pass by
  // returning two empty results.
  const markerLineCount = result.source.split("\n").filter((line) => line.startsWith(EXCLUSION_MARKER_PREFIX)).length;
  assert.equal(markerLineCount, 2, `the source must really carry two marker lines before parsing:\n${result.source}`);

  const recovered = readBackExclusions(result.source);
  assert.deepEqual(
    new Set(recovered.map((r) => `${r.start}..${r.endInclusive}=${r.reason}`)),
    new Set([`$0807..$0808=${reasonA}`, `$080b..$080c=${reasonB}`]),
    "the recovered set must equal what was recorded, with no access to the store",
  );
});

test("EXCLUSION READBACK: a one-character mutation of the marker spelling yields zero recoveries", () => {
  const dir = freshDir("exclusion-readback-mutated");
  const { storePath, imagePath } = exclusionStore(dir, [{ start: 0x0807, endInclusive: 0x0808, reason: "cracked loader stub" }]);
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  const mutatedPrefix = EXCLUSION_MARKER_PREFIX.replace("REQUEST", "REQUOST"); // one character changed: E -> O
  assert.notEqual(mutatedPrefix, EXCLUSION_MARKER_PREFIX, "the mutation constant itself must actually differ");
  const mutatedSource = result.source.split(EXCLUSION_MARKER_PREFIX).join(mutatedPrefix);
  assert.notEqual(mutatedSource, result.source, "the mutation must actually have changed the source text");

  assert.equal(readBackExclusions(mutatedSource).length, 0, "a source whose marker spelling drifted by one character must yield ZERO recoveries");
});

// ---------------------------------------------------------------------------
// exclusion empty
// ---------------------------------------------------------------------------

test("exclusion empty: a store with no exclusion records emits no exclusion marker", () => {
  const dir = freshDir("exclusion-empty-none");
  const { storePath, imagePath } = exclusionStore(dir, []);

  const baseline = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  const again = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  assert.equal(baseline.excludedRangeCount, 0);
  assert.ok(
    !baseline.source.split("\n").some((line) => line.startsWith(EXCLUSION_MARKER_PREFIX)),
    "zero exclusion records must emit zero marker lines",
  );
  assert.equal(again.source, baseline.source, "exporting a store with no exclusion records twice must be byte-identical");
});

test("exclusion empty: a one-byte exclusion is recorded and emitted", () => {
  const dir = freshDir("exclusion-empty-oneByte");
  const withoutDir = freshDir("exclusion-empty-oneByte-without");
  const reason = "single byte cracker patch";
  const { storePath, imagePath } = exclusionStore(dir, [{ start: 0x0807, endInclusive: 0x0807, reason }]);
  const withoutExclusion = exclusionStore(withoutDir, []);

  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  const plain = exportAsm({ storePath: withoutExclusion.storePath, imagePath: withoutExclusion.imagePath, workspaceRoot: withoutDir });

  const markerLines = result.source.split("\n").filter((line) => line.startsWith(EXCLUSION_MARKER_PREFIX));
  assert.equal(markerLines.length, 1);
  assert.equal(markerLines[0], `${EXCLUSION_MARKER_PREFIX}$0807..$0807 ${reason}`);
  assert.deepEqual([...result.expectedBytes], [...plain.expectedBytes], "expectedBytes must be unchanged by a one-byte exclusion");
});

test("exclusion empty: a store with zero ranges still raises the pre-existing no-ranges refusal", () => {
  const dir = freshDir("exclusion-empty-zero-ranges");
  const imagePath = join(dir, "game.prg");
  writeFileSync(imagePath, Buffer.from([0x01, 0x08, 0x00])); // load address plus the minimum one payload byte a .prg needs
  const storePath = join(dir, "anno.sqlite");
  const handle = openStore(storePath, { workspaceRoot: dir });
  try {
    addExcludedRange(handle, { start: 0x0900, endInclusive: 0x0901, reason: "recorded even though there are no ranges to export" });
  } finally {
    closeStore(handle);
  }

  assert.throws(
    () => exportAsm({ storePath, imagePath, workspaceRoot: dir }),
    /holds no ranges/,
    "the exclusion machinery must not move the pre-existing zero-ranges boundary",
  );
});

// ---------------------------------------------------------------------------
// exclusion ordering (backstop -- see EXCLUSION_MARKER_PREFIX's own overlap
// comment in anno-export-asm.ts for what is contractual and what is a
// recorded choice)
// ---------------------------------------------------------------------------

test("exclusion ordering: two disjoint exclusions inside one block emit markers in ascending start order", () => {
  const dir = freshDir("exclusion-ordering-ascending");
  const { storePath, imagePath } = buildStore(dir, {
    origin: 0x1000,
    body: new Array(0x100).fill(0xea), // $1000..$10ff, all NOP -- decodes cleanly as "code"
    ranges: [{ start: 0x1000, endInclusive: 0x10ff, dataType: "code" }],
    exclusions: [
      // Recorded in DESCENDING order deliberately, so an ascending-start
      // assertion on the emitted markers is not merely reflecting insertion
      // order.
      { start: 0x1030, endInclusive: 0x103f, reason: "second exclusion, recorded first" },
      { start: 0x1010, endInclusive: 0x101f, reason: "first exclusion, recorded second" },
    ],
  });

  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  const block = blockSourceFor(result.source, "$1000");
  const markerLines = block.split("\n").filter((line) => line.startsWith(EXCLUSION_MARKER_PREFIX));
  assert.equal(markerLines.length, 2);
  assert.equal(
    markerLines[0],
    `${EXCLUSION_MARKER_PREFIX}$1010..$101f first exclusion, recorded second`,
    "the LOWER-start exclusion's marker must appear FIRST",
  );
  assert.equal(
    markerLines[1],
    `${EXCLUSION_MARKER_PREFIX}$1030..$103f second exclusion, recorded first`,
    "the HIGHER-start exclusion's marker must appear SECOND, regardless of recording order",
  );
});

test("exclusion ordering: two consecutive identical exports produce byte-identical source", () => {
  const dir = freshDir("exclusion-ordering-repeat");
  const { storePath, imagePath } = exclusionStore(dir, [
    { start: 0x0807, endInclusive: 0x0808, reason: "cracked loader stub" },
    { start: 0x0809, endInclusive: 0x080a, reason: "trainer patch" },
  ]);
  const ledgerPath = writeLedgerFixture(dir);

  const first = exportAsm({ storePath, imagePath, workspaceRoot: dir, ledgerPath });
  const second = exportAsm({ storePath, imagePath, workspaceRoot: dir, ledgerPath });

  assert.equal(
    second.source,
    first.source,
    "STABILITY across two identical runs is the guarantee; ascending-by-start (asserted above) is a recorded CHOICE, not a written contract",
  );
});

test("EXCLUSION + LEDGER: real ACME reassembles an export carrying both exclusion markers and ledger provenance lines byte-identically", { skip: SKIP_REASON }, () => {
  const dir = freshDir("exclusion-acme-roundtrip");
  const { storePath, imagePath } = exclusionStore(dir, [
    { start: 0x0807, endInclusive: 0x0808, reason: "cracked loader stub, not original game code" },
  ]);
  const ledgerPath = writeLedgerFixture(dir);

  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir, ledgerPath });
  const verdict = verifyExport(result);

  assert.equal(verdict.outcome, "ok", `an export carrying both exclusion and provenance markers must verify:${context(result, verdict)}`);
  assert.equal(verdict.byteDiff?.equal, true, `an export carrying both exclusion and provenance markers must reassemble byte-identically:${context(result, verdict)}`);
});

// ---------------------------------------------------------------------------
// Phase 46 plan 06 (BUILD-07): the planted control and the structural guard.
// Every assertion below was written FIRST and observed to fail before the
// control/guard existed, per this plan's own TDD instruction (the
// `anno-bank.test.ts:1-10` voice) -- see `46-06-PLAN.md`'s <behavior> blocks
// for the exact bullets each test proves.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// TASK 1 -- the planted control: observed RED against a test-only filtering
// variant, then trusted GREEN against the real, shipped exporter. Both
// halves run over ONE fixture in ONE test, so the red and the green are
// provably about the same input.
// ---------------------------------------------------------------------------

/** The verdict the test-only filtering variant below is keyed on -- the one
 * a plausible heuristic would reach for. */
const FILTERED_VERDICT = "CRACKER-PATCH";

/**
 * The planted range's own text: printable PETSCII (space, digits, and
 * uppercase letters share the same byte values as ASCII in unshifted PETSCII
 * text mode -- `src/skills/c64-petcat/SKILL.md`) reading as crack-credit
 * text -- exactly the shape a plausible heuristic would reach for and drop.
 */
const PLANTED_TEXT = "CRACKED BY GRP";
const PLANTED_BYTES: readonly number[] = [...PLANTED_TEXT].map((ch) => ch.charCodeAt(0));
const PLANTED_START = 0x0807;
const PLANTED_END_INCLUSIVE = PLANTED_START + PLANTED_BYTES.length - 1; // $0814

/**
 * The planted control's own store: a real, referenced `code` range first (so
 * the store is not "one range and nothing else"), the PLANTED range second
 * -- literally the MIDDLE of the three -- and a third plain `byte` range
 * last. Dropping the middle range (as the filtering variant below does)
 * therefore leaves exactly ONE fewer block than the store's own range count,
 * never zero -- see the RED half's own count assertion below.
 */
function plantedControlStore(dir: string): StoreFixture {
  return buildStore(dir, {
    origin: 0x0801,
    body: [...SHAPE_BODY, ...PLANTED_BYTES, 0xaa, 0xbb],
    ranges: [
      { start: 0x0801, endInclusive: 0x0806, dataType: "code" },
      { start: PLANTED_START, endInclusive: PLANTED_END_INCLUSIVE, dataType: "byte" },
      { start: 0x0815, endInclusive: 0x0816, dataType: "byte" },
    ],
    labels: [{ address: 0x0801, name: "reset_border" }],
    comments: [{ address: 0x0801, commentType: "line", text: "sets the border colour to black" }],
  });
}

/**
 * The fixture ledger's generated tier: full $0000-$FFFF coverage
 * (`renderLedger()`'s own precondition), with the PLANTED range classified
 * CRACKER-PATCH/cracktro and the other two real ranges ORIGINAL -- so the
 * "exactly one CRACKER-PATCH row" shape the RED half's count assertion
 * depends on is unambiguous.
 */
const PLANTED_CONTROL_LEDGER_RANGES = [
  {
    start: 0x0000,
    end: 0x0800,
    kind: "unused",
    verdict: "ORIGINAL",
    agreeing_releases: 2,
    evidence: "padding before the annotated range, byte-identical across releases",
  },
  {
    start: 0x0801,
    end: 0x0806,
    kind: "game",
    verdict: "ORIGINAL",
    agreeing_releases: 3,
    evidence: "the border-reset routine matches both independently-cracked releases byte for byte",
  },
  {
    start: PLANTED_START,
    end: PLANTED_END_INCLUSIVE,
    kind: "cracktro",
    verdict: "CRACKER-PATCH",
    agreeing_releases: 0,
    evidence: "crack-credit text inserted by the cracker -- no label, comment or cross-reference in the store names it",
  },
  {
    start: 0x0815,
    end: 0x0816,
    kind: "game",
    verdict: "ORIGINAL",
    agreeing_releases: 2,
    evidence: "trailing filler byte, byte-identical across releases",
  },
  {
    start: 0x0817,
    end: 0xffff,
    kind: "unused",
    verdict: "ORIGINAL",
    agreeing_releases: 2,
    evidence: "padding after the annotated range, byte-identical across releases",
  },
];

/**
 * TEST-ONLY. Must never be copied into `anno-export-asm.ts` or any module in
 * `package.json`'s `files[]`. This is the negative control BUILD-07
 * criterion 1 requires: a deliberately-filtering re-implementation of just
 * the block-construction stretch, dropping any range whose overlapping
 * ledger row carries `FILTERED_VERDICT`. It exists for exactly one purpose
 * -- to demonstrate that the assertions in the control test's GREEN half can
 * tell a lossless exporter from a filtering one -- and its existence in this
 * file is the reason those green assertions mean something. It does not
 * need to emit valid ACME; it only produces a block list and an
 * expected-byte span the same assertions can be run against.
 */
function exportAsmWithVerdictFilter(options: ExportAsmOptions): { source: string; expectedBytes: Uint8Array; blocks: ExportBlock[] } {
  const { storePath, imagePath, workspaceRoot, ledgerPath } = options;
  if (ledgerPath === undefined) {
    throw new Error("exportAsmWithVerdictFilter (TEST-ONLY): ledgerPath is required -- this variant exists to filter on ledger verdicts");
  }

  const raw = readFileSync(imagePath);
  const origin = raw.readUInt16LE(0);
  const bytes = raw.subarray(2);

  const ranges = (() => {
    const handle = openStore(storePath, { workspaceRoot, mustExist: true });
    try {
      return listRanges(handle);
    } finally {
      closeStore(handle);
    }
  })();
  const sortedRanges = [...ranges].sort((a, b) => a.start - b.start);
  const ledger = readProvenanceLedger(ledgerPath);

  // THE FORBIDDEN SHAPE, DELIBERATELY: a `.filter()` keyed on the
  // overlapping ledger row's verdict VALUE -- exactly the shape Task 2's
  // structural guard below exists to catch if it ever appeared in the
  // shipped module.
  const kept = sortedRanges.filter((row) => {
    const overlapping = provenanceForRange(ledger, row.start, row.endInclusive);
    return !overlapping.some((r) => r.verdict === FILTERED_VERDICT);
  });

  const blocks: ExportBlock[] = kept.map((row) => ({
    start: row.start,
    endExclusive: row.endInclusive + 1,
    dataType: row.dataType,
    lineCount: 0,
    // TEST-ONLY forbidden-shape variant (see the doc-comment above): it never
    // calls the real `emitBlock()`, so there is no real bracketed text to
    // capture here -- an empty array, since nothing in this file reads it.
    lines: [],
  }));

  const minStart = blocks.length > 0 ? Math.min(...blocks.map((b) => b.start)) : 0;
  const maxEndExclusive = blocks.length > 0 ? Math.max(...blocks.map((b) => b.endExclusive)) : 0;
  const expectedBytes = new Uint8Array(Math.max(0, maxEndExclusive - minStart));
  for (const block of blocks) {
    expectedBytes.set(bytes.subarray(block.start - origin, block.endExclusive - origin), block.start - minStart);
  }

  const source = blocks.map((b) => `; block $${b.start.toString(16)}..$${(b.endExclusive - 1).toString(16)}`).join("\n");
  return { source, expectedBytes, blocks };
}

test(
  "PLANTED CONTROL (BUILD-07): a CRACKER-PATCH-classified, cracktro-shaped, wholly unreferenced range is dropped by a filtering variant (RED) and survives byte for byte, annotated, in the real exporter (GREEN)",
  { skip: SKIP_REASON },
  () => {
    const dir = freshDir("planted-control");
    const { storePath, imagePath } = plantedControlStore(dir);
    const ledgerPath = writeLedgerFixture(dir, PLANTED_CONTROL_LEDGER_RANGES);

    // --- Fixture non-vacuity: three independent counts, asserted BEFORE
    // anything about the exporter runs. Without these, "the heuristic would
    // have wanted to drop it" is an assertion about a fixture that never
    // tempted anything.
    const patchRow = PLANTED_CONTROL_LEDGER_RANGES.find(
      (r) => r.verdict === "CRACKER-PATCH" && r.start <= PLANTED_END_INCLUSIVE && r.end >= PLANTED_START,
    );
    assert.ok(patchRow, "the fixture ledger must classify the planted range CRACKER-PATCH -- otherwise nothing here tempts a heuristic");
    assert.equal(patchRow.verdict, "CRACKER-PATCH", "the planted range's ledger row's verdict must be CRACKER-PATCH, verbatim");
    assert.equal(patchRow.kind, "cracktro", "the planted range's kind must be cracktro -- the shape a heuristic reaches for");

    assert.ok(
      PLANTED_BYTES.every((b) => b >= 0x20 && b <= 0x5a),
      `the planted range's bytes must be a printable run reading as crack-credit text: ${JSON.stringify(PLANTED_BYTES)}`,
    );

    const { labels, comments, enumUsage } = (() => {
      const handle = openStore(storePath, { workspaceRoot: dir, mustExist: true });
      try {
        return { labels: listLabels(handle), comments: listComments(handle), enumUsage: listEnumUsage(handle) };
      } finally {
        closeStore(handle);
      }
    })();
    // Non-vacuity for the zero below: the store DOES carry labels and
    // comments elsewhere (on the first, real range), so a zero count in the
    // planted range is a genuine absence, not an empty store
    // (anno-coverage.test.ts's own non-vacuity idiom).
    assert.ok(
      labels.length > 0 && comments.length > 0,
      "the store must carry SOME labels and comments elsewhere, or the zero count below measures an empty store rather than a genuine absence",
    );
    const inPlantedRange = (address: number): boolean => address >= PLANTED_START && address <= PLANTED_END_INCLUSIVE;
    const referencingPlantedRange = [
      ...labels.filter((l) => inPlantedRange(l.address)),
      ...comments.filter((c) => inPlantedRange(c.address)),
      ...enumUsage.filter((u) => inPlantedRange(u.address)),
    ];
    assert.equal(
      referencingPlantedRange.length,
      0,
      `no label, comment or enum usage anywhere in the store may reference the planted range: ${JSON.stringify(referencingPlantedRange)}`,
    );

    // --- RED half: the filtering variant, run over the SAME fixture, drops
    // the planted range.
    const filtered = exportAsmWithVerdictFilter({ storePath, imagePath, workspaceRoot: dir, ledgerPath });
    const realRanges = (() => {
      const handle = openStore(storePath, { workspaceRoot: dir, mustExist: true });
      try {
        return listRanges(handle);
      } finally {
        closeStore(handle);
      }
    })();
    assert.equal(
      filtered.blocks.length,
      realRanges.length - 1,
      "the filtering variant must drop EXACTLY one range -- the planted one -- not fail for some unrelated reason",
    );
    assert.ok(
      !filtered.blocks.some((b) => b.start === PLANTED_START),
      "the planted range's start must be ABSENT from the filtering variant's block starts",
    );
    assert.equal(
      Buffer.from(filtered.expectedBytes).indexOf(Buffer.from([...PLANTED_BYTES])),
      -1,
      "the planted range's bytes must be ABSENT from the filtering variant's expected-byte span",
    );

    // --- GREEN half: the real, shipped exportAsm() over the SAME fixture.
    const result = exportAsm({ storePath, imagePath, workspaceRoot: dir, ledgerPath });

    // DISCRIMINATING POWER (recorded per the plan's own requirement): the
    // specific broken variant tried is `exportAsmWithVerdictFilter` above --
    // a block-construction `.filter()` keyed on the overlapping ledger
    // row's verdict, in place of the unconditional `.map()`. Run directly
    // above, in this same test, it produced exactly the wrong output the
    // RED half just asserted: one fewer block than the store's own range
    // count, the planted range's start absent from the block starts, and
    // its bytes absent from the expected-byte span. This control's red
    // observation is therefore CONTINUOUS -- run mechanically, in this
    // test, every time this file runs -- rather than a historical hand run
    // recorded once at authoring time (contrast
    // `channel-lock.test.ts:108-118`, whose LIFO variant was run by hand
    // during authoring and never mechanically re-run since). This is what
    // confirms the assertions below actually distinguish a lossless
    // exporter from a filtering one, rather than merely reading whichever
    // result happens to fall out.
    const plantedBlock = result.blocks.find((b) => b.start === PLANTED_START);
    assert.ok(plantedBlock, "the real exporter must still emit a block starting at the planted range's start");
    assert.equal(
      plantedBlock.endExclusive,
      PLANTED_END_INCLUSIVE + 1,
      "the planted block's endExclusive must be the planted range's inclusive end plus one",
    );

    const minStart = Math.min(...result.blocks.map((b) => b.start));
    const offset = PLANTED_START - minStart;
    assert.deepEqual(
      Array.from(result.expectedBytes.subarray(offset, offset + PLANTED_BYTES.length)),
      Array.from(PLANTED_BYTES),
      "the planted range's exact bytes must appear at the right offset in result.expectedBytes",
    );

    const plantedSource = blockSourceFor(result.source, `$${PLANTED_START.toString(16).padStart(4, "0")}`);
    assert.match(
      plantedSource,
      /; PROVENANCE LEDGER: .*verdict=CRACKER-PATCH\b/,
      "the planted block must be ANNOTATED with the CRACKER-PATCH verdict, not merely retained",
    );

    assert.equal(
      result.blocks.length,
      realRanges.length,
      "nothing may be dropped: the real exporter's block count must equal the store's own range count",
    );

    const verdict = verifyExport(result);
    assert.equal(verdict.outcome, "ok", `the planted control's export must round-trip:${context(result, verdict)}`);
    assert.equal(verdict.byteDiff?.equal, true, `the byte-diff IS the verdict:${context(result, verdict)}`);
  },
);

test("the filtering variant's identifier never reaches anno-export-asm.ts's own shipped source", () => {
  const source = readFileSync(join(HERE, "anno-export-asm.ts"), "utf8");
  assert.equal(
    source.includes("exportAsmWithVerdictFilter"),
    false,
    "exportAsmWithVerdictFilter is TEST-ONLY and must never be copied into the shipped exporter",
  );
});

test("anno-export-asm.test.ts is absent from package.json's files[] array (test-only, mechanically enforced, acme-gate.test.ts's own idiom)", () => {
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files: string[] };
  assert.ok(Array.isArray(pkg.files), "package.json must declare a files[] array");
  assert.equal(
    pkg.files.includes("anno-export-asm.test.ts"),
    false,
    "anno-export-asm.test.ts carries the test-only filtering variant and must never ship in the published npm tarball",
  );
});

// ---------------------------------------------------------------------------
// TASK 2 -- the structural guard: reads `anno-export-asm.ts`'s own source
// through `codeOnly()` so the guard cannot be satisfied or invalidated by
// the module's own prose discussing the forbidden shape at length. Every
// predicate below is proven non-vacuous against a synthetic, in-memory
// mutation before its silence on the real module is trusted -- the same
// discipline `module-classification.test.ts`'s own DIRECTION guards apply
// to themselves.
// ---------------------------------------------------------------------------

/**
 * The block-construction stretch, and ONLY that stretch, of
 * `anno-export-asm.ts`'s own stripped source: from `const sortedRanges =
 * [...ranges].sort(...)` through the closing `}));` of the block-list
 * `.map()`. Bounded narrowly on purpose -- the LATER per-block loop
 * legitimately interpolates an overlapping ledger row's
 * `verdict`/`confidence`/`kind` INTO A COMMENT STRING, which is not the
 * shape this guard forbids, and a guard scanning the WHOLE file would have
 * to tell those two apart. This slice contains nothing but the
 * range-to-block conversion, so any occurrence of `.filter(` or a
 * provenance field name inside it is unambiguous.
 */
function blockConstructionSlice(): string {
  const raw = readFileSync(join(HERE, "anno-export-asm.ts"), "utf8");
  const stripped = codeOnly(raw);
  const match = stripped.match(/const sortedRanges = \[\.\.\.ranges\]\.sort\([\s\S]*?\}\)\);/);
  assert.ok(match, "the block-construction stretch must be found in anno-export-asm.ts's own stripped source -- the guard below has nothing to scan");
  return match[0];
}

/** Positive: the block-construction `.map()` is present in its exact,
 * unconditional current form -- pinning the one right shape rather than
 * enumerating wrong ones. */
function pinsUnconditionalBlockMap(text: string): boolean {
  return /const blocks: ExportBlock\[\] = sortedRanges\.map\(\(row\) => \(\{\s*start: row\.start,\s*endExclusive: row\.endInclusive \+ 1,[\s\S]*?dataType: assertDataTypeForExport\(row\) as string,\s*lineCount: 0,\s*lines: \[\],\s*\}\)\);/.test(
    text,
  );
}

/** Negative: a `.filter()` applied to the RANGE list -- chained before the
 * `.map()` that builds the block array. */
function hasRangeListFilter(text: string): boolean {
  const filterIndex = text.indexOf(".filter(");
  const mapIndex = text.indexOf(".map(");
  return filterIndex !== -1 && mapIndex !== -1 && filterIndex < mapIndex;
}

/** Negative: a `.filter()` applied to the BLOCK list -- chained after the
 * `.map()` that builds it. */
function hasBlockListFilter(text: string): boolean {
  const filterIndex = text.indexOf(".filter(");
  const mapIndex = text.indexOf(".map(");
  return filterIndex !== -1 && mapIndex !== -1 && filterIndex > mapIndex;
}

/** Negative: ANY reference to a provenance field's name inside the
 * block-construction stretch. The real stretch has none -- `dataType` is
 * copied verbatim, but `verdict`/`confidence`/`kind` belong to the ledger
 * row, read only LATER, in the per-block loop this slice deliberately
 * excludes. A conditional cannot inspect a field's contents without first
 * naming it, so "no reference at all" is a strictly stronger, and still
 * correct, form of "no conditional reads it". */
function referencesProvenanceField(text: string): boolean {
  return /\b(verdict|confidence|kind)\b/.test(text);
}

test("guard non-vacuity: codeOnly()'s own extraction of anno-export-asm.ts is non-empty and strictly shorter than the raw source", () => {
  const raw = readFileSync(join(HERE, "anno-export-asm.ts"), "utf8");
  const stripped = codeOnly(raw);
  // ci-suite-coverage.test.ts applies this same self-check to its own text
  // extraction, for the same reason: a stripper bug that silently returned
  // nothing (or the whole file unstripped) would make every negative
  // assertion below pass for the wrong reason.
  assert.ok(stripped.length > 0, "codeOnly() must not return an empty string for a real module");
  assert.ok(stripped.length < raw.length, "codeOnly() must actually strip something -- comments and string bodies exist in this module");
});

test("STRUCTURAL GUARD (BUILD-07): the block array is built 1:1 from the sorted range list, with no filter and no provenance-field conditional", () => {
  const slice = blockConstructionSlice();

  assert.equal(
    pinsUnconditionalBlockMap(slice),
    true,
    "the block array must be built 1:1 from the sorted range list via an unconditional .map() -- BUILD-07 requires the export path be lossless by default, and no range may be dropped, filtered or omitted on the tool's own judgement",
  );
  assert.equal(
    hasRangeListFilter(slice),
    false,
    "no .filter() may be applied to the range list before the block array is built -- that is how a provenance value would gain the power to remove a range from the artefact (T-46-03)",
  );
  assert.equal(
    hasBlockListFilter(slice),
    false,
    "no .filter() may be applied to the block list after it is built -- the same BUILD-07/T-46-03 hazard, chained the other way",
  );
  assert.equal(
    referencesProvenanceField(slice),
    false,
    "no code between the store read and the emitted block array may reference a verdict, confidence or kind field, let alone branch on one (BUILD-07/T-46-03)",
  );
});

// --- The guard's own non-vacuity: each predicate above, fired against a
// synthetic, in-memory mutation of the SAME slice. A predicate that has
// never fired is indistinguishable from one that cannot
// (module-classification.test.ts's own DIRECTION-guard discipline, applied
// to this guard).

test("guard non-vacuity: pinsUnconditionalBlockMap fires when the block shape drifts from the pinned form", () => {
  const slice = blockConstructionSlice();
  const mutated = slice.replace("lineCount: 0,", "lineCount: 0,\n    extraneous: true,");
  assert.notEqual(mutated, slice, "the mutation must actually change the string, or this proves nothing");
  assert.equal(pinsUnconditionalBlockMap(mutated), false, "the positive predicate must REPORT a drifted shape, not silently accept it");
});

test("guard non-vacuity: hasRangeListFilter fires when a .filter() is inserted before the block .map()", () => {
  const slice = blockConstructionSlice();
  const mutated = slice.replace("sortedRanges.map(", 'sortedRanges.filter((row) => row.start >= 0).map(');
  assert.notEqual(mutated, slice, "the mutation must actually change the string, or this proves nothing");
  assert.equal(hasRangeListFilter(mutated), true, "the range-list-filter predicate must REPORT the inserted filter");
});

test("guard non-vacuity: hasBlockListFilter fires when a .filter() is chained after the block .map()", () => {
  const slice = blockConstructionSlice();
  const mutated = slice.replace(/\}\)\);\s*$/, '})).filter((b) => b.start >= 0);');
  assert.notEqual(mutated, slice, "the mutation must actually change the string, or this proves nothing");
  assert.equal(hasBlockListFilter(mutated), true, "the block-list-filter predicate must REPORT the appended filter");
});

test("guard non-vacuity: referencesProvenanceField fires when a provenance field name is inserted into the slice", () => {
  const slice = blockConstructionSlice();
  const mutated = slice.replace(
    "dataType: assertDataTypeForExport(row) as string,",
    'dataType: row.verdict === "CRACKER-PATCH" ? "excluded" : (assertDataTypeForExport(row) as string),',
  );
  assert.notEqual(mutated, slice, "the mutation must actually change the string, or this proves nothing");
  assert.equal(referencesProvenanceField(mutated), true, "the field-reference predicate must REPORT the inserted verdict conditional");
});

// --- The behavioural companion: "no verdict value changes what is emitted"
// measured across the whole verdict vocabulary, not on one example.

test(
  "BEHAVIOURAL COMPANION (BUILD-07): no verdict, confidence or kind value changes what is emitted, across the full vocabulary",
  { skip: SKIP_REASON },
  () => {
    const dir = freshDir("guard-companion");
    const { storePath, imagePath } = exclusionStore(dir, [
      { start: 0x0807, endInclusive: 0x0808, reason: "behavioural companion: one recorded exclusion, independent of provenance" },
    ]);
    const ledgerPath = writeLedgerFixture(dir);

    // Non-vacuity: the fixture ledger really carries all three verdicts and
    // at least two distinct confidence tiers, checked against its OWN
    // rendered table -- before anything about the exporter's output is
    // asserted.
    const ledgerText = readFileSync(ledgerPath, "utf8");
    const rows = [...ledgerText.matchAll(/^\| \$[0-9A-Fa-f]{4} \| \$[0-9A-Fa-f]{4} \| \S+ \| (\S+) \| ([^|]+?) \| \d+ \|/gm)];
    assert.ok(rows.length > 0, "the ledger fixture must actually parse -- otherwise the vocabulary assertions below measure nothing");
    const verdictsInLedger = new Set(rows.map((r) => r[1]!.trim()));
    const confidencesInLedger = new Set(rows.map((r) => r[2]!.trim()));
    assert.deepEqual(
      [...verdictsInLedger].sort(),
      ["CRACKER-PATCH", "ORIGINAL", "UNKNOWN"],
      "the fixture ledger must carry all three verdicts",
    );
    assert.ok(
      confidencesInLedger.size >= 2,
      `the fixture ledger must carry at least two distinct confidence tiers, found: ${[...confidencesInLedger].join(", ")}`,
    );

    const result = exportAsm({ storePath, imagePath, workspaceRoot: dir, ledgerPath });

    const storeRangeCount = (() => {
      const handle = openStore(storePath, { workspaceRoot: dir, mustExist: true });
      try {
        return listRanges(handle).length;
      } finally {
        closeStore(handle);
      }
    })();
    assert.equal(
      result.blocks.length,
      storeRangeCount,
      "result.blocks.length must equal the store's OWN live range count -- never a hard-coded number",
    );

    // Per-block annotation, asserted INDIVIDUALLY -- a block annotated twice
    // cannot cover for a block annotated zero times.
    for (const block of result.blocks) {
      const blockHex = `$${block.start.toString(16).padStart(4, "0")}`;
      const blockText = blockSourceFor(result.source, blockHex);
      assert.match(blockText, /; PROVENANCE LEDGER: /, `block ${blockHex} must carry at least one provenance line`);
    }

    // Verdict set equality, asserted in BOTH directions separately: one
    // direction alone would miss an INVENTED verdict, the other alone would
    // miss a DROPPED one.
    const verdictsInSource = new Set([...result.source.matchAll(/verdict=(\S+)/g)].map((m) => m[1]!));
    for (const v of verdictsInLedger) {
      assert.ok(verdictsInSource.has(v), `ledger verdict ${v} must appear in the exported source -- nothing may be silently dropped`);
    }
    for (const v of verdictsInSource) {
      assert.ok(verdictsInLedger.has(v), `source verdict ${v} must come from the ledger -- nothing may be invented`);
    }
  },
);

// ---------------------------------------------------------------------------
// Phase 47, plan 47-01: `exportAsmTree()` -- a store becomes a TREE of real
// files, and real ACME reassembles it through `runHostTool()`'s new `cwd`.
// The tree writer is a PARTITION of the already-proven emitter, never a
// second emitter -- every test below is either about the on-disk shape of
// the partition, or about the one byte-diff oracle that settles whether it
// reassembles.
// ---------------------------------------------------------------------------

/** Builds a one-scope-covering-its-single-range store and exports it as a
 * tree under a fresh subdirectory of that store's own temp directory. */
function treeFixture(tag: string): { fixture: StoreFixture; outDir: string; result: ExportAsmTreeResult } {
  const fixture = oneScopeFixture(tag);
  const outDir = join(fixture.dir, "tree");
  const result = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir });
  return { fixture, outDir, result };
}

test("exportAsmTree: a one-scope store writes exactly root.a, symbols.a and one scope_XXXX.a", () => {
  const { outDir, result } = treeFixture("tree-file-set");
  const onDisk = readdirSync(outDir).sort();
  const expected = [ROOT_FILE_NAME, SYMBOLS_FILE_NAME, scopeFileName(0x0801)].sort();
  assert.deepEqual(onDisk, expected, "the tree's on-disk file-name set must be exactly these three files");
  assert.deepEqual(result.files, expected, "result.files must agree with what is actually on disk");
});

test("exportAsmTree: root.a carries !cpu 6510 and exactly two !source lines, symbols file first, every argument a bare filename", () => {
  const { outDir, result } = treeFixture("tree-root-text");
  const rootText = readFileSync(join(outDir, ROOT_FILE_NAME), "utf8");
  assert.match(rootText, /^!cpu 6510$/m, "root.a must carry !cpu 6510");
  const sourceArgs = [...rootText.matchAll(/^!source "([^"]*)"$/gm)].map((m) => m[1]!);
  assert.equal(sourceArgs.length, 2, "a one-scope store's root must source exactly symbols.a and one scope file");
  assert.equal(sourceArgs[0], SYMBOLS_FILE_NAME, "symbols.a must be sourced FIRST -- a symbol defined after its first use widens the referencing instruction (measured)");
  for (const arg of sourceArgs) {
    assert.ok(!arg.includes("/") && !arg.includes("\\"), `!source argument "${arg}" must be a bare filename -- no directory component, no host path`);
  }
  assert.equal(result.sourceOrder[0], SYMBOLS_FILE_NAME);
});

test("exportAsmTree: every block's lines group appears exactly once across the tree's .a files, and the tree carries no content line exportAsm() did not produce", () => {
  const { outDir, result } = treeFixture("tree-partition");
  const treeFileNames = readdirSync(outDir).filter((name) => name.endsWith(".a"));
  const fileLinesByName = new Map(treeFileNames.map((name) => [name, readFileSync(join(outDir, name), "utf8").split("\n")] as const));

  // Every block's own `* = $XXXX` origin line is unique to that block, so
  // counting how many tree files carry it is a check that the block's whole
  // `lines` group was written to exactly one destination, never split across
  // two files and never duplicated into two.
  for (const block of result.blocks) {
    const originLine = block.lines[0]!;
    const filesCarryingIt = treeFileNames.filter((name) => fileLinesByName.get(name)!.includes(originLine));
    assert.equal(
      filesCarryingIt.length,
      1,
      `block origin line "${originLine}" must appear in exactly one tree .a file, found in: ${filesCarryingIt.join(", ") || "(none)"}`,
    );
  }

  // The tree is a PARTITION of exportAsm()'s own source -- no line the tree
  // carries (other than a banner comment or a !source directive, neither of
  // which exportAsm() itself emits) may be absent from result.source.
  const sourceLines = new Set(result.source.split("\n"));
  for (const name of treeFileNames) {
    for (const line of fileLinesByName.get(name)!) {
      if (line === "" || line.startsWith("; ") || line.startsWith("!source ")) continue;
      assert.ok(sourceLines.has(line), `${name}'s content line "${line}" does not appear in exportAsm()'s own source`);
    }
  }
});

test(
  "cwd control: negative -- the SAME root.a text, assembled with no siblings and no tree directory as working directory, cannot open its own !source files",
  { skip: SKIP_REASON },
  () => {
    // `acme-verify.ts` is used UNCHANGED here, never widened to a file tree
    // (hard scope fence 3): it writes ONE source file into its OWN fresh
    // temp directory, with no siblings and no tree directory as the child's
    // working directory -- exactly the pre-fix world. That single-file
    // design is precisely what makes it the right instrument for this
    // control. The positive twin below deliberately goes through
    // `runHostTool()` instead, because criterion 1 requires the byte-diff
    // oracle be reached through that seam.
    const { outDir, result } = treeFixture("cwd-control-negative");
    const rootText = readFileSync(join(outDir, ROOT_FILE_NAME), "utf8");

    // Non-vacuity FIRST: a control that passed because there was nothing to
    // resolve would be an assertion nobody has ever seen fail.
    assert.match(rootText, /^!source "/m, "the root text must carry at least one !source line before this control means anything");

    const verdict = verifyAcmeAssembles({ source: rootText, expectedBytes: result.expectedBytes, expectedSegments: result.blocks });
    assert.equal(verdict.outcome, "failed", context(result, verdict));
    assert.ok(
      verdict.diagnostics.some((line) => line.includes("Cannot open input file")),
      `diagnostics must carry ACME's own could-not-open-file refusal text, got: ${verdict.diagnostics.join(" | ") || "(none)"}`,
    );
  },
);

test(
  "cwd control: positive twin -- the identical tree, assembled through runHostTool() with acme.build's new cwd, reaches exitStatus 0 and produces result.expectedBytes",
  { skip: SKIP_REASON },
  async () => {
    const { outDir, result } = treeFixture("cwd-control-positive");
    const response = await runHostTool({ tool: "acme.build", args: { source: ROOT_FILE_NAME, format: "plain", noReport: true } }, { repoRoot: outDir });
    assert.equal(response.ok, true, response.ok ? "" : response.message);
    if (!response.ok) return;
    assert.equal(response.exitStatus, 0, "real ACME must exit 0 when its cwd is the tree's own directory");
    assert.equal(response.results.length, 1);
    const producedBytes = new Uint8Array(readFileSync(response.results[0]!.path));
    assert.deepEqual(producedBytes, result.expectedBytes, "the produced .prg bytes must be octet-identical to bytes taken from the image");
  },
);

test("exportAsm(): source is exactly [\"!cpu 6510\", ...headerLines, every block's own lines].join(\"\\n\") plus a trailing newline -- unchanged by this task's field additions", () => {
  const { storePath, imagePath, dir } = shapeFixture("source-unchanged");
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  const reconstructed = `${["!cpu 6510", ...result.headerLines, ...result.blocks.flatMap((b) => b.lines)].join("\n")}\n`;
  assert.equal(result.source, reconstructed, "result.source must be byte-for-byte reconstructible from its own structured pieces");
});

test("anno-export-asm.ts imports nothing from node:child_process -- the exporter provably runs no external program", () => {
  const raw = readFileSync(join(HERE, "anno-export-asm.ts"), "utf8");
  const stripped = codeOnly(raw);
  assert.ok(!stripped.includes("node:child_process"), "anno-export-asm.ts must not import node:child_process anywhere in its own source");
});

// ---------------------------------------------------------------------------
// Phase 47, plan 47-02, Task 1: the partition across MANY scopes, the
// unscoped remainder, and the boundary-crossing refusal. Plan 47-01's tree
// tests above only ever exercised one scope; everything below is about what
// changes once a second scope, an unscoped block, or a straddling range
// enters the picture.
// ---------------------------------------------------------------------------

/**
 * Three ranges over two DISJOINT scopes: scope1 (`0x0801..0x0804`) wholly
 * contains ranges A (`0x0801..0x0802`) and B (`0x0803..0x0804`); scope2
 * (`0x0805..0x0806`) wholly contains range C (`0x0805..0x0806`).
 * `extraRanges`/`extraScopes` let a caller add the unscoped range or a
 * second-scope adjacency case without a parallel fixture builder.
 */
function twoScopeFixture(tag: string, opts: { extraRanges?: StoreSpec["ranges"]; extraScopes?: StoreSpec["scopes"] } = {}): StoreFixture {
  return buildStore(freshDir(tag), {
    origin: 0x0801,
    body: [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08],
    ranges: [
      { start: 0x0801, endInclusive: 0x0802, dataType: "byte" },
      { start: 0x0803, endInclusive: 0x0804, dataType: "byte" },
      { start: 0x0805, endInclusive: 0x0806, dataType: "byte" },
      ...(opts.extraRanges ?? []),
    ],
    scopes: [
      { start: 0x0801, endInclusive: 0x0804 },
      { start: 0x0805, endInclusive: 0x0806 },
      ...(opts.extraScopes ?? []),
    ],
  });
}

test("exportAsmTree: a three-range, two-scope store writes exactly two scope files, each holding exactly the blocks that scope contains", () => {
  const fixture = twoScopeFixture("tree-multi-scope");
  const outDir = join(fixture.dir, "tree");
  const result = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir });

  const scope1File = scopeFileName(0x0801);
  const scope2File = scopeFileName(0x0805);
  assert.deepEqual(
    [...result.files].sort(),
    [ROOT_FILE_NAME, SYMBOLS_FILE_NAME, scope1File, scope2File].sort(),
    "a three-range, two-scope store must write exactly root.a, symbols.a and one file per scope -- no unscoped.a",
  );

  const scope1Blocks = result.blocks.filter((b) => b.start >= 0x0801 && b.start <= 0x0804);
  const scope2Blocks = result.blocks.filter((b) => b.start >= 0x0805 && b.start <= 0x0806);
  assert.equal(scope1Blocks.length, 2, "scope1 wholly contains ranges A and B");
  assert.equal(scope2Blocks.length, 1, "scope2 wholly contains range C");

  const scope1Text = readFileSync(join(outDir, scope1File), "utf8");
  const scope2Text = readFileSync(join(outDir, scope2File), "utf8");
  for (const block of scope1Blocks) assert.ok(scope1Text.includes(block.lines[0]!), `scope1's file must hold the block starting ${block.lines[0]}`);
  for (const block of scope2Blocks) assert.ok(scope2Text.includes(block.lines[0]!), `scope2's file must hold the block starting ${block.lines[0]}`);
  // Cross-check: neither scope's blocks leaked into the other's file.
  for (const block of scope1Blocks) assert.ok(!scope2Text.includes(block.lines[0]!), `scope1's block must NOT appear in scope2's file`);
  for (const block of scope2Blocks) assert.ok(!scope1Text.includes(block.lines[0]!), `scope2's block must NOT appear in scope1's file`);
});

test("exportAsmTree: a block inside no scope lands in unscoped.a, and `files` grows by exactly that one name", () => {
  const base = twoScopeFixture("tree-unscoped-base");
  const baseOutDir = join(base.dir, "tree");
  const baseResult = exportAsmTree({ storePath: base.storePath, imagePath: base.imagePath, workspaceRoot: base.dir, outDir: baseOutDir });
  assert.ok(!baseResult.files.includes(UNSCOPED_FILE_NAME), "the base fixture (no unscoped block) must not write unscoped.a");

  const fixture = twoScopeFixture("tree-unscoped", { extraRanges: [{ start: 0x0807, endInclusive: 0x0808, dataType: "byte" }] });
  const outDir = join(fixture.dir, "tree");
  const result = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir });

  assert.equal(result.files.length, baseResult.files.length + 1, "one added unscoped block must grow `files` by exactly one name");
  assert.ok(result.files.includes(UNSCOPED_FILE_NAME), "the fourth, unscoped range must produce unscoped.a");

  const unscopedText = readFileSync(join(outDir, UNSCOPED_FILE_NAME), "utf8");
  const unscopedBlock = result.blocks.find((b) => b.start === 0x0807)!;
  assert.ok(unscopedText.includes(unscopedBlock.lines[0]!), "unscoped.a must hold exactly the block that lies inside no scope");
});

test(
  "ROUND TRIP: a multi-scope-plus-unscoped tree assembles through runHostTool() at exitStatus 0 and produces bytes deepEqual to expectedBytes",
  { skip: SKIP_REASON },
  async () => {
    const fixture = twoScopeFixture("tree-multi-scope-roundtrip", { extraRanges: [{ start: 0x0807, endInclusive: 0x0808, dataType: "byte" }] });
    const outDir = join(fixture.dir, "tree");
    const result = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir });

    const response = await runHostTool({ tool: "acme.build", args: { source: ROOT_FILE_NAME, format: "plain", noReport: true } }, { repoRoot: outDir });
    assert.equal(response.ok, true, response.ok ? "" : response.message);
    if (!response.ok) return;
    assert.equal(response.exitStatus, 0, "real ACME must exit 0 assembling the multi-scope-plus-unscoped tree");
    assert.equal(response.results.length, 1);
    const producedBytes = new Uint8Array(readFileSync(response.results[0]!.path));
    assert.deepEqual(producedBytes, result.expectedBytes, "the produced bytes must be octet-identical to bytes taken from the image");
  },
);

/** A single range (`0x0803..0x0806`) that starts inside a scope
 * (`0x0801..0x0804`) and ends past that scope's last byte -- overlapping it
 * without being wholly contained by it. The body's first byte (`0xc7`) is a
 * distinctive marker for the content-leak test below; it carries no other
 * significance since the range's `dataType` is `"byte"`, never decoded. */
function boundaryCrossingFixture(tag: string): StoreFixture {
  return buildStore(freshDir(tag), {
    origin: 0x0801,
    body: [0xc7, 0x02, 0x03, 0x04, 0x05, 0x06],
    ranges: [{ start: 0x0803, endInclusive: 0x0806, dataType: "byte" }],
    scopes: [{ start: 0x0801, endInclusive: 0x0804 }],
  });
}

test("a range crossing a scope boundary makes exportAsmTree() refuse by name, naming both extents, and writes nothing", () => {
  const fixture = boundaryCrossingFixture("tree-crossing");
  const outDir = join(fixture.dir, "tree");
  mkdirSync(outDir, { recursive: true });

  assert.throws(
    () => exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /\$0803\.\.\$0806/, `the message must name the range's extent: ${err.message}`);
      assert.match(err.message, /\$0801\.\.\$0804/, `the message must name the scope's extent: ${err.message}`);
      assert.match(err.message, /wholly contained/, `the message must state the containment rule that was violated: ${err.message}`);
      return true;
    },
  );

  // Test 7: the refusal happens BEFORE anything is written.
  assert.deepEqual(readdirSync(outDir), [], "the output directory must still be empty after a refusal -- nothing was written before the throw");
});

test("BOUNDARY CROSSING: the refusal message contains no byte value drawn from the image and no store comment text", () => {
  const fixture = boundaryCrossingFixture("tree-crossing-content-leak");
  const handle = openStore(fixture.storePath, { workspaceRoot: fixture.dir });
  try {
    setComment(handle, { address: 0x0803, commentType: "line", text: "TOP SECRET STORE MARKER" });
  } finally {
    closeStore(handle);
  }
  const outDir = join(fixture.dir, "tree");

  assert.throws(
    () => exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.ok(!err.message.includes("TOP SECRET STORE MARKER"), `the message must not echo store comment text: ${err.message}`);
      assert.ok(!/\bc7\b/i.test(err.message), `the message must not quote the image's own byte value: ${err.message}`);
      return true;
    },
  );
});

/**
 * `tree adjacency:` fixtures -- one scope (`0x0801..0x0806`), one range
 * (`0x0803..0x0806`) whose last byte is exactly the scope's last byte, and a
 * second range (`0x0807..0x0808`) starting exactly one byte past the first
 * scope's last byte. `includeSecondScope` adds a second scope starting
 * exactly where the first ends, to exercise the two adjacency outcomes for
 * that second range from one shared fixture.
 */
function adjacencyFixture(tag: string, opts: { includeSecondScope?: boolean } = {}): StoreFixture {
  return buildStore(freshDir(tag), {
    origin: 0x0801,
    body: [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08],
    ranges: [
      { start: 0x0803, endInclusive: 0x0806, dataType: "byte" },
      { start: 0x0807, endInclusive: 0x0808, dataType: "byte" },
    ],
    scopes: [{ start: 0x0801, endInclusive: 0x0806 }, ...(opts.includeSecondScope ? [{ start: 0x0807, endInclusive: 0x0808 }] : [])],
  });
}

test("tree adjacency: a range whose last byte is exactly the scope's last byte is wholly contained and lands in that scope's file", () => {
  const fixture = adjacencyFixture("tree-adjacency-exact-end");
  const outDir = join(fixture.dir, "tree");
  const result = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir });

  const scopeFile = scopeFileName(0x0801);
  const scopeText = readFileSync(join(outDir, scopeFile), "utf8");
  const block = result.blocks.find((b) => b.start === 0x0803)!;
  assert.ok(scopeText.includes(block.lines[0]!), "a range ending exactly at the scope's last byte must be wholly contained by it");
});

test("tree adjacency: a range starting exactly one byte past a scope's last byte belongs to a second scope starting there, or to unscoped.a with none", () => {
  // With a second scope starting exactly where the first ends + 1:
  const withSecond = adjacencyFixture("tree-adjacency-second-scope", { includeSecondScope: true });
  const outDirWithSecond = join(withSecond.dir, "tree");
  const resultWithSecond = exportAsmTree({
    storePath: withSecond.storePath,
    imagePath: withSecond.imagePath,
    workspaceRoot: withSecond.dir,
    outDir: outDirWithSecond,
  });
  const secondScopeFile = scopeFileName(0x0807);
  const secondScopeText = readFileSync(join(outDirWithSecond, secondScopeFile), "utf8");
  const blockInSecondScope = resultWithSecond.blocks.find((b) => b.start === 0x0807)!;
  assert.ok(
    secondScopeText.includes(blockInSecondScope.lines[0]!),
    "the range starting one byte past the first scope's end belongs to the SECOND scope, not the first",
  );
  assert.ok(
    !resultWithSecond.files.includes(UNSCOPED_FILE_NAME),
    "with a second scope claiming the range, it must not also fall through to unscoped.a",
  );

  // With no second scope, the same range falls through to unscoped.a:
  const withoutSecond = adjacencyFixture("tree-adjacency-no-second-scope");
  const outDirWithoutSecond = join(withoutSecond.dir, "tree");
  const resultWithoutSecond = exportAsmTree({
    storePath: withoutSecond.storePath,
    imagePath: withoutSecond.imagePath,
    workspaceRoot: withoutSecond.dir,
    outDir: outDirWithoutSecond,
  });
  const unscopedText = readFileSync(join(outDirWithoutSecond, UNSCOPED_FILE_NAME), "utf8");
  const blockUnscoped = resultWithoutSecond.blocks.find((b) => b.start === 0x0807)!;
  assert.ok(unscopedText.includes(blockUnscoped.lines[0]!), "with no second scope, the same range must land in unscoped.a");
});

// ---------------------------------------------------------------------------
// Phase 47, plan 47-02, Task 2: the output-directory contract -- refuse
// rather than scribble, and never delete what this export did not write.
// ---------------------------------------------------------------------------

test("exportAsmTree output-directory contract: a non-existent output directory is created and the tree is written", () => {
  const fixture = oneScopeFixture("tree-outdir-missing");
  const outDir = join(fixture.dir, "does-not-exist-yet", "tree");
  assert.ok(!existsSync(outDir), "the output directory must not already exist before the export -- this test is about creating it");

  const result = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir });

  assert.ok(existsSync(outDir), "exportAsmTree must create a missing output directory recursively");
  assert.deepEqual(readdirSync(outDir).sort(), [...result.files].sort());
});

test("exportAsmTree output-directory contract: an existing EMPTY output directory is written into", () => {
  const fixture = oneScopeFixture("tree-outdir-empty");
  const outDir = join(fixture.dir, "tree");
  mkdirSync(outDir, { recursive: true });
  assert.deepEqual(readdirSync(outDir), [], "the directory must genuinely be empty before this test means anything");

  const result = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir });

  assert.deepEqual(readdirSync(outDir).sort(), [...result.files].sort());
});

test("exportAsmTree output-directory contract: a non-empty output directory WITHOUT `force` refuses, naming the directory and the overwrite, and writes nothing", () => {
  const fixture = oneScopeFixture("tree-outdir-nonempty-noforce");
  const outDir = join(fixture.dir, "tree");
  mkdirSync(outDir, { recursive: true });
  const strayPath = join(outDir, "stray.txt");
  writeFileSync(strayPath, "do not touch me", "utf8");

  assert.throws(
    () => exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.ok(err.message.includes(outDir), `the message must name the directory: ${err.message}`);
      assert.match(err.message, /force/i, `the message must name the explicit overwrite as the way to ask for it: ${err.message}`);
      return true;
    },
  );

  assert.equal(readFileSync(strayPath, "utf8"), "do not touch me", "the pre-existing file must be byte-unchanged after the refusal");
  assert.deepEqual(readdirSync(outDir), ["stray.txt"], "nothing must have been written alongside the pre-existing file");
});

test("exportAsmTree output-directory contract: `force: true` re-writes a directory holding a PREVIOUS export of the same store, byte-identical to the first export", () => {
  const fixture = oneScopeFixture("tree-outdir-force-reexport");
  const outDir = join(fixture.dir, "tree");
  const first = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir });
  const firstBytesByName = new Map(first.files.map((name) => [name, readFileSync(join(outDir, name))] as const));

  const second = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir, force: true });

  assert.deepEqual([...second.files].sort(), [...first.files].sort(), "force: true must re-write the SAME file-name set for an unchanged store");
  for (const name of second.files) {
    assert.deepEqual(readFileSync(join(outDir, name)), firstBytesByName.get(name), `${name} must be byte-identical to the first export`);
  }
});

test("exportAsmTree output-directory contract: `force: true` still refuses a directory holding one file this export would NOT write, naming it, and leaves it byte-unchanged", () => {
  const fixture = oneScopeFixture("tree-outdir-force-stray");
  const outDir = join(fixture.dir, "tree");
  exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir });
  const strayPath = join(outDir, "not-mine.a");
  writeFileSync(strayPath, "human-authored content", "utf8");

  assert.throws(
    () => exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir, force: true }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.ok(err.message.includes("not-mine.a"), `the message must name the file this export would not write: ${err.message}`);
      return true;
    },
  );

  assert.equal(
    readFileSync(strayPath, "utf8"),
    "human-authored content",
    "a file this export never wrote must be byte-unchanged after the refusal -- force never deletes to make room",
  );
});

test("exportAsmTree output-directory contract: root.a's modification time is >= every other written file's -- the interruption guard, not a cosmetic choice", () => {
  const fixture = oneScopeFixture("tree-outdir-root-last");
  const outDir = join(fixture.dir, "tree");
  const result = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir });

  const rootMtime = statSync(join(outDir, ROOT_FILE_NAME)).mtimeMs;
  for (const name of result.files) {
    if (name === ROOT_FILE_NAME) continue;
    const otherMtime = statSync(join(outDir, name)).mtimeMs;
    assert.ok(
      rootMtime >= otherMtime,
      `root.a's mtime must be >= ${name}'s -- a tree whose root exists is a tree every file it sources exists for, ` +
        `and that ordering is what makes an interrupted export leave nothing an assembler would happily turn into a wrong program`,
    );
  }
});

// ---------------------------------------------------------------------------
// Phase 47, plan 47-02, Task 3: the drift guard, and every empty and
// ordering edge this phase owes. Modelled on resources-sync.test.ts's own
// two-direction walk-and-compare discipline -- the domain here is a
// generated tree instead of a committed one, but the discipline (nothing
// produced that was not expected, nothing expected that was not produced)
// is the same.
// ---------------------------------------------------------------------------

test("tree determinism: exporting one unchanged store twice into two different directories yields identical sorted file-name lists and byte-identical files, checked in BOTH directions", () => {
  const fixture = twoScopeFixture("tree-determinism-base", { extraRanges: [{ start: 0x0807, endInclusive: 0x0808, dataType: "byte" }] });
  const outDirA = join(fixture.dir, "tree-a");
  const outDirB = join(fixture.dir, "tree-b");
  const resultA = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir: outDirA });
  const resultB = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir: outDirB });

  const namesA = readdirSync(outDirA).sort();
  const namesB = readdirSync(outDirB).sort();
  assert.deepEqual(namesA, namesB, "two exports of an unchanged store must produce identical sorted file-name lists");
  assert.deepEqual([...resultA.files].sort(), [...resultB.files].sort());

  // Direction 1: every file A produced exists byte-identically in B.
  for (const name of namesA) {
    assert.deepEqual(readFileSync(join(outDirA, name)), readFileSync(join(outDirB, name)), `${name} must be byte-identical between the two exports (A -> B)`);
  }
  // Direction 2: every file B produced exists byte-identically in A. A guard
  // that only walked A's own list could never see a file B invented that A
  // never produced -- this direction is what catches that.
  for (const name of namesB) {
    assert.deepEqual(readFileSync(join(outDirB, name)), readFileSync(join(outDirA, name)), `${name} must be byte-identical between the two exports (B -> A)`);
  }
});

test("tree determinism: non-vacuity -- corrupting one byte of one file in the second directory makes the two-direction comparison report a difference naming that file", () => {
  const fixture = twoScopeFixture("tree-determinism-non-vacuity");
  const outDirA = join(fixture.dir, "tree-a");
  const outDirB = join(fixture.dir, "tree-b");
  exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir: outDirA });
  const resultB = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir: outDirB });

  const corruptedName = SYMBOLS_FILE_NAME;
  const corruptedPath = join(outDirB, corruptedName);
  writeFileSync(corruptedPath, `${readFileSync(corruptedPath, "utf8")}; CORRUPTED BY TEST\n`, "utf8");

  const differing: string[] = [];
  for (const name of resultB.files) {
    if (!readFileSync(join(outDirA, name)).equals(readFileSync(join(outDirB, name)))) differing.push(name);
  }
  assert.deepEqual(differing, [corruptedName], "the comparison must report exactly, and only, the one file that was corrupted");
});

test("tree determinism: `files` equals the set computed from the store's own scope rows plus the always-present root, symbols and (here) unscoped names", () => {
  // Every scope in this fixture holds at least one block, and its extra
  // range is deliberately outside both scopes -- so the set computed purely
  // from `result.scopes` (never a hardcoded name list) is the exact file
  // set, with both a missing and an unexpected side asserted.
  const fixture = twoScopeFixture("tree-determinism-fileset", { extraRanges: [{ start: 0x0807, endInclusive: 0x0808, dataType: "byte" }] });
  const outDir = join(fixture.dir, "tree");
  const result = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir });

  const expectedFromScopeRows = new Set([ROOT_FILE_NAME, SYMBOLS_FILE_NAME, UNSCOPED_FILE_NAME, ...result.scopes.map((scope) => scopeFileName(scope.start))]);
  const actual = new Set(result.files);
  const missing = [...expectedFromScopeRows].filter((name) => !actual.has(name));
  const unexpected = [...actual].filter((name) => !expectedFromScopeRows.has(name));
  assert.deepEqual(missing, [], `names computed from the store's own scope rows are missing from files: ${missing.join(", ") || "(none)"}`);
  assert.deepEqual(unexpected, [], `files carries names the store's scope rows do not account for: ${unexpected.join(", ") || "(none)"}`);
});

test("tree ordering: sourceOrder is the symbols file, then each scope file ascending by scope start, then the unscoped file -- identical across two exports of the unchanged store", () => {
  const fixture = twoScopeFixture("tree-ordering", { extraRanges: [{ start: 0x0807, endInclusive: 0x0808, dataType: "byte" }] });
  const outDirA = join(fixture.dir, "tree-a");
  const outDirB = join(fixture.dir, "tree-b");
  const resultA = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir: outDirA });
  const resultB = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir: outDirB });

  const expectedOrder = [SYMBOLS_FILE_NAME, scopeFileName(0x0801), scopeFileName(0x0805), UNSCOPED_FILE_NAME];
  assert.deepEqual(resultA.sourceOrder, expectedOrder);
  assert.deepEqual(resultB.sourceOrder, expectedOrder);
  assert.deepEqual(resultA.sourceOrder, resultB.sourceOrder, "sourceOrder must be identical across two exports of the unchanged store");
});

test("tree ordering: the !source sequence parsed from root.a's own text equals result.sourceOrder", () => {
  const fixture = twoScopeFixture("tree-ordering-root-text", { extraRanges: [{ start: 0x0807, endInclusive: 0x0808, dataType: "byte" }] });
  const outDir = join(fixture.dir, "tree");
  const result = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir });

  const rootText = readFileSync(join(outDir, ROOT_FILE_NAME), "utf8");
  const parsedOrder = [...rootText.matchAll(/^!source "([^"]*)"$/gm)].map((m) => m[1]!);
  // The field a CALLER reads and the file ACME reads must agree -- a test
  // that checked only one would let them disagree in silence.
  assert.deepEqual(parsedOrder, result.sourceOrder);
});

test(
  "tree empty: a store with zero scopes writes exactly root.a, symbols.a and unscoped.a, and that tree assembles to the expected bytes",
  { skip: SKIP_REASON },
  async () => {
    const fixture = shapeFixture("tree-empty-zero-scopes");
    const outDir = join(fixture.dir, "tree");
    const result = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir });
    assert.deepEqual([...result.files].sort(), [ROOT_FILE_NAME, SYMBOLS_FILE_NAME, UNSCOPED_FILE_NAME].sort());

    const response = await runHostTool({ tool: "acme.build", args: { source: ROOT_FILE_NAME, format: "plain", noReport: true } }, { repoRoot: outDir });
    assert.equal(response.ok, true, response.ok ? "" : response.message);
    if (!response.ok) return;
    assert.equal(response.exitStatus, 0);
    const producedBytes = new Uint8Array(readFileSync(response.results[0]!.path));
    assert.deepEqual(producedBytes, result.expectedBytes);
  },
);

/** One populated scope, plus a SECOND scope with no range inside it at all --
 * scopes are validated only against the address space, never against the
 * image, so an out-of-image-range scope is a legal, deliberately empty one. */
function emptyScopeFixture(tag: string): StoreFixture {
  return buildStore(freshDir(tag), {
    origin: 0x0801,
    body: SHAPE_BODY,
    ranges: [{ start: 0x0801, endInclusive: 0x0806, dataType: "code" }],
    labels: [{ address: 0x0801, name: "entry" }],
    scopes: [
      { start: 0x0801, endInclusive: 0x0806 },
      { start: 0x0900, endInclusive: 0x0901 },
    ],
  });
}

test("tree empty: a scope containing no block produces no file and no !source line for it", () => {
  const fixture = emptyScopeFixture("tree-empty-scope-no-block");
  const outDir = join(fixture.dir, "tree");
  const result = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir });

  const emptyScopeFileName = scopeFileName(0x0900);
  assert.ok(!result.files.includes(emptyScopeFileName), "an empty scope must produce no file");
  assert.ok(!existsSync(join(outDir, emptyScopeFileName)), "an empty scope's file must not exist on disk");
  const rootText = readFileSync(join(outDir, ROOT_FILE_NAME), "utf8");
  assert.ok(!rootText.includes(emptyScopeFileName), "root.a must carry no !source line for the empty scope");
});

test("tree empty: a store with zero labels still writes symbols.a and still sources it first", () => {
  const fixture = buildStore(freshDir("tree-empty-zero-labels"), {
    origin: 0x0801,
    body: SHAPE_BODY,
    ranges: [{ start: 0x0801, endInclusive: 0x0806, dataType: "code" }],
    scopes: [{ start: 0x0801, endInclusive: 0x0806 }],
  });
  const outDir = join(fixture.dir, "tree");
  const result = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir });

  assert.ok(result.files.includes(SYMBOLS_FILE_NAME), "symbols.a must exist even with zero labels");
  assert.equal(result.sourceOrder[0], SYMBOLS_FILE_NAME, "symbols.a must still be sourced first");
});

test("tree empty: a store with zero ranges still raises the pre-existing zero-ranges refusal, unchanged, through the tree path", () => {
  const dir = freshDir("tree-empty-zero-ranges");
  const imagePath = join(dir, "game.prg");
  writeFileSync(imagePath, Buffer.from([0x01, 0x08, 0x00]));
  const storePath = join(dir, "anno.sqlite");
  closeStore(openStore(storePath, { workspaceRoot: dir }));
  const outDir = join(dir, "tree");

  assert.throws(
    () => exportAsmTree({ storePath, imagePath, workspaceRoot: dir, outDir }),
    /holds no ranges -- refusing to emit an empty ACME source, because "nothing is annotated" and "the export produced nothing" must not read the same/,
    "the tree path must raise the SAME message exportAsm() itself raises, matching the existing wording exactly",
  );
  assert.ok(!existsSync(outDir) || readdirSync(outDir).length === 0, "nothing must be written for a zero-range store's refusal");
});

test(
  "tree determinism: the partition round-trip invariant at multi-scope scale -- every block's `lines` group appears exactly once across the tree, and the tree's own content lines equal exportAsm().source's lines (this phase's assumption-delta companion test, 47-01-PLAN.md)",
  () => {
    const fixture = twoScopeFixture("tree-partition-multiscale", { extraRanges: [{ start: 0x0807, endInclusive: 0x0808, dataType: "byte" }] });
    const outDir = join(fixture.dir, "tree");
    const result = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir });

    const treeFileNames = result.files.filter((name) => name.endsWith(".a") && name !== ROOT_FILE_NAME);
    const fileLinesByName = new Map(treeFileNames.map((name) => [name, readFileSync(join(outDir, name), "utf8").split("\n")] as const));

    for (const block of result.blocks) {
      const originLine = block.lines[0]!;
      const filesCarryingIt = treeFileNames.filter((name) => fileLinesByName.get(name)!.includes(originLine));
      assert.equal(
        filesCarryingIt.length,
        1,
        `block origin line "${originLine}" must appear in exactly one tree .a file, found in: ${filesCarryingIt.join(", ") || "(none)"}`,
      );
    }

    const sourceLines = new Set(result.source.split("\n"));
    for (const name of treeFileNames) {
      for (const line of fileLinesByName.get(name)!) {
        if (line === "" || line.startsWith("; ") || line.startsWith("!source ")) continue;
        assert.ok(sourceLines.has(line), `${name}'s content line "${line}" does not appear in exportAsm()'s own source`);
      }
    }
  },
);

// ---------------------------------------------------------------------------
// Phase 47, plan 47-03 (BUILD-02): `external_file` finally leaves as its own
// `.bin` sibling, referenced from its scope's `.a` file by a bare-filename
// `!binary` line. Everything below is either about the SHAPE of that one new
// branch (this section), or the end-to-end swap demonstration on a real
// character set (the next section).
// ---------------------------------------------------------------------------

/** A one-block store whose sole range is typed `external_file`, over a
 * synthetic image this test invents -- unlike the swap section below, which
 * deliberately uses a committed fixture's own bytes, the shape tests here
 * need no real character set, only SOME bytes of a known length. */
function externalFileFixture(tag: string, bytes: readonly number[]): StoreFixture {
  return buildStore(freshDir(tag), {
    origin: 0x0801,
    body: bytes,
    ranges: [{ start: 0x0801, endInclusive: 0x0801 + bytes.length - 1, dataType: "external_file" }],
    labels: [],
  });
}

const EXTERNAL_FILE_BODY = [0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88] as const;

test("binary emission: an external_file range emits exactly one !binary line with a bare-filename argument, and no !byte line for it", () => {
  const { dir, storePath, imagePath } = externalFileFixture("binemit-shape", EXTERNAL_FILE_BODY);
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  const binaryLines = result.source.split("\n").filter((line) => /^\s*!binary\b/.test(line));
  assert.equal(binaryLines.length, 1, `an external_file block must emit exactly ONE !binary line, covering its whole extent:\n${result.source}`);
  const byteLines = result.source.split("\n").filter((line) => /^\s*!byte\b/.test(line));
  assert.deepEqual(byteLines, [], `an external_file block must emit no !byte line at all:\n${result.source}`);

  const m = /^\s*!binary "([^"]*)"/.exec(binaryLines[0]!);
  assert.ok(m, `the !binary line must carry a quoted filename argument:\n${binaryLines[0]}`);
  const filename = m![1]!;
  assert.ok(
    !filename.includes("/") && !filename.includes("\\"),
    `the !binary filename argument must be a bare filename with no directory component, got ${JSON.stringify(filename)}`,
  );
  assert.ok(result.source.includes("; external_file"), `the type must still be named verbatim in the trailing comment:\n${result.source}`);
});

test("binary emission: result.binaries carries the block's own image bytes, octet-identical to bytes read independently from the image", () => {
  const { dir, storePath, imagePath } = externalFileFixture("binemit-bytes", EXTERNAL_FILE_BODY);
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  assert.equal(result.binaries.length, 1, "exactly one external_file block must produce exactly one result.binaries entry");
  const entry = result.binaries[0]!;
  assert.equal(entry.start, 0x0801);
  assert.equal(entry.endExclusive, 0x0801 + EXTERNAL_FILE_BODY.length);

  // Read independently from the image file itself -- never from the export
  // -- stripping the 2-byte little-endian load address every .prg carries.
  const imageBytesForRange = new Uint8Array(readFileSync(imagePath)).subarray(2);
  assert.deepEqual(new Uint8Array(entry.bytes), imageBytesForRange, "result.binaries' bytes must be octet-identical to the image's own bytes for this extent");
});

test("binary emission: exportAsmTree() writes the .bin beside the tree with exactly those bytes and that length", () => {
  const { dir, storePath, imagePath } = externalFileFixture("binemit-write", EXTERNAL_FILE_BODY);
  const outDir = join(dir, "tree");
  const result = exportAsmTree({ storePath, imagePath, workspaceRoot: dir, outDir });

  assert.equal(result.binaries.length, 1);
  const entry = result.binaries[0]!;
  assert.ok(result.files.includes(entry.name), `result.files must include the written .bin's own name "${entry.name}"`);
  const onDisk = new Uint8Array(readFileSync(join(outDir, entry.name)));
  assert.deepEqual(onDisk, new Uint8Array(entry.bytes), "the written .bin must hold exactly those bytes");
  assert.equal(onDisk.length, EXTERNAL_FILE_BODY.length, "the written .bin must be exactly that length");
});

test(
  "binary emission: the tree assembles through runHostTool() at exitStatus 0 and the produced bytes deepEqual result.expectedBytes",
  { skip: SKIP_REASON },
  async () => {
    const { dir, storePath, imagePath } = externalFileFixture("binemit-roundtrip", EXTERNAL_FILE_BODY);
    const outDir = join(dir, "tree");
    const result = exportAsmTree({ storePath, imagePath, workspaceRoot: dir, outDir });

    const response = await runHostTool({ tool: "acme.build", args: { source: ROOT_FILE_NAME, format: "plain", noReport: true } }, { repoRoot: outDir });
    assert.equal(response.ok, true, response.ok ? "" : response.message);
    if (!response.ok) return;
    assert.equal(response.exitStatus, 0, "a tree carrying an external_file block must assemble cleanly");
    assert.equal(response.results.length, 1);
    const producedBytes = new Uint8Array(readFileSync(response.results[0]!.path));
    assert.deepEqual(producedBytes, result.expectedBytes, "the produced bytes must be octet-identical to bytes taken from the image");
  },
);

test("dataByteCount for an external_file range equals what the same extent typed byte would have produced", () => {
  const extFixture = externalFileFixture("binemit-databytecount-ext", EXTERNAL_FILE_BODY);
  const extResult = exportAsm({ storePath: extFixture.storePath, imagePath: extFixture.imagePath, workspaceRoot: extFixture.dir });

  const byteFixture = buildStore(freshDir("binemit-databytecount-byte"), {
    origin: 0x0801,
    body: EXTERNAL_FILE_BODY,
    ranges: [{ start: 0x0801, endInclusive: 0x0801 + EXTERNAL_FILE_BODY.length - 1, dataType: "byte" }],
    labels: [],
  });
  const byteResult = exportAsm({ storePath: byteFixture.storePath, imagePath: byteFixture.imagePath, workspaceRoot: byteFixture.dir });

  assert.equal(
    extResult.dataByteCount,
    byteResult.dataByteCount,
    "an external_file range must count the same number of bytes a byte-typed range of the same extent would",
  );
  assert.equal(extResult.dataByteCount, EXTERNAL_FILE_BODY.length, "every byte of the range went out through the data path");
});

test(
  "a .bin truncated by one byte makes real ACME exit non-zero, with the block-end drift !error text on stderr",
  { skip: SKIP_REASON },
  async () => {
    const { dir, storePath, imagePath } = externalFileFixture("binemit-truncate", EXTERNAL_FILE_BODY);
    const outDir = join(dir, "tree");
    const result = exportAsmTree({ storePath, imagePath, workspaceRoot: dir, outDir });
    const entry = result.binaries[0]!;
    const truncated = (entry.bytes as Uint8Array).slice(0, entry.bytes.length - 1);
    writeFileSync(join(outDir, entry.name), Buffer.from(truncated));

    const response = await runHostTool({ tool: "acme.build", args: { source: ROOT_FILE_NAME, format: "plain", noReport: true } }, { repoRoot: outDir });
    assert.equal(response.ok, true, response.ok ? "" : response.message);
    if (!response.ok) return;
    assert.notEqual(response.exitStatus, 0, "a truncated .bin must make real ACME fail -- the bracket assertion must bite, not silently shift every byte after it");
    assert.ok(
      response.stderrTail.includes("block end drifted"),
      `stderr must carry the block-end drift text emitBlock()'s own !error emits, got: ${response.stderrTail}`,
    );
  },
);

test("the .bin siblings are written before root.a -- root.a's modification time is >= every written .bin's, and every .bin precedes it in the reported file set", () => {
  const { dir, storePath, imagePath } = externalFileFixture("binemit-write-order", EXTERNAL_FILE_BODY);
  const outDir = join(dir, "tree");
  const result = exportAsmTree({ storePath, imagePath, workspaceRoot: dir, outDir });

  const rootMtime = statSync(join(outDir, ROOT_FILE_NAME)).mtimeMs;
  const rootIndex = result.files.indexOf(ROOT_FILE_NAME);
  assert.ok(result.binaries.length > 0, "precondition: this fixture must carry at least one binary for the assertion below to mean anything");
  for (const entry of result.binaries) {
    const binMtime = statSync(join(outDir, entry.name)).mtimeMs;
    assert.ok(rootMtime >= binMtime, `root.a's mtime (${rootMtime}) must be >= ${entry.name}'s mtime (${binMtime})`);
    const binIndex = result.files.indexOf(entry.name);
    assert.ok(binIndex >= 0 && binIndex < rootIndex, `${entry.name} must be reported in result.files, ordered before ${ROOT_FILE_NAME}`);
  }
});

// ---------------------------------------------------------------------------
// Phase 47, plan 47-03 (BUILD-02): the swap demonstration itself. Research
// emphasis #1 asked for an honest answer rather than a demonstration against a
// table that does not exist -- both the researcher and the pattern mapper
// independently read the committed bytes and found the same thing: no
// committed fixture currently carries a store-typed data or graphics table
// ready for a `!binary` swap. The bytes used here are the committed
// `fixtures/ghidra/charset-phantom.prg`'s own real `$1000..$17ff` bytes --
// that fixture's own header comment derives the range from its `$DD00`/
// `$D018`/`$D011` writes as a 2048-byte character set. The store that types
// this range `external_file` is built by THIS test, through
// `buildStoreOverImage()`, and is never written to the committed
// `charset-phantom.annostore.json`, which Phase 37/45 tests depend on staying
// typed `code`.
// ---------------------------------------------------------------------------

const CHARSET_PHANTOM_PRG_PATH = join(HERE, "fixtures", "ghidra", "charset-phantom.prg");
const CHARSET_PHANTOM_STORE_JSON_PATH = join(HERE, "fixtures", "ghidra", "charset-phantom.annostore.json");
const CHARSET_START = 0x1000;
const CHARSET_END_INCLUSIVE = 0x17ff;
const CHARSET_SIZE = CHARSET_END_INCLUSIVE - CHARSET_START + 1;

/** XOR-complements every byte. `b ^ 0xff !== b` for every 8-bit `b`, so the
 * result is GUARANTEED to differ from the input at every single byte --
 * non-vacuity does not depend on a random source this test would then have
 * to seed, record or hardcode. */
function complementBytes(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = (bytes[i]! ^ 0xff) & 0xff;
  return out;
}

/**
 * A store built OVER the committed `charset-phantom.prg` (never over the
 * committed `.annostore.json`) carrying the SAME four ranges that store
 * declares, with only the last one's type changed to `external_file`. Labels
 * at `$0810` and `$1000` name the fixture's own `jsr` into the character set
 * -- a reference into an emitted block needs a name for the same reason plan
 * 47-04 will enforce generally.
 */
function charsetSwapFixture(tag: string): StoreFixture {
  return buildStoreOverImage(tag, CHARSET_PHANTOM_PRG_PATH, {
    ranges: [
      { start: 0x0801, endInclusive: 0x080f, dataType: "byte" },
      { start: 0x0810, endInclusive: 0x0822, dataType: "code" },
      { start: 0x0823, endInclusive: 0x0fff, dataType: "byte" },
      { start: CHARSET_START, endInclusive: CHARSET_END_INCLUSIVE, dataType: "external_file" },
    ],
    labels: [
      { address: 0x0810, name: "start" },
      { address: CHARSET_START, name: "charset_start" },
    ],
  });
}

/** Lines of an ACME `-r` report listing that carry ASSEMBLED CODE for the
 * `$0801..$0fff` region -- a line-number column followed by a 4-hex-digit
 * address below `$1000`. The charset region at and above `$1000` is
 * deliberately EXCLUDED: that is exactly the window this test swaps, so its
 * report lines are expected to differ, and comparing them would prove
 * nothing about whether the CODE changed. */
function codeReportLinesBelowCharset(reportText: string): string[] {
  return reportText.split("\n").filter((line) => {
    const m = /^\s*\d+\s+([0-9a-f]{4})\s/.exec(line);
    if (!m) return false;
    return parseInt(m[1]!, 16) < CHARSET_START;
  });
}

/**
 * Runs the whole demonstration for a fresh, uniquely-tagged fixture: exports
 * the tree, assembles the BASELINE through `runHostTool()`, replaces the
 * written `.bin`'s bytes with `complementBytes()`'s output (same length,
 * every byte different), and re-assembles WITHOUT re-exporting. Every
 * `binary swap:`-prefixed test below calls this exactly once, under its own
 * tag, and asserts its own slice of the returned shape -- never a second,
 * divergent setup that could quietly drift from what the others see.
 */
async function runCharsetSwapDemo(tag: string) {
  const fixture = charsetSwapFixture(tag);
  const outDir = join(fixture.dir, "tree");
  const result = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir });

  const binaryEntry = result.binaries.find((b) => b.start === CHARSET_START);
  assert.ok(binaryEntry, "the store's external_file range must produce a result.binaries entry");
  const binPath = join(outDir, binaryEntry!.name);

  const aFileNames = result.files.filter((name) => name.endsWith(".a"));
  const aFilesBefore = new Map(aFileNames.map((name) => [name, readFileSync(join(outDir, name))] as const));

  const originalBinBytes = new Uint8Array(readFileSync(binPath));
  const replacementBytes = complementBytes(originalBinBytes);

  const before = await runHostTool({ tool: "acme.build", args: { source: ROOT_FILE_NAME, format: "plain" } }, { repoRoot: outDir });
  if (!before.ok) throw new Error(`baseline assembly failed: ${before.message}`);
  const beforeProducedBytes = new Uint8Array(readFileSync(before.results[0]!.path));
  const beforeReportText = readFileSync(join(outDir, "root.rep"), "utf8");

  writeFileSync(binPath, Buffer.from(replacementBytes));

  const after = await runHostTool({ tool: "acme.build", args: { source: ROOT_FILE_NAME, format: "plain" } }, { repoRoot: outDir });
  if (!after.ok) throw new Error(`post-swap assembly failed: ${after.message}`);
  const afterProducedBytes = new Uint8Array(readFileSync(after.results[0]!.path));
  const afterReportText = readFileSync(join(outDir, "root.rep"), "utf8");

  const aFilesAfter = new Map(aFileNames.map((name) => [name, readFileSync(join(outDir, name))] as const));

  const minStart = Math.min(...result.blocks.map((b) => b.start));
  const expectedAfterBytes = new Uint8Array(result.expectedBytes);
  expectedAfterBytes.set(replacementBytes, CHARSET_START - minStart);

  return {
    outDir,
    result,
    originalBinBytes,
    replacementBytes,
    before,
    beforeProducedBytes,
    beforeReportCodeLines: codeReportLinesBelowCharset(beforeReportText),
    aFilesBefore,
    after,
    afterProducedBytes,
    afterReportCodeLines: codeReportLinesBelowCharset(afterReportText),
    aFilesAfter,
    expectedAfterBytes,
  };
}

test(
  "binary swap: the setup -- a store typing the committed character-set region external_file assembles the baseline tree at exitStatus 0 with bytes equal to expectedBytes",
  { skip: SKIP_REASON },
  async () => {
    const demo = await runCharsetSwapDemo("swap-setup");
    assert.equal(demo.before.exitStatus, 0, "the baseline tree must assemble cleanly before any swap");
    assert.deepEqual(demo.beforeProducedBytes, demo.result.expectedBytes, "the baseline produced bytes must equal expectedBytes before any swap");
  },
);

test(
  "binary swap: the demonstration -- replacing the written .bin's 2048 bytes and re-assembling WITHOUT re-exporting changes the produced bytes exactly in the $1000..$17ff window",
  { skip: SKIP_REASON },
  async () => {
    const demo = await runCharsetSwapDemo("swap-demonstration");
    assert.equal(demo.after.exitStatus, 0, "the post-swap tree must still assemble cleanly -- only the DATA changed, never the code");
    assert.deepEqual(
      demo.afterProducedBytes,
      demo.expectedAfterBytes,
      "the produced bytes after the swap must equal expectedBytes with EXACTLY the $1000..$17ff window replaced, nothing else changed",
    );
  },
);

test(
  "binary swap: no code was touched -- every .a file in the tree is byte-identical before and after the swap",
  { skip: SKIP_REASON },
  async () => {
    const demo = await runCharsetSwapDemo("swap-no-code-touched");
    assert.deepEqual(
      [...demo.aFilesBefore.keys()].sort(),
      [...demo.aFilesAfter.keys()].sort(),
      "the swap must not add or remove any .a file",
    );
    for (const [name, before] of demo.aFilesBefore) {
      const afterBytes = demo.aFilesAfter.get(name);
      assert.ok(afterBytes, `.a file "${name}" present before the swap must still be present after it`);
      assert.deepEqual(afterBytes, before, `.a file "${name}" must be byte-identical before and after the swap -- the claim is "not one line of code touched"`);
    }
  },
);

test(
  "binary swap: ACME agrees -- the two report listings' code lines for $0801..$0fff are identical",
  { skip: SKIP_REASON },
  async () => {
    const demo = await runCharsetSwapDemo("swap-acme-agrees");
    assert.ok(demo.beforeReportCodeLines.length > 0, "the report must carry at least one code line before this comparison means anything");
    assert.deepEqual(
      demo.afterReportCodeLines,
      demo.beforeReportCodeLines,
      "ACME's own report listing must show identical code lines across the two assemblies",
    );
  },
);

test("PRECONDITION: the replacement bytes really differ from the original, and the original .bin is exactly 2048 bytes", () => {
  const fixture = charsetSwapFixture("swap-non-vacuity");
  const outDir = join(fixture.dir, "tree");
  const result = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir });
  const binaryEntry = result.binaries.find((b) => b.start === CHARSET_START)!;
  const originalBytes = new Uint8Array(readFileSync(join(outDir, binaryEntry.name)));
  assert.equal(originalBytes.length, CHARSET_SIZE, "the character-set region must be exactly 2048 bytes");

  const replacementBytes = complementBytes(originalBytes);
  assert.equal(replacementBytes.length, originalBytes.length, "the replacement must be the SAME length as the original");
  assert.ok(
    originalBytes.every((b, i) => replacementBytes[i] !== b),
    "every byte of the replacement must differ from the original -- a swap test that swapped identical bytes would pass while proving nothing",
  );
});

test("the committed charset-phantom.annostore.json is untouched -- its $1000..$17ff row still reads code", () => {
  const stored = JSON.parse(readFileSync(CHARSET_PHANTOM_STORE_JSON_PATH, "utf8")) as {
    ranges: Array<{ start: number; endInclusive: number; dataType: string }>;
  };
  const row = stored.ranges.find((r) => r.start === CHARSET_START);
  assert.ok(row, `the committed store must carry a range starting at ${CHARSET_START}`);
  assert.equal(row!.endInclusive, CHARSET_END_INCLUSIVE, "the committed row's own end must still be $17ff");
  assert.equal(row!.dataType, "code", 'the committed store must still type the character-set range "code" -- Phase 37/45 tests depend on it');
});

test("a re-export into a directory holding a hand-swapped .bin refuses by name and leaves it intact; an explicit overwrite replaces it", () => {
  const fixture = charsetSwapFixture("swap-overwrite-guard");
  const outDir = join(fixture.dir, "tree");
  const first = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir });
  const binaryEntry = first.binaries.find((b) => b.start === CHARSET_START)!;
  const binPath = join(outDir, binaryEntry.name);

  const originalBytes = new Uint8Array(readFileSync(binPath));
  const swappedBytes = complementBytes(originalBytes);
  writeFileSync(binPath, Buffer.from(swappedBytes));

  assert.throws(
    () => exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir }),
    /already holds/,
    "a re-export without force must refuse by name rather than silently destroy the human's hand-swapped file",
  );
  assert.deepEqual(new Uint8Array(readFileSync(binPath)), swappedBytes, "the swapped bytes must survive the refused re-export completely untouched");

  exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir, force: true });
  assert.deepEqual(
    new Uint8Array(readFileSync(binPath)),
    originalBytes,
    "an explicit overwrite must replace the swapped .bin with the export's own bytes -- because that is the user asking",
  );
});

// ---------------------------------------------------------------------------
// Phase 47, plan 47-04 (BUILD-03): a cross-file reference still resolves --
// and the invariant that makes it safe is guarded, not merely claimed.
//
// ACME's default namespace is flat across every sourced file, so an
// unprefixed name defined in one file resolves from another -- measured live
// 2026-09-12, both forward and backward. That only holds because every name
// this exporter emits is globally unique (`setLabel()` refuses a name
// already bound to a different address, `anno-store.ts`) and carries no
// leading dot (`assertLegalAcmeIdentifier()`'s anchored pattern accepts
// none, so no emitted name is ever the kind of local label a `!zone`
// directive would scope) -- BOTH properties of OTHER modules. A test that
// only assembled a cross-file reference would rest on an unguarded claim,
// so the uniqueness refusal is asserted directly below.
// ---------------------------------------------------------------------------

/**
 * Two scopes, one code block each, each block's own `jsr` referencing the
 * OTHER block's entry label -- a genuine cross-file reference in BOTH
 * directions. Scope A (`$0801..$0804`) wholly contains block A; scope B
 * (`$0805..$0808`) wholly contains block B, immediately adjacent so no
 * filler bytes are needed.
 */
function crossFileRefFixture(tag: string): StoreFixture {
  return buildStore(freshDir(tag), {
    origin: 0x0801,
    // Block A ($0801..$0804): jsr $0805 (b_entry) / rts.
    // Block B ($0805..$0808): jsr $0801 (a_entry) / rts.
    body: [0x20, 0x05, 0x08, 0x60, 0x20, 0x01, 0x08, 0x60],
    ranges: [
      { start: 0x0801, endInclusive: 0x0804, dataType: "code" },
      { start: 0x0805, endInclusive: 0x0808, dataType: "code" },
    ],
    labels: [
      { address: 0x0801, name: "a_entry" },
      { address: 0x0805, name: "b_entry" },
    ],
    scopes: [
      { start: 0x0801, endInclusive: 0x0804 },
      { start: 0x0805, endInclusive: 0x0808 },
    ],
  });
}

test(
  "cross file: a jsr in the FIRST scope's file (sourced first) resolves to a label defined by a block in the SECOND scope's file",
  { skip: SKIP_REASON },
  async () => {
    const fixture = crossFileRefFixture("crossfile-forward");
    const outDir = join(fixture.dir, "tree");
    const result = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir });

    const scopeAText = readFileSync(join(outDir, scopeFileName(0x0801)), "utf8");
    assert.ok(scopeAText.includes("jsr b_entry"), `the forward reference must render through the symbol:\n${scopeAText}`);

    const response = await runHostTool({ tool: "acme.build", args: { source: ROOT_FILE_NAME, format: "plain", noReport: true } }, { repoRoot: outDir });
    assert.equal(response.ok, true, response.ok ? "" : response.message);
    if (!response.ok) return;
    assert.equal(response.exitStatus, 0, "a forward cross-file reference must assemble at exit 0");
    assert.equal(response.results.length, 1);
    const producedBytes = new Uint8Array(readFileSync(response.results[0]!.path));
    assert.deepEqual(producedBytes, result.expectedBytes, "the forward cross-file reference must reassemble byte-identically");
  },
);

test(
  "cross file: the mirror -- a jsr in the SECOND scope's file resolves to a label defined by a block in the FIRST scope's file",
  { skip: SKIP_REASON },
  async () => {
    const fixture = crossFileRefFixture("crossfile-backward");
    const outDir = join(fixture.dir, "tree");
    const result = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir });

    const scopeBText = readFileSync(join(outDir, scopeFileName(0x0805)), "utf8");
    assert.ok(scopeBText.includes("jsr a_entry"), `the backward reference must render through the symbol:\n${scopeBText}`);

    const response = await runHostTool({ tool: "acme.build", args: { source: ROOT_FILE_NAME, format: "plain", noReport: true } }, { repoRoot: outDir });
    assert.equal(response.ok, true, response.ok ? "" : response.message);
    if (!response.ok) return;
    assert.equal(response.exitStatus, 0, "a backward cross-file reference must assemble at exit 0");
    assert.equal(response.results.length, 1);
    const producedBytes = new Uint8Array(readFileSync(response.results[0]!.path));
    assert.deepEqual(producedBytes, result.expectedBytes, "the backward cross-file reference must reassemble byte-identically");
  },
);

test("cross file: non-vacuity -- the referring line and the target's own block really are in DIFFERENT emitted files", () => {
  const fixture = crossFileRefFixture("crossfile-non-vacuity");
  const outDir = join(fixture.dir, "tree");
  exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir });

  const scopeAText = readFileSync(join(outDir, scopeFileName(0x0801)), "utf8");
  const scopeBText = readFileSync(join(outDir, scopeFileName(0x0805)), "utf8");

  // A cross-file test where both halves landed in one file would prove
  // nothing and would pass -- so both directions are checked explicitly,
  // BEFORE either resolution test above is trusted.
  assert.ok(scopeAText.includes("jsr b_entry"), "the forward-referring jsr must be in scope A's file");
  assert.equal(scopeBText.includes("jsr b_entry"), false, "the forward-referring jsr must NOT also appear in scope B's file");
  assert.ok(scopeBText.includes("* = $0805"), "block B's own origin (the forward reference's TARGET) must be in scope B's file");
  assert.equal(scopeAText.includes("* = $0805"), false, "block B's origin must not appear in scope A's file");

  assert.ok(scopeBText.includes("jsr a_entry"), "the backward-referring jsr must be in scope B's file");
  assert.equal(scopeAText.includes("jsr a_entry"), false, "the backward-referring jsr must NOT also appear in scope A's file");
  assert.ok(scopeAText.includes("* = $0801"), "block A's own origin (the backward reference's TARGET) must be in scope A's file");
  assert.equal(scopeBText.includes("* = $0801"), false, "block A's origin must not appear in scope B's file");
});

test("cross file: PRECONDITION -- setLabel() refuses a second label name bound to a different address, the invariant the flat namespace rests on", () => {
  // If the store ever permits one name at two addresses, ACME's flat
  // namespace binds a cross-file reference to whichever definition it
  // reached LAST -- silently, at exit 0 -- and only a byte-diff would ever
  // notice. Asserted directly rather than left as a prose claim.
  const dir = freshDir("crossfile-precondition");
  const { storePath } = buildStore(dir, {
    origin: 0x0801,
    body: [...SHAPE_BODY],
    ranges: [{ start: 0x0801, endInclusive: 0x0806, dataType: "code" }],
    labels: [{ address: 0x0801, name: "shared_name" }],
  });

  const handle = openStore(storePath, { workspaceRoot: dir });
  try {
    assert.throws(
      () => setLabel(handle, { address: 0x0802, name: "shared_name", kind: "User" }),
      (e: unknown) => {
        assert.ok(e instanceof Error);
        assert.ok(e.message.includes("is already bound to address"), `setLabel() must refuse a name already bound elsewhere: ${e.message}`);
        return true;
      },
    );
  } finally {
    closeStore(handle);
  }
});

test("cross file: no ACME !zone directive appears in any emitted file of the tree", () => {
  const fixture = crossFileRefFixture("crossfile-no-zone");
  const outDir = join(fixture.dir, "tree");
  const result = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir });

  // D47-E: the flat namespace is a deliberate choice backed by a live
  // measurement, not an omission -- and a dot-prefixed local label, the
  // only name a `!zone` directive would scope, is impossible here because
  // `assertLegalAcmeIdentifier()`'s anchored pattern rejects a leading dot.
  for (const file of result.files.filter((name) => name.endsWith(".a"))) {
    const text = readFileSync(join(outDir, file), "utf8");
    const zoneLines = text.split("\n").filter((line) => line.trimStart().startsWith("!zone"));
    assert.deepEqual(zoneLines, [], `${file} must carry no !zone directive:\n${text}`);
  }
});

test("cross file: an auto-generated label name survives the split -- its symbols.a definition still carries the backlog marker", () => {
  const dir = freshDir("crossfile-automarker");
  const { storePath, imagePath } = buildStore(dir, {
    origin: 0x0801,
    body: [...SHAPE_BODY],
    ranges: [{ start: 0x0801, endInclusive: 0x0806, dataType: "code" }],
    // `s_` is one of AUTO_NAME_PREFIX_RE's eleven real typed prefixes.
    labels: [{ address: 0x0801, name: "s_0801" }],
  });
  assert.ok(AUTO_NAME_PREFIX_RE.test("s_0801"), "the fixture's own label name must actually match the auto-name vocabulary, or this test proves nothing");

  const outDir = join(dir, "tree");
  exportAsmTree({ storePath, imagePath, workspaceRoot: dir, outDir });

  const symbolsText = readFileSync(join(outDir, SYMBOLS_FILE_NAME), "utf8");
  const definitionLine = symbolsText.split("\n").find((line) => line.startsWith("s_0801 = "));
  assert.ok(definitionLine !== undefined, `symbols.a must carry the definition:\n${symbolsText}`);
  // `routine-queue-walker` reads this marker out of the generated artefact
  // to build its backlog queue -- a split that detached it would report a
  // backlog item as done.
  assert.ok(definitionLine!.includes("auto-generated name"), `the definition must still carry the backlog marker after the split:\n${definitionLine}`);
});

// ---------------------------------------------------------------------------
// Phase 47, plan 47-04 (BUILD-03): the zero-page encoding, measured in both
// directions -- criterion 5.
//
// The exporter's own mitigation for the zero-page-widening hazard is
// TWO-FOLD, and the two halves are why this section runs THREE assemblies
// rather than one: `disasm-renderer.ts` never substitutes a symbol into a
// zeropage-mode operand at all (D-11), so nothing this exporter emits ON
// ITS OWN is order-sensitive -- the hazard can only be exercised by hand,
// exactly as `PLANTED VIOLATION 2` above already does for the single-file
// case. The SECOND mitigation, sourcing `symbols.a` FIRST, is what this
// section actually measures: with a symbol hand-substituted into a
// zeropage-shaped reference (the artificial half every one of these tests
// shares), sourcing order alone decides whether ACME encodes it in TWO
// bytes or THREE.
//
// MEASURED live 2026-09-12, real ACME 0.97 "Zem": `zpf_90 = $90` substituted
// into `lda $90` and sourced FIRST assembles as `a5 90` (two bytes). Swap
// `root.a`'s two `!source` lines -- nothing else changed -- and the SAME
// source fails at exit 1 with the block-end drift `!error`, the bracket
// assertion catching exactly the hazard the sourcing order exists to
// prevent. Strip the block's own two `!if * != ...` assertions on top of
// that broken order (a second, deliberately UNSUPPORTED mutation, made only
// to see what the bracket was catching) and the same source assembles at
// exit 0, `lda zpf_90` widens to `ad 90 00` (three bytes), and ACME's own
// stderr carries `Using oversized addressing mode.` -- the widening made
// visible rather than merely caught.
// ---------------------------------------------------------------------------

/**
 * Exports `plantedFixture()`'s own store as a TREE and applies the named
 * mutations to the WRITTEN FILES, one at a time:
 *  - `substitute` -- turns the raw `lda $90` zeropage literal in
 *    `unscoped.a` into `lda zpf_90`, the substitution `disasm-renderer.ts`
 *    itself never performs (D-11) -- without it, sourcing order cannot
 *    matter at all, since nothing this exporter emits references the
 *    symbol at that operand.
 *  - `swap` -- rewrites `root.a` with its two `!source` lines in the
 *    OPPOSITE order (`unscoped.a` before `symbols.a`).
 *  - `stripBrackets` -- removes `unscoped.a`'s two `!if * != ...`
 *    assertions. Applied only alongside `swap`, and never a supported
 *    configuration on its own: it exists solely to make the widening the
 *    bracket normally catches visible instead.
 */
async function zeropageOrderTree(tag: string, mutations: { substitute?: boolean; swap?: boolean; stripBrackets?: boolean } = {}) {
  const { dir, storePath, imagePath } = plantedFixture(tag);
  const outDir = join(dir, "tree");
  const result = exportAsmTree({ storePath, imagePath, workspaceRoot: dir, outDir });

  if (mutations.substitute) {
    const before = readFileSync(join(outDir, UNSCOPED_FILE_NAME), "utf8");
    const after = before.replace("        lda $90", "        lda zpf_90");
    assert.notEqual(after, before, "the substitution must actually change unscoped.a, or this section tests nothing");
    writeFileSync(join(outDir, UNSCOPED_FILE_NAME), after, "utf8");
  }
  if (mutations.stripBrackets) {
    const before = readFileSync(join(outDir, UNSCOPED_FILE_NAME), "utf8");
    const after = before
      .split("\n")
      .filter((line) => !line.startsWith("!if * != "))
      .join("\n");
    assert.notEqual(after, before, "stripping the brackets must actually change unscoped.a");
    writeFileSync(join(outDir, UNSCOPED_FILE_NAME), after, "utf8");
  }
  if (mutations.swap) {
    const rootLines = readFileSync(join(outDir, ROOT_FILE_NAME), "utf8").split("\n");
    const symbolsLine = rootLines.find((l) => l.includes(`!source "${SYMBOLS_FILE_NAME}"`))!;
    const unscopedLine = rootLines.find((l) => l.includes(`!source "${UNSCOPED_FILE_NAME}"`))!;
    const swapped = rootLines.map((line) => {
      if (line === symbolsLine) return unscopedLine;
      if (line === unscopedLine) return symbolsLine;
      return line;
    });
    assert.notEqual(swapped.join("\n"), rootLines.join("\n"), "the swap must actually change root.a");
    writeFileSync(join(outDir, ROOT_FILE_NAME), swapped.join("\n"), "utf8");
  }

  const response = await runHostTool({ tool: "acme.build", args: { source: ROOT_FILE_NAME, format: "plain" } }, { repoRoot: outDir });
  return { result, outDir, response };
}

/**
 * The report listing's line for the instruction at `address` -- a
 * line-number column, then the 4-hex-digit address, then the assembled
 * bytes with NO separators, then the source text (measured against a real
 * ACME 0.97 `-r` listing, 2026-09-12). Returns the BYTE COLUMN only, or
 * `undefined` if no line for that address is present.
 */
function reportByteColumnAt(reportText: string, address: number): string | undefined {
  const addressHex = address.toString(16).padStart(4, "0");
  const re = new RegExp(`^\\s*\\d+\\s+${addressHex}\\s+([0-9a-f]+)\\s`);
  for (const line of reportText.split("\n")) {
    const m = re.exec(line);
    if (m) return m[1];
  }
  return undefined;
}

test(
  "zeropage order: the root sources symbols.a FIRST, and the report listing's line for that instruction shows the TWO-byte encoding",
  { skip: SKIP_REASON },
  async () => {
    const { result, outDir, response } = await zeropageOrderTree("zporder-correct", { substitute: true });

    assert.equal(response.ok, true, response.ok ? "" : response.message);
    if (!response.ok) return;
    assert.equal(response.exitStatus, 0, `the correctly-ordered tree must assemble:\n${response.stderrTail}`);
    const producedBytes = new Uint8Array(readFileSync(response.results[0]!.path));
    assert.deepEqual(producedBytes, result.expectedBytes, "substituting a symbol whose value equals the literal must not change the bytes");

    const reportText = readFileSync(join(outDir, "root.rep"), "utf8");
    assert.equal(
      reportByteColumnAt(reportText, 0x0803),
      "a590",
      `the zeropage reference must encode as TWO bytes when symbols.a is sourced first:\n${reportText}`,
    );
  },
);

test(
  "zeropage order: swapping root.a's two !source lines -- ONE documented mutation, nothing else changed -- makes the SAME reference assemble at a non-zero exit, caught by the block-end assertion",
  { skip: SKIP_REASON },
  async () => {
    const { response } = await zeropageOrderTree("zporder-swapped", { substitute: true, swap: true });

    assert.equal(response.ok, true, response.ok ? "" : response.message);
    if (!response.ok) return;
    assert.notEqual(response.exitStatus, 0, "the broken order must make real ACME refuse");
    assert.ok(response.stderrTail.includes("block end drifted"), `the block-end assertion's own message must be what caught it:\n${response.stderrTail}`);
  },
);

test(
  "zeropage order: stripping the block's own bracket assertions on top of the broken order -- a SECOND, deliberately unsupported mutation -- lets the widening through, visibly",
  { skip: SKIP_REASON },
  async () => {
    const { outDir, response } = await zeropageOrderTree("zporder-stripped", { substitute: true, swap: true, stripBrackets: true });

    assert.equal(response.ok, true, response.ok ? "" : response.message);
    if (!response.ok) return;
    assert.equal(response.exitStatus, 0, `with no bracket left to catch it, the widened source must still assemble:\n${response.stderrTail}`);
    assert.ok(
      response.stderrTail.includes("Using oversized addressing mode."),
      `ACME's own oversized-addressing warning must be present -- the widening, made visible rather than merely caught:\n${response.stderrTail}`,
    );

    const reportText = readFileSync(join(outDir, "root.rep"), "utf8");
    assert.equal(
      reportByteColumnAt(reportText, 0x0803),
      "ad9000",
      `with the brackets stripped and the definition sourced AFTER first use, the SAME reference must widen to THREE bytes:\n${reportText}`,
    );
  },
);

test(
  "zeropage order: non-vacuity -- the correct-order and stripped-bracket report listings really do differ on that instruction's line",
  { skip: SKIP_REASON },
  async () => {
    const correct = await zeropageOrderTree("zporder-nonvacuity-correct", { substitute: true });
    const stripped = await zeropageOrderTree("zporder-nonvacuity-stripped", { substitute: true, swap: true, stripBrackets: true });

    const correctReport = readFileSync(join(correct.outDir, "root.rep"), "utf8");
    const strippedReport = readFileSync(join(stripped.outDir, "root.rep"), "utf8");

    const correctBytes = reportByteColumnAt(correctReport, 0x0803);
    const strippedBytes = reportByteColumnAt(strippedReport, 0x0803);
    assert.notEqual(
      strippedBytes,
      correctBytes,
      "a control that shows the SAME encoding in both runs would pass while proving nothing -- the two byte columns must genuinely differ",
    );
  },
);

test("zeropage order: symbols.a is first in sourceOrder, and first among root.a's own !source lines -- a property of the generator, not one fixture", () => {
  const { dir, storePath, imagePath } = plantedFixture("zporder-property");
  const outDir = join(dir, "tree");
  const result = exportAsmTree({ storePath, imagePath, workspaceRoot: dir, outDir });

  assert.equal(result.sourceOrder[0], SYMBOLS_FILE_NAME, "sourceOrder's own first entry must be symbols.a");

  const rootText = readFileSync(join(outDir, ROOT_FILE_NAME), "utf8");
  const sourceLines = rootText.split("\n").filter((line) => line.startsWith("!source "));
  assert.equal(sourceLines[0], `!source "${SYMBOLS_FILE_NAME}"`, `root.a's own first !source line must name symbols.a:\n${rootText}`);
});

// ---------------------------------------------------------------------------
// Phase 47, plan 47-06 (BUILD-03): split hi/lo ADDRESS tables get paired
// low-byte/high-byte symbol references, never per-half symbolisation, through
// the SAME in-tree symbol rule plan 47-04 built for the instruction path. The
// two split WORD layouts are deliberately excluded -- the store's own
// vocabulary distinguishes the address forms (which produce
// cross-references) from the word forms (which do not).
//
// MEASURED live 2026-09-12, real ACME 0.97 "Zem": `routine_a rts` / `routine_b
// rts` at $0801/$0802, followed by `tbl_lo !byte <routine_a, <routine_b` /
// `tbl_hi !byte >routine_a, >routine_b`, assembled at exit 0 to `60 60 01 02
// 08 08` -- byte-identical to what the raw octets would have been. Every
// `splitAddressFixture()`-based test below reuses this exact shape.
// ---------------------------------------------------------------------------

/**
 * Two labelled one-byte `rts` routines at $0801/$0802, plus a `lo_hi_address`
 * or `hi_lo_address` table over them -- the plan's own measured ACME fixture,
 * reused as the shape every `split table:` test in Task 1 builds on. Body:
 * `60 60` (the two routines) followed by the table's four bytes, in the
 * layout's own physical order.
 */
function splitAddressFixture(tag: string, dataType: "lo_hi_address" | "hi_lo_address"): StoreFixture {
  const lowBytes = [0x01, 0x02]; // <routine_a, <routine_b
  const highBytes = [0x08, 0x08]; // >routine_a, >routine_b
  const tableBody = dataType === "lo_hi_address" ? [...lowBytes, ...highBytes] : [...highBytes, ...lowBytes];
  return buildStore(freshDir(tag), {
    origin: 0x0801,
    body: [0x60, 0x60, ...tableBody],
    ranges: [
      { start: 0x0801, endInclusive: 0x0802, dataType: "code" },
      { start: 0x0803, endInclusive: 0x0806, dataType },
    ],
    labels: [
      { address: 0x0801, name: "routine_a" },
      { address: 0x0802, name: "routine_b" },
    ],
  });
}

test("split table: a `lo_hi_address` range emits paired low-byte/high-byte symbol references, low halves first, then high halves, with no raw hex byte among the resolved entries", () => {
  const { dir, storePath, imagePath } = splitAddressFixture("split-lohi-shape", "lo_hi_address");
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  assert.ok(
    result.source.includes("!byte <routine_a, <routine_b"),
    `the low halves must render through ACME's low-byte operator over the SAME symbol:\n${result.source}`,
  );
  assert.ok(
    result.source.includes("!byte >routine_a, >routine_b"),
    `the high halves must render through ACME's high-byte operator over the SAME symbol:\n${result.source}`,
  );

  const lowIndex = result.source.indexOf("!byte <routine_a");
  const highIndex = result.source.indexOf("!byte >routine_a");
  assert.ok(lowIndex >= 0 && highIndex > lowIndex, `lo_hi_address must emit the LOW halves BEFORE the HIGH halves:\n${result.source}`);

  const tableLines = result.source.split("\n").filter((line) => line.includes("lo_hi_address"));
  assert.ok(tableLines.length > 0, "precondition: the table must actually emit lines carrying its own type name, or this test proves nothing");
  for (const line of tableLines) {
    assert.equal(/\$[0-9a-f]{2}\b/i.test(line), false, `no raw hex byte may appear among the resolved split-address entries:\n${line}`);
  }
});

test(
  "split table: a `lo_hi_address` range assembles through runHostTool() at exitStatus 0 with bytes deepEqual expectedBytes -- the operators are byte-identical to the octets they replaced",
  { skip: SKIP_REASON },
  async () => {
    const { dir, storePath, imagePath } = splitAddressFixture("split-lohi-roundtrip", "lo_hi_address");
    const outDir = join(dir, "tree");
    const result = exportAsmTree({ storePath, imagePath, workspaceRoot: dir, outDir });

    const response = await runHostTool({ tool: "acme.build", args: { source: ROOT_FILE_NAME, format: "plain", noReport: true } }, { repoRoot: outDir });
    assert.equal(response.ok, true, response.ok ? "" : response.message);
    if (!response.ok) return;
    assert.equal(response.exitStatus, 0, "a paired-symbol split-address table must assemble cleanly");
    assert.equal(response.results.length, 1);
    const producedBytes = new Uint8Array(readFileSync(response.results[0]!.path));
    assert.deepEqual(producedBytes, result.expectedBytes, "the produced bytes must be octet-identical to bytes taken from the image");
  },
);

test(
  "split table: a `hi_lo_address` range emits the HIGH halves first, matching the store's own documented byte order, and also reassembles byte-identically",
  { skip: SKIP_REASON },
  async () => {
    const { dir, storePath, imagePath } = splitAddressFixture("split-hilo-shape", "hi_lo_address");
    const outDir = join(dir, "tree");
    const result = exportAsmTree({ storePath, imagePath, workspaceRoot: dir, outDir });

    assert.ok(result.source.includes("!byte >routine_a, >routine_b"), `the high halves must still render through the symbol:\n${result.source}`);
    assert.ok(result.source.includes("!byte <routine_a, <routine_b"), `the low halves must still render through the SAME symbol:\n${result.source}`);
    const highIndex = result.source.indexOf("!byte >routine_a");
    const lowIndex = result.source.indexOf("!byte <routine_a");
    assert.ok(highIndex >= 0 && lowIndex > highIndex, `hi_lo_address must emit the HIGH halves BEFORE the LOW halves:\n${result.source}`);

    const response = await runHostTool({ tool: "acme.build", args: { source: ROOT_FILE_NAME, format: "plain", noReport: true } }, { repoRoot: outDir });
    assert.equal(response.ok, true, response.ok ? "" : response.message);
    if (!response.ok) return;
    assert.equal(response.exitStatus, 0, "a hi_lo_address paired-symbol table must assemble cleanly");
    assert.equal(response.results.length, 1);
    const producedBytes = new Uint8Array(readFileSync(response.results[0]!.path));
    assert.deepEqual(producedBytes, result.expectedBytes, "the produced bytes must be octet-identical to bytes taken from the image");
  },
);

/** One `lo_hi_address` entry targeting $d020 (the VIC-II border-colour
 * register) -- well outside any emitted block. Low byte $20, high byte $d0. */
function splitAddressOutOfTreeFixture(tag: string): StoreFixture {
  return buildStore(freshDir(tag), {
    origin: 0x0801,
    body: [0x20, 0xd0],
    ranges: [{ start: 0x0801, endInclusive: 0x0802, dataType: "lo_hi_address" }],
    labels: [],
  });
}

test(
  "split table: an entry whose composed target lies OUTSIDE every emitted block keeps its raw byte value in both halves and is not a refusal",
  { skip: SKIP_REASON },
  () => {
    const { dir, storePath, imagePath } = splitAddressOutOfTreeFixture("split-outoftree");
    const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

    assert.ok(result.source.includes("!byte $20"), `the low half must keep its raw byte for an out-of-tree target:\n${result.source}`);
    assert.ok(result.source.includes("!byte $d0"), `the high half must keep its raw byte for an out-of-tree target:\n${result.source}`);

    const verdict = verifyExport(result);
    assert.equal(verdict.outcome, "ok", `an out-of-tree split-address entry must not be refused, and must still round-trip:${context(result, verdict)}`);
    assert.equal(verdict.byteDiff?.equal, true, `the byte-diff IS the verdict:${context(result, verdict)}`);
  },
);

/** A one-byte routine at $0801 with NO label, targeted by a `lo_hi_address`
 * table's one entry -- in-tree and unresolved. */
function splitAddressUnresolvedFixture(tag: string): StoreFixture {
  return buildStore(freshDir(tag), {
    origin: 0x0801,
    body: [0x60, 0x01, 0x08],
    ranges: [
      { start: 0x0801, endInclusive: 0x0801, dataType: "code" },
      { start: 0x0802, endInclusive: 0x0803, dataType: "lo_hi_address" },
    ],
    labels: [],
  });
}

test(
  "split table: an entry whose composed target lies INSIDE an emitted block with no label there refuses by name, through the same end-of-export refusal the instruction path uses",
  () => {
    const { dir, storePath, imagePath } = splitAddressUnresolvedFixture("split-unresolved");

    assert.throws(
      () => exportAsm({ storePath, imagePath, workspaceRoot: dir }),
      (e: unknown) => {
        assert.ok(e instanceof Error);
        assert.match(e.message, /^exportAsm: /, "every refusal from this module is prefixed `exportAsm:`");
        assert.ok(e.message.includes("$0801"), `the refusal must name the TARGET address: ${e.message}`);
        assert.ok(e.message.includes("1 of 1"), `the refusal must state the count: ${e.message}`);
        return true;
      },
    );
  },
);

test("split table: an unresolved split-address entry and an unresolved instruction reference are BOTH reported by the SAME refusal in one run", () => {
  const { dir, storePath, imagePath } = buildStore(freshDir("split-unresolved-combined"), {
    origin: 0x0801,
    // jsr $0805 (INSTRUCTION reference, no label at $0805 -- inside the
    // table block below) / rts. Table entry ($0805..$0806) targets $0801
    // (DATA reference, no label there either) -- both kinds, one export.
    body: [0x20, 0x05, 0x08, 0x60, 0x01, 0x08],
    ranges: [
      { start: 0x0801, endInclusive: 0x0804, dataType: "code" },
      { start: 0x0805, endInclusive: 0x0806, dataType: "lo_hi_address" },
    ],
    labels: [],
  });

  assert.throws(
    () => exportAsm({ storePath, imagePath, workspaceRoot: dir }),
    (e: unknown) => {
      assert.ok(e instanceof Error);
      assert.ok(
        e.message.includes("2 of 2"),
        `both the instruction reference and the data reference must feed the SAME collection -- never only one kind: ${e.message}`,
      );
      return true;
    },
  );
});

test(
  "split table: a `lo_hi_word` range still emits raw bytes and is never symbolised, and neither is `hi_lo_word` -- the address/word boundary asserted in both directions",
  () => {
    for (const dataType of ["lo_hi_word", "hi_lo_word"] as const) {
      const { dir, storePath, imagePath } = buildStore(freshDir(`split-word-${dataType}`), {
        origin: 0x0801,
        // The identical bytes a labelled-target lo_hi_address table above
        // uses -- if this type were ever symbolised by mistake, it would
        // render exactly like those tests. It must not.
        body: [0x60, 0x60, 0x01, 0x02, 0x08, 0x08],
        ranges: [
          { start: 0x0801, endInclusive: 0x0802, dataType: "code" },
          { start: 0x0803, endInclusive: 0x0806, dataType },
        ],
        labels: [
          { address: 0x0801, name: "routine_a" },
          { address: 0x0802, name: "routine_b" },
        ],
      });
      const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

      assert.equal(result.source.includes("<routine_a"), false, `${dataType} must never render ACME's low-byte operator:\n${result.source}`);
      assert.equal(result.source.includes(">routine_a"), false, `${dataType} must never render ACME's high-byte operator:\n${result.source}`);
      assert.ok(result.source.includes(`; ${dataType}`), `${dataType} must still be named verbatim on its emitted line(s):\n${result.source}`);
    }
  },
);

test("split table: exactly one symbol is consulted per entry -- the low half and the high half of one entry always name the SAME symbol", () => {
  const { dir, storePath, imagePath } = splitAddressFixture("split-one-symbol-per-entry", "lo_hi_address");
  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

  const lowNames = [...result.source.matchAll(/<([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]!);
  const highNames = [...result.source.matchAll(/>([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]!);
  assert.equal(lowNames.length, 2, `both entries' low halves must resolve through a symbol:\n${result.source}`);
  assert.deepEqual(lowNames, highNames, `entry i's low half and high half must name the SAME symbol, in the same order -- never one per half:\n${result.source}`);
});

test("split table: `result.dataByteCount` is unchanged by the symbolisation -- the same total the raw emission produced for the same extent", () => {
  const splitFixture = splitAddressFixture("split-databytecount-split", "lo_hi_address");
  const splitResult = exportAsm({ storePath: splitFixture.storePath, imagePath: splitFixture.imagePath, workspaceRoot: splitFixture.dir });

  const byteFixture = buildStore(freshDir("split-databytecount-byte"), {
    origin: 0x0801,
    body: [0x60, 0x60, 0x01, 0x02, 0x08, 0x08],
    ranges: [
      { start: 0x0801, endInclusive: 0x0802, dataType: "code" },
      { start: 0x0803, endInclusive: 0x0806, dataType: "byte" },
    ],
    labels: [],
  });
  const byteResult = exportAsm({ storePath: byteFixture.storePath, imagePath: byteFixture.imagePath, workspaceRoot: byteFixture.dir });

  assert.equal(
    splitResult.dataByteCount,
    byteResult.dataByteCount,
    "symbolising the split-address entries must not change how many bytes went out through the data path",
  );
  assert.equal(splitResult.dataByteCount, 4, "the table's four bytes went out through the data path");
});

// ---------------------------------------------------------------------------
// Phase 47, plan 47-06, Task 2: the two halves are inseparable BY THIS
// EXPORTER -- asserted directly rather than assumed. One store range is one
// `ExportBlock` (`sortedRanges.map()`), so a split table's low half and high
// half always land in the SAME emitted file; and a relocated target's symbol
// carries both halves to their new value together, never one alone.
//
// The adversarial control that deliberately moves ONE half and proves a gate
// catches it belongs to Phase 49 by the ROADMAP note's own words -- this
// section proves the emitter cannot separate the halves in the first place,
// which is what that later gate will be built on top of. Its absence here is
// a boundary, not an oversight.
// ---------------------------------------------------------------------------

test("split table: a `lo_hi_address` range yields exactly ONE ExportBlock, and both its half line groups land in the SAME emitted file", () => {
  const fixture = splitAddressFixture("split-oneblock-onefile", "lo_hi_address");
  const outDir = join(fixture.dir, "tree");
  const result = exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir });

  // Link 1: one store row -> one ExportBlock. Not merely trusted --
  // `sortedRanges.map()` is what makes this true, and a future change that
  // ever split one range across two blocks would red HERE first.
  const tableBlocks = result.blocks.filter((b) => b.dataType === "lo_hi_address");
  assert.equal(tableBlocks.length, 1, "a split range is ONE store row, so it must produce exactly one ExportBlock");

  // Link 2: that one block's lines land in exactly one tree file.
  const treeFileNames = readdirSync(outDir).filter((name) => name.endsWith(".a"));
  const filesCarryingOrigin = treeFileNames.filter((name) => readFileSync(join(outDir, name), "utf8").includes(tableBlocks[0]!.lines[0]!));
  assert.equal(filesCarryingOrigin.length, 1, "the table block's own origin line must appear in exactly one tree .a file");

  // Link 3: BOTH half line groups are inside that SAME file -- the
  // move-together property stated directly, not derived from Link 2 alone.
  const text = readFileSync(join(outDir, filesCarryingOrigin[0]!), "utf8");
  assert.ok(text.includes("<routine_a, <routine_b"), `the low-half line must be in the SAME file as the table block's origin:\n${text}`);
  assert.ok(text.includes(">routine_a, >routine_b"), `the high-half line must be in the SAME file as the table block's origin:\n${text}`);
});

/** A one-byte `rts` routine named `routine_a`, immediately followed by a
 * 2-byte `lo_hi_address` table with its one entry pointing at it -- built at
 * `routineAddress` as the image's own ORIGIN, so "moving the routine" is
 * simply choosing a different `routineAddress` and letting the table's own
 * bytes (derived from it) follow. Every `split table: relocation` test below
 * builds two of these -- one "before", one "after" -- and never mutates one
 * in place, since the routine's own code bytes never move in a real image;
 * what moves is which address holds it. */
function relocationFixture(tag: string, routineAddress: number, dataType: "lo_hi_address" | "hi_lo_address" = "lo_hi_address"): StoreFixture {
  const low = routineAddress & 0xff;
  const high = (routineAddress >> 8) & 0xff;
  const tableBody = dataType === "lo_hi_address" ? [low, high] : [high, low];
  return buildStore(freshDir(tag), {
    origin: routineAddress,
    body: [0x60, ...tableBody],
    ranges: [
      { start: routineAddress, endInclusive: routineAddress, dataType: "code" },
      { start: routineAddress + 1, endInclusive: routineAddress + 2, dataType },
    ],
    labels: [{ address: routineAddress, name: "routine_a" }],
  });
}

/** Exports a "before" tree with `routine_a` at $0801 and an "after" tree with
 * it at $0942 -- chosen so BOTH the low byte ($01 -> $42) and the high byte
 * ($08 -> $09) genuinely differ, never a move that only changes one -- and
 * returns each tree's own table bytes, sliced from `result.expectedBytes` at
 * the table block's own position. Called once per test below under its own
 * tag, never a shared mutable fixture two tests could interfere through.
 * `exportAsmTree()` itself is synchronous; this stays synchronous too so the
 * two structural assertions below need no `await`, while the round-trip test
 * awaits `runHostTool()` separately over this same shape. */
function runRelocationDemo(tag: string) {
  const before = relocationFixture(`${tag}-before`, 0x0801);
  const beforeOutDir = join(before.dir, "tree");
  const beforeResult = exportAsmTree({ storePath: before.storePath, imagePath: before.imagePath, workspaceRoot: before.dir, outDir: beforeOutDir });

  const after = relocationFixture(`${tag}-after`, 0x0942);
  const afterOutDir = join(after.dir, "tree");
  const afterResult = exportAsmTree({ storePath: after.storePath, imagePath: after.imagePath, workspaceRoot: after.dir, outDir: afterOutDir });

  const beforeTableBlock = beforeResult.blocks.find((b) => b.dataType === "lo_hi_address")!;
  const afterTableBlock = afterResult.blocks.find((b) => b.dataType === "lo_hi_address")!;
  const beforeMin = beforeResult.blocks[0]!.start;
  const afterMin = afterResult.blocks[0]!.start;
  const beforeTableBytes = beforeResult.expectedBytes.slice(beforeTableBlock.start - beforeMin, beforeTableBlock.endExclusive - beforeMin);
  const afterTableBytes = afterResult.expectedBytes.slice(afterTableBlock.start - afterMin, afterTableBlock.endExclusive - afterMin);

  return { before, beforeOutDir, beforeResult, beforeTableBytes, after, afterOutDir, afterResult, afterTableBytes };
}

test("split table: non-vacuity for the relocation demonstration -- the two exports' table bytes really do differ", () => {
  const { beforeTableBytes, afterTableBytes } = runRelocationDemo("split-reloc-nonvacuity");
  assert.notDeepEqual(
    [...beforeTableBytes],
    [...afterTableBytes],
    "a no-op move must not be able to pass the together-ness assertion below -- the table bytes must genuinely differ between the two exports",
  );
});

test(
  "split table: relocation -- moving the target routine changes BOTH halves of the affected entry together, never one alone",
  () => {
    // This proves the emitter CANNOT separate the halves: the same emitted
    // symbol reference (`<routine_a`/`>routine_a`, unchanged text in both
    // trees) resolves to wherever `routine_a` currently is, so relocating it
    // moves both bytes at once. The adversarial control that deliberately
    // moves ONE half and proves a gate catches it belongs to Phase 49 by the
    // ROADMAP note's own assignment -- its absence here is a boundary this
    // section is built to hand off to, not a gap in this plan.
    const { beforeTableBytes, afterTableBytes } = runRelocationDemo("split-reloc-together");
    assert.notEqual(beforeTableBytes[0], afterTableBytes[0], "the LOW half must change when the routine moves");
    assert.notEqual(beforeTableBytes[1], afterTableBytes[1], "the HIGH half must change when the routine moves");
  },
);

test(
  "split table: relocation -- the moved tree reassembles at exitStatus 0 with bytes deepEqual its own new expectedBytes",
  { skip: SKIP_REASON },
  async () => {
    const { after, afterOutDir, afterResult } = runRelocationDemo("split-reloc-roundtrip");
    const response = await runHostTool({ tool: "acme.build", args: { source: ROOT_FILE_NAME, format: "plain", noReport: true } }, { repoRoot: afterOutDir });
    assert.equal(response.ok, true, response.ok ? "" : response.message);
    if (!response.ok) return;
    assert.equal(response.exitStatus, 0, "the relocated tree must still assemble cleanly");
    assert.equal(response.results.length, 1);
    const producedBytes = new Uint8Array(readFileSync(response.results[0]!.path));
    assert.deepEqual(producedBytes, afterResult.expectedBytes, "the produced bytes must be octet-identical to bytes taken from the moved image");
    assert.ok(after.storePath.length > 0, "precondition: the 'after' fixture must actually exist");
  },
);

function splitAddressBoundaryCrossingFixture(tag: string): StoreFixture {
  return buildStore(freshDir(tag), {
    origin: 0x0801,
    body: [0xc7, 0x02, 0x03, 0x04, 0x05, 0x06],
    ranges: [{ start: 0x0803, endInclusive: 0x0806, dataType: "lo_hi_address" }],
    scopes: [{ start: 0x0801, endInclusive: 0x0804 }],
  });
}

test("split table: a split range crossing a scope boundary gets the ORDINARY boundary-crossing refusal, with no special case for the table", () => {
  const fixture = splitAddressBoundaryCrossingFixture("split-boundary-crossing");
  const outDir = join(fixture.dir, "tree");
  mkdirSync(outDir, { recursive: true });

  assert.throws(
    () => exportAsmTree({ storePath: fixture.storePath, imagePath: fixture.imagePath, workspaceRoot: fixture.dir, outDir }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /\$0803\.\.\$0806/, `the message must name the range's extent: ${err.message}`);
      assert.match(err.message, /\$0801\.\.\$0804/, `the message must name the scope's extent: ${err.message}`);
      assert.match(err.message, /wholly contained/, `the message must state the containment rule that was violated -- the table gets no exemption: ${err.message}`);
      return true;
    },
  );

  assert.deepEqual(readdirSync(outDir), [], "the output directory must still be empty after a refusal -- nothing was written before the throw");
});
