// ACME source from an image, current knowledge and Ghidra's instruction
// boundaries. The same input gives the same text. Names come from
// knowledge; a target that knowledge does not name gets l_xxxx. A read or
// write in the I/O area names the register, also where the image holds RAM. Data is
// written by its region type. The source assembles to the same bytes: the
// generator forces operand sizes, and writes an opcode form that ACME
// encodes differently as bytes (see the probe in source.ts). An operand
// expression of the knowledge is written in place of its number. A
// patch is written as !if SWITCH { code } else { original }, with the
// condition of the state that the program does not have, and a macro use as
// one +name args line. config.asm holds the value of each switch, and
// switches.asm the values of each release. A range of leftovers (bytes that
// nothing uses) is a file of its own, in the build only with LEFTOVERS = 1:
// each release has it, the default build does not, and the loader never
// loads it.

import { CONFIG_FILE, configValues } from "#src/build-name.ts";
import { type AddressRange, COVERAGE, formatC64Address, formatC64Byte, POINTER_TABLE_TYPES, pointerTableEntries, type PointerTableType } from "#src/c64.ts";
import { WireFailure } from "#src/host-client/tools.ts";
import { identifiers, operandText, replaceIdentifiers, type OperandExpression } from "#src/knowledge/expression.ts";
import { type CommentPlacement, isAnalyzer, isGeneratedFile, LEFTOVER_FOLDER, LEFTOVERS_SWITCH, SEGMENT_FOLDER, RELEASE_DEFINE, START_SCREEN_SWITCH, type Origin, type RegionType, type SwitchKind } from "#src/knowledge/schema.ts";
import type { Area } from "#src/platform.ts";
import { hasZeroPageForm, instructionWith, labelProblem, MODE_LENGTH, OPCODES, takesAddress, USE_KINDS, useKind, type UseKind } from "#src/opcodes.ts";

export interface SourceInput {
  /** The knowledge has a start screen: config.asm gets START_SCREEN. */
  startScreen?: boolean;
  /** In address order, without overlap. */
  segments: AddressRange[];
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
  /** Joined coverage files: an instruction that no run executed is marked. */
  coverage?: Uint8Array;
  /** Platform names: the name of an address that knowledge does not name, the last address of its entry, and what it is. */
  platform?: ReadonlyArray<{ address: number; end: number; name: string; meaning?: string }>;
  /** The platform names that `platform` leaves out, because the program does not use their ROM: the reason of an expression that names one tells it. */
  platformLeftOut?: ReadonlySet<string>;
  /** The platform area of an address, and the register that an I/O mirror repeats: constants.asm groups and describes its names with them. */
  describe?: (address: number) => { area: Area; mirrorOf?: number };
  /** The I/O area: a code operand there names the register, also when the image holds RAM there. */
  io?: AddressRange;
  /** What a value in a platform register means (c64-memory-map): an immediate stored to such a register gets it as a side comment. Throws for a register without a decoder. */
  decode?: (register: number, value: number) => Record<string, unknown>;
  /** Operand expressions of the knowledge, by instruction address. */
  operands?: ReadonlyArray<OperandExpression & { address: number }>;
  /** Patches of the knowledge: code for a range in the state of the switch that the program does not have. */
  patches?: ReadonlyArray<{ start: number; end: number; switch: string; code: string; comment?: string }>;
  /** The switches of the knowledge, each with its value in the program. config.asm holds them all. */
  switches?: ReadonlyArray<SourceSwitch>;
  /** The releases of the knowledge: switches.asm gives each one its switch values. */
  releases?: ReadonlyArray<SourceRelease>;
  /** Macros of the knowledge, written to macros.asm. */
  macros?: ReadonlyArray<{ name: string; params: readonly string[]; body: string; comment?: string }>;
  /** Macro uses of the knowledge: the instructions of a range, written as one use of a macro. */
  macroUses?: ReadonlyArray<{ start: number; end: number; macro: string; args: readonly string[] }>;
  /** The leftovers: ranges inside the segments that nothing uses, in address order. Each one is a file that only LEFTOVERS = 1 builds. */
  leftovers?: readonly AddressRange[];
}

/** A macro use that the source writes, with its args in the names of this source. */
export interface MacroUseBlock {
  start: number;
  end: number;
  macro: string;
  args: string[];
}

/** A macro use that the source writes as its instructions, and why. */
export interface MacroAsInstructions {
  start: number;
  end: number;
  macro: string;
  reason: string;
}

/** A switch: its kind, its default, its value in the program (`base`) and the releases that have it on. */
export interface SourceSwitch {
  name: string;
  kind: SwitchKind;
  default: 0 | 1;
  base: 0 | 1;
  releases: readonly string[];
  comment?: string;
}

/** A release: the build with RELEASE_<label> gives each switch the value of this release. */
export interface SourceRelease {
  label: string;
  base: boolean;
  comment?: string;
}

/** The code of one switch in a patch: it is in when the switch does not have its base value. */
export interface PatchAlternative {
  switch: string;
  code: string;
  comment?: string;
  base: 0 | 1;
}

/**
 * A patch that the source writes, with the addresses inside it that have a
 * name. Two or more alternatives are patches of different switches at the
 * same range: at most one of them is in.
 */
export interface PatchBlock {
  start: number;
  end: number;
  alternatives: PatchAlternative[];
  /** Named addresses after the start of the range: the source defines them before the patch, so both builds have them. */
  inner: number[];
}

/** A patch of the knowledge that the source does not write, and why. */
export interface PatchNotWritten {
  start: number;
  end: number;
  switch: string;
  reason: string;
}

/** An operand expression that the source writes as a number, with its text and why. */
export interface OperandAsNumber {
  address: number;
  expression: string;
  reason: string;
}

const CODE_TYPES: readonly RegionType[] = ["code", "jumps", "dual-use"];
const BYTES_PER_LINE = 8;
const WORDS_PER_LINE = 4;
const CHARS_PER_LINE = 32;
const MIN_FILL = 16;
const SIDE_COLUMN = 40;
const INDENT = "        ";

type Region = SourceInput["regions"][number];

/** LDA/LDX/LDY immediate, and the stores of the same register: absolute and zero page. */
const LOADS: Record<number, "a" | "x" | "y"> = { 0xa9: "a", 0xa2: "x", 0xa0: "y" };
const STORES: Record<number, "a" | "x" | "y"> = { 0x8d: "a", 0x85: "a", 0x8e: "x", 0x86: "x", 0x8c: "y", 0x84: "y" };

/** A decoded register value in a few words: the true flags, the numbers and the texts, without the note. */
function decodedText(decoded: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(decoded)) {
    if (key === "note" || value === false || value === undefined) continue;
    if (value === true) parts.push(key);
    else if (Array.isArray(value)) parts.push(`${key} ${value.join(",")}`);
    else if (typeof value === "object" && value !== null) continue;
    else parts.push(`${key} ${String(value)}`);
  }
  return parts.join(", ");
}

/**
 * Side comments for an immediate that the next instruction stores to a platform
 * register with a decoder, for example "$d011: yScroll 3, rows 25". A knowledge
 * side comment at the store wins.
 */
function decodedStores(pieces: readonly Piece[], input: SourceInput, isRegister: (address: number) => boolean): Array<{ address: number; placement: CommentPlacement; text: string }> {
  if (input.decode === undefined) return [];
  const own = new Set(input.comments.filter((comment) => comment.placement === "side").map((comment) => comment.address));
  const found: Array<{ address: number; placement: CommentPlacement; text: string }> = [];
  for (const piece of pieces) {
    const items = piece.items.filter((item): item is InstructionItem => item.kind === "instruction");
    for (let index = 1; index < items.length; index++) {
      const load = items[index - 1]!;
      const store = items[index]!;
      const register = STORES[store.opcode];
      if (register === undefined || LOADS[load.opcode] !== register || load.address + load.length !== store.address || own.has(store.address)) continue;
      const target = store.length === 3 ? input.byteAt(store.address + 1) | (input.byteAt(store.address + 2) << 8) : input.byteAt(store.address + 1);
      // A register inside the image is RAM of the program, not the register, unless the source names the register there.
      if (!isRegister(target)) continue;
      try {
        const text = decodedText(input.decode(target, input.byteAt(load.address + 1)));
        if (text !== "") found.push({ address: store.address, placement: "side", text: `${formatC64Address(target)}: ${text}` });
      } catch {
        // No decoder for this register.
      }
    }
  }
  return found;
}

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
  /** True for a range of leftovers: only LEFTOVERS = 1 builds it, and the loader does not load it. */
  leftover: boolean;
  items: Item[];
}

export interface Layout {
  pieces: Piece[];
  /** Names of addresses: inside the image a label, outside it a constant. */
  names: Map<number, string>;
  /** Addresses that the source names as constants: outside the image, and the registers in `registers`. */
  constants: number[];
  /** Platform names of addresses inside the image that the source writes as constants, not as labels: a name of an operand expression, and a register of the I/O area. */
  registers: Map<number, string>;
  /** The operand of an instruction without an expression when it is not the name of its target: a register of the I/O area, or the plain address of the I/O area. */
  operandNames: Map<number, string>;
  /** How the source uses each constant: instructions by kind, and pointer table entries. */
  uses: Map<number, Map<UseKind, number>>;
  platform: NonNullable<SourceInput["platform"]>;
  describe?: SourceInput["describe"];
  inImage: (address: number) => boolean;
  byteAt: (address: number) => number;
  comments: SourceInput["comments"];
  coverage?: Uint8Array;
  generatedLabels: number;
  namedLabels: number;
  unusedModules: Array<{ start: number; file: string }>;
  /** The operand of an instruction as an expression with the names of this source. */
  operands: Map<number, string>;
  /** Operand expressions that cannot be written. */
  operandsAsNumbers: OperandAsNumber[];
  /** The patches that the source writes, by start. */
  patches: Map<number, PatchBlock>;
  patchesNotWritten: PatchNotWritten[];
  /** Every switch of the knowledge, by name, and the releases, the base release first. */
  switches: SourceSwitch[];
  releases: SourceRelease[];
  /** The macros, by name. */
  macros: NonNullable<SourceInput["macros"]>;
  /** The macro uses that the source can write, by start. */
  macroUses: Map<number, MacroUseBlock>;
  macrosAsInstructions: MacroAsInstructions[];
  /** The knowledge has a start screen: config.asm gets START_SCREEN. */
  startScreen: boolean;
  /** The ranges of leftovers: config.asm gets LEFTOVERS. */
  leftovers: AddressRange[];
}

/** ACME reads leading zeros as a 16-bit value, so a zero-page name gets two digits. */
const constantValue = (address: number) => (address < 0x100 ? formatC64Byte(address) : formatC64Address(address));
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
 * A data region wins over an entry: Ghidra does not decode there,
 * and the source has data there. A code region in the knowledge changes that.
 */
export function entriesInData<R extends { start: number; end: number; type: RegionType }>(entries: readonly number[], regions: readonly R[]): Array<{ entry: number; region: R }> {
  return entries.flatMap((entry) => {
    const region = regions.find((row) => entry >= row.start && entry <= row.end && !CODE_TYPES.includes(row.type));
    return region === undefined ? [] : [{ entry, region }];
  });
}

/** Why an image without its entry fails: the image does not hold the program. Undefined when the entry is in a segment, or the image has no entry. */
export function entryOutsideImage(entry: number | undefined, segments: readonly AddressRange[]): string | undefined {
  if (entry === undefined || segments.some((segment) => entry >= segment.start && entry <= segment.end)) return undefined;
  return `The entry ${formatC64Address(entry)} is in no segment of the image: the image does not hold the program. Capture the program again, so that a segment holds the entry.`;
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
    if (isGeneratedFile(module.file)) throw new WireFailure("invalid-input", `The module at ${formatC64Address(module.start)} has the file ${module.file}, which the generator writes itself. Give the module another file.`);
  }
  const modules = [...input.modules].sort((a, b) => a.start - b.start);
  const unusedModules = modules.filter((module) => !inImage(module.start)).map(({ start, file }) => ({ start, file }));

  // A patch starts and ends at an item boundary, so a data run stops there.
  const patches = [...(input.patches ?? [])].sort((a, b) => a.start - b.start);
  const macroUses = [...(input.macroUses ?? [])].sort((a, b) => a.start - b.start);
  const leftovers = (input.leftovers ?? []).filter((range) => input.segments.some((segment) => range.start >= segment.start && range.end <= segment.end));
  const cuts = new Set([...patches, ...macroUses, ...leftovers].flatMap((range) => [range.start, range.end + 1]));

  const pieces: Piece[] = [];
  const hex = (address: number) => address.toString(16).padStart(4, "0");
  for (const segment of input.segments) {
    const inside = (address: number) => address > segment.start && address <= segment.end;
    // A range of leftovers is one file: a module that starts in it goes on after it.
    const inLeftovers = (address: number) => leftovers.some((range) => address > range.start && address <= range.end);
    const starts = [...modules.map((module) => module.start).filter((start) => !inLeftovers(start)), ...leftovers.flatMap((range) => [range.start, range.end + 1])].filter(inside);
    const bounds = [...new Set([segment.start, ...starts, segment.end + 1])].sort((a, b) => a - b);
    for (let index = 0; index + 1 < bounds.length; index++) {
      const start = bounds[index]!;
      const end = bounds[index + 1]! - 1;
      const segmentTitle = `Segment ${formatC64Address(segment.start)}-${formatC64Address(segment.end)}`;
      if (leftovers.some((range) => range.start === start)) {
        pieces.push({ start, end, file: `${LEFTOVER_FOLDER}/leftover_${hex(start)}.asm`, title: `Leftovers ${formatC64Address(start)}-${formatC64Address(end)}: ${end - start + 1} bytes that nothing uses. Only LEFTOVERS = 1 builds them.`, segmentStart: index === 0, leftover: true, items: [] });
        continue;
      }
      // A module that leftovers cut goes on in a file of its own after them, in its folder: <module>_xxxx.asm.
      const module = modules.find((row) => row.start === start);
      const holder = module ?? modules.filter((row) => row.start >= segment.start && row.start < start).at(-1);
      const title = (text: string | undefined) => text?.replace(/\s*\r?\n\s*/g, " ");
      const file = module?.file ?? (holder === undefined ? `${SEGMENT_FOLDER}/segment_${hex(start)}.asm` : `${holder.file.replace(/\.asm$/i, "")}_${hex(start)}.asm`);
      const named = module === undefined && holder !== undefined ? `${title(holder.title) ?? holder.file}, from ${formatC64Address(start)}` : title(module?.title);
      pieces.push({ start, end, file, title: named ?? segmentTitle, segmentStart: index === 0, leftover: false, items: [] });
    }
  }
  // In any letter case: the file systems of macOS and Windows ignore it.
  const files = new Map<string, number>();
  for (const piece of pieces) {
    const other = files.get(piece.file.toLowerCase());
    if (other !== undefined) throw new WireFailure("invalid-input", `The file ${piece.file} is used at ${formatC64Address(other)} and at ${formatC64Address(piece.start)}. Give the module another file.`);
    files.set(piece.file.toLowerCase(), piece.start);
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
        if (at > piece.end || cuts.has(at)) return false;
        const next = regionAt(at);
        if (region !== undefined && !codeRegion) return next === region;
        if (codeRegion) return next === region && !input.instructions.has(at);
        return next === undefined && !input.instructions.has(at);
      };
      while (same(end + 1)) end++;
      const last = piece.items.at(-1);
      if (last?.kind === "data" && last.type === type && last.region === region && last.end + 1 === address && !cuts.has(address)) last.end = end;
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
  const platform = new Map((input.platform ?? []).filter(({ name }) => !knowledgeNames.has(name) && labelProblem(name) === undefined).map(({ address, name }) => [address, name]));
  // An analyzer name (DXA's ld020) gives way to the platform name (EXTCOL); a user or LLM name wins.
  const symbols = new Map(input.symbols.filter((symbol) => !(isAnalyzer(symbol.origin) && platform.has(symbol.address))).map((symbol) => [symbol.address, symbol.name]));
  /** Addresses outside the image without a name of their own, inside a named platform entry of more bytes: the start of that entry. */
  const insideEntry = new Map<number, number>();
  const uses = new Map<number, Map<UseKind, number>>();
  const tally = (constant: number, kind: UseKind) => {
    const kinds = uses.get(constant) ?? new Map<UseKind, number>();
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    uses.set(constant, kinds);
  };
  const count = (constant: number, kind: UseKind) => {
    outside.add(constant);
    tally(constant, kind);
  };
  /** Platform names inside the image that the source writes as constants: the register, not the RAM of the program there. */
  const registers = new Map<number, string>();
  const register = (address: number, name: string, kind: UseKind) => {
    registers.set(address, name);
    tally(address, kind);
  };
  const inIo = (address: number) => input.io !== undefined && address >= input.io.start && address <= input.io.end;
  /** The start of the named data region that holds an address without a name of its own: the operand is written name+offset. */
  const tableStart = (address: number) => {
    if (symbols.has(address)) return undefined;
    const region = input.regions.find((row) => address > row.start && address <= row.end && !CODE_TYPES.includes(row.type) && row.type !== "dual-use");
    return region !== undefined && symbols.has(region.start) ? region.start : undefined;
  };
  const use = (address: number, kind: UseKind) => {
    if (inImage(address)) {
      const table = tableStart(address);
      wanted.add(table ?? address);
      if (table !== undefined) insideEntry.set(address, table);
    } else if (symbols.has(address) || platform.has(address)) count(address, kind);
    else {
      const entry = input.platform?.find((row) => address > row.address && address <= row.end && !inImage(row.address) && (symbols.has(row.address) || platform.has(row.address)));
      if (entry === undefined) return;
      count(entry.address, kind);
      insideEntry.set(address, entry.address);
    }
  };
  // The names of an operand expression are found by name, a knowledge symbol before a platform name, and written with the name the source gives that address.
  const byName = new Map<string, number>();
  for (const row of input.platform ?? []) if (!byName.has(row.name)) byName.set(row.name, row.address);
  for (const symbol of input.symbols) byName.set(symbol.name, symbol.address);
  /** A platform name of an expression stays as written: inside the image it is a register constant, not the label of the RAM there. */
  const useName = (name: string, kind: UseKind) => {
    const address = byName.get(name)!;
    if (inImage(address) && platform.get(address) === name) register(address, name, kind);
    else use(address, kind);
  };
  /**
   * The operand of an instruction without an expression. A read or a write in the
   * I/O area inside the image, without a knowledge name there, is the register:
   * its platform name, else the plain address. The data label of the RAM there stays.
   */
  const operandNames = new Map<number, string>();
  const useOperand = (item: InstructionItem) => {
    const value = operandValue(item.address, item.opcode, input.byteAt)!;
    const kind = useKind(item.opcode);
    const access = kind === "read" || kind === "written" || kind === "modified";
    if (!inImage(value) || symbols.has(value) || !access) return use(value, kind);
    const name = registers.get(value) ?? (inIo(value) ? platform.get(value) : undefined);
    if (name !== undefined) {
      register(value, name, kind);
      operandNames.set(item.address, name);
    } else if (inIo(value)) operandNames.set(item.address, literalOperand(item.opcode, value));
    else use(value, kind);
  };
  const instructionAt = new Map(pieces.flatMap((piece) => piece.items.flatMap((item) => (item.kind === "instruction" ? [[item.address, item] as const] : []))));
  /** Why names of an expression are not names of the source: not known, or platform names of a ROM that the program does not use. */
  const unknownNames = (missing: readonly string[], remedy: string) => {
    const leftOut = missing.filter((name) => input.platformLeftOut?.has(name) === true);
    const unknown = missing.filter((name) => !leftOut.includes(name));
    const are = (names: readonly string[]) => `${names.join(", ")} ${names.length === 1 ? "is" : "are"}`;
    return [
      ...(unknown.length === 0 ? [] : [`${are(unknown)} not a symbol of the knowledge or a platform name.`]),
      ...(leftOut.length === 0 ? [] : [`${are(leftOut)} a platform name of a ROM that the program does not use, so the source leaves ${leftOut.length === 1 ? "it" : "them"} out (romNamesLeftOut).`]),
      remedy,
    ].join(" ");
  };
  // A macro use is a run of whole instructions of one file, of a macro with one param for each arg, whose args name known names.
  const macrosByName = new Map((input.macros ?? []).map((macro) => [macro.name, macro]));
  const macrosAsInstructions: MacroAsInstructions[] = [];
  const candidates: Array<{ use: (typeof macroUses)[number]; items: InstructionItem[] }> = [];
  for (const use of macroUses) {
    const fallBack = (reason: string) => macrosAsInstructions.push({ start: use.start, end: use.end, macro: use.macro, reason });
    const macro = macrosByName.get(use.macro);
    if (macro === undefined) {
      fallBack(`There is no macro ${use.macro}.`);
      continue;
    }
    if (macro.params.length !== use.args.length) {
      fallBack(`The macro has ${macro.params.length} params, and the use gives ${use.args.length} args.`);
      continue;
    }
    if (patches.some((patch) => patch.start <= use.end && use.start <= patch.end)) {
      fallBack("The use lies in a patch.");
      continue;
    }
    const piece = pieces.find((row) => use.start >= row.start && use.start <= row.end);
    const run = piece?.items.filter((item) => (item.kind === "instruction" ? item.address : item.start) >= use.start && (item.kind === "instruction" ? item.address : item.start) <= use.end) ?? [];
    const last = run.at(-1);
    const whole = last?.kind === "instruction" && run.every((item) => item.kind === "instruction") && (run[0] as InstructionItem).address === use.start && last.address + last.length - 1 === use.end;
    if (!whole) {
      fallBack("The range is not a run of whole instructions of one file.");
      continue;
    }
    const missing = [...new Set(use.args.flatMap((arg) => identifiers(arg)))].filter((name) => !byName.has(name));
    if (missing.length > 0) {
      fallBack(unknownNames(missing, "Name the address in the project knowledge, or record the macro use again with other args."));
      continue;
    }
    candidates.push({ use, items: run as InstructionItem[] });
  }
  /** The instructions of a written use name nothing: the macro writes them. */
  const inUse = new Set(candidates.flatMap((candidate) => candidate.items.map((item) => item.address)));
  const expressions: Array<{ address: number; text: string; kind: UseKind }> = [];
  const operandsAsNumbers: OperandAsNumber[] = [];
  for (const operand of [...(input.operands ?? [])].sort((a, b) => a.address - b.address)) {
    const expression = operandText(operand);
    const item = instructionAt.get(operand.address);
    const mode = item === undefined ? undefined : OPCODES[item.opcode]!.mode;
    if (mode === undefined || mode === "imp" || mode === "rel") {
      operandsAsNumbers.push({ address: operand.address, expression, reason: "The source has no instruction with an operand value at this address." });
      continue;
    }
    const missing = identifiers(expression).filter((name) => !byName.has(name));
    if (missing.length > 0) {
      operandsAsNumbers.push({ address: operand.address, expression, reason: unknownNames(missing, "Name the address in the project knowledge, or record the operand expression again.") });
      continue;
    }
    // An immediate operand builds the address of a name; any other operand uses the address as the instruction does.
    expressions.push({ address: operand.address, text: expression, kind: mode === "imm" ? "address" : useKind(item!.opcode) });
  }
  // The names of expressions and macro args come first: a platform name there names the register for the plain operands too.
  for (const { text: expression, kind } of expressions) for (const name of identifiers(expression)) useName(name, kind);
  for (const candidate of candidates) for (const arg of candidate.use.args) for (const name of identifiers(arg)) useName(name, "macro argument");
  // An instruction with an expression names what the expression names, not its plain target.
  const written = new Set(expressions.map((expression) => expression.address));
  for (const piece of pieces) {
    for (const item of piece.items) {
      if (item.kind === "instruction") {
        if (takesAddress(OPCODES[item.opcode]!.mode) && !written.has(item.address) && !inUse.has(item.address)) useOperand(item);
        continue;
      }
      for (const pointer of pointersOf(item, input.byteAt)) use(pointer, "table");
    }
  }
  for (const symbol of input.symbols) want(symbol.address);
  // A reference target inside a named data region without its own name is that region's name plus the offset: it makes no label.
  for (const target of input.referenceTargets) want(tableStart(target) ?? target);
  if (input.entry !== undefined) want(input.entry);
  // A use with a label inside it is written as its instructions, which then name their targets: that can put a label inside another use.
  const accepted = new Set(candidates);
  for (let changed = true; changed; ) {
    changed = false;
    for (const candidate of [...accepted]) {
      const inside = [...wanted].filter((address) => address > candidate.use.start && address <= candidate.use.end).sort((a, b) => a - b)[0];
      if (inside === undefined) continue;
      accepted.delete(candidate);
      changed = true;
      macrosAsInstructions.push({ start: candidate.use.start, end: candidate.use.end, macro: candidate.use.macro, reason: `The source has a label at ${formatC64Address(inside)}, inside the use.` });
      for (const item of candidate.items) {
        inUse.delete(item.address);
        if (takesAddress(OPCODES[item.opcode]!.mode) && !written.has(item.address)) useOperand(item);
      }
    }
  }
  // A macro line also uses the addresses that its instructions name besides its args, for example the high byte
  // CUTHI of +mov16 CUTLO: a name of the source counts that use too. The args count as macro argument above.
  for (const candidate of accepted) {
    const argAddresses = new Set(candidate.use.args.flatMap((arg) => identifiers(arg)).map((name) => byName.get(name)));
    for (const item of candidate.items) {
      if (!takesAddress(OPCODES[item.opcode]!.mode)) continue;
      const value = operandValue(item.address, item.opcode, input.byteAt)!;
      if (!argAddresses.has(value) && uses.has(value)) tally(value, useKind(item.opcode));
    }
  }

  const names = new Map<number, string>();
  const taken = new Set([...knowledgeNames, ...platform.values()]);
  let generatedLabels = 0;
  let namedLabels = 0;
  for (const address of [...wanted, ...outside].sort((a, b) => a - b)) {
    const known = symbols.get(address);
    if (known !== undefined) {
      const problem = labelProblem(known);
      if (problem !== undefined) throw new WireFailure("invalid-input", `The symbol ${known} at ${formatC64Address(address)}: ${problem} Rename the symbol in the project knowledge.`);
      names.set(address, known);
      if (inImage(address)) namedLabels++;
      continue;
    }
    // A platform name in the I/O area, or of a register constant, is the register: the RAM of the program there gets no label of that name.
    const named = inImage(address) && (inIo(address) || registers.has(address)) ? undefined : platform.get(address);
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
  // A patch is written when its range is whole items of one file and its switch is a switch of the knowledge and no name of the source.
  const blocks = new Map<number, PatchBlock>();
  const patchesNotWritten: PatchNotWritten[] = [];
  const sourceNames = new Set([...names.values(), ...taken]);
  const switches = new Map((input.switches ?? []).map((row) => [row.name, row]));
  for (const patch of [...patches].sort((a, b) => a.start - b.start || (a.switch < b.switch ? -1 : 1))) {
    const refuse = (reason: string) => patchesNotWritten.push({ start: patch.start, end: patch.end, switch: patch.switch, reason });
    const owner = switches.get(patch.switch);
    if (owner === undefined) {
      refuse(`The switch ${patch.switch} is not a switch of the knowledge.`);
      continue;
    }
    const known = blocks.get(patch.start);
    if (known !== undefined) {
      if (known.end !== patch.end) refuse(`The range overlaps the patch of ${known.alternatives[0]!.switch} at ${formatC64Address(known.start)}-${formatC64Address(known.end)}: alternatives have the same range.`);
      else known.alternatives.push({ switch: patch.switch, code: patch.code, ...(patch.comment === undefined ? {} : { comment: patch.comment }), base: owner.base });
      continue;
    }
    const piece = pieces.find((row) => patch.start >= row.start && patch.start <= row.end);
    if (piece === undefined) {
      refuse("The range is not in the image.");
      continue;
    }
    if (patch.end > piece.end) {
      refuse(`The range runs past the end of the file ${piece.file} at ${formatC64Address(piece.end)}: a patch is in one file.`);
      continue;
    }
    const starts = new Set(piece.items.map((item) => (item.kind === "instruction" ? item.address : item.start)));
    const ends = new Set(piece.items.map((item) => (item.kind === "instruction" ? item.address + item.length - 1 : item.end)));
    if (!starts.has(patch.start) || !ends.has(patch.end)) {
      const cut = piece.items.find((item) => item.kind === "instruction" && ((patch.start > item.address && patch.start < item.address + item.length) || (patch.end >= item.address && patch.end < item.address + item.length - 1)));
      refuse(cut === undefined ? "The range does not start and end at an item of the source." : `The range cuts the instruction at ${formatC64Address((cut as InstructionItem).address)}.`);
      continue;
    }
    if (sourceNames.has(patch.switch)) {
      refuse(`The switch name ${patch.switch} is also a name of the source.`);
      continue;
    }
    const inner = [...names.keys()].filter((address) => address > patch.start && address <= patch.end).sort((a, b) => a - b);
    blocks.set(patch.start, { start: patch.start, end: patch.end, alternatives: [{ switch: patch.switch, code: patch.code, ...(patch.comment === undefined ? {} : { comment: patch.comment }), base: owner.base }], inner });
  }
  // The high byte of a vector is NMINV+1. A zero-page entry keeps zero-page instructions: its constant has two digits.
  // An address inside a table keeps its own label when the source needs one there anyway, for example as the entry.
  for (const [address, start] of insideEntry) if (!wanted.has(address)) names.set(address, `${names.get(start)!}+${address - start}`);
  /** The name that the source gives a name of an expression: a register constant keeps its platform name. */
  const sourceName = (name: string) => {
    const address = byName.get(name)!;
    return registers.get(address) === name ? name : names.get(address);
  };
  /** An expression with the names of this source: a name with an offset in brackets, so an operator after it keeps its meaning. */
  const sourceText = (text: string) => replaceIdentifiers(text, (name) => {
    const label = sourceName(name)!;
    return label.includes("+") ? `(${label})` : label;
  });
  const usesWritten = new Map<number, MacroUseBlock>();
  for (const { use: row } of [...accepted].sort((a, b) => a.use.start - b.use.start)) usesWritten.set(row.start, { start: row.start, end: row.end, macro: row.macro, args: row.args.map(sourceText) });
  const operands = new Map<number, string>();
  for (const { address, text } of expressions) {
    const unnamed: string[] = [];
    const written = replaceIdentifiers(text, (name) => {
      const label = sourceName(name);
      if (label === undefined) unnamed.push(name);
      return label === undefined ? name : label.includes("+") ? `(${label})` : label;
    });
    if (unnamed.length === 0) operands.set(address, written);
    else operandsAsNumbers.push({ address, expression: text, reason: `The source has no name for ${unnamed.join(", ")}.` });
  }
  return {
    pieces,
    names,
    constants: [...outside, ...registers.keys()].sort((a, b) => a - b),
    registers,
    operandNames,
    uses,
    platform: input.platform ?? [],
    ...(input.describe === undefined ? {} : { describe: input.describe }),
    inImage,
    byteAt: input.byteAt,
    comments: [...input.comments, ...decodedStores(pieces, input, (address) => !inImage(address) || (registers.has(address) && !symbols.has(address)))],
    ...(input.coverage === undefined ? {} : { coverage: input.coverage }),
    generatedLabels,
    namedLabels,
    unusedModules,
    operands,
    operandsAsNumbers: operandsAsNumbers.sort((a, b) => a.address - b.address),
    patches: blocks,
    patchesNotWritten,
    switches: [...(input.switches ?? [])].sort((a, b) => (a.name < b.name ? -1 : 1)),
    releases: [...(input.releases ?? [])].sort((a, b) => Number(b.base) - Number(a.base) || (a.label < b.label ? -1 : 1)),
    macros: [...(input.macros ?? [])].sort((a, b) => (a.name < b.name ? -1 : 1)),
    macroUses: usesWritten,
    macrosAsInstructions: macrosAsInstructions.sort((a, b) => a.start - b.start),
    startScreen: input.startScreen === true,
    leftovers: [...leftovers],
  };
}

/** The pointer region types: a table of addresses, or of addresses minus 1 for RTS. */
const POINTER_TYPES: ReadonlyArray<DataItem["type"]> = POINTER_TABLE_TYPES;
const isPointerTable = (region: Region): region is Region & { type: PointerTableType } => (POINTER_TABLE_TYPES as readonly string[]).includes(region.type);

/** The pairs of a pointer table: the address of each low and high byte, and the target it names. */
function pairsOf(region: Region, byteAt: (address: number) => number): Array<{ low: number; high: number; target: number }> {
  return isPointerTable(region) ? pointerTableEntries(region, byteAt) : [];
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

/** The plain number of an operand: what the probe assembles, and what a comment shows. */
export function literalOperand(opcode: number, value: number): string {
  const { mode } = OPCODES[opcode]!;
  return MODE_LENGTH[mode] === 3 || mode === "rel" ? formatC64Address(value) : formatC64Byte(value);
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
  const expression = (target: number) => name(target) ?? formatC64Address(target);
  const rtsExpression = (target: number) => (name(target) === undefined ? formatC64Address((target - 1) & 0xffff) : `${name(target)}-1`);
  const byteCell = (address: number, text = formatC64Byte(byteAt(address))): Cell => ({ address, length: 1, directive: "!byte", text });

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
        cells.push({ address, length: 2, directive: "!word", text: formatC64Address(byteAt(address) | (byteAt(address + 1) << 8)) });
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
        cells.push({ address, length: end - address + 1, directive: "!fill", text: `${end - address + 1}, ${formatC64Byte(value)}` });
        address = end;
        continue;
      }
    }
    cells.push(byteCell(address, binary ? `%${value.toString(2).padStart(8, "0")}` : formatC64Byte(value)));
  }
  return cells;
}

/** The cells of one data item as lines: one directive per line, broken at labels, comments and elements. */
function dataLines(item: DataItem, layout: Layout, breaks: Set<number>): Array<{ address: number; text: string }> {
  const cells = cellsOf(item, layout, breaks);
  const element = item.region?.element;
  const perLine = (directive: Directive) =>
    directive === "!word" ? WORDS_PER_LINE : directive === "!pet" || directive === "!scr" ? CHARS_PER_LINE : item.type === "sprite" ? 3 : item.type === "charset" ? 8 : element !== undefined && element <= 16 ? element : BYTES_PER_LINE;
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

// --- Constants --------------------------------------------------------------

/** A longer name moves only its own comment, not the columns of the file. */
const MAX_NAME_COLUMN = 24;

/**
 * What a constant is: the comment of the knowledge, else the platform meaning,
 * else the register that a mirror repeats. A comment inside the image is of the
 * RAM there, so a register constant has the platform meaning.
 */
function describeConstant(layout: Layout, address: number, name: string): string | undefined {
  const comments = layout.registers.has(address) ? [] : layout.comments.filter((comment) => comment.address === address);
  // Line comments come before the side comment, as they do in the code.
  const own = [...comments.filter((comment) => comment.placement === "line"), ...comments.filter((comment) => comment.placement === "side")];
  if (own.length > 0) return own.map((comment) => comment.text.replace(/\s*\r?\n\s*/g, " ").trim()).join(" ");
  const entry = layout.platform.find((row) => address >= row.address && address <= row.end);
  if (entry?.meaning !== undefined) {
    const platformName = address === entry.address ? entry.name : `${entry.name}+${address - entry.address}`;
    return platformName === name ? entry.meaning : `${platformName}: ${entry.meaning}`;
  }
  const mirrorOf = layout.describe?.(address).mirrorOf;
  if (mirrorOf === undefined) return undefined;
  const register = layout.platform.find((row) => row.address === mirrorOf);
  return `Mirror of ${formatC64Address(mirrorOf)}${register === undefined ? "" : ` (${register.name})`}.`;
}

/** How the source uses a constant, for example "Used: read 4, written 1." */
function usageText(kinds: ReadonlyMap<UseKind, number> | undefined): string | undefined {
  const parts = USE_KINDS.filter((kind) => kinds?.has(kind)).map((kind) => `${kind} ${kinds!.get(kind)!}`);
  return parts.length === 0 ? undefined : `Used: ${parts.join(", ")}.`;
}

/** The patches of each switch that has one, by switch name. */
export function switchesOf(layout: Pick<Layout, "patches">): Map<string, PatchBlock[]> {
  const switches = new Map<string, PatchBlock[]>();
  for (const patch of [...layout.patches.values()].sort((a, b) => a.start - b.start)) {
    for (const alternative of patch.alternatives) switches.set(alternative.switch, [...(switches.get(alternative.switch) ?? []), patch]);
  }
  return new Map([...switches].sort(([a], [b]) => (a < b ? -1 : 1)));
}

/** The groups of config.asm, in order, with the default of each group. */
const SWITCH_GROUPS: ReadonlyArray<{ kind: SwitchKind; title: string }> = [
  { kind: "protection", title: "Copy protection: off by default" },
  { kind: "trainer", title: "Trainers: off by default" },
  { kind: "cheat", title: "Cheats: off by default" },
  { kind: "crack", title: "Changes of a crack: off by default" },
  { kind: "fix", title: "Fixes of the releases: on by default" },
  { kind: "change", title: "Other changes" },
];

/** True when the source has switches.asm: the knowledge has switches or releases, or the source has leftovers, which main.asm builds by LEFTOVERS. */
export const hasSwitchFile = (layout: Pick<Layout, "switches" | "releases" | "leftovers">) => layout.switches.length > 0 || layout.releases.length > 0 || layout.leftovers.length > 0;

/** True when the source has config.asm: the knowledge has switches or a start screen, or the source has leftovers. */
export const hasConfigFile = (layout: Pick<Layout, "switches" | "startScreen" | "leftovers">) => layout.switches.length > 0 || layout.startScreen || layout.leftovers.length > 0;

export { CONFIG_FILE, configValues };

/**
 * config.asm: the value of each switch as a plain assignment, grouped by
 * kind. Without a value, a switch has its default. A comment tells the
 * releases that have the switch on, and its patches.
 */
export function configText(layout: Pick<Layout, "switches" | "patches" | "startScreen" | "leftovers">, values: ReadonlyMap<string, number> = new Map()): string {
  const patches = switchesOf(layout);
  const out = [
    "; Generated by c64-source. Edit the values here: generate keeps them.",
    "; The switches of the build. Each switch is 0 or 1: change a value, then build again.",
    "; The defaults give the clean program: copy protection, trainers, cheats and",
    "; changes of a crack are 0, and the fixes of the releases are 1.",
    "; generate adds a new switch with its default and removes a switch that the",
    `; knowledge does not have. The build of a release does not read this file.`,
  ];
  const width = Math.max(0, ...layout.switches.map((row) => row.name.length));
  for (const group of SWITCH_GROUPS) {
    const rows = layout.switches.filter((row) => row.kind === group.kind);
    if (rows.length === 0) continue;
    out.push("", `; ${group.title}`);
    for (const row of rows) {
      const ranges = (patches.get(row.name) ?? []).map((patch) => `${formatC64Address(patch.start)}-${formatC64Address(patch.end)}`);
      const parts = [
        row.releases.length === 0 ? "on in no release" : `on in ${row.releases.join(", ")}`,
        ranges.length === 0 ? "no patch" : ranges.join(", "),
        ...(row.comment === undefined ? [] : [row.comment.replace(/\s*\r?\n\s*/g, " ")]),
      ];
      out.push(`${row.name.padEnd(width)} = ${values.get(row.name) ?? row.default} ; ${parts.join(". ")}`);
    }
  }
  if (layout.startScreen) {
    out.push("", "; Start screen: on by default", `${START_SCREEN_SWITCH} = ${values.get(START_SCREEN_SWITCH) ?? 1} ; the loader shows the start screen and waits for a key or a fire button. 0 starts the program at once. Only the clean build has it: a release and LEFTOVERS = 1 have none`);
  }
  if (layout.leftovers.length > 0) {
    const bytes = layout.leftovers.reduce((sum, range) => sum + range.end - range.start + 1, 0);
    out.push(
      "",
      "; Leftovers: off by default",
      `${LEFTOVERS_SWITCH} = ${values.get(LEFTOVERS_SWITCH) ?? 0} ; ${bytes} bytes in ${layout.leftovers.length} ${layout.leftovers.length === 1 ? "file" : "files"} in ${LEFTOVER_FOLDER}/ that nothing uses. 1 builds them, so main.asm gives the bytes of the program. Each release has them. The loader never loads them`,
    );
  }
  return `${out.join("\n")}\n`;
}

/**
 * switches.asm: the releases of the knowledge. A release block gives each
 * switch the value of that release when the build defines RELEASE_<label>.
 * A build without a release reads the values from config.asm.
 */
function switchesText(layout: Layout): string {
  const out = [
    "; The releases of the knowledge. config.asm holds the value of each switch.",
    `; Build a release with -D${RELEASE_DEFINE}<label>=1 (the build option --release <label>):`,
    "; then each switch has the value of that release, and the build does not read config.asm.",
  ];
  for (const release of layout.releases) {
    out.push("", `; ${release.label}${release.base ? " (the program of the knowledge)" : ""}${release.comment === undefined ? "" : `: ${release.comment.replace(/\s*\r?\n\s*/g, " ")}`}`);
    out.push(`!ifdef ${RELEASE_DEFINE}${release.label} {`);
    for (const row of layout.switches) out.push(`${INDENT}${row.name} = ${row.releases.includes(release.label) ? 1 : 0}`);
    if (layout.leftovers.length > 0) out.push(`${INDENT}${LEFTOVERS_SWITCH} = 1`);
    // The start screen is part of the clean build only: the build of a release is the bytes of its file.
    if (layout.startScreen) out.push(`${INDENT}${START_SCREEN_SWITCH} = 0`);
    out.push("}");
  }
  if (hasConfigFile(layout)) {
    const include = `!source "${CONFIG_FILE}"`;
    out.push("", layout.releases.reduceRight((inner, release) => `!ifndef ${RELEASE_DEFINE}${release.label} { ${inner} }`, include));
  }
  return `${out.join("\n")}\n`;
}

/** constants.asm: the names outside the image and the register constants by platform area, each with what it is and how the source uses it. */
function constantsText(layout: Layout): { text: string; labels: SourceLabel[] } {
  const { describe } = layout;
  const labels: SourceLabel[] = [];
  const rows = layout.constants.map((address) => {
    const name = layout.registers.get(address) ?? layout.names.get(address)!;
    const comment = [describeConstant(layout, address, name), usageText(layout.uses.get(address))].filter((text) => text !== undefined).join(" ");
    return { address, name, value: constantValue(address), comment };
  });
  const nameColumn = Math.min(MAX_NAME_COLUMN, Math.max(0, ...rows.map((row) => row.name.length)));
  const valueColumn = Math.max(0, ...rows.map((row) => row.value.length));
  const out: string[] = [];
  out.push(
    describe === undefined ? "; Names of addresses outside the image." : "; Names of addresses outside the image, by memory area.",
    '; "Used" counts the instructions and table entries of this source that use the name.',
    ...(layout.registers.size === 0 ? [] : ["; A name of an address inside the image names the register there, not the RAM of the program."]),
  );
  // Without platform areas the names form one group.
  if (describe === undefined && rows.length > 0) out.push("");
  let area: Area | undefined;
  for (const row of rows) {
    const next = describe?.(row.address).area;
    if (next !== undefined && next.start !== area?.start) {
      area = next;
      out.push("", `; ${area.name[0]!.toUpperCase()}${area.name.slice(1)} ${formatC64Address(area.start)}-${formatC64Address(area.end)}`);
      if (area.meaning !== undefined) out.push(`; ${area.meaning}`);
    }
    const line = `${row.name.padEnd(nameColumn)} = ${row.value.padEnd(valueColumn)}`;
    out.push(row.comment === "" ? line.trimEnd() : `${line} ; ${row.comment}`);
    labels.push({ address: row.address, name: row.name, file: "constants.asm", line: out.length });
  }
  return { text: `${out.join("\n")}\n`, labels };
}

// --- Rendering --------------------------------------------------------------

/** The line of a name: its label line, or its line in constants.asm (1 is the first line of the text). */
export interface SourceLabel {
  address: number;
  name: string;
  file: string;
  line: number;
}

/** The first line of an instruction, a macro use or a data line, and the addresses that it writes. */
export interface SourceItem {
  start: number;
  end: number;
  file: string;
  line: number;
}

export interface Rendered {
  files: Array<{ name: string; text: string }>;
  instructions: number;
  dataBytes: number;
  undecodedBytes: number;
  /** Instructions written as bytes, because ACME writes their form with other bytes. */
  asBytes: Array<{ address: number; text: string }>;
  /** With coverage: runs of instructions that no run executed. */
  notExecuted?: { instructions: number; ranges: AddressRange[] };
  /** Each instruction written with an operand expression: its file and line (1 is the first line of the text). */
  expressions: Array<{ address: number; length: number; file: string; line: number }>;
  /** Operand expressions written as numbers, in address order. */
  operandsAsNumbers: OperandAsNumber[];
  /** The patches written, in address order. */
  patches: number;
  /** Each macro use written: its file and line (1 is the first line of the text). */
  uses: Array<{ start: number; end: number; macro: string; file: string; line: number }>;
  /** The macro uses written as instructions, in address order, with the reason. */
  macrosAsInstructions: MacroAsInstructions[];
  /** The lines of each macro in macros.asm, from its !macro line to its closing brace. */
  macroLines: Map<string, { first: number; last: number }>;
  /** The source map: the line of each name, and the line of each address that the source writes. */
  labels: SourceLabel[];
  items: SourceItem[];
}

/** macros.asm: each macro with its comment, as ACME reads it; a param is .name in the body. */
function macrosText(layout: Layout): { text: string; lines: Map<string, { first: number; last: number }> } {
  const out = ["; Macros of the knowledge. The source writes a use as +name args."];
  const lines = new Map<string, { first: number; last: number }>();
  for (const macro of layout.macros) {
    out.push("");
    if (macro.comment !== undefined) out.push(...macro.comment.split(/\r?\n/).map((line) => `; ${line}`.trimEnd()));
    const first = out.length + 1;
    out.push(`!macro ${macro.name}${macro.params.map((param, index) => `${index === 0 ? " " : ", "}.${param}`).join("")} {`, ...macro.body.split(/\r?\n/), "}");
    lines.set(macro.name, { first, last: out.length });
  }
  return { text: `${out.join("\n")}\n`, lines };
}

/** The condition that puts in the code of a switch: the switch has the value that the program does not have. */
const patchCondition = (alternative: PatchAlternative) => (alternative.base === 0 ? alternative.switch : `${alternative.switch} = 0`);

/**
 * The lines that open a patch: its zone, a guard that stops two alternatives
 * together, then for each switch its condition, its code and the guard that
 * stops code longer than the range. The original code follows in the last
 * else; the patch closes with closingBraces.
 */
function patchOpening(patch: PatchBlock): string[] {
  const bytes = patch.end - patch.start + 1;
  const range = `${formatC64Address(patch.start)}-${formatC64Address(patch.end)}`;
  const out = [`!zone patch_${patch.alternatives[0]!.switch}_${patch.start.toString(16).padStart(4, "0")} {`, ".patch_start"];
  patch.alternatives.forEach((first, index) => {
    for (const second of patch.alternatives.slice(index + 1)) {
      out.push(`!if ${patchCondition(first)} { !if ${patchCondition(second)} { !error "${first.switch} and ${second.switch} change ${range}: turn on one of them." } }`);
    }
  });
  patch.alternatives.forEach((alternative, index) => {
    const state = alternative.base === 0 ? "on" : "off";
    const comment = alternative.comment === undefined ? [] : alternative.comment.split(/\r?\n/).map((line) => `${INDENT}; ${line}`.trimEnd());
    out.push(
      `${index === 0 ? "" : "} else { "}!if ${patchCondition(alternative)} {`,
      `${INDENT}; ${alternative.switch} ${state}: ${bytes} byte${bytes === 1 ? "" : "s"} at ${range}, NOP after the code`,
      ...comment,
      ...(alternative.code === "" ? [] : alternative.code.split(/\r?\n/)),
      `${INDENT}!if * - .patch_start > ${bytes} { !error "The patch ${alternative.switch} at ${formatC64Address(patch.start)} has ", * - .patch_start, " bytes; the range has ${bytes}." } else { !fill ${bytes} - (* - .patch_start), $ea }`,
    );
  });
  out.push("} else {");
  return out;
}

/** The braces that close a patch: one for each alternative, then the zone. */
const closingBraces = (patch: PatchBlock) => ["}".repeat(patch.alternatives.length), "}"];

const withSide = (text: string, side: string | undefined) => (side === undefined ? text : `${text.padEnd(SIDE_COLUMN - 1)} ; ${side}`);

/**
 * The source text of each piece, the main file and the constants. `asBytes`
 * holds the opcode form keys that the probe refused; `numbers` the operand
 * expressions that ACME did not assemble to the image, with the reason.
 */
export function render(layout: Layout, asBytes: ReadonlySet<string>, header: string[], numbers: ReadonlyMap<number, string> = new Map(), asInstructions: ReadonlyMap<number, string> = new Map()): Rendered {
  const lineComments = new Map<number, string[]>();
  const sideComments = new Map<number, string>();
  for (const comment of layout.comments) {
    if (!layout.inImage(comment.address)) continue;
    if (comment.placement === "line") lineComments.set(comment.address, comment.text.split(/\r?\n/));
    else sideComments.set(comment.address, comment.text.replace(/\s*\r?\n\s*/g, " "));
  }
  // A name with an offset (table+5) names an operand only: it is no label, so no line starts there.
  const labelAt = (address: number) => {
    const name = layout.names.get(address);
    return name === undefined || name.includes("+") ? undefined : name;
  };
  const breaks = new Set<number>([...[...layout.names.keys()].filter((address) => labelAt(address) !== undefined), ...lineComments.keys(), ...sideComments.keys()]);
  const result: Rendered = {
    files: [],
    instructions: 0,
    dataBytes: 0,
    undecodedBytes: 0,
    asBytes: [],
    expressions: [],
    operandsAsNumbers: [...layout.operandsAsNumbers],
    patches: 0,
    uses: [],
    macrosAsInstructions: [...layout.macrosAsInstructions],
    macroLines: new Map(),
    labels: [],
    items: [],
  };
  for (const [start, reason] of asInstructions) {
    const use = layout.macroUses.get(start);
    if (use !== undefined) result.macrosAsInstructions.push({ start, end: use.end, macro: use.macro, reason });
  }
  result.macrosAsInstructions.sort((a, b) => a.start - b.start);
  const unwritten = new Map(layout.operandsAsNumbers.map((row) => [row.address, row.expression]));
  const { coverage } = layout;
  const notExecuted = { instructions: 0, ranges: [] as AddressRange[] };

  for (const piece of layout.pieces) {
    const out: string[] = [`; ${piece.title}`, `; ${formatC64Address(piece.start)}-${formatC64Address(piece.end)}`, ""];
    /** True while the instructions before have not executed: they form one range. */
    let running = false;
    /** The line of the mark of the open range of instructions that did not execute. */
    let markLine = 0;
    /** The open patch: its labels are defined before it, so the original code writes none. */
    let patch: PatchBlock | undefined;
    /** The last address of the macro use just written: its instructions are in the use line. */
    let useEnd = -1;
    /** Marks the start of a range of instructions that no run executed, or makes the open range longer. */
    const mark = (address: number, last: number, count: number) => {
      const executed = coverage === undefined || (coverage[address]! & COVERAGE.ramExecute) !== 0;
      if (!executed) {
        if (running) notExecuted.ranges.at(-1)!.end = last;
        else {
          notExecuted.ranges.push({ start: address, end: last });
          markLine = out.length;
          out.push("");
        }
        // The mark gives the range, so a reader finds it in the full list.
        const range = notExecuted.ranges.at(-1)!;
        out[markLine] = `; not executed ${formatC64Address(range.start)}-${formatC64Address(range.end)}`;
        notExecuted.instructions += count;
      }
      running = !executed;
    };
    const head = (address: number) => {
      if (patch?.start === address) return;
      for (const text of lineComments.get(address) ?? []) out.push(`; ${text}`.trimEnd());
      const label = labelAt(address);
      if (label !== undefined && patch === undefined) {
        out.push(label);
        result.labels.push({ address, name: label, file: piece.file, line: out.length });
      }
    };
    const mapLine = (start: number, end: number) => result.items.push({ start, end, file: piece.file, line: out.length });
    for (const item of piece.items) {
      const itemStart = item.kind === "instruction" ? item.address : item.start;
      const opened = layout.patches.get(itemStart);
      if (opened !== undefined) {
        head(itemStart);
        for (const address of opened.inner) {
          out.push(`${layout.names.get(address)!} = * + ${address - opened.start}`);
          result.labels.push({ address, name: layout.names.get(address)!, file: piece.file, line: out.length });
        }
        out.push(...patchOpening(opened));
        patch = opened;
        result.patches++;
      }
      const close = () => {
        const itemEnd = item.kind === "instruction" ? item.address + item.length - 1 : item.end;
        if (patch === undefined || itemEnd !== patch.end) return;
        out.push(...closingBraces(patch));
        patch = undefined;
      };
      if (item.kind === "instruction" && item.address <= useEnd) {
        result.instructions++;
        continue;
      }
      const macroUse = item.kind === "instruction" && !asInstructions.has(item.address) ? layout.macroUses.get(item.address) : undefined;
      if (macroUse !== undefined) {
        head(macroUse.start);
        const count = piece.items.filter((other) => other.kind === "instruction" && other.address >= macroUse.start && other.address <= macroUse.end).length;
        mark(macroUse.start, macroUse.end, count);
        // The comments inside the use go to its side comment, as for the bytes of an instruction.
        const sides: string[] = [];
        for (let address = macroUse.start; address <= macroUse.end; address++) {
          if (address !== macroUse.start) for (const text of lineComments.get(address) ?? []) sides.push(text);
          if (sideComments.has(address)) sides.push(sideComments.get(address)!);
        }
        out.push(withSide(`${INDENT}+${macroUse.macro}${macroUse.args.length === 0 ? "" : ` ${macroUse.args.join(", ")}`}`, sides.length === 0 ? undefined : sides.join(" ")));
        result.uses.push({ start: macroUse.start, end: macroUse.end, macro: macroUse.macro, file: piece.file, line: out.length });
        mapLine(macroUse.start, macroUse.end);
        result.instructions++;
        useEnd = macroUse.end;
        continue;
      }
      if (item.kind === "instruction") {
        head(item.address);
        mark(item.address, item.address + item.length - 1, 1);
        const sides: string[] = [];
        if (sideComments.has(item.address)) sides.push(sideComments.get(item.address)!);
        for (let offset = 1; offset < item.length; offset++) {
          const inside = item.address + offset;
          const label = labelAt(inside);
          if (label !== undefined && patch === undefined) {
            out.push(`${label} = * + ${offset}`);
            result.labels.push({ address: inside, name: label, file: piece.file, line: out.length });
          }
          // A comment at an operand byte (knowledge of an older version) shows with its address, as in the listing of c64-knowledge.
          for (const text of lineComments.get(inside) ?? []) sides.push(`${formatC64Address(inside)}: ${text}`);
          if (sideComments.has(inside)) sides.push(`${formatC64Address(inside)}: ${sideComments.get(inside)!}`);
        }
        const form = formOf(layout, item);
        const { mode } = OPCODES[item.opcode]!;
        const value = mode === "imp" ? 0 : operandValue(item.address, item.opcode, layout.byteAt)!;
        const literal = instructionWith(item.opcode, literalOperand(item.opcode, value));
        let written = layout.operands.get(item.address);
        // An expression that is not written stays visible as a side comment.
        const asNumber = (expression: string, reason: string) => {
          sides.unshift(`= ${expression}`);
          result.operandsAsNumbers.push({ address: item.address, expression, reason });
          written = undefined;
        };
        if (written !== undefined && asBytes.has(form.key)) asNumber(written, "ACME writes this instruction with other bytes, so the source has it as bytes.");
        if (written !== undefined && numbers.has(item.address)) asNumber(written, numbers.get(item.address)!);
        if (unwritten.has(item.address)) sides.unshift(`= ${unwritten.get(item.address)!}`);
        if (asBytes.has(form.key)) {
          const bytes = Array.from({ length: item.length }, (_, offset) => formatC64Byte(layout.byteAt(item.address + offset)));
          out.push(withSide(`${INDENT}!byte ${bytes.join(",")}`, [literal, ...sides].join(" ")));
          result.asBytes.push({ address: item.address, text: literal });
        } else if (written !== undefined) {
          out.push(withSide(`${INDENT}${instructionWith(item.opcode, written, form.suffix)}`, sides.length === 0 ? undefined : sides.join(" ")));
          result.expressions.push({ address: item.address, length: item.length, file: piece.file, line: out.length });
        } else {
          const expression = takesAddress(mode) ? (layout.operandNames.get(item.address) ?? layout.names.get(value) ?? literalOperand(item.opcode, value)) : literalOperand(item.opcode, value);
          out.push(withSide(`${INDENT}${instructionWith(item.opcode, expression, form.suffix)}`, sides.length === 0 ? undefined : sides.join(" ")));
        }
        mapLine(item.address, item.address + item.length - 1);
        result.instructions++;
        close();
        continue;
      }
      running = false;
      const lines = dataLines(item, layout, breaks);
      lines.forEach((line, index) => {
        head(line.address);
        const note = item.type === "undecoded" && index === 0 ? "not decoded" : undefined;
        const side = [note, sideComments.get(line.address)].filter((text) => text !== undefined).join(" ");
        out.push(withSide(`${INDENT}${line.text}`, side === "" ? undefined : side));
        mapLine(line.address, (lines[index + 1]?.address ?? item.end + 1) - 1);
      });
      const bytes = item.end - item.start + 1;
      if (item.type === "undecoded") result.undecodedBytes += bytes;
      else result.dataBytes += bytes;
      close();
    }
    result.files.push({ name: piece.file, text: `${out.join("\n")}\n` });
  }

  if (hasSwitchFile(layout)) result.files.push({ name: "switches.asm", text: switchesText(layout) });
  if (hasConfigFile(layout)) result.files.push({ name: CONFIG_FILE, text: configText(layout) });
  const constants = constantsText(layout);
  result.files.push({ name: "constants.asm", text: constants.text });
  result.labels.push(...constants.labels);
  if (layout.macros.length > 0) {
    const macros = macrosText(layout);
    result.files.push({ name: "macros.asm", text: macros.text });
    result.macroLines = macros.lines;
  }
  const main = [...header.map((line) => `; ${line}`), "", "!cpu 6510", ...(hasSwitchFile(layout) ? ['!source "switches.asm"'] : []), '!source "constants.asm"', ...(layout.macros.length > 0 ? ['!source "macros.asm"'] : [])];
  for (const piece of layout.pieces) {
    if (piece.segmentStart) main.push("", `* = ${formatC64Address(piece.start)}`);
    // Without the leftovers, the build skips their bytes: the addresses after them stay.
    main.push(piece.leftover ? `!if ${LEFTOVERS_SWITCH} { !source "${piece.file}" } else { !skip ${piece.end - piece.start + 1} }` : `!source "${piece.file}"`);
  }
  result.files.push({ name: "main.asm", text: `${main.join("\n")}\n` });
  if (coverage !== undefined) result.notExecuted = notExecuted;
  result.operandsAsNumbers.sort((a, b) => a.address - b.address);
  return result;
}
