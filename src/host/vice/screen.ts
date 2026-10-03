// Canonical emulator-frame capture: VICE's own rendered VIC-II frame, never a
// desktop screenshot. Baseline storage and comparison come with milestone 3.

import { crc32, deflateSync } from "node:zlib";

import type { VideoStandard } from "../../protocol.ts";

export interface IndexedFrame {
  width: number;
  height: number;
  /** One palette index per pixel, row by row. */
  pixels: Uint8Array;
}

export interface RawDisplay {
  /** Full buffer size, blanking included. */
  bufferWidth: number;
  bufferHeight: number;
  /** Where the 320×200 display window starts, as VICE reports it. */
  innerX: number;
  innerY: number;
  pixels: Uint8Array;
}

/** Decodes a binary-monitor display-get body (8 bits per pixel). The pixels may be short; see visibleFrame. */
export function decodeDisplay(body: Buffer): RawDisplay {
  const headerLength = body.readUInt32LE(0);
  const bits = body[16];
  if (bits !== 8) throw new Error(`VICE sent ${bits} bits per pixel, expected 8`);
  // The buffer length follows the header fields; the pixels follow it.
  const length = body.readUInt32LE(4 + headerLength);
  const start = 4 + headerLength + 4;
  return {
    bufferWidth: body.readUInt16LE(4),
    bufferHeight: body.readUInt16LE(6),
    innerX: body.readUInt16LE(8),
    innerY: body.readUInt16LE(10),
    pixels: body.subarray(start, start + length),
  };
}

/**
 * The visible frame with normal borders, relative to VICE's display-window
 * offsets, as measured on stock VICE 3.10: PAL 384×272, NTSC 384×247.
 */
const VISIBLE: Record<VideoStandard, { dx: number; dy: number; width: number; height: number }> = {
  pal: { dx: -32, dy: -36, width: 384, height: 272 },
  ntsc: { dx: -32, dy: -23, width: 384, height: 247 },
};

/** Crops the visible bordered frame out of VICE's full raster buffer. */
export function visibleFrame(display: RawDisplay, standard: VideoStandard): IndexedFrame {
  const area = VISIBLE[standard];
  const left = display.innerX + area.dx;
  const top = display.innerY + area.dy;
  if (left < 0 || top < 0 || left + area.width > display.bufferWidth || top + area.height > display.bufferHeight) {
    throw new Error(`the ${display.bufferWidth}x${display.bufferHeight} display buffer does not hold the visible ${standard} frame`);
  }
  // Stock VICE 3.10 sends 4 bytes fewer than its length field says; they are
  // the last ones, in the blanking area, so only the cropped area must be present.
  if (display.pixels.length < (top + area.height - 1) * display.bufferWidth + left + area.width) {
    throw new Error("the display buffer is short");
  }
  const pixels = new Uint8Array(area.width * area.height);
  for (let row = 0; row < area.height; row++) {
    const from = (top + row) * display.bufferWidth + left;
    pixels.set(display.pixels.subarray(from, from + area.width), row * area.width);
  }
  return { width: area.width, height: area.height, pixels };
}

/** Decodes a binary-monitor palette-get body into RGB triples. */
export function decodePalette(body: Buffer): Array<[number, number, number]> {
  const count = body.readUInt16LE(0);
  const colours: Array<[number, number, number]> = [];
  let offset = 2;
  for (let index = 0; index < count; index++) {
    const size = body[offset]!;
    colours.push([body[offset + 1]!, body[offset + 2]!, body[offset + 3]!]);
    offset += size + 1;
  }
  return colours;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

/** Encodes an indexed frame as an 8-bit palette PNG. */
export function encodePng(frame: IndexedFrame, palette: ReadonlyArray<readonly [number, number, number]>): Buffer {
  for (const index of frame.pixels) {
    if (index >= palette.length) throw new Error(`pixel colour ${index} is not in the ${palette.length}-colour palette`);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(frame.width, 0);
  header.writeUInt32BE(frame.height, 4);
  header[8] = 8; // bit depth
  header[9] = 3; // indexed colour
  const rows = Buffer.alloc((frame.width + 1) * frame.height);
  for (let row = 0; row < frame.height; row++) {
    // Filter byte 0 (none), then the row.
    rows.set(frame.pixels.subarray(row * frame.width, (row + 1) * frame.width), row * (frame.width + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("PLTE", Buffer.from(palette.flat())),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", new Uint8Array(0)),
  ]);
}
