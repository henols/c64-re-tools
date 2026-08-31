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
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ACME_BIN, acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./acme-gate.ts";
import { ACME_VERIFY_ARGV_FLAGS, parseAcmeDiagnostics, verifyAcmeAssembles, type AcmeVerifyResult } from "./acme-verify.ts";
import { assertDataTypeForExport, assertExportableCommentText, exportAsm, substituteImmediateEnum, type ExportAsmResult } from "./anno-export-asm.ts";
import { AUTO_NAME_PREFIX_RE } from "./anno-coverage.ts";
import { applyEnumUsage, createProjectEnum, openStore, closeStore, listComments, listLabels, setComment, setDataType, setLabel } from "./anno-store.ts";
import { AnnoCommentError, DATA_TYPES } from "./anno-types.ts";
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
    labels: [],
  });

  const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
  const lines = result.source.split("\n");

  const originAssert = lines.findIndex((l) => l.startsWith("!if * != ") && l.includes("block origin drifted"));
  const endAssert = lines.findIndex((l) => l.startsWith("!if * != ") && l.includes("block end drifted"));
  assert.ok(originAssert >= 0 && endAssert > originAssert, `the block must be bracketed:\n${result.source}`);
  const content = lines.slice(originAssert + 1, endAssert);
  assert.equal(content.length, 256, "one emitted line per opcode -- no labels and no comments are in this store, so the mapping is one-to-one");

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
