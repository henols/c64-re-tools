// The runs of c64-testing: steps in their own emulator, from a program or a
// snapshot file, and what the steps ask for written into a folder: screens,
// coverage maps, snapshot files, and results.json with the observations. One
// side, no comparison with another program: an expect step checks the memory
// and registers against the values that the run file gives.

import { existsSync } from "node:fs";
import { posix } from "node:path";

import { formatC64Address, formatC64Byte, formatSprite, formatVicii, parseC64Address } from "#src/c64.ts";
import { screenText } from "#src/graphics.ts";
import { runProgram } from "#src/host-client/autostart.ts";
import { isRefusal, Refusal } from "#src/errors.ts";
import { readCoverage } from "#src/host-client/coverage.ts";
import { ACTION_STEP_KINDS, aStep, checkActionStep, checkLocation, checkStepNames, isInteger, isObject, refuseOldStep, renamedField, runActionStep, type ActionStep, type ActionStepKind } from "#src/host-client/steps.ts";
import { readPrg } from "#src/host-client/image.ts";
import { MAX_MEMORY_READ, MAX_TRACE_FRAMES, MAX_TRACE_HITS, MAX_TRACE_POINTS, TRACE_KINDS, WireFailure, type TraceHit, type TraceKind } from "#src/host-client/tools.ts";
import { readProjectFile, writeReported, type Written } from "#src/host-client/transfer.ts";
import { readMemoryInParts, ViceSessionClient } from "#src/host-client/vice-session.ts";
import { checkSnapshotFile } from "#src/media.ts";
import { checkOutputPath, LOCAL_DIRECTORY, PROJECT_DIRECTORY, projectRelative, resolveProjectPath } from "#src/project.ts";
import { namesOf } from "./scenario.ts";
import { passStartScreen } from "./start-screen.ts";

type RunStep =
  | ActionStep
  | { snapshot: string }
  | { save: string }
  | { screen: string }
  | { coverage: string }
  | { trace: string; points: Array<{ kind: TraceKind; start: string; end?: string }>; frames: number; maxHits?: number }
  | { observe: string; memory?: "all" | Array<string | { address: string; size?: number; view?: "cpu" | "ram" }>; registers?: boolean; vicii?: boolean; sprites?: number[] }
  | { expect: string; memory?: ExpectedMemory[]; registers?: ExpectedRegisters };

/** Expected bytes at an address: hex data, under an optional mask, or text as screen codes. */
interface ExpectedMemory {
  address: string;
  data?: string;
  text?: string;
  mask?: string;
  view?: "cpu" | "ram";
}

type ExpectedRegisters = Extract<ActionStep, { registers: unknown }>["registers"];

/** One value that differs from the expected value. */
interface Mismatch {
  address?: string;
  register?: string;
  expected: string | number | boolean;
  actual: string | number | boolean;
}

interface Run {
  name: string;
  videoStandard?: "pal" | "ntsc";
  start: { program: string; load?: boolean } | { snapshot: string };
  symbols?: string;
  steps: RunStep[];
}

const OWN_KINDS = ["snapshot", "save", "screen", "coverage", "observe", "expect", "trace"] as const;
/** The keys of a run file: name, start and steps are required. */
const RUN_KEYS = ["name", "start", "steps", "symbols", "videoStandard"];
const RUN_FIELDS = "A run file has name, start and steps, and optionally symbols and videoStandard";
const START_FORMS = '{ "program": "<file.prg>" }, { "program": "<file.prg>", "load": true } or { "snapshot": "<file.vsf>" }';
const TRACE_KEYS = ["trace", "points", "frames", "maxHits"];
const OBSERVE_KEYS = ["observe", "memory", "registers", "vicii", "sprites"];
/** The fix for a key that the same step of a scenario has, or none. */
function scenarioKeyFix(key: string, step: Record<string, unknown>): string {
  if (key === "screen" && "observe" in step) return `. A run writes the screen with its own step: {"screen": "${typeof step.observe === "string" ? step.observe : "<name>"}"}`;
  return key === "side" ? ". A run has one program. Remove side" : "";
}
const EXPECT_KEYS = ["expect", "memory", "registers"];
const EXPECTED_MEMORY_KEYS = ["address", "data", "text", "mask", "view"];
/** The characters that screenText gives for the screen codes 0 to 63; a graphics code gives a dot. */
const SCREEN_TEXT = /^[@A-Z[£\]^< !"#$%&'()*+,\-./0-9:;=>?]+$/;
/** The most differing bytes that an expectation lists; count gives all of them. */
const MAX_LISTED_MISMATCHES = 16;
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
    throw new Refusal("invalid-input", `the run ${path} is not JSON: ${(error as Error).message}`);
  }
  const fail = (message: string): never => {
    throw new Refusal("invalid-input", `run ${path}: ${message}`);
  };
  if (!isObject(value)) return fail(`is not a JSON object. ${RUN_FIELDS}`);
  for (const key of Object.keys(value)) if (!RUN_KEYS.includes(key)) fail(`has the key ${key}. ${RUN_FIELDS}`);
  if (typeof value.name !== "string" || value.name === "") fail('name must be a non-empty string, for example "rooms"');
  if (value.videoStandard !== undefined && value.videoStandard !== "pal" && value.videoStandard !== "ntsc") fail('videoStandard must be "pal" or "ntsc"');
  const start = value.start;
  if (!isObject(start) || (typeof start.program !== "string") === (typeof start.snapshot !== "string")) return fail(`start must be ${START_FORMS}`);
  for (const key of Object.keys(start)) if (!(typeof start.program === "string" ? ["program", "load"] : ["snapshot"]).includes(key)) fail(`start has the key ${key}. start must be ${START_FORMS}`);
  if (start.load !== undefined && typeof start.load !== "boolean") fail("start.load must be true or false");
  if (value.symbols !== undefined && typeof value.symbols !== "string") fail('symbols must be "knowledge", "none" or a JSON file');
  if (!Array.isArray(value.steps) || value.steps.length === 0) fail("steps must be a list with at least one step");
  const labels = new Set<string>();
  (value.steps as unknown[]).forEach((step, index) => {
    const at = `step ${index + 1}`;
    if (!isObject(step)) return fail(`${at} must be an object`);
    const kinds = "observe" in step ? ["observe"] : "expect" in step ? ["expect"] : "trace" in step ? ["trace"] : Object.keys(step).filter((key) => (ACTION_STEP_KINDS as readonly string[]).includes(key) || (OWN_KINDS as readonly string[]).includes(key));
    if (kinds.length > 1) return fail(`${at} has ${kinds.length} step kinds: ${kinds.join(", ")}. Give each one its own step`);
    if (kinds.length !== 1) return fail(`${at} must have exactly one of ${[...ACTION_STEP_KINDS, ...OWN_KINDS].join(", ")}`);
    const kind = kinds[0]!;
    refuseOldStep(kind, step, at, fail);
    const allowed = kind === "observe" ? OBSERVE_KEYS : kind === "expect" ? EXPECT_KEYS : kind === "trace" ? TRACE_KEYS : [kind];
    for (const key of Object.keys(step)) if (!allowed.includes(key)) fail(`${at} has the key ${key}, which ${aStep(kind)} of a run does not have${scenarioKeyFix(key, step)}`);
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
    if (kind === "expect") {
      if (labels.has(name as string)) fail(`${at} needs a new name`);
      labels.add(name as string);
      if (step.memory === undefined && step.registers === undefined) fail(`${at}: expect needs memory, registers or both`);
      if (step.memory !== undefined) {
        if (!Array.isArray(step.memory) || step.memory.length === 0) return fail(`${at}: memory is a list of objects with address, and data or text`);
        for (const item of step.memory as unknown[]) {
          if (!isObject(item)) return fail(`${at}: memory is a list of objects with address, and data or text`);
          for (const key of Object.keys(item)) if (!EXPECTED_MEMORY_KEYS.includes(key)) fail(`${at}: an expected memory object has the field ${key}. It has address, data or text, mask and view, and nothing else`);
          checkLocation(item.address, `${at}: address`, fail);
          if ((item.data === undefined) === (item.text === undefined)) fail(`${at}: an expected memory object needs data or text, not both`);
          if (item.data !== undefined && (typeof item.data !== "string" || !/^(?:[0-9a-fA-F]{2})+$/.test(item.data))) fail(`${at}: data must be hex bytes, two digits per byte, no separators, for example 0801`);
          if (item.text !== undefined && (typeof item.text !== "string" || !SCREEN_TEXT.test(item.text))) {
            fail(`${at}: text has the characters of the upper-case set: @, A to Z, digits, space, the signs !"#$%&'()*+,-./:;<=>? and [£]^<. Write letters in upper case`);
          }
          const size = typeof item.data === "string" ? item.data.length / 2 : typeof item.text === "string" ? item.text.length : 0;
          if (size > MAX_MEMORY_READ) fail(`${at}: an expected memory object has at most ${MAX_MEMORY_READ} bytes`);
          if (item.mask !== undefined && (item.data === undefined || typeof item.mask !== "string" || !/^(?:[0-9a-fA-F]{2})+$/.test(item.mask) || item.mask.length !== (item.data as string).length)) {
            fail(`${at}: mask needs data, and is hex bytes of the same length as data`);
          }
          if (item.view !== undefined && item.view !== "cpu" && item.view !== "ram") fail(`${at}: view must be cpu or ram`);
        }
      }
      // The registers have the fields of a registers step: only pc can be a name.
      if (step.registers !== undefined) step.registers = (checkActionStep("registers", { registers: step.registers }, at, fail) as { registers: ExpectedRegisters }).registers;
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
const PROGRAM_REMEDY = "A run starts a PRG. Extract the program file from the disk, tape or cartridge image, and give that PRG";

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

/**
 * The values of an expect step that differ: each byte of data (under its
 * mask), the text of screen codes as one string, and each register.
 */
async function expected(client: ViceSessionClient, step: Extract<RunStep, { expect: string }>, at: (location: string) => number): Promise<Mismatch[]> {
  const mismatches: Mismatch[] = [];
  for (const item of step.memory ?? []) {
    const address = at(item.address);
    if (item.text !== undefined) {
      const actual = screenText(await readMemoryInParts(client, address, item.text.length, item.view ?? "cpu")).join("");
      if (actual !== item.text) mismatches.push({ address: formatC64Address(address), expected: item.text, actual });
      continue;
    }
    const data = Buffer.from(item.data!, "hex");
    const mask = item.mask === undefined ? undefined : Buffer.from(item.mask, "hex");
    const actual = await readMemoryInParts(client, address, data.length, item.view ?? "cpu");
    data.forEach((byte, offset) => {
      const bits = mask?.[offset] ?? 0xff;
      if ((actual[offset]! & bits) !== (byte & bits)) mismatches.push({ address: formatC64Address((address + offset) & 0xffff), expected: formatC64Byte(byte), actual: formatC64Byte(actual[offset]!) });
    });
  }
  if (step.registers !== undefined) {
    const registers = await client.registersGet("c64");
    const { pc, flags, ...bytes } = step.registers;
    if (pc !== undefined && registers.pc !== at(pc)) mismatches.push({ register: "pc", expected: formatC64Address(at(pc)), actual: formatC64Address(registers.pc) });
    for (const [name, value] of Object.entries(bytes) as Array<["a" | "x" | "y" | "sp", number]>) if (registers[name] !== value) mismatches.push({ register: name, expected: value, actual: registers[name] });
    for (const [name, value] of Object.entries(flags ?? {}) as Array<[keyof typeof registers.flags, boolean]>) if (registers.flags[name] !== value) mismatches.push({ register: `flags.${name}`, expected: value, actual: registers.flags[name] });
  }
  return mismatches;
}

/** Runs the run file and writes its files into `out`. failed: a step did not run, or an expect step found a value that differs. */
export async function runFile(path: string, out: string): Promise<{ output: Record<string, unknown>; failed: boolean }> {
  const run = readRun(path);
  checkRunFiles(path, run);
  const symbols = namesOf(run.symbols ?? "none");
  const at = (location: string): number => {
    if (location.startsWith("$")) return parseC64Address(location);
    const address = symbols.get(location);
    if (address !== undefined) return address;
    if (run.symbols === undefined || run.symbols === "none") {
      throw new Refusal("invalid-input", `${location} is a name, and the run file has no symbols. A run file has no symbols unless it gives "symbols": "knowledge" for the names of the knowledge, or "symbols": "<file>" for a JSON file of names. Give one of them, or a $ address`);
    }
    throw new Refusal("not-found", `the symbols ${run.symbols} have no ${location}`);
  };
  // Every name of the steps resolves before the emulator starts. A refusal names the step.
  run.steps.forEach((step, index) => {
    if ("trace" in step || "observe" in step || "expect" in step) {
      const names =
        "trace" in step
          ? step.points.flatMap((point) => [point.start, ...(point.end === undefined ? [] : [point.end])])
          : "expect" in step
            ? [...(step.memory ?? []).map((item) => item.address), ...(step.registers?.pc === undefined ? [] : [step.registers.pc])]
            : step.memory === undefined || step.memory === "all"
              ? []
              : step.memory.map((item) => (typeof item === "string" ? item : item.address));
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
  const expectations: Array<{ expect: string; pass: boolean; count: number; mismatches: Mismatch[] }> = [];
  const traces: Record<string, unknown> = {};
  const client = await ViceSessionClient.open({ videoStandard: run.videoStandard ?? "pal" });
  let done = 0;
  let reason: string | undefined;
  let startScreen: "skipped" | "none" = "none";
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
      else {
        const screen = await passStartScreen(client, symbols);
        if (typeof screen === "object") reason = `${screen.problem[0]!.toUpperCase()}${screen.problem.slice(1)}.`;
        else startScreen = screen;
      }
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
        if (points.some((point) => point.end < point.start)) throw new Refusal("invalid-input", `the trace ${step.trace} has a point whose end is before its start`);
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
      } else if ("expect" in step) {
        // A mismatch does not stop the run: the later steps and expectations still run.
        const mismatches = await expected(client, step, at);
        expectations.push({ expect: step.expect, pass: mismatches.length === 0, count: mismatches.length, mismatches: mismatches.slice(0, MAX_LISTED_MISMATCHES) });
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
    const failedExpectations = expectations.filter((item) => !item.pass).map((item) => item.expect);
    const results = {
      name: run.name,
      completed: reason === undefined,
      steps: run.steps.length,
      done,
      ...(reason === undefined ? {} : { reason }),
      pc: formatC64Address(pc),
      ...(startScreen === "skipped" ? { startScreen } : {}),
      files: [...files],
      observations,
      ...(expectations.length === 0 ? {} : { expectations, failedExpectations }),
      ...(Object.keys(traces).length === 0 ? {} : { traces }),
    };
    write("results.json", Buffer.from(`${JSON.stringify(results, null, 2)}\n`));
    return { output: { ...results, files: written, out }, failed: reason !== undefined || failedExpectations.length > 0 };
  } finally {
    await client.close();
  }
}

/** The name of the run file in a kept run, and the folder of the files that it starts from. */
const KEPT_RUN = "run.json";
const KEPT_INPUTS = "inputs";
/** A file name that a run wrote into --out: no folder, no "." or "..". */
const RESULT_FILE = /^(?!\.\.?$)[A-Za-z0-9._-]+$/;

/** A path of a run file that keep changed: the field, the old path and the new path. */
export interface KeptPath {
  field: string;
  from: string;
  to: string;
}

/**
 * Keeps a run as evidence in a folder that git keeps: the run file as
 * run.json, results.json and each file that the run wrote into `out`, and
 * each file in .c64-re-tools/local/ that the run file starts from (the
 * program, the snapshot, the symbols and the snapshot steps) in inputs/. The
 * run file gets the new paths of those files only; another path stays as it
 * is. All files are read before the first write, and the target must not
 * exist, so a refusal leaves nothing behind.
 */
export function keepRun(path: string, out: string, target: string): { out: string; files: Written[]; paths: KeptPath[] } {
  const run = readRun(path);
  const raw = JSON.parse(readProjectFile(path).bytes.toString("utf8")) as { start: Record<string, unknown>; symbols?: unknown; steps: Array<Record<string, unknown>> };
  const kept = projectRelative(target);
  if (kept === PROJECT_DIRECTORY || kept.startsWith(`${PROJECT_DIRECTORY}/`)) {
    throw new Refusal("invalid-input", `${target} is in ${PROJECT_DIRECTORY}/, and git does not keep a run there. Give a new folder outside it, for example runs/${run.name.replace(/[^A-Za-z0-9._-]+/g, "_")}.`);
  }
  if (existsSync(resolveProjectPath(kept))) throw new Refusal("conflict", `${target} exists. Give a new folder, or remove the old folder first.`);
  checkOutputPath(kept, "folder", { what: target });
  const results = (() => {
    const file = `${out}/results.json`;
    let value: unknown;
    try {
      value = JSON.parse(readProjectFile(file).bytes.toString("utf8"));
    } catch (error) {
      if (isRefusal(error) && error.code === "not-found") throw new Refusal("not-found", `${out} has no results.json. Give the --out folder of a run of ${path}.`);
      if (isRefusal(error)) throw error;
      throw new Refusal("invalid-input", `${file} is not JSON: ${(error as Error).message}`);
    }
    if (!isObject(value) || value.name !== run.name || !Array.isArray(value.files) || !value.files.every((name) => typeof name === "string" && RESULT_FILE.test(name))) {
      throw new Refusal("invalid-input", `${file} is not the result of the run ${run.name}. Give the --out folder of a run of ${path}.`);
    }
    return { file, names: value.files as string[] };
  })();
  if (results.names.includes(KEPT_RUN)) throw new Refusal("invalid-input", `the run wrote ${out}/${KEPT_RUN}, which is the name of the run file in a kept run. Give the step that writes it another name, and run again.`);
  // The files of the project that the run file names in the local folder: each one once, in inputs/ with its own name.
  const local = `${PROJECT_DIRECTORY}/${LOCAL_DIRECTORY}/`;
  const inputs = new Map<string, { to: string; bytes: Buffer }>();
  const used = new Set<string>();
  const paths: KeptPath[] = [];
  const keep = (field: string, file: unknown): string | undefined => {
    if (typeof file !== "string" || file === "knowledge" || file === "none") return undefined;
    let from: string;
    try {
      from = projectRelative(file);
    } catch (error) {
      // A path into another project of the group is not in this local folder.
      if (isRefusal(error)) return undefined;
      throw error;
    }
    if (!from.startsWith(local)) return undefined;
    let input = inputs.get(from);
    if (input === undefined) {
      let bytes: Buffer;
      try {
        bytes = readProjectFile(file).bytes;
      } catch (error) {
        if (isRefusal(error)) throw new Refusal(error.code, `run ${path}: ${field}: ${error.message}`);
        throw error;
      }
      const name = posix.basename(from);
      const extension = posix.extname(name);
      let unique = name;
      for (let count = 2; used.has(unique.toLowerCase()); count++) unique = `${name.slice(0, name.length - extension.length)}-${count}${extension}`;
      used.add(unique.toLowerCase());
      input = { to: `${kept}/${KEPT_INPUTS}/${unique}`, bytes };
      inputs.set(from, input);
    }
    paths.push({ field, from: file, to: input.to });
    return input.to;
  };
  const moved = (holder: Record<string, unknown>, key: string, field: string) => {
    const to = keep(field, holder[key]);
    if (to !== undefined) holder[key] = to;
  };
  moved(raw.start, "program", "start.program");
  moved(raw.start, "snapshot", "start.snapshot");
  moved(raw as Record<string, unknown>, "symbols", "symbols");
  raw.steps.forEach((step, index) => {
    if (isObject(step) && "snapshot" in step) moved(step, "snapshot", `step ${index + 1}: snapshot`);
  });
  const outputs = [results.file, ...results.names.map((name) => `${out}/${name}`)].map((file) => ({ to: `${kept}/${posix.basename(file)}`, bytes: readProjectFile(file).bytes }));
  const files = [...inputs.values(), ...outputs].map((file) => writeReported(file.to, file.bytes, { what: target }));
  files.push(writeReported(`${kept}/${KEPT_RUN}`, `${JSON.stringify(raw, null, 1)}\n`, { what: target }));
  return { out: kept, files, paths };
}
