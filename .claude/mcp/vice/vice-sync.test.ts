// node:test coverage of vice-sync.ts -- the module's first-ever test
// (01.6.1-06 Task 2). Its exported surface splits cleanly in two: the pure
// and near-pure functions (addrNum, hex4, the poll-window/ping-interval
// constants, the armedCheckpoints tracker) get real assertions below. The
// emulator-dependent checkpoint-synchronisation primitives (readCheckpoint,
// waitCheckpointHit, runToCheckpoint, reset, screenshot) are recorded as
// machine-visible `todo` entries instead -- NOT covered by a fake stub
// server. Their own header comment names three timing invariants
// (exactly-one-resume, poll-on-hit_count, never-delete-a-temporary-
// checkpoint) that only mean something against a real emulator's timing; a
// stub server answering plausibly would test the stub, not the invariant,
// manufacturing a false pass in exactly the area this project grades most
// carefully. `mcp__vice__*` is also this project's ONLY permitted route to
// the emulator (CLAUDE.md's hard rule) -- a test process has no other way
// to reach it, so the gap is named here rather than filled.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { addrNum, hex4, POLL_WINDOWS_MS, PING_INTERVAL_MS, armedCheckpoints } from "./vice-sync.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

test("addrNum() converts each accepted input form to the same number", () => {
  const rows: Array<[number | string, number]> = [
    [0x08b1, 2225],
    ["$08B1", 2225],
    ["08B1", 2225],
    ["0x08B1", 2225],
    ["0X08b1", 2225],
    [" $08B1 ", 2225],
    ["$0000", 0],
    [0, 0],
  ];
  for (const [input, expected] of rows) {
    assert.equal(addrNum(input), expected, `addrNum(${JSON.stringify(input)}) should be ${expected}`);
  }
});

test("addrNum() rejects a malformed input", () => {
  assert.throws(
    () => addrNum("not-hex"),
    /cannot interpret/,
    "a string that is not a valid hex address must throw, naming the input it could not interpret"
  );
});

test("hex4() renders a known address as the exact four-digit prefixed uppercase string, including the zero-padded low case", () => {
  assert.equal(hex4(0x08b1), "$08B1");
  assert.equal(hex4(5), "$0005");
  assert.equal(hex4("$08b1"), "$08B1", "hex4() accepts anything addrNum() accepts, including lowercase input");
});

test("armedCheckpoints: tracking an id makes it appear in the id list", () => {
  armedCheckpoints.clear();
  try {
    armedCheckpoints.track(42);
    assert.deepEqual(armedCheckpoints.ids(), [42]);
  } finally {
    armedCheckpoints.clear();
  }
});

test("armedCheckpoints: untracking removes exactly that id and leaves the others", () => {
  armedCheckpoints.clear();
  try {
    armedCheckpoints.track(1);
    armedCheckpoints.track(2);
    armedCheckpoints.track(3);
    armedCheckpoints.untrack(2);
    assert.deepEqual(armedCheckpoints.ids().sort(), [1, 3]);
  } finally {
    armedCheckpoints.clear();
  }
});

test("armedCheckpoints: clearing empties the list", () => {
  armedCheckpoints.clear();
  armedCheckpoints.track(1);
  armedCheckpoints.track(2);
  armedCheckpoints.clear();
  assert.deepEqual(armedCheckpoints.ids(), []);
});

test("armedCheckpoints: tracking the same id twice does not duplicate it", () => {
  armedCheckpoints.clear();
  try {
    armedCheckpoints.track(7);
    armedCheckpoints.track(7);
    assert.deepEqual(armedCheckpoints.ids(), [7]);
  } finally {
    armedCheckpoints.clear();
  }
});

test("POLL_WINDOWS_MS keeps its exact current values -- a timing contract other code reasons about", () => {
  assert.deepEqual(POLL_WINDOWS_MS, [3000, 6000, 12000, 20000, 25000, 28000, 28000, 28000]);
});

test("PING_INTERVAL_MS keeps its exact current value", () => {
  assert.equal(PING_INTERVAL_MS, 1000);
});

// -------------------------------------------------------- recorded gap
// One machine-visible todo per emulator-dependent primitive. Each names the
// primitive and both reasons it cannot be covered here: the invariant needs
// a real emulator's timing to mean anything, and mcp__vice__* is this
// project's only permitted route to the emulator, which a test process
// cannot use (no test may open its own connection -- CLAUDE.md's hard
// rule). No stub HTTP listener of any kind exists anywhere in this file --
// that is deliberate, per PATTERNS.md and RESEARCH's explicit sanction of
// leaving this gap named rather than faked.
test(
  "readCheckpoint() -- needs a real emulator's vice_checkpoint_list to exercise; mcp__vice__* is the only permitted route and a test process cannot use it",
  { todo: "requires a real emulator (vice_checkpoint_list) -- mcp__vice__* is the only permitted route; not testable from a test process" }
);

test(
  "waitCheckpointHit() -- the exactly-one-resume and poll-on-hit_count invariants only mean something against a real emulator's timing",
  {
    todo:
      "requires a real emulator's timing to exercise exactly-one-resume/poll-on-hit_count; a stub server would test the stub, not the invariant",
  }
);

test(
  "runToCheckpoint() -- composes readCheckpoint()/waitCheckpointHit() against a real emulator; same gap as its two dependencies",
  { todo: "requires a real emulator -- composes waitCheckpointHit()/readCheckpoint(), neither of which is testable from a test process" }
);

test(
  "reset() -- the never-delete-a-temporary-checkpoint invariant needs a real emulator's own `temporary` checkpoint flag",
  {
    todo:
      "requires a real emulator's own checkpoint state (the `temporary` flag) to exercise the never-delete-a-temporary-checkpoint invariant",
  }
);

test(
  "screenshot() -- vice_display_screenshot writes on the HOST; needs a real emulator to prove the host-path translation lands correctly",
  { todo: "requires a real emulator (vice_display_screenshot writes host-side) -- mcp__vice__* is the only permitted route" }
);

// ---------------------------------------------------------------------------
// 01.6.2-09 (T-01.6.2-54): waitCheckpointHit()'s never-fired message is the
// fourth of the four prose instructions that used to tell an agent to run
// the retiring per-instance supervisor (tools/vice-supervisor.sh) on the
// host. Actually driving waitCheckpointHit() to its own timeout would need
// the real emulator this file's own header comment already explains is out
// of reach for a test process -- a STRUCTURAL read of the source is the
// same idiom vice-proxy.test.ts's own "structural: ..." tests already use
// for asserting a message builder's text without invoking it live.
// ---------------------------------------------------------------------------

test("structural: waitCheckpointHit()'s never-fired message names the surviving launcher and describes on-demand launch plus respawn, not the retired per-instance supervisor", () => {
  const src = readFileSync(join(HERE, "vice-sync.ts"), "utf8");
  assert.match(src, /tools\/vice-launcher\.sh/, "the never-fired message must name the surviving launcher");
  assert.doesNotMatch(src, /tools\/vice-supervisor\.sh/, "the never-fired message must not still name the retiring per-instance supervisor");
  assert.match(src, /on-demand broker/i, "the message must describe the broker's on-demand launch");
  assert.match(src, /respawn/i, "the message must describe the broker respawning a crashed instance");
});
