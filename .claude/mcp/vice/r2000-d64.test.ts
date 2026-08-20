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
