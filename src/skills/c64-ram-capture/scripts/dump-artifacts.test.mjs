// Coverage for the artifact renderer (01-04 Task 1, Part B): chunk
// contiguity and the 65536-byte assertion, the gap and overlap refusals,
// the VIC-bank/screen-base/charset-base derivations against the committed
// sidecars' own recorded values, and the power-on-pattern run detection
// that produces `unused` ranges. Runs entirely with no emulator present.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

import { assembleImage, sha256Buffer, buildChipState, vicBank, screenBase, buildRangeManifest } from "./dump-artifacts.mjs";
import { allDumpArtifacts, skipUnless } from "./test-corpus.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..", "..");  // scripts -> skill -> skills -> .claude -> repo root

function chunkOf(address, byte, length) {
  // `byte` is a 2-hex-char octet (e.g. "00"); repeating it `length` times
  // yields `length` bytes of hex.
  return { address, hex: byte.repeat(length) };
}

test("assembleImage returns a 65536-byte buffer from ordered contiguous chunk records", () => {
  const chunks = [chunkOf(0, "00", 32768), chunkOf(32768, "ff", 32768)];
  const image = assembleImage(chunks);
  assert.equal(image.length, 65536);
  assert.equal(image[0], 0x00);
  assert.equal(image[32768], 0xff);
});

test("assembleImage accepts chunks out of order and still assembles correctly", () => {
  const chunks = [chunkOf(32768, "ff", 32768), chunkOf(0, "00", 32768)];
  const image = assembleImage(chunks);
  assert.equal(image.length, 65536);
});

test("assembleImage throws naming the address for a one-byte gap", () => {
  const chunks = [chunkOf(0, "00", 32768), chunkOf(32769, "ff", 32767)];
  assert.throws(() => assembleImage(chunks), /gap before address \$8000/);
});

test("assembleImage throws naming the address for a one-byte overlap", () => {
  const chunks = [chunkOf(0, "00", 32769), chunkOf(32768, "ff", 32768)];
  assert.throws(() => assembleImage(chunks), /overlap at address \$8000/);
});

test("assembleImage throws when the total is not exactly 65536 bytes", () => {
  const chunks = [chunkOf(0, "00", 100)];
  assert.throws(() => assembleImage(chunks), /expected exactly 65536/);
});

test("sha256Buffer hashes with node:crypto and is deterministic", () => {
  const buf = Buffer.from("hello", "utf8");
  const a = sha256Buffer(buf);
  const b = sha256Buffer(buf);
  assert.equal(a, b);
  assert.equal(a.length, 64);
});

test("vicBank derives the bank from the two low bits of $DD00, inverted per the memmap table", () => {
  assert.equal(vicBank(0b00), 3);
  assert.equal(vicBank(0b01), 2);
  assert.equal(vicBank(0b10), 1);
  assert.equal(vicBank(0b11), 0);
  assert.equal(vicBank(193), 2); // real committed dd00_raw
});

test("screenBase derives the screen pointer from $D018 bits 4-7 relative to the VIC bank base", () => {
  assert.equal(screenBase(49, 193), 35840); // real committed values
});

// Corpus-driven: re-derive vic_bank / screen_base / charset_base from EVERY
// committed chip-state sidecar the registry names, and require each to match what
// that sidecar recorded. Running it over every release is what proves the formula
// is generic rather than tuned to one machine state -- and with no corpus it
// skips instead of failing.
const CHIP_STATES = allDumpArtifacts("chip_state");

test("buildChipState reproduces every committed sidecar's recorded vic_bank, screen_base and charset_base",
  { skip: skipUnless(CHIP_STATES, "committed chip-state sidecars") }, () => {
  for (const { release, label, path } of CHIP_STATES) {
    const committed = JSON.parse(readFileSync(path, "utf8"));
    if (!committed.derived) continue;
    const raw = {
      dd00_raw: committed.derived.dd00_raw,
      d018_raw: committed.derived.d018_raw,
      port01_raw: committed.derived.port01.raw,
      sprite_pointers: committed.derived.sprite_pointers,
    };
    const result = buildChipState(raw);
    const where = `${release}/${label}`;
    assert.equal(result.derived.vic_bank, committed.derived.vic_bank, `${where}: vic_bank`);
    assert.equal(result.derived.screen_base, committed.derived.screen_base, `${where}: screen_base`);
    assert.equal(result.derived.charset_base, committed.derived.charset_base, `${where}: charset_base`);
  }
});

test("buildRangeManifest marks a contiguous power-on-pattern run of at least 16 bytes as kind unused", () => {
  const image = Buffer.alloc(65536, 0xaa);
  // A genuine 20-byte run of $00 in the middle, well clear of the I/O window.
  image.fill(0x00, 4096, 4116);
  const manifest = buildRangeManifest(image, { release: "fake", label: "run1" });
  const hit = manifest.ranges.find((r) => r.start === 4096);
  assert.ok(hit, "expected a range starting at the pattern run");
  assert.equal(hit.kind, "unused");
  assert.equal(hit.end, 4115);
});

test("buildRangeManifest marks the I/O window $D000-$DFFF as kind io and sets classification_state to ranges-only", () => {
  const image = Buffer.alloc(65536, 0xaa);
  const manifest = buildRangeManifest(image, { release: "fake", label: "run1" });
  assert.equal(manifest.classification_state, "ranges-only");
  const io = manifest.ranges.find((r) => r.start === 0xd000);
  assert.ok(io);
  assert.equal(io.kind, "io");
  assert.equal(io.end, 0xdfff);
});

test("buildRangeManifest throws when the image is not exactly 65536 bytes", () => {
  assert.throws(() => buildRangeManifest(Buffer.alloc(100), {}), /exactly 65536 bytes/);
});

test("buildRangeManifest's ranges union covers $0000-$FFFF with no gap and no overlap on a synthetic image", () => {
  const image = Buffer.alloc(65536, 0x11);
  const manifest = buildRangeManifest(image, { release: "fake", label: "run1" });
  let expected = 0;
  for (const r of manifest.ranges) {
    assert.equal(r.start, expected);
    expected = r.end + 1;
  }
  assert.equal(expected, 65536);
});
