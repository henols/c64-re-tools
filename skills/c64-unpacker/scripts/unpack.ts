// The c64-unpacker script. "inspect" gives local evidence of packing; it never
// names a packer. "trace" runs the program and reports the memory that it
// wrote and then executed: the run-time evidence that also finds a simple
// cruncher whose bytes look like code. "capture" runs the program in an
// emulator until it reaches a given address (the unpacked entry point) and
// writes the memory into the project. "loads" captures each part of a
// multi-load program (D53). No native unpack tool is used.

import { parseArgs } from "node:util";

import { COVERAGE, EXECUTE, formatC64Address, parseC64Address, READ, textToPetscii, WRITE } from "#src/c64.ts";
import { autostartLoaded, LOAD_LIMIT_FRAMES } from "#src/host-client/autostart.ts";
import { readCoverage, writtenBlocks } from "#src/host-client/coverage.ts";
import { checkActionSteps, runActionStep, type ActionStep } from "#src/host-client/steps.ts";
import { WireFailure } from "#src/host-client/tools.ts";
import { readProjectFile, writeProjectFile } from "#src/host-client/transfer.ts";
import { ViceSessionClient } from "#src/host-client/vice-session.ts";
import { resolveProjectPath } from "#src/project.ts";
import { runScript, UsageError } from "#src/script.ts";
import { basicStart, inspect, PackingError, readMemoryMap, underRom, writtenThenExecuted } from "./evidence.ts";
import { loads, readLoadSteps } from "./loads.ts";
import { inRanges, mergeMaps, stageCandidates, stagePoints, type Range } from "./stages.ts";
import { entryState, IO_AREAS, json, machineState, readRam, READY_FRAMES, vectorsOf } from "./machine.ts";

const USAGE = `unpack.ts inspect <program.prg>
unpack.ts trace <program.prg> [--frames <n>] [--entry <address>] [--steps <file>]
unpack.ts capture <program.prg> --until <address> --out <dir> [--range <start> <end>] [--timeout-frames <n>] [--entry <address>] [--steps <file>] [--min-stage <bytes>]
unpack.ts stages <program.prg> [--frames <n>] [--entry <address>] [--steps <file>] [--min-stage <bytes>]
unpack.ts loads <program> --steps <file> --out <dir> [--drive] [--min-block <bytes>]

inspect   packing evidence: the BASIC start and the entropy of the bytes
trace     run the program for <n> frames (default 3000) and report the memory
          that it wrote and then executed; --entry starts it there instead of RUN
capture   run the program until the CPU gets to <address>, and write into the
          directory --out: image.bin (64 KiB of RAM), image.json (the entry,
          the segments that the stages wrote, the vectors, the stages), a PRG
          for each segment, and entry_state.json (registers, $00/$01, pages
          0-3, VIC, SID and CIA registers, vectors, and what differs from a
          clean reset). --range gives one segment in place of the found ones.
          --entry starts it there instead of RUN.

stages    run the program for <n> frames (default 3000) and report each stage:
          where it starts, the memory it wrote, and where the next one starts.
          A stage starts when the CPU executes a block of at least
          --min-stage bytes (default 64) that the stage before wrote.

loads     run a multi-load program (a PRG, or a disk, tape or cartridge image)
          with the steps file; each capture step {"capture": "<name>"} writes
          <dir>/<name>/ with image.bin, image.json, entry_state.json and a PRG
          for each block of at least --min-block bytes (default 64) that the C64
          side changed since the previous capture. --drive also writes the 2 KiB
          drive RAM as drive8.prg, for knowledge space drive8.

--steps <file>  a JSON list of input steps that run right after the program
          starts: write, registers, joystick, type, frames and runUntil, as in
          c64-testing scenarios, with $ addresses only. Use it to press a key
          in an intro or to get through a menu.

Addresses are $ and four hex digits. The result is one JSON object.`;


function address(text: string, option: string): number {
  try {
    return parseC64Address(text);
  } catch {
    throw new UsageError(`${option} must be $ followed by four hex digits, not ${text}`);
  }
}

/** Written-then-executed bytes from this many on are unpacking, decrypting or relocating, not self-changing code. */
const UNPACKED_BYTES = 256;
const MAX_ADVANCE = 10_000;
/** The most ranges one memory map read gives. */
const MAX_RANGES = 1000;

/** Reads and checks a steps file: action steps with $ addresses only (D43). */
function readSteps(path: string): ActionStep[] {
  let value: unknown;
  try {
    value = JSON.parse(readProjectFile(path).bytes.toString("utf8"));
  } catch (error) {
    if (error instanceof WireFailure) throw error;
    throw new UsageError(`--steps ${path} is not JSON: ${(error as Error).message}`);
  }
  return checkActionSteps(value, (message) => {
    throw new UsageError(`--steps ${path}: ${message}`);
  });
}

/** Runs the steps; the reason when a runUntil step did not reach its target. */
async function runSteps(client: ViceSessionClient, steps: ActionStep[]): Promise<string | undefined> {
  for (const [index, step] of steps.entries()) {
    const notReached = await runActionStep(client, step, parseC64Address);
    if (notReached !== undefined && "runUntil" in step) {
      return `Step ${index + 1} did not reach its target in ${step.timeoutFrames} frames. It stopped by ${notReached.stopReason} at ${formatC64Address(notReached.pc)}.`;
    }
  }
  return undefined;
}

async function trace(program: string, options: { frames: number; entry?: number; steps: ActionStep[] }): Promise<{ output: Record<string, unknown>; failed: boolean }> {
  const { bytes } = readProjectFile(program);
  if (bytes.length < 3) throw new UsageError("the file is too short for a PRG");
  const load = bytes[0]! | (bytes[1]! << 8);
  if (options.entry === undefined && basicStart(bytes) === undefined) throw new UsageError(NO_BASIC);
  const client = await ViceSessionClient.open({ videoStandard: "pal" });
  try {
    // Loaded but not started, so the memory map can start empty: the KERNAL start-up writes all of RAM.
    if (!(await autostartLoaded(client, program, bytes))) return { output: { traced: false, reason: `The program was not in memory at ${formatC64Address(load)} after ${LOAD_LIMIT_FRAMES} frames.` }, failed: true };
    await client.memmap({ action: "clear" });
    if (options.entry !== undefined) await client.registersSet("c64", { pc: options.entry });
    else await client.keyboard(textToPetscii("RUN\n"));
    const stepFailed = await runSteps(client, options.steps);
    if (stepFailed !== undefined) return { output: { traced: false, reason: stepFailed }, failed: true };
    let ran = 0;
    while (ran < options.frames) {
      const step = await client.execution({ action: "advance-frames", count: Math.min(MAX_ADVANCE, options.frames - ran), space: "c64" });
      const advanced = step.advancedFrames ?? 0;
      ran += advanced;
      if (advanced === 0) break;
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
        writtenThenExecuted: written.map((range) => ({
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

const NO_BASIC = "the program is no BASIC program at $0801, so RUN cannot start it. Give --entry <address>.";

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
async function firstPcAfterBasic(client: ViceSessionClient, from: number, to: number): Promise<number | undefined> {
  return from > to ? undefined : firstPcIn(client, [{ start: from, end: to }]);
}

/** Frames between two looks at the memory map while stages are followed. */
const STAGE_CHUNK_FRAMES = 25;
const MAX_STAGES = 16;
/** Most stops of one re-run of a chunk: own code and writes over it each stop once. */
const MAX_STAGE_STOPS = 4096;
const STAGE_SNAPSHOT = "stage-chunk";

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
}

/**
 * Starts the program and follows its stages (D43). The memory map holds what
 * the current stage wrote; when the CPU executed a block of at least
 * `minStage` written bytes during a chunk of frames, the chunk runs again from
 * its snapshot with exec breakpoints over those blocks, which stop at the
 * first instruction of the next stage. Steps run in the tracked time: a frames
 * step is tracked, the others act between two chunks. With `until`, the
 * run ends when the CPU gets there.
 */
async function follow(
  client: ViceSessionClient,
  program: string,
  options: { frames: number; entry?: number; steps: ActionStep[]; minStage: number; until?: number },
): Promise<Followed> {
  const { bytes } = readProjectFile(program);
  if (bytes.length < 3) throw new UsageError("the file is too short for a PRG");
  const load = bytes[0]! | (bytes[1]! << 8);
  const basic = basicStart(bytes);
  if (options.entry === undefined && basic === undefined) throw new UsageError(NO_BASIC);
  if (!(await autostartLoaded(client, program, bytes))) return { stages: [], frames: 0, reached: false, failed: `The program was not in memory at ${formatC64Address(load)} after ${LOAD_LIMIT_FRAMES} frames.` };
  await client.memmap({ action: "clear" });
  if (options.entry !== undefined) await client.registersSet("c64", { pc: options.entry });
  else await client.keyboard(textToPetscii("RUN\n"));
  const target = options.until === undefined ? undefined : await client.breakpoint({ action: "add", address: options.until, space: "c64" });
  const found: Stage[] = [];
  const start = options.entry ?? basic!.sys?.address ?? (await firstPcAfterBasic(client, basic!.basicEnd, load + bytes.length - 3));
  if (start === undefined) return { stages: [], frames: 0, reached: false, failed: `After RUN, the CPU did not execute the program after its BASIC text (${formatC64Address(basic!.basicEnd)} on) in ${SYS_FRAMES} frames. Give --entry <address>.` };
  let entry = start;
  let firstFrame = 0;
  let total = 0;
  let ended = false;
  let reached = false;
  const atTarget = (pc: number) => options.until !== undefined && pc === options.until;
  // The current stage: its memory map since it started, chunk by chunk, and its own code.
  let stage = { map: new Uint8Array(0x10000), own: new Set<number>() };
  const startStage = async (next: number, last: Uint8Array) => {
    mergeMaps(stage.map, last);
    found.push({ entry, firstFrame, frames: total - firstFrame, wrote: writtenBlocks(stage.map, options.minStage), next });
    entry = next;
    firstFrame = total;
    stage = { map: new Uint8Array(0x10000), own: new Set<number>() };
    await client.memmap({ action: "clear" });
  };

  /**
   * Runs the chunk again from its snapshot with points over the candidate
   * blocks, and stops at the first opcode that the stage wrote and the CPU
   * then executes. Own code stops the run once; a write watch arms it again.
   */
  const rerun = async (candidates: Range[], frames: number): Promise<{ used: number; map: Uint8Array; next?: number; atTarget: boolean }> => {
    const points = new Map<string, { kind: "exec" | "watch"; id: number }>();
    const arm = async (wanted: { exec: Range[]; watch: Range[] }) => {
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
    let left = frames;
    let used = 0;
    let map: Uint8Array = new Uint8Array(0x10000);
    try {
      for (let stops = 0; ; stops++) {
        if (stops > MAX_STAGE_STOPS) {
          throw new WireFailure("operation-failed", `The stage that starts at ${formatC64Address(entry)} stopped ${MAX_STAGE_STOPS} times in one chunk of frames without a new stage. Use --min-stage with a larger block size, or capture with --until.`);
        }
        const written = (address: number) => ((stage.map[address]! | map[address]!) & COVERAGE.ramWrite) !== 0;
        await arm(stagePoints(candidates, stage.own, written));
        const run = await client.execution({ action: "advance-frames", count: left, space: "c64" });
        const advanced = run.advancedFrames ?? 0;
        used += advanced;
        left -= advanced;
        const pc = run.pc ?? (await client.registersGet("c64")).pc;
        map = await readCoverage(client);
        if (inRanges(candidates, pc)) {
          if (written(pc)) return { used, map, next: pc, atTarget: atTarget(pc) };
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

  const track = async (frames: number): Promise<void> => {
    let left = frames;
    while (left > 0 && !ended && !reached && found.length < MAX_STAGES) {
      await client.snapshot({ action: "save", name: STAGE_SNAPSHOT });
      await client.memmap({ action: "clear" });
      const chunk = Math.min(STAGE_CHUNK_FRAMES, left);
      const first = await client.execution({ action: "advance-frames", count: chunk, space: "c64" });
      const firstPc = first.pc ?? (await client.registersGet("c64")).pc;
      const map = await readCoverage(client);
      const candidates = stageCandidates(stage.map, map, stage.own, options.minStage);
      if (candidates.length === 0) {
        const advanced = first.advancedFrames ?? 0;
        total += advanced;
        left -= advanced;
        if (atTarget(firstPc)) {
          // The stop at until comes before its instruction runs: a target that the stage wrote starts a stage too.
          const combined = Uint8Array.from(stage.map);
          mergeMaps(combined, map);
          const wrote = (combined[firstPc]! & COVERAGE.ramWrite) !== 0 && inRanges(writtenBlocks(combined, options.minStage), firstPc);
          if (wrote) await startStage(firstPc, map);
          else mergeMaps(stage.map, map);
          reached = true;
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
      if (again.atTarget) reached = true;
    }
  };
  for (const step of options.steps) {
    if ("frames" in step) await track(step.frames);
    else await runActionStep(client, step, parseC64Address);
  }
  await track(Math.max(0, options.frames - total));
  if (target !== undefined) await client.breakpoint({ action: "remove", id: target.id });
  await client.snapshot({ action: "discard", name: STAGE_SNAPSHOT }).catch(() => undefined);
  mergeMaps(stage.map, await readCoverage(client));
  found.push({ entry, firstFrame, frames: total - firstFrame, wrote: writtenBlocks(stage.map, options.minStage) });
  return { stages: found, frames: total, reached };
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

async function stages(program: string, options: { frames: number; entry?: number; steps: ActionStep[]; minStage: number }): Promise<{ output: Record<string, unknown>; failed: boolean }> {
  const client = await ViceSessionClient.open({ videoStandard: "pal" });
  try {
    const followed = await follow(client, program, options);
    if (followed.failed !== undefined) return { output: { followed: false, reason: followed.failed }, failed: true };
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
  options: { until: number; out: string; range?: [number, number]; timeoutFrames: number; entry?: number; steps: ActionStep[]; minStage: number },
): Promise<{ output: Record<string, unknown>; failed: boolean }> {
  const client = await ViceSessionClient.open({ videoStandard: "pal" });
  try {
    const followed = await follow(client, program, { frames: options.timeoutFrames, steps: options.steps, minStage: options.minStage, until: options.until, ...(options.entry === undefined ? {} : { entry: options.entry }) });
    if (followed.failed !== undefined) return { output: { captured: false, reason: followed.failed }, failed: true };
    const registers = await client.registersGet("c64");
    if (!followed.reached) {
      return {
        output: { captured: false, reason: `The program did not get to ${formatC64Address(options.until)} in ${options.timeoutFrames} frames. It is at ${formatC64Address(registers.pc)}.`, stages: showStages(followed.stages) },
        failed: true,
      };
    }
    // The RAM view: unpacked code is often under the ROMs or the I/O area.
    const memory = await readRam(client, 0x0000, 0x10000);
    const state = await machineState(client);
    // The segments: what the stages wrote, without the blocks that hold the code of an earlier stage.
    const earlier = followed.stages.slice(0, -1).map((stage) => stage.entry);
    const written = followed.stages.flatMap((stage, index) => stage.wrote.map((range) => ({ ...range, writtenBy: index })));
    const segments = options.range !== undefined ? [{ start: options.range[0], end: options.range[1] }] : written.filter((range) => !earlier.some((entry) => entry >= range.start && entry <= range.end));
    const file = (path: string) => `${options.out}/${path}`;
    const write = (path: string, bytes: Uint8Array) => writeProjectFile(file(path), bytes, { what: "--out" });
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
    await client.reset({ mode: "hard", run: true });
    await client.execution({ action: "advance-frames", count: READY_FRAMES, space: "c64" });
    const clean = await machineState(client);
    const differs: Array<{ address: string; entry: number; reset: number }> = [];
    const compare = (base: number, entry: Buffer, reset: Buffer) => entry.forEach((value, offset) => value !== reset[offset] && differs.push({ address: formatC64Address(base + offset), entry: value, reset: reset[offset]! }));
    compare(0x0000, state.port, clean.port);
    compare(0x0002, state.pages.subarray(2), clean.pages.subarray(2));
    for (const [name, [address]] of Object.entries(IO_AREAS)) compare(address, state.io[name as keyof typeof IO_AREAS], clean.io[name as keyof typeof IO_AREAS]);
    write("entry_state.json", json(entryState(registers, state, vectors, differs)));
    return {
      output: {
        captured: true,
        pc: formatC64Address(registers.pc),
        out: options.out,
        files: ["image.json", "image.bin", "entry_state.json", ...files],
        segments: segments.map(showRange),
        stages: followed.stages.length,
        differsFromReset: differs.length,
      },
      failed: false,
    };
  } finally {
    await client.close();
  }
}

/** The options that each command takes; any other option is refused, not ignored. */
const OPTIONS_OF: Record<string, string[]> = {
  inspect: [],
  trace: ["frames", "entry", "steps"],
  stages: ["frames", "entry", "steps", "min-stage"],
  capture: ["until", "out", "range", "timeout-frames", "entry", "steps", "min-stage"],
  loads: ["steps", "out", "drive", "min-block"],
};

async function run(argv: string[]): Promise<{ output: unknown; failed: boolean }> {
  const { values, positionals } = parseArgs({
    args: argv,
    strict: true,
    allowPositionals: true,
    options: {
      until: { type: "string" },
      out: { type: "string" },
      range: { type: "string" },
      "timeout-frames": { type: "string" },
      frames: { type: "string" },
      entry: { type: "string" },
      steps: { type: "string" },
      "min-stage": { type: "string" },
      "min-block": { type: "string" },
      drive: { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  if (values.help) throw new UsageError("");
  const [command, program, ...rest] = positionals;
  if (program === undefined) throw new UsageError("give a command and a program");
  const allowed = OPTIONS_OF[command ?? ""];
  if (allowed === undefined) throw new UsageError(`unknown command ${command}`);
  for (const option of Object.keys(values)) {
    if (option !== "help" && !allowed.includes(option)) throw new UsageError(`${command} does not take --${option}`);
  }
  if (command === "inspect") {
    if (rest.length > 0) throw new UsageError("inspect takes one program");
    const { bytes } = readProjectFile(program);
    try {
      return { output: inspect(bytes), failed: false };
    } catch (error) {
      if (error instanceof PackingError) throw new UsageError(error.message);
      throw error;
    }
  }
  if (command === "trace") {
    if (rest.length > 0) throw new UsageError("trace takes one program");
    const frames = values.frames === undefined ? 3000 : Number(values.frames);
    if (!Number.isInteger(frames) || frames < 1 || frames > 30_000) throw new UsageError("--frames must be from 1 to 30000");
    const steps = values.steps === undefined ? [] : readSteps(values.steps);
    return trace(program, { frames, steps, ...(values.entry === undefined ? {} : { entry: address(values.entry, "--entry") }) });
  }
  if (command === "stages") {
    if (rest.length > 0) throw new UsageError("stages takes one program");
    const frames = values.frames === undefined ? 3000 : Number(values.frames);
    if (!Number.isInteger(frames) || frames < 1 || frames > 30_000) throw new UsageError("--frames must be from 1 to 30000");
    const minStage = values["min-stage"] === undefined ? 64 : Number(values["min-stage"]);
    if (!Number.isInteger(minStage) || minStage < 1 || minStage > 0x10000) throw new UsageError("--min-stage must be from 1 to 65536");
    const steps = values.steps === undefined ? [] : readSteps(values.steps);
    // A runUntil step cannot be tracked in chunks of frames; capture takes it.
    if (steps.some((step) => "runUntil" in step)) throw new UsageError("stages takes no runUntil step; use frames steps");
    return stages(program, { frames, steps, minStage, ...(values.entry === undefined ? {} : { entry: address(values.entry, "--entry") }) });
  }
  if (command === "loads") {
    if (rest.length > 0) throw new UsageError("loads takes one program");
    if (values.steps === undefined || values.out === undefined) throw new UsageError("loads needs --steps and --out");
    try {
      resolveProjectPath(values.out);
    } catch {
      throw new UsageError(`--out must be a path relative to the project directory that stays inside it, not ${values.out}`);
    }
    const minBlock = values["min-block"] === undefined ? 64 : Number(values["min-block"]);
    if (!Number.isInteger(minBlock) || minBlock < 1 || minBlock > 0x10000) throw new UsageError("--min-block must be from 1 to 65536");
    return loads(program, { out: values.out, steps: readLoadSteps(values.steps), drive: values.drive === true, minBlock });
  }
  if (values.until === undefined || values.out === undefined) throw new UsageError("capture needs --until and --out");
  // --range takes two values: the end is the next positional argument.
  let range: [number, number] | undefined;
  if (values.range !== undefined) {
    if (rest.length !== 1) throw new UsageError("--range takes a start and an end address");
    range = [address(values.range, "--range"), address(rest[0]!, "--range")];
    if (range[1] < range[0]) throw new UsageError("the --range end must not be before its start");
  } else if (rest.length > 0) {
    throw new UsageError("too many arguments");
  }
  try {
    resolveProjectPath(values.out);
  } catch {
    throw new UsageError(`--out must be a path relative to the project directory that stays inside it, not ${values.out}`);
  }
  const timeoutFrames = values["timeout-frames"] === undefined ? 3000 : Number(values["timeout-frames"]);
  if (!Number.isInteger(timeoutFrames) || timeoutFrames < 1 || timeoutFrames > 30_000) throw new UsageError("--timeout-frames must be from 1 to 30000");
  const steps = values.steps === undefined ? [] : readSteps(values.steps);
  const minStage = values["min-stage"] === undefined ? 64 : Number(values["min-stage"]);
  if (!Number.isInteger(minStage) || minStage < 1 || minStage > 0x10000) throw new UsageError("--min-stage must be from 1 to 65536");
  return capture(program, {
    until: address(values.until, "--until"),
    out: values.out,
    ...(range === undefined ? {} : { range }),
    timeoutFrames,
    steps,
    minStage,
    ...(values.entry === undefined ? {} : { entry: address(values.entry, "--entry") }),
  });
}

await runScript(
  async () => {
    const { output, failed } = await run(process.argv.slice(2));
    if (failed) process.exitCode = 1;
    return output;
  },
  { usage: USAGE },
);
