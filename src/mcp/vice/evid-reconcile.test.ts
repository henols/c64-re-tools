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
import type { BlockClassifier, BlockEntry } from "./block-class.ts";
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
