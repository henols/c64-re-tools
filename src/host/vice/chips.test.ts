import assert from "node:assert/strict";
import { test } from "node:test";

import { vicBankBase } from "../../c64.ts";
import { decodeCia, decodeSid, decodeSprite, decodeVicii, viciiMode } from "./chips.ts";

test("the VIC-II bank comes from CIA 2 port A, inverted, with undriven lines high", () => {
  assert.equal(vicBankBase(0x97, 0x3f), 0x0000); // KERNAL default: lines %11 -> bank 0
  assert.equal(vicBankBase(0x96, 0x3f), 0x4000);
  assert.equal(vicBankBase(0x94, 0x3f), 0xc000);
  assert.equal(vicBankBase(0x00, 0x00), 0x0000, "no driven lines read high");
});

test("display modes follow ECM, BMM and MCM", () => {
  assert.equal(viciiMode(0x1b, 0xc8), "text");
  assert.equal(viciiMode(0x1b, 0xd8), "multicolor-text");
  assert.equal(viciiMode(0x5b, 0xc8), "extended-color-text");
  assert.equal(viciiMode(0x3b, 0xc8), "bitmap");
  assert.equal(viciiMode(0x3b, 0xd8), "multicolor-bitmap");
  assert.equal(viciiMode(0x7b, 0xc8), "invalid");
  assert.equal(viciiMode(0x5b, 0xd8), "invalid");
});

function vic(values: Record<number, number>): Uint8Array {
  const registers = new Uint8Array(0x2f);
  for (const [register, value] of Object.entries(values)) registers[Number(register)] = value;
  return registers;
}

test("the VIC-II state decodes from its registers", () => {
  const cia2 = Uint8Array.from([0x95, 0, 0x3f, ...new Array(13).fill(0)]); // bank 2: $8000
  const state = decodeVicii(vic({ 0x11: 0x9b, 0x12: 0x2c, 0x16: 0xcd, 0x18: 0x14, 0x20: 0xfe, 0x21: 0xf6, 0x22: 0x01, 0x23: 0x02, 0x24: 0x03 }), cia2);
  assert.deepEqual(state, {
    rasterLine: 0x12c,
    mode: "text",
    screenAddress: 0x8400,
    graphicsAddress: 0x9000,
    scrollX: 5,
    scrollY: 3,
    borderColor: 14,
    backgroundColors: [6, 1, 2, 3],
  });
  // In bitmap mode the graphics address is the bitmap base: bit 3 of $d018.
  assert.equal(decodeVicii(vic({ 0x11: 0x3b, 0x18: 0x18 }), cia2).graphicsAddress, 0xa000);
});

test("a sprite decodes position, flags, colour and data address", () => {
  const cia2 = Uint8Array.from([0x97, 0, 0x3f, ...new Array(13).fill(0)]);
  const registers = vic({ 0x02: 0x91, 0x03: 0x60, 0x10: 0x02, 0x15: 0x02, 0x17: 0x02, 0x1b: 0x00, 0x1c: 0x02, 0x1d: 0x00, 0x28: 0xf1 });
  const pointers = Uint8Array.from([0, 0xc0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(decodeSprite(1, registers, cia2, pointers), {
    index: 1,
    x: 0x191,
    y: 0x60,
    enabled: true,
    color: 1,
    multicolor: true,
    expandX: false,
    expandY: true,
    behindBackground: false,
    dataAddress: 0x3000,
  });
});

test("a CIA decodes ports, timers and its BCD time of day", () => {
  const registers = Uint8Array.from([0x7f, 0xff, 0xff, 0x00, 0x25, 0x40, 0xff, 0xff, 0x07, 0x56, 0x34, 0x92, 0, 0x81, 0x11, 0x08]);
  assert.deepEqual(decodeCia(1, registers), {
    id: 1,
    portA: 0x7f,
    portB: 0xff,
    ddrA: 0xff,
    ddrB: 0x00,
    timerA: 0x4025,
    timerB: 0xffff,
    controlA: 0x11,
    controlB: 0x08,
    interruptStatus: 0x81,
    tod: { hours: 12, minutes: 34, seconds: 56, tenths: 7 },
  });
  // $92 above is 12 PM (noon). 12 AM is hour 0 and 1 PM is hour 13.
  registers[0x0b] = 0x12;
  assert.equal(decodeCia(1, registers).tod.hours, 0);
  registers[0x0b] = 0x81;
  assert.equal(decodeCia(1, registers).tod.hours, 13);
});

test("the SID decodes voices, filter and volume from its registers", () => {
  const registers = Uint8Array.from([0x0b, 0x30, 0x55, 0x7a, 0x9f, 0xc4, 0xe9, ...new Array(14).fill(0), 0x04, 0x39, 0x5e, 0x83]);
  const state = decodeSid(registers);
  assert.deepEqual(state.voices[0], { index: 1, frequency: 0x300b, pulseWidth: 0x0a55, control: 0x9f, attackDecay: 0xc4, sustainRelease: 0xe9 });
  assert.deepEqual(state.filter, { cutoff: 0x1cc, resonance: 5, routing: 14, mode: 8 });
  assert.equal(state.volume, 3);
});
