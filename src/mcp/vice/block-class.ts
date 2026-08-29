#!/usr/bin/env node
// block-class.ts
//
// The ONE place that translates an annotation store's own block-type
// vocabulary into a neutral block class. Nothing else in this tree may
// compare a store block-type string, and nothing else may read a store block
// listing on the census's behalf (SEAM-03).
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// `anno-coverage.ts` is the coverage instrument: it implements two Validated
// requirements and measures how much of a binary has actually been reverse-
// engineered. Its census is a pure function of the raw bytes and the seed set
// the caller supplies -- deliberately, because deriving completeness from the
// store's own block table measures the annotator's bookkeeping rather than
// the annotation.
//
// Yet the census's ONLY tie to the external analyser this project rents its
// annotation store from was four inline comparisons against that analyser's
// Rust `Display` strings, spread across three code regions and reached from
// two lookup call sites. Four string literals were the entire reason a
// 2,292-line instrument looked like glue around somebody else's data model.
// Any prefix-driven deletion of the rented substrate would have taken the
// instrument with it.
//
// So the tie lives here, in one small module, behind one named function. A
// later phase swaps THIS module -- the store's vocabulary changes, the census
// does not. That is the whole point: the boundary is the module, never an
// argument threaded through the census.
//
// The neutral classes are LOWERCASE. That lowercase-ness was once claimed as
// a protection in its own right -- the argument being that a capitalised
// store spelling could not accidentally agree with it, so a comparison site
// left behind somewhere else would get a different answer and move a measured
// number, loudly. THAT PREMISE IS NOW FALSE, and the loss is recorded here
// rather than left to be rediscovered: this project's own
// store's vocabulary is LOWERCASE, and two of its twelve members -- the code
// spelling and the undefined spelling -- are string-identical to their
// neutral classes. A left-behind raw comparison against the store's own
// spelling therefore CAN accidentally agree now, silently, which is exactly
// what the old rationale promised could not happen.
//
// Two guards replace it, and they are why the mapping below is still
// defended. Neither is a claim in a header:
//
//   (a) the derived TOTAL cross-check in `block-class.test.ts`. It iterates
//       the store's frozen twelve-member vocabulary from its single home and
//       asserts the class this module returns for EVERY member, with its own
//       non-vacuity assertions on the counts. It reddens the moment either
//       side drifts; a spot check would not.
//   (b) `anno-coverage.test.ts`'s zero-overlap substitutability proof. Its
//       substituted vocabulary (`EXECUTABLE_EXTENT` and its two siblings)
//       shares no string with EITHER accepted vocabulary, so a left-behind
//       comparison site is still observable there -- which is why that
//       vocabulary list is DERIVED from both, not hand-written at four
//       entries.
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO -- each of these is a specific, named trap
// ---------------------------------------------------------------------------
//   1. NEVER accept the census, the raw program bytes, a decoder, or a
//      confidence grade as an argument here. `anno-coverage.ts` records a
//      BYTES-VERSUS-STORE independence axis: one side classifies an address
//      using only the raw bytes and the census, the other using only the
//      store's own documentation, and NEITHER SIDE READS THE OTHER'S INPUT.
//      That axis is the reason its reproducibility figure means anything.
//      One extra argument here collapses it -- and it collapses QUIETLY: the
//      independence test would keep passing while the claim it protects
//      became void. The signature below is two arguments and must stay two.
//   2. NEVER compare a store vocabulary string outside this module. A second
//      comparison site is a second answer to "what class is this address",
//      and the census must have exactly one.
//   3. NEVER hold module-level mutable state. The lookup is a pure function
//      of its two arguments, so interleaved or repeated calls cannot observe
//      each other. There is nothing to reset and nothing to synchronise.
//   4. NEVER import anything census-side, disassembler-side, transport-side
//      or path-translation-side. This module's import list is EMPTY and a
//      committed structural assertion in `block-class.test.ts` keeps it that
//      way -- see trap 1 for why the emptiness is load-bearing rather than
//      tidy.

// ---------------------------------------------------------------------------
// The neutral vocabulary
// ---------------------------------------------------------------------------

/**
 * The three neutral block classes every consumer speaks. Lowercase tokens.
 *
 * These tokens were once ALSO offered as a guard in their own right, on the
 * ground that no store spelling could collide with them. Two of the store's
 * twelve members now do collide, so that reading is gone -- see this file's
 * header for the loss and for the two derived cross-checks that defend the
 * mapping instead.
 *
 * Three-valued and no finer. The consumers compare this against a
 * classification derived from completely different inputs, so a richer
 * vocabulary would manufacture disagreement out of vocabulary drift rather
 * than measure anything.
 */
export type BlockClass = "code" | "data" | "undefined";

/**
 * One entry of a store's block listing, exactly as the curated read tool
 * returns it.
 *
 * `type` carries the STORE'S OWN vocabulary -- whatever spelling the
 * annotation substrate happens to use for its block kinds. This module is
 * the only place in the tree that interprets that field. A consumer that
 * reads `.type` and compares it is re-opening the boundary this file exists
 * to close.
 */
export interface BlockEntry {
  start_address: number;
  end_address: number;
  /** The store's own block-kind spelling. Interpreted HERE and nowhere else. */
  type: string;
}

/**
 * The shape of a block classifier: given a store's block listing and an
 * address, the neutral class covering that address, or `null` when no block
 * covers it.
 *
 * Named as a type so a consumer can be handed a substitute implementation
 * for a substitutability proof without that consumer ever naming a concrete
 * store vocabulary.
 */
export type BlockClassifier = (blocks: readonly BlockEntry[], address: number) => BlockClass | null;

/**
 * The one production classifier.
 *
 * A linear scan, first-match-wins, with both range ends INCLUSIVE. A
 * `null`/`undefined` hole in the array is skipped rather than thrown on --
 * the listing arrives from a project file this process did not author. That
 * premise applies to `blocks` ITSELF as well, so a non-array argument returns
 * `null` here rather than throwing a `TypeError` out of the `for ... of`
 * (IN-04). Both production callers already pre-guard with
 * `Array.isArray(blocks) ? blocks : []`, so nothing is reachable today; the
 * point is that the defence now lives in the module that DOCUMENTS the
 * premise, instead of only in callers outside it.
 *
 * The mapping is total by construction over BOTH ACCEPTED VOCABULARIES: a
 * code spelling from either becomes `"code"`, an undefined spelling from
 * either becomes `"undefined"`, and EVERY other spelling becomes `"data"` --
 * whether it belongs to one of the two vocabularies or to neither. That
 * fallthrough is not a simplification; it is exactly what the two comparisons
 * this function replaced did when read together, and it is what keeps an
 * unrecognised spelling -- including one from a producer this module has
 * never heard of -- from silently reading as code.
 *
 * The two arms are two VOCABULARIES that happen to differ in case, never one
 * vocabulary compared case-insensitively. A case-insensitive or
 * whitespace-trimming comparison here would silently accept a third spelling
 * nobody chose; `block-class.test.ts` pins that it does not.
 */
export const blockClassAt: BlockClassifier = (blocks, address) => {
  if (!Array.isArray(blocks)) return null;
  for (const block of blocks) {
    if (!block) continue;
    if (address >= block.start_address && address <= block.end_address) {
      // TWO ACCEPTED VOCABULARIES, one arm each, in the same order so the
      // pairing reads at a glance. Deliberately NOT folded into a
      // case-insensitive test -- see this function's doc comment.
      //
      // This project's own annotation store, whose twelve block types are
      // lowercase and live in one frozen home the test cross-checks against:
      if (block.type === "code") return "code";
      if (block.type === "undefined") return "undefined";
      // TRANSITIONAL -- the capitalised vocabulary, whose PRODUCER (the
      // external analyser this project used to rent an annotation store from,
      // whose Rust `Display` emitted these spellings) IS GONE AS OF PHASE 29,
      // 2026-08-29. The trigger the previous comment named has therefore
      // already fired, and the arm still stands. That is a decision, recorded
      // here rather than left to be rediscovered as an inert branch:
      //
      //   WHY IT SURVIVES ITS OWN TRIGGER: every committed coverage fixture
      //   under `fixtures/coverage/**/store.json` is still SPELLED in this
      //   vocabulary ("Code", "Byte", "Undefined"). Deleting the two arms
      //   below today reclassifies every fixture block as `data` -- silently,
      //   because `data` is the total fallthrough and no error is raised
      //   anywhere. The fixtures are the census's own controls, so that would
      //   move the numbers the controls exist to pin.
      //
      //   THE NEW REMOVAL TRIGGER is therefore the FIXTURES being re-spelled
      //   into the store's own lowercase vocabulary -- not the producer being
      //   deleted, which has happened. Re-spell the fixtures (and their
      //   generator) first, observe the census unchanged, then delete these
      //   two lines.
      //
      //   FATE: carried as a Phase 32 guard-fate item ("every guard pinned to
      //   the deleted subject has a recorded fate"), so the ledger picks this
      //   arm up deliberately instead of finding it red or inert in CI.
      if (block.type === "Code") return "code";
      if (block.type === "Undefined") return "undefined";
      return "data";
    }
  }
  return null;
};
