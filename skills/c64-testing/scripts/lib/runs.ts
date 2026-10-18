// The runs of c64-testing: steps in their own emulator, from a program or a
// snapshot file, and what the steps ask for written into a folder: screens,
// coverage maps, snapshot files, and results.json with the observations. One
// side, no comparison.

import { formatC64Address, formatSprite, formatVicii, parseC64Address } from "#src/c64.ts";
import { runProgram } from "#src/host-client/autostart.ts";
import { isRefusal, Refusal } from "#src/errors.ts";
import { readCoverage } from "#src/host-client/coverage.ts";
import { ACTION_STEP_KINDS, checkActionStep, checkStepNames, isInteger, isObject, refuseOldStep, renamedField, runActionStep, VICE_STEP_KINDS, type ActionStep, type ActionStepKind } from "#src/host-client/steps.ts";
import { readPrg } from "#src/host-client/image.ts";
import { MAX_MEMORY_READ, MAX_TRACE_FRAMES, MAX_TRACE_HITS, MAX_TRACE_POINTS, TRACE_KINDS, WireFailure, type TraceHit, type TraceKind } from "#src/host-client/tools.ts";
import { readProjectFile, writeReported, type Written } from "#src/host-client/transfer.ts";
import { readMemoryInParts, ViceSessionClient } from "#src/host-client/vice-session.ts";
import { checkSnapshotFile } from "#src/media.ts";
import { UsageError } from "#src/script.ts";
import { namesOf } from "./scenario.ts";

type RunStep =
  | ActionStep
  | { snapshot: string }
  | { save: string }
  | { screen: string }
  | { coverage: string }
  | { trace: string; points: Array<{ kind: TraceKind; start: string; end?: string }>; frames: number; maxHits?: number }
  | { observe: string; memory?: "all" | Array<string | { address: string; size?: number; view?: "cpu" | "ram" }>; registers?: boolean; vicii?: boolean; sprites?: number[] };

interface Run {
  name: string;
  videoStandard?: "pal" | "ntsc";
  start: { program: string; load?: boolean } | { snapshot: string };
  symbols?: string;
  steps: RunStep[];
}

const OWN_KINDS = ["snapshot", "save", "screen", "coverage", "observe", "trace"] as const;
const TRACE_KEYS = ["trace", "points", "frames", "maxHits"];
const OBSERVE_KEYS = ["observe", "memory", "registers", "vicii", "sprites"];
/** A name of a file that a step writes: letters, digits, dots, underscores or hyphens. */
const NAME = /^[A-Za-z0-9._-]{1,64}$/;
/** The file of the observations, which every run writes. */
const RESULTS = "results.json";

/** The file name of an observed memory item that goes into its own file: more than one read gives. */
const memoryFile = (observe: string, address: string) => `${observe}-${address.replace(/^\$/, "")}.bin`;

/**
 * The files that each step of a run writes into --out, by step. Two steps
 * that write one name (also in another case: some file systems do not tell
 * them apart) are refused: the second would overwrite the first.
 */
function checkFileNames(steps: RunStep[], fail: (message: string) => never): void {
  const writers = new Map<string, string>([[RESULTS, `the run itself (${RESULTS})`]]);
  steps.forEach((step, index) => {
    const named: [string, string[]] =
      "save" in step
        ? ["save", [`${step.save}.vsf`]]
        : "screen" in step
          ? ["screen", [`${step.screen}.png`]]
          : "coverage" in step
            ? ["coverage", [`${step.coverage}.bin`]]
            : "trace" in step
              ? ["trace", [`${step.trace}.json`]]
              : "observe" in step
                ? ["observe", step.memory === "all" ? [`${step.observe}.bin`] : (step.memory ?? []).flatMap((item) => (typeof item !== "string" && (item.size ?? 1) > MAX_MEMORY_READ ? [memoryFile(step.observe, item.address)] : []))]
                : ["", []];
    const [kind, files] = named;
    for (const file of files) {
      const other = writers.get(file.toLowerCase());
      if (other !== undefined) fail(`step ${index + 1} (${kind}) writes ${file}, and ${other} writes that file too. Give one of them another name`);
      writers.set(file.toLowerCase(), `step ${index + 1} (${kind})`);
    }
  });
}

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
    const kinds = "observe" in step ? ["observe"] : "trace" in step ? ["trace"] : Object.keys(step).filter((key) => (ACTION_STEP_KINDS as readonly string[]).includes(key) || (OWN_KINDS as readonly string[]).includes(key));
    if (kinds.length > 1) return fail(`${at} has ${kinds.length} step kinds: ${kinds.join(", ")}. Give each one its own step`);
    if (kinds.length !== 1) return fail(`${at} must have exactly one of ${[...VICE_STEP_KINDS, ...OWN_KINDS].join(", ")}`);
    const kind = kinds[0]!;
    refuseOldStep(kind, step, at, fail);
    const allowed = kind === "observe" ? OBSERVE_KEYS : kind === "trace" ? TRACE_KEYS : [kind];
    for (const key of Object.keys(step)) if (!allowed.includes(key)) fail(`${at} has the key ${key}, which a ${kind} step does not have`);
    if ((ACTION_STEP_KINDS as readonly string[]).includes(kind)) {
      // The step with its defaults filled in, as the shared schema of the action steps gives it.
      (value.steps as unknown[])[index] = checkActionStep(kind as ActionStepKind, step, at, fail);
      return;
    }
    const name = step[kind];
    if (kind === "snapshot") {
      if (typeof name !== "string" || name === "") fail(`${at}: snapshot needs a project file`);
      return;
    }
    if (typeof name !== "string" || !NAME.test(name)) fail(`${at}: ${kind} needs a name of 1 to 64 letters, digits, dots, underscores or hyphens`);
    if (kind === "trace") {
      if (labels.has(name as string)) fail(`${at} needs a new name`);
      labels.add(name as string);
      const points = step.points;
      if (!Array.isArray(points) || points.length === 0 || points.length > MAX_TRACE_POINTS) return fail(`${at}: points is a list of 1 to ${MAX_TRACE_POINTS} objects with kind and start`);
      for (const point of points as unknown[]) {
        if (!isObject(point)) return fail(`${at}: a point is an object with kind, start and end`);
        for (const key of Object.keys(point)) if (!["kind", "start", "end"].includes(key)) fail(`${at}: a point has the field ${key}. ${renamedField(key, ["kind", "start", "end"]) ?? "A point has kind, start and end, and nothing else"}`);
        if (!(TRACE_KINDS as readonly unknown[]).includes(point.kind)) fail(`${at}: a point kind is exec, read or write`);
        if (typeof point.start !== "string" || (point.end !== undefined && typeof point.end !== "string")) fail(`${at}: a point needs start, and end when it is a range, as names or $ addresses`);
      }
      if (!isInteger(step.frames, 1, MAX_TRACE_FRAMES)) fail(`${at}: frames must be a number from 1 to ${MAX_TRACE_FRAMES}`);
      if (step.maxHits !== undefined && !isInteger(step.maxHits, 1, MAX_TRACE_HITS)) fail(`${at}: maxHits must be a number from 1 to ${MAX_TRACE_HITS}`);
      return;
    }
    if (kind !== "observe") return;
    if (labels.has(name as string)) fail(`${at} needs a new observation name`);
    labels.add(name as string);
    const itemFields = ["address", "size", "view"];
    if (Array.isArray(step.memory)) {
      for (const item of step.memory as unknown[]) {
        if (!isObject(item)) continue;
        for (const key of Object.keys(item)) {
          const renamed = renamedField(key, itemFields);
          if (renamed !== undefined && !itemFields.includes(key)) fail(`${at}: a memory object has the field ${key}. ${renamed}`);
        }
      }
    }
    const memoryItem = (item: unknown) =>
      typeof item === "string" ||
      (isObject(item) &&
        typeof item.address === "string" &&
        Object.keys(item).every((key) => ["address", "size", "view"].includes(key)) &&
        (item.size === undefined || isInteger(item.size, 1, 0x10000)) &&
        (item.view === undefined || item.view === "cpu" || item.view === "ram"));
    if (step.memory !== undefined && step.memory !== "all" && (!Array.isArray(step.memory) || !step.memory.every(memoryItem))) {
      fail(`${at}: memory is "all", or a list of names, $ addresses, or objects with address, size (1 to 65536) and view (cpu or ram)`);
    }
    if (step.registers !== undefined && typeof step.registers !== "boolean") fail(`${at}: registers must be true or false in a run. true gives all registers. A list of register names is for a scenario`);
    if (step.vicii !== undefined && typeof step.vicii !== "boolean") fail(`${at}: vicii must be true or false`);
    if (step.sprites !== undefined && (!Array.isArray(step.sprites) || !step.sprites.every((sprite) => isInteger(sprite, 0, 7)))) fail(`${at}: sprites is a list of numbers from 0 to 7`);
  });
  checkFileNames(value.steps as RunStep[], fail);
  return value as unknown as Run;
}

/** The remedy for a start program that is no PRG. */
const PROGRAM_REMEDY = "A run starts a PRG. Get the PRG out of the disk, tape or cartridge with disk.ts read (or disk.ts crt) of the c64-disk skill";

/** Checks each file that the run reads before the emulator starts: the start program, and the start snapshot and each snapshot step, which must be VICE snapshot files. A refusal names the run file and the step. */
function checkRunFiles(path: string, run: Run): void {
  const named = (where: string, check: () => unknown) => {
    try {
      check();
    } catch (error) {
      if (isRefusal(error)) throw new Refusal(error.code, `run ${path}: ${where}: ${error.message}`);
      throw error;
    }
  };
  if ("program" in run.start) {
    const { program } = run.start;
    named("start.program", () => readPrg(program, PROGRAM_REMEDY));
  } else {
    const { snapshot } = run.start;
    named("start.snapshot", () => checkSnapshotFile(snapshot, readProjectFile(snapshot).bytes));
  }
  run.steps.forEach((step, index) => {
    if ("snapshot" in step) named(`step ${index + 1}: snapshot`, () => checkSnapshotFile(step.snapshot, readProjectFile(step.snapshot).bytes));
  });
}

/** A trace hit with $ addresses, as a person reads it. */
function showHit(hit: TraceHit) {
  return { ...hit, pc: formatC64Address(hit.pc), ...(hit.address === undefined ? {} : { address: formatC64Address(hit.address) }) };
}

/** Runs the run file and writes its files into `out`. failed: a step did not run. */
export async function runFile(path: string, out: string): Promise<{ output: Record<string, unknown>; failed: boolean }> {
  const run = readRun(path);
  checkRunFiles(path, run);
  const symbols = namesOf(run.symbols ?? "none");
  const at = (location: string): number => {
    if (location.startsWith("$")) return parseC64Address(location);
    const address = symbols.get(location);
    if (address !== undefined) return address;
    if (run.symbols === undefined || run.symbols === "none") {
      throw new UsageError(`${location} is a name, and the run file has no symbols. A run file has no symbols unless it gives "symbols": "knowledge" for the names of the knowledge, or "symbols": "<file>" for a JSON file of names. Give one of them, or a $ address`);
    }
    throw new UsageError(`the symbols ${run.symbols} have no ${location}`);
  };
  // Every name of the steps resolves before the emulator starts. A refusal names the step.
  run.steps.forEach((step, index) => {
    if ("trace" in step || "observe" in step) {
      const names = "trace" in step ? step.points.flatMap((point) => [point.start, ...(point.end === undefined ? [] : [point.end])]) : step.memory === undefined || step.memory === "all" ? [] : step.memory.map((item) => (typeof item === "string" ? item : item.address));
      for (const name of names) {
        try {
          at(name);
        } catch (error) {
          if (isRefusal(error)) throw new Refusal("invalid-input", `run ${path}: step ${index + 1}: ${error.message}`);
          throw error;
        }
      }
    } else if ((ACTION_STEP_KINDS as readonly string[]).some((kind) => kind in step)) {
      checkStepNames([step as ActionStep], at, `run ${path}`, index + 1);
    }
  });
  const files: string[] = [];
  const written: Written[] = [];
  const write = (name: string, bytes: Uint8Array) => {
    written.push(writeReported(`${out}/${name}`, bytes, { what: "--out" }));
    files.push(name);
  };
  const observations: Record<string, unknown> = {};
  const traces: Record<string, unknown> = {};
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
        await client.snapshot({ action: "remove", name: "run-save" });
      } else if ("screen" in step) {
        write(`${step.screen}.png`, Buffer.from((await client.screenCapture()).png, "base64"));
      } else if ("coverage" in step) {
        write(`${step.coverage}.bin`, await readCoverage(client));
        await client.memmap({ action: "clear" });
      } else if ("trace" in step) {
        // A trace: every hit of the points while the program runs on, to <name>.json.
        const points = step.points.map((point) => ({ kind: point.kind, start: at(point.start), end: at(point.end ?? point.start) }));
        if (points.some((point) => point.end < point.start)) throw new UsageError(`the trace ${step.trace} has a point whose end is before its start`);
        const traced = await client.trace({ points, frames: step.frames, maxHits: step.maxHits ?? MAX_TRACE_HITS });
        write(`${step.trace}.json`, Buffer.from(`${JSON.stringify({ points: step.points, frames: traced.frames, end: traced.end, hits: traced.hits.map(showHit) }, null, 1)}\n`));
        traces[step.trace] = { file: `${step.trace}.json`, hits: traced.hits.length, frames: traced.frames, end: traced.end };
        if (traced.end !== "frames" && traced.end !== "hits") {
          reason = `The trace ${step.trace} ended at a ${traced.end} at ${formatC64Address(traced.pc)}.`;
          break;
        }
      } else if ("observe" in step) {
        const seen: Record<string, unknown> = {};
        if (step.memory === "all") {
          // All 64 KiB of RAM, also under the ROMs and the I/O area, as one file.
          write(`${step.observe}.bin`, await readMemoryInParts(client, 0x0000, 0x10000, "ram"));
          seen.memory = { file: `${step.observe}.bin` };
        } else if (step.memory !== undefined) {
          const memory: Record<string, string | { file: string }> = {};
          for (const item of step.memory) {
            const spec = typeof item === "string" ? { address: item } : item;
            const size = spec.size ?? 1;
            const bytes = await readMemoryInParts(client, at(spec.address), size, spec.view ?? "cpu");
            // More than one read gives goes to a file: results.json stays small.
            if (size <= MAX_MEMORY_READ) memory[spec.address] = bytes.toString("hex");
            else {
              const file = memoryFile(step.observe, spec.address);
              write(file, bytes);
              memory[spec.address] = { file };
            }
          }
          seen.memory = memory;
        }
        if (step.registers === true) {
          const registers = await client.registersGet("c64");
          seen.registers = { ...registers, pc: formatC64Address(registers.pc) };
        }
        if (step.vicii === true) seen.vicii = formatVicii(await client.vicii());
        if (step.sprites !== undefined) seen.sprites = (await client.sprites(step.sprites)).sprites.map(formatSprite);
        observations[step.observe] = seen;
      } else {
        const notReached = await runActionStep(client, step, at);
        if (notReached !== undefined && "runUntil" in step) {
          reason = `Step ${done + 1} did not reach its target in ${step.runUntil.timeoutFrames} frames. It stopped by ${notReached.stopReason} at ${formatC64Address(notReached.pc)}.`;
          break;
        }
      }
      done++;
    }
    const pc = (await client.registersGet("c64")).pc;
    const results = { name: run.name, completed: reason === undefined, steps: run.steps.length, done, ...(reason === undefined ? {} : { reason }), pc: formatC64Address(pc), files: [...files], observations, ...(Object.keys(traces).length === 0 ? {} : { traces }) };
    write("results.json", Buffer.from(`${JSON.stringify(results, null, 2)}\n`));
    return { output: { ...results, files: written, observations: Object.keys(observations), out }, failed: reason !== undefined };
  } finally {
    await client.close();
  }
}
