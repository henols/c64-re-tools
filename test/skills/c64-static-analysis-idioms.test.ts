// 6502 idioms that hide code: found by pattern, written as heuristic
// findings, and their targets seeded into the same analysis run.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { COVERAGE } from "../../src/cpu/coverage.ts";
import { openForRead } from "../../src/knowledge/database.ts";
import { listReferences, listRegions } from "../../src/knowledge/read.ts";
import { DXA, findTool } from "../../src/native/discover.ts";
import { imageReader } from "../../skills/c64-static-analysis/scripts/lib/coverage.ts";
import { findIdioms } from "../../skills/c64-static-analysis/scripts/lib/idioms.ts";
import { findPointers } from "../../skills/c64-static-analysis/scripts/lib/pointers.ts";
import { findPitfalls } from "../../skills/c64-static-analysis/scripts/lib/pitfalls.ts";
import { readEnvelope } from "../kit.ts";
import { importImage, importPrg } from "../fixtures/program.ts";

const project = mkdtempSync(join(tmpdir(), "c64-re-tools-idioms-"));
after(() => rmSync(project, { recursive: true, force: true }));

/** A flat image with code placed at addresses, and the range that the tests analyze. */
function image(parts: Record<number, number[]>): { byteAt: ReturnType<typeof imageReader>; memory: Uint8Array } {
  const memory = new Uint8Array(0x10000).fill(0xea);
  for (const [address, bytes] of Object.entries(parts)) memory.set(bytes, Number(address));
  return { byteAt: imageReader(memory, "flat64k"), memory };
}
const RANGE = { start: 0x1000, end: 0x1fff };

test("an RTS dispatch with separate low and high tables gives both tables, the targets and jump references", () => {
  // $1000: LDA $1100,X / PHA / LDA $1200,X / PHA / RTS ; high bytes at $1100, low bytes at $1200, targets $1500 and $1600.
  const { byteAt } = image({ 0x1000: [0xbd, 0x00, 0x11, 0x48, 0xbd, 0x00, 0x12, 0x48, 0x60], 0x1100: [0x14, 0x15, 0x00], 0x1200: [0xff, 0xff, 0x00] });
  const found = findIdioms(byteAt, RANGE);
  assert.equal(found.counts.rtsTables, 1);
  assert.deepEqual(found.findings.regions, [
    { start: 0x1100, end: 0x1101, type: "bytes" },
    { start: 0x1200, end: 0x1201, type: "bytes" },
  ]);
  assert.deepEqual(found.findings.references, [
    { from: 0x1008, to: 0x1500, kind: "jump" },
    { from: 0x1008, to: 0x1600, kind: "jump" },
  ]);
  assert.ok(found.entryPoints.includes(0x1500) && found.entryPoints.includes(0x1600));
  assert.deepEqual(found.dataRanges, [{ start: 0x1100, end: 0x1101 }, { start: 0x1200, end: 0x1201 }], "the tables are data for the same run");
});

test("an RTS dispatch on a word table is one rts-addresses region, and on adjacent tables one split region", () => {
  // Word table at $1300: LDA $1301,X / PHA / LDA $1300,X / PHA / RTS with X stepping by 2.
  const word = findIdioms(image({ 0x1000: [0xbd, 0x01, 0x13, 0x48, 0xbd, 0x00, 0x13, 0x48, 0x60], 0x1300: [0xff, 0x14, 0xff, 0x15, 0x00, 0x00] }).byteAt, RANGE);
  assert.deepEqual(word.findings.regions, [{ start: 0x1300, end: 0x1303, type: "rts-addresses" }]);
  // Low bytes at $1300, high bytes right after at $1302.
  const split = findIdioms(image({ 0x1000: [0xbd, 0x02, 0x13, 0x48, 0xbd, 0x00, 0x13, 0x48, 0x60], 0x1300: [0xff, 0xff, 0x14, 0x15, 0x00] }).byteAt, RANGE);
  assert.deepEqual(split.findings.regions, [{ start: 0x1300, end: 0x1303, type: "rts-addresses-split" }]);
});

test("three JMP abs in a row are a JMP table; a BIT skip is dual-use bytes with the reference to its inner entry", () => {
  const jumps = findIdioms(image({ 0x1400: [0x4c, 0x00, 0x15, 0x4c, 0x00, 0x16, 0x4c, 0x00, 0x17] }).byteAt, RANGE);
  assert.deepEqual(jumps.findings.regions, [{ start: 0x1400, end: 0x1408, type: "jumps" }]);
  assert.deepEqual(jumps.entryPoints.filter((entry) => entry >= 0x1400), [0x1400, 0x1403, 0x1406, 0x1500, 0x1600, 0x1700]);
  // $1800: BIT $01a9 skips LDA #$01 ; $1810: JMP $1801 enters it.
  const skip = findIdioms(image({ 0x1800: [0x2c, 0xa9, 0x01], 0x1810: [0x4c, 0x01, 0x18] }).byteAt, RANGE);
  assert.deepEqual(skip.findings.regions, [{ start: 0x1801, end: 0x1802, type: "dual-use" }]);
  assert.deepEqual(skip.findings.references, [{ from: 0x1810, to: 0x1801, kind: "jump" }]);
});

/** The coverage of the knowledge from runs: the joined map, and wx where one run wrote and executed. */
function covered(...runs: Uint8Array[]): { map: Uint8Array; selfModified: Uint8Array } {
  const both = COVERAGE.ramWrite | COVERAGE.ramExecute;
  const map = new Uint8Array(0x10000);
  const selfModified = new Uint8Array(0x10000);
  for (const run of runs) {
    for (let address = 0; address < 0x10000; address++) {
      map[address]! |= run[address]!;
      if ((run[address]! & both) === both) selfModified[address] = 1;
    }
  }
  return { map, selfModified };
}

test("DOP padding and self-modified opcodes are candidates from the coverage only", () => {
  const { byteAt } = image({ 0x1a00: [0x80, 0x00, 0xa9, 0x01, 0xa9, 0x02] });
  const run = new Uint8Array(0x10000);
  run[0x1a00] = COVERAGE.ramExecute;
  run[0x1a02] = COVERAGE.ramExecute | COVERAGE.ramWrite;
  const found = findIdioms(byteAt, RANGE, covered(run));
  assert.deepEqual(found.candidates, { dop: [0x1a00], selfModified: [0x1a02] });
  assert.deepEqual(findIdioms(byteAt, RANGE).candidates, { dop: [], selfModified: [] });
});

test("a self-modified opcode is written and executed in one run: a copier's writes in another run do not count", () => {
  const { byteAt } = image({ 0x1a00: [0xa9, 0x01, 0xa9, 0x02] });
  // The copier run writes $1a00-$1a03; the game run executes them and writes $1a02 again.
  const copier = new Uint8Array(0x10000).fill(COVERAGE.ramWrite, 0x1a00, 0x1a04);
  const game = new Uint8Array(0x10000);
  game[0x1a00] = COVERAGE.ramExecute;
  game[0x1a02] = COVERAGE.ramExecute | COVERAGE.ramWrite;
  assert.deepEqual(findIdioms(byteAt, RANGE, covered(copier, game)).candidates.selfModified, [0x1a02]);
  // More than 64 are all given: the result lists them with their count.
  const many = new Uint8Array(0x10000).fill(COVERAGE.ramExecute | COVERAGE.ramWrite, 0x1000, 0x1100);
  assert.equal(findIdioms(byteAt, RANGE, covered(many)).candidates.selfModified.length, 0x100);
});

test("an analysis writes the idioms as heuristic knowledge and DXA finds the code behind an RTS table", { skip: (() => { try { findTool(DXA); return false; } catch { return "dxa is not installed"; } })(), timeout: 120_000 }, () => {
  // 10 SYS2061 ; $080d: LDX #0 / LDA $0830,X / PHA / LDA $0828,X / PHA / RTS ; low $0828: $1f ; high $0830: $08 ; target $0820: INC $d020 / JMP $0820.
  const prg = new Uint8Array(2 + 0x0838 - 0x0801).fill(0);
  prg.set([0x01, 0x08, 0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00]);
  const at = (address: number, bytes: number[]) => prg.set(bytes, address - 0x0801 + 2);
  at(0x080d, [0xa2, 0x00, 0xbd, 0x30, 0x08, 0x48, 0xbd, 0x28, 0x08, 0x48, 0x60]);
  at(0x0820, [0xee, 0x20, 0xd0, 0x4c, 0x20, 0x08]);
  at(0x0828, [0x1f]);
  at(0x0830, [0x08]);
  importPrg(project, prg);
  const script = resolve(import.meta.dirname, "../../skills/c64-static-analysis/scripts/static-analysis.ts");
  const run = spawnSync(process.execPath, [...process.execArgv, script, "analyze", "--analyzer", "dxa"], { cwd: project, encoding: "utf8", env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });
  const json = readEnvelope(run.stdout, run.status).json as { idioms: { rtsTables: number; revision: number | null } };
  assert.equal(json.idioms.rtsTables, 1, run.stdout);
  const db = openForRead(project);
  assert.ok(listRegions(db).some((region) => region.origin === "heuristic" && region.start === 0x0828), "the low table is heuristic knowledge");
  assert.ok(listReferences(db).some((reference) => reference.origin === "heuristic" && reference.from === 0x0817 && reference.to === 0x0820));
  assert.equal(listRegions(db, { start: 0x0820, end: 0x0820 })[0]?.type, "code", "DXA, seeded with the target, sees code");
  db?.close();
});

test("an RTS table at the end of a segment ends there: the bytes after the program give no targets", { skip: (() => { try { findTool(DXA); return false; } catch { return "dxa is not installed"; } })(), timeout: 120_000 }, () => {
  // Two segments, so the analyzer gets the 64 KiB, with 0 outside the segments.
  // $080d: LDX #0 / LDA $0837,X / PHA / LDA $0836,X / PHA / $0817 RTS ; the word table at $0836 is the last 2 bytes of the segment: target $0820.
  const memory = new Uint8Array(0x10000);
  memory.set([0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00], 0x0801);
  memory.set([0xa2, 0x00, 0xbd, 0x37, 0x08, 0x48, 0xbd, 0x36, 0x08, 0x48, 0x60], 0x080d);
  memory.set([0xee, 0x20, 0xd0, 0x4c, 0x20, 0x08], 0x0820);
  memory.set([0x1f, 0x08], 0x0836);
  memory[0xc000] = 0x60;
  const own = mkdtempSync(join(tmpdir(), "c64-re-tools-idioms-end-"));
  try {
    importImage(own, memory, { space: "c64", segments: [{ start: 0x0801, end: 0x0837 }, { start: 0xc000, end: 0xc000 }] });
    const script = resolve(import.meta.dirname, "../../skills/c64-static-analysis/scripts/static-analysis.ts");
    const run = spawnSync(process.execPath, [...process.execArgv, script, "analyze", "--analyzer", "dxa", "--entry", "$080d"], { cwd: own, encoding: "utf8", env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });
    assert.equal(readEnvelope(run.stdout, run.status).envelope.ok, true, run.stdout);
    const db = openForRead(own);
    const heuristic = listReferences(db).filter((reference) => reference.origin === "heuristic");
    assert.deepEqual(heuristic.map((reference) => [reference.from, reference.to, reference.kind]), [[0x0817, 0x0820, "jump"]], "no target in the zero bytes after the segment");
    assert.deepEqual(listRegions(db).filter((region) => region.origin === "heuristic").map((region) => [region.start, region.end, region.type]), [[0x0836, 0x0837, "rts-addresses"]]);
    db?.close();
  } finally {
    rmSync(own, { recursive: true, force: true });
  }
});

test("pointer candidates: immediate pairs stored to a vector or a (zp),y pair, and sprite pointers in a sprite region, all in code", () => {
  const { byteAt } = image({
    // $1000: SEI / LDA #$c0 / STA $0314 / LDA #$10 / STA $0315: CINV gets $10c0.
    0x1000: [0x78, 0xa9, 0xc0, 0x8d, 0x14, 0x03, 0xa9, 0x10, 0x8d, 0x15, 0x03],
    // $1020: LDX #$00 / LDY #$04 / STX $fb / STY $fc, and later LDA ($fb),Y: $fb gets VICSCN, a platform name.
    0x1020: [0xa2, 0x00, 0xa0, 0x04, 0x86, 0xfb, 0x84, 0xfc],
    0x1030: [0xb1, 0xfb],
    // $1040: LDA #$00 / STA $fd / LDA #$90 / STA $fe: $fd is no (zp),y pair and $9000 is outside the image.
    0x1040: [0xa9, 0x00, 0x85, 0xfd, 0xa9, 0x90, 0x85, 0xfe],
    // $1050: LDA #$c5 / STA $07f9: sprite data at $3140; LDA #$02 / STA $07fa: $0080 is no sprite.
    0x1050: [0xa9, 0xc5, 0x8d, 0xf9, 0x07, 0xa9, 0x02, 0x8d, 0xfa, 0x07],
    // $1060: LDA #$00 / JSR / STA $0318: the run ends at the JSR.
    0x1060: [0xa9, 0x00, 0x20, 0x00, 0x10, 0x8d, 0x18, 0x03, 0xa9, 0x10, 0x8d, 0x19, 0x03],
    // $1070: LDA #$00 / STA $f7 / LDA #$10 / STA $f8 in code; LDA ($f7),Y only in the data at $1080: $f7 is no (zp),y pair.
    0x1070: [0xa9, 0x00, 0x85, 0xf7, 0xa9, 0x10, 0x85, 0xf8],
    0x1080: [0x00, 0xb1, 0xf7, 0x00],
    // $1090, data: LDA #$c0 / STA $0316 / LDA #$10 / STA $0317, bytes that are no code.
    0x1090: [0xa9, 0xc0, 0x8d, 0x16, 0x03, 0xa9, 0x10, 0x8d, 0x17, 0x03],
  });
  const code = [{ start: 0x1000, end: 0x107f }];
  const found = findPointers(byteAt, RANGE, code, { platform: (address: number) => address >= 0x0400 && address <= 0x07e7, sprites: [{ start: 0x3000, end: 0x3fff }] });
  assert.deepEqual(found, [
    { kind: "vector", to: 0x0314, target: 0x10c0, low: 0x1001, high: 0x1006 },
    { kind: "zero-page pointer", to: 0xfb, target: 0x0400, low: 0x1020, high: 0x1022 },
    { kind: "sprite pointer", to: 0x07f9, target: 0x3140, at: 0x1050, value: 0xc5 },
  ]);
});

test("the CBM80 header of a cartridge bank gives its two start vectors as entry points", () => {
  // $8000: cold start $8009, warm start $8020, then "CBM80"; code at both targets.
  const { byteAt } = image({ 0x8000: [0x09, 0x80, 0x20, 0x80, 0xc3, 0xc2, 0xcd, 0x38, 0x30, 0x78], 0x8020: [0x40] });
  const bank = { start: 0x8000, end: 0x9fff };
  const found = findIdioms(byteAt, bank);
  assert.equal(found.counts.cartridgeHeaders, 1);
  assert.ok(found.entryPoints.includes(0x8009) && found.entryPoints.includes(0x8020), JSON.stringify(found.entryPoints));
  assert.deepEqual(found.findings.regions.slice(0, 2), [
    { start: 0x8000, end: 0x8003, type: "addresses" },
    { start: 0x8004, end: 0x8008, type: "petscii" },
  ]);
  const plain = image({ 0x8000: [0x09, 0x80, 0x20, 0x80, 0x41, 0x42, 0x43, 0x44, 0x45] });
  assert.equal(findIdioms(plain.byteAt, bank).counts.cartridgeHeaders, 0, "no header without CBM80");
});

test("a $D011 value written back with raster bit 8 is a pitfall; AND #$7F, a new load or a branch between is not", () => {
  const image = new Uint8Array(0x10000);
  // The Bruce Lee freeze: $09bc LDA $d011 / AND #$ef / STA $d011.
  image.set([0xad, 0x11, 0xd0, 0x29, 0xef, 0x8d, 0x11, 0xd0], 0x09bc);
  // Safe: LDA $d011 / AND #$7f / STA $d011.
  image.set([0xad, 0x11, 0xd0, 0x29, 0x7f, 0x8d, 0x11, 0xd0], 0x0a00);
  // Safe: LDA $d011 / LDA #$1b / STA $d011.
  image.set([0xad, 0x11, 0xd0, 0xa9, 0x1b, 0x8d, 0x11, 0xd0], 0x0b00);
  // Pitfall: INC $d011.
  image.set([0xee, 0x11, 0xd0], 0x0c00);
  // Pitfall with X: LDX $d011 / STX $d011.
  image.set([0xae, 0x11, 0xd0, 0x8e, 0x11, 0xd0], 0x0d00);
  const byteAt = (address: number) => image[address];
  const regions = [
    { start: 0x09bc, end: 0x09c3 },
    { start: 0x0a00, end: 0x0a07 },
    { start: 0x0b00, end: 0x0b07 },
    { start: 0x0c00, end: 0x0c02 },
    { start: 0x0d00, end: 0x0d05 },
  ];
  assert.deepEqual(findPitfalls(byteAt, regions), [
    { kind: "raster-bit-8", at: 0x09bc, store: 0x09c1 },
    { kind: "raster-bit-8", at: 0x0c00, store: 0x0c00 },
    { kind: "raster-bit-8", at: 0x0d00, store: 0x0d03 },
  ]);
});
