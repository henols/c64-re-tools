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
  const run = spawnSync(process.execPath, [...process.execArgv, join(root, "skills/c64-testing/scripts/testing.ts"), name, ...args], { cwd: project, encoding: "utf8", timeout: 120_000 });
  assert.ok(run.stdout !== "", run.stderr);
  return { status: run.status, result: readEnvelope(run.stdout, run.status).json as Record<string, unknown> };
}

writeFileSync(join(project, "counter.prg"), counterAt(0xc000));
writeFileSync(join(project, "counter.json"), JSON.stringify(symbols(0xc000)));
writeFileSync(join(project, "moved.prg"), counterAt(0xc400));
writeFileSync(join(project, "moved.json"), JSON.stringify(symbols(0xc400)));
writeFileSync(join(project, "right.prg"), counterAt(0xc000, { countRight: true }));
writeFileSync(
  join(project, "walk.json"),
  JSON.stringify({
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
  }),
);

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
  const self = script("replay", ["tests/recordings/walk"]);
  assert.deepEqual([self.status, self.result.result], [0, "PASS"]);
  const counted = script("replay", ["tests/recordings/walk", ...compare]);
  assert.equal(counted.status, 0, JSON.stringify(counted.result));
  assert.ok((counted.result.checkpoints as number) >= 65, `${counted.result.checkpoints} checkpoints`);
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
