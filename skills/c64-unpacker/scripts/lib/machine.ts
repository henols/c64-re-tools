// The machine state that a capture writes: RAM, the CPU port, pages
// 0-3, the chip registers read without side effects, and the vectors. The
// capture and loads commands of the unpacker share it.

import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { type AddressRange, formatC64Address, hexWord, prgOf } from "#src/c64.ts";
import { resetToReady } from "#src/host-client/entry-state.ts";
import { writeRefusal, writeReported, type Written } from "#src/host-client/transfer.ts";
import { readMemoryInParts, type ViceSessionClient } from "#src/host-client/vice-session.ts";
import { projectRoot, resolveProjectPath } from "#src/project.ts";

type Registers = Awaited<ReturnType<ViceSessionClient["registersGet"]>>;

/** The I/O areas of the entry state, read without side effects. The colour RAM is the colours of the screen: a start screen of a captured stage uses them. */
const IO_AREAS = { vic: [0xd000, 0x2f], sid: [0xd400, 0x1d], cia1: [0xdc00, 0x10], cia2: [0xdd00, 0x10], colour: [0xd800, 1000] } as const;
/** The I/O areas of chips: what differsFrom compares. The colour RAM is the content of the screen, not the state of the machine. */
const CHIP_AREAS = ["vic", "sid", "cia1", "cia2"] as const;

/** What no register read of a CIA gives. */
export interface CiaHidden {
  latchA: number;
  latchB: number;
  interruptMask: number;
}

export interface MachineState {
  port: Buffer;
  pages: Buffer;
  io: Record<keyof typeof IO_AREAS, Buffer>;
  /** The timer latches and the interrupt mask of each CIA. */
  cia: { cia1: CiaHidden; cia2: CiaHidden };
  romVectors: Buffer;
}

/** The state the program finds at its entry: what a rebuild's loader must recreate. */
export async function machineState(client: ViceSessionClient): Promise<MachineState> {
  const port = Buffer.from((await client.memoryRead({ address: 0x0000, size: 2, space: "c64", view: "cpu" })).data, "hex");
  const pages = await readMemoryInParts(client, 0x0000, 0x400, "ram");
  const io = {} as Record<keyof typeof IO_AREAS, Buffer>;
  for (const [name, [address, size]] of Object.entries(IO_AREAS)) io[name as keyof typeof IO_AREAS] = Buffer.from((await client.ioRead(address, size)).data, "hex");
  // The colour RAM has 4 bits: a read gives other bits above them.
  io.colour = Buffer.from(io.colour.map((value) => value & 0x0f));
  const [cia1, cia2] = (await client.cia("both")).chips.map(({ latchA, latchB, interruptMask }) => ({ latchA, latchB, interruptMask }));
  const romVectors = Buffer.from((await client.memoryRead({ address: 0xfffa, size: 6, space: "c64", view: "cpu" })).data, "hex");
  return { port, pages, io, cia: { cia1: cia1!, cia2: cia2! }, romVectors };
}

const word = (bytes: Buffer, offset: number) => formatC64Address(bytes[offset]! | (bytes[offset + 1]! << 8));

/** The KERNAL vectors in page 3, the hardware vectors in RAM, and the ROM's own. */
export function vectorsOf(state: MachineState, memory: Buffer) {
  return {
    irq: word(state.pages, 0x314),
    brk: word(state.pages, 0x316),
    nmi: word(state.pages, 0x318),
    ram: { nmi: word(memory, 0xfffa), reset: word(memory, 0xfffc), irq: word(memory, 0xfffe) },
    rom: { nmi: word(state.romVectors, 0), reset: word(state.romVectors, 2), irq: word(state.romVectors, 4) },
  };
}

/** The state of a clean machine at the READY prompt after a hard reset: what differsFromReset compares with. It resets the machine. */
export async function readyState(client: ViceSessionClient): Promise<MachineState> {
  await resetToReady(client);
  return machineState(client);
}

/** The bytes that differ from a clean machine: the CPU port, pages 0-3 from $0002, and the I/O areas. */
function differsFrom(state: MachineState, clean: MachineState): Array<{ address: string; entry: number; reset: number }> {
  const differs: Array<{ address: string; entry: number; reset: number }> = [];
  const compare = (base: number, entry: Buffer, reset: Buffer) => entry.forEach((value, offset) => value !== reset[offset] && differs.push({ address: formatC64Address(base + offset), entry: value, reset: reset[offset]! }));
  compare(0x0000, state.port, clean.port);
  compare(0x0002, state.pages.subarray(2), clean.pages.subarray(2));
  for (const name of CHIP_AREAS) compare(IO_AREAS[name][0], state.io[name], clean.io[name]);
  return differs;
}

/**
 * entry_state.json, the one writer of capture and loads: the state at the
 * entry, and what differs from `clean` (readyState). Gives the file and the
 * count of differing bytes.
 */
export function entryStateFile(registers: Registers, state: MachineState, vectors: ReturnType<typeof vectorsOf>, clean: MachineState): { bytes: Buffer; differsFromReset: number } {
  const differs = differsFrom(state, clean);
  return { bytes: json(entryState(registers, state, vectors, differs)), differsFromReset: differs.length };
}

/** The content of entry_state.json. */
function entryState(registers: Registers, state: MachineState, vectors: ReturnType<typeof vectorsOf>, differsFromReset: Array<{ address: string; entry: number; reset: number }>) {
  return {
    registers: { pc: formatC64Address(registers.pc), a: registers.a, x: registers.x, y: registers.y, sp: registers.sp, flags: registers.flags },
    cpuPort: { $00: state.port[0], $01: state.port[1] },
    pages: Object.fromEntries([0, 1, 2, 3].map((page) => [formatC64Address(page << 8), state.pages.subarray(page << 8, (page + 1) << 8).toString("hex")])),
    io: Object.fromEntries(Object.entries(IO_AREAS).map(([name, [address]]) => [name, { from: formatC64Address(address), bytes: state.io[name as keyof typeof IO_AREAS].toString("hex") }])),
    // The CIA latches and interrupt masks: write-only on the chip, so the I/O bytes do not hold them.
    cia: state.cia,
    vectors,
    differsFromReset,
  };
}

/** The names of the files that a capture writes for its content: a PRG for each segment, and the drive RAM. */
const CAPTURE_FILE = /^(?:segment-[0-9a-f]{4}-[0-9a-f]{4}\.prg|drive8\.prg)$/;

/**
 * Removes from the capture folder `folder` (a project path) each file that an
 * earlier capture wrote and this capture did not: a segment PRG of another
 * range, or the drive RAM. image.json lists only the files of this capture.
 * Every other file stays. Gives the removed files as project paths.
 */
export function removeStaleFiles(folder: string, written: readonly string[]): string[] {
  const path = resolveProjectPath(folder, projectRoot());
  const removed: string[] = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    // A symbolic link is not a file of a capture: it stays.
    if (!entry.isFile() || !CAPTURE_FILE.test(entry.name) || written.includes(entry.name)) continue;
    const file = `${folder}/${entry.name}`;
    try {
      rmSync(join(path, entry.name));
    } catch (error) {
      throw writeRefusal(error, file, "--out") ?? error;
    }
    removed.push(file);
  }
  return removed.sort();
}

const json = (value: unknown) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

/**
 * Writes a capture into `folder` (a project path): image.bin with all of
 * `memory`, a PRG for each segment, the other files, image.json (`image` of
 * the names of the segment PRGs) and entry_state.json. Then removes the files
 * of an earlier capture there that this one did not write. Gives the written
 * files, the names of the segment PRGs and the removed files.
 */
export function writeCapture(
  folder: string,
  memory: Buffer,
  segments: readonly AddressRange[],
  other: ReadonlyArray<{ name: string; bytes: Uint8Array }>,
  image: (files: string[]) => Record<string, unknown>,
  entryState: Buffer,
): { written: Written[]; files: string[]; removed: string[] } {
  const written: Written[] = [];
  const write = (name: string, bytes: Uint8Array) => written.push(writeReported(`${folder}/${name}`, bytes, { what: "--out" }));
  write("image.bin", memory);
  const files = segments.map((segment) => {
    const name = `segment-${hexWord(segment.start)}-${hexWord(segment.end)}.prg`;
    write(name, prgOf(segment.start, memory.subarray(segment.start, segment.end + 1)));
    return name;
  });
  for (const file of other) write(file.name, file.bytes);
  write("image.json", json(image(files)));
  write("entry_state.json", entryState);
  // A capture again into the folder: the files of the earlier capture that image.json no longer lists go.
  const removed = removeStaleFiles(folder, [...files, ...other.map((file) => file.name)]);
  return { written, files, removed };
}
