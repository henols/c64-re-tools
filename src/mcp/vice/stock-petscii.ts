#!/usr/bin/env node
// stock-petscii.ts
//
// THE one ASCII<->PETSCII conversion in this tree. No such table exists
// anywhere else in this codebase or its skills -- the custom fork did this
// conversion server-side in C (docs/03-RESEARCH.md's own grep confirmed
// zero hits). stock-input.ts's handleKeyboardType() is the only production
// call site; nothing else may hand-roll a second version.
//
// WHY THIS FILE EXISTS: KEYBOARD_FEED (0x72) only accepts PETSCII bytes on
// the wire, but the `vice_keyboard_type` tool's `text` argument is an
// ordinary ASCII/JS string. Something has to sit between the two, and it
// has to get the case-swap and control-code boundaries exactly right --
// PETSCII's unshifted/shifted case-swap region is a frequent source of
// off-by-one and reversed-case bugs when hand-transcribed (03-RESEARCH.md
// Pitfall 3), because the letter ranges "look like" a uniform 0x20 XOR but
// the boundary and control regions do not follow that rule. The mapping
// below matches VICE's own charset_p_topetscii() case-swap behaviour.
//
// WHAT NOT TO DO:
//   - Never write a second inline ASCII->PETSCII conversion at a call site.
//     Five inconsistent hand-rolled versions scattered across handlers is
//     exactly the failure mode this module exists to prevent -- import
//     asciiToPetscii() instead.
//   - Never pass an unmapped byte through silently. A raw PETSCII control
//     code such as 0x93 (clear screen) landing in an LLM-supplied string
//     would silently corrupt the debugged program's display the moment it
//     reaches the keyboard buffer. Every byte this table does not
//     explicitly map is refused, naming the offending index and hex code --
//     never truncated, never passed through, never silently dropped.
//   - Never assume the letter ranges are a uniform 0x20 XOR. The boundary
//     bytes (0x40/0x41, 0x5a/0x5b, 0x60/0x61, 0x7a/0x7b) and the control-code
//     regions do not follow that rule uniformly; each range below is
//     checked explicitly, not derived from a single arithmetic shortcut.
import { ViceError } from "./vice.ts";

/** PETSCII's Return code. Both ASCII LF (`\n`) and CR (`\r`) map here -- this
 * is what the fork's own "Use \n for Return" tool description promises. */
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
  /** Default true: uppercase ASCII (`A`-`Z`) displays as uppercase on the
   * C64 -- the fork's own petscii_upper default-true semantic. Setting this
   * false is a deliberate pass-through of the raw ASCII byte for both case
   * ranges, mirroring the fork's "raw PETSCII (uppercase ASCII maps to
   * graphics)" documented behaviour. The case-swap this option performs
   * when true is exactly what makes uppercase ASCII display as uppercase in
   * both the unshifted and mixed-case C64 charsets. */
  upper?: boolean;
}

/**
 * Converts one input byte (already narrowed to 0x00-0xff by the caller) to
 * its PETSCII equivalent, or throws a StockPetsciiError naming `index` if
 * the byte has no mapping. Matches VICE's own charset_p_topetscii() case-
 * swap rule, byte range by byte range -- never a single 0x20 XOR shortcut.
 */
function convertByte(byte: number, index: number, upper: boolean): number {
  if (byte === 0x0a || byte === 0x0d) {
    return PETSCII_RETURN;
  }
  if (byte >= 0x20 && byte <= 0x40) {
    return byte;
  }
  if (byte >= 0x41 && byte <= 0x5a) {
    return upper ? (byte | 0x80) : byte;
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
