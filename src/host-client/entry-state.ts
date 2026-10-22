// The machine state at the entry of a program: what the c64-unpacker capture
// writes in entry_state.json and the knowledge keeps with the program. The one
// parser of that state, and the one way to put a program at its entry in the
// emulator.

import { addressOf } from "../address.ts";
import { Refusal } from "../errors.ts";
import { MAX_MEMORY_WRITE } from "./tools.ts";
import { readProjectFile } from "./transfer.ts";
import type { ViceSessionClient } from "./vice-session.ts";

/** Frames from a hard reset to the READY prompt, with margin. */
export const READY_FRAMES = 200;

/** The four pages that the entry state holds: $0000-$03ff. */
const PAGES = ["$0000", "$0100", "$0200", "$0300"] as const;

export interface EntryState {
  pc: number;
  a: number;
  x: number;
  y: number;
  sp: number;
  flags: { n: boolean; v: boolean; d: boolean; i: boolean; z: boolean; c: boolean };
  /** The CPU port: $00 and $01. */
  port: [number, number];
  /** $0000-$03ff. */
  pages: Uint8Array;
  /** The whole entry state as the capture wrote it, without differsFromReset: what the knowledge keeps. */
  raw: Record<string, unknown>;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isByte = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 0xff;

/** The entry state of a value. `where` names it in a refusal, for example a file or "the entry state of the knowledge". */
export function parseEntryState(value: unknown, where: string): EntryState {
  const fail = (what: string): never => {
    throw new Refusal("invalid-input", `${where} is not an entry state of a program capture: ${what}. Capture the program again at its entry point.`);
  };
  if (!isObject(value)) return fail("it is not a JSON object");
  const registers = isObject(value.registers) ? value.registers : fail("it has no registers");
  const pc = typeof registers.pc === "string" ? addressOf(registers.pc) : undefined;
  if (pc === undefined) fail("registers.pc is not a $ address");
  for (const name of ["a", "x", "y", "sp"]) if (!isByte(registers[name])) fail(`registers.${name} is not a byte`);
  const flags = isObject(registers.flags) ? registers.flags : fail("registers.flags is not an object");
  const port = isObject(value.cpuPort) ? [value.cpuPort.$00, value.cpuPort.$01] : fail("it has no cpuPort");
  if (!port.every(isByte)) fail("cpuPort needs $00 and $01 as bytes");
  const pages = isObject(value.pages) ? PAGES.map((page) => (value.pages as Record<string, unknown>)[page]) : fail("it has no pages");
  if (!pages.every((page) => typeof page === "string" && /^[0-9a-fA-F]{512}$/.test(page))) fail("pages needs $0000, $0100, $0200 and $0300, each 256 bytes as hex");
  const { differsFromReset: _differs, ...raw } = value;
  return {
    pc: pc!,
    a: registers.a as number,
    x: registers.x as number,
    y: registers.y as number,
    sp: registers.sp as number,
    flags: { n: flags.n === true, v: flags.v === true, d: flags.d === true, i: flags.i === true, z: flags.z === true, c: flags.c === true },
    port: port as [number, number],
    pages: Uint8Array.from(Buffer.from((pages as string[]).join(""), "hex")),
    raw,
  };
}

/** Reads an entry_state.json of the project. Refuses a missing file with the remedy, and a file that is no entry state. */
export function readEntryState(path: string): EntryState {
  const { bytes } = readProjectFile(path);
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Refusal("invalid-input", `${path} is not JSON: ${(error as Error).message}`);
  }
  return parseEntryState(value, path);
}

/** A hard reset, then the frames until the KERNAL shows READY. */
export async function resetToReady(client: ViceSessionClient): Promise<void> {
  await client.reset({ mode: "hard", run: true });
  await client.execution({ action: "advance-frames", count: READY_FRAMES, space: "c64" });
}

/**
 * Writes the entry state into the machine: pages 0 to 3 in RAM from $0002, then
 * the CPU port, whose bits switch what the CPU sees; with registers, also the
 * CPU registers. The machine is paused first.
 */
export async function applyEntryState(client: ViceSessionClient, state: EntryState, options: { registers: boolean }): Promise<void> {
  if ((await client.status()).state === "running") await client.execution({ action: "pause", space: "c64" });
  await client.memoryWrite({ address: 0x0002, data: Buffer.from(state.pages.subarray(2)).toString("hex"), space: "c64", view: "ram" });
  await client.memoryWrite({ address: 0x0000, data: Buffer.from(state.port).toString("hex"), space: "c64", view: "cpu" });
  if (options.registers) await client.registersSet("c64", { pc: state.pc, a: state.a, x: state.x, y: state.y, sp: state.sp, flags: state.flags });
}

/** Puts a captured program at its entry: a reset to READY, the bytes of the segments, then the whole entry state. */
export async function startAtEntry(client: ViceSessionClient, image: { segments: ReadonlyArray<{ start: number; end: number }>; byteAt: (address: number) => number }, state: EntryState): Promise<void> {
  await resetToReady(client);
  for (const segment of image.segments) {
    for (let at = segment.start; at <= segment.end; at += MAX_MEMORY_WRITE) {
      const last = Math.min(segment.end, at + MAX_MEMORY_WRITE - 1);
      const bytes = Buffer.from(Array.from({ length: last - at + 1 }, (_, offset) => image.byteAt(at + offset)));
      await client.memoryWrite({ address: at, data: bytes.toString("hex"), space: "c64", view: "ram" });
    }
  }
  await applyEntryState(client, state, { registers: true });
}
