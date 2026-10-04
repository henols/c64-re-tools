import assert from "node:assert/strict";
import { test } from "node:test";

import { formatC64Address, parseC64Address, petsciiNameToText, textToPetscii, textToPetsciiName } from "./c64.ts";

test("C64 address primitives use canonical four-digit hexadecimal", () => {
  assert.equal(parseC64Address("$d020"), 0xd020);
  assert.equal(parseC64Address("$D020"), 0xd020);
  assert.equal(formatC64Address(0x2a), "$002a");
  assert.throws(() => parseC64Address("d020"));
  assert.throws(() => formatC64Address(0x10000));
});

test("text becomes the PETSCII the keyboard types", () => {
  assert.deepEqual([...textToPetscii("RUN\n")], [0x52, 0x55, 0x4e, 0x0d]);
  assert.deepEqual([...textToPetscii("run\r\n")], [0x52, 0x55, 0x4e, 0x0d]);
  assert.deepEqual([...textToPetscii('10 PRINT "HI";A$(1)')], [...Buffer.from('10 PRINT "HI";A$(1)', "latin1")]);
  assert.deepEqual([...textToPetscii("@[]£↑←")], [0x40, 0x5b, 0x5d, 0x5c, 0x5e, 0x5f]);
  assert.throws(() => textToPetscii("tab\there"), /\\t/);
  assert.throws(() => textToPetscii("{"), RangeError);
});

test("a PETSCII name shows as directory text and converts back to the same bytes", () => {
  const bytes = Uint8Array.from([0x47, 0x41, 0x4d, 0x45, 0x20, 0x31, 0x5c, 0x5e, 0x5f, 0xc1, 0x00, 0x7b]);
  const text = petsciiNameToText(bytes);
  assert.equal(text, "GAME 1£↑←{$c1}{$00}{$7b}");
  assert.deepEqual([...textToPetsciiName(text)], [...bytes]);
  assert.deepEqual([...textToPetsciiName("game")], [0x47, 0x41, 0x4d, 0x45], "either letter case is the unshifted letter");
  assert.deepEqual([...textToPetsciiName("{$A0}")], [0xa0]);
  assert.throws(() => textToPetsciiName("a{b"), RangeError);
  assert.throws(() => textToPetsciiName("é"), RangeError);
});
