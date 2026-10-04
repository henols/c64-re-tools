// The c64-unpacker script. "inspect" gives local evidence of packing; it never
// names a packer. "capture" runs the program in an emulator until it reaches
// a given address (the unpacked entry point) and writes the memory into the
// project. No native unpack tool is used (19 §12).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";

import { formatC64Address, parseC64Address } from "../../../src/c64.ts";
import { WireFailure } from "../../../src/host-client/tools.ts";
import { ViceSessionClient } from "../../../src/host-client/vice-session.ts";
import { resolveProjectPath } from "../../../src/project.ts";
import { inspect, PackingError } from "./evidence.ts";

const USAGE = `unpack.ts inspect <program.prg>
unpack.ts capture <program.prg> --until <address> --out <file> [--range <start> <end>] [--timeout-frames <n>]

inspect   packing evidence: the BASIC start and the entropy of the bytes
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
    options: { until: { type: "string" }, out: { type: "string" }, range: { type: "string" }, "timeout-frames": { type: "string" }, help: { type: "boolean" } },
  });
  if (values.help) throw new UsageError("");
  const [command, program, ...rest] = positionals;
  if (program === undefined) throw new UsageError("give a command and a program");
  if (command === "inspect") {
    if (rest.length > 0) throw new UsageError("inspect takes one program");
    let bytes: Buffer;
    try {
      bytes = readFileSync(resolveProjectPath(program));
    } catch {
      throw new WireFailure("not-found", `There is no file at ${program} in the project directory.`);
    }
    try {
      return { output: inspect(bytes), failed: false };
    } catch (error) {
      if (error instanceof PackingError) throw new UsageError(error.message);
      throw error;
    }
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
