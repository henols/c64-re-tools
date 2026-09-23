// node:test coverage of stock-handler.ts -- the shared handler contract
// (result types, both error converters, stockAnswer()). Every "client"
// below is a real EventEmitter cast `as unknown as ViceMonitorClient`,
// never a real socket.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { isErrorText, convertHandshakeError, convertWireError, stockAnswer, derivedAnswer } from "./stock-handler.ts";
import { attachRunStateTracker, resetRunStateTrackersForTest } from "./stock-runstate.ts";
import { ErrorCode, StockFramingError, StockProtocolError, StockResponseMismatchError, StockConnectionClosedError, type ViceMonitorClient } from "./stock-protocol.ts";
import { MonitorOwnershipError } from "./vice-broker-client.ts";
import { MachineRestartedError } from "./vice-errors.ts";

beforeEach(() => {
  resetRunStateTrackersForTest();
});

function fakeClient(): ViceMonitorClient {
  return new EventEmitter() as unknown as ViceMonitorClient;
}

// --------------------------------------------------------- stockAnswer()

test("stockAnswer: stamps runState from the tracker after a resumed event", () => {
  const client = fakeClient();
  attachRunStateTracker(client);
  client.emit("event", { type: "resumed", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });

  const result = stockAnswer(client, { status: "ok" });
  const payload = JSON.parse(result.content[0]!.text);
  assert.equal(payload.runState, "running");
  assert.equal(payload.status, "ok");
  assert.equal(result.isError, false);
});

test("stockAnswer: an unattached client yields runState \"unknown\"", () => {
  const client = fakeClient();
  const result = stockAnswer(client, { status: "ok" });
  const payload = JSON.parse(result.content[0]!.text);
  assert.equal(payload.runState, "unknown");
});

test("stockAnswer: a caller-supplied runState in payload is overwritten by the projection", () => {
  const client = fakeClient();
  attachRunStateTracker(client);
  client.emit("event", { type: "stopped", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });

  const result = stockAnswer(client, { status: "ok", runState: "running" });
  const payload = JSON.parse(result.content[0]!.text);
  assert.equal(payload.runState, "stopped", "the projection's value must win over anything the caller supplied");
});

// --------------------------------------------------------- derivedAnswer()

test("derivedAnswer: passes the payload through and stamps runState: unknown", () => {
  const result = derivedAnswer({ a: 1 });
  assert.equal(result.isError, false);
  assert.equal(result.content.length, 1);
  assert.equal(result.content[0]!.type, "text");
  const payload = JSON.parse(result.content[0]!.text);
  assert.deepEqual(payload, { a: 1, runState: "unknown" });
});

test("derivedAnswer: a caller-supplied runState is overwritten, never honoured", () => {
  const result = derivedAnswer({ runState: "running" });
  const payload = JSON.parse(result.content[0]!.text);
  assert.equal(payload.runState, "unknown");
});

test("derivedAnswer: an empty payload parses to exactly { runState: \"unknown\" }", () => {
  const result = derivedAnswer({});
  const payload = JSON.parse(result.content[0]!.text);
  assert.deepEqual(payload, { runState: "unknown" });
});

test("derivedAnswer: its result is structurally assignable to StockToolResult (compile-time)", () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _assignable: import("./stock-handler.ts").StockToolResult = derivedAnswer({});
  assert.ok(_assignable);
});

// --------------------------------------------------------- isErrorText()

test("isErrorText: builds a well-formed error result", () => {
  const result = isErrorText("boom");
  assert.equal(result.isError, true);
  assert.deepEqual(result.content, [{ type: "text", text: "boom" }]);
});

// --------------------------------------------------------- convertHandshakeError()

test("convertHandshakeError: a MonitorOwnershipError names the holder, without wedge/hung/unresponsive language", () => {
  const err = new MonitorOwnershipError("stockConnect: monitor for target t on port 6502 is already claimed by grant grant-x", {
    holderGrantId: "grant-x",
    holderClaimedAt: 1700000000000,
    port: 6502,
  });
  const result = convertHandshakeError("vice_x", err);
  const text = result.content[0]!.text.toLowerCase();
  assert.match(text, /grant-x/);
  assert.doesNotMatch(text, /wedge|hung|unresponsive/);
});

test("convertHandshakeError: a MachineRestartedError names both epochs", () => {
  const err = new MachineRestartedError("test: restarted", { baselineEpoch: 5, currentEpoch: 9 });
  const result = convertHandshakeError("vice_x", err);
  const text = result.content[0]!.text;
  assert.match(text, /baseline epoch 5/);
  assert.match(text, /current epoch 9/);
});

test("convertHandshakeError: still produces the Phase 2 refusal wording for a plain Error", () => {
  const result = convertHandshakeError("vice_x", new Error("something else failed"));
  assert.match(result.content[0]!.text, /vice_x: stock handshake failed \(something else failed\)\./);
});

test("convertHandshakeError: a StockConnectionClosedError names the unanswered request count, says only the channel was released, and that retrying is safe (G-64-4, plan 64-12)", () => {
  const err = new StockConnectionClosedError("binary monitor connection closed with 1 request(s) abandoned", {
    port: 6502,
    abandoned: 1,
    trigger: "close",
  });
  const text = convertHandshakeError("vice_ping", err).content[0]!.text;
  assert.match(text, /1 request/, "the text must name the unanswered request count");
  assert.match(text, /channel/i, "the text must say only the channel was released");
  assert.doesNotMatch(text, /instance was released|grant was released/i, "the text must never say the instance or the grant were released");
  assert.match(text, /retry/i, "the text must say retrying the same call is safe");
});

test("convertHandshakeError: an attach refusal (a plain Error carrying the broker's own errno-free retry wording) passes through with the generic wording, unchanged", () => {
  // G-64-4, plan 64-12, Task 2's own broker-relay.mjs buildEmulatorUnreachableMessage()
  // text, exactly as it would arrive wrapped in a ViceError by stock-connect.ts's
  // dialMonitorSocket() default -- proves the pre-existing generic branch's
  // "stock handshake failed (message)." shape is what an attach refusal rides
  // through on, not a new bespoke branch.
  const message =
    "vice: attach: the emulator's binary monitor at port 6502 did not accept a connection within 5000ms -- " +
    "it may still be starting, or may have exited; retrying the same call is safe.";
  const result = convertHandshakeError("vice_ping", new Error(message));
  const text = result.content[0]!.text;
  assert.match(text, /stock handshake failed/);
  assert.match(text, /did not accept a connection/i);
  assert.match(text, /retry/i);
  assert.doesNotMatch(text, /VICE_BROKER_BINMON_HOST/);
});

// --------------------------------------------------------- convertWireError()

test("convertWireError: ObjectMissing and CmdFailure produce distinct, non-generic text", () => {
  const objectMissing = new StockProtocolError("binary monitor returned error code 0x01 for response type 0x11", {
    errorCode: ErrorCode.ObjectMissing,
    responseType: 0x11,
    requestId: 1,
  });
  const cmdFailure = new StockProtocolError("binary monitor returned error code 0x8f for response type 0x22", {
    errorCode: ErrorCode.CmdFailure,
    responseType: 0x22,
    requestId: 2,
  });
  const textObjectMissing = convertWireError("vice_checkpoint_delete", objectMissing).content[0]!.text;
  const textCmdFailure = convertWireError("vice_checkpoint_set_condition", cmdFailure).content[0]!.text;
  assert.notEqual(textObjectMissing, textCmdFailure);
  assert.match(textObjectMissing, /does not exist/);
  assert.match(textCmdFailure, /no further diagnostic/);
});

test("convertWireError: InvalidLength produces its own distinct text", () => {
  const err = new StockProtocolError("binary monitor returned error code 0x80 for response type 0x01", {
    errorCode: ErrorCode.InvalidLength,
    responseType: 0x01,
    requestId: 3,
  });
  const text = convertWireError("vice_memory_read", err).content[0]!.text;
  assert.match(text, /client bug/);
});

test("convertWireError: a StockFramingError produces decode-failure text", () => {
  const err = new StockFramingError("response type 0x01 body is 1 byte(s), needs at least 2", {
    observed: 1,
    expected: 2,
    responseType: 0x01,
    requestId: 4,
  });
  const text = convertWireError("vice_memory_read", err).content[0]!.text;
  assert.match(text, /could not be decoded/);
});

test("convertWireError: a StockResponseMismatchError produces its own text", () => {
  const err = new StockResponseMismatchError("command 0x01 (request id 5) expected response type 0x01 but received 0x02", {
    expected: 0x01,
    received: 0x02,
    requestId: 5,
    command: 0x01,
  });
  const text = convertWireError("vice_memory_read", err).content[0]!.text;
  assert.match(text, /unexpected response type/);
});

test("convertWireError: a plain Error falls back to generic text naming the tool", () => {
  const text = convertWireError("vice_memory_read", new Error("socket exploded")).content[0]!.text;
  assert.match(text, /vice_memory_read/);
  assert.match(text, /socket exploded/);
});

// --------------------------------------------------------- shared prohibition

test("neither converter ever emits wedge/hung/unresponsive language", () => {
  const messages = [
    convertHandshakeError("vice_x", new Error("plain failure")).content[0]!.text,
    convertHandshakeError(
      "vice_x",
      new MonitorOwnershipError("owned", { holderGrantId: "g", holderClaimedAt: 1, port: 1 }),
    ).content[0]!.text,
    convertHandshakeError("vice_x", new MachineRestartedError("restarted", { baselineEpoch: 1, currentEpoch: 2 })).content[0]!.text,
    convertWireError("vice_x", new StockProtocolError("err", { errorCode: ErrorCode.CmdFailure })).content[0]!.text,
    convertWireError("vice_x", new StockProtocolError("err", { errorCode: ErrorCode.ObjectMissing })).content[0]!.text,
    convertWireError("vice_x", new Error("plain")).content[0]!.text,
  ];
  for (const message of messages) {
    assert.doesNotMatch(message.toLowerCase(), /wedge|hung|unresponsive/, `message must not mention wedge/hung/unresponsive: ${message}`);
  }
});
