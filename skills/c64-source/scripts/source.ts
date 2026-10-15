// ACME source from an image, current knowledge and Ghidra's instruction
// boundaries (D48). The same input gives the same text. Names come from
// knowledge; a target that knowledge does not name gets l_xxxx. Data is
// written by its region type. The source assembles to the same bytes: the
// generator forces operand sizes, and writes an opcode form that ACME
// encodes differently as bytes (see the probe in generate.ts).

import { COVERAGE, formatC64Address } from "#src/c64.ts";
import { WireFailure } from "#src/host-client/tools.ts";
import { ANALYZERS } from "#src/knowledge/import.ts";
import { isGeneratedFile, type CommentPlacement, type Origin, type RegionType } from "#src/knowledge/schema.ts";
import { hasZeroPageForm, MNEMONICS, MODE_LENGTH, OPCODES, takesAddress, type Mode } from "./opcodes.ts";

export interface Range {
  start: number;
  end: number;
}

export interface SourceInput {
  /** In address order, without overlap. */
  segments: Range[];
  /** The image byte at an address inside a segment. */
  byteAt: (address: number) => number;
  entry?: number;
  /** Where Ghidra decoded an instruction, with its length. */
  instructions: ReadonlyMap<number, number>;
  /** Without an origin, a symbol counts as a user or LLM name. */
  symbols: ReadonlyArray<{ address: number; name: string; origin?: Origin }>;
  regions: ReadonlyArray<{ start: number; end: number; type: RegionType; element?: number }>;
  comments: ReadonlyArray<{ address: number; placement: CommentPlacement; text: string }>;
  modules: ReadonlyArray<{ start: number; file: string; title?: string }>;
  /** Targets of knowledge references: each one inside the image gets a label. */
  referenceTargets: readonly number[];
  /** Joined coverage files (D40): an instruction that no run executed is marked (D49). */
  coverage?: Uint8Array;
  /** Platform names (D52): the name of an address that knowledge does not name, and the last address of its entry. */
  platform?: ReadonlyArray<{ address: number; end: number; name: string }>;
}

const CODE_TYPES: readonly RegionType[] = ["code", "jumps", "dual-use"];
const BYTES_PER_LINE = 8;
const WORDS_PER_LINE = 4;
const CHARS_PER_LINE = 32;
const MIN_FILL = 16;
const SIDE_COLUMN = 40;
const INDENT = "        ";

type Region = SourceInput["regions"][number];

interface InstructionItem {
  kind: "instruction";
  address: number;
  length: number;
  opcode: number;
}

interface DataItem {
  kind: "data";
  start: number;
  end: number;
  /** The region type, or unclassified. In a code region, bytes that Ghidra did not decode. */
  type: RegionType | "unclassified" | "undecoded";
  region?: Region;
}

type Item = InstructionItem | DataItem;

export interface Piece {
  start: number;
  end: number;
  file: string;
  title: string;
  /** True when the piece starts a segment: the source sets the address there. */
  segmentStart: boolean;
  items: Item[];
}

export interface Layout {
  pieces: Piece[];
  /** Names of addresses: inside the image a label, outside it a constant. */
  names: Map<number, string>;
  /** Addresses outside the image that the source names, as constants. */
  constants: number[];
  inImage: (address: number) => boolean;
  byteAt: (address: number) => number;
  comments: SourceInput["comments"];
  coverage?: Uint8Array;
  generatedLabels: number;
  namedLabels: number;
  unusedModules: Array<{ start: number; file: string }>;
}

const hex2 = (value: number) => `$${value.toString(16).padStart(2, "0")}`;
const hex4 = (value: number) => formatC64Address(value);
/** ACME reads leading zeros as a 16-bit value, so a zero-page name gets two digits. */
const constantValue = (address: number) => (address < 0x100 ? hex2(address) : hex4(address));
const signed = (byte: number) => (byte < 0x80 ? byte : byte - 0x100);

function operandValue(address: number, opcode: number, byteAt: (address: number) => number): number | undefined {
  const { mode } = OPCODES[opcode]!;
  const low = MODE_LENGTH[mode] >= 2 ? byteAt(address + 1) : 0;
  if (mode === "imp") return undefined;
  if (mode === "rel") return (address + 2 + signed(low)) & 0xffff;
  if (MODE_LENGTH[mode] === 3) return low | (byteAt(address + 2) << 8);
  return low;
}

/**
 * Each entry point inside a data region of the knowledge, with that region.
 * A data region wins over an entry (D44, D48): Ghidra does not decode there,
 * and the source has data there. A code region in the knowledge changes that (F-27).
 */
export function entriesInData<R extends { start: number; end: number; type: RegionType }>(entries: readonly number[], regions: readonly R[]): Array<{ entry: number; region: R }> {
  return entries.flatMap((entry) => {
    const region = regions.find((row) => entry >= row.start && entry <= row.end && !CODE_TYPES.includes(row.type));
    return region === undefined ? [] : [{ entry, region }];
  });
}

/** Why an image without its entry fails: the image does not hold the program (R2-02). Undefined when the entry is in a segment, or the image has no entry. */
export function entryOutsideImage(entry: number | undefined, segments: readonly Range[]): string | undefined {
  if (entry === undefined || segments.some((segment) => entry >= segment.start && entry <= segment.end)) return undefined;
  return `The entry ${hex4(entry)} is in no segment of the image: the image does not hold the program. Capture it again with c64-unpacker loads or capture.`;
}

/** Splits the segments into pieces at module starts and lays out instructions and data. */
export function layout(input: SourceInput): Layout {
  const inImage = (address: number) => input.segments.some((segment) => address >= segment.start && address <= segment.end);
  const regionAt = (address: number) => input.regions.find((region) => address >= region.start && address <= region.end);
  const isData = (address: number) => {
    const region = regionAt(address);
    return region !== undefined && !CODE_TYPES.includes(region.type);
  };

  for (const module of input.modules) {
    if (isGeneratedFile(module.file)) throw new WireFailure("invalid-input", `The module at ${hex4(module.start)} has the file ${module.file}, which the generator writes itself. Give the module another file.`);
  }
  const modules = [...input.modules].sort((a, b) => a.start - b.start);
  const unusedModules = modules.filter((module) => !inImage(module.start)).map(({ start, file }) => ({ start, file }));

  const pieces: Piece[] = [];
  for (const segment of input.segments) {
    const starts = modules.filter((module) => module.start > segment.start && module.start <= segment.end).map((module) => module.start);
    const bounds = [segment.start, ...starts, segment.end + 1];
    for (let index = 0; index + 1 < bounds.length; index++) {
      const start = bounds[index]!;
      const end = bounds[index + 1]! - 1;
      const module = modules.find((row) => row.start === start);
      const file = module?.file ?? `segment_${start.toString(16).padStart(4, "0")}.asm`;
      const title = module?.title?.replace(/\s*\r?\n\s*/g, " ") ?? `Segment ${hex4(segment.start)}-${hex4(segment.end)}`;
      pieces.push({ start, end, file, title, segmentStart: index === 0, items: [] });
    }
  }
  const files = new Map<string, number>();
  for (const piece of pieces) {
    const other = files.get(piece.file);
    if (other !== undefined) throw new WireFailure("invalid-input", `The file ${piece.file} is used at ${hex4(other)} and at ${hex4(piece.start)}. Give the module another file.`);
    files.set(piece.file, piece.start);
  }

  for (const piece of pieces) {
    let address = piece.start;
    while (address <= piece.end) {
      const region = regionAt(address);
      const codeRegion = region !== undefined && CODE_TYPES.includes(region.type);
      const length = input.instructions.get(address);
      const opcode = input.byteAt(address);
      const fits =
        length !== undefined &&
        (codeRegion || region === undefined) &&
        MODE_LENGTH[OPCODES[opcode]!.mode] === length &&
        address + length - 1 <= piece.end &&
        Array.from({ length }, (_, offset) => address + offset).every((at) => !isData(at));
      if (fits) {
        piece.items.push({ kind: "instruction", address, length: length!, opcode });
        address += length!;
        continue;
      }
      // A data run: one region, or unclassified bytes up to the next decoded instruction.
      const type: DataItem["type"] = codeRegion ? "undecoded" : (region?.type ?? "unclassified");
      let end = address;
      const same = (at: number) => {
        if (at > piece.end) return false;
        const next = regionAt(at);
        if (region !== undefined && !codeRegion) return next === region;
        if (codeRegion) return next === region && !input.instructions.has(at);
        return next === undefined && !input.instructions.has(at);
      };
      while (same(end + 1)) end++;
      const last = piece.items.at(-1);
      if (last?.kind === "data" && last.type === type && last.region === region && last.end + 1 === address) last.end = end;
      else piece.items.push({ kind: "data", start: address, end, type, ...(region === undefined ? {} : { region }) });
      address = end + 1;
    }
  }

  // Labels: every address inside the image that an operand, a table, a symbol, a reference or the entry names.
  const wanted = new Set<number>();
  const want = (address: number) => inImage(address) && wanted.add(address);
  const outside = new Set<number>();
  // A platform name that knowledge gives to another address, or that reads as an instruction, is not used.
  const knowledgeNames = new Set(input.symbols.map((symbol) => symbol.name));
  const platform = new Map((input.platform ?? []).filter(({ name }) => !knowledgeNames.has(name) && !MNEMONICS.has(name.toLowerCase())).map(({ address, name }) => [address, name]));
  // An analyzer name (DXA's ld020) gives way to the platform name (EXTCOL); a user or LLM name wins (D61).
  const isAnalyzer = (origin: Origin | undefined) => (ANALYZERS as readonly (Origin | undefined)[]).includes(origin);
  const symbols = new Map(input.symbols.filter((symbol) => !(isAnalyzer(symbol.origin) && platform.has(symbol.address))).map((symbol) => [symbol.address, symbol.name]));
  /** Addresses outside the image without a name of their own, inside a named platform entry of more bytes: the start of that entry (F-20). */
  const insideEntry = new Map<number, number>();
  const use = (address: number) => {
    if (inImage(address)) wanted.add(address);
    else if (symbols.has(address) || platform.has(address)) outside.add(address);
    else {
      const entry = input.platform?.find((row) => address > row.address && address <= row.end && !inImage(row.address) && (symbols.has(row.address) || platform.has(row.address)));
      if (entry === undefined) return;
      outside.add(entry.address);
      insideEntry.set(address, entry.address);
    }
  };
  for (const piece of pieces) {
    for (const item of piece.items) {
      if (item.kind === "instruction") {
        if (takesAddress(OPCODES[item.opcode]!.mode)) use(operandValue(item.address, item.opcode, input.byteAt)!);
        continue;
      }
      for (const pointer of pointersOf(item, input.byteAt)) use(pointer);
    }
  }
  for (const symbol of input.symbols) want(symbol.address);
  for (const target of input.referenceTargets) want(target);
  if (input.entry !== undefined) want(input.entry);

  const names = new Map<number, string>();
  const taken = new Set([...knowledgeNames, ...platform.values()]);
  let generatedLabels = 0;
  let namedLabels = 0;
  for (const address of [...wanted, ...outside].sort((a, b) => a - b)) {
    const known = symbols.get(address);
    if (known !== undefined) {
      if (MNEMONICS.has(known.toLowerCase())) throw new WireFailure("invalid-input", `The symbol ${known} at ${hex4(address)} has the name of an instruction, which ACME cannot read as a label. Rename the symbol with c64-knowledge.`);
      names.set(address, known);
      if (inImage(address)) namedLabels++;
      continue;
    }
    const named = platform.get(address);
    if (named !== undefined) {
      names.set(address, named);
      if (inImage(address)) namedLabels++;
      continue;
    }
    let name = `l_${address.toString(16).padStart(4, "0")}`;
    while (taken.has(name)) name = `${name}_`;
    taken.add(name);
    names.set(address, name);
    generatedLabels++;
  }
  // The high byte of a vector is NMINV+1. A zero-page entry keeps zero-page instructions: its constant has two digits.
  for (const [address, start] of insideEntry) names.set(address, `${names.get(start)!}+${address - start}`);
  return {
    pieces,
    names,
    constants: [...outside].sort((a, b) => a - b),
    inImage,
    byteAt: input.byteAt,
    comments: input.comments,
    ...(input.coverage === undefined ? {} : { coverage: input.coverage }),
    generatedLabels,
    namedLabels,
    unusedModules,
  };
}

/** The pointer region types: a table of addresses, or of addresses minus 1 for RTS. */
const POINTER_TYPES: ReadonlyArray<DataItem["type"]> = ["addresses", "addresses-split", "rts-addresses", "rts-addresses-split"];

/** The pairs of a pointer table: the address of each low and high byte, and the target it names. */
function pairsOf(region: Region, byteAt: (address: number) => number): Array<{ low: number; high: number; target: number }> {
  const length = region.end - region.start + 1;
  const split = region.type === "addresses-split" || region.type === "rts-addresses-split";
  const minus = region.type === "rts-addresses" || region.type === "rts-addresses-split" ? 1 : 0;
  const count = Math.floor(length / 2);
  return Array.from({ length: count }, (_, index) => {
    const low = split ? region.start + index : region.start + 2 * index;
    const high = split ? region.start + count + index : low + 1;
    return { low, high, target: ((byteAt(low) | (byteAt(high) << 8)) + minus) & 0xffff };
  });
}

function pointersOf(item: DataItem, byteAt: (address: number) => number): number[] {
  if (item.region === undefined || !POINTER_TYPES.includes(item.type)) return [];
  return pairsOf(item.region, byteAt)
    .filter((pair) => (pair.low >= item.start && pair.low <= item.end) || (pair.high >= item.start && pair.high <= item.end))
    .map((pair) => pair.target);
}

/** How an instruction is written: the text with a given operand expression, and the key of its opcode form for the probe. */
export interface InstructionForm {
  key: string;
  opcode: number;
  suffix: string;
}

/** The operand size suffix: +2 forces an absolute operand below $0100, +1 a zero-page operand that is a label of the image. */
export function formOf(layout: Pick<Layout, "inImage" | "byteAt">, item: InstructionItem): InstructionForm {
  const { mnemonic, mode } = OPCODES[item.opcode]!;
  const value = takesAddress(mode) ? operandValue(item.address, item.opcode, layout.byteAt)! : 0;
  let suffix = "";
  if ((mode === "abs" || mode === "abx" || mode === "aby") && value < 0x100 && hasZeroPageForm(mnemonic, mode)) suffix = "+2";
  if ((mode === "zp" || mode === "zpx" || mode === "zpy") && layout.inImage(value)) suffix = "+1";
  return { key: `${item.opcode.toString(16).padStart(2, "0")}${suffix}`, opcode: item.opcode, suffix };
}

/** The instruction text with an operand expression; the expression is a name or a $ number. */
export function instructionText(opcode: number, suffix: string, expression: string): string {
  const { mnemonic, mode } = OPCODES[opcode]!;
  const operand: Record<Mode, string> = {
    imp: "",
    imm: `#${expression}`,
    zp: expression,
    zpx: `${expression},x`,
    zpy: `${expression},y`,
    abs: expression,
    abx: `${expression},x`,
    aby: `${expression},y`,
    ind: `(${expression})`,
    izx: `(${expression},x)`,
    izy: `(${expression}),y`,
    rel: expression,
  };
  const text = operand[mode];
  return text === "" ? `${mnemonic}${suffix}` : `${mnemonic}${suffix} ${text}`;
}

/** The plain number of an operand: what the probe assembles, and what a comment shows. */
export function literalOperand(opcode: number, value: number): string {
  const { mode } = OPCODES[opcode]!;
  return MODE_LENGTH[mode] === 3 || mode === "rel" ? hex4(value) : hex2(value);
}

/** One instruction of each form, for the probe: the form, and the instruction bytes. */
export function probeForms(layout: Layout): Array<{ form: InstructionForm; bytes: number[] }> {
  const forms = new Map<string, { form: InstructionForm; bytes: number[] }>();
  for (const piece of layout.pieces) {
    for (const item of piece.items) {
      if (item.kind !== "instruction") continue;
      const form = formOf(layout, item);
      if (!forms.has(form.key)) forms.set(form.key, { form, bytes: Array.from({ length: item.length }, (_, offset) => layout.byteAt(item.address + offset)) });
    }
  }
  return [...forms.values()].sort((a, b) => (a.form.key < b.form.key ? -1 : 1));
}

// --- Data cells -------------------------------------------------------------

type Directive = "!byte" | "!word" | "!fill" | "!pet" | "!scr";

interface Cell {
  address: number;
  length: number;
  directive: Directive;
  /** The value text: an expression, a fill, or the characters of a string. */
  text: string;
}

/** PETSCII bytes that ACME's !pet writes from one source character. */
function petsciiChar(byte: number): string | undefined {
  if (byte >= 0x41 && byte <= 0x5a) return String.fromCharCode(byte + 0x20);
  if (byte >= 0xc1 && byte <= 0xda) return String.fromCharCode(byte - 0x80);
  if (byte >= 0x20 && byte <= 0x40 && byte !== 0x22) return String.fromCharCode(byte);
  if (byte === 0x5b || byte === 0x5d) return String.fromCharCode(byte);
  return undefined;
}

/** Screen codes that ACME's !scr writes from one source character. */
function screenChar(byte: number): string | undefined {
  if (byte === 0x00) return "@";
  if (byte >= 0x01 && byte <= 0x1a) return String.fromCharCode(byte + 0x60);
  if (byte >= 0x41 && byte <= 0x5a) return String.fromCharCode(byte);
  if (byte >= 0x20 && byte <= 0x3f && byte !== 0x22) return String.fromCharCode(byte);
  return undefined;
}

const FILL_TYPES: ReadonlyArray<DataItem["type"]> = ["bytes", "workspace", "unused", "unclassified", "bitmap"];

function cellsOf(item: DataItem, layout: Layout, breaks: Set<number>): Cell[] {
  const { byteAt } = layout;
  const cells: Cell[] = [];
  const name = (address: number) => layout.names.get(address);
  const expression = (target: number) => name(target) ?? hex4(target);
  const rtsExpression = (target: number) => (name(target) === undefined ? hex4((target - 1) & 0xffff) : `${name(target)}-1`);
  const byteCell = (address: number, text = hex2(byteAt(address))): Cell => ({ address, length: 1, directive: "!byte", text });

  if (item.region !== undefined && POINTER_TYPES.includes(item.type)) {
    const rts = item.type === "rts-addresses" || item.type === "rts-addresses-split";
    const split = item.type === "addresses-split" || item.type === "rts-addresses-split";
    const pairs = pairsOf(item.region, byteAt);
    const partOf = new Map<number, { pair: (typeof pairs)[number]; high: boolean }>();
    for (const pair of pairs) {
      partOf.set(pair.low, { pair, high: false });
      partOf.set(pair.high, { pair, high: true });
    }
    for (let address = item.start; address <= item.end; address++) {
      const part = partOf.get(address);
      if (part === undefined) {
        cells.push(byteCell(address));
        continue;
      }
      const text = rts ? rtsExpression(part.pair.target) : expression(part.pair.target);
      const whole = !split && !part.high && address + 1 <= item.end && !breaks.has(address + 1);
      if (whole) {
        cells.push({ address, length: 2, directive: "!word", text });
        address++;
        continue;
      }
      cells.push(byteCell(address, `${part.high ? ">" : "<"}${/^[$A-Za-z_.0-9]+$/.test(text) ? text : `(${text})`}`));
    }
    return cells;
  }

  if (item.type === "words") {
    const odd = (item.region === undefined ? 0 : (item.region.end - item.region.start + 1) % 2) === 1;
    for (let address = item.start; address <= item.end; address++) {
      const offset = address - (item.region?.start ?? item.start);
      const last = odd && address === item.region!.end;
      if (offset % 2 === 0 && !last && address + 1 <= item.end && !breaks.has(address + 1)) {
        cells.push({ address, length: 2, directive: "!word", text: hex4(byteAt(address) | (byteAt(address + 1) << 8)) });
        address++;
      } else cells.push(byteCell(address));
    }
    return cells;
  }

  if (item.type === "petscii" || item.type === "screen") {
    const toChar = item.type === "petscii" ? petsciiChar : screenChar;
    const directive = item.type === "petscii" ? "!pet" : "!scr";
    for (let address = item.start; address <= item.end; address++) {
      const char = toChar(byteAt(address));
      cells.push(char === undefined ? byteCell(address) : { address, length: 1, directive, text: char });
    }
    return cells;
  }

  const binary = item.type === "sprite";
  const fill = FILL_TYPES.includes(item.type) && item.region?.element === undefined;
  for (let address = item.start; address <= item.end; address++) {
    const value = byteAt(address);
    if (fill) {
      let end = address;
      while (end + 1 <= item.end && byteAt(end + 1) === value && !breaks.has(end + 1)) end++;
      if (end - address + 1 >= MIN_FILL) {
        cells.push({ address, length: end - address + 1, directive: "!fill", text: `${end - address + 1}, ${hex2(value)}` });
        address = end;
        continue;
      }
    }
    cells.push(byteCell(address, binary ? `%${value.toString(2).padStart(8, "0")}` : hex2(value)));
  }
  return cells;
}

/** The cells of one data item as lines: one directive per line, broken at labels, comments and elements. */
function dataLines(item: DataItem, layout: Layout, breaks: Set<number>): Array<{ address: number; text: string }> {
  const cells = cellsOf(item, layout, breaks);
  const element = item.region?.element;
  const perLine = (directive: Directive) =>
    directive === "!word" ? WORDS_PER_LINE : directive === "!pet" || directive === "!scr" ? CHARS_PER_LINE : item.type === "sprite" ? 3 : element !== undefined && element <= 16 ? element : BYTES_PER_LINE;
  const lines: Array<{ address: number; text: string }> = [];
  let group: Cell[] = [];
  const flush = () => {
    if (group.length === 0) return;
    const [first] = group;
    const directive = first!.directive;
    const text =
      directive === "!pet" || directive === "!scr"
        ? `${directive} "${group.map((cell) => cell.text).join("")}"`
        : `${directive} ${group.map((cell) => cell.text).join(directive === "!fill" ? "" : ",")}`;
    lines.push({ address: first!.address, text });
    group = [];
  };
  for (const cell of cells) {
    const first = group[0];
    const elementStart = element !== undefined && item.region !== undefined && (cell.address - item.region.start) % element === 0;
    if (first !== undefined && (first.directive !== cell.directive || cell.directive === "!fill" || group.length >= perLine(first.directive) || breaks.has(cell.address) || elementStart)) flush();
    group.push(cell);
  }
  flush();
  return lines;
}

// --- Rendering --------------------------------------------------------------

export interface Rendered {
  files: Array<{ name: string; text: string }>;
  instructions: number;
  dataBytes: number;
  undecodedBytes: number;
  /** Instructions written as bytes, because ACME writes their form with other bytes. */
  asBytes: Array<{ address: number; text: string }>;
  /** With coverage: runs of instructions that no run executed. */
  notExecuted?: { instructions: number; ranges: Range[] };
}

const withSide = (text: string, side: string | undefined) => (side === undefined ? text : `${text.padEnd(SIDE_COLUMN - 1)} ; ${side}`);

/** The source text of each piece, the main file and the constants. `asBytes` holds the opcode form keys that the probe refused. */
export function render(layout: Layout, asBytes: ReadonlySet<string>, header: string[]): Rendered {
  const lineComments = new Map<number, string[]>();
  const sideComments = new Map<number, string>();
  for (const comment of layout.comments) {
    if (!layout.inImage(comment.address)) continue;
    if (comment.placement === "line") lineComments.set(comment.address, comment.text.split(/\r?\n/));
    else sideComments.set(comment.address, comment.text.replace(/\s*\r?\n\s*/g, " "));
  }
  const breaks = new Set<number>([...layout.names.keys(), ...lineComments.keys(), ...sideComments.keys()]);
  const result: Rendered = { files: [], instructions: 0, dataBytes: 0, undecodedBytes: 0, asBytes: [] };
  const { coverage } = layout;
  const notExecuted = { instructions: 0, ranges: [] as Range[] };

  for (const piece of layout.pieces) {
    const out: string[] = [`; ${piece.title}`, `; ${hex4(piece.start)}-${hex4(piece.end)}`, ""];
    /** True while the instructions before have not executed: they form one range. */
    let running = false;
    /** The line of the mark of the open range of instructions that did not execute. */
    let markLine = 0;
    const head = (address: number) => {
      for (const text of lineComments.get(address) ?? []) out.push(`; ${text}`.trimEnd());
      const label = layout.names.get(address);
      if (label !== undefined) out.push(label);
    };
    for (const item of piece.items) {
      if (item.kind === "instruction") {
        head(item.address);
        const executed = coverage === undefined || (coverage[item.address]! & COVERAGE.ramExecute) !== 0;
        if (!executed) {
          if (running) notExecuted.ranges.at(-1)!.end = item.address + item.length - 1;
          else {
            notExecuted.ranges.push({ start: item.address, end: item.address + item.length - 1 });
            markLine = out.length;
            out.push("");
          }
          // The mark gives the range, so a reader finds it in the full list (D49).
          const range = notExecuted.ranges.at(-1)!;
          out[markLine] = `; not executed ${hex4(range.start)}-${hex4(range.end)}`;
          notExecuted.instructions++;
        }
        running = !executed;
        const sides: string[] = [];
        if (sideComments.has(item.address)) sides.push(sideComments.get(item.address)!);
        for (let offset = 1; offset < item.length; offset++) {
          const inside = item.address + offset;
          const label = layout.names.get(inside);
          if (label !== undefined) out.push(`${label} = * + ${offset}`);
          for (const text of lineComments.get(inside) ?? []) sides.push(text);
          if (sideComments.has(inside)) sides.push(sideComments.get(inside)!);
        }
        const form = formOf(layout, item);
        const { mode } = OPCODES[item.opcode]!;
        const value = mode === "imp" ? 0 : operandValue(item.address, item.opcode, layout.byteAt)!;
        const literal = instructionText(item.opcode, "", literalOperand(item.opcode, value));
        if (asBytes.has(form.key)) {
          const bytes = Array.from({ length: item.length }, (_, offset) => hex2(layout.byteAt(item.address + offset)));
          out.push(withSide(`${INDENT}!byte ${bytes.join(",")}`, [literal, ...sides].join(" ")));
          result.asBytes.push({ address: item.address, text: literal });
        } else {
          const expression = takesAddress(mode) ? (layout.names.get(value) ?? literalOperand(item.opcode, value)) : literalOperand(item.opcode, value);
          out.push(withSide(`${INDENT}${instructionText(item.opcode, form.suffix, expression)}`, sides.length === 0 ? undefined : sides.join(" ")));
        }
        result.instructions++;
        continue;
      }
      running = false;
      const lines = dataLines(item, layout, breaks);
      lines.forEach((line, index) => {
        head(line.address);
        const note = item.type === "undecoded" && index === 0 ? "not decoded" : undefined;
        const side = [note, sideComments.get(line.address)].filter((text) => text !== undefined).join(" ");
        out.push(withSide(`${INDENT}${line.text}`, side === "" ? undefined : side));
      });
      const bytes = item.end - item.start + 1;
      if (item.type === "undecoded") result.undecodedBytes += bytes;
      else result.dataBytes += bytes;
    }
    result.files.push({ name: piece.file, text: `${out.join("\n")}\n` });
  }

  const constants = ["; Names outside the image.", ...layout.constants.map((address) => `${layout.names.get(address)} = ${constantValue(address)}`)];
  result.files.push({ name: "constants.asm", text: `${constants.join("\n")}\n` });
  const main = [...header.map((line) => `; ${line}`), "", "!cpu 6510", '!source "constants.asm"'];
  for (const piece of layout.pieces) {
    if (piece.segmentStart) main.push("", `* = ${hex4(piece.start)}`);
    main.push(`!source "${piece.file}"`);
  }
  result.files.push({ name: "main.asm", text: `${main.join("\n")}\n` });
  if (coverage !== undefined) result.notExecuted = notExecuted;
  return result;
}
