// memmap-lookup.test.ts -- Phase 37 plan 37-01 task 3: the dedicated unit
// cases for `memmap-lookup.ts`'s loader, digest and narrowest-containing-
// range selection. The tracer's own end-to-end proof (a real import feeding
// a real join) lives in `anno-import.test.ts`; this file is unit-level and
// never opens an annotation store.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { BANK_CONDITIONAL_RANGES, loadMemmap, MEMMAP_PATH, memmapDigest, selectMemmapEntry } from "./memmap-lookup.ts";
import type { MemmapEntry } from "./memmap-lookup.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

test("MEMMAP_PATH resolves to a real, existing file", () => {
  assert.equal(existsSync(MEMMAP_PATH), true);
});

test("loadMemmap(): returns >= 900 entries (MEASURED 959 at plan time), each with inclusive start/end and a label", () => {
  const entries = loadMemmap();
  assert.ok(entries.length >= 900, `expected >= 900 memmap.json entries, found ${entries.length}`);
  for (const entry of entries.slice(0, 5)) {
    assert.ok(entry.end >= entry.start);
    assert.equal(typeof entry.label, "string");
  }
});

test("loadMemmap(): returns the same frozen array object on a second call -- read and parsed once, not per call", () => {
  const first = loadMemmap();
  const second = loadMemmap();
  assert.equal(first, second);
  assert.ok(Object.isFrozen(first));
});

test("memmapDigest(): equals the _generated.memmapSha256 value committed in anno-regbits.json -- asserted as a RELATION, never a hard-coded literal", () => {
  const regbits = JSON.parse(readFileSync(join(HERE, "anno-regbits.json"), "utf8")) as { _generated: { memmapSha256: string } };
  assert.equal(
    memmapDigest(),
    regbits._generated.memmapSha256,
    "memmap.json is a living file -- this asserts the relation anno-regbits-gen.ts's own banner records, never a pinned digest literal",
  );
});

// ---------------------------------------------------------------------------
// Phase 37 plan 37-03, Task 1: the complete, THREE-deep, stated selection
// order (D-37-10/D-37-11) -- narrowest-range-wins, then the `sym` tie-break
// (`AUTO-02`), then the stated residual "first in entries order" rule. Both
// `$D020` and `$0000` are the requirement's OWN named fixtures, driven
// against the REAL committed memmap.json, never a synthetic stand-in --
// re-measured this task against the committed map:
//   - eight entries contain $D020, of which exactly two have inclusive
//     width 1 (index 506 "Border color (only bits #0-#3)", src "sta"; index
//     507 "Border Color", src "io") and NEITHER carries a `sym`. MATCHES the
//     plan's own measurement exactly.
//   - three entries are exactly start=0,end=0 (index 0, no sym; index 1,
//     sym "D6510"; index 2, no sym), of which exactly ONE carries a `sym`.
//     MATCHES the plan's own measurement exactly.
// ---------------------------------------------------------------------------

test("selectMemmapEntry(0xd020): resolves to the 1-byte border-colour entry, not the 4096-byte containing entry, over 8 real contenders, decided by the ORDER step", () => {
  const selection = selectMemmapEntry(0xd020);
  assert.ok(selection);
  assert.equal(selection!.entry.start, 0xd020);
  assert.equal(selection!.entry.end, 0xd020, "the narrowest entry is the inclusive 1-byte $d020-$d020 range");
  assert.equal(selection!.width, 0, "an inclusive 1-byte range has end - start === 0");
  assert.equal(selection!.contenderCount, 8);
  assert.equal(
    selection!.entry.label,
    "Border color (only bits #0-#3)",
    "the LOWER-indexed (506) of the two 1-byte contenders wins -- neither carries a sym, so width and symbol both tie",
  );
  assert.equal(selection!.tieBrokenBy, "order", "width ties (two 1-byte entries) and symbol ties (neither has one) -- only the order step decides");
});

test("selectMemmapEntry(0x0000): resolves to the sym-bearing entry out of three equal-width contenders, decided by the SYMBOL step", () => {
  const selection = selectMemmapEntry(0x0000);
  assert.ok(selection);
  assert.equal(selection!.contenderCount, 3);
  assert.equal(selection!.entry.sym, "D6510");
  assert.equal(selection!.entry.label, "6510 On-chip Data Direction Register");
  assert.equal(selection!.tieBrokenBy, "symbol", "all three contenders tie on width (start=end=0) -- only the symbol step decides");
});

test("selectMemmapEntry(): over a hand-built two-entry list with IDENTICAL inclusive ranges, exactly one entry is returned and its range is unchanged -- never a merged range", () => {
  const entries: MemmapEntry[] = [
    { start: 0, end: 0, label: "first, no sym", section: "s", desc: "", src: "test" },
    { start: 0, end: 0, label: "second, has sym", section: "s", desc: "", src: "test", sym: "D6510" },
  ];
  const selection = selectMemmapEntry(0, entries);
  assert.ok(selection);
  assert.equal(selection!.contenderCount, 2);
  assert.equal(selection!.entry.start, 0);
  assert.equal(selection!.entry.end, 0, "the winning entry's own range is unchanged -- no merged range is ever constructed");
  assert.equal(selection!.entry.label, "second, has sym", "the sym-bearing entry wins the symbol step over the width-tied non-sym entry");
  assert.equal(selection!.tieBrokenBy, "symbol");
});

test("selectMemmapEntry(): two entries whose ranges merely TOUCH at a boundary byte are separate contenders -- an address of N selects only the first, N+1 selects only the second", () => {
  const entries: MemmapEntry[] = [
    { start: 0x1000, end: 0x1004, label: "ends at 1004", section: "s", desc: "", src: "test" },
    { start: 0x1005, end: 0x1008, label: "starts at 1005", section: "s", desc: "", src: "test" },
  ];
  const atN = selectMemmapEntry(0x1004, entries);
  const atNplus1 = selectMemmapEntry(0x1005, entries);
  assert.ok(atN);
  assert.ok(atNplus1);
  assert.equal(atN!.entry.label, "ends at 1004");
  assert.equal(atN!.contenderCount, 1);
  assert.equal(atN!.tieBrokenBy, "unique");
  assert.equal(atNplus1!.entry.label, "starts at 1005");
  assert.equal(atNplus1!.contenderCount, 1);
  assert.equal(atNplus1!.tieBrokenBy, "unique");
});

test("selectMemmapEntry(): an address contained by nothing in the supplied entries returns undefined", () => {
  const selection = selectMemmapEntry(0x1234, []);
  assert.equal(selection, undefined);
});

test("selectMemmapEntry(): over a hand-built single containing entry, contenderCount is 1 and tieBrokenBy names the unique case", () => {
  const entries: MemmapEntry[] = [{ start: 0x2000, end: 0x2000, label: "only one", section: "s", desc: "", src: "test" }];
  const selection = selectMemmapEntry(0x2000, entries);
  assert.ok(selection);
  assert.equal(selection!.contenderCount, 1);
  assert.equal(selection!.tieBrokenBy, "unique");
});

test("selectMemmapEntry(): a narrower entry wins over a wider containing one regardless of which is listed first", () => {
  const narrowFirst: MemmapEntry[] = [
    { start: 0xd000, end: 0xd000, label: "narrow", section: "s", desc: "", src: "test" },
    { start: 0xd000, end: 0xdfff, label: "wide", section: "s", desc: "", src: "test" },
  ];
  const wideFirst: MemmapEntry[] = [narrowFirst[1]!, narrowFirst[0]!];
  assert.equal(selectMemmapEntry(0xd000, narrowFirst)!.entry.label, "narrow");
  assert.equal(selectMemmapEntry(0xd000, wideFirst)!.entry.label, "narrow");
  assert.equal(selectMemmapEntry(0xd000, narrowFirst)!.tieBrokenBy, "width");
});

test("selectMemmapEntry(): two consecutive calls with the same address return deeply equal selections", () => {
  const first = selectMemmapEntry(0xd020);
  const second = selectMemmapEntry(0xd020);
  assert.deepEqual(first, second);
});

test("the selection path contains at most one sort() call -- more than one would make the three comparison steps non-separable and plan 37-04's mutations unwritable", () => {
  const source = readFileSync(join(HERE, "memmap-lookup.ts"), "utf8");
  const codeOnly = source.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const sortCalls = codeOnly.match(/\bsort\(/g) ?? [];
  assert.ok(sortCalls.length <= 1, `expected at most one sort( call, found ${sortCalls.length}`);
});

test("BANK_CONDITIONAL_RANGES: exactly the three hand-maintained ranges, each with a non-empty reason", () => {
  assert.equal(BANK_CONDITIONAL_RANGES.length, 3);
  const spans = BANK_CONDITIONAL_RANGES.map((r) => [r.start, r.end]);
  assert.deepEqual(spans, [
    [0xa000, 0xbfff],
    [0xd000, 0xdfff],
    [0xe000, 0xffff],
  ]);
  for (const range of BANK_CONDITIONAL_RANGES) {
    assert.ok(range.why.length > 0);
  }
});
