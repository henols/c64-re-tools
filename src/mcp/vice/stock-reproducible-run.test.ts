// node:test coverage of stock-reproducible-run.ts and the two argument keys it
// is reached through. Every client is a bare EventEmitter with a spy `send()`
// -- no broker, no real socket, no emulator (this repo's established DI-stub
// convention; the helpers below mirror stock-run-until.test.ts:36-165 so a
// reader moving between the two files sees the same shapes).
//
// vice-sync.ts's "deliberately not unit-tested" disposition does NOT carry
// over here, for the same reason it does not carry over to
// stock-run-until.test.ts: that disposition is about a POLLING design against
// unpredictable real timing, and this design is EVENT-DRIVEN against a
// synthetic client. Every timeout in this file is in the tens of milliseconds.
//
// THE ONE ASSERTION A READER SHOULD NOT SKIP is the offset-13 pair, further
// down: it builds a RAW CHECKPOINT_INFO body whose u32LE at offset 13 is 1 and
// whose u32LE at offset 12 is 256, pushes it through the REAL parseResponse(),
// and asserts the frame term this procedure reports is 1. Reading offset 12
// would report 256 -- a plausible-looking frame count, which is why a grep for
// the offset is not enough and the wrong offset must red with a
// distinguishable number.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { handleRunUntil, RUN_UNTIL_KEYS } from "./stock-run-until.ts";
import {
  runReproducible,
  REPRODUCIBLE_RUN_REQUIRED_SIBLINGS,
  CHECKPOINT_INFO_HIT_COUNT_BODY_OFFSET,
} from "./stock-reproducible-run.ts";
import {
  CommandType,
  CheckpointOperation,
  ResetMode,
  ResponseType,
  parseResponse,
  type ParsedCheckpoint,
  type ViceMonitorClient,
} from "./stock-protocol.ts";
import { resetRegisterCatalogsForTest } from "./stock-registers.ts";
import { ORACLE_TERMS } from "./stop-oracle.ts";
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

function makeFakeClient(
  sendImpl: (commandType: number, body: Buffer, emitter: EventEmitter) => Promise<unknown>,
  opts: { connected?: boolean } = {},
): FakeClient {
  const emitter = new EventEmitter();
  const calls: SendSpyCall[] = [];
  const client = emitter as unknown as ViceMonitorClient;
  (client as unknown as { send: unknown }).send = async (commandType: number, body: Buffer = Buffer.alloc(0)) => {
    calls.push([commandType, body]);
    return sendImpl(commandType, body, emitter);
  };
  Object.defineProperty(client, "connected", { get: () => opts.connected ?? true, configurable: true });
  return { client, calls, emitter };
}

let sessionCounter = 0;
/** A fresh session object per call. registerCatalogFor() memoises on the
 * SESSION OBJECT (a WeakMap), so reusing one across tests would leak a catalog
 * and hide a REGISTERS_AVAILABLE call from the recorded command sequence. */
function makeSession(client: ViceMonitorClient): StockConnectSession {
  sessionCounter += 1;
  return { client, targetId: `target-${sessionCounter}` } as unknown as StockConnectSession;
}

const FAKE_DEPS = {} as unknown as StockDispatchDeps;

const TARGET_ADDR = 0xc000;
const ANCHOR_ADDR = 0xea31;
const ANCHOR_ID = 7;
const TARGET_ID = 8;

/** Register ids deliberately NOT 3/53/54 (the values a build happens to use)
 * and deliberately not in name order -- every read must go through the
 * catalog's name lookup, so a hardcoded id cannot pass by coincidence. */
const REG_IDS = { PC: 41, LIN: 17, CYC: 99 } as const;

function registersAvailableReply() {
  return {
    type: "registers_available" as const,
    requestId: 1,
    errorCode: 0,
    registers: [
      { id: REG_IDS.CYC, size: 16, name: "CYC" },
      { id: REG_IDS.PC, size: 16, name: "PC" },
      { id: 12, size: 8, name: "A" },
      { id: REG_IDS.LIN, size: 16, name: "LIN" },
    ],
  };
}

function registersGetReply({ pc = 0xea31, lin = 257, cyc = 57 }: { pc?: number; lin?: number; cyc?: number } = {}) {
  return {
    type: "registers" as const,
    requestId: 1,
    errorCode: 0,
    registers: [
      { id: REG_IDS.CYC, value: cyc },
      { id: 12, value: 0x0a },
      { id: REG_IDS.PC, value: pc },
      { id: REG_IDS.LIN, value: lin },
    ],
  };
}

function fakeCheckpoint(overrides: Partial<ParsedCheckpoint> = {}): ParsedCheckpoint {
  return {
    id: TARGET_ID,
    currentlyHit: false,
    start: TARGET_ADDR,
    end: TARGET_ADDR,
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

/**
 * A RAW, on-the-wire CHECKPOINT_INFO body -- 22 bytes, the layout
 * stock-protocol.ts's parser expects. Built by hand HERE (and nowhere in the
 * production module) so the offset-13 proof runs against real bytes through
 * the real parser rather than against a pre-parsed object.
 *
 * The 1-vs-256 discrimination falls out of the wire layout itself and is not
 * contrived: body[12] is the `temporary` FLAG and body[13..16] is `hit_count`.
 * For a NON-temporary checkpoint (body[12] === 0) on its first hit, the bytes
 * are `00 01 00 00 00`, so:
 *   readUInt32LE(13) === 1    <- the truth
 *   readUInt32LE(12) === 256  <- what reading one byte early reports
 * A frame term of 256 reported as 1 would certify two entirely different stops
 * as the same stop, and 256 is plausible enough that nobody would question it.
 */
function rawCheckpointInfoBody({
  id,
  hitCount,
  temporary,
  start,
}: {
  id: number;
  hitCount: number;
  temporary: boolean;
  start: number;
}): Buffer {
  const body = Buffer.alloc(22);
  body.writeUInt32LE(id, 0);
  body[4] = 0x01; // currentlyHit
  body.writeUInt16LE(start, 5);
  body.writeUInt16LE(start, 7);
  body[9] = 0x01; // stopWhenHit
  body[10] = 0x01; // enabled
  body[11] = CheckpointOperation.Exec;
  body[12] = temporary ? 0x01 : 0x00;
  body.writeUInt32LE(hitCount, 13);
  body.writeUInt32LE(0, 17); // ignoreCount
  body[21] = 0x00; // hasCondition
  return body;
}

/** The same bytes, through the REAL parser -- never a hand-built parsed
 * object. This is what makes the offset-13 assertions end-to-end. */
function parsedFromRaw(opts: Parameters<typeof rawCheckpointInfoBody>[0]) {
  const parsed = parseResponse({
    apiVersion: 0x02,
    responseType: ResponseType.CheckpointInfo,
    errorCode: 0,
    requestId: 0xffffffff,
    body: rawCheckpointInfoBody(opts),
  });
  assert.equal(parsed.type, "checkpoint_info");
  return parsed;
}

function okText(result: { content: { type: "text"; text: string }[] }): Record<string, unknown> {
  return JSON.parse(result.content[0]!.text);
}

function assertOk(result: { isError: boolean }): asserts result is { content: { type: "text"; text: string }[]; isError: false } {
  assert.equal(result.isError, false, `expected an ok result, got: ${JSON.stringify(result)}`);
}

function assertErr(result: { isError: boolean }): asserts result is { content: { type: "text"; text: string }[]; isError: true } {
  assert.equal(result.isError, true, `expected an error result, got: ${JSON.stringify(result)}`);
}

function errText(result: { content: { type: "text"; text: string }[] }): string {
  return result.content[0]!.text;
}

/**
 * The full green sequence, as a scripted client. `anchorHitCount` is the frame
 * term CHECKPOINT_GET reports; `emitAnchorFirst` schedules an ANCHOR
 * CHECKPOINT_INFO before the target's so the discrimination assertion has
 * something to discriminate.
 *
 * CHECKPOINT_SET replies are keyed on the body's own `temporary` byte
 * (body[7]), not on call order, so a test cannot accidentally pass because the
 * two arms happened to be issued in the expected sequence.
 */
function greenSendImpl({
  anchorHitCount = 1,
  emitAnchorFirst = false,
  registers = registersGetReply(),
}: { anchorHitCount?: number; emitAnchorFirst?: boolean; registers?: ReturnType<typeof registersGetReply> } = {}) {
  return async (commandType: number, body: Buffer, emitter: EventEmitter): Promise<unknown> => {
    switch (commandType) {
      case CommandType.RegistersAvailable:
        return registersAvailableReply();
      case CommandType.CheckpointSet: {
        const temporary = body[7] === 0x01;
        return temporary
          ? checkpointInfoResponse(fakeCheckpoint({ id: TARGET_ID, temporary: true, start: TARGET_ADDR, end: TARGET_ADDR }))
          : checkpointInfoResponse(fakeCheckpoint({ id: ANCHOR_ID, temporary: false, start: ANCHOR_ADDR, end: ANCHOR_ADDR }));
      }
      case CommandType.Reset:
        return { type: "unknown", requestId: 1, errorCode: 0 };
      case CommandType.Exit:
        setImmediate(() => {
          if (emitAnchorFirst) {
            emitter.emit(
              "event",
              parsedFromRaw({ id: ANCHOR_ID, hitCount: anchorHitCount, temporary: false, start: ANCHOR_ADDR }),
            );
          }
          emitter.emit("event", parsedFromRaw({ id: TARGET_ID, hitCount: 1, temporary: true, start: TARGET_ADDR }));
        });
        return { type: "unknown", requestId: 1, errorCode: 0 };
      case CommandType.RegistersGet:
        return registers;
      case CommandType.CheckpointGet:
        // The frame term, from a RAW body through the real parser -- offset 13.
        return parsedFromRaw({ id: ANCHOR_ID, hitCount: anchorHitCount, temporary: false, start: ANCHOR_ADDR });
      case CommandType.CheckpointDelete:
        return { type: "checkpoint_delete", requestId: 1, errorCode: 0 };
      default:
        throw new Error(`greenSendImpl: unexpected commandType 0x${commandType.toString(16)}`);
    }
  };
}

/** Arms both checkpoints and answers the reset, but NEVER emits a hit -- every
 * wait using this reaches its deadline. */
function timeoutSendImpl() {
  return async (commandType: number, body: Buffer): Promise<unknown> => {
    switch (commandType) {
      case CommandType.RegistersAvailable:
        return registersAvailableReply();
      case CommandType.CheckpointSet:
        return body[7] === 0x01
          ? checkpointInfoResponse(fakeCheckpoint({ id: TARGET_ID, temporary: true }))
          : checkpointInfoResponse(fakeCheckpoint({ id: ANCHOR_ID, temporary: false }));
      case CommandType.Reset:
      case CommandType.Exit:
        return { type: "unknown", requestId: 1, errorCode: 0 };
      case CommandType.CheckpointDelete:
        return { type: "checkpoint_delete", requestId: 1, errorCode: 0 };
      default:
        throw new Error(`timeoutSendImpl: unexpected commandType 0x${commandType.toString(16)}`);
    }
  };
}

const REPRODUCIBLE_ARGS = { address: "$c000", reproducible: true, frame_anchor: "$ea31" } as const;

beforeEach(() => {
  // registerCatalogFor() memoises per session object; makeSession() already
  // hands out a fresh one per call, and this clears the module-level WeakMap
  // for parity with the sibling family test files' own beforeEach shape.
  resetRegisterCatalogsForTest();
});

// ---------------------------------------------------------------------------
// 1. The command sequence -- the tracer, end to end
// ---------------------------------------------------------------------------

test("reproducible: the recorded command order is CheckpointSet, CheckpointSet, Reset, Exit, RegistersGet with exactly one Exit", async () => {
  const { client, calls } = makeFakeClient(greenSendImpl());
  const result = await handleRunUntil({ ...REPRODUCIBLE_ARGS, timeout_ms: 200 }, makeSession(client), FAKE_DEPS);
  assertOk(result);

  // The five protocol-defining commands, in order. Asserted as an ordered
  // SUBSEQUENCE because the procedure legitimately also sends
  // REGISTERS_AVAILABLE (name resolution, before anything is armed),
  // CHECKPOINT_GET (the frame term) and CHECKPOINT_DELETE (the non-temporary
  // anchor's cleanup) -- see the full-sequence assertion immediately below,
  // which pins those too so nothing can hide between the five.
  const SEQUENCE: readonly number[] = [
    CommandType.CheckpointSet,
    CommandType.CheckpointSet,
    CommandType.Reset,
    CommandType.Exit,
    CommandType.RegistersGet,
  ];
  assert.deepEqual(
    calls.map(([ct]) => ct).filter((ct) => SEQUENCE.includes(ct)),
    SEQUENCE,
  );

  // The complete recorded sequence, pinned. REGISTERS_AVAILABLE comes FIRST:
  // a build that enumerates no PC/LIN/CYC is refused while the machine is
  // still untouched, rather than after two checkpoints and a reset.
  assert.deepEqual(calls.map(([ct]) => ct), [
    CommandType.RegistersAvailable,
    CommandType.CheckpointSet,
    CommandType.CheckpointSet,
    CommandType.Reset,
    CommandType.Exit,
    CommandType.RegistersGet,
    CommandType.CheckpointGet,
    CommandType.CheckpointDelete,
  ]);

  // Exactly ONE resume per wait -- vice-sync.ts's invariant, stock-native.
  assert.equal(calls.filter(([ct]) => ct === CommandType.Exit).length, 1);
  assert.equal(okText(result).resumes, 1);
});

test("reproducible: the reset is RESET (0xcc) with a HARD mode byte, sent after both arms and before the single resume", async () => {
  const { client, calls } = makeFakeClient(greenSendImpl());
  const result = await handleRunUntil({ ...REPRODUCIBLE_ARGS, timeout_ms: 200 }, makeSession(client), FAKE_DEPS);
  assertOk(result);

  const resets = calls.filter(([ct]) => ct === CommandType.Reset);
  assert.equal(resets.length, 1);
  assert.deepEqual([...resets[0]![1]], [ResetMode.Hard]);

  const order = calls.map(([ct]) => ct);
  assert.ok(order.indexOf(CommandType.Reset) > order.lastIndexOf(CommandType.CheckpointSet));
  assert.ok(order.indexOf(CommandType.Reset) < order.indexOf(CommandType.Exit));
});

// ---------------------------------------------------------------------------
// 2. The two arms -- flags and memspace
// ---------------------------------------------------------------------------

test("reproducible: both arms are 9-byte stopping exec checkpoints on memspace 0x00, differing ONLY in the temporary flag", async () => {
  const { client, calls } = makeFakeClient(greenSendImpl());
  const result = await handleRunUntil({ ...REPRODUCIBLE_ARGS, timeout_ms: 200 }, makeSession(client), FAKE_DEPS);
  assertOk(result);

  const arms = calls.filter(([ct]) => ct === CommandType.CheckpointSet).map(([, body]) => body);
  assert.equal(arms.length, 2);

  const [anchorBody, targetBody] = arms as [Buffer, Buffer];

  // The ANCHOR is armed FIRST and is NON-temporary: VICE auto-deletes a
  // temporary checkpoint the instant it fires, and the anchor must survive its
  // own hits to keep counting frames.
  assert.equal(anchorBody.length, 9);
  assert.equal(anchorBody.readUInt16LE(0), ANCHOR_ADDR);
  assert.equal(anchorBody.readUInt16LE(2), ANCHOR_ADDR);
  assert.equal(anchorBody[4], 0x01, "anchor stop:true -- a non-stopping checkpoint emits CHECKPOINT_INFO from inside the CPU loop");
  assert.equal(anchorBody[5], 0x01, "anchor enabled");
  assert.equal(anchorBody[6], CheckpointOperation.Exec);
  assert.equal(anchorBody[7], 0x00, "anchor temporary:false");
  assert.equal(anchorBody[8], 0x00, "anchor memspace 0x00 (main) -- the wire byte, via checkpointSetBody's mapping");

  // The TARGET is temporary, matching stock-run-until.ts's existing divergence.
  assert.equal(targetBody.length, 9);
  assert.equal(targetBody.readUInt16LE(0), TARGET_ADDR);
  assert.equal(targetBody[4], 0x01);
  assert.equal(targetBody[5], 0x01);
  assert.equal(targetBody[6], CheckpointOperation.Exec);
  assert.equal(targetBody[7], 0x01, "target temporary:true");
  assert.equal(targetBody[8], 0x00, "target memspace 0x00 (main)");

  // The two bodies differ in EXACTLY the temporary flag among the flag bytes.
  assert.notEqual(anchorBody[7], targetBody[7]);
  assert.equal(anchorBody[4], targetBody[4]);
  assert.equal(anchorBody[5], targetBody[5]);
  assert.equal(anchorBody[6], targetBody[6]);
  assert.equal(anchorBody[8], targetBody[8]);
});

// ---------------------------------------------------------------------------
// 3. The stop identity -- all four terms, and the offset-13 proof
// ---------------------------------------------------------------------------

test("reproducible: the answer carries all four ORACLE_TERMS with the scripted values, read by NAME from one REGISTERS_GET reply", async () => {
  const { client, calls } = makeFakeClient(
    greenSendImpl({ anchorHitCount: 1, registers: registersGetReply({ pc: 0xea31, lin: 257, cyc: 57 }) }),
  );
  const result = await handleRunUntil({ ...REPRODUCIBLE_ARGS, timeout_ms: 200 }, makeSession(client), FAKE_DEPS);
  assertOk(result);
  const answer = okText(result);

  // The measured triple: (PC=$ea31, hit_count=1, LIN=257, CYC=57).
  assert.equal(answer.pc, 0xea31);
  assert.equal(answer.hitCount, 1);
  assert.equal(answer.line, 257);
  assert.equal(answer.cycle, 57);

  // Every declared oracle term is present as a named field. The assumption-delta
  // `promote` decision made structural: shrinking ORACLE_TERMS shrinks this
  // answer, so an address-only certification has to DELETE a field read here.
  assert.equal(ORACLE_TERMS.length, 4);
  for (const term of ORACLE_TERMS) {
    assert.equal(typeof answer[term], "number", `stop-identity term "${term}" missing from the answer`);
  }
  assert.deepEqual(answer.stopIdentityTerms, [...ORACLE_TERMS]);
  assert.equal(answer.reproducibleStop, true);
  assert.equal(answer.reached, true);

  // Exactly ONE REGISTERS_GET -- all three names come out of one reply.
  assert.equal(calls.filter(([ct]) => ct === CommandType.RegistersGet).length, 1);
  // The memspace byte on that read is 0x00, so a contaminated
  // `default_memspace` (which no binary-monitor command can reset) cannot
  // retarget it at the drive CPU.
  assert.deepEqual([...calls.find(([ct]) => ct === CommandType.RegistersGet)![1]], [0x00]);
});

test("reproducible: hit_count comes from CHECKPOINT_INFO body offset 13 -- a raw frame giving 1 at 13 and 256 at 12 reports 1", async () => {
  // The raw bytes, and the two competing reads of them.
  const raw = rawCheckpointInfoBody({ id: ANCHOR_ID, hitCount: 1, temporary: false, start: ANCHOR_ADDR });
  assert.equal(CHECKPOINT_INFO_HIT_COUNT_BODY_OFFSET, 13);
  assert.equal(raw.readUInt32LE(CHECKPOINT_INFO_HIT_COUNT_BODY_OFFSET), 1, "offset 13 is the truth");
  assert.equal(raw.readUInt32LE(12), 256, "offset 12 is the plausible-looking lie a wrong read reports");

  // The ONE seam that turns those bytes into a number agrees with offset 13.
  const parsed = parsedFromRaw({ id: ANCHOR_ID, hitCount: 1, temporary: false, start: ANCHOR_ADDR });
  assert.equal(parsed.type === "checkpoint_info" && parsed.checkpoint.hitCount, 1);

  // And the frame term the procedure reports, driven end to end off those same
  // raw bytes, is 1 -- not 256.
  const { client } = makeFakeClient(greenSendImpl({ anchorHitCount: 1 }));
  const result = await handleRunUntil({ ...REPRODUCIBLE_ARGS, timeout_ms: 200 }, makeSession(client), FAKE_DEPS);
  assertOk(result);
  const answer = okText(result);
  assert.equal(answer.hitCount, 1);
  assert.notEqual(answer.hitCount, 256);
});

test("reproducible: hitCount is the ANCHOR's count (the frame term); the target's own count is reported separately", async () => {
  const { client } = makeFakeClient(greenSendImpl({ anchorHitCount: 42 }));
  const result = await handleRunUntil({ ...REPRODUCIBLE_ARGS, timeout_ms: 200 }, makeSession(client), FAKE_DEPS);
  assertOk(result);
  const answer = okText(result);

  assert.equal(answer.hitCount, 42, "the frame term is the anchor's hit count");
  assert.equal(answer.targetHitCount, 1, "the target's own count is a separate field");
  assert.match(String(answer.hitCountNote), /FRAME TERM/);
  assert.match(String(answer.hitCountNote), /\$ea31/);
});

// ---------------------------------------------------------------------------
// 4. Discrimination -- the anchor's frame must not resolve the wait
// ---------------------------------------------------------------------------

test("reproducible: an anchor CHECKPOINT_INFO arriving FIRST does not resolve the wait -- it is counted and the wait continues", async () => {
  const { client } = makeFakeClient(greenSendImpl({ anchorHitCount: 3, emitAnchorFirst: true }));
  const result = await handleRunUntil({ ...REPRODUCIBLE_ARGS, timeout_ms: 200 }, makeSession(client), FAKE_DEPS);
  assertOk(result);
  const answer = okText(result);

  // Resolved on the TARGET's id despite the anchor's frame arriving first.
  assert.equal(answer.reproducibleStop, true);
  assert.equal(answer.targetCheckpointId, TARGET_ID);
  assert.equal(answer.anchorCheckpointId, ANCHOR_ID);
  assert.equal(answer.targetHitCount, 1);
  assert.equal(answer.anchorHitsObserved, 1, "the anchor's frame was counted, not discarded and not resolved on");
});

test("reproducible: an unrelated checkpoint's CHECKPOINT_INFO never resolves the wait", async () => {
  const { client } = makeFakeClient(async (commandType: number, body: Buffer, emitter: EventEmitter) => {
    if (commandType === CommandType.RegistersAvailable) return registersAvailableReply();
    if (commandType === CommandType.CheckpointSet) {
      return body[7] === 0x01
        ? checkpointInfoResponse(fakeCheckpoint({ id: TARGET_ID, temporary: true }))
        : checkpointInfoResponse(fakeCheckpoint({ id: ANCHOR_ID, temporary: false }));
    }
    if (commandType === CommandType.Exit) {
      setImmediate(() => {
        // A third checkpoint's frame, plus two unsolicited event types that
        // share request id 0xffffffff. None of them is this wait's stop.
        emitter.emit("event", parsedFromRaw({ id: 99, hitCount: 5, temporary: false, start: 0x1234 }));
        emitter.emit("event", { type: "stopped", requestId: 0xffffffff, errorCode: 0, pc: 0xea31 });
        emitter.emit("event", { type: "resumed", requestId: 0xffffffff, errorCode: 0, pc: 0xea31 });
      });
      return { type: "unknown", requestId: 1, errorCode: 0 };
    }
    if (commandType === CommandType.Reset) return { type: "unknown", requestId: 1, errorCode: 0 };
    if (commandType === CommandType.CheckpointDelete) return { type: "checkpoint_delete", requestId: 1, errorCode: 0 };
    throw new Error(`unexpected commandType 0x${commandType.toString(16)}`);
  });

  const result = await handleRunUntil({ ...REPRODUCIBLE_ARGS, timeout_ms: 30 }, makeSession(client), FAKE_DEPS);
  assertOk(result);
  const answer = okText(result);
  assert.equal(answer.timedOut, true, "no term of the oracle may be reported when the target's frame never arrived");
  assert.equal(answer.reproducibleStop, false);
  for (const term of ORACLE_TERMS) {
    assert.equal(answer[term], undefined, `term "${term}" must be ABSENT on a timeout, never zero-filled`);
  }
});

// ---------------------------------------------------------------------------
// 5. Cleanup -- three distinct paths
// ---------------------------------------------------------------------------

test("reproducible (hit path): the temporary target is NOT deleted; the non-temporary anchor IS", async () => {
  const { client, calls } = makeFakeClient(greenSendImpl());
  const result = await handleRunUntil({ ...REPRODUCIBLE_ARGS, timeout_ms: 200 }, makeSession(client), FAKE_DEPS);
  assertOk(result);
  const answer = okText(result);

  const deletes = calls.filter(([ct]) => ct === CommandType.CheckpointDelete).map(([, body]) => body.readUInt32LE(0));
  assert.deepEqual(deletes, [ANCHOR_ID], "only the anchor is deleted on the hit path");
  assert.equal(answer.cleanup, "auto_deleted_by_vice");
  assert.equal(answer.anchorCleanup, "deleted");
  assert.equal(answer.machineHalted, true);
});

test("reproducible (timeout path): BOTH checkpoints are deleted, and the answer names why the wait bounded out", async () => {
  const { client, calls } = makeFakeClient(timeoutSendImpl());
  const result = await handleRunUntil({ ...REPRODUCIBLE_ARGS, timeout_ms: 30 }, makeSession(client), FAKE_DEPS);
  assertOk(result);
  const answer = okText(result);

  const deletes = calls.filter(([ct]) => ct === CommandType.CheckpointDelete).map(([, body]) => body.readUInt32LE(0));
  assert.deepEqual(deletes, [TARGET_ID, ANCHOR_ID], "the timeout path deletes the target it armed AND the anchor it owns");
  assert.equal(answer.timedOut, true);
  assert.equal(answer.reproducibleStop, false);
  assert.equal(answer.anchorStoppedFirst, false);
  assert.match(String(answer.anchorStoppedFirstNote), /never fired/);
  assert.equal(answer.resumes, 1, "still exactly one resume, even on the timeout path");
  assert.equal(calls.filter(([ct]) => ct === CommandType.Exit).length, 1);
});

test("reproducible (timeout path): an anchor hit before the deadline is reported as anchorStoppedFirst with the one-resume reason", async () => {
  const { client } = makeFakeClient(async (commandType: number, body: Buffer, emitter: EventEmitter) => {
    if (commandType === CommandType.RegistersAvailable) return registersAvailableReply();
    if (commandType === CommandType.CheckpointSet) {
      return body[7] === 0x01
        ? checkpointInfoResponse(fakeCheckpoint({ id: TARGET_ID, temporary: true }))
        : checkpointInfoResponse(fakeCheckpoint({ id: ANCHOR_ID, temporary: false }));
    }
    if (commandType === CommandType.Exit) {
      // The anchor fires; the machine HALTS on that hit (stop:true) and the
      // target is never reached. Exactly one resume is sent, so the wait bounds
      // out. That is a refusal, not a defect.
      setImmediate(() => {
        emitter.emit("event", parsedFromRaw({ id: ANCHOR_ID, hitCount: 1, temporary: false, start: ANCHOR_ADDR }));
      });
      return { type: "unknown", requestId: 1, errorCode: 0 };
    }
    if (commandType === CommandType.Reset) return { type: "unknown", requestId: 1, errorCode: 0 };
    if (commandType === CommandType.CheckpointDelete) return { type: "checkpoint_delete", requestId: 1, errorCode: 0 };
    throw new Error(`unexpected commandType 0x${commandType.toString(16)}`);
  });

  const result = await handleRunUntil({ ...REPRODUCIBLE_ARGS, timeout_ms: 40 }, makeSession(client), FAKE_DEPS);
  assertOk(result);
  const answer = okText(result);
  assert.equal(answer.timedOut, true);
  assert.equal(answer.anchorStoppedFirst, true);
  assert.equal(answer.anchorHitsObserved, 1);
  assert.equal(answer.anchorHitCountObserved, 1);
  assert.match(String(answer.anchorStoppedFirstNote), /exactly ONE resume/);
  assert.match(String(answer.anchorStoppedFirstNote), /refusal/);
});

// ---------------------------------------------------------------------------
// 6. Adjacency -- frame_anchor === address
// ---------------------------------------------------------------------------

test("reproducible: frame_anchor equal to address still arms two DISTINCT checkpoints and resolves on the target's id", async () => {
  const { client, calls } = makeFakeClient(greenSendImpl());
  const result = await handleRunUntil(
    { address: "$ea31", reproducible: true, frame_anchor: "$ea31", timeout_ms: 200 },
    makeSession(client),
    FAKE_DEPS,
  );
  assertOk(result);
  const answer = okText(result);

  const arms = calls.filter(([ct]) => ct === CommandType.CheckpointSet).map(([, body]) => body);
  assert.equal(arms.length, 2, "adjacency does not collapse the two arms into one");
  assert.equal(arms[0]![7], 0x00, "the anchor is still non-temporary");
  assert.equal(arms[1]![7], 0x01, "the target is still temporary");
  assert.equal(arms[0]!.readUInt16LE(0), 0xea31);
  assert.equal(arms[1]!.readUInt16LE(0), 0xea31);

  assert.notEqual(answer.anchorCheckpointId, answer.targetCheckpointId);
  assert.equal(answer.targetCheckpointId, TARGET_ID, "the wait resolved on the TARGET's own id");
  assert.equal(answer.reproducibleStop, true);
});

test("reproducible: two identical checkpoint ids from the monitor are REFUSED -- the frames could not be told apart", async () => {
  const { client } = makeFakeClient(async (commandType: number) => {
    if (commandType === CommandType.RegistersAvailable) return registersAvailableReply();
    if (commandType === CommandType.CheckpointSet) return checkpointInfoResponse(fakeCheckpoint({ id: 5 }));
    if (commandType === CommandType.CheckpointDelete) return { type: "checkpoint_delete", requestId: 1, errorCode: 0 };
    throw new Error(`unexpected commandType 0x${commandType.toString(16)}`);
  });

  const result = await handleRunUntil({ ...REPRODUCIBLE_ARGS, timeout_ms: 200 }, makeSession(client), FAKE_DEPS);
  assertErr(result);
  assert.match(errText(result), /same checkpoint id/);
  assert.match(errText(result), /cannot be told apart|discriminates on checkpoint id/);
});

// ---------------------------------------------------------------------------
// 7. Register-name resolution refuses BEFORE anything is armed
// ---------------------------------------------------------------------------

test("reproducible: a build enumerating no LIN/CYC is REFUSED by name, before any checkpoint is armed", async () => {
  const { client, calls } = makeFakeClient(async (commandType: number) => {
    if (commandType === CommandType.RegistersAvailable) {
      return { type: "registers_available" as const, requestId: 1, errorCode: 0, registers: [{ id: 41, size: 16, name: "PC" }] };
    }
    throw new Error(`unexpected commandType 0x${commandType.toString(16)} -- nothing may be armed on this path`);
  });

  const result = await handleRunUntil({ ...REPRODUCIBLE_ARGS, timeout_ms: 200 }, makeSession(client), FAKE_DEPS);
  assertErr(result);
  assert.match(errText(result), /LIN and CYC/);
  assert.match(errText(result), /no id is guessed/);
  assert.match(errText(result), /two-term identity/);

  // Nothing armed, nothing reset, nothing resumed.
  assert.deepEqual(calls.map(([ct]) => ct), [CommandType.RegistersAvailable]);
});

test("reproducible: a REGISTERS_GET reply missing a term is REFUSED naming the term, never zero-filled", async () => {
  const { client } = makeFakeClient(
    greenSendImpl({
      registers: {
        type: "registers" as const,
        requestId: 1,
        errorCode: 0,
        // LIN's id is enumerated by the catalog but carries no value here.
        registers: [{ id: REG_IDS.PC, value: 0xea31 }, { id: REG_IDS.CYC, value: 57 }],
      },
    }),
  );

  const result = await handleRunUntil({ ...REPRODUCIBLE_ARGS, timeout_ms: 200 }, makeSession(client), FAKE_DEPS);
  assertErr(result);
  assert.match(errText(result), /no value for LIN/);
  assert.match(errText(result), /Refusing rather than reporting a stop identity/);
});

// ---------------------------------------------------------------------------
// 8. runReproducible() is reached from exactly one call site
// ---------------------------------------------------------------------------

test("reproducible: reproducible absent or false takes the pre-existing path and never calls runReproducible()", async () => {
  for (const args of [{ address: "$c000", timeout_ms: 30 }, { address: "$c000", reproducible: false, timeout_ms: 30 }]) {
    const { client, calls } = makeFakeClient(async (commandType: number) => {
      if (commandType === CommandType.CheckpointSet) return checkpointInfoResponse(fakeCheckpoint({ id: 1 }));
      if (commandType === CommandType.Exit) return { type: "unknown", requestId: 1, errorCode: 0 };
      if (commandType === CommandType.CheckpointDelete) return { type: "checkpoint_delete", requestId: 1, errorCode: 0 };
      if (commandType === CommandType.RegistersAvailable) return registersAvailableReply();
      if (commandType === CommandType.RegistersGet) return registersGetReply();
      throw new Error(`pre-existing path: unexpected commandType 0x${commandType.toString(16)}`);
    });

    const result = await handleRunUntil(args, makeSession(client), FAKE_DEPS);
    assertOk(result);
    const answer = okText(result);

    // The tell that runReproducible() was NOT entered: no RESET, exactly one
    // arm, and none of the reproducible answer's own discriminators.
    assert.equal(calls.filter(([ct]) => ct === CommandType.Reset).length, 0, "the pre-existing path never resets");
    assert.equal(calls.filter(([ct]) => ct === CommandType.CheckpointSet).length, 1, "the pre-existing path arms ONE checkpoint");
    assert.equal(answer.protocol, undefined);
    assert.equal(answer.reproducibleStop, undefined);
    assert.equal(answer.frameAnchor, undefined);
    // And the answer is shaped exactly as it is today.
    assert.equal(answer.requested, "run_until");
    assert.equal(answer.timedOut, true);
    assert.equal(answer.address, 0xc000);
  }
});

test("reproducible: runReproducible is exported and takes a session plus a plain options record -- no image buffer anywhere", () => {
  assert.equal(typeof runReproducible, "function");
  assert.equal(runReproducible.length, 2);
  assert.deepEqual([...REPRODUCIBLE_RUN_REQUIRED_SIBLINGS], ["frame_anchor"]);
});

// ---------------------------------------------------------------------------
// 9. D-13: the accepted key set, pinned
// ---------------------------------------------------------------------------

test("D-13: RUN_UNTIL_KEYS is EXACTLY the five names -- no sub-flag exists", () => {
  // THIS SINGLE EQUALITY is what makes a future `skip_reset`, `no_anchor` or
  // `reset_only` a RED TEST rather than a review comment. Shipping a "protocol
  // without the reset" option would ship exactly the second route REPRO-02
  // exists to prevent a caller forgetting -- and the reset-removed CONTROL this
  // phase records red is produced by an evidence script calling
  // runReproducible()'s pieces directly, never by a published flag. Do not
  // relax this to a `.includes()` check.
  assert.deepEqual(RUN_UNTIL_KEYS, ["address", "cycles", "timeout_ms", "reproducible", "frame_anchor"]);
});
