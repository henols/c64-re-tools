import assert from "node:assert/strict";
import { test } from "node:test";

import { WireFailure } from "../../protocol/messages.ts";
import { writeSna, writeZ80, type SpectrumSnapshot } from "../../spectrum.ts";
import { checkMedia } from "./media.ts";

const snapshot = (model: "48k" | "128k"): SpectrumSnapshot => ({
  model,
  registers: { pc: 0x8000, sp: 0xff00, af: 0, bc: 0, de: 0, hl: 0, ix: 0, iy: 0x5c3a, af2: 0, bc2: 0, de2: 0, hl2: 0, i: 0x3f, r: 0, im: 1, iff1: false, iff2: false },
  border: 1,
  port7ffd: model === "128k" ? 0x10 : 0,
  banks: Array.from({ length: 8 }, () => new Uint8Array(0x4000)),
  ...(model === "128k" ? { ay: { registers: Array.from({ length: 16 }, (_, index) => index), selected: 7 } } : {}),
});
/** The first bytes of a PNG file. */
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array<number>(0xc100).fill(0x41)]);
const refused = (type: "tap" | "tzx" | "z80" | "sna" | "zsf", bytes: Uint8Array, form: RegExp) =>
  assert.throws(() => checkMedia(type, bytes), (error) => error instanceof WireFailure && error.code === "invalid-input" && form.test(error.message) && /agree with its extension/.test(error.message));

test("a file whose contents are not of its extension is refused before the load", () => {
  refused("z80", PNG, /^The file is not a \.z80 snapshot: /);
  refused("sna", PNG, /^The file is not a \.sna snapshot: /);
  refused("tzx", PNG, /^The file is not a TZX tape: /);
  refused("zsf", PNG, /^The file is not a ZEsarUX \.zsf snapshot: /);
  refused("tap", PNG, /^The file is not a TAP tape: /);
  refused("tap", new Uint8Array(0), /no block/);
  // A version 1 .z80 is 48 KiB of RAM, or a compressed block with its end mark.
  const v1 = new Uint8Array(30 + 0xc000);
  v1[6] = 0x00;
  v1[7] = 0x80;
  assert.equal(checkMedia("z80", v1).bytes, v1);
  refused("z80", Uint8Array.from([...v1, 0]), /49182 bytes/);
});

test("a .z80 and a .sna give the border of their header", () => {
  assert.equal(checkMedia("z80", writeZ80(snapshot("48k"))).border, 1);
  assert.equal(checkMedia("sna", writeSna(snapshot("128k"))).border, 1);
  assert.equal(checkMedia("tap", Uint8Array.from([2, 0, 0xff, 0xff])).border, undefined);
});

test("a 128K .z80 goes to ZEsarUX with the AY in use, so that ZEsarUX loads its AY registers; a 48K .z80 stays as it is", () => {
  const file = writeZ80(snapshot("128k"));
  assert.equal(file[37]! & 4, 0);
  const checked = checkMedia("z80", file);
  assert.equal(checked.bytes[37]! & 4, 4);
  assert.deepEqual([...checked.bytes.subarray(38, 55)], [7, ...Array.from({ length: 16 }, (_, index) => index)]);
  assert.equal(file[37]! & 4, 0, "the file of the user does not change");
  const file48 = writeZ80(snapshot("48k"));
  assert.equal(checkMedia("z80", file48).bytes, file48);
});
