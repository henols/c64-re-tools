// Real-VICE checks for keyboard and joystick input.

import assert from "node:assert/strict";
import { test } from "node:test";

import { textToPetscii } from "../../../src/c64.ts";
import { waitFor } from "../../kit.ts";
import { fileSession, liveSkip, screenOf } from "./live.ts";

const session = fileSession();

test("typed text reaches BASIC", { skip: liveSkip, timeout: 60_000 }, async () => {
  await session.handle("reset", { mode: "hard", run: true });
  await waitFor(async () => (await screenOf(session)).includes("READY."), "the READY prompt", 20_000, 100);
  const petscii = textToPetscii("print 7*6\n");
  assert.deepEqual(await session.handle("keyboard", { data: Buffer.from(petscii).toString("hex") }), { queuedBytes: petscii.length });
  await waitFor(async () => /^ 42 *$/m.test(await screenOf(session)), "the answer 42", 20_000, 100);
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
  await waitFor(async () => {
    const [dc00, dc01] = Buffer.from(await seen(), "hex");
    return (dc00! & 0x1f) === 0x0a && (dc01! & 0x1f) === 0x17;
  }, "the joystick lines", 20_000, 100);
  await session.handle("joystick", { port: 2, direction: "center", fire: false });
  await waitFor(async () => (Buffer.from(await seen(), "hex")[0]! & 0x1f) === 0x1f, "the released joystick", 20_000, 100);
});
