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

/** Parse `"$08B1"`, `"0x8b1"`, a decimal string, or a number into an integer. */
export function addrNum(a: unknown): number {
  if (typeof a === "number") return a;
  if (typeof a === "string") {
    const s = a.trim();
    if (s.startsWith("$")) return parseInt(s.slice(1), 16);
    if (/^0x/i.test(s)) return parseInt(s, 16);
    const n = Number(s);
    if (Number.isNaN(n)) throw new Error(`addrNum: cannot parse address from "${a}"`);
    return n;
  }
  throw new Error(`addrNum: cannot parse address from ${JSON.stringify(a)}`);
}

/** Format an integer as a canonical `$XXXX` 4-hex-digit address string. */
export function hex4(n: number): string {
  return "$" + (n & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}
