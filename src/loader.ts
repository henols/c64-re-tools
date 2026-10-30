// The packed loader program of a generated source. Exomizer packs the loaded
// ranges of the build of main.asm (from $0400) and the build of loader.asm,
// which holds the copier and the bytes of pages 0-3, into one program that
// unpacks itself and starts the copier with all RAM visible ($01 = $34).
// c64-source packs it for the loader that it checks; c64-assembler packs it
// for other switch values, from the same files and with the same parts. The
// loaded ranges are the segments of the program without the leftovers: a
// leftover file of the source gives its range in its first line.

import { type AddressRange, formatC64Address, prgRange } from "./c64.ts";
import { compareBuild, mergedPrograms } from "./compare.ts";
import { Refusal } from "./errors.ts";
import { pack } from "./native/exomizer.ts";
import type { ToolContext } from "./native/run.ts";
import type { AssembledSymbol } from "./native/types.ts";

/** The label of the copier in loader.asm. In the packed form, its address is the copier address, where the unpack jumps. */
export const COPIER_SOURCE = "loader_copier_src";

/** The memory configuration at the start of the copier of the packed form: all RAM visible. */
export const PACKED_EXIT_MEMORY = 0x34;

/** The pages that the unpacker of Exomizer uses: the copier of the packed form writes them, so main.asm is packed from here. */
const PACKED_FROM = 0x0400;

/** The first line of a leftover file: `; Leftovers $xxxx-$yyyy: ...`. */
const LEFTOVER_RANGE = /^; Leftovers (\$[0-9a-f]{4})-(\$[0-9a-f]{4}):/m;

/** The range of a leftover file of a generated source, from its first line. Undefined for a text without that line. */
export function leftoverRange(text: string): AddressRange | undefined {
  const found = LEFTOVER_RANGE.exec(text);
  return found === null ? undefined : { start: Number.parseInt(found[1]!.slice(1), 16), end: Number.parseInt(found[2]!.slice(1), 16) };
}

const show = (range: AddressRange) => `${formatC64Address(range.start)}-${formatC64Address(range.end)}`;

/** The parts of `range` outside every hole, in address order. */
function without(range: AddressRange, holes: readonly AddressRange[]): AddressRange[] {
  let pieces = [range];
  for (const hole of holes) {
    pieces = pieces.flatMap((piece) => {
      if (hole.end < piece.start || hole.start > piece.end) return [piece];
      return [
        ...(hole.start > piece.start ? [{ start: piece.start, end: hole.start - 1 }] : []),
        ...(hole.end < piece.end ? [{ start: hole.end + 1, end: piece.end }] : []),
      ];
    });
  }
  return pieces;
}

/**
 * The ranges that the packed loader loads from a build of main.asm: the
 * segments of the program without the leftovers. Refuses what only the loader
 * of generate can have: a start screen of a captured stage, which is a program
 * of its own in front of the packed loader, and a segment below $0400, whose
 * bytes loader.asm holds with the switch values of generate.
 */
export function packedRanges(segments: readonly AddressRange[], leftovers: readonly AddressRange[], stage: string | undefined): AddressRange[] {
  if (stage !== undefined) {
    throw new Refusal("invalid-input", `The start screen is of the captured stage ${stage}, and only the generation of the source with the loader makes that loader program. Set the switch values in config.asm, and generate the source with the loader.`);
  }
  const loaded = [...segments].sort((a, b) => a.start - b.start).flatMap((segment) => without(segment, leftovers));
  const low = loaded.find((range) => range.start < PACKED_FROM);
  if (low !== undefined) {
    throw new Refusal("invalid-input", `The segment ${show(low)} starts below $0400, and loader.asm holds its bytes there with the switch values of generate. Set the switch values in config.asm, and generate the source with the loader.`);
  }
  return loaded;
}

/**
 * Checks the two builds of the packed form before the pack: the build of
 * main.asm holds each loaded range, and the build of loader.asm, which holds
 * the bytes of the program between its free ranges, has the bytes of the build
 * of main.asm there. A patch of a switch between the free ranges changes them,
 * and the copier build would put the old bytes back. Refuses by name.
 */
export function checkPackedBuilds(main: Uint8Array, copier: Uint8Array, loaded: readonly AddressRange[]): void {
  const program = prgRange(main);
  const outside = loaded.find((range) => range.start < program.start || range.end > program.end);
  if (outside !== undefined) {
    throw new Refusal("invalid-input", `The build of main.asm does not hold ${show(outside)} of the program in the knowledge. Generate the source again from the knowledge.`);
  }
  const build = prgRange(copier);
  for (const range of loaded) {
    for (let address = Math.max(range.start, build.start); address <= Math.min(range.end, build.end); address++) {
      if (build.body[address - build.start] === program.body[address - program.start]) continue;
      throw new Refusal(
        "invalid-input",
        `These switch values change the byte at ${formatC64Address(address)}, between the free ranges of loader.asm (${show(build)}), and loader.asm holds the byte of generate there. Set the switch values in config.asm, and generate the source with the loader.`,
      );
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
  const prg = (part: { start: number; body: Uint8Array }) => Buffer.concat([Buffer.from([part.start & 0xff, part.start >> 8]), part.body]);
  const packed = await pack({ programs: parts.map(prg), entry, exitMemory }, context);
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
