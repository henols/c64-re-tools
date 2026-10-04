import { spawn, type ChildProcess, type StdioOptions } from "node:child_process";
import { mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";

/** How long a process group gets between SIGTERM and SIGKILL. */
export const STOP_GRACE_MS = 5_000;
/** How long to wait for the group to vanish after SIGKILL before giving up. */
const KILL_WAIT_MS = 2_000;
const POLL_MS = 25;

export interface SpawnOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdio?: StdioOptions;
}

export interface ExitStatus {
  code: number | null;
  signal: NodeJS.Signals | null;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Sends a signal to a process group. Returns false when the group no longer exists. */
function signalGroup(pgid: number, signal: NodeJS.Signals | 0): boolean {
  try {
    process.kill(-pgid, signal);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}

async function waitForGroupGone(pgid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (signalGroup(pgid, 0)) {
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

/** The watchdog's program, next to this module (.ts from source, .js when built). */
const WATCHDOG = join(import.meta.dirname, `watchdog${extname(import.meta.filename)}`);

/**
 * The one child-process supervisor of the Host Runtime. Every emulator and
 * native tool is started here, with an argv array and never a shell string,
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

  constructor(options: { graceMs?: number } = {}) {
    this.#graceMs = options.graceMs ?? STOP_GRACE_MS;
  }

  /** Number of process groups that have not been stopped yet. */
  get size(): number {
    return this.#children.size;
  }

  /** Starts argv[0] with argv[1..] as the leader of a new process group. */
  spawn(argv: readonly string[], options: SpawnOptions = {}): SupervisedProcess {
    const [command, ...args] = argv;
    if (command === undefined) throw new TypeError("argv must name a command");
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: options.stdio ?? "ignore",
      detached: process.platform !== "win32",
      windowsHide: true,
    });
    const exited = new Promise<ExitStatus>((resolve) => {
      child.once("exit", (code, signal) => resolve({ code, signal }));
      // A failed spawn emits "error" and never "exit".
      child.once("error", () => resolve({ code: null, signal: null }));
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
        stopping ??= this.#stopGroup(pid, child, exited).finally(() => {
          this.#children.delete(supervised);
          this.#writeRegistry();
        });
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
    const watchdog = spawn(process.execPath, [WATCHDOG, String(process.pid), this.#registry], { detached: true, stdio: "ignore", windowsHide: true });
    watchdog.unref();
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
      if (process.platform === "win32") supervised.child.kill("SIGKILL");
      else signalGroup(supervised.pid, "SIGKILL");
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
      child.kill("SIGTERM");
      if ((await Promise.race([exited.then(() => true), sleep(this.#graceMs).then(() => false)])) === false) {
        child.kill("SIGKILL");
        await exited;
      }
      return;
    }
    // The group outlives its leader when descendants remain, so wait on the group, not the leader.
    if (!signalGroup(pid, "SIGTERM")) return;
    if (await waitForGroupGone(pid, this.#graceMs)) return;
    signalGroup(pid, "SIGKILL");
    if (!(await waitForGroupGone(pid, KILL_WAIT_MS))) {
      throw new Error(`process group ${pid} survived SIGKILL`);
    }
  }
}
