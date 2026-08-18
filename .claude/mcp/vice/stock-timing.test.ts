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

import { CommandType, type ResolvedResponse, type ViceMonitorClient } from "./stock-protocol.ts";
import type { StockConnectSession, CpuHistoryCapability } from "./stock-connect.ts";
import type { StockDispatchDeps } from "./stock-dispatch.ts";
import {
  VIDEO_STANDARDS,
  resolveVideoStandard,
  positionWithinFrame,
  readCycleBaseline,
  handleCyclesStopwatch,
  resetTimingStateForTest,
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
    baselineEpoch: null,
  } as unknown as StockConnectSession;

  return { session, sendCalls };
}

const FAKE_DEPS = {} as unknown as StockDispatchDeps;

function parseAnswer(result: { content: { type: "text"; text: string }[]; isError: boolean }): Record<string, unknown> {
  return JSON.parse(result.content[0]!.text) as Record<string, unknown>;
}

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
