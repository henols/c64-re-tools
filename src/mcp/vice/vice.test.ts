// node:test coverage of vice.ts's serverInfo() deny-list stripping --
// rescued from vice-pool.test.mjs (quick-260730 series) before that file is
// deleted wholesale in plan 04. vice.ts's LIBRARY exports (call(),
// useInstance(), serverInfo(), activeInstance(), DENY_LIST) survive D-02/
// D-05 -- only the CLI subcommand surface (including formatToolsOutput(),
// which has no caller left once the CLI is deleted) goes with the pool
// subsystem's deletion in plan 04. Nothing here imports vice-pool.mjs or
// vice-session.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { useInstance, serverInfo, activeInstance, mcpHost } from "./vice.ts";
import type { ContainerGuardDeps } from "./container-guard.mts";

const HERE = dirname(fileURLToPath(import.meta.url));

test("serverInfo() strips DENY_LIST tools from discovery: a server that advertises vice_disk_list yields a payload with no trace of it, in the object and in a JSON dump alike", async () => {
  // A stub speaking just enough MCP to answer initialize + tools/list. The
  // server deliberately DOES advertise the forbidden tool -- the property
  // under test is that the seam removes it, not that the server hides it.
  const srv = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      const msg = JSON.parse(body);
      const result =
        msg.method === "initialize"
          ? { protocolVersion: "2024-11-05" }
          : {
              tools: [
                { name: "vice_ping", description: "Ping the server" },
                { name: "vice_disk_list", description: "List files on a disk" },
                { name: "vice_memory_read", description: "Read memory" },
              ],
            };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }));
    });
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", () => r()));
  const port = (srv.address() as AddressInfo).port;

  // Captured before mutating the seam, so it can be restored in `finally`
  // without depending on vice-pool.mjs's DEFAULT_PORT/instanceFor (both
  // deleted per D-02) -- activeInstance()/useInstance() are the whole
  // surviving public contract for redirecting and restoring the seam.
  const originalInstance = activeInstance();
  try {
    // epochFile is required by UseInstanceOptions (Phase 01.6.1-05's
    // cost-free strict-mode tightening, matching Plan 03/04's own
    // resourcesStatus()/containerizeRecord() precedent): no real production
    // caller ever omits it (vice-proxy.mjs's own useInstance() call always
    // supplies port/url/epochFile together), so this test now passes the
    // untouched originalInstance's epochFile through rather than letting the
    // seam's activeEpochFile silently become undefined for the test's
    // duration -- zero behavior change for this test's own assertions
    // (epochFile is never read below), and the type surface stays honest.
    useInstance({ port, url: `http://127.0.0.1:${port}/mcp`, epochFile: originalInstance.epochFile });
    const info = (await serverInfo()) as { tools: Array<{ name: string }> };
    const names = info.tools.map((t) => t.name);

    assert.ok(!names.includes("vice_disk_list"), "the forbidden tool must not survive discovery");
    assert.deepEqual(names, ["vice_ping", "vice_memory_read"], "every other tool passes through untouched");

    // "in the JSON dump alike": plain JSON.stringify() of the SAME payload
    // serverInfo() returns, not formatToolsOutput()'s --json rendering --
    // that CLI-only helper has no caller left once vice.ts's CLI is deleted
    // per D-05 (plan 04), so this rescue does not depend on it surviving.
    assert.ok(!JSON.stringify(info).includes("vice_disk_list"), "the forbidden tool must not survive a JSON dump of the payload either");
  } finally {
    srv.close();
    useInstance(originalInstance);
  }
});

// ---------------------------------------------------------------------------
// 01.6.2-09 (T-01.6.2-54): three of the four prose instructions that used to
// tell an agent to run the retiring per-instance supervisor
// (tools/vice-supervisor.sh) on the host live in this file -- rpc()'s
// timeout catch, withReconnect()'s exhausted-retry throw, and
// assertSameMachine()'s no-evidence throw. Driving any of them live would
// mean forcing a real transport failure through the FULL retry-with-backoff
// ladder (RECONNECT_BACKOFF_MS sums to 49s, none of it overridable by a
// test), so each is asserted STRUCTURALLY instead -- the same idiom
// vice-proxy.test.ts's own "structural: ..." tests already use for a
// message builder's text without invoking it live. Each regex is scoped to
// the SPECIFIC message text (not the whole file), because vice.ts's
// EPOCH_FILE comment deliberately still names vice-supervisor.sh as an
// out-of-scope, separately-tracked staleness (see the plan's own SUMMARY).
// ---------------------------------------------------------------------------

const VICE_TS_SRC = readFileSync(join(HERE, "vice.ts"), "utf8");

test("structural: rpc()'s timeout-catch message names the surviving launcher and describes on-demand launch plus respawn", () => {
  const match = VICE_TS_SRC.match(/`\$\{method\} timed out after[\s\S]*?\);/);
  assert.ok(match, "expected to find rpc()'s timeout-catch ViceError message in vice.ts");
  const msg = match![0];
  assert.match(msg, /tools\/vice-launcher\.sh/, "must name the surviving launcher");
  assert.doesNotMatch(msg, /vice-supervisor\.sh/, "must not still name the retiring per-instance supervisor");
  assert.match(msg, /on[- ]demand/i, "must describe the broker's on-demand launch");
  assert.match(msg, /respawn/i, "must describe the broker respawning a crashed instance");
});

test("structural: withReconnect()'s exhausted-retry message names the surviving launcher and describes on-demand launch plus respawn", () => {
  const match = VICE_TS_SRC.match(/`\$\{toolName\} failed after[\s\S]*?\);/);
  assert.ok(match, "expected to find withReconnect()'s exhausted-retry ViceError message in vice.ts");
  const msg = match![0];
  assert.match(msg, /tools\/vice-launcher\.sh/, "must name the surviving launcher");
  assert.doesNotMatch(msg, /vice-supervisor\.sh/, "must not still name the retiring per-instance supervisor");
  assert.match(msg, /on[- ]demand/i, "must describe the broker's on-demand launch");
  assert.match(msg, /respawn/i, "must describe the broker respawning a crashed instance");
});

test("structural: assertSameMachine()'s no-evidence message names the surviving launcher", () => {
  const match = VICE_TS_SRC.match(/a reconnect happened and identity could not be proven[\s\S]*?\);/);
  assert.ok(match, "expected to find assertSameMachine()'s no-evidence MachineRestartedError message in vice.ts");
  const msg = match![0];
  assert.match(msg, /tools\/vice-launcher\.sh/, "must name the surviving launcher");
  assert.doesNotMatch(msg, /vice-supervisor\.sh/, "must not still name the retiring per-instance supervisor");
});

// ---------------------------------------------------------------- mcpHost()
//
// mcpHost() must be CONTAINER-AWARE: "host.docker.internal" is published into
// the container by devcontainer.json's --add-host and does not resolve on the
// host, so a single unconditional answer is wrong for one of the two
// environments this tree runs in. Both branches are driven through INJECTED
// deps, so the non-container branch is provable from inside this container --
// no test may depend on the environment it happens to run in.

/** Deps fixture with every container signal CLEAR, mirroring
 * container-guard.test.ts's own helper. */
function hostDeps(overrides: Partial<ContainerGuardDeps> = {}): ContainerGuardDeps {
  return {
    fileExists: () => false,
    readFile: () => {
      throw new Error("readFile should not be called when fileExists is false");
    },
    env: {},
    runSystemdDetectVirt: () => null,
    ...overrides,
  };
}

/** Runs `fn` with VICE_MCP_HOST set to `value` (or deleted when null),
 * restoring the previous value afterward. */
function withMcpHostEnv<T>(value: string | null, fn: () => T): T {
  const saved = process.env.VICE_MCP_HOST;
  if (value === null) delete process.env.VICE_MCP_HOST;
  else process.env.VICE_MCP_HOST = value;
  try {
    return fn();
  } finally {
    if (saved === undefined) delete process.env.VICE_MCP_HOST;
    else process.env.VICE_MCP_HOST = saved;
  }
}

test("mcpHost(): inside a container resolves to the bridge alias host.docker.internal", () => {
  withMcpHostEnv(null, () => {
    assert.equal(mcpHost(hostDeps({ fileExists: (p) => p === "/.dockerenv" })), "host.docker.internal");
  });
});

test("mcpHost(): on a host resolves to 127.0.0.1, never the Docker-only alias that would not resolve there", () => {
  withMcpHostEnv(null, () => {
    const resolved = mcpHost(hostDeps());
    assert.equal(resolved, "127.0.0.1");
    assert.notEqual(resolved, "host.docker.internal");
    // 127.0.0.1 rather than "localhost" is deliberate: "localhost" can resolve
    // to ::1 first, and the broker binds 0.0.0.0 (IPv4 only), so an IPv6
    // loopback connect would be refused by a listener that IS running.
    assert.notEqual(resolved, "localhost");
  });
});

test("mcpHost(): an explicit VICE_MCP_HOST override beats BOTH branches", () => {
  withMcpHostEnv("10.1.2.3", () => {
    assert.equal(mcpHost(hostDeps()), "10.1.2.3");
    assert.equal(mcpHost(hostDeps({ fileExists: (p) => p === "/.dockerenv" })), "10.1.2.3");
  });
});
