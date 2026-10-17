// Runtime evidence for the differences between releases: each release
// runs in its own emulator, and each differing range gets its first access
// (read, write, execute or none) and whether its bytes changed by the end.
// Watchpoints and range breakpoints stop the run at an access; the coverage
// map then tells which range and which access it was.

import { type AddressRange, COVERAGE, formatC64Address, instructionLength } from "#src/c64.ts";
import { runProgram } from "#src/host-client/autostart.ts";
import { readCoverage } from "#src/host-client/coverage.ts";
import { runActionStep, type ActionStep } from "#src/host-client/steps.ts";
import { MAX_MEMORY_READ, MAX_MEMORY_WRITE } from "#src/host-client/tools.ts";
import { readProjectFile } from "#src/host-client/transfer.ts";
import type { ViceSessionClient } from "#src/host-client/vice-session.ts";

export type FirstAccess = "read" | "write" | "execute" | "none";

export interface RangeAccess {
  first: FirstAccess;
  /** True when the bytes at the end differ from the bytes of the release. */
  changed: boolean;
}

/** How a release starts in the emulator. */
export type Start =
  | { kind: "program"; path: string }
  | { kind: "image"; segments: AddressRange[]; byteAt: (address: number) => number; state: ImageState };

export interface ImageState {
  pc: number;
  a: number;
  x: number;
  y: number;
  sp: number;
  flags: { n: boolean; v: boolean; d: boolean; i: boolean; z: boolean; c: boolean };
  port: [number, number];
  /** $0000-$03ff at the entry. */
  pages: Uint8Array;
}

const MAX_WATCH = 256;
/** Frames until the KERNAL is at the READY prompt, before an image is written. */
const READY_FRAMES = 150;

const READ = COVERAGE.ramRead | COVERAGE.romRead | COVERAGE.ioRead;
const WRITE = COVERAGE.ramWrite | COVERAGE.ioWrite;
const EXECUTE = COVERAGE.ramExecute | COVERAGE.romExecute | COVERAGE.ioExecute;

/** The first access that coverage flags show; a read-modify-write reads first. */
export function accessOf(flags: number): FirstAccess {
  if ((flags & EXECUTE) !== 0) return "execute";
  if ((flags & READ) !== 0) return "read";
  if ((flags & WRITE) !== 0) return "write";
  return "none";
}

/** Starts the release; returns why it did not start, or undefined. */
async function start(client: ViceSessionClient, how: Start): Promise<string | undefined> {
  if (how.kind === "program") {
    const failed = await runProgram(client, how.path, readProjectFile(how.path).bytes);
    if (failed === "not-loaded") return "The program was not in memory after autostart.";
    if (failed === "not-started") return "The program did not start after RUN; it needs a BASIC start line.";
    return undefined;
  }
  await client.reset({ mode: "hard", run: true });
  await client.execution({ action: "advance-frames", count: READY_FRAMES, space: "c64" });
  for (const segment of how.segments) {
    for (let at = segment.start; at <= segment.end; at += MAX_MEMORY_WRITE) {
      const last = Math.min(segment.end, at + MAX_MEMORY_WRITE - 1);
      const bytes = Buffer.from(Array.from({ length: last - at + 1 }, (_, offset) => how.byteAt(at + offset)));
      await client.memoryWrite({ address: at, data: bytes.toString("hex"), space: "c64", view: "ram" });
    }
  }
  const { state } = how;
  // Pages 0 to 3 from $0002, then the CPU port: the port bits switch what the CPU sees.
  await client.memoryWrite({ address: 0x0002, data: Buffer.from(state.pages.subarray(2)).toString("hex"), space: "c64", view: "ram" });
  await client.memoryWrite({ address: 0x0000, data: Buffer.from(state.port).toString("hex"), space: "c64", view: "cpu" });
  await client.registersSet("c64", { pc: state.pc, a: state.a, x: state.x, y: state.y, sp: state.sp, flags: state.flags });
  return undefined;
}

/**
 * Runs one release and watches the ranges (addresses of the release, after
 * any shift is taken away). `release` gives the release's own bytes.
 */
export async function watchRelease(
  client: ViceSessionClient,
  how: Start,
  ranges: AddressRange[],
  release: (address: number) => number,
  run: { frames: number; steps: ActionStep[] },
): Promise<{ started: true; accesses: RangeAccess[] } | { started: false; reason: string }> {
  await client.reset({ mode: "hard", run: false });
  const failed = await start(client, how);
  if (failed !== undefined) return { started: false, reason: failed };
  if ((await client.status()).state === "running") await client.execution({ action: "pause", space: "c64" });

  const first: FirstAccess[] = ranges.map(() => "none");
  const points = new Map<number, Array<{ kind: "watch" | "break"; id: number }>>();
  for (const [index, range] of ranges.entries()) {
    const ids: Array<{ kind: "watch" | "break"; id: number }> = [];
    for (let at = range.start; at <= range.end; at += MAX_WATCH) {
      const size = Math.min(MAX_WATCH, range.end - at + 1);
      ids.push({ kind: "watch", id: (await client.watchpoint({ action: "add", address: at, size, access: "read-write", space: "c64" })).id });
      ids.push({ kind: "break", id: (await client.breakpoint({ action: "add", address: at, size, space: "c64" })).id });
    }
    points.set(index, ids);
  }
  await client.memmap({ action: "clear" });

  /**
   * After a stop: the ranges that the coverage shows accessed get their first
   * access, and lose their points. VICE marks only the opcode byte of an
   * executed instruction, so an instruction that starts up to two bytes before
   * a range, or in it, executes its operand bytes too.
   */
  const settle = async (): Promise<boolean> => {
    const map = await readCoverage(client);
    let found = false;
    for (const [index, ids] of points) {
      const range = ranges[index]!;
      let flags = 0;
      for (let address = range.start; address <= range.end; address++) flags |= map[address]!;
      const from = Math.max(0, range.start - 2);
      if ((flags & EXECUTE) === 0 && map.subarray(from, range.start).some((byte) => (byte & COVERAGE.ramExecute) !== 0)) {
        const code = Buffer.from((await client.memoryRead({ address: from, size: range.start - from, space: "c64", view: "ram" })).data, "hex");
        for (let address = from; address < range.start; address++) {
          if ((map[address]! & COVERAGE.ramExecute) !== 0 && address + instructionLength(code[address - from]!) - 1 >= range.start) flags |= COVERAGE.ramExecute;
        }
      }
      if (accessOf(flags) === "none") continue;
      first[index] = accessOf(flags);
      for (const point of ids) {
        if (point.kind === "watch") await client.watchpoint({ action: "remove", id: point.id });
        else await client.breakpoint({ action: "remove", id: point.id });
      }
      points.delete(index);
      found = true;
    }
    return found;
  };

  // Each stop at a point settles at least one range, so the stops are bounded; the guard ends a run that stops without an access.
  let guard = 4 * ranges.length + 16;
  /** Runs frames; a stop at a point settles and goes on with the frames that are left. */
  const runFrames = async (count: number) => {
    let left = count;
    while (left > 0 && guard-- > 0) {
      const ran = await client.execution({ action: "advance-frames", count: left, space: "c64" });
      left -= ran.advancedFrames ?? left;
      if (left > 0 && !(await settle())) left--;
    }
  };
  for (const step of run.steps) {
    if ("frames" in step) {
      await runFrames(step.frames);
      continue;
    }
    if ("runUntil" in step) {
      // A stop at a point is not the target: settle and run to the target again.
      while (guard-- > 0) {
        const reached = await runActionStep(client, step, (location) => Number.parseInt(location.slice(1), 16));
        if (reached === undefined || reached.stopReason !== "watchpoint" && reached.stopReason !== "breakpoint") break;
        await settle();
      }
      continue;
    }
    await runActionStep(client, step, (location) => Number.parseInt(location.slice(1), 16));
  }
  await runFrames(run.frames);
  if (points.size > 0) await settle();

  const accesses: RangeAccess[] = [];
  for (const [index, range] of ranges.entries()) {
    const parts: Buffer[] = [];
    for (let at = range.start; at <= range.end; at += MAX_MEMORY_READ) {
      parts.push(Buffer.from((await client.memoryRead({ address: at, size: Math.min(MAX_MEMORY_READ, range.end - at + 1), space: "c64", view: "ram" })).data, "hex"));
    }
    const now = Buffer.concat(parts);
    accesses.push({ first: first[index]!, changed: now.some((byte, offset) => byte !== release(range.start + offset)) });
  }
  for (const ids of points.values()) {
    for (const point of ids) {
      if (point.kind === "watch") await client.watchpoint({ action: "remove", id: point.id });
      else await client.breakpoint({ action: "remove", id: point.id });
    }
  }
  return { started: true, accesses };
}

export const showRange = (range: AddressRange) => `${formatC64Address(range.start)}-${formatC64Address(range.end)}`;
