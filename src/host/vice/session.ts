// The per-emulator session: one VICE at a time, one serialized operation
// queue, the machine's run state, and what happens when VICE dies. The
// session starts headless and can move the machine into a VICE with a window
// and back; breakpoints, watchpoints and the rest go along.

import { isOneOf, WireFailure, type VideoStandard } from "../../protocol/messages.ts";
import { DISK_IMAGE_TYPES, type DiskFile, type DiskImageType } from "../../protocol/tools.ts";
import { MAX_BASELINES, MAX_SNAPSHOTS, MAX_COMPARE_DIFFERENCES, RASTER, type Breakpoint, type BreakpointParams, type PointRemoved, type Condition, type ExecutionParams, type HistoryEntry, type RunTarget, type RunUntilResult, type ScreenComparison, type CiaSelection, type CiaState, type ObserveParams, type ObserveResult, type SidState, type SpriteState, type ViciiState, type JoystickState, type Watchpoint, type WatchpointParams, type ExecutionResult, type MachineStatus, type TraceHit, type TraceKind, type TraceResult, type PointStopReason, type PressResult, type RunState, type ViceOperation, type ViceOperations, type WindowResult } from "../../protocol/vice.ts";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { formatC64Address, instructionLength } from "../../c64.ts";
import { matrixRows } from "../../c64-keys.ts";
import { encodePng, type IndexedFrame } from "../../graphics.ts";
import { accessedValue, instructionText, operandAddress } from "../../opcodes.ts";
import type { ProcessSupervisor } from "../../native/processes.ts";
import { trace } from "../../trace.ts";
import type { ViceSessionFactory, ViceSessionHandle } from "../server.ts";
import {
  backtraceFromStack,
  conditionExpression,
  inRasterWindow,
  JAM_OPCODES,
  rasterLinesExpression,
  rasterWindowExpression,
  RUNNING_COMMAND_TIMEOUT_MS,
  ViceAdapter,
} from "./adapter.ts";
import { decodeProgramCounter, MonitorConnectionError, MonitorError, MonitorTimeoutError, ResponseType, type MonitorResponse } from "./binary-monitor.ts";
import { decodeCia, decodeSid, decodeSprite, decodeVicii } from "./chips.ts";
import { compareFrames, differenceImage } from "./screen.ts";
import { isRefusal } from "../../errors.ts";
import type { ViceFeature, ViceFlaw } from "../../native/discover.ts";
import { checkMedia, hasSignature } from "../../media.ts";
import { pressSnapshotRestore, setSnapshotMatrix } from "../../vsf.ts";
import { launchVice, startErrorLines, type ViceMode, type ViceProcess } from "./process.ts";
import { TextMonitorError, TextMonitorTimeoutError } from "./text-monitor.ts";

const CRASH_SETTLE_MS = 500;
/** How long until-return may run before the session stops it and reports the limit. */
const UNTIL_RETURN_LIMIT_MS = 30_000;
/** How long a reset may take to reach the reset vector. */
const RESET_STOP_LIMIT_MS = 5_000;

const STATE_LOST =
  "The emulator stopped unexpectedly and its machine state is lost. Restart the c64-re-tools MCP server to get a fresh C64.";

const VICE_HELD =
  "The emulator does not take commands now: it is paused in its window (Pause, Alt+P) or a dialog in its window waits for an answer. " +
  "Resume it or close the dialog in the VICE window, then try again. The machine is kept as it was.";

const VICE_HELD_HEADLESS =
  "The emulator does not take commands now. The session sends it nothing until it answers again, and then puts the machine back as it was. " +
  "Try again in a few seconds. If the emulator does not answer again, restart the c64-re-tools MCP server.";

function stepNotEnded(action: string, count: number, limitMs: number): string {
  return (
    `The emulator does not take commands now: the ${action} of ${count} instruction${count === 1 ? "" : "s"} did not end in ${limitMs / 1000} seconds. ` +
    "The CPU did not get to the end of it (for example, a subroutine that does not return). " +
    "The emulator takes no commands until the step ends. Try again later. If the step does not end, restart the c64-re-tools MCP server."
  );
}

/** A step or next that got no answer in time; `why` names it for the held VICE. */
class StepTimeout extends Error {
  override name = "StepTimeout";
  readonly why: string;
  constructor(why: string, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.why = why;
  }
}

const WINDOW_CLOSING =
  "The VICE window closed. The session starts a headless emulator again from the machine state of when the window opened. Try again in a few seconds.";

const WINDOW_CLOSED =
  "The VICE window closed before c64_window close (the user closed it, or that emulator stopped). " +
  "The machine is headless again, in the state it had when the window opened; what changed in the window is lost. " +
  "Breakpoints and watchpoints are kept. Check the machine state before you continue.";

/** Emulator state that a move to another VICE cannot carry. */
/** The first bytes of every VICE snapshot file. */
const NOT_CARRIED = ["cpu history", "memory map", "profile", "keyboard input not yet typed"];

/** Starts another VICE for this session; `log` also gets that launch's lines. */
export type ViceLauncher = (mode: ViceMode, log: (line: string) => void) => Promise<ViceProcess>;

/** The machine as saved for a move to another VICE. */
interface Handover {
  file: string;
  running: boolean;
  warp: boolean;
  /** Cycles on the session stopwatch (c64_timing) at the save. */
  elapsed: bigint;
}

/** What a user point needs to be set again in another VICE. */
type PointRecord = { checkpoint: number; enabled: boolean; space: "c64" | "drive8"; address: number; expression?: string };

/** A command that got no answer in time on a connection that is still open. */
function isTimeout(error: unknown): boolean {
  return error instanceof MonitorTimeoutError || error instanceof TextMonitorTimeoutError || error instanceof StepTimeout;
}

/** A stop and the VICE checkpoints that caused it. */
interface Stop {
  pc: number;
  hits: number[];
}

/** Why a frame-clocked run ended. "frames" means the frame limit was reached. */
type RunEnd = "target" | "breakpoint" | "watchpoint" | "jam" | "frames";

/** How long half a frame may take before the session gives up waiting. */
const HALF_FRAME_LIMIT_MS = 10_000;
/** A drive stop is completed within a few computer instructions. */
const DRIVE_STOP_TRIES = 4;

export interface SessionOptions {
  /** Upper bound for until-return; tests shorten it. */
  untilReturnLimitMs?: number;
  /** Upper bound for a step or next; tests shorten it. */
  stepLimitMs?: number;
  /** Starts another VICE, for c64_window. Without it the session cannot open a window. */
  launch?: ViceLauncher;
  /** Makes the host remove a path if it dies; returns the release. */
  ownPath?: (path: string) => () => void;
  /** The known flaws of this VICE version: the tools that a flaw breaks refuse with not-implemented. */
  flaws?: readonly ViceFlaw[];
  /** Lists the entries of a disk image, so an autostart index is checked first. Without it, VICE gets the index unchecked. */
  directory?: DiskDirectory;
}

/** The refusal of a tool that a known VICE flaw breaks: what does not work, and what to do. */
const BROKEN_MESSAGES: Record<ViceFeature, string> = {
  joystick: "Joystick input is not implemented in this setup. Do not use the joystick in this task. Give this message to the user.",
  tape: "The load of a tape image is not implemented in this setup. Do not load tape images in this task. Give this message to the user.",
  keyboard: "Keys of the keyboard matrix are not implemented in this setup. Do not press keys in this task. Give this message to the user.",
};

export type DiskDirectory = (type: DiskImageType, image: Buffer) => Promise<DiskFile[]>;

/**
 * Where VICE keeps a staged file: an autostarted disk stays in drive 8, a tape
 * in the datasette and a cartridge in the port, until the same place gets
 * another file. Only a program is read once.
 */
type StagedKind = "program" | "disk" | "tape" | "cartridge";

function stagedKind(type: string): StagedKind {
  if (type === "crt") return "cartridge";
  if (type === "tap" || type === "t64") return "tape";
  if (type === "prg" || type === "p00") return "program";
  return "disk";
}

export class ViceSession implements ViceSessionHandle {
  /** The current VICE. A window move replaces it. */
  #vice: ViceProcess;
  /** The mode of the current VICE. */
  #mode: ViceMode = "headless";
  readonly #videoStandard: VideoStandard;
  readonly #log: (line: string) => void;
  /** What the known VICE flaws break, each with the text of its flaw. */
  readonly #broken: ReadonlyMap<ViceFeature, string>;
  readonly #untilReturnLimitMs: number;
  readonly #stepLimitMs: number;
  readonly #launch: ViceLauncher | undefined;
  readonly #directory: DiskDirectory | undefined;
  /** Session files that outlive one VICE: snapshots, staged media, handovers. */
  readonly #workDir: string;
  readonly #releaseWorkDir: () => void;
  /** The machine as it was when the window opened; the way back if the window closes by itself. */
  #handover: Handover | undefined;
  /** Set from the moment the window VICE ends by itself until the session is headless again. */
  #windowClosing = false;
  /** A failure the next operation reports once, then the session goes on. */
  #notice: WireFailure | undefined;
  #adapter: ViceAdapter | undefined;
  #state: RunState = "running";
  /** Each returns true once satisfied and is then dropped. */
  #stopWaiters: Array<(stop: Stop) => boolean> = [];
  /** VICE numbers of checkpoints reported hit whose stopped event has not come yet. */
  #checkpointHits: number[] = [];
  /**
   * Set by a stop that a drive 8 checkpoint caused. VICE then enters the
   * monitor from inside the drive CPU, while the computer's CPU is between two
   * cycles of an instruction: a register write to it is lost or comes late,
   * and the next frame count ends one frame short. The session
   * completes such a stop (#completeDriveStop) before its next command, and
   * before a pause or an observation that first sees it reports the computer's pc.
   */
  #driveStop = false;
  /** Counts stops caused by checkpoints or a CPU JAM rather than by a monitor command. */
  #haltCount = 0;
  /** What stopped the machine last, when a user breakpoint or watchpoint or a JAM did; cleared when it runs again. */
  #lastStop: { stopReason: PointStopReason; pointId?: number } | undefined;
  /**
   * The pc of the JAM that holds the CPU. A jammed CPU runs again only after a
   * reset, a snapshot restore or an autostart: VICE 3.10 keeps it jammed after a
   * pc write, and reports the JAM only once.
   */
  #jammed: number | undefined;
  /**
   * An autostart can still be loading: VICE goes on with it after a snapshot
   * restore and writes the program over the restored memory. Only a reset stops it.
   */
  #autostarting = false;
  /** The C64 clock just after the last snapshot restore: VICE keeps the history of before it. */
  #historySince: bigint | undefined;
  /**
   * A breakpoint or watchpoint stopped a step, next or until-return early. VICE
   * keeps the rest of that step and stops the machine once more when it ends.
   * No monitor command ends it without running the CPU, so the session takes
   * that one stop as the end of the step and lets the machine run on.
   */
  #pendingStep = false;
  /**
   * The CPU stands at the stop of a reset without run, and nothing ran since. VICE
   * (3.9, 3.10) stops answering at the restore of a snapshot saved here while the
   * disk drive was busy, so a save here is refused.
   */
  #atResetStop = false;
  /** Warp as the user set it: VICE also turns warp on by itself while an autostart loads. */
  #userWarp = false;
  /** The CPU that the last run stopped in, when it was the drive: status then gives the drive's pc. */
  #stopSpace: "c64" | "drive8" = "c64";
  /** VICE records no CPU history after a JAM until the next reset. */
  #historyStopped = false;
  /** The CPU ran again after a JAM without a reset: the CPU history that VICE gives is old. */
  #historyOld = false;
  #queue: Promise<unknown> = Promise.resolve();
  #closed = false;
  #lost = false;
  /** Set while VICE takes no commands (its own pause, a dialog); settles when it is restored (#recover). */
  #held: Promise<void> | undefined;
  /** Why VICE takes no commands, for every operation refused while it is held. */
  #heldWhy = VICE_HELD;
  /** Session-local snapshots by name, as files in the session directory. */
  readonly #snapshots = new Map<string, string>();
  #snapshotFiles = 0;
  /** Session-local screen baselines, lost with the session. */
  readonly #baselines = new Map<string, { frame: IndexedFrame; palette: Array<[number, number, number]> }>();
  /** The CPU clock when the session stopwatch last started (c64_timing). */
  #timingStart = 0n;
  /** Counts staged media files, for unique names. */
  #staged = 0;
  /** True after an autostart of a cartridge, until an autostart of another file detaches it. */
  #cartridge = false;
  /** The last staged file of each kind that VICE took; VICE can still read it. */
  readonly #stagedFiles = new Map<StagedKind, string>();
  /** Session-local ids: one counter for breakpoints and watchpoints, from 1. */
  #nextPointId = 1;
  /**
   * User breakpoints and watchpoints by session id, with their VICE checkpoint
   * numbers and condition expressions: a window move sets them again.
   */
  readonly #breakpoints = new Map<number, Breakpoint & { checkpoint: number; expression?: string }>();
  readonly #watchpoints = new Map<number, Watchpoint & { checkpoint: number; expression?: string }>();
  /** The held joystick state per control port. */
  readonly #joysticks = new Map<1 | 2, JoystickState>([
    [1, { port: 1, direction: "center", fire: false }],
    [2, { port: 2, direction: "center", fire: false }],
  ]);

  private constructor(vice: ViceProcess, videoStandard: VideoStandard, log: (line: string) => void, options: SessionOptions) {
    this.#vice = vice;
    this.#videoStandard = videoStandard;
    this.#log = log;
    this.#untilReturnLimitMs = options.untilReturnLimitMs ?? UNTIL_RETURN_LIMIT_MS;
    this.#stepLimitMs = options.stepLimitMs ?? RUNNING_COMMAND_TIMEOUT_MS;
    this.#launch = options.launch;
    this.#directory = options.directory;
    this.#broken = new Map((options.flaws ?? []).flatMap((flaw) => flaw.breaks.map((feature) => [feature, flaw.text] as const)));
    this.#workDir = mkdtempSync(join(tmpdir(), "c64-re-tools-session-"));
    this.#releaseWorkDir = options.ownPath?.(this.#workDir) ?? (() => {});
    this.#watch(vice);
  }

  /** Follows a VICE's events and its end. Only the current VICE counts. */
  #watch(vice: ViceProcess): void {
    vice.monitor.onEvent((event) => {
      if (this.#vice === vice) this.#onEvent(event);
    });
    void vice.exited.then((status) =>
      this.#ended(vice, `VICE exited unexpectedly (code ${status.code}, signal ${status.signal})\n${vice.outputTail()}`),
    );
    for (const closed of [vice.monitor.closed, vice.text.closed]) {
      void closed.then((reason) => {
        if (reason !== undefined) this.#ended(vice, `VICE monitor connection lost: ${reason.message}`);
      });
    }
  }

  /**
   * A VICE ended or dropped its monitor without the session asking. A window
   * VICE goes back headless from the state of when the window opened;
   * any other loss is final, and the lost VICE is stopped at once: a VICE
   * that hangs without its monitor ends, and its group and scratch directory
   * do not wait for the session to close.
   */
  #ended(vice: ViceProcess, why: string): void {
    if (this.#closed || this.#vice !== vice || this.#lost || this.#windowClosing) return;
    this.#log(why);
    if (this.#mode === "window" && this.#handover !== undefined && this.#launch !== undefined) {
      this.#windowClosing = true;
      const handover = this.#handover;
      const launch = this.#launch;
      const run = this.#queue.then(() => this.#backToHeadless(vice, handover, launch));
      this.#queue = run.catch(() => {});
      return;
    }
    this.#lost = true;
    void vice.stop().catch((error: unknown) => this.#log(`stopping the lost VICE failed: ${error instanceof Error ? error.message : String(error)}`));
  }

  /** Restarts headless from the handover saved when the window opened. */
  async #backToHeadless(dead: ViceProcess, handover: Handover, launch: ViceLauncher): Promise<void> {
    try {
      await dead.stop();
      if (this.#closed) return;
      await this.#install(launch, "headless", handover);
      this.#handover = undefined;
      this.#notice = new WireFailure("machine-state-lost", WINDOW_CLOSED);
      if (handover.running) await this.#resume();
      this.#log("the session is headless again, in the state of when the window opened");
    } catch (error) {
      this.#lost = true;
      this.#log(`going back headless failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.#windowClosing = false;
    }
  }

  /** Wraps a launched, running VICE. Stops the VICE when setup fails. */
  static async start(
    vice: ViceProcess,
    videoStandard: VideoStandard,
    log: (line: string) => void = () => {},
    options: SessionOptions = {},
  ): Promise<ViceSession> {
    const session = new ViceSession(vice, videoStandard, log, options);
    try {
      await session.#enqueue(() =>
        session.#observe(async () => {
          session.#adapter = await ViceAdapter.create(vice.monitor, vice.text);
          session.#timingStart = await session.#adapter.clock();
          // c64_profile reports what ran since the session started.
          await session.#adapter.startProfiler();
          // In VICE 3.10 and older the control-port lines start all pressed; release them before the C64 reads them.
          for (const joystick of session.#joysticks.values()) await session.#adapter.setJoystick(joystick);
        }),
      );
    } catch (error) {
      await session.close();
      throw error;
    }
    return session;
  }

  handle<O extends ViceOperation>(
    op: O,
    params: ViceOperations[O]["params"],
    attachments: Buffer[] = [],
    reply: Buffer[] = [],
  ): Promise<ViceOperations[O]["result"]> {
    // A window request for the mode the session is in sends nothing to VICE, so a held VICE does not stop it.
    return this.#enqueue(() => this.#run(op, params, attachments, reply), { whileHeld: op === "window" }) as Promise<ViceOperations[O]["result"]>;
  }

  async close(): Promise<void> {
    this.#closed = true;
    try {
      await this.#vice.stop();
    } finally {
      rmSync(this.#workDir, { recursive: true, force: true });
      this.#releaseWorkDir();
    }
  }

  get #machine(): ViceAdapter {
    if (this.#adapter === undefined) throw new Error("session is not set up");
    return this.#adapter;
  }

  async #run(op: ViceOperation, params: unknown, attachments: Buffer[], reply: Buffer[]): Promise<unknown> {
    switch (op) {
      case "status":
        return this.#status();
      case "ioRead": {
        const read = params as ViceOperations["ioRead"]["params"];
        const bytes = await this.#observe(() => this.#machine.readIo(read.address, read.size));
        return { address: read.address, data: Buffer.from(bytes).toString("hex") };
      }
      case "memoryRead": {
        const read = params as ViceOperations["memoryRead"]["params"];
        const data = await this.#observe(() => this.#machine.readMemory(read));
        return { address: read.address, data };
      }
      case "registersGet": {
        const { space } = params as ViceOperations["registersGet"]["params"];
        return this.#observe(() => this.#machine.readRegisters(space));
      }
      case "memoryWrite": {
        const write = params as ViceOperations["memoryWrite"]["params"];
        this.#requireStopped();
        return { address: write.address, bytesWritten: await this.#machine.writeMemory(write) };
      }
      case "memorySearch": {
        const search = params as ViceOperations["memorySearch"]["params"];
        const matches = await this.#observe(() => this.#machine.search({ ...search, limit: search.maxResults }));
        return { matches };
      }
      case "memoryCompare":
        return this.#memoryCompare(params as ViceOperations["memoryCompare"]["params"]);
      case "disassemble": {
        const request = params as ViceOperations["disassemble"]["params"];
        return { instructions: await this.#observe(() => this.#machine.disassemble(request)) };
      }
      case "registersSet": {
        const { space, values } = params as ViceOperations["registersSet"]["params"];
        this.#requireStopped();
        return this.#machine.writeRegisters(space, values);
      }
      case "execution":
        return this.#execution(params as ExecutionParams);
      case "runUntil":
        return this.#runUntil(params as ViceOperations["runUntil"]["params"]);
      case "programLoad":
        return this.#programLoad(params as ViceOperations["programLoad"]["params"], onlyAttachment(attachments));
      case "autostart": {
        const { type, index, run } = params as ViceOperations["autostart"]["params"];
        if (type === "tap") this.#refuseBroken("tape", "c64_autostart of a tape image");
        const bytes = onlyAttachment(attachments);
        checkMedia(type, bytes);
        if (index > 0 && this.#directory !== undefined && isOneOf(DISK_IMAGE_TYPES, type)) checkDirectoryEntry(await this.#directory(type, bytes), index);
        const file = this.#stage(bytes, type);
        // VICE keeps a cartridge through every reset and autostart, as a real C64 does.
        if (type !== "crt" && this.#cartridge) {
          await this.#observe(() => this.#machine.detachCartridge());
          this.#cartridge = false;
          this.#replaceStaged("cartridge", undefined);
        }
        // Port 1 shares the keyboard lines: a held direction types keys into the RUN that the autostart types.
        const centred: Array<1 | 2> = [];
        for (const [port, joystick] of this.#joysticks) {
          if (joystick.direction === "center" && !joystick.fire) continue;
          const centre: JoystickState = { port, direction: "center", fire: false };
          await this.#observe(() => this.#machine.setJoystick(centre));
          this.#joysticks.set(port, centre);
          centred.push(port);
        }
        await this.#runningCommand(() => this.#machine.autostart(file, index, run));
        this.#clearJam();
        this.#autostarting = true;
        if (type === "crt") this.#cartridge = true;
        this.#replaceStaged(stagedKind(type), file);
        // A reset sets the CPU clock back, so the stopwatch starts again.
        this.#timingStart = 0n;
        return { state: "running", ...(centred.length === 0 ? {} : { joysticksCentred: centred }) };
      }
      case "diskAttach": {
        const { type } = params as ViceOperations["diskAttach"]["params"];
        const bytes = onlyAttachment(attachments);
        checkMedia(type, bytes);
        const file = this.#stage(bytes, type);
        await this.#observe(() => this.#machine.attachDisk(file));
        this.#replaceStaged("disk", file);
        return { attached: true };
      }
      case "reset":
        return this.#reset(params as ViceOperations["reset"]["params"]);
      case "keyboard": {
        const bytes = Buffer.from((params as ViceOperations["keyboard"]["params"]).data, "hex");
        await this.#refuseWhileAutostartLoads("type");
        await this.#observe(() => this.#machine.feedKeyboard(bytes));
        return { queuedBytes: bytes.length };
      }
      case "press":
        return this.#press(params as ViceOperations["press"]["params"]);
      case "breakpoint":
        return this.#breakpoint(params as BreakpointParams);
      case "watchpoint":
        return this.#watchpoint(params as WatchpointParams);
      case "screenCapture": {
        const { baseline } = params as ViceOperations["screenCapture"]["params"];
        if (baseline !== undefined && !this.#baselines.has(baseline) && this.#baselines.size >= MAX_BASELINES) {
          throw new WireFailure("limit-exceeded", `A session keeps at most ${MAX_BASELINES} baselines. Remove one first with c64_screen action remove.`);
        }
        const shot = await this.#observe(() => this.#machine.captureFrame(this.#videoStandard));
        if (baseline !== undefined) this.#baselines.set(baseline, shot);
        const result: ViceOperations["screenCapture"]["result"] = {
          width: shot.frame.width,
          height: shot.frame.height,
          png: encodePng(shot.frame, shot.palette).toString("base64"),
        };
        if (baseline !== undefined) result.baseline = baseline;
        return result;
      }
      case "screenCompare":
        return this.#screenCompare(params as ViceOperations["screenCompare"]["params"]);
      case "screenBaselines":
        return { baselines: [...this.#baselines.keys()] };
      case "screenDiscard": {
        const { baseline } = params as ViceOperations["screenDiscard"]["params"];
        if (!this.#baselines.delete(baseline)) throw new WireFailure("not-found", `There is no baseline named ${baseline}.`);
        return { removed: true };
      }
      case "snapshot":
        return this.#snapshot(params as ViceOperations["snapshot"]["params"]);
      case "snapshotFile":
        return this.#snapshotFile(params as ViceOperations["snapshotFile"]["params"], attachments, reply);
      case "cpuHistory":
        return this.#cpuHistory(params as ViceOperations["cpuHistory"]["params"]);
      case "trace": {
        // The hits go as an attachment: thousands of them do not fit in one message.
        const { hits, ...traced } = await this.#trace(params as ViceOperations["trace"]["params"]);
        reply.push(Buffer.from(JSON.stringify(hits), "utf8"));
        return { ...traced, hits: hits.length };
      }
      case "backtrace": {
        const { depth, space } = params as ViceOperations["backtrace"]["params"];
        return this.#observe(async () => {
          const { sp } = await this.#machine.readRegisters(space);
          return { frames: backtraceFromStack(sp, await this.#machine.readAll(space), depth) };
        });
      }
      case "timing": {
        const { action } = params as ViceOperations["timing"]["params"];
        const now = await this.#observe(() => this.#machine.clock());
        if (action === "start") {
          this.#timingStart = now;
          return { started: true };
        }
        return { cycles: (now - this.#timingStart).toString() };
      }
      case "profile": {
        const request = params as ViceOperations["profile"]["params"];
        if (request.action === "clear") {
          await this.#observe(() => this.#machine.startProfiler());
          return { cleared: true };
        }
        return { entries: await this.#observe(() => this.#machine.profile(request.limit)) };
      }
      case "memmap": {
        const request = params as ViceOperations["memmap"]["params"];
        if (request.action === "clear") {
          await this.#observe(() => this.#machine.clearMemmap());
          return { cleared: true };
        }
        return await this.#observe(() => this.#machine.memmap(request.start, request.end, request.maxRanges));
      }
      case "vicii":
        return this.#observe(() => this.#vicii());
      case "sprites": {
        const { indexes } = params as ViceOperations["sprites"]["params"];
        return this.#observe(async () => ({ sprites: await this.#sprites(indexes) }));
      }
      case "cia": {
        const { which } = params as ViceOperations["cia"]["params"];
        return this.#observe(async () => ({ chips: await this.#cias(which) }));
      }
      case "sid":
        return this.#observe(() => this.#sid());
      case "observe":
        return this.#observeAll(params as ObserveParams);
      case "joystick": {
        this.#refuseBroken("joystick", "c64_joystick");
        const joystick = params as JoystickState;
        await this.#observe(() => this.#machine.setJoystick(joystick));
        this.#joysticks.set(joystick.port, joystick);
        return joystick;
      }
      case "warp": {
        const { enabled } = params as ViceOperations["warp"]["params"];
        await this.#observe(() => this.#machine.setWarp(enabled));
        this.#userWarp = enabled;
        return { enabled };
      }
      case "window":
        return this.#window((params as ViceOperations["window"]["params"]).action === "open" ? "window" : "headless");
    }
    throw new WireFailure("invalid-input", `unknown operation: ${String(op)}`);
  }

  async #status(): Promise<MachineStatus> {
    const warp = await this.#observe(() => this.#machine.warp());
    // Read after #observe: it resumes a running machine, unless a breakpoint or a JAM stopped it meanwhile.
    const status: MachineStatus = { state: this.#state, videoStandard: this.#videoStandard, warp, window: this.#mode === "window", cartridge: this.#cartridge };
    if (status.state === "stopped") {
      status.pc = await this.#pc();
      // VICE 3.9 sends no JAM event: the opcode at the pc tells.
      const stop = this.#lastStop ?? ((await this.#jamAt(status.pc)) ? { stopReason: "jam" as const } : undefined);
      if (stop !== undefined) Object.assign(status, stop);
      // A point in the drive stopped it: the pc is the drive's, as advance-frames and run-until give it.
      const point = status.pointId === undefined ? undefined : (status.stopReason === "watchpoint" ? this.#watchpoints : this.#breakpoints).get(status.pointId);
      status.space = point?.space === "drive8" || this.#stopSpace === "drive8" ? "drive8" : "c64";
      if (status.space === "drive8") status.pc = (await this.#machine.readRegisters("drive8")).pc;
    }
    return status;
  }

  async #execution(params: ExecutionParams): Promise<ExecutionResult> {
    if (params.space === "drive8" && (params.action === "pause" || params.action === "resume")) {
      throw new WireFailure("unsupported-in-space", `${params.action} stops or runs the whole machine, the computer and the disk drive together: use space c64.`);
    }
    if (params.action === "resume") {
      if (this.#state === "stopped") {
        await this.#refuseJammed("resume");
        await this.#resume();
        if (this.#pendingStep) await this.#endPendingStep();
      }
      return { state: "running" };
    }
    if (params.action === "pause") {
      await this.#stop();
      // A drive checkpoint can stop the machine just before the pause does.
      return { state: "stopped", pc: (await this.#completeDriveStop()) ?? (await this.#pc()) };
    }
    if (params.space === "drive8" && params.action === "advance-frames") {
      throw new WireFailure("unsupported-in-space", "advance-frames counts the video frames of the computer: use space c64. A breakpoint or watchpoint in space drive8 also stops it.");
    }
    if (params.space === "drive8") {
      // Stock VICE runs the 1541 CPU in batches that catch up with the computer's clock;
      // neither monitor can stop it after exactly one of its instructions.
      throw new WireFailure(
        "unsupported-in-space",
        `${params.action} works only in space c64: the emulator cannot stop the disk drive CPU after a single instruction. ` +
          "Use a breakpoint or run-until with an address in space drive8: it stops when the drive executes that address, " +
          "and the drive can run a few instructions more before it stops.",
      );
    }
    if (params.action === "advance-frames") {
      if (params.count === undefined) throw new WireFailure("invalid-input", "advance-frames needs count, the number of frames");
      const raster = RASTER[this.#videoStandard];
      if (params.anchor !== undefined && (params.anchor.line >= raster.lines || params.anchor.cycle >= raster.cycles)) {
        throw new WireFailure("invalid-input", `The anchor is outside the frame: a ${this.#videoStandard} frame has lines 0-${raster.lines - 1} and cycles 0-${raster.cycles - 1}.`);
      }
      const outcome = await this.#runFrames(params.count, undefined, params.anchor);
      this.#stopSpace = outcome.space;
      return {
        state: "stopped",
        // A stop event carries the computer's PC; a stop in the drive reports the drive's.
        pc: outcome.space === "drive8" ? (await this.#machine.readRegisters("drive8")).pc : outcome.pc,
        space: outcome.space,
        advancedFrames: outcome.frames,
        stopReason: outcome.end === "target" ? "frames" : outcome.end,
        ...(outcome.pointId === undefined ? {} : { pointId: outcome.pointId }),
      };
    }
    await this.#stop();
    await this.#refuseJammed(params.action);
    // A new step replaces the rest of an earlier one in VICE.
    this.#pendingStep = false;
    if (params.action === "until-return") {
      const stopped = this.#nextStop(this.#untilReturnLimitMs);
      await this.#resumingCommand(() => this.#machine.untilReturn());
      const stop = await stopped;
      if (stop === undefined) {
        await this.#stop();
        throw new WireFailure(
          "limit-exceeded",
          `The routine did not return within ${this.#untilReturnLimitMs / 1000} seconds. The machine is stopped at ${formatC64Address(await this.#pc())}.`,
        );
      }
      return { state: "stopped", pc: stop.pc, ...this.#stepStoppedByPoint() };
    }
    const count = params.count ?? 1;
    this.#atResetStop = false;
    // The stop event of the step tells that it ended, and which point stopped it. A long step
    // in warp can answer before it ends; a ping then would stop it early and leave the rest in VICE.
    const stopped = this.#nextStop(this.#stepLimitMs);
    try {
      await this.#machine.step(count, params.action === "next", this.#stepLimitMs);
    } catch (error) {
      if (error instanceof MonitorTimeoutError) throw new StepTimeout(stepNotEnded(params.action, count, this.#stepLimitMs), error);
      throw error;
    }
    if ((await stopped) === undefined) await this.#machine.stop();
    this.#state = "stopped";
    const point = this.#stepStoppedByPoint();
    // A point stops the step early: VICE does not tell how many instructions ran.
    return { state: "stopped", pc: await this.#pc(), ...(point.pointId === undefined ? { executed: count } : point) };
  }

  /** The breakpoint or watchpoint that stopped a step, next or until-return early; VICE then keeps the rest of the step. */
  #stepStoppedByPoint(): { stopReason?: PointStopReason; pointId?: number } {
    const stop = this.#lastStop;
    if (stop?.pointId === undefined) return {};
    this.#pendingStep = true;
    return { stopReason: stop.stopReason, pointId: stop.pointId };
  }

  /** After a resume: waits for the stop that ends the rest of an earlier step, and runs on. */
  async #endPendingStep(): Promise<void> {
    const stop = await this.#nextStop(HALF_FRAME_LIMIT_MS);
    if (stop === undefined) return;
    this.#pendingStep = false;
    // A user point or a JAM stopped the machine: it stays stopped and status tells why.
    if (stop.hits.length === 0 && this.#lastStop === undefined) await this.#resume();
  }

  async #reset(params: { mode: "soft" | "hard"; run: boolean }): Promise<{ state: RunState; pc?: number }> {
    await this.#stop();
    this.#clearJam();
    // A reset sets the CPU clock back, so the stopwatch starts again.
    this.#timingStart = 0n;
    if (params.run) {
      await this.#runningCommand(() => this.#machine.reset(params.mode));
      return { state: "running" };
    }
    // A breakpoint on the reset vector stops the reset at its first instruction.
    // VICE does not check a breakpoint at the PC it resumes from, and a reset
    // sent from the monitor resumes at the vector; so the reset is sent while
    // running, and only a stop caused by this breakpoint counts.
    const vector = await this.#machine.resetVector();
    const checkpoint = await this.#machine.addCheckpoint({ start: vector, end: vector, operation: 0x04, space: "c64" });
    await this.#resume();
    const stopped = this.#nextStop(RESET_STOP_LIMIT_MS, checkpoint);
    await this.#resumingCommand(() => this.#machine.reset(params.mode));
    const reached = (await stopped) !== undefined;
    if (!reached) await this.#stop();
    await this.#machine.deleteCheckpoint(checkpoint);
    if (!reached) throw new WireFailure("operation-failed", "The C64 did not reach its reset vector after the reset.");
    this.#atResetStop = true;
    return { state: "stopped", pc: vector };
  }

  /**
   * Runs the machine for up to `limit` frames, counted from where it stands:
   * frame k ends at the first instruction at or after the start raster
   * position in the k-th frame after it. One internal exec checkpoint over
   * all of memory alternates between an arming window half a frame away and
   * the end-of-frame window, so the count needs no wall clock. A `target`
   * checkpoint, a user breakpoint or watchpoint, or a JAM ends the run early.
   * The machine is stopped afterwards.
   */
  async #runFrames(limit: number, target?: { checkpoint: number; deferred: boolean }, anchor?: { line: number; cycle: number }): Promise<{ end: RunEnd; frames: number; pc: number; space: "c64" | "drive8"; pointId?: number }> {
    await this.#stop();
    const lines = RASTER[this.#videoStandard].lines;
    // A frame ends where the raster passes the anchor; without one, where this run starts.
    const start = anchor ?? (await this.#machine.rasterPosition());
    const arming = rasterLinesExpression((start.line + Math.floor(lines / 2)) % lines, lines);
    const ending = rasterWindowExpression(start.line, start.cycle, lines);
    const startPc = await this.#pc();
    if (await this.#jamAt(startPc)) return { end: "jam", frames: 0, pc: startPc, space: "c64" };
    const clock = await this.#machine.addCheckpoint({ start: 0x0000, end: 0xffff, operation: 0x04, space: "c64" });
    try {
      await this.#machine.setCondition(clock, arming);
      let armingPhase = true;
      let frames = 0;
      // VICE reports a JAM only once until a reset: a jammed CPU stops the clock at the same pc again and again.
      let clockPc = startPc;
      for (;;) {
        const next = this.#nextStop(HALF_FRAME_LIMIT_MS);
        await this.#resume();
        const stop = await next;
        if (stop === undefined) {
          await this.#stop();
          throw new WireFailure("operation-failed", "The emulator did not reach the next frame in time.");
        }
        const end = this.#stopCause(stop, clock, target?.checkpoint);
        if (end === "clock") {
          if (stop.pc === clockPc && (await this.#jamAt(stop.pc))) return { end: "jam", frames, pc: stop.pc, space: "c64" };
          clockPc = stop.pc;
          if (armingPhase) {
            await this.#machine.setCondition(clock, ending);
            if (target?.deferred) {
              await this.#machine.toggleCheckpoint(target.checkpoint, true);
              target.deferred = false;
            }
          } else {
            frames++;
            if (frames >= limit) return { end: "frames", frames, pc: stop.pc, space: "c64" };
            await this.#machine.setCondition(clock, arming);
          }
          armingPhase = !armingPhase;
          continue;
        }
        if (end === "unknown") {
          if (await this.#jamAt(stop.pc)) return { end: "jam", frames, pc: stop.pc, space: "c64" };
          if (this.#pendingStep) {
            // The rest of an earlier step ended: run on.
            this.#pendingStep = false;
            continue;
          }
          throw new WireFailure("operation-failed", "The emulator stopped the machine for a reason outside this run.");
        }
        // A drive stop is completed before the result names the computer's pc; `space` says which CPU stopped.
        const driveStop = this.#driveStop;
        const pointId = end === "target" ? undefined : this.#userPoint(stop.hits)?.pointId;
        return { end, frames, pc: (await this.#completeDriveStop()) ?? stop.pc, space: driveStop ? "drive8" : "c64", ...(pointId === undefined ? {} : { pointId }) };
      }
    } finally {
      await this.#machine.deleteCheckpoint(clock);
    }
  }

  /**
   * A trace: runs the machine for up to `frames` frames, counted as
   * #runFrames counts them, with a stopping checkpoint for each point. At each
   * hit the session records the instruction, its registers and the raster
   * position, and runs on. It ends at the frame limit, at `maxHits` hits, or
   * where a user point or a JAM stops the program. VICE also reports the hits
   * of a checkpoint that does not stop, but without the PC, the registers or
   * the raster position, so each point stops.
   */
  async #trace(params: ViceOperations["trace"]["params"]): Promise<TraceResult> {
    await this.#stop();
    const lines = RASTER[this.#videoStandard].lines;
    const start = await this.#machine.rasterPosition();
    const arming = rasterLinesExpression((start.line + Math.floor(lines / 2)) % lines, lines);
    const ending = rasterWindowExpression(start.line, start.cycle, lines);
    const operation: Record<TraceKind, number> = { exec: 0x04, read: 0x01, write: 0x02 };
    const points: number[] = [];
    const hits: TraceHit[] = [];
    let frames = 0;
    const startPc = await this.#pc();
    if (await this.#jamAt(startPc)) return { hits, frames, end: "jam", pc: startPc };
    // VICE checks no checkpoint at the pc that it resumes from: an exec point there gets its first hit here.
    for (const [index, point] of params.points.entries()) {
      if (point.kind === "exec" && point.start <= startPc && startPc <= point.end) {
        hits.push(await this.#traceHit(index, "exec", 0));
        if (hits.length >= params.maxHits) return { hits, frames, end: "hits", pc: startPc };
        break;
      }
    }
    let clockPc = startPc;
    const clock = await this.#machine.addCheckpoint({ start: 0x0000, end: 0xffff, operation: 0x04, space: "c64" });
    try {
      for (const point of params.points) points.push(await this.#machine.addCheckpoint({ start: point.start, end: point.end, operation: operation[point.kind], space: "c64" }));
      await this.#machine.setCondition(clock, arming);
      let armingPhase = true;
      for (;;) {
        const next = this.#nextStop(HALF_FRAME_LIMIT_MS);
        await this.#resume();
        const stop = await next;
        if (stop === undefined) {
          await this.#stop();
          throw new WireFailure("operation-failed", "The emulator did not reach the next frame in time.");
        }
        const traced = points.flatMap((checkpoint, index) => (stop.hits.includes(checkpoint) ? [index] : []));
        for (const index of traced) {
          hits.push(await this.#traceHit(index, params.points[index]!.kind, frames));
          if (hits.length >= params.maxHits) return { hits, frames, end: "hits", pc: stop.pc };
        }
        if (stop.hits.includes(clock)) {
          if (stop.pc === clockPc && (await this.#jamAt(stop.pc))) return { hits, frames, end: "jam", pc: stop.pc };
          clockPc = stop.pc;
          if (armingPhase) await this.#machine.setCondition(clock, ending);
          else {
            frames++;
            if (frames >= params.frames) return { hits, frames, end: "frames", pc: stop.pc };
            await this.#machine.setCondition(clock, arming);
          }
          armingPhase = !armingPhase;
          continue;
        }
        if (traced.length > 0) continue;
        const point = this.#userPoint(stop.hits);
        if (point !== undefined) return { hits, frames, end: point.stopReason, pc: stop.pc };
        if (await this.#jamAt(stop.pc)) return { hits, frames, end: "jam", pc: stop.pc };
        if (this.#pendingStep) {
          this.#pendingStep = false;
          continue;
        }
        throw new WireFailure("operation-failed", "The emulator stopped the machine for a reason outside this trace.");
      }
    } finally {
      await this.#machine.deleteCheckpoint(clock);
      for (const checkpoint of points) await this.#machine.deleteCheckpoint(checkpoint);
    }
  }

  /**
   * One hit of a trace point. An exec point stops before its instruction: the
   * registers and the raster position are the ones of now. A read or write
   * point stops after the instruction that made the access: the last entry of
   * the CPU history is that instruction, with its registers and its clock.
   */
  async #traceHit(point: number, kind: TraceKind, frame: number): Promise<TraceHit> {
    const position = await this.#machine.rasterPosition();
    const byteAt = async (address: number) => Number.parseInt(await this.#machine.readMemory({ address, size: 1, space: "c64", view: "cpu" }), 16);
    if (kind === "exec") {
      const registers = await this.#machine.readRegisters("c64");
      const bytes = [...Buffer.from(await this.#machine.readMemory({ address: registers.pc, size: 3, space: "c64", view: "cpu" }), "hex")];
      const length = instructionLength(bytes[0]!);
      return {
        point,
        pc: registers.pc,
        bytes: Buffer.from(bytes.slice(0, length)).toString("hex"),
        text: instructionText(bytes, registers.pc),
        a: registers.a,
        x: registers.x,
        y: registers.y,
        sp: registers.sp,
        frame,
        rasterLine: position.line,
        rasterCycle: position.cycle,
      };
    }
    const [entry] = await this.#machine.history(1, "c64");
    if (entry === undefined) throw new WireFailure("operation-failed", "The emulator gave no CPU history at a trace hit.");
    const now = await this.#machine.clock();
    const { lines, cycles } = RASTER[this.#videoStandard];
    const span = BigInt(lines * cycles);
    const at = Number((((BigInt(position.line * cycles + position.cycle) - (now - entry.clock)) % span) + span) % span);
    const bytes = [...Buffer.from(entry.bytes, "hex")];
    // A zero-page pointer is read now: the instruction did not change it.
    const pointer = new Map<number, number>();
    for (const address of [bytes[1] ?? 0, ((bytes[1] ?? 0) + 1) & 0xff, ((bytes[1] ?? 0) + entry.x) & 0xff, ((bytes[1] ?? 0) + entry.x + 1) & 0xff]) pointer.set(address, await byteAt(address));
    const address = operandAddress(bytes, entry.x, entry.y, (zp) => pointer.get(zp) ?? 0);
    return {
      point,
      pc: entry.address,
      bytes: entry.bytes,
      text: instructionText(bytes, entry.address),
      a: entry.a,
      x: entry.x,
      y: entry.y,
      sp: entry.sp,
      frame,
      rasterLine: Math.floor(at / cycles),
      rasterCycle: at % cycles,
      ...(address === undefined ? {} : { address, ...(await this.#accessed(bytes[0]!, entry, address, byteAt)) }),
    };
  }

  /**
   * The byte of a read or write hit. A read of an I/O register after the
   * access can give another byte than the access did (raster bits, cleared
   * flags), so for $D000-$DFFF only a load or a store gives a value.
   */
  async #accessed(opcode: number, before: { a: number; x: number; y: number }, address: number, byteAt: (address: number) => Promise<number>): Promise<{ value?: number }> {
    const after = await this.#machine.readRegisters("c64");
    const io = address >= 0xd000 && address <= 0xdfff;
    const value = accessedValue(opcode, before, after, io ? undefined : await byteAt(address));
    return value === undefined ? {} : { value };
  }

  /**
   * Completes a stop that a drive 8 checkpoint caused: the computer runs to
   * its next instruction boundary, where a computer checkpoint stops it, so
   * VICE enters the monitor from the computer's CPU. The drive runs those few
   * cycles too. Returns the computer's pc, or undefined when there was no
   * drive stop.
   */
  async #completeDriveStop(): Promise<number | undefined> {
    if (!this.#driveStop) return undefined;
    this.#driveStop = false;
    // The drive checkpoint stopped the machine; the stop at the boundary keeps that reason.
    const reason = this.#lastStop;
    const boundary = await this.#machine.addCheckpoint({ start: 0x0000, end: 0xffff, operation: 0x04, space: "c64" });
    try {
      for (let attempt = 0; attempt < DRIVE_STOP_TRIES; attempt++) {
        const next = this.#nextStop(HALF_FRAME_LIMIT_MS);
        await this.#resume();
        const stop = await next;
        if (stop === undefined) break;
        // The drive can hit its checkpoint again before the computer gets to the next instruction.
        if (stop.hits.includes(boundary)) {
          this.#driveStop = false;
          this.#lastStop = reason;
          trace().event("vice.drive-stop", { pc: stop.pc, resumes: attempt + 1 });
          return stop.pc;
        }
      }
      await this.#stop();
      throw new WireFailure("operation-failed", "The computer did not get to its next instruction after a stop in the disk drive.");
    } finally {
      await this.#machine.deleteCheckpoint(boundary);
    }
  }

  /** Names what caused a stop during a frame-clocked run. */
  #stopCause(stop: Stop, clock: number, target: number | undefined): Exclude<RunEnd, "frames" | "jam"> | "clock" | "unknown" {
    if (target !== undefined && stop.hits.includes(target)) return "target";
    const point = this.#userPoint(stop.hits);
    if (point !== undefined) return point.stopReason;
    if (stop.hits.includes(clock)) return "clock";
    return "unknown";
  }

  /** The user breakpoint, else the user watchpoint, among the hit VICE checkpoints. */
  #userPoint(hits: number[]): { stopReason: "breakpoint" | "watchpoint"; pointId: number } | undefined {
    for (const [stopReason, registry] of [["breakpoint", this.#breakpoints], ["watchpoint", this.#watchpoints]] as const) {
      for (const [pointId, point] of registry) if (hits.includes(point.checkpoint)) return { stopReason, pointId };
    }
    return undefined;
  }

  /**
   * True when a JAM holds the CPU at `pc`: the session saw a JAM since the last
   * reset, restore or autostart, or the opcode at `pc` is a JAM. The CPU stops
   * on such an opcode, so it executes nothing more. The session keeps the JAM.
   */
  async #jamAt(pc: number): Promise<boolean> {
    if (this.#jammed !== undefined) return true;
    const opcode = await this.#machine.readMemory({ address: pc, size: 1, space: "c64", view: "cpu" });
    if (!JAM_OPCODES.has(Number.parseInt(opcode, 16))) return false;
    this.#jam(pc);
    return true;
  }

  #jam(pc: number): void {
    this.#jammed = pc;
    this.#historyStopped = true;
  }

  /** A reset or an autostart starts a jammed CPU and the CPU history again. */
  #clearJam(): void {
    this.#autostarting = false;
    // A reset sets the clock back to 0: the history from before it is of this run again.
    this.#historySince = undefined;
    this.#jammed = undefined;
    this.#historyStopped = false;
    this.#historyOld = false;
  }

  /** Refuses an action that needs the CPU to execute, while a JAM holds it. */
  async #refuseJammed(action: string): Promise<void> {
    const pc = await this.#pc();
    if (!(await this.#jamAt(pc))) return;
    throw new WireFailure(
      "operation-failed",
      `The CPU is jammed by the JAM opcode at ${formatC64Address(this.#jammed ?? pc)}, so ${action} cannot execute an instruction. ` +
        "The CPU runs again only after c64_reset, a snapshot restore or c64_autostart.",
    );
  }

  /** Runs until a target is reached or `timeoutFrames` frames pass. */
  async #runUntil(params: { target: RunTarget; timeoutFrames: number }): Promise<RunUntilResult> {
    const target = params.target;
    let expression: string | undefined;
    let range: { start: number; end: number; operation: number; space: "c64" | "drive8" };
    let deferred = false;
    // The target is checked before the machine stops: a refused target leaves the run state as it was.
    switch (target.kind) {
      case "address":
        range = { start: target.address, end: target.address, operation: 0x04, space: target.space };
        if (target.condition !== undefined) expression = this.#expression(target.condition, target.space);
        break;
      case "memory": {
        // A store checkpoint whose condition reads memory after the write.
        range = { start: target.address, end: target.address, operation: 0x02, space: target.space };
        const { kind: _kind, ...condition } = target;
        expression = this.#expression({ kind: "memory", ...condition }, target.space);
        break;
      }
      case "raster": {
        const raster = RASTER[this.#videoStandard];
        this.#expression(target, "c64");
        const cycle = target.cycle ?? 0;
        range = { start: 0x0000, end: 0xffff, operation: 0x04, space: "c64" };
        expression = rasterWindowExpression(target.line, cycle, raster.lines);
        break;
      }
    }
    await this.#stop();
    if (target.kind === "raster") {
      // Already inside the target window: the next pass through it counts, not this one.
      deferred = inRasterWindow(await this.#machine.rasterPosition(), target.line, target.cycle ?? 0, RASTER[this.#videoStandard].lines);
    }
    const checkpoint = await this.#machine.addCheckpoint({ ...range, enabled: !deferred });
    try {
      if (expression !== undefined) await this.#machine.setCondition(checkpoint, expression);
      const outcome = await this.#runFrames(params.timeoutFrames, { checkpoint, deferred });
      const stopReason = outcome.end === "frames" ? "timeout" : outcome.end;
      // A stop event carries the computer's PC; a stop in the drive reports the drive's.
      const pc = outcome.space === "drive8" ? (await this.#machine.readRegisters("drive8")).pc : outcome.pc;
      this.#stopSpace = outcome.space;
      return { reached: stopReason === "target", stopReason, state: "stopped", pc, space: outcome.space, ...(outcome.pointId === undefined ? {} : { pointId: outcome.pointId }) };
    } finally {
      await this.#machine.deleteCheckpoint(checkpoint);
    }
  }

  /** Checks a condition against this session's video standard and builds its VICE expression. */
  #expression(condition: Condition, space: "c64" | "drive8"): string {
    if (condition.kind === "raster") {
      const raster = RASTER[this.#videoStandard];
      if (condition.line >= raster.lines) {
        throw new WireFailure("invalid-input", `A ${this.#videoStandard.toUpperCase()} frame has raster lines 0 to ${raster.lines - 1}.`);
      }
      if (condition.cycle !== undefined && condition.cycle >= raster.cycles) {
        throw new WireFailure("invalid-input", `A ${this.#videoStandard.toUpperCase()} raster line has cycles 0 to ${raster.cycles - 1}.`);
      }
    }
    return conditionExpression(condition, space);
  }

  /** Adds a checkpoint with an optional condition; removes it again if the condition is refused. */
  async #addPoint(options: {
    start: number;
    end: number;
    operation: number;
    space: "c64" | "drive8";
    condition?: Condition;
  }): Promise<{ checkpoint: number; expression?: string }> {
    const expression = options.condition === undefined ? undefined : this.#expression(options.condition, options.space);
    const checkpoint = await this.#observe(() => setPoint(this.#machine, { ...options, enabled: true, expression }));
    return expression === undefined ? { checkpoint } : { checkpoint, expression };
  }

  /** remove/enable/disable on a registry of points; `kind` names it in messages. */
  async #changePoint<T extends { checkpoint: number; enabled: boolean }>(
    registry: Map<number, T>,
    kind: string,
    params: { action: "enable" | "disable"; id: number },
  ): Promise<T> {
    const point = this.#point(registry, kind, params.id);
    const enabled = params.action === "enable";
    await this.#observe(() => this.#machine.toggleCheckpoint(point.checkpoint, enabled));
    point.enabled = enabled;
    return point;
  }

  async #removePoint(registry: Map<number, { checkpoint: number }>, kind: string, id: number): Promise<PointRemoved> {
    const point = this.#point(registry, kind, id);
    await this.#observe(() => this.#machine.deleteCheckpoint(point.checkpoint));
    registry.delete(id);
    return { removed: true, id };
  }

  #point<T>(registry: Map<number, T>, kind: string, id: number): T {
    const point = registry.get(id);
    if (point === undefined) {
      const other = kind === "breakpoint" ? (this.#watchpoints.has(id) ? "watchpoint" : undefined) : this.#breakpoints.has(id) ? "breakpoint" : undefined;
      throw new WireFailure("not-found", `There is no ${kind} with id ${id}.${other === undefined ? "" : ` Id ${id} is a ${other}: use c64_${other}.`}`);
    }
    return point;
  }

  async #breakpoint(params: BreakpointParams): Promise<Breakpoint | PointRemoved | { breakpoints: Breakpoint[] }> {
    const publicView = ({ checkpoint: _checkpoint, expression: _expression, ...point }: Breakpoint & { checkpoint: number; expression?: string }): Breakpoint =>
      point;
    if (params.action === "list") return { breakpoints: [...this.#breakpoints.values()].map(publicView) };
    if (params.action === "remove") return this.#removePoint(this.#breakpoints, "breakpoint", params.id);
    if (params.action !== "add") return publicView(await this.#changePoint(this.#breakpoints, "breakpoint", params));
    // A breakpoint over a range stops at the first instruction executed in it: exec, not a watch.
    const added = await this.#addPoint({
      ...(params.size === undefined ? pointRange({ address: params.address }) : { start: params.address, end: params.address + params.size - 1, operation: 0x04 }),
      space: params.space,
      ...(params.condition === undefined ? {} : { condition: params.condition }),
    });
    const point = {
      id: this.#nextPointId++,
      address: params.address,
      ...(params.size === undefined ? {} : { size: params.size }),
      space: params.space,
      enabled: true,
      ...(params.condition === undefined ? {} : { condition: params.condition }),
      ...added,
    };
    this.#breakpoints.set(point.id, point);
    return publicView(point);
  }

  async #watchpoint(params: WatchpointParams): Promise<Watchpoint | PointRemoved | { watchpoints: Watchpoint[] }> {
    const publicView = ({ checkpoint: _checkpoint, expression: _expression, ...point }: Watchpoint & { checkpoint: number; expression?: string }): Watchpoint =>
      point;
    if (params.action === "list") return { watchpoints: [...this.#watchpoints.values()].map(publicView) };
    if (params.action === "remove") return this.#removePoint(this.#watchpoints, "watchpoint", params.id);
    if (params.action !== "add") return publicView(await this.#changePoint(this.#watchpoints, "watchpoint", params));
    const added = await this.#addPoint({
      ...pointRange({ address: params.address, size: params.size, access: params.access }),
      space: params.space,
      ...(params.condition === undefined ? {} : { condition: params.condition }),
    });
    const point = {
      id: this.#nextPointId++,
      address: params.address,
      size: params.size,
      access: params.access,
      space: params.space,
      enabled: true,
      ...(params.condition === undefined ? {} : { condition: params.condition }),
      ...added,
    };
    this.#watchpoints.set(point.id, point);
    return publicView(point);
  }

  /** VICE turns warp on for an autostart and off when it types RUN. A key in between ends the autostart with no message. */
  async #refuseWhileAutostartLoads(verb: string): Promise<void> {
    if (this.#autostarting && !this.#userWarp && (await this.#observe(() => this.#machine.warp()))) {
      throw new WireFailure(
        "operation-failed",
        `The autostart still loads the program, and a key now stops it before RUN. Run frames with c64_execution advance-frames, then ${verb} again.`,
      );
    }
  }

  /**
   * Presses keys of the keyboard matrix and RESTORE. VICE has no command for
   * that: a snapshot gets the keys in its keyboard module, and RESTORE as a
   * pending NMI, and is restored at the same cycle. Each tap holds its keys
   * for `frames` frames, then waits `frames` frames with all keys up. A
   * breakpoint, watchpoint or JAM ends the taps early, and the machine stays
   * stopped; else it runs again when it ran before. All keys are up at the end.
   */
  async #press(params: ViceOperations["press"]["params"]): Promise<PressResult> {
    this.#refuseBroken("keyboard", "c64_press");
    await this.#refuseWhileAutostartLoads("press the keys");
    if (this.#atResetStop) {
      throw new WireFailure(
        "operation-failed",
        "The CPU stands at the reset stop of c64_reset with run false. The emulator stops answering when keys are pressed here while the disk drive is busy. " +
          "Step one instruction with c64_execution, then press the keys.",
      );
    }
    const running = this.#state === "running";
    await this.#stop();
    await this.#refuseJammed("press");
    let taps = 0;
    for (const tap of params.taps) {
      await this.#setKeys(matrixRows(tap.keys), tap.restore);
      const held = await this.#runFrames(params.frames);
      await this.#setKeys(matrixRows([]), false);
      const end = held.end === "frames" ? await this.#runFrames(params.frames) : held;
      if (end.end !== "frames") {
        this.#stopSpace = end.space;
        return {
          taps,
          state: "stopped",
          stopReason: end.end as PointStopReason,
          pc: end.space === "drive8" ? (await this.#machine.readRegisters("drive8")).pc : end.pc,
          space: end.space,
          ...(end.pointId === undefined ? {} : { pointId: end.pointId }),
        };
      }
      taps++;
    }
    if (running) await this.#resume();
    return { taps, state: this.#state };
  }

  /** Sets the keyboard matrix (`rows`, bit n of row r for column n), and presses RESTORE, in a snapshot restored at the same cycle. */
  async #setKeys(rows: number[], restore: boolean): Promise<void> {
    const file = join(this.#workDir, "press.vsf");
    try {
      await this.#machine.saveSnapshot(file);
      const bytes = readFileSync(file);
      const why = setSnapshotMatrix(bytes, rows) ?? (restore ? pressSnapshotRestore(bytes) : undefined);
      if (why !== undefined) {
        this.#log(`c64_press was used, and this VICE writes snapshots that c64-re-tools does not know: ${why}.`);
        throw new WireFailure("not-implemented", BROKEN_MESSAGES.keyboard);
      }
      writeFileSync(file, bytes);
      await this.#machine.restoreSnapshot(file);
    } finally {
      rmSync(file, { force: true });
    }
    // A restore starts the CPU history of VICE again.
    this.#historySince = await this.#machine.clock();
    if (this.#historyStopped) this.#historyOld = true;
  }

  /**
   * Refuses a tool that a known flaw of this VICE breaks: not-implemented for
   * the caller, without the VICE version, and the flaw on the host console.
   */
  #refuseBroken(feature: ViceFeature, tool: string): void {
    const flaw = this.#broken.get(feature);
    if (flaw === undefined) return;
    this.#log(`${tool} was used, and this VICE does not support it. ${flaw}`);
    throw new WireFailure("not-implemented", BROKEN_MESSAGES[feature]);
  }

  /**
   * Writes transferred bytes into the session directory. VICE reads an
   * attached image from its file, so an image stays until another one
   * replaces it (#replaceStaged).
   */
  #stage(bytes: Buffer, type: string): string {
    this.#staged++;
    const file = join(this.#workDir, `media-${this.#staged}${type === "" ? "" : `.${type}`}`);
    writeFileSync(file, bytes);
    return file;
  }

  /**
   * Records the staged file that VICE took for `kind`, or that it no longer
   * has, and removes the file it replaces: VICE does not read that one again.
   * A file that VICE did not take stays until the session closes, because a
   * held VICE can still read it. So does a file that Windows does not let go.
   */
  #replaceStaged(kind: StagedKind, file: string | undefined): void {
    const previous = this.#stagedFiles.get(kind);
    if (file === undefined) this.#stagedFiles.delete(kind);
    else this.#stagedFiles.set(kind, file);
    if (previous === undefined || previous === file) return;
    try {
      rmSync(previous, { force: true });
    } catch {
      // The session directory goes when the session closes.
    }
  }

  /** Loads a PRG without reset or start; finishes stopped. */
  async #programLoad(params: { address?: number }, bytes: Buffer): Promise<{ state: RunState; loadAddress: number; size: number }> {
    if (bytes.length < 3) throw new WireFailure("invalid-input", "A PRG file needs a two-byte load address and at least one byte of data.");
    const loadAddress = params.address ?? bytes.readUInt16LE(0);
    const size = bytes.length - 2;
    if (loadAddress + size > 0x10000) {
      throw new WireFailure("invalid-input", "The program would run past $ffff at that load address.");
    }
    const file = this.#stage(bytes, "prg");
    await this.#stop();
    const loaded = await this.#machine.loadProgram(file, params.address);
    // VICE read the file during the load.
    rmSync(file, { force: true });
    return { state: "stopped", ...loaded };
  }

  /**
   * The last instructions a CPU executed, oldest first. For the C64 each entry
   * gets the raster position it started at: the cycle distance from the current
   * stop, whose position is known, mapped back through the frame.
   */
  async #cpuHistory(params: { limit: number; space: "c64" | "drive8" }): Promise<{ entries: HistoryEntry[] }> {
    if (params.space === "c64" && this.#historyOld) {
      throw new WireFailure(
        "operation-failed",
        "VICE records no CPU history after a JAM until the next reset, and the CPU ran after the JAM. The history would show old instructions. " +
          "Use c64_reset to record again, or use c64_trace.",
      );
    }
    return this.#observe(async () => {
      const all = await this.#machine.history(params.limit, params.space);
      if (params.space === "drive8") {
        // VICE records a wrong third byte for a 3-byte drive instruction ("JSR $00a6" for 20 a6 d5): the drive memory gives the bytes.
        const memory = await this.#machine.readAll("drive8");
        return { entries: all.map(({ clock: _clock, ...entry }) => driveEntry(entry, memory)) };
      }
      const now = await this.#machine.clock();
      const raw = entriesSince(all, this.#historySince, now);
      const position = await this.#machine.rasterPosition();
      const { lines, cycles } = RASTER[this.#videoStandard];
      const frame = BigInt(lines * cycles);
      const current = BigInt(position.line * cycles + position.cycle);
      const entries = raw.map(({ clock, ...entry }) => {
        const at = Number((((current - (now - clock)) % frame) + frame) % frame);
        return { ...entry, rasterLine: Math.floor(at / cycles), rasterCycle: at % cycles };
      });
      return { entries };
    });
  }

  // Chip reads. Each runs inside an #observe, so several can share one stop.

  async #vicii(): Promise<ViciiState> {
    return decodeVicii(await this.#machine.readIo(0xd000, 0x2f), await this.#machine.readIo(0xdd00, 0x10));
  }

  /** Empty `indexes` means all eight sprites. */
  async #sprites(indexes: number[]): Promise<SpriteState[]> {
    const vic = await this.#machine.readIo(0xd000, 0x2f);
    const cia2 = await this.#machine.readIo(0xdd00, 0x10);
    // Sprite pointers sit in the RAM the VIC-II reads, at the end of screen memory.
    const screen = decodeVicii(vic, cia2).screenAddress;
    const pointers = Buffer.from(await this.#machine.readMemory({ address: screen + 0x3f8, size: 8, space: "c64", view: "ram" }), "hex");
    const wanted = indexes.length === 0 ? [0, 1, 2, 3, 4, 5, 6, 7] : indexes;
    return wanted.map((index) => decodeSprite(index, vic, cia2, pointers));
  }

  async #cias(which: CiaSelection): Promise<CiaState[]> {
    const ids: Array<1 | 2> = which === "both" ? [1, 2] : [Number(which) as 1 | 2];
    const chips = [];
    for (const id of ids) {
      const base = id === 1 ? 0xdc00 : 0xdd00;
      chips.push(decodeCia(id, await this.#machine.readIo(base, 0x10), await this.#machine.ciaHidden(base)));
    }
    return chips;
  }

  async #sid(): Promise<SidState> {
    return decodeSid(await this.#machine.readIo(0xd400, 0x19));
  }

  /** Several observations from one halted moment; the run state is restored afterwards. */
  async #observeAll(params: ObserveParams): Promise<ObserveResult> {
    return this.#observe(async () => {
      const result: ObserveResult = {};
      if (params.registers !== undefined) result.registers = await this.#machine.readRegisters(params.registers);
      if (params.memory !== undefined) {
        result.memory = [];
        for (const range of params.memory) result.memory.push({ address: range.address, data: await this.#machine.readMemory(range) });
      }
      if (params.vicii) result.vicii = await this.#vicii();
      if (params.sprites !== undefined) result.sprites = await this.#sprites(params.sprites);
      if (params.cia !== undefined) result.cia = await this.#cias(params.cia);
      if (params.sid) result.sid = await this.#sid();
      if (params.timing) {
        const position = await this.#machine.rasterPosition();
        result.timing = { rasterLine: position.line, rasterCycle: position.cycle };
      }
      if (params.screen) {
        const shot = await this.#machine.captureFrame(this.#videoStandard);
        result.screen = { width: shot.frame.width, height: shot.frame.height, png: encodePng(shot.frame, shot.palette).toString("base64") };
      }
      return result;
    });
  }

  /** Saves, restores, lists and removes machine snapshots. */
  async #snapshot(params: ViceOperations["snapshot"]["params"]): Promise<ViceOperations["snapshot"]["result"]> {
    if (params.action === "list") return { snapshots: [...this.#snapshots.keys()] };
    const existing = this.#snapshots.get(params.name);
    if (params.action === "save") {
      if (this.#atResetStop) {
        throw new WireFailure(
          "operation-failed",
          "The CPU stands at the reset stop of c64_reset with run false. The emulator stops answering at the restore of a snapshot saved here when the disk drive was busy. " +
            "Step one instruction with c64_execution, then save the snapshot.",
        );
      }
      if (existing === undefined && this.#snapshots.size >= MAX_SNAPSHOTS) {
        throw new WireFailure("limit-exceeded", `A session keeps at most ${MAX_SNAPSHOTS} snapshots. Remove one first with action remove.`);
      }
      const file = existing ?? join(this.#workDir, `snapshot-${++this.#snapshotFiles}.vsf`);
      await this.#observe(() => this.#machine.saveSnapshot(file));
      this.#snapshots.set(params.name, file);
      return { saved: true, name: params.name };
    }
    if (existing === undefined) throw new WireFailure("not-found", `There is no snapshot named ${params.name}.`);
    if (params.action === "remove") {
      rmSync(existing, { force: true });
      this.#snapshots.delete(params.name);
      return { removed: true };
    }
    return this.#restoreFrom(existing);
  }

  /** Restores the machine from a .vsf in the session directory; the CPU stays stopped. */
  async #restoreFrom(file: string): Promise<{ restored: true; state: "stopped" }> {
    await this.#stop();
    const elapsed = (await this.#machine.clock()) - this.#timingStart;
    // The restore replaces the whole machine state, so the reset that stops the autostart leaves no trace.
    if (this.#autostarting) await this.#reset({ mode: "soft", run: false });
    await this.#machine.restoreSnapshot(file);
    this.#historySince = await this.#machine.clock();
    // A restore starts a jammed CPU again, but VICE still records no CPU history.
    this.#jammed = undefined;
    if (this.#historyStopped) this.#historyOld = true;
    this.#state = "stopped";
    // The cycle clock jumped with the restore; the stopwatch keeps its reading, as a window move does.
    this.#timingStart = (await this.#machine.clock()) - elapsed;
    return { restored: true, state: "stopped" };
  }

  /** A snapshot as bytes: export a named one into `reply`, or restore from the attached .vsf. */
  async #snapshotFile(params: ViceOperations["snapshotFile"]["params"], attachments: Buffer[], reply: Buffer[]): Promise<ViceOperations["snapshotFile"]["result"]> {
    if (params.action === "export") {
      const file = this.#snapshots.get(params.name);
      if (file === undefined) throw new WireFailure("not-found", `There is no snapshot named ${params.name}.`);
      const bytes = readFileSync(file);
      reply.push(bytes);
      return { exported: true, bytes: bytes.length };
    }
    const bytes = onlyAttachment(attachments);
    // Checked before the machine stops: VICE gives no reason for a file that is no snapshot.
    if (!hasSignature("vsf", bytes)) throw new WireFailure("invalid-input", "The file is not a VICE snapshot file (.vsf). Give a file that c64_snapshot save wrote.");
    const file = this.#stage(bytes, "vsf");
    // VICE resets the machine after a snapshot file that it cannot read: a backup keeps the state before the restore.
    const backup = join(this.#workDir, "before-restore.vsf");
    await this.#stop();
    await this.#machine.saveSnapshot(backup);
    try {
      return await this.#restoreFrom(file);
    } catch (error) {
      const kept = await this.#restoreFrom(backup).then(
        () => true,
        () => false,
      );
      if (!kept) {
        throw new WireFailure(
          "machine-state-lost",
          "The emulator did not restore this snapshot file, and the machine state from before the restore is lost. A snapshot file restores only in the emulator version and with the machine settings that saved it. Make the snapshot again in this emulator version, and load the program again.",
        );
      }
      if (error instanceof WireFailure) throw error;
      throw new WireFailure(
        "invalid-input",
        "The emulator did not restore this snapshot file. The machine state is as before. A snapshot file restores only in the emulator version and with the machine settings that saved it.",
      );
    } finally {
      rmSync(file, { force: true });
      rmSync(backup, { force: true });
    }
  }

  /**
   * Moves the machine into a VICE of the other mode: a snapshot of this
   * one, restored in a new one, with the user points, joysticks, warp and the
   * stopwatch set again. The snapshot carries the disk in drive 8: VICE saves
   * its data and restores it into the new drive. The image file
   * is never attached on top of a restore: VICE would write the restored disk
   * into that file. The old VICE stays as it was until the new one is ready.
   */
  async #window(mode: ViceMode): Promise<WindowResult> {
    // Already in that mode: done, and VICE is not asked anything.
    if (this.#mode === mode) return { window: mode === "window", state: this.#state, notCarried: [] };
    if (this.#held !== undefined) throw new WireFailure("machine-unavailable", this.#heldWhy);
    if (this.#launch === undefined) throw new WireFailure("operation-failed", "This session cannot start another emulator.");
    const running = this.#state === "running";
    this.#log(mode === "window" ? "moving the machine to a VICE with a window" : "moving the machine back to a headless VICE");
    await this.#stop();
    const handover: Handover = {
      file: join(this.#workDir, mode === "window" ? "window-open.vsf" : "window-close.vsf"),
      running,
      warp: await this.#machine.warp(),
      elapsed: (await this.#machine.clock()) - this.#timingStart,
    };
    await this.#machine.saveSnapshot(handover.file);
    const old = this.#vice;
    try {
      await this.#install(this.#launch, mode, handover);
    } catch (error) {
      if (running && !this.#closed) await this.#resume().catch(() => {});
      throw error;
    }
    await old.stop().catch((error: unknown) => this.#log(`stopping the earlier VICE failed: ${error instanceof Error ? error.message : String(error)}`));
    if (mode === "window") {
      this.#handover = handover;
    } else {
      this.#handover = undefined;
      for (const name of ["window-open.vsf", "window-close.vsf"]) rmSync(join(this.#workDir, name), { force: true });
    }
    if (running) await this.#resume();
    return { window: mode === "window", state: this.#state, notCarried: NOT_CARRIED };
  }

  /**
   * Starts a VICE in `mode` with `launch`, restores `handover` into it and sets the session
   * state again, then makes it the current VICE. On failure the new VICE is
   * stopped, the current one is untouched, and the error says why.
   */
  async #install(launch: ViceLauncher, mode: ViceMode, handover: Handover): Promise<void> {
    if (this.#closed) throw new WireFailure("machine-unavailable", "The emulator session is closed.");
    const output: string[] = [];
    let vice: ViceProcess;
    try {
      vice = await launch(mode, (line) => output.push(line));
    } catch (error) {
      const reasons = startErrorLines(output);
      const what = mode === "window" ? "VICE with a window" : "a headless VICE";
      throw new WireFailure(
        error instanceof WireFailure && error.code === "installation-incomplete" ? "installation-incomplete" : "machine-unavailable",
        `The host could not start ${what}.${reasons.length === 0 ? "" : `\n  ${reasons.join("\n  ")}`}\n` +
          `The machine stays ${this.#mode === "window" ? "in the window" : "headless"}, as it was.`,
      );
    }
    this.#watch(vice);
    try {
      if (this.#closed) throw new WireFailure("machine-unavailable", "The emulator session is closed.");
      const adapter = await ViceAdapter.create(vice.monitor, vice.text);
      await adapter.restoreSnapshot(handover.file);
      const points: Array<[PointRecord, number]> = [];
      for (const point of [...this.#breakpoints.values(), ...this.#watchpoints.values()]) {
        points.push([point, await setPoint(adapter, { ...pointRange(point), space: point.space, enabled: point.enabled, expression: point.expression })]);
      }
      for (const joystick of this.#joysticks.values()) await adapter.setJoystick(joystick);
      await adapter.setWarp(handover.warp);
      await adapter.startProfiler();
      const clock = await adapter.clock();
      if (this.#closed) throw new WireFailure("machine-unavailable", "The emulator session is closed.");
      this.#vice = vice;
      this.#adapter = adapter;
      // A new emulator: no JAM holds its CPU, and it records CPU history.
      this.#clearJam();
      this.#mode = mode;
      for (const [point, checkpoint] of points) point.checkpoint = checkpoint;
      this.#timingStart = clock - handover.elapsed;
      this.#checkpointHits = [];
      this.#state = "stopped";
    } catch (error) {
      await vice.stop().catch(() => {});
      if (error instanceof WireFailure) throw error;
      this.#log(`moving the machine to a new VICE failed: ${error instanceof Error ? error.message : String(error)}\n${vice.outputTail()}`);
      throw new WireFailure(
        "operation-failed",
        `The new emulator did not take the machine state (${error instanceof Error ? error.message : String(error)}). ` +
          `The machine stays ${this.#mode === "window" ? "in the window" : "headless"}, as it was.`,
      );
    }
  }

  /** Compares the current frame with a baseline. */
  async #screenCompare(params: ViceOperations["screenCompare"]["params"]): Promise<ScreenComparison> {
    const baseline = this.#baselines.get(params.baseline);
    if (baseline === undefined) throw new WireFailure("not-found", `There is no baseline named ${params.baseline}.`);
    const current = await this.#observe(() => this.#machine.captureFrame(this.#videoStandard));
    const difference = compareFrames(baseline.frame, current.frame, params.mask);
    if (difference.comparedPixels === 0) throw new WireFailure("invalid-input", "The mask covers the whole screen: nothing to compare.");
    const mismatchRatio = difference.mismatchingPixels / difference.comparedPixels;
    const result: ScreenComparison = {
      match: mismatchRatio <= params.maxMismatchRatio,
      mismatchingPixels: difference.mismatchingPixels,
      comparedPixels: difference.comparedPixels,
      mismatchRatio,
    };
    if (difference.bounds !== undefined) result.bounds = difference.bounds;
    if (params.includeDiff) {
      const image = differenceImage(current.frame, difference, current.palette);
      result.diffPng = encodePng(image.frame, image.palette).toString("base64");
    }
    return result;
  }

  /** Compares two memory ranges from one coherent stop, in any spaces and views. */
  async #memoryCompare(params: ViceOperations["memoryCompare"]["params"]): Promise<ViceOperations["memoryCompare"]["result"]> {
    const [left, right] = await this.#observe(async (): Promise<[Buffer, Buffer]> => [
      Buffer.from(await this.#machine.readMemory({ ...params.left, size: params.size }), "hex"),
      Buffer.from(await this.#machine.readMemory({ ...params.right, size: params.size }), "hex"),
    ]);
    const firstDifferences: Array<{ offset: number; left: number; right: number }> = [];
    let differentBytes = 0;
    for (let offset = 0; offset < params.size; offset++) {
      if (left[offset] === right[offset]) continue;
      differentBytes++;
      if (firstDifferences.length < MAX_COMPARE_DIFFERENCES) firstDifferences.push({ offset, left: left[offset]!, right: right[offset]! });
    }
    return { equal: differentBytes === 0, differentBytes, firstDifferences };
  }

  /** Direct CPU-state writes need a stopped CPU; they never pause it themselves. */
  #requireStopped(): void {
    if (this.#state === "running") {
      throw new WireFailure("machine-running", "The CPU is running. Stop it with c64_execution action pause first.");
    }
  }

  /** The C64 program counter; the machine must be stopped. */
  async #pc(): Promise<number> {
    return (await this.#machine.readRegisters("c64")).pc;
  }

  async #stop(): Promise<void> {
    if (this.#state === "running") await this.#machine.stop();
    this.#state = "stopped";
  }

  async #resume(): Promise<void> {
    await this.#resumingCommand(() => this.#machine.resume());
  }

  /**
   * Sends a command that makes VICE run the machine. The state is set first:
   * VICE's answer and the events after it (resumed, then maybe a stop) can
   * arrive together, and those events must have the last word.
   */
  async #resumingCommand(send: () => Promise<void>): Promise<void> {
    this.#atResetStop = false;
    this.#stopSpace = "c64";
    this.#state = "running";
    this.#lastStop = undefined;
    try {
      await send();
    } catch (error) {
      this.#state = "stopped";
      throw error;
    }
  }

  /**
   * Sends a command after which VICE leaves the monitor by itself (autostart,
   * reset). VICE sometimes stays in the monitor instead (after an autostart,
   * and under load also after a reset), and when it was in the
   * monitor already no event shows that. So the machine is made to run: a
   * ping stops it or finds it stopped, and an exit resumes it, unless a
   * checkpoint or a JAM stopped it in between.
   */
  async #runningCommand(send: () => Promise<void>): Promise<void> {
    const halts = this.#haltCount;
    await this.#resumingCommand(send);
    await this.#machine.stop();
    if (this.#haltCount === halts) await this.#resume();
  }

  /**
   * Resolves with the next stop, or undefined after `timeoutMs`.
   * With `checkpoint`, only a stop caused by that VICE checkpoint counts.
   */
  #nextStop(timeoutMs: number, checkpoint?: number): Promise<Stop | undefined> {
    return new Promise((resolve) => {
      const waiter = (stop: Stop) => {
        if (checkpoint !== undefined && !stop.hits.includes(checkpoint)) return false;
        clearTimeout(timer);
        resolve(stop);
        return true;
      };
      const timer = setTimeout(() => {
        this.#stopWaiters = this.#stopWaiters.filter((candidate) => candidate !== waiter);
        resolve(undefined);
      }, timeoutMs);
      this.#stopWaiters.push(waiter);
    });
  }

  /**
   * Runs monitor work that must not change the run state. Any monitor
   * command stops the machine, so a machine that was running is resumed.
   */
  async #observe<T>(work: () => Promise<T>): Promise<T> {
    const wasRunning = this.#state === "running";
    const halts = this.#haltCount;
    // A breakpoint or JAM that stopped the machine while this work ran must
    // stay stopped: the machine was not running when VICE took the command.
    // The tracked state is no guide here: a text command's stop is reported on
    // the binary connection and may not have been read yet.
    const shouldResume = () => wasRunning && this.#haltCount === halts;
    // VICE answers binary commands in order, so a ping's answer means every
    // earlier binary event (a checkpoint hit, a stop) has been read.
    const settle = async () => {
      if (wasRunning) await this.#machine.stop();
    };
    let result: T;
    try {
      result = await work();
    } catch (error) {
      // A refused read must not leave a running machine stopped either. After
      // a timeout nothing more is sent: VICE is held, and #recover restores it.
      if (wasRunning && !this.#lost && !isTimeout(error)) {
        await settle()
          .then(() => (shouldResume() ? this.#resume() : undefined))
          .catch(() => {});
      }
      throw error;
    }
    await settle();
    // A drive checkpoint that stopped the machine meanwhile keeps it stopped:
    // complete that stop, so the computer's registers read afterwards are at an instruction boundary.
    if (wasRunning) await this.#completeDriveStop();
    if (shouldResume()) await this.#resume();
    return result;
  }

  /** Serializes all VICE work for this session. `whileHeld` work checks a held VICE itself. */
  #enqueue<T>(work: () => Promise<T>, options: { whileHeld?: boolean } = {}): Promise<T> {
    const run = this.#queue.then(async () => {
      if (this.#closed) throw new WireFailure("machine-unavailable", "The emulator session is closed.");
      if (this.#lost) throw new WireFailure("machine-state-lost", STATE_LOST);
      if (this.#windowClosing) throw new WireFailure("machine-unavailable", WINDOW_CLOSING);
      const notice = this.#notice;
      this.#notice = undefined;
      if (notice !== undefined) throw notice;
      // Nothing is sent to a held VICE: each command would wait there and run later.
      if (this.#held !== undefined && options.whileHeld !== true) throw new WireFailure("machine-unavailable", this.#heldWhy);
      const runningBefore = this.#state === "running";
      const halts = this.#haltCount;
      try {
        if (this.#held === undefined) await this.#completeDriveStop();
        return await work();
      } catch (error) {
        throw await this.#translate(error, runningBefore, halts);
      }
    });
    this.#queue = run.catch(() => {});
    return run;
  }

  async #translate(error: unknown, runningBefore: boolean, halts: number): Promise<unknown> {
    if (error instanceof WireFailure) return error;
    // A refusal of a shared module (for example the media check) goes on the wire as the host's own.
    if (isRefusal(error)) return new WireFailure(error.code, error.message);
    if (this.#closed) return new WireFailure("machine-unavailable", "The emulator session is closed.");
    if (error instanceof MonitorConnectionError || error instanceof TextMonitorError || error instanceof StepTimeout) {
      this.#log(error.message);
      // A broken connection usually means VICE died; give its exit a moment to land.
      if (!this.#lost && !this.#windowClosing) await Promise.race([this.#vice.exited, sleep(CRASH_SETTLE_MS)]);
      if (this.#lost) return new WireFailure("machine-state-lost", STATE_LOST);
      if (this.#windowClosing) return new WireFailure("machine-unavailable", WINDOW_CLOSING);
      if (isTimeout(error)) {
        // VICE's own log can tell why it did not answer.
        const tail = this.#vice.outputTail().split("\n").slice(-10).join("\n  ");
        if (tail.trim() !== "") this.#log(`VICE log after the monitor timeout:\n  ${tail}`);
        if (this.#held === undefined) {
          this.#heldWhy = error instanceof StepTimeout ? error.why : this.#mode === "window" ? VICE_HELD : VICE_HELD_HEADLESS;
        }
        this.#recover(runningBefore, halts);
        return new WireFailure("machine-unavailable", this.#heldWhy);
      }
      return new WireFailure("machine-unavailable", "The emulator did not answer in time.");
    }
    if (error instanceof MonitorError) {
      this.#log(error.message);
      if (error.errorCode === 0x02) return new WireFailure("unsupported-in-space", "The emulator does not support that memory space.");
      return new WireFailure("operation-failed", "The emulator refused the operation.");
    }
    return error;
  }

  /**
   * VICE runs but took no command in time: its own pause or a dialog holds
   * it. The commands already sent wait in VICE and run once it goes on, and
   * the last of them leaves the machine stopped. So: wait, with no time limit,
   * until VICE answers a ping (behind every binary command) and a text command
   * (behind every text command); then put the machine back as it was before
   * the operation that timed out. A breakpoint that hit meanwhile keeps it
   * stopped. Operations fail at once until then and send nothing.
   */
  #recover(runningBefore: boolean, halts: number): void {
    if (this.#held !== undefined) return;
    this.#log("VICE takes no commands (paused in its window, a dialog is open, or a step does not end); waiting until it goes on");
    const why = (error: unknown) => (error instanceof Error ? error.message : String(error));
    this.#held = (async () => {
      try {
        try {
          await this.#machine.answered();
          await this.#machine.drainText();
        } catch (error) {
          if (!this.#closed) this.#log(`VICE did not come back: ${why(error)}`);
        }
        if (this.#closed || this.#lost) return;
        // The ping that answered stopped the machine; put back the run state of before the operation.
        this.#state = "stopped";
        if (runningBefore && this.#haltCount === halts) await this.#resume();
        this.#log(`VICE takes commands again; the machine is ${this.#state} as before`);
      } catch (error) {
        if (!this.#closed) this.#log(`restoring the run state failed: ${why(error)}`);
      } finally {
        this.#held = undefined;
      }
    })();
  }

  #onEvent(event: MonitorResponse): void {
    // VICE reports each hit checkpoint (byte 4 set) just before the stop it causes.
    if (event.type === ResponseType.checkpointInfo && event.body[4] !== 0) this.#checkpointHits.push(event.body.readUInt32LE(0));
    if (event.type === ResponseType.stopped || event.type === ResponseType.jam) {
      const stop: Stop = { pc: decodeProgramCounter(event.body), hits: this.#checkpointHits };
      if (stop.hits.length > 0 || event.type === ResponseType.jam) this.#haltCount++;
      if (stop.hits.some((hit) => this.#adapter?.isDriveCheckpoint(hit))) this.#driveStop = true;
      this.#lastStop = event.type === ResponseType.jam ? { stopReason: "jam" } : this.#userPoint(stop.hits);
      if (event.type === ResponseType.jam) this.#jam(stop.pc);
      this.#checkpointHits = [];
      this.#state = "stopped";
      this.#stopWaiters = this.#stopWaiters.filter((waiter) => !waiter(stop));
    } else if (event.type === ResponseType.resumed) {
      this.#lastStop = undefined;
      this.#state = "running";
    }
  }
}

/** A drive history entry with its bytes and text from drive memory, when the opcode there is still the one that ran. */
export function driveEntry<T extends { address: number; bytes: string; text: string }>(entry: T, memory: Uint8Array): T {
  const opcode = Number.parseInt(entry.bytes.slice(0, 2), 16);
  if (memory[entry.address] !== opcode) return entry;
  const length = instructionLength(opcode);
  const bytes = Array.from({ length }, (_, offset) => memory[(entry.address + offset) & 0xffff]!);
  return { ...entry, bytes: Buffer.from(bytes).toString("hex"), text: instructionText(bytes, entry.address) };
}

/**
 * The history entries (oldest first) that the CPU executed after a restore at
 * clock `since`, with the clock at `now`: the last entries, back to the first
 * one outside since to now or the first one whose clock does not go up to the
 * next. The others are of before the restore.
 */
export function entriesSince<T extends { clock: bigint }>(entries: readonly T[], since: bigint | undefined, now: bigint): T[] {
  if (since === undefined) return [...entries];
  let first = entries.length;
  while (first > 0) {
    const entry = entries[first - 1]!;
    if (entry.clock < since || entry.clock > now || (first < entries.length && entry.clock >= entries[first]!.clock)) break;
    first--;
  }
  return entries.slice(first);
}

/** The one attachment of an operation that takes a file (see attachmentCount); refuses any other count. */
function onlyAttachment(attachments: Buffer[]): Buffer {
  const [bytes] = attachments;
  if (bytes === undefined || attachments.length !== 1) throw new WireFailure("invalid-input", "The operation needs exactly one file attachment.");
  return bytes;
}

/** The VICE checkpoint range and operation of a breakpoint (no size) or a watchpoint. */
function pointRange(point: { address: number; size?: number; access?: Watchpoint["access"] }): { start: number; end: number; operation: number } {
  if (point.size === undefined) return { start: point.address, end: point.address, operation: 0x04 }; // exec
  const operation = point.access === "read" ? 0x01 : point.access === "write" ? 0x02 : 0x03;
  return { start: point.address, end: point.address + point.size - 1, operation };
}

/** Sets a user checkpoint with its condition; removes it again if the condition is refused. */
async function setPoint(
  machine: ViceAdapter,
  options: { start: number; end: number; operation: number; space: "c64" | "drive8"; enabled: boolean; expression: string | undefined },
): Promise<number> {
  const checkpoint = await machine.addCheckpoint(options);
  if (options.expression !== undefined) {
    try {
      await machine.setCondition(checkpoint, options.expression);
    } catch (error) {
      await machine.deleteCheckpoint(checkpoint).catch(() => {});
      throw error;
    }
  }
  return checkpoint;
}

/**
 * Refuses an autostart index that selects no program: VICE numbers the
 * entries from 1, and the caller from 0, as the c64-disk directory list does.
 * A DEL entry holds no program, and an index past the last entry selects nothing.
 */
function checkDirectoryEntry(entries: DiskFile[], index: number): void {
  const entry = entries[index - 1];
  if (entry === undefined) throw new WireFailure("invalid-input", `The disk has ${entries.length} directory entries, so index ${index - 1} selects no entry. List the directory of the disk to get the index of each entry.`);
  if (entry.type === "del") throw new WireFailure("invalid-input", `Directory entry ${index - 1} (${entry.name}) is a DEL entry and holds no program. Give the index of a PRG entry.`);
}

/** The production factory: launch a headless VICE per session through the host's supervisor. */
export function viceSessionFactory(options: {
  supervisor: ProcessSupervisor;
  env?: NodeJS.ProcessEnv;
  log?: (line: string) => void;
  /** The known flaws of the VICE version that the host checked at start. */
  flaws?: readonly ViceFlaw[];
  directory?: DiskDirectory;
}): ViceSessionFactory {
  return async ({ videoStandard, log = options.log ?? (() => {}) }) => {
    const launch: ViceLauncher = (mode, launchLog) =>
      launchVice({
        videoStandard,
        mode,
        supervisor: options.supervisor,
        log: (line) => {
          log(line);
          launchLog(line);
        },
        ...(options.env === undefined ? {} : { env: options.env }),
      });
    const vice = await launch("headless", () => {});
    return ViceSession.start(vice, videoStandard, log, {
      launch,
      ownPath: (path) => options.supervisor.ownPath(path),
      ...(options.flaws === undefined ? {} : { flaws: options.flaws }),
      ...(options.directory === undefined ? {} : { directory: options.directory }),
    });
  };
}
