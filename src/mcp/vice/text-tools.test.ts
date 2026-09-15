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
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { handleDeviceConsole, handleWarpSet, handleMemmapShow, handleMemmapZap, handleCpuHistory, handleProfileFlat, handleBacktrace, handleIoRegisters, handleProgramLoad } from "./text-tools.ts";
import { dispatchStock } from "./stock-dispatch.ts";
import type { StockDispatchDeps } from "./stock-dispatch.ts";
import type { StockToolResult } from "./stock-handler.ts";
import type { StockConnectBrokerControl } from "./stock-connect.ts";
import { currentChannelLockHolder, channelLockRefusalMessage, resetChannelLockForTests, acquireChannelLock } from "./channel-lock.ts";
import type { HeldLease } from "./vice-broker-client.ts";
import { loadTextFixture } from "./textmon-fixtures.ts";
import { CPUHISTORY_DISABLED_STUB, resetTextCapabilityCache } from "./text-capability-probe.ts";
import { PROFILING_NOT_STARTED_TEXT } from "./textmon-profile.ts";
import { ViceMonitorClient, CommandType } from "./stock-protocol.ts";
import { HAZARD_SUBJECT_PRG_PATH, HAZARD_SUBJECT_IDS, hazardSubjectLoadVerb } from "./text-protocol.ts";

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
  backend: "stock" | null;
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
  brokerHostState: { backend: "stock" | null; binPath: string },
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
// handleMemmapZap: dials memmapzap then memmapshow, and answers the
// post-zap observable count -- Plan 43-03, EVID-05.
// ---------------------------------------------------------------------------

test("handleMemmapZap: dials exactly 'memmapzap' then 'memmapshow', in that order, and returns the post-zap observable count with no ranges key", async () => {
  const receivedLines: string[] = [];
  const body = "addr: IO  ROM RAM\n0000: --- --- rw- (dummy)\n";
  await withStubTextServer(
    (line, socket) => {
      receivedLines.push(line);
      if (line === "memmapzap") {
        socket.write(`OK${PROMPT}`);
      } else {
        socket.write(`${body}${PROMPT}`);
      }
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleMemmapZap({}, deps);
      assert.equal(result.isError, false, `expected success, got ${JSON.stringify(result)}`);
      assert.deepEqual(receivedLines, ["memmapzap", "memmapshow"], "exactly these two commands, in this order");
      const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
      assert.equal(payload.command, "memmapzap");
      assert.equal(payload.addressesWithRecordedAccess, 1);
      assert.equal(payload.addressesQueried, 65536);
      assert.equal(Object.prototype.hasOwnProperty.call(payload, "ranges"), false, "vice_memmap_zap must never answer a ranges key");
    },
  );
});

test("handleMemmapZap: a build without FEATURE_CPUMEMHISTORY is reported as a named missing capability, via the memmapshow classification, never a parser refusal", async () => {
  await withStubTextServer(
    (line, socket) => {
      if (line === "memmapzap") {
        socket.write(`OK${PROMPT}`);
      } else {
        socket.write(`${CPUHISTORY_DISABLED_STUB}\n${PROMPT}`);
      }
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleMemmapZap({}, deps);
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /vice_memmap_zap/);
      assert.match(result.content[0]!.text, /CPU-and-memory-history build support/);
      assert.doesNotMatch(result.content[0]!.text, /missing-header|malformed-line/, "a missing-capability reply must never surface as a parser refusal code");
    },
  );
});

test("handleMemmapZap: a genuine parseAccessMap refusal on the memmapshow reply surfaces isErrorText naming the tool, the refusal code and the offending line -- never a partial answer", async () => {
  await withStubTextServer(
    (line, socket) => {
      if (line === "memmapzap") {
        socket.write(`OK${PROMPT}`);
      } else {
        socket.write(`not the memmapshow header at all\n0000: --- --- ---\n${PROMPT}`);
      }
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleMemmapZap({}, deps);
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /vice_memmap_zap/);
      assert.match(result.content[0]!.text, /missing-header/);
    },
  );
});

// Live-measured (plan 43-03 Task 1, against genuine stock VICE 3.9): a real
// memmapshow dialed immediately after a real memmapzap, in the same locked
// session with the machine halted the whole time, ALWAYS returns exactly
// this shape -- header present, zero data lines -- because nothing can have
// executed between the two dials. parseAccessMap()'s own no-data-lines
// refusal exists for an ARBITRARY caller (handleMemmapShow, unaffected,
// still refuses on it); this handler's own narrow, single-writer context
// resolves the ambiguity that refusal guards against, so it is answered as
// a confirmed empty map, never surfaced as an error.
test("handleMemmapZap: a header-with-zero-data-lines memmapshow reply (the real shape of a just-cleared, unexecuted map) is answered as a confirmed-empty success, never the generic parser refusal", async () => {
  const receivedLines: string[] = [];
  await withStubTextServer(
    (line, socket) => {
      receivedLines.push(line);
      if (line === "memmapzap") {
        socket.write(`OK${PROMPT}`);
      } else {
        socket.write(`addr: IO  ROM RAM\n${PROMPT}`);
      }
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleMemmapZap({}, deps);
      assert.equal(result.isError, false, `expected success, got ${JSON.stringify(result)}`);
      assert.deepEqual(receivedLines, ["memmapzap", "memmapshow"]);
      const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
      assert.equal(payload.command, "memmapzap");
      assert.equal(payload.addressesWithRecordedAccess, 0);
      assert.equal(payload.addressesQueried, 65536);
      const counts = payload.executeCounts as { io: number; rom: number; ram: number };
      assert.deepEqual(counts, { io: 0, rom: 0, ram: 0 });
      assert.equal(Object.prototype.hasOwnProperty.call(payload, "ranges"), false);
    },
  );
});

test("handleMemmapZap: takes no arguments -- an unexpected argument is simply ignored, no lease resolved differently", async () => {
  const receivedLines: string[] = [];
  const body = "addr: IO  ROM RAM\n0000: --- --- rw- (dummy)\n";
  await withStubTextServer(
    (line, socket) => {
      receivedLines.push(line);
      if (line === "memmapzap") {
        socket.write(`OK${PROMPT}`);
      } else {
        socket.write(`${body}${PROMPT}`);
      }
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleMemmapZap({ startAddress: 0, bogus: "x" }, deps);
      assert.equal(result.isError, false);
      assert.deepEqual(receivedLines, ["memmapzap", "memmapshow"]);
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
// CR-02, direction (b): the mirror direction -- a first io call that
// returned a real dump must never cause a later call to a genuinely
// degrading chip to be reported through the generic parse-failure wrapper.
// Same resolved-and-agreeing identity setup as direction (a).
// ---------------------------------------------------------------------------

test("handleIoRegisters (CR-02, direction b): a healthy first call never suppresses a later call's genuine chip degradation behind the parse-failure wrapper", async () => {
  const fixture = loadTextFixture("register-decode-stock");
  let callCount = 0;
  await withStubTextServer(
    (_line, socket) => {
      callCount++;
      if (callCount === 1) {
        socket.write(fixture.text);
      } else {
        socket.write(`No details available.\n${PROMPT}`);
      }
    },
    async (port) => {
      resetTextCapabilityCache();
      const deps = makeDepsWithBrokerIdentity(port, { backend: "stock", binPath: "/usr/bin/x64sc" }, "/usr/bin/x64sc");

      const first = await handleIoRegisters({ address: 0xd020 }, deps);
      assert.equal(first.isError, false, `expected the first, real-dump call to succeed, got ${JSON.stringify(first)}`);

      const second = await handleIoRegisters({ address: 0xd021 }, deps);
      assert.equal(second.isError, true, "expected the second, degrading call to refuse");
      assert.match(second.content[0]!.text, /nothing to report here/, "expected the chip-fact wording, not a silently cached success");
      assert.doesNotMatch(second.content[0]!.text, /could not be parsed/, "the chip-level degradation must never read through the generic parse-failure wrapper");
    },
  );
});

// ---------------------------------------------------------------------------
// CR-02: the empty-reply indeterminate state must survive the rewiring under
// a RESOLVED identity too -- the file already covers this under an
// UNRESOLVED identity (above); this variant proves the fix did not move the
// empty case onto the parser's own empty-response path once the cache is
// genuinely live.
// ---------------------------------------------------------------------------

test("handleIoRegisters (CR-02): an indeterminate (empty) reply under a RESOLVED, agreeing identity still produces its own named message", async () => {
  await withStubTextServer(
    (_line, socket) => {
      socket.write(PROMPT);
    },
    async (port) => {
      resetTextCapabilityCache();
      const deps = makeDepsWithBrokerIdentity(port, { backend: "stock", binPath: "/usr/bin/x64sc" }, "/usr/bin/x64sc");
      const result = await handleIoRegisters({ address: 0xd020 }, deps);
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /unknown, not negative/);
    },
  );
});

// ---------------------------------------------------------------------------
// handleProgramLoad (plan 50-04, route-d): reaches text-protocol.ts's
// widened `load` verb. Takes only an optional, bounded device number --
// never a filename -- so these tests prove the rendered command, the
// channel-lock discipline every handler in this file shares, the
// buildTextCommand()-driven out-of-range refusal, and that no filename-
// shaped argument the caller supplies ever reaches the dialed command.
// ---------------------------------------------------------------------------

test("handleProgramLoad: no device argument dials device 0, the exact command buildTextCommand()'s own load spec produces", async () => {
  const receivedLines: string[] = [];
  await withStubTextServer(
    (line, socket) => {
      receivedLines.push(line);
      socket.write(PROMPT);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleProgramLoad({}, deps);
      assert.equal(result.isError, false, `expected success, got ${JSON.stringify(result)}`);
      assert.deepEqual(receivedLines, [`load "${HAZARD_SUBJECT_PRG_PATH}" 0`]);
      const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
      assert.equal(payload.command, `load "${HAZARD_SUBJECT_PRG_PATH}" 0`);
      assert.equal(payload.device, 0);
    },
  );
});

test("handleProgramLoad: a supplied device dials buildTextCommand()'s canonical rendering for that device", async () => {
  const receivedLines: string[] = [];
  await withStubTextServer(
    (line, socket) => {
      receivedLines.push(line);
      socket.write(PROMPT);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleProgramLoad({ device: 8 }, deps);
      assert.equal(result.isError, false, `expected success, got ${JSON.stringify(result)}`);
      assert.deepEqual(receivedLines, [`load "${HAZARD_SUBJECT_PRG_PATH}" 8`]);
      const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
      assert.equal(payload.device, 8);
    },
  );
});

test("handleProgramLoad: refuses an out-of-range device by name, via buildTextCommand's own message, no lease resolved", async () => {
  let leaseCalled = false;
  const deps: StockDispatchDeps = {
    ensureLease: async () => {
      leaseCalled = true;
      return { ok: true, lease: null };
    },
  };
  const result = await handleProgramLoad({ device: 12 }, deps);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /vice_program_load/);
  assert.match(result.content[0]!.text, /requires an integer between 0 and 11/);
  assert.equal(leaseCalled, false, "no lease should ever be resolved before buildTextCommand's own bound check runs");
});

test("handleProgramLoad: holds the text-channel lock for the duration and releases it on success", async () => {
  let holderDuringCommand: ReturnType<typeof currentChannelLockHolder> = null;
  await withStubTextServer(
    (_line, socket) => {
      holderDuringCommand = currentChannelLockHolder();
      socket.write(PROMPT);
    },
    async (port) => {
      const deps = makeDeps(port);
      assert.equal(currentChannelLockHolder(), null, "no lock held before the call");
      const result = await handleProgramLoad({}, deps);
      assert.equal(result.isError, false);
      assert.ok(holderDuringCommand, "expected a holder to be observed while the command was outstanding");
      assert.equal(holderDuringCommand!.channel, "text");
      assert.equal(holderDuringCommand!.operation, "vice_program_load");
      assert.equal(currentChannelLockHolder(), null, "the lock must be released again after the call returns");
    },
  );
});

test("handleProgramLoad: no filename can be injected -- an extraneous filename-shaped argument is ignored, the baked-in fixture path is always dialed", async () => {
  const receivedLines: string[] = [];
  await withStubTextServer(
    (line, socket) => {
      receivedLines.push(line);
      socket.write(PROMPT);
    },
    async (port) => {
      const deps = makeDeps(port);
      const result = await handleProgramLoad(
        { device: 0, filename: "/etc/passwd", path: "/etc/passwd", file: "../../etc/passwd" } as Record<string, unknown>,
        deps,
      );
      assert.equal(result.isError, false, `expected success, got ${JSON.stringify(result)}`);
      assert.deepEqual(
        receivedLines,
        [`load "${HAZARD_SUBJECT_PRG_PATH}" 0`],
        "the handler reads no filename-shaped argument at all -- only the baked-in fixture path is ever dialed",
      );
    },
  );
});

test("handleProgramLoad [plan 50-05]: every subject id in the closed table dials its OWN frozen path, and an omitted subject still dials the original", async () => {
  for (const id of HAZARD_SUBJECT_IDS) {
    const receivedLines: string[] = [];
    await withStubTextServer(
      (line, socket) => {
        receivedLines.push(line);
        socket.write(PROMPT);
      },
      async (port) => {
        const deps = makeDeps(port);
        const result = await handleProgramLoad({ subject: id }, deps);
        assert.equal(result.isError, false, `expected success for subject ${id}, got ${JSON.stringify(result)}`);
        assert.deepEqual(receivedLines, [`${hazardSubjectLoadVerb(id)} 0`], `subject ${id} must dial its own frozen path`);
        const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
        assert.equal(payload.subject, id, "the answer must name which subject was actually loaded");
      },
    );
  }

  // The default is unchanged from plan 50-04: no subject means the original.
  // This is what keeps every earlier caller and every earlier captured
  // command string valid after the table widening.
  const defaultLines: string[] = [];
  await withStubTextServer(
    (line, socket) => {
      defaultLines.push(line);
      socket.write(PROMPT);
    },
    async (port) => {
      const result = await handleProgramLoad({}, makeDeps(port));
      assert.equal(result.isError, false);
      assert.deepEqual(defaultLines, [`load "${HAZARD_SUBJECT_PRG_PATH}" 0`]);
    },
  );
});

test("handleProgramLoad [plan 50-05]: a subject the closed table does not carry is refused BY NAME, before any lease and any byte -- including a path-shaped one", async () => {
  // The whole point of an enumerated id rather than a filename: none of
  // these reaches a command string, and the refusal names the accepted set
  // rather than failing somewhere inside the emulator.
  for (const bad of ["misaligned", "/etc/passwd", "../hazard-subject.prg", "", "ORIGINAL", "__proto__", "constructor", 0, null, {}]) {
    let leaseCalled = false;
    const deps: StockDispatchDeps = {
      ensureLease: async () => {
        leaseCalled = true;
        return { ok: true, lease: null };
      },
    };
    const result = await handleProgramLoad({ subject: bad } as Record<string, unknown>, deps);
    assert.equal(result.isError, true, `expected ${JSON.stringify(bad)} to be refused`);
    assert.match(result.content[0]!.text, /vice_program_load/);
    assert.match(result.content[0]!.text, /"subject" must be one of/);
    assert.match(result.content[0]!.text, /never accepts a filename/);
    assert.equal(leaseCalled, false, "no lease may be resolved for an unrecognised subject id");
  }
});

// ---------------------------------------------------------------------------
// Plan 42-13 (G3): the identity cross-check reaches the caller, on every
// tool and on both paths -- computed once per handler from the identities
// capabilityIdentityFor(deps) already resolved, before any dial.
// ---------------------------------------------------------------------------

const DISAGREEING_BROKER_HOST_STATE = { backend: "stock" as const, binPath: "/usr/local/bin/x64sc" };
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

// ---------------------------------------------------------------------------
// LIVE, OPT-IN (plan 43-03, EVID-05): one vice_memmap_zap call clears the
// emulator's own accumulated access map and proves it, dialed against a
// REAL, directly-spawned genuine stock VICE -- never a stub client. Same
// opt-in gate `text-monitor-live.test.ts` already uses (VICE_LIVE_STOCK_BIN),
// so this case is skipped by default and reachable deliberately, never a
// second env var.
//
// Construction mirrors stock-dispatch.test.ts's own D-02 conformance
// harness shape (a StockDispatchDeps whose ensureLease() hands back fixed
// coordinates, a no-op claimMonitor/releaseMonitor stub) but substitutes a
// REAL socket to a directly-spawned x64sc for the stubbed client --
// `.planning/phases/43-.../evidence/evid06-instrumentation-ab.mjs` is plan
// 43-01's own one-off broker-driven A/B measurement script and stays that
// way; this is a new, independent, committed live test case.
//
// A stock x64sc launched with `-console` plus a monitor flag starts with
// the CPU HALTED (MEASURED, `probe-harness.mjs`'s own `resumeExecution()`
// header) and stays halted until an EXIT (0xaa) is sent over the BINARY
// monitor -- text-monitor commands are drawn only from TEXT_COMMAND_ALLOWLIST
// (D-01) and carry no resume verb, so this case opens its own throwaway
// binary connection purely to issue that one resume, then dials
// dispatchStock("vice_memmap_show"/"vice_memmap_zap", ...) exactly as
// production does. Once resumed the CPU free-runs (recording continuously
// and unconditionally, per RESEARCH.md's mon_memmap.c citation) until the
// NEXT monitor command halts it again -- so nothing else is dialed during
// the free-run window below.
// ---------------------------------------------------------------------------

const VICE_LIVE_STOCK_BIN_ENV = process.env.VICE_LIVE_STOCK_BIN;

const LIVE_SKIP_REASON: string | false = !VICE_LIVE_STOCK_BIN_ENV
  ? "text-tools.test.ts's vice_memmap_zap live case is opt-in and default-skipped -- set " +
    "VICE_LIVE_STOCK_BIN=/usr/bin/x64sc (or another real, genuinely unpatched stock VICE binary's absolute path) " +
    "to run it. A bare \"x64sc\" on PATH resolves to the fork build (which has no -remotemonitor text channel), " +
    "always name the stock binary by absolute path."
  : !existsSync(VICE_LIVE_STOCK_BIN_ENV)
    ? `VICE_LIVE_STOCK_BIN="${VICE_LIVE_STOCK_BIN_ENV}" does not exist on disk -- opt-in requires a real stock ` +
      "VICE binary at that absolute path (e.g. /usr/bin/x64sc). A bare \"x64sc\" on PATH would resolve to the " +
      "fork build instead of genuine stock."
    : false;

/** Binds a throwaway server to 127.0.0.1:0, reads the OS-assigned port, and
 * closes it -- the standard "free ephemeral port" idiom, mirroring
 * stock-live.test.ts's own freeEphemeralPort() exactly. */
async function freeEphemeralPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      const port = typeof address === "object" && address ? address.port : null;
      srv.close(() => {
        if (port === null) reject(new Error("freeEphemeralPort: could not read an ephemeral port from address()"));
        else resolve(port);
      });
    });
  });
}

/** Retries `client.connect()` in a bounded loop (mirrors stock-live.test.ts's
 * own connectWithRetry()) -- the emulator needs a moment to bind its
 * listening socket after spawn. Works for either monitor client, both of
 * which share the same `connect(host, port, { timeoutMs })` signature. */
async function connectWithRetry(
  client: { connect(host: string, port: number, opts?: { timeoutMs?: number }): Promise<void> },
  host: string,
  port: number,
  deadlineMs = 10000,
): Promise<void> {
  const start = Date.now();
  let lastErr: unknown = null;
  while (Date.now() - start < deadlineMs) {
    try {
      await client.connect(host, port, { timeoutMs: 1000 });
      return;
    } catch (err) {
      lastErr = err;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`connectWithRetry: could not connect to ${host}:${port} within ${deadlineMs}ms (last error: ${String(lastErr)})`);
}

test(
  "LIVE (opt-in): vice_memmap_zap against genuine stock VICE -- the post-zap addressesWithRecordedAccess is strictly lower than the pre-zap count measured in the same session",
  { skip: LIVE_SKIP_REASON, timeout: 60000 },
  async () => {
    const binPath = VICE_LIVE_STOCK_BIN_ENV as string;
    const binaryPort = await freeEphemeralPort();
    const textPort = await freeEphemeralPort();
    const scratchDir = mkdtempSync(join(tmpdir(), "gsd-4303-memmapzap-live-"));
    const child: ChildProcess = spawn(
      binPath,
      [
        "-default",
        "-console",
        "-binarymonitor",
        "-binarymonitoraddress",
        `ip4://127.0.0.1:${binaryPort}`,
        "-remotemonitor",
        "-remotemonitoraddress",
        `ip4://127.0.0.1:${textPort}`,
      ],
      { stdio: "ignore", env: { ...process.env, XDG_CONFIG_HOME: scratchDir } },
    );
    child.once("error", (err) => {
      console.error(`text-tools.test.ts LIVE case: spawned emulator process error: ${String(err)}`);
    });

    const binClient = new ViceMonitorClient();
    try {
      await connectWithRetry(binClient, "127.0.0.1", binaryPort);
      // PING confirms the monitor is actually SERVING, not merely that the
      // listen backlog accepted the TCP connection (probe-harness.mjs's own
      // pingReady() note).
      await binClient.send(CommandType.Ping, Buffer.alloc(0), { timeoutMs: 3000 });

      // Resume the CPU -- the ONE resume, per resumeExecution()'s own
      // documented invariant: send nothing else to either monitor until the
      // free-run window below has elapsed.
      await binClient.send(CommandType.Exit, Buffer.alloc(0), { timeoutMs: 10000 });
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const brokerControl = {
        claimMonitor: async () => ({ ok: true as const }),
        releaseMonitor: async () => ({ ok: true as const }),
      } as unknown as StockConnectBrokerControl;

      const deps: StockDispatchDeps = {
        ensureLease: async () => ({
          ok: true,
          lease: {
            host: "127.0.0.1",
            port: binaryPort,
            targetId: "text-tools-live-4303",
            brokerControl: brokerControl as unknown as HeldLease["brokerControl"],
            epochFile: "",
            supervisorDir: "",
            remoteMonitorPort: textPort,
          } as HeldLease,
        }),
      };

      // Dialing memmapshow itself halts the CPU again (same as the binary
      // side) -- this IS the pre-zap read, through the REAL dispatchStock()
      // seam, never the handler called directly.
      const preResult = await dispatchStock("vice_memmap_show", {}, deps);
      assert.equal(preResult.isError, false, `pre-zap vice_memmap_show failed: ${JSON.stringify(preResult)}`);
      const prePayload = JSON.parse(preResult.content[0]!.text) as Record<string, unknown>;
      const preZap = prePayload.addressesWithRecordedAccess;
      assert.equal(typeof preZap, "number");

      const zapResult = await dispatchStock("vice_memmap_zap", {}, deps);
      assert.equal(zapResult.isError, false, `vice_memmap_zap failed: ${JSON.stringify(zapResult)}`);
      const zapPayload = JSON.parse(zapResult.content[0]!.text) as Record<string, unknown>;
      const postZap = zapPayload.addressesWithRecordedAccess;
      assert.equal(typeof postZap, "number");
      assert.equal(Object.prototype.hasOwnProperty.call(zapPayload, "ranges"), false);

      // The relation, never a pinned count -- the exact number of addresses
      // touched during a fixed sleep window is not this test's claim.
      assert.ok(
        (postZap as number) < (preZap as number),
        `expected the post-zap recorded-access count (${String(postZap)}) to be strictly lower than the pre-zap count (${String(preZap)})`,
      );
    } finally {
      await binClient.disconnect().catch(() => {});
      child.kill("SIGKILL");
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 3000);
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
      rmSync(scratchDir, { recursive: true, force: true });
    }
  },
);
