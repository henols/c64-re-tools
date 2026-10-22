// Seeds from knowledge and the Ghidra → normalized findings mapping of the
// retro-static-analysis script. No Ghidra needed.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { openForWrite } from "../../src/knowledge/database.ts";
import { importFindings } from "../../src/knowledge/import.ts";
import { classifyRegion, renameSymbol } from "../../src/knowledge/write.ts";
import { dxaFindings, ghidraFindings, seedsFromKnowledge } from "../../skills/retro-static-analysis/scripts/lib/findings.ts";

const root = mkdtempSync(join(tmpdir(), "c64-re-tools-findings-"));
const db = openForWrite(root);
after(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

test("seeds come from current semantic knowledge only: routines, non-code regions and names", () => {
  assert.deepEqual(seedsFromKnowledge(undefined, [0x080d]), { entryPoints: [0x080d], dataRanges: [], labels: [] }, "no database means no seeds beyond the given ones");
  renameSymbol(db, { origin: "llm" }, { address: 0x2100, name: "update_player", kind: "routine" });
  renameSymbol(db, { origin: "user" }, { address: 0x3000, name: "player_x", kind: "variable" });
  classifyRegion(db, { origin: "llm" }, { start: 0x4000, end: 0x403f, type: "sprite" });
  classifyRegion(db, { origin: "llm" }, { start: 0x2100, end: 0x21ff, type: "code" });
  importFindings(db, {
    analyzer: "ghidra",
    coverage: [{ start: 0x2200, end: 0x22ff }],
    authoritative: { symbols: true, regions: true, references: true },
    symbols: [{ address: 0x2200, name: "FUN_2200", kind: "routine" }],
    regions: [],
    references: [],
  });
  importFindings(db, {
    analyzer: "dxa",
    coverage: [{ start: 0x5000, end: 0x50ff }],
    authoritative: { symbols: false, regions: true, references: false },
    symbols: [],
    regions: [{ start: 0x5000, end: 0x50ff, type: "bytes" }],
    references: [],
  });
  // Ghidra's FUN_2200 and DXA's data region are no seeds: a re-analysis must be free to drop them.
  // The variable player_x is data: its own byte, as no region holds it.
  assert.deepEqual(seedsFromKnowledge(db, [0x080d, 0x2100]), {
    entryPoints: [0x080d, 0x2100],
    dataRanges: [{ start: 0x3000, end: 0x3000 }, { start: 0x4000, end: 0x403f }],
    labels: [
      { address: 0x2100, name: "update_player" },
      { address: 0x3000, name: "player_x" },
    ],
  });
});

test("a data or variable symbol of the user or the LLM makes its non-code region data for the analyzer, also a region of DXA; code and executed addresses stay free", () => {
  const own = openForWrite(mkdtempSync(join(root, "symbols-")));
  try {
    importFindings(own, {
      analyzer: "dxa",
      coverage: [{ start: 0x4700, end: 0x47ff }],
      authoritative: { symbols: false, regions: true, references: false },
      symbols: [],
      regions: [
        { start: 0x4700, end: 0x4706, type: "code" },
        { start: 0x4707, end: 0x471f, type: "bytes" },
        { start: 0x4720, end: 0x473f, type: "bytes" },
        { start: 0x4740, end: 0x47ff, type: "bytes" },
      ],
      references: [],
    });
    renameSymbol(own, { origin: "llm" }, { address: 0x4707, name: "version_banner", kind: "data" });
    renameSymbol(own, { origin: "llm" }, { address: 0x4703, name: "self_mod_operand", kind: "variable" });
    renameSymbol(own, { origin: "llm" }, { address: 0x4728, name: "executed_byte", kind: "variable" });
    renameSymbol(own, { origin: "llm" }, { address: 0x4750, name: "frame_counter", kind: "variable" });
    renameSymbol(own, { origin: "llm" }, { address: 0x0041, name: "score", kind: "variable" });
    renameSymbol(own, { origin: "llm" }, { address: 0x4760, name: "a_label", kind: "label" });
    const executed = (address: number) => address === 0x4728 || address === 0x4745;
    assert.deepEqual(seedsFromKnowledge(own, [], "c64", executed).dataRanges, [
      { start: 0x0041, end: 0x0041 },
      { start: 0x4707, end: 0x471f },
      // $4750 is in a region with an executed byte: only its own byte.
      { start: 0x4750, end: 0x4750 },
    ]);
  } finally {
    own.close();
  }
});

test("functions become routine symbols, code is code and data is bytes", () => {
  const findings = ghidraFindings({
    coverage: [{ start: 0x0801, end: 0x0827 }],
    functions: [
      { entry: 0x080d, name: "FUN_080d", nameSource: "generated" },
      { entry: 0x0818, name: "init_result", nameSource: "seed" },
      { entry: 0x0820, name: "entry", nameSource: "native" },
    ],
    regions: [
      { start: 0x080d, end: 0x0815, classification: "code" },
      { start: 0x0824, end: 0x0827, classification: "data" },
    ],
    references: [{ from: 0x080d, to: 0x0818, type: "call" }],
    decompilations: [],
    instructions: [],
    completeness: { functions: true, regions: true, references: false },
  });
  assert.deepEqual(findings, {
    analyzer: "ghidra",
    coverage: [{ start: 0x0801, end: 0x0827 }],
    authoritative: { symbols: true, regions: true, references: false },
    symbols: [
      { address: 0x080d, name: "FUN_080d", kind: "routine" },
      { address: 0x0818, name: "init_result", kind: "routine" },
      { address: 0x0820, name: "entry", kind: "routine" },
    ],
    regions: [
      { start: 0x080d, end: 0x0815, type: "code" },
      { start: 0x0824, end: 0x0827, type: "bytes" },
    ],
    references: [{ from: 0x080d, to: 0x0818, kind: "call" }],
  });
});

test("a generated name that Ghidra gives to two functions gets each function's address", () => {
  const findings = ghidraFindings({
    coverage: [{ start: 0x0000, end: 0xffff }],
    functions: [
      { entry: 0x0812, name: "thunk_FUN_e434", nameSource: "generated" },
      { entry: 0x2a00, name: "thunk_FUN_e434", nameSource: "generated" },
      { entry: 0xe434, name: "FUN_e434", nameSource: "generated" },
    ],
    regions: [],
    references: [],
    decompilations: [],
    instructions: [],
    completeness: { functions: true, regions: true, references: true },
  });
  assert.deepEqual(
    findings.symbols.map((symbol) => symbol.name),
    ["thunk_FUN_e434_0812", "thunk_FUN_e434_2a00", "FUN_e434"],
  );
});

test("a (zp),y or (zp,x) instruction keeps only its reference to the pointer, never a computed target", () => {
  const findings = ghidraFindings({
    coverage: [{ start: 0x26ce, end: 0x26d9 }],
    functions: [],
    regions: [],
    references: [
      { from: 0x26ce, to: 0x000e, type: "read" },
      { from: 0x26ce, to: 0x0403, type: "write" },
      { from: 0x26ce, to: 0x0404, type: "write" },
      { from: 0x26d0, to: 0x00fc, type: "read" },
      { from: 0x26d0, to: 0x1234, type: "read" },
      { from: 0x26d2, to: 0x00fb, type: "read" },
      { from: 0x26d2, to: 0x0400, type: "read" },
      { from: 0x26d4, to: 0x0403, type: "write" },
      { from: 0x26d7, to: 0x00fb, type: "write" },
    ],
    decompilations: [],
    instructions: [
      { address: 0x26ce, bytes: "910e", mnemonic: "sta", operands: "(0x0e),Y", flows: [] },
      { address: 0x26d0, bytes: "a1fb", mnemonic: "lda", operands: "(0xfb,X)", flows: [] },
      { address: 0x26d2, bytes: "b3fb", mnemonic: "lax", operands: "(0xfb),Y", flows: [] },
      { address: 0x26d4, bytes: "8d0304", mnemonic: "sta", operands: "0x0403", flows: [] },
      { address: 0x26d7, bytes: "85fb", mnemonic: "sta", operands: "0xfb", flows: [] },
    ],
    completeness: { functions: true, regions: true, references: true },
  });
  assert.deepEqual(findings.references, [
    { from: 0x26ce, to: 0x000e, kind: "read" },
    { from: 0x26d0, to: 0x00fc, kind: "read" },
    { from: 0x26d2, to: 0x00fb, kind: "read" },
    { from: 0x26d4, to: 0x0403, kind: "write" },
    { from: 0x26d7, to: 0x00fb, kind: "write" },
  ]);
});

test("an echoed seed stays with its semantic owner, and a code/data disagreement is reported", () => {
  const project = mkdtempSync(join(tmpdir(), "c64-re-tools-echo-"));
  const own = openForWrite(project);
  try {
    renameSymbol(own, { origin: "llm" }, { address: 0x0818, name: "init_result", kind: "routine" });
    renameSymbol(own, { origin: "user" }, { address: 0x080d, name: "main", kind: "variable" });
    const result = importFindings(
      own,
      ghidraFindings({
        coverage: [{ start: 0x0801, end: 0x0827 }],
        functions: [
          { entry: 0x080d, name: "main", nameSource: "seed" },
          { entry: 0x0818, name: "init_result", nameSource: "seed" },
        ],
        regions: [],
        references: [],
        decompilations: [],
        instructions: [],
        completeness: { functions: true, regions: true, references: true },
      }),
    );
    assert.equal(result.revision, null, "nothing changes owner");
    assert.deepEqual(result.conflicts.map((conflict) => conflict.category === "symbol" && [conflict.address, conflict.reason]), [[0x080d, "kind"]]);
  } finally {
    own.close();
    rmSync(project, { recursive: true, force: true });
  }
});

test("DXA labels are non-authoritative label symbols; its regions are authoritative", () => {
  const findings = dxaFindings({
    coverage: [{ start: 0x0801, end: 0x0827 }],
    regions: [
      { start: 0x0801, end: 0x080c, classification: "data" },
      { start: 0x080d, end: 0x0827, classification: "code" },
    ],
    labels: [{ address: 0x080d, name: "l80d" }],
    listingBytes: 100,
    completeness: { regions: true, labels: false },
  });
  assert.deepEqual(findings, {
    analyzer: "dxa",
    coverage: [{ start: 0x0801, end: 0x0827 }],
    authoritative: { symbols: false, regions: true, references: false },
    symbols: [{ address: 0x080d, name: "l80d", kind: "label" }],
    regions: [
      { start: 0x0801, end: 0x080c, type: "bytes" },
      { start: 0x080d, end: 0x0827, type: "code" },
    ],
    references: [],
  });
});

test("a DXA label in a data region is a data symbol, so a user data symbol that DXA echoes gives no conflict", () => {
  const project = mkdtempSync(join(tmpdir(), "c64-re-tools-dxa-data-"));
  const own = openForWrite(project);
  try {
    renameSymbol(own, { origin: "user" }, { address: 0x0824, name: "table", kind: "variable" });
    const findings = dxaFindings({
      coverage: [{ start: 0x0801, end: 0x0827 }],
      regions: [
        { start: 0x0801, end: 0x0823, classification: "code" },
        { start: 0x0824, end: 0x0827, classification: "data" },
      ],
      labels: [
        { address: 0x080d, name: "l80d" },
        { address: 0x0824, name: "table" },
      ],
      listingBytes: 100,
      completeness: { regions: true, labels: false },
    });
    assert.deepEqual(findings.symbols, [
      { address: 0x080d, name: "l80d", kind: "label" },
      { address: 0x0824, name: "table", kind: "data" },
    ]);
    assert.deepEqual(importFindings(own, findings).conflicts, []);
  } finally {
    own.close();
    rmSync(project, { recursive: true, force: true });
  }
});
