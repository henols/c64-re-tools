// Translates C64-domain operations into binary-monitor commands. VICE quirks
// and register/bank id lookups live here; callers never see monitor details.

import {
  WireFailure,
  type Comparison,
  type Condition,
  type Instruction,
  type JoystickState,
  type MemoryView,
  type RegisterValues,
  type Registers,
  type Space,
  type VideoStandard,
} from "../../protocol.ts";
import { decodeDisplay, decodePalette, encodePng, visibleFrame } from "./screen.ts";
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

const OPERATORS: Record<Comparison, string> = { eq: "==", ne: "!=", lt: "<", lte: "<=", gt: ">", gte: ">=" };

function hexByte(value: number): string {
  return `$${value.toString(16).padStart(2, "0")}`;
}

/**
 * Builds the VICE condition expression for a typed condition, for a
 * checkpoint in `space`. VICE evaluates strictly left to right, so every
 * comparison is parenthesized. Memory conditions work in the C64 space only.
 */
export function conditionExpression(condition: Condition, space: Space): string {
  const operator = (comparison: Comparison) => OPERATORS[comparison];
  switch (condition.kind) {
    case "register": {
      const prefix = space === "drive8" ? "8:" : "";
      return `(${prefix}${condition.register.toUpperCase()} ${operator(condition.operator)} ${hexByte(condition.value)})`;
    }
    case "memory": {
      if (condition.space !== "c64") {
        throw new WireFailure("unsupported-in-space", "A memory condition can test only space c64 memory.");
      }
      const address = `$${condition.address.toString(16).padStart(4, "0")}`;
      return `(@${condition.view}:${address} ${operator(condition.operator)} ${hexByte(condition.value)})`;
    }
    case "raster": {
      const line = `(RL == $${condition.line.toString(16)})`;
      return condition.cycle === undefined ? line : `(${line} && (CY >= $${condition.cycle.toString(16)}))`;
    }
  }
}

/** Lines a raster window spans, so a DMA stall cannot skip every instruction start in it. */
export const RASTER_WINDOW_LINES = 4;

function rasterLine(line: number): string {
  return `(RL == $${line.toString(16)})`;
}

/**
 * True at the first instruction start at or after raster position
 * (line, cycle): that line from the cycle on, or one of the next lines
 * (wrapping at the end of the frame).
 */
export function rasterWindowExpression(line: number, cycle: number, linesPerFrame: number): string {
  const parts = [`(${rasterLine(line)} && (CY >= $${cycle.toString(16)}))`];
  for (let offset = 1; offset < RASTER_WINDOW_LINES; offset++) parts.push(rasterLine((line + offset) % linesPerFrame));
  return parts.join(" || ");
}

/** True anywhere in RASTER_WINDOW_LINES lines from `line` (wrapping). */
export function rasterLinesExpression(line: number, linesPerFrame: number): string {
  const parts: string[] = [];
  for (let offset = 0; offset < RASTER_WINDOW_LINES; offset++) parts.push(rasterLine((line + offset) % linesPerFrame));
  return parts.join(" || ");
}

/** Whether a raster position lies inside the window rasterWindowExpression describes. */
export function inRasterWindow(position: { line: number; cycle: number }, line: number, cycle: number, linesPerFrame: number): boolean {
  if (position.line === line) return position.cycle >= cycle;
  const ahead = (position.line - line + linesPerFrame) % linesPerFrame;
  return ahead > 0 && ahead < RASTER_WINDOW_LINES;
}

/** The 12 opcodes that jam an NMOS 6502/6510. */
export const JAM_OPCODES = new Set([0x02, 0x12, 0x22, 0x32, 0x42, 0x52, 0x62, 0x72, 0x92, 0xb2, 0xd2, 0xf2]);

const DIRECTION_BITS: Record<JoystickState["direction"], number> = {
  center: 0,
  up: 0x01,
  down: 0x02,
  left: 0x04,
  right: 0x08,
  "up-left": 0x05,
  "up-right": 0x09,
  "down-left": 0x06,
  "down-right": 0x0a,
};

/** Control-port line levels as the CIA reads them: a pressed line is 0. */
export function joystickLines(state: JoystickState): number {
  return 0x1f & ~(DIRECTION_BITS[state.direction] | (state.fire ? 0x10 : 0));
}

function hex4(value: number): string {
  return value.toString(16).padStart(4, "0");
}

/**
 * Parses monitor disassembly lines such as ".C:e5cf  85 CC       STA $CC".
 * Hex numbers in the text become lowercase. A line that wraps past $ffff ends the list.
 */
export function parseDisassembly(answer: string, start: number): Instruction[] {
  const instructions: Instruction[] = [];
  for (const line of answer.split("\n")) {
    const match = /^\.(?:C|\d+):([0-9a-f]{4})\s+((?:[0-9a-f]{2} )*[0-9a-f]{2})\s+(.*?)\s*$/i.exec(line);
    if (match === null) continue;
    const address = Number.parseInt(match[1]!, 16);
    if (address < start || (instructions.length > 0 && address <= instructions.at(-1)!.address)) break;
    instructions.push({
      address,
      bytes: match[2]!.replace(/ /g, "").toLowerCase(),
      text: match[3]!.replace(/\$([0-9A-Fa-f]+)/g, (_all, digits: string) => `$${digits.toLowerCase()}`),
    });
  }
  return instructions;
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
  /** The C64's raster line and cycle registers. */
  readonly #rasterIds: { line: number; cycle: number };

  private constructor(
    monitor: BinaryMonitor,
    text: TextMonitor,
    registerIdsBySpace: Record<Space, RegisterIds>,
    banks: Record<MemoryView | "rom", number>,
    rasterIds: { line: number; cycle: number },
  ) {
    this.#monitor = monitor;
    this.#text = text;
    this.#registerIds = registerIdsBySpace;
    this.#banks = banks;
    this.#rasterIds = rasterIds;
  }

  /** Looks up the register and bank ids this VICE uses. Stops the machine. */
  static async create(monitor: BinaryMonitor, text: TextMonitor): Promise<ViceAdapter> {
    const banks = decodeBanks((await monitor.request(Command.banksAvailable)).body);
    const bankId = (name: string) => {
      const bank = banks.find((candidate) => candidate.name === name);
      if (bank === undefined) throw new Error(`VICE reports no ${name} memory bank`);
      return bank.id;
    };
    const c64Registers = decodeRegistersAvailable((await monitor.request(Command.registersAvailable, Buffer.from([Memspace.main]))).body);
    const rasterId = (name: string) => {
      const register = c64Registers.find((candidate) => candidate.name === name);
      if (register === undefined) throw new Error(`VICE reports no ${name} register`);
      return register.id;
    };
    return new ViceAdapter(
      monitor,
      text,
      { c64: await registerIds(monitor, "c64"), drive8: await registerIds(monitor, "drive8") },
      { cpu: bankId("cpu"), ram: bankId("ram"), rom: bankId("rom") },
      { line: rasterId("LIN"), cycle: rasterId("CYC") },
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

  /** The raster line and the cycle in it where the C64 stopped. */
  async rasterPosition(): Promise<{ line: number; cycle: number }> {
    const values = decodeRegisters((await this.#monitor.request(Command.registersGet, Buffer.from([Memspace.main]))).body);
    const value = (id: number) => {
      const register = values.find((candidate) => candidate.id === id);
      if (register === undefined) throw new Error("VICE returned no raster registers");
      return register.value;
    };
    return { line: value(this.#rasterIds.line), cycle: value(this.#rasterIds.cycle) };
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

  /**
   * Adds a stopping checkpoint over [start, end]: exec for a breakpoint;
   * load/store for a watchpoint. Returns its VICE number. Never temporary
   * (see addBreak).
   */
  async addCheckpoint(options: { start: number; end: number; operation: number; space: Space; enabled?: boolean }): Promise<number> {
    const body = Buffer.alloc(9);
    body.writeUInt16LE(options.start, 0);
    body.writeUInt16LE(options.end, 2);
    body[4] = 1; // stop when hit
    body[5] = options.enabled === false ? 0 : 1;
    body[6] = options.operation;
    body[7] = 0; // not temporary
    body[8] = MEMSPACE[options.space];
    const info = await this.#monitor.request(Command.checkpointSet, body);
    return info.body.readUInt32LE(0);
  }

  async setCondition(number: number, expression: string): Promise<void> {
    const text = Buffer.from(expression, "latin1");
    if (text.length > 255) throw new Error("condition expression is too long");
    const head = Buffer.alloc(5);
    head.writeUInt32LE(number, 0);
    head[4] = text.length;
    await this.#monitor.request(Command.conditionSet, Buffer.concat([head, text]));
  }

  async toggleCheckpoint(number: number, enabled: boolean): Promise<void> {
    const body = Buffer.alloc(5);
    body.writeUInt32LE(number, 0);
    body[4] = enabled ? 1 : 0;
    await this.#monitor.request(Command.checkpointToggle, body);
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

  /** Queues PETSCII bytes in VICE's keyboard buffer feed, at most 255 per command. */
  async feedKeyboard(bytes: Buffer): Promise<void> {
    for (let offset = 0; offset < bytes.length; offset += 255) {
      const chunk = bytes.subarray(offset, offset + 255);
      await this.#monitor.request(Command.keyboardFeed, Buffer.concat([Buffer.from([chunk.length]), chunk]));
    }
  }

  /**
   * Sets a control port's lines. The binary monitor drives VICE's "Joyport
   * I/O simulation" device, which the launch puts in both control ports; it
   * takes raw active-low line levels and 0-based port indexes.
   */
  async setJoystick(state: JoystickState): Promise<void> {
    const body = Buffer.alloc(4);
    body.writeUInt16LE(state.port - 1, 0);
    body.writeUInt16LE(joystickLines(state), 2);
    await this.#monitor.request(Command.joyportSet, body);
  }

  /** The last frame the VIC-II drew, visible area with borders, as PNG bytes. */
  async captureScreen(standard: VideoStandard): Promise<{ width: number; height: number; png: Buffer }> {
    const display = decodeDisplay((await this.#monitor.request(Command.displayGet, Buffer.from([1, 0]))).body);
    const palette = decodePalette((await this.#monitor.request(Command.paletteGet, Buffer.from([1]))).body);
    const frame = visibleFrame(display, standard);
    return { width: frame.width, height: frame.height, png: encodePng(frame, palette) };
  }

  /**
   * Runs text-monitor work with the monitor's default device and bank set to
   * a space and view, then restores the defaults (device c:, bank cpu).
   */
  async #inTextContext<T>(space: Space, view: MemoryView, work: () => Promise<T>): Promise<T> {
    if (space === "drive8" && view === "ram") {
      throw new WireFailure("unsupported-in-space", "view ram is available only in space c64; use view cpu for drive8.");
    }
    if (space === "drive8") await this.#text.command("dev 8:");
    else await this.#text.command(`bank ${view}`);
    try {
      return await work();
    } finally {
      if (space === "drive8") await this.#text.command("dev c:");
      else await this.#text.command("bank cpu");
    }
  }

  /** Finds a byte pattern (null = any byte) with the monitor's hunt. Returns match addresses, at most `limit`. */
  async search(options: { start: number; end: number; pattern: Array<number | null>; space: Space; view: MemoryView; limit: number }): Promise<number[]> {
    const tokens = options.pattern.map((token) => (token === null ? "xx" : token.toString(16).padStart(2, "0"))).join(" ");
    const answer = await this.#inTextContext(options.space, options.view, () =>
      this.#text.command(`hunt ${hex4(options.start)} ${hex4(options.end)} ${tokens}`, 30_000),
    );
    const matches: number[] = [];
    for (const line of answer.split("\n")) {
      const match = /^([0-9a-f]{4})$/i.exec(line.trim());
      if (match !== null) matches.push(Number.parseInt(match[1]!, 16));
      if (matches.length >= options.limit) break;
    }
    return matches;
  }

  /** Disassembles `count` instructions from `address` with the monitor; stops at the end of memory. */
  async disassemble(options: { address: number; count: number; space: Space; view: MemoryView }): Promise<Instruction[]> {
    const end = Math.min(0xffff, options.address + options.count * 3 - 1);
    const answer = await this.#inTextContext(options.space, options.view, () =>
      this.#text.command(`d ${hex4(options.address)} ${hex4(end)}`),
    );
    return parseDisassembly(answer, options.address).slice(0, options.count);
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
