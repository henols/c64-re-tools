// Live record and replay in the replay core: c64run must be installed (the
// dev container installs it, or C64RT_C64RUN). The subject is the joystick counter:
// each frame it counts frames, and the frames with joystick 2 held left.
// A relocated copy replays the same; a copy that counts right instead fails
// at the first checkpoint after the left frames start.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { READY_FRAMES } from "../../../src/host-client/entry-state.ts";
import { C64RUN, findTool } from "../../../src/native/discover.ts";
import { joystickCounterPrg } from "../../fixtures/prg/joystick-counter.ts";
import { readEnvelope } from "../../kit.ts";

let skip: string | false = false;
try {
  findTool(C64RUN);
} catch {
  skip = "c64run is not installed: install c64run or set C64RT_C64RUN to run these tests";
}

const root = resolve(import.meta.dirname, "../../..");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-replay-"));
mkdirSync(join(project, ".c64-re-tools"));
after(() => rmSync(project, { recursive: true, force: true }));

/** The joystick counter at another base address: its one absolute jump moves with it. */
function counterAt(base: number, options: { countRight?: boolean } = {}): Uint8Array {
  const prg = Uint8Array.from(joystickCounterPrg);
  prg[0] = base & 0xff;
  prg[1] = base >> 8;
  const jump = prg.length - 2;
  const target = base + 0x0e;
  prg[jump] = target & 0xff;
  prg[jump + 1] = target >> 8;
  // The operand of AND #$04 (left) is at $c01c: $08 counts right.
  if (options.countRight) prg[2 + 0x1c] = 0x08;
  return prg;
}

function symbols(base: number) {
  const at = (offset: number) => `$${(base + offset).toString(16)}`;
  // The counters stay at $c100: a name keeps a $ address of the state from moving with the code.
  return { start: at(0), wait: at(0x0e), count: at(0x15), skip: at(0x27), frames: "$c100" };
}

function script(name: string, args: string[]): { status: number | null; result: Record<string, unknown> } {
  const run = spawnSync(process.execPath, [...process.execArgv, join(root, "skills/retro-testing/scripts/testing.ts"), name, ...args], { cwd: project, encoding: "utf8", timeout: 120_000 });
  assert.ok(run.stdout !== "", run.stderr);
  return { status: run.status, result: readEnvelope(run.stdout, run.status).json as Record<string, unknown> };
}

writeFileSync(join(project, "counter.prg"), counterAt(0xc000));
writeFileSync(join(project, "counter.json"), JSON.stringify(symbols(0xc000)));
writeFileSync(join(project, "moved.prg"), counterAt(0xc400));
writeFileSync(join(project, "moved.json"), JSON.stringify(symbols(0xc400)));
writeFileSync(join(project, "right.prg"), counterAt(0xc000, { countRight: true }));
const walk = {
  name: "left for 30 frames",
  program: "counter.prg",
  symbols: "counter.json",
  load: true,
  steps: [
    { registers: { pc: "start" } },
    { frames: 20 },
    { joystick: { port: 2, direction: "left" } },
    { frames: 30 },
    { joystick: { port: 2, direction: "center" } },
    { frames: 20 },
  ],
};
writeFileSync(join(project, "walk.json"), JSON.stringify(walk));

// The comparison comes at replay time: the recording has no names.
const compare = ["--checkpoint", "count", "--state", "$c100:2"];

test("a session records with no checkpoint, and replays on the original to the cycle", { skip, timeout: 120_000 }, () => {
  const recorded = script("record", ["walk.json", "--out", "tests/recordings/walk"]);
  assert.equal(recorded.status, 0, JSON.stringify(recorded.result));
  assert.equal(recorded.result.recorded, true);
  assert.ok((recorded.result.executed as number) > 10, `executed ${recorded.result.executed}`);
  // The reads show the joystick change: from a read on, $dc00 has left held ($fb).
  assert.match(readFileSync(join(project, "tests/recordings/walk/reads.txt"), "utf8"), /^c018 dc00 \d+ fb$/m);
  const coverage = readFileSync(join(project, "tests/recordings/walk/coverage.bin"));
  assert.equal(coverage.length, 65536);
  assert.equal(coverage[0xc015]! & 4, 4, "the counter loop is executed in the map");
  // By default the map starts at the first input read of the program: its start-up code has no marks.
  assert.equal((recorded.result.coverageFrom as { pc: string }).pc, "$c018");
  assert.deepEqual([coverage[0xc000]! & 4, coverage[0xdc00]! & 0x40], [0, 0], "the start-up code and its write are not in the map");
  const self = script("replay", ["tests/recordings/walk"]);
  assert.deepEqual([self.status, self.result.result], [0, "PASS"]);
  const counted = script("replay", ["tests/recordings/walk", ...compare]);
  assert.equal(counted.status, 0, JSON.stringify(counted.result));
  assert.ok((counted.result.checkpoints as number) >= 65, `${counted.result.checkpoints} checkpoints`);
});

// The counter reads row 0 of the keyboard ($dc00 = $fe) at $c018 in place of joystick 2: F1 is bit 4 of $dc01 there, F3 bit 5.
const keys = counterAt(0xc000);
keys[2 + 0x0a] = 0xfe;
keys[2 + 0x19] = 0x01;
keys[2 + 0x1c] = 0x10;
writeFileSync(join(project, "keys.prg"), keys);

/** Records the press steps between 20 frames before and 20 frames after; gives the reads and the events of the recording. */
function recordPress(name: string, press: Array<{ press: { keys: string } }>): { reads: string; events: unknown[] } {
  const file = { name, program: "keys.prg", symbols: "counter.json", load: true, steps: [{ registers: { pc: "start" } }, { frames: 20 }, ...press, { frames: 20 }] };
  writeFileSync(join(project, `${name}.json`), JSON.stringify(file));
  const recorded = script("record", [`${name}.json`, "--out", `tests/recordings/${name}`]);
  assert.equal(recorded.status, 0, JSON.stringify(recorded.result));
  assert.equal(recorded.result.recorded, true);
  const folder = join(project, "tests/recordings", name);
  return { reads: readFileSync(join(folder, "reads.txt"), "utf8"), events: (JSON.parse(readFileSync(join(folder, "recording.json"), "utf8")) as { events: unknown[] }).events };
}

test("a press step presses a key of the matrix by its name: F1 reads in row 0", { skip, timeout: 120_000 }, () => {
  const { reads, events } = recordPress("press", [{ press: { keys: "{F1}" } }]);
  assert.match(reads, /^c018 dc01 \d+ ef$/m, "the program reads F1 held in row 0");
  assert.equal(events.some((event) => (event as { action: { restore?: boolean } }).action.restore === true), false, "a key of the matrix is input, no event");
});

test("a press step holds keys together, and its RESTORE is an event that the replay does again", { skip, timeout: 120_000 }, () => {
  const { reads, events } = recordPress("chord", [{ press: { keys: "{F1+F3}{RESTORE}" } }]);
  assert.match(reads, /^c018 dc01 \d+ cf$/m, "the program reads F1 and F3 held together in row 0");
  const restores = events.filter((event) => (event as { action: { restore?: boolean } }).action.restore === true);
  assert.equal(restores.length, 1, JSON.stringify(events));
  assert.equal((restores[0] as { step: number }).step, 3, "the RESTORE belongs to the press step");
  const replayed = script("replay", ["tests/recordings/chord"]);
  assert.deepEqual([replayed.status, replayed.result.result], [0, "PASS"], JSON.stringify(replayed.result));
});


test("the coverage of a record file starts at the program start, or at the first execution of an address", { skip, timeout: 120_000 }, () => {
  const record = (name: string, coverage: string) => {
    writeFileSync(join(project, `${name}.json`), JSON.stringify({ ...walk, coverage }));
    const recorded = script("record", [`${name}.json`, "--out", `tests/recordings/${name}`]);
    assert.equal(recorded.status, 0, JSON.stringify(recorded.result));
    assert.equal(recorded.result.recorded, true);
    return { result: recorded.result, map: readFileSync(join(project, `tests/recordings/${name}/coverage.bin`)) };
  };
  // From the program start: the start-up code and its write of $dc00 are in the map.
  const start = record("walk-start", "start");
  assert.equal(start.map[0xc000]! & 4, 4, "the start-up code is executed in the map");
  assert.equal(start.map[0xdc00]! & 0x40, 0x40, "the I/O write of the start-up code is in the map");
  assert.equal((start.result.coverageFrom as { frame: number }).frame, READY_FRAMES);
  // From the count of the loop: the start-up code before it has no marks.
  const count = record("walk-count", "$c015");
  assert.deepEqual([count.map[0xc000]! & 4, count.map[0xc015]! & 4], [0, 4]);
  assert.equal((count.result.coverageFrom as { pc: string }).pc, "$c015");
  // The pc of a registers step: its first instruction is in the map.
  const entry = record("walk-entry", "$c000");
  assert.deepEqual([entry.map[0xc000]! & 4, entry.map[0xdc00]! & 0x40], [4, 0x40]);
  assert.equal((entry.result.coverageFrom as { pc: string }).pc, "$c000");
  // Code that never runs: the map stays empty, and the session still records.
  const never = record("walk-never", "$c0ff");
  assert.deepEqual([never.result.coverageFrom, never.result.executed], [null, 0]);
});

test("a session is deterministic: two recordings of one record file are the same, byte for byte", { skip, timeout: 120_000 }, () => {
  const again = script("record", ["walk.json", "--out", "tests/recordings/walk-again"]);
  assert.equal(again.status, 0, JSON.stringify(again.result));
  for (const name of ["recording.json", "reads.txt", "coverage.bin"]) {
    assert.deepEqual(readFileSync(join(project, "tests/recordings/walk-again", name)), readFileSync(join(project, "tests/recordings/walk", name)), name);
  }
});

test("a relocated rebuild replays the same, and a changed one fails at the first left frame", { skip, timeout: 120_000 }, () => {
  const moved = script("replay", ["tests/recordings/walk", ...compare, "--rebuild", "moved.prg", "--symbols", "moved.json"]);
  assert.deepEqual([moved.status, moved.result.result, moved.result.movedSites, moved.result.idleReads], [0, "PASS", 1, undefined]);
  const right = script("replay", ["tests/recordings/walk", ...compare, "--rebuild", "right.prg", "--out", "out"]);
  assert.deepEqual([right.status, right.result.result], [0, "FAIL"], JSON.stringify(right.result));
  const difference = right.result.firstDifference as { checkpoint: number; items: Array<{ address: string; original: string; rebuild: string }> };
  // Left is pressed after 20 frames: the frame that sees it first differs, in the left count.
  assert.ok(difference.checkpoint >= 20 && difference.checkpoint <= 23, `checkpoint ${difference.checkpoint}`);
  assert.equal(difference.items[0]!.address, "$c100");
  assert.deepEqual((right.result.files as Array<{ out: string }>).map((file: { out: string }) => file.out.split("/").at(-1)), [`original-${difference.checkpoint}.bin`, `rebuild-${difference.checkpoint}.bin`]);
  assert.equal(readFileSync(join(project, "out", `rebuild-${difference.checkpoint}.bin`)).length, 65536);
});

// A program that RUN starts: 10 SYS2061, and the counter at $080d.
const SYS_2061 = [0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00];
writeFileSync(join(project, "run.prg"), Uint8Array.from([0x01, 0x08, ...SYS_2061, ...counterAt(0x080d).subarray(2)]));
writeFileSync(join(project, "run.json"), JSON.stringify(symbols(0x080d)));
// The rebuild as a loader with a start screen: $080d waits for fire on port 1 for ever (LDA $dc01; AND #$10; BNE), $0815 JMP $0820, and the counter at $0820.
const wait = [0xad, 0x01, 0xdc, 0x29, 0x10, 0xd0, 0xf9, 0x00, 0x4c, 0x20, 0x08, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea];
writeFileSync(join(project, "screen.prg"), Uint8Array.from([0x01, 0x08, ...SYS_2061, ...wait, ...counterAt(0x0820).subarray(2)]));
writeFileSync(join(project, "screen.json"), JSON.stringify({ ...symbols(0x0820), loader_start_screen_wait: "$080d", loader_start_screen_continue: "$0815" }));
writeFileSync(join(project, "no-labels.json"), JSON.stringify(symbols(0x0820)));
writeFileSync(join(project, "run-walk.json"), JSON.stringify({ ...walk, name: "left for 30 frames after RUN", program: "run.prg", symbols: "run.json", load: false, steps: walk.steps.slice(1) }));

test("a rebuild with a start screen replays: the replay goes on after the wait, which the recording does not have", { skip, timeout: 120_000 }, () => {
  const recorded = script("record", ["run-walk.json", "--out", "tests/recordings/run-walk"]);
  assert.equal(recorded.status, 0, JSON.stringify(recorded.result));
  const skipped = script("replay", ["tests/recordings/run-walk", ...compare, "--rebuild", "screen.prg", "--symbols", "screen.json"]);
  assert.deepEqual([skipped.status, skipped.result.result, skipped.result.startScreen, skipped.result.idleReads], [0, "PASS", "skipped", undefined], JSON.stringify(skipped.result));
  // Without the labels of the start screen, the rebuild waits for fire to the end of the session.
  const waits = script("replay", ["tests/recordings/run-walk", ...compare, "--rebuild", "screen.prg", "--symbols", "no-labels.json"]);
  assert.deepEqual([waits.status, waits.result.result, waits.result.startScreen], [0, "FAIL", undefined], JSON.stringify(waits.result));
});
