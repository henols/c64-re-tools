// The MCP server process ends when its client goes: by the end of stdin or by
// a signal, SIGHUP too. It ends normally, so it closes its session first.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { join } from "node:path";
import { test } from "node:test";

/** Starts the MCP server with no host to reach, and waits until it has tried one: its stop handlers are in place then. */
async function startMcp() {
  // Port 1 refuses at once, so the first session open fails fast.
  const mcp = spawn(process.execPath, [...process.execArgv, join(import.meta.dirname, "main.ts")], { stdio: ["pipe", "ignore", "pipe"], env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });
  let stderr = "";
  mcp.stderr.setEncoding("utf8");
  await new Promise<void>((resolve, reject) => {
    mcp.stderr.on("data", (chunk: string) => {
      stderr += chunk;
      if (/session not opened/.test(stderr)) resolve();
    });
    mcp.once("exit", () => reject(new Error(`the MCP server ended before it tried the host: ${stderr}`)));
  });
  return mcp;
}

test("the MCP server ends normally on SIGHUP", { skip: process.platform === "win32" ? "Windows has no SIGHUP to send" : false, timeout: 20_000 }, async () => {
  const mcp = await startMcp();
  const exited = once(mcp, "exit");
  mcp.kill("SIGHUP");
  // Killed by the signal, it would report the signal and no code: the session would not have closed.
  assert.deepEqual(await exited, [0, null]);
});

test("the MCP server ends normally when its stdin ends", { timeout: 20_000 }, async () => {
  const mcp = await startMcp();
  const exited = once(mcp, "exit");
  mcp.stdin.end();
  assert.deepEqual(await exited, [0, null]);
});
