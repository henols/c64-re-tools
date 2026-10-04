// Real-VICE checks for memory search, memory compare and live disassembly.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { ProcessSupervisor } from "../../../src/host/processes.ts";
import type { ViceSessionHandle } from "../../../src/host/server.ts";
import { viceSessionFactory } from "../../../src/host/vice/session.ts";
import { liveEnv, liveLog, liveSkip } from "./live.ts";

let session: ViceSessionHandle;
before(async () => {
  if (liveSkip !== false) return;
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  session = await viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog })({ videoStandard: "pal" });
});
after(async () => {
  await session?.close();
});

test("search finds a KERNAL byte pattern with a wildcard, per view and space", { skip: liveSkip, timeout: 60_000 }, async () => {
  // The KERNAL starts at $e000 with 85 56 20 0f bc.
  const cpu = await session.handle("memorySearch", { start: 0xe000, end: 0xe100, pattern: [0x85, 0x56, null, 0x0f], space: "c64", view: "cpu", maxResults: 10 });
  assert.ok(cpu.matches.includes(0xe000), JSON.stringify(cpu.matches));
  const limited = await session.handle("memorySearch", { start: 0xe000, end: 0xffff, pattern: [0x20], space: "c64", view: "cpu", maxResults: 5 });
  assert.equal(limited.matches.length, 5);
  // The RAM under the KERNAL does not hold it.
  const ram = await session.handle("memorySearch", { start: 0xe000, end: 0xe100, pattern: [0x85, 0x56, 0x20, 0x0f, 0xbc], space: "c64", view: "ram", maxResults: 10 });
  assert.deepEqual(ram.matches, []);
  // The 1541 DOS ROM starts at $c000 with $97.
  const drive = await session.handle("memorySearch", { start: 0xc000, end: 0xc000, pattern: [0x97], space: "drive8", view: "cpu", maxResults: 10 });
  assert.deepEqual(drive.matches, [0xc000]);
  assert.equal((await session.handle("status", {})).state, "running");
});

test("compare finds where two ranges differ, across views", { skip: liveSkip, timeout: 60_000 }, async () => {
  await session.handle("execution", { action: "pause", space: "c64" });
  await session.handle("memoryWrite", { address: 0xc000, data: "0102030405060708", space: "c64", view: "cpu" });
  await session.handle("memoryWrite", { address: 0xc100, data: "01020304ff060708", space: "c64", view: "cpu" });
  const result = await session.handle("memoryCompare", {
    left: { address: 0xc000, space: "c64", view: "cpu" },
    right: { address: 0xc100, space: "c64", view: "ram" },
    size: 8,
  });
  assert.deepEqual(result, { equal: false, differentBytes: 1, firstDifferences: [{ offset: 4, left: 5, right: 0xff }] });
});

test("disassembly of the KERNAL and of drive memory", { skip: liveSkip, timeout: 60_000 }, async () => {
  const kernal = await session.handle("disassemble", { address: 0xe000, count: 2, space: "c64", view: "cpu" });
  assert.deepEqual(kernal.instructions, [
    { address: 0xe000, bytes: "8556", text: "STA $56" },
    { address: 0xe002, bytes: "200fbc", text: "JSR $bc0f" },
  ]);
  const drive = await session.handle("disassemble", { address: 0xc000, count: 1, space: "drive8", view: "cpu" });
  assert.equal(drive.instructions[0]!.address, 0xc000);
  assert.equal(drive.instructions[0]!.bytes.slice(0, 2), "97");
  // After a drive8 command the monitor is back on the computer.
  const again = await session.handle("disassemble", { address: 0xe000, count: 1, space: "c64", view: "cpu" });
  assert.equal(again.instructions[0]!.text, "STA $56");
});
