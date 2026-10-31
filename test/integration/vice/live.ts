// Live VICE tests are opt-in: set C64RT_LIVE_VICE to the absolute path of x64sc.
// Without it every live test is reported as skipped, never as passed. Every
// live VICE is headless, except in the c64_window tests: they open real
// windows, so they also need C64RT_LIVE_WINDOW=1.

import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { basename, resolve } from "node:path";
import { createInterface } from "node:readline";
import { after, before } from "node:test";

import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { screenText } from "../../../src/graphics.ts";
import { checkViceStarts } from "../../../src/host/vice/process.ts";
import { startHostServer, type HostServer, type ViceSessionHandle } from "../../../src/host/server.ts";
import { viceSessionFactory } from "../../../src/host/vice/session.ts";
import { viceFlaws, type ViceFlaw } from "../../../src/native/discover.ts";
import { ProcessSupervisor } from "../../../src/native/processes.ts";
import type { VideoStandard } from "../../../src/protocol/messages.ts";
import { waitFor } from "../../kit.ts";

const LIVE_VICE = process.env.C64RT_LIVE_VICE;

export const liveSkip: string | false =
  LIVE_VICE === undefined || LIVE_VICE === "" ? "live VICE: set C64RT_LIVE_VICE=/absolute/path/to/x64sc to run" : false;

/** For tests that open a VICE window on the desktop: they also need C64RT_LIVE_WINDOW=1. */
export const liveWindowSkip: string | false =
  liveSkip !== false ? liveSkip : process.env.C64RT_LIVE_WINDOW === "1" ? false : "live VICE window: set C64RT_LIVE_WINDOW=1 to open VICE windows on the desktop";

const root = resolve(import.meta.dirname, "../../..");

/** The environment a live test gives the Host Runtime: VICE found through C64RT_VICE. */
export function liveEnv(): NodeJS.ProcessEnv {
  return { ...process.env, C64RT_VICE: LIVE_VICE };
}

/** How long a Host Runtime gets to stop after its stop signal. */
export const HOST_STOP_MS = 30_000;

export interface LiveHost {
  readonly process: ChildProcess;
  /** The first line that the host prints: the address where it listens. */
  readonly line: string;
  /** The value for C64RT_HOST. */
  readonly address: string;
  /**
   * Sends the stop signal and waits at most HOST_STOP_MS for the exit. A host
   * that does not stop in that time is killed, and the stop fails by name.
   * Resolves with the exit code (null when a signal ended the host). The host
   * is one process (its VICE and its watchdog have process groups of their
   * own), so this is the stop that Ctrl+C gives in a terminal. Windows has no
   * SIGTERM: there the kill ends the host at once, and its watchdog stops its
   * VICE.
   */
  stop(): Promise<number | null>;
}

const running = new Set<LiveHost>();

/** Starts the Host Runtime from this checkout on a free port; VICE comes from C64RT_LIVE_VICE. */
export async function startHost(env: NodeJS.ProcessEnv = liveEnv()): Promise<LiveHost> {
  const child = spawn(process.execPath, [...process.execArgv, resolve(root, "src/host/main.ts"), "--port", "0"], { env, stdio: ["ignore", "pipe", "inherit"] });
  const exited = once(child, "exit") as Promise<[number | null, NodeJS.Signals | null]>;
  const ended = () => child.exitCode !== null || child.signalCode !== null;
  const stop = async (): Promise<number | null> => {
    running.delete(host);
    if (!ended()) {
      child.kill("SIGTERM");
      let killed = false;
      const late = setTimeout(() => (killed = child.kill("SIGKILL")), HOST_STOP_MS);
      const [code] = await exited;
      clearTimeout(late);
      if (killed) throw new Error(`The Host Runtime did not stop within ${HOST_STOP_MS / 1000} seconds of its stop signal.`);
      return code;
    }
    return child.exitCode;
  };
  const host: LiveHost = { process: child, line: "", address: "", stop };
  running.add(host);
  const line = await Promise.race([
    once(createInterface({ input: child.stdout! }), "line").then(([first]) => first as string),
    exited.then(() => undefined),
  ]);
  const port = Number(/:(\d+)$/.exec(line ?? "")?.[1]);
  if (line === undefined || !(port > 0)) {
    await stop();
    throw new Error(line === undefined ? "The Host Runtime ended before it listened." : `The Host Runtime printed no port: ${line}`);
  }
  Object.assign(host, { line, address: `127.0.0.1:${port}` });
  return host;
}

/** Stops every host that startHost started and that still runs. For after(). */
export async function stopHosts(): Promise<void> {
  const failures: unknown[] = [];
  for (const host of [...running]) {
    try {
      await host.stop();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0) throw failures[0];
}

/** Pids of running x64sc processes whose parent is `parentPid`: ps on Linux and macOS, CIM on Windows. */
export function viceChildren(parentPid: number): number[] {
  return process.platform === "win32" ? windowsViceChildren(parentPid) : psViceChildren(parentPid);
}

/** The scratch directory of a running VICE, from its -config argument (ps or CIM). */
export function viceScratchOf(pid: number): string | undefined {
  const commandLine =
    process.platform === "win32"
      ? spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CommandLine`], { encoding: "utf8" }).stdout
      : spawnSync("ps", ["-o", "command=", "-p", String(pid)], { encoding: "utf8" }).stdout;
  const match = /-config\s+"?(.+?)[\\/]vicerc/.exec(commandLine);
  return match?.[1];
}

function psViceChildren(parentPid: number): number[] {
  const run = spawnSync("ps", ["-A", "-o", "pid=,ppid=,stat=,comm="], { encoding: "utf8" });
  if (run.status !== 0) throw new Error(`ps did not list the processes: ${run.error?.message ?? run.stderr}`);
  const pids: number[] = [];
  for (const line of run.stdout.split("\n")) {
    const match = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.+)$/.exec(line);
    // A zombie has ended: a container whose PID 1 never reaps keeps a stopped VICE as one.
    if (match === null || match[3]!.startsWith("Z")) continue;
    if (basename(match[4]!.trim()) === "x64sc" && Number(match[2]) === parentPid) pids.push(Number(match[1]));
  }
  return pids;
}

function windowsViceChildren(parentPid: number): number[] {
  const query = "Get-CimInstance Win32_Process -Filter \"Name = 'x64sc.exe'\" | ForEach-Object { \"$($_.ProcessId) $($_.ParentProcessId)\" }";
  const run = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", query], { encoding: "utf8" });
  return run.stdout
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/).map(Number))
    .filter(([pid, ppid]) => Number.isInteger(pid) && ppid === parentPid)
    .map(([pid]) => pid!);
}

/** Host-side session log for live tests: diagnostics such as monitor timeouts reach stderr. */
export function liveLog(line: string): void {
  process.stderr.write(`[vice-session] ${line}\n`);
}

export interface LiveSessionOptions {
  /** PAL when not given. */
  videoStandard?: VideoStandard;
  /** The known flaws of the VICE version (liveFlaws). */
  flaws?: readonly ViceFlaw[];
  /** The supervisor that starts the VICE processes; a new one when not given. */
  supervisor?: ProcessSupervisor;
}

/** A headless VICE session in this process, as the Host Runtime opens one. The caller closes it. */
export async function openLiveSession(options: LiveSessionOptions = {}): Promise<ViceSessionHandle> {
  const supervisor = options.supervisor ?? new ProcessSupervisor();
  supervisor.installExitGuard();
  const factory = viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog, ...(options.flaws === undefined ? {} : { flaws: options.flaws }) });
  return factory({ videoStandard: options.videoStandard ?? "pal" });
}

/**
 * The session of the tests of a file: opened before them, unless `skip` (liveSkip
 * when not given) gives a reason, and closed after them. Another before hook of
 * the file does not wait for it: a file that sets the machine up before its tests
 * uses openLiveSession in its own hook.
 */
export function fileSession(options: LiveSessionOptions & { skip?: string | false } = {}): ViceSessionHandle {
  let session: ViceSessionHandle | undefined;
  before(async () => {
    if ((options.skip ?? liveSkip) === false) session = await openLiveSession(options);
  });
  after(async () => {
    await session?.close();
  });
  return {
    handle: (op, params, attachments, reply) => session!.handle(op, params, attachments, reply),
    close: async () => session?.close(),
  };
}

/**
 * A Host Runtime in this process for the tests of a file, stopped after them.
 * The returned function starts it at its first call and gives its address, the
 * value for C64RT_HOST.
 */
export function hostServer(): () => Promise<string> {
  let server: Promise<HostServer> | undefined;
  after(async () => {
    await server?.then((started) => started.close(), () => {});
  });
  return async () => {
    if (server === undefined) {
      const supervisor = new ProcessSupervisor();
      supervisor.installExitGuard();
      server = startHostServer({ port: 0, createViceSession: viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog }) });
    }
    const { host, port } = await server;
    return `${host}:${port}`;
  };
}

/** The known flaws of the live VICE, from its version as the Host Runtime reads it from the running emulator. */
export async function liveFlaws(): Promise<ViceFlaw[]> {
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  return viceFlaws(await checkViceStarts({ supervisor, env: liveEnv() }));
}

/** Polls the status (no fixed sleep) until the machine has stopped; returns its pc. */
export async function waitForStop(session: Pick<ViceSessionHandle, "handle">, timeoutMs = 10_000): Promise<number> {
  let pc = 0;
  await waitFor(
    async () => {
      const status = await session.handle("status", {});
      pc = status.pc ?? 0;
      return status.state === "stopped";
    },
    "the stop of the machine",
    timeoutMs,
  );
  return pc;
}

/** The text screen at $0400 (screenText), a line for each row, without the spaces at the end of a row. */
export async function screenOf(session: Pick<ViceSessionHandle, "handle">): Promise<string> {
  const { data } = await session.handle("memoryRead", { address: 0x0400, size: 1000, space: "c64", view: "ram" });
  return screenText(Buffer.from(data, "hex"))
    .map((row) => row.trimEnd())
    .join("\n");
}

/** Calls an MCP tool as an agent does: the test fails when the tool gives an error. */
export async function callTool(client: Client, name: string, args: Record<string, unknown> = {}): Promise<CallToolResult> {
  const result = (await client.callTool({ name, arguments: args })) as CallToolResult;
  assert.notEqual(result.isError, true, `${name}: ${JSON.stringify(result.content)}`);
  return result;
}

/** The structured result of an MCP tool call (callTool). */
export async function toolResult(client: Client, name: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  return (await callTool(client, name, args)).structuredContent as Record<string, unknown>;
}
