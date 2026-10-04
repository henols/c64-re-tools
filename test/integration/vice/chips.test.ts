// Real-VICE checks for VIC-II, sprite, CIA and SID state.

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
  // Let the KERNAL finish its start-up.
  await session.handle("runUntil", { target: { kind: "address", address: 0xe5cd, space: "c64" }, timeoutFrames: 500 });
});
after(async () => {
  await session?.close();
});

const write = (address: number, data: string) => session.handle("memoryWrite", { address, data, space: "c64", view: "cpu" });

test("the VIC-II state after start-up is the KERNAL's text screen", { skip: liveSkip, timeout: 60_000 }, async () => {
  const state = await session.handle("vicii", {});
  assert.equal(state.mode, "text");
  assert.equal(state.screenAddress, 0x0400);
  assert.equal(state.borderColor, 14);
  assert.equal(state.backgroundColors[0], 6);
  assert.equal(state.scrollY, 3);
  assert.ok(state.rasterLine < 312);
  // $d018 selects the character set: $15 is the ROM upper-case set at $1000, $17 the other at $1800.
  await session.handle("execution", { action: "pause", space: "c64" });
  await write(0xd018, "15");
  assert.equal((await session.handle("vicii", {})).graphicsAddress, 0x1000);
  await write(0xd018, "17");
  assert.equal((await session.handle("vicii", {})).graphicsAddress, 0x1800);
  // Bitmap mode at $2000 in bank 0.
  await write(0xd011, "3b");
  await write(0xd018, "18");
  const bitmap = await session.handle("vicii", {});
  assert.deepEqual([bitmap.mode, bitmap.graphicsAddress], ["bitmap", 0x2000]);
  await write(0xd011, "1b");
});

test("a sprite set up through its registers decodes back", { skip: liveSkip, timeout: 60_000 }, async () => {
  await write(0xd002, "91"); // sprite 1 x low
  await write(0xd003, "60"); // sprite 1 y
  await write(0xd010, "02"); // sprite 1 x bit 8
  await write(0xd015, "02"); // enable sprite 1
  await write(0xd01c, "02"); // multicolour
  await write(0xd028, "01"); // colour white
  await write(0x07f9, "c0"); // pointer: $c0 * 64 = $3000
  const { sprites } = await session.handle("sprites", { indexes: [1] });
  assert.deepEqual(sprites, [
    { index: 1, x: 0x191, y: 0x60, enabled: true, color: 1, multicolor: true, expandX: false, expandY: false, behindBackground: false, dataAddress: 0x3000 },
  ]);
  assert.equal((await session.handle("sprites", { indexes: [] })).sprites.length, 8);
});

test("both CIAs report their state; CIA 1 timer A runs the KERNAL interrupt", { skip: liveSkip, timeout: 60_000 }, async () => {
  const { chips } = await session.handle("cia", { which: "both" });
  assert.deepEqual(chips.map((chip) => chip.id), [1, 2]);
  const [cia1, cia2] = chips;
  assert.equal(cia1!.ddrA, 0xff, "CIA 1 port A drives the keyboard columns");
  assert.equal(cia1!.controlA & 0x01, 1, "timer A runs");
  assert.equal(cia2!.portA & 0x03, 0x03, "VIC bank 0");
  // A second read sees the same interrupt flags: reading has no side effects.
  const again = await session.handle("cia", { which: "1" });
  assert.equal(again.chips[0]!.interruptStatus, cia1!.interruptStatus);
});

test("the SID state is the registers as last written", { skip: liveSkip, timeout: 60_000 }, async () => {
  await write(0xd400, "0b30557a9fc4e9");
  await write(0xd415, "04395e83");
  const sid = await session.handle("sid", {});
  assert.deepEqual(sid.voices[0], { index: 1, frequency: 0x300b, pulseWidth: 0x0a55, control: 0x9f, attackDecay: 0xc4, sustainRelease: 0xe9 });
  assert.deepEqual(sid.filter, { cutoff: 0x1cc, resonance: 5, routing: 14, mode: 8 });
  assert.equal(sid.volume, 3);
});

test("observe reads registers, memory, chips, timing and the screen from one moment", { skip: liveSkip, timeout: 60_000 }, async () => {
  await session.handle("execution", { action: "pause", space: "c64" });
  // $c000: SEI ; loop: INX ; STX $c100 ; JMP loop
  await session.handle("memoryWrite", { address: 0xc000, data: "78e88e00c14c01c0", space: "c64", view: "cpu" });
  await session.handle("registersSet", { space: "c64", values: { pc: 0xc000 } });
  await session.handle("execution", { action: "resume", space: "c64" });
  for (let round = 0; round < 5; round++) {
    const observed = await session.handle("observe", {
      registers: "c64",
      memory: [{ address: 0xc100, size: 1, space: "c64", view: "cpu" }],
      vicii: true,
      cia: "both",
      timing: true,
      screen: true,
    });
    // Within one stop, the stored byte is X or the X before the last INX.
    const stored = Number.parseInt(observed.memory![0]!.data, 16);
    const x = observed.registers!.x;
    assert.ok(stored === x || stored === ((x - 1) & 0xff), `stored ${stored}, x ${x}`);
    assert.ok(observed.timing!.rasterLine < 312);
    assert.equal(observed.cia!.length, 2);
    assert.equal(observed.screen!.width, 384);
  }
  assert.equal((await session.handle("status", {})).state, "running");
});
