#!/usr/bin/env node
// join-image-controls.test.ts
//
// Phase 37, plan 37-05: two observed-red controls, each its own task and its
// own commit, per `.planning/research/PITFALLS.md` Pitfall 23 -- a red
// observation is its own committed deliverable, never batched together with
// the fix that makes it green again. Both cases mutate a SCRATCH copy only;
// the committed `anno-join.ts`, `memmap-lookup.ts` and `memmap.json` are
// never opened for writing by this file.
//
// Task 1 (AUTO-03, the phase's required control #4): deletes
// `runMemmapJoin()`'s in-image early-return guard in a scratch copy of
// `anno-join.ts` and observes an ordinary, map-covered in-image address
// start annotating as a machine feature -- with an injected COUNTING
// selection spy proving the map lookup is genuinely REACHED under the
// mutation and genuinely UNREACHED under the committed code, so the claim
// is about control flow, not merely about the result a caller sees back
// (D-37-17).
//
// Task 2 (AUTO-08, an EXTRA control -- not one of the phase's six required
// ones, landed in a separate commit that follows this one): mirrors the
// repository shape three levels deep, mutates a COPY of `memmap.json` by one
// appended byte, and shows the resulting `memmapDigest()` differs from the
// digest a previously-written comment carries -- proving the provenance
// token actually discriminates map versions rather than being a decoration
// nobody has seen change (D-37-19).
//
// D-37-20: this file duplicates `memmap-lookup-controls.test.ts`'s (plan
// 37-04) scratch-tree helper SHAPE rather than importing a shared module --
// 37-04 and 37-05 run in the SAME wave and must not share a file, which a
// shared helper module would force them to do. The duplication here is
// deliberate, not an oversight.
//
// Task 1's scratch tree does NOT need Task 2's three-level repo-shape
// mirror at all: only `anno-join.ts` itself is mutated, and its two sibling
// imports (`anno-store.ts`, `memmap-lookup.ts`) are satisfied by tiny
// RE-EXPORT SHIMS that forward to the real, absolute, unmutated files -- so
// the mutated join calls the exact SAME real store functions and the exact
// SAME real memmap-lookup functions this test file itself uses statically,
// with no need to drag `anno-store.ts`'s own deep dependency chain
// (`anno-index.ts`, `anno-confidence.ts`, `vice.ts`, `node:sqlite`, ...)
// into a scratch copy just to resolve one import. Task 2's provenance
// control DOES need the three-level mirror, because it mutates
// `memmap.json` itself and `memmap-lookup.ts`'s own `MEMMAP_PATH` formula
// is `HERE`-relative.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { closeStore, openStore, putXref } from "./anno-store.ts";
import { runMemmapJoin } from "./anno-join.ts";
import { selectMemmapEntry } from "./memmap-lookup.ts";
import type { MemmapEntry, MemmapSelection } from "./memmap-lookup.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_ANNO_JOIN_PATH = join(HERE, "anno-join.ts");
const REAL_ANNO_STORE_PATH = join(HERE, "anno-store.ts");
const REAL_MEMMAP_LOOKUP_PATH = join(HERE, "memmap-lookup.ts");

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// ---------------------------------------------------------------------------
// Task 1 (AUTO-03): the in-image guard's committed text, held verbatim
// (D-37-18: the mutation is a DELETION of exactly this block, nothing else).
// Copied character-for-character from `anno-join.ts` at plan time.
// ---------------------------------------------------------------------------

const IN_IMAGE_GUARD_LINES = [
  "    if (address >= imageStart && address <= imageEnd) {",
  "      skippedInImage += 1;",
  "      decisions.push({",
  "        address,",
  '        outcome: "skipped-in-image",',
  "        reason:",
  "          `address $${address.toString(16)} lies inside the loaded image's own range ($${imageStart.toString(16)}-` +",
  "          `$${imageEnd.toString(16)}) and is therefore a program address, never looked up in memmap.json`,",
  "      });",
  "      continue;",
  "    }",
];
const IN_IMAGE_GUARD_TEXT = IN_IMAGE_GUARD_LINES.join("\n");

/** Builds a scratch tree holding ONE mutated copy of `anno-join.ts` (the
 * in-image guard block deleted, nothing else touched) plus tiny re-export
 * shims for its two sibling imports, so the dynamic import resolves without
 * dragging `anno-store.ts`'s own deep dependency chain into a scratch copy.
 * Asserts the committed source still carries the guard's exact text before
 * mutating, so source drift fails the case by name rather than silently
 * no-op-ing the mutation. Returns the scratch root (remove in the caller's
 * own `finally`) and the mutated module's path (dynamically import with a
 * cache-busting query). */
function buildScratchAnnoJoinModule(): { tmpDir: string; modulePath: string } {
  const tmpDir = makeTempDir("join-image-controls-");

  const committedSource = fs.readFileSync(REAL_ANNO_JOIN_PATH, "utf8");
  assert.ok(
    committedSource.includes(IN_IMAGE_GUARD_TEXT),
    "expected the committed anno-join.ts to still carry the in-image guard's committed form -- has the source drifted?",
  );
  const mutatedSource = committedSource.replace(IN_IMAGE_GUARD_TEXT, "");
  assert.ok(!mutatedSource.includes(IN_IMAGE_GUARD_TEXT), "expected the guard's text to be gone from the mutated source");

  fs.writeFileSync(path.join(tmpDir, "anno-join.ts"), mutatedSource, "utf8");
  // Re-export shims: forward, by absolute path, to the REAL anno-store.ts /
  // memmap-lookup.ts -- so the mutated join calls the exact SAME real
  // functions this test file itself imports statically, with no duplicated
  // store logic and no dragged-in dependency chain.
  fs.writeFileSync(path.join(tmpDir, "anno-store.ts"), `export * from ${JSON.stringify(REAL_ANNO_STORE_PATH)};\n`, "utf8");
  fs.writeFileSync(
    path.join(tmpDir, "memmap-lookup.ts"),
    `export * from ${JSON.stringify(REAL_MEMMAP_LOOKUP_PATH)};\n`,
    "utf8",
  );

  return { tmpDir, modulePath: path.join(tmpDir, "anno-join.ts") };
}

/** Dynamic-imports the scratch tree's mutated `anno-join.ts` with a
 * cache-busting query, exactly as `memmap-lookup-controls.test.ts`'s own
 * planted-violation cases do. */
async function importScratchAnnoJoin(modulePath: string): Promise<{ runMemmapJoin: typeof runMemmapJoin }> {
  return (await import(`${modulePath}?t=${Date.now()}-${Math.random()}`)) as { runMemmapJoin: typeof runMemmapJoin };
}

test(
  'PLANTED VIOLATION: deleting runMemmapJoin\'s in-image guard makes an ordinary, map-covered in-image address ($0800, "Unused") annotate as a machine feature, with the injected selection spy proving the guard is control flow, not result filtering',
  async () => {
    // The in-image subject: $0800 (2048), the BASIC area's own first byte --
    // covered by memmap.json's real 1-byte "Unused" entry (MEASURED at
    // execution time below: 2 containing entries, the WIDTH step decides).
    // Chosen per this plan's own <read_first> instruction: a low BASIC-area
    // address the map has something to say about, in the spirit of
    // `fixtures/ghidra/bank.a`'s own `cpchar` loop-back shape -- an ordinary
    // program address the requirement's own failure story says an early
    // attempt mistook for a machine feature (AUTO-02's `$D020`/`$0000`
    // fixtures are real hardware addresses and would prove nothing here,
    // since the point is a PROGRAM address the map merely happens to cover).
    const IN_IMAGE_SUBJECT = 0x0800;
    // The out-of-image subject: a genuine machine address, well outside the
    // synthetic image range below -- proves the guard is SELECTIVE, not a
    // total on/off switch.
    const OUT_OF_IMAGE_SUBJECT = 0xd020;
    const IMAGE_ORIGIN = 0x07f0;
    const IMAGE_BYTE_LENGTH = 0x20; // covers $07f0-$080f; IN_IMAGE_SUBJECT sits inside, not at either edge

    // MEASURED at execution time, over the real, committed memmap.json:
    // $0800 has 2 containing entries, of which exactly one is 1 byte wide
    // ("Unused") -- the WIDTH step decides. This is the specific
    // machine-feature label asserted below, not merely "a different label".
    const measuredSelection = selectMemmapEntry(IN_IMAGE_SUBJECT);
    assert.ok(measuredSelection, "expected the committed map to have SOMETHING to say about $0800 -- an address the map does not cover would prove nothing here");
    assert.equal(measuredSelection.width, 0, "expected $0800's narrowest containing entry to be 1 byte wide -- has the map drifted?");
    assert.equal(measuredSelection.entry.label, "Unused", "expected $0800's specific machine-feature label -- has the map drifted?");
    assert.equal(measuredSelection.contenderCount, 2, "expected $0800 to have exactly 2 containing entries -- has the map drifted?");

    // ---- THE COMMITTED RUN (statically imported, unmutated code) ----
    const committedDir = makeTempDir("join-image-controls-committed-");
    let committedDecisions: Map<number, { outcome: string; reason?: string; label?: string }>;
    const committedSpyCalls: number[] = [];
    try {
      const handle = openStore(path.join(committedDir, "proj.annostore"), { workspaceRoot: committedDir });
      try {
        putXref(handle, { fromAddress: 0x0000, toAddress: IN_IMAGE_SUBJECT, accessKind: "WRITE" });
        putXref(handle, { fromAddress: 0x0000, toAddress: OUT_OF_IMAGE_SUBJECT, accessKind: "WRITE" });
        const spy = (address: number, entries: readonly MemmapEntry[]): MemmapSelection | undefined => {
          committedSpyCalls.push(address);
          // The spy only COUNTS -- it delegates to the real selection so the
          // out-of-image address is still genuinely annotated, never faked.
          return selectMemmapEntry(address, entries);
        };
        const { decisions } = runMemmapJoin(handle, { imageOrigin: IMAGE_ORIGIN, imageByteLength: IMAGE_BYTE_LENGTH }, undefined, spy);
        committedDecisions = new Map(decisions.map((d) => [d.address, d]));
      } finally {
        closeStore(handle);
      }
    } finally {
      fs.rmSync(committedDir, { recursive: true, force: true });
    }

    const committedInImage = committedDecisions.get(IN_IMAGE_SUBJECT);
    assert.equal(committedInImage?.outcome, "skipped-in-image", "expected the committed code to skip the in-image subject before any map lookup");
    assert.ok(
      committedInImage?.reason && /never looked up/.test(committedInImage.reason),
      `expected the committed skip reason to name the in-image skip: ${committedInImage?.reason}`,
    );
    assert.equal(
      committedSpyCalls.includes(IN_IMAGE_SUBJECT),
      false,
      "expected the committed code to NEVER reach the selection function for the in-image subject",
    );
    const committedOutOfImage = committedDecisions.get(OUT_OF_IMAGE_SUBJECT);
    assert.equal(committedOutOfImage?.outcome, "annotated", "expected the out-of-image machine address to be annotated under the committed code");
    assert.ok(committedSpyCalls.includes(OUT_OF_IMAGE_SUBJECT), "expected the committed code to reach the selection function for the out-of-image address");

    // ---- THE MUTATED RUN (dynamically imported scratch copy, guard deleted) ----
    const { tmpDir, modulePath } = buildScratchAnnoJoinModule();
    try {
      const mutated = await importScratchAnnoJoin(modulePath);
      const mutatedDir = makeTempDir("join-image-controls-mutated-");
      try {
        const handle = openStore(path.join(mutatedDir, "proj.annostore"), { workspaceRoot: mutatedDir });
        try {
          putXref(handle, { fromAddress: 0x0000, toAddress: IN_IMAGE_SUBJECT, accessKind: "WRITE" });
          putXref(handle, { fromAddress: 0x0000, toAddress: OUT_OF_IMAGE_SUBJECT, accessKind: "WRITE" });
          const mutatedSpyCalls: number[] = [];
          const spy = (address: number, entries: readonly MemmapEntry[]): MemmapSelection | undefined => {
            mutatedSpyCalls.push(address);
            return selectMemmapEntry(address, entries);
          };
          const { decisions } = mutated.runMemmapJoin(
            handle,
            { imageOrigin: IMAGE_ORIGIN, imageByteLength: IMAGE_BYTE_LENGTH },
            undefined,
            spy,
          );
          const mutatedDecisions = new Map(decisions.map((d) => [d.address, d]));

          const mutatedInImage = mutatedDecisions.get(IN_IMAGE_SUBJECT);
          assert.equal(mutatedInImage?.outcome, "annotated", "expected the DELETION to make the in-image subject annotate rather than skip");
          assert.equal(
            mutatedInImage?.label,
            measuredSelection.entry.label,
            "expected the mutated run's label to equal the measured, specific machine-feature label",
          );
          assert.ok(
            mutatedSpyCalls.includes(IN_IMAGE_SUBJECT),
            "expected the DELETION to make the selection function genuinely REACH the in-image subject at least once",
          );

          const mutatedOutOfImage = mutatedDecisions.get(OUT_OF_IMAGE_SUBJECT);
          assert.equal(
            mutatedOutOfImage?.outcome,
            "annotated",
            "expected the out-of-image machine address to STILL be annotated under the mutation -- selectivity, not a total on-off switch",
          );
        } finally {
          closeStore(handle);
        }
      } finally {
        fs.rmSync(mutatedDir, { recursive: true, force: true });
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  },
);
