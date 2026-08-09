// node:test coverage of vice-probe.mjs's single-shot, short-timeout,
// no-ladder liveness check -- rescued from vice-pool.test.mjs
// (quick-260730-p5x Task 1) before that file is deleted wholesale in
// plan 04. vice-probe.mjs SURVIVES D-02/D-05 unchanged.
//
// Every test here drives a real node:http stub server on an ephemeral,
// loopback (127.0.0.1) port; only the final "dead default endpoint" timing
// test touches the real host VICE endpoint, and it asserts ONLY on elapsed
// time, never on the verdict. These stand-in servers are loopback HTTP
// inside THIS test process -- they are not a route to the emulator and must
// never become one: mcp__vice__* remains the only way to reach VICE, and
// nothing here dials a real instance. Nothing here imports vice-pool.mjs or
// vice-session.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { probeInstance, probeAll, PROBE_TOOL, DEFAULT_PROBE_TIMEOUT_MS } from "./vice-probe.ts";

type StubHandler = (req: IncomingMessage, res: ServerResponse) => void;

/** Start a stub http server driven by `handler(req, res)`, run `fn(port)`
 * against it, then shut down -- closeAllConnections() BEFORE close() so a
 * hanging-response test (a handler that never calls res.end()) cannot wedge
 * the suite waiting for a socket that will never close on its own. */
async function withStubServer<T>(handler: StubHandler, fn: (port: number) => Promise<T>): Promise<T> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as AddressInfo).port;
  try {
    return await fn(port);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

/** A well-formed MCP handler: answers `initialize` with an empty result and
 * `tools/call` of vice_ping with `pingResult` (default a plausible ping
 * payload), wrapped in the same content-array shape the real seam expects. */
interface MakeMcpHandlerOptions {
  pingResult?: Record<string, unknown>;
}

function mcpHandler({ pingResult = { version: "3.10", machine: "C64SC", execution: "running" } }: MakeMcpHandlerOptions = {}): StubHandler {
  return (req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(body);
      } catch {
        parsed = {};
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      if (parsed.method === "initialize") {
        res.end(JSON.stringify({ jsonrpc: "2.0", id: parsed.id, result: {} }));
        return;
      }
      if (parsed.method === "tools/call") {
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            id: parsed.id,
            result: { content: [{ type: "text", text: JSON.stringify(pingResult) }] },
          })
        );
        return;
      }
      res.end(JSON.stringify({ jsonrpc: "2.0", id: parsed.id, result: {} }));
    });
  };
}

/** An ephemeral port that is bound and immediately released -- nothing is
 * listening there for the probe to reach, giving a real ECONNREFUSED. */
async function freeEphemeralPort(): Promise<number> {
  return new Promise((resolve) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const p = (s.address() as AddressInfo).port;
      s.close(() => resolve(p));
    });
  });
}

test("PROBE_TOOL is the frozen constant vice_ping", () => {
  assert.equal(PROBE_TOOL, "vice_ping");
});

test("probeInstance: a stub server answering a well-formed vice_ping payload reports alive:true with the parsed ping result and an elapsed-ms figure", async () => {
  await withStubServer(mcpHandler(), async (port) => {
    const verdict = await probeInstance({ url: `http://127.0.0.1:${port}/mcp`, port });
    assert.equal(verdict.alive, true);
    assert.equal(verdict.port, port);
    assert.equal(verdict.reason, null);
    assert.equal((verdict.ping as Record<string, unknown>).version, "3.10");
    assert.ok(Number.isFinite(verdict.ms) && verdict.ms >= 0);
  });
});

test("probeInstance: nothing listening on the port reports alive:false fast, with a reason carrying the underlying cause code (ECONNREFUSED)", async () => {
  const freePort = await freeEphemeralPort();
  const start = Date.now();
  const verdict = await probeInstance({ url: `http://127.0.0.1:${freePort}/mcp`, port: freePort, timeoutMs: 1500 });
  const elapsedMs = Date.now() - start;
  assert.equal(verdict.alive, false);
  assert.match(verdict.reason!, /ECONNREFUSED/);
  assert.ok(elapsedMs < 1500, `expected a fast refusal, took ${elapsedMs}ms`);
});

test("probeInstance: a stub that accepts the connection and never responds reports alive:false with a timeout reason, elapsed bounded by timeoutMs plus slack -- never the ~50s a retry ladder would cost", async () => {
  await withStubServer(
    () => {
      // Never call res.end() or res.write() -- the connection is accepted
      // but nothing is ever sent back.
    },
    async (port) => {
      const start = Date.now();
      const verdict = await probeInstance({ url: `http://127.0.0.1:${port}/mcp`, port, timeoutMs: 300 });
      const elapsedMs = Date.now() - start;
      assert.equal(verdict.alive, false);
      assert.match(verdict.reason!, /timeout|300/i);
      assert.ok(
        elapsedMs < 3000,
        `expected elapsed time bounded by timeoutMs plus slack, took ${elapsedMs}ms -- never the ~50s a retry ladder would cost`
      );
    }
  );
});

test("probeInstance: a stub answering HTTP 500 reports alive:false with a reason saying what was wrong", async () => {
  await withStubServer(
    (req, res) => {
      req.on("data", () => {});
      req.on("end", () => {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end("internal error");
      });
    },
    async (port) => {
      const verdict = await probeInstance({ url: `http://127.0.0.1:${port}/mcp`, port });
      assert.equal(verdict.alive, false);
      assert.match(verdict.reason!, /500/);
    }
  );
});

test("probeInstance: a stub answering HTTP 200 with something that is not a ping result reports alive:false -- something else listening is not the same as VICE being up (T-p5x-04)", async () => {
  await withStubServer(
    (req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = {};
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        if (parsed.method === "initialize") {
          res.end(JSON.stringify({ jsonrpc: "2.0", id: parsed.id, result: {} }));
          return;
        }
        // tools/call answered, but with something that decodes fine yet has
        // no "version" field -- e.g. some other HTTP service on that port.
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            id: parsed.id,
            result: { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] },
          })
        );
      });
    },
    async (port) => {
      const verdict = await probeInstance({ url: `http://127.0.0.1:${port}/mcp`, port });
      assert.equal(verdict.alive, false);
      assert.match(verdict.reason!, /version/);
    }
  );
});

test("probeAll: four hanging stub endpoints probed together finish in about one timeout, not four -- proof the candidates go out concurrently (D-3)", async () => {
  const hangingHandler = () => {
    /* never respond */
  };
  const servers = await Promise.all(
    Array.from({ length: 4 }, () => {
      return new Promise<Server>((resolve) => {
        const s = createServer(hangingHandler);
        s.listen(0, "127.0.0.1", () => resolve(s));
      });
    })
  );
  try {
    const instances = servers.map((s) => ({
      port: (s.address() as AddressInfo).port,
      url: `http://127.0.0.1:${(s.address() as AddressInfo).port}/mcp`,
    }));
    const start = Date.now();
    const { results, byPort } = await probeAll(instances, { timeoutMs: 300 });
    const elapsedMs = Date.now() - start;
    assert.equal(results.length, 4);
    assert.ok(results.every((r) => r.alive === false));
    assert.equal(byPort.size, 4);
    // Serial cost would be ~4*300=1200ms; concurrent cost is ~300ms plus
    // slack -- comfortably under the serial sum proves the fan-out.
    assert.ok(elapsedMs < 900, `expected concurrent cost well under the 1200ms serial sum, took ${elapsedMs}ms`);
  } finally {
    for (const s of servers) {
      s.closeAllConnections();
      await new Promise((resolve) => s.close(resolve));
    }
  }
});

test("probeInstance never throws: a dead-port failure is a verdict object, not an exception", async () => {
  const freePort = await freeEphemeralPort();
  await assert.doesNotReject(probeInstance({ url: `http://127.0.0.1:${freePort}/mcp`, port: freePort, timeoutMs: 500 }));
});

test("probeInstance: probing the real default (currently down) endpoint completes in under 3 seconds whatever the verdict -- THE assertion that D-3 was implemented rather than the resilient path reused", async () => {
  // PORT TRIAGE (01.6.2-09, D-18): 6510 here is kept, not an oversight -- it
  // is vice.ts's own DEFAULT_ENDPOINT/activePort fallback, the reserved
  // human-band (6510-6599) value this test drives against, never a
  // broker-allocated one (that band moved to 6600+, DEFAULT_BASE_PORT in
  // broker-state.mts).
  const url = process.env.VICE_MCP_URL || "http://host.docker.internal:6510/mcp";
  const start = Date.now();
  const verdict = await probeInstance({ url, port: 6510, timeoutMs: DEFAULT_PROBE_TIMEOUT_MS });
  const elapsedMs = Date.now() - start;
  // Assert ONLY on elapsed time -- the endpoint's liveness is not under this
  // repo's control (see .planning/STATE.md's HARD BLOCKER entry), but the
  // bound on how long a verdict takes is exactly what this task delivers.
  assert.ok(
    elapsedMs < 3000,
    `expected a verdict (either way) in under 3s -- never the ~50s a retry ladder would cost, took ${elapsedMs}ms`
  );
  assert.equal(typeof verdict.alive, "boolean");
});
