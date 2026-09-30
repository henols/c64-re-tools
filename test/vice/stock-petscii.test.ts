// node:test coverage of stock-petscii.ts's asciiToPetscii(): an exhaustive
// sweep over every input code point 0x00-0xff, plus named cases. The expected
// byte comes from an independent range table below, never from the function
// under test.
import { test } from "node:test";
import assert from "node:assert/strict";

import { asciiToPetscii, PETSCII_RETURN, StockPetsciiError } from "../../src/mcp/vice/stock-petscii.ts";

/**
 * Independently-written expectation for one input byte, computed from the
 * documented range table (never by calling asciiToPetscii()). Returns the
 * expected output byte, or `null` if the byte is expected to be refused.
 */
function expectedByte(byte: number, upper: boolean): number | null {
  if (byte === 0x0a || byte === 0x0d) return PETSCII_RETURN;
  if (byte >= 0x20 && byte <= 0x40) return byte;
  if (byte >= 0x41 && byte <= 0x5a) return byte;
  if (byte >= 0x5b && byte <= 0x60) return byte;
  if (byte >= 0x61 && byte <= 0x7a) return upper ? byte - 0x20 : byte;
  if (byte >= 0x7b && byte <= 0x7e) return byte;
  return null;
}

test("asciiToPetscii: every code point 0x00-0xff converts or refuses as the range table says, with the default upper mapping", () => {
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

test("asciiToPetscii: every code point 0x00-0xff converts or refuses as the range table says, with upper false", () => {
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

test("asciiToPetscii: 'A' becomes 0x41 by default, the capital A of the power-on charset", () => {
  assert.deepEqual(asciiToPetscii("A"), Buffer.from([0x41]));
});

test("asciiToPetscii: 'a' also becomes 0x41 by default, so either case types a capital", () => {
  assert.deepEqual(asciiToPetscii("a"), Buffer.from([0x41]));
});

test("asciiToPetscii: with upper false, 'A' stays 0x41 and 'a' stays 0x61", () => {
  assert.deepEqual(asciiToPetscii("Aa", { upper: false }), Buffer.from([0x41, 0x61]));
});

test("asciiToPetscii: 'PRINT 7*6' in either case gives the same bytes BASIC tokenises as a PRINT statement", () => {
  const expected = Buffer.from([0x50, 0x52, 0x49, 0x4e, 0x54, 0x20, 0x37, 0x2a, 0x36, 0x0d]);
  assert.deepEqual(asciiToPetscii("PRINT 7*6\n"), expected);
  assert.deepEqual(asciiToPetscii("print 7*6\n"), expected);
});

test("asciiToPetscii: explicit named case -- '\\n' (LF) becomes PETSCII_RETURN (0x0d)", () => {
  assert.deepEqual(asciiToPetscii("\n"), Buffer.from([0x0d]));
});

test("asciiToPetscii: explicit named case -- '\\r' (CR) also becomes PETSCII_RETURN (0x0d)", () => {
  assert.deepEqual(asciiToPetscii("\r"), Buffer.from([0x0d]));
});

test('asciiToPetscii: explicit named case -- \'LOAD"*",8,1\\n\' produces the expected 12-byte sequence', () => {
  const result = asciiToPetscii('LOAD"*",8,1\n');
  assert.deepEqual(result, Buffer.from([0x4c, 0x4f, 0x41, 0x44, 0x22, 0x2a, 0x22, 0x2c, 0x38, 0x2c, 0x31, 0x0d]));
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

test("asciiToPetscii: the range edges convert as the range table says", () => {
  assert.equal(asciiToPetscii("\x40")[0], 0x40, "0x40 (last of the unchanged punctuation range) is unchanged");
  assert.equal(asciiToPetscii("\x41")[0], 0x41, "0x41 ('A') is unchanged");
  assert.equal(asciiToPetscii("\x5a")[0], 0x5a, "0x5a ('Z') is unchanged");
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
