import assert from "node:assert/strict";
import { test } from "node:test";

import { channelOf, oldNodeRefusal, PACKAGE } from "./package.ts";

test("a prerelease version goes to next, a release to latest", () => {
  assert.equal(channelOf("2.0.0-rc.1"), "next");
  assert.equal(channelOf("2.0.0"), "latest");
});

test("the Node.js major version comes from the engines field of package.json", () => {
  assert.equal(PACKAGE.nodeMajor, 24);
});

test("an older Node.js is refused by name with the remedy, the required one and newer run", () => {
  assert.equal(oldNodeRefusal("22.22.0", 24), "c64-re-tools needs Node.js 24 or newer, and this is Node.js 22.22.0. Install Node.js 24 from https://nodejs.org/ and run the command again.");
  assert.equal(oldNodeRefusal("24.0.0", 24), undefined);
  assert.equal(oldNodeRefusal("26.1.0", 24), undefined);
  assert.equal(oldNodeRefusal(), undefined);
});
