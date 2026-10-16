// The c64-testing diff script (D77): what changed between two machine states.
// Two snapshot files are restored one after the other in an own emulator,
// which reads RAM, colour RAM and the chip and CPU registers with the readers
// that the runs use: VICE reads its own snapshot format. Two memory files of a
// run, or two observations of runs (also two of one run), compare as they are.
// Exit status: 0, or 2 for a bad call.

import { parseArgs } from "node:util";

import { formatC64Address, parseC64Address } from "#src/c64.ts";
import { WireFailure } from "#src/host-client/tools.ts";
import { readProjectFile, writeProjectFile } from "#src/host-client/transfer.ts";
import { readMemoryInParts, ViceSessionClient } from "#src/host-client/vice-session.ts";
import { resolveProjectPath } from "#src/project.ts";
import { runScript, UsageError } from "#src/script.ts";
import { diffStates, type ChangedRange, type MachineState } from "./lib/diff.ts";

const USAGE = `diff.ts <a> <b> [--gap N] [--max-listed N] [--ntsc] [--at <address>] [--out <file>]

<a> and <b> are two of one kind, relative to the project folder:
  snapshot.vsf             the emulator restores each one and reads RAM, colour
                           RAM, the VIC-II, CIA, SID and CPU registers
  memory.bin               a memory file of a run (observe with memory "all" or
                           a size above 4096); --at gives the address of its
                           first byte when it is shorter than 64 KiB
  results.json:<name>      the observation <name> of a run; both can be in
                           one results.json

  --gap N         join changed ranges across at most N equal bytes (default 0)
  --max-listed N  list at most N ranges of each part (default 64)
  --ntsc          the snapshots are of an NTSC machine (default PAL)
  --out <file>    also write all ranges to a project file

The result is one JSON object. Addresses are $ and four hex digits.`;

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
    throw new UsageError(`${file} is not JSON: ${(error as Error).message}`);
  }
  const seen = results.observations?.[name];
  if (seen === undefined) throw new UsageError(`${file} has no observation ${name}; it has ${Object.keys(results.observations ?? {}).join(", ") || "none"}`);
  const observed: Record<string, string> = {};
  for (const [at, value] of Object.entries(seen.memory ?? {})) {
    // A memory item in a file of its own: compare its bytes.
    if (typeof value === "string") observed[at] = value;
    else if (typeof value === "object" && value !== null && typeof (value as { file?: unknown }).file === "string") {
      const folder = file.includes("/") ? file.slice(0, file.lastIndexOf("/") + 1) : "";
      observed[at] = readProjectFile(`${folder}${(value as { file: string }).file}`).bytes.toString("hex");
    }
  }
  const values: Record<string, number> = {};
  for (const [register, value] of Object.entries(seen.registers ?? {})) {
    if (typeof value === "number") values[`cpu.${register}`] = value;
    else if (typeof value === "string" && value.startsWith("$")) values[`cpu.${register}`] = parseC64Address(value);
  }
  return { observed, values };
}

/** The state of a snapshot: restored in the session, then read with the readers of the runs. */
async function snapshotState(client: ViceSessionClient, path: string): Promise<MachineState> {
  await client.snapshotRestore(readProjectFile(path).bytes);
  const memory = await readMemoryInParts(client, 0x0000, 0x10000, "ram");
  const colorRam = Buffer.from((await client.ioRead(0xd800, 0x400)).data, "hex").map((value) => value & 0x0f);
  const vic = Buffer.from((await client.ioRead(0xd000, 0x2f)).data, "hex");
  const values: Record<string, number> = {};
  vic.forEach((value, index) => (values[`vic.${formatC64Address(0xd000 + index)}`] = value));
  for (const chip of (await client.cia("both")).chips) {
    for (const field of ["portA", "portB", "ddrA", "ddrB", "timerA", "timerB", "latchA", "latchB", "controlA", "controlB", "interruptMask"] as const) values[`cia${chip.id}.${field}`] = chip[field];
  }
  const sid = await client.sid();
  for (const voice of sid.voices) for (const [field, value] of Object.entries(voice)) if (field !== "index" && typeof value === "number") values[`sid.voice${voice.index}.${field}`] = value;
  const registers = await client.registersGet("c64");
  for (const [field, value] of Object.entries(registers)) if (typeof value === "number") values[`cpu.${field}`] = value;
  return { memory: { base: 0, bytes: memory }, colorRam, values };
}

const show = (range: ChangedRange) => ({ start: formatC64Address(range.start), end: formatC64Address(range.end), ...(range.a === undefined ? {} : { a: range.a, b: range.b }) });

async function run(argv: string[]): Promise<Record<string, unknown>> {
  const { values, positionals } = parseArgs({
    args: argv,
    strict: true,
    allowPositionals: true,
    options: { gap: { type: "string" }, "max-listed": { type: "string" }, ntsc: { type: "boolean" }, at: { type: "string" }, out: { type: "string" }, help: { type: "boolean" } },
  });
  if (values.help) throw new UsageError("");
  if (positionals.length !== 2) throw new UsageError("give two states to compare");
  const [first, second] = positionals as [string, string];
  const kind = kindOf(first);
  if (kindOf(second) !== kind) throw new UsageError("give two states of one kind: two snapshots, two memory files or two observations");
  const number = (value: string | undefined, fallback: number, what: string) => {
    if (value === undefined) return fallback;
    if (!/^\d+$/.test(value)) throw new UsageError(`${what} must be a whole number`);
    return Number(value);
  };
  const gap = number(values.gap, 0, "--gap");
  const max = number(values["max-listed"], 64, "--max-listed");
  if (values.out !== undefined) {
    try {
      resolveProjectPath(values.out);
    } catch {
      throw new UsageError(`--out must be a path relative to the project folder that stays inside it, not ${values.out}`);
    }
  }
  let a: MachineState;
  let b: MachineState;
  if (kind === "observation") {
    a = observation(first);
    b = observation(second);
  } else if (kind === "memory") {
    let base = 0;
    if (values.at !== undefined) {
      try {
        base = parseC64Address(values.at);
      } catch {
        throw new UsageError(`--at must be $ followed by four hex digits, not ${values.at}`);
      }
    }
    const read = (path: string) => readProjectFile(path).bytes;
    const [left, right] = [read(first), read(second)];
    if (left.length !== right.length) throw new UsageError(`the memory files have ${left.length} and ${right.length} bytes; give two of one size`);
    if (base + left.length > 0x10000) throw new UsageError("the memory file goes past $ffff from --at");
    a = { memory: { base, bytes: left } };
    b = { memory: { base, bytes: right } };
  } else {
    const client = await ViceSessionClient.open({ videoStandard: values.ntsc ? "ntsc" : "pal" });
    try {
      a = await snapshotState(client, first);
      b = await snapshotState(client, second);
    } finally {
      await client.close();
    }
  }
  const diff = diffStates(a, b, gap);
  const part = (item: { changedBytes: number; ranges: ChangedRange[] } | undefined) =>
    item === undefined ? undefined : { changedBytes: item.changedBytes, ranges: item.ranges.length, listed: item.ranges.slice(0, max).map(show) };
  if (values.out !== undefined) {
    const all = { a: first, b: second, ...(diff.memory === undefined ? {} : { memory: diff.memory.ranges.map(show) }), ...(diff.colorRam === undefined ? {} : { colorRam: diff.colorRam.ranges.map(show) }), values: diff.values ?? [], observed: diff.observed ?? [] };
    writeProjectFile(values.out, Buffer.from(`${JSON.stringify(all, null, 2)}\n`), { what: "--out" });
  }
  return {
    a: first,
    b: second,
    ...(diff.memory === undefined ? {} : { memory: part(diff.memory) }),
    ...(diff.colorRam === undefined ? {} : { colorRam: part(diff.colorRam) }),
    ...(diff.values === undefined ? {} : { registers: diff.values.slice(0, max) }),
    ...(diff.observed === undefined ? {} : { observed: diff.observed.slice(0, max) }),
    ...(values.out === undefined ? {} : { out: values.out }),
  };
}

await runScript(run, { usage: USAGE });
