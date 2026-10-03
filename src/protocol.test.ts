import assert from "node:assert/strict";
import { test } from "node:test";

import { HOST_PROTOCOL_ID } from "./protocol.ts";

test("private protocol has a stable internal identity", () => {
  assert.equal(HOST_PROTOCOL_ID, "c64-re-tools-host");
});
