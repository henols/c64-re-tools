import assert from "node:assert/strict";
import { test } from "node:test";

import { WireFailure } from "./messages.ts";
import { SPECTRUM_OPERATIONS, spectrumAttachmentCount, validateSpectrumParams } from "./spectrum.ts";

const refused = (pattern: RegExp) => (error: unknown) => error instanceof WireFailure && error.code === "invalid-input" && pattern.test(error.message);

test("each Spectrum operation is checked, and only autostart and programLoad take a file", () => {
  for (const op of SPECTRUM_OPERATIONS) assert.throws(() => validateSpectrumParams(op, null), refused(/parameters must be an object/), op);
  assert.deepEqual(
    SPECTRUM_OPERATIONS.filter((op) => spectrumAttachmentCount(op) > 0),
    ["autostart", "programLoad"],
  );
});

test("defaults are filled in, and unknown fields are refused", () => {
  assert.deepEqual(validateSpectrumParams("execution", { action: "step" }), { action: "step", count: 1 });
  assert.deepEqual(validateSpectrumParams("execution", { action: "pause" }), { action: "pause" });
  assert.deepEqual(validateSpectrumParams("reset", {}), { run: false });
  assert.deepEqual(validateSpectrumParams("watchpoint", { action: "add", start: 0x5c00, access: "write" }), { action: "add", start: 0x5c00, end: 0x5c00, access: "write" });
  assert.deepEqual(validateSpectrumParams("joystick", { fire: true }), { up: false, down: false, left: false, right: false, fire: true });
  assert.throws(() => validateSpectrumParams("status", { verbose: true }), WireFailure);
  assert.throws(() => validateSpectrumParams("breakpoint", { action: "add", address: 0x8000, condition: "A=1" }), WireFailure);
});

test("ranges, counts and registers stay in their limits", () => {
  assert.throws(() => validateSpectrumParams("memoryRead", { address: 0xfff0, size: 0x20 }), refused(/past \$ffff/));
  assert.throws(() => validateSpectrumParams("memoryRead", { address: 0x10000, size: 1 }), refused(/address must be an address/));
  assert.throws(() => validateSpectrumParams("memoryWrite", { address: 0x8000, data: "AB" }), refused(/lowercase hex/));
  assert.throws(() => validateSpectrumParams("watchpoint", { action: "add", start: 0x8001, end: 0x8000, access: "read" }), refused(/end must not be before start/));
  assert.throws(() => validateSpectrumParams("execution", { action: "advance-frames", count: 3001 }), refused(/count must be 1 to 3000/));
  assert.throws(() => validateSpectrumParams("registersSet", { values: { a: 1 } }), refused(/a is not a register/));
  assert.throws(() => validateSpectrumParams("registersSet", { values: { i: 0x100 } }), refused(/i must be 0 to 255/));
  assert.deepEqual(validateSpectrumParams("registersSet", { values: { hl2: 0xabcd } }), { values: { hl2: 0xabcd } });
  assert.throws(() => validateSpectrumParams("keyboard", { text: "café" }), refused(/printable ASCII/));
  assert.throws(() => validateSpectrumParams("autostart", { type: "prg" }), refused(/tap, tzx, z80, sna or zsf/));
  assert.throws(() => validateSpectrumParams("snapshot", { action: "save", name: "../x" }), refused(/name must be/));
});
