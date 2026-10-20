import assert from "node:assert/strict";
import { test } from "node:test";

import { Refusal } from "../errors.ts";
import { parseEntryState } from "./entry-state.ts";

const pages = Object.fromEntries(["$0000", "$0100", "$0200", "$0300"].map((page, index) => [page, index.toString(16).padStart(2, "0").repeat(256)]));
const capture = { registers: { pc: "$080d", a: 1, x: 2, y: 3, sp: 0xf6, flags: { n: true, i: true } }, cpuPort: { $00: 0x2f, $01: 0x37 }, pages, io: { vic: { from: "$d000", bytes: "00" } }, differsFromReset: [] };

test("an entry state of a capture parses to its registers, CPU port and pages, and keeps the rest", () => {
  const state = parseEntryState(capture, "entry_state.json");
  assert.deepEqual([state.pc, state.a, state.x, state.y, state.sp], [0x080d, 1, 2, 3, 0xf6]);
  assert.deepEqual(state.flags, { n: true, v: false, d: false, i: true, z: false, c: false });
  assert.deepEqual(state.port, [0x2f, 0x37]);
  assert.equal(state.pages.length, 0x400);
  assert.deepEqual([state.pages[0x0000], state.pages[0x0100], state.pages[0x03ff]], [0, 1, 3]);
  assert.deepEqual(Object.keys(state.raw), ["registers", "cpuPort", "pages", "io"], "differsFromReset only tells the capture what it found");
});

test("a value that is no entry state is refused with the field and the remedy", () => {
  const refused = (value: unknown, pattern: RegExp) =>
    assert.throws(() => parseEntryState(value, "x/entry_state.json"), (error: unknown) => error instanceof Refusal && error.code === "invalid-input" && /^x\/entry_state\.json is not an entry state of a program capture: /.test(error.message) && pattern.test(error.message) && /Capture the program again/.test(error.message));
  refused([], /it is not a JSON object/);
  refused({ ...capture, registers: undefined }, /it has no registers/);
  refused({ ...capture, registers: { ...capture.registers, pc: "080d" } }, /registers\.pc is not a \$ address/);
  refused({ ...capture, registers: { ...capture.registers, sp: 256 } }, /registers\.sp is not a byte/);
  refused({ ...capture, cpuPort: { $00: 0x2f } }, /cpuPort needs \$00 and \$01/);
  refused({ ...capture, pages: { ...pages, $0300: "00" } }, /pages needs \$0000, \$0100, \$0200 and \$0300/);
});
