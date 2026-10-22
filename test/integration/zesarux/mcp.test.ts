// The spectrum MCP server end to end: a Host Runtime with ZEsarUX, the MCP
// server with --machine spectrum over stdio, and its tools on the keyboard
// counter (test/fixtures/z80). Needs ZEsarUX on the host: set
// C64RT_LIVE_ZESARUX to the absolute path of zesarux.

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { SpectrumSessionClient } from "../../../src/host-client/spectrum-session.ts";
import { readZ80, writeZ80 } from "../../../src/spectrum.ts";
import { COUNT, COUNTER_START, FRAMES_SEEN, HALT_AT, keyboardCounterRam, keyboardCounterSnapshot, PRESSES } from "../../fixtures/z80/keyboard-counter.ts";
import { startMcp } from "../../kit.ts";
import { startHost, stopHosts } from "../vice/live.ts";

const zesarux = process.env.C64RT_LIVE_ZESARUX;
const skip = zesarux === undefined ? "live ZEsarUX: set C64RT_LIVE_ZESARUX=/absolute/path/to/zesarux to run" : false;

const project = mkdtempSync(join(tmpdir(), "c64-re-tools-spectrum-mcp-"));
mkdirSync(join(project, ".c64-re-tools"));
writeFileSync(join(project, "counter.z80"), keyboardCounterSnapshot());
writeFileSync(join(project, "bytes.bin"), Uint8Array.from([0x11, 0x22, 0x33]));
/** The AY registers of the 128K snapshot: tone, mixer and volume values that are not 0. */
const AY_REGISTERS = [0x10, 0x01, 0x20, 0x02, 0x30, 0x03, 0x1f, 0x38, 0x0f, 0x0e, 0x0d, 0x00, 0x10, 0x09, 0x00, 0x00];
// The keyboard counter as a 128K snapshot: banks 5, 2 and 0 at $4000-$ffff, and the 48K BASIC ROM paged in.
const ram = keyboardCounterRam();
const banks = Array.from({ length: 8 }, () => new Uint8Array(0x4000));
[5, 2, 0].forEach((bank, index) => banks[bank]!.set(ram.subarray(index * 0x4000, (index + 1) * 0x4000)));
writeFileSync(
  join(project, "counter128.z80"),
  writeZ80({
    model: "128k",
    registers: { pc: COUNTER_START, sp: 0xff00, af: 0, bc: 0, de: 0, hl: 0, ix: 0, iy: 0x5c3a, af2: 0, bc2: 0, de2: 0, hl2: 0, i: 0x3f, r: 0, im: 1, iff1: false, iff2: false },
    border: 1,
    port7ffd: 0x10,
    banks,
    ay: { registers: AY_REGISTERS, selected: 7 },
  }),
);
/** A TAP block: its length, the bytes and their XOR. */
const tapBlock = (bytes: number[]) => [bytes.length + 1, (bytes.length + 1) >> 8, ...bytes, bytes.reduce((xor, byte) => xor ^ byte, 0)];
// A BASIC tape that starts at line 10: 10 POKE 40000,42.
const POKED = 40_000;
const basic = [0x00, 0x0a, 0x16, 0x00, 0xf4, ...Buffer.from("40000"), 0x0e, 0x00, 0x00, 0x40, 0x9c, 0x00, 0x2c, ...Buffer.from("42"), 0x0e, 0x00, 0x00, 0x2a, 0x00, 0x00, 0x0d];
const header = [0x00, 0x00, ...Buffer.from("poke      "), basic.length, 0x00, 0x0a, 0x00, basic.length, 0x00];
writeFileSync(join(project, "poke.tap"), Uint8Array.from([...tapBlock(header), ...tapBlock([0xff, ...basic])]));
// A PNG file with the name of a snapshot.
writeFileSync(join(project, "bad.z80"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array<number>(60_000).fill(0x41)]));
// The same snapshot for a +3: hardware mode 7 in the header of a version 3 .z80.
const plus3 = readFileSync(join(project, "counter128.z80"));
plus3[34] = 7;
writeFileSync(join(project, "plus3.z80"), plus3);
after(async () => {
  await stopHosts();
  rmSync(project, { recursive: true, force: true });
});

const json = (result: CallToolResult) => JSON.parse((result.content[0] as { text: string }).text) as Record<string, unknown>;
/** The flags of an address in the ranges of a memmap read. */
const flagsAt = (ranges: Array<{ start: string; end: string; flags: number }>, address: number) =>
  ranges.find((range) => Number.parseInt(range.start.slice(1), 16) <= address && Number.parseInt(range.end.slice(1), 16) >= address)?.flags ?? 0;

test("the spectrum MCP server runs, stops, steps and reads a Spectrum on ZEsarUX", { skip, timeout: 120_000 }, async () => {
  const host = await startHost({ ...process.env, C64RT_ZESARUX: zesarux! });
  const { client } = await startMcp(host.address, { args: ["--machine", "spectrum"], cwd: project });
  try {
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const result = (await client.callTool({ name, arguments: args })) as CallToolResult;
      assert.notEqual(result.isError, true, `${name}: ${(result.content[0] as { text: string }).text}`);
      return result;
    };
    const tools = (await client.listTools()).tools.map((tool) => tool.name);
    assert.ok(tools.includes("ula") && tools.includes("memory_read") && !tools.includes("vicii"), tools.join(", "));

    assert.equal(json(await call("autostart", { path: "counter.z80" })).state, "running");
    assert.equal(json(await call("execution", { action: "pause" })).stopReason, "pause");
    const added = json(await call("breakpoint", { action: "add", address: `$${COUNT.toString(16)}` })) as { points: Array<{ id: number }> };
    // SPACE down until COUNT: the breakpoint stops the keys.
    const pressed = json(await call("keyboard", { keys: ["space"], frames: 5 }));
    assert.deepEqual([pressed.stopReason, pressed.pc, pressed.pointId], ["breakpoint", "$8030", added.points[0]!.id]);
    assert.equal(json(await call("registers", { action: "read" })).pc, "$8030");
    await call("breakpoint", { action: "remove", id: added.points[0]!.id });
    assert.equal(json(await call("execution", { action: "advance-frames", count: 10 })).stopReason, "frames");
    const presses = json(await call("memory_read", { address: `$${PRESSES.toString(16)}`, size: 3 }));
    // One press of SPACE was counted before the breakpoint; ten frames without keys add none to the presses.
    assert.equal((presses.data as string).slice(0, 2), "01");
    const listing = json(await call("disassemble", { address: "$8030", count: 3 })) as { instructions: Array<{ text: string }> };
    assert.deepEqual(listing.instructions.map((item) => item.text), ["ld hl,$9000", "inc (hl)", "ld a,(hl)"]);
    const reached = json(await call("run_until", { address: "$8023", timeoutFrames: 5 }));
    assert.deepEqual([reached.reached, reached.pc], [true, "$8023"]);
    const ranges = json(await call("memmap", { action: "read" })).ranges as Array<{ start: string; end: string; flags: number }>;
    assert.ok([0x8000, 0x8030].every((address) => (flagsAt(ranges, address) & 4) !== 0), JSON.stringify(ranges));
    const screen = await call("screen");
    assert.equal((screen.content[1] as { mimeType: string }).mimeType, "image/png");
    await call("snapshot", { action: "export", out: "state.z80" });
    assert.equal(readZ80(readFileSync(join(project, "state.z80"))).registers.pc, 0x8023);
    assert.equal(json(await call("ula")).border !== undefined, true);
    assert.equal(json(await call("reset", { run: false })).state, "stopped");
  } finally {
    await client.close();
    await host.stop();
  }
});

test("the spectrum MCP server watches, writes, searches, times, types and keeps snapshots on ZEsarUX", { skip, timeout: 120_000 }, async () => {
  const host = await startHost({ ...process.env, C64RT_ZESARUX: zesarux! });
  const { client } = await startMcp(host.address, { args: ["--machine", "spectrum"], cwd: project });
  try {
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const result = (await client.callTool({ name, arguments: args })) as CallToolResult;
      assert.notEqual(result.isError, true, `${name}: ${(result.content[0] as { text: string }).text}`);
      return json(result);
    };
    const byte = async (address: number) => Number.parseInt((await call("memory_read", { address: `$${address.toString(16)}`, size: 1 })).data as string, 16);

    await call("autostart", { path: "counter.z80" });
    assert.equal((await call("execution", { action: "pause" })).state, "stopped");

    // The frame counter is written once a frame: the watchpoint stops after INC (HL), at the HALT or,
    // as ZEsarUX 13.0 does here, after it.
    const watched = (await call("watchpoint", { action: "add", start: `$${FRAMES_SEEN.toString(16)}`, access: "write" })) as { points: Array<{ id: number }> };
    const hit = await call("execution", { action: "advance-frames", count: 5 });
    assert.deepEqual([hit.stopReason, hit.pointId], ["watchpoint", watched.points[0]!.id]);
    assert.ok([HALT_AT, HALT_AT + 1].includes(Number.parseInt((hit.pc as string).slice(1), 16)), String(hit.pc));
    await call("watchpoint", { action: "remove", id: watched.points[0]!.id });
    assert.deepEqual((await call("watchpoint", { action: "list" })).points, []);

    // Memory: a write, a read back and a search with a wildcard.
    assert.equal((await call("memory_write", { address: "$9100", data: "deadbeef" })).bytesWritten, 4);
    assert.equal((await call("memory_read", { address: "$9100", size: 4 })).data, "deadbeef");
    assert.deepEqual((await call("memory_search", { start: "$9000", end: "$91ff", pattern: "dead??ef" })).matches, ["$9100"]);
    await call("program_load", { path: "bytes.bin", address: "$9200" });
    assert.equal((await call("memory_read", { address: "$9200", size: 3 })).data, "112233");

    // Registers, one step and the history.
    const written = await call("registers", { action: "write", values: { bc: 0x1234, hl2: "$abcd", i: 0x3f } });
    assert.deepEqual([written.bc, written.hl2, written.i], ["$1234", "$abcd", 0x3f]);
    // The CPU can wait in the HALT here: then the step is a cycle of the HALT, and the history gives the address of the HALT.
    const before = await call("registers", { action: "read" });
    await call("execution", { action: "step", count: 1 });
    const stepped = Number.parseInt((before.pc as string).slice(1), 16) - (before.waitsForInterrupt === true ? 1 : 0);
    assert.equal(((await call("cpu_history", { count: 1 })).pcs as string[])[0], `$${stepped.toString(16).padStart(4, "0")}`);

    // Two frames are two frames of t-states.
    await call("timing", { action: "start" });
    await call("execution", { action: "advance-frames", count: 2 });
    const tstates = (await call("timing", { action: "read" })).tstates as number;
    assert.ok(Math.abs(tstates - 2 * 69_888) < 32, `${tstates} t-states in two frames`);

    // A capital letter holds CAPS SHIFT, which the counter counts; a small letter does not.
    const counted = await byte(PRESSES);
    assert.equal((await call("keyboard", { text: "a" })).typed, 1);
    assert.equal(await byte(PRESSES), counted);
    await call("keyboard", { text: "A" });
    assert.ok((await byte(PRESSES)) > counted, "CAPS SHIFT was counted");
    assert.equal((await call("joystick", { fire: true })).set, true);
    await call("joystick", {});

    // A snapshot brings back memory that changed after it.
    await call("snapshot", { action: "save", name: "before" });
    const kept = await byte(PRESSES);
    await call("memory_write", { address: `$${PRESSES.toString(16)}`, data: ((kept + 1) & 0xff).toString(16).padStart(2, "0") });
    await call("snapshot", { action: "restore", name: "before" });
    assert.equal(await byte(PRESSES), kept);
    assert.deepEqual((await call("snapshot", { action: "list" })).names, ["before"]);
    await call("snapshot", { action: "remove", name: "before" });
    assert.deepEqual((await call("snapshot", { action: "list" })).names, []);
    const ay = (await client.callTool({ name: "ay", arguments: {} })) as CallToolResult;
    assert.equal(ay.isError, true);
    assert.match((ay.content[0] as { text: string }).text, /invalid-input.*machine is a 48K now.*has no AY/);
  } finally {
    await client.close();
    await host.stop();
  }
});

test("the spectrum MCP server runs long, keeps the interrupt mode over a restore, and reports stops by their points", { skip, timeout: 300_000 }, async () => {
  const host = await startHost({ ...process.env, C64RT_ZESARUX: zesarux! });
  const { client } = await startMcp(host.address, { args: ["--machine", "spectrum"], cwd: project });
  try {
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      // A run of 600 frames takes 12 s of real time, and longer on a busy host.
      const result = (await client.callTool({ name, arguments: args }, undefined, { timeout: 240_000 })) as CallToolResult;
      assert.notEqual(result.isError, true, `${name}: ${(result.content[0] as { text: string }).text}`);
      return json(result);
    };
    const refusal = async (name: string, args: Record<string, unknown>) => {
      const result = (await client.callTool({ name, arguments: args })) as CallToolResult;
      assert.equal(result.isError, true, `${name} is refused`);
      return (result.content[0] as { text: string }).text;
    };
    await call("autostart", { path: "counter.z80" });
    await call("execution", { action: "pause" });
    const ula = await call("ula");
    assert.deepEqual([ula.model, ula.frameTstates], ["48k", 69_888]);

    // A run of more than 500 frames (about 10 s of real time) ends after its frames, and the clock counts them.
    await call("timing", { action: "start" });
    assert.equal((await call("execution", { action: "advance-frames", count: 600 })).stopReason, "frames");
    const tstates = (await call("timing", { action: "read" })).tstates as number;
    assert.ok(Math.abs(tstates - 600 * 69_888) < 32, `${tstates} t-states in 600 frames`);

    // A target with hex letters: run_until reaches it, a breakpoint there gives its id, and pause after a stop gives the stop again.
    const reached = await call("run_until", { address: "$801f", timeoutFrames: 5 });
    assert.deepEqual([reached.reached, reached.stopReason, reached.pc], [true, "target", "$801f"]);
    const timeout = await call("run_until", { address: "$0001", timeoutFrames: 2 });
    assert.deepEqual([timeout.reached, timeout.stopReason], [false, "timeout"]);
    const added = (await call("breakpoint", { action: "add", address: "$801f" })) as { points: Array<{ id: number }> };
    const id = added.points[0]!.id;
    await call("execution", { action: "resume" });
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.deepEqual(await call("execution", { action: "pause" }), { state: "stopped", pc: "$801f", stopReason: "breakpoint", pointId: id });
    // A run from the address of a breakpoint runs the loop one time before the breakpoint stops it again.
    await call("timing", { action: "start" });
    const hit = await call("execution", { action: "advance-frames", count: 3 });
    assert.deepEqual([hit.stopReason, hit.pointId, hit.pc], ["breakpoint", id, "$801f"]);
    assert.ok(((await call("timing", { action: "read" })).tstates as number) > 1000, "the CPU ran");

    // A restore keeps IM 1, turns no point off, and timed runs go on.
    assert.equal((await call("registers", { action: "read" })).im, 1);
    await call("snapshot", { action: "save", name: "im1" });
    await call("registers", { action: "write", values: { im: 2 } });
    assert.equal((await call("registers", { action: "read" })).im, 2);
    const before = await call("registers", { action: "read" });
    assert.deepEqual((await call("snapshot", { action: "restore", name: "im1" })).names, ["im1"]);
    const restored = await call("registers", { action: "read" });
    assert.deepEqual(restored, { ...before, im: 1 });
    const again = await call("execution", { action: "advance-frames", count: 3 });
    assert.deepEqual([again.stopReason, again.pointId], ["breakpoint", id]);
    assert.deepEqual((await call("breakpoint", { action: "remove", id })).points, []);
    assert.equal((await call("execution", { action: "advance-frames", count: 2 })).stopReason, "frames");
    // The CPU history records after the load too, and advance-frames without count runs one frame.
    assert.equal(((await call("cpu_history", { count: 4 })).pcs as string[]).length, 4);
    await call("timing", { action: "start" });
    assert.equal((await call("execution", { action: "advance-frames" })).stopReason, "frames");
    assert.ok(Math.abs(((await call("timing", { action: "read" })).tstates as number) - 69_888) < 32);

    // A restore of a CPU that waits in a HALT: IM 1 again, and the CPU still waits for the interrupt.
    await call("run_until", { address: `$${HALT_AT.toString(16)}`, timeoutFrames: 2 });
    assert.equal((await call("registers", { action: "read" })).waitsForInterrupt, false);
    assert.equal((await call("execution", { action: "step", count: 2 })).waitsForInterrupt, true);
    const halted = await call("registers", { action: "read" });
    assert.equal(halted.waitsForInterrupt, true);
    await call("snapshot", { action: "save", name: "halted" });
    await call("execution", { action: "advance-frames", count: 1 });
    await call("snapshot", { action: "restore", name: "halted" });
    assert.deepEqual(await call("registers", { action: "read" }), halted);
    // Each step in the HALT is one wait cycle: 4 t-states, R one more, the same PC. The history shows the cycles at the HALT, and the map does not mark the byte after it.
    await call("memmap", { action: "clear" });
    await call("timing", { action: "start" });
    assert.equal((await call("execution", { action: "step", count: 1 })).pc, halted.pc, "the CPU waits in the HALT");
    await call("execution", { action: "step", count: 4 });
    const cycled = await call("registers", { action: "read" });
    const r = halted.r as number;
    assert.deepEqual([cycled.pc, cycled.r, (await call("timing", { action: "read" })).tstates], [halted.pc, (r & 0x80) | ((r + 5) & 0x7f), 20]);
    const haltAt = `$${HALT_AT.toString(16)}`;
    assert.deepEqual((await call("cpu_history", { count: 6 })).pcs, [haltAt, haltAt, haltAt, haltAt, haltAt, haltAt]);
    const marked = (await call("memmap", { action: "read" })).ranges as Array<{ start: string; end: string; flags: number }>;
    assert.equal(flagsAt(marked, HALT_AT + 1), 0, JSON.stringify(marked));
    // A pc write ends the HALT: the CPU executes from the new pc, also with the interrupts off.
    await call("snapshot", { action: "save", name: "halted" });
    const waiting = await call("registers", { action: "read" });
    const moved = await call("registers", { action: "write", values: { pc: "$801f", iff1: false, iff2: false } });
    assert.deepEqual([moved.pc, moved.waitsForInterrupt, moved.sp, moved.r], ["$801f", false, waiting.sp, waiting.r]);
    assert.equal((await call("execution", { action: "step", count: 1 })).pc, "$8022");
    await call("snapshot", { action: "restore", name: "halted" });
    assert.match(await refusal("registers", { action: "write", values: { im: 2 } }), /Write pc in the same call/);
    assert.equal((await call("registers", { action: "write", values: { im: 2, pc: "$8023" } })).im, 2);
    await call("snapshot", { action: "restore", name: "halted" });
    const exported = await call("snapshot", { action: "export", out: "halted.z80" });
    assert.equal(readZ80(readFileSync(join(project, String(exported.out)))).registers.im, 1);
    assert.deepEqual((await call("snapshot", { action: "remove", name: "halted" })).names, ["im1"]);
    assert.match(await refusal("snapshot", { action: "export", out: "x.sna" }), /extension \.z80/);

    // The Kempston joystick is on port $1f only: the keyboard rows stay up.
    await call("run_until", { address: "$800b", timeoutFrames: 2 });
    await call("memory_write", { address: "$9100", data: "db1f3eefdbfe" });
    await call("registers", { action: "write", values: { pc: "$9100" } });
    await call("joystick", { right: true, fire: true });
    await call("execution", { action: "step", count: 1 });
    assert.equal(((await call("registers", { action: "read" })).af as string).slice(1, 3), "11");
    await call("execution", { action: "step", count: 2 });
    // No key down: the row reads $bf, as on a real 48K (issue 3) with no tape signal. Bits 5 and 7 are 1.
    assert.equal(((await call("registers", { action: "read" })).af as string).slice(1, 3), "bf");
    await call("joystick", {});

    // The memmap gives only what the CPU did: instruction starts, CPU writes, no reads.
    await call("memmap", { action: "clear" });
    await call("memory_write", { address: "$9200", data: "01" });
    await call("memory_read", { address: "$9000", size: 16 });
    await call("registers", { action: "write", values: { pc: "$8000" } });
    await call("execution", { action: "advance-frames", count: 2 });
    const ranges = (await call("memmap", { action: "read" })).ranges as Array<{ start: string; end: string; flags: number }>;
    const flags = (address: number) => flagsAt(ranges, address);
    // Adjacent addresses with the same flags are one range: the ROM interrupt handler at $0038 is one range of instruction starts.
    assert.ok(ranges.every((range, index) => index === 0 || ranges[index - 1]!.flags !== range.flags || Number.parseInt(ranges[index - 1]!.end.slice(1), 16) + 1 < Number.parseInt(range.start.slice(1), 16)), JSON.stringify(ranges));
    assert.ok(ranges.some((range) => range.start === "$0038" && range.end !== "$0038" && range.flags === 16), JSON.stringify(ranges));
    assert.equal(flags(0x8008), 4, "IM 1 ran");
    assert.equal(flags(0x8009), 0, "the second byte of IM 1 is no instruction");
    assert.equal(flags(0x8018), 4, "IN A,(C) ran");
    assert.equal(flags(0x8019), 0);
    assert.equal(flags(FRAMES_SEEN), 2, "INC (HL) wrote the frame counter");
    assert.equal(flags(0x9200), 0, "the write of the tool is not in the map");
    assert.ok(ranges.every((range) => (range.flags & (1 | 8)) === 0), "no reads");

    // DI and HALT: the wait never ends. After 20 frames the map cannot check the mark after the HALT, and names it.
    await call("memory_write", { address: "$9100", data: "f376" });
    await call("registers", { action: "write", values: { pc: "$9100" } });
    await call("memmap", { action: "clear" });
    await call("execution", { action: "advance-frames", count: 20 });
    const long = await call("memmap", { action: "read" });
    assert.deepEqual(long.uncheckedAfterHalt, ["$9102"]);
    assert.equal(flagsAt(long.ranges as Array<{ start: string; end: string; flags: number }>, 0x9102), 4);
    // A read after each run of 10 frames checks the mark: the map has no mark after the HALT, and names no address.
    await call("memmap", { action: "clear" });
    for (let run = 0; run < 2; run++) {
      await call("execution", { action: "advance-frames", count: 10 });
      const short = await call("memmap", { action: "read" });
      assert.equal(short.uncheckedAfterHalt, undefined);
      assert.equal(flagsAt(short.ranges as Array<{ start: string; end: string; flags: number }>, 0x9102), 0, JSON.stringify(short.ranges));
    }

    // Refusals: the ROM takes no write, and both text and keys.
    assert.match(await refusal("memory_write", { address: "$0000", data: "00" }), /ROM/);
    assert.match(await refusal("program_load", { path: "bytes.bin", address: "$0100" }), /ROM/);
    assert.match(await refusal("keyboard", { text: "a", keys: ["a"] }), /not both/);
    const typed = await call("keyboard", { text: "ab" });
    assert.deepEqual([typed.typed, typed.state, typed.stopReason], [2, "stopped", "frames"]);
  } finally {
    await client.close();
    await host.stop();
  }
});

test("a 48K session that loads a 128K snapshot runs as a 128K: autostart and ula tell the model, and a frame is 70908 t-states", { skip, timeout: 120_000 }, async () => {
  const host = await startHost({ ...process.env, C64RT_ZESARUX: zesarux! });
  const { client } = await startMcp(host.address, { args: ["--machine", "spectrum"], cwd: project, env: { C64RT_SPECTRUM_MODEL: "48k" } });
  try {
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const result = (await client.callTool({ name, arguments: args })) as CallToolResult;
      assert.notEqual(result.isError, true, `${name}: ${(result.content[0] as { text: string }).text}`);
      return json(result);
    };
    const frames = async (count: number) => {
      await call("timing", { action: "start" });
      assert.equal((await call("execution", { action: "advance-frames", count })).stopReason, "frames");
      return (await call("timing", { action: "read" })).tstates as number;
    };

    const started = await call("autostart", { path: "counter128.z80" });
    assert.deepEqual([started.state, started.model], ["running", "128k"]);
    await call("execution", { action: "pause" });
    const ula = await call("ula");
    assert.deepEqual([ula.model, ula.frameTstates, ula.rom], ["128k", 70_908, 1]);
    // The load gives the border and the AY of the file.
    assert.equal(ula.border, 1);
    assert.deepEqual(await call("ay"), { selected: 7, registers: AY_REGISTERS });
    await call("snapshot", { action: "export", out: "counter128-out.z80" });
    assert.deepEqual(readZ80(readFileSync(join(project, "counter128-out.z80"))).ay, { selected: 7, registers: AY_REGISTERS });
    const tstates = await frames(2);
    assert.ok(Math.abs(tstates - 2 * 70_908) < 32, `${tstates} t-states in two 128K frames`);
    // The AY takes the writes of the program.
    await call("memory_write", { address: "$9100", data: "01fdff3e07ed7906bf3e3eed79" });
    await call("registers", { action: "write", values: { pc: "$9100", iff1: false, iff2: false } });
    await call("execution", { action: "step", count: 6 });
    assert.equal(((await call("ay")).registers as number[])[7], 0x3e);
    // The program runs on the 128K: it counts its frames.
    const seen = Number.parseInt((await call("memory_read", { address: `$${FRAMES_SEEN.toString(16)}`, size: 1 })).data as string, 16);
    assert.ok(seen >= 2, `${seen} frames seen`);

    // A 48K snapshot makes it a 48K again.
    assert.equal((await call("autostart", { path: "counter.z80" })).model, "48k");
    await call("execution", { action: "pause" });
    assert.equal((await call("ula")).frameTstates, 69_888);
    const tstates48 = await frames(2);
    assert.ok(Math.abs(tstates48 - 2 * 69_888) < 32, `${tstates48} t-states in two 48K frames`);

    // A tape runs on the model that the session started with, also after a 128K snapshot, and model selects the other model.
    assert.equal((await call("autostart", { path: "counter128.z80" })).model, "128k");
    assert.equal((await call("autostart", { path: "poke.tap" })).model, "48k");
    await call("execution", { action: "pause" });
    assert.equal((await call("ula")).frameTstates, 69_888);
    let poked = "00";
    for (let run = 0; run < 20 && poked !== "2a"; run++) {
      await call("execution", { action: "advance-frames", count: 50 });
      poked = (await call("memory_read", { address: `$${POKED.toString(16)}`, size: 1 })).data as string;
    }
    assert.equal(poked, "2a", "the BASIC program of the tape ran on the 48K");
    assert.equal((await call("autostart", { path: "poke.tap", model: "128k" })).model, "128k");
    await call("execution", { action: "pause" });
    assert.equal((await call("ula")).frameTstates, 70_908);
    const refused = (await client.callTool({ name: "autostart", arguments: { path: "counter.z80", model: "48k" } })) as CallToolResult;
    assert.equal(refused.isError, true);
    assert.match((refused.content[0] as { text: string }).text, /invalid-input.*model is only for a tape/);
    assert.equal((await call("autostart", { path: "counter.z80" })).model, "48k");
    await call("execution", { action: "pause" });

    // A file that is not what its extension says is refused, and the machine does not change.
    const bad = (await client.callTool({ name: "autostart", arguments: { path: "bad.z80" } })) as CallToolResult;
    assert.equal(bad.isError, true);
    assert.match((bad.content[0] as { text: string }).text, /invalid-input.*not a \.z80 snapshot/);
    assert.equal((await call("ula")).model, "48k");

    // A +3 snapshot is refused: the session is a 48K again, from a reset, and it runs.
    const plus3 = await client.callTool({ name: "autostart", arguments: { path: "plus3.z80" } }) as CallToolResult;
    assert.equal(plus3.isError, true);
    assert.match((plus3.content[0] as { text: string }).text, /The file is for the ZX Spectrum \+3.*The emulator is a ZX Spectrum 48K again, after a reset\./);
    assert.deepEqual([(await call("ula")).model, (await call("registers", { action: "read" })).pc], ["48k", "$0000"]);
    assert.ok(Math.abs((await frames(2)) - 2 * 69_888) < 32);
    assert.equal((await call("autostart", { path: "counter128.z80" })).model, "128k");
  } finally {
    await client.close();
    await host.stop();
  }
});

test("autostart with run false of the session client keeps the CPU at the PC of the snapshot, and no t-states pass", { skip, timeout: 120_000 }, async () => {
  const host = await startHost({ ...process.env, C64RT_ZESARUX: zesarux! });
  const session = await SpectrumSessionClient.open({ machine: "spectrum48", env: { ...process.env, C64RT_HOST: host.address } });
  try {
    await session.timing({ action: "start" });
    assert.deepEqual(await session.autostartBytes({ type: "z80", bytes: keyboardCounterSnapshot(), run: false }), { state: "stopped", pc: COUNTER_START, model: "48k" });
    assert.equal((await session.timing({ action: "read" })).tstates, 0);
    // The CPU stays stopped also after some real time.
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal((await session.registersGet()).pc, COUNTER_START);
    assert.equal((await session.timing({ action: "read" })).tstates, 0);
    // The frames count from the PC of the snapshot.
    assert.equal((await session.execution({ action: "advance-frames", count: 1 })).stopReason, "frames");
    assert.ok(Math.abs((await session.timing({ action: "read" })).tstates - 69_888) < 32);
    const refused = await session.autostartBytes({ type: "tap", bytes: Uint8Array.from([0]), run: false }).then(
      () => "",
      (error: unknown) => String(error),
    );
    assert.match(refused, /run false is only for a snapshot/);
  } finally {
    await session.close();
    await host.stop();
  }
});
