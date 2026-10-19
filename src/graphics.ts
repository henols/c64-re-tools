// Indexed images: the PNG encoder of emulator frames, and the C64 graphics
// in memory as images for the documentation. A region of the knowledge
// gives no display mode and no colours, so a sprite, a bitmap or a charset is read
// both in hires and in multicolour, with fixed pattern palettes.

import { crc32, deflateSync } from "node:zlib";

import { Refusal } from "./errors.ts";

export interface IndexedFrame {
  width: number;
  height: number;
  /** One palette index per pixel, row by row. */
  pixels: Uint8Array;
}

export type Rgb = readonly [number, number, number];

function chunk(type: string, data: Uint8Array): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

/** Encodes an indexed frame as an 8-bit palette PNG. */
export function encodePng(frame: IndexedFrame, palette: ReadonlyArray<Rgb>): Buffer {
  for (const index of frame.pixels) {
    if (index >= palette.length) throw new Refusal("operation-failed", `pixel colour ${index} is not in the ${palette.length}-colour palette`);
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

export type GraphicsMode = "hires" | "multicolour";

/** The ZX Spectrum palette: colours 0-7 normal, 8-15 bright (bright black is black). */
export const SPECTRUM_PALETTE: readonly Rgb[] = [
  [0x00, 0x00, 0x00], [0x00, 0x00, 0xd7], [0xd7, 0x00, 0x00], [0xd7, 0x00, 0xd7], [0x00, 0xd7, 0x00], [0x00, 0xd7, 0xd7], [0xd7, 0xd7, 0x00], [0xd7, 0xd7, 0xd7],
  [0x00, 0x00, 0x00], [0x00, 0x00, 0xff], [0xff, 0x00, 0x00], [0xff, 0x00, 0xff], [0x00, 0xff, 0x00], [0x00, 0xff, 0xff], [0xff, 0xff, 0x00], [0xff, 0xff, 0xff],
];

/** The border around the 256 x 192 Spectrum picture in a frame, in pixels on each side. */
export const SPECTRUM_BORDER = 32;

/**
 * The Spectrum screen as a frame: the 6144 bitmap bytes and the 768 attribute
 * bytes of a screen bank ($4000-$5aff), with the border colour around them.
 * The bitmap is in thirds: the address of row y is 010T TSSS LLLC CCCC, with
 * the third in T, the pixel row of the character in S and the character row
 * in L. An attribute byte gives FLASH, BRIGHT, PAPER and INK of one 8 x 8 cell.
 * With `flashInverted`, a FLASH cell swaps ink and paper.
 */
export function spectrumScreenFrame(screen: Uint8Array, border: number, flashInverted = false): IndexedFrame {
  const width = 256 + 2 * SPECTRUM_BORDER;
  const height = 192 + 2 * SPECTRUM_BORDER;
  const pixels = new Uint8Array(width * height).fill(border & 7);
  for (let y = 0; y < 192; y++) {
    const row = ((y & 0xc0) << 5) | ((y & 0x07) << 8) | ((y & 0x38) << 2);
    for (let column = 0; column < 32; column++) {
      const bits = screen[row | column]!;
      const attribute = screen[0x1800 + (y >> 3) * 32 + column]!;
      const bright = (attribute & 0x40) !== 0 ? 8 : 0;
      let ink = (attribute & 0x07) + bright;
      let paper = ((attribute >> 3) & 0x07) + bright;
      if (flashInverted && (attribute & 0x80) !== 0) [ink, paper] = [paper, ink];
      for (let bit = 0; bit < 8; bit++) pixels[(y + SPECTRUM_BORDER) * width + SPECTRUM_BORDER + column * 8 + bit] = (bits & (0x80 >> bit)) !== 0 ? ink : paper;
    }
  }
  return { width, height, pixels };
}

/**
 * The pattern palettes: the index is the pixel value (hires: the bit; multicolour:
 * the bit pair, 0 = background $d021, 1 = $d022 or screen high nibble, 2 = $d023 or
 * screen low nibble, 3 = colour RAM), and the last index is the gap between sprites.
 */
export const PATTERN_PALETTES: Record<GraphicsMode, readonly Rgb[]> = {
  hires: [
    [0x00, 0x00, 0x00],
    [0xff, 0xff, 0xff],
    [0x35, 0x28, 0x79],
  ],
  multicolour: [
    [0x00, 0x00, 0x00],
    [0xad, 0xad, 0xad],
    [0x6c, 0x6c, 0x6c],
    [0xed, 0xf1, 0x71],
    [0x35, 0x28, 0x79],
  ],
};

/** The pixel values of one byte, left to right: 8 hires pixels, or 4 multicolour pixels of 2 each. */
function bytePixels(byte: number, mode: GraphicsMode): number[] {
  if (mode === "hires") return Array.from({ length: 8 }, (_, bit) => (byte >> (7 - bit)) & 1);
  return Array.from({ length: 8 }, (_, pixel) => (byte >> (6 - 2 * (pixel >> 1))) & 3);
}

export const SPRITE = { width: 24, height: 21, bytes: 63 } as const;

/**
 * The sprites of `bytes` as one sheet, `perRow` sprites wide with a gap of one
 * pixel. Each sprite takes `stride` bytes (64 in a VIC bank, 63 when packed).
 */
export function spriteSheet(bytes: Uint8Array, mode: GraphicsMode, stride = 64, perRow = 8): IndexedFrame {
  const count = Math.max(1, Math.floor((bytes.length + stride - SPRITE.bytes) / stride));
  const columns = Math.min(count, perRow);
  const rows = Math.ceil(count / perRow);
  const width = columns * (SPRITE.width + 1) + 1;
  const height = rows * (SPRITE.height + 1) + 1;
  const gap = PATTERN_PALETTES[mode].length - 1;
  const pixels = new Uint8Array(width * height).fill(gap);
  for (let sprite = 0; sprite < count; sprite++) {
    const left = (sprite % perRow) * (SPRITE.width + 1) + 1;
    const top = Math.floor(sprite / perRow) * (SPRITE.height + 1) + 1;
    for (let row = 0; row < SPRITE.height; row++) {
      for (let column = 0; column < 3; column++) {
        const values = bytePixels(bytes[sprite * stride + row * 3 + column] ?? 0, mode);
        values.forEach((value, x) => (pixels[(top + row) * width + left + column * 8 + x] = value));
      }
    }
  }
  return { width, height, pixels };
}

/** Cells of 8 bytes as 8x8 pixels, `perRow` cells to a row, cell 0 at the top left. */
function cellFrame(bytes: Uint8Array, mode: GraphicsMode, perRow: number): IndexedFrame {
  const cells = Math.ceil(bytes.length / 8);
  const width = Math.min(cells, perRow) * 8;
  const height = Math.ceil(cells / perRow) * 8;
  const pixels = new Uint8Array(width * height);
  for (let cell = 0; cell < cells; cell++) {
    const left = (cell % perRow) * 8;
    const top = Math.floor(cell / perRow) * 8;
    for (let row = 0; row < 8; row++) {
      bytePixels(bytes[cell * 8 + row] ?? 0, mode).forEach((value, x) => (pixels[(top + row) * width + left + x] = value));
    }
  }
  return { width, height, pixels };
}

/** A bitmap of 8x8 cells of 8 bytes, 40 cells to a row, as the VIC reads it. */
export function bitmapFrame(bytes: Uint8Array, mode: GraphicsMode): IndexedFrame {
  return cellFrame(bytes, mode, 40);
}

/** A character set: characters of 8 bytes, 16 to a row, so character N is in row N / 16 and column N % 16. */
export function charsetFrame(bytes: Uint8Array, mode: GraphicsMode): IndexedFrame {
  return cellFrame(bytes, mode, 16);
}

/** Each pixel as a square of `factor` pixels, so a small image is readable on a page. */
export function scaleFrame(frame: IndexedFrame, factor: number): IndexedFrame {
  const width = frame.width * factor;
  const height = frame.height * factor;
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) pixels[y * width + x] = frame.pixels[Math.floor(y / factor) * frame.width + Math.floor(x / factor)]!;
  }
  return { width, height, pixels };
}

/**
 * Screen codes as text rows of 40, as the character ROM shows the upper-case
 * set: @, A-Z, the signs and digits; a reversed code (bit 7) shows as its
 * code without bit 7, and a graphics code as a dot.
 */
export function screenText(bytes: Uint8Array): string[] {
  const rows: string[] = [];
  for (let start = 0; start < bytes.length; start += 40) {
    let row = "";
    for (const code of bytes.subarray(start, start + 40)) {
      const plain = code & 0x7f;
      row += plain === 0 ? "@" : plain <= 26 ? String.fromCharCode(0x40 + plain) : plain <= 31 ? "[£]^<"[plain - 27]! : plain <= 63 ? String.fromCharCode(plain) : ".";
    }
    rows.push(row);
  }
  return rows;
}
