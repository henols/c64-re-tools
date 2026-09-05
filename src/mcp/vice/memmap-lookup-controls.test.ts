#!/usr/bin/env node
// memmap-lookup-controls.test.ts
//
// Phase 37, plan 37-04 (AUTO-02's three observed-red controls, PITFALLS.md
// Pitfall 23): each case here plants ONE named violation into a SCRATCH copy
// of `memmap-lookup.ts` -- never the committed module -- and asserts the
// SPECIFIC wrong answer the violation produces, not merely that the answer
// differs from the correct one. The committed `memmap-lookup.ts` is never
// opened for writing; each case asserts, before mutating, that the committed
// source still contains the exact text it is about to replace in the scratch
// copy, so source drift fails the case by name instead of silently
// no-op-ing the mutation.
//
// Pattern copied from `anno-regbits.test.ts`'s scratch-tree / mirrored-depth /
// dynamic-import-with-cache-buster case (D-37-14), and from
// `sleigh-compile-gate.test.ts`'s planted-violation shape (assert the
// specific named signal, tear down in a `finally`, never touch the committed
// tree). Each case's own committed transcript lives under
// `.planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/`.
//
// THIS FILE MUST NEVER MUTATE `memmap-lookup.ts` ON DISK. Every mutation
// happens inside an `mkdtempSync` root, mirroring the real repo shape three
// levels deep (`src/mcp/vice` next to `src/skills/c64-memory-mapping`, both
// under one temporary root) so the module's own `HERE`-relative `MEMMAP_PATH`
// formula resolves the same way there as it does against the real tree.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { selectMemmapEntry, loadMemmap } from "./memmap-lookup.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_MODULE_PATH = join(HERE, "memmap-lookup.ts");
const REAL_MEMMAP_PATH = join(HERE, "..", "..", "..", "src", "skills", "c64-memory-mapping", "memmap.json");

/** `memmap-lookup.ts`'s own `inclusiveWidth()` is unexported (private to the
 * module) -- this test-local copy computes the SAME `end - start` value from
 * a plain entry, for measuring expected winners against the real,
 * unmutated `memmap.json` before comparing to a scratch module's answer. */
function inclusiveWidthOf(entry: { start: number; end: number }): number {
  return entry.end - entry.start;
}

// ---------------------------------------------------------------------------
// The committed forms of the two mutable steps `selectMemmapEntry()` calls,
// held verbatim so a drifted source fails the case by name rather than making
// a `.replace()` a silent no-op. Copied character-for-character from
// `memmap-lookup.ts` at plan time.
// ---------------------------------------------------------------------------

/** STEP ONE, WIDTH -- the committed form (`memmap-lookup.ts:169-176`). */
const COMMITTED_WIDTH_STEP =
  "function narrowestWidthSurvivors(containing: readonly MemmapEntry[]): MemmapEntry[] {\n" +
  "  let minWidth = Infinity;\n" +
  "  for (const entry of containing) {\n" +
  "    const width = inclusiveWidth(entry);\n" +
  "    if (width < minWidth) minWidth = width;\n" +
  "  }\n" +
  "  return containing.filter((entry) => inclusiveWidth(entry) === minWidth);\n" +
  "}";

/** Task 1's mutation: first-match selection -- return the first containing
 * entry found, in scan order, without comparing widths at all. */
const MUTATED_WIDTH_STEP_FIRST_MATCH =
  "function narrowestWidthSurvivors(containing: readonly MemmapEntry[]): MemmapEntry[] {\n" +
  "  return [containing[0]!];\n" +
  "}";

/** Task 2's mutation: longest-description selection -- prefer the containing
 * entry whose `desc` string is longest, an order-independent wrong rule. */
const MUTATED_WIDTH_STEP_LONGEST_DESC =
  "function narrowestWidthSurvivors(containing: readonly MemmapEntry[]): MemmapEntry[] {\n" +
  "  let winner = containing[0]!;\n" +
  "  for (const entry of containing) {\n" +
  "    if (entry.desc.length > winner.desc.length) winner = entry;\n" +
  "  }\n" +
  "  return [winner];\n" +
  "}";

/** STEP TWO, SYMBOL -- the committed form (`memmap-lookup.ts:186-189`). */
const COMMITTED_SYMBOL_STEP =
  "function symbolSurvivors(survivors: readonly MemmapEntry[]): MemmapEntry[] {\n" +
  '  const withSym = survivors.filter((entry) => typeof entry.sym === "string" && entry.sym.length > 0);\n' +
  "  return withSym.length > 0 ? withSym : survivors.slice();\n" +
  "}";

/** Task 3's mutation: reverse the symbol tie-break -- among equal-width
 * contenders, prefer the entry WITHOUT a `sym` over one that has one. */
const MUTATED_SYMBOL_STEP_REVERSED =
  "function symbolSurvivors(survivors: readonly MemmapEntry[]): MemmapEntry[] {\n" +
  '  const withoutSym = survivors.filter((entry) => !(typeof entry.sym === "string" && entry.sym.length > 0));\n' +
  "  return withoutSym.length > 0 ? withoutSym : survivors.slice();\n" +
  "}";

/** STEP THREE, ORDER -- the committed form (`memmap-lookup.ts:204-211`), held
 * here ONLY to assert Task 3's mutation leaves it (and the WIDTH step)
 * byte-identical in the scratch copy -- the reversed-symbol control must be
 * attributable to the SYMBOL step alone. */
const COMMITTED_ORDER_STEP =
  "function orderWinner(survivors: readonly MemmapEntry[], entries: readonly MemmapEntry[]): MemmapEntry {\n" +
  "  for (const entry of entries) {\n" +
  "    if (survivors.includes(entry)) return entry;\n" +
  "  }\n" +
  "  // Unreachable: `survivors` is always drawn from `entries` by reference, so\n" +
  "  // the scan above always finds one before falling through.\n" +
  "  return survivors[0]!;\n" +
  "}";

// ---------------------------------------------------------------------------
// Shared scratch-tree helper (D-37-15: three tasks, three transcripts, one
// shared test-file convenience). Mirrors `anno-regbits.test.ts`'s own
// mirrored-depth scratch tree: `src/skills/c64-memory-mapping/memmap.json`
// (the REAL, unmutated bytes -- only the selection CODE is ever mutated)
// next to `src/mcp/vice/memmap-lookup.ts` (the ONE mutated copy), both under
// one `mkdtempSync` root that this host's RAM-backed `/tmp` never ages.
// ---------------------------------------------------------------------------

/** Builds a scratch tree containing a mutated copy of `memmap-lookup.ts` and
 * the REAL, unmutated `memmap.json` at the depth its `HERE`-relative
 * `MEMMAP_PATH` formula expects. `mutate` receives the real committed source
 * text and returns the text to write into the scratch copy -- the real file
 * on disk is only ever READ, never opened for writing. Returns the scratch
 * root (to remove in the caller's own `finally`) and the mutated module's
 * path (to dynamically import with a cache-busting query). */
function buildScratchMemmapModule(mutate: (committedSource: string) => string): { tmpDir: string; modulePath: string } {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "memmap-lookup-controls-"));
  const skillsDir = path.join(tmpDir, "src", "skills", "c64-memory-mapping");
  fs.mkdirSync(skillsDir, { recursive: true });
  const mcpDir = path.join(tmpDir, "src", "mcp", "vice");
  fs.mkdirSync(mcpDir, { recursive: true });

  fs.copyFileSync(REAL_MEMMAP_PATH, path.join(skillsDir, "memmap.json"));

  const committedSource = fs.readFileSync(REAL_MODULE_PATH, "utf8");
  const mutatedSource = mutate(committedSource);
  const modulePath = path.join(mcpDir, "memmap-lookup.ts");
  fs.writeFileSync(modulePath, mutatedSource, "utf8");

  return { tmpDir, modulePath };
}

/** Dynamic-imports a scratch-tree module with a cache-busting query, exactly
 * as `anno-regbits.test.ts`'s own planted-violation case does. */
async function importScratchModule(modulePath: string): Promise<{ selectMemmapEntry: typeof selectMemmapEntry; loadMemmap: typeof loadMemmap }> {
  return (await import(`${modulePath}?t=${Date.now()}-${Math.random()}`)) as {
    selectMemmapEntry: typeof selectMemmapEntry;
    loadMemmap: typeof loadMemmap;
  };
}

// ---------------------------------------------------------------------------
// Task 1: first-match selection reddens narrowest-range-wins at $D020.
// ---------------------------------------------------------------------------

test(
  'PLANTED VIOLATION: switching selectMemmapEntry\'s WIDTH step to first-match selection makes "$D020 resolves to the 1-byte border-colour entry" go RED',
  async () => {
    const committedSource = fs.readFileSync(REAL_MODULE_PATH, "utf8");
    assert.ok(
      committedSource.includes(COMMITTED_WIDTH_STEP),
      "expected the committed memmap-lookup.ts to still carry the WIDTH step's committed form -- has the source drifted?",
    );

    // The committed, unmutated selection for $D020: a one-byte entry.
    const committedSelection = selectMemmapEntry(0xd020);
    assert.ok(committedSelection, "expected the committed selection for $D020 to resolve to something");
    assert.equal(committedSelection.width, 0, "expected the committed selection to be the one-byte border-colour entry");
    assert.equal(committedSelection.entry.label, "Border color (only bits #0-#3)");

    const { tmpDir, modulePath } = buildScratchMemmapModule((source) => {
      assert.ok(source.includes(COMMITTED_WIDTH_STEP), "planted-violation mutation target vanished before it could be applied");
      return source.replace(COMMITTED_WIDTH_STEP, MUTATED_WIDTH_STEP_FIRST_MATCH);
    });
    try {
      const mutated = await importScratchModule(modulePath);
      const mutatedEntries = mutated.loadMemmap();
      const mutatedSelection = mutated.selectMemmapEntry(0xd020, mutatedEntries);

      assert.ok(mutatedSelection, "expected the mutated (first-match) selection for $D020 to resolve to something");
      // MEASURED at execution time: the first containing entry in `entries`
      // order is index 438, the 46-inclusive-width (47-byte) video-interface-
      // chip entry -- asserted by name, not merely "a different answer".
      assert.equal(mutatedSelection.entry.label, "6566 Video Interface Chip, VIC II");
      assert.ok(mutatedSelection.width > 0, "expected the first-match mutation to select an entry wider than one byte");
      assert.equal(mutatedSelection.width, 46, "expected the first-match winner's inclusive width to be 46 (the measured video-interface-chip entry)");
      assert.equal(mutatedEntries.indexOf(mutatedSelection.entry), 438, "expected the first-match winner to be entries[438]");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  },
);

// ---------------------------------------------------------------------------
// Task 2: longest-description selection reddens narrowest-range-wins at the
// SAME address, $D020 -- a SECOND, order-independent wrong rule. Not
// redundant with Task 1's control: an implementation that happened to
// enumerate `$D020`'s 8 containing entries narrowest-first would return the
// correct one-byte entry under a first-match rule (surviving Task 1's
// control by accident) while STILL failing this one, because
// longest-description selection does not depend on enumeration order at
// all -- it scans every contender's own `desc` length regardless of where it
// sits in `entries`. Both controls are required because each catches a
// DIFFERENT way "compare widths" could have been silently dropped.
// ---------------------------------------------------------------------------

test(
  'PLANTED VIOLATION: switching selectMemmapEntry\'s WIDTH step to longest-description selection makes "$D020 resolves to the 1-byte border-colour entry" go RED',
  async () => {
    const committedSource = fs.readFileSync(REAL_MODULE_PATH, "utf8");
    assert.ok(
      committedSource.includes(COMMITTED_WIDTH_STEP),
      "expected the committed memmap-lookup.ts to still carry the WIDTH step's committed form -- has the source drifted?",
    );

    // The committed, unmutated selection for $D020: still the one-byte entry
    // (both directions of this control live in the same file).
    const committedSelection = selectMemmapEntry(0xd020);
    assert.ok(committedSelection, "expected the committed selection for $D020 to resolve to something");
    assert.equal(committedSelection.width, 0, "expected the committed selection to be the one-byte border-colour entry");
    assert.equal(committedSelection.entry.label, "Border color (only bits #0-#3)");

    // MEASURED at execution time, over the real, committed memmap.json: of
    // $D020's 8 containing entries, the one with the longest `desc` string
    // is entries[441] (295 characters, the "I/O Area ... depends on the
    // value of bits #0-#2 ..." entry) -- computed here rather than assumed,
    // so a later map edit that changes which entry is longest fails this
    // assertion loudly instead of silently asserting the wrong winner.
    const realEntries = loadMemmap();
    const containingD020 = realEntries.filter((entry) => 0xd020 >= entry.start && 0xd020 <= entry.end);
    assert.equal(containingD020.length, 8, "expected 8 containing entries at $D020 in the real, committed memmap.json -- has the map drifted?");
    let expectedLongestDescWinner = containingD020[0]!;
    for (const entry of containingD020) {
      if (entry.desc.length > expectedLongestDescWinner.desc.length) expectedLongestDescWinner = entry;
    }
    const expectedWinnerIndex = realEntries.indexOf(expectedLongestDescWinner);
    assert.ok(expectedWinnerIndex >= 0, "expected the measured longest-desc winner to be findable in the real entries array");
    assert.ok(inclusiveWidthOf(expectedLongestDescWinner) > 0, "expected the measured longest-desc winner to be wider than one byte (a vacuous control would prove nothing)");

    const { tmpDir, modulePath } = buildScratchMemmapModule((source) => {
      assert.ok(source.includes(COMMITTED_WIDTH_STEP), "planted-violation mutation target vanished before it could be applied");
      return source.replace(COMMITTED_WIDTH_STEP, MUTATED_WIDTH_STEP_LONGEST_DESC);
    });
    try {
      const mutated = await importScratchModule(modulePath);
      const mutatedEntries = mutated.loadMemmap();
      const mutatedSelection = mutated.selectMemmapEntry(0xd020, mutatedEntries);

      assert.ok(mutatedSelection, "expected the mutated (longest-description) selection for $D020 to resolve to something");
      assert.equal(
        mutatedEntries.indexOf(mutatedSelection.entry),
        expectedWinnerIndex,
        "expected the longest-description mutation to select the measured longest-desc entry, by index",
      );
      assert.equal(mutatedSelection.entry.label, expectedLongestDescWinner.label, "expected the longest-description winner's label to match the measured one");
      assert.ok(mutatedSelection.width > 0, "expected the longest-description mutation to select an entry wider than one byte");
      assert.equal(mutatedSelection.width, inclusiveWidthOf(expectedLongestDescWinner), "expected the mutated selection's width to equal the measured winner's own inclusive width");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  },
);

// ---------------------------------------------------------------------------
// Task 3: reversing the SYMBOL tie-break reddens the equal-width case at
// $0000 (the processor port's data-direction register -- the requirement's
// own equal-width, sym-decided fixture; plan 37-03 re-measured 3 contenders
// there, exactly one carrying a `sym`, correcting the research document's
// figure of two -- see the note below).
// ---------------------------------------------------------------------------

test(
  'PLANTED VIOLATION: reversing selectMemmapEntry\'s SYMBOL step makes "$0000 resolves to the sym-bearing entry" go RED',
  async () => {
    const committedSource = fs.readFileSync(REAL_MODULE_PATH, "utf8");
    assert.ok(
      committedSource.includes(COMMITTED_SYMBOL_STEP),
      "expected the committed memmap-lookup.ts to still carry the SYMBOL step's committed form -- has the source drifted?",
    );

    // MEASURED at execution time, over the real, committed memmap.json:
    // $0000 has 3 containing entries, all exactly one byte wide (equal
    // width), of which exactly one (entries[1], "6510 On-chip Data Direction
    // Register") carries a non-empty `sym` ("D6510"). This corrects
    // 37-RESEARCH.md's own figure of two contenders -- plan 37-03's
    // re-measurement (37-03-SUMMARY.md's key-decisions) already found the
    // real count is 3, and this transcript uses that re-measured number.
    const realEntries = loadMemmap();
    const containing0000 = realEntries.filter((entry) => 0 >= entry.start && 0 <= entry.end);
    assert.equal(containing0000.length, 3, "expected 3 containing entries at $0000 in the real, committed memmap.json (37-03's re-measured count, correcting the research document's figure of 2) -- has the map drifted?");
    const symBearing = containing0000.filter((entry) => typeof entry.sym === "string" && entry.sym.length > 0);
    assert.equal(symBearing.length, 1, "expected exactly one of the 3 equal-width contenders at $0000 to carry a sym");
    assert.equal(symBearing[0]!.sym, "D6510");

    // The committed, unmutated selection for $0000: the sym-bearing entry,
    // AND its tieBrokenBy names the SYMBOL rule -- an answer reached by
    // width or by order alone would mean the tie-break was never exercised
    // and this control proved nothing.
    const committedSelection = selectMemmapEntry(0x0000);
    assert.ok(committedSelection, "expected the committed selection for $0000 to resolve to something");
    assert.equal(committedSelection.width, 0, "expected the committed selection to be one of the equal-width (1-byte) contenders");
    assert.equal(committedSelection.entry.sym, "D6510", "expected the committed selection to be the sym-bearing entry");
    assert.equal(committedSelection.tieBrokenBy, "symbol", "expected the committed selection's tieBrokenBy to name the SYMBOL step -- otherwise the tie-break was never exercised");

    // The two contenders WITHOUT a sym, and which of them the unchanged
    // residual ORDER step resolves to (first in `entries` order) -- computed
    // here, not assumed, so the mutation's expected winner is measured
    // rather than guessed.
    const withoutSym = containing0000.filter((entry) => !(typeof entry.sym === "string" && entry.sym.length > 0));
    assert.equal(withoutSym.length, 2, "expected exactly 2 of the 3 equal-width contenders at $0000 to lack a sym");
    let expectedReversedWinner: (typeof withoutSym)[number] | undefined;
    for (const entry of realEntries) {
      if (withoutSym.includes(entry)) {
        expectedReversedWinner = entry;
        break;
      }
    }
    assert.ok(expectedReversedWinner, "expected the residual ORDER step to resolve a determinate winner among the sym-less contenders");
    const expectedReversedWinnerIndex = realEntries.indexOf(expectedReversedWinner!);

    const { tmpDir, modulePath } = buildScratchMemmapModule((source) => {
      assert.ok(source.includes(COMMITTED_SYMBOL_STEP), "planted-violation mutation target vanished before it could be applied");
      // The WIDTH step and the residual ORDER step must be BYTE-IDENTICAL in
      // the scratch copy, so the observed difference is attributable to the
      // SYMBOL step alone.
      assert.ok(source.includes(COMMITTED_WIDTH_STEP), "expected the WIDTH step to still be present, untouched, before this mutation");
      assert.ok(source.includes(COMMITTED_ORDER_STEP), "expected the residual ORDER step to still be present, untouched, before this mutation");
      const mutated = source.replace(COMMITTED_SYMBOL_STEP, MUTATED_SYMBOL_STEP_REVERSED);
      // Re-assert byte-identity of the other two steps AFTER the replace, so
      // a `.replace()` that accidentally touched more than its own target
      // would be caught here rather than silently shipping.
      assert.ok(mutated.includes(COMMITTED_WIDTH_STEP), "expected the WIDTH step to remain byte-identical after the SYMBOL-step replace");
      assert.ok(mutated.includes(COMMITTED_ORDER_STEP), "expected the residual ORDER step to remain byte-identical after the SYMBOL-step replace");
      return mutated;
    });
    try {
      const mutated = await importScratchModule(modulePath);
      const mutatedEntries = mutated.loadMemmap();
      const mutatedSelection = mutated.selectMemmapEntry(0x0000, mutatedEntries);

      assert.ok(mutatedSelection, "expected the mutated (reversed-symbol) selection for $0000 to resolve to something");
      assert.notEqual(mutatedSelection.entry.sym, "D6510", "expected the reversed-symbol mutation to select a contender WITHOUT the sym-bearing entry's own sym");
      assert.equal(mutatedSelection.entry.sym, undefined, "expected the reversed-symbol mutation to select a contender carrying no sym at all");
      assert.equal(
        mutatedEntries.indexOf(mutatedSelection.entry),
        expectedReversedWinnerIndex,
        "expected the reversed-symbol mutation to select the measured sym-less winner, by index",
      );
      assert.equal(mutatedSelection.entry.label, expectedReversedWinner!.label, "expected the reversed-symbol winner's label to match the measured one");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  },
);
