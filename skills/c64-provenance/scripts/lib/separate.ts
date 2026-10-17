// Evidence from one release: for each range of the image, the unpack
// stage that wrote it and the access class from coverage; for each code
// region of knowledge, whether call and jump references reach it from the
// entry; and what the program reads or executes outside the image. Evidence
// only: nothing here decides what is original.

import { type AddressRange, COVERAGE, executedRamCode } from "#src/c64.ts";

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
  /** Absent when the image has no entry. */
  reachable?: boolean;
  /** Absent without coverage. */
  executed?: boolean;
}

export interface Separation {
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

  // Reachability: from the region that holds the entry, through call and jump references, to a fixed point.
  const regions = input.codeRegions.filter((region) => input.segments.some((segment) => region.start <= segment.end && segment.start <= region.end));
  const holding = (address: number) => regions.findIndex((region) => address >= region.start && address <= region.end);
  const reached = new Set<number>();
  if (input.entry !== undefined && holding(input.entry) >= 0) reached.add(holding(input.entry));
  const flows = input.references.filter((reference) => reference.kind === "call" || reference.kind === "jump");
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
    return { start: region.start, end: region.end, type: region.type, ...(input.entry === undefined ? {} : { reachable: reached.has(index) }), ...(ran === undefined ? {} : { executed: ran }) };
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
  return { ranges, codeRegions, outside: { read: merge(read), executed: merge(ranOutside), generated: merge(generated, 2, outsideImage) } };
}
