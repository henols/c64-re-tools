// The static analysis of a ZX Spectrum program: the Z80 idioms (the inline
// bytes of RST $08 and RST $28), the refusals and the ROM of the machine, and
// Ghidra's Z80 language on a project with a snapshot.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { machineRom, outsideRom } from "../../skills/retro-static-analysis/scripts/lib/findings.ts";
import { findZ80Idioms } from "../../skills/retro-static-analysis/scripts/lib/z80-idioms.ts";
import { COVERAGE } from "../../src/cpu/coverage.ts";
import { openForRead, openForWrite } from "../../src/knowledge/database.ts";
import { listAnalyzerNames, listReferences, listRegions, listSymbols, referencesFrom } from "../../src/knowledge/read.ts";
import { MACHINES } from "../../src/machine.ts";
import { classifyRegion } from "../../src/knowledge/write.ts";
import { importCoverage, importSnapshot } from "../fixtures/program.ts";
import { keyboardCounterRam, z80Snapshot } from "../fixtures/z80/keyboard-counter.ts";
import { readEnvelope } from "../kit.ts";

const skills = resolve(import.meta.dirname, "../../skills");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-z80-analysis-"));
mkdirSync(join(project, ".c64-re-tools", "local"), { recursive: true });
after(() => rmSync(project, { recursive: true, force: true }));

test("the code that the entry reaches gives the inline bytes of RST $08 and RST $28 as data, and the code after end-calc as a code start", () => {
  const memory = new Map<number, number>();
  const put = (address: number, bytes: number[]) => bytes.forEach((byte, index) => memory.set(address + index, byte));
  // $8000: CALL $8010 ; RST $08 ; DEFB $0b (an error code)
  put(0x8000, [0xcd, 0x10, 0x80, 0xcf, 0x0b]);
  // $8010: RST $28 ; DEFB $a1, $0f, $38 (stk-one, addition, end-calc) ; RET
  put(0x8010, [0xef, 0xa1, 0x0f, 0x38, 0xc9]);
  // $8020: an RST $08 that no code reaches is no idiom.
  put(0x8020, [0xcf, 0x01]);
  const found = findZ80Idioms((address) => memory.get(address), { start: 0x8000, end: 0x80ff }, [0x8000]);
  assert.deepEqual(found.dataRanges, [
    { start: 0x8004, end: 0x8004 },
    { start: 0x8011, end: 0x8013 },
  ]);
  assert.deepEqual(found.codeStarts, [0x8014]);
  assert.deepEqual(found.counts, { errorRestarts: 1, calculatorRestarts: 1 });
  assert.deepEqual(found.findings.regions.map((region) => region.type), ["bytes", "bytes"]);
});

test("calculator literals without end-calc in reach are no idiom", () => {
  const bytes = [0xef, ...Array.from({ length: 200 }, () => 0xa1)];
  const found = findZ80Idioms((address) => bytes[address - 0x8000], { start: 0x8000, end: 0x80ff }, [0x8000]);
  assert.deepEqual([found.dataRanges, found.codeStarts, found.counts.calculatorRestarts], [[], [], 0]);
});

test("the analysis of a Spectrum program refuses DXA, macros and an entry in the ROM, and keeps the findings out of the ROM but not a call into it", () => {
  const request = { analyzer: "ghidra", applyMacros: false, entries: [0x8000], space: "spectrum" };
  assert.deepEqual(machineRom(MACHINES.spectrum48, request), [{ start: 0x0000, end: 0x3fff }]);
  assert.deepEqual(machineRom(MACHINES.c64, { ...request, space: "c64", analyzer: "dxa", applyMacros: true }), []);
  assert.throws(() => machineRom(MACHINES.spectrum48, { ...request, analyzer: "dxa" }), { code: "invalid-input", message: /^--analyzer dxa reads only 6502 code, and the ZX Spectrum 48K has a Z80/ });
  assert.throws(() => machineRom(MACHINES.spectrum48, { ...request, applyMacros: true }), { code: "invalid-input", message: /the generated source of the ZX Spectrum 48K has no macros/ });
  assert.throws(() => machineRom(MACHINES.spectrum48, { ...request, entries: [0x0010] }), { code: "invalid-input", message: /^--entry \$0010 is in the ROM of the ZX Spectrum 48K \(\$0000-\$3fff\)/ });

  const kept = outsideRom(
    {
      analyzer: "ghidra",
      coverage: [{ start: 0x0000, end: 0xffff }],
      authoritative: { symbols: false, regions: false, references: false },
      symbols: [{ address: 0x028e, name: "FUN_028e", kind: "routine" }, { address: 0x8027, name: "FUN_8027", kind: "routine" }],
      regions: [{ start: 0x3ff0, end: 0x4010, type: "code" }],
      references: [{ from: 0x8027, to: 0x028e, kind: "call" }, { from: 0x0300, to: 0x8000, kind: "jump" }],
    },
    [{ start: 0x0000, end: 0x3fff }],
  );
  assert.deepEqual([kept.coverage, kept.symbols, kept.regions, kept.references], [
    [{ start: 0x4000, end: 0xffff }],
    [{ address: 0x8027, name: "FUN_8027", kind: "routine" }],
    [{ start: 0x4000, end: 0x4010, type: "code" }],
    [{ from: 0x8027, to: 0x028e, kind: "call" }],
  ]);
});

test("Ghidra's Z80 language finds the routines of the counter and its calls and of a table of code addresses, and decodes nothing in the ROM that a run read and the program calls", { timeout: 600_000 }, () => {
  // The counter, and at $8027 CALL KEY_SCAN ($028e) before COUNT.
  const ram = keyboardCounterRam();
  ram.set([0xcd, 0x8e, 0x02], 0x8027 - 0x4000);
  ram.fill(0, 0x802a - 0x4000, 0x8030 - 0x4000);
  // A table of code addresses at $9100: the executed entry $8000, and a RET at $9000 that only the table reaches.
  ram[0x9000 - 0x4000] = 0xc9;
  ram.set([0x00, 0x80, 0x00, 0x90], 0x9100 - 0x4000);
  importSnapshot(project, z80Snapshot(ram, { pc: 0x8000, sp: 0xff00, iy: 0x5c3a, im: 1, border: 7 }));
  const writer = openForWrite(project);
  classifyRegion(writer, { origin: "llm" }, { start: 0x9100, end: 0x9103, type: "addresses" });
  writer.close();
  // A run executed the counter and read and executed the ROM.
  const map = new Uint8Array(0x10000);
  map.fill(COVERAGE.romRead | COVERAGE.romExecute, 0x0038, 0x0100);
  map[0x8000] = COVERAGE.ramExecute;
  importCoverage(project, { "run.bin": map });

  const child = spawnSync(process.execPath, [...process.execArgv, join(skills, "retro-static-analysis", "scripts", "static-analysis.ts"), "analyze", "--entry", "$8027", "--out-instructions", ".c64-re-tools/local/instructions.json"], { cwd: project, encoding: "utf8", timeout: 600_000 });
  const analyzed = readEnvelope(child.stdout, child.status).json as Record<string, unknown>;
  assert.equal(child.status, 0, JSON.stringify(analyzed));
  assert.ok(existsSync(join(project, ".c64-re-tools", "local", "instructions.json")));
  const functions = (analyzed.functions as { listed: Array<{ entry: string }> }).listed.map((fn) => fn.entry);
  for (const entry of ["$8000", "$8027", "$8030", "$9000"]) assert.ok(functions.includes(entry), functions.join(", "));
  assert.ok(!functions.includes("$028e"), functions.join(", "));
  assert.deepEqual(analyzed.coverage, [{ start: "$4000", end: "$ffff" }]);
  assert.deepEqual(Object.keys(analyzed.coverageSeeds as object), ["entryPoints", "used"]);
  assert.deepEqual(analyzed.idioms, { ...(analyzed.idioms as object), errorRestarts: 0, calculatorRestarts: 0 });

  const db = openForRead(project);
  try {
    const rom = { start: 0x0000, end: 0x3fff };
    assert.deepEqual([listRegions(db, rom).length, listSymbols(db, rom).length, listAnalyzerNames(db, rom).length], [0, 0, 0]);
    assert.ok(listReferences(db, { start: 0x8012, end: 0x8014 }).some((reference) => reference.to === 0x8030));
    assert.ok(referencesFrom(db, 0x8027).some((reference) => reference.to === 0x028e && reference.kind === "call"));
  } finally {
    db?.close();
  }
});
