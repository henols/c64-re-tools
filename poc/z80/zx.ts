// The Z80 proof of concept: a ZX Spectrum 48K program in the replay core
// (zxrun), in Ghidra with its Z80 language, and in a live emulator (ZEsarUX
// over ZRCP). One JSON object on stdout per call.
//
//   zx.ts snapshot <out.z80>                       the fixture program as a .z80 snapshot
//   zx.ts record <in.z80> --out <dir> [--frames N] [--key <hex>@<frame>+<frames>]...
//   zx.ts replay <dir>                             replays a recording, checks it is the same
//   zx.ts analyze <dir>                            Ghidra Z80 seeded by the recorded coverage
//   zx.ts live <in.z80> [--out <dir>]              the ZRCP operations, each with ok/failed
//   zx.ts compare <in.z80>                         zxrun and ZEsarUX at the same breakpoint hits

import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { COVERAGE } from "../../src/c64.ts";
import { coverageSeedKinds } from "../../src/cpu/coverage.ts";
import { Z80 } from "../../src/cpu/z80.ts";
import { ZX48 } from "../../src/machine.ts";
import { findTool, ZESARUX } from "../../src/native/discover.ts";
import { analyze } from "../../src/native/ghidra/analyze.ts";
import { localToolContext } from "../../src/native/local.ts";
import { ZX48_FRAME_CYCLES, ZxRunSession, type ZxStatus } from "../../src/native/zxrun.ts";
import { COUNT, keyboardCounterSnapshot, PRESSES } from "../../test/fixtures/z80/keyboard-counter.ts";
import { freePort, Zrcp } from "./zrcp.ts";

/** The ports that record and replay handle: every keyboard row (any port with the low byte $FE) and Kempston ($1F). */
const INPUTS = "xxfe,001f";

interface KeyStep {
  code: number;
  from: number;
  frames: number;
}

function option(argv: string[], name: string): string[] {
  const values: string[] = [];
  for (let at = 0; at < argv.length; at++) if (argv[at] === `--${name}` && argv[at + 1] !== undefined) values.push(argv[++at]!);
  return values;
}

function keySteps(argv: string[]): KeyStep[] {
  return option(argv, "key").map((text) => {
    const match = /^([0-9a-f]{1,2})@(\d+)\+(\d+)$/i.exec(text);
    if (match === null) throw new Error(`--key ${text}: give <hex code>@<frame>+<frames>, for example 20@10+5 (SPACE)`);
    return { code: Number.parseInt(match[1]!, 16), from: Number(match[2]), frames: Number(match[3]) };
  });
}

async function record(snapshot: string, out: string, frames: number, keys: KeyStep[]) {
  mkdirSync(out, { recursive: true });
  copyFileSync(snapshot, join(out, "snapshot.z80"));
  const core = await ZxRunSession.open(localToolContext());
  try {
    await core.init();
    await core.command(`inputs ${INPUTS}`);
    const start = await core.loadZ80(join(out, "snapshot.z80"));
    await core.command("coverage on");
    await core.command(`record ${join(out, "reads.txt")}`);
    for (let frame = 0; frame < frames; frame++) {
      for (const key of keys) {
        if (key.from === frame) await core.command(`key ${key.code.toString(16)} down`);
        if (key.from + key.frames === frame) await core.command(`key ${key.code.toString(16)} up`);
      }
      await core.status(`run ${(frame + 1) * ZX48_FRAME_CYCLES}`);
    }
    const end = await core.status("status");
    const sites = await core.command("sites");
    await core.command("record off");
    await core.command(`coverage ${join(out, "coverage.bin")}`);
    await core.command(`io-coverage ${join(out, "io-coverage.bin")}`);
    await core.command(`ram-dump ${join(out, "image.bin")}`);
    const recording = { frames, keys, inputs: INPUTS, start: { pc: start.pc }, end: { tick: end.tick, hash: end.hash } };
    writeFileSync(join(out, "recording.json"), `${JSON.stringify(recording, null, 2)}\n`);
    const ram = await core.peek(PRESSES, 3);
    return { recording, presses: ram[0], pressesIx: ram[1], framesSeen: ram[2], sites: sites.split(" ").slice(2) };
  } finally {
    await core.close();
  }
}

async function replay(dir: string) {
  const recording = JSON.parse(readFileSync(join(dir, "recording.json"), "utf8")) as { inputs: string; end: { tick: number; hash: string } };
  const core = await ZxRunSession.open(localToolContext());
  try {
    await core.init();
    await core.command(`inputs ${recording.inputs}`);
    await core.loadZ80(join(dir, "snapshot.z80"));
    const loaded = await core.command(`replay ${join(dir, "reads.txt")}`);
    const end = await core.status(`run ${recording.end.tick}`);
    const sites = await core.command("sites");
    const unknown = Number(/unknown=(\d+)/.exec(sites)?.[1]);
    const misses = sites
      .split(" ")
      .slice(2)
      .reduce((sum, site) => sum + Number(site.split(":")[4] ?? 0), 0);
    const same = end.tick === recording.end.tick && end.hash === recording.end.hash && unknown === 0 && misses === 0;
    return { result: same ? "SAME" : "DIFFERENT", loaded, recorded: recording.end, replayed: { tick: end.tick, hash: end.hash }, unknown, misses };
  } finally {
    await core.close();
  }
}

async function analyzeRecording(dir: string) {
  const image = readFileSync(join(dir, "image.bin"));
  const map = readFileSync(join(dir, "coverage.bin"));
  const byteAt = (address: number) => (address >= 0 && address < image.length ? image[address] : undefined);
  const { routines, codeStarts } = coverageSeedKinds(map, byteAt, Z80);
  const { result } = await analyze({ imageKind: "flat64k", entryPoints: routines, codeStarts, dataRanges: [], labels: [], decompile: routines.slice(0, 2) }, image, localToolContext(), ZX48);
  // Our decoder against Ghidra's: the same length and the same text for each instruction in RAM.
  const ram = result.instructions.filter((instruction) => instruction.address >= 0x4000);
  let sameLength = 0;
  const differentText: string[] = [];
  for (const instruction of ram) {
    const ours = Z80.decode(byteAt, instruction.address)!;
    if (ours.length * 2 === instruction.bytes.length) sameLength++;
    const theirs = `${instruction.mnemonic} ${instruction.operands}`.trim();
    if (normalized(theirs) !== normalized(ours.text ?? "")) differentText.push(`${instruction.address.toString(16)}: ghidra "${theirs}" ours "${ours.text}"`);
  }
  const byKind: Record<string, number> = {};
  for (const reference of result.references) byKind[reference.type] = (byKind[reference.type] ?? 0) + 1;
  const executedRam = [...map.entries()].filter(([address, flags]) => address >= 0x4000 && (flags & COVERAGE.ramExecute) !== 0).length;
  return {
    seeds: { routines: routines.map(hex), codeStarts: codeStarts.map(hex) },
    executedRam,
    functions: result.functions.filter((fn) => fn.entry >= 0x4000).map((fn) => `${hex(fn.entry)} ${fn.name}`),
    romFunctions: result.functions.filter((fn) => fn.entry < 0x4000).length,
    regions: result.regions.filter((region) => region.end >= 0x4000).map((region) => `${hex(region.start)}-${hex(region.end)} ${region.classification}`),
    references: byKind,
    ramReferences: result.references.filter((reference) => reference.from >= 0x4000).map((reference) => `${hex(reference.from)} ${reference.type} ${hex(reference.to)}`),
    instructions: { ram: ram.length, sameLength, differentText },
    decompilations: result.decompilations.map((item) => item.text.split("\n").slice(0, 12).join("\n")),
  };
}

/** Ghidra and our text differ in spelling only: case, spaces, 0x, and the hex form of numbers. */
function normalized(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/0x([0-9a-f]+)/g, (_, digits: string) => `$${Number.parseInt(digits, 16).toString(16)}`)
    .replace(/\$0*([0-9a-f]+)/g, (_, digits: string) => `$${digits}`);
}

const hex = (value: number) => `$${value.toString(16).padStart(4, "0")}`;

/**
 * Starts ZEsarUX headless with ZRCP through the supervisor: its process group
 * stops with this script. It runs in a directory of its own, because it writes
 * a menu index file into its working directory.
 */
async function startZesarux() {
  const context = localToolContext();
  const path = findTool(ZESARUX, process.env);
  const port = await freePort();
  const cwd = mkdtempSync(join(tmpdir(), "c64-re-tools-zesarux-"));
  const started = Date.now();
  const process_ = context.supervisor.spawn(
    [path, "--noconfigfile", "--machine", "48k", "--vo", "null", "--ao", "null", "--nowelcomemessage", "--quickexit", "--enable-remoteprotocol", "--remoteprotocol-port", String(port)],
    { stdio: ["ignore", "pipe", "pipe"], cwd },
  );
  const emulator = {
    stop: async () => {
      await process_.stop();
      rmSync(cwd, { recursive: true, force: true });
    },
  };
  try {
    const { zrcp } = await Zrcp.connect(port);
    return { zrcp, emulator, startMs: Date.now() - started };
  } catch (error) {
    await emulator.stop();
    throw error;
  }
}

const REGISTERS = /PC=([0-9a-f]{4}) SP=([0-9a-f]{4}) AF=([0-9a-f]{4}) BC=([0-9a-f]{4}) HL=([0-9a-f]{4}) DE=([0-9a-f]{4}) IX=([0-9a-f]{4}) IY=([0-9a-f]{4})/i;

function registersOf(text: string) {
  const match = REGISTERS.exec(text);
  if (match === null) throw new Error(`no registers in ${JSON.stringify(text.slice(0, 200))}`);
  const [pc, sp, af, bc, hl, de, ix, iy] = match.slice(1).map((value) => Number.parseInt(value, 16));
  return { pc: pc!, sp: sp!, af: af!, bc: bc!, hl: hl!, de: de!, ix: ix!, iy: iy! };
}

/** The ZRCP keyboard rows with SPACE down ($7FFE bit 0), or none. */
const NO_KEYS = "ffffffffffffffff00";
const SPACE_DOWN = "ffffffffffffff1e00";

async function live(snapshot: string, out: string) {
  mkdirSync(out, { recursive: true });
  const steps: Array<{ operation: string; result: "ok" | "failed"; ms: number; detail?: unknown }> = [];
  const step = async (operation: string, run: () => Promise<unknown>) => {
    const started = Date.now();
    try {
      const detail = await run();
      steps.push({ operation, result: "ok", ms: Date.now() - started, ...(detail === undefined ? {} : { detail }) });
    } catch (error) {
      steps.push({ operation, result: "failed", ms: Date.now() - started, detail: error instanceof Error ? error.message : String(error) });
    }
  };
  const { zrcp, emulator, startMs } = await startZesarux();
  const expect = (condition: boolean, text: string) => {
    if (!condition) throw new Error(text);
  };
  try {
    await step("version", async () => zrcp.command("get-version"));
    await step("load snapshot (smartload)", async () => {
      await zrcp.command("enter-cpu-step");
      await zrcp.command(`smartload ${resolve(snapshot)}`);
      const registers = registersOf(await zrcp.command("get-registers"));
      expect(registers.pc === 0x8000, `pc is ${hex(registers.pc)}`);
      return { pc: hex(registers.pc) };
    });
    await step("start cpu history and visual memory", async () => {
      await zrcp.command("cpu-history enabled yes");
      await zrcp.command("cpu-history started yes");
      await zrcp.command("get-visualmem-opcode-dump");
      await zrcp.command("get-visualmem-read-dump");
      await zrcp.command("get-visualmem-written-dump");
    });
    await step("breakpoint at COUNT, key input, run until it fires", async () => {
      await zrcp.command("enable-breakpoints");
      expect((await zrcp.command(`set-breakpoint 1 PC=${COUNT.toString(16)}H`)) === "", "set-breakpoint failed");
      await zrcp.command(`set-ui-io-ports ${SPACE_DOWN}`);
      const answer = await zrcp.command("run 1000000");
      const registers = registersOf(answer);
      expect(registers.pc === COUNT, `stopped at ${hex(registers.pc)}: ${answer.split("\n")[1]}`);
      return answer.split("\n")[1];
    });
    await step("step one instruction", async () => {
      const registers = registersOf(await zrcp.command("cpu-step"));
      expect(registers.pc === COUNT + 3, `pc is ${hex(registers.pc)}`);
      return { pc: hex(registers.pc) };
    });
    await step("read and write memory", async () => {
      await zrcp.command("write-memory 9100H 1 2 3");
      const read = await zrcp.command("read-memory 9100H 3");
      expect(read === "010203", `read ${read}`);
      return { counters: await zrcp.command(`read-memory ${PRESSES.toString(16)}H 3`) };
    });
    await step("set a register", async () => {
      await zrcp.command("set-register DE=3344H");
      const registers = registersOf(await zrcp.command("get-registers"));
      expect(registers.de === 0x3344, `DE is ${hex(registers.de)}`);
    });
    await step("memory breakpoint (write watchpoint) on the counter", async () => {
      await zrcp.command("disable-breakpoint 1");
      await zrcp.command(`set-membreakpoint ${(PRESSES + 1).toString(16)}H 2`);
      const answer = await zrcp.command("run 1000000");
      await zrcp.command(`set-membreakpoint ${(PRESSES + 1).toString(16)}H 0`);
      const registers = registersOf(answer);
      // The breakpoint fires after the writing instruction: INC (IX+1) at $803d is 3 bytes.
      expect(registers.pc === 0x8040, `stopped at ${hex(registers.pc)}: ${answer.split("\n")[1]}`);
      return answer.split("\n")[1];
    });
    await step("cpu history", async () => {
      const size = Number(await zrcp.command("cpu-history get-size"));
      const pcs = await zrcp.command("cpu-history get-pc 0 6");
      expect(size > 0, "empty history");
      return { size, last: pcs };
    });
    await step("execution and access maps (visual memory)", async () => {
      const executed = visualmem(await zrcp.command("get-visualmem-opcode-dump"));
      const written = visualmem(await zrcp.command("get-visualmem-written-dump"));
      const read = visualmem(await zrcp.command("get-visualmem-read-dump"));
      const ram = (set: Set<number>) => [...set].filter((address) => address >= 0x4000);
      writeFileSync(join(out, "visualmem-executed.json"), JSON.stringify([...executed]));
      expect(executed.has(COUNT), "COUNT not executed");
      return { executedRam: ram(executed).length, executedRom: executed.size - ram(executed).length, writtenRam: ram(written).length, readRam: ram(read).length };
    });
    await step("cpu code coverage", async () => {
      await zrcp.command("cpu-code-coverage enabled yes");
      await zrcp.command("run 20000");
      const addresses = (await zrcp.command("cpu-code-coverage get")).split(/\s+/).filter((text) => text !== "");
      return { addresses: addresses.length, ram: addresses.filter((text) => Number.parseInt(text, 16) >= 0x4000).length };
    });
    await step("screen capture (BMP)", async () => {
      const file = join(resolve(out), "screen.bmp");
      await zrcp.command(`save-screen ${file}`);
      const bytes = readFileSync(file);
      expect(bytes.subarray(0, 2).toString("latin1") === "BM", "no BMP");
      return { bytes: bytes.length };
    });
    // ZEsarUX 13.0 writes E as $7f into a .z80 file; its own .zsf keeps every register.
    for (const format of ["zsf", "z80"]) {
      await step(`save a .${format} snapshot and load it back`, async () => {
        const file = join(resolve(out), `saved.${format}`);
        const before = registersOf(await zrcp.command("get-registers"));
        const memory = await zrcp.command(`read-memory ${PRESSES.toString(16)}H 3`);
        await zrcp.command(`snapshot-save ${file}`);
        await zrcp.command(`set-ui-io-ports ${NO_KEYS}`);
        await zrcp.command("run 50000");
        await zrcp.command(`snapshot-load ${file}`);
        const after = registersOf(await zrcp.command("get-registers"));
        const memoryAfter = await zrcp.command(`read-memory ${PRESSES.toString(16)}H 3`);
        expect(JSON.stringify(before) === JSON.stringify(after) && memory === memoryAfter, `before ${JSON.stringify(before)} ${memory}, after ${JSON.stringify(after)} ${memoryAfter}`);
        return { pc: hex(after.pc), counters: memoryAfter };
      });
    }
    await step("hard reset (hard-reset-cpu)", async () => {
      await zrcp.command("hard-reset-cpu");
      await zrcp.command("cpu-step");
      const registers = registersOf(await zrcp.command("get-registers"));
      expect(registers.pc < 0x4000, `pc is ${hex(registers.pc)}: no reset`);
    });
    await step("reset (reset-cpu, then close-all-menus before step mode)", async () => {
      await zrcp.command("exit-cpu-step");
      await zrcp.command("reset-cpu");
      // After reset-cpu, ZEsarUX refuses step mode ("closing the menu") until close-all-menus.
      const refused = await zrcp.command("enter-cpu-step");
      await zrcp.command("close-all-menus");
      const entered = await zrcp.command("enter-cpu-step");
      expect(entered === "", `enter-cpu-step: ${entered}`);
      const registers = registersOf(await zrcp.command("get-registers"));
      expect(registers.pc < 0x4000, `pc is ${hex(registers.pc)}`);
      return { pc: hex(registers.pc), withoutCloseAllMenus: refused };
    });
  } finally {
    await zrcp.command("exit-emulator", 3_000).catch(() => {});
    zrcp.close();
    await emulator.stop();
  }
  return { startMs, steps };
}

/** Parses a visual memory dump ("8000H 1 1" or "8000H 1"): the addresses with a count above 0. */
function visualmem(text: string): Set<number> {
  const addresses = new Set<number>();
  for (const line of text.split("\n")) {
    const match = /^([0-9a-f]+)H((?:\s+\d+)+)/i.exec(line.trim());
    if (match === null) continue;
    const start = Number.parseInt(match[1]!, 16);
    match[2]!
      .trim()
      .split(/\s+/)
      .forEach((count, offset) => Number(count) > 0 && addresses.add(start + offset));
  }
  return addresses;
}

/** The fixture at the n-th entry to COUNT in zxrun and in ZEsarUX, with SPACE held from the start. */
async function compare(snapshot: string, hits: number) {
  const core = await ZxRunSession.open(localToolContext());
  const fromCore: Array<{ state: ZxStatus; counters: number[] }> = [];
  try {
    await core.init();
    await core.loadZ80(resolve(snapshot));
    await core.command("key 20 down");
    for (let hit = 0; hit < hits; hit++) {
      const state = await core.status(`run-pc ${COUNT.toString(16)} ${(hit + 2) * 10 * ZX48_FRAME_CYCLES}`);
      fromCore.push({ state, counters: [...(await core.peek(PRESSES, 3))] });
    }
  } finally {
    await core.close();
  }
  const { zrcp, emulator } = await startZesarux();
  const fromLive: Array<{ registers: ReturnType<typeof registersOf>; counters: number[]; frameTstates: number }> = [];
  try {
    await zrcp.command("enter-cpu-step");
    await zrcp.command(`smartload ${resolve(snapshot)}`);
    await zrcp.command("enable-breakpoints");
    await zrcp.command(`set-breakpoint 1 PC=${COUNT.toString(16)}H`);
    await zrcp.command(`set-ui-io-ports ${SPACE_DOWN}`);
    for (let hit = 0; hit < hits; hit++) {
      // The run starts on the breakpoint after the first hit: one step leaves it.
      if (hit > 0) await zrcp.command("cpu-step");
      const answer = await zrcp.command("run 2000000");
      const memory = await zrcp.command(`read-memory ${PRESSES.toString(16)}H 3`);
      fromLive.push({ registers: registersOf(answer), counters: [...Buffer.from(memory, "hex")], frameTstates: Number(/TSTATES: (\d+)/.exec(answer)?.[1]) });
    }
  } finally {
    await zrcp.command("exit-emulator", 3_000).catch(() => {});
    zrcp.close();
    await emulator.stop();
  }
  const rows = fromCore.map((core, hit) => {
    const live = fromLive[hit]!;
    const coreRegisters = { pc: core.state.pc, sp: core.state.sp, af: core.state.af, bc: core.state.bc, hl: core.state.hl, de: core.state.de, ix: core.state.ix, iy: core.state.iy };
    return {
      hit,
      sameRegisters: JSON.stringify(coreRegisters) === JSON.stringify(live.registers),
      sameCounters: JSON.stringify(core.counters) === JSON.stringify(live.counters),
      counters: core.counters,
      zxrunFrameTstate: core.state.tick % ZX48_FRAME_CYCLES,
      zesaruxFrameTstate: live.frameTstates,
      ...(JSON.stringify(coreRegisters) === JSON.stringify(live.registers) ? {} : { zxrun: coreRegisters, zesarux: live.registers }),
    };
  });
  return { hits: rows };
}

async function main(argv: string[]): Promise<unknown> {
  const [command, subject] = argv;
  if (subject === undefined) throw new Error("usage: zx.ts snapshot|record|replay|analyze|live|compare <file or dir> [options]");
  switch (command) {
    case "snapshot":
      writeFileSync(subject, keyboardCounterSnapshot());
      return { snapshot: subject };
    case "record":
      return record(subject, option(argv, "out")[0] ?? "zx-recording", Number(option(argv, "frames")[0] ?? 50), keySteps(argv));
    case "replay":
      return replay(subject);
    case "analyze":
      return analyzeRecording(subject);
    case "live":
      return live(subject, option(argv, "out")[0] ?? "zx-live");
    case "compare":
      return compare(subject, Number(option(argv, "hits")[0] ?? 5));
    default:
      throw new Error(`unknown command ${command}`);
  }
}

try {
  process.stdout.write(`${JSON.stringify(await main(process.argv.slice(2)), null, 2)}\n`);
  process.exit(0);
} catch (error) {
  process.stdout.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exit(1);
}
