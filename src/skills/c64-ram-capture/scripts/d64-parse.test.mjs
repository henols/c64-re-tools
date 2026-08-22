// Coverage for the direct .d64 byte parser: the track/sector offset
// arithmetic, the directory-chain walk (including its loop guard), and the
// suspicious-entry detector -- against synthetic images built in-test (so the
// detector is proven to FIRE on a genuine defect, not merely proven silent),
// plus an optional pass over whatever real .d64 corpus the host project ships.
// Portable: with no corpus present the real-image checks skip, never fail.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

import { sectorsPerTrack, tsToOffset, parseBam, parseDirectory, readImage } from "./d64-parse.mjs";
import { projectRoot } from "./project-paths.mjs";


// ------------------------------------------------------------- tsToOffset

test("tsToOffset(1, 0) is byte 0", () => {
  assert.equal(tsToOffset(1, 0), 0);
});

test("tsToOffset(18, 0) is the BAM's offset -- sum of tracks 1-17's 21 sectors each", () => {
  assert.equal(tsToOffset(18, 0), 17 * 21 * 256);
});

test("tsToOffset throws for a track below 1", () => {
  assert.throws(() => tsToOffset(0, 0), /track 0 out of range/);
});

test("tsToOffset throws for a track above 35", () => {
  assert.throws(() => tsToOffset(36, 0), /track 36 out of range/);
});

test("tsToOffset throws for a sector beyond the count for that track's zone", () => {
  // Track 1 is in the 21-sectors-per-track zone (sectors 0-20).
  assert.throws(() => tsToOffset(1, 21), /sector 21 out of range/);
  // Track 30 is in the 18-sectors-per-track zone (sectors 0-17).
  assert.throws(() => tsToOffset(30, 18), /sector 18 out of range/);
  // Track 35 is in the 17-sectors-per-track zone (sectors 0-16).
  assert.throws(() => tsToOffset(35, 17), /sector 17 out of range/);
});

test("sectorsPerTrack covers all four standard 1541 zones", () => {
  assert.equal(sectorsPerTrack(1), 21);
  assert.equal(sectorsPerTrack(17), 21);
  assert.equal(sectorsPerTrack(18), 19);
  assert.equal(sectorsPerTrack(24), 19);
  assert.equal(sectorsPerTrack(25), 18);
  assert.equal(sectorsPerTrack(30), 18);
  assert.equal(sectorsPerTrack(31), 17);
  assert.equal(sectorsPerTrack(35), 17);
});

// -------------------------------------------------------- synthetic image

/** A blank, well-formed 35-track image: every BAM track marked fully free. */
function blankImage() {
  const buf = Buffer.alloc(174848, 0);
  const bamOff = tsToOffset(18, 0);
  buf[bamOff] = 18; // first_dir_track
  buf[bamOff + 1] = 1; // first_dir_sector
  buf[bamOff + 2] = 0x41; // dos version 'A'
  for (let t = 1; t <= 35; t++) {
    const eoff = bamOff + 4 + (t - 1) * 4;
    buf[eoff] = sectorsPerTrack(t); // fully free
    buf[eoff + 1] = 0xff;
    buf[eoff + 2] = 0xff;
    buf[eoff + 3] = 0xff; // top 3 bits unused for <=21-sector zones, harmless
  }
  const nameOff = bamOff + 0x90;
  const nameBuf = Buffer.alloc(16, 0xa0);
  Buffer.from("SYNTHETIC", "latin1").copy(nameBuf);
  nameBuf.copy(buf, nameOff);
  return buf;
}

function writeDirEntry(buf, dirTrack, dirSector, index, { typeByte, firstTrack, firstSector, name, blocks }) {
  const off = tsToOffset(dirTrack, dirSector) + index * 32;
  buf[off + 2] = typeByte;
  buf[off + 3] = firstTrack;
  buf[off + 4] = firstSector;
  const nameBuf = Buffer.alloc(16, 0xa0);
  Buffer.from(name, "latin1").copy(nameBuf);
  nameBuf.copy(buf, off + 5);
  buf[off + 30] = blocks & 0xff;
  buf[off + 31] = (blocks >> 8) & 0xff;
}

function markTrackOccupied(buf, track, usedSectors) {
  const bamOff = tsToOffset(18, 0);
  const eoff = bamOff + 4 + (track - 1) * 4;
  buf[eoff] = sectorsPerTrack(track) - usedSectors;
}

test("parseDirectory: a genuine defect (0 blocks, first T/S into a BAM-free track) IS flagged suspicious", () => {
  const buf = blankImage();
  // Entry 0: a real, valid PRG that actually occupies track 5.
  markTrackOccupied(buf, 5, 5);
  writeDirEntry(buf, 18, 1, 0, { typeByte: 0x82, firstTrack: 5, firstSector: 0, name: "REAL FILE", blocks: 5 });
  // Chain the real file's own 5 sectors so the terminator is well-formed
  // (not load-bearing for this test, but keeps the fixture honest).
  for (let s = 0; s < 5; s++) {
    const off = tsToOffset(5, s);
    if (s < 4) { buf[off] = 5; buf[off + 1] = s + 1; } else { buf[off] = 0; buf[off + 1] = 0; }
  }
  // Entry 1: the faked entry -- claims track 6, which the BAM still reports
  // entirely free, and a 0 block count.
  writeDirEntry(buf, 18, 1, 1, { typeByte: 0x82, firstTrack: 6, firstSector: 0, name: "FAKE ENTRY", blocks: 0 });

  const { entries, chain_error } = parseDirectory(buf);
  assert.equal(chain_error, null);
  assert.equal(entries.length, 2);
  const real = entries.find((e) => e.name.startsWith("REAL FILE"));
  const fake = entries.find((e) => e.name.startsWith("FAKE ENTRY"));
  assert.equal(real.suspicious, false, "a genuinely-allocated file must not be flagged");
  assert.equal(fake.suspicious, true, "0 blocks pointing into a BAM-free track must be flagged");
  assert.ok(fake.suspicious_reasons.some((r) => r.includes("block count is 0")));
  assert.ok(fake.suspicious_reasons.some((r) => r.includes("entirely free")));
});

test("parseDirectory: first track/sector outside the image is flagged with its own reason", () => {
  const buf = blankImage();
  writeDirEntry(buf, 18, 1, 0, { typeByte: 0x82, firstTrack: 40, firstSector: 0, name: "OUT OF RANGE", blocks: 12 });
  const { entries } = parseDirectory(buf);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].suspicious, true);
  assert.ok(entries[0].suspicious_reasons[0].includes("outside the image"));
});

test("parseDirectory: an unused directory slot (blank name, type 0) is not listed as an entry", () => {
  const buf = blankImage(); // no entries written at all
  const { entries } = parseDirectory(buf);
  assert.equal(entries.length, 0);
});

test("parseDirectory: terminates on a self-referential next-sector pointer without looping", () => {
  const buf = blankImage();
  const off = tsToOffset(18, 1);
  buf[off] = 18; // next track: itself
  buf[off + 1] = 1; // next sector: itself
  const { entries, chain_error } = parseDirectory(buf);
  assert.equal(entries.length, 0);
  assert.match(chain_error, /revisited 18\/1/);
});

test("parseDirectory: terminates on a next-sector pointer that cycles back two hops later", () => {
  const buf = blankImage();
  const s1 = tsToOffset(18, 1);
  buf[s1] = 18; buf[s1 + 1] = 2; // 18/1 -> 18/2
  const s2 = tsToOffset(18, 2);
  buf[s2] = 18; buf[s2 + 1] = 1; // 18/2 -> 18/1 (cycle)
  const { chain_error } = parseDirectory(buf);
  assert.match(chain_error, /revisited 18\/1/);
});

test("parseBam: reports free-sector counts and derives occupied ranges", () => {
  const buf = blankImage();
  markTrackOccupied(buf, 5, 21);
  markTrackOccupied(buf, 6, 10);
  const bam = parseBam(buf);
  assert.equal(bam.disk_name, "SYNTHETIC");
  assert.deepEqual(bam.occupied_tracks, [5, 6]);
  assert.deepEqual(bam.occupied_ranges, [{ start: 5, end: 6 }]);
  const t5 = bam.per_track.find((t) => t.track === 5);
  assert.equal(t5.free, 0);
  const t7 = bam.per_track.find((t) => t.track === 7);
  assert.equal(t7.free, 21, "an untouched track stays fully free");
});

// ------------------------------------------------------- optional real corpus
//
// Everything above runs on synthetic images and passes in any project. What
// follows exercises the parser against whatever REAL `.d64` images the host
// project happens to ship, discovered rather than named, and SKIPS when there
// are none -- so this file never fails just because it was installed somewhere
// without a disk corpus.
//
// These assertions are deliberately properties of the parser, not facts about
// any particular disk: a specific image's disk name, entry name or block count
// is that project's evidence and belongs in that project's own records, not
// hardcoded in a portable test.

const CORPUS = (() => {
  const dir = process.env.C64RE_DISKS_DIR ?? join(projectRoot(), "disks");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".d64"))
    .sort()
    .map((f) => join(dir, f));
})();

const noCorpus =
  CORPUS.length === 0
    ? "no .d64 images found -- set C64RE_DISKS_DIR to run the real-corpus checks"
    : false;

test("real corpus: every image is a standard 174848-byte 35-track image", { skip: noCorpus }, () => {
  for (const path of CORPUS) {
    const buf = readImage(path);
    assert.equal(buf.length, 174848, `${basename(path)} is ${buf.length} bytes, not a plain 35-track image`);
  }
});

test("real corpus: every image's BAM points at a first directory sector and yields occupied ranges", { skip: noCorpus }, () => {
  for (const path of CORPUS) {
    const bam = parseBam(readImage(path));
    assert.equal(bam.first_dir_track, 18, `${basename(path)}: first dir track should be 18 on a 1541 image`);
    assert.ok(bam.first_dir_sector >= 0, `${basename(path)}: first dir sector missing`);
    assert.ok(
      bam.occupied_ranges.length > 0,
      `${basename(path)}: no occupied track ranges derived -- a real image should allocate something`,
    );
  }
});

test("real corpus: every directory chain walks to a clean end, with no loop guard tripped", { skip: noCorpus }, () => {
  for (const path of CORPUS) {
    const { entries, chain_error } = parseDirectory(readImage(path));
    assert.equal(chain_error, null, `${basename(path)}: directory chain failed -- ${chain_error}`);
    assert.ok(entries.length > 0, `${basename(path)}: no directory entries found`);
  }
});

test("real corpus: a suspicious entry always names its reasons, and a clean one never does", { skip: noCorpus }, () => {
  for (const path of CORPUS) {
    const { entries } = parseDirectory(readImage(path));
    for (const e of entries) {
      assert.equal(typeof e.suspicious, "boolean", `${basename(path)}: "${e.name}" has no suspicious flag`);
      if (e.suspicious) {
        assert.ok(
          e.suspicious_reasons.length > 0,
          `${basename(path)}: "${e.name}" is flagged suspicious with no reason given -- a bare boolean is not a finding`,
        );
      } else {
        assert.deepEqual(
          e.suspicious_reasons,
          [],
          `${basename(path)}: "${e.name}" is not suspicious but carries reasons`,
        );
      }
    }
  }
});
