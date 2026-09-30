// node:test coverage of vice-proxy.ts's stdio-MCP-server half, driven as a
// REAL spawned child process (real subprocess, no module-boundary
// mocking), speaking JSON-RPC to it over
// stdio. CORRECTED 2026-09-14: this file no longer dials an in-process
// node:http stand-in directly through a fixed VICE_MCP_URL -- that forwarding
// path was deleted once the stock backend started refusing outright,
// unconditionally, the instant VICE_MCP_URL is set (it must claim the
// monitor socket through a broker-managed instance before dialling
// anything). The successful-call route today is one of two: this file's own
// leading tracer proves a real proxy-local tool call -- the test-only
// fixture tool (VICE_TEST_FIXTURE_TOOL, vice-proxy.ts), gated so it is never
// wire-visible outside a test process, replacing the anno_* tool call this
// tracer used to drive before D-13 (plan 65-02) removed the whole family
// from tools/list -- round-trips end to end with no stand-in, no broker and
// no emulator; every broker-mediated test below still spawns the SAME
// in-process node:http stand-in
// (startStandInServer(), further down this file) but reaches it only
// through a real acquired broker grant, never through a direct VICE_MCP_URL
// dial. This is what makes the phase verifiable with the host emulator
// completely down -- see this project's own STATE.md HARD BLOCKER history
// for why that property matters here specifically.
//
// Coverage note for plan 01.1-03 (never-throw hardening task): the two
// tracer-era tests immediately below do NOT directly trigger
// `process.on('uncaughtException', ...)` or an EPIPE on `process.stdout`'s
// `'error'` listener -- both handlers are installed in vice-proxy.ts and
// exercised only incidentally (by staying silent) here. Dedicated coverage
// for those two handlers, plus the full JSON-RPC error-code matrix and the
// never-cache-a-negative-result property, lives in the "never-throw"/
// "never-cache" tests further down this file (plan 01.1-03 task 1) -- this
// section EXTENDS the harness rather than duplicating it.
//
// Coverage note for plan 01.2-01 (broker teardown task): every `finally`
// block's cleanup call is `proxy.child.kill("SIGKILL")`, not a bare
// `kill()` -- a NON-assertion change, made necessary by this task's own
// change to vice-proxy.ts. Registering `process.on("SIGTERM", ...)` (this
// task's teardown handler) suppresses Node's default SIGTERM-terminates
// behaviour, and the handler itself deliberately never calls
// `process.exit()` (see that handler's own comment in vice-proxy.ts) --
// in production the client's own ladder escalates to an unhandleable
// SIGKILL ~490ms after the first signal, and a plain `kill()` in a test's
// cleanup has to play that same role or the child is left running,
// hanging the file on a dangling stdio pipe. No assertion anywhere in
// this file was altered by this change.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo, Socket, Server as NetServer } from "node:net";
// Plan 64-08 (G-64-1 gap closure): a REAL TCP stub binary-monitor emulator
// and a REAL TCP control listener are both node:net servers -- aliased
// createNetServer to avoid colliding with node:http's own createServer,
// already imported above for startStandInServer().
import { createServer as createNetServer } from "node:net";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
// Read-only import for test assertions only -- this test file does not
// modify vice-broker-client.ts's own content; ACQUIRE_TIMEOUT_MS (the
// control-plane client's own acquire deadline, replacing the retiring
// pollGrant()'s ACQUIRE_TIMEOUT_MS in this role) is already exported for
// exactly this purpose.
import { ACQUIRE_TIMEOUT_MS } from "../../src/mcp/vice/vice-broker-client.ts";
// Plan 01.6.2-07: the proxy's acquisition/release paths now run over
// the TCP control plane instead of the file protocol, so this file drives a
// REAL control listener (broker-control.mts's own startControlListener(),
// the exact module the proxy's client speaks to) instead of writing
// request/grant/denial/lease/ack files -- matching the idiom
// vice-broker-client.test.ts's own startFullBrokerListener() already
// established for the client side.
import {
  startControlListener,
  type AcquireOutcome,
  type RelayAttachOutcome,
  type StageFileOutcome as BrokerStageFileOutcome,
  type FileTransferRequest,
  type FileTransferOutcome,
  type MonitorClaimOutcome,
  type MonitorReleaseOutcome,
} from "../../src/mcp/vice/broker-control.mts";
// Plan 64-08 (G-64-1 gap closure): the G-64-1 tracer/transfer/text tests
// below wire a REAL BrokerState and the REAL handleMonitorClaim()/
// handleRelayAttach()/handleStageFile()/handleFileTransfer() from the
// compiled artifact -- the SAME "build first, import resources/vice-broker.mjs"
// idiom broker-relay.test.ts/transfer-disjoint-roots.test.ts already
// established, because vice-broker.mts is host-bound and cannot be imported
// unbuilt.
import { createBrokerState, type BrokerState, type InstanceRecord, type MonitorChannel } from "../../src/mcp/vice/broker-state.mts";
import { build } from "../../src/mcp/vice/build.ts";
import { CommandType, ResponseType, ErrorCode, REQUEST_HEADER_LEN } from "../../src/mcp/vice/stock-protocol.ts";
import { encodeResponseFrame } from "./binmon-fixtures.ts";
import { VICE_DIR } from "./paths.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROXY_PATH = join(VICE_DIR, "vice-proxy.ts");

// vice-broker.mts is host-bound: it VALUE-imports sibling ".mjs" artifacts
// that exist only once built, so this file -- like broker-relay.test.ts's
// own precedent -- builds FIRST and then imports the COMPILED
// resources/vice-broker.mjs, never the unbuilt ".mts" source directly.
build();
const g6408ViceBrokerModule = (await import(new URL("../../src/mcp/vice/resources/vice-broker.mjs", import.meta.url).href)) as unknown as {
  handleMonitorClaim: (requestId: string, targetId: string, channel: MonitorChannel, state: BrokerState) => MonitorClaimOutcome;
  handleMonitorRelease: (requestId: string, targetId: string, channel: MonitorChannel, state: BrokerState) => MonitorReleaseOutcome;
  handleRelayAttach: (
    targetId: string,
    channel: MonitorChannel,
    presentedHandle: string,
    clientSocket: Socket,
    pending: Buffer,
    state: BrokerState,
    deps?: { writeIncident?: (record: unknown) => string },
  ) => RelayAttachOutcome;
  handleStageFile: (grantId: string, slot: string, state: BrokerState) => BrokerStageFileOutcome;
  handleFileTransfer: (request: FileTransferRequest, socket: Socket, pending: Buffer, state: BrokerState) => FileTransferOutcome;
};
const {
  handleMonitorClaim: g6408HandleMonitorClaim,
  handleMonitorRelease: g6408HandleMonitorRelease,
  handleRelayAttach: g6408HandleRelayAttach,
  handleStageFile: g6408HandleStageFile,
  handleFileTransfer: g6408HandleFileTransfer,
} = g6408ViceBrokerModule;

// broker-incident.mts is ALSO host-bound (it value-imports broker-home.mjs),
// so it is loaded the SAME way -- built first, then the compiled artifact,
// never the unbuilt .mts source directly (broker-relay.test.ts's own
// established convention, mirrored here). Without this, handleRelayAttach()'s
// own relay-death teardown (fired when this suite's own SIGKILL of the proxy
// child tears the relay socket down) would fall back to the REAL,
// machine-level brokerIncidentsDir() (~/.c64-re-tools/incidents/) -- exactly
// the prohibition this plan's own frontmatter names by name.
const g6408BrokerIncidentModule = (await import(new URL("../../src/mcp/vice/resources/broker-incident.mjs", import.meta.url).href)) as unknown as {
  writeBrokerIncident: (record: unknown, opts?: { dir?: string }) => string;
};
const { writeBrokerIncident: g6408WriteBrokerIncident } = g6408BrokerIncidentModule;

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

// ---------------------------------------------------------------------------
// Plan 03-15 task 1 safety net. WHY this exists: the 2026-08-16 UAT hang --
// two tests called startStandInServer()/
// listen() BEFORE their own `try`, then threw on a precondition assertion.
// `finally { server.close() }` never ran, the orphaned LISTEN socket kept
// node's event loop alive, and `npm test` never reached its summary line --
// no diagnostic, just silence. Task 1(b) fixed those two sites directly by
// moving acquisition inside `try`; THIS registry is the net underneath that
// fix, not a replacement for it -- it exists so that if a FUTURE test
// reintroduces the same open-before-try shape, the suite still terminates
// (with a loud, attributable warning) instead of hanging again with no
// evidence. Do NOT treat a warning from this net as "handled" -- it means
// some test's own teardown is broken and that test already failed on its
// own merits; fix the leaking test, don't lean on the net.
//
// 15-04, IN-03: this registry tracks ONLY the `startStandInServer()` stand-in
// (an `http.Server`), never the many per-test `controlServer` locals (a real
// `net.Server`, started by `startControlBroker()`) -- each of those is
// already closed by its OWN local `try`/`finally` block right where it is
// created (see e.g. the acquire/release lifecycle tests around :2258-:2300),
// so there is nothing left for this net to catch for them. The type used to
// read `Set<Server | NetServer>` as if a `net.Server` might one day be
// registered here too; it never was (confirmed: exactly one `.add()` call
// site in this file, always the http.Server stand-in), and it would not
// have worked anyway -- `closeAllConnections` below is `http.Server`-only
// and is `undefined` on `net.Server`, so `close()` alone would not
// force-drop any still-open control-plane socket. Narrowed to
// `Set<Server>` to match what this net actually does; control-plane
// `net.Server`s stay covered by their own already-correct local teardown,
// not by this net.
// ---------------------------------------------------------------------------
const OPEN_SERVERS = new Set<Server>();
const OPEN_CHILDREN = new Set<ChildProcessWithoutNullStreams>();

// A per-file scratch machine-level root: every proxy this file spawns
// defaults VICE_BROKER_HOME here, so no test falls through to
// brokerStateDir()'s real-homedir default. See startProxy().
const DEFAULT_BROKER_HOME = mkdtempSync(join(tmpdir(), "vice-proxy-test-broker-home-"));

// The control port every proxy this file spawns dials unless a test names
// its own. Nothing listens on it, so a test that never starts a fixture
// listener gets the dial-failure answer -- never whatever real broker this
// machine may be running on the default port (19510).
const DEFAULT_CONTROL_PORT = await unusedPort();

after(() => {
  rmSync(DEFAULT_BROKER_HOME, { recursive: true, force: true });
});

after(() => {
  let closedServers = 0;
  let killedChildren = 0;
  for (const server of OPEN_SERVERS) {
    if (server.listening) {
      (server as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
      server.close();
      closedServers++;
    }
  }
  OPEN_SERVERS.clear();
  for (const child of OPEN_CHILDREN) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      killedChildren++;
    }
  }
  OPEN_CHILDREN.clear();
  if (closedServers > 0 || killedChildren > 0) {
    console.error(
      `vice-proxy.test: after() force-closed ${closedServers} leaked server(s) and killed ${killedChildren} ` +
        `leaked child(ren) -- a test threw before its own teardown ran; this is the net, not the fix -- ` +
        `find and repair that test's try/finally shape.`
    );
  }
});

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
  OPEN_SERVERS.add(server);
  server.once("close", () => OPEN_SERVERS.delete(server));
  return { server, requests };
}

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  return (server.address() as AddressInfo).port;
}

/** A loopback port nothing listens on: bound once, then closed. A test
 * passes it to the proxy as VICE_BROKER_CONTROL_PORT, then either leaves it
 * empty (the dial-failure answer) or binds a fixture listener on it with
 * startControlBroker(). */
async function unusedPort(): Promise<number> {
  const server = createNetServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as AddressInfo).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

/**
 * Spawns `node vice-proxy.ts` as a real child process and gives back a
 * small harness for line-based stdin/stdout JSON-RPC exchange, matching the
 * exact framing vice-proxy.ts itself implements (newline-delimited, one
 * JSON value per line).
 *
 * `VICE_BROKER_HOME` defaults to `DEFAULT_BROKER_HOME` and
 * `VICE_BROKER_CONTROL_PORT` to `DEFAULT_CONTROL_PORT`, both spread BEFORE the
 * caller's own `env` so a test that names either wins unchanged.
 */
function startProxy(env: Record<string, string>): ProxyHandle {
  const child = spawn(process.execPath, [PROXY_PATH], {
    env: {
      ...process.env,
      VICE_BROKER_HOME: DEFAULT_BROKER_HOME,
      VICE_BROKER_CONTROL_PORT: String(DEFAULT_CONTROL_PORT),
      ...env,
    },
    stdio: ["pipe", "pipe", "pipe"] as const,
  });
  OPEN_CHILDREN.add(child);
  child.once("exit", () => OPEN_CHILDREN.delete(child));

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

// Plan 55-05: rewritten against the proxy-local annotation route.
// VICE_MCP_URL no longer forwards a `tools/call` to an HTTP stand-in at all
// -- MEASURED (this plan, and stock-session.ts's own `ensureStockSession`)
// that setting it makes the stock backend refuse outright before dialling
// anything ("VICE_MCP_URL is set, so there is no broker-managed instance
// and no broker control session to claim a monitor socket through"), because
// the stock backend claims the monitor socket through a broker-managed
// instance before it ever dials. The old `vice_ping`-through-`startStandInServer()`
// shape this test used to drive is therefore not a route this proxy has any
// more; it is not merely stale, it cannot succeed under the code as it
// ships today. The test-only fixture tool (`vice_test_fixture_result`, gated
// behind `VICE_TEST_FIXTURE_TOOL` -- see vice-proxy.ts's own header comment
// for why it replaced `anno_get_symbols` here after D-13, plan 65-02)
// crosses the exact same layers a tracer needs to prove -- stdio JSON-RPC
// framing in, the tools/call override, the proxy's own tool registry, a
// registered tool's own runner, the result-shape check, and framing back
// out -- with no emulator, no broker and no stand-in server, MEASURED live
// at planning time (a spawned child, `VICE_TEST_FIXTURE_TOOL=1`, answered
// `vice_test_fixture_result` with `isError: false`).
//
// This tracer deliberately does NOT prove the broker-mediated route (a real
// broker granting a real emulator instance, then a forwarded stock tool
// call reaching it) -- that end-to-end proof, with a genuine spawned broker
// and genuine stock VICE, lives in `stock-broker-live.test.ts`, the
// project's manual-only live suite. A tracer that quietly narrowed its own
// scope without saying so would be worse than one that states the boundary.
test("tracer: one real tool call round-trips end to end", async () => {
  const proxy = startProxy({ VICE_TEST_FIXTURE_TOOL: "1" });

  try {
    // 1. initialize -- must echo the requested protocolVersion and declare
    //    a tools capability. No host, no broker, nothing to touch yet.
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

    // 2. tools/call for the test-only fixture tool -- the one real round
    //    trip this tracer proves: a proxy-local tool, run through the
    //    registry and answered whole (one entry is well under any chunking
    //    cap).
    proxy.send({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "vice_test_fixture_result", arguments: { count: 1 } },
    });
    const callResp = await proxy.nextMessage();
    assert.equal(callResp.id, 2);
    assert.equal(callResp.jsonrpc, "2.0");
    assert.equal(callResp.result.isError, false, "a successful tool call must report isError: false");
    assert.equal(callResp.result.content.length, 1, "one entry must not trip chunking");
    assert.equal(callResp.result.content[0].type, "text");
    assert.match(
      callResp.result.content[0].text,
      /label_0_/,
      "the deterministic entry this tracer asked for must round-trip back out"
    );

    // 3. The proxy process must still be alive and answering -- this is the
    //    whole point of the never-throw discipline (finding 7: a dead stdio
    //    server is never reconnected).
    assert.equal(proxy.child.exitCode, null, "the proxy process must still be running");
    assert.equal(proxy.child.killed, false);
  } finally {
    proxy.child.kill("SIGKILL");
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
    // (vice-proxy.ts and everything it transitively imports) ever leaks a stray
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
// Plan 01.6.3-02 (the @mastra/mcp seam swap, tracer): two must_have proofs
// this plan's own frontmatter calls out by name -- neither is covered by
// the deny-list tests above, which prove ABSENCE, not schema fidelity or
// the construction-time enforcement layer's own text.
// -----------------------------------------------------------------------

test("a successful call to a tool with an outputSchema also carries the answer as structuredContent", async () => {
  const proxy = startProxy({});
  try {
    await handshake(proxy);
    proxy.send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "vice_symbols_lookup", arguments: { name: "no_such_symbol" } } });
    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, false, resp.result.content?.[0]?.text);
    assert.deepEqual(resp.result.structuredContent, JSON.parse(resp.result.content[0].text));
  } finally {
    proxy.child.kill("SIGKILL");
  }
});

test("tools/list's vice_ping entry has an inputSchema deep-equal to the manifest's own raw schema", async () => {
  // The manifest's own raw schema for vice_ping, read independently of the
  // proxy -- not re-derived from any in-memory constant this file or
  // vice-proxy.ts shares, so a passing assertion here is genuine evidence
  // that rawJsonSchemaAsStandardSchema()'s jsonSchema.input()/output() both
  // really do return the manifest's own object verbatim, through the whole
  // createTool() -> MCPServer's own ListToolsRequestSchema handler ->
  // standardSchemaToJSONSchema() round trip -- not assumed from either
  // library's documentation.
  const manifestText = readFileSync(join(VICE_DIR, "tools-manifest.stock.json"), "utf8");
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

// -----------------------------------------------------------------------
// Plan 01.6.3-03 task 2: the full-manifest parity proof. Plan 02 proved the
// wire schema was byte-identical for ONE tool (vice_ping); this extends that
// same deep-equal proof to EVERY manifest tool, plus the full name-set/order
// parity `tools/list`'s must_have calls for -- computed independently from
// tools-manifest.stock.json, never from any in-memory constant this file or
// vice-proxy.ts shares, so a passing assertion here is genuine evidence the
// swap did not change the observable surface at full scale.
// -----------------------------------------------------------------------

test("tools/list's full output matches the manifest exactly (name set, order, schema, _meta cap)", async () => {
  // Plan 55-04: re-measured which clause actually failed here before
  // touching anything. It was NOT the DENY_LIST exception this test's old
  // name carried -- there is no deny list in shipped code any more (Plan
  // 55-03 confirmed DENY_LIST: 0 hits in vice-proxy.ts), so that clause
  // named a mechanism that does not exist and is dropped from both the name
  // and the body below.
  const manifestText = readFileSync(join(VICE_DIR, "tools-manifest.stock.json"), "utf8");
  const manifest = JSON.parse(manifestText);
  const expectedManifestNames = manifest.tools.map((t: any) => t.name);
  // ORDERING DECISION (stated explicitly, per this plan's own requirement):
  // registration order IS the wire order here, and that is a real contract
  // a client can depend on -- @mastra/mcp's tools/list handler answers over
  // the registry vice-proxy.ts builds, in the order tools{}'s keys were
  // first inserted: the manifest loop (manifest order), then
  // vice_result_continue (absent from the manifest, so its key is inserted
  // fresh, after the loop) last. D-13 (plan 65-02)
  // deleted the anno_* loop that used to be registered after it; this proxy
  // process is not started with VICE_TEST_FIXTURE_TOOL, so the test-only
  // fixture tool never joins this order either. This is asserted, not left
  // silently unstated.
  const expectedOrder = [...expectedManifestNames, "vice_result_continue"];
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
    // manifest tool present, every synthetic present.
    assert.deepEqual(
      new Set(actualNames),
      new Set(expectedOrder),
      "the wire tools/list name set must be exactly the manifest plus the one still-synthetic-only tool (vice_result_continue) -- no tool missing, none extra"
    );
    // (a) ORDER parity -- see the ORDERING DECISION comment above this
    // block: registration order is the wire order, and it is a real,
    // asserted contract here, not an incidental artifact.
    assert.deepEqual(actualNames, expectedOrder, "the wire tools/list order must match the manifest's own order, with vice_result_continue appended last");

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

    // (b2) the manifest's outputSchema reaches clients too.
    for (const manifestTool of manifest.tools) {
      const wireEntry = tools.find((t: any) => t.name === manifestTool.name);
      assert.deepEqual(wireEntry.outputSchema, manifestTool.outputSchema, `"${manifestTool.name}"'s wire outputSchema must be the manifest's own`);
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

// "epoch drift is reported loudly and not cached" and "a missing epoch file
// is not a restart" -- RETIRED, Plan 55-04. Both drove the fork's own
// per-call epoch check through VICE_MCP_URL pointed at an HTTP stand-in: a
// mechanism where a proxy-side handler compared the epoch file against a
// remembered baseline on EVERY forwarded call, refused once on drift, then
// silently re-baselined so the NEXT call succeeded again. That mechanism no
// longer exists at this layer, and re-pointing these tests at what does
// exist is impossible in this file's current harness, not merely
// inconvenient: with the stock backend, VICE_MCP_URL is refused outright
// before any dial is attempted ("ensureStockSession: VICE_MCP_URL is set,
// so there is no broker-managed instance and no broker control session to
// claim a monitor socket through" -- stock-session.ts's own
// ensureStockSession()) -- there is no forwarding path left for either test
// to drive at all.
//
// The surviving mechanism moved to stock-connect.ts, and it is a
// DELIBERATE reversal of both properties, not a relocation of them:
//   - It fires only at RECONNECT (a dead socket being re-established),
//     never per-call against a still-connected session -- proven live by
//     stock-session.test.ts's "lease: two successive calls with the same
//     targetId call stockConnect exactly once -- the held session is
//     reused", which shows a live session survives repeated calls with the
//     epoch check never even consulted.
//   - On a genuine reconnect, drift throws MachineRestartedError with both
//     epoch values named -- stock-connect.test.ts's "stockReconnect: an
//     advanced epoch rejects with MachineRestartedError carrying the
//     baseline and current epochs" -- there is no silent re-baseline; a
//     future call re-handshakes from scratch (stock-session.ts's
//     ensureStockSession() clears the holder on that failure).
//   - Missing epoch evidence at RECONNECT is now treated as an unprovable
//     identity and rejected the same way -- stock-connect.test.ts's
//     "stockReconnect: no epoch can be read at all rejects with
//     MachineRestartedError -- identity that cannot be proven is not
//     proven" -- the exact OPPOSITE of "a missing epoch file is not a
//     restart"'s old claim, a documented design decision (D-3: "no epoch
//     evidence either way is treated the same as proven-different"), not an
//     oversight this rewrite could correct. The old test's own "absent ->
//     present while the SAME connection stays open" scenario is still true
//     today, but trivially so and for a different reason: epoch is never
//     consulted at all for a still-connected session (the same
//     stock-session.test.ts successor above), not because absent-then-
//     present is specifically exempted.
//
// All three named successors were run and confirmed green before this
// retirement: `node --test --test-name-pattern "an advanced epoch rejects|
// no epoch can be read at all rejects|a completed handshake records"
// stock-connect.test.ts` and `node --test --test-name-pattern "the held
// session is reused" stock-session.test.ts` both report 0 failures.

// -----------------------------------------------------------------------
// Plan 01.1-02 task 3 (rewired by plan 55-01: `96ef711f` deleted
// forwardToVice(), the only caller of wrapPossiblyChunked() -- the split
// function itself survived with no call site until 55-01 restored one). A
// result larger than the declared cap comes back in FULL across an
// explicit continuation sequence -- reassembled byte-for-byte, never
// silently truncated. The retired forwardToVice() path drove this fixture
// through an in-process HTTP stand-in; that path is gone, and the tests in
// this section no longer reach it. They drive a real registered tool
// instead: the test-only fixture tool (`vice_test_fixture_result`, gated
// behind `VICE_TEST_FIXTURE_TOOL`), which produces a real oversized payload
// with no emulator, no broker and no stand-in server, deterministically, on
// every platform -- exactly the route that was silently unchunked for the
// whole life of one release.
//
// Plan 55-05 orphan sweep: the old stand-in this section used to drive
// (`startBigPayloadServer()`) had zero remaining call sites -- confirmed by
// grep, per Plan 55-01's own note flagging it as a later plan's question --
// and was removed. Plan 55-01 then replaced it with `anno_get_symbols`
// against a seeded local store (`seedAnnoWorkspace()`); D-13 (plan 65-02)
// removed that tool from tools/list along with the rest of the anno_*
// family, so this section now drives the test-only fixture tool below
// instead -- same property (a real, wire-registered, backend-independent,
// deterministically oversized producer), no anno-tools.mts dependency.
// -----------------------------------------------------------------------

test("an oversized result is recoverable in full across continuations", async () => {
  const proxy = startProxy({ VICE_TEST_FIXTURE_TOOL: "1", VICE_MAX_RESULT_CHARS: "1000" });

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
      params: { name: "vice_test_fixture_result", arguments: { count: 30 } },
    });
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

    // Byte-exactness, proven against a SECOND run of the identical query
    // rather than a hand-written expected string: a second proxy, driving
    // the SAME deterministic fixture call with a cap large enough that this
    // same payload never splits, must answer with the exact unchunked text
    // this reassembly is supposed to equal.
    const unchunkedProxy = startProxy({ VICE_TEST_FIXTURE_TOOL: "1", VICE_MAX_RESULT_CHARS: "500000" });
    try {
      unchunkedProxy.send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
      });
      await unchunkedProxy.nextMessage();
      unchunkedProxy.send({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "vice_test_fixture_result", arguments: { count: 30 } },
      });
      const unchunked = await unchunkedProxy.nextMessage();
      assert.equal(unchunked.result.isError, false);
      assert.equal(unchunked.result.content.length, 1, "the comparison run must be small enough to stay a single item");
      assert.equal(
        reassembled,
        unchunked.result.content[0].text,
        "reassembly must equal the unchunked run of the SAME query BYTE FOR BYTE"
      );
    } finally {
      unchunkedProxy.child.kill("SIGKILL");
    }
  } finally {
    proxy.child.kill("SIGKILL");
  }
});

test("an exhausted continuation token fails loudly", async () => {
  const proxy = startProxy({ VICE_TEST_FIXTURE_TOOL: "1", VICE_MAX_RESULT_CHARS: "1000" });

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
      params: { name: "vice_test_fixture_result", arguments: { count: 30 } },
    });
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
  // This test never needed a payload -- what the retired harness forced was
  // `vice_ping` as the "proxy is still alive" follow-up call, which reached
  // through `VICE_MCP_URL` to a stand-in "host" that no longer exists on
  // this path. The test-only fixture tool proves the same thing (the proxy
  // answers a real registered tool normally right after the bogus token)
  // without a host, a broker or any stand-in server.
  const proxy = startProxy({ VICE_TEST_FIXTURE_TOOL: "1" });

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

    // The failure must not have wedged the proxy.
    proxy.send({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "vice_test_fixture_result", arguments: { count: 1 } },
    });
    const followUp = await proxy.nextMessage();
    assert.equal(followUp.result.isError, false, "the proxy must remain fully functional after the bogus token");
  } finally {
    proxy.child.kill("SIGKILL");
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
// it left each half's own test green. Rewired by plan 55-01 onto
// anno_get_symbols (see the section header above for why the retired
// stand-in server is gone); D-13 (plan 65-02) removed that tool along with
// the rest of the anno_* family, so this now drives the test-only fixture
// tool with several chunks' worth of entries rather than a hand-written
// string, so the final byte-exactness check compares against a second,
// unchunked run of the identical query instead of a literal fixture -- the
// same discipline the "recoverable in full" test above uses.
test("the _meta cap stamp and the actual chunk boundary never drift apart", async () => {
  const CAP = 777;
  // several chunks' worth at CAP, not a clean multiple
  const proxy = startProxy({ VICE_TEST_FIXTURE_TOOL: "1", VICE_MAX_RESULT_CHARS: String(CAP) });

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

    proxy.send({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "vice_test_fixture_result", arguments: { count: 50 } },
    });
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

    // Byte-exactness against a second, unchunked run of the identical query.
    const unchunkedProxy = startProxy({ VICE_TEST_FIXTURE_TOOL: "1", VICE_MAX_RESULT_CHARS: "500000" });
    try {
      unchunkedProxy.send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
      });
      await unchunkedProxy.nextMessage();
      unchunkedProxy.send({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "vice_test_fixture_result", arguments: { count: 50 } },
      });
      const unchunked = await unchunkedProxy.nextMessage();
      assert.equal(unchunked.result.content.length, 1);
      assert.equal(
        reassembled,
        unchunked.result.content[0].text,
        "reassembly must equal the unchunked run of the SAME query byte for byte"
      );
    } finally {
      unchunkedProxy.child.kill("SIGKILL");
    }
  } finally {
    proxy.child.kill("SIGKILL");
  }
});

// -----------------------------------------------------------------------
// Plan 01.1-03 task 1: nothing can kill the proxy, and nothing it does may
// cache a negative ("the host is down") result. Every hostile-input shape
// gets a well-formed JSON-RPC response, never a crash and never silence
// when the caller expected an answer.
// -----------------------------------------------------------------------

// Plan 55-05: cases 1-5 need no successful call at all -- a malformed line,
// a bare value, a method-less object, an unknown method name, and a
// tools/call missing its required name all draw their answer (or their
// deliberate silence) before any tool ever runs. Only case 6 needs one to
// actually succeed, and VICE_MCP_URL forwarding is dead (MEASURED,
// ensureStockSession() refuses outright the instant it is set) -- so this
// rewrite drops the VICE_MCP_URL stand-in entirely and proves case 6
// against the test-only fixture tool instead (VICE_TEST_FIXTURE_TOOL, D-13
// / plan 65-02's replacement for the anno_* route Plan 55-01 used here),
// same as the tracer above.
test("never-throw: malformed and hostile input is answered, not fatal", async () => {
  const proxy = startProxy({ VICE_TEST_FIXTURE_TOOL: "1" });

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
    proxy.send({
      jsonrpc: "2.0",
      id: 13,
      method: "tools/call",
      params: { name: "vice_test_fixture_result", arguments: { count: 1 } },
    });
    const okResp = await proxy.nextMessage();
    assert.equal(okResp.result.isError, false, "a valid call after five hostile inputs must still succeed");

    assert.equal(proxy.child.exitCode, null, "the proxy must still be running throughout");
    assert.equal(proxy.child.killed, false);
  } finally {
    proxy.child.kill("SIGKILL");
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

// Plan 55-05, ladder rung 3: RETIRED. This test drove "host down then up,
// same process, no restart" entirely over VICE_MCP_URL forwarding to an
// HTTP stand-in -- MEASURED that this route cannot observe either state any
// more: `ensureStockSession()` returns its one fixed VICE_MCP_URL-override
// refusal the instant the env var is set, unconditionally, whether or not
// anything is listening on the target port at all. There is no "down" vs
// "up" left to distinguish through this mechanism; the two calls this test
// used to make would both now produce the byte-identical fixed message,
// regardless of the stand-in server's own lifecycle in between.
//
// The property itself -- a negative result is never cached, and the very
// next call on the SAME process succeeds once the target becomes reachable,
// no restart -- is still real and still tested, through the mechanism that
// actually mediates reachability today: the broker control plane. Named,
// green successor: "broker never-cache: absent-then-alive-and-granted
// succeeds on the SAME process, no restart" (this file), confirmed passing.
// That test drives the identical shape -- a first call against an absent
// broker, then a second call on the SAME process against a real, granted
// control connection, with no restart between them -- through the one route
// that can still produce it.

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
      "vice-proxy.ts must register an 'error' listener on process.stdout"
    );
  } finally {
    proxy.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
  }
});

// Plan 55-05, ladder rung 3/6: RETIRED. This test drove three distinct
// unreachable-classification diagnoses (never-started, dead-or-hung,
// alive-but-failed) entirely over VICE_MCP_URL forwarding to an HTTP
// stand-in. MEASURED (and confirmed by vice-proxy.ts's own comment above
// ONLY_ROUTE_NOTE) that this whole classifying mechanism is deleted source:
// "the host-unreachable triple ... is deleted along with the fork-only
// generic forwarding function ... stock has no equivalent probe-then-
// classify step of its own." ensureStockSession()'s VICE_MCP_URL branch
// returns exactly ONE fixed message today regardless of epoch-file state or
// target-port reachability, so the three states this test used to produce
// have collapsed into one -- there is nothing left to classify.
//
// The two claims that survive decompose to two different, currently-green
// successors:
//
//   - broker absent: now driven by the dial to the broker's control port
//     rather than a VICE_MCP_URL probe: "broker states: nothing listening on
//     the control port and a denied launch each get their own message and
//     fix" (this file).
//   - alive-but-failed (a reachable session's own operation fails and is
//     reported distinctly, never a generic message): the mechanism that used
//     to classify this over the fork's HTTP transport is gone; the modern
//     equivalent -- a real per-protocol-error-code conversion into distinct,
//     non-generic result text, covering StockProtocolError/StockFramingError/
//     StockResponseMismatchError and the plain-Error fallback -- is unit-tested
//     directly against stock-handler.ts's own convertWireError() in
//     stock-handler.test.ts ("convertWireError: ObjectMissing and CmdFailure
//     produce distinct, non-generic text" and its siblings), confirmed
//     passing. This is a narrower, more precise successor than the retired
//     claim of "the host's error text relayed verbatim" -- stock's own wire
//     protocol carries typed error codes, not the fork's free-form JSON-RPC
//     error strings, so "distinct per error code" is the honest modern
//     restatement of "not a generic message", not a relocation of the old
//     claim unchanged.

// Plan 55-05 rewrote this against the proxy-local anno_* route:
// `anno_get_symbols`'s `store` argument, resolved against `repoRoot()`
// through `storePathWithinWorkspace()`, was driven over the WIRE (a real
// spawned proxy, `store` pointed first at a lexical `..` escaping the
// seeded workspace, refused; then at one that resolves back inside it,
// accepted) as the live INTEGRATION-layer proof of the same "both
// directions" property `anno-confinement.test.ts` ("18.
// workspaceRelativePath") proves at the unit layer.
//
// D-13 (plan 65-02) removed the anno_* family from tools/list, so there is
// no longer a wire-visible tool this property can be driven through at
// this layer -- the CLI is anno's only live surface now (D-12), and the
// SAME property is proven there instead: anno-cli.test.ts's `call` Test 5
// (D-12 must_have) drives `--args-file` pointed outside the workspace
// through the identical `storePathWithinWorkspace()` seam, refused; and an
// in-workspace file, accepted. `anno-confinement.test.ts`'s unit coverage
// is unchanged and still the underlying proof. This file therefore carries
// no anno-specific integration test any more -- the property has exactly
// one live surface, and the coverage moved with it.

// -----------------------------------------------------------------------
// Plan 01.2-01 task 2 / Plan 01.6.2-07: every session-ending path releases
// the lease, and the deferred-acquisition property (C3) has its own
// dedicated regression guard. Plan 01.6.2-07 swaps acquisition and release
// onto the TCP control connection (dialControlSession()/BrokerControlSession) -- the lease IS the connection now, so a REAL
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
}

/** Starts a REAL control listener (broker-control.mts's own
 * startControlListener(), the exact module the proxy's control-plane client
 * speaks to) on `port` -- the one the proxy was given as
 * VICE_BROKER_CONTROL_PORT (see unusedPort()) -- with injectable acquire
 * stubs. Writes nothing to disk. */
async function startControlBroker(port: number, deps: StubBrokerDeps = {}) {
  const listener = await startControlListener({
    host: "127.0.0.1",
    port,
    onAcquire: deps.onAcquire ?? (async () => ({ ok: false, reason: "internal" }) as AcquireOutcome),
    onRelease: () => {},
    onStatus: () => [],
    onHostState: () => ({
      pid: process.pid,
      startedAt: new Date().toISOString(),
      nodeVersion: process.version,
      viceBin: "x64sc",
      warmFloor: 0,
      maxInstances: 1,
      basePort: 0,
      // WR-04/FORKRM-01 (plan 52-06): this field's own broker/proxy
      // cross-check was deleted outright, so its value no longer affects
      // ensureBrokerLease() at all -- kept only because HostStateFields
      // still carries it (text-tools.ts's own cross-check, out of this
      // plan's scope, still reads it over the real wire).
      backend: "stock" as const,
    }),
    // Plan 05 (BROK-02/PROTO-08): this proxy-focused fixture never exercises
    // monitor_claim/monitor_release itself -- these stubs exist only to
    // satisfy StartControlListenerOptions's now-required fields.
    onMonitorClaim: () => ({ ok: false, code: "internal" }),
    onMonitorRelease: () => ({ ok: false, code: "internal" }),
    // Phase 63, plan 63-01: a required field on StartControlListenerOptions
    // as of this plan -- this proxy-focused fixture never exercises
    // `attach` itself, so this stub exists only to satisfy the type.
    onRelayAttach: () => ({ ok: false, code: "internal" as const }),
    onOperation: () => ({ ok: true as const }),
    // Phase 34, plan 34-01: a required field on StartControlListenerOptions
    // as of this plan -- this proxy-focused fixture never exercises
    // host_tool itself, so this stub exists only to satisfy the type.
  });
  // Every accepted connection is captured as it arrives -- attached BEFORE
  // any caller has a chance to trigger one, so a later "which socket did
  // MY acquire open" question (e.g. observing it close) has an answer that
  // was recorded at connection time, not raced against after the fact.
  const sockets: Socket[] = [];
  listener.server.on("connection", (socket: Socket) => {
    sockets.push(socket);
  });
  return { server: listener.server, port: listener.port, sockets };
}

/** Drives ONE forwarded tools/call through the full acquire-over-the-
 * control-connection round trip: starts a fixture listener on `controlPort`
 * (the proxy's own VICE_BROKER_CONTROL_PORT) granting an instance at
 * `targetPort` (the caller's own stand-in host). Returns once the call has resolved, alongside the control
 * listener's own server and the one socket it accepted (so a caller can
 * observe the connection closing). Shared by every test below that needs a
 * REAL session held before it can meaningfully assert that ending it
 * releases the connection. */
async function acquireLeaseViaBroker(
  proxy: ProxyHandle,
  _dir: string,
  targetPort: number,
  callId: number,
  controlPort: number,
) {
  const { server, sockets } = await startControlBroker(controlPort, {
    onAcquire: async () => ({
      ok: true,
      grant: {
        port: targetPort,
        url: `http://127.0.0.1:${targetPort}/mcp`,
      },
    }),
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
    const controlPort = await unusedPort();
    const proxy = startProxy({
      VICE_POOL_DIR: dir,
      VICE_EPOCH_FILE: join(dir, "epoch.json"),
      VICE_BROKER_CONTROL_PORT: String(controlPort),
    });
    let controlServer: NetServer | null = null;
    try {
      await handshake(proxy);
      const acquired = await acquireLeaseViaBroker(proxy, dir, port, 3, controlPort);
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
  const controlPort = await unusedPort();
  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_EPOCH_FILE: join(dir, "epoch.json"),
    VICE_BROKER_CONTROL_PORT: String(controlPort),
  });
  let controlServer: NetServer | null = null;
  try {
    await handshake(proxy);

    const acquired = await startControlBroker(controlPort, {
      onAcquire: async () => ({
        ok: true,
        grant: {
          port,
          url: `http://127.0.0.1:${port}/mcp`,
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
  const controlPort = await unusedPort();
  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_EPOCH_FILE: join(dir, "epoch.json"),
    VICE_BROKER_CONTROL_PORT: String(controlPort),
  });
  let acquireCount = 0;
  const acquired = await startControlBroker(controlPort, {
    onAcquire: async () => {
      acquireCount++;
      return {
        ok: true,
        grant: {
          port,
          url: `http://127.0.0.1:${port}/mcp`,
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

// Plan 55-05: MEASURED that ensureStockSession() now refuses OUTRIGHT the
// instant VICE_MCP_URL is set (there is no broker-managed instance and no
// broker control session to claim a monitor socket through), so the call
// itself can no longer succeed -- the old `isError: false` assertion here
// asserted a route that no longer exists. The test's own NAME states its
// actual point precisely, though: an explicit endpoint override must never
// contact the control listener at all, succeeding or failing. That property
// is untouched by the forwarding path's removal and is asserted below
// exactly as before (acquireCount stays 0) -- only the now-impossible
// "still usable" assertion is replaced with today's real, fixed outcome.
test("with an explicit endpoint override set, the control listener receives no connection at all", async () => {
  const { server } = startStandInServer();
  const port = await listen(server);
  let acquireCount = 0;
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-override-noconn-"));
  const acquired = await startControlBroker(0, {
    onAcquire: async () => {
      acquireCount++;
      return { ok: false, reason: "internal" };
    },
  });
  const proxy = startProxy({
    VICE_MCP_URL: `http://127.0.0.1:${port}/mcp`,
    VICE_POOL_DIR: dir,
    VICE_BROKER_CONTROL_PORT: String(acquired.port),
  });
  try {
    await handshake(proxy);
    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, true, "VICE_MCP_URL now refuses outright before any dial is attempted");
    assert.match(
      resp.result.content[0].text,
      /VICE_MCP_URL is set, so there is no broker-managed instance/,
      "the refusal must be the fixed VICE_MCP_URL-override message, not some other failure"
    );
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
  const controlPort = await unusedPort();
  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_EPOCH_FILE: join(dir, "epoch.json"),
    // The alias set to loopback -- makes the inverse an identity for a stub
    // that really lives on this side of the boundary (see the "ending path"
    // tests above for the same rationale).
    VICE_BROKER_CONTROL_PORT: String(controlPort),
  });
  let controlServer: NetServer | null = null;
  try {
    await handshake(proxy);
    const acquired = await acquireLeaseViaBroker(proxy, dir, port, 3, controlPort);
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
  const controlPort = await unusedPort();
  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_EPOCH_FILE: join(dir, "epoch.json"),
    // The alias set to loopback -- see the "ending path" tests above.
    VICE_BROKER_CONTROL_PORT: String(controlPort),
  });
  let controlServer: NetServer | null = null;
  try {
    await handshake(proxy);
    const acquired = await acquireLeaseViaBroker(proxy, dir, port, 3, controlPort);
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
  await listen(server);
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
  assert.ok(beginIdx !== -1, "TEARDOWN-REGION-BEGIN marker must be present in vice-proxy.ts");
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
// Plan 01.2-03 task 1: a missing or denying broker produces one of two
// distinct, evidence-carrying diagnoses -- nothing answering on the control
// port, or a launch the broker itself denied. Nothing answering fails fast,
// with no request or lease ever written. The proxy stays alive and forwards
// successfully on the SAME process the instant the broker is up (C11).
// -----------------------------------------------------------------------

// A fixed absolute bound, comfortably below the 10000ms message-read
// deadline below, so this assertion -- not the read -- is what fails on a
// regression.
const NOTHING_LISTENING_FAILFAST_BOUND_MS = 5000;

test("broker states: nothing listening on the control port and a denied launch each get their own message and fix", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-broker-states-"));

  // ---- Nothing listening on the configured control port. ----
  const proxy1 = startProxy({
    VICE_POOL_DIR: dir,
    VICE_EPOCH_FILE: join(dir, "epoch.json"),
    VICE_BROKER_CONTROL_PORT: String(await unusedPort()),
  });
  let nothingListeningText;
  try {
    await handshake(proxy1);
    const startedAt = Date.now();
    proxy1.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const resp = await proxy1.nextMessage(10000);
    const elapsedMs = Date.now() - startedAt;
    assert.equal(resp.result.isError, true);
    nothingListeningText = resp.result.content[0].text;
    assert.match(nothingListeningText, /no broker answered/i, "nothing listening must say no broker answered");
    assert.ok(
      elapsedMs < NOTHING_LISTENING_FAILFAST_BOUND_MS,
      `the dial failure must be fail-fast, well under the fixed bound (${NOTHING_LISTENING_FAILFAST_BOUND_MS}ms) -- took ${elapsedMs}ms`
    );
    assert.equal(existsSync(join(dir, "requests")), false, "a dial failure must write no request file");
    assert.equal(existsSync(join(dir, "leases")), false, "a dial failure must write no lease file");
  } finally {
    proxy1.child.kill("SIGKILL");
  }

  // ---- Alive, but the launch itself was denied. ----
  // Over the control plane, a denial carries broker-control.mts's own fixed
  // AcquireOutcome vocabulary (no_free_port/at_capacity/internal), not a
  // free-form reason string -- so "relayed verbatim" means the outcome's
  // own reason word appears unmodified, rather than an arbitrary marker.
  const { server: controlServer2, port: controlPort2 } = await startControlBroker(0, {
    onAcquire: async () => ({ ok: false, reason: "no_free_port" }),
  });
  const proxy2 = startProxy({
    VICE_POOL_DIR: dir,
    VICE_EPOCH_FILE: join(dir, "epoch2.json"),
    VICE_BROKER_CONTROL_PORT: String(controlPort2),
  });
  let launchFailedText;
  try {
    await handshake(proxy2);
    proxy2.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });

    const resp = await proxy2.nextMessage(10000);
    assert.equal(resp.result.isError, true);
    launchFailedText = resp.result.content[0].text;
    assert.match(launchFailedText, /no_free_port/, "the denial's own reason must appear unmodified in the result");
    assert.doesNotMatch(launchFailedText, /restart/i, "the launch-failed message must NOT carry a restart instruction");
  } finally {
    proxy2.child.kill("SIGKILL");
    await new Promise((resolve) => controlServer2.close(resolve));
  }

  // ---- Cross-cutting assertions across both shapes. ----
  assert.notEqual(nothingListeningText, launchFailedText, "the nothing-listening and launch-failed messages must be distinct");

  for (const text of [nothingListeningText, launchFailedText]) {
    assert.ok(text.includes("vice-mcp broker (npm install) or node <plugin-root>/src/mcp/vice/vice-cli.mjs broker (plugin or checkout)"), "every broker-absent message must quote the broker start command");
    assert.match(text, /only route/i, "every broker-absent message must state this is the only route");
    assert.doesNotMatch(text, /vice-broker\.sh/, "no broker-absent message may still name the retiring bash broker");
  }

  rmSync(dir, { recursive: true, force: true });
});

test("broker never-cache: absent-then-alive-and-granted succeeds on the SAME process, no restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-broker-nevercache-"));
  const { server } = startStandInServer();
  const port = await listen(server);
  const controlPort = await unusedPort();
  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_EPOCH_FILE: join(dir, "epoch.json"),
    // The alias set to loopback -- see the "ending path" tests above.
    VICE_BROKER_CONTROL_PORT: String(controlPort),
  });
  let controlServer: NetServer | null = null;
  try {
    await handshake(proxy);
    const pidBefore = proxy.child.pid;

    // Call 1: nothing listening on the control port yet -- must observe the
    // dial-failure message. The proxy stays alive and caches nothing.
    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const down = await proxy.nextMessage(10000);
    assert.equal(down.result.isError, true);
    assert.match(down.result.content[0].text, /no broker answered/i);
    assert.equal(proxy.child.exitCode, null, "the proxy must still be running after the dial failure");

    // Call 2, SAME process, no restart: acquireLeaseViaBroker() both starts
    // a real control listener on that port and grants the retried request.
    const acquired = await acquireLeaseViaBroker(proxy, dir, port, 4, controlPort);
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

test("broker warming: an acquire deadline with no grant or error is a warming-and-retry result, and leaves the connection closed", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-broker-warming-"));
  // onAcquire never resolves -- simulating a cold x64sc boot still in
  // progress when the client's own per-request deadline elapses.
  const { server: controlServer, port: controlPort } = await startControlBroker(0, {
    onAcquire: () => new Promise(() => {}),
  });

  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_EPOCH_FILE: join(dir, "epoch.json"),
    VICE_BROKER_ACQUIRE_TIMEOUT_MS: "300", // short deadline -- nothing will ever grant or deny this request
    VICE_BROKER_CONTROL_PORT: String(controlPort),
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
// A grant is adopted as received, except that its url must name the granted
// port (checkGrant()).
// -----------------------------------------------------------------------

test("grant check: a grant whose url port disagrees with the granted port is refused, falling back to the port-derived url", async () => {
  // The forwarded call below cannot complete regardless of which url the session
  // ends up holding (the fixture control broker never wires onMonitorClaim),
  // so the refusal-plus-fallback property is proven from the seam's own
  // adoption-record stderr line.
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-ccn-safetynet-url-"));
  const { server } = startStandInServer();
  const port = await listen(server);
  const wrongPort = port + 1; // NOT what the stub is actually listening on
  const controlPort = await unusedPort();

  const proxy = startProxy({
    VICE_POOL_DIR: dir,
    VICE_BROKER_CONTROL_PORT: String(controlPort),
  });
  let controlServer: NetServer | null = null;
  try {
    await handshake(proxy);
    const mismatchedUrl = `http://127.0.0.1:${wrongPort}/mcp`; // disagrees with the granted port
    // checkGrant()'s own fallback construction.
    const fallbackUrl = `http://127.0.0.1:${port}/mcp`;
    const acquired = await startControlBroker(controlPort, {
      onAcquire: async () => ({
        ok: true,
        grant: {
          port,
          url: mismatchedUrl,
        },
      }),
    });
    controlServer = acquired.server;

    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    await proxy.nextMessage(10000);

    const checkLines = proxy.stderr.join("").split("\n").filter((l) => l.includes("does not name port"));
    assert.equal(checkLines.length, 1);
    assert.ok(
      checkLines[0].includes(`url ${JSON.stringify(mismatchedUrl)} does not name port ${port} -- using ${fallbackUrl}`),
      `the port-mismatched url must be substituted with the port-derived fallback url, not silently adopted -- got: ${checkLines[0]}`
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
// and a FIXED-PORT unreachable instance (no lease held) used to still
// produce the unchanged 01.1 never-started/dead-or-hung/alive-but-failed
// triple, quoting vice-launcher.sh. The pre-existing "three states" test
// this comment used to point at (the old host-side VICE_MCP_URL-classifying
// test, once at "line ~1078") is GONE from this file: its own vocabulary is
// deleted source (vice-proxy.ts's own comment above ONLY_ROUTE_NOTE states
// this explicitly -- "the host-unreachable triple ... is deleted along with
// the fork-only generic forwarding function ... stock has no equivalent
// probe-then-classify step of its own"). The distinction the test below
// used to prove (fixed-port routing is a BRANCH, not a blanket rename) is
// gone with it: there is no "01.1 triple" left to be routed AWAY from --
// ensureStockSession()'s VICE_MCP_URL branch returns exactly ONE fixed
// message today, regardless of whether anything is listening on the fixed
// port, and it never mentions "never started", never mentions
// "vice-launcher.sh", and never contacts the broker at all.
//
// RETIRED (ladder rung 3/6): that one fixed message, and the fact that it
// never touches the control listener, is exactly what "with an explicit
// endpoint override set, the control listener receives no connection at
// all" (this plan's Task 2, above in this file) now asserts -- MEASURED
// identical outcome for a fixed-port override whether or not anything is
// listening on the target port, since ensureLease() short-circuits before
// ever attempting a connection. This test's own two claims (a fixed-port
// override gets ITS OWN message, and never the broker's broker-absent/
// launch-denied vocabulary) are fully subsumed by that
// surviving sibling; keeping both would duplicate one assertion under two
// names for a property that used to be two DIFFERENT diagnoses and no
// longer is. Named, green successor: "with an explicit endpoint override
// set, the control listener receives no connection at all", confirmed
// passing above in this same file.
// -----------------------------------------------------------------------

test("structural: exactly one definition of the shared only-route sentence (ONLY_ROUTE_NOTE) exists", () => {
  const files = readdirSync(VICE_DIR)
    .filter((f) => /\.[cm]?[jt]s$/.test(f) && !/\.test\.[cm]?[jt]s$/.test(f));
  let defCount = 0;
  for (const f of files) {
    const src = readFileSync(join(VICE_DIR, f), "utf8");
    defCount += (src.match(/^const ONLY_ROUTE_NOTE\s*=/gm) || []).length;
  }
  assert.equal(defCount, 1, "expected exactly one ONLY_ROUTE_NOTE definition across the non-test module set -- no message may grow a second copy of the only-route sentence");
});

// ---------------------------------------------------------------------------
// Phase 01.4 plan 03 (criterion 5): a
// permanent regression guard against the topology-naming "vice-proxy:"
// prefix silently creeping back into an agent-visible message. A
// backtick-opened template literal beginning with the literal sequence
// "vice-proxy:" is agent-visible tool-result `content` in every case in
// this file EXCEPT when it is an argument to `console.error(...)` (stderr
// only, never read by the model, and deliberately out of this guard's
// scope).
//
// Plan 03-15 task 3: the ORIGINAL rule here was proximity-based ("does
// console.error( appear, modulo whitespace/newlines, within 40 chars
// immediately before the backtick?"). Commit 1c87d16 broke it: it rewrote a
// single-line `console.error(\`vice-proxy: ...\`)` call into a multi-line
// ternary --
//   console.error(
//     COND
//       ? `vice-proxy: ready, forwarding to ...`
//       : `vice-proxy: ready, stock backend active ...`,
//   );
// -- so neither arm has `console.error(` within 40 chars of its own
// backtick (the ternary's own condition and `?`/`:` tokens sit in between),
// and a template literal on an earlier ternary arm also contains its own
// parens, further defeating a fixed-width lookback. The detector was wrong,
// not the source (planner decision, this plan's own objective) -- widening
// it here, in the test, is the fix.
//
// THE NEW RULE (still a heuristic, not a full parse -- documented as one so
// the next refactor that defeats it knows where to look): for each
// `` `vice-proxy: `` match, compare the nearest PRECEDING `console.error(`
// against the nearest PRECEDING agent-visible marker (`text:`, `content:`,
// `isErrorText(`). The match is exempt only when `console.error(` is the
// NEARER of the two -- i.e. no agent-visible marker sits between it and the
// literal. This survives an arbitrarily long/multi-line console.error(...)
// argument (the ternary above), while still catching a literal that comes
// AFTER a marker (meaning some earlier console.error( on the page is not
// actually this literal's own enclosing call).
//
// WHAT WOULD DEFEAT THIS: a `console.error(...)` call sitting textually
// between an agent-visible marker and a `vice-proxy:` literal that is
// actually part of THAT marker's own object (e.g. interleaved unrelated
// console.error() noise between `text:` and its own template literal) would
// wrongly exempt a real violation -- this file's own style (one call, one
// literal, no interleaving) does not do this, but a future refactor could.
// ---------------------------------------------------------------------------

// 15-04, WR-07: two fixes to the marker set above, re-verified live against
// this file's own re-derived line numbers (the review's :3856-3875 citation
// has drifted to :3869-3890 as of this plan -- confirmed both defects still
// existed at plan time before either fix landed):
//
// 1. False-negative class: a `vice-proxy:` literal reached via `throw new
//    SomeError(...)` (agent-visible -- the error eventually surfaces to the
//    caller) was previously EXEMPT whenever no `text:`/`content:`/
//    `isErrorText(` marker sat between it and the nearest earlier
//    console.error(...) call, because "throw new"/standalone "Error(" were
//    not agent-visible markers. Added both to the marker set.
// 2. Mid-word false trigger: `before.lastIndexOf("text:")` matched the
//    substring inside "context:", letting an unrelated comment or string
//    containing "context:" flip an otherwise-exempt literal into a
//    (falsely) reported violation. `text:`'s marker is now anchored so it
//    cannot match when immediately preceded by a letter.
//
// Verified against the real vice-proxy.ts source (source-assertion only --
// this file is MANUAL_ONLY_TESTS entry 2 and must never be executed, see
// this plan's own prohibition): all 12 `` `vice-proxy: `` sites in
// vice-proxy.ts are console.error(...)'s own argument; the file's only two
// `throw new` sites (PathOutOfWorkspaceError/PathTranslationError, neither
// carrying a vice-proxy: literal) and its one standalone `new Error(` site
// each sit far from every vice-proxy: literal's own, much nearer,
// console.error( call, so widening the marker set does not newly flag any
// of them. `context:` does not appear anywhere in vice-proxy.ts today, so
// the word-boundary fix is a hardening change with no effect on the
// current real-source assertion below.
const AGENT_VISIBLE_MARKERS: RegExp[] = [
  /(^|[^A-Za-z])text:/g,
  /content:/g,
  /isErrorText\(/g,
  /throw new /g,
  /\bError\(/g,
];

/** Returns the index of the LAST match of `re` in `str` before `str`'s own
 * end, or -1 if `re` never matches. `re` must carry the global flag. */
function lastMatchIndex(str: string, re: RegExp): number {
  let last = -1;
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(str))) {
    last = m.index;
    if (m[0].length === 0) re.lastIndex += 1;
  }
  return last;
}

/**
 * Finds every `` `vice-proxy: `` template-literal start in `src` that is
 * NOT the argument of a `console.error(...)` call -- i.e. every
 * agent-visible violation of the "vice-proxy: is stderr-only" invariant.
 * Returns the list of source offsets (one per violation), empty when clean.
 * Exported as a named function (not inlined in the test body) so the three
 * control assertions below can exercise it directly against synthetic
 * snippets, proving the widened rule is neither vacuous nor over-broad.
 */
function viceProxyIdentityViolations(src: string): number[] {
  const violations: number[] = [];
  const pattern = /`vice-proxy:/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(src))) {
    const idx = m.index;
    const before = src.slice(0, idx);
    const lastConsoleError = before.lastIndexOf("console.error(");
    const lastMarker = Math.max(...AGENT_VISIBLE_MARKERS.map((re) => lastMatchIndex(before, re)));
    // Exempt only when console.error( is the NEARER of the two preceding
    // landmarks (or no agent-visible marker precedes this literal at all).
    const exempt = lastConsoleError !== -1 && lastConsoleError > lastMarker;
    if (!exempt) {
      violations.push(idx);
    }
  }
  return violations;
}

test("structural: no agent-visible template literal begins with the vice-proxy: prefix", () => {
  // Positive control: a real agent-visible violation (the literal shape a
  // tool-result handler actually returns) MUST be flagged -- proves the
  // widened rule still catches the thing this test exists to catch.
  const positiveControl = 'return { content: [{ type: "text", text: `vice-proxy: boom` }] };';
  assert.equal(
    viceProxyIdentityViolations(positiveControl).length,
    1,
    "a vice-proxy: literal reached through content/text must still be flagged"
  );

  // Negative control: a multi-line ternary shape matching what USED to break
  // the old proximity rule (both arms are console.error(...)'s own argument,
  // just multi-line) must NOT be flagged.
  const negativeControl = `console.error(
  someCondition
    ? \`vice-proxy: ready, forwarding to \${activeInstance().url} (port \${activeInstance().port})\`
    : \`vice-proxy: ready, stock backend active -- dispatching to a broker-claimed binary-monitor instance (resolved binary: \${RESOLVED_BINARY.binPath})\`,
);`;
  assert.equal(
    viceProxyIdentityViolations(negativeControl).length,
    0,
    "the real multi-line console.error(...) ternary must not be flagged"
  );

  // Regression control: a console.error(...) call EARLIER on the page must
  // not exempt a LATER, unrelated agent-visible literal -- proves the
  // "nearest preceding console.error(" comparison does not leak forward
  // past the call it actually belongs to.
  const regressionControl = `console.error(\`something unrelated\`);
return { content: [{ type: "text", text: \`vice-proxy: leaked\` }] };`;
  assert.equal(
    viceProxyIdentityViolations(regressionControl).length,
    1,
    "an earlier, unrelated console.error( call must not exempt a later agent-visible vice-proxy: literal"
  );

  // WR-07 fix, false-negative control: a vice-proxy: literal reached via
  // `throw new` (agent-visible -- the error surfaces to the caller, never
  // logged to stderr) must be flagged even though no console.error(...)
  // call precedes it at all on this snippet.
  const throwNewControl = 'throw new ViceError(`vice-proxy: leaked via a thrown error`);';
  assert.equal(
    viceProxyIdentityViolations(throwNewControl).length,
    1,
    "a vice-proxy: literal reached via throw new must be flagged (the false-negative class WR-07 named)"
  );

  // WR-07 fix, false-negative control: the SAME literal must also be
  // flagged when an EARLIER, unrelated console.error(...) call precedes it
  // -- proves "throw new" wins as the nearer marker over a stale, earlier
  // console.error(, not just over "no console.error( at all".
  const throwNewAfterUnrelatedConsoleError = `console.error(\`something unrelated\`);
throw new ViceError(\`vice-proxy: leaked via a thrown error\`);`;
  assert.equal(
    viceProxyIdentityViolations(throwNewAfterUnrelatedConsoleError).length,
    1,
    "throw new must be treated as nearer than a stale, earlier console.error( call"
  );

  // WR-07 fix, mid-word control: "context:" must NOT act as the "text:"
  // marker -- proves the word-boundary anchor closes the secondary defect
  // WR-07 named without also breaking the real "text:" marker.
  const midWordControl = `// see the calling context: for details
console.error(\`vice-proxy: still just a log line\`);`;
  assert.equal(
    viceProxyIdentityViolations(midWordControl).length,
    0,
    '"context:" must not be mistaken for the "text:" marker'
  );

  // The real detector, run over the real source, with the same failure
  // message the original (narrower) rule used.
  const src = readFileSync(join(VICE_DIR, "vice-proxy.ts"), "utf8");
  const violations = viceProxyIdentityViolations(src);
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
  const files = readdirSync(VICE_DIR).filter((f) => /\.[cm]?[jt]s$/.test(f) && !/\.test\.[cm]?[jt]s$/.test(f));
  let defCount = 0;
  for (const f of files) {
    const src = readFileSync(join(VICE_DIR, f), "utf8");
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
 * repoRoot() (repo-root.ts): that module's documented CONTAINER_WORKSPACE_PATH
 * precedence resolves to the shared devcontainer mount's MAIN checkout when
 * run from inside a git worktree (see 01.2-01-SUMMARY.md's "Issues
 * Encountered" -- a pre-existing, documented hazard this task does not fix),
 * which would read the wrong .mcp.json when this test itself runs inside a
 * worktree. Anchored at THIS file's actual on-disk location instead. */
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
// Plan 01.3-01 task 2: the two structural guards keeping this phase inside
// the only-permitted-route rule (criteria 5, 8, 9 in 01.3-VALIDATION.md).
// ---------------------------------------------------------------------------

test("structural: the set of source files under src/mcp/vice/ containing a network-call construct is exactly broker-launch.mts", () => {
  // Directory-enumerating -- a future module joining this directory is
  // covered the moment it lands on disk, with no test file to remember to
  // update. A "network-call construct" here means an actual outbound call
  // site (`fetch(`), not merely the word "fetch" appearing in prose or a
  // variable name. The file-enumeration predicate matches the whole
  // `[cm]?[jt]s` extension class, so a module that changes extension stays
  // covered.
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
  const files = readdirSync(VICE_DIR)
    .filter((f) => /\.[cm]?[jt]s$/.test(f) && !/\.test\.[cm]?[jt]s$/.test(f))
    .sort();
  assert.ok(files.length > 0, "module directory enumerated as empty -- glob or path resolution is broken");

  // This guard's own subject, per its name and the comment above, is the
  // set of files "under src/mcp/vice/" -- the ON-DISK directory tree, not
  // the npm-published subset derived from package.json's `files[]` (a
  // different property: what actually ships, not what exists on disk) --
  // so this stays a directory enumeration.
  //
  // The equality below is still a full two-directional set equality, never
  // relaxed to a subset/containment check: a new file joining this
  // directory with an unsanctioned `fetch(` call must still fail this test
  // by name, exactly as it did before this measurement.
  const offenders = files.filter((f) => NETWORK_CALL_PATTERN.test(readFileSync(join(VICE_DIR, f), "utf8")));
  assert.deepEqual(
    offenders.sort(),
    ["broker-launch.mts"],
    `the network-call module set changed -- expected exactly ["broker-launch.mts"], got ${JSON.stringify(offenders)}. ` +
      "A module reaching the host outside the sanctioned transport is the violation, not merely a style break."
  );
});

// -----------------------------------------------------------------------
// Plan 08-02 (BACK-05), RETIRED BY FORKRM-05 (plan 52-07): the
// CallToolRequestSchema override's tools[name] miss branch used to render a
// per-capability refusal -- naming the tool, the reason, and the OTHER
// backend that provided it -- for a tool the trimmed manifest (D-07) never
// registered. That renderer and the per-backend capability registry behind
// it are both deleted: there is one backend now, so "the other backend
// provides this" is no longer a sentence that can be true. An unrecognised
// tool name -- whether it is a hardware capability stock never had, or a
// plain typo -- now gets the SAME plain "Unknown tool" fallback, which is
// the honest answer in both cases: neither name exists anywhere this
// process can dispatch to.
//
// FORKRM-01 (plan 52-06): the sibling test that used to sit here -- the
// other backend refusing a capability that backend uniquely gained -- was
// already deleted for the identical reason one plan earlier.
// -----------------------------------------------------------------------

test("BACK-05/FORKRM-05: stock now falls through to the plain Unknown tool fallback for a former hardware-only capability, same as any other unregistered name", async () => {
  const proxy = startProxy({});
  try {
    await handshake(proxy);
    proxy.send({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "vice_sid_get_state", arguments: {} },
    });
    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, true, "vice_sid_get_state must still be refused -- it is not on the stock manifest");
    assert.equal(
      resp.result.content[0].text,
      "Unknown tool: vice_sid_get_state",
      "with the per-backend capability registry gone, an absent tool name -- hardware-only or not -- falls " +
        "through to the same plain unknown-tool message a typo gets (FORKRM-05)"
    );
  } finally {
    proxy.child.kill("SIGKILL");
  }
});

test("BACK-05/FORKRM-05: a genuine typo gets the identical Unknown tool fallback, byte-for-byte, as a former hardware-only capability", async () => {
  const proxy = startProxy({});
  try {
    await handshake(proxy);
    proxy.send({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "vice_totally_made_up_xyz", arguments: {} },
    });
    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, true);
    assert.equal(
      resp.result.content[0].text,
      "Unknown tool: vice_totally_made_up_xyz",
      "a genuinely unregistered name must fall through to the generic fallback, byte-for-byte -- the same " +
        "wording the test above gets for a name that used to have its own distinct capability refusal"
    );
  } finally {
    proxy.child.kill("SIGKILL");
  }
});

// ---------------------------------------------------------------------------
// IN-01 (10-REVIEW.md; 11.1-CONTEXT.md AUDIT-01, D-11.1-04): a piped `anno`
// invocation must not lose output to `process.exit()` discarding an
// undrained async write, and the bounded drain that fixes it must not turn
// a truncation into a hang.
//
// MEASURED, not inspected (per the plan's own instruction): the pre-fix
// dispatch (`git show HEAD~2:vice-proxy.ts`, i.e. before this plan's Task 3
// commit) truncated a piped 512000-byte payload at exactly 65536 bytes on
// this host's Node/kernel (a full OS pipe capacity, not the review's
// originally-measured 128 KiB -- environment-dependent, same defect class).
// See 11.1-05-SUMMARY.md for the full pre-fix/post-fix transcript recorded
// during that live measurement (a scratch copy of the pre-fix dispatch with
// the SAME test-only fill hatch added, run once, then discarded -- never
// committed, since the fix itself is what this suite pins going forward).
//
// Route chosen for the payload (the plan names two -- "the --help/USAGE
// path repeated" or "an export-asm against a generated fixture" -- and
// leaves the choice open): NEITHER scales on this host. `--help`'s USAGE
// text is a fixed ~5.6 KB string, and cmdExportAsm's error path was
// measured directly against both a garbage `.regen2000proj` and a garbage
// flat `.raw` capture -- the retired analyser's own diagnostic (measured at
// its 0.9.20 release, before phase 29 removed the integration) stays a
// small, roughly constant size (67-221 bytes) regardless of input size, so
// neither route can deterministically clear "well above 128 KiB" without a
// real, large capture this plan is explicitly not allowed to require. The
// fix therefore ships a narrow, clearly-labelled test-only escape hatch,
// `VICE_TEST_ANNO_CLI_STDOUT_FILL_BYTES`, gated behind an env var name no
// real caller would ever set, that writes a deterministic filler payload
// through the SAME drained-exit code path a real `anno <verb>` call uses
// -- see that hatch's own comment in vice-proxy.ts for the measurements
// that ruled out both named routes.
const FILL_PAYLOAD_BYTES = 512000; // well above the 65536-byte truncation point measured above

test("IN-01: a piped anno invocation delivers the whole payload, well above the OS pipe capacity, with an exact byte count", () => {
  const result = spawnSync(process.execPath, [PROXY_PATH, "anno", "--help"], {
    env: { ...process.env, VICE_TEST_ANNO_CLI_STDOUT_FILL_BYTES: String(FILL_PAYLOAD_BYTES) },
    maxBuffer: FILL_PAYLOAD_BYTES * 2,
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.length, FILL_PAYLOAD_BYTES, "the piped payload must arrive complete, not truncated");
});

test("IN-01: the drain is bounded -- a piped invocation whose reader never drains still exits promptly (no hang)", () => {
  const start = Date.now();
  const result = spawnSync(process.execPath, [PROXY_PATH, "anno", "--help"], {
    env: { ...process.env, VICE_TEST_ANNO_CLI_STDOUT_FILL_BYTES: String(FILL_PAYLOAD_BYTES * 10) },
    // No stdio pipe consumer attached at all -- 'ignore' means the OS pipe
    // fills and is never drained by anything, the exact "nobody reads the
    // pipe" scenario T-11.1-EXITHANG guards against.
    stdio: ["ignore", "ignore", "ignore"],
    timeout: 5000,
  });
  const elapsedMs = Date.now() - start;
  assert.equal(result.status, 0, "must still exit 0, not be killed by the test's own 5s spawnSync timeout");
  assert.ok(elapsedMs < 2000, `expected the bounded drain to resolve well under 2s (T-11.1-EXITHANG); took ${elapsedMs}ms`);
});

test("IN-01: anno --help's real (small) output is unaffected by the fix -- piped byte count equals unpiped byte count", () => {
  const piped = spawnSync(process.execPath, [PROXY_PATH, "anno", "--help"]);
  assert.equal(piped.status, 0);

  const scratchDir = mkdtempSync(join(tmpdir(), "vice-proxy-in01-"));
  const outFile = join(scratchDir, "help.out");
  try {
    spawnSync("sh", ["-c", `${JSON.stringify(process.execPath)} ${JSON.stringify(PROXY_PATH)} anno --help > ${JSON.stringify(outFile)}`]);
    const unpipedBytes = statSync(outFile).size;
    assert.equal(piped.stdout.length, unpipedBytes, "piped and unpiped byte counts must match exactly");
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
});

test("IN-01: the anno CLI dispatch still ends the process promptly with no server ready log line", () => {
  const start = Date.now();
  const result = spawnSync(process.execPath, [PROXY_PATH, "anno", "--help"], { encoding: "utf8" });
  const elapsedMs = Date.now() - start;
  assert.equal(result.status, 0);
  assert.ok(elapsedMs < 5000, `expected a prompt exit, took ${elapsedMs}ms`);
  assert.doesNotMatch(result.stdout, /listening on|MCPServer started/i);
  assert.doesNotMatch(result.stderr, /listening on|MCPServer started/i);
});

// ===========================================================================
// G-64-1 gap closure (plan 64-08). The regression test that would have
// caught G-64-1: a REAL vice-proxy.ts over stdio, against a REAL control
// listener, reaching the relay attach and reading the result -- an offline
// reproduction turned into a permanent regression test. The security trade
// that made the fix possible: attach/transfer authenticated by their
// broker-minted handle alone.
// ===========================================================================

interface G6408DecodedRequest {
  apiVersion: number;
  requestId: number;
  commandType: number;
  body: Buffer;
  total: number;
}

/** Mirrors stock-connect.test.ts's own decodeOneRequest() -- copied, not
 * imported: every *.test.ts file in this package owns its own fixtures, per
 * this repo's own convention (no shared test-helper module exists). */
function g6408DecodeOneRequest(buf: Buffer): G6408DecodedRequest | null {
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

function g6408EncodeViceInfoBody(version: number[]): Buffer {
  return Buffer.concat([Buffer.from([version.length]), Buffer.from(version), Buffer.from([0])]);
}

/** DUMP (0x41)/UNDUMP (0x42) request body layouts -- mirrors
 * transfer-disjoint-roots.test.ts's own decodeDumpFilename()/
 * decodeUndumpFilename(), copied for the same "no shared test-helper
 * module" reason as g6408DecodeOneRequest() above. */
function g6408DecodeDumpFilename(body: Buffer): string {
  const len = body[2]!;
  return body.subarray(3, 3 + len).toString("ascii");
}
function g6408DecodeUndumpFilename(body: Buffer): string {
  const len = body[0]!;
  return body.subarray(1, 1 + len).toString("ascii");
}

interface G6408StubEmulator {
  server: NetServer;
  port: number;
  receivedCommandTypes: Set<number>;
  unansweredCommandTypes: Set<number>;
}

/** A stub binary-monitor emulator, mirroring stock-connect.test.ts's own
 * withStockStubServer()/happyPathResponder(): decodes one request frame at a
 * time and answers PING, VICE_INFO, CPUHISTORY_GET, EXIT (plus the
 * unsolicited RESUMED event, CR-02) exactly the way a well-behaved stock
 * build would -- enough for stockConnect()'s own handshake (claim, PING to
 * halt, VICE_INFO, the CPUHISTORY_GET capability probe, EXIT to resume).
 * DUMP/UNDUMP are additionally answered (Task 2/3's own snapshot save/load
 * flow), delegating to the optional `onDump`/`onUndump` hooks so a test can
 * act on the broker-chosen staged path each request names, mirroring
 * transfer-disjoint-roots.test.ts's own DI-stub session responder -- but
 * over a REAL socket this time, since this suite drives the real proxy.
 * Records every command type received and every one this responder did NOT
 * answer, so a silently-ignored command fails the test loudly instead of
 * hanging it. */
async function g6408StartStubEmulator(
  opts: { onDump?: (filename: string) => void; onUndump?: (filename: string) => Promise<void> | void } = {},
): Promise<G6408StubEmulator> {
  const receivedCommandTypes = new Set<number>();
  const unansweredCommandTypes = new Set<number>();

  async function respond(socket: Socket, req: G6408DecodedRequest): Promise<boolean> {
    switch (req.commandType) {
      case CommandType.Ping:
        socket.write(encodeResponseFrame({ responseType: ResponseType.Ping, errorCode: ErrorCode.Ok, requestId: req.requestId }));
        return true;
      case CommandType.ViceInfo:
        socket.write(
          encodeResponseFrame({
            responseType: ResponseType.ViceInfo,
            errorCode: ErrorCode.Ok,
            requestId: req.requestId,
            body: g6408EncodeViceInfoBody([3, 9, 0, 0]),
          }),
        );
        return true;
      case CommandType.CpuHistoryGet:
        socket.write(
          encodeResponseFrame({ responseType: ResponseType.CpuHistoryGet, errorCode: ErrorCode.Ok, requestId: req.requestId, body: Buffer.alloc(4) }),
        );
        return true;
      case CommandType.Exit:
        socket.write(
          Buffer.concat([
            encodeResponseFrame({ responseType: ResponseType.Exit, errorCode: ErrorCode.Ok, requestId: req.requestId }),
            encodeResponseFrame({
              responseType: ResponseType.Resumed,
              errorCode: ErrorCode.Ok,
              requestId: 0xffffffff,
              body: Buffer.from([0x31, 0xea]),
            }),
          ]),
        );
        return true;
      case CommandType.Dump: {
        const filename = g6408DecodeDumpFilename(req.body);
        opts.onDump?.(filename);
        socket.write(encodeResponseFrame({ responseType: ResponseType.Dump, errorCode: ErrorCode.Ok, requestId: req.requestId }));
        return true;
      }
      case CommandType.Undump: {
        const filename = g6408DecodeUndumpFilename(req.body);
        await opts.onUndump?.(filename);
        socket.write(
          encodeResponseFrame({ responseType: ResponseType.Undump, errorCode: ErrorCode.Ok, requestId: req.requestId, body: Buffer.alloc(2) }),
        );
        return true;
      }
      default:
        return false;
    }
  }

  return new Promise((resolvePromise) => {
    const server = createNetServer((socket: Socket) => {
      let buf = Buffer.alloc(0);
      socket.on("data", (chunk: Buffer) => {
        buf = Buffer.concat([buf, chunk]);
        for (;;) {
          const decoded = g6408DecodeOneRequest(buf);
          if (!decoded) break;
          buf = buf.subarray(decoded.total);
          receivedCommandTypes.add(decoded.commandType);
          void respond(socket, decoded).then((answered) => {
            if (!answered) unansweredCommandTypes.add(decoded.commandType);
          });
        }
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      resolvePromise({ server, port, receivedCommandTypes, unansweredCommandTypes });
    });
  });
}

/** A stub text monitor -- answers any write with a canned, prompt-framed
 * reply (PROMPT_RE = /\(C:\$[0-9A-Fa-f]{4}\)\s*$/, text-protocol.ts), the
 * SAME minimal shape broker-relay-text.test.ts's own withStubTextMonitorServer()
 * fixtures use. Good enough for `vice_warp_set`, which reads the response
 * text but asserts nothing about its content beyond a successful round
 * trip. */
function g6408StartStubTextMonitor(): Promise<{ server: NetServer; port: number }> {
  return new Promise((resolvePromise) => {
    const server = createNetServer((socket: Socket) => {
      socket.on("data", () => {
        socket.write(Buffer.from("warp: 1\n(C:$e5d1) ", "utf8"));
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      resolvePromise({ server, port });
    });
  });
}

interface G6408AttachCall {
  targetId: string;
  channel: MonitorChannel;
  handle: string;
}

interface G6408Fixture {
  dir: string;
  brokerHomeDir: string;
  incidentsDir: string;
  listenerPort: number;
  listenerServer: NetServer;
  stubEmulator: G6408StubEmulator;
  stubTextMonitor: { server: NetServer; port: number } | null;
  state: BrokerState;
  attachCalls: G6408AttachCall[];
  acquiredTargetIds: string[];
  stageFileCalls: Array<{ targetId: string; slot: string }>;
  fileTransferCalls: FileTransferRequest[];
}

/** Stands up the REAL control listener this whole G-64-1 suite drives: a
 * REAL BrokerState (createBrokerState(), broker-state.mts), wired to the
 * REAL handleMonitorClaim()/handleMonitorRelease()/handleRelayAttach() (and,
 * when `opts.withTransfer`, handleStageFile()/handleFileTransfer()) from the
 * compiled resources/vice-broker.mjs artifact -- never a re-implemented
 * stand-in, mirroring broker-relay.test.ts's/transfer-disjoint-roots.test.ts's
 * own established idiom. `onAcquire` registers the granted instance/grant
 * dynamically, under the request id the REAL vice-proxy.ts client itself
 * generates (vice-broker-client.ts's own newRequestId()) -- that request id
 * IS the grant id the proxy names as its own target for every subsequent
 * monitor_claim/attach/stage_file/transfer, so this fixture never needs to
 * predict it. `onRelayAttach` is wrapped with a recorder that captures every
 * attach's target, channel and presented handle BEFORE delegating -- the
 * G-64-1 tracer's own central assertion. Each test points its proxy at the
 * listener with VICE_BROKER_CONTROL_PORT = `listenerPort`. */
async function g6408StartFixture(
  opts: {
    withTransfer?: boolean;
    withText?: boolean;
    onDump?: (filename: string) => void;
    onUndump?: (filename: string) => Promise<void> | void;
  } = {},
): Promise<G6408Fixture> {
  const dir = mkdtempSync(join(tmpdir(), "vice-proxy-g6408-pool-"));
  const brokerHomeDir = mkdtempSync(join(tmpdir(), "vice-proxy-g6408-brokerhome-"));
  // Relay-death incident records must land here, never the real, machine-level
  // brokerIncidentsDir() (~/.c64-re-tools/incidents/) -- this suite's own
  // SIGKILL of the proxy child, in every test below, tears the relay socket
  // down as an UNANNOUNCED death, and handleRelayAttach()'s own teardown
  // writes an incident record for exactly that. Mirrors
  // broker-relay.test.ts's own startRelayListenerForState() default.
  const incidentsDir = mkdtempSync(join(tmpdir(), "vice-proxy-g6408-incidents-"));
  const stubEmulator = await g6408StartStubEmulator({ onDump: opts.onDump, onUndump: opts.onUndump });
  const stubTextMonitor = opts.withText ? await g6408StartStubTextMonitor() : null;

  const state = createBrokerState();
  const attachCalls: G6408AttachCall[] = [];
  const acquiredTargetIds: string[] = [];
  const stageFileCalls: Array<{ targetId: string; slot: string }> = [];
  const fileTransferCalls: FileTransferRequest[] = [];

  const listener = await startControlListener({
    host: "127.0.0.1",
    port: 0,
    onAcquire: async (requestId) => {
      acquiredTargetIds.push(requestId);
      const instance: InstanceRecord = {
        port: stubEmulator.port,
        url: `http://127.0.0.1:${stubEmulator.port}/mcp`,
        state: "granted",
        reason: "acquire",
        epochFile: join(dir, "epoch.json"),
        supervisorDir: dir,
        pid: 4242,
        expectedIdentity: "x64sc",
        launchedAt: 0,
        readyAt: 0,
        viceBin: "x64sc",
        viceArgs: [],
        dryRun: false,
        monitorClients: {},
        ...(stubTextMonitor ? { remoteMonitorPort: stubTextMonitor.port } : {}),
      };
      state.instances.set(stubEmulator.port, instance);
      state.grants.set(requestId, { id: requestId, port: stubEmulator.port, grantedAt: Date.now(), pid: 4242, operation: null, sessionLabel: null });
      return {
        ok: true,
        grant: {
          port: stubEmulator.port,
          url: `http://127.0.0.1:${stubEmulator.port}/mcp`,
          ...(stubTextMonitor ? { remoteMonitorPort: stubTextMonitor.port } : {}),
        },
      };
    },
    onRelease: () => {},
    onStatus: () => [],
    onHostState: () => ({
      pid: process.pid,
      startedAt: "2026-01-01T00:00:00Z",
      nodeVersion: process.version,
      viceBin: "x64sc",
      maxInstances: 1,
      basePort: stubEmulator.port,
      backend: "stock" as const,
    }),
    onMonitorClaim: (requestId, targetId, channel) => g6408HandleMonitorClaim(requestId, targetId, channel, state),
    onMonitorRelease: (requestId, targetId, channel) => g6408HandleMonitorRelease(requestId, targetId, channel, state),
    onRelayAttach: (targetId, channel, presentedHandle, socket, pending) => {
      attachCalls.push({ targetId, channel, handle: presentedHandle });
      return g6408HandleRelayAttach(targetId, channel, presentedHandle, socket, pending, state, {
        writeIncident: (record) => g6408WriteBrokerIncident(record, { dir: incidentsDir }),
      });
    },
    onOperation: () => ({ ok: true as const }),
    onStageFile: opts.withTransfer
      ? (targetId, slot) => {
          stageFileCalls.push({ targetId, slot });
          return g6408HandleStageFile(targetId, slot, state);
        }
      : undefined,
    onFileTransfer: opts.withTransfer
      ? (request, socket, pending) => {
          fileTransferCalls.push(request);
          return g6408HandleFileTransfer(request, socket, pending, state);
        }
      : undefined,
  });

  return {
    dir,
    brokerHomeDir,
    incidentsDir,
    listenerPort: listener.port,
    listenerServer: listener.server,
    stubEmulator,
    stubTextMonitor,
    state,
    attachCalls,
    acquiredTargetIds,
    stageFileCalls,
    fileTransferCalls,
  };
}

async function g6408TeardownFixture(fixture: G6408Fixture): Promise<void> {
  await new Promise<void>((resolvePromise) => fixture.listenerServer.close(() => resolvePromise()));
  await new Promise<void>((resolvePromise) => fixture.stubEmulator.server.close(() => resolvePromise()));
  if (fixture.stubTextMonitor) {
    await new Promise<void>((resolvePromise) => fixture.stubTextMonitor!.server.close(() => resolvePromise()));
  }
  rmSync(fixture.dir, { recursive: true, force: true });
  rmSync(fixture.brokerHomeDir, { recursive: true, force: true });
  rmSync(fixture.incidentsDir, { recursive: true, force: true });
}

/** Every byte value 0x00..0xFF, repeated well past 65536 bytes -- so a
 * truncation or an encoding mishap on the journey shows up as a byte
 * difference rather than passing by luck. Mirrors
 * transfer-disjoint-roots.test.ts's own fullByteRangeBuffer(). */
function g6408FullByteRangeBuffer(): Buffer {
  const unit = Buffer.alloc(256);
  for (let i = 0; i < 256; i++) unit[i] = i;
  return Buffer.concat(Array(300).fill(unit) as Buffer[]); // 76800 bytes > 65536
}

/** Recursively scans every string leaf of `value` for `forbiddenPrefix` --
 * mirrors transfer-disjoint-roots.test.ts's own collectStringLeaves()/
 * assertNoPrefixLeak() (D-15/D-17: a tool result must never carry a
 * broker-side path). */
function g6408CollectStringLeaves(value: unknown, path: string, out: Array<{ path: string; value: string }>): void {
  if (typeof value === "string") {
    out.push({ path, value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => g6408CollectStringLeaves(v, `${path}[${i}]`, out));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      g6408CollectStringLeaves(v, path === "" ? k : `${path}.${k}`, out);
    }
  }
}

function g6408AssertNoLeak(result: unknown, forbiddenPrefix: string, label: string): void {
  const leaves: Array<{ path: string; value: string }> = [];
  g6408CollectStringLeaves(result, "", leaves);
  const offenders = leaves.filter((leaf) => leaf.value.includes(forbiddenPrefix));
  assert.deepEqual(offenders, [], `${label}: no string value of any key may contain the broker-side prefix ${JSON.stringify(forbiddenPrefix)} -- found: ${JSON.stringify(offenders)}`);
}

test("G-64-1 tracer: vice_ping through the real proxy reaches a handle-authenticated relay attach, end to end", async () => {
  const fixture = await g6408StartFixture();
  const proxyWorkspace = mkdtempSync(join(tmpdir(), "vice-proxy-g6408-tracer-ws-"));
  const proxy = startProxy({
    VICE_POOL_DIR: fixture.dir,
    VICE_EPOCH_FILE: join(fixture.dir, "epoch.json"),
    VICE_BROKER_CONTROL_PORT: String(fixture.listenerPort),
    CLAUDE_PROJECT_DIR: proxyWorkspace,
    VICE_SKIP_RESOURCE_INSTALL: "1",
  });
  try {
    proxy.send({ jsonrpc: "2.0", id: 1, method: "initialize", params: initThenListParams() });
    await proxy.nextMessage();

    proxy.send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "vice_ping", arguments: {} } });
    const resp = await proxy.nextMessage();
    assert.equal(resp.id, 2);
    assert.equal(resp.result.isError, false, `expected vice_ping to succeed, reading the result rather than discarding it: ${JSON.stringify(resp)}`);
    const payload = JSON.parse(resp.result.content[0].text);
    assert.equal(payload.status, "ok");
    assert.equal(typeof payload.viceVersion, "string");
    assert.match(payload.viceVersion, /3\.9\.0\.0/, "the answer must name the stub emulator's own version quad");

    assert.equal(fixture.attachCalls.length, 1, "the broker-side attach callback must be invoked exactly once");
    assert.equal(fixture.attachCalls[0]!.channel, "binary");
    assert.ok(fixture.attachCalls[0]!.handle.length > 0, "the presented handle must be non-empty");

    assert.equal(fixture.acquiredTargetIds.length, 1, "exactly one acquire must have reached this fixture's onAcquire");
    const targetId = fixture.acquiredTargetIds[0]!;
    assert.equal(fixture.attachCalls[0]!.targetId, targetId);
    // A repeat claim on the SAME grant/channel is idempotent (handleMonitorClaim's
    // own contract) -- echoing the SAME handle proves the attach recorder's
    // handle really is the one the real claim handler minted for this
    // request, not merely A non-empty string.
    const repeatClaim = g6408HandleMonitorClaim("g6408-verify-claim", targetId, "binary", fixture.state);
    assert.ok(repeatClaim.ok, `expected the verification re-claim to succeed: ${JSON.stringify(repeatClaim)}`);
    if (repeatClaim.ok) {
      assert.equal(fixture.attachCalls[0]!.handle, repeatClaim.handle, "the attach's presented handle must equal the one handleMonitorClaim() minted for this grant");
    }

    assert.deepEqual(
      [...fixture.stubEmulator.unansweredCommandTypes],
      [],
      "every command type the stub emulator received must have been answered -- a silently-ignored command hangs rather than fails",
    );
  } finally {
    proxy.child.kill("SIGKILL");
    await g6408TeardownFixture(fixture);
    rmSync(proxyWorkspace, { recursive: true, force: true });
  }
});

test("G-64-1 transfer: vice_snapshot_save then vice_snapshot_load complete through the real proxy in both directions, with no broker-side path in either result", async () => {
  const snapshotPayload = g6408FullByteRangeBuffer();
  const stagedPaths: { dump?: string; undump?: string } = {};
  let undumpBytes: Buffer | null = null;

  const fixture = await g6408StartFixture({
    withTransfer: true,
    onDump: (filename) => {
      stagedPaths.dump = filename;
      mkdirSync(dirname(filename), { recursive: true });
      writeFileSync(filename, snapshotPayload);
    },
    onUndump: async (filename) => {
      const arrived = await waitForCondition(() => existsSync(filename), { timeoutMs: 2000 });
      assert.ok(arrived, "the uploaded snapshot bytes must eventually land at the staged path (the accepted-risk race must still resolve, not hang)");
      stagedPaths.undump = filename;
      undumpBytes = readFileSync(filename);
    },
  });

  const proxyWorkspace = mkdtempSync(join(tmpdir(), "vice-proxy-g6408-transfer-ws-"));
  const prevBrokerHome = process.env.VICE_BROKER_HOME;
  // brokerStagingDir() (broker-home.mts) resolves process.env.VICE_BROKER_HOME
  // in THIS process -- handleStageFile()/handleFileTransfer() run as
  // synchronous callbacks of this fixture's own control listener, in this
  // same test process, never inside the spawned proxy child.
  process.env.VICE_BROKER_HOME = fixture.brokerHomeDir;

  const proxy = startProxy({
    VICE_POOL_DIR: fixture.dir,
    VICE_EPOCH_FILE: join(fixture.dir, "epoch.json"),
    VICE_BROKER_CONTROL_PORT: String(fixture.listenerPort),
    CLAUDE_PROJECT_DIR: proxyWorkspace,
    VICE_SKIP_RESOURCE_INSTALL: "1",
  });
  try {
    proxy.send({ jsonrpc: "2.0", id: 1, method: "initialize", params: initThenListParams() });
    await proxy.nextMessage();

    proxy.send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "vice_snapshot_save", arguments: { name: "g6408_disjoint" } } });
    const saveResp = await proxy.nextMessage();
    assert.equal(saveResp.result.isError, false, `vice_snapshot_save must succeed: ${JSON.stringify(saveResp)}`);
    const savePayload = JSON.parse(saveResp.result.content[0].text);
    assert.ok(
      String(savePayload.path).startsWith(proxyWorkspace),
      `the saved snapshot path (${savePayload.path}) must live under the proxy's own workspace (${proxyWorkspace})`,
    );
    assert.ok(existsSync(savePayload.path));
    assert.ok(readFileSync(savePayload.path).equals(snapshotPayload), "the downloaded snapshot's bytes must equal the fixture bytes byte-for-byte");
    g6408AssertNoLeak(savePayload, fixture.brokerHomeDir, "vice_snapshot_save result");
    assert.ok(stagedPaths.dump, "DUMP must have been sent");

    proxy.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vice_snapshot_load", arguments: { name: "g6408_disjoint" } } });
    const loadResp = await proxy.nextMessage();
    assert.equal(loadResp.result.isError, false, `vice_snapshot_load must succeed: ${JSON.stringify(loadResp)}`);
    const loadPayload = JSON.parse(loadResp.result.content[0].text);
    g6408AssertNoLeak(loadPayload, fixture.brokerHomeDir, "vice_snapshot_load result");

    assert.ok(undumpBytes, "UNDUMP must have been sent and its bytes captured");
    assert.ok((undumpBytes as unknown as Buffer).equals(snapshotPayload), "the bytes UNDUMP read back must equal the fixture bytes byte-for-byte");

    assert.equal(fixture.stageFileCalls.length, 2, "one stage_file call for the save, one for the load");
    assert.equal(fixture.fileTransferCalls.length, 2, "one transfer call (download) for the save, one (upload) for the load");
  } finally {
    proxy.child.kill("SIGKILL");
    await g6408TeardownFixture(fixture);
    rmSync(proxyWorkspace, { recursive: true, force: true });
    if (prevBrokerHome === undefined) delete process.env.VICE_BROKER_HOME;
    else process.env.VICE_BROKER_HOME = prevBrokerHome;
  }
});

test("G-64-1 text: vice_warp_set completes through the real proxy over the text relay, authenticated by its own handle", async () => {
  const fixture = await g6408StartFixture({ withText: true });
  const proxyWorkspace = mkdtempSync(join(tmpdir(), "vice-proxy-g6408-text-ws-"));
  const proxy = startProxy({
    VICE_POOL_DIR: fixture.dir,
    VICE_EPOCH_FILE: join(fixture.dir, "epoch.json"),
    VICE_BROKER_CONTROL_PORT: String(fixture.listenerPort),
    CLAUDE_PROJECT_DIR: proxyWorkspace,
    VICE_SKIP_RESOURCE_INSTALL: "1",
  });
  try {
    proxy.send({ jsonrpc: "2.0", id: 1, method: "initialize", params: initThenListParams() });
    await proxy.nextMessage();

    proxy.send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "vice_warp_set", arguments: { enabled: true } } });
    const resp = await proxy.nextMessage();
    assert.equal(resp.result.isError, false, `vice_warp_set must succeed: ${JSON.stringify(resp)}`);

    const textAttaches = fixture.attachCalls.filter((c) => c.channel === "text");
    assert.equal(textAttaches.length, 1, "exactly one attach on channel \"text\" must have been observed");
    assert.ok(textAttaches[0]!.handle.length > 0);

    const binaryAttaches = fixture.attachCalls.filter((c) => c.channel === "binary");
    assert.equal(binaryAttaches.length, 0, "vice_warp_set must never dial the binary channel");
  } finally {
    proxy.child.kill("SIGKILL");
    await g6408TeardownFixture(fixture);
    rmSync(proxyWorkspace, { recursive: true, force: true });
  }
});
