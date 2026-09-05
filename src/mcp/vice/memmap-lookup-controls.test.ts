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
