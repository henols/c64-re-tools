// The per-emulator session: one VICE, one serialized operation queue, the
// machine's run state, and what happens when VICE dies.

import {
  WireFailure,
  type ExecutionParams,
  type JoystickState,
  type ExecutionResult,
  type MachineStatus,
  type RunState,
  type VideoStandard,
  type ViceOperation,
  type ViceOperations,
} from "../../protocol.ts";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import type { ProcessSupervisor } from "../processes.ts";
import type { ViceSessionFactory, ViceSessionHandle } from "../server.ts";
import { ViceAdapter } from "./adapter.ts";
import { decodeProgramCounter, MonitorConnectionError, MonitorError, ResponseType, type MonitorResponse } from "./binary-monitor.ts";
import { launchVice, type ViceProcess } from "./process.ts";
import { TextMonitorError } from "./text-monitor.ts";

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

function hex(value: number): string {
  return `$${value.toString(16).padStart(4, "0")}`;
}

export interface SessionOptions {
  /** Upper bound for until-return; tests shorten it. */
  untilReturnLimitMs?: number;
}

export class ViceSession implements ViceSessionHandle {
  readonly #vice: ViceProcess;
  readonly #videoStandard: VideoStandard;
  readonly #log: (line: string) => void;
  readonly #untilReturnLimitMs: number;
  #adapter: ViceAdapter | undefined;
  #state: RunState = "running";
  /** Each returns true once satisfied and is then dropped. */
  #stopWaiters: Array<(pc: number, checkpoint: number | undefined) => boolean> = [];
  /** The VICE number of a checkpoint reported hit whose stopped event has not come yet. */
  #checkpointHit: number | undefined;
  /** Counts stops caused by checkpoints or a CPU JAM rather than by a monitor command. */
  #haltCount = 0;
  #queue: Promise<unknown> = Promise.resolve();
  #closed = false;
  #lost = false;
  /** Counts staged media files, for unique names. */
  #staged = 0;
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
    vice.monitor.onEvent((event) => this.#onEvent(event));
    void vice.exited.then((status) => {
      if (this.#closed) return;
      this.#lost = true;
      this.#log(`VICE exited unexpectedly (code ${status.code}, signal ${status.signal})\n${vice.outputTail()}`);
    });
    for (const closed of [vice.monitor.closed, vice.text.closed]) {
      void closed.then((reason) => {
        if (this.#closed || reason === undefined) return;
        this.#lost = true;
        this.#log(`VICE monitor connection lost: ${reason.message}`);
      });
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
    return this.#enqueue(() => this.#run(op, params, attachments)) as Promise<ViceOperations[O]["result"]>;
  }

  async close(): Promise<void> {
    this.#closed = true;
    await this.#vice.stop();
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
      case "registersSet": {
        const { space, values } = params as ViceOperations["registersSet"]["params"];
        this.#requireStopped();
        return this.#machine.writeRegisters(space, values);
      }
      case "execution":
        return this.#execution(params as ExecutionParams);
      case "programLoad":
        return this.#programLoad(params as ViceOperations["programLoad"]["params"], attachments[0]!);
      case "autostart": {
        const { type, index, run } = params as ViceOperations["autostart"]["params"];
        const file = this.#stage(attachments[0]!, type);
        await this.#resumingCommand(() => this.#machine.autostart(file, index, run));
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
    }
    throw new WireFailure("invalid-input", `unknown operation: ${String(op)}`);
  }

  async #status(): Promise<MachineStatus> {
    // Captured first: asking VICE anything stops a running machine until #observe resumes it.
    const state = this.#state;
    return this.#observe(async () => {
      const status: MachineStatus = { state, videoStandard: this.#videoStandard, warp: await this.#machine.warp() };
      if (state === "stopped") status.pc = await this.#pc();
      return status;
    });
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
      throw new WireFailure("unsupported-in-space", `${params.action} is available only in space c64 for now.`);
    }
    await this.#stop();
    if (params.action === "until-return") {
      const stopped = this.#nextStop(this.#untilReturnLimitMs);
      await this.#resumingCommand(() => this.#machine.untilReturn());
      const pc = await stopped;
      if (pc === undefined) {
        await this.#stop();
        throw new WireFailure(
          "limit-exceeded",
          `The routine did not return within ${this.#untilReturnLimitMs / 1000} seconds. The machine is stopped at ${hex(await this.#pc())}.`,
        );
      }
      return { state: "stopped", pc };
    }
    const count = params.count ?? 1;
    await this.#machine.step(count, params.action === "next");
    // VICE answers a step only after the machine stopped again.
    this.#state = "stopped";
    return { state: "stopped", pc: await this.#pc(), executed: count };
  }

  async #reset(params: { mode: "soft" | "hard"; run: boolean }): Promise<{ state: RunState }> {
    await this.#stop();
    if (params.run) {
      await this.#resumingCommand(() => this.#machine.reset(params.mode));
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
    return { state: "stopped" };
  }

  /**
   * Writes transferred bytes into this VICE's scratch directory. Media stay
   * there for the session: VICE reads an attached image from its file.
   */
  #stage(bytes: Buffer, type: string): string {
    this.#staged++;
    const file = join(this.#vice.scratchDir, `media-${this.#staged}${type === "" ? "" : `.${type}`}`);
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
   * Resolves with the PC of the next stop, or undefined after `timeoutMs`.
   * With `checkpoint`, only a stop caused by that VICE checkpoint counts.
   */
  #nextStop(timeoutMs: number, checkpoint?: number): Promise<number | undefined> {
    return new Promise((resolve) => {
      const waiter = (pc: number, hit: number | undefined) => {
        if (checkpoint !== undefined && hit !== checkpoint) return false;
        clearTimeout(timer);
        resolve(pc);
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
      // A refused read must not leave a running machine stopped either.
      if (wasRunning && !this.#lost) {
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

  /** Serializes all VICE work for this session (D3). */
  #enqueue<T>(work: () => Promise<T>): Promise<T> {
    const run = this.#queue.then(async () => {
      if (this.#closed) throw new WireFailure("machine-unavailable", "The emulator session is closed.");
      if (this.#lost) throw new WireFailure("machine-state-lost", STATE_LOST);
      try {
        return await work();
      } catch (error) {
        throw await this.#translate(error);
      }
    });
    this.#queue = run.catch(() => {});
    return run;
  }

  async #translate(error: unknown): Promise<unknown> {
    if (error instanceof WireFailure) return error;
    if (this.#closed) return new WireFailure("machine-unavailable", "The emulator session is closed.");
    if (error instanceof MonitorConnectionError || error instanceof TextMonitorError) {
      this.#log(error.message);
      // A broken connection usually means VICE died; give its exit a moment to land.
      if (!this.#lost) await Promise.race([this.#vice.exited, sleep(CRASH_SETTLE_MS)]);
      if (this.#lost) return new WireFailure("machine-state-lost", STATE_LOST);
      return new WireFailure("machine-unavailable", "The emulator did not answer in time.");
    }
    if (error instanceof MonitorError) {
      this.#log(error.message);
      if (error.errorCode === 0x02) return new WireFailure("unsupported-in-space", "The emulator does not support that memory space.");
      return new WireFailure("operation-failed", "The emulator refused the operation.");
    }
    return error;
  }

  #onEvent(event: MonitorResponse): void {
    // VICE reports a hit checkpoint (byte 4 set) just before the stop it causes.
    if (event.type === ResponseType.checkpointInfo && event.body[4] !== 0) this.#checkpointHit = event.body.readUInt32LE(0);
    if (event.type === ResponseType.stopped || event.type === ResponseType.jam) {
      const hit = this.#checkpointHit;
      if (hit !== undefined || event.type === ResponseType.jam) this.#haltCount++;
      this.#checkpointHit = undefined;
      this.#state = "stopped";
      const pc = decodeProgramCounter(event.body);
      this.#stopWaiters = this.#stopWaiters.filter((waiter) => !waiter(pc, hit));
    } else if (event.type === ResponseType.resumed) {
      this.#state = "running";
    }
  }
}

/** The production factory: launch a VICE per session through the host's supervisor. */
export function viceSessionFactory(options: {
  supervisor: ProcessSupervisor;
  env?: NodeJS.ProcessEnv;
  log?: (line: string) => void;
}): ViceSessionFactory {
  const log = options.log ?? (() => {});
  return async ({ videoStandard }) => {
    const vice = await launchVice({
      videoStandard,
      supervisor: options.supervisor,
      log,
      ...(options.env === undefined ? {} : { env: options.env }),
    });
    return ViceSession.start(vice, videoStandard, log);
  };
}
