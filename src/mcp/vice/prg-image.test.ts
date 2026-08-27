// prg-image.test.ts
//
// The committed regression for `prg-image.ts`'s two input validators, plus
// the payload round trip its own doc comment says it exists to allow, plus a
// structural check that the module really is the pure, I/O-free thing its
// header claims.
//
// PROVENANCE OF THE FIRST FOUR TESTS: they were RELOCATED VERBATIM out of
// `r2000-project.test.ts` together with the functions they cover -- same
// titles, same fixtures, same regex matchers. That is deliberate. Their whole
// value is that they are the already-committed regression for the refusals
// standing between a truncated capture and a silently wrong load address; a
// reworded assertion would be a new test wearing an old test's authority.
// Only the import specifier changed.
//
// WHY THE NO-I/O CHECK IS STRUCTURAL AND NOT A CLAIM IN A COMMENT: the
// module's header states it performs no filesystem and no network I/O, and
// that statement is load-bearing -- it is what makes the module safe to ship
// in the npm tarball with no path handling and no threat surface of its own.
// A header sentence cannot notice when a later edit falsifies it. Asserting
// the module's own import set from its source can. This is the same shape as
// the source-level structural assertions the coverage and spawn-seam suites
// already carry, and it is labelled here as the SUPPLEMENT to the behavioural
// tests above, never as the proof of purity by itself.
//
// Never add this file to `test-gate.mjs`'s MANUAL_ONLY_TESTS: it needs no
// external binary, no emulator and no network, so it belongs in the
// auto-discovered automated set.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { parsePrg, flatImageOrigin, decodeRawData } from "./prg-image.ts";
import { codeOnly } from "./shipped-modules.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = join(HERE, "prg-image.ts");

// ---------------------------------------------------------------------------
// Relocated verbatim from r2000-project.test.ts.
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

// ---------------------------------------------------------------------------
// Structural SUPPLEMENT: the module is pure -- bytes in, values out.
// ---------------------------------------------------------------------------

// `codeOnly()` is imported from `shipped-modules.ts`, the single home of the
// full comment-and-string-literal stripper. The import-specifier test below
// needs the literal bodies (a specifier IS a string) so it passes `true`; the
// forbidden-call test keeps the default, so a module name mentioned in a
// comment or a message string can never satisfy it.

test("prg-image.ts imports exactly one module, node:zlib, and nothing from this repo", () => {
  const code = codeOnly(readFileSync(MODULE_PATH, "utf8"), true);
  const specifiers = [...code.matchAll(/^\s*import\s[^;]*?from\s+"([^"]*)"/gm)].map((m) => m[1]);
  assert.deepEqual(specifiers, ["node:zlib"]);
});

test("prg-image.ts performs no filesystem, subprocess or network I/O", () => {
  const code = codeOnly(readFileSync(MODULE_PATH, "utf8"));
  for (const forbidden of [
    /\b(readFile|readFileSync|writeFile|writeFileSync|appendFileSync|openSync|createReadStream|createWriteStream)\s*\(/,
    /\b(spawn|spawnSync|exec|execSync|execFile|execFileSync|fork)\s*\(/,
    /\b(fetch|request|connect|createConnection|createServer)\s*\(/,
    /\bimport\s*\(/,
    /\bprocess\s*\./,
  ]) {
    assert.equal(forbidden.test(code), false, `prg-image.ts must not contain ${forbidden}`);
  }
});
