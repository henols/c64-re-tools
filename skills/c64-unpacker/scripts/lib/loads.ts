// The loads command of c64-unpacker: one capture for each part of a
// multi-load program. The steps file has action steps and capture steps; a
// capture writes what the C64 side changed since the previous capture as an
// image with its entry state, and with --drive the drive RAM as a PRG for
// knowledge space drive8. No tool guesses where a load ends: the steps decide.

import { COVERAGE, formatC64Address } from "#src/c64.ts";
import { autostartLoaded, LOAD_LIMIT_FRAMES, RUN_LIMIT_FRAMES, typeRun } from "#src/host-client/autostart.ts";
import { readCoverage } from "#src/host-client/coverage.ts";
import { ACTION_STEP_KINDS, checkActionStep, isObject, runActionStep, type ActionStep, type ActionStepKind } from "#src/host-client/steps.ts";
import { knowledgeAt } from "#src/knowledge/names.ts";
import { WireFailure } from "#src/host-client/tools.ts";
import { readProjectFile, writeReported, type Written } from "#src/host-client/transfer.ts";
import { ViceSessionClient } from "#src/host-client/vice-session.ts";
import { UsageError } from "#src/script.ts";
import { entryState, json, machineState, readRam, vectorsOf } from "./machine.ts";


export type LoadStep = ActionStep | { capture: string };

/** A capture name: letters, digits, dots, underscores or hyphens. */
const NAME = /^[A-Za-z0-9._-]{1,64}$/;
/** The drive RAM of a 1541. */
const DRIVE_RAM = 0x0800;
/** Pages 0-3 belong to the entry state, not to the segments. */
const FIRST_SEGMENT_ADDRESS = 0x0400;
/** The KERNAL LOAD entry in the jump table. */
const KERNAL_LOAD = 0xffd5;
/** The KERNAL loop that waits for a key at READY. or at an INPUT statement. */
const KERNAL_KEY_WAIT = { start: 0xe5cd, end: 0xe5d5 };

/** Reads and checks the steps file of loads: action steps with $ addresses, and capture steps with new names. */
export function readLoadSteps(path: string): LoadStep[] {
  let value: unknown;
  try {
    value = JSON.parse(readProjectFile(path).bytes.toString("utf8"));
  } catch (error) {
    if (error instanceof WireFailure) throw error;
    throw new UsageError(`--steps ${path} is not JSON: ${(error as Error).message}`);
  }
  const fail = (message: string): never => {
    throw new UsageError(`--steps ${path}: ${message}`);
  };
  if (!Array.isArray(value) || value.length === 0) return fail("the steps are a JSON list with at least one step");
  const names = new Set<string>();
  value.forEach((step: unknown, index) => {
    const at = `step ${index + 1}`;
    if (!isObject(step)) return fail(`${at} must be an object`);
    if ("capture" in step) {
      if (Object.keys(step).length !== 1) fail(`${at}: a capture step has only capture`);
      if (typeof step.capture !== "string" || !NAME.test(step.capture)) fail(`${at}: capture needs a name of 1 to 64 letters, digits, dots, underscores or hyphens`);
      if (names.has(step.capture as string)) fail(`${at}: the capture name ${step.capture as string} is used before`);
      names.add(step.capture as string);
      return;
    }
    const kinds = Object.keys(step).filter((key) => (ACTION_STEP_KINDS as readonly string[]).includes(key));
    if (kinds.length !== 1) return fail(`${at} must have exactly one of ${[...ACTION_STEP_KINDS, "capture"].join(", ")}`);
    // The step with its defaults filled in, as the shared schema of the action steps gives it.
    (value as unknown[])[index] = checkActionStep(kinds[0] as ActionStepKind, step, at, fail);
  });
  if (names.size === 0) fail("the steps have no capture step");
  return value as LoadStep[];
}

/**
 * Ranges from $0400 that the CPU wrote since the last capture, joined across
 * gaps of up to `join` bytes, each with at least one changed byte. With
 * `writesKnown`, every written byte counts, also one written with the value
 * that was there (zeros over the zeros of VICE's start pattern).
 * Without it, the KERNAL RAM test wrote all of RAM after the map was cleared,
 * and only the changed bytes count.
 */
export function changedBlocks(before: Uint8Array, after: Uint8Array, map: Uint8Array, join: number, writesKnown: boolean): Array<{ start: number; end: number; bytes: number }> {
  const blocks: Array<{ start: number; end: number; bytes: number; changed: boolean }> = [];
  for (let address = FIRST_SEGMENT_ADDRESS; address < 0x10000; address++) {
    const changed = before[address] !== after[address];
    if ((map[address]! & COVERAGE.ramWrite) === 0 || (!writesKnown && !changed)) continue;
    const last = blocks.at(-1);
    if (last !== undefined && address - last.end <= join) {
      last.end = address;
      last.bytes++;
      last.changed ||= changed;
    } else blocks.push({ start: address, end: address, bytes: 1, changed });
  }
  return blocks.filter((block) => block.changed).map(({ start, end, bytes }) => ({ start, end, bytes }));
}

const hex4 = (value: number) => value.toString(16).padStart(4, "0");

/**
 * Runs the program and its steps. Each capture step writes <out>/<name>/:
 * image.bin, image.json, entry_state.json, a PRG for each segment, and with
 * `drive` the drive RAM as drive8.prg. Blocks below `minBlock` bytes are
 * counted, not written: a game changes its variables all the time.
 */
export async function loads(program: string, options: { out: string; steps: LoadStep[]; drive: boolean; minBlock: number }): Promise<{ output: Record<string, unknown>; failed: boolean }> {
  const client = await ViceSessionClient.open({ videoStandard: "pal" });
  try {
    await client.reset({ mode: "hard", run: false });
    let previous: Buffer;
    /** A PRG that autostart put into memory without the CPU: its bytes count as written in the first capture. */
    let loadedProgram: Buffer | undefined;
    /** False while the map holds the writes of the KERNAL RAM test. */
    let writesKnown = true;
    /** A known flaw of the host's VICE version that a tape load meets. */
    let emulatorFlaw: string | undefined;
    if (program.toLowerCase().endsWith(".prg")) {
      const { bytes } = readProjectFile(program);
      if (!(await autostartLoaded(client, program, bytes))) return { output: { loaded: false, reason: `The program was not in memory after ${LOAD_LIMIT_FRAMES} frames.` }, failed: true };
      // The RAM before RUN, without the program, so the first capture holds the program too.
      previous = await readRam(client, 0x0000, 0x10000);
      const load = bytes[0]! | (bytes[1]! << 8);
      previous.fill(0, load, Math.min(0x10000, load + bytes.length - 2));
      loadedProgram = bytes;
      await client.memmap({ action: "clear" });
      // RUN as c64-testing types it: the steps start at the same time as a scenario's.
      if (!(await typeRun(client))) return { output: { loaded: false, reason: `After RUN, BASIC ran no program line in ${RUN_LIMIT_FRAMES} frames.` }, failed: true };
    } else {
      // A disk, tape or cartridge: VICE loads and starts it. The RAM test of the KERNAL puts back what it writes.
      previous = await readRam(client, 0x0000, 0x10000);
      await client.memmap({ action: "clear" });
      ({ emulatorFlaw } = await client.autostart({ path: program, index: 0, run: true }));
      writesKnown = false;
      if (!program.toLowerCase().endsWith(".crt")) {
        // The map starts again where the KERNAL LOAD starts, after the RAM test: then it holds only what the program wrote.
        const load = await client.runUntil({ target: { kind: "address", address: KERNAL_LOAD, space: "c64" }, timeoutFrames: LOAD_LIMIT_FRAMES });
        if (load.reached) {
          await client.memmap({ action: "clear" });
          writesKnown = true;
        }
      }
    }

    const captures: Array<Record<string, unknown>> = [];
    for (const [index, step] of options.steps.entries()) {
      if (!("capture" in step)) {
        const notReached = await runActionStep(client, step, knowledgeAt());
        if (notReached !== undefined && "runUntil" in step) {
          const reason = `Step ${index + 1} did not reach its target in ${step.runUntil.timeoutFrames} frames. It stopped by ${notReached.stopReason} at ${formatC64Address(notReached.pc)}.`;
          return { output: { loaded: false, reason, captures }, failed: true };
        }
        continue;
      }
      if ((await client.status()).state === "running") await client.execution({ action: "pause", space: "c64" });
      const registers = await client.registersGet("c64");
      const memory = await readRam(client, 0x0000, 0x10000);
      const map = await readCoverage(client);
      if (loadedProgram !== undefined) {
        // The PRG itself is part of the first capture.
        const load = loadedProgram[0]! | (loadedProgram[1]! << 8);
        for (let address = load; address < Math.min(0x10000, load + loadedProgram.length - 2); address++) map[address]! |= COVERAGE.ramWrite;
        loadedProgram = undefined;
      }
      const blocks = changedBlocks(previous, memory, map, 16, writesKnown);
      const segments = blocks.filter((block) => block.end - block.start + 1 >= options.minBlock);
      const small = blocks.filter((block) => !segments.includes(block)).reduce((sum, block) => sum + block.bytes, 0);
      const state = await machineState(client);
      const vectors = vectorsOf(state, memory);
      const directory = `${options.out}/${step.capture}`;
      const written: Written[] = [];
      const write = (name: string, bytes: Uint8Array) => written.push(writeReported(`${directory}/${name}`, bytes, { what: "--out" }));
      write("image.bin", memory);
      const files = segments.map((segment) => {
        const name = `segment-${hex4(segment.start)}-${hex4(segment.end)}.prg`;
        write(name, Buffer.concat([Buffer.from([segment.start & 0xff, segment.start >> 8]), memory.subarray(segment.start, segment.end + 1)]));
        return name;
      });
      let drive: Record<string, unknown> | undefined;
      if (options.drive) {
        const ram = Buffer.from((await client.memoryRead({ address: 0x0000, size: DRIVE_RAM, space: "drive8", view: "cpu" })).data, "hex");
        write("drive8.prg", Buffer.concat([Buffer.from([0x00, 0x00]), ram]));
        drive = { file: "drive8.prg", pc: formatC64Address((await client.registersGet("drive8")).pc), space: "drive8" };
      }
      const showRange = (range: { start: number; end: number }) => ({ start: formatC64Address(range.start), end: formatC64Address(range.end) });
      write(
        "image.json",
        json({
          capture: step.capture,
          entry: formatC64Address(registers.pc),
          segments: segments.map((segment, at) => ({ ...showRange(segment), file: files[at] })),
          vectors,
          image: "image.bin",
          ...(drive === undefined ? {} : { drive }),
        }),
      );
      write("entry_state.json", json(entryState(registers, state, vectors)));
      const keyWait = registers.pc >= KERNAL_KEY_WAIT.start && registers.pc <= KERNAL_KEY_WAIT.end;
      captures.push({
        capture: step.capture,
        out: directory,
        files: written,
        pc: formatC64Address(registers.pc),
        ...(keyWait ? { keyWait: true } : {}),
        segments: segments.map(showRange),
        ...(small === 0 ? {} : { smallChanges: small }),
        ...(drive === undefined ? {} : { drive: drive.file }),
      });
      previous = memory;
      await client.memmap({ action: "clear" });
      writesKnown = true;
    }
    if (captures.length > 0 && captures.every((capture) => (capture.segments as unknown[]).length === 0)) {
      const waits = captures.some((capture) => capture.keyWait === true) ? " The C64 waited for a key at READY. or at an INPUT statement, so the load ended or did not start." : "";
      const reason = `No capture has a segment: the program changed no block of RAM from ${formatC64Address(FIRST_SEGMENT_ADDRESS)} on.${waits}`;
      return { output: { loaded: false, reason, captures, ...(emulatorFlaw === undefined ? {} : { emulatorFlaw }) }, failed: true };
    }
    return { output: { loaded: true, captures }, failed: false };
  } finally {
    await client.close();
  }
}
