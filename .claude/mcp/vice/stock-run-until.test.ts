// node:test coverage of stock-run-until.ts. Every client is a bare
// EventEmitter with a spy `send()` -- no broker, no real socket, no
// emulator (matching this repo's established DI-stub convention,
// stock-checkpoints.test.ts:1-56 / stock-dispatch.test.ts:1-133).
//
// 07-PATTERNS.md is explicit that vice-sync.ts's "deliberately not
// unit-tested" disposition does NOT carry over to this file: that
// disposition is about a polling design against unpredictable real timing,
// and this design is event-driven against a synthetic client, so every
// assertion below is meaningful. Every timeout in this file is in the tens
// of milliseconds -- no test waits on the 30000ms default or the 600000ms
// ceiling; the two tests that exercise those values (default/clamp) instead
// arrange an immediate synthetic hit so the real deadline is armed but never
// reached.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { handleRunUntil, RUN_UNTIL_DEFAULT_TIMEOUT_MS, RUN_UNTIL_MAX_TIMEOUT_MS } from "./stock-run-until.ts";
import { CommandType, CheckpointOperation, ErrorCode, StockProtocolError, type ParsedCheckpoint, type ViceMonitorClient } from "./stock-protocol.ts";
import { MachineRestartedError } from "./vice.ts";
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

/** Builds a fake ViceMonitorClient: a real EventEmitter (so `client.on("event", ...)`
 * and `client.on("close", ...)` work unmodified) plus a spy `send()` whose
 * behaviour is supplied by the caller. Every call is recorded as
 * [commandType, body] so tests can assert on wire bytes and call counts
 * without decoding a real response. `sendImpl` is handed the emitter itself
 * so a test can schedule an `event`/`close` emission from inside a
 * particular command's resolution (e.g. emitting a matching CHECKPOINT_INFO
 * right after the Exit/resume send). */
function makeFakeClient(sendImpl: (commandType: number, body: Buffer, emitter: EventEmitter) => Promise<unknown>): FakeClient {
  const emitter = new EventEmitter();
  const calls: SendSpyCall[] = [];
  const client = emitter as unknown as ViceMonitorClient;
  (client as unknown as { send: unknown }).send = async (commandType: number, body: Buffer = Buffer.alloc(0)) => {
    calls.push([commandType, body]);
    return sendImpl(commandType, body, emitter);
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
    temporary: true,
    hitCount: 0,
    ignoreCount: 0,
    hasCondition: false,
    ...overrides,
  };
}

function checkpointInfoResponse(checkpoint: ParsedCheckpoint) {
  return { type: "checkpoint_info" as const, requestId: 1, errorCode: 0, checkpoint, related: [] };
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

function countCalls(calls: SendSpyCall[], commandType: number): number {
  return calls.filter(([ct]) => ct === commandType).length;
}

/** A generic sendImpl covering CheckpointSet/Exit/CheckpointDelete for tests
 * that only care about call counts / listener hygiene, never firing a hit
 * event -- every wait in a test using this reaches its timeout. */
function timeoutOnlySendImpl(checkpointId = 1) {
  return async (commandType: number, _body: Buffer, _emitter: EventEmitter): Promise<unknown> => {
    if (commandType === CommandType.CheckpointSet) {
      return checkpointInfoResponse(fakeCheckpoint({ id: checkpointId }));
    }
    if (commandType === CommandType.Exit) {
      return { type: "unknown", requestId: 1, errorCode: 0 };
    }
    if (commandType === CommandType.CheckpointDelete) {
      return { type: "checkpoint_delete", requestId: 1, errorCode: 0 };
    }
    throw new Error(`timeoutOnlySendImpl: unexpected commandType 0x${commandType.toString(16)}`);
  };
}

/** A sendImpl that arms a CheckpointSet reply and then, on Exit, schedules an
 * immediate matching CHECKPOINT_INFO hit -- used by tests that must never
 * wait out a real deadline (the default 30000ms, or a clamped 600000ms). */
function immediateHitSendImpl(checkpointId = 1) {
  return async (commandType: number, _body: Buffer, emitter: EventEmitter): Promise<unknown> => {
    if (commandType === CommandType.CheckpointSet) {
      return checkpointInfoResponse(fakeCheckpoint({ id: checkpointId }));
    }
    if (commandType === CommandType.Exit) {
      setImmediate(() => {
        emitter.emit("event", checkpointInfoResponse(fakeCheckpoint({ id: checkpointId, hitCount: 1 })));
      });
      return { type: "unknown", requestId: 1, errorCode: 0 };
    }
    throw new Error(`immediateHitSendImpl: unexpected commandType 0x${commandType.toString(16)}`);
  };
}

beforeEach(() => {
  // No module-level state to reset in stock-run-until.ts itself -- included
  // for parity with the sibling family test files' own beforeEach shape.
});

// ---------------------------------------------------------------------------
// 1. Wire body
// ---------------------------------------------------------------------------

test("run_until: CHECKPOINT_SET wire body is 9 bytes, start===end===address, stop/enabled/exec/temporary/memspace bytes correct", async () => {
  const { client, calls } = makeFakeClient(timeoutOnlySendImpl());
  const session = makeSession(client);

  const result = await handleRunUntil({ address: "$c000", timeout_ms: 5 }, session, FAKE_DEPS);
  assertOk(result);

  const setCalls = calls.filter(([ct]) => ct === CommandType.CheckpointSet);
  assert.equal(setCalls.length, 1);
  const [, body] = setCalls[0]!;
  assert.equal(body.length, 9);
  assert.equal(body.readUInt16LE(0), 0xc000);
  assert.equal(body.readUInt16LE(2), 0xc000);
  assert.equal(body[4], 0x01); // stop
  assert.equal(body[5], 0x01); // enabled
  assert.equal(body[6], CheckpointOperation.Exec);
  assert.equal(body[7], 0x01); // temporary
  assert.equal(body[8], 0x00); // memspace: main
});

// ---------------------------------------------------------------------------
// 2. Hit path
// ---------------------------------------------------------------------------

test("run_until: hit path answers reached:true, deletes nothing, resumes exactly once", async () => {
  const { client, calls } = makeFakeClient(immediateHitSendImpl(7));
  const session = makeSession(client);

  const result = await handleRunUntil({ address: "$c000", timeout_ms: 5000 }, session, FAKE_DEPS);
  assertOk(result);
  const payload = okText(result);
  assert.equal(payload.reached, true);
  assert.equal(payload.checkpointId, 7);
  assert.equal(payload.hitCount, 1);

  assert.equal(countCalls(calls, CommandType.CheckpointDelete), 0);
  assert.equal(countCalls(calls, CommandType.Exit), 1);
});

// ---------------------------------------------------------------------------
// 3. Event narrowing
// ---------------------------------------------------------------------------

test("run_until: a mismatched checkpoint id and a mismatched event type are both ignored -- the wait still times out", async () => {
  const armedId = 1;
  const { client, calls } = makeFakeClient(async (commandType, _body, emitter) => {
    if (commandType === CommandType.CheckpointSet) {
      return checkpointInfoResponse(fakeCheckpoint({ id: armedId }));
    }
    if (commandType === CommandType.Exit) {
      setImmediate(() => {
        // Different checkpoint id, same type -- ignored.
        emitter.emit("event", checkpointInfoResponse(fakeCheckpoint({ id: armedId + 100, hitCount: 1 })));
        // Same id, different type -- ignored (narrowing keys on the parsed
        // discriminant FIRST, never on id alone).
        emitter.emit("event", { type: "resumed", requestId: 1, errorCode: 0, checkpoint: { id: armedId } });
      });
      return { type: "unknown", requestId: 1, errorCode: 0 };
    }
    if (commandType === CommandType.CheckpointDelete) {
      return { type: "checkpoint_delete", requestId: 1, errorCode: 0 };
    }
    throw new Error(`unexpected commandType 0x${commandType.toString(16)}`);
  });
  const session = makeSession(client);

  const result = await handleRunUntil({ address: "$c000", timeout_ms: 20 }, session, FAKE_DEPS);
  assertOk(result);
  const payload = okText(result);
  assert.equal(payload.reached, false);
  assert.equal(payload.timedOut, true);
  assert.equal(countCalls(calls, CommandType.CheckpointDelete), 1);
});

// ---------------------------------------------------------------------------
// 4. Timeout path
// ---------------------------------------------------------------------------

test("run_until: timeout path answers timedOut:true within the bound and deletes exactly once", async () => {
  const { client, calls } = makeFakeClient(timeoutOnlySendImpl(3));
  const session = makeSession(client);

  const start = Date.now();
  const result = await handleRunUntil({ address: "$c000", timeout_ms: 25 }, session, FAKE_DEPS);
  const elapsed = Date.now() - start;

  assertOk(result);
  const payload = okText(result);
  assert.equal(payload.reached, false);
  assert.equal(payload.timedOut, true);
  assert.equal(payload.cleanup, "deleted");
  assert.ok(elapsed < 2000, `expected the wait to settle quickly, took ${elapsed}ms`);
  assert.equal(countCalls(calls, CommandType.CheckpointDelete), 1);
});

// ---------------------------------------------------------------------------
// 5. ObjectMissing tolerance
// ---------------------------------------------------------------------------

test("run_until: a CheckpointDelete rejected with ObjectMissing is tolerated as already_gone, still a non-error result", async () => {
  const { client, calls } = makeFakeClient(async (commandType, _body, _emitter) => {
    if (commandType === CommandType.CheckpointSet) {
      return checkpointInfoResponse(fakeCheckpoint({ id: 9 }));
    }
    if (commandType === CommandType.Exit) {
      return { type: "unknown", requestId: 1, errorCode: 0 };
    }
    if (commandType === CommandType.CheckpointDelete) {
      throw new StockProtocolError("object missing", { errorCode: ErrorCode.ObjectMissing });
    }
    throw new Error(`unexpected commandType 0x${commandType.toString(16)}`);
  });
  const session = makeSession(client);

  const result = await handleRunUntil({ address: "$c000", timeout_ms: 20 }, session, FAKE_DEPS);
  assertOk(result);
  const payload = okText(result);
  assert.equal(payload.reached, false);
  assert.equal(payload.timedOut, true);
  assert.equal(payload.cleanup, "already_gone");
  assert.equal(countCalls(calls, CommandType.CheckpointDelete), 1);
});

test("run_until: a CheckpointDelete rejected with a non-ObjectMissing error is recorded as delete_failed, still a non-error result", async () => {
  const { client } = makeFakeClient(async (commandType, _body, _emitter) => {
    if (commandType === CommandType.CheckpointSet) {
      return checkpointInfoResponse(fakeCheckpoint({ id: 9 }));
    }
    if (commandType === CommandType.Exit) {
      return { type: "unknown", requestId: 1, errorCode: 0 };
    }
    if (commandType === CommandType.CheckpointDelete) {
      throw new StockProtocolError("command failed", { errorCode: ErrorCode.CmdFailure });
    }
    throw new Error(`unexpected commandType 0x${commandType.toString(16)}`);
  });
  const session = makeSession(client);

  const result = await handleRunUntil({ address: "$c000", timeout_ms: 20 }, session, FAKE_DEPS);
  assertOk(result);
  const payload = okText(result);
  assert.equal(payload.cleanup, "delete_failed");
  assert.equal(typeof payload.cleanupError, "string");
});

// ---------------------------------------------------------------------------
// 6. Machine restarted mid-wait
// ---------------------------------------------------------------------------

test("run_until: a MachineRestartedError from the resume propagates, and no delete is attempted", async () => {
  const { client, calls } = makeFakeClient(async (commandType, _body, _emitter) => {
    if (commandType === CommandType.CheckpointSet) {
      return checkpointInfoResponse(fakeCheckpoint({ id: 5 }));
    }
    if (commandType === CommandType.Exit) {
      throw new MachineRestartedError("machine restarted mid-wait", { baselineEpoch: 1, currentEpoch: 2 });
    }
    throw new Error(`unexpected commandType 0x${commandType.toString(16)}`);
  });
  const session = makeSession(client);

  await assert.rejects(
    () => handleRunUntil({ address: "$c000", timeout_ms: 5000 }, session, FAKE_DEPS),
    (err: unknown) => err instanceof MachineRestartedError,
  );
  assert.equal(countCalls(calls, CommandType.CheckpointDelete), 0);
});

// ---------------------------------------------------------------------------
// 7. timeout_ms validation
// ---------------------------------------------------------------------------

for (const bad of [0, -1, NaN, "soon"]) {
  test(`run_until: timeout_ms ${JSON.stringify(bad)} is refused naming the value and the range, nothing armed`, async () => {
    const { client, calls } = makeFakeClient(timeoutOnlySendImpl());
    const session = makeSession(client);

    const result = await handleRunUntil({ address: "$c000", timeout_ms: bad }, session, FAKE_DEPS);
    assertErr(result);
    assert.match(result.content[0]!.text, /timeout_ms/);
    assert.equal(calls.length, 0);
  });
}

test("run_until: timeout_ms above the ceiling clamps to RUN_UNTIL_MAX_TIMEOUT_MS and reports timeoutClamped:true", async () => {
  const { client } = makeFakeClient(immediateHitSendImpl(2));
  const session = makeSession(client);

  const result = await handleRunUntil({ address: "$c000", timeout_ms: 900000 }, session, FAKE_DEPS);
  assertOk(result);
  const payload = okText(result);
  assert.equal(payload.timeoutMs, RUN_UNTIL_MAX_TIMEOUT_MS);
  assert.equal(payload.timeoutClamped, true);
});

test("run_until: an absent timeout_ms uses RUN_UNTIL_DEFAULT_TIMEOUT_MS, no clamp flag", async () => {
  const { client } = makeFakeClient(immediateHitSendImpl(2));
  const session = makeSession(client);

  const result = await handleRunUntil({ address: "$c000" }, session, FAKE_DEPS);
  assertOk(result);
  const payload = okText(result);
  assert.equal(payload.timeoutMs, RUN_UNTIL_DEFAULT_TIMEOUT_MS);
  assert.equal(payload.timeoutClamped, undefined);
});

// ---------------------------------------------------------------------------
// 8. cycles-only refusal
// ---------------------------------------------------------------------------

test("run_until: a cycles-only call with no address is refused in the fork's own words, nothing armed", async () => {
  const { client, calls } = makeFakeClient(timeoutOnlySendImpl());
  const session = makeSession(client);

  const result = await handleRunUntil({ cycles: 1000 }, session, FAKE_DEPS);
  assertErr(result);
  assert.match(result.content[0]!.text, /cycles-only mode not yet implemented; provide an address/);
  assert.equal(countCalls(calls, CommandType.CheckpointSet), 0);
});

// ---------------------------------------------------------------------------
// 9. Listener hygiene
// ---------------------------------------------------------------------------

test("run_until: 20 sequential timed-out calls leave listenerCount('event') and ('close') back at baseline", async () => {
  const { client } = makeFakeClient(timeoutOnlySendImpl(11));
  const baselineEvent = client.listenerCount("event");
  const baselineClose = client.listenerCount("close");
  const session = makeSession(client);

  for (let i = 0; i < 20; i += 1) {
    const result = await handleRunUntil({ address: "$c000", timeout_ms: 5 }, session, FAKE_DEPS);
    assertOk(result);
  }

  assert.equal(client.listenerCount("event"), baselineEvent);
  assert.equal(client.listenerCount("close"), baselineClose);
});
