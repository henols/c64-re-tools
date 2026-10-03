// Translates C64-domain operations into binary-monitor commands. VICE quirks
// and register/bank id lookups live here; callers never see monitor details.

import { WireFailure, type MemoryView, type RegisterValues, type Registers, type Space } from "../../protocol.ts";
import { TextMonitorError, type TextMonitor } from "./text-monitor.ts";
import {
  BinaryMonitor,
  Command,
  decodeBanks,
  decodeMemory,
  decodeRegisters,
  decodeRegistersAvailable,
  memoryGetBody,
  Memspace,
} from "./binary-monitor.ts";

const MEMSPACE: Record<Space, number> = { c64: Memspace.main, drive8: Memspace.drive8 };

/** The 6502 registers the domain needs, by VICE register name. */
const REGISTER_NAMES = { pc: "PC", a: "A", x: "X", y: "Y", sp: "SP", flags: "FL" } as const;
type RegisterKey = keyof typeof REGISTER_NAMES;
type RegisterIds = Record<RegisterKey, number>;

async function registerIds(monitor: BinaryMonitor, space: Space): Promise<RegisterIds> {
  const available = decodeRegistersAvailable((await monitor.request(Command.registersAvailable, Buffer.from([MEMSPACE[space]]))).body);
  const ids = {} as RegisterIds;
  for (const [key, name] of Object.entries(REGISTER_NAMES) as Array<[RegisterKey, string]>) {
    const register = available.find((candidate) => candidate.name === name);
    if (register === undefined) throw new Error(`VICE reports no ${name} register for ${space}`);
    ids[key] = register.id;
  }
  return ids;
}

/** Quotes a host file path for a text-monitor command. Session scratch paths never contain quotes. */
function quoted(path: string): string {
  if (/["\r\n]/.test(path)) throw new Error(`a monitor file path cannot contain quotes or line breaks: ${path}`);
  return `"${path}"`;
}

export function statusRegisterFromFlags(flags: Registers["flags"]): number {
  return (
    (flags.n ? 0x80 : 0) |
    (flags.v ? 0x40 : 0) |
    0x20 | // bit 5 always reads as 1 on the 6502
    (flags.b ? 0x10 : 0) |
    (flags.d ? 0x08 : 0) |
    (flags.i ? 0x04 : 0) |
    (flags.z ? 0x02 : 0) |
    (flags.c ? 0x01 : 0)
  );
}

export function flagsFromStatusRegister(value: number): Registers["flags"] {
  return {
    n: (value & 0x80) !== 0,
    v: (value & 0x40) !== 0,
    b: (value & 0x10) !== 0,
    d: (value & 0x08) !== 0,
    i: (value & 0x04) !== 0,
    z: (value & 0x02) !== 0,
    c: (value & 0x01) !== 0,
  };
}

/**
 * Domain operations over one binary-monitor connection. Every method sends
 * monitor commands, and any monitor command stops the machine; restoring the
 * run state is the session's job.
 */
/** Generous bound for commands that run the machine (step/next): they answer only once it stops again. */
const RUNNING_COMMAND_TIMEOUT_MS = 30_000;

export class ViceAdapter {
  readonly #monitor: BinaryMonitor;
  readonly #text: TextMonitor;
  readonly #registerIds: Record<Space, RegisterIds>;
  readonly #banks: Record<MemoryView | "rom", number>;

  private constructor(
    monitor: BinaryMonitor,
    text: TextMonitor,
    registerIdsBySpace: Record<Space, RegisterIds>,
    banks: Record<MemoryView | "rom", number>,
  ) {
    this.#monitor = monitor;
    this.#text = text;
    this.#registerIds = registerIdsBySpace;
    this.#banks = banks;
  }

  /** Looks up the register and bank ids this VICE uses. Stops the machine. */
  static async create(monitor: BinaryMonitor, text: TextMonitor): Promise<ViceAdapter> {
    const banks = decodeBanks((await monitor.request(Command.banksAvailable)).body);
    const bankId = (name: string) => {
      const bank = banks.find((candidate) => candidate.name === name);
      if (bank === undefined) throw new Error(`VICE reports no ${name} memory bank`);
      return bank.id;
    };
    return new ViceAdapter(
      monitor,
      text,
      { c64: await registerIds(monitor, "c64"), drive8: await registerIds(monitor, "drive8") },
      { cpu: bankId("cpu"), ram: bankId("ram"), rom: bankId("rom") },
    );
  }

  /** Reads memory as the selected CPU (view cpu) or as plain RAM (view ram, c64 only). Returns lowercase hex. */
  async readMemory(options: { address: number; size: number; space: Space; view: MemoryView }): Promise<string> {
    if (options.space === "drive8" && options.view === "ram") {
      throw new WireFailure("unsupported-in-space", "view ram is available only in space c64; use view cpu for drive8.");
    }
    const response = await this.#monitor.request(
      Command.memoryGet,
      memoryGetBody({
        start: options.address,
        end: options.address + options.size - 1,
        memspace: MEMSPACE[options.space],
        bank: options.space === "c64" ? this.#banks[options.view] : 0,
      }),
    );
    const bytes = decodeMemory(response.body);
    if (bytes.length !== options.size) throw new Error(`VICE returned ${bytes.length} bytes for a ${options.size}-byte read`);
    return bytes.toString("hex");
  }

  /** Writes memory as the selected CPU (view cpu) or into plain RAM (view ram, c64 only). */
  async writeMemory(options: { address: number; data: string; space: Space; view: MemoryView }): Promise<number> {
    if (options.space === "drive8" && options.view === "ram") {
      throw new WireFailure("unsupported-in-space", "view ram is available only in space c64; use view cpu for drive8.");
    }
    const bytes = Buffer.from(options.data, "hex");
    const header = Buffer.alloc(8);
    header[0] = 0; // no side effects
    header.writeUInt16LE(options.address, 1);
    header.writeUInt16LE(options.address + bytes.length - 1, 3);
    header[5] = MEMSPACE[options.space];
    header.writeUInt16LE(options.space === "c64" ? this.#banks[options.view] : 0, 6);
    await this.#monitor.request(Command.memorySet, Buffer.concat([header, bytes]));
    return bytes.length;
  }

  /** Sets any subset of the registers (flags merge into the current status register). Returns the full set. */
  async writeRegisters(space: Space, values: RegisterValues): Promise<Registers> {
    const current = await this.readRegisters(space);
    const ids = this.#registerIds[space];
    const items: Buffer[] = [];
    const add = (key: RegisterKey, value: number) => {
      const item = Buffer.alloc(4);
      item[0] = 3; // item size after this byte
      item[1] = ids[key];
      item.writeUInt16LE(value, 2);
      items.push(item);
    };
    if (values.pc !== undefined) add("pc", values.pc);
    for (const key of ["a", "x", "y", "sp"] as const) if (values[key] !== undefined) add(key, values[key]);
    if (values.flags !== undefined) add("flags", statusRegisterFromFlags({ ...current.flags, ...values.flags }));
    const count = Buffer.alloc(2);
    count.writeUInt16LE(items.length, 0);
    await this.#monitor.request(Command.registersSet, Buffer.concat([Buffer.from([MEMSPACE[space]]), count, ...items]));
    return this.readRegisters(space);
  }

  async readRegisters(space: Space): Promise<Registers> {
    const values = decodeRegisters((await this.#monitor.request(Command.registersGet, Buffer.from([MEMSPACE[space]]))).body);
    const ids = this.#registerIds[space];
    const value = (key: RegisterKey) => {
      const register = values.find((candidate) => candidate.id === ids[key]);
      if (register === undefined) throw new Error(`VICE returned no ${REGISTER_NAMES[key]} register for ${space}`);
      return register.value;
    };
    return {
      pc: value("pc") & 0xffff,
      a: value("a") & 0xff,
      x: value("x") & 0xff,
      y: value("y") & 0xff,
      sp: value("sp") & 0xff,
      flags: flagsFromStatusRegister(value("flags")),
    };
  }

  /** Leaves the monitor so the machine runs again. */
  async resume(): Promise<void> {
    await this.#monitor.request(Command.exit);
  }

  /** Stops the machine (any monitor command does). */
  async stop(): Promise<void> {
    await this.#monitor.request(Command.ping);
  }

  /** Executes `count` C64 instructions, with subroutine calls as one when `over`. Answers once stopped again. */
  async step(count: number, over: boolean): Promise<void> {
    const body = Buffer.alloc(3);
    body[0] = over ? 1 : 0;
    body.writeUInt16LE(count, 1);
    await this.#monitor.request(Command.advanceInstructions, body, RUNNING_COMMAND_TIMEOUT_MS);
  }

  /** Runs until just after the next RTS/RTI. Answers at once; the machine stops later. */
  async untilReturn(): Promise<void> {
    await this.#monitor.request(Command.executeUntilReturn);
  }

  /** Resets the C64 (soft) or power-cycles it (hard). The machine runs afterwards. */
  async reset(mode: "soft" | "hard"): Promise<void> {
    await this.#monitor.request(Command.reset, Buffer.from([mode === "hard" ? 1 : 0]));
  }

  /** Where the CPU starts after a reset: the vector at $fffc in ROM. */
  async resetVector(): Promise<number> {
    const bytes = decodeMemory(
      (await this.#monitor.request(Command.memoryGet, memoryGetBody({ start: 0xfffc, end: 0xfffd, memspace: Memspace.main, bank: this.#banks.rom }))).body,
    );
    return bytes.readUInt16LE(0);
  }

  /**
   * Adds a C64 exec checkpoint that stops the machine. Returns its VICE number.
   * Never a VICE "temporary" checkpoint: on stock VICE 3.10 setting one resumes
   * the machine (like the text monitor's until), whatever the manual says.
   */
  async addBreak(address: number): Promise<number> {
    const body = Buffer.alloc(9);
    body.writeUInt16LE(address, 0);
    body.writeUInt16LE(address, 2);
    body[4] = 1; // stop when hit
    body[5] = 1; // enabled
    body[6] = 0x04; // exec
    body[7] = 0; // not temporary
    body[8] = Memspace.main;
    const info = await this.#monitor.request(Command.checkpointSet, body);
    return info.body.readUInt32LE(0);
  }

  async deleteCheckpoint(number: number): Promise<void> {
    const body = Buffer.alloc(4);
    body.writeUInt32LE(number, 0);
    await this.#monitor.request(Command.checkpointDelete, body);
  }

  /**
   * Loads a PRG file from the host file system into memory, where the CPU
   * would write it, without reset or start. With `address`, the file's own
   * load address is skipped. Returns where it went.
   */
  async loadProgram(file: string, address?: number): Promise<{ loadAddress: number; size: number }> {
    const target = address === undefined ? "" : ` $${address.toString(16).padStart(4, "0")}`;
    const answer = await this.#text.command(`load ${quoted(file)} 0${target}`);
    const match = /from ([0-9A-Fa-f]{4}) to ([0-9A-Fa-f]{4}) \(([0-9A-Fa-f]+) bytes\)/.exec(answer);
    if (match === null) throw new WireFailure("media-error", "The emulator could not load the program.");
    return { loadAddress: Number.parseInt(match[1]!, 16), size: Number.parseInt(match[3]!, 16) };
  }

  /** Autostarts a program or image file from the host file system. The machine runs afterwards. */
  async autostart(file: string, index: number, run: boolean): Promise<void> {
    const name = Buffer.from(file, "utf8");
    if (name.length > 255) throw new Error("autostart file path is too long");
    const head = Buffer.alloc(4);
    head[0] = run ? 1 : 0;
    head.writeUInt16LE(index, 1);
    head[3] = name.length;
    await this.#monitor.request(Command.autostart, Buffer.concat([head, name]));
  }

  /** Attaches a disk image file from the host file system to drive 8. */
  async attachDisk(file: string): Promise<void> {
    const answer = await this.#text.command(`attach ${quoted(file)} 8`);
    if (answer !== "") throw new WireFailure("media-error", "The emulator could not attach the disk image.");
  }

  async warp(): Promise<boolean> {
    const answer = await this.#text.command("warp");
    const match = /Warp mode is (on|off)/.exec(answer);
    if (match === null) throw new TextMonitorError(`unexpected warp answer: ${answer}`);
    return match[1] === "on";
  }

  async setWarp(enabled: boolean): Promise<void> {
    await this.#text.command(enabled ? "warp on" : "warp off");
  }
}
