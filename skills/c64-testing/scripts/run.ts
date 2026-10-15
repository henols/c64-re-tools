// The c64-testing run script (D45): runs steps in its own emulator, from a
// program or a snapshot file, and writes what the steps ask for into a
// directory: screens, coverage maps, snapshot files, and results.json with
// the observations. One side, no comparison. Exit status: 0 when every step
// ran, 1 when a step did not, 2 for a bad call.

import { parseArgs } from "node:util";

import { formatC64Address, parseC64Address } from "#src/c64.ts";
import { runProgram } from "#src/host-client/autostart.ts";
import { readCoverage } from "#src/host-client/coverage.ts";
import { ACTION_STEP_KEYS, ACTION_STEP_KINDS, checkActionStep, isInteger, isObject, runActionStep, type ActionStep } from "#src/host-client/steps.ts";
import { MAX_MEMORY_READ, WireFailure } from "#src/host-client/tools.ts";
import { readProjectFile, writeProjectFile } from "#src/host-client/transfer.ts";
import { ViceSessionClient } from "#src/host-client/vice-session.ts";
import { resolveProjectPath } from "#src/project.ts";
import { runScript, UsageError } from "#src/script.ts";
import { loadSymbols } from "./scenario.ts";

const USAGE = `run.ts <run.json> --out <dir>

<run.json> is a run file relative to the project directory: where to start,
optional symbols, and the steps. See references/scenario-format.md, section
Runs. The files that the steps write, and results.json, go into <dir>. The
result is one JSON object.`;

type RunStep =
  | ActionStep
  | { snapshot: string }
  | { save: string }
  | { screen: string }
  | { coverage: string }
  | { observe: string; memory?: Array<string | { at: string; size?: number }>; registers?: boolean; vicii?: boolean; sprites?: number[] };

interface Run {
  name: string;
  videoStandard?: "pal" | "ntsc";
  start: { program: string; load?: boolean } | { snapshot: string };
  symbols?: string;
  steps: RunStep[];
}

const OWN_KINDS = ["snapshot", "save", "screen", "coverage", "observe"] as const;
const OBSERVE_KEYS = ["observe", "memory", "registers", "vicii", "sprites"];
/** A name of a file that a step writes: letters, digits, dots, underscores or hyphens. */
const NAME = /^[A-Za-z0-9._-]{1,64}$/;

function readRun(path: string): Run {
  let value: unknown;
  try {
    value = JSON.parse(readProjectFile(path).bytes.toString("utf8"));
  } catch (error) {
    if (error instanceof WireFailure) throw error;
    throw new UsageError(`the run ${path} is not JSON: ${(error as Error).message}`);
  }
  const fail = (message: string): never => {
    throw new UsageError(`run ${path}: ${message}`);
  };
  if (!isObject(value)) return fail("is not a JSON object");
  if (typeof value.name !== "string" || value.name === "") fail("needs a name");
  if (value.videoStandard !== undefined && value.videoStandard !== "pal" && value.videoStandard !== "ntsc") fail("videoStandard must be pal or ntsc");
  const start = value.start;
  if (!isObject(start) || (typeof start.program !== "string") === (typeof start.snapshot !== "string")) fail("start needs program or snapshot");
  if (isObject(start) && start.load !== undefined && typeof start.load !== "boolean") fail("start.load must be true or false");
  if (value.symbols !== undefined && typeof value.symbols !== "string") fail("symbols must be knowledge, none or a JSON file");
  if (!Array.isArray(value.steps) || value.steps.length === 0) fail("needs steps");
  const labels = new Set<string>();
  (value.steps as unknown[]).forEach((step, index) => {
    const at = `step ${index + 1}`;
    if (!isObject(step)) return fail(`${at} must be an object`);
    const kinds = "observe" in step ? ["observe"] : Object.keys(step).filter((key) => (ACTION_STEP_KINDS as readonly string[]).includes(key) || (OWN_KINDS as readonly string[]).includes(key));
    if (kinds.length !== 1) return fail(`${at} must have exactly one of ${[...ACTION_STEP_KINDS, ...OWN_KINDS].join(", ")}`);
    const kind = kinds[0]!;
    const allowed = kind === "observe" ? OBSERVE_KEYS : (ACTION_STEP_KEYS[kind] ?? [kind]);
    for (const key of Object.keys(step)) if (!allowed.includes(key)) fail(`${at} has the key ${key}, which a ${kind} step does not have`);
    if ((ACTION_STEP_KINDS as readonly string[]).includes(kind)) return checkActionStep(kind, step, at, fail);
    const name = step[kind];
    if (kind === "snapshot") {
      if (typeof name !== "string" || name === "") fail(`${at}: snapshot needs a project file`);
      return;
    }
    if (typeof name !== "string" || !NAME.test(name)) fail(`${at}: ${kind} needs a name of 1 to 64 letters, digits, dots, underscores or hyphens`);
    if (kind !== "observe") return;
    if (labels.has(name as string)) fail(`${at} needs a new observation name`);
    labels.add(name as string);
    if (step.memory !== undefined && (!Array.isArray(step.memory) || step.memory.some((item) => typeof item !== "string" && !(isObject(item) && typeof item.at === "string" && (item.size === undefined || isInteger(item.size, 1, MAX_MEMORY_READ)))))) {
      fail(`${at}: memory is a list of names, $ addresses, or objects with at and size`);
    }
    if (step.registers !== undefined && typeof step.registers !== "boolean") fail(`${at}: registers must be true or false`);
    if (step.vicii !== undefined && typeof step.vicii !== "boolean") fail(`${at}: vicii must be true or false`);
    if (step.sprites !== undefined && (!Array.isArray(step.sprites) || !step.sprites.every((sprite) => isInteger(sprite, 0, 7)))) fail(`${at}: sprites is a list of numbers from 0 to 7`);
  });
  return value as unknown as Run;
}

async function runFile(path: string, out: string): Promise<{ output: Record<string, unknown>; failed: boolean }> {
  const run = readRun(path);
  const symbols = loadSymbols({ program: "", symbols: run.symbols ?? "none" });
  const at = (location: string): number => {
    if (location.startsWith("$")) return parseC64Address(location);
    const address = symbols.get(location);
    if (address === undefined) throw new UsageError(`the symbols have no ${location}`);
    return address;
  };
  const files: string[] = [];
  const write = (name: string, bytes: Uint8Array) => {
    writeProjectFile(`${out}/${name}`, bytes, { what: "--out" });
    files.push(name);
  };
  const observations: Record<string, unknown> = {};
  const client = await ViceSessionClient.open({ videoStandard: run.videoStandard ?? "pal" });
  let done = 0;
  let reason: string | undefined;
  try {
    await client.reset({ mode: "hard", run: false });
    if ("snapshot" in run.start) {
      await client.snapshotRestore(readProjectFile(run.start.snapshot).bytes);
    } else if (run.start.load === true) {
      await client.execution({ action: "advance-frames", count: 150, space: "c64" });
      await client.programLoad({ path: run.start.program });
    } else {
      const failed = await runProgram(client, run.start.program, readProjectFile(run.start.program).bytes);
      if (failed !== undefined) reason = failed === "not-loaded" ? "The program was not in memory after autostart." : "The program did not start after RUN; it needs a BASIC start line.";
    }
    await client.memmap({ action: "clear" });
    for (const step of reason === undefined ? run.steps : []) {
      if ("snapshot" in step) {
        await client.snapshotRestore(readProjectFile(step.snapshot).bytes);
      } else if ("save" in step) {
        await client.snapshot({ action: "save", name: "run-save" });
        write(`${step.save}.vsf`, await client.snapshotExport("run-save"));
        await client.snapshot({ action: "discard", name: "run-save" });
      } else if ("screen" in step) {
        write(`${step.screen}.png`, Buffer.from((await client.screenCapture()).png, "base64"));
      } else if ("coverage" in step) {
        write(`${step.coverage}.bin`, await readCoverage(client));
        await client.memmap({ action: "clear" });
      } else if ("observe" in step) {
        const seen: Record<string, unknown> = {};
        if (step.memory !== undefined) {
          const memory: Record<string, string> = {};
          for (const item of step.memory) {
            const spec = typeof item === "string" ? { at: item } : item;
            memory[spec.at] = (await client.memoryRead({ address: at(spec.at), size: spec.size ?? 1, space: "c64", view: "cpu" })).data;
          }
          seen.memory = memory;
        }
        if (step.registers === true) {
          const registers = await client.registersGet("c64");
          seen.registers = { ...registers, pc: formatC64Address(registers.pc) };
        }
        if (step.vicii === true) seen.vicii = await client.vicii();
        if (step.sprites !== undefined) seen.sprites = (await client.sprites(step.sprites)).sprites;
        observations[step.observe] = seen;
      } else {
        const notReached = await runActionStep(client, step, at);
        if (notReached !== undefined && "runUntil" in step) {
          reason = `Step ${done + 1} did not reach its target in ${step.timeoutFrames} frames. It stopped by ${notReached.stopReason} at ${formatC64Address(notReached.pc)}.`;
          break;
        }
      }
      done++;
    }
    const pc = (await client.registersGet("c64")).pc;
    const results = { name: run.name, completed: reason === undefined, steps: run.steps.length, done, ...(reason === undefined ? {} : { reason }), pc: formatC64Address(pc), files: [...files], observations };
    write("results.json", Buffer.from(`${JSON.stringify(results, null, 2)}\n`));
    return { output: { ...results, files, observations: Object.keys(observations), out }, failed: reason !== undefined };
  } finally {
    await client.close();
  }
}

await runScript(
  async (argv) => {
    const { values, positionals } = parseArgs({ args: argv, strict: true, allowPositionals: true, options: { out: { type: "string" }, help: { type: "boolean" } } });
    if (values.help) throw new UsageError("");
    if (positionals.length !== 1) throw new UsageError("give one run file");
    if (values.out === undefined) throw new UsageError("run needs --out <dir>");
    try {
      resolveProjectPath(values.out);
    } catch {
      throw new UsageError(`--out must be a path relative to the project directory that stays inside it, not ${values.out}`);
    }
    const { output, failed } = await runFile(positionals[0]!, values.out);
    if (failed) process.exitCode = 1;
    return output;
  },
  { usage: USAGE },
);
