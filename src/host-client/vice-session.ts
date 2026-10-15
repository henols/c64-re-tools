// The long-lived Host Runtime connection an MCP process owns: one connection,
// one VICE. Exposes C64-domain operations only.

import { ProtocolError, WireFailure, type VideoStandard } from "../protocol/messages.ts";
import { validateViceResult, type Breakpoint, type BreakpointParams, type PointRemoved, type Watchpoint, type WatchpointParams, type ExecutionParams, type ExecutionResult, type JoystickState, type MachineStatus, type MemmapRange, type MemoryWriteParams, type RegisterValues, type ResetMode, type RunState, type RunTarget, type RunUntilResult, type MemoryReadParams, type MemoryReadResult, type Registers, type Space, type ViceOperation, type ViceOperations } from "../protocol/vice.ts";
import { HostConnection } from "./connect.ts";
import { readProjectFile } from "./transfer.ts";

const HOST_LOST =
  "The connection to the c64-re-tools host runtime was lost. The emulator and its machine state are gone: memory, registers, breakpoints, snapshots and the loaded program. " +
  "The next call starts a new machine when the Host Runtime (c64-re-tools-host) runs. Load the program again and set the breakpoints again.";
const SESSION_CLOSED = "The C64 session is closed because the c64-re-tools MCP server stops.";
const LOST_BEFORE_ANSWER = "The connection to the c64-re-tools host runtime was lost before the emulator answered. No machine state was lost. Do the call again.";

/**
 * The loss of a session that never answered (D57): it had no machine state,
 * so the caller can do the call again on a new session.
 */
export class LostBeforeAnswer extends WireFailure {
  constructor() {
    super("machine-unavailable", LOST_BEFORE_ANSWER);
  }
}

interface Pending {
  op: ViceOperation;
  resolve: (value: unknown, attachments: Buffer[]) => void;
  reject: (error: Error) => void;
}

export class ViceSessionClient {
  /** Settles when the session is gone, whether we closed it or the host went away. */
  readonly closed: Promise<void>;
  readonly #connection: HostConnection;
  readonly #pending = new Map<number, Pending>();
  #nextId = 1;
  #lost: WireFailure | undefined;
  #answered = false;
  #lossReported = false;

  private constructor(connection: HostConnection) {
    this.#connection = connection;
    connection.onMessage((message, attachments) => {
      // Anything but a reply after the handshake breaks the contract.
      if (message.type !== "reply") return this.#fail();
      const pending = this.#pending.get(message.id);
      if (pending === undefined) return; // not ours; ignore
      this.#pending.delete(message.id);
      this.#answered = true;
      if ("error" in message) {
        pending.reject(new WireFailure(message.error.code, message.error.message));
        return;
      }
      try {
        pending.resolve(validateViceResult(pending.op, message.result), attachments);
      } catch (error) {
        pending.reject(
          new WireFailure(
            "operation-failed",
            error instanceof ProtocolError ? "The c64-re-tools host runtime sent an invalid reply." : "The c64-re-tools MCP server could not read the reply of the host runtime.",
          ),
        );
        this.#fail();
      }
    });
    this.closed = connection.closed.then(() => {
      this.#lost ??= this.#answered ? new WireFailure("machine-state-lost", HOST_LOST) : new LostBeforeAnswer();
      this.#lossReported = this.#pending.size > 0;
      for (const pending of this.#pending.values()) pending.reject(this.#lost);
      this.#pending.clear();
    });
  }

  /** Connects and waits until the host has started this session's emulator; `signal` stops the wait at once. */
  static async open(options: { videoStandard: VideoStandard; env?: NodeJS.ProcessEnv; signal?: AbortSignal }): Promise<ViceSessionClient> {
    const connection = await HostConnection.open({
      role: "vice-session",
      videoStandard: options.videoStandard,
      ...(options.env === undefined ? {} : { env: options.env }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
    return new ViceSessionClient(connection);
  }

  status(): Promise<MachineStatus> {
    return this.#request("status", {});
  }

  memoryRead(params: MemoryReadParams): Promise<MemoryReadResult> {
    return this.#request("memoryRead", params);
  }

  /** The I/O registers at $d000-$dfff as the chips hold them, without side effects. */
  ioRead(address: number, size: number): Promise<MemoryReadResult> {
    return this.#request("ioRead", { address, size });
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

  /** Loads a project PRG into memory without reset or start; finishes stopped. `root` is the project folder; it stays on this side. */
  async programLoad(params: { path: string; address?: number; root?: string }): Promise<{ state: RunState; loadAddress: number; size: number }> {
    const file = readProjectFile(params.path, params.root === undefined ? {} : { root: params.root });
    return this.#request("programLoad", params.address === undefined ? {} : { address: params.address }, [file.bytes]);
  }

  /** Autostarts a project program or image, as VICE's autostart does. `root` is the project folder; it stays on this side. */
  async autostart(params: { path: string; index: number; run: boolean; root?: string }): Promise<{ state: RunState; emulatorFlaw?: string }> {
    const file = readProjectFile(params.path, params.root === undefined ? {} : { root: params.root });
    return this.#request("autostart", { type: file.type, index: params.index, run: params.run }, [file.bytes]);
  }

  /** Attaches a project disk image to drive 8. `root` is the project folder; it stays on this side. */
  async diskAttach(params: { path: string; root?: string }): Promise<{ attached: boolean }> {
    const file = readProjectFile(params.path, params.root === undefined ? {} : { root: params.root });
    return this.#request("diskAttach", { type: file.type }, [file.bytes]);
  }

  reset(params: { mode: ResetMode; run: boolean }): Promise<{ state: RunState; pc?: number }> {
    return this.#request("reset", params);
  }

  /** Queues PETSCII bytes for the C64 keyboard. */
  keyboard(petscii: Uint8Array): Promise<{ queuedBytes: number }> {
    return this.#request("keyboard", { data: Buffer.from(petscii).toString("hex") });
  }

  joystick(state: JoystickState): Promise<JoystickState> {
    return this.#request("joystick", state);
  }

  /** Action list gives all breakpoints, remove gives `{removed, id}`; add, enable and disable give the one breakpoint. */
  breakpoint(params: Extract<BreakpointParams, { action: "list" }>): Promise<{ breakpoints: Breakpoint[] }>;
  breakpoint(params: Extract<BreakpointParams, { action: "remove" }>): Promise<PointRemoved>;
  breakpoint(params: Exclude<BreakpointParams, { action: "list" | "remove" }>): Promise<Breakpoint>;
  breakpoint(params: BreakpointParams): Promise<Breakpoint | PointRemoved | { breakpoints: Breakpoint[] }> {
    return this.#request("breakpoint", params);
  }

  /** Action list gives all watchpoints, remove gives `{removed, id}`; add, enable and disable give the one watchpoint. */
  watchpoint(params: Extract<WatchpointParams, { action: "list" }>): Promise<{ watchpoints: Watchpoint[] }>;
  watchpoint(params: Extract<WatchpointParams, { action: "remove" }>): Promise<PointRemoved>;
  watchpoint(params: Exclude<WatchpointParams, { action: "list" | "remove" }>): Promise<Watchpoint>;
  watchpoint(params: WatchpointParams): Promise<Watchpoint | PointRemoved | { watchpoints: Watchpoint[] }> {
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

  /** Action read gives the ranges; action clear gives cleared. */
  memmap(params: Extract<ViceOperations["memmap"]["params"], { action: "read" }>): Promise<{ ranges: MemmapRange[]; next?: number }>;
  memmap(params: { action: "clear" }): Promise<{ cleared: boolean }>;
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

  observe(params: ViceOperations["observe"]["params"]): Promise<ViceOperations["observe"]["result"]> {
    return this.#request("observe", params);
  }

  /** The last frame the VIC-II drew, as a base64 PNG with its size. */
  screenCapture(baseline?: string): Promise<ViceOperations["screenCapture"]["result"]> {
    return this.#request("screenCapture", baseline === undefined ? {} : { baseline });
  }

  screenCompare(params: ViceOperations["screenCompare"]["params"]): Promise<ViceOperations["screenCompare"]["result"]> {
    return this.#request("screenCompare", params);
  }

  snapshot(params: ViceOperations["snapshot"]["params"]): Promise<ViceOperations["snapshot"]["result"]> {
    return this.#request("snapshot", params);
  }

  /** The bytes of a named snapshot, as a .vsf file holds them (D41). */
  async snapshotExport(name: string): Promise<Buffer> {
    const { attachments } = await this.#requestWithAttachments("snapshotFile", { action: "export", name });
    const [bytes] = attachments;
    if (bytes === undefined || attachments.length !== 1) throw new WireFailure("operation-failed", "The c64-re-tools host runtime sent no snapshot file.");
    return bytes;
  }

  /** Restores the machine from the bytes of a .vsf file; the CPU stays stopped. */
  snapshotRestore(bytes: Uint8Array): Promise<ViceOperations["snapshotFile"]["result"]> {
    return this.#request("snapshotFile", { action: "restore" }, [bytes]);
  }

  screenBaselines(): Promise<{ baselines: string[] }> {
    return this.#request("screenBaselines", {});
  }

  screenDiscard(baseline: string): Promise<{ discarded: boolean }> {
    return this.#request("screenDiscard", { baseline });
  }

  warp(enabled: boolean): Promise<{ enabled: boolean }> {
    return this.#request("warp", { enabled });
  }

  /** Moves the machine into a VICE with a window (open) or back into a headless one (close). */
  window(action: ViceOperations["window"]["params"]["action"]): Promise<ViceOperations["window"]["result"]> {
    return this.#request("window", { action });
  }

  /** True when the connection to the host is gone, whatever the reason. */
  get lost(): boolean {
    return this.#lost !== undefined;
  }

  /** True when the emulator answered a request: then the session had machine state to lose (D57). */
  get answered(): boolean {
    return this.#answered;
  }

  /** The loss of a lost session, when no request got it; undefined while the session lives (D57). */
  get unreportedLoss(): WireFailure | undefined {
    return this.#lost?.code === "machine-state-lost" && !this.#lossReported ? this.#lost : undefined;
  }

  /** Ends the session; the host stops its emulator. Open and later requests fail as closed. */
  async close(): Promise<void> {
    this.#lost ??= new WireFailure("machine-unavailable", SESSION_CLOSED);
    await this.#connection.close();
    await this.closed;
  }

  async #request<O extends ViceOperation>(
    op: O,
    params: ViceOperations[O]["params"],
    attachments: readonly Uint8Array[] = [],
  ): Promise<ViceOperations[O]["result"]> {
    return (await this.#requestWithAttachments(op, params, attachments)).result;
  }

  /** One request; the reply's result and the attachments that came with it. */
  #requestWithAttachments<O extends ViceOperation>(
    op: O,
    params: ViceOperations[O]["params"],
    attachments: readonly Uint8Array[] = [],
  ): Promise<{ result: ViceOperations[O]["result"]; attachments: Buffer[] }> {
    if (this.#lost !== undefined) {
      this.#lossReported = true;
      return Promise.reject(this.#lost);
    }
    const id = this.#nextId;
    this.#nextId = this.#nextId >= 0xffff_ffff ? 1 : this.#nextId + 1;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { op, resolve: (result, received) => resolve({ result: result as ViceOperations[O]["result"], attachments: received }), reject });
      this.#connection.send({ type: "request", id, op, params }, attachments);
    });
  }

  /** Drops a connection whose host broke the protocol; pending work fails as lost. */
  #fail(): void {
    void this.#connection.close();
  }
}
