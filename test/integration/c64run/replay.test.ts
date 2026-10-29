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

function script(name: string, args: string[], cwd = project, file = "c64-testing/scripts/testing.ts"): { status: number | null; result: Record<string, unknown> } {
  const run = spawnSync(process.execPath, [...process.execArgv, join(root, "skills", file), name, ...args], { cwd, encoding: "utf8", timeout: 120_000 });
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

test("a session records with no checkpoint, and replays on the reference to the cycle", { skip, timeout: 120_000 }, () => {
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

test("--screen writes the screen of the reference at the end of the session, the same on each replay", { skip, timeout: 120_000 }, () => {
  const shots = ["first", "second"].map((name) => {
    const replayed = script("replay", ["tests/recordings/walk", "--screen", `shots/${name}.png`]);
    assert.deepEqual([replayed.status, replayed.result.result], [0, "PASS"], JSON.stringify(replayed.result));
    assert.equal((replayed.result.screen as { out: string }).out, `shots/${name}.png`);
    return readFileSync(join(project, "shots", `${name}.png`));
  });
  const [first, second] = shots as [Buffer, Buffer];
  assert.equal(first.subarray(1, 4).toString("latin1"), "PNG");
  // The IHDR: the visible screen of the replay core.
  assert.deepEqual([first.readUInt32BE(16), first.readUInt32BE(20)], [392, 272]);
  assert.ok(first.equals(second), "two replays give the same screen");
});

// The counter reads row 0 of the keyboard ($dc00 = $fe) at $c018 in place of joystick 2: F1 is bit 4 of $dc01 there, F3 bit 5.
const keys = counterAt(0xc000);
keys[2 + 0x0a] = 0xfe;
keys[2 + 0x19] = 0x01;
keys[2 + 0x1c] = 0x10;
writeFileSync(join(project, "keys.prg"), keys);

// A scan from port B, as Bruce Lee does: port B drives the F1 column (PB4) low, and $c010 reads port A, where F1 pulls row 0 (PA0) low.
writeFileSync(join(project, "reverse.prg"), Uint8Array.from([
  0x00, 0xc0,
  0x78,
  0xa9, 0xff, 0x8d, 0x03, 0xdc, // DDRB: all output
  0xa9, 0x00, 0x8d, 0x02, 0xdc, // DDRA: all input
  0xa9, 0xef, 0x8d, 0x01, 0xdc, // PB4 low
  0xad, 0x00, 0xdc, 0x8d, 0x00, 0xc1, 0x4c, 0x10, 0xc0,
]));

/** Records the press steps between 20 frames before and 20 frames after; gives the reads and the events of the recording. */
function recordPress(name: string, press: Array<{ press: { keys: string } }>, program = "keys.prg"): { reads: string; events: unknown[] } {
  const file = { name, program, symbols: "counter.json", load: true, steps: [{ registers: { pc: "start" } }, { frames: 20 }, ...press, { frames: 20 }] };
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

test("a press step shows in a scan from port B: F1 reads in port A", { skip, timeout: 120_000 }, () => {
  const { reads } = recordPress("reverse", [{ press: { keys: "{F1}" } }], "reverse.prg");
  assert.match(reads, /^c010 dc00 \d+ fe$/m, "the program reads F1 on row 0 of port A");
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
  const difference = right.result.firstDifference as { checkpoint: number; items: Array<{ address: string; reference: string; rebuild: string }> };
  // Left is pressed after 20 frames: the frame that sees it first differs, in the left count.
  assert.ok(difference.checkpoint >= 20 && difference.checkpoint <= 23, `checkpoint ${difference.checkpoint}`);
  assert.equal(difference.items[0]!.address, "$c100");
  assert.deepEqual((right.result.files as Array<{ out: string }>).map((file: { out: string }) => file.out.split("/").at(-1)), [`reference-${difference.checkpoint}.bin`, `rebuild-${difference.checkpoint}.bin`]);
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

// Reads $dc00 once, then counts frames at tick for ever and reads no input, as an intro does:
// $c000 SEI; LDA $dc00; STA $c101; wait: LDA $d012; CMP #$80; BNE wait; tick: INC $c100; skip: LDA $d012; CMP #$80; BEQ skip; JMP wait
function quietAt(base: number): Uint8Array {
  const wait = base + 0x07;
  return Uint8Array.from([
    base & 0xff, base >> 8,
    0x78, 0xad, 0x00, 0xdc, 0x8d, 0x01, 0xc1,
    0xad, 0x12, 0xd0, 0xc9, 0x80, 0xd0, 0xf9,
    0xee, 0x00, 0xc1,
    0xad, 0x12, 0xd0, 0xc9, 0x80, 0xf0, 0xf9,
    0x4c, wait & 0xff, wait >> 8,
  ]);
}
const quietSymbols = (base: number) => ({ start: `$${base.toString(16)}`, tick: `$${(base + 0x0e).toString(16)}`, frames: "$c100" });
writeFileSync(join(project, "quiet.prg"), quietAt(0xc000));
writeFileSync(join(project, "quiet.json"), JSON.stringify(quietSymbols(0xc000)));
writeFileSync(join(project, "quiet-moved.prg"), quietAt(0xc400));
writeFileSync(join(project, "quiet-moved.json"), JSON.stringify(quietSymbols(0xc400)));

test("a runUntil step to an address needs no input read, and the step after it runs there on each replay", { skip, timeout: 120_000 }, () => {
  const record = (name: string, steps: unknown[]) => {
    writeFileSync(join(project, `record-${name}.json`), JSON.stringify({ name, program: "quiet.prg", symbols: "quiet.json", load: true, steps: [{ registers: { pc: "start" } }, { frames: 20 }, ...steps, { frames: 20 }] }));
    return script("record", [`record-${name}.json`, "--out", `tests/recordings/${name}`]);
  };
  const write = { write: { address: "$c102", data: "05" } };
  const recorded = record("quiet", [{ runUntil: { target: { kind: "address", address: "tick" }, timeoutFrames: 100 } }, write]);
  assert.equal(recorded.status, 0, JSON.stringify(recorded.result));
  const { events } = JSON.parse(readFileSync(join(project, "tests/recordings/quiet/recording.json"), "utf8")) as { events: Array<{ step: number; key: Record<string, unknown> }> };
  assert.deepEqual(events.map((event) => [event.step, Object.keys(event.key).join()]), [[1, "tick"], [3, "pc,count"], [4, "previous"]]);
  assert.ok((events[1]!.key.count as number) > 15, JSON.stringify(events[1]));
  const self = script("replay", ["tests/recordings/quiet"]);
  assert.deepEqual([self.status, self.result.result], [0, "PASS"], JSON.stringify(self.result));
  const moved = script("replay", ["tests/recordings/quiet", "--checkpoint", "tick", "--state", "$c100:3", "--rebuild", "quiet-moved.prg", "--symbols", "quiet-moved.json"]);
  assert.deepEqual([moved.status, moved.result.result], [0, "PASS"], JSON.stringify(moved.result));
  // Without the runUntil step, the write waits for an input read that does not come.
  const waits = record("quiet-write", [write]);
  assert.equal(waits.result.recorded, false);
  assert.match(waits.result.reason as string, /^step 3: the program did not read its input again within 600 frames\. .*runUntil step to an address/);
});

// A game in place at $c000 after an unpacker or a loader that RUN starts. Before the game is in place, the code runs tick ($c00e) as
// often as `calls`: an RTS there, then a JSR to it. A delay is a loop of about 16 frames. Then the code copies the game and jumps to $c000.
function unpacked(game: Uint8Array, calls: number, delay = false): { prg: Uint8Array; jump: string } {
  const before = [
    0xa9, 0x60, 0x8d, 0x0e, 0xc0, // LDA #$60; STA $c00e
    ...Array.from({ length: calls }, () => [0x20, 0x0e, 0xc0]).flat(), // JSR $c00e
    ...(delay ? [0xa0, 0x00, 0xa2, 0x00, 0xca, 0xd0, 0xfd, 0x88, 0xd0, 0xfa] : []), // LDY #0; LDX #0; DEX; BNE; DEY; BNE
  ];
  const payload = 0x080d + before.length + 14;
  const copy = [0xa2, game.length - 1, 0xbd, payload & 0xff, payload >> 8, 0x9d, 0x00, 0xc0, 0xca, 0x10, 0xf7]; // copy the game to $c000
  return { prg: Uint8Array.from([0x01, 0x08, ...SYS_2061, ...before, ...copy, 0x4c, 0x00, 0xc0, ...game]), jump: `$${(0x080d + before.length + copy.length).toString(16)}` };
}

const handover = join(project, "handover");
mkdirSync(join(handover, ".c64-re-tools"), { recursive: true });
writeFileSync(join(handover, "game.json"), JSON.stringify(quietSymbols(0xc000)));
// The checkpoint is tick, which the code before the entry also runs.
const handoverReplay = (recording: string, rebuild: string, more: string[] = []) =>
  script("replay", [`tests/recordings/${recording}`, "--checkpoint", "tick", "--state", "$c100:3", "--rebuild", `${rebuild}.prg`, "--symbols", `${rebuild}.json`, ...more], handover).result;
function handoverFiles(name: string, built: { prg: Uint8Array; jump: string }, loader: boolean): void {
  writeFileSync(join(handover, `${name}.prg`), built.prg);
  writeFileSync(join(handover, `${name}.json`), JSON.stringify(loader ? { ...quietSymbols(0xc000), c64_source_loader_jump: built.jump } : quietSymbols(0xc000)));
}
function handoverRecord(name: string, program: string, steps: unknown[]): Record<string, unknown> {
  writeFileSync(join(handover, `${name}-record.json`), JSON.stringify({ name, program: `${program}.prg`, symbols: `${program}.json`, steps }));
  return script("record", [`${name}-record.json`, "--out", `tests/recordings/${name}`], handover).result;
}

test("a pc key and a checkpoint of a rebuild with a loader count from the jump of the loader, without the fetches of the reference before its entry", { skip, timeout: 120_000 }, () => {
  const game = quietAt(0xc000).subarray(2);
  handoverFiles("reference", unpacked(game, 1), false);
  handoverFiles("rebuild", unpacked(game, 2), true);
  const recorded = handoverRecord("handover", "reference", [{ frames: 20 }, { runUntil: { target: { kind: "address", address: "tick" }, timeoutFrames: 100 } }, { write: { address: "$c102", data: "05" } }, { frames: 20 }]);
  assert.equal(recorded.recorded, true, JSON.stringify(recorded));
  // The entry is where the loader of the rebuild jumps: the knowledge has none.
  const passed = handoverReplay("handover", "rebuild");
  assert.equal(passed.result, "PASS", JSON.stringify(passed));
  // A rebuild that does not keep its input byte at $c101 differs at checkpoint 1. The RAM of the reference is from its checkpoint 1 after the entry.
  const broken = quietAt(0xc000).subarray(2);
  broken[5] = 0x03; // STA $c103 in place of STA $c101
  handoverFiles("broken", unpacked(broken, 2), true);
  const failed = handoverReplay("handover", "broken", ["--out", "out"]);
  const difference = failed.firstDifference as { checkpoint: number; items: Array<{ address: string; reference: string }> };
  assert.deepEqual([failed.result, difference.checkpoint], ["FAIL", 1], JSON.stringify(failed));
  const ram = readFileSync(join(handover, "out", "reference-1.bin"));
  assert.equal(ram.subarray(0xc100, 0xc103).toString("hex"), difference.items[0]!.reference);
});

test("a step of a recording before the entry makes the replay of a rebuild with a loader INCONCLUSIVE", { skip, timeout: 120_000 }, () => {
  const recorded = handoverRecord("early", "reference", [{ write: { address: "$c103", data: "01" } }, { frames: 40 }]);
  assert.equal(recorded.recorded, true, JSON.stringify(recorded));
  const early = handoverReplay("early", "rebuild");
  assert.deepEqual([early.result, early.reason], ["INCONCLUSIVE", "step 1 ran before the program came to its entry $c000. A rebuild with a loader has no point for it. Make the steps of the record file start after the entry"], JSON.stringify(early));
});

test("a tick key after the entry comes as far from the entry in a rebuild whose loader takes longer", { skip, timeout: 120_000 }, () => {
  // The game reads no input, so the write of the recording runs at a tick.
  const silent = quietAt(0xc000).subarray(2);
  silent.set([0xad, 0xff, 0xc0], 1); // LDA $c0ff in place of LDA $dc00
  handoverFiles("silent", unpacked(silent, 1), false);
  handoverFiles("silent-slow", unpacked(silent, 1, true), true);
  const recorded = handoverRecord("silent", "silent", [{ frames: 30 }, { write: { address: "$c102", data: "05" } }, { frames: 20 }]);
  assert.equal(recorded.recorded, true, JSON.stringify(recorded));
  const { events } = JSON.parse(readFileSync(join(handover, "tests/recordings/silent/recording.json"), "utf8")) as { events: Array<{ key: Record<string, unknown> }> };
  assert.deepEqual(Object.keys(events[0]!.key), ["tick"]);
  const slow = handoverReplay("silent", "silent-slow");
  assert.equal(slow.result, "PASS", JSON.stringify(slow));
});
