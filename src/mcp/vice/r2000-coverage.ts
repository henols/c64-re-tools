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
//   - the DISPATCH-CONTEXT GATE that decides whether a Class-3 split lo/hi
//     pairing is PROVEN or merely ADVISORY -- same index register, a dispatch
//     consumer in evidence, every reconstructed target in-image and decodable,
//     and a lo/hi orientation something other than address order determined.
//     An ungated pairing is reported in `splitTableCandidates`, contributes
//     nothing to `discoveredTargets` and nothing to `tableEntryAddresses`;
//   - `provenDispatchTargets()` -- the ONE seam that decides what may seed a
//     recursive descent. Every `extraSeeds:` assignment in this file reads it
//     and reads nothing else;
//   - the two label figures (`computeLabelRatio`), one of which is gameable
//     and one of which is not;
//   - the comment-vacuity measure (`computeCommentVacuity`) and its exact
//     normalisation rules;
//   - the sampled reproducibility result (`computeReproducibility`), its
//     deterministic sample rule, and the ANCHORED multi-caller rule
//     (`namesACaller`) -- a caller reference is a DELIMITED token, never a
//     substring, so a comment mentioning an unrelated address whose leading
//     digits coincide with a caller's short form buys nothing;
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
//   8. NEVER promote a RECONSTRUCTED value to a descent seed without evidence
//      that something dispatches through it. Two indexed loads inside eight
//      instructions of each other is the single most ordinary shape in C64
//      code -- a screen-plus-colour copy loop -- and reading the bytes at
//      their two operand bases as a lo/hi address table turns ordinary DATA
//      into `reached-as-instruction`, which trap 2 defines as REACHED BY
//      RECURSIVE DESCENT FROM A SEED. The census's whole meaning is that
//      reachability was PROVEN; injecting arbitrary data into the seed set
//      destroys that meaning by the other route, without ever touching the
//      linear-sweep figure trap 2 guards. Reproduced at report level before
//      the gate landed: two 64-byte programs at $0810 with 7 bytes of real
//      code each, differing ONLY in immediate versus indexed addressing,
//      reported reached=7 and reached=55. Adding a source to
//      `provenDispatchTargets()` IS the decision to treat that source as
//      proof of code -- make it deliberately or not at all.
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
 *
 * VERSION HISTORY
 *   1 -- the original nine top-level keys.
 *   2 -- the top-level key set is UNCHANGED; the `dispatch` sub-object's
 *        target vocabulary changed. `discoveredTargets` narrowed to
 *        EVIDENCE-BACKED targets only, and the ungated split lo/hi pairings
 *        it used to include moved to the new advisory sibling
 *        `splitTableCandidates`. A consumer reading `discoveredTargets` gets
 *        a smaller, honest set than it did at version 1; this bump is the
 *        signal that a nested meaning changed. Accepted by a human at
 *        19-08's decision checkpoint (option `narrow-and-add-sibling`),
 *        which also discharged 19-VERIFICATION.md's `human_verification`
 *        item 2.
 */
export const COVERAGE_SCHEMA_VERSION = 2;

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
/** How many decoded instructions the class-3 pairing window spans, and the
 * `reach` every `hasDispatchContext()` / `resolveSplitOrientation()` call is
 * given. EXPORTED so the gate-interior witness in `r2000-coverage.test.ts` can
 * ask its question over the same window the predicate rules on, rather than
 * over a number typed into a test that could silently drift from this one. */
export const SPLIT_TABLE_WINDOW = 8;

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

  // IN-04. The censused range is bounded at the 16-bit address space, not at
  // `origin + size`. A payload whose origin plus length runs past $FFFF is
  // MALFORMED INPUT -- a `.regen2000proj` file the operator did not author
  // can claim any origin and carry any length -- and this module's contract
  // on malformed input is to produce a well-formed census, never to wrap and
  // never to classify an address the machine cannot address. Bytes at or
  // beyond $10000 are not classified, not counted, and not swept.
  const effectiveEnd = Math.min(safeOrigin + size, 0x10000);
  const rangeSize = Math.max(0, effectiveEnd - safeOrigin);

  // Class codes are indices into CLASS_ORDER. A zero-initialised array would
  // mean "reached-as-instruction", which is exactly the wrong default for an
  // instrument whose entire point is that reachability must be PROVEN, so
  // fill with 3 ("unreached") explicitly.
  const classes = new Uint8Array(rangeSize);
  classes.fill(3);

  const inRange = (addr: number): boolean => addr >= safeOrigin && addr < effectiveEnd;
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

  // Linear-sweep decodability -- reported, never summed. See trap 2. Swept
  // over the SAME bounded range as the census, so the two figures describe
  // the same bytes (IN-04).
  let linearSweepDecodable = 0;
  for (const insn of decode(safeBytes.subarray(0, rangeSize), safeOrigin)) {
    if (insn.illegal) continue;
    if (insn.notes.includes("truncated")) continue;
    linearSweepDecodable += insn.bytes.length;
  }

  const counts = [0, 0, 0, 0];
  for (let i = 0; i < rangeSize; i++) {
    const code = classes[i]!;
    counts[code] = counts[code]! + 1;
  }

  return {
    origin: safeOrigin,
    // `size` is the payload's own length; `rangeBytes` is how much of it lies
    // inside the 16-bit address space and was therefore censused. The two
    // differ only for a malformed origin/length pair (IN-04).
    size,
    rangeBytes: rangeSize,
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
  /** True only when something OTHER THAN ADDRESS ORDER decided which base
   * holds the low bytes -- for Class 3 that is the pairing's own store
   * construction (the load whose value reaches the LOWER of two consecutive
   * zero-page addresses is the lo table).
   *
   * WR-01 is why this field exists: the shipped scan assigned the roles with
   * `Math.min`/`Math.max` over the two operand addresses, which is not
   * evidence of anything, and on the stack-return idiom it produced a
   * byte-swapped twin of a finding the OTHER class had already reported
   * correctly ($05c0 for $c005). When this is false the finding is ADVISORY,
   * `loBase`/`hiBase` are recorded in ENCOUNTER order with no claim about
   * which is which, and `targets` is EMPTY -- a byte-swapped value is not an
   * address and must never be printed as one. */
  orientationResolved: boolean;
}

export interface StackReturnFinding {
  /** Address of the first instruction of the matched idiom. */
  at: number;
  loBase: number;
  hiBase: number;
  entries: number;
  targets: number[];
  truncated: boolean;
  /** Always `true` for this class, and stated rather than implied: the 6502
   * pushes the HIGH byte first, so the idiom's own push order -- not address
   * order -- names which base holds which half. This is the one place a lo/hi
   * assignment was always justified, which is why Class 4 runs first and
   * Class 3 declines any window it claimed (WR-01). */
  orientationResolved: true;
}

export interface IndirectDispatchScan {
  indirectJumps: IndirectJumpFinding[];
  /** PROVEN Class-3 pairings only: those that passed the dispatch-context
   * gate. An ungated pairing is in `splitTableCandidates`, never here. */
  splitTables: SplitTableFinding[];
  multiEntryTables: DispatchTableFinding[];
  stackReturnDispatch: StackReturnFinding[];
  /** ADVISORY Class-3 pairings: two indexed loads that LOOK like a split
   * lo/hi table but carry no evidence that anything dispatches through them.
   *
   * Reported BESIDE the proven classes and NEVER summed into them -- exactly
   * the discipline `linearSweepDecodable` carries (header trap 2), and for
   * exactly the same reason. An advisory pairing contributes nothing to
   * `discoveredTargets`, nothing to `tableEntryAddresses`, and therefore
   * moves not one byte of the census.
   *
   * It exists so the observation is not DISCARDED: "something indexes two
   * tables here and we cannot prove what it dispatches to" is precisely what
   * Phase 21's hazard report wants to see, flagged as unproven. Its findings
   * carry `orientationResolved: false` and an empty `targets` list. */
  splitTableCandidates: SplitTableFinding[];
  /** Every EVIDENCE-BACKED target the scan discovered, ascending and deduped:
   * real `jmp ($nnnn)` targets, the multi-entry tables those jumps name, the
   * stack-return idiom's push-order-justified reconstruction, and PROVEN
   * split tables. Reconstructed values from ungated pairings are NOT here --
   * that narrowing is the schema-version-2 change (header trap 8).
   *
   * An ADDRESS LIST, not a figure -- the classes stay separately addressable
   * above so Phase 21's hazard report can consume just the one it needs. */
  discoveredTargets: number[];
  /** Addresses occupied by reconstructed table entries (two bytes each).
   * Proven classes only, for the same reason as `discoveredTargets`. */
  tableEntryAddresses: number[];
  truncated: boolean;
}

const INDEXED_LOAD_MODES = new Set(["absolute_x", "absolute_y", "zeropage_x"]);

/** The index register an indexed addressing mode reads, or `null` for a mode
 * that indexes through neither. Compared instead of mere membership in
 * `INDEXED_LOAD_MODES`, so an `absolute_x` load paired with an `absolute_y`
 * load is not mistaken for a lo/hi pair: two tables walked by two different
 * registers are two tables, not one split one. */
function indexRegisterOf(insn: Instruction): "x" | "y" | null {
  if (insn.mode === "absolute_x" || insn.mode === "zeropage_x") return "x";
  if (insn.mode === "absolute_y" || insn.mode === "zeropage_y") return "y";
  return null;
}

/** True iff both instructions index through the SAME register. */
function sameIndexRegister(a: Instruction, b: Instruction): boolean {
  const ra = indexRegisterOf(a);
  return ra !== null && ra === indexRegisterOf(b);
}

const STORE_MNEMONICS = new Set(["sta", "stx", "sty"]);

/** True iff `insn` stores into a zero-page location. */
function zeroPageStoreTarget(insn: Instruction): number | null {
  if (!insn.operand) return null;
  if (!STORE_MNEMONICS.has(insn.mnemonic)) return null;
  if (insn.operand.role !== "zeropage") return null;
  return insn.operand.value;
}

/**
 * The COMPLETE, frozen list of shapes `hasDispatchContext()` accepts as proof
 * that something dispatches through a reconstructed pair of tables. One stable
 * string id per sufficient shape, in the order the predicate tests them.
 *
 * A SHAPE LISTED HERE IS THE DECISION TO TREAT THAT SHAPE AS PROOF OF CODE --
 * the same decision `provenDispatchTargets()`'s doc comment describes, made one
 * level down. The class-3 gate reads this predicate, and `splitTables` is one
 * of the four sources that seam publishes, so a shape admitted here becomes a
 * recursive-descent seed and turns whatever it points at into headline
 * `reachedAsInstruction`.
 *
 * ADDING A SHAPE HERE WITHOUT A NEGATIVE CONTROL THAT REACHES ITS INTERIOR
 * FAILS THE TEST SUITE BY NAME. `r2000-coverage.test.ts`'s
 * `GATE_INTERIOR_DECLARATIONS` must claim every id in this array, and a
 * declaration is checked mechanically by a witness that decodes the payload --
 * not accepted as a claim. That mechanism exists because CR-04 was a real
 * false-positive route that a 2517-passing suite concealed: every negative
 * control the gate had bracketed it from the OUTSIDE, and a negative control
 * built from the outside of the predicate it constrains is not a control.
 *
 * The count is also tied to the predicate mechanically: a test reads
 * `hasDispatchContext()`'s body from this module's source text and asserts that
 * the number of true-returning sites in it equals this array's length, so a
 * fourth branch added without a matching id reds the suite rather than sliding
 * through a hand-maintained mirror.
 */
export const DISPATCH_CONTEXT_SHAPES: readonly string[] = Object.freeze([
  "stack-return-push-idiom",
  "zeropage-vector-jumped-through",
]);

/**
 * Does the instruction window starting at `start` carry evidence that
 * something DISPATCHES through a reconstructed pair of tables?
 *
 * Accepts either ONE of the two shapes named in `DISPATCH_CONTEXT_SHAPES`:
 *
 *   - `stack-return-push-idiom` -- a `pha` ... `pha` ... `rts` shape within
 *     reach. After the Class-4 pass runs FIRST and claims its windows, a
 *     pairing inside such a window is skipped outright rather than promoted
 *     here; the condition is kept so this function reads as a COMPLETE
 *     statement of what counts as dispatch context, not as a partial one whose
 *     omissions must be inferred.
 *   - `zeropage-vector-jumped-through` -- two stores into CONSECUTIVE zero-page
 *     addresses within reach AND an indirect jump within reach whose pointer is
 *     the LOWER of those two addresses. That is the classic "build a vector in
 *     zero page, then `jmp (vector)`" idiom, matched END TO END.
 *
 * WHY THE CONSTRUCTION ALONE IS NOT EVIDENCE (CR-04). Two stores into
 * consecutive zero-page addresses is how EVERY 16-bit pointer on a 6502 is
 * built, and `lda ($fb),y` -- indirect-indexed DATA access, far more common in
 * real code than indirect jump -- needs exactly the identical construction.
 * A predicate that never looks at what CONSUMES the vector it saw being built
 * cannot tell a jump table from a screen pointer, and every ordinary pointer
 * setup then promotes its data to `reachedAsInstruction`. So a bare
 * indirect-jump opcode "within reach" is not accepted either: an indirect jump
 * through some OTHER vector near two indexed loads is not evidence that those
 * loads feed it. The operand value must equal the vector that was built.
 */
function hasDispatchContext(insns: readonly Instruction[], start: number, reach: number): boolean {
  const end = Math.min(insns.length, start + reach + 1);

  let sawPha = 0;
  const zpStores: number[] = [];
  /** The pointer each indirect jump in the window dispatches THROUGH, collected
   * rather than treated as sufficient on sight -- see the doc comment. */
  const indirectJumpPointers: number[] = [];
  for (let k = start; k < end; k++) {
    const insn = insns[k]!;
    if (insn.opcode === 0x6c && insn.operand) indirectJumpPointers.push(insn.operand.value);
    if (insn.opcode === 0x48) sawPha++;
    // `stack-return-push-idiom`
    if (insn.opcode === 0x60 && sawPha >= 2) return true;
    const zp = zeroPageStoreTarget(insn);
    if (zp !== null) zpStores.push(zp);
  }

  // `zeropage-vector-jumped-through`. `b - a === 1` (never `Math.abs`) so `a`
  // is the LOWER of the two, which on a little-endian 6502 vector is the byte
  // an indirect jump names. An exact numeric equality on the zero-page address
  // -- `jmp ($00fb)` decodes to operand.value 0xfb and `sta $fb` to operand
  // .value 0xfb -- never a string or hex-text comparison.
  for (const a of zpStores) {
    for (const b of zpStores) {
      if (b - a !== 1) continue;
      if (indirectJumpPointers.includes(a)) return true;
    }
  }
  return false;
}

/**
 * Which of two indexed loads feeds the LOW byte, decided by the pairing's own
 * store construction rather than by address order (WR-01).
 *
 * For each load, the nearest FOLLOWING zero-page store within reach is the
 * store that consumes it. When the two loads are consumed by two DIFFERENT,
 * CONSECUTIVE zero-page addresses, the one reaching the lower address holds
 * the low byte -- a 6502 vector is little-endian, so that is a fact about the
 * construction, not a convention. Any other shape returns `null`, and a
 * `null` orientation makes the pairing ADVISORY however good its other
 * evidence is: an unresolved orientation would otherwise be resolved by
 * `Math.min`, which is the exact defect this replaces.
 */
function resolveSplitOrientation(
  insns: readonly Instruction[],
  firstIndex: number,
  secondIndex: number,
  reach: number,
): { loBase: number; hiBase: number } | null {
  const consumerOf = (from: number): number | null => {
    const end = Math.min(insns.length, from + reach + 1);
    for (let k = from + 1; k < end; k++) {
      const zp = zeroPageStoreTarget(insns[k]!);
      if (zp !== null) return zp;
    }
    return null;
  };

  const firstZp = consumerOf(firstIndex);
  const secondZp = consumerOf(secondIndex);
  if (firstZp === null || secondZp === null) return null;
  if (Math.abs(firstZp - secondZp) !== 1) return null;

  const firstBase = insns[firstIndex]!.operand!.value;
  const secondBase = insns[secondIndex]!.operand!.value;
  return firstZp < secondZp
    ? { loBase: firstBase, hiBase: secondBase }
    : { loBase: secondBase, hiBase: firstBase };
}

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

  /**
   * Is `value` an address a program could actually be ENTERED at -- strictly
   * inside the image, and on a byte that decodes as a legal, non-truncated
   * instruction?
   *
   * The ONE predicate both gated reconstructions read: class 3's condition (e)
   * and the class-4 walk's condition (d). Extracted rather than written twice
   * (WR-14) because the two halves of `provenDispatchTargets()` were held to
   * DIFFERENT standards for exactly as long as this test existed in only one
   * of them. A value pointing at a byte that does not decode is not an entry
   * point, and a mid-instruction address is not evidence of code however
   * confidently it is printed.
   */
  const isPlausibleEntryPoint = (value: number): boolean => {
    if (!(value >= safeOrigin && value < safeOrigin + size)) return false;
    const decoded = decode(safeBytes.subarray(value - safeOrigin), value, { count: 1 })[0];
    return !!decoded && !decoded.illegal && !decoded.notes.includes("truncated");
  };

  const indirectJumps: IndirectJumpFinding[] = [];
  const multiEntryTables: DispatchTableFinding[] = [];
  const splitTables: SplitTableFinding[] = [];
  const splitTableCandidates: SplitTableFinding[] = [];
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

  // --- Class 4: the stack-return dispatch idiom. `lda hi,X : pha : lda lo,X
  // : pha : rts` contains NO indirect-jump opcode, so an opcode-keyed walk
  // cannot see it at all. Sliding window over the decoded stream.
  //
  // THIS PASS RUNS BEFORE CLASS 3, DELIBERATELY (WR-01). The idiom's hi/lo
  // assignment is JUSTIFIED -- the 6502 pushes the high byte first, so the
  // first load reads the hi table -- whereas the Class-3 pass has no such
  // evidence. Where both would match the same five instructions, the
  // justified one must win and the other must not be reported at all;
  // otherwise the same two instructions appear twice with contradictory
  // roles, and the byte-swapped twin ($09c0 for $c009) is emitted as if it
  // were an address. Every instruction of a matched window is recorded here
  // and the Class-3 pass declines any pairing whose leading load sits in one.
  //
  // GATED TO THE SAME STANDARD AS CLASS 3 (WR-14). This pass feeds the same
  // `provenDispatchTargets()` seam class 3 feeds, and gating one half of a
  // seam while the other half is ungated is not a gate. A window is PROVEN
  // only when ALL of:
  //   (a) the five instructions match the shape: indexed load, `pha`, indexed
  //       load, `pha`, `rts`;
  //   (b) both loads index through the SAME register -- two tables walked by
  //       two different registers are two tables, not one split one, which is
  //       the sentence class 3's own comment already makes. Pre-gate,
  //       `lda $c010,x : pha : lda $c013,y : pha : rts` yielded a proven
  //       target;
  //   (c) the lo/hi orientation is justified rather than assumed. This is the
  //       ONE condition the idiom supplies for free -- the 6502 pushes the
  //       high byte first, so the first load reads the hi table -- and it is
  //       why this pass runs before class 3 rather than after it;
  //   (d) EVERY published entry point is a plausible one
  //       (`isPlausibleEntryPoint`): strictly inside the image, and on a byte
  //       that decodes as a legal, non-truncated instruction. The entry count
  //       is derived from the DISTANCE between the two bases and is therefore
  //       a guess, so the walk is bounded by evidence rather than by that
  //       arithmetic: it stops at the first implausible value, marks the
  //       finding truncated and raises the scan-level `truncated` flag, so a
  //       walk cut short is REPORTED rather than shown as a clean empty list.
  // Nothing is published until (d) has been applied to it: `discovered` and
  // `tableEntryAddresses` are written only from the surviving prefix, exactly
  // the way class 3 reconstructs before its gate.
  const classFourWindow = new Set<number>();
  for (let i = 0; i + 4 < insns.length; i++) {
    const [a, b, c, d, e] = [insns[i]!, insns[i + 1]!, insns[i + 2]!, insns[i + 3]!, insns[i + 4]!];
    const isIndexedLoad = (x: Instruction): boolean => !!x.operand && INDEXED_LOAD_MODES.has(x.mode) && x.mnemonic.startsWith("ld");
    if (!isIndexedLoad(a)) continue;
    if (b.opcode !== 0x48) continue; // pha
    if (!isIndexedLoad(c)) continue;
    if (d.opcode !== 0x48) continue; // pha
    if (e.opcode !== 0x60) continue; // rts
    // (b). Checked BEFORE the window is claimed: a mismatched-register window
    // is not class 4's, so class 3 must still be free to report the pairing
    // (which it will decline on its own condition (b), as an advisory
    // candidate rather than silence).
    if (!sameIndexRegister(a, c)) continue;

    for (const claimed of [a, b, c, d, e]) classFourWindow.add(claimed.address);

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

    // Reconstruct WITHOUT publishing anything yet: nothing below touches
    // `discovered` or `tableEntryAddresses` until (d) has passed on it.
    const targets: number[] = [];
    const entryAddresses: number[] = [];
    for (let k = 0; k < entries; k++) {
      const loIdx = loBase + k - safeOrigin;
      const hiIdx = hiBase + k - safeOrigin;
      if (loIdx < 0 || hiIdx < 0 || loIdx >= size || hiIdx >= size) break;
      // The idiom pushes `target - 1`, because `rts` increments before
      // jumping. Reconstruct the real entry point.
      const pushed = safeBytes[loIdx]! | (safeBytes[hiIdx]! << 8);
      const value = (pushed + 1) & 0xffff;
      // (d). The entry count is a guess, so the walk stops here rather than
      // publishing an address a program cannot be entered at -- and says it
      // stopped.
      if (!isPlausibleEntryPoint(value)) {
        tableTruncated = true;
        truncated = true;
        break;
      }
      targets.push(value);
      entryAddresses.push(loBase + k, hiBase + k);
    }
    if (targets.length === 0) continue;
    for (const value of targets) discovered.add(value);
    for (const addr of entryAddresses) tableEntryAddresses.add(addr);
    stackReturnDispatch.push({ at: a.address, loBase, hiBase, entries: targets.length, targets, truncated: tableTruncated, orientationResolved: true });
  }

  // --- Class 3: split lo/hi tables. Paired indexed loads whose two bases are
  // a fixed distance N apart; reconstruct N targets.
  //
  // GATED (header trap 8). Two indexed loads within eight instructions of
  // each other is the most ordinary shape in C64 code, so the pairing alone
  // is not evidence of anything. A pairing is PROVEN only when ALL of:
  //   (a) it is not inside a window Class 4 already claimed;
  //   (b) both loads index through the SAME register;
  //   (c) something in reach CONSUMES the pair as a dispatch
  //       (`hasDispatchContext`) -- either the stack-return push idiom, or a
  //       zero-page vector that an indirect jump in reach actually jumps
  //       THROUGH. The mere construction of a zero-page vector is not enough:
  //       an indirect-indexed data read builds the identical pointer (CR-04);
  //   (d) its lo/hi orientation is decided by the pairing's own store
  //       construction rather than by address order (`resolveSplitOrientation`);
  //   (e) EVERY reconstructed target lands strictly inside the image AND on a
  //       byte that decodes as a legal, non-truncated instruction. A value
  //       pointing at a byte that does not decode is not an entry point.
  // Anything else is ADVISORY: recorded in `splitTableCandidates` with no
  // orientation claim and no targets, contributing to neither `discovered`
  // nor `tableEntryAddresses`.
  //
  // AN ADVISORY RECORDING DOES NOT CONSUME THE LEADING LOAD (WR-15). Only a
  // PROVEN pairing does. Otherwise one unrelated indexed load between the two
  // halves of a real split table erases it: the advisory pairing takes the
  // leading load, the genuine pairing behind it is never examined, and the
  // report shows a clean-looking empty `splitTables`. The direction of that
  // error is safe -- an under-report, never an over-report -- but it is
  // silent, which is the one thing a coverage instrument may not be.
  for (let i = 0; i < insns.length; i++) {
    const first = insns[i]!;
    if (!first.operand || !INDEXED_LOAD_MODES.has(first.mode)) continue;
    if (!first.mnemonic.startsWith("ld")) continue;
    if (classFourWindow.has(first.address)) continue; // (a)

    // ONLY A PROVEN PAIRING CONSUMES ITS LEADING LOAD (WR-15). An ADVISORY
    // recording does not: the first advisory pairing seen for this leading
    // load is remembered here and emitted only if the window closes with no
    // proven pairing found. Until 19-11 the inner loop broke on BOTH
    // branches, so one unrelated indexed load sitting between the two halves
    // of a real split table consumed the leading load and the genuine pairing
    // behind it was never examined -- a dispatch table with a real
    // `jmp ($00fb)` consumer became invisible, and its eight targets vanished
    // from the seed set. The direction of that error is safe (under-report,
    // not over-report) but it is SILENT: the report showed two advisory
    // candidates and a clean-looking empty `splitTables`, with no indication
    // that a proven pairing had been preempted.
    //
    // At most ONE advisory candidate per leading load is still emitted -- the
    // first seen, in encounter order, so the output is deterministic -- and a
    // leading load that produces a proven pairing emits none.
    let pendingAdvisory: SplitTableFinding | null = null;
    let pendingAdvisoryTruncated = false;
    for (let j = i + 1; j < Math.min(insns.length, i + 1 + SPLIT_TABLE_WINDOW); j++) {
      const second = insns[j]!;
      if (!second.operand || !INDEXED_LOAD_MODES.has(second.mode)) continue;
      if (!second.mnemonic.startsWith("ld")) continue;

      const a = first.operand.value;
      const b = second.operand.value;
      if (a === b) continue;
      if (!inImage(a) || !inImage(b)) continue;

      // (b) + (d). The orientation is the ONLY thing that may name a base
      // "lo": `Math.min` over two addresses is not evidence (WR-01).
      const oriented = sameIndexRegister(first, second) ? resolveSplitOrientation(insns, i, j, SPLIT_TABLE_WINDOW) : null;
      const gatedSoFar = oriented !== null && hasDispatchContext(insns, i, SPLIT_TABLE_WINDOW); // (c)

      // Encounter order for the advisory case; the resolved roles otherwise.
      const loBase = oriented ? oriented.loBase : a;
      const hiBase = oriented ? oriented.hiBase : b;
      const span = Math.abs(hiBase - loBase);
      if (span <= 0) continue;

      let entries = span;
      let tableTruncated = false;
      if (entries > MAX_TABLE_ENTRIES) {
        entries = MAX_TABLE_ENTRIES;
        tableTruncated = true;
      }

      // Reconstruct WITHOUT publishing anything yet: nothing below touches
      // `discovered` or `tableEntryAddresses` until the gate has passed.
      const targets: number[] = [];
      const entryAddresses: number[] = [];
      for (let k = 0; k < entries; k++) {
        const loIdx = loBase + k - safeOrigin;
        const hiIdx = hiBase + k - safeOrigin;
        if (loIdx < 0 || hiIdx < 0 || loIdx >= size || hiIdx >= size) break;
        targets.push(safeBytes[loIdx]! | (safeBytes[hiIdx]! << 8));
        entryAddresses.push(loBase + k, hiBase + k);
      }
      if (targets.length === 0) continue;

      // (e) every target in-image and decodable as a legal instruction. The
      // predicate is shared with the class-4 walk's condition (d) -- one
      // definition, read by both gated reconstructions (WR-14).
      const everyTargetIsAPlausibleEntryPoint = targets.every(isPlausibleEntryPoint);

      if (gatedSoFar && everyTargetIsAPlausibleEntryPoint) {
        for (const value of targets) discovered.add(value);
        for (const addr of entryAddresses) tableEntryAddresses.add(addr);
        splitTables.push({ at: first.address, loBase, hiBase, entries: targets.length, targets, truncated: tableTruncated, orientationResolved: true });
        if (tableTruncated) truncated = true;
        pendingAdvisory = null; // a proven pairing emits no advisory candidate
        break; // a PROVEN pairing consumes its leading load -- and only that
      }

      // Advisory: remember the FIRST one and keep scanning the window.
      if (pendingAdvisory === null) {
        pendingAdvisory = {
          at: first.address,
          // ENCOUNTER order, not lo/hi roles -- see `orientationResolved`.
          loBase: a,
          hiBase: b,
          entries: targets.length,
          targets: [],
          truncated: tableTruncated,
          orientationResolved: false,
        };
        pendingAdvisoryTruncated = tableTruncated;
      }
    }
    if (pendingAdvisory !== null) {
      splitTableCandidates.push(pendingAdvisory);
      if (pendingAdvisoryTruncated) truncated = true;
    }
  }

  return {
    indirectJumps,
    multiEntryTables,
    splitTables,
    splitTableCandidates,
    stackReturnDispatch,
    discoveredTargets: sortedUniqueNumbers(discovered),
    tableEntryAddresses: sortedUniqueNumbers(tableEntryAddresses),
    truncated,
  };
}

/**
 * The ONE place that decides what may seed a recursive descent.
 *
 * Every `extraSeeds:` assignment in this module reads this function and reads
 * nothing else. Built from real `jmp ($nnnn)` targets, the multi-entry tables
 * those jumps name, the stack-return idiom's push-order-justified
 * reconstruction, and PROVEN split tables -- and from nothing else.
 *
 * ADDING A SOURCE HERE IS THE DECISION TO TREAT THAT SOURCE AS PROOF OF CODE.
 * `reachedAsInstruction` means REACHED BY RECURSIVE DESCENT FROM A SEED
 * (header trap 2); a seed that is not evidence-backed turns ordinary data
 * into headline structural coverage without ever touching the linear-sweep
 * figure trap 2 guards. `splitTableCandidates` is deliberately NOT read here
 * -- that is the whole point of it being advisory.
 */
export function provenDispatchTargets(scan: IndirectDispatchScan): number[] {
  const proven = new Set<number>();
  for (const jump of scan.indirectJumps) {
    if (jump.target !== null) proven.add(jump.target);
  }
  for (const table of scan.multiEntryTables) {
    for (const target of table.targets) proven.add(target);
  }
  for (const idiom of scan.stackReturnDispatch) {
    for (const target of idiom.targets) proven.add(target);
  }
  for (const split of scan.splitTables) {
    for (const target of split.targets) proven.add(target);
  }
  return sortedUniqueNumbers(proven);
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
  // WR-02: the count is a count OF the list printed beside it. Deduped ONCE
  // into a local, then both fields read from that local -- two symbols at one
  // address must not report "2 label name(s) ... at $1000", a sentence that
  // contradicts itself.
  const autoPrefixAddresses = sortedUniqueNumbers(autoPrefixNameAddresses);
  return {
    kindRatio: { user, auto, userFraction: denominator === 0 ? null : user / denominator },
    autoPrefixNamesRemaining: autoPrefixAddresses.length,
    autoPrefixNameAddresses: autoPrefixAddresses,
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

/** `provenTargets` is `provenDispatchTargets(dispatch)`, computed ONCE per
 * report by the caller. A bare membership test against the scan's own
 * `discoveredTargets` used to live here and inherited the ungated-pairing
 * defect straight into the reproducibility comparison (header trap 8); the
 * seam is passed in so there is no second, un-narrowed read of it. */
function classFromBytes(census: StructuralCensus, provenTargets: readonly number[], address: number): DerivedClass {
  if (provenTargets.includes(address)) return "code";
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

/** Escapes `value` so it can be interpolated into a `RegExp` as a LITERAL.
 *
 * A label name is store data, not a literal this file controls: it arrives
 * from a regenerator2000 project file the operator did not necessarily author
 * (a cracked release's annotation store, a shared project). A name carrying
 * regex metacharacters must therefore become text rather than a pattern.
 * Same discipline `skill-attribution.test.ts` applies to manifest-sourced
 * strings. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The adjacent signals that turn a caller's label NAME into a caller
 * CITATION -- the marker set the name branch of `namesACaller()` reads (WR-13).
 *
 * A NAMED CONSTANT rather than literals inlined in the regex, so the decision
 * is inspectable in one place and widening it is a one-line edit somewhere
 * obvious rather than a change buried in a pattern string.
 *
 * Each word is matched on identifier boundaries, and in the pattern built from
 * this list it must sit within three NON-IDENTIFIER characters of the name it
 * introduces: `from init`, `called by init`, `callers: init`. `by` carries
 * `called by` / `invoked by` / `used by` -- a comment saying that some routine
 * uses this one is naming a caller.
 *
 * Spelled at both the lowercase and the sentence-initial-capital form rather
 * than matched case-insensitively, because the NAME half of the same regex is
 * case-SENSITIVE (a label's name is its name, and `Init` is a different symbol
 * from `init`) and one regex carries both halves.
 */
const CALLER_CITATION_WORDS: readonly string[] = Object.freeze([
  "from",
  "by",
  "call",
  "called",
  "caller",
  "callers",
  "calls",
]);

/** `CALLER_CITATION_WORDS` as a regex alternation, each word at its lowercase
 * and its sentence-initial-capital spelling. */
const CALLER_CITATION_ALTERNATION = CALLER_CITATION_WORDS.map(
  (word) => `${word}|${word.charAt(0).toUpperCase()}${word.slice(1)}`,
).join("|");

/**
 * Does `rawComment` use `name` -- the user label recorded at a caller's
 * address -- AS A REFERENCE to that caller?
 *
 * THE DECISION, RECORDED (WR-13). Bare presence of the name is NOT enough.
 * regenerator2000 label names are routinely ordinary English words -- `loop`,
 * `init`, `main`, `start`, `data`, `table`, `draw` -- and an ordinary
 * description of what a routine does will contain one by accident. The
 * reproduced case: callers `[$0012, $0034]`, comment "sets the mode flag
 * before the main loop runs", caller `$0012` named `loop`. Nothing in that
 * comment refers to the routine at `$0012`, yet the pre-WR-13 identifier-
 * bounded test matched `loop` inside "main loop runs" and certified the label
 * as documenting its caller -- a falsely-clean verdict, and worse than a noisy
 * one, because a label counted as documented stays in `labels.kindRatio.user`
 * and stays in the reproducibility sample, so the measure that exists to catch
 * it can no longer see it.
 *
 * So a name counts only in one of three shapes, all still bounded on
 * identifier boundaries so `my_entry_pointer` still does not name
 * `entry_point`:
 *
 *   (a) MARKED UP AS A SYMBOL -- the name in backticks. An annotator who
 *       fences a token is quoting an identifier, not writing prose.
 *   (b) INTRODUCED BY A CALLER-NAMING WORD from `CALLER_CITATION_WORDS`,
 *       within three non-identifier characters: `from init`, `called by init`,
 *       `callers: init`.
 *   (c) FOLLOWED BY ITS OWN PARENTHESISED HEX ADDRESS -- `init ($0012)`.
 *
 * THE ALTERNATIVE WEIGHED AND REJECTED: drop the name branch entirely and
 * accept only the hex form, which CR-01's fix already anchors correctly. It is
 * strictly safer and strictly simpler. It was rejected because it would
 * silently reclassify every project whose annotator cites callers by name
 * rather than by address -- a real and reasonable convention -- turning a
 * measure of documentation quality into a measure of citation style, with no
 * signal to the operator that the rule had changed underneath them. The
 * tightening above is the cheapest change that refuses the coincidence while
 * still accepting a genuine name citation.
 *
 * THE RESIDUAL, STATED: a marker word can still precede a coincidental name
 * ("copies bytes from screen" where a caller is named `screen`). That is a
 * far narrower coincidence than bare presence, and it errs toward accepting a
 * citation rather than toward manufacturing one; widening the refusal further
 * would need a corpus, not a guess.
 */
function citesCallerByName(rawComment: string, name: string): boolean {
  const token = escapeRegExp(name);
  const notIdentBefore = "(?<![0-9A-Za-z_])";
  const notIdentAfter = "(?![0-9A-Za-z_])";
  const patterns = [
    // (a) marked up as a symbol.
    "`" + token + "`",
    // (b) introduced by a caller-naming word.
    `${notIdentBefore}(?:${CALLER_CITATION_ALTERNATION})${notIdentAfter}[^0-9A-Za-z_]{1,3}${token}${notIdentAfter}`,
    // (c) followed by its own parenthesised hex address.
    `${notIdentBefore}${token}${notIdentAfter}\\s*\\(\\$[0-9a-fA-F]{1,4}\\)`,
  ];
  return patterns.some((pattern) => new RegExp(pattern).test(rawComment));
}

/** Does `comment` literally name at least one of `callers` -- either as a
 * hexadecimal address, or as a REFERENCE to the user label name recorded at a
 * caller address?
 *
 * The match is ANCHORED, not a substring test:
 *
 *   - a HEX reference is `$` plus the caller's address at either its bare
 *     width or the canonical four-digit width, followed by a character that is
 *     NOT a hexadecimal digit -- end of string counts as a boundary. So a
 *     comment mentioning an unrelated and entirely ordinary address whose
 *     leading digits merely coincide with a caller's short form names NO
 *     caller: `$8106` is not `$0810`. Case-insensitive, as before.
 *   - a NAME reference must stand on an identifier boundary on BOTH sides --
 *     the characters either side may not be an ASCII letter, digit or
 *     underscore, so `my_entry_pointer` does not name `entry_point` -- AND
 *     must be USED AS A REFERENCE rather than merely present. See
 *     `citesCallerByName()` for what counts, why bare presence does not, and
 *     which alternative was rejected (WR-13).
 *
 * Why anchored rather than "purely textual": this rule is the one measure
 * whose entire subject is refusing to be talked into a clean verdict, and an
 * unanchored `includes()` could be satisfied by a string that merely TOUCHES a
 * caller's short form -- a falsely-clean verdict on the anti-gaming measure
 * itself (T-19-14, T-19G-06-01, T-19G-12-01). Held down in BOTH directions by
 * three committed controls in `r2000-coverage.test.ts`: "ANCHORING: a
 * colliding longer hex never satisfies the multi-caller rule ...", "ANCHORING:
 * a caller's label name satisfies the rule only on an identifier boundary",
 * and "WR-13: a caller's label name counts only when the comment USES it as a
 * reference ...". */
function namesACaller(
  rawComment: string,
  callers: readonly number[],
  nameByAddress: ReadonlyMap<number, string>,
): boolean {
  for (const caller of callers) {
    const hex = caller.toString(16).toLowerCase();
    // Deduped through a Set: a caller at or above $1000 is already four digits
    // wide, so its bare and canonical forms are the same token and testing it
    // twice would be dead work.
    for (const token of new Set([hex, hex.padStart(4, "0")])) {
      if (new RegExp(`\\$${escapeRegExp(token)}(?![0-9a-f])`, "i").test(rawComment)) return true;
    }
    const name = nameByAddress.get(caller);
    if (name && citesCallerByName(rawComment, name)) return true;
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
  // WR-02, again: ONE deduped list, and every number reported beside it is
  // derived from it. Same rule as `computeLabelRatio` above -- a count printed
  // in the same sentence as a list must be a count of that list, or the
  // finding text contradicts itself.
  const multiCallerAddresses = sortedUniqueNumbers(multiCallerUndocumented);

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
      multiCallerUndocumented: { count: multiCallerAddresses.length, addresses: multiCallerAddresses },
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
  const provenTargets = provenDispatchTargets(dispatch);
  for (const address of addresses) {
    const fromBytes = classFromBytes(census, provenTargets, address);
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
    multiCallerUndocumented: { count: multiCallerAddresses.length, addresses: multiCallerAddresses },
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
    // The ONE seam. Never `dispatch.discoveredTargets` and never
    // `dispatch.splitTableCandidates` -- see `provenDispatchTargets()`.
    extraSeeds: provenDispatchTargets(dispatch),
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
