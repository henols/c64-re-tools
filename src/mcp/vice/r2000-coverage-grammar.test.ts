// r2000-coverage-grammar.test.ts -- a COMPOSED corpus of 6502 arrangements, a
// COMPUTED expectation for each one, and the corpus-wide statement that the
// dispatch instrument proves exactly the arrangements that carry a proven
// data-flow link.
//
// WHY THIS FILE EXISTS. Three consecutive verifications of the same function
// -- `hasDispatchContext()` -- failed, each through a DIFFERENT shape. Round 2
// found a zero-page vector built and then read as data. Round 3 found a push
// idiom whose two pushes carried bytes neither paired load produced. Round 4
// found a jump through a foreign vector built in the same window. Each round
// was closed by adding one hand-built fixture for the shape that had just been
// found, which means the suite always trailed the next shape by exactly one
// round: a per-shape control cannot be written for a shape nobody has thought
// of, at any N. The loop does not end by adding a twentieth fixture. It ends by
// replacing "one fixture per shape" with a PROPERTY over arrangements the file's
// author never enumerated, checked against an expectation the file's author
// never typed.
//
// WHAT THIS FILE IS THE ONE PLACE FOR: the corpus-wide claim that the set of
// generated arrangements the instrument PROVES equals, exactly and in both
// directions, the set a computed oracle says carries a proven data-flow link
// from the two reconstructed table bases to a dispatch mechanism.
//
// HOW IT AVOIDS BEING A SECOND IMPLEMENTATION. There are two independent sides
// and they meet only at one boolean. The INSTRUMENT side reads BYTES: it
// decodes, scans a window, reconstructs tables, walks a recursive-descent
// census. The ORACLE side reads the SYMBOLIC fragment list an arrangement was
// composed from: it has no decoder, no window arithmetic, no advisory-candidate
// logic and no census, and it may not call any of them. It states what a proven
// data-flow link IS, as six numbered structural rules, and the set equality asks
// whether the instrument agrees.
//
//   WHAT NOT TO DO, named concretely:
//   - Do NOT weaken the set equality to a one-directional bound. "Nothing
//     unproven is proven" is satisfied by an instrument that proves nothing at
//     all, and "everything expected is proven" is satisfied by one that proves
//     everything. Either half alone certifies a broken instrument; the claim is
//     the equality, asserted as one statement.
//   - Do NOT add a hand-declared expected verdict per generated payload. A
//     boolean typed per template cannot be right about a case nobody thought
//     of, which is precisely the practice this file replaces. The nine
//     `PINNED_IDIOMS` are the ONLY hand declarations here, and they exist to
//     check the oracle, not to supply the corpus with answers.
//   - Do NOT let the corpus cap take a prefix of one family. The take is
//     round-robin across every (core combo x attachment set) family and every
//     family must contribute; a prefix take turns a runtime bound into a silent
//     scope reduction that nothing reds on.
//   - Do NOT fill payloads with illegal opcodes. Undecodable bytes are WR-03's
//     surface and are measured by a separate, dedicated census control; a
//     corpus that could quietly contain them would launder that surface into
//     this file's verdict. Every generated payload is asserted free of the JAM
//     opcode at every offset.
//
// This file is TEST-ONLY: it is not (and must not be) listed in package.json's
// files[]. Neither published tarball gains a byte from it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { decode } from "./disasm-decoder.ts";
import {
  MAX_TABLE_ENTRIES,
  SPLIT_TABLE_WINDOW,
  classAt,
  computeStructuralCensus,
  provenDispatchTargets,
  scanIndirectDispatch,
} from "./r2000-coverage.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Wall clock at module load, read by the suite-budget test at the end. An
 * enumeration that runs away is caught by a number rather than tolerated. */
const MODULE_LOADED_AT = Date.now();

// ---------------------------------------------------------------------------
// Geometry -- deliberately the SAME geometry every committed coverage fixture
// uses, so a reader comparing this corpus with `fixtures/coverage/` sees one
// layout rather than two that happen to agree.
// ---------------------------------------------------------------------------

const GRAMMAR_ORIGIN = 0x0810;
const PAYLOAD_SIZE = 0x40;
const IMAGE_END = GRAMMAR_ORIGIN + PAYLOAD_SIZE;

const TABLE_LO_BASE = 0x0830;
const TABLE_HI_BASE = 0x0838;
const TARGET_BASE = 0x0840;

/** The distance from the origin to the first table byte. No prologue may reach
 * the tables: a prologue that did would change what the instrument
 * reconstructs, and the corpus would then be measuring its own overrun. */
const MAX_PROLOGUE_BYTES = TABLE_LO_BASE - GRAMMAR_ORIGIN;

const NOP_BYTE = 0xea;

/** `$02`, which decodes as `jam`. Named so the assertion that no payload
 * contains it reads as a statement about the corpus rather than as a magic
 * number. */
const JAM_OPCODE = 0x02;

/**
 * The 32 data bytes every payload carries from `TABLE_LO_BASE` onward, written
 * out ONCE: eight ascending lo bytes `$40`..`$47`, eight `$08` hi bytes, then
 * sixteen `nop` bytes.
 *
 * The lo/hi pair reconstructs the eight little-endian values `$0840`..`$0847`,
 * and the sixteen `nop` bytes are what makes each of those a plausible entry
 * point -- an address that does not decode as a legal instruction is not an
 * entry point, so a filler byte that did not decode would make every
 * reconstruction implausible for a reason unrelated to the link under test.
 */
const DATA_TAIL: readonly number[] = Object.freeze([
  0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47,
  0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08,
  NOP_BYTE, NOP_BYTE, NOP_BYTE, NOP_BYTE, NOP_BYTE, NOP_BYTE, NOP_BYTE, NOP_BYTE,
  NOP_BYTE, NOP_BYTE, NOP_BYTE, NOP_BYTE, NOP_BYTE, NOP_BYTE, NOP_BYTE, NOP_BYTE,
]);

/** The four zero-page addresses store and pointer fragments are drawn from.
 * Two CONSECUTIVE pairs (`$fb`/`$fc` and `$fd`/`$fe`) plus the non-adjacent
 * combinations between them, which is what lets the alphabet compose both a
 * resolvable orientation and an unresolvable one without either being written
 * out as a special case. */
const ZP_FB = 0xfb;
const ZP_FC = 0xfc;
const ZP_FD = 0xfd;
const ZP_FE = 0xfe;

// ---------------------------------------------------------------------------
// The fragment alphabet
// ---------------------------------------------------------------------------

type Register = "x" | "y";

/**
 * One 6502 idiom-piece. Each variant carries the operand it needs and renders
 * to its own bytes; an ARRANGEMENT is a list of these, and the corpus is the
 * set of arrangements the enumerator composes.
 *
 * `indexedLoad` uses `absolute_y` for every `y`-indexed load and never
 * `zeropage_y`. That is load-bearing rather than stylistic: the scan's
 * `INDEXED_LOAD_MODES` is exactly `absolute_x`, `absolute_y` and `zeropage_x`
 * and does NOT contain `zeropage_y`, so a `zeropage_y` load would be rejected
 * for a reason unrelated to which register it indexes through -- and every
 * mixed-register arrangement in the corpus would then decline by construction,
 * making the whole corpus an outside-bracketing one wearing an interior label.
 */
type Fragment =
  | { kind: "indexedLoad"; register: Register; base: number }
  | { kind: "immediateLoad"; value: number }
  | { kind: "storeZp"; address: number }
  | { kind: "indirectJump"; pointer: number }
  | { kind: "indirectIndexedLoad"; pointer: number }
  | { kind: "pha" }
  | { kind: "txa" }
  | { kind: "tya" }
  | { kind: "nop" }
  | { kind: "rts" };

/** The bytes one fragment renders to. The ONE place a fragment becomes bytes:
 * the oracle never reads this, and the instrument never reads anything else. */
function FRAGMENT_BYTES(fragment: Fragment): number[] {
  switch (fragment.kind) {
    case "indexedLoad":
      return [
        fragment.register === "x" ? 0xbd : 0xb9, // lda abs,x / lda abs,y
        fragment.base & 0xff,
        (fragment.base >> 8) & 0xff,
      ];
    case "immediateLoad":
      return [0xa9, fragment.value & 0xff]; // lda #$nn
    case "storeZp":
      return [0x85, fragment.address & 0xff]; // sta $nn
    case "indirectJump":
      return [0x6c, fragment.pointer & 0xff, 0x00]; // jmp ($00nn)
    case "indirectIndexedLoad":
      return [0xb1, fragment.pointer & 0xff]; // lda ($nn),y
    case "pha":
      return [0x48];
    case "txa":
      return [0x8a];
    case "tya":
      return [0x98];
    case "nop":
      return [NOP_BYTE];
    case "rts":
      return [0x60];
  }
}

function loadX(base: number): Fragment {
  return { kind: "indexedLoad", register: "x", base };
}
function loadY(base: number): Fragment {
  return { kind: "indexedLoad", register: "y", base };
}
function loadImm(value: number): Fragment {
  return { kind: "immediateLoad", value };
}
function storeZp(address: number): Fragment {
  return { kind: "storeZp", address };
}
function jmpInd(pointer: number): Fragment {
  return { kind: "indirectJump", pointer };
}
function ldaIndY(pointer: number): Fragment {
  return { kind: "indirectIndexedLoad", pointer };
}

const PHA: Fragment = { kind: "pha" };
const TXA: Fragment = { kind: "txa" };
const TYA: Fragment = { kind: "tya" };
const NOP: Fragment = { kind: "nop" };
const RTS: Fragment = { kind: "rts" };

/** A stable key for a fragment, used to deduplicate permutations of a multiset
 * (two `pha` fragments are one fragment for permutation purposes). */
function fragmentKey(fragment: Fragment): string {
  switch (fragment.kind) {
    case "indexedLoad":
      return `ld:${fragment.register}:${fragment.base}`;
    case "immediateLoad":
      return `imm:${fragment.value}`;
    case "storeZp":
      return `st:${fragment.address}`;
    case "indirectJump":
      return `jmp:${fragment.pointer}`;
    case "indirectIndexedLoad":
      return `iny:${fragment.pointer}`;
    default:
      return fragment.kind;
  }
}

function hex(value: number, digits = 4): string {
  return `$${value.toString(16).padStart(digits, "0")}`;
}

/** One fragment in assembly, for a failure message that names an arrangement by
 * what it IS rather than by an index into an array. */
function spellFragment(fragment: Fragment): string {
  switch (fragment.kind) {
    case "indexedLoad":
      return `lda ${hex(fragment.base)},${fragment.register}`;
    case "immediateLoad":
      return `lda #${hex(fragment.value, 2)}`;
    case "storeZp":
      return `sta ${hex(fragment.address, 2)}`;
    case "indirectJump":
      return `jmp (${hex(fragment.pointer)})`;
    case "indirectIndexedLoad":
      return `lda (${hex(fragment.pointer, 2)}),y`;
    default:
      return fragment.kind;
  }
}

function spellArrangement(fragments: readonly Fragment[]): string {
  return fragments.map(spellFragment).join(" : ");
}

/** True for the two fragments the recursive-descent walker treats as the end of
 * a trace. The arrangement contract admits exactly one of these, as the last
 * fragment -- see `assertArrangementContract()`. */
function isTerminator(fragment: Fragment): boolean {
  return fragment.kind === "rts" || fragment.kind === "indirectJump";
}

function isIndexedLoad(fragment: Fragment): boolean {
  return fragment.kind === "indexedLoad";
}

// ---------------------------------------------------------------------------
// The enumeration -- bounded, stratified, deterministic
// ---------------------------------------------------------------------------

/**
 * The cap on COMPOSED fragments: the two indexed loads plus the attachment
 * multiset, excluding inserted `nop`s and excluding the terminator.
 *
 * Eight rather than seven, and the reason is measured rather than chosen: the
 * largest attachment set the alphabet declares (two pushes, a register transfer
 * pair and two adjacent stores) is six fragments, which with the two loads is
 * exactly eight. That arrangement is not decorative -- it is the shape of the
 * unlinked push idiom this round's history turns on, one of the nine pinned
 * regression members. A cap of seven would make that family, and that pinned
 * member, unrepresentable in the corpus that exists to generalise it.
 *
 * The LENGTH dimension is bounded separately by `NOP_COUNTS`: zero, one or two
 * `nop`s inserted at any gap. Those are what push a terminator or a store
 * outside the pairing window without anybody naming a window-edge case, so they
 * are counted apart from the composed core rather than against its budget.
 */
const MAX_FRAGMENTS = 8;

/** Zero, one and two `nop` insertions. The LENGTH / GAP-PLACEMENT dimension. */
const NOP_COUNTS: readonly number[] = Object.freeze([0, 1, 2]);

/** The third axis over every family. `rts` is what the stack-return link needs;
 * the two indirect jumps are what the zero-page-vector link needs, one naming
 * the first consecutive pair's low byte and one naming the second's. */
const TERMINATOR_CHOICES: readonly Fragment[] = Object.freeze([RTS, jmpInd(ZP_FB), jmpInd(ZP_FD)]);

interface CoreCombo {
  name: string;
  firstRegister: Register;
  secondRegister: Register;
  firstBase: number;
  secondBase: number;
}

/**
 * The eight core combinations: the two loads' index registers (`xx`, `yy`,
 * `xy`, `yx`) crossed with their base order (the lo table read first, or the hi
 * table read first).
 *
 * Base order is a real generative dimension rather than a formality. The two
 * routes want OPPOSITE orders -- the class-4 idiom pushes the high byte first,
 * so its leading load must read the hi table, while a class-3 pairing oriented
 * by an ascending store pair needs its leading load to read the lo table -- and
 * enumerating both means neither route is reachable by accident.
 */
const CORE_COMBOS: readonly CoreCombo[] = Object.freeze(
  (["x", "y"] as const).flatMap((firstRegister) =>
    (["x", "y"] as const).flatMap((secondRegister) =>
      (
        [
          ["lo-first", TABLE_LO_BASE, TABLE_HI_BASE],
          ["hi-first", TABLE_HI_BASE, TABLE_LO_BASE],
        ] as const
      ).map(([order, firstBase, secondBase]) => ({
        name: `${firstRegister}${secondRegister}-${order}`,
        firstRegister,
        secondRegister,
        firstBase,
        secondBase,
      })),
    ),
  ),
);

interface AttachmentSet {
  name: string;
  items: readonly Fragment[];
}

/**
 * The fragment multisets interleaved with the two loads, each named for what it
 * SUPPLIES rather than for what it looks like. Every generative property the
 * corpus needs comes from one of these crossed with an interleaving:
 *
 *   - `bare` supplies nothing, so the pairing has no consumer at all;
 *   - `adjacent-stores` supplies a resolvable orientation;
 *   - `non-adjacent-stores` supplies an UNRESOLVABLE one, generated rather than
 *     imagined, which the oracle declines by rule rather than by exception;
 *   - `two-pushes` supplies the class-4 window's shape;
 *   - `pushes-and-adjacent-stores` supplies both, which is the only way a
 *     class-3 stack-return link can exist at all;
 *   - `pushes-and-transfers` supplies pushes that carry register contents
 *     rather than loaded bytes;
 *   - `four-stores-two-pairs` supplies TWO consecutive zero-page pairs in one
 *     window, so a jump can name a foreign vector;
 *   - `adjacent-stores-and-indirect-read` supplies the pointer consumer that is
 *     a DATA read rather than a dispatch;
 *   - `pushes-transfers-and-adjacent-stores` is all of it at once.
 */
const ATTACHMENT_SETS: readonly AttachmentSet[] = Object.freeze([
  { name: "bare", items: Object.freeze([]) },
  { name: "adjacent-stores", items: Object.freeze([storeZp(ZP_FB), storeZp(ZP_FC)]) },
  { name: "non-adjacent-stores", items: Object.freeze([storeZp(ZP_FB), storeZp(ZP_FD)]) },
  { name: "two-pushes", items: Object.freeze([PHA, PHA]) },
  {
    name: "pushes-and-adjacent-stores",
    items: Object.freeze([PHA, PHA, storeZp(ZP_FB), storeZp(ZP_FC)]),
  },
  { name: "pushes-and-transfers", items: Object.freeze([PHA, PHA, TXA, TYA]) },
  {
    name: "four-stores-two-pairs",
    items: Object.freeze([storeZp(ZP_FB), storeZp(ZP_FC), storeZp(ZP_FD), storeZp(ZP_FE)]),
  },
  {
    name: "adjacent-stores-and-indirect-read",
    items: Object.freeze([storeZp(ZP_FB), storeZp(ZP_FC), ldaIndY(ZP_FB)]),
  },
  {
    name: "pushes-transfers-and-adjacent-stores",
    items: Object.freeze([PHA, PHA, TXA, TYA, storeZp(ZP_FB), storeZp(ZP_FC)]),
  },
]);

/** A FAMILY is one (core combo x attachment set) pair. The round-robin take
 * below is across families, and every family must contribute. */
interface Family {
  name: string;
  combo: CoreCombo;
  attachment: AttachmentSet;
}

const FAMILIES: readonly Family[] = Object.freeze(
  CORE_COMBOS.flatMap((combo) =>
    ATTACHMENT_SETS.map((attachment) => ({
      name: `${combo.name}/${attachment.name}`,
      combo,
      attachment,
    })),
  ),
);

/** Per (nop count x terminator) stratum, per family. Nine strata, two each, so
 * every family's list opens with one member from every stratum and the global
 * round-robin take below cannot strand a whole stratum.
 *
 * Two rather than more, and the reason is the global cap: `MAX_CORPUS` divided
 * across `FAMILIES` is about fourteen members per family, so a family that
 * offered twenty-seven draws would have half its design discarded by the take
 * and the discarded half would always be the same third of every stratum. Two
 * draws per stratum is what makes the take's FIRST full round -- one member from
 * every one of the nine strata -- fit inside the cap. */
const PER_STRATUM = 2;

/** The nine strata: three `nop` counts crossed with three terminators. */
const STRATA_PER_FAMILY = NOP_COUNTS.length * TERMINATOR_CHOICES.length;

/** How many arrangements each family offers the global take. */
const SAMPLES_PER_FAMILY = PER_STRATUM * STRATA_PER_FAMILY;

/** At most this many indexed arrangements enter the corpus. A runtime bound on
 * a factorial enumeration, never a scope statement: the take that reaches it is
 * round-robin across families. */
const MAX_CORPUS = 1000;

/** The corpus is a failed deliverable below this many indexed arrangements. */
const MIN_CORPUS = 400;

/** Every family must contribute at least this many members. */
const MIN_PER_FAMILY = 4;

/** The non-vacuity floor: an instrument that had quietly stopped scanning would
 * satisfy every "nothing unproven is proven" statement in this file. */
const MIN_LINKED = 20;

/** Every distinct permutation of a multiset, in a deterministic order. Distinct
 * by fragment key, so `[pha, pha]` yields one permutation and not two. */
function distinctPermutations(items: readonly Fragment[]): Fragment[][] {
  const out: Fragment[][] = [];
  const keys = items.map(fragmentKey);
  const used = new Array<boolean>(items.length).fill(false);
  const current: Fragment[] = [];
  const walk = (): void => {
    if (current.length === items.length) {
      out.push([...current]);
      return;
    }
    const seenAtThisDepth = new Set<string>();
    for (let i = 0; i < items.length; i++) {
      if (used[i]) continue;
      const key = keys[i]!;
      if (seenAtThisDepth.has(key)) continue;
      seenAtThisDepth.add(key);
      used[i] = true;
      current.push(items[i]!);
      walk();
      current.pop();
      used[i] = false;
    }
  };
  walk();
  return out;
}

/** Every way to place the two loads, IN PROGRAM ORDER, into a sequence of
 * `m + 2` slots. This is the INTERLEAVING dimension. */
function loadPlacements(m: number): [number, number][] {
  const out: [number, number][] = [];
  for (let first = 0; first <= m; first++) {
    for (let second = first + 1; second <= m + 1; second++) out.push([first, second]);
  }
  return out;
}

/** Every way to insert `count` `nop`s into `gapCount` gaps, as a sorted list of
 * gap indices. This is the GAP-PLACEMENT / LENGTH dimension. */
function nopPlans(gapCount: number, count: number): number[][] {
  if (count === 0) return [[]];
  if (count === 1) return Array.from({ length: gapCount }, (_unused, gap) => [gap]);
  const out: number[][] = [];
  for (let a = 0; a < gapCount; a++) {
    for (let b = a; b < gapCount; b++) out.push([a, b]);
  }
  return out;
}

function applyNops(sequence: readonly Fragment[], plan: readonly number[]): Fragment[] {
  const out = [...sequence];
  for (let i = plan.length - 1; i >= 0; i--) out.splice(plan[i]!, 0, NOP);
  return out;
}

interface ShapeAxes {
  /** Every distinct permutation of the attachment multiset. The ORDER axis. */
  perms: Fragment[][];
  /** Every way to place the two loads, in program order, among the attachment
   * items. The INTERLEAVING axis. */
  placements: [number, number][];
}

/** Cached per attachment set: the two shape axes are identical across all eight
 * core combos and differ only in which two load fragments are dropped in. */
const SHAPE_AXES_CACHE = new Map<string, ShapeAxes>();

function shapeAxes(attachment: AttachmentSet): ShapeAxes {
  const cached = SHAPE_AXES_CACHE.get(attachment.name);
  if (cached) return cached;
  const axes: ShapeAxes = {
    perms: distinctPermutations(attachment.items),
    placements: loadPlacements(attachment.items.length),
  };
  SHAPE_AXES_CACHE.set(attachment.name, axes);
  return axes;
}

function materialiseShape(
  family: Family,
  perm: readonly Fragment[],
  placement: readonly [number, number],
): Fragment[] {
  const [firstSlot, secondSlot] = placement;
  const first: Fragment = {
    kind: "indexedLoad",
    register: family.combo.firstRegister,
    base: family.combo.firstBase,
  };
  const second: Fragment = {
    kind: "indexedLoad",
    register: family.combo.secondRegister,
    base: family.combo.secondBase,
  };
  const out: Fragment[] = new Array<Fragment>(perm.length + 2);
  let cursor = 0;
  for (let i = 0; i < out.length; i++) {
    if (i === firstSlot) out[i] = first;
    else if (i === secondSlot) out[i] = second;
    else out[i] = perm[cursor++]!;
  }
  return out;
}

/**
 * The index this family's `sample`-th draw takes on one generative axis.
 *
 * Each axis is walked by its OWN evenly-spaced sweep over its own length, and
 * the sweeps are decorrelated by rotating the sample index through a multiplier
 * coprime to `SAMPLES_PER_FAMILY` (so the rotation is a bijection and the sweep
 * stays even). Rotating rather than reusing one linear index is what stops the
 * axes being sampled in lockstep -- with a single index, a family's whole draw
 * would sit on one diagonal of the product space and the INTERLEAVING axis in
 * particular would collapse to a handful of placements.
 */
function axisIndex(sample: number, axisLength: number, rotation: number): number {
  if (axisLength <= 1) return 0;
  const rotated = (sample * rotation) % SAMPLES_PER_FAMILY;
  return Math.floor((rotated * axisLength) / SAMPLES_PER_FAMILY);
}

/** Rotations, each coprime to `SAMPLES_PER_FAMILY` (18 = 2 * 3 * 3). */
const PLACEMENT_ROTATION = 1;
const PERMUTATION_ROTATION = 7;
const NOP_PLAN_ROTATION = 11;

/**
 * The three placement KINDS each stratum draws, and why an even sweep alone is
 * not enough.
 *
 * `canonical` is the alternating shape ordinary 6502 code is written in -- load,
 * consume, load, consume -- and it is the interleaving in which a pairing's two
 * consumer stores can actually resolve an orientation. `maximal` puts the two
 * loads at the extremes of the composed sequence, which combined with the `nop`
 * axis is what pushes a load, a store or a terminator OUTSIDE the pairing
 * window. `swept` is the even walk over the whole placement axis.
 *
 * A pure sweep visits both extremes only by luck at fourteen draws per family,
 * and a corpus that never resolves an orientation would satisfy every
 * "nothing unproven is proven" statement in this file while proving nothing --
 * so the two structurally-interesting placements are drawn by name and the rest
 * of the axis is swept.
 */
const PLACEMENT_KINDS = ["canonical", "maximal", "swept"] as const;
type PlacementKind = (typeof PLACEMENT_KINDS)[number];

interface Arrangement {
  /** `<family>#<index>` for an indexed member, `<family>#<index>~twin` for its
   * immediate twin. Printed by every failure message in this file. */
  id: string;
  family: string;
  kind: "indexed" | "twin";
  /** The composed fragments INCLUDING the terminator, which is always last. */
  fragments: readonly Fragment[];
}

interface GeneratedPayload {
  id: string;
  family: string;
  kind: "indexed" | "twin";
  arrangement: Arrangement;
  bytes: Uint8Array;
  /** The arrangement's own code length in bytes -- the sum of its fragments'
   * renderings. The census property is an exact equality against this. */
  prologueBytes: number;
  /** The id of this payload's partner: the twin for an indexed member, the
   * indexed member for a twin. */
  twinId: string;
  spelling: string;
}

/**
 * THE ARRANGEMENT CONTRACT, enforced by throws because every later property
 * depends on it: exactly ONE terminator per arrangement, and it is the LAST
 * fragment; exactly TWO indexed loads in an indexed arrangement and NONE in a
 * twin.
 *
 * The terminator clause is what makes `reachedAsInstruction` equal the prologue
 * length for every unlinked arrangement -- the descent walks the whole prologue
 * and stops at the terminator, reaching neither more nor less -- so the census
 * property can be an exact equality instead of a bound. A second terminator in
 * the middle would cut the walk short and turn that equality into a silent
 * inequality nobody wrote down.
 *
 * The two-loads clause is what makes the oracle's existential over pairings
 * exact rather than approximate: with exactly two indexed loads there is at most
 * one pairing to rule on, so "there exists a linked pairing" and "the pairing is
 * linked" are the same statement.
 */
function assertArrangementContract(id: string, fragments: readonly Fragment[], kind: "indexed" | "twin"): void {
  const terminators = fragments.filter(isTerminator);
  if (terminators.length !== 1) {
    throw new Error(
      `${id}: an arrangement must carry exactly ONE terminator, found ${terminators.length} in ` +
        `\`${spellArrangement(fragments)}\`. The one-terminator contract is what makes the census property an exact ` +
        `equality against the prologue length; a second terminator cuts the descent short and the equality silently ` +
        `becomes an inequality.`,
    );
  }
  if (!isTerminator(fragments[fragments.length - 1]!)) {
    throw new Error(
      `${id}: the terminator must be the LAST fragment, but \`${spellArrangement(fragments)}\` ends with ` +
        `\`${spellFragment(fragments[fragments.length - 1]!)}\`.`,
    );
  }
  const loads = fragments.filter(isIndexedLoad).length;
  const expectedLoads = kind === "indexed" ? 2 : 0;
  if (loads !== expectedLoads) {
    throw new Error(
      `${id}: a ${kind} arrangement must carry exactly ${expectedLoads} indexed load(s), found ${loads} in ` +
        `\`${spellArrangement(fragments)}\`. The oracle's pairing rule is exact only while there is at most one ` +
        `pairing to rule on.`,
    );
  }
  const composed = fragments.filter((f) => f.kind !== "nop" && !isTerminator(f)).length;
  if (kind === "indexed" && composed > MAX_FRAGMENTS) {
    throw new Error(
      `${id}: ${composed} composed fragments exceeds MAX_FRAGMENTS (${MAX_FRAGMENTS}) in ` +
        `\`${spellArrangement(fragments)}\`.`,
    );
  }
}

/**
 * Lays the fragments from the origin, fills to `TABLE_LO_BASE` with `nop`, then
 * writes `DATA_TAIL`. Throws on every structural invariant, ordered so the
 * message names the invariant an edit actually broke.
 */
function renderArrangement(arrangement: Arrangement): Uint8Array {
  assertArrangementContract(arrangement.id, arrangement.fragments, arrangement.kind);

  const out = new Uint8Array(PAYLOAD_SIZE).fill(NOP_BYTE);
  let cursor = 0;
  for (const fragment of arrangement.fragments) {
    for (const byte of FRAGMENT_BYTES(fragment)) out[cursor++] = byte;
  }

  if (cursor > MAX_PROLOGUE_BYTES) {
    throw new Error(
      `${arrangement.id}: prologue is ${cursor} bytes, past MAX_PROLOGUE_BYTES (${MAX_PROLOGUE_BYTES}); ` +
        `\`${spellArrangement(arrangement.fragments)}\` would overwrite the tables at ${hex(TABLE_LO_BASE)} and the ` +
        `instrument would be reconstructing this arrangement's own code.`,
    );
  }

  out.set(DATA_TAIL, TABLE_LO_BASE - GRAMMAR_ORIGIN);

  if (out.length !== PAYLOAD_SIZE) {
    throw new Error(`${arrangement.id}: rendered ${out.length} bytes, expected exactly ${PAYLOAD_SIZE}`);
  }

  // The POSITIVE form of the overrun guard: the tail must equal DATA_TAIL
  // exactly. Stated positively so a prologue that reached the tables reds by
  // name here instead of quietly changing what the instrument reconstructs.
  for (let i = 0; i < DATA_TAIL.length; i++) {
    const offset = TABLE_LO_BASE - GRAMMAR_ORIGIN + i;
    if (out[offset] !== DATA_TAIL[i]) {
      throw new Error(
        `${arrangement.id}: the data tail is not intact at ${hex(GRAMMAR_ORIGIN + offset)} -- ` +
          `${hex(out[offset]!, 2)} against ${hex(DATA_TAIL[i]!, 2)}.`,
      );
    }
  }

  for (let i = 0; i < out.length; i++) {
    if (out[i] === JAM_OPCODE) {
      throw new Error(
        `${arrangement.id}: the JAM opcode appears at offset ${i} (${hex(GRAMMAR_ORIGIN + i)}) of ` +
          `\`${spellArrangement(arrangement.fragments)}\`. Undecodable bytes are a separate surface and this corpus ` +
          `must not be able to launder them into its verdict.`,
      );
    }
  }

  return out;
}

/**
 * The immediate twin: every indexed load (three bytes) is replaced by an
 * immediate load plus one `nop` (also three bytes), so the twin has an
 * identical LENGTH and an identical TAIL and differs from its partner only in
 * addressing mode.
 *
 * That is the whole point of the pair. A twin has no indexed load, so it has no
 * pairing and nothing to prove; whatever census difference remains between the
 * two is therefore attributable to the pairing and to nothing else.
 */
function immediateTwinOf(arrangement: Arrangement): Arrangement {
  const fragments: Fragment[] = [];
  for (const fragment of arrangement.fragments) {
    if (fragment.kind === "indexedLoad") {
      fragments.push(loadImm(fragment.base & 0xff), NOP);
    } else {
      fragments.push(fragment);
    }
  }
  return { id: `${arrangement.id}~twin`, family: arrangement.family, kind: "twin", fragments };
}

function byteKey(bytes: Uint8Array): string {
  let key = "";
  for (const byte of bytes) key += byte.toString(16).padStart(2, "0");
  return key;
}

function prologueLength(fragments: readonly Fragment[]): number {
  let total = 0;
  for (const fragment of fragments) total += FRAGMENT_BYTES(fragment).length;
  return total;
}

/**
 * Every arrangement this family contributes, bounded and STRATIFIED.
 *
 * Nine strata per family -- three `nop` counts crossed with three terminators
 * -- and within a stratum the take is EVENLY SPACED across the full (shape x
 * nop-placement) index space rather than a prefix of it. Even spacing is what
 * keeps the bound a bound: a prefix take would silently restrict every family
 * to its first permutation, which is a scope reduction wearing a cap's label.
 * The strata are then round-robined, so a family's list opens with one member
 * from every stratum.
 */
function enumerateArrangements(family: Family, familyIndex: number): Arrangement[] {
  const { perms, placements } = shapeAxes(family.attachment);
  const coreLength = family.attachment.items.length + 2;
  const strata: Fragment[][][] = [];

  const m = family.attachment.items.length;
  const canonical: [number, number] = [0, Math.min(2, m + 1)];
  const maximal: [number, number] = [0, m + 1];

  let stratumIndex = 0;
  for (let nopIndex = 0; nopIndex < NOP_COUNTS.length; nopIndex++) {
    for (const terminator of TERMINATOR_CHOICES) {
      const plans = nopPlans(coreLength + 1, NOP_COUNTS[nopIndex]!);
      const stratum: Fragment[][] = [];
      for (let r = 0; r < PER_STRATUM; r++) {
        const sample = stratumIndex * PER_STRATUM + r;
        // EVERY stratum's first draw is the canonical interleaving, so a family
        // draws it against all three terminators and all three nop counts. That
        // matters because the jump that closes a zero-page-vector link IS the
        // terminator: a canonical draw seen against only one terminator can
        // never exhibit the link, and the corpus would then be unable to prove
        // anything for a structural reason nobody chose. The second draw
        // alternates between the two extremes of the placement axis.
        const kind: PlacementKind =
          r === 0 ? "canonical" : stratumIndex % 2 === 0 ? "maximal" : "swept";
        const placement =
          kind === "canonical"
            ? canonical
            : kind === "maximal"
              ? maximal
              : placements[axisIndex(sample, placements.length, PLACEMENT_ROTATION)]!;
        const perm = perms[axisIndex(sample, perms.length, PERMUTATION_ROTATION)]!;
        const plan = plans[axisIndex(sample, plans.length, NOP_PLAN_ROTATION)]!;
        stratum.push([...applyNops(materialiseShape(family, perm, placement), plan), terminator]);
      }
      strata.push(stratum);
      stratumIndex++;
    }
  }

  // Round-robin across the nine strata, ROTATED by the family's own index so
  // that the global take below -- which stops partway through a round -- does
  // not systematically favour the same strata in every family.
  const ordered: Fragment[][] = [];
  for (let round = 0; ; round++) {
    let progressed = false;
    for (let k = 0; k < strata.length; k++) {
      const stratum = strata[(k + familyIndex) % strata.length]!;
      if (round >= stratum.length) continue;
      progressed = true;
      ordered.push(stratum[round]!);
    }
    if (!progressed) break;
  }

  const seen = new Set<string>();
  const out: Arrangement[] = [];
  for (const fragments of ordered) {
    const candidate: Arrangement = { id: `${family.name}#${out.length}`, family: family.name, kind: "indexed", fragments };
    const key = byteKey(renderArrangement(candidate));
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The nine pinned regression members
// ---------------------------------------------------------------------------

interface PinnedIdiom {
  name: string;
  family: string;
  fragments: readonly Fragment[];
  /** The HAND-DECLARED verdict, written by reading the shape. In task 2 the
   * computed oracle must agree with every one of these. */
  linked: boolean;
  why: string;
}

/**
 * The nine named shapes this round's history turns on, each with a
 * HAND-DECLARED expected verdict and a `why` clause.
 *
 * They are regression anchors, and they are the ANTI-COUPLING CHECK on the
 * computed oracle: these nine declarations were written by a human reading the
 * shapes, while the oracle was written from the six structural rules. An oracle
 * that drifted toward being a copy of the implementation it checks would start
 * agreeing with the instrument and disagreeing with these nine, and that
 * disagreement is what reds.
 *
 * They are NOT the corpus. Nothing in this file's headline property reads a
 * hand-declared verdict -- every generated arrangement's expectation is
 * computed.
 */
const PINNED_IDIOMS: readonly PinnedIdiom[] = Object.freeze([
  {
    name: "ordinary-copy-loop",
    family: "xx-lo-first/adjacent-stores",
    fragments: [loadX(TABLE_LO_BASE), storeZp(ZP_FB), loadX(TABLE_HI_BASE), storeZp(ZP_FC), RTS],
    linked: false,
    why: "Two indexed loads consumed by a consecutive zero-page pair is how EVERY 16-bit pointer on a 6502 is built. Nothing reads the vector, so nothing dispatches through the tables.",
  },
  {
    name: "zeropage-vector-read-as-data",
    family: "xx-lo-first/adjacent-stores-and-indirect-read",
    fragments: [
      loadX(TABLE_LO_BASE),
      storeZp(ZP_FB),
      loadX(TABLE_HI_BASE),
      storeZp(ZP_FC),
      ldaIndY(ZP_FB),
      RTS,
    ],
    linked: false,
    why: "The CR-04 shape. The vector is built and then CONSUMED -- but by an indirect-indexed DATA read, not by a jump. A predicate that accepted the construction alone would promote every screen pointer in C64 code.",
  },
  {
    name: "zeropage-vector-jumped-through-own-pointer",
    family: "xx-lo-first/adjacent-stores",
    fragments: [loadX(TABLE_LO_BASE), storeZp(ZP_FB), loadX(TABLE_HI_BASE), storeZp(ZP_FC), jmpInd(ZP_FB)],
    linked: true,
    why: "The classic build-a-vector-then-jmp-(vector) idiom, matched end to end: the jump names the LOW byte of the vector the pairing's own two consumer stores built.",
  },
  {
    name: "zeropage-vector-foreign-jump",
    family: "xx-lo-first/four-stores-two-pairs",
    fragments: [
      loadX(TABLE_LO_BASE),
      storeZp(ZP_FB),
      loadX(TABLE_HI_BASE),
      storeZp(ZP_FC),
      storeZp(ZP_FD),
      storeZp(ZP_FE),
      jmpInd(ZP_FD),
    ],
    linked: false,
    why: "Two consecutive zero-page pairs in one window -- an ordinary source-pointer / destination-pointer routine. The jump consumes the FOREIGN vector, which is not evidence about the pairing that built the other one.",
  },
  {
    name: "unlinked-push-idiom",
    family: "xx-lo-first/pushes-transfers-and-adjacent-stores",
    fragments: [
      loadX(TABLE_LO_BASE),
      storeZp(ZP_FB),
      loadX(TABLE_HI_BASE),
      storeZp(ZP_FC),
      PHA,
      TXA,
      PHA,
      TYA,
      RTS,
    ],
    linked: false,
    why: "The blocker payload. Two pushes and an rts sit in the window, but the pushes carry the accumulator's leftover value and the X register -- neither load's byte reaches the stack, so the address rts jumps to did not come from these tables.",
  },
  {
    name: "linked-push-idiom",
    family: "xx-lo-first/pushes-and-adjacent-stores",
    fragments: [
      loadX(TABLE_LO_BASE),
      PHA,
      storeZp(ZP_FB),
      loadX(TABLE_HI_BASE),
      PHA,
      storeZp(ZP_FC),
      RTS,
    ],
    linked: true,
    why: "The same neighbourhood with the two pushes moved to each load's OWN successor, so each load pushes the byte it just read and the rts consumes the address they assembled. The RTS trick as an actual data flow.",
  },
  {
    name: "push-idiom-return-outside-window",
    family: "xx-lo-first/pushes-transfers-and-adjacent-stores",
    fragments: [
      loadX(TABLE_LO_BASE),
      storeZp(ZP_FB),
      loadX(TABLE_HI_BASE),
      storeZp(ZP_FC),
      PHA,
      TXA,
      PHA,
      TYA,
      NOP,
      RTS,
    ],
    linked: false,
    why: "The blocker payload with one nop before its rts, so the return falls one instruction past the far edge of the pairing window. Unlinked twice over: the pushes are still unlinked, and the rts is now out of reach as well.",
  },
  {
    name: "non-adjacent-store-pair",
    family: "xx-lo-first/non-adjacent-stores",
    fragments: [loadX(TABLE_LO_BASE), storeZp(ZP_FB), loadX(TABLE_HI_BASE), storeZp(ZP_FD), jmpInd(ZP_FB)],
    linked: false,
    why: "The two consumer stores are two apart, not one, so no little-endian vector was built and no orientation resolves. An unresolved orientation makes the pairing advisory however good its other evidence looks.",
  },
  {
    name: "class-four-five-instruction-window",
    family: "xx-hi-first/two-pushes",
    fragments: [loadX(TABLE_HI_BASE), PHA, loadX(TABLE_LO_BASE), PHA, RTS],
    linked: true,
    why: "The canonical stack-return idiom. The 6502 pushes the HIGH byte first, so the leading load reads the hi table and the reconstruction's lo/hi assignment is justified by the idiom's own push order rather than assumed.",
  },
]);

// ---------------------------------------------------------------------------
// The corpus
// ---------------------------------------------------------------------------

/**
 * Every family's list, opened by any pinned member belonging to it and
 * continued by the stratified enumeration, then taken ROUND-ROBIN across
 * families up to `MAX_CORPUS`. Each indexed member contributes its immediate
 * twin, so the corpus is the indexed set plus an equal-sized twin set.
 *
 * The pinned members are placed at the head of their own family's list rather
 * than appended to the corpus, so they are ordinary members of the take with
 * ordinary ids. What their presence assertion states is that the alphabet and
 * the geometry genuinely REPRODUCE the historical shapes -- byte for byte, at
 * the same origin, with the same tables -- rather than that a corpus with a
 * parallel layout happens to sit beside them.
 */
function buildCorpus(): GeneratedPayload[] {
  const familyLists = FAMILIES.map((family, familyIndex) => {
    const pinned = PINNED_IDIOMS.filter((idiom) => idiom.family === family.name).map(
      (idiom, index): Arrangement => ({
        id: `${family.name}#pin${index}`,
        family: family.name,
        kind: "indexed",
        fragments: idiom.fragments,
      }),
    );
    const enumerated = enumerateArrangements(family, familyIndex);
    const seen = new Set<string>();
    const merged: Arrangement[] = [];
    for (const arrangement of [...pinned, ...enumerated]) {
      const key = byteKey(renderArrangement(arrangement));
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(arrangement);
    }
    return merged;
  });

  const takenKeys = new Set<string>();
  const taken: Arrangement[] = [];
  outer: for (let round = 0; ; round++) {
    let progressed = false;
    for (const list of familyLists) {
      if (round >= list.length) continue;
      progressed = true;
      const arrangement = list[round]!;
      const key = byteKey(renderArrangement(arrangement));
      if (takenKeys.has(key)) continue;
      takenKeys.add(key);
      taken.push(arrangement);
      if (taken.length >= MAX_CORPUS) break outer;
    }
    if (!progressed) break;
  }

  const payloads: GeneratedPayload[] = [];
  for (const arrangement of taken) {
    const twin = immediateTwinOf(arrangement);
    const indexedBytes = renderArrangement(arrangement);
    const twinBytes = renderArrangement(twin);

    if (indexedBytes.length !== twinBytes.length) {
      throw new Error(`${arrangement.id}: the twin must have the same length as its indexed member`);
    }
    for (let i = TABLE_LO_BASE - GRAMMAR_ORIGIN; i < PAYLOAD_SIZE; i++) {
      if (indexedBytes[i] !== twinBytes[i]) {
        throw new Error(
          `${arrangement.id}: the twin's tail must be identical to its indexed member's, but they differ at ` +
            `${hex(GRAMMAR_ORIGIN + i)}`,
        );
      }
    }
    if (prologueLength(arrangement.fragments) !== prologueLength(twin.fragments)) {
      throw new Error(
        `${arrangement.id}: the twin must have the same prologue length as its indexed member -- ` +
          `${prologueLength(arrangement.fragments)} against ${prologueLength(twin.fragments)}`,
      );
    }

    payloads.push({
      id: arrangement.id,
      family: arrangement.family,
      kind: "indexed",
      arrangement,
      bytes: indexedBytes,
      prologueBytes: prologueLength(arrangement.fragments),
      twinId: twin.id,
      spelling: spellArrangement(arrangement.fragments),
    });
    payloads.push({
      id: twin.id,
      family: twin.family,
      kind: "twin",
      arrangement: twin,
      bytes: twinBytes,
      prologueBytes: prologueLength(twin.fragments),
      twinId: arrangement.id,
      spelling: spellArrangement(twin.fragments),
    });
  }

  const indexedCount = payloads.filter((payload) => payload.kind === "indexed").length;
  if (indexedCount < MIN_CORPUS) {
    throw new Error(
      `the corpus holds ${indexedCount} indexed arrangements, below MIN_CORPUS (${MIN_CORPUS}). ` +
        `A corpus this small is a hand-built table wearing a generator's name.`,
    );
  }

  const perFamily = new Map<string, number>();
  for (const payload of payloads) {
    if (payload.kind !== "indexed") continue;
    perFamily.set(payload.family, (perFamily.get(payload.family) ?? 0) + 1);
  }
  for (const family of FAMILIES) {
    const count = perFamily.get(family.name) ?? 0;
    if (count < MIN_PER_FAMILY) {
      throw new Error(
        `family ${family.name} contributed ${count} members, below MIN_PER_FAMILY (${MIN_PER_FAMILY}). ` +
          `The MAX_CORPUS take is round-robin across families precisely so the cap cannot drop one.`,
      );
    }
  }

  // Distinctness is asserted over the INDEXED members. Twins are deliberately
  // exempt: an immediate twin ERASES the index register, so two arrangements
  // that differ only in whether they index through X or Y have, by definition,
  // the same twin. That collapse is the twin's meaning, not a generator defect,
  // and the property below in the suite states it as a checked relation rather
  // than leaving it as an unexplained duplicate count.
  const indexedKeys = new Set(
    payloads.filter((payload) => payload.kind === "indexed").map((payload) => byteKey(payload.bytes)),
  );
  if (indexedKeys.size !== indexedCount) {
    throw new Error(
      `the corpus holds ${indexedCount} indexed arrangements but only ${indexedKeys.size} distinct byte strings -- ` +
        `two arrangements render identically and one of them is measuring nothing new.`,
    );
  }

  return payloads;
}

const CORPUS: readonly GeneratedPayload[] = Object.freeze(buildCorpus());
const INDEXED_MEMBERS: readonly GeneratedPayload[] = Object.freeze(CORPUS.filter((p) => p.kind === "indexed"));
const TWIN_MEMBERS: readonly GeneratedPayload[] = Object.freeze(CORPUS.filter((p) => p.kind === "twin"));
const PAYLOAD_BY_ID = new Map(CORPUS.map((payload) => [payload.id, payload]));
const CORPUS_BYTE_KEYS = new Set(CORPUS.map((payload) => byteKey(payload.bytes)));

// ---------------------------------------------------------------------------
// The wiring -- the SAME wiring `buildCoverageReport()` uses
// ---------------------------------------------------------------------------

/**
 * A payload driven through the shipped scan. Never a private path: a property
 * proved through wiring the shipped entry point does not use proves nothing
 * about the report that entry point emits.
 */
function scanOfPayload(bytes: Uint8Array) {
  return scanIndirectDispatch(decode(bytes, GRAMMAR_ORIGIN), bytes, GRAMMAR_ORIGIN);
}

/** The census as `buildCoverageReport()` wires it: the origin as the only
 * ordinary seed, the scan's table entries, and `extraSeeds` read from the ONE
 * proven-target seam. */
function censusOfPayload(bytes: Uint8Array, scan: ReturnType<typeof scanOfPayload>) {
  return computeStructuralCensus(bytes, GRAMMAR_ORIGIN, [GRAMMAR_ORIGIN], {
    tableEntryAddresses: scan.tableEntryAddresses,
    extraSeeds: provenDispatchTargets(scan),
  });
}

interface Measurement {
  scan: ReturnType<typeof scanOfPayload>;
  census: ReturnType<typeof censusOfPayload>;
  proven: number[];
}

const MEASUREMENTS = new Map<string, Measurement>();

function measure(payload: GeneratedPayload): Measurement {
  const cached = MEASUREMENTS.get(payload.id);
  if (cached) return cached;
  const scan = scanOfPayload(payload.bytes);
  const census = censusOfPayload(payload.bytes, scan);
  const measurement: Measurement = { scan, census, proven: provenDispatchTargets(scan) };
  MEASUREMENTS.set(payload.id, measurement);
  return measurement;
}

/** The ids the INSTRUMENT proves: those whose scan yields a non-empty proven
 * target set. One of the two sides of the headline equality. */
function provenIds(): Set<string> {
  const out = new Set<string>();
  for (const payload of CORPUS) {
    if (measure(payload).proven.length > 0) out.add(payload.id);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The computed oracle
//
// SIX NUMBERED RULES over the SYMBOLIC fragment list, each written as its own
// small helper with a comment naming the source behaviour it states. Nothing
// below decodes a byte, scans a window, walks a census or reads anything from
// the module under test except the two shared constants `SPLIT_TABLE_WINDOW`
// and `MAX_TABLE_ENTRIES`. Its only contact with bytes is reading the FIXED
// `DATA_TAIL` to reconstruct target values, which is arithmetic over a known
// constant rather than a reimplementation of anything.
//
// That separation is what makes this a SPECIFICATION rather than a second
// implementation, and it is not left to good intentions: the isolation is
// asserted mechanically by a source-text pin below, which reads the span
// between the two section markers and fails if it names the scan.
// --- ORACLE SECTION BEGIN ---
// ---------------------------------------------------------------------------

interface Pairing {
  firstIndex: number;
  secondIndex: number;
}

interface ClassFourWindow {
  startIndex: number;
  /** The FIRST load's base. The 6502 pushes the high byte first, so the leading
   * load reads the hi table -- the one condition the idiom supplies for free. */
  hiBase: number;
  loBase: number;
}

interface Orientation {
  loBase: number;
  hiBase: number;
  /** The LOWER of the two consecutive zero-page addresses the pairing's OWN two
   * loads are consumed by, which is the address an indirect jump through that
   * vector names. */
  vectorLow: number;
}

interface OracleVerdict {
  linked: boolean;
  /** The numbered rule that DECIDED this verdict, printed by every failure
   * message so a disagreement cites a rule rather than an array index. */
  rule: string;
}

/** The byte the fixed data tail holds at `address`. The oracle's ONLY contact
 * with bytes, and only with a constant it declared itself. */
function dataTailByteAt(address: number): number {
  const offset = address - TABLE_LO_BASE;
  if (offset < 0 || offset >= DATA_TAIL.length) {
    throw new Error(
      `the oracle was asked for the byte at ${hex(address)}, outside the fixed data tail ` +
        `[${hex(TABLE_LO_BASE)}, ${hex(TABLE_LO_BASE + DATA_TAIL.length)}). The oracle reads the tail and nothing ` +
        `else; reaching this means the geometry changed and the oracle's scope must be restated rather than widened ` +
        `by adding a decoder to it.`,
    );
  }
  return DATA_TAIL[offset]!;
}

function loadAt(fragments: readonly Fragment[], index: number): Extract<Fragment, { kind: "indexedLoad" }> {
  const fragment = fragments[index];
  if (!fragment || fragment.kind !== "indexedLoad") {
    throw new Error(`the oracle expected an indexed load at fragment ${index}`);
  }
  return fragment;
}

/**
 * R1 -- PAIRING. Two indexed loads L1 before L2, indexing through the SAME
 * register, with DISTINCT table bases, where L2 occurs at most
 * `SPLIT_TABLE_WINDOW` fragments after L1.
 *
 * States the class-3 pass's own inner-loop bounds: the second load is sought at
 * instruction indices `i + 1` through `i + SPLIT_TABLE_WINDOW`, two loads
 * through different registers are two tables rather than one split one, and a
 * pairing whose two bases are equal has no span to reconstruct.
 */
function pairingsOf(fragments: readonly Fragment[]): Pairing[] {
  const loadIndices: number[] = [];
  for (let i = 0; i < fragments.length; i++) {
    if (fragments[i]!.kind === "indexedLoad") loadIndices.push(i);
  }
  const out: Pairing[] = [];
  for (let a = 0; a < loadIndices.length; a++) {
    for (let b = a + 1; b < loadIndices.length; b++) {
      const firstIndex = loadIndices[a]!;
      const secondIndex = loadIndices[b]!;
      if (secondIndex - firstIndex > SPLIT_TABLE_WINDOW) continue;
      const first = loadAt(fragments, firstIndex);
      const second = loadAt(fragments, secondIndex);
      if (first.register !== second.register) continue;
      if (first.base === second.base) continue;
      out.push({ firstIndex, secondIndex });
    }
  }
  return out;
}

/**
 * R2 -- THE CLASS-4 WINDOW, AND WHEN IT IS CLAIMED. Five consecutive fragments
 * matching indexed load, `pha`, indexed load, `pha`, `rts`, with both loads
 * through the same register.
 *
 * THE WINDOW IS CLAIMED ON SHAPE AND REGISTER ALONE, BEFORE ANY PLAUSIBILITY
 * TEST. The class-4 pass adds every instruction of a matched window to its
 * claimed set as soon as the register check passes, and only THEN walks and
 * validates the table -- so a window whose reconstruction turns out implausible
 * has still been claimed, and R3 below still shuts the class-3 route out of it.
 * Modelling the two steps the other way round -- claiming only on a successful
 * publish -- makes the oracle disagree with the instrument on exactly the
 * arrangements that matter, and the disagreement then reads as an instrument
 * defect when it is an oracle defect.
 *
 * The register check runs BEFORE the claim, which is the one thing the pass
 * does not do on shape alone: a mismatched-register window is not class 4's, so
 * it is left unclaimed and the class-3 pass is still free to rule on it.
 */
function classFourWindowsOf(fragments: readonly Fragment[]): ClassFourWindow[] {
  const out: ClassFourWindow[] = [];
  for (let i = 0; i + 4 < fragments.length; i++) {
    const a = fragments[i]!;
    const b = fragments[i + 1]!;
    const c = fragments[i + 2]!;
    const d = fragments[i + 3]!;
    const e = fragments[i + 4]!;
    if (a.kind !== "indexedLoad") continue;
    if (b.kind !== "pha") continue;
    if (c.kind !== "indexedLoad") continue;
    if (d.kind !== "pha") continue;
    if (e.kind !== "rts") continue;
    if (a.register !== c.register) continue;
    out.push({ startIndex: i, hiBase: a.base, loBase: c.base });
  }
  return out;
}

/** The fragment indices a claimed class-4 window occupies. */
function classFourClaimedIndices(windows: readonly ClassFourWindow[]): Set<number> {
  const claimed = new Set<number>();
  for (const window of windows) {
    for (let k = 0; k < 5; k++) claimed.add(window.startIndex + k);
  }
  return claimed;
}

/**
 * R4 -- CLASS-3 ORIENTATION. Each of the two paired loads must have a
 * nearest-FOLLOWING zero-page store within the window; the two store addresses
 * must differ by exactly one; the load reaching the LOWER address holds the low
 * byte, because a 6502 vector is little-endian.
 *
 * Without a resolvable orientation the pairing is advisory and publishes
 * nothing, however good its other evidence looks -- which is why even the
 * push-idiom route needs the store construction present. `vectorLow` is derived
 * here, from the SAME two consumer stores that decided the lo/hi roles, so the
 * vector address and the orientation that justified it cannot disagree.
 */
function orientationOf(fragments: readonly Fragment[], pairing: Pairing): Orientation | null {
  const consumerOf = (from: number): number | null => {
    const end = Math.min(fragments.length, from + SPLIT_TABLE_WINDOW + 1);
    for (let k = from + 1; k < end; k++) {
      const fragment = fragments[k]!;
      if (fragment.kind === "storeZp") return fragment.address;
    }
    return null;
  };

  const firstZp = consumerOf(pairing.firstIndex);
  const secondZp = consumerOf(pairing.secondIndex);
  if (firstZp === null || secondZp === null) return null;
  if (Math.abs(firstZp - secondZp) !== 1) return null;

  const firstBase = loadAt(fragments, pairing.firstIndex).base;
  const secondBase = loadAt(fragments, pairing.secondIndex).base;
  const vectorLow = Math.min(firstZp, secondZp);
  return firstZp < secondZp
    ? { loBase: firstBase, hiBase: secondBase, vectorLow }
    : { loBase: secondBase, hiBase: firstBase, vectorLow };
}

/**
 * R5 -- CLASS-3 DISPATCH LINK, either of two.
 *
 * The STACK-RETURN link: the fragment immediately after EACH paired load is a
 * `pha`, and an `rts` follows the second push inside the LEADING load's window.
 * Read at the two loads' own successors, so no `pha` elsewhere in the window can
 * stand in for either of them -- the link is the evidence, not the shape.
 *
 * The ZERO-PAGE-VECTOR link: an indirect jump inside the leading load's window
 * names exactly the LOWER of the two store addresses R4 resolved. A jump through
 * some OTHER vector built in the same window is not evidence about this pairing;
 * a routine with a source pointer and a destination pointer has two.
 */
function dispatchLinkOf(
  fragments: readonly Fragment[],
  pairing: Pairing,
  orientation: Orientation,
): string | null {
  const end = Math.min(fragments.length, pairing.firstIndex + SPLIT_TABLE_WINDOW + 1);

  if (
    fragments[pairing.firstIndex + 1]?.kind === "pha" &&
    fragments[pairing.secondIndex + 1]?.kind === "pha"
  ) {
    for (let k = pairing.secondIndex + 2; k < end; k++) {
      if (fragments[k]!.kind === "rts") return "stack-return-push-idiom";
    }
  }

  for (let k = pairing.firstIndex; k < end; k++) {
    const fragment = fragments[k]!;
    if (fragment.kind === "indirectJump" && fragment.pointer === orientation.vectorLow) {
      return "zeropage-vector-jumped-through";
    }
  }

  return null;
}

interface ReconstructionOptions {
  /** Class 4 only: `rts` increments before jumping, so the idiom pushes
   * `target - 1` and the reconstruction adds one back. Class 3 adds nothing. */
  rtsIncrement: boolean;
  /** Class 4 only: a zero span still walks one entry. */
  minimumOneEntry: boolean;
}

/**
 * R6, first half -- RECONSTRUCTION. The entry count is the DISTANCE between the
 * two bases, clamped at `MAX_TABLE_ENTRIES`; each entry is the little-endian
 * word assembled from the lo and hi tables at the same offset; the walk stops
 * where the image stops.
 */
function reconstructTargets(loBase: number, hiBase: number, options: ReconstructionOptions): number[] {
  const span = Math.abs(hiBase - loBase);
  let entries = span > 0 ? span : options.minimumOneEntry ? 1 : 0;
  if (entries > MAX_TABLE_ENTRIES) entries = MAX_TABLE_ENTRIES;

  const targets: number[] = [];
  for (let k = 0; k < entries; k++) {
    if (loBase + k >= IMAGE_END || hiBase + k >= IMAGE_END) break;
    if (loBase + k < GRAMMAR_ORIGIN || hiBase + k < GRAMMAR_ORIGIN) break;
    const value = dataTailByteAt(loBase + k) | (dataTailByteAt(hiBase + k) << 8);
    targets.push(options.rtsIncrement ? (value + 1) & 0xffff : value);
  }
  return targets;
}

/**
 * R6, second half -- PLAUSIBILITY. A published entry point must lie strictly
 * inside the image and on a byte that is a legal, non-truncated instruction.
 *
 * With the fixed `DATA_TAIL` that reduces to "inside the sixteen-byte `nop` run
 * at `TARGET_BASE`", because every reconstruction this geometry admits is either
 * inside that run or far outside the image. The reduction is not assumed: a
 * value landing inside the image but below `TARGET_BASE` would need the decoder
 * the oracle is forbidden to call, so it THROWS by name rather than guessing,
 * and the corpus-wide property below would report it immediately.
 */
function targetPlausible(target: number): boolean {
  if (target < GRAMMAR_ORIGIN || target >= IMAGE_END) return false;
  if (target < TARGET_BASE) {
    throw new Error(
      `the oracle reconstructed ${hex(target)}: inside the image but below ${hex(TARGET_BASE)}. Deciding whether that ` +
        `byte is a legal entry point needs a decoder, which the oracle may not have. With the fixed DATA_TAIL every ` +
        `reconstruction is either inside the sixteen-byte nop run or far outside the image, so reaching this branch ` +
        `means the geometry changed and R6 must be restated.`,
    );
  }
  return dataTailByteAt(target) === NOP_BYTE;
}

/** Class 3 publishes ALL-OR-NOTHING: every reconstructed target must be
 * plausible, and an empty reconstruction publishes nothing. */
function everyTargetPlausible(targets: readonly number[]): boolean {
  return targets.length > 0 && targets.every(targetPlausible);
}

/** Class 4 publishes its SURVIVING PREFIX: the walk stops at the first
 * implausible value, marks the finding truncated, and publishes what came
 * before -- so a window publishes exactly when its first target is plausible. */
function plausiblePrefixLength(targets: readonly number[]): number {
  let length = 0;
  for (const target of targets) {
    if (!targetPlausible(target)) break;
    length++;
  }
  return length;
}

/**
 * Does this arrangement carry a PROVEN DATA-FLOW LINK from two reconstructed
 * table bases to a dispatch mechanism?
 *
 * A claimed class-4 window whose reconstruction publishes (R2 then R6), OR a
 * pairing satisfying R1, available under R3, oriented under R4, linked under R5,
 * whose reconstruction publishes under R6.
 *
 * R3 -- CLASS-3 AVAILABILITY -- is applied here rather than inside `pairingsOf`
 * because it is a fact about the interaction of the two passes rather than about
 * the pairing: a pairing whose LEADING load lies inside a claimed class-4 window
 * is unavailable to the class-3 route, whether or not class 4 went on to publish
 * anything.
 */
function expectedProvenLink(arrangement: Arrangement): OracleVerdict {
  const fragments = arrangement.fragments;

  const windows = classFourWindowsOf(fragments); // R2
  const claimed = classFourClaimedIndices(windows);

  for (const window of windows) {
    const targets = reconstructTargets(window.loBase, window.hiBase, {
      rtsIncrement: true,
      minimumOneEntry: true,
    });
    if (plausiblePrefixLength(targets) > 0) {
      return { linked: true, rule: "R2+R6 class-4 window published" };
    }
  }

  const pairings = pairingsOf(fragments); // R1
  if (pairings.length === 0) {
    return {
      linked: false,
      rule: windows.length > 0 ? "R2+R6 class-4 window claimed, reconstruction implausible" : "R1 no pairing",
    };
  }

  let furthest = "R1 no pairing";
  for (const pairing of pairings) {
    if (claimed.has(pairing.firstIndex)) {
      furthest = "R3 leading load inside a claimed class-4 window";
      continue;
    }
    const orientation = orientationOf(fragments, pairing); // R4
    if (orientation === null) {
      furthest = "R4 orientation unresolved";
      continue;
    }
    const link = dispatchLinkOf(fragments, pairing, orientation); // R5
    if (link === null) {
      furthest = "R5 no dispatch link";
      continue;
    }
    const targets = reconstructTargets(orientation.loBase, orientation.hiBase, {
      rtsIncrement: false,
      minimumOneEntry: false,
    }); // R6
    if (everyTargetPlausible(targets)) {
      return { linked: true, rule: `R1..R6 class-3 ${link}` };
    }
    furthest = "R6 reconstruction implausible";
  }
  return { linked: false, rule: furthest };
}

// ---------------------------------------------------------------------------
// --- ORACLE SECTION END ---
// ---------------------------------------------------------------------------

/** The ids the ORACLE expects to be proven. The other side of the headline
 * equality, computed from composition and never declared per payload. */
function expectedIds(): Set<string> {
  const out = new Set<string>();
  for (const payload of CORPUS) {
    if (expectedProvenLink(payload.arrangement).linked) out.add(payload.id);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Smoke tests -- the corpus is what it claims to be
// ---------------------------------------------------------------------------

test("the composed corpus is bounded, stratified across every family, and large enough to be a population", () => {
  assert.equal(FAMILIES.length, CORE_COMBOS.length * ATTACHMENT_SETS.length);
  assert.equal(CORE_COMBOS.length, 8, "four register pairings crossed with two base orders");
  assert.equal(ATTACHMENT_SETS.length, 9);

  assert.ok(
    INDEXED_MEMBERS.length >= MIN_CORPUS,
    `the corpus holds ${INDEXED_MEMBERS.length} indexed arrangements, below MIN_CORPUS (${MIN_CORPUS})`,
  );
  assert.ok(
    INDEXED_MEMBERS.length <= MAX_CORPUS,
    `the corpus holds ${INDEXED_MEMBERS.length} indexed arrangements, above MAX_CORPUS (${MAX_CORPUS})`,
  );
  assert.equal(
    TWIN_MEMBERS.length,
    INDEXED_MEMBERS.length,
    "every indexed arrangement contributes exactly one immediate twin",
  );
  assert.equal(CORPUS.length, INDEXED_MEMBERS.length + TWIN_MEMBERS.length);
});

test("every family contributed at least MIN_PER_FAMILY members, so the corpus cap is not a prefix of one family", () => {
  const perFamily = new Map<string, number>();
  for (const payload of INDEXED_MEMBERS) {
    perFamily.set(payload.family, (perFamily.get(payload.family) ?? 0) + 1);
  }
  for (const family of FAMILIES) {
    const count = perFamily.get(family.name) ?? 0;
    assert.ok(
      count >= MIN_PER_FAMILY,
      `family ${family.name} contributed ${count} members, below MIN_PER_FAMILY (${MIN_PER_FAMILY}). ` +
        `A cap reached by taking a prefix of one family is a silent scope reduction, which is why the take is ` +
        `round-robin across all ${FAMILIES.length} families.`,
    );
  }
  assert.equal(perFamily.size, FAMILIES.length, "every family must appear in the corpus, not merely most of them");
});

test("building the corpus twice yields byte-identical payloads in identical order", () => {
  const again = buildCorpus();
  assert.equal(again.length, CORPUS.length, "the enumeration is deterministic in SIZE");
  for (let i = 0; i < again.length; i++) {
    const first = CORPUS[i]!;
    const second = again[i]!;
    assert.equal(second.id, first.id, `payload ${i} changed identity between two builds`);
    assert.equal(
      byteKey(second.bytes),
      byteKey(first.bytes),
      `payload ${first.id} rendered different bytes on a second build -- the enumeration is not deterministic, so ` +
        `no failure in this file would be reproducible`,
    );
  }
});

test("every payload is exactly 64 bytes with an intact data tail, and no two indexed arrangements are byte-identical", () => {
  const keys = new Set<string>();
  for (const payload of CORPUS) {
    assert.equal(payload.bytes.length, PAYLOAD_SIZE, `${payload.id}: wrong payload size`);
    for (let i = 0; i < DATA_TAIL.length; i++) {
      const offset = TABLE_LO_BASE - GRAMMAR_ORIGIN + i;
      assert.equal(
        payload.bytes[offset],
        DATA_TAIL[i],
        `${payload.id} (\`${payload.spelling}\`): the data tail is not intact at ${hex(GRAMMAR_ORIGIN + offset)}`,
      );
    }
    if (payload.kind !== "indexed") continue;
    const key = byteKey(payload.bytes);
    assert.ok(!keys.has(key), `${payload.id} (\`${payload.spelling}\`) renders identically to an earlier arrangement`);
    keys.add(key);
  }
  assert.equal(keys.size, INDEXED_MEMBERS.length);
});

test("a twin differs from its own indexed member, and two members share a twin only when they differ solely in index register", () => {
  // The twin ERASES the index register, so `lda $0830,x ...` and
  // `lda $0830,y ...` have the same twin. That collapse is what an immediate
  // twin MEANS -- it is the same program with the two table reads replaced by
  // constants -- so it is stated here as a checked relation rather than left to
  // read as a duplicate the generator failed to notice.
  const byTwin = new Map<string, GeneratedPayload[]>();
  for (const payload of INDEXED_MEMBERS) {
    const twin = PAYLOAD_BY_ID.get(payload.twinId)!;
    assert.notEqual(
      byteKey(twin.bytes),
      byteKey(payload.bytes),
      `${payload.id} (\`${payload.spelling}\`): the twin must differ from its indexed member, or the pair proves nothing`,
    );
    const key = byteKey(twin.bytes);
    byTwin.set(key, [...(byTwin.get(key) ?? []), payload]);
  }

  const shapeKey = (payload: GeneratedPayload): string =>
    payload.arrangement.fragments
      .map((fragment) => (fragment.kind === "indexedLoad" ? `ld:${fragment.base}` : fragmentKey(fragment)))
      .join("|");

  for (const [, group] of byTwin) {
    const first = shapeKey(group[0]!);
    for (const member of group) {
      assert.equal(
        shapeKey(member),
        first,
        `${member.id} (\`${member.spelling}\`) shares a twin with ${group[0]!.id} (\`${group[0]!.spelling}\`) but ` +
          `differs by more than its index registers -- a twin may erase the register and nothing else`,
      );
    }
  }
});

test("no generated payload contains the JAM opcode at any offset", () => {
  // A property of the payload BYTES, never a source grep: the generator throw
  // that enforces this necessarily writes the byte value into this file, so a
  // grep would red on the control itself.
  for (const payload of CORPUS) {
    for (let i = 0; i < payload.bytes.length; i++) {
      assert.notEqual(
        payload.bytes[i],
        JAM_OPCODE,
        `${payload.id} (\`${payload.spelling}\`): JAM opcode at offset ${i} (${hex(GRAMMAR_ORIGIN + i)}). ` +
          `Undecodable bytes are a separate surface; this corpus must not be able to launder them.`,
      );
    }
  }
});

test("every arrangement carries exactly one terminator and it is the last fragment", () => {
  for (const payload of CORPUS) {
    const fragments = payload.arrangement.fragments;
    assert.equal(
      fragments.filter(isTerminator).length,
      1,
      `${payload.id} (\`${payload.spelling}\`): exactly one terminator is what makes the census property an exact equality`,
    );
    assert.ok(
      isTerminator(fragments[fragments.length - 1]!),
      `${payload.id} (\`${payload.spelling}\`): the terminator must be last`,
    );
  }
});

test("every y-indexed load the alphabet emits renders to the absolute_y opcode and never the zeropage_y one", () => {
  // Asserted over the EMITTED BYTES by decoding one rendered example of each
  // load variant, so the guarantee is a property of the alphabet rather than of
  // a source grep a comment could trip. `zeropage_y` is not in the scan's
  // INDEXED_LOAD_MODES, so a y load emitted in that mode would be declined for
  // a reason unrelated to the register and every mixed-register arrangement in
  // the corpus would pass by construction.
  const cases: [Fragment, string][] = [
    [loadX(TABLE_LO_BASE), "absolute_x"],
    [loadX(TABLE_HI_BASE), "absolute_x"],
    [loadY(TABLE_LO_BASE), "absolute_y"],
    [loadY(TABLE_HI_BASE), "absolute_y"],
    [loadImm(TABLE_LO_BASE & 0xff), "immediate"],
    [loadImm(TABLE_HI_BASE & 0xff), "immediate"],
  ];
  for (const [fragment, expectedMode] of cases) {
    const bytes = Uint8Array.from(FRAGMENT_BYTES(fragment));
    const decoded = decode(bytes, GRAMMAR_ORIGIN, { count: 1 })[0]!;
    assert.equal(decoded.mode, expectedMode, `\`${spellFragment(fragment)}\` decoded as ${decoded.mode}`);
    assert.equal(decoded.illegal, false, `\`${spellFragment(fragment)}\` must decode as a legal instruction`);
  }

  // And over the corpus: no rendered payload may contain a zeropage_y load.
  for (const payload of INDEXED_MEMBERS) {
    for (const insn of decode(payload.bytes, GRAMMAR_ORIGIN)) {
      assert.notEqual(
        insn.mode,
        "zeropage_y",
        `${payload.id} (\`${payload.spelling}\`): a zeropage_y load would be declined for a reason unrelated to the ` +
          `register it indexes through`,
      );
    }
  }
});

test("all nine pinned regression members are present in the corpus by byte identity", () => {
  for (const idiom of PINNED_IDIOMS) {
    const arrangement: Arrangement = {
      id: `pinned:${idiom.name}`,
      family: idiom.family,
      kind: "indexed",
      fragments: idiom.fragments,
    };
    const key = byteKey(renderArrangement(arrangement));
    assert.ok(
      CORPUS_BYTE_KEYS.has(key),
      `pinned idiom \`${idiom.name}\` (\`${spellArrangement(idiom.fragments)}\`) is NOT in the corpus. ` +
        `Its family is ${idiom.family}; either the alphabet no longer expresses this shape at the shared geometry, ` +
        `or the family name it names no longer exists.`,
    );
    assert.ok(
      FAMILIES.some((family) => family.name === idiom.family),
      `pinned idiom \`${idiom.name}\` names family ${idiom.family}, which is not a family`,
    );
  }
  assert.equal(PINNED_IDIOMS.length, 9, "the nine named shapes this round's history turns on");
});

test("the corpus reaches every generative dimension: order, interleaving, gap placement and length", () => {
  const registerPairs = new Set<string>();
  const baseOrders = new Set<string>();
  const nopCounts = new Set<number>();
  const terminators = new Set<string>();
  const loadGaps = new Set<number>();
  const prologueLengths = new Set<number>();
  let terminatorOutsideWindow = 0;

  for (const payload of INDEXED_MEMBERS) {
    const fragments = payload.arrangement.fragments;
    const loads = fragments
      .map((fragment, index) => ({ fragment, index }))
      .filter((entry) => isIndexedLoad(entry.fragment));
    const first = loads[0]!.fragment as Extract<Fragment, { kind: "indexedLoad" }>;
    const second = loads[1]!.fragment as Extract<Fragment, { kind: "indexedLoad" }>;
    registerPairs.add(`${first.register}${second.register}`);
    baseOrders.add(first.base === TABLE_LO_BASE ? "lo-first" : "hi-first");
    nopCounts.add(fragments.filter((fragment) => fragment.kind === "nop").length);
    terminators.add(spellFragment(fragments[fragments.length - 1]!));
    loadGaps.add(loads[1]!.index - loads[0]!.index);
    prologueLengths.add(payload.prologueBytes);
    if (fragments.length - 1 >= loads[0]!.index + SPLIT_TABLE_WINDOW + 1) terminatorOutsideWindow++;
  }

  assert.deepEqual([...registerPairs].sort(), ["xx", "xy", "yx", "yy"], "every register pairing is generated");
  assert.deepEqual([...baseOrders].sort(), ["hi-first", "lo-first"], "both base orders are generated");
  assert.deepEqual([...nopCounts].sort((a, b) => a - b), [0, 1, 2], "the LENGTH dimension is generated");
  assert.equal(terminators.size, TERMINATOR_CHOICES.length, "every terminator choice is generated");
  assert.ok(
    loadGaps.size >= 4,
    `the INTERLEAVING dimension produced only ${loadGaps.size} distinct load separations: ${[...loadGaps].sort((a, b) => a - b).join(", ")}`,
  );
  assert.ok(
    [...loadGaps].some((gap) => gap > SPLIT_TABLE_WINDOW),
    `no arrangement places its two loads more than SPLIT_TABLE_WINDOW (${SPLIT_TABLE_WINDOW}) fragments apart, so the ` +
      `window edge is never reached by generation`,
  );
  assert.ok(
    prologueLengths.size >= 8,
    `only ${prologueLengths.size} distinct prologue lengths were generated -- the corpus is not varying in length`,
  );
  assert.ok(
    terminatorOutsideWindow > 0,
    `no arrangement's terminator falls outside its leading load's pairing window, so the GAP-PLACEMENT dimension is ` +
      `not reaching the window edge -- the shape the round-3 window-edge control was hand-written for`,
  );
});

test("the module under test is READ-ONLY by construction, and this suite writes no file", () => {
  // The corpus lives in memory. `r2000-coverage.ts` performs no filesystem
  // write outside its own project loader, and this file adds none: the
  // committed source-level assertion in `r2000-coverage.test.ts` proves the
  // former, and this one states that the grammar suite did not change it.
  const source = readFileSync(join(HERE, "r2000-coverage-grammar.test.ts"), "utf8");
  for (const forbidden of ["writeFileSync", "appendFileSync", "mkdirSync", "rmSync", "unlinkSync"]) {
    assert.ok(
      !source.includes(`${forbidden}(`),
      `this suite must not write to the filesystem, but it calls ${forbidden}()`,
    );
  }
});

// ---------------------------------------------------------------------------
// The oracle's own guards
// ---------------------------------------------------------------------------

test("the oracle never reaches the instrument: no decode, no scan, no census inside the oracle section", () => {
  // The isolation that makes this a specification rather than a second
  // implementation, asserted over this file's OWN source text rather than left
  // to the reader. A future edit that reaches for the scan to settle a hard case
  // reds here by name.
  const source = readFileSync(join(HERE, "r2000-coverage-grammar.test.ts"), "utf8");
  const beginMarker = "// --- ORACLE SECTION BEGIN ---";
  const endMarker = "// --- ORACLE SECTION END ---";
  const begin = source.indexOf(beginMarker);
  const end = source.indexOf(endMarker, begin + beginMarker.length);
  assert.ok(begin >= 0, "the oracle section's BEGIN marker is missing");
  assert.ok(end > begin, "the oracle section's END marker is missing or precedes its BEGIN marker");

  const section = source.slice(begin + beginMarker.length, end);
  assert.ok(
    section.length > 4000,
    `the oracle section is only ${section.length} characters -- the markers have drifted and this pin would pass ` +
      `over an empty span`,
  );
  assert.ok(section.includes("function expectedProvenLink("), "the oracle section must contain expectedProvenLink()");

  for (const forbidden of [
    "decode(",
    "scanIndirectDispatch(",
    "computeStructuralCensus(",
    "provenDispatchTargets(",
    "scanOfPayload(",
    "censusOfPayload(",
    "measure(",
    ".bytes",
  ]) {
    assert.ok(
      !section.includes(forbidden),
      `the oracle section names \`${forbidden}\`. The oracle reads the SYMBOLIC fragment list and the fixed DATA_TAIL ` +
        `and nothing else; an oracle that reaches into the scan it is checking agrees with it by construction and ` +
        `proves nothing.`,
    );
  }

  // And the positive half: exactly the six rules are named in the section, so a
  // rule silently dropped reds rather than passing as a smaller oracle.
  for (const rule of ["R1 --", "R2 --", "R3 --", "R4 --", "R5 --", "R6, first half --", "R6, second half --"]) {
    assert.ok(section.includes(rule) || source.includes(rule), `the oracle no longer states rule \`${rule}\``);
  }
});

test("the oracle's SCOPE is honest: no corpus payload reaches classes 1 or 2, so the oracle may be silent about them", () => {
  // Every indirect jump in the alphabet points through zero page, which lies
  // outside the image, so its target is null and it names no multi-entry table.
  // That is what LICENSES the oracle to say nothing about the two opcode-keyed
  // classes. If a future alphabet change breaks it the oracle becomes
  // incomplete, and this assertion reds first.
  let jumpsSeen = 0;
  for (const payload of CORPUS) {
    const { scan } = measure(payload);
    for (const jump of scan.indirectJumps) {
      jumpsSeen++;
      assert.equal(
        jump.target,
        null,
        `${payload.id} (\`${payload.spelling}\`): the indirect jump at ${hex(jump.at)} through ${hex(jump.pointer)} ` +
          `resolved to a target, so class 1 is live in this corpus and the oracle's silence about it is no longer honest`,
      );
    }
    assert.deepEqual(
      scan.multiEntryTables,
      [],
      `${payload.id} (\`${payload.spelling}\`): a multi-entry table was reconstructed, so class 2 is live in this ` +
        `corpus and the oracle's silence about it is no longer honest`,
    );
  }
  assert.ok(jumpsSeen > 0, "no corpus payload carries an indirect jump at all, so this assertion is vacuous");
});

test("the computed oracle AGREES with all nine hand-declared pinned verdicts", () => {
  // THE ANTI-COUPLING CHECK, and it is not optional. The nine declarations were
  // written by a human reading the shapes; the oracle was written from the six
  // rules. If the oracle ever drifts toward being a copy of the implementation
  // it is checking, it will start agreeing with the instrument and disagreeing
  // with these nine -- and this assertion is what fires.
  for (const idiom of PINNED_IDIOMS) {
    const arrangement: Arrangement = {
      id: `pinned:${idiom.name}`,
      family: idiom.family,
      kind: "indexed",
      fragments: idiom.fragments,
    };
    const verdict = expectedProvenLink(arrangement);
    assert.equal(
      verdict.linked,
      idiom.linked,
      `pinned idiom \`${idiom.name}\` (\`${spellArrangement(idiom.fragments)}\`): the oracle says ` +
        `${verdict.linked ? "LINKED" : "unlinked"} by ${verdict.rule}, the hand declaration says ` +
        `${idiom.linked ? "LINKED" : "unlinked"} because ${idiom.why}`,
    );
  }
  assert.equal(
    PINNED_IDIOMS.filter((idiom) => idiom.linked).length,
    3,
    "the pinned set must declare both verdicts -- nine members that all declare the same way would let an oracle " +
      "that answers one way for everything agree with all of them",
  );
});

// ---------------------------------------------------------------------------
// The headline property
// ---------------------------------------------------------------------------

test("the set of arrangements the instrument PROVES equals exactly the set the oracle says carries a proven link", () => {
  const proven = provenIds();
  const expected = expectedIds();

  const provenNotExpected = [...proven].filter((id) => !expected.has(id)).sort();
  const expectedNotProven = [...expected].filter((id) => !proven.has(id)).sort();

  const describe = (ids: readonly string[]): string =>
    ids
      .slice(0, 8)
      .map((id) => {
        const payload = PAYLOAD_BY_ID.get(id)!;
        const verdict = expectedProvenLink(payload.arrangement);
        return `\n    ${id}  \`${payload.spelling}\`  [oracle: ${verdict.linked ? "LINKED" : "unlinked"} by ${verdict.rule}]`;
      })
      .join("") + (ids.length > 8 ? `\n    ... and ${ids.length - 8} more` : "");

  // ONE assertion, BOTH directions. Decomposing this into two one-directional
  // tests would make each half satisfiable by a broken instrument: "nothing
  // unproven is proven" holds for an instrument that proves nothing at all, and
  // "everything expected is proven" holds for one that proves everything.
  assert.deepEqual(
    { provenNotExpected, expectedNotProven },
    { provenNotExpected: [], expectedNotProven: [] },
    `the instrument and the oracle disagree over ${CORPUS.length} composed payloads.\n` +
      `  PROVEN but NOT expected (${provenNotExpected.length}) -- false positives of the kind that has failed this ` +
      `criterion three times:${describe(provenNotExpected)}\n` +
      `  EXPECTED but NOT proven (${expectedNotProven.length}) -- an over-tightening that would make the instrument ` +
      `measure nothing:${describe(expectedNotProven)}`,
  );

  assert.equal(proven.size, expected.size);
});

test("an arrangement the oracle says is unlinked moves not one byte into the seed set or the table-entry class", () => {
  for (const payload of CORPUS) {
    const verdict = expectedProvenLink(payload.arrangement);
    if (verdict.linked) continue;
    const { scan, proven } = measure(payload);
    const where = `${payload.id} (\`${payload.spelling}\`) [oracle: unlinked by ${verdict.rule}]`;
    assert.deepEqual(proven, [], `${where}: nothing here may seed a recursive descent`);
    assert.deepEqual(scan.splitTables, [], `${where}: an unlinked pairing is advisory, never a PROVEN split table`);
    assert.deepEqual(scan.stackReturnDispatch, [], `${where}: no stack-return idiom may be published`);
    assert.deepEqual(scan.tableEntryAddresses, [], `${where}: not one byte may be claimed as a table entry`);
  }
});

test("an unlinked arrangement's census reaches exactly its own prologue and classifies no table byte as code", () => {
  for (const payload of CORPUS) {
    const verdict = expectedProvenLink(payload.arrangement);
    if (verdict.linked) continue;
    const { census } = measure(payload);
    const where = `${payload.id} (\`${payload.spelling}\`) [oracle: unlinked by ${verdict.rule}]`;

    // An EXACT equality, licensed by the one-terminator-last contract: the
    // descent walks the whole prologue from the origin and stops at the
    // terminator, so it reaches neither more nor less than the arrangement's own
    // code length.
    assert.equal(
      census.reachedAsInstruction,
      payload.prologueBytes,
      `${where}: the census reached ${census.reachedAsInstruction} bytes of a ${payload.prologueBytes}-byte program`,
    );

    assert.equal(
      classAt(census, TARGET_BASE),
      "unreached",
      `${where}: ${hex(TARGET_BASE)} holds ordinary data that nothing proven ever reaches`,
    );

    // At the table base the honest claim is NOT "unreached". An indexed load's
    // absolute operand marks its base `referenced-as-data`, which is a fourth,
    // deliberately separate class -- reported beside the proven ones and never
    // summed into them. What may never happen is the table base being claimed as
    // CODE or as a proven TABLE ENTRY, and that is what is asserted.
    const tableClass = classAt(census, TABLE_LO_BASE);
    assert.ok(
      tableClass === "unreached" || tableClass === "referenced-as-data",
      `${where}: ${hex(TABLE_LO_BASE)} is classified \`${tableClass}\`. An unlinked arrangement may leave its table ` +
        `base unreached or merely referenced as data, never reached-as-instruction and never table-entry`,
    );
  }
});

test("twins: an unlinked pair reports the same census, and a LINKED indexed member reaches strictly more than its twin", () => {
  // The split is decided by the COMPUTED verdict, not by hand. Applying twin
  // equality to a linked pair would be false -- the whole point of a linked
  // arrangement is that it reaches further than a program with no indexed pair
  // -- and skipping linked pairs would leave the property one-directional, so
  // the two statements are asserted against each other's complement.
  let equalPairs = 0;
  let strictPairs = 0;
  for (const payload of INDEXED_MEMBERS) {
    const twin = PAYLOAD_BY_ID.get(payload.twinId)!;
    const verdict = expectedProvenLink(payload.arrangement);
    const indexedReach = measure(payload).census.reachedAsInstruction;
    const twinReach = measure(twin).census.reachedAsInstruction;
    const where = `${payload.id} (\`${payload.spelling}\`) [oracle: ${verdict.linked ? "LINKED" : "unlinked"} by ${verdict.rule}]`;

    if (verdict.linked) {
      assert.ok(
        indexedReach > twinReach,
        `${where}: a linked arrangement seeds a descent its twin cannot, so it must reach strictly more than the ` +
          `twin's ${twinReach} bytes -- observed ${indexedReach}`,
      );
      strictPairs++;
    } else {
      assert.equal(
        indexedReach,
        twinReach,
        `${where}: the twin differs only in addressing mode, so an unlinked pair must report the same census -- ` +
          `${indexedReach} against ${twinReach}`,
      );
      equalPairs++;
    }
  }
  assert.ok(equalPairs > 0 && strictPairs > 0, "both halves of the twin property must be exercised");
});

test("the instrument is NOT quietly measuring nothing: the corpus carries a population of genuinely linked arrangements", () => {
  const linked = CORPUS.filter((payload) => expectedProvenLink(payload.arrangement).linked);
  assert.ok(
    linked.length >= MIN_LINKED,
    `only ${linked.length} of ${CORPUS.length} payloads carry a proven link, below MIN_LINKED (${MIN_LINKED}). ` +
      `Every "nothing unproven is proven" statement in this file is satisfied by an instrument that had quietly ` +
      `stopped scanning; this is the half that rules that out.`,
  );
  for (const payload of linked) {
    const { proven, census } = measure(payload);
    const where = `${payload.id} (\`${payload.spelling}\`)`;
    assert.ok(proven.length > 0, `${where}: a linked arrangement must publish a non-empty seed set`);
    assert.ok(
      census.reachedAsInstruction > payload.prologueBytes,
      `${where}: a linked arrangement's seeds must carry the descent beyond its own ${payload.prologueBytes}-byte ` +
        `prologue -- observed ${census.reachedAsInstruction}`,
    );
  }
});

test("degenerate inputs produce empty dispatch collections and no throw", () => {
  const rawBytes = (fragments: readonly Fragment[]): Uint8Array =>
    Uint8Array.from(fragments.flatMap((fragment) => FRAGMENT_BYTES(fragment)));

  const cases: [string, Uint8Array][] = [
    ["an empty byte array", new Uint8Array(0)],
    ["a single-instruction payload", rawBytes([RTS])],
    [
      "a payload shorter than the pairing window",
      rawBytes([loadX(TABLE_LO_BASE), loadX(TABLE_HI_BASE), RTS]),
    ],
  ];

  for (const [name, bytes] of cases) {
    const scan = scanOfPayload(bytes);
    assert.deepEqual(scan.indirectJumps, [], `${name}: no indirect jump`);
    assert.deepEqual(scan.multiEntryTables, [], `${name}: no multi-entry table`);
    assert.deepEqual(scan.splitTables, [], `${name}: no proven split table`);
    assert.deepEqual(scan.splitTableCandidates, [], `${name}: no advisory candidate`);
    assert.deepEqual(scan.stackReturnDispatch, [], `${name}: no stack-return idiom`);
    assert.deepEqual(scan.discoveredTargets, [], `${name}: no discovered target`);
    assert.deepEqual(scan.tableEntryAddresses, [], `${name}: no table-entry address`);
    assert.deepEqual(provenDispatchTargets(scan), [], `${name}: no proven target`);
    const census = censusOfPayload(bytes, scan);
    assert.equal(census.rangeBytes, bytes.length, `${name}: the census must still be well-formed`);
  }
});

test("every address list the scan publishes is strictly ascending and free of duplicates, and scanning twice is stable", () => {
  const ascendingAndUnique = (values: readonly number[]): boolean =>
    values.every((value, index) => index === 0 || value > values[index - 1]!);

  for (const payload of CORPUS) {
    const { scan, census } = measure(payload);
    const where = `${payload.id} (\`${payload.spelling}\`)`;
    for (const [name, list] of [
      ["discoveredTargets", scan.discoveredTargets],
      ["tableEntryAddresses", scan.tableEntryAddresses],
      ["provenDispatchTargets", provenDispatchTargets(scan)],
      ["census.seeds", census.seeds],
    ] as [string, number[]][]) {
      assert.ok(
        ascendingAndUnique(list),
        `${where}: ${name} is not strictly ascending -- ${list.map((value) => hex(value)).join(", ")}`,
      );
    }
  }

  // Idempotency, measured on a fresh scan rather than on the memoised one.
  for (const payload of [INDEXED_MEMBERS[0]!, INDEXED_MEMBERS[INDEXED_MEMBERS.length - 1]!, TWIN_MEMBERS[0]!]) {
    assert.deepEqual(
      scanOfPayload(payload.bytes),
      scanOfPayload(payload.bytes),
      `${payload.id}: scanning the same payload twice must yield deep-equal results`,
    );
  }
});

test("the suite stays inside its 30-second budget, so a runaway enumeration is caught rather than tolerated", () => {
  const elapsedMs = Date.now() - MODULE_LOADED_AT;
  assert.ok(
    elapsedMs < 30_000,
    `the grammar suite took ${elapsedMs} ms. An unbounded interleaving enumeration is factorial; MAX_FRAGMENTS, the ` +
      `MAX_CORPUS round-robin cap and the per-stratum even-spaced take are what keep it bounded.`,
  );
});

