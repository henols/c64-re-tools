import assert from "node:assert/strict";
import { test } from "node:test";

import { WireFailure } from "../../protocol/messages.ts";
import { parseListing } from "./petcat.ts";

test("petcat's listing lines become number and text", () => {
  assert.deepEqual(parseListing("   10 sys2061\n   20 print\"{clr}hi\"\n\n"), [
    { number: 10, text: "sys2061" },
    { number: 20, text: 'print"{clr}hi"' },
  ]);
  assert.throws(() => parseListing("-{$e9}{blu};_"), (error: unknown) => error instanceof WireFailure && error.code === "operation-failed");
});
