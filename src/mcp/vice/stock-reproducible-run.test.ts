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
import { readFile } from "node:fs/promises";

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
import { MachineRestartedError } from "./vice.ts";
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

// The negative control for the field above: 42 is a frame term, 0 is not one.
//
// WHY (33 review CR-02). The target can legitimately stop before the anchor's
// frame has ever come round -- a loader address hit during boot, against a
// once-per-frame anchor this release has not reached yet. Zero is a finite
// integer, so it sails through requireTerms() and through the module's
// four-term self-check (which compares the record against itself and is
// therefore satisfied by ANY value), and the answer would go out with
// `reproducibleStop: true` and hitCount 0. Two such stops any number of frames
// apart then compare identical with frameTermAsserted true -- the exact
// confusion the frame term exists to prevent.
//
// This test OBSERVES the refusal rather than asserting the guard exists: it
// drives the whole procedure with a client whose CHECKPOINT_GET reports 0 and
// requires an error result. Written with an explicit assertion that
// `reproducibleStop` is absent from the payload, so a regression that restores
// the confident answer fails here even if the message text is reworded.
test("reproducible: an anchor hit count of 0 is REFUSED -- a frame term that counted no frames is not a term", async () => {
  const { client, calls } = makeFakeClient(greenSendImpl({ anchorHitCount: 0 }));
  const result = await handleRunUntil({ ...REPRODUCIBLE_ARGS, timeout_ms: 200 }, makeSession(client), FAKE_DEPS);

  assertErr(result);
  const text = errText(result);
  assert.match(text, /before the frame anchor/, "the refusal names the cause");
  assert.match(text, /frame term is 0/);
  assert.match(text, /vacuous/, "and says why 0 is not a term rather than just rejecting it");
  assert.match(text, /\$ea31/, "and names the anchor the caller must replace");

  // NOT an answer: no confident four-term identity anywhere in the output.
  assert.doesNotMatch(text, /"reproducibleStop":\s*true/);
  assert.doesNotMatch(text, /"hitCount":\s*0/);

  // The non-temporary anchor is still cleaned up on this refusal path -- a
  // stop:true checkpoint left armed at a once-per-frame address would halt
  // every later resume on the session within one frame.
  assert.ok(
    calls.some(([commandType]) => commandType === CommandType.CheckpointDelete),
    "the refusal deletes the anchor rather than leaving it armed",
  );
});

// ---------------------------------------------------------------------------
// 4. Discrimination -- the anchor's frame never certifies a stop
// ---------------------------------------------------------------------------

// The discrimination property, stated the way it is actually load-bearing: an
// anchor CHECKPOINT_INFO NEVER produces a "hit". It is counted, and it never
// certifies a stop.
//
// REVISED FOR WR-01 (33 review). This test used to drive a distinct-address
// anchor frame first and then require a CONFIDENT STOP anyway -- a scenario
// that is not physically realisable. The anchor is armed stop:true, so its hit
// HALTS the machine, and this procedure sends exactly ONE resume by design;
// the target at a different address therefore cannot execute afterwards. The
// old expectation only held because the fake emitted both frames back to back
// regardless of the machine state a real monitor would be in. What the anchor
// frame means at a distinct address is "terminal", so the outcome asserted here
// is the timeout-shaped REFUSAL -- which is a strictly stronger discrimination
// claim than before: not merely "the anchor's frame did not resolve as the
// target's", but "the anchor's frame produced no confident stop at all".
//
// The genuine keep-waiting case is adjacency (frame_anchor === address), where
// one stop emits both frames; that is asserted in section 6.
test("reproducible: an anchor CHECKPOINT_INFO at a distinct address never certifies a stop -- it is counted, and it is terminal", async () => {
  const { client } = makeFakeClient(greenSendImpl({ anchorHitCount: 3, emitAnchorFirst: true }));
  const result = await handleRunUntil({ ...REPRODUCIBLE_ARGS, timeout_ms: 200 }, makeSession(client), FAKE_DEPS);
  assertOk(result);
  const answer = okText(result);

  // NOT a confident stop: the anchor's frame is never mistaken for the target's.
  assert.equal(answer.reproducibleStop, false, "no stop is certified off the anchor's own frame");
  assert.equal(answer.timedOut, true);
  assert.equal(answer.anchorStoppedFirst, true);

  // But it IS counted, and both ids are still reported so neither has to be inferred.
  assert.equal(answer.anchorHitsObserved, 1, "the anchor's frame was counted, not discarded");
  assert.equal(answer.anchorHitCountObserved, 3, "and its own hit count is reported");
  assert.equal(answer.targetCheckpointId, TARGET_ID);
  assert.equal(answer.anchorCheckpointId, ANCHOR_ID);
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

// The test above passes timeout_ms: 40, which is the only reason it ever
// finished: the refusal used to be reached by BOUNDING OUT. This one uses a
// deadline no test would sit through, so it can only pass if the anchor frame
// SETTLES the wait rather than being counted and waited past.
//
// WHY IT MATTERS (33 review WR-01). The anchor is armed stop:true and this
// procedure sends exactly ONE resume, so at a DIFFERENT address from the target
// the state after an anchor hit is deterministically terminal AND already
// observed -- yet the wait ran to the deadline, up to the 600 000 ms
// RUN_UNTIL_MAX_TIMEOUT_MS ceiling. .mcp.json caps a request at 150 000 ms, so
// the caller's request died before the answer, and the anchorStoppedFirstNote
// written to explain the refusal never reached anyone at any realistic
// timeout. Asserted on ELAPSED TIME against the deadline, not on a magic
// number: the claim is "it did not wait out the deadline".
test("reproducible (timeout path): an anchor hit at a DIFFERENT address settles the wait at once, without burning the deadline", async () => {
  const UNREACHABLE_DEADLINE_MS = 30_000;
  const { client } = makeFakeClient(async (commandType: number, body: Buffer, emitter: EventEmitter) => {
    if (commandType === CommandType.RegistersAvailable) return registersAvailableReply();
    if (commandType === CommandType.CheckpointSet) {
      return body[7] === 0x01
        ? checkpointInfoResponse(fakeCheckpoint({ id: TARGET_ID, temporary: true }))
        : checkpointInfoResponse(fakeCheckpoint({ id: ANCHOR_ID, temporary: false }));
    }
    if (commandType === CommandType.Exit) {
      setImmediate(() => {
        emitter.emit("event", parsedFromRaw({ id: ANCHOR_ID, hitCount: 7, temporary: false, start: ANCHOR_ADDR }));
      });
      return { type: "unknown", requestId: 1, errorCode: 0 };
    }
    if (commandType === CommandType.Reset) return { type: "unknown", requestId: 1, errorCode: 0 };
    if (commandType === CommandType.CheckpointDelete) return { type: "checkpoint_delete", requestId: 1, errorCode: 0 };
    throw new Error(`unexpected commandType 0x${commandType.toString(16)}`);
  });

  const startedAt = Date.now();
  const result = await handleRunUntil(
    { ...REPRODUCIBLE_ARGS, timeout_ms: UNREACHABLE_DEADLINE_MS },
    makeSession(client),
    FAKE_DEPS,
  );
  const elapsedMs = Date.now() - startedAt;

  assertOk(result);
  const answer = okText(result);
  assert.equal(answer.timedOut, true, "the outcome is still the timeout-shaped refusal");
  assert.equal(answer.anchorStoppedFirst, true);
  assert.equal(answer.anchorHitCountObserved, 7, "the anchor's own count survives the early settle");
  assert.match(String(answer.anchorStoppedFirstNote), /exactly ONE resume/);

  assert.ok(
    elapsedMs < UNREACHABLE_DEADLINE_MS / 10,
    `expected the anchor frame to settle the wait immediately, but it took ${elapsedMs}ms of a ` +
      `${UNREACHABLE_DEADLINE_MS}ms deadline -- the terminal state was observed and then waited past`,
  );
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

// The gate on the early settle above, from the other side (33 review WR-01).
//
// At ONE address both checkpoints match the same instruction, so a single stop
// emits TWO CHECKPOINT_INFO frames and the target's arrives from that same stop
// -- no further execution needed, and the emission order is not ours to depend
// on. So the terminal-anchor shortcut must NOT apply here: if it did, the
// adjacent configuration's successful stop would become a spurious timeout
// refusal whenever the monitor happened to emit the anchor's frame first.
// Driven with emitAnchorFirst so the anchor frame genuinely arrives first.
test("reproducible: at frame_anchor === address an anchor frame arriving FIRST does NOT settle the wait -- both frames come from one stop", async () => {
  const { client } = makeFakeClient(greenSendImpl({ anchorHitCount: 9, emitAnchorFirst: true }));
  const result = await handleRunUntil(
    { address: "$ea31", reproducible: true, frame_anchor: "$ea31", timeout_ms: 200 },
    makeSession(client),
    FAKE_DEPS,
  );

  assertOk(result);
  const answer = okText(result);
  assert.equal(answer.timedOut, undefined, "adjacency must not be turned into a timeout refusal");
  assert.equal(answer.reproducibleStop, true);
  assert.equal(answer.targetCheckpointId, TARGET_ID, "still resolved on the TARGET's id (T-33-31)");
  assert.equal(answer.hitCount, 9, "and the frame term is still the anchor's own count");
  assert.equal(answer.anchorHitsObserved, 1, "the anchor's frame was counted, not resolved on");
});

// ---------------------------------------------------------------------------
// 6b. Cleanup path 3 of 3 -- a FAILING resume, with the instance still alive
// ---------------------------------------------------------------------------
//
// WHY (33 review WR-02). The no-cleanup-at-all rule was justified by "the
// machine has restarted, so the instance and every checkpoint on it are
// already gone". That premise covers only ONE of the causes: `send(Exit)` also
// rejects on a StockProtocolError from the EXIT reply, or on the client's own
// per-request timeout, with the socket and instance still alive. The frame
// anchor is temporary:false and stop:true at a once-per-frame address, so
// leaving it armed makes every later resume on that session halt within one
// frame -- indistinguishable from a wedge to vice-wedge-triage.
//
// Both directions are asserted, because the value here is in the DISTINCTION:
// a live instance gets its anchor deleted, a restarted one is untouched.

test("reproducible: a NON-restart resume failure on a live socket deletes the armed anchor before rethrowing", async () => {
  const deleted: number[] = [];
  const { client } = makeFakeClient(async (commandType: number, body: Buffer) => {
    if (commandType === CommandType.RegistersAvailable) return registersAvailableReply();
    if (commandType === CommandType.CheckpointSet) {
      return body[7] === 0x01
        ? checkpointInfoResponse(fakeCheckpoint({ id: TARGET_ID, temporary: true }))
        : checkpointInfoResponse(fakeCheckpoint({ id: ANCHOR_ID, temporary: false }));
    }
    if (commandType === CommandType.Reset) return { type: "unknown", requestId: 1, errorCode: 0 };
    if (commandType === CommandType.CheckpointDelete) {
      deleted.push(body.readUInt32LE(0));
      return { type: "checkpoint_delete", requestId: 1, errorCode: 0 };
    }
    // Not a restart: the socket and the instance are still there.
    if (commandType === CommandType.Exit) throw new Error("EXIT rejected with the instance still alive");
    throw new Error(`unexpected commandType 0x${commandType.toString(16)}`);
  });

  await assert.rejects(
    () => handleRunUntil({ ...REPRODUCIBLE_ARGS, timeout_ms: 200 }, makeSession(client), FAKE_DEPS),
    /EXIT rejected with the instance still alive/,
    "the original error still propagates -- the ONE converter seam produces the wording, not a second one here",
  );

  assert.ok(
    deleted.includes(ANCHOR_ID),
    `the stop:true anchor must not be left armed on a live instance (deleted: ${JSON.stringify(deleted)})`,
  );
});

test("reproducible: a MachineRestartedError resume failure attempts NO delete -- the instance took its checkpoints with it", async () => {
  const deleted: number[] = [];
  const { client } = makeFakeClient(async (commandType: number, body: Buffer) => {
    if (commandType === CommandType.RegistersAvailable) return registersAvailableReply();
    if (commandType === CommandType.CheckpointSet) {
      return body[7] === 0x01
        ? checkpointInfoResponse(fakeCheckpoint({ id: TARGET_ID, temporary: true }))
        : checkpointInfoResponse(fakeCheckpoint({ id: ANCHOR_ID, temporary: false }));
    }
    if (commandType === CommandType.Reset) return { type: "unknown", requestId: 1, errorCode: 0 };
    if (commandType === CommandType.CheckpointDelete) {
      deleted.push(body.readUInt32LE(0));
      return { type: "checkpoint_delete", requestId: 1, errorCode: 0 };
    }
    if (commandType === CommandType.Exit) throw new MachineRestartedError("the machine restarted under the wait");
    throw new Error(`unexpected commandType 0x${commandType.toString(16)}`);
  });

  await assert.rejects(
    () => handleRunUntil({ ...REPRODUCIBLE_ARGS, timeout_ms: 200 }, makeSession(client), FAKE_DEPS),
    MachineRestartedError,
  );

  assert.deepEqual(deleted, [], "nothing is deleted down a socket whose instance is gone");
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

/** A client that would THROW on any send at all -- proves a refusal happened
 * in the argument gate, before a single byte reached the monitor. */
function noSendClient(): FakeClient {
  return makeFakeClient(async (commandType: number) => {
    throw new Error(`nothing may be sent on a refused call (got 0x${commandType.toString(16)})`);
  });
}

// ---------------------------------------------------------------------------
// 10. D-14: reproducible without frame_anchor refuses, naming WHY
// ---------------------------------------------------------------------------

test("D-14: reproducible: true with no frame_anchor is REFUSED, naming frame_anchor and why the frame term cannot be supplied", async () => {
  const { client, calls } = noSendClient();
  const result = await handleRunUntil({ address: "$c000", reproducible: true }, makeSession(client), FAKE_DEPS);
  assertErr(result);
  const text = errText(result);

  // Names the required sibling -- read from the one definition, not a literal.
  assert.match(text, /frame_anchor/);
  assert.ok(text.includes(REPRODUCIBLE_RUN_REQUIRED_SIBLINGS[0]));
  // States WHY the frame term cannot otherwise be supplied.
  assert.match(text, /release-specific|RELEASE-SPECIFIC/);
  assert.match(text, /takes over the IRQ/);
  assert.match(text, /\$EA31|\$ea31/);
  // States that refusing beats degrading to a two-term identity.
  assert.match(text, /Refusing beats silently degrading/);
  assert.match(text, /two-term stop identity/);
  // And nothing was sent: refused in the gate, machine untouched.
  assert.deepEqual(calls, []);
});

test("D-14: frame_anchor WITHOUT reproducible is refused rather than accepted and ignored", async () => {
  for (const args of [
    { address: "$c000", frame_anchor: "$ea31" },
    { address: "$c000", frame_anchor: "$ea31", reproducible: false },
  ]) {
    const { client, calls } = noSendClient();
    const result = await handleRunUntil(args, makeSession(client), FAKE_DEPS);
    assertErr(result);
    assert.match(errText(result), /has no meaning without "reproducible": true/);
    assert.match(errText(result), /accepted and IGNORED/);
    assert.match(errText(result), /Refused rather than dropped/);
    assert.deepEqual(calls, []);
  }
});

// ---------------------------------------------------------------------------
// 11. Type validation and the by-name gate
// ---------------------------------------------------------------------------

test("reproducible: a non-boolean reproducible is refused NAMING the value, never coerced", async () => {
  for (const value of ["true", "false", 1, 0, {}, []]) {
    const { client, calls } = noSendClient();
    const result = await handleRunUntil(
      { address: "$c000", reproducible: value, frame_anchor: "$ea31" },
      makeSession(client),
      FAKE_DEPS,
    );
    assertErr(result);
    assert.match(errText(result), /reproducible must be a boolean/);
    assert.ok(errText(result).includes(JSON.stringify(value)), `message must name the offending value ${JSON.stringify(value)}`);
    assert.deepEqual(calls, [], "nothing may be sent for a malformed argument");
  }
  // The specific trap the refusal exists for: "false" is truthy, so a coercing
  // gate would run the whole protocol -- hard reset included -- for a caller
  // who meant to disable it.
  const { client } = noSendClient();
  const result = await handleRunUntil(
    { address: "$c000", reproducible: "false", frame_anchor: "$ea31" },
    makeSession(client),
    FAKE_DEPS,
  );
  assertErr(result);
  assert.match(errText(result), /truthy/);
});

test("reproducible: a malformed frame_anchor is refused with parseAddress's own wording", async () => {
  for (const value of ["$zzzz", -1, {}, "not-an-address"]) {
    const { client, calls } = noSendClient();
    const result = await handleRunUntil(
      { address: "$c000", reproducible: true, frame_anchor: value },
      makeSession(client),
      FAKE_DEPS,
    );
    assertErr(result);
    assert.match(errText(result), /^vice_run_until: /);
    assert.match(errText(result), /frame_anchor/, `parseAddress's \`what:\` label must name frame_anchor for ${JSON.stringify(value)}`);
    assert.deepEqual(calls, []);
  }
});

test("reproducible: an unknown key alongside the two new ones is still refused BY NAME", async () => {
  const { client, calls } = noSendClient();
  const result = await handleRunUntil(
    { reproducible: true, frame_anchor: "$ea31", turbo: true },
    makeSession(client),
    FAKE_DEPS,
  );
  assertErr(result);
  assert.match(errText(result), /unexpected argument\(s\): turbo/);
  // The message lists all five accepted names, so a caller sees the whole set.
  for (const key of RUN_UNTIL_KEYS) assert.ok(errText(result).includes(key), `refusal must list "${key}"`);
  assert.deepEqual(calls, []);
});

test("reproducible: a typo'd `reproducable` is refused by name, never silently running the ordinary path", async () => {
  const { client, calls } = noSendClient();
  const result = await handleRunUntil(
    { address: "$c000", reproducable: true, frame_anchor: "$ea31" },
    makeSession(client),
    FAKE_DEPS,
  );
  assertErr(result);
  assert.match(errText(result), /unexpected argument\(s\): reproducable/);
  assert.deepEqual(calls, []);
});

// ---------------------------------------------------------------------------
// 12. The stock manifest declares both keys as PURE widenings
// ---------------------------------------------------------------------------

test("D-12: tools-manifest.stock.json declares reproducible and frame_anchor as optional, with no required array introduced", async () => {
  const manifest = JSON.parse(await readFile(new URL("./tools-manifest.stock.json", import.meta.url), "utf8"));
  const tool = (manifest.tools ?? manifest).find((entry: { name: string }) => entry.name === "vice_run_until");
  assert.ok(tool, "vice_run_until must be present in the stock manifest");

  const props = tool.inputSchema.properties;
  assert.equal(props.reproducible.type, "boolean");
  assert.equal(props.frame_anchor.type, "string");

  // A PURE widening: no `required` array exists, so neither key -- nor any
  // pre-existing one -- became newly required. That is what keeps the addition
  // inside the compatibility rule (stock may ADD optional parameters but never
  // removes, retypes, or newly-requires one).
  assert.equal(tool.inputSchema.required, undefined);
  // The three pre-existing keys are untouched and still typed as they were.
  assert.equal(props.address.type, "string");
  assert.equal(props.cycles.type, "number");
  assert.equal(props.timeout_ms.type, "number");

  // Every accepted argument name is declared, and nothing is declared that the
  // handler would refuse -- the manifest and the gate cannot drift apart.
  assert.deepEqual(Object.keys(props).sort(), [...RUN_UNTIL_KEYS].sort());

  // The descriptions carry the two facts a caller cannot discover by trying:
  // that frame_anchor is required when reproducible is true, and why.
  assert.match(props.frame_anchor.description, /REQUIRED whenever reproducible is true/);
  assert.match(props.frame_anchor.description, /release-specific/);
  assert.match(props.reproducible.description, /no skip_reset, no_anchor or reset_only/);
  assert.match(tool.description, /reproducible/);
});

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
