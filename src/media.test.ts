import assert from "node:assert/strict";
import { test } from "node:test";

import { checkMedia, hasSignature } from "./media.ts";

const crt = (body: Buffer) => {
  const header = Buffer.alloc(0x40);
  header.write("C64 CARTRIDGE   ", 0, "latin1");
  header.writeUInt32BE(0x40, 0x10);
  return Buffer.concat([header, body]);
};

test("a CRT needs its signature, a full header and a CHIP packet", () => {
  const chip = Buffer.alloc(0x10);
  chip.write("CHIP", 0, "latin1");
  checkMedia("crt", crt(chip));
  assert.throws(() => checkMedia("crt", Buffer.from("C64 CARTRIDGE   ")), /header is shorter than 64 bytes/);
  assert.throws(() => checkMedia("crt", crt(Buffer.alloc(104))), /no CHIP packet/);
  assert.throws(() => checkMedia("crt", Buffer.alloc(100, 0x55)), /does not start with "C64 CARTRIDGE"/);
});

test("a disk image needs a size that the emulator reads, and a PRG has no check", () => {
  checkMedia("d64", Buffer.alloc(174848));
  assert.throws(() => checkMedia("d64", Buffer.alloc(100)), (error: Error & { code?: string }) => error.code === "media-error" && /has 100 bytes/.test(error.message));
  checkMedia("prg", Buffer.from([0x01, 0x08]));
  assert.equal(hasSignature("t64", Buffer.from("C64S tape image file")), true);
  assert.equal(hasSignature("prg", Buffer.alloc(0)), true, "a type with no signature");
});
