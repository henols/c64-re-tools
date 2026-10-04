// VICE launch, readiness and termination. The launch contract below was
// established against stock VICE 3.10 (x64sc):
// - `-default` must come before `-binarymonitor`, or the monitor never binds;
// - the monitor may accept a connection during startup and then drop it, so
//   readiness is a connect plus a successful ping, retried until a deadline;
// - any monitor command stops the machine, so readiness ends with `exit`;
// - `-default` selects drive type 1542, whose ROM stock installs often lack,
//   so drive 8 is a plain 1541;
// - the remote text monitor runs beside the binary one for the few
//   operations only it offers; both act on the same machine;
// - autostart of a PRG needs `-autostartprgmode 1` (inject into RAM);
// - the joyport command reaches the C64 only through the "Joyport I/O
//   simulation" device (37), whose lines start all pressed until set;
// - with the default JAM action a jammed CPU hangs silently; -jamaction 2
//   enters the monitor instead;
// - the monitor's profiler prints numbers in the host locale, so VICE runs
//   with LC_NUMERIC=C;
// - piped output is block-buffered and lost when VICE exits early (for
//   example without its ROM files), so VICE also writes a log file.

import { accessSync, constants, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { delimiter, isAbsolute, join } from "node:path";

import { WireFailure, type VideoStandard } from "../../protocol.ts";
import type { ExitStatus, ProcessSupervisor, SupervisedProcess } from "../../native/processes.ts";
import { BinaryMonitor, Command, decodeMemory, memoryGetBody } from "./binary-monitor.ts";
import { TextMonitor } from "./text-monitor.ts";

export const DEFAULT_READY_TIMEOUT_MS = 30_000;
const PING_TIMEOUT_MS = 5_000;
const RETRY_MS = 50;
const OUTPUT_TAIL_LINES = 40;

const VICE_BINARY = process.platform === "win32" ? "x64sc.exe" : "x64sc";

const INSTALL_REMEDY =
  "Install VICE 3.6 or later on the host so that x64sc is on PATH, or set C64RT_VICE to the full path of x64sc, " +
  "then restart c64-re-tools-host.";

function isExecutableFile(path: string): boolean {
  try {
    if (!statSync(path).isFile()) return false;
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Finds x64sc (D8): C64RT_VICE, else PATH. Refuses by name with the remedy; never installs anything. */
export function findVice(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.C64RT_VICE;
  if (configured !== undefined && configured !== "") {
    if (isAbsolute(configured) && isExecutableFile(configured)) return configured;
    throw new WireFailure(
      "installation-incomplete",
      `C64RT_VICE on the host does not name an executable VICE x64sc file. ${INSTALL_REMEDY}`,
    );
  }
  for (const dir of (env.PATH ?? "").split(delimiter)) {
    if (dir === "") continue;
    const candidate = join(dir, VICE_BINARY);
    if (isExecutableFile(candidate)) return candidate;
  }
  throw new WireFailure("installation-incomplete", `VICE (x64sc) is not installed on the host. ${INSTALL_REMEDY}`);
}

/** Asks the OS for a free loopback port. Another process can still take it before VICE binds. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address === null || typeof address === "string") reject(new Error("no TCP address"));
        else resolve(address.port);
      });
    });
  });
}

export function viceArguments(options: {
  binary: string;
  port: number;
  textPort: number;
  configFile: string;
  logFile: string;
  videoStandard: VideoStandard;
}): string[] {
  return [
    options.binary,
    "-default",
    "-logfile",
    options.logFile,
    "-binarymonitor",
    "-binarymonitoraddress",
    `ip4://127.0.0.1:${options.port}`,
    "-remotemonitor",
    "-remotemonitoraddress",
    `ip4://127.0.0.1:${options.textPort}`,
    "-config",
    options.configFile,
    "-model",
    options.videoStandard === "ntsc" ? "ntsc" : "c64",
    "-drive8type",
    "1541",
    // Autostart injects a PRG into RAM; the default mode copies it to a disk image first.
    "-autostartprgmode",
    "1",
    // A CPU JAM enters the monitor, so it stops the machine visibly instead of hanging it.
    "-jamaction",
    "2",
    // The binary monitor's joyport command drives only the "Joyport I/O simulation" device.
    "-controlport1device",
    "37",
    "-controlport2device",
    "37",
  ];
}

export interface LaunchOptions {
  videoStandard: VideoStandard;
  supervisor: ProcessSupervisor;
  /** Environment to find VICE in and to run it with. Defaults to process.env. */
  env?: NodeJS.ProcessEnv;
  readyTimeoutMs?: number;
  log?: (line: string) => void;
}

/** A running, ready VICE with its binary monitor connected. */
export interface ViceProcess {
  /** Host-internal; never leaves the Host Runtime. */
  readonly pid: number;
  /** This VICE's private scratch directory, outside the project; removed by stop(). */
  readonly scratchDir: string;
  readonly monitor: BinaryMonitor;
  readonly text: TextMonitor;
  /** Settles when VICE exits, for any reason. */
  readonly exited: Promise<ExitStatus>;
  /** The last lines VICE printed, for host logs only. */
  outputTail(): string;
  /** Closes the monitor, stops the process group and removes the scratch directory. Idempotent. */
  stop(): Promise<void>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The last lines of VICE's log file, or of its output while there is no log file. */
function tailCollector(child: SupervisedProcess, logFile: string): () => string {
  const lines: string[] = [];
  let partial = "";
  const take = (chunk: Buffer) => {
    const parts = (partial + chunk.toString("utf8")).split("\n");
    partial = parts.pop() ?? "";
    lines.push(...parts);
    if (lines.length > OUTPUT_TAIL_LINES) lines.splice(0, lines.length - OUTPUT_TAIL_LINES);
  };
  child.child.stdout?.on("data", take);
  child.child.stderr?.on("data", take);
  return () => {
    try {
      return readFileSync(logFile, "utf8").split("\n").filter((line) => line !== "").slice(-OUTPUT_TAIL_LINES).join("\n");
    } catch {
      return [...lines, partial].filter((line) => line !== "").join("\n");
    }
  };
}

/**
 * Launches one VICE in its own scratch directory outside the project, waits
 * until its binary monitor answers, then lets the machine run.
 * Throws WireFailure: installation-incomplete when VICE is missing,
 * machine-unavailable when it does not start.
 */
export async function launchVice(options: LaunchOptions): Promise<ViceProcess> {
  // A launch can fail in a way a fresh start fixes (a port taken between the
  // free-port check and VICE binding it); try a few times before giving up.
  let lastError: unknown;
  for (let attempt = 1; attempt <= LAUNCH_ATTEMPTS; attempt++) {
    try {
      return await launchOnce(options);
    } catch (error) {
      lastError = error;
      if (error instanceof WireFailure && error.code === "installation-incomplete") throw error;
      options.log?.(`VICE launch attempt ${attempt} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (lastError instanceof WireFailure) throw lastError;
  throw new WireFailure("machine-unavailable", "The emulator could not be started on the host.");
}

const LAUNCH_ATTEMPTS = 3;

/**
 * Starts VICE once, as a session does, and stops it again (D14). Finding
 * x64sc is not enough: without its ROM files VICE exits at once. Throws
 * WireFailure installation-incomplete with VICE's own error lines.
 */
export async function checkViceStarts(options: Omit<LaunchOptions, "videoStandard" | "log">): Promise<void> {
  const binary = findVice(options.env ?? process.env);
  const output: string[] = [];
  let vice: ViceProcess;
  try {
    vice = await launchVice({ ...options, videoStandard: "pal", log: (line) => output.push(line) });
  } catch (error) {
    if (error instanceof WireFailure && error.code === "installation-incomplete") throw error;
    const reasons = [...new Set(output.flatMap((entry) => entry.split("\n")).filter((line) => /\berror\b/i.test(line) && !line.startsWith("VICE ")))];
    throw new WireFailure(
      "installation-incomplete",
      `VICE (${binary}) is installed but does not start${reasons.length === 0 ? "." : `:\n  ${reasons.join("\n  ")}`}\n` +
        "Make sure that VICE has its ROM files (the C64 KERNAL, BASIC and character ROMs) and that x64sc starts when you run it by hand, " +
        "then restart c64-re-tools-host.",
    );
  }
  await vice.stop();
}

async function launchOnce(options: LaunchOptions): Promise<ViceProcess> {
  const env = options.env ?? process.env;
  const log = options.log ?? (() => {});
  const binary = findVice(env);
  const port = await freePort();
  const textPort = await freePort();
  const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-vice-"));
  // Owned by the supervisor: its exit guard and the watchdog remove it if this process dies.
  const releaseScratch = options.supervisor.ownPath(scratch);
  const child = options.supervisor.spawn(
    viceArguments({ binary, port, textPort, configFile: join(scratch, "vicerc"), logFile: join(scratch, "vice.log"), videoStandard: options.videoStandard }),
    {
      cwd: scratch,
      // Keep VICE's config, cache and state away from the user's own VICE setup, and
      // make its monitor print numbers the same way on every host.
      env: { ...env, XDG_CONFIG_HOME: scratch, XDG_CACHE_HOME: scratch, XDG_STATE_HOME: scratch, LC_NUMERIC: "C" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const outputTail = tailCollector(child, join(scratch, "vice.log"));
  let exited = false;
  void child.exited.then(() => (exited = true));

  let monitor: BinaryMonitor | undefined;
  let text: TextMonitor | undefined;
  let stopping: Promise<void> | undefined;
  const stop = () => {
    stopping ??= (async () => {
      await monitor?.close();
      await text?.close();
      await child.stop();
      rmSync(scratch, { recursive: true, force: true });
      releaseScratch();
    })();
    return stopping;
  };

  try {
    const deadline = Date.now() + (options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS);
    monitor = await waitForMonitor(port, () => exited, deadline - Date.now());
    text = await waitForText(textPort, () => exited, deadline);
    await checkSameMachine(monitor, text);
    // Readiness stopped the machine; let it run as a freshly started C64 does.
    await monitor.request(Command.exit);
  } catch (error) {
    log(`VICE failed to start: ${error instanceof Error ? error.message : String(error)}\n${outputTail()}`);
    await stop();
    if (error instanceof WireFailure) throw error;
    throw new WireFailure("machine-unavailable", "The emulator could not be started on the host.");
  }
  log(`VICE started (pid ${child.pid}, monitor ports ${port} and ${textPort})`);
  return { pid: child.pid, scratchDir: scratch, monitor, text, exited: child.exited, outputTail, stop };
}

/**
 * Connects the text monitor and proves it answers. Like the binary one, VICE
 * can accept a connection during startup that it then never serves, so a
 * connection that does not answer a probe is dropped and made again.
 */
async function waitForText(port: number, hasExited: () => boolean, deadline: number): Promise<TextMonitor> {
  while (Date.now() < deadline) {
    if (hasExited()) throw new WireFailure("machine-unavailable", "The emulator exited while it was starting.");
    let text: TextMonitor;
    try {
      text = await TextMonitor.connect(port);
    } catch {
      await sleep(RETRY_MS);
      continue;
    }
    try {
      await text.command("dev c:", Math.min(TEXT_PROBE_MS, Math.max(1, deadline - Date.now())));
      return text;
    } catch {
      await text.close();
      await sleep(RETRY_MS);
    }
  }
  throw new WireFailure("machine-unavailable", "The emulator's monitor did not become ready in time.");
}

const TEXT_PROBE_MS = 2_000;

/**
 * Proves both monitor connections reach the same, freshly started VICE: a
 * byte written through the binary monitor must read back through the text
 * monitor. Zero-page $02 is unused by the KERNAL; its value is restored.
 */
async function checkSameMachine(monitor: BinaryMonitor, text: TextMonitor): Promise<void> {
  const read = memoryGetBody({ start: 0x0002, end: 0x0002, memspace: 0, bank: 0 });
  const original = decodeMemory((await monitor.request(Command.memoryGet, read)).body)[0]!;
  const marker = (original ^ 0xa5) & 0xff;
  const write = (value: number) => {
    const body = memoryGetBody({ start: 0x0002, end: 0x0002, memspace: 0, bank: 0 });
    return monitor.request(Command.memorySet, Buffer.concat([body, Buffer.from([value])]));
  };
  await write(marker);
  try {
    const answer = await text.command("m 0002 0002", TEXT_PROBE_MS);
    const seen = /^>C:0002\s+([0-9a-f]{2})/im.exec(answer);
    if (seen === null || Number.parseInt(seen[1]!, 16) !== marker) {
      throw new WireFailure("machine-unavailable", "The emulator's two monitor connections reached different machines.");
    }
  } finally {
    await write(original);
  }
}

async function waitForMonitor(port: number, hasExited: () => boolean, timeoutMs: number): Promise<BinaryMonitor> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (hasExited()) throw new WireFailure("machine-unavailable", "The emulator exited while it was starting.");
    let monitor: BinaryMonitor;
    try {
      monitor = await BinaryMonitor.connect(port);
    } catch {
      await sleep(RETRY_MS);
      continue;
    }
    try {
      await monitor.request(Command.ping, undefined, Math.min(PING_TIMEOUT_MS, Math.max(1, deadline - Date.now())));
      return monitor;
    } catch {
      // VICE can drop a connection it accepted during startup; connect again.
      await monitor.close();
      await sleep(RETRY_MS);
    }
  }
  throw new WireFailure("machine-unavailable", "The emulator did not become ready in time.");
}
