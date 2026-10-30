// The switch values of config.asm: a build reads them, and takes other values
// for some switches in its copy of the text.

import assert from "node:assert/strict";
import { test } from "node:test";

import { configValues, withConfigValues } from "./build-name.ts";

test("a build changes only the value lines of the given switches, and keeps their comments and the other lines", () => {
  const text = "; Switches\r\nTRAINER = 0 ; on in V2\r\nCRACK = 1\r\nCRACK_TEXT = 0\r\n";
  const changed = withConfigValues(text, new Map([["TRAINER", 1], ["CRACK", 0]]));
  assert.equal(changed, "; Switches\r\nTRAINER = 1 ; on in V2\r\nCRACK = 0\r\nCRACK_TEXT = 0\r\n");
  assert.deepEqual([...configValues(changed)], [["TRAINER", 1], ["CRACK", 0], ["CRACK_TEXT", 0]]);
});
