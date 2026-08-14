// node:test coverage of stock-address.ts -- the one address parser (D-04),
// in stock-protocol.test.ts's golden-table style. Pure-function tests, no
// socket, no emulator.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { parseAddress, parseByteCount, setSymbolResolver, StockAddressError, type SymbolResolver } from "./stock-address.ts";

beforeEach(() => {
  setSymbolResolver(null);
});

// --------------------------------------------------------- parseAddress: accepted forms

const ACCEPTED: Array<[unknown, number]> = [
  ["$D019", 53273],
  ["$d019", 53273],
  ["0xD019", 53273],
  ["0XD019", 53273],
  ["53273", 53273],
  [53273, 53273],
  ["0", 0],
  [0, 0],
  ["$0", 0],
  ["0x0", 0],
  ["$ffff", 0xffff],
  ["0xffff", 0xffff],
  ["65535", 0xffff],
  [0xffff, 0xffff],
  ["  $D019  ", 53273],
  ["  4096  ", 4096],
];

for (const [input, expected] of ACCEPTED) {
  test(`parseAddress: ${JSON.stringify(input)} -> ${expected}`, () => {
    assert.equal(parseAddress(input), expected);
  });
}

// --------------------------------------------------------- parseAddress: refusals

const REFUSALS: Array<[unknown, RegExp]> = [
  ["$10000", /out of range/],
  [-1, /out of range/],
  [0x10000, /out of range/],
  [1.5, /out of range/],
  ["", /empty string/],
  ["$", /not a valid "\$hex"/],
  ["0x", /not a valid "0x"/],
  ["$$1000", /not a valid "\$hex"/],
  ["0xzz", /not a valid "0x"/],
  [true, /expected a number/],
  [null, /expected a number/],
  [{}, /expected a number/],
  [[1, 2], /expected a number/],
];

for (const [input, expectedMessage] of REFUSALS) {
  test(`parseAddress: ${JSON.stringify(input)} refuses matching ${expectedMessage}`, () => {
    assert.throws(() => parseAddress(input), (err: unknown) => {
      assert.ok(err instanceof StockAddressError, "must throw StockAddressError");
      assert.match((err as Error).message, expectedMessage);
      return true;
    });
  });
}

test("parseAddress: a symbolic name refuses with \"no symbol table\" and a StockAddressError, when no resolver is installed", () => {
  assert.throws(
    () => parseAddress("SCREEN"),
    (err: unknown) => {
      assert.ok(err instanceof StockAddressError);
      assert.match((err as Error).message, /no symbol table/);
      return true;
    },
  );
});

test("parseAddress: an unresolvable symbol (resolver installed, returns undefined) refuses as \"not a known symbol\", not a parse error", () => {
  const resolver: SymbolResolver = { resolve: () => undefined };
  setSymbolResolver(resolver);
  assert.throws(
    () => parseAddress("UNKNOWN_SYM"),
    (err: unknown) => {
      assert.ok(err instanceof StockAddressError);
      assert.match((err as Error).message, /not a known symbol/);
      return true;
    },
  );
});

test("parseAddress: an installed resolver resolves a known symbol to its address", () => {
  const resolver: SymbolResolver = { resolve: (name) => (name === "SCREEN" ? 0x0400 : undefined) };
  setSymbolResolver(resolver);
  assert.equal(parseAddress("SCREEN"), 0x0400);
});

test("parseAddress: setSymbolResolver(null) restores the \"no symbol table\" refusal", () => {
  setSymbolResolver({ resolve: () => 0x0400 });
  setSymbolResolver(null);
  assert.throws(() => parseAddress("SCREEN"), /no symbol table/);
});

// --------------------------------------------------------- parseByteCount

test("parseByteCount(0) throws", () => {
  assert.throws(() => parseByteCount(0), StockAddressError);
});

test("parseByteCount(65535) returns 65535", () => {
  assert.equal(parseByteCount(65535), 65535);
});

test("parseByteCount(65536) throws", () => {
  assert.throws(() => parseByteCount(65536), StockAddressError);
});

test("parseByteCount(-1) throws", () => {
  assert.throws(() => parseByteCount(-1), StockAddressError);
});

test("parseByteCount accepts $hex and 0x forms", () => {
  assert.equal(parseByteCount("$100"), 256);
  assert.equal(parseByteCount("0x100"), 256);
});

test("parseByteCount respects a custom max", () => {
  assert.equal(parseByteCount(10, { max: 10 }), 10);
  assert.throws(() => parseByteCount(11, { max: 10 }), StockAddressError);
});

test("parseByteCount refuses a non-integer number", () => {
  assert.throws(() => parseByteCount(1.5), StockAddressError);
});
