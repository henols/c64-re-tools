// node:test coverage of stock-handler.ts -- the shared handler contract
// (result types, both error converters, stockAnswer()). Every "client"
// below is a real EventEmitter cast `as unknown as ViceMonitorClient`,
// never a real socket.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { isErrorText, convertHandshakeError, convertWireError, stockAnswer } from "./stock-handler.ts";
import { attachRunStateTracker, resetRunStateTrackersForTest } from "./stock-runstate.ts";
import { ErrorCode, StockFramingError, StockProtocolError, StockResponseMismatchError, type ViceMonitorClient } from "./stock-protocol.ts";
import { MonitorOwnershipError } from "./vice-broker-client.ts";
import { MachineRestartedError } from "./vice.ts";

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
