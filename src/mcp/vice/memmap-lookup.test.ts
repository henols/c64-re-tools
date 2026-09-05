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

test("selectMemmapEntry(0xd020): resolves to the 1-byte border-colour entry, not the 4096-byte containing entry, over 8 real contenders", () => {
  const selection = selectMemmapEntry(0xd020);
  assert.ok(selection);
  assert.equal(selection!.entry.start, 0xd020);
  assert.equal(selection!.entry.end, 0xd020, "the narrowest entry is the inclusive 1-byte $d020-$d020 range");
  assert.equal(selection!.width, 0, "an inclusive 1-byte range has end - start === 0");
  assert.equal(selection!.contenderCount, 8);
});

test("selectMemmapEntry(): with several equal-width contenders, the FIRST in entries order wins -- this plan's own residual tie-break (a later plan replaces it with the sym rule)", () => {
  const entries: MemmapEntry[] = [
    { start: 0, end: 0, label: "first, no sym", section: "s", desc: "", src: "test" },
    { start: 0, end: 0, label: "second, has sym", section: "s", desc: "", src: "test", sym: "D6510" },
  ];
  const selection = selectMemmapEntry(0, entries);
  assert.ok(selection);
  assert.equal(selection!.entry.label, "first, no sym");
  assert.equal(selection!.contenderCount, 2);
});

test("selectMemmapEntry(): an address contained by nothing in the supplied entries returns undefined", () => {
  const selection = selectMemmapEntry(0x1234, []);
  assert.equal(selection, undefined);
});

test("selectMemmapEntry(): a narrower entry wins over a wider containing one regardless of which is listed first", () => {
  const narrowFirst: MemmapEntry[] = [
    { start: 0xd000, end: 0xd000, label: "narrow", section: "s", desc: "", src: "test" },
    { start: 0xd000, end: 0xdfff, label: "wide", section: "s", desc: "", src: "test" },
  ];
  const wideFirst: MemmapEntry[] = [narrowFirst[1]!, narrowFirst[0]!];
  assert.equal(selectMemmapEntry(0xd000, narrowFirst)!.entry.label, "narrow");
  assert.equal(selectMemmapEntry(0xd000, wideFirst)!.entry.label, "narrow");
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
