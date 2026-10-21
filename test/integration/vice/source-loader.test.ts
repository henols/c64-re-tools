// The loader of c64-source: generated from the program in the knowledge
//, put in from an image.json and an entry_state.json, simulated, then
// run in the emulator to the entry, where memory, $00/$01, the registers,
// the VIC-II display registers, the VIC bank and the raster line must
// equal the entry state. The segments
// lie under the loader, at $c000 and under the I/O area. An image too large
// for one loader file gets the packed form, which Exomizer unpacks. Opt-in
// with C64RT_LIVE_VICE; Ghidra and ACME are necessary too, and Exomizer for
// the packed form. A start screen in the knowledge shows before the copier
// sets the entry state, and waits for a key or a fire button.

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { ACME, EXOMIZER, findTool } from "../../../src/native/discover.ts";
import { findGhidra } from "../../../src/native/ghidra/index.ts";
import { ProcessSupervisor } from "../../../src/native/processes.ts";
import { startHostServer, type HostServer } from "../../../src/host/server.ts";
import { viceSessionFactory } from "../../../src/host/vice/session.ts";
import { readEnvelope, seededBytes } from "../../kit.ts";
import { liveEnv, liveLog, liveSkip } from "./live.ts";

let skip: string | false = liveSkip;
if (skip === false) {
  try {
    findTool(ACME);
    findGhidra();
  } catch {
    skip = "ACME and Ghidra are necessary: install acme and set C64RT_GHIDRA to run this test";
  }
}

let packedSkip: string | false = skip;
if (packedSkip === false) {
  try {
    findTool(EXOMIZER);
  } catch {
    packedSkip = "Exomizer is necessary for the packed loader: install exomizer or set C64RT_EXOMIZER to run this test";
  }
}

const script = resolve(import.meta.dirname, "../../../skills/c64-source/scripts/source.ts");
const projects: string[] = [];
let server: HostServer | undefined;
after(async () => {
  await server?.close();
  for (const project of projects) rmSync(project, { recursive: true, force: true });
});

const ENTRY = 0x0810;

/** The Host Runtime of the tests, started once. */
async function host(): Promise<HostServer> {
  if (server !== undefined) return server;
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  server = await startHostServer({ port: 0, createViceSession: viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog }) });
  return server;
}

interface Generated {
  status: number | null;
  json: {
    check: { identical: boolean };
    loader: { verified: boolean; differences: string[]; copier: string; stackByte: string; copies: Array<{ what: string }>; packed?: { packedBytes: number; unpackedBytes: number }; startScreen?: { shown: boolean; waits: boolean } };
    leftovers?: { bytes: number; listed: Array<{ start: string; end: string }> };
  } & { loader: { startScreen?: { stage?: string }; stage?: { space: string; code: string; bytes: number; stash: Array<{ from: string; to: string }> } } };
  project: string;
}

/**
 * Puts the image and the entry state of a capture into the knowledge of a new
 * project, with the start screen, the commands and the coverage that a test
 * gives, and generates the source with --loader.
 */
async function generate(memory: Uint8Array, segments: ReadonlyArray<{ start: number; end: number }>, startScreen: string[] = [], more: { commands?: string[][]; coverage?: Uint8Array; files?: Record<string, Uint8Array | string> } = {}): Promise<Generated> {
  const project = mkdtempSync(join(tmpdir(), "c64-re-tools-source-loader-"));
  projects.push(project);
  const { host: address, port } = await host();
  memory.set([0x4c, ENTRY & 0xff, ENTRY >> 8], ENTRY); // JMP to itself
  const pages = Uint8Array.from({ length: 0x400 }, (_, index) => (index * 13 + 5) & 0xff);
  const vic = new Uint8Array(0x2f);
  vic.set([0x9b, 0x23], 0x11);
  vic.set([0x01, 0xc8, 0x00, 0x39], 0x15);
  vic.set([0xf5, 0xf6, 0xf1, 0xf2, 0xf3], 0x20);
  vic[0x00] = 0x60;
  mkdirSync(join(project, "unpacked"));
  writeFileSync(join(project, "unpacked", "image.bin"), memory);
  const hex = (value: number) => `$${value.toString(16).padStart(4, "0")}`;
  writeFileSync(join(project, "unpacked", "image.json"), JSON.stringify({ entry: hex(ENTRY), image: "image.bin", segments: segments.map((segment) => ({ start: hex(segment.start), end: hex(segment.end) })) }));
  writeFileSync(
    join(project, "unpacked", "entry_state.json"),
    JSON.stringify({
      registers: { pc: hex(ENTRY), a: 1, x: 2, y: 3, sp: 0xf0, flags: { n: true, v: false, b: false, d: false, i: true, z: false, c: true } },
      cpuPort: { $00: 0x2f, $01: 0x35 },
      pages: Object.fromEntries([0, 1, 2, 3].map((page) => [hex(page << 8), Buffer.from(pages.subarray(page << 8, (page + 1) << 8)).toString("hex")])),
      // The VIC-II at the entry: raster line $123, screen at $0c00 with bitmap mode, VIC bank 2, other colours.
      // The CIAs: CIA 1 timer A runs with TOD at 50 Hz and its own latch, timer B counts its underflows;
      // CIA 2 timer A runs one-shot, timer B is as the KERNAL leaves it. CIA 1 has timers A and B as interrupt sources.
      io: {
        vic: { from: "$d000", bytes: Buffer.from(vic).toString("hex") },
        cia1: { from: "$dc00", bytes: "7fffff00" + "3412" + "5500" + "00000001" + "00" + "00" + "81" + "41" },
        cia2: { from: "$dd00", bytes: "c63f3f00" + "0020" + "ffff" + "00000001" + "00" + "00" + "09" + "08" },
      },
      cia: { cia1: { latchA: 0x2345, latchB: 0x0100, interruptMask: 0x03 }, cia2: { latchA: 0x3000, latchB: 0xffff, interruptMask: 0x00 } },
    }),
  );

  // The capture goes into the knowledge, and the loader is generated from there.
  const knowledgeScript = resolve(import.meta.dirname, "../../../skills/c64-knowledge/scripts/knowledge.ts");
  const imported = spawnSync(process.execPath, [...process.execArgv, knowledgeScript, "image", "unpacked/image.json"], { cwd: project, encoding: "utf8" });
  assert.equal(imported.status, 0, imported.stdout + imported.stderr);
  readEnvelope(imported.stdout, imported.status);
  if (more.coverage !== undefined) writeFileSync(join(project, "run.bin"), more.coverage);
  for (const [name, data] of Object.entries(more.files ?? {})) writeFileSync(join(project, name), data);
  const commands = [...(more.commands ?? []), ...(startScreen.length > 0 ? [["start-screen", ...startScreen]] : []), ...(more.coverage === undefined ? [] : [["coverage", "run.bin"]])];
  for (const command of commands) {
    const recorded = spawnSync(process.execPath, [...process.execArgv, knowledgeScript, ...command], { cwd: project, encoding: "utf8" });
    assert.equal(recorded.status, 0, recorded.stdout + recorded.stderr);
  }
  const child = spawn(process.execPath, [...process.execArgv, script, "generate", "--out", "src", "--loader"], {
    cwd: project,
    env: { ...process.env, C64RT_HOST: `${address}:${port}` },
    stdio: ["ignore", "pipe", "inherit"],
  });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  assert.equal(status, 0, stdout);
  return { status, json: readEnvelope(stdout, status).json as Generated["json"], project };
}

test("the loader puts every segment and pages 0-3 in place and gets to the entry with the entry state", { skip, timeout: 600_000 }, async () => {
  const segments = [
    { start: 0x0801, end: 0x0900 },
    { start: 0xc000, end: 0xc1ff },
    { start: 0xd000, end: 0xd0ff },
  ];
  const memory = new Uint8Array(0x10000);
  for (const segment of segments) for (let address = segment.start; address <= segment.end; address++) memory[address] = (address * 7 + 3) & 0xff;
  const { json, project } = await generate(memory, segments);
  assert.equal(json.check.identical, true);
  assert.deepEqual(json.loader.differences, []);
  assert.equal(json.loader.verified, true);
  assert.equal(json.loader.stackByte, "$01f0");
  assert.notEqual(json.loader.copier, "$c000", "the copier stays out of the segment at $c000");
  assert.equal(json.loader.copies.length, 4, "three segments and pages $0002-$03ff");
  assert.equal(json.loader.packed, undefined, "the plain form");
  const loader = readFileSync(join(project, "src", "loader.prg"));
  assert.equal(loader.readUInt16LE(0), 0x0801);
});

test("a 62 KiB image with RAM at $d000-$dfff gets the packed loader, which gets to the entry with every byte and the entry state", { skip: packedSkip, timeout: 900_000 }, async () => {
  // Found in a field run on a 62 KB game: the plain loader would end past $ffff.
  const segments = [
    { start: 0x0801, end: 0xbfff },
    { start: 0xc800, end: 0xffff },
  ];
  // Bytes that pack badly to $5fff and under the I/O area, NOPs elsewhere. Exomizer takes minutes for some regular patterns.
  const memory = new Uint8Array(0x10000);
  for (const segment of segments) memory.fill(0xea, segment.start, segment.end + 1);
  memory.set(seededBytes(3, 0x6000 - 0x0801), 0x0801);
  memory.set(seededBytes(4, 0x1000), 0xd000);
  const { json, project } = await generate(memory, segments);
  assert.equal(json.check.identical, true);
  assert.deepEqual(json.loader.differences, []);
  assert.equal(json.loader.verified, true);
  assert.equal(json.loader.copier, "$c000");
  // The segments and the copier at $c000: the gap $c000-$c7ff of main.asm is not packed.
  assert.ok(json.loader.packed!.unpackedBytes > 0xc000 - 0x0801 + 0x10000 - 0xc800 && json.loader.packed!.unpackedBytes < 0x10000 - 0x0801, JSON.stringify(json.loader.packed));
  assert.deepEqual(json.loader.copies.map((copy) => copy.what), ["entry state $0002-$03ff"]);
  const loader = readFileSync(join(project, "src", "loader.prg"));
  assert.equal(loader.readUInt16LE(0), 0x0801);
  assert.equal(loader.length, json.loader.packed?.packedBytes);
});

test("a start screen shows after the copies with its VIC-II values, waits without a key, and the loader still gets to the entry with the entry state", { skip, timeout: 600_000 }, async () => {
  // A Koala picture in VIC bank 1: the screen at $5c00, the bitmap at $6000 and the colours at $7f40.
  const segments = [
    { start: 0x0801, end: 0x0900 },
    { start: 0x4000, end: 0x83ff },
  ];
  const memory = new Uint8Array(0x10000);
  for (const segment of segments) for (let address = segment.start; address <= segment.end; address++) memory[address] = (address * 7 + 3) & 0xff;
  const { json, project } = await generate(memory, segments, ["--mode", "multicolour", "--screen", "$5c00", "--bitmap", "$6000", "--colours", "$7f40", "--border", "0", "--background", "6"]);
  assert.equal(json.check.identical, true);
  assert.deepEqual(json.loader.differences, []);
  assert.equal(json.loader.verified, true);
  assert.deepEqual(json.loader.startScreen && { shown: json.loader.startScreen.shown, waits: json.loader.startScreen.waits }, { shown: true, waits: true });
  assert.equal(json.loader.copier, "$c000", "three free pages");
  assert.match(readFileSync(join(project, "src", "config.asm"), "utf8"), /\nSTART_SCREEN = 1 ; /);
  assert.match(readFileSync(join(project, "src", "start_screen.asm"), "utf8"), /^; Generated by c64-source\./);
});

test("the loader does not load the leftovers: a range that nothing uses is not in loader.prg, and the loader still gets to the entry with the entry state", { skip, timeout: 600_000 }, async () => {
  const segments = [
    { start: 0x0801, end: 0x0900 },
    { start: 0xc000, end: 0xc1ff },
  ];
  const memory = new Uint8Array(0x10000);
  for (const segment of segments) for (let address = segment.start; address <= segment.end; address++) memory[address] = (address * 7 + 3) & 0xff;
  // The run executes the JMP at the entry; $0880-$08ff is a table that nothing reads, with bytes that no other range has.
  memory.set(seededBytes(5, 0x80), 0x0880);
  const coverage = new Uint8Array(0x10000);
  coverage[ENTRY] = 1 << 2;
  const { json, project } = await generate(memory, segments, [], { commands: [["classify", "$0813-$087f", "bytes"], ["classify", "$0880-$08ff", "unused"]], coverage });
  assert.equal(json.check.identical, true);
  assert.deepEqual(json.loader.differences, []);
  assert.equal(json.loader.verified, true);
  assert.deepEqual(json.leftovers?.listed.map((range) => [range.start, range.end]), [["$0813", "$08ff"]]);
  assert.equal(json.loader.copies.length, 4, "the segment parts without the leftovers, and pages $0002-$03ff");
  const loader = readFileSync(join(project, "src", "loader.prg"));
  const table = Buffer.from(memory.subarray(0x0880, 0x0900));
  assert.equal(loader.indexOf(table), -1, "the bytes of the leftovers are not in loader.prg");
  assert.match(readFileSync(join(project, "src", "main.asm"), "utf8"), /!if LEFTOVERS \{ !source "leftover_0813\.asm" \} else \{ !skip 237 \}/);
});

test("a start screen of a captured stage shows before the loader: the stage calls its routine, waits, gives back the loader bytes under it, and the loader gets to the entry", { skip: packedSkip, timeout: 900_000 }, async () => {
  const segments = [{ start: 0x0801, end: 0x0900 }];
  const memory = new Uint8Array(0x10000);
  for (let address = 0x0801; address <= 0x0900; address++) memory[address] = (address * 7 + 3) & 0xff;
  // The stage in bank1: a Koala picture in VIC bank 3 (screen $cc00, bitmap $e000, colours $8328), a routine at $0a00 under
  // the loader file that sets an IRQ, which counts at $0a1f and goes on to the KERNAL, and a table at $3000 that nothing uses.
  const stage = new Uint8Array(0x10000);
  const stageSegments = [{ start: 0x0a00, end: 0x0a1f }, { start: 0x3000, end: 0x30ff }, { start: 0x8328, end: 0x870f }, { start: 0xcc00, end: 0xcfe7 }, { start: 0xe000, end: 0xff3f }];
  stage.set([0x78, 0xa9, 0x0d, 0x8d, 0x14, 0x03, 0xa9, 0x0a, 0x8d, 0x15, 0x03, 0x58, 0x60, 0xee, 0x1f, 0x0a, 0x4c, 0x31, 0xea], 0x0a00);
  stage.set(seededBytes(6, 0x100), 0x3000);
  stage.set(seededBytes(7, 1000), 0x8328);
  stage.set(seededBytes(8, 1000), 0xcc00);
  stage.set(seededBytes(9, 8000), 0xe000);
  const hex = (value: number) => `$${value.toString(16).padStart(4, "0")}`;
  const coverage = new Uint8Array(0x10000);
  for (const address of [0x0a00, 0x0a01, 0x0a03, 0x0a06, 0x0a08, 0x0a0b, 0x0a0c, 0x0a0d, 0x0a10]) coverage[address] = 1 << 2;
  const { json, project } = await generate(memory, segments, ["--mode", "multicolour", "--screen", "$cc00", "--bitmap", "$e000", "--colours", "$8328", "--border", "0", "--background", "6", "--stage", "bank1", "--call", "$0a00"], {
    files: {
      "stage.bin": stage,
      "stage.json": JSON.stringify({ image: "stage.bin", segments: stageSegments.map((segment) => ({ start: hex(segment.start), end: hex(segment.end) })) }),
      "stage-run.bin": coverage,
    },
    // The capture of the stage has the text of a crack in the first 4 cells of the screen: a patch of a crack switch, on in the base release of the stage, takes it out.
    commands: [
      ["image", "stage.json", "--space", "bank1"],
      ["coverage", "stage-run.bin", "--space", "bank1"],
      ["classify", "$3000-$30ff", "unused", "--space", "bank1"],
      ["release", "CRACK", "--file", "stage.json", "--base", "--space", "bank1"],
      ["switch", "CRACK_TEXT", "--kind", "crack", "--releases", "CRACK", "--space", "bank1"],
      ["patch", "$cc00-$cc03", "CRACK_TEXT", "--code", "!byte $11,$22,$33,$44", "--space", "bank1"],
    ],
  });
  assert.equal(json.check.identical, true);
  assert.deepEqual(json.loader.differences, []);
  assert.equal(json.loader.verified, true);
  assert.deepEqual(json.loader.startScreen && { shown: json.loader.startScreen.shown, waits: json.loader.startScreen.waits, stage: json.loader.startScreen.stage }, { shown: true, waits: true, stage: "bank1" });
  // The routine, the colours, the screen and the bitmap: the table at $3000 stays out.
  assert.equal(json.loader.stage?.bytes, 0x20 + 1000 + 1000 + 8000);
  assert.deepEqual(json.loader.stage?.stash.map((item) => item.to), ["$0a00-$0a1f"]);
  // The check compared the screen in memory with the bytes of the stage with the patch in.
  assert.match(readFileSync(join(project, "src", "start_screen_stage.asm"), "utf8"), /^stage_from_cc00\n!pseudopc \$cc00 \{\n {8}!byte \$11,\$22,\$33,\$44,/m);
  const loader = readFileSync(join(project, "src", "loader.prg"));
  assert.equal(loader.readUInt16LE(0), 0x0801);
  assert.match(readFileSync(join(project, "src", "start_screen_stage.asm"), "utf8"), /^; Generated by c64-source\.[^\n]*\n(?:.*\n)*c64_source_ss_call = \$0a00 /);
  assert.match(readFileSync(join(project, "src", "start_screen.asm"), "utf8"), /^; Generated by c64-source\./);
});
