#!/usr/bin/env node
// dxa-blocks.test.ts
//
// Phase 35, plan 35-04 (DXA-03). HERMETIC: no dxa, no `node:child_process`,
// no annotation store -- every case drives `dxa-blocks.ts` directly against
// in-memory `KnownDataRow[]` and a scratch directory this file owns.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DATA_TYPES } from "./anno-types.ts";
import { DATA_BEARING_TYPES, emitDataBlocks, emitLabels, type KnownDataRow } from "./dxa-blocks.ts";

function scratchDir(): string {
  return mkdtempSync(join(tmpdir(), "dxa-blocks-test-"));
}

// ---------------------------------------------------------------------------
// A-12: the selection is derived, never hand-listed.
// ---------------------------------------------------------------------------

test("DATA_BEARING_TYPES has exactly ten members, all drawn from DATA_TYPES", () => {
  assert.equal(DATA_BEARING_TYPES.length, 10, "ten of the frozen twelve are data-bearing");
  for (const dataType of DATA_BEARING_TYPES) {
    assert.ok((DATA_TYPES as readonly string[]).includes(dataType), `${dataType} must be a member of the frozen DATA_TYPES array`);
  }
});

test("DATA_BEARING_TYPES excludes exactly code and undefined", () => {
  assert.ok(!DATA_BEARING_TYPES.includes("code"), "code must be absent -- the store says these bytes ARE program");
  assert.ok(!DATA_BEARING_TYPES.includes("undefined"), "undefined must be absent -- the store does not know these bytes");
  assert.equal(DATA_TYPES.length - DATA_BEARING_TYPES.length, 2, "exactly two of the twelve are excluded");
});

// ---------------------------------------------------------------------------
// emitDataBlocks(): the -B file.
// ---------------------------------------------------------------------------

test("emitDataBlocks: code and undefined rows produce no -B line", () => {
  const dir = scratchDir();
  try {
    const rows: KnownDataRow[] = [
      { start: 0x1000, endInclusive: 0x1fff, dataType: "code" },
      { start: 0x2000, endInclusive: 0x2fff, dataType: "undefined" },
    ];
    const result = emitDataBlocks(rows, join(dir, "out.b"));
    assert.equal(result.rangesCount, 0);
    assert.equal(result.path, undefined);
    assert.equal(existsSync(join(dir, "out.b")), false, "no file is written for an all-excluded selection");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("emitDataBlocks: zero rows writes no file and reports rangesCount 0", () => {
  const dir = scratchDir();
  try {
    const outputPath = join(dir, "would-be.b");
    const result = emitDataBlocks([], outputPath);
    assert.equal(result.rangesCount, 0);
    assert.equal(result.path, undefined);
    assert.equal(existsSync(outputPath), false, "no file is written at the would-be path");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("emitDataBlocks: two ranges touching at a byte boundary emit as two lines, never coalesced", () => {
  const dir = scratchDir();
  try {
    const outputPath = join(dir, "adjacent.b");
    const rows: KnownDataRow[] = [
      { start: 0x1000, endInclusive: 0x1fff, dataType: "byte" },
      { start: 0x2000, endInclusive: 0x2fff, dataType: "byte" },
    ];
    const result = emitDataBlocks(rows, outputPath);
    assert.equal(result.rangesCount, 2);
    assert.equal(result.path, outputPath);
    const text = readFileSync(outputPath, "utf8");
    assert.equal(text, "1000-1fff\n2000-2fff\n", "exact two-line text, ascending, never merged into one range");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("emitDataBlocks: overlapping ranges are refused by name, quoting both", () => {
  const dir = scratchDir();
  try {
    const rows: KnownDataRow[] = [
      { start: 0x1000, endInclusive: 0x1fff, dataType: "byte" },
      { start: 0x1800, endInclusive: 0x27ff, dataType: "word" },
    ];
    assert.throws(
      () => emitDataBlocks(rows, join(dir, "overlap.b")),
      (err: Error) => {
        assert.match(err.message, /1000-1fff/);
        assert.match(err.message, /1800-27ff/);
        return true;
      },
    );
    assert.equal(existsSync(join(dir, "overlap.b")), false, "nothing is written when the selection is refused");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("emitDataBlocks: an inverted range is refused by name", () => {
  const dir = scratchDir();
  try {
    const rows: KnownDataRow[] = [{ start: 0x2000, endInclusive: 0x1000, dataType: "byte" }];
    assert.throws(() => emitDataBlocks(rows, join(dir, "inverted.b")), /inverted/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("emitDataBlocks: a range outside $0000-$ffff is refused by name", () => {
  const dir = scratchDir();
  try {
    const rows: KnownDataRow[] = [{ start: 0x10000, endInclusive: 0x10010, dataType: "byte" }];
    assert.throws(() => emitDataBlocks(rows, join(dir, "oob.b")), /\$0000-\$ffff/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("emitDataBlocks: output is sorted ascending by start regardless of input order", () => {
  const dir = scratchDir();
  try {
    const outputPath = join(dir, "sorted.b");
    const rows: KnownDataRow[] = [
      { start: 0x3000, endInclusive: 0x3fff, dataType: "word" },
      { start: 0x1000, endInclusive: 0x1fff, dataType: "byte" },
      { start: 0x2000, endInclusive: 0x2fff, dataType: "petscii" },
    ];
    emitDataBlocks(rows, outputPath);
    const text = readFileSync(outputPath, "utf8");
    assert.equal(text, "1000-1fff\n2000-2fff\n3000-3fff\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("emitDataBlocks: idempotent -- two runs on the same store state produce byte-identical files", () => {
  const dir = scratchDir();
  try {
    const outputPath = join(dir, "idempotent.b");
    const rows: KnownDataRow[] = [
      { start: 0x1000, endInclusive: 0x1fff, dataType: "byte" },
      { start: 0x4000, endInclusive: 0x4fff, dataType: "screencode" },
    ];
    emitDataBlocks(rows, outputPath);
    const first = readFileSync(outputPath);
    emitDataBlocks(rows, outputPath);
    const second = readFileSync(outputPath);
    assert.deepEqual(first, second, "the second run overwrites, producing byte-identical output -- no accumulation");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("emitDataBlocks: two invocations at distinct paths never observe each other's ranges", () => {
  const dir = scratchDir();
  try {
    const pathA = join(dir, "a.b");
    const pathB = join(dir, "b.b");
    emitDataBlocks([{ start: 0x1000, endInclusive: 0x1fff, dataType: "byte" }], pathA);
    emitDataBlocks([{ start: 0x5000, endInclusive: 0x5fff, dataType: "word" }], pathB);
    assert.equal(readFileSync(pathA, "utf8"), "1000-1fff\n");
    assert.equal(readFileSync(pathB, "utf8"), "5000-5fff\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// emitLabels(): the -l file.
// ---------------------------------------------------------------------------

test("emitLabels: a symbol-bearing row produces the exact xa65 line shape", () => {
  const dir = scratchDir();
  try {
    const outputPath = join(dir, "labels.lbl");
    const rows: KnownDataRow[] = [{ start: 0x08df, endInclusive: 0x08df, dataType: "byte", sym: "arr_dst" }];
    const result = emitLabels(rows, outputPath);
    assert.equal(result.count, 1);
    assert.equal(result.path, outputPath);
    const text = readFileSync(outputPath, "utf8");
    assert.equal(text, "\tarr_dst\t= $8df\n", "tab, name, tab, = $hex (lower-case, no leading zeros), newline -- fixture.lbl's own shape");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("emitLabels: a symbol-less row produces no line, and zero symbol-bearing rows writes no file", () => {
  const dir = scratchDir();
  try {
    const outputPath = join(dir, "no-symbols.lbl");
    const rows: KnownDataRow[] = [
      { start: 0x1000, endInclusive: 0x1fff, dataType: "byte" },
      { start: 0x2000, endInclusive: 0x2fff, dataType: "word" },
    ];
    const result = emitLabels(rows, outputPath);
    assert.equal(result.count, 0);
    assert.equal(result.path, undefined);
    assert.equal(existsSync(outputPath), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("emitLabels: mixed rows omit the symbol-less one and keep the symbol-bearing one, sorted by address", () => {
  const dir = scratchDir();
  try {
    const outputPath = join(dir, "mixed.lbl");
    const rows: KnownDataRow[] = [
      { start: 0x2000, endInclusive: 0x2fff, dataType: "byte", sym: "second" },
      { start: 0x1000, endInclusive: 0x1fff, dataType: "byte" },
      { start: 0x0810, endInclusive: 0x0810, dataType: "byte", sym: "first" },
    ];
    const result = emitLabels(rows, outputPath);
    assert.equal(result.count, 2);
    const text = readFileSync(outputPath, "utf8");
    assert.equal(text, "\tfirst\t= $810\n\tsecond\t= $2000\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
