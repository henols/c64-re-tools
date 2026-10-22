// Runtime evidence of retro-provenance on the ZX Spectrum: each .z80 release
// runs in its own ZEsarUX from its entry state, and each difference gets its
// first access and whether it changed. Needs ZEsarUX on the host: set
// C64RT_LIVE_ZESARUX to the absolute path of zesarux.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { COUNTER_START, keyboardCounterRam, keyboardCounterSnapshot, z80Snapshot } from "../../fixtures/z80/keyboard-counter.ts";
import { importSnapshot } from "../../fixtures/program.ts";
import { readEnvelope } from "../../kit.ts";
import { startHost, stopHosts } from "../vice/live.ts";

const zesarux = process.env.C64RT_LIVE_ZESARUX;
const skip = zesarux === undefined ? "live ZEsarUX: set C64RT_LIVE_ZESARUX=/absolute/path/to/zesarux to run" : false;

const script = resolve(import.meta.dirname, "../../../skills/retro-provenance/scripts/provenance.ts");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-spectrum-provenance-"));
after(async () => {
  await stopHosts();
  rmSync(project, { recursive: true, force: true });
});

/**
 * The keyboard counter with four changed bytes: the high byte of FRAMES
 * ($5c79), which the ROM interrupt handler reads first and writes in the
 * next instruction; DI at the entry, which is NOP here; the
 * operand of AND 7 in COUNT, which runs only while SPACE is down; and a byte
 * of the stack that the first interrupt writes.
 */
function changedCounter(): Uint8Array {
  const ram = keyboardCounterRam();
  ram[0x5c79 - 0x4000] = 0x10;
  ram[COUNTER_START - 0x4000] = 0x00;
  ram[0x8036 - 0x4000] = 0x03;
  ram[0x8fef - 0x4000] = 0x55;
  return z80Snapshot(ram, { pc: COUNTER_START, sp: 0xff00, iy: 0x5c3a, im: 1, border: 7 });
}

test("each difference of two .z80 releases gets its first access in ZEsarUX, with a press step", { skip, timeout: 300_000 }, async () => {
  importSnapshot(project, keyboardCounterSnapshot());
  writeFileSync(join(project, "counter.z80"), keyboardCounterSnapshot());
  writeFileSync(join(project, "changed.z80"), changedCounter());
  writeFileSync(join(project, "steps.json"), JSON.stringify([{ press: ["space"], frames: 5 }]));
  const host = await startHost({ ...process.env, C64RT_ZESARUX: zesarux! });

  const child = spawn(process.execPath, [...process.execArgv, script, "compare", "counter.z80", "changed.z80", "--frames", "20", "--steps", "steps.json"], {
    cwd: project,
    env: { ...process.env, C64RT_HOST: host.address },
    stdio: ["ignore", "pipe", "inherit"],
  });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  assert.equal(status, 0, stdout);
  const json = readEnvelope(stdout, status).json as {
    differences: Array<{ start: string; end: string; runtime: Record<string, { first: string; changed: boolean }> }>;
    run: { steps: number; releases: Record<string, { started: boolean }> };
  };
  assert.deepEqual(json.run.releases, { "counter.z80": { started: true }, "changed.z80": { started: true } });
  assert.equal(json.run.steps, 1);
  const seen = Object.fromEntries(json.differences.map((difference) => [difference.start, Object.fromEntries(Object.entries(difference.runtime).map(([name, item]) => [name, [item.first, item.changed]]))]));
  const both = (first: string, changed: boolean) => ({ "counter.z80": [first, changed], "changed.z80": [first, changed] });
  assert.deepEqual(seen, {
    // LD HL,(FRAMES) reads it, and the next instruction writes the same value: a watchpoint gives the read.
    $5c79: both("read", false),
    $8000: both("execute", false),
    // COUNT runs only while the press step holds SPACE down.
    $8036: both("execute", false),
    // The first interrupt pushes the return address.
    $8fef: both("write", true),
  });
});
