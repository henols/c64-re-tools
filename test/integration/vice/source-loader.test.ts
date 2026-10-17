// The loader of c64-source: generated from the program in the knowledge
//, put in from an image.json and an entry_state.json, simulated, then
// run in the emulator to the entry, where memory, $00/$01, the registers,
// the VIC-II display registers, the VIC bank and the raster line must
// equal the entry state. The segments
// lie under the loader, at $c000 and under the I/O area. Opt-in with
// C64RT_LIVE_VICE; Ghidra and ACME are necessary too.

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { ACME, findTool } from "../../../src/native/discover.ts";
import { findGhidra } from "../../../src/native/ghidra/index.ts";
import { ProcessSupervisor } from "../../../src/native/processes.ts";
import { startHostServer, type HostServer } from "../../../src/host/server.ts";
import { viceSessionFactory } from "../../../src/host/vice/session.ts";
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

const script = resolve(import.meta.dirname, "../../../skills/c64-source/scripts/source.ts");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-source-loader-"));
let server: HostServer | undefined;
after(async () => {
  await server?.close();
  rmSync(project, { recursive: true, force: true });
});

const ENTRY = 0x0810;
const segments = [
  { start: 0x0801, end: 0x0900 },
  { start: 0xc000, end: 0xc1ff },
  { start: 0xd000, end: 0xd0ff },
];

test("the loader puts every segment and pages 0-3 in place and gets to the entry with the entry state", { skip, timeout: 600_000 }, async () => {
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  server = await startHostServer({ port: 0, createViceSession: viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog }) });

  const memory = new Uint8Array(0x10000);
  for (const segment of segments) for (let address = segment.start; address <= segment.end; address++) memory[address] = (address * 7 + 3) & 0xff;
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
  const child = spawn(process.execPath, [...process.execArgv, script, "generate", "--out", "src", "--loader"], {
    cwd: project,
    env: { ...process.env, C64RT_HOST: `${server.host}:${server.port}` },
    stdio: ["ignore", "pipe", "inherit"],
  });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  const json = JSON.parse(stdout) as { check: { identical: boolean }; loader: { verified: boolean; differences: string[]; copier: string; stackByte: string; copies: Array<{ what: string }> } };
  assert.equal(status, 0, stdout);
  assert.equal(json.check.identical, true);
  assert.deepEqual(json.loader.differences, []);
  assert.equal(json.loader.verified, true);
  assert.equal(json.loader.stackByte, "$01f0");
  assert.notEqual(json.loader.copier, "$c000", "the copier stays out of the segment at $c000");
  assert.equal(json.loader.copies.length, 4, "three segments and pages $0002-$03ff");
  const loader = readFileSync(join(project, "src", "loader.prg"));
  assert.equal(loader.readUInt16LE(0), 0x0801);
});
