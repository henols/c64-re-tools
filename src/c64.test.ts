import assert from "node:assert/strict";
import { test } from "node:test";

import { formatC64Address, parseC64Address } from "./c64.ts";

test("C64 address primitives use canonical four-digit hexadecimal", () => {
  assert.equal(parseC64Address("$d020"), 0xd020);
  assert.equal(parseC64Address("$D020"), 0xd020);
  assert.equal(formatC64Address(0x2a), "$002a");
  assert.throws(() => parseC64Address("d020"));
  assert.throws(() => formatC64Address(0x10000));
});
