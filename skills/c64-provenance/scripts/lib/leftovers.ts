// Leftovers in one program for the c64-provenance script: text in PETSCII,
// screen codes, ASCII or text with bit 7 set (Apple II), assembler source
// lines, BASIC lines away from the BASIC start, fills, untouched
// bytes outside code regions that no other finding explains, exact copies of
// a byte range, and code that no call or jump reaches and no run executed. Each finding gets the stages and the accesses of
// its bytes from the separation. Evidence only: nothing here decides what a
// leftover is or who made it.

import { type AddressRange, basicLineText } from "#src/c64.ts";
import { MNEMONICS } from "#src/opcodes.ts";
import type { Access, Separation } from "#src/knowledge/separate.ts";

export interface LeftoversInput {
  segments: AddressRange[];
  /** 64 KiB with the program bytes at their addresses. */
  memory: Uint8Array;
  separation: Separation;
  /** The first address of the BASIC start, which RUN lists: it is no leftover. */
  basicStart?: number;
  /** The fewest characters of a text (default 8). */
  minText?: number;
}

/** What the separation tells about the bytes of a finding. */
export interface Placement {
  /** The stages that wrote bytes of the finding, absent when no stage did. */
  stages?: number[];
  /** The accesses of its bytes in the coverage, absent without coverage. */
  access?: Access[];
}

/** high-bit is text with bit 7 set: ASCII as the Apple II keeps it, or C64 shifted letters with $a0 spaces. Its spaces can also be $20. */
export type TextEncoding = "petscii" | "screen" | "ascii" | "high-bit";

export interface TextFinding extends AddressRange, Placement {
  encoding: TextEncoding;
  /** Screen codes with bit 7 set: the characters show reversed. */
  reversed?: boolean;
  /** The text; a line end is "\n". */
  text: string;
  /** Lines of assembler source: most lines are an instruction, a data directive or a comment. */
  source?: true;
  /** Words that are 6502 mnemonics before an operand or a line end. */
  mnemonics?: number;
}

export interface BasicFinding extends AddressRange, Placement {
  /** The address of the first line where the links put it: where the lines were when BASIC linked them. */
  linkedAt: number;
  lines: string[];
}

export interface FillFinding extends AddressRange, Placement {
  pattern: number[];
}

/** Untouched bytes that are no text, BASIC, fill or code region. */
export type ResidueFinding = AddressRange & Placement;

export interface CopyFinding extends AddressRange, Placement {
  /** The first address of the same bytes earlier in the program. */
  copyOf: number;
}

/** A code region that no call or jump reaches from the entry, and that no run executed. */
export interface DeadCodeFinding extends AddressRange, Placement {
  type: string;
  /** false when the coverage shows that it did not run; absent without coverage. */
  executed?: false;
}

export interface Leftovers {
  text: TextFinding[];
  basic: BasicFinding[];
  fill: FillFinding[];
  residue: ResidueFinding[];
  copies: CopyFinding[];
  deadCode: DeadCodeFinding[];
}

const MIN_TEXT = 8;
/** A fill of one byte has at least this many bytes; a pattern of two to four bytes twice this many. */
const MIN_FILL = 16;
const MIN_RESIDUE = 16;
const MIN_COPY = 32;
/** A copy has at least this many different byte values in its first MIN_COPY bytes: no table of a few values. */
const MIN_COPY_VALUES = 8;
const MAX_BASIC_LINE = 63999;

/** A character of a text, and its letter class: "a" is one case, "b" the other. */
interface Character {
  /** The character when the class "b" is absent from the run. */
  plain: string;
  /** The character when the run has class "b": the second character set. */
  mixed: string;
  letter?: "a" | "b";
  /** A line end. */
  end?: true;
}

const LINE_END: Character = { plain: "\n", mixed: "\n", end: true };

/**
 * PETSCII: $41-$5a is class a, the shifted letters $c1-$da class b. The
 * copies $61-$7a are no letters here: text seldom uses them, and a stray one
 * in front of a text would put the text in the second character set.
 */
function petsciiCharacter(byte: number): Character | undefined {
  if (byte >= 0x41 && byte <= 0x5a) {
    const upper = String.fromCharCode(byte);
    return { plain: upper, mixed: upper.toLowerCase(), letter: "a" };
  }
  if (byte >= 0xc1 && byte <= 0xda) {
    const upper = String.fromCharCode(byte - 0x80);
    return { plain: upper, mixed: upper, letter: "b" };
  }
  const sign = byte >= 0x20 && byte <= 0x40 ? String.fromCharCode(byte) : { 0x5b: "[", 0x5c: "£", 0x5d: "]", 0x5e: "↑", 0x5f: "←" }[byte];
  return sign === undefined ? undefined : { plain: sign, mixed: sign };
}

/** Screen codes: $01-$1a is class a, $41-$5a (the upper case of the second set) class b. $00 ends a text: it is a common end mark. */
function screenCharacter(byte: number): Character | undefined {
  if (byte >= 0x01 && byte <= 0x1a) {
    const upper = String.fromCharCode(byte + 0x40);
    return { plain: upper, mixed: upper.toLowerCase(), letter: "a" };
  }
  if (byte >= 0x41 && byte <= 0x5a) {
    const upper = String.fromCharCode(byte);
    return { plain: upper, mixed: upper, letter: "b" };
  }
  const sign = byte >= 0x20 && byte <= 0x3f ? String.fromCharCode(byte) : { 0x1b: "[", 0x1c: "£", 0x1d: "]", 0x1e: "↑", 0x1f: "←" }[byte];
  return sign === undefined ? undefined : { plain: sign, mixed: sign };
}

/** ASCII: small letters are class a, capitals class b, and each shows as it is. $0a and $0d end a line. */
function asciiCharacter(byte: number): Character | undefined {
  if (byte === 0x0a || byte === 0x0d) return LINE_END;
  if (byte < 0x20 || byte > 0x7e) return undefined;
  const character = String.fromCharCode(byte);
  return { plain: character, mixed: character, ...(byte >= 0x61 && byte <= 0x7a ? { letter: "a" as const } : byte >= 0x41 && byte <= 0x5a ? { letter: "b" as const } : {}) };
}

/** ASCII with bit 7 set: $8d ends a line, and $20 is a space too, as in the comments of Apple II assembler source. */
function highAsciiCharacter(byte: number): Character | undefined {
  if (byte === 0x8d) return LINE_END;
  if (byte === 0x20) return { plain: " ", mixed: " " };
  return byte >= 0xa0 && byte <= 0xfe ? asciiCharacter(byte - 0x80) : undefined;
}

/** PETSCII with $0d as a line end. */
function petsciiOrLineEnd(byte: number): Character | undefined {
  return byte === 0x0d ? LINE_END : petsciiCharacter(byte);
}

const COMMON_SIGNS = /[ 0-9.,!?:;'"()\-/&+*=#$%]/;
const VOWELS = /[AEIOUY]/i;

/**
 * Whether a run of characters reads as text: enough letters, at most one odd
 * sign, a word of three letters, each word in one case or a capital and then
 * small letters, and vowels in the words. Bytes of code or data seldom pass
 * all of these. Characters that count up or repeat in a short pattern are a
 * character map of a screen, not text.
 */
function readsAsText(characters: Character[], min: number): boolean {
  if (characters.length < min) return false;
  const letters = characters.filter((character) => character.letter !== undefined);
  if (letters.length < 4) return false;
  if (characters.filter((character) => character.letter === undefined && !COMMON_SIGNS.test(character.plain)).length > 1) return false;
  if (new Set(characters.map((character) => character.plain)).size < 4) return false;
  if (letters.filter((character) => VOWELS.test(character.plain)).length < letters.length * 0.2) return false;
  const codes = characters.map((character) => character.plain.charCodeAt(0));
  const pairs = codes.length - 1;
  if (codes.slice(1).filter((code, index) => code === codes[index]! + 1).length >= pairs / 2) return false;
  for (let period = 2; period <= 4; period++) if (codes.slice(period).filter((code, index) => code === codes[index]).length >= (codes.length - period) / 2) return false;
  let longest = 0;
  let word: Character[] = [];
  const wordFits = () => {
    const rest = word.slice(1);
    const sameCase = rest.every((character) => character.letter === word[0]!.letter) || (word[0]!.letter === "b" && rest.every((character) => character.letter === "a"));
    return sameCase && (word.length < 4 || word.some((character) => VOWELS.test(character.plain)));
  };
  for (const character of [...characters, { plain: " ", mixed: " " } as Character]) {
    if (character.letter !== undefined) {
      word.push(character);
      continue;
    }
    if (word.length > 0 && !wordFits()) return false;
    longest = Math.max(longest, word.length);
    word = [];
  }
  return longest >= 3;
}

/** The undocumented opcodes: words such as LAX or ISC in a text are seldom source. */
const UNDOCUMENTED = new Set(["jam", "slo", "rla", "sre", "rra", "sax", "lax", "dcp", "isc", "anc", "asr", "arr", "ane", "sha", "tas", "shy", "shx", "lxa", "las", "sbx"]);

/** Counts the words that are a documented 6502 mnemonic followed by an operand sign or the end of the text. */
function mnemonicCount(text: string): number {
  return [...text.toLowerCase().matchAll(/(?:^|[^a-z])([a-z]{3})(?= ?[#$(<>%]| *$)/g)].filter((match) => MNEMONICS.has(match[1]!) && !UNDOCUMENTED.has(match[1]!)).length;
}

const DIRECTIVES = ["dfb", "db", "dw", "ddb", "dc", "dcb", "ds", "dfs", "byte", "word", "hex", "asc", "dci", "str", "txt", "text", "org", "equ", "epz", "end"];

/** A line of assembler source: a comment, or an optional label and then an instruction or a data directive. */
function sourceLine(line: string): boolean {
  if (/^[*;]/.test(line)) return true;
  const words = line.toLowerCase().split(/\s+/);
  const first = words[0]!.replace(/^[.!]/, "");
  const second = (words[1] ?? "").replace(/^[.!]/, "");
  const known = (word: string) => (MNEMONICS.has(word) && !UNDOCUMENTED.has(word)) || DIRECTIVES.includes(word);
  return known(first) || (/^[a-z_][\w.]*:?$/.test(first) && known(second));
}

/** Whether the bytes of a run show the encoding and no other one: the other scans report the rest. */
function ownEncoding(encoding: TextEncoding, bytes: number[], characters: Character[]): boolean {
  if (encoding === "screen") return characters.some((character) => character.letter === "a");
  // ASCII text is in capitals, or mostly in small letters: a few small letters are stray bytes at the edges of another text.
  const letters = characters.filter((character) => character.letter !== undefined).length;
  const small = characters.filter((character) => character.letter === "a").length;
  if (small > 0 && small * 2 < letters) return false;
  // Capitals and signs alone are PETSCII too.
  if (encoding === "ascii") return bytes.some((byte) => byte >= 0x61 && byte <= 0x7a);
  // Shifted letters alone are PETSCII too: a space, a digit or a sign with bit 7 shows ASCII.
  if (encoding === "high-bit") return bytes.some((byte) => byte >= 0xa0 && byte <= 0xc0);
  return true;
}

/** The runs of one encoding in a segment that read as text. `reversed` reads the bytes with bit 7 set, without that bit. */
function textRuns(memory: Uint8Array, segment: AddressRange, encoding: TextEncoding, reversed: boolean, min: number): TextFinding[] {
  const decode = { petscii: petsciiOrLineEnd, screen: screenCharacter, ascii: asciiCharacter, "high-bit": highAsciiCharacter }[encoding];
  const found: TextFinding[] = [];
  let run: Array<{ address: number; character: Character }> = [];
  const solid = (character: Character) => character.letter !== undefined || /[0-9]/.test(character.plain);
  /** Reports a piece of the run as text, from its first to its last solid character, when it reads as text. */
  const report = (piece: typeof run, asSource: boolean) => {
    let first = 0;
    let last = piece.length - 1;
    const edge = asSource ? (character: Character) => character.end !== true && character.plain.trim() !== "" : solid;
    while (first <= last && !edge(piece[first]!.character)) first++;
    while (last >= first && !edge(piece[last]!.character)) last--;
    const kept = piece.slice(first, last + 1);
    const characters = kept.map((item) => item.character);
    if (!(asSource ? characters.length >= min : readsAsText(characters, min))) return;
    if (!ownEncoding(encoding, kept.map((item) => memory[item.address]!), characters)) return;
    const mixed = encoding !== "ascii" && encoding !== "high-bit" && characters.some((character) => character.letter === "b");
    const text = characters.map((character) => (mixed ? character.mixed : character.plain)).join("");
    const mnemonics = mnemonicCount(text);
    found.push({ start: kept[0]!.address, end: kept.at(-1)!.address, encoding, ...(reversed ? { reversed } : {}), text, ...(asSource ? { source: true as const } : {}), ...(mnemonics > 0 ? { mnemonics } : {}) });
  };
  const close = () => {
    const lines = run.map((item) => item.character.plain).join("").split("\n").map((line) => line.trim()).filter((line) => line !== "");
    const source = lines.filter(sourceLine).length;
    if (lines.length >= 2 && source >= 2 && source * 2 >= lines.length) report(run, true);
    else {
      // Not source: each line is a text of its own.
      let piece: typeof run = [];
      for (const item of [...run, { address: -1, character: LINE_END }]) {
        if (item.character.end !== true) piece.push(item);
        else {
          report(piece, false);
          piece = [];
        }
      }
    }
    run = [];
  };
  for (let address = segment.start; address <= segment.end; address++) {
    const byte = memory[address]!;
    const character = reversed ? (byte & 0x80 ? decode(byte & 0x7f) : undefined) : byte & 0x80 && encoding === "screen" ? undefined : decode(byte);
    if (character === undefined) close();
    else run.push({ address, character });
  }
  close();
  return found;
}

export function findText(memory: Uint8Array, segments: AddressRange[], min = MIN_TEXT): TextFinding[] {
  const scan = (encoding: TextEncoding, reversed = false) => segments.flatMap((segment) => textRuns(memory, segment, encoding, reversed, min));
  // A run that is mostly a run of an earlier list is the same text, read in another encoding, with stray bytes at its edges.
  const overlap = (a: AddressRange, b: AddressRange) => Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start) + 1);
  const kept: TextFinding[] = [];
  for (const list of [[...scan("high-bit"), ...scan("ascii")], scan("petscii"), [...scan("screen"), ...scan("screen", true)]]) {
    kept.push(...list.filter((run) => !kept.some((other) => overlap(run, other) * 2 > run.end - run.start + 1)));
  }
  return kept.sort((a, b) => a.start - b.start);
}

/** Whether tokenized BASIC bytes hold only keywords, signs, digits and letters outside quotes. */
function tokensFit(tokens: Uint8Array): boolean {
  let literal = false;
  for (const byte of tokens) {
    if (byte === 0x22) literal = !literal;
    else if (!literal && !(byte >= 0x20 && byte <= 0x5d) && !(byte >= 0x80 && byte <= 0xcb) && byte !== 0xff) return false;
  }
  return true;
}

/**
 * BASIC lines with links that agree with each other: the distance between two
 * links is the length of a line. Two lines or more, each with a keyword, make
 * a finding. The links give the address where BASIC put the lines, which can
 * be another address than where they are now.
 */
export function findBasic(memory: Uint8Array, segments: AddressRange[], basicStart?: number): BasicFinding[] {
  const found: BasicFinding[] = [];
  for (const segment of segments) {
    const word = (at: number) => memory[at]! | (memory[at + 1]! << 8);
    /** The line at `at`: its number, its tokens and the address after its end zero, or undefined. */
    const lineAt = (at: number) => {
      if (at + 4 > segment.end) return undefined;
      const number = word(at + 2);
      if (number > MAX_BASIC_LINE) return undefined;
      let end = at + 4;
      while (end <= segment.end && end - at <= 255 && memory[end] !== 0) end++;
      if (end > segment.end || memory[end] !== 0 || end === at + 4) return undefined;
      const tokens = memory.slice(at + 4, end);
      return tokensFit(tokens) ? { number, tokens, next: end + 1 } : undefined;
    };
    for (let at = segment.start; at + 4 <= segment.end; at++) {
      const first = lineAt(at);
      if (first === undefined || (memory[at + 1] ?? 0) === 0) continue;
      const linkedAt = word(at) - (first.next - at);
      if (linkedAt < 0x0400) continue;
      const lines = [first];
      let link = word(at);
      let next = first.next;
      for (;;) {
        if (next + 1 > segment.end || memory[next + 1] === 0) break;
        const line = lineAt(next);
        if (line === undefined || line.number <= lines.at(-1)!.number || word(next) - link !== line.next - next) break;
        lines.push(line);
        link = word(next);
        next = line.next;
      }
      const endMark = next + 1 <= segment.end && memory[next] === 0 && memory[next + 1] === 0;
      if (lines.length < 2 || !lines.every((line) => line.tokens.some((byte) => byte >= 0x80 && byte <= 0xcb))) continue;
      if (at === basicStart && linkedAt === basicStart) {
        at = next - 1;
        continue;
      }
      found.push({ start: at, end: endMark ? next + 1 : next - 1, linkedAt, lines: lines.map(basicLineText) });
      at = endMark ? next + 1 : next - 1;
    }
  }
  return found;
}

/** Runs of one byte of at least MIN_FILL bytes, and runs of a pattern of two to four bytes of at least twice that. */
export function findFills(memory: Uint8Array, segments: AddressRange[]): FillFinding[] {
  const found: FillFinding[] = [];
  for (const segment of segments) {
    for (let at = segment.start; at <= segment.end; ) {
      let best = { period: 0, length: 0 };
      for (let period = 1; period <= 4; period++) {
        let end = at + period;
        while (end <= segment.end && memory[end] === memory[end - period]) end++;
        const length = end - at;
        const pattern = memory.subarray(at, at + period);
        // A pattern that is one byte repeated is the fill of period 1.
        if (period > 1 && pattern.every((byte) => byte === pattern[0])) continue;
        if (length >= (period === 1 ? MIN_FILL : 2 * MIN_FILL) && length > best.length) best = { period, length };
      }
      if (best.length === 0) {
        at++;
        continue;
      }
      found.push({ start: at, end: at + best.length - 1, pattern: [...memory.subarray(at, at + best.period)] });
      at += best.length;
    }
  }
  return found;
}

/** Exact copies of at least MIN_COPY bytes of an earlier range, with enough different byte values to be no fill. */
export function findCopies(memory: Uint8Array, segments: AddressRange[]): CopyFinding[] {
  const found: CopyFinding[] = [];
  const seen = new Map<string, number>();
  const inside = (address: number) => segments.some((segment) => address >= segment.start && address <= segment.end);
  for (const segment of segments) {
    for (let at = segment.start; at + MIN_COPY - 1 <= segment.end; at++) {
      const window = memory.subarray(at, at + MIN_COPY);
      if (new Set(window).size < MIN_COPY_VALUES) continue;
      const key = Buffer.from(window).toString("latin1");
      const earlier = seen.get(key);
      if (earlier === undefined) {
        seen.set(key, at);
        continue;
      }
      let length = MIN_COPY;
      while (at + length <= segment.end && inside(earlier + length) && memory[at + length] === memory[earlier + length]) length++;
      found.push({ start: at, end: at + length - 1, copyOf: earlier });
      // The windows of the copy stay unseen: a later copy points to the first range, not to this one.
      at += length - 1;
    }
  }
  return found;
}

/** Splits `range` at the parts that `taken` covers, and keeps the pieces of at least `min` bytes. */
function without(range: AddressRange, taken: AddressRange[], min: number): AddressRange[] {
  const pieces: AddressRange[] = [];
  let start = range.start;
  for (const part of taken.filter((item) => item.start <= range.end && item.end >= range.start).sort((a, b) => a.start - b.start)) {
    if (part.start > start) pieces.push({ start, end: part.start - 1 });
    start = Math.max(start, part.end + 1);
  }
  if (start <= range.end) pieces.push({ start, end: range.end });
  return pieces.filter((piece) => piece.end - piece.start + 1 >= min);
}

export function findLeftovers(input: LeftoversInput): Leftovers {
  const { memory, segments, separation } = input;
  const ranges = separation.ranges;
  const placement = (range: AddressRange): Placement => {
    const parts = ranges.filter((part) => part.start <= range.end && part.end >= range.start);
    const stages = [...new Set(parts.flatMap((part) => (part.stage === undefined ? [] : [part.stage])))].sort((a, b) => a - b);
    const access = [...new Set(parts.flatMap((part) => (part.access === undefined ? [] : [part.access])))];
    return { ...(stages.length === 0 ? {} : { stages }), ...(access.length === 0 ? {} : { access }) };
  };
  const placed = <T extends AddressRange>(items: T[]) => items.map((item) => ({ ...item, ...placement(item) }));

  const text = findText(memory, segments, input.minText);
  const basic = findBasic(memory, segments, input.basicStart);
  const fill = findFills(memory, segments);
  // Untouched bytes that no other finding explains.
  const untouched: AddressRange[] = [];
  for (const part of ranges) {
    if (part.access !== "untouched") continue;
    const last = untouched.at(-1);
    if (last !== undefined && last.end + 1 === part.start) last.end = part.end;
    else untouched.push({ start: part.start, end: part.end });
  }
  // Untouched code is code that the runs did not get to, or dead code, which has its own list.
  const explained = [...text, ...basic, ...fill, ...separation.codeRegions];
  const residue = untouched.flatMap((range) => without(range, explained, MIN_RESIDUE));
  // The references miss IRQ vectors and jumps through tables: code that ran is not dead.
  const deadCode: DeadCodeFinding[] = separation.codeRegions
    .filter((region) => region.reachable === false && region.executed !== true)
    .map((region) => ({ start: region.start, end: region.end, type: region.type, ...(region.executed === false ? { executed: false as const } : {}) }));
  return { text: placed(text), basic: placed(basic), fill: placed(fill), residue: placed(residue), copies: placed(findCopies(memory, segments)), deadCode: placed(deadCode) };
}
