import { Refusal } from "./errors.ts";
import { formatAddress } from "./address.ts";

/** The knowledge spaces: the C64, the 1541 drive in unit 8, and cartridge banks 0 to 255. */
export const SPACE_PATTERN = /^(c64|drive8|loading|bank(0|[1-9][0-9]?|1[0-9]{2}|2[0-4][0-9]|25[0-5]))$/;

/** VIC-II state with its addresses as $xxxx; the other values stay numbers. */
export function formatVicii<T extends { screenAddress: number; graphicsAddress: number }>(state: T): Omit<T, "screenAddress" | "graphicsAddress"> & { screenAddress: string; graphicsAddress: string } {
  return { ...state, screenAddress: formatAddress(state.screenAddress), graphicsAddress: formatAddress(state.graphicsAddress) };
}

/** A sprite with its data address as $xxxx; the other values stay numbers. */
export function formatSprite<T extends { dataAddress: number }>(sprite: T): Omit<T, "dataAddress"> & { dataAddress: string } {
  return { ...sprite, dataAddress: formatAddress(sprite.dataAddress) };
}

/**
 * The memory a PRG loads into: the 2-byte load address, then the body.
 * Refuses a file shorter than 3 bytes or one that runs past $ffff.
 */
export function prgRange(prg: Uint8Array): { start: number; end: number; body: Uint8Array } {
  if (prg.length < 3) throw new Refusal("invalid-input", "A PRG has a 2-byte load address and at least one byte.");
  const start = prg[0]! | (prg[1]! << 8);
  if (start + prg.length - 2 > 0x10000) throw new Refusal("invalid-input", "The PRG runs past $ffff.");
  return { start, end: start + prg.length - 3, body: prg.subarray(2) };
}

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
 * Refuses the text with the first character that has no key.
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
    else throw new Refusal("invalid-input", `There is no C64 key for ${JSON.stringify(character)}`);
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
 * letters ($41-$5a). Refuses text that is no name.
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
    else throw new Refusal("invalid-input", `${JSON.stringify(character)} is not a name character. Write other bytes as {$xx}.`);
    index++;
  }
  return Uint8Array.from(bytes);
}

// C64 BASIC V2 program text, as LOAD puts it in memory.

/** BASIC refuses higher line numbers when a line is entered. */
const MAX_LINE_NUMBER = 63999;

const TOKEN = { data: 0x83, rem: 0x8f, sys: 0x9e, usr: 0xb7, plus: 0xaa, minus: 0xab, times: 0xac, divide: 0xad, pi: 0xff } as const;
const QUOTE = 0x22;
const COLON = 0x3a;

export interface TokenizedLine {
  number: number;
  /** The line's bytes after the line number, without the terminating zero. */
  tokens: Uint8Array;
}

/**
 * A machine-code handoff in BASIC program text: SYS with a constant address, a
 * SYS whose argument needs run-time values (with the argument as text), or a USR.
 */
export type BasicHandoff =
  | { kind: "sys"; line: number; address: number }
  | { kind: "sys"; line: number; computed: true; expression: string }
  | { kind: "usr"; line: number; computed: true };

/**
 * `basicEnd` is the first address that holds no BASIC; `textBytes` is the
 * number of file bytes (load address included) before the end of the BASIC text.
 */
export type TokenizedProgram = { loadAddress: number; basicEnd: number; textBytes: number; lines: TokenizedLine[] } | { reason: string };

/** BASIC text cannot start below the screen: there are the zero page, the stack and the system pages. */
const MIN_BASIC_LOAD = 0x0400;

/**
 * Splits a PRG into BASIC lines the way BASIC relinks a loaded program: each
 * line ends at a zero byte, and a link whose high byte is zero ends the
 * program. A real end marker is two zero bytes; when only the high byte is
 * zero, the "marker" is the first machine code after the BASIC text (SYS
 * lines that jump right behind themselves). The stored links are not read:
 * BASIC relinks a loaded program, and a crack can store odd links to hide
 * lines from LIST. A load address below $0400 is a memory dump, and so
 * is a file whose bytes run past $ffff: a 64 KiB dump from $0000 always does
 *.
 */
export function parseTokenized(program: Uint8Array): TokenizedProgram {
  if (program.length < 4) return { reason: "The file is too short for a BASIC program." };
  const loadAddress = program[0]! | (program[1]! << 8);
  if (loadAddress < MIN_BASIC_LOAD) {
    return { reason: `The load address ${formatAddress(loadAddress)} is below $0400, in the zero page, the stack or the system pages. The file is a memory dump or machine code, not a BASIC program.` };
  }
  if (loadAddress + program.length - 2 > 0x10000) {
    return { reason: `The file holds ${program.length - 2} bytes from ${formatAddress(loadAddress)}, which runs past $ffff. The file is a memory dump, not a BASIC program.` };
  }
  const lines: TokenizedLine[] = [];
  let at = 2;
  const ended = (basicEnd: number): TokenizedProgram => ({ loadAddress, basicEnd, textBytes: at, lines });
  // File offset k (from 2 on) loads at loadAddress + k - 2.
  for (;;) {
    // A file that ends right after a line leaves the end marker to the zeros after it in memory;
    // basicEnd is the address after that marker, as when the file holds it.
    if (at === program.length && lines.length > 0) return ended(loadAddress + at);
    if (at + 1 >= program.length) return { reason: "The BASIC program has no end marker." };
    if (program[at + 1] === 0) {
      // An end marker before any line, with more bytes after it, is how machine code at a non-BASIC address often starts.
      if (lines.length === 0 && at + 2 < program.length) return { reason: "The file holds no BASIC line before other bytes, so it is no BASIC program." };
      const marker = program[at] === 0;
      return ended(loadAddress + (marker ? at : at - 2));
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

/** BASIC V2 keywords for the tokens $80 to $cb, in token order. */
const KEYWORDS = [
  "END", "FOR", "NEXT", "DATA", "INPUT#", "INPUT", "DIM", "READ", "LET", "GOTO", "RUN", "IF", "RESTORE", "GOSUB", "RETURN", "REM",
  "STOP", "ON", "WAIT", "LOAD", "SAVE", "VERIFY", "DEF", "POKE", "PRINT#", "PRINT", "CONT", "LIST", "CLR", "CMD", "SYS", "OPEN",
  "CLOSE", "GET", "NEW", "TAB(", "TO", "FN", "SPC(", "THEN", "NOT", "STEP", "+", "-", "*", "/", "^", "AND",
  "OR", ">", "=", "<", "SGN", "INT", "ABS", "USR", "FRE", "POS", "SQR", "RND", "LOG", "EXP", "COS", "SIN",
  "TAN", "ATN", "PEEK", "LEN", "STR$", "VAL", "ASC", "CHR$", "LEFT$", "RIGHT$", "MID$", "GO",
] as const;

/**
 * One BASIC line as text: keywords for tokens, text in quotes and after REM
 * as it is, and {$xx} for bytes that are no character. For evidence, not a listing.
 */
export function basicLineText(line: TokenizedLine): string {
  return `${line.number} ${basicText(line.tokens)}`;
}

/** Tokenized BASIC bytes as text, as for basicLineText; pi is π. */
function basicText(tokens: Uint8Array): string {
  let text = "";
  let literal = false;
  for (const byte of tokens) {
    if (byte === QUOTE) literal = !literal;
    if (!literal && byte >= 0x80 && byte < 0x80 + KEYWORDS.length) {
      text += KEYWORDS[byte - 0x80];
      if (byte === TOKEN.rem) literal = true;
    } else if (!literal && byte === TOKEN.pi) {
      text += "π";
    } else {
      text += petsciiNameToText(Uint8Array.of(byte));
    }
  }
  return text;
}

/**
 * Evaluates a SYS argument that holds only numbers, π, + - * / and brackets.
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
    if (peek() === TOKEN.pi) {
      at++;
      return Math.PI;
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
  // so "SYS2073 TCS-CRUNCH!" jumps to 2073. An operator
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
        const argument = tokens.subarray(at + 1, end);
        const value = constantExpression(argument);
        if (value === undefined) handoffs.push({ kind: "sys", line: number, computed: true, expression: basicText(argument).trim() });
        // BASIC drops the fraction; outside 0-65535 SYS stops with ILLEGAL QUANTITY and jumps nowhere.
        else if (Math.trunc(value) >= 0 && Math.trunc(value) <= 0xffff) handoffs.push({ kind: "sys", line: number, address: Math.trunc(value) });
        at = end - 1;
      }
    }
  }
  return handoffs;
}

// Execution coverage: the byte format of a coverage map, and the 6502
// instruction lengths that turn the instruction starts in it into code ranges.
// VICE marks only the opcode byte of an executed instruction as executed.

/** One byte per address: the access flags as VICE reports them, RAM, ROM and I/O apart. */
export const COVERAGE = {
  ramRead: 1 << 0,
  ramWrite: 1 << 1,
  ramExecute: 1 << 2,
  romRead: 1 << 3,
  romExecute: 1 << 4,
  ioRead: 1 << 5,
  ioWrite: 1 << 6,
  ioExecute: 1 << 7,
} as const;

export const EXECUTE = COVERAGE.ramExecute | COVERAGE.romExecute | COVERAGE.ioExecute;
export const READ = COVERAGE.ramRead | COVERAGE.romRead | COVERAGE.ioRead;
export const WRITE = COVERAGE.ramWrite | COVERAGE.ioWrite;

/**
 * The length in bytes of the NMOS 6502/6510 instruction with this opcode, for
 * all 256 opcodes with the undocumented ones. The opcode is aaabbbcc: bbb
 * selects the addressing mode within a group cc. JAM (KIL) and BRK count one byte.
 */
export function instructionLength(opcode: number): 1 | 2 | 3 {
  const group = opcode & 0b11;
  const mode = (opcode >> 2) & 0b111;
  if (group === 0b00) {
    if (mode === 0b000) return opcode === 0x20 ? 3 : opcode === 0x00 || opcode === 0x40 || opcode === 0x60 ? 1 : 2;
    return ([2, 2, 1, 3, 2, 2, 1, 3] as const)[mode]!;
  }
  if (group === 0b10) {
    if (mode === 0b000) return opcode === 0x02 || opcode === 0x22 || opcode === 0x42 || opcode === 0x62 ? 1 : 2;
    return ([2, 2, 1, 3, 1, 2, 1, 3] as const)[mode]!;
  }
  // Groups 01 and 11 share their addressing modes.
  return ([2, 2, 2, 3, 2, 2, 3, 3] as const)[mode]!;
}

export interface CodeRange {
  start: number;
  end: number;
}

/**
 * The executed code in RAM as ranges: each RAM instruction start in `map`
 * with its operand bytes, by the opcode in `memory` (64 KiB from $0000).
 * `map` starts at `base`. Adjacent and overlapping instructions merge.
 */
export function executedRamCode(map: Uint8Array, base: number, memory: Uint8Array): CodeRange[] {
  const ranges: CodeRange[] = [];
  for (let offset = 0; offset < map.length; offset++) {
    if ((map[offset]! & COVERAGE.ramExecute) === 0) continue;
    const start = base + offset;
    const end = Math.min(0xffff, start + instructionLength(memory[start]!) - 1);
    const last = ranges.at(-1);
    if (last !== undefined && start <= last.end + 1) last.end = Math.max(last.end, end);
    else ranges.push({ start, end });
  }
  return ranges;
}
