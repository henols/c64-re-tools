// Coverage for r2000-d64.ts: a round-trip proof over a synthesised in-test
// `.d64` image (no fixture file on disk, no external binary), plus every
// refusal path D-02 depends on -- unknown name, ambiguous name, corrupt
// chain, and an out-of-image pointer -- each proven to throw rather than
// guess or read out of bounds. Also proves this module composes with
// r2000-project.ts's parsePrg(), the pairing plan 10-04 depends on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

import { sectorsPerTrack, tsToOffset, listEntries, extractEntry, assertPlainImage } from "./r2000-d64.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// ------------------------------------------------------------ fixture helpers

/** A blank, well-formed 174848-byte, 35-track image with no directory
 * entries and no BAM contents written (this module never reads the BAM). */
function blankImage(): Buffer {
  return Buffer.alloc(174848, 0);
}

function writeDirEntry(
  buf: Buffer,
  dirTrack: number,
  dirSector: number,
  index: number,
  opts: { typeByte: number; firstTrack: number; firstSector: number; name: string; blocks: number },
): void {
  const off = tsToOffset(dirTrack, dirSector) + index * 32;
  buf[off + 2] = opts.typeByte;
  buf[off + 3] = opts.firstTrack;
  buf[off + 4] = opts.firstSector;
  const nameBuf = Buffer.alloc(16, 0xa0);
  Buffer.from(opts.name, "latin1").copy(nameBuf);
  nameBuf.copy(buf, off + 5);
  buf[off + 30] = opts.blocks & 0xff;
  buf[off + 31] = (opts.blocks >> 8) & 0xff;
}

/**
 * Write `payload` across the given chain of [track, sector] pairs, applying
 * the DOS end-of-chain convention on the final sector: next-track byte 0,
 * next-sector byte holding the zero-based offset of the last used byte
 * (so a final sector using `n` payload bytes gets next-sector = n + 1).
 * Throws if the chain is too short to hold the whole payload.
 */
function writeChain(buf: Buffer, chain: Array<[number, number]>, payload: Uint8Array): void {
  let pos = 0;
  for (let i = 0; i < chain.length; i++) {
    const [track, sector] = chain[i];
    const off = tsToOffset(track, sector);
    const isLast = i === chain.length - 1;
    if (isLast) {
      const remaining = payload.length - pos;
      if (remaining > 254) {
        throw new Error(`writeChain: fixture error -- last sector needs ${remaining} bytes, chain too short`);
      }
      buf[off] = 0;
      buf[off + 1] = remaining + 1; // last-used-byte offset, per the convention above
      Buffer.from(payload.subarray(pos, pos + remaining)).copy(buf, off + 2);
      pos += remaining;
    } else {
      const [nextTrack, nextSector] = chain[i + 1];
      buf[off] = nextTrack;
      buf[off + 1] = nextSector;
      Buffer.from(payload.subarray(pos, pos + 254)).copy(buf, off + 2);
      pos += 254;
    }
  }
  if (pos < payload.length) {
    throw new Error(`writeChain: fixture error -- chain too short to hold ${payload.length} bytes (wrote ${pos})`);
  }
}

/** A deliberately non-multiple-of-254 payload so the end-of-chain used-byte
 * path is genuinely exercised, not just the single-sector case. Includes a
 * synthetic 2-byte PRG load address ($0801, little-endian) at the front. */
function gamePayload(): Uint8Array {
  const loadAddr = [0x01, 0x08];
  const body: number[] = [];
  for (let i = 0; i < 300; i++) body.push(i & 0xff); // 300 body bytes: crosses one sector boundary (254) partway through the next
  return Uint8Array.from([...loadAddr, ...body]); // 302 bytes total, not a multiple of 254
}

/** Build a standard fixture: one directory sector at 18/1 with a "GAME"
 * entry (payload split across tracks 5/0 -> 5/1) and a "LOADER" entry
 * (a trivial single-sector payload at 6/0), for tests that need two
 * distinct, valid entries. */
function twoEntryImage(): Buffer {
  const buf = blankImage();
  const payload = gamePayload();
  writeDirEntry(buf, 18, 1, 0, { typeByte: 0x82, firstTrack: 5, firstSector: 0, name: "GAME", blocks: 2 });
  writeChain(buf, [[5, 0], [5, 1]], payload);

  const loaderPayload = Uint8Array.from([0x01, 0x08, 0xaa, 0xbb, 0xcc]);
  writeDirEntry(buf, 18, 1, 1, { typeByte: 0x82, firstTrack: 6, firstSector: 0, name: "LOADER", blocks: 1 });
  writeChain(buf, [[6, 0]], loaderPayload);

  return buf;
}

// --------------------------------------------------------------------- tests

test("listEntries: returns both entry names, types, and starting track/sector", () => {
  const buf = twoEntryImage();
  const entries = listEntries(buf);
  assert.equal(entries.length, 2);

  const game = entries.find((e) => e.name === "GAME");
  assert.ok(game, "GAME entry must be present");
  assert.equal(game!.type, "PRG");
  assert.equal(game!.track, 5);
  assert.equal(game!.sector, 0);

  const loader = entries.find((e) => e.name === "LOADER");
  assert.ok(loader, "LOADER entry must be present");
  assert.equal(loader!.type, "PRG");
  assert.equal(loader!.track, 6);
  assert.equal(loader!.sector, 0);
});

test("extractEntry: returns exactly the written payload bytes, including the load address, honouring the final sector's used-byte count", () => {
  const buf = twoEntryImage();
  const expected = gamePayload();
  assert.notEqual(expected.length % 254, 0, "fixture payload must not be a multiple of 254 to exercise the end-of-chain path");

  const extracted = extractEntry(buf, "GAME");
  assert.equal(extracted.length, expected.length);
  assert.deepEqual(Buffer.from(extracted), Buffer.from(expected));
});

test("extractEntry: case-insensitive name match returns the same bytes", () => {
  const buf = twoEntryImage();
  const expected = extractEntry(buf, "GAME");
  const lower = extractEntry(buf, "game");
  assert.deepEqual(Buffer.from(lower), Buffer.from(expected));
});

test("extractEntry: unknown name throws, naming both the requested name and the available entries", () => {
  const buf = twoEntryImage();
  assert.throws(
    () => extractEntry(buf, "NOPE"),
    (err: Error) => {
      assert.match(err.message, /NOPE/);
      assert.match(err.message, /GAME/);
      assert.match(err.message, /LOADER/);
      return true;
    },
  );
});

test("extractEntry: an ambiguous name (two entries sharing it) throws naming the ambiguity and returns nothing", () => {
  const buf = blankImage();
  writeDirEntry(buf, 18, 1, 0, { typeByte: 0x82, firstTrack: 5, firstSector: 0, name: "DUPE", blocks: 1 });
  writeChain(buf, [[5, 0]], Uint8Array.from([0x01, 0x08, 1, 2, 3]));
  writeDirEntry(buf, 18, 1, 1, { typeByte: 0x82, firstTrack: 6, firstSector: 0, name: "DUPE", blocks: 1 });
  writeChain(buf, [[6, 0]], Uint8Array.from([0x01, 0x08, 4, 5, 6]));

  let result: Uint8Array | undefined;
  assert.throws(
    () => {
      result = extractEntry(buf, "DUPE");
    },
    /ambiguous/,
  );
  assert.equal(result, undefined, "an ambiguous match must never return either entry's bytes");
});

test("extractEntry: a self-referential (corrupt) chain throws naming the revisited track/sector rather than looping", () => {
  const buf = blankImage();
  writeDirEntry(buf, 18, 1, 0, { typeByte: 0x82, firstTrack: 7, firstSector: 0, name: "CORRUPT", blocks: 1 });
  const off = tsToOffset(7, 0);
  buf[off] = 7; // next track: itself
  buf[off + 1] = 0; // next sector: itself -- cyclic pointer, never terminates

  assert.throws(() => extractEntry(buf, "CORRUPT"), /revisited 7\/0/);
});

test("extractEntry: an out-of-image pointer throws naming the offending pointer rather than reading past the buffer", () => {
  const buf = blankImage();
  writeDirEntry(buf, 18, 1, 0, { typeByte: 0x82, firstTrack: 40, firstSector: 0, name: "OOB", blocks: 1 });
  // No sector data is written for track 40 -- it doesn't exist in a 35-track image.

  assert.throws(() => extractEntry(buf, "OOB"), /40\/0.*outside the image/);
});

test("assertPlainImage: throws for the error-info-byte variant length (175531 bytes), with the actual length named", () => {
  const oversized = Buffer.alloc(175531, 0);
  assert.throws(() => assertPlainImage(oversized), /175531/);
});

test("assertPlainImage: passes for exactly 174848 bytes", () => {
  assert.doesNotThrow(() => assertPlainImage(blankImage()));
});

// ------------------------------------------------------- WR-05/WR-06 fixtures

test("extractEntry: a valid image truncated into the file's own sector throws naming the sector and the actual image length (WR-05)", () => {
  const full = blankImage();
  // Place GAME's chain at tracks 30/31 -- AFTER the directory track (18), so
  // the directory read itself succeeds and only the entry's OWN sector chain
  // is short-read. Truncating anywhere before track 18 would instead make
  // listEntries() itself throw (the directory sector would be missing),
  // which is not what this fixture is testing.
  writeDirEntry(full, 18, 1, 0, { typeByte: 0x82, firstTrack: 30, firstSector: 0, name: "GAME", blocks: 2 });
  const payload = gamePayload();
  writeChain(full, [[30, 0], [30, 1]], payload);

  // Truncate 100 bytes into GAME's own second sector (30/1) -- the sector
  // this entry's chain needs is no longer fully present in the buffer.
  const secondSectorOffset = tsToOffset(30, 1);
  const truncated = full.subarray(0, secondSectorOffset + 100);
  assert.ok(truncated.length < full.length, "sanity: fixture is actually shorter than the full image");
  assert.ok(secondSectorOffset > tsToOffset(18, 1), "sanity: the directory sector must be intact in the truncated buffer");

  assert.throws(
    () => extractEntry(truncated, "GAME"),
    (err: Error) => {
      assert.match(err.message, /30\/1/, "message must name the sector as T/S");
      assert.match(
        err.message,
        new RegExp(String(truncated.length)),
        "message must name the actual (truncated) image length",
      );
      return true;
    },
  );
});

test("listEntries/extractEntry: a $00-padded directory name round-trips through --entry (WR-06)", () => {
  const buf = blankImage();
  // writeDirEntry always zero-pads the 16-byte name field via Buffer.alloc(16)
  // defaulting to 0x00 for bytes past the copied name -- unlike the rest of
  // this fixture file's helper, which explicitly pads with 0xa0. Build the
  // $00-padded entry directly so this fixture is not accidentally identical
  // to the 0xa0 fixtures elsewhere in this file.
  const off = tsToOffset(18, 1);
  buf[off + 2] = 0x82; // PRG, closed
  buf[off + 3] = 9; // first track
  buf[off + 4] = 0; // first sector
  const nameBuf = Buffer.alloc(16, 0x00); // $00 padding, not $A0
  Buffer.from("ZEROPAD", "latin1").copy(nameBuf);
  nameBuf.copy(buf, off + 5);
  buf[off + 30] = 1;
  buf[off + 31] = 0;
  writeChain(buf, [[9, 0]], Uint8Array.from([0x01, 0x08, 0xde, 0xad]));

  const entries = listEntries(buf);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.name, "ZEROPAD", "the printed name must contain no embedded NUL");
  assert.ok(!entries[0]!.name.includes("\0"), "name must not embed a NUL byte");

  const extracted = extractEntry(buf, entries[0]!.name);
  assert.deepEqual(Buffer.from(extracted), Buffer.from([0x01, 0x08, 0xde, 0xad]));
});

test("extractEntry: a final sector reporting usedByte 0 throws naming the sector rather than yielding a zero-length payload (WR-05)", () => {
  const buf = blankImage();
  writeDirEntry(buf, 18, 1, 0, { typeByte: 0x82, firstTrack: 10, firstSector: 0, name: "ZEROLEN", blocks: 1 });
  const off = tsToOffset(10, 0);
  buf[off] = 0; // next track 0 -> this is the final sector
  buf[off + 1] = 0; // usedByte = 0 -- corrupt: below the minimum valid value of 2

  assert.throws(
    () => extractEntry(buf, "ZEROLEN"),
    (err: Error) => {
      assert.match(err.message, /10\/0/);
      assert.match(err.message, /usedByte 0/);
      return true;
    },
  );
});

// ------------------------------------------------------------------- WR-12
//
// Every round-trip test above (and `writeChain()` itself) writes
// `usedByte = payloadLen + 1`, and `extractEntry()` reads
// `payloadLen = usedByte - 1` -- the SAME equation in both directions. A
// systematic off-by-one in both `writeChain()` and `extractEntry()` (e.g.
// both using `payloadLen` instead of `payloadLen + 1`/`usedByte - 1`, or
// both using `payloadLen + 2`/`usedByte - 2`) would cancel out and this
// suite would still pass, even though every OTHER, non-test `.d64` image in
// the world (one written by real DOS, or read by any other tool) uses the
// convention as it actually is, not as this codebase's own two ends of the
// equation happen to agree with each other. That is a test-strength gap,
// not a behaviour bug -- plan 10-03 recorded finding and fixing exactly
// this bug class while ORIGINALLY writing this test, which is precisely why
// the test must not be able to miss a recurrence.
//
// The two tests below pin the DOS convention directly: they write the
// final sector's three governing bytes (next-track, usedByte, and the
// payload itself) as LITERAL numbers, derived from the convention's own
// definition (usedByte is the zero-based offset of the LAST used byte in
// the 256-byte sector; the payload occupies bytes 2..usedByte inclusive, so
// its length is `usedByte - 1`) -- never from `payload.length` or from
// `writeChain()`. Neither test calls `writeChain()` at all. If
// `extractEntry()`'s `usedByte - 1` read were inverted to `usedByte + 1` or
// to plain `usedByte`, these two literal fixtures would still expect the
// SAME bytes they expect today (because those bytes were never derived from
// the implementation to begin with) and would therefore FAIL -- exactly the
// contrast that proves the tautology in the round-trip test above. See
// 11.1-06-SUMMARY.md for the recorded mutation-kill transcript.
//
// `writeChain()` and the round-trip test above are NOT modified here -- WR-12
// is a test-strength finding about their independence from the convention,
// not a defect in what they cover (the multi-sector chain path), so they
// stay exactly as they are.

test("extractEntry: a hand-written final sector (usedByte 0x04, no fixture helper) returns exactly the three literal payload bytes it names (WR-12)", () => {
  const buf = blankImage();
  writeDirEntry(buf, 18, 1, 0, { typeByte: 0x82, firstTrack: 20, firstSector: 0, name: "LITERAL4", blocks: 1 });
  const off = tsToOffset(20, 0);
  buf[off] = 0x00; // next-track 0 -> this is the last sector in the chain
  // usedByte = 0x04: the DOS convention's own definition says this is the
  // zero-based offset of the LAST used byte in the sector, so the payload
  // is bytes [2, 3, 4] -- three bytes, i.e. usedByte - 1. This number (4)
  // is chosen directly from that definition, not computed from a payload
  // length anywhere in this test.
  buf[off + 1] = 0x04;
  buf[off + 2] = 0x01;
  buf[off + 3] = 0x08;
  buf[off + 4] = 0x60;

  const extracted = extractEntry(buf, "LITERAL4");
  assert.deepEqual(Buffer.from(extracted), Buffer.from([0x01, 0x08, 0x60]));
});

test("extractEntry: a hand-written final sector at the one-payload-byte boundary (usedByte 0x02, no fixture helper) returns exactly that one byte (WR-12)", () => {
  const buf = blankImage();
  writeDirEntry(buf, 18, 1, 0, { typeByte: 0x82, firstTrack: 21, firstSector: 0, name: "LITERAL1", blocks: 1 });
  const off = tsToOffset(21, 0);
  buf[off] = 0x00; // last sector
  // usedByte = 0x02 is the smallest value WR-05's own bounds check accepts
  // (below 2 is refused as corrupt) -- the boundary the convention makes
  // easiest to get wrong in either direction. By the same definition as
  // above, this names exactly one payload byte (index 2 only).
  buf[off + 1] = 0x02;
  buf[off + 2] = 0xaa;

  const extracted = extractEntry(buf, "LITERAL1");
  assert.deepEqual(Buffer.from(extracted), Buffer.from([0xaa]));
});

// ---------------------------------------------------- composition with r2000-project.ts
//
// Plan 10-04 hands extractEntry()'s output straight to parsePrg() in
// r2000-project.ts (created by the concurrent, sibling wave-1 plan 10-02).
// Because this plan and 10-02 execute in ISOLATED parallel worktrees, this
// module may not exist on disk yet in this checkout -- it exists after the
// orchestrator merges both wave-1 branches together. This test therefore
// probes for the file before importing it (a static import of a missing
// module would crash the whole suite, not just this test) and SKIPS with an
// explicit, loud reason when absent, following this project's own
// availability-gated-test convention (see disasm-roundtrip.test.ts's
// SKIP_REASON pattern). It is NOT expected to skip once the wave has merged.
const R2000_PROJECT_PATH = join(HERE, "r2000-project.ts");
const R2000_PROJECT_AVAILABLE = existsSync(R2000_PROJECT_PATH);
const SKIP_REASON = R2000_PROJECT_AVAILABLE
  ? false
  : "r2000-project.ts (created by sibling wave-1 plan 10-02) is not present in this isolated worktree yet -- " +
    "this composition test runs for real once the wave-1 branches merge. Not a failure of this plan's own scope.";

test(
  "composition: extracted bytes feed parsePrg(), and the recovered origin matches the fixture's load address",
  { skip: SKIP_REASON },
  async () => {
    // A non-literal specifier, deliberately: this defers module resolution
    // (both TypeScript's static check and Node's runtime resolution) to a
    // path we have already confirmed exists on disk above -- a literal
    // `import("./r2000-project.ts")` would fail `tsc --noEmit` in this
    // isolated worktree even though the module is guaranteed to exist once
    // wave-1 merges.
    const mod = (await import(pathToFileURL(R2000_PROJECT_PATH).href)) as {
      parsePrg: (bytes: Uint8Array) => { origin: number; body: Uint8Array };
    };
    const { parsePrg } = mod;
    const buf = twoEntryImage();
    const extracted = extractEntry(buf, "GAME");
    const { origin, body } = parsePrg(extracted);
    assert.equal(origin, 0x0801, "the fixture's load address ($0801) must be recovered exactly");
    assert.equal(body.length, extracted.length - 2);
  },
);

// Sanity check on sectorsPerTrack, re-exported here since extractEntry/
// listEntries depend on it and this file's fixtures assume its standard
// zone boundaries.
test("sectorsPerTrack covers all four standard 1541 zones", () => {
  assert.equal(sectorsPerTrack(1), 21);
  assert.equal(sectorsPerTrack(17), 21);
  assert.equal(sectorsPerTrack(18), 19);
  assert.equal(sectorsPerTrack(35), 17);
});
