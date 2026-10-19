// The Host Runtime session of one ZX Spectrum (ZEsarUX on the host): the
// operations of protocol/spectrum.ts, with project files read on this side.

import type { MachineId } from "../machine.ts";
import type { SpectrumOperation, SpectrumOperations } from "../protocol/spectrum.ts";
import { HostConnection } from "./connect.ts";
import { HostSession } from "./host-session.ts";
import { readProjectFile } from "./transfer.ts";

type Params<O extends SpectrumOperation> = SpectrumOperations[O]["params"];
type Result<O extends SpectrumOperation> = SpectrumOperations[O]["result"];

export class SpectrumSessionClient extends HostSession {
  /** Connects and waits until the host has started this session's ZEsarUX; `signal` stops the wait at once. */
  static async open(options: { machine: MachineId; env?: NodeJS.ProcessEnv; signal?: AbortSignal }): Promise<SpectrumSessionClient> {
    const connection = await HostConnection.open({
      role: "session",
      machine: options.machine,
      ...(options.env === undefined ? {} : { env: options.env }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
    return new SpectrumSessionClient(connection, { closedMessage: "The Spectrum session is closed because the c64-re-tools MCP server stops." });
  }

  async #call<O extends SpectrumOperation>(op: O, params: Params<O>, attachments: readonly Uint8Array[] = []): Promise<Result<O>> {
    return (await this.request<Result<O>>(op, params, attachments)).result;
  }

  status(): Promise<Result<"status">> {
    return this.#call("status", {});
  }
  reset(params: Params<"reset">): Promise<Result<"reset">> {
    return this.#call("reset", params);
  }
  execution(params: Params<"execution">): Promise<Result<"execution">> {
    return this.#call("execution", params);
  }
  runUntil(params: Params<"runUntil">): Promise<Result<"runUntil">> {
    return this.#call("runUntil", params);
  }
  breakpoint(params: Params<"breakpoint">): Promise<Result<"breakpoint">> {
    return this.#call("breakpoint", params);
  }
  watchpoint(params: Params<"watchpoint">): Promise<Result<"watchpoint">> {
    return this.#call("watchpoint", params);
  }
  memoryRead(params: Params<"memoryRead">): Promise<Result<"memoryRead">> {
    return this.#call("memoryRead", params);
  }
  memoryWrite(params: Params<"memoryWrite">): Promise<Result<"memoryWrite">> {
    return this.#call("memoryWrite", params);
  }
  registersGet(): Promise<Result<"registersGet">> {
    return this.#call("registersGet", {});
  }
  registersSet(params: Params<"registersSet">): Promise<Result<"registersSet">> {
    return this.#call("registersSet", params);
  }
  disassemble(params: Params<"disassemble">): Promise<Result<"disassemble">> {
    return this.#call("disassemble", params);
  }
  cpuHistory(params: Params<"cpuHistory">): Promise<Result<"cpuHistory">> {
    return this.#call("cpuHistory", params);
  }
  memmap(params: Params<"memmap">): Promise<Result<"memmap">> {
    return this.#call("memmap", params);
  }
  keyboard(params: Params<"keyboard">): Promise<Result<"keyboard">> {
    return this.#call("keyboard", params);
  }
  keys(params: Params<"keys">): Promise<Result<"keys">> {
    return this.#call("keys", params);
  }
  joystick(params: Params<"joystick">): Promise<Result<"joystick">> {
    return this.#call("joystick", params);
  }
  snapshot(params: Params<"snapshot">): Promise<Result<"snapshot">> {
    return this.#call("snapshot", params);
  }
  timing(params: Params<"timing">): Promise<Result<"timing">> {
    return this.#call("timing", params);
  }
  ula(): Promise<Result<"ula">> {
    return this.#call("ula", {});
  }
  ay(): Promise<Result<"ay">> {
    return this.#call("ay", {});
  }

  /** The screen as a PNG. */
  async screen(): Promise<{ width: number; height: number; png: Buffer }> {
    const { result, attachments } = await this.request<Result<"screen">>("screen", {});
    return { ...result, png: attachments[0]! };
  }

  /** The machine state as a version 3 .z80. */
  async snapshotExport(): Promise<Buffer> {
    const { attachments } = await this.request<Result<"snapshotExport">>("snapshotExport", {});
    return attachments[0]!;
  }

  /** Loads a project tape or snapshot and runs it. `root` is the project folder; it stays on this side. */
  async autostart(params: { path: string; root?: string }): Promise<Result<"autostart">> {
    const file = readProjectFile(params.path, params.root === undefined ? { what: "path" } : { root: params.root, what: "path" });
    return this.#call("autostart", { type: file.type as Params<"autostart">["type"] }, [file.bytes]);
  }

  /** Puts the bytes of a project file into memory at `address`. */
  async programLoad(params: { path: string; address: number; root?: string }): Promise<Result<"programLoad">> {
    const file = readProjectFile(params.path, params.root === undefined ? { what: "path" } : { root: params.root, what: "path" });
    return this.#call("programLoad", { address: params.address }, [file.bytes]);
  }
}
