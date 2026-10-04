import assert from "node:assert/strict";
import { test } from "node:test";

import { WireFailure } from "../../protocol.ts";
import {
  conditionExpression,
  flagsFromStatusRegister,
  joystickLines,
  backtraceFromStack,
  parseDisassembly,
  parseHistory,
  parseMemmap,
  parseProfile,
  statusRegisterFromFlags,
} from "./adapter.ts";

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

test("monitor CPU history parses with registers and the start clock", () => {
  const answer = [
    ".C:e5cd  A5 C6       LDA $C6        A:00 X:00 Y:0a SP:f3 ..-...Z.      2535609",
    ".C:e5d4  F0 F7       BEQ $E5CD      A:12 X:34 Y:56 SP:f0 N.-....C      2535619",
  ].join("\n");
  assert.deepEqual(parseHistory(answer), [
    { address: 0xe5cd, bytes: "a5c6", text: "LDA $c6", a: 0, x: 0, y: 0x0a, sp: 0xf3, clock: 2535609n },
    { address: 0xe5d4, bytes: "f0f7", text: "BEQ $e5cd", a: 0x12, x: 0x34, y: 0x56, sp: 0xf0, clock: 2535619n },
  ]);
});

test("the backtrace comes from JSR return addresses on the stack", () => {
  const memory = new Uint8Array(0x10000);
  // $c100: JSR $c110 ... $c110: JSR $c200
  memory.set([0x20, 0x10, 0xc1], 0xc100);
  memory.set([0x20, 0x00, 0xc2], 0xc110);
  // SP = $f9. $01fa: a stray byte, $01fb-$01fc: return $c112, $01fd-$01fe: return $c102.
  memory.set([0x55, 0x12, 0xc1, 0x02, 0xc1], 0x01fa);
  assert.deepEqual(backtraceFromStack(0xf9, memory, 16), [
    { address: 0xc200, returnAddress: 0xc113 },
    { address: 0xc110, returnAddress: 0xc103 },
  ]);
  assert.equal(backtraceFromStack(0xf9, memory, 1).length, 1);
  assert.deepEqual(backtraceFromStack(0xff, memory, 16), []);
});

test("profile rows parse; rows without a routine address are skipped", () => {
  const answer = [
    "Total      %          Self      %",
    "------------- ------ ------------- ------",
    "      1924672  98.0%       1924658  98.0% fd50",
    "        36399   1.9%         19318   1.0% e9ff",
    "            0   0.0%             0   0.0% ROOT",
  ].join("\n");
  assert.deepEqual(parseProfile(answer), [
    { address: 0xfd50, totalCycles: "1924672", selfCycles: "1924658", percent: 98 },
    { address: 0xe9ff, totalCycles: "36399", selfCycles: "19318", percent: 1 },
  ]);
});

test("memmap rows merge into ranges of equal access", () => {
  const answer = [
    "addr: IO  ROM RAM",
    "0099: --- --- -w-",
    "009a: --- --- -w-",
    "00c1: --- --- r-- (uninitialized read)",
    "00c2: --- --- rw- (uninitialized read)",
    "00c3: --- --- rw-",
    "e000: --- r-x ---",
    "e001: --- r-x ---",
  ].join("\n");
  assert.deepEqual(parseMemmap(answer, 100), [
    { start: 0x0099, end: 0x009a, execute: false, read: false, write: true },
    { start: 0x00c1, end: 0x00c1, execute: false, read: true, write: false },
    { start: 0x00c2, end: 0x00c3, execute: false, read: true, write: true },
    { start: 0xe000, end: 0xe001, execute: true, read: true, write: false },
  ]);
  assert.equal(parseMemmap(answer, 2).length, 2);
});
