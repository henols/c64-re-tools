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

import { readZ80 } from "../../../src/spectrum.ts";
import { COUNT, FRAMES_SEEN, HALT_AT, keyboardCounterSnapshot, PRESSES } from "../../fixtures/z80/keyboard-counter.ts";
import { startMcp } from "../../kit.ts";
import { startHost, stopHosts } from "../vice/live.ts";

const zesarux = process.env.C64RT_LIVE_ZESARUX;
const skip = zesarux === undefined ? "live ZEsarUX: set C64RT_LIVE_ZESARUX=/absolute/path/to/zesarux to run" : false;

const project = mkdtempSync(join(tmpdir(), "c64-re-tools-spectrum-mcp-"));
mkdirSync(join(project, ".c64-re-tools"));
writeFileSync(join(project, "counter.z80"), keyboardCounterSnapshot());
writeFileSync(join(project, "bytes.bin"), Uint8Array.from([0x11, 0x22, 0x33]));
after(async () => {
  await stopHosts();
  rmSync(project, { recursive: true, force: true });
});

const json = (result: CallToolResult) => JSON.parse((result.content[0] as { text: string }).text) as Record<string, unknown>;

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
    const ranges = (json(await call("memmap", { action: "read" })).ranges as Array<{ start: string; flags: number }>).filter((range) => range.start === "$8000" || range.start === "$8030");
    assert.ok(ranges.every((range) => (range.flags & 4) !== 0) && ranges.length === 2, JSON.stringify(ranges));
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
    const before = (await call("registers", { action: "read" })).pc;
    await call("execution", { action: "step", count: 1 });
    assert.equal(((await call("cpu_history", { count: 1 })).pcs as string[])[0], before);

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
    assert.match((ay.content[0] as { text: string }).text, /not-implemented.*48K has no AY/);
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
    await call("execution", { action: "step", count: 2 });
    const halted = await call("registers", { action: "read" });
    await call("snapshot", { action: "save", name: "halted" });
    await call("execution", { action: "advance-frames", count: 1 });
    await call("snapshot", { action: "restore", name: "halted" });
    assert.deepEqual(await call("registers", { action: "read" }), halted);
    assert.equal((await call("execution", { action: "step", count: 1 })).pc, halted.pc, "the CPU waits in the HALT");
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
    assert.equal(Number.parseInt(((await call("registers", { action: "read" })).af as string).slice(1, 3), 16) & 0x1f, 0x1f);
    await call("joystick", {});

    // The memmap gives only what the CPU did: instruction starts, CPU writes, no reads.
    await call("memmap", { action: "clear" });
    await call("memory_write", { address: "$9200", data: "01" });
    await call("memory_read", { address: "$9000", size: 16 });
    await call("registers", { action: "write", values: { pc: "$8000" } });
    await call("execution", { action: "advance-frames", count: 2 });
    const ranges = (await call("memmap", { action: "read" })).ranges as Array<{ start: string; end: string; flags: number }>;
    const flags = (address: number) => ranges.find((range) => Number.parseInt(range.start.slice(1), 16) <= address && Number.parseInt(range.end.slice(1), 16) >= address)?.flags ?? 0;
    assert.equal(flags(0x8008), 4, "IM 1 ran");
    assert.equal(flags(0x8009), 0, "the second byte of IM 1 is no instruction");
    assert.equal(flags(0x8018), 4, "IN A,(C) ran");
    assert.equal(flags(0x8019), 0);
    assert.equal(flags(FRAMES_SEEN), 2, "INC (HL) wrote the frame counter");
    assert.equal(flags(0x9200), 0, "the write of the tool is not in the map");
    assert.ok(ranges.every((range) => (range.flags & (1 | 8)) === 0), "no reads");

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
