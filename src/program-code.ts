// The code of a program from the knowledge: the decode of the decompiler, and
// the input of the code reach (src/knowledge/code-reach.ts). It joins the
// knowledge with the native decompiler and the ROM map of the platform, for
// c64-source and c64-provenance.

import { type AddressRange, coverageSeedKinds, findHandoffs, inRanges, parseTokenized, rangesOverlap } from "./c64.ts";
import { type CodeKnowledge, type CodeReachInput, effectiveRegions } from "./knowledge/code-reach.ts";
import { identifiers } from "./knowledge/expression.ts";
import { analyzedBytes, type ProgramImage } from "./knowledge/program.ts";
import { startScreenRanges } from "./knowledge/read.ts";
import { CODE_REGION_TYPES, INSTRUCTION_REGION_TYPES } from "./knowledge/schema.ts";
import { analyze } from "./native/decompiler/analyze.ts";
import { localToolContext } from "./native/local.ts";
import { DECOMPILER_LIMITS } from "./native/types.ts";
import { romRanges } from "./platform.ts";

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
  // The bytes that the decompiler reads: one copy of the memory with the pages of the entry state.
  const analyzed = analyzedBytes(image);
  const { result } = await analyze(
    {
      imageKind: analyzed.kind,
      entryPoints: entryPoints.slice(0, DECOMPILER_LIMITS.entryPoints),
      codeStarts: flows.codeStarts.filter((address) => !seeds.has(address)).slice(0, DECOMPILER_LIMITS.codeStarts),
      dataRanges: dataRanges.slice(0, DECOMPILER_LIMITS.dataRanges),
      labels: [],
      decompile: [],
    },
    analyzed.bytes,
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
