// Translates C64-domain operations into binary-monitor commands. VICE quirks
// and register/bank id lookups live here; callers never see monitor details.

import { WireFailure, type MemoryView, type Registers, type Space } from "../../protocol.ts";
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
export class ViceAdapter {
  readonly #monitor: BinaryMonitor;
  readonly #registerIds: Record<Space, RegisterIds>;
  readonly #banks: Record<MemoryView, number>;

  private constructor(monitor: BinaryMonitor, registerIdsBySpace: Record<Space, RegisterIds>, banks: Record<MemoryView, number>) {
    this.#monitor = monitor;
    this.#registerIds = registerIdsBySpace;
    this.#banks = banks;
  }

  /** Looks up the register and bank ids this VICE uses. Stops the machine. */
  static async create(monitor: BinaryMonitor): Promise<ViceAdapter> {
    const banks = decodeBanks((await monitor.request(Command.banksAvailable)).body);
    const bankId = (name: string) => {
      const bank = banks.find((candidate) => candidate.name === name);
      if (bank === undefined) throw new Error(`VICE reports no ${name} memory bank`);
      return bank.id;
    };
    return new ViceAdapter(
      monitor,
      { c64: await registerIds(monitor, "c64"), drive8: await registerIds(monitor, "drive8") },
      { cpu: bankId("cpu"), ram: bankId("ram") },
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
}
