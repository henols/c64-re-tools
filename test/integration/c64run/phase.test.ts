// Live: the phase of the replay core. c64run must be installed (the dev container
// installs it, or C64RT_C64RUN). Two runs come to one entry at other points of the
// frame and of the CIA timers; align gives the second run the phase of the first.

import assert from "node:assert/strict";
import { test } from "node:test";

import { C64RunSession, PAL_FRAME_CYCLES } from "../../../src/native/c64run.ts";
import { C64RUN, findTool } from "../../../src/native/discover.ts";
import { localToolContext } from "../../../src/native/local.ts";

let skip: string | false = false;
try {
  findTool(C64RUN);
} catch {
  skip = "c64run is not installed: install c64run or set C64RT_C64RUN to run these tests";
}

// At $c000: LDA $dc04, STA $c100, LDA $d012, STA $c101, JMP *. At $c200: JMP $c000, the jump of a loader.
const ENTRY = Uint8Array.of(0xad, 0x04, 0xdc, 0x8d, 0x00, 0xc1, 0xad, 0x12, 0xd0, 0x8d, 0x01, 0xc1, 0x4c, 0x0c, 0xc0);
const JUMP = Uint8Array.of(0x4c, 0x00, 0xc0);

/** Comes to the entry after `delay` cycles more than the first run; gives the beam there and, after 2000 cycles, the timer and raster bytes. */
async function toEntry(core: C64RunSession, delay: number, at: (core: C64RunSession) => Promise<{ line: number; cycle: number; tick: number }>) {
  await core.init();
  await core.status(`run ${200 * PAL_FRAME_CYCLES + delay}`);
  await core.status("run-sync");
  await core.write(0xc000, ENTRY);
  await core.write(0xc200, JUMP);
  await core.status("goto c200");
  const entry = await at(core);
  await core.status(`run ${entry.tick + 2000}`);
  return { entry, bytes: Buffer.from(await core.peek(0xc100, 2)).toString("hex") };
}

test("align gives a run at its entry the beam position and the CIA timers of another run at its entry", { skip, timeout: 60_000 }, async () => {
  const core = await C64RunSession.open(localToolContext());
  try {
    let phase = "";
    const first = await toEntry(core, 0, async (session) => {
      await session.command("mark c000");
      const reached = await session.status(`run-pc c000 ${50_000_000}`);
      phase = /phase=([0-9a-f]+)/.exec(await session.command("marked"))![1]!;
      return reached;
    });
    // 1234 cycles later: another line, and another timer value.
    const late = await toEntry(core, 1234, (session) => session.status(`run-pc c000 ${50_000_000}`));
    assert.notEqual(late.bytes, first.bytes);
    const aligned = await toEntry(core, 1234, async (session) => {
      await session.status(`run-pc c000 ${50_000_000}`);
      return session.status(`align ${phase}`);
    });
    assert.deepEqual([aligned.entry.line, aligned.entry.cycle], [first.entry.line, first.entry.cycle]);
    assert.equal(aligned.bytes, first.bytes);
  } finally {
    await core.close();
  }
});
