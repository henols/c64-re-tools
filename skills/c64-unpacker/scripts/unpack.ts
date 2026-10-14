// The c64-unpacker script. "inspect" gives local evidence of packing; it never
// names a packer. "trace" runs the program and reports the memory that it
// wrote and then executed: the run-time evidence that also finds a simple
// cruncher whose bytes look like code. "capture" runs the program in an
// emulator until it reaches a given address (the unpacked entry point) and
// writes the memory into the project. No native unpack tool is used.

import { parseArgs } from "node:util";

import { EXECUTE, formatC64Address, parseC64Address, READ, textToPetscii, WRITE } from "#src/c64.ts";
import { autostartLoaded, LOAD_LIMIT_FRAMES } from "#src/host-client/autostart.ts";
import { executedIn, readCoverage, writtenBlocks } from "#src/host-client/coverage.ts";
import { checkActionSteps, runActionStep, type ActionStep } from "#src/host-client/steps.ts";
import { WireFailure } from "#src/host-client/tools.ts";
import { readProjectFile, writeProjectFile } from "#src/host-client/transfer.ts";
import { ViceSessionClient } from "#src/host-client/vice-session.ts";
import { resolveProjectPath } from "#src/project.ts";
import { runScript, UsageError } from "#src/script.ts";
import { inspect, PackingError, readMemoryMap, underRom, writtenThenExecuted } from "./evidence.ts";

const USAGE = `unpack.ts inspect <program.prg>
unpack.ts trace <program.prg> [--frames <n>] [--entry <address>] [--steps <file>]
unpack.ts capture <program.prg> --until <address> --out <dir> [--range <start> <end>] [--timeout-frames <n>] [--steps <file>] [--min-stage <bytes>]
unpack.ts stages <program.prg> [--frames <n>] [--entry <address>] [--steps <file>] [--min-stage <bytes>]

inspect   packing evidence: the BASIC start and the entropy of the bytes
trace     run the program for <n> frames (default 3000) and report the memory
          that it wrote and then executed; --entry starts it there instead of RUN
capture   run the program until the CPU gets to <address>, and write into the
          directory --out: image.bin (64 KiB of RAM), image.json (the entry,
          the segments that the stages wrote, the vectors, the stages), a PRG
          for each segment, and entry_state.json (registers, $00/$01, pages
          0-3, VIC, SID and CIA registers, vectors, and what differs from a
          clean reset). --range gives one segment in place of the found ones.

stages    run the program for <n> frames (default 3000) and report each stage:
          where it starts, the memory it wrote, and where the next one starts.
          A stage starts when the CPU executes a block of at least
          --min-stage bytes (default 64) that the stage before wrote.

--steps <file>  a JSON list of input steps that run right after the program
          starts: write, registers, joystick, type, frames and runUntil, as in
          c64-testing scenarios, with $ addresses only. Use it to press a key
          in an intro or to get through a menu.

Addresses are $ and four hex digits. The result is one JSON object.`;

const MAX_READ = 4096;

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
  const basic = inspect(bytes).basicStart;
  if (options.entry === undefined && basic === null) throw new UsageError("the program has no BASIC start line; give --entry <address>");
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
    const { written, bytes: count, running } = writtenThenExecuted(ranges, pc);
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
              ? `The CPU now runs code at ${formatC64Address(pc)} that the program wrote: it unpacked, decrypted or relocated it.`
              : `The program wrote ${count} bytes and then executed them: it unpacked, decrypted or relocated code.`
            : packing === "unclear"
              ? `The program executed ${count} bytes that it wrote. This can be code that changes itself or a small loader.`
              : "The program executed no code that it wrote while it ran.",
        // A point after the unpacking where the unpacked code runs; the entry point can be at the start of its range.
        ...(running === undefined ? {} : { suggestedUntil: formatC64Address(pc), runningRange: { start: formatC64Address(running.start), end: formatC64Address(running.end) } }),
      },
      failed: false,
    };
  } finally {
    await client.close();
  }
}

/** Frames between two looks at the memory map while stages are followed. */
const STAGE_CHUNK_FRAMES = 25;
const MAX_STAGES = 16;
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
  const sys = inspect(bytes).basicStart?.sys;
  if (options.entry === undefined && sys === undefined) throw new UsageError("the program has no BASIC start line; give --entry <address>");
  if (!(await autostartLoaded(client, program, bytes))) return { stages: [], frames: 0, reached: false, failed: `The program was not in memory at ${formatC64Address(load)} after ${LOAD_LIMIT_FRAMES} frames.` };
  await client.memmap({ action: "clear" });
  if (options.entry !== undefined) await client.registersSet("c64", { pc: options.entry });
  else await client.keyboard(textToPetscii("RUN\n"));
  const target = options.until === undefined ? undefined : await client.breakpoint({ action: "add", address: options.until, space: "c64" });
  const found: Stage[] = [];
  let entry = options.entry ?? parseC64Address(sys!);
  let firstFrame = 0;
  let total = 0;
  let ended = false;
  let reached = false;
  const atTarget = (pc: number) => options.until !== undefined && pc === options.until;
  const track = async (frames: number): Promise<void> => {
    let left = frames;
    while (left > 0 && !ended && !reached && found.length < MAX_STAGES) {
      await client.snapshot({ action: "save", name: STAGE_SNAPSHOT });
      const chunk = Math.min(STAGE_CHUNK_FRAMES, left);
      const first = await client.execution({ action: "advance-frames", count: chunk, space: "c64" });
      const firstPc = first.pc ?? (await client.registersGet("c64")).pc;
      const map = await readCoverage(client);
      const entered = writtenBlocks(map, options.minStage).filter((block) => executedIn(map, block));
      if (entered.length === 0) {
        const advanced = first.advancedFrames ?? 0;
        total += advanced;
        left -= advanced;
        if (atTarget(firstPc)) {
          // The stop at until comes before its instruction runs: a target in written memory starts a stage too.
          const blocks = writtenBlocks(map, options.minStage);
          if (blocks.some((block) => firstPc >= block.start && firstPc <= block.end)) {
            found.push({ entry, firstFrame, frames: total - firstFrame, wrote: blocks, next: firstPc });
            entry = firstPc;
            firstFrame = total;
            await client.memmap({ action: "clear" });
          }
          reached = true;
        } else if (advanced === 0) ended = true;
        continue;
      }
      // Again from the start of the chunk, with breakpoints over the blocks: the stop is the next entry.
      await client.snapshot({ action: "restore", name: STAGE_SNAPSHOT });
      const points = [];
      for (const block of entered) points.push(await client.breakpoint({ action: "add", address: block.start, size: block.end - block.start + 1, space: "c64" }));
      const rerun = await client.execution({ action: "advance-frames", count: chunk, space: "c64" });
      for (const point of points) await client.breakpoint({ action: "remove", id: point.id });
      const next = rerun.pc ?? (await client.registersGet("c64")).pc;
      const used = rerun.advancedFrames ?? 0;
      total += used;
      left -= used;
      if (entered.some((block) => next >= block.start && next <= block.end)) {
        found.push({ entry, firstFrame, frames: total - firstFrame, wrote: writtenBlocks(await readCoverage(client), options.minStage), next });
        entry = next;
        firstFrame = total;
        await client.memmap({ action: "clear" });
      } else if (!atTarget(next)) {
        throw new WireFailure("operation-failed", `The run from the snapshot did not enter the written memory again; it stopped at ${formatC64Address(next)}.`);
      }
      if (atTarget(next)) reached = true;
    }
  };
  for (const step of options.steps) {
    if ("frames" in step) await track(step.frames);
    else await runActionStep(client, step, parseC64Address);
  }
  await track(Math.max(0, options.frames - total));
  if (target !== undefined) await client.breakpoint({ action: "remove", id: target.id });
  await client.snapshot({ action: "discard", name: STAGE_SNAPSHOT }).catch(() => undefined);
  found.push({ entry, firstFrame, frames: total - firstFrame, wrote: writtenBlocks(await readCoverage(client), options.minStage) });
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

/** The I/O areas of the entry state, read without side effects (D43). */
const IO_AREAS = { vic: [0xd000, 0x2f], sid: [0xd400, 0x1d], cia1: [0xdc00, 0x10], cia2: [0xdd00, 0x10] } as const;
/** Frames from a hard reset to the READY prompt, with margin. */
const READY_FRAMES = 200;

/** Reads `size` bytes from `address` in the RAM view, in parts. */
async function readRam(client: ViceSessionClient, address: number, size: number): Promise<Buffer> {
  const parts: Buffer[] = [];
  for (let at = address; at < address + size; at += MAX_READ) {
    parts.push(Buffer.from((await client.memoryRead({ address: at, size: Math.min(MAX_READ, address + size - at), space: "c64", view: "ram" })).data, "hex"));
  }
  return Buffer.concat(parts);
}

/** The state the program finds at its entry: what a rebuild's loader must recreate. */
async function machineState(client: ViceSessionClient): Promise<{ port: Buffer; pages: Buffer; io: Record<keyof typeof IO_AREAS, Buffer>; romVectors: Buffer }> {
  const port = Buffer.from((await client.memoryRead({ address: 0x0000, size: 2, space: "c64", view: "cpu" })).data, "hex");
  const pages = await readRam(client, 0x0000, 0x400);
  const io = {} as Record<keyof typeof IO_AREAS, Buffer>;
  for (const [name, [address, size]] of Object.entries(IO_AREAS)) io[name as keyof typeof IO_AREAS] = Buffer.from((await client.ioRead(address, size)).data, "hex");
  const romVectors = Buffer.from((await client.memoryRead({ address: 0xfffa, size: 6, space: "c64", view: "cpu" })).data, "hex");
  return { port, pages, io, romVectors };
}

const word = (bytes: Buffer, offset: number) => formatC64Address(bytes[offset]! | (bytes[offset + 1]! << 8));

async function capture(
  program: string,
  options: { until: number; out: string; range?: [number, number]; timeoutFrames: number; steps: ActionStep[]; minStage: number },
): Promise<{ output: Record<string, unknown>; failed: boolean }> {
  const client = await ViceSessionClient.open({ videoStandard: "pal" });
  try {
    const followed = await follow(client, program, { frames: options.timeoutFrames, steps: options.steps, minStage: options.minStage, until: options.until });
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
    const vectors = {
      irq: word(state.pages, 0x314),
      brk: word(state.pages, 0x316),
      nmi: word(state.pages, 0x318),
      ram: { nmi: word(memory, 0xfffa), reset: word(memory, 0xfffc), irq: word(memory, 0xfffe) },
      rom: { nmi: word(state.romVectors, 0), reset: word(state.romVectors, 2), irq: word(state.romVectors, 4) },
    };
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
    write(
      "entry_state.json",
      Buffer.from(
        `${JSON.stringify(
          {
            registers: { pc: formatC64Address(registers.pc), a: registers.a, x: registers.x, y: registers.y, sp: registers.sp, flags: registers.flags },
            cpuPort: { $00: state.port[0], $01: state.port[1] },
            pages: Object.fromEntries([0, 1, 2, 3].map((page) => [formatC64Address(page << 8), state.pages.subarray(page << 8, (page + 1) << 8).toString("hex")])),
            io: Object.fromEntries(Object.entries(IO_AREAS).map(([name, [address]]) => [name, { from: formatC64Address(address), bytes: state.io[name as keyof typeof IO_AREAS].toString("hex") }])),
            vectors,
            differsFromReset: differs,
          },
          null,
          2,
        )}\n`,
      ),
    );
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
      help: { type: "boolean" },
    },
  });
  if (values.help) throw new UsageError("");
  const [command, program, ...rest] = positionals;
  if (program === undefined) throw new UsageError("give a command and a program");
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
  if (command !== "capture") throw new UsageError(`unknown command ${command}`);
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
  return capture(program, { until: address(values.until, "--until"), out: values.out, ...(range === undefined ? {} : { range }), timeoutFrames, steps, minStage });
}

await runScript(
  async () => {
    const { output, failed } = await run(process.argv.slice(2));
    if (failed) process.exitCode = 1;
    return output;
  },
  { usage: USAGE },
);
