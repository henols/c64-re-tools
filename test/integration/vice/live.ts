// Live VICE tests are opt-in: set C64RT_LIVE_VICE to the absolute path of x64sc.
// Without it every live test is reported as skipped, never as passed (09 §6).

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { basename } from "node:path";

export const LIVE_VICE = process.env.C64RT_LIVE_VICE;

export const liveSkip: string | false =
  LIVE_VICE === undefined || LIVE_VICE === "" ? "live VICE: set C64RT_LIVE_VICE=/absolute/path/to/x64sc to run" : false;

/** The environment a live test gives the Host Runtime: VICE found through C64RT_VICE. */
export function liveEnv(): NodeJS.ProcessEnv {
  return { ...process.env, C64RT_VICE: LIVE_VICE };
}

/** Pids of running x64sc processes whose parent is `parentPid`: /proc on Linux, ps on macOS, CIM on Windows. */
export function viceChildren(parentPid: number): number[] {
  if (process.platform === "win32") return windowsViceChildren(parentPid);
  if (process.platform !== "linux") return psViceChildren(parentPid);
  return procViceChildren(parentPid);
}

function psViceChildren(parentPid: number): number[] {
  const run = spawnSync("ps", ["-A", "-o", "pid=,ppid=,stat=,comm="], { encoding: "utf8" });
  const pids: number[] = [];
  for (const line of run.stdout.split("\n")) {
    const match = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.+)$/.exec(line);
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

function procViceChildren(parentPid: number): number[] {
  const pids: number[] = [];
  for (const entry of readdirSync("/proc")) {
    if (!/^\d+$/.test(entry)) continue;
    let stat: string;
    try {
      stat = readFileSync(`/proc/${entry}/stat`, "utf8");
    } catch {
      continue; // exited while scanning
    }
    // Format: pid (comm) state ppid ...; comm may contain spaces, so split after the last ")".
    const comm = stat.slice(stat.indexOf("(") + 1, stat.lastIndexOf(")"));
    const [state, ppid] = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    if (comm === "x64sc" && state !== "Z" && Number(ppid) === parentPid) pids.push(Number(entry));
  }
  return pids;
}

/** Host-side session log for live tests: diagnostics such as monitor timeouts reach stderr. */
export function liveLog(line: string): void {
  process.stderr.write(`[vice-session] ${line}\n`);
}
