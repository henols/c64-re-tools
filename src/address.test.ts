import assert from "node:assert/strict";
import { test } from "node:test";

import { addressOf, formatAddress, parseAddress } from "./address.ts";
import { Refusal } from "./errors.ts";

test("address primitives use canonical four-digit hexadecimal", () => {
  assert.equal(parseAddress("$d020"), 0xd020);
  assert.equal(parseAddress("$D020"), 0xd020);
  assert.equal(formatAddress(0x2a), "$002a");
  assert.equal(parseAddress("$fb"), 0xfb);
  assert.equal(parseAddress("$0"), 0);
  assert.equal(addressOf("$c000"), 0xc000);
  assert.equal(addressOf("c000"), undefined);
  for (const text of ["d020", "$", "$12345", "$g0", " $d020"]) assert.throws(() => parseAddress(text), (error: unknown) => error instanceof Refusal && error.code === "invalid-input", text);
  assert.throws(() => formatAddress(0x10000), Refusal);
});
