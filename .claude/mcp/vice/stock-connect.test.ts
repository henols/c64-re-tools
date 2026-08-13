// node:test coverage of stock-connect.ts's connect handshake: claim before
// dial, api_version assertion, VICE_INFO identity, the CPUHISTORY_GET
// capability gate, and (Task 2) reconnect-with-identity-check reusing
// vice.ts's MachineRestartedError. Every server in this file is a loopback
// net stub standing in for VICE's binary monitor -- never a real emulator
// (this plan's own environment constraint). Every broker control session is
// an injected stub -- never a real broker process.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server, type Socket } from "node:net";
import type { AddressInfo } from "node:net";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { stockConnect, stockDisconnect, stockReconnect, type StockConnectBrokerControl } from "./stock-connect.ts";
import {
  CommandType,
  ResponseType,
  ErrorCode,
  REQUEST_HEADER_LEN,
  StockFramingError,
  StockConnectionClosedError,
  StockRequestTimeoutError,
} from "./stock-protocol.ts";
import { MonitorOwnershipError, type ClaimMonitorOutcome, type ReleaseMonitorOutcome } from "./vice-broker-client.ts";
import { MachineRestartedError } from "./vice.ts";
import { encodeResponseFrame } from "./binmon-fixtures.ts";

// ---------------------------------------------------------------------------
// Request-decoding stub server -- the ViceMonitorClient-facing counterpart of
// stock-protocol.test.ts's own withStubNetServer(), extended to decode each
// incoming request frame (rather than writing one fixed byte stream) so a
// multi-step handshake (PING, VICE_INFO, CPUHISTORY_GET) can be answered
// command-by-command. Every accepted socket is tracked and destroyed in the
// finally block before server.close() -- net.Server has no
// closeAllConnections() (that exists only on http.Server); a lingering
// handle would wedge the whole test process, same discipline as every other
// *.test.ts loopback harness in this package.
// ---------------------------------------------------------------------------

interface DecodedRequest {
  apiVersion: number;
  requestId: number;
  commandType: number;
  body: Buffer;
  total: number;
}

function decodeOneRequest(buf: Buffer): DecodedRequest | null {
  if (buf.length < REQUEST_HEADER_LEN) return null;
  const bodyLength = buf.readUInt32LE(2);
  const total = REQUEST_HEADER_LEN + bodyLength;
  if (buf.length < total) return null;
  return {
    apiVersion: buf[1]!,
    requestId: buf.readUInt32LE(6),
    commandType: buf[10]!,
    body: buf.subarray(REQUEST_HEADER_LEN, total),
    total,
  };
}

type StockResponder = (req: DecodedRequest) => Buffer | null | undefined;

async function withStockStubServer<T>(
  responder: StockResponder,
  fn: (port: number, connectionCount: () => number) => Promise<T>,
): Promise<T> {
  const sockets = new Set<Socket>();
  let connections = 0;
  const server: Server = createServer((socket) => {
    connections += 1;
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    let buf = Buffer.alloc(0);
    socket.on("data", (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        const decoded = decodeOneRequest(buf);
        if (!decoded) break;
        buf = buf.subarray(decoded.total);
        const reply = responder(decoded);
        if (reply) socket.write(reply);
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as AddressInfo).port;
  try {
    return await fn(port, () => connections);
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

/** Body layout per parseResponse()'s ViceInfo case (stock-protocol.ts):
 * [mainVersionLength:1][version bytes][svnLength:1][svn bytes]. */
function encodeViceInfoBody(version: number[], svnBytes: number[] = []): Buffer {
  return Buffer.concat([Buffer.from([version.length]), Buffer.from(version), Buffer.from([svnBytes.length]), Buffer.from(svnBytes)]);
}

interface HappyPathOptions {
  cpuHistoryErrorCode?: number;
  version?: number[];
  onRequest?: (req: DecodedRequest) => void;
}

/** A responder answering PING, VICE_INFO, CPUHISTORY_GET and EXIT in the
 * shape a well-behaved stock build would -- every other command type is
 * ignored (returns null, no reply), which is fine because this handshake never
 * sends anything else.
 *
 * The EXIT (0xaa) arm was added with CR-02's fix: a real stock build answers
 * EXIT with its own response type AND emits an unsolicited RESUMED (0x63) at
 * request id 0xffffffff, so this stub models BOTH. Without the EXIT arm the
 * stub would silently model an emulator that never resumes -- which is the
 * defect, not the contract. */
function happyPathResponder({ cpuHistoryErrorCode = ErrorCode.Ok, version = [3, 9, 0, 0], onRequest }: HappyPathOptions = {}): StockResponder {
  return (req) => {
    onRequest?.(req);
    switch (req.commandType) {
      case CommandType.Ping:
        return encodeResponseFrame({ responseType: ResponseType.Ping, errorCode: ErrorCode.Ok, requestId: req.requestId });
      case CommandType.ViceInfo:
        return encodeResponseFrame({
          responseType: ResponseType.ViceInfo,
          errorCode: ErrorCode.Ok,
          requestId: req.requestId,
          body: encodeViceInfoBody(version),
        });
      case CommandType.CpuHistoryGet:
        return encodeResponseFrame({ responseType: ResponseType.CpuHistoryGet, errorCode: cpuHistoryErrorCode, requestId: req.requestId });
      case CommandType.Exit:
        return Buffer.concat([
          encodeResponseFrame({ responseType: ResponseType.Exit, errorCode: ErrorCode.Ok, requestId: req.requestId }),
          encodeResponseFrame({
            responseType: ResponseType.Resumed,
            errorCode: ErrorCode.Ok,
            requestId: 0xffffffff,
            body: Buffer.from([0x31, 0xea]),
          }),
        ]);
      default:
        return null;
    }
  };
}

interface StubBrokerControlOptions {
  claimOutcome?: ClaimMonitorOutcome;
  releaseOutcome?: ReleaseMonitorOutcome;
}

function makeStubBrokerControl(opts: StubBrokerControlOptions = {}): { brokerControl: StockConnectBrokerControl; state: { claimCalls: number; releaseCalls: number } } {
  const state = { claimCalls: 0, releaseCalls: 0 };
  const brokerControl: StockConnectBrokerControl = {
    async claimMonitor() {
      state.claimCalls += 1;
      return opts.claimOutcome ?? { ok: true };
    },
    async releaseMonitor() {
      state.releaseCalls += 1;
      return opts.releaseOutcome ?? { ok: true };
    },
  };
  return { brokerControl, state };
}

// ===========================================================================
// Task 1: claim-then-dial handshake with api_version and VICE_INFO
// ===========================================================================

test("stockConnect: handshake claims before dialling and completes against a stub answering api_version 0x02", async () => {
  await withStockStubServer(happyPathResponder(), async (port, connectionCount) => {
    const { brokerControl, state } = makeStubBrokerControl();
    const session = await stockConnect({ host: "127.0.0.1", port, targetId: "grant-1", brokerControl });
    assert.equal(state.claimCalls, 1);
    assert.equal(session.versionQuad, "3.9.0.0");
    assert.equal(session.capabilities.cpuHistory, "available");
    assert.equal(connectionCount(), 1);
    await stockDisconnect(session);
    assert.equal(state.releaseCalls, 1);
  });
});

// ===========================================================================
// CR-02: the handshake must RESUME the machine its own PING halted.
//
// These assert on the bytes that actually left the socket, not on the presence
// of a constant: docs/phase0-binmon-findings.md §4 says any inbound byte halts
// the machine and only EXIT (0xaa) resumes it, so the observable contract is
// "an EXIT reached the wire, after the capability probe, exactly once".
// ===========================================================================

test("stockConnect (CR-02): a successful handshake sends exactly one EXIT (0xaa), and sends it LAST -- after the capability probe", async () => {
  const seenCommands: number[] = [];
  await withStockStubServer(happyPathResponder({ onRequest: (req) => seenCommands.push(req.commandType) }), async (port) => {
    const { brokerControl } = makeStubBrokerControl();
    const session = await stockConnect({ host: "127.0.0.1", port, targetId: "grant-resume-1", brokerControl });

    const exits = seenCommands.filter((c) => c === CommandType.Exit);
    assert.equal(exits.length, 1, `the handshake must resume the machine its PING halted exactly once -- saw ${JSON.stringify(seenCommands)}`);
    assert.equal(CommandType.Exit, 0xaa, "the resume opcode is EXIT 0xaa per docs/phase0-binmon-findings.md §4");
    assert.equal(seenCommands[seenCommands.length - 1], CommandType.Exit, "the resume must be the LAST command of the handshake");
    assert.ok(
      seenCommands.indexOf(CommandType.CpuHistoryGet) < seenCommands.indexOf(CommandType.Exit),
      "the resume must follow the capability probe, not precede it",
    );
    // The full load-bearing order, asserted as a sequence rather than a set.
    assert.deepEqual(seenCommands, [CommandType.Ping, CommandType.ViceInfo, CommandType.CpuHistoryGet, CommandType.Exit]);

    await stockDisconnect(session);
  });
});

test("stockConnect (CR-02): a cached capability record still resumes -- the short-circuit must not skip the EXIT", async () => {
  const seenCommands: number[] = [];
  await withStockStubServer(happyPathResponder({ onRequest: (req) => seenCommands.push(req.commandType) }), async (port) => {
    const { brokerControl } = makeStubBrokerControl();
    const session = await stockConnect({
      host: "127.0.0.1",
      port,
      targetId: "grant-resume-2",
      brokerControl,
      deps: {
        binPath: "x64sc",
        readCapabilityRecordFn: () => ({ versionQuad: "3.9.0.0", cpuHistoryAvailable: true, stale: false }),
        writeCapabilityRecordFn: () => {},
      },
    });
    assert.ok(!seenCommands.includes(CommandType.CpuHistoryGet));
    assert.deepEqual(seenCommands, [CommandType.Ping, CommandType.ViceInfo, CommandType.Exit]);
    await stockDisconnect(session);
  });
});

test("stockConnect (CR-02): a handshake whose EXIT is never answered FAILS -- it never returns a session with a frozen machine", async () => {
  const seenCommands: number[] = [];
  await withStockStubServer(
    (req) => {
      seenCommands.push(req.commandType);
      // A stub that models the pre-fix emulator: it answers everything except
      // the resume, so the machine would be left halted.
      if (req.commandType === CommandType.Exit) return null;
      return happyPathResponder()(req);
    },
    async (port) => {
      const { brokerControl, state } = makeStubBrokerControl();
      await assert.rejects(
        stockConnect({ host: "127.0.0.1", port, targetId: "grant-resume-3", brokerControl, deps: {} }),
        (err: unknown) => {
          assert.ok(err instanceof StockRequestTimeoutError, `expected a timeout on the unanswered EXIT, got ${String(err)}`);
          assert.equal((err as StockRequestTimeoutError).commandType, CommandType.Exit);
          return true;
        },
      );
      assert.equal(state.releaseCalls, 1, "the failed handshake must still release the monitor claim");
      assert.deepEqual(
        seenCommands.filter((c) => c === CommandType.Exit),
        [CommandType.Exit],
        "the handshake attempted the resume exactly once before giving up",
      );
    },
  );
});

test("stockConnect (CR-02): a handshake that fails AFTER the halting PING still best-effort resumes on the way out", async () => {
  const seenCommands: number[] = [];
  await withStockStubServer(
    (req) => {
      seenCommands.push(req.commandType);
      if (req.commandType === CommandType.Ping) {
        return encodeResponseFrame({ responseType: ResponseType.Ping, errorCode: ErrorCode.Ok, requestId: req.requestId });
      }
      if (req.commandType === CommandType.ViceInfo) {
        // A wire-level failure at step 4, AFTER the PING already halted the machine.
        return encodeResponseFrame({ responseType: ResponseType.ViceInfo, errorCode: ErrorCode.CmdFailure, requestId: req.requestId });
      }
      if (req.commandType === CommandType.Exit) {
        return encodeResponseFrame({ responseType: ResponseType.Exit, errorCode: ErrorCode.Ok, requestId: req.requestId });
      }
      return null;
    },
    async (port) => {
      const { brokerControl, state } = makeStubBrokerControl();
      await assert.rejects(stockConnect({ host: "127.0.0.1", port, targetId: "grant-resume-4", brokerControl }));
      assert.ok(seenCommands.includes(CommandType.Exit), `a failed handshake must not leave the machine halted -- saw ${JSON.stringify(seenCommands)}`);
      assert.equal(state.releaseCalls, 1);
    },
  );
});

test("stockConnect: api_version mismatch on PING rejects with a typed framing failure naming the observed value and disconnects", async () => {
  await withStockStubServer(
    (req) => {
      if (req.commandType === CommandType.Ping) {
        return encodeResponseFrame({ responseType: ResponseType.Ping, errorCode: ErrorCode.Ok, requestId: req.requestId, apiVersion: 0x03 });
      }
      return null;
    },
    async (port) => {
      const { brokerControl, state } = makeStubBrokerControl();
      await assert.rejects(
        stockConnect({ host: "127.0.0.1", port, targetId: "grant-2", brokerControl }),
        (err: unknown) => {
          assert.ok(err instanceof StockFramingError);
          assert.equal((err as StockFramingError).observed, 0x03);
          return true;
        },
      );
      assert.equal(state.releaseCalls, 1, "a failed handshake must release the monitor claim before propagating");
    },
  );
});

test("stockConnect: cpuhistory available (error code 0x00) maps to capabilities.cpuHistory === 'available'", async () => {
  await withStockStubServer(happyPathResponder({ cpuHistoryErrorCode: ErrorCode.Ok }), async (port) => {
    const { brokerControl } = makeStubBrokerControl();
    const session = await stockConnect({ host: "127.0.0.1", port, targetId: "grant-3", brokerControl });
    assert.equal(session.capabilities.cpuHistory, "available");
    await stockDisconnect(session);
  });
});

test("stockConnect: cpuhistory error code 0x83 (INVALID_TYPE) maps to capabilities.cpuHistory === 'absent'", async () => {
  await withStockStubServer(happyPathResponder({ cpuHistoryErrorCode: ErrorCode.InvalidType }), async (port) => {
    const { brokerControl } = makeStubBrokerControl();
    const session = await stockConnect({ host: "127.0.0.1", port, targetId: "grant-4", brokerControl });
    assert.equal(session.capabilities.cpuHistory, "absent");
    await stockDisconnect(session);
  });
});

test("stockConnect: cpuhistory error code 0x8f (CMD_FAILURE) maps to capabilities.cpuHistory === 'not_compiled_in'", async () => {
  await withStockStubServer(happyPathResponder({ cpuHistoryErrorCode: ErrorCode.CmdFailure }), async (port) => {
    const { brokerControl } = makeStubBrokerControl();
    const session = await stockConnect({ host: "127.0.0.1", port, targetId: "grant-5", brokerControl });
    assert.equal(session.capabilities.cpuHistory, "not_compiled_in");
    await stockDisconnect(session);
  });
});

test("stockConnect: capability probe short-circuits when readCapabilityRecord already matches the observed version quad", async () => {
  const seenCommands: number[] = [];
  await withStockStubServer(
    happyPathResponder({ onRequest: (req) => seenCommands.push(req.commandType) }),
    async (port) => {
      const { brokerControl } = makeStubBrokerControl();
      const session = await stockConnect({
        host: "127.0.0.1",
        port,
        targetId: "grant-6",
        brokerControl,
        deps: {
          binPath: "x64sc",
          readCapabilityRecordFn: () => ({ versionQuad: "3.9.0.0", cpuHistoryAvailable: true, stale: false }),
          writeCapabilityRecordFn: () => {
            throw new Error("writeCapabilityRecord must not run on a cache hit");
          },
        },
      });
      assert.equal(session.capabilities.cpuHistory, "available");
      assert.ok(!seenCommands.includes(CommandType.CpuHistoryGet), "a matching cached record must short-circuit the CPUHISTORY_GET probe");
      await stockDisconnect(session);
    },
  );
});

test("stockConnect: a completed handshake writes the capability record exactly once", async () => {
  await withStockStubServer(happyPathResponder({ cpuHistoryErrorCode: ErrorCode.InvalidType }), async (port) => {
    const { brokerControl } = makeStubBrokerControl();
    let writeCalls = 0;
    const session = await stockConnect({
      host: "127.0.0.1",
      port,
      targetId: "grant-7",
      brokerControl,
      deps: {
        binPath: "x64sc",
        readCapabilityRecordFn: () => null,
        writeCapabilityRecordFn: (binPath, capability) => {
          writeCalls += 1;
          assert.equal(binPath, "x64sc");
          assert.equal(capability.versionQuad, "3.9.0.0");
          assert.equal(capability.cpuHistoryAvailable, false);
        },
      },
    });
    assert.equal(writeCalls, 1);
    await stockDisconnect(session);
  });
});

test("stockConnect: ownership -- a refused claim rejects with MonitorOwnershipError naming the holder, before any binmon connect is attempted", async () => {
  await withStockStubServer(happyPathResponder(), async (port, connectionCount) => {
    const { brokerControl } = makeStubBrokerControl({
      claimOutcome: { ok: false, reason: "monitor_owned", holder: { grantId: "grant-other", claimedAt: 12345, pid: 999 } },
    });
    await assert.rejects(
      stockConnect({ host: "127.0.0.1", port, targetId: "grant-8", brokerControl }),
      (err: unknown) => {
        assert.ok(err instanceof MonitorOwnershipError);
        const ownershipErr = err as MonitorOwnershipError;
        assert.equal(ownershipErr.holderGrantId, "grant-other");
        assert.equal(ownershipErr.holderClaimedAt, 12345);
        assert.doesNotMatch(ownershipErr.message, /wedged|hung|unresponsive/i);
        return true;
      },
    );
    assert.equal(connectionCount(), 0, "a refused claim must never open a socket to the binmon port");
  });
});

test("stockConnect: ownership -- a claim timeout is reported distinctly from monitor_owned and never as MonitorOwnershipError", async () => {
  await withStockStubServer(happyPathResponder(), async (port, connectionCount) => {
    const { brokerControl } = makeStubBrokerControl({ claimOutcome: { ok: false, reason: "timeout" } });
    await assert.rejects(
      stockConnect({ host: "127.0.0.1", port, targetId: "grant-9", brokerControl }),
      (err: unknown) => {
        assert.ok(!(err instanceof MonitorOwnershipError));
        return true;
      },
    );
    assert.equal(connectionCount(), 0);
  });
});

// ===========================================================================
// Task 2: restart detection reusing MachineRestartedError
// ===========================================================================

function withTempEpochFile<T>(fn: (epochPath: string, writeEpoch: (epoch: number) => void) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "stock-connect-epoch-"));
  const epochPath = join(dir, "epoch.json");
  const writeEpoch = (epoch: number): void => {
    writeFileSync(epochPath, JSON.stringify({ epoch, spawned_at: new Date().toISOString(), pid: 1234 }));
  };
  return fn(epochPath, writeEpoch).finally(() => rmSync(dir, { recursive: true, force: true }));
}

test("stockConnect: a completed handshake records the instance's epoch as its reconnect baseline", async () => {
  await withTempEpochFile(async (epochPath, writeEpoch) => {
    writeEpoch(1);
    await withStockStubServer(happyPathResponder(), async (port) => {
      const { brokerControl } = makeStubBrokerControl();
      const session = await stockConnect({ host: "127.0.0.1", port, targetId: "grant-10", brokerControl, deps: { epochPath } });
      assert.equal(session.baselineEpoch, 1);
      await stockDisconnect(session);
    });
  });
});

test("stockReconnect: an unchanged epoch completes a fresh handshake and returns a usable client", async () => {
  await withTempEpochFile(async (epochPath, writeEpoch) => {
    writeEpoch(1);
    await withStockStubServer(happyPathResponder(), async (port) => {
      const { brokerControl } = makeStubBrokerControl();
      const session = await stockConnect({ host: "127.0.0.1", port, targetId: "grant-11", brokerControl, deps: { epochPath } });
      const reconnected = await stockReconnect(session);
      assert.notEqual(reconnected, session);
      assert.equal(reconnected.versionQuad, "3.9.0.0");
      assert.equal(reconnected.baselineEpoch, 1);
      await stockDisconnect(reconnected);
    });
  });
});

test("stockReconnect: an advanced epoch rejects with MachineRestartedError carrying the baseline and current epochs", async () => {
  await withTempEpochFile(async (epochPath, writeEpoch) => {
    writeEpoch(1);
    await withStockStubServer(happyPathResponder(), async (port) => {
      const { brokerControl } = makeStubBrokerControl();
      const session = await stockConnect({ host: "127.0.0.1", port, targetId: "grant-12", brokerControl, deps: { epochPath } });
      writeEpoch(2);
      await assert.rejects(
        stockReconnect(session),
        (err: unknown) => {
          assert.ok(err instanceof MachineRestartedError);
          const restartErr = err as MachineRestartedError;
          assert.equal(restartErr.baselineEpoch, 1);
          assert.equal(restartErr.currentEpoch, 2);
          assert.match(String(restartErr.where), /stock-connect/);
          return true;
        },
      );
    });
  });
});

test("stockReconnect: no epoch can be read at all rejects with MachineRestartedError -- identity that cannot be proven is not proven", async () => {
  const dir = mkdtempSync(join(tmpdir(), "stock-connect-epoch-missing-"));
  const missingEpochPath = join(dir, "does-not-exist.json");
  try {
    await withStockStubServer(happyPathResponder(), async (port) => {
      const { brokerControl } = makeStubBrokerControl();
      const session = await stockConnect({ host: "127.0.0.1", port, targetId: "grant-13", brokerControl, deps: { epochPath: missingEpochPath } });
      assert.equal(session.baselineEpoch, null);
      await assert.rejects(stockReconnect(session), (err: unknown) => err instanceof MachineRestartedError);
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("stockReconnect: MachineRestartedError is distinguishable via instanceof from StockConnectionClosedError and StockRequestTimeoutError", () => {
  const restarted = new MachineRestartedError("boom", { baselineEpoch: 1, currentEpoch: 2, where: "stock-connect.ts:stockReconnect" });
  const closed = new StockConnectionClosedError("boom", { port: 1, abandoned: 0, trigger: "close" });
  const timedOut = new StockRequestTimeoutError("boom", { requestId: 1, commandType: 0x81, elapsedMs: 10 });
  assert.ok(restarted instanceof MachineRestartedError);
  assert.ok(!(restarted instanceof StockConnectionClosedError));
  assert.ok(!(restarted instanceof StockRequestTimeoutError));
  assert.ok(closed instanceof StockConnectionClosedError);
  assert.ok(!(closed instanceof MachineRestartedError));
  assert.ok(timedOut instanceof StockRequestTimeoutError);
  assert.ok(!(timedOut instanceof MachineRestartedError));
});

test("stockConnect: a restarted machine's replaced binary re-validates the capability record against the freshly observed version quad", async () => {
  let currentVersion = [3, 9, 0, 0];
  const writeCalls: Array<{ versionQuad: string; cpuHistoryAvailable: boolean }> = [];
  await withStockStubServer(
    (req) => {
      const responder = happyPathResponder({ cpuHistoryErrorCode: ErrorCode.InvalidType, version: currentVersion });
      return responder(req);
    },
    async (port) => {
      const { brokerControl } = makeStubBrokerControl();
      const deps = {
        binPath: "x64sc",
        // Simulates backend-detect.mts's on-disk cache still holding the
        // PRE-restart build's answer -- readCapabilityRecord()'s own
        // staleness comparison (observedVersionQuad vs. stored versionQuad)
        // is exercised here for real, not stubbed away.
        readCapabilityRecordFn: (_binPath: string, capDeps: { observedVersionQuad?: string } = {}) => ({
          versionQuad: "3.9.0.0",
          cpuHistoryAvailable: false,
          stale: capDeps.observedVersionQuad !== undefined && capDeps.observedVersionQuad !== "3.9.0.0",
        }),
        writeCapabilityRecordFn: (_binPath: string, capability: { versionQuad: string; cpuHistoryAvailable: boolean }) => {
          writeCalls.push(capability);
        },
      };
      const first = await stockConnect({ host: "127.0.0.1", port, targetId: "grant-14", brokerControl, deps });
      assert.equal(first.versionQuad, "3.9.0.0");
      assert.equal(writeCalls.length, 0, "a matching cached record must short-circuit the probe on the first connect too");
      await stockDisconnect(first);

      // The "replaced binary" -- a fresh VICE_INFO now reports a different
      // version quad than the cache remembers.
      currentVersion = [4, 0, 0, 0];
      const second = await stockConnect({ host: "127.0.0.1", port, targetId: "grant-14", brokerControl, deps });
      assert.equal(second.versionQuad, "4.0.0.0");
      assert.equal(writeCalls.length, 1, "a stale cached record (different version quad) must re-run the capability probe");
      assert.equal(writeCalls[0]!.versionQuad, "4.0.0.0");
      await stockDisconnect(second);
    },
  );
});
