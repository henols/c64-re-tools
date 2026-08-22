// A focused, non-hanging sibling to vice-proxy.test.ts (which HANGS and must
// never be run -- see that file's own header and test-gate.mjs's
// MANUAL_ONLY_TESTS list). This file asserts ONLY on vice_ping's response
// shape via stock-dispatch.ts's real dispatchStock()/handlePing() -- no
// broker process, no emulator, no MCP server -- matching stock-dispatch.test.ts's
// own offline convention.
//
// WHY THIS FILE EXISTS (2026-08-19 finding, closed Phase 15 plan 15-09):
// `vice_ping`'s `resolvedBinaryPath` field is a one-time, MCP-server-startup
// PATH probe (`vice-proxy.ts`'s `ACTIVE_BACKEND`), independent of which
// binary the broker actually leased for a given request. The fix landed here
// is documentation, not a per-request requery (deliberately rejected --
// requerying the broker's launch record per request is a real behavioural
// change out of a disposition phase's remit). This test pins the additive,
// backward-compatible `resolvedBinaryPathScope` sibling field that carries
// that qualification into the response itself, so the honesty cannot be
// silently dropped by a future edit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { dispatchStock, clearHeldStockSession, type StockDispatchDeps } from "./stock-dispatch.ts";
import type { StockConnectSession } from "./stock-connect.ts";
import type { HeldLease, BrokerControlSession } from "./vice-broker-client.ts";

const STUB_BROKER_CONTROL = {
  claimMonitor: async () => ({ ok: true as const }),
  releaseMonitor: async () => ({ ok: true as const }),
} as unknown as BrokerControlSession;

function makeLease(opts: { host: string; port: number; targetId: string }): HeldLease {
  return {
    host: opts.host,
    port: opts.port,
    targetId: opts.targetId,
    brokerControl: STUB_BROKER_CONTROL,
    epochFile: "",
    supervisorDir: "",
  };
}

function fakeSession(opts: { host: string; port: number; targetId: string }): StockConnectSession {
  const client = Object.assign(new EventEmitter(), {
    connected: true,
    disconnect: async (): Promise<void> => {
      client.connected = false;
    },
  });
  return {
    client: client as unknown as StockConnectSession["client"],
    versionQuad: "3.9.0",
    capabilities: { cpuHistory: "absent" },
    host: opts.host,
    port: opts.port,
    targetId: opts.targetId,
    brokerControl: STUB_BROKER_CONTROL,
    deps: {},
    baselineEpoch: null,
  };
}

async function pingPayload(deps: Partial<StockDispatchDeps> = {}): Promise<Record<string, unknown>> {
  clearHeldStockSession();
  const lease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-ping-scope" });
  const fullDeps: StockDispatchDeps = {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => fakeSession(opts),
    resolvedBinaryPath: "/opt/vice/bin/x64sc",
    resolvedBinaryPathIsResolved: true,
    ...deps,
  };
  const result = await dispatchStock("vice_ping", {}, fullDeps);
  assert.equal(result.isError, false, "vice_ping must not error against a stubbed session");
  return JSON.parse((result as { content: { text: string }[] }).content[0]!.text);
}

test("vice_ping's response carries a resolvedBinaryPathScope field qualifying resolvedBinaryPath as a startup-time probe", async () => {
  const payload = await pingPayload();
  assert.equal(typeof payload.resolvedBinaryPathScope, "string");
  const scope = payload.resolvedBinaryPathScope as string;
  assert.match(scope, /startup/i, "must name the startup-time nature of the probe");
  assert.match(scope, /broker/i, "must point to the broker's own launch record as the authoritative alternative");
  assert.match(scope, /vice_bin/, "must name epoch.json's vice_bin field as the authoritative per-instance answer");
});

test("vice_ping's response shape stays backward-compatible: the existing resolvedBinaryPath field is unchanged", async () => {
  const payload = await pingPayload();
  assert.equal(payload.resolvedBinaryPath, "/opt/vice/bin/x64sc");
  assert.equal(payload.resolvedBinaryPathIsResolved, true);
  assert.equal(payload.backend, "stock");
});
