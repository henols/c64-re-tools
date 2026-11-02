import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { describe, test } from "node:test";

import { isAlive, isGroupRunning, ProcessSupervisor, signalGroup, type Registry } from "./processes.ts";
import { waitFor } from "./wait.testkit.ts";

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

/** The last argument of a process: the registry file, for a watchdog. */
function lastArgument(pid: number): string | undefined {
  try {
    return readFileSync(`/proc/${pid}/cmdline`, "utf8").split(String.fromCharCode(0)).filter((part) => part !== "").at(-1);
  } catch {
    return undefined;
  }
}

/** The running watchdogs of a registry file. */
function watchdogsOf(registry: string): number[] {
  return readdirSync("/proc")
    .filter((entry) => /^\d+$/.test(entry))
    .map(Number)
    .filter((pid) => lastArgument(pid) === registry && isAlive(pid));
}

/** A watchdog started directly, with this test process as its owner: an owner pid that runs on, as a reused pid does. */
function startWatchdog(registry: Registry): { watchdog: ChildProcess; directory: string } {
  const directory = mkdtempSync(join(tmpdir(), "c64-re-tools-watchdog-pipe-test-"));
  const file = join(directory, "registry.json");
  writeFileSync(file, JSON.stringify(registry));
  const watchdog = spawn(process.execPath, [...process.execArgv, join(import.meta.dirname, "watchdog.ts"), String(process.pid), file], { stdio: ["pipe", "ignore", "ignore"] });
  return { watchdog, directory };
}

// Each test has its own owner, registry and paths, and most wait out the grace time of a watchdog (2 s): the tests run at the same time.
describe("watchdogs", { concurrency: true }, () => {
  for (const { name, program } of OWNERS) {
    test(`${name} killed with SIGKILL leaves no process group, no owned path and no watchdog`, { skip, timeout: 20_000 }, async () => {
      const owner = await start(program);
      try {
        assert.ok(groupAlive(owner.group));
        assert.ok(existsSync(owner.path));
        assert.ok(isAlive(owner.watchdog), "the watchdog runs");
        process.kill(owner.pid, "SIGKILL");
        await waitFor(() => !groupAlive(owner.group), "the watchdog stopped the child group", 8_000);
        await waitFor(() => !existsSync(owner.path), "the watchdog removed the owned path", 4_000);
        await waitFor(() => !isAlive(owner.watchdog), "the watchdog ended", 4_000);
      } catch (error) {
        cleanUp(owner);
        throw error;
      }
    });

    test(`${name} that exits normally cleans up by itself and its watchdog ends`, { skip, timeout: 20_000 }, async () => {
      const owner = await start(program);
      try {
        process.kill(owner.pid, "SIGTERM");
        await waitFor(() => !groupAlive(owner.group), "the exit guard stopped the child group", 3_000);
        await waitFor(() => !existsSync(owner.path), "the exit guard removed the owned path", 3_000);
        await waitFor(() => !isAlive(owner.watchdog), "the watchdog ended", 3_000);
      } catch (error) {
        cleanUp(owner);
        throw error;
      }
    });
  }

  test("the watchdog does not run in the directory of the process that starts it", { skip: process.platform === "linux" ? false : "the working directory of another process is read from /proc", timeout: 20_000 }, async () => {
    const project = mkdtempSync(join(tmpdir(), "c64-re-tools-watchdog-cwd-test-"));
    const owner = await start(OWNERS[1]!.program, project);
    try {
      const ownerDirectory = readlinkSync(`/proc/${owner.pid}/cwd`);
      const watchdogDirectory = readlinkSync(`/proc/${owner.watchdog}/cwd`);
      // A normal exit, so that the owner removes everything it made.
      process.kill(owner.pid, "SIGTERM");
      await waitFor(() => !isAlive(owner.watchdog), "the watchdog ended", 3_000);
      assert.equal(ownerDirectory, realpathSync(project), "the owner runs in the project");
      assert.notEqual(watchdogDirectory, realpathSync(project));
    } catch (error) {
      cleanUp(owner);
      throw error;
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  test("the registry directory of a watchdog names its owner", { skip: process.platform === "linux" ? false : "the arguments of another process are read from /proc", timeout: 20_000 }, async () => {
    for (const [{ program }, prefix] of [[OWNERS[0]!, "c64-re-tools-host-watchdog-"], [OWNERS[1]!, "c64-re-tools-skill-script-watchdog-"]] as const) {
      const owner = await start(program);
      try {
        const registry = readFileSync(`/proc/${owner.watchdog}/cmdline`, "utf8").split(String.fromCharCode(0)).filter((part) => part !== "").at(-1) ?? "";
        process.kill(owner.pid, "SIGTERM");
        await waitFor(() => !isAlive(owner.watchdog), "the watchdog ended", 3_000);
        assert.ok(basename(dirname(registry)).startsWith(prefix), registry);
      } catch (error) {
        cleanUp(owner);
        throw error;
      }
    }
  });

  test("a killed watchdog is replaced, and the new one cleans up when the owner is killed", { skip: process.platform === "linux" ? false : "the arguments of another process are read from /proc", timeout: 20_000 }, async () => {
    const owner = await start(OWNERS[0]!.program);
    let replacement: number | undefined;
    try {
      const registry = lastArgument(owner.watchdog)!;
      process.kill(owner.watchdog, "SIGKILL");
      await waitFor(() => (replacement = watchdogsOf(registry).find((pid) => pid !== owner.watchdog)) !== undefined, "a new watchdog runs", 4_000);
      process.kill(owner.pid, "SIGKILL");
      await waitFor(() => !groupAlive(owner.group), "the new watchdog stopped the child group", 8_000);
      await waitFor(() => !existsSync(owner.path), "the new watchdog removed the owned path", 4_000);
      await waitFor(() => !isAlive(replacement!), "the new watchdog ended", 4_000);
    } catch (error) {
      cleanUp(owner);
      if (replacement !== undefined) cleanUp({ ...owner, watchdog: replacement });
      throw error;
    }
  });

  test("a skill script that gets SIGHUP exits through its exit guard", { skip, timeout: 20_000 }, async () => {
    const script = spawn(process.execPath, [OWNERS[1]!.program], { stdio: ["ignore", "pipe", "inherit"] });
    const [line] = (await once(createInterface({ input: script.stdout! }), "line")) as [string];
    const owner: Owner = { pid: script.pid!, ...(JSON.parse(line) as { group: number; watchdog: number; path: string }) };
    try {
      const exited = once(script, "exit");
      script.kill("SIGHUP");
      // Killed by the signal, the script would report the signal and no code: its exit guard would not have run.
      assert.deepEqual(await exited, [129, null]);
      await waitFor(() => !groupAlive(owner.group), "the exit guard stopped the tool group", 3_000);
      await waitFor(() => !existsSync(owner.path), "the exit guard removed the workspace", 3_000);
      await waitFor(() => !isAlive(owner.watchdog), "the watchdog ended", 3_000);
    } catch (error) {
      cleanUp(owner);
      throw error;
    }
  });

  test("the end of the owner's pipe makes the watchdog clean up, also while the owner's pid still runs", { skip, timeout: 20_000 }, async () => {
    const supervisor = new ProcessSupervisor();
    const group = supervisor.spawn(["sleep", "600"]).pid;
    const path = mkdtempSync(join(tmpdir(), "c64-re-tools-watchdog-pipe-path-"));
    const { watchdog, directory } = startWatchdog({ groups: [group], paths: [path] });
    try {
      watchdog.stdin!.end();
      await waitFor(() => !groupAlive(group), "the watchdog stopped the group", 8_000);
      await waitFor(() => !existsSync(path) && !existsSync(directory), "the watchdog removed the owned path and its registry", 4_000);
      await waitFor(() => watchdog.exitCode !== null, "the watchdog ended", 4_000);
      assert.equal(watchdog.exitCode, 0);
    } catch (error) {
      // Only after a failure: an ended group's pid can belong to another process later.
      supervisor.killAllSync();
      throw error;
    } finally {
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
      await waitFor(() => watchdog.exitCode !== null, "the watchdog ended", 8_000);
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
});
