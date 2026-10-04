// Real-c1541 checks of the c1541 adapter on images that c1541 itself made.
// Skipped (never passed) when c1541 is not installed on this machine.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { ProcessSupervisor } from "../../../src/native/processes.ts";
import { inspect } from "../../../src/host/tools/c1541.ts";
import { C1541, findTool } from "../../../src/native/discover.ts";
import { WireFailure, type C1541Params, type C1541Result } from "../../../src/protocol.ts";

let c1541 = "";
let skip: string | false = false;
try {
  c1541 = findTool(C1541);
} catch {
  skip = "c1541 is not installed: install VICE or set C64RT_C1541 to run these tests";
}

const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-c1541-"));
const supervisor = new ProcessSupervisor();
after(() => rmSync(scratch, { recursive: true, force: true }));

/** Runs the real c1541 in the scratch directory, to make fixture images. */
function make(...args: string[]): void {
  const run = spawnSync(c1541, args, { cwd: scratch, encoding: "utf8" });
  assert.equal(run.status, 0, run.stdout + run.stderr);
}

const loader = Buffer.from([0x01, 0x08, 0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00, 0xee, 0x20, 0xd0, 0x4c, 0x0d, 0x08]);
const log = Buffer.from(Array.from({ length: 3000 }, (_, index) => (index * 7) & 0xff));

function d64(): Buffer {
  if (skip !== false) return Buffer.alloc(0);
  writeFileSync(join(scratch, "loader.prg"), loader);
  writeFileSync(join(scratch, "log.bin"), log);
  make("-format", "probe disk,ab", "d64", "probe.d64", "-write", "loader.prg", "loader", "-write", "log.bin", "log,s");
  return readFileSync(join(scratch, "probe.d64"));
}
const image = d64();

function run(params: C1541Params, bytes = image): Promise<{ result: C1541Result; attachments?: Buffer[] }> {
  return inspect(params, bytes, { supervisor, signal: new AbortController().signal });
}

test("the directory shows the header, the files and the free blocks", { skip }, async () => {
  const { result } = await run({ action: "directory", imageType: "d64" });
  assert.deepEqual(result, {
    action: "directory",
    diskName: "PROBE DISK",
    diskId: "AB",
    dosType: "2A",
    freeBlocks: 664 - 1 - 12,
    entries: [
      { name: "LOADER", type: "prg", blocks: 1, closed: true, locked: false },
      { name: "LOG", type: "seq", blocks: 12, closed: true, locked: false },
    ],
  });
});

test("entry, chain and read find a file by name; a missing name is not found", { skip }, async () => {
  const entry = await run({ action: "entry", imageType: "d64", name: "log" });
  assert.equal(entry.result.action === "entry" && entry.result.found && entry.result.entry.blocks, 12);
  const chain = await run({ action: "chain", imageType: "d64", name: "LOG" });
  assert.ok(chain.result.action === "chain" && chain.result.found);
  assert.equal(chain.result.sectors.length, 12);
  assert.deepEqual(chain.result.sectors[0], entry.result.action === "entry" && entry.result.found ? { track: entry.result.entry.startTrack, sector: entry.result.entry.startSector } : undefined);
  const read = await run({ action: "read", imageType: "d64", name: "LOG" });
  assert.deepEqual(read.result, { action: "read", found: true, name: "LOG", bytes: log.length });
  assert.ok(read.attachments![0]!.equals(log), "the SEQ file reads back unchanged");
  const program = await run({ action: "read", imageType: "d64", name: "LOADER" });
  assert.ok(program.attachments![0]!.equals(loader), "the PRG keeps its load address");
  assert.deepEqual((await run({ action: "read", imageType: "d64", name: "NOTHERE" })).result, { action: "read", found: false });
});

test("the BAM marks the directory track and the file blocks as used", { skip }, async () => {
  const { result } = await run({ action: "bam", imageType: "d64" });
  assert.ok(result.action === "bam");
  assert.equal(result.tracks.length, 35);
  assert.deepEqual(result.tracks[17]!.usedSectors.slice(0, 2), [0, 1], "track 18 holds the BAM and the directory");
  const used = result.tracks.reduce((sum, track) => sum + track.usedSectors.length, 0);
  assert.equal(used, 2 + 1 + 12);
});

test("a 1581 image works with its own header layout", { skip }, async () => {
  writeFileSync(join(scratch, "x.prg"), loader);
  make("-format", "big disk,81", "d81", "big.d81", "-write", "x.prg", "x");
  const bytes = readFileSync(join(scratch, "big.d81"));
  const { result } = await run({ action: "directory", imageType: "d81" }, bytes);
  assert.ok(result.action === "directory");
  assert.equal(result.diskName, "BIG DISK");
  assert.equal(result.dosType, "3D");
  assert.deepEqual(result.entries.map((entry) => entry.name), ["X"]);
  const read = await run({ action: "read", imageType: "d81", name: "X" }, bytes);
  assert.ok(read.attachments![0]!.equals(loader));
});

test("a sector chain that loops and a file that is no disk image are media errors", { skip }, async () => {
  const looped = Buffer.from(image);
  const chain = await run({ action: "chain", imageType: "d64", name: "LOG" });
  assert.ok(chain.result.action === "chain" && chain.result.found);
  // Point the last block of LOG back to its first block.
  const offset = (track: number, sector: number) => {
    let at = 0;
    for (let t = 1; t < track; t++) at += (t <= 17 ? 21 : t <= 24 ? 19 : t <= 30 ? 18 : 17) * 256;
    return at + sector * 256;
  };
  const last = chain.result.sectors.at(-1)!;
  const first = chain.result.sectors[0]!;
  looped[offset(last.track, last.sector)] = first.track;
  looped[offset(last.track, last.sector) + 1] = first.sector;
  await assert.rejects(run({ action: "read", imageType: "d64", name: "LOG" }, looped), (error: unknown) => {
    assert.ok(error instanceof WireFailure && error.code === "media-error", String(error));
    assert.match(error.message, /loops/);
    return true;
  });
  await assert.rejects(run({ action: "directory", imageType: "d64" }, Buffer.alloc(100)), (error: unknown) => error instanceof WireFailure && error.code === "media-error");
});
