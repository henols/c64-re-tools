// Runtime evidence of retro-provenance on the ZX Spectrum: each .z80 release
// runs in its own ZEsarUX from its entry state, and each difference gets its
// first access and whether it changed. Needs ZEsarUX on the host: set
// C64RT_LIVE_ZESARUX to the absolute path of zesarux.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
interface Compared {
  differences: Array<{ start: string; end: string; runtime: Record<string, { first: string; changed: boolean }> }>;
  run: { steps: number; releases: Record<string, { started: boolean }> };
}

/** Runs compare in `cwd` with the host at `address`, and gives the body. */
async function compare(cwd: string, address: string, args: string[]): Promise<Compared> {
  const child = spawn(process.execPath, [...process.execArgv, script, "compare", ...args], {
    cwd,
    env: { ...process.env, C64RT_HOST: address },
    stdio: ["ignore", "pipe", "inherit"],
  });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  assert.equal(status, 0, stdout);
  return readEnvelope(stdout, status).json as Compared;
}

/**
 * A frame counter that keeps the frame of the first SPACE press. Each frame
 * (IM 1, one HALT for each interrupt): $9002 += 1; until a press is kept,
 * if SPACE is down, $9003 = $9002 and $9004 = $9002.
 *
 * $8000  DI ; LD SP,$8FF0 ; LD IY,$5C3A ; IM 1 ; EI
 * $800b  loop: HALT ; LD HL,$9002 ; INC (HL)
 * $8010  LD A,($9004) ; OR A ; JR NZ,loop
 * $8016  LD BC,$7FFE ; IN A,(C) ; AND 1 ; JR NZ,loop
 * $801f  LD A,(HL) ; LD ($9003),A ; LD ($9004),A ; JR loop
 */
function pressFrameSnapshot(kept: number): Uint8Array {
  const code = [
    0xf3, 0x31, 0xf0, 0x8f, 0xfd, 0x21, 0x3a, 0x5c, 0xed, 0x56, 0xfb,
    0x76, 0x21, 0x02, 0x90, 0x34,
    0x3a, 0x04, 0x90, 0xb7, 0x20, 0xf5,
    0x01, 0xfe, 0x7f, 0xed, 0x78, 0xe6, 0x01, 0x20, 0xec,
    0x7e, 0x32, 0x03, 0x90, 0x32, 0x04, 0x90, 0x18, 0xe3,
  ];
  const ram = new Uint8Array(0xc000);
  ram.set(code, 0x8000 - 0x4000);
  ram[0x9003 - 0x4000] = kept;
  return z80Snapshot(ram, { pc: 0x8000, sp: 0xff00, iy: 0x5c3a, im: 1, border: 7 });
}

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

  const json = await compare(project, host.address, ["counter.z80", "changed.z80", "--frames", "20", "--steps", "steps.json"]);
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

test("a press step acts at its own frame from the entry state, and the same steps give the same result each time", { skip, timeout: 600_000 }, async () => {
  const folder = join(project, "press-frame");
  mkdirSync(folder);
  const N = 10;
  // Three releases that differ only in the byte that the program writes at the first press: frame N, N+1 or N+2 of the program.
  const names = [0, 1, 2].map((offset) => `kept${N + offset}.z80`);
  importSnapshot(folder, pressFrameSnapshot(N));
  for (const [offset, name] of names.entries()) writeFileSync(join(folder, name), pressFrameSnapshot(N + offset));
  const host = await startHost({ ...process.env, C64RT_ZESARUX: zesarux! });
  /** The releases whose byte the press at `frame` writes again with the same value. */
  const unchanged = async (frame: number): Promise<string[]> => {
    const steps = `steps${frame}.json`;
    writeFileSync(join(folder, steps), JSON.stringify([{ frames: frame }, { press: ["space"], frames: 3 }]));
    const json = await compare(folder, host.address, [...names, "--frames", "5", "--steps", steps]);
    assert.deepEqual(json.differences.map((difference) => difference.start), ["$9003"]);
    const runtime = json.differences[0]!.runtime;
    assert.deepEqual(Object.values(runtime).map((item) => item.first), ["write", "write", "write"]);
    return names.filter((name) => !runtime[name]!.changed);
  };
  const first = await unchanged(N);
  // The program counts the frame of the press as frame N, or as frame N+1 when the interrupt of that frame comes first.
  assert.equal(first.length, 1, `one release keeps the frame of the press: ${JSON.stringify(first)}`);
  const at = names.indexOf(first[0]!);
  assert.ok(at <= 1, `the press at frame ${N} acts at frame ${N}, not later: ${first[0]}`);
  assert.deepEqual(await unchanged(N + 1), [names[at + 1]], "one frame later, the press acts one frame later");
  assert.deepEqual(await unchanged(N), first, "the same steps give the same result again");
});
