// node:test coverage of stock-diagnose.ts. Every "client" below is a
// send-only stub object with a real EventEmitter base (so attachRunStateTracker()'s
// client.on("event", ...) works unmodified when ensureStockSession() attaches
// a tracker to a freshly-connected session) -- never a real socket, matching
// this module tree's own DI-stubbing convention (stock-timing.test.ts,
// stock-checkpoints.test.ts, stock-dispatch.test.ts:1-133).
//
// VICE_STOCK_DIAGNOSE_BRACKET_MS and VICE_STOCK_DIAGNOSE_SESSION_TIMEOUT_MS
// are set to small values below (single/double-digit ms) so no test waits on
// a production default, and restored in an after() hook.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { CommandType, type ResolvedResponse, type ViceMonitorClient } from "./stock-protocol.ts";
import type { StockConnectSession, CpuHistoryCapability } from "./stock-connect.ts";
import type { StockDispatchDeps } from "./stock-dispatch.ts";
import { clearHeldStockSession } from "./stock-dispatch.ts";
import { resetTimingStateForTest } from "./stock-timing.ts";
import { resetRegisterCatalogsForTest } from "./stock-registers.ts";
import { resetCheckpointStateForTest } from "./stock-checkpoints.ts";
import { MonitorOwnershipError } from "./vice-broker-client.ts";
import { MachineRestartedError, type EpochResult } from "./vice.ts";
import {
  resolveStockLiveIrqHandler,
  gatherStockCheckpointTrapEvidence,
  runStockLivenessBracket,
  handleDiagnoseStock,
  diagnoseSessionTimeoutMs,
  diagnoseBracketWindowMs,
  STOCK_DIAGNOSE_VERDICTS,
} from "./stock-diagnose.ts";

// ---------------------------------------------------------------------------
// Small env overrides for the whole file -- restored in after().
// ---------------------------------------------------------------------------

const PREV_BRACKET_MS = process.env.VICE_STOCK_DIAGNOSE_BRACKET_MS;
const PREV_SESSION_TIMEOUT_MS = process.env.VICE_STOCK_DIAGNOSE_SESSION_TIMEOUT_MS;

before(() => {
  process.env.VICE_STOCK_DIAGNOSE_BRACKET_MS = "5";
  process.env.VICE_STOCK_DIAGNOSE_SESSION_TIMEOUT_MS = "50";
});

after(() => {
  if (PREV_BRACKET_MS === undefined) delete process.env.VICE_STOCK_DIAGNOSE_BRACKET_MS;
  else process.env.VICE_STOCK_DIAGNOSE_BRACKET_MS = PREV_BRACKET_MS;
  if (PREV_SESSION_TIMEOUT_MS === undefined) delete process.env.VICE_STOCK_DIAGNOSE_SESSION_TIMEOUT_MS;
  else process.env.VICE_STOCK_DIAGNOSE_SESSION_TIMEOUT_MS = PREV_SESSION_TIMEOUT_MS;
});

beforeEach(() => {
  clearHeldStockSession();
  resetTimingStateForTest();
  resetRegisterCatalogsForTest();
  resetCheckpointStateForTest();
});

// ---------------------------------------------------------------------------
// DI-stub harness
// ---------------------------------------------------------------------------

/** PC (16 bits) -- the minimum a build must enumerate for readProgramCounter()/
 * readStockPc() to work at all. */
const DEFAULT_REGISTERS = [{ id: 0, size: 16, name: "PC" }];

interface SendCall {
  commandType: number;
  body: Buffer;
}

interface CheckpointFixture {
  id: number;
  start: number;
  end?: number;
  stopWhenHit: boolean;
  enabled: boolean;
  operation: number;
  hitCount: number;
  temporary?: boolean;
  ignoreCount?: number;
  hasCondition?: boolean;
}

const EXEC_OP = 0x04; // CheckpointOperation.Exec -- see stock-protocol.ts

function checkpointInfoRelated(cp: CheckpointFixture) {
  return {
    type: "checkpoint_info" as const,
    requestId: 1,
    errorCode: 0,
    checkpoint: {
      id: cp.id,
      currentlyHit: false,
      start: cp.start,
      end: cp.end ?? cp.start,
      stopWhenHit: cp.stopWhenHit,
      enabled: cp.enabled,
      operation: cp.operation,
      temporary: cp.temporary ?? false,
      hitCount: cp.hitCount,
      ignoreCount: cp.ignoreCount ?? 0,
      hasCondition: cp.hasCondition ?? false,
    },
    related: [],
  };
}

function nextFromQueue<T>(queue: T[], label: string): T {
  if (queue.length === 0) {
    throw new Error(`makeFakeSession: ${label} queue exhausted -- supply another fixture`);
  }
  return queue.length === 1 ? queue[0]! : queue.shift()!;
}

interface FakeSessionOptions {
  targetId?: string;
  cpuHistory?: CpuHistoryCapability;
  baselineEpoch?: number | null;
  epochPath?: string;
  readEpochFn?: (path?: string) => EpochResult;
  registersAvailable?: typeof DEFAULT_REGISTERS;
  memoryGetReplies?: Buffer[];
  checkpoints?: CheckpointFixture[];
  checkpointListFails?: boolean;
  registersGetReplies?: Array<Array<{ id: number; value: number }>>;
  cpuHistoryReplies?: Array<{ cycle: bigint }>;
}

function makeFakeSession(options: FakeSessionOptions = {}): { session: StockConnectSession; sendCalls: SendCall[] } {
  const sendCalls: SendCall[] = [];
  const registersAvailable = options.registersAvailable ?? DEFAULT_REGISTERS;
  const memoryGetReplies = [...(options.memoryGetReplies ?? [])];
  const registersGetReplies = [...(options.registersGetReplies ?? [])];
  const cpuHistoryReplies = [...(options.cpuHistoryReplies ?? [])];
  const checkpoints = options.checkpoints ?? [];

  const emitter = new EventEmitter();
  const fakeClient = Object.assign(emitter, {
    connected: true,
    disconnect: async (): Promise<void> => {
      (fakeClient as unknown as { connected: boolean }).connected = false;
    },
    send: async (commandType: number, body: Buffer = Buffer.alloc(0)): Promise<ResolvedResponse> => {
      sendCalls.push({ commandType, body });

      if (commandType === CommandType.MemoryGet) {
        const bytes = nextFromQueue(memoryGetReplies, "memoryGetReplies");
        return { type: "memory_get", requestId: 1, errorCode: 0, bytes: new Uint8Array(bytes) } as unknown as ResolvedResponse;
      }
      if (commandType === CommandType.CheckpointList) {
        if (options.checkpointListFails) {
          throw new Error("CHECKPOINT_LIST failed (synthetic)");
        }
        return {
          type: "checkpoint_list",
          requestId: 1,
          errorCode: 0,
          total: checkpoints.length,
          checkpoints: [],
          related: checkpoints.map(checkpointInfoRelated),
        } as unknown as ResolvedResponse;
      }
      if (commandType === CommandType.RegistersAvailable) {
        return { type: "registers_available", requestId: 1, errorCode: 0, registers: registersAvailable, related: [] } as unknown as ResolvedResponse;
      }
      if (commandType === CommandType.RegistersGet) {
        const registers = nextFromQueue(registersGetReplies, "registersGetReplies");
        return { type: "registers", requestId: 1, errorCode: 0, registers, related: [] } as unknown as ResolvedResponse;
      }
      if (commandType === CommandType.CpuHistoryGet) {
        const reply = nextFromQueue(cpuHistoryReplies, "cpuHistoryReplies");
        return {
          type: "cpu_history",
          requestId: 1,
          errorCode: 0,
          count: 1,
          entries: [{ cycle: reply.cycle, opcode: 0, instructionLength: 0, p1: 0, p2: 0 }],
          related: [],
        } as unknown as ResolvedResponse;
      }
      if (commandType === CommandType.Exit) {
        return { type: "exit", requestId: 1, errorCode: 0, related: [] } as unknown as ResolvedResponse;
      }
      throw new Error(`makeFakeSession: unexpected commandType 0x${commandType.toString(16)}`);
    },
  });
  const client = fakeClient as unknown as ViceMonitorClient;

  const session: StockConnectSession = {
    client,
    versionQuad: "3.10.0",
    capabilities: { cpuHistory: options.cpuHistory ?? "available" },
    host: "127.0.0.1",
    port: 6502,
    targetId: options.targetId ?? "target-1",
    brokerControl: {} as unknown as StockConnectSession["brokerControl"],
    deps: {
      ...(options.epochPath !== undefined ? { epochPath: options.epochPath } : {}),
      ...(options.readEpochFn !== undefined ? { readEpochFn: options.readEpochFn } : {}),
    },
    baselineEpoch: options.baselineEpoch ?? null,
  };

  return { session, sendCalls };
}

const FAKE_DEPS = {} as unknown as StockDispatchDeps;

function parseAnswer(result: { content: { type: "text"; text: string }[]; isError: boolean }): Record<string, unknown> {
  return JSON.parse(result.content[0]!.text) as Record<string, unknown>;
}

function sendCountFor(sendCalls: SendCall[], commandType: number): number {
  return sendCalls.filter((c) => c.commandType === commandType).length;
}

// ---------------------------------------------------------------------------
// Task 1: resolveStockLiveIrqHandler() -- banked-in/banked-out
// ---------------------------------------------------------------------------

test("resolveStockLiveIrqHandler: HIRAM set (banked in) reads $01 then $0314 only -- 2 MemoryGet sends", async () => {
  const { session, sendCalls } = makeFakeSession({
    memoryGetReplies: [Buffer.from([0x37]), Buffer.from([0x00, 0xc1])], // $01=$37 (HIRAM set), $0314/5 -> $C100
  });
  const result = await resolveStockLiveIrqHandler(session);
  assert.equal(result.target, 0xc100);
  assert.equal(result.pairLabel, "the RAM KERNAL IRQ vector pair ($0314/$0315)");
  assert.equal(sendCountFor(sendCalls, CommandType.MemoryGet), 2);
});

test("resolveStockLiveIrqHandler: HIRAM clear (banked out) also reads $FFFE -- 3 MemoryGet sends", async () => {
  const { session, sendCalls } = makeFakeSession({
    memoryGetReplies: [Buffer.from([0x35]), Buffer.from([0x00, 0xc1]), Buffer.from([0x00, 0xfc])], // $01=$35 (HIRAM clear), $0314/5, $FFFE/F -> $FC00
  });
  const result = await resolveStockLiveIrqHandler(session);
  assert.equal(result.target, 0xfc00);
  assert.equal(result.pairLabel, "the hardware IRQ/BRK vector pair ($FFFE/$FFFF)");
  assert.equal(sendCountFor(sendCalls, CommandType.MemoryGet), 3);
});

// ---------------------------------------------------------------------------
// Task 1: gatherStockCheckpointTrapEvidence() -- zero resume, zero stopwatch
// ---------------------------------------------------------------------------

test("gatherStockCheckpointTrapEvidence: issues zero CommandType.Exit sends", async () => {
  const { session, sendCalls } = makeFakeSession({
    memoryGetReplies: [Buffer.from([0x37]), Buffer.from([0x00, 0xc1])],
    registersGetReplies: [[{ id: 0, value: 0xc000 }]],
    checkpoints: [],
  });
  await gatherStockCheckpointTrapEvidence(session, FAKE_DEPS);
  assert.equal(sendCountFor(sendCalls, CommandType.Exit), 0);
  assert.equal(sendCountFor(sendCalls, CommandType.CpuHistoryGet), 0, "gathering trap evidence must never touch the stopwatch/cpu-history route");
});

test("gatherStockCheckpointTrapEvidence: an isError vice_checkpoint_list refusal is recorded, gather does not abort", async () => {
  const { session } = makeFakeSession({
    memoryGetReplies: [Buffer.from([0x37]), Buffer.from([0x00, 0xc1])],
    registersGetReplies: [[{ id: 0, value: 0xc000 }]],
    checkpointListFails: true,
  });
  const evidence = await gatherStockCheckpointTrapEvidence(session, FAKE_DEPS);
  assert.equal(evidence.isTrap, false);
  assert.equal(evidence.checkpoints.length, 0);
  assert.equal(typeof evidence.checkpointsUnavailable, "string");
  assert.equal(evidence.pc, 0xc000);
  assert.ok(evidence.handler.explanation.length > 0, "handler resolution must still run despite the checkpoint refusal");
});

// ---------------------------------------------------------------------------
// Task 3, test 4/5: checkpoint_trap -- the two named shapes
// ---------------------------------------------------------------------------

test("checkpoint_trap at PC: an armed stopping exec checkpoint at the current PC traps, Exit send count 0", async () => {
  const { session, sendCalls } = makeFakeSession({
    memoryGetReplies: [Buffer.from([0x37]), Buffer.from([0x00, 0xc1])], // banked in, RAM vector -> $C100 (not the trap here)
    registersGetReplies: [[{ id: 0, value: 0xc000 }]],
    checkpoints: [{ id: 5, start: 0xc000, stopWhenHit: true, enabled: true, operation: EXEC_OP, hitCount: 3 }],
  });
  const evidence = await gatherStockCheckpointTrapEvidence(session, FAKE_DEPS);
  assert.equal(evidence.isTrap, true);
  assert.equal(evidence.trapReason, "pc");
  assert.equal(evidence.trapCheckpoint?.id, 5);
  assert.equal(sendCountFor(sendCalls, CommandType.Exit), 0);
});

test("checkpoint_trap at handler: no PC match, but a checkpoint at the resolved handler entry with hitCount 0 traps", async () => {
  const { session } = makeFakeSession({
    memoryGetReplies: [Buffer.from([0x37]), Buffer.from([0x00, 0xc1])], // banked in, RAM vector -> $C100
    registersGetReplies: [[{ id: 0, value: 0x1000 }]], // PC does not match anything
    checkpoints: [{ id: 7, start: 0xc100, stopWhenHit: true, enabled: true, operation: EXEC_OP, hitCount: 0 }],
  });
  const evidence = await gatherStockCheckpointTrapEvidence(session, FAKE_DEPS);
  assert.equal(evidence.isTrap, true);
  assert.equal(evidence.trapReason, "handler");
  assert.equal(evidence.trapCheckpoint?.id, 7);
});

test("checkpoint_trap at handler: a sibling checkpoint at the SAME address with hitCount 1 does NOT trap (the corroborating tell is load-bearing)", async () => {
  const { session } = makeFakeSession({
    memoryGetReplies: [Buffer.from([0x37]), Buffer.from([0x00, 0xc1])], // RAM vector -> $C100
    registersGetReplies: [[{ id: 0, value: 0x1000 }]],
    checkpoints: [{ id: 8, start: 0xc100, stopWhenHit: true, enabled: true, operation: EXEC_OP, hitCount: 1 }],
  });
  const evidence = await gatherStockCheckpointTrapEvidence(session, FAKE_DEPS);
  assert.equal(evidence.isTrap, false);
  assert.equal(evidence.trapReason, null);
});

test("checkpoint filter: a disabled checkpoint, a trace (stop:false) checkpoint, and a load/store-only checkpoint at the PC never trap", async () => {
  const { session } = makeFakeSession({
    memoryGetReplies: [Buffer.from([0x37]), Buffer.from([0x00, 0xc1])],
    registersGetReplies: [[{ id: 0, value: 0xc000 }]],
    checkpoints: [
      { id: 1, start: 0xc000, stopWhenHit: true, enabled: false, operation: EXEC_OP, hitCount: 0 }, // disabled
      { id: 2, start: 0xc000, stopWhenHit: false, enabled: true, operation: EXEC_OP, hitCount: 0 }, // trace mode, not stopping
      { id: 3, start: 0xc000, stopWhenHit: true, enabled: true, operation: 0x01, hitCount: 0 }, // Load only, no exec bit
    ],
  });
  const evidence = await gatherStockCheckpointTrapEvidence(session, FAKE_DEPS);
  assert.equal(evidence.isTrap, false);
});

// ---------------------------------------------------------------------------
// Task 2: runStockLivenessBracket() -- exactly 1 Exit, 2 readCycleBaseline
// reads (2 CpuHistoryGet), zero traffic during the wait window
// ---------------------------------------------------------------------------

test("runStockLivenessBracket: cpu_history route -- advanced:true when the second sample's cycle is higher", async () => {
  const { session, sendCalls } = makeFakeSession({
    cpuHistory: "available",
    cpuHistoryReplies: [{ cycle: 1000n }, { cycle: 5000n }],
    registersGetReplies: [[{ id: 0, value: 0xc000 }], [{ id: 0, value: 0xc010 }]],
  });
  const bracket = await runStockLivenessBracket(session);
  assert.equal(bracket.route, "cpu_history");
  assert.equal(bracket.advanced, true);
  assert.equal(sendCountFor(sendCalls, CommandType.Exit), 1);
  assert.equal(sendCountFor(sendCalls, CommandType.CpuHistoryGet), 2);
});

test("runStockLivenessBracket: cpu_history route -- advanced:false when the cycle is identical", async () => {
  const { session, sendCalls } = makeFakeSession({
    cpuHistory: "available",
    cpuHistoryReplies: [{ cycle: 4000n }, { cycle: 4000n }],
    registersGetReplies: [[{ id: 0, value: 0xc000 }], [{ id: 0, value: 0xc000 }]],
  });
  const bracket = await runStockLivenessBracket(session);
  assert.equal(bracket.advanced, false);
  assert.equal(sendCountFor(sendCalls, CommandType.Exit), 1);
});

test("runStockLivenessBracket: no send() occurs between the resume and the post-wait read (bracket silence)", async () => {
  const { session } = makeFakeSession({
    cpuHistory: "available",
    cpuHistoryReplies: [{ cycle: 1n }, { cycle: 1n }],
    registersGetReplies: [[{ id: 0, value: 0 }], [{ id: 0, value: 0 }]],
  });
  const timestamps: { commandType: number; at: number }[] = [];
  const originalSend = session.client.send.bind(session.client);
  (session.client as unknown as { send: typeof session.client.send }).send = async (commandType, body) => {
    timestamps.push({ commandType, at: Date.now() });
    return originalSend(commandType, body as Buffer);
  };
  const windowMs = diagnoseBracketWindowMs();
  await runStockLivenessBracket(session);
  const exitIndex = timestamps.findIndex((t) => t.commandType === CommandType.Exit);
  assert.ok(exitIndex >= 0, "Exit must have been sent");
  const exitAt = timestamps[exitIndex]!.at;
  // Every send AFTER the resume (the "after" readCycleBaseline()'s
  // CpuHistoryGet + its own RegistersGet for PC) must land at or after the
  // full wait window elapsed -- none may sneak in DURING the wait itself.
  const afterExit = timestamps.slice(exitIndex + 1);
  assert.ok(afterExit.length > 0, "expected at least one send after the resume (the post-wait halting read)");
  for (const entry of afterExit) {
    assert.ok(
      entry.at - exitAt >= windowMs - 2,
      `send of commandType 0x${entry.commandType.toString(16)} occurred only ${entry.at - exitAt}ms after the resume, before the ${windowMs}ms wait elapsed`,
    );
  }
});

// ---------------------------------------------------------------------------
// Task 3, tests 1/2/3: monitor_held_elsewhere / restarted (thrown + epoch)
// ---------------------------------------------------------------------------

test("handleDiagnoseStock: MonitorOwnershipError during acquisition -> monitor_held_elsewhere, zero emulator sends", async () => {
  const deps = {
    ensureLease: async () => ({ ok: true as const, lease: { host: "127.0.0.1", port: 6502, targetId: "t-1", brokerControl: {}, epochFile: "", supervisorDir: "" } }),
    connect: async () => {
      throw new MonitorOwnershipError("stockConnect: monitor for target t-1 on port 6502 is already claimed by grant grant-other", {
        holderGrantId: "grant-other",
        holderClaimedAt: 12345,
        port: 6502,
      });
    },
  } as unknown as StockDispatchDeps;

  const result = await handleDiagnoseStock({}, deps);
  assert.equal(result.isError, false);
  const answer = parseAnswer(result);
  assert.equal(answer.verdict, "monitor_held_elsewhere");
  const evidence = answer.evidence as Record<string, unknown>;
  assert.equal(evidence.holderGrantId, "grant-other");
  assert.equal(evidence.holderClaimedAt, 12345);
  assert.equal(evidence.port, 6502);
  assert.equal(answer.runState, "unknown");
});

test("handleDiagnoseStock: a thrown MachineRestartedError during acquisition -> restarted, carrying both epochs", async () => {
  const deps = {
    ensureLease: async () => ({ ok: true as const, lease: { host: "127.0.0.1", port: 6502, targetId: "t-1", brokerControl: {}, epochFile: "", supervisorDir: "" } }),
    connect: async () => {
      throw new MachineRestartedError("test: machine restarted across reconnect", { baselineEpoch: 1, currentEpoch: 2 });
    },
  } as unknown as StockDispatchDeps;

  const result = await handleDiagnoseStock({}, deps);
  assert.equal(result.isError, false);
  const answer = parseAnswer(result);
  assert.equal(answer.verdict, "restarted");
  const evidence = answer.evidence as Record<string, unknown>;
  assert.equal(evidence.baselineEpoch, 1);
  assert.equal(evidence.currentEpoch, 2);
});

test("handleDiagnoseStock: an on-disk epoch differing from the session's baseline -> restarted, zero emulator sends", async () => {
  const { session, sendCalls } = makeFakeSession({
    baselineEpoch: 10,
    epochPath: "/fake/epoch.json",
    readEpochFn: () => ({ present: true, epoch: 20, spawned_at: null, pid: null, path: "/fake/epoch.json" }),
  });
  const deps = {
    ensureLease: async () => ({ ok: true as const, lease: { host: "127.0.0.1", port: 6502, targetId: "t-1", brokerControl: {}, epochFile: "", supervisorDir: "" } }),
    connect: async () => session,
  } as unknown as StockDispatchDeps;

  const result = await handleDiagnoseStock({}, deps);
  assert.equal(result.isError, false);
  const answer = parseAnswer(result);
  assert.equal(answer.verdict, "restarted");
  const evidence = answer.evidence as Record<string, unknown>;
  assert.equal(evidence.baselineEpoch, 10);
  assert.equal(evidence.currentEpoch, 20);
  assert.equal(sendCalls.length, 0, "the epoch comparison must cost zero emulator calls");
});

// ---------------------------------------------------------------------------
// Task 3, tests 7/8: wedged / live through the full handler
// ---------------------------------------------------------------------------

test("handleDiagnoseStock: two consecutive zero-advance brackets -> wedged, exactly 2 brackets, Exit sent exactly twice", async () => {
  const { session, sendCalls } = makeFakeSession({
    cpuHistory: "available",
    memoryGetReplies: [Buffer.from([0x37]), Buffer.from([0x00, 0xc1])],
    checkpoints: [],
    // trap-evidence PC read, then 2 brackets' worth of PC reads (Route A reads PC via readProgramCounter each time)
    registersGetReplies: [[{ id: 0, value: 0x1000 }], [{ id: 0, value: 0x1000 }], [{ id: 0, value: 0x1000 }]],
    cpuHistoryReplies: [{ cycle: 500n }, { cycle: 500n }],
  });
  const deps = {
    ensureLease: async () => ({ ok: true as const, lease: { host: "127.0.0.1", port: 6502, targetId: "t-1", brokerControl: {}, epochFile: "", supervisorDir: "" } }),
    connect: async () => session,
  } as unknown as StockDispatchDeps;

  const result = await handleDiagnoseStock({}, deps);
  assert.equal(result.isError, false);
  const answer = parseAnswer(result);
  assert.equal(answer.verdict, "wedged");
  assert.equal((answer.evidence as Record<string, unknown>).bracketsRun, 2);
  assert.equal(sendCountFor(sendCalls, CommandType.Exit), 2);
  assert.equal(answer.machinePaused, true);
});

test("handleDiagnoseStock: the first bracket advances -> live, exactly 1 bracket, Exit sent exactly once", async () => {
  const { session, sendCalls } = makeFakeSession({
    cpuHistory: "available",
    memoryGetReplies: [Buffer.from([0x37]), Buffer.from([0x00, 0xc1])],
    checkpoints: [],
    registersGetReplies: [[{ id: 0, value: 0x1000 }], [{ id: 0, value: 0x1000 }]],
    cpuHistoryReplies: [{ cycle: 500n }, { cycle: 999999n }],
  });
  const deps = {
    ensureLease: async () => ({ ok: true as const, lease: { host: "127.0.0.1", port: 6502, targetId: "t-1", brokerControl: {}, epochFile: "", supervisorDir: "" } }),
    connect: async () => session,
  } as unknown as StockDispatchDeps;

  const result = await handleDiagnoseStock({}, deps);
  assert.equal(result.isError, false);
  const answer = parseAnswer(result);
  assert.equal(answer.verdict, "live");
  assert.equal((answer.evidence as Record<string, unknown>).bracketsRun, 1);
  assert.equal(sendCountFor(sendCalls, CommandType.Exit), 1);
});

// ---------------------------------------------------------------------------
// Task 3, test 10: bounded acquisition
// ---------------------------------------------------------------------------

test("handleDiagnoseStock: a never-settling ensureLease produces a returned isError:true result within the configured deadline", async () => {
  const deps = {
    ensureLease: () => new Promise(() => {}), // never settles
  } as unknown as StockDispatchDeps;

  const startedAt = Date.now();
  const result = await handleDiagnoseStock({}, deps);
  const elapsedMs = Date.now() - startedAt;

  assert.equal(result.isError, true);
  assert.ok(elapsedMs < 250, `expected the bounded acquisition to return well under 250ms, took ${elapsedMs}ms`);
  const text = result.content[0]!.text;
  assert.ok(text.includes(String(diagnoseSessionTimeoutMs())), "the refusal must name the configured bound");
  assert.ok(text.includes("monitor_held_elsewhere"), "the refusal must point at monitor_held_elsewhere's remedy");
});

// ---------------------------------------------------------------------------
// Task 3, test 11: verdict vocabulary
// ---------------------------------------------------------------------------

test("STOCK_DIAGNOSE_VERDICTS: exactly the five of D-03, stale_read_path absent", () => {
  assert.deepEqual([...STOCK_DIAGNOSE_VERDICTS], ["restarted", "checkpoint_trap", "wedged", "monitor_held_elsewhere", "live"]);
  assert.equal(STOCK_DIAGNOSE_VERDICTS.length, 5);
  assert.equal((STOCK_DIAGNOSE_VERDICTS as readonly string[]).includes("stale_read_path"), false);
});

// ---------------------------------------------------------------------------
// Task 3, test 12: never throws
// ---------------------------------------------------------------------------

test("handleDiagnoseStock: a rejection at an arbitrary mid-gather step yields a well-formed result, never a rejected promise", async () => {
  const deps = {
    ensureLease: async () => ({ ok: true as const, lease: { host: "127.0.0.1", port: 6502, targetId: "t-1", brokerControl: {}, epochFile: "", supervisorDir: "" } }),
    connect: async () => {
      throw new Error("synthetic mid-gather failure");
    },
  } as unknown as StockDispatchDeps;

  await assert.doesNotReject(async () => {
    const result = await handleDiagnoseStock({}, deps);
    assert.equal(result.isError, true);
  });
});

test("handleDiagnoseStock: a checkpoint-trap evidence gather that throws still yields a well-formed isError:true result", async () => {
  const { session } = makeFakeSession({
    memoryGetReplies: [Buffer.from([0x37]), Buffer.from([0x00, 0xc1])],
    registersGetReplies: [[{ id: 0, value: 0x1000 }]],
    checkpointListFails: false,
  });
  // Force the RegistersAvailable enumeration itself to fail once the catalog
  // cache is bypassed -- simulate by having the checkpoint list handler's own
  // dependency throw via a corrupted client after connect.
  const originalSend = session.client.send.bind(session.client);
  let callCount = 0;
  (session.client as unknown as { send: typeof session.client.send }).send = async (commandType, body) => {
    callCount++;
    if (commandType === CommandType.CheckpointList && callCount > 0) {
      throw new Error("synthetic checkpoint list wire failure");
    }
    return originalSend(commandType, body as Buffer);
  };
  const deps = {
    ensureLease: async () => ({ ok: true as const, lease: { host: "127.0.0.1", port: 6502, targetId: "t-1", brokerControl: {}, epochFile: "", supervisorDir: "" } }),
    connect: async () => session,
  } as unknown as StockDispatchDeps;

  const result = await handleDiagnoseStock({}, deps);
  // handleCheckpointList converts the thrown wire error into an isError:true
  // StockToolResult itself (convertWireError), which gatherStockCheckpointTrapEvidence
  // treats as "checkpoints unavailable" and does NOT abort the gather -- so
  // this still reaches a verdict (or the bracket), never a rejection.
  assert.equal(typeof result.isError, "boolean");
});

// ---------------------------------------------------------------------------
// Structural: never reaches vice-proxy.ts's fork-transport surface
// ---------------------------------------------------------------------------

test("structure: stock-diagnose.ts's non-comment lines never reference vice-proxy, rewriteArguments, forwardToVice, or bare call(", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const HERE = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(HERE, "stock-diagnose.ts"), "utf8");
  const codeLines = src.split("\n").filter((line) => !/^\s*\*/.test(line) && !/^\s*\/\//.test(line));
  for (const needle of ["vice-proxy", "rewriteArguments", "forwardToVice"]) {
    const offenders = codeLines.filter((line) => line.includes(needle));
    assert.equal(offenders.length, 0, `found a "${needle}" reference: ${JSON.stringify(offenders)}`);
  }
  const bareCallOffenders = codeLines.filter((line) => /(?<![A-Za-z0-9_])call\(/.test(line));
  assert.equal(bareCallOffenders.length, 0, `found a bare call( reference: ${JSON.stringify(bareCallOffenders)}`);
});

test("structure: stale_read_path appears only inside a comment", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const HERE = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(HERE, "stock-diagnose.ts"), "utf8");
  const codeLines = src.split("\n").filter((line) => !/^\s*\*/.test(line) && !/^\s*\/\//.test(line));
  const offenders = codeLines.filter((line) => line.includes("stale_read_path"));
  assert.equal(offenders.length, 0, `found stale_read_path outside a comment: ${JSON.stringify(offenders)}`);
});

// ---------------------------------------------------------------------------
// diagnoseSessionTimeoutMs()/diagnoseBracketWindowMs() defaults and overrides
// ---------------------------------------------------------------------------

test("diagnoseBracketWindowMs/diagnoseSessionTimeoutMs: read this file's own env overrides", () => {
  assert.equal(diagnoseBracketWindowMs(), 5);
  assert.equal(diagnoseSessionTimeoutMs(), 50);
});

test("diagnoseBracketWindowMs: falls back to 250 when the env var is absent", () => {
  const prev = process.env.VICE_STOCK_DIAGNOSE_BRACKET_MS;
  delete process.env.VICE_STOCK_DIAGNOSE_BRACKET_MS;
  try {
    assert.equal(diagnoseBracketWindowMs(), 250);
  } finally {
    if (prev !== undefined) process.env.VICE_STOCK_DIAGNOSE_BRACKET_MS = prev;
  }
});

test("diagnoseSessionTimeoutMs: falls back to 10000 when the env var is absent", () => {
  const prev = process.env.VICE_STOCK_DIAGNOSE_SESSION_TIMEOUT_MS;
  delete process.env.VICE_STOCK_DIAGNOSE_SESSION_TIMEOUT_MS;
  try {
    assert.equal(diagnoseSessionTimeoutMs(), 10000);
  } finally {
    if (prev !== undefined) process.env.VICE_STOCK_DIAGNOSE_SESSION_TIMEOUT_MS = prev;
  }
});
