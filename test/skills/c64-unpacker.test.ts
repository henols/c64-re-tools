// The c64-unpacker packing evidence. No emulator needed.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { inspect, readMemoryMap, writtenThenExecuted } from "../../skills/c64-unpacker/scripts/lib/evidence.ts";
import { callReturn, captureSegments, executedIn, stageCandidates, stagePoints, withoutRanges } from "../../skills/c64-unpacker/scripts/lib/stages.ts";
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
  for (const args of [["inspect"], ["capture", "packed.prg"], ["capture", "packed.prg", "--until", "49152", "--out", "x.prg"], ["unpack", "packed.prg"], ["trace", "packed.prg", "--until", "$1000"], ["inspect", "packed.prg", "--entry", "$1000"], ["capture", "packed.prg", "--until", "$1000", "--out", "x", "--exclude", "$a000"], ["capture", "packed.prg", "--until", "$1000", "--out", "x", "--exclude", "$a9ff-$a000"], ["stages", "packed.prg", "--exclude", "$a000-$a9ff"]]) {
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

test("a call into written code returns to the instruction after a JSR that the stage executed (D59)", () => {
  const stack = new Uint8Array(0x100);
  // JSR $7ec3 at $7a10 pushed $7a12; SP is $f7 after the push.
  stack[0xf8] = 0x12;
  stack[0xf9] = 0x7a;
  const code = new Map([[0x7a10, 0x20]]);
  const byteAt = (address: number) => code.get(address) ?? 0xea;
  assert.equal(callReturn(stack, 0xf7, byteAt, (address) => address === 0x7a10), 0x7a13);
  assert.equal(callReturn(stack, 0xf7, byteAt, () => false), undefined, "a JSR that the stage did not execute");
  assert.equal(callReturn(stack, 0xf5, byteAt, () => true), undefined, "no JSR before the address on top of the stack");
  // The stack pointer wraps in page 1.
  const wrapped = new Uint8Array(0x100);
  wrapped[0xff] = 0x12;
  wrapped[0x00] = 0x7a;
  assert.equal(callReturn(wrapped, 0xfe, byteAt, () => true), 0x7a13);
});

test("the code that a called block ran, with operand bytes, is the stage's own code and makes no candidate (D59)", () => {
  const map = new Uint8Array(0x10000);
  for (const address of [0x9e00, 0x9e02, 0x9e05, 0x9e40]) map[address] = COVERAGE.ramExecute;
  assert.deepEqual(executedIn(map, { start: 0x9e00, end: 0x9e41 }), [
    { start: 0x9e00, end: 0x9e07 },
    { start: 0x9e40, end: 0x9e41 },
  ]);
  const stage = new Uint8Array(0x10000);
  stage.fill(COVERAGE.ramWrite, 0x9e00, 0xa000);
  const chunk = new Uint8Array(0x10000);
  chunk[0x9e00] = COVERAGE.ramExecute;
  assert.deepEqual(stageCandidates(stage, chunk, new Set(), 64, [{ start: 0x9e00, end: 0x9e07 }]), []);
  assert.deepEqual(stagePoints([{ start: 0x9e00, end: 0x9e09 }], new Set(), () => true, [{ start: 0x9e00, end: 0x9e07 }]), { exec: [{ start: 0x9e08, end: 0x9e09 }], watch: [] });
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

const range = (start: number, end: number) => ({ start, end });

test("capture segments do not overlap, and a block that later stages wrote over is no leftover (F-26)", () => {
  // The stages of a tape release in the rc.5 test run, captured at $8ab2.
  const segments = captureSegments(
    [
      { entry: 0x081b, wrote: [range(0x0008, 0x00ff), range(0x5203, 0xcfff), range(0xe000, 0xffff)] },
      { entry: 0x00a8, wrote: [range(0x0200, 0x0700)] },
      { entry: 0x0690, wrote: [range(0x00c5, 0xcfff), range(0xe000, 0xffff)] },
      { entry: 0x01ca, wrote: [range(0x0000, 0x00c6), range(0x0400, 0x07e7), range(0x3000, 0x34ff), range(0x58fe, 0x5956), range(0x8c2e, 0x8c70), range(0xd000, 0xd0ff)] },
    ],
    0x8ab2,
  );
  assert.deepEqual(segments, [
    { start: 0x0000, end: 0xd0ff, writtenBy: 3 },
    { start: 0xe000, end: 0xffff, writtenBy: 2 },
  ]);
});

test("--exclude leaves ranges out of the capture segments, and a segment that a range cuts gives its parts", () => {
  // The Bruce Lee field run: the crack's mover left $a000-$a9ff, and $fe00-$fff9 is not the game's.
  const found = [
    { start: 0x033c, end: 0xa9ff, writtenBy: 2 },
    { start: 0xcf00, end: 0xcfff, writtenBy: 2 },
    { start: 0xe000, end: 0xf5ff, writtenBy: 2 },
    { start: 0xfe00, end: 0xffff, writtenBy: 1 },
  ];
  assert.deepEqual(withoutRanges(found, [range(0xa000, 0xa9ff), range(0xfe00, 0xfff9)]), [
    { start: 0x033c, end: 0x9fff, writtenBy: 2 },
    { start: 0xcf00, end: 0xcfff, writtenBy: 2 },
    { start: 0xe000, end: 0xf5ff, writtenBy: 2 },
    { start: 0xfffa, end: 0xffff, writtenBy: 1 },
  ]);
  assert.deepEqual(withoutRanges([range(0x1000, 0x1fff)], [range(0x1400, 0x14ff)]), [range(0x1000, 0x13ff), range(0x1500, 0x1fff)]);
  assert.deepEqual(withoutRanges([range(0x1000, 0x1fff)], [range(0x0800, 0x2fff)]), []);
});

test("a block with the code of a later intermediate stage is a leftover; the block with the capture entry never is (R2-01)", () => {
  // A packer: $080d copies a depacker to $c000; $c000 writes the program to $4000.
  const staged = [
    { entry: 0x080d, wrote: [range(0xc000, 0xc07f)] },
    { entry: 0xc000, wrote: [range(0x4000, 0x407f)] },
    { entry: 0x4000, wrote: [] },
  ];
  assert.deepEqual(captureSegments(staged, 0x4000), [{ start: 0x4000, end: 0x407f, writtenBy: 1 }]);
  // A release at $0801 moves a mover to $0340, and the mover writes the program back over $0801.
  const moved = [
    { entry: 0x080c, wrote: [range(0x0340, 0x037f)] },
    { entry: 0x0340, wrote: [range(0x0723, 0x449d)] },
    { entry: 0x0801, wrote: [range(0x00fd, 0x019c)] },
    { entry: 0x0111, wrote: [range(0x0800, 0x5fff)] },
    { entry: 0x0801, wrote: [] },
  ];
  // At the first $0801: the block holds the code of stage 0, which ran before the mover wrote over it.
  assert.deepEqual(captureSegments([...moved.slice(0, 2), { entry: 0x0801, wrote: [] }], 0x0801), [{ start: 0x0723, end: 0x449d, writtenBy: 1 }]);
  // At the second $0801: the code at $0111 and $0340 is loader code that nothing wrote over.
  assert.deepEqual(captureSegments(moved, 0x0801), [{ start: 0x0723, end: 0x5fff, writtenBy: 3 }]);
});
