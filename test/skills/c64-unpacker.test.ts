// The c64-unpacker packing evidence. No emulator needed.

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { inspect, readMemoryMap, writtenThenExecuted } from "../../skills/c64-unpacker/scripts/evidence.ts";
import { xorPackedPrg } from "../fixtures/prg/xor-packed.ts";

const project = mkdtempSync(join(tmpdir(), "c64-re-tools-unpacker-"));
after(() => rmSync(project, { recursive: true, force: true }));

const stub = [0x01, 0x08, 0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00];

test("random bytes after a BASIC start look packed", () => {
  const result = inspect(Uint8Array.from([...stub, ...randomBytes(4096)]));
  assert.equal(result.packing, "likely");
  assert.deepEqual(result.basicStart, { line: 10, sys: "$080d" });
  assert.equal((result.entropy as { blocks: number }).blocks, 16);
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
  const run = spawnSync(process.execPath, [script, "inspect", "packed.prg"], { cwd: project, encoding: "utf8" });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const result = JSON.parse(run.stdout) as Record<string, unknown>;
  assert.equal(result.packing, "unclear");
  assert.deepEqual(result.basicStart, { line: 10, sys: "$080d" });
  for (const args of [["inspect"], ["capture", "packed.prg"], ["capture", "packed.prg", "--until", "49152", "--out", "x.prg"], ["unpack", "packed.prg"]]) {
    const bad = spawnSync(process.execPath, [script, ...args], { cwd: project, encoding: "utf8" });
    assert.equal(bad.status, 2, args.join(" "));
  }
});

test("the memory map is read in windows, and a window at the range limit is read again in halves", async () => {
  // One range for each executed byte in $2000-$27ff: more than one read may give.
  const executed = Array.from({ length: 0x800 }, (_, index) => ({ start: 0x2000 + index, end: 0x2000 + index, read: false, write: true, execute: true }));
  const reads: Array<[number, number]> = [];
  const ranges = await readMemoryMap(async (start, end) => {
    reads.push([start, end]);
    return executed.filter((range) => range.start >= start && range.end <= end).slice(0, 1000);
  }, 1000);
  assert.deepEqual(ranges, executed);
  assert.deepEqual(reads.slice(0, 3), [
    [0x0000, 0x0fff],
    [0x1000, 0x1fff],
    [0x2000, 0x2fff],
  ]);
  assert.ok(reads.some(([start, end]) => start === 0x2000 && end === 0x27ff), "the full window is read again as two halves");
  assert.deepEqual(reads.at(-1), [0xf000, 0xffff]);
});

test("code that runs in a ROM area is not unpacked code, also when the program wrote the RAM below it", () => {
  const range = (start: number, end: number) => ({ start, end, read: false, write: true, execute: true });
  const kernal = writtenThenExecuted([range(0xe000, 0xe0ff)], 0xe010);
  assert.deepEqual(kernal, { written: [{ start: 0xe000, end: 0xe0ff }], bytes: 0 });
  const unpacked = writtenThenExecuted([range(0x0810, 0x0810), range(0x0812, 0x0900), range(0xe000, 0xe0ff)], 0x0820);
  assert.deepEqual(unpacked, {
    written: [
      { start: 0x0810, end: 0x0900 },
      { start: 0xe000, end: 0xe0ff },
    ],
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
    const linked = spawnSync(process.execPath, [script, "inspect", "linked.prg"], { cwd: project, encoding: "utf8" });
    assert.equal(linked.status, 1, linked.stdout + linked.stderr);
    assert.equal((JSON.parse(linked.stdout) as { error: { code: string } }).error.code, "invalid-input");
    const missing = spawnSync(process.execPath, [script, "inspect", "missing.prg"], { cwd: project, encoding: "utf8" });
    assert.equal(missing.status, 1, missing.stdout + missing.stderr);
    assert.equal((JSON.parse(missing.stdout) as { error: { code: string } }).error.code, "not-found");
  } finally {
    rmSync(outside, { recursive: true, force: true });
  }
});
