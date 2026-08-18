// node:test coverage of stock-timing.ts. Every "client" below is a
// send-only stub object cast via `as unknown as ViceMonitorClient` --
// never a real socket, matching this module tree's own DI-stubbing
// convention (stock-registers.test.ts's own header comment,
// stock-dispatch.test.ts:1-133). Synthetic replies are returned DIRECTLY as
// already-parsed shapes, not built through binmon-fixtures.ts's
// encodeResponseFrame() -- these tests assert route selection, arithmetic,
// caching, and every honest-refusal path, never frame decoding (which
// stock-protocol.test.ts already owns).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  CommandType,
  StockConnectionClosedError,
  StockRequestTimeoutError,
  type ResolvedResponse,
  type ViceMonitorClient,
} from "./stock-protocol.ts";
import { MachineRestartedError } from "./vice.ts";
import { classifyDiagnoseUnavailable } from "./stock-diagnose.ts";
import type { StockConnectSession, CpuHistoryCapability } from "./stock-connect.ts";
import type { StockDispatchDeps } from "./stock-dispatch.ts";
import {
  VIDEO_STANDARDS,
  resolveVideoStandard,
  positionWithinFrame,
  readCycleBaseline,
  handleCyclesStopwatch,
  resetTimingStateForTest,
  forgetTimingForOtherTargets,
} from "./stock-timing.ts";

beforeEach(() => {
  resetTimingStateForTest();
});

// ---------------------------------------------------------------------------
// Fixtures / DI-stub harness
// ---------------------------------------------------------------------------

/** PC (16 bits), LIN (16 bits), CYC (16 bits) -- the minimum a build must
 * enumerate for Route B to work at all. */
const DEFAULT_REGISTERS = [
  { id: 0, size: 16, name: "PC" },
  { id: 1, size: 16, name: "LIN" },
  { id: 2, size: 16, name: "CYC" },
];

/** A build that enumerates PC but neither LIN nor CYC -- Pitfall/test 8. */
const NO_LIN_CYC_REGISTERS = [{ id: 0, size: 16, name: "PC" }];

interface SendCall {
  commandType: number;
  body: Buffer;
}

interface CpuHistoryReplyFixture {
  count: number;
  entries: Array<{ cycle: bigint; opcode: number; instructionLength: number; p1: number; p2: number }>;
}

type ResourceGetReplyFixture = { valueType: "integer"; value: number } | { valueType: "string"; value: string } | "reject";

/** Builds one synthetic CPUHISTORY_GET entry -- opcode/instructionLength/
 * p1/p2 are never asserted on by these tests, so 0 stands in for all four. */
function historyEntry(cycle: bigint): CpuHistoryReplyFixture["entries"][number] {
  return { cycle, opcode: 0, instructionLength: 0, p1: 0, p2: 0 };
}

/** Shifts the front of `queue` off UNLESS it is the last remaining item, in
 * which case that last item is reused for every further call -- lets a
 * two-call test (reset then read) supply two distinct fixtures while a
 * one-call-forever test (e.g. a rejecting RESOURCE_GET reused across many
 * calls) supplies just one. */
function nextFromQueue<T>(queue: T[], label: string): T {
  if (queue.length === 0) {
    throw new Error(`makeFakeSession: ${label} queue exhausted -- supply another fixture`);
  }
  return queue.length === 1 ? queue[0]! : queue.shift()!;
}

interface FakeSessionOptions {
  targetId?: string;
  cpuHistory?: CpuHistoryCapability;
  registersAvailable?: typeof DEFAULT_REGISTERS;
  cpuHistoryReplies?: CpuHistoryReplyFixture[];
  registersGetReplies?: Array<Array<{ id: number; value: number }>>;
  resourceGetReplies?: ResourceGetReplyFixture[];
  /** WR-14: the restart epoch this session proved at connect. A DIFFERENT
   * epoch on the same targetId is exactly a recycle/respawn -- the case the
   * stopwatch baseline store and the video-standard cache must not reuse an
   * entry across. Defaults to null (identity unprovable), matching the
   * pre-WR-14 fixture shape so existing cases keep exercising the same path. */
  baselineEpoch?: number | null;
  /** WR-17: a RESOURCE_GET that rejects with a SPECIFIC typed error, rather
   * than the generic Error the `"reject"` fixture throws. A transport error
   * must propagate out of resolveVideoStandard() so the diagnose classifier can
   * name it, never be laundered into an "assuming PAL" value. */
  resourceGetRejectsWith?: unknown;
}

/** Builds a fake session + client pair. Every reply source is a QUEUE (see
 * nextFromQueue()) so a test can supply distinct "before"/"after" fixtures
 * for a reset-then-read pair. */
function makeFakeSession(options: FakeSessionOptions = {}): { session: StockConnectSession; sendCalls: SendCall[] } {
  const sendCalls: SendCall[] = [];
  const registersAvailable = options.registersAvailable ?? DEFAULT_REGISTERS;
  const cpuHistoryReplies = [...(options.cpuHistoryReplies ?? [])];
  const registersGetReplies = [...(options.registersGetReplies ?? [])];
  const resourceGetReplies = [...(options.resourceGetReplies ?? [])];

  const fakeClient = {
    send: async (commandType: number, body: Buffer = Buffer.alloc(0)): Promise<ResolvedResponse> => {
      sendCalls.push({ commandType, body });
      if (commandType === CommandType.RegistersAvailable) {
        return { type: "registers_available", requestId: 1, errorCode: 0, registers: registersAvailable, related: [] } as unknown as ResolvedResponse;
      }
      if (commandType === CommandType.RegistersGet) {
        const registers = nextFromQueue(registersGetReplies, "registersGetReplies");
        return { type: "registers", requestId: 1, errorCode: 0, registers, related: [] } as unknown as ResolvedResponse;
      }
      if (commandType === CommandType.CpuHistoryGet) {
        const reply = nextFromQueue(cpuHistoryReplies, "cpuHistoryReplies");
        return { type: "cpu_history", requestId: 1, errorCode: 0, count: reply.count, entries: reply.entries, related: [] } as unknown as ResolvedResponse;
      }
      if (commandType === CommandType.ResourceGet) {
        if (options.resourceGetRejectsWith !== undefined) {
          throw options.resourceGetRejectsWith;
        }
        const reply = nextFromQueue(resourceGetReplies, "resourceGetReplies");
        if (reply === "reject") {
          throw new Error("RESOURCE_GET failed (synthetic)");
        }
        return { type: "resource_get", requestId: 1, errorCode: 0, ...reply, related: [] } as unknown as ResolvedResponse;
      }
      throw new Error(`makeFakeSession: unexpected commandType 0x${commandType.toString(16)}`);
    },
  } as unknown as ViceMonitorClient;

  const session = {
    client: fakeClient,
    versionQuad: "3.10.0",
    capabilities: { cpuHistory: options.cpuHistory ?? "absent" },
    host: "127.0.0.1",
    port: 6502,
    targetId: options.targetId ?? "target-1",
    brokerControl: {} as unknown as StockConnectSession["brokerControl"],
    deps: {},
    baselineEpoch: options.baselineEpoch ?? null,
  } as unknown as StockConnectSession;

  return { session, sendCalls };
}

const FAKE_DEPS = {} as unknown as StockDispatchDeps;

function parseAnswer(result: { content: { type: "text"; text: string }[]; isError: boolean }): Record<string, unknown> {
  return JSON.parse(result.content[0]!.text) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// 07-REVIEW.md WR-14: both of this file's targetId-keyed caches survived a
// stockReconnect() and a vice_recycle respawn, because targetId does. Only
// Route A had a `delta < 0n` guard that caught a machine swap by accident;
// Route B subtracted two unrelated within-frame positions and answered
// `measurable: true`. Every case below reuses ONE targetId across two different
// epochs -- which is exactly what a recycle looks like from this file's side.
// ---------------------------------------------------------------------------

test("stopwatch (WR-14): a baseline recorded under one epoch is REFUSED against a sample under another, on Route A", async () => {
  const before = makeFakeSession({
    targetId: "target-recycled",
    baselineEpoch: 1,
    cpuHistory: "available",
    cpuHistoryReplies: [{ count: 1, entries: [historyEntry(1_000_000n)] }],
    registersGetReplies: [[{ id: 0, value: 0x100 }]],
  });
  await handleCyclesStopwatch({ action: "reset" }, before.session, FAKE_DEPS);

  // Same targetId, new epoch: the broker respawned the instance underneath us.
  // The cycle counter on a fresh machine can legitimately read HIGHER than the
  // old baseline, so `delta < 0n` does not catch this.
  const after = makeFakeSession({
    targetId: "target-recycled",
    baselineEpoch: 2,
    cpuHistory: "available",
    cpuHistoryReplies: [{ count: 1, entries: [historyEntry(9_000_000n)] }],
    registersGetReplies: [[{ id: 0, value: 0x105 }]],
  });
  const answer = parseAnswer(await handleCyclesStopwatch({ action: "read" }, after.session, FAKE_DEPS));
  assert.equal(answer.measurable, false, "a baseline from a different machine must never produce a figure");
  assert.equal(answer.cycles, undefined);
  assert.match(answer.reason as string, /epoch/);
  assert.match(answer.reason as string, /different machines/);
});

test("stopwatch (WR-14): the same refusal covers Route B, where nothing else would have caught it", async () => {
  const registers = [{ id: 0, value: 0x100 }, { id: 1, value: 100 }, { id: 2, value: 20 }];
  const withLinCyc = [...DEFAULT_REGISTERS, { id: 1, size: 16, name: "LIN" }, { id: 2, size: 8, name: "CYC" }];

  const before = makeFakeSession({
    targetId: "target-recycled-b",
    baselineEpoch: 1,
    cpuHistory: "absent",
    registersAvailable: withLinCyc,
    resourceGetReplies: [{ valueType: "integer", value: 1 }],
    registersGetReplies: [registers],
  });
  await handleCyclesStopwatch({ action: "reset" }, before.session, FAKE_DEPS);

  // A LATER within-frame position on a respawned machine: strictly greater than
  // the baseline, so Route B's own `after.position < before.position` check
  // passes and it answered `measurable: true` with a meaningless delta.
  const after = makeFakeSession({
    targetId: "target-recycled-b",
    baselineEpoch: 2,
    cpuHistory: "absent",
    registersAvailable: withLinCyc,
    resourceGetReplies: [{ valueType: "integer", value: 1 }],
    registersGetReplies: [[{ id: 0, value: 0x105 }, { id: 1, value: 200 }, { id: 2, value: 40 }]],
  });
  const answer = parseAnswer(await handleCyclesStopwatch({ action: "read" }, after.session, FAKE_DEPS));
  assert.equal(answer.measurable, false, "Route B had no guard of its own -- the epoch check is what makes this honest");
  assert.equal(answer.cycles, undefined);
  assert.match(answer.reason as string, /epoch/);
});

test("stopwatch (WR-14): a reconnect to the SAME machine (same epoch, new session object) still measures", async () => {
  const before = makeFakeSession({
    targetId: "target-same",
    baselineEpoch: 7,
    cpuHistory: "available",
    cpuHistoryReplies: [{ count: 1, entries: [historyEntry(1_000_000n)] }],
    registersGetReplies: [[{ id: 0, value: 0x100 }]],
  });
  await handleCyclesStopwatch({ action: "reset" }, before.session, FAKE_DEPS);

  const after = makeFakeSession({
    targetId: "target-same",
    baselineEpoch: 7,
    cpuHistory: "available",
    cpuHistoryReplies: [{ count: 1, entries: [historyEntry(1_002_500n)] }],
    registersGetReplies: [[{ id: 0, value: 0x105 }]],
  });
  const answer = parseAnswer(await handleCyclesStopwatch({ action: "read" }, after.session, FAKE_DEPS));
  assert.equal(answer.measurable, true, "the whole point of a strong Map is that a reconnect to the same machine keeps its baseline");
  assert.equal(answer.cycles, 2500);
});

test("resolveVideoStandard (WR-14): a cached value is NOT reused across an epoch change on the same targetId", async () => {
  const first = makeFakeSession({
    targetId: "target-vs",
    baselineEpoch: 1,
    resourceGetReplies: [{ valueType: "integer", value: 1 }], // PAL
  });
  const firstResult = await resolveVideoStandard(first.session);
  assert.equal(firstResult.name, VIDEO_STANDARDS[1]!.name);
  assert.equal(firstResult.assumed, false);
  assert.equal(first.sendCalls.filter((c) => c.commandType === CommandType.ResourceGet).length, 1);

  // Same targetId, same session shape, SAME epoch -> a real cache hit, no
  // second wire read. (Establishes the cache works at all, so the next
  // assertion cannot pass vacuously.)
  const cachedHit = makeFakeSession({ targetId: "target-vs", baselineEpoch: 1, resourceGetReplies: [{ valueType: "integer", value: 2 }] });
  assert.equal((await resolveVideoStandard(cachedHit.session)).name, VIDEO_STANDARDS[1]!.name);
  assert.equal(cachedHit.sendCalls.filter((c) => c.commandType === CommandType.ResourceGet).length, 0, "same epoch must be a cache hit");

  // New epoch on the SAME targetId -- a respawned instance, which can be a
  // different model entirely. The cache must MISS and re-read.
  const respawned = makeFakeSession({ targetId: "target-vs", baselineEpoch: 2, resourceGetReplies: [{ valueType: "integer", value: 2 }] }); // NTSC
  const respawnedResult = await resolveVideoStandard(respawned.session);
  assert.equal(respawned.sendCalls.filter((c) => c.commandType === CommandType.ResourceGet).length, 1, "a new epoch must force a fresh read");
  assert.equal(respawnedResult.name, VIDEO_STANDARDS[2]!.name, "the respawned machine's own value, not the previous instance's");
});

test("forgetTimingForOtherTargets (WR-14): evicts every OTHER target's baseline and video standard, and keeps the active one", async () => {
  const a = makeFakeSession({
    targetId: "target-a",
    baselineEpoch: 1,
    cpuHistory: "available",
    cpuHistoryReplies: [{ count: 1, entries: [historyEntry(1_000n)] }],
    registersGetReplies: [[{ id: 0, value: 0x100 }]],
  });
  const b = makeFakeSession({
    targetId: "target-b",
    baselineEpoch: 1,
    cpuHistory: "available",
    cpuHistoryReplies: [{ count: 1, entries: [historyEntry(5_000n)] }],
    registersGetReplies: [[{ id: 0, value: 0x100 }]],
  });
  await handleCyclesStopwatch({ action: "reset" }, a.session, FAKE_DEPS);
  await handleCyclesStopwatch({ action: "reset" }, b.session, FAKE_DEPS);

  forgetTimingForOtherTargets("target-b");

  // target-a's baseline is gone -- a torn-down instance can never be consulted.
  const aRead = makeFakeSession({
    targetId: "target-a",
    baselineEpoch: 1,
    cpuHistory: "available",
    cpuHistoryReplies: [{ count: 1, entries: [historyEntry(2_000n)] }],
    registersGetReplies: [[{ id: 0, value: 0x100 }]],
  });
  const aAnswer = parseAnswer(await handleCyclesStopwatch({ action: "read" }, aRead.session, FAKE_DEPS));
  assert.equal(aAnswer.measurable, false);
  assert.match(aAnswer.reason as string, /no baseline recorded/);

  // target-b's is intact.
  const bRead = makeFakeSession({
    targetId: "target-b",
    baselineEpoch: 1,
    cpuHistory: "available",
    cpuHistoryReplies: [{ count: 1, entries: [historyEntry(5_400n)] }],
    registersGetReplies: [[{ id: 0, value: 0x100 }]],
  });
  const bAnswer = parseAnswer(await handleCyclesStopwatch({ action: "read" }, bRead.session, FAKE_DEPS));
  assert.equal(bAnswer.measurable, true, "the ACTIVE target must keep its baseline");
  assert.equal(bAnswer.cycles, 400);
});

// ---------------------------------------------------------------------------
// 07-REVIEW.md WR-17: resolveVideoStandard()'s catch-all converted EVERYTHING,
// including typed transport failures, into a PAL result with assumed:true. It
// is the last wire call inside Route B's readCycleBaseline(), which
// runStockLivenessBracket() calls -- so a socket that died there could never be
// classified as 07-15's `connection_lost` or `request_timeout`
// diagnosis_unavailable reason class (both promised by the stock manifest AND
// the wedge-triage SKILL). The new classification is only ever as honest as the
// narrowest catch on the path, and this was it.
// ---------------------------------------------------------------------------

test("resolveVideoStandard (WR-17): a StockConnectionClosedError PROPAGATES -- it is not laundered into 'assuming PAL'", async () => {
  const err = new StockConnectionClosedError("socket closed", { port: 6502, abandoned: 1, trigger: "close" });
  const { session } = makeFakeSession({ resourceGetRejectsWith: err });
  await assert.rejects(resolveVideoStandard(session), (thrown: unknown) => thrown === err);
});

test("resolveVideoStandard (WR-17): a StockRequestTimeoutError PROPAGATES", async () => {
  const err = new StockRequestTimeoutError("RESOURCE_GET never answered", { requestId: 1, commandType: CommandType.ResourceGet, elapsedMs: 5000 });
  const { session } = makeFakeSession({ resourceGetRejectsWith: err });
  await assert.rejects(resolveVideoStandard(session), (thrown: unknown) => thrown === err);
});

test("resolveVideoStandard (WR-17): a MachineRestartedError PROPAGATES -- a restart is never a video standard", async () => {
  const err = new MachineRestartedError("the machine restarted", { baselineEpoch: 1, currentEpoch: 2 });
  const { session } = makeFakeSession({ resourceGetRejectsWith: err });
  await assert.rejects(resolveVideoStandard(session), (thrown: unknown) => thrown === err);
});

test("resolveVideoStandard (WR-17): a VALUE-shaped failure still falls back to PAL with assumed:true -- the narrowing must not remove the honest fallback", async () => {
  const { session } = makeFakeSession({ resourceGetRejectsWith: new Error("MachineVideoStandard: no such resource on this build") });
  const result = await resolveVideoStandard(session);
  assert.equal(result.assumed, true);
  assert.equal(result.name, VIDEO_STANDARDS[1]!.name, "the fallback is PAL");
  assert.match(result.reason as string, /assuming PAL/);
});

test("readCycleBaseline (WR-17): a transport failure inside Route B's video-standard read reaches the caller, so the diagnose classifier can name it", async () => {
  const err = new StockConnectionClosedError("socket closed mid-bracket", { port: 6502, abandoned: 1, trigger: "close" });
  const withLinCyc = [...DEFAULT_REGISTERS, { id: 1, size: 16, name: "LIN" }, { id: 2, size: 8, name: "CYC" }];
  const { session } = makeFakeSession({
    cpuHistory: "absent",
    registersAvailable: withLinCyc,
    registersGetReplies: [[{ id: 0, value: 0x100 }, { id: 1, value: 100 }, { id: 2, value: 20 }]],
    resourceGetRejectsWith: err,
  });
  await assert.rejects(
    readCycleBaseline(session),
    (thrown: unknown) => thrown === err,
    "Route B's last wire call must not swallow a dead socket -- classifyDiagnoseUnavailable() maps this to connection_lost",
  );
});

test("handleDiagnoseStock-side effect of WR-17: classifyDiagnoseUnavailable maps the errors resolveVideoStandard now rethrows", () => {
  // The point of rethrowing is that the classifier can see them. Asserted here
  // rather than only in stock-diagnose.test.ts so the two halves of the fix are
  // visibly connected.
  assert.equal(
    classifyDiagnoseUnavailable(new StockConnectionClosedError("closed", { port: 1, abandoned: 0, trigger: "close" })),
    "connection_lost",
  );
  assert.equal(
    classifyDiagnoseUnavailable(new StockRequestTimeoutError("timed out", { requestId: 1, commandType: CommandType.ResourceGet, elapsedMs: 1 })),
    "request_timeout",
  );
});

// ---------------------------------------------------------------------------
// Task 1: VIDEO_STANDARDS / positionWithinFrame / resolveVideoStandard
// ---------------------------------------------------------------------------

test("VIDEO_STANDARDS: all four source-verified standards", () => {
  assert.equal(VIDEO_STANDARDS[1]!.cyclesPerLine, 63);
  assert.equal(VIDEO_STANDARDS[1]!.screenLines, 312);
  assert.equal(VIDEO_STANDARDS[2]!.cyclesPerLine, 65);
  assert.equal(VIDEO_STANDARDS[2]!.screenLines, 263);
  assert.equal(VIDEO_STANDARDS[3]!.cyclesPerLine, 64);
  assert.equal(VIDEO_STANDARDS[3]!.screenLines, 262);
  assert.equal(VIDEO_STANDARDS[4]!.cyclesPerLine, 65);
  assert.equal(VIDEO_STANDARDS[4]!.screenLines, 312);
});

test("positionWithinFrame: lin * cyclesPerLine + cyc", () => {
  assert.equal(positionWithinFrame(10, 5, 63), 635);
  assert.equal(positionWithinFrame(0, 0, 65), 0);
});

test("resolveVideoStandard: a rejecting send yields a PAL result with assumed:true, never throws", async () => {
  const { session } = makeFakeSession({ resourceGetReplies: ["reject"] });
  const result = await resolveVideoStandard(session);
  assert.equal(result.assumed, true);
  assert.equal(result.value, 1);
  assert.equal(result.cyclesPerLine, 63);
  assert.equal(result.screenLines, 312);
  assert.equal(typeof result.reason, "string");
});

test("resolveVideoStandard: an unrecognized integer value also falls back to PAL, assumed:true", async () => {
  const { session } = makeFakeSession({ resourceGetReplies: [{ valueType: "integer", value: 99 }] });
  const result = await resolveVideoStandard(session);
  assert.equal(result.assumed, true);
  assert.equal(result.value, 1);
});

test("resolveVideoStandard: cache behaviour -- two reads on the SAME targetId issue exactly one RESOURCE_GET; a different targetId issues a second", async () => {
  const { session, sendCalls } = makeFakeSession({ targetId: "target-A", resourceGetReplies: [{ valueType: "integer", value: 1 }] });
  await resolveVideoStandard(session);
  await resolveVideoStandard(session);
  const resourceGetCalls = () => sendCalls.filter((c) => c.commandType === CommandType.ResourceGet).length;
  assert.equal(resourceGetCalls(), 1, "the SAME session must fetch the resource exactly once");

  const { session: session2 } = makeFakeSession({ targetId: "target-B", resourceGetReplies: [{ valueType: "integer", value: 1 }] });
  await resolveVideoStandard(session2);
  // session2 is a DIFFERENT targetId -- it must hit the wire itself, on its
  // own sendCalls array, not session's.
  assert.equal(resourceGetCalls(), 1, "a different targetId's fetch must not be recorded against the first session's call count");
});

// ---------------------------------------------------------------------------
// Task 1: readCycleBaseline() route selection
// ---------------------------------------------------------------------------

test("readCycleBaseline: capabilities.cpuHistory available drives CPUHISTORY_GET, never RESOURCE_GET", async () => {
  const { session, sendCalls } = makeFakeSession({
    cpuHistory: "available",
    cpuHistoryReplies: [{ count: 1, entries: [historyEntry(1000n)] }],
    registersGetReplies: [[{ id: 0, value: 0xc000 }]],
  });
  const baseline = await readCycleBaseline(session);
  assert.equal(baseline.route, "cpu_history");
  assert.ok(sendCalls.some((c) => c.commandType === CommandType.CpuHistoryGet));
  assert.ok(!sendCalls.some((c) => c.commandType === CommandType.ResourceGet));
});

for (const capability of ["absent", "not_compiled_in"] as const) {
  test(`readCycleBaseline: capabilities.cpuHistory "${capability}" drives the REGISTERS_GET route`, async () => {
    const { session, sendCalls } = makeFakeSession({
      cpuHistory: capability,
      resourceGetReplies: [{ valueType: "integer", value: 1 }],
      registersGetReplies: [[{ id: 0, value: 0xc000 }, { id: 1, value: 100 }, { id: 2, value: 20 }]],
    });
    const baseline = await readCycleBaseline(session);
    assert.equal(baseline.route, "frame_position");
    assert.ok(sendCalls.some((c) => c.commandType === CommandType.RegistersGet));
  });
}

// 07-REVIEW.md WR-07: entries[] arrives OLDEST-first (proven by 07-12 against
// fixtures/binmon/cpuhistory-get-multi.bin). Route A read entries[0] and named
// it `newest` -- correct only while count === 1, and nothing enforces that
// coupling, so a build returning a full window would have made the stopwatch
// sample a STALE baseline and report it with exactness:"exact".
test("readCycleBaseline (WR-07): a multi-entry reply samples the LAST entry (the newest), never entries[0]", async () => {
  const { session } = makeFakeSession({
    cpuHistory: "available",
    cpuHistoryReplies: [
      {
        count: 4,
        // Strictly ascending, mirroring the real capture's own ordering.
        entries: [historyEntry(0x04616d0bn), historyEntry(0x04616d0fn), historyEntry(0x04616d12n), historyEntry(0x04616d15n)],
      },
    ],
    registersGetReplies: [[{ id: 0, value: 0xc000 }]],
  });
  const baseline = await readCycleBaseline(session);
  assert.equal(baseline.route, "cpu_history");
  assert.equal(
    (baseline as { cycle: bigint }).cycle,
    0x04616d15n,
    "the HIGHEST (last) cycle is the newest -- sampling entries[0] would report a stale baseline as exact",
  );
});

test("Route A (WR-07): a two-entry reply makes the stopwatch measure from the newest sample, so the delta uses the higher cycle", async () => {
  const { session } = makeFakeSession({
    cpuHistory: "available",
    cpuHistoryReplies: [
      { count: 2, entries: [historyEntry(1_000_000n), historyEntry(1_000_100n)] }, // reset -> baseline 1_000_100
      { count: 2, entries: [historyEntry(1_002_000n), historyEntry(1_002_600n)] }, // read  -> sample   1_002_600
    ],
    registersGetReplies: [[{ id: 0, value: 0x100 }], [{ id: 0, value: 0x105 }]],
  });

  await handleCyclesStopwatch({ action: "reset" }, session, FAKE_DEPS);
  const readResult = await handleCyclesStopwatch({ action: "read" }, session, FAKE_DEPS);
  assert.equal(readResult.isError, false);
  const answer = parseAnswer(readResult);
  assert.equal(answer.measurable, true);
  // newest-to-newest: 1_002_600 - 1_000_100 = 2500. Reading entries[0] on both
  // sides would give 2000; mixing the two would give 1600 or 2600.
  assert.equal(answer.cycles, 2500);
  assert.equal(answer.cyclesExact, "2500");
});

// ---------------------------------------------------------------------------
// Task 2: Route A decode / backwards clock
// ---------------------------------------------------------------------------

test("Route A decode: reset then read 12345 cycles later yields cycles===12345 and cyclesExact==='12345'", async () => {
  const { session } = makeFakeSession({
    cpuHistory: "available",
    cpuHistoryReplies: [{ count: 1, entries: [historyEntry(1_000_000n)] }, { count: 1, entries: [historyEntry(1_012_345n)] }],
    registersGetReplies: [[{ id: 0, value: 0x100 }], [{ id: 0, value: 0x105 }]],
  });

  const resetResult = await handleCyclesStopwatch({ action: "reset" }, session, FAKE_DEPS);
  assert.equal(resetResult.isError, false);
  const readResult = await handleCyclesStopwatch({ action: "read" }, session, FAKE_DEPS);
  assert.equal(readResult.isError, false);
  const answer = parseAnswer(readResult);
  assert.equal(answer.measurable, true);
  assert.equal(answer.cycles, 12345);
  assert.equal(answer.cyclesExact, "12345");
  assert.equal(answer.route, "cpu_history");
  assert.equal(answer.exactness, "exact");
});

// 07-REVIEW.md WR-13: `cycles` is a JS number, but a uint64 clock delta does
// not always fit one. Above Number.MAX_SAFE_INTEGER, Number(delta) silently
// rounds -- and the answer still said exactness:"exact", while
// ParsedCpuHistoryEntry's own doc comment says the cycle is "never narrowed to
// Number, since ... the stopwatch's whole value is exactness".
test("Route A (WR-13): a delta above Number.MAX_SAFE_INTEGER is labelled exact-but-narrowed, with cyclesExact carrying the true value", async () => {
  const baseCycle = 1n;
  const hugeCycle = BigInt(Number.MAX_SAFE_INTEGER) + 1000n; // delta = MAX_SAFE_INTEGER + 999
  const { session } = makeFakeSession({
    cpuHistory: "available",
    cpuHistoryReplies: [{ count: 1, entries: [historyEntry(baseCycle)] }, { count: 1, entries: [historyEntry(hugeCycle)] }],
    registersGetReplies: [[{ id: 0, value: 0x100 }], [{ id: 0, value: 0x105 }]],
  });

  await handleCyclesStopwatch({ action: "reset" }, session, FAKE_DEPS);
  const readResult = await handleCyclesStopwatch({ action: "read" }, session, FAKE_DEPS);
  assert.equal(readResult.isError, false);
  const answer = parseAnswer(readResult);
  assert.equal(answer.measurable, true);
  assert.equal(answer.exactness, "exact-but-narrowed", "a rounded figure must never be labelled exact");
  assert.equal(answer.cyclesExact, (hugeCycle - baseCycle).toString(), "cyclesExact is the authoritative, unrounded value");
  assert.match(answer.caveat as string, /MAX_SAFE_INTEGER/);
  assert.match(answer.caveat as string, /cyclesExact/);
});

test("Route A (WR-13): a delta exactly AT Number.MAX_SAFE_INTEGER is still exact -- the boundary is inclusive, not off by one", async () => {
  const { session } = makeFakeSession({
    cpuHistory: "available",
    cpuHistoryReplies: [
      { count: 1, entries: [historyEntry(0n)] },
      { count: 1, entries: [historyEntry(BigInt(Number.MAX_SAFE_INTEGER))] },
    ],
    registersGetReplies: [[{ id: 0, value: 0x100 }], [{ id: 0, value: 0x105 }]],
  });

  await handleCyclesStopwatch({ action: "reset" }, session, FAKE_DEPS);
  const answer = parseAnswer(await handleCyclesStopwatch({ action: "read" }, session, FAKE_DEPS));
  assert.equal(answer.exactness, "exact");
  assert.equal(answer.cycles, Number.MAX_SAFE_INTEGER);
  assert.equal(answer.caveat, undefined, "no caveat when the narrowing is lossless");
});

test("Route A (WR-13): an ordinary small delta is unchanged -- exact, no caveat", async () => {
  const { session } = makeFakeSession({
    cpuHistory: "available",
    cpuHistoryReplies: [{ count: 1, entries: [historyEntry(1_000_000n)] }, { count: 1, entries: [historyEntry(1_012_345n)] }],
    registersGetReplies: [[{ id: 0, value: 0x100 }], [{ id: 0, value: 0x105 }]],
  });
  await handleCyclesStopwatch({ action: "reset" }, session, FAKE_DEPS);
  const answer = parseAnswer(await handleCyclesStopwatch({ action: "read" }, session, FAKE_DEPS));
  assert.equal(answer.exactness, "exact");
  assert.equal(answer.cycles, 12345);
  assert.equal(answer.cyclesExact, "12345");
  assert.equal(answer.caveat, undefined);
});

test("Route A backwards clock: a lower second sample yields measurable:false, no cycles key", async () => {
  const { session } = makeFakeSession({
    cpuHistory: "available",
    cpuHistoryReplies: [{ count: 1, entries: [historyEntry(2000n)] }, { count: 1, entries: [historyEntry(1000n)] }],
    registersGetReplies: [[{ id: 0, value: 0x100 }], [{ id: 0, value: 0x100 }]],
  });

  await handleCyclesStopwatch({ action: "reset" }, session, FAKE_DEPS);
  const readResult = await handleCyclesStopwatch({ action: "read" }, session, FAKE_DEPS);
  const answer = parseAnswer(readResult);
  assert.equal(answer.measurable, false);
  assert.equal("cycles" in answer, false);
  assert.equal(typeof answer.reason, "string");
});

// ---------------------------------------------------------------------------
// Task 2: Route B arithmetic, all four video standards (table-driven)
// ---------------------------------------------------------------------------

const ROUTE_B_STANDARD_TABLE = [1, 2, 3, 4] as const;

for (const standardValue of ROUTE_B_STANDARD_TABLE) {
  test(`Route B arithmetic: MachineVideoStandard=${standardValue} (${VIDEO_STANDARDS[standardValue]!.name})`, async () => {
    const cyclesPerLine = VIDEO_STANDARDS[standardValue]!.cyclesPerLine;
    const { session } = makeFakeSession({
      cpuHistory: "absent",
      resourceGetReplies: [{ valueType: "integer", value: standardValue }],
      registersGetReplies: [
        [{ id: 0, value: 0xc000 }, { id: 1, value: 10 }, { id: 2, value: 5 }],
        [{ id: 0, value: 0xc010 }, { id: 1, value: 12 }, { id: 2, value: 8 }],
      ],
    });

    await handleCyclesStopwatch({ action: "reset" }, session, FAKE_DEPS);
    const readResult = await handleCyclesStopwatch({ action: "read" }, session, FAKE_DEPS);
    const answer = parseAnswer(readResult);

    const before = positionWithinFrame(10, 5, cyclesPerLine);
    const after = positionWithinFrame(12, 8, cyclesPerLine);
    assert.equal(answer.measurable, true);
    assert.equal(answer.cycles, after - before);
    assert.equal(answer.exactness, "within-one-frame-unverified");
    assert.equal(typeof answer.caveat, "string");
    assert.ok((answer.caveat as string).length > 0);
    assert.equal(answer.standard, VIDEO_STANDARDS[standardValue]!.name);
  });
}

// ---------------------------------------------------------------------------
// Task 2: Route B wraparound refusal (TIME-03)
// ---------------------------------------------------------------------------

test("Route B wraparound refusal: positionAfter < positionBefore yields measurable:false, no cycles key, reason names CPUHISTORY_GET", async () => {
  const { session } = makeFakeSession({
    cpuHistory: "absent",
    resourceGetReplies: [{ valueType: "integer", value: 1 }], // PAL
    registersGetReplies: [
      [{ id: 0, value: 0xc000 }, { id: 1, value: 300 }, { id: 2, value: 62 }], // near end of frame
      [{ id: 0, value: 0xc000 }, { id: 1, value: 1 }, { id: 2, value: 0 }], // wrapped to a new frame
    ],
  });

  await handleCyclesStopwatch({ action: "reset" }, session, FAKE_DEPS);
  const readResult = await handleCyclesStopwatch({ action: "read" }, session, FAKE_DEPS);
  const answer = parseAnswer(readResult);

  assert.equal(answer.measurable, false);
  assert.equal("cycles" in answer, false);
  assert.notEqual(answer.cycles, 0);
  assert.equal(typeof answer.reason, "string");
  assert.ok((answer.reason as string).includes("CPUHISTORY_GET"));
  assert.ok(!(answer.reason as string).toLowerCase().includes("approximately"));
  assert.ok(!(answer.reason as string).toLowerCase().includes("estimated"));
});

// ---------------------------------------------------------------------------
// Task 2: no stored baseline
// ---------------------------------------------------------------------------

test("no baseline: read before any reset yields measurable:false and no cycles key", async () => {
  const { session } = makeFakeSession({
    cpuHistory: "available",
    cpuHistoryReplies: [{ count: 1, entries: [historyEntry(500n)] }],
    registersGetReplies: [[{ id: 0, value: 0x100 }]],
  });

  const readResult = await handleCyclesStopwatch({ action: "read" }, session, FAKE_DEPS);
  const answer = parseAnswer(readResult);
  assert.equal(answer.measurable, false);
  assert.equal("cycles" in answer, false);
  assert.ok((answer.reason as string).toLowerCase().includes("reset"));
});

// ---------------------------------------------------------------------------
// Task 2: missing LIN/CYC
// ---------------------------------------------------------------------------

test("missing LIN/CYC: readCycleBaseline() returns route:unavailable, and the handler answers measurable:false", async () => {
  const { session } = makeFakeSession({
    cpuHistory: "absent",
    registersAvailable: NO_LIN_CYC_REGISTERS,
  });

  const baseline = await readCycleBaseline(session);
  assert.equal(baseline.route, "unavailable");

  const resetResult = await handleCyclesStopwatch({ action: "reset" }, session, FAKE_DEPS);
  assert.equal(parseAnswer(resetResult).route, "unavailable");
  const readResult = await handleCyclesStopwatch({ action: "read" }, session, FAKE_DEPS);
  const answer = parseAnswer(readResult);
  assert.equal(answer.measurable, false);
  assert.equal("cycles" in answer, false);
});

// ---------------------------------------------------------------------------
// Task 2: route mismatch (a reconnect that changed capabilities)
// ---------------------------------------------------------------------------

test("route mismatch: a baseline taken on one route and a sample on another answers measurable:false, no cycles key", async () => {
  const { session } = makeFakeSession({
    cpuHistory: "available",
    cpuHistoryReplies: [{ count: 1, entries: [historyEntry(1000n)] }],
    registersGetReplies: [[{ id: 0, value: 0x100 }], [{ id: 0, value: 0x100 }, { id: 1, value: 10 }, { id: 2, value: 5 }]],
    resourceGetReplies: [{ valueType: "integer", value: 1 }],
  });

  await handleCyclesStopwatch({ action: "reset" }, session, FAKE_DEPS);
  // Simulate a reconnect that changed this build's cpu-history capability --
  // same session object (same targetId), different route from here on.
  (session as unknown as { capabilities: { cpuHistory: string } }).capabilities.cpuHistory = "absent";

  const readResult = await handleCyclesStopwatch({ action: "read" }, session, FAKE_DEPS);
  const answer = parseAnswer(readResult);
  assert.equal(answer.measurable, false);
  assert.equal("cycles" in answer, false);
  assert.ok((answer.reason as string).includes("cpu_history"));
  assert.ok((answer.reason as string).includes("frame_position"));
});

// ---------------------------------------------------------------------------
// Task 2: reset_and_read stores a new baseline on every path
// ---------------------------------------------------------------------------

test("reset_and_read: stores the new sample as the next baseline even on an unmeasurable path", async () => {
  const { session } = makeFakeSession({
    cpuHistory: "available",
    cpuHistoryReplies: [
      { count: 1, entries: [historyEntry(2000n)] }, // reset
      { count: 1, entries: [historyEntry(1000n)] }, // reset_and_read: backwards -> unmeasurable
      { count: 1, entries: [historyEntry(1500n)] }, // final read against the stored 1000n baseline
    ],
    registersGetReplies: [[{ id: 0, value: 0x100 }], [{ id: 0, value: 0x100 }], [{ id: 0, value: 0x100 }]],
  });

  await handleCyclesStopwatch({ action: "reset" }, session, FAKE_DEPS);
  const middle = parseAnswer(await handleCyclesStopwatch({ action: "reset_and_read" }, session, FAKE_DEPS));
  assert.equal(middle.measurable, false); // 1000n < 2000n -- backwards clock

  const final = parseAnswer(await handleCyclesStopwatch({ action: "read" }, session, FAKE_DEPS));
  assert.equal(final.measurable, true);
  assert.equal(final.cycles, 500); // 1500n - 1000n, the reset_and_read's own sample, not the original 2000n
});

// ---------------------------------------------------------------------------
// Task 2: argument validation
// ---------------------------------------------------------------------------

test("argument validation: missing action is refused naming the valid values", async () => {
  const { session } = makeFakeSession({ cpuHistory: "available", cpuHistoryReplies: [{ count: 1, entries: [historyEntry(1n)] }], registersGetReplies: [[{ id: 0, value: 0 }]] });
  const result = await handleCyclesStopwatch({}, session, FAKE_DEPS);
  assert.equal(result.isError, true);
  const text = result.content[0]!.text;
  assert.ok(text.includes("reset"));
  assert.ok(text.includes("read"));
  assert.ok(text.includes("reset_and_read"));
});

test("argument validation: an unknown action is refused naming the valid values", async () => {
  const { session } = makeFakeSession({ cpuHistory: "available", cpuHistoryReplies: [{ count: 1, entries: [historyEntry(1n)] }], registersGetReplies: [[{ id: 0, value: 0 }]] });
  const result = await handleCyclesStopwatch({ action: "rewind" }, session, FAKE_DEPS);
  assert.equal(result.isError, true);
  assert.ok(result.content[0]!.text.includes("rewind"));
});

test("argument validation: an unexpected extra key is refused by name", async () => {
  const { session } = makeFakeSession({ cpuHistory: "available", cpuHistoryReplies: [{ count: 1, entries: [historyEntry(1n)] }], registersGetReplies: [[{ id: 0, value: 0 }]] });
  const result = await handleCyclesStopwatch({ action: "reset", bogus: true }, session, FAKE_DEPS);
  assert.equal(result.isError, true);
  assert.ok(result.content[0]!.text.includes("bogus"));
});
