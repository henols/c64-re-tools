// node:test coverage of vice-proxy.mjs's stdio-MCP-server half, driven as a
// REAL spawned child process (matching vice-pool.test.mjs's own idiom: real
// subprocess, no module-boundary mocking) with an in-process node:http
// stand-in standing in for the host VICE MCP server. This is what makes the
// phase verifiable with the host emulator completely down -- see
// 01.1-RESEARCH.md's Validation Architecture and this project's own
// STATE.md HARD BLOCKER history for why that property matters here
// specifically.
//
// Coverage note for plan 01.1-03 (never-throw hardening task): the two
// tracer-era tests immediately below do NOT directly trigger
// `process.on('uncaughtException', ...)` or an EPIPE on `process.stdout`'s
// `'error'` listener -- both handlers are installed in vice-proxy.mjs and
// exercised only incidentally (by staying silent) here. Dedicated coverage
// for those two handlers, plus the full JSON-RPC error-code matrix and the
// never-cache-a-negative-result property, lives in the "never-throw"/
// "never-cache" tests further down this file (plan 01.1-03 task 1) -- this
// section EXTENDS the harness rather than duplicating it.
//
// Coverage note for plan 01.2-01 (broker teardown task): every `finally`
// block's cleanup call is `proxy.child.kill("SIGKILL")`, not a bare
// `kill()` -- a NON-assertion change, made necessary by this task's own
// change to vice-proxy.mjs. Registering `process.on("SIGTERM", ...)` (this
// task's teardown handler) suppresses Node's default SIGTERM-terminates
// behaviour, and the handler itself deliberately never calls
// `process.exit()` (see that handler's own comment in vice-proxy.mjs) --
// in production the client's own ladder escalates to an unhandleable
// SIGKILL ~490ms after the first signal, and a plain `kill()` in a test's
// cleanup has to play that same role or the child is left running,
// hanging the file on a dangling stdio pipe. No assertion anywhere in
// this file was altered by this change.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo, Socket, Server as NetServer } from "node:net";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { tmpdir, networkInterfaces } from "node:os";
import { hostPath } from "./hostpath.ts";
import { repoRoot } from "./repo-root.ts";
// The real, live DENY_LIST -- imported (not re-hardcoded) so the full-manifest
// parity test below stays correct as 01.4-01 grows this array task by task,
// rather than drifting the moment a second entry (tools_list, this plan) is
// added and this file's own copy is not updated in lockstep.
import { DENY_LIST } from "./vice.ts";
// Read-only import for test assertions only -- this test file does not
// modify vice-broker-client.ts's own content; ACQUIRE_TIMEOUT_MS (the
// control-plane client's own acquire deadline, replacing the retiring
// pollGrant()'s ACQUIRE_TIMEOUT_MS in this role) is already exported for
// exactly this purpose.
import { ACQUIRE_TIMEOUT_MS } from "./vice-broker-client.ts";
// Plan 01.6.2-07: the proxy's acquisition/release/recycle paths now run over
// the TCP control plane instead of the file protocol, so this file drives a
// REAL control listener (broker-control.mts's own startControlListener(),
// the exact module the proxy's client speaks to) instead of writing
// request/grant/denial/lease/ack files -- matching the idiom
// vice-broker-client.test.ts's own startFullBrokerListener() already
// established for the client side.
import { startControlListener, newControlToken, type AcquireOutcome, type RecycleOutcome } from "./broker-control.mts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROXY_PATH = join(HERE, "vice-proxy.ts");

// ---------------------------------------------------------------------------
// Shared test-local types. vice-proxy.ts exports nothing (it is a stdio
// entry point, spawned as a subprocess or driven over a bare HTTP stand-in --
// never imported), so there are no production types to reuse at this
// boundary; these are declared once here rather than left for every helper
// below to re-infer its own shape. `params`/`result` on the JSON-RPC
// envelope stay deliberately `any`: each MCP method's payload has its own
// shape and this file's whole job is asserting on that variation, so a
// precise union would either duplicate vice-proxy.ts's own (unexported)
// internal interfaces or fight the test's own dynamic fixtures for no
// behavioural benefit. See 01.6.1-08-SUMMARY.md's Decisions section.
// ---------------------------------------------------------------------------
interface JsonRpcMessage {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: any;
  result?: any;
  error?: { code: number; message?: string };
  /** Set only by startProxy()'s own stdout-line parser when a line fails to
   * parse as JSON -- never sent or received over the wire, but a genuine
   * shape this file's own "stdout carries only valid JSON-RPC" guard reads. */
  __parseError?: string;
  __raw?: string;
}

interface ProxyHandle {
  child: ChildProcessWithoutNullStreams;
  send(msg: JsonRpcMessage): void;
  sendRaw(line: string): void;
  messages: JsonRpcMessage[];
  nextMessage(timeoutMs?: number): Promise<JsonRpcMessage>;
  stderr: string[];
}

interface StandInServer {
  server: Server;
  requests: (JsonRpcMessage | null)[];
}

/** The shape every stand-in server's own `respond(name, args)` callback
 * takes -- `args` stays `any` for the same reason `params`/`result` do
 * above (each tool's own argument shape differs per fixture). */
type RespondFn = (name: string, args: any) => any;

/**
 * A minimal in-process stand-in for the host VICE MCP server. Answers
 * `initialize` (the proxy-as-client's own handshake to the host, distinct
 * from the Claude-Code-facing handshake the proxy itself answers) and
 * `tools/call` for `vice_ping`. Records every request it receives, verbatim
 * parsed, so tests can assert on exactly what reached the "host".
 */
function startStandInServer(): StandInServer {
  const requests: (JsonRpcMessage | null)[] = [];
  const server = createServer((req, res) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      let msg: JsonRpcMessage | null;
      try {
        msg = JSON.parse(body);
      } catch {
        msg = null;
      }
      requests.push(msg);

      if (msg && msg.method === "initialize") {
        const result = {
          protocolVersion: "2024-11-05",
          capabilities: {},
          serverInfo: { name: "stand-in-vice", version: "0.0.0" },
        };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }));
        return;
      }
      if (msg && msg.method === "tools/call" && msg.params && msg.params.name === "vice_ping") {
        const payload = { version: "3.10", machine: "C64SC", execution: "paused" };
        const result = { content: [{ type: "text", text: JSON.stringify(payload) }] };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: msg && "id" in msg ? msg.id : null,
          error: { code: -32601, message: "unsupported in this test's stand-in server" },
        })
      );
    });
  });
  return { server, requests };
}

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  return (server.address() as AddressInfo).port;
}

/**
 * Quick task 260801-ccn (task 2): binds `server` to a SPECIFIC address
 * rather than loopback -- the url-rewrite test needs a stub reachable ONLY
 * via the container's own non-internal IPv4 address, so a successful
 * forwarded call is only possible if the containerization inverse actually
 * rewrote the grant's loopback url to that address.
 */
async function listenOn(server: Server, host: string): Promise<number> {
  await new Promise<void>((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, host, () => resolvePromise());
  });
  return (server.address() as AddressInfo).port;
}

/** The container's first non-internal (non-loopback) IPv4 address -- what
 * makes listenOn()'s stub unreachable on loopback and reachable only via
 * the rewrite (see spike-findings-adjacent environment note in
 * this task's PLAN.md). Asserted present, never silently skipped -- a test
 * relying on this address must fail loudly if the environment lacks one,
 * not quietly pass having tested nothing. */
function firstNonInternalIPv4(): string | null {
  for (const addrs of Object.values(networkInterfaces())) {
    if (!addrs) continue;
    for (const a of addrs) {
      if (a.family === "IPv4" && !a.internal) return a.address;
    }
  }
  return null;
}

/**
 * Spawns `node vice-proxy.mjs` as a real child process and gives back a
 * small harness for line-based stdin/stdout JSON-RPC exchange, matching the
 * exact framing vice-proxy.mjs itself implements (newline-delimited, one
 * JSON value per line).
 */
function startProxy(env: Record<string, string>): ProxyHandle {
  const child = spawn(process.execPath, [PROXY_PATH], {
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"] as const,
  });

  const messages: JsonRpcMessage[] = [];
  let consumed = 0;
  let outBuf = "";

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    outBuf += chunk;
    let idx;
    while ((idx = outBuf.indexOf("\n")) !== -1) {
      const line = outBuf.slice(0, idx);
      outBuf = outBuf.slice(idx + 1);
      if (line.trim().length === 0) continue;
      let parsed: JsonRpcMessage;
      try {
        parsed = JSON.parse(line);
      } catch (e) {
        parsed = { __parseError: (e as Error).message, __raw: line };
      }
      messages.push(parsed);
    }
  });

  const stderrChunks: string[] = [];
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => stderrChunks.push(chunk));

  function send(msg: JsonRpcMessage): void {
    child.stdin.write(JSON.stringify(msg) + "\n");
  }

  function sendRaw(line: string): void {
    child.stdin.write(line + "\n");
  }

  async function nextMessage(timeoutMs = 8000): Promise<JsonRpcMessage> {
    const start = Date.now();
    while (consumed >= messages.length) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(
          `timed out waiting for a proxy stdout message (stderr so far: ${stderrChunks.join("")})`
        );
      }
      await new Promise((r) => setTimeout(r, 10));
    }
    return messages[consumed++];
  }

  return { child, send, sendRaw, messages, nextMessage, stderr: stderrChunks };
}

test("tracer: one real tool call round-trips end to end", async () => {
  const { server, requests } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });

  try {
    // 1. initialize -- must echo the requested protocolVersion, declare a
    //    tools capability, and touch the host ZERO times.
    proxy.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "claude-code", version: "test" },
      },
    });
    const initResp = await proxy.nextMessage();
    assert.equal(initResp.id, 1);
    assert.equal(initResp.result.protocolVersion, "2025-06-18", "must echo the client's requested protocolVersion when supported");
    assert.ok(
      initResp.result.capabilities && initResp.result.capabilities.tools,
      "initialize result must declare a tools capability"
    );
    assert.equal(requests.length, 0, "initialize must make zero requests to the stand-in host");

    // 2. notifications/initialized -- a notification: no response at all.
    proxy.send({ jsonrpc: "2.0", method: "notifications/initialized" });

    // 3. tools/list -- still zero host requests, per criterion 4 (tracer scope).
    proxy.send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const listResp = await proxy.nextMessage();
    assert.equal(listResp.id, 2);
    assert.ok(Array.isArray(listResp.result.tools), "tools/list result must carry a tools array");
    assert.equal(
      requests.length,
      0,
      "initialize AND tools/list together must make zero requests to the stand-in host"
    );

    // 4. tools/call for vice_ping -- the one real round trip this tracer proves.
    proxy.send({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "vice_ping", arguments: {} },
    });
    const callResp = await proxy.nextMessage();
    assert.equal(callResp.id, 3);
    assert.equal(callResp.result.isError, false, "a successful tool call must report isError: false");
    assert.equal(callResp.result.content[0].type, "text");
    const payload = JSON.parse(callResp.result.content[0].text);
    assert.equal(payload.version, "3.10", "the stand-in server's own payload must round-trip back out");

    // Two tools/call requests reach the stand-in server, not one: plan
    // 01.1-03's pre-flight liveness probe (probeInstance()) does its own
    // vice_ping round trip BEFORE the real forwarded call -- see that
    // plan's SUMMARY for the coverage-affecting change this represents.
    const toolCallsSeen = requests.filter((r) => r && r.method === "tools/call") as JsonRpcMessage[];
    assert.equal(
      toolCallsSeen.length,
      2,
      "the stand-in server must have received the liveness probe's ping plus the one real forwarded tools/call"
    );
    assert.ok(toolCallsSeen.every((r) => r.params.name === "vice_ping"));

    // 5. The proxy process must still be alive and answering -- this is the
    //    whole point of the never-throw discipline (finding 7: a dead stdio
    //    server is never reconnected).
    assert.equal(proxy.child.exitCode, null, "the proxy process must still be running");
    assert.equal(proxy.child.killed, false);
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

test("stdout carries only valid JSON-RPC messages", async () => {
  const { server } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });

  try {
    proxy.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "claude-code", version: "test" } },
    });
    await proxy.nextMessage();

    proxy.send({ jsonrpc: "2.0", method: "notifications/initialized" });

    proxy.send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    await proxy.nextMessage();

    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    await proxy.nextMessage();

    // A deliberately malformed raw line. Plan 01.6.3-02 (D-01) note: the
    // retired hand-rolled handleLine() always answered this with a
    // JSON-RPC parse-error RESPONSE (-32700, id: null). The SDK's own
    // StdioServerTransport/Protocol.connect() (read directly from their
    // compiled source this session, not their docs) instead route a
    // JSON.parse/schema-parse failure to `onerror` ONLY -- no wire response
    // is written for it at all. This is a genuine, disclosed wire-level
    // narrowing from the swap, not a crash: what this test can still prove
    // is that the malformed line produces no non-frame byte on stdout and
    // that the proxy is still alive and answering immediately afterward.
    proxy.sendRaw("not valid json{{{");

    // An unknown method -- still a genuine, well-formed JSON-RPC request;
    // the SDK's own Protocol answers request-handler-lookup misses with
    // MethodNotFound exactly like the retired handleMessage() did, so this
    // assertion is unchanged.
    proxy.send({ jsonrpc: "2.0", id: 4, method: "something/unknown", params: {} });
    const unknownResp = await proxy.nextMessage();
    assert.equal(unknownResp.error && unknownResp.error.code, -32601);

    // The durable guard itself: every line collected across this whole
    // session -- covering initialize, tools/list, tools/call, and an
    // unknown method (the malformed line above drew no response, per the
    // note above) -- must have parsed cleanly as JSON and carry
    // jsonrpc: "2.0". This is what fails if ANY module in the import graph
    // (vice.ts and everything it transitively imports) ever leaks a stray
    // console.log onto stdout instead of stderr.
    assert.ok(proxy.messages.length >= 4, "expected at least 4 stdout messages across this session");
    for (const msg of proxy.messages) {
      assert.ok(
        !Object.prototype.hasOwnProperty.call(msg, "__parseError"),
        `a line written to stdout failed to parse as JSON: ${msg.__raw}`
      );
      assert.equal(msg.jsonrpc, "2.0", `message missing/wrong jsonrpc field: ${JSON.stringify(msg)}`);
    }
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

// -----------------------------------------------------------------------
// Plan 01.1-02 task 1: tools/list answers from a committed on-disk snapshot
// with ZERO emulator involvement, and degrades to a well-formed empty list
// on any snapshot problem rather than a fetch, a throw, or a hang.
// -----------------------------------------------------------------------

test("tools/list reads the committed snapshot with no emulator", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-manifest-"));
  const manifestFile = join(dir, "tools-manifest.json");
  const fixture = {
    generated_at: "2026-07-31T00:00:00.000Z",
    endpoint: "http://example.invalid/mcp",
    tools: [
      { name: "vice_ping", description: "ping the emulator", inputSchema: { type: "object", properties: {} } },
      {
        name: "vice_memory_read",
        description: "read a range of C64 memory",
        inputSchema: {
          type: "object",
          properties: { address: { type: "string" }, length: { type: "number" } },
          required: ["address"],
        },
      },
    ],
  };
  writeFileSync(manifestFile, JSON.stringify(fixture), "utf8");

  const { server, requests } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp`, VICE_TOOLS_MANIFEST: manifestFile });

  try {
    proxy.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
    });
    await proxy.nextMessage();

    proxy.send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const resp = await proxy.nextMessage();
    const tools = resp.result.tools;
    // Both fixture tools, PLUS the always-present synthetic
    // vice_result_continue tool (task 3), vice_recycle (plan 01.3-01) and
    // vice_diagnose (plan 01.3-02) -- tools/list never omits any synthetic tool.
    assert.equal(tools.length, 5, "both fixture tools plus all three synthetic tools must come back");

    const byName = Object.fromEntries(tools.map((t: any) => [t.name, t]));
    assert.ok(byName.vice_ping, "vice_ping must be present");
    assert.ok(byName.vice_memory_read, "vice_memory_read must be present");
    assert.deepEqual(
      byName.vice_memory_read.inputSchema,
      fixture.tools[1].inputSchema,
      "inputSchema must survive intact"
    );
    for (const t of tools) {
      assert.equal(
        typeof (t._meta && t._meta["anthropic/maxResultSizeChars"]),
        "number",
        `${t.name} must carry _meta["anthropic/maxResultSizeChars"]`
      );
    }

    assert.equal(requests.length, 0, "tools/list must make ZERO requests to the stand-in host");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("tools/list survives a missing or corrupt snapshot", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-manifest-bad-"));
  const missingPath = join(dir, "does-not-exist.json");
  const invalidJsonPath = join(dir, "invalid.json");
  writeFileSync(invalidJsonPath, "{ this is not valid JSON", "utf8");
  const wrongShapePath = join(dir, "wrong-shape.json");
  writeFileSync(wrongShapePath, JSON.stringify({ generated_at: null, endpoint: null, tools: "nope, a string" }), "utf8");

  const { server, requests } = startStandInServer();
  const port = await listen(server);

  try {
    for (const manifestFile of [missingPath, invalidJsonPath, wrongShapePath]) {
      const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp`, VICE_TOOLS_MANIFEST: manifestFile });
      try {
        proxy.send({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
        });
        await proxy.nextMessage();

        proxy.send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
        const resp = await proxy.nextMessage();
        // "Empty tools array" means empty of MANIFEST-derived tools -- the
        // always-present synthetic tools (vice_result_continue, task 3;
        // vice_recycle, plan 01.3-01; and vice_diagnose, plan 01.3-02) are
        // not sourced from the manifest at all, so a broken manifest can't
        // take any of them down with it.
        assert.deepEqual(
          resp.result.tools.map((t: any) => t.name),
          ["vice_result_continue", "vice_recycle", "vice_diagnose"],
          `expected only the synthetic tools for ${manifestFile}`
        );

        // The child must still be alive and answer a SUBSEQUENT
        // initialize-then-tools/list correctly -- a snapshot problem must
        // never strand the session.
        proxy.send({
          jsonrpc: "2.0",
          id: 3,
          method: "initialize",
          params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
        });
        const secondInit = await proxy.nextMessage();
        assert.equal(secondInit.result.protocolVersion, "2025-06-18");

        proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/list", params: {} });
        const secondList = await proxy.nextMessage();
        assert.deepEqual(secondList.result.tools.map((t: any) => t.name), ["vice_result_continue", "vice_recycle", "vice_diagnose"]);

        assert.equal(proxy.child.exitCode, null, "the proxy process must still be running");
        assert.equal(proxy.child.killed, false);
      } finally {
        proxy.child.kill("SIGKILL");
      }
    }
    assert.equal(requests.length, 0, "no manifest-read path may ever reach the stand-in host");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});

// -----------------------------------------------------------------------
// Plan 01.1-02 task 2: the deny-list is enforced at BOTH discovery
// (tools/list, above) and call time, as independent layers; and every
// forwarded tools/call brackets itself with an epoch comparison, loud and
// never cached.
//
// COVERAGE SPLIT (do not conflate the two): removing the proxy's call-time
// deny check makes "vice_disk_list is refused at tools/call with no request
// made" fail on its request-counter assertion, because the request would
// then reach the stand-in server. Removing the read-time filter in
// handleToolsList() makes "vice_disk_list is absent from tools/list" fail.
// Neither test covers both layers.
// -----------------------------------------------------------------------

test("vice_disk_list is refused at tools/call with no request made", async () => {
  const { server, requests } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });

  try {
    proxy.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
    });
    await proxy.nextMessage();

    proxy.send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "vice_disk_list", arguments: {} } });
    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, true, "vice_disk_list must always be refused");
    assert.match(resp.result.content[0].text, /vice_disk_list/);
    assert.match(resp.result.content[0].text, /host-side restart|host VICE MCP server/i);
    assert.equal(requests.length, 0, "the stand-in server's request counter must be unchanged");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

// -----------------------------------------------------------------------
// 01.4-01 task 1 (the phase's tracer): closes the generic-dispatch hole for
// the single safest slice first -- `tools_list` alone, per
// .planning/todos/pending/2026-08-05-generic-surface-deny-list-gap-tools-call-nested-vice-disk-list.md
// and 01.4-RESEARCH.md's Pattern 1 ("one array, no new mechanism"). Mirrors
// the vice_disk_list refusal test above exactly in shape: isError true, the
// message names the refused tool, and the stand-in's request counter stays
// at 0 -- proving the refusal happens before any forwarding attempt, not
// merely that the eventual forwarded call failed for some other reason.
// -----------------------------------------------------------------------

test("tools_list is refused at tools/call with no request made", async () => {
  const { server, requests } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });

  try {
    proxy.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
    });
    await proxy.nextMessage();

    proxy.send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "tools_list", arguments: {} } });
    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, true, "tools_list must always be refused");
    assert.match(resp.result.content[0].text, /tools_list/);
    assert.match(
      resp.result.content[0].text,
      /bypass|nested/i,
      "tools_list's refusal wording must name the bypass hazard shape, not the vice_disk_list crash wording verbatim"
    );
    assert.equal(requests.length, 0, "the stand-in server's request counter must be unchanged");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

test("vice_disk_list is absent from tools/list", async () => {
  // A fixture manifest that DELIBERATELY includes vice_disk_list, simulating
  // a snapshot generated by some other means -- this is what makes the
  // READ-TIME filter, not merely serverInfo()'s refresh-time filter, the
  // thing under test.
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-denylist-"));
  const manifestFile = join(dir, "tools-manifest.json");
  writeFileSync(
    manifestFile,
    JSON.stringify({
      generated_at: "2026-07-31T00:00:00.000Z",
      endpoint: "http://example.invalid/mcp",
      tools: [
        { name: "vice_ping", description: "ping", inputSchema: { type: "object", properties: {} } },
        { name: "vice_disk_list", description: "list disks", inputSchema: { type: "object", properties: {} } },
      ],
    }),
    "utf8"
  );

  const { server } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp`, VICE_TOOLS_MANIFEST: manifestFile });

  try {
    proxy.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
    });
    await proxy.nextMessage();

    proxy.send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const resp = await proxy.nextMessage();
    const names = resp.result.tools.map((t: any) => t.name);
    assert.ok(names.includes("vice_ping"), "the other fixture tool must still be present");
    assert.ok(!names.includes("vice_disk_list"), "vice_disk_list must be filtered out even from a manifest that names it");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});

// -----------------------------------------------------------------------
// Plan 01.6.3-02 (the @mastra/mcp seam swap, tracer): two must_have proofs
// this plan's own frontmatter calls out by name -- neither is covered by
// the deny-list tests above, which prove ABSENCE, not schema fidelity or
// the construction-time enforcement layer's own text.
// -----------------------------------------------------------------------

test("tools/list's vice_ping entry has an inputSchema deep-equal to the manifest's own raw schema", async () => {
  // The manifest's own raw schema for vice_ping, read independently of the
  // proxy -- not re-derived from any in-memory constant this file or
  // vice-proxy.ts shares, so a passing assertion here is genuine evidence
  // that rawJsonSchemaAsStandardSchema()'s jsonSchema.input()/output() both
  // really do return the manifest's own object verbatim, through the whole
  // createTool() -> MCPServer's own ListToolsRequestSchema handler ->
  // standardSchemaToJSONSchema() round trip -- not assumed from either
  // library's documentation.
  const manifestText = readFileSync(join(HERE, "tools-manifest.json"), "utf8");
  const manifest = JSON.parse(manifestText);
  const manifestPingSchema = manifest.tools.find((t: any) => t.name === "vice_ping").inputSchema;

  const { server } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });
  try {
    await handshake(proxy);
    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/list", params: {} });
    const resp = await proxy.nextMessage();
    const pingEntry = resp.result.tools.find((t: any) => t.name === "vice_ping");
    assert.ok(pingEntry, "vice_ping must be present in tools/list within this tracer's own registered scope");
    assert.deepEqual(
      pingEntry.inputSchema,
      manifestPingSchema,
      "the wire inputSchema for vice_ping must be byte-for-byte the manifest's own raw schema, not a re-derived or re-shaped one"
    );
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

test("structural: the construction-time tools registry itself filters DENY_LIST, not merely tools/list's wire output", () => {
  // The live tests above (and further down this file) already prove
  // DENY_LIST is absent from the WIRE tools/list response and refused at
  // tools/call -- this test proves the SOURCE-level mechanism producing
  // both is the same single filter at registry-construction time (the
  // `tools` object MCPServer's own ListToolsRequestSchema handler AND this
  // file's own CallToolRequestSchema override both read from), matching
  // this plan's own "construction-time, not read-time" framing. vice-proxy
  // .ts exports nothing and is never imported (this file's own established
  // discipline, see the header comment above) -- so this is a source-text
  // assertion, the same idiom this file already uses for the SEAM_HAZARDS
  // structural tests, rather than a runtime `Object.keys(tools)` reach-in.
  const proxySrc = readFileSync(PROXY_PATH, "utf8");
  const registryStart = proxySrc.indexOf("const tools: Record<string, ReturnType<typeof buildViceTool>> = {};");
  assert.ok(registryStart >= 0, "the tools registry construction site must be found in the source");
  const registryEnd = proxySrc.indexOf("const server = new MCPServer(", registryStart);
  assert.ok(registryEnd > registryStart, "could not isolate the registry construction block's own end");
  const registryBlock = proxySrc.slice(registryStart, registryEnd);
  assert.match(
    registryBlock,
    /DENY_LIST\.includes\(def\.name\)/,
    "the registry construction loop must filter DENY_LIST before a manifest tool ever reaches the `tools` map"
  );
});

// -----------------------------------------------------------------------
// Plan 01.6.3-03 task 2: the full-manifest parity proof. Plan 02 proved the
// wire schema was byte-identical for ONE tool (vice_ping); this extends that
// same deep-equal proof to EVERY manifest tool, plus the full name-set/order
// parity `tools/list`'s must_have calls for -- computed independently from
// tools-manifest.json, never from any in-memory constant this file or
// vice-proxy.ts shares, so a passing assertion here is genuine evidence the
// swap did not change the observable surface at full scale.
// -----------------------------------------------------------------------

test("tools/list's full output matches the manifest exactly (name set, order, schema, _meta cap) except for DENY_LIST's deliberate absence", async () => {
  const manifestText = readFileSync(join(HERE, "tools-manifest.json"), "utf8");
  const manifest = JSON.parse(manifestText);
  const DENY_LISTED = new Set(DENY_LIST);
  const expectedManifestNames = manifest.tools.map((t: any) => t.name).filter((n: string) => !DENY_LISTED.has(n));
  const expectedOrder = [...expectedManifestNames, "vice_result_continue", "vice_recycle", "vice_diagnose"];
  const manifestSchemaByName: Record<string, unknown> = Object.fromEntries(
    manifest.tools.map((t: any) => [t.name, t.inputSchema])
  );

  const { server } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });
  try {
    await handshake(proxy);
    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/list", params: {} });
    const resp = await proxy.nextMessage();
    const tools = resp.result.tools;
    const actualNames = tools.map((t: any) => t.name);

    // (a) name SET equality -- nothing missing, nothing extra, every
    // DENY_LIST entry absent, every synthetic present.
    assert.deepEqual(
      new Set(actualNames),
      new Set(expectedOrder),
      "the wire tools/list name set must be exactly the manifest (minus DENY_LIST) plus the three synthetics -- no tool missing, none extra"
    );
    // (a) ORDER parity -- manifest order preserved, synthetics appended last
    // in their own fixed order, matching [...manifestTools, RESULT_CONTINUE_TOOL,
    // RECYCLE_TOOL, DIAGNOSE_TOOL]'s insertion order (this plan's own
    // key_link).
    assert.deepEqual(actualNames, expectedOrder, "the wire tools/list order must match the manifest's own order, synthetics appended last");

    // (b) per-tool inputSchema deep-equal against the manifest's own raw
    // schema, for EVERY manifest-derived tool, not just vice_ping.
    for (const name of expectedManifestNames) {
      const wireEntry = tools.find((t: any) => t.name === name);
      assert.ok(wireEntry, `manifest tool "${name}" must be present in tools/list`);
      assert.deepEqual(
        wireEntry.inputSchema,
        manifestSchemaByName[name],
        `"${name}"'s wire inputSchema must be byte-for-byte the manifest's own raw schema`
      );
    }

    // (c) every tool entry (manifest-derived AND synthetic) carries the
    // _meta cap stamp equal to OUTPUT_CHAR_CAP (default: no override set on
    // this proxy invocation, so the proxy's own 500000 default applies).
    for (const t of tools) {
      assert.equal(
        t._meta && t._meta["anthropic/maxResultSizeChars"],
        500000,
        `"${t.name}" must carry the default output-size cap in its _meta`
      );
    }
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

test("epoch drift is reported loudly and not cached", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-epoch-"));
  const epochFile = join(dir, "epoch.json");
  writeFileSync(epochFile, JSON.stringify({ epoch: 1, pid: 111, spawned_at: "2026-07-31T00:00:00.000Z" }), "utf8");

  const { server, requests } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp`, VICE_EPOCH_FILE: epochFile });

  try {
    proxy.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
    });
    await proxy.nextMessage();

    // Call 1: establishes the baseline (epoch 1) and forwards normally.
    // Each SUCCESSFUL forwarded call now costs TWO "tools/call" requests at
    // the stand-in server, not one: the pre-flight liveness probe's own
    // vice_ping round trip, plus the real forwarded call (plan 01.1-03 task
    // 2) -- a refused-before-forwarding call (call 2 below) still costs
    // zero, since the epoch check runs BEFORE the probe.
    proxy.send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const first = await proxy.nextMessage();
    assert.equal(first.result.isError, false);
    assert.equal(requests.filter((r) => r && r.method === "tools/call").length, 2);

    // Epoch changes underneath the proxy -- a restart happened.
    writeFileSync(epochFile, JSON.stringify({ epoch: 2, pid: 222, spawned_at: "2026-07-31T00:05:00.000Z" }), "utf8");

    // Call 2: refused BEFORE forwarding -- no new request reaches the host,
    // and no probe fires either (the epoch check precedes the probe).
    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const second = await proxy.nextMessage();
    assert.equal(second.result.isError, true, "an epoch change must refuse the call");
    assert.match(second.result.content[0].text, /1/);
    assert.match(second.result.content[0].text, /2/);
    assert.equal(
      requests.filter((r) => r && r.method === "tools/call").length,
      2,
      "the drifting call must NOT have reached the stand-in server (no probe, no forward)"
    );

    // Call 3: the re-baseline took effect -- forwards normally again, at
    // the cost of two more "tools/call" requests (probe + real).
    proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const third = await proxy.nextMessage();
    assert.equal(third.result.isError, false, "the proxy must re-baseline, not cache the restart report");
    assert.equal(requests.filter((r) => r && r.method === "tools/call").length, 4);
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a missing epoch file is not a restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-epoch-absent-"));
  const epochFile = join(dir, "epoch.json"); // deliberately never written yet

  const { server, requests } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp`, VICE_EPOCH_FILE: epochFile });

  try {
    proxy.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
    });
    await proxy.nextMessage();

    proxy.send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const first = await proxy.nextMessage();
    assert.equal(first.result.isError, false, "no epoch file at all must never be treated as a restart");

    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const second = await proxy.nextMessage();
    assert.equal(second.result.isError, false);

    // The file appears for the first time -- absent-to-present is a
    // supervisor merely starting, not a restart.
    writeFileSync(epochFile, JSON.stringify({ epoch: 7 }), "utf8");

    proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const third = await proxy.nextMessage();
    assert.equal(third.result.isError, false, "absent -> present must not be reported as a restart");
    // Three successful forwarded calls, each costing two "tools/call"
    // requests at the stand-in server (the pre-flight liveness probe's own
    // vice_ping, plus the real forwarded call -- plan 01.1-03 task 2).
    assert.equal(requests.filter((r) => r && r.method === "tools/call").length, 6);
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});

// -----------------------------------------------------------------------
// Plan 01.1-02 task 3: a result larger than the declared cap comes back in
// FULL across an explicit continuation sequence -- reassembled byte-for-byte,
// served with no extra host traffic, never silently truncated.
// -----------------------------------------------------------------------

/**
 * A stand-in server that answers `initialize` normally, `vice_ping`
 * specifically with a small, recognisable ping payload, and `targetTool`
 * with the oversized `payloadText` fixture. `vice_ping` MUST be answered
 * distinctly from `targetTool`: plan 01.1-03 task 2's pre-flight liveness
 * probe always calls `vice_ping` before any real forwarded call, and if it
 * received the same oversized non-JSON blob the target tool returns, it
 * would fail probeInstance()'s "recognisable ping result" check and report
 * the host unreachable -- short-circuiting every test in this section
 * before the oversized-result logic is ever exercised.
 */
function startBigPayloadServer(payloadText: string, { targetTool = "vice_memory_read" }: { targetTool?: string } = {}): StandInServer {
  const requests: (JsonRpcMessage | null)[] = [];
  const server = createServer((req, res) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      let msg: JsonRpcMessage | null;
      try {
        msg = JSON.parse(body);
      } catch {
        msg = null;
      }
      requests.push(msg);

      if (msg && msg.method === "initialize") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            id: msg.id,
            result: { protocolVersion: "2024-11-05", capabilities: {}, serverInfo: { name: "stand-in-vice", version: "0.0.0" } },
          })
        );
        return;
      }
      if (msg && msg.method === "tools/call" && msg.params && msg.params.name === "vice_ping") {
        const pingPayload = { version: "3.10", machine: "C64SC", execution: "paused" };
        const result = { content: [{ type: "text", text: JSON.stringify(pingPayload) }] };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }));
        return;
      }
      if (msg && msg.method === "tools/call" && msg.params && msg.params.name === targetTool) {
        const result = { content: [{ type: "text", text: payloadText }] };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: msg && "id" in msg ? msg.id : null,
          error: { code: -32601, message: "unsupported in this test's stand-in server" },
        })
      );
    });
  });
  return { server, requests };
}

test("an oversized result is recoverable in full across continuations", async () => {
  // NOT valid JSON, so call()'s own JSON.parse-or-verbatim fallback hands it
  // back exactly as sent -- the cleanest possible byte-for-byte fixture.
  const bigPayload = "PAYLOAD-START-" + "abcdefghij".repeat(500) + "-PAYLOAD-END"; // 5026 chars
  const { server, requests } = startBigPayloadServer(bigPayload);
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp`, VICE_MAX_RESULT_CHARS: "1000" });

  try {
    proxy.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
    });
    await proxy.nextMessage();

    proxy.send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "vice_memory_read", arguments: {} } });
    const first = await proxy.nextMessage();
    assert.equal(first.result.isError, false);
    assert.equal(first.result.content.length, 2, "an oversized result carries a chunk item plus a marker item");
    assert.match(first.result.content[1].text, /chunk 1 of \d+/);
    assert.match(first.result.content[1].text, /vice_result_continue/);

    const tokenMatch = first.result.content[1].text.match(/"token":"([^"]+)"/);
    assert.ok(tokenMatch, "the marker must name a continuation token");
    const token = tokenMatch[1];

    let reassembled = first.result.content[0].text;
    let nextMarker = first.result.content[1].text;
    let guard = 0;
    while (!/\(last chunk\)/.test(nextMarker) && guard < 100) {
      guard += 1;
      proxy.send({
        jsonrpc: "2.0",
        id: 100 + guard,
        method: "tools/call",
        params: { name: "vice_result_continue", arguments: { token } },
      });
      const cont = await proxy.nextMessage();
      assert.equal(cont.result.isError, false);
      reassembled += cont.result.content[0].text;
      nextMarker = cont.result.content[1].text;
    }
    assert.match(nextMarker, /\(last chunk\)/, "the sequence must terminate with a last-chunk marker");

    assert.equal(reassembled, bigPayload, "reassembly must equal the original payload BYTE FOR BYTE");
    // Two "tools/call" requests reach the host, not one: the pre-flight
    // liveness probe's own vice_ping round trip, plus the one real forwarded
    // vice_memory_read call (plan 01.1-03 task 2) -- every continuation
    // chunk after that is served entirely from the proxy's local store.
    const toolCallsSeen = requests.filter((r) => r && r.method === "tools/call") as JsonRpcMessage[];
    assert.equal(
      toolCallsSeen.length,
      2,
      "continuations must be served from the proxy's store, never re-forwarded -- exactly the probe plus one real host request"
    );
    assert.ok(toolCallsSeen.some((r) => r.params.name === "vice_ping"), "the liveness probe's own ping must have reached the host");
    assert.ok(
      toolCallsSeen.some((r) => r.params.name === "vice_memory_read"),
      "the real oversized call must have reached the host exactly once"
    );
    assert.ok(
      !requests.some((r) => r && r.method === "tools/call" && r.params && r.params.name === "vice_result_continue"),
      "vice_result_continue must never appear in a request the stand-in server receives"
    );
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

test("an exhausted continuation token fails loudly", async () => {
  const bigPayload = "Z".repeat(3000);
  const { server } = startBigPayloadServer(bigPayload);
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp`, VICE_MAX_RESULT_CHARS: "1000" });

  try {
    proxy.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
    });
    await proxy.nextMessage();

    proxy.send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "vice_memory_read", arguments: {} } });
    const first = await proxy.nextMessage();
    const tokenMatch = first.result.content[1].text.match(/"token":"([^"]+)"/);
    const token = tokenMatch[1];

    // Drain every remaining chunk.
    let marker = first.result.content[1].text;
    let guard = 0;
    while (!/\(last chunk\)/.test(marker) && guard < 100) {
      guard += 1;
      proxy.send({
        jsonrpc: "2.0",
        id: 100 + guard,
        method: "tools/call",
        params: { name: "vice_result_continue", arguments: { token } },
      });
      const cont = await proxy.nextMessage();
      marker = cont.result.content[1].text;
    }

    // One more call with the SAME (now-exhausted) token.
    proxy.send({
      jsonrpc: "2.0",
      id: 999,
      method: "tools/call",
      params: { name: "vice_result_continue", arguments: { token } },
    });
    const exhausted = await proxy.nextMessage();
    assert.equal(exhausted.result.isError, true, "an exhausted token must fail loudly");
    assert.match(exhausted.result.content[0].text, /narrower range/);
    assert.equal(proxy.child.exitCode, null, "the proxy must still be alive after an exhausted-token error");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

test("tools/list declares the same cap it enforces", async () => {
  const { server } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp`, VICE_MAX_RESULT_CHARS: "12345" });

  try {
    proxy.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
    });
    await proxy.nextMessage();

    proxy.send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const resp = await proxy.nextMessage();
    assert.ok(resp.result.tools.length > 0, "tools/list must return at least the synthetic continuation tool");
    for (const t of resp.result.tools) {
      assert.equal(
        t._meta && t._meta["anthropic/maxResultSizeChars"],
        12345,
        `${t.name} must declare the SAME cap the child was started with`
      );
    }
    const continueTool = resp.result.tools.find((t: any) => t.name === "vice_result_continue");
    assert.ok(continueTool, "vice_result_continue must appear in tools/list");
    assert.ok(
      Array.isArray(continueTool.inputSchema.required) && continueTool.inputSchema.required.includes("token"),
      "vice_result_continue's inputSchema must require token"
    );
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

// Quick 260805, task 1: the failure path at vice-proxy.ts:1960 has two
// distinct hostile inputs -- a token that was issued and then drained
// ("expired", already covered above) and a token that was never issued at
// all ("unknown"). Both fall through the same `!token ||
// !CONTINUATION_STORE.has(token)` guard and the same message, but nothing
// before this test actually drove a call with a token this proxy process
// never handed out -- so this closes that gap rather than duplicating the
// exhausted-token case.
test("an unknown continuation token (never issued by this proxy) fails loudly, not silently or opaquely", async () => {
  const { server } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });

  try {
    proxy.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
    });
    await proxy.nextMessage();

    proxy.send({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "vice_result_continue", arguments: { token: "cont-never-issued-0000000000-1" } },
    });
    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, true, "a fabricated, never-issued token must fail loudly");
    assert.match(resp.result.content[0].text, /unknown or has already expired/);
    assert.match(resp.result.content[0].text, /narrower range/);
    assert.equal(proxy.child.exitCode, null, "the proxy must still be alive after an unknown-token error");

    // The failure must not have gone anywhere near the host -- served
    // entirely inside this proxy, exactly like the exhausted-token case.
    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const pingResp = await proxy.nextMessage();
    assert.equal(pingResp.result.isError, false, "the proxy must remain fully functional after the bogus token");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

// Quick 260805, task 1: OUTPUT_CHAR_CAP is read once, at module load, from
// VICE_MAX_RESULT_CHARS -- and the comment above its declaration (vice-proxy.ts)
// says the single-definition property (the number tools/list ADVERTISES via
// `_meta["anthropic/maxResultSizeChars"]` and the number wrapPossiblyChunked()
// actually ENFORCES as the chunk boundary are the same read) is deliberate.
// The two tests above exercise each half separately with DIFFERENT cap
// values (1000 and 12345) -- this test ties them together with ONE cap
// value, so a future edit that lets the two drift apart fails here even if
// it left each half's own test green.
test("the _meta cap stamp and the actual chunk boundary never drift apart", async () => {
  const CAP = 777;
  const bigPayload = "PAYLOAD-" + "x".repeat(CAP * 3 + 42) + "-END"; // several chunks' worth, not a clean multiple
  const { server } = startBigPayloadServer(bigPayload);
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp`, VICE_MAX_RESULT_CHARS: String(CAP) });

  try {
    proxy.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
    });
    await proxy.nextMessage();

    proxy.send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const listResp = await proxy.nextMessage();
    for (const t of listResp.result.tools) {
      assert.equal(
        t._meta && t._meta["anthropic/maxResultSizeChars"],
        CAP,
        `${t.name} must advertise exactly the enforced cap (${CAP})`
      );
    }

    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_memory_read", arguments: {} } });
    const first = await proxy.nextMessage();
    assert.equal(first.result.isError, false);
    assert.equal(
      first.result.content[0].text.length,
      CAP,
      "the first chunk must be exactly the advertised cap in length, not merely 'under the cap somewhere'"
    );

    const tokenMatch = first.result.content[1].text.match(/"token":"([^"]+)"/);
    assert.ok(tokenMatch, "the marker must name a continuation token");
    const token = tokenMatch[1];

    let reassembled = first.result.content[0].text;
    let nextMarker = first.result.content[1].text;
    let guard = 0;
    while (!/\(last chunk\)/.test(nextMarker) && guard < 100) {
      guard += 1;
      proxy.send({
        jsonrpc: "2.0",
        id: 100 + guard,
        method: "tools/call",
        params: { name: "vice_result_continue", arguments: { token } },
      });
      const cont = await proxy.nextMessage();
      assert.equal(cont.result.isError, false);
      // Every chunk except possibly the last must also be exactly CAP long --
      // if the boundary the store enforces ever drifted from CAP, an
      // intermediate chunk would be the first place a length mismatch shows.
      if (!/\(last chunk\)/.test(cont.result.content[1].text)) {
        assert.equal(cont.result.content[0].text.length, CAP, "every non-final chunk must be exactly CAP long");
      }
      reassembled += cont.result.content[0].text;
      nextMarker = cont.result.content[1].text;
    }
    assert.equal(reassembled, bigPayload, "reassembly must equal the original payload byte for byte");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

// -----------------------------------------------------------------------
// Plan 01.1-03 task 1: nothing can kill the proxy, and nothing it does may
// cache a negative ("the host is down") result. Every hostile-input shape
// gets a well-formed JSON-RPC response, never a crash and never silence
// when the caller expected an answer.
// -----------------------------------------------------------------------

test("never-throw: malformed and hostile input is answered, not fatal", async () => {
  const { server } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });

  try {
    proxy.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
    });
    await proxy.nextMessage();

    // Plan 01.6.3-02 (D-01) note, covering cases 1-3 below: the retired
    // hand-rolled handleMessage()/handleLine() pair always answered each of
    // these with a well-formed JSON-RPC error (-32700/-32600/-32600). The
    // SDK's own StdioServerTransport/Protocol (read directly from their
    // compiled source this session) route a JSON.parse failure OR a
    // JSONRPCMessageSchema validation failure to `onerror` only -- no wire
    // response is written for either at all. This is a genuine, disclosed
    // wire-level narrowing: nothing crashes and nothing hangs (still
    // provable, see case 6 below), but a caller sending one of these three
    // shapes now gets silence rather than an explicit refusal.

    // 1. Raw non-JSON text -- no response; must not crash the process.
    proxy.sendRaw("this is not { json at all");
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(proxy.child.exitCode, null, "still alive after a malformed line");

    // 2. Valid JSON that is not an object at all (a bare number) -- fails
    //    JSONRPCMessageSchema validation at the transport layer; no id to
    //    key a response to even if one were written, and per the note
    //    above none is.
    proxy.sendRaw(JSON.stringify(42));
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(proxy.child.exitCode, null, "still alive after a bare-value line");

    // 3. A well-formed-looking object with no "method" at all -- also fails
    //    JSONRPCMessageSchema validation (every union member requires a
    //    string method or a result/error field this object has neither of).
    proxy.send({ jsonrpc: "2.0", id: 10, params: {} });
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(proxy.child.exitCode, null, "still alive after a method-less object");

    // 4. An unknown (unimplemented) method name -- THIS one still parses as
    //    a well-formed JSONRPCRequestSchema (method is validated as merely
    //    a non-empty string, not a known enum), so it reaches the SDK's own
    //    request-handler-lookup miss path, which answers MethodNotFound --
    //    unchanged from the retired handleMessage()'s own -32601.
    proxy.send({ jsonrpc: "2.0", id: 11, method: "something/unimplemented", params: {} });
    const unknownErr = await proxy.nextMessage();
    assert.equal(unknownErr.error && unknownErr.error.code, -32601, "an unrecognised method must yield -32601");

    // 5. tools/call with params but no name. This DOES draw a response --
    //    CallToolRequestSchema's own validation runs (via setRequestHandler's
    //    wrapping, applied identically to this override), rejecting the
    //    missing required "name" field before this file's own override body
    //    ever runs. The retired handleToolsCall() threw a ProtocolError
    //    mapped to -32602 (InvalidParams); the SDK's own validation failure
    //    is a plain thrown ZodError with no numeric `.code`, which
    //    Protocol's own error-mapping (Number.isSafeInteger(error['code'])
    //    ? error['code'] : ErrorCode.InternalError) falls back to
    //    -32603 (InternalError) for -- a provable, disclosed wire-level
    //    change in WHICH error code, not in whether one arrives.
    proxy.send({ jsonrpc: "2.0", id: 12, method: "tools/call", params: { arguments: {} } });
    const noNameErr = await proxy.nextMessage();
    assert.equal(noNameErr.error && noNameErr.error.code, -32603, "tools/call with no params.name now yields -32603 (InternalError), not the retired -32602 (InvalidParams) -- see note above");

    // 6. Finally: a genuinely valid tools/call, proving the process is
    //    still fully functional after five consecutive hostile inputs.
    proxy.send({ jsonrpc: "2.0", id: 13, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const okResp = await proxy.nextMessage();
    assert.equal(okResp.result.isError, false, "a valid call after five hostile inputs must still succeed");

    assert.equal(proxy.child.exitCode, null, "the proxy must still be running throughout");
    assert.equal(proxy.child.killed, false);
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

test("never-throw: a notification draws no response", async () => {
  const { server } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });

  try {
    proxy.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
    });
    await proxy.nextMessage();

    // Two notification-shaped messages -- valid method, no `id` at all.
    proxy.send({ jsonrpc: "2.0", method: "notifications/initialized" });
    proxy.send({ jsonrpc: "2.0", method: "notifications/some-other-thing", params: { x: 1 } });

    // A subsequent real request must still get exactly its own response,
    // correlated by id -- proving neither notification ate it or produced a
    // stray response of its own.
    proxy.send({ jsonrpc: "2.0", id: 42, method: "tools/list", params: {} });
    const listResp = await proxy.nextMessage();
    assert.equal(listResp.id, 42, "the response after two notifications must be correlated to the real request's id");
    assert.ok(Array.isArray(listResp.result.tools));

    // Exactly two stdout messages total across this whole session: the
    // initial initialize response and this tools/list response -- neither
    // notification produced a line of its own.
    assert.equal(proxy.messages.length, 2, "the two notifications must not have produced any stdout lines");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

/** Reserve a free TCP port and release it immediately, so a proxy can be
 * pointed at "nothing listening here yet" before something real starts. */
function reserveFreePort(): Promise<number> {
  return new Promise<number>((resolvePort, reject) => {
    const probe = createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolvePort(port));
    });
  });
}

test("never-cache: host down then up succeeds without a restart", async () => {
  const port = await reserveFreePort();
  // Nothing is listening on `port` yet -- the very first call must observe
  // a refused connection, not a cached assumption from some earlier check.
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });
  let server: Server | undefined;

  try {
    proxy.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
    });
    await proxy.nextMessage();

    const pidBefore = proxy.child.pid;

    // Call 1: nothing listening -- must come back as a well-formed
    // isError:true RESULT (Pattern 2's two-category model: a failed tool
    // call is still an answer, never a crash and never a JSON-RPC error
    // object). Generous timeout: with no pre-flight probe yet in place this
    // exhausts the full ~50s reconnect ladder before failing; once task 2's
    // probe lands this same assertion resolves in about a second instead --
    // either way it must eventually come back as isError:true.
    proxy.send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const down = await proxy.nextMessage(65000);
    assert.equal(down.result.isError, true, "a call against nothing listening must fail as isError:true, not crash");

    // Now start the real stand-in server ON THE SAME PORT.
    const standIn = startStandInServer();
    const standInServer = standIn.server;
    server = standInServer;
    await new Promise<void>((resolveListen, rejectListen) => {
      standInServer.listen(port, "127.0.0.1", () => resolveListen());
      standInServer.once("error", rejectListen);
    });

    // Call 2, same child process, no restart: must succeed now, proving the
    // previous failure was never cached anywhere in the proxy.
    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const up = await proxy.nextMessage(15000);
    assert.equal(up.result.isError, false, "the very next call on the SAME process must succeed once the host is up");

    assert.equal(proxy.child.pid, pidBefore, "both calls must have gone through the same child process -- no restart");
    assert.equal(proxy.child.exitCode, null);
  } finally {
    proxy.child.kill("SIGKILL");
    const finalServer = server;
    if (finalServer) await new Promise((resolve) => finalServer.close(resolve));
  }
});

test("never-throw: a broken stdout pipe does not kill the process", async () => {
  const { server } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });

  try {
    proxy.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
    });
    await proxy.nextMessage();

    // Destroy the PARENT's read end of the child's stdout pipe. On this
    // platform/runtime this is expected to make the child's NEXT
    // process.stdout.write() fail with EPIPE -- exactly the filed
    // typescript-sdk#1564 failure class this task hardens against.
    proxy.child.stdout.destroy();
    await new Promise((r) => setTimeout(r, 200));

    // Ask for something that would normally produce a response line. We can
    // no longer read the response (the read end is destroyed), so the
    // PRIMARY signal is process liveness, not stdout content.
    proxy.sendRaw(JSON.stringify({ jsonrpc: "2.0", id: 99, method: "tools/list", params: {} }));
    await new Promise((r) => setTimeout(r, 300));

    assert.equal(proxy.child.exitCode, null, "a broken stdout pipe must not kill the process");
    assert.equal(proxy.child.signalCode, null, "the process must not have been signalled");

    // Belt-and-suspenders source assertion, per this task's own documented
    // escape hatch: EPIPE-inducibility via destroy() can vary across
    // Node/platform combinations, so this independently confirms the actual
    // defensive code the plan requires is present, regardless of whether
    // this particular runtime reproduced a real EPIPE just now. See
    // 01.1-03-SUMMARY.md's coverage note for this substitution.
    const source = readFileSync(PROXY_PATH, "utf8");
    assert.match(
      source,
      /process\.stdout\.on\(\s*["']error["']/,
      "vice-proxy.mjs must register an 'error' listener on process.stdout"
    );
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

// -----------------------------------------------------------------------
// Plan 01.1-03 task 2: an unreachable emulator produces one of exactly three
// distinct, evidence-carrying diagnoses within about a second -- never a
// blocking wait on withReconnect()'s ~50s ladder, never a generic message
// that sends the reader to the wrong fix.
// -----------------------------------------------------------------------

test("three states: each unreachable shape gets its own message and fix", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-3states-"));

  // ---- Never started: refused, and no restart-epoch record exists at all. ----
  const neverStartedEpochFile = join(dir, "never-written-epoch.json"); // deliberately never written
  const refusedPort1 = await reserveFreePort();
  const proxy1 = startProxy({
    VICE_MCP_URL: `http://127.0.0.1:${refusedPort1}/mcp`,
    VICE_EPOCH_FILE: neverStartedEpochFile,
  });
  let neverStartedText;
  try {
    proxy1.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
    });
    await proxy1.nextMessage();

    const startedAt = Date.now();
    proxy1.send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const resp = await proxy1.nextMessage(10000);
    const elapsedMs = Date.now() - startedAt;

    assert.equal(resp.result.isError, true, "an unreachable host must fail as isError:true");
    neverStartedText = resp.result.content[0].text;
    assert.match(neverStartedText, /never.*started/i, "the never-started shape must say the emulator was never started");
    assert.ok(
      elapsedMs < 10000,
      `the never-started diagnosis must be fail-fast, not the ~50s reconnect ladder -- took ${elapsedMs}ms`
    );
  } finally {
    proxy1.child.kill("SIGKILL");
  }

  // ---- Dead or hung: refused, but a restart-epoch record DOES exist. ----
  const deadOrHungEpochFile = join(dir, "epoch.json");
  writeFileSync(deadOrHungEpochFile, JSON.stringify({ epoch: 5, pid: 4242, spawned_at: "2026-07-31T00:00:00.000Z" }), "utf8");
  const refusedPort2 = await reserveFreePort();
  const proxy2 = startProxy({
    VICE_MCP_URL: `http://127.0.0.1:${refusedPort2}/mcp`,
    VICE_EPOCH_FILE: deadOrHungEpochFile,
  });
  let deadOrHungText;
  try {
    proxy2.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
    });
    await proxy2.nextMessage();

    proxy2.send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const resp = await proxy2.nextMessage(10000);
    assert.equal(resp.result.isError, true);
    deadOrHungText = resp.result.content[0].text;
    assert.match(deadOrHungText, /dead or hung/i);
    assert.match(deadOrHungText, /4242/, "the pid read from the epoch file must appear in the dead-or-hung message");
  } finally {
    proxy2.child.kill("SIGKILL");
  }

  // ---- Alive, but the operation itself failed. ----
  function startAliveButFailingServer(): StandInServer {
    const requests: (JsonRpcMessage | null)[] = [];
    const server = createServer((req, res) => {
      let body = "";
      req.setEncoding("utf8");
      req.on("data", (c: string) => (body += c));
      req.on("end", () => {
        let msg: JsonRpcMessage | null;
        try {
          msg = JSON.parse(body);
        } catch {
          msg = null;
        }
        requests.push(msg);
        if (msg && msg.method === "initialize") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: msg.id,
              result: { protocolVersion: "2024-11-05", capabilities: {}, serverInfo: { name: "stand-in", version: "0" } },
            })
          );
          return;
        }
        if (msg && msg.method === "tools/call" && msg.params && msg.params.name === "vice_ping") {
          const payload = { version: "3.10", machine: "C64SC", execution: "paused" };
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: JSON.stringify(payload) }] } })
          );
          return;
        }
        if (msg && msg.method === "tools/call") {
          // Any OTHER tool call is rejected with a genuine JSON-RPC error --
          // "reachable, but this particular request failed".
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: msg.id,
              error: { code: -32000, message: "no such memory range mapped: $FFFF-$FFFF" },
            })
          );
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ jsonrpc: "2.0", id: msg && "id" in msg ? msg.id : null, error: { code: -32601, message: "unsupported" } })
        );
      });
    });
    return { server, requests };
  }

  const { server: aliveServer } = startAliveButFailingServer();
  const alivePort = await listen(aliveServer);
  const proxy3 = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${alivePort}/mcp` });
  let aliveButFailedText;
  try {
    proxy3.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
    });
    await proxy3.nextMessage();

    proxy3.send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "vice_memory_read", arguments: {} } });
    const resp = await proxy3.nextMessage(10000);
    assert.equal(resp.result.isError, true);
    aliveButFailedText = resp.result.content[0].text;
    assert.match(
      aliveButFailedText,
      /no such memory range mapped: \$FFFF-\$FFFF/,
      "the host's own error text must be relayed verbatim, not paraphrased"
    );
    assert.doesNotMatch(
      aliveButFailedText,
      /restart/i,
      "the alive-but-failed message must NOT carry a host-restart instruction"
    );
  } finally {
    proxy3.child.kill("SIGKILL");
    await new Promise((resolve) => aliveServer.close(resolve));
  }

  // ---- Cross-cutting assertions across all three shapes. ----
  assert.notEqual(neverStartedText, deadOrHungText, "never-started and dead-or-hung messages must be pairwise distinct");
  assert.notEqual(neverStartedText, aliveButFailedText, "never-started and alive-but-failed messages must be pairwise distinct");
  assert.notEqual(deadOrHungText, aliveButFailedText, "dead-or-hung and alive-but-failed messages must be pairwise distinct");

  for (const text of [neverStartedText, deadOrHungText, aliveButFailedText]) {
    assert.match(text, /(^|\s)\/\S+/, "every unreachable-adjacent message must quote an absolute path");
    assert.match(text, /only route/i, "every unreachable-adjacent message must state this is the only route");
    // 01.6.2-09 (T-01.6.2-54): all three host-unreachable messages used to
    // quote the retiring per-instance supervisor (tools/vice-supervisor.sh);
    // each now quotes the surviving launcher instead. Whether any quoted
    // invocation carries a subcommand the launcher doesn't accept is
    // checked structurally, against the SOURCE (see "structural: no message
    // quotes the launcher with a subcommand" below) -- the fully-assembled,
    // multi-sentence runtime text here legitimately has more prose after
    // the path, which a text-level "nothing follows" check cannot tell
    // apart from an appended subcommand.
    assert.match(text, /vice-launcher\.sh/, "every unreachable-adjacent message must name the surviving launcher");
    assert.doesNotMatch(text, /vice-supervisor\.sh/, "no unreachable-adjacent message may still name the retiring per-instance supervisor");
  }

  rmSync(dir, { recursive: true, force: true });
});

// -----------------------------------------------------------------------
// Plan 01.1-03 task 3: an absolute container path inside the workspace
// reaches the host only in its translated host form; an absolute path
// outside the workspace is refused before any forwarding; a non-path
// argument (an address, a relative path, a plain number) passes through
// byte-identical -- devcontainer-host-path itself is never modified by
// this plan (verified separately, outside this file, via `git diff
// --name-only -- .claude/skills/devcontainer-host-path`).
// -----------------------------------------------------------------------

test("path translation: container paths cannot reach the host", async () => {
  const { server, requests } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });

  try {
    proxy.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
    });
    await proxy.nextMessage();

    const root = repoRoot();
    const containerPath = join(root, "CLAUDE.md"); // a real, stable, repo-relative file
    const expectedHostPath = hostPath(containerPath);
    assert.notEqual(
      expectedHostPath,
      containerPath,
      "hostPath() must actually translate in this environment for this test to be meaningful"
    );

    // Translated case: a top-level path, one nested inside an object, and
    // one nested inside an array, all in the SAME call.
    proxy.send({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "vice_ping",
        arguments: {
          path: containerPath,
          nested: { inner: containerPath },
          list: ["ok", containerPath],
        },
      },
    });
    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, false);

    const forwarded = requests.find(
      (r) => r && r.method === "tools/call" && r.params && r.params.arguments && Object.prototype.hasOwnProperty.call(r.params.arguments, "path")
    );
    assert.ok(forwarded, "the stand-in server must have received the forwarded call carrying the translated path");
    assert.equal(forwarded.params.arguments.path, expectedHostPath, "a top-level path must be translated to hostPath(containerPath)");
    assert.notEqual(forwarded.params.arguments.path, containerPath, "the container path must NOT reach the host untranslated");
    assert.equal(forwarded.params.arguments.nested.inner, expectedHostPath, "a path nested inside an object must be translated");
    assert.equal(forwarded.params.arguments.list[1], expectedHostPath, "a path nested inside an array must be translated");
    assert.equal(forwarded.params.arguments.list[0], "ok", "a non-path element alongside a translated one is untouched");

    // Out-of-workspace case: refused before the SENSITIVE path ever reaches
    // the host. (The pre-flight liveness probe still runs -- it always
    // does, for every non-deny-listed call -- so this asserts that no
    // request carrying "/etc/passwd" appears, rather than a raw
    // before/after request-count delta that the probe's own harmless ping
    // traffic would spuriously fail.)
    proxy.send({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "vice_ping", arguments: { path: "/etc/passwd" } },
    });
    const refused = await proxy.nextMessage();
    assert.equal(refused.result.isError, true, "an out-of-workspace absolute path must be refused");
    assert.match(refused.result.content[0].text, /arguments\.path/, "the refusal must name the argument position");
    assert.ok(
      refused.result.content[0].text.includes(root),
      "the refusal must name the workspace root"
    );
    assert.ok(
      !requests.some((r) => r && r.method === "tools/call" && r.params && r.params.arguments && r.params.arguments.path === "/etc/passwd"),
      "the refusal must happen before forwarding -- /etc/passwd must never reach the stand-in server"
    );

    // Pass-through case: a hex address, a relative path, and an integer all
    // arrive at the host byte-identical -- the structural rule never
    // touches a non-absolute-path string or a non-string value.
    proxy.send({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "vice_ping", arguments: { address: "$0400", relpath: "recovery/danish/dump.bin", count: 42 } },
    });
    const passthrough = await proxy.nextMessage();
    assert.equal(passthrough.result.isError, false);
    const lastForwarded = requests.find(
      (r) => r && r.method === "tools/call" && r.params && r.params.arguments && r.params.arguments.address === "$0400"
    );
    assert.ok(lastForwarded, "the pass-through call must have reached the host");
    assert.equal(lastForwarded.params.arguments.address, "$0400", "a hex-address-shaped string must not be touched");
    assert.equal(lastForwarded.params.arguments.relpath, "recovery/danish/dump.bin", "a relative path must not be touched");
    assert.equal(lastForwarded.params.arguments.count, 42, "a non-string value must not be touched");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

// -----------------------------------------------------------------------
// A relative path in a MANIFEST-DECLARED path argument resolves against the
// workspace root; the same string in an undeclared argument still passes
// through byte-identical.
//
// Regression origin: `vice_disk_attach({unit:8, path:"disks/saeger.d64"})`
// was forwarded untouched and came back as a bare "Failed to attach disk
// image" from the host, with nothing indicating the path was the problem.
// The old residual required absolute paths and pointed callers at a
// SKILL.md "Paths" section that had been deleted in db9eed3, while
// CLAUDE.md promised the opposite ("pass container paths"). These assertions
// pin the narrower residual so it cannot silently widen back.
// -----------------------------------------------------------------------

test("path translation: relative paths resolve for declared path arguments only", async () => {
  const { server, requests } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });

  try {
    proxy.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
    });
    await proxy.nextMessage();

    const root = repoRoot();
    const expectedHostPath = hostPath(join(root, "disks/saeger.d64"));
    assert.ok(
      !expectedHostPath.startsWith(root),
      "hostPath() must actually translate here for this test to be meaningful"
    );

    // 1. vice_disk_attach.path IS declared a path by the manifest, so the
    //    relative form must reach the host fully resolved AND translated.
    //    (The stand-in server answers only vice_ping, so this call comes back
    //    as a relayed -32601 -- what matters, and what is asserted, is what
    //    was FORWARDED. The relay is also where the resolution note has to
    //    appear, since that is the shape the original bug presented as.)
    proxy.send({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "vice_disk_attach", arguments: { unit: 8, path: "disks/saeger.d64" } },
    });
    const attached = await proxy.nextMessage();
    assert.match(
      attached.result.content[0].text,
      new RegExp(`path.*disks/saeger\\.d64.*->.*${join(root, "disks/saeger.d64").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "s"),
      "the result must name what the caller wrote AND the absolute container path it resolved to"
    );

    const forwarded = requests.find(
      (r) => r && r.method === "tools/call" && r.params && r.params.name === "vice_disk_attach"
    );
    assert.ok(forwarded, "the disk_attach call must have been forwarded");
    assert.equal(
      forwarded.params.arguments.path,
      expectedHostPath,
      "a relative path in a declared path argument must arrive resolved and host-translated"
    );
    assert.equal(forwarded.params.arguments.unit, 8, "a sibling non-path argument must be untouched");

    // 2. The SAME string in a tool that declares no path argument keeps the
    //    byte-identical pass-through -- the residual narrowed, not vanished.
    proxy.send({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "vice_ping", arguments: { path: "disks/saeger.d64" } },
    });
    const pinged = await proxy.nextMessage();
    assert.equal(pinged.result.isError, false);
    const pingForwarded = requests.find(
      (r) =>
        r &&
        r.method === "tools/call" &&
        r.params &&
        r.params.name === "vice_ping" &&
        r.params.arguments &&
        r.params.arguments.path === "disks/saeger.d64"
    );
    assert.ok(
      pingForwarded,
      "vice_ping declares no path argument, so the same relative string must pass through byte-identical"
    );

    // 3. A relative path that escapes the workspace is refused by the
    //    existing boundary check, and the refusal names what the caller
    //    actually wrote rather than only the resolved form.
    proxy.send({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "vice_disk_attach", arguments: { unit: 8, path: "../../etc/passwd" } },
    });
    const escaped = await proxy.nextMessage();
    assert.equal(escaped.result.isError, true, "a relative path escaping the workspace must be refused");
    assert.match(escaped.result.content[0].text, /\.\.\/\.\.\/etc\/passwd/, "the refusal must quote what the caller wrote");
    assert.match(escaped.result.content[0].text, /arguments\.path/, "the refusal must name the argument position");
    assert.ok(
      !requests.some(
        (r) => r && r.params && r.params.arguments && String(r.params.arguments.path || "").includes("/etc/passwd")
      ),
      "the refusal must happen before forwarding"
    );

    // 4. An absolute in-workspace path still behaves exactly as before.
    const abs = join(root, "disks/saeger.d64");
    proxy.send({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "vice_autostart", arguments: { path: abs } },
    });
    const auto = await proxy.nextMessage();
    const autoForwarded = requests.find(
      (r) => r && r.method === "tools/call" && r.params && r.params.name === "vice_autostart"
    );
    assert.ok(autoForwarded, "the autostart call must have been forwarded");
    assert.equal(
      autoForwarded.params.arguments.path,
      expectedHostPath,
      "an absolute in-workspace path must translate exactly as it always did"
    );
    assert.ok(
      !/resolved relative path/.test(auto.result.content.map((c: any) => c.text).join("\n")),
      "a call that passed an absolute path must read exactly as it always did -- no note"
    );
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

// Regression: the workspace boundary must be checked against a NORMALIZED
// path. Before this, isInsideWorkspace() compared the raw string, so any value
// merely beginning with the root's characters passed -- and hostPath() does not
// refuse a normalizing-outward path either (it falls through to mount-based
// translation by design), so the check here was the only boundary and a lexical
// ".." walked straight through it into a real host path outside the workspace.
//
// Both directions matter, which is why one test covers both: refuse what
// escapes, and still accept what merely LOOKS like it escapes but resolves back
// inside. A fix that only refused any string containing ".." would pass the
// first assertion and fail the second.
test("path translation: a lexical .. cannot escape the workspace, and one that resolves back inside still translates", async () => {
  const { server, requests } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });

  try {
    proxy.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
    });
    await proxy.nextMessage();

    const root = repoRoot();

    // Built by string concatenation, NOT join()/resolve() -- both would collapse
    // the ".." here and destroy the very thing under test.
    const escaping = `${root}/../../../etc/passwd`;
    assert.ok(escaping.startsWith(root), "the probe must lexically start with the root, or it proves nothing");

    proxy.send({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "vice_ping", arguments: { path: escaping } },
    });
    const refused = await proxy.nextMessage();
    assert.equal(refused.result.isError, true, "a path that resolves outside the workspace must be refused");
    assert.match(refused.result.content[0].text, /arguments\.path/, "the refusal must name the argument position");
    assert.ok(
      !requests.some(
        (r) =>
          r &&
          r.method === "tools/call" &&
          r.params &&
          r.params.arguments &&
          typeof r.params.arguments.path === "string" &&
          /etc\/passwd/.test(r.params.arguments.path)
      ),
      "nothing naming /etc/passwd may reach the host -- in translated or untranslated form"
    );

    // The complement: ".." that resolves back inside is legitimate and must be
    // normalized and translated, not refused.
    const insideViaDotDot = `${root}/subdir/../CLAUDE.md`;
    const expected = hostPath(join(root, "CLAUDE.md"));
    proxy.send({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "vice_ping", arguments: { path: insideViaDotDot } },
    });
    const accepted = await proxy.nextMessage();
    assert.equal(accepted.result.isError, false, "a .. that resolves back inside the workspace must not be refused");
    const forwarded = requests.find(
      (r) => r && r.method === "tools/call" && r.params && r.params.arguments && r.params.arguments.path === expected
    );
    assert.ok(forwarded, "the normalized path must be forwarded as its host form");
    assert.ok(
      !forwarded.params.arguments.path.includes(".."),
      "the host must never be handed a path still carrying a .. segment"
    );
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

// -----------------------------------------------------------------------
// Plan 01.2-01 task 2 / Plan 01.6.2-07: every session-ending path releases
// the lease, and the deferred-acquisition property (C3) has its own
// dedicated regression guard. Plan 01.6.2-07 swaps acquisition and release
// onto the TCP control connection (openBrokerControl()/BrokerControlSession,
// plan 06's completed client) -- the lease IS the connection now, so a REAL
// control listener (startControlBroker() below) replaces the retiring
// write-a-request-then-run-the-broker-then-poll-for-a-grant dance, and
// "released" is observed as the listener's own connection closing, not a
// lease file disappearing. There is no heartbeat any more: nothing needs
// touching to prove a TCP connection is alive.
// -----------------------------------------------------------------------

/** Poll `predicate` to a bounded deadline rather than sleeping a fixed
 * duration -- this task's own convention for waiting on an asynchronous
 * effect. Returns predicate()'s truthy result, or null on timeout. */
async function waitForCondition<T>(
  predicate: () => T,
  { timeoutMs = 8000, pollMs = 20 }: { timeoutMs?: number; pollMs?: number } = {}
): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = predicate();
    if (result) return result;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return null;
}

function initThenListParams() {
  return { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } };
}

async function handshake(proxy: ProxyHandle): Promise<void> {
  proxy.send({ jsonrpc: "2.0", id: 1, method: "initialize", params: initThenListParams() });
  await proxy.nextMessage();
  proxy.send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  await proxy.nextMessage();
}

interface StubBrokerDeps {
  onAcquire?: () => Promise<AcquireOutcome>;
  onRecycle?: (targetId: string) => Promise<RecycleOutcome>;
}

/** Starts a REAL control listener (broker-control.mts's own
 * startControlListener(), the exact module the proxy's control-plane client
 * speaks to) bound on a kernel-chosen port, with injectable acquire/recycle
 * stubs, and writes dir/broker.json naming it as the control endpoint with a
 * fresh heartbeat -- matching the idiom vice-broker-client.test.ts's own
 * startFullBrokerListener() already established for the client side. This is
 * the TCP-control-plane replacement for the retiring
 * writeFreshBrokerJson()/grantDirectly()/waitForRequestId() file-based
 * fixture trio: nothing under `dir` is written except broker.json itself. */
async function startControlBroker(dir: string, deps: StubBrokerDeps = {}) {
  const token = newControlToken();
  const listener = await startControlListener({
    host: "127.0.0.1",
    port: 0,
    token,
    onAcquire: deps.onAcquire ?? (async () => ({ ok: false, reason: "internal" }) as AcquireOutcome),
    onRelease: () => {},
    onRecycle:
      deps.onRecycle ??
      (async () => ({
        port: null,
        pid: null,
        viceBin: null,
        killStage: "no_signal",
        epochBefore: null,
        outcome: "grant_lookup_failed",
        reason: "no stub configured",
      })),
    onStatus: () => [],
    onHostState: () => ({
      pid: process.pid,
      startedAt: new Date().toISOString(),
      nodeVersion: process.version,
      viceBin: "x64sc",
      warmFloor: 0,
      maxInstances: 1,
      basePort: 0,
    }),
  });
  // Every accepted connection is captured as it arrives -- attached BEFORE
  // any caller has a chance to trigger one, so a later "which socket did
  // MY acquire open" question (e.g. observing it close) has an answer that
  // was recorded at connection time, not raced against after the fact.
  const sockets: Socket[] = [];
  listener.server.on("connection", (socket: Socket) => {
    sockets.push(socket);
  });
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "broker.json"),
    JSON.stringify({
      version: 1,
      pid: process.pid,
      heartbeat_at: new Date().toISOString(),
      control_host: "127.0.0.1",
      control_port: listener.port,
      control_token: token,
    }),
    "utf8"
  );
  return { server: listener.server, port: listener.port, token, sockets };
}

/** Drives ONE forwarded tools/call through the full acquire-over-the-
 * control-connection round trip, granting an instance at `targetPort` (the
 * caller's own stand-in host, unrelated to the control listener's own
 * port). Returns once the call has resolved, alongside the control
 * listener's own server and the one socket it accepted (so a caller can
 * observe the connection closing). Shared by every test below that needs a
 * REAL session held before it can meaningfully assert that ending it
 * releases the connection. `onRecycle`, if given, wires the SAME listener's
 * recycle stub -- so a test needing both an acquired session and control
 * over its later recycle acknowledgement (e.g. via
 * makeControllableRecycle()) does not need a second listener. */
async function acquireLeaseViaBroker(
  proxy: ProxyHandle,
  dir: string,
  targetPort: number,
  callId: number,
  onRecycle?: (targetId: string) => Promise<RecycleOutcome>
) {
  const { server, sockets } = await startControlBroker(dir, {
    onAcquire: async () => ({
      ok: true,
      grant: {
        port: targetPort,
        url: `http://127.0.0.1:${targetPort}/mcp`,
        epochFile: join(dir, String(targetPort), "epoch.json"),
        supervisorDir: join(dir, String(targetPort)),
      },
    }),
    onRecycle,
  });

  proxy.send({ jsonrpc: "2.0", id: callId, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
  await proxy.nextMessage(); // the forwarded call's own response

  assert.equal(sockets.length, 1, "exactly one control connection must have been accepted by the time acquisition resolves");
  return { controlServer: server, controlSocket: sockets[0] };
}

const ENDING_TRIGGERS = [
  { name: "SIGINT", end: (proxy: ProxyHandle) => proxy.child.kill("SIGINT") },
  { name: "SIGTERM", end: (proxy: ProxyHandle) => proxy.child.kill("SIGTERM") },
  { name: "SIGHUP", end: (proxy: ProxyHandle) => proxy.child.kill("SIGHUP") },
  { name: "stdin end", end: (proxy: ProxyHandle) => proxy.child.stdin.end() },
  { name: "stdin close", end: (proxy: ProxyHandle) => proxy.child.stdin.destroy() },
];

for (const trigger of ENDING_TRIGGERS) {
  test(`ending path releases the lease: ${trigger.name}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "vice-proxy-ending-"));
    const { server } = startStandInServer();
    const port = await listen(server);
    const proxy = startProxy({
      VICE_POOL_DIR: dir,
      VICE_EPOCH_FILE: join(dir, "epoch.json"),
      // The host alias set to loopback: this test's grant carries a loopback
      // url for a stub that really does live on THIS side of the boundary,
      // so the containerization inverse must be an identity here, not a
      // rewrite to host.docker.internal (which would make the stub
      // unreachable).
      VICE_MCP_HOST: "127.0.0.1",
    });
    let controlServer: NetServer | null = null;
    try {
      await handshake(proxy);
      const acquired = await acquireLeaseViaBroker(proxy, dir, port, 3);
      controlServer = acquired.controlServer;

      // The control socket accepted for THIS session's own acquire -- there
      // is exactly one (acquireLeaseViaBroker() already asserted that), so
      // observing it close is the connection-based equivalent of the
      // retiring lease file disappearing.
      let sawSocketClose = false;
      acquired.controlSocket.once("close", () => {
        sawSocketClose = true;
      });

      trigger.end(proxy);

      const gone = await waitForCondition(() => sawSocketClose);
      assert.ok(gone, `${trigger.name} must close the control connection (the lease)`);
    } finally {
      proxy.child.kill("SIGKILL");
      await new Promise((resolve) => server.close(resolve));
      if (controlServer) await new Promise((resolve) => controlServer!.close(resolve));
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test("a full acquire-forward-release cycle creates no file under the broker state directory", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-nofile-"));
  const { server } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_EPOCH_FILE: join(dir, "epoch.json"),
    VICE_MCP_HOST: "127.0.0.1",
  });
  let controlServer: NetServer | null = null;
  try {
    await handshake(proxy);

    // startControlBroker() writes broker.json ITSELF, standing in for what a
    // human would already have started on the host BEFORE this session ever
    // began -- so the "before" snapshot is taken after that fixture write,
    // and the assertion below is about what the PROXY itself creates from
    // here on, not about the test's own setup.
    const acquired = await startControlBroker(dir, {
      onAcquire: async () => ({
        ok: true,
        grant: {
          port,
          url: `http://127.0.0.1:${port}/mcp`,
          epochFile: join(dir, String(port), "epoch.json"),
          supervisorDir: join(dir, String(port)),
        },
      }),
    });
    controlServer = acquired.server;
    const before = new Set(readdirSync(dir));

    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    await proxy.nextMessage();
    proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    await proxy.nextMessage();

    assert.equal(acquired.sockets.length, 1, "exactly one control connection must have been accepted");
    const socket = acquired.sockets[0];
    let sawClose = false;
    socket.once("close", () => {
      sawClose = true;
    });
    proxy.child.kill("SIGINT");
    await waitForCondition(() => sawClose);

    const after = new Set(readdirSync(dir));
    const created = [...after].filter((f) => !before.has(f));
    assert.deepEqual(created, [], `the proxy must create no new entry under the broker state directory: saw ${created.join(", ")}`);
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    if (controlServer) await new Promise((resolve) => controlServer!.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("acquiring twice sends exactly one acquire request, asserted by a test listener counting received requests", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-acquireonce-"));
  const { server } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_EPOCH_FILE: join(dir, "epoch.json"),
    VICE_MCP_HOST: "127.0.0.1",
  });
  let acquireCount = 0;
  const acquired = await startControlBroker(dir, {
    onAcquire: async () => {
      acquireCount++;
      return {
        ok: true,
        grant: {
          port,
          url: `http://127.0.0.1:${port}/mcp`,
          epochFile: join(dir, String(port), "epoch.json"),
          supervisorDir: join(dir, String(port)),
        },
      };
    },
  });
  try {
    await handshake(proxy);
    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    await proxy.nextMessage();
    proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    await proxy.nextMessage();
    proxy.send({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    await proxy.nextMessage();

    assert.equal(acquireCount, 1, "a session already holding a connection must send no further acquire request");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => acquired.server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("with an explicit endpoint override set, the control listener receives no connection at all", async () => {
  const { server } = startStandInServer();
  const port = await listen(server);
  let acquireCount = 0;
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-override-noconn-"));
  const acquired = await startControlBroker(dir, {
    onAcquire: async () => {
      acquireCount++;
      return { ok: false, reason: "internal" };
    },
  });
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp`, VICE_POOL_DIR: dir });
  try {
    await handshake(proxy);
    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, false, "the override endpoint must still be usable");
    assert.equal(acquireCount, 0, "an explicit VICE_MCP_URL override must never contact the control listener");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => acquired.server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("idempotency: SIGINT followed by SIGTERM ~50ms later is a complete no-op the second time, and the process stays alive", async () => {
  // Plan 01.6.2-07 note: the retiring file protocol's own version of this
  // test proved the SECOND trigger never even attempted a release, by
  // planting a sentinel at the (now-removed) lease path and checking it
  // survived a second unlinkSync attempt -- distinguishing "the guard fired,
  // releaseLeaseNow was never called again" from "it was called again, but
  // idempotently". That distinction does not transfer here: closing an
  // ALREADY-DESTROYED socket a second time is unconditionally a no-op at the
  // platform level (node:net's own Socket.destroy() guards on `destroyed`),
  // so there is no wire-observable difference between "the onTeardown guard
  // fired" and "it didn't, but the underlying primitive absorbed the second
  // call anyway" -- a genuine simplification this design buys, not a gap.
  // What remains testable, and is the property that actually matters, is
  // that neither trigger throws or kills the process.
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-idem-"));
  const { server } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_EPOCH_FILE: join(dir, "epoch.json"),
    // The alias set to loopback -- makes the inverse an identity for a stub
    // that really lives on this side of the boundary (see the "ending path"
    // tests above for the same rationale).
    VICE_MCP_HOST: "127.0.0.1",
  });
  let controlServer: NetServer | null = null;
  try {
    await handshake(proxy);
    const acquired = await acquireLeaseViaBroker(proxy, dir, port, 3);
    controlServer = acquired.controlServer;

    let sawSocketClose = false;
    acquired.controlSocket.once("close", () => {
      sawSocketClose = true;
    });

    proxy.child.kill("SIGINT");
    const gone = await waitForCondition(() => sawSocketClose);
    assert.ok(gone, "SIGINT must close the control connection");

    await new Promise((r) => setTimeout(r, 50));
    proxy.child.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 200));

    assert.equal(proxy.child.exitCode, null, "the process stays alive throughout (no process.exit anywhere in the handler)");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    if (controlServer) await new Promise((resolve) => controlServer!.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a control connection already closed out from under the proxy: teardown does not throw, process stays observable", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-already-removed-"));
  const { server } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_EPOCH_FILE: join(dir, "epoch.json"),
    // The alias set to loopback -- see the "ending path" tests above.
    VICE_MCP_HOST: "127.0.0.1",
  });
  let controlServer: NetServer | null = null;
  try {
    await handshake(proxy);
    const acquired = await acquireLeaseViaBroker(proxy, dir, port, 3);
    controlServer = acquired.controlServer;

    // Simulate the broker itself dropping the connection out from under the
    // still-running proxy, BEFORE any ending trigger -- the connection-based
    // equivalent of an operator (or the broker's own sweep) removing the
    // retiring lease file directly.
    acquired.controlSocket.destroy();
    await waitForCondition(() => acquired.controlSocket.destroyed);

    proxy.child.kill("SIGINT");
    await new Promise((r) => setTimeout(r, 300));

    assert.equal(
      proxy.child.exitCode,
      null,
      "the process must still be alive/observable after teardown against an already-closed connection"
    );
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    if (controlServer) await new Promise((resolve) => controlServer!.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});

// The two heartbeat tests that lived here (mtime advancing on a short
// interval with no further tool calls, and the timer's unref'd-ness letting
// the child exit after stdin closes) are DELETED, not converted: their own
// subjects -- the lease-heartbeat interval and touchLease()'s mtime-refresh
// convention -- are two of D-12's six explicitly retiring mechanisms.
// Nothing needs touching to prove a TCP connection is alive; it either is,
// or the broker's own "close" handler has already reclaimed the instance.
// There is no successor behaviour to re-observe.

test("C3 regression guard: initialize + tools/list alone write no request and no lease, ever", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-c3-"));
  const { server, requests } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_EPOCH_FILE: join(dir, "epoch.json"),
  });
  try {
    await handshake(proxy);

    assert.equal(existsSync(join(dir, "requests")), false, "no requests directory may exist after handshake alone");
    assert.equal(existsSync(join(dir, "leases")), false, "no leases directory may exist after handshake alone");
    assert.equal(requests.length, 0, "the stand-in host must never have been contacted by the handshake alone");
    assert.equal(proxy.child.exitCode, null, "the proxy must still be alive");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("teardown region: no promise-awaiting construct, and the control session's release() called exactly once, between its markers", () => {
  const source = readFileSync(PROXY_PATH, "utf8");
  const beginIdx = source.indexOf("TEARDOWN-REGION-BEGIN");
  const endIdx = source.indexOf("TEARDOWN-REGION-END");
  assert.ok(beginIdx !== -1, "TEARDOWN-REGION-BEGIN marker must be present in vice-proxy.mjs");
  assert.ok(endIdx !== -1 && endIdx > beginIdx, "TEARDOWN-REGION-END marker must be present after the begin marker");
  const region = source.slice(beginIdx, endIdx);

  // No promise-AWAITING construct anywhere in the region -- scoped to this
  // slice only, since the whole-file forwarding path (call(), the control
  // session's own acquire()) is legitimately asynchronous and would trip a
  // whole-file scan. `.catch(` is deliberately NOT in this denylist:
  // BrokerControlSession.release() is declared `async`, so a synchronous
  // throw inside it becomes a rejected promise rather than a thrown
  // exception, and observing that failure without blocking on it is exactly
  // what release().catch(...) does -- it is not itself an await.
  assert.doesNotMatch(region, /\bawait\b/, "the teardown region must contain no await");
  assert.doesNotMatch(region, /\.then\s*\(/, "the teardown region must contain no .then(");
  assert.doesNotMatch(region, /\basync\s+function\b|\basync\s*\(/, "the teardown region must define no async function");

  // Exactly one release call: controlSession.release() IS the entire
  // release now (a synchronous socket.destroy() under the hood) -- this
  // region calls INTO it rather than performing the close itself, so
  // asserting the call site appears exactly once is this region's own
  // version of "exactly one release".
  const releaseCalls = region.match(/controlSession\.release\(\)/g) || [];
  assert.equal(releaseCalls.length, 1, "the teardown region must call controlSession.release() exactly once");
});

// -----------------------------------------------------------------------
// Plan 01.2-03 task 1: a missing/dead/denying on-demand broker produces one
// of exactly three distinct, evidence-carrying diagnoses -- never-started,
// dead-or-hung, launch-failed -- mirroring the host-unreachable triple
// above (line ~1074) but answering a DIFFERENT question (is the BROKER
// reachable, not the host VICE MCP server). never-started and dead-or-hung
// both fail fast, with no request or lease ever written; launch-failed and
// a warming timeout both clean up the request/lease they created. The
// proxy stays alive and forwards successfully on the SAME process the
// instant the broker is up (C11).
// -----------------------------------------------------------------------

// P-08 (01.6.2.1-04-PLAN.md): this bound used to be expressed as a FRACTION
// of ACQUIRE_TIMEOUT_MS (half the acquire deadline). That self-loosens: the
// deadline's own default just moved 25000 -> 120000, so a fraction-of-the-
// deadline bound would have silently jumped from 12500ms to 60000ms with no
// change to this test's own text -- and 60000ms sits well past the 10000ms
// message-read deadline the `await proxy1.nextMessage(10000)` call below
// enforces, so a genuine regression would hit THAT timeout (an opaque
// promise rejection) before this assertion ever got a chance to fire with
// its own informative message, making the assertion unfalsifiable in
// practice. Anchored instead to a fixed absolute value: at most 12500ms (at
// least as strict as the old expression's effective value) and comfortably
// below the 10000ms message-read deadline, so this assertion -- not the
// read -- is what fails on a regression.
const NEVER_STARTED_FAILFAST_BOUND_MS = 5000;

test("broker three states: each broker-absent shape gets its own message and fix", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-broker3states-"));

  // ---- Never started: no broker.json at all. ----
  const proxy1 = startProxy({ VICE_POOL_DIR: dir, VICE_EPOCH_FILE: join(dir, "epoch.json") });
  let neverStartedText;
  try {
    await handshake(proxy1);
    const startedAt = Date.now();
    proxy1.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const resp = await proxy1.nextMessage(10000);
    const elapsedMs = Date.now() - startedAt;
    assert.equal(resp.result.isError, true);
    neverStartedText = resp.result.content[0].text;
    assert.match(neverStartedText, /never.*started/i, "the never-started shape must say the broker was never started");
    assert.ok(
      elapsedMs < NEVER_STARTED_FAILFAST_BOUND_MS,
      `the never-started diagnosis must be fail-fast, well under the fixed bound (${NEVER_STARTED_FAILFAST_BOUND_MS}ms) -- took ${elapsedMs}ms`
    );
    assert.equal(existsSync(join(dir, "requests")), false, "never-started must write no request file");
    assert.equal(existsSync(join(dir, "leases")), false, "never-started must write no lease file");
  } finally {
    proxy1.child.kill("SIGKILL");
  }

  // ---- Dead or hung: broker.json exists but its heartbeat is stale. ----
  const staleHeartbeat = new Date(Date.now() - 999999999).toISOString(); // far past any stale threshold
  writeFileSync(join(dir, "broker.json"), JSON.stringify({ version: 1, pid: 7777, heartbeat_at: staleHeartbeat }), "utf8");
  const proxy2 = startProxy({ VICE_POOL_DIR: dir, VICE_EPOCH_FILE: join(dir, "epoch2.json") });
  let deadOrHungText;
  try {
    await handshake(proxy2);
    proxy2.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const resp = await proxy2.nextMessage(10000);
    assert.equal(resp.result.isError, true);
    deadOrHungText = resp.result.content[0].text;
    assert.match(deadOrHungText, /dead or hung/i);
    assert.match(deadOrHungText, /7777/, "the pid recorded in the planted broker.json must appear in the dead-or-hung message");
    assert.equal(existsSync(join(dir, "requests")), false, "dead-or-hung must write no request file");
  } finally {
    proxy2.child.kill("SIGKILL");
  }
  rmSync(join(dir, "broker.json"), { force: true });

  // ---- Alive, but the launch itself was denied. ----
  // Over the control plane, a denial carries broker-control.mts's own fixed
  // AcquireOutcome vocabulary (no_free_port/at_capacity/internal), not a
  // free-form reason string -- so "relayed verbatim" now means the outcome's
  // own reason word appears unmodified, rather than an arbitrary marker.
  const { server: controlServer3 } = await startControlBroker(dir, {
    onAcquire: async () => ({ ok: false, reason: "no_free_port" }),
  });
  const proxy3 = startProxy({
    VICE_POOL_DIR: dir,
    VICE_EPOCH_FILE: join(dir, "epoch3.json"),
    // quick-260805-9ha: openBrokerControl() no longer dials broker.json's
    // own control_host (startControlBroker() writes "127.0.0.1", the
    // broker's BIND address, never a dial target) -- without this, the
    // client would instead resolve the real bridge alias and this test's
    // in-container listener would never be reached.
    VICE_BROKER_CONTROL_DIAL_HOST: "127.0.0.1",
  });
  let launchFailedText;
  try {
    await handshake(proxy3);
    proxy3.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });

    const resp = await proxy3.nextMessage(10000);
    assert.equal(resp.result.isError, true);
    launchFailedText = resp.result.content[0].text;
    assert.match(launchFailedText, /no_free_port/, "the denial's own reason must appear unmodified in the result");
    assert.doesNotMatch(launchFailedText, /restart/i, "the launch-failed message must NOT carry a restart instruction");
  } finally {
    proxy3.child.kill("SIGKILL");
    await new Promise((resolve) => controlServer3.close(resolve));
  }

  // ---- Cross-cutting assertions across all three shapes. ----
  assert.notEqual(neverStartedText, deadOrHungText, "never-started and dead-or-hung messages must be pairwise distinct");
  assert.notEqual(neverStartedText, launchFailedText, "never-started and launch-failed messages must be pairwise distinct");
  assert.notEqual(deadOrHungText, launchFailedText, "dead-or-hung and launch-failed messages must be pairwise distinct");

  for (const text of [neverStartedText, deadOrHungText, launchFailedText]) {
    assert.match(text, /(^|\s)\/\S+/, "every broker-absent message must quote an absolute path");
    assert.match(text, /only route/i, "every broker-absent message must state this is the only route");
    // 01.6.2-09 (T-01.6.2-54/T-01.6.2-55): all three broker-absent messages
    // used to quote the retiring bash broker (tools/vice-broker.sh); each
    // now quotes the surviving launcher instead. Whether the quoted
    // invocation carries a subcommand is checked structurally against the
    // SOURCE (see "structural: no message quotes the launcher with a
    // subcommand" below), not against this fully-assembled runtime text --
    // aliveButFailedMessage()/brokerLaunchFailedMessage() legitimately
    // follow the path with more prose on the same line.
    assert.match(text, /vice-launcher\.sh/, "every broker-absent message must name the surviving launcher");
    assert.doesNotMatch(text, /vice-broker\.sh/, "no broker-absent message may still name the retiring bash broker");
  }

  rmSync(dir, { recursive: true, force: true });
});

// -----------------------------------------------------------------------
// quick-260805-9ha: a fresh, healthy heartbeat but a DEAD control-plane
// connect must never be misreported as broker liveness -- the exact
// incident this plan closes (see vice-proxy.ts's own
// brokerControlUnreachableMessage() header comment for the full record:
// broker.json is read from the shared filesystem, not over the control
// connection, so the freshness check had already passed while the real
// failure was one layer later, at the connect). This distinctive phrase is
// named as a constant so a future refactor cannot silently reintroduce the
// mis-attribution this test guards against.
// -----------------------------------------------------------------------
const HEARTBEAT_AGE_PHRASE = "heartbeat is older than the stale threshold";

test("control-plane unreachable: a fresh heartbeat but a dead connect names the address and port, never the heartbeat-age wording", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-control-unreachable-"));
  const { server, port } = await startControlBroker(dir, {});
  // Close the listener BEFORE the forwarded call -- startControlBroker()
  // already wrote broker.json with a heartbeat taken just now, and nothing
  // re-writes it, so readBrokerLiveness() still classifies `alive` when the
  // proxy reads it below. Only the CONNECT is dead.
  await new Promise<void>((r) => server.close(() => r()));

  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_EPOCH_FILE: join(dir, "epoch.json"),
    // Matches the record's own recorded control_host ("127.0.0.1", written
    // by startControlBroker()) -- so the closed port, not a mismatched dial
    // target, is the only reason this connect fails.
    VICE_MCP_HOST: "127.0.0.1",
  });
  try {
    await handshake(proxy);
    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const resp = await proxy.nextMessage(10000);
    assert.equal(resp.result.isError, true);
    const text = resp.result.content[0].text;
    assert.match(text, new RegExp(`127\\.0\\.0\\.1:${port}`), `message must name the dial address and port: ${text}`);
    assert.doesNotMatch(text, new RegExp(HEARTBEAT_AGE_PHRASE, "i"), `message must NOT attribute the failure to heartbeat age: ${text}`);
  } finally {
    proxy.child.kill("SIGKILL");
    rmSync(dir, { recursive: true, force: true });
  }
});

test("broker never-cache: absent-then-alive-and-granted succeeds on the SAME process, no restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-broker-nevercache-"));
  const { server } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_EPOCH_FILE: join(dir, "epoch.json"),
    // The alias set to loopback -- see the "ending path" tests above.
    VICE_MCP_HOST: "127.0.0.1",
  });
  let controlServer: NetServer | null = null;
  try {
    await handshake(proxy);
    const pidBefore = proxy.child.pid;

    // Call 1: no broker.json at all -- must observe the never-started
    // message. The proxy stays alive and caches nothing.
    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const down = await proxy.nextMessage(10000);
    assert.equal(down.result.isError, true);
    assert.match(down.result.content[0].text, /never.*started/i);
    assert.equal(proxy.child.exitCode, null, "the proxy must still be running after the never-started diagnosis");

    // Call 2, SAME process, no restart: acquireLeaseViaBroker() both starts
    // a real control listener (marking the broker alive) and grants the
    // now-retried request.
    const acquired = await acquireLeaseViaBroker(proxy, dir, port, 4);
    controlServer = acquired.controlServer;
    assert.equal(acquired.controlSocket.destroyed, false, "the second call must succeed and hold a real, open connection, with no restart between calls");

    assert.equal(proxy.child.pid, pidBefore, "both calls must have gone through the same child process -- no restart");
    assert.equal(proxy.child.exitCode, null);
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    if (controlServer) await new Promise((resolve) => controlServer!.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("broker: a malformed broker.json (truncated, wrong type, empty) is treated as absent, never a throw", async () => {
  const malformedShapes = [
    { label: "truncated", content: '{"version": 1, "pid": 123, "heartbeat' },
    { label: "wrong type", content: "[1, 2, 3]" },
    { label: "empty", content: "" },
  ];

  for (const shape of malformedShapes) {
    const dir = mkdtempSync(join(tmpdir(), `vice-proxy-broker-malformed-${shape.label.replace(/\s+/g, "-")}-`));
    writeFileSync(join(dir, "broker.json"), shape.content, "utf8");
    const proxy = startProxy({ VICE_POOL_DIR: dir, VICE_EPOCH_FILE: join(dir, "epoch.json") });
    try {
      await handshake(proxy);
      proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
      const resp = await proxy.nextMessage(10000);
      assert.equal(resp.result.isError, true, `a ${shape.label} broker.json must still answer isError:true, never crash`);
      assert.match(
        resp.result.content[0].text,
        /never.*started/i,
        `a ${shape.label} broker.json must be treated as absent (never-started), not a parse error`
      );
      assert.equal(proxy.child.exitCode, null, `the proxy must stay alive against a ${shape.label} broker.json`);
    } finally {
      proxy.child.kill("SIGKILL");
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

test("broker warming: an acquire deadline with no grant or error is a warming-and-retry result, and leaves the connection closed", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-broker-warming-"));
  // onAcquire never resolves -- simulating a cold x64sc boot still in
  // progress when the client's own per-request deadline elapses.
  const { server: controlServer } = await startControlBroker(dir, {
    onAcquire: () => new Promise(() => {}),
  });

  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_EPOCH_FILE: join(dir, "epoch.json"),
    VICE_BROKER_ACQUIRE_TIMEOUT_MS: "300", // short deadline -- nothing will ever grant or deny this request
    // quick-260805-9ha: see the "broker three states" proxy3 comment above --
    // openBrokerControl() no longer dials broker.json's own control_host.
    VICE_BROKER_CONTROL_DIAL_HOST: "127.0.0.1",
  });
  try {
    await handshake(proxy);
    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });

    const resp = await proxy.nextMessage(10000);
    assert.equal(resp.result.isError, true);
    assert.match(resp.result.content[0].text, /warming/i, "a deadline with neither grant nor error must read as warming-and-retry");
    assert.match(resp.result.content[0].text, /retry/i);
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => controlServer.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});

// -----------------------------------------------------------------------
// Quick task 260801-ccn task 2: a broker grant carrying HOST-local
// coordinates (a loopback url, host-rooted epoch_file/supervisor_dir) is
// inverted to container coordinates before useInstance() adopts it. Every
// test below configures its own onAcquire stub (startControlBroker()) to
// answer a grant under full test control, reproducing the captured host
// shape verbatim, rather than going through a synthetic spare's own field
// derivation.
// -----------------------------------------------------------------------

test("containerize: a loopback grant url is rewritten so the forwarded call actually reaches a stub bound off loopback", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-ccn-url-"));
  const eth0 = firstNonInternalIPv4();
  assert.ok(eth0, "this environment must expose a non-internal IPv4 address for this test to be meaningful");
  const { server } = startStandInServer();
  const stubPort = await listenOn(server, eth0);

  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_MCP_HOST: eth0, // the alias this test's rewrite must land on
    VICE_EPOCH_FILE: join(dir, "epoch.json"),
    // quick-260805-9ha deviation (Rule 3): VICE_MCP_HOST above governs the
    // DATA-plane alias this test is actually about (the grant url rewrite);
    // it is ALSO resolveControlTarget()'s default source, which would now
    // send the CONTROL-plane connect to eth0 too -- but startControlBroker()
    // below binds its real listener to 127.0.0.1 only, so that connect
    // would fail with nothing listening on eth0. This override keeps the
    // control-plane dial on loopback (where the listener actually is)
    // without touching the eth0 alias the rest of this test exercises.
    VICE_BROKER_CONTROL_DIAL_HOST: "127.0.0.1",
  });
  let controlServer: NetServer | null = null;
  try {
    await handshake(proxy);
    // A loopback url on the stub's port -- nothing listens on loopback at
    // this port (the stub is bound ONLY to eth0), so a successful response
    // is only possible if the containerization inverse rewrote the url.
    const acquired = await startControlBroker(dir, {
      onAcquire: async () => ({
        ok: true,
        grant: {
          port: stubPort,
          url: `http://127.0.0.1:${stubPort}/mcp`,
          epochFile: join(dir, "unused-epoch.json"),
          supervisorDir: join(dir, "unused-supervisor-dir"),
        },
      }),
    });
    controlServer = acquired.server;

    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });

    const resp = await proxy.nextMessage(10000);
    assert.equal(
      resp.result.isError,
      false,
      "the forwarded call must succeed -- only possible if the loopback url was rewritten to the alias the stub actually listens on"
    );
    const payload = JSON.parse(resp.result.content[0].text);
    assert.equal(payload.version, "3.10");

    assert.match(proxy.stderr.join(""), /containerized grant/, "the one translation stderr line must be emitted");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolveClose) => server.close(resolveClose));
    if (controlServer) await new Promise((resolveClose) => controlServer!.close(resolveClose));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("containerize: a host-rooted grant epoch_file is rewritten so epoch drift is actually detected, and the translation line names all three fields", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-ccn-epoch-"));
  const eth0 = firstNonInternalIPv4();
  assert.ok(eth0, "this environment must expose a non-internal IPv4 address for this test to be meaningful");
  const { server } = startStandInServer();
  const stubPort = await listenOn(server, eth0);

  // A REAL epoch file inside the container workspace's own .vice-supervisor/
  // (gitignored) -- proves the path inverse is actually READ, not merely
  // computed.
  const epochContainerDir = join(repoRoot(), ".vice-supervisor", `test-ccn-${process.pid}-${Date.now()}`);
  mkdirSync(epochContainerDir, { recursive: true });
  const epochContainerFile = join(epochContainerDir, "epoch.json");
  writeFileSync(epochContainerFile, JSON.stringify({ epoch: 1, pid: 4242, spawned_at: new Date().toISOString() }), "utf8");
  const epochHostPath = hostPath(epochContainerFile);
  assert.notEqual(epochHostPath, epochContainerFile, "hostPath() must actually translate in this environment for this test to be meaningful");

  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_MCP_HOST: eth0,
    // Deliberately NOT setting VICE_EPOCH_FILE -- the granted epoch_file
    // must be the only path in play.
    // quick-260805-9ha deviation (Rule 3): see the sibling loopback-url test
    // above for why this is needed alongside VICE_MCP_HOST -- the control
    // listener startControlBroker() binds below is loopback-only.
    VICE_BROKER_CONTROL_DIAL_HOST: "127.0.0.1",
  });
  let controlServer: NetServer | null = null;
  try {
    await handshake(proxy);
    const acquired = await startControlBroker(dir, {
      onAcquire: async () => ({
        ok: true,
        grant: {
          port: stubPort,
          url: `http://127.0.0.1:${stubPort}/mcp`,
          epochFile: epochHostPath,
          supervisorDir: join(dir, "unused-supervisor-dir"),
        },
      }),
    });
    controlServer = acquired.server;

    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });

    const first = await proxy.nextMessage(10000);
    assert.equal(first.result.isError, false, "the first forwarded call must succeed");

    // Stderr evidence: exactly one line naming all three fields, so
    // translating two of three would fail this.
    const translationLines = proxy.stderr.join("").split("\n").filter((l) => l.includes("containerized grant"));
    assert.equal(translationLines.length, 1, "exactly one translation line must be emitted for this grant");
    for (const field of ["url", "epoch_file", "supervisor_dir"]) {
      assert.match(translationLines[0], new RegExp(field), `the translation line must name ${field}`);
    }

    // Bump the epoch in the REAL container-side file.
    writeFileSync(epochContainerFile, JSON.stringify({ epoch: 2, pid: 4242, spawned_at: new Date().toISOString() }), "utf8");

    proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const second = await proxy.nextMessage(10000);
    assert.equal(
      second.result.isError,
      true,
      "the second call must detect epoch drift -- only possible if the granted epoch_file was actually translated and read"
    );
    assert.match(second.result.content[0].text, /epoch drift/i);
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolveClose) => server.close(resolveClose));
    if (controlServer) await new Promise((resolveClose) => controlServer!.close(resolveClose));
    rmSync(dir, { recursive: true, force: true });
    rmSync(epochContainerDir, { recursive: true, force: true });
  }
});

test("containerize: an already-container-shaped grant (tmpdir VICE_POOL_DIR) is adopted byte-identical, reported as unchanged on stderr", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-ccn-passthrough-"));
  const { server } = startStandInServer();
  const port = await listen(server); // loopback, matching every pre-existing broker test's own stub binding

  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_MCP_HOST: "127.0.0.1", // makes the rewrite an identity for a stub that really lives on this side
    VICE_EPOCH_FILE: join(dir, "epoch.json"),
  });
  let controlServer: NetServer | null = null;
  try {
    await handshake(proxy);
    const acquired = await acquireLeaseViaBroker(proxy, dir, port, 3);
    controlServer = acquired.controlServer;
    assert.equal(acquired.controlSocket.destroyed, false, "a real, open connection must be held once the call has resolved");

    const translationLines = proxy.stderr.join("").split("\n").filter((l) => l.includes("containerized grant"));
    assert.equal(translationLines.length, 1);
    assert.match(translationLines[0], /url: unchanged/, "an already container-shaped url must be reported unchanged, not translated");
    assert.match(translationLines[0], /epoch_file: unchanged/, "a tmpdir-rooted epoch_file must be reported unchanged");
    assert.match(translationLines[0], /supervisor_dir: unchanged/, "a tmpdir-rooted supervisor_dir must be reported unchanged");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolveClose) => server.close(resolveClose));
    if (controlServer) await new Promise((resolveClose) => controlServer!.close(resolveClose));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("containerize safety net: a grant whose epoch_file translates outside the workspace is refused, falling back to the port-derived path", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-ccn-safetynet-epoch-"));
  const { server } = startStandInServer();
  const port = await listen(server);

  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_MCP_HOST: "127.0.0.1",
  });
  let controlServer: NetServer | null = null;
  try {
    await handshake(proxy);

    // A REAL host root this container recognises, with a lexical ".."
    // traversal appended -- translates to something outside the workspace
    // once containerPath() constructs the container form.
    const realHostRoot = hostPath(repoRoot());
    const escapingHostPath = `${realHostRoot}/../../../../../../etc/passwd`;

    const acquired = await startControlBroker(dir, {
      onAcquire: async () => ({
        ok: true,
        grant: {
          port,
          url: `http://127.0.0.1:${port}/mcp`,
          epochFile: escapingHostPath,
          supervisorDir: join(dir, "unused-supervisor-dir"),
        },
      }),
    });
    controlServer = acquired.server;

    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });

    const resp = await proxy.nextMessage(10000);
    assert.equal(
      resp.result.isError,
      false,
      "the session must still be usable -- the safety net substitutes a coordinate, it does not fail the call"
    );

    const translationLines = proxy.stderr.join("").split("\n").filter((l) => l.includes("containerized grant"));
    assert.equal(translationLines.length, 1);
    assert.match(
      translationLines[0],
      /epoch_file: SUBSTITUTED/,
      "the escaping epoch_file must be reported as substituted, not silently adopted"
    );
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolveClose) => server.close(resolveClose));
    if (controlServer) await new Promise((resolveClose) => controlServer!.close(resolveClose));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("containerize safety net: a grant whose url port disagrees with the granted port is refused, falling back to the port-derived url", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-ccn-safetynet-url-"));
  const { server } = startStandInServer();
  const port = await listen(server);
  const wrongPort = port + 1; // NOT what the stub is actually listening on

  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_MCP_HOST: "127.0.0.1",
  });
  let controlServer: NetServer | null = null;
  try {
    await handshake(proxy);
    const acquired = await startControlBroker(dir, {
      onAcquire: async () => ({
        ok: true,
        grant: {
          port,
          url: `http://127.0.0.1:${wrongPort}/mcp`, // disagrees with the granted port
          epochFile: join(dir, "unused-epoch.json"),
          supervisorDir: join(dir, "unused-supervisor-dir"),
        },
      }),
    });
    controlServer = acquired.server;

    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });

    const resp = await proxy.nextMessage(10000);
    assert.equal(resp.result.isError, false, "the session must still be usable via the port-derived fallback url");
    const payload = JSON.parse(resp.result.content[0].text);
    assert.equal(payload.version, "3.10");

    const translationLines = proxy.stderr.join("").split("\n").filter((l) => l.includes("containerized grant"));
    assert.equal(translationLines.length, 1);
    assert.match(
      translationLines[0],
      /url: SUBSTITUTED/,
      "the port-mismatched url must be reported as substituted, not silently adopted"
    );
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolveClose) => server.close(resolveClose));
    if (controlServer) await new Promise((resolveClose) => controlServer!.close(resolveClose));
    rmSync(dir, { recursive: true, force: true });
  }
});

// -----------------------------------------------------------------------
// Quick task 260801-ccn task 3 (D-5): a broker-GRANTED unreachable instance
// names the broker and its launcher, never the retired fixed-port route --
// and a FIXED-PORT unreachable instance (no lease held) still produces the
// unchanged 01.1 triple. The pre-existing "three states" test above (line
// ~1078) is left byte-identical -- these are two NEW, narrower tests
// proving the routing fix is a branch, not a blanket rename.
// -----------------------------------------------------------------------

// -----------------------------------------------------------------------
// Plan 01.6.2-08 (D-13/D-14): the retired broker-granted-unreachable message
// (report-and-instruct, tested immediately above this section until this
// plan) is now a replace-and-report -- a granted instance not answering
// costs this session exactly one replacement acquisition, made
// automatically, and the triggering call still fails LOUDLY naming the
// replacement rather than silently substituting a result read from a
// machine the caller never asked for. D-14 extends the same discipline (and
// the SAME machineReplacedMessage() vocabulary) to the case where the
// replacement attempt itself discovers the control connection is gone.
// -----------------------------------------------------------------------

test("D-13: a dead granted instance costs exactly one replacement acquisition; the triggering call fails loudly naming the replacement, and the next call succeeds on it", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-d13-replace-"));
  const refusedPort = await reserveFreePort();
  const { server: workingServer } = startStandInServer();
  const workingPort = await listen(workingServer);

  let acquireCount = 0;
  const proxy = startProxy({ VICE_POOL_DIR: dir, VICE_MCP_HOST: "127.0.0.1" });
  let controlServer: NetServer | null = null;
  try {
    await handshake(proxy);
    const acquired = await startControlBroker(dir, {
      onAcquire: async () => {
        acquireCount++;
        if (acquireCount === 1) {
          return {
            ok: true,
            grant: {
              port: refusedPort,
              url: `http://127.0.0.1:${refusedPort}/mcp`,
              epochFile: join(dir, "unused-epoch.json"),
              supervisorDir: join(dir, "unused-supervisor-dir"),
            },
          };
        }
        return {
          ok: true,
          grant: {
            port: workingPort,
            url: `http://127.0.0.1:${workingPort}/mcp`,
            epochFile: join(dir, "replacement-epoch.json"),
            supervisorDir: join(dir, "replacement-supervisor-dir"),
          },
        };
      },
    });
    controlServer = acquired.server;

    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const resp = await proxy.nextMessage(10000);
    assert.equal(resp.result.isError, true, "the triggering call must fail loudly, never silently succeed against the replacement");
    const text = resp.result.content[0].text;

    assert.match(text, /REPLACED/, "must state the machine was REPLACED");
    assert.match(text, /FRESH/, "must state the replacement is a FRESH emulator");
    assert.match(text, /GONE/, "must state prior state on the old instance is GONE");
    assert.match(text, new RegExp(String(refusedPort)), "must name the OLD (unreachable) port");
    assert.match(text, new RegExp(String(workingPort)), "must name the NEW (replacement) port");
    assert.equal(acquireCount, 2, "exactly two acquires across the whole test: the original and one replacement");

    // The adoption seam: containerizeGrant() logs exactly one stderr line
    // per adoption (see its own header comment) -- instrumenting that
    // existing, unmodified line proves the replacement went through the
    // SAME seam the ordinary acquisition uses, not a second one.
    assert.equal(
      countStderrLinesMatching(proxy, /vice-proxy: containerized grant/),
      2,
      "both the original grant and the replacement grant must have been adopted through containerizeGrant()'s own seam"
    );

    proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const resp2 = await proxy.nextMessage(10000);
    assert.equal(resp2.result.isError, false, "the call immediately after the error must reach the replacement instance and succeed");
    assert.equal(acquireCount, 2, "the following successful call must not trigger a third acquire");
  } finally {
    proxy.child.kill("SIGKILL");
    if (controlServer) await new Promise((resolveClose) => controlServer!.close(resolveClose));
    await new Promise((resolveClose) => workingServer.close(resolveClose));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("D-13: a replacement that lands back on the SAME port as the unreachable original, with an epoch read that never advances, is reported honestly -- never a false 'changed from N to N' and never one port number labelled as two different instances", async () => {
  // 2026-08-05 defect (.planning/todos/pending/2026-08-05-epoch-drift-and-
  // replacement-messages-name-impossible-values.md, findings 1+2): this
  // broker's fixed-slot design can legitimately hand a replacement the
  // EXACT SAME port the unreachable original held -- and when it does, the
  // old and new reads may come from the SAME epoch file, sampled before any
  // write ever bumped it, so both reads land on the same number. The old
  // wording called that "epoch changed from 1 to 1" (a false claim) and
  // labelled the single port number as both "the old instance (port X)" and
  // "the replacement instance (port X)" (a contradiction "cannot both be").
  // Reproduces exactly that: one epoch file, shared by both grants because
  // they share a port, containing epoch: 1 and never rewritten.
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-d13-sameport-"));
  const samePort = await reserveFreePort(); // nothing listening yet -- the pre-flight probe against grant 1 must fail
  const sharedEpochFile = join(dir, "shared-epoch.json");
  writeFileSync(sharedEpochFile, JSON.stringify({ epoch: 1, spawned_at: new Date().toISOString(), pid: 40001 }));

  let acquireCount = 0;
  let workingServer: Server | null = null;
  const proxy = startProxy({ VICE_POOL_DIR: dir, VICE_MCP_HOST: "127.0.0.1" });
  let controlServer: NetServer | null = null;
  try {
    await handshake(proxy);
    const acquired = await startControlBroker(dir, {
      onAcquire: async () => {
        acquireCount++;
        if (acquireCount === 2) {
          // Bring the SAME port up for real before handing back the
          // replacement grant -- the broker respawning in place on its
          // existing slot, not this test picking a coincidentally-equal
          // number.
          const standIn = startStandInServer();
          workingServer = standIn.server;
          await new Promise<void>((resolvePromise, reject) => {
            workingServer!.once("error", reject);
            workingServer!.listen(samePort, "127.0.0.1", () => resolvePromise());
          });
        }
        return {
          ok: true,
          grant: {
            port: samePort,
            url: `http://127.0.0.1:${samePort}/mcp`,
            epochFile: sharedEpochFile,
            supervisorDir: join(dir, "shared-supervisor"),
          },
        };
      },
    });
    controlServer = acquired.server;

    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const resp = await proxy.nextMessage(10000);
    assert.equal(resp.result.isError, true, "the triggering call must still fail loudly, even though the replacement is confirmed reachable");
    const text = resp.result.content[0].text;

    assert.equal(acquireCount, 2, "exactly two acquires: the original and one replacement");
    assert.doesNotMatch(text, /changed from 1 to 1/, "an equal epoch pair must never be worded as a change");
    assert.doesNotMatch(
      text,
      /old instance \(port \d+\).*replacement instance \(port \d+\)/s,
      "must not label the single shared port as if it were two distinguishable instances"
    );
    assert.match(text, /REPLACED IN PLACE/i, "a same-port replacement must say so plainly, not imply a second distinct port");
    assert.match(text, new RegExp(`port ${samePort}`), "must still name the actual port involved");
    assert.match(text, /did not change/i, "the epoch sentence must say the epoch did not change, not that it changed");
    assert.match(text, /REPLACED/);
    assert.match(text, /FRESH/);
    assert.match(text, /GONE/);
  } finally {
    proxy.child.kill("SIGKILL");
    if (controlServer) await new Promise((resolveClose) => controlServer!.close(resolveClose));
    if (workingServer) await new Promise((resolveClose) => workingServer!.close(resolveClose));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("D-13: the epoch baseline after a replacement is re-based to the replacement's OWN epoch, proven by a later drift comparing against it", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-d13-epoch-"));
  const refusedPort = await reserveFreePort();
  const { server: workingServer } = startStandInServer();
  const workingPort = await listen(workingServer);
  const newEpochFile = join(dir, "replacement-epoch.json");
  writeFileSync(newEpochFile, JSON.stringify({ epoch: 42, spawned_at: new Date().toISOString(), pid: 4242 }));

  let acquireCount = 0;
  const proxy = startProxy({ VICE_POOL_DIR: dir, VICE_MCP_HOST: "127.0.0.1" });
  let controlServer: NetServer | null = null;
  try {
    await handshake(proxy);
    const acquired = await startControlBroker(dir, {
      onAcquire: async () => {
        acquireCount++;
        if (acquireCount === 1) {
          return {
            ok: true,
            grant: {
              port: refusedPort,
              url: `http://127.0.0.1:${refusedPort}/mcp`,
              epochFile: join(dir, "old-epoch.json"),
              supervisorDir: join(dir, "old-supervisor"),
            },
          };
        }
        return {
          ok: true,
          grant: {
            port: workingPort,
            url: `http://127.0.0.1:${workingPort}/mcp`,
            epochFile: newEpochFile,
            supervisorDir: join(dir, "new-supervisor"),
          },
        };
      },
    });
    controlServer = acquired.server;

    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const resp1 = await proxy.nextMessage(10000);
    assert.equal(resp1.result.isError, true);

    // No drift yet -- if the baseline were anything other than 42 (the
    // replacement's OWN epoch), this call would be refused by the drift
    // guard instead of succeeding.
    proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const resp2 = await proxy.nextMessage(10000);
    assert.equal(resp2.result.isError, false, "the baseline must equal 42 (the replacement's own epoch), or this call is wrongly refused as drift");

    // Now bump the epoch file -- if the baseline really is 42, this MUST be
    // caught as drift, naming both 42 and 43.
    writeFileSync(newEpochFile, JSON.stringify({ epoch: 43, spawned_at: new Date().toISOString(), pid: 4242 }));
    proxy.send({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const resp3 = await proxy.nextMessage(10000);
    assert.equal(resp3.result.isError, true);
    const driftText = resp3.result.content[0].text;
    assert.match(driftText, /42/, "the drift report must name the baseline this session actually re-based to");
    assert.match(driftText, /43/, "the drift report must name the new value");
  } finally {
    proxy.child.kill("SIGKILL");
    if (controlServer) await new Promise((resolveClose) => controlServer!.close(resolveClose));
    await new Promise((resolveClose) => workingServer.close(resolveClose));
    rmSync(dir, { recursive: true, force: true });
  }
});

// Updated by 01.6.2-14-PLAN.md (Task 3, WR-03/T-01.6.2-90): the same-session
// replacement attempt now sends session.release() BEFORE session.acquire()
// -- release() closes the underlying connection (D-12: the connection IS
// the lease, a synchronous socket.destroy() under the hood), so the
// same-session acquire that follows ALWAYS finds that connection already
// closed and answers "broker_gone", never a broker-side refusal like
// at_capacity. That branch of handleGrantedInstanceUnreachable()
// (replacementFailedMessage(), reached only when the same-session acquire
// fails for a reason OTHER than broker_gone) is therefore unreachable by
// this fix's own construction -- kept in the source as a defensive branch
// per this plan's own acceptance criteria ("the existing broker-gone branch
// still handles a dead connection"), but no longer something a mock can
// drive from the SAME session. A broker-side refusal (at_capacity) is now
// only observable on the FRESH session's own attempt (D-14), reported
// through sessionMustRestartMessage() instead of replacementFailedMessage()
// -- this test is updated to assert that actually-reachable shape rather
// than the one this fix retires.
test("D-13/D-14: a replacement the broker itself refuses (at_capacity) is only reachable on the FRESH session's own attempt, reporting session-must-restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-d13-replace-fails-"));
  const refusedPort = await reserveFreePort();

  let acquireCount = 0;
  const proxy = startProxy({ VICE_POOL_DIR: dir, VICE_MCP_HOST: "127.0.0.1" });
  let controlServer: NetServer | null = null;
  try {
    await handshake(proxy);
    const acquired = await startControlBroker(dir, {
      onAcquire: async () => {
        acquireCount++;
        if (acquireCount === 1) {
          return {
            ok: true,
            grant: {
              port: refusedPort,
              url: `http://127.0.0.1:${refusedPort}/mcp`,
              epochFile: join(dir, "unused-epoch.json"),
              supervisorDir: join(dir, "unused-supervisor-dir"),
            },
          };
        }
        return { ok: false, reason: "at_capacity" };
      },
    });
    controlServer = acquired.server;

    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const resp = await proxy.nextMessage(10000);
    assert.equal(resp.result.isError, true);
    const text = resp.result.content[0].text;

    assert.match(
      text,
      /on-demand VICE broker connection is gone/i,
      "the same-session acquire (right after this fix's own release()) must find the connection already gone -- reported through the session-must-restart branch",
    );
    assert.match(text, /at_capacity/, "must name the FRESH session's own failed acquire reason");
    assert.equal(
      acquireCount,
      2,
      "exactly two acquires reach the fake broker: the original grant, and the fresh session's own attempt -- the same-session acquire right after release() is intercepted client-side (broker_gone) and never reaches the broker at all",
    );
  } finally {
    proxy.child.kill("SIGKILL");
    if (controlServer) await new Promise((resolveClose) => controlServer!.close(resolveClose));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("D-13: two consecutive calls against a still-unreachable replacement each attempt exactly one MORE replacement, proving nothing is cached", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-d13-nocache-"));
  const refusedPort1 = await reserveFreePort();
  const refusedPort2 = await reserveFreePort();

  let acquireCount = 0;
  const proxy = startProxy({ VICE_POOL_DIR: dir, VICE_MCP_HOST: "127.0.0.1" });
  let controlServer: NetServer | null = null;
  try {
    await handshake(proxy);
    const acquired = await startControlBroker(dir, {
      onAcquire: async () => {
        acquireCount++;
        const port = acquireCount === 1 ? refusedPort1 : refusedPort2;
        return {
          ok: true,
          grant: {
            port,
            url: `http://127.0.0.1:${port}/mcp`,
            epochFile: join(dir, `epoch-${acquireCount}.json`),
            supervisorDir: join(dir, `supervisor-${acquireCount}`),
          },
        };
      },
    });
    controlServer = acquired.server;

    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const resp1 = await proxy.nextMessage(10000);
    assert.equal(resp1.result.isError, true);
    assert.equal(acquireCount, 2, "call 1: the original acquire plus exactly one replacement");

    proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const resp2 = await proxy.nextMessage(10000);
    assert.equal(resp2.result.isError, true, "the replacement from call 1 is STILL unreachable in this test");
    assert.equal(acquireCount, 3, "call 2 must attempt exactly one MORE replacement -- no sticky negative carried over from call 1");
  } finally {
    proxy.child.kill("SIGKILL");
    if (controlServer) await new Promise((resolveClose) => controlServer!.close(resolveClose));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("structural: the replaced-machine report is built from the existing voided-run vocabulary (epochDriftMessage), not a second one", () => {
  const src = readFileSync(join(HERE, "vice-proxy.ts"), "utf8");
  const fnMatch = src.match(/function machineReplacedMessage\([\s\S]*?\n\}\n/);
  assert.ok(fnMatch, "machineReplacedMessage() must exist in vice-proxy.ts");
  assert.match(
    fnMatch![0],
    /epochDriftMessage\(/,
    "machineReplacedMessage() must reference the existing epochDriftMessage() builder rather than inventing a second wording for a voided run"
  );
});

test("D-14: the broker connection itself gone -- with a replacement listener available, a forwarded call opens a fresh session, adopts a replacement, and reports it in the same replaced-machine vocabulary", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-d14-fresh-"));
  const { server: server1 } = startStandInServer();
  const port1 = await listen(server1);

  const proxy = startProxy({ VICE_POOL_DIR: dir, VICE_MCP_HOST: "127.0.0.1" });
  let controlServer1: NetServer | null = null;
  let controlServer2: NetServer | null = null;
  let server2: Server | null = null;
  try {
    await handshake(proxy);
    const acquired1 = await acquireLeaseViaBroker(proxy, dir, port1, 3);
    controlServer1 = acquired1.controlServer;

    // Kill the broker connection AND the granted instance -- both must be
    // gone for a forwarded call's probe to fail and the replacement
    // attempt it triggers to discover broker_gone rather than a live probe.
    acquired1.controlSocket.destroy();
    await new Promise((resolveClose) => controlServer1!.close(resolveClose));
    controlServer1 = null;
    await new Promise((resolveClose) => server1.close(resolveClose));

    // A REPLACEMENT listener becomes available -- broker.json is rewritten
    // (never cached: openBrokerControl() reads it fresh every call) to
    // point at it, standing in for a restarted broker.
    const standIn2 = startStandInServer();
    server2 = standIn2.server;
    const port2 = await listen(server2);
    const acquired2 = await startControlBroker(dir, {
      onAcquire: async () => ({
        ok: true,
        grant: {
          port: port2,
          url: `http://127.0.0.1:${port2}/mcp`,
          epochFile: join(dir, "fresh-epoch.json"),
          supervisorDir: join(dir, "fresh-supervisor"),
        },
      }),
    });
    controlServer2 = acquired2.server;

    proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const resp = await proxy.nextMessage(10000);
    assert.equal(resp.result.isError, true, "the triggering call must still fail loudly");
    const text = resp.result.content[0].text;
    assert.match(text, /REPLACED/);
    assert.match(text, /FRESH/);
    assert.match(text, /GONE/);
    assert.match(text, /broker/i, "must name that the broker connection itself was the cause");

    proxy.send({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const resp2 = await proxy.nextMessage(10000);
    assert.equal(resp2.result.isError, false, "the next call must succeed on the freshly-opened session's own replacement");
  } finally {
    proxy.child.kill("SIGKILL");
    if (controlServer1) await new Promise((resolveClose) => controlServer1!.close(resolveClose));
    if (controlServer2) await new Promise((resolveClose) => controlServer2!.close(resolveClose));
    if (server2) await new Promise((resolveClose) => server2!.close(resolveClose));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("D-14: the broker connection itself gone -- with nothing available to reconnect to, a forwarded call reports the session must be restarted, naming the broker", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-d14-restart-"));
  const { server: server1 } = startStandInServer();
  const port1 = await listen(server1);

  const proxy = startProxy({ VICE_POOL_DIR: dir, VICE_MCP_HOST: "127.0.0.1" });
  let controlServer1: NetServer | null = null;
  try {
    await handshake(proxy);
    const acquired1 = await acquireLeaseViaBroker(proxy, dir, port1, 3);
    controlServer1 = acquired1.controlServer;

    acquired1.controlSocket.destroy();
    await new Promise((resolveClose) => controlServer1!.close(resolveClose));
    controlServer1 = null;
    await new Promise((resolveClose) => server1.close(resolveClose));
    // broker.json is left UNCHANGED -- it still names the now-dead
    // listener's own host/port, and nothing is listening there any more.

    proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const resp = await proxy.nextMessage(10000);
    assert.equal(resp.result.isError, true);
    const text = resp.result.content[0].text;
    assert.match(text, /restart/i, "must state the session must be restarted");
    assert.match(text, /broker/i, "must name the broker, not this proxy, as the cause");
    assert.doesNotMatch(text, /REPLACED/, "nothing was replaced -- this must not read as a replaced-machine report");
  } finally {
    proxy.child.kill("SIGKILL");
    if (controlServer1) await new Promise((resolveClose) => controlServer1!.close(resolveClose));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("D-14: two consecutive calls after the connection dropped each attempt a fresh session from scratch, proving nothing is cached", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-d14-nocache-"));
  const { server: server1 } = startStandInServer();
  const port1 = await listen(server1);

  const proxy = startProxy({ VICE_POOL_DIR: dir, VICE_MCP_HOST: "127.0.0.1" });
  let controlServer1: NetServer | null = null;
  let controlServer2: NetServer | null = null;
  let server2: Server | null = null;
  try {
    await handshake(proxy);
    const acquired1 = await acquireLeaseViaBroker(proxy, dir, port1, 3);
    controlServer1 = acquired1.controlServer;

    acquired1.controlSocket.destroy();
    await new Promise((resolveClose) => controlServer1!.close(resolveClose));
    controlServer1 = null;
    await new Promise((resolveClose) => server1.close(resolveClose));

    proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const resp1 = await proxy.nextMessage(10000);
    assert.equal(resp1.result.isError, true);
    assert.match(resp1.result.content[0].text, /restart/i, "call 1: nothing is available yet, so this reports the session must be restarted");

    // NOW a replacement listener becomes available. If call 1's report had
    // been cached as a standing "the broker is gone forever" verdict, this
    // second call would just repeat it instead of independently re-reading
    // broker.json and succeeding.
    const standIn2 = startStandInServer();
    server2 = standIn2.server;
    const port2 = await listen(server2);
    const acquired2 = await startControlBroker(dir, {
      onAcquire: async () => ({
        ok: true,
        grant: {
          port: port2,
          url: `http://127.0.0.1:${port2}/mcp`,
          epochFile: join(dir, "second-fresh-epoch.json"),
          supervisorDir: join(dir, "second-fresh-supervisor"),
        },
      }),
    });
    controlServer2 = acquired2.server;

    proxy.send({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const resp2 = await proxy.nextMessage(10000);
    assert.equal(resp2.result.isError, true, "still the error-reporting call -- D-13/D-14 never returns a silent success");
    assert.match(
      resp2.result.content[0].text,
      /REPLACED/,
      "call 2 must have independently re-attempted a fresh session and succeeded at replacing, proving call 1's restart report was never cached"
    );

    proxy.send({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const resp3 = await proxy.nextMessage(10000);
    assert.equal(resp3.result.isError, false, "the call after the replacement must succeed");
  } finally {
    proxy.child.kill("SIGKILL");
    if (controlServer1) await new Promise((resolveClose) => controlServer1!.close(resolveClose));
    if (controlServer2) await new Promise((resolveClose) => controlServer2!.close(resolveClose));
    if (server2) await new Promise((resolveClose) => server2!.close(resolveClose));
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 01.6.2-14-PLAN.md, Task 3 (WR-03/T-01.6.2-90): the same-session replacement
// releases before it acquires, and the fresh-session branch states in
// writing why it needs no release of its own. Region-scoped, following the
// SAME idiom this file's own pre-existing structural tests already use
// (indexOf-based region extraction, comments never touched) -- these two
// gates hold the SOURCE ORDER and the SOURCE'S OWN STATED REASONING; they do
// NOT exercise the replacement path against a live session (not reachable
// from this container -- see this plan's own SUMMARY for the backstop this
// carries forward, unchanged from plan 08).
// ---------------------------------------------------------------------------

/** Strips both `/* ... *\/` block comments and whole-line `//` comments
 * before any assertion runs, so a sentence IN a comment (e.g. this file's
 * own prose mentioning `session.release()`) can never satisfy or break a
 * call-count gate -- the same technique broker-control.test.ts's own
 * stripCommentsForStructuralGate() already established, reused here rather
 * than inventing a second one. */
function stripCommentsForRegionGate(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

test("structural: within handleGrantedInstanceUnreachable(), the same-session release call precedes the same-session acquire call, and appears exactly once", () => {
  const src = stripCommentsForRegionGate(readFileSync(PROXY_PATH, "utf8"));
  const startIdx = src.indexOf("async function handleGrantedInstanceUnreachable(probe: ProbeResult, oldEpoch: EpochResult): Promise<string> {");
  assert.ok(startIdx >= 0, "handleGrantedInstanceUnreachable()'s own definition must be found in the source");
  const endIdx = src.indexOf('if (result.kind !== "broker_gone") {', startIdx);
  assert.ok(endIdx > startIdx, "could not isolate the same-session replacement region (up to the broker_gone check)");
  const region = src.slice(startIdx, endIdx);

  const releaseCalls = region.match(/\bsession\.release\(\)/g) ?? [];
  assert.equal(releaseCalls.length, 1, `the same-session region must call session.release() exactly once, found ${releaseCalls.length}`);

  const releaseIdx = region.indexOf("session.release()");
  const acquireIdx = region.indexOf("session.acquire()");
  assert.ok(acquireIdx >= 0, "the same-session region must call session.acquire()");
  assert.ok(releaseIdx < acquireIdx, "session.release() must appear (and therefore execute) BEFORE session.acquire() in the same-session replacement attempt");

  const grantIdClearIdx = region.indexOf("grantId = null;");
  assert.ok(grantIdClearIdx >= 0, "the module-level grantId slot must be cleared in this region");
  assert.ok(releaseIdx < grantIdClearIdx && grantIdClearIdx < acquireIdx, "grantId must be cleared AFTER the release is attempted and BEFORE the acquire, per this plan's own ordering requirement");

  const oldPortReadIdx = region.indexOf("const { port: oldPort } = activeInstance();");
  assert.ok(oldPortReadIdx >= 0 && oldPortReadIdx < releaseIdx, "the old instance's port must be read BEFORE the release, since release() destroys the instance it names");
});

test("structural: the fresh-session replacement branch performs no release over the dead session, and the source states why", () => {
  const rawSrc = readFileSync(PROXY_PATH, "utf8");
  const rawStartIdx = rawSrc.indexOf("// D-14: attempt 1 itself discovered the control connection is gone");
  const rawEndIdx = rawSrc.indexOf("const opened = await openBrokerControl();", rawStartIdx);
  assert.ok(rawStartIdx >= 0, "the D-14 transition comment must be found in the source");
  assert.ok(rawEndIdx > rawStartIdx, "could not isolate the D-14 transition region (up to the fresh openBrokerControl() call)");
  const rawRegion = rawSrc.slice(rawStartIdx, rawEndIdx);

  // The call-count assertion strips comments first (a comment mentioning
  // ".release(" in prose must never satisfy this gate); the reason-text
  // assertion matches the ORIGINAL, un-stripped region separately, so the
  // two assertions can never satisfy each other.
  const codeOnlyRegion = stripCommentsForRegionGate(rawRegion);
  assert.equal(
    (codeOnlyRegion.match(/\.release\(/g) ?? []).length,
    0,
    "no release call may appear in the transition into the fresh-session branch -- a release cannot be sent over a connection that is already gone",
  );
  assert.match(rawRegion, /connection close IS the release/i, "the region must state that connection close IS the release in this design");
  assert.match(rawRegion, /kernel-enforced/i, "the region must state the release is kernel-enforced");
});

test("structural: the source records broker death as an accepted, knowing regression, naming what was survivable before", () => {
  const src = readFileSync(join(HERE, "vice-proxy.ts"), "utf8");
  assert.match(src, /knowing regression/i, "the source must name this as a deliberate, KNOWING regression");
  assert.match(src, /survivable/i, "the source must name what was survivable before this transport");
  assert.match(src, /accepted/i, "the source must call this an ACCEPTED regression, not merely a limitation");
});

test("fixed-port unreachable is unchanged: no lease held still produces the 01.1 never-started message naming the surviving launcher", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-ccn-fixedport-"));
  const neverStartedEpochFile = join(dir, "never-written-epoch.json"); // deliberately never written
  const refusedPort = await reserveFreePort();

  const proxy = startProxy({
    VICE_MCP_URL: `http://127.0.0.1:${refusedPort}/mcp`, // fixed-port override -- broker never contacted, no lease ever held
    VICE_EPOCH_FILE: neverStartedEpochFile,
  });
  try {
    await handshake(proxy);
    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const resp = await proxy.nextMessage(10000);
    assert.equal(resp.result.isError, true);
    const text = resp.result.content[0].text;

    assert.match(text, /never.*started/i, "a fixed-port instance with no lease held must still produce the 01.1 never-started message");
    assert.match(text, /vice-launcher\.sh/, "the message must name the surviving launcher");
    assert.doesNotMatch(text, /on-demand VICE broker/i, "a fixed-port (no-lease) instance must never be answered by the broker-granted message");
  } finally {
    proxy.child.kill("SIGKILL");
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Plan 01.6.2-09 (T-01.6.2-54 -- T-01.6.2-59): eight agent-facing messages
// used to tell a human or an agent to run one of two files this phase
// deletes (the retiring per-instance supervisor, vice-supervisor.sh, and
// the retiring bash broker, vice-broker.sh). Every one is repointed at the
// single surviving launcher (resources/vice-launcher.sh). These structural
// tests check the SOURCE directly, for properties a live-message test
// cannot express cleanly: exactly one host-path helper survives, and no
// quoted invocation carries a subcommand the launcher does not accept.
// ---------------------------------------------------------------------------

test("structural: vice-proxy.ts defines exactly one host-path helper (brokerHostPath), and supervisorHostPath is gone entirely", () => {
  const src = readFileSync(join(HERE, "vice-proxy.ts"), "utf8");
  const brokerHostPathDefs = (src.match(/^function brokerHostPath\(/gm) || []).length;
  assert.equal(brokerHostPathDefs, 1, "expected exactly one brokerHostPath() function definition");
  assert.doesNotMatch(src, /function supervisorHostPath\(/, "supervisorHostPath() must be deleted, not merely unused");
  // Its resolved path's basename must equal the surviving launcher's own
  // filename -- read directly out of the function body rather than calling
  // it (calling it would need repoRoot()/hostPath() wired up identically to
  // production, which the live "three states" tests above already do).
  const fnBody = src.match(/function brokerHostPath\(\): string \{[\s\S]*?\n\}/);
  assert.ok(fnBody, "expected to find brokerHostPath()'s function body");
  assert.match(fnBody![0], /"vice-launcher\.sh"/, "brokerHostPath() must resolve tools/vice-launcher.sh");
});

test("structural: exactly one definition of the shared only-route sentence (ONLY_ROUTE_NOTE) exists", () => {
  const files = readdirSync(HERE)
    .filter((f) => /\.[cm]?[jt]s$/.test(f) && !/\.test\.[cm]?[jt]s$/.test(f));
  let defCount = 0;
  for (const f of files) {
    const src = readFileSync(join(HERE, f), "utf8");
    defCount += (src.match(/^const ONLY_ROUTE_NOTE\s*=/gm) || []).length;
  }
  assert.equal(defCount, 1, "expected exactly one ONLY_ROUTE_NOTE definition across the non-test module set -- no message may grow a second copy of the only-route sentence");
});

test("structural: no message quotes the launcher with a subcommand -- vice-launcher.sh accepts none", () => {
  const src = readFileSync(join(HERE, "vice-proxy.ts"), "utf8");
  // Every call site is either a bare interpolation inside a template
  // literal chunk (immediately followed by the chunk's own closing
  // backtick or a literal newline with nothing else appended before it),
  // or `.split("\n")[0]` assigned to `hostRef` and used the same way. None
  // concatenates a literal subcommand token (e.g. "start", "[N]") onto the
  // call's own result.
  const callSites = [...src.matchAll(/\$\{brokerHostPath\(\)\}/g), ...src.matchAll(/brokerHostPath\(\)\.split\("\\n"\)\[0\]/g)];
  assert.ok(callSites.length >= 6, `expected at least 6 brokerHostPath() call sites, found ${callSites.length}`);
  // Confirm none is followed, within the same statement, by a string
  // concatenation carrying a bare word or bracketed argument -- the actual
  // shape the retired install-resources.ts paragraph used to have
  // (`${brokerDisplayPath} start [N]`) and which vice-launcher.sh's own
  // forwarding exec (`exec node "$BROKER_ARTIFACT" ... "$@"`) accepts no
  // positional subcommand for at all.
  assert.doesNotMatch(src, /brokerHostPath\(\)\}\s*start/, "no call site may append a bare 'start' subcommand");
  assert.doesNotMatch(src, /brokerHostPath\(\)\.split\("\\n"\)\[0\]\}\s*start/, "no hostRef call site may append a bare 'start' subcommand");
});

// ---------------------------------------------------------------------------
// Phase 01.4 plan 03 (criterion 5), executing
// .planning/todos/pending/de-architecture-agent-visible-proxy-messages.md: a
// permanent regression guard against the topology-naming "vice-proxy:"
// prefix silently creeping back into an agent-visible message. A
// backtick-opened template literal beginning with the literal sequence
// "vice-proxy:" is agent-visible tool-result `content` in every case in
// this file EXCEPT when it is an argument to `console.error(...)` (stderr
// only, never read by the model, and deliberately out of this todo's
// scope). The check below is proximity-based (does "console.error(" appear,
// modulo whitespace/newlines, immediately before the backtick?), matching
// this suite's own existing regex-based structural-test idiom (e.g. the
// DENY_LIST-membership checks above) rather than a full parse -- sufficient
// because every console.error call site in this file already writes its
// template literal as either `console.error(\`...\`)` on one line or
// `console.error(\n    \`...\`)` on the next, with nothing else between the
// open-paren and the backtick.
// ---------------------------------------------------------------------------
test("structural: no agent-visible template literal begins with the vice-proxy: prefix", () => {
  const src = readFileSync(join(HERE, "vice-proxy.ts"), "utf8");
  const violations: number[] = [];
  const pattern = /`vice-proxy:/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(src))) {
    const idx = m.index;
    const before = src.slice(Math.max(0, idx - 40), idx);
    if (!/console\.error\(\s*$/.test(before)) {
      violations.push(idx);
    }
  }
  assert.deepEqual(
    violations,
    [],
    `found a non-console.error backtick literal beginning with "vice-proxy:" at source offset(s): ${violations.join(", ")} -- ` +
      `every agent-visible message in this file must use the "vice:" identity instead (see the de-architecture todo)`
  );
});

// ---------------------------------------------------------------------------
// Plan 01.6.2-09 task 2 (D-18): the per-occurrence port triage's own
// counterpart to "do not change the allocation band's default in this
// task" -- proving it, not merely stating it. broker-state.mts's
// DEFAULT_BASE_PORT (set by plan 02) is the single source this task's
// triage is measured against; a second place defining that default would
// be exactly the drift the single-source rule exists to prevent.
// ---------------------------------------------------------------------------

test("structural: the broker's allocated-port-band default (DEFAULT_BASE_PORT) is defined in exactly one place", () => {
  const files = readdirSync(HERE).filter((f) => /\.[cm]?[jt]s$/.test(f) && !/\.test\.[cm]?[jt]s$/.test(f));
  let defCount = 0;
  for (const f of files) {
    const src = readFileSync(join(HERE, f), "utf8");
    defCount += (src.match(/^export const DEFAULT_BASE_PORT\s*=/gm) || []).length;
  }
  assert.equal(
    defCount,
    1,
    "expected exactly one DEFAULT_BASE_PORT definition across the non-test module set -- a second place setting " +
      "the allocation band's default is the single-source drift D-18's own convention exists to prevent"
  );
});

// -----------------------------------------------------------------------
// Plan 01.2-03 task 2: the two client-side thresholds are set explicitly,
// not inherited -- .mcp.json's per-server `timeout` is ordered correctly
// against the proxy's own grant-poll deadline, and MAX_MCP_OUTPUT_TOKENS's
// absence (a setting this repo structurally cannot commit -- see
// .gitignore lines 62-67) is made observable on stderr rather than silent.
// -----------------------------------------------------------------------

function countStderrLinesMatching(proxy: ProxyHandle, pattern: RegExp): number {
  return proxy.stderr.join("").split("\n").filter((line) => pattern.test(line)).length;
}

/** Walk up from `from` to the nearest `.git` ancestor. Deliberately NOT
 * repoRoot() (repo-root.mjs): that module's documented CONTAINER_WORKSPACE_PATH
 * precedence resolves to the shared devcontainer mount's MAIN checkout when
 * run from inside a git worktree (see 01.2-01-SUMMARY.md's "Issues
 * Encountered" -- a pre-existing, documented hazard this task does not fix),
 * which would read the wrong .mcp.json when this test itself runs inside a
 * worktree. Mirrors vice-mcp-selector-docs.test.mjs's own findRepoRoot(),
 * anchored at THIS file's actual on-disk location instead. */
function findWorktreeAwareRepoRoot(from: string): string {
  let dir = from;
  while (true) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`findWorktreeAwareRepoRoot: no .git ancestor found above ${from}`);
    }
    dir = parent;
  }
}

test("ordering: the proxy's own acquire deadline is strictly less than .mcp.json's timeout", () => {
  const mcpJson = JSON.parse(readFileSync(join(findWorktreeAwareRepoRoot(HERE), ".mcp.json"), "utf8"));
  const configuredTimeout = mcpJson.mcpServers.vice.timeout;
  assert.equal(typeof configuredTimeout, "number", ".mcp.json's vice entry must carry a numeric timeout");
  assert.ok(
    ACQUIRE_TIMEOUT_MS < configuredTimeout,
    `the proxy's acquire deadline (${ACQUIRE_TIMEOUT_MS}ms) must be strictly less than .mcp.json's ` +
      `timeout (${configuredTimeout}ms), so the proxy's own warming-and-retry message is always what a ` +
      `waiting caller sees rather than the client's own timeout`
  );
});

test("output-limit warning: exactly one stderr line when MAX_MCP_OUTPUT_TOKENS is absent or insufficient, zero when sufficient", async () => {
  const { server } = startStandInServer();
  const port = await listen(server);

  // Absent entirely -- and driven through SEVERAL messages, to prove the
  // warning is a one-time startup event, not something re-emitted per call.
  // Deleted from THIS test process's own env (restored in `finally` below),
  // not merely omitted from the override object, so this assertion is not
  // at the mercy of whatever the AMBIENT test-runner environment happens to
  // already have set -- startProxy() merges `{...process.env, ...env}`, so
  // an override object alone cannot force a key to be ABSENT if the real
  // process.env already carries it.
  const savedOutputTokens = process.env.MAX_MCP_OUTPUT_TOKENS;
  delete process.env.MAX_MCP_OUTPUT_TOKENS;
  const proxyAbsent = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });
  try {
    await handshake(proxyAbsent);
    for (let i = 0; i < 3; i++) {
      proxyAbsent.send({ jsonrpc: "2.0", id: 10 + i, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
      await proxyAbsent.nextMessage();
    }
    await new Promise((r) => setTimeout(r, 100)); // let stderr settle
    assert.equal(
      countStderrLinesMatching(proxyAbsent, /MAX_MCP_OUTPUT_TOKENS/),
      1,
      "exactly one stderr line naming MAX_MCP_OUTPUT_TOKENS must appear, however many calls are made, when the setting is absent"
    );
  } finally {
    proxyAbsent.child.kill("SIGKILL");
    if (savedOutputTokens !== undefined) process.env.MAX_MCP_OUTPUT_TOKENS = savedOutputTokens;
  }

  // Present but below the required minimum.
  const proxyLow = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp`, MAX_MCP_OUTPUT_TOKENS: "100" });
  try {
    await handshake(proxyLow);
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(
      countStderrLinesMatching(proxyLow, /MAX_MCP_OUTPUT_TOKENS/),
      1,
      "exactly one stderr line naming MAX_MCP_OUTPUT_TOKENS must appear when the setting is below the required minimum"
    );
  } finally {
    proxyLow.child.kill("SIGKILL");
  }

  // Present and sufficient.
  const proxySufficient = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp`, MAX_MCP_OUTPUT_TOKENS: "25000" });
  try {
    await handshake(proxySufficient);
    proxySufficient.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    await proxySufficient.nextMessage();
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(
      countStderrLinesMatching(proxySufficient, /MAX_MCP_OUTPUT_TOKENS/),
      0,
      "zero stderr lines naming MAX_MCP_OUTPUT_TOKENS must appear when the setting is sufficient"
    );
  } finally {
    proxySufficient.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

// ---------------------------------------------------------------------------
// Plan 01.3-01 task 2: vice_recycle's proxy-side half -- every failure mode
// returns a well-formed result (never a throw, never a hang), the incident
// record is written before the request (D-17), and a confirmed recycle
// re-baselines the epoch guard. Every test here redirects incident-
// record.mjs's own writes via VICE_INCIDENTS_DIR (its test-only override,
// mirroring VICE_POOL_DIR) so nothing here ever touches the real, permanent
// .planning/incidents/.
// ---------------------------------------------------------------------------

function tmpIncidentsDir() {
  return mkdtempSync(join(tmpdir(), "vice-proxy-incidents-"));
}

function writeEpochFileFixture(
  dir: string,
  port: number,
  { epoch = 1, pid = 40001, viceBin = "x64sc" }: { epoch?: number; pid?: number; viceBin?: string } = {}
) {
  mkdirSync(join(dir, String(port)), { recursive: true });
  writeFileSync(
    join(dir, String(port), "epoch.json"),
    JSON.stringify({
      epoch,
      spawned_at: new Date().toISOString(),
      pid,
      supervisor_pid: pid + 1,
      vice_bin: viceBin,
      vice_args: [],
      log: null,
      dry_run: false,
    })
  );
}

/** A single controllable recycle stub for a control listener started via
 * startControlBroker(): captures the targetId the FIRST time onRecycle is
 * invoked (resolving waitForCall()), then holds the connection open until
 * the test calls respond() with whatever RecycleOutcome it wants acked --
 * or never calls it at all, for the timeout path. This is the TCP-control-
 * plane replacement for the retiring writeRecycleAckFixture()'s own "plant
 * the ack file whenever the test is ready" idiom, and for
 * waitForRecycleRequestId()'s own "poll for the request file to appear"
 * idiom -- onRecycle() firing IS "the request has arrived", synchronously,
 * with no polling needed. */
function makeControllableRecycle(): {
  onRecycle: (targetId: string) => Promise<RecycleOutcome>;
  waitForCall: () => Promise<string>;
  respond: (outcome: RecycleOutcome) => void;
} {
  let calledResolve!: (targetId: string) => void;
  const called = new Promise<string>((r) => {
    calledResolve = r;
  });
  let respondResolve: ((outcome: RecycleOutcome) => void) | null = null;
  const onRecycle = (targetId: string): Promise<RecycleOutcome> => {
    calledResolve(targetId);
    return new Promise<RecycleOutcome>((r) => {
      respondResolve = r;
    });
  };
  return {
    onRecycle,
    waitForCall: () => called,
    respond(outcome: RecycleOutcome) {
      assert.ok(respondResolve, "respond() called before onRecycle() was invoked by a real recycle request");
      respondResolve!(outcome);
    },
  };
}

/** Like makeControllableRecycle() above, but supports MULTIPLE sequential
 * recycle calls over the same connection -- each call to next() awaits the
 * NEXT onRecycle() invocation (in arrival order) and hands back both its
 * targetId and its own respond() function, for tests exercising more than
 * one recycle in a single session. */
function makeControllableRecycleSequence(): {
  onRecycle: (targetId: string) => Promise<RecycleOutcome>;
  next: () => Promise<{ targetId: string; respond: (outcome: RecycleOutcome) => void }>;
} {
  type Entry = { targetId: string; respond: (outcome: RecycleOutcome) => void };
  const waitingConsumers: Array<(entry: Entry) => void> = [];
  const readyEntries: Entry[] = [];
  const onRecycle = (targetId: string): Promise<RecycleOutcome> => {
    return new Promise<RecycleOutcome>((resolveOutcome) => {
      const entry: Entry = { targetId, respond: resolveOutcome };
      const consumer = waitingConsumers.shift();
      if (consumer) consumer(entry);
      else readyEntries.push(entry);
    });
  };
  function next(): Promise<Entry> {
    return new Promise((resolveConsumer) => {
      const entry = readyEntries.shift();
      if (entry) resolveConsumer(entry);
      else waitingConsumers.push(resolveConsumer);
    });
  }
  return { onRecycle, next };
}

test("vice_recycle: a missing or empty reason returns a well-formed error result naming the requirement, writes no record and no request", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-recycle-reason-"));
  const incidentsDir = tmpIncidentsDir();
  const { server } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_BROKER_BASE_PORT: String(port),
    VICE_MCP_HOST: "127.0.0.1",
    VICE_INCIDENTS_DIR: incidentsDir,
  });
  try {
    await handshake(proxy);

    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_recycle", arguments: {} } });
    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, true, "a missing reason must be refused");
    assert.match(resp.result.content[0].text, /reason/i);

    proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "vice_recycle", arguments: { reason: "   " } } });
    const resp2 = await proxy.nextMessage();
    assert.equal(resp2.result.isError, true, "a whitespace-only reason must be refused identically to a missing one");

    assert.equal(existsSync(join(dir, "requests")), false, "no request must be written for either refusal");
    assert.equal(readdirSync(incidentsDir).length, 0, "no incident record must be written for either refusal");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
    rmSync(incidentsDir, { recursive: true, force: true });
  }
});

test("vice_recycle: with the endpoint override set returns a well-formed error result naming that no broker is in the loop, writes no request", async () => {
  const incidentsDir = tmpIncidentsDir();
  const { server } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp`, VICE_INCIDENTS_DIR: incidentsDir });
  try {
    await handshake(proxy);
    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_recycle", arguments: { reason: "test" } } });
    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, true);
    assert.match(resp.result.content[0].text, /VICE_MCP_URL/);
    assert.equal(readdirSync(incidentsDir).length, 0, "no incident record must be written when there is no broker to ask");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    rmSync(incidentsDir, { recursive: true, force: true });
  }
});

test("vice_recycle: no broker lease held yet for this session is refused, writes no record and no request", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-recycle-nolease-"));
  const incidentsDir = tmpIncidentsDir();
  const { server } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_BROKER_BASE_PORT: String(port),
    VICE_MCP_HOST: "127.0.0.1",
    VICE_INCIDENTS_DIR: incidentsDir,
  });
  try {
    await handshake(proxy);
    // vice_recycle as the FIRST forwarded call -- no other tools/call has
    // ever acquired a broker lease for this session.
    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_recycle", arguments: { reason: "test" } } });
    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, true);
    assert.match(resp.result.content[0].text, /no broker lease is held/);
    assert.equal(existsSync(join(dir, "requests")), false);
    assert.equal(readdirSync(incidentsDir).length, 0);
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
    rmSync(incidentsDir, { recursive: true, force: true });
  }
});

test("vice_recycle: the incident record -- with its evidence section already complete -- exists on disk before the recycle request reaches the broker", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-recycle-order-"));
  const evidenceDir = tmpWorkspaceIncidentsDir();
  const { server } = startFlexibleStandInServer(healthyEvidenceRespond({}));
  const port = await listen(server);
  const recycle = makeControllableRecycle();
  let controlServer: NetServer | null = null;
  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_MCP_HOST: "127.0.0.1",
    VICE_INCIDENTS_DIR: evidenceDir,
  });
  try {
    await handshake(proxy);
    const acquired = await acquireLeaseViaBroker(proxy, dir, port, 3, recycle.onRecycle);
    controlServer = acquired.controlServer;
    writeEpochFileFixture(dir, port, { epoch: 1 });

    proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "vice_recycle", arguments: { reason: "ordering test" } } });

    // onRecycle() firing IS "the request has reached the broker" -- by the
    // time this resolves, the incident record must ALREADY be on disk,
    // carrying its full criterion-4 evidence section -- gatherWedgeEvidence()
    // and captureSnapshotAttempt() run, then writeIncidentRecord() runs, all
    // with no await between the LAST of those and controlSession.recycle()
    // (D-17's automated form, criterion 4, strengthened by plan 01.3-03 from
    // plan 01.3-01's minimal-record form).
    await recycle.waitForCall();

    const incidentFiles = readdirSync(evidenceDir).filter((f) => f.endsWith(".md"));
    assert.equal(incidentFiles.length, 1, "exactly one incident record must exist by the time the recycle request reaches the broker");
    const contentAtRequestTime = readFileSync(join(evidenceDir, incidentFiles[0]), "utf8");
    assert.match(
      contentAtRequestTime,
      /evidence_complete: true/,
      "the evidence section must already be COMPLETE at the moment the request reaches the broker -- not merely present"
    );
    assert.match(contentAtRequestTime, /cycle bracket: \d+ cycles retired/);
    assert.match(contentAtRequestTime, /pre-kill snapshot attempt: accepted \(name: /);

    // Bump the epoch and provide a successful ack so the pending call
    // resolves and this test can tear down cleanly.
    writeEpochFileFixture(dir, port, { epoch: 2 });
    recycle.respond({ port, pid: 40001, viceBin: "x64sc", killStage: "sigterm", epochBefore: 1, outcome: "ok", reason: "" });
    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, false);
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    if (controlServer) await new Promise((resolve) => controlServer!.close(resolve));
    rmSync(dir, { recursive: true, force: true });
    rmSync(evidenceDir, { recursive: true, force: true });
  }
});

test("vice_recycle: an ack whose kill stage is the escalated one produces a result naming that stage verbatim", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-recycle-sigkill-"));
  const incidentsDir = tmpIncidentsDir();
  const { server } = startStandInServer();
  const port = await listen(server);
  const recycle = makeControllableRecycle();
  let controlServer: NetServer | null = null;
  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_MCP_HOST: "127.0.0.1",
    VICE_INCIDENTS_DIR: incidentsDir,
  });
  try {
    await handshake(proxy);
    const acquired = await acquireLeaseViaBroker(proxy, dir, port, 3, recycle.onRecycle);
    controlServer = acquired.controlServer;
    writeEpochFileFixture(dir, port, { epoch: 1 });

    proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "vice_recycle", arguments: { reason: "escalation test" } } });
    await recycle.waitForCall();

    writeEpochFileFixture(dir, port, { epoch: 2 });
    recycle.respond({ port, pid: 40001, viceBin: "x64sc", killStage: "sigkill", epochBefore: 1, outcome: "ok", reason: "" });

    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, false);
    assert.match(resp.result.content[0].text, /"sigkill"/, "the escalated kill stage must be named verbatim in the result");

    const incidentPath = join(incidentsDir, readdirSync(incidentsDir)[0]);
    const incidentContent = readFileSync(incidentPath, "utf8");
    assert.match(incidentContent, /kill_stage: 'sigkill'/, "the finalised incident record must also carry the real stage");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    if (controlServer) await new Promise((resolve) => controlServer!.close(resolve));
    rmSync(dir, { recursive: true, force: true });
    rmSync(incidentsDir, { recursive: true, force: true });
  }
});

test("vice_recycle: an ack with a refusal produces an error result naming the refusal, and finalises the incident record with that outcome", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-recycle-refused-"));
  const incidentsDir = tmpIncidentsDir();
  const { server } = startStandInServer();
  const port = await listen(server);
  const recycle = makeControllableRecycle();
  let controlServer: NetServer | null = null;
  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_MCP_HOST: "127.0.0.1",
    VICE_INCIDENTS_DIR: incidentsDir,
  });
  try {
    await handshake(proxy);
    const acquired = await acquireLeaseViaBroker(proxy, dir, port, 3, recycle.onRecycle);
    controlServer = acquired.controlServer;
    writeEpochFileFixture(dir, port, { epoch: 1 });

    proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "vice_recycle", arguments: { reason: "refusal test" } } });
    await recycle.waitForCall();

    recycle.respond({
      port,
      pid: null,
      viceBin: null,
      killStage: "identity_refused",
      epochBefore: 1,
      outcome: "identity_refused",
      reason: "ps args did not match",
    });

    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, true, "a refusal must never be reported as success");
    assert.match(resp.result.content[0].text, /identity_refused|refused/i);

    const incidentPath = join(incidentsDir, readdirSync(incidentsDir)[0]);
    const incidentContent = readFileSync(incidentPath, "utf8");
    assert.match(incidentContent, /outcome: 'identity_refused'/);
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    if (controlServer) await new Promise((resolve) => controlServer!.close(resolve));
    rmSync(dir, { recursive: true, force: true });
    rmSync(incidentsDir, { recursive: true, force: true });
  }
});

test("vice_recycle: an ack that never arrives before the deadline produces a well-formed error result naming the timeout and the record path, never a hang and never a throw", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-recycle-timeout-"));
  const incidentsDir = tmpIncidentsDir();
  const { server } = startStandInServer();
  const port = await listen(server);
  // No stub configured -- startControlBroker()'s DEFAULT onRecycle never
  // acks (matches the retiring fixture's "no ack is ever written" setup),
  // so the client's own deadline is what must fire.
  let controlServer: NetServer | null = null;
  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_MCP_HOST: "127.0.0.1",
    VICE_INCIDENTS_DIR: incidentsDir,
    VICE_BROKER_RECYCLE_TIMEOUT_MS: "300", // keep the test fast -- no ack will ever be written
  });
  try {
    await handshake(proxy);
    const acquired = await acquireLeaseViaBroker(proxy, dir, port, 3, () => new Promise(() => {}));
    controlServer = acquired.controlServer;
    writeEpochFileFixture(dir, port, { epoch: 1 });

    proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "vice_recycle", arguments: { reason: "timeout test" } } });

    // No ack ever arrives -- the client's own per-request deadline must give
    // up rather than hang the proxy forever.
    const resp = await proxy.nextMessage(5000);
    assert.equal(resp.result.isError, true);
    assert.match(resp.result.content[0].text, /timeout|no ack arrived/i);
    assert.match(resp.result.content[0].text, /\.md/, "the error must name the incident record's path");

    assert.equal(proxy.child.exitCode, null, "the proxy must still be alive after a recycle timeout");
    assert.equal(proxy.child.killed, false);

    const incidentPath = join(incidentsDir, readdirSync(incidentsDir)[0]);
    const incidentContent = readFileSync(incidentPath, "utf8");
    assert.match(incidentContent, /outcome: 'timeout'/);
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    if (controlServer) await new Promise((resolve) => controlServer!.close(resolve));
    rmSync(dir, { recursive: true, force: true });
    rmSync(incidentsDir, { recursive: true, force: true });
  }
});

test("vice_recycle: the broker dropping the connection mid-recycle is reported distinctly from a refusal acknowledgement", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-recycle-brokergone-"));
  const incidentsDir = tmpIncidentsDir();
  const { server } = startStandInServer();
  const port = await listen(server);
  let controlServer: NetServer | null = null;
  let acceptedSocket: Socket | null = null;
  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_MCP_HOST: "127.0.0.1",
    VICE_INCIDENTS_DIR: incidentsDir,
  });
  try {
    await handshake(proxy);
    // onRecycle destroys the connection itself rather than ever answering --
    // the broker vanishing mid-request, as distinct from an acknowledgement
    // that carries a refusal.
    const acquired = await acquireLeaseViaBroker(proxy, dir, port, 3, async () => {
      acceptedSocket!.destroy();
      return new Promise(() => {});
    });
    controlServer = acquired.controlServer;
    acceptedSocket = acquired.controlSocket;
    writeEpochFileFixture(dir, port, { epoch: 1 });

    proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "vice_recycle", arguments: { reason: "broker-gone test" } } });

    const resp = await proxy.nextMessage(5000);
    assert.equal(resp.result.isError, true);
    const text = resp.result.content[0].text;
    assert.match(text, /broker/i);
    // D-14 (plan 08): the recycle path's broker-gone branch now reuses the
    // same fresh-machine vocabulary a forwarded call's own broker-gone path
    // produces (sessionMustRestartMessage()) rather than a bare transport
    // error string -- named explicitly here, not just "mentions broker".
    assert.match(text, /restart/i, "a broker-gone recycle outcome must state the session must be restarted");
    assert.doesNotMatch(text, /identity_refused/i, "a broker-gone outcome text must not read as a refusal acknowledgement");

    const incidentPath = join(incidentsDir, readdirSync(incidentsDir)[0]);
    const incidentContent = readFileSync(incidentPath, "utf8");
    assert.match(incidentContent, /outcome: 'broker_gone'/);
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    if (controlServer) await new Promise((resolve) => controlServer!.close(resolve));
    rmSync(dir, { recursive: true, force: true });
    rmSync(incidentsDir, { recursive: true, force: true });
  }
});

test("vice_recycle: after a confirmed recycle, a subsequent forwarded call succeeds rather than failing the epoch drift guard", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-recycle-rebaseline-"));
  const incidentsDir = tmpIncidentsDir();
  const { server, requests } = startStandInServer();
  const port = await listen(server);
  const recycle = makeControllableRecycle();
  let controlServer: NetServer | null = null;
  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_MCP_HOST: "127.0.0.1",
    VICE_INCIDENTS_DIR: incidentsDir,
  });
  try {
    await handshake(proxy);
    const acquired = await acquireLeaseViaBroker(proxy, dir, port, 3, recycle.onRecycle);
    controlServer = acquired.controlServer;
    writeEpochFileFixture(dir, port, { epoch: 1 });

    proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "vice_recycle", arguments: { reason: "rebaseline test" } } });
    await recycle.waitForCall();

    // Simulate the deliberate identity change a real recycle causes: the
    // epoch actually moves.
    writeEpochFileFixture(dir, port, { epoch: 2 });
    recycle.respond({ port, pid: 40001, viceBin: "x64sc", killStage: "sigterm", epochBefore: 1, outcome: "ok", reason: "" });

    const recycleResp = await proxy.nextMessage();
    assert.equal(recycleResp.result.isError, false);

    // A subsequent forwarded call, against the SAME (now epoch-2) instance,
    // must succeed -- not be refused as drift, which is exactly what
    // rebaselineEpochAfterRecycle() exists to prevent.
    const requestsBefore = requests.filter((r) => r && r.method === "tools/call").length;
    proxy.send({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const pingResp = await proxy.nextMessage();
    assert.equal(pingResp.result.isError, false, "a forwarded call after a confirmed recycle must not fail the epoch drift guard");
    const requestsAfter = requests.filter((r) => r && r.method === "tools/call").length;
    assert.ok(requestsAfter > requestsBefore, "the forwarded call must actually have reached the stand-in host, not been refused pre-flight");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    if (controlServer) await new Promise((resolve) => controlServer!.close(resolve));
    rmSync(dir, { recursive: true, force: true });
    rmSync(incidentsDir, { recursive: true, force: true });
  }
});

test("vice_recycle: a confirmed kill whose epoch file never advances within the poll deadline persists epoch_after as null, never the stale value equal to epoch_before", async () => {
  // 2026-08-05 defect (.planning/todos/pending/2026-08-05-epoch-drift-and-
  // replacement-messages-name-impossible-values.md, "FOURTH artifact"): a
  // successful kill whose epoch read never actually advances used to
  // persist epoch_after equal to epoch_before (both "1") into the permanent
  // incident record, self-described as evidence_complete -- a record that
  // looks complete but carries a claim that cannot be true for a genuinely
  // successful kill. This test never bumps the epoch fixture after the ack,
  // simulating exactly that "sampled too early / never observed to move"
  // case, and asserts the persisted record is left honestly null ("not yet
  // known") rather than silently equal to epoch_before.
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-recycle-epochstale-"));
  const incidentsDir = tmpIncidentsDir();
  const { server } = startStandInServer();
  const port = await listen(server);
  const recycle = makeControllableRecycle();
  let controlServer: NetServer | null = null;
  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_MCP_HOST: "127.0.0.1",
    VICE_INCIDENTS_DIR: incidentsDir,
    VICE_BROKER_RECYCLE_TIMEOUT_MS: "300", // keep the post-kill epoch poll fast -- it must never observe a move
  });
  try {
    await handshake(proxy);
    const acquired = await acquireLeaseViaBroker(proxy, dir, port, 3, recycle.onRecycle);
    controlServer = acquired.controlServer;
    writeEpochFileFixture(dir, port, { epoch: 1 });

    proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "vice_recycle", arguments: { reason: "stale epoch test" } } });
    await recycle.waitForCall();

    // Deliberately NOT bumping the epoch fixture here (contrast with the
    // rebaseline test above, which writes epoch: 2 at this exact point) --
    // the kill succeeds, but the epoch file this session reads stays at 1
    // for the whole poll window.
    recycle.respond({ port, pid: 40001, viceBin: "x64sc", killStage: "sigterm", epochBefore: 1, outcome: "ok", reason: "" });

    const resp = await proxy.nextMessage(5000);
    assert.equal(resp.result.isError, false, "a successful kill stage is still success even when the epoch never moved");
    assert.match(resp.result.content[0].text, /did not move within the timeout/);

    const incidentPath = join(incidentsDir, readdirSync(incidentsDir)[0]);
    const incidentContent = readFileSync(incidentPath, "utf8");
    assert.match(incidentContent, /epoch_before: 1/);
    assert.match(incidentContent, /epoch_after: null/, "epoch_after must be persisted as null, never the stale value equal to epoch_before");
    assert.doesNotMatch(incidentContent, /epoch_after: 1\b/, "the persisted record must never carry a false equal epoch_before/epoch_after pair");
    assert.match(incidentContent, /epoch after recycle: \(not yet known\)/, "the rendered body must say 'not yet known', matching renderIncidentRecord()'s own null handling");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    if (controlServer) await new Promise((resolve) => controlServer!.close(resolve));
    rmSync(dir, { recursive: true, force: true });
    rmSync(incidentsDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Plan 01.3-03 task 1: gatherWedgeEvidence() -- criterion 4's full evidence
// set, composed from plan 01.3-02's own primitives (runCycleBracket(),
// resolveLiveIrqHandler()) plus the register/checkpoint/screenshot reads,
// exercised end to end through vice_recycle (gatherWedgeEvidence() is
// proxy-internal with no export, same as handleDiagnose()'s own primitives
// in the section above -- reached only through the tool surface).
// ---------------------------------------------------------------------------

/** A sentinel telling startFlexibleStandInServer()'s request handler to
 * deliberately never respond -- the connection is left open until the
 * client's own AbortSignal.timeout fires. Exercises the capture-step
 * deadline (CAPTURE_STEP_TIMEOUT_MS / VICE_RECYCLE_CAPTURE_TIMEOUT_MS)
 * rather than an immediate rejection. */
const HANG = Symbol("vice-proxy-test: hang, never respond");

/** MUST live INSIDE the mounted workspace -- unlike tmpIncidentsDir() above
 * (deliberately outside it, for the pre-existing recycle tests that never
 * exercise the screenshot's path translation), this section's "healthy"
 * fixtures need a REAL translation to succeed end to end, not merely
 * demonstrate the out-of-workspace refusal path. Cleaned up by the caller's
 * own finally block, same as tmpIncidentsDir(). */
function tmpWorkspaceIncidentsDir() {
  // Any directory inside the resolved workspace root works -- the screenshot
  // path translation only needs a real path under the workspace. The base is
  // created if absent so this does not depend on the originating project's
  // `.planning/` directory existing (it does not in a standalone checkout).
  const base = join(repoRoot(), ".planning");
  mkdirSync(base, { recursive: true });
  return mkdtempSync(join(base, "vice-proxy-evidence-test-"));
}

/**
 * A `respond(name, args)` function for gatherWedgeEvidence()'s own forwarded
 * reads: a healthy default for every tool it calls (vice_ping,
 * vice_checkpoint_list, vice_registers_get, vice_memory_read, the cycle
 * bracket's vice_cycles_stopwatch/vice_execution_run/vice_execution_pause,
 * vice_display_screenshot, and vice_snapshot_save), with any field
 * override-able per test via `overrides`.
 */
interface HealthyEvidenceOverrides {
  checkpoints?: any[];
  registers?: any;
  port01?: number;
  ramVector?: number[];
  stopwatchCycles?: number;
}

function healthyEvidenceRespond(overrides: HealthyEvidenceOverrides = {}): RespondFn {
  const {
    checkpoints = [],
    registers = { PC: 0x1000, A: 0, X: 0, Y: 0, SP: 0xf0 },
    port01 = 0x37, // banked in
    ramVector = [0x31, 0xea],
    stopwatchCycles = 500000,
  } = overrides;
  return (name: string, args: any) => {
    if (name === "vice_ping") return { version: "3.10", machine: "C64SC", execution: "paused" };
    if (name === "vice_checkpoint_list") return { checkpoints };
    if (name === "vice_registers_get") return registers;
    if (name === "vice_memory_read") {
      if (args.address === "$01") return memHex([port01]);
      if (args.address === "$0314") return memHex(ramVector);
    }
    if (name === "vice_cycles_stopwatch") {
      if (args.action === "read") return { cycles: stopwatchCycles };
      return { status: "ok" };
    }
    if (name === "vice_execution_run") return { status: "ok" };
    if (name === "vice_execution_pause") return { status: "ok" };
    if (name === "vice_display_screenshot") return { status: "ok" };
    if (name === "vice_snapshot_save") return { status: "ok" };
    return undefined;
  };
}

test("vice_recycle: a healthy capture produces a full evidence object -- bracket, registers, checkpoints, IRQ handler and a translated screenshot path", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-recycle-evidence-healthy-"));
  const evidenceDir = tmpWorkspaceIncidentsDir();
  const respond = healthyEvidenceRespond({
    checkpoints: [{ checkpoint_num: 9, start: "$4000", stop: true, exec: true, enabled: true, hit_count: 2 }],
  });
  const { server, requests } = startFlexibleStandInServer(respond);
  const port = await listen(server);
  const recycle = makeControllableRecycle();
  let controlServer: NetServer | null = null;
  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_MCP_HOST: "127.0.0.1",
    VICE_INCIDENTS_DIR: evidenceDir,
  });
  try {
    await handshake(proxy);
    const acquired = await acquireLeaseViaBroker(proxy, dir, port, 3, recycle.onRecycle);
    controlServer = acquired.controlServer;
    writeEpochFileFixture(dir, port, { epoch: 1 });

    proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "vice_recycle", arguments: { reason: "evidence test" } } });
    await recycle.waitForCall();
    writeEpochFileFixture(dir, port, { epoch: 2 });
    recycle.respond({ port, pid: 40001, viceBin: "x64sc", killStage: "sigterm", epochBefore: 1, outcome: "ok", reason: "" });

    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, false);

    const incidentFile = readdirSync(evidenceDir).find((f) => f.endsWith(".md"));
    assert.ok(incidentFile, "an incident record must have been written");
    const content = readFileSync(join(evidenceDir, incidentFile), "utf8");

    assert.match(content, /## Evidence/);
    assert.match(content, /cycle bracket: \d+ cycles retired/);
    assert.match(content, /PC \$1000/);
    assert.match(content, /#9 \$4000 \(stop, enabled\)/);
    assert.match(content, /RAM IRQ vector pair/);
    assert.match(content, /screenshot: saved to /);
    assert.match(content, /pre-kill snapshot attempt: accepted \(name: /);
    assert.match(content, /evidence_complete: true/);

    const screenshotCall = requests.find((r) => r && r.method === "tools/call" && r.params && r.params.name === "vice_display_screenshot");
    assert.ok(screenshotCall, "the screenshot capability must have been called");
    const receivedPath = screenshotCall.params.arguments.path;
    const translatedPrefix = hostPath(evidenceDir);
    assert.ok(
      receivedPath.startsWith(translatedPrefix),
      `expected the stand-in's received screenshot path (${receivedPath}) to start with the translated prefix (${translatedPrefix})`
    );
    assert.ok(!receivedPath.startsWith(evidenceDir), "the argument must be the translated HOST path, not the container path");

    assert.match(resp.result.content[0].text, /Snapshot: accepted/);
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    if (controlServer) await new Promise((resolve) => controlServer!.close(resolve));
    rmSync(dir, { recursive: true, force: true });
    rmSync(evidenceDir, { recursive: true, force: true });
  }
});

test("vice_recycle: a rejected screenshot capture records unavailable with the reason, and every other evidence entry is still populated", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-recycle-evidence-noscreenshot-"));
  const evidenceDir = tmpWorkspaceIncidentsDir();
  const healthy = healthyEvidenceRespond({});
  const respond = (name: string, args: any) => (name === "vice_display_screenshot" ? undefined : healthy(name, args));
  const { server } = startFlexibleStandInServer(respond);
  const port = await listen(server);
  const recycle = makeControllableRecycle();
  let controlServer: NetServer | null = null;
  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_MCP_HOST: "127.0.0.1",
    VICE_INCIDENTS_DIR: evidenceDir,
  });
  try {
    await handshake(proxy);
    const acquired = await acquireLeaseViaBroker(proxy, dir, port, 3, recycle.onRecycle);
    controlServer = acquired.controlServer;
    writeEpochFileFixture(dir, port, { epoch: 1 });

    proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "vice_recycle", arguments: { reason: "no screenshot test" } } });
    await recycle.waitForCall();
    writeEpochFileFixture(dir, port, { epoch: 2 });
    recycle.respond({ port, pid: 40001, viceBin: "x64sc", killStage: "sigterm", epochBefore: 1, outcome: "ok", reason: "" });

    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, false, "a rejected screenshot must not fail the recycle");

    const incidentFile = readdirSync(evidenceDir).find((f) => f.endsWith(".md"));
    assert.ok(incidentFile, "an incident record must have been written");
    const content = readFileSync(join(evidenceDir, incidentFile), "utf8");
    assert.match(content, /screenshot: unavailable \(/);
    assert.match(content, /cycle bracket: \d+ cycles retired/, "the bracket entry must still be populated");
    assert.match(content, /PC \$1000/, "the register entry must still be populated");
    assert.match(content, /evidence_complete: false/);
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    if (controlServer) await new Promise((resolve) => controlServer!.close(resolve));
    rmSync(dir, { recursive: true, force: true });
    rmSync(evidenceDir, { recursive: true, force: true });
  }
});

test("vice_recycle: a rejected checkpoint enumeration records unavailable for that entry, and the capture still returns", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-recycle-evidence-nocheckpoints-"));
  const incidentsDir = tmpIncidentsDir();
  const healthy = healthyEvidenceRespond({});
  const respond = (name: string, args: any) => (name === "vice_checkpoint_list" ? undefined : healthy(name, args));
  const { server } = startFlexibleStandInServer(respond);
  const port = await listen(server);
  const recycle = makeControllableRecycle();
  let controlServer: NetServer | null = null;
  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_MCP_HOST: "127.0.0.1",
    VICE_INCIDENTS_DIR: incidentsDir,
  });
  try {
    await handshake(proxy);
    const acquired = await acquireLeaseViaBroker(proxy, dir, port, 3, recycle.onRecycle);
    controlServer = acquired.controlServer;
    writeEpochFileFixture(dir, port, { epoch: 1 });

    proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "vice_recycle", arguments: { reason: "no checkpoints test" } } });
    await recycle.waitForCall();
    writeEpochFileFixture(dir, port, { epoch: 2 });
    recycle.respond({ port, pid: 40001, viceBin: "x64sc", killStage: "sigterm", epochBefore: 1, outcome: "ok", reason: "" });

    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, false);

    const incidentFile = readdirSync(incidentsDir).find((f) => f.endsWith(".md"));
    assert.ok(incidentFile, "an incident record must have been written");
    const content = readFileSync(join(incidentsDir, incidentFile), "utf8");
    assert.match(content, /armed checkpoints: unavailable \(/);
    assert.match(content, /cycle bracket: \d+ cycles retired/);
    assert.match(content, /RAM IRQ vector pair/);
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    if (controlServer) await new Promise((resolve) => controlServer!.close(resolve));
    rmSync(dir, { recursive: true, force: true });
    rmSync(incidentsDir, { recursive: true, force: true });
  }
});

test("vice_recycle: a stand-in that rejects every read produces a fully-populated (all-unavailable) evidence object, and the capture still returns rather than throwing", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-recycle-evidence-allrejected-"));
  const incidentsDir = tmpIncidentsDir();
  // Only vice_ping is answered (needed for lease acquisition and the
  // generic path's own preflight probe) -- every evidence-specific read is
  // left unhandled, which the stand-in answers with an immediate JSON-RPC
  // error (never a hang).
  const respond = (name: string) => (name === "vice_ping" ? { version: "3.10", machine: "C64SC", execution: "paused" } : undefined);
  const { server } = startFlexibleStandInServer(respond);
  const port = await listen(server);
  const recycle = makeControllableRecycle();
  let controlServer: NetServer | null = null;
  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_MCP_HOST: "127.0.0.1",
    VICE_INCIDENTS_DIR: incidentsDir,
  });
  try {
    await handshake(proxy);
    const acquired = await acquireLeaseViaBroker(proxy, dir, port, 3, recycle.onRecycle);
    controlServer = acquired.controlServer;
    writeEpochFileFixture(dir, port, { epoch: 1 });

    proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "vice_recycle", arguments: { reason: "all rejected test" } } });
    await recycle.waitForCall();
    writeEpochFileFixture(dir, port, { epoch: 2 });
    recycle.respond({ port, pid: 40001, viceBin: "x64sc", killStage: "sigterm", epochBefore: 1, outcome: "ok", reason: "" });

    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, false, "the recycle must still complete even when every evidence read is rejected");

    const incidentFile = readdirSync(incidentsDir).find((f) => f.endsWith(".md"));
    assert.ok(incidentFile, "an incident record must have been written");
    const content = readFileSync(join(incidentsDir, incidentFile), "utf8");
    assert.match(content, /cycle bracket: unavailable \(/);
    assert.match(content, /program counter \/ register snapshot: unavailable \(/);
    assert.match(content, /armed checkpoints: unavailable \(/);
    assert.match(content, /resolved live IRQ handler: unavailable \(/);
    assert.match(content, /screenshot: unavailable \(/);
    assert.match(content, /evidence_complete: false/);
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    if (controlServer) await new Promise((resolve) => controlServer!.close(resolve));
    rmSync(dir, { recursive: true, force: true });
    rmSync(incidentsDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Plan 01.3-03 task 2: the pre-kill snapshot attempt (last capture step,
// D-19) and the two guards over the whole gather-then-record ordering
// (the strengthened filesystem-ordering test above, and the region-scoped
// source check below).
// ---------------------------------------------------------------------------

test("vice_recycle: a rejected snapshot attempt records unavailable with the reason, and the recycle still completes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-recycle-snapshot-rejected-"));
  const incidentsDir = tmpIncidentsDir();
  const healthy = healthyEvidenceRespond({});
  const respond = (name: string, args: any) => (name === "vice_snapshot_save" ? undefined : healthy(name, args));
  const { server } = startFlexibleStandInServer(respond);
  const port = await listen(server);
  const recycle = makeControllableRecycle();
  let controlServer: NetServer | null = null;
  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_MCP_HOST: "127.0.0.1",
    VICE_INCIDENTS_DIR: incidentsDir,
  });
  try {
    await handshake(proxy);
    const acquired = await acquireLeaseViaBroker(proxy, dir, port, 3, recycle.onRecycle);
    controlServer = acquired.controlServer;
    writeEpochFileFixture(dir, port, { epoch: 1 });

    proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "vice_recycle", arguments: { reason: "snapshot rejected test" } } });
    await recycle.waitForCall();
    writeEpochFileFixture(dir, port, { epoch: 2 });
    recycle.respond({ port, pid: 40001, viceBin: "x64sc", killStage: "sigterm", epochBefore: 1, outcome: "ok", reason: "" });

    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, false, "a rejected snapshot must not fail the recycle");
    assert.match(resp.result.content[0].text, /Snapshot: unavailable \(/);

    const incidentFile = readdirSync(incidentsDir).find((f) => f.endsWith(".md"));
    assert.ok(incidentFile, "an incident record must have been written");
    const content = readFileSync(join(incidentsDir, incidentFile), "utf8");
    assert.match(content, /pre-kill snapshot attempt: unavailable \(/);
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    if (controlServer) await new Promise((resolve) => controlServer!.close(resolve));
    rmSync(dir, { recursive: true, force: true });
    rmSync(incidentsDir, { recursive: true, force: true });
  }
});

test("vice_recycle: an unanswered snapshot call does not prevent the recycle from completing", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-recycle-snapshot-hang-"));
  const incidentsDir = tmpIncidentsDir();
  const healthy = healthyEvidenceRespond({});
  const respond = (name: string, args: any) => (name === "vice_snapshot_save" ? HANG : healthy(name, args));
  const { server } = startFlexibleStandInServer(respond);
  const port = await listen(server);
  const recycle = makeControllableRecycle();
  let controlServer: NetServer | null = null;
  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_MCP_HOST: "127.0.0.1",
    VICE_INCIDENTS_DIR: incidentsDir,
    // Overrides the 8s production default so this fixture's deliberate hang
    // resolves in milliseconds rather than minutes -- see CAPTURE_STEP_TIMEOUT_MS's
    // own header comment in vice-proxy.mjs for why this is a TRANSPORT
    // deadline, never the forbidden wall-clock pacing of the emulated machine.
    VICE_RECYCLE_CAPTURE_TIMEOUT_MS: "200",
  });
  try {
    await handshake(proxy);
    const acquired = await acquireLeaseViaBroker(proxy, dir, port, 3, recycle.onRecycle);
    controlServer = acquired.controlServer;
    writeEpochFileFixture(dir, port, { epoch: 1 });

    proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "vice_recycle", arguments: { reason: "snapshot hang test" } } });
    await recycle.waitForCall();
    writeEpochFileFixture(dir, port, { epoch: 2 });
    recycle.respond({ port, pid: 40001, viceBin: "x64sc", killStage: "sigterm", epochBefore: 1, outcome: "ok", reason: "" });

    const resp = await proxy.nextMessage(15000);
    assert.equal(resp.result.isError, false, "the recycle must still complete despite the hung snapshot call");
    assert.match(resp.result.content[0].text, /Snapshot: unavailable/i);

    const incidentFile = readdirSync(incidentsDir).find((f) => f.endsWith(".md"));
    assert.ok(incidentFile, "an incident record must have been written");
    const content = readFileSync(join(incidentsDir, incidentFile), "utf8");
    assert.match(content, /pre-kill snapshot attempt: unavailable \(/);
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    if (controlServer) await new Promise((resolve) => controlServer!.close(resolve));
    rmSync(dir, { recursive: true, force: true });
    rmSync(incidentsDir, { recursive: true, force: true });
  }
});

test("vice_recycle: two recycles at the same port and epoch produce two distinct record files, and the first is byte-unchanged", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-recycle-twice-"));
  const incidentsDir = tmpIncidentsDir();
  const { server } = startFlexibleStandInServer(healthyEvidenceRespond({}));
  const port = await listen(server);
  const recycle = makeControllableRecycleSequence();
  let controlServer: NetServer | null = null;
  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_MCP_HOST: "127.0.0.1",
    VICE_INCIDENTS_DIR: incidentsDir,
  });
  try {
    await handshake(proxy);
    const acquired = await acquireLeaseViaBroker(proxy, dir, port, 3, recycle.onRecycle);
    controlServer = acquired.controlServer;
    // epoch.json reads 1 at the moment EACH recycle's own preKillEpoch is
    // captured (handleRecycle()'s very first read) -- that is the "same
    // port and epoch" this test is about, since it drives the incident
    // record's own filename stem. It is bumped and reset around each ack
    // below purely so each call's OWN post-kill "epoch moved" wait (a
    // separate, unrelated concern) resolves quickly rather than spinning
    // to its ~30s deadline.
    writeEpochFileFixture(dir, port, { epoch: 1 });

    proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "vice_recycle", arguments: { reason: "first recycle" } } });
    const first = await recycle.next();
    writeEpochFileFixture(dir, port, { epoch: 2 });
    first.respond({ port, pid: 40001, viceBin: "x64sc", killStage: "sigterm", epochBefore: 1, outcome: "ok", reason: "" });
    const resp1 = await proxy.nextMessage();
    assert.equal(resp1.result.isError, false);

    const filesAfterFirst = readdirSync(incidentsDir).filter((f) => f.endsWith(".md"));
    assert.equal(filesAfterFirst.length, 1);
    const firstPath = join(incidentsDir, filesAfterFirst[0]);
    const firstContentAfterFirstRecycle = readFileSync(firstPath, "utf8");
    assert.match(firstContentAfterFirstRecycle, /first recycle/);

    // Reset epoch.json back to 1 BEFORE issuing the second recycle, so its
    // own preKillEpoch read (handleRecycle()'s first line) sees the SAME
    // epoch value as the first call did -- rebaselineEpochAfterRecycle()
    // clears the session, not the lease, so a second vice_recycle call can
    // be issued immediately, same as production.
    writeEpochFileFixture(dir, port, { epoch: 1 });
    proxy.send({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "vice_recycle", arguments: { reason: "second recycle" } } });
    const second = await recycle.next();
    writeEpochFileFixture(dir, port, { epoch: 2 });
    second.respond({ port, pid: 40001, viceBin: "x64sc", killStage: "sigterm", epochBefore: 1, outcome: "ok", reason: "" });
    const resp2 = await proxy.nextMessage();
    assert.equal(resp2.result.isError, false);

    const filesAfterSecond = readdirSync(incidentsDir).filter((f) => f.endsWith(".md"));
    assert.equal(filesAfterSecond.length, 2, "two recycles at the same port/epoch must produce two distinct files, not one clobbered file");

    const firstContentAfterSecondRecycle = readFileSync(firstPath, "utf8");
    assert.equal(
      firstContentAfterSecondRecycle,
      firstContentAfterFirstRecycle,
      "the first record must be byte-unchanged after the second recycle writes its own file"
    );

    const secondFile = filesAfterSecond.find((f) => join(incidentsDir, f) !== firstPath);
    assert.ok(secondFile, "a second, distinct incident file must exist");
    const secondContent = readFileSync(join(incidentsDir, secondFile), "utf8");
    assert.match(secondContent, /second recycle/);
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    if (controlServer) await new Promise((resolve) => controlServer!.close(resolve));
    rmSync(dir, { recursive: true, force: true });
    rmSync(incidentsDir, { recursive: true, force: true });
  }
});

test("structural: within handleRecycle(), the record write appears before the request write (D-17's ordering guard, region-scoped)", () => {
  const src = readFileSync(PROXY_PATH, "utf8");
  const startIdx = src.indexOf("async function handleRecycle(args)");
  assert.ok(startIdx >= 0, "handleRecycle()'s own definition must be found in the source");
  const endIdx = src.indexOf("\n}\n", startIdx);
  assert.ok(endIdx > startIdx, "could not isolate handleRecycle()'s own closing brace");
  const body = src.slice(startIdx, endIdx);

  const recordCallIdx = body.indexOf("writeIncidentRecord(");
  const requestCallIdx = body.indexOf("controlSession.recycle(");
  assert.ok(recordCallIdx >= 0, "writeIncidentRecord( must appear inside handleRecycle()'s own body");
  assert.ok(requestCallIdx >= 0, "controlSession.recycle( must appear inside handleRecycle()'s own body");

  // Mirrors "checked by comparing the two line numbers grep -n reports" --
  // an earlier byte offset within the same isolated body is exactly an
  // earlier line number would be.
  assert.ok(
    recordCallIdx < requestCallIdx,
    "the incident record write must appear (and therefore execute) before the recycle request over the control connection inside handleRecycle()"
  );
});

// ---------------------------------------------------------------------------
// Plan 01.3-01 task 2: the two structural guards keeping this phase inside
// the only-permitted-route rule (criteria 5, 8, 9 in 01.3-VALIDATION.md).
// ---------------------------------------------------------------------------

test("structural: the set of source files under .claude/mcp/vice/ containing a network-call construct is exactly broker-launch.mts, vice-probe.ts and vice.ts", () => {
  // Directory-enumerating, matching skill-docs.test.mjs's own idiom -- a
  // future module joining this directory is covered the moment it lands on
  // disk, with no test file to remember to update. A "network-call
  // construct" here means an actual outbound call site (`fetch(`), not
  // merely the word "fetch" appearing in prose or a variable name.
  //
  // WIDENED, Phase 01.6.1 Task 1 (a fourth extension-hardcoded static check,
  // not named by this phase's own RESEARCH/PATTERNS documents): the original
  // `.endsWith(".mjs")` predicate went silently -- in this case actually
  // LOUDLY, this file's own assertion caught it live -- vacuous the moment
  // vice-probe.mjs (this test's own named example) renamed to vice-probe.ts
  // in the same task. vice-proxy.mjs and this test file are themselves
  // deferred to their own later plan (RESEARCH §2 Slice 9); only this one
  // check's file-enumeration predicate is widened here, to the same
  // `[cm]?[jt]s` class used throughout this phase's other enumerators --
  // vice-proxy.mjs/vice-proxy.test.mjs are not renamed or otherwise touched.
  //
  // UPDATED, Phase 01.6.1 Plan 05 (the vice.mjs->vice.ts rename this fourth
  // enumerator's own expected-offenders array was flagged, since Wave 1, as
  // needing an update the moment this rename landed): the array entry is
  // renamed to match, not deleted -- the check still enforces the same
  // two-file network-call surface, it just tracks the surviving name.
  //
  // WIDENED, Phase 01.6.2 plan 02: broker-launch.mts's probeReady() gained
  // an HTTP readiness POST (the fetch()-based branch of its three-way
  // probe, D-05's permitted-route note) against the emulator instance it
  // ITSELF spawned and owns the lifecycle of -- host-side broker code, not
  // container-side code reaching the emulator outside mcp__vice__*. This
  // guard's original scope (this file's own header comment, Plan 01.3-01)
  // predates the host-side broker's existence entirely; vice-broker-launch
  // .test.ts's own JUSTIFIED_NETWORK_CALLERS carries the full justification
  // for every host-bound module's network construct -- this array is
  // widened to match rather than re-litigated here.
  const NETWORK_CALL_PATTERN = /\bfetch\s*\(/;
  const files = readdirSync(HERE)
    .filter((f) => /\.[cm]?[jt]s$/.test(f) && !/\.test\.[cm]?[jt]s$/.test(f))
    .sort();
  assert.ok(files.length > 0, "module directory enumerated as empty -- glob or path resolution is broken");

  const offenders = files.filter((f) => NETWORK_CALL_PATTERN.test(readFileSync(join(HERE, f), "utf8")));
  assert.deepEqual(
    offenders.sort(),
    ["broker-launch.mts", "vice-probe.ts", "vice.ts"],
    `the network-call module set changed -- expected exactly ["broker-launch.mts", "vice-probe.ts", "vice.ts"], got ${JSON.stringify(offenders)}. ` +
      "A module reaching the host outside the sanctioned transport is the violation, not merely a style break."
  );
});

test("structural: neither synthetic tool name appears in tools-manifest.json, and both appear in a live tools/list response", async () => {
  const manifestText = readFileSync(join(HERE, "tools-manifest.json"), "utf8");
  assert.ok(!manifestText.includes("vice_recycle"), "vice_recycle must never be added to the committed manifest -- it is served proxy-local");
  assert.ok(!manifestText.includes("vice_result_continue"), "vice_result_continue must never be added to the committed manifest either");

  const { server } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });
  try {
    await handshake(proxy);
    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/list", params: {} });
    const resp = await proxy.nextMessage();
    const names = resp.result.tools.map((t: any) => t.name);
    assert.ok(names.includes("vice_recycle"), "vice_recycle must be present in a live tools/list response");
    assert.ok(names.includes("vice_result_continue"), "vice_result_continue must be present in a live tools/list response");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

test("vice_disk_list is still absent from tools/list and still refused at tools/call, with both synthetic tools present", async () => {
  const { server, requests } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });
  try {
    await handshake(proxy);
    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/list", params: {} });
    const listResp = await proxy.nextMessage();
    const names = listResp.result.tools.map((t: any) => t.name);
    assert.ok(!names.includes("vice_disk_list"), "vice_disk_list must remain absent");
    assert.ok(names.includes("vice_recycle"));
    assert.ok(names.includes("vice_result_continue"));

    proxy.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "vice_disk_list", arguments: {} } });
    const callResp = await proxy.nextMessage();
    assert.equal(callResp.result.isError, true, "vice_disk_list must still be refused at call time");
    assert.equal(requests.length, 0, "the refusal must make no request to the stand-in host");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

// -----------------------------------------------------------------------
// HISTORY (read before editing further): Plan 01.6.3-03's full-manifest
// registration widened the registry to include the host's own generic-
// surface meta-tools (tools_call/tools_list/initialize/
// notifications_initialized), which the manifest lists as ordinary
// forwardable tools. That plan's own job was narrowly scoped -- ASSERT that
// registering the full manifest did not WIDEN the pre-existing
// nested-argument bypass Phase 01.4 criterion 3 had already recorded as a
// live, confirmed breach concern, not to fix or ignore it (a genuine design
// decision, deliberately left to whoever owned criterion 3 -- see
// .planning/todos/pending/2026-08-05-generic-surface-deny-list-gap-tools-call-nested-vice-disk-list.md).
// This test used to prove exactly that: a bare tools_call, forwarded like
// any other manifest tool, carrying a nested `name: "vice_disk_list"`
// argument, reached the stand-in host with that argument intact, because
// the DENY_LIST check inspected only the OUTER name ("tools_call") and never
// the nested field.
//
// 01.4-01 (this plan, tasks 1+2) is that criterion-3 owner, and closed the
// gap: `tools_call` itself is now on DENY_LIST (Task 2), alongside
// `tools_list` (Task 1), `initialize` and `notifications_initialized`
// (Task 2). The nested argument is never even read now, because the OUTER
// name is refused first -- one array, no nested-argument parser. This test
// is REPOINTED, not deleted, to assert that closure directly against the
// exact scenario it used to prove was open: the same nested-vice_disk_list
// payload, now producing isError with zero requests reaching the stand-in.
// -----------------------------------------------------------------------

test("tools_call carrying a nested vice_disk_list argument is now refused before any request reaches the stand-in host (closes the gap the prior test proved)", async () => {
  const { server, requests } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });
  try {
    await handshake(proxy);

    // Sanity, inverted from the historical version: tools_call must now be
    // ABSENT from tools/list -- the SAME construction-time DENY_LIST skip
    // that has always kept vice_disk_list out of the registry now keeps
    // tools_call out too. If it were still present, the probe below would
    // reach `tools[name].execute()` instead of being refused at Layer 1,
    // silently passing for the wrong reason (an "Unknown tool" mismatch, not
    // a genuine refusal).
    proxy.send({ jsonrpc: "2.0", id: 10, method: "tools/list", params: {} });
    const listResp = await proxy.nextMessage();
    const names = listResp.result.tools.map((t: any) => t.name);
    assert.ok(!names.includes("tools_call"), "tools_call must now be absent from tools/list, exactly like vice_disk_list");

    // The probe itself: the EXACT payload the historical test used to prove
    // reached the stand-in -- now refused before any forwarding is even
    // attempted, because the OUTER name ("tools_call") is on DENY_LIST. The
    // nested `name: "vice_disk_list"` argument is never inspected at all;
    // it does not need to be, since the outer refusal fires first.
    proxy.send({
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: { name: "tools_call", arguments: { name: "vice_disk_list", arguments: {} } },
    });
    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, true, "tools_call must always be refused, regardless of its nested arguments");
    assert.match(resp.result.content[0].text, /tools_call/);
    assert.match(
      resp.result.content[0].text,
      /bypass|nested/i,
      "tools_call's refusal wording must name the bypass hazard shape, not the vice_disk_list crash wording verbatim"
    );
    const forwarded = requests.find((r) => r && r.method === "tools/call" && r.params && r.params.name === "tools_call");
    assert.ok(
      !forwarded,
      "the gap the prior test proved is now closed: tools_call must NOT reach the stand-in host, with or without a nested vice_disk_list argument"
    );
    assert.equal(requests.length, 0, "the stand-in server's request counter must be unchanged -- no request of any kind was made");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

// -----------------------------------------------------------------------
// 01.4-01 task 2: the benign-nested-name refusal test the plan's own
// <behavior> calls for -- {name: "vice_ping", arguments: {}}, never
// vice_disk_list, mirroring task 1's tools_list refusal test in shape.
// -----------------------------------------------------------------------

test("tools_call is refused at tools/call with no request made, even with a benign nested name", async () => {
  const { server, requests } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });

  try {
    await handshake(proxy);

    proxy.send({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "tools_call", arguments: { name: "vice_ping", arguments: {} } },
    });
    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, true, "tools_call must always be refused, even carrying a wholly benign nested name");
    assert.match(resp.result.content[0].text, /tools_call/);
    assert.equal(requests.length, 0, "the stand-in server's request counter must be unchanged");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

// -----------------------------------------------------------------------
// 01.4-01 task 2: initialize / notifications_initialized refusal tests,
// mirroring task 1's tools_list refusal test in shape -- both are now on
// DENY_LIST (this task's grep found no sanctioned caller for either as a
// TOOL; vice.ts's own MCP-protocol handshake calls rpc("initialize", ...)
// directly, a different code path that never goes through this DENY_LIST
// check at all, so this refusal cannot and does not affect it).
// -----------------------------------------------------------------------

test("initialize is refused at tools/call with no request made", async () => {
  const { server, requests } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });

  try {
    await handshake(proxy);

    proxy.send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "initialize", arguments: {} } });
    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, true, "initialize (as a tool name) must always be refused");
    assert.match(resp.result.content[0].text, /initialize/);
    assert.equal(requests.length, 0, "the stand-in server's request counter must be unchanged");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

test("notifications_initialized is refused at tools/call with no request made", async () => {
  const { server, requests } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });

  try {
    await handshake(proxy);

    proxy.send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "notifications_initialized", arguments: {} } });
    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, true, "notifications_initialized (as a tool name) must always be refused");
    assert.match(resp.result.content[0].text, /notifications_initialized/);
    assert.equal(requests.length, 0, "the stand-in server's request counter must be unchanged");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

// ---------------------------------------------------------------------------
// Plan 01.3-02 task 1: vice_diagnose's checkpoint-trap check and epoch-first
// ordering -- the read-mostly half of this phase, up to but not including
// the cycle bracket (task 2). Every fixture here is a stand-in host that
// answers each forwarded read with a scripted payload; no live emulator, no
// host, deterministic forever (D-07's synthetic proof standard for the
// detector half).
// ---------------------------------------------------------------------------

/** Encode a plain byte array as the compact "hex" vice_memory_read shape
 * resolveLiveIrqHandler() requests. */
function memHex(bytes: number[]) {
  return { hex: bytes.map((b) => b.toString(16).padStart(2, "0")).join("") };
}

/**
 * A general-purpose stand-in for vice_diagnose's own forwarded reads.
 * `respond(name, args)` is supplied by each test and returns the JSON-able
 * payload for a given tool call, or `undefined` for anything unhandled
 * (which becomes the same generic "unsupported" JSON-RPC result every other
 * stand-in in this file returns). Mutable per-call state (a $01 value that
 * flips between two diagnose calls, a checkpoint set that changes between
 * calls) is just a closure variable the test itself owns and mutates between
 * `proxy.send()` calls -- this stand-in imposes no shape of its own on that.
 */
function startFlexibleStandInServer(respond: RespondFn): StandInServer {
  const requests: (JsonRpcMessage | null)[] = [];
  const server = createServer((req, res) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      let msg: JsonRpcMessage | null;
      try {
        msg = JSON.parse(body);
      } catch {
        msg = null;
      }
      requests.push(msg);

      if (msg && msg.method === "initialize") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            id: msg.id,
            result: { protocolVersion: "2024-11-05", capabilities: {}, serverInfo: { name: "stand-in-vice", version: "0.0.0" } },
          })
        );
        return;
      }
      if (msg && msg.method === "tools/call" && msg.params) {
        const payload = respond(msg.params.name, msg.params.arguments || {});
        // Plan 01.3-03 task 2's HANG sentinel: deliberately never respond,
        // leaving the connection open until the client's own
        // AbortSignal.timeout fires -- exercises the capture-step deadline
        // rather than an immediate rejection.
        if (payload === HANG) {
          return;
        }
        if (payload !== undefined) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: JSON.stringify(payload) }] } })
          );
          return;
        }
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: msg && "id" in msg ? msg.id : null,
          error: { code: -32601, message: "unsupported in this test's stand-in server" },
        })
      );
    });
  });
  return { server, requests };
}

function sendDiagnose(proxy: ProxyHandle, id = 3): Promise<JsonRpcMessage> {
  proxy.send({ jsonrpc: "2.0", id, method: "tools/call", params: { name: "vice_diagnose", arguments: {} } });
  return proxy.nextMessage();
}

function forwardedCallsNamed(requests: (JsonRpcMessage | null)[], toolName: string): JsonRpcMessage[] {
  return requests.filter((r) => r && r.method === "tools/call" && r.params && r.params.name === toolName) as JsonRpcMessage[];
}

test("diagnose: a stopping checkpoint at the current PC is a checkpoint trap, and no bracket is run", async () => {
  const respond = (name: string, args: any) => {
    if (name === "vice_checkpoint_list") {
      return { checkpoints: [{ checkpoint_num: 1, start: "$1103", stop: true, exec: true, enabled: true, hit_count: 3 }] };
    }
    if (name === "vice_registers_get") {
      return { PC: 0x1103, A: 0, X: 0, Y: 0, SP: 0xf0 };
    }
    if (name === "vice_memory_read") {
      if (args.address === "$01") return memHex([0x37]); // banked in
      if (args.address === "$0314") return memHex([0x31, 0xea]); // default $EA31
    }
    return undefined;
  };
  const { server, requests } = startFlexibleStandInServer(respond);
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });
  try {
    await handshake(proxy);
    const resp = await sendDiagnose(proxy);
    assert.equal(resp.result.isError, false);
    assert.match(resp.result.content[0].text, /verdict: checkpoint_trap/);
    assert.match(resp.result.content[0].text, /armed checkpoint #1/);
    assert.equal(
      forwardedCallsNamed(requests, "vice_execution_run").length,
      0,
      "no resume must occur -- the trap verdict needs none"
    );
    assert.equal(
      forwardedCallsNamed(requests, "vice_cycles_stopwatch").length,
      0,
      "no stopwatch call must occur either"
    );
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

test("diagnose: a stopping checkpoint at the resolved live IRQ handler is a checkpoint trap", async () => {
  const respond = (name: string, args: any) => {
    if (name === "vice_checkpoint_list") {
      return { checkpoints: [{ checkpoint_num: 7, start: "$EA31", stop: true, exec: true, enabled: true, hit_count: 0 }] };
    }
    if (name === "vice_registers_get") {
      // Incident 1's own frozen PC -- deliberately NOT the checkpoint's own
      // address, proving this path is distinct from the "at PC" case above.
      return { PC: 0x0fab, A: 1, X: 21, Y: 38, SP: 251 };
    }
    if (name === "vice_memory_read") {
      if (args.address === "$01") return memHex([0x37]); // banked in
      if (args.address === "$0314") return memHex([0x31, 0xea]); // resolves to $EA31, matching the checkpoint
    }
    return undefined;
  };
  const { server, requests } = startFlexibleStandInServer(respond);
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });
  try {
    await handshake(proxy);
    const resp = await sendDiagnose(proxy);
    assert.equal(resp.result.isError, false);
    assert.match(resp.result.content[0].text, /verdict: checkpoint_trap/);
    assert.match(resp.result.content[0].text, /hit_count 0/);
    assert.match(resp.result.content[0].text, /never actually fired/);
    assert.equal(forwardedCallsNamed(requests, "vice_execution_run").length, 0);
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

test("diagnose: the trap report names the vector pair, the $01 value, and that remediation is not guaranteed", async () => {
  const respond = (name: string, args: any) => {
    if (name === "vice_checkpoint_list") {
      return { checkpoints: [{ checkpoint_num: 2, start: "$1574", stop: true, exec: true, enabled: true, hit_count: 5 }] };
    }
    if (name === "vice_registers_get") {
      return { PC: 0x1574 };
    }
    if (name === "vice_memory_read") {
      if (args.address === "$01") return memHex([0x35]); // banked OUT (HIRAM bit clear)
      if (args.address === "$0314") return memHex([0x31, 0xea]);
      if (args.address === "$FFFE") return memHex([0x48, 0xff]);
    }
    return undefined;
  };
  const { server } = startFlexibleStandInServer(respond);
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });
  try {
    await handshake(proxy);
    const resp = await sendDiagnose(proxy);
    const text = resp.result.content[0].text;
    assert.match(text, /hardware IRQ\/BRK vector pair/);
    assert.match(text, /\$35/i);
    assert.match(text, /not guaranteed/i);
    assert.match(text, /soft reset/);
    assert.match(text, /hard reset/);
    assert.match(text, /single step/);
    assert.match(text, /delete/);
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

test("diagnose: does not fire on disabled, non-stopping, or address-mismatched checkpoints", async () => {
  const scenario: { checkpoints: any[] } = { checkpoints: [] };
  const respond = (name: string, args: any) => {
    if (name === "vice_checkpoint_list") return { checkpoints: scenario.checkpoints };
    if (name === "vice_registers_get") return { PC: 0x4000 };
    if (name === "vice_memory_read") {
      if (args.address === "$01") return memHex([0x37]);
      if (args.address === "$0314") return memHex([0x31, 0xea]);
    }
    return undefined;
  };
  const { server } = startFlexibleStandInServer(respond);
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });
  try {
    await handshake(proxy);

    scenario.checkpoints = [{ checkpoint_num: 1, start: "$4000", stop: true, exec: true, enabled: false, hit_count: 0 }];
    const disabledResp = await sendDiagnose(proxy, 3);
    assert.doesNotMatch(disabledResp.result.content[0].text, /verdict: checkpoint_trap/, "a disabled checkpoint must not trap");

    scenario.checkpoints = [{ checkpoint_num: 2, start: "$4000", stop: false, exec: true, enabled: true, hit_count: 0 }];
    const nonStoppingResp = await sendDiagnose(proxy, 4);
    assert.doesNotMatch(
      nonStoppingResp.result.content[0].text,
      /verdict: checkpoint_trap/,
      "a non-stopping checkpoint must not trap"
    );

    scenario.checkpoints = [{ checkpoint_num: 3, start: "$9999", stop: true, exec: true, enabled: true, hit_count: 0 }];
    const mismatchResp = await sendDiagnose(proxy, 5);
    assert.doesNotMatch(
      mismatchResp.result.content[0].text,
      /verdict: checkpoint_trap/,
      "an address matching neither the PC nor the resolved handler must not trap"
    );
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

test("diagnose: a restarted epoch is reported with both epoch values, and no checkpoint enumeration is attempted", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-diagnose-epoch-"));
  const epochFile = join(dir, "epoch.json");
  writeFileSync(epochFile, JSON.stringify({ epoch: 1, pid: 111, spawned_at: "2026-08-02T00:00:00.000Z" }), "utf8");

  let checkpointListCalls = 0;
  const respond = (name: string) => {
    if (name === "vice_ping") return { version: "3.10", machine: "C64SC", execution: "paused" };
    if (name === "vice_checkpoint_list") {
      checkpointListCalls += 1;
      return { checkpoints: [] };
    }
    return undefined;
  };
  const { server } = startFlexibleStandInServer(respond);
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp`, VICE_EPOCH_FILE: epochFile });
  try {
    await handshake(proxy);
    // Establish the baseline first via a plain forwarded call.
    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    await proxy.nextMessage();

    // The epoch moves underneath the proxy -- a restart happened.
    writeFileSync(epochFile, JSON.stringify({ epoch: 2, pid: 222, spawned_at: "2026-08-02T00:05:00.000Z" }), "utf8");

    const resp = await sendDiagnose(proxy, 4);
    assert.equal(resp.result.isError, false);
    assert.match(resp.result.content[0].text, /verdict: restarted/);
    assert.match(resp.result.content[0].text, /\b1\b/);
    assert.match(resp.result.content[0].text, /\b2\b/);
    assert.equal(checkpointListCalls, 0, "no checkpoint enumeration must be attempted once a restart is already proven");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("diagnose: the live IRQ handler resolver is called fresh on every diagnose call, never cached", async () => {
  const scenario = { port01: 0x37 }; // banked in, target $EA31
  const respond = (name: string, args: any) => {
    if (name === "vice_checkpoint_list") {
      return { checkpoints: [{ checkpoint_num: 1, start: "$4000", stop: true, exec: true, enabled: true, hit_count: 3 }] };
    }
    if (name === "vice_registers_get") return { PC: 0x4000 };
    if (name === "vice_memory_read") {
      if (args.address === "$01") return memHex([scenario.port01]);
      if (args.address === "$0314") return memHex([0x31, 0xea]);
      if (args.address === "$FFFE") return memHex([0x48, 0xff]);
    }
    return undefined;
  };
  const { server } = startFlexibleStandInServer(respond);
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });
  try {
    await handshake(proxy);

    const first = await sendDiagnose(proxy, 3);
    assert.match(first.result.content[0].text, /RAM IRQ vector pair/);
    assert.match(first.result.content[0].text, /\$EA31/);

    scenario.port01 = 0x35; // banked OUT on the second call -- same proxy, same session
    const second = await sendDiagnose(proxy, 4);
    assert.match(second.result.content[0].text, /hardware IRQ\/BRK vector pair/);
    assert.match(second.result.content[0].text, /\$FF48/);
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

test("vice_diagnose appears in tools/list alongside the other synthetic tools", async () => {
  const { server } = startStandInServer();
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });
  try {
    await handshake(proxy);
    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/list", params: {} });
    const resp = await proxy.nextMessage();
    const names = resp.result.tools.map((t: any) => t.name);
    assert.ok(names.includes("vice_diagnose"), "vice_diagnose must be present in a live tools/list response");
    assert.ok(names.includes("vice_recycle"));
    assert.ok(names.includes("vice_result_continue"));
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

// ---------------------------------------------------------------------------
// Plan 01.3-02 task 2: the cycle bracket, one definition, and the three
// verdicts that need it (wedged, stale_read_path, live). No checkpoints are
// armed in any fixture below, so every call here passes cleanly through
// task 1's trap check and reaches the bracket.
// ---------------------------------------------------------------------------

/**
 * Builds a `respond(name, args)` function for the bracket-phase diagnose
 * fixtures: no checkpoints armed (the trap check always passes through
 * cleanly), a fixed banked-in $01/$0314 vector pair (irrelevant to these
 * fixtures' own verdicts, but required so resolveLiveIrqHandler() always has
 * something to read), and caller-supplied sequences for the two things each
 * bracket test actually varies -- the sequence of vice_registers_get
 * responses (index 0 is the trap check's own PC read; index 1 is the
 * bracket's regsBefore; index 2 is regsAfter) and the sequence of
 * vice_cycles_stopwatch "read" responses (index 0 is bracket 1; index 1,
 * only consumed when bracket 1 read zero, is bracket 2).
 */
function bracketPhaseHandlers({
  registerSequence,
  stopwatchReadSequence,
  pingExecution = "running",
}: {
  registerSequence: any[];
  stopwatchReadSequence: number[];
  pingExecution?: string;
}): RespondFn {
  let registerCallIndex = 0;
  let stopwatchReadIndex = 0;
  return (name: string, args: any) => {
    if (name === "vice_checkpoint_list") return { checkpoints: [] };
    if (name === "vice_registers_get") {
      const value = registerSequence[Math.min(registerCallIndex, registerSequence.length - 1)];
      registerCallIndex += 1;
      return value;
    }
    if (name === "vice_memory_read") {
      if (args.address === "$01") return memHex([0x37]); // banked in -- not exercised by these fixtures
      if (args.address === "$0314") return memHex([0x31, 0xea]);
    }
    if (name === "vice_cycles_stopwatch") {
      if (args.action === "read") {
        const value = stopwatchReadSequence[Math.min(stopwatchReadIndex, stopwatchReadSequence.length - 1)];
        stopwatchReadIndex += 1;
        return { cycles: value };
      }
      return { status: "ok" }; // reset -- response never parsed
    }
    if (name === "vice_ping") return { version: "3.10", machine: "C64SC", execution: pingExecution };
    if (name === "vice_execution_run") return { status: "ok" };
    if (name === "vice_execution_pause") return { status: "ok" };
    return undefined;
  };
}

test("diagnose: a ping-says-running, counter-frozen stand-in is wedged, and records exactly two resumes; a healthy stand-in records exactly one", async () => {
  // Wedged: both brackets read zero.
  const wedgedRespond = bracketPhaseHandlers({
    registerSequence: [{ PC: 0x2000 }, { PC: 0x2000 }, { PC: 0x2000 }],
    stopwatchReadSequence: [0, 0],
    pingExecution: "running",
  });
  const { server: wedgedServer, requests: wedgedRequests } = startFlexibleStandInServer(wedgedRespond);
  const wedgedPort = await listen(wedgedServer);
  const wedgedProxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${wedgedPort}/mcp` });
  try {
    await handshake(wedgedProxy);
    const resp = await sendDiagnose(wedgedProxy, 3);
    assert.equal(resp.result.isError, false);
    assert.match(resp.result.content[0].text, /verdict: wedged/);
    assert.equal(
      forwardedCallsNamed(wedgedRequests, "vice_execution_run").length,
      2,
      "a wedged verdict must have run exactly two brackets, i.e. exactly two resumes"
    );
  } finally {
    wedgedProxy.child.kill("SIGKILL");
    await new Promise((resolve) => wedgedServer.close(resolve));
  }

  // Healthy: the first bracket is already non-zero -- short-circuits, no second bracket.
  // regsBefore != regsAfter -- a genuinely live machine, not a stale read path.
  const healthyRespond = bracketPhaseHandlers({
    registerSequence: [{ PC: 0x2000 }, { PC: 0x2000 }, { PC: 0x2001 }],
    stopwatchReadSequence: [991000],
    pingExecution: "running",
  });
  const { server: healthyServer, requests: healthyRequests } = startFlexibleStandInServer(healthyRespond);
  const healthyPort = await listen(healthyServer);
  const healthyProxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${healthyPort}/mcp` });
  try {
    await handshake(healthyProxy);
    const resp = await sendDiagnose(healthyProxy, 3);
    assert.equal(resp.result.isError, false);
    assert.match(resp.result.content[0].text, /verdict: live/);
    assert.equal(
      forwardedCallsNamed(healthyRequests, "vice_execution_run").length,
      1,
      "a non-zero first bracket must short-circuit -- exactly one resume, no second bracket"
    );
  } finally {
    healthyProxy.child.kill("SIGKILL");
    await new Promise((resolve) => healthyServer.close(resolve));
  }
});

test("diagnose: a ping-says-not-running, counter-advancing stand-in is live -- the ping execution field decides nothing", async () => {
  const respond = bracketPhaseHandlers({
    registerSequence: [{ PC: 0x1000 }, { PC: 0x2000 }, { PC: 0x2001 }], // regsBefore != regsAfter -- not stale
    stopwatchReadSequence: [500000],
    pingExecution: "not running", // deliberately NOT "running" -- must not change the verdict
  });
  const { server } = startFlexibleStandInServer(respond);
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });
  try {
    await handshake(proxy);
    const resp = await sendDiagnose(proxy, 3);
    assert.equal(resp.result.isError, false);
    assert.match(resp.result.content[0].text, /verdict: live/);
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

test("diagnose: a byte-identical register read with an advancing counter is stale_read_path", async () => {
  const identicalRegs = { PC: 0x2014, A: 1, X: 33, Y: 56, SP: 251 };
  const respond = bracketPhaseHandlers({
    registerSequence: [{ PC: 0x0fab }, identicalRegs, identicalRegs], // regsBefore === regsAfter, byte-identical
    stopwatchReadSequence: [500000], // advancing -- the machine is not frozen
    pingExecution: "running",
  });
  const { server } = startFlexibleStandInServer(respond);
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });
  try {
    await handshake(proxy);
    const resp = await sendDiagnose(proxy, 3);
    const text = resp.result.content[0].text;
    assert.match(text, /verdict: stale_read_path/);
    assert.match(text, /stale/i);
    assert.match(text, /not frozen/i);
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

test("diagnose: a below-baseline non-zero rate (six thousand cycles/s) is reported as an observation, not a verdict of its own", async () => {
  const respond = bracketPhaseHandlers({
    registerSequence: [{ PC: 0x1000 }, { PC: 0x3000 }, { PC: 0x3001 }], // not stale
    stopwatchReadSequence: [6000],
    pingExecution: "running",
  });
  const { server } = startFlexibleStandInServer(respond);
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });
  try {
    await handshake(proxy);
    const resp = await sendDiagnose(proxy, 3);
    const text = resp.result.content[0].text;
    assert.match(text, /verdict: live/, "a below-baseline non-zero rate must still be classified live, never a degradation verdict of its own");
    assert.match(text, /6000 cycles/);
    assert.match(text, /991000 cycles\/s/, "the baseline figure must be printed beside the measured rate");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

test("structural: runCycleBracket has exactly one definition, and every stopwatch call in the file lies inside it", () => {
  const src = readFileSync(PROXY_PATH, "utf8");
  const defs = (src.match(/^async function runCycleBracket\(\)\s*\{/gm) || []).length;
  assert.equal(defs, 1, `expected exactly one runCycleBracket() definition, found ${defs}`);

  const startIdx = src.indexOf("async function runCycleBracket()");
  assert.ok(startIdx >= 0, "runCycleBracket()'s own definition must be found in the source");
  const endIdx = src.indexOf("\n}\n", startIdx);
  assert.ok(endIdx > startIdx, "could not isolate runCycleBracket()'s own closing brace");
  const body = src.slice(startIdx, endIdx);

  const stopwatchInBody = (body.match(/vice_cycles_stopwatch/g) || []).length;
  const stopwatchTotal = (src.match(/vice_cycles_stopwatch/g) || []).length;
  assert.equal(
    stopwatchInBody,
    stopwatchTotal,
    "every vice_cycles_stopwatch call in the whole file must live inside runCycleBracket()'s own body"
  );
  assert.ok(stopwatchInBody >= 2, "runCycleBracket() itself must call vice_cycles_stopwatch (reset and read)");

  assert.equal(
    (src.match(/BASELINE_CYCLES_PER_SECOND/g) || []).length,
    2,
    "BASELINE_CYCLES_PER_SECOND must appear exactly twice: its own definition and one interpolation into report text"
  );

  const pacingMatches = body.match(/setTimeout|setInterval|Atomics\.wait/g) || [];
  assert.equal(pacingMatches.length, 0, "no timer-based pacing construct may appear inside runCycleBracket()'s own body");
});

function extractDiagnoseVerdicts() {
  const src = readFileSync(PROXY_PATH, "utf8");
  const match = src.match(/const DIAGNOSE_VERDICTS = Object\.freeze\(\[([^\]]+)\]\)/);
  assert.ok(match, "DIAGNOSE_VERDICTS definition not found in source");
  return match[1].split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
}

test("structural: DIAGNOSE_VERDICTS is a frozen five-member array, and every fixture's verdict in this file is a member of it", () => {
  const verdicts = extractDiagnoseVerdicts();
  assert.equal(verdicts.length, 5, `expected exactly five verdict members, found ${verdicts.length}: ${JSON.stringify(verdicts)}`);
  assert.deepEqual(verdicts, ["restarted", "checkpoint_trap", "wedged", "stale_read_path", "live"]);

  // Parameterised: every verdict string this file's own fixtures assert
  // against (above, across both task 1 and task 2) must be drawn from this
  // same closed vocabulary -- no fixture anywhere in this suite invents a
  // sixth state.
  const fixtureVerdicts = ["restarted", "checkpoint_trap", "wedged", "stale_read_path", "live"];
  for (const v of fixtureVerdicts) {
    assert.ok(verdicts.includes(v), `fixture verdict "${v}" must be a member of DIAGNOSE_VERDICTS`);
  }
});

// ---------------------------------------------------------------------------
// Plan 01.3-04 task 1: the D-16 seam hazard annotation -- structurally the
// OPPOSITE of the vice_disk_list refusal tested earlier in this file. A
// stopping exec checkpoint arm goes through to the host UNCHANGED and comes
// back annotated, never refused.
// ---------------------------------------------------------------------------

function sendCheckpointAdd(proxy: ProxyHandle, args: Record<string, unknown>, id = 3): Promise<JsonRpcMessage> {
  proxy.send({ jsonrpc: "2.0", id, method: "tools/call", params: { name: "vice_checkpoint_add", arguments: args } });
  return proxy.nextMessage();
}

function checkpointAddRespond(overrides: Record<string, unknown> = {}): RespondFn {
  return (name: string, args: any) => {
    if (name === "vice_ping") return { version: "3.10", machine: "C64SC", execution: "paused" };
    if (name === "vice_checkpoint_add") {
      return { checkpoint_num: 9, start: args.start, stop: args.stop !== false, exec: args.exec !== false, ...overrides };
    }
    return undefined;
  };
}

test("seam: arming a stopping exec checkpoint is forwarded and annotated, never refused", async () => {
  const { server, requests } = startFlexibleStandInServer(checkpointAddRespond());
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });
  try {
    await handshake(proxy);
    const resp = await sendCheckpointAdd(proxy, { start: "$1103" });
    assert.equal(resp.result.isError, false, "an armed stopping exec checkpoint must never be refused");
    const text = resp.result.content[0].text;
    assert.match(text, /stopping exec checkpoint was just armed/);
    assert.match(text, /\$1103/, "the annotation must name the address that was just armed");
    assert.match(text, /common to every recorded freeze/i, "must name the shape as common to all three recorded freezes");
    assert.match(text, /vice_diagnose/, "must name the diagnose tool as the way to establish liveness of this handler");
    assert.match(text, /vice_recycle/, "must name the recovery tool in the recovery ordering");
    assert.match(text, /vice_checkpoint_toggle/, "must state the toggle/group re-enable residual");
    assert.match(text, /NOT[\s\S]*blocked/, "must state plainly the call was not blocked");
    assert.equal(
      forwardedCallsNamed(requests, "vice_checkpoint_add").length,
      1,
      "the call itself must reach the host exactly once"
    );
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

test("seam: the annotated result's error flag is false and the host payload is intact", async () => {
  const { server } = startFlexibleStandInServer(checkpointAddRespond({ checkpoint_num: 42 }));
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });
  try {
    await handshake(proxy);
    const resp = await sendCheckpointAdd(proxy, { start: "$4000" });
    assert.equal(resp.result.isError, false);
    const text = resp.result.content[0].text;
    assert.match(text, /"checkpoint_num":42/, "the host's own payload must still be present, byte-for-byte, in full");
    assert.match(text, /vice hazard/, "the hazard note must also be present alongside the payload");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

test("seam: a continue-only checkpoint, a disabled one and a non-exec watchpoint draw no annotation", async () => {
  const respond = (name: string, args: any) => {
    if (name === "vice_ping") return { version: "3.10", machine: "C64SC", execution: "paused" };
    if (name === "vice_checkpoint_add") return { checkpoint_num: 1, start: args.start, stop: args.stop, exec: args.exec };
    if (name === "vice_checkpoint_toggle") return { checkpoint_num: args.checkpoint_num, enabled: args.enabled };
    return undefined;
  };
  const { server } = startFlexibleStandInServer(respond);
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });
  try {
    await handshake(proxy);

    // Continue-only: stop explicitly false.
    const continueOnly = await sendCheckpointAdd(proxy, { start: "$5000", stop: false }, 3);
    assert.doesNotMatch(continueOnly.result.content[0].text, /vice hazard/, "a continue-only arm must draw no annotation");

    // A "disabled" re-arm: vice_checkpoint_toggle is NOT in CHECKPOINT_ARMING_TOOLS
    // at all -- its own arguments never carry a stop flag, matching the
    // stated residual (re-enabling a checkpoint is not detectable from the
    // toggle call alone).
    proxy.send({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "vice_checkpoint_toggle", arguments: { checkpoint_num: 1, enabled: true } },
    });
    const toggleResp = await proxy.nextMessage();
    assert.doesNotMatch(toggleResp.result.content[0].text, /vice hazard/, "vice_checkpoint_toggle must draw no annotation");

    // A non-exec watchpoint: exec explicitly false (a load/store watchpoint).
    const watchpoint = await sendCheckpointAdd(proxy, { start: "$6000", exec: false, store: true }, 5);
    assert.doesNotMatch(watchpoint.result.content[0].text, /vice hazard/, "a non-exec watchpoint arm must draw no annotation");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

test("seam: a checkpoint-add call the host rejects is returned as an error, with no annotation appended", async () => {
  const respond = (name: string) => {
    if (name === "vice_ping") return { version: "3.10", machine: "C64SC", execution: "paused" };
    return undefined; // vice_checkpoint_add itself is answered with the stand-in's generic JSON-RPC error
  };
  const { server } = startFlexibleStandInServer(respond);
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });
  try {
    await handshake(proxy);
    const resp = await sendCheckpointAdd(proxy, { start: "$7000" });
    assert.equal(resp.result.isError, true, "a rejected arm must come back as an error");
    assert.doesNotMatch(resp.result.content[0].text, /vice hazard/, "a failed arm has no hazard to warn about");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

test("seam: the annotation makes no additional forwarded calls", async () => {
  const { server, requests } = startFlexibleStandInServer(checkpointAddRespond());
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp` });
  try {
    await handshake(proxy);
    const resp = await sendCheckpointAdd(proxy, { start: "$8000" });
    assert.match(resp.result.content[0].text, /vice hazard/);
    // Excludes the seam's own pre-flight vice_ping liveness probe (present on
    // every forwarded call, annotated or not) -- what this asserts is that
    // the ANNOTATION contributes zero calls beyond the arm itself, which the
    // seam would have made regardless of whether a hazard fired.
    const forwardedArms = forwardedCallsNamed(requests, "vice_checkpoint_add");
    assert.equal(forwardedArms.length, 1, "the annotation itself must issue no forwarded call beyond the arm itself");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

test("seam: a repeat arm at the same address is suppressed to a pointer, and an epoch change clears it", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-seam-hazard-epoch-"));
  const epochFile = join(dir, "epoch.json");
  writeFileSync(epochFile, JSON.stringify({ epoch: 1, pid: 111, spawned_at: "2026-08-02T00:00:00.000Z" }), "utf8");

  const { server } = startFlexibleStandInServer(checkpointAddRespond());
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp`, VICE_EPOCH_FILE: epochFile });
  try {
    await handshake(proxy);

    const first = await sendCheckpointAdd(proxy, { start: "$2000" }, 3);
    assert.match(first.result.content[0].text, /vice hazard:/, "the first arm at this address must draw the full note");

    const second = await sendCheckpointAdd(proxy, { start: "$2000" }, 4);
    assert.match(second.result.content[0].text, /vice hazard \(repeat\)/, "a repeat arm at the same address must be a one-line pointer");
    assert.doesNotMatch(
      second.result.content[0].text,
      /common to every recorded freeze/,
      "the repeat pointer must not re-render the full paragraph"
    );

    // The epoch moves underneath the proxy. The VERY NEXT forwarded call
    // hits the pre-forward epoch-drift refusal (never-cache-a-negative-
    // result: the baseline re-adopts the new value on that same call), so it
    // is expected to come back as an epoch-drift ERROR, not a checkpoint
    // result -- exactly like every other forwarded call after a restart.
    writeFileSync(epochFile, JSON.stringify({ epoch: 2, pid: 222, spawned_at: "2026-08-02T00:05:00.000Z" }), "utf8");
    const duringDrift = await sendCheckpointAdd(proxy, { start: "$2000" }, 5);
    assert.equal(duringDrift.result.isError, true, "the call made during the epoch transition must be refused as a restart, not silently annotated");

    // The call AFTER that one sees no further drift (baseline already caught
    // up) and succeeds -- and the suppression set, observing the new epoch
    // for the first time, must have cleared: the full annotation reappears.
    const afterDrift = await sendCheckpointAdd(proxy, { start: "$2000" }, 6);
    assert.equal(afterDrift.result.isError, false);
    assert.match(
      afterDrift.result.content[0].text,
      /vice hazard:/,
      "the full annotation must reappear once the epoch has genuinely changed -- a new machine has seen none of the earlier warnings"
    );
    assert.doesNotMatch(afterDrift.result.content[0].text, /vice hazard \(repeat\)/);
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Plan 01.3-04 task 2: SEAM_HAZARDS -- the table that turns task 1's single
// hazard into the general mechanism D-06 needs, so plan 01.3-05's confirmed
// trigger is one entry away, never new plumbing at this seam.
// ---------------------------------------------------------------------------

const TEST_FILE_PATH = join(HERE, "vice-proxy.test.ts");

function extractSeamHazardsBody(src: string): string {
  const startIdx = src.indexOf("const SEAM_HAZARDS = [");
  assert.ok(startIdx >= 0, "SEAM_HAZARDS definition not found in source");
  const endIdx = src.indexOf("\n];", startIdx);
  assert.ok(endIdx > startIdx, "could not isolate SEAM_HAZARDS's own closing bracket");
  return src.slice(startIdx, endIdx);
}

function extractSetLiteral(src: string, constName: string): string[] | null {
  const re = new RegExp(`const ${constName} = new Set\\(\\[([^\\]]*)\\]\\)`);
  const m = src.match(re);
  if (!m) return null;
  return m[1]
    .split(",")
    .map((s) => s.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
}

test("structural: every SEAM_HAZARDS entry has a detector, an annotation and a test", () => {
  const proxySrc = readFileSync(PROXY_PATH, "utf8");
  const body = extractSeamHazardsBody(proxySrc);

  // Every entry in this table starts with `{ id:` (its first property) --
  // splitting on that marker isolates each entry's own object-literal text.
  const entryChunks = body.split(/\{\s*id:/).slice(1);
  assert.ok(entryChunks.length >= 1, "at least one SEAM_HAZARDS entry must be present");

  const testSrc = readFileSync(TEST_FILE_PATH, "utf8");
  const seenIds = [];
  for (const chunk of entryChunks) {
    const idMatch = chunk.match(/^\s*"([^"]+)"/);
    assert.ok(idMatch, "every SEAM_HAZARDS entry must carry a string id as its first property");
    const id = idMatch[1];
    assert.ok(id.length > 0, "an entry's id must be non-empty");
    assert.match(chunk, /capabilities:/, `entry "${id}" must declare its capabilities set`);
    assert.match(chunk, /detect:/, `entry "${id}" must declare a detector`);
    assert.match(chunk, /render:/, `entry "${id}" must declare a renderer`);
    assert.ok(testSrc.includes(id), `entry "${id}" must be named by at least one test in vice-proxy.test.mjs`);
    seenIds.push(id);
  }
  assert.ok(seenIds.includes("checkpoint-arming"), "the production checkpoint-arming entry must be present");
});

test("structural: the refusal set and the annotation set are disjoint", () => {
  const proxySrc = readFileSync(PROXY_PATH, "utf8");
  const viceSrc = readFileSync(join(HERE, "vice.ts"), "utf8");

  // The pattern tolerates an optional `: <type>` annotation between the name
  // and `=` (Phase 01.6.1-05 typed DENY_LIST as `readonly string[]`) -- a
  // bare `export const DENY_LIST = [` match would go silently vacuous the
  // moment the declaration gained a type annotation, exactly the
  // extension/format-hardcoded-assertion hazard this phase's own Architecture
  // Patterns section names.
  const denyMatch = viceSrc.match(/export const DENY_LIST(?:\s*:\s*[^=]+)?\s*=\s*\[([^\]]*)\]/);
  assert.ok(denyMatch, "DENY_LIST definition not found in vice.ts");
  const denyList = denyMatch[1]
    .split(",")
    .map((s) => s.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
  assert.ok(denyList.includes("vice_disk_list"), "sanity: vice_disk_list must still be on the deny list");

  const body = extractSeamHazardsBody(proxySrc);
  const annotatedCapabilities = new Set<string>();
  // Inline form: capabilities: new Set(["a", "b"])
  for (const m of body.matchAll(/capabilities:\s*new Set\(\[([^\]]*)\]\)/g)) {
    m[1]
      .split(",")
      .map((s) => s.trim().replace(/^"|"$/g, ""))
      .filter(Boolean)
      .forEach((n) => annotatedCapabilities.add(n));
  }
  // Reference form: capabilities: CHECKPOINT_ARMING_TOOLS (a const defined
  // elsewhere in this same file as `const NAME = new Set([...])`).
  for (const m of body.matchAll(/capabilities:\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*,/g)) {
    const resolved = extractSetLiteral(proxySrc, m[1]);
    if (resolved) resolved.forEach((n) => annotatedCapabilities.add(n));
  }

  assert.ok(annotatedCapabilities.has("vice_checkpoint_add"), "sanity: the checkpoint-arming entry's capability must be found");

  for (const name of annotatedCapabilities) {
    assert.ok(
      !denyList.includes(name),
      `capability "${name}" must not be BOTH refused (DENY_LIST) and annotated (SEAM_HAZARDS) -- found in both sets`
    );
  }
});

test("synthetic second entry ('test-fixture-synthetic-entry') is detected and annotated through the same SEAM_HAZARDS walk, proving the mechanism is genuinely data-driven", async () => {
  // vice_ping is deliberately the carrier call here: it is BOTH the seam's
  // own pre-flight liveness probe (unrelated to this fixture) and, once that
  // probe succeeds, the actual forwarded tools/call this test drives -- so a
  // forwarded-call COUNT assertion would conflate the two. What this test
  // proves instead is that the annotation appears exactly once (the walk
  // does not re-render it per pass) purely from injecting a table entry via
  // an env var, with zero changes to the production checkpoint-arming entry.
  const respond = (name: string) => (name === "vice_ping" ? { version: "3.10", machine: "C64SC", execution: "paused" } : undefined);
  const { server } = startFlexibleStandInServer(respond);
  const port = await listen(server);
  const proxy = startProxy({ VICE_MCP_URL: `http://127.0.0.1:${port}/mcp`, VICE_SEAM_HAZARDS_TEST_FIXTURE: "1" });
  try {
    await handshake(proxy);
    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, false);
    const text = resp.result.content[0].text;
    const occurrences = (text.match(/TEST FIXTURE/g) || []).length;
    assert.equal(occurrences, 1, "the synthetic second entry must be detected and annotated exactly once via the same generic walk");
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

test("structural: SEAM_HAZARDS's checkpoint-arming detector and renderer never route through isErrorText or make a forwarded call", () => {
  const src = readFileSync(PROXY_PATH, "utf8");
  for (const fnName of ["detectCheckpointArmingHazard", "renderCheckpointArmingHazard"]) {
    const startIdx = src.indexOf(`function ${fnName}(`);
    assert.ok(startIdx >= 0, `${fnName}'s own definition must be found in the source`);
    const endIdx = src.indexOf("\n}\n", startIdx);
    assert.ok(endIdx > startIdx, `could not isolate ${fnName}'s own closing brace`);
    const bodyLines = src
      .slice(startIdx, endIdx)
      .split("\n")
      .filter((l) => !/^\s*\/\//.test(l));
    const body = bodyLines.join("\n");
    assert.doesNotMatch(body, /isErrorText/, `${fnName} must never route through isErrorText -- D-16 forbids a refusal`);
    assert.doesNotMatch(body, /await call\(/, `${fnName} must make no forwarded call of its own -- T-01.3-13`);
  }
});
