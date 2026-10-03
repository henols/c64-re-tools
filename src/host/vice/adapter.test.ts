import assert from "node:assert/strict";
import { test } from "node:test";

import { WireFailure } from "../../protocol.ts";
import { conditionExpression, flagsFromStatusRegister, joystickLines, statusRegisterFromFlags } from "./adapter.ts";

test("typed conditions become parenthesized VICE expressions", () => {
  assert.equal(conditionExpression({ kind: "register", register: "a", operator: "eq", value: 66 }, "c64"), "(A == $42)");
  assert.equal(conditionExpression({ kind: "register", register: "sp", operator: "lte", value: 0xf0 }, "drive8"), "(8:SP <= $f0)");
  assert.equal(
    conditionExpression({ kind: "memory", address: 0xc020, operator: "ne", value: 3, space: "c64", view: "ram" }, "c64"),
    "(@ram:$c020 != $03)",
  );
  assert.equal(conditionExpression({ kind: "raster", line: 100 }, "c64"), "(RL == $64)");
  assert.equal(conditionExpression({ kind: "raster", line: 0x130, cycle: 20 }, "c64"), "((RL == $130) && (CY >= $14))");
  for (const [operator, symbol] of [["lt", "<"], ["gt", ">"], ["gte", ">="]] as const) {
    assert.equal(conditionExpression({ kind: "register", register: "x", operator, value: 1 }, "c64"), `(X ${symbol} $01)`);
  }
});

test("a memory condition on drive8 memory is unsupported", () => {
  assert.throws(
    () => conditionExpression({ kind: "memory", address: 0, operator: "eq", value: 0, space: "drive8", view: "cpu" }, "drive8"),
    (error: unknown) => error instanceof WireFailure && error.code === "unsupported-in-space",
  );
});

test("status flags round-trip through the status register with bit 5 set", () => {
  const flags = { n: true, v: false, b: true, d: false, i: true, z: false, c: true };
  assert.equal(statusRegisterFromFlags(flags), 0b1011_0101);
  assert.deepEqual(flagsFromStatusRegister(statusRegisterFromFlags(flags)), flags);
});

test("joystick states are active-low line levels", () => {
  assert.equal(joystickLines({ port: 2, direction: "center", fire: false }), 0x1f);
  assert.equal(joystickLines({ port: 2, direction: "down-right", fire: true }), 0x1f & ~0x1a);
});
