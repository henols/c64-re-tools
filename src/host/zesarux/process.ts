// One ZEsarUX process for a Spectrum session: headless, with the ZRCP remote
// protocol on a free loopback port, in a scratch folder of its own (ZEsarUX
// writes an index file into its working folder). Stopping it stops the
// process group and removes the folder.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { MachineId } from "../../machine.ts";
import { findTool, ZESARUX } from "../../native/discover.ts";
import type { ProcessSupervisor } from "../../native/processes.ts";
import { WireFailure } from "../../protocol/messages.ts";
import { elapsedMs, trace } from "../../trace.ts";
import { freePort } from "../vice/process.ts";
import { Zrcp } from "./zrcp.ts";

/** The oldest ZEsarUX that the backend supports: its ZRCP commands are those of 13.0. */
export const MIN_ZESARUX = { major: 13, minor: 0 } as const;
const READY_TIMEOUT_MS = 15_000;

export interface ZesaruxProcess {
  pid: number;
  zrcp: Zrcp;
  version: string;
  /** The scratch folder: snapshots and media of the session go here. */
  scratch: string;
  exited: Promise<unknown>;
  stop(): Promise<void>;
}

/** Finds zesarux: C64RT_ZESARUX, else PATH. Refuses by name with the remedy; never installs anything. */
export function findZesarux(env: NodeJS.ProcessEnv = process.env): string {
  return findTool(ZESARUX, env);
}

const MACHINE_ARGUMENT: Partial<Record<MachineId, string>> = { spectrum48: "48k", spectrum128: "128k" };

export async function launchZesarux(options: { supervisor: ProcessSupervisor; machine: MachineId; env?: NodeJS.ProcessEnv; log?: (line: string) => void }): Promise<ZesaruxProcess> {
  const env = options.env ?? process.env;
  const log = options.log ?? (() => {});
  const machine = MACHINE_ARGUMENT[options.machine];
  if (machine === undefined) throw new WireFailure("invalid-input", `ZEsarUX runs no ${options.machine} here.`);
  const binary = findZesarux(env);
  const port = await freePort();
  const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-zesarux-"));
  const releaseScratch = options.supervisor.ownPath(scratch);
  // The emulated joystick is a Kempston on port $1f: the default (Cursor&Shift) also presses CAPS SHIFT and the cursor keys, and the Kempston port then reads $ff.
  const argv = [binary, "--noconfigfile", "--machine", machine, "--vo", "null", "--ao", "null", "--joystickemulated", "Kempston", "--nowelcomemessage", "--quickexit", "--enable-remoteprotocol", "--remoteprotocol-port", String(port)];
  // HOME is the scratch folder too: nothing of ZEsarUX's lands in the user's home.
  const child = options.supervisor.spawn(argv, { cwd: scratch, env: { ...env, HOME: scratch }, stdio: ["ignore", "pipe", "pipe"] });
  const launched = performance.now();
  trace().event("zesarux.launch", { pid: child.pid, machine, port, scratch, argv });
  let zrcp: Zrcp | undefined;
  let stopping: Promise<void> | undefined;
  const stop = () => {
    stopping ??= (async () => {
      try {
        await zrcp?.command("exit-emulator", 2_000).catch(() => {});
      } finally {
        zrcp?.close();
        await child.stop();
        rmSync(scratch, { recursive: true, force: true });
        releaseScratch();
      }
      log(`ZEsarUX stopped (pid ${child.pid})`);
    })();
    return stopping;
  };
  try {
    zrcp = await Zrcp.connect(port, READY_TIMEOUT_MS);
    const version = await zrcp.command("get-version");
    const [major = 0, minor = 0] = version.split(".").map(Number);
    if (major < MIN_ZESARUX.major || (major === MIN_ZESARUX.major && minor < MIN_ZESARUX.minor)) {
      throw new WireFailure("installation-incomplete", `ZEsarUX ${version} is too old: c64-re-tools needs ZEsarUX ${MIN_ZESARUX.major}.${MIN_ZESARUX.minor} or later. ${ZESARUX.remedy}`);
    }
    log(`ZEsarUX ${version} started (${machine}, pid ${child.pid}, ZRCP port ${port}, in ${Math.round(elapsedMs(launched))} ms)`);
    return { pid: child.pid, zrcp, version, scratch, exited: child.exited, stop };
  } catch (error) {
    log(`ZEsarUX failed to start: ${error instanceof Error ? error.message : String(error)}`);
    await stop();
    if (error instanceof WireFailure) throw error;
    throw new WireFailure("machine-unavailable", "ZEsarUX could not be started on the host.");
  }
}

/** Starts ZEsarUX one time and stops it: the start check of the host. Gives the version. */
export async function checkZesaruxStarts(options: { supervisor: ProcessSupervisor; env?: NodeJS.ProcessEnv }): Promise<string> {
  const zesarux = await launchZesarux({ ...options, machine: "spectrum48" });
  await zesarux.stop();
  return zesarux.version;
}
