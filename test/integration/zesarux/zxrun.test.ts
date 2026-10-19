// The replay core zxrun against the live emulator ZEsarUX: the same frame cycle
// at the mark of each contention program (test/fixtures/z80/contention.ts), on
// the 48K and the 128K. Needs ZEsarUX (C64RT_LIVE_ZESARUX, its absolute path)
// and zxrun (tools/install-zxrun.sh or C64RT_ZXRUN).

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { launchZesarux } from "../../../src/host/zesarux/process.ts";
import { findTool, ZXRUN } from "../../../src/native/discover.ts";
import { ProcessSupervisor } from "../../../src/native/processes.ts";
import { ZX_FRAME_CYCLES, ZxRunSession } from "../../../src/native/zxrun.ts";
import { CONTENTION_CASES, contentionSnapshot } from "../../fixtures/z80/contention.ts";

const zesarux = process.env.C64RT_LIVE_ZESARUX;
let noZxrun: string | false = false;
try {
  findTool(ZXRUN);
} catch {
  noZxrun = "zxrun is not installed: run tools/install-zxrun.sh or set C64RT_ZXRUN";
}
const skip = zesarux === undefined ? "live ZEsarUX: set C64RT_LIVE_ZESARUX=/absolute/path/to/zesarux to run" : noZxrun;

const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-zxrun-zesarux-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

test("zxrun and ZEsarUX reach each mark at the same frame cycle, with the delays of contended memory", { skip, timeout: 600_000 }, async () => {
  const supervisor = new ProcessSupervisor();
  const context = { supervisor, signal: new AbortController().signal, env: process.env };
  const rows: string[] = [];
  try {
    for (const [name, item] of Object.entries(CONTENTION_CASES)) {
      const { bytes, mark } = contentionSnapshot(item);
      const file = join(scratch, `${name}.z80`);
      writeFileSync(file, bytes);
      const core = await ZxRunSession.open(context);
      let replayed: number;
      try {
        await core.init(item.model);
        await core.loadZ80(file);
        replayed = (await core.status(`run-pc ${mark.toString(16)} ${4 * ZX_FRAME_CYCLES[item.model]}`)).tick % ZX_FRAME_CYCLES[item.model];
      } finally {
        await core.close();
      }
      const emulator = await launchZesarux({ supervisor, machine: item.model === "48k" ? "spectrum48" : "spectrum128", env: { ...process.env, C64RT_ZESARUX: zesarux! } });
      let live: number;
      try {
        const zrcp = (text: string, timeoutMs?: number) => emulator.zrcp.command(text, timeoutMs);
        await zrcp("enter-cpu-step");
        // The breakpoint comes first: smartload lets the CPU run until the next enter-cpu-step.
        await zrcp("enable-breakpoints");
        await zrcp(`set-breakpoint 1 PC=${mark.toString(16)}H`);
        await zrcp(`smartload ${file}`);
        await zrcp("enter-cpu-step");
        live = Number(/TSTATES: (\d+)/.exec(await zrcp("run", 20_000))?.[1]);
      } finally {
        await emulator.stop();
      }
      if (replayed !== live || live !== item.cycle) rows.push(`${name}: zxrun ${replayed}, ZEsarUX ${live}, the fixture ${item.cycle}`);
    }
  } finally {
    await supervisor.stopAll();
  }
  assert.deepEqual(rows, []);
});
