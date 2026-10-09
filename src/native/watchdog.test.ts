import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { test } from "node:test";

import { isAlive, isGroupRunning, signalGroup } from "./processes.ts";

const skip = process.platform === "win32" ? "process groups are POSIX" : false;

/** The programs that start a watchdog: a stand-in Host Runtime, and a stand-in skill script that uses localToolContext. */
const OWNERS = [
  { name: "a runtime", program: join(import.meta.dirname, "watchdog.testkit.ts") },
  { name: "a skill script", program: join(import.meta.dirname, "local.testkit.ts") },
];

/** A group of zombies has ended: a container whose PID 1 never reaps keeps them. */
function groupAlive(group: number): boolean {
  try {
    return isGroupRunning(group);
  } catch {
    return false;
  }
}

interface Owner {
  pid: number;
  group: number;
  watchdog: number;
  path: string;
}

async function start(program: string): Promise<Owner> {
  const owner = spawn(process.execPath, [program], { stdio: ["ignore", "pipe", "inherit"] });
  const [line] = (await once(createInterface({ input: owner.stdout! }), "line")) as [string];
  return { pid: owner.pid!, ...(JSON.parse(line) as { group: number; watchdog: number; path: string }) };
}

/** Removes what a failed test left behind. Only after a failure: an ended pid can belong to another process later. */
function cleanUp(owner: Owner): void {
  for (const pid of [owner.pid, owner.watchdog]) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // It has ended.
    }
  }
  try {
    signalGroup(owner.group, "SIGKILL");
  } catch {
    // It has ended.
  }
  rmSync(owner.path, { recursive: true, force: true });
}

async function until(condition: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return true;
}

for (const { name, program } of OWNERS) {
  test(`${name} killed with SIGKILL leaves no process group, no owned path and no watchdog`, { skip, timeout: 20_000 }, async () => {
    const owner = await start(program);
    let passed = false;
    try {
      assert.ok(groupAlive(owner.group));
      assert.ok(existsSync(owner.path));
      assert.ok(isAlive(owner.watchdog), "the watchdog runs");
      process.kill(owner.pid, "SIGKILL");
      assert.ok(await until(() => !groupAlive(owner.group), 8_000), "the watchdog stopped the child group");
      assert.ok(await until(() => !existsSync(owner.path), 4_000), "the watchdog removed the owned path");
      assert.ok(await until(() => !isAlive(owner.watchdog), 4_000), "the watchdog ended");
      passed = true;
    } finally {
      if (!passed) cleanUp(owner);
    }
  });

  test(`${name} that exits normally cleans up by itself and its watchdog ends`, { skip, timeout: 20_000 }, async () => {
    const owner = await start(program);
    let passed = false;
    try {
      process.kill(owner.pid, "SIGTERM");
      assert.ok(await until(() => !groupAlive(owner.group), 3_000), "the exit guard stopped the child group");
      assert.ok(await until(() => !existsSync(owner.path), 3_000), "the exit guard removed the owned path");
      assert.ok(await until(() => !isAlive(owner.watchdog), 3_000), "the watchdog ended");
      passed = true;
    } finally {
      if (!passed) cleanUp(owner);
    }
  });
}
