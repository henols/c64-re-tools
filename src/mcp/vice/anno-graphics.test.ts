// anno-graphics.test.ts -- Phase 37 plan 37-07 (AUTO-06). Every `<behavior>`
// bullet is written first and checked against hand-built fact lists, per this
// plan's own TDD instruction: the committed capture
// (`fixtures/ghidra/export-bank-path-dependent.txt`) carries writes only to
// the processor port ($0001, three facts: $34/$33/$37), NEVER to $DD00/
// $D018/$D011 -- MEASURED this plan (plan 37-02's own fixture is a banking
// fixture, not a graphics one). Every register-value case below is therefore
// a hand-built fact list, and plan 37-08's own graphics-bearing fixture is
// the future real-capture case, not this one.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BANK_SELECT_ADDRESS,
  CONTROL_REGISTER_1_ADDRESS,
  deriveGraphicsRanges,
  MEMORY_CONTROL_ADDRESS,
  SPRITE_POINTER_OFFSET,
} from "./anno-graphics.ts";
import type { GraphicsConstWriteFact, GraphicsMap } from "./anno-graphics.ts";
import { DATA_TYPES } from "./anno-types.ts";
import { closeStore, listXrefs, openStore, putXref } from "./anno-store.ts";
import { runMemmapJoin } from "./anno-join.ts";
import { codeOnly } from "./shipped-modules.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_ANNO_GRAPHICS_PATH = join(HERE, "anno-graphics.ts");

function inTempDir(body: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "anno-graphics-"));
  try {
    body(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A hand-built fact list representing one complete, real-shaped
 * combination: bank 0 ($DD00 = 0x03, both low bits set), screen at
 * $D018 = 0x14 (screen offset 1 * 1024, character offset 2 * 2048), mode bit
 * clear ($D011 = 0x1b) -- a character set, not a bitmap. */
function completeFacts(): GraphicsConstWriteFact[] {
  return [
    { storeAddress: 0x1000, targetAddress: BANK_SELECT_ADDRESS, value: 0x03 },
    { storeAddress: 0x1004, targetAddress: MEMORY_CONTROL_ADDRESS, value: 0x14 },
    { storeAddress: 0x1008, targetAddress: CONTROL_REGISTER_1_ADDRESS, value: 0x1b },
  ];
}

// ---------------------------------------------------------------------------
// Task 1 -- the arithmetic, one rule per behaviour bullet.
// ---------------------------------------------------------------------------

test("a bank-select value with both low bits set yields bank base zero; one with both low bits clear yields the highest bank base (the inversion has a failing direction)", () => {
  const lo = deriveGraphicsRanges([
    { storeAddress: 0x1000, targetAddress: BANK_SELECT_ADDRESS, value: 0x03 },
    { storeAddress: 0x1004, targetAddress: MEMORY_CONTROL_ADDRESS, value: 0x14 },
  ]);
  const hi = deriveGraphicsRanges([
    { storeAddress: 0x1000, targetAddress: BANK_SELECT_ADDRESS, value: 0x00 },
    { storeAddress: 0x1004, targetAddress: MEMORY_CONTROL_ADDRESS, value: 0x14 },
  ]);
  assert.equal(lo.length, 1);
  assert.equal(hi.length, 1);
  const loScreen = lo[0]!.ranges.find((r) => r.kind === "screen-matrix")!;
  const hiScreen = hi[0]!.ranges.find((r) => r.kind === "screen-matrix")!;
  // bank 0's own base is 0; bank 3's own base is 3 * 16384 = 49152.
  assert.equal(loScreen.start, 0 + (0x14 >> 4) * 1024);
  assert.equal(hiScreen.start, 49152 + (0x14 >> 4) * 1024);
  assert.ok(loScreen.start < hiScreen.start);
});

test("the screen-matrix range is exactly 1024 bytes, starting at the bank base plus the high nibble times the matrix granularity", () => {
  const [map] = deriveGraphicsRanges(completeFacts());
  const screen = map!.ranges.find((r) => r.kind === "screen-matrix")!;
  assert.equal(screen.start, 0 + ((0x14 >> 4) & 0x0f) * 1024);
  assert.equal(screen.endInclusive - screen.start + 1, 1024);
  assert.deepEqual(screen.derivedFrom, { "bank-select": 0x03, "memory-control": 0x14 });
});

test("with the mode bit clear the second range is a character set of the character-set size; with it set it is a bitmap of the bitmap size", () => {
  const charsetFacts = completeFacts(); // $D011 = 0x1b, bit 5 clear
  const [charsetMap] = deriveGraphicsRanges(charsetFacts);
  const charset = charsetMap!.ranges.find((r) => r.kind === "character-set" || r.kind === "bitmap")!;
  assert.equal(charset.kind, "character-set");
  assert.equal(charset.endInclusive - charset.start + 1, 2048);

  const bitmapFacts = completeFacts();
  bitmapFacts[2] = { storeAddress: 0x1008, targetAddress: CONTROL_REGISTER_1_ADDRESS, value: 0x3b }; // bit 5 set
  const [bitmapMap] = deriveGraphicsRanges(bitmapFacts);
  const bitmap = bitmapMap!.ranges.find((r) => r.kind === "character-set" || r.kind === "bitmap")!;
  assert.equal(bitmap.kind, "bitmap");
  assert.equal(bitmap.endInclusive - bitmap.start + 1, 8192);
  // Same bank/screen base either way -- only the mode bit moved.
  assert.equal(charset.start, bitmap.start);
});

test("the sprite-pointer range is exactly eight inclusive bytes, starting at the screen-matrix base plus the fixed sprite-pointer offset", () => {
  const [map] = deriveGraphicsRanges(completeFacts());
  const screen = map!.ranges.find((r) => r.kind === "screen-matrix")!;
  const sprites = map!.ranges.find((r) => r.kind === "sprite-pointers")!;
  assert.equal(sprites.start, screen.start + SPRITE_POINTER_OFFSET);
  assert.equal(sprites.endInclusive - sprites.start + 1, 8);
});

test("two distinct recovered combinations produce two maps in ascending tuple order, each carrying its own register values, and two runs over the same facts are deeply equal", () => {
  const facts: GraphicsConstWriteFact[] = [
    { storeAddress: 0x1000, targetAddress: BANK_SELECT_ADDRESS, value: 0x03 },
    { storeAddress: 0x1004, targetAddress: BANK_SELECT_ADDRESS, value: 0x00 },
    { storeAddress: 0x1008, targetAddress: MEMORY_CONTROL_ADDRESS, value: 0x14 },
    { storeAddress: 0x100c, targetAddress: CONTROL_REGISTER_1_ADDRESS, value: 0x1b },
  ];
  const first = deriveGraphicsRanges(facts);
  const second = deriveGraphicsRanges(facts);
  assert.deepEqual(first, second);
  assert.equal(first.length, 2);
  assert.equal(first[0]!.registerValues["bank-select"], 0x00); // ascending: 0x00 sorts before 0x03
  assert.equal(first[1]!.registerValues["bank-select"], 0x03);
});

test("a fact list missing the bank-select register produces a map naming that register in missingRegisters, with every range that depended on it omitted -- never a power-on default", () => {
  const [map] = deriveGraphicsRanges([
    { storeAddress: 0x1004, targetAddress: MEMORY_CONTROL_ADDRESS, value: 0x14 },
    { storeAddress: 0x1008, targetAddress: CONTROL_REGISTER_1_ADDRESS, value: 0x1b },
  ]);
  assert.deepEqual(map!.missingRegisters, ["bank-select"]);
  assert.equal(map!.ranges.length, 0);
  assert.equal(map!.registerValues["bank-select"], undefined);
});

test("every returned range has endInclusive >= start, and every dataType is a member of the frozen DATA_TYPES vocabulary", () => {
  const maps: GraphicsMap[] = [
    ...deriveGraphicsRanges(completeFacts()),
    ...deriveGraphicsRanges([{ storeAddress: 0x1004, targetAddress: MEMORY_CONTROL_ADDRESS, value: 0x14 }]),
  ];
  let sawRange = false;
  for (const map of maps) {
    for (const range of map.ranges) {
      sawRange = true;
      assert.ok(range.endInclusive >= range.start);
      assert.ok(DATA_TYPES.includes(range.dataType), `${range.dataType} must be one of DATA_TYPES`);
    }
  }
  assert.ok(sawRange, "non-vacuity: at least one range must have been checked");
});

test("the module header states the sprite-bitmap-out-of-scope boundary and the byte-datatype choice", () => {
  const src = readFileSync(REAL_ANNO_GRAPHICS_PATH, "utf8");
  assert.match(src, /SPRITE BITMAP LOCATIONS ARE OUT OF SCOPE/);
  assert.match(src, /NO GRAPHICS-SPECIFIC DATA TYPE EXISTS/);
});

// ---------------------------------------------------------------------------
// Task 2 -- proving the derivation finds what cross-references structurally
// cannot (AUTO-06's distinguishing claim, turned into an assertion).
// ---------------------------------------------------------------------------

test("a derived character-set range covers an address no stored cross-reference row targets, against the SAME store", () => {
  inTempDir((dir) => {
    const handle = openStore(join(dir, "proj.annostore"), { workspaceRoot: dir });
    try {
      // Deliberately none of these targets fall inside the derived
      // character-set range [4096, 6143].
      putXref(handle, { fromAddress: 0x1000, toAddress: 0xa000, accessKind: "COMPUTED_JUMP" });
      putXref(handle, { fromAddress: 0x1004, toAddress: 0x9000, accessKind: "WRITE" });

      const [map] = deriveGraphicsRanges(completeFacts());
      const charset = map!.ranges.find((r) => r.kind === "character-set")!;
      const insideAddress = 5000;
      assert.ok(insideAddress >= charset.start && insideAddress <= charset.endInclusive);

      const xrefs = listXrefs(handle);
      assert.ok(
        xrefs.every((xref) => xref.toAddress !== insideAddress),
        "no stored cross-reference row may target the address the derivation alone covers",
      );
    } finally {
      closeStore(handle);
    }
  });
});

test("the real join over the same store produces no decision covering the derived character-set address", () => {
  inTempDir((dir) => {
    const handle = openStore(join(dir, "proj.annostore"), { workspaceRoot: dir });
    try {
      putXref(handle, { fromAddress: 0x1000, toAddress: 0xa000, accessKind: "COMPUTED_JUMP" });
      putXref(handle, { fromAddress: 0x1004, toAddress: 0x9000, accessKind: "WRITE" });

      const [map] = deriveGraphicsRanges(completeFacts());
      const charset = map!.ranges.find((r) => r.kind === "character-set")!;
      const insideAddress = 5000;
      assert.ok(insideAddress >= charset.start && insideAddress <= charset.endInclusive);

      const { decisions } = runMemmapJoin(handle, { imageOrigin: 0x0801, imageByteLength: 0x10 });
      assert.ok(
        decisions.every((decision) => decision.address !== insideAddress),
        "the reference-driven join must not reach an address only the register-derived map covers",
      );
    } finally {
      closeStore(handle);
    }
  });
});

test("derived ranges are unchanged whether the store carries cross-reference rows or none at all", () => {
  const facts = completeFacts();
  let withRows: GraphicsMap[] = [];
  let withoutRows: GraphicsMap[] = [];
  inTempDir((dir) => {
    const handle = openStore(join(dir, "proj.annostore"), { workspaceRoot: dir });
    try {
      putXref(handle, { fromAddress: 0x1000, toAddress: 0xa000, accessKind: "COMPUTED_JUMP" });
      putXref(handle, { fromAddress: 0x1004, toAddress: 0x9000, accessKind: "WRITE" });
      assert.ok(listXrefs(handle).length > 0);
      withRows = deriveGraphicsRanges(facts);
    } finally {
      closeStore(handle);
    }
  });
  inTempDir((dir) => {
    const handle = openStore(join(dir, "proj.annostore"), { workspaceRoot: dir });
    try {
      assert.equal(listXrefs(handle).length, 0);
      withoutRows = deriveGraphicsRanges(facts);
    } finally {
      closeStore(handle);
    }
  });
  assert.deepEqual(withRows, withoutRows);
});

/** Extracts every static (`from "..."`) and dynamic (`import("...")`)
 * specifier from already `codeOnly()`-stripped source. Mirrors the idiom
 * `anno-seam.test.ts` establishes (comment/string-stripped source, one named
 * predicate), scaled down to this module's own narrower question: WHICH
 * modules does it import, not merely whether one named builtin appears. */
function extractImportSpecifiers(strippedSrc: string): string[] {
  const specifiers: string[] = [];
  const staticImportRe = /\bfrom\s+["']([^"']+)["']/g;
  const dynamicImportRe = /\bimport\(\s*["']([^"']+)["']\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = staticImportRe.exec(strippedSrc))) specifiers.push(match[1]!);
  while ((match = dynamicImportRe.exec(strippedSrc))) specifiers.push(match[1]!);
  return specifiers;
}

/** The modules this module's own import list must never reach (D-37-26): the
 * persistence seam, the join, the reference-graph-exposing modules (the same
 * one as the persistence seam here), the host-path modules, and the
 * emulator backend. Non-vacuity (a non-zero specifier count) is asserted
 * separately below, BEFORE this list is even consulted. */
const BANNED_IMPORT_SUBSTRINGS = [
  "anno-store",
  "anno-join",
  "hostpath",
  "containerpath",
  "stock-vicii",
  "stock-sprites",
];

test("a non-vacuous structural scan of anno-graphics.ts's own import list reaches none of the store, the join, the host-path modules or the emulator backend", () => {
  const raw = readFileSync(REAL_ANNO_GRAPHICS_PATH, "utf8");
  // `keepLiteralBodies = true` is mandatory here (mirrors `anno-seam.test.ts`'s
  // own `stripForSpecifierScan()`): the import specifiers THIS scan looks for
  // are themselves string literals, and the default `codeOnly()` mode blanks
  // literal bodies out entirely.
  const stripped = codeOnly(raw, true);
  const specifiers = extractImportSpecifiers(stripped);
  // Non-vacuity FIRST: an empty or mis-globbed scan must fail here, not pass
  // the loop below trivially by having nothing to iterate. Hand-confirmed
  // once during authoring (see the plan 37-07 SUMMARY): pointing this same
  // scan at an empty source string yields zero specifiers, and the banned-
  // substring loop below would then vacuously pass with nothing to check --
  // exactly why this assertion exists ahead of it.
  assert.ok(specifiers.length > 0, "non-vacuity: the scan must find at least one import specifier");
  for (const specifier of specifiers) {
    for (const banned of BANNED_IMPORT_SUBSTRINGS) {
      assert.ok(!specifier.includes(banned), `import specifier "${specifier}" must not reach "${banned}"`);
    }
  }
});
