// r2000-mcp-client.test.ts -- the client-shape DECISION RECORD for D-16/D-17
// (plan 11-04, `<decisions_you_own>` #3), plus (once Task 3 lands in this
// same file) the failure-mode coverage for `r2000-mcp-client.ts` itself.
//
// WHY A DECISION RECORD, NOT JUST A CHOICE: RESEARCH.md recommends
// `@mastra/mcp`'s `MCPClient` (already a declared dependency) as the
// default, with a hand-rolled newline-delimited JSON-RPC client as the
// documented fallback, and names "MCPClient's heavier surface fights this
// phase's failure-handling discipline" as the fallback trigger. This file
// turns that judgment call into a DETERMINATE rule: measure `MCPClient`
// against five named properties using stub servers, and use `MCPClient` if
// and only if all five measure `"satisfied"`; otherwise implement the
// hand-rolled client. `MCP_CLIENT_VERDICT` below is the committed result of
// that measurement -- a future `@mastra/mcp` bump that changes any of the
// five makes the corresponding test in this file FAIL (the live-measured
// status will no longer equal the committed one), rather than silently
// invalidating `r2000-mcp-client.ts`'s module header, which quotes this
// verdict as its own justification.
//
// THE FIVE PROPERTIES AND WHY EACH IS REQUIRED HERE (see 11-04-PLAN.md's
// objective for the full reasoning):
//   1. An unanswered `tools/call` fails in bounded time.
//   2. A child that exits mid-call surfaces as a distinct error, not a
//      timeout.
//   3. A spawn failure (`ENOENT`) surfaces as a distinct error naming the
//      missing binary.
//   4. The child's exit code is reachable after the session closes.
//   5. The child's stderr is reachable and attributable to the call.
//
// MEASURED VERDICT (this session, against the installed `@mastra/mcp`
// 1.15.0 / transitively-hoisted MCP SDK 1.30.0): properties 1, 2, 3 and 5
// are SATISFIED; property 4 is NOT -- `MCPClient`'s entire public prototype
// (reflected at runtime below, not merely read from the `.d.ts`) carries no
// member whose name even contains the substring "exit", and no stdio
// server-config field of any kind surfaces the spawned child's exit status
// once its session has closed. Per the decision rule above, since not all
// five are satisfied, `r2000-mcp-client.ts` (Task 3) implements the
// hand-rolled newline-delimited JSON-RPC client instead of wrapping
// `MCPClient`. The deciding property is #4 (exit-code reachability) --
// exactly the property `r2000-verify.ts`'s own D-10 incident (a lying exit
// code) makes non-negotiable for this phase's "never trust a misleading
// success" discipline. `@mastra/mcp` remains a declared dependency for the
// server-side `MCPServer` class this repo already uses in `vice-proxy.ts`;
// it is simply not the client-side seam Task 3 builds on.
//
// STUB HARNESS: the stub server's SOURCE is a template literal in this file
// (`STUB_SOURCE`), written to a `stub.mjs` file inside a fresh
// `mkdtempSync()` directory at test run time -- never a
// committed fixture file under `.claude/mcp/vice/` (check-npm-packages.mjs
// forbids a `fixtures/` directory in the published tarball, and a stray
// `*.mjs` fixture here would also trip `check-npm-packages.mjs`'s
// transitive-closure walk). The single stub script implements FIVE
// behaviours selected by a `STUB_MODE` environment variable set per
// `MCPClient` server config, so this file needs exactly one script body
// rather than five near-duplicates:
//   (a) "happy"              -- answers initialize, tools/list and
//                               tools/call correctly.
//   (b) "never-answers-call" -- answers initialize/tools/list, then NEVER
//                               answers a tools/call (silently swallows it).
//   (c) "exit-mid-call"      -- answers initialize/tools/list, then calls
//                               `process.exit(0)` on receiving tools/call,
//                               without responding.
//   (d) "exit-with-stderr"   -- answers initialize/tools/list, then writes
//                               a marker line to stderr and exits 3 on
//                               receiving tools/call.
//   (e) (no script at all)   -- `command` points at a binary name
//                               guaranteed not to exist, producing a spawn
//                               ENOENT.
//
// Do NOT import the underlying MCP TypeScript SDK package that `@mastra/mcp`
// wraps internally, directly, anywhere in this file -- it is present only as
// an undeclared transitive dependency, resolvable today only because npm's
// current dedup pass happens to hoist it into this project's own
// `node_modules`. A direct import here would be an
// ENGINEERING_RULES.md §4 phantom-dependency violation. This file only
// ever imports the public `MCPClient` class from the declared dependency.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { MCPClient } from "@mastra/mcp";
import type { Tool } from "@mastra/core/tools";

/** `Tool.execute` is declared optional on the type (`execute?: (...) => ...`)
 * even though every tool `MCPClient.listTools()` returns always has one --
 * this helper centralizes the non-null assertion and the empty invocation
 * context every call site below needs, rather than repeating `tool.execute!
 * ({}, {} as never)` five times. */
async function callTool(tool: Tool<any, any, any, any>, input: Record<string, unknown> = {}): Promise<unknown> {
  return tool.execute!(input, {} as never);
}

// -- Stub harness -------------------------------------------------------

/**
 * The one stub server script body, selecting its behaviour from
 * `process.env.STUB_MODE`. Speaks newline-delimited JSON-RPC over stdio,
 * matching `mcp/stdio.rs`'s confirmed real-regenerator2000 framing
 * (RESEARCH.md Code Examples): exactly one JSON message per line, both
 * directions.
 */
const STUB_SOURCE = `
import { createInterface } from "node:readline";
const MODE = process.env.STUB_MODE || "happy";
const rl = createInterface({ input: process.stdin, terminal: false });
function send(msg) { process.stdout.write(JSON.stringify(msg) + "\\n"); }
rl.on("line", (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.method === "initialize") {
    send({ jsonrpc: "2.0", id: msg.id, result: {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: \`stub-\${MODE}\`, version: "0.0.0" },
    } });
    return;
  }
  if (msg.method === "notifications/initialized") return;
  if (msg.method === "tools/list") {
    send({ jsonrpc: "2.0", id: msg.id, result: { tools: [
      { name: "echo", description: "echo back", inputSchema: { type: "object", properties: {}, additionalProperties: true } },
    ] } });
    return;
  }
  if (msg.method === "tools/call") {
    if (MODE === "never-answers-call") return; // (b): swallow forever, no response
    if (MODE === "exit-mid-call") { process.exit(0); } // (c): die before answering
    if (MODE === "exit-with-stderr") { // (d): die noisily, non-zero
      process.stderr.write("stub-exit-with-stderr: deliberate failure marker\\n");
      process.exit(3);
    }
    send({ jsonrpc: "2.0", id: msg.id, result: { content: [ { type: "text", text: "ok" } ] } }); // (a)
    return;
  }
  if (msg.id !== undefined) {
    send({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: \`unhandled method \${msg.method}\` } });
  }
});
`;

let workDir: string | undefined;

function stubPath(): string {
  if (!workDir) {
    workDir = mkdtempSync(join(tmpdir(), "r2000-mcp-client-test-"));
    writeFileSync(join(workDir, "stub.mjs"), STUB_SOURCE);
  }
  return join(workDir, "stub.mjs");
}

after(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

const STUB_TIMEOUT_MS = 2_000;

/** One `MCPClient` wired to the stub in the given mode, with a unique `id`
 * per call (MCPClient's own constructor caches by config identity and
 * throws on an unkeyed collision) and stderr piped so property 5 can be
 * measured. */
function clientFor(mode: string, testName: string): MCPClient {
  return new MCPClient({
    id: `r2000-mcp-client-test-${testName}-${Date.now()}-${Math.random()}`,
    servers: {
      r2000: {
        command: process.execPath,
        args: [stubPath()],
        env: { STUB_MODE: mode },
        stderr: "pipe",
        timeout: STUB_TIMEOUT_MS,
      },
    },
  });
}

// -- Committed verdict ----------------------------------------------------

interface PropertyVerdict {
  status: "satisfied" | "not-satisfied";
  reason: string;
}

/**
 * MEASURED against `@mastra/mcp` 1.15.0 (this session). Each entry's
 * `status` is asserted, below, against a FRESH live measurement -- this
 * constant is not merely documentation, it is the expected value a future
 * dependency bump must continue to reproduce or this file fails loudly.
 */
export const MCP_CLIENT_VERDICT: Record<
  "boundedTimeoutOnUnansweredCall" | "distinctErrorOnMidCallExit" | "namedSpawnFailure" | "exitCodeReachable" | "stderrReachableAndAttributable",
  PropertyVerdict
> = {
  boundedTimeoutOnUnansweredCall: {
    status: "satisfied",
    reason:
      'a tools/call against the "never answers" stub rejects with "MCP error -32001: Request timed out" ' +
      "at almost exactly the configured per-server timeout (measured ~2050ms against a 2000ms timeout), " +
      "never hanging indefinitely.",
  },
  distinctErrorOnMidCallExit: {
    status: "satisfied",
    reason:
      'a tools/call against the "exit mid-call" stub rejects almost immediately (measured tens of ' +
      'milliseconds, not the full timeout window) with "MCP error -32000: Connection closed" -- a ' +
      "different JSON-RPC error code and message than the timeout case, and arriving far faster than " +
      "the configured timeout, so the two are trivially distinguishable by a caller.",
  },
  namedSpawnFailure: {
    status: "satisfied",
    reason:
      "listToolsWithErrors() against a nonexistent command resolves quickly (measured single-digit " +
      'milliseconds) with a per-server error string containing both "ENOENT" and the literal missing ' +
      "command name -- never a bare generic failure.",
  },
  exitCodeReachable: {
    status: "not-satisfied",
    reason:
      "MCPClient's entire public prototype (reflected via Object.getOwnPropertyNames at test run time, " +
      'not merely read from the .d.ts) contains no member whose name matches /exit/i, and no stdio ' +
      "server-config field of any kind exposes the spawned child's exit status once its session has " +
      "closed. This is the deciding property: r2000-mcp-client.ts (Task 3) implements the hand-rolled " +
      "client instead.",
  },
  stderrReachableAndAttributable: {
    status: "satisfied",
    reason:
      'getServerStderr(serverName) returns a readable stream that, for the "exit with stderr" stub, ' +
      "carries exactly the marker line that stub wrote before exiting -- reachable, and attributable " +
      "to the specific call that triggered it because each test uses its own isolated MCPClient/server " +
      "pair.",
  },
};

// -- Property 1: bounded-time failure on an unanswered tools/call ---------

test("Property 1 (bounded timeout): a tools/call against a stub that never answers (b) fails in bounded time, not indefinitely", async () => {
  const mcp = clientFor("never-answers-call", "p1");
  try {
    const tools = await mcp.listTools();
    const tool = tools["r2000_echo"];
    assert.ok(tool, "expected the stub's echo tool to be listed even though tools/call will never answer");

    const start = Date.now();
    let rejected = false;
    try {
      await callTool(tool);
    } catch {
      rejected = true;
    }
    const elapsedMs = Date.now() - start;

    // The property is "satisfied" only if the call actually rejected, AND
    // did so in bounded time (well under the plan's own 30s ceiling) rather
    // than hanging indefinitely -- this IS the live measurement, computed
    // from the same observations the assertions below re-check individually.
    const measured: PropertyVerdict["status"] = rejected && elapsedMs < 25_000 ? "satisfied" : "not-satisfied";

    assert.ok(rejected, "expected the never-answers-call tools/call to reject rather than resolve");
    assert.ok(elapsedMs < 25_000, `expected a bounded-time failure, took ${elapsedMs}ms`);
    assert.ok(
      elapsedMs >= STUB_TIMEOUT_MS - 500,
      `expected the failure to arrive near the configured ${STUB_TIMEOUT_MS}ms timeout, took only ${elapsedMs}ms`
    );

    assert.equal(
      measured,
      MCP_CLIENT_VERDICT.boundedTimeoutOnUnansweredCall.status,
      "live measurement no longer matches the committed verdict for property 1"
    );
  } finally {
    await mcp.disconnect();
  }
});

// -- Property 2: mid-call exit is distinct from a timeout ------------------

test("Property 2 (distinct mid-call-exit error): a tools/call against a stub that exits mid-call (c) fails fast, with a different error than the timeout case", async () => {
  const mcp = clientFor("exit-mid-call", "p2");
  try {
    const tools = await mcp.listTools();
    const tool = tools["r2000_echo"];
    assert.ok(tool, "expected the stub's echo tool to be listed even though the process will exit mid-call");

    const start = Date.now();
    let caught: unknown;
    try {
      await callTool(tool);
    } catch (e) {
      caught = e;
    }
    const elapsedMs = Date.now() - start;

    assert.ok(caught instanceof Error, "expected the mid-call exit to reject with an Error");
    const message = (caught as Error).message;
    const failsFast = elapsedMs < STUB_TIMEOUT_MS / 2;
    const notTimeoutShaped = !/timed out|timeout/i.test(message);

    // Fails FAST -- nowhere near the configured timeout window -- which is
    // the observable signal that distinguishes this from Property 1's
    // never-answers case, since MCPClient does not expose a distinct error
    // CLASS for the two (both surface as the SDK's own generic error type).
    const measured: PropertyVerdict["status"] =
      caught instanceof Error && failsFast && notTimeoutShaped ? "satisfied" : "not-satisfied";

    assert.ok(
      failsFast,
      `expected a fast failure well under the ${STUB_TIMEOUT_MS}ms timeout, took ${elapsedMs}ms -- ` +
        `indistinguishable-from-a-timeout would be the failure mode here`
    );
    assert.ok(notTimeoutShaped, `expected a connection/close-shaped error, not a timeout-shaped one; got: ${message}`);

    assert.equal(
      measured,
      MCP_CLIENT_VERDICT.distinctErrorOnMidCallExit.status,
      "live measurement no longer matches the committed verdict for property 2"
    );
  } finally {
    await mcp.disconnect();
  }
});

// -- Property 3: spawn ENOENT names the missing binary ----------------------

test("Property 3 (named spawn failure): a nonexistent command surfaces ENOENT naming the missing binary, in bounded time", async () => {
  const missingBin = "definitely-not-installed-r2000-mcp-client-stub-xyz";
  const mcp = new MCPClient({
    id: `r2000-mcp-client-test-p3-${Date.now()}-${Math.random()}`,
    servers: {
      r2000: { command: missingBin, args: [], timeout: STUB_TIMEOUT_MS },
    },
  });
  try {
    const start = Date.now();
    const { tools, errors } = await mcp.listToolsWithErrors();
    const elapsedMs = Date.now() - start;

    assert.equal(Object.keys(tools).length, 0, "expected no tools from a server that never spawned");
    assert.ok(errors["r2000"], "expected listToolsWithErrors() to report a per-server error for r2000");
    assert.match(errors["r2000"]!, /ENOENT/, "expected the reported error to name ENOENT");
    assert.ok(
      errors["r2000"]!.includes(missingBin),
      `expected the reported error to name the missing binary "${missingBin}" -- got: ${errors["r2000"]}`
    );
    assert.ok(elapsedMs < 10_000, `expected the spawn failure to surface quickly, took ${elapsedMs}ms`);

    const namesMissingBin = !!errors["r2000"] && errors["r2000"].includes(missingBin) && /ENOENT/.test(errors["r2000"]);
    const measured: PropertyVerdict["status"] =
      namesMissingBin && elapsedMs < 10_000 ? "satisfied" : "not-satisfied";

    assert.equal(
      measured,
      MCP_CLIENT_VERDICT.namedSpawnFailure.status,
      "live measurement no longer matches the committed verdict for property 3"
    );
  } finally {
    await mcp.disconnect();
  }
});

// -- Property 4: exit code reachability (reflection, not a stub) -----------

test("Property 4 (exit code reachability): MCPClient's public prototype exposes no member for retrieving the spawned child's exit code", () => {
  // Reflected against the ACTUAL installed @mastra/mcp at test run time --
  // not merely read from its .d.ts -- so a future release that adds an
  // exit-code accessor is caught by this test turning "satisfied" the
  // moment it exists, rather than this file silently staying stale.
  const members = Object.getOwnPropertyNames(MCPClient.prototype);
  const exitRelated = members.filter((m) => /exit/i.test(m));
  const measured: PropertyVerdict["status"] = exitRelated.length === 0 ? "not-satisfied" : "satisfied";

  assert.deepEqual(
    exitRelated,
    [],
    `expected no exit-code-related member on MCPClient.prototype; found: ${exitRelated.join(", ")} -- ` +
      "property 4 verdict must flip to satisfied if this ever fails"
  );

  assert.equal(
    measured,
    MCP_CLIENT_VERDICT.exitCodeReachable.status,
    "live measurement no longer matches the committed verdict for property 4"
  );
});

// -- Property 5: stderr reachable and attributable to the call -------------

test("Property 5 (stderr reachable and attributable): stderr from a stub that exits with a marker line (d) is captured and attributable to that call", async () => {
  const mcp = clientFor("exit-with-stderr", "p5");
  try {
    const tools = await mcp.listTools();
    const tool = tools["r2000_echo"];
    assert.ok(tool, "expected the stub's echo tool to be listed even though the process will exit with stderr");

    let stderrBuf = "";
    const stderrStream = mcp.getServerStderr("r2000");
    assert.ok(stderrStream, "expected a piped stderr stream (stderr: 'pipe' was set on the server config)");
    stderrStream!.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString("utf8");
    });

    await assert.rejects(() => callTool(tool));

    // Give the stderr stream's already-buffered data one microtask/timer
    // turn to be delivered to the 'data' handler above -- the child's exit
    // and the reject() can race the stream's own flush.
    await new Promise((resolve) => setTimeout(resolve, 200));

    const markerCaptured = /stub-exit-with-stderr: deliberate failure marker/.test(stderrBuf);
    const measured: PropertyVerdict["status"] = markerCaptured ? "satisfied" : "not-satisfied";

    assert.ok(
      markerCaptured,
      `expected the stub's marker line in captured stderr; got: ${JSON.stringify(stderrBuf)}`
    );

    assert.equal(
      measured,
      MCP_CLIENT_VERDICT.stderrReachableAndAttributable.status,
      "live measurement no longer matches the committed verdict for property 5"
    );
  } finally {
    await mcp.disconnect();
  }
});

// -- Stub (a) baseline: the happy path itself, exercised directly ----------

test("Stub (a) baseline: initialize + tools/list + tools/call all succeed against the happy stub", async () => {
  const mcp = clientFor("happy", "baseline");
  try {
    const tools = await mcp.listTools();
    const tool = tools["r2000_echo"];
    assert.ok(tool, "expected the happy stub's echo tool to be listed");
    const result = await callTool(tool);
    assert.ok(result, "expected a resolved result from the happy stub's tools/call");
  } finally {
    await mcp.disconnect();
  }
});

// -- Decision rule application, spelled out explicitly ----------------------

test("Decision rule: MCPClient is used if and only if all five properties are satisfied -- one is not, so the hand-rolled client is the chosen path (Task 3)", () => {
  const statuses = Object.values(MCP_CLIENT_VERDICT).map((v) => v.status);
  const allSatisfied = statuses.every((s) => s === "satisfied");
  assert.equal(
    allSatisfied,
    false,
    "expected at least one property to measure not-satisfied, given property 4's recorded verdict"
  );
  // Spelled out for a reader of this test file alone, no need to open
  // r2000-mcp-client.ts's header to learn the outcome:
  assert.equal(MCP_CLIENT_VERDICT.exitCodeReachable.status, "not-satisfied");
});
