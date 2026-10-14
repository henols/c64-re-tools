// The keyboard note of D55: no command presses one key of the matrix, and a
// wait for any key that reads all keyboard columns ends without input,
// because the joyport simulation on port 1 holds keyboard lines low.
// Opt-in with C64RT_LIVE_VICE.

import assert from "node:assert/strict";
import { after, test } from "node:test";

import { ViceSessionClient } from "../../../src/host-client/vice-session.ts";
import { ProcessSupervisor } from "../../../src/native/processes.ts";
import { startHostServer, type HostServer } from "../../../src/host/server.ts";
import { viceSessionFactory } from "../../../src/host/vice/session.ts";
import { liveEnv, liveLog, liveSkip } from "./live.ts";

let server: HostServer | undefined;
after(async () => {
  await server?.close();
});

const START = 0xc000;
const PRESSED = 0xc00e;
/** SEI; LDA #0; STA $DC00; wait: LDA $DC01; CMP #$FF; BEQ wait; NOP; pressed: JMP pressed. */
const program = [0x78, 0xa9, 0x00, 0x8d, 0x00, 0xdc, 0xad, 0x01, 0xdc, 0xc9, 0xff, 0xf0, 0xf9, 0xea, 0x4c, 0x0e, 0xc0];

test("a wait for any key that reads all keyboard columns ends without input", { skip: liveSkip, timeout: 120_000 }, async () => {
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  server = await startHostServer({ port: 0, createViceSession: viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog }) });
  const client = await ViceSessionClient.open({ videoStandard: "pal", env: { ...process.env, C64RT_HOST: `${server.host}:${server.port}` } });
  try {
    await client.reset({ mode: "hard", run: true });
    await client.execution({ action: "advance-frames", count: 150, space: "c64" });
    await client.memoryWrite({ address: START, data: Buffer.from(program).toString("hex"), space: "c64", view: "cpu" });
    await client.registersSet("c64", { pc: START });
    const ended = await client.runUntil({ target: { kind: "address", address: PRESSED, space: "c64" }, timeoutFrames: 25 });
    assert.equal(ended.reached, true);
  } finally {
    await client.close();
  }
});
