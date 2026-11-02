import assert from "node:assert/strict";
import { test } from "node:test";
import { displayBody } from "./monitor-wire.testkit.ts";
import { compareFrames, decodeDisplay, decodePalette, differenceImage, visibleFrame } from "./screen.ts";

test("the visible PAL frame is the 384x272 bordered area of VICE's raster buffer", () => {
  // As VICE sends it: a 504x312 buffer, window at (136,51), border pixels from (104,15).
  const body = displayBody(504, 312, 136, 51, (x, y) => (x >= 104 && x < 488 && y >= 15 && y < 287 ? 14 : 0));
  const frame = visibleFrame(decodeDisplay(body), "pal");
  assert.equal(frame.width, 384);
  assert.equal(frame.height, 272);
  assert.ok(frame.pixels.every((pixel) => pixel === 14), "only border-coloured pixels, no blanking");
});

test("the visible NTSC frame is 384x247", () => {
  const body = displayBody(520, 263, 136, 31, (x, y) => (x >= 104 && x < 488 && y >= 8 && y < 255 ? 6 : 0));
  const frame = visibleFrame(decodeDisplay(body), "ntsc");
  assert.equal(frame.height, 247);
  assert.ok(frame.pixels.every((pixel) => pixel === 6));
});

test("a buffer too small for the visible frame is refused", () => {
  assert.throws(() => visibleFrame(decodeDisplay(displayBody(320, 200, 0, 0, () => 0)), "pal"), /does not hold/);
});

test("the palette decodes to RGB triples", () => {
  assert.deepEqual(decodePalette(Buffer.from([2, 0, 3, 0, 0, 0, 3, 0xff, 0xff, 0xff])), [
    [0, 0, 0],
    [255, 255, 255],
  ]);
});

test("a display buffer a few bytes short at its end still yields the frame", () => {
  const body = displayBody(504, 312, 136, 51, () => 14);
  const frame = visibleFrame(decodeDisplay(body.subarray(0, body.length - 4)), "pal");
  assert.equal(frame.pixels.length, 384 * 272);
});

test("frames compare pixel by pixel outside the mask, with the bounds of the mismatches", () => {
  const baseline = { width: 4, height: 3, pixels: Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) };
  const current = { width: 4, height: 3, pixels: Uint8Array.from([0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 5]) };
  const all = compareFrames(baseline, current, []);
  assert.equal(all.mismatchingPixels, 3);
  assert.equal(all.comparedPixels, 12);
  assert.deepEqual(all.bounds, { x: 1, y: 0, width: 3, height: 3 });
  // Masking the bottom-right pixel leaves two mismatches in a smaller box.
  const masked = compareFrames(baseline, current, [{ x: 3, y: 2, width: 5, height: 5 }]);
  assert.equal(masked.mismatchingPixels, 2);
  assert.equal(masked.comparedPixels, 11);
  assert.deepEqual(masked.bounds, { x: 1, y: 0, width: 2, height: 2 });
  assert.equal(compareFrames(baseline, baseline, []).bounds, undefined);
  assert.throws(() => compareFrames(baseline, { width: 3, height: 4, pixels: new Uint8Array(12) }, []), /sizes differ/);
});

test("the difference image dims equal pixels and marks mismatches", () => {
  const current = { width: 2, height: 1, pixels: Uint8Array.from([1, 1]) };
  const difference = compareFrames({ width: 2, height: 1, pixels: Uint8Array.from([1, 0]) }, current, []);
  const image = differenceImage(current, difference, [
    [0, 0, 0],
    [200, 100, 40],
  ]);
  assert.deepEqual([...image.frame.pixels], [1, 2]);
  assert.deepEqual(image.palette, [
    [0, 0, 0],
    [50, 25, 10],
    [255, 0, 255],
  ]);
});
