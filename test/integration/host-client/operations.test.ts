// Contract test for every private VICE-session operation: the real client
// sends one example of each through the real Host Runtime server to a stub
// session, which answers with an example result. Parameters must reach the
// session as sent, and results must pass the client's validation unchanged.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { ViceSessionClient } from "../../../src/host-client/vice-session.ts";
import { startHostServer, type HostServer } from "../../../src/host/server.ts";
import { VICE_OPERATIONS, type ViceOperation } from "../../../src/protocol.ts";

const REGISTERS = { pc: 0x2100, a: 1, x: 2, y: 3, sp: 0xf9, flags: { n: false, v: false, b: false, d: false, i: true, z: false, c: true } };
const VICII = { rasterLine: 100, mode: "text", screenAddress: 0x400, graphicsAddress: 0x1000, scrollX: 0, scrollY: 3, borderColor: 14, backgroundColors: [6, 0, 0, 0] };
const SPRITE = { index: 0, x: 145, y: 96, enabled: true, color: 1, multicolor: false, expandX: false, expandY: false, behindBackground: false, dataAddress: 0x3000 };
const CIA = { id: 1, portA: 255, portB: 127, ddrA: 0, ddrB: 255, timerA: 65535, timerB: 65535, controlA: 0, controlB: 0, interruptStatus: 0, tod: { hours: 12, minutes: 34, seconds: 56, tenths: 7 } };
const SID = {
  voices: [1, 2, 3].map((index) => ({ index, frequency: 8192, pulseWidth: 2048, control: 17, attackDecay: 34, sustainRelease: 248 })),
  filter: { cutoff: 1024, resonance: 8, routing: 7, mode: 5 },
  volume: 15,
};
const PNG = Buffer.from("png").toString("base64");

// Media operations read project files relative to the working directory; each test file runs in its own process.
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-contract-"));
writeFileSync(join(project, "game.prg"), Buffer.from([0x00, 0xc0, 0xea]));
writeFileSync(join(project, "game.d64"), Buffer.alloc(16));
process.chdir(project);

/** One example per operation: how the client calls it, what the session must see, what it answers. */
const EXAMPLES: Record<ViceOperation, { call: (client: ViceSessionClient) => Promise<unknown>; params: unknown; result: unknown; attachments?: number }> = {
  status: { call: (c) => c.status(), params: {}, result: { state: "stopped", videoStandard: "pal", warp: false, pc: 0x2100 } },
  memoryRead: {
    call: (c) => c.memoryRead({ address: 0x2000, size: 2, space: "c64", view: "cpu" }),
    params: { address: 0x2000, size: 2, space: "c64", view: "cpu" },
    result: { address: 0x2000, data: "a900" },
  },
  registersGet: { call: (c) => c.registersGet("drive8"), params: { space: "drive8" }, result: REGISTERS },
  memoryWrite: {
    call: (c) => c.memoryWrite({ address: 0x2000, data: "a900", space: "c64", view: "ram" }),
    params: { address: 0x2000, data: "a900", space: "c64", view: "ram" },
    result: { address: 0x2000, bytesWritten: 2 },
  },
  memorySearch: {
    call: (c) => c.memorySearch({ start: 0x0800, end: 0xffff, pattern: [0xa9, null], space: "c64", view: "cpu", maxResults: 10 }),
    params: { start: 0x0800, end: 0xffff, pattern: [0xa9, null], space: "c64", view: "cpu", maxResults: 10 },
    result: { matches: [0x2100] },
  },
  memoryCompare: {
    call: (c) => c.memoryCompare({ left: { address: 0x2000, space: "c64", view: "cpu" }, right: { address: 0x0300, space: "drive8", view: "cpu" }, size: 4 }),
    params: { left: { address: 0x2000, space: "c64", view: "cpu" }, right: { address: 0x0300, space: "drive8", view: "cpu" }, size: 4 },
    result: { equal: false, differentBytes: 1, firstDifferences: [{ offset: 2, left: 4, right: 5 }] },
  },
  disassemble: {
    call: (c) => c.disassemble({ address: 0x2100, count: 1, space: "c64", view: "cpu" }),
    params: { address: 0x2100, count: 1, space: "c64", view: "cpu" },
    result: { instructions: [{ address: 0x2100, bytes: "a900", text: "LDA #$00" }] },
  },
  registersSet: { call: (c) => c.registersSet("c64", { a: 1, flags: { c: true } }), params: { space: "c64", values: { a: 1, flags: { c: true } } }, result: REGISTERS },
  execution: {
    call: (c) => c.execution({ action: "advance-frames", count: 20, space: "c64" }),
    params: { action: "advance-frames", count: 20, space: "c64" },
    result: { state: "stopped", pc: 0x2137, advancedFrames: 20 },
  },
  runUntil: {
    call: (c) => c.runUntil({ target: { kind: "raster", line: 100, cycle: 20 }, timeoutFrames: 3000 }),
    params: { target: { kind: "raster", line: 100, cycle: 20 }, timeoutFrames: 3000 },
    result: { reached: false, stopReason: "timeout", state: "stopped", pc: 0x2100 },
  },
  programLoad: { call: (c) => c.programLoad({ path: "game.prg", address: 0xc000 }), params: { address: 0xc000 }, result: { state: "stopped", loadAddress: 0xc000, size: 1 }, attachments: 1 },
  autostart: { call: (c) => c.autostart({ path: "game.prg", index: 0, run: true }), params: { type: "prg", index: 0, run: true }, result: { state: "running" }, attachments: 1 },
  diskAttach: { call: (c) => c.diskAttach({ path: "game.d64" }), params: { type: "d64" }, result: { attached: true }, attachments: 1 },
  reset: { call: (c) => c.reset({ mode: "hard", run: false }), params: { mode: "hard", run: false }, result: { state: "stopped" } },
  keyboard: { call: (c) => c.keyboard(Uint8Array.from([0x52, 0x0d])), params: { data: "520d" }, result: { queuedBytes: 2 } },
  joystick: { call: (c) => c.joystick({ port: 2, direction: "left", fire: true }), params: { port: 2, direction: "left", fire: true }, result: { port: 2, direction: "left", fire: true } },
  breakpoint: {
    call: (c) => c.breakpoint({ action: "add", address: 0x2100, space: "c64", condition: { kind: "register", register: "a", operator: "eq", value: 66 } }),
    params: { action: "add", address: 0x2100, space: "c64", condition: { kind: "register", register: "a", operator: "eq", value: 66 } },
    result: { id: 4, address: 0x2100, space: "c64", enabled: true },
  },
  watchpoint: {
    call: (c) => c.watchpoint({ action: "list" }),
    params: { action: "list" },
    result: { watchpoints: [{ id: 7, address: 0xc020, size: 2, access: "write", space: "c64", enabled: true }] },
  },
  screenCapture: { call: (c) => c.screenCapture("title"), params: { baseline: "title" }, result: { width: 384, height: 272, png: PNG, baseline: "title" } },
  screenCompare: {
    call: (c) => c.screenCompare({ baseline: "title", maxMismatchRatio: 0, mask: [{ x: 1, y: 2, width: 3, height: 4 }], includeDiff: true }),
    params: { baseline: "title", maxMismatchRatio: 0, mask: [{ x: 1, y: 2, width: 3, height: 4 }], includeDiff: true },
    result: { match: false, mismatchingPixels: 42, mismatchRatio: 0.0004, bounds: { x: 112, y: 84, width: 18, height: 21 }, diffPng: PNG },
  },
  screenBaselines: { call: (c) => c.screenBaselines(), params: {}, result: { baselines: ["title"] } },
  screenDiscard: { call: (c) => c.screenDiscard("title"), params: { baseline: "title" }, result: { discarded: true } },
  snapshot: { call: (c) => c.snapshot({ action: "restore", name: "boss" }), params: { action: "restore", name: "boss" }, result: { restored: true, state: "stopped" } },
  cpuHistory: {
    call: (c) => c.cpuHistory({ limit: 1, space: "c64" }),
    params: { limit: 1, space: "c64" },
    result: { entries: [{ address: 0x2100, bytes: "a900", text: "LDA #$00", a: 0, x: 3, y: 0, sp: 249, rasterLine: 100, rasterCycle: 20 }] },
  },
  backtrace: { call: (c) => c.backtrace({ depth: 4, space: "c64" }), params: { depth: 4, space: "c64" }, result: { frames: [{ address: 0x2100, returnAddress: 0x1980 }] } },
  timing: { call: (c) => c.timing("read"), params: { action: "read" }, result: { cycles: "1234" } },
  profile: { call: (c) => c.profile(5), params: { limit: 5 }, result: { entries: [{ address: 0x2100, totalCycles: "125000", selfCycles: "82000", percent: 17.4 }] } },
  memmap: {
    call: (c) => c.memmap({ action: "read", start: 0, end: 0xffff, maxRanges: 256 }),
    params: { action: "read", start: 0, end: 0xffff, maxRanges: 256 },
    result: { ranges: [{ start: 0x2100, end: 0x213f, execute: true, read: true, write: false }] },
  },
  vicii: { call: (c) => c.vicii(), params: {}, result: VICII },
  sprites: { call: (c) => c.sprites([0]), params: { indexes: [0] }, result: { sprites: [SPRITE] } },
  cia: { call: (c) => c.cia("1"), params: { which: "1" }, result: { chips: [CIA] } },
  sid: { call: (c) => c.sid(), params: {}, result: SID },
  observe: {
    call: (c) => c.observe({ registers: "c64", timing: true, screen: true }),
    params: { registers: "c64", timing: true, screen: true },
    result: { registers: REGISTERS, timing: { rasterLine: 100, rasterCycle: 20 }, screen: { width: 384, height: 272, png: PNG } },
  },
  warp: { call: (c) => c.warp(true), params: { enabled: true }, result: { enabled: true } },
};

let server: HostServer;
let client: ViceSessionClient;
const seen = new Map<string, { params: unknown; attachments: number }>();

after(async () => {
  await client?.close();
  await server?.close();
  // Windows cannot remove the current directory.
  process.chdir(tmpdir());
  rmSync(project, { recursive: true, force: true });
});

test("every private operation has a contract example", () => {
  assert.deepEqual(Object.keys(EXAMPLES).sort(), [...VICE_OPERATIONS].sort());
});

test("every operation crosses the real host boundary with its parameters and result intact", async () => {
  server = await startHostServer({
    port: 0,
    createViceSession: async () => ({
      async handle(op, params, attachments) {
        seen.set(op, { params, attachments: attachments?.length ?? 0 });
        return EXAMPLES[op].result as never;
      },
      async close() {},
    }),
  });
  client = await ViceSessionClient.open({ videoStandard: "pal", env: { C64RT_HOST: `${server.host}:${server.port}` } });
  for (const [op, example] of Object.entries(EXAMPLES)) {
    assert.deepEqual(await example.call(client), example.result, op);
    assert.deepEqual(seen.get(op)?.params, example.params, `${op} parameters`);
    assert.equal(seen.get(op)?.attachments, example.attachments ?? 0, `${op} attachments`);
  }
});
