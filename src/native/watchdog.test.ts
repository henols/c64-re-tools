import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { test } from "node:test";

import { isAlive, isGroupRunning, ProcessSupervisor, signalGroup, type Registry } from "./processes.ts";

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

async function start(program: string, cwd?: string): Promise<Owner> {
  const owner = spawn(process.execPath, [program], { cwd, stdio: ["ignore", "pipe", "inherit"] });
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

test("the watchdog does not run in the directory of the process that starts it", { skip: process.platform === "linux" ? false : "the working directory of another process is read from /proc", timeout: 20_000 }, async () => {
  const project = mkdtempSync(join(tmpdir(), "c64-re-tools-watchdog-cwd-test-"));
  const owner = await start(OWNERS[1]!.program, project);
  let passed = false;
  try {
    const ownerDirectory = readlinkSync(`/proc/${owner.pid}/cwd`);
    const watchdogDirectory = readlinkSync(`/proc/${owner.watchdog}/cwd`);
    // A normal exit, so that the owner removes everything it made.
    process.kill(owner.pid, "SIGTERM");
    assert.ok(await until(() => !isAlive(owner.watchdog), 3_000), "the watchdog ended");
    assert.equal(ownerDirectory, realpathSync(project), "the owner runs in the project");
    assert.notEqual(watchdogDirectory, realpathSync(project));
    passed = true;
  } finally {
    if (!passed) cleanUp(owner);
    rmSync(project, { recursive: true, force: true });
  }
});

test("the registry directory of a watchdog names its owner", { skip: process.platform === "linux" ? false : "the arguments of another process are read from /proc", timeout: 20_000 }, async () => {
  for (const [{ program }, prefix] of [[OWNERS[0]!, "c64-re-tools-host-watchdog-"], [OWNERS[1]!, "c64-re-tools-skill-script-watchdog-"]] as const) {
    const owner = await start(program);
    let passed = false;
    try {
      const registry = readFileSync(`/proc/${owner.watchdog}/cmdline`, "utf8").split(String.fromCharCode(0)).filter((part) => part !== "").at(-1) ?? "";
      process.kill(owner.pid, "SIGTERM");
      assert.ok(await until(() => !isAlive(owner.watchdog), 3_000), "the watchdog ended");
      assert.ok(basename(dirname(registry)).startsWith(prefix), registry);
      passed = true;
    } finally {
      if (!passed) cleanUp(owner);
    }
  }
});

/** A watchdog started directly, with this test process as its owner: an owner pid that runs on, as a reused pid does. */
function startWatchdog(registry: Registry): { watchdog: ChildProcess; directory: string } {
  const directory = mkdtempSync(join(tmpdir(), "c64-re-tools-watchdog-pipe-test-"));
  const file = join(directory, "registry.json");
  writeFileSync(file, JSON.stringify(registry));
  const watchdog = spawn(process.execPath, [...process.execArgv, join(import.meta.dirname, "watchdog.ts"), String(process.pid), file], { stdio: ["pipe", "ignore", "ignore"] });
  return { watchdog, directory };
}

test("the end of the owner's pipe makes the watchdog clean up, also while the owner's pid still runs", { skip, timeout: 20_000 }, async () => {
  const supervisor = new ProcessSupervisor();
  const group = supervisor.spawn(["sleep", "600"]).pid;
  const path = mkdtempSync(join(tmpdir(), "c64-re-tools-watchdog-pipe-path-"));
  const { watchdog, directory } = startWatchdog({ groups: [group], paths: [path] });
  let passed = false;
  try {
    watchdog.stdin!.end();
    assert.ok(await until(() => !groupAlive(group), 8_000), "the watchdog stopped the group");
    assert.ok(await until(() => !existsSync(path) && !existsSync(directory), 4_000), "the watchdog removed the owned path and its registry");
    assert.ok(await until(() => watchdog.exitCode !== null, 4_000), "the watchdog ended");
    assert.equal(watchdog.exitCode, 0);
    passed = true;
  } finally {
    // Only after a failure: an ended group's pid can belong to another process later.
    if (!passed) supervisor.killAllSync();
    watchdog.kill("SIGKILL");
    rmSync(path, { recursive: true, force: true });
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a path that the watchdog cannot remove does not stop the removal of the others", { skip: skip || (process.getuid?.() === 0 ? "root can remove any path" : false), timeout: 20_000 }, async () => {
  const locked = mkdtempSync(join(tmpdir(), "c64-re-tools-watchdog-locked-"));
  const stuck = join(locked, "stuck");
  mkdirSync(stuck);
  chmodSync(locked, 0o500);
  const free = mkdtempSync(join(tmpdir(), "c64-re-tools-watchdog-free-"));
  const { watchdog, directory } = startWatchdog({ groups: [], paths: [stuck, free] });
  try {
    watchdog.stdin!.end();
    assert.ok(await until(() => watchdog.exitCode !== null, 8_000), "the watchdog ended");
    assert.equal(watchdog.exitCode, 0, "the watchdog ended normally");
    assert.equal(existsSync(stuck), true, "the locked path stays");
    assert.equal(existsSync(free), false, "the path after it is removed");
    assert.equal(existsSync(directory), false, "the registry is removed");
  } finally {
    watchdog.kill("SIGKILL");
    chmodSync(locked, 0o700);
    for (const path of [locked, free, directory]) rmSync(path, { recursive: true, force: true });
  }
});
