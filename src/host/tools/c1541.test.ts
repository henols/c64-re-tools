import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { ProcessSupervisor } from "../../native/processes.ts";
import { Workspace } from "../../native/staging.ts";
import { WireFailure } from "../../protocol/messages.ts";
import { MAX_DISK_SECTORS } from "../../protocol/tools.ts";
import { C1541Session, fileData, parseBam, parseChain, parseDirectory, parseFreeBlocks, parseInfo, READS_PER_CALL, sectorsToRead, unreferencedSectors } from "./c1541.ts";

const failsWith = (code: string) => (error: unknown) => error instanceof WireFailure && error.code === code;

// c1541 output for a disk with one file.
const OVERVIEW = `D64 disk image recognised: probe.d64, 35 tracks.
Unit 8 drive 0: D64 disk image attached: probe.d64.
disk format  : 1541
track count  : 35
error block  : No
write protect: Off
0 "probe disk      " ab 2a
1    "loader"           prg
650 blocks free.
Unit 8 drive 0: D64 disk image detached: probe.d64.
`;

test("info gives the drive format and track count; an unknown image is a media error", () => {
  assert.deepEqual(parseInfo(OVERVIEW), { format: "1541", tracks: 35 });
  assert.equal(parseFreeBlocks(OVERVIEW), 650);
  assert.throws(() => parseInfo("cannot open file `junk.d64'\nUnknown disk image `junk.d64'.\n"), failsWith("media-error"));
});

test("a chain lists its sectors; a loop or a block outside the disk is a media error", () => {
  const start = { track: 17, sector: 1 };
  assert.deepEqual(parseChain("attached\n(17, 1) -> (17,11) -> (17, 2) -> 207\ndetached\n", start), [
    { track: 17, sector: 1 },
    { track: 17, sector: 11 },
    { track: 17, sector: 2 },
  ]);
  assert.deepEqual(parseChain("(18, 1) -> 255\n", { track: 18, sector: 1 }), [{ track: 18, sector: 1 }]);
  assert.throws(() => parseChain("(17, 1) -> (17,11) -> cyclic reference found to (17,1)!\n1\n", start), (error: unknown) => {
    assert.ok(failsWith("media-error")(error));
    assert.match((error as Error).message, /loops/);
    return true;
  });
  assert.throws(() => parseChain("(17, 1) -> (99, 0) -> <unknown error>\nError - Track 99, Sector 0 out of bounds.\n", start), /leaves the disk/);
});

test("the BAM grid gives used and free sectors per track and must cover every track", () => {
  const grid = ["                111111 11112", "     01234567 89012345 67890", "  1  ........ ........ .....", "  2  **...... ........ ...*."].join("\n");
  const tracks = parseBam(grid, 2);
  assert.equal(tracks.length, 2);
  assert.deepEqual(tracks[1]!.usedSectors, [0, 1, 19]);
  assert.equal(tracks[1]!.freeSectors.length, 18);
  assert.deepEqual(tracks[0]!.usedSectors, []);
  assert.throws(() => parseBam(grid, 35), failsWith("operation-failed"));
});

test("unreferenced sectors are the used sectors that no chain holds, in track and sector order", () => {
  const tracks = [
    { track: 1, usedSectors: [3] },
    { track: 2, usedSectors: [0, 1, 19] },
  ];
  assert.deepEqual(unreferencedSectors(tracks, [{ track: 2, sector: 0 }, { track: 2, sector: 19 }, { track: 9, sector: 9 }]), [
    { track: 1, sector: 3 },
    { track: 2, sector: 1 },
  ]);
  assert.deepEqual(unreferencedSectors(tracks, [{ track: 1, sector: 3 }, { track: 2, sector: 0 }, { track: 2, sector: 1 }, { track: 2, sector: 19 }]), []);
});

test("a sectors request reads the given sectors in their order, then the unreferenced ones; a sector outside the disk or too many are refused", () => {
  const tracks = [
    { track: 1, freeSectors: [1, 2], usedSectors: [0] },
    { track: 2, freeSectors: [0], usedSectors: [1] },
  ];
  assert.deepEqual(sectorsToRead([{ track: 2, sector: 0 }, { track: 1, sector: 2 }], [{ track: 2, sector: 1 }], tracks), [
    { track: 2, sector: 0 },
    { track: 1, sector: 2 },
    { track: 2, sector: 1 },
  ]);
  assert.deepEqual(sectorsToRead([], [], tracks), []);
  for (const outside of [{ track: 1, sector: 3 }, { track: 3, sector: 0 }, { track: 0, sector: 0 }]) {
    assert.throws(() => sectorsToRead([outside], [], tracks), (error: unknown) => failsWith("invalid-input")(error) && /The disk has no track/.test((error as Error).message), JSON.stringify(outside));
  }
  const many = Array.from({ length: MAX_DISK_SECTORS + 1 }, () => ({ track: 1, sector: 0 }));
  assert.throws(() => sectorsToRead(many, [], tracks), failsWith("limit-exceeded"));
});

function block(fill: (bytes: Buffer) => void): Buffer {
  const bytes = Buffer.alloc(256);
  fill(bytes);
  return bytes;
}

test("the directory comes from the raw header and directory blocks, with exact names", () => {
  const layout = { header: { track: 18, sector: 0 }, name: 0x90, id: 0xa2, dos: 0xa5 };
  const header = block((bytes) => {
    bytes.fill(0xa0, 0x90, 0xab);
    bytes.write("MY DISK", 0x90, "latin1");
    bytes.write("AB", 0xa2, "latin1");
    bytes.write("2A", 0xa5, "latin1");
  });
  const directory = block((bytes) => {
    bytes[1] = 0xff;
    // A closed PRG with a shifted letter in its name.
    bytes[2] = 0x82;
    bytes[3] = 17;
    bytes[4] = 0;
    bytes.fill(0xa0, 5, 21);
    Buffer.from([0x47, 0x41, 0x4d, 0x45, 0xc1]).copy(bytes, 5);
    bytes.writeUInt16LE(24, 30);
    // A scratched slot.
    bytes[32 + 2] = 0x00;
    // An unclosed, locked SEQ.
    bytes[64 + 2] = 0x41;
    bytes.fill(0xa0, 64 + 5, 64 + 21);
    bytes.write("LOG", 64 + 5, "latin1");
    // A closed REL with its side sector at track 19 sector 10.
    bytes[96 + 2] = 0x84;
    bytes.fill(0xa0, 96 + 5, 96 + 21);
    bytes.write("DATA", 96 + 5, "latin1");
    bytes[96 + 3] = 19;
    bytes[96 + 0x15] = 19;
    bytes[96 + 0x16] = 10;
  });
  const parsed = parseDirectory([header, directory], layout);
  assert.equal(parsed.diskName, "MY DISK");
  assert.equal(parsed.diskId, "AB");
  assert.equal(parsed.dosType, "2A");
  assert.equal(parsed.entries.length, 3);
  assert.deepEqual(
    { ...parsed.entries[0]!, nameBytes: [...parsed.entries[0]!.nameBytes] },
    { name: "GAME{$c1}", nameBytes: [0x47, 0x41, 0x4d, 0x45, 0xc1], type: "prg", blocks: 24, closed: true, locked: false, startTrack: 17, startSector: 0 },
  );
  assert.equal(parsed.entries[1]!.type, "seq");
  assert.equal(parsed.entries[1]!.closed, false);
  assert.equal(parsed.entries[1]!.locked, true);
  assert.equal(parsed.entries[1]!.sideStart, undefined);
  assert.deepEqual(parsed.entries[2]!.sideStart, { track: 19, sector: 10 }, "a REL file names its side sectors");
});

test("file data is 254 bytes per block and the last block up to its end index", () => {
  const chain = [
    { track: 17, sector: 0 },
    { track: 17, sector: 10 },
  ];
  const first = block((bytes) => {
    bytes[0] = 17;
    bytes[1] = 10;
    bytes.fill(0x11, 2);
  });
  const last = block((bytes) => {
    bytes[1] = 4; // bytes 2..4
    bytes.fill(0x22, 2);
  });
  const data = fileData([first, last], chain);
  assert.equal(data.length, 254 + 3);
  assert.equal(data[253], 0x11);
  assert.equal(data[254], 0x22);
  assert.throws(() => fileData([last, first], chain), failsWith("operation-failed"));
});

test("many blocks are read in several c1541 calls with a bounded number of reads each, and come back in order", { skip: process.platform === "win32" ? "the stand-in c1541 is a shell script" : false, timeout: 30_000 }, async () => {
  const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-c1541-batch-"));
  const supervisor = new ProcessSupervisor();
  const workspace = Workspace.create(supervisor);
  try {
    // Writes each block as its track and sector, padded to 256 bytes, and logs the number of reads of each call.
    const calls = join(scratch, "calls.log");
    const c1541 = join(scratch, "c1541");
    writeFileSync(
      c1541,
      `#!/bin/sh\nreads=0\nwhile [ $# -gt 0 ]; do\n  if [ "$1" = "-bread" ]; then printf '%-256s' "$3 $4" > "$2"; reads=$((reads + 1)); shift 4; else shift; fi\ndone\necho $reads >> '${calls}'\n`,
    );
    chmodSync(c1541, 0o755);
    const sectors = Array.from({ length: 2 * READS_PER_CALL + 88 }, (_, index) => ({ track: 1 + Math.floor(index / 21), sector: index % 21 }));
    const session = new C1541Session(c1541, workspace, "input/image.d64", { supervisor, signal: new AbortController().signal });
    const blocks = await session.blocks(sectors);
    assert.deepEqual(
      blocks.map((block) => block.toString("latin1").trimEnd()),
      sectors.map((at) => `${at.track} ${at.sector}`),
    );
    assert.deepEqual(readFileSync(calls, "utf8").trim().split("\n").map(Number), [READS_PER_CALL, READS_PER_CALL, 88]);
  } finally {
    workspace.remove();
    await supervisor.stopAll();
    rmSync(scratch, { recursive: true, force: true });
  }
});
