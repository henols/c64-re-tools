// The long-lived Host Runtime connection an MCP process owns: one connection,
// one VICE. Exposes C64-domain operations only.

import {
  ProtocolError,
  validateViceResult,
  WireFailure,
  type Breakpoint,
  type BreakpointParams,
  type Watchpoint,
  type WatchpointParams,
  type ExecutionParams,
  type ExecutionResult,
  type JoystickState,
  type MachineStatus,
  type MemoryWriteParams,
  type RegisterValues,
  type ResetMode,
  type RunState,
  type RunTarget,
  type RunUntilResult,
  type MemoryReadParams,
  type MemoryReadResult,
  type Registers,
  type Space,
  type VideoStandard,
  type ViceOperation,
  type ViceOperations,
} from "../protocol.ts";
import { HostConnection } from "./connect.ts";
import { readProjectFile } from "./transfer.ts";

const HOST_LOST =
  "The connection to the c64-re-tools host runtime was lost, and the emulator and its machine state went with it. " +
  "Check that c64-re-tools-host is running, then restart the c64-re-tools MCP server.";

interface Pending {
  op: ViceOperation;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

export class ViceSessionClient {
  /** Settles when the session is gone, whether we closed it or the host went away. */
  readonly closed: Promise<void>;
  readonly #connection: HostConnection;
  readonly #pending = new Map<number, Pending>();
  #nextId = 1;
  #lost: WireFailure | undefined;

  private constructor(connection: HostConnection) {
    this.#connection = connection;
    connection.onMessage((message) => {
      // Anything but a reply after the handshake breaks the contract.
      if (message.type !== "reply") return this.#fail();
      const pending = this.#pending.get(message.id);
      if (pending === undefined) return; // not ours; ignore
      this.#pending.delete(message.id);
      if ("error" in message) {
        pending.reject(new WireFailure(message.error.code, message.error.message));
        return;
      }
      try {
        pending.resolve(validateViceResult(pending.op, message.result));
      } catch (error) {
        if (!(error instanceof ProtocolError)) throw error;
        pending.reject(new WireFailure("operation-failed", "The c64-re-tools host runtime sent an invalid reply."));
        this.#fail();
      }
    });
    this.closed = connection.closed.then(() => {
      this.#lost = new WireFailure("machine-state-lost", HOST_LOST);
      for (const pending of this.#pending.values()) pending.reject(this.#lost);
      this.#pending.clear();
    });
  }

  /** Connects and waits until the host has started this session's emulator. */
  static async open(options: { videoStandard: VideoStandard; env?: NodeJS.ProcessEnv; readyTimeoutMs?: number }): Promise<ViceSessionClient> {
    const connection = await HostConnection.open({
      role: "vice-session",
      videoStandard: options.videoStandard,
      ...(options.env === undefined ? {} : { env: options.env }),
      ...(options.readyTimeoutMs === undefined ? {} : { readyTimeoutMs: options.readyTimeoutMs }),
    });
    return new ViceSessionClient(connection);
  }

  status(): Promise<MachineStatus> {
    return this.#request("status", {});
  }

  memoryRead(params: MemoryReadParams): Promise<MemoryReadResult> {
    return this.#request("memoryRead", params);
  }

  registersGet(space: Space): Promise<Registers> {
    return this.#request("registersGet", { space });
  }

  memoryWrite(params: MemoryWriteParams): Promise<{ address: number; bytesWritten: number }> {
    return this.#request("memoryWrite", params);
  }

  memorySearch(params: ViceOperations["memorySearch"]["params"]): Promise<{ matches: number[] }> {
    return this.#request("memorySearch", params);
  }

  memoryCompare(params: ViceOperations["memoryCompare"]["params"]): Promise<ViceOperations["memoryCompare"]["result"]> {
    return this.#request("memoryCompare", params);
  }

  disassemble(params: ViceOperations["disassemble"]["params"]): Promise<ViceOperations["disassemble"]["result"]> {
    return this.#request("disassemble", params);
  }

  registersSet(space: Space, values: RegisterValues): Promise<Registers> {
    return this.#request("registersSet", { space, values });
  }

  execution(params: ExecutionParams): Promise<ExecutionResult> {
    return this.#request("execution", params);
  }

  runUntil(params: { target: RunTarget; timeoutFrames: number }): Promise<RunUntilResult> {
    return this.#request("runUntil", params);
  }

  /** Loads a project PRG into memory without reset or start; finishes stopped. */
  async programLoad(params: { path: string; address?: number }): Promise<{ state: RunState; loadAddress: number; size: number }> {
    const file = readProjectFile(params.path);
    return this.#request("programLoad", params.address === undefined ? {} : { address: params.address }, [file.bytes]);
  }

  /** Autostarts a project program or image, as VICE's autostart does. */
  async autostart(params: { path: string; index: number; run: boolean }): Promise<{ state: RunState }> {
    const file = readProjectFile(params.path);
    return this.#request("autostart", { type: file.type, index: params.index, run: params.run }, [file.bytes]);
  }

  /** Attaches a project disk image to drive 8. */
  async diskAttach(params: { path: string }): Promise<{ attached: boolean }> {
    const file = readProjectFile(params.path);
    return this.#request("diskAttach", { type: file.type }, [file.bytes]);
  }

  reset(params: { mode: ResetMode; run: boolean }): Promise<{ state: RunState }> {
    return this.#request("reset", params);
  }

  /** Queues PETSCII bytes for the C64 keyboard. */
  keyboard(petscii: Uint8Array): Promise<{ queuedBytes: number }> {
    return this.#request("keyboard", { data: Buffer.from(petscii).toString("hex") });
  }

  joystick(state: JoystickState): Promise<JoystickState> {
    return this.#request("joystick", state);
  }

  breakpoint(params: BreakpointParams): Promise<Breakpoint | { breakpoints: Breakpoint[] }> {
    return this.#request("breakpoint", params);
  }

  watchpoint(params: WatchpointParams): Promise<Watchpoint | { watchpoints: Watchpoint[] }> {
    return this.#request("watchpoint", params);
  }

  cpuHistory(params: ViceOperations["cpuHistory"]["params"]): Promise<ViceOperations["cpuHistory"]["result"]> {
    return this.#request("cpuHistory", params);
  }

  backtrace(params: ViceOperations["backtrace"]["params"]): Promise<ViceOperations["backtrace"]["result"]> {
    return this.#request("backtrace", params);
  }

  timing(action: ViceOperations["timing"]["params"]["action"]): Promise<ViceOperations["timing"]["result"]> {
    return this.#request("timing", { action });
  }

  profile(limit: number): Promise<ViceOperations["profile"]["result"]> {
    return this.#request("profile", { limit });
  }

  memmap(params: ViceOperations["memmap"]["params"]): Promise<ViceOperations["memmap"]["result"]> {
    return this.#request("memmap", params);
  }

  vicii(): Promise<ViceOperations["vicii"]["result"]> {
    return this.#request("vicii", {});
  }

  /** Empty `indexes` means all eight sprites. */
  sprites(indexes: number[]): Promise<ViceOperations["sprites"]["result"]> {
    return this.#request("sprites", { indexes });
  }

  cia(which: ViceOperations["cia"]["params"]["which"]): Promise<ViceOperations["cia"]["result"]> {
    return this.#request("cia", { which });
  }

  sid(): Promise<ViceOperations["sid"]["result"]> {
    return this.#request("sid", {});
  }

  /** The last frame the VIC-II drew, as a base64 PNG with its size. */
  screenCapture(): Promise<{ width: number; height: number; png: string }> {
    return this.#request("screenCapture", {});
  }

  warp(enabled: boolean): Promise<{ enabled: boolean }> {
    return this.#request("warp", { enabled });
  }

  /** Ends the session; the host stops its emulator. */
  async close(): Promise<void> {
    await this.#connection.close();
    await this.closed;
  }

  #request<O extends ViceOperation>(
    op: O,
    params: ViceOperations[O]["params"],
    attachments: readonly Uint8Array[] = [],
  ): Promise<ViceOperations[O]["result"]> {
    if (this.#lost !== undefined) return Promise.reject(this.#lost);
    const id = this.#nextId;
    this.#nextId = this.#nextId >= 0xffff_ffff ? 1 : this.#nextId + 1;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { op, resolve: resolve as (value: unknown) => void, reject });
      this.#connection.send({ type: "request", id, op, params }, attachments);
    });
  }

  /** Drops a connection whose host broke the protocol; pending work fails as lost. */
  #fail(): void {
    void this.#connection.close();
  }
}
