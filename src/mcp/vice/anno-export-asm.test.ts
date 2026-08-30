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
//   - Never treat an ACME stderr WARNING as a failure. ACME 0.97 emits
//     `Warning (Zone <untitled>): Wrong type - expected address.` and
//     `Using oversized addressing mode.` on legal, byte-correct output at exit
//     0. A positive case here is proved by `outcome === "ok"` with
//     `byteDiff.equal === true`, never by an exit status.
//   - Never call `verifyAcmeAssembles()` anywhere but inside `verifyExport()`.
//     That helper always supplies the REQUIRED `expectedSegments`, so the
//     unanimity rule against ACME's own per-segment lines has exactly one
//     place to be right and cannot be dropped from a later test by omission.
//   - Never interpolate a source string into a shell command. `assembleRaw()`
//     writes it to a file and spawns ACME with an argv array.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ACME_BIN, acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./acme-gate.ts";
import { ACME_VERIFY_ARGV_FLAGS, verifyAcmeAssembles, type AcmeVerifyResult } from "./acme-verify.ts";
import { exportAsm, type ExportAsmResult } from "./anno-export-asm.ts";
import { openStore, closeStore, setDataType, setLabel, setComment } from "./anno-store.ts";

/** Computed exactly once, by the shared seam. Every ACME-dependent test in
 * this file passes this through node:test's own `{ skip }` option. */
const SKIP_REASON: string | false = acmeSkipReasonFor("anno-export-asm.test.ts");

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
 * A test that wants a DELIBERATELY mismatched segment list passes it
 * explicitly at its own call site rather than editing this helper -- widening
 * the one correct call is how the rule stops being run everywhere.
 */
function verifyExport(result: ExportAsmResult): AcmeVerifyResult {
  return verifyAcmeAssembles({
    source: result.source,
    expectedBytes: result.expectedBytes,
    expectedSegments: result.blocks,
  });
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

  assert.ok(
    lines.includes("zpf_90 = $90"),
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
  const planted = result.source
    .replace("zpf_90 = $90\n", "")
    .replace("        lda $90", "        lda zpf_90")
    .replace("        rts\n", "        rts\nzpf_90 = $90\n");
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
  const moveOnly = result.source.replace("zpf_90 = $90\n", "").replace("        rts\n", "        rts\nzpf_90 = $90\n");
  const survived = assembleRaw(moveOnly);
  assert.equal(survived.status, 0, `the move alone must NOT fire -- the \`+2\` force already holds the width:\n  stderr: ${survived.stderr}`);
  assert.equal(survived.outputExists, true, "the move alone still produces an output file");
});
