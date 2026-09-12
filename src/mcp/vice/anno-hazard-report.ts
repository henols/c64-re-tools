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
import {
  deriveGraphicsRanges,
  BANK_SELECT_ADDRESS,
  MEMORY_CONTROL_ADDRESS,
  CONTROL_REGISTER_1_ADDRESS,
  SPRITE_POINTER_OFFSET,
  type GraphicsConstWriteFact,
  type GraphicsRange,
} from "./anno-graphics.ts";

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
  /**
   * THE STRENGTH ASYMMETRY, STATED ONCE FOR THE WHOLE MODULE: an execution
   * observation can only ever RAISE this token, never establish a finding on
   * its own and never lower or remove one. The static signal is what raised
   * the finding in the first place -- a run that happened to execute the
   * anchored code corroborates that the construction is live, but a run that
   * did NOT happen to execute it is not evidence about that address at all,
   * only evidence that this particular run took a different path. Every
   * detector below that ever promotes this field (the self-modifying-code
   * and cycle-exact-raster detectors) checks the SAME direction only; none
   * checks whether an address was absent from the observations to decide
   * anything.
   */
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
    hazardClass: "page-alignment",
    limit:
      "only VIC-II HARDWARE alignment boundaries are evaluated -- the " +
      "sprite pointer's 64-byte granularity and the character-set select " +
      "bits' 2048-byte granularity. A code or table alignment chosen so an " +
      "indexed access never crosses a 256-byte page -- which changes " +
      "INSTRUCTION TIMING, not which bytes the hardware reads -- is a " +
      "separate, real hazard this report does not evaluate at all.",
    consequence:
      "a program relying on page-crossing timing stability must be checked " +
      "for that separately; this report's silence on it is not a claim " +
      "that no such dependency exists.",
  },
  {
    hazardClass: "page-alignment",
    limit:
      "a sprite-pointer value this detector could not resolve to a literal " +
      "at analysis time -- because it was computed at runtime rather than " +
      "loaded as an immediate -- is reported as a dependency with an " +
      "unknown target, never omitted.",
    consequence:
      "the absent blocked address on a sprite-pointer-computed-value " +
      "finding is not a claim that the store is safe to move past; it " +
      "means the target could not be named, not that none exists.",
  },
  {
    hazardClass: "cycle-exact-raster",
    limit:
      "cycle-exact correctness after relocation cannot be verified " +
      "statically on the 6502: indexed-addressing and branch-taken " +
      "instructions cost an extra cycle when they cross a 256-byte page " +
      "boundary, so moving a raster routine's start address can change " +
      "which of its own instructions cross a page and silently change its " +
      "total cycle count even though every opcode byte is unchanged. No " +
      "static algorithm for cycle-exact raster detection exists; this " +
      "class matches a structural SIGNATURE only.",
    consequence:
      "a class-4 finding is never a verified, proven or confirmed timing " +
      "claim -- it names a matched pattern consistent with cycle-exact " +
      "raster code, and whether the code actually is cycle-exact, or would " +
      "remain so after relocation, is not determined by this report.",
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
  {
    hazardClass: null,
    limit:
      "an execution observation can only ever raise a finding's detection " +
      "strength, never establish one on its own -- the underlying finding " +
      "always comes from a static signal, and an observation merely " +
      "corroborates that the anchored code was seen running.",
    consequence:
      "an address never observed executing proves nothing about whether " +
      "moving it is safe: no count, field or line in this report is " +
      "derived from the size of the never-observed population, and an " +
      "address's absence from every run's observations is never evidence " +
      "that it is safe to move.",
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

/** The literal target address an instruction's operand encodes, for an
 * addressing mode where that address does not depend on a runtime register
 * value or a runtime-computed pointer -- `null` for every other mode
 * (indirect, indirect-indexed, or no operand at all). SHARED between the
 * class-2 (self-modifying-code) detector and the class-3 (page-alignment)
 * detector's own literal-target checks: this is the ONE operand decoder,
 * never duplicated. */
function literalOperandTarget(instr: Instruction): number | null {
  if (!instr.operand) return null;
  if (!LITERAL_TARGET_MODES.has(instr.mode)) return null;
  return instr.operand.value;
}

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
    const target = literalOperandTarget(instr);
    if (target === null) continue;

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
// The class-3 (page-alignment) detector -- VIC-II hardware alignment ONLY
// ---------------------------------------------------------------------------
//
// VIC-II HARDWARE alignment, and only that reading: a VIC-II register or the
// sprite pointer names an address not as an address but as a SCALED INDEX (a
// 2048-byte character-set unit, a 64-byte sprite-shape unit), so the
// hardware silently reads whatever real bytes now sit at that index if the
// named data moves off the required boundary. A different, excluded reading
// -- a code or table alignment chosen so an indexed access never crosses a
// 256-byte page, which changes instruction TIMING rather than which bytes
// the hardware reads -- is recorded as a named limit above, never evaluated
// here.
//
// The VIC-II register arithmetic (bank base, screen base, character base,
// bitmap-vs-charset mode, the sprite pointer table's own offset) is NEVER
// re-derived in this file -- `anno-graphics.ts` already owns it, takes
// plain register-write facts and returns plain ranges, and names a
// register it never recovered instead of substituting a power-on default.
// What genuinely IS this module's job, and is not that module's by its own
// stated scope: recovering the register-write facts from DECODED BYTES
// (that module takes them as a given), and turning a derived range into a
// MOVEMENT CONSTRAINT (that module explicitly declines to promise a sprite
// shape's own address).

/** The three VIC-II registers this detector recovers constant writes for --
 * `anno-graphics.ts`'s own three exported addresses, named once here so the
 * recovery walk below reads a single set rather than three separate
 * comparisons. */
const WATCHED_VIC_REGISTERS: ReadonlySet<number> = new Set([BANK_SELECT_ADDRESS, MEMORY_CONTROL_ADDRESS, CONTROL_REGISTER_1_ADDRESS]);

/** `anno-graphics.ts`'s own register-name spelling, reversed to an address --
 * the same strings `GraphicsMap.registerValues`/`missingRegisters` already
 * use, so a lookup built from a recovered register name matches the
 * module's own vocabulary rather than inventing a second one. Built once so
 * the missing-register evidence walk below is a single lookup, never a
 * `find()` over three entries per recovered register value. */
const VIC_REGISTER_ADDRESS_BY_NAME: Readonly<Record<string, number>> = Object.freeze({
  "bank-select": BANK_SELECT_ADDRESS,
  "memory-control": MEMORY_CONTROL_ADDRESS,
  "control-register-1": CONTROL_REGISTER_1_ADDRESS,
});

const IMMEDIATE_LOAD_TO_STORE: Readonly<Record<string, string>> = Object.freeze({ lda: "sta", ldx: "stx", ldy: "sty" });

/**
 * Walks the decoded stream ONCE, pairing an immediate load with the very
 * next instruction when that next instruction is a store, through the SAME
 * register, to one of the three watched VIC-II registers -- reusing
 * `literalOperandTarget()` for the store's target rather than a second
 * operand decoder. A register value built from anything else (a
 * read-modify-write through the accumulator, an indexed store, a value
 * loaded from memory) is a genuine runtime fact this narrow recovery does
 * not claim to know, and is correctly left unrecovered rather than guessed.
 */
/** One recovered `(storeAddress, targetAddress, value)` triple -- the same
 * shape `GraphicsConstWriteFact`/`ConstWriteFact` already use elsewhere in
 * this tree. Declared locally so this generic recovery walk carries no
 * dependency of its own beyond the plain load/store shape it reads. */
interface ImmediateStoreFact {
  storeAddress: number;
  targetAddress: number;
  value: number;
}

/**
 * Walks the decoded stream ONCE, pairing an immediate load with the very
 * next instruction when that next instruction is a store, through the SAME
 * register, to one of `watched`. THE ONE adjacent-pair recovery walk in
 * this module -- both `recoverVicConstWrites()` (the three VIC-II
 * registers) and the class-4 interrupt-vector recovery below call this,
 * rather than each writing its own copy.
 */
function recoverImmediateStoreFacts(instructions: readonly Instruction[], watched: ReadonlySet<number>): ImmediateStoreFact[] {
  const facts: ImmediateStoreFact[] = [];
  for (let i = 0; i + 1 < instructions.length; i++) {
    const load = instructions[i]!;
    if (!load.operand || load.operand.role !== "immediate") continue;
    const expectedStore = IMMEDIATE_LOAD_TO_STORE[load.mnemonic];
    if (!expectedStore) continue;

    const store = instructions[i + 1]!;
    if (store.mnemonic !== expectedStore) continue;
    const target = literalOperandTarget(store);
    if (target === null || !watched.has(target)) continue;

    facts.push({ storeAddress: store.address, targetAddress: target, value: load.operand.value });
  }
  return facts;
}

function recoverVicConstWrites(instructions: readonly Instruction[]): GraphicsConstWriteFact[] {
  return recoverImmediateStoreFacts(instructions, WATCHED_VIC_REGISTERS);
}

/** The store address of the FIRST recovered fact writing `value` to
 * `targetAddress`, or `null` -- the anchor for a graphics-derived finding:
 * the store that actually SET the register value the derivation used. */
function anchorForRegisterValue(facts: readonly GraphicsConstWriteFact[], targetAddress: number, value: number): number | null {
  for (const fact of facts) {
    if (fact.targetAddress === targetAddress && fact.value === value) return fact.storeAddress;
  }
  return null;
}

const CHARSET_DETAIL =
  "the VIC-II reads this character set through a 2048-byte-granularity " +
  "index stored in the memory-control register; relocating the character " +
  "data without updating that register (or vice versa) leaves the register " +
  "naming the OLD 2048-byte-aligned block while the bytes moved -- the " +
  "hardware silently reads whatever now sits at that index, with no error, " +
  "exception or diagnostic.";

const SPRITE_RESOLVED_DETAIL =
  `the VIC-II reads this sprite's shape through a 64-byte-granularity index ` +
  `stored in the sprite pointer byte (the sprite pointer table sits at a ` +
  `fixed $${SPRITE_POINTER_OFFSET.toString(16)} offset from the screen ` +
  "matrix base); relocating the shape data without updating that pointer " +
  "leaves it naming the OLD 64-byte-aligned block, and the hardware " +
  "silently renders whatever now sits there instead.";

const SPRITE_COMPUTED_DETAIL =
  "this store targets the sprite pointer table but its value could not be " +
  "resolved to a literal at analysis time, so whether the resulting " +
  "64-byte-aligned base is satisfied is unknown -- the dependency is real " +
  "even though this report cannot name the block it points at.";

interface GraphicsEvaluation {
  findings: HazardFinding[];
  /** Store address -> reason, for every recovered fact whose OWN recovered
   * combination has at least one missing register -- "we looked and could
   * not tell", never folded into "no-signal" ("we looked and found
   * nothing"). Consumed by `classifyRegions()` below. */
  incompleteAreas: Map<number, string>;
  /** Every `sprite-pointers`-kind range any recovered combination derived,
   * across every map -- what `detectSpritePointerStores()` tests a literal
   * store target against. */
  spriteRanges: GraphicsRange[];
}

/**
 * Hands the recovered facts to the EXISTING graphics derivation
 * (`deriveGraphicsRanges()`, never re-implemented here) and turns its
 * answer into class-3 findings for the character-set range only -- screen
 * matrix and bitmap-mode ranges are out of this detector's declared scope
 * (see this module's own mechanism-id list).
 */
function evaluateGraphicsFacts(facts: readonly GraphicsConstWriteFact[], imageStart: number, imageEndInclusive: number): GraphicsEvaluation {
  const findings: HazardFinding[] = [];
  const incompleteAreas = new Map<number, string>();
  const spriteRanges: GraphicsRange[] = [];
  if (facts.length === 0) return { findings, incompleteAreas, spriteRanges };

  const maps = deriveGraphicsRanges(facts);
  for (const map of maps) {
    if (map.missingRegisters.length > 0) {
      const reason =
        `the VIC-II register recovery for this combination is incomplete -- missing ${map.missingRegisters.join(", ")} -- ` +
        "so this report could not determine whether a page-alignment dependency exists here; that is a limit of what was " +
        "recovered, not a finding that nothing depends on it.";
      for (const [name, value] of Object.entries(map.registerValues)) {
        const targetAddress = VIC_REGISTER_ADDRESS_BY_NAME[name];
        if (targetAddress === undefined) continue;
        for (const fact of facts) {
          if (fact.targetAddress === targetAddress && fact.value === value) incompleteAreas.set(fact.storeAddress, reason);
        }
      }
    }

    for (const range of map.ranges) {
      if (range.kind === "sprite-pointers") spriteRanges.push(range);
      if (range.kind !== "character-set") continue;
      if (range.start < imageStart || range.start > imageEndInclusive) continue;

      const memoryControlValue = map.registerValues["memory-control"];
      const anchor = memoryControlValue !== undefined ? anchorForRegisterValue(facts, MEMORY_CONTROL_ADDRESS, memoryControlValue) : null;
      findings.push({
        hazardClass: "page-alignment",
        anchorAddress: anchor ?? range.start,
        blockedAddress: range.start,
        mechanism: "charset-base-pinned-by-register",
        strength: "static-shape-matched",
        detail: CHARSET_DETAIL,
        corroboration: "none",
      });
    }
  }
  return { findings, incompleteAreas, spriteRanges };
}

const SPRITE_STORE_TO_LOAD: Readonly<Record<string, string>> = Object.freeze({ sta: "lda", stx: "ldx", sty: "ldy" });

/**
 * A store whose literal target lands inside ANY derived sprite-pointers
 * range is a sprite shape selection -- the one signal the graphics module
 * deliberately does not promise (it derives the pointer TABLE range only,
 * never a shape's own address). When the value stored is an immediate
 * literal, the blocked address is that value times 64 (the fixed sprite
 * granularity); otherwise the dependency is real but its target is not
 * statically known, reported at the weakest strength with no blocked
 * address.
 */
function detectSpritePointerStores(
  instructions: readonly Instruction[],
  spriteRanges: readonly GraphicsRange[],
  imageStart: number,
  imageEndInclusive: number,
): HazardFinding[] {
  const findings: HazardFinding[] = [];
  if (spriteRanges.length === 0) return findings;

  for (let i = 0; i < instructions.length; i++) {
    const instr = instructions[i]!;
    const expectedLoad = SPRITE_STORE_TO_LOAD[instr.mnemonic];
    if (!expectedLoad) continue;
    const target = literalOperandTarget(instr);
    if (target === null) continue;
    if (!spriteRanges.some((r) => target >= r.start && target <= r.endInclusive)) continue;

    const prev = i > 0 ? instructions[i - 1] : undefined;
    const sourcedFromImmediate = !!prev && prev.mnemonic === expectedLoad && prev.operand?.role === "immediate";

    if (sourcedFromImmediate) {
      const value = prev!.operand!.value;
      const blockedAddress = value * 64;
      if (blockedAddress < imageStart || blockedAddress > imageEndInclusive) continue; // not in this image -- no finding
      findings.push({
        hazardClass: "page-alignment",
        anchorAddress: instr.address,
        blockedAddress,
        mechanism: "sprite-pointer-names-aligned-base",
        strength: "static-shape-matched",
        detail: SPRITE_RESOLVED_DETAIL,
        corroboration: "none",
      });
    } else {
      findings.push({
        hazardClass: "page-alignment",
        anchorAddress: instr.address,
        blockedAddress: null,
        mechanism: "sprite-pointer-computed-value",
        strength: "static-signature-only",
        detail: SPRITE_COMPUTED_DETAIL,
        corroboration: "none",
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// The class-4 (cycle-exact-raster) detector -- structural SIGNATURE only
// ---------------------------------------------------------------------------
//
// No static algorithm for cycle-exact raster detection exists (stated
// verbatim in `HAZARD_LIMITS`'s own `cycle-exact-raster` entry). What this
// detector matches is a STRUCTURAL SIGNATURE consistent with the textbook
// double-IRQ stabiliser and its timer-based variant -- never a claim that
// the matched code IS cycle-exact, and never a claim it would REMAIN so
// after relocation. Every finding this detector emits carries the WEAKEST
// detection-strength token unless a runtime observation covers its own
// anchor address; its mechanism ids and detail prose are structurally
// asserted (this module's own test file) to never contain a word that
// asserts verification.

/** The RAM-resident IRQ vector KERNAL-hooking code installs through
 * (`$0314`/`$0315`) -- not the hardware vector at `$FFFE`/`$FFFF`, which
 * sits in ROM and is not the address real C64 programs rewrite. */
const IRQ_VECTOR_LOW = 0x0314;
const IRQ_VECTOR_HIGH = 0x0315;
const IRQ_VECTOR_ADDRESSES: ReadonlySet<number> = new Set([IRQ_VECTOR_LOW, IRQ_VECTOR_HIGH]);

/** `$D012` serves both roles this detector treats as one signal: reading it
 * returns the current raster line, and writing it sets the raster-compare
 * value the next raster IRQ fires against. Either access is "a raster
 * register access" for this detector's purposes. */
const RASTER_REGISTER_ADDRESS = 0xd012;

/** CIA1 Timer A's reload (latch) registers -- the ones a one-shot
 * stabiliser reloads on every interrupt. CIA1, not CIA2: CIA1 drives the
 * IRQ line this detector's vectored-handler walk is already anchored on. */
const TIMER_A_RELOAD_ADDRESSES: ReadonlySet<number> = new Set([0xdc04, 0xdc05]);

const RASTER_SIGNATURE_DETAIL =
  "a structural signature consistent with cycle-exact raster code was " +
  "matched: a raster-register access inside a routine an interrupt vector " +
  "names. No static check here determines whether the code is actually " +
  "cycle-exact, or whether it would remain so after relocation.";

const TIMING_SLED_SIGNATURE_DETAIL =
  "a structural signature consistent with cycle-exact raster code was " +
  "matched: a run of no-operation instructions immediately following a " +
  "raster-register access, the textbook jitter-compensation sled. No " +
  "static check here determines whether the code is actually cycle-exact, " +
  "or whether it would remain so after relocation.";

const TIMER_RELOAD_SIGNATURE_DETAIL =
  "a structural signature consistent with cycle-exact raster code was " +
  "matched: a one-shot timer reload written inside a routine an interrupt " +
  "vector names, the CIA-timer stabiliser variant. No static check here " +
  "determines whether the code is actually cycle-exact, or whether it " +
  "would remain so after relocation.";

/** Cross-products every recovered low-byte write against every recovered
 * high-byte write of the RAM IRQ vector into 16-bit target addresses,
 * deduplicated. This detector recognises the conventional low-then-high
 * install order's TWO byte facts regardless of their relative position in
 * the stream (`recoverImmediateStoreFacts()` finds each independently); it
 * does not attempt to prove the two stores belong to a single 4-instruction
 * idiom, which would be a second, narrower recovery this module does not
 * need for the signature it matches. */
function recoverInterruptVectorTargets(instructions: readonly Instruction[]): number[] {
  const facts = recoverImmediateStoreFacts(instructions, IRQ_VECTOR_ADDRESSES);
  const lowValues = facts.filter((f) => f.targetAddress === IRQ_VECTOR_LOW).map((f) => f.value);
  const highValues = facts.filter((f) => f.targetAddress === IRQ_VECTOR_HIGH).map((f) => f.value);
  const targets = new Set<number>();
  for (const lo of lowValues) {
    for (const hi of highValues) targets.add((lo | (hi << 8)) & 0xffff);
  }
  return [...targets];
}

/**
 * Walks forward from `handlerAddress` (an instruction START address only --
 * a mid-instruction byte is not a real entry point) to the first
 * return-from-interrupt (`rti`) or return-from-subroutine (`rts`),
 * collecting every instruction in between. Bounded by construction: no
 * revisit, no recursion, and the walk stops at the first return OR the end
 * of the already-decoded (already image-bounded) instruction array,
 * whichever comes first.
 */
function handlerWindow(instructions: readonly Instruction[], addressToIndex: ReadonlyMap<number, number>, handlerAddress: number): Instruction[] | null {
  const startIdx = addressToIndex.get(handlerAddress);
  if (startIdx === undefined) return null;
  const window: Instruction[] = [];
  for (let i = startIdx; i < instructions.length; i++) {
    const instr = instructions[i]!;
    window.push(instr);
    if (instr.opcode === 0x40 /* rti */ || instr.opcode === 0x60 /* rts */) break;
  }
  return window;
}

function class4Strength(anchorAddress: number, observedAddresses: ReadonlySet<number>): HazardDetectionStrength {
  return observedAddresses.has(anchorAddress) ? "observed-corroborated" : "static-signature-only";
}

/**
 * Structural signature matching ONLY -- see this section's own header.
 * Collects every RAM IRQ vector target this image recovers, walks each
 * one's handler window (when the target names a real instruction start
 * inside the image), and emits one finding per signal that fires.
 */
function detectCycleExactRasterSignatures(
  instructions: readonly Instruction[],
  addressToIndex: ReadonlyMap<number, number>,
  imageStart: number,
  imageEndInclusive: number,
  observedAddresses: ReadonlySet<number>,
): HazardFinding[] {
  const findings: HazardFinding[] = [];
  const targets = recoverInterruptVectorTargets(instructions);

  for (const handlerAddress of targets) {
    if (handlerAddress < imageStart || handlerAddress > imageEndInclusive) continue; // named address lies outside the image
    const window = handlerWindow(instructions, addressToIndex, handlerAddress);
    if (window === null) continue; // not a real instruction start -- nothing to walk

    let rasterAccessAnchor: number | null = null;
    let timingSledAnchor: number | null = null;
    let timerReloadAnchor: number | null = null;

    for (let i = 0; i < window.length; i++) {
      const instr = window[i]!;
      const target = literalOperandTarget(instr);
      if (target === null) continue;

      if (target === RASTER_REGISTER_ADDRESS) {
        if (rasterAccessAnchor === null) rasterAccessAnchor = instr.address;
        // A timing sled is a run of >= 3 NOPs IMMEDIATELY following this
        // access -- checked once per raster access, so the FIRST qualifying
        // run in the window is what is reported.
        if (timingSledAnchor === null && i + 3 < window.length) {
          const allNop = window[i + 1]!.opcode === 0xea && window[i + 2]!.opcode === 0xea && window[i + 3]!.opcode === 0xea;
          if (allNop) timingSledAnchor = instr.address;
        }
      } else if (TIMER_A_RELOAD_ADDRESSES.has(target) && (instr.mnemonic === "sta" || instr.mnemonic === "stx" || instr.mnemonic === "sty")) {
        if (timerReloadAnchor === null) timerReloadAnchor = instr.address;
      }
    }

    if (rasterAccessAnchor !== null) {
      findings.push({
        hazardClass: "cycle-exact-raster",
        anchorAddress: rasterAccessAnchor,
        blockedAddress: null,
        mechanism: "raster-access-in-vectored-handler",
        strength: class4Strength(rasterAccessAnchor, observedAddresses),
        detail: RASTER_SIGNATURE_DETAIL,
        corroboration: observedAddresses.has(rasterAccessAnchor) ? "runtime-observed" : "none",
      });
    }
    if (timingSledAnchor !== null) {
      findings.push({
        hazardClass: "cycle-exact-raster",
        anchorAddress: timingSledAnchor,
        blockedAddress: null,
        mechanism: "timing-sled-after-raster-access",
        strength: class4Strength(timingSledAnchor, observedAddresses),
        detail: TIMING_SLED_SIGNATURE_DETAIL,
        corroboration: observedAddresses.has(timingSledAnchor) ? "runtime-observed" : "none",
      });
    }
    if (timerReloadAnchor !== null) {
      findings.push({
        hazardClass: "cycle-exact-raster",
        anchorAddress: timerReloadAnchor,
        blockedAddress: null,
        mechanism: "timer-reload-in-vectored-handler",
        strength: class4Strength(timerReloadAnchor, observedAddresses),
        detail: TIMER_RELOAD_SIGNATURE_DETAIL,
        corroboration: observedAddresses.has(timerReloadAnchor) ? "runtime-observed" : "none",
      });
    }
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
  incompleteEvidence: ReadonlyMap<number, string> = new Map(),
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
        let incompleteReason: string | undefined;
        const clampedEnd = Math.min(endInclusive, 0xffff);
        for (let addr = Math.max(start, 0); addr <= clampedEnd; addr++) {
          if (findingAddresses.has(addr)) {
            hit = true;
            break;
          }
          // "We looked and could not tell" (a recovered-but-incomplete VIC-II
          // register combination) is never folded into "no-signal" ("we
          // looked and found nothing"). A real finding elsewhere in this
          // same region still wins (checked first, above), because a proven
          // hazard is not weakened by an unrelated recovery gap.
          if (incompleteReason === undefined && incompleteEvidence.has(addr)) {
            incompleteReason = incompleteEvidence.get(addr);
          }
        }
        if (hit) {
          outcome = "hazard-reported";
        } else if (incompleteReason !== undefined) {
          outcome = "unclassified";
          reason = incompleteReason;
        } else {
          outcome = "no-signal";
        }
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

  const classesEvaluated: HazardClass[] = imageIsEmpty
    ? []
    : ["indexed-dispatch", "self-modifying-code", "page-alignment", "cycle-exact-raster"];

  // The ONE new call site this plan adds. Same triple the existing consumer
  // (`buildCoverageReport()`) passes: the already-decoded instruction stream,
  // the raw bytes, and the origin -- see `hazard reuse:` in this module's
  // own test file for why a second call site anywhere else is a defect.
  const dispatchScan: IndirectDispatchScan | null = imageIsEmpty ? null : scanIndirectDispatch(instructions, bytes, origin);

  const vicFacts = imageIsEmpty ? [] : recoverVicConstWrites(instructions);
  const graphicsEvaluation = evaluateGraphicsFacts(vicFacts, origin, imageEndInclusive);
  const spriteFindings = imageIsEmpty
    ? []
    : detectSpritePointerStores(instructions, graphicsEvaluation.spriteRanges, origin, imageEndInclusive);

  // address -> index in `instructions`, first-wins -- only instruction
  // START addresses key this map, unlike `instructionIndex` above (which
  // keys every byte an instruction occupies).
  const addressToIndex = new Map<number, number>();
  instructions.forEach((instr, idx) => {
    if (!addressToIndex.has(instr.address)) addressToIndex.set(instr.address, idx);
  });
  const rasterFindings = imageIsEmpty
    ? []
    : detectCycleExactRasterSignatures(instructions, addressToIndex, origin, imageEndInclusive, observedAddresses);

  const rawFindings = imageIsEmpty
    ? []
    : [
        ...detectIndexedDispatch(dispatchScan!),
        ...detectSelfModifyingCode(instructions, instructionIndex, observedAddresses),
        ...graphicsEvaluation.findings,
        ...spriteFindings,
        ...rasterFindings,
      ];
  const findings = sortFindings(dedupeFindings(rawFindings));

  const findingAddresses = new Set<number>();
  for (const f of findings) {
    findingAddresses.add(f.anchorAddress);
    if (f.blockedAddress !== null) findingAddresses.add(f.blockedAddress);
  }

  const regions = classifyRegions(
    ranges,
    origin,
    imageEndInclusive,
    imageIsEmpty,
    classesEvaluated,
    findingAddresses,
    graphicsEvaluation.incompleteAreas,
  );

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

// ---------------------------------------------------------------------------
// The cross-check comparator -- measuring the detectors above against
// programs this phase did not author
// ---------------------------------------------------------------------------
//
// Shaped exactly like `dxa-proof01-compare.ts`'s own comparator (an already
// -built answer in, a denominator plus three counts plus three sorted
// address arrays out, never a score, a rate or a percentage anywhere): the
// same discipline, applied to this report instead of a dxa listing.
//
// WHAT MAKES THIS A CONTROL RATHER THAN A SECOND OPINION FROM THE SAME
// SOURCE: the expectation this comparator joins against is never derived
// from a detector run. It is read from a fixture's own committed source or
// bytes by a person, before this function is ever called, and it is never
// edited afterward to make a disagreeing row agree. When a row disagrees,
// exactly one of two things is true -- the expectation was wrong about the
// fixture's own bytes (provable by reading them again) or the detector is
// wrong -- and both are findings this comparator exists to surface, never a
// reason to move the expectation. Moving it would convert the one
// independent control this phase has into a mirror of the thing it checks.

function sortAscendingNumbers(values: Iterable<number>): number[] {
  return [...values].sort((a, b) => a - b);
}

/**
 * One committed fixture's declared expectation for one hazard class --
 * ground truth this phase did NOT derive from any detector run.
 * `expectedAddresses` is populated only for `kind: "positive"`; empty for
 * the other two kinds. `kind` distinguishes three cases:
 *   - `positive`: an independently-sourced fixture genuinely carries this
 *     class, at exactly the named addresses.
 *   - `negative`: the fixture carries none of this class -- any reported
 *     address of this class on it is a false positive.
 *   - `no-example`: this phase has no independently-sourced positive
 *     fixture for this class at all. The comparator returns a marker for
 *     this row, not a measurement -- see `crossCheckHazardFixture()`.
 */
export interface HazardCrossCheckExpectation {
  fixture: string;
  hazardClass: HazardClass;
  kind: "positive" | "negative" | "no-example";
  expectedAddresses: readonly number[];
}

/**
 * The comparator's answer for one fixture, one class. An explicit
 * denominator, three counts, three sorted-ascending address arrays, and a
 * named positive class -- mirroring `Proof01Comparison`'s own shape exactly.
 * There is no boolean, no score, no rate and no percentage anywhere in this
 * type, and the comparator computes none at any point.
 *
 * For a `no-example` expectation, every count and the denominator are zero
 * and every address array is empty: a MEASUREMENT of "nothing to measure",
 * never silently absent -- the same distinction `HazardRegionOutcome`'s own
 * three-way split preserves one layer up.
 */
export interface HazardCrossCheckResult {
  fixture: string;
  hazardClass: HazardClass;
  kind: "positive" | "negative" | "no-example";
  /** Always equal to `hazardClass` -- the class this row measures, named as
   * its own field so the shape mirrors `Proof01Comparison`'s own
   * `positiveClass` field rather than requiring a reader to infer it from
   * `hazardClass` alone. */
  positiveClass: HazardClass;
  /** `expectedAddresses.length` for a `positive` row, `0` for the other two
   * kinds. Never the image size and never a count copied from the report. */
  denominator: number;
  detected: number;
  missed: number;
  falsePositive: number;
  detectedAddresses: number[];
  missedAddresses: number[];
  falsePositiveAddresses: number[];
}

/**
 * Joins one already-built report against one declared expectation for one
 * fixture, one hazard class. See this section's own header for why the
 * expectation itself is never edited to match what this function returns.
 *
 * The join is the same three-way branch `compareByteDerivedRecovery()`
 * already uses: walk the expected addresses first, partitioning into
 * detected and missed; then walk the reported addresses of this class,
 * adding any the expectation did not name to false-positive.
 */
export function crossCheckHazardFixture(report: HazardReport, expectation: HazardCrossCheckExpectation): HazardCrossCheckResult {
  const { fixture, hazardClass, kind, expectedAddresses } = expectation;

  if (kind === "no-example") {
    return {
      fixture,
      hazardClass,
      kind,
      positiveClass: hazardClass,
      denominator: 0,
      detected: 0,
      missed: 0,
      falsePositive: 0,
      detectedAddresses: [],
      missedAddresses: [],
      falsePositiveAddresses: [],
    };
  }

  // Joined against `blockedAddress` ONLY, never `anchorAddress` too: the
  // expectation names the address that cannot move (the thing a positive
  // row's own comment derives from the fixture's bytes), and the anchor is
  // merely where the write that blocks it is issued from -- counting the
  // anchor as a second "reported address" would manufacture a false
  // positive out of every real detection whose anchor and blocked address
  // legitimately differ (an operand-byte hit, a table dispatch, a
  // register-pinned charset base). A finding with no blocked address (class
  // 4's structural signatures, an unresolved sprite-pointer target) names no
  // address at all and contributes nothing here, exactly like a `no-example`
  // expectation contributes nothing to any count.
  const reportedAddresses = new Set<number>();
  for (const finding of report.findings) {
    if (finding.hazardClass !== hazardClass) continue;
    if (finding.blockedAddress !== null) reportedAddresses.add(finding.blockedAddress);
  }

  const expectedSet = new Set(expectedAddresses);
  const detectedAddresses: number[] = [];
  const missedAddresses: number[] = [];
  for (const address of expectedSet) {
    if (reportedAddresses.has(address)) detectedAddresses.push(address);
    else missedAddresses.push(address);
  }
  const falsePositiveAddresses: number[] = [];
  for (const address of reportedAddresses) {
    if (!expectedSet.has(address)) falsePositiveAddresses.push(address);
  }

  const detected = sortAscendingNumbers(detectedAddresses);
  const missed = sortAscendingNumbers(missedAddresses);
  const falsePositive = sortAscendingNumbers(falsePositiveAddresses);

  return {
    fixture,
    hazardClass,
    kind,
    positiveClass: hazardClass,
    denominator: expectedSet.size,
    detected: detected.length,
    missed: missed.length,
    falsePositive: falsePositive.length,
    detectedAddresses: detected,
    missedAddresses: missed,
    falsePositiveAddresses: falsePositive,
  };
}
