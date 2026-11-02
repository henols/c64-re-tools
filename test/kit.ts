// Helpers shared by the integration and end-to-end tests.

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { findTool, type ToolSpec } from "../src/native/discover.ts";

export { waitFor } from "../src/native/wait.testkit.ts";

const root = resolve(import.meta.dirname, "..");

/**
 * A new scratch folder (its real path), removed after the test that calls
 * this, or after the tests of the file when the module calls it. Never call it
 * in a before hook: there the folder goes when the hook ends.
 */
export function scratchDir(prefix: string): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), `c64-re-tools-${prefix}-`)));
  after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** The skip reason of a test that needs these tools, or false when each one is installed. */
export function toolSkip(...tools: ToolSpec[]): string | false {
  const missing = tools.filter((tool) => {
    try {
      findTool(tool);
      return false;
    } catch {
      return true;
    }
  });
  return missing.length === 0 ? false : missing.map((tool) => `${tool.name} is not installed: install it or set ${tool.envVar} to run this test`).join("; ");
}

export interface McpOptions {
  /** The project folder of the agent. */
  cwd?: string;
  /** More environment variables for the MCP server. */
  env?: Record<string, string>;
  /** "ignore" for a test that provokes errors on purpose. */
  stderr?: "inherit" | "ignore";
}

/** Starts the MCP server from this checkout as an agent does, connected to the Host Runtime at `address` (host:port). */
export async function startMcp(address: string, options: McpOptions = {}): Promise<{ client: Client; transport: StdioClientTransport }> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [...process.execArgv, resolve(root, "src/mcp/main.ts")],
    env: { ...env, C64RT_HOST: address, ...options.env },
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    stderr: options.stderr ?? "inherit",
  });
  const client = new Client({ name: "c64-re-tools-test", version: "0" });
  await client.connect(transport);
  return { client, transport };
}

/** `length` bytes that look random but are the same in every run for one `seed` (xorshift32). */
export function seededBytes(seed: number, length: number): Buffer {
  const bytes = Buffer.alloc(length);
  let state = seed >>> 0 || 1;
  for (let index = 0; index < length; index++) {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    bytes[index] = state & 0xff;
  }
  return bytes;
}

/** The one JSON envelope that a skill script prints. */
export interface ScriptEnvelope {
  ok: boolean;
  command?: string;
  body?: any;
  code?: string;
  error?: string;
  hint?: string;
  nextAction?: string;
}

/**
 * Reads the stdout of a skill script: exactly one envelope line, with ok:true
 * for exit status 0 and ok:false for exit status 2. Returns the envelope and
 * `json`: the body for ok:true, or { error: { code, message } } for ok:false,
 * where message is error and hint, so a test can match the whole text.
 */
export function readEnvelope(stdout: string, status: number | null): { envelope: ScriptEnvelope; json: any } {
  const lines = stdout.split("\n").filter((line) => line !== "");
  if (lines.length !== 1) throw new Error(`the script printed ${lines.length} lines, not one envelope: ${stdout}`);
  const envelope = JSON.parse(lines[0]!) as ScriptEnvelope;
  if (envelope.ok !== (status === 0) || (!envelope.ok && status !== 2)) throw new Error(`ok is ${envelope.ok}, but the exit status is ${status}: ${stdout}`);
  const json = envelope.ok ? envelope.body : { error: { code: envelope.code, message: [envelope.error, envelope.hint].filter((part) => part !== undefined).join(" ") } };
  return { envelope, json };
}

/** The path of the script `file` of the skill `skill`. */
export function skillScript(skill: string, file: string): string {
  return resolve(root, "skills", skill, "scripts", file);
}

export interface ScriptOptions {
  /** The working directory: the project folder of the agent. */
  cwd: string;
  /** C64RT_HOST, the address of the Host Runtime. The default 127.0.0.1:1 has no host. */
  host?: string;
  /** More environment variables. */
  env?: NodeJS.ProcessEnv;
  /** The text on stdin. */
  input?: string;
  /** Kills a script that runs longer, so a hung tool fails its test. */
  timeoutMs?: number;
}

/** One run of a skill script, read with readEnvelope. */
export interface ScriptRun {
  status: number | null;
  stdout: string;
  envelope: ScriptEnvelope;
  json: any;
}

function scriptEnv(options: ScriptOptions): NodeJS.ProcessEnv {
  return { ...process.env, C64RT_HOST: options.host ?? "127.0.0.1:1", ...options.env };
}

function scriptRun(status: number | null, stdout: string, stderr: string): ScriptRun {
  assert.equal(stderr, "", stderr);
  return { status, stdout, ...readEnvelope(stdout, status) };
}

/** Runs a skill script as the LLM does: one envelope on stdout, nothing on stderr. */
export function runScriptSync(script: string, args: readonly string[], options: ScriptOptions): ScriptRun {
  const run = spawnSync(process.execPath, [...process.execArgv, script, ...args], {
    cwd: options.cwd,
    encoding: "utf8",
    env: scriptEnv(options),
    ...(options.input === undefined ? {} : { input: options.input }),
    ...(options.timeoutMs === undefined ? {} : { timeout: options.timeoutMs }),
  });
  return scriptRun(run.status, run.stdout, run.stderr);
}

/** As runScriptSync, but this process goes on while the script runs: for a Host Runtime in this process. */
export async function runScript(script: string, args: readonly string[], options: ScriptOptions): Promise<ScriptRun> {
  const child = spawn(process.execPath, [...process.execArgv, script, ...args], {
    cwd: options.cwd,
    env: scriptEnv(options),
    stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    ...(options.timeoutMs === undefined ? {} : { timeout: options.timeoutMs }),
  });
  child.stdin?.end(options.input);
  let stdout = "";
  let stderr = "";
  child.stdout!.setEncoding("utf8").on("data", (chunk: string) => (stdout += chunk));
  child.stderr!.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));
  const [status] = (await once(child, "close")) as [number | null];
  return scriptRun(status, stdout, stderr);
}
