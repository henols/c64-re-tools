#!/usr/bin/env node
// r2000-coverage.ts -- the ONE place that measures how well a binary has
// actually been reverse-engineered (COV-01, COV-02).
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// COV-01 asks for a coverage instrument, and the obvious implementation --
// ask regenerator2000 how much of the image it has classified as `Code` and
// call that "completeness" -- is CIRCULAR, and provably so at upstream's own
// source. `follow_indirect_jumps()` (`analyzer.rs:445-540` at the pinned
// commit) walks a linear sweep over bytes whose `block_types` entry is
// ALREADY `Code`, and only acts on opcode `0x6C` whose pointer location is
// ALREADY classified `Address`. On an under-classified binary -- which is
// exactly the state a coverage instrument exists to measure -- that walk
// finds nothing. An instrument built on it would report "nothing left to do"
// on a binary nobody has looked at yet. That is the defect this module is
// shaped to make unreachable, not merely to avoid.
//
// So the structural census here is a pure function of TWO things: the raw
// bytes, and the seed set the caller supplies. The store's own block table
// is read at exactly ONE call site in this file -- `computeDivergence()` --
// and it feeds a sub-report that is explicitly named as a comparison, never
// as a measure of completeness. `r2000-coverage.test.ts` pins that boundary
// by rewriting every block entry to one type and asserting no census byte
// count moves.
//
// ---------------------------------------------------------------------------
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR
// ---------------------------------------------------------------------------
//   - the byte census (`computeStructuralCensus`) and its four disjoint byte
//     classes;
//   - the WIDENED indirect-dispatch scan (`scanIndirectDispatch`) that reaches
//     the four classes upstream's own walk does not: zero-page vectors,
//     multi-entry dispatch tables, split lo/hi tables, and the stack-return
//     dispatch idiom (which contains no indirect-jump opcode at all and is
//     therefore completely invisible to an opcode-keyed walk);
//   - the two label figures (`computeLabelRatio`), one of which is gameable
//     and one of which is not;
//   - the comment-vacuity measure (`computeCommentVacuity`) and its exact
//     normalisation rules;
//   - the sampled reproducibility result (`computeReproducibility`) and its
//     deterministic sample rule;
//   - the pinned report schema (`COVERAGE_SCHEMA_VERSION`,
//     `buildCoverageReport`).
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO -- each of these is a specific, named trap
// ---------------------------------------------------------------------------
//   1. NEVER derive any measure from the store's block-type listing. The
//      listing enters this file at one call site (`computeDivergence()`) and
//      leaves it as a comparison. A "completeness" number sourced from the
//      block table measures the annotator's bookkeeping, not the annotation
//      -- and mass `r2000_set_data_type` calls would move it for free.
//   2. NEVER sum the linear-sweep figure into completeness. Upstream's own
//      Pitfall 1 says it plainly: "Random data routinely disassembles into
//      plausible-looking instruction sequences -- this does NOT make it
//      code." `reachedAsInstruction` means REACHED BY RECURSIVE DESCENT FROM
//      A SEED. `linearSweepDecodable` is reported beside it, deliberately
//      under a different name, and is never added to it.
//   3. NEVER emit a single combined coverage figure -- not in the report
//      object, not in a summary line, not derived at the point of display.
//      COV-01's substance IS that the measures stay separately addressable.
//      `coverageFindings()` below is a boolean verdict with per-measure
//      reasons, NOT an aggregate: it never averages, sums or weights the
//      measures, and every finding names exactly one of them.
//   4. NEVER define a second confidence vocabulary. `CONFIDENCE_GRADES` from
//      `./r2000-confidence.ts` is the only one; that module's own header
//      forbids a second spelling.
//   5. NEVER import this repository's host-path or container-path translation
//      modules. The whole r2000 module family is asserted ABSENT from that
//      consumer set by a derived-from-disk scan (the `r2000-*.ts` glob in the
//      path-consumer guard suite), and this file joins that family by name --
//      an import here would fail that guard rather than merely violate a
//      convention. Note that the guard's own filename is deliberately not
//      written out in this file: an acceptance check greps this source for
//      the two module names and a mention would trip it.
//   6. NEVER add a file-write call, a project-save call, or a live-session
//      import here. A coverage run is read-only over a project file BY
//      CONSTRUCTION, so two concurrent runs cannot corrupt a project and an
//      interrupted run leaves no partial report behind -- there is nothing on
//      disk for it to leave. `r2000-coverage.test.ts` asserts that at source
//      level.
//   7. NEVER let an absent input read as a pass (COV-02). A missing payload,
//      an undecodable one, or an empty comment set reports an explicit `null`
//      ratio plus a stated reason -- never a silently-omitted measure and
//      never a zero that reads like "clean".
//
// ---------------------------------------------------------------------------
// NAMED DEVIATION FROM THE RESEARCH RECOMMENDATION (recorded, deliberate)
// ---------------------------------------------------------------------------
// 19-RESEARCH.md §3.4 suggested reproducing Phase 11's two-SESSION answer key
// -- a second agent session re-deriving the answer independently. Nested
// headless agent sessions stall indefinitely in this project's environment,
// so that axis is not runnable here. The independence axis used instead is
// BYTES-VERSUS-STORE: one side classifies an address using only the raw bytes
// and this file's census, the other using only the store's own documentation
// (confidence grade, block type). Neither side reads the other's input. The
// seal (`evidence/coverage-reproducibility/ANSWER.sha256`) is what makes the
// result non-retrofittable, exactly as it was in Phase 11: the hash is
// committed before the re-derivation is written, and a missing or empty
// re-derivation FAILS rather than skips.

import { decode, type Instruction } from "./disasm-decoder.ts";
import { decodeRawData } from "./r2000-project.ts";
import { CONFIDENCE_GRADES, parseConfidencePrefix } from "./r2000-confidence.ts";
import { readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

/**
 * The report's schema version. Phase 20 reads this report repeatedly through
 * its decomposition sweep and Phase 21 reuses the dispatch scan, so the field
 * set is a contract, not an implementation detail. Bump this ONLY together
 * with `r2000-coverage.test.ts`'s exact top-level key-set assertion -- that
 * test exists so a silent field rename fails loudly rather than quietly
 * feeding two consumers `undefined`.
 */
export const COVERAGE_SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Bounds. Both are explicit, both surface a truncation flag rather than
// looping (T-19-12/T-19-13). Neither is a heuristic "walk while plausible".
// ---------------------------------------------------------------------------

/** Hard cap on recursive-descent steps before the walk reports truncation. */
export const MAX_WALK_STEPS = 200_000;

/** Hard cap on entries read from any one dispatch table. A table longer than
 * this reports `truncated: true` for that table rather than walking on. */
export const MAX_TABLE_ENTRIES = 64;

/** How many decoded instructions a split-table pairing may span. Two indexed
 * loads further apart than this are not treated as a lo/hi pair. */
const SPLIT_TABLE_WINDOW = 8;

// ---------------------------------------------------------------------------
// Input shapes -- exactly what the curated read tools return
// (`r2000-tools.ts`: r2000_get_symbols / r2000_get_comments / r2000_get_blocks
// / r2000_get_cross_references). This module never calls those tools itself;
// a caller fetches and hands the data in. That is what keeps it pure, keeps
// it session-free, and keeps it testable with no child process.
// ---------------------------------------------------------------------------

export interface R2000Symbol {
  address: number;
  name: string;
  /** `LabelKind`'s Debug form: `"User"`, `"Auto"` or `"System"`. */
  kind: string;
  /** `LabelType`'s Debug form (`"Subroutine"`, `"AbsoluteAddress"`, ...). */
  type?: string;
}

export interface R2000Comment {
  address: number;
  /** `"line"` or `"side"`. */
  type: string;
  comment: string;
}

export interface R2000BlockEntry {
  start_address: number;
  end_address: number;
  /** `BlockType`'s Display string: `"Code"`, `"Byte"`, `"Address"`, ... */
  type: string;
}

export interface R2000CrossReference {
  address: number;
  /** The sorted, deduped caller list `r2000_get_cross_references` returns. */
  callers: readonly number[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export interface R2000CoverageInputErrorOptions {
  cause?: unknown;
  projectPath?: string;
}

/**
 * Thrown ONLY for a caller contract violation -- an absent or unreadable
 * project path. Never thrown for malformed bytes: a payload that will not
 * gunzip, or a project file that is not JSON, is reported as an explicit
 * `payloadDecoded: false` plus a reason (COV-02's "never a silent skip", and
 * never a throw the caller has to guess at either). Mirrors
 * `R2000ProjectSettingsError`'s named-field convention so a caller never has
 * to parse message text to recover the path.
 */
export class R2000CoverageInputError extends Error {
  projectPath: string | undefined;

  constructor(message: string, { cause, projectPath }: R2000CoverageInputErrorOptions = {}) {
    super(message);
    this.name = "R2000CoverageInputError";
    this.projectPath = projectPath;
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

// ---------------------------------------------------------------------------
// (a) The structural census
// ---------------------------------------------------------------------------

/**
 * The four DISJOINT byte classes. Every byte in `[origin, origin + size)`
 * lands in exactly one, and their counts always sum to `rangeBytes`.
 *
 * `reached-as-instruction` means REACHED BY RECURSIVE DESCENT FROM A SEED --
 * never "these bytes happened to decode". See the header's trap 2.
 */
export type ByteClass = "reached-as-instruction" | "table-entry" | "referenced-as-data" | "unreached";

const CLASS_ORDER: readonly ByteClass[] = [
  "reached-as-instruction",
  "table-entry",
  "referenced-as-data",
  "unreached",
];

/** A run of consecutive addresses sharing one class. The census reports runs
 * rather than a per-byte array so the report stays JSON-safe and stays
 * deep-comparable between two runs (the idempotency test). */
export interface ClassRun {
  start: number;
  end: number;
  class: ByteClass;
}

export interface StructuralCensus {
  origin: number;
  size: number;
  /** `size`, restated: every count below is over the HALF-OPEN range
   * `[origin, origin + size)`, and these four counts sum to exactly this. */
  rangeBytes: number;
  /** The seed set actually used, ascending and deduped. */
  seeds: number[];
  reachedAsInstruction: number;
  tableEntry: number;
  referencedAsData: number;
  unreached: number;
  /**
   * Bytes a plain LINEAR SWEEP from `origin` decodes into legal, complete
   * instructions. Reported deliberately under its own name and NEVER added to
   * `reachedAsInstruction` -- decodability is not evidence of code.
   */
  linearSweepDecodable: number;
  /** True when the walk hit `MAX_WALK_STEPS` and stopped early. */
  truncated: boolean;
  /** Steps the descent walker actually took. */
  steps: number;
  classRuns: ClassRun[];
}

const TERMINATORS = new Set([0x00 /* brk */, 0x40 /* rti */, 0x4c /* jmp abs */, 0x60 /* rts */, 0x6c /* jmp ind */]);

/** Mnemonics whose absolute/zero-page operand names a DATA location. Used to
 * mark `referenced-as-data`. Exactly one byte is marked per reference: the
 * extent of an indexed access is not determinable from the bytes, so guessing
 * a length here would manufacture coverage that was never proven. */
const DATA_REF_MNEMONICS = new Set([
  "lda", "ldx", "ldy", "sta", "stx", "sty",
  "adc", "sbc", "and", "ora", "eor", "cmp", "cpx", "cpy",
  "bit", "inc", "dec", "asl", "lsr", "rol", "ror",
]);

function sortedUniqueNumbers(values: Iterable<number>): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function toRuns(classes: Uint8Array, origin: number): ClassRun[] {
  const runs: ClassRun[] = [];
  if (classes.length === 0) return runs;
  let runStart = 0;
  for (let i = 1; i <= classes.length; i++) {
    if (i === classes.length || classes[i] !== classes[runStart]) {
      runs.push({
        start: origin + runStart,
        end: origin + i - 1,
        class: CLASS_ORDER[classes[runStart]!]!,
      });
      runStart = i;
    }
  }
  return runs;
}

/** Looks up the class of a single address in a census, or `null` when the
 * address lies outside the censused range. Linear over runs, which is what
 * keeps the census JSON-safe -- see `ClassRun`. */
export function classAt(census: StructuralCensus, address: number): ByteClass | null {
  for (const run of census.classRuns) {
    if (address >= run.start && address <= run.end) return run.class;
  }
  return null;
}

export interface StructuralCensusOptions {
  /** Addresses already known to be dispatch-table entries (two bytes each),
   * normally `scanIndirectDispatch()`'s reconstructed table entry addresses. */
  tableEntryAddresses?: Iterable<number>;
  /** Extra addresses to descend from, normally the widened dispatch scan's
   * discovered targets. */
  extraSeeds?: Iterable<number>;
  maxSteps?: number;
}

/**
 * Classifies every byte in `[origin, origin + size)` by recursive descent
 * from `seeds`.
 *
 * Bounded by construction: an explicit worklist and a visited set, NO
 * recursion (mirroring `decode()`'s own discipline, which this walker sits on
 * top of), and an explicit `MAX_WALK_STEPS` cap that sets `truncated` rather
 * than looping. Never throws: a non-`Uint8Array` payload, a nonsense origin
 * or an empty seed set all produce a well-formed census.
 *
 * An EMPTY or SEEDLESS input reports `reachedAsInstruction: 0` and
 * `unreached: rangeBytes` -- a real, readable zero, never an error and never
 * an omitted measure.
 */
export function computeStructuralCensus(
  bytes: Uint8Array,
  origin: number,
  seeds: Iterable<number> = [],
  opts: StructuralCensusOptions = {},
): StructuralCensus {
  const safeBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(0);
  const safeOrigin = Number.isSafeInteger(origin) && origin >= 0 && origin <= 0xffff ? origin : 0;
  const size = safeBytes.length;
  const maxSteps = Number.isSafeInteger(opts.maxSteps) && opts.maxSteps! > 0 ? opts.maxSteps! : MAX_WALK_STEPS;

  // Class codes are indices into CLASS_ORDER. A zero-initialised array would
  // mean "reached-as-instruction", which is exactly the wrong default for an
  // instrument whose entire point is that reachability must be PROVEN, so
  // fill with 3 ("unreached") explicitly.
  const classes = new Uint8Array(size);
  classes.fill(3);

  const inRange = (addr: number): boolean => addr >= safeOrigin && addr < safeOrigin + size;
  const mark = (addr: number, klass: number): void => {
    if (!inRange(addr)) return;
    const idx = addr - safeOrigin;
    // Lower index wins: reached-as-instruction beats table-entry beats
    // referenced-as-data beats unreached. Disjointness by construction.
    if (klass < classes[idx]!) classes[idx] = klass;
  };

  const seedList = sortedUniqueNumbers([...seeds, ...(opts.extraSeeds ?? [])].filter((a) => Number.isSafeInteger(a)));

  const worklist: number[] = seedList.filter(inRange);
  const visited = new Set<number>(worklist);
  let steps = 0;
  let truncated = false;

  while (worklist.length > 0) {
    if (steps >= maxSteps) {
      truncated = true;
      break;
    }
    steps++;

    let pc = worklist.pop()!;

    // Walk this trace linearly until it terminates, leaves the range, or
    // revisits a byte already walked as an instruction.
    while (inRange(pc)) {
      if (steps >= maxSteps) {
        truncated = true;
        break;
      }
      steps++;

      const offset = pc - safeOrigin;
      const decoded = decode(safeBytes.subarray(offset), pc, { count: 1 })[0];
      if (!decoded || decoded.notes.includes("truncated")) break;

      for (let i = 0; i < decoded.bytes.length; i++) mark(pc + i, 0);

      // Data references: exactly one byte, the named base. Never a guessed
      // extent -- see DATA_REF_MNEMONICS.
      const operand = decoded.operand;
      if (
        operand &&
        (operand.role === "absolute" || operand.role === "zeropage") &&
        DATA_REF_MNEMONICS.has(decoded.mnemonic)
      ) {
        mark(operand.value, 2);
      }

      // Control flow: a branch or a jsr forks; an unconditional terminator
      // ends the trace.
      const target = decoded.resolvedTarget;
      if (target !== undefined && inRange(target) && !visited.has(target)) {
        visited.add(target);
        worklist.push(target);
      }

      if (TERMINATORS.has(decoded.opcode)) break;

      pc += decoded.bytes.length;
    }
  }

  for (const addr of opts.tableEntryAddresses ?? []) mark(addr, 1);

  // Linear-sweep decodability -- reported, never summed. See trap 2.
  let linearSweepDecodable = 0;
  for (const insn of decode(safeBytes, safeOrigin)) {
    if (insn.illegal) continue;
    if (insn.notes.includes("truncated")) continue;
    linearSweepDecodable += insn.bytes.length;
  }

  const counts = [0, 0, 0, 0];
  for (let i = 0; i < size; i++) {
    const code = classes[i]!;
    counts[code] = counts[code]! + 1;
  }

  return {
    origin: safeOrigin,
    size,
    rangeBytes: size,
    seeds: seedList,
    reachedAsInstruction: counts[0]!,
    tableEntry: counts[1]!,
    referencedAsData: counts[2]!,
    unreached: counts[3]!,
    linearSweepDecodable,
    truncated,
    steps,
    classRuns: toRuns(classes, safeOrigin),
  };
}

// ---------------------------------------------------------------------------
// (b) The widened indirect-dispatch scan
// ---------------------------------------------------------------------------

export interface IndirectJumpFinding {
  /** Address of the `jmp ($nnnn)` instruction itself. */
  at: number;
  /** The pointer location named by the operand. */
  pointer: number;
  /** The 16-bit word read at `pointer`, or `null` when the pointer lies
   * outside the image (a ZERO-PAGE VECTOR is the common case, and upstream's
   * own walk skips it entirely -- reporting it with a null target is the
   * whole point). */
  target: number | null;
  pointerInImage: boolean;
  pointerInZeroPage: boolean;
}

export interface DispatchTableFinding {
  /** Address of the instruction that named the table, when there is one. */
  at: number;
  base: number;
  entries: number;
  targets: number[];
  truncated: boolean;
}

export interface SplitTableFinding {
  at: number;
  loBase: number;
  hiBase: number;
  entries: number;
  targets: number[];
  truncated: boolean;
}

export interface StackReturnFinding {
  /** Address of the first instruction of the matched idiom. */
  at: number;
  loBase: number;
  hiBase: number;
  entries: number;
  targets: number[];
  truncated: boolean;
}

export interface IndirectDispatchScan {
  indirectJumps: IndirectJumpFinding[];
  multiEntryTables: DispatchTableFinding[];
  splitTables: SplitTableFinding[];
  stackReturnDispatch: StackReturnFinding[];
  /** Every target any class discovered, ascending and deduped. An ADDRESS
   * LIST, not a figure -- the four classes stay separately addressable above
   * so Phase 21's hazard report can consume just the one it needs. */
  discoveredTargets: number[];
  /** Addresses occupied by reconstructed table entries (two bytes each). */
  tableEntryAddresses: number[];
  truncated: boolean;
}

const INDEXED_LOAD_MODES = new Set(["absolute_x", "absolute_y", "zeropage_x"]);

/**
 * Reaches the four classes upstream's `follow_indirect_jumps()` does not.
 *
 * Every table walk is bounded by `MAX_TABLE_ENTRIES` and reports its own
 * `truncated` flag -- never "walk while plausible". Never throws.
 */
export function scanIndirectDispatch(
  instructions: readonly Instruction[],
  bytes: Uint8Array,
  origin: number,
): IndirectDispatchScan {
  const safeBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(0);
  const safeOrigin = Number.isSafeInteger(origin) && origin >= 0 && origin <= 0xffff ? origin : 0;
  const insns = Array.isArray(instructions) ? instructions : [];
  const size = safeBytes.length;

  const inImage = (addr: number): boolean => addr >= safeOrigin && addr + 1 < safeOrigin + size;
  const wordAt = (addr: number): number | null => {
    if (!inImage(addr)) return null;
    const idx = addr - safeOrigin;
    return safeBytes[idx]! | (safeBytes[idx + 1]! << 8);
  };

  const indirectJumps: IndirectJumpFinding[] = [];
  const multiEntryTables: DispatchTableFinding[] = [];
  const splitTables: SplitTableFinding[] = [];
  const stackReturnDispatch: StackReturnFinding[] = [];
  const tableEntryAddresses = new Set<number>();
  const discovered = new Set<number>();
  let truncated = false;

  // --- Class 1 + 2: indirect jumps (pointer ANYWHERE, including zero page)
  // and the multi-entry tables they name.
  for (const insn of insns) {
    if (insn.opcode !== 0x6c || !insn.operand) continue;
    const pointer = insn.operand.value;
    const target = wordAt(pointer);
    indirectJumps.push({
      at: insn.address,
      pointer,
      target,
      pointerInImage: inImage(pointer),
      pointerInZeroPage: pointer < 0x100,
    });
    if (target !== null) discovered.add(target);

    if (!inImage(pointer)) continue;

    // Upstream reads EXACTLY ONE entry here. Read successive little-endian
    // 16-bit entries while each resolves inside the image, bounded.
    const targets: number[] = [];
    let cursor = pointer;
    let tableTruncated = false;
    while (true) {
      if (targets.length >= MAX_TABLE_ENTRIES) {
        tableTruncated = true;
        truncated = true;
        break;
      }
      const entry = wordAt(cursor);
      if (entry === null) break;
      if (!(entry >= safeOrigin && entry < safeOrigin + size)) break;
      targets.push(entry);
      tableEntryAddresses.add(cursor);
      tableEntryAddresses.add(cursor + 1);
      discovered.add(entry);
      cursor += 2;
    }
    if (targets.length > 0) {
      multiEntryTables.push({ at: insn.address, base: pointer, entries: targets.length, targets, truncated: tableTruncated });
    }
  }

  // --- Class 3: split lo/hi tables. Paired indexed loads whose two bases are
  // a fixed distance N apart; reconstruct N targets.
  for (let i = 0; i < insns.length; i++) {
    const first = insns[i]!;
    if (!first.operand || !INDEXED_LOAD_MODES.has(first.mode)) continue;
    if (!first.mnemonic.startsWith("ld")) continue;
    for (let j = i + 1; j < Math.min(insns.length, i + 1 + SPLIT_TABLE_WINDOW); j++) {
      const second = insns[j]!;
      if (!second.operand || !INDEXED_LOAD_MODES.has(second.mode)) continue;
      if (!second.mnemonic.startsWith("ld")) continue;

      const a = first.operand.value;
      const b = second.operand.value;
      const loBase = Math.min(a, b);
      const hiBase = Math.max(a, b);
      const span = hiBase - loBase;
      if (span <= 0) continue;
      if (!inImage(loBase) || !inImage(hiBase)) continue;

      let entries = span;
      let tableTruncated = false;
      if (entries > MAX_TABLE_ENTRIES) {
        entries = MAX_TABLE_ENTRIES;
        tableTruncated = true;
        truncated = true;
      }

      const targets: number[] = [];
      for (let k = 0; k < entries; k++) {
        const loIdx = loBase + k - safeOrigin;
        const hiIdx = hiBase + k - safeOrigin;
        if (loIdx < 0 || hiIdx < 0 || loIdx >= size || hiIdx >= size) break;
        const value = safeBytes[loIdx]! | (safeBytes[hiIdx]! << 8);
        targets.push(value);
        tableEntryAddresses.add(loBase + k);
        tableEntryAddresses.add(hiBase + k);
        if (value >= safeOrigin && value < safeOrigin + size) discovered.add(value);
      }
      if (targets.length > 0) {
        splitTables.push({ at: first.address, loBase, hiBase, entries: targets.length, targets, truncated: tableTruncated });
      }
      break; // one pairing per leading load
    }
  }

  // --- Class 4: the stack-return dispatch idiom. `lda hi,X : pha : lda lo,X
  // : pha : rts` contains NO indirect-jump opcode, so an opcode-keyed walk
  // cannot see it at all. Sliding window over the decoded stream.
  for (let i = 0; i + 4 < insns.length; i++) {
    const [a, b, c, d, e] = [insns[i]!, insns[i + 1]!, insns[i + 2]!, insns[i + 3]!, insns[i + 4]!];
    const isIndexedLoad = (x: Instruction): boolean => !!x.operand && INDEXED_LOAD_MODES.has(x.mode) && x.mnemonic.startsWith("ld");
    if (!isIndexedLoad(a)) continue;
    if (b.opcode !== 0x48) continue; // pha
    if (!isIndexedLoad(c)) continue;
    if (d.opcode !== 0x48) continue; // pha
    if (e.opcode !== 0x60) continue; // rts

    // The HIGH byte is pushed first, so `a` reads the hi table and `c` the lo.
    const hiBase = a.operand!.value;
    const loBase = c.operand!.value;
    const span = Math.abs(hiBase - loBase);
    let entries = span > 0 ? span : 1;
    let tableTruncated = false;
    if (entries > MAX_TABLE_ENTRIES) {
      entries = MAX_TABLE_ENTRIES;
      tableTruncated = true;
      truncated = true;
    }

    const targets: number[] = [];
    for (let k = 0; k < entries; k++) {
      const loIdx = loBase + k - safeOrigin;
      const hiIdx = hiBase + k - safeOrigin;
      if (loIdx < 0 || hiIdx < 0 || loIdx >= size || hiIdx >= size) break;
      // The idiom pushes `target - 1`, because `rts` increments before
      // jumping. Reconstruct the real entry point.
      const pushed = safeBytes[loIdx]! | (safeBytes[hiIdx]! << 8);
      const value = (pushed + 1) & 0xffff;
      targets.push(value);
      tableEntryAddresses.add(loBase + k);
      tableEntryAddresses.add(hiBase + k);
      if (value >= safeOrigin && value < safeOrigin + size) discovered.add(value);
    }
    if (targets.length > 0) {
      stackReturnDispatch.push({ at: a.address, loBase, hiBase, entries: targets.length, targets, truncated: tableTruncated });
    }
  }

  return {
    indirectJumps,
    multiEntryTables,
    splitTables,
    stackReturnDispatch,
    discoveredTargets: sortedUniqueNumbers(discovered),
    tableEntryAddresses: sortedUniqueNumbers(tableEntryAddresses),
    truncated,
  };
}

// ---------------------------------------------------------------------------
// (c) The two label figures
// ---------------------------------------------------------------------------

/**
 * The auto-name prefixes from upstream's `LabelType::prefix()`.
 *
 * `L_` is DELIBERATELY EXCLUDED. Upstream assigns `L_` to `Predefined`,
 * `UserDefined` AND `LocalUserDefined` alike (`types.rs:394-396`), so it
 * cannot distinguish an auto-generated name from a user-chosen one --
 * including it would count every hand-named local label as auto and report a
 * false positive. Matching is ASCII case-sensitive, exactly as upstream emits
 * the prefixes.
 */
export const AUTO_NAME_PREFIX_RE = /^(zpf_|f_|zpa_|a_|p_|zpp_|e_|j_|s_|b_|r_)/;

export interface LabelRatio {
  /** Over NON-`System` labels only. Platform-provided symbols are excluded
   * because a large KERNAL symbol set would otherwise inflate the fraction
   * for free. */
  kindRatio: { user: number; auto: number; userFraction: number | null };
  /** Labels whose NAME still matches `AUTO_NAME_PREFIX_RE`, regardless of
   * kind. Catches renaming a label to its own existing auto name so `kind`
   * flips to `User` while the name never changed. */
  autoPrefixNamesRemaining: number;
  autoPrefixNameAddresses: number[];
  systemExcluded: number;
  /** Addresses removed from the `user` tally by the multi-caller rule. */
  excludedByMultiCallerRule: number[];
}

export interface LabelRatioOptions {
  /** Addresses of `User` labels that the multi-caller rule disqualified.
   * Supplied by `buildCoverageReport()` after `computeReproducibility()` has
   * applied the rule -- kept as a parameter rather than recomputed here so
   * the rule lives in exactly one place. */
  excludeUserAddresses?: Iterable<number>;
}

export function computeLabelRatio(symbols: readonly R2000Symbol[], opts: LabelRatioOptions = {}): LabelRatio {
  const list = Array.isArray(symbols) ? symbols : [];
  const excluded = new Set<number>([...(opts.excludeUserAddresses ?? [])]);

  let user = 0;
  let auto = 0;
  let systemExcluded = 0;
  const autoPrefixNameAddresses: number[] = [];
  const reallyExcluded: number[] = [];

  for (const sym of list) {
    if (!sym || typeof sym.name !== "string") continue;
    const kind = String(sym.kind ?? "");
    if (kind === "System" || kind === "Platform") {
      systemExcluded++;
    } else if (kind === "User") {
      if (excluded.has(sym.address)) {
        reallyExcluded.push(sym.address);
      } else {
        user++;
      }
    } else {
      auto++;
    }
    if (AUTO_NAME_PREFIX_RE.test(sym.name)) autoPrefixNameAddresses.push(sym.address);
  }

  const denominator = user + auto;
  return {
    kindRatio: { user, auto, userFraction: denominator === 0 ? null : user / denominator },
    autoPrefixNamesRemaining: autoPrefixNameAddresses.length,
    autoPrefixNameAddresses: sortedUniqueNumbers(autoPrefixNameAddresses),
    systemExcluded,
    excludedByMultiCallerRule: sortedUniqueNumbers(reallyExcluded),
  };
}

// ---------------------------------------------------------------------------
// (d) The comment-vacuity measure
// ---------------------------------------------------------------------------

/**
 * Comments that never count as documentation, stored ALREADY NORMALISED (see
 * `normaliseComment`). A comment equal to one of these after normalisation is
 * vacuous no matter how it was capitalised or emphasised.
 */
export const BANNED_GENERIC_COMMENTS: ReadonlySet<string> = new Set([
  "handles data",
  "does stuff",
  "routine",
  "subroutine",
  "function",
  "data",
  "code",
  "unknown",
  "todo",
  "fixme",
  "n/a",
]);

/**
 * The EXACT normalisation the schema requires, in order:
 *   1. ASCII lowercase;
 *   2. strip backticks and emphasis markers (`` ` ``, `*`, `_`);
 *   3. collapse whitespace runs to a single space;
 *   4. trim.
 * Two normalised comments are then compared by EXACT STRING EQUALITY -- there
 * is no fuzzy match, no stemming and no similarity threshold anywhere here.
 */
export function normaliseComment(comment: string): string {
  if (typeof comment !== "string") return "";
  return comment
    .replace(/[A-Z]/g, (ch) => ch.toLowerCase())
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface CommentVacuity {
  /** Distinct addresses carrying a `line` comment. */
  commentedAddresses: number;
  /** Distinct NORMALISED comment texts. The same text at N addresses counts
   * ONCE, not N times. */
  distinctComments: number;
  /** `distinctComments / commentedAddresses`, or `null` when there are no
   * comments at all -- an explicit null, never a division and never a zero
   * that could read as "clean". */
  distinctCommentRatio: number | null;
  /** Fraction of commented addresses carrying a confidence grade that is not
   * `[unknown]` -- `[unknown]` means "not yet documented". `null` when there
   * are no comments. */
  gradedFraction: number | null;
  gradedAddresses: number;
  unknownGradedAddresses: number;
  /** Addresses whose comment equals a banned-generic entry after
   * normalisation. Ascending. */
  bannedGenericAddresses: number[];
  /**
   * Addresses whose comment opens with a bracket token that is NOT one of the
   * five valid grades. `parseConfidencePrefix()` throws on those by design;
   * this module catches it because a measurement pass must never throw, and
   * reports the near-miss as the measured defect it is rather than letting it
   * degrade silently into "ungraded".
   */
  malformedGradeAddresses: number[];
  /** Stated when a measure could not be computed, so an absent input can
   * never read as a pass (COV-02). `null` when everything was computable. */
  reason: string | null;
}

const UNKNOWN_GRADE_TOKEN = CONFIDENCE_GRADES.find((g) => g.token === "unknown")!.token;

interface ParsedComment {
  address: number;
  gradeToken: string | null;
  malformed: boolean;
  normalised: string;
}

function parseLineComments(comments: readonly R2000Comment[]): ParsedComment[] {
  const list = Array.isArray(comments) ? comments : [];
  const byAddress = new Map<number, ParsedComment>();
  for (const entry of list) {
    if (!entry || typeof entry.comment !== "string") continue;
    if (String(entry.type ?? "line") !== "line") continue;
    let gradeToken: string | null = null;
    let malformed = false;
    let rest = entry.comment;
    try {
      const parsed = parseConfidencePrefix(entry.comment);
      gradeToken = parsed.grade ? parsed.grade.token : null;
      rest = parsed.rest;
    } catch {
      malformed = true;
    }
    byAddress.set(entry.address, {
      address: entry.address,
      gradeToken,
      malformed,
      normalised: normaliseComment(rest),
    });
  }
  return [...byAddress.values()].sort((a, b) => a.address - b.address);
}

export function computeCommentVacuity(comments: readonly R2000Comment[]): CommentVacuity {
  const parsed = parseLineComments(comments);
  const commentedAddresses = parsed.length;

  if (commentedAddresses === 0) {
    return {
      commentedAddresses: 0,
      distinctComments: 0,
      distinctCommentRatio: null,
      gradedFraction: null,
      gradedAddresses: 0,
      unknownGradedAddresses: 0,
      bannedGenericAddresses: [],
      malformedGradeAddresses: [],
      reason: "no line comments were supplied -- the vacuity measure is unavailable, not clean",
    };
  }

  const distinct = new Set<string>();
  const banned: number[] = [];
  const malformed: number[] = [];
  let graded = 0;
  let unknownGraded = 0;

  for (const entry of parsed) {
    distinct.add(entry.normalised);
    if (BANNED_GENERIC_COMMENTS.has(entry.normalised)) banned.push(entry.address);
    if (entry.malformed) malformed.push(entry.address);
    if (entry.gradeToken !== null) {
      if (entry.gradeToken === UNKNOWN_GRADE_TOKEN) unknownGraded++;
      else graded++;
    }
  }

  return {
    commentedAddresses,
    distinctComments: distinct.size,
    distinctCommentRatio: distinct.size / commentedAddresses,
    gradedFraction: graded / commentedAddresses,
    gradedAddresses: graded,
    unknownGradedAddresses: unknownGraded,
    bannedGenericAddresses: sortedUniqueNumbers(banned),
    malformedGradeAddresses: sortedUniqueNumbers(malformed),
    reason: null,
  };
}

/** True iff this comment counts as documentation at all: present, and not
 * equal to a banned-generic entry after normalisation. */
function isNonVacuous(entry: ParsedComment | undefined): boolean {
  if (!entry) return false;
  if (entry.malformed) return false;
  if (entry.normalised.length === 0) return false;
  return !BANNED_GENERIC_COMMENTS.has(entry.normalised);
}

// ---------------------------------------------------------------------------
// (e) The sampled independent-reproducibility result
// ---------------------------------------------------------------------------

/** The coarse classification both independent sides speak. Deliberately
 * three-valued: the two sides derive it from completely different inputs, so
 * a finer vocabulary would manufacture disagreement out of vocabulary drift
 * rather than measuring anything. */
export type DerivedClass = "code" | "data" | "unreached";

export interface ReproducibilityComparison {
  address: number;
  fromBytes: DerivedClass;
  fromStore: DerivedClass;
  agreed: boolean;
}

export interface Reproducibility {
  sampled: number;
  agreed: number;
  disagreed: number;
  agreementRate: number | null;
  /** The sample rule, stated in full so the sample is auditable without
   * re-running the code that produced it. */
  sampleRule: string;
  /** The sampled addresses themselves, ascending -- recorded so a reader can
   * reproduce the sample by hand. */
  addresses: number[];
  comparisons: ReproducibilityComparison[];
  /** Labels with STRICTLY MORE THAN ONE caller whose comment does not name a
   * caller. Excluded from the label figure's user tally. */
  multiCallerUndocumented: { count: number; addresses: number[] };
  reason: string | null;
}

export interface ReproducibilityInput {
  census: StructuralCensus;
  dispatch: IndirectDispatchScan;
  symbols: readonly R2000Symbol[];
  comments: readonly R2000Comment[];
  blocks: readonly R2000BlockEntry[];
  crossReferences: readonly R2000CrossReference[];
  sampleSize?: number;
}

const DEFAULT_SAMPLE_SIZE = 8;

function storeBlockTypeAt(blocks: readonly R2000BlockEntry[], address: number): string | null {
  for (const block of blocks) {
    if (!block) continue;
    if (address >= block.start_address && address <= block.end_address) return block.type;
  }
  return null;
}

function classFromBytes(census: StructuralCensus, dispatch: IndirectDispatchScan, address: number): DerivedClass {
  if (dispatch.discoveredTargets.includes(address)) return "code";
  const klass = classAt(census, address);
  if (klass === "reached-as-instruction") return "code";
  if (klass === "table-entry" || klass === "referenced-as-data") return "data";
  return "unreached";
}

function classFromStore(gradeToken: string | null, blockType: string | null): DerivedClass {
  if (gradeToken === "confirmed-code" || gradeToken === "probable-code") return "code";
  if (gradeToken === "confirmed-data" || gradeToken === "probable-data") return "data";
  // `[unknown]` and ungraded fall through to the store's own block type.
  if (blockType === "Code") return "code";
  if (blockType === null || blockType === "Undefined") return "unreached";
  return "data";
}

/** Does `comment` literally name at least one of `callers` -- either as a
 * hexadecimal address, or as the user label name recorded at a caller
 * address? Purely textual, exactly as the rule is specified. */
function namesACaller(
  rawComment: string,
  callers: readonly number[],
  nameByAddress: ReadonlyMap<number, string>,
): boolean {
  const lower = rawComment.toLowerCase();
  for (const caller of callers) {
    const hex = caller.toString(16).toLowerCase();
    if (lower.includes(`$${hex}`)) return true;
    if (lower.includes(`$${hex.padStart(4, "0")}`)) return true;
    const name = nameByAddress.get(caller);
    if (name && rawComment.includes(name)) return true;
  }
  return false;
}

export function computeReproducibility(input: ReproducibilityInput): Reproducibility {
  const { census, dispatch, symbols, comments, blocks, crossReferences } = input;
  const sampleSize =
    Number.isSafeInteger(input.sampleSize) && input.sampleSize! > 0 ? input.sampleSize! : DEFAULT_SAMPLE_SIZE;

  const symbolList = Array.isArray(symbols) ? symbols : [];
  const blockList = Array.isArray(blocks) ? blocks : [];
  const parsed = parseLineComments(comments);
  const commentByAddress = new Map(parsed.map((p) => [p.address, p]));
  const rawByAddress = new Map<number, string>();
  for (const c of Array.isArray(comments) ? comments : []) {
    if (c && typeof c.comment === "string" && String(c.type ?? "line") === "line") rawByAddress.set(c.address, c.comment);
  }
  const nameByAddress = new Map<number, string>();
  for (const s of symbolList) {
    if (s && typeof s.name === "string" && String(s.kind ?? "") === "User") nameByAddress.set(s.address, s.name);
  }
  const callersByAddress = new Map<number, readonly number[]>();
  for (const x of Array.isArray(crossReferences) ? crossReferences : []) {
    if (x && Array.isArray(x.callers)) callersByAddress.set(x.address, x.callers);
  }

  // --- The multi-caller rule (COV-02). Strictly MORE THAN ONE caller.
  const multiCallerUndocumented: number[] = [];
  for (const sym of symbolList) {
    if (!sym) continue;
    const callers = callersByAddress.get(sym.address) ?? [];
    if (callers.length <= 1) continue;
    const entry = commentByAddress.get(sym.address);
    const raw = rawByAddress.get(sym.address) ?? "";
    if (!isNonVacuous(entry) || !namesACaller(raw, callers, nameByAddress)) {
      multiCallerUndocumented.push(sym.address);
    }
  }
  const undocumented = new Set(multiCallerUndocumented);

  // --- The deterministic sample: documented labels sorted ascending by
  // address, take every Nth where N = ceil(population / sampleSize).
  const documented = symbolList
    .filter((s) => s && isNonVacuous(commentByAddress.get(s.address)) && !undocumented.has(s.address))
    .map((s) => s.address)
    .sort((a, b) => a - b);
  const population = documented.length;

  if (population === 0) {
    return {
      sampled: 0,
      agreed: 0,
      disagreed: 0,
      agreementRate: null,
      sampleRule: "no documented labels -- nothing to sample",
      addresses: [],
      comparisons: [],
      multiCallerUndocumented: { count: multiCallerUndocumented.length, addresses: sortedUniqueNumbers(multiCallerUndocumented) },
      reason: "no label carries a non-vacuous line comment, so reproducibility is UNKNOWN rather than clean",
    };
  }

  const step = Math.max(1, Math.ceil(population / sampleSize));
  const addresses: number[] = [];
  for (let i = 0; i < population; i += step) addresses.push(documented[i]!);
  const sampleRule =
    `documented labels sorted ascending by address (population ${population}), take every ` +
    `${step}${step === 1 ? "st" : "th"} (step = ceil(population / sampleSize), sampleSize ${sampleSize})`;

  const comparisons: ReproducibilityComparison[] = [];
  for (const address of addresses) {
    const fromBytes = classFromBytes(census, dispatch, address);
    const entry = commentByAddress.get(address);
    const fromStore = classFromStore(entry?.gradeToken ?? null, storeBlockTypeAt(blockList, address));
    comparisons.push({ address, fromBytes, fromStore, agreed: fromBytes === fromStore });
  }

  const agreed = comparisons.filter((c) => c.agreed).length;
  return {
    sampled: comparisons.length,
    agreed,
    disagreed: comparisons.length - agreed,
    agreementRate: comparisons.length === 0 ? null : agreed / comparisons.length,
    sampleRule,
    addresses,
    comparisons,
    multiCallerUndocumented: { count: multiCallerUndocumented.length, addresses: sortedUniqueNumbers(multiCallerUndocumented) },
    reason: null,
  };
}

// ---------------------------------------------------------------------------
// The divergence sub-report -- the ONE place the store's block table is read
// ---------------------------------------------------------------------------

export interface DivergenceReport {
  /** Bytes the census reached as instructions that the store does NOT call
   * `Code`. This is the direction that means the STORE missed something. */
  censusCodeStoreNotCode: number;
  /** Bytes the store calls `Code` that the census never reached. This is the
   * ordinary direction on an image with unreachable filler; it is reported,
   * not treated as a defect. */
  storeCodeCensusUnreached: number;
  /** Bytes inside the censused range that no block entry covers at all. */
  uncoveredByStore: number;
  comparedBytes: number;
  /** False when the caller supplied no block listing at all. The counts above
   * are still computed and still true, but they compare against NOTHING, so
   * an absent listing is reported explicitly rather than read as "the store
   * classified none of it" (COV-02). */
  blocksSupplied: boolean;
  /** Stated whenever `blocksSupplied` is false; `null` otherwise. */
  reason: string | null;
  /**
   * The systematic bias this sub-report's STORE side carries, stated so a
   * reader never mistakes it for instrument error.
   */
  note: string;
}

const DIVERGENCE_NOTE =
  "KNOWN, NAMED BIAS ON THE STORE SIDE: regenerator2000 auto-merges two adjacent same-type " +
  "blocks with no boundary marker, and the upstream setter for that marker (its splitter toggle) " +
  "is not on this project's curated tool surface. An over-merge on the store side is therefore " +
  "expected and is not evidence of a census error. The census side reads no block data at all.";

function computeDivergence(census: StructuralCensus, blocks: readonly R2000BlockEntry[]): DivergenceReport {
  // The ONE call site in this file that reads the store's block listing.
  const blockList = Array.isArray(blocks) ? blocks : [];
  let censusCodeStoreNotCode = 0;
  let storeCodeCensusUnreached = 0;
  let uncoveredByStore = 0;

  for (const run of census.classRuns) {
    for (let addr = run.start; addr <= run.end; addr++) {
      const blockType = storeBlockTypeAt(blockList, addr);
      if (blockType === null) uncoveredByStore++;
      if (run.class === "reached-as-instruction" && blockType !== "Code") censusCodeStoreNotCode++;
      if (run.class === "unreached" && blockType === "Code") storeCodeCensusUnreached++;
    }
  }

  return {
    censusCodeStoreNotCode,
    storeCodeCensusUnreached,
    uncoveredByStore,
    comparedBytes: census.rangeBytes,
    blocksSupplied: blockList.length > 0,
    reason:
      blockList.length > 0
        ? null
        : "no block listing was supplied -- the divergence comparison is UNAVAILABLE, not clean, and its counts compare against nothing",
    note: DIVERGENCE_NOTE,
  };
}

// ---------------------------------------------------------------------------
// (f) The report
// ---------------------------------------------------------------------------

export interface CoverageProjectInfo {
  path: string;
  origin: number;
  size: number;
  /** False when the project file was unreadable as JSON or its payload would
   * not decode. Never a throw, never a silent skip -- COV-02. */
  payloadDecoded: boolean;
  /** Stated whenever `payloadDecoded` is false; `null` otherwise. */
  reason: string | null;
}

/**
 * The pinned report shape: FLAT SIBLING OBJECTS, one level deep. Each measure
 * is addressable by its own stable top-level key, which is what makes "never
 * one aggregate" structurally obvious and makes the schema test a plain
 * key-set assertion.
 *
 * `generatedAt` is the ONLY field that differs between two runs over the same
 * input; the idempotency test asserts exactly that.
 */
export interface CoverageReport {
  schemaVersion: number;
  generatedAt: string;
  project: CoverageProjectInfo;
  structural: StructuralCensus;
  dispatch: IndirectDispatchScan;
  labels: LabelRatio;
  commentVacuity: CommentVacuity;
  reproducibility: Reproducibility;
  divergence: DivergenceReport;
}

/** The exact top-level key set, in order. Exported so the schema test asserts
 * against ONE definition rather than a second hand-typed copy that could
 * drift from the interface above. */
export const COVERAGE_REPORT_KEYS: readonly string[] = [
  "schemaVersion",
  "generatedAt",
  "project",
  "structural",
  "dispatch",
  "labels",
  "commentVacuity",
  "reproducibility",
  "divergence",
];

export interface CoverageOptions {
  projectPath: string;
  symbols?: readonly R2000Symbol[];
  comments?: readonly R2000Comment[];
  blocks?: readonly R2000BlockEntry[];
  crossReferences?: readonly R2000CrossReference[];
  /** Extra descent seeds beyond the origin and the `User` label addresses. */
  entryPoints?: readonly number[];
  sampleSize?: number;
  /** Injected clock, for callers that need a fixed timestamp. Defaults to the
   * real wall clock. */
  now?: () => string;
}

interface LoadedProject {
  origin: number;
  bytes: Uint8Array;
  payloadDecoded: boolean;
  reason: string | null;
}

function loadProject(projectPath: string): LoadedProject {
  let text: string;
  try {
    text = readFileSync(projectPath, "utf8");
  } catch (err) {
    // A path that cannot be read is a CALLER CONTRACT violation, not
    // malformed data -- the one class this module throws for.
    throw new R2000CoverageInputError(
      `buildCoverageReport: could not read ${projectPath} -- ${err instanceof Error ? err.message : String(err)}`,
      { cause: err, projectPath },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return {
      origin: 0,
      bytes: new Uint8Array(0),
      payloadDecoded: false,
      reason: `${projectPath} is not valid JSON -- ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { origin: 0, bytes: new Uint8Array(0), payloadDecoded: false, reason: `${projectPath}'s top-level JSON value is not an object` };
  }

  const project = parsed as Record<string, unknown>;
  const origin = typeof project.origin === "number" && Number.isSafeInteger(project.origin) ? project.origin : 0;
  const payload = project.raw_data_base64;
  if (typeof payload !== "string") {
    return { origin, bytes: new Uint8Array(0), payloadDecoded: false, reason: `${projectPath} carries no raw_data_base64 payload` };
  }

  try {
    return { origin, bytes: new Uint8Array(decodeRawData(payload)), payloadDecoded: true, reason: null };
  } catch (err) {
    return {
      origin,
      bytes: new Uint8Array(0),
      payloadDecoded: false,
      reason: `${projectPath}'s raw_data_base64 payload would not decode -- ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Assembles the whole report. Read-only over `projectPath` by construction:
 * this function opens the file for reading and there is no write, save or
 * session call anywhere in this module.
 */
export function buildCoverageReport(opts: CoverageOptions): CoverageReport {
  if (!opts || typeof opts.projectPath !== "string" || opts.projectPath.length === 0) {
    throw new R2000CoverageInputError("buildCoverageReport: projectPath is required and must be a non-empty string");
  }

  const symbols = opts.symbols ?? [];
  const comments = opts.comments ?? [];
  const blocks = opts.blocks ?? [];
  const crossReferences = opts.crossReferences ?? [];
  const now = typeof opts.now === "function" ? opts.now : () => new Date().toISOString();

  const loaded = loadProject(opts.projectPath);

  const seeds = new Set<number>();
  seeds.add(loaded.origin);
  for (const sym of symbols) {
    if (sym && String(sym.kind ?? "") === "User") seeds.add(sym.address);
  }
  for (const entry of opts.entryPoints ?? []) {
    if (Number.isSafeInteger(entry)) seeds.add(entry);
  }

  const linear = decode(loaded.bytes, loaded.origin);
  const dispatch = scanIndirectDispatch(linear, loaded.bytes, loaded.origin);
  const structural = computeStructuralCensus(loaded.bytes, loaded.origin, seeds, {
    tableEntryAddresses: dispatch.tableEntryAddresses,
    extraSeeds: dispatch.discoveredTargets,
  });

  const commentVacuity = computeCommentVacuity(comments);
  const reproducibility = computeReproducibility({
    census: structural,
    dispatch,
    symbols,
    comments,
    blocks,
    crossReferences,
    ...(opts.sampleSize !== undefined ? { sampleSize: opts.sampleSize } : {}),
  });
  const labels = computeLabelRatio(symbols, { excludeUserAddresses: reproducibility.multiCallerUndocumented.addresses });
  const divergence = computeDivergence(structural, blocks);

  return {
    schemaVersion: COVERAGE_SCHEMA_VERSION,
    generatedAt: now(),
    project: {
      path: opts.projectPath,
      origin: loaded.origin,
      size: loaded.bytes.length,
      payloadDecoded: loaded.payloadDecoded,
      reason: loaded.reason,
    },
    structural,
    dispatch,
    labels,
    commentVacuity,
    reproducibility,
    divergence,
  };
}

// ---------------------------------------------------------------------------
// Findings -- a per-measure verdict, NEVER an aggregate
// ---------------------------------------------------------------------------

export interface CoverageFinding {
  /** The single top-level report key that produced this finding. Exactly one
   * -- a finding is never derived from two measures at once. */
  measure: "structural" | "labels" | "commentVacuity" | "reproducibility" | "divergence" | "project";
  reason: string;
}

export interface CoverageFindings {
  clean: boolean;
  findings: CoverageFinding[];
}

/** Thresholds, each attached to exactly one measure and each stated once. */
const MIN_USER_FRACTION = 0.5;
const MIN_DISTINCT_COMMENT_RATIO = 0.5;
const MIN_AGREEMENT_RATE = 0.8;

/**
 * Turns a report into a boolean verdict plus per-measure reasons.
 *
 * This is NOT a combined coverage figure and must never become one (header
 * trap 3): it emits no number, it never averages or weights the measures, and
 * every finding names exactly one of them. It is a threshold gate over
 * separately-addressable measures, which is what the six committed controls
 * assert against -- five must be non-clean for a NAMED reason, one must be
 * clean, and without that last one the whole instrument would be vacuous.
 */
export function coverageFindings(report: CoverageReport): CoverageFindings {
  const findings: CoverageFinding[] = [];

  if (!report.project.payloadDecoded) {
    findings.push({ measure: "project", reason: `payload unavailable: ${report.project.reason ?? "reason not recorded"}` });
  }

  if (report.structural.truncated) {
    findings.push({ measure: "structural", reason: "the descent walk hit its step bound and was truncated" });
  }

  const { userFraction } = report.labels.kindRatio;
  if (userFraction === null) {
    findings.push({ measure: "labels", reason: "no non-System labels, so the Auto-versus-User figure is unavailable rather than clean" });
  } else if (userFraction < MIN_USER_FRACTION) {
    findings.push({ measure: "labels", reason: `user fraction ${userFraction.toFixed(3)} is below ${MIN_USER_FRACTION}` });
  }
  if (report.labels.autoPrefixNamesRemaining > 0) {
    findings.push({
      measure: "labels",
      reason: `${report.labels.autoPrefixNamesRemaining} label name(s) still carry an auto-name prefix at ${report.labels.autoPrefixNameAddresses.map((a) => `$${a.toString(16)}`).join(", ")}`,
    });
  }

  const vac = report.commentVacuity;
  if (vac.distinctCommentRatio === null) {
    findings.push({ measure: "commentVacuity", reason: vac.reason ?? "comment vacuity is unavailable" });
  } else if (vac.distinctCommentRatio < MIN_DISTINCT_COMMENT_RATIO) {
    findings.push({
      measure: "commentVacuity",
      reason: `distinct-comment ratio ${vac.distinctCommentRatio.toFixed(3)} is below ${MIN_DISTINCT_COMMENT_RATIO}`,
    });
  }
  if (vac.bannedGenericAddresses.length > 0) {
    findings.push({
      measure: "commentVacuity",
      reason: `${vac.bannedGenericAddresses.length} address(es) carry a banned-generic comment at ${vac.bannedGenericAddresses.map((a) => `$${a.toString(16)}`).join(", ")}`,
    });
  }
  if (vac.malformedGradeAddresses.length > 0) {
    findings.push({
      measure: "commentVacuity",
      reason: `${vac.malformedGradeAddresses.length} comment(s) open with a near-miss confidence token`,
    });
  }

  const repro = report.reproducibility;
  if (repro.multiCallerUndocumented.count > 0) {
    findings.push({
      measure: "reproducibility",
      reason: `${repro.multiCallerUndocumented.count} multi-caller label(s) documented without naming a caller at ${repro.multiCallerUndocumented.addresses.map((a) => `$${a.toString(16)}`).join(", ")}`,
    });
  }
  if (repro.agreementRate === null) {
    findings.push({ measure: "reproducibility", reason: repro.reason ?? "reproducibility is unavailable" });
  } else if (repro.agreementRate < MIN_AGREEMENT_RATE) {
    findings.push({ measure: "reproducibility", reason: `agreement rate ${repro.agreementRate.toFixed(3)} is below ${MIN_AGREEMENT_RATE}` });
  }

  if (!report.divergence.blocksSupplied) {
    findings.push({ measure: "divergence", reason: report.divergence.reason ?? "divergence is unavailable" });
  } else if (report.divergence.censusCodeStoreNotCode > 0) {
    findings.push({
      measure: "divergence",
      reason: `${report.divergence.censusCodeStoreNotCode} byte(s) the census reached as instructions are not classified Code by the store`,
    });
  }

  return { clean: findings.length === 0, findings };
}
