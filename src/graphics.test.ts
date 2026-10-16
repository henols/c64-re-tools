import assert from "node:assert/strict";
import { test } from "node:test";

import { bitmapFrame, charsetFrame, encodePng, PATTERN_PALETTES, scaleFrame, screenText, SPRITE, spriteSheet } from "./graphics.ts";
import { readPng } from "./graphics.testkit.ts";

test("a PNG round-trips size, palette and every pixel", () => {
  const frame = { width: 3, height: 2, pixels: Uint8Array.from([0, 1, 2, 2, 1, 0]) };
  const palette = [
    [0, 0, 0],
    [255, 255, 255],
    [136, 0, 0],
  ] as const;
  const decoded = readPng(encodePng(frame, palette));
  assert.equal(decoded.width, 3);
  assert.equal(decoded.height, 2);
  assert.deepEqual([...decoded.pixels], [0, 1, 2, 2, 1, 0]);
  assert.deepEqual(decoded.palette, palette);
  assert.throws(() => encodePng({ width: 1, height: 1, pixels: Uint8Array.from([3]) }, palette), /not in the/);
});

test("sprites are 24x21 cells of a sheet with a gap of one pixel, in hires and in multicolour", () => {
  const bytes = new Uint8Array(128);
  bytes[0] = 0b1000_0001; // sprite 0, row 0: the first and the eighth pixel
  bytes[64 + 3] = 0b0110_1100; // sprite 1, row 1: bit pairs 01 10 11 00
  const hires = spriteSheet(bytes, "hires");
  assert.deepEqual([hires.width, hires.height], [2 * (SPRITE.width + 1) + 1, SPRITE.height + 2]);
  const gap = PATTERN_PALETTES.hires.length - 1;
  assert.equal(hires.pixels[0], gap);
  const at = (frame: typeof hires, sprite: number, x: number, y: number) => frame.pixels[(1 + y) * frame.width + 1 + sprite * (SPRITE.width + 1) + x];
  assert.deepEqual([0, 1, 7].map((x) => at(hires, 0, x, 0)), [1, 0, 1]);
  const multicolour = spriteSheet(bytes, "multicolour");
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map((x) => at(multicolour, 1, x, 1)), [1, 1, 2, 2, 3, 3, 0, 0]);
  // A packed sheet of 63 bytes a sprite: two sprites in 126 bytes.
  assert.equal(spriteSheet(new Uint8Array(126), "hires", 63).width, 2 * (SPRITE.width + 1) + 1);
});

test("a bitmap is read as 8x8 cells, 40 to a row", () => {
  const bytes = new Uint8Array(41 * 8);
  bytes[40 * 8 + 7] = 0xff; // cell 40 is the first cell of the second row; its last pixel row is set
  const frame = bitmapFrame(bytes, "hires");
  assert.deepEqual([frame.width, frame.height], [320, 16]);
  assert.equal(frame.pixels[15 * 320], 1);
  assert.equal(frame.pixels[14 * 320], 0);
  const big = scaleFrame({ width: 2, height: 1, pixels: Uint8Array.from([0, 1]) }, 2);
  assert.deepEqual([big.width, big.height, ...big.pixels], [4, 2, 0, 0, 1, 1, 0, 0, 1, 1]);
});

test("a charset is read as characters of 8x8, 16 to a row", () => {
  const bytes = new Uint8Array(256 * 8);
  bytes[17 * 8] = 0x80; // character 17: row 1, column 1, its top left pixel
  bytes[255 * 8 + 7] = 0b11; // character 255: its bottom right pixel pair
  const hires = charsetFrame(bytes, "hires");
  assert.deepEqual([hires.width, hires.height], [128, 128]);
  assert.equal(hires.pixels[8 * 128 + 8], 1);
  assert.equal(hires.pixels.reduce((sum, value) => sum + value, 0), 3);
  const multicolour = charsetFrame(bytes, "multicolour");
  assert.equal(multicolour.pixels[8 * 128 + 8], 2);
  assert.equal(multicolour.pixels[127 * 128 + 126], 3);
  assert.equal(multicolour.pixels[127 * 128 + 127], 3);
  assert.deepEqual([charsetFrame(new Uint8Array(24), "hires").width, charsetFrame(new Uint8Array(24), "hires").height], [24, 8]);
});

test("screen codes show as the upper-case set, rows of 40", () => {
  const bytes = new Uint8Array(41).fill(0x20);
  bytes.set([0x08, 0x09, 0x21, 0x00, 0x81, 0x70], 0);
  assert.deepEqual(screenText(bytes), [`HI!@A.${" ".repeat(34)}`, " "]);
});
