#!/usr/bin/env node
// 64-g641-live-driver.mjs
//
// The scripted stdio driver for G-64-1's live check (plan 64-11): spawns THE
// REAL `src/mcp/vice/vice-proxy.ts` over stdio -- the exact production entry
// point a real Claude Code session speaks to -- and drives it through the
// same newline-delimited JSON-RPC framing `vice-proxy.test.ts`'s own
// `startProxy()`/`handshake()` harness already established (this file
// mirrors that shape rather than re-inventing it, so a reader who knows one
// knows both). No broker-location variable is ever set here: the whole
// point of this run is that the unconfigured client finds the real,
// machine-level broker.json through plan 64-10's shared `brokerStateDir()`
// resolver, exactly as an ordinary Claude Code session would.
//
// EMBEDS NO MACHINE-SPECIFIC PATH. Every path this script touches --
// `--proxy-path`, `--client-project-dir`, `--transcript`, `--sequence` --
// arrives on the command line. The caller (a plan-64-11 scratch
// orchestration script, kept outside the repository tree per this plan's
// own prohibitions) supplies real, host-specific paths at invocation time.
//
// TWO WAYS TO USE THIS FILE:
//   1. As a CLI (`node 64-g641-live-driver.mjs --proxy-path ...`): runs
//      `initialize`, then a caller-supplied JSON sequence of `call`/`poll`
//      steps against the real proxy, writing every raw JSON-RPC message to
//      a transcript file, then closes the session. This is what Task 1's
//      own tracer run (`vice_ping` alone) uses.
//   2. As an ES module (`import { spawnLiveDriverSession, parsedContentOf }
//      from "./64-g641-live-driver.mjs"`): the multi-step, conditional
//      Task 2 flow (negative control, autostart with a fallback route, a
//      timeout-bounded load poll, the write-loss cycle's screen-RAM
//      directory check) needs real branching logic a declarative JSON
//      sequence cannot express cleanly -- that orchestration script imports
//      this module's exports directly and writes its own control flow,
//      while still going through this ONE spawn/transcript implementation
//      rather than a second one.
//
// Never asserts anything about VICE-side behaviour itself -- that judgment
// belongs to the caller (the plan's own acceptance criteria and the
// evidence file), not this transport-level driver.

import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

/** Extracts and JSON-parses `result.content[0].text` from a `tools/call`
 * response -- the shape every stock handler's `stockAnswer()`/
 * `isErrorText()` produces (src/mcp/vice/stock-dispatch.ts). Returns `null`
 * (never throws) when the shape does not match or the text is not
 * parseable JSON, so a caller can still fall back to the raw response. */
export function parsedContentOf(resp) {
  const text = resp && resp.result && Array.isArray(resp.result.content) ? resp.result.content[0]?.text : undefined;
  if (typeof text !== "string") return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Newline-delimited JSON-RPC-over-stdio, matching vice-proxy.ts's own
 * framing exactly (one JSON value per line, both directions). Spawns the
 * proxy at `proxyPath` with `clientProjectDir` as CLAUDE_PROJECT_DIR and
 * MASTRA_TELEMETRY_DISABLED=1, plus any caller-supplied `env` overrides --
 * but never injects a broker-location variable of its own, so the spawned
 * proxy resolves broker.json exactly the way an unmodified Claude Code
 * session would. `transcriptPath`, if given, is truncated at session start
 * and gains one JSON line per logged step (see `logStep` below) -- the
 * durable, host-independent record this plan's evidence file is built
 * from. */
export function spawnLiveDriverSession({ proxyPath, clientProjectDir, env = {}, transcriptPath }) {
  if (!proxyPath || !clientProjectDir) {
    throw new Error("spawnLiveDriverSession requires proxyPath and clientProjectDir");
  }
  if (transcriptPath) {
    mkdirSync(dirname(transcriptPath), { recursive: true });
    writeFileSync(transcriptPath, "");
  }

  const child = spawn(process.execPath, [proxyPath], {
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: clientProjectDir,
      MASTRA_TELEMETRY_DISABLED: "1",
      ...env,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  const messages = [];
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
      let parsed;
      try {
        parsed = JSON.parse(line);
      } catch (e) {
        parsed = { __parseError: String(e && e.message ? e.message : e), __raw: line };
      }
      messages.push(parsed);
    }
  });

  const stderrChunks = [];
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => stderrChunks.push(chunk));

  function logStep(record) {
    if (!transcriptPath) return;
    appendFileSync(transcriptPath, JSON.stringify({ at: new Date().toISOString(), ...record }) + "\n");
  }

  function send(msg) {
    child.stdin.write(JSON.stringify(msg) + "\n");
  }

  async function nextMessage(timeoutMs = 30000) {
    const start = Date.now();
    while (consumed >= messages.length) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(
          `timed out after ${timeoutMs}ms waiting for a proxy stdout message (stderr so far: ${stderrChunks.join("")})`,
        );
      }
      await new Promise((r) => setTimeout(r, 20));
    }
    return messages[consumed++];
  }

  let nextId = 1;

  /** One `initialize` + one `tools/list` -- the same minimal handshake
   * `vice-proxy.test.ts`'s own `handshake()` performs, kept identical on
   * purpose so this driver's wire behaviour is directly comparable to that
   * suite's. Never asserts; the caller does. */
  async function handshake() {
    send({
      jsonrpc: "2.0",
      id: nextId++,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "64-g641-live-driver", version: "1" },
      },
    });
    const initResp = await nextMessage();
    logStep({ step: "initialize", response: initResp });
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    send({ jsonrpc: "2.0", id: nextId++, method: "tools/list", params: {} });
    const listResp = await nextMessage();
    logStep({
      step: "tools/list",
      toolCount: Array.isArray(listResp?.result?.tools) ? listResp.result.tools.length : null,
    });
    return { initResp, listResp };
  }

  /** One `tools/call`, logged (raw response, and the parsed content when
   * parseable) to the transcript. Never asserts `isError` -- purely a
   * transport action; the caller decides what a given result means. */
  async function callTool(name, args = {}, { timeoutMs = 30000 } = {}) {
    const id = nextId++;
    send({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } });
    const resp = await nextMessage(timeoutMs);
    logStep({ step: "call", name, arguments: args, response: resp, content: parsedContentOf(resp) });
    return resp;
  }

  /** Repeats `callTool(name, args)` until `predicate(parsedContent, resp)`
   * returns true or `timeoutMs` elapses, waiting `intervalMs` between
   * attempts. Returns `{ matched, lastResponse, lastContent, attempts }` --
   * never throws on a timeout by itself; the caller decides whether a
   * timeout is fatal (this is what lets Task 2's own 90-second sentinel
   * poll and its screen-RAM directory poll share one implementation while
   * having different failure handling). */
  async function pollTool(name, args, predicate, { timeoutMs = 90000, intervalMs = 2000, callTimeoutMs = 30000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    let attempts = 0;
    let lastResponse = null;
    let lastContent = null;
    for (;;) {
      attempts++;
      lastResponse = await callTool(name, args, { timeoutMs: callTimeoutMs });
      lastContent = parsedContentOf(lastResponse);
      if (predicate(lastContent, lastResponse)) {
        logStep({ step: "poll-matched", name, attempts });
        return { matched: true, lastResponse, lastContent, attempts };
      }
      if (Date.now() >= deadline) {
        logStep({ step: "poll-timeout", name, attempts });
        return { matched: false, lastResponse, lastContent, attempts };
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  /** Closes stdin and waits for the proxy to exit (or force-kills it after
   * `killAfterMs`, so a hung child can never hang this driver or the plan
   * that runs it). Logs the exit code/signal. */
  async function close({ killAfterMs = 15000 } = {}) {
    child.stdin.end();
    await new Promise((resolvePromise) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill("SIGKILL");
        logStep({ step: "force-killed-after-timeout", killAfterMs });
        resolvePromise();
      }, killAfterMs);
      child.once("exit", (code, signal) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        logStep({ step: "exit", code, signal });
        resolvePromise();
      });
    });
  }

  return {
    child,
    send,
    nextMessage,
    handshake,
    callTool,
    pollTool,
    close,
    stderr: stderrChunks,
    transcriptPath,
  };
}

// ---------------------------------------------------------------------------
// CLI: only runs when this file is the actual process entry point, never on
// a plain `import` (mirrors vice-cli.mjs's own bottom-of-file guard). Reads
// a caller-supplied JSON sequence file (an array of {type:"call",...} /
// {type:"poll",...} steps) and drives it against the real proxy. This is
// what Task 1's own tracer run uses: a one-element sequence calling
// vice_ping alone.
// ---------------------------------------------------------------------------
function parseCliArgs(argv) {
  const opts = { env: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--proxy-path") opts.proxyPath = argv[++i];
    else if (a === "--client-project-dir") opts.clientProjectDir = argv[++i];
    else if (a === "--sequence") opts.sequencePath = argv[++i];
    else if (a === "--transcript") opts.transcriptPath = argv[++i];
    else if (a === "--env") {
      const kv = argv[++i];
      const eq = kv.indexOf("=");
      if (eq === -1) throw new Error(`--env value must be KEY=VALUE, got ${JSON.stringify(kv)}`);
      opts.env[kv.slice(0, eq)] = kv.slice(eq + 1);
    } else {
      throw new Error(`unrecognised argument: ${a}`);
    }
  }
  if (!opts.proxyPath || !opts.clientProjectDir || !opts.sequencePath) {
    throw new Error(
      "usage: 64-g641-live-driver.mjs --proxy-path <path> --client-project-dir <dir> --sequence <json-file> " +
        "[--transcript <file>] [--env KEY=VALUE ...]",
    );
  }
  return opts;
}

function getByDotPath(obj, path) {
  if (!path) return obj;
  return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

async function runCli() {
  const opts = parseCliArgs(process.argv.slice(2));
  if (!existsSync(opts.sequencePath)) {
    throw new Error(`sequence file not found: ${opts.sequencePath}`);
  }
  const sequence = JSON.parse(readFileSync(opts.sequencePath, "utf8"));
  if (!Array.isArray(sequence)) {
    throw new Error("sequence file must contain a JSON array of steps");
  }

  const session = spawnLiveDriverSession({
    proxyPath: opts.proxyPath,
    clientProjectDir: opts.clientProjectDir,
    env: opts.env,
    transcriptPath: opts.transcriptPath,
  });

  try {
    await session.handshake();
    for (const step of sequence) {
      if (step.type === "call") {
        await session.callTool(step.name, step.arguments ?? {}, { timeoutMs: step.timeoutMs });
      } else if (step.type === "poll") {
        const predicate = (content) => getByDotPath(content, step.path) === step.equals;
        const result = await session.pollTool(step.name, step.arguments ?? {}, predicate, {
          timeoutMs: step.timeoutMs,
          intervalMs: step.intervalMs,
        });
        if (step.failOnTimeout && !result.matched) {
          throw new Error(
            `poll step for ${step.name} did not match ${step.path} === ${JSON.stringify(step.equals)} before its deadline`,
          );
        }
      } else {
        throw new Error(`unknown step type: ${JSON.stringify(step.type)}`);
      }
    }
  } finally {
    await session.close();
  }
}

if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((e) => {
    process.stderr.write(`64-g641-live-driver: ${e && e.stack ? e.stack : e}\n`);
    process.exitCode = 1;
  });
}
