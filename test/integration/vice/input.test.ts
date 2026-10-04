// Real-VICE checks for keyboard and joystick input.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { textToPetscii } from "../../../src/c64.ts";
import { ProcessSupervisor } from "../../../src/native/processes.ts";
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

/** The text screen at $0400 as rows of characters (screen codes 1-26 shown as A-Z). */
async function screenText(): Promise<string> {
  const { data } = await session.handle("memoryRead", { address: 0x0400, size: 1000, space: "c64", view: "cpu" });
  const bytes = Buffer.from(data, "hex");
  let text = "";
  for (let row = 0; row < 25; row++) {
    for (const code of bytes.subarray(row * 40, row * 40 + 40)) text += code < 32 ? String.fromCharCode(code + 64) : String.fromCharCode(code);
    text += "\n";
  }
  return text;
}

/** Polls (no fixed sleep) until `check` passes. */
async function eventually(check: () => Promise<boolean>, what: string, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(`${what} did not happen in ${timeoutMs} ms`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

test("typed text reaches BASIC", { skip: liveSkip, timeout: 60_000 }, async () => {
  await session.handle("reset", { mode: "hard", run: true });
  await eventually(async () => (await screenText()).includes("READY."), "the READY prompt");
  const petscii = textToPetscii("print 7*6\n");
  assert.deepEqual(await session.handle("keyboard", { data: Buffer.from(petscii).toString("hex") }), { queuedBytes: petscii.length });
  await eventually(async () => /^ 42 *$/m.test(await screenText()), "the answer 42");
});

test("a running program reads both joysticks through the CIA ports", { skip: liveSkip, timeout: 60_000 }, async () => {
  await session.handle("execution", { action: "pause", space: "c64" });
  // $c000: SEI ; loop: LDA $DC00 ; STA $C100 ; LDA $DC01 ; STA $C101 ; JMP loop
  await session.handle("memoryWrite", { address: 0xc000, data: "78ad00dc8d00c1ad01dc8d01c14c01c0", space: "c64", view: "cpu" });
  // Port A must output 1s on the joystick lines; the KERNAL leaves $7f there.
  await session.handle("memoryWrite", { address: 0xdc00, data: "ff", space: "c64", view: "cpu" });
  await session.handle("registersSet", { space: "c64", values: { pc: 0xc000 } });
  await session.handle("joystick", { port: 2, direction: "up-left", fire: true });
  await session.handle("joystick", { port: 1, direction: "right", fire: false });
  await session.handle("execution", { action: "resume", space: "c64" });
  const seen = async () => (await session.handle("memoryRead", { address: 0xc100, size: 2, space: "c64", view: "cpu" })).data;
  // Port 2 is $dc00: up (bit 0), left (bit 2) and fire (bit 4) pulled low. Port 1 is $dc01: right (bit 3) low.
  await eventually(async () => {
    const [dc00, dc01] = Buffer.from(await seen(), "hex");
    return (dc00! & 0x1f) === 0x0a && (dc01! & 0x1f) === 0x17;
  }, "the joystick lines");
  await session.handle("joystick", { port: 2, direction: "center", fire: false });
  await eventually(async () => (Buffer.from(await seen(), "hex")[0]! & 0x1f) === 0x1f, "the released joystick");
});
