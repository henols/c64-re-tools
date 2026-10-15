// A program that reads the CIA timer at its entry, as a game that seeds its
// random numbers from it: capture, source with a loader, and a c64-testing
// scenario against the original. The loader sets the CIA timers (D63), so
// the rebuild reads the same value; a loader without them reads another.
// Needs real VICE (C64RT_LIVE_VICE), Ghidra (C64RT_GHIDRA) and ACME.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { ACME, findTool } from "../../../src/native/discover.ts";
import { findGhidra } from "../../../src/native/ghidra/index.ts";
import { liveSkip, startHost, stopHosts } from "../../integration/vice/live.ts";

let skip: string | false = liveSkip;
if (skip === false) {
  try {
    findTool(ACME);
    findGhidra();
  } catch (error) {
    skip = `a native tool is missing: ${(error as Error).message}`;
  }
}

const root = resolve(import.meta.dirname, "../../..");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-timer-"));
after(async () => {
  try {
    await stopHosts();
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});

/**
 * 10 SYS2061; at $080d a copy of 128 bytes to $c000 and JMP $c000. At $c000:
 * LDA $DC04 ; STA $C100 ; LDA $DC05 ; STA $C101 ; JMP $C00C, padded with NOP
 * to one block that the stage guard counts.
 */
function timerPrg(): Buffer {
  const basic = [0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00];
  const copy = [0xa2, 0x00, 0xbd, 0x1d, 0x08, 0x9d, 0x00, 0xc0, 0xe8, 0xe0, 0x80, 0xd0, 0xf5, 0x4c, 0x00, 0xc0];
  const payload = [0xad, 0x04, 0xdc, 0x8d, 0x00, 0xc1, 0xad, 0x05, 0xdc, 0x8d, 0x01, 0xc1, 0x4c, 0x0c, 0xc0];
  return Buffer.from([0x01, 0x08, ...basic, ...copy, ...payload, ...new Array<number>(128 - payload.length).fill(0xea)]);
}

async function skill(address: string, name: string, file: string, ...args: string[]): Promise<{ status: number | null; stdout: string; json: Record<string, any> }> {
  const child = spawn(process.execPath, [...process.execArgv, join(root, "skills", name, "scripts", file), ...args], { cwd: project, env: { ...process.env, C64RT_HOST: address }, stdio: ["ignore", "pipe", "inherit"] });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  return { status, stdout, json: JSON.parse(stdout) as Record<string, any> };
}

test("a rebuild whose loader sets the CIA timers reads the timer value of the original at the entry (D63)", { skip, timeout: 900_000 }, async () => {
  mkdirSync(join(project, "original"));
  writeFileSync(join(project, "original", "timer.prg"), timerPrg());
  const { address } = await startHost();
  const run = (name: string, file: string, ...args: string[]) => skill(address, name, file, ...args);

  const captured = await run("c64-unpacker", "unpack.ts", "capture", "original/timer.prg", "--until", "$c000", "--out", "unpacked");
  assert.equal(captured.status, 0, captured.stdout);
  const state = JSON.parse(readFileSync(join(project, "unpacked", "entry_state.json"), "utf8")) as Record<string, any>;
  assert.equal(state.cia.cia1.latchA, 0x4025, "the KERNAL's latch of CIA 1 timer A");

  const generated = await run("c64-source", "generate.ts", "unpacked/image.json", "--out", "src", "--loader");
  assert.equal(generated.status, 0, generated.stdout);
  assert.equal(generated.json.loader.verified, true, generated.stdout);

  // The control: the same entry state without the CIA part gives a loader that leaves the timers as the KERNAL ran them.
  delete state.cia;
  writeFileSync(join(project, "unpacked", "entry_state.json"), JSON.stringify(state));
  const old = await run("c64-source", "generate.ts", "unpacked/image.json", "--out", "src-old", "--loader");
  assert.equal(old.json.loader.verified, true, old.stdout);

  const scenario = (name: string, loader: string) => {
    writeFileSync(
      join(project, name),
      JSON.stringify({
        name: "reads the timer at the entry",
        original: { program: "original/timer.prg", symbols: "none" },
        rebuild: { program: loader, symbols: "none" },
        steps: [{ reset: "hard" }, { autostart: true }, { runUntil: { at: "$c00c" }, timeoutFrames: 300 }, { observe: "seeded", memory: [{ at: "$c100", size: 2 }] }],
      }),
    );
    return run("c64-testing", "test.ts", name);
  };
  const withTimers = await scenario("timers.json", "src/loader.prg");
  assert.equal(withTimers.json.result, "PASS", withTimers.stdout);
  const without = await scenario("no-timers.json", "src-old/loader.prg");
  assert.equal(without.json.result, "FAIL", without.stdout);
});
