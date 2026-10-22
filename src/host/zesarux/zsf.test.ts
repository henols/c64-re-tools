import assert from "node:assert/strict";
import { test } from "node:test";

import { zsfHalted, zsfOnHaltInstruction } from "./zsf.ts";

/** A .zsf as ZEsarUX 13.0 writes it: the magic, the machine block, the Z80 registers (PC $8024) and the HALT block. */
function zsf(halted: boolean): Uint8Array {
  const block = (id: number, data: number[]) => [id & 0xff, id >> 8, data.length & 0xff, (data.length >> 8) & 0xff, 0, 0, ...data];
  // BC DE HL, F A, IX IY, BC' DE' HL' AF', R, I, SP, PC, the flip-flops.
  const registers = [0xfe, 0x7f, 0, 0, 0x02, 0x90, 0x08, 0x01, 0, 0, 0x3a, 0x5c, 0, 0, 0, 0, 0, 0, 0, 0, 0x2a, 0x00, 0xf0, 0x8f, 0x24, 0x80, 0x01];
  return Uint8Array.from([...Buffer.from("ZSF ZEsarUX Snapshot File.", "latin1"), ...block(1, [1]), ...block(2, registers), ...block(43, [halted ? 1 : 0]), ...block(8, [7])]);
}

test("the HALT block of a .zsf tells whether the CPU waited in a HALT", () => {
  assert.equal(zsfHalted(zsf(true)), true);
  assert.equal(zsfHalted(zsf(false)), false);
  assert.throws(() => zsfHalted(Uint8Array.from([1, 2, 3])), /not a ZEsarUX snapshot file/);
});

test("a halted .zsf becomes one that is not halted, with the PC on the HALT instruction", () => {
  const file = zsf(true);
  const patched = zsfOnHaltInstruction(file);
  assert.equal(zsfHalted(patched), false);
  const pc = (bytes: Uint8Array) => {
    const at = 26 + 7 + 6 + 24;
    return bytes[at]! | (bytes[at + 1]! << 8);
  };
  assert.equal(pc(file), 0x8024);
  assert.equal(pc(patched), 0x8023);
  assert.equal(zsfHalted(file), true, "the input stays unchanged");
  assert.deepEqual(zsfOnHaltInstruction(zsf(false)), zsf(false));
});
