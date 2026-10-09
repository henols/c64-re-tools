// The c64-unpacker script. "inspect" gives local evidence of packing; it never
// names a packer. "trace" runs the program and reports the memory that it
// wrote and then executed: the run-time evidence that also finds a simple
// cruncher whose bytes look like code. "capture" runs the program in an
// emulator until it reaches a given address (the unpacked entry point) and
// writes the memory into the project. No native unpack tool is used.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";

import { formatC64Address, parseC64Address, textToPetscii } from "#src/c64.ts";
import { WireFailure } from "#src/host-client/tools.ts";
import { readProjectFile } from "#src/host-client/transfer.ts";
import { ViceSessionClient } from "#src/host-client/vice-session.ts";
import { resolveProjectPath } from "#src/project.ts";
import { inspect, PackingError, readMemoryMap, underRom, writtenThenExecuted } from "./evidence.ts";

const USAGE = `unpack.ts inspect <program.prg>
unpack.ts trace <program.prg> [--frames <n>] [--entry <address>]
unpack.ts capture <program.prg> --until <address> --out <file> [--range <start> <end>] [--timeout-frames <n>]

inspect   packing evidence: the BASIC start and the entropy of the bytes
trace     run the program for <n> frames (default 3000) and report the memory
          that it wrote and then executed; --entry starts it there instead of RUN
capture   run the program until the CPU gets to <address>, then write memory:
          with --range, a PRG of that range; without it, all 64 KiB of RAM

Addresses are $ and four hex digits. The result is one JSON object.`;

const MAX_READ = 4096;

class UsageError extends Error {}

function address(text: string, option: string): number {
  try {
    return parseC64Address(text);
  } catch {
    throw new UsageError(`${option} must be $ followed by four hex digits, not ${text}`);
  }
}

/** Written-then-executed bytes from this many on are unpacking, decrypting or relocating, not self-changing code. */
const UNPACKED_BYTES = 256;
const LOAD_POLL_FRAMES = 25;
const LOAD_LIMIT_FRAMES = 1500;
const MAX_ADVANCE = 10_000;
/** The most ranges one memory map read gives. */
const MAX_RANGES = 1000;

async function trace(program: string, options: { frames: number; entry?: number }): Promise<{ output: Record<string, unknown>; failed: boolean }> {
  const { bytes } = readProjectFile(program);
  if (bytes.length < 3) throw new UsageError("the file is too short for a PRG");
  const load = bytes[0]! | (bytes[1]! << 8);
  const basic = inspect(bytes).basicStart;
  if (options.entry === undefined && basic === null) throw new UsageError("the program has no BASIC start line; give --entry <address>");
  const client = await ViceSessionClient.open({ videoStandard: "pal" });
  try {
    // Loaded but not started, so the memory map can start empty: the KERNAL start-up writes all of RAM.
    await client.autostart({ path: program, index: 0, run: false });
    const head = bytes.subarray(2, Math.min(bytes.length, 2 + 64)).toString("hex");
    let loaded = false;
    for (let frames = 0; frames < LOAD_LIMIT_FRAMES && !loaded; frames += LOAD_POLL_FRAMES) {
      await client.execution({ action: "advance-frames", count: LOAD_POLL_FRAMES, space: "c64" });
      loaded = (await client.memoryRead({ address: load, size: head.length / 2, space: "c64", view: "ram" })).data === head;
    }
    if (!loaded) return { output: { traced: false, reason: `The program was not in memory at ${formatC64Address(load)} after ${LOAD_LIMIT_FRAMES} frames.` }, failed: true };
    await client.memmap({ action: "clear" });
    if (options.entry !== undefined) await client.registersSet("c64", { pc: options.entry });
    else await client.keyboard(textToPetscii("RUN\n"));
    let ran = 0;
    while (ran < options.frames) {
      const step = await client.execution({ action: "advance-frames", count: Math.min(MAX_ADVANCE, options.frames - ran), space: "c64" });
      const advanced = step.advancedFrames ?? 0;
      ran += advanced;
      if (advanced === 0) break;
    }
    const { pc } = await client.registersGet("c64");
    const ranges = await readMemoryMap(async (start, end) => {
      const map = await client.memmap({ action: "read", start, end, maxRanges: MAX_RANGES });
      if (!("ranges" in map)) throw new WireFailure("operation-failed", "The emulator did not give the memory map.");
      return map.ranges;
    }, MAX_RANGES);
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

async function capture(program: string, options: { until: number; out: string; range?: [number, number]; timeoutFrames: number }): Promise<{ output: Record<string, unknown>; failed: boolean }> {
  const client = await ViceSessionClient.open({ videoStandard: "pal" });
  try {
    await client.autostart({ path: program, index: 0, run: true });
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
    return trace(program, { frames, ...(values.entry === undefined ? {} : { entry: address(values.entry, "--entry") }) });
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
  return capture(program, { until: address(values.until, "--until"), out: values.out, ...(range === undefined ? {} : { range }), timeoutFrames });
}

try {
  const { output, failed } = await run(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(output)}\n`);
  if (failed) process.exitCode = 1;
} catch (error) {
  if (error instanceof WireFailure) {
    process.stdout.write(`${JSON.stringify({ error: { code: error.code, message: error.message } })}\n`);
    process.exitCode = 1;
  } else if (error instanceof UsageError || (error as NodeJS.ErrnoException).code?.startsWith("ERR_PARSE_ARGS")) {
    const message = (error as Error).message;
    process.stdout.write(`${JSON.stringify({ error: { code: "invalid-input", message: message === "" ? USAGE : `${message}\n\n${USAGE}` } })}\n`);
    process.exitCode = 2;
  } else {
    throw error;
  }
}
