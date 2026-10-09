import assert from "node:assert/strict";
import { test } from "node:test";

import { WireFailure } from "../protocol/messages.ts";
import { checkDxaResult, checkGhidraResult, imageRange, seedsInside } from "./types.ts";

test("an analyzer image is a PRG at its load address or 64 KiB from $0000", () => {
  assert.deepEqual({ ...imageRange("prg", Buffer.from([0x01, 0x08, 0x60, 0x00])), body: undefined }, { start: 0x0801, end: 0x0802, body: undefined });
  assert.equal(imageRange("flat64k", Buffer.alloc(0x10000)).end, 0xffff);
  for (const [kind, bytes] of [
    ["prg", Buffer.from([0x01, 0x08])],
    ["prg", Buffer.from([0xff, 0xff, 1, 2])],
    ["flat64k", Buffer.alloc(100)],
  ] as const) {
    assert.throws(() => imageRange(kind, bytes), (error: unknown) => error instanceof WireFailure && error.code === "invalid-input");
  }
});

test("the seeds of an analysis are the entry points inside its range and the data ranges cut to it", () => {
  const seeds = seedsInside(
    {
      entryPoints: [0x07ff, 0x0810, 0x0900],
      dataRanges: [
        { start: 0x0700, end: 0x0805 },
        { start: 0x080c, end: 0x0812 },
        { start: 0x0820, end: 0x0a00 },
        { start: 0x0a00, end: 0x0b00 },
      ],
    },
    0x0801,
    0x0827,
  );
  assert.deepEqual(seeds, {
    entryPoints: [0x0810],
    dataRanges: [
      { start: 0x0801, end: 0x0805 },
      { start: 0x0820, end: 0x0827 },
    ],
  });
});

test("a Ghidra result must be complete and consistent", () => {
  const result = {
    coverage: [{ start: 0x0801, end: 0x0827 }],
    functions: [{ entry: 0x080d, name: "FUN_080d", nameSource: "generated" }],
    regions: [
      { start: 0x080d, end: 0x0815, classification: "code" },
      { start: 0x0824, end: 0x0827, classification: "data" },
    ],
    references: [{ from: 0x080d, to: 0x0818, type: "call" }],
    decompilations: [{ entry: 0x080d, text: "void FUN_080d(void) {}", truncated: false }],
    completeness: { functions: true, regions: true, references: true },
  };
  assert.deepEqual(checkGhidraResult(result), result);
  assert.deepEqual(checkGhidraResult({ ...result, toolVersion: "Ghidra 12.1.3" }), { ...result, toolVersion: "Ghidra 12.1.3" });
  for (const bad of [
    { ...result, functions: [{ entry: 0x0900, name: "FUN_0900", nameSource: "generated" }] },
    { ...result, regions: [result.regions[1], result.regions[0]] },
    { ...result, regions: [{ start: 0x0800, end: 0x0810, classification: "code" }] },
    { ...result, references: [{ from: 0x0700, to: 0x0818, type: "call" }] },
    { ...result, references: [{ from: 0x080d, to: 0x0818, type: "flow" }] },
    { ...result, decompilations: [{ entry: 0x080d, text: "x".repeat(16_001), truncated: true }] },
    { ...result, completeness: undefined },
    { ...result, toolVersion: "" },
    { ...result, toolVersion: "Ghidra 12.1.3\nmore" },
    { ...result, toolVersion: "x".repeat(201) },
    { ...result, toolVersion: 12 },
  ]) {
    assert.throws(() => checkGhidraResult(bad), Error, JSON.stringify(bad).slice(0, 80));
  }
});

test("a DXA result must cover its range exactly and carry its listing", () => {
  const listing = [Buffer.from("listing")];
  const result = {
    coverage: [{ start: 0x0801, end: 0x0827 }],
    regions: [
      { start: 0x0801, end: 0x080c, classification: "data" },
      { start: 0x080d, end: 0x0827, classification: "code" },
    ],
    labels: [{ address: 0x080d, name: "l80d" }],
    listingBytes: 7,
    completeness: { regions: true, labels: false },
  };
  assert.deepEqual(checkDxaResult(result, listing), result);
  const versioned = { ...result, toolVersion: "dxa v0.1.5 -- symbolic 65xx disassembler" };
  assert.deepEqual(checkDxaResult(versioned, listing), versioned);
  for (const bad of [
    { ...result, regions: [result.regions[1]] },
    { ...result, regions: [result.regions[0]] },
    { ...result, labels: [{ address: 0x9000, name: "far" }] },
    { ...result, listingBytes: 8 },
    { ...result, toolVersion: "dxa\tv0.1.5" },
    { ...result, toolVersion: "x".repeat(201) },
  ]) {
    assert.throws(() => checkDxaResult(bad, listing), Error, JSON.stringify(bad).slice(0, 80));
  }
  assert.throws(() => checkDxaResult(result, []), Error, "the listing is part of the result");
});
