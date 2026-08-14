// node:test coverage of stock-condition.ts -- D-09's typed condition AST,
// its one canonical emitter, and its two input paths (fork-compatible
// string, structured object). Golden-table style, same convention as
// stock-protocol.test.ts: `[input, exactExpectedOutput]` pairs asserted with
// assert.equal (never a regex), plus one refusal test per named trap.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  emitCondition,
  parseConditionString,
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

// ---------------------------------------------------------------------------
// parseConditionString() -- fork-compatible string input path
// ---------------------------------------------------------------------------

const ACCEPTED_ROUND_TRIP: Array<[string, string]> = [
  ["A == $42", "(A == $42)"],
  ["(PC == $c000)", "(PC == $c000)"],
  ["(RL == $64) && (CY == $14)", "((RL == $64) && (CY == $14))"],
  ["0x42 == A", "($42 == A)"],
];

for (const [input, expected] of ACCEPTED_ROUND_TRIP) {
  test(`parseConditionString: "${input}" emits exactly "${expected}"`, () => {
    assert.equal(emitCondition(parseConditionString(input)), expected);
  });
}

test("parseConditionString: refuses bare decimal literal with a message containing 'hex'", () => {
  assert.throws(() => parseConditionString("RL == 100"), (err: unknown) => {
    assert.ok(err instanceof StockConditionError);
    assert.match(err.message, /hex/);
    return true;
  });
});

test("parseConditionString: refuses LIN with a message containing 'RL'", () => {
  assert.throws(() => parseConditionString("LIN == $64"), (err: unknown) => {
    assert.ok(err instanceof StockConditionError);
    assert.match(err.message, /RL/);
    return true;
  });
});

test("parseConditionString: refuses lowercase register with a message containing 'A'", () => {
  assert.throws(() => parseConditionString("a == $42"), (err: unknown) => {
    assert.ok(err instanceof StockConditionError);
    assert.match(err.message, /A/);
    return true;
  });
});

test("parseConditionString: refuses unparenthesised multi-comparison with a message containing 'precedence'", () => {
  assert.throws(() => parseConditionString("RL == $64 && CY == $14"), (err: unknown) => {
    assert.ok(err instanceof StockConditionError);
    assert.match(err.message, /precedence/);
    return true;
  });
});

test("parseConditionString: refuses empty string with a message containing 'empty'", () => {
  assert.throws(() => parseConditionString(""), (err: unknown) => {
    assert.ok(err instanceof StockConditionError);
    assert.match(err.message, /empty/);
    return true;
  });
});

test("parseConditionString: refuses unbalanced parentheses", () => {
  assert.throws(() => parseConditionString("(A == $42"), StockConditionError);
});

test("parseConditionString: refuses more than 8 comparisons", () => {
  const parts = Array.from({ length: 9 }, (_, i) => `(A == $0${i})`);
  assert.throws(() => parseConditionString(parts.join(" && ")), StockConditionError);
});

test("parseConditionString: refuses an unrecognised token", () => {
  assert.throws(() => parseConditionString("Q == $42"), StockConditionError);
});

// ---------------------------------------------------------------------------
// Structural test: the string path and the object path share one emitter
// ---------------------------------------------------------------------------

test("string path and object path produce byte-identical output for the same logical condition", () => {
  const fromString = emitCondition(parseConditionString("(RL == $64) && (CY == $14)"));
  const fromObject = emitCondition(
    conditionFromJson({
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
    }),
  );
  assert.equal(fromString, fromObject);
  assert.equal(fromString, "((RL == $64) && (CY == $14))");
});
