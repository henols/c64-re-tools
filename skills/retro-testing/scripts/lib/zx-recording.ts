// Record and replay of a ZX Spectrum program in the replay core zxrun. A record
// file gives the program as a snapshot (.z80 or .sna) and the steps: frames,
// keys of the keyboard and the Kempston joystick. The recording holds each read
// of the keyboard port (each even port, the ULA) and of the Kempston port $1F
// by its site, so a replay gives the program the same inputs at the same reads.
// A replay on the original must end at the recorded tick with the recorded RAM;
// a rebuild (its bytes put over the snapshot) must do the same.

import { readFileSync, writeFileSync } from "node:fs";

import { formatAddress } from "#src/address.ts";
import { Refusal } from "#src/errors.ts";
import { readProjectFile } from "#src/host-client/transfer.ts";
import { ZX_FRAME_CYCLES, type ZxModel, type ZxRunSession } from "#src/native/zxrun.ts";
import type { Workspace } from "#src/native/staging.ts";
import { readSna, readZ80, writeZ80 } from "#src/spectrum.ts";

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** The input ports: the keyboard (the ULA reads each even port; programs use $xxFE) and the Kempston joystick ($xx1F). */
export const ZX_INPUTS = "xxfe,xx1f";
const KEY_FRAMES = 3;
const MAX_FRAMES = 1_000_000;

/** The chips key code of each key of the keyboard: the letters and digits, and the special keys. CAPS SHIFT alone is $0E in zxrun. */
const KEY_CODES: Record<string, number> = { space: 0x20, enter: 0x0d, symbol: 0x0f, caps: 0x0e };
for (const char of "abcdefghijklmnopqrstuvwxyz0123456789") KEY_CODES[char] = char.charCodeAt(0);

export type ZxStep = { frames: number } | { press: string[]; frames: number } | { joystick: { up: boolean; down: boolean; left: boolean; right: boolean; fire: boolean } };

export interface ZxRecordFile {
  name: string;
  program: string;
  steps: ZxStep[];
}

/** Reads and checks a record file of a ZX Spectrum program. */
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
  if (typeof file.name !== "string" || file.name === "") fail("name must be a text");
  if (typeof file.program !== "string" || !/\.(z80|sna)$/i.test(file.program)) fail("program must be a .z80 or .sna snapshot of the program, relative to the project folder");
  if (!Array.isArray(file.steps) || file.steps.length === 0) fail("steps must be a list of at least one step");
  const steps = (file.steps as unknown[]).map((value, index): ZxStep => {
    const step = isObject(value) ? value : fail(`step ${index + 1} is not an object`);
    const frames = (given: unknown, fallback?: number) => {
      const count = given ?? fallback;
      if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > MAX_FRAMES) fail(`step ${index + 1}: frames must be 1 to ${MAX_FRAMES}`);
      return count as number;
    };
    if ("press" in step) {
      const keys = Array.isArray(step.press) ? step.press : fail(`step ${index + 1}: press must be a list of keys`);
      if (keys.length === 0 || keys.length > 8 || !keys.every((key) => typeof key === "string" && key in KEY_CODES)) fail(`step ${index + 1}: press takes 1 to 8 keys: a-z, 0-9, space, enter, caps or symbol`);
      return { press: keys as string[], frames: frames(step.frames, KEY_FRAMES) };
    }
    if ("joystick" in step) {
      const stick = step.joystick === null ? {} : isObject(step.joystick) ? step.joystick : fail(`step ${index + 1}: joystick must be an object of up, down, left, right and fire, or null`);
      const bit = (name: string) => stick[name] === true;
      return { joystick: { up: bit("up"), down: bit("down"), left: bit("left"), right: bit("right"), fire: bit("fire") } };
    }
    if ("frames" in step) return { frames: frames(step.frames) };
    return fail(`step ${index + 1} must be frames, press or joystick`);
  });
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
  inputs: string;
  steps: ZxStep[];
  ticks: number;
  hash: string;
  sites: Array<{ site: string; port: string; reads: number; rom: boolean }>;
}

export const ZX_RECORDING_FILES = { recording: "recording.json", reads: "reads.txt", coverage: "coverage.bin", program: "program.z80" } as const;

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
  const recording = JSON.parse(readProjectFile(`${folder}/${ZX_RECORDING_FILES.recording}`, { what: "<recording>" }).bytes.toString("utf8")) as Partial<ZxRecording>;
  if (recording.format !== 1 || (recording.machine !== "spectrum48" && recording.machine !== "spectrum128") || typeof recording.ticks !== "number" || typeof recording.hash !== "string") {
    throw new Refusal("invalid-input", `${folder} has no recording of a ZX Spectrum program: record it with testing.ts record.`);
  }
  return recording as ZxRecording;
}

export interface ZxReplaySide {
  ticks: number;
  hash: string;
  /** Reads at a site that the recording does not have, and reads after the recording of a site ended. */
  unknownReads: number;
  missedReads: number;
}

/** Replays the recording on the snapshot of the recording folder, with the bytes of a rebuild over it when given. */
export async function zxReplay(core: ZxRunSession, folder: string, recording: ZxRecording, workspace: Workspace, rebuild?: { bytes: Uint8Array; at: number }): Promise<ZxReplaySide> {
  const program = workspace.path("program.z80");
  writeFileSync(program, readProjectFile(`${folder}/${ZX_RECORDING_FILES.program}`, { what: "<recording>" }).bytes);
  const reads = workspace.path("reads.txt");
  writeFileSync(reads, readProjectFile(`${folder}/${ZX_RECORDING_FILES.reads}`, { what: "<recording>" }).bytes);
  await core.init(recording.machine === "spectrum128" ? "128k" : "48k");
  await core.loadZ80(program);
  if (rebuild !== undefined) {
    if (rebuild.at < 0x4000 || rebuild.at + rebuild.bytes.length > 0x10000) throw new Refusal("invalid-input", `The rebuild of ${rebuild.bytes.length} bytes at ${formatAddress(rebuild.at)} is not inside the RAM, $4000-$ffff.`);
    await core.write(rebuild.at, rebuild.bytes);
  }
  await core.command(`inputs ${recording.inputs}`);
  await core.command(`replay ${reads}`);
  const end = await core.status(`run ${recording.ticks}`);
  const sites = parseSites(await core.command("sites"));
  return { ticks: end.tick, hash: end.hash, unknownReads: sites.unknown, missedReads: sites.sites.reduce((sum, site) => sum + (site.misses ?? 0), 0) };
}

/** The verdict of one side: SAME, or the reason why it is not. */
export function zxVerdict(recording: ZxRecording, side: ZxReplaySide): string | undefined {
  if (side.unknownReads > 0) return `${side.unknownReads} reads of an input at a site that the recording does not have: the program took another path`;
  if (side.missedReads > 0) return `${side.missedReads} reads of an input after the recording of its site ended`;
  if (side.ticks !== recording.ticks) return `the replay ended at tick ${side.ticks}, not ${recording.ticks}`;
  if (side.hash !== recording.hash) return `the RAM at the end is not the RAM of the recording (hash ${side.hash}, not ${recording.hash})`;
  return undefined;
}
