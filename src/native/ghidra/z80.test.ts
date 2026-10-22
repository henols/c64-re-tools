import assert from "node:assert/strict";
import { test } from "node:test";

import { walk } from "./walk.ts";
import { loadImage } from "./wasm.ts";

test("the Z80 language walks calls, restarts and returns, and a port of IN or OUT is no memory reference", () => {
  // $8000: IN A,($FE) ; OUT ($FE),A ; LD A,($9000) ; CALL $8010 ; RST $10 ; JR $8000
  // $8010: RET NZ ; RET
  const image = new Uint8Array(0x12);
  image.set([0xdb, 0xfe, 0xd3, 0xfe, 0x3a, 0x00, 0x90, 0xcd, 0x10, 0x80, 0xd7, 0x18, 0xf3], 0);
  image.set([0xc0, 0xc9], 0x10);
  loadImage(image, 0x8000, "z80:LE:16:default");
  const result = walk(image, 0x8000, 0x8011, { entryPoints: [0x8000], codeStarts: [], dataRanges: [], labels: [] }, "z80");
  assert.deepEqual(result.functions.map((fn) => fn.entry), [0x8000, 0x8010]);
  assert.deepEqual(
    result.instructions.map((instruction) => [instruction.address, instruction.mnemonic]),
    [[0x8000, "in"], [0x8002, "out"], [0x8004, "ld"], [0x8007, "call"], [0x800a, "rst"], [0x800b, "jr"], [0x8010, "ret"], [0x8011, "ret"]],
  );
  assert.deepEqual(
    result.references.map((reference) => [reference.from, reference.to, reference.type]),
    [[0x8004, 0x9000, "read"], [0x8007, 0x8010, "call"], [0x800a, 0x0010, "call"], [0x800b, 0x8000, "jump"], [0x8010, 0x8011, "jump"]],
  );
});
