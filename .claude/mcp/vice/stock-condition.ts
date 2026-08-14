#!/usr/bin/env node
// stock-condition.ts
//
// The ONE place that builds a checkpoint-condition expression for stock
// VICE's binary monitor: a typed AST, a single canonical emitter that turns
// that AST into wire text, and the two input paths (a fork-compatible
// string and a structured object) that both funnel into it (D-09). No other
// module in this tree may construct condition text.
//
// WHY THIS FILE EXISTS: VICE's condition parser has three independent traps
// that each produce a condition that is always false, with NO diagnostic
// over the socket -- only error code 0x8f, with no body. (1) No operator
// precedence at all (mon_parse.y:168), so a naive `RL == $64 && CY == $14`
// parses as `(((RL==$64) && CY) == $14)`, always false. (2) Bare integer
// literals are read as HEX by default (monitor.c:1597), so `RL == 100`
// silently means raster line 256, not 100. (3) The pseudo-registers are the
// uppercase-only tokens `RL`/`CY`, NOT the REGISTERS_GET names `LIN`/`CYC`,
// which lex as BANKNAME in COND_MODE and fail with error 0x8f and no socket
// diagnostic. String concatenation at a call site is exactly how all three
// ship in practice -- there is nothing at the call site to stop it. This
// file exists to make that class of bug structurally unreachable rather
// than merely discouraged: a typed AST plus one emitter that always
// over-parenthesises, always emits `$hex`, and always uppercases RL/CY.
//
// WHAT NOT TO DO:
//   - Never string-concatenate a condition -- that is exactly how a
//     silently-always-false condition ships (unparenthesised `&&`, decimal
//     literal, wrong-case register); D-09/D-10 exist to make this class of
//     bug structurally unreachable.
//   - Never add a second emitter, a "minimal parens" mode, or a fast path
//     that skips emitCondition()'s range/kind validation. Because VICE has
//     no operator precedence at all, over-parenthesising is the ONLY safe
//     emission -- there is no such thing as an unnecessary paren here.
//   - Never trust a caller's AST as already-valid. emitCondition() is the
//     last gate before the wire and re-validates every literal and every
//     kind itself, even though parseConditionString() and conditionFromJson()
//     also validate on the way in.
//   - Phase 6's GAIN-06 extends this AST with raster semantics (finer-grained
//     raster/cycle conditions) rather than replacing it or adding a second,
//     parallel condition-building path. Any future raster work grows this
//     module's types, it does not fork them.
//
// This module has no handlers and no dispatch entries -- a later plan
// consumes emitCondition()'s output as the only thing a condition-set
// request body ever receives. It is a pure transform: it never resolves a
// session, never touches a socket, never imports anything from the
// session/session-handler layer.

import { ViceError } from "./vice.ts";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export interface StockConditionErrorOptions {
  /** For conditionFromJson(): the offending field path, e.g. "condition.left.op". */
  path?: string;
  /** For parseConditionString(): the offending token/substring, verbatim. */
  token?: string;
}

/**
 * Raised by every validation/refusal path in this module: emitCondition()'s
 * own re-validation, parseConditionString()'s six named traps, and
 * conditionFromJson()'s narrowing refusals. Always carries an explanation
 * naming the correct form -- never a bare "syntax error" (D-09).
 */
export class StockConditionError extends ViceError {
  path?: string;
  token?: string;

  constructor(message: string, { path, token }: StockConditionErrorOptions = {}) {
    super(message);
    this.name = "StockConditionError";
    this.path = path;
    this.token = token;
  }
}

// ---------------------------------------------------------------------------
// The typed AST
// ---------------------------------------------------------------------------

export type ConditionRegister = "A" | "X" | "Y" | "SP" | "PC" | "FL";

/** The condition-grammar-only pseudo-registers -- raster line and cycle
 * within line. Deliberately NOT named LIN/CYC (the REGISTERS_GET names);
 * see the header comment's trap (3). */
export type ConditionPseudo = "RL" | "CY";

export type ConditionOperand =
  | { kind: "register"; name: ConditionRegister }
  | { kind: "pseudo"; name: ConditionPseudo }
  | { kind: "literal"; value: number };

export type ConditionOp = "==" | "!=" | "<" | ">" | "<=" | ">=";

export type ConditionNode =
  | { kind: "comparison"; left: ConditionOperand; op: ConditionOp; right: ConditionOperand }
  | { kind: "and"; left: ConditionNode; right: ConditionNode }
  | { kind: "or"; left: ConditionNode; right: ConditionNode };

const REGISTER_NAMES: readonly string[] = ["A", "X", "Y", "SP", "PC", "FL"];
const PSEUDO_NAMES: readonly string[] = ["RL", "CY"];
const CONDITION_OPS: readonly string[] = ["==", "!=", "<", ">", "<=", ">="];

/** 312 PAL raster lines, 0-indexed -- the largest legal RL comparison value. */
const RASTER_LINE_MAX = 0x138;
/** 63 cycles per raster line, 0-indexed -- the largest legal CY comparison value. */
const CYCLE_MAX = 0x3f;

/** D-09/T-3-04: a pathological nested object or an absurd chain of
 * comparisons must not be able to blow the 255-byte wire limit or the
 * parser's own stack. Both input paths cap at the same numbers. */
const MAX_CONDITION_DEPTH = 8;
const MAX_COMPARISON_COUNT = 8;

// ---------------------------------------------------------------------------
// The canonical emitter -- the ONE function that ever produces condition
// wire text. Every rule below is structural, not a style preference: because
// VICE's condition grammar has no operator precedence at all, there is no
// "minimal parens" mode, and because bare integers are hex by default, there
// is no bare-decimal emission path.
// ---------------------------------------------------------------------------

/** Formats a validated literal as `$` + lowercase hex, zero-padded to 2
 * digits for values <= 0xff and to 4 digits for values <= 0xffff. Never a
 * bare decimal, never `0x`, never uppercase hex digits -- one deterministic
 * form. Re-validates range itself; this is the last gate before the wire. */
function formatLiteral(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new StockConditionError(
      `condition literal ${value} is out of range -- must be an integer between 0 and 0xffff (65535) inclusive`,
    );
  }
  const width = value <= 0xff ? 2 : 4;
  return `$${value.toString(16).padStart(width, "0")}`;
}

/** RL/CY comparisons get an additional range check on top of the general
 * 0..0xffff literal check: a raster-line or cycle value outside the real
 * hardware range can never be true, and would otherwise arm a checkpoint
 * that looks valid but never fires -- the same "silently always false"
 * failure mode D-09 exists to prevent, just from a different trap. */
function checkPseudoLiteralRange(pseudo: ConditionPseudo, literalValue: number): void {
  if (pseudo === "RL" && literalValue > RASTER_LINE_MAX) {
    throw new StockConditionError(
      `RL (raster line) literal ${formatLiteral(literalValue)} exceeds the maximum 0x138 (312 PAL raster ` +
        `lines, 0-indexed) -- VICE's condition lexer reads bare integers as hex by default (monitor.c:1597), ` +
        `so double-check the intended raster line before widening this condition`,
    );
  }
  if (pseudo === "CY" && literalValue > CYCLE_MAX) {
    throw new StockConditionError(
      `CY (cycle within line) literal ${formatLiteral(literalValue)} exceeds the maximum 0x3f (63 cycles per ` +
        `line, 0-indexed) -- VICE's condition lexer reads bare integers as hex by default (monitor.c:1597), ` +
        `so double-check the intended cycle before widening this condition`,
    );
  }
}

function emitOperand(operand: ConditionOperand): string {
  switch (operand.kind) {
    case "register":
      return operand.name;
    case "pseudo":
      return operand.name;
    case "literal":
      return formatLiteral(operand.value);
    default: {
      const exhaustive: never = operand;
      throw new StockConditionError(`condition operand has an unrecognised kind: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function emitComparisonNode(node: Extract<ConditionNode, { kind: "comparison" }>): string {
  const leftText = emitOperand(node.left);
  const rightText = emitOperand(node.right);
  if (node.left.kind === "pseudo" && node.right.kind === "literal") {
    checkPseudoLiteralRange(node.left.name, node.right.value);
  }
  if (node.right.kind === "pseudo" && node.left.kind === "literal") {
    checkPseudoLiteralRange(node.right.name, node.left.value);
  }
  // A comparison always emits its own parentheses -- never bare. See the
  // header comment: there is no operator precedence, so over-parenthesising
  // is the only safe emission.
  return `(${leftText} ${node.op} ${rightText})`;
}

/**
 * The ONE function in this tree that ever produces condition wire text.
 * Both parseConditionString() and conditionFromJson() only ever build the
 * AST above -- this is the sole place that turns it into bytes-on-the-wire
 * text, and it re-validates every literal and every kind itself rather than
 * trusting its caller (it is the last gate before the wire).
 *
 * A comparison emits `(<left> <op> <right>)` -- always its own parentheses.
 * An and/or emits `(<left> && <right>)` / `(<left> || <right>)` -- also
 * always its own parentheses. So the worked trap-avoidance example
 * `{ kind: "and", left: { kind: "comparison", left: { kind: "pseudo", name: "RL" }, op: "==", right: { kind: "literal", value: 0x64 } }, right: { kind: "comparison", left: { kind: "pseudo", name: "CY" }, op: "==", right: { kind: "literal", value: 0x14 } } }`
 * emits exactly `((RL == $64) && (CY == $14))`.
 */
export function emitCondition(node: ConditionNode): string {
  switch (node.kind) {
    case "comparison":
      return emitComparisonNode(node);
    case "and":
      return `(${emitCondition(node.left)} && ${emitCondition(node.right)})`;
    case "or":
      return `(${emitCondition(node.left)} || ${emitCondition(node.right)})`;
    default: {
      const exhaustive: never = node;
      throw new StockConditionError(`condition node has an unrecognised kind: ${JSON.stringify(exhaustive)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// conditionFromJson() -- D-09's structured-object input path
// ---------------------------------------------------------------------------

/** True iff `value` is a well-formed, generic JSON object -- not null, not
 * an array. Matches this module tree's own isPlainObject() convention
 * (vice.ts:310-316) -- redeclared privately here, not imported, per the
 * established per-module convention. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function narrowRegisterName(name: unknown, path: string): ConditionRegister {
  if (typeof name !== "string") {
    throw new StockConditionError(`${path} must be a string register name, got ${typeof name}`, { path });
  }
  const upper = name.toUpperCase();
  if (upper === "LIN" || upper === "CYC") {
    throw new StockConditionError(
      `${path}: "${name}" is not a register -- the pseudo-registers are "RL" (raster line) and "CY" (cycle ` +
        `within line), not "LIN"/"CYC" (those lex as BANKNAME in COND_MODE and fail with error 0x8f, no socket ` +
        `diagnostic)`,
      { path },
    );
  }
  if (!REGISTER_NAMES.includes(upper)) {
    throw new StockConditionError(
      `${path}: "${name}" is not a recognised register -- must be one of ${REGISTER_NAMES.join(", ")}`,
      { path },
    );
  }
  if (name !== upper) {
    throw new StockConditionError(
      `${path}: register names must be uppercase -- use "${upper}", not "${name}"`,
      { path },
    );
  }
  return upper as ConditionRegister;
}

function narrowPseudoName(name: unknown, path: string): ConditionPseudo {
  if (typeof name !== "string") {
    throw new StockConditionError(`${path} must be a string pseudo-register name, got ${typeof name}`, { path });
  }
  const upper = name.toUpperCase();
  if (upper === "LIN" || upper === "CYC") {
    throw new StockConditionError(
      `${path}: "${name}" is not a valid pseudo-register -- use "RL" (raster line) or "CY" (cycle within ` +
        `line), not "LIN"/"CYC" (those lex as BANKNAME in COND_MODE and fail with error 0x8f, no socket ` +
        `diagnostic)`,
      { path },
    );
  }
  if (!PSEUDO_NAMES.includes(upper)) {
    throw new StockConditionError(
      `${path}: "${name}" is not a recognised pseudo-register -- must be "RL" or "CY"`,
      { path },
    );
  }
  if (name !== upper) {
    throw new StockConditionError(
      `${path}: pseudo-register names must be uppercase -- use "${upper}", not "${name}"`,
      { path },
    );
  }
  return upper as ConditionPseudo;
}

function narrowOperand(value: unknown, path: string): ConditionOperand {
  if (!isPlainObject(value)) {
    throw new StockConditionError(
      `${path} must be an object with a "kind" field ("register", "pseudo", or "literal")`,
      { path },
    );
  }
  switch (value.kind) {
    case "register":
      return { kind: "register", name: narrowRegisterName(value.name, `${path}.name`) };
    case "pseudo":
      return { kind: "pseudo", name: narrowPseudoName(value.name, `${path}.name`) };
    case "literal": {
      const literal = value.value;
      if (typeof literal !== "number") {
        throw new StockConditionError(
          `${path}.value must be a number, got ${typeof literal}`,
          { path: `${path}.value` },
        );
      }
      return { kind: "literal", value: literal };
    }
    default:
      throw new StockConditionError(
        `${path}.kind is missing or unrecognised: ${JSON.stringify(value.kind)} -- must be "register", ` +
          `"pseudo", or "literal"`,
        { path: `${path}.kind` },
      );
  }
}

interface NarrowState {
  comparisons: number;
}

function narrowConditionNode(value: unknown, path: string, depth: number, state: NarrowState): ConditionNode {
  if (depth > MAX_CONDITION_DEPTH) {
    throw new StockConditionError(
      `${path}: condition nesting exceeds the maximum depth of ${MAX_CONDITION_DEPTH} -- refused to bound the ` +
        `wire-frame size and the parser's own stack`,
      { path },
    );
  }
  if (!isPlainObject(value)) {
    throw new StockConditionError(
      `${path} must be an object with a "kind" field ("comparison", "and", or "or")`,
      { path },
    );
  }
  switch (value.kind) {
    case "comparison": {
      state.comparisons += 1;
      if (state.comparisons > MAX_COMPARISON_COUNT) {
        throw new StockConditionError(
          `${path}: condition has more than ${MAX_COMPARISON_COUNT} comparisons -- refused to bound the ` +
            `wire-frame size and the parser's own stack`,
          { path },
        );
      }
      const op = value.op;
      if (typeof op !== "string" || !CONDITION_OPS.includes(op)) {
        throw new StockConditionError(
          `${path}.op: "${String(op)}" is not a recognised operator -- must be one of ${CONDITION_OPS.join(", ")}`,
          { path: `${path}.op` },
        );
      }
      return {
        kind: "comparison",
        left: narrowOperand(value.left, `${path}.left`),
        op: op as ConditionOp,
        right: narrowOperand(value.right, `${path}.right`),
      };
    }
    case "and":
      return {
        kind: "and",
        left: narrowConditionNode(value.left, `${path}.left`, depth + 1, state),
        right: narrowConditionNode(value.right, `${path}.right`, depth + 1, state),
      };
    case "or":
      return {
        kind: "or",
        left: narrowConditionNode(value.left, `${path}.left`, depth + 1, state),
        right: narrowConditionNode(value.right, `${path}.right`, depth + 1, state),
      };
    default:
      throw new StockConditionError(
        `${path}.kind is missing or unrecognised: ${JSON.stringify(value.kind)} -- must be "comparison", ` +
          `"and", or "or"`,
        { path: `${path}.kind` },
      );
  }
}

/**
 * D-09's structured-object input path. Narrows an untrusted parsed-JSON
 * value into the AST above, refusing with a message that names the
 * offending path (e.g. "condition.left.op") on: a missing or unknown
 * `kind`, an unknown operator string, a lowercase register or pseudo name
 * (naming the required uppercase form), `LIN`/`CYC` (naming `RL`/`CY` as the
 * replacement), a literal that is a string rather than a number, and a
 * nesting depth or comparison count over 8. Never emits text itself --
 * emitCondition() remains the only producer of wire text.
 */
export function conditionFromJson(value: unknown): ConditionNode {
  return narrowConditionNode(value, "condition", 0, { comparisons: 0 });
}
