#!/usr/bin/env node
// ghidra-opcode-live.test.ts
//
// Phase 36, plan 36-04 (OPC-04): OPT-IN, MANUAL-ONLY. The language half of
// this phase's live suite, alongside `ghidra-live.test.ts` (the harness
// half) -- landed together, in ONE commit, as this project's ELEVENTH and
// TWELFTH `MANUAL_ONLY_TESTS` entries, so the volatile-carve work and the
// opcode work can each expand this file/that file in parallel next wave
// against disjoint files.
//
// SAME header shape and SAME `SKIP_REASON` computation as
// `ghidra-live.test.ts` -- duplicated here rather than imported (a small
// duplicate is cheaper than a shared production module for one function).
// DEFAULT-SKIP IS MANDATORY: `npm test` globs this file, and no CI runner
// has a Ghidra installation. Every case passes `SKIP_REASON` through
// node:test's own `{ skip }` option, never a hand-rolled early return.
//
// Opt in with:
//   GHIDRA_HOME=/path/to/ghidra VICE_LIVE_GHIDRA=1 node --test ghidra-opcode-live.test.ts
//
// This plan seeds ONE real case: the failing direction for OPC-04's
// criterion 1 (promoted from plan 36-01's own manual command) -- the SAME
// image run under the stock language and under the new language must name
// TWO DIFFERENT languages in their own run logs, asserted by BYTE-EXACT
// comparison. Later plans in this phase (36-06, opcode sweep) expand this
// file with OPC-01/OPC-02/OPC-03's own live cases.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runGhidraAnalyze } from "./ghidra-run.ts";
import { installedLanguageIds } from "./ghidra-project.mts";
import { repoRoot } from "./repo-root.ts";
import { listEntries, extractEntry } from "./anno-d64.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(HERE, "fixtures", "ghidra");
const SCRIPTS_DIR = join(HERE, "vendor", "ghidra-scripts");

/** The new language this phase adds (36-01) and the stock language it must
 * never collide with -- byte-exact, case-sensitive comparisons throughout. */
const NMOS_LANGUAGE_ID = "6502:LE:16:nmos";
const DEFAULT_LANGUAGE_ID = "6502:LE:16:default";

/** Computed exactly once, from three conditions in order -- duplicated
 * (never imported) from ghidra-live.test.ts's own identically-named
 * function: two short duplicates are cheaper than raising this module's
 * floor for one shared helper. */
function computeGhidraSkipReason(): string | false {
  if (process.env.VICE_LIVE_GHIDRA !== "1") {
    return (
      "ghidra-opcode-live.test.ts is opt-in and default-skipped -- set VICE_LIVE_GHIDRA=1 to run it " +
      `(requires GHIDRA_HOME pointing at a real Ghidra installation with "${NMOS_LANGUAGE_ID}" installed).`
    );
  }
  const ghidraHome = process.env.GHIDRA_HOME;
  if (ghidraHome === undefined || ghidraHome === "") {
    return "VICE_LIVE_GHIDRA=1 but GHIDRA_HOME is unset -- set it to a Ghidra installation directory to run this file.";
  }
  const analyzeHeadlessPath = join(ghidraHome, "support", "analyzeHeadless");
  if (!existsSync(analyzeHeadlessPath)) {
    return `VICE_LIVE_GHIDRA=1 but GHIDRA_HOME's resolved "support/analyzeHeadless" does not exist at ${analyzeHeadlessPath} -- point GHIDRA_HOME at a real Ghidra installation.`;
  }
  const installed = installedLanguageIds(ghidraHome);
  const matched = installed.find((lang) => lang.id === NMOS_LANGUAGE_ID);
  if (matched === undefined || !matched.slafileExists) {
    return (
      `VICE_LIVE_GHIDRA=1 and GHIDRA_HOME is set, but the language "${NMOS_LANGUAGE_ID}" is not installed with an ` +
      `existing compiled language file -- run ghidra.installExtension to build it.`
    );
  }
  return false;
}

const SKIP_REASON: string | false = computeGhidraSkipReason();

interface ScratchWorkspace {
  root: string;
}

/** Duplicated from ghidra-live.test.ts's own identically-shaped helper --
 * see that file's header for the "why a duplicate, not a shared module"
 * rationale. */
function makeScratchWorkspace(): ScratchWorkspace {
  const root = mkdtempSync(join(tmpdir(), "ghidra-opcode-live-"));
  cpSync(SCRIPTS_DIR, join(root, "vendor", "ghidra-scripts"), { recursive: true });
  cpSync(join(FIXTURES_DIR, "bank.prg"), join(root, "bank.prg"));
  return { root };
}

function removeScratchWorkspace(ws: ScratchWorkspace): void {
  rmSync(ws.root, { recursive: true, force: true });
}

test(
  "ghidra-opcode-live SEED: the same image under 6502:LE:16:default and 6502:LE:16:nmos names two different languages in their own run logs",
  { skip: SKIP_REASON },
  async () => {
    const ws = makeScratchWorkspace();
    try {
      const defaultResult = await runGhidraAnalyze(
        { runId: "seed-default", importPath: "bank.prg", processor: DEFAULT_LANGUAGE_ID, importRoute: "prg", noanalysis: true },
        { repoRoot: ws.root },
      );
      const nmosResult = await runGhidraAnalyze(
        { runId: "seed-nmos", importPath: "bank.prg", processor: NMOS_LANGUAGE_ID, importRoute: "prg", noanalysis: true },
        { repoRoot: ws.root },
      );

      assert.equal(defaultResult.language.present, true, "the stock-language run's log must carry a Using Language/Compiler: line");
      assert.equal(nmosResult.language.present, true, "the new-language run's log must carry a Using Language/Compiler: line");
      if (defaultResult.language.present && nmosResult.language.present) {
        assert.equal(defaultResult.language.id, DEFAULT_LANGUAGE_ID, "the stock run must name the stock language, byte-exactly");
        assert.equal(nmosResult.language.id, NMOS_LANGUAGE_ID, "the new-language run must name the new language, byte-exactly");
        // Byte-exact comparison, never case-folded: both the positive
        // (notEqual) and the explicit boolean-equality form below, so a
        // future case-insensitive regression in either parse site would be
        // caught by the second assertion even if the first somehow was not.
        assert.notEqual(defaultResult.language.id, nmosResult.language.id, "the two runs must name two DIFFERENT languages");
        assert.equal((defaultResult.language.id as string) === (nmosResult.language.id as string), false);
      }
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);

// ---------------------------------------------------------------------------
// Plan 36-06 (OPC-01, OPC-02, OPC-04): the opcode sweep. All 105 undocumented
// bytes decode as code under `6502:LE:16:nmos`, the SAME assertion is
// observed FAILING under `6502:LE:16:default` (criterion 1's second half --
// this plan's own must_haves.key_links names plan 36-01's evidence file as
// criterion 1's FIRST half), the six electrically-unstable/page-crossing
// bytes decode to a form naming their own opaque operation rather than
// plausible arithmetic (OPC-02), and the 15 bytes the stock 65C02 language
// also claims keep ITS OWN meaning in the same installation (OPC-01's
// adjacency question).
//
// D-36-15: the 105-byte set is DERIVED from the committed
// `6502_undocumented.sinc` at test time -- never a hand-typed list -- via
// the SAME `op=0x[0-9a-fA-F]{2}` extraction this plan's own shell `<verify>`
// re-derives independently. D-36-17: the sweep image is GENERATED into the
// caller's own scratch workspace on every call, never committed -- one byte
// per fixed-size slot at a computable address (see
// `fixtures/ghidra/README.md`'s own "Opcode sweep layout" section for the
// same layout rule recorded for a reader with no reason to re-run this
// file).
//
// A TERMINATOR MATTERS. MEASURED this plan: a sweep slot with NO terminator
// byte lets `analyzeAll()`'s own fall-through disassembly run each "function"
// off the end of the image with no discovered exit -- `DecompInterface`
// reports every one of them DECOMPILE_FAILED (not timed out, FAILED), so
// `## DECOMPILED_TEXT` carries nothing to check at all. A documented RTS
// ($60, decodes identically under every language this file touches) at the
// LAST byte of each 4-byte slot bounds every slot's own function without
// ever overlapping the instruction itself -- the longest undocumented
// instruction is 3 bytes (opcode + a 2-byte absolute/absolute-indexed
// operand; every `UOP` addressing mode in the committed `.sinc` tops out
// there), so the terminator always lands on the one byte no instruction can
// reach.
const UNDOCUMENTED_SINC_PATH = join(HERE, "vendor", "ghidra-ext", "data", "languages", "6502_undocumented.sinc");
const UNDOCUMENTED_SINC_TEXT: string = readFileSync(UNDOCUMENTED_SINC_PATH, "utf8");

/** Extracts every distinct `op=0x[0-9a-fA-F]{2}` byte value from `text`,
 * lowercased and de-duplicated, sorted ascending -- the SAME derivation this
 * plan's own shell `<verify>` re-runs independently as
 * `grep -ao 'op=0x[0-9a-fA-F][0-9a-fA-F]' <file> | tr 'A-F' 'a-f' | sort -u`. */
function opcodeBytesInText(text: string): number[] {
  const bytes = new Set<number>();
  for (const m of text.matchAll(/op=0x([0-9a-fA-F]{2})/g)) {
    bytes.add(parseInt(m[1]!.toLowerCase(), 16));
  }
  return [...bytes].sort((a, b) => a - b);
}

/** The derived 105-byte set -- MEASURED at plan time (D-36-15) to be exactly
 * 105 distinct bytes over the committed source; asserted as its own
 * non-vacuity floor immediately below. */
const UNDOCUMENTED_BYTE_SET: readonly number[] = opcodeBytesInText(UNDOCUMENTED_SINC_TEXT);

interface ConstructorBlock {
  mnemonic: string;
  body: string;
}

/** Splits a SLEIGH source file into per-constructor blocks, keyed by the
 * mnemonic named on the block's own header line. A block's body is every
 * line up to (not including) the next header line or end of file -- this is
 * what lets a MULTI-LINE `is op=0xNN | op=0xMM | ...` alternation (this
 * project's own `.sinc` convention, e.g. the implied-NOP constructor) still
 * associate every one of its op values with the block's own mnemonic, which
 * a single-line-only scan would miss. Two header shapes are recognised via
 * `headerPattern`: this project's own `:MNEMONIC ...` (a bare leading
 * colon) and the stock 65C02 source's own `NN::MNEMONIC ...` (a table-row
 * number then a double colon). */
function splitConstructorBlocks(sourceText: string, headerPattern: RegExp): ConstructorBlock[] {
  const blocks: ConstructorBlock[] = [];
  let current: { mnemonic: string; lines: string[] } | undefined;
  for (const line of sourceText.split("\n")) {
    const m = headerPattern.exec(line);
    if (m) {
      if (current) blocks.push({ mnemonic: current.mnemonic, body: current.lines.join("\n") });
      current = { mnemonic: m[1]!, lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) blocks.push({ mnemonic: current.mnemonic, body: current.lines.join("\n") });
  return blocks;
}

const SINC_BLOCK_HEADER_PATTERN = /^:(\S+)/;
const SINC_BLOCKS: readonly ConstructorBlock[] = splitConstructorBlocks(UNDOCUMENTED_SINC_TEXT, SINC_BLOCK_HEADER_PATTERN);

test("the derived 105-byte set has exactly 105 distinct bytes, all in the 0x00-0xff range", () => {
  assert.equal(
    UNDOCUMENTED_BYTE_SET.length,
    105,
    `expected exactly 105 distinct opcode bytes derived from ${UNDOCUMENTED_SINC_PATH}, got ${UNDOCUMENTED_BYTE_SET.length}: ` +
      UNDOCUMENTED_BYTE_SET.map((b) => "0x" + b.toString(16)).join(", "),
  );
  for (const b of UNDOCUMENTED_BYTE_SET) {
    assert.ok(b >= 0 && b <= 0xff, `derived byte 0x${b.toString(16)} is out of the 0x00-0xff range`);
  }
});

// ---------------------------------------------------------------------------
// The synthetic sweep generator (D-36-17) -- THE ONE PLACE this plan's sweep
// images are built. Reused, unmodified, by all three tasks below: only the
// byte list and the base address differ per call.
// ---------------------------------------------------------------------------

/** Bytes per slot: opcode + up to a 2-byte operand (the longest undocumented
 * instruction) + a 1-byte RTS terminator, with zero bytes to spare -- see
 * this section's own header comment for why a terminator is not optional. */
const SWEEP_SLOT_SIZE = 4;
/** Documented NOP ($EA) -- decodes identically, as a harmless 1-byte no-op,
 * under every 6502-family language this file touches (stock 6502, 65C02,
 * and this project's own nmos extension). Fills every slot byte the opcode
 * and the terminator do not occupy. */
const SWEEP_PADDING_BYTE = 0xea;
/** Documented RTS ($60) -- bounds each slot's own "function" so
 * `DecompInterface` has a real exit and never merges adjacent slots into one
 * runaway, undecompilable function. See this section's own header comment
 * for the MEASURED failure mode this fixes. */
const SWEEP_TERMINATOR_BYTE = 0x60;

interface SweepLayout {
  /** The generated flat-64K image's own workspace-relative path. */
  imagePath: string;
  /** byte value -> its own slot's entry-point address, in the SAME order as
   * the input `bytes` array (which every caller below builds already
   * sorted, so insertion order here is ascending byte value). */
  addressByByte: ReadonlyMap<number, number>;
}

/** Generates a flat-64K sweep image into `ws`'s own scratch root -- one byte
 * per fixed-size `SWEEP_SLOT_SIZE`-byte slot, starting at `baseAddr`, never
 * committed. See `fixtures/ghidra/README.md`'s own "Opcode sweep layout"
 * section for the same rule recorded for a reader with no reason to re-run
 * this generator. */
function generateOpcodeSweep(ws: ScratchWorkspace, bytes: readonly number[], baseAddr: number, relImageName: string): SweepLayout {
  const image = new Uint8Array(65536).fill(SWEEP_PADDING_BYTE);
  const addressByByte = new Map<number, number>();
  bytes.forEach((b, i) => {
    const addr = baseAddr + i * SWEEP_SLOT_SIZE;
    if (addr + SWEEP_SLOT_SIZE > 0x10000) {
      throw new Error(`generateOpcodeSweep: a sweep of ${bytes.length} bytes at base 0x${baseAddr.toString(16)} runs past the end of the 64K address space`);
    }
    image[addr] = b;
    image[addr + SWEEP_SLOT_SIZE - 1] = SWEEP_TERMINATOR_BYTE;
    addressByByte.set(b, addr);
  });
  writeFileSync(join(ws.root, relImageName), image);
  return { imagePath: relImageName, addressByByte };
}

/** Writes one hex address per line, workspace-relative -- matching
 * `VolatileCarve.java`'s own `readEntryPoints()` format (an optional leading
 * `$`, stripped before parsing). Addresses are written in `addressByByte`'s
 * own insertion order (ascending byte value, since every caller below
 * builds it from a sorted array), so each slot gets its own explicit entry
 * point and no slot's decode depends on fall-through from the slot before
 * it. */
function writeSweepEntrypoints(ws: ScratchWorkspace, addressByByte: ReadonlyMap<number, number>, relName: string): string {
  const lines = [...addressByByte.values()].map((a) => "$" + a.toString(16));
  writeFileSync(join(ws.root, relName), lines.join("\n") + "\n");
  return relName;
}

/** Extracts a named `## SECTION` block's own text (from its own header line
 * up to, but not including, the NEXT `## ` header, or end of string) --
 * generic over the export file's own fixed section order. Duplicated from
 * `ghidra-live.test.ts`'s own identically-shaped helper (that file's own
 * header states the "why a duplicate" rationale this file shares). */
function extractSection(exportText: string, header: string): string {
  const startIdx = exportText.indexOf(header);
  assert.notEqual(startIdx, -1, `extractSection: ${JSON.stringify(header)} not found in export text`);
  const afterHeader = exportText.slice(startIdx + header.length);
  const nextHeaderIdx = afterHeader.indexOf("\n## ");
  return nextHeaderIdx === -1 ? afterHeader : afterHeader.slice(0, nextHeaderIdx);
}

type ClassificationKind = "code" | "data" | "undef";

/** Parses `## CLASSIFICATION`'s own `<address> code|data|undef` lines into
 * an address-keyed map. The section's own trailing summary lines
 * (`## CLASSIFICATION_LINES ...`, `CLASSIFICATION_EXPECTED_FROM_BLOCKS ...`)
 * never match this pattern, so they are skipped without special-casing. */
function parseClassificationByAddress(exportText: string): Map<number, ClassificationKind> {
  const section = extractSection(exportText, "## CLASSIFICATION");
  const map = new Map<number, ClassificationKind>();
  for (const m of section.matchAll(/^([0-9a-fA-F]+)\s+(code|data|undef)\s*$/gm)) {
    map.set(parseInt(m[1]!, 16), m[2] as ClassificationKind);
  }
  return map;
}

/** Extracts one `FUNCTION <address> <name>` block's own body (up to the next
 * `FUNCTION ` line or end of the `## DECOMPILED_TEXT` section text passed
 * in) -- `undefined` when no function was recorded at that address at all
 * (e.g. DECOMPILE_FAILED). */
function extractFunctionBody(decompiledText: string, address: number): string | undefined {
  const marker = `FUNCTION ${address.toString(16)} `;
  const idx = decompiledText.indexOf(marker);
  if (idx === -1) return undefined;
  const after = decompiledText.slice(idx);
  const nextIdx = after.indexOf("\nFUNCTION ", 1);
  return nextIdx === -1 ? after : after.slice(0, nextIdx);
}

/** THE ONE assertion helper for "did every byte in `requiredBytes` decode to
 * code, per `observed`". Refuses (throws, never a vacuous silent pass) on
 * either of two degenerate inputs -- T-36-31's own two mitigations:
 *   - a zero-length `observed` map (nothing was even swept);
 *   - an `observed` map that carries NONE of `requiredBytes` at all (the
 *     sweep was scoped to the wrong bytes entirely).
 * A check that only asked "did every byte the caller happened to pass
 * decode" would accept either of these trivially -- this project's own
 * must_haves.prohibitions names exactly that failure shape. */
function assertSweepFullyDecodes(requiredBytes: ReadonlySet<number>, observed: ReadonlyMap<number, ClassificationKind>): void {
  if (observed.size === 0) {
    throw new Error("assertSweepFullyDecodes: refuses a zero-length sweep -- a vacuous pass would prove nothing");
  }
  const inScope = [...observed.keys()].filter((b) => requiredBytes.has(b));
  if (inScope.length === 0) {
    throw new Error("assertSweepFullyDecodes: refuses a sweep containing none of the required byte set -- nothing in scope to assert");
  }
  const failed = inScope.filter((b) => observed.get(b) !== "code");
  if (failed.length > 0) {
    throw new Error(
      `assertSweepFullyDecodes: ${failed.length} of ${inScope.length} in-scope byte(s) did not decode to code: ` +
        failed.map((b) => `0x${b.toString(16)}(${observed.get(b)})`).join(", "),
    );
  }
}

test("assertSweepFullyDecodes refuses a zero-length sweep rather than trivially passing", () => {
  assert.throws(() => assertSweepFullyDecodes(new Set([0x02]), new Map()), /zero-length sweep/);
});

test("assertSweepFullyDecodes refuses a sweep containing none of the required bytes rather than trivially passing", () => {
  const sweep = new Map<number, ClassificationKind>([[0xea, "code"]]); // documented NOP, not a member of the 105-byte set
  assert.throws(() => assertSweepFullyDecodes(new Set([0x02, 0x8b]), sweep), /none of the required byte set/);
});

// ---------------------------------------------------------------------------
// Task 1: derive the 105-byte set, sweep it, and observe the stock language
// failing (OPC-04 criterion 1's second half).
// ---------------------------------------------------------------------------

const TASK1_SWEEP_BASE_ADDR = 0x2000;

/** Set by the nmos-language sweep case below, read by the stock-language
 * case immediately after it (registration order, node:test's own default
 * serial execution within one file) -- mirrors `ghidra-live.test.ts`'s own
 * `gate2PrgObserved` pattern. */
let opcodeSweepNmosObserved: Map<number, ClassificationKind> | undefined;

test(
  "ghidra-opcode-live SWEEP (nmos): all 105 undocumented opcode bytes decode as code under 6502:LE:16:nmos",
  { skip: SKIP_REASON },
  async () => {
    const ws = makeScratchWorkspace();
    try {
      const layout = generateOpcodeSweep(ws, UNDOCUMENTED_BYTE_SET, TASK1_SWEEP_BASE_ADDR, "sweep105.bin");
      const entrypointsRel = writeSweepEntrypoints(ws, layout.addressByByte, "sweep105-entrypoints.txt");
      const exportRel = "sweep105-nmos-export.txt";
      const result = await runGhidraAnalyze(
        {
          runId: "sweep105-nmos",
          importPath: layout.imagePath,
          processor: NMOS_LANGUAGE_ID,
          importRoute: "flat64k",
          noanalysis: true,
          scriptPath: "vendor/ghidra-scripts",
          preScript: "vendor/ghidra-scripts/VolatileCarve.java",
          entrypointsPath: entrypointsRel,
          postScript: "vendor/ghidra-scripts/GhidraStructExport.java",
          exportPath: exportRel,
        },
        { repoRoot: ws.root },
      );
      assert.equal(result.exitStatus, 0);

      const exportText = readFileSync(join(ws.root, exportRel), "utf8");
      const classification = parseClassificationByAddress(exportText);
      const observed = new Map<number, ClassificationKind>();
      for (const b of UNDOCUMENTED_BYTE_SET) {
        observed.set(b, classification.get(layout.addressByByte.get(b)!) ?? "undef");
      }

      // This is the case that must SUCCEED -- the failure direction belongs
      // to the stock-language case immediately below.
      assertSweepFullyDecodes(new Set(UNDOCUMENTED_BYTE_SET), observed);

      opcodeSweepNmosObserved = observed;
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);

test(
  "ghidra-opcode-live SWEEP (stock 6502:LE:16:default): the SAME 105-byte assertion is observed FAILING -- criterion 1's second half",
  { skip: SKIP_REASON },
  async () => {
    assert.notEqual(opcodeSweepNmosObserved, undefined, "the nmos-language sweep case must have run first and recorded its own observed map");
    const ws = makeScratchWorkspace();
    try {
      const layout = generateOpcodeSweep(ws, UNDOCUMENTED_BYTE_SET, TASK1_SWEEP_BASE_ADDR, "sweep105.bin");
      const entrypointsRel = writeSweepEntrypoints(ws, layout.addressByByte, "sweep105-entrypoints.txt");
      const exportRel = "sweep105-default-export.txt";
      const result = await runGhidraAnalyze(
        {
          runId: "sweep105-default",
          importPath: layout.imagePath,
          processor: DEFAULT_LANGUAGE_ID,
          importRoute: "flat64k",
          noanalysis: true,
          scriptPath: "vendor/ghidra-scripts",
          preScript: "vendor/ghidra-scripts/VolatileCarve.java",
          entrypointsPath: entrypointsRel,
          postScript: "vendor/ghidra-scripts/GhidraStructExport.java",
          exportPath: exportRel,
        },
        { repoRoot: ws.root },
      );
      assert.equal(result.exitStatus, 0);

      const exportText = readFileSync(join(ws.root, exportRel), "utf8");
      const classification = parseClassificationByAddress(exportText);
      const observed = new Map<number, ClassificationKind>();
      for (const b of UNDOCUMENTED_BYTE_SET) {
        observed.set(b, classification.get(layout.addressByByte.get(b)!) ?? "undef");
      }

      // The case PASSES BECAUSE the stock language falls short: this call
      // MUST throw. A stock language that decoded all 105 bytes would make
      // this assert.throws() itself fail the whole case -- the shortfall is
      // what the case asserts, never something it merely tolerates.
      assert.throws(
        () => assertSweepFullyDecodes(new Set(UNDOCUMENTED_BYTE_SET), observed),
        /did not decode to code/,
        "the 105-byte assertion must be observed FAILING under the stock language",
      );

      const undecodedBytes = UNDOCUMENTED_BYTE_SET.filter((b) => observed.get(b) !== "code");
      assert.notEqual(undecodedBytes.length, 0, "at least one byte must fail to decode under the stock language");

      for (const b of undecodedBytes) {
        assert.equal(
          opcodeSweepNmosObserved!.get(b),
          "code",
          `byte 0x${b.toString(16)} failed to decode under the stock language but must have decoded under nmos -- the two languages' verdicts must differ on it`,
        );
      }
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);

// ---------------------------------------------------------------------------
// Task 2 (OPC-02): the six electrically-unstable/page-crossing-dependent
// bytes read as DECLARED UNKNOWNS, never plausible arithmetic. The
// distinction this task defends: OPC-02 is not satisfied by the byte
// decoding -- it is satisfied by the byte decoding to a form that ADMITS it
// does not know, rather than to arithmetic and flag updates a reader would
// believe.
// ---------------------------------------------------------------------------

/** Pcodeop names declared by the committed `.sinc`, in source order -- the
 * six opaque black-box operations for XAA, immediate LAX/LXA, AHX, TAS, SHX
 * and SHY. */
const UNSTABLE_PCODEOP_NAMES: readonly string[] = [...UNDOCUMENTED_SINC_TEXT.matchAll(/define pcodeop (\w+);/g)].map((m) => m[1]!);

interface UnstableRepresentative {
  pcodeopName: string;
  byte: number;
  mnemonic: string;
}

/** For each declared pcodeop, the FIRST constructor block (source order)
 * whose body calls it -- deterministic, since `unstableAHXStore` is
 * referenced by TWO constructors (`$93`, the `(zp),Y` form, and `$9f`, the
 * `abs,Y` form): this project picks the first one found (`$93`) rather than
 * typing a choice. Derived from the committed source, never hardcoded, so a
 * rename in the source cannot leave this case asserting a stale byte or
 * name. */
function findRepresentativeBytes(blocks: readonly ConstructorBlock[], pcodeopNames: readonly string[]): UnstableRepresentative[] {
  return pcodeopNames.map((name) => {
    const block = blocks.find((b) => b.body.includes(name + "("));
    assert.ok(block, `findRepresentativeBytes: no constructor in the committed .sinc calls ${name}(...)`);
    const byteMatch = /op=0x([0-9a-fA-F]{2})/.exec(block!.body);
    assert.ok(byteMatch, `findRepresentativeBytes: the constructor calling ${name}(...) carries no op=0xNN constraint`);
    return { pcodeopName: name, byte: parseInt(byteMatch![1]!, 16), mnemonic: block!.mnemonic };
  });
}

const UNSTABLE_REPRESENTATIVES: readonly UnstableRepresentative[] = findRepresentativeBytes(SINC_BLOCKS, UNSTABLE_PCODEOP_NAMES);

test("at least six opaque user-defined operations are declared, one per unstable/page-crossing instruction, each traced to a real constructor and byte", () => {
  assert.ok(UNSTABLE_PCODEOP_NAMES.length >= 6, `expected at least 6 declared pcodeops, got ${UNSTABLE_PCODEOP_NAMES.length}`);
  assert.equal(UNSTABLE_REPRESENTATIVES.length, UNSTABLE_PCODEOP_NAMES.length);
  for (const r of UNSTABLE_REPRESENTATIVES) {
    assert.ok(r.byte >= 0 && r.byte <= 0xff, `derived byte 0x${r.byte.toString(16)} for ${r.pcodeopName} is out of range`);
  }
});

/** Asserts that `pcodeopName`'s own result -- never a computed expression
 * built on top of it -- is what reaches the destination: either a bare
 * `return VAR;` or a bare `... = VAR;`, where VAR is the SAME variable the
 * call itself was assigned to. MEASURED, this plan, real Ghidra 12.1.3: this
 * is exactly the shape all six representatives decompile to (recorded
 * verbatim in this plan's own evidence file, Part 2). A confident-looking
 * arithmetic expression wrapped around the call (e.g. `A = unstableXAA(...)
 * & 0xff;`) would fail the "bare" requirement below and correctly fail this
 * assertion. */
function assertUseropResultFlowsDirectly(functionBody: string, pcodeopName: string, byte: number): void {
  const callMatch = new RegExp(`(\\w+)\\s*=\\s*${pcodeopName}\\(`).exec(functionBody);
  assert.ok(callMatch, `byte 0x${byte.toString(16)}: decompiled body must call ${pcodeopName}(...) -- body:\n${functionBody}`);
  const varName = callMatch![1]!;
  const flowsDirectly = new RegExp(`(?:return\\s+${varName};|=\\s*${varName};)`).test(functionBody);
  assert.ok(
    flowsDirectly,
    `byte 0x${byte.toString(16)}: ${pcodeopName}'s own result ("${varName}") must flow directly to the destination register or store, never through a computed expression -- body:\n${functionBody}`,
  );
}

const TASK2_SWEEP_BASE_ADDR = 0x3000;

test(
  "ghidra-opcode-live UNSTABLE: the six electrically-unstable/page-crossing bytes decode to a form naming their own opaque operation, never plausible arithmetic",
  { skip: SKIP_REASON },
  async () => {
    const ws = makeScratchWorkspace();
    try {
      const bytes = UNSTABLE_REPRESENTATIVES.map((r) => r.byte);
      const layout = generateOpcodeSweep(ws, bytes, TASK2_SWEEP_BASE_ADDR, "sweep-unstable.bin");
      const entrypointsRel = writeSweepEntrypoints(ws, layout.addressByByte, "sweep-unstable-entrypoints.txt");
      const exportRel = "sweep-unstable-export.txt";
      const result = await runGhidraAnalyze(
        {
          runId: "sweep-unstable",
          importPath: layout.imagePath,
          processor: NMOS_LANGUAGE_ID,
          importRoute: "flat64k",
          noanalysis: true,
          scriptPath: "vendor/ghidra-scripts",
          preScript: "vendor/ghidra-scripts/VolatileCarve.java",
          entrypointsPath: entrypointsRel,
          postScript: "vendor/ghidra-scripts/GhidraStructExport.java",
          exportPath: exportRel,
        },
        { repoRoot: ws.root },
      );
      assert.equal(result.exitStatus, 0);

      const exportText = readFileSync(join(ws.root, exportRel), "utf8");
      const decompiledText = extractSection(exportText, "## DECOMPILED_TEXT");

      for (const r of UNSTABLE_REPRESENTATIVES) {
        const addr = layout.addressByByte.get(r.byte)!;
        const body = extractFunctionBody(decompiledText, addr);
        assert.ok(body, `byte 0x${r.byte.toString(16)} (${r.mnemonic}): no FUNCTION block found at address 0x${addr.toString(16)} in the decompiled text`);
        assert.ok(
          body!.includes(r.pcodeopName + "("),
          `byte 0x${r.byte.toString(16)} (${r.mnemonic}): decompiled body must name ${r.pcodeopName} -- body:\n${body}`,
        );
        assertUseropResultFlowsDirectly(body!, r.pcodeopName, r.byte);
      }
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);

// ---------------------------------------------------------------------------
// Task 3 (OPC-01, OPC-02, OPC-04): the 15 bytes both the extension and the
// stock 65C02 language claim keep the 65C02's OWN meaning, in the same
// installation -- proving the overlap is real, proving its size, and
// proving the non-collision is structural (a separate `.ldefs` id, a
// separate compiled language file) rather than incidental.
// ---------------------------------------------------------------------------

/** Reads the host's own installed stock `65c02.slaspec` -- `GHIDRA_HOME` is
 * an explicit runtime dependency of this test file already (`SKIP_REASON`'s
 * own second condition); never hardcoded to this one machine's probe path. */
function readStock65c02Text(): string {
  const ghidraHome = process.env.GHIDRA_HOME!;
  return readFileSync(join(ghidraHome, "Ghidra", "Processors", "6502", "data", "languages", "65c02.slaspec"), "utf8");
}

/** Extracts each `<language ...>` element's own `id` attribute, matching
 * only that opening tag -- NEVER a nested `<compiler ... id="..."/>` child
 * element, which also carries an `id` attribute (its OWN compiler-spec id,
 * a different thing entirely; a bare whole-file `id="..."` regex would
 * double-count it). Mirrors `ghidra-project.mts`'s own
 * `LANGUAGE_ELEMENT_PATTERN`/`ID_ATTR_PATTERN` two-step (tag first, then
 * attribute within it), not re-derived here as a single combined pattern. */
function extractLanguageElementIds(ldefsText: string): string[] {
  const ids: string[] = [];
  for (const tagMatch of ldefsText.matchAll(/<language\b[^>]*>/g)) {
    const idMatch = /\bid\s*=\s*"([^"]+)"/.exec(tagMatch[0]);
    if (idMatch) ids.push(idMatch[1]!);
  }
  return ids;
}

/** MEASURED at plan time (D-36-16): the stock `6502.ldefs` declares exactly
 * these two ids -- the base 6502 language and the 65C02 language it also
 * defines (both point at DIFFERENT compiled `.sla` files; `id` is what a
 * caller-supplied `processor` string is compared against). */
const STOCK_6502_LDEFS_IDS_EXPECTED: readonly string[] = ["6502:LE:16:default", "65C02:LE:16:default"];

/** The 15 shared bytes MEASURED at plan time (D-36-16) -- asserted below,
 * never assumed, against BOTH real sources. */
const EXPECTED_OVERLAP_BYTES: readonly number[] = [0x1a, 0x34, 0x3a, 0x3c, 0x5a, 0x64, 0x74, 0x7a, 0x7c, 0x80, 0x89, 0x9c, 0x9e, 0xda, 0xfa];

/** Set by the overlap-derivation case below, read by the live SHARED case
 * immediately after it (registration order, node:test's own default serial
 * execution within one file). */
let task3OverlapBytes: number[] | undefined;

test(
  "ghidra-opcode-live OVERLAP: the extension and the stock 65C02 source share exactly 15 opcode bytes, asserted from both real sources",
  { skip: SKIP_REASON },
  () => {
    const stockBytes = new Set(opcodeBytesInText(readStock65c02Text()));
    const overlap = UNDOCUMENTED_BYTE_SET.filter((b) => stockBytes.has(b));

    assert.notEqual(
      overlap.length,
      0,
      "the overlap must be non-empty -- an empty overlap would make the non-collision check below entirely vacuous, and that must fail loudly rather than pass",
    );
    assert.equal(
      overlap.length,
      15,
      `expected exactly 15 shared bytes, derived ${overlap.length}: ${overlap.map((b) => "0x" + b.toString(16)).join(", ")}`,
    );
    assert.deepEqual(overlap, EXPECTED_OVERLAP_BYTES, "the derived overlap set must match the MEASURED 15 bytes byte-for-byte, in ascending order");

    task3OverlapBytes = overlap;
  },
);

test(
  "ghidra-opcode-live LDEFS: the extension's language lives in a separate file under a separate id, and the stock 6502.ldefs still declares only its own two original ids",
  { skip: SKIP_REASON },
  () => {
    const ghidraHome = process.env.GHIDRA_HOME!;
    const stockLdefsPath = join(ghidraHome, "Ghidra", "Processors", "6502", "data", "languages", "6502.ldefs");
    const stockLdefsText = readFileSync(stockLdefsPath, "utf8");
    const stockIds = extractLanguageElementIds(stockLdefsText);
    assert.deepEqual(
      [...stockIds].sort(),
      [...STOCK_6502_LDEFS_IDS_EXPECTED].sort(),
      "the stock 6502.ldefs must still declare only its own two original ids",
    );

    const extLdefsPath = join(HERE, "vendor", "ghidra-ext", "data", "languages", "6502_nmos.ldefs");
    assert.notEqual(extLdefsPath, stockLdefsPath, "the extension's .ldefs must be a physically separate file from the stock one");
    const extLdefsText = readFileSync(extLdefsPath, "utf8");
    const extIds = extractLanguageElementIds(extLdefsText);
    assert.deepEqual(extIds, [NMOS_LANGUAGE_ID], "the extension's .ldefs must declare exactly its own new id");
    assert.equal(stockIds.includes(NMOS_LANGUAGE_ID), false, "the extension's id must not collide with anything the stock .ldefs already declares");

    const stock65c02Text = readStock65c02Text();
    assert.match(stock65c02Text.trimStart(), /^@include\s+"6502\.slaspec"/, "65c02.slaspec's own first line must include the base 6502 source");
    assert.equal(stock65c02Text.includes("6502_undocumented"), false, "65c02.slaspec must never include this project's own extension source");
  },
);

const TASK3_SWEEP_BASE_ADDR = 0x4000;
/** The two shared bytes MEASURED (D-36-16) to also be in the eight-
 * constructor compile-failure set -- called out explicitly below. */
const TASK3_COMPILE_FAILURE_BYTES: ReadonlySet<number> = new Set([0x9c, 0x9e]);

test(
  "ghidra-opcode-live SHARED: all 15 shared bytes keep the 65C02's own meaning under 65C02:LE:16:default in the same installation, with no trace of the extension's opaque operations",
  { skip: SKIP_REASON },
  async () => {
    assert.notEqual(task3OverlapBytes, undefined, "the overlap-derivation case must have run first and recorded the shared byte set");
    const ws = makeScratchWorkspace();
    try {
      const layout = generateOpcodeSweep(ws, task3OverlapBytes!, TASK3_SWEEP_BASE_ADDR, "sweep-overlap.bin");
      const entrypointsRel = writeSweepEntrypoints(ws, layout.addressByByte, "sweep-overlap-entrypoints.txt");
      const exportRel = "sweep-overlap-export.txt";
      const result = await runGhidraAnalyze(
        {
          runId: "sweep-overlap",
          importPath: layout.imagePath,
          processor: "65C02:LE:16:default",
          importRoute: "flat64k",
          noanalysis: true,
          scriptPath: "vendor/ghidra-scripts",
          preScript: "vendor/ghidra-scripts/VolatileCarve.java",
          entrypointsPath: entrypointsRel,
          postScript: "vendor/ghidra-scripts/GhidraStructExport.java",
          exportPath: exportRel,
        },
        { repoRoot: ws.root },
      );
      assert.equal(result.exitStatus, 0);

      const exportText = readFileSync(join(ws.root, exportRel), "utf8");
      const classification = parseClassificationByAddress(exportText);
      const decompiledText = extractSection(exportText, "## DECOMPILED_TEXT");

      for (const b of task3OverlapBytes!) {
        const addr = layout.addressByByte.get(b)!;
        assert.equal(classification.get(addr), "code", `byte 0x${b.toString(16)} must decode as code under 65C02:LE:16:default`);
        const body = extractFunctionBody(decompiledText, addr) ?? "";
        for (const pcodeopName of UNSTABLE_PCODEOP_NAMES) {
          assert.equal(
            body.includes(pcodeopName),
            false,
            `byte 0x${b.toString(16)}: decompiled under 65C02:LE:16:default must never name this extension's own ${pcodeopName} -- collision`,
          );
        }
      }

      // The two shared bytes also in the compile-failure set decode to a
      // real store-of-zero (STZ) statement under 65C02 -- MEASURED this
      // plan -- never this extension's own SHY ($9c) / SHX ($9e) userop.
      for (const b of TASK3_COMPILE_FAILURE_BYTES) {
        assert.ok(task3OverlapBytes!.includes(b), `byte 0x${b.toString(16)} must be a member of the derived 15-byte overlap set`);
        const body = extractFunctionBody(decompiledText, layout.addressByByte.get(b)!) ?? "";
        assert.match(body, /=\s*0;/, `byte 0x${b.toString(16)} (STZ under 65C02) must decompile to a literal store-of-zero statement`);
      }
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);

// ---------------------------------------------------------------------------
// Plan 36-07 (OPC-03): the real-corpus before/after difference. Sequenced,
// evidenced, AFTER the compile gate (36-01, evidence/36-01-sleigh-gate-red.md)
// and the language assertion (36-01, evidence/36-01-language-used.md), and
// AHEAD of the acceptance run (this plan's own Task 2/3 in
// ghidra-live.test.ts). D-36-18: this reuses `dxa-live.test.ts`'s own
// established corpus route -- read the release image's directory, take its
// first entry, extract that entry's program bytes -- rather than inventing a
// second extraction path. D-36-20: a SECOND, narrower opt-in on top of the
// file-level one, mirroring that same precedent.
//
// The release image is `danish.d64` from Phase 23's corpus (canonical per
// `docs/phase33-reproducible-run-gate-findings.md`'s own frontmatter),
// gitignored and never committed -- absent on any machine that has not
// separately obtained it, which is why the corpus case carries its own
// skip reason naming the expected path rather than failing.
// ---------------------------------------------------------------------------

const CORPUS_PATH = join(
  repoRoot({ from: HERE }),
  ".planning",
  "phases",
  "23-the-real-release-gate-go-degrade-no-go",
  "evidence",
  "corpus",
  "danish.d64",
);

/** Gated behind BOTH `VICE_LIVE_GHIDRA=1` (this file's own opt-in, above) AND
 * its OWN `VICE_LIVE_GHIDRA_CORPUS=1` -- the corpus image is gitignored
 * (D-04, `.planning/phases/23-.../evidence/README.md` convention 10) and
 * absent on every machine but the one that separately fetched it. */
const CORPUS_SKIP_REASON: string | false =
  SKIP_REASON !== false
    ? SKIP_REASON
    : process.env.VICE_LIVE_GHIDRA_CORPUS !== "1"
      ? "ghidra-opcode-live.test.ts's corpus case is opt-in and default-skipped -- set VICE_LIVE_GHIDRA_CORPUS=1 (in addition to VICE_LIVE_GHIDRA=1) to run it."
      : !existsSync(CORPUS_PATH)
        ? `VICE_LIVE_GHIDRA_CORPUS=1 but the corpus image does not exist at ${CORPUS_PATH} -- this repository never commits it (D-04, ` +
          `.planning/phases/23-.../evidence/README.md convention 10); obtain the Phase 23 corpus release separately.`
        : false;

/** The `.prg` route's own fixed default base address (`importRouteBaseAddr("prg")`,
 * `ghidra-project.mts`) -- `BinaryLoader` maps file byte 0 (the `.prg`
 * format's own 2-byte load-address header) to this address, so a Ghidra
 * address maps back to a body (post-header) file offset via
 * `address - PRG_ROUTE_BASE_ADDR - PRG_HEADER_SIZE`. Same rule
 * `ghidra-live.test.ts`'s own `PRG_ROUTE_ENTRYPOINT` documents (MEASURED
 * there against `bank.prg`; re-confirmed here against the real corpus
 * release). */
const PRG_ROUTE_BASE_ADDR = 0x0801;
const PRG_HEADER_SIZE = 2;

/** MEASURED this plan, real Ghidra 12.1.3 against the real corpus release
 * (`danish.d64`'s first entry, "BRUCE LEE (DC)"): three entry points make the
 * depacker's own real code -- including a real undocumented-opcode byte --
 * reachable from a static disassembly pass over the raw `.prg` image.
 *
 *   - `$081b`: the BASIC stub's own "SYS 2073" call (2073 decimal = `$0819`),
 *     shifted +2 for the `.prg` route's own `BinaryLoader` header-inclusion
 *     (the same +2 rule `ghidra-live.test.ts`'s own `PRG_ROUTE_ENTRYPOINT`
 *     documents against `bank.prg`; this release's own header also encodes
 *     `$0801`, so the same shift applies).
 *   - `$b70a`: reached from `$081b`'s own direct `JMP` (an `UNCONDITIONAL_CALL`
 *     reference once decoded); seeded explicitly too so it disassembles even
 *     under a language where the `$081b` stub itself fails to decode.
 *   - `$b74c`, `$b7e7`: the depacker's own two self-relocating copy-loop
 *     SOURCE addresses (read directly off `$b70a`'s own decompiled text:
 *     `(&DAT_0110)[bVar1] = (&DAT_b74c)[bVar1]`, and a second loop copying
 *     `(&DAT_b7b3)[bVar1]` to `(&DAT_0300)[bVar1]` starting at `bVar1=0x34`,
 *     i.e. source `$b7b3+0x34=$b7e7`). These addresses hold the REAL code
 *     bytes that get relocated and executed at runtime; disassembling them
 *     at their own FILE location (rather than their relocated target, which
 *     is uninitialised at static-analysis time) decodes the SAME bytes,
 *     since opcode identity does not depend on load address.
 *   - `$b790`: MEASURED, the depacker's own SECOND real routine, reached at
 *     runtime via the relocated code (a direct `JMP` at `$b745` in
 *     `$b70a`'s own body targets `$0152`, which is `$0110+0x42` -- the SAME
 *     +0x42 offset into the FIRST copy's own SOURCE, `$b74c+0x42=$b78e`;
 *     `$b78e`-`$b78f` is a `PLA`/`RTS` return stub immediately preceding
 *     this routine's own real entry at `$b790`).
 *
 * `$b7e7`'s own first byte is the exact MEASURED divergence point: `0x34`
 * ("NOP zp,X" under this project's own extension -- `6502_undocumented.sinc`,
 * the `:NOP imm8,X` constructor) has NO constructor at all under stock
 * `6502.slaspec`, so the stock language's disassembly never decodes this
 * byte, nor anything downstream of it (including a real `JMP $a7ae` at
 * `$b810` and the KERNAL-calling function it targets) -- while this
 * project's own extension decodes it and continues. */
const CORPUS_ENTRY_MAIN = "$081b";
const CORPUS_ENTRY_RELOCATE_TARGET = "$b70a";
const CORPUS_ENTRY_RELOCATE_SOURCE_1 = "$b74c";
const CORPUS_ENTRY_RELOCATE_SOURCE_2 = "$b7e7";
const CORPUS_ENTRY_SECOND_ROUTINE = "$b790";
const CORPUS_ENTRY_POINTS: readonly string[] = [
  CORPUS_ENTRY_MAIN,
  CORPUS_ENTRY_RELOCATE_TARGET,
  CORPUS_ENTRY_RELOCATE_SOURCE_1,
  CORPUS_ENTRY_RELOCATE_SOURCE_2,
  CORPUS_ENTRY_SECOND_ROUTINE,
];

/** Converts a Ghidra address (within the imported `.prg`'s own loaded range)
 * back to its own byte offset within `body` (the extracted program with its
 * 2-byte `.prg` header already stripped) -- `undefined` when the address
 * falls outside the imported image entirely (e.g. a language-defined
 * zero-page/stack block, or a KERNAL-area reference the image never
 * covers). */
function corpusBodyOffsetForAddress(address: number, bodyLength: number): number | undefined {
  const offset = address - (PRG_ROUTE_BASE_ADDR + PRG_HEADER_SIZE);
  return offset >= 0 && offset < bodyLength ? offset : undefined;
}

test(
  "ghidra-opcode-live CORPUS: the real-corpus before/after difference, attributed to the illegal bytes' own offsets",
  { skip: CORPUS_SKIP_REASON },
  async () => {
    const corpusImageBytes = readFileSync(CORPUS_PATH);
    const corpusImageSha256 = createHash("sha256").update(corpusImageBytes).digest("hex");
    const entries = listEntries(new Uint8Array(corpusImageBytes));
    const entry = entries[0];
    if (entry === undefined) {
      throw new Error("ghidra-opcode-live CORPUS: the corpus image has no directory entries");
    }
    const extracted = extractEntry(new Uint8Array(corpusImageBytes), entry.name);
    const body = extracted.subarray(PRG_HEADER_SIZE);

    // Establish presence/absence of the illegal bytes FIRST, before any run
    // -- a raw scan over the extracted program's own body, recording which
    // of the 105 bytes are present and a bounded sample of their offsets.
    // Per this plan's own action text: if none were present, this would be
    // a recorded, disclosed fact about the corpus, and the case would stop
    // here rather than substitute a synthetic input or report a pass.
    const presentByteOffsets = new Map<number, number[]>();
    for (let i = 0; i < body.length; i++) {
      const b = body[i]!;
      if (UNDOCUMENTED_BYTE_SET.includes(b)) {
        const list = presentByteOffsets.get(b) ?? [];
        if (list.length < 5) list.push(i);
        presentByteOffsets.set(b, list);
      }
    }
    assert.notEqual(
      presentByteOffsets.size,
      0,
      "OPC-03's before/after difference is not exercisable on this release: none of the derived 105-byte set was found anywhere in the extracted program's own body",
    );

    const ws = makeScratchWorkspace();
    try {
      writeFileSync(join(ws.root, "release.prg"), extracted);
      writeFileSync(join(ws.root, "release.entrypoints"), CORPUS_ENTRY_POINTS.join("\n") + "\n");

      async function runCorpus(processor: string, runId: string): Promise<Map<number, ClassificationKind>> {
        const exportRel = `${runId}-export.txt`;
        const result = await runGhidraAnalyze(
          {
            runId,
            importPath: "release.prg",
            processor,
            importRoute: "prg",
            noanalysis: true,
            scriptPath: "vendor/ghidra-scripts",
            preScript: "vendor/ghidra-scripts/VolatileCarve.java",
            entrypointsPath: "release.entrypoints",
            postScript: "vendor/ghidra-scripts/GhidraStructExport.java",
            exportPath: exportRel,
          },
          { repoRoot: ws.root },
        );
        assert.equal(result.exitStatus, 0, `${runId}: analyzeHeadless's own exit status must be 0`);
        const exportText = readFileSync(join(ws.root, exportRel), "utf8");
        return parseClassificationByAddress(exportText);
      }

      // Run twice, everything else identical: the SAME extracted program,
      // the SAME route, the SAME entry points -- only the language differs.
      const defaultClassification = await runCorpus(DEFAULT_LANGUAGE_ID, "corpus-default");
      const nmosClassification = await runCorpus(NMOS_LANGUAGE_ID, "corpus-nmos");

      const allAddresses = new Set<number>([...defaultClassification.keys(), ...nmosClassification.keys()]);
      const changed: number[] = [];
      for (const addr of allAddresses) {
        if (defaultClassification.get(addr) !== nmosClassification.get(addr)) changed.push(addr);
      }
      changed.sort((a, b) => a - b);

      // Assert RELATIVELY, never against a pinned byte count of content
      // this repository does not ship -- the actual numbers are recorded in
      // the evidence file, not asserted here.
      assert.notEqual(changed.length, 0, "at least one address must change classification between the two languages over the real corpus program");

      const attributed = changed.filter((addr) => {
        const off = corpusBodyOffsetForAddress(addr, body.length);
        return off !== undefined && UNDOCUMENTED_BYTE_SET.includes(body[off]!);
      });
      assert.notEqual(
        attributed.length,
        0,
        "at least one changed address's own raw byte (within the imported program) must be a member of the derived 105-byte set -- the difference must be attributable to the illegal bytes' own offsets, not merely coincide with them",
      );

      const sample = changed
        .filter((a) => defaultClassification.get(a) !== "code" && nmosClassification.get(a) === "code")
        .slice(0, 5);
      assert.ok(
        sample.length >= 3,
        `expected at least 3 sample addresses undefined-under-stock/code-under-nmos, got ${sample.length}`,
      );

      // Record everything this task's evidence file needs, printed so a
      // human re-running this exact case can transcribe it -- the evidence
      // file itself is authored by hand from a real run's own output, per
      // this project's established convention (it is not generated).
      console.log("CORPUS_RELEASE_SHA256:", corpusImageSha256);
      console.log("CORPUS_ENTRY_NAME:", entry.name);
      console.log("CORPUS_ENTRY_LENGTH:", extracted.length);
      console.log("CORPUS_ENTRY_POINTS:", CORPUS_ENTRY_POINTS.join(","));
      console.log("CORPUS_CHANGED_COUNT:", changed.length);
      console.log("CORPUS_ATTRIBUTED_COUNT:", attributed.length);
      console.log("CORPUS_SAMPLE:", sample.map((a) => a.toString(16)).join(","));
      console.log("CORPUS_PRESENT_BYTE_COUNT:", presentByteOffsets.size);
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);
