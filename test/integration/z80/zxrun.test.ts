// The replay core zxrun (tools/zxrun.c) for the 48K and the 128K: the frame
// length, the delays of contended memory (the cycles that ZEsarUX 13.0 gives,
// see test/fixtures/z80/contention.ts), the model of a snapshot, the RAM banks
// and the coverage per bank. Needs zxrun: tools/install-zxrun.sh or C64RT_ZXRUN.

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { COVERAGE } from "../../../src/cpu/coverage.ts";
import { findTool, ZXRUN } from "../../../src/native/discover.ts";
import { ProcessSupervisor } from "../../../src/native/processes.ts";
import { ZX_FRAME_CYCLES, ZxRunSession } from "../../../src/native/zxrun.ts";
import { CONTENTION_CASES, contentionSnapshot } from "../../fixtures/z80/contention.ts";

let skip: string | false = false;
try {
  findTool(ZXRUN);
} catch {
  skip = "zxrun is not installed: run tools/install-zxrun.sh or set C64RT_ZXRUN";
}

const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-zxrun-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

async function withCore<T>(run: (core: ZxRunSession) => Promise<T>): Promise<T> {
  const supervisor = new ProcessSupervisor();
  const core = await ZxRunSession.open({ supervisor, signal: new AbortController().signal, env: process.env });
  try {
    return await run(core);
  } finally {
    await core.close();
    await supervisor.stopAll();
  }
}

test("a frame is 312 lines of 224 cycles on the 48K and 311 lines of 228 cycles on the 128K", { skip, timeout: 60_000 }, async () => {
  await withCore(async (core) => {
    for (const model of ["48k", "128k"] as const) {
      const start = await core.init(model);
      const later = await core.status(`run ${ZX_FRAME_CYCLES[model]}`);
      assert.deepEqual([later.model, later.line, later.cycle], [model, start.line, start.cycle], model);
    }
  });
});

test("contended memory delays the CPU as in ZEsarUX: fetches, reads, writes, I/O and internal cycles", { skip, timeout: 120_000 }, async () => {
  const rows: string[] = [];
  await withCore(async (core) => {
    for (const [name, item] of Object.entries(CONTENTION_CASES)) {
      const { bytes, mark } = contentionSnapshot(item);
      const file = join(scratch, `${name}.z80`);
      writeFileSync(file, bytes);
      await core.init("48k");
      const loaded = await core.loadZ80(file);
      assert.equal(loaded.model, item.model, name);
      const cycle = (await core.status(`run-pc ${mark.toString(16)} ${2 * ZX_FRAME_CYCLES[item.model]}`)).tick % ZX_FRAME_CYCLES[item.model];
      if (cycle !== item.cycle) rows.push(`${name}: ${cycle}, not ${item.cycle}`);
    }
  });
  assert.deepEqual(rows, []);
});

test("a 128K snapshot gives the paging, and the coverage of $c000-$ffff goes to the bank that was paged in", { skip, timeout: 60_000 }, async () => {
  const { bytes, mark } = contentionSnapshot(CONTENTION_CASES.c000odd!);
  const file = join(scratch, "banks.z80");
  writeFileSync(file, bytes);
  await withCore(async (core) => {
    await core.init("48k");
    const loaded = await core.loadZ80(file);
    assert.deepEqual([loaded.model, loaded.port7ffd & 0x17], ["128k", 0x11]);
    await core.command("coverage on");
    await core.status(`run-pc ${mark.toString(16)} ${2 * ZX_FRAME_CYCLES["128k"]}`);
    await core.command(`bank-coverage ${join(scratch, "banks.bin")}`);
    await core.command(`bank-dump 2 ${join(scratch, "bank2.bin")}`);
    const perBank = readFileSync(join(scratch, "banks.bin"));
    assert.equal(perBank.length, 8 * 0x4000);
    // The snippet reads $c000 with bank 1 paged in; bank 0 is not touched.
    assert.ok((perBank[1 * 0x4000]! & COVERAGE.ramRead) !== 0);
    assert.equal(perBank[0]! & COVERAGE.ramRead, 0);
    // Bank 2 is at $8000: the program starts it.
    assert.deepEqual([...readFileSync(join(scratch, "bank2.bin")).subarray(0, 2)], [0xf3, 0x31]);
    await assert.rejects(core.command("bank-dump 8 x"), /give a bank 0-7/);
  });
});
