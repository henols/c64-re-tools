// Operand expressions: the part of ACME's expression syntax that names
// an operand by symbols and numbers. Knowledge checks an expression against
// the image with it, and retro-source writes it with the names of its layout.
//
// Priorities are ACME's, from high to low: unary - and !, then * / %, + -,
// << >> >>>, unary < and >, &, XOR, |. A unary < or > takes everything of a
// higher priority after it, so <a+1 is the low byte of a+1.

import { Refusal } from "../errors.ts";

/** The selectors of an operand expression: a byte of a symbol, its value, or free expression text. */
export const OPERAND_SELECTS = ["lo", "hi", "value", "expr"] as const;
export type OperandSelect = (typeof OPERAND_SELECTS)[number];

/** An operand expression as knowledge stores it: a symbol with an offset, or text for expr. */
export interface OperandExpression {
  select: OperandSelect;
  symbol?: string;
  offset?: number;
  expression?: string;
}

type Node =
  | { kind: "number"; value: number }
  | { kind: "name"; name: string }
  | { kind: "unary"; operator: string; operand: Node }
  | { kind: "binary"; operator: string; left: Node; right: Node };

/** Binary operators by priority (higher binds tighter); unary < and > sit at LOW_HIGH. */
const BINARY: Record<string, number> = { "*": 10, "/": 10, "%": 10, "+": 9, "-": 9, "<<": 8, ">>": 8, ">>>": 8, "&": 4, XOR: 3, "|": 2 };
const LOW_HIGH = 7;
const NAME = /^[A-Za-z_.][A-Za-z0-9_]*/;
const MAX_TEXT = 200;

interface Token {
  text: string;
  at: number;
}

/** The expression as tokens with their offsets; context decides % (binary literal or remainder). */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let at = 0;
  let operandNext = true;
  while (at < text.length) {
    const rest = text.slice(at);
    const space = /^\s+/.exec(rest);
    if (space) {
      at += space[0].length;
      continue;
    }
    const number: RegExpExecArray | null = operandNext ? /^(\$[0-9A-Fa-f]+|%[01]+|[0-9]+)/.exec(rest) : null;
    const match: RegExpExecArray | null = number ?? /^(>>>|<<|>>|XOR\b)/.exec(rest) ?? NAME.exec(rest) ?? /^[-+*/%&|!<>()]/.exec(rest);
    if (!match) throw new Refusal("invalid-input", `"${text}" has an unknown character at position ${at + 1}: "${rest[0]}".`);
    const token: string = match[0];
    tokens.push({ text: token, at });
    at += token.length;
    // After an operand or a ), an operator comes next; after anything else, an operand.
    operandNext = !(number !== null || (NAME.test(token) && token !== "XOR") || token === ")");
  }
  return tokens;
}

function parse(text: string): Node {
  if (text.trim().length === 0) throw new Refusal("invalid-input", "An expression is empty.");
  if (text.length > MAX_TEXT) throw new Refusal("invalid-input", `An expression has at most ${MAX_TEXT} characters.`);
  const tokens = tokenize(text);
  let index = 0;
  const peek = () => tokens[index]?.text;
  const fail = (what: string): never => {
    throw new Refusal("invalid-input", `"${text}" ${what}.`);
  };

  const operand = (): Node => {
    const token = tokens[index++]?.text ?? fail("ends where an operand is missing");
    if (token === "(") {
      const inner = binary(0);
      if (tokens[index++]?.text !== ")") fail("has a ( with no )");
      return inner;
    }
    if (token === "-" || token === "!") return { kind: "unary", operator: token, operand: operand() };
    if (token === "<" || token === ">") return { kind: "unary", operator: token, operand: binary(LOW_HIGH + 1) };
    if (token.startsWith("$")) return { kind: "number", value: Number.parseInt(token.slice(1), 16) };
    if (token.startsWith("%")) return { kind: "number", value: Number.parseInt(token.slice(1), 2) };
    if (/^[0-9]/.test(token)) return { kind: "number", value: Number.parseInt(token, 10) };
    if (NAME.test(token) && token !== "XOR") return { kind: "name", name: token };
    return fail(`has "${token}" where an operand must be`);
  };

  const binary = (minimum: number): Node => {
    let left = operand();
    for (;;) {
      const operator = peek();
      const priority = operator === undefined ? undefined : BINARY[operator];
      if (priority === undefined || priority < minimum) return left;
      index++;
      left = { kind: "binary", operator: operator!, left, right: binary(priority + 1) };
    }
  };

  const tree = binary(0);
  if (index < tokens.length) fail(`has "${tokens[index]!.text}" after the end of the expression`);
  return tree;
}

function names(node: Node, into: string[]): string[] {
  if (node.kind === "name" && !into.includes(node.name)) into.push(node.name);
  if (node.kind === "unary") names(node.operand, into);
  if (node.kind === "binary") {
    names(node.left, into);
    names(node.right, into);
  }
  return into;
}

function value(node: Node, resolve: (name: string) => number | undefined): number {
  switch (node.kind) {
    case "number":
      return node.value;
    case "name": {
      const found = resolve(node.name);
      if (found === undefined) throw new Refusal("invalid-input", `${node.name} is not a symbol of the knowledge or a platform name. Give a number, a symbol of the project knowledge, or a platform name of the memory map of the machine.`);
      return found;
    }
    case "unary": {
      const inner = value(node.operand, resolve);
      if (node.operator === "-") return -inner;
      if (node.operator === "!") return ~inner;
      return node.operator === "<" ? inner & 0xff : (inner >> 8) & 0xff;
    }
    case "binary": {
      const left = value(node.left, resolve);
      const right = value(node.right, resolve);
      switch (node.operator) {
        case "*":
          return left * right;
        case "/":
        case "%":
          if (right === 0) throw new Refusal("invalid-input", "An expression divides by zero.");
          return node.operator === "/" ? Math.trunc(left / right) : left % right;
        case "+":
          return left + right;
        case "-":
          return left - right;
        case "<<":
          return left << right;
        case ">>":
          return left >> right;
        case ">>>":
          return left >>> right;
        case "&":
          return left & right;
        case "XOR":
          return left ^ right;
        default:
          return left | right;
      }
    }
  }
}

/** Throws an invalid-input Refusal when the text is no expression of this syntax. */
export function checkExpression(text: string): void {
  parse(text);
}

/** The value of the expression; `resolve` gives the value of a name, or undefined. */
export function evaluate(text: string, resolve: (name: string) => number | undefined): number {
  return value(parse(text), resolve);
}

/** The names the expression uses, each once, in their order. */
export function identifiers(text: string): string[] {
  return names(parse(text), []);
}

/**
 * The text with each name replaced by `replace(name)` (a name it returns
 * unchanged stays). Spaces and other tokens stay as written.
 */
export function replaceIdentifiers(text: string, replace: (name: string) => string): string {
  parse(text);
  let out = "";
  let from = 0;
  for (const token of tokenize(text)) {
    if (!NAME.test(token.text) || token.text === "XOR") continue;
    out += text.slice(from, token.at) + replace(token.text);
    from = token.at + token.text.length;
  }
  return out + text.slice(from);
}

function offsetText(offset: number): string {
  const size = Math.abs(offset);
  return `${offset < 0 ? "-" : "+"}${size < 10 ? String(size) : `$${size.toString(16)}`}`;
}

/** ACME text of an operand expression, for example <irq_handler, >(sprite_bank+$1000) or bar_colours-1. */
export function operandText(operand: OperandExpression): string {
  if (operand.select === "expr") return operand.expression!;
  const offset = operand.offset ?? 0;
  const sum = offset === 0 ? operand.symbol! : `${operand.symbol!}${offsetText(offset)}`;
  if (operand.select === "value") return sum;
  const selector = operand.select === "lo" ? "<" : ">";
  return offset === 0 ? `${selector}${sum}` : `${selector}(${sum})`;
}
