const ADDRESS_PATTERN = /^\$([0-9a-fA-F]{4})$/;

export type C64Address = number & { readonly __c64Address: unique symbol };

export function c64Address(value: number): C64Address {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new RangeError(`C64 address out of range: ${value}`);
  }
  return value as C64Address;
}

export function parseC64Address(value: string): C64Address {
  const match = ADDRESS_PATTERN.exec(value);
  if (match === null) {
    throw new TypeError(`Invalid C64 address: ${value}`);
  }
  return c64Address(Number.parseInt(match[1]!, 16));
}

export function formatC64Address(value: number): string {
  return `$${c64Address(value).toString(16).padStart(4, "0")}`;
}

/** A byte as $xx. Throws RangeError outside 0-255. */
export function formatC64Byte(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) throw new RangeError(`C64 byte out of range: ${value}`);
  return `$${value.toString(16).padStart(2, "0")}`;
}

/**
 * The memory a PRG loads into: the 2-byte load address, then the body.
 * Throws RangeError for a file shorter than 3 bytes or one that runs past $ffff.
 */
export function prgRange(prg: Uint8Array): { start: number; end: number; body: Uint8Array } {
  if (prg.length < 3) throw new RangeError("A PRG has a 2-byte load address and at least one byte.");
  const start = prg[0]! | (prg[1]! << 8);
  if (start + prg.length - 2 > 0x10000) throw new RangeError("The PRG runs past $ffff.");
  return { start, end: start + prg.length - 3, body: prg.subarray(2) };
}

/** How 6502 code refers to an address. */
export const REFERENCE_KINDS = ["call", "jump", "read", "write", "reference"] as const;
export type ReferenceKind = (typeof REFERENCE_KINDS)[number];

/** A symbol or label name: assembler label syntax, at most 64 characters; a leading dot marks a local label. */
export const SYMBOL_NAME = /^\.?[A-Za-z_][A-Za-z0-9_]{0,63}$/;

/** The VIC-II's 16 KiB bank base, from CIA 2 port A bits 0-1 (inverted); undriven lines read high. */
export function vicBankBase(cia2PortA: number, cia2DdrA = 0xff): number {
  const lines = (cia2PortA | ~cia2DdrA) & 0x03;
  return (3 - lines) * 0x4000;
}

/** The offsets inside the VIC-II bank that $d018 selects. */
export function d018Offsets(d018: number): { screen: number; characters: number; bitmap: number } {
  return { screen: ((d018 >> 4) & 0x0f) * 0x400, characters: ((d018 >> 1) & 0x07) * 0x800, bitmap: (d018 & 0x08) !== 0 ? 0x2000 : 0 };
}

/**
 * Converts text to the PETSCII bytes the C64 keyboard types after a reset
 * (upper case/graphics mode). Letters of either case type the unshifted key,
 * which shows as an upper-case letter. "\n" and "\r\n" type RETURN.
 * Throws RangeError naming the first character that has no key.
 */
export function textToPetscii(text: string): Uint8Array {
  const bytes: number[] = [];
  const normalized = text.replace(/\r\n/g, "\n");
  for (const character of normalized) {
    const code = character.codePointAt(0)!;
    if (character === "\n" || character === "\r") bytes.push(0x0d);
    else if (code >= 0x61 && code <= 0x7a) bytes.push(code - 0x20);
    else if (code >= 0x20 && code <= 0x5b) bytes.push(code);
    else if (character === "]") bytes.push(0x5d);
    else if (character === "£") bytes.push(0x5c);
    else if (character === "↑" || character === "^") bytes.push(0x5e);
    else if (character === "←") bytes.push(0x5f);
    else throw new RangeError(`There is no C64 key for ${JSON.stringify(character)}`);
  }
  return Uint8Array.from(bytes);
}

/**
 * Shows a CBM file or disk name (PETSCII bytes) as text, the way a directory
 * listing shows it in upper case/graphics mode. Bytes $20-$5f are their
 * characters ($5c is £, $5e is ↑, $5f is ←); every other byte is written as
 * {$xx}, so the text converts back to the same bytes.
 */
export function petsciiNameToText(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) {
    if (byte === 0x5c) text += "£";
    else if (byte === 0x5e) text += "↑";
    else if (byte === 0x5f) text += "←";
    else if (byte >= 0x20 && byte <= 0x5d) text += String.fromCharCode(byte);
    else text += `{$${byte.toString(16).padStart(2, "0")}}`;
  }
  return text;
}

/**
 * The reverse of petsciiNameToText. Letters of either case are the unshifted
 * letters ($41-$5a). Throws RangeError for text that is no name.
 */
export function textToPetsciiName(text: string): Uint8Array {
  const bytes: number[] = [];
  const escape = /^\{\$([0-9a-fA-F]{2})\}/;
  for (let index = 0; index < text.length; ) {
    const escaped = escape.exec(text.slice(index));
    if (escaped !== null) {
      bytes.push(Number.parseInt(escaped[1]!, 16));
      index += escaped[0].length;
      continue;
    }
    const character = text[index]!;
    const code = character.charCodeAt(0);
    if (code >= 0x61 && code <= 0x7a) bytes.push(code - 0x20);
    else if (character === "£") bytes.push(0x5c);
    else if (character === "↑") bytes.push(0x5e);
    else if (character === "←") bytes.push(0x5f);
    else if (code >= 0x20 && code <= 0x5d) bytes.push(code);
    else throw new RangeError(`${JSON.stringify(character)} is not a name character; write other bytes as {$xx}`);
    index++;
  }
  return Uint8Array.from(bytes);
}

// C64 BASIC V2 program text, as LOAD puts it in memory.

/** BASIC refuses higher line numbers when a line is entered. */
const MAX_LINE_NUMBER = 63999;

const TOKEN = { data: 0x83, rem: 0x8f, sys: 0x9e, usr: 0xb7, plus: 0xaa, minus: 0xab, times: 0xac, divide: 0xad } as const;
const QUOTE = 0x22;
const COLON = 0x3a;

export interface TokenizedLine {
  number: number;
  /** The line's bytes after the line number, without the terminating zero. */
  tokens: Uint8Array;
}

/** A machine-code handoff in BASIC program text: SYS with a constant address, or a SYS or USR whose target needs run-time values. */
export type BasicHandoff = { kind: "sys"; line: number; address: number } | { kind: "sys" | "usr"; line: number; computed: true };

export type TokenizedProgram = { loadAddress: number; basicEnd: number; lines: TokenizedLine[] } | { reason: string };

/**
 * Splits a PRG into BASIC lines the way BASIC relinks a loaded program: each
 * line ends at a zero byte, and a link whose high byte is zero ends the
 * program. The stored links are not trusted.
 */
export function parseTokenized(program: Uint8Array): TokenizedProgram {
  if (program.length < 4) return { reason: "The file is too short for a BASIC program." };
  const loadAddress = program[0]! | (program[1]! << 8);
  const lines: TokenizedLine[] = [];
  let at = 2;
  // File offset k (from 2 on) loads at loadAddress + k - 2.
  for (;;) {
    // A file that ends right after a line leaves the end marker to the zeros after it in memory;
    // basicEnd is the address after that marker, as when the file holds it.
    if (at === program.length && lines.length > 0) return { loadAddress, basicEnd: loadAddress + at, lines };
    if (at + 1 >= program.length) return { reason: "The BASIC program has no end marker." };
    if (program[at + 1] === 0) {
      // An end marker before any line, with more bytes after it, is how machine code at a non-BASIC address often starts.
      if (lines.length === 0 && at + 2 < program.length) return { reason: "The file holds no BASIC line before other bytes, so it is no BASIC program." };
      return { loadAddress, basicEnd: loadAddress + at, lines };
    }
    if (at + 4 > program.length) return { reason: "The last BASIC line is cut off." };
    const number = program[at + 2]! | (program[at + 3]! << 8);
    if (number > MAX_LINE_NUMBER) return { reason: `Line number ${number} is above ${MAX_LINE_NUMBER}, so the bytes are no BASIC program.` };
    const end = program.indexOf(0, at + 4);
    if (end < 0) return { reason: `BASIC line ${number} has no end.` };
    lines.push({ number, tokens: program.subarray(at + 4, end) });
    at = end + 1;
  }
}

/**
 * Evaluates a SYS argument that holds only numbers, + - * / and brackets.
 * Returns undefined for anything that needs run-time values.
 */
export function constantExpression(bytes: Uint8Array): number | undefined {
  const tokens = [...bytes].filter((byte) => byte !== 0x20);
  let at = 0;
  const peek = () => tokens[at];
  const isDigit = () => peek() !== undefined && peek()! >= 0x30 && peek()! <= 0x39;
  // A number as BASIC reads it: digits and a point, then an optional E with an
  // optional sign (token or character) and exponent digits, so 2E3 is 2000.
  const number = (): number | undefined => {
    let text = "";
    while (isDigit() || peek() === 0x2e) text += String.fromCharCode(tokens[at++]!);
    if (text === "" || text === ".") return undefined;
    if (peek() === 0x45) {
      at++;
      let exponent = "";
      if (peek() === TOKEN.minus || peek() === 0x2d) {
        exponent = "-";
        at++;
      } else if (peek() === TOKEN.plus || peek() === 0x2b) at++;
      let digits = "";
      while (isDigit()) digits += String.fromCharCode(tokens[at++]!);
      text += `e${exponent}${digits === "" ? "0" : digits}`;
    }
    return Number(text);
  };
  const primary = (): number | undefined => {
    if (peek() === TOKEN.minus || peek() === TOKEN.plus) {
      const negative = tokens[at++] === TOKEN.minus;
      const value = primary();
      return value === undefined ? undefined : negative ? -value : value;
    }
    if (peek() === 0x28) {
      at++;
      const value = sum();
      if (value === undefined || tokens[at++] !== 0x29) return undefined;
      return value;
    }
    return number();
  };
  const product = (): number | undefined => {
    let value = primary();
    while (value !== undefined && (peek() === TOKEN.times || peek() === TOKEN.divide)) {
      const operator = tokens[at++];
      const right = primary();
      if (right === undefined) return undefined;
      value = operator === TOKEN.times ? value * right : value / right;
    }
    return value;
  };
  const sum = (): number | undefined => {
    let value = product();
    while (value !== undefined && (peek() === TOKEN.plus || peek() === TOKEN.minus)) {
      const operator = tokens[at++];
      const right = product();
      if (right === undefined) return undefined;
      value = operator === TOKEN.plus ? value + right : value - right;
    }
    return value;
  };
  const value = sum();
  if (value === undefined || !Number.isFinite(value)) return undefined;
  // BASIC's evaluator ends the expression at the first byte that is no operator,
  // so "SYS2073 TCS-CRUNCH!" jumps to 2073 (found on a real release). An operator
  // this evaluator does not handle (^, AND, OR, a comparison) needs run-time values.
  if (at < tokens.length && BASIC_OPERATORS.has(tokens[at]!)) return undefined;
  return value;
}

/** BASIC V2 operator tokens: + - * / ^ AND OR > = <. */
const BASIC_OPERATORS = new Set([0xaa, 0xab, 0xac, 0xad, 0xae, 0xaf, 0xb0, 0xb1, 0xb2, 0xb3]);

/** SYS and USR in program text: not in strings, REM or DATA. */
export function findHandoffs(lines: TokenizedLine[]): BasicHandoff[] {
  const handoffs: BasicHandoff[] = [];
  for (const { number, tokens } of lines) {
    let quoted = false;
    let inData = false;
    for (let at = 0; at < tokens.length; at++) {
      const byte = tokens[at]!;
      if (byte === QUOTE) quoted = !quoted;
      if (quoted) continue;
      if (inData) {
        if (byte === COLON) inData = false;
        continue;
      }
      if (byte === TOKEN.rem) break;
      if (byte === TOKEN.data) inData = true;
      else if (byte === TOKEN.usr) handoffs.push({ kind: "usr", line: number, computed: true });
      else if (byte === TOKEN.sys) {
        // The argument ends at the statement end or at a comma (extra SYS parameters).
        let end = at + 1;
        while (end < tokens.length && tokens[end] !== COLON && tokens[end] !== 0x2c) end++;
        const value = constantExpression(tokens.subarray(at + 1, end));
        if (value === undefined) handoffs.push({ kind: "sys", line: number, computed: true });
        // BASIC drops the fraction; outside 0-65535 SYS stops with ILLEGAL QUANTITY and jumps nowhere.
        else if (Math.trunc(value) >= 0 && Math.trunc(value) <= 0xffff) handoffs.push({ kind: "sys", line: number, address: Math.trunc(value) });
        at = end - 1;
      }
    }
  }
  return handoffs;
}
