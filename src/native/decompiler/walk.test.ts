// The walk tells why it did not decode a seed, from its state at the end:
// the seed is in a data range or inside an instruction, or its instruction
// runs past the end of the program, into an instruction or into data.

import assert from "node:assert/strict";
import { test } from "node:test";

import { walk } from "./walk.ts";
import { loadImage } from "./wasm.ts";

test("each seed that the walk does not decode has its reason", () => {
  const code = new Uint8Array(0x11).fill(0xea);
  code.set([0x20, 0x08, 0x20, 0x60], 0x00); // $2000 JSR $2008 / RTS
  code.set([0xa9, 0x01], 0x04); // $2004 in a data range
  code.set([0xa9], 0x07); // $2007 LDA # runs into $2008
  code.set([0xad, 0x34, 0x12, 0x60], 0x08); // $2008 LDA $1234 / RTS, which holds $2009
  code.set([0x4c, 0x0e, 0x20, 0x00], 0x0c); // $200c JMP runs into the data range at $200e
  code.set([0x20], 0x10); // $2010 JSR runs past the end of the program
  loadImage(code, 0x2000);
  // The walk takes the last seed first: $2008 is decoded before the seeds in it.
  const walked = walk(code, 0x2000, 0x2010, {
    entryPoints: [0x2000],
    codeStarts: [0x2004, 0x2007, 0x2009, 0x200c, 0x2010, 0x2008],
    dataRanges: [{ start: 0x2004, end: 0x2005 }, { start: 0x200e, end: 0x200f }],
    labels: [],
  });
  assert.deepEqual(walked.refusedSeeds, [
    { address: 0x2004, reason: "in-data" },
    { address: 0x2007, reason: "into-instruction", at: 0x2008 },
    { address: 0x2009, reason: "inside-instruction", at: 0x2008 },
    { address: 0x200c, reason: "into-data" },
    { address: 0x2010, reason: "past-end" },
  ]);
  assert.ok(walked.instructions.some((instruction) => instruction.address === 0x2008));
});
