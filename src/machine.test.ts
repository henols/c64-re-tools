import assert from "node:assert/strict";
import { test } from "node:test";

import { ANY_SPACE, MACHINES, spaceOrder } from "./machine.ts";

test("each machine has its spaces, and the index takes the spaces of every machine", () => {
  const { c64, spectrum48, spectrum128 } = MACHINES;
  assert.ok(["c64", "drive8", "bank0", "bank255"].every((space) => c64.spaces.pattern.test(space)));
  assert.ok(["bank256", "drive9", "spectrum", "ram0"].every((space) => !c64.spaces.pattern.test(space)));
  assert.ok(spectrum48.spaces.pattern.test("spectrum") && !spectrum48.spaces.pattern.test("ram0"));
  assert.ok(["spectrum", "ram0", "ram7"].every((space) => spectrum128.spaces.pattern.test(space)) && !spectrum128.spaces.pattern.test("ram8"));
  assert.deepEqual(spectrum128.spaces.range("ram3"), { start: 0xc000, end: 0xffff });
  assert.deepEqual(spectrum128.spaces.range("spectrum"), { start: 0, end: 0xffff });
  assert.ok(["c64", "drive8", "bank12", "spectrum", "ram5"].every((space) => ANY_SPACE.test(space)) && !ANY_SPACE.test("ram8") && !ANY_SPACE.test("c128"));
  assert.deepEqual(["bank2", "ram1", "drive8", "c64", "spectrum", "bank10"].sort((a, b) => spaceOrder(a) - spaceOrder(b)), ["c64", "spectrum", "drive8", "ram1", "bank2", "bank10"]);
});
