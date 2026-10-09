// Translates C64-domain operations into binary-monitor commands. VICE quirks
// and register/bank id lookups live here; callers never see monitor details.

import {
  WireFailure,
  type Comparison,
  type Condition,
  type BacktraceFrame,
  type HistoryEntry,
  type Instruction,
  type MemmapRange,
  type ProfileEntry,
  type JoystickState,
  type MemoryView,
  type RegisterValues,
  type Registers,
  type Space,
  type VideoStandard,
} from "../../protocol.ts";
import { decodeDisplay, decodePalette, visibleFrame, type IndexedFrame } from "./screen.ts";
import type { TextMonitor } from "./text-monitor.ts";
import {
  BinaryMonitor,
  Command,
  decodeBanks,
  decodeMemory,
  decodeRegisters,
  decodeRegistersAvailable,
  memoryGetBody,
  Memspace,
  type RegisterInfo,
} from "./binary-monitor.ts";

const MEMSPACE: Record<Space, number> = { c64: Memspace.main, drive8: Memspace.drive8 };

/** The 6502 registers the domain needs, by VICE register name. */
const REGISTER_NAMES = { pc: "PC", a: "A", x: "X", y: "Y", sp: "SP", flags: "FL" } as const;
type RegisterKey = keyof typeof REGISTER_NAMES;
type RegisterIds = Record<RegisterKey, number>;

async function availableRegisters(monitor: BinaryMonitor, space: Space): Promise<RegisterInfo[]> {
  return decodeRegistersAvailable((await monitor.request(Command.registersAvailable, Buffer.from([MEMSPACE[space]]))).body);
}

/** The id of the register `name` among the registers VICE reports for `space`. */
function registerId(available: RegisterInfo[], name: string, space: Space): number {
  const register = available.find((candidate) => candidate.name === name);
  if (register === undefined) throw new Error(`VICE reports no ${name} register for ${space}`);
  return register.id;
}

function registerIds(available: RegisterInfo[], space: Space): RegisterIds {
  const id = (key: RegisterKey) => registerId(available, REGISTER_NAMES[key], space);
  return { pc: id("pc"), a: id("a"), x: id("x"), y: id("y"), sp: id("sp"), flags: id("flags") };
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
const RASTER_WINDOW_LINES = 4;

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
 * An answer with no instruction but other text is refused.
 */
export function parseDisassembly(answer: string, start: number): Instruction[] {
  const instructions: Instruction[] = [];
  const unknown: string[] = [];
  for (const line of answer.split("\n")) {
    const match = /^\.(?:C|\d+):([0-9a-f]{4})\s+((?:[0-9a-f]{2} )*[0-9a-f]{2})\s+(.*?)\s*$/i.exec(line);
    if (match === null) {
      if (line.trim() !== "") unknown.push(line.trim());
      continue;
    }
    const address = Number.parseInt(match[1]!, 16);
    if (address < start || (instructions.length > 0 && address <= instructions.at(-1)!.address)) break;
    instructions.push({
      address,
      bytes: match[2]!.replace(/ /g, "").toLowerCase(),
      text: match[3]!.replace(/\$([0-9A-Fa-f]+)/g, (_all, digits: string) => `$${digits.toLowerCase()}`),
    });
  }
  if (instructions.length === 0 && unknown.length > 0) throw unknownForm("disassembly", unknown);
  return instructions;
}

/**
 * Parses monitor CPU history lines such as
 * ".C:e5cd  A5 C6       LDA $C6        A:00 X:00 Y:0a SP:f3 ..-...Z.      2535609".
 * An answer with no entry but other text is refused.
 */
export function parseHistory(answer: string): Array<Omit<HistoryEntry, "rasterLine" | "rasterCycle"> & { clock: bigint }> {
  const entries = [];
  const unknown: string[] = [];
  for (const line of answer.split("\n")) {
    const match =
      /^\.(?:C|\d+):([0-9a-f]{4})\s+((?:[0-9a-f]{2} )*[0-9a-f]{2})\s+(.*?)\s+A:([0-9a-f]{2}) X:([0-9a-f]{2}) Y:([0-9a-f]{2}) SP:([0-9a-f]{2})\s+\S+\s+(\d+)\s*$/i.exec(
        line,
      );
    if (match === null) {
      if (line.trim() !== "") unknown.push(line.trim());
      continue;
    }
    entries.push({
      address: Number.parseInt(match[1]!, 16),
      bytes: match[2]!.replace(/ /g, "").toLowerCase(),
      text: match[3]!.replace(/\$([0-9A-Fa-f]+)/g, (_all, digits: string) => `$${digits.toLowerCase()}`),
      a: Number.parseInt(match[4]!, 16),
      x: Number.parseInt(match[5]!, 16),
      y: Number.parseInt(match[6]!, 16),
      sp: Number.parseInt(match[7]!, 16),
      clock: BigInt(match[8]!),
    });
  }
  if (entries.length === 0 && unknown.length > 0) throw unknownForm("CPU history", unknown);
  return entries;
}

/**
 * Parses the addresses that the monitor's hunt prints, one per line; at most
 * `limit` come back. An empty answer means no match. An answer with no
 * address but other text is refused.
 */
export function parseHunt(answer: string, limit: number): number[] {
  const matches: number[] = [];
  const unknown: string[] = [];
  for (const line of answer.split("\n")) {
    const match = /^([0-9a-f]{4})$/i.exec(line.trim());
    if (match === null) {
      if (line.trim() !== "") unknown.push(line.trim());
      continue;
    }
    if (matches.length < limit) matches.push(Number.parseInt(match[1]!, 16));
  }
  if (matches.length === 0 && unknown.length > 0) throw unknownForm("search result", unknown);
  return matches;
}

/**
 * Reconstructs the JSR call chain from the stack, most recent first. VICE's own
 * backtrace keeps stale entries across resets and interrupts and can miss the
 * current call, so the stack itself is the evidence: from SP+1 upward, a pushed
 * return address R is accepted when the byte at R-2 is a JSR opcode; that JSR's
 * target is the routine, and it returns to R+1. Interrupt frames are skipped.
 * A best estimate: data on the stack can look like a return address.
 */
export function backtraceFromStack(sp: number, memory: Uint8Array, depth: number): BacktraceFrame[] {
  const frames: BacktraceFrame[] = [];
  let at = sp + 1;
  while (at <= 0xfe && frames.length < depth) {
    const pushed = memory[0x0100 + at]! | (memory[0x0100 + at + 1]! << 8);
    const jsr = (pushed - 2) & 0xffff;
    if (memory[jsr] === 0x20) {
      frames.push({ address: memory[(jsr + 1) & 0xffff]! | (memory[(jsr + 2) & 0xffff]! << 8), returnAddress: (pushed + 1) & 0xffff });
      at += 2;
    } else {
      at += 1;
    }
  }
  return frames;
}

/**
 * Parses "profile flat" rows such as "36399   1.9%   19318   1.0% e9ff": total
 * cycles, total share, self cycles, self share, routine. Rows that do not name
 * a routine address (ROOT) are skipped.
 */
export function parseProfile(answer: string): ProfileEntry[] {
  const entries: ProfileEntry[] = [];
  const unknown: string[] = [];
  for (const line of answer.split("\n")) {
    // Counts can carry the host locale's digit grouping ("1,123,200") and the percent a decimal comma.
    const row = new RegExp(`^\\s*(${COUNT})\\s+[\\d.,]+%\\s+(${COUNT})\\s+([\\d.,]+)%\\s+(\\S+)\\s*$`).exec(line);
    if (row === null) {
      if (line.trim() !== "" && !/^Total\s+%\s+Self\s+%$/.test(line.trim()) && !/^[-\s]+$/.test(line)) unknown.push(line.trim());
      continue;
    }
    // A row named ROOT or by a label has no routine address.
    if (!/^[0-9a-f]{4}$/i.test(row[4]!)) continue;
    entries.push({ address: Number.parseInt(row[4]!, 16), totalCycles: digits(row[1]!), selfCycles: digits(row[2]!), percent: Number(row[3]!.replace(",", ".")) });
  }
  // An answer in another form must not read as "nothing ran".
  if (entries.length === 0 && unknown.length > 0) throw unknownForm("profile", unknown);
  return entries;
}

/** A count, perhaps grouped by thousands with a comma, a dot, an apostrophe or a (narrow) space. */
const COUNT = "\\d{1,3}(?:[,.'\\u00a0\\u202f ]\\d{3})+|\\d+";
const digits = (count: string) => count.replace(/\D/g, "");

function unknownForm(what: string, lines: string[]): WireFailure {
  return new WireFailure("operation-failed", `VICE printed the ${what} in a form that c64-re-tools does not read: ${JSON.stringify(lines.slice(0, 3))}`);
}

/**
 * Parses memmap rows such as "00c2: --- --- rw- (uninitialized read)": the I/O,
 * ROM and RAM access flags of one address. Adjacent addresses with the same
 * combined flags merge into one range; at most `maxRanges` come back.
 */
export function parseMemmap(answer: string, maxRanges: number): MemmapRange[] {
  const ranges: MemmapRange[] = [];
  const unknown: string[] = [];
  for (const line of answer.split("\n")) {
    const match = /^([0-9a-f]{4}): (\S{3}) (\S{3}) (\S{3})/i.exec(line);
    if (match === null) {
      if (line.trim() !== "" && !/^addr:\s+IO\s+ROM\s+RAM$/.test(line.trim())) unknown.push(line.trim());
      continue;
    }
    const address = Number.parseInt(match[1]!, 16);
    const flags = match[2]! + match[3]! + match[4]!;
    const access = { execute: flags.includes("x"), read: flags.includes("r"), write: flags.includes("w") };
    const last = ranges.at(-1);
    if (last !== undefined && last.end === address - 1 && last.execute === access.execute && last.read === access.read && last.write === access.write) {
      last.end = address;
      continue;
    }
    if (ranges.length >= maxRanges) break;
    ranges.push({ start: address, end: address, ...access });
  }
  if (ranges.length === 0 && unknown.length > 0) throw unknownForm("memory map", unknown);
  return ranges;
}

/**
 * Lines VICE prints when a checkpoint stops the machine during a text command:
 * "#1 (Stop on  exec c000)  101/$065,  20/$14", then the instruction there.
 */
const STOP_LINE = /^(?:#\d+ \((?:Stop on|Trace)\s|\.(?:C|\d+):[0-9a-f]{4}\s)/i;

/** The lines of a text command's answer that are not blank, not a stop line and not `known`. */
function otherLines(answer: string, known?: RegExp): string[] {
  return answer
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !STOP_LINE.test(line) && known?.test(line) !== true);
}

/** Refuses the answer of a text command that prints nothing, or only `known` lines, when it works. */
function expectQuiet(what: string, answer: string, known?: RegExp): void {
  const other = otherLines(answer, known);
  if (other.length > 0) throw unknownForm(what, other);
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

/** Generous bound for commands that run the machine (step/next): they answer only once it stops again. */
export const RUNNING_COMMAND_TIMEOUT_MS = 30_000;

/**
 * Domain operations over one binary-monitor connection. Every method sends
 * monitor commands, and any monitor command stops the machine; restoring the
 * run state is the session's job.
 */
export class ViceAdapter {
  readonly #monitor: BinaryMonitor;
  readonly #text: TextMonitor;
  readonly #registerIds: Record<Space, RegisterIds>;
  readonly #banks: Record<MemoryView | "rom" | "io", number>;
  /** The C64's raster line and cycle registers. */
  readonly #rasterIds: { line: number; cycle: number };
  /** VICE numbers of the checkpoints set in drive 8's memory space. */
  readonly #driveCheckpoints = new Set<number>();

  private constructor(
    monitor: BinaryMonitor,
    text: TextMonitor,
    registerIdsBySpace: Record<Space, RegisterIds>,
    banks: Record<MemoryView | "rom" | "io", number>,
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
    const c64Registers = await availableRegisters(monitor, "c64");
    const driveRegisters = await availableRegisters(monitor, "drive8");
    return new ViceAdapter(
      monitor,
      text,
      { c64: registerIds(c64Registers, "c64"), drive8: registerIds(driveRegisters, "drive8") },
      { cpu: bankId("cpu"), ram: bankId("ram"), rom: bankId("rom"), io: bankId("io") },
      { line: registerId(c64Registers, "LIN", "c64"), cycle: registerId(c64Registers, "CYC", "c64") },
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

  /** Reads C64 I/O registers through the I/O bank, whatever the CPU has banked in, without side effects. */
  async readIo(start: number, size: number): Promise<Uint8Array> {
    const response = await this.#monitor.request(
      Command.memoryGet,
      memoryGetBody({ start, end: start + size - 1, memspace: Memspace.main, bank: this.#banks.io }),
    );
    return decodeMemory(response.body);
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

  /**
   * Waits, with no time limit, until VICE answers a ping: VICE answers in
   * order, so every binary command sent before it has run. Stops the machine.
   */
  async answered(): Promise<void> {
    await this.#monitor.request(Command.ping, new Uint8Array(0), Infinity);
  }

  /**
   * Runs a text command that acts on the monitor's default device, with the
   * computer as that device. VICE makes drive 8 the default device when a
   * drive checkpoint stops the machine, and commands such as
   * load, d, hunt, mmsh and stopwatch then act on the drive instead.
   */
  async #computerText(command: string, timeoutMs?: number): Promise<string> {
    await this.#text.command("dev c:");
    return timeoutMs === undefined ? this.#text.command(command) : this.#text.command(command, timeoutMs);
  }

  /** Waits, with no time limit, until a harmless text command has run, so every text command sent before it has run. */
  async drainText(): Promise<void> {
    await this.#text.command("~ $0000", Infinity);
  }

  /** Executes `count` C64 instructions, with subroutine calls as one when `over`. Answers once stopped again. */
  async step(count: number, over: boolean, timeoutMs = RUNNING_COMMAND_TIMEOUT_MS): Promise<void> {
    const body = Buffer.alloc(3);
    body[0] = over ? 1 : 0;
    body.writeUInt16LE(count, 1);
    await this.#monitor.request(Command.advanceInstructions, body, timeoutMs);
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
   * Never a VICE "temporary" checkpoint: in VICE, setting one resumes
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
    const number = info.body.readUInt32LE(0);
    if (options.space === "drive8") this.#driveCheckpoints.add(number);
    return number;
  }

  /** True for a checkpoint in drive 8's memory space: its stop leaves the computer's CPU between two cycles of an instruction. */
  isDriveCheckpoint(number: number): boolean {
    return this.#driveCheckpoints.has(number);
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
    this.#driveCheckpoints.delete(number);
  }

  /**
   * Loads a PRG file from the host file system into memory, where the CPU
   * would write it, without reset or start. With `address`, the file's own
   * load address is skipped. Returns where it went.
   */
  async loadProgram(file: string, address?: number): Promise<{ loadAddress: number; size: number }> {
    const target = address === undefined ? "" : ` $${address.toString(16).padStart(4, "0")}`;
    const answer = await this.#computerText(`load ${quoted(file)} 0${target}`);
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
    // VICE prints nothing when the image attaches, and "Failed." when it does not.
    const other = otherLines(answer);
    if (other.includes("Failed.")) throw new WireFailure("media-error", "The emulator could not attach the disk image.");
    if (other.length > 0) throw unknownForm("disk attach answer", other);
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

  /** The last frame the VIC-II drew, visible area with borders, with VICE's palette. */
  async captureFrame(standard: VideoStandard): Promise<{ frame: IndexedFrame; palette: Array<[number, number, number]> }> {
    const display = decodeDisplay((await this.#monitor.request(Command.displayGet, Buffer.from([1, 0]))).body);
    const palette = decodePalette((await this.#monitor.request(Command.paletteGet, Buffer.from([1]))).body);
    return { frame: visibleFrame(display, standard), palette };
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
    else await this.#computerText(`bank ${view}`);
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
    return parseHunt(answer, options.limit);
  }

  /** Disassembles `count` instructions from `address` with the monitor; stops at the end of memory. */
  async disassemble(options: { address: number; count: number; space: Space; view: MemoryView }): Promise<Instruction[]> {
    const end = Math.min(0xffff, options.address + options.count * 3 - 1);
    const answer = await this.#inTextContext(options.space, options.view, () =>
      this.#text.command(`d ${hex4(options.address)} ${hex4(end)}`),
    );
    return parseDisassembly(answer, options.address).slice(0, options.count);
  }

  /** The last `limit` instructions the CPU of a space executed, oldest first, with the clock each started at. */
  async history(limit: number, space: Space): Promise<Array<Omit<HistoryEntry, "rasterLine" | "rasterCycle"> & { clock: bigint }>> {
    const answer = await this.#text.command(`chis ${limit} ${space === "drive8" ? "8:" : "c:"}`);
    // Some VICE builds print one more, older entry than asked for; the newest count.
    return parseHistory(answer).slice(-limit);
  }

  /** The current CPU cycle count of the computer. */
  async clock(): Promise<bigint> {
    const answer = await this.#computerText("stopwatch");
    const match = /Stopwatch:\s+(\d+)/.exec(answer);
    if (match === null) throw unknownForm("stopwatch", answer.split("\n"));
    return BigInt(match[1]!);
  }

  /** The CPU's view of all 64 KiB of a space at once, for whole-memory analyses. */
  async readAll(space: Space): Promise<Uint8Array> {
    const response = await this.#monitor.request(
      Command.memoryGet,
      memoryGetBody({ start: 0x0000, end: 0xffff, memspace: MEMSPACE[space], bank: space === "c64" ? this.#banks.cpu : 0 }),
    );
    const memory = decodeMemory(response.body);
    if (memory.length !== 0x10000) throw new Error(`VICE returned ${memory.length} bytes for a 64 KiB read`);
    return memory;
  }

  /** Saves the whole machine, attached disks included, to a host file. */
  async saveSnapshot(file: string): Promise<void> {
    const name = Buffer.from(file, "utf8");
    if (name.length > 255) throw new Error("snapshot file path is too long");
    // Byte 0: no ROMs (VICE has them). Byte 1: save disks, so a restore gets the disk state too.
    await this.#monitor.request(Command.dump, Buffer.concat([Buffer.from([0, 1, name.length]), name]), 30_000);
  }

  /** Restores the machine from a snapshot file. The machine stays stopped. */
  async restoreSnapshot(file: string): Promise<void> {
    const name = Buffer.from(file, "utf8");
    if (name.length > 255) throw new Error("snapshot file path is too long");
    await this.#monitor.request(Command.undump, Buffer.concat([Buffer.from([name.length]), name]), 30_000);
  }

  async startProfiler(): Promise<void> {
    expectQuiet("profiler answer", await this.#computerText("profile on"), /^Profiling (?:re)?started\.$/);
  }

  /** The routines with the most self time, from VICE's profiler. */
  async profile(limit: number): Promise<ProfileEntry[]> {
    return parseProfile(await this.#computerText(`profile flat ${limit}`)).slice(0, limit);
  }

  /** How the C64 CPU accessed [start, end] since the memmap was last cleared, as merged ranges. */
  async memmap(start: number, end: number, maxRanges: number): Promise<MemmapRange[]> {
    // The first argument is the access mask ("ioRWXrwx"); ff shows every kind of access.
    return parseMemmap(await this.#computerText(`mmsh ff ${hex4(start)} ${hex4(end)}`, 60_000), maxRanges);
  }

  async clearMemmap(): Promise<void> {
    expectQuiet("memory map answer", await this.#computerText("mmzap"));
  }

  async warp(): Promise<boolean> {
    const answer = await this.#text.command("warp");
    const match = /Warp mode is (on|off)/.exec(answer);
    if (match === null) throw unknownForm("warp state", answer.split("\n"));
    return match[1] === "on";
  }

  async setWarp(enabled: boolean): Promise<void> {
    expectQuiet("warp answer", await this.#text.command(enabled ? "warp on" : "warp off"));
  }
}
