import assert from "node:assert/strict";
import { test } from "node:test";

import { keyTaps, MATRIX_KEYS, matrixRows, MAX_PRESS_TAPS } from "./c64-keys.ts";

const { F1, LSHIFT, RSHIFT, CBM, CTRL, STOP, DOWN, RIGHT, RETURN, SPACE } = MATRIX_KEYS as Record<string, number>;

test("the matrix places follow the CIA 1 rows and columns", () => {
  // F1: row 0 (port A bit 0), column 4 (port B bit 4); LSHIFT row 1 column 7; CBM row 7 column 5; STOP row 7 column 7.
  assert.deepEqual([F1, LSHIFT, CBM, STOP, RSHIFT], [4, 15, 61, 63, 52]);
  assert.equal(Object.keys(MATRIX_KEYS).length, 64);
  assert.deepEqual(matrixRows([F1!, LSHIFT!, CBM!]), [0x10, 0x80, 0, 0, 0, 0, 0, 0x20]);
});

test("each character is one tap; a-z and A-Z press the same key", () => {
  assert.deepEqual(keyTaps("Ra\n "), [
    { keys: [MATRIX_KEYS.R!], restore: false },
    { keys: [MATRIX_KEYS.A!], restore: false },
    { keys: [RETURN!], restore: false },
    { keys: [SPACE!], restore: false },
  ]);
  assert.deepEqual(keyTaps("!"), [{ keys: [LSHIFT!, MATRIX_KEYS["1"]!], restore: false }]);
  assert.match(keyTaps("~") as string, /the C64 keyboard has no key "~"/);
});

test("a name in braces is one key; the second function of a key adds the left SHIFT", () => {
  assert.deepEqual(keyTaps("{F1}{stop}{Down}{RIGHT}"), [F1, STOP, DOWN, RIGHT].map((key) => ({ keys: [key!], restore: false })));
  assert.deepEqual(keyTaps("{F2}{RUN}{up}{LEFT}"), [
    { keys: [F1!, LSHIFT!], restore: false },
    { keys: [LSHIFT!, STOP!], restore: false },
    { keys: [DOWN!, LSHIFT!].sort((a, b) => a - b), restore: false },
    { keys: [RIGHT!, LSHIFT!].sort((a, b) => a - b), restore: false },
  ]);
  assert.deepEqual(keyTaps("{RESTORE}"), [{ keys: [], restore: true }]);
  assert.match(keyTaps("{F9}") as string, /there is no key \{F9\}\. The keys in braces are \{F1\}/);
  assert.match(keyTaps("{}") as string, /there is no key \{\}/);
});

test("+ in braces holds the keys of one tap together", () => {
  assert.deepEqual(keyTaps("{LSHIFT+CBM}"), [{ keys: [LSHIFT!, CBM!], restore: false }]);
  assert.deepEqual(keyTaps("{ctrl+3}"), [{ keys: [MATRIX_KEYS["3"]!, CTRL!], restore: false }]);
  assert.deepEqual(keyTaps("{STOP+RESTORE}"), [{ keys: [STOP!], restore: true }]);
  // A key that two names hold counts once.
  assert.deepEqual(keyTaps("{LSHIFT+F2}"), [{ keys: [F1!, LSHIFT!], restore: false }]);
  assert.match(keyTaps("{CTRL+F9}") as string, /there is no key \{F9\}/);
  assert.match(keyTaps("{A+B+C+D+E}") as string, /\{A\+B\+C\+D\+E\} holds 5 keys, and one tap holds at most 4 keys, RESTORE included/);
  assert.match(keyTaps("{A+B+C+RESTORE+D}") as string, /holds 5 keys/);
});

test("a press has at least one tap and at most the limit", () => {
  assert.match(keyTaps("") as string, /at least one key/);
  assert.equal((keyTaps("a".repeat(MAX_PRESS_TAPS)) as unknown[]).length, MAX_PRESS_TAPS);
  assert.match(keyTaps("a".repeat(MAX_PRESS_TAPS + 1)) as string, /at most 64 taps/);
});
