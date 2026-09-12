#!/usr/bin/env node
// anno-hazard-report.ts
//
// The ONE place a movement-hazard finding is derived. A "hazard" here is a
// static construction that blocks a piece of code or data from being moved,
// relocated, rebased or stripped without breaking the program -- a runtime
// self-modification landing on a hardcoded address is the first and, for
// now, only construction this module recognises; later work adds siblings
// under the same shape.
//
// WHAT THIS MODULE DOES NOT DO, STATED ONCE AND PLAINLY: it enumerates. It
// never removes, strips, drops, relocates or rebases anything, and it never
// emits an instruction, flag or field a caller could act on as an automatic
// relocation. It reports; the reader decides what happens to the bytes it
// describes.
//
// THE MOST IMPORTANT SENTENCE IN THIS FILE: a finding proves a hazard
// exists. The absence of a finding proves NOTHING. A region this report
// never flags may still be exactly as hazardous as one it does -- it may
// simply be a construction none of the detectors below know how to see. No
// field, count or rendered line derived from this module's answer may ever
// be read as a safety certificate, and `HAZARD_LIMITS` below exists
// specifically to keep saying so next to every answer this module gives.
//
// ---------------------------------------------------------------------------
// PURE BY DESIGN -- every input arrives as an already-fetched argument
// ---------------------------------------------------------------------------
// `buildHazardReport()` takes one plain-data object and returns one plain-data
// object. It calls the decoder and nothing else that reaches outside its own
// arguments: no store handle, no filesystem path, no child-process spawn, no
// transport socket, and no host/container path translation. The caller (the
// MCP tool dispatch arm and the CLI command function) does every fetch --
// ranges, labels, comments, cross-references, execution observations, and the
// raw image bytes -- and hands this module plain arrays. That split is the
// same one the observed-execution reconciler already ships, and it is what
// makes a single, structural test possible: read this file's own source text
// off disk and assert that none of the calls that would turn a report into a
// store mutation ever appear in it.
//
// ---------------------------------------------------------------------------
// A SEPARATE, SMALL DETECTION-STRENGTH VOCABULARY -- WHY, NOT JUST WHAT
// ---------------------------------------------------------------------------
// This codebase already has a five-grade confidence vocabulary, and its own
// module states plainly that nothing may define a second one. That rule is
// about ONE axis: what does this ADDRESS classify as, code or data, spelled
// as a short bracketed token inside a rendered line comment. This module
// answers a DIFFERENT question about a DIFFERENT thing: given a specific
// static signal already found, how strong is the evidence for THAT signal --
// never rendered as a bracketed comment prefix, and never keyed by address in
// a second sidecar store. One vocabulary cannot honestly answer both
// questions at once without a reader having to guess which axis a token on
// the page is even talking about, so this module declares its own three
// tokens below, spelled so they can never be confused with the other
// vocabulary's five, and records that departure here rather than leaving it
// to be rediscovered as an unexplained duplicate.
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO -- each of these is a specific, named trap
// ---------------------------------------------------------------------------
//   1. NEVER add the synchronous file-write call, the store-open entry
//      point, the cross-reference write entry point, or the live-session
//      module to this file's import list or its body. A report that could
//      write would stop being safe to run twice concurrently and would turn
//      an interrupted call into a corrupted project. This module's own test
//      file reads this file's source text and fails the moment any of those
//      appears -- by concept, not by a copy-pasted identifier, which is
//      exactly why this header never spells one out.
//   2. NEVER import the host-path or container-path translation modules.
//      This module never resolves anything outside the bytes it was handed.
//   3. NEVER return a boolean verdict, and never name a field `clean`,
//      `dirty`, `safe` or `ok`. Region outcomes are a closed three-member
//      set (`hazard-reported`, `no-signal`, `unclassified`) precisely so a
//      caller cannot collapse them into a single yes/no.
//   4. NEVER let an execution observation remove, downgrade or silence a
//      finding. An observation only ever RAISES a finding's strength; no
//      observation, or no observations supplied at all, changes nothing
//      about whether a finding exists.
//   5. NEVER merge two findings that differ in hazard class or mechanism
//      even when they share an address. The de-duplication key is the whole
//      triple -- class, anchor address, mechanism -- never the address
//      alone.
//   6. NEVER throw on an empty or single-element input. A store with no
//      ranges is a legal, answerable question: zero denominator, empty
//      findings, empty regions -- never an exception and never a report that
//      reads as "no hazards found."
//   7. NEVER re-derive the indexed-dispatch scanner already owned elsewhere
//      in this tree. A second implementation of that scan anywhere in this
//      phase is a defect, not a convenience.
//
// ---------------------------------------------------------------------------
// WHAT THIS PLAN'S SLICE ACTUALLY DETECTS
// ---------------------------------------------------------------------------
// One class only: a store, or a read-modify-write instruction (increment,
// decrement, shift or rotate), whose LITERAL target address -- the address
// encoded directly in the instruction, for a mode where that address does
// not depend on a runtime register or a runtime-computed pointer -- lands
// inside another decoded instruction's own byte range. Landing on that other
// instruction's first byte is a control-flow hazard (the opcode changes);
// landing on any later byte is a value hazard (an operand changes). Both are
// reported as the same hazard class under two different mechanism strings.
//
// A store through a zero-page pointer computed at runtime (indirect or
// indirect-indexed addressing) has no literal target for this detector to
// test -- only a pointer whose value is a runtime fact this module was never
// handed. That construction is a genuine miss, not an oversight, and it is
// named as a limit below rather than silently absent from the
// answer.

import { decode, type Instruction } from "./disasm-decoder.ts";
import { blockClassAt, type BlockEntry } from "./block-class.ts";
import type { LabelRow, CommentRow, XrefRow, EvidExecRow } from "./anno-types.ts";
import { scanIndirectDispatch, type IndirectDispatchScan, type SplitTableFinding } from "./anno-coverage.ts";

// ---------------------------------------------------------------------------
// The hazard-class vocabulary
// ---------------------------------------------------------------------------

/**
 * The full, frozen set of hazard classes this report family will eventually
 * cover. Declared in full here even though this plan's slice only ever
 * populates `self-modifying-code` findings -- the union type and the
 * ordering it fixes are the stable surface later work builds against.
 */
export const HAZARD_CLASSES = Object.freeze([
  "indexed-dispatch",
  "self-modifying-code",
  "page-alignment",
  "cycle-exact-raster",
] as const);

/** One of the four hazard classes, in `HAZARD_CLASSES`'s own declared order. */
export type HazardClass = (typeof HAZARD_CLASSES)[number];

/**
 * The three detection-strength tokens. Answers "how sure is this
 * ONE static signal", never "what does this address classify as" -- a
 * different axis from this codebase's five-grade confidence vocabulary, and
 * never spelled as that vocabulary's bracket-prefix form.
 */
export const HAZARD_DETECTION_STRENGTHS = Object.freeze([
  "observed-corroborated",
  "static-shape-matched",
  "static-signature-only",
] as const);

/** One of the three detection-strength tokens. */
export type HazardDetectionStrength = (typeof HAZARD_DETECTION_STRENGTHS)[number];

/**
 * The three region dispositions. No boolean anywhere: a region is
 * one of exactly these three, never a "clean"/"dirty" pair.
 */
export const HAZARD_REGION_OUTCOMES = Object.freeze(["hazard-reported", "no-signal", "unclassified"] as const);

/** One of the three region outcomes. */
export type HazardRegionOutcome = (typeof HAZARD_REGION_OUTCOMES)[number];

// ---------------------------------------------------------------------------
// The answer shape
// ---------------------------------------------------------------------------

/**
 * One hazard finding. `anchorAddress` is the address of the instruction
 * whose bytes get overwritten -- the code that cannot be relocated without
 * breaking the construction, and the address an execution observation is
 * matched against for `strength` promotion: if THAT code was
 * observed actually running, the modification it plants is corroborated as
 * a real runtime event rather than a static coincidence. `blockedAddress` is
 * the exact byte the write lands on -- equal to `anchorAddress` for an
 * opcode-byte hit, or a later byte within the same instruction for an
 * operand-byte hit.
 */
export interface HazardFinding {
  hazardClass: HazardClass;
  anchorAddress: number;
  /** Nullable: some future hazard class may know a hazard exists without
   * being able to name a single blocked byte. Always populated for the
   * self-modifying-code class this plan's slice reports. */
  blockedAddress: number | null;
  /** A stable, lowercase-hyphenated identifier for how this finding was
   * derived, e.g. `store-target-in-instruction-opcode-byte`. */
  mechanism: string;
  strength: HazardDetectionStrength;
  /** Prose naming what breaks if the anchored code or data is moved. */
  detail: string;
  corroboration: "runtime-observed" | "none";
}

/**
 * One region's disposition against every detector this report ran.
 * `reason` is REQUIRED when `outcome` is `"unclassified"` -- it names which
 * of the causes applied -- and is otherwise omitted.
 */
export interface HazardRegionDisposition {
  start: number;
  endInclusive: number;
  outcome: HazardRegionOutcome;
  reason?: string;
}

/**
 * One named, always-emitted limit -- what this report cannot determine, and
 * what a reader must therefore not conclude from its absence. `hazardClass`
 * is `null` for a limit that spans every class rather than one in
 * particular.
 */
export interface HazardLimit {
  hazardClass: HazardClass | null;
  limit: string;
  consequence: string;
}

/**
 * The two limits this plan's slice seeds. Plan 48-03 and plan 48-05 add the
 * remaining entries; this array only ever grows.
 */
export const HAZARD_LIMITS: readonly HazardLimit[] = Object.freeze([
  {
    hazardClass: "indexed-dispatch",
    limit:
      "the imported scanner's promotion gate accepts exactly two evidence " +
      "shapes by design -- the stack-return (RTS-trick) idiom and a " +
      "zero-page vector actually jumped through -- so a real-world " +
      "computed-dispatch construction outside those two shapes is reported " +
      "as an unproven candidate, never as a finding.",
    consequence:
      "an empty findings list for this class is never a claim that the " +
      "program contains no computed dispatch; a declined candidate still " +
      "appears in this report's unprovenDispatchCandidates collection, " +
      "which this field's own absence would otherwise silently hide.",
  },
  {
    hazardClass: "self-modifying-code",
    limit:
      "a store through a runtime-computed zero-page pointer -- indirect or " +
      "indirect-indexed addressing -- into the code range is not detected. " +
      "The static decoder has no literal target address to test in that " +
      "case, only a pointer whose value is a fact about the running " +
      "machine, not about the bytes on disk.",
    consequence:
      "an indirect-indexed self-modification into this program's code is " +
      "invisible to this report; its absence from the findings below is not " +
      "evidence that no such construction exists.",
  },
  {
    hazardClass: null,
    limit:
      "a region with no finding was checked by every detector this report " +
      "ran, and none of them matched anything in it.",
    consequence:
      "no detection is not evidence of safety: a region with no finding is " +
      "never a claim that the region is safe to move, clean, or hazard-free " +
      "-- it means nothing this report knows how to look for fired there, " +
      "not that nothing is there.",
  },
]);

/**
 * Plain data the caller already fetched -- this module never fetches any of
 * it itself. `symbols`, `comments` and `xrefs` are accepted now so the
 * shape is stable for classes later plans add; this plan's slice does not
 * read them.
 */
export interface HazardReportInput {
  bytes: Uint8Array;
  origin: number;
  symbols?: readonly LabelRow[];
  comments?: readonly CommentRow[];
  ranges?: readonly BlockEntry[];
  xrefs?: readonly XrefRow[];
  execObservations?: readonly EvidExecRow[];
}

/**
 * The full answer. No field here is, or could be mistaken for, a single
 * verdict -- see this module's header.
 */
export interface HazardReport {
  findings: HazardFinding[];
  regions: HazardRegionDisposition[];
  limits: readonly HazardLimit[];
  /** The count of distinct addresses the store's ranges cover -- computed
   * here from the ranges' own inclusive extents, never copied from an
   * input. Zero for an empty `ranges` array; never a refusal. */
  denominator: number;
  /** Which hazard classes this call actually ran a detector for. */
  classesEvaluated: readonly HazardClass[];
  /**
   * The imported scanner's ADVISORY `splitTableCandidates` collection,
   * carried through VERBATIM -- never converted to a finding, never
   * renamed, never filtered and never sorted into `findings`. The
   * scanner's own promotion gate is deliberately closed to two accepted
   * evidence shapes (the stack-return idiom and a zero-page vector actually
   * jumped through), so a real-world dispatch construction outside those
   * two shapes lands here rather than being silently promoted on weaker
   * evidence. Dropping this collection -- or folding it into `findings` --
   * would make an honest decline indistinguishable from an absence, which
   * is exactly the confusion this field exists to prevent. See
   * `HAZARD_LIMITS`'s `indexed-dispatch` entry for the same point stated in
   * the report's own emitted output.
   */
  unprovenDispatchCandidates: readonly SplitTableFinding[];
  truncated: boolean;
}

// ---------------------------------------------------------------------------
// The class-1 (indexed-dispatch) detector -- IMPORTED, never re-derived
// ---------------------------------------------------------------------------
//
// This is the existing `scanIndirectDispatch()` scan (`anno-coverage.ts`),
// called exactly once, mapped onto this module's own finding shape. No
// opcode table, no table walk and no entry-point plausibility check is
// written here -- every one of those already lives in the scanner, survived
// a real false-positive incident there, and must not be rebuilt beside it.

/**
 * Maps the scanner's four PROVEN collections onto `HazardFinding`s.
 * `anchorAddress` is always the dispatching instruction (the code that
 * reads the table or vector); `blockedAddress` is always the table or
 * vector BASE -- the thing that cannot move -- never the dispatching
 * instruction's own address, because a report about movement must name
 * what is pinned, not only where the pin is read from.
 */
function detectIndexedDispatch(scan: IndirectDispatchScan): HazardFinding[] {
  const findings: HazardFinding[] = [];

  for (const jump of scan.indirectJumps) {
    findings.push({
      hazardClass: "indexed-dispatch",
      anchorAddress: jump.at,
      blockedAddress: jump.pointer,
      mechanism: "indirect-jump-through-vector",
      strength: "static-shape-matched",
      detail:
        "this jmp reads its target from the vector address named here; " +
        "relocating the vector itself, or whatever value is stored at it, " +
        "without updating every indirect jump that reads it silently " +
        "changes where control transfers.",
      corroboration: "none",
    });
  }

  for (const table of scan.multiEntryTables) {
    findings.push({
      hazardClass: "indexed-dispatch",
      anchorAddress: table.at,
      blockedAddress: table.base,
      mechanism: "multi-entry-dispatch-table",
      strength: "static-shape-matched",
      detail:
        "this indirect jump reads one of several consecutive table entries " +
        "starting at the base named here; relocating the table without " +
        "updating every jump that reads through it silently changes which " +
        "entry -- and therefore which target -- a given index selects.",
      corroboration: "none",
    });
  }

  for (const stackReturn of scan.stackReturnDispatch) {
    findings.push({
      hazardClass: "indexed-dispatch",
      anchorAddress: stackReturn.at,
      // The lower of the two reconstructed table bases: the two tables sit
      // back-to-back and this is the base of that combined region, not an
      // arbitrary pick between them.
      blockedAddress: Math.min(stackReturn.loBase, stackReturn.hiBase),
      mechanism: "stack-return-dispatch",
      strength: "static-shape-matched",
      detail:
        "this routine reconstructs a return address from a split hi/lo " +
        "table pair via the RTS-trick idiom (push hi, push lo, rts); " +
        "relocating either table without updating the loads that read it " +
        "silently changes which address the trailing rts resumes at.",
      corroboration: "none",
    });
  }

  for (const splitTable of scan.splitTables) {
    findings.push({
      hazardClass: "indexed-dispatch",
      anchorAddress: splitTable.at,
      blockedAddress: Math.min(splitTable.loBase, splitTable.hiBase),
      mechanism: "split-address-table",
      strength: "static-shape-matched",
      detail:
        "this routine builds a jump vector from a split hi/lo table pair " +
        "and dispatches through it; relocating either table without " +
        "updating the loads that read it silently changes the vector the " +
        "indirect jump reads and therefore where control transfers.",
      corroboration: "none",
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// The class-2 (self-modifying-code) detector
// ---------------------------------------------------------------------------

const WRITE_MNEMONICS_LITERAL_TARGET = new Set(["sta", "stx", "sty", "inc", "dec", "asl", "lsr", "rol", "ror"]);

/** Addressing modes whose operand is a literal address this detector can
 * test directly -- no runtime register value and no runtime-computed
 * pointer stands between the encoded bytes and the target address. Deliberately
 * EXCLUDES `indirect_x`/`indirect_y`: those two modes route through a
 * zero-page pointer whose value is a runtime fact, which is exactly the
 * limit named in `HAZARD_LIMITS` above rather than a detector to
 * build. */
const LITERAL_TARGET_MODES = new Set(["absolute", "absolute_x", "absolute_y", "zeropage", "zeropage_x", "zeropage_y"]);

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Builds an address -> owning-instruction index over an already-decoded,
 * already-bounded instruction stream. One pass, no recursion. */
function buildInstructionIndex(instructions: readonly Instruction[]): Map<number, Instruction> {
  const index = new Map<number, Instruction>();
  for (const instr of instructions) {
    for (let offset = 0; offset < instr.bytes.length; offset++) {
      index.set(instr.address + offset, instr);
    }
  }
  return index;
}

function detailForMechanism(mechanism: string): string {
  if (mechanism === "store-target-in-instruction-opcode-byte") {
    return (
      "this write changes which INSTRUCTION runs at the target address on a " +
      "later pass -- moving the target instruction elsewhere leaves this " +
      "write patching an address that is no longer the intended opcode byte, " +
      "silently changing control flow rather than merely producing a wrong " +
      "value."
    );
  }
  return (
    "this write changes an OPERAND byte the target instruction reads -- " +
    "moving the target instruction elsewhere leaves this write patching an " +
    "address that no longer belongs to it, so the target instruction keeps " +
    "whatever stale operand was there instead of the intended one."
  );
}

function detectSelfModifyingCode(
  instructions: readonly Instruction[],
  index: ReadonlyMap<number, Instruction>,
  observedAddresses: ReadonlySet<number>,
): HazardFinding[] {
  const findings: HazardFinding[] = [];
  for (const instr of instructions) {
    if (!WRITE_MNEMONICS_LITERAL_TARGET.has(instr.mnemonic)) continue;
    if (!LITERAL_TARGET_MODES.has(instr.mode)) continue;
    const operand = instr.operand;
    if (!operand) continue;

    const target = operand.value;
    const host = index.get(target);
    if (!host) continue; // hardware register, zp scratch, or outside every instruction: no finding
    if (host === instr) continue; // "another decoded instruction", never itself

    const mechanism =
      target === host.address ? "store-target-in-instruction-opcode-byte" : "store-target-in-instruction-operand-byte";
    // Corroboration is checked against the HOST's address, not the writer's:
    // what strengthens this finding is proof that the MODIFIED code actually
    // ran, not proof that the modifying instruction ran.
    const strength: HazardDetectionStrength = observedAddresses.has(host.address)
      ? "observed-corroborated"
      : "static-shape-matched";

    findings.push({
      hazardClass: "self-modifying-code",
      anchorAddress: host.address,
      blockedAddress: target,
      mechanism,
      strength,
      detail: detailForMechanism(mechanism),
      corroboration: strength === "observed-corroborated" ? "runtime-observed" : "none",
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// De-duplication and ordering
// ---------------------------------------------------------------------------

function findingKey(f: HazardFinding): string {
  return `${f.hazardClass}|${f.anchorAddress}|${f.mechanism}`;
}

function dedupeFindings(findings: readonly HazardFinding[]): HazardFinding[] {
  const seen = new Set<string>();
  const out: HazardFinding[] = [];
  for (const f of findings) {
    const key = findingKey(f);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

function sortFindings(findings: readonly HazardFinding[]): HazardFinding[] {
  const classOrder = new Map<HazardClass, number>(HAZARD_CLASSES.map((c, i) => [c, i]));
  return [...findings].sort((a, b) => {
    if (a.anchorAddress !== b.anchorAddress) return a.anchorAddress - b.anchorAddress;
    const ao = classOrder.get(a.hazardClass) ?? 0;
    const bo = classOrder.get(b.hazardClass) ?? 0;
    if (ao !== bo) return ao - bo;
    return a.mechanism < b.mechanism ? -1 : a.mechanism > b.mechanism ? 1 : 0;
  });
}

// ---------------------------------------------------------------------------
// Region disposition
// ---------------------------------------------------------------------------

function classifyRegions(
  ranges: readonly BlockEntry[],
  imageStart: number,
  imageEndInclusive: number,
  imageIsEmpty: boolean,
  classesEvaluated: readonly HazardClass[],
  findingAddresses: ReadonlySet<number>,
): HazardRegionDisposition[] {
  const regions: HazardRegionDisposition[] = [];
  for (const range of ranges) {
    if (!range) continue;
    const start = range.start_address;
    const endInclusive = range.end_address;
    if (!Number.isInteger(start) || !Number.isInteger(endInclusive)) continue;

    let outcome: HazardRegionOutcome;
    let reason: string | undefined;

    if (imageIsEmpty || start > imageEndInclusive || endInclusive < imageStart) {
      outcome = "unclassified";
      reason = "the region lies outside the loaded image";
    } else if (classesEvaluated.length === 0) {
      outcome = "unclassified";
      reason = "every detector declined to evaluate this region";
    } else {
      const cls = blockClassAt(ranges, start);
      if (cls === null || cls === "undefined") {
        outcome = "unclassified";
        reason = "the region's own store block class is undefined";
      } else {
        let hit = false;
        const clampedEnd = Math.min(endInclusive, 0xffff);
        for (let addr = Math.max(start, 0); addr <= clampedEnd; addr++) {
          if (findingAddresses.has(addr)) {
            hit = true;
            break;
          }
        }
        outcome = hit ? "hazard-reported" : "no-signal";
      }
    }

    regions.push(reason !== undefined ? { start, endInclusive, outcome, reason } : { start, endInclusive, outcome });
  }
  return regions.sort((a, b) => a.start - b.start);
}

function computeDenominator(ranges: readonly BlockEntry[]): number {
  const covered = new Set<number>();
  for (const range of ranges) {
    if (!range) continue;
    const start = range.start_address;
    const end = range.end_address;
    if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
    const clampedEnd = Math.min(end, 0xffff);
    for (let addr = Math.max(start, 0); addr <= clampedEnd; addr++) covered.add(addr);
  }
  return covered.size;
}

// ---------------------------------------------------------------------------
// The entry point
// ---------------------------------------------------------------------------

/**
 * Builds a hazard report from already-fetched plain data. Never throws on
 * empty or malformed input -- every array field is normalized with the same
 * `Array.isArray(...)` guard the observed-execution reconciler uses.
 */
export function buildHazardReport(input: HazardReportInput): HazardReport {
  const bytes = input && input.bytes instanceof Uint8Array ? input.bytes : new Uint8Array(0);
  const origin = isNonNegativeSafeInteger(input?.origin) && input.origin <= 0xffff ? input.origin : 0;
  const ranges: readonly BlockEntry[] = Array.isArray(input?.ranges) ? input.ranges : [];
  const execObservations: readonly EvidExecRow[] = Array.isArray(input?.execObservations) ? input.execObservations : [];

  // Bound the walk at the 16-bit address space, the same way the existing
  // coverage census clamps its own effective end -- never an unbounded loop
  // over an attacker-controlled byte count.
  const imageIsEmpty = bytes.length === 0;
  const effectiveEnd = Math.min(origin + bytes.length, 0x10000);
  const imageEndInclusive = imageIsEmpty ? origin : effectiveEnd - 1;

  const instructions = imageIsEmpty ? [] : decode(bytes, origin, { end: imageEndInclusive });
  const instructionIndex = buildInstructionIndex(instructions);

  const observedAddresses = new Set<number>();
  for (const row of execObservations) {
    if (row && isNonNegativeSafeInteger(row.address)) observedAddresses.add(row.address);
  }

  const classesEvaluated: HazardClass[] = imageIsEmpty ? [] : ["indexed-dispatch", "self-modifying-code"];

  // The ONE new call site this plan adds. Same triple the existing consumer
  // (`buildCoverageReport()`) passes: the already-decoded instruction stream,
  // the raw bytes, and the origin -- see `hazard reuse:` in this module's
  // own test file for why a second call site anywhere else is a defect.
  const dispatchScan: IndirectDispatchScan | null = imageIsEmpty ? null : scanIndirectDispatch(instructions, bytes, origin);

  const rawFindings = imageIsEmpty
    ? []
    : [...detectIndexedDispatch(dispatchScan!), ...detectSelfModifyingCode(instructions, instructionIndex, observedAddresses)];
  const findings = sortFindings(dedupeFindings(rawFindings));

  const findingAddresses = new Set<number>();
  for (const f of findings) {
    findingAddresses.add(f.anchorAddress);
    if (f.blockedAddress !== null) findingAddresses.add(f.blockedAddress);
  }

  const regions = classifyRegions(ranges, origin, imageEndInclusive, imageIsEmpty, classesEvaluated, findingAddresses);

  return {
    findings,
    regions,
    limits: HAZARD_LIMITS,
    denominator: computeDenominator(ranges),
    classesEvaluated,
    // Carried through VERBATIM -- never filtered, never converted to a
    // finding. See this field's own doc comment on `HazardReport`.
    unprovenDispatchCandidates: dispatchScan ? dispatchScan.splitTableCandidates : [],
    // Propagated, never swallowed: a scan cut short by MAX_TABLE_ENTRIES
    // must be visible on the report it feeds, not silently absorbed.
    truncated: dispatchScan ? dispatchScan.truncated : false,
  };
}
