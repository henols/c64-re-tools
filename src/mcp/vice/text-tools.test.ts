#!/usr/bin/env node
// text-tools.test.ts
//
// Deterministic, no-emulator unit tests for text-tools.ts's two allowlisted
// text-channel tool handlers. Each test spins up a real TCP stub
// text-monitor server (mirrors text-connect.test.ts's own
// withStubTextServer()) and drives handleDeviceConsole()/handleWarpSet()
// through their REAL deps.ensureLease() -> textConnect() ->
// withTextChannelLock() -> command() -> textDisconnect() path -- no mocked
// client object, matching this tree's own "a real TCP server" testing
// convention (text-connect.test.ts, text-protocol.test.ts).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server, type Socket } from "node:net";
import type { AddressInfo } from "node:net";

import { handleDeviceConsole, handleWarpSet, handleMemmapShow, handleCpuHistory, handleProfileFlat, handleBacktrace, handleIoRegisters } from "./text-tools.ts";
import type { StockDispatchDeps } from "./stock-dispatch.ts";
import type { StockToolResult } from "./stock-handler.ts";
import type { StockConnectBrokerControl } from "./stock-connect.ts";
import { currentChannelLockHolder, channelLockRefusalMessage, resetChannelLockForTests, acquireChannelLock } from "./channel-lock.ts";
import type { HeldLease } from "./vice-broker-client.ts";
import { loadTextFixture } from "./textmon-fixtures.ts";
import { CPUHISTORY_DISABLED_STUB, resetTextCapabilityCache } from "./text-capability-probe.ts";
import { PROFILING_NOT_STARTED_TEXT } from "./textmon-profile.ts";

beforeEach(() => {
  resetChannelLockForTests();
});

// ---------------------------------------------------------------------------
// A minimal stub text-monitor server: buffers received bytes into lines
// (each outbound command() write is terminated with "\n", per
// text-protocol.ts's own client.write(`${cmd}\n`)) and calls `onLine` once
// per complete line, so a test can inspect state (e.g.
// currentChannelLockHolder()) from INSIDE the moment the server observes the
// command arrive, then respond with a canned, prompt-terminated payload.
// ---------------------------------------------------------------------------

async function withStubTextServer<T>(onLine: (line: string, socket: Socket) => void, fn: (port: number) => Promise<T>): Promise<T> {
  const sockets = new Set<Socket>();
  const server: Server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    let buf = "";
    socket.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      let idx: number;
      while ((idx = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        onLine(line, socket);
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as AddressInfo).port;
  try {
    return await fn(port);
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

/** A minimal claim/release-only stub -- textConnect()'s own
 * StockConnectBrokerControl narrow interface, matching text-connect.test.ts's
 * makeStubBrokerControl() shape. Carries NO `hostState()` method, so
 * capabilityIdentityFor() (text-tools.ts) always falls into its
 * no-broker-identity branch through this stub -- exactly the "current stub
 * carries no hostState() today" gap plan 42-13's own read_first names. */
function makeStubBrokerControl(): StockConnectBrokerControl {
  return {
    async claimMonitor() {
      return { ok: true };
    },
    async releaseMonitor() {
      return { ok: true };
    },
  };
}

/** Plan 42-13 (G3): a sibling stub that DOES carry a `hostState()`,
 * resolving the caller-chosen `backend`/`binPath` -- so a test can drive
 * `capabilityIdentityFor()`'s broker-identity branch and exercise
 * `textCapabilityIdentityWarning()` end to end through a real handler. */
function makeStubBrokerControlWithHostState(hostState: {
  backend: "fork" | "stock" | null;
  binPath: string;
}): StockConnectBrokerControl {
  return {
    async claimMonitor() {
      return { ok: true };
    },
    async releaseMonitor() {
      return { ok: true };
    },
    async hostState() {
      return {
        ok: true,
        hostState: {
          pid: 1,
          started_at: "",
          node_version: "",
          vice_bin: hostState.binPath,
          warm_floor: 0,
          max_instances: 1,
          base_port: 0,
          backend: hostState.backend,
        },
      };
    },
  } as unknown as StockConnectBrokerControl;
}

/** Builds StockDispatchDeps.ensureLease() so it resolves a HeldLease pointed
 * at the stub server's port -- mirrors stock-dispatch.test.ts's own
 * makeLease() helper, with remoteMonitorPort (D-15) filled in since that is
 * the field these two tools actually read. */
function makeDeps(port: number, overrides: Partial<StockDispatchDeps> = {}): StockDispatchDeps {
  const lease: HeldLease = {
    host: "127.0.0.1",
    port: 6502,
    targetId: "grant-1",
    brokerControl: makeStubBrokerControl() as unknown as HeldLease["brokerControl"],
    epochFile: "",
    supervisorDir: "",
    remoteMonitorPort: port,
  };
  return {
    ensureLease: async () => ({ ok: true, lease }),
    ...overrides,
  };
}

/** Plan 42-13 (G3): builds StockDispatchDeps with a resolved binary identity
 * (`resolvedBinaryPath`/`resolvedBinaryPathIsResolved`) AND a broker control
 * whose `hostState()` resolves the caller-chosen identity -- so
 * `capabilityIdentityFor()` (text-tools.ts) resolves BOTH identities
 * `textCapabilityIdentityWarning()` compares. */
function makeDepsWithBrokerIdentity(
  port: number,
  brokerHostState: { backend: "fork" | "stock" | null; binPath: string },
  resolvedBinaryPath = "/usr/bin/x64sc",
): StockDispatchDeps {
  const lease: HeldLease = {
    host: "127.0.0.1",
    port: 6502,
    targetId: "grant-1",
    brokerControl: makeStubBrokerControlWithHostState(brokerHostState) as unknown as HeldLease["brokerControl"],
    epochFile: "",
    supervisorDir: "",
    remoteMonitorPort: port,
  };
  return {
    ensureLease: async () => ({ ok: true, lease }),
    resolvedBinaryPath,
    resolvedBinaryPathIsResolved: true,
  };
}

const PROMPT = "(C:$0000) ";

// ---------------------------------------------------------------------------
// handleDeviceConsole: issues exactly the one allowlisted verb.
// ---------------------------------------------------------------------------

test("handleDeviceConsole: issues exactly 'device c:' and nothing else", async () => {
  const receivedLines: string[] = [];
  await withStubTextServer(
    (line, socket) => {
      receivedLines.push(line);
      socket.write(`OK${PROMPT}`);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleDeviceConsole({}, deps);
      assert.equal(result.isError, false, `expected success, got ${JSON.stringify(result)}`);
      assert.deepEqual(receivedLines, ["device c:"], "exactly one command, exactly this literal");
      const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
      assert.match(String(payload.response), /^OK/);
      assert.match(String(payload.note), /main CPU/);
    },
  );
});

// ---------------------------------------------------------------------------
// handleWarpSet: selects the two verbs by branch.
// ---------------------------------------------------------------------------

test("handleWarpSet(true): issues 'warp on'", async () => {
  const receivedLines: string[] = [];
  await withStubTextServer(
    (line, socket) => {
      receivedLines.push(line);
      socket.write(`warp: on${PROMPT}`);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleWarpSet({ enabled: true }, deps);
      assert.equal(result.isError, false, `expected success, got ${JSON.stringify(result)}`);
      assert.deepEqual(receivedLines, ["warp on"]);
      const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
      assert.equal(payload.requested, true);
      assert.match(String(payload.response), /warp: on/);
    },
  );
});

test("handleWarpSet(false): issues 'warp off'", async () => {
  const receivedLines: string[] = [];
  await withStubTextServer(
    (line, socket) => {
      receivedLines.push(line);
      socket.write(`warp: off${PROMPT}`);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleWarpSet({ enabled: false }, deps);
      assert.equal(result.isError, false, `expected success, got ${JSON.stringify(result)}`);
      assert.deepEqual(receivedLines, ["warp off"]);
      const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
      assert.equal(payload.requested, false);
      assert.match(String(payload.response), /warp: off/);
    },
  );
});

// ---------------------------------------------------------------------------
// handleWarpSet: refuses a non-boolean `enabled` by name, no byte written.
// ---------------------------------------------------------------------------

for (const bad of ["true", 1, null, undefined, {}]) {
  test(`handleWarpSet: refuses a non-boolean enabled (${JSON.stringify(bad)}) by name, no byte written to the socket`, async () => {
    let leaseCalled = false;
    const deps: StockDispatchDeps = {
      ensureLease: async () => {
        leaseCalled = true;
        return { ok: true, lease: null };
      },
    };
    const result = await handleWarpSet({ enabled: bad }, deps);
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /"enabled" must be a boolean/);
    assert.equal(leaseCalled, false, "no lease should ever be resolved before the boolean check runs");
  });
}

// ---------------------------------------------------------------------------
// Both handlers hold the text-channel lock for the duration, observed from
// INSIDE the stub server's own line handler (which runs while the client's
// command() promise is still outstanding), and release it on the success
// path.
// ---------------------------------------------------------------------------

test("handleDeviceConsole: holds the text-channel lock for the duration and releases it on success", async () => {
  let holderDuringCommand: ReturnType<typeof currentChannelLockHolder> = null;
  await withStubTextServer(
    (_line, socket) => {
      holderDuringCommand = currentChannelLockHolder();
      socket.write(`OK${PROMPT}`);
    },
    async (port) => {
      const deps = makeDeps(port);
      assert.equal(currentChannelLockHolder(), null, "no lock held before the call");
      const result = await handleDeviceConsole({}, deps);
      assert.equal(result.isError, false);
      assert.ok(holderDuringCommand, "expected a holder to be observed while the command was outstanding");
      assert.equal(holderDuringCommand!.channel, "text");
      assert.equal(holderDuringCommand!.operation, "vice_device_console");
      assert.equal(currentChannelLockHolder(), null, "the lock must be released again after the call returns");
    },
  );
});

test("handleWarpSet: holds the text-channel lock for the duration and releases it on success", async () => {
  let holderDuringCommand: ReturnType<typeof currentChannelLockHolder> = null;
  await withStubTextServer(
    (_line, socket) => {
      holderDuringCommand = currentChannelLockHolder();
      socket.write(`warp: on${PROMPT}`);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleWarpSet({ enabled: true }, deps);
      assert.equal(result.isError, false);
      assert.ok(holderDuringCommand);
      assert.equal(holderDuringCommand!.channel, "text");
      assert.equal(holderDuringCommand!.operation, "vice_warp_set");
      assert.equal(currentChannelLockHolder(), null);
    },
  );
});

// ---------------------------------------------------------------------------
// The lock is released on the throw path too -- the server destroys the
// socket mid-command instead of ever sending a prompt, forcing command() to
// reject with a connection-closed error.
// ---------------------------------------------------------------------------

test("handleDeviceConsole: releases the text-channel lock even when the wire call throws", async () => {
  await withStubTextServer(
    (_line, socket) => {
      socket.destroy();
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleDeviceConsole({}, deps);
      assert.equal(result.isError, true, "a destroyed connection mid-command must surface as a refusal, not a throw");
      assert.equal(currentChannelLockHolder(), null, "the lock must be released even though the wire call failed");
    },
  );
});

// ---------------------------------------------------------------------------
// A ChannelLockTimeoutError surfaces as refusal text byte-identical to
// channelLockRefusalMessage()'s own output -- never re-worded.
// ---------------------------------------------------------------------------

test("handleWarpSet: a ChannelLockTimeoutError surfaces as refusal text byte-identical to channelLockRefusalMessage()'s output", async () => {
  await withStubTextServer(
    (_line, socket) => {
      socket.write(`warp: on${PROMPT}`);
    },
    async (port) => {
      // Pre-acquire the SAME single mutex from the "binary" channel so
      // handleWarpSet's own withTextChannelLock() acquire is forced to
      // queue, then times out immediately via the 1ms override.
      const handle = await acquireChannelLock({ channel: "binary", operation: "vice_run_until", grantId: "grant-9" });
      try {
        const deps = makeDeps(port, { channelLockTimeoutMs: 1 });
        const result = await handleWarpSet({ enabled: true }, deps);
        assert.equal(result.isError, true);
        const expected = channelLockRefusalMessage(handle.holder, Date.now());
        // Compare everything up to the "held for Nms" clause -- the exact
        // millisecond figure is a live clock read on both sides and cannot
        // be pinned byte-for-byte, but the wording register (holder,
        // operation, grant id, the refusal sentence) must match exactly.
        const stripMs = (s: string) => s.replace(/held for \d+ms/, "held for Nms");
        assert.equal(stripMs(result.content[0]!.text), stripMs(expected), "refusal text must be channelLockRefusalMessage()'s own wording, never re-worded");
      } finally {
        handle.release();
      }
    },
  );
});

// ---------------------------------------------------------------------------
// handleMemmapShow: issues exactly the frozen "memmapshow" verb and answers
// the parsed, bounded projection -- Plan 42-01, PARSE-01.
// ---------------------------------------------------------------------------

test("handleMemmapShow: issues exactly 'memmapshow' and returns a parsed, bounded access map", async () => {
  const receivedLines: string[] = [];
  const body = "addr: IO  ROM RAM\n0000: --- --- rw- (dummy)\n0001: --- --x ---\n";
  await withStubTextServer(
    (line, socket) => {
      receivedLines.push(line);
      socket.write(`${body}${PROMPT}`);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleMemmapShow({}, deps);
      assert.equal(result.isError, false, `expected success, got ${JSON.stringify(result)}`);
      assert.deepEqual(receivedLines, ["memmapshow"], "exactly one command, exactly this literal");
      const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
      assert.equal(payload.command, "memmapshow");
      assert.equal(payload.rangeCount, 2);
      assert.equal(payload.truncated, false);
      const counts = payload.executeCounts as { io: number; rom: number; ram: number };
      assert.equal(counts.rom, 1);
    },
  );
});

test("handleMemmapShow: refuses a non-integer startAddress by name, no lease resolved, no byte written", async () => {
  let leaseCalled = false;
  const deps: StockDispatchDeps = {
    ensureLease: async () => {
      leaseCalled = true;
      return { ok: true, lease: null };
    },
  };
  const result = await handleMemmapShow({ startAddress: "not a number" }, deps);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /"startAddress" must be an integer/);
  assert.equal(leaseCalled, false, "no lease should ever be resolved before the argument check runs");
});

test("handleMemmapShow: refuses startAddress greater than endAddress by name, no lease resolved", async () => {
  let leaseCalled = false;
  const deps: StockDispatchDeps = {
    ensureLease: async () => {
      leaseCalled = true;
      return { ok: true, lease: null };
    },
  };
  const result = await handleMemmapShow({ startAddress: 100, endAddress: 50 }, deps);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /must not be greater than/);
  assert.equal(leaseCalled, false);
});

test("handleMemmapShow: a parse refusal surfaces as isErrorText naming the tool, the refusal code, and the offending line -- never a partial answer", async () => {
  // A non-empty, non-whitespace body -- deliberately, since plan 42-07 Task 3
  // retrofits this handler to classify for build capability BEFORE parsing
  // (see the dedicated test below): a whitespace-only reply now surfaces as
  // an INDETERMINATE capability message at that earlier stage, never reaching
  // parseAccessMap()'s own "empty-response" refusal code at all. This case
  // instead exercises a reply that passes classification (capable -- it is
  // not the CPUHISTORY_DISABLED_STUB literal) but is still structurally
  // wrong for memmapshow's own header, reaching the parser's refusal.
  const body = "not the memmapshow header at all\n0000: --- --- ---\n";
  await withStubTextServer(
    (_line, socket) => {
      socket.write(`${body}${PROMPT}`);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleMemmapShow({}, deps);
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /vice_memmap_show/);
      assert.match(result.content[0]!.text, /missing-header/);
    },
  );
});

test("handleMemmapShow: an indeterminate (empty) reply produces its own named capability message BEFORE ever reaching the parser, never a silent empty success", async () => {
  await withStubTextServer(
    (_line, socket) => {
      socket.write(PROMPT); // resolves to an empty payload once the trailing prompt is stripped
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleMemmapShow({}, deps);
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /vice_memmap_show/);
      assert.match(result.content[0]!.text, /unknown, not negative/);
      assert.doesNotMatch(result.content[0]!.text, /empty-response/, "an indeterminate capability reply must never surface the parser's own empty-response code");
    },
  );
});

// ---------------------------------------------------------------------------
// Plan 42-07 Task 3: handleMemmapShow retrofitted with the same
// classify-before-parse ordering the four PARSE-02 handlers use -- "chis"
// shares FEATURE_CPUMEMHISTORY with "memmapshow", so a disabled-stub reply
// must produce the capability message, never a parser refusal code (plan
// 42-01 wrote this handler before text-capability-probe.ts existed, so it
// originally handed the disabled-stub text straight to the parser).
// ---------------------------------------------------------------------------

test("handleMemmapShow: a disabled-stub reply (memmapshow shares FEATURE_CPUMEMHISTORY with chis) produces the capability message, NOT a parser refusal code", async () => {
  await withStubTextServer(
    (_line, socket) => {
      socket.write(`${CPUHISTORY_DISABLED_STUB}\n${PROMPT}`);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleMemmapShow({}, deps);
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /vice_memmap_show/);
      assert.match(result.content[0]!.text, /CPU-and-memory-history build support/);
      assert.doesNotMatch(result.content[0]!.text, /missing-header|malformed-line/, "a missing-capability reply must never surface as a parser refusal code");
    },
  );
});

// ---------------------------------------------------------------------------
// Plan 42-07: the four remaining text formats -- vice_cpu_history,
// vice_profile_flat, vice_backtrace, vice_io_registers -- driven from the
// committed fixtures/textmon/ captures via loadTextFixture(), never
// hand-typed replies, matching this phase's own PARSE-02 verification
// requirement.
// ---------------------------------------------------------------------------

// --------------------------------------------------------- vice_cpu_history

test("handleCpuHistory: no count argument dials the bare 'chis' verb and returns entries in parser order", async () => {
  const fixture = loadTextFixture("cpu-history-stock");
  const receivedLines: string[] = [];
  await withStubTextServer(
    (line, socket) => {
      receivedLines.push(line);
      socket.write(fixture.text);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleCpuHistory({}, deps);
      assert.equal(result.isError, false, `expected success, got ${JSON.stringify(result)}`);
      assert.deepEqual(receivedLines, ["chis"]);
      const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
      assert.equal(payload.command, "chis");
      const entries = payload.entries as Array<{ address: number }>;
      assert.equal(entries.length, 4);
      assert.equal(payload.count, 4);
      assert.equal(entries[0]!.address, 0xe5d1);
    },
  );
});

test("handleCpuHistory: a supplied count dials buildTextCommand()'s canonical rendering ('chis 4')", async () => {
  const fixture = loadTextFixture("cpu-history-stock");
  const receivedLines: string[] = [];
  await withStubTextServer(
    (line, socket) => {
      receivedLines.push(line);
      socket.write(fixture.text);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleCpuHistory({ count: 4 }, deps);
      assert.equal(result.isError, false, `expected success, got ${JSON.stringify(result)}`);
      assert.deepEqual(receivedLines, ["chis 4"]);
    },
  );
});

test("handleCpuHistory: refuses an out-of-range count by name, via buildTextCommand's own message, no lease resolved", async () => {
  let leaseCalled = false;
  const deps: StockDispatchDeps = {
    ensureLease: async () => {
      leaseCalled = true;
      return { ok: true, lease: null };
    },
  };
  const result = await handleCpuHistory({ count: 0 }, deps);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /vice_cpu_history/);
  assert.match(result.content[0]!.text, /"chis" requires an integer between 1 and 65535/);
  assert.equal(leaseCalled, false, "no lease should ever be resolved before the argument check runs");
});

test("handleCpuHistory: a disabled-stub reply (chis shares FEATURE_CPUMEMHISTORY with memmapshow) produces the capability message, NOT a parser refusal code", async () => {
  await withStubTextServer(
    (_line, socket) => {
      socket.write(`${CPUHISTORY_DISABLED_STUB}\n${PROMPT}`);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleCpuHistory({}, deps);
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /vice_cpu_history/);
      assert.match(result.content[0]!.text, /CPU-and-memory-history build support/);
      assert.doesNotMatch(result.content[0]!.text, /malformed-line/, "a missing-capability reply must never surface as a parser refusal code");
    },
  );
});

test("handleCpuHistory: an indeterminate (empty) reply produces its own named message, never a silent empty success", async () => {
  await withStubTextServer(
    (_line, socket) => {
      socket.write(PROMPT);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleCpuHistory({}, deps);
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /unknown, not negative/);
    },
  );
});

// --------------------------------------------------------- vice_profile_flat

test("handleProfileFlat: no count argument dials the bare 'prof flat' verb and returns entries in parser order", async () => {
  const fixture = loadTextFixture("flat-profile-stock");
  const receivedLines: string[] = [];
  await withStubTextServer(
    (line, socket) => {
      receivedLines.push(line);
      socket.write(fixture.text);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleProfileFlat({}, deps);
      assert.equal(result.isError, false, `expected success, got ${JSON.stringify(result)}`);
      assert.deepEqual(receivedLines, ["prof flat"]);
      const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
      assert.equal(payload.command, "prof flat");
      const entries = payload.entries as Array<{ address: number; totalCycles: number }>;
      assert.equal(entries.length, 5);
      assert.equal(payload.count, 5);
      assert.equal(entries[0]!.totalCycles, 2326151);
    },
  );
});

test("handleProfileFlat: a supplied count dials buildTextCommand()'s canonical rendering ('prof flat 5')", async () => {
  const fixture = loadTextFixture("flat-profile-stock");
  const receivedLines: string[] = [];
  await withStubTextServer(
    (line, socket) => {
      receivedLines.push(line);
      socket.write(fixture.text);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleProfileFlat({ count: 5 }, deps);
      assert.equal(result.isError, false, `expected success, got ${JSON.stringify(result)}`);
      assert.deepEqual(receivedLines, ["prof flat 5"]);
    },
  );
});

test("handleProfileFlat: refuses an out-of-range count by name, via buildTextCommand's own message, no lease resolved", async () => {
  let leaseCalled = false;
  const deps: StockDispatchDeps = {
    ensureLease: async () => {
      leaseCalled = true;
      return { ok: true, lease: null };
    },
  };
  const result = await handleProfileFlat({ count: 70000 }, deps);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /vice_profile_flat/);
  assert.match(result.content[0]!.text, /"prof flat" requires an integer between 1 and 65535/);
  assert.equal(leaseCalled, false);
});

// "prof flat" carries NO build-time guard at all (text-capability-probe.ts's
// own CPUHISTORY_GATED_COMMANDS excludes it deliberately, plan 42-05) -- so,
// unlike vice_cpu_history's disabled-stub case above, feeding it the
// FEATURE_CPUMEMHISTORY disabled-stub text can NEVER classify "missing": the
// classifier correctly reports "capable" (it is not a build-gap reply for
// THIS verb), and the response is handed to the parser, which then refuses it
// structurally because the text is not a "prof flat" header. This is the
// documented, already-tested 42-05 design (see that plan's own SUMMARY,
// "bt/prof flat/io can never classify missing"), not a gap in this task --
// asserting the OPPOSITE here would require re-litigating a decision this
// phase already closed.
test("handleProfileFlat: the FEATURE_CPUMEMHISTORY disabled-stub text is NOT a build-gap reply for this verb -- classifies capable, then refuses structurally in the parser (42-05's documented design)", async () => {
  await withStubTextServer(
    (_line, socket) => {
      socket.write(`${CPUHISTORY_DISABLED_STUB}\n${PROMPT}`);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleProfileFlat({}, deps);
      assert.equal(result.isError, true);
      assert.doesNotMatch(result.content[0]!.text, /CPU-and-memory-history build support/, "prof flat must never classify this text as a missing build capability");
      assert.match(result.content[0]!.text, /missing-header/, "expected the parser's own structural refusal, not a capability message");
    },
  );
});

test("handleProfileFlat: an indeterminate (empty) reply produces its own named message, never a silent empty success", async () => {
  await withStubTextServer(
    (_line, socket) => {
      socket.write(PROMPT);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleProfileFlat({}, deps);
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /unknown, not negative/);
    },
  );
});

// Plan 42-13 (G2): VICE's own cold-profiler sentence -- correctly classified
// "capable" (it is not a build gap) -- must surface as a named
// profiling-not-started state, never through the parse-failure wrapper the
// other refusal codes use.
test("handleProfileFlat: VICE's own cold-profiler sentence surfaces as a named profiling-not-started state, never the parse-failure wrapper", async () => {
  await withStubTextServer(
    (_line, socket) => {
      socket.write(`${PROFILING_NOT_STARTED_TEXT}\n${PROMPT}`);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleProfileFlat({}, deps);
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /vice_profile_flat/);
      assert.ok(
        result.content[0]!.text.includes(PROFILING_NOT_STARTED_TEXT),
        "expected the cold-profiler sentence verbatim in the user-facing text",
      );
      assert.doesNotMatch(
        result.content[0]!.text,
        /could not be parsed/,
        "the profiling-not-started refusal must not carry the other codes' parse-failure wrapper",
      );
    },
  );
});

test("handleProfileFlat: a different refusal code (missing-header) still carries the parse-failure wrapper -- proving the profiling-not-started special case is scoped to one code, not applied to all", async () => {
  await withStubTextServer(
    (_line, socket) => {
      socket.write(`this is not the header\nnor is this\n${PROMPT}`);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleProfileFlat({}, deps);
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /could not be parsed/, "every code other than profiling-not-started keeps the parse-failure wrapper");
      assert.match(result.content[0]!.text, /missing-header/);
    },
  );
});

// --------------------------------------------------------- vice_backtrace

test("handleBacktrace: dials the bare 'bt' verb (takes no wire parameter) and returns the current-PC frame plus every frame in parser order", async () => {
  const fixture = loadTextFixture("backtrace-stock");
  const receivedLines: string[] = [];
  await withStubTextServer(
    (line, socket) => {
      receivedLines.push(line);
      socket.write(fixture.text);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleBacktrace({}, deps);
      assert.equal(result.isError, false, `expected success, got ${JSON.stringify(result)}`);
      assert.deepEqual(receivedLines, ["bt"]);
      const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
      assert.equal(payload.command, "bt");
      const currentPc = payload.currentPc as { address: number };
      assert.equal(currentPc.address, 0xe5d1);
      const frames = payload.frames as unknown[];
      assert.equal(frames.length, 5);
      assert.equal(payload.returnedCount, 5);
      assert.equal(payload.totalCount, 5);
      assert.equal(payload.truncated, false);
    },
  );
});

test("handleBacktrace: a depth argument truncates the PARSED frames and reports the returned count, the total count, and the truncated flag", async () => {
  const fixture = loadTextFixture("backtrace-stock");
  await withStubTextServer(
    (_line, socket) => {
      socket.write(fixture.text);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleBacktrace({ depth: 2 }, deps);
      assert.equal(result.isError, false, `expected success, got ${JSON.stringify(result)}`);
      const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
      const frames = payload.frames as unknown[];
      assert.equal(frames.length, 2);
      assert.equal(payload.returnedCount, 2);
      assert.equal(payload.totalCount, 5, "the total is never a function of the depth argument");
      assert.equal(payload.truncated, true);
    },
  );
});

test("handleBacktrace: refuses an out-of-range depth by name, no lease resolved -- depth never reaches the wire", async () => {
  let leaseCalled = false;
  const deps: StockDispatchDeps = {
    ensureLease: async () => {
      leaseCalled = true;
      return { ok: true, lease: null };
    },
  };
  const result = await handleBacktrace({ depth: 65 }, deps);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /vice_backtrace/);
  assert.match(result.content[0]!.text, /"depth" must be an integer 1 through 64/);
  assert.equal(leaseCalled, false);
});

// "bt" also carries NO build-time guard (see the identical note on
// vice_profile_flat above) -- the disabled-stub text classifies "capable"
// for this verb and refuses structurally in the parser instead, per 42-05's
// own documented, already-tested design.
test("handleBacktrace: the FEATURE_CPUMEMHISTORY disabled-stub text is NOT a build-gap reply for this verb -- classifies capable, then refuses structurally in the parser (42-05's documented design)", async () => {
  await withStubTextServer(
    (_line, socket) => {
      socket.write(`${CPUHISTORY_DISABLED_STUB}\n${PROMPT}`);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleBacktrace({}, deps);
      assert.equal(result.isError, true);
      assert.doesNotMatch(result.content[0]!.text, /CPU-and-memory-history build support/, "bt must never classify this text as a missing build capability");
      assert.match(result.content[0]!.text, /missing-current-pc-line/, "expected the parser's own structural refusal, not a capability message");
    },
  );
});

test("handleBacktrace: an indeterminate (empty) reply produces its own named message, never a silent empty success", async () => {
  await withStubTextServer(
    (_line, socket) => {
      socket.write(PROMPT);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleBacktrace({}, deps);
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /unknown, not negative/);
    },
  );
});

// --------------------------------------------------------- vice_io_registers

test("handleIoRegisters: a required address dials buildTextCommand()'s canonical 'io $d020' rendering and returns the decoded chip section", async () => {
  const fixture = loadTextFixture("register-decode-stock");
  const receivedLines: string[] = [];
  await withStubTextServer(
    (line, socket) => {
      receivedLines.push(line);
      socket.write(fixture.text);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleIoRegisters({ address: 0xd020 }, deps);
      assert.equal(result.isError, false, `expected success, got ${JSON.stringify(result)}`);
      assert.deepEqual(receivedLines, ["io $d020"]);
      const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
      assert.equal(payload.command, "io $d020");
      const sections = payload.sections as Array<{ chip: string }>;
      assert.equal(sections.length, 1);
      assert.equal(sections[0]!.chip, "VIC-II");
      // The real capture is a fully clean decode -- unrecognisedLineCount must
      // still be PRESENT even though it is zero, the caller's signal that
      // drift was checked for and none was found.
      assert.equal(payload.unrecognisedLineCount, 0);
      assert.deepEqual(payload.unrecognisedLines, []);
    },
  );
});

test("handleIoRegisters: refuses a missing address argument outright -- it is REQUIRED, no lease resolved", async () => {
  let leaseCalled = false;
  const deps: StockDispatchDeps = {
    ensureLease: async () => {
      leaseCalled = true;
      return { ok: true, lease: null };
    },
  };
  const result = await handleIoRegisters({}, deps);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /vice_io_registers/);
  assert.match(result.content[0]!.text, /"address" is REQUIRED/);
  assert.equal(leaseCalled, false);
});

test("handleIoRegisters: refuses an out-of-range address by name, via buildTextCommand's own message, no lease resolved", async () => {
  let leaseCalled = false;
  const deps: StockDispatchDeps = {
    ensureLease: async () => {
      leaseCalled = true;
      return { ok: true, lease: null };
    },
  };
  const result = await handleIoRegisters({ address: 70000 }, deps);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /vice_io_registers/);
  assert.match(result.content[0]!.text, /"io" requires an integer between 0 and 65535/);
  assert.equal(leaseCalled, false);
});

// "io" carries no build-time guard either, but degrades gracefully PER-CHIP
// at runtime with its own two fixed strings -- this IS the disabled-stub
// equivalent that is actually reachable for this verb (unlike prof flat/bt
// above), and it must produce the chip-level-degradation message, never a
// parser refusal code.
test("handleIoRegisters: a chip-level degradation reply ('No details available.') produces the chip-fact message, NOT a parser refusal code", async () => {
  await withStubTextServer(
    (_line, socket) => {
      socket.write(`No details available.\n${PROMPT}`);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleIoRegisters({ address: 0xd020 }, deps);
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /vice_io_registers/);
      assert.match(result.content[0]!.text, /nothing to report here/);
      assert.doesNotMatch(result.content[0]!.text, /no-details-available/, "a chip degradation reply must never surface as a parser refusal code");
    },
  );
});

test("handleIoRegisters: an indeterminate (empty) reply produces its own named message, never a silent empty success", async () => {
  await withStubTextServer(
    (_line, socket) => {
      socket.write(PROMPT);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleIoRegisters({ address: 0xd020 }, deps);
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /unknown, not negative/);
    },
  );
});

// CR-01 (plan 42-10): the tool, not only the parser, must refuse a drifted
// io reply rather than answer with absent required fields.
test("handleIoRegisters: a decoded-prose block missing its Colors: line refuses end-to-end, naming incomplete-decoded-state and the two absent fields, never a serialized answer", async () => {
  const fixture = loadTextFixture("register-decode-stock");
  const drifted = fixture.text.replace("Colors: Border: e BG: 6 \n", "");
  await withStubTextServer(
    (_line, socket) => {
      socket.write(drifted);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleIoRegisters({ address: 0xd020 }, deps);
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /incomplete-decoded-state/);
      assert.match(result.content[0]!.text, /borderColor/);
      assert.match(result.content[0]!.text, /backgroundColor/);
      // The tool refuses rather than answering -- no serialized answer
      // payload (a "sections" JSON array) appears in the error text.
      assert.doesNotMatch(result.content[0]!.text, /"sections":/);
    },
  );
});

// WR-02 (plan 42-11): a chip this parser does not decode is refused by its
// own name, end to end -- never dressed up as a parse failure.
test("handleIoRegisters (WR-02): a CIA1-renamed reply refuses end-to-end naming the chip and VIC-II, without the other codes' parse-failure wrapper phrasing", async () => {
  const fixture = loadTextFixture("register-decode-stock");
  const mutated = fixture.text.replace("VIC-II:", "CIA1:");
  await withStubTextServer(
    (_line, socket) => {
      socket.write(mutated);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleIoRegisters({ address: 0xdc00 }, deps);
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /CIA1/);
      assert.match(result.content[0]!.text, /VIC-II/);
      assert.doesNotMatch(result.content[0]!.text, /could not be parsed/, "the unsupported-chip refusal must not carry the other codes' parse-failure wrapper");
    },
  );
});

test("handleIoRegisters: a malformed dump row still refuses through the parse-failure wrapper, naming the code -- proving the unsupported-chip special case is scoped to one code, not applied to all", async () => {
  const fixture = loadTextFixture("register-decode-stock");
  const mutated = fixture.text.replace(
    ">C:d030  ff ff ff ff  ff ff ff ff  ff ff ff ff  ff ff ff ff   ................",
    ">C:d030  zz ff ff ff  ff ff ff ff  ff ff ff ff  ff ff ff ff   ................",
  );
  await withStubTextServer(
    (_line, socket) => {
      socket.write(mutated);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleIoRegisters({ address: 0xd020 }, deps);
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /could not be parsed/, "every code other than unsupported-chip keeps the parse-failure wrapper");
      assert.match(result.content[0]!.text, /malformed-dump/);
    },
  );
});

// ---------------------------------------------------------------------------
// CR-02, direction (a): a first io call that hit a degrading chip must never
// cause a later call to a healthy chip to be refused -- the real dump
// reaching the caller is the whole point. Driven through a RESOLVED identity
// AND an AGREEING broker identity (makeDepsWithBrokerIdentity) so the cache
// is genuinely live -- a disagreeing identity would suppress caching and
// make this control vacuous, which is exactly why the original bug was never
// caught.
// ---------------------------------------------------------------------------

test("handleIoRegisters (CR-02, direction a): a degrading first call never causes a later call's real register dump to be discarded", async () => {
  const fixture = loadTextFixture("register-decode-stock");
  let callCount = 0;
  await withStubTextServer(
    (_line, socket) => {
      callCount++;
      if (callCount === 1) {
        socket.write(`No details available.\n${PROMPT}`);
      } else {
        socket.write(fixture.text);
      }
    },
    async (port) => {
      resetTextCapabilityCache();
      const deps = makeDepsWithBrokerIdentity(port, { backend: "stock", binPath: "/usr/bin/x64sc" }, "/usr/bin/x64sc");

      const first = await handleIoRegisters({ address: 0xd020 }, deps);
      assert.equal(first.isError, true, "expected the first, degrading call to refuse");
      assert.match(first.content[0]!.text, /nothing to report here/);

      const second = await handleIoRegisters({ address: 0xd021 }, deps);
      assert.equal(
        second.isError,
        false,
        `expected the second call's real register dump to succeed, not be discarded behind the first call's cached refusal -- got ${JSON.stringify(second)}`,
      );
      const payload = JSON.parse(second.content[0]!.text) as Record<string, unknown>;
      const sections = payload.sections as Array<{ chip: string }>;
      assert.equal(sections.length, 1);
      assert.equal(sections[0]!.chip, "VIC-II");
    },
  );
});

// ---------------------------------------------------------------------------
// Plan 42-13 (G3): the identity cross-check reaches the caller, on every
// tool and on both paths -- computed once per handler from the identities
// capabilityIdentityFor(deps) already resolved, before any dial.
// ---------------------------------------------------------------------------

const DISAGREEING_BROKER_HOST_STATE = { backend: "fork" as const, binPath: "/usr/local/bin/x64sc" };
const AGREEING_BROKER_HOST_STATE = { backend: "stock" as const, binPath: "/usr/bin/x64sc" };

test("handleMemmapShow: a success path with a disagreeing broker identity carries a non-empty identityWarning in the answer payload", async () => {
  const body = "addr: IO  ROM RAM\n0000: --- --- rw- (dummy)\n0001: --- --x ---\n";
  await withStubTextServer(
    (_line, socket) => {
      socket.write(`${body}${PROMPT}`);
    },
    async (port) => {
      const deps = makeDepsWithBrokerIdentity(port, DISAGREEING_BROKER_HOST_STATE);
      const result = await handleMemmapShow({}, deps);
      assert.equal(result.isError, false, `expected success, got ${JSON.stringify(result)}`);
      const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
      assert.equal(typeof payload.identityWarning, "string");
      assert.notEqual(payload.identityWarning, "");
      assert.match(String(payload.identityWarning), /\/usr\/bin\/x64sc/);
      assert.match(String(payload.identityWarning), /\/usr\/local\/bin\/x64sc/);
    },
  );
});

test("handleMemmapShow: a refusal path with a disagreeing broker identity carries both the refusal and the warning, refusal first", async () => {
  const body = "not the memmapshow header at all\n0000: --- --- ---\n";
  await withStubTextServer(
    (_line, socket) => {
      socket.write(`${body}${PROMPT}`);
    },
    async (port) => {
      const deps = makeDepsWithBrokerIdentity(port, DISAGREEING_BROKER_HOST_STATE);
      const result = await handleMemmapShow({}, deps);
      assert.equal(result.isError, true);
      const text = result.content[0]!.text;
      assert.match(text, /could not be parsed/);
      assert.match(text, /identity disagreement/);
      const refusalIdx = text.indexOf("could not be parsed");
      const warningIdx = text.indexOf("identity disagreement");
      assert.ok(
        refusalIdx >= 0 && warningIdx >= 0 && refusalIdx < warningIdx,
        `expected the refusal text before the identity warning, got: ${JSON.stringify(text)}`,
      );
    },
  );
});

test("handleMemmapShow: an agreeing broker identity carries no identityWarning property at all", async () => {
  const body = "addr: IO  ROM RAM\n0000: --- --- rw- (dummy)\n0001: --- --x ---\n";
  await withStubTextServer(
    (_line, socket) => {
      socket.write(`${body}${PROMPT}`);
    },
    async (port) => {
      const deps = makeDepsWithBrokerIdentity(port, AGREEING_BROKER_HOST_STATE);
      const result = await handleMemmapShow({}, deps);
      assert.equal(result.isError, false);
      const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
      assert.equal(Object.prototype.hasOwnProperty.call(payload, "identityWarning"), false);
    },
  );
});

test("all five text tools surface a disagreeing broker identity's warning on their success path -- a future handler cannot silently drop it", async () => {
  const cases: Array<{ name: string; reply: string; call: (deps: StockDispatchDeps) => Promise<StockToolResult> }> = [
    {
      name: "vice_memmap_show",
      reply: `addr: IO  ROM RAM\n0000: --- --- rw- (dummy)\n${PROMPT}`,
      call: (deps) => handleMemmapShow({}, deps),
    },
    {
      name: "vice_cpu_history",
      reply: loadTextFixture("cpu-history-stock").text,
      call: (deps) => handleCpuHistory({}, deps),
    },
    {
      name: "vice_profile_flat",
      reply: loadTextFixture("flat-profile-stock").text,
      call: (deps) => handleProfileFlat({}, deps),
    },
    {
      name: "vice_backtrace",
      reply: loadTextFixture("backtrace-stock").text,
      call: (deps) => handleBacktrace({}, deps),
    },
    {
      name: "vice_io_registers",
      reply: loadTextFixture("register-decode-stock").text,
      call: (deps) => handleIoRegisters({ address: 0xd020 }, deps),
    },
  ];

  for (const testCase of cases) {
    await withStubTextServer(
      (_line, socket) => {
        socket.write(testCase.reply);
      },
      async (port) => {
        const deps = makeDepsWithBrokerIdentity(port, DISAGREEING_BROKER_HOST_STATE);
        const result = await testCase.call(deps);
        assert.equal(result.isError, false, `${testCase.name}: expected success, got ${JSON.stringify(result)}`);
        const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
        assert.equal(typeof payload.identityWarning, "string", `${testCase.name}: expected a non-empty identityWarning string`);
        assert.notEqual(payload.identityWarning, "", `${testCase.name}: expected identityWarning to be non-empty`);
        assert.match(
          String(payload.identityWarning),
          /identity disagreement/,
          `${testCase.name}: expected the identity-disagreement wording`,
        );
      },
    );
  }
});
