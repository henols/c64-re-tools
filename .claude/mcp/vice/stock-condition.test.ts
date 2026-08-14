// node:test coverage of stock-condition.ts -- D-09's typed condition AST,
// its one canonical emitter, and its two input paths (fork-compatible
// string, structured object). Golden-table style, same convention as
// stock-protocol.test.ts: `[input, exactExpectedOutput]` pairs asserted with
// assert.equal (never a regex), plus one refusal test per named trap.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  emitCondition,
  conditionFromJson,
  StockConditionError,
  type ConditionNode,
} from "./stock-condition.ts";

// ---------------------------------------------------------------------------
// emitCondition() -- golden emitter table
// ---------------------------------------------------------------------------

test("emitCondition: worked RL/CY and-node example emits exactly ((RL == $64) && (CY == $14))", () => {
  const node: ConditionNode = {
    kind: "and",
    left: {
      kind: "comparison",
      left: { kind: "pseudo", name: "RL" },
      op: "==",
      right: { kind: "literal", value: 0x64 },
    },
    right: {
      kind: "comparison",
      left: { kind: "pseudo", name: "CY" },
      op: "==",
      right: { kind: "literal", value: 0x14 },
    },
  };
  assert.equal(emitCondition(node), "((RL == $64) && (CY == $14))");
});

test("emitCondition: register comparison A == $42", () => {
  const node: ConditionNode = {
    kind: "comparison",
    left: { kind: "register", name: "A" },
    op: "==",
    right: { kind: "literal", value: 0x42 },
  };
  assert.equal(emitCondition(node), "(A == $42)");
});

test("emitCondition: register comparison PC == $c000 (4-digit literal)", () => {
  const node: ConditionNode = {
    kind: "comparison",
    left: { kind: "register", name: "PC" },
    op: "==",
    right: { kind: "literal", value: 0xc000 },
  };
  assert.equal(emitCondition(node), "(PC == $c000)");
});

test("emitCondition: three-way and/or nest is fully parenthesised", () => {
  const node: ConditionNode = {
    kind: "or",
    left: {
      kind: "and",
      left: { kind: "comparison", left: { kind: "register", name: "A" }, op: "==", right: { kind: "literal", value: 0x01 } },
      right: { kind: "comparison", left: { kind: "register", name: "X" }, op: "==", right: { kind: "literal", value: 0x02 } },
    },
    right: { kind: "comparison", left: { kind: "register", name: "Y" }, op: "==", right: { kind: "literal", value: 0x03 } },
  };
  assert.equal(emitCondition(node), "(((A == $01) && (X == $02)) || (Y == $03))");
});

test("emitCondition: literal 0x05 zero-pads to 2 digits", () => {
  const node: ConditionNode = {
    kind: "comparison",
    left: { kind: "register", name: "A" },
    op: "==",
    right: { kind: "literal", value: 0x05 },
  };
  assert.equal(emitCondition(node), "(A == $05)");
});

test("emitCondition: literal 0x1234 zero-pads to 4 digits", () => {
  const node: ConditionNode = {
    kind: "comparison",
    left: { kind: "register", name: "PC" },
    op: "==",
    right: { kind: "literal", value: 0x1234 },
  };
  assert.equal(emitCondition(node), "(PC == $1234)");
});

// ---------------------------------------------------------------------------
// emitCondition() -- refusal cases
// ---------------------------------------------------------------------------

test("emitCondition: RL literal 0x139 (over the 312-line max) refuses", () => {
  const node: ConditionNode = {
    kind: "comparison",
    left: { kind: "pseudo", name: "RL" },
    op: "==",
    right: { kind: "literal", value: 0x139 },
  };
  assert.throws(() => emitCondition(node), (err: unknown) => {
    assert.ok(err instanceof StockConditionError);
    assert.match(err.message, /0x138/);
    return true;
  });
});

test("emitCondition: CY literal 0x40 (over the 63-cycle max) refuses with '63'", () => {
  const node: ConditionNode = {
    kind: "comparison",
    left: { kind: "pseudo", name: "CY" },
    op: "==",
    right: { kind: "literal", value: 0x40 },
  };
  assert.throws(() => emitCondition(node), (err: unknown) => {
    assert.ok(err instanceof StockConditionError);
    assert.match(err.message, /63/);
    return true;
  });
});

test("emitCondition: literal 0x10000 (out of general range) refuses", () => {
  const node: ConditionNode = {
    kind: "comparison",
    left: { kind: "register", name: "A" },
    op: "==",
    right: { kind: "literal", value: 0x10000 },
  };
  assert.throws(() => emitCondition(node), StockConditionError);
});

test("emitCondition: literal 1.5 (non-integer) refuses", () => {
  const node: ConditionNode = {
    kind: "comparison",
    left: { kind: "register", name: "A" },
    op: "==",
    right: { kind: "literal", value: 1.5 },
  };
  assert.throws(() => emitCondition(node), StockConditionError);
});

// ---------------------------------------------------------------------------
// conditionFromJson() -- structured-object input path
// ---------------------------------------------------------------------------

test("conditionFromJson: a valid nested object round-trips through emitCondition", () => {
  const input = {
    kind: "and",
    left: {
      kind: "comparison",
      left: { kind: "pseudo", name: "RL" },
      op: "==",
      right: { kind: "literal", value: 0x64 },
    },
    right: {
      kind: "comparison",
      left: { kind: "pseudo", name: "CY" },
      op: "==",
      right: { kind: "literal", value: 0x14 },
    },
  };
  const node = conditionFromJson(input);
  assert.equal(emitCondition(node), "((RL == $64) && (CY == $14))");
});

test("conditionFromJson: LIN pseudo name refuses with a message containing RL", () => {
  const input = {
    kind: "comparison",
    left: { kind: "pseudo", name: "LIN" },
    op: "==",
    right: { kind: "literal", value: 0x64 },
  };
  assert.throws(() => conditionFromJson(input), (err: unknown) => {
    assert.ok(err instanceof StockConditionError);
    assert.match(err.message, /RL/);
    return true;
  });
});

test("conditionFromJson: lowercase 'a' register refuses with a message containing A", () => {
  const input = {
    kind: "comparison",
    left: { kind: "register", name: "a" },
    op: "==",
    right: { kind: "literal", value: 0x42 },
  };
  assert.throws(() => conditionFromJson(input), (err: unknown) => {
    assert.ok(err instanceof StockConditionError);
    assert.match(err.message, /A/);
    return true;
  });
});

test("conditionFromJson: nesting depth over 8 refuses", () => {
  let node: unknown = {
    kind: "comparison",
    left: { kind: "register", name: "A" },
    op: "==",
    right: { kind: "literal", value: 0x01 },
  };
  for (let i = 0; i < 9; i++) {
    node = { kind: "and", left: node, right: node };
  }
  assert.throws(() => conditionFromJson(node), StockConditionError);
});
