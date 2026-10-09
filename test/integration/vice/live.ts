// Live VICE tests are opt-in: set C64RT_LIVE_VICE to the absolute path of x64sc.
// Without it every live test is reported as skipped, never as passed.

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { basename, resolve } from "node:path";
import { createInterface } from "node:readline";

export const LIVE_VICE = process.env.C64RT_LIVE_VICE;

export const liveSkip: string | false =
  LIVE_VICE === undefined || LIVE_VICE === "" ? "live VICE: set C64RT_LIVE_VICE=/absolute/path/to/x64sc to run" : false;

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
  readonly port: number;
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
  const host: LiveHost = { process: child, line: "", port: 0, address: "", stop };
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
  Object.assign(host, { line, port, address: `127.0.0.1:${port}` });
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
