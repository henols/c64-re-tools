#!/usr/bin/env node
// address.ts
//
// WHY THIS FILE EXISTS: the release registry stores addresses in several
// forms ("$08B1", "0x8b1", decimal strings, numbers). The ram-capture and
// provenance skills both read those fields, so the one parser and the one
// `$XXXX` formatter live here, in the shared project skill, instead of in
// either consumer.
//
// WHAT NOT TO DO:
//   - Never return NaN or a guessed value for an unparseable address. Throw,
//     naming the input.
//   - Never import anything here. This module is pure.

/** Parse `"$08B1"`, `"0x8b1"`, a decimal string, or a number into an integer
 * address in $0000-$FFFF. Throws, naming the input, on anything else: an
 * empty string, a stray character (`"$C0GG"`), a fraction, or a value
 * outside the 64K address space. */
export function addrNum(a: unknown): number {
  let n: number;
  if (typeof a === "number") {
    n = a;
  } else if (typeof a === "string") {
    const s = a.trim();
    if (/^\$[0-9a-f]+$/i.test(s)) n = parseInt(s.slice(1), 16);
    else if (/^0x[0-9a-f]+$/i.test(s)) n = parseInt(s.slice(2), 16);
    else if (/^[0-9]+$/.test(s)) n = parseInt(s, 10);
    else throw new Error(`addrNum: cannot parse address from "${a}"`);
  } else {
    throw new Error(`addrNum: cannot parse address from ${JSON.stringify(a)}`);
  }
  if (!Number.isInteger(n) || n < 0 || n > 0xffff) {
    throw new Error(`addrNum: address ${JSON.stringify(a)} is outside $0000-$FFFF`);
  }
  return n;
}

/** Format an integer as a canonical `$XXXX` 4-hex-digit address string. */
export function hex4(n: number): string {
  return "$" + (n & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}
