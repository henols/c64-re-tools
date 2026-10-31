// A program that reads the CIA timer at its entry, as a game that seeds its
// random numbers from it: capture, source with a loader, and a c64-testing
// scenario against the reference. The loader sets the CIA timers, so
// the rebuild reads the same value; a loader without them reads another.
// Needs real VICE (C64RT_LIVE_VICE) and ACME.

import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { prg, SYS_2061 } from "../../../src/c64.testkit.ts";
import { ACME } from "../../../src/native/discover.ts";
import { liveSkip, startHost, stopHosts } from "../../integration/vice/live.ts";
import { runScript, skillScript, toolSkip } from "../../kit.ts";

const skip = liveSkip || toolSkip(ACME);

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
  const copy = [0xa2, 0x00, 0xbd, 0x1d, 0x08, 0x9d, 0x00, 0xc0, 0xe8, 0xe0, 0x80, 0xd0, 0xf5, 0x4c, 0x00, 0xc0];
  const payload = [0xad, 0x04, 0xdc, 0x8d, 0x00, 0xc1, 0xad, 0x05, 0xdc, 0x8d, 0x01, 0xc1, 0x4c, 0x0c, 0xc0];
  return prg(0x0801, SYS_2061, copy, payload, new Array<number>(128 - payload.length).fill(0xea));
}

test("a rebuild whose loader sets the CIA timers reads the timer value of the reference at the entry", { skip, timeout: 900_000 }, async () => {
  mkdirSync(join(project, "releases"));
  writeFileSync(join(project, "releases", "timer.prg"), timerPrg());
  const { address } = await startHost();
  const run = (name: string, file: string, ...args: string[]) => runScript(skillScript(name, file), args, { cwd: project, host: address });

  const captured = await run("c64-unpacker", "unpacker.ts", "capture", "releases/timer.prg", "--until", "$c000", "--out", "unpacked");
  assert.equal(captured.status, 0, captured.stdout);
  const state = JSON.parse(readFileSync(join(project, "unpacked", "entry_state.json"), "utf8")) as Record<string, any>;
  assert.equal(state.cia.cia1.latchA, 0x4025, "the KERNAL's latch of CIA 1 timer A");

  assert.equal((await run("c64-knowledge", "knowledge.ts", "image", "unpacked/image.json")).status, 0);
  const generated = await run("c64-source", "source.ts", "generate", "--out", "src", "--loader");
  assert.equal(generated.status, 0, generated.stdout);
  assert.equal(generated.json.loader.verified, true, generated.stdout);
  // The next run writes the loader program of the build again: keep this one.
  copyFileSync(join(project, "build", "clean_loader.prg"), join(project, "build", "with_timers.prg"));

  // The control: the same entry state without the CIA part gives a loader that leaves the timers as the KERNAL ran them.
  delete state.cia;
  writeFileSync(join(project, "unpacked", "entry_state.json"), JSON.stringify(state));
  assert.equal((await run("c64-knowledge", "knowledge.ts", "image", "unpacked/image.json")).json.entryChanged, true);
  const old = await run("c64-source", "source.ts", "generate", "--out", "src-old", "--loader");
  assert.equal(old.json.loader.verified, true, old.stdout);

  const scenario = (name: string, loader: string) => {
    writeFileSync(
      join(project, name),
      JSON.stringify({
        name: "reads the timer at the entry",
        reference: { program: "releases/timer.prg", symbols: "none" },
        rebuild: { program: loader, symbols: "none" },
        steps: [{ reset: "hard" }, { autostart: true }, { runUntil: { target: { kind: "address", address: "$c00c" }, timeoutFrames: 300 } }, { observe: "seeded", memory: [{ address: "$c100", size: 2 }] }],
      }),
    );
    return run("c64-testing", "testing.ts", "test", name);
  };
  const withTimers = await scenario("timers.json", "build/with_timers.prg");
  assert.equal(withTimers.json.result, "PASS", withTimers.stdout);
  const without = await scenario("no-timers.json", "build/clean_loader.prg");
  assert.equal(without.status, 0, without.stdout);
  assert.equal(without.json.result, "FAIL", without.stdout);
});
