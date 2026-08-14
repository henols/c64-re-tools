// node:test coverage of stock-checkpoints.ts. Task 1: checkpoint add/delete/
// list/toggle. Task 2: the D-10 condition registry, fail-closed cleanup, and
// watch-add. Task 3 (added below): the D-11 trace guard's rate limit and
// deferred auto-disable. Every client is a bare EventEmitter with a spy
// `send()` -- no broker, no real socket, no emulator (matching this repo's
// established DI-stub convention, stock-dispatch.test.ts:1-133).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import {
  handleCheckpointAdd,
  handleCheckpointDelete,
  handleCheckpointList,
  handleCheckpointToggle,
  handleCheckpointSetCondition,
  handleWatchAdd,
  registerTraceCheckpoint,
  autoDisableReportFor,
  conditionTextFor,
  resetCheckpointStateForTest,
  TRACE_HITS_PER_SECOND_LIMIT,
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

// ---------------------------------------------------------------------------
// WR-01 (03-REVIEW.md): `stop` is the one boolean-shaped argument in this file
// that used to be Boolean()-coerced instead of strictly checked, so a caller
// sending the STRING "false" silently got stop:true -- the opposite of what it
// asked for, with no diagnostic. Nothing upstream type-checks it
// (vice-proxy.ts's rawJsonSchemaAsStandardSchema() validates nothing), so
// these handlers are the only enforcement there is.
// ---------------------------------------------------------------------------

test("checkpoint add (WR-01): a STRING stop is refused outright, never coerced, with zero sends", async () => {
  const { client, calls } = makeFakeClient(async () => checkpointInfoResponse(fakeCheckpoint()));
  const session = makeSession(client);

  const result = await handleCheckpointAdd({ start: "$c000", stop: "false", acknowledgeTraceRisk: true }, session, FAKE_DEPS);
  assertErr(result);
  assert.match(result.content[0]!.text, /stop must be a boolean, got string/);
  assert.equal(calls.length, 0, "a refused argument must never reach the wire");
});

test("checkpoint add (WR-01): a non-boolean stop of any other shape is refused, naming the type it got", async () => {
  const { client, calls } = makeFakeClient(async () => checkpointInfoResponse(fakeCheckpoint()));
  const session = makeSession(client);

  const result = await handleCheckpointAdd({ start: "$c000", stop: 0 }, session, FAKE_DEPS);
  assertErr(result);
  assert.match(result.content[0]!.text, /stop must be a boolean, got number/);
  assert.equal(calls.length, 0);
});

test("watch add (WR-01): a STRING stop is refused outright, never coerced, with zero sends", async () => {
  const { client, calls } = makeFakeClient(async () => checkpointInfoResponse(fakeCheckpoint()));
  const session = makeSession(client);

  const result = await handleWatchAdd({ address: "$d020", stop: "false", acknowledgeTraceRisk: true }, session, FAKE_DEPS);
  assertErr(result);
  assert.match(result.content[0]!.text, /stop must be a boolean, got string/);
  assert.equal(calls.length, 0, "a refused argument must never reach the wire");
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

// ---------------------------------------------------------------------------
// Task 2: handleCheckpointSetCondition
// ---------------------------------------------------------------------------

test("set condition: 'A == $42' sends ConditionSet with parenthesised, hex wire text", async () => {
  const { client, calls } = makeFakeClient(async () => ({ type: "condition_set" as const }));
  const session = makeSession(client);

  const result = await handleCheckpointSetCondition({ checkpoint_num: 1, condition: "A == $42" }, session, FAKE_DEPS);
  assertOk(result);
  const [, body] = calls[0]!;
  const exprLen = body[4]!;
  const expr = body.subarray(5, 5 + exprLen).toString("ascii");
  assert.equal(expr, "(A == $42)");
});

test("set condition: structured object produces byte-identical wire text to the equivalent string form", async () => {
  const { client: clientA, calls: callsA } = makeFakeClient(async () => ({ type: "condition_set" as const }));
  const sessionA = makeSession(clientA, "target-a");
  await handleCheckpointSetCondition({ checkpoint_num: 1, condition: "A == $42" }, sessionA, FAKE_DEPS);

  const { client: clientB, calls: callsB } = makeFakeClient(async () => ({ type: "condition_set" as const }));
  const sessionB = makeSession(clientB, "target-b");
  await handleCheckpointSetCondition(
    { checkpoint_num: 1, condition: { kind: "comparison", left: { kind: "register", name: "A" }, op: "==", right: { kind: "literal", value: 0x42 } } },
    sessionB,
    FAKE_DEPS,
  );

  assert.deepEqual(callsA[0]![1], callsB[0]![1]);
});

test("set condition: unparenthesised multi-comparison refuses with the emitter's precedence message, zero sends", async () => {
  const { client, calls } = makeFakeClient(async () => ({ type: "condition_set" as const }));
  const session = makeSession(client);

  const result = await handleCheckpointSetCondition({ checkpoint_num: 1, condition: "RL == $64 && CY == $14" }, session, FAKE_DEPS);
  assertErr(result);
  assert.match(result.content[0]!.text, /precedence/);
  assert.equal(calls.length, 0);
});

test("set condition: setting twice on the same checkpoint refuses the second time, only one ConditionSet send total", async () => {
  const { client, calls } = makeFakeClient(async () => ({ type: "condition_set" as const }));
  const session = makeSession(client);

  const first = await handleCheckpointSetCondition({ checkpoint_num: 1, condition: "A == $42" }, session, FAKE_DEPS);
  assertOk(first);
  const second = await handleCheckpointSetCondition({ checkpoint_num: 1, condition: "X == $01" }, session, FAKE_DEPS);
  assertErr(second);
  assert.match(second.content[0]!.text, /\$42/);
  assert.equal(calls.length, 1);
});

test("set condition: fail-closed -- a rejecting ConditionSet is followed by a CheckpointDelete for the same checkpoint number", async () => {
  const { client, calls } = makeFakeClient(async (commandType) => {
    if (commandType === 0x22) throw new Error("CMD_FAILURE");
    return { type: "checkpoint_delete" as const };
  });
  const session = makeSession(client);

  const result = await handleCheckpointSetCondition({ checkpoint_num: 9, condition: "A == $42" }, session, FAKE_DEPS);
  assertErr(result);
  assert.match(result.content[0]!.text, /deleted/i);
  assert.equal(calls.length, 2);
  const [deleteCommandType, deleteBody] = calls[1]!;
  assert.equal(deleteCommandType, 0x13);
  assert.equal(deleteBody.readUInt32LE(0), 9);
});

test("set condition: both ConditionSet and CheckpointDelete fail -- one refusal names both failures", async () => {
  const { client } = makeFakeClient(async (commandType) => {
    if (commandType === 0x22) throw new Error("set failed");
    throw new Error("delete failed");
  });
  const session = makeSession(client);

  const result = await handleCheckpointSetCondition({ checkpoint_num: 9, condition: "A == $42" }, session, FAKE_DEPS);
  assertErr(result);
  const text = result.content[0]!.text;
  assert.match(text, /set failed/);
  assert.match(text, /delete failed/);
  assert.match(text, /may still be armed/);
});

// ---------------------------------------------------------------------------
// Task 2: handleWatchAdd
// ---------------------------------------------------------------------------

test("watch add: type 'both' records byte 6 = 0x03", async () => {
  const { client, calls } = makeFakeClient(async () => checkpointInfoResponse(fakeCheckpoint({ operation: 0x03 })));
  const session = makeSession(client);

  const result = await handleWatchAdd({ address: "$d020", type: "both" }, session, FAKE_DEPS);
  assertOk(result);
  const [, body] = calls[0]!;
  assert.equal(body[6], 0x03);
});

test("watch add: type 'peek' refuses naming read/write/both", async () => {
  const { client, calls } = makeFakeClient(async () => checkpointInfoResponse(fakeCheckpoint()));
  const session = makeSession(client);

  const result = await handleWatchAdd({ address: "$d020", type: "peek" }, session, FAKE_DEPS);
  assertErr(result);
  assert.match(result.content[0]!.text, /read/);
  assert.match(result.content[0]!.text, /write/);
  assert.match(result.content[0]!.text, /both/);
  assert.equal(calls.length, 0);
});

test("watch add: a condition that fails to emit records zero CheckpointSet sends", async () => {
  const { client, calls } = makeFakeClient(async () => checkpointInfoResponse(fakeCheckpoint()));
  const session = makeSession(client);

  const result = await handleWatchAdd({ address: "$d020", condition: "RL == $64 && CY == $14" }, session, FAKE_DEPS);
  assertErr(result);
  assert.equal(calls.length, 0);
});

test("watch add: after a successful set, checkpoint_list reports the recorded condition text", async () => {
  const cp = fakeCheckpoint({ id: 11, hasCondition: true });
  let listCall = false;
  const { client } = makeFakeClient(async (commandType) => {
    if (commandType === 0x12) return checkpointInfoResponse(cp);
    if (commandType === 0x22) return { type: "condition_set" as const };
    if (commandType === 0x14) {
      listCall = true;
      return checkpointListResponse(1, [checkpointInfoResponse(cp)]);
    }
    throw new Error(`unexpected commandType ${commandType}`);
  });
  const session = makeSession(client);

  const added = await handleWatchAdd({ address: "$d020", condition: "A == $42" }, session, FAKE_DEPS);
  assertOk(added);
  assert.equal(conditionTextFor(session, 11), "(A == $42)");

  const listed = await handleCheckpointList({}, session, FAKE_DEPS);
  assertOk(listed);
  assert.ok(listCall);
  const entry = (okText(listed).checkpoints as Record<string, unknown>[])[0]!;
  assert.equal(entry.condition, "(A == $42)");
  assert.equal(entry.conditionTextKnown, true);
});

test("after checkpoint delete, the registry entry is gone and a later list reports conditionTextKnown:false", async () => {
  const cp = fakeCheckpoint({ id: 4, hasCondition: true });
  const { client } = makeFakeClient(async (commandType) => {
    if (commandType === 0x22) return { type: "condition_set" as const };
    if (commandType === 0x13) return { type: "checkpoint_delete" as const };
    if (commandType === 0x14) return checkpointListResponse(1, [checkpointInfoResponse(cp)]);
    throw new Error(`unexpected commandType ${commandType}`);
  });
  const session = makeSession(client);

  await handleCheckpointSetCondition({ checkpoint_num: 4, condition: "A == $42" }, session, FAKE_DEPS);
  assert.equal(conditionTextFor(session, 4), "(A == $42)");

  await handleCheckpointDelete({ checkpoint_num: 4 }, session, FAKE_DEPS);
  assert.equal(conditionTextFor(session, 4), undefined);

  const listed = await handleCheckpointList({}, session, FAKE_DEPS);
  assertOk(listed);
  const entry = (okText(listed).checkpoints as Record<string, unknown>[])[0]!;
  assert.equal(entry.conditionTextKnown, false);
});

// ---------------------------------------------------------------------------
// Task 3: the D-11 trace guard
// ---------------------------------------------------------------------------

function makeClock(startMs = 0): { now: () => number; advance: (ms: number) => void } {
  let current = startMs;
  return { now: () => current, advance: (ms: number) => { current += ms; } };
}

function emitHit(emitter: EventEmitter, checkpointId: number, hitCount: number): void {
  emitter.emit("event", {
    type: "checkpoint_info",
    requestId: 0xffffffff,
    errorCode: 0,
    checkpoint: fakeCheckpoint({ id: checkpointId, stopWhenHit: false, hitCount }),
  });
}

test("trace guard: 5 events within the window schedule no toggle", async () => {
  const { client, calls, emitter } = makeFakeClient(async () => ({ type: "checkpoint_toggle" as const }));
  const session = makeSession(client);
  const clock = makeClock();
  registerTraceCheckpoint(session, 42, { now: clock.now });

  for (let i = 1; i <= 5; i++) emitHit(emitter, 42, i);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(calls.filter(([ct]) => ct === 0x15).length, 0);
});

test("trace guard: 21 events schedules exactly one CheckpointToggle, and NOT synchronously", async () => {
  const { client, calls, emitter } = makeFakeClient(async () => ({ type: "checkpoint_toggle" as const }));
  const session = makeSession(client);
  const clock = makeClock();
  registerTraceCheckpoint(session, 42, { now: clock.now });

  for (let i = 1; i <= 21; i++) emitHit(emitter, 42, i);

  // Immediately after the 21st emit() returns, no toggle has been sent yet --
  // the send is deferred out of the listener's call stack.
  assert.equal(calls.filter(([ct]) => ct === 0x15).length, 0);

  await new Promise((resolve) => setImmediate(resolve));

  const toggleCalls = calls.filter(([ct]) => ct === 0x15);
  assert.equal(toggleCalls.length, 1);
  const [, body] = toggleCalls[0]!;
  assert.equal(body.readUInt32LE(0), 42);
  assert.equal(body[4], 0);
});

test("trace guard: 40 events still schedule exactly one toggle (in-flight guard)", async () => {
  const { client, calls, emitter } = makeFakeClient(async () => ({ type: "checkpoint_toggle" as const }));
  const session = makeSession(client);
  const clock = makeClock();
  registerTraceCheckpoint(session, 42, { now: clock.now });

  for (let i = 1; i <= 40; i++) emitHit(emitter, 42, i);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(calls.filter(([ct]) => ct === 0x15).length, 1);
});

test("trace guard: events for an id NOT registered never schedule a toggle", async () => {
  const { client, calls, emitter } = makeFakeClient(async () => ({ type: "checkpoint_toggle" as const }));
  const session = makeSession(client);
  const clock = makeClock();
  registerTraceCheckpoint(session, 42, { now: clock.now });

  for (let i = 1; i <= 40; i++) emitHit(emitter, 999, i);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(calls.filter(([ct]) => ct === 0x15).length, 0);
});

test("trace guard: rolling window -- 15 events, advance clock past 1000ms, 15 more -> no toggle", async () => {
  const { client, calls, emitter } = makeFakeClient(async () => ({ type: "checkpoint_toggle" as const }));
  const session = makeSession(client);
  const clock = makeClock();
  registerTraceCheckpoint(session, 42, { now: clock.now });

  for (let i = 1; i <= 15; i++) emitHit(emitter, 42, i);
  clock.advance(1001);
  for (let i = 1; i <= 15; i++) emitHit(emitter, 42, i);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(calls.filter(([ct]) => ct === 0x15).length, 0);
});

test("trace guard: an auto-disable is reported in the next answer's autoDisables array", async () => {
  const { client, emitter } = makeFakeClient(async () => ({ type: "checkpoint_toggle" as const }));
  const session = makeSession(client);
  const clock = makeClock();
  registerTraceCheckpoint(session, 42, { now: clock.now });

  for (let i = 1; i <= 21; i++) emitHit(emitter, 42, i);
  await new Promise((resolve) => setImmediate(resolve));

  const report = autoDisableReportFor(session);
  assert.equal(report.length, 1);
  assert.equal(report[0]!.checkpointNum, 42);
  assert.ok(report[0]!.reason.includes(String(TRACE_HITS_PER_SECOND_LIMIT)));
  assert.ok(typeof report[0]!.hitsPerSecond === "number");
});

test("trace guard: re-enabling an auto-disabled id via checkpoint toggle clears the entry", async () => {
  const { client, emitter } = makeFakeClient(async () => ({ type: "checkpoint_toggle" as const }));
  const session = makeSession(client);
  const clock = makeClock();
  registerTraceCheckpoint(session, 42, { now: clock.now });

  for (let i = 1; i <= 21; i++) emitHit(emitter, 42, i);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(autoDisableReportFor(session).length, 1);

  const result = await handleCheckpointToggle({ checkpoint_num: 42, enabled: true }, session, FAKE_DEPS);
  assertOk(result);
  assert.equal(okText(result).autoDisableCleared, true);
  assert.equal(autoDisableReportFor(session).length, 0);
});

test("trace guard: a rejecting auto-disable send does not throw, and the reason names the send failure", async () => {
  const { client, emitter } = makeFakeClient(async (commandType) => {
    if (commandType === 0x15) throw new Error("socket closed");
    return { type: "checkpoint_toggle" as const };
  });
  const session = makeSession(client);
  const clock = makeClock();
  registerTraceCheckpoint(session, 42, { now: clock.now });

  for (let i = 1; i <= 21; i++) emitHit(emitter, 42, i);
  await new Promise((resolve) => setImmediate(resolve));

  const report = autoDisableReportFor(session);
  assert.equal(report.length, 1);
  assert.match(report[0]!.reason, /socket closed/);
});

test("trace guard: after an auto-disable, handleCheckpointList's answer carries autoDisables and the entry's own autoDisabled", async () => {
  const cp = fakeCheckpoint({ id: 42, stopWhenHit: false });
  const { client, emitter } = makeFakeClient(async (commandType) => {
    if (commandType === 0x14) return checkpointListResponse(1, [checkpointInfoResponse(cp)]);
    return { type: "checkpoint_toggle" as const };
  });
  const session = makeSession(client);
  const clock = makeClock();
  registerTraceCheckpoint(session, 42, { now: clock.now });

  for (let i = 1; i <= 21; i++) emitHit(emitter, 42, i);
  await new Promise((resolve) => setImmediate(resolve));

  const listed = await handleCheckpointList({}, session, FAKE_DEPS);
  assertOk(listed);
  const payload = okText(listed);
  assert.equal((payload.autoDisables as unknown[]).length, 1);
  const entry = (payload.checkpoints as Record<string, unknown>[])[0]!;
  assert.ok(entry.autoDisabled);
});
