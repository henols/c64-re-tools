// The per-emulator session: one VICE, one serialized operation queue, the
// machine's run state, and what happens when VICE dies.

import {
  WireFailure,
  type MachineStatus,
  type RunState,
  type VideoStandard,
  type ViceOperation,
  type ViceOperations,
} from "../../protocol.ts";
import type { ProcessSupervisor } from "../processes.ts";
import type { ViceSessionFactory, ViceSessionHandle } from "../server.ts";
import { ViceAdapter } from "./adapter.ts";
import { MonitorConnectionError, MonitorError, ResponseType, type MonitorResponse } from "./binary-monitor.ts";
import { launchVice, type ViceProcess } from "./process.ts";

const CRASH_SETTLE_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const STATE_LOST =
  "The emulator stopped unexpectedly and its machine state is lost. Restart the c64-re-tools MCP server to get a fresh C64.";

export class ViceSession implements ViceSessionHandle {
  readonly #vice: ViceProcess;
  readonly #videoStandard: VideoStandard;
  readonly #log: (line: string) => void;
  #adapter: ViceAdapter | undefined;
  #state: RunState = "running";
  /** VICE 3.10 has no readable live warp resource; launch starts with warp off and only this session changes it. */
  #warp = false;
  #queue: Promise<unknown> = Promise.resolve();
  #closed = false;
  #lost = false;

  private constructor(vice: ViceProcess, videoStandard: VideoStandard, log: (line: string) => void) {
    this.#vice = vice;
    this.#videoStandard = videoStandard;
    this.#log = log;
    vice.monitor.onEvent((event) => this.#onEvent(event));
    void vice.exited.then((status) => {
      if (this.#closed) return;
      this.#lost = true;
      this.#log(`VICE exited unexpectedly (code ${status.code}, signal ${status.signal})\n${vice.outputTail()}`);
    });
    void vice.monitor.closed.then((reason) => {
      if (this.#closed || reason === undefined) return;
      this.#lost = true;
      this.#log(`VICE monitor connection lost: ${reason.message}`);
    });
  }

  /** Wraps a launched, running VICE. Stops the VICE when setup fails. */
  static async start(vice: ViceProcess, videoStandard: VideoStandard, log: (line: string) => void = () => {}): Promise<ViceSession> {
    const session = new ViceSession(vice, videoStandard, log);
    try {
      await session.#enqueue(async () => {
        session.#adapter = await session.#observe((adapter) => Promise.resolve(adapter), true);
      });
    } catch (error) {
      await session.close();
      throw error;
    }
    return session;
  }

  handle<O extends ViceOperation>(op: O, params: ViceOperations[O]["params"]): Promise<ViceOperations[O]["result"]> {
    return this.#enqueue(() => this.#run(op, params)) as Promise<ViceOperations[O]["result"]>;
  }

  async close(): Promise<void> {
    this.#closed = true;
    await this.#vice.stop();
  }

  async #run(op: ViceOperation, params: unknown): Promise<unknown> {
    switch (op) {
      case "status":
        return this.#status();
      case "memoryRead": {
        const read = params as ViceOperations["memoryRead"]["params"];
        const data = await this.#observe((adapter) => adapter.readMemory(read));
        return { address: read.address, data };
      }
      case "registersGet": {
        const { space } = params as ViceOperations["registersGet"]["params"];
        return this.#observe((adapter) => adapter.readRegisters(space));
      }
    }
    throw new WireFailure("invalid-input", `unknown operation: ${String(op)}`);
  }

  async #status(): Promise<MachineStatus> {
    const status: MachineStatus = { state: this.#state, videoStandard: this.#videoStandard, warp: this.#warp };
    // Reading the PC while stopped changes nothing; while running there is no PC to report.
    if (this.#state === "stopped") status.pc = (await this.#observe((adapter) => adapter.readRegisters("c64"))).pc;
    return status;
  }

  /**
   * Runs read-only monitor work and restores the prior run state (15 §4): any
   * monitor command stops the machine, so a machine that was running is resumed.
   */
  async #observe<T>(work: (adapter: ViceAdapter) => Promise<T>, setup = false): Promise<T> {
    if (!setup && this.#adapter === undefined) throw new Error("session is not set up");
    const wasRunning = this.#state === "running";
    const adapter = setup ? await ViceAdapter.create(this.#vice.monitor) : this.#adapter!;
    const result = await work(adapter);
    if (wasRunning) {
      await adapter.resume();
      this.#state = "running";
    }
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
    if (error instanceof MonitorConnectionError) {
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
    if (event.type === ResponseType.stopped || event.type === ResponseType.jam) this.#state = "stopped";
    else if (event.type === ResponseType.resumed) this.#state = "running";
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
