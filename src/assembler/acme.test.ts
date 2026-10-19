import assert from "node:assert/strict";
import { test } from "node:test";

import { ACME } from "./acme.ts";
import { SJASMPLUS } from "../assembler/sjasmplus.ts";

test("the least bytes of ACME patch code come from its data directives and instructions; other code gives none", () => {
  assert.deepEqual(["lda+2 $12", "!fill $10", "bne .skip\n.skip", '!text "ab"', "!byte $ea, $ea\n!word $1234", "nop\nasl a\nrts ; done"].map(ACME.leastPatchBytes), [3, 16, undefined, undefined, 4, 3]);
});

test("sjasmplus patch code has no least length before the Z80 source generation: the build of the switch gives it", () => {
  assert.equal(SJASMPLUS.leastPatchBytes("ld a,1\nret"), undefined);
});
