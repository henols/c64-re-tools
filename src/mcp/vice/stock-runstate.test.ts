// node:test coverage of stock-runstate.ts -- the runState projection (D-06,
// D-07, D-08). Every "client" below is a real EventEmitter cast `as unknown
// as ViceMonitorClient`, never a real socket: these tests assert the
// projection's own state machine and its idempotent-attach guarantee, not
// protocol shape (stock-protocol.test.ts already owns that).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { attachRunStateTracker, runStateFor, jamObservedFor, resetRunStateTrackersForTest } from "./stock-runstate.ts";
import type { ViceMonitorClient } from "./stock-protocol.ts";

beforeEach(() => {
  resetRunStateTrackersForTest();
});

function fakeClient(): ViceMonitorClient {
  return new EventEmitter() as unknown as ViceMonitorClient;
}

test("runstate: an unattached client reads \"unknown\"", () => {
  const client = fakeClient();
  assert.equal(runStateFor(client), "unknown");
});

test("runstate: the tracker reads \"unknown\" before any event is emitted", () => {
  const client = fakeClient();
  const tracker = attachRunStateTracker(client);
  assert.equal(tracker.get(), "unknown");
  assert.equal(runStateFor(client), "unknown");
});

test("runstate: a stopped event moves the state to \"stopped\"", () => {
  const client = fakeClient();
  attachRunStateTracker(client);
  client.emit("event", { type: "stopped", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });
  assert.equal(runStateFor(client), "stopped");
});

test("runstate: a resumed event moves the state to \"running\"", () => {
  const client = fakeClient();
  attachRunStateTracker(client);
  client.emit("event", { type: "resumed", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });
  assert.equal(runStateFor(client), "running");
});

test("runstate: a jam event moves the state to \"stopped\"", () => {
  const client = fakeClient();
  attachRunStateTracker(client);
  client.emit("event", { type: "jam", requestId: 0xffffffff, errorCode: 0, programCounter: null });
  assert.equal(runStateFor(client), "stopped");
});

// 07-REVIEW.md WR-04: the JAM signal used to be collapsed into "stopped" and
// thereby discarded at its only consumer -- so vice_diagnose could answer
// `wedged` (jamaction 2) or even `live` (default jamaction, the CPU refetching
// the same opcode still burns cycles) for a CPU that will never execute
// another instruction. It is now recorded separately AND latched.
test("runstate (WR-04): jamObserved is false until a jam arrives, and a plain stopped event never sets it", () => {
  const client = fakeClient();
  const tracker = attachRunStateTracker(client);
  assert.equal(tracker.jamObserved(), false);
  assert.equal(jamObservedFor(client), false);

  client.emit("event", { type: "stopped", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });
  assert.equal(runStateFor(client), "stopped");
  assert.equal(jamObservedFor(client), false, "a plain STOPPED is not a jam -- collapsing the two is the defect WR-04 fixes");
});

test("runstate (WR-04): a jam event sets jamObserved, and it LATCHES across a subsequent resume", () => {
  const client = fakeClient();
  attachRunStateTracker(client);
  client.emit("event", { type: "jam", requestId: 0xffffffff, errorCode: 0, programCounter: null });
  assert.equal(jamObservedFor(client), true);

  // A later RESUMED moves the run state but must NOT erase the jam: with the
  // default jamaction the emulator keeps running a dead CPU, which is exactly
  // the case where the flag is the only remaining evidence.
  client.emit("event", { type: "resumed", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });
  assert.equal(runStateFor(client), "running");
  assert.equal(jamObservedFor(client), true, "a jam is a latching fact about the instance, not a transient state");
});

test("runstate (WR-04): jamObservedFor() on an unattached client is false, never a throw", () => {
  assert.equal(jamObservedFor(fakeClient()), false);
});

test("runstate (WR-04): resetRunStateTrackersForTest() also forgets an observed jam", () => {
  const client = fakeClient();
  attachRunStateTracker(client);
  client.emit("event", { type: "jam", requestId: 0xffffffff, errorCode: 0, programCounter: null });
  assert.equal(jamObservedFor(client), true);
  resetRunStateTrackersForTest();
  assert.equal(jamObservedFor(client), false);
});

test("runstate: a checkpoint_info event leaves the value unchanged", () => {
  const client = fakeClient();
  attachRunStateTracker(client);
  client.emit("event", { type: "resumed", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });
  assert.equal(runStateFor(client), "running");
  client.emit("event", {
    type: "checkpoint_info",
    requestId: 0xffffffff,
    errorCode: 0,
    checkpoint: {
      id: 1,
      currentlyHit: true,
      start: 0x1000,
      end: 0x1000,
      stopWhenHit: true,
      enabled: true,
      operation: 0x04,
      temporary: false,
      hitCount: 1,
      ignoreCount: 0,
      hasCondition: false,
    },
  });
  assert.equal(runStateFor(client), "running", "checkpoint_info must never move the derived state");
});

test("runstate: a stopped -> resumed -> stopped sequence lands on \"stopped\"", () => {
  const client = fakeClient();
  attachRunStateTracker(client);
  client.emit("event", { type: "stopped", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });
  client.emit("event", { type: "resumed", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });
  client.emit("event", { type: "stopped", requestId: 0xffffffff, errorCode: 0, programCounter: 0x2000 });
  assert.equal(runStateFor(client), "stopped");
});

test("runstate: an unrecognised event shape (no .type) never throws and leaves the state unchanged", () => {
  const client = fakeClient();
  attachRunStateTracker(client);
  client.emit("event", { name: "StockProtocolError", message: "boom", requestId: 0xffffffff });
  assert.equal(runStateFor(client), "unknown");
});

test("runstate: attachRunStateTracker is idempotent -- two calls return the same tracker and register exactly one listener", () => {
  const client = fakeClient();
  const first = attachRunStateTracker(client);
  const second = attachRunStateTracker(client);
  assert.strictEqual(first, second, "the same tracker object must be returned on a second attach");
  assert.equal((client as unknown as EventEmitter).listenerCount("event"), 1, "exactly one 'event' listener must be registered");

  client.emit("event", { type: "resumed", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });
  assert.equal(first.get(), "running", "a single emitted event must move the state exactly once");
});

test("runstate: resetRunStateTrackersForTest() forgets a previously attached client", () => {
  const client = fakeClient();
  attachRunStateTracker(client);
  client.emit("event", { type: "resumed", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });
  assert.equal(runStateFor(client), "running");

  resetRunStateTrackersForTest();
  assert.equal(runStateFor(client), "unknown", "after a reset, the same client object must read as unattached");
});
