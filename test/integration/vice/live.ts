// Live VICE tests are opt-in: set C64RT_LIVE_VICE to the absolute path of x64sc.
// Without it every live test is reported as skipped, never as passed (09 §6).

import { readdirSync, readFileSync } from "node:fs";

export const LIVE_VICE = process.env.C64RT_LIVE_VICE;

export const liveSkip: string | false =
  LIVE_VICE === undefined || LIVE_VICE === "" ? "live VICE: set C64RT_LIVE_VICE=/absolute/path/to/x64sc to run" : false;

/** The environment a live test gives the Host Runtime: VICE found through C64RT_VICE. */
export function liveEnv(): NodeJS.ProcessEnv {
  return { ...process.env, C64RT_VICE: LIVE_VICE };
}

/** Pids of running x64sc processes whose parent is `parentPid` (Linux /proc). */
export function viceChildren(parentPid: number): number[] {
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
