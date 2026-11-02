// The code reach of a program: which blocks of its decoded instructions it
// can run. The reachability runs two times over the blocks. Pass A starts at
// the entry, the hardware vectors and the entries of the tables in use: it
// tells what the program can reach. Pass B also starts at each block that a
// run executed and at the kept and changed ranges: it tells what stays. Code
// that pass B does not reach and that no run executed is unused. Without
// coverage no code is unused. While the code that stays has a flow whose
// targets the knowledge does not give (an indirect jump through a vector that
// the code's own immediates do not set, a jump whose address a run wrote, or
// an RTS to an address that the code pushed), that code is unknown, not
// unused. The leftovers of a generated source, the free ranges of an export
// and the dead and unknown code of the provenance all come from here.

import type { DatabaseSync } from "node:sqlite";

import { type AddressRange, COVERAGE, coverageSeedKinds, findHandoffs, inRanges, mergeRanges, parseTokenized, pointerTableEntries, POINTER_TABLE_TYPES, type PointerTableType, rangesOverlap, subtract } from "../c64.ts";
import { analyze } from "../native/decompiler/analyze.ts";
import { localToolContext } from "../native/local.ts";
import { DECOMPILER_LIMITS } from "../native/types.ts";
import { OPCODES } from "../opcodes.ts";
import { romRanges } from "../platform.ts";
import { identifiers } from "./expression.ts";
import { analyzedBytes, programCoverage, requireProgram, type ProgramImage } from "./program.ts";
import { currentStartScreen, listAnalyzerNames, listOperands, listPatches, listReferences, listRegions, listSymbols, startScreenRanges, type OperandRow, type PatchRow, type ReferenceRow, type RegionRow, type StartScreenRow, type SymbolRow } from "./read.ts";
import { CODE_REGION_TYPES, DEFAULT_SPACE, INSTRUCTION_REGION_TYPES, isSemantic, type RegionType, type Space } from "./schema.ts";
import { computedFlows, NO_FALL_THROUGH, type Root, separate, type UnresolvedFlow, vectorHigh, WRITES_A, WRITES_X, WRITES_Y } from "./separate.ts";

/**
 * The coverage flags that can be a use of the RAM byte: a read or a run of the
 * ROM uses the ROM, not the RAM under it, so a JSR into the KERNAL keeps no byte
 * of the image. The I/O flags stay, as VICE gives each access at $d000-$dfff as I/O.
 */
export const RAM_ACCESS = 0xff & ~(COVERAGE.romRead | COVERAGE.romExecute);

/** The I/O area: two immediates stored there are chip values, such as a timer latch, not an address. */
const IO_AREA: AddressRange = { start: 0xd000, end: 0xdfff };

/** The registers that a JSR gets an address in, low byte first, as the KERNAL and BASIC routines get a pointer. */
const CALL_PAIRS = [
  ["x", "y"],
  ["a", "y"],
  ["a", "x"],
] as const;

export interface CodeReachInput {
  segments: readonly AddressRange[];
  /** 64 KiB with the program at its addresses. */
  memory: Uint8Array;
  entry?: number;
  /** The decoded instructions of the program: start and length. */
  instructions: ReadonlyMap<number, number>;
  coverage?: Uint8Array;
  regions: ReadonlyArray<{ start: number; end: number; type: RegionType }>;
  /** A jump or call reference of the user or the LLM resolves the flow of its instruction. */
  references: ReadonlyArray<{ from: number; to: number; kind: string; origin?: string }>;
  /** The addresses that the operand expression of an instruction names, by the address of each instruction with an operand expression; none for a constant. */
  operandTargets: ReadonlyMap<number, readonly number[]>;
  /** The ranges where the CPU sees ROM and not the RAM of the image: code does not go there, and no address points there. */
  rom?: readonly AddressRange[];
  /** The patch ranges whose bytes can change: their code stays, and a reference from them does not count. */
  changed: readonly AddressRange[];
  /** The ranges whose code stays. */
  keep: readonly AddressRange[];
  /** The ranges whose code is gone. */
  drop: readonly AddressRange[];
}

/** A place where code goes or reads: the instruction (or table) at `from`, and what it names. */
export interface Flow {
  from: number;
  to: number;
}

export interface DataReference {
  from: number;
  start: number;
  end: number;
}

/** A region of the input, cut to a segment. */
export interface ReachRegion {
  start: number;
  end: number;
  type: RegionType;
}

export interface CodeReach {
  /** The regions, cut to the segments. */
  regions: ReachRegion[];
  /** The blocks of the decoded instructions outside the data regions. */
  blocks: AddressRange[];
  flows: Flow[];
  reads: DataReference[];
  /** The tables of addresses or of jumps among the regions, with the targets of their entries. */
  targetsOf: ReadonlyMap<ReachRegion, number[]>;
  /** False when the program has no entry, no hardware vector and no table in use: then no code is unused. */
  rooted: boolean;
  /** For each block: pass A reaches it, or the program has no root. */
  reachable: boolean[];
  /** For each block: a run executed an instruction of it. */
  executed: boolean[];
  /** The blocks that nothing that stays reaches and that no run executed, while no flow is open. */
  unused: AddressRange[];
  /** Code that nothing that stays reaches and that no run executed, which stays because of the flows in `unresolved`. */
  unknown: AddressRange[];
  /** The flows in the code that stays whose targets the knowledge does not give. */
  unresolved: UnresolvedFlow[];
  /** The blocks that stay: the blocks outside `drop` and outside `unused`. */
  stays: AddressRange[];
}

const within = (a: AddressRange, b: AddressRange) => a.start >= b.start && a.end <= b.end;

/** The blocks of the instructions: a block ends after an instruction that does not run on, and before a gap. An instruction inside the one before stays in its block. */
export function blocksOf(instructions: ReadonlyMap<number, number>, memory: Uint8Array): AddressRange[] {
  const blocks: AddressRange[] = [];
  let open = false;
  for (const start of [...instructions.keys()].sort((a, b) => a - b)) {
    const end = Math.min(0xffff, start + instructions.get(start)! - 1);
    const last = blocks.at(-1);
    if (last !== undefined && (start <= last.end || (open && start === last.end + 1))) last.end = Math.max(last.end, end);
    else blocks.push({ start, end });
    open = !NO_FALL_THROUGH.has(memory[start]!);
  }
  return blocks;
}

/**
 * The code flows and the data references of the instructions, the knowledge
 * references and the operand expressions. `indexedEnd` gives the last address
 * that an indexed operand can read.
 */
function flowsOf(input: CodeReachInput, inImage: (address: number) => boolean, indexedEnd: (operand: number) => number) {
  const flows: Flow[] = [];
  const reads: DataReference[] = [];
  const { memory } = input;
  const word = (at: number) => memory[at]! | (memory[(at + 1) & 0xffff]! << 8);
  const rom = (address: number) => inRanges(input.rom ?? [], address);
  // The address of a vector, a table or an RTS target in two immediates of one block: the low byte and the high byte
  // go into a pointer (two stores to N and N+1), into the registers of a JSR, or onto the stack (PHA high, PHA low).
  type Immediate = { at: number; value: number } | undefined;
  const registers: { a: Immediate; x: Immediate; y: Immediate } = { a: undefined, x: undefined, y: undefined };
  const stores = new Map<number, NonNullable<Immediate>>();
  const pushes: Immediate[] = [];
  const pair = (low: Immediate, high: Immediate) => {
    if (low === undefined || high === undefined) return;
    const target = low.value | (high.value << 8);
    if (!inImage(target) || rom(target)) return;
    flows.push({ from: low.at, to: target }, { from: low.at, to: (target + 1) & 0xffff });
    reads.push({ from: low.at, start: target, end: target });
  };
  const endBlock = () => {
    registers.a = registers.x = registers.y = undefined;
    stores.clear();
    pushes.length = 0;
  };
  let previousEnd = -2;
  for (const at of [...input.instructions.keys()].sort((a, b) => a - b)) {
    const opcode = memory[at]!;
    const { mnemonic, mode } = OPCODES[opcode]!;
    if (at > previousEnd + 1) endBlock();
    previousEnd = at + input.instructions.get(at)! - 1;
    const operand = input.instructions.get(at) === 3 ? word(at + 1) : memory[at + 1]!;
    // The registers: a load of an immediate that no operand expression explains, a transfer, a store, a push, a call.
    const loaded = mode === "imm" && !input.operandTargets.has(at) ? { at, value: operand } : undefined;
    if (WRITES_A.has(mnemonic) || (mode === "imp" && ["asl", "lsr", "rol", "ror"].includes(mnemonic))) registers.a = mnemonic === "lda" ? loaded : undefined;
    if (WRITES_X.has(mnemonic)) registers.x = mnemonic === "ldx" ? loaded : undefined;
    if (WRITES_Y.has(mnemonic)) registers.y = mnemonic === "ldy" ? loaded : undefined;
    if (mnemonic === "tax") registers.x = registers.a;
    if (mnemonic === "tay") registers.y = registers.a;
    if (mnemonic === "txa") registers.a = registers.x;
    if (mnemonic === "tya") registers.a = registers.y;
    const stored = { sta: registers.a, stx: registers.x, sty: registers.y }[mnemonic];
    if ((mode === "zp" || mode === "abs") && ["sta", "stx", "sty"].includes(mnemonic) && !inRanges([IO_AREA], operand)) {
      stores.delete(operand);
      if (stored !== undefined) {
        stores.set(operand, stored);
        pair(stored, stores.get((operand + 1) & 0xffff));
        pair(stores.get((operand - 1) & 0xffff), stored);
      }
    }
    if (mnemonic === "pha") {
      pushes.push(registers.a);
      if (pushes.length >= 2) pair(pushes.at(-1), pushes.at(-2));
    }
    if (mnemonic === "pla") pushes.pop();
    if (mnemonic === "jsr") {
      for (const [low, high] of CALL_PAIRS) pair(registers[low], registers[high]);
      registers.a = registers.x = registers.y = undefined;
    }
    switch (mode) {
      case "rel":
        flows.push({ from: at, to: (at + 2 + (operand < 0x80 ? operand : operand - 0x100)) & 0xffff });
        break;
      case "ind": {
        const high = vectorHigh(operand);
        reads.push({ from: at, start: operand, end: operand }, { from: at, start: high, end: high });
        if (inImage(operand) && inImage(high)) flows.push({ from: at, to: memory[operand]! | (memory[high]! << 8) });
        break;
      }
      case "abs":
      case "zp":
        if (opcode === 0x20 || opcode === 0x4c) {
          if (!rom(operand)) flows.push({ from: at, to: operand });
        } else reads.push({ from: at, start: operand, end: operand });
        break;
      case "abx":
      case "aby":
      case "zpx":
      case "zpy":
        reads.push({ from: at, start: operand, end: indexedEnd(operand) });
        break;
      case "izx":
      case "izy":
        reads.push({ from: at, start: operand, end: (operand + 1) & 0xff });
        break;
      default:
        break;
    }
    if (NO_FALL_THROUGH.has(opcode)) endBlock();
  }
  for (const reference of input.references) {
    if (inRanges(input.changed, reference.from)) continue;
    if (reference.kind === "call" || reference.kind === "jump" || reference.kind === "pointer") flows.push({ from: reference.from, to: reference.to });
    reads.push({ from: reference.from, start: reference.to, end: reference.to });
  }
  for (const [at, targets] of input.operandTargets) {
    for (const target of targets) {
      flows.push({ from: at, to: target });
      reads.push({ from: at, start: target, end: target });
    }
  }
  return { flows, reads };
}

/** The entries of a table of addresses or of jumps. */
function tableTargets(table: { start: number; end: number; type: RegionType }, memory: Uint8Array): number[] {
  if (table.type === "jumps") return Array.from({ length: Math.floor((table.end - table.start + 1) / 3) }, (_, index) => table.start + 3 * index);
  return pointerTableEntries(table as { start: number; end: number; type: PointerTableType }, (address) => memory[address]!).map((entry) => entry.target);
}

export const isTable = (type: RegionType) => type === "jumps" || (POINTER_TABLE_TYPES as readonly string[]).includes(type);

/** The code reach of the program: see the head of this file. */
export function codeReach(input: CodeReachInput): CodeReach {
  const inImage = (address: number) => inRanges(input.segments, address);
  const touched = (address: number) => input.coverage !== undefined && (input.coverage[address]! & RAM_ACCESS) !== 0;
  const executed = (address: number) => input.coverage !== undefined && (input.coverage[address]! & COVERAGE.ramExecute) !== 0;
  const regions = input.regions.flatMap((region) => input.segments.filter((segment) => rangesOverlap(region, segment)).map((segment): ReachRegion => ({ start: Math.max(region.start, segment.start), end: Math.min(region.end, segment.end), type: region.type })));
  // The source writes a data region as data, also where the decompiler decoded instructions in it: those are no code.
  const inData = new Uint8Array(0x10000);
  for (const region of regions) if (!INSTRUCTION_REGION_TYPES.includes(region.type)) inData.fill(1, region.start, region.end + 1);
  const instructions = new Map([...input.instructions].filter(([start, length]) => !inData.subarray(start, start + length).includes(1)));
  const blocks = blocksOf(instructions, input.memory);
  // An indexed operand reads in the region that holds it, and in the next region when it is the last byte (table-1,x).
  // Without a region, it can read the 256 bytes from the operand.
  const holding = (address: number) => regions.find((region) => address >= region.start && address <= region.end);
  const indexedEnd = (operand: number) => {
    const holder = holding(operand);
    const next = holder === undefined || holder.end === operand ? holding((operand + 1) & 0xffff) : undefined;
    return next?.end ?? holder?.end ?? Math.min(0xffff, operand + 0xff);
  };
  const { flows, reads } = flowsOf({ ...input, instructions }, inImage, indexedEnd);

  // Tables that a run read or that the knowledge names: their entries can be the only way to code, so they are roots.
  const targetsOf = new Map(regions.filter((region) => isTable(region.type)).map((table) => [table, tableTargets(table, input.memory)]));
  const tableUsers = (table: AddressRange) => reads.filter((read) => read.start <= table.end && table.start <= read.end).map((read) => read.from);
  const tableRoots: Root[] = [];
  for (const [table, targets] of targetsOf) {
    let read = false;
    for (let address = table.start; address <= table.end && !read; address++) read = touched(address);
    if (read || input.references.some((reference) => reference.to >= table.start && reference.to <= table.end)) for (const target of targets) tableRoots.push({ address: target, from: "table entry" });
    for (const from of tableUsers(table)) for (const target of targets) flows.push({ from, to: target });
  }

  const asRegions = (list: readonly AddressRange[]) => list.map((block) => ({ ...block, type: "code" }));
  const references = flows.map((flow) => ({ ...flow, kind: "jump" }));
  const passA = separate({ segments: [...input.segments], memory: input.memory, ...(input.entry === undefined ? {} : { entry: input.entry }), codeRegions: asRegions(blocks), references, roots: tableRoots });
  const rooted = passA.codeRegions.every((region) => region.reachable !== undefined);
  const ran = (block: AddressRange) => {
    for (let address = block.start; address <= block.end; address++) if (executed(address)) return true;
    return false;
  };

  // Pass B: what stays. Blocks in a drop range are gone.
  const candidates = blocks.filter((block) => !input.drop.some((range) => within(block, range)));
  const extra: Root[] = [...tableRoots];
  for (const block of candidates) {
    if (ran(block)) extra.push({ address: block.start, from: "executed code" });
    else if ([...input.keep, ...input.changed].some((range) => rangesOverlap(block, range))) extra.push({ address: block.start, from: "kept range" });
  }
  const passB = separate({ segments: [...input.segments], memory: input.memory, ...(input.entry === undefined ? {} : { entry: input.entry }), codeRegions: asRegions(candidates), references, roots: extra });
  const automatic = input.coverage !== undefined && rooted;
  const unreachableCode = candidates.filter((_, index) => automatic && passB.codeRegions[index]!.reachable === false);
  // A flow that nobody resolved can go to any of that code: it stays, as unknown. Only a flow in code that stays can run.
  const live = candidates.filter((block) => !unreachableCode.includes(block));
  const unresolved =
    unreachableCode.length === 0
      ? []
      : computedFlows({ starts: [...instructions.keys()], memory: input.memory, inImage, coverage: input.coverage, references: input.references }).unresolved.filter((flow) => live.some((block) => flow.at >= block.start && flow.at <= block.end));
  const unused = unresolved.length === 0 ? unreachableCode : [];
  return {
    regions,
    blocks,
    flows,
    reads,
    targetsOf,
    rooted,
    reachable: blocks.map((_, index) => !rooted || passA.codeRegions[index]!.reachable === true),
    executed: blocks.map(ran),
    unused,
    unknown: unresolved.length === 0 ? [] : mergeRanges(unreachableCode),
    unresolved,
    stays: candidates.filter((block) => !unused.includes(block)),
  };
}

// --- The input from the knowledge ---------------------------------------------

/** The knowledge of one space that the decode and the code reach read. */
export interface CodeKnowledge {
  program: ProgramImage;
  coverage: Uint8Array | undefined;
  symbols: SymbolRow[];
  /** The routines of every origin: an analyzer routine is an entry point for the decode too. */
  routines: number[];
  regions: RegionRow[];
  references: ReferenceRow[];
  operands: OperandRow[];
  patches: PatchRow[];
  startScreen: StartScreenRow | undefined;
}

/** The knowledge of one space that the decode and the code reach read, read once. */
export function codeKnowledge(db: DatabaseSync | undefined, space: Space = DEFAULT_SPACE): CodeKnowledge {
  const symbols = listSymbols(db, undefined, undefined, undefined, space);
  return {
    program: requireProgram(db, space),
    // The coverage of the space: a run of the C64, or of a captured stage that coverage put into that space.
    coverage: programCoverage(db, space)?.map,
    symbols,
    routines: [...symbols, ...listAnalyzerNames(db, undefined, undefined, undefined, space)].filter((symbol) => symbol.kind === "routine").map((symbol) => symbol.address),
    regions: listRegions(db, undefined, undefined, undefined, space),
    references: listReferences(db, undefined, undefined, undefined, space),
    operands: listOperands(db, undefined, undefined, space),
    patches: listPatches(db, undefined, undefined, undefined, space),
    // The start screen is of the C64 program: the loader shows it.
    startScreen: space === DEFAULT_SPACE ? currentStartScreen(db, space) : undefined,
  };
}

/** The byte of the image at an address, or undefined outside its segments. */
const imageByte = (image: ProgramImage) => (address: number) => (inRanges(image.segments, address) ? image.byteAt(address) : undefined);

/** Where the CPU sees ROM in the image (romRanges): the entry, the routines, the code regions and `entries` stay code. */
function romOf(image: ProgramImage, knowledge: Pick<CodeKnowledge, "routines" | "regions">, entries: readonly number[], coverage: Uint8Array | undefined): AddressRange[] {
  const code = knowledge.regions.filter((region) => INSTRUCTION_REGION_TYPES.includes(region.type)).map((region) => region.start);
  const known = [...(image.entry === undefined ? [] : [image.entry]), ...entries, ...knowledge.routines, ...code];
  return romRanges(coverage, image.state, imageByte(image), known);
}

/**
 * The decompiler's instruction starts and lengths inside the image, seeded from the
 * entry, from knowledge of any origin, and from the coverage: a run's flow
 * starts, also after a JSR, so code that an analyzer does not reach by itself
 * is in the source. A program without a seed has no known code: it is data
 * only, and the decompiler does not run.
 */
export async function decodeProgram(image: ProgramImage, knowledge: Pick<CodeKnowledge, "routines" | "regions">, entries: readonly number[], coverage: Uint8Array | undefined): Promise<{ instructions: Map<number, number>; dataOnly: boolean }> {
  const inImage = (address: number) => inRanges(image.segments, address);
  const seeds = new Set<number>([...(image.entry === undefined ? [] : [image.entry]), ...entries]);
  for (const address of knowledge.routines) seeds.add(address);
  const flows = coverage === undefined ? { routines: [], codeStarts: [] } : coverageSeedKinds(coverage, imageByte(image));
  for (const address of flows.routines) seeds.add(address);
  for (const region of knowledge.regions) {
    if (CODE_REGION_TYPES.includes(region.type)) seeds.add(region.start);
    if (region.type === "jumps") for (let at = region.start; at + 2 <= region.end; at += 3) seeds.add(at);
  }
  const entryPoints = [...seeds].filter(inImage).sort((a, b) => a - b);
  if (entryPoints.length === 0) {
    // An entry in no segment is a capture fault: the image is data only, and the result says entryOutside.
    return { instructions: new Map(), dataOnly: image.entry === undefined || inImage(image.entry) };
  }
  const dataRanges = knowledge.regions
    .filter((region) => !INSTRUCTION_REGION_TYPES.includes(region.type))
    .flatMap((region) => image.segments.filter((segment) => rangesOverlap(region, segment)).map((segment) => ({ start: Math.max(region.start, segment.start), end: Math.min(region.end, segment.end) })));
  // A JSR into ROM runs the ROM: the RAM bytes of the image under it are data, not the code of the call.
  for (const range of romOf(image, knowledge, entries, coverage)) if (!dataRanges.some((data) => rangesOverlap(range, data))) dataRanges.push(range);
  const { result } = await analyze(
    {
      imageKind: analyzedBytes(image).kind,
      entryPoints: entryPoints.slice(0, DECOMPILER_LIMITS.entryPoints),
      codeStarts: flows.codeStarts.filter((address) => !seeds.has(address)).slice(0, DECOMPILER_LIMITS.codeStarts),
      dataRanges: dataRanges.slice(0, DECOMPILER_LIMITS.dataRanges),
      labels: [],
      decompile: [],
    },
    analyzedBytes(image).bytes,
    localToolContext(),
  );
  const instructions = new Map<number, number>();
  for (const instruction of result.instructions) {
    const bytes = Buffer.from(instruction.bytes, "hex");
    const inside = Array.from({ length: bytes.length }, (_, offset) => instruction.address + offset).every((address, offset) => inImage(address) && image.byteAt(address) === bytes[offset]);
    if (inside) instructions.set(instruction.address, bytes.length);
  }
  return { instructions, dataOnly: false };
}

/** The parts of a region outside the holes. A part that is not the whole region has no element size: its length need not be a multiple of it. */
export function clipped<R extends { start: number; end: number; element?: number }>(region: R, holes: readonly AddressRange[]): R[] {
  return subtract(region, [...holes]).map((piece) => {
    if (piece.start === region.start && piece.end === region.end) return region;
    const part = { ...region, ...piece };
    delete part.element;
    return part;
  });
}

/** The regions that decide the memory map: the user and LLM regions, and the parts of analyzer regions outside them. */
export function effectiveRegions(regions: RegionRow[]): RegionRow[] {
  const semantic = regions.filter((region) => isSemantic(region.origin));
  const holes = semantic.map((region) => ({ start: region.start, end: region.end }));
  return [...semantic, ...regions.filter((region) => !isSemantic(region.origin)).flatMap((region) => clipped(region, holes))].sort((a, b) => a.start - b.start);
}

/**
 * The BASIC line that starts a PRG: its bytes, and the address of its first
 * SYS when the image holds it (the entry of a PRG without one in the
 * knowledge). Undefined when the first segment holds no BASIC line with a SYS.
 */
function basicStart(image: ProgramImage): { line: AddressRange; entry?: number } | undefined {
  const first = image.segments[0];
  if (first === undefined) return undefined;
  const tokenized = parseTokenized(Uint8Array.from([first.start & 0xff, first.start >> 8, ...image.memory.subarray(first.start, first.end + 1)]));
  if ("reason" in tokenized) return undefined;
  const sys = findHandoffs(tokenized.lines).find((handoff) => handoff.kind === "sys");
  if (sys === undefined) return undefined;
  const line = { start: first.start, end: Math.min(first.end, tokenized.basicEnd - 1) };
  const address = "address" in sys ? sys.address : undefined;
  return address !== undefined && inRanges(image.segments, address) ? { line, entry: address } : { line };
}

/**
 * The input of the code reach of a program from the knowledge. `memory` and
 * `instructions` are of the build that the code is in. `basic` is the BASIC
 * line that starts the program: RUN reads it, which no coverage from the entry
 * shows.
 */
export function reachInput(
  knowledge: Pick<CodeKnowledge, "program" | "coverage" | "symbols" | "routines" | "regions" | "references" | "operands">,
  memory: Uint8Array,
  instructions: ReadonlyMap<number, number>,
  ranges: { changed: readonly AddressRange[]; keep: readonly AddressRange[]; drop: readonly AddressRange[] },
): CodeReachInput & { basic?: AddressRange } {
  const image = knowledge.program;
  const addressOf = new Map(knowledge.symbols.map((symbol) => [symbol.name, symbol.address]));
  const operandTargets = new Map<number, number[]>();
  for (const operand of knowledge.operands) {
    const names = operand.symbol !== undefined ? [operand.symbol] : identifiers(operand.expression ?? "");
    const targets = names.flatMap((item) => (addressOf.has(item) ? [(addressOf.get(item)! + (operand.symbol !== undefined ? operand.offset : 0)) & 0xffff] : []));
    operandTargets.set(operand.address, targets);
  }
  const basic = basicStart(image);
  const entry = image.entry ?? basic?.entry;
  return {
    segments: image.segments,
    memory,
    ...(entry === undefined ? {} : { entry }),
    instructions,
    ...(knowledge.coverage === undefined ? {} : { coverage: knowledge.coverage }),
    regions: effectiveRegions(knowledge.regions),
    references: knowledge.references,
    operandTargets,
    rom: romOf(image, knowledge, [], knowledge.coverage),
    ...(basic === undefined ? {} : { basic: basic.line }),
    changed: [...ranges.changed],
    keep: [...ranges.keep],
    drop: [...ranges.drop],
  };
}

/** The names and the four-digit hex addresses that the code of a patch has: a switch can go to them, so they stay. */
function patchTargets(code: string, addressOf: ReadonlyMap<string, number>): number[] {
  const words = code.replace(/;.*$/gm, "").match(/\$[0-9a-fA-F]{4}\b|[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  return words.flatMap((word) => (word.startsWith("$") ? [Number.parseInt(word.slice(1), 16)] : addressOf.has(word) ? [addressOf.get(word)!] : []));
}

/**
 * The input of the code reach for the leftovers of the program as it is. The
 * start screen in the program, the patches, what the code of a patch names
 * and the ranges of `kept` stay, so each switch builds without the leftovers.
 */
export function leftoverInput(knowledge: CodeKnowledge, instructions: ReadonlyMap<number, number>, kept: readonly AddressRange[] = []): CodeReachInput & { basic?: AddressRange } {
  const image = knowledge.program;
  const inImage = (range: AddressRange) => image.segments.some((segment) => range.start >= segment.start && range.end <= segment.end);
  const addressOf = new Map(knowledge.symbols.map((symbol) => [symbol.name, symbol.address]));
  const screenParts = knowledge.startScreen === undefined || knowledge.startScreen.stage !== undefined ? [] : startScreenRanges(knowledge.startScreen).map((part) => part.range);
  const named = knowledge.patches.flatMap((patch) => patchTargets(patch.code, addressOf)).map((address) => ({ start: address, end: address }));
  const keep = [...screenParts, ...kept, ...named].map((range) => ({ start: range.start, end: range.end })).filter(inImage);
  const changed = knowledge.patches.map((patch) => ({ start: patch.start, end: patch.end })).filter(inImage);
  return reachInput(knowledge, image.memory, instructions, { changed, keep, drop: [] });
}
