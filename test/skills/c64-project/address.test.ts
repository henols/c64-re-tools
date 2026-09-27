// address.test.ts -- the registry's address parser and formatter.
import { test } from "node:test";
import assert from "node:assert/strict";

import { addrNum, hex4 } from "../../../skills/c64-project/scripts/address.ts";

test("addrNum parses $-hex, 0x-hex, decimal strings and numbers", () => {
  assert.equal(addrNum("$08B1"), 0x08b1);
  assert.equal(addrNum("0x08b1"), 0x08b1);
  assert.equal(addrNum("2225"), 2225);
  assert.equal(addrNum(2225), 2225);
});

test("addrNum refuses an unparseable address instead of returning NaN", () => {
  assert.throws(() => addrNum("nope"), /cannot parse address/);
  assert.throws(() => addrNum(null), /cannot parse address/);
});

test("hex4 formats a 4-digit uppercase $ address", () => {
  assert.equal(hex4(0x08b1), "$08B1");
  assert.equal(hex4(0), "$0000");
});
