// The c64-unpacker packing evidence. No emulator needed.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { inspect, readMemoryMap, writtenThenExecuted } from "../../skills/c64-unpacker/scripts/evidence.ts";
import { stageCandidates, stagePoints } from "../../skills/c64-unpacker/scripts/stages.ts";
import { COVERAGE } from "../../src/c64.ts";
import { xorPackedPrg } from "../fixtures/prg/xor-packed.ts";
import { seededBytes } from "../kit.ts";

const project = mkdtempSync(join(tmpdir(), "c64-re-tools-unpacker-"));
after(() => rmSync(project, { recursive: true, force: true }));

const stub = [0x01, 0x08, 0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00];

test("random-looking bytes after a BASIC start look packed", () => {
  const result = inspect(Uint8Array.from([...stub, ...seededBytes(0x6502, 4096)]));
  assert.equal(result.packing, "likely");
  assert.deepEqual(result.basicStart, { line: 10, sys: "$080d" });
  assert.equal((result.entropy as { blocks: number }).blocks, 16);
});

test("a SYS π*656 start line is a BASIC start, and its value is the start address", () => {
  // The line, then LDY #$00 / SEI where the next link would be.
  const start = [0x01, 0x08, 0x0c, 0x08, 0xc9, 0x07, 0x9e, 0xff, 0xac, 0x36, 0x35, 0x36, 0x00, 0xa0, 0x00, 0x78];
  const result = inspect(Uint8Array.from([...start, ...seededBytes(0x1984, 4096)]));
  assert.deepEqual(result.basicStart, { line: 1993, sys: "$080c" });
  assert.deepEqual(result.basicText, ["1993 SYSπ*656"]);
  assert.equal(result.packing, "likely");
});

test("a SYS that needs run-time values gives its argument and no address", () => {
  // 10 SYS PEEK(43)+12
  const line = [0x9e, 0xc2, 0x28, 0x34, 0x33, 0x29, 0xaa, 0x31, 0x32];
  const next = 0x0801 + 4 + line.length + 1;
  const result = inspect(Uint8Array.from([0x01, 0x08, next & 0xff, next >> 8, 0x0a, 0x00, ...line, 0x00, 0x00, 0x00, ...seededBytes(7, 600)]));
  assert.deepEqual(result.basicStart, { line: 10, sys: null, expression: "PEEK(43)+12" });
  assert.equal(result.start, null);
});

test("code-like bytes do not look packed", () => {
  // A plain routine pattern repeated: LDA abs,X / STA abs,Y / INX / BNE.
  const code = Array.from({ length: 4096 }, (_, index) => [0xbd, 0x00, 0x20, 0x99, 0x00, 0x30, 0xe8, 0xd0, 0xf7][index % 9]!);
  const result = inspect(Uint8Array.from([0x00, 0xc0, ...code]));
  assert.equal(result.packing, "unlikely");
  assert.equal(result.basicStart, null);
  assert.deepEqual(result.loadRange, { start: "$c000", end: "$cfff" });
});

test("a short program is unclear, and the script reports it", () => {
  writeFileSync(join(project, "packed.prg"), xorPackedPrg);
  const script = resolve(import.meta.dirname, "../../skills/c64-unpacker/scripts/unpack.ts");
  const run = spawnSync(process.execPath, [...process.execArgv, script, "inspect", "packed.prg"], { cwd: project, encoding: "utf8" });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const result = JSON.parse(run.stdout) as Record<string, unknown>;
  assert.equal(result.packing, "unclear");
  assert.deepEqual(result.basicStart, { line: 10, sys: "$080d" });
  for (const args of [["inspect"], ["capture", "packed.prg"], ["capture", "packed.prg", "--until", "49152", "--out", "x.prg"], ["unpack", "packed.prg"], ["trace", "packed.prg", "--until", "$1000"], ["inspect", "packed.prg", "--entry", "$1000"]]) {
    const bad = spawnSync(process.execPath, [...process.execArgv, script, ...args], { cwd: project, encoding: "utf8" });
    assert.equal(bad.status, 2, args.join(" "));
  }
});

test("the memory map is read again from next until no more ranges follow", async () => {
  // One range for each executed byte in $2000-$27ff: more than one read gives.
  const executed = Array.from({ length: 0x800 }, (_, index) => ({ start: 0x2000 + index, end: 0x2000 + index, read: false, write: true, execute: true }));
  const reads: number[] = [];
  const ranges = await readMemoryMap(async (start) => {
    reads.push(start);
    const rest = executed.filter((range) => range.start >= start);
    return rest.length > 1000 ? { ranges: rest.slice(0, 1000), next: rest[1000]!.start } : { ranges: rest };
  });
  assert.deepEqual(ranges, executed);
  assert.deepEqual(reads, [0x0000, 0x2000 + 1000, 0x2000 + 2000]);
});

test("code that runs in a ROM area is not unpacked code, also when the program wrote the RAM below it", () => {
  const range = (start: number, end: number) => ({ start, end, read: false, write: true, execute: true });
  const kernal = writtenThenExecuted([range(0xe000, 0xe0ff)], 0xe010);
  assert.deepEqual(kernal, { written: [{ start: 0xe000, end: 0xe0ff }], counted: [], bytes: 0 });
  const unpacked = writtenThenExecuted([range(0x0810, 0x0810), range(0x0812, 0x0900), range(0xe000, 0xe0ff)], 0x0820);
  assert.deepEqual(unpacked, {
    written: [
      { start: 0x0810, end: 0x0900 },
      { start: 0xe000, end: 0xe0ff },
    ],
    counted: [{ start: 0x0810, end: 0x0900 }],
    bytes: 0xf1,
    running: { start: 0x0810, end: 0x0900 },
  });
});

test("inspect refuses a link to a file outside the project", { skip: process.platform === "win32" ? "a symbolic link needs extra rights on Windows" : false }, () => {
  const outside = mkdtempSync(join(tmpdir(), "c64-re-tools-unpacker-outside-"));
  try {
    writeFileSync(join(outside, "game.prg"), xorPackedPrg);
    symlinkSync(join(outside, "game.prg"), join(project, "linked.prg"));
    const script = resolve(import.meta.dirname, "../../skills/c64-unpacker/scripts/unpack.ts");
    const linked = spawnSync(process.execPath, [...process.execArgv, script, "inspect", "linked.prg"], { cwd: project, encoding: "utf8" });
    assert.equal(linked.status, 1, linked.stdout + linked.stderr);
    assert.equal((JSON.parse(linked.stdout) as { error: { code: string } }).error.code, "invalid-input");
    const missing = spawnSync(process.execPath, [...process.execArgv, script, "inspect", "missing.prg"], { cwd: project, encoding: "utf8" });
    assert.equal(missing.status, 1, missing.stdout + missing.stderr);
    assert.equal((JSON.parse(missing.stdout) as { error: { code: string } }).error.code, "not-found");
  } finally {
    rmSync(outside, { recursive: true, force: true });
  }
});

test("inspect reports the start code that decodes and moves bytes, and the BASIC text, as evidence (D43)", () => {
  const result = inspect(xorPackedPrg);
  assert.deepEqual(result.basicText, ["10 SYS2061"]);
  assert.deepEqual(result.start, { at: "$080d", jumpsOutside: "$c000", writesOutside: "$c000" });
  assert.deepEqual(result.decodeLoops, ["$0812"], "LDA payload,X / EOR #key / STA $c000,X / ... / BNE");
});

test("plain-looking bytes behind start code that moves them are unclear, not unlikely, and a banner shows as text", () => {
  // 10 SYS<start> CRUNCHED BY SOMEONE: the banner is text after the SYS address, as crunchers write it.
  const banner = [...Buffer.from(" CRUNCHED BY SOMEONE", "latin1")];
  // The line with a 4-digit address is 4 + 1 + 4 + banner + 1 bytes long, the end marker 2: the code starts after them.
  const start = 0x0801 + 4 + 1 + 4 + banner.length + 1 + 2;
  const line = [0x9e, ...Buffer.from(String(start), "latin1"), ...banner];
  const next = 0x0801 + 4 + line.length + 1;
  const basic = [0x01, 0x08, next & 0xff, next >> 8, 0x0a, 0x00, ...line, 0x00, 0x00, 0x00];
  assert.equal(0x0801 + basic.length - 2, start, "the code starts at the SYS address");
  // At the SYS address: LDA $0900,X / STA $c000,X / INX / BNE / JMP $c000, then 4 KiB that looks like code.
  const code = [0xbd, 0x00, 0x09, 0x9d, 0x00, 0xc0, 0xe8, 0xd0, 0xf7, 0x4c, 0x00, 0xc0];
  const plain = Array.from({ length: 4096 }, (_, index) => [0xbd, 0x00, 0x20, 0x99, 0x00, 0x30, 0xe8, 0xd0, 0xf7][index % 9]!);
  const result = inspect(Uint8Array.from([...basic, ...code, ...plain]));
  assert.deepEqual(result.basicText, [`10 SYS${start} CRUNCHED BY SOMEONE`]);
  assert.deepEqual(result.start, { at: `$${start.toString(16).padStart(4, "0")}`, jumpsOutside: "$c000", writesOutside: "$c000" });
  assert.deepEqual(result.decodeLoops, [], "a copy without EOR is no decode loop");
  assert.equal(result.packing, "unclear", "the entropy alone says unlikely");
  assert.match(result.evidence, /decodes or moves bytes outside the program/);
});

test("a written block is a stage candidate only through code that is not own code the stage has not written (F-17)", () => {
  const stage = new Uint8Array(0x10000);
  const chunk = new Uint8Array(0x10000);
  // The chunk wrote $0800-$08ff over start code at $080c that it executed before.
  chunk.fill(COVERAGE.ramWrite, 0x0800, 0x0900);
  chunk[0x080c]! |= COVERAGE.ramExecute;
  assert.deepEqual(stageCandidates(stage, chunk, new Set(), 64), [{ start: 0x0800, end: 0x08ff }], "the order is not known yet");
  // Own code that is not written does not make a candidate, and a small block is no stage.
  const unwritten = new Uint8Array(0x10000);
  unwritten.fill(COVERAGE.ramWrite, 0x0800, 0x0900);
  unwritten[0x080c] = COVERAGE.ramExecute;
  assert.deepEqual(stageCandidates(stage, unwritten, new Set([0x080c]), 64), []);
  assert.deepEqual(stageCandidates(stage, chunk, new Set(), 512), []);
});

test("the points of a run: exec breakpoints over the blocks, write watches over own code that is not written (F-17)", () => {
  const own = new Set([0x0802, 0x0803, 0x0810]);
  const written = (address: number) => address === 0x0810;
  assert.deepEqual(stagePoints([{ start: 0x0800, end: 0x0811 }], own, written), {
    exec: [
      { start: 0x0800, end: 0x0801 },
      { start: 0x0804, end: 0x0811 },
    ],
    watch: [{ start: 0x0802, end: 0x0803 }],
  });
});
