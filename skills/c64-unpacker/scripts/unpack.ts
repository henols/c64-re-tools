// The c64-unpacker script. "inspect" gives local evidence of packing; it never
// names a packer. "trace" runs the program and reports the memory that it
// wrote and then executed: the run-time evidence that also finds a simple
// cruncher whose bytes look like code. "capture" runs the program in an
// emulator until it reaches a given address (the unpacked entry point) and
// writes the memory into the project. No native unpack tool is used.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";

import { EXECUTE, formatC64Address, parseC64Address, READ, textToPetscii, WRITE } from "#src/c64.ts";
import { autostartLoaded, LOAD_LIMIT_FRAMES, RUN_LIMIT_FRAMES, runProgram } from "#src/host-client/autostart.ts";
import { checkActionSteps, runActionStep, type ActionStep } from "#src/host-client/steps.ts";
import { WireFailure } from "#src/host-client/tools.ts";
import { readProjectFile } from "#src/host-client/transfer.ts";
import { ViceSessionClient } from "#src/host-client/vice-session.ts";
import { resolveProjectPath } from "#src/project.ts";
import { runScript, UsageError } from "#src/script.ts";
import { inspect, PackingError, readMemoryMap, underRom, writtenThenExecuted } from "./evidence.ts";

const USAGE = `unpack.ts inspect <program.prg>
unpack.ts trace <program.prg> [--frames <n>] [--entry <address>] [--steps <file>]
unpack.ts capture <program.prg> --until <address> --out <file> [--range <start> <end>] [--timeout-frames <n>] [--steps <file>]

inspect   packing evidence: the BASIC start and the entropy of the bytes
trace     run the program for <n> frames (default 3000) and report the memory
          that it wrote and then executed; --entry starts it there instead of RUN
capture   run the program until the CPU gets to <address>, then write memory:
          with --range, a PRG of that range; without it, all 64 KiB of RAM

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

async function capture(program: string, options: { until: number; out: string; range?: [number, number]; timeoutFrames: number; steps: ActionStep[] }): Promise<{ output: Record<string, unknown>; failed: boolean }> {
  const client = await ViceSessionClient.open({ videoStandard: "pal" });
  try {
    if (options.steps.length === 0) {
      await client.autostart({ path: program, index: 0, run: true });
    } else {
      // Steps type keys: the program must run first, or the keys reach the READY prompt.
      const failed = await runProgram(client, program, readProjectFile(program).bytes);
      if (failed !== undefined) return { output: { captured: false, reason: failed === "not-loaded" ? `The program was not in memory after ${LOAD_LIMIT_FRAMES} frames.` : `The program did not start within ${RUN_LIMIT_FRAMES} frames of RUN. It needs a BASIC start line.` }, failed: true };
      const stepFailed = await runSteps(client, options.steps);
      if (stepFailed !== undefined) return { output: { captured: false, reason: stepFailed }, failed: true };
    }
    const reached = await client.runUntil({ target: { kind: "address", address: options.until, space: "c64" }, timeoutFrames: options.timeoutFrames });
    if (!reached.reached) {
      return {
        output: { captured: false, reason: `The program did not get to ${formatC64Address(options.until)} in ${options.timeoutFrames} frames. It stopped by ${reached.stopReason} at ${formatC64Address(reached.pc)}.` },
        failed: true,
      };
    }
    const [start, end] = options.range ?? [0x0000, 0xffff];
    const memory = Buffer.alloc(end - start + 1);
    for (let at = start; at <= end; at += MAX_READ) {
      const size = Math.min(MAX_READ, end - at + 1);
      // The RAM view: unpacked code is often under the ROMs or the I/O area.
      const read = await client.memoryRead({ address: at, size, space: "c64", view: "ram" });
      Buffer.from(read.data, "hex").copy(memory, at - start);
    }
    const bytes = options.range === undefined ? memory : Buffer.concat([Buffer.from([start & 0xff, start >> 8]), memory]);
    const path = resolveProjectPath(options.out);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
    const registers = await client.registersGet("c64");
    return {
      output: {
        captured: true,
        pc: formatC64Address(registers.pc),
        output: options.out,
        ...(options.range === undefined ? { flat64k: true } : { loadRange: { start: formatC64Address(start), end: formatC64Address(end) } }),
        registers: { a: registers.a, x: registers.x, y: registers.y, sp: registers.sp },
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
  return capture(program, { until: address(values.until, "--until"), out: values.out, ...(range === undefined ? {} : { range }), timeoutFrames, steps });
}

await runScript(
  async () => {
    const { output, failed } = await run(process.argv.slice(2));
    if (failed) process.exitCode = 1;
    return output;
  },
  { usage: USAGE },
);
