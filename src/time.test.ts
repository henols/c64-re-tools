import assert from "node:assert/strict";
import { test } from "node:test";

import { fileStampCet, isoCet } from "./time.ts";

test("CET is +01:00 in winter and in summer, across the date line", () => {
  assert.equal(isoCet(new Date("2026-01-15T23:30:00.000Z")), "2026-01-16T00:30:00.000+01:00");
  assert.equal(isoCet(new Date("2026-07-01T12:00:00.250Z")), "2026-07-01T13:00:00.250+01:00");
});

test("a file stamp is the CET time to the second, with no colon", () => {
  assert.equal(fileStampCet(new Date("2026-07-01T12:00:00.250Z")), "2026-07-01T13-00-00");
});
