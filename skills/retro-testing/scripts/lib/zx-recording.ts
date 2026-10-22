// Record and replay of a ZX Spectrum program in the replay core zxrun. A record
// file gives the program as a snapshot (.z80 or .sna) and the steps: frames,
// keys of the keyboard and the Kempston joystick. The recording holds each read
// of the keyboard port (each even port, the ULA) and of the Kempston port $1F
// by its site, so a replay gives the program the same inputs at the same reads.
// A replay on the original must end at the recorded tick with the recorded RAM;
// a rebuild (its bytes put over the snapshot) must do the same. The RAM banks of
// each side at the end show where a rebuild differs from the original.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import { formatAddress } from "#src/address.ts";
import { Refusal } from "#src/errors.ts";
import { readProjectFile } from "#src/host-client/transfer.ts";
import { ZX_FRAME_CYCLES, type ZxModel, type ZxRunSession } from "#src/native/zxrun.ts";
import type { Workspace } from "#src/native/staging.ts";
import { readSna, readZ80, writeZ80 } from "#src/spectrum.ts";
import { changedRanges, type ChangedRange } from "./diff.ts";

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** The input ports: the keyboard (the ULA reads each even port; programs use $xxFE) and the Kempston joystick ($xx1F). */
export const ZX_INPUTS = "xxfe,xx1f";
const KEY_FRAMES = 3;
const MAX_FRAMES = 1_000_000;

/** The chips key code of each key of the keyboard: the letters and digits, and the special keys. CAPS SHIFT alone is $0E in zxrun. */
const KEY_CODES: Record<string, number> = { space: 0x20, enter: 0x0d, symbol: 0x0f, caps: 0x0e };
for (const char of "abcdefghijklmnopqrstuvwxyz0123456789") KEY_CODES[char] = char.charCodeAt(0);

const DIRECTIONS = ["up", "down", "left", "right", "fire"] as const;

export type ZxStep = { frames: number } | { press: string[]; frames: number } | { joystick: { up: boolean; down: boolean; left: boolean; right: boolean; fire: boolean } };

export interface ZxRecordFile {
  name: string;
  program: string;
  steps: ZxStep[];
}

/** The keys of a record file of a C64 program: a ZX Spectrum record file has none of them. */
const C64_KEYS = ["symbols", "load", "checkpoint", "state", "pin", "inputs", "coverage"];
/** The steps of a record file of a C64 program that a ZX Spectrum record file does not have. */
const C64_STEPS = ["type", "write", "registers", "runUntil"];

const STEP_FORMS = '{ "frames": 50 }, { "press": ["space"], "frames": 5 } or { "joystick": { "right": true, "fire": true } }';

/** Reads and checks a record file of a ZX Spectrum program. A key or a step of the C64 form is refused by name. */
export function readZxRecordFile(path: string): ZxRecordFile {
  const fail = (what: string): never => {
    throw new Refusal("invalid-input", `record file ${path}: ${what}`);
  };
  let parsed: unknown;
  try {
    parsed = JSON.parse(readProjectFile(path, { what: "<record.json>" }).bytes.toString("utf8"));
  } catch (error) {
    if (error instanceof Refusal || (error as { code?: string }).code !== undefined) throw error;
    return fail((error as Error).message);
  }
  const file = isObject(parsed) ? parsed : fail("it is not a JSON object");
  for (const key of Object.keys(file)) {
    if (["name", "program", "steps"].includes(key)) continue;
    if (C64_KEYS.includes(key)) fail(`${key} is for a C64 program. A ZX Spectrum record file has only name, program and steps, and a replay compares the tick and the RAM at the end`);
    fail(`${key} is not a key of a ZX Spectrum record file. It has only name, program and steps`);
  }
  if (typeof file.name !== "string" || file.name === "") fail("name must be a text");
  if (typeof file.program !== "string" || !/\.(z80|sna)$/i.test(file.program)) fail("program must be a .z80 or .sna snapshot of the program, relative to the project folder");
  if (!Array.isArray(file.steps) || file.steps.length === 0) fail("steps must be a list of at least one step");
  const steps = (file.steps as unknown[]).map((value, index): ZxStep => {
    const at = `step ${index + 1}`;
    const step = isObject(value) ? value : fail(`${at} is not an object`);
    const only = (...keys: string[]) => {
      for (const key of Object.keys(step)) if (!keys.includes(key)) fail(`${at}: ${key} is not a key of this step. The step has only ${keys.join(" and ")}`);
    };
    const frames = (given: unknown, fallback?: number) => {
      const count = given ?? fallback;
      if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > MAX_FRAMES) fail(`${at}: frames must be 1 to ${MAX_FRAMES}`);
      return count as number;
    };
    if ("press" in step) {
      only("press", "frames");
      const keys = Array.isArray(step.press) ? step.press : fail(`${at}: press must be a list of keys, for example ["space"]`);
      if (keys.length === 0 || keys.length > 8 || !keys.every((key) => typeof key === "string" && key in KEY_CODES)) fail(`${at}: press takes 1 to 8 keys: a-z, 0-9, space, enter, caps or symbol`);
      return { press: keys as string[], frames: frames(step.frames, KEY_FRAMES) };
    }
    if ("joystick" in step) {
      only("joystick");
      const form = 'The Kempston joystick is { "joystick": { "right": true, "fire": true } } with up, down, left, right and fire, or { "joystick": null }';
      const stick = step.joystick === null ? {} : isObject(step.joystick) ? step.joystick : fail(`${at}: joystick must be an object or null. ${form}`);
      for (const [key, set] of Object.entries(stick)) {
        if (!(DIRECTIONS as readonly string[]).includes(key)) fail(`${at}: joystick has no ${key}${key === "port" || key === "direction" ? ": that is the C64 form" : ""}. ${form}`);
        if (typeof set !== "boolean") fail(`${at}: joystick ${key} must be true or false. ${form}`);
      }
      const bit = (name: string) => stick[name] === true;
      return { joystick: { up: bit("up"), down: bit("down"), left: bit("left"), right: bit("right"), fire: bit("fire") } };
    }
    if ("frames" in step) {
      only("frames");
      return { frames: frames(step.frames) };
    }
    const c64 = Object.keys(step).find((key) => C64_STEPS.includes(key));
    return fail(`${at}: ${c64 === undefined ? "the step is not frames, press or joystick" : `${c64} is a step for a C64 program`}. A ZX Spectrum step is ${STEP_FORMS}`);
  });
  // A joystick step only sets the input: without frames, the session has no time and records nothing.
  if (!steps.some((step) => "frames" in step)) fail(`the steps run no frame. Give a frames or a press step, for example ${STEP_FORMS}`);
  return { name: file.name as string, program: file.program as string, steps };
}

/** The snapshot of the program as a .z80 that zxrun loads, and its model. */
function programSnapshot(path: string): { bytes: Uint8Array; model: ZxModel } {
  const file = readProjectFile(path, { what: "program" });
  const snapshot = file.type === "z80" ? readZ80(file.bytes) : readSna(file.bytes);
  // A .sna becomes a .z80; a .z80 is written again, so zxrun loads one format.
  return { bytes: writeZ80(snapshot), model: snapshot.model };
}

export interface ZxRecording {
  format: 1;
  machine: "spectrum48" | "spectrum128";
  name: string;
  program: string;
  /** The SHA-256 of program.z80 in the recording folder. */
  sha256: string;
  inputs: string;
  steps: ZxStep[];
  ticks: number;
  hash: string;
  sites: Array<{ site: string; port: string; reads: number; rom: boolean }>;
}

export const ZX_RECORDING_FILES = { recording: "recording.json", reads: "reads.txt", coverage: "coverage.bin", program: "program.z80" } as const;

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** The sites of a sites answer: "ok unknown=0 8018/7ffe:12:ram ...". */
function parseSites(answer: string): { unknown: number; sites: Array<{ site: number; port: number; reads: number; rom: boolean; recorded?: number; misses?: number }> } {
  const words = answer.trim().split(/\s+/);
  const unknown = Number(/unknown=(\d+)/.exec(answer)?.[1] ?? 0);
  const sites = words
    .filter((word) => /^[0-9a-f]{4}\/[0-9a-f]{4}:/.test(word))
    .map((word) => {
      const [where, reads, kind, recorded, misses] = word.split(":");
      const [site, port] = where!.split("/").map((hex) => Number.parseInt(hex, 16));
      return { site: site!, port: port!, reads: Number(reads), rom: kind === "rom", ...(recorded === undefined ? {} : { recorded: Number(recorded), misses: Number(misses) }) };
    });
  return { unknown, sites };
}

/** Plays the steps on the snapshot and gives the recording, the reads and the coverage. */
export async function zxRecord(core: ZxRunSession, file: ZxRecordFile, workspace: Workspace): Promise<{ recording: ZxRecording; reads: Buffer; coverage: Buffer; program: Uint8Array }> {
  const { bytes, model } = programSnapshot(file.program);
  const frame = ZX_FRAME_CYCLES[model];
  const program = workspace.path("program.z80");
  writeFileSync(program, bytes);
  await core.init(model);
  await core.loadZ80(program);
  await core.command(`inputs ${ZX_INPUTS}`);
  await core.command("coverage on");
  const reads = workspace.path("reads.txt");
  await core.command(`record ${reads}`);
  let tick = 0;
  for (const step of file.steps) {
    if ("joystick" in step) {
      const { right, left, down, up, fire } = step.joystick;
      await core.command(`joy ${((right ? 1 : 0) | (left ? 2 : 0) | (down ? 4 : 0) | (up ? 8 : 0) | (fire ? 0x10 : 0)).toString(16)}`);
      continue;
    }
    if ("press" in step) for (const key of step.press) await core.command(`key ${KEY_CODES[key]!.toString(16)} down`);
    tick += step.frames * frame;
    await core.status(`run ${tick}`);
    if ("press" in step) for (const key of step.press) await core.command(`key ${KEY_CODES[key]!.toString(16)} up`);
  }
  const sites = parseSites(await core.command("sites"));
  await core.command("record off");
  const coverage = workspace.path("coverage.bin");
  await core.command(`coverage ${coverage}`);
  const end = await core.status("status");
  const recording: ZxRecording = {
    format: 1,
    machine: model === "128k" ? "spectrum128" : "spectrum48",
    name: file.name,
    program: file.program,
    sha256: sha256(bytes),
    inputs: ZX_INPUTS,
    steps: file.steps,
    ticks: end.tick,
    hash: end.hash,
    sites: sites.sites.map((site) => ({ site: formatAddress(site.site), port: formatAddress(site.port), reads: site.reads, rom: site.rom })),
  };
  return { recording, reads: readFileSync(reads), coverage: readFileSync(coverage), program: bytes };
}

/** Reads the recording folder that zxRecord wrote. */
export function readZxRecording(folder: string): ZxRecording {
  const path = `${folder}/${ZX_RECORDING_FILES.recording}`;
  let recording: Partial<ZxRecording>;
  try {
    recording = JSON.parse(readProjectFile(path, { what: "<recording>" }).bytes.toString("utf8")) as Partial<ZxRecording>;
  } catch (error) {
    if (error instanceof Refusal || (error as { code?: string }).code !== undefined) throw error;
    throw new Refusal("invalid-input", `recording ${path}: ${(error as Error).message}`);
  }
  if (recording.format !== 1 || (recording.machine !== "spectrum48" && recording.machine !== "spectrum128") || typeof recording.ticks !== "number" || typeof recording.hash !== "string") {
    throw new Refusal("invalid-input", `${folder} has no recording of a ZX Spectrum program. Record the session with record.`);
  }
  if (typeof recording.sha256 !== "string") throw new Refusal("invalid-input", `recording ${path}: sha256 is missing. Record the session again.`);
  return recording as ZxRecording;
}

/** The problem of the program file of a recording folder: undefined when it is the program of the recording. */
export function zxProgramProblem(folder: string, recording: ZxRecording): string | undefined {
  const path = `${folder}/${ZX_RECORDING_FILES.program}`;
  return sha256(readProjectFile(path, { what: "<recording>" }).bytes) === recording.sha256 ? undefined : `${path} is not the program of the recording (its SHA-256 changed); record the session again`;
}

/** The file types that are no bytes of a build: tapes, disks, snapshots and program files of both machines. */
const NOT_BUILD_BYTES = ["tap", "tzx", "z80", "sna", "szx", "zsf", "prg", "p00", "t64", "d64", "d71", "d81", "g64", "x64", "crt", "vsf"];
const TZX_SIGNATURE = "ZXTape!\x1a";

/** The bytes of a rebuild for --rebuild: the binary output of a build, inside the RAM from `at`. */
export function readZxRebuild(path: string, at: number): { bytes: Uint8Array; at: number } {
  const file = readProjectFile(path, { what: "--rebuild" });
  const remedy = "Give the binary file that the build of the rebuild wrote, for example build/<name>.bin, and the address of its first byte with --rebuild-at.";
  const tape = Buffer.from(file.bytes.subarray(0, TZX_SIGNATURE.length)).toString("latin1") === TZX_SIGNATURE;
  if (NOT_BUILD_BYTES.includes(file.type) || tape) throw new Refusal("invalid-input", `--rebuild: ${path} is a ${tape ? "tzx" : file.type} file, not the bytes of a build. ${remedy}`);
  if (file.bytes.length === 0 || at < 0x4000 || at + file.bytes.length > 0x10000) {
    throw new Refusal("invalid-input", `--rebuild: the ${file.bytes.length} bytes of ${path} at ${formatAddress(at)} are not inside the RAM, $4000-$ffff. ${remedy}`);
  }
  return { bytes: file.bytes, at };
}

export interface ZxReplaySide {
  ticks: number;
  hash: string;
  /** Reads at a site that the recording does not have, and reads after the recording of a site ended. */
  unknownReads: number;
  missedReads: number;
  /** The RAM banks at the end, 16 KiB each: 0-2 at $4000, $8000 and $c000 on the 48K, banks 0-7 on the 128K. */
  banks: Uint8Array[];
}

/** Replays the recording on the snapshot of the recording folder, with the bytes of a rebuild over it when given. */
export async function zxReplay(core: ZxRunSession, folder: string, recording: ZxRecording, workspace: Workspace, rebuild?: { bytes: Uint8Array; at: number }): Promise<ZxReplaySide> {
  const program = workspace.path("program.z80");
  writeFileSync(program, readProjectFile(`${folder}/${ZX_RECORDING_FILES.program}`, { what: "<recording>" }).bytes);
  const reads = workspace.path("reads.txt");
  writeFileSync(reads, readProjectFile(`${folder}/${ZX_RECORDING_FILES.reads}`, { what: "<recording>" }).bytes);
  await core.init(recording.machine === "spectrum128" ? "128k" : "48k");
  await core.loadZ80(program);
  if (rebuild !== undefined) await core.write(rebuild.at, rebuild.bytes);
  await core.command(`inputs ${recording.inputs}`);
  await core.command(`replay ${reads}`);
  const end = await core.status(`run ${recording.ticks}`);
  const sites = parseSites(await core.command("sites"));
  const banks: Uint8Array[] = [];
  for (let bank = 0; bank < (recording.machine === "spectrum128" ? 8 : 3); bank++) {
    const file = workspace.path(`bank${bank}.bin`);
    await core.command(`bank-dump ${bank} ${file}`);
    banks.push(readFileSync(file));
  }
  return { ticks: end.tick, hash: end.hash, unknownReads: sites.unknown, missedReads: sites.sites.reduce((sum, site) => sum + (site.misses ?? 0), 0), banks };
}

/** The verdict of one side: SAME, or the reason why it is not. */
export function zxVerdict(recording: ZxRecording, side: Omit<ZxReplaySide, "banks">): string | undefined {
  if (side.unknownReads > 0) return `${side.unknownReads} reads of an input at a site that the recording does not have: the program took another path`;
  if (side.missedReads > 0) return `${side.missedReads} reads of an input after the recording of its site ended`;
  if (side.ticks !== recording.ticks) return `the replay ended at tick ${side.ticks}, not ${recording.ticks}`;
  if (side.hash !== recording.hash) return `the RAM at the end is not the RAM of the recording (hash ${side.hash}, not ${recording.hash})`;
  return undefined;
}

/** One part of the RAM at the end: the 48K RAM at $4000-$ffff, or one bank of the 128K at $c000-$ffff (the space ram<n>). */
export interface ZxRamPart {
  bank?: number;
  at: number;
  original: Uint8Array;
  rebuild: Uint8Array;
}

/** The RAM of both sides as parts that a person reads with the addresses of the knowledge. */
export function zxRamParts(original: Uint8Array[], rebuild: Uint8Array[]): ZxRamPart[] {
  if (original.length === 3) return [{ at: 0x4000, original: Buffer.concat(original), rebuild: Buffer.concat(rebuild) }];
  return original.map((bytes, bank) => ({ bank, at: 0xc000, original: bytes, rebuild: rebuild[bank]! }));
}

/** The changed ranges of the RAM at the end, in address order, each with its bank on the 128K. */
export function zxRamDifferences(parts: readonly ZxRamPart[]): { changedBytes: number; ranges: Array<ChangedRange & { bank?: number }> } {
  let changedBytes = 0;
  const ranges: Array<ChangedRange & { bank?: number }> = [];
  for (const part of parts) {
    const changed = changedRanges(part.original, part.rebuild, part.at);
    changedBytes += changed.changedBytes;
    for (const range of changed.ranges) ranges.push(part.bank === undefined ? range : { bank: part.bank, ...range });
  }
  return { changedBytes, ranges };
}
