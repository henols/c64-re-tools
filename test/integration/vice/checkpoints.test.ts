// Real-VICE checks for breakpoints, watchpoints and typed conditions.

import assert from "node:assert/strict";
import { test } from "node:test";

import { fileSession, liveSkip, waitForStop } from "./live.ts";

// $c000: SEI ; LDX #$00 ; $c003: INX ; $c004: STX $c100 ; $c007: CPX #$0a ; BNE $c003 ; $c00b: JMP $c00b
const PROGRAM = "78a200e88e00c1e00ad0f84c0bc0";

const session = fileSession();

async function startProgram(): Promise<void> {
  await session.handle("execution", { action: "pause", space: "c64" });
  await session.handle("memoryWrite", { address: 0xc000, data: PROGRAM, space: "c64", view: "cpu" });
  await session.handle("memoryWrite", { address: 0xc100, data: "00", space: "c64", view: "cpu" });
  await session.handle("registersSet", { space: "c64", values: { pc: 0xc000 } });
  await session.handle("execution", { action: "resume", space: "c64" });
}

async function removeAll(): Promise<void> {
  for (const { id } of ((await session.handle("breakpoint", { action: "list" })) as { breakpoints: Array<{ id: number }> }).breakpoints) {
    await session.handle("breakpoint", { action: "remove", id });
  }
  for (const { id } of ((await session.handle("watchpoint", { action: "list" })) as { watchpoints: Array<{ id: number }> }).watchpoints) {
    await session.handle("watchpoint", { action: "remove", id });
  }
}

test("a conditional breakpoint stops only when its condition holds", { skip: liveSkip, timeout: 60_000 }, async () => {
  const point = await session.handle("breakpoint", {
    action: "add",
    address: 0xc003,
    space: "c64",
    condition: { kind: "register", register: "x", operator: "eq", value: 5 },
  });
  // The list shows the condition as it was given.
  const listed = (await session.handle("breakpoint", { action: "list" })) as { breakpoints: Array<{ id: number; condition?: unknown }> };
  assert.deepEqual(listed.breakpoints.find((entry) => entry.id === (point as { id: number }).id)?.condition, { kind: "register", register: "x", operator: "eq", value: 5 });
  await startProgram();
  assert.equal(await waitForStop(session), 0xc003);
  assert.equal((await session.handle("registersGet", { space: "c64" })).x, 5);

  // Disabled, it no longer stops; another breakpoint at the end does.
  await session.handle("breakpoint", { action: "disable", id: (point as { id: number }).id });
  await session.handle("breakpoint", { action: "add", address: 0xc00b, space: "c64" });
  await session.handle("execution", { action: "resume", space: "c64" });
  assert.equal(await waitForStop(session), 0xc00b);
  assert.equal((await session.handle("registersGet", { space: "c64" })).x, 10);
  await removeAll();
});

test("a write watchpoint's memory condition sees the memory after the write", { skip: liveSkip, timeout: 60_000 }, async () => {
  await session.handle("watchpoint", {
    action: "add",
    address: 0xc100,
    size: 1,
    access: "write",
    space: "c64",
    condition: { kind: "memory", address: 0xc100, operator: "eq", value: 3, space: "c64", view: "cpu" },
  });
  await startProgram();
  const pc = await waitForStop(session);
  assert.equal((await session.handle("memoryRead", { address: 0xc100, size: 1, space: "c64", view: "cpu" })).data, "03");
  assert.equal((await session.handle("registersGet", { space: "c64" })).x, 3);
  assert.ok(pc === 0xc004 || pc === 0xc007, `stopped at $${pc.toString(16)}`);
  await removeAll();
});

test("a raster-conditioned breakpoint stops on that raster line", { skip: liveSkip, timeout: 60_000 }, async () => {
  // Every pass of the loop at $c00b checks the condition; it holds on line 100.
  await session.handle("breakpoint", { action: "add", address: 0xc00b, space: "c64", condition: { kind: "raster", line: 100 } });
  await startProgram();
  assert.equal(await waitForStop(session), 0xc00b);
  const raster = await session.handle("memoryRead", { address: 0xd012, size: 1, space: "c64", view: "cpu" });
  assert.equal(Number.parseInt(raster.data, 16), 100);
  await removeAll();
});
