// The watchdog of a supervisor's process (the Host Runtime or a skill
// script), started by ProcessSupervisor.startWatchdog.
// Arguments: <owner pid> <registry file>.
//
// It runs in its own process group, so a signal to the owner's group does
// not reach it. When the owner dies without its exit guard (SIGKILL, a
// crash), it stops every process group in the registry and removes every
// path. When the owner exits normally, the exit guard removes the registry
// and the watchdog ends.

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

function cleanUp(): void {
  let registry: Registry;
  try {
    registry = JSON.parse(readFileSync(registryFile, "utf8")) as Registry;
  } catch {
    process.exit(0);
  }
  for (const group of registry.groups) signal(group, "SIGTERM");
  setTimeout(() => {
    for (const group of registry.groups) signal(group, "SIGKILL");
    for (const path of registry.paths) rmSync(path, { recursive: true, force: true });
    rmSync(dirname(registryFile), { recursive: true, force: true });
    process.exit(0);
  }, GRACE_MS);
}

const timer = setInterval(() => {
  // A normal exit removed the registry: nothing is left to do.
  if (!existsSync(registryFile)) process.exit(0);
  if (isAlive(ownerPid)) return;
  clearInterval(timer);
  cleanUp();
}, POLL_MS);
