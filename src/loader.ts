// The packed loader program of a generated source. Exomizer packs the loaded
// ranges of the build of main.asm (from $0400) and the build of loader.asm,
// which holds the copier and the bytes of pages 0-3, into one program that
// unpacks itself and starts the copier with all RAM visible ($01 = $34).
// c64-source packs it for the loader that it checks; c64-assembler packs it
// for other switch values, from the same files and with the same parts. The
// loaded ranges are the segments of the program without the leftovers: a
// leftover file of the source gives its range in its first line. Also the
// placement of pieces in free ranges, which the packed form and the show
// stage of a start screen use.

import { type AddressRange, formatC64Address, formatC64Range, hexWord, prgOf, prgRange, subtract } from "./c64.ts";
import { compareBuild, mergedPrograms } from "./compare.ts";
import { Refusal } from "./errors.ts";
import { pack } from "./native/exomizer.ts";
import type { ToolContext } from "./native/run.ts";
import type { AssembledSymbol } from "./native/types.ts";

/** The label of the copier in loader.asm. In the packed form, its address is the copier address, where the unpack jumps. */
export const COPIER_SOURCE = "loader_copier_src";

/** The memory configuration at the start of the copier of the packed form: all RAM visible. */
const PACKED_EXIT_MEMORY = 0x34;

/** The pages that the unpacker of Exomizer uses: the copier of the packed form writes them, so main.asm is packed from here. */
const PACKED_FROM = 0x0400;

/** The label of a block of loader.asm: its first byte and the byte after it in the loader file, and its first address where it runs. A piece of pages 0-3 of the packed form has the labels of its target. */
export const blockLabel = (start: number, part: "from" | "end" | "to") => `loader_${part}_${hexWord(start)}`;
/** The first label of a block, with its first address where it runs. */
const BLOCK_FROM = /^loader_from_([0-9a-f]{4})$/;

/** The first line of a leftover file: `; Leftovers $xxxx-$yyyy: ...`. */
const LEFTOVER_RANGE = /^; Leftovers (\$[0-9a-f]{4})-(\$[0-9a-f]{4}):/m;

/** The range of a leftover file of a generated source, from its first line. Undefined for a text without that line. */
export function leftoverRange(text: string): AddressRange | undefined {
  const found = LEFTOVER_RANGE.exec(text);
  return found === null ? undefined : { start: Number.parseInt(found[1]!.slice(1), 16), end: Number.parseInt(found[2]!.slice(1), 16) };
}

/** The ranges that the packed loader loads from a build of main.asm: the segments of the program without the leftovers. */
export function packedRanges(segments: readonly AddressRange[], leftovers: readonly AddressRange[]): AddressRange[] {
  return [...segments].sort((a, b) => a.start - b.start).flatMap((segment) => subtract(segment, leftovers));
}

/**
 * Checks the two builds of the packed form before the pack: the build of
 * main.asm holds each loaded range, and the build of loader.asm has the bytes
 * of the build of main.asm where it holds them. These are the bytes of the
 * program between its free ranges, and the pieces of the loaded ranges below
 * $0400, which the copier copies into place after the unpack (`symbols`, the
 * labels of the build of loader.asm, give the pieces). A patch of a switch
 * there changes the bytes, and the copier build would put the old bytes
 * back. Refuses by name.
 */
export function checkPackedBuilds(main: Uint8Array, copier: Uint8Array, symbols: readonly AssembledSymbol[], loaded: readonly AddressRange[]): void {
  const program = prgRange(main);
  const outside = loaded.find((range) => range.start < program.start || range.end > program.end);
  if (outside !== undefined) {
    throw new Refusal("invalid-input", `The build of main.asm does not hold ${formatC64Range(outside)} of the program in the knowledge. Generate the source again from the knowledge.`);
  }
  const build = prgRange(copier);
  const changed = (address: number, where: string) =>
    new Refusal("invalid-input", `These switch values change the byte at ${formatC64Address(address)}, ${where}, and loader.asm holds the byte of generate there. Set the switch values in config.asm, and generate the source with the loader.`);
  for (const range of loaded) {
    for (let address = Math.max(range.start, build.start); address <= Math.min(range.end, build.end); address++) {
      if (build.body[address - build.start] !== program.body[address - program.start]) throw changed(address, `between the free ranges of loader.asm (${formatC64Range(build)})`);
    }
  }
  // The pieces below $0400: each from its first label to its end label in the build of loader.asm.
  const labels = new Map(symbols.map((symbol) => [symbol.name, symbol.kind === "address" ? symbol.address : symbol.value]));
  const pieces = [...labels].flatMap(([name, at]) => {
    const found = BLOCK_FROM.exec(name);
    if (found === null) return [];
    const target = Number.parseInt(found[1]!, 16);
    const end = labels.get(blockLabel(target, "end"));
    return end === undefined ? [] : [{ target, at, length: end - at }];
  });
  for (const range of loaded) {
    for (let address = Math.max(range.start, 0x0002); address <= Math.min(range.end, PACKED_FROM - 1); address++) {
      const piece = pieces.find((item) => address >= item.target && address < item.target + item.length);
      const at = piece === undefined ? undefined : piece.at + address - piece.target;
      if (at === undefined || at < build.start || at > build.end) {
        throw new Refusal("invalid-input", `loader.asm holds no byte for ${formatC64Address(address)} of the program. Generate the source with the loader again.`);
      }
      if (build.body[at - build.start] !== program.body[address - program.start]) throw changed(address, "below $0400");
    }
  }
}

/** What Exomizer makes of a packed loader. */
export interface PackedLoader {
  /** The loader program: it loads at $0801 and starts with RUN. */
  program: Buffer;
  packedBytes: number;
  unpackedBytes: number;
  /** The CPU cycles of the unpack, when Exomizer gives them. */
  cycles?: number;
}

/**
 * Packs the loaded ranges of the build of main.asm from $0400 and the build of
 * loader.asm (the copier wins where they overlap) with the entry at the copier
 * and $01 = $34, and checks the unpack in the emulator of Exomizer: every byte
 * of the two builds, and the jump to the copier. Refuses by name when it does
 * not hold.
 */
export async function packLoader(main: Uint8Array, copier: Uint8Array, plan: { loaded: readonly AddressRange[]; copier: number }, context: ToolContext): Promise<PackedLoader> {
  return packParts(packedParts(main, copier, plan.loaded), plan.copier, PACKED_EXIT_MEMORY, "main.asm and loader.asm", "the copier", context);
}

/** What Exomizer packs in the packed form: the loaded ranges of the build of main.asm from $0400, and the build of loader.asm. */
function packedParts(main: Uint8Array, copier: Uint8Array, loaded: readonly AddressRange[]): Array<{ start: number; body: Uint8Array }> {
  // The unpacker uses pages 0-3; the copier writes them. The leftovers between the loaded ranges are not packed.
  const program = prgRange(main);
  const ranges = loaded.flatMap((range) => {
    const start = Math.max(range.start, PACKED_FROM, program.start);
    const end = Math.min(range.end, program.end);
    return start <= end ? [{ start, body: program.body.subarray(start - program.start, end - program.start + 1) }] : [];
  });
  return [...ranges, prgRange(copier)];
}

/**
 * Packs parts (a later one wins where they overlap) into one program that
 * unpacks itself, starts at `entry` with $01 = `exitMemory`, and checks the
 * unpack in the emulator of Exomizer: every byte of the parts, and the jump
 * to the entry. Refuses by name when it does not hold.
 */
export async function packParts(parts: ReadonlyArray<{ start: number; body: Uint8Array }>, entry: number, exitMemory: number, what: string, entryName: string, context: ToolContext): Promise<PackedLoader> {
  const packed = await pack({ programs: parts.map((part) => prgOf(part.start, part.body)), entry, exitMemory }, context);
  if (packed.entry !== entry) throw new Refusal("operation-failed", `The unpack in the emulator of Exomizer jumps to ${formatC64Address(packed.entry)}, not to ${entryName} at ${formatC64Address(entry)}.`);
  const reference = mergedPrograms(parts);
  const wrong = compareBuild(packed.unpacked, reference).segments.find((segment) => segment.result !== "identical");
  if (wrong !== undefined) {
    const first = wrong.firstDifference === undefined ? "" : `: the first is ${wrong.firstDifference.address}, ${wrong.firstDifference.built} and not ${wrong.firstDifference.reference}`;
    throw new Refusal("operation-failed", `The unpack in the emulator of Exomizer does not give ${wrong.start}-${wrong.end} of ${what} (${wrong.result}${first}).`);
  }
  const unpackedBytes = reference.segments.reduce((sum, segment) => sum + segment.end - segment.start + 1, 0);
  return { program: packed.program, packedBytes: packed.program.length, unpackedBytes, ...(packed.cycles === undefined ? {} : { cycles: packed.cycles }) };
}

/**
 * The symbols of the loader program: the labels of the build of loader.asm,
 * of the build of main.asm, and of start_screen_stage.asm when the loader has
 * a show stage. A test takes one symbols file. Refuses a name with two values.
 */
export function loaderSymbols(...builds: ReadonlyArray<readonly AssembledSymbol[]>): AssembledSymbol[] {
  const valueOf = (symbol: AssembledSymbol) => (symbol.kind === "address" ? symbol.address : symbol.value);
  const byName = new Map<string, AssembledSymbol>();
  for (const symbol of builds.flat()) {
    const known = byName.get(symbol.name);
    if (known !== undefined && valueOf(known) !== valueOf(symbol)) {
      throw new Refusal("operation-failed", `The builds of the loader program give ${symbol.name} two values, ${valueOf(known)} and ${valueOf(symbol)}. This is a defect of the script.`);
    }
    // An address in one build can be outside the load range of the other build, where it is a constant.
    const kept = known === undefined || (known.kind === "constant" && symbol.kind === "address") ? symbol : known;
    byName.set(symbol.name, { ...kept, used: symbol.used || (known?.used ?? false) });
  }
  return [...byName.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** The settings that loader.asm and the show stage include: switches.asm, else config.asm for a start screen, else none. */
export function settingsLines(source: { switches?: boolean; config?: boolean }): string[] {
  if (source.switches === true) return ['!source "switches.asm"'];
  return source.config === true ? ['!source "config.asm"'] : [];
}

/** The free ranges that a refusal names. */
const SHOWN_FREE = 8;

/** The largest free ranges with their sizes, for a refusal: at most SHOWN_FREE of them, or none. */
export function largestFree(ranges: readonly AddressRange[]): string {
  const shown = [...ranges].sort((a, b) => b.end - b.start - (a.end - a.start)).slice(0, SHOWN_FREE);
  return shown.length === 0 ? "none" : shown.map((range) => `${formatC64Range(range)} (${range.end - range.start + 1} bytes)`).join(", ");
}

/** A piece of bytes in a free range: its target and where a copy reads it. */
export interface Piece {
  what: string;
  target: AddressRange;
  at: number;
  bytes: (address: number) => number;
}

/**
 * Puts the parts (of pages 0-3, or of a stash) into the free ranges, in their
 * order: each time into the nearest range that holds the rest, else into the
 * largest range. A part that does not fit in one range is split, and each
 * piece is a copy. Undefined when the ranges are too small.
 */
export function placePieces(ranges: AddressRange[], low: ReadonlyArray<{ what: string; range: AddressRange; bytes: (address: number) => number }>, distance: (range: AddressRange) => number): Piece[] | undefined {
  const left = ranges.map((range) => ({ ...range }));
  const pieces: Piece[] = [];
  let rest = low.reduce((sum, block) => sum + block.range.end - block.range.start + 1, 0);
  const length = (range: AddressRange) => range.end - range.start + 1;
  let target: AddressRange | undefined;
  for (const block of low) {
    let next = block.range.start;
    while (next <= block.range.end) {
      if (target === undefined || target.start > target.end) {
        const open = left.filter((range) => range.start <= range.end);
        if (open.length === 0) return undefined;
        const holding = open.filter((range) => length(range) >= rest).sort((a, b) => distance(a) - distance(b));
        target = holding[0] ?? open.sort((a, b) => length(b) - length(a))[0]!;
      }
      const count = Math.min(block.range.end - next + 1, length(target));
      const part = { start: next, end: next + count - 1 };
      const cut = part.start !== block.range.start || part.end !== block.range.end;
      pieces.push({ what: cut ? `${block.what}, bytes ${formatC64Range(part)}` : block.what, target: part, at: target.start, bytes: block.bytes });
      target.start += count;
      next += count;
      rest -= count;
    }
  }
  return pieces;
}
