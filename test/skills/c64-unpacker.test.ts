// The c64-unpacker packing evidence. No emulator needed.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { inspect, readMemoryMap, writtenThenExecuted } from "../../skills/c64-unpacker/scripts/lib/evidence.ts";
import { removeStaleFiles } from "../../skills/c64-unpacker/scripts/lib/machine.ts";
import { callReturn, captureSegments, executedIn, stageCandidates, stagePoints, withoutRanges } from "../../skills/c64-unpacker/scripts/lib/stages.ts";
import { COVERAGE } from "../../src/c64.ts";
import { xorPackedPrg } from "../fixtures/prg/xor-packed.ts";
import { readEnvelope, seededBytes } from "../kit.ts";

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
  const script = resolve(import.meta.dirname, "../../skills/c64-unpacker/scripts/unpacker.ts");
  const run = spawnSync(process.execPath, [...process.execArgv, script, "inspect", "packed.prg"], { cwd: project, encoding: "utf8" });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const { envelope, json: result } = readEnvelope(run.stdout, run.status);
  assert.equal(result.packing, "unclear");
  assert.deepEqual(result.basicStart, { line: 10, sys: "$080d" });
  assert.equal(envelope.hint, "Run trace to get the evidence of a run.");
  assert.match(envelope.nextAction!, /^node \/\S+unpacker\.ts trace packed\.prg --project \//);
  for (const args of [["inspect"], ["capture", "packed.prg"], ["capture", "packed.prg", "--until", "49152", "--out", "x.prg"], ["unpack", "packed.prg"], ["trace", "packed.prg", "--until", "$1000"], ["inspect", "packed.prg", "--entry", "$1000"], ["capture", "packed.prg", "--until", "$1000", "--out", "x", "--exclude", "$a000"], ["capture", "packed.prg", "--until", "$1000", "--out", "x", "--exclude", "$a9ff-$a000"], ["stages", "packed.prg", "--exclude", "$a000-$a9ff"]]) {
    const bad = spawnSync(process.execPath, [...process.execArgv, script, ...args], { cwd: project, encoding: "utf8" });
    assert.equal(bad.status, 2, args.join(" "));
    assert.equal(readEnvelope(bad.stdout, bad.status).envelope.ok, false, args.join(" "));
  }
});

test("inspect, trace, stages and capture take a PRG: a disk image and a file past $ffff are refused before an emulator starts", () => {
  writeFileSync(join(project, "packed.prg"), xorPackedPrg);
  writeFileSync(join(project, "game.d64"), Buffer.alloc(174848, 1));
  writeFileSync(join(project, "long.prg"), Buffer.concat([Buffer.from([0x01, 0x08]), Buffer.alloc(0x10000)]));
  const script = resolve(import.meta.dirname, "../../skills/c64-unpacker/scripts/unpacker.ts");
  // No host listens at port 1: a call that got to the emulator would fail with machine-unavailable.
  const refused = (...args: string[]) => {
    const run = spawnSync(process.execPath, [...process.execArgv, script, ...args], { cwd: project, encoding: "utf8", env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });
    assert.equal(run.status, 2, `${args.join(" ")}: ${run.stdout}`);
    const { error } = readEnvelope(run.stdout, run.status).json as { error: { code: string; message: string } };
    assert.equal(error.code, "invalid-input", `${args.join(" ")}: ${error.message}`);
    // A wrong command line also gives the help command: the asserts read the message without it.
    return error.message.split("\n")[0]!.replace(/ To get the usage, run unpacker\.ts \w+ --help\.$/, "");
  };
  const disk = "game.d64 is a disk image (.d64), not a PRG. Use loads, which runs a disk, tape or cartridge image, or extract the PRG from the image and give the path of that PRG.";
  for (const command of [["inspect"], ["trace"], ["stages"], ["capture", "--until", "$080d", "--out", "x"]]) assert.equal(refused(command[0]!, "game.d64", ...command.slice(1)), disk);
  assert.match(refused("inspect", "long.prg"), /^long\.prg is not a PRG: The PRG runs past \$ffff\. Use loads/);
  assert.throws(() => inspect(new Uint8Array(0x10003)), /runs past \$ffff/);
  // A segment must hold the entry: refused before the emulator runs.
  assert.equal(refused("capture", "packed.prg", "--until", "$080d", "--out", "x", "--exclude", "$0800-$0900"), "--exclude $0800-$0900 holds the entry --until $080d. A segment must hold the entry: give an --exclude range without it.");
  assert.equal(refused("capture", "packed.prg", "--until", "$080d", "--out", "x", "--range", "$c000-$cfff"), "--range $c000-$cfff does not hold the entry --until $080d. Give a --range that holds the entry.");
  // A refusal lists the step kinds.
  writeFileSync(join(project, "wait.json"), JSON.stringify([{ wait: 10 }]));
  assert.equal(refused("trace", "packed.prg", "--steps", "wait.json"), "--steps wait.json: step 1 must have exactly one of write, registers, joystick, type, press, frames, runUntil");
  writeFileSync(join(project, "old.json"), JSON.stringify([{ runUntil: { at: "$0400" }, timeoutFrames: 100 }]));
  assert.equal(refused("stages", "packed.prg", "--steps", "old.json"), '--steps old.json: step 1 has the 2.0 form (runUntil.at, timeoutFrames beside runUntil). Write {"runUntil": {"target": {"kind": "address", "address": "$0400"}, "timeoutFrames": 100}}');
  // Every name of the steps resolves before the emulator starts; an unknown one names the file and the step, as invalid-input like --until.
  writeFileSync(join(project, "name.json"), JSON.stringify([{ frames: 10 }, { runUntil: { target: { kind: "address", address: "nonsense" }, timeoutFrames: 10 } }]));
  for (const command of [["trace"], ["stages"], ["capture", "--until", "$080d", "--out", "x"]]) {
    assert.match(refused(command[0]!, "packed.prg", "--steps", "name.json", ...command.slice(1)), /^--steps name\.json: step 2: nonsense is not a name in the knowledge\. Give a \$ address/);
  }
  writeFileSync(join(project, "raster.json"), JSON.stringify([{ frames: 10 }, { runUntil: { target: { kind: "raster", line: 100 }, timeoutFrames: 10 } }]));
  assert.equal(refused("stages", "packed.prg", "--steps", "raster.json"), "--steps raster.json: step 2: stages takes a runUntil step only with an address target without a condition. Use frames steps, or use capture.");
  writeFileSync(join(project, "parts.json"), JSON.stringify([{ wait: 10 }, { capture: "a" }]));
  assert.equal(refused("loads", "game.d64", "--steps", "parts.json", "--out", "parts"), "--steps parts.json: step 1 must have exactly one of write, registers, joystick, type, press, frames, runUntil, capture, save");
  writeFileSync(join(project, "part.json"), JSON.stringify([{ capture: "a" }]));
  assert.equal(refused("loads", "game.d64", "--steps", "part.json", "--out", "parts", "--exclude", "$a9ff-$a000"), "--exclude ends at $a000, before its start $a9ff");
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
    const script = resolve(import.meta.dirname, "../../skills/c64-unpacker/scripts/unpacker.ts");
    const linked = spawnSync(process.execPath, [...process.execArgv, script, "inspect", "linked.prg"], { cwd: project, encoding: "utf8" });
    assert.equal(linked.status, 2, linked.stdout + linked.stderr);
    assert.equal(readEnvelope(linked.stdout, linked.status).envelope.code, "invalid-input");
    const missing = spawnSync(process.execPath, [...process.execArgv, script, "inspect", "missing.prg"], { cwd: project, encoding: "utf8" });
    assert.equal(missing.status, 2, missing.stdout + missing.stderr);
    assert.equal(readEnvelope(missing.stdout, missing.status).envelope.code, "not-found");
  } finally {
    rmSync(outside, { recursive: true, force: true });
  }
});

test("inspect reports the start code that decodes and moves bytes, and the BASIC text, as evidence", () => {
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

test("a written block is a stage candidate only through code that is not own code the stage has not written", () => {
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

test("a call into written code returns to the instruction after a JSR that the stage executed", () => {
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

test("the code that a called block ran, with operand bytes, is the stage's own code and makes no candidate", () => {
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

test("the points of a run: exec breakpoints over the blocks, write watches over own code that is not written", () => {
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

test("capture segments do not overlap, and a block that later stages wrote over is no leftover", () => {
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
  // The blocks that are all in pages 0-3 are in the entry state: the program starts at the block of stage 2 that goes past $03ff.
  assert.deepEqual(segments, [
    { start: 0x00c5, end: 0xd0ff, writtenBy: 3 },
    { start: 0xe000, end: 0xffff, writtenBy: 2 },
  ]);
});

test("a small written block is a segment; a block all in pages 0-3 is not, unless it holds the capture entry", () => {
  // The Bruce Lee field run with --min-stage 1000: one stage wrote the key page, the vectors and the KERNAL variables.
  const stages = [
    { entry: 0x0871, wrote: [range(0x00a2, 0x00a2), range(0x01e2, 0x01fa), range(0x0277, 0x0277), range(0x033c, 0xa9ff), range(0xc800, 0xc80f), range(0xcf00, 0xcfff), range(0xfe00, 0xffff)] },
    { entry: 0x0400, wrote: [] },
  ];
  assert.deepEqual(captureSegments(stages, 0x0400), [
    { start: 0x033c, end: 0xa9ff, writtenBy: 0 },
    { start: 0xc800, end: 0xc80f, writtenBy: 0 },
    { start: 0xcf00, end: 0xcfff, writtenBy: 0 },
    { start: 0xfe00, end: 0xffff, writtenBy: 0 },
  ]);
  assert.deepEqual(captureSegments([{ entry: 0x080d, wrote: [range(0x0340, 0x037f)] }, { entry: 0x0340, wrote: [] }], 0x0340), [{ start: 0x0340, end: 0x037f, writtenBy: 0 }]);
  // The default run: the loader at $c000 is a leftover, and so are the variables that it wrote inside itself. The program's own writes there stay.
  const loader = [
    { entry: 0x0871, wrote: [range(0x033c, 0xa9ff), range(0xc000, 0xc1ff), range(0xcf00, 0xcfff)] },
    { entry: 0xc000, wrote: [range(0x0400, 0x0400), range(0xc020, 0xc020), range(0xc025, 0xc025)] },
    { entry: 0x0400, wrote: [range(0xc100, 0xc101)] },
  ];
  assert.deepEqual(captureSegments(loader, 0x0400), [
    { start: 0x033c, end: 0xa9ff, writtenBy: 1 },
    { start: 0xc100, end: 0xc101, writtenBy: 2 },
    { start: 0xcf00, end: 0xcfff, writtenBy: 0 },
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

test("a block with the code of a later intermediate stage is a leftover; the block with the capture entry never is", () => {
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

test("a capture again into its folder removes the segment PRGs and the drive RAM of the earlier capture, and no other file", { skip: process.platform === "win32" ? "a symbolic link needs extra rights on Windows" : false }, () => {
  const root = join(project, "recapture");
  const folder = join(root, ".c64-re-tools", "local", "capture");
  mkdirSync(folder, { recursive: true });
  for (const name of ["image.bin", "image.json", "entry_state.json", "segment-0801-0fff.prg", "segment-1000-1fff.prg", "drive8.prg", "notes.txt", "segment-1000-1fff.prg.bak", "SEGMENT-2000-2FFF.PRG"]) writeFileSync(join(folder, name), "x");
  writeFileSync(join(root, "elsewhere.prg"), "x");
  symlinkSync(join(root, "elsewhere.prg"), join(folder, "segment-3000-3fff.prg"));
  const cwd = process.cwd();
  process.chdir(root);
  try {
    assert.deepEqual(removeStaleFiles(".c64-re-tools/local/capture", ["segment-1000-1fff.prg"]), [".c64-re-tools/local/capture/drive8.prg", ".c64-re-tools/local/capture/segment-0801-0fff.prg"]);
    assert.deepEqual(removeStaleFiles(".c64-re-tools/local/capture", ["segment-1000-1fff.prg"]), [], "nothing more to remove");
  } finally {
    process.chdir(cwd);
  }
  assert.deepEqual(readdirSync(folder).sort(), ["SEGMENT-2000-2FFF.PRG", "entry_state.json", "image.bin", "image.json", "notes.txt", "segment-1000-1fff.prg", "segment-1000-1fff.prg.bak", "segment-3000-3fff.prg"]);
});
