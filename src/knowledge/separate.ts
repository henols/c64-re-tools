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
  references: Array<{ from: number; to: number; kind: string }>;
  /** The instructions with a reference of the user or the LLM from them: the LLM recorded the targets of their flows. */
  resolvedSites?: ReadonlySet<number>;
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
 * a vector that a run wrote or that is not in the image, or a JMP or JSR whose
 * address bytes a run wrote.
 */
export interface UnresolvedFlow {
  at: number;
  kind: "indirect-jump" | "written-operand";
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
  /** The unresolved flows of the code regions: while one exists, an unreached code region is unknown. */
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

/**
 * The vectors that the program sets with its own immediates: an LDA, LDX or
 * LDY # and a store to N, and the same to N + 1, in one run of instructions.
 * A JMP (N) then goes where those immediates point, which the flows of the
 * stores give.
 */
export function immediateVectors(starts: readonly number[], memory: Uint8Array): Set<number> {
  const stored = new Set<number>();
  let registers: { a?: number | undefined; x?: number | undefined; y?: number | undefined } = {};
  let previousEnd = -2;
  for (const at of [...starts].sort((a, b) => a - b)) {
    if (at > previousEnd + 1) registers = {};
    const opcode = memory[at]!;
    const length = instructionLength(opcode);
    previousEnd = at + length - 1;
    const operand = length === 3 ? memory[at + 1]! | (memory[(at + 2) & 0xffff]! << 8) : memory[(at + 1) & 0xffff]!;
    const store = (value: number | undefined) => {
      if (value !== undefined) stored.add(operand);
    };
    switch (opcode) {
      case 0xa9: registers.a = operand; break;
      case 0xa2: registers.x = operand; break;
      case 0xa0: registers.y = operand; break;
      case 0x85: case 0x8d: store(registers.a); break;
      case 0x86: case 0x8e: store(registers.x); break;
      case 0x84: case 0x8c: store(registers.y); break;
      case 0xaa: registers.x = registers.a; break;
      case 0xa8: registers.y = registers.a; break;
      case 0x8a: registers.a = registers.x; break;
      case 0x98: registers.a = registers.y; break;
      default: registers = {};
    }
    if (NO_FALL_THROUGH.has(opcode)) registers = {};
  }
  return new Set([...stored].filter((address) => stored.has((address + 1) & 0xffff)));
}

/**
 * The unresolved flows of the instructions at `starts`. A flow is resolved
 * when a reference of the user or the LLM goes from it. An indirect jump is
 * also resolved when the program's own immediates set its vector, or when the
 * vector is in the image and no run wrote it.
 */
export function unresolvedFlows(input: { starts: readonly number[]; memory: Uint8Array; inImage: (address: number) => boolean; coverage?: Uint8Array | undefined; resolvedSites?: ReadonlySet<number> | undefined }): UnresolvedFlow[] {
  const written = (address: number) => input.coverage !== undefined && (input.coverage[address & 0xffff]! & COVERAGE.ramWrite) !== 0;
  const vectors = immediateVectors(input.starts, input.memory);
  const flows: UnresolvedFlow[] = [];
  for (const at of input.starts) {
    if (input.resolvedSites?.has(at) === true) continue;
    const opcode = input.memory[at]!;
    if (opcode === 0x6c) {
      const vector = input.memory[(at + 1) & 0xffff]! | (input.memory[(at + 2) & 0xffff]! << 8);
      if (vectors.has(vector)) continue;
      if (input.inImage(vector) && input.inImage((vector + 1) & 0xffff) && !written(vector) && !written(vector + 1)) continue;
      flows.push({ at, kind: "indirect-jump" });
    } else if ((opcode === 0x4c || opcode === 0x20) && (written(at + 1) || written(at + 2))) flows.push({ at, kind: "written-operand" });
  }
  return flows;
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
  // From the regions that hold a root, through call and jump references and the run on, to every region they reach.
  const next = regions.map((): number[] => []);
  for (const flow of [...input.references.filter((reference) => reference.kind === "call" || reference.kind === "jump"), ...runsOn]) {
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
  const unresolved = unresolvedFlows({ starts: regionStarts(regions, input.memory), memory: input.memory, inImage, coverage: input.coverage, resolvedSites: input.resolvedSites });
  const codeRegions = regions.map((region, index): CodeRegionEvidence => {
    let ran: boolean | undefined;
    if (input.coverage !== undefined) {
      ran = false;
      for (let address = region.start; address <= region.end && !ran; address++) ran = executed[address] === 1;
    }
    const unreached = roots.length > 0 && !reached.has(index) && ran !== true;
    return { start: region.start, end: region.end, type: region.type, ...(roots.length === 0 ? {} : { reachable: reached.has(index) }), ...(ran === undefined ? {} : { executed: ran }), ...(unreached && (unresolved.length > 0 || input.coverage === undefined) ? { unknown: true as const } : {}) };
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
