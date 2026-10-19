// One ZX Spectrum session on one ZEsarUX: the operations of protocol/spectrum.ts
// over ZRCP. The CPU is stopped in ZEsarUX's step mode; a run is a ZRCP run
// command that ends at a breakpoint, at the frame or timeout breakpoint of the
// session, or when pause sends data. Work is serialized.
//
// ZRCP breakpoint slots 1-90 hold the breakpoints of the agent; slot 99 is the
// target of run_until and slot 100 the end of a frame count (TSTATESP). The
// partial t-state counter of ZEsarUX is the clock of the session: the session
// never resets it.

import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { COVERAGE } from "../../cpu/coverage.ts";
import { Z80 } from "../../cpu/z80.ts";
import { encodePng, SPECTRUM_PALETTE, spectrumScreenFrame } from "../../graphics.ts";
import type { MachineId } from "../../machine.ts";
import type { ProcessSupervisor } from "../../native/processes.ts";
import { WireFailure } from "../../protocol/messages.ts";
import {
  SPECTRUM_OPERATIONS,
  spectrumAttachmentCount,
  validateSpectrumParams,
  type SpectrumOperation,
  type SpectrumOperations,
  type SpectrumPoint,
  type SpectrumRunState,
  type SpectrumStop,
  type SpectrumStopReason,
  type Z80RegisterValues,
} from "../../protocol/spectrum.ts";
import { writeZ80, type SpectrumSnapshot } from "../../spectrum.ts";
import type { MachineBackend, SessionHandle } from "../server.ts";
import { launchZesarux, type ZesaruxProcess } from "./process.ts";

const FRAME_TSTATES = { "48k": 69_888, "128k": 70_908 } as const;
const TARGET_SLOT = 99;
const FRAMES_SLOT = 100;
const MAX_USER_SLOT = 90;
/** How long a key stays down and up when the session types text, in frames: the ROM reads the keyboard once a frame. */
const KEY_FRAMES = 3;

/** The keyboard: each key's row (the port $xxfe high byte order of set-ui-io-ports) and bit. */
const KEY_MATRIX: Record<string, [row: number, bit: number]> = {};
const ROWS = [
  ["caps", "z", "x", "c", "v"],
  ["a", "s", "d", "f", "g"],
  ["q", "w", "e", "r", "t"],
  ["1", "2", "3", "4", "5"],
  ["0", "9", "8", "7", "6"],
  ["p", "o", "i", "u", "y"],
  ["enter", "l", "k", "j", "h"],
  ["space", "symbol", "m", "n", "b"],
];
ROWS.forEach((keys, row) => keys.forEach((key, bit) => (KEY_MATRIX[key] = [row, bit])));
export const SPECTRUM_KEYS = Object.keys(KEY_MATRIX);

/** The keys that type one ASCII character: a key, CAPS SHIFT with a letter, or SYMBOL SHIFT with a key. */
const SYMBOLS: Record<string, string> = { '"': "p", ",": "n", ".": "m", ":": "z", ";": "o", "+": "k", "-": "j", "=": "l", "*": "b", "/": "v", "?": "c", "(": "8", ")": "9", "$": "4", "!": "1", "<": "r", ">": "t", _: "0", "#": "3", "%": "5", "&": "6", "'": "7", "@": "2", "^": "h" };
export function keysOf(char: string): string[] {
  if (char === " ") return ["space"];
  if (char === "\n") return ["enter"];
  if (/[a-z0-9]/.test(char)) return [char];
  if (/[A-Z]/.test(char)) return ["caps", char.toLowerCase()];
  const symbol = SYMBOLS[char];
  if (symbol !== undefined) return ["symbol", symbol];
  throw new WireFailure("invalid-input", `${JSON.stringify(char)} has no key on the Spectrum keyboard.`);
}

const hex4 = (value: number) => value.toString(16).padStart(4, "0");

/** The registers that get-registers and the end of a run print. */
export function parseRegisters(text: string): Z80RegisterValues {
  const field = (name: string) => {
    const match = new RegExp(`(?:^|\\s)${name.replace("'", "\\'")}=([0-9a-f]+)`, "i").exec(text);
    if (match === null) throw new WireFailure("operation-failed", `ZEsarUX gave no ${name} register: ${text.slice(0, 200)}`);
    return Number.parseInt(match[1]!, 16);
  };
  const iff = /IFF([1-])([2-])/.exec(text);
  return {
    pc: field("PC"),
    sp: field("SP"),
    af: field("AF"),
    bc: field("BC"),
    de: field("DE"),
    hl: field("HL"),
    ix: field("IX"),
    iy: field("IY"),
    af2: field("AF'"),
    bc2: field("BC'"),
    de2: field("DE'"),
    hl2: field("HL'"),
    i: field("I"),
    r: field("R"),
    im: Number(/IM([012])/.exec(text)?.[1] ?? 0),
    iff1: iff?.[1] === "1",
    iff2: iff?.[2] === "2",
  };
}

/** The addresses with a count above 0 in a visual memory dump ("8000H 1 1", one value per address from the first). */
export function visualmemAddresses(text: string): number[] {
  const addresses: number[] = [];
  for (const line of text.split("\n")) {
    const match = /^([0-9a-f]+)H((?:\s+\d+)+)/i.exec(line.trim());
    if (match === null) continue;
    const start = Number.parseInt(match[1]!, 16);
    match[2]!
      .trim()
      .split(/\s+/)
      .forEach((count, offset) => {
        if (Number(count) > 0) addresses.push(start + offset);
      });
  }
  return addresses;
}

interface Point extends SpectrumPoint {
  /** The ZRCP breakpoint slot of a breakpoint. */
  slot?: number;
}

export class ZesaruxSession implements SessionHandle {
  readonly #zesarux: ZesaruxProcess;
  readonly #model: "48k" | "128k";
  readonly #log: (line: string) => void;
  #queue: Promise<unknown> = Promise.resolve();
  #state: SpectrumRunState = "stopped";
  #run: Promise<string> | undefined;
  #stop: { reason?: SpectrumStopReason; pointId?: number; pc?: number } = {};
  readonly #points = new Map<number, Point>();
  #nextId = 1;
  #clockBase = 0;
  /** The coverage of the session: one COVERAGE byte per address, joined from the visual memory dumps. */
  readonly #coverage = new Uint8Array(0x10000);
  /** The keys that are down, and the Kempston joystick: the nine values of set-ui-io-ports. */
  readonly #rows = new Array<number>(8).fill(0x1f);
  #joystick = 0;
  readonly #snapshots: string;

  private constructor(zesarux: ZesaruxProcess, model: "48k" | "128k", log: (line: string) => void) {
    this.#zesarux = zesarux;
    this.#model = model;
    this.#log = log;
    this.#snapshots = join(zesarux.scratch, "snapshots");
  }

  static async start(options: { supervisor: ProcessSupervisor; machine: MachineId; env?: NodeJS.ProcessEnv; log?: (line: string) => void }): Promise<ZesaruxSession> {
    const log = options.log ?? (() => {});
    const zesarux = await launchZesarux({ ...options, log });
    const session = new ZesaruxSession(zesarux, options.machine === "spectrum128" ? "128k" : "48k", log);
    try {
      await session.#zrcp("enter-cpu-step");
      await session.#zrcp("enable-breakpoints");
      await session.#zrcp("cpu-history enabled yes");
      await session.#zrcp("cpu-history started yes");
      await session.#drainVisualmem();
      session.#coverage.fill(0);
      session.#clockBase = await session.#clock();
    } catch (error) {
      await zesarux.stop();
      throw error;
    }
    return session;
  }

  #zrcp(text: string): Promise<string> {
    return this.#zesarux.zrcp.command(text);
  }

  handle(op: string, params: unknown, attachments: Buffer[] = [], reply: Buffer[] = []): Promise<unknown> {
    const run = this.#queue.then(() => this.#run_(op as SpectrumOperation, params, attachments, reply));
    this.#queue = run.catch(() => {});
    return run;
  }

  async close(): Promise<void> {
    if (this.#run !== undefined) this.#zesarux.zrcp.interrupt();
    await this.#zesarux.stop();
    this.#log("Spectrum session closed");
  }

  async #run_(op: SpectrumOperation, params: unknown, attachments: Buffer[], reply: Buffer[]): Promise<unknown> {
    const p = params as never;
    // A run holds the ZRCP connection until the CPU stops: only these operations work while it runs.
    if (this.#state === "running" && !["status", "execution", "reset", "autostart"].includes(op)) {
      throw new WireFailure("machine-running", "The CPU runs. Stop it first with execution action pause.");
    }
    switch (op) {
      case "status":
        return this.#status();
      case "reset":
        return this.#reset(p);
      case "execution":
        return this.#execution(p);
      case "runUntil":
        return this.#runUntil(p);
      case "breakpoint":
        return this.#breakpoint(p);
      case "watchpoint":
        return this.#watchpoint(p);
      case "memoryRead": {
        const { address, size } = params as SpectrumOperations["memoryRead"]["params"];
        return { address, data: await this.#read(address, size) };
      }
      case "memoryWrite":
        return this.#write(p);
      case "registersGet":
        return this.#registers();
      case "registersSet":
        return this.#setRegisters(p);
      case "disassemble":
        return this.#disassemble(p);
      case "cpuHistory":
        return this.#history(p);
      case "memmap":
        return this.#memmap(p);
      case "screen":
        return this.#screen(reply);
      case "keyboard":
        return this.#type(p);
      case "keys":
        return this.#keys(p);
      case "joystick":
        return this.#setJoystick(p);
      case "autostart":
        return this.#autostart(p, attachments[0]!);
      case "programLoad":
        return this.#programLoad(p, attachments[0]!);
      case "snapshot":
        return this.#snapshot(p);
      case "snapshotExport":
        return this.#export(reply);
      case "timing":
        return this.#timing(p);
      case "ula":
        return this.#ula();
      case "ay":
        return this.#ay();
    }
    throw new WireFailure("invalid-input", `unknown operation: ${String(op)}`);
  }

  // ---- Run control ----

  #requireStopped(): void {
    if (this.#state === "running") throw new WireFailure("machine-running", "The CPU runs. Stop it first with execution action pause.");
  }

  async #clock(): Promise<number> {
    const text = await this.#zrcp("get-tstates-partial");
    const value = Number.parseInt(text.trim(), 10);
    if (!Number.isFinite(value)) throw new WireFailure("operation-failed", `ZEsarUX gave no t-state count: ${text}`);
    return value;
  }

  /** The stop that the end of a run command gives: its PC and why it stopped. */
  #stopOf(output: string): { pc: number; reason?: SpectrumStopReason; pointId?: number } {
    const pc = parseRegisters(output).pc;
    const fired = /Breakpoint fired: (.*)/.exec(output)?.[1]?.trim();
    if (fired === undefined) return { pc };
    if (fired.startsWith("TSTATESP")) return { pc, reason: "frames" };
    if (fired === `PC=${hex4(this.#target ?? -1)}H`) return { pc, reason: "target" };
    const memory = /Memory Breakpoint \w+ Address: ([0-9a-f]+)H/i.exec(fired);
    if (memory !== null) {
      const at = Number.parseInt(memory[1]!, 16);
      const point = [...this.#points.values()].find((item) => item.kind === "watchpoint" && at >= item.start && at <= item.end);
      return { pc, reason: "watchpoint", ...(point === undefined ? {} : { pointId: point.id }) };
    }
    const point = [...this.#points.values()].find((item) => item.kind === "breakpoint" && fired === `PC=${hex4(item.start)}H`);
    return { pc, reason: "breakpoint", ...(point === undefined ? {} : { pointId: point.id }) };
  }

  #target: number | undefined;

  /**
   * Puts ZEsarUX in step mode: a run command works only there, and the CPU
   * stays where it is. Only when an open menu refuses step mode does it close
   * the menus first: close-all-menus lets the CPU run until step mode starts
   * again, and a breakpoint does not stop it then (ZEsarUX 13.0).
   */
  async #stepMode(): Promise<void> {
    let answer = await this.#zrcp("enter-cpu-step");
    if (answer.startsWith("Error")) {
      await this.#zrcp("close-all-menus");
      answer = await this.#zrcp("enter-cpu-step");
    }
    if (answer.startsWith("Error")) throw new WireFailure("machine-unavailable", `ZEsarUX does not take commands now: ${answer}`);
  }

  /** The output of a run command, refused when ZEsarUX did not run. */
  #ran(output: string): string {
    if (!output.startsWith("Running until")) throw new WireFailure("operation-failed", `ZEsarUX did not run: ${output.split("\n")[0]}`);
    return output;
  }

  /** Runs until a breakpoint, the frame count or a pause; with a frame count, slot 100 ends the run. */
  async #runFor(frames: number | undefined): Promise<SpectrumStop> {
    if (frames !== undefined) {
      const at = (await this.#clock()) + frames * FRAME_TSTATES[this.#model];
      await this.#zrcp(`set-breakpoint ${FRAMES_SLOT} TSTATESP>=${at}`);
    }
    try {
      await this.#stepMode();
      const output = this.#ran(await this.#zesarux.zrcp.command("run", undefined));
      const stop = this.#stopOf(output);
      this.#stop = stop;
      return { state: "stopped", pc: stop.pc, ...(stop.reason === undefined ? {} : { stopReason: stop.reason }), ...(stop.pointId === undefined ? {} : { pointId: stop.pointId }) };
    } finally {
      if (frames !== undefined) await this.#zrcp(`set-breakpoint ${FRAMES_SLOT}`);
    }
  }

  async #status(): Promise<SpectrumOperations["status"]["result"]> {
    if (this.#state === "running") return { state: "running", model: this.#model };
    const pc = parseRegisters(await this.#zrcp("get-registers")).pc;
    return { state: "stopped", model: this.#model, pc, ...(this.#stop.reason === undefined ? {} : { stopReason: this.#stop.reason }), ...(this.#stop.pointId === undefined ? {} : { pointId: this.#stop.pointId }) };
  }

  async #execution(params: SpectrumOperations["execution"]["params"]): Promise<SpectrumStop> {
    if (params.action === "pause") {
      if (this.#run === undefined) return { state: "stopped", pc: parseRegisters(await this.#zrcp("get-registers")).pc };
      this.#zesarux.zrcp.interrupt();
      const output = await this.#run;
      this.#run = undefined;
      this.#state = "stopped";
      const stop = this.#stopOf(output);
      this.#stop = { ...stop, reason: stop.reason ?? "pause" };
      return { state: "stopped", pc: stop.pc, stopReason: this.#stop.reason!, ...(stop.pointId === undefined ? {} : { pointId: stop.pointId }) };
    }
    if (params.action === "resume") {
      this.#requireStopped();
      await this.#stepMode();
      this.#stop = {};
      // The run command answers when a breakpoint fires or pause sends data. Its first line tells that it runs.
      const running = this.#zesarux.zrcp.command("run", undefined);
      const first = await Promise.race([running, new Promise<undefined>((resolve) => setTimeout(resolve, 100))]);
      if (first !== undefined && !first.startsWith("Running until")) throw new WireFailure("operation-failed", `ZEsarUX did not run: ${first.split("\n")[0]}`);
      this.#state = "running";
      this.#run = running.then((output) => {
        if (this.#run !== undefined && /Breakpoint fired/.test(output)) {
          this.#run = undefined;
          this.#state = "stopped";
          this.#stop = this.#stopOf(output);
        }
        return output;
      });
      return { state: "running" };
    }
    this.#requireStopped();
    if (params.action === "step") {
      let output = "";
      for (let index = 0; index < (params.count ?? 1); index++) output = await this.#zrcp("cpu-step");
      const pc = parseRegisters(output).pc;
      this.#stop = { pc, reason: "steps" };
      return { state: "stopped", pc, stopReason: "steps" };
    }
    return this.#runFor(params.count ?? 1);
  }

  async #runUntil(params: SpectrumOperations["runUntil"]["params"]): Promise<SpectrumOperations["runUntil"]["result"]> {
    this.#requireStopped();
    this.#target = params.address;
    await this.#zrcp(`set-breakpoint ${TARGET_SLOT} PC=${hex4(params.address)}H`);
    try {
      const stop = await this.#runFor(params.timeoutFrames);
      const reached = stop.stopReason === "target";
      return { ...stop, reached, ...(stop.stopReason === "frames" ? { stopReason: "timeout" as const } : {}) };
    } finally {
      this.#target = undefined;
      await this.#zrcp(`set-breakpoint ${TARGET_SLOT}`);
    }
  }

  async #reset(params: { run: boolean }): Promise<SpectrumStop> {
    if (this.#run !== undefined) await this.#execution({ action: "pause" });
    // In step mode the CPU stays at $0000 after reset-cpu; outside it the ROM runs on (ZEsarUX 13.0).
    await this.#stepMode();
    await this.#zrcp("reset-cpu");
    this.#stop = {};
    const pc = parseRegisters(await this.#zrcp("get-registers")).pc;
    if (params.run) return this.#execution({ action: "resume" });
    return { state: "stopped", pc };
  }

  // ---- Points ----

  async #breakpoint(params: SpectrumOperations["breakpoint"]["params"]): Promise<{ points: SpectrumPoint[] }> {
    if (params.action === "add") {
      const used = new Set([...this.#points.values()].map((point) => point.slot));
      let slot = 1;
      while (used.has(slot) && slot <= MAX_USER_SLOT) slot++;
      if (slot > MAX_USER_SLOT) throw new WireFailure("limit-exceeded", `The session has ${MAX_USER_SLOT} breakpoints. Remove one first.`);
      await this.#zrcp(`set-breakpoint ${slot} PC=${hex4(params.address)}H`);
      const point: Point = { id: this.#nextId++, kind: "breakpoint", start: params.address, end: params.address, enabled: true, slot };
      this.#points.set(point.id, point);
      return { points: [this.#shown(point)] };
    }
    if (params.action === "remove") return this.#remove(params.id, "breakpoint");
    return { points: [...this.#points.values()].filter((point) => point.kind === "breakpoint").map((point) => this.#shown(point)) };
  }

  async #watchpoint(params: SpectrumOperations["watchpoint"]["params"]): Promise<{ points: SpectrumPoint[] }> {
    if (params.action === "add") {
      const type = params.access === "read" ? 1 : params.access === "write" ? 2 : 3;
      await this.#zrcp(`set-membreakpoint ${hex4(params.start)}H ${type} ${params.end - params.start + 1}`);
      const point: Point = { id: this.#nextId++, kind: "watchpoint", start: params.start, end: params.end, access: params.access, enabled: true };
      this.#points.set(point.id, point);
      return { points: [this.#shown(point)] };
    }
    if (params.action === "remove") return this.#remove(params.id, "watchpoint");
    return { points: [...this.#points.values()].filter((point) => point.kind === "watchpoint").map((point) => this.#shown(point)) };
  }

  #shown(point: Point): SpectrumPoint {
    const { slot: _slot, ...shown } = point;
    return shown;
  }

  async #remove(id: number, kind: "breakpoint" | "watchpoint"): Promise<{ points: SpectrumPoint[] }> {
    const point = this.#points.get(id);
    if (point === undefined) throw new WireFailure("not-found", `There is no ${kind} with id ${id}.`);
    if (point.kind !== kind) throw new WireFailure("not-found", `There is no ${kind} with id ${id}. Id ${id} is a ${point.kind}: use the ${point.kind} tool.`);
    if (point.kind === "breakpoint") await this.#zrcp(`set-breakpoint ${point.slot}`);
    else await this.#zrcp(`set-membreakpoint ${hex4(point.start)}H 0 ${point.end - point.start + 1}`);
    this.#points.delete(id);
    return { points: [this.#shown(point)] };
  }

  // ---- Memory and registers ----

  async #read(address: number, size: number): Promise<string> {
    const text = (await this.#zrcp(`read-memory ${hex4(address)}H ${size}`)).trim().toLowerCase();
    if (!/^[0-9a-f]*$/.test(text) || text.length !== size * 2) throw new WireFailure("operation-failed", `ZEsarUX gave ${text.length / 2} bytes, not ${size}.`);
    return text;
  }

  async #write(params: SpectrumOperations["memoryWrite"]["params"]): Promise<{ address: number; bytesWritten: number }> {
    this.#requireStopped();
    const bytes = Buffer.from(params.data, "hex");
    // write-memory takes decimal values; long writes go in parts that fit one command line.
    for (let at = 0; at < bytes.length; at += 256) await this.#zrcp(`write-memory ${hex4(params.address + at)}H ${[...bytes.subarray(at, at + 256)].join(" ")}`);
    return { address: params.address, bytesWritten: bytes.length };
  }

  async #registers(): Promise<Z80RegisterValues> {
    this.#requireStopped();
    return parseRegisters(await this.#zrcp("get-registers"));
  }

  async #setRegisters(params: SpectrumOperations["registersSet"]["params"]): Promise<Z80RegisterValues> {
    this.#requireStopped();
    const NAMES: Record<string, string> = { af2: "AF'", bc2: "BC'", de2: "DE'", hl2: "HL'" };
    for (const [register, value] of Object.entries(params.values)) await this.#zrcp(`set-register ${NAMES[register] ?? register.toUpperCase()}=${value!.toString(16)}H`);
    return parseRegisters(await this.#zrcp("get-registers"));
  }

  async #disassemble(params: SpectrumOperations["disassemble"]["params"]): Promise<SpectrumOperations["disassemble"]["result"]> {
    const size = Math.min(0x10000 - params.address, params.count * 4 + 4);
    const bytes = Buffer.from(await this.#read(params.address, Math.min(size, 4096)), "hex");
    const byteAt = (at: number) => (at >= params.address && at < params.address + bytes.length ? bytes[at - params.address] : undefined);
    const instructions: SpectrumOperations["disassemble"]["result"]["instructions"] = [];
    let at = params.address;
    while (instructions.length < params.count && at <= 0xffff) {
      const decoded = Z80.decode(byteAt, at);
      if (decoded === undefined || decoded.text === undefined) break;
      instructions.push({ address: at, bytes: bytes.subarray(at - params.address, at - params.address + decoded.length).toString("hex"), text: decoded.text });
      at += decoded.length;
    }
    return { instructions };
  }

  async #history(params: { count: number }): Promise<{ pcs: number[] }> {
    this.#requireStopped();
    const text = await this.#zrcp(`cpu-history get-pc 0 ${params.count}`);
    return { pcs: text.split(/\s+/).filter((item) => /^[0-9a-f]{1,4}$/i.test(item)).map((item) => Number.parseInt(item, 16)) };
  }

  // ---- Coverage ----

  /** Joins the visual memory dumps (each read clears it in ZEsarUX) into the coverage of the session. */
  async #drainVisualmem(): Promise<void> {
    const executed = visualmemAddresses(await this.#zrcp("get-visualmem-opcode-dump"));
    const read = visualmemAddresses(await this.#zrcp("get-visualmem-read-dump"));
    const written = visualmemAddresses(await this.#zrcp("get-visualmem-written-dump"));
    for (const address of read) this.#coverage[address]! |= address < 0x4000 ? COVERAGE.romRead : COVERAGE.ramRead;
    for (const address of written) if (address >= 0x4000) this.#coverage[address]! |= COVERAGE.ramWrite;
    // ZEsarUX counts every opcode fetch, also the opcode after a prefix: only the first byte of an instruction counts as execute.
    executed.sort((a, b) => a - b);
    const memory = executed.length === 0 ? undefined : Buffer.from((await this.#zrcp("read-memory 0000H 65536")).trim(), "hex");
    let end = -1;
    for (const address of executed) {
      if (address <= end) continue;
      this.#coverage[address]! |= address < 0x4000 ? COVERAGE.romExecute : COVERAGE.ramExecute;
      end = address + (Z80.decode((at) => memory?.[at], address)?.length ?? 1) - 1;
    }
  }

  async #memmap(params: { action: "clear" | "read" }): Promise<SpectrumOperations["memmap"]["result"]> {
    this.#requireStopped();
    await this.#drainVisualmem();
    if (params.action === "clear") {
      this.#coverage.fill(0);
      return { cleared: true };
    }
    const ranges: Array<{ start: number; end: number; flags: number }> = [];
    for (let address = 0; address < 0x10000; address++) {
      const flags = this.#coverage[address]!;
      if (flags === 0) continue;
      const last = ranges.at(-1);
      if (last !== undefined && last.end === address - 1 && last.flags === flags && (flags & (COVERAGE.ramExecute | COVERAGE.romExecute)) === 0) last.end = address;
      else ranges.push({ start: address, end: address, flags });
    }
    return { ranges };
  }

  // ---- Screen, input ----

  async #screen(reply: Buffer[]): Promise<{ width: number; height: number }> {
    this.#requireStopped();
    const ula = await this.#ula();
    const bank = ula.screenBank ?? 5;
    const screen = bank === 5 ? Buffer.from(await this.#read(0x4000, 0x1b00), "hex") : await this.#bank(7, 0, 0x1b00);
    const frame = spectrumScreenFrame(screen, ula.border);
    reply.push(encodePng(frame, SPECTRUM_PALETTE));
    return { width: frame.width, height: frame.height };
  }

  async #setPorts(): Promise<void> {
    await this.#zrcp(`set-ui-io-ports ${[...this.#rows, this.#joystick].map((value) => value.toString(16).padStart(2, "0")).join("")}`);
  }

  async #press(keys: string[], down: boolean): Promise<void> {
    for (const key of keys) {
      const place = KEY_MATRIX[key];
      if (place === undefined) throw new WireFailure("invalid-input", `${key} is no key. A key is ${SPECTRUM_KEYS.join(", ")}.`);
      const [row, bit] = place;
      this.#rows[row] = down ? this.#rows[row]! & ~(1 << bit) : this.#rows[row]! | (1 << bit);
    }
    await this.#setPorts();
  }

  async #keys(params: { keys: string[]; frames: number }): Promise<SpectrumStop> {
    this.#requireStopped();
    await this.#press(params.keys, true);
    try {
      return await this.#runFor(params.frames);
    } finally {
      await this.#press(params.keys, false);
    }
  }

  async #type(params: { text: string }): Promise<{ typed: number }> {
    this.#requireStopped();
    for (const char of params.text) {
      const keys = keysOf(char);
      await this.#keys({ keys, frames: KEY_FRAMES });
      await this.#runFor(KEY_FRAMES);
    }
    return { typed: params.text.length };
  }

  async #setJoystick(params: SpectrumOperations["joystick"]["params"]): Promise<{ set: boolean }> {
    this.#joystick = (params.right ? 1 : 0) | (params.left ? 2 : 0) | (params.down ? 4 : 0) | (params.up ? 8 : 0) | (params.fire ? 16 : 0);
    await this.#setPorts();
    return { set: true };
  }

  // ---- Media and snapshots ----

  async #autostart(params: { type: string }, bytes: Buffer): Promise<SpectrumStop> {
    if (this.#run !== undefined) await this.#execution({ action: "pause" });
    const file = join(this.#zesarux.scratch, `media.${params.type}`);
    writeFileSync(file, bytes);
    await this.#zrcp(`smartload ${file}`);
    await this.#stepMode();
    this.#stop = {};
    return this.#execution({ action: "resume" });
  }

  async #programLoad(params: { address: number }, bytes: Buffer): Promise<{ address: number; size: number }> {
    this.#requireStopped();
    if (params.address + bytes.length > 0x10000) throw new WireFailure("invalid-input", "The program runs past $ffff.");
    const file = join(this.#zesarux.scratch, "program.bin");
    writeFileSync(file, bytes);
    await this.#zrcp(`load-binary ${file} ${params.address} 0`);
    return { address: params.address, size: bytes.length };
  }

  async #snapshot(params: SpectrumOperations["snapshot"]["params"]): Promise<{ names: string[] }> {
    const names = () => (existsSync(this.#snapshots) ? readdirSync(this.#snapshots).filter((file) => file.endsWith(".zsf")).map((file) => file.slice(0, -4)).sort() : []);
    if (params.action === "list") return { names: names() };
    this.#requireStopped();
    const file = join(this.#snapshots, `${params.name}.zsf`);
    if (params.action === "save") {
      mkdirSync(this.#snapshots, { recursive: true });
      // ZEsarUX's own .zsf keeps every register; its .z80 writer gets E wrong (13.0).
      await this.#zrcp(`snapshot-save ${file}`);
      return { names: [params.name] };
    }
    if (!existsSync(file)) throw new WireFailure("not-found", `There is no snapshot ${params.name}.`);
    if (params.action === "remove") {
      rmSync(file);
      return { names: [params.name] };
    }
    await this.#zrcp(`snapshot-load ${file}`);
    await this.#stepMode();
    this.#stop = {};
    return { names: [params.name] };
  }

  /** The 16 KiB RAM bank `bank` from `offset`, `size` bytes: zone 0 of ZEsarUX is all RAM banks in order. */
  async #bank(bank: number, offset: number, size: number): Promise<Buffer> {
    if (this.#model === "48k") {
      const at = ({ 5: 0x4000, 2: 0x8000, 0: 0xc000 } as Record<number, number>)[bank];
      if (at === undefined) throw new WireFailure("invalid-input", `The 48K has no RAM bank ${bank}.`);
      return Buffer.from(await this.#read(at + offset, size), "hex");
    }
    await this.#zrcp("set-memory-zone 0");
    try {
      const parts: Buffer[] = [];
      for (let at = 0; at < size; at += 4096) {
        const length = Math.min(4096, size - at);
        const text = (await this.#zrcp(`read-memory ${bank * 0x4000 + offset + at} ${length}`)).trim();
        parts.push(Buffer.from(text, "hex"));
      }
      return Buffer.concat(parts);
    } finally {
      await this.#zrcp("set-memory-zone -1");
    }
  }

  /** The machine state as a version 3 .z80: registers, border, paging, AY and every RAM bank. */
  async #export(reply: Buffer[]): Promise<{ bytes: number }> {
    this.#requireStopped();
    const registers = parseRegisters(await this.#zrcp("get-registers"));
    const ula = await this.#ula();
    const banks = await Promise.all(Array.from({ length: 8 }, async (_, bank) => (this.#model === "48k" && ![5, 2, 0].includes(bank) ? new Uint8Array(0x4000) : new Uint8Array(await this.#bank(bank, 0, 0x4000)))));
    const snapshot: SpectrumSnapshot = {
      model: this.#model,
      registers: { ...registers, im: (registers.im as 0 | 1 | 2) },
      border: ula.border,
      port7ffd: ula.port7ffd ?? 0,
      banks,
      ...(this.#model === "128k" ? { ay: await this.#ay() } : {}),
    };
    const bytes = Buffer.from(writeZ80(snapshot));
    reply.push(bytes);
    return { bytes: bytes.length };
  }

  async #timing(params: { action: "start" | "read" }): Promise<{ tstates: number }> {
    const now = await this.#clock();
    if (params.action === "start") {
      this.#clockBase = now;
      return { tstates: 0 };
    }
    return { tstates: now - this.#clockBase };
  }

  async #ula(): Promise<SpectrumOperations["ula"]["result"]> {
    const ports = await this.#zrcp("get-io-ports");
    const fe = Number.parseInt(/Spectrum FE port: ([0-9a-f]+)/i.exec(ports)?.[1] ?? "0", 16);
    if (this.#model === "48k") return { border: fe & 7 };
    const port = Number.parseInt(/Spectrum 7FFD port: ([0-9a-f]+)/i.exec(ports)?.[1] ?? "0", 16);
    return { border: fe & 7, port7ffd: port, pagedBank: port & 7, screenBank: (port & 8) !== 0 ? 7 : 5, rom: (port >> 4) & 1, pagingLocked: (port & 0x20) !== 0 };
  }

  async #ay(): Promise<{ selected: number; registers: number[] }> {
    const ports = await this.#zrcp("get-io-ports");
    const selected = Number(/Selected register: (\d+)/.exec(ports)?.[1] ?? 0);
    const registers = Array.from({ length: 16 }, (_, index) => Number.parseInt(new RegExp(`^${index.toString(16).toUpperCase().padStart(2, "0")}:\\s+([0-9A-F]{2})`, "m").exec(ports)?.[1] ?? "0", 16));
    return { selected, registers };
  }
}

/** The Spectrum family on ZEsarUX. */
export function zesaruxBackend(options: { supervisor: ProcessSupervisor; env?: NodeJS.ProcessEnv }): MachineBackend {
  return {
    emulator: "ZEsarUX",
    start: async ({ machine, log }) => ZesaruxSession.start({ ...options, machine, ...(log === undefined ? {} : { log }) }),
    isOperation: (op) => (SPECTRUM_OPERATIONS as readonly string[]).includes(op),
    validate: (op, params) => validateSpectrumParams(op as SpectrumOperation, params),
    attachments: (op) => spectrumAttachmentCount(op as SpectrumOperation),
  };
}
