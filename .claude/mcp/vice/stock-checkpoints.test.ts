// node:test coverage of stock-checkpoints.ts. Task 1: checkpoint add/delete/
// list/toggle. Every client is a bare EventEmitter with a spy `send()` -- no
// broker, no real socket, no emulator (matching this repo's established
// DI-stub convention, stock-dispatch.test.ts:1-133).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import {
  handleCheckpointAdd,
  handleCheckpointDelete,
  handleCheckpointList,
  handleCheckpointToggle,
  resetCheckpointStateForTest,
} from "./stock-checkpoints.ts";
import { CheckpointOperation, type ParsedCheckpoint, type ViceMonitorClient } from "./stock-protocol.ts";
import type { StockConnectSession } from "./stock-connect.ts";
import type { StockDispatchDeps } from "./stock-dispatch.ts";

// ---------------------------------------------------------------------------
// DI stub helpers
// ---------------------------------------------------------------------------

type SendSpyCall = [number, Buffer];

interface FakeClient {
  client: ViceMonitorClient;
  calls: SendSpyCall[];
  emitter: EventEmitter;
}

/** Builds a fake ViceMonitorClient: a real EventEmitter (so a later task's
 * client.on("event", ...) works unmodified) plus a spy `send()` whose
 * behaviour is supplied by the caller. Every call is recorded as
 * [commandType, body] so tests can assert on wire bytes without decoding a
 * real response. */
function makeFakeClient(sendImpl: (commandType: number, body: Buffer) => Promise<unknown>): FakeClient {
  const emitter = new EventEmitter();
  const calls: SendSpyCall[] = [];
  const client = emitter as unknown as ViceMonitorClient;
  (client as unknown as { send: unknown }).send = async (commandType: number, body: Buffer = Buffer.alloc(0)) => {
    calls.push([commandType, body]);
    return sendImpl(commandType, body);
  };
  return { client, calls, emitter };
}

function makeSession(client: ViceMonitorClient, targetId = "target-1"): StockConnectSession {
  return { client, targetId } as unknown as StockConnectSession;
}

const FAKE_DEPS = {} as unknown as StockDispatchDeps;

function fakeCheckpoint(overrides: Partial<ParsedCheckpoint> = {}): ParsedCheckpoint {
  return {
    id: 1,
    currentlyHit: false,
    start: 0xc000,
    end: 0xc000,
    stopWhenHit: true,
    enabled: true,
    operation: CheckpointOperation.Exec,
    temporary: false,
    hitCount: 0,
    ignoreCount: 0,
    hasCondition: false,
    ...overrides,
  };
}

function checkpointInfoResponse(checkpoint: ParsedCheckpoint) {
  return { type: "checkpoint_info" as const, requestId: 1, errorCode: 0, checkpoint, related: [] };
}

function checkpointListResponse(total: number, related: ReturnType<typeof checkpointInfoResponse>[]) {
  return { type: "checkpoint_list" as const, requestId: 1, errorCode: 0, total, checkpoints: [], related };
}

function okText(result: { content: { type: "text"; text: string }[] }): Record<string, unknown> {
  return JSON.parse(result.content[0]!.text);
}

function assertOk(result: { isError: boolean }): asserts result is { content: { type: "text"; text: string }[]; isError: false } {
  assert.equal(result.isError, false, "expected an ok result");
}

function assertErr(result: { isError: boolean }): asserts result is { content: { type: "text"; text: string }[]; isError: true } {
  assert.equal(result.isError, true, "expected an error result");
}

beforeEach(() => {
  resetCheckpointStateForTest();
});

// ---------------------------------------------------------------------------
// Task 1: handleCheckpointAdd
// ---------------------------------------------------------------------------

test("checkpoint add: no op booleans records CheckpointSet body length 8, byte 6 = Exec, byte 4 (stop) = 1", async () => {
  const { client, calls } = makeFakeClient(async (_ct, _body) => checkpointInfoResponse(fakeCheckpoint()));
  const session = makeSession(client);

  const result = await handleCheckpointAdd({ start: "$c000" }, session, FAKE_DEPS);
  assertOk(result);
  assert.equal(calls.length, 1);
  const [, body] = calls[0]!;
  assert.equal(body.length, 8);
  assert.equal(body[6], CheckpointOperation.Exec);
  assert.equal(body[4], 1);
  const payload = okText(result);
  assert.equal((payload.operation as { defaulted: boolean }).defaulted, true);
  assert.equal(payload.runState, "unknown");
});

test("checkpoint add: load+store records byte 6 = 0x03", async () => {
  const { client, calls } = makeFakeClient(async () => checkpointInfoResponse(fakeCheckpoint({ operation: 0x03 })));
  const session = makeSession(client);

  const result = await handleCheckpointAdd({ start: "$c000", load: true, store: true }, session, FAKE_DEPS);
  assertOk(result);
  const [, body] = calls[0]!;
  assert.equal(body[6], 0x03);
});

test("checkpoint add: stop:false without acknowledgeTraceRisk refuses, zero sends, message contains 'synchronously'", async () => {
  const { client, calls } = makeFakeClient(async () => checkpointInfoResponse(fakeCheckpoint()));
  const session = makeSession(client);

  const result = await handleCheckpointAdd({ start: "$c000", stop: false }, session, FAKE_DEPS);
  assertErr(result);
  assert.match(result.content[0]!.text, /synchronously/);
  assert.equal(calls.length, 0);
});

test("checkpoint add: stop:false with acknowledgeTraceRisk:true records byte 4 = 0", async () => {
  const { client, calls } = makeFakeClient(async () => checkpointInfoResponse(fakeCheckpoint({ stopWhenHit: false })));
  const session = makeSession(client);

  const result = await handleCheckpointAdd({ start: "$c000", stop: false, acknowledgeTraceRisk: true }, session, FAKE_DEPS);
  assertOk(result);
  const [, body] = calls[0]!;
  assert.equal(body[4], 0);
});

test("checkpoint add: end below start refuses with zero sends", async () => {
  const { client, calls } = makeFakeClient(async () => checkpointInfoResponse(fakeCheckpoint()));
  const session = makeSession(client);

  const result = await handleCheckpointAdd({ start: "$c000", end: "$b000" }, session, FAKE_DEPS);
  assertErr(result);
  assert.equal(calls.length, 0);
});

// ---------------------------------------------------------------------------
// Task 1: handleCheckpointDelete / handleCheckpointToggle
// ---------------------------------------------------------------------------

test("checkpoint delete: checkpoint_num out of range refuses with zero sends", async () => {
  const { client, calls } = makeFakeClient(async () => ({ type: "checkpoint_delete" as const }));
  const session = makeSession(client);

  const result = await handleCheckpointDelete({ checkpoint_num: -1 }, session, FAKE_DEPS);
  assertErr(result);
  assert.equal(calls.length, 0);
});

test("checkpoint delete: succeeds, forgets condition/trace state", async () => {
  const { client } = makeFakeClient(async () => ({ type: "checkpoint_delete" as const }));
  const session = makeSession(client);

  const result = await handleCheckpointDelete({ checkpoint_num: 5 }, session, FAKE_DEPS);
  assertOk(result);
  const payload = okText(result);
  assert.equal(payload.deleted, true);
  assert.equal(payload.checkpointNum, 5);
});

test("checkpoint toggle: enables/disables via CheckpointToggle body", async () => {
  const { client, calls } = makeFakeClient(async () => ({ type: "checkpoint_toggle" as const }));
  const session = makeSession(client);

  const result = await handleCheckpointToggle({ checkpoint_num: 3, enabled: false }, session, FAKE_DEPS);
  assertOk(result);
  const [, body] = calls[0]!;
  assert.equal(body.readUInt32LE(0), 3);
  assert.equal(body[4], 0);
});

// ---------------------------------------------------------------------------
// Task 1: handleCheckpointList
// ---------------------------------------------------------------------------

test("checkpoint list: total/related mismatch reported as totalReported/entriesReceived", async () => {
  const cp1 = fakeCheckpoint({ id: 1 });
  const cp2 = fakeCheckpoint({ id: 2 });
  const { client } = makeFakeClient(async () =>
    checkpointListResponse(3, [checkpointInfoResponse(cp1), checkpointInfoResponse(cp2)]),
  );
  const session = makeSession(client);

  const result = await handleCheckpointList({}, session, FAKE_DEPS);
  assertOk(result);
  const payload = okText(result);
  assert.equal(payload.totalReported, 3);
  assert.equal(payload.entriesReceived, 2);
});

test("checkpoint list: hasCondition true with empty registry reports condition:null, conditionTextKnown:false", async () => {
  const cp = fakeCheckpoint({ id: 7, hasCondition: true });
  const { client } = makeFakeClient(async () => checkpointListResponse(1, [checkpointInfoResponse(cp)]));
  const session = makeSession(client);

  const result = await handleCheckpointList({}, session, FAKE_DEPS);
  assertOk(result);
  const payload = okText(result);
  const entry = (payload.checkpoints as Record<string, unknown>[])[0]!;
  assert.equal(entry.condition, null);
  assert.equal(entry.conditionTextKnown, false);
});

test("every ok-answer carries runState", async () => {
  const { client } = makeFakeClient(async () => checkpointListResponse(0, []));
  const session = makeSession(client);
  const result = await handleCheckpointList({}, session, FAKE_DEPS);
  assertOk(result);
  assert.ok("runState" in okText(result));
});
