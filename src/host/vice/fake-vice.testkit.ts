// A self-authored fake of stock VICE 3.10's two monitors, for deterministic
// unit tests of the session. It mirrors behavior probed on real VICE; real-VICE
// tests in test/integration/vice remain the evidence for that behavior.
//
// Mirrored behavior:
// - any binary command while running first sends a register event and a
//   stopped event, then answers;
// - exit answers, then sends a resumed event;
// - advance-instructions sends resumed, register and stopped events, then answers;
// - execute-until-return answers at once and stops later (see completeReturn);
// - reset answers and resumes at the reset vector; a breakpoint there stops
//   it only when the reset arrived while the machine was running;
// - setting a temporary checkpoint resumes the machine (unlike the manual says);
// - a text command stops a running machine the same way and answers after a
//   prompt; VICE's extra entry prompt is reproduced.

import { once } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer, type Server, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BinaryMonitor, Command, EVENT_REQUEST_ID } from "./binary-monitor.ts";
import type { ViceProcess } from "./process.ts";
import { TextMonitor } from "./text-monitor.ts";

function frame(type: number, requestId: number, body: Buffer = Buffer.alloc(0), error = 0): Buffer {
  const header = Buffer.alloc(12);
  header[0] = 0x02;
  header[1] = 0x02;
  header.writeUInt32LE(body.length, 2);
  header[6] = type;
  header[7] = error;
  header.writeUInt32LE(requestId, 8);
  return Buffer.concat([header, body]);
}

function u16(value: number): Buffer {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value & 0xffff, 0);
  return buffer;
}

function u32(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
}

const REGISTERS = [
  { id: 3, name: "PC", bits: 16 },
  { id: 0, name: "A", bits: 8 },
  { id: 1, name: "X", bits: 8 },
  { id: 2, name: "Y", bits: 8 },
  { id: 4, name: "SP", bits: 8 },
  { id: 5, name: "FL", bits: 8 },
];
const BANKS = [
  { id: 0, name: "default" },
  { id: 0, name: "cpu" },
  { id: 1, name: "ram" },
  { id: 2, name: "rom" },
  { id: 3, name: "io" },
];

export interface FakeCheckpoint {
  number: number;
  start: number;
  end: number;
  stop: boolean;
  enabled: boolean;
  operation: number;
  temporary: boolean;
  memspace: number;
  condition?: string;
  hits: number;
  ignore: number;
}

export class FakeVice {
  running = true;
  warp = false;
  /** Binary command bytes in arrival order. */
  readonly commands: number[] = [];
  /** Text monitor commands in arrival order (sentinels excluded). */
  readonly textCommands: string[] = [];
  /** c64 RAM; the cpu view and the ram view read the same bytes except $e000-$ffff, where cpu sees `rom`. */
  readonly ram = Buffer.alloc(0x10000);
  readonly rom = Buffer.alloc(0x10000);
  readonly drive = Buffer.alloc(0x10000);
  registers: Record<string, number> = { PC: 0xe5cf, A: 0x42, X: 3, Y: 0, SP: 0xf9, FL: 0b1010_0101 };
  driveRegisters: Record<string, number> = { PC: 0xec12, A: 0, X: 0, Y: 0, SP: 0x45, FL: 0b0010_0001 };
  readonly checkpoints = new Map<number, FakeCheckpoint>();
  /** PC a pending execute-until-return stops at when completeReturn() is called. */
  returnTo: number | undefined;
  /** PC the next advance-instructions ends at; defaults to PC + count. */
  stepTo: number | undefined;
  /** When set, binary commands get no answer (a hung VICE). */
  hung = false;
  /** Files given to autostart, with their run flag and index. */
  readonly autostarts: Array<{ file: string; run: boolean; index: number; bytes: Buffer }> = [];
  /** Disk images attached to drive 8. */
  readonly attached: Buffer[] = [];
  /** PETSCII fed to the keyboard buffer, in order. */
  readonly keyboard: number[] = [];
  /** Control-port line levels by 0-based joyport index; real VICE starts them at 0 (all pressed). */
  readonly joyport = [0x00, 0x00];
  readonly binaryServer: Server;
  readonly textServer: Server;
  #binary: Socket | undefined;
  #text: Socket | undefined;
  #nextCheckpoint = 1;
  /** Whether the command being handled found the machine running. */
  #enteredForCommand = false;

  constructor() {
    for (let address = 0; address < 0x10000; address++) {
      this.ram[address] = address & 0xff;
      this.rom[address] = (address >> 8) & 0xff;
    }
    // The KERNAL reset vector.
    this.rom[0xfffc] = 0xe2;
    this.rom[0xfffd] = 0xfc;
    this.binaryServer = createServer((socket) => this.#serveBinary(socket));
    this.textServer = createServer((socket) => this.#serveText(socket));
  }

  /** Starts both servers and returns a ViceProcess wired to them. */
  async start(): Promise<ViceProcess & { crash(): void; stopCount: number }> {
    for (const server of [this.binaryServer, this.textServer]) {
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
    }
    const monitor = await BinaryMonitor.connect((this.binaryServer.address() as { port: number }).port);
    const text = await TextMonitor.connect((this.textServer.address() as { port: number }).port);
    let exit!: (status: { code: number | null; signal: NodeJS.Signals | null }) => void;
    const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => (exit = resolve));
    const fake = this;
    const scratchDir = mkdtempSync(join(tmpdir(), "c64-re-tools-fake-vice-"));
    const handle = {
      pid: 0,
      scratchDir,
      monitor,
      text,
      exited,
      stopCount: 0,
      outputTail: () => "",
      async stop() {
        handle.stopCount++;
        await monitor.close();
        await text.close();
        fake.close();
        rmSync(scratchDir, { recursive: true, force: true });
      },
      crash() {
        fake.#binary?.destroy();
        fake.#text?.destroy();
        exit({ code: null, signal: "SIGSEGV" as NodeJS.Signals });
      },
    };
    return handle;
  }

  close(): void {
    this.binaryServer.close();
    this.textServer.close();
  }

  /** Stops the machine as a breakpoint does: a checkpoint-hit event, then the stop. */
  stopSpontaneously(pc: number): void {
    this.registers.PC = pc;
    const checkpoint: FakeCheckpoint = {
      number: 999,
      start: pc,
      end: pc,
      stop: true,
      enabled: true,
      operation: 0x04,
      temporary: false,
      memspace: 0,
      hits: 1,
      ignore: 0,
    };
    this.#binary!.write(frame(0x11, EVENT_REQUEST_ID, this.#checkpointBody(checkpoint, true)));
    this.#enterMonitor(this.#binary!);
  }

  /** Lets a pending execute-until-return reach its RTS and stop. */
  completeReturn(): void {
    if (this.returnTo === undefined || !this.running) throw new Error("no until-return is pending");
    this.registers.PC = this.returnTo;
    this.returnTo = undefined;
    this.#enterMonitor(this.#binary!);
  }

  #pc(): Buffer {
    return u16(this.registers.PC!);
  }

  #registerBody(memspace: number): Buffer {
    const values = memspace === 0 ? this.registers : this.driveRegisters;
    const items = REGISTERS.map((register) => Buffer.concat([Buffer.from([3, register.id]), u16(values[register.name]!)]));
    return Buffer.concat([u16(items.length), ...items]);
  }

  #enterMonitor(socket: Socket): void {
    if (!this.running) return;
    this.running = false;
    socket.write(Buffer.concat([frame(0x31, EVENT_REQUEST_ID, this.#registerBody(0)), frame(0x62, EVENT_REQUEST_ID, this.#pc())]));
  }

  #leaveMonitor(socket: Socket): void {
    this.running = true;
    socket.write(frame(0x63, EVENT_REQUEST_ID, this.#pc()));
    this.#checkExec(socket);
  }

  /** Simulates the first instruction after resuming: an enabled exec checkpoint at PC stops it. */
  #checkExec(socket: Socket): void {
    for (const checkpoint of this.checkpoints.values()) {
      const pc = this.registers.PC!;
      if (!checkpoint.enabled || !(checkpoint.operation & 0x04) || pc < checkpoint.start || pc > checkpoint.end) continue;
      checkpoint.hits++;
      socket.write(frame(0x11, EVENT_REQUEST_ID, this.#checkpointBody(checkpoint, true)));
      if (checkpoint.temporary) this.checkpoints.delete(checkpoint.number);
      if (checkpoint.stop) this.#enterMonitor(socket);
      return;
    }
  }

  #checkpointBody(checkpoint: FakeCheckpoint, hit: boolean): Buffer {
    return Buffer.concat([
      u32(checkpoint.number),
      Buffer.from([hit ? 1 : 0]),
      u16(checkpoint.start),
      u16(checkpoint.end),
      Buffer.from([checkpoint.stop ? 1 : 0, checkpoint.enabled ? 1 : 0, checkpoint.operation, checkpoint.temporary ? 1 : 0]),
      u32(checkpoint.hits),
      u32(checkpoint.ignore),
      Buffer.from([checkpoint.condition === undefined ? 0 : 1, checkpoint.memspace]),
    ]);
  }

  #serveBinary(socket: Socket): void {
    this.#binary = socket;
    let pending = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      pending = Buffer.concat([pending, chunk]);
      while (pending.length >= 11) {
        const length = pending.readUInt32LE(2);
        if (pending.length < 11 + length) break;
        const id = pending.readUInt32LE(6);
        const command = pending[10]!;
        const body = pending.subarray(11, 11 + length);
        pending = pending.subarray(11 + length);
        this.commands.push(command);
        if (this.hung) continue;
        this.#binaryCommand(socket, id, command, body);
      }
    });
    socket.on("error", () => {});
  }

  #binaryCommand(socket: Socket, id: number, command: number, body: Buffer): void {
    const answer = (payload: Buffer = Buffer.alloc(0), type = command) => socket.write(frame(type, id, payload));
    if (command === Command.advanceInstructions) {
      // VICE resumes, executes, stops, and only then answers.
      const count = body.readUInt16LE(1);
      socket.write(frame(0x63, EVENT_REQUEST_ID, this.#pc()));
      this.running = true;
      this.registers.PC = this.stepTo ?? (this.registers.PC! + count) & 0xffff;
      this.stepTo = undefined;
      this.#enterMonitor(socket);
      answer();
      return;
    }
    this.#enteredForCommand = this.running;
    this.#enterMonitor(socket);
    switch (command) {
      case Command.ping:
        return void answer();
      case Command.banksAvailable: {
        const items = BANKS.map((bank) =>
          Buffer.concat([Buffer.from([3 + bank.name.length]), u16(bank.id), Buffer.from([bank.name.length]), Buffer.from(bank.name)]),
        );
        return void answer(Buffer.concat([u16(items.length), ...items]));
      }
      case Command.registersAvailable: {
        const items = REGISTERS.map((register) =>
          Buffer.concat([Buffer.from([3 + register.name.length, register.id, register.bits, register.name.length]), Buffer.from(register.name)]),
        );
        return void answer(Buffer.concat([u16(items.length), ...items]));
      }
      case Command.registersGet:
        return void answer(this.#registerBody(body[0]!));
      case Command.memoryGet: {
        const start = body.readUInt16LE(1);
        const end = body.readUInt16LE(3);
        const memspace = body[5]!;
        const bank = body.readUInt16LE(6);
        const data = Buffer.alloc(end - start + 1);
        for (let address = start; address <= end; address++) {
          const source = memspace === 1 ? this.drive : bank === 2 || (bank === 0 && address >= 0xe000) ? this.rom : this.ram;
          data[address - start] = source[address]!;
        }
        return void answer(Buffer.concat([u16(data.length), data]));
      }
      case Command.memorySet: {
        const start = body.readUInt16LE(1);
        const memspace = body[5]!;
        const data = body.subarray(8);
        // Writes through the cpu view land in RAM under the ROMs, as on a real C64.
        data.copy(memspace === 1 ? this.drive : this.ram, start);
        return void answer();
      }
      case Command.registersSet: {
        const values = body[0] === 0 ? this.registers : this.driveRegisters;
        const count = body.readUInt16LE(1);
        let offset = 3;
        for (let index = 0; index < count; index++) {
          const size = body[offset]!;
          const register = REGISTERS.find((candidate) => candidate.id === body[offset + 1]);
          if (register !== undefined) values[register.name] = body.readUInt16LE(offset + 2);
          offset += size + 1;
        }
        return void answer(this.#registerBody(body[0]!), 0x31);
      }
      case Command.autostart: {
        const run = body[0] !== 0;
        const index = body.readUInt16LE(1);
        const file = body.subarray(4, 4 + body[3]!).toString("utf8");
        this.autostarts.push({ file, run, index, bytes: readFileSync(file) });
        answer();
        return this.#leaveMonitor(socket);
      }
      case Command.displayGet: {
        // A 504x312 PAL buffer as VICE 3.10 sends it: window at (136,51), border box from (104,15).
        const width = 504;
        const height = 312;
        const header = Buffer.alloc(4 + 13 + 4);
        header.writeUInt32LE(13, 0);
        header.writeUInt16LE(width, 4);
        header.writeUInt16LE(height, 6);
        header.writeUInt16LE(136, 8);
        header.writeUInt16LE(51, 10);
        header.writeUInt16LE(320, 12);
        header.writeUInt16LE(200, 14);
        header[16] = 8;
        header.writeUInt32LE(width * height, 17);
        const pixels = Buffer.alloc(width * height);
        for (let y = 15; y < 287; y++) {
          for (let x = 104; x < 488; x++) {
            const inner = x >= 136 && x < 456 && y >= 51 && y < 251;
            pixels[y * width + x] = inner ? this.ram[0xd021]! & 0x0f : this.ram[0xd020]! & 0x0f;
          }
        }
        return void answer(Buffer.concat([header, pixels]));
      }
      case Command.paletteGet: {
        const items = Array.from({ length: 16 }, (_, index) => Buffer.from([3, index * 16, index * 16, index * 16]));
        return void answer(Buffer.concat([u16(16), ...items]));
      }
      case Command.keyboardFeed:
        this.keyboard.push(...body.subarray(1, 1 + body[0]!));
        return void answer();
      case Command.joyportSet: {
        const port = body.readUInt16LE(0);
        if (port > 1) return void socket.write(frame(command, id, Buffer.alloc(0), 0x01));
        this.joyport[port] = body.readUInt16LE(2);
        return void answer();
      }
      case Command.exit:
        answer();
        return this.#leaveMonitor(socket);
      case Command.executeUntilReturn:
        answer();
        this.running = true;
        socket.write(frame(0x63, EVENT_REQUEST_ID, this.#pc()));
        return;
      case Command.reset: {
        // VICE resets the CPU from the monitor and resumes at the vector without
        // checking a breakpoint there; a reset that arrived while running (and so
        // entered the monitor at another PC) does stop at such a breakpoint.
        const enteredForThis = this.#enteredForCommand;
        answer();
        this.registers.PC = this.rom.readUInt16LE(0xfffc);
        if (enteredForThis) return this.#leaveMonitor(socket);
        this.running = true;
        socket.write(frame(0x63, EVENT_REQUEST_ID, this.#pc()));
        return;
      }
      case Command.checkpointSet: {
        const checkpoint: FakeCheckpoint = {
          number: this.#nextCheckpoint++,
          start: body.readUInt16LE(0),
          end: body.readUInt16LE(2),
          stop: body[4] !== 0,
          enabled: body[5] !== 0,
          operation: body[6]!,
          temporary: body[7] !== 0,
          memspace: body.length > 8 ? body[8]! : 0,
          hits: 0,
          ignore: 0,
        };
        this.checkpoints.set(checkpoint.number, checkpoint);
        answer(this.#checkpointBody(checkpoint, false), 0x11);
        if (checkpoint.temporary) this.#leaveMonitor(socket);
        return;
      }
      case Command.checkpointToggle: {
        const checkpoint = this.checkpoints.get(body.readUInt32LE(0));
        if (checkpoint === undefined) return void socket.write(frame(command, id, Buffer.alloc(0), 0x01));
        checkpoint.enabled = body[4] !== 0;
        return void answer();
      }
      case Command.conditionSet: {
        const checkpoint = this.checkpoints.get(body.readUInt32LE(0));
        if (checkpoint === undefined) return void socket.write(frame(command, id, Buffer.alloc(0), 0x01));
        checkpoint.condition = body.subarray(5, 5 + body[4]!).toString("latin1");
        return void answer();
      }
      case Command.checkpointDelete: {
        const deleted = this.checkpoints.delete(body.readUInt32LE(0));
        return void socket.write(frame(command, id, Buffer.alloc(0), deleted ? 0 : 0x01));
      }
      default:
        return void socket.write(frame(command, id, Buffer.alloc(0), 0x83));
    }
  }

  #load(file: string, address: string | undefined): string {
    if (!existsSync(file)) return `Cannot open '${file}'.\n`;
    const bytes = readFileSync(file);
    const start = address === undefined ? bytes.readUInt16LE(0) : Number.parseInt(address, 16);
    const data = bytes.subarray(2);
    data.copy(this.ram, start);
    const hex = (value: number, digits = 4) => value.toString(16).toUpperCase().padStart(digits, "0");
    return `Loading '${file}' from ${hex(start)} to ${hex(start + data.length - 1)} (${hex(data.length)} bytes)\n`;
  }

  #serveText(socket: Socket): void {
    this.#text = socket;
    let pending = "";
    socket.on("data", (chunk) => {
      pending += chunk.toString("latin1");
      let newline: number;
      while ((newline = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, newline);
        pending = pending.slice(newline + 1);
        this.#textCommand(socket, line);
      }
    });
    socket.on("error", () => {});
  }

  #textCommand(socket: Socket, line: string): void {
    const prompt = () => `(C:$${this.registers.PC!.toString(16).padStart(4, "0")}) `;
    const sentinel = /^~ \$([0-9a-f]{4})$/.exec(line);
    if (sentinel !== null) {
      const value = Number.parseInt(sentinel[1]!, 16);
      const binary = value.toString(2).padStart(16, "0");
      socket.write(`+${value}\n$${sentinel[1]}\n${value.toString(8).padStart(7, "0")}\n%${binary.slice(0, 8)} ${binary.slice(8)}\n${prompt()}`);
      return;
    }
    this.textCommands.push(line);
    let output = "";
    if (this.running) {
      // VICE enters the monitor: binary events, then an extra prompt on the text side.
      this.#enterMonitor(this.#binary!);
      output += prompt();
    }
    const load = /^load "([^"]+)" 0(?: \$([0-9a-f]{4}))?$/.exec(line);
    const attach = /^attach "([^"]+)" 8$/.exec(line);
    if (line === "warp") output += `Warp mode is ${this.warp ? "on" : "off"}.\n`;
    else if (line === "warp on") this.warp = true;
    else if (line === "warp off") this.warp = false;
    else if (load !== null) output += this.#load(load[1]!, load[2]);
    else if (attach !== null) {
      // VICE prints nothing when it attaches an image and "Failed." when it cannot.
      const ok = existsSync(attach[1]!) && statSync(attach[1]!).size === 174848;
      if (ok) this.attached.push(readFileSync(attach[1]!));
      else output += "Failed.\n";
    } else output += "ERROR -- Wrong syntax:\n";
    socket.write(`${output}${prompt()}`);
  }
}
