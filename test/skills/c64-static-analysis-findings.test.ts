// Seeds from knowledge and the Ghidra → normalized findings mapping of the
// c64-static-analysis script. No Ghidra needed.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { openForWrite } from "../../src/knowledge/database.ts";
import { importFindings } from "../../src/knowledge/import.ts";
import { classifyRegion, renameSymbol } from "../../src/knowledge/write.ts";
import { ghidraFindings, seedsFromKnowledge } from "../../skills/c64-static-analysis/scripts/findings.ts";

const root = mkdtempSync(join(tmpdir(), "c64-re-tools-findings-"));
const db = openForWrite(root);
after(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

test("seeds come from current knowledge: routines, non-code regions and semantic names", () => {
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
  assert.deepEqual(seedsFromKnowledge(db, [0x080d, 0x2100]), {
    entryPoints: [0x080d, 0x2100, 0x2200],
    dataRanges: [{ start: 0x4000, end: 0x403f }],
    labels: [
      { address: 0x2100, name: "update_player" },
      { address: 0x3000, name: "player_x" },
    ],
  });
});

test("an echoed seed name is no Ghidra symbol; code is code and data is bytes", () => {
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
    completeness: { functions: true, regions: true, references: false },
  });
  assert.deepEqual(findings, {
    analyzer: "ghidra",
    coverage: [{ start: 0x0801, end: 0x0827 }],
    authoritative: { symbols: true, regions: true, references: false },
    symbols: [
      { address: 0x080d, name: "FUN_080d", kind: "routine" },
      { address: 0x0820, name: "entry", kind: "routine" },
    ],
    regions: [
      { start: 0x080d, end: 0x0815, type: "code" },
      { start: 0x0824, end: 0x0827, type: "bytes" },
    ],
    references: [{ from: 0x080d, to: 0x0818, kind: "call" }],
  });
});
