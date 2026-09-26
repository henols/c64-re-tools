#!/usr/bin/env node
// smoke.ts
//
// WHY THIS FILE EXISTS: the boot smoke test for the MCP server (`npm run
// smoke`, run by CI). It spawns this checkout's vice-proxy.ts under Node's
// native type stripping, completes an MCP `initialize` handshake over stdio,
// and asserts `tools/list` is answered. This proves that Node type-strips the
// .ts entry with no flags, that every module the entry imports resolves at
// runtime, and that the stdio transport works. No broker or emulator is
// needed: initialize and tools/list are answered locally.
//
// Usage:
//   node smoke.ts              -> runs ./vice-proxy.ts from this checkout
//   node smoke.ts <executable> -> runs that executable instead, with no args
//
// WHAT NOT TO DO:
//   - Never call a tool here; tools/call forwards to a broker, which the
//     smoke test must not need.
//   - Never pass the child a shell string; spawn takes an argv array.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const TIMEOUT_MS = 30_000;

interface JsonRpcReply {
  id?: number | string | null;
  result?: unknown;
  error?: unknown;
}

interface Pending {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
}

const target = process.argv[2];
const [cmd, args]: [string, string[]] = target
  ? [target, []]
  : ["node", [join(HERE, "vice-proxy.ts")]];

const child = spawn(cmd, args, {
  stdio: ["pipe", "pipe", "inherit"],
  env: {
    ...process.env,
    VICE_SKIP_RESOURCE_INSTALL: "1",
    MASTRA_TELEMETRY_DISABLED: "1",
  },
});

let buf = "";
const pending = new Map<number | string, Pending>();
let nextId = 1;
let done = false;

function send(method: string, params: Record<string, unknown>): Promise<unknown> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

child.stdout.on("data", (chunk: Buffer) => {
  buf += chunk.toString("utf8");
  let nl;
  while ((nl = buf.indexOf("\n")) !== -1) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg: JsonRpcReply;
    try {
      msg = JSON.parse(line) as JsonRpcReply;
    } catch {
      continue; // ignore any non-JSON line
    }
    if (msg.id == null) continue;
    const entry = pending.get(msg.id);
    if (entry) {
      pending.delete(msg.id);
      if (msg.error) entry.reject(new Error(`JSON-RPC error: ${JSON.stringify(msg.error)}`));
      else entry.resolve(msg.result);
    }
  }
});

function fail(message: string): never {
  console.error(`smoke: FAIL -- ${message}`);
  try {
    child.kill("SIGKILL");
  } catch {}
  process.exit(1);
}

child.on("error", (e) => fail(`could not spawn server: ${e.message}`));
child.on("exit", (code, signal) => {
  if (!done) fail(`server exited early (code=${code}, signal=${signal})`);
});

const timer = setTimeout(() => fail(`no handshake within ${TIMEOUT_MS}ms`), TIMEOUT_MS);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

try {
  const init = await send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "vice-mcp-smoke", version: "0" },
  });
  if (!isRecord(init) || !isRecord(init.serverInfo)) {
    fail(`initialize returned an unexpected shape: ${JSON.stringify(init)}`);
  }
  const serverInfo = init.serverInfo;
  child.stdin.write(
    JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n"
  );
  const list = await send("tools/list", {});
  if (!isRecord(list) || !Array.isArray(list.tools)) {
    fail(`tools/list returned an unexpected shape: ${JSON.stringify(list)}`);
  }
  const tools = list.tools;
  done = true;
  clearTimeout(timer);
  console.error(
    `smoke: OK -- initialize + tools/list handshake completed (server ${String(serverInfo.name ?? "?")}, ` +
      `${tools.length} tool(s) advertised)`
  );
  child.kill("SIGTERM");
  process.exit(0);
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
}
