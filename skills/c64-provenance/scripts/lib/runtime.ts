// Runtime evidence for the differences between releases: each release
// runs in its own emulator, and each differing range gets its first access
// (read, write, execute or none) and whether its bytes changed by the end.
// Watchpoints and range breakpoints stop the run at an access; the coverage
// map then tells which range and which access it was, and the CPU history
// tells which instruction made a read and a write.

import { type AddressRange, COVERAGE, EXECUTE, instructionLength, READ, WRITE } from "#src/c64.ts";
import { runProgram } from "#src/host-client/autostart.ts";
import { readCoverage } from "#src/host-client/coverage.ts";
import { startAtEntry, type EntryState } from "#src/host-client/entry-state.ts";
import { runActionStep, type ActionStep } from "#src/host-client/steps.ts";
import { knowledgeAt } from "#src/knowledge/names.ts";
import { isStore } from "#src/opcodes.ts";
import { readProjectFile } from "#src/host-client/transfer.ts";
import { lastOpcode, readMemoryInParts, type ViceSessionClient } from "#src/host-client/vice-session.ts";

export type FirstAccess = "read" | "write" | "read-write" | "execute" | "none";

export interface RangeAccess {
  first: FirstAccess;
  /** True when the bytes at the end differ from the bytes of the release. */
  changed: boolean;
}

/** How a release starts in the emulator: autostart of a PRG, or the captured program at its entry. */
export type Start =
  | { kind: "program"; path: string }
  | { kind: "image"; segments: AddressRange[]; byteAt: (address: number) => number; state: EntryState };

const MAX_WATCH = 256;

/**
 * The first access that coverage flags show. A read and a write at one stop
 * are of the instruction that made the access (`opcode`, when the CPU history
 * gives it): an indexed store makes a dummy read before its write, and a
 * read-modify-write reads first. Without the instruction (the taps of a press,
 * the end of the run), the order of a read and a write is not known: read-write.
 */
export function accessOf(flags: number, opcode?: number): FirstAccess {
  if ((flags & EXECUTE) !== 0) return "execute";
  if ((flags & READ) !== 0 && (flags & WRITE) !== 0) return opcode === undefined ? "read-write" : isStore(opcode) ? "write" : "read";
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
  await startAtEntry(client, how, how.state);
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
  /** Switches each point that has not settled on or off. */
  const switchPoints = async (action: "enable" | "disable") => {
    for (const ids of points.values()) {
      for (const point of ids) {
        if (point.kind === "watch") await client.watchpoint({ action, id: point.id });
        else await client.breakpoint({ action, id: point.id });
      }
    }
  };

  /**
   * After a stop: the ranges that the coverage shows accessed get their first
   * access, and lose their points. VICE marks only the opcode byte of an
   * executed instruction, so an instruction that starts up to two bytes before
   * a range, or in it, executes its operand bytes too. A stop at a watchpoint
   * comes after the instruction that made the access, so at a stop (`atPoint`)
   * the last entry of the CPU history is that instruction. Each stop settles
   * before the run goes on, so the flags of a range that has not settled are
   * of the accesses since the last stop.
   */
  const settle = async (atPoint = true): Promise<boolean> => {
    const map = await readCoverage(client);
    let found = false;
    let instruction: Promise<number | undefined> | undefined;
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
      const both = (flags & READ) !== 0 && (flags & WRITE) !== 0;
      first[index] = accessOf(flags, atPoint && both ? await (instruction ??= lastOpcode(client)) : undefined);
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
      // A stop at a point settles, also in the last frame.
      const settled = ran.stopReason === "watchpoint" || ran.stopReason === "breakpoint" ? await settle() : false;
      if (left > 0 && !settled) left--;
    }
  };
  const at = knowledgeAt();
  for (const step of run.steps) {
    if ("frames" in step) {
      await runFrames(step.frames);
      continue;
    }
    if ("runUntil" in step) {
      // A stop at a point is not the target: settle and run to the target again.
      while (guard-- > 0) {
        const reached = await runActionStep(client, step, at);
        if (reached === undefined || reached.stopReason !== "watchpoint" && reached.stopReason !== "breakpoint") break;
        await settle();
      }
      continue;
    }
    if ("press" in step) {
      // A stop at a point ends the taps early and lets the keys go: the points are off for the taps, and the coverage of the taps gives the first access.
      await switchPoints("disable");
      await runActionStep(client, step, at);
      await switchPoints("enable");
      await settle(false);
      continue;
    }
    // The other steps do not run the CPU.
    await runActionStep(client, step, at);
  }
  await runFrames(run.frames);
  if (points.size > 0) await settle(false);

  const accesses: RangeAccess[] = [];
  for (const [index, range] of ranges.entries()) {
    const now = await readMemoryInParts(client, range.start, range.end - range.start + 1, "ram");
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
