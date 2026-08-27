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
// `r2000-coverage.ts` is the coverage instrument: it implements two Validated
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
// The neutral classes are LOWERCASE on purpose. The store's vocabulary is
// capitalised, so a comparison site left behind somewhere else cannot
// accidentally still agree -- it gets a different answer and moves a
// measured number, loudly.
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO -- each of these is a specific, named trap
// ---------------------------------------------------------------------------
//   1. NEVER accept the census, the raw program bytes, a decoder, or a
//      confidence grade as an argument here. `r2000-coverage.ts` records a
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
 * The three neutral block classes every consumer speaks. Lowercase tokens,
 * deliberately distinct from any store's own capitalised spelling (see this
 * file's header): a left-behind comparison against a raw store string is
 * meant to be observable, not accidentally compatible.
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
 * the listing arrives from a project file this process did not author.
 *
 * The mapping is total by construction: the store's code spelling becomes
 * `"code"`, its undefined spelling becomes `"undefined"`, and EVERY other
 * spelling becomes `"data"`. That fallthrough is not a simplification; it is
 * exactly what the two comparisons this function replaced did when read
 * together, and it is what keeps an unrecognised store spelling from
 * silently reading as code.
 */
export const blockClassAt: BlockClassifier = (blocks, address) => {
  for (const block of blocks) {
    if (!block) continue;
    if (address >= block.start_address && address <= block.end_address) {
      if (block.type === "Code") return "code";
      if (block.type === "Undefined") return "undefined";
      return "data";
    }
  }
  return null;
};
