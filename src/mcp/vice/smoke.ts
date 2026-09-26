#!/usr/bin/env node
// smoke.ts
//
// WHY THIS FILE EXISTS: the boot smoke test for the MCP server (`npm run
// smoke`, run by CI). It spawns this checkout's vice-proxy.ts under Node's
// native type stripping, completes an MCP `initialize` handshake over stdio,
// and asserts `tools/list` is answered. This proves that Node type-strips the
// .ts entry with no flags, that every module the entry imports resolves at
// runtime, and that the stdio transport works. No broker or emulator is
// needed: initialize and tools/list are answered locally. smoke-packed.ts
// reuses mcpHandshake() against the compiled and the packed bin.
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
import { dirname, join, resolve } from "node:path";

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

/** What a completed handshake reports. */
export interface HandshakeResult {
  serverName: string;
  toolCount: number;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * Spawns `cmd args` as an MCP stdio server, sends `initialize`, then
 * `notifications/initialized` and `tools/list`, and resolves with the server
 * name and the advertised tool count. Rejects on a spawn error, an early
 * exit, a JSON-RPC error, an unexpected reply shape, or no answer within
 * TIMEOUT_MS. The child is killed on every path. The child's stderr is
 * inherited so a boot failure is visible.
 */
export function mcpHandshake(cmd: string, args: string[], cwd?: string): Promise<HandshakeResult> {
  return new Promise<HandshakeResult>((resolvePromise, rejectPromise) => {
    const child = spawn(cmd, args, {
      cwd,
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
    let settled = false;

    const timer = setTimeout(() => finish(new Error(`no handshake within ${TIMEOUT_MS}ms`)), TIMEOUT_MS);

    // Ends the child: closing its stdin is the ending vice-proxy exits on by
    // itself (it only releases its lease on a signal and waits for the
    // client's SIGKILL). SIGKILL follows if it has not exited within 5s, so
    // a caller that does not process.exit() is never held open by the child.
    function endChild(): void {
      try {
        child.stdin.end();
      } catch {}
      if (child.exitCode !== null || child.signalCode !== null) return;
      const killTimer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {}
      }, 5_000);
      child.once("exit", () => clearTimeout(killTimer));
    }

    function finish(outcome: Error | HandshakeResult): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (outcome instanceof Error) {
        try {
          child.kill("SIGKILL");
        } catch {}
        rejectPromise(outcome);
      } else {
        endChild();
        resolvePromise(outcome);
      }
    }

    function send(method: string, params: Record<string, unknown>): Promise<unknown> {
      const id = nextId++;
      return new Promise((res, rej) => {
        pending.set(id, { resolve: res, reject: rej });
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

    child.on("error", (e) => finish(new Error(`could not spawn server: ${e.message}`)));
    child.on("exit", (code, signal) => finish(new Error(`server exited early (code=${code}, signal=${signal})`)));
    // A write to a child that already died raises EPIPE here; the exit
    // handler above reports the real cause.
    child.stdin.on("error", () => {});

    (async () => {
      const init = await send("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "vice-mcp-smoke", version: "0" },
      });
      if (!isRecord(init) || !isRecord(init.serverInfo)) {
        throw new Error(`initialize returned an unexpected shape: ${JSON.stringify(init)}`);
      }
      const serverInfo = init.serverInfo;
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n");
      const list = await send("tools/list", {});
      if (!isRecord(list) || !Array.isArray(list.tools)) {
        throw new Error(`tools/list returned an unexpected shape: ${JSON.stringify(list)}`);
      }
      finish({ serverName: String(serverInfo.name ?? "?"), toolCount: list.tools.length });
    })().catch((e: unknown) => finish(e instanceof Error ? e : new Error(String(e))));
  });
}

// -------------------------------------------------------------------- CLI
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  const [cmd, args]: [string, string[]] = target ? [target, []] : ["node", [join(HERE, "vice-proxy.ts")]];
  try {
    const { serverName, toolCount } = await mcpHandshake(cmd, args);
    console.error(
      `smoke: OK -- initialize + tools/list handshake completed (server ${serverName}, ${toolCount} tool(s) advertised)`
    );
    process.exit(0);
  } catch (e) {
    console.error(`smoke: FAIL -- ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
