import assert from "node:assert/strict";
import { test } from "node:test";

import { WireFailure } from "../../protocol.ts";
import { conditionExpression, flagsFromStatusRegister, joystickLines, parseDisassembly, statusRegisterFromFlags } from "./adapter.ts";

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

test("monitor disassembly parses into instructions with lowercase hex", () => {
  const answer = ".C:e5cf  85 CC       STA $CC\n.C:e5d1  8D 92 02    STA $0292\n.C:e5d4  F0 F7       BEQ $E5CD\n.C:e5d6  78          SEI";
  assert.deepEqual(parseDisassembly(answer, 0xe5cf), [
    { address: 0xe5cf, bytes: "85cc", text: "STA $cc" },
    { address: 0xe5d1, bytes: "8d9202", text: "STA $0292" },
    { address: 0xe5d4, bytes: "f0f7", text: "BEQ $e5cd" },
    { address: 0xe5d6, bytes: "78", text: "SEI" },
  ]);
  assert.deepEqual(parseDisassembly(".8:c000  97 AA       SAX $AA,Y", 0xc000), [{ address: 0xc000, bytes: "97aa", text: "SAX $aa,Y" }]);
  // A listing that wraps past $ffff ends at the wrap.
  assert.equal(parseDisassembly(".C:fffe  48          PHA\n.C:ffff  FF 2F 37    ISB $372F,X\n.C:0002  00  BRK", 0xfffe).length, 2);
});
