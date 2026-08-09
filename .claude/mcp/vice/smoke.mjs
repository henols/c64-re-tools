#!/usr/bin/env node
// Smoke test for the published @henols/vice-mcp package: spawn the server bin
// exactly as a consumer would (node running the shipped vice-proxy.ts under
// native type-stripping), complete an MCP `initialize` handshake over stdio,
// and assert `tools/list` is answered from tools-manifest.json. This proves,
// end to end, that (a) node type-strips the .ts entry with no flags, (b) every
// file the `files` whitelist ships resolves at runtime, and (c) the MCP stdio
// transport works -- without needing a live host VICE server (initialize and
// tools/list are answered locally; only tools/call forwards to the host).
//
// Runnable two ways:
//   node smoke.mjs                 -> runs ./vice-proxy.ts from this checkout
//   node smoke.mjs <path-to-bin>   -> runs an installed bin (CI, from a packed tarball)
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const TIMEOUT_MS = 30_000;

const target = process.argv[2];
const [cmd, args] = target
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
const pending = new Map(); // id -> {resolve, reject}
let nextId = 1;

function send(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

child.stdout.on("data", (chunk) => {
  buf += chunk.toString("utf8");
  let nl;
  while ((nl = buf.indexOf("\n")) !== -1) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue; // ignore any non-JSON line
    }
    if (msg.id != null && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`JSON-RPC error: ${JSON.stringify(msg.error)}`));
      else resolve(msg.result);
    }
  }
});

function fail(message) {
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

let done = false;
try {
  const init = await send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "vice-mcp-smoke", version: "0" },
  });
  if (!init || typeof init !== "object" || !init.serverInfo) {
    fail(`initialize returned an unexpected shape: ${JSON.stringify(init)}`);
  }
  child.stdin.write(
    JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n"
  );
  const list = await send("tools/list", {});
  if (!list || !Array.isArray(list.tools)) {
    fail(`tools/list returned an unexpected shape: ${JSON.stringify(list)}`);
  }
  done = true;
  clearTimeout(timer);
  console.error(
    `smoke: OK -- initialize + tools/list handshake completed (server ${init.serverInfo.name ?? "?"}, ` +
      `${list.tools.length} tool(s) advertised)`
  );
  child.kill("SIGTERM");
  process.exit(0);
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
}
