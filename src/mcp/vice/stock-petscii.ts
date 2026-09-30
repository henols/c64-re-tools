#!/usr/bin/env node
// stock-petscii.ts
//
// The one ASCII->PETSCII conversion in this tree. stock-input.ts's
// handleKeyboardType() is the only production call site.
//
// WHY THIS FILE EXISTS: KEYBOARD_FEED (0x72) only accepts PETSCII bytes on
// the wire, but the `vice_keyboard_type` tool's `text` argument is an
// ordinary ASCII/JS string. This module converts between the two.
//
// The default mapping targets the power-on upper/graphics charset: the
// unshifted PETSCII letters $41-$5A show as capitals there, and BASIC reads
// them as keywords. So both ASCII `A`-`Z` and ASCII `a`-`z` map to $41-$5A.
// With `upper: false` every mapped byte passes through unchanged.
//
// WHAT NOT TO DO:
//   - Never write a second inline ASCII->PETSCII conversion at a call site.
//     Import asciiToPetscii() instead.
//   - Never pass an unmapped byte through silently. A raw PETSCII control
//     code such as 0x93 (clear screen) in an agent-supplied string would
//     change the debugged program's display. Every byte this table does not
//     map is refused, naming the offending index and hex code.
import { ViceError } from "./vice-errors.mts";

/** PETSCII's Return code. Both ASCII LF (`\n`) and CR (`\r`) map here. */
export const PETSCII_RETURN = 0x0d;

export interface StockPetsciiErrorOptions {
  index?: number;
}

/**
 * Raised by asciiToPetscii() for any input that cannot be safely converted:
 * a non-string, an empty string, a converted length over 255 bytes, a code
 * unit above 0xff, or a byte this table does not map. Always thrown before
 * any bytes are written to the caller-visible Buffer.
 */
export class StockPetsciiError extends ViceError {
  index?: number;

  constructor(message: string, { index }: StockPetsciiErrorOptions = {}) {
    super(message);
    this.name = "StockPetsciiError";
    this.index = index;
  }
}

export interface AsciiToPetsciiOptions {
  /** Default true: map ASCII `A`-`Z` and `a`-`z` to the unshifted PETSCII
   * letters $41-$5A, which show as capitals in the power-on upper/graphics
   * charset and which BASIC reads as keywords. False: send each mapped
   * ASCII byte unchanged (ASCII `a`-`z` then lands on $61-$7A, which shows
   * as graphics in the power-on charset). */
  upper?: boolean;
}

/**
 * Converts one input byte (already narrowed to 0x00-0xff by the caller) to
 * its PETSCII equivalent, or throws a StockPetsciiError naming `index` if
 * the byte has no mapping.
 */
function convertByte(byte: number, index: number, upper: boolean): number {
  if (byte === 0x0a || byte === 0x0d) {
    return PETSCII_RETURN;
  }
  if (byte >= 0x20 && byte <= 0x40) {
    return byte;
  }
  if (byte >= 0x41 && byte <= 0x5a) {
    return byte;
  }
  if (byte >= 0x5b && byte <= 0x60) {
    return byte;
  }
  if (byte >= 0x61 && byte <= 0x7a) {
    return upper ? byte - 0x20 : byte;
  }
  if (byte >= 0x7b && byte <= 0x7e) {
    return byte;
  }
  throw new StockPetsciiError(
    `asciiToPetscii: character at index ${index} (0x${byte.toString(16).padStart(2, "0")}) has no PETSCII mapping -- ` +
      `PETSCII control codes (e.g. 0x93 clear-screen) and other unmapped bytes must be sent explicitly via ` +
      `vice_keyboard_petscii, never through vice_keyboard_type`,
    { index },
  );
}

/**
 * Converts an ASCII/Latin-1 JS string to PETSCII bytes for KEYBOARD_FEED
 * (0x72). Refuses (never silently truncates or passes through):
 *   - a non-string input
 *   - an empty string
 *   - a converted length over 255 bytes (KEYBOARD_FEED's textLen field is a
 *     uint8) -- since this mapping is 1:1, the converted length always
 *     equals `text.length`, so this is checked up front
 *   - any code unit above 0xff (a non-Latin-1 character) -- never a lossy
 *     `charCodeAt() & 0xff`
 *   - any byte convertByte() does not map (PETSCII control codes, the
 *     0x00-0x1f/0x7f gaps, and every byte >= 0x80 not otherwise handled)
 */
export function asciiToPetscii(text: string, { upper = true }: AsciiToPetsciiOptions = {}): Buffer {
  if (typeof text !== "string") {
    throw new StockPetsciiError(`asciiToPetscii: text must be a string, got ${typeof text}`);
  }
  if (text.length === 0) {
    throw new StockPetsciiError("asciiToPetscii: text must not be empty");
  }
  if (text.length > 255) {
    throw new StockPetsciiError(
      `asciiToPetscii: converted text exceeds 255 bytes (${text.length}) -- KEYBOARD_FEED's textLen field is a uint8`,
    );
  }
  const out = Buffer.alloc(text.length);
  for (let index = 0; index < text.length; index++) {
    const codeUnit = text.charCodeAt(index);
    if (codeUnit > 0xff) {
      throw new StockPetsciiError(
        `asciiToPetscii: character at index ${index} (code point 0x${codeUnit.toString(16)}) is not a Latin-1 byte -- ` +
          `PETSCII conversion only accepts code points 0x00-0xff`,
        { index },
      );
    }
    out[index] = convertByte(codeUnit, index, upper);
  }
  return out;
}
