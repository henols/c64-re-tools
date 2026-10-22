// ZX Spectrum media and snapshots: the blocks of a TAP or TZX tape, and the
// .z80 and .sna snapshots of the 48K and the 128K, read and written. A
// snapshot holds the eight 16 KiB RAM banks of the 128K. On the 48K, bank 5
// is $4000-$7fff, bank 2 is $8000-$bfff and bank 0 is $c000-$ffff, as on a
// 128K with bank 0 paged in.

import { Refusal } from "./errors.ts";

export type SpectrumModel = "48k" | "128k";

export interface Z80Registers {
  af: number;
  bc: number;
  de: number;
  hl: number;
  af2: number;
  bc2: number;
  de2: number;
  hl2: number;
  ix: number;
  iy: number;
  sp: number;
  pc: number;
  i: number;
  r: number;
  iff1: boolean;
  iff2: boolean;
  im: 0 | 1 | 2;
}

export interface SpectrumSnapshot {
  model: SpectrumModel;
  registers: Z80Registers;
  border: number;
  /** The last value written to port $7ffd: the paging of the 128K. 0 on the 48K. */
  port7ffd: number;
  /** The eight RAM banks of 16 KiB. On the 48K only banks 5, 2 and 0 are used. */
  banks: Uint8Array[];
  /** The AY registers and the last selected register of the 128K, when the file has them. */
  ay?: { registers: number[]; selected: number };
}

const BANK = 0x4000;
const BANKS_48K = [5, 2, 0] as const;

/** The bank paged in at $c000: bits 0-2 of port $7ffd on the 128K, bank 0 on the 48K. */
export function pagedBank(snapshot: SpectrumSnapshot): number {
  return snapshot.model === "128k" ? snapshot.port7ffd & 7 : 0;
}

/** The RAM that the CPU sees at $4000-$ffff: banks 5 and 2, and the paged bank. */
export function cpuRam(snapshot: SpectrumSnapshot): Uint8Array {
  const ram = new Uint8Array(0xc000);
  ram.set(snapshot.banks[5]!, 0);
  ram.set(snapshot.banks[2]!, BANK);
  ram.set(snapshot.banks[pagedBank(snapshot)]!, 2 * BANK);
  return ram;
}

function emptyBanks(): Uint8Array[] {
  return Array.from({ length: 8 }, () => new Uint8Array(BANK));
}

const word = (bytes: Uint8Array, at: number) => bytes[at]! | (bytes[at + 1]! << 8);

function need(bytes: Uint8Array, length: number, what: string): void {
  if (bytes.length < length) throw new Refusal("invalid-input", `${what} is too short: ${bytes.length} bytes.`);
}

// ---------------------------------------------------------------------------
// .z80

/** The compression of a .z80 page: a run of 5 or more equal bytes, or of 2 or more $ed, is "ed ed count byte"; the byte after a single $ed is never the start of a run. */
function compress(data: Uint8Array): number[] {
  const out: number[] = [];
  let at = 0;
  while (at < data.length) {
    const value = data[at]!;
    let run = 1;
    while (at + run < data.length && data[at + run] === value && run < 255) run++;
    if (run >= 5 || (value === 0xed && run >= 2)) {
      out.push(0xed, 0xed, run, value);
      at += run;
    } else if (value === 0xed) {
      out.push(0xed);
      at++;
      if (at < data.length) out.push(data[at++]!);
    } else {
      out.push(value);
      at++;
    }
  }
  return out;
}

function decompress(data: Uint8Array, size: number, endMarker: boolean): Uint8Array {
  const out = new Uint8Array(size);
  let from = 0;
  let to = 0;
  while (from < data.length && to < size) {
    if (endMarker && data[from] === 0x00 && data[from + 1] === 0xed && data[from + 2] === 0xed && data[from + 3] === 0x00) break;
    if (data[from] === 0xed && data[from + 1] === 0xed) {
      const count = data[from + 2]!;
      out.fill(data[from + 3]!, to, Math.min(size, to + count));
      to += count;
      from += 4;
    } else {
      out[to++] = data[from++]!;
    }
  }
  if (to !== size) throw new Refusal("invalid-input", `A .z80 memory block gives ${to} bytes, not ${size}.`);
  return out;
}

/** The 128K hardware modes of a version 2 and a version 3 .z80. */
const MODE_128K = { 2: [3, 4], 3: [4, 5, 6, 7, 12, 13] } as const;

/** Reads a .z80 snapshot of version 1, 2 or 3, of a 48K or a 128K. */
export function readZ80(bytes: Uint8Array): SpectrumSnapshot {
  need(bytes, 30, "The .z80 file");
  const flags = bytes[12] === 0xff ? 1 : bytes[12]!;
  const registers: Z80Registers = {
    af: (bytes[0]! << 8) | bytes[1]!,
    bc: word(bytes, 2),
    hl: word(bytes, 4),
    pc: word(bytes, 6),
    sp: word(bytes, 8),
    i: bytes[10]!,
    r: (bytes[11]! & 0x7f) | ((flags & 1) << 7),
    de: word(bytes, 13),
    bc2: word(bytes, 15),
    de2: word(bytes, 17),
    hl2: word(bytes, 19),
    af2: (bytes[21]! << 8) | bytes[22]!,
    iy: word(bytes, 23),
    ix: word(bytes, 25),
    iff1: bytes[27] !== 0,
    iff2: bytes[28] !== 0,
    im: (bytes[29]! & 3) as 0 | 1 | 2,
  };
  const border = (flags >> 1) & 7;
  const banks = emptyBanks();
  if (registers.pc !== 0) {
    // Version 1: a 48K, the 48 KiB of RAM from $4000, compressed when bit 5 of the flags is set.
    const body = bytes.subarray(30);
    const ram = (flags & 0x20) !== 0 ? decompress(body, 0xc000, true) : body.subarray(0, 0xc000);
    if (ram.length < 0xc000) throw new Refusal("invalid-input", "The version 1 .z80 file has less than 48 KiB of RAM.");
    BANKS_48K.forEach((bank, index) => banks[bank]!.set(ram.subarray(index * BANK, (index + 1) * BANK)));
    return { model: "48k", registers, border, port7ffd: 0, banks };
  }
  need(bytes, 32, "The .z80 file");
  const extra = word(bytes, 30);
  if (extra !== 23 && extra !== 54 && extra !== 55) throw new Refusal("invalid-input", `The .z80 file has an extra header of ${extra} bytes; versions 2 and 3 have 23, 54 or 55.`);
  need(bytes, 32 + extra, "The .z80 file");
  const version = extra === 23 ? 2 : 3;
  registers.pc = word(bytes, 32);
  const mode = bytes[34]!;
  const is128k = (MODE_128K[version] as readonly number[]).includes(mode);
  const snapshot: SpectrumSnapshot = { model: is128k ? "128k" : "48k", registers, border, port7ffd: is128k ? bytes[35]! : 0, banks };
  if (is128k) snapshot.ay = { registers: [...bytes.subarray(39, 55)], selected: bytes[38]! };
  let at = 32 + extra;
  while (at + 3 <= bytes.length) {
    const length = word(bytes, at);
    const page = bytes[at + 2]!;
    const data = length === 0xffff ? bytes.subarray(at + 3, at + 3 + BANK) : bytes.subarray(at + 3, at + 3 + length);
    at += 3 + (length === 0xffff ? BANK : length);
    const block = length === 0xffff ? Uint8Array.from(data) : decompress(data, BANK, false);
    // The 128K: pages 3-10 are banks 0-7. The 48K: page 8 is $4000, 4 is $8000, 5 is $c000.
    const bank = is128k ? page - 3 : page === 8 ? 5 : page === 4 ? 2 : page === 5 ? 0 : -1;
    if (bank >= 0 && bank <= 7) banks[bank]!.set(block);
  }
  return snapshot;
}

/** Writes a version 3 .z80 snapshot with compressed pages: the form that every emulator and chips read. */
export function writeZ80(snapshot: SpectrumSnapshot): Uint8Array {
  const r = snapshot.registers;
  const header = new Uint8Array(30 + 2 + 54);
  header[0] = r.af >> 8;
  header[1] = r.af & 0xff;
  header[2] = r.bc & 0xff;
  header[3] = r.bc >> 8;
  header[4] = r.hl & 0xff;
  header[5] = r.hl >> 8;
  // PC 0 marks version 2 and 3: the PC is in the extra header.
  header[8] = r.sp & 0xff;
  header[9] = r.sp >> 8;
  header[10] = r.i;
  header[11] = r.r & 0x7f;
  header[12] = ((r.r >> 7) & 1) | ((snapshot.border & 7) << 1);
  header[13] = r.de & 0xff;
  header[14] = r.de >> 8;
  header[15] = r.bc2 & 0xff;
  header[16] = r.bc2 >> 8;
  header[17] = r.de2 & 0xff;
  header[18] = r.de2 >> 8;
  header[19] = r.hl2 & 0xff;
  header[20] = r.hl2 >> 8;
  header[21] = r.af2 >> 8;
  header[22] = r.af2 & 0xff;
  header[23] = r.iy & 0xff;
  header[24] = r.iy >> 8;
  header[25] = r.ix & 0xff;
  header[26] = r.ix >> 8;
  header[27] = r.iff1 ? 1 : 0;
  header[28] = r.iff2 ? 1 : 0;
  header[29] = r.im & 3;
  header[30] = 54;
  header[32] = r.pc & 0xff;
  header[33] = r.pc >> 8;
  header[34] = snapshot.model === "128k" ? 4 : 0;
  header[35] = snapshot.model === "128k" ? snapshot.port7ffd : 0;
  if (snapshot.ay !== undefined) {
    header[38] = snapshot.ay.selected;
    header.set(snapshot.ay.registers.slice(0, 16), 39);
  }
  const pages: Array<[page: number, bank: number]> = snapshot.model === "128k" ? Array.from({ length: 8 }, (_, bank) => [bank + 3, bank]) : [[8, 5], [4, 2], [5, 0]];
  const blocks = pages.map(([page, bank]) => {
    const data = compress(snapshot.banks[bank]!);
    return Uint8Array.from([data.length & 0xff, data.length >> 8, page, ...data]);
  });
  const out = new Uint8Array(header.length + blocks.reduce((sum, block) => sum + block.length, 0));
  out.set(header, 0);
  let at = header.length;
  for (const block of blocks) {
    out.set(block, at);
    at += block.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// .sna

const SNA_48K = 27 + 0xc000;

/** Reads a .sna snapshot: the 48K form (the PC on the stack), or the 128K form. */
export function readSna(bytes: Uint8Array): SpectrumSnapshot {
  if (bytes.length !== SNA_48K && bytes.length !== SNA_48K + 4 + 5 * BANK && bytes.length !== SNA_48K + 4 + 6 * BANK) {
    throw new Refusal("invalid-input", `A .sna file has 49179 bytes (48K), or 131103 or 147487 bytes (128K), not ${bytes.length}.`);
  }
  const registers: Z80Registers = {
    i: bytes[0]!,
    hl2: word(bytes, 1),
    de2: word(bytes, 3),
    bc2: word(bytes, 5),
    af2: word(bytes, 7),
    hl: word(bytes, 9),
    de: word(bytes, 11),
    bc: word(bytes, 13),
    iy: word(bytes, 15),
    ix: word(bytes, 17),
    iff1: (bytes[19]! & 4) !== 0,
    iff2: (bytes[19]! & 4) !== 0,
    r: bytes[20]!,
    af: word(bytes, 21),
    sp: word(bytes, 23),
    im: (bytes[25]! & 3) as 0 | 1 | 2,
    pc: 0,
  };
  const border = bytes[26]! & 7;
  const banks = emptyBanks();
  const ram = bytes.subarray(27, SNA_48K);
  if (bytes.length === SNA_48K) {
    BANKS_48K.forEach((bank, index) => banks[bank]!.set(ram.subarray(index * BANK, (index + 1) * BANK)));
    // The 48K form keeps the PC on the stack: the snapshot pops it.
    const at = (registers.sp - 0x4000) & 0xffff;
    registers.pc = ram[at]! | (ram[(at + 1) & 0xffff]! << 8);
    registers.sp = (registers.sp + 2) & 0xffff;
    return { model: "48k", registers, border, port7ffd: 0, banks };
  }
  registers.pc = word(bytes, SNA_48K);
  const port7ffd = bytes[SNA_48K + 2]!;
  const paged = port7ffd & 7;
  banks[5]!.set(ram.subarray(0, BANK));
  banks[2]!.set(ram.subarray(BANK, 2 * BANK));
  banks[paged]!.set(ram.subarray(2 * BANK, 3 * BANK));
  let at = SNA_48K + 4;
  for (let bank = 0; bank < 8 && at < bytes.length; bank++) {
    if (bank === 5 || bank === 2 || bank === paged) continue;
    banks[bank]!.set(bytes.subarray(at, at + BANK));
    at += BANK;
  }
  return { model: "128k", registers, border, port7ffd, banks };
}

/** Writes a .sna snapshot. The 48K form pushes the PC on the stack, as the format wants. */
export function writeSna(snapshot: SpectrumSnapshot): Uint8Array {
  const r = snapshot.registers;
  const is48k = snapshot.model === "48k";
  const ram = cpuRam(snapshot);
  let sp = r.sp;
  if (is48k) {
    sp = (sp - 2) & 0xffff;
    if (sp < 0x4000 || sp > 0xfffe) throw new Refusal("invalid-input", `A 48K .sna keeps the PC on the stack, and the stack pointer $${sp.toString(16)} is not in RAM.`);
    ram[sp - 0x4000] = r.pc & 0xff;
    ram[sp - 0x4000 + 1] = r.pc >> 8;
  }
  const header = [r.i, r.hl2 & 0xff, r.hl2 >> 8, r.de2 & 0xff, r.de2 >> 8, r.bc2 & 0xff, r.bc2 >> 8, r.af2 & 0xff, r.af2 >> 8, r.hl & 0xff, r.hl >> 8, r.de & 0xff, r.de >> 8, r.bc & 0xff, r.bc >> 8, r.iy & 0xff, r.iy >> 8, r.ix & 0xff, r.ix >> 8, r.iff2 ? 4 : 0, r.r, r.af & 0xff, r.af >> 8, sp & 0xff, sp >> 8, r.im, snapshot.border & 7];
  if (is48k) return Uint8Array.from([...header, ...ram]);
  const paged = pagedBank(snapshot);
  const rest = [0, 1, 3, 4, 6, 7].filter((bank) => bank !== paged).flatMap((bank) => [...snapshot.banks[bank]!]);
  return Uint8Array.from([...header, ...ram, r.pc & 0xff, r.pc >> 8, snapshot.port7ffd, 0, ...rest]);
}

// ---------------------------------------------------------------------------
// Tapes

/** The header of a standard ROM tape block: the file that the next data block holds. */
export interface TapeHeader {
  type: "program" | "number-array" | "character-array" | "code";
  name: string;
  length: number;
  /** A program: the line that starts it (none at 32768 or more). Code: the load address. */
  param1: number;
  /** A program: the length of the program without its variables. */
  param2: number;
}

export interface TapeBlock {
  /** The kind of block: a standard data block (TAP, TZX $10), a turbo block (TZX $11, $14), or another TZX block. */
  kind: "standard" | "turbo" | "pure-data" | "other";
  /** The TZX block id; none in a TAP file. */
  id?: number;
  /** The bytes of a data block: the flag byte, the data and the checksum. */
  bytes?: Uint8Array;
  /** The flag byte: $00 for a header, $ff for data in the ROM format. */
  flag?: number;
  /** True when the XOR of every byte of a data block is 0. */
  checksumOk?: boolean;
  header?: TapeHeader;
  /** What a TZX block that holds no data says, for example a text description. */
  text?: string;
}

const HEADER_TYPES = ["program", "number-array", "character-array", "code"] as const;

function dataBlock(kind: TapeBlock["kind"], bytes: Uint8Array, id?: number): TapeBlock {
  const block: TapeBlock = { kind, bytes, ...(id === undefined ? {} : { id }) };
  if (bytes.length === 0) return block;
  block.flag = bytes[0]!;
  block.checksumOk = bytes.reduce((xor, byte) => xor ^ byte, 0) === 0;
  if (block.flag === 0 && bytes.length === 19) {
    const type = HEADER_TYPES[bytes[1]!];
    if (type !== undefined) {
      block.header = {
        type,
        name: String.fromCharCode(...bytes.subarray(2, 12)).replace(/ +$/, ""),
        length: word(bytes, 12),
        param1: word(bytes, 14),
        param2: word(bytes, 16),
      };
    }
  }
  return block;
}

/** The blocks of a TAP file: each is a 2-byte length and that many bytes. */
export function readTap(bytes: Uint8Array): TapeBlock[] {
  const blocks: TapeBlock[] = [];
  let at = 0;
  while (at < bytes.length) {
    if (at + 2 > bytes.length) throw new Refusal("invalid-input", `The TAP file ends inside the length of a block at offset ${at}.`);
    const length = word(bytes, at);
    if (at + 2 + length > bytes.length) throw new Refusal("invalid-input", `The TAP block at offset ${at} has ${length} bytes, and the file ends before them.`);
    blocks.push(dataBlock("standard", bytes.subarray(at + 2, at + 2 + length)));
    at += 2 + length;
  }
  return blocks;
}

const TZX_SIGNATURE = "ZXTape!\x1a";

/** The blocks of a TZX file. Data blocks give their bytes; the other blocks give their id and any text. */
export function readTzx(bytes: Uint8Array): TapeBlock[] {
  need(bytes, 10, "The TZX file");
  if (String.fromCharCode(...bytes.subarray(0, 8)) !== TZX_SIGNATURE) throw new Refusal("invalid-input", "A TZX file starts with ZXTape! and $1a.");
  const blocks: TapeBlock[] = [];
  const long = (at: number) => bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16);
  const dword = (at: number) => (bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16) | (bytes[at + 3]! << 24)) >>> 0;
  const text = (at: number, length: number) => String.fromCharCode(...bytes.subarray(at, at + length));
  let at = 10;
  while (at < bytes.length) {
    const id = bytes[at]!;
    const body = at + 1;
    let size: number;
    switch (id) {
      case 0x10: {
        const length = word(bytes, body + 2);
        blocks.push(dataBlock("standard", bytes.subarray(body + 4, body + 4 + length), id));
        size = 4 + length;
        break;
      }
      case 0x11: {
        const length = long(body + 15);
        blocks.push(dataBlock("turbo", bytes.subarray(body + 18, body + 18 + length), id));
        size = 18 + length;
        break;
      }
      case 0x14: {
        const length = long(body + 7);
        blocks.push(dataBlock("pure-data", bytes.subarray(body + 10, body + 10 + length), id));
        size = 10 + length;
        break;
      }
      case 0x12:
        size = 4;
        break;
      case 0x13:
        size = 1 + 2 * bytes[body]!;
        break;
      case 0x15:
        size = 8 + long(body + 5);
        break;
      case 0x18:
      case 0x19:
        size = 4 + dword(body);
        break;
      case 0x20:
      case 0x23:
      case 0x24:
        size = 2;
        break;
      case 0x21:
        blocks.push({ kind: "other", id, text: text(body + 1, bytes[body]!) });
        size = 1 + bytes[body]!;
        break;
      case 0x22:
      case 0x25:
      case 0x27:
        size = 0;
        break;
      case 0x26:
        size = 2 + 2 * word(bytes, body);
        break;
      case 0x28:
      case 0x32:
        size = 2 + word(bytes, body);
        break;
      case 0x2a:
      case 0x2b:
        size = 4 + dword(body);
        break;
      case 0x30:
        blocks.push({ kind: "other", id, text: text(body + 1, bytes[body]!) });
        size = 1 + bytes[body]!;
        break;
      case 0x31:
        blocks.push({ kind: "other", id, text: text(body + 2, bytes[body + 1]!) });
        size = 2 + bytes[body + 1]!;
        break;
      case 0x33:
        size = 1 + 3 * bytes[body]!;
        break;
      case 0x35:
        size = 14 + dword(body + 10);
        break;
      case 0x5a:
        size = 9;
        break;
      default:
        // Every later block has a 4-byte length after its id.
        size = 4 + dword(body);
    }
    if (![0x10, 0x11, 0x14, 0x21, 0x30, 0x31].includes(id)) blocks.push({ kind: "other", id });
    at = body + size;
  }
  if (at !== bytes.length) throw new Refusal("invalid-input", "The last TZX block runs past the end of the file.");
  return blocks;
}

// ---------------------------------------------------------------------------
// Sinclair BASIC

/** One line of a Sinclair BASIC program: its number and its bytes, without the ENTER at the end. */
export interface SinclairLine {
  number: number;
  bytes: Uint8Array;
}

/** The lines of a program, and the offset where its variables start (the end of the lines). */
export type SinclairProgram = { lines: SinclairLine[]; variablesAt: number } | { reason: string };

const ENTER = 0x0d;
const NUMBER_MARK = 0x0e;
const MAX_SINCLAIR_LINE = 9999;

/**
 * Splits the bytes of a program as the ROM keeps them: each line is its number
 * (2 bytes, high byte first), the length of the rest (2 bytes, low byte first)
 * and the rest, which ends with ENTER. The lines end at `length` (the program
 * length of a tape header, without the variables) or at the first byte that
 * starts no line: a variable name has bit 6 set, and a line number never has.
 */
export function parseSinclairBasic(bytes: Uint8Array, length = bytes.length): SinclairProgram {
  const end = Math.min(length, bytes.length);
  const lines: SinclairLine[] = [];
  let at = 0;
  while (at < end && bytes[at]! < 0x40) {
    if (at + 4 > end) return { reason: `The program ends inside the start of a line at offset ${at}.` };
    const number = (bytes[at]! << 8) | bytes[at + 1]!;
    const size = bytes[at + 2]! | (bytes[at + 3]! << 8);
    if (number > MAX_SINCLAIR_LINE) return { reason: `Line number ${number} is above ${MAX_SINCLAIR_LINE}, so the bytes are no BASIC program.` };
    if (size === 0 || at + 4 + size > end) return { reason: `Line ${number} has ${size} bytes, and the program ends before them.` };
    if (bytes[at + 4 + size - 1] !== ENTER) return { reason: `Line ${number} does not end with ENTER.` };
    lines.push({ number, bytes: bytes.subarray(at + 4, at + 4 + size - 1) });
    at += 4 + size;
  }
  if (lines.length === 0) return { reason: "The bytes hold no BASIC line." };
  return { lines, variablesAt: at };
}

/** The keywords of the tokens $a3 to $ff; $a3 and $a4 are keywords only on the 128K (on the 48K they are the graphics T and U). */
const SINCLAIR_KEYWORDS = [
  "SPECTRUM", "PLAY", "RND", "INKEY$", "PI", "FN", "POINT", "SCREEN$", "ATTR", "AT", "TAB", "VAL$", "CODE",
  "VAL", "LEN", "SIN", "COS", "TAN", "ASN", "ACS", "ATN", "LN", "EXP", "INT", "SQR", "SGN", "ABS", "PEEK", "IN",
  "USR", "STR$", "CHR$", "NOT", "BIN", "OR", "AND", "<=", ">=", "<>", "LINE", "THEN", "TO", "STEP", "DEF FN", "CAT",
  "FORMAT", "MOVE", "ERASE", "OPEN #", "CLOSE #", "MERGE", "VERIFY", "BEEP", "CIRCLE", "INK", "PAPER", "FLASH", "BRIGHT", "INVERSE", "OVER", "OUT",
  "LPRINT", "LLIST", "STOP", "READ", "DATA", "RESTORE", "NEW", "BORDER", "CONTINUE", "DIM", "REM", "FOR", "GO TO", "GO SUB", "INPUT", "LOAD",
  "LIST", "LET", "PAUSE", "NEXT", "POKE", "PRINT", "PLOT", "RUN", "SAVE", "RANDOMIZE", "IF", "CLS", "DRAW", "CLEAR", "RETURN", "COPY",
] as const;

const TOKEN_BIN = 0xc4;
const TOKEN_REM = 0xea;
const TOKEN_USR = 0xc0;
const TOKEN_VAL = 0xb0;
const TOKEN_CLEAR = 0xfd;
const TOKEN_LOAD = 0xef;
const TOKEN_CODE = 0xaf;
const TOKEN_SCREEN = 0xaa;
const TOKEN_POKE = 0xf4;
/** ERR_SP: the address on the machine stack of the error return of BASIC, two bytes. */
const ERR_SP = 0x5c3d;

/** The colour and position codes that take parameters: their name and the number of parameter bytes. */
const CONTROL_CODES: Record<number, [name: string, parameters: number]> = {
  0x10: ["INK", 1], 0x11: ["PAPER", 1], 0x12: ["FLASH", 1], 0x13: ["BRIGHT", 1], 0x14: ["INVERSE", 1], 0x15: ["OVER", 1], 0x16: ["AT", 2], 0x17: ["TAB", 2],
};

/**
 * The value of a number in the 5-byte form of the ROM: the small integer form
 * (0, sign, low byte, high byte, 0) or a floating point number (exponent with a
 * bias of 128, then a 32-bit mantissa whose top bit is the sign).
 */
export function sinclairNumber(bytes: Uint8Array): number {
  if (bytes[0] === 0) {
    const value = bytes[2]! | (bytes[3]! << 8);
    return bytes[1] === 0xff ? value - 0x10000 : value;
  }
  const mantissa = (((bytes[1]! | 0x80) << 24) >>> 0) + bytes[2]! * 0x10000 + bytes[3]! * 0x100 + bytes[4]!;
  const value = (mantissa / 2 ** 32) * 2 ** (bytes[0]! - 128);
  return bytes[1]! & 0x80 ? -value : value;
}

/**
 * A number as PRINT of the ROM shows it: a whole number as it is, else
 * rounded to the 8 significant digits of the ROM. The binary fraction of a
 * 5-byte number (23641.1 is kept as 23641.09999847412) thus does not show.
 */
export function sinclairNumberText(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(8)));
}

function sameNumber(text: string, bin: boolean, value: number): boolean {
  const shown = bin ? Number.parseInt(text || "0", 2) : Number(text);
  return Number.isFinite(shown) && Math.abs(shown - value) <= Math.abs(value) * 1e-9;
}

/**
 * One line as text, for evidence: keywords for tokens, as LIST prints them
 * also in strings and REM; {INK 2}, {AT 3,4} and the like for colour and
 * position codes; {UDG A} for a user graphic; {$xx} for other bytes that are no
 * character. The 5-byte form after a number in the text is hidden, as LIST
 * hides it; when it holds another value than the text, {=value} after the
 * text shows it, because then that value is what the program uses.
 */
export function sinclairLineText(line: SinclairLine, model: SpectrumModel = "48k"): string {
  const { bytes } = line;
  let text = `${line.number} `;
  let digits = "";
  let bin = false;
  let quoted = false;
  let rem = false;
  for (let at = 0; at < bytes.length; at++) {
    const byte = bytes[at]!;
    if (byte === NUMBER_MARK && at + 5 < bytes.length + 1) {
      const value = sinclairNumber(bytes.subarray(at + 1, at + 6));
      if (!quoted && !rem && !sameNumber(digits, bin, value)) text += `{=${sinclairNumberText(value)}}`;
      digits = "";
      bin = false;
      at += 5;
      continue;
    }
    const control = CONTROL_CODES[byte];
    if (control !== undefined) {
      const [name, count] = control;
      text += `{${name} ${[...bytes.subarray(at + 1, at + 1 + count)].join(",")}}`;
      at += count;
      continue;
    }
    if (byte >= 0xa3 && (byte >= 0xa5 || model === "128k")) {
      const keyword = SINCLAIR_KEYWORDS[byte - 0xa3]!;
      text += `${text.endsWith(" ") ? "" : " "}${keyword} `;
      if (byte === TOKEN_REM) rem = true;
      bin = byte === TOKEN_BIN;
      digits = "";
      continue;
    }
    if (byte === 0x22) quoted = !quoted;
    if (byte >= 0x90 && byte <= 0xa4) text += `{UDG ${String.fromCharCode(0x41 + byte - 0x90)}}`;
    else if (byte === 0x60) text += "£";
    else if (byte === 0x7f) text += "©";
    else if (byte === 0x5e) text += "↑";
    else if (byte === 0x06) text += ",";
    else if (byte >= 0x20 && byte < 0x80) text += String.fromCharCode(byte);
    else text += `{$${byte.toString(16).padStart(2, "0")}}`;
    if ((byte >= 0x30 && byte <= 0x39) || byte === 0x2e || byte === 0x45 || byte === 0x65) digits += String.fromCharCode(byte);
    else if (byte !== 0x20) {
      digits = "";
      if (!(bin && (byte === 0x30 || byte === 0x31))) bin = false;
    }
  }
  return text.replace(/ +$/, "");
}

/**
 * What a program hands over to machine code or memory: USR with a value that
 * the text gives (a number, or VAL with a string of digits), USR with another
 * argument, CLEAR with a value (the top of BASIC), and LOAD "" CODE or SCREEN$
 * (with the address when the text gives one), and a POKE of ERR_SP (23613 or
 * 23614): the error return of BASIC then goes to an address that the program
 * puts there, so an error or the end of the BASIC starts machine code. Not in
 * strings or REM.
 */
export type SinclairHandoff =
  | { kind: "usr"; line: number; address: number }
  | { kind: "usr"; line: number; computed: true }
  | { kind: "err-sp"; line: number }
  | { kind: "clear"; line: number; address: number }
  | { kind: "load-code"; line: number; address?: number }
  | { kind: "load-screen"; line: number };

/** The value of the argument at `at`: a number with its 5-byte form, VAL "digits", in brackets or not. */
function constantArgument(bytes: Uint8Array, at: number): number | undefined {
  while (bytes[at] === 0x20 || bytes[at] === 0x28) at++;
  if (bytes[at] === TOKEN_VAL) {
    at++;
    while (bytes[at] === 0x20) at++;
    if (bytes[at] !== 0x22) return undefined;
    const close = bytes.indexOf(0x22, at + 1);
    if (close < 0) return undefined;
    const value = Number(String.fromCharCode(...bytes.subarray(at + 1, close)).trim());
    return Number.isFinite(value) ? value : undefined;
  }
  const start = at;
  while (at < bytes.length && ((bytes[at]! >= 0x30 && bytes[at]! <= 0x39) || bytes[at] === 0x2e)) at++;
  if (at === start || bytes[at] !== NUMBER_MARK || at + 6 > bytes.length) return undefined;
  return sinclairNumber(bytes.subarray(at + 1, at + 6));
}

export function findSinclairHandoffs(lines: SinclairLine[]): SinclairHandoff[] {
  const handoffs: SinclairHandoff[] = [];
  const address = (value: number | undefined) => (value !== undefined && Math.trunc(value) >= 0 && Math.trunc(value) <= 0xffff ? Math.trunc(value) : undefined);
  for (const { number, bytes } of lines) {
    let quoted = false;
    for (let at = 0; at < bytes.length; at++) {
      const byte = bytes[at]!;
      if (byte === NUMBER_MARK) {
        at += 5;
        continue;
      }
      if (byte === 0x22) quoted = !quoted;
      if (quoted) continue;
      if (byte === TOKEN_REM) break;
      if (byte === TOKEN_USR) {
        const value = address(constantArgument(bytes, at + 1));
        handoffs.push(value === undefined ? { kind: "usr", line: number, computed: true } : { kind: "usr", line: number, address: value });
      } else if (byte === TOKEN_POKE) {
        // POKE rounds its address, as FIND-INT2 of the ROM does.
        const value = constantArgument(bytes, at + 1);
        if (value !== undefined && (Math.round(value) === ERR_SP || Math.round(value) === ERR_SP + 1)) handoffs.push({ kind: "err-sp", line: number });
      } else if (byte === TOKEN_CLEAR) {
        const value = address(constantArgument(bytes, at + 1));
        if (value !== undefined) handoffs.push({ kind: "clear", line: number, address: value });
      } else if (byte === TOKEN_LOAD) {
        // LOAD "name" CODE [address[,length]] or LOAD "name" SCREEN$, up to the end of the statement.
        let end = at + 1;
        while (end < bytes.length && bytes[end] !== 0x3a) end += bytes[end] === NUMBER_MARK ? 6 : 1;
        const statement = bytes.subarray(at + 1, end);
        const code = statement.indexOf(TOKEN_CODE);
        if (statement.includes(TOKEN_SCREEN)) handoffs.push({ kind: "load-screen", line: number });
        else if (code >= 0) {
          const value = address(constantArgument(statement, code + 1));
          handoffs.push(value === undefined ? { kind: "load-code", line: number } : { kind: "load-code", line: number, address: value });
        }
      }
    }
  }
  return handoffs;
}
