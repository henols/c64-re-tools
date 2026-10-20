// The c64-unpacker script. "inspect" gives local evidence of packing; it never
// names a packer. "trace" runs the program and reports the memory that it
// wrote and then executed: the run-time evidence that also finds a simple
// cruncher whose bytes look like code. "capture" runs the program in an
// emulator until it reaches a given address (the unpacked entry point) and
// writes the memory into the project. "loads" captures each part of a
// multi-load program. No native unpack tool is used.

import { type AddressRange, COVERAGE, EXECUTE, formatC64Address, READ, WRITE } from "#src/c64.ts";
import { autostartLoaded, LOAD_LIMIT_FRAMES, RUN_LIMIT_FRAMES, typeRun } from "#src/host-client/autostart.ts";
import { IO_RAM, markIoRamWrites, readCoverage, writtenBlocks } from "#src/host-client/coverage.ts";
import { readActionSteps, runActionStep, type ActionStep } from "#src/host-client/steps.ts";
import { WireFailure } from "#src/host-client/tools.ts";
import { readPrg } from "#src/host-client/image.ts";
import { writeReported, type Written } from "#src/host-client/transfer.ts";
import { ViceSessionClient } from "#src/host-client/vice-session.ts";
import { knowledgeAt, knowledgeNames } from "#src/knowledge/names.ts";
import { listed, OPTIONS, reply, runScript, UsageError, type Call, type CommandSpec, type OptionSpec } from "#src/script.ts";
import { basicStart, inspect, readMemoryMap, underRom, writtenThenExecuted } from "./lib/evidence.ts";
import { loads, readLoadSteps } from "./lib/loads.ts";
import { callReturn, captureSegments, executedIn, inRanges, mergeMaps, stageCandidates, stagePoints, withoutRanges } from "./lib/stages.ts";
import { entryStateFile, machineState, readRam, readyState, removeStaleFiles, vectorsOf } from "./lib/machine.ts";

/** Written-then-executed bytes from this many on are unpacking, decrypting or relocating, not self-changing code. */
const UNPACKED_BYTES = 256;
const MAX_ADVANCE = 10_000;
/** The most ranges one memory map read gives. */
const MAX_RANGES = 1000;

/** Runs the steps; the reason when a runUntil step did not reach its target. */
async function runSteps(client: ViceSessionClient, steps: ActionStep[]): Promise<string | undefined> {
  for (const [index, step] of steps.entries()) {
    const notReached = await runActionStep(client, step, knowledgeAt());
    if (notReached !== undefined && "runUntil" in step) {
      return `Step ${index + 1} did not reach its target in ${step.runUntil.timeoutFrames} frames. It stopped by ${notReached.stopReason} at ${formatC64Address(notReached.pc)}.`;
    }
  }
  return undefined;
}

/** inspect, trace, stages and capture take a PRG: a disk, tape or cartridge file goes to loads. */
const NOT_PRG_REMEDY = "Use loads, which runs a disk, tape or cartridge image, or extract the PRG from the image and give the path of that PRG";
const readProgram = (path: string) => readPrg(path, NOT_PRG_REMEDY).bytes;

async function trace(program: string, options: { frames: number; entry?: number; steps: ActionStep[]; max: number }): Promise<{ output: Record<string, unknown>; failed: boolean }> {
  const bytes = startable(program, options.entry);
  const client = await ViceSessionClient.open({ videoStandard: "pal" });
  try {
    // Loaded but not started, so the memory map can start empty: the KERNAL start-up writes all of RAM.
    const notStarted = await startLoaded(client, program, bytes, options.entry);
    if (notStarted !== undefined) return { output: { traced: false, reason: notStarted }, failed: true };
    const stepFailed = await runSteps(client, options.steps);
    if (stepFailed !== undefined) return { output: { traced: false, reason: stepFailed }, failed: true };
    let ran = 0;
    while (ran < options.frames) {
      const step = await client.execution({ action: "advance-frames", count: Math.min(MAX_ADVANCE, options.frames - ran), space: "c64" });
      const advanced = step.advancedFrames ?? 0;
      ran += advanced;
      // A JAM or a point stops the run before its frames: the evidence would be of a run that did not happen.
      if ((step.stopReason !== undefined && step.stopReason !== "frames") || advanced === 0) {
        const stopReason = step.stopReason ?? "no-frames";
        const at = step.pc ?? (await client.registersGet("c64")).pc;
        return { output: { traced: false, frames: ran, stopReason, pc: formatC64Address(at), reason: stoppedEarly(stopReason, at, ran, options.frames) }, failed: true };
      }
    }
    const { pc } = await client.registersGet("c64");
    const ranges = await readMemoryMap(async (start) => {
      const map = await client.memmap({ action: "read", start, end: 0xffff, maxRanges: MAX_RANGES });
      if (!("ranges" in map)) throw new WireFailure("operation-failed", "The emulator did not give the memory map.");
      const ranges = map.ranges.map(({ start: from, end, flags }) => ({ start: from, end, read: (flags & READ) !== 0, write: (flags & WRITE) !== 0, execute: (flags & EXECUTE) !== 0 }));
      return map.next === undefined ? { ranges } : { ranges, next: map.next };
    });
    const { written, counted, bytes: count, running: atStop } = writtenThenExecuted(ranges, pc);
    // The run often ends in a KERNAL interrupt: the written code that runs next gives the range and the point after the unpacking.
    let running = atStop;
    let until = pc;
    if (running === undefined && counted.length > 0) {
      const next = await firstPcIn(client, counted);
      if (next !== undefined) {
        running = counted.find((range) => next >= range.start && next <= range.end);
        until = next;
      }
    }
    const packing = count >= UNPACKED_BYTES || running !== undefined ? "likely" : count > 0 ? "unclear" : "unlikely";
    return {
      output: {
        traced: true,
        frames: ran,
        pc: formatC64Address(pc),
        writtenThenExecuted: listed(written, options.max, (range) => ({
          start: formatC64Address(range.start),
          end: formatC64Address(range.end),
          ...(underRom(range.start) ? { underRom: true } : {}),
        })),
        bytes: count,
        packing,
        evidence:
          packing === "likely"
            ? running !== undefined
              ? `The CPU runs code at ${formatC64Address(until)} that the program wrote: it unpacked, decrypted or relocated it.`
              : `The program wrote ${count} bytes and then executed them: it unpacked, decrypted or relocated code.`
            : packing === "unclear"
              ? `The program executed ${count} bytes that it wrote. This can be code that changes itself or a small loader.`
              : "The program executed no code that it wrote while it ran.",
        // A point after the unpacking where the unpacked code runs; the entry point can be at the start of its range.
        ...(running === undefined ? {} : { suggestedUntil: formatC64Address(until), runningRange: { start: formatC64Address(running.start), end: formatC64Address(running.end) } }),
      },
      failed: false,
    };
  } finally {
    await client.close();
  }
}

const NO_BASIC = "The program is not a BASIC program at $0801, so RUN cannot start it. Give --entry <address>.";

/** Why a run stopped before its frames: what stopped the CPU, where, and after how many frames. */
function stoppedEarly(stopReason: string, pc: number, ran: number, frames: number): string {
  const what = stopReason === "jam" ? "a JAM instruction" : stopReason === "no-frames" ? "the emulator, which ran no frame" : `a ${stopReason}`;
  return `The CPU stopped at ${formatC64Address(pc)} by ${what} after ${ran} of ${frames} frames. Check --entry and the steps: the program must run for the frames.`;
}

/** The first PC in one of the ranges within SYS_FRAMES frames, found with exec breakpoints over them. */
async function firstPcIn(client: ViceSessionClient, ranges: Array<{ start: number; end: number }>): Promise<number | undefined> {
  const points = [];
  for (const range of ranges) points.push(await client.breakpoint({ action: "add", address: range.start, size: range.end - range.start + 1, space: "c64" }));
  try {
    const stop = await client.execution({ action: "advance-frames", count: SYS_FRAMES, space: "c64" });
    const pc = stop.pc ?? (await client.registersGet("c64")).pc;
    return ranges.some((range) => pc >= range.start && pc <= range.end) ? pc : undefined;
  } finally {
    for (const point of points) await client.breakpoint({ action: "remove", id: point.id });
  }
}

/** Frames that RUN gets to reach the machine code of a SYS whose argument needs run-time values. */
const SYS_FRAMES = 50;

/**
 * The first PC in the program after its BASIC text, for a SYS whose address
 * BASIC computes: an exec breakpoint over that part of the program stops there.
 */
/**
 * Starts the program as a c64-testing scenario does: hard reset, load,
 * an empty memory map, then RUN up to the first BASIC line, or the pc at
 * `entry`. Gives why it did not start.
 */
async function startLoaded(client: ViceSessionClient, program: string, bytes: Uint8Array, entry: number | undefined): Promise<string | undefined> {
  await client.reset({ mode: "hard", run: false });
  if (!(await autostartLoaded(client, program, bytes))) return `The program was not in memory at ${formatC64Address(bytes[0]! | (bytes[1]! << 8))} after ${LOAD_LIMIT_FRAMES} frames.`;
  await client.memmap({ action: "clear" });
  if (entry !== undefined) await client.registersSet("c64", { pc: entry });
  else if (!(await typeRun(client))) return `After RUN, BASIC ran no program line in ${RUN_LIMIT_FRAMES} frames.`;
  return undefined;
}

/** The raster position now: where a step's frames end. */
async function rasterAt(client: ViceSessionClient): Promise<{ line: number; cycle: number }> {
  const { timing } = await client.observe({ timing: true });
  return { line: timing!.rasterLine, cycle: timing!.rasterCycle };
}

async function firstPcAfterBasic(client: ViceSessionClient, from: number, to: number): Promise<number | undefined> {
  return from > to ? undefined : firstPcIn(client, [{ start: from, end: to }]);
}

/**
 * What a stage wrote: every written block, also a small one. --min-stage
 * decides only where a stage starts; the wrote list and the capture segments
 * keep each byte that a stage wrote.
 */
const stageWrote = (map: Uint8Array) => writtenBlocks(map, 1);

/** Frames between two looks at the memory map while stages are followed. */
const STAGE_CHUNK_FRAMES = 25;
const MAX_STAGES = 16;
/** Most stops of one re-run of a chunk: own code and writes over it each stop once. */
const MAX_STAGE_STOPS = 4096;
const STAGE_SNAPSHOT = "stage-chunk";
/** The snapshot at a call into written code, while the run checks if the call returns. */
const CALL_SNAPSHOT = "stage-call";

interface Stage {
  entry: number;
  firstFrame: number;
  frames: number;
  wrote: Array<{ start: number; end: number }>;
  next?: number;
}

interface Followed {
  stages: Stage[];
  frames: number;
  /** True when the CPU got to `until`. */
  reached: boolean;
  /** Why the program did not start, when it did not. */
  failed?: string;
  /** What stopped the CPU before the frames ran: a JAM or a point of the program. */
  halted?: { stopReason: string; pc: number };
}

type RunUntilStep = Extract<ActionStep, { runUntil: unknown }>;

/** A runUntil step to an address with no condition: a breakpoint stops it, so the stages are tracked while it runs. */
function trackedRunUntil(step: ActionStep): step is RunUntilStep & { runUntil: { target: { kind: "address" } } } {
  return "runUntil" in step && step.runUntil.target.kind === "address" && step.runUntil.target.condition === undefined;
}

/**
 * Starts the program and follows its stages. The memory map holds what
 * the current stage wrote; when the CPU executed a block of at least
 * `minStage` written bytes during a chunk of frames, the chunk runs again from
 * its snapshot with exec breakpoints over those blocks, which stop at the
 * first instruction of the next stage. Steps run in the tracked time: a frames
 * step and a runUntil step to an address alone are tracked, the others act
 * between two chunks. With `until`, the run ends when the CPU gets there
 * after the steps.
 */
async function follow(
  client: ViceSessionClient,
  program: string,
  bytes: Uint8Array,
  options: { frames: number; entry?: number; steps: ActionStep[]; minStage: number; until?: number },
): Promise<Followed> {
  const load = bytes[0]! | (bytes[1]! << 8);
  const basic = basicStart(bytes);
  const notStarted = await startLoaded(client, program, bytes, options.entry);
  if (notStarted !== undefined) return { stages: [], frames: 0, reached: false, failed: notStarted };
  // The map gives a write to the RAM under the I/O area as an I/O write: a compare of that RAM at each stage end finds them.
  const readIoRam = () => readRam(client, IO_RAM.start, IO_RAM.end - IO_RAM.start + 1);
  let ioRam = await readIoRam();
  const markIoRam = async (map: Uint8Array) => {
    const now = await readIoRam();
    markIoRamWrites(map, ioRam, now);
    ioRam = now;
  };
  // The frames of each step end where a scenario's do: the first step counts from RUN, a later one from where it starts.
  let anchor: { line: number; cycle: number } | undefined = await rasterAt(client);
  const framed = () => (anchor === undefined ? {} : { anchor });
  const found: Stage[] = [];
  const start = options.entry ?? basic!.sys?.address ?? (await firstPcAfterBasic(client, basic!.basicEnd, load + bytes.length - 3));
  if (start === undefined) return { stages: [], frames: 0, reached: false, failed: `After RUN, the CPU did not execute the program after its BASIC text (${formatC64Address(basic!.basicEnd)} on) in ${SYS_FRAMES} frames. Give --entry <address>.` };
  let entry = start;
  let firstFrame = 0;
  let total = 0;
  let ended = false;
  let halted: { stopReason: string; pc: number } | undefined;
  /** Where the run stops: the target of a runUntil step while it runs, then until. */
  let stopAt: number | undefined;
  const atTarget = (pc: number) => stopAt !== undefined && pc === stopAt;
  // The current stage: its memory map since it started, chunk by chunk, its own code, and the written code it calls.
  let stage = { map: new Uint8Array(0x10000), own: new Set<number>(), called: [] as AddressRange[] };
  const startStage = async (next: number, last: Uint8Array) => {
    mergeMaps(stage.map, last);
    await markIoRam(stage.map);
    found.push({ entry, firstFrame, frames: total - firstFrame, wrote: stageWrote(stage.map), next });
    entry = next;
    firstFrame = total;
    stage = { map: new Uint8Array(0x10000), own: new Set<number>(), called: [] };
    await client.memmap({ action: "clear" });
  };

  /**
   * Runs the chunk again from its snapshot with points over the candidate
   * blocks, and stops at the first opcode that the stage wrote and the CPU
   * then executes. Own code stops the run once; a write watch arms it again.
   */
  const rerun = async (candidates: AddressRange[], frames: number): Promise<{ used: number; map: Uint8Array; next?: number; atTarget: boolean; halted?: { stopReason: string; pc: number } }> => {
    const points = new Map<string, { kind: "exec" | "watch"; id: number }>();
    const arm = async (wanted: { exec: AddressRange[]; watch: AddressRange[] }) => {
      const keys = new Set([...wanted.exec.map((range) => `exec:${range.start}:${range.end}`), ...wanted.watch.map((range) => `watch:${range.start}:${range.end}`)]);
      for (const [key, point] of points) {
        if (keys.has(key)) continue;
        if (point.kind === "exec") await client.breakpoint({ action: "remove", id: point.id });
        else await client.watchpoint({ action: "remove", id: point.id });
        points.delete(key);
      }
      for (const range of wanted.exec) {
        const key = `exec:${range.start}:${range.end}`;
        if (!points.has(key)) points.set(key, { kind: "exec", id: (await client.breakpoint({ action: "add", address: range.start, size: range.end - range.start + 1, space: "c64" })).id });
      }
      for (const range of wanted.watch) {
        const key = `watch:${range.start}:${range.end}`;
        if (!points.has(key)) points.set(key, { kind: "watch", id: (await client.watchpoint({ action: "add", address: range.start, size: range.end - range.start + 1, access: "write", space: "c64" })).id });
      }
    };
    /**
     * At written code that a JSR of the stage called: runs on until the call
     * returns, in the frames left. Gives the frames used when it returns;
     * otherwise the machine goes back to the stop and nothing is given.
     */
    const returns = async (map: Uint8Array, frames: number): Promise<number | undefined> => {
      const { sp } = await client.registersGet("c64");
      const stack = await readRam(client, 0x0100, 0x100);
      const pushed = stack[(sp + 1) & 0xff]! | (stack[(sp + 2) & 0xff]! << 8);
      const [opcode] = await readRam(client, (pushed - 2) & 0xffff, 1);
      const back = callReturn(stack, sp, () => opcode!, (address) => ((stage.map[address]! | map[address]!) & COVERAGE.ramExecute) !== 0);
      if (back === undefined) return undefined;
      await arm({ exec: [], watch: [] });
      await client.snapshot({ action: "save", name: CALL_SNAPSHOT });
      const point = await client.breakpoint({ action: "add", address: back, space: "c64" });
      try {
        const run = await client.execution({ action: "advance-frames", count: frames, space: "c64", ...framed() });
        if ((run.pc ?? (await client.registersGet("c64")).pc) === back) return run.advancedFrames ?? 0;
        await client.snapshot({ action: "restore", name: CALL_SNAPSHOT });
        return undefined;
      } finally {
        await client.breakpoint({ action: "remove", id: point.id });
        await client.snapshot({ action: "remove", name: CALL_SNAPSHOT });
      }
    };
    let left = frames;
    let used = 0;
    let map: Uint8Array = new Uint8Array(0x10000);
    try {
      for (let stops = 0; ; stops++) {
        if (stops > MAX_STAGE_STOPS) {
          throw new WireFailure("operation-failed", `The stage that starts at ${formatC64Address(entry)} stopped ${MAX_STAGE_STOPS} times in one chunk of frames without a new stage. Use --min-stage with a larger block size, or capture with --until.`);
        }
        const written = (address: number) => ((stage.map[address]! | map[address]!) & COVERAGE.ramWrite) !== 0;
        await arm(stagePoints(candidates, stage.own, written, stage.called));
        const run = await client.execution({ action: "advance-frames", count: left, space: "c64", ...framed() });
        const advanced = run.advancedFrames ?? 0;
        used += advanced;
        left -= advanced;
        const pc = run.pc ?? (await client.registersGet("c64")).pc;
        map = await readCoverage(client);
        if (run.stopReason === "jam") return { used, map, atTarget: false, halted: { stopReason: "jam", pc } };
        // A frame can end in written code that the stage called before: that stop starts no stage.
        if (inRanges(candidates, pc) && !inRanges(stage.called, pc)) {
          if (written(pc)) {
            const back = left > 0 && !atTarget(pc) ? await returns(map, left) : undefined;
            if (back === undefined) return { used, map, next: pc, atTarget: atTarget(pc) };
            used += back;
            left -= back;
            map = await readCoverage(client);
            // The stage called the block and got the CPU back: the code that ran there is its own code.
            const block = candidates.find((range) => pc >= range.start && pc <= range.end)!;
            stage.called.push(...executedIn(map, block));
            if (left <= 0) return { used, map, atTarget: false };
            continue;
          }
          stage.own.add(pc);
        }
        if (atTarget(pc)) return { used, map, atTarget: true };
        if (left <= 0) return { used, map, atTarget: false };
      }
    } finally {
      for (const point of points.values()) {
        if (point.kind === "exec") await client.breakpoint({ action: "remove", id: point.id });
        else await client.watchpoint({ action: "remove", id: point.id });
      }
    }
  };

  /** Tracks the stages for some frames; true when the CPU got to stopAt. */
  const track = async (frames: number): Promise<boolean> => {
    anchor ??= await rasterAt(client);
    try {
      return await trackFrom(frames);
    } finally {
      anchor = undefined;
    }
  };
  const trackFrom = async (frames: number): Promise<boolean> => {
    let left = frames;
    let stopped = false;
    while (left > 0 && !ended && !stopped && found.length < MAX_STAGES) {
      await client.snapshot({ action: "save", name: STAGE_SNAPSHOT });
      await client.memmap({ action: "clear" });
      const chunk = Math.min(STAGE_CHUNK_FRAMES, left);
      const first = await client.execution({ action: "advance-frames", count: chunk, space: "c64", ...framed() });
      const firstPc = first.pc ?? (await client.registersGet("c64")).pc;
      const map = await readCoverage(client);
      // A JAM, or a point that is not the target, ends the run before its frames.
      if (first.stopReason !== undefined && first.stopReason !== "frames" && !atTarget(firstPc)) {
        total += first.advancedFrames ?? 0;
        mergeMaps(stage.map, map);
        halted = { stopReason: first.stopReason, pc: firstPc };
        ended = true;
        continue;
      }
      const candidates = stageCandidates(stage.map, map, stage.own, options.minStage, stage.called);
      if (candidates.length === 0) {
        const advanced = first.advancedFrames ?? 0;
        total += advanced;
        left -= advanced;
        if (atTarget(firstPc)) {
          // The stop at a target comes before its instruction runs: a target that the stage wrote starts a stage too.
          const combined = Uint8Array.from(stage.map);
          mergeMaps(combined, map);
          const wrote = (combined[firstPc]! & COVERAGE.ramWrite) !== 0 && inRanges(writtenBlocks(combined, options.minStage), firstPc);
          if (wrote) await startStage(firstPc, map);
          else mergeMaps(stage.map, map);
          stopped = true;
        } else {
          mergeMaps(stage.map, map);
          if (advanced === 0) ended = true;
        }
        continue;
      }
      // Again from the start of the chunk, with points over the candidate blocks.
      await client.snapshot({ action: "restore", name: STAGE_SNAPSHOT });
      await client.memmap({ action: "clear" });
      const again = await rerun(candidates, chunk);
      total += again.used;
      left -= again.used;
      if (again.next !== undefined) await startStage(again.next, again.map);
      else mergeMaps(stage.map, again.map);
      if (again.atTarget) stopped = true;
      if (again.halted !== undefined) {
        halted = again.halted;
        ended = true;
      }
    }
    return stopped;
  };
  /** Tracks the stages until the CPU gets to an address, with a breakpoint there. */
  const trackTo = async (address: number, frames: number): Promise<boolean> => {
    stopAt = address;
    const point = await client.breakpoint({ action: "add", address, space: "c64" });
    try {
      return await track(frames);
    } finally {
      await client.breakpoint({ action: "remove", id: point.id });
      stopAt = undefined;
    }
  };
  // The steps run first and in the tracked time: a frames step and a runUntil step to an address. The others act between two chunks.
  for (const [index, step] of options.steps.entries()) {
    if ("frames" in step) await track(step.frames);
    else if (trackedRunUntil(step)) {
      if (!(await trackTo(knowledgeAt()(step.runUntil.target.address), step.runUntil.timeoutFrames))) {
        const { pc } = await client.registersGet("c64");
        const why = halted === undefined ? "" : ` ${stoppedEarly(halted.stopReason, halted.pc, total, step.runUntil.timeoutFrames)}`;
        return { stages: found, frames: total, reached: false, failed: `Step ${index + 1} did not reach its target in ${step.runUntil.timeoutFrames} frames. It is at ${formatC64Address(pc)}.${why}` };
      }
    } else await runActionStep(client, step, knowledgeAt());
  }
  const left = Math.max(0, options.frames - total);
  let reached = false;
  if (options.until === undefined) await track(left);
  else reached = await trackTo(options.until, left);
  await client.snapshot({ action: "remove", name: STAGE_SNAPSHOT }).catch(() => undefined);
  mergeMaps(stage.map, await readCoverage(client));
  await markIoRam(stage.map);
  found.push({ entry, firstFrame, frames: total - firstFrame, wrote: stageWrote(stage.map) });
  return { stages: found, frames: total, reached, ...(halted === undefined ? {} : { halted }) };
}

const showRange = (range: { start: number; end: number }) => ({ start: formatC64Address(range.start), end: formatC64Address(range.end) });
const showStages = (stages: Stage[]) =>
  stages.map((stage, index) => ({
    stage: index,
    entry: formatC64Address(stage.entry),
    frames: stage.frames,
    wrote: stage.wrote.map(showRange),
    ...(stage.next === undefined ? {} : { next: formatC64Address(stage.next) }),
  }));

/** The bytes of a PRG that the emulator starts: RUN needs a BASIC program at $0801, else --entry gives the start. Checked before the emulator opens. */
function startable(program: string, entry: number | undefined): Uint8Array {
  const bytes = readProgram(program);
  if (entry === undefined && basicStart(bytes) === undefined) throw new UsageError(NO_BASIC);
  return bytes;
}

async function stages(program: string, options: { frames: number; entry?: number; steps: ActionStep[]; minStage: number }): Promise<{ output: Record<string, unknown>; failed: boolean }> {
  const bytes = startable(program, options.entry);
  const client = await ViceSessionClient.open({ videoStandard: "pal" });
  try {
    const followed = await follow(client, program, bytes, options);
    if (followed.failed !== undefined) return { output: { followed: false, reason: followed.failed }, failed: true };
    if (followed.halted !== undefined) {
      const { stopReason, pc } = followed.halted;
      return { output: { followed: false, frames: followed.frames, stopReason, pc: formatC64Address(pc), reason: stoppedEarly(stopReason, pc, followed.frames, options.frames), stages: showStages(followed.stages) }, failed: true };
    }
    return {
      output: {
        followed: true,
        frames: followed.frames,
        stages: showStages(followed.stages),
        pc: formatC64Address((await client.registersGet("c64")).pc),
        ...(followed.stages.length > MAX_STAGES ? { moreStages: true } : {}),
      },
      failed: false,
    };
  } finally {
    await client.close();
  }
}

async function capture(
  program: string,
  options: { until: number; out: string; range?: AddressRange; exclude: AddressRange[]; timeoutFrames: number; entry?: number; steps: ActionStep[]; minStage: number },
): Promise<{ output: Record<string, unknown>; failed: boolean }> {
  const bytes = startable(program, options.entry);
  const client = await ViceSessionClient.open({ videoStandard: "pal" });
  try {
    const followed = await follow(client, program, bytes, { frames: options.timeoutFrames, steps: options.steps, minStage: options.minStage, until: options.until, ...(options.entry === undefined ? {} : { entry: options.entry }) });
    if (followed.failed !== undefined) return { output: { captured: false, reason: followed.failed }, failed: true };
    const registers = await client.registersGet("c64");
    if (!followed.reached) {
      return {
        output: {
          captured: false,
          reason: `The program did not get to ${formatC64Address(options.until)} in ${options.timeoutFrames} frames. It is at ${formatC64Address(registers.pc)}.${followed.halted === undefined ? "" : ` ${stoppedEarly(followed.halted.stopReason, followed.halted.pc, followed.frames, options.timeoutFrames)}`}`,
          ...(followed.halted === undefined ? {} : { stopReason: followed.halted.stopReason }),
          stages: showStages(followed.stages),
        },
        failed: true,
      };
    }
    // The RAM view: unpacked code is often under the ROMs or the I/O area.
    const memory = await readRam(client, 0x0000, 0x10000);
    const state = await machineState(client);
    // The segments: what the stages wrote, without loader leftovers, with no overlap.
    const found = options.range !== undefined ? [options.range] : captureSegments(followed.stages, registers.pc);
    const segments = withoutRanges(found, options.exclude);
    const file = (path: string) => `${options.out}/${path}`;
    const written: Written[] = [];
    const write = (path: string, bytes: Uint8Array) => written.push(writeReported(file(path), bytes, { what: "--out" }));
    write("image.bin", memory);
    const files = segments.map((segment) => {
      const name = `segment-${segment.start.toString(16).padStart(4, "0")}-${segment.end.toString(16).padStart(4, "0")}.prg`;
      write(name, Buffer.concat([Buffer.from([segment.start & 0xff, segment.start >> 8]), memory.subarray(segment.start, segment.end + 1)]));
      return name;
    });
    const vectors = vectorsOf(state, memory);
    write(
      "image.json",
      Buffer.from(
        `${JSON.stringify(
          {
            entry: formatC64Address(registers.pc),
            segments: segments.map((segment, index) => ({ ...showRange(segment), ...("writtenBy" in segment ? { writtenBy: segment.writtenBy } : {}), file: files[index] })),
            ...(options.exclude.length === 0 ? {} : { excluded: options.exclude.map(showRange) }),
            vectors,
            stages: showStages(followed.stages),
            image: "image.bin",
          },
          null,
          2,
        )}\n`,
      ),
    );
    // A clean machine at the READY prompt shows what the loader and the stages changed.
    const entry = entryStateFile(registers, state, vectors, await readyState(client));
    write("entry_state.json", entry.bytes);
    // A capture again into the folder: the segment PRGs of the earlier capture that image.json no longer lists go.
    const removed = removeStaleFiles(options.out, files);
    return {
      output: {
        captured: true,
        pc: formatC64Address(registers.pc),
        out: options.out,
        files: written,
        ...(removed.length === 0 ? {} : { removed }),
        segments: segments.map(showRange),
        ...(options.exclude.length === 0 ? {} : { excluded: options.exclude.map(showRange) }),
        stages: followed.stages.length,
        differsFromReset: entry.differsFromReset,
      },
      failed: false,
    };
  } finally {
    await client.close();
  }
}

const PROGRAM = { name: "<program>", help: "a PRG file, relative to the project folder" };
const FRAMES: OptionSpec = { ...OPTIONS.frames, max: 30_000, default: 3000, help: "run the program for n frames (default 3000)" };
const ENTRY: OptionSpec = { ...OPTIONS.entry, help: "start the program here in place of RUN" };
const STEPS: OptionSpec = { ...OPTIONS.steps, help: "action steps (JSON) that run right after the program starts, for example to press a key in an intro or to get through a menu" };
const EXCLUDE: OptionSpec = { kind: "range", value: "<start>-<end>", multiple: true, help: "a range to leave out of the segments, for example bytes that a crack left and the program never reads" };
const MIN_STAGE: OptionSpec = { kind: "count", value: "<bytes>", min: 1, max: 0x10000, default: 64, help: "a stage starts when the CPU executes a block of at least this many bytes that the stage before wrote (default 64)" };

/** The result of a command: PASS, or FAIL with the reason. */
const outcome = ({ output, failed }: { output: unknown; failed: boolean }) => ({ result: failed ? "FAIL" : "PASS", ...(output as Record<string, unknown>) });
const entryOf = (call: Call) => {
  const entry = call.address("entry");
  return entry === undefined ? {} : { entry };
};
const stepsOf = (call: Call) => {
  const path = call.string("steps");
  return path === undefined ? [] : readActionSteps(path, "--steps", knowledgeAt());
};
/** The --entry and --steps of the call, so that the next command starts the program in the same way. */
const sameStart = (call: Call): string[] => {
  const entry = call.address("entry");
  const steps = call.string("steps");
  return [...(entry === undefined ? [] : ["--entry", formatC64Address(entry)]), ...(steps === undefined ? [] : ["--steps", steps])];
};
/** The hints of a result, as one text, or undefined when there is none. */
const joined = (hints: Array<string | undefined>) => {
  const given = hints.filter((hint): hint is string => hint !== undefined);
  return given.length === 0 ? undefined : given.join(" ");
};
/** The folder that a capture writes when the agent follows the nextAction of stages. */
const CAPTURE_OUT = ".c64-re-tools/local/capture";

/** inspect: the next step is a run of the program with trace. A program without a BASIC start needs --entry for it. */
function inspected(call: Call) {
  const program = call.subject(0);
  const bytes = readProgram(program);
  const evidence = inspect(bytes);
  if (basicStart(bytes) === undefined) return reply(evidence, { hint: "The program is not a BASIC program at $0801, so RUN cannot start it. Find the start address of the code, and give it as --entry to trace, stages and capture." });
  return reply(evidence, { hint: "Run trace to get the evidence of a run.", nextAction: call.next("trace", program) });
}

/** trace: after code that the program wrote and executed, the next step is stages. */
function traced(call: Call, { output, failed }: { output: Record<string, unknown>; failed: boolean }) {
  const result = outcome({ output, failed });
  if (failed) return result;
  const more = (output.writtenThenExecuted as { rest?: string }).rest === undefined ? undefined : "The list writtenThenExecuted is cut. Give a larger --max-listed to see all of it.";
  if (output.packing === "unlikely") return reply(result, { hint: joined(["The program executed no code that it wrote. If the program waits for a key or a joystick, give the input in --steps and run trace again.", more]) });
  return reply(result, { hint: joined(["Run stages to find the entry of each stage.", more]), nextAction: call.next("stages", call.subject(0), ...sameStart(call)) });
}

/** stages: the entry of the last stage is usually the start of the program; the next step is a capture there. */
function staged(call: Call, { output, failed }: { output: Record<string, unknown>; failed: boolean }) {
  const result = outcome({ output, failed });
  if (failed) return result;
  const last = (output.stages as Array<{ entry: string }>).at(-1)!.entry;
  const more = output.moreStages === true ? `The script followed only the first ${MAX_STAGES} stages. Give a larger --min-stage, so that small stages join.` : undefined;
  return reply(result, {
    hint: joined([more, `Disassemble the code at ${last}, the entry of the last stage. Make sure that it is the start of the program and not a second unpacker. Then capture at that address.`]),
    nextAction: call.next("capture", call.subject(0), "--until", last, "--out", CAPTURE_OUT, ...sameStart(call)),
  });
}

/** capture: the next step is a check of the entry, then the capture goes into the project knowledge. */
function captured(call: Call, { output, failed }: { output: Record<string, unknown>; failed: boolean }) {
  const result = outcome({ output, failed });
  if (failed) return result;
  return reply(result, { hint: `Disassemble the code at ${output.pc as string}. Make sure that it is the program and not the unpacker again. Then put the capture ${call.string("out")!}/image.json into the project knowledge.` });
}

/** loads: each capture goes into the project knowledge when the agent works on that part. */
function loaded(call: Call, { output, failed }: { output: Record<string, unknown>; failed: boolean }) {
  const result = outcome({ output, failed });
  if (failed) return result;
  const out = call.string("out")!;
  const drive = call.flag("drive") ? ` Put the drive RAM ${out}/<name>/drive8.prg into the project knowledge in the space drive8.` : "";
  return reply(result, { hint: `Put the capture ${out}/<name>/image.json of the part that you work on into the project knowledge.${drive}` });
}

const COMMANDS: CommandSpec[] = [
  {
    name: "inspect",
    summary: "Packing evidence: the BASIC start and the entropy of the bytes.",
    subjects: [PROGRAM],
    run: inspected,
  },
  {
    name: "trace",
    summary: "Runs the program and reports the memory that it wrote and then executed.",
    subjects: [PROGRAM],
    options: { frames: FRAMES, entry: ENTRY, steps: STEPS, "max-listed": OPTIONS["max-listed"] },
    run: async (call) => traced(call, await trace(call.subject(0), { frames: call.count("frames")!, steps: stepsOf(call), max: call.count("max-listed")!, ...entryOf(call) })),
  },
  {
    name: "stages",
    summary: "Runs the program and reports each stage: where it starts, the memory it wrote, and where the next one starts.",
    subjects: [PROGRAM],
    options: { frames: FRAMES, entry: ENTRY, steps: STEPS, "min-stage": MIN_STAGE },
    notes: "stages tracks the stages in frames steps and in runUntil steps to an address target without a condition.",
    run: async (call) => {
      const steps = stepsOf(call);
      // A runUntil step to a raster line or a memory value cannot be tracked in chunks of frames; capture takes it.
      const untracked = steps.findIndex((step) => "runUntil" in step && !trackedRunUntil(step));
      if (untracked >= 0) throw new UsageError(`--steps ${call.string("steps")!}: step ${untracked + 1}: stages takes a runUntil step only with an address target without a condition. Use frames steps, or use capture.`);
      return staged(call, await stages(call.subject(0), { frames: call.count("frames")!, steps, minStage: call.count("min-stage")!, ...entryOf(call) }));
    },
  },
  {
    name: "capture",
    summary: "Runs the program until the CPU gets to --until after the steps, and writes into --out: image.bin (64 KiB of RAM), image.json (the entry, the segments that the stages wrote, the vectors, the stages), a PRG for each segment, and entry_state.json.",
    subjects: [PROGRAM],
    options: {
      until: { kind: "address", value: "<address>", required: true, help: "the unpacked entry point" },
      out: { ...OPTIONS.out, output: "folder", value: "<dir>", required: true, help: "the folder for the capture, relative to the project folder" },
      range: { ...OPTIONS.range, help: "one segment in place of the found ones" },
      exclude: EXCLUDE,
      "timeout-frames": { ...OPTIONS["timeout-frames"], max: 30_000, default: 3000, help: "stop the wait for --until after n frames (default 3000)" },
      entry: ENTRY,
      steps: STEPS,
      "min-stage": MIN_STAGE,
    },
    notes: "entry_state.json has the registers, $00/$01, pages 0-3, the VIC, SID and CIA registers, the vectors, and what differs from a clean reset.",
    run: async (call) => {
      const range = call.range("range");
      const until = call.address("until")!;
      // A segment must hold the entry: refused before the emulator runs.
      const show = (item: AddressRange) => `${formatC64Address(item.start)}-${formatC64Address(item.end)}`;
      const holds = (item: AddressRange) => until >= item.start && until <= item.end;
      const excluded = call.ranges("exclude").find(holds);
      if (excluded !== undefined) throw new UsageError(`--exclude ${show(excluded)} holds the entry --until ${formatC64Address(until)}. A segment must hold the entry: give an --exclude range without it.`);
      if (range !== undefined && !holds(range)) throw new UsageError(`--range ${show(range)} does not hold the entry --until ${formatC64Address(until)}. Give a --range that holds the entry.`);
      return captured(call, await capture(call.subject(0), { until, out: call.string("out")!, ...(range === undefined ? {} : { range }), exclude: call.ranges("exclude"), timeoutFrames: call.count("timeout-frames")!, steps: stepsOf(call), minStage: call.count("min-stage")!, ...entryOf(call) }));
    },
  },
  {
    name: "loads",
    summary: "Runs a multi-load program with the steps file. Each capture step {\"capture\": \"<name>\"} writes <dir>/<name>/ with image.bin, image.json, entry_state.json and a PRG for each block that the C64 side changed since the previous capture.",
    subjects: [{ name: "<program>", help: "a PRG, or a disk, tape or cartridge image, relative to the project folder" }],
    options: {
      steps: { ...STEPS, required: true, help: "action steps and capture steps (JSON)" },
      out: { ...OPTIONS.out, output: "folder", value: "<dir>", required: true, help: "the folder for the captures, relative to the project folder" },
      drive: { kind: "flag", help: "also write the 2 KiB drive RAM as drive8.prg, for knowledge space drive8" },
      "min-block": { kind: "count", value: "<bytes>", min: 1, max: 0x10000, default: 64, help: "write a changed block of at least this many bytes (default 64)" },
      exclude: EXCLUDE,
    },
    run: async (call) => loaded(call, await loads(call.subject(0), { out: call.string("out")!, steps: readLoadSteps(call.string("steps")!), drive: call.flag("drive"), minBlock: call.count("min-block")!, exclude: call.ranges("exclude") })),
  },
];

await runScript({
  name: "unpacker",
  summary: "Packing evidence of a program, and captures of the program after it unpacked itself. It never names a packer and runs no native unpack tool.",
  names: knowledgeNames,
  commands: COMMANDS,
});
