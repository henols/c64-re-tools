// Real-VICE checks for breakpoints, watchpoints and typed conditions.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { ProcessSupervisor } from "../../../src/host/processes.ts";
import type { ViceSessionHandle } from "../../../src/host/server.ts";
import { viceSessionFactory } from "../../../src/host/vice/session.ts";
import { liveEnv, liveSkip } from "./live.ts";

// $c000: SEI ; LDX #$00 ; $c003: INX ; $c004: STX $c100 ; $c007: CPX #$0a ; BNE $c003 ; $c00b: JMP $c00b
const PROGRAM = "78a200e88e00c1e00ad0f84c0bc0";

let session: ViceSessionHandle;
before(async () => {
  if (liveSkip !== false) return;
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  session = await viceSessionFactory({ supervisor, env: liveEnv() })({ videoStandard: "pal" });
});
after(async () => {
  await session?.close();
});

async function startProgram(): Promise<void> {
  await session.handle("execution", { action: "pause", space: "c64" });
  await session.handle("memoryWrite", { address: 0xc000, data: PROGRAM, space: "c64", view: "cpu" });
  await session.handle("memoryWrite", { address: 0xc100, data: "00", space: "c64", view: "cpu" });
  await session.handle("registersSet", { space: "c64", values: { pc: 0xc000 } });
  await session.handle("execution", { action: "resume", space: "c64" });
}

/** Polls (no fixed sleep) until the machine has stopped; returns its pc. */
async function stopped(timeoutMs = 10_000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const status = await session.handle("status", {});
    if (status.state === "stopped") return status.pc!;
    if (Date.now() > deadline) throw new Error("the machine did not stop");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
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
  await startProgram();
  assert.equal(await stopped(), 0xc003);
  assert.equal((await session.handle("registersGet", { space: "c64" })).x, 5);

  // Disabled, it no longer stops; another breakpoint at the end does.
  await session.handle("breakpoint", { action: "disable", id: (point as { id: number }).id });
  await session.handle("breakpoint", { action: "add", address: 0xc00b, space: "c64" });
  await session.handle("execution", { action: "resume", space: "c64" });
  assert.equal(await stopped(), 0xc00b);
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
  const pc = await stopped();
  assert.equal((await session.handle("memoryRead", { address: 0xc100, size: 1, space: "c64", view: "cpu" })).data, "03");
  assert.equal((await session.handle("registersGet", { space: "c64" })).x, 3);
  assert.ok(pc === 0xc004 || pc === 0xc007, `stopped at $${pc.toString(16)}`);
  await removeAll();
});

test("a raster-conditioned breakpoint stops on that raster line", { skip: liveSkip, timeout: 60_000 }, async () => {
  // Every pass of the loop at $c00b checks the condition; it holds on line 100.
  await session.handle("breakpoint", { action: "add", address: 0xc00b, space: "c64", condition: { kind: "raster", line: 100 } });
  await startProgram();
  assert.equal(await stopped(), 0xc00b);
  const raster = await session.handle("memoryRead", { address: 0xd012, size: 1, space: "c64", view: "cpu" });
  assert.equal(Number.parseInt(raster.data, 16), 100);
  await removeAll();
});
