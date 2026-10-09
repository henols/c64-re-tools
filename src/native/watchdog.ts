// The watchdog of a supervisor's process (the Host Runtime or a skill
// script), started by ProcessSupervisor.startWatchdog.
// Arguments: <owner pid> <registry file>. Standard input: a pipe whose
// writing end only the owner holds.
//
// It runs in its own process group, so a signal to the owner's group does
// not reach it. When the owner dies without its exit guard (SIGKILL, a
// crash), it stops every process group in the registry and removes every
// path. When the owner exits normally, the exit guard removes the registry
// and the watchdog ends.
//
// The end of the pipe tells it at once that the owner is gone: the system
// closes the owner's end when the owner ends, however it ends, and a pid that
// another process now uses cannot keep the pipe open. A poll of the owner's
// pid is the fallback for a pipe that does not end.

import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";

import { isAlive, killTree, signalGroup, type Registry } from "./processes.ts";

const POLL_MS = 500;
const GRACE_MS = 2_000;

const [ownerPidText, registryArgument] = process.argv.slice(2);
const ownerPid = Number(ownerPidText);
if (!Number.isInteger(ownerPid) || ownerPid <= 0 || registryArgument === undefined) process.exit(2);
const registryFile: string = registryArgument;

function signal(group: number, name: NodeJS.Signals): void {
  try {
    if (process.platform !== "win32") signalGroup(group, name);
    else if (name === "SIGKILL") killTree(group);
  } catch {
    // The group is gone already.
  }
}

/** Removes a path. A path that cannot be removed does not stop the removal of the others; nothing reads the watchdog's output. */
function remove(path: string): void {
  try {
    rmSync(path, { recursive: true, force: true });
  } catch {
    // The path stays.
  }
}

let cleaning = false;

function cleanUp(): void {
  if (cleaning) return;
  cleaning = true;
  clearInterval(timer);
  let registry: Registry;
  try {
    registry = JSON.parse(readFileSync(registryFile, "utf8")) as Registry;
  } catch {
    process.exit(0);
  }
  for (const group of registry.groups) signal(group, "SIGTERM");
  setTimeout(() => {
    for (const group of registry.groups) signal(group, "SIGKILL");
    for (const path of registry.paths) remove(path);
    remove(dirname(registryFile));
    process.exit(0);
  }, GRACE_MS);
}

// The owner writes nothing: only the end of the pipe (or an error, which also ends it) counts.
process.stdin.on("data", () => {});
process.stdin.once("end", cleanUp);
process.stdin.once("error", cleanUp);

const timer = setInterval(() => {
  // A normal exit removed the registry: nothing is left to do.
  if (!existsSync(registryFile)) process.exit(0);
  if (!isAlive(ownerPid)) cleanUp();
}, POLL_MS);
