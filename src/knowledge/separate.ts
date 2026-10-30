// Evidence from one release: for each range of the image, the unpack
// stage that wrote it and the access class from coverage; for each code
// region of knowledge, whether call and jump references or the run on from
// its last instruction reach it from a root (the entry, and the NMI, RESET
// and IRQ vectors at $fffa-$ffff when the image holds them); and what the program reads
// or executes outside the image. A region that nothing reaches is unknown, not
// dead, while the program has a flow whose targets the knowledge does not give,
// or when no coverage shows what ran. Evidence only: nothing here decides which
// bytes the publisher shipped.

import { type AddressRange, COVERAGE, executedRamCode, instructionLength } from "../c64.ts";
import { OPCODES } from "../opcodes.ts";
import { isSemantic } from "./schema.ts";

export type Access = "executed" | "read" | "written" | "read-written" | "untouched";

export interface SeparationInput {
  segments: AddressRange[];
  /** 64 KiB with the image bytes at their addresses. */
  memory: Uint8Array;
  entry?: number;
  /** The stages of an unpacker capture, in order; the last one is the program. */
  stages?: Array<{ entry: number; wrote: AddressRange[] }>;
  /** Joined coverage files. */
  coverage?: Uint8Array;
  codeRegions: Array<AddressRange & { type: string }>;
  /** A jump or call reference of the user or the LLM also resolves the flow of its instruction. */
  references: Array<{ from: number; to: number; kind: string; origin?: string | undefined }>;
  /** More roots after the entry and the hardware vectors, for example code that a run executed. */
  roots?: Root[];
}

export interface EvidenceRange extends AddressRange {
  /** The last stage that wrote the range; absent when no stage wrote it. */
  stage?: number;
  access?: Access;
}

export interface CodeRegionEvidence extends AddressRange {
  type: string;
  /** Absent when the image has no root: no entry and no hardware vector. */
  reachable?: boolean;
  /** Absent without coverage. */
  executed?: boolean;
  /** Not reached and not executed, but an unresolved flow can go there, or no coverage shows that it did not run. */
  unknown?: true;
}

/**
 * A flow whose targets the knowledge does not give: a JMP (indirect) through
 * a vector that the code's own immediates do not set, a JMP or JSR whose
 * address bytes a run wrote, or an RTS or RTI to an address that the code
 * pushed.
 */
export interface UnresolvedFlow {
  at: number;
  kind: "indirect-jump" | "written-operand" | "pushed-return";
}

/** The computed flows of the code: the targets that the bytes of the program give, and the flows that stay open. */
export interface ComputedFlows {
  targets: Array<{ from: number; to: number }>;
  unresolved: UnresolvedFlow[];
}

/** An address where the reachability starts, and why: the entry, a hardware vector in the image, or a root that the caller gives. */
export interface Root {
  address: number;
  from: "entry" | "NMI vector $fffa" | "RESET vector $fffc" | "IRQ vector $fffe" | "executed code" | "kept range" | "table entry";
}

export interface Separation {
  /** The roots of the reachability, in the order entry, NMI, RESET, IRQ, then the roots of the input. */
  roots: Root[];
  ranges: EvidenceRange[];
  codeRegions: CodeRegionEvidence[];
  /**
   * RAM outside the image and outside pages 0-3, from the coverage: `read`
   * and `executed` the program never wrote (a loader or an earlier stage put
   * those bytes there), and `generated` it wrote and then executed, in
   * pieces of code with gaps of up to two operand bytes.
   */
  outside: { read: AddressRange[]; executed: AddressRange[]; generated: AddressRange[] };
  /** The unresolved flows of the code regions that a root reaches or that a run executed: while one exists, an unreached code region is unknown. */
  unresolved: UnresolvedFlow[];
}

const SYSTEM_PAGES_END = 0x03ff;

/** The hardware vectors of the 6510: the CPU reads them from $fffa-$ffff, the RAM when the KERNAL is banked out. */
const HARDWARE_VECTORS = [
  { at: 0xfffa, from: "NMI vector $fffa" },
  { at: 0xfffc, from: "RESET vector $fffc" },
  { at: 0xfffe, from: "IRQ vector $fffe" },
] as const;

/**
 * The roots of the reachability: the entry, and each hardware vector whose
 * two bytes are in the image. An interrupt handler runs by its vector, and
 * no call or jump reference reaches it.
 */
export function reachabilityRoots(segments: readonly AddressRange[], memory: Uint8Array, entry?: number): Root[] {
  const inImage = (address: number) => segments.some((segment) => address >= segment.start && address <= segment.end);
  const vectors = HARDWARE_VECTORS.filter((vector) => inImage(vector.at) && inImage(vector.at + 1)).map((vector): Root => ({ address: memory[vector.at]! | (memory[vector.at + 1]! << 8), from: vector.from }));
  return [...(entry === undefined ? [] : [{ address: entry, from: "entry" as const }]), ...vectors];
}

/** BRK, JMP, RTI, RTS, JMP (indirect) and the JAM opcodes: the CPU does not run on to the next instruction after them. */
export const NO_FALL_THROUGH = new Set([0x00, 0x4c, 0x40, 0x60, 0x6c, 0x02, 0x12, 0x22, 0x32, 0x42, 0x52, 0x62, 0x72, 0x92, 0xb2, 0xd2, 0xf2]);

/**
 * The address after a code region where the CPU runs on, or undefined when
 * its last instruction does not run on (RTS, RTI, JMP, BRK, JAM). The
 * instructions follow one another from the start of the region.
 */
export function fallThrough(region: AddressRange, memory: Uint8Array): number | undefined {
  let at = region.start;
  let last = at;
  while (at <= region.end) {
    last = at;
    at += instructionLength(memory[at]!);
  }
  return NO_FALL_THROUGH.has(memory[last]!) || at > 0xffff ? undefined : at;
}

/** The instruction starts of code regions: each region runs from its start, one instruction after the other. */
export function regionStarts(regions: readonly AddressRange[], memory: Uint8Array): number[] {
  const starts: number[] = [];
  for (const region of regions) for (let at = region.start; at <= region.end; at += instructionLength(memory[at]!)) starts.push(at);
  return starts.sort((a, b) => a - b);
}

/** The address of the high byte of the vector of a JMP (N): the 6510 reads it from N + 1 in the same page, so JMP ($10ff) reads $1000. */
export const vectorHigh = (vector: number) => (vector & 0xff00) | ((vector + 1) & 0xff);

/** The registers that each instruction changes, other than by a load of an immediate or a transfer. */
export const WRITES_A = new Set(["lda", "adc", "sbc", "and", "ora", "eor", "pla", "lax", "anc", "asr", "arr", "ane", "lxa", "las", "slo", "rla", "sre", "rra", "isc"]);
export const WRITES_X = new Set(["ldx", "inx", "dex", "tsx", "lax", "sbx", "lxa", "las"]);
export const WRITES_Y = new Set(["ldy", "iny", "dey"]);

/** The instructions that change the byte at their operand with a value that no immediate gives. */
const CHANGES_MEMORY = new Set(["inc", "dec", "asl", "lsr", "rol", "ror", "sax", "slo", "rla", "sre", "rra", "dcp", "isc"]);

/**
 * The computed flows of the instructions at `starts`: a JMP (N), a JMP or JSR
 * whose address bytes a run wrote, and an RTS or RTI after pushes in its run
 * of instructions. A jump or call reference of the user or the LLM from the
 * instruction resolves its flow; for a pushed return, also one of the idiom
 * pass, which reads the table of an RTS dispatch. Else the bytes resolve it:
 * each byte holds its image byte and the immediates that the code stores
 * there, and the flow goes to each word of these values. A byte that another
 * write of the code changes, or that a run wrote while no store of the code
 * does, or that is outside the image without such a store, leaves the flow
 * unresolved.
 */
export function computedFlows(input: { starts: readonly number[]; memory: Uint8Array; inImage: (address: number) => boolean; coverage?: Uint8Array | undefined; references: ReadonlyArray<{ from: number; kind: string; origin?: string | undefined }> }): ComputedFlows {
  const { memory } = input;
  const written = (address: number) => input.coverage !== undefined && (input.coverage[address & 0xffff]! & COVERAGE.ramWrite) !== 0;
  const jumpsFrom = (origins: (origin: string | undefined) => boolean) => new Set(input.references.filter((reference) => (reference.kind === "jump" || reference.kind === "call") && origins(reference.origin)).map((reference) => reference.from));
  const resolved = jumpsFrom(isSemantic);
  const fromTable = jumpsFrom((origin) => isSemantic(origin) || origin === "heuristic");
  const starts = [...input.starts].sort((a, b) => a - b);

  // The immediates that the code stores at each address; null when another write changes it.
  const stored = new Map<number, Set<number> | null>();
  const store = (address: number, value: number | undefined) => {
    const known = stored.get(address);
    if (known === null) return;
    stored.set(address, value === undefined ? null : (known ?? new Set<number>()).add(value));
  };
  // The return addresses that the code pushed before an RTS or RTI, as far as immediates give them.
  const returns: Array<{ at: number; low: number | undefined; high: number | undefined; offset: 0 | 1 }> = [];
  let registers: { a?: number | undefined; x?: number | undefined; y?: number | undefined } = {};
  let pushes: Array<number | undefined> = [];
  let previousEnd = -2;
  for (const at of starts) {
    if (at > previousEnd + 1) {
      registers = {};
      pushes = [];
    }
    const opcode = memory[at]!;
    const { mnemonic, mode } = OPCODES[opcode]!;
    const length = instructionLength(opcode);
    previousEnd = at + length - 1;
    const operand = length === 3 ? memory[(at + 1) & 0xffff]! | (memory[(at + 2) & 0xffff]! << 8) : memory[(at + 1) & 0xffff]!;
    if (mode === "zp" || mode === "abs") {
      const register = mnemonic === "sta" ? "a" : mnemonic === "stx" ? "x" : mnemonic === "sty" ? "y" : undefined;
      if (register !== undefined) store(operand, registers[register]);
      else if (CHANGES_MEMORY.has(mnemonic)) store(operand, undefined);
    }
    if (mnemonic === "pha") pushes.push(registers.a);
    if (mnemonic === "php") pushes.push(undefined);
    if (mnemonic === "pla" || mnemonic === "plp") pushes.pop();
    if (mnemonic === "txs") pushes = [];
    if (mnemonic === "rts" && pushes.length >= 2) returns.push({ at, low: pushes.at(-1), high: pushes.at(-2), offset: 1 });
    if (mnemonic === "rti" && pushes.length >= 3) returns.push({ at, low: pushes.at(-2), high: pushes.at(-3), offset: 0 });
    const loaded = mode === "imm" ? operand : undefined;
    if (WRITES_A.has(mnemonic) || (mode === "imp" && ["asl", "lsr", "rol", "ror"].includes(mnemonic))) registers.a = mnemonic === "lda" ? loaded : undefined;
    if (WRITES_X.has(mnemonic)) registers.x = mnemonic === "ldx" ? loaded : undefined;
    if (WRITES_Y.has(mnemonic)) registers.y = mnemonic === "ldy" ? loaded : undefined;
    if (mnemonic === "tax") registers.x = registers.a;
    if (mnemonic === "tay") registers.y = registers.a;
    if (mnemonic === "txa") registers.a = registers.x;
    if (mnemonic === "tya") registers.a = registers.y;
    if (mnemonic === "jsr") registers = {};
    if (NO_FALL_THROUGH.has(opcode)) {
      registers = {};
      pushes = [];
    }
  }

  /** The values of a byte when the code reads it, or undefined when they are not known. */
  const valuesAt = (address: number): number[] | undefined => {
    const own = stored.get(address);
    if (own === null || (own === undefined && (written(address) || !input.inImage(address)))) return undefined;
    return [...new Set([...(own ?? []), ...(input.inImage(address) ? [memory[address]!] : [])])];
  };
  const targets: ComputedFlows["targets"] = [];
  /** Adds a flow from `from` to each word of the bytes at `low` and `high`; false when a byte is not known. */
  const wordsAt = (from: number, low: number, high: number) => {
    const lows = valuesAt(low);
    const highs = valuesAt(high);
    if (lows === undefined || highs === undefined) return false;
    for (const lowByte of lows) for (const highByte of highs) targets.push({ from, to: lowByte | (highByte << 8) });
    return true;
  };
  const unresolved: UnresolvedFlow[] = [];
  for (const at of starts) {
    if (resolved.has(at)) continue;
    const opcode = memory[at]!;
    if (opcode === 0x6c) {
      const vector = memory[(at + 1) & 0xffff]! | (memory[(at + 2) & 0xffff]! << 8);
      if (!wordsAt(at, vector, vectorHigh(vector))) unresolved.push({ at, kind: "indirect-jump" });
    } else if ((opcode === 0x4c || opcode === 0x20) && (written(at + 1) || written(at + 2))) {
      if (!wordsAt(at, (at + 1) & 0xffff, (at + 2) & 0xffff)) unresolved.push({ at, kind: "written-operand" });
    }
  }
  for (const pushed of returns) {
    if (pushed.low !== undefined && pushed.high !== undefined) targets.push({ from: pushed.at, to: ((pushed.low | (pushed.high << 8)) + pushed.offset) & 0xffff });
    else if (!fromTable.has(pushed.at)) unresolved.push({ at: pushed.at, kind: "pushed-return" });
  }
  return { targets, unresolved: unresolved.sort((a, b) => a.at - b.at) };
}

/** The most instructions outside the code regions that the run on from a region goes through, for example an instruction in a dual-use region. */
const MAX_RUN_ON = 16;

/** Joins addresses in order into ranges; `gap` is the most bytes between two addresses in one range. */
function merge(addresses: number[], gap = 0, joins: (from: number, to: number) => boolean = () => true): AddressRange[] {
  const ranges: AddressRange[] = [];
  for (const address of addresses) {
    const last = ranges.at(-1);
    if (last !== undefined && address - last.end - 1 <= gap && joins(last.end, address)) last.end = address;
    else ranges.push({ start: address, end: address });
  }
  return ranges;
}

export function separate(input: SeparationInput): Separation {
  const inImage = (address: number) => input.segments.some((segment) => address >= segment.start && address <= segment.end);
  const executed = new Uint8Array(0x10000);
  if (input.coverage !== undefined) for (const range of executedRamCode(input.coverage, 0, input.memory)) executed.fill(1, range.start, range.end + 1);
  const accessAt = (address: number): Access | undefined => {
    if (input.coverage === undefined) return undefined;
    if (executed[address] === 1) return "executed";
    const flags = input.coverage[address]!;
    const read = (flags & COVERAGE.ramRead) !== 0;
    const written = (flags & COVERAGE.ramWrite) !== 0;
    return read && written ? "read-written" : read ? "read" : written ? "written" : "untouched";
  };
  const stageAt = (address: number): number | undefined => {
    const stages = input.stages ?? [];
    for (let index = stages.length - 1; index >= 0; index--) if (stages[index]!.wrote.some((range) => address >= range.start && address <= range.end)) return index;
    return undefined;
  };

  const ranges: EvidenceRange[] = [];
  for (const segment of input.segments) {
    for (let address = segment.start; address <= segment.end; address++) {
      const stage = stageAt(address);
      const access = accessAt(address);
      const last = ranges.at(-1);
      if (last !== undefined && last.end + 1 === address && last.stage === stage && last.access === access) {
        last.end = address;
        continue;
      }
      ranges.push({ start: address, end: address, ...(stage === undefined ? {} : { stage }), ...(access === undefined ? {} : { access }) });
    }
  }

  const regions = input.codeRegions.filter((region) => input.segments.some((segment) => region.start <= segment.end && segment.start <= region.end));
  // The region of each address: the first region that holds it, as a search in region order finds it.
  const owner = new Int32Array(0x10000).fill(-1);
  regions.forEach((region, index) => {
    for (let address = Math.max(region.start, 0); address <= Math.min(region.end, 0xffff); address++) if (owner[address] === -1) owner[address] = index;
  });
  const holding = (address: number) => (address >= 0 && address <= 0xffff ? owner[address]! : -1);
  const roots = [...reachabilityRoots(input.segments, input.memory, input.entry), ...(input.roots ?? [])];
  // The CPU runs the bytes after the region as instructions: through bytes of no code region (a dual-use
  // instruction, for example) into the next code region, unless one of them does not run on.
  const runOn = (from: number): number | undefined => {
    let at = from;
    for (let count = 0; count <= MAX_RUN_ON && at <= 0xffff && inImage(at); count++) {
      if (holding(at) >= 0) return at;
      if (NO_FALL_THROUGH.has(input.memory[at]!)) return undefined;
      at += instructionLength(input.memory[at]!);
    }
    return undefined;
  };
  const runsOn = regions.flatMap((region) => {
    const next = fallThrough(region, input.memory);
    const to = next === undefined ? undefined : runOn(next);
    return to === undefined ? [] : [{ from: region.end, to }];
  });
  // A store anywhere in the code can change a vector, so the computed flows read every region.
  const computed = computedFlows({ starts: regionStarts(regions, input.memory), memory: input.memory, inImage, coverage: input.coverage, references: input.references });
  // From the regions that hold a root, through call and jump references, the targets of computed flows and the run on, to every region they reach.
  const next = regions.map((): number[] => []);
  for (const flow of [...input.references.filter((reference) => reference.kind === "call" || reference.kind === "jump"), ...computed.targets, ...runsOn]) {
    const from = holding(flow.from);
    const to = holding(flow.to);
    if (from >= 0 && to >= 0) next[from]!.push(to);
  }
  const reached = new Set<number>();
  const queue: number[] = [];
  for (const root of roots) {
    const index = holding(root.address);
    if (index >= 0 && !reached.has(index)) {
      reached.add(index);
      queue.push(index);
    }
  }
  while (queue.length > 0) {
    for (const to of next[queue.pop()!]!) {
      if (reached.has(to)) continue;
      reached.add(to);
      queue.push(to);
    }
  }
  // Undefined without coverage.
  const ran = regions.map((region): boolean | undefined => {
    if (input.coverage === undefined) return undefined;
    for (let address = region.start; address <= region.end; address++) if (executed[address] === 1) return true;
    return false;
  });
  // Only a flow in code that a root reaches or that a run executed can run: a flow in dead code goes nowhere.
  const unresolved = computed.unresolved.filter((flow) => {
    const index = holding(flow.at);
    return index >= 0 && (reached.has(index) || ran[index] === true);
  });
  const codeRegions = regions.map((region, index): CodeRegionEvidence => {
    const unreached = roots.length > 0 && !reached.has(index) && ran[index] !== true;
    return { start: region.start, end: region.end, type: region.type, ...(roots.length === 0 ? {} : { reachable: reached.has(index) }), ...(ran[index] === undefined ? {} : { executed: ran[index] }), ...(unreached && (unresolved.length > 0 || input.coverage === undefined) ? { unknown: true as const } : {}) };
  });

  const read: number[] = [];
  const ranOutside: number[] = [];
  const generated: number[] = [];
  if (input.coverage !== undefined) {
    for (let address = SYSTEM_PAGES_END + 1; address < 0x10000; address++) {
      if (inImage(address)) continue;
      const written = (input.coverage[address]! & COVERAGE.ramWrite) !== 0;
      if (executed[address] === 1) (written ? generated : ranOutside).push(address);
      else if (!written && (input.coverage[address]! & COVERAGE.ramRead) !== 0) read.push(address);
    }
  }
  // The image has no bytes of generated code, so only its opcode bytes count as executed. VICE marks only
  // opcode bytes: a gap of at most two operand bytes outside the image stays inside one piece of code.
  const outsideImage = (from: number, to: number) => {
    for (let address = from + 1; address < to; address++) if (inImage(address)) return false;
    return true;
  };
  return { roots, ranges, codeRegions, outside: { read: merge(read), executed: merge(ranOutside), generated: merge(generated, 2, outsideImage) }, unresolved };
}
