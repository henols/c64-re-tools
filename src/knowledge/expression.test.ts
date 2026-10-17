import assert from "node:assert/strict";
import { test } from "node:test";

import { Refusal } from "../errors.ts";
import { checkExpression, evaluate, identifiers, operandText, replaceIdentifiers } from "./expression.ts";

const SYMBOLS: Record<string, number> = { sprite_bank: 0x3000, VICSCN: 0x0400, COLOR_RAM: 0xd800, charset: 0x2000, irq_handler: 0x80c0, a: 0x3000 };
const resolve = (name: string) => SYMBOLS[name];
const at = (text: string) => evaluate(text, resolve);

test("the expressions of the Hover Bovver specification have the values of its image", () => {
  assert.equal(at("<irq_handler") & 0xff, 0xc0);
  assert.equal(at(">irq_handler"), 0x80);
  assert.equal(at(">(sprite_bank + $1000)"), 0x40);
  assert.equal(at(">(COLOR_RAM - VICSCN)"), 0xd4);
  assert.equal(at("(sprite_bank + 5*64) / 64"), 0xc5);
  assert.equal(at("((VICSCN & $3c00) >> 6) | ((charset & $3800) >> 10)"), 0x18);
});

test("priorities and number forms are ACME's, as measured with ACME 0.97", () => {
  // Each value below is the byte that ACME 0.97 assembled for the same text.
  assert.equal(at("<a+$1ff"), 0xff);
  assert.equal(at(">a+$1ff"), 0x31);
  assert.equal(at("2 + <a + $105"), 7);
  assert.equal(at("7 % 3"), 1);
  assert.equal(at("%00000101"), 5);
  assert.equal(at("-1 & $ff"), 0xff);
  assert.equal(at("<-1"), 0xff);
  assert.equal(at("3 XOR 1"), 2);
  assert.equal(at("1 << 3 + 1"), 0x10);
  assert.equal(at("1 + 2 << 1"), 6);
  assert.equal(at("$ff >>> 4"), 0x0f);
  assert.equal(at("-8 >> 1 & $ff"), 0xfc);
  assert.equal(at("7/2"), 3);
  assert.equal(at("-7/2 & $ff"), 0xfd);
});

test("a bad expression is refused with the reason", () => {
  for (const text of ["", "a +", "(a", "a)", "a ? 1", "a b", "#<a", "$"]) assert.throws(() => checkExpression(text), Refusal, text);
  assert.throws(() => at("unknown_name + 1"), /"unknown_name" is no symbol/);
  assert.throws(() => at("a / 0"), /divides by zero/);
});

test("names are listed once, and a rename changes only whole names", () => {
  assert.deepEqual(identifiers("((VICSCN & $3c00) >> 6) | ((charset & $3800) >> 10) + VICSCN"), ["VICSCN", "charset"]);
  assert.deepEqual(identifiers("3 XOR 1"), []);
  assert.equal(replaceIdentifiers("(VICSCN_2 + VICSCN)  &  $3c00", (name) => (name === "VICSCN" ? "screen" : name)), "(VICSCN_2 + screen)  &  $3c00");
  assert.equal(replaceIdentifiers(">(a - a)", (name) => `(${name}+1)`), ">((a+1) - (a+1))");
});

test("the selectors write ACME text", () => {
  assert.equal(operandText({ select: "lo", symbol: "irq_handler" }), "<irq_handler");
  assert.equal(operandText({ select: "hi", symbol: "sprite_bank", offset: 0x1000 }), ">(sprite_bank+$1000)");
  assert.equal(operandText({ select: "value", symbol: "bar_colours", offset: -1 }), "bar_colours-1");
  assert.equal(operandText({ select: "value", symbol: "bar_colours", offset: 0 }), "bar_colours");
  assert.equal(operandText({ select: "expr", expression: "(sprite_bank + 5*64) / 64" }), "(sprite_bank + 5*64) / 64");
  assert.equal(at(operandText({ select: "hi", symbol: "sprite_bank", offset: 0x1000 })), 0x40);
});
