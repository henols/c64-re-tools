// node:test coverage of stock-petscii.ts's asciiToPetscii() -- 03-RESEARCH.md
// Pitfall 3's explicit requirement: an EXHAUSTIVE round-trip test over every
// input code point 0x00-0xff, not a spot-check of a handful of letters.
// Follows stock-protocol.test.ts's golden-fixture-table style: the expected
// output for each byte is computed here, independently of asciiToPetscii()'s
// own implementation, from the same range boundaries this file's own header
// comment documents -- never by calling the function under test to derive
// its own expectation.
import { test } from "node:test";
import assert from "node:assert/strict";

import { asciiToPetscii, PETSCII_RETURN, StockPetsciiError } from "./stock-petscii.ts";

/**
 * Independently-written expectation for one input byte, computed from the
 * documented range table (never by calling asciiToPetscii()). Returns the
 * expected output byte, or `null` if the byte is expected to be refused.
 */
function expectedByte(byte: number, upper: boolean): number | null {
  if (byte === 0x0a || byte === 0x0d) return PETSCII_RETURN;
  if (byte >= 0x20 && byte <= 0x40) return byte;
  if (byte >= 0x41 && byte <= 0x5a) return upper ? byte | 0x80 : byte;
  if (byte >= 0x5b && byte <= 0x60) return byte;
  if (byte >= 0x61 && byte <= 0x7a) return upper ? byte - 0x20 : byte;
  if (byte >= 0x7b && byte <= 0x7e) return byte;
  return null;
}

test("asciiToPetscii: exhaustive round-trip over every input code point 0x00-0xff (upper: true, the default)", () => {
  for (let byte = 0; byte < 0x100; byte++) {
    const expected = expectedByte(byte, true);
    const input = String.fromCharCode(byte);
    if (expected === null) {
      assert.throws(() => asciiToPetscii(input), StockPetsciiError, `byte 0x${byte.toString(16).padStart(2, "0")} should refuse`);
    } else {
      const result = asciiToPetscii(input);
      assert.equal(result.length, 1, `byte 0x${byte.toString(16).padStart(2, "0")} should produce exactly one output byte`);
      assert.equal(
        result[0],
        expected,
        `byte 0x${byte.toString(16).padStart(2, "0")} should convert to 0x${expected.toString(16).padStart(2, "0")}, got 0x${result[0].toString(16).padStart(2, "0")}`,
      );
    }
  }
});

test("asciiToPetscii: exhaustive round-trip over every input code point 0x00-0xff (upper: false, raw pass-through)", () => {
  for (let byte = 0; byte < 0x100; byte++) {
    const expected = expectedByte(byte, false);
    const input = String.fromCharCode(byte);
    if (expected === null) {
      assert.throws(() => asciiToPetscii(input, { upper: false }), StockPetsciiError, `byte 0x${byte.toString(16).padStart(2, "0")} should refuse`);
    } else {
      const result = asciiToPetscii(input, { upper: false });
      assert.equal(result[0], expected, `byte 0x${byte.toString(16).padStart(2, "0")} should convert to 0x${expected.toString(16).padStart(2, "0")} unchanged`);
    }
  }
});

test("asciiToPetscii: explicit named case -- 'A' becomes 0xc1 (uppercase ASCII -> shifted PETSCII, upper default true)", () => {
  assert.deepEqual(asciiToPetscii("A"), Buffer.from([0xc1]));
});

test("asciiToPetscii: explicit named case -- 'a' becomes 0x41 (lowercase ASCII -> unshifted PETSCII, upper default true)", () => {
  assert.deepEqual(asciiToPetscii("a"), Buffer.from([0x41]));
});

test("asciiToPetscii: explicit named case -- 'A' with upper: false passes through unchanged as 0x41", () => {
  assert.deepEqual(asciiToPetscii("A", { upper: false }), Buffer.from([0x41]));
});

test("asciiToPetscii: explicit named case -- '\\n' (LF) becomes PETSCII_RETURN (0x0d)", () => {
  assert.deepEqual(asciiToPetscii("\n"), Buffer.from([0x0d]));
});

test("asciiToPetscii: explicit named case -- '\\r' (CR) also becomes PETSCII_RETURN (0x0d)", () => {
  assert.deepEqual(asciiToPetscii("\r"), Buffer.from([0x0d]));
});

test('asciiToPetscii: explicit named case -- \'LOAD"*",8,1\\n\' produces the expected 12-byte sequence', () => {
  const result = asciiToPetscii('LOAD"*",8,1\n');
  assert.deepEqual(result, Buffer.from([0xcc, 0xcf, 0xc1, 0xc4, 0x22, 0x2a, 0x22, 0x2c, 0x38, 0x2c, 0x31, 0x0d]));
});

test("asciiToPetscii: refusal -- empty string", () => {
  assert.throws(() => asciiToPetscii(""), StockPetsciiError);
});

test("asciiToPetscii: refusal -- an embedded PETSCII control code (0x93, clear screen) at index 1 names both the index and the hex code", () => {
  const input = "a" + String.fromCharCode(0x93) + "b";
  assert.throws(
    () => asciiToPetscii(input),
    (err: unknown) => {
      assert.ok(err instanceof StockPetsciiError);
      assert.match((err as Error).message, /\b1\b/);
      assert.match((err as Error).message, /0x93/);
      return true;
    },
  );
});

test("asciiToPetscii: refusal -- 'é' (an unmapped Latin-1 byte, 0xe9) throws", () => {
  assert.throws(() => asciiToPetscii("é"), StockPetsciiError);
});

test("asciiToPetscii: refusal -- '\\t' (tab, 0x09) throws", () => {
  assert.throws(() => asciiToPetscii("\t"), StockPetsciiError);
});

test("asciiToPetscii: refusal -- a genuine non-Latin-1 code unit (0x100) is refused, never silently truncated via charCodeAt & 0xff", () => {
  assert.throws(
    () => asciiToPetscii("Ā"),
    (err: unknown) => {
      assert.ok(err instanceof StockPetsciiError);
      assert.match((err as Error).message, /0x100/);
      return true;
    },
  );
});

test("asciiToPetscii: refusal -- a 256-byte string exceeds the 255-byte uint8 textLen limit, naming 255", () => {
  assert.throws(
    () => asciiToPetscii("x".repeat(256)),
    (err: unknown) => {
      assert.ok(err instanceof StockPetsciiError);
      assert.match((err as Error).message, /255/);
      return true;
    },
  );
});

test("asciiToPetscii: refusal -- a non-string input", () => {
  // @ts-expect-error -- deliberately calling with a non-string to assert the runtime guard
  assert.throws(() => asciiToPetscii(42), StockPetsciiError);
});

test("asciiToPetscii: boundary sweep -- the four range edges convert exactly as documented", () => {
  assert.equal(asciiToPetscii("\x40")[0], 0x40, "0x40 (last of the unchanged punctuation range) is unchanged");
  assert.equal(asciiToPetscii("\x41")[0], 0xc1, "0x41 ('A', first of the uppercase case-swap range) becomes 0xc1");
  assert.equal(asciiToPetscii("\x5a")[0], 0xda, "0x5a ('Z', last of the uppercase case-swap range) becomes 0xda");
  assert.equal(asciiToPetscii("\x5b")[0], 0x5b, "0x5b (first of the unchanged bracket range) is unchanged");
  assert.equal(asciiToPetscii("\x60")[0], 0x60, "0x60 (last of the unchanged bracket range) is unchanged");
  assert.equal(asciiToPetscii("\x61")[0], 0x41, "0x61 ('a', first of the lowercase case-swap range) becomes 0x41");
  assert.equal(asciiToPetscii("\x7a")[0], 0x5a, "0x7a ('z', last of the lowercase case-swap range) becomes 0x5a");
  assert.equal(asciiToPetscii("\x7b")[0], 0x7b, "0x7b (first of the unchanged trailing punctuation range) is unchanged");
});

test("asciiToPetscii: a 255-byte string (exactly at the uint8 textLen limit) is accepted", () => {
  const result = asciiToPetscii("x".repeat(255));
  assert.equal(result.length, 255);
});
