// A minimal PNG reader for tests: checks chunk CRCs and returns size, palette
// and pixel indexes of an 8-bit indexed PNG.

import assert from "node:assert/strict";
import { crc32, inflateSync } from "node:zlib";

import type { IndexedFrame } from "./screen.ts";

export function readPng(png: Buffer): IndexedFrame & { palette: number[][] } {
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  let offset = 8;
  let width = 0;
  let height = 0;
  let palette: number[][] = [];
  const data: Buffer[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("latin1", offset + 4, offset + 8);
    const body = png.subarray(offset + 8, offset + 8 + length);
    assert.equal(png.readUInt32BE(offset + 8 + length), crc32(png.subarray(offset + 4, offset + 8 + length)), `${type} CRC`);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      assert.equal(body[8], 8);
      assert.equal(body[9], 3);
    } else if (type === "PLTE") {
      palette = [];
      for (let at = 0; at < body.length; at += 3) palette.push([body[at]!, body[at + 1]!, body[at + 2]!]);
    } else if (type === "IDAT") data.push(body);
    offset += 12 + length;
  }
  const rows = inflateSync(Buffer.concat(data));
  const pixels = new Uint8Array(width * height);
  for (let row = 0; row < height; row++) {
    assert.equal(rows[row * (width + 1)], 0, "filter type");
    pixels.set(rows.subarray(row * (width + 1) + 1, (row + 1) * (width + 1)), row * width);
  }
  return { width, height, pixels, palette };
}

