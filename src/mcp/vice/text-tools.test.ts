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

import { handleDeviceConsole, handleWarpSet } from "./text-tools.ts";
import type { StockDispatchDeps } from "./stock-dispatch.ts";
import type { StockConnectBrokerControl } from "./stock-connect.ts";
import { currentChannelLockHolder, channelLockRefusalMessage, resetChannelLockForTests, acquireChannelLock } from "./channel-lock.ts";
import type { HeldLease } from "./vice-broker-client.ts";

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
 * makeStubBrokerControl() shape. */
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
