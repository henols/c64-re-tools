// One ZX Spectrum session on one ZEsarUX: the operations of protocol/spectrum.ts
// over ZRCP. The CPU is stopped in ZEsarUX's step mode; a run is a ZRCP run
// command that ends at a breakpoint, at the frame or timeout breakpoint of the
// session, or when pause sends data. Work is serialized.
//
// ZRCP breakpoint slots 1-90 hold the breakpoints of the agent; slot 99 is the
// target of run_until and slot 100 the end of a frame count (TSTATESP). The
// clock of the session is its own count of t-states: before each run it adds
// ZEsarUX's partial t-state counter to it and sets that counter to zero. The
// counter shows OVERFLOW above 999999999 and the breakpoint expressions are
// signed 32-bit numbers, so a run never compares it with a larger value.
//
// A ZRCP run command keeps the CPU at real speed: one frame takes about 20 ms
// of real time. A load (snapshot-load, smartload) turns all breakpoints off,
// so the session sets its points again after each load.
//
// A load can also change the machine that ZEsarUX runs: a 128K snapshot in a
// 48K session gives a 128K. After each load the session asks ZEsarUX for its
// machine and takes its model from it: the frame length, the paging, the AY and
// the export follow the loaded machine. A machine that the session does not
// serve is refused, and ZEsarUX gets the model of the session again. A tape
// keeps the machine that ZEsarUX runs, so before a tape the session sets the
// model that the session started with, or the model that the call gives.
//
// The coverage comes from ZEsarUX's code coverage (the address of each
// executed instruction) and its visual memory of written addresses. The
// visual memory of reads is no CPU evidence: the CPU history reads the bytes
// at the PC, at the SP and at each written address when it records an
// instruction, and the tools' own reads count too. So the map has no reads.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { COVERAGE } from "../../cpu/coverage.ts";
import { Z80 } from "../../cpu/z80.ts";
import { encodePng, SPECTRUM_PALETTE, spectrumScreenFrame } from "../../graphics.ts";
import type { MachineId } from "../../machine.ts";
import type { ProcessSupervisor } from "../../native/processes.ts";
import { WireFailure } from "../../protocol/messages.ts";
import {
  SPECTRUM_OPERATIONS,
  SPECTRUM_TAPES,
  spectrumAttachmentCount,
  validateSpectrumParams,
  z80WritableMax,
  type SpectrumOperation,
  type SpectrumOperations,
  type SpectrumPoint,
  type SpectrumRunState,
  type SpectrumStop,
  type SpectrumStopReason,
  type Z80RegisterState,
  type Z80RegisterValues,
} from "../../protocol/spectrum.ts";
import { writeZ80, type SpectrumSnapshot } from "../../spectrum.ts";
import type { MachineBackend, SessionHandle } from "../server.ts";
import { checkMedia } from "./media.ts";
import { launchZesarux, type ZesaruxProcess } from "./process.ts";
import { zsfHalted, zsfOnHaltInstruction } from "./zsf.ts";

const FRAME_TSTATES = { "48k": 69_888, "128k": 70_908 } as const;
type Model = keyof typeof FRAME_TSTATES;
/** The machines that ZEsarUX runs for c64-re-tools. */
export const ZESARUX_MACHINES: readonly MachineId[] = ["spectrum48", "spectrum128"];
/** The set-machine name of each model. */
const MACHINE_OF_MODEL: Record<Model, string> = { "48k": "48k", "128k": "128k" };
const MODEL_NAME: Record<Model, string> = { "48k": "ZX Spectrum 48K", "128k": "ZX Spectrum 128K" };

/**
 * The model of a machine that get-current-machine names (ZEsarUX 13.0): the
 * 48K and the 48K+, the 128K+ and the +2, also with a Spanish or French ROM.
 * Undefined for any other machine, for example the +2A, the +3, the Pentagon
 * or the ZX81: their paging or their frame differ.
 */
export function modelOfMachineName(name: string): Model | undefined {
  if (/^ZX Spectrum\+? 48k(?: \([^)]*\))?$/.test(name)) return "48k";
  if (/^ZX Spectrum(?:\+ 128k| \+2)(?: \([^)]*\))?$/.test(name)) return "128k";
  return undefined;
}
const TARGET_SLOT = 99;
const FRAMES_SLOT = 100;
const MAX_USER_SLOT = 90;
/** The real time of one frame at the speed of a run, in ms. */
const FRAME_MS = 20;
/** A run of n frames that takes longer than n * FRAME_MS * RUN_SLACK + RUN_EXTRA_MS of real time is stopped: the emulator does not keep up. */
const RUN_SLACK = 10;
const RUN_EXTRA_MS = 60_000;
/** How long the end of a stopped run can take before the session counts ZEsarUX as lost. */
const STOP_ANSWER_MS = 10_000;
/** A RAM address on the 48K and the 128K where the session runs one instruction of its own: IM to set the interrupt mode, OUT to set the border. */
const TOOL_SITE = 0x5b00;
const IM_OPCODES = [0x46, 0x56, 0x5e];
const OUT_N_A = 0xd3;
const HALT = 0x76;
/** The NMI start address of the Z80. */
const NMI_ADDRESS = 0x66;
const ROM_END = 0x4000;
/** How long a key stays down and up when the session types text, in frames: the ROM reads the keyboard once a frame. */
const KEY_FRAMES = 3;
/** The most copies of one CPU history entry that the session looks for after a stop. */
const MAX_REPEATS = 100;

/**
 * The keyboard: each key's row (the port $xxfe high byte order of
 * set-ui-io-ports) and bit. A row value is the value that the ULA gives for
 * the row: a key down is a 0 in bits 0-4, and bits 5-7 stay 1, as on a real
 * Spectrum.
 */
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

/**
 * The AY registers in a get-io-ports answer. ZEsarUX shows the "AY-3-8912
 * chip" part only while the AY is on: without it there are no values to give.
 */
export function ayOfIoPorts(text: string): { selected: number; registers: number[] } {
  const chip = text.indexOf("AY-3-8912 chip 0:");
  if (chip < 0) throw new WireFailure("operation-failed", "ZEsarUX shows no AY chip on this 128K, so the AY registers are not known. Load the 128K file again with autostart.");
  const part = text.slice(chip);
  const selected = /Selected register: (\d+)/.exec(part);
  const registers = Array.from({ length: 16 }, (_, index) => new RegExp(`^${index.toString(16).padStart(2, "0")}:\\s+([0-9a-f]{2})\\s*$`, "im").exec(part)?.[1]);
  if (selected === null || registers.some((value) => value === undefined)) throw new WireFailure("operation-failed", `ZEsarUX gave no AY registers: ${part.split("\n").slice(0, 3).join(" ")}`);
  return { selected: Number(selected[1]), registers: registers.map((value) => Number.parseInt(value!, 16)) };
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

/** The interrupt state that a named snapshot keeps beside its .zsf: the .zsf keeps only IM 2 or not, and one flip-flop for both. */
interface InterruptState {
  im: number;
  iff1: boolean;
  iff2: boolean;
}

/** The addresses in a cpu-code-coverage answer: hex numbers apart by spaces or lines. */
export function codeCoverageAddresses(text: string): number[] {
  const items = text.split(/\s+/).filter((item) => item !== "");
  if (!items.every((item) => /^[0-9a-f]{1,4}$/i.test(item))) throw new WireFailure("operation-failed", `ZEsarUX gave no code coverage: ${text.split("\n")[0]}`);
  return items.map((item) => Number.parseInt(item, 16));
}

/** The stop of a run by the "Breakpoint fired" line of ZEsarUX, which writes a PC condition with no leading zeros and in capitals (PC=38H). */
export function firedStop(fired: string | undefined, points: readonly SpectrumPoint[], target: number | undefined): { reason?: SpectrumStopReason; pointId?: number } {
  if (fired === undefined) return {};
  if (fired.startsWith("TSTATESP")) return { reason: "frames" };
  const memory = /Memory Breakpoint \w+ Address: ([0-9a-f]+)H/i.exec(fired);
  if (memory !== null) {
    const at = Number.parseInt(memory[1]!, 16);
    const point = points.find((item) => item.kind === "watchpoint" && at >= item.start && at <= item.end);
    return { reason: "watchpoint", ...(point === undefined ? {} : { pointId: point.id }) };
  }
  const pc = /^PC=([0-9a-f]+)H$/i.exec(fired);
  const at = pc === null ? undefined : Number.parseInt(pc[1]!, 16);
  if (at !== undefined && at === target) return { reason: "target" };
  const point = points.find((item) => item.kind === "breakpoint" && item.start === at);
  return { reason: "breakpoint", ...(point === undefined ? {} : { pointId: point.id }) };
}

export class ZesaruxSession implements SessionHandle {
  readonly #zesarux: ZesaruxProcess;
  /** The model of the machine that ZEsarUX runs: it follows each load. */
  #model: Model;
  /** The model that the session started with: a tape runs on it unless the autostart gives a model. */
  readonly #startModel: Model;
  readonly #log: (line: string) => void;
  #queue: Promise<unknown> = Promise.resolve();
  #state: SpectrumRunState = "stopped";
  /** The run of a resume: its output, or the error that ended it. */
  #run: Promise<string | Error> | undefined;
  #stop: { reason?: SpectrumStopReason; pointId?: number; pc?: number } = {};
  readonly #points = new Map<number, Point>();
  #nextId = 1;
  /** The t-states that ran in the session up to the last time the partial counter of ZEsarUX was set to zero. */
  #elapsed = 0;
  #clockBase = 0;
  /** Set when ZEsarUX does not answer any more: only a new session helps. */
  #lost: string | undefined;
  /** The coverage of the session: one COVERAGE byte per address. */
  readonly #coverage = new Uint8Array(0x10000);
  /** The keys that are down, and the Kempston joystick: the nine values of set-ui-io-ports. */
  readonly #rows = new Array<number>(8).fill(0xff);
  #joystick = 0;
  readonly #snapshots: string;

  private constructor(zesarux: ZesaruxProcess, model: Model, log: (line: string) => void) {
    this.#zesarux = zesarux;
    this.#model = model;
    this.#startModel = model;
    this.#log = log;
    this.#snapshots = join(zesarux.scratch, "snapshots");
  }

  static async start(options: { supervisor: ProcessSupervisor; machine: MachineId; env?: NodeJS.ProcessEnv; log?: (line: string) => void }): Promise<ZesaruxSession> {
    const log = options.log ?? (() => {});
    const zesarux = await launchZesarux({ ...options, log });
    return ZesaruxSession.open(zesarux, options.machine, log);
  }

  /** A session on a ZEsarUX that runs: the start of start(), and of a test on a stand-in ZEsarUX. Stops ZEsarUX when it fails. */
  static async open(zesarux: ZesaruxProcess, machine: MachineId, log: (line: string) => void = () => {}): Promise<ZesaruxSession> {
    const session = new ZesaruxSession(zesarux, machine === "spectrum128" ? "128k" : "48k", log);
    try {
      await session.#zrcp("enter-cpu-step");
      await session.#followMachine();
      await session.#afterLoad();
      await session.#discardCoverage();
      await session.#zrcp("reset-tstates-partial");
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
    if (this.#lost !== undefined || this.#zesarux.zrcp.closed) {
      throw new WireFailure("machine-unavailable", `${this.#lost ?? "ZEsarUX closed its remote connection."} Restart the c64-re-tools MCP server: that starts a new emulator.`);
    }
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

  /** Adds the partial t-state counter of ZEsarUX to the clock of the session and sets the counter to zero. */
  async #settleClock(): Promise<void> {
    const text = await this.#zrcp("evaluate TSTATESP");
    const value = Number.parseInt(text.trim(), 10);
    if (!Number.isFinite(value)) throw new WireFailure("operation-failed", `ZEsarUX gave no t-state count: ${text.split("\n")[0]}`);
    // The expression is a signed 32-bit number.
    this.#elapsed += value >>> 0;
    await this.#zrcp("reset-tstates-partial");
  }

  /** The stop that the end of a run command gives: its PC and why it stopped. */
  #stopOf(output: string): { pc: number; reason?: SpectrumStopReason; pointId?: number } {
    const pc = parseRegisters(output).pc;
    const fired = /Breakpoint fired: (.*)/.exec(output)?.[1]?.trim();
    return { pc, ...firedStop(fired, [...this.#points.values()], this.#target) };
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

  /** Waits for the answer of a run that pause or a stop interrupted. No answer: ZEsarUX is lost. */
  async #stopAnswer(running: Promise<string>): Promise<string> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<undefined>((resolve) => {
      timer = setTimeout(() => resolve(undefined), STOP_ANSWER_MS);
    });
    const output = await Promise.race([running, late]).finally(() => clearTimeout(timer));
    if (output !== undefined) return output;
    this.#lost = "ZEsarUX did not stop the CPU when the session asked it to.";
    throw new WireFailure("machine-unavailable", `${this.#lost} Restart the c64-re-tools MCP server: that starts a new emulator.`);
  }

  /**
   * Runs until a breakpoint or the frame count: slot 100 ends the run when
   * the partial counter reaches the t-states of the frames. A run that takes
   * much longer than its real time is stopped, and the CPU stays usable.
   *
   * The CPU stops at the first instruction at or after the end of the frames,
   * a few t-states late. When the last run of frames stopped and the CPU did
   * not run since, the frames count from the planned end of that run, not
   * from its stop: so 1 + 11 frames stop where 12 frames stop, and many runs
   * do not move through the frame.
   */
  async #runFor(frames: number): Promise<SpectrumStop> {
    await this.#settleClock();
    const now = this.#elapsed;
    const start = this.#frameEnd !== undefined && this.#frameEnd.stoppedAt === now ? this.#frameEnd.planned : now;
    const planned = start + frames * FRAME_TSTATES[this.#model];
    this.#frameEnd = undefined;
    await this.#zrcp(`set-breakpoint ${FRAMES_SLOT} TSTATESP>=${planned - now}`);
    try {
      await this.#stepMode();
      this.#repeats = undefined;
      const running = this.#zesarux.zrcp.command("run", "none");
      const limitMs = frames * FRAME_MS * RUN_SLACK + RUN_EXTRA_MS;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const late = new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), limitMs);
      });
      let output = await Promise.race([running, late]).finally(() => clearTimeout(timer));
      if (output === undefined) {
        this.#zesarux.zrcp.interrupt();
        output = this.#ran(await this.#stopAnswer(running));
        const pc = parseRegisters(output).pc;
        this.#stop = { pc, reason: "pause" };
        throw new WireFailure(
          "operation-failed",
          `The emulator ran too slowly: the run of ${frames} frames did not end in ${Math.round(limitMs / 1000)} s, so the session stopped it at $${hex4(pc)}. The machine state is valid. Do the run again, or give fewer frames.`,
        );
      }
      const stop = this.#stopOf(this.#ran(output));
      this.#stop = stop;
      if (stop.reason === "frames") {
        await this.#settleClock();
        this.#frameEnd = { planned, stoppedAt: this.#elapsed };
      }
      return this.#shownStopAt(stop.pc);
    } finally {
      if (this.#lost === undefined) await this.#zrcp(`set-breakpoint ${FRAMES_SLOT}`);
    }
  }

  /**
   * The end of the last run of frames: its planned session time, and the
   * session time where the CPU stopped. A load, a restore and a reset forget it.
   */
  #frameEnd: { planned: number; stoppedAt: number } | undefined;

  /** The stop result at a PC: the reason of the last stop, and halted when the CPU waits in a HALT. */
  async #shownStopAt(pc: number): Promise<SpectrumStop> {
    return { state: "stopped", pc, ...this.#shownStop(), ...((await this.#haltedAt(pc)) ? { waitsForInterrupt: true } : {}) };
  }

  async #status(): Promise<SpectrumOperations["status"]["result"]> {
    if (this.#state === "running") return { state: "running", model: this.#model };
    const pc = parseRegisters(await this.#zrcp("get-registers")).pc;
    return { ...(await this.#shownStopAt(pc)), model: this.#model };
  }

  #shownStop(): { stopReason?: SpectrumStopReason; pointId?: number } {
    return { ...(this.#stop.reason === undefined ? {} : { stopReason: this.#stop.reason }), ...(this.#stop.pointId === undefined ? {} : { pointId: this.#stop.pointId }) };
  }

  async #execution(params: SpectrumOperations["execution"]["params"]): Promise<SpectrumStop> {
    if (params.action === "pause") {
      // No run, or a breakpoint or a watchpoint ended it: the CPU stopped already, for the reason of that stop.
      if (this.#run === undefined) return this.#shownStopAt(parseRegisters(await this.#zrcp("get-registers")).pc);
      this.#zesarux.zrcp.interrupt();
      const run = this.#run;
      const output = await this.#stopAnswer(run.then((value) => (value instanceof Error ? Promise.reject(value) : value)));
      this.#run = undefined;
      this.#state = "stopped";
      const stop = this.#stopOf(output);
      this.#stop = { ...stop, reason: stop.reason ?? "pause" };
      return this.#shownStopAt(stop.pc);
    }
    if (params.action === "resume") {
      this.#requireStopped();
      await this.#settleClock();
      await this.#stepMode();
      this.#stop = {};
      this.#frameEnd = undefined;
      // The run command answers when a breakpoint fires or pause sends data. Its first line tells that it runs.
      this.#repeats = undefined;
      const running = this.#zesarux.zrcp.command("run", "none");
      const first = await Promise.race([running, new Promise<undefined>((resolve) => setTimeout(resolve, 100))]);
      if (first !== undefined && !first.startsWith("Running until")) throw new WireFailure("operation-failed", `ZEsarUX did not run: ${first.split("\n")[0]}`);
      this.#state = "running";
      const run: Promise<string | Error> = running.then(
        (output) => {
          if (this.#run === run && /Breakpoint fired/.test(output)) {
            this.#run = undefined;
            this.#state = "stopped";
            this.#stop = this.#stopOf(output);
          }
          return output;
        },
        (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
      );
      this.#run = run;
      return { state: "running" };
    }
    this.#requireStopped();
    if (params.action === "step") {
      await this.#measureRepeats();
      let output = "";
      for (let index = 0; index < (params.count ?? 1); index++) {
        output = await this.#zrcp("cpu-step");
        this.#repeats!.newer++;
      }
      const pc = parseRegisters(output).pc;
      this.#stop = { pc, reason: "steps" };
      return this.#shownStopAt(pc);
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
      if (stop.stopReason === "frames") this.#stop = { ...this.#stop, reason: "timeout" };
      return { ...stop, reached, ...(stop.stopReason === "frames" ? { stopReason: "timeout" as const } : {}) };
    } finally {
      this.#target = undefined;
      if (this.#lost === undefined) await this.#zrcp(`set-breakpoint ${TARGET_SLOT}`);
    }
  }

  async #reset(params: { run: boolean }): Promise<SpectrumStop> {
    if (this.#run !== undefined) await this.#execution({ action: "pause" });
    // In step mode the CPU stays at $0000 after reset-cpu; outside it the ROM runs on (ZEsarUX 13.0).
    await this.#stepMode();
    await this.#zrcp("reset-cpu");
    this.#stop = {};
    this.#frameEnd = undefined;
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
      const point: Point = { id: this.#nextId++, kind: "breakpoint", start: params.address, end: params.address, enabled: true, slot };
      await this.#setPoint(point);
      this.#points.set(point.id, point);
      return { points: [this.#shown(point)] };
    }
    if (params.action === "remove") await this.#remove(params.id, "breakpoint");
    return { points: this.#listed("breakpoint") };
  }

  async #watchpoint(params: SpectrumOperations["watchpoint"]["params"]): Promise<{ points: SpectrumPoint[] }> {
    if (params.action === "add") {
      const point: Point = { id: this.#nextId++, kind: "watchpoint", start: params.start, end: params.end, access: params.access, enabled: true };
      await this.#setPoint(point);
      this.#points.set(point.id, point);
      return { points: [this.#shown(point)] };
    }
    if (params.action === "remove") await this.#remove(params.id, "watchpoint");
    return { points: this.#listed("watchpoint") };
  }

  async #setPoint(point: Point): Promise<void> {
    if (point.kind === "breakpoint") {
      await this.#zrcp(`set-breakpoint ${point.slot} PC=${hex4(point.start)}H`);
      return;
    }
    const type = point.access === "read" ? 1 : point.access === "write" ? 2 : 3;
    await this.#zrcp(`set-membreakpoint ${hex4(point.start)}H ${type} ${point.end - point.start + 1}`);
  }

  /**
   * A load (smartload, snapshot-load) turns the breakpoints, the CPU history
   * and the code coverage off (ZEsarUX 13.0). This turns them on again and
   * sets the points of the session again.
   */
  async #afterLoad(): Promise<void> {
    this.#repeats = undefined;
    await this.#zrcp("enable-breakpoints");
    await this.#zrcp("cpu-history enabled yes");
    await this.#zrcp("cpu-history started yes");
    await this.#zrcp("cpu-code-coverage enabled yes");
    for (const point of this.#points.values()) await this.#setPoint(point);
  }

  /**
   * Takes the model of the session from the machine that ZEsarUX runs. A
   * machine that the session does not serve is refused: ZEsarUX then runs the
   * model of the session again, from a reset.
   */
  async #followMachine(): Promise<void> {
    const name = (await this.#zrcp("get-current-machine")).trim();
    const model = modelOfMachineName(name);
    if (model !== undefined) {
      if (model !== this.#model) this.#log(`the Spectrum session follows the machine of ZEsarUX: ${name}`);
      this.#model = model;
      return;
    }
    this.#log(`ZEsarUX runs a machine that the Spectrum session does not serve: ${name}`);
    await this.#setMachine(this.#model);
    throw new WireFailure(
      "invalid-input",
      `The file is for the ${name}. The spectrum tools serve only the ZX Spectrum 48K and the ZX Spectrum 128K. The emulator is a ${MODEL_NAME[this.#model]} again, after a reset. Load a file for one of these two models.`,
    );
  }

  /** Makes ZEsarUX run a model, from a reset with the CPU at $0000. set-machine works only in step mode. */
  async #setMachine(model: Model): Promise<void> {
    await this.#stepMode();
    let answer = await this.#zrcp(`set-machine ${MACHINE_OF_MODEL[model]}`);
    if (answer.startsWith("Error")) {
      await this.#stepMode();
      answer = await this.#zrcp(`set-machine ${MACHINE_OF_MODEL[model]}`);
    }
    await this.#stepMode();
    const name = (await this.#zrcp("get-current-machine")).trim();
    if (modelOfMachineName(name) !== model) {
      this.#lost = `ZEsarUX did not change to the ${MODEL_NAME[model]}: it runs the ${name}${answer === "" ? "" : ` (${answer.split("\n")[0]})`}.`;
      throw new WireFailure("machine-unavailable", `${this.#lost} Restart the c64-re-tools MCP server: that starts a new emulator.`);
    }
    this.#model = model;
    // The step mode can let the ROM run for a moment: the CPU starts again from $0000.
    await this.#zrcp("reset-cpu");
    await this.#zrcp("reset-tstates-partial");
    await this.#discardCoverage();
    await this.#afterLoad();
    this.#stop = {};
    this.#frameEnd = undefined;
  }

  #listed(kind: "breakpoint" | "watchpoint"): SpectrumPoint[] {
    return [...this.#points.values()].filter((point) => point.kind === kind).map((point) => this.#shown(point));
  }

  #shown(point: Point): SpectrumPoint {
    const { slot: _slot, ...shown } = point;
    return shown;
  }

  async #remove(id: number, kind: "breakpoint" | "watchpoint"): Promise<void> {
    const point = this.#points.get(id);
    if (point === undefined) throw new WireFailure("not-found", `There is no ${kind} with id ${id}.`);
    if (point.kind !== kind) throw new WireFailure("not-found", `There is no ${kind} with id ${id}. Id ${id} is a ${point.kind}: use the ${point.kind} tool.`);
    if (point.kind === "breakpoint") await this.#zrcp(`set-breakpoint ${point.slot}`);
    else await this.#zrcp(`set-membreakpoint ${hex4(point.start)}H 0 ${point.end - point.start + 1}`);
    this.#points.delete(id);
  }

  // ---- Memory and registers ----

  async #read(address: number, size: number): Promise<string> {
    const text = (await this.#zrcp(`read-memory ${hex4(address)}H ${size}`)).trim().toLowerCase();
    if (!/^[0-9a-f]*$/.test(text) || text.length !== size * 2) throw new WireFailure("operation-failed", `ZEsarUX gave ${text.length / 2} bytes, not ${size}.`);
    return text;
  }

  #refuseRom(address: number, what: string): void {
    if (address < ROM_END) throw new WireFailure("invalid-input", `${what} starts at $${hex4(address)}, in the ROM at $0000-$3fff, which a write does not change. Give an address from $4000.`);
  }

  async #write(params: SpectrumOperations["memoryWrite"]["params"]): Promise<{ address: number; bytesWritten: number }> {
    this.#requireStopped();
    this.#refuseRom(params.address, "The write");
    const bytes = Buffer.from(params.data, "hex");
    await this.#drainCoverage();
    // write-memory takes decimal values; long writes go in parts that fit one command line.
    for (let at = 0; at < bytes.length; at += 256) await this.#zrcp(`write-memory ${hex4(params.address + at)}H ${[...bytes.subarray(at, at + 256)].join(" ")}`);
    await this.#discardCoverage();
    return { address: params.address, bytesWritten: bytes.length };
  }

  async #registers(): Promise<Z80RegisterState> {
    this.#requireStopped();
    const registers = parseRegisters(await this.#zrcp("get-registers"));
    return { ...registers, waitsForInterrupt: await this.#haltedAt(registers.pc) };
  }

  /**
   * Writes registers. A pc write while the CPU waits in a HALT ends the HALT
   * first: else the CPU waits at the new PC and executes nothing.
   */
  async #setRegisters(params: SpectrumOperations["registersSet"]["params"]): Promise<Z80RegisterState> {
    this.#requireStopped();
    const { im, ...values } = params.values;
    const halted = await this.#haltedAt(parseRegisters(await this.#zrcp("get-registers")).pc);
    if (halted && values.pc !== undefined) await this.#endHalt();
    if (im !== undefined) {
      if (halted && values.pc === undefined) {
        throw new WireFailure("invalid-input", "The CPU waits in a HALT, so it cannot run the IM instruction that sets im. Write pc in the same call: a pc write ends the HALT. Or step or run until an interrupt ends the HALT, then write im again.");
      }
      await this.#setInterruptMode(im);
    }
    const NAMES: Record<string, string> = { af2: "AF'", bc2: "BC'", de2: "DE'", hl2: "HL'" };
    for (const [register, value] of Object.entries(values)) {
      const text = z80WritableMax(register as keyof typeof values) === 1 ? String(value) : `${value!.toString(16)}H`;
      await this.#zrcp(`set-register ${NAMES[register] ?? register.toUpperCase()}=${text}`);
    }
    return this.#registers();
  }

  /**
   * True when the CPU waits in a HALT. ZEsarUX then keeps the PC after the
   * HALT instruction, so only a PC after an opcode $76 can be halted. The HALT
   * block of a .zsf of now tells it.
   */
  async #haltedAt(pc: number): Promise<boolean> {
    if ((await this.#read((pc - 1) & 0xffff, 1)) !== HALT.toString(16)) return false;
    const file = join(this.#zesarux.scratch, "state.zsf");
    await this.#zrcp(`snapshot-save ${file}`);
    try {
      return zsfHalted(readFileSync(file));
    } finally {
      rmSync(file, { force: true });
    }
  }

  /**
   * Does work that the session needs and that is not part of the program:
   * with the interrupts off, out of the CPU history, and not on the clock of
   * the session (its t-states pass in the frame). After it, the bytes in kept,
   * the PC, SP, AF, R and the flip-flops get their values again, and what it
   * executed and wrote is not in the coverage.
   */
  async #aside<T>(kept: ReadonlyArray<{ address: number; data: string }>, work: () => Promise<T>): Promise<T> {
    const before = parseRegisters(await this.#zrcp("get-registers"));
    await this.#settleClock();
    await this.#drainCoverage();
    await this.#zrcp("cpu-history started no");
    try {
      await this.#zrcp("set-register IFF1=0");
      await this.#zrcp("set-register IFF2=0");
      return await work();
    } finally {
      for (const { address, data } of kept) await this.#zrcp(`write-memory ${hex4(address)}H ${[...Buffer.from(data, "hex")].join(" ")}`);
      await this.#zrcp(`set-register PC=${hex4(before.pc)}H`);
      await this.#zrcp(`set-register SP=${hex4(before.sp)}H`);
      await this.#zrcp(`set-register AF=${hex4(before.af)}H`);
      await this.#zrcp(`set-register R=${before.r.toString(16)}H`);
      await this.#zrcp(`set-register IFF1=${before.iff1 ? 1 : 0}`);
      await this.#zrcp(`set-register IFF2=${before.iff2 ? 1 : 0}`);
      await this.#zrcp("cpu-history started yes");
      await this.#zrcp("reset-tstates-partial");
      await this.#discardCoverage();
    }
  }

  /** Runs one instruction of the session at TOOL_SITE, aside from the program. `setup` is a ZRCP command before it. The CPU must not wait in a HALT. */
  async #runAside(opcodes: number[], what: string, setup?: string): Promise<Z80RegisterValues> {
    const kept = [{ address: TOOL_SITE, data: await this.#read(TOOL_SITE, opcodes.length) }];
    return this.#aside(kept, async () => {
      await this.#zrcp(`write-memory ${hex4(TOOL_SITE)}H ${opcodes.join(" ")}`);
      if (setup !== undefined) await this.#zrcp(setup);
      await this.#zrcp(`set-register PC=${hex4(TOOL_SITE)}H`);
      const after = parseRegisters(await this.#zrcp("cpu-step"));
      if (after.pc !== TOOL_SITE + opcodes.length) throw new WireFailure("operation-failed", `ZEsarUX did not run ${what}: the PC is $${hex4(after.pc)}.`);
      return after;
    });
  }

  /** Sets the interrupt mode: set-register does not take IM, so the CPU runs one IM instruction aside (8 t-states). */
  async #setInterruptMode(im: number): Promise<void> {
    const after = await this.#runAside([0xed, IM_OPCODES[im]!], `the IM ${im} instruction`);
    if (after.im !== im) throw new WireFailure("operation-failed", `ZEsarUX did not run the IM ${im} instruction: the mode is ${after.im}.`);
  }

  /** Sets the border colour as an OUT to port $fe does, with bits 3 and 4 (MIC, EAR) at 0: the CPU runs one OUT (n),A aside (11 t-states). */
  async #setBorder(border: number): Promise<void> {
    await this.#runAside([OUT_N_A, 0xfe], "the OUT instruction that sets the border", `set-register AF=${hex4((border & 7) << 8)}H`);
  }

  /**
   * Ends a HALT. ZRCP has no command for it, so the session gives an NMI,
   * which ends the HALT, aside from the program (15 t-states). The two stack
   * bytes that the NMI writes get their values again.
   */
  async #endHalt(): Promise<void> {
    const { sp } = parseRegisters(await this.#zrcp("get-registers"));
    const kept: Array<{ address: number; data: string }> = [];
    for (const address of [(sp - 2) & 0xffff, (sp - 1) & 0xffff]) kept.push({ address, data: await this.#read(address, 1) });
    await this.#aside(kept, async () => {
      await this.#zrcp("generate-nmi");
      const after = parseRegisters(await this.#zrcp("cpu-step"));
      if (after.pc !== NMI_ADDRESS) throw new WireFailure("operation-failed", `ZEsarUX did not end the HALT: after an NMI the PC is $${hex4(after.pc)}, not $${hex4(NMI_ADDRESS)}.`);
    });
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
    await this.#measureRepeats();
    const { newer, count } = this.#repeats!;
    const text = await this.#zrcp(`cpu-history get-pc 0 ${params.count + count}`);
    const pcs = text.split(/\s+/).filter((item) => /^[0-9a-f]{1,4}$/i.test(item)).map((item) => Number.parseInt(item, 16));
    pcs.splice(newer, count);
    return { pcs: pcs.slice(0, params.count) };
  }

  /**
   * The entries of the CPU history that ZEsarUX repeated at the last stop of
   * a run: after `newer` entries, `count` entries that are copies of the entry
   * below them. Undefined when the CPU ran after the last count.
   */
  #repeats: { newer: number; count: number } | undefined;

  /**
   * Counts the repeated entries at the top of the CPU history. At the stop of
   * a run, ZEsarUX 13.0 can record the last instruction again, a few times,
   * with all registers the same. Each real execution changes R, so two equal
   * entries one after the other are always such a copy. Do this before a step
   * puts new entries on top of them.
   */
  async #measureRepeats(): Promise<void> {
    if (this.#repeats !== undefined) return;
    let count = 0;
    const top = (await this.#zrcp("cpu-history get-pc 0 2")).split(/\s+/).filter((item) => item !== "");
    if (top.length === 2 && top[0] === top[1]) {
      const entry = await this.#zrcp("cpu-history get-extended 0");
      while (count < MAX_REPEATS && (await this.#zrcp(`cpu-history get-extended ${count + 1}`)) === entry) count++;
    }
    this.#repeats = { newer: 0, count };
  }

  // ---- Coverage ----

  /** Joins the executed instructions and the written addresses since the last drain into the coverage of the session; ZEsarUX then forgets them. */
  async #drainCoverage(): Promise<void> {
    const executed = codeCoverageAddresses(await this.#zrcp("cpu-code-coverage get"));
    await this.#zrcp("cpu-code-coverage clear");
    const written = visualmemAddresses(await this.#zrcp("get-visualmem-written-dump"));
    for (const address of executed) this.#coverage[address]! |= address < ROM_END ? COVERAGE.romExecute : COVERAGE.ramExecute;
    for (const address of written) if (address >= ROM_END) this.#coverage[address]! |= COVERAGE.ramWrite;
  }

  /** Forgets the executed instructions and the written addresses since the last drain: a load or a tool did them, not the CPU. */
  async #discardCoverage(): Promise<void> {
    await this.#zrcp("cpu-code-coverage clear");
    await this.#zrcp("get-visualmem-written-dump");
  }

  async #memmap(params: { action: "clear" | "read" }): Promise<SpectrumOperations["memmap"]["result"]> {
    this.#requireStopped();
    await this.#drainCoverage();
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
      if (this.#lost === undefined) await this.#press(params.keys, false);
    }
  }

  /**
   * Types the text key by key. A breakpoint or a watchpoint stops the typing:
   * typed counts the characters whose keys were down for all their frames
   * before the stop. A character whose keys the stop released early is not
   * counted, because the program possibly did not read it.
   */
  async #type(params: { text: string }): Promise<SpectrumOperations["keyboard"]["result"]> {
    this.#requireStopped();
    const characters = [...params.text];
    const keys = characters.map(keysOf);
    let stop: SpectrumStop = { state: "stopped" };
    for (const [index, down] of keys.entries()) {
      stop = await this.#keys({ keys: down, frames: KEY_FRAMES });
      if (stop.stopReason !== "frames") return { ...stop, typed: index };
      stop = await this.#runFor(KEY_FRAMES);
      if (stop.stopReason !== "frames") return { ...stop, typed: index + 1 };
    }
    return { ...stop, typed: characters.length };
  }

  async #setJoystick(params: SpectrumOperations["joystick"]["params"]): Promise<{ set: boolean }> {
    this.#joystick = (params.right ? 1 : 0) | (params.left ? 2 : 0) | (params.down ? 4 : 0) | (params.up ? 8 : 0) | (params.fire ? 16 : 0);
    await this.#setPorts();
    return { set: true };
  }

  // ---- Media and snapshots ----

  /**
   * Loads and starts the file. The result gives the model after the load: a
   * snapshot sets it, and a tape runs on the model of the call or else on the
   * model that the session started with. A file that is not what its type
   * says is refused before the load, and the machine does not change.
   */
  async #autostart(params: SpectrumOperations["autostart"]["params"], bytes: Buffer): Promise<SpectrumOperations["autostart"]["result"]> {
    const media = checkMedia(params.type, bytes);
    if (this.#run !== undefined) await this.#execution({ action: "pause" });
    const file = join(this.#zesarux.scratch, `media.${params.type}`);
    writeFileSync(file, media.bytes);
    await this.#drainCoverage();
    if ((SPECTRUM_TAPES as readonly string[]).includes(params.type)) {
      const model = params.model ?? this.#startModel;
      if (model !== this.#model) {
        this.#log(`the Spectrum session runs the tape on the ${MODEL_NAME[model]}`);
        await this.#setMachine(model);
      }
    }
    // smartload works only in step mode; after a change of the machine the first try can fail.
    let answer = await this.#zrcp(`smartload ${file}`);
    if (answer.startsWith("Error")) {
      await this.#stepMode();
      answer = await this.#zrcp(`smartload ${file}`);
    }
    if (answer.startsWith("Error")) throw new WireFailure("media-error", `ZEsarUX did not load the file: ${answer.split("\n")[0]}`);
    await this.#stepMode();
    await this.#followMachine();
    // The load wrote the memory, not the CPU.
    await this.#discardCoverage();
    await this.#afterLoad();
    this.#stop = {};
    this.#frameEnd = undefined;
    if (media.border !== undefined) await this.#setBorder(media.border);
    return { ...(await this.#execution({ action: "resume" })), model: this.#model };
  }

  async #programLoad(params: { address: number }, bytes: Buffer): Promise<{ address: number; size: number }> {
    this.#requireStopped();
    this.#refuseRom(params.address, "The program");
    if (params.address + bytes.length > 0x10000) throw new WireFailure("invalid-input", "The program runs past $ffff.");
    const file = join(this.#zesarux.scratch, "program.bin");
    writeFileSync(file, bytes);
    await this.#drainCoverage();
    await this.#zrcp(`load-binary ${file} ${params.address} 0`);
    await this.#discardCoverage();
    return { address: params.address, size: bytes.length };
  }

  #snapshotNames(): string[] {
    return existsSync(this.#snapshots) ? readdirSync(this.#snapshots).filter((file) => file.endsWith(".zsf")).map((file) => file.slice(0, -4)).sort() : [];
  }

  /** Every action gives the names of the snapshots that the session keeps after it. */
  async #snapshot(params: SpectrumOperations["snapshot"]["params"]): Promise<{ names: string[] }> {
    if (params.action === "list") return { names: this.#snapshotNames() };
    this.#requireStopped();
    const file = join(this.#snapshots, `${params.name}.zsf`);
    const sidecar = join(this.#snapshots, `${params.name}.json`);
    if (params.action === "save") {
      mkdirSync(this.#snapshots, { recursive: true });
      // ZEsarUX's own .zsf keeps the HALT state; its .z80 writer gets E wrong (13.0). The .zsf does not keep IM 1 and IFF2 apart.
      const registers = parseRegisters(await this.#zrcp("get-registers"));
      await this.#zrcp(`snapshot-save ${file}`);
      writeFileSync(sidecar, JSON.stringify({ im: registers.im, iff1: registers.iff1, iff2: registers.iff2 } satisfies InterruptState));
      return { names: this.#snapshotNames() };
    }
    if (!existsSync(file)) throw new WireFailure("not-found", `There is no snapshot ${params.name}.`);
    if (params.action === "remove") {
      rmSync(file);
      rmSync(sidecar, { force: true });
      return { names: this.#snapshotNames() };
    }
    await this.#restore(file, JSON.parse(readFileSync(sidecar, "utf8")) as InterruptState);
    return { names: this.#snapshotNames() };
  }

  /**
   * Loads a named snapshot. The clock of the session does not count the load.
   * The .zsf loads IM 1 as IM 0: then the CPU runs one IM 1 instruction. When
   * the CPU waited in a HALT, it loads the file without the HALT and with the
   * PC on the HALT instruction, runs the IM instruction, and then steps the
   * HALT instruction, so that it waits in the HALT again.
   */
  async #restore(file: string, saved: InterruptState): Promise<void> {
    await this.#settleClock();
    await this.#drainCoverage();
    const bytes = readFileSync(file);
    const fixMode = saved.im === 1;
    const halted = fixMode && zsfHalted(bytes);
    let loaded = file;
    if (halted) {
      loaded = join(this.#zesarux.scratch, "restore.zsf");
      writeFileSync(loaded, zsfOnHaltInstruction(bytes));
    }
    try {
      await this.#zrcp(`snapshot-load ${loaded}`);
    } finally {
      if (halted) rmSync(loaded, { force: true });
    }
    await this.#stepMode();
    // A snapshot of the session can be of the other model: the session follows it.
    await this.#followMachine();
    await this.#zrcp("reset-tstates-partial");
    await this.#discardCoverage();
    await this.#afterLoad();
    this.#stop = {};
    this.#frameEnd = undefined;
    if (fixMode) {
      await this.#setInterruptMode(1);
      if (halted) {
        const { pc, r } = parseRegisters(await this.#zrcp("get-registers"));
        if ((await this.#read(pc, 1)) !== "76") throw new WireFailure("operation-failed", `The snapshot waits in a HALT, but $${hex4(pc)} holds no HALT instruction.`);
        await this.#zrcp("cpu-history started no");
        await this.#zrcp("cpu-step");
        await this.#zrcp(`set-register R=${r.toString(16)}H`);
        await this.#zrcp("cpu-history started yes");
        await this.#zrcp("reset-tstates-partial");
        await this.#discardCoverage();
      }
    }
    const now = parseRegisters(await this.#zrcp("get-registers"));
    if (now.iff1 !== saved.iff1) await this.#zrcp(`set-register IFF1=${saved.iff1 ? 1 : 0}`);
    if (now.iff2 !== saved.iff2) await this.#zrcp(`set-register IFF2=${saved.iff2 ? 1 : 0}`);
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
      registers: { ...registers, im: registers.im as 0 | 1 | 2 },
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
    await this.#settleClock();
    if (params.action === "start") {
      this.#clockBase = this.#elapsed;
      return { tstates: 0 };
    }
    return { tstates: this.#elapsed - this.#clockBase };
  }

  async #ula(): Promise<SpectrumOperations["ula"]["result"]> {
    const ports = await this.#zrcp("get-io-ports");
    const fe = Number.parseInt(/Spectrum FE port: ([0-9a-f]+)/i.exec(ports)?.[1] ?? "0", 16);
    const model = { model: this.#model, frameTstates: FRAME_TSTATES[this.#model] };
    if (this.#model === "48k") return { ...model, border: fe & 7 };
    const port = Number.parseInt(/Spectrum 7FFD port: ([0-9a-f]+)/i.exec(ports)?.[1] ?? "0", 16);
    return { ...model, border: fe & 7, port7ffd: port, pagedBank: port & 7, screenBank: (port & 8) !== 0 ? 7 : 5, rom: (port >> 4) & 1, pagingLocked: (port & 0x20) !== 0 };
  }

  async #ay(): Promise<{ selected: number; registers: number[] }> {
    if (this.#model === "48k") {
      throw new WireFailure("invalid-input", "The machine is a 48K now, and the 48K has no AY sound chip. The ay tool works on the 128K: it works again after a load of a 128K file.");
    }
    return ayOfIoPorts(await this.#zrcp("get-io-ports"));
  }
}

/** The ZX Spectrum 48K and 128K on ZEsarUX. */
export function zesaruxBackend(options: { supervisor: ProcessSupervisor; env?: NodeJS.ProcessEnv }): MachineBackend {
  return {
    emulator: "ZEsarUX",
    machines: ZESARUX_MACHINES,
    start: async ({ machine, log }) => ZesaruxSession.start({ ...options, machine, ...(log === undefined ? {} : { log }) }),
    isOperation: (op) => (SPECTRUM_OPERATIONS as readonly string[]).includes(op),
    validate: (op, params) => validateSpectrumParams(op as SpectrumOperation, params),
    attachments: (op) => spectrumAttachmentCount(op as SpectrumOperation),
  };
}
