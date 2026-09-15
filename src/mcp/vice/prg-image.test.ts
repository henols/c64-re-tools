// prg-image.test.ts
//
// The committed regression for `prg-image.ts`'s two input validators, plus
// the payload round trip its own doc comment says it exists to allow.
//
// PROVENANCE OF THE FIRST FOUR TESTS: they were RELOCATED VERBATIM out of
// `anno-project.test.ts` together with the functions they cover -- same
// titles, same fixtures, same regex matchers. That is deliberate. Their whole
// value is that they are the already-committed regression for the refusals
// standing between a truncated capture and a silently wrong load address; a
// reworded assertion would be a new test wearing an old test's authority.
// Only the import specifier changed.
//
// Phase 56 removed this file's structural no-I/O check -- an import-set scan
// plus a forbidden-pattern scan of `prg-image.ts`'s own source, asserting the
// module really is the pure, filesystem/subprocess/network-free thing its
// header claims. That claim is no longer test-enforced here.
//
// Never add this file to `test-gate.mjs`'s MANUAL_ONLY_TESTS: it needs no
// external binary, no emulator and no network, so it belongs in the
// auto-discovered automated set.
import { test } from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";

import { parsePrg, flatImageOrigin, decodeRawData } from "./prg-image.ts";

// ---------------------------------------------------------------------------
// Relocated verbatim from anno-project.test.ts.
// ---------------------------------------------------------------------------

test("parsePrg: extracts a little-endian load address and the remaining body", () => {
  const { origin, body } = parsePrg(Buffer.from([0x01, 0x08, 0xa9, 0x00, 0x60]));
  assert.equal(origin, 0x0801);
  assert.deepEqual(Buffer.from(body), Buffer.from([0xa9, 0x00, 0x60]));
});

test("parsePrg: a 2-byte or shorter input throws", () => {
  assert.throws(() => parsePrg(Buffer.from([0x01, 0x08])), /3 bytes/);
  assert.throws(() => parsePrg(Buffer.from([0x01])), /3 bytes/);
  assert.throws(() => parsePrg(Buffer.alloc(0)), /3 bytes/);
});

test("flatImageOrigin: returns 0 for exactly 65536 bytes", () => {
  assert.equal(flatImageOrigin(Buffer.alloc(65536)), 0);
});

test("flatImageOrigin: throws otherwise, naming the actual length", () => {
  // Anchored on the message's `is <n> byte(s)` shape, not a bare number: the
  // message always contains the constant 65536, so a bare /0/ was satisfied
  // by that constant regardless of the observed length, and the zero-length
  // case was not actually pinned to naming 0 at all (IN-03).
  assert.throws(() => flatImageOrigin(Buffer.alloc(65535)), /is 65535 byte\(s\)/);
  assert.throws(() => flatImageOrigin(Buffer.alloc(0)), /is 0 byte\(s\)/);
});

// ---------------------------------------------------------------------------
// The round-trip property decodeRawData's doc comment claims it exists for --
// claimed since the function was written, never actually asserted until now.
// ---------------------------------------------------------------------------

test("decodeRawData: exact inverse of gzip-then-base64 for a non-trivial byte sequence", () => {
  const original = Buffer.from([
    0x01, 0x08, 0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00, 0xa9, 0x00,
    0x8d, 0x20, 0xd0, 0x8d, 0x21, 0xd0, 0x4c, 0x16, 0x08, 0xff, 0xfe, 0x00, 0x7f, 0x80,
  ]);
  const encoded = gzipSync(original).toString("base64");
  assert.notEqual(encoded, original.toString("base64"), "fixture must actually be gzipped, not passed through");
  assert.deepEqual(Buffer.from(decodeRawData(encoded)), original);
});

test("decodeRawData: round-trips an all-zero page and a byte sequence with every value 0..255", () => {
  const zeros = Buffer.alloc(256);
  assert.deepEqual(Buffer.from(decodeRawData(gzipSync(zeros).toString("base64"))), zeros);
  const ramp = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
  assert.deepEqual(Buffer.from(decodeRawData(gzipSync(ramp).toString("base64"))), ramp);
});
