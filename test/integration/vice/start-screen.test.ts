// The start screen code of the loader in a real VICE: it waits without
// input, a joystick direction does not end the wait, and a fire button on
// port 1 or port 2 ends it when it is released. A VICE whose joystick input
// is broken refuses the joystick, and then the test skips. Opt-in with
// C64RT_LIVE_VICE; ACME is necessary too.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { START_SCREEN_CODE } from "../../../skills/retro-source/scripts/lib/loader.ts";
import { assemble } from "../../../src/native/acme.ts";
import { ACME, findTool } from "../../../src/native/discover.ts";
import { localToolContext } from "../../../src/native/local.ts";
import { ProcessSupervisor } from "../../../src/native/processes.ts";
import type { ViceSessionHandle } from "../../../src/host/server.ts";
import { viceSessionFactory } from "../../../src/host/vice/session.ts";
import { liveEnv, liveLog, liveSkip } from "./live.ts";

let skip: string | false = liveSkip;
if (skip === false) {
  try {
    findTool(ACME);
  } catch {
    skip = "ACME is necessary: install acme or set C64RT_ACME to run this test";
  }
}

let session: ViceSessionHandle | undefined;
before(async () => {
  if (skip !== false) return;
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  session = await viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog })({ videoStandard: "pal" });
});
after(async () => {
  await session?.close();
});

/** The start screen code at $c000 for a text screen at $0400 with one colour, then a JMP to itself. */
async function build(): Promise<{ program: Buffer; wait: number; done: number }> {
  const values = { d011: 0x1b, d016: 0x08, d018: 0x15, bank: 3, border: 14, background: 6, colour_mode: 1, colour: 1, colours: 0 };
  const text = ["!cpu 6510", "* = $c000", ...Object.entries(values).map(([name, value]) => `c64_source_ss_${name} = ${value}`), "!zone c64_source_start_screen {", '!source "start_screen.asm"', "}", "done    jmp done"].join("\n");
  const files = [{ path: "test.asm", text }, { path: "start_screen.asm", text: START_SCREEN_CODE }];
  const contents = files.map((file) => Buffer.from(file.text));
  const { result, attachments } = await assemble({ files: files.map((file, index) => ({ path: file.path, size: contents[index]!.length })), entrySource: "test.asm", includeDirs: [], defines: {} }, contents, localToolContext());
  assert.equal(result.assembled, true, JSON.stringify(result.diagnostics));
  const value = (name: string) => {
    const symbol = result.symbols!.find((item) => item.name === name)!;
    return symbol.kind === "address" ? symbol.address : symbol.value;
  };
  return { program: attachments![0]!, wait: value("loader_start_screen_wait"), done: value("done") };
}

/** Starts the code with SEI and $01 = $34, as the copier has them. */
async function start(code: { program: Buffer }): Promise<void> {
  await session!.handle("reset", { mode: "hard", run: true });
  await session!.handle("execution", { action: "advance-frames", count: 150, space: "c64" });
  await session!.handle("memoryWrite", { address: 0xc000, data: code.program.subarray(2).toString("hex"), space: "c64", view: "ram" });
  await session!.handle("memoryWrite", { address: 0x0001, data: "34", space: "c64", view: "cpu" });
  await session!.handle("registersSet", { space: "c64", values: { pc: 0xc000, flags: { i: true } } });
}

const runTo = async (address: number, frames: number) => (await session!.handle("runUntil", { target: { kind: "address", address, space: "c64" }, timeoutFrames: frames })).reached;

test("the start screen waits without input, a joystick direction does not end the wait, and a fire button ends it when it is released", { skip, timeout: 120_000 }, async (t) => {
  const code = await build();
  await start(code);
  assert.equal(await runTo(code.wait, 50), true, "the screen is set up");
  assert.equal(await runTo(code.done, 25), false, "without input the wait goes on");
  try {
    await session!.handle("joystick", { port: 1, direction: "up", fire: false });
  } catch (error) {
    if ((error as { code?: string }).code !== "not-implemented") throw error;
    t.skip("this VICE has no joystick input");
    return;
  }
  assert.equal(await runTo(code.done, 25), false, "a direction of joystick 1 is not a key");
  // A move of joystick 1 between the two reads of one poll is not a key either.
  for (let move = 0; move < 12; move++) {
    await session!.handle("joystick", { port: 1, direction: move % 2 === 0 ? "center" : "down-right", fire: false });
    assert.equal(await runTo(code.done, 1 + (move % 3)), false, `move ${move} of joystick 1`);
  }
  for (const port of [2, 1] as const) {
    await start(code);
    assert.equal(await runTo(code.wait, 50), true);
    await session!.handle("joystick", { port: 1, direction: "center", fire: false });
    assert.equal(await runTo(code.done, 10), false, "the wait is past its first phase: nothing was pressed");
    await session!.handle("joystick", { port, direction: "center", fire: true });
    assert.equal(await runTo(code.done, 25), false, `port ${port}: the wait ends only after the release`);
    await session!.handle("joystick", { port, direction: "center", fire: false });
    assert.equal(await runTo(code.done, 25), true, `port ${port}: the fire button ends the wait`);
  }
  const ports = Buffer.from((await session!.handle("ioRead", { address: 0xdc02, size: 2 })).data, "hex");
  assert.deepEqual([...ports], [0xff, 0x00], "the data directions of CIA 1 are as before");
});
