#!/usr/bin/env node
// evid-reconcile.ts
//
// Plan 43-04 (EVID-03, EVID-04): the ONE place that joins the byte-derived
// block table (`block-class.ts`'s own vocabulary, read through `blockClassAt`)
// against the runtime evidence table (`anno_evid_exec`, plan 43-02's
// `EvidExecRow`) and reports where the two independent classifiers disagree.
// Shaped exactly like `dxa-proof01-compare.ts` (Phase 38, plan 38-01): two
// already-fetched classifications in, buckets with an explicit denominator
// and named third/fourth buckets out, nothing fetched and nothing mutated.
//
// WHY THIS FILE EXISTS: an address the byte-derived block table calls `data`
// AND the emulator was observed executing is the single highest-value output
// this whole evidence layer can produce -- proof that a byte-derived guess
// was wrong, from a source (real execution) that never saw the guess. That
// value only exists because the two classifiers are independent; the moment
// this module compares a block-type string itself, or folds absence into a
// classification, both requirements this plan settles are void even though
// every existing test keeps passing.
//
// THE FOUR BUCKETS, AND WHY THE THIRD AND FOURTH ARE NOT OPTIONAL (EVID-03):
//   1. disagreement    -- block class is `data`, evidence holds an observed
//      execute. Reported FIRST, as rows. This is the whole point of the query.
//   2. agreement        -- block class is `code`, evidence holds an observed
//      execute. Reported as a COUNT ONLY. A wall of agreeing rows here would
//      bury bucket 1.
//   3. block-covered, never observed -- the block table classifies the
//      address and NO run ever observed it executing. Neither agreement nor
//      disagreement: absence proves nothing (EVID-04), and folding this
//      population into either bucket would be exactly the soundness
//      violation EVID-04 forbids.
//   4. observed outside any block / observed at an explicitly `undefined`
//      block -- evidence about an address the block table does not classify
//      as code or data at all. Neither agreement nor disagreement either;
//      named and counted so the denominator can never quietly drop real
//      evidence and lie about what it accounts for.
//
// UNION-ACROSS-RUNS PROHIBITION, STATED HERE ONCE FOR THE WHOLE MODULE
// (EVID-04): however many runs contribute observations to `observations`,
// their union is NEVER exhaustive and NEVER complete coverage of the image.
// No field this module returns may be read as "the rest is data" -- the four
// buckets are the structural reason: summing them tells a reader what the
// block table covers, never what the program actually is. An address absent
// from every run's observations is `blockCoveredNeverObservedCount` (if the
// block table covers it) or simply outside `denominator` altogether (if it
// does not) -- in neither case is it, or does it become, `data`.
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO -- each of these is a specific, named trap
// ---------------------------------------------------------------------------
//   1. NEVER fetch either side here. `blocks` and `observations` arrive as
//      plain data the caller already fetched (`listRanges()` and
//      `listExecObservations()` respectively); this module never opens a
//      store, reaches a transport, or names a filesystem/child-process
//      specifier. A structural source assertion in this module's own test
//      file bars exactly that.
//   2. NEVER compare a store block-type string here. That is `block-class.ts`'s
//      job and its own trap 2 ("never compare a store vocabulary string
//      outside this module") -- this module borrows `blockClassAt`'s answer
//      through the injectable `classifier` parameter and never reads
//      `BlockEntry.type` itself.
//   3. NEVER return a percentage, rate, ratio or score. Every count this
//      module returns carries `denominator` as the fraction it is relative
//      to; a consumer that wants a rate forms it from the two. There is no
//      rounding site in this module for exactly that reason.
//   4. NEVER let "no row" and "observed not executing" collide. A row in
//      `observations` exists only for an observed execute (plan 43-05's own
//      discipline) -- there is no "observed but not executing" state this
//      module's input can even represent, so this module never invents one.
//   5. NEVER derive `data` from absence. `blockCoveredNeverObservedCount` is
//      the ONLY thing this module may say about the never-observed
//      population: a count against a named denominator, never a class. See
//      that field's own doc comment below.
import { blockClassAt, type BlockClass, type BlockEntry, type BlockClassifier } from "./block-class.ts";
import type { EvidExecRow, EvidSourceBank, RuntimeExecClass } from "./anno-types.ts";

/**
 * Plain data the caller already fetched -- this module never fetches either
 * side itself (trap 1 above). `blocks` is `listRanges()`'s own byte-derived
 * listing; `observations` is `listExecObservations()`'s own runtime-evidence
 * rows. `classifier` defaults to the one production interpreter of a store
 * block-type string, `blockClassAt` -- the exact
 * `typeof opts.x === "function" ? opts.x : blockClassAt` guard
 * `anno-coverage.ts` already uses for the identical substitutability
 * discipline, so a test can drive a substituted vocabulary through the real
 * code path rather than a copy of it.
 */
export interface EvidReconcileInput {
  blocks: readonly BlockEntry[];
  observations: readonly EvidExecRow[];
  classifier?: BlockClassifier;
}

/**
 * One disagreement row: the byte-derived tier said `data`, the runtime
 * evidence layer holds at least one observed execute at that address.
 * `byteDerived` and `runtime` are fixed to `"data"`/`"code"` for every member
 * of this bucket by construction (a row only ever lands here on that exact
 * pairing) -- carried as fields anyway so a renderer never has to re-derive
 * what bucket it is looking at from context.
 */
export interface EvidDisagreement {
  address: number;
  /** Always `"data"` for a member of this bucket. */
  byteDerived: BlockClass;
  /** Always `"code"` for a member of this bucket. */
  runtime: RuntimeExecClass;
  /** Sorted ascending and de-duplicated, so a reader can see at a glance
   * whether the execute bit came from RAM, ROM or IO space. */
  sourceBanks: readonly EvidSourceBank[];
}

/**
 * The join's result. `disagreements` is declared and returned FIRST --
 * EVID-03's own requirement that disagreement is reported before agreement,
 * never buried under it. `agreementCount` is a NUMBER; there is no
 * agreement-row array anywhere in this shape, on purpose (a wall of agreeing
 * rows would bury the one output this whole query exists to surface).
 *
 * Every count field here is a fraction of `denominator`, and this type has
 * no field that is, or that could be mistaken for, a percentage, rate, ratio
 * or score (trap 3 above).
 */
export interface EvidReconciliation {
  /** The disagreements. FIRST key, both declared and returned -- EVID-03. */
  disagreements: EvidDisagreement[];
  /** `disagreements.length`, exposed as its own field so a caller never has
   * to re-derive a count from an array it may not want to hold onto. */
  disagreementCount: number;
  /** Count only -- see this interface's own doc comment for why there is no
   * corresponding row array. */
  agreementCount: number;
  /**
   * The block table classifies this address (either `code` or `data` or
   * `undefined`) and NO run's observations ever recorded it executing. This
   * count is the ONLY thing this module may say about that population -- a
   * count against `denominator`, never a class -- because an address never
   * observed executing proves nothing about whether it is code or data
   * (EVID-04, and the same discipline `textmon-memmap.ts` states for itself:
   * "never classify an address as data on the strength of never having been
   * observed"). Neither agreement nor disagreement folds this population in.
   */
  blockCoveredNeverObservedCount: number;
  /**
   * An observed execute at an address NO block covers at all
   * (`classifier` returned `null`). This exists so the denominator cannot
   * lie: an observation the block table does not cover is real evidence
   * about an unclassified address, and silently dropping it would leave a
   * reader believing every observation this module saw was accounted for by
   * `denominator` when it was not.
   */
  observedOutsideAnyBlockCount: number;
  /**
   * An observed execute at an address the block table explicitly marks
   * `undefined`. An explicitly-undefined block claimed nothing about that
   * address, so an observation there is neither agreement nor disagreement
   * -- it joins `blockCoveredNeverObservedCount`'s sibling count under its
   * own name rather than being silently absorbed into either bucket.
   */
  observedAtUndefinedBlockCount: number;
  /**
   * The count of distinct addresses the block table covers -- what every
   * other count on this object is a fraction of. Computed here from the
   * blocks' own inclusive ranges, never copied from an input or a literal.
   * No rate is ever formed from it in this module (trap 3 above), so a zero
   * denominator (an empty `blocks` array) is a legal input, never a refusal.
   */
  denominator: number;
  /** Always `"code"` -- the runtime evidence layer's only positive class. */
  positiveClass: "code";
  /** Always `"runtime-observed"` -- this reconciler only ever joins against
   * the runtime-observed tier. */
  tier: "runtime-observed";
}

/** De-duplicates and sorts a source-bank list ascending. Never insertion
 * order, which would depend on the order observation rows happened to
 * arrive in and could differ across two logically-identical inputs built by
 * different code paths. */
function sortSourceBanksAscending(banks: readonly EvidSourceBank[]): EvidSourceBank[] {
  return [...new Set(banks)].sort();
}

/** Sorts disagreement rows by address ascending. Same determinism
 * discipline as `sortSourceBanksAscending`, applied to the one row array
 * this module returns. */
function sortDisagreementsAscending(disagreements: readonly EvidDisagreement[]): EvidDisagreement[] {
  return [...disagreements].sort((a, b) => a.address - b.address);
}

/**
 * The join. For every address the block table covers (derived from the
 * blocks' own inclusive ranges, both ends, never from a hardcoded 65536):
 * `disagreements` when the classifier says `data` and an observation exists;
 * `agreementCount` when it says `code` and an observation exists;
 * `blockCoveredNeverObservedCount` when NO observation exists, regardless of
 * class. A covered address whose class is `undefined` (or, defensively, an
 * address a substituted classifier fails to classify at all) that DOES carry
 * an observation falls through this first walk untouched, and is picked up
 * by the second walk below as `observedAtUndefinedBlockCount` -- never here,
 * so it can never be miscounted as "never observed".
 *
 * A second walk, over the observation side alone, then counts every observed
 * address the first walk did not already account for: `classifier` returning
 * `null` (no block covers it at all) becomes `observedOutsideAnyBlockCount`;
 * `classifier` returning `"undefined"` becomes `observedAtUndefinedBlockCount`.
 * An observed address the classifier calls `code` or `data` is skipped here
 * -- it was already counted in the first walk, and counting it twice would
 * break the identity that every block-covered address falls into EXACTLY one
 * of `disagreementCount` / `agreementCount` / `blockCoveredNeverObservedCount`
 * / `observedAtUndefinedBlockCount`.
 *
 * Never mutates `input.blocks`, `input.observations`, or any of their
 * elements -- both are read only, and no `BlockEntry` is ever constructed
 * from an `EvidExecRow` or vice versa.
 */
export function reconcileObservedExecution(input: EvidReconcileInput): EvidReconciliation {
  const classifier: BlockClassifier = typeof input.classifier === "function" ? input.classifier : blockClassAt;
  const blocks: readonly BlockEntry[] = Array.isArray(input.blocks) ? input.blocks : [];
  const observations: readonly EvidExecRow[] = Array.isArray(input.observations) ? input.observations : [];

  // One pass over the observations: address -> every source bank an
  // observation named at that address, in whatever order the rows arrived.
  // De-duplicated and sorted only where a caller actually receives the list
  // (`EvidDisagreement.sourceBanks`), never here.
  const observationBanks = new Map<number, EvidSourceBank[]>();
  for (const row of observations) {
    if (!row) continue;
    const existing = observationBanks.get(row.address);
    if (existing) {
      existing.push(row.sourceBank);
    } else {
      observationBanks.set(row.address, [row.sourceBank]);
    }
  }

  // The addresses the block table covers -- a `null`/`undefined` hole in
  // `blocks` is skipped, exactly as `blockClassAt` itself skips one, so this
  // module's own defences match the classifier's documented ones (trap 2's
  // boundary is the vocabulary comparison, not this geometric coverage
  // check, which every well-behaved `BlockClassifier` -- production or
  // substituted -- agrees on: both ends inclusive, first-match-wins never
  // changes which addresses are covered, only which class they map to).
  const coveredAddresses = new Set<number>();
  for (const block of blocks) {
    if (!block) continue;
    const start = block.start_address;
    const end = block.end_address;
    if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
    for (let address = start; address <= end; address++) {
      coveredAddresses.add(address);
    }
  }

  const disagreements: EvidDisagreement[] = [];
  let disagreementCount = 0;
  let agreementCount = 0;
  let blockCoveredNeverObservedCount = 0;

  for (const address of coveredAddresses) {
    const byteDerived = classifier(blocks, address);
    const banks = observationBanks.get(address);
    const hasObservation = banks !== undefined && banks.length > 0;

    if (byteDerived === "data") {
      if (hasObservation) {
        disagreements.push({
          address,
          byteDerived: "data",
          runtime: "code",
          sourceBanks: sortSourceBanksAscending(banks!),
        });
        disagreementCount++;
      } else {
        blockCoveredNeverObservedCount++;
      }
    } else if (byteDerived === "code") {
      if (hasObservation) {
        agreementCount++;
      } else {
        blockCoveredNeverObservedCount++;
      }
    } else if (!hasObservation) {
      // byteDerived is "undefined", or (defensively) a substituted classifier
      // failed to classify a geometrically-covered address at all. Neither
      // case was ever claimed as code or data, so an UNOBSERVED address here
      // is exactly the never-observed population -- and an OBSERVED one is
      // deliberately left uncounted here; the walk below names it instead.
      blockCoveredNeverObservedCount++;
    }
  }

  let observedOutsideAnyBlockCount = 0;
  let observedAtUndefinedBlockCount = 0;
  for (const address of observationBanks.keys()) {
    const byteDerived = classifier(blocks, address);
    if (byteDerived === null) {
      observedOutsideAnyBlockCount++;
    } else if (byteDerived === "undefined") {
      observedAtUndefinedBlockCount++;
    }
    // "code" and "data" were already counted in the walk above.
  }

  return {
    disagreements: sortDisagreementsAscending(disagreements),
    disagreementCount,
    agreementCount,
    blockCoveredNeverObservedCount,
    observedOutsideAnyBlockCount,
    observedAtUndefinedBlockCount,
    denominator: coveredAddresses.size,
    positiveClass: "code",
    tier: "runtime-observed",
  };
}
