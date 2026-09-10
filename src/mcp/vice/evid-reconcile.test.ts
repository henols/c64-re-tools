#!/usr/bin/env node
// evid-reconcile.test.ts
//
// Plan 43-04 (EVID-03, EVID-04). HERMETIC: no store, no VICE, no filesystem
// read except this module's own source (Behavior 5's structural assertion).
// Every `BlockEntry`/`EvidExecRow` below is a synthetic object literal built
// by hand, exactly as `dxa-proof01-compare.test.ts` builds its inputs.
//
// Behaviors covered by this file, added across three tasks (numbered so a
// reader sees the coverage without reading every assertion):
//
//   Task 1 (this file's first section):
//     1. one planted disagreement travels through the real join, naming the
//        observed address, with `agreementCount` 0 and `denominator` equal
//        to the block's own covered-address count
//     2. an observation inside a `code`-classified block is `agreementCount`
//        1, with no row array for agreement anywhere in the result
//     3. `disagreements` is the FIRST key of the returned object
//     4. no key anywhere in the result matches a percentage/rate/ratio/score
//        vocabulary
//     5. a structural source assertion: no filesystem, child-process,
//        `node:sqlite` or `toFixed` (outside a comment) anywhere in
//        `evid-reconcile.ts`'s own source
//
//   Task 2:
//     6. a block covered by no observation at all is entirely
//        `blockCoveredNeverObservedCount`
//     7. an observation outside any block is `observedOutsideAnyBlockCount`
//        only
//     8. an observation at an explicitly `undefined` block is
//        `observedAtUndefinedBlockCount` only
//     9. the four block-covered-population counts sum to `denominator`,
//        derived from the inputs rather than pinned by hand
//    10. an empty `blocks` array returns `denominator: 0` and does not throw
//    11. a banned-key recursive walk over the whole result, with a
//        non-vacuity assertion that the walk actually visited nested rows
//    12. every object carrying a `*Count` key also carries `denominator`
//
//   Task 3:
//    13. both range ends inclusive; the address one past `end_address` is
//        covered only by its own block, never by adjacency
//    14. 0x0000 and 0xffff are ordinary addresses, including as a block's own
//        start/end
//    15. an unobserved 0x0000 with no covering block is
//        `observedOutsideAnyBlockCount` only -- the zero address is not a
//        falsy hole
//    16. determinism: two identical calls, and a call over shuffled input,
//        return deep-equal results
//    17. substitutability: a substituted `BlockClassifier` sharing no
//        vocabulary string with either accepted production spelling moves
//        the block-side counts while leaving the observation-side counts
//        unchanged -- proving the two classifiers are independent and that
//        this module never compares a block-type string itself
//    18. frozen inputs: a mutation of either input would throw at the
//        mutation site rather than surface as a silent diff
//    19. a `null` hole inside `blocks` and a non-array `blocks` value are
//        both handled without a `TypeError` escaping this module
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  reconcileObservedExecution,
  type EvidReconcileInput,
  type EvidReconciliation,
} from "./evid-reconcile.ts";
import type { BlockClass, BlockClassifier, BlockEntry } from "./block-class.ts";
import { DATA_TYPES, type EvidExecRow, type EvidSourceBank } from "./anno-types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = join(HERE, "evid-reconcile.ts");

// ---------------------------------------------------------------------------
// Fixture builders -- every input is a synthetic object literal, never read
// from a fixture file.
// ---------------------------------------------------------------------------

let nextObservationId = 1;

/** Builds one synthetic `EvidExecRow`. Every field this module actually
 * reads (`address`, `sourceBank`) is real; the run-identity fields are
 * structurally-required filler a real `listExecObservations()` call would
 * also produce, never load-bearing here. */
function makeObservation(address: number, sourceBank: EvidSourceBank = "rom"): EvidExecRow {
  return {
    id: nextObservationId++,
    imageSha256: "test-image-sha256",
    argvDigest: "test-argv-digest",
    seed: "test-seed",
    address,
    sourceBank,
  };
}

/** Builds one synthetic `BlockEntry`. */
function makeBlock(start_address: number, end_address: number, type: string): BlockEntry {
  return { start_address, end_address, type };
}

// ============================================================================
// Task 1
// ============================================================================

test("Behavior 1: one planted disagreement travels from two plain inputs to a disagreement-first answer", () => {
  const input: EvidReconcileInput = {
    blocks: [makeBlock(0x0810, 0x081f, "Byte")], // "Byte" is not "code"/"undefined" -> falls through to "data"
    observations: [makeObservation(0x0815)],
  };
  const result = reconcileObservedExecution(input);

  assert.equal(result.disagreements.length, 1);
  assert.equal(result.disagreements[0]!.address, 0x0815);
  assert.equal(result.disagreements[0]!.byteDerived, "data");
  assert.equal(result.disagreements[0]!.runtime, "code");
  assert.equal(result.agreementCount, 0);
  assert.equal(result.denominator, 0x081f - 0x0810 + 1);
  assert.equal(result.denominator, 16);
});

test("Behavior 2: an observation inside a code-classified block is agreementCount only -- no agreement row array anywhere", () => {
  const input: EvidReconcileInput = {
    blocks: [makeBlock(0x2000, 0x200f, "code")],
    observations: [makeObservation(0x2005)],
  };
  const result = reconcileObservedExecution(input);

  assert.deepEqual(result.disagreements, []);
  assert.equal(result.agreementCount, 1);

  const asRecord = result as unknown as Record<string, unknown>;
  assert.equal(asRecord.agreementRows, undefined);
  assert.equal(asRecord.agreements, undefined);
  assert.equal(asRecord.agreementAddresses, undefined);
  for (const [key, value] of Object.entries(asRecord)) {
    if (Array.isArray(value)) {
      assert.ok(
        key === "disagreements",
        `found an unexpected array field ${JSON.stringify(key)} -- agreement must never be exposed as a row array`,
      );
    }
  }
});

test("Behavior 3: disagreements is the FIRST key of the returned object", () => {
  const input: EvidReconcileInput = {
    blocks: [makeBlock(0x0810, 0x081f, "Byte")],
    observations: [makeObservation(0x0815)],
  };
  const result = reconcileObservedExecution(input);
  assert.equal(Object.keys(result)[0], "disagreements");
});

test("Behavior 4: no key anywhere in the result matches a percentage/rate/ratio/score vocabulary", () => {
  const input: EvidReconcileInput = {
    blocks: [makeBlock(0x0810, 0x081f, "Byte"), makeBlock(0x2000, 0x200f, "code")],
    observations: [makeObservation(0x0815), makeObservation(0x2005)],
  };
  const result = reconcileObservedExecution(input);

  const banned = /percent|pct|rate|ratio|score/i;
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const v of value) walk(v);
      return;
    }
    if (value === null || typeof value !== "object") return;
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      assert.ok(!banned.test(key), `result key ${JSON.stringify(key)} reads as a percentage/rate/ratio/score`);
      walk(v);
    }
  };
  walk(result);
});

test("Behavior 5: structural source assertion -- no filesystem, child-process, node:sqlite or toFixed", () => {
  const sourceBytes = readFileSync(MODULE_PATH);
  const source = sourceBytes.toString("utf8");

  // Open-quote form (`"fs` / `'fs`), not a closed pair, so a subpath
  // specifier (`"fs/promises"`) is caught too -- mirrors
  // dxa-proof01-compare.test.ts's own structural assertion exactly.
  const bannedSubstrings = ["child_process", "node:fs", '"fs', "'fs", "node:sqlite", "dxa-partition"];
  for (const banned of bannedSubstrings) {
    assert.equal(source.includes(banned), false, `evid-reconcile.ts must never reference ${banned}`);
  }

  const nonCommentLines = source.split("\n").filter((line) => !/^\s*[/*]/.test(line));
  for (const line of nonCommentLines) {
    assert.ok(!line.includes("toFixed"), `no rounding helper allowed (found "toFixed" outside a comment): ${line}`);
  }

  assert.match(source, /from\s+["']\.\/block-class\.ts["']/, "must import from block-class.ts");
  assert.match(source, /from\s+["']\.\/anno-types\.ts["']/, "must import from anno-types.ts");
  assert.ok(source.includes("blockClassAt"), "must reference blockClassAt");

  // No comparison against a literal block-type string on the left of an
  // equality against a `.type` field -- that is block-class.ts's job alone.
  assert.equal(/["'](code|Code|data|Byte|Undefined|undefined)["']\s*===\s*\w+\.type/.test(source), false);
  assert.equal(/\w+\.type\s*===\s*["'](code|Code|data|Byte|Undefined|undefined)["']/.test(source), false);
});

// ============================================================================
// Task 2 -- the third and fourth buckets, and the denominator that makes
// them honest
// ============================================================================

test("Behavior 6: a block covered by no observation at all is entirely blockCoveredNeverObservedCount", () => {
  const input: EvidReconcileInput = {
    blocks: [makeBlock(0x1000, 0x100f, "code")],
    observations: [],
  };
  const result = reconcileObservedExecution(input);

  assert.equal(result.blockCoveredNeverObservedCount, 16);
  assert.equal(result.agreementCount, 0);
  assert.equal(result.disagreementCount, 0);
  assert.equal(result.denominator, 16);
  assert.deepEqual(result.disagreements, []);
});

test("Behavior 7: an observation outside any block increments observedOutsideAnyBlockCount only", () => {
  const input: EvidReconcileInput = {
    blocks: [makeBlock(0x3000, 0x300f, "code")],
    observations: [makeObservation(0x9000)],
  };
  const result = reconcileObservedExecution(input);

  assert.equal(result.observedOutsideAnyBlockCount, 1);
  assert.deepEqual(result.disagreements, []);
  assert.equal(result.agreementCount, 0);
  // The block itself has 16 addresses, none of which received the outside
  // observation, so it is entirely never-observed -- proving the outside
  // observation did not leak into the block-covered accounting at all.
  assert.equal(result.blockCoveredNeverObservedCount, 16);
});

test("Behavior 8: an observation at an explicitly undefined block increments observedAtUndefinedBlockCount only", () => {
  const input: EvidReconcileInput = {
    blocks: [makeBlock(0x6000, 0x6000, "undefined")],
    observations: [makeObservation(0x6000)],
  };
  const result = reconcileObservedExecution(input);

  assert.equal(result.observedAtUndefinedBlockCount, 1);
  assert.equal(result.disagreementCount, 0);
  assert.equal(result.agreementCount, 0);
  assert.equal(result.blockCoveredNeverObservedCount, 0);
  assert.equal(result.observedOutsideAnyBlockCount, 0);
});

test("Behavior 9: the block-covered bucket counts sum to denominator, derived from the inputs rather than pinned by hand", () => {
  const input: EvidReconcileInput = {
    blocks: [
      makeBlock(0x4000, 0x4003, "Byte"), // data: 4 addresses, one observed -> 1 disagreement + 3 never-observed
      makeBlock(0x5000, 0x5003, "code"), // code: 4 addresses, one observed -> 1 agreement + 3 never-observed
      makeBlock(0x6000, 0x6003, "undefined"), // undefined: 4 addresses, one observed -> 1 undefined-observed + 3 never-observed
    ],
    observations: [
      makeObservation(0x4000),
      makeObservation(0x5000),
      makeObservation(0x6000),
      makeObservation(0x9999), // outside every block -- must NOT enter this identity
    ],
  };
  const result = reconcileObservedExecution(input);

  assert.equal(result.denominator, 12);
  assert.equal(result.disagreementCount, 1);
  assert.equal(result.agreementCount, 1);
  assert.equal(result.observedAtUndefinedBlockCount, 1);
  assert.equal(result.blockCoveredNeverObservedCount, 9);
  assert.equal(result.observedOutsideAnyBlockCount, 1);

  // The identity: every block-covered address falls into EXACTLY one of
  // these four buckets. observedOutsideAnyBlockCount is deliberately NOT a
  // term here -- it counts addresses the block table does not cover at all,
  // so it is not a fraction of denominator and must not be added to it.
  const blockCoveredSum =
    result.disagreementCount +
    result.agreementCount +
    result.blockCoveredNeverObservedCount +
    result.observedAtUndefinedBlockCount;
  assert.equal(blockCoveredSum, result.denominator);
});

test("Behavior 10: an empty blocks array returns denominator 0 without throwing, with every block-covered count 0", () => {
  const input: EvidReconcileInput = {
    blocks: [],
    observations: [makeObservation(0x1234), makeObservation(0x5678)],
  };

  let reconciled!: EvidReconciliation;
  assert.doesNotThrow(() => {
    reconciled = reconcileObservedExecution(input);
  });

  assert.equal(reconciled.denominator, 0);
  assert.equal(reconciled.disagreementCount, 0);
  assert.equal(reconciled.agreementCount, 0);
  assert.equal(reconciled.blockCoveredNeverObservedCount, 0);
  assert.equal(reconciled.observedAtUndefinedBlockCount, 0);
  assert.equal(reconciled.observedOutsideAnyBlockCount, 2);
  assert.deepEqual(reconciled.disagreements, []);
});

/** The banned-key vocabulary, named once so it is readable in one place. */
const BANNED_SUMMARY_VOCABULARY =
  /overall|combined|aggregate|composite|score|headline|percent|pct|rate|ratio|fraction|exhaustive|complete|totalcoverage|totalclassified/i;

test("Behavior 11: a recursive key walk over the whole result finds no key matching the banned summary vocabulary", () => {
  const input: EvidReconcileInput = {
    blocks: [makeBlock(0x7000, 0x7000, "Byte")],
    observations: [makeObservation(0x7000)],
  };
  const result = reconcileObservedExecution(input);

  const seen: string[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const v of value) walk(v);
      return;
    }
    if (value === null || typeof value !== "object") return;
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      seen.push(key);
      assert.ok(
        !BANNED_SUMMARY_VOCABULARY.test(key),
        `result key ${JSON.stringify(key)} reads as an aggregate/rate/coverage figure -- EVID-03/EVID-04 forbid one`,
      );
      walk(v);
    }
  };
  walk(result);

  const topLevelKeyCount = Object.keys(result).length;
  assert.ok(
    seen.length > topLevelKeyCount,
    `the key walk visited only ${seen.length} keys (top level alone has ${topLevelKeyCount}) -- it must actually descend into the nested disagreement rows, not stop at the top level`,
  );
});

test("Behavior 12: every object carrying a *Count key also carries denominator", () => {
  const input: EvidReconcileInput = {
    blocks: [
      makeBlock(0x4000, 0x4003, "Byte"),
      makeBlock(0x5000, 0x5003, "code"),
      makeBlock(0x6000, 0x6003, "undefined"),
    ],
    observations: [makeObservation(0x4000), makeObservation(0x5000), makeObservation(0x6000), makeObservation(0x9999)],
  };
  const result = reconcileObservedExecution(input);

  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const v of value) walk(v);
      return;
    }
    if (value === null || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const hasCountKey = Object.keys(record).some((key) => key.endsWith("Count"));
    if (hasCountKey) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(record, "denominator"),
        `an object carrying a *Count key must also carry denominator, found keys: ${Object.keys(record).join(", ")}`,
      );
    }
    for (const v of Object.values(record)) walk(v);
  };
  walk(result);
});

// ============================================================================
// Task 3 -- boundaries, determinism, and the independence the disagreement
// signal rests on
// ============================================================================

test("Behavior 13: end_address is covered; end_address + 1 is covered ONLY by its own block, never by adjacency", () => {
  const observations = [makeObservation(0x2000), makeObservation(0x2001)];

  // Part A: only 0x2000 has a covering block. The address one past it
  // (0x2001) must NOT be swept in by adjacency to the first block.
  const onlyFirstCovered = reconcileObservedExecution({
    blocks: [makeBlock(0x2000, 0x2000, "Byte")],
    observations,
  });
  assert.equal(onlyFirstCovered.disagreementCount, 1);
  assert.deepEqual(
    onlyFirstCovered.disagreements.map((d) => d.address),
    [0x2000],
  );
  assert.equal(onlyFirstCovered.observedOutsideAnyBlockCount, 1, "0x2001 has no covering block of its own yet");

  // Part B: 0x2001 gets its OWN block. Now it is covered too -- proving the
  // coverage came from the new block, not from proximity to the first one.
  const bothCovered = reconcileObservedExecution({
    blocks: [makeBlock(0x2000, 0x2000, "Byte"), makeBlock(0x2001, 0x2001, "Byte")],
    observations,
  });
  assert.equal(bothCovered.disagreementCount, 2);
  assert.deepEqual(
    bothCovered.disagreements.map((d) => d.address),
    [0x2000, 0x2001],
  );
  assert.equal(bothCovered.observedOutsideAnyBlockCount, 0);
});

test("Behavior 14: 0x0000 and 0xffff are ordinary addresses, including as a block's own start/end", () => {
  const result = reconcileObservedExecution({
    blocks: [makeBlock(0x0000, 0x0000, "Byte"), makeBlock(0xffff, 0xffff, "Byte")],
    observations: [makeObservation(0x0000), makeObservation(0xffff)],
  });

  assert.equal(result.disagreementCount, 2);
  assert.deepEqual(
    result.disagreements.map((d) => d.address),
    [0x0000, 0xffff],
  );
  assert.equal(result.denominator, 2);
});

test("Behavior 15: an unobserved-by-any-block 0x0000 is observedOutsideAnyBlockCount only -- the zero address is not a falsy hole", () => {
  const result = reconcileObservedExecution({
    blocks: [],
    observations: [makeObservation(0x0000)],
  });

  assert.equal(result.observedOutsideAnyBlockCount, 1);
  assert.equal(result.disagreementCount, 0);
  assert.equal(result.agreementCount, 0);
  assert.equal(result.blockCoveredNeverObservedCount, 0);
  assert.equal(result.observedAtUndefinedBlockCount, 0);
  assert.equal(result.denominator, 0);
});

test("Behavior 16: determinism -- two identical calls, and a call over shuffled input order, return deep-equal results", () => {
  const blocks = [
    makeBlock(0x8000, 0x8003, "Byte"),
    makeBlock(0x9000, 0x9003, "code"),
    makeBlock(0xa000, 0xa003, "undefined"),
  ];
  const observations = [
    makeObservation(0x8000, "ram"),
    makeObservation(0x8000, "rom"),
    makeObservation(0x9000, "io"),
    makeObservation(0xa000, "ram"),
    makeObservation(0xb000, "rom"), // outside every block
  ];

  const first = reconcileObservedExecution({ blocks, observations });
  const second = reconcileObservedExecution({ blocks, observations });
  assert.deepEqual(first, second, "two identical calls must return deep-equal results");

  const shuffled = reconcileObservedExecution({
    blocks: [...blocks].reverse(),
    observations: [...observations].reverse(),
  });
  assert.deepEqual(first, shuffled, "shuffled input order must not leak into the answer -- every array is sorted");
});

// ---------------------------------------------------------------------------
// Substitutability (Behavior 17) -- the load-bearing proof that the two
// classifiers are independent and that this module never compares a
// block-type string itself.
//
// WHY THE SUBSTITUTED VOCABULARY SHARES NO STRING WITH EITHER ACCEPTED ONE:
// mirrors anno-coverage.test.ts's own derivation exactly (its "Substitut-
// ability" section). Zero overlap is what makes a comparison site LEFT
// BEHIND in this module observable: fed a block spelled in a production
// vocabulary, a left-behind raw-string comparison would agree with the
// injected classifier by accident and hide. Fed a block spelled in a
// vocabulary neither accepted spelling recognizes, it disagrees, and the
// bucket the address falls into stops moving between the two calls below --
// which is exactly the assertion that would then go red. The independence
// this proof rests on is the whole reason a disagreement signal (EVID-03)
// means anything: if this module colluded with block-class.ts's own
// vocabulary, "the byte-derived side said data" and "this module also
// thinks it is data" would be the same fact stated twice, not two
// independent classifiers agreeing to disagree with a third, the runtime
// evidence.
// ---------------------------------------------------------------------------

/** The external analyser's four capitalised spellings, hand-written because
 * the analyser is external and has no importable vocabulary in this tree --
 * mirrors block-class.test.ts's own ANALYSER_* constants and
 * anno-coverage.test.ts's ANALYSER_BLOCK_SPELLINGS. */
const ANALYSER_BLOCK_SPELLINGS: readonly string[] = ["Code", "Undefined", "Byte", "Address"];

/** Both accepted production vocabularies, DERIVED and de-duplicated -- read
 * from their single frozen home (`DATA_TYPES`) rather than hand-written, so
 * this disjointness proof cannot go stale the moment either vocabulary
 * grows. */
const PRODUCTION_BLOCK_SPELLINGS: readonly string[] = [...new Set<string>([...ANALYSER_BLOCK_SPELLINGS, ...DATA_TYPES])];

/** The substituted vocabulary. Every spelling is chosen to collide with
 * nothing in `PRODUCTION_BLOCK_SPELLINGS` -- verified below before use. */
const SUBSTITUTED_BLOCK_SPELLINGS: Record<BlockClass, string> = {
  code: "EVIDENCE_RECONCILE_TEST_CODE_SPELLING",
  undefined: "EVIDENCE_RECONCILE_TEST_UNDEFINED_SPELLING",
  data: "EVIDENCE_RECONCILE_TEST_DATA_SPELLING",
};

/** A second, complete `BlockClassifier` implementation: same inclusive-range,
 * first-match-wins scan as `blockClassAt`, a completely different
 * vocabulary. Driven through `EvidReconcileInput.classifier` -- the real
 * injectable seam -- rather than a copy of `reconcileObservedExecution`'s
 * own join logic. */
const substitutedBlockClassAt: BlockClassifier = (blocks, address) => {
  for (const block of blocks) {
    if (!block) continue;
    if (address >= block.start_address && address <= block.end_address) {
      if (block.type === SUBSTITUTED_BLOCK_SPELLINGS.code) return "code";
      if (block.type === SUBSTITUTED_BLOCK_SPELLINGS.undefined) return "undefined";
      return "data";
    }
  }
  return null;
};

test("substitutability: the production union is derived and non-vacuous, and the substituted vocabulary shares no string with either accepted one", () => {
  // Non-vacuity FIRST: if the two accepted vocabularies quietly overlapped,
  // or the union collapsed via de-duplication, the disjointness assertion
  // below could pass while covering less than it claims to.
  assert.equal(
    PRODUCTION_BLOCK_SPELLINGS.length,
    new Set(PRODUCTION_BLOCK_SPELLINGS).size,
    "the derived union contains a duplicate",
  );
  assert.equal(
    PRODUCTION_BLOCK_SPELLINGS.length,
    ANALYSER_BLOCK_SPELLINGS.length + DATA_TYPES.length,
    "the analyser's four spellings and the store's twelve must not overlap -- if they did, the union above would " +
      "be shorter than the sum of both",
  );

  const shared = Object.values(SUBSTITUTED_BLOCK_SPELLINGS).filter((spelling) =>
    PRODUCTION_BLOCK_SPELLINGS.includes(spelling),
  );
  assert.deepEqual(
    shared,
    [],
    "the substituted vocabulary shares a spelling with a production one -- a comparison site left behind in " +
      "evid-reconcile.ts could then agree with the injected classifier by accident and hide from the proof below",
  );
});

test("Behavior 17: a substituted BlockClassifier moves the block-side bucket while leaving the geometry-derived counts unchanged, proving classifier independence", () => {
  const block = makeBlock(0x2200, 0x2200, SUBSTITUTED_BLOCK_SPELLINGS.code);
  const input: EvidReconcileInput = { blocks: [block], observations: [makeObservation(0x2200)] };

  // Default classifier (blockClassAt): does not recognise the substituted
  // spelling, falls through to "data" -- a disagreement.
  const withProductionClassifier = reconcileObservedExecution(input);
  assert.equal(withProductionClassifier.disagreementCount, 1);
  assert.equal(withProductionClassifier.agreementCount, 0);

  // Substituted classifier: recognises the SAME block.type string as "code"
  // -- an agreement. The block's raw type string never changed; only the
  // classifier interpreting it did, driven through the injectable seam.
  const withSubstitutedClassifier = reconcileObservedExecution({ ...input, classifier: substitutedBlockClassAt });
  assert.equal(withSubstitutedClassifier.disagreementCount, 0);
  assert.equal(withSubstitutedClassifier.agreementCount, 1);

  // The geometry-derived side of the answer never moves: this module never
  // reads block.type itself, so which vocabulary is in play cannot change
  // how many addresses the block table covers, nor how many observations
  // fall entirely outside every block.
  assert.equal(withProductionClassifier.denominator, withSubstitutedClassifier.denominator);
  assert.equal(
    withProductionClassifier.observedOutsideAnyBlockCount,
    withSubstitutedClassifier.observedOutsideAnyBlockCount,
  );
});

test("Behavior 18: frozen inputs -- a mutation of either input would throw at the mutation site rather than surface as a silent diff", () => {
  const block = Object.freeze(makeBlock(0x2400, 0x2403, "Byte"));
  const blocks = Object.freeze([block]);
  const observation = Object.freeze(makeObservation(0x2400));
  const observations = Object.freeze([observation]);

  let result!: EvidReconciliation;
  assert.doesNotThrow(() => {
    result = reconcileObservedExecution({ blocks, observations });
  });
  assert.equal(result.disagreementCount, 1);
  assert.equal(result.denominator, 4);

  // Frozen inputs themselves refuse mutation -- proving this module never
  // attempted one (a non-frozen input would not have caught it).
  assert.throws(() => {
    (block as { start_address: number }).start_address = 0x0000;
  });
  assert.throws(() => {
    (blocks as unknown as BlockEntry[]).push(makeBlock(0, 0, "Byte"));
  });
});

test("Behavior 19: a null hole inside blocks and a non-array blocks value are both handled without a TypeError escaping this module", () => {
  const withNullHole = reconcileObservedExecution({
    blocks: [null as unknown as BlockEntry, makeBlock(0x2500, 0x2500, "code")],
    observations: [makeObservation(0x2500)],
  });
  assert.equal(withNullHole.agreementCount, 1);
  assert.equal(withNullHole.denominator, 1);

  let nonArrayResult!: EvidReconciliation;
  assert.doesNotThrow(() => {
    nonArrayResult = reconcileObservedExecution({
      blocks: "not an array" as unknown as BlockEntry[],
      observations: [makeObservation(0x2600)],
    });
  });
  assert.equal(nonArrayResult.denominator, 0);
  assert.equal(nonArrayResult.observedOutsideAnyBlockCount, 1);
});
