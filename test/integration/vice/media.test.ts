// Real-VICE checks for program load, disk attach and autostart.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { textToPetscii } from "../../../src/c64.ts";
import { ProcessSupervisor } from "../../../src/native/processes.ts";
import type { ViceSessionHandle } from "../../../src/host/server.ts";
import { createToolDispatcher } from "../../../src/host/tools/index.ts";
import { viceSessionFactory } from "../../../src/host/vice/session.ts";
import { WireFailure } from "../../../src/protocol/messages.ts";
import { buildD64, offsetOf } from "../../fixtures/d64.ts";
import { BORDER_LOOP_END, BORDER_LOOP_START, borderLoopPrg } from "../../fixtures/prg/border-loop.ts";
import { liveEnv, liveLog, liveSkip } from "./live.ts";

let session: ViceSessionHandle;
const supervisor = new ProcessSupervisor();
before(async () => {
  if (liveSkip !== false) return;
  supervisor.installExitGuard();
  session = await viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog })({ videoStandard: "pal" });
});
after(async () => {
  await session?.close();
});

/** Polls (no fixed sleep) until the C64 CPU runs inside [start, end]. */
async function waitForPcIn(start: number, end: number, timeoutMs = 30_000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { pc } = await session.handle("registersGet", { space: "c64" });
    if (pc >= start && pc <= end) return pc;
    if (Date.now() > deadline) throw new Error(`pc stayed outside $${start.toString(16)}-$${end.toString(16)} (last $${pc.toString(16)})`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

test("a program load puts the bytes in memory, stopped, at either address", { skip: liveSkip, timeout: 60_000 }, async () => {
  const prg = Buffer.from(borderLoopPrg);
  assert.deepEqual(await session.handle("programLoad", {}, [prg]), { state: "stopped", loadAddress: 0x0801, size: prg.length - 2 });
  assert.equal((await session.handle("memoryRead", { address: 0x0801, size: prg.length - 2, space: "c64", view: "cpu" })).data, prg.subarray(2).toString("hex"));
  assert.deepEqual(await session.handle("programLoad", { address: 0xc000 }, [prg]), { state: "stopped", loadAddress: 0xc000, size: prg.length - 2 });
  assert.equal((await session.handle("memoryRead", { address: 0xc000, size: 4, space: "c64", view: "cpu" })).data, prg.subarray(2, 6).toString("hex"));
  assert.equal((await session.handle("status", {})).state, "stopped");
});

test("a disk image attaches; a broken one is a media error", { skip: liveSkip, timeout: 60_000 }, async () => {
  await session.handle("execution", { action: "resume", space: "c64" });
  assert.deepEqual(await session.handle("diskAttach", { type: "d64" }, [buildD64([{ name: "LOOP", bytes: borderLoopPrg }])]), { attached: true });
  assert.equal((await session.handle("status", {})).state, "running");
  await assert.rejects(
    session.handle("diskAttach", { type: "d64" }, [Buffer.alloc(100)]),
    (error: unknown) => error instanceof WireFailure && error.code === "media-error",
  );
});

test("autostart of a PRG runs it", { skip: liveSkip, timeout: 90_000 }, async () => {
  assert.deepEqual(await session.handle("autostart", { type: "prg", index: 0, run: true }, [Buffer.from(borderLoopPrg)]), { state: "running" });
  await waitForPcIn(BORDER_LOOP_START, BORDER_LOOP_END);
});

test("autostart of a D64 loads the first file and runs it", { skip: liveSkip, timeout: 120_000 }, async () => {
  await session.handle("reset", { mode: "hard", run: true });
  const image = buildD64([{ name: "LOOP", bytes: borderLoopPrg }]);
  assert.deepEqual(await session.handle("autostart", { type: "d64", index: 0, run: true }, [image]), { state: "running" });
  await waitForPcIn(BORDER_LOOP_START, BORDER_LOOP_END, 60_000);
});

/** An 8 KiB normal cartridge (type 0) whose start code at $8009 loops: INC $D020 ; JMP $8009. */
function loopCartridge(): Buffer {
  const header = Buffer.alloc(0x40);
  header.write("C64 CARTRIDGE   ", 0, "latin1");
  header.writeUInt32BE(0x40, 0x10);
  header.writeUInt16BE(0x0100, 0x14);
  header[0x18] = 0; // EXROM active
  header[0x19] = 1; // GAME inactive: 8 KiB at $8000
  header.write("LOOP", 0x20, "latin1");
  const rom = Buffer.alloc(0x2000, 0xea);
  rom.set([0x09, 0x80, 0x09, 0x80, 0xc3, 0xc2, 0xcd, 0x38, 0x30, 0xee, 0x20, 0xd0, 0x4c, 0x09, 0x80], 0);
  const chip = Buffer.alloc(0x10);
  chip.write("CHIP", 0, "latin1");
  chip.writeUInt32BE(0x10 + rom.length, 4);
  chip.writeUInt16BE(0x8000, 0x0c);
  chip.writeUInt16BE(rom.length, 0x0e);
  return Buffer.concat([header, chip, rom]);
}

test("a cartridge stays through a reset; an autostart of a PRG detaches it and runs the PRG", { skip: liveSkip, timeout: 120_000 }, async () => {
  await session.handle("autostart", { type: "crt", index: 0, run: true }, [loopCartridge()]);
  await waitForPcIn(0x8009, 0x800e);
  assert.equal((await session.handle("status", {})).cartridge, true);
  await session.handle("reset", { mode: "hard", run: true });
  await waitForPcIn(0x8009, 0x800e);
  await session.handle("autostart", { type: "prg", index: 0, run: true }, [Buffer.from(borderLoopPrg)]);
  await waitForPcIn(BORDER_LOOP_START, BORDER_LOOP_END, 60_000);
  assert.equal((await session.handle("status", {})).cartridge, false);
});

test("a snapshot restore stops an autostart that still loads, and a broken cartridge never reaches the emulator", { skip: liveSkip, timeout: 120_000 }, async () => {
  const prg = Buffer.from(borderLoopPrg);
  await session.handle("reset", { mode: "hard", run: true });
  await session.handle("execution", { action: "advance-frames", count: 150, space: "c64" });
  await session.handle("memoryWrite", { address: 0x0801, data: "c0ffee", space: "c64", view: "ram" });
  await session.handle("snapshot", { action: "save", name: "before-autostart" });
  await session.handle("autostart", { type: "prg", index: 0, run: true }, [prg]);
  await session.handle("execution", { action: "pause", space: "c64" });
  await session.handle("snapshot", { action: "restore", name: "before-autostart" });
  await session.handle("execution", { action: "advance-frames", count: 300, space: "c64" });
  assert.equal((await session.handle("memoryRead", { address: 0x0801, size: 3, space: "c64", view: "ram" })).data, "c0ffee", "the autostart did not load the program over the restored memory");

  await assert.rejects(
    session.handle("autostart", { type: "crt", index: 0, run: true }, [Buffer.alloc(16, 0x55)]),
    (error: unknown) => error instanceof WireFailure && error.code === "media-error",
  );
  assert.equal((await session.handle("status", {})).cartridge, false);
});

test("a key while the autostart still loads is refused, and taken once the program runs", { skip: liveSkip, timeout: 120_000 }, async () => {
  await session.handle("reset", { mode: "hard", run: true });
  await session.handle("autostart", { type: "prg", index: 0, run: true }, [Buffer.from(borderLoopPrg)]);
  // The emulator turns warp on while it autostarts; with warp off the autostart already ended.
  if ((await session.handle("status", {})).warp) {
    await assert.rejects(session.handle("keyboard", { data: "20" }), (error: unknown) => error instanceof WireFailure && /autostart still loads/.test(error.message));
  }
  for (let wait = 0; wait < 40 && (await session.handle("status", {})).warp; wait++) await session.handle("execution", { action: "advance-frames", count: 25, space: "c64" });
  assert.deepEqual(await session.handle("keyboard", { data: "20" }), { queuedBytes: 1 });
});

test("the bytes that a sectors request gives for a sector that no file holds are the bytes that the drive reads there", { skip: liveSkip, timeout: 120_000 }, async () => {
  const image = buildD64([{ name: "LOOP", bytes: borderLoopPrg }], "HIDDEN", [{ track: 20, sector: 5 }]);
  const marker = Buffer.from(Array.from({ length: 256 }, (_, index) => (index * 7 + 3) & 0xff));
  marker.copy(image, offsetOf(20, 5));
  const tools = createToolDispatcher({ supervisor, env: liveEnv(), log: liveLog });
  const { result, attachments } = await tools("c1541.inspect", { action: "sectors", imageType: "d64", unreferenced: true }, [image], new AbortController().signal);
  assert.deepEqual(result, { action: "sectors", sectors: [{ track: 20, sector: 5 }], bytes: 256 });
  assert.deepEqual(attachments?.[0], marker);

  // A loader that reads the sector directly: BASIC sends U1 for track 20 sector 5 into a drive buffer.
  await session.handle("reset", { mode: "hard", run: true });
  assert.deepEqual(await session.handle("diskAttach", { type: "d64" }, [image]), { attached: true });
  const ready = [0x12, 0x05, 0x01, 0x04, 0x19, 0x2e];
  const screenHas = async (pattern: number[]) => (await session.handle("memorySearch", { start: 0x0400, end: 0x07e7, pattern, space: "c64", view: "cpu", maxResults: 2 })).matches.length;
  for (let wait = 0; wait < 100 && (await screenHas(ready)) === 0; wait++) await new Promise((resolve) => setTimeout(resolve, 100));
  const line = textToPetscii('open15,8,15:open2,8,2,"#":print#15,"u1 2 0 20 5"\n');
  await session.handle("keyboard", { data: Buffer.from(line).toString("hex") });
  let found: number[] = [];
  for (let wait = 0; wait < 200 && found.length === 0; wait++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    found = (await session.handle("memorySearch", { start: 0x0300, end: 0x07ff, pattern: [...marker.subarray(0, 16)], space: "drive8", view: "cpu", maxResults: 2 })).matches;
  }
  assert.equal(found.length, 1, "the drive buffer holds the sector");
  const read = await session.handle("memoryRead", { address: found[0]!, size: 256, space: "drive8", view: "cpu" });
  assert.equal(read.data, marker.toString("hex"));
});
