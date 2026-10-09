import { spawn, spawnSync, type ChildProcess, type StdioOptions } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { WireFailure } from "../protocol.ts";

/** How long a process group gets between SIGTERM and SIGKILL. */
export const STOP_GRACE_MS = 5_000;
/** How long to wait for the group to vanish after SIGKILL before giving up. */
const KILL_WAIT_MS = 2_000;
const POLL_MS = 25;

export interface SpawnOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv | undefined;
  stdio?: StdioOptions;
}

export interface ExitStatus {
  code: number | null;
  signal: NodeJS.Signals | null;
  /** The error code, for example ENOENT, when the program did not start. */
  spawnError?: string;
}

/** A child started in its own process group. Stopping it stops every descendant in that group. */
export interface SupervisedProcess {
  readonly pid: number;
  readonly child: ChildProcess;
  /** Settles when the group leader exits, for any reason. */
  readonly exited: Promise<ExitStatus>;
  /** Terminates the whole process group: SIGTERM, then SIGKILL after the grace period. */
  stop(): Promise<void>;
}

/**
 * A process's state letter and process group on Linux, from /proc; undefined
 * when it is gone. A zombie (Z) or a dead process (X) has exited: only the
 * wait of its parent is missing. In a container whose PID 1 never reaps (for
 * example `tail -f /dev/null`), an orphan stays a zombie for ever (found in CI).
 */
function linuxProcess(pid: number | string): { state: string; group: number } | undefined {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const [state, , group] = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    return { state: state!, group: Number(group) };
  } catch {
    return undefined;
  }
}

const exitedState = (state: string) => state === "Z" || state === "X";

/** True while a process runs, also one this process may not signal (EPERM). A zombie does not run. */
export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EPERM") return false;
  }
  if (process.platform !== "linux") return true;
  const found = linuxProcess(pid);
  return found !== undefined && !exitedState(found.state);
}

/** Linux: true while a member of the process group runs; zombies do not count. */
function groupRuns(pgid: number): boolean {
  for (const entry of readdirSync("/proc")) {
    if (!/^\d+$/.test(entry)) continue;
    const found = linuxProcess(entry);
    if (found !== undefined && found.group === pgid && !exitedState(found.state)) return true;
  }
  return false;
}

/**
 * On Windows a .bat or .cmd file (Ghidra's analyzeHeadless.bat, for example)
 * starts only through cmd.exe: Node refuses it without a shell (EINVAL, found
 * in CI). /s keeps the quoted command line as it is. Each argument is quoted
 * as the Microsoft C runtime and Java read it: backslashes before a quote and
 * at the end are doubled, and an inner quote is escaped (a path that ends in a
 * backslash otherwise swallowed the arguments after it, found in CI).
 * Undefined for any other program.
 */
export function windowsQuote(arg: string): string {
  return `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, "$1$1")}"`;
}

export function batchInvocation(argv: readonly string[], comSpec = "cmd.exe"): { command: string; args: string[] } | undefined {
  if (!/\.(bat|cmd)$/i.test(argv[0] ?? "")) return undefined;
  const quote = windowsQuote;
  return { command: comSpec, args: ["/d", "/s", "/c", `"${argv.map(quote).join(" ")}"`] };
}

/** How long taskkill may block: it runs synchronously, so without a limit it could stop this whole process. */
const TASKKILL_LIMIT_MS = 5_000;

/**
 * Ends a process and every descendant on Windows, which has no process
 * groups. taskkill finds the descendants through the process, so it must run
 * while the process still runs. Returns undefined when taskkill ended the tree
 * or found no such process, else why it failed.
 */
export function killTree(pid: number): string | undefined {
  const result = spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true, timeout: TASKKILL_LIMIT_MS });
  if (result.error !== undefined) return `taskkill did not run (${(result.error as NodeJS.ErrnoException).code ?? result.error.message})`;
  // taskkill exits with 128 when no process has this pid: the process has ended.
  if (result.status === 0 || result.status === 128) return undefined;
  return `taskkill ended with exit code ${result.status ?? result.signal}`;
}

/** True when Node has seen the child's exit. */
const hasExited = (child: ChildProcess) => child.exitCode !== null || child.signalCode !== null;

/** Sends a signal to a process group (POSIX). Returns false when the group no longer exists. */
export function signalGroup(pgid: number, signal: NodeJS.Signals | 0): boolean {
  try {
    process.kill(-pgid, signal);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    // macOS answers EPERM for a group whose members are all zombies, which is a stopped group too.
    if (code === "ESRCH" || (code === "EPERM" && process.platform === "darwin")) return false;
    throw error;
  }
}

/** True while a process group has a running member (POSIX); a group of zombies has ended. */
export function isGroupRunning(pgid: number): boolean {
  return signalGroup(pgid, 0) && (process.platform !== "linux" || groupRuns(pgid));
}

async function waitForGroupGone(pgid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (isGroupRunning(pgid)) {
    if (Date.now() >= deadline) return false;
    await sleep(POLL_MS);
  }
  return true;
}

/** What the watchdog must clean up if the Host Runtime dies: process groups and paths. */
export interface Registry {
  groups: number[];
  paths: string[];
}

/** The watchdog's program, next to this module. A new URL literal, so an installed skill gets it too (08 §6). */
const WATCHDOG = fileURLToPath(new URL("./watchdog.ts", import.meta.url));

/**
 * The one child-process supervisor of a process: the Host Runtime, or a
 * skill script that runs its own tools (D16). Every emulator and native tool
 * is started here, with an argv array and never a shell string,
 * as the leader of its own process group. It also owns scratch paths, so
 * that they go away with the processes that used them.
 */
export class ProcessSupervisor {
  readonly #children = new Set<SupervisedProcess>();
  readonly #paths = new Set<string>();
  readonly #graceMs: number;
  #exitGuardInstalled = false;
  /** The registry file that the watchdog reads, once a watchdog runs. */
  #registry: string | undefined;
  #watchdogPid: number | undefined;

  constructor(options: { graceMs?: number } = {}) {
    this.#graceMs = options.graceMs ?? STOP_GRACE_MS;
  }

  /** Number of process groups that have not been stopped yet. */
  get size(): number {
    return this.#children.size;
  }

  /** The process id of the watchdog, once a watchdog runs. */
  get watchdogPid(): number | undefined {
    return this.#watchdogPid;
  }

  /** Starts argv[0] with argv[1..] as the leader of a new process group. */
  spawn(argv: readonly string[], options: SpawnOptions = {}): SupervisedProcess {
    if (argv[0] === undefined) throw new TypeError("argv must name a command");
    const batch = process.platform === "win32" ? batchInvocation(argv, process.env.ComSpec) : undefined;
    const [command, ...args] = batch === undefined ? argv : [batch.command, ...batch.args];
    let child: ChildProcess;
    try {
      child = spawn(command!, args, {
        cwd: options.cwd,
        env: options.env,
        stdio: options.stdio ?? "ignore",
        detached: process.platform !== "win32",
        windowsHide: true,
        ...(batch === undefined ? {} : { windowsVerbatimArguments: true }),
      });
    } catch (error) {
      // Some failures throw at once instead of an "error" event: a file Windows cannot start
      // (EFTYPE, found in CI with a broken build) or a .bat without a shell (EINVAL).
      const code = (error as NodeJS.ErrnoException).code ?? "an unknown error";
      throw new WireFailure("installation-incomplete", `${argv[0]} is not a program that this system can start (${code}). Install it again.`);
    }
    const exited = new Promise<ExitStatus>((resolve) => {
      child.once("exit", (code, signal) => resolve({ code, signal }));
      // A failed spawn emits "error" and never "exit". A later "error" (a failed kill) changes nothing:
      // the listener stays, so that such an error does not end this process.
      child.on("error", (error: NodeJS.ErrnoException) => {
        if (child.pid === undefined) resolve({ code: null, signal: null, spawnError: error.code ?? "an unknown error" });
      });
    });
    if (child.pid === undefined) {
      // Spawn failed (for example ENOENT); "error" follows asynchronously.
      const failed: SupervisedProcess = { pid: -1, child, exited, stop: async () => {} };
      return failed;
    }

    const pid = child.pid;
    let stopping: Promise<void> | undefined;
    const supervised: SupervisedProcess = {
      pid,
      child,
      exited,
      stop: () => {
        stopping ??= this.#stopGroup(pid, child, exited).then(
          () => {
            this.#children.delete(supervised);
            this.#writeRegistry();
          },
          (error: unknown) => {
            // The group may still run: it stays registered for the exit guard and the watchdog, and a later stop tries again.
            stopping = undefined;
            throw error;
          },
        );
        return stopping;
      },
    };
    this.#children.add(supervised);
    this.#writeRegistry();
    return supervised;
  }

  /** Makes a scratch path part of what this supervisor cleans up. Returns the release for a normal removal. */
  ownPath(path: string): () => void {
    this.#paths.add(path);
    this.#writeRegistry();
    return () => {
      this.#paths.delete(path);
      this.#writeRegistry();
    };
  }

  /**
   * Starts a watchdog process that cleans up if this process dies without
   * running its exit guard, for example by SIGKILL (D7): it stops every
   * registered process group and removes every owned path. It ends by itself
   * when this process exits normally.
   */
  startWatchdog(): void {
    if (this.#registry !== undefined) return;
    const directory = mkdtempSync(join(tmpdir(), "c64-re-tools-host-"));
    this.#registry = join(directory, "registry.json");
    this.#writeRegistry();
    // The watchdog can outlive this process by one poll. It runs in the temporary directory, never in
    // the caller's directory: Windows refuses to remove a directory that a running process uses.
    const watchdog = spawn(process.execPath, [...process.execArgv, WATCHDOG, String(process.pid), this.#registry], { cwd: tmpdir(), detached: true, stdio: "ignore", windowsHide: true });
    watchdog.unref();
    this.#watchdogPid = watchdog.pid;
    this.installExitGuard();
  }

  #writeRegistry(): void {
    if (this.#registry === undefined) return;
    const registry: Registry = { groups: [...this.#children].map((child) => child.pid), paths: [...this.#paths] };
    // Write and rename, so the watchdog never reads half a file.
    writeFileSync(`${this.#registry}.next`, JSON.stringify(registry));
    renameSync(`${this.#registry}.next`, this.#registry);
  }

  /** Stops every process group this supervisor started. */
  async stopAll(): Promise<void> {
    await Promise.all([...this.#children].map((child) => child.stop()));
  }

  /**
   * SIGKILLs every remaining group and removes every owned path, synchronously.
   * For process "exit", where nothing async runs. The watchdog then ends.
   */
  killAllSync(): void {
    for (const supervised of this.#children) {
      // On Windows the pid of an ended leader can belong to another process now.
      if (process.platform === "win32") {
        if (!hasExited(supervised.child)) killTree(supervised.pid);
      } else signalGroup(supervised.pid, "SIGKILL");
    }
    this.#children.clear();
    for (const path of this.#paths) rmSync(path, { recursive: true, force: true });
    this.#paths.clear();
    if (this.#registry !== undefined) rmSync(join(this.#registry, ".."), { recursive: true, force: true });
  }

  /** Makes any exit of this process, however it happens, SIGKILL the remaining groups. Idempotent. */
  installExitGuard(): void {
    if (this.#exitGuardInstalled) return;
    this.#exitGuardInstalled = true;
    process.on("exit", () => this.killAllSync());
  }

  async #stopGroup(pid: number, child: ChildProcess, exited: Promise<ExitStatus>): Promise<void> {
    if (process.platform === "win32") {
      // Windows has no SIGTERM for a console process. taskkill finds the descendants through the
      // leader, so it runs first, and only while the leader runs: the pid of an ended leader can
      // belong to another process. child.kill then ends the leader through its own handle (after
      // taskkill alone the leader's exit never came, found in CI). The exit wait has a limit.
      const failure = hasExited(child) ? undefined : killTree(pid);
      try {
        child.kill("SIGKILL");
      } catch {
        // The leader has ended already.
      }
      await Promise.race([exited, sleep(this.#graceMs)]);
      if (!hasExited(child)) throw new Error(`process ${pid} did not end${failure === undefined ? "" : `: ${failure}`}`);
      return;
    }
    // The group outlives its leader when descendants remain, so wait on the group, not the leader.
    if (signalGroup(pid, "SIGTERM") && !(await waitForGroupGone(pid, this.#graceMs))) {
      signalGroup(pid, "SIGKILL");
      if (!(await waitForGroupGone(pid, KILL_WAIT_MS))) {
        throw new Error(`process group ${pid} survived SIGKILL`);
      }
    }
    // A group of zombies counts as gone before Node reaps the leader and reports its exit
    // (macOS, and Linux since zombies stopped counting); stopped means that exit was seen.
    await Promise.race([exited, sleep(KILL_WAIT_MS)]);
  }
}
