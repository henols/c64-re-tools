// The diff of c64-testing: what changed between two machine states.
// Two snapshot files are restored one after the other in an own emulator,
// which reads RAM, colour RAM and the chip and CPU registers with the readers
// that the runs use: VICE reads its own snapshot format. Two memory files of a
// run, or two observations of runs (also two of one run), compare as they are.

import { formatC64Address, parseC64Address } from "#src/c64.ts";
import { Refusal } from "#src/errors.ts";
import { isObject } from "#src/host-client/steps.ts";
import { WireFailure } from "#src/host-client/tools.ts";
import { readProjectFile, writeReported } from "#src/host-client/transfer.ts";
import { readMemoryInParts, ViceSessionClient } from "#src/host-client/vice-session.ts";
import { checkSnapshotFile } from "#src/media.ts";
import { listed, UsageError } from "#src/script.ts";
import { snapshotModule } from "#src/vsf.ts";
import { diffStates, type ChangedRange, type MachineState } from "./diff.ts";

type Kind = "snapshot" | "memory" | "observation";

function kindOf(path: string): Kind {
  if (/\.vsf$/i.test(path)) return "snapshot";
  if (/\.json:[^:]+$/.test(path)) return "observation";
  if (/\.bin$/i.test(path)) return "memory";
  throw new UsageError(`${path} is no .vsf, .bin or results.json:<observation>`);
}

/** The state of one observation of a results.json: its memory items and its registers. */
function observation(path: string): MachineState {
  const [file, name] = [path.slice(0, path.lastIndexOf(":")), path.slice(path.lastIndexOf(":") + 1)];
  let results: { observations?: Record<string, { memory?: Record<string, unknown>; registers?: Record<string, unknown> }> };
  try {
    results = JSON.parse(readProjectFile(file).bytes.toString("utf8")) as typeof results;
  } catch (error) {
    if (error instanceof WireFailure) throw error;
    throw new Refusal("invalid-input", `${file} is not JSON: ${(error as Error).message}`);
  }
  const seen = results.observations?.[name];
  if (seen === undefined) throw new Refusal("not-found", `${file} has no observation ${name}. It has ${Object.keys(results.observations ?? {}).join(", ") || "none"}.`);
  const observed: Record<string, string> = {};
  for (const [at, value] of Object.entries(seen.memory ?? {})) {
    // A memory item in a file of its own: compare its bytes.
    if (typeof value === "string") observed[at] = value;
    else if (typeof value === "object" && value !== null && typeof (value as { file?: unknown }).file === "string") {
      const folder = file.includes("/") ? file.slice(0, file.lastIndexOf("/") + 1) : "";
      observed[at] = readProjectFile(`${folder}${(value as { file: string }).file}`).bytes.toString("hex");
    }
  }
  return { observed, values: cpuValues(seen.registers ?? {}) };
}

/** The CPU registers as values: each register by its name, the pc from a number or "$xxxx", and each flag as cpu.flags.<flag>. */
function cpuValues(registers: Record<string, unknown>): Record<string, number | boolean> {
  const values: Record<string, number | boolean> = {};
  for (const [register, value] of Object.entries(registers)) {
    if (typeof value === "number") values[`cpu.${register}`] = value;
    else if (typeof value === "string" && value.startsWith("$")) values[`cpu.${register}`] = parseC64Address(value);
    else if (register === "flags" && isObject(value)) for (const [flag, set] of Object.entries(value)) if (typeof set === "boolean") values[`cpu.flags.${flag}`] = set;
  }
  return values;
}

/**
 * The data of the C64MEM module of a VICE snapshot file: the data and the
 * direction register of the CPU port, the cartridge lines (2 bytes), then
 * the 64 KiB of RAM. Undefined when the file has no such module.
 */
function c64Memory(file: Uint8Array): Buffer | undefined {
  const data = snapshotModule(Buffer.from(file), "C64MEM")?.data;
  return data !== undefined && data.length >= 4 + 0x10000 ? data.subarray(0, 4 + 0x10000) : undefined;
}

/** The 64 KiB of C64 RAM that a VICE snapshot file holds, also the RAM under the CPU port at $00/$01. Undefined when the file has no C64MEM module. */
export function snapshotRam(file: Uint8Array): Uint8Array | undefined {
  return c64Memory(file)?.subarray(4);
}

/** The CPU port of a VICE snapshot file: the direction register ($00) and the data register ($01). Undefined when the file has no C64MEM module. */
export function snapshotCpuPort(file: Uint8Array): { direction: number; data: number } | undefined {
  const memory = c64Memory(file);
  return memory === undefined ? undefined : { data: memory[0]!, direction: memory[1]! };
}

/**
 * The state of a snapshot: restored in the session, then read with the
 * readers of the runs. The RAM must be the RAM of the file: else the
 * snapshot did not restore, and the state would be wrong.
 */
async function snapshotState(client: ViceSessionClient, path: string, ntsc: boolean): Promise<MachineState> {
  const file = readProjectFile(path).bytes;
  const saved = snapshotRam(file);
  if (saved === undefined) throw new Refusal("invalid-input", `${path} is not a snapshot of a C64: it has no C64 memory. Give a file that a snapshot save in the emulator or a save step of a run wrote.`);
  const restored = await client.snapshotRestore(file);
  const memory = await readMemoryInParts(client, 0x0000, 0x10000, "ram");
  // $00 and $01 are the CPU port: the file keeps them apart from the RAM.
  if (("restored" in restored && !restored.restored) || !memory.subarray(2).equals(Buffer.from(saved.subarray(2)))) {
    throw new Refusal(
      "invalid-input",
      `${path} did not restore: the RAM after the restore is not the RAM of the file. A snapshot restores only in a machine of the video standard that saved it. ${ntsc ? "Leave out --ntsc for a PAL snapshot" : "Give --ntsc for an NTSC snapshot"}, or use the emulator version that saved it.`,
    );
  }
  // $00 and $01 are the CPU port of the file, not the RAM under it: a program reads and writes the port there.
  const port = snapshotCpuPort(file)!;
  memory[0] = port.direction;
  memory[1] = port.data;
  const colorRam = Buffer.from((await client.ioRead(0xd800, 0x400)).data, "hex").map((value) => value & 0x0f);
  const vic = Buffer.from((await client.ioRead(0xd000, 0x2f)).data, "hex");
  const values: Record<string, number | boolean> = {};
  vic.forEach((value, index) => (values[`vic.${formatC64Address(0xd000 + index)}`] = value));
  for (const chip of (await client.cia("both")).chips) {
    for (const field of ["portA", "portB", "ddrA", "ddrB", "timerA", "timerB", "latchA", "latchB", "controlA", "controlB", "interruptMask"] as const) values[`cia${chip.id}.${field}`] = chip[field];
  }
  const sid = await client.sid();
  for (const voice of sid.voices) for (const [field, value] of Object.entries(voice)) if (field !== "index" && typeof value === "number") values[`sid.voice${voice.index}.${field}`] = value;
  Object.assign(values, cpuValues({ ...(await client.registersGet("c64")) }));
  return { memory: { base: 0, bytes: memory }, colorRam, values };
}

const show = (range: ChangedRange) => ({ start: formatC64Address(range.start), end: formatC64Address(range.end), ...(range.a === undefined ? {} : { a: range.a, b: range.b }) });
/** A changed value as a person reads it: the pc as "$xxxx". */
const showValue = (item: { name: string; a: number | boolean; b: number | boolean }) => (item.name === "cpu.pc" && typeof item.a === "number" && typeof item.b === "number" ? { name: item.name, a: formatC64Address(item.a), b: formatC64Address(item.b) } : item);

/**
 * How many items two observations have in common, by name: the items that the
 * diff compared. With none, the reason names what each side has, so that a
 * count of 0 does not read as "equal".
 */
export function comparedItems(what: string, a: readonly string[], b: readonly string[], first: string, second: string): { compared: number; reason?: string } {
  const compared = a.filter((name) => b.includes(name)).length;
  if (compared > 0) return { compared };
  const has = (names: readonly string[]) => (names.length === 0 ? "none" : names.join(", "));
  return { compared, reason: `No ${what} was compared: the observations have none in common. ${first} has ${has(a)}; ${second} has ${has(b)}.` };
}

/** The differences of two states of one kind: snapshots, memory files or observations of runs. */
export async function diffFiles(first: string, second: string, options: { gap: number; max: number; ntsc: boolean; at?: number; out?: string }): Promise<Record<string, unknown>> {
  const kind = kindOf(first);
  if (kindOf(second) !== kind) throw new UsageError("The two states are not of one kind. Give two snapshot files, two memory files or two observations.");
  if (options.at !== undefined && kind !== "memory") throw new UsageError(`--address is only for two memory files (.bin). ${kind === "snapshot" ? "A snapshot file holds all 64 KiB" : "An observation gives the address of each item"}: leave out --address.`);
  if (options.ntsc && kind !== "snapshot") throw new UsageError(`--ntsc is only for two snapshot files (.vsf), which restore in an emulator. ${kind === "memory" ? "Memory files" : "Observations"} compare as they are: leave out --ntsc.`);
  const { gap, max } = options;
  let a: MachineState;
  let b: MachineState;
  if (kind === "observation") {
    a = observation(first);
    b = observation(second);
  } else if (kind === "memory") {
    const base = options.at ?? 0;
    const read = (path: string) => readProjectFile(path).bytes;
    const [left, right] = [read(first), read(second)];
    if (left.length !== right.length) throw new UsageError(`The memory files have ${left.length} and ${right.length} bytes. Give two files of one size.`);
    if (base + left.length > 0x10000) throw new UsageError("The memory file goes past $ffff from --address. Give a lower --address.");
    a = { memory: { base, bytes: left } };
    b = { memory: { base, bytes: right } };
  } else {
    // Both files are snapshot files before the emulator starts.
    for (const path of [first, second]) checkSnapshotFile(path, readProjectFile(path).bytes);
    const client = await ViceSessionClient.open({ videoStandard: options.ntsc ? "ntsc" : "pal" });
    try {
      a = await snapshotState(client, first, options.ntsc);
      b = await snapshotState(client, second, options.ntsc);
    } finally {
      await client.close();
    }
  }
  const diff = diffStates(a, b, gap);
  const rest = options.out ?? "a larger --max-listed, or --out <file>";
  const part = (item: { changedBytes: number; ranges: ChangedRange[] } | undefined) => (item === undefined ? undefined : { changedBytes: item.changedBytes, ...listed(item.ranges, max, show, rest) });
  let written: ReturnType<typeof writeReported> | undefined;
  if (options.out !== undefined) {
    // The names of the result: registers holds the changed values.
    const all = { a: first, b: second, ...(diff.memory === undefined ? {} : { memory: diff.memory.ranges.map(show) }), ...(diff.colorRam === undefined ? {} : { colorRam: diff.colorRam.ranges.map(show) }), registers: (diff.values ?? []).map(showValue), observed: diff.observed ?? [] };
    written = writeReported(options.out, `${JSON.stringify(all, null, 2)}\n`, { what: "--out" });
  }
  return {
    a: first,
    b: second,
    ...(diff.memory === undefined ? {} : { memory: part(diff.memory) }),
    ...(diff.colorRam === undefined ? {} : { colorRam: part(diff.colorRam) }),
    ...(diff.values === undefined ? {} : { registers: { ...(kind === "observation" ? comparedItems("register", Object.keys(a.values ?? {}), Object.keys(b.values ?? {}), first, second) : {}), ...listed(diff.values, max, showValue, rest) } }),
    ...(diff.observed === undefined ? {} : { observed: { ...comparedItems("memory item", Object.keys(a.observed ?? {}), Object.keys(b.observed ?? {}), first, second), ...listed(diff.observed, max, undefined, rest) } }),
    ...(written === undefined ? {} : written),
  };
}
