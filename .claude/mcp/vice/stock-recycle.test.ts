// node:test coverage of stock-recycle.ts. Every "client" below is a
// send-only stub object with a real EventEmitter base (matching this module
// tree's own DI-stubbing convention -- stock-diagnose.test.ts,
// stock-checkpoints.test.ts, stock-dispatch.test.ts:1-133) -- never a real
// socket, never a real broker. Every test that writes an incident record
// redirects incidentsDir() to a disposable temp directory via
// VICE_INCIDENTS_DIR (incident-record.test.ts's own established discipline),
// so nothing here ever touches the real, permanent .planning/incidents/.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { CommandType, type ResolvedResponse, type ViceMonitorClient } from "./stock-protocol.ts";
import type { StockConnectSession, CpuHistoryCapability } from "./stock-connect.ts";
import type { StockDispatchDeps } from "./stock-dispatch.ts";
import type { HeldLease, ControlRecycleResult } from "./vice-broker-client.ts";
import { resetTimingStateForTest } from "./stock-timing.ts";
import { resetRegisterCatalogsForTest } from "./stock-registers.ts";
import { resetCheckpointStateForTest } from "./stock-checkpoints.ts";
import { incidentsDir } from "./incident-record.ts";
import { handleRecycleStock, gatherStockWedgeEvidence, stockCaptureStepTimeoutMs } from "./stock-recycle.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// VICE_INCIDENTS_DIR discipline (incident-record.test.ts's own idiom).
// ---------------------------------------------------------------------------

function withTempIncidentsDir<T>(fn: (dir: string) => T | Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "vice-recycle-test-"));
  const prev = process.env.VICE_INCIDENTS_DIR;
  process.env.VICE_INCIDENTS_DIR = dir;
  return Promise.resolve()
    .then(() => fn(dir))
    .finally(() => {
      if (prev === undefined) delete process.env.VICE_INCIDENTS_DIR;
      else process.env.VICE_INCIDENTS_DIR = prev;
      rmSync(dir, { recursive: true, force: true });
    });
}

function recordFiles(dir: string): string[] {
  return readdirSync(dir).filter((f) => f.endsWith(".md"));
}

function readRecord(dir: string): string {
  const files = recordFiles(dir);
  assert.equal(files.length, 1, `expected exactly one incident record, found: ${files.join(", ")}`);
  return readFileSync(join(dir, files[0]!), "utf8");
}

beforeEach(() => {
  resetTimingStateForTest();
  resetRegisterCatalogsForTest();
  resetCheckpointStateForTest();
});

// ---------------------------------------------------------------------------
// DI-stub harness -- fake session (stock-diagnose.test.ts's own harness
// shape, extended with an address-indexed MemoryGet responder so
// resolveStockLiveIrqHandler() can be exercised twice per gather -- once
// inside gatherStockCheckpointTrapEvidence(), once standalone for the
// irqHandler item -- without a one-shot queue going stale on the second
// call).
// ---------------------------------------------------------------------------

const DEFAULT_REGISTERS = [{ id: 0, size: 16, name: "PC" }];
const EXEC_OP = 0x04; // CheckpointOperation.Exec (stock-protocol.ts)

interface SendCall {
  commandType: number;
  body: Buffer;
}

interface CheckpointFixture {
  id: number;
  start: number;
  end?: number;
  stop: boolean;
  enabled: boolean;
  operation: number;
  hitCount: number;
}

function checkpointRelated(cp: CheckpointFixture) {
  return {
    type: "checkpoint_info" as const,
    requestId: 1,
    errorCode: 0,
    checkpoint: {
      id: cp.id,
      currentlyHit: false,
      start: cp.start,
      end: cp.end ?? cp.start,
      stopWhenHit: cp.stop,
      enabled: cp.enabled,
      operation: cp.operation,
      temporary: false,
      hitCount: cp.hitCount,
      ignoreCount: 0,
      hasCondition: false,
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
  /** When true, EVERY send() rejects -- the "wedged machine, every read
   * fails" fixture (must_have 4 / task 1's own degraded-evidence case). */
  alwaysReject?: boolean;
  /** address -> byte array, for MemoryGet ($01, $0314/5, $FFFE/F). */
  memory?: Record<number, number[]>;
  registersAvailable?: typeof DEFAULT_REGISTERS;
  registersGetValues?: { id: number; value: number }[];
  checkpoints?: CheckpointFixture[];
  checkpointListFails?: boolean;
  /** CPUHISTORY_GET's newest cycle, consumed once per readCycleBaseline()
   * call (nextFromQueue's own "length 1 never shifts" convention -- a
   * single-element queue answers every subsequent call with the same
   * value, exactly what a "no advance" bracket needs). */
  cpuHistoryValues?: bigint[];
  /** CPUHISTORY_GET never resolves -- the capture-step deadline fixture. */
  neverResolveCpuHistory?: boolean;
}

interface FakeSession {
  session: StockConnectSession;
  sendCalls: SendCall[];
  disconnectCallCount: () => number;
}

function makeFakeSession(opts: FakeSessionOptions = {}): FakeSession {
  const sendCalls: SendCall[] = [];
  const memory = opts.memory ?? { 0x01: [0x37], 0x0314: [0x00, 0xc1] };
  const registersAvailable = opts.registersAvailable ?? DEFAULT_REGISTERS;
  const registersGetValues = opts.registersGetValues ?? [{ id: 0, value: 0xc000 }];
  const checkpoints = opts.checkpoints ?? [];
  const cpuHistoryValues = [...(opts.cpuHistoryValues ?? [1000n])];
  let disconnectCalls = 0;

  const emitter = new EventEmitter();
  const fakeClient = Object.assign(emitter, {
    connected: true,
    disconnect: async (): Promise<void> => {
      disconnectCalls += 1;
      (fakeClient as unknown as { connected: boolean }).connected = false;
    },
    send: async (commandType: number, body: Buffer = Buffer.alloc(0)): Promise<ResolvedResponse> => {
      sendCalls.push({ commandType, body });
      if (opts.alwaysReject) {
        throw new Error(`synthetic rejection for commandType 0x${commandType.toString(16)}`);
      }
      if (commandType === CommandType.MemoryGet) {
        const start = body.readUInt16LE(1);
        const bytes = memory[start];
        if (!bytes) {
          throw new Error(`makeFakeSession: unexpected MemoryGet address 0x${start.toString(16)}`);
        }
        return { type: "memory_get", requestId: 1, errorCode: 0, bytes: new Uint8Array(bytes) } as unknown as ResolvedResponse;
      }
      if (commandType === CommandType.RegistersAvailable) {
        return { type: "registers_available", requestId: 1, errorCode: 0, registers: registersAvailable, related: [] } as unknown as ResolvedResponse;
      }
      if (commandType === CommandType.RegistersGet) {
        return { type: "registers", requestId: 1, errorCode: 0, registers: registersGetValues, related: [] } as unknown as ResolvedResponse;
      }
      if (commandType === CommandType.CheckpointList) {
        if (opts.checkpointListFails) {
          throw new Error("CHECKPOINT_LIST failed (synthetic)");
        }
        return {
          type: "checkpoint_list",
          requestId: 1,
          errorCode: 0,
          total: checkpoints.length,
          checkpoints: [],
          related: checkpoints.map(checkpointRelated),
        } as unknown as ResolvedResponse;
      }
      if (commandType === CommandType.CpuHistoryGet) {
        if (opts.neverResolveCpuHistory) {
          return new Promise<ResolvedResponse>(() => {
            // Deliberately never settles -- the capture-step deadline fixture.
          });
        }
        const cycle = nextFromQueue(cpuHistoryValues, "cpuHistoryValues");
        return {
          type: "cpu_history",
          requestId: 1,
          errorCode: 0,
          count: 1,
          entries: [{ cycle, opcode: 0, instructionLength: 0, p1: 0, p2: 0 }],
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
    capabilities: { cpuHistory: opts.cpuHistory ?? "available" },
    host: "127.0.0.1",
    port: 6502,
    targetId: opts.targetId ?? "target-1",
    brokerControl: { claimMonitor: async () => ({ ok: true as const }), releaseMonitor: async () => ({ ok: true as const }) } as unknown as StockConnectSession["brokerControl"],
    deps: {},
    baselineEpoch: null,
  };

  return { session, sendCalls, disconnectCallCount: () => disconnectCalls };
}

const FAKE_DEPS_NO_LEASE = {
  ensureLease: async () => {
    throw new Error("ensureLease must not be called on this path");
  },
} as unknown as StockDispatchDeps;

/** Builds a HeldLease plus a StockDispatchDeps wired to hand it back,
 * matching stock-dispatch.test.ts's own makeLease() precedent (both
 * directory fields default to "" -- irrelevant to this handler, which never
 * reads them). `recycleImpl` is the recycle RPC stub itself -- the ONE
 * place each test controls the broker's own outcome. */
function makeLeaseDeps(opts: {
  port?: number;
  targetId?: string;
  epochFile?: string;
  recycleImpl: (targetId: string) => Promise<ControlRecycleResult>;
}): { deps: StockDispatchDeps; recycleCallCount: () => number } {
  let recycleCalls = 0;
  const lease: HeldLease = {
    host: "127.0.0.1",
    port: opts.port ?? 6502,
    targetId: opts.targetId ?? "grant-1",
    epochFile: opts.epochFile ?? "",
    supervisorDir: "",
    brokerControl: {
      acquire: async () => {
        throw new Error("acquire must not be called by handleRecycleStock");
      },
      release: async () => ({ ok: true }),
      recycle: async (targetId: string) => {
        recycleCalls += 1;
        return opts.recycleImpl(targetId);
      },
      status: async () => {
        throw new Error("status must not be called by handleRecycleStock");
      },
      hostState: async () => {
        throw new Error("hostState must not be called by handleRecycleStock");
      },
      claimMonitor: async () => ({ ok: true }),
      releaseMonitor: async () => ({ ok: true }),
    },
  };
  const deps: StockDispatchDeps = { ensureLease: async () => ({ ok: true, lease }) };
  return { deps, recycleCallCount: () => recycleCalls };
}

function okAck(overrides: Partial<{ outcome: string; kill_stage: string; reason: string }> = {}): ControlRecycleResult {
  return { ok: true, ack: { outcome: "ok", kill_stage: "sigterm", reason: "", ...overrides } };
}

function outcomeFrontmatter(recordText: string): string | null {
  const m = recordText.match(/^outcome: '?([^'\n]*)'?$/m);
  return m ? m[1]!.replace(/^'|'$/g, "") : null;
}

// ---------------------------------------------------------------------------
// Task 1: gatherStockWedgeEvidence() -- four items, never-throw, deadline-bounded.
// ---------------------------------------------------------------------------

test("gatherStockWedgeEvidence: a healthy session produces all four items available, no screenshot/snapshot keys", async () => {
  const { session } = makeFakeSession({
    checkpoints: [{ id: 3, start: 0xc100, stop: true, enabled: true, operation: EXEC_OP, hitCount: 5 }],
  });
  const evidence = await gatherStockWedgeEvidence(session, {} as unknown as StockDispatchDeps);

  assert.ok(evidence.bracket);
  assert.ok(evidence.registers);
  assert.ok(evidence.checkpoints);
  assert.ok(evidence.irqHandler);
  assert.equal("screenshot" in evidence, false);
  assert.equal("snapshot" in evidence, false);
  assert.equal(evidence.screenshot, undefined);
  assert.equal(evidence.snapshot, undefined);

  assert.equal(evidence.bracket!.available, true);
  assert.equal(evidence.registers!.available, true);
  assert.equal(evidence.checkpoints!.available, true);
  assert.equal(evidence.irqHandler!.available, true);
});

test("gatherStockWedgeEvidence: a session whose every send() rejects still resolves with all four items unavailable and a non-empty reason each", async () => {
  const { session } = makeFakeSession({ alwaysReject: true });
  const evidence = await gatherStockWedgeEvidence(session, {} as unknown as StockDispatchDeps);

  for (const key of ["bracket", "registers", "checkpoints", "irqHandler"] as const) {
    const item = evidence[key];
    assert.ok(item, `expected ${key} to be present`);
    assert.equal(item!.available, false, `expected ${key} to be unavailable`);
    assert.ok(item!.reason && item!.reason.length > 0, `expected ${key} to carry a non-empty reason`);
  }
  assert.equal(evidence.screenshot, undefined);
  assert.equal(evidence.snapshot, undefined);
});

test("gatherStockWedgeEvidence: a checkpoint_list refusal is reported as checkpoints unavailable, not an empty-but-available list", async () => {
  const { session } = makeFakeSession({ checkpointListFails: true });
  const evidence = await gatherStockWedgeEvidence(session, {} as unknown as StockDispatchDeps);
  assert.equal(evidence.checkpoints!.available, false);
  assert.match(evidence.checkpoints!.reason!, /CHECKPOINT_LIST failed/);
  // The other three items are unaffected by a checkpoint-list-only failure.
  assert.equal(evidence.registers!.available, true);
  assert.equal(evidence.irqHandler!.available, true);
});

test("stockCaptureStepTimeoutMs(): defaults to 8000 and reads VICE_RECYCLE_CAPTURE_TIMEOUT_MS", () => {
  const prev = process.env.VICE_RECYCLE_CAPTURE_TIMEOUT_MS;
  try {
    delete process.env.VICE_RECYCLE_CAPTURE_TIMEOUT_MS;
    assert.equal(stockCaptureStepTimeoutMs(), 8000);
    process.env.VICE_RECYCLE_CAPTURE_TIMEOUT_MS = "42";
    assert.equal(stockCaptureStepTimeoutMs(), 42);
  } finally {
    if (prev === undefined) delete process.env.VICE_RECYCLE_CAPTURE_TIMEOUT_MS;
    else process.env.VICE_RECYCLE_CAPTURE_TIMEOUT_MS = prev;
  }
});

test("gatherStockWedgeEvidence: a step whose promise never settles is cut off at a test-set deadline under 50ms, recorded unavailable", async () => {
  const prev = process.env.VICE_RECYCLE_CAPTURE_TIMEOUT_MS;
  process.env.VICE_RECYCLE_CAPTURE_TIMEOUT_MS = "20";
  try {
    const { session } = makeFakeSession({ neverResolveCpuHistory: true });
    const started = Date.now();
    const evidence = await gatherStockWedgeEvidence(session, {} as unknown as StockDispatchDeps);
    const elapsed = Date.now() - started;
    assert.equal(evidence.bracket!.available, false);
    assert.match(evidence.bracket!.reason!, /deadline/);
    assert.ok(elapsed < 1000, `expected the deadline to cut the gather off quickly, took ${elapsed}ms`);
  } finally {
    if (prev === undefined) delete process.env.VICE_RECYCLE_CAPTURE_TIMEOUT_MS;
    else process.env.VICE_RECYCLE_CAPTURE_TIMEOUT_MS = prev;
  }
});

// ---------------------------------------------------------------------------
// Task 2/3: handleRecycleStock() -- reason gate.
// ---------------------------------------------------------------------------

test("handleRecycleStock: missing/empty/whitespace-only reason refuses before any lease consultation, gather or write", async () => {
  await withTempIncidentsDir(async (dir) => {
    for (const args of [{}, { reason: "" }, { reason: "   " }]) {
      const { session } = makeFakeSession({ alwaysReject: true }); // any touch would throw
      const result = await handleRecycleStock(args, session, FAKE_DEPS_NO_LEASE);
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /non-empty "reason"/);
      assert.equal(recordFiles(dir).length, 0, "no record should exist for a reason-less call");
    }
  });
});

test("handleRecycleStock: a non-ok lease outcome returns its message verbatim, writing nothing", async () => {
  await withTempIncidentsDir(async (dir) => {
    const { session } = makeFakeSession();
    const deps: StockDispatchDeps = { ensureLease: async () => ({ ok: false, message: "broker: dead_or_hung" }) };
    const result = await handleRecycleStock({ reason: "testing" }, session, deps);
    assert.equal(result.isError, true);
    assert.equal(result.content[0]!.text, "broker: dead_or_hung");
    assert.equal(recordFiles(dir).length, 0);
  });
});

test("handleRecycleStock: a null lease (VICE_MCP_URL override) refuses explicitly, writing nothing", async () => {
  await withTempIncidentsDir(async (dir) => {
    const { session } = makeFakeSession();
    const deps: StockDispatchDeps = { ensureLease: async () => ({ ok: true, lease: null }) };
    const result = await handleRecycleStock({ reason: "testing" }, session, deps);
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /VICE_MCP_URL/);
    assert.equal(recordFiles(dir).length, 0);
  });
});

// ---------------------------------------------------------------------------
// Task 2/3: the load-bearing ordering test.
// ---------------------------------------------------------------------------

test("handleRecycleStock: the incident record exists on disk, with a complete evidence section, at the MOMENT the recycle RPC is invoked", async () => {
  await withTempIncidentsDir(async (dir) => {
    const { session } = makeFakeSession({
      checkpoints: [{ id: 1, start: 0xc100, stop: true, enabled: true, operation: EXEC_OP, hitCount: 2 }],
    });
    // A mutable holder (rather than a reassigned outer `let`) so the value
    // set from inside the nested recycle-stub closure is read back plainly,
    // with no cross-function control-flow narrowing surprises.
    const observed: { atRpcTime: { fileCount: number; text: string } | null } = { atRpcTime: null };
    const { deps, recycleCallCount } = makeLeaseDeps({
      recycleImpl: async () => {
        // Observed FROM INSIDE the RPC stub -- the load-bearing assertion:
        // not merely that writeIncidentRecord() was called first, but that
        // the file is ALREADY on disk, with its evidence section already
        // rendered, at the instant the destructive RPC itself runs.
        const files = recordFiles(dir);
        const text = files.length === 1 ? readFileSync(join(dir, files[0]!), "utf8") : "";
        observed.atRpcTime = { fileCount: files.length, text };
        return okAck();
      },
    });

    const result = await handleRecycleStock({ reason: "load-bearing ordering test" }, session, deps);

    assert.equal(result.isError, false);
    assert.equal(recycleCallCount(), 1);
    assert.ok(observed.atRpcTime, "the recycle stub must have run");
    assert.equal(observed.atRpcTime!.fileCount, 1, "exactly one record must exist at RPC time");
    for (const label of ["cycle bracket", "program counter / register snapshot", "armed checkpoints", "resolved live IRQ handler"]) {
      assert.ok(observed.atRpcTime!.text.includes(label), `expected the evidence section to already contain "${label}" at RPC time`);
    }
  });
});

// ---------------------------------------------------------------------------
// Task 3: no screenshot.
// ---------------------------------------------------------------------------

test("handleRecycleStock: the written record contains no screenshot line, while still carrying the other four evidence labels", async () => {
  await withTempIncidentsDir(async (dir) => {
    const { session } = makeFakeSession();
    const { deps } = makeLeaseDeps({ recycleImpl: async () => okAck() });
    const result = await handleRecycleStock({ reason: "verifying the rendered evidence section" }, session, deps);
    assert.equal(result.isError, false);
    const text = readRecord(dir);
    assert.equal(/screenshot/i.test(text), false, "the record must never mention screenshot -- SHOT-* was cut from scope");
    for (const label of ["cycle bracket", "program counter / register snapshot", "armed checkpoints", "resolved live IRQ handler"]) {
      assert.ok(text.includes(label));
    }
  });
});

// ---------------------------------------------------------------------------
// Task 3: degraded evidence still recycles.
// ---------------------------------------------------------------------------

test("handleRecycleStock: a session whose every read rejects still writes a record (four unavailable entries) and still sends the RPC", async () => {
  await withTempIncidentsDir(async (dir) => {
    const { session } = makeFakeSession({ alwaysReject: true });
    const { deps, recycleCallCount } = makeLeaseDeps({ recycleImpl: async () => okAck() });
    const result = await handleRecycleStock({ reason: "wedged machine, evidence degraded" }, session, deps);
    assert.equal(result.isError, false, "a wedged machine's own failed reads must not block its own recovery");
    assert.equal(recycleCallCount(), 1);
    const text = readRecord(dir);
    const unavailableCount = (text.match(/unavailable \(/g) || []).length;
    assert.equal(unavailableCount, 4, `expected all four evidence items unavailable, got: ${text}`);
  });
});

// ---------------------------------------------------------------------------
// Task 3: outcome mapping, one test per non-ok ControlRecycleResult kind.
// ---------------------------------------------------------------------------

test("handleRecycleStock: a broker_gone recycle outcome finalises the record with outcome broker_gone", async () => {
  await withTempIncidentsDir(async (dir) => {
    const { session } = makeFakeSession();
    const { deps } = makeLeaseDeps({ recycleImpl: async () => ({ ok: false, kind: "broker_gone", message: "connection dropped" }) });
    const result = await handleRecycleStock({ reason: "broker gone case" }, session, deps);
    assert.equal(result.isError, true);
    const text = readRecord(dir);
    assert.match(result.content[0]!.text, /Incident record:/);
    assert.equal(outcomeFrontmatter(text), "broker_gone");
  });
});

test("handleRecycleStock: a deadline recycle outcome finalises the record with outcome timeout", async () => {
  await withTempIncidentsDir(async (dir) => {
    const { session } = makeFakeSession();
    const { deps } = makeLeaseDeps({ recycleImpl: async () => ({ ok: false, kind: "deadline", message: "no ack within 5000ms" }) });
    const result = await handleRecycleStock({ reason: "deadline case" }, session, deps);
    assert.equal(result.isError, true);
    const text = readRecord(dir);
    assert.match(result.content[0]!.text, /Incident record:/);
    assert.equal(outcomeFrontmatter(text), "timeout");
  });
});

test("handleRecycleStock: any other non-ok recycle kind finalises the record with outcome internal, never inventing a fourth kind", async () => {
  await withTempIncidentsDir(async (dir) => {
    const { session } = makeFakeSession();
    const { deps } = makeLeaseDeps({ recycleImpl: async () => ({ ok: false, kind: "protocol", message: "malformed ack" }) });
    const result = await handleRecycleStock({ reason: "protocol failure case" }, session, deps);
    assert.equal(result.isError, true);
    const text = readRecord(dir);
    assert.match(result.content[0]!.text, /Incident record:/);
    assert.equal(outcomeFrontmatter(text), "internal");
  });
});

test("handleRecycleStock: an ok RPC whose ack was not a successful kill finalises the record with the ack's own outcome and does not disconnect", async () => {
  await withTempIncidentsDir(async (dir) => {
    const { session, disconnectCallCount } = makeFakeSession();
    const { deps } = makeLeaseDeps({ recycleImpl: async () => okAck({ outcome: "identity_refused", kill_stage: "none" }) });
    const result = await handleRecycleStock({ reason: "refused case" }, session, deps);
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /identity did not match/);
    const text = readRecord(dir);
    assert.equal(outcomeFrontmatter(text), "identity_refused");
    assert.equal(disconnectCallCount(), 0, "a refused (non-killing) ack must not tear the session down");
  });
});

// ---------------------------------------------------------------------------
// Task 3: success path.
// ---------------------------------------------------------------------------

test("handleRecycleStock: a confirmed kill returns isError:false, finalises the record with outcome ok, and calls stockDisconnect exactly once", async () => {
  await withTempIncidentsDir(async (dir) => {
    const { session, disconnectCallCount } = makeFakeSession();
    const { deps } = makeLeaseDeps({ recycleImpl: async () => okAck({ kill_stage: "sigterm" }) });
    const result = await handleRecycleStock({ reason: "confirmed kill" }, session, deps);
    assert.equal(result.isError, false);
    const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
    assert.equal(payload.recycled, true);
    assert.equal(payload.killStage, "sigterm");
    const text = readRecord(dir);
    assert.equal(outcomeFrontmatter(text), "ok");
    assert.equal(disconnectCallCount(), 1);
  });
});

test("handleRecycleStock: already_exited and sigkill are also successful-kill stages", async () => {
  for (const killStage of ["already_exited", "sigkill"]) {
    await withTempIncidentsDir(async (dir) => {
      const { session, disconnectCallCount } = makeFakeSession();
      const { deps } = makeLeaseDeps({ recycleImpl: async () => okAck({ kill_stage: killStage }) });
      const result = await handleRecycleStock({ reason: `success stage ${killStage}` }, session, deps);
      assert.equal(result.isError, false);
      assert.equal(outcomeFrontmatter(readRecord(dir)), "ok");
      assert.equal(disconnectCallCount(), 1);
    });
  }
});

// ---------------------------------------------------------------------------
// Task 3: structural gate. Comment-stripping matches this project's own
// established idiom (broker-launch.test.ts's stripComments()) -- strips
// `/* ... */` blocks and whole `//`-prefixed lines, never a trailing inline
// `// ...` after real code on the same line, so the file's own explanatory
// prose (which deliberately NAMES these forbidden identifiers, e.g. "never
// import clearHeldStockSession()") cannot self-invalidate the count.
// ---------------------------------------------------------------------------

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

test("structural: stock-recycle.ts's comment-stripped source references none of rewriteArguments, vice-proxy, forwardToVice, clearHeldStockSession, vice_display_screenshot", () => {
  const source = stripComments(readFileSync(join(HERE, "stock-recycle.ts"), "utf8"));
  for (const forbidden of ["rewriteArguments", "vice-proxy", "forwardToVice", "clearHeldStockSession", "vice_display_screenshot"]) {
    assert.equal(source.includes(forbidden), false, `stock-recycle.ts must not reference "${forbidden}" outside comments`);
  }
});
