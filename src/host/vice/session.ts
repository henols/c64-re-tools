// The per-emulator session: one VICE at a time, one serialized operation
// queue, the machine's run state, and what happens when VICE dies. The
// session starts headless and can move the machine into a VICE with a window
// and back (D20); breakpoints, watchpoints and the rest go along.

import {
  MAX_BASELINES,
  MAX_SNAPSHOTS,
  MAX_COMPARE_DIFFERENCES,
  RASTER,
  WireFailure,
  type Breakpoint,
  type BreakpointParams,
  type Condition,
  type ExecutionParams,
  type HistoryEntry,
  type RunTarget,
  type RunUntilResult,
  type ScreenComparison,
  type CiaSelection,
  type CiaState,
  type ObserveParams,
  type ObserveResult,
  type SidState,
  type SpriteState,
  type ViciiState,
  type JoystickState,
  type Watchpoint,
  type WatchpointParams,
  type ExecutionResult,
  type MachineStatus,
  type RunState,
  type VideoStandard,
  type ViceOperation,
  type ViceOperations,
  type WindowResult,
} from "../../protocol.ts";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ProcessSupervisor } from "../../native/processes.ts";
import type { ViceSessionFactory, ViceSessionHandle } from "../server.ts";
import {
  backtraceFromStack,
  conditionExpression,
  inRasterWindow,
  JAM_OPCODES,
  rasterLinesExpression,
  rasterWindowExpression,
  ViceAdapter,
} from "./adapter.ts";
import { decodeProgramCounter, MonitorConnectionError, MonitorError, MonitorTimeoutError, ResponseType, type MonitorResponse } from "./binary-monitor.ts";
import { decodeCia, decodeSid, decodeSprite, decodeVicii } from "./chips.ts";
import { compareFrames, differenceImage, encodePng, type IndexedFrame } from "./screen.ts";
import { launchVice, startErrorLines, type ViceMode, type ViceProcess } from "./process.ts";
import { TextMonitorError, TextMonitorTimeoutError } from "./text-monitor.ts";

const CRASH_SETTLE_MS = 500;
/** How long until-return may run before the session stops it and reports the limit. */
export const UNTIL_RETURN_LIMIT_MS = 30_000;
/** How long a reset may take to reach the reset vector. */
const RESET_STOP_LIMIT_MS = 5_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const STATE_LOST =
  "The emulator stopped unexpectedly and its machine state is lost. Restart the c64-re-tools MCP server to get a fresh C64.";

const VICE_HELD =
  "The emulator does not take commands now: it is paused in its window (Pause, Alt+P) or a dialog in its window waits for an answer. " +
  "Resume it or close the dialog in the VICE window, then try again. The machine is kept as it was.";

const WINDOW_CLOSING =
  "The VICE window closed. The session starts a headless emulator again from the machine state of when the window opened. Try again in a few seconds.";

const WINDOW_CLOSED =
  "The VICE window closed before c64_window close (the user closed it, or that emulator stopped). " +
  "The machine is headless again, in the state it had when the window opened; what changed in the window is lost. " +
  "Breakpoints and watchpoints are kept. Check the machine state before you continue.";

/** Emulator state that a move to another VICE cannot carry (D20). */
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
  return error instanceof MonitorTimeoutError || error instanceof TextMonitorTimeoutError;
}

function hex(value: number): string {
  return `$${value.toString(16).padStart(4, "0")}`;
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
  /** Starts another VICE, for c64_window (D20). Without it the session cannot open a window. */
  launch?: ViceLauncher;
  /** Makes the host remove a path if it dies; returns the release. */
  ownPath?: (path: string) => () => void;
}

export class ViceSession implements ViceSessionHandle {
  /** The current VICE. A window move replaces it (D20). */
  #vice: ViceProcess;
  /** The mode of the current VICE. */
  #mode: ViceMode = "headless";
  readonly #videoStandard: VideoStandard;
  readonly #log: (line: string) => void;
  readonly #untilReturnLimitMs: number;
  readonly #launch: ViceLauncher | undefined;
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
   * and the next frame count ends one frame short (found live). The session
   * completes such a stop before its next command (#completeDriveStop).
   */
  #driveStop = false;
  /** Counts stops caused by checkpoints or a CPU JAM rather than by a monitor command. */
  #haltCount = 0;
  #queue: Promise<unknown> = Promise.resolve();
  #closed = false;
  #lost = false;
  /** Set while VICE takes no commands (its own pause, a dialog); settles when it is restored (#recover). */
  #held: Promise<void> | undefined;
  /** Session-local snapshots by name, as files in the session directory (15 §36). */
  readonly #snapshots = new Map<string, string>();
  #snapshotFiles = 0;
  /** Session-local screen baselines (15 §29), lost with the session. */
  readonly #baselines = new Map<string, { frame: IndexedFrame; palette: Array<[number, number, number]> }>();
  /** The CPU clock when the session stopwatch last started (c64_timing). */
  #timingStart = 0n;
  /** Counts staged media files, for unique names. */
  #staged = 0;
  /** Session-local ids: one counter for breakpoints and watchpoints, from 1. */
  #nextPointId = 1;
  /**
   * User breakpoints and watchpoints by session id, with their VICE checkpoint
   * numbers and condition expressions: a window move sets them again (D20).
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
    this.#launch = options.launch;
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
   * VICE goes back headless from the state of when the window opened (D20);
   * any other loss is final (D11).
   */
  #ended(vice: ViceProcess, why: string): void {
    if (this.#closed || this.#vice !== vice || this.#lost || this.#windowClosing) return;
    this.#log(why);
    if (this.#mode === "window" && this.#handover !== undefined && this.#launch !== undefined) {
      this.#windowClosing = true;
      const handover = this.#handover;
      const run = this.#queue.then(() => this.#backToHeadless(vice, handover));
      this.#queue = run.catch(() => {});
      return;
    }
    this.#lost = true;
  }

  /** Restarts headless from the handover saved when the window opened. */
  async #backToHeadless(dead: ViceProcess, handover: Handover): Promise<void> {
    try {
      await dead.stop();
      if (this.#closed) return;
      await this.#install("headless", handover);
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
          // The control-port lines start all pressed; release them before the C64 reads them.
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
  ): Promise<ViceOperations[O]["result"]> {
    // A window request for the mode the session is in sends nothing to VICE, so a held VICE does not stop it.
    return this.#enqueue(() => this.#run(op, params, attachments), { whileHeld: op === "window" }) as Promise<ViceOperations[O]["result"]>;
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

  async #run(op: ViceOperation, params: unknown, attachments: Buffer[]): Promise<unknown> {
    switch (op) {
      case "status":
        return this.#status();
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
        return this.#programLoad(params as ViceOperations["programLoad"]["params"], attachments[0]!);
      case "autostart": {
        const { type, index, run } = params as ViceOperations["autostart"]["params"];
        const file = this.#stage(attachments[0]!, type);
        await this.#runningCommand(() => this.#machine.autostart(file, index, run));
        return { state: "running" };
      }
      case "diskAttach": {
        const { type } = params as ViceOperations["diskAttach"]["params"];
        const file = this.#stage(attachments[0]!, type);
        await this.#observe(() => this.#machine.attachDisk(file));
        return { attached: true };
      }
      case "reset":
        return this.#reset(params as ViceOperations["reset"]["params"]);
      case "keyboard": {
        const bytes = Buffer.from((params as ViceOperations["keyboard"]["params"]).data, "hex");
        await this.#observe(() => this.#machine.feedKeyboard(bytes));
        return { queuedBytes: bytes.length };
      }
      case "breakpoint":
        return this.#breakpoint(params as BreakpointParams);
      case "watchpoint":
        return this.#watchpoint(params as WatchpointParams);
      case "screenCapture": {
        const { baseline } = params as ViceOperations["screenCapture"]["params"];
        if (baseline !== undefined && !this.#baselines.has(baseline) && this.#baselines.size >= MAX_BASELINES) {
          throw new WireFailure("limit-exceeded", `A session keeps at most ${MAX_BASELINES} baselines. Discard one first.`);
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
        return { discarded: true };
      }
      case "snapshot":
        return this.#snapshot(params as ViceOperations["snapshot"]["params"]);
      case "cpuHistory":
        return this.#cpuHistory(params as ViceOperations["cpuHistory"]["params"]);
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
        const { limit } = params as ViceOperations["profile"]["params"];
        return { entries: await this.#observe(() => this.#machine.profile(limit)) };
      }
      case "memmap": {
        const request = params as ViceOperations["memmap"]["params"];
        if (request.action === "clear") {
          await this.#observe(() => this.#machine.clearMemmap());
          return { cleared: true };
        }
        return { ranges: await this.#observe(() => this.#machine.memmap(request.start, request.end, request.maxRanges)) };
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
        const joystick = params as JoystickState;
        await this.#observe(() => this.#machine.setJoystick(joystick));
        this.#joysticks.set(joystick.port, joystick);
        return joystick;
      }
      case "warp": {
        const { enabled } = params as ViceOperations["warp"]["params"];
        await this.#observe(() => this.#machine.setWarp(enabled));
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
    const status: MachineStatus = { state: this.#state, videoStandard: this.#videoStandard, warp, window: this.#mode === "window" };
    if (status.state === "stopped") status.pc = await this.#pc();
    return status;
  }

  async #execution(params: ExecutionParams): Promise<ExecutionResult> {
    if (params.action === "resume") {
      if (this.#state === "stopped") await this.#resume();
      return { state: "running" };
    }
    if (params.action === "pause") {
      await this.#stop();
      return { state: "stopped", pc: await this.#pc() };
    }
    if (params.space === "drive8") {
      // Stock VICE runs the 1541 CPU in batches that catch up with the computer's clock;
      // neither monitor can stop it after exactly one of its instructions (tested live).
      throw new WireFailure(
        "unsupported-in-space",
        `${params.action} works only in space c64: the emulator cannot stop the disk drive CPU after a single instruction. ` +
          "Use a breakpoint or run-until with an address in space drive8: it stops when the drive executes that address, " +
          "and the drive can run a few instructions more before it stops.",
      );
    }
    await this.#stop();
    if (params.action === "until-return") {
      const stopped = this.#nextStop(this.#untilReturnLimitMs);
      await this.#resumingCommand(() => this.#machine.untilReturn());
      const stop = await stopped;
      if (stop === undefined) {
        await this.#stop();
        throw new WireFailure(
          "limit-exceeded",
          `The routine did not return within ${this.#untilReturnLimitMs / 1000} seconds. The machine is stopped at ${hex(await this.#pc())}.`,
        );
      }
      return { state: "stopped", pc: stop.pc };
    }
    if (params.action === "advance-frames") {
      const outcome = await this.#runFrames(params.count!);
      return { state: "stopped", pc: outcome.pc, advancedFrames: outcome.frames };
    }
    const count = params.count ?? 1;
    await this.#machine.step(count, params.action === "next");
    // VICE answers a step only after the machine stopped again.
    this.#state = "stopped";
    return { state: "stopped", pc: await this.#pc(), executed: count };
  }

  async #reset(params: { mode: "soft" | "hard"; run: boolean }): Promise<{ state: RunState; pc?: number }> {
    await this.#stop();
    if (params.run) {
      await this.#runningCommand(() => this.#machine.reset(params.mode));
      return { state: "running" };
    }
    // A breakpoint on the reset vector stops the reset at its first instruction.
    // VICE does not check a breakpoint at the PC it resumes from, and a reset
    // sent from the monitor resumes at the vector; so the reset is sent while
    // running, and only a stop caused by this breakpoint counts.
    const vector = await this.#machine.resetVector();
    const checkpoint = await this.#machine.addBreak(vector);
    await this.#resume();
    const stopped = this.#nextStop(RESET_STOP_LIMIT_MS, checkpoint);
    await this.#resumingCommand(() => this.#machine.reset(params.mode));
    const reached = (await stopped) !== undefined;
    if (!reached) await this.#stop();
    await this.#machine.deleteCheckpoint(checkpoint);
    if (!reached) throw new WireFailure("operation-failed", "The C64 did not reach its reset vector after the reset.");
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
  async #runFrames(limit: number, target?: { checkpoint: number; deferred: boolean }): Promise<{ end: RunEnd; frames: number; pc: number }> {
    await this.#stop();
    const lines = RASTER[this.#videoStandard].lines;
    const start = await this.#machine.rasterPosition();
    const arming = rasterLinesExpression((start.line + Math.floor(lines / 2)) % lines, lines);
    const ending = rasterWindowExpression(start.line, start.cycle, lines);
    const clock = await this.#machine.addCheckpoint({ start: 0x0000, end: 0xffff, operation: 0x04, space: "c64" });
    try {
      await this.#machine.setCondition(clock, arming);
      let armingPhase = true;
      let frames = 0;
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
          if (armingPhase) {
            await this.#machine.setCondition(clock, ending);
            if (target?.deferred) {
              await this.#machine.toggleCheckpoint(target.checkpoint, true);
              target.deferred = false;
            }
          } else {
            frames++;
            if (frames >= limit) return { end: "frames", frames, pc: stop.pc };
            await this.#machine.setCondition(clock, arming);
          }
          armingPhase = !armingPhase;
          continue;
        }
        if (end === "unknown") {
          if (await this.#jammedAt(stop.pc)) return { end: "jam", frames, pc: stop.pc };
          throw new WireFailure("operation-failed", "The emulator stopped the machine for a reason outside this run.");
        }
        // A drive stop is completed before the result names the computer's pc.
        return { end, frames, pc: (await this.#completeDriveStop()) ?? stop.pc };
      }
    } finally {
      await this.#machine.deleteCheckpoint(clock);
    }
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
    const isPoint = (registry: Map<number, { checkpoint: number }>) =>
      [...registry.values()].some((point) => stop.hits.includes(point.checkpoint));
    if (isPoint(this.#breakpoints)) return "breakpoint";
    if (isPoint(this.#watchpoints)) return "watchpoint";
    if (stop.hits.includes(clock)) return "clock";
    return "unknown";
  }

  async #jammedAt(pc: number): Promise<boolean> {
    const opcode = await this.#machine.readMemory({ address: pc, size: 1, space: "c64", view: "cpu" });
    return JAM_OPCODES.has(Number.parseInt(opcode, 16));
  }

  /** Runs until a target is reached or `timeoutFrames` frames pass (15 §11). */
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
        // A store checkpoint whose condition reads memory after the write (live-tested).
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
      // A stop event carries the computer's PC; a drive target reports the drive's.
      const pc = target.kind !== "raster" && target.space === "drive8" ? (await this.#machine.readRegisters("drive8")).pc : outcome.pc;
      return { reached: stopReason === "target", stopReason, state: "stopped", pc };
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
    params: { action: "remove" | "enable" | "disable"; id: number },
  ): Promise<T> {
    const point = registry.get(params.id);
    if (point === undefined) throw new WireFailure("not-found", `There is no ${kind} with id ${params.id}.`);
    if (params.action === "remove") {
      await this.#observe(() => this.#machine.deleteCheckpoint(point.checkpoint));
      registry.delete(params.id);
    } else {
      const enabled = params.action === "enable";
      await this.#observe(() => this.#machine.toggleCheckpoint(point.checkpoint, enabled));
      point.enabled = enabled;
    }
    return point;
  }

  async #breakpoint(params: BreakpointParams): Promise<Breakpoint | { breakpoints: Breakpoint[] }> {
    const publicView = ({ checkpoint: _checkpoint, expression: _expression, ...point }: Breakpoint & { checkpoint: number; expression?: string }): Breakpoint =>
      point;
    if (params.action === "list") return { breakpoints: [...this.#breakpoints.values()].map(publicView) };
    if (params.action !== "add") return publicView(await this.#changePoint(this.#breakpoints, "breakpoint", params));
    const added = await this.#addPoint({
      ...pointRange({ address: params.address }),
      space: params.space,
      ...(params.condition === undefined ? {} : { condition: params.condition }),
    });
    const point = {
      id: this.#nextPointId++,
      address: params.address,
      space: params.space,
      enabled: true,
      ...(params.condition === undefined ? {} : { condition: params.condition }),
      ...added,
    };
    this.#breakpoints.set(point.id, point);
    return publicView(point);
  }

  async #watchpoint(params: WatchpointParams): Promise<Watchpoint | { watchpoints: Watchpoint[] }> {
    const publicView = ({ checkpoint: _checkpoint, expression: _expression, ...point }: Watchpoint & { checkpoint: number; expression?: string }): Watchpoint =>
      point;
    if (params.action === "list") return { watchpoints: [...this.#watchpoints.values()].map(publicView) };
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

  /**
   * Writes transferred bytes into the session directory. Media stay there for
   * the session: VICE reads an attached image from its file.
   */
  #stage(bytes: Buffer, type: string): string {
    this.#staged++;
    const file = join(this.#workDir, `media-${this.#staged}${type === "" ? "" : `.${type}`}`);
    writeFileSync(file, bytes);
    return file;
  }

  /** Loads a PRG without reset or start (15 §34); finishes stopped. */
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
    return { state: "stopped", ...loaded };
  }

  /**
   * The last instructions a CPU executed, oldest first. For the C64 each entry
   * gets the raster position it started at: the cycle distance from the current
   * stop, whose position is known, mapped back through the frame.
   */
  async #cpuHistory(params: { limit: number; space: "c64" | "drive8" }): Promise<{ entries: HistoryEntry[] }> {
    return this.#observe(async () => {
      const raw = await this.#machine.history(params.limit, params.space);
      if (params.space === "drive8") return { entries: raw.map(({ clock: _clock, ...entry }) => entry) };
      const now = await this.#machine.clock();
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
    for (const id of ids) chips.push(decodeCia(id, await this.#machine.readIo(id === 1 ? 0xdc00 : 0xdd00, 0x10)));
    return chips;
  }

  async #sid(): Promise<SidState> {
    return decodeSid(await this.#machine.readIo(0xd400, 0x19));
  }

  /** Several observations from one halted moment (15 §30); the run state is restored afterwards. */
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

  /** Saves, restores, lists and discards machine snapshots (15 §36). */
  async #snapshot(params: ViceOperations["snapshot"]["params"]): Promise<ViceOperations["snapshot"]["result"]> {
    if (params.action === "list") return { snapshots: [...this.#snapshots.keys()] };
    const existing = this.#snapshots.get(params.name);
    if (params.action === "save") {
      if (existing === undefined && this.#snapshots.size >= MAX_SNAPSHOTS) {
        throw new WireFailure("limit-exceeded", `A session keeps at most ${MAX_SNAPSHOTS} snapshots. Discard one first.`);
      }
      const file = existing ?? join(this.#workDir, `snapshot-${++this.#snapshotFiles}.vsf`);
      await this.#observe(() => this.#machine.saveSnapshot(file));
      this.#snapshots.set(params.name, file);
      return { saved: true, name: params.name };
    }
    if (existing === undefined) throw new WireFailure("not-found", `There is no snapshot named ${params.name}.`);
    if (params.action === "discard") {
      rmSync(existing, { force: true });
      this.#snapshots.delete(params.name);
      return { discarded: true };
    }
    await this.#stop();
    await this.#machine.restoreSnapshot(existing);
    this.#state = "stopped";
    // The cycle clock jumped with the restore; the stopwatch starts again here.
    this.#timingStart = await this.#machine.clock();
    return { restored: true, state: "stopped" };
  }

  /**
   * Moves the machine into a VICE of the other mode (D20): a snapshot of this
   * one, restored in a new one, with the user points, joysticks, warp and the
   * stopwatch set again. The snapshot carries the disk in drive 8: VICE saves
   * its data and restores it into the new drive (live-tested). The image file
   * is never attached on top of a restore: VICE would write the restored disk
   * into that file. The old VICE stays as it was until the new one is ready.
   */
  async #window(mode: ViceMode): Promise<WindowResult> {
    // Already in that mode: done, and VICE is not asked anything.
    if (this.#mode === mode) return { window: mode === "window", state: this.#state, notCarried: [] };
    if (this.#held !== undefined) throw new WireFailure("machine-unavailable", VICE_HELD);
    if (this.#launch === undefined) throw new WireFailure("operation-failed", "This session cannot start another emulator.");
    const running = this.#state === "running";
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
      await this.#install(mode, handover);
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
   * Starts a VICE in `mode`, restores `handover` into it and sets the session
   * state again, then makes it the current VICE. On failure the new VICE is
   * stopped, the current one is untouched, and the error says why.
   */
  async #install(mode: ViceMode, handover: Handover): Promise<void> {
    if (this.#closed) throw new WireFailure("machine-unavailable", "The emulator session is closed.");
    const output: string[] = [];
    let vice: ViceProcess;
    try {
      vice = await this.#launch!(mode, (line) => output.push(line));
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

  /** Compares the current frame with a baseline (15 §29). */
  async #screenCompare(params: ViceOperations["screenCompare"]["params"]): Promise<ScreenComparison> {
    const baseline = this.#baselines.get(params.baseline);
    if (baseline === undefined) throw new WireFailure("not-found", `There is no baseline named ${params.baseline}.`);
    const current = await this.#observe(() => this.#machine.captureFrame(this.#videoStandard));
    const difference = compareFrames(baseline.frame, current.frame, params.mask);
    const mismatchRatio = difference.comparedPixels === 0 ? 0 : difference.mismatchingPixels / difference.comparedPixels;
    const result: ScreenComparison = {
      match: mismatchRatio <= params.maxMismatchRatio,
      mismatchingPixels: difference.mismatchingPixels,
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
    const [left, right] = await this.#observe(async () => [
      Buffer.from(await this.#machine.readMemory({ ...params.left, size: params.size }), "hex"),
      Buffer.from(await this.#machine.readMemory({ ...params.right, size: params.size }), "hex"),
    ]);
    const firstDifferences: Array<{ offset: number; left: number; right: number }> = [];
    let differentBytes = 0;
    for (let offset = 0; offset < params.size; offset++) {
      if (left![offset] === right![offset]) continue;
      differentBytes++;
      if (firstDifferences.length < MAX_COMPARE_DIFFERENCES) firstDifferences.push({ offset, left: left![offset]!, right: right![offset]! });
    }
    return { equal: differentBytes === 0, differentBytes, firstDifferences };
  }

  /** Direct CPU-state writes need a stopped CPU (15 §4); they never pause it themselves. */
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
    this.#state = "running";
    try {
      await send();
    } catch (error) {
      this.#state = "stopped";
      throw error;
    }
  }

  /**
   * Sends a command after which VICE leaves the monitor by itself (autostart,
   * reset). Stock VICE sometimes stays in the monitor instead (seen live after
   * an autostart, under load also after a reset), and when it was in the
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
   * Runs monitor work that must not change the run state (15 §4). Any monitor
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
    if (shouldResume()) await this.#resume();
    return result;
  }

  /** Serializes all VICE work for this session (D3). `whileHeld` work checks a held VICE itself. */
  #enqueue<T>(work: () => Promise<T>, options: { whileHeld?: boolean } = {}): Promise<T> {
    const run = this.#queue.then(async () => {
      if (this.#closed) throw new WireFailure("machine-unavailable", "The emulator session is closed.");
      if (this.#lost) throw new WireFailure("machine-state-lost", STATE_LOST);
      if (this.#windowClosing) throw new WireFailure("machine-unavailable", WINDOW_CLOSING);
      const notice = this.#notice;
      this.#notice = undefined;
      if (notice !== undefined) throw notice;
      // Nothing is sent to a held VICE: each command would wait there and run later.
      if (this.#held !== undefined && options.whileHeld !== true) throw new WireFailure("machine-unavailable", VICE_HELD);
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
    if (this.#closed) return new WireFailure("machine-unavailable", "The emulator session is closed.");
    if (error instanceof MonitorConnectionError || error instanceof TextMonitorError) {
      this.#log(error.message);
      // A broken connection usually means VICE died; give its exit a moment to land.
      if (!this.#lost && !this.#windowClosing) await Promise.race([this.#vice.exited, sleep(CRASH_SETTLE_MS)]);
      if (this.#lost) return new WireFailure("machine-state-lost", STATE_LOST);
      if (this.#windowClosing) return new WireFailure("machine-unavailable", WINDOW_CLOSING);
      if (isTimeout(error)) {
        // VICE's own log can tell why it did not answer.
        const tail = this.#vice.outputTail().split("\n").slice(-10).join("\n  ");
        if (tail.trim() !== "") this.#log(`VICE log after the monitor timeout:\n  ${tail}`);
        this.#recover(runningBefore, halts);
        return new WireFailure("machine-unavailable", VICE_HELD);
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
    this.#log("VICE takes no commands (paused in its window, or a dialog is open); waiting until it goes on");
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
      this.#checkpointHits = [];
      this.#state = "stopped";
      this.#stopWaiters = this.#stopWaiters.filter((waiter) => !waiter(stop));
    } else if (event.type === ResponseType.resumed) {
      this.#state = "running";
    }
  }
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

/** The production factory: launch a headless VICE per session through the host's supervisor. */
export function viceSessionFactory(options: {
  supervisor: ProcessSupervisor;
  env?: NodeJS.ProcessEnv;
  log?: (line: string) => void;
}): ViceSessionFactory {
  const log = options.log ?? (() => {});
  return async ({ videoStandard }) => {
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
    return ViceSession.start(vice, videoStandard, log, { launch, ownPath: (path) => options.supervisor.ownPath(path) });
  };
}
