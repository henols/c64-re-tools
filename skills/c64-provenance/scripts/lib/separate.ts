// Evidence from one release: for each range of the image, the unpack
// stage that wrote it and the access class from coverage; for each code
// region of knowledge, whether call and jump references or the run on from
// its last instruction reach it from a root (the entry, and the NMI, RESET
// and IRQ vectors at $fffa-$ffff when the image holds them); and what the program reads
// or executes outside the image. Evidence only: nothing here decides what is
// original.

import { type AddressRange, COVERAGE, executedRamCode, instructionLength } from "#src/c64.ts";

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
}

/** An address where the reachability starts, and why: the entry, or a hardware vector in the image. */
export interface Root {
  address: number;
  from: "entry" | "NMI vector $fffa" | "RESET vector $fffc" | "IRQ vector $fffe";
}

export interface Separation {
  /** The roots of the reachability, in the order entry, NMI, RESET, IRQ. */
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
const NO_FALL_THROUGH = new Set([0x00, 0x4c, 0x40, 0x60, 0x6c, 0x02, 0x12, 0x22, 0x32, 0x42, 0x52, 0x62, 0x72, 0x92, 0xb2, 0xd2, 0xf2]);

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

  // Reachability: from the regions that hold a root, through call and jump references and the run on
  // from the last instruction of a region into the next address, to a fixed point.
  const regions = input.codeRegions.filter((region) => input.segments.some((segment) => region.start <= segment.end && segment.start <= region.end));
  const holding = (address: number) => regions.findIndex((region) => address >= region.start && address <= region.end);
  const roots = reachabilityRoots(input.segments, input.memory, input.entry);
  const reached = new Set<number>();
  for (const root of roots) if (holding(root.address) >= 0) reached.add(holding(root.address));
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
  const flows = [...input.references.filter((reference) => reference.kind === "call" || reference.kind === "jump"), ...runsOn];
  for (let grown = true; grown; ) {
    grown = false;
    for (const flow of flows) {
      const from = holding(flow.from);
      const to = holding(flow.to);
      if (from >= 0 && to >= 0 && reached.has(from) && !reached.has(to)) {
        reached.add(to);
        grown = true;
      }
    }
  }
  const codeRegions = regions.map((region, index): CodeRegionEvidence => {
    let ran: boolean | undefined;
    if (input.coverage !== undefined) {
      ran = false;
      for (let address = region.start; address <= region.end && !ran; address++) ran = executed[address] === 1;
    }
    return { start: region.start, end: region.end, type: region.type, ...(roots.length === 0 ? {} : { reachable: reached.has(index) }), ...(ran === undefined ? {} : { executed: ran }) };
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
  return { roots, ranges, codeRegions, outside: { read: merge(read), executed: merge(ranOutside), generated: merge(generated, 2, outsideImage) } };
}
