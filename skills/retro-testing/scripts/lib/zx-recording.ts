// Record and replay of a ZX Spectrum program in the replay core zxrun. A record
// file gives the program as a snapshot (.z80 or .sna, or "knowledge": the
// snapshot of the program in the project knowledge) and the steps: frames,
// keys of the keyboard, the Kempston joystick and pictures of the screen. A
// screen step writes <name>.png into the recording folder; a replay makes the
// picture again at the same tick and compares it. The recording holds each read
// of the keyboard port (each even port, the ULA) and of the Kempston port $1F
// by its site, so a replay gives the program the same inputs at the same reads.
// A replay on the original must end at the recorded tick with the recorded RAM;
// a rebuild (its bytes put over the snapshot) must do the same. The RAM banks of
// each side at the end show where a rebuild differs from the original.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import { formatAddress } from "#src/address.ts";
import { Refusal } from "#src/errors.ts";
import { encodePng, SPECTRUM_PALETTE, spectrumScreenFrame } from "#src/graphics.ts";
import { snapshotOfImage } from "#src/host-client/image.ts";
import { readProjectFile } from "#src/host-client/transfer.ts";
import { checkZxSteps, ZX_STEP_FORMS, type ZxScreenStep, type ZxStep } from "#src/host-client/zx-steps.ts";
import { openForRead } from "#src/knowledge/database.ts";
import { programImage, requireProgram } from "#src/knowledge/program.ts";
import { machineOf } from "#src/knowledge/project-machine.ts";
import type { Machine } from "#src/machine.ts";
import { UsageError } from "#src/script.ts";
import { ZX_FRAME_CYCLES, type ZxModel, type ZxRunSession } from "#src/native/zxrun.ts";
import type { Workspace } from "#src/native/staging.ts";
import { readSna, readZ80, writeZ80 } from "#src/spectrum.ts";
import { changedRanges, type ChangedRange } from "./diff.ts";

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** The input ports: the keyboard (the ULA reads each even port; programs use $xxFE) and the Kempston joystick ($xx1F). */
export const ZX_INPUTS = "xxfe,xx1f";

/** The chips key code of each key of the keyboard: the letters and digits, and the special keys. CAPS SHIFT alone is $0E in zxrun. */
const KEY_CODES: Record<string, number> = { space: 0x20, enter: 0x0d, symbol: 0x0f, caps: 0x0e };
for (const char of "abcdefghijklmnopqrstuvwxyz0123456789") KEY_CODES[char] = char.charCodeAt(0);

export type ZxRecordStep = ZxStep | ZxScreenStep;

export interface ZxRecordFile {
  name: string;
  /** A .z80 or .sna file of the project, or "knowledge". */
  program: string;
  steps: ZxRecordStep[];
}

/** The keys of a record file of a C64 program: a ZX Spectrum record file has none of them. */
const C64_KEYS = ["symbols", "load", "checkpoint", "state", "pin", "inputs", "coverage"];

/** test and run start a C64 in VICE: in a project of another machine they refuse before they read a file. */
export function refuseOtherMachine(command: string, machine: Machine): void {
  if (machine.family === "c64") return;
  throw new UsageError(`${command} is for a C64 program, and this project is a ${machine.name} project.`, {
    hint: "Record a session of the snapshot of the program with record. Then replay the recording on the original and on the rebuild with replay.",
  });
}

/**
 * Checks the options of a ZX Spectrum replay before the recording is read:
 * `c64Options` names the C64 options that the call gives; --rebuild and
 * --rebuild-at come together.
 */
export function checkZxReplayOptions(options: { c64Options: readonly string[]; rebuild: string | undefined; at: number | undefined }): void {
  const [c64] = options.c64Options;
  if (c64 !== undefined) throw new UsageError(`--${c64} is for a C64 program. A ZX Spectrum replay compares the screens, the tick and the RAM at the end`);
  if ((options.rebuild === undefined) !== (options.at === undefined)) throw new UsageError("give --rebuild and --rebuild-at together: the bytes of the rebuild and the address of their first byte");
}

/** --out writes the screens of each side, and the RAM of both sides of a rebuild: without screens and without --rebuild it has nothing to write. */
export function checkZxReplayOut(out: string | undefined, rebuild: string | undefined, recording: ZxRecording): void {
  if (out === undefined || rebuild !== undefined || recording.screens.length > 0) return;
  throw new UsageError("--out writes the screens of the recording and the RAM of the original and the rebuild. This recording has no screen step, and --rebuild is missing. Give --rebuild and --rebuild-at too, or leave out --out.");
}

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
  if (typeof file.program !== "string" || (file.program !== "knowledge" && !/\.(z80|sna)$/i.test(file.program))) fail('program must be "knowledge" (the snapshot of the program in the project knowledge), or a .z80 or .sna snapshot of the program, relative to the project folder');
  const steps = checkZxSteps(file.steps, fail, { screen: true });
  // A joystick step only sets the input: without frames, the session has no time and records nothing.
  if (!steps.some((step) => "frames" in step)) fail(`the steps run no frame. Give a frames or a press step, for example ${ZX_STEP_FORMS}`);
  return { name: file.name as string, program: file.program as string, steps };
}

/** The snapshot of the program in the project knowledge: its bytes, the paged banks of a 128K, and its entry state. */
function knowledgeSnapshot() {
  const db = openForRead();
  try {
    const machine = machineOf(db);
    const program = requireProgram(db, machine.spaces.main);
    if (program.state === undefined) {
      throw new Refusal("not-found", 'The project knowledge has no entry state of the program, so it has no snapshot for "program": "knowledge". Put the .z80 snapshot of the program into the project knowledge, or give a .z80 or .sna file as program.');
    }
    const banks = Array.from({ length: 8 }, (_, bank) => bank).flatMap((bank) => {
      if (!machine.spaces.pattern.test(`ram${bank}`)) return [];
      const held = programImage(db, `ram${bank}`);
      return held === undefined ? [] : [{ bank, byteAt: held.byteAt }];
    });
    return snapshotOfImage({ machine: machine.id as "spectrum48" | "spectrum128", main: { segments: program.segments, byteAt: program.byteAt, entry: program.entry ?? 0, state: program.state }, banks }, "the entry state of the knowledge");
  } finally {
    db?.close();
  }
}

/** The snapshot of the program as a .z80 that zxrun loads, and its model. */
function programSnapshot(path: string): { bytes: Uint8Array; model: ZxModel } {
  let snapshot;
  if (path === "knowledge") snapshot = knowledgeSnapshot();
  else {
    const file = readProjectFile(path, { what: "program" });
    snapshot = file.type === "z80" ? readZ80(file.bytes) : readSna(file.bytes);
  }
  // A .sna becomes a .z80; a .z80 is written again, so zxrun loads one format.
  return { bytes: writeZ80(snapshot), model: snapshot.model };
}

/** The screen that the ULA shows now, as a PNG: the bitmap and the attributes of the shown bank, with the border. */
async function screenPng(core: ZxRunSession, workspace: Workspace): Promise<Buffer> {
  const state = await core.status("status");
  const file = workspace.path("screen.bin");
  await core.command(`bank-dump ${state.screen} ${file}`);
  return encodePng(spectrumScreenFrame(readFileSync(file), state.border, state.flash), SPECTRUM_PALETTE);
}

/** The format of a recording folder of a ZX Spectrum program. 2: the timing of zxrun protocol 3, and the screens. */
export const ZX_RECORDING_FORMAT = 2;

export interface ZxRecording {
  format: typeof ZX_RECORDING_FORMAT;
  machine: "spectrum48" | "spectrum128";
  name: string;
  program: string;
  /** The SHA-256 of program.z80 in the recording folder. */
  sha256: string;
  inputs: string;
  steps: ZxRecordStep[];
  ticks: number;
  hash: string;
  sites: Array<{ site: string; port: string; reads: number; rom: boolean }>;
  /** Each screen step: <name>.png of the recording folder, the tick of the picture and the SHA-256 of the PNG. */
  screens: ZxScreen[];
}

export interface ZxScreen {
  name: string;
  tick: number;
  sha256: string;
}

/** The file of a screen in the recording folder. */
export const zxScreenFile = (name: string) => `${name}.png`;

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
export async function zxRecord(core: ZxRunSession, file: ZxRecordFile, workspace: Workspace): Promise<{ recording: ZxRecording; reads: Buffer; coverage: Buffer; program: Uint8Array; pictures: Array<{ name: string; png: Buffer }> }> {
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
  const screens: ZxScreen[] = [];
  const pictures: Array<{ name: string; png: Buffer }> = [];
  for (const step of file.steps) {
    if ("screen" in step) {
      const png = await screenPng(core, workspace);
      screens.push({ name: step.screen, tick, sha256: sha256(png) });
      pictures.push({ name: step.screen, png });
      continue;
    }
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
    format: ZX_RECORDING_FORMAT,
    machine: model === "128k" ? "spectrum128" : "spectrum48",
    name: file.name,
    program: file.program,
    sha256: sha256(bytes),
    inputs: ZX_INPUTS,
    steps: file.steps,
    ticks: end.tick,
    hash: end.hash,
    sites: sites.sites.map((site) => ({ site: formatAddress(site.site), port: formatAddress(site.port), reads: site.reads, rom: site.rom })),
    screens,
  };
  return { recording, reads: readFileSync(reads), coverage: readFileSync(coverage), program: bytes, pictures };
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
  if ((recording.machine !== "spectrum48" && recording.machine !== "spectrum128") || typeof recording.ticks !== "number" || typeof recording.hash !== "string") {
    throw new Refusal("invalid-input", `${folder} has no recording of a ZX Spectrum program. Record the session with record.`);
  }
  if (recording.format !== ZX_RECORDING_FORMAT || !Array.isArray(recording.screens)) {
    throw new Refusal("invalid-input", `${folder} is a recording of an older version of the toolkit, with another timing of the ZX Spectrum. Record the session again.`);
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
  /** The picture of each screen of the recording, and if it is the recorded picture. */
  screens: Array<{ name: string; png: Buffer; same: boolean }>;
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
  const screens: ZxReplaySide["screens"] = [];
  for (const screen of recording.screens) {
    await core.status(`run ${screen.tick}`);
    const png = await screenPng(core, workspace);
    screens.push({ name: screen.name, png, same: sha256(png) === screen.sha256 });
  }
  const end = await core.status(`run ${recording.ticks}`);
  const sites = parseSites(await core.command("sites"));
  const banks: Uint8Array[] = [];
  for (let bank = 0; bank < (recording.machine === "spectrum128" ? 8 : 3); bank++) {
    const file = workspace.path(`bank${bank}.bin`);
    await core.command(`bank-dump ${bank} ${file}`);
    banks.push(readFileSync(file));
  }
  return { ticks: end.tick, hash: end.hash, unknownReads: sites.unknown, missedReads: sites.sites.reduce((sum, site) => sum + (site.misses ?? 0), 0), banks, screens };
}

/** The verdict of one side: SAME, or the reason why it is not. */
export function zxVerdict(recording: ZxRecording, side: Omit<ZxReplaySide, "banks">): string | undefined {
  if (side.unknownReads > 0) return `${side.unknownReads} reads of an input at a site that the recording does not have: the program took another path`;
  if (side.missedReads > 0) return `${side.missedReads} reads of an input after the recording of its site ended`;
  const screen = side.screens.find((item) => !item.same);
  if (screen !== undefined) return `the screen ${screen.name} at tick ${recording.screens.find((item) => item.name === screen.name)!.tick} is not the screen of the recording`;
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
