#!/usr/bin/env node
// anno-bank.ts
//
// Phase 37, plan 37-06 (AUTO-04/AUTO-05): the processor-port bit decode, the
// per-range banked-region resolution, and the region-to-map-entry
// consistency table `anno-join.ts`'s candidate-constraint step calls BEFORE
// `selectMemmapEntry()` ever runs. This is the phase's highest-risk
// requirement pair -- both are recorded UNVALIDATED, not narrowed, and a
// measured survey found no prior art to copy (SVD-Loader, radare2's
// device-description import, IDA's device definitions all annotate
// unconditionally, because their domain has no path-dependent address
// meaning). Resolve bank state BEFORE the address; decline with a reason
// where the program itself does not determine one.
//
// THIS MODULE NEVER NAMES THE PERSISTENCE DEPENDENCY, NEVER OPENS THE STORE,
// and NEVER IMPORTS `hostpath.ts`/`containerpath.ts` -- the same posture
// `memmap-lookup.ts` takes. It takes plain data (a raw `$01` value, a
// `MemmapEntry`) and returns plain data.
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR: D-37-21's bit arithmetic
// (`decodeBankState`), the not-applicable-outside-the-three-ranges rule
// (`resolveBankedRegion`), the address-is-bank-conditional-at-all membership
// test (`isBankConditionalAddress`), and the region-to-map-entry consistency
// table (`regionAdmitsEntry`) `anno-join.ts`'s candidate constraint uses.
//
// The REACHING-VALUES SET computation -- which recovered processor-port
// value(s) reach a given program point, over the recovered const-write facts
// and the stored cross-reference graph (D-37-24) -- lives in `anno-join.ts`
// itself, not here. This module only ever decodes a SINGLE already-resolved
// value; it has no notion of "which value(s) reach this address" and never
// will (that is the join's own responsibility, since it alone holds the
// store handle and the cross-reference graph).
//
// WHAT NOT TO DO:
//   - Never derive "is this region io/basic/kernal/character-rom" from
//     memmap.json's `desc` field by regex (37-RESEARCH.md Pitfall 2 /
//     `BANK_CONDITIONAL_RANGES`'s own header comment in `memmap-lookup.ts`).
//     `regionAdmitsEntry()` below matches against the STRUCTURED `section`
//     field (plus one whole-word "RAM" label fallback, since no committed
//     section names RAM specifically within any of the three ranges) --
//     never `desc`.
//   - Never default an unresolved region to RAM (the power-on state). The
//     caller (`anno-join.ts`) declines instead; this module only ever
//     returns a decoded/resolved answer or the explicit "not applicable"
//     member -- it never invents a fallback of its own.
//   - Never write the store's reserved `bank` column (D-37-25). This module
//     does not touch the store at all, so that prohibition is satisfied by
//     construction here -- restated because this is the plan that would be
//     tempted.

import { BANK_CONDITIONAL_RANGES } from "./memmap-lookup.ts";
import type { MemmapEntry } from "./memmap-lookup.ts";

/**
 * D-37-21: what a bank-conditional range currently contains. `not_applicable`
 * exists so a caller can tell "this address is outside all three
 * bank-conditional ranges" from "the constraint resolved to RAM" -- collapsing
 * the two would make an out-of-range address silently RAM-constrained, which
 * is exactly the confident-wrong-comment failure `AUTO-04` exists to prevent.
 */
export type BankedRegion = "io_area" | "character_rom" | "ram" | "basic_rom" | "kernal_rom" | "not_applicable";

/** The decoded triple, plus the raw value it was decoded from. Each field
 * answers "what does THIS ONE range currently hold", independent of whether
 * the address a caller cares about actually falls inside it -- that mapping
 * is `resolveBankedRegion()`'s job. */
export interface BankState {
  raw: number;
  ioRange: BankedRegion;
  basicRange: BankedRegion;
  kernalRange: BankedRegion;
}

/**
 * D-37-21's bit arithmetic, stated as bit tests rather than left for a reader
 * to re-derive from `bank.a`'s own inline comment -- which mislabels the
 * all-RAM value's own bit 2 as clear (it is SET; the RAM outcome it states is
 * right anyway, because the RAM case never depends on bit 2). Masks to bits
 * 2-0 FIRST, so two values differing only above bit 2 decode identically --
 * asserted as its own test case rather than merely trusted.
 *
 *   - `$D000-$DFFF` (the I/O range): when bits #1-#0 are both clear, the
 *     region is RAM regardless of bit #2. Otherwise, bit #2 clear is
 *     Character ROM; bit #2 set is the I/O area.
 *   - `$A000-$BFFF` (the BASIC range): BASIC ROM only when BOTH bits #1 and
 *     #0 are set; otherwise RAM.
 *   - `$E000-$FFFF` (the KERNAL range): KERNAL ROM when bit #1 is set;
 *     otherwise RAM.
 */
export function decodeBankState(value: number): BankState {
  const raw = value;
  const b = value & 0x07; // bits #2-#0: CHAREN(2) HIRAM(1) LORAM(0)
  const bits10 = b & 0x03;
  const bit2Set = (b & 0x04) !== 0;

  const ioRange: BankedRegion = bits10 === 0 ? "ram" : bit2Set ? "io_area" : "character_rom";
  const basicRange: BankedRegion = bits10 === 0x03 ? "basic_rom" : "ram";
  const kernalRange: BankedRegion = (b & 0x02) !== 0 ? "kernal_rom" : "ram";

  return { raw, ioRange, basicRange, kernalRange };
}

/** Does `address` fall inside ANY of the three bank-conditional ranges,
 * regardless of the current `$01` value? The join uses this to decide
 * whether the whole reaching-values/decline machinery applies to an address
 * at all -- outside these three ranges, bank state is irrelevant and the
 * candidate set stays unconstrained (D-37-22). */
export function isBankConditionalAddress(address: number): boolean {
  for (const range of BANK_CONDITIONAL_RANGES) {
    if (address >= range.start && address <= range.end) return true;
  }
  return false;
}

/**
 * D-37-22: resolves a single address against an already-decoded `state`,
 * returning the NOT-APPLICABLE member for any address outside all three
 * `BANK_CONDITIONAL_RANGES` -- never RAM. The three ranges are disjoint by
 * construction (each a fixed, hand-maintained, non-overlapping span), so the
 * first (and only) match determines the answer.
 */
export function resolveBankedRegion(address: number, state: BankState): BankedRegion {
  for (const range of BANK_CONDITIONAL_RANGES) {
    if (address < range.start || address > range.end) continue;
    if (range.start === 0xd000) return state.ioRange;
    if (range.start === 0xa000) return state.basicRange;
    if (range.start === 0xe000) return state.kernalRange;
  }
  return "not_applicable";
}

/**
 * The region-to-map-entry consistency table (D-37-22's candidate constraint,
 * T-37-29's mitigation). Matches the STRUCTURED `section` field, never
 * `desc` (Pitfall 2) -- a small, explicit, hand-maintained keyword set per
 * region, cross-checked against the real committed `memmap.json`'s own
 * section vocabulary (37-RESEARCH.md §C; MEASURED this plan against the
 * real file's `$D000-$DFFF` overlap).
 *
 * RAM has NO dedicated `section` anywhere in the three bank-conditional
 * ranges -- there is nothing chip-specific to document about plain program
 * RAM sitting underneath a ROM/IO window -- so it is matched instead against
 * the entry's own LABEL for a whole-word "RAM" token, which is exactly how
 * the map's own "depends on the processor port" entries describe the RAM
 * alternative (e.g. "I/O Area (memory mapped chip registers), Character ROM
 * or RAM area"; "KERNAL ROM or RAM area"; "BASIC ROM or RAM area").
 */
const SECTION_MARKERS: Readonly<Record<Exclude<BankedRegion, "ram" | "not_applicable">, readonly string[]>> = Object.freeze({
  io_area: Object.freeze(["I/O Area", "VIC", "SID", "CIA", "Color RAM"]),
  character_rom: Object.freeze(["Character ROM"]),
  basic_rom: Object.freeze(["BASIC ROM"]),
  kernal_rom: Object.freeze(["KERNAL ROM"]),
});

/** Whole-word "RAM" -- deliberately NOT a bare substring match, so a label
 * like "PROGRAM" or "RAMPAGE" (neither of which exists in the committed map
 * today, but the rule should not depend on that) never false-matches. */
const RAM_LABEL_WORD = /\bRAM\b/;

/**
 * Does `entry` represent `region`? `not_applicable` never reaches here -- the
 * join only calls this once a real bank-conditional region has been
 * resolved for a specific address. An entry matching NO region member
 * returns `false`, so the caller's candidate-narrowing EXCLUDES it rather
 * than silently admitting it (D-37-22's own prohibition).
 */
export function regionAdmitsEntry(entry: MemmapEntry, region: Exclude<BankedRegion, "not_applicable">): boolean {
  if (region === "ram") return RAM_LABEL_WORD.test(entry.label);
  const markers = SECTION_MARKERS[region];
  return typeof entry.section === "string" && markers.some((marker) => entry.section.includes(marker));
}
