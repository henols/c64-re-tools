// The tools of the spectrum MCP server: one ZX Spectrum on ZEsarUX. The names
// and the inputs are those of the c64 server where the machines agree; the
// descriptions give the facts of the Spectrum.

import { z } from "zod";

import { formatAddress } from "../../address.ts";
import type { SpectrumSessionClient } from "../../host-client/spectrum-session.ts";
import { WireFailure } from "../../protocol/messages.ts";
import { SPECTRUM_MAX_DISASSEMBLE, SPECTRUM_MAX_FRAMES, SPECTRUM_MAX_HISTORY, SPECTRUM_MAX_MEMORY_READ, SPECTRUM_MAX_MEMORY_WRITE, SPECTRUM_MAX_STEPS, SPECTRUM_MAX_TEXT, Z80_WRITABLE, type SpectrumStop, type Z80RegisterValues } from "../../protocol/spectrum.ts";
import { AddressInput } from "../inputs.ts";
import { OutInput, ProjectInput, writeOut, WrittenOutput } from "../output.ts";
import { AddressOutput, defineTool, HexData, requireFields, ToolOutput } from "../server.ts";

type Session = Pick<SpectrumSessionClient, Exclude<keyof SpectrumSessionClient, "closed" | "lost" | "answered" | "unreportedLoss" | "close" | "request">>;

const RunState = z.enum(["running", "stopped"]);
const StopReason = z.enum(["breakpoint", "watchpoint", "frames", "steps", "target", "timeout", "pause"]);
const StopOutput = z.object({ state: RunState, pc: AddressOutput.optional(), stopReason: StopReason.optional(), pointId: z.number().int().optional() });
const Point = z.object({ id: z.number().int(), kind: z.enum(["breakpoint", "watchpoint"]), start: AddressOutput, end: AddressOutput, access: z.enum(["read", "write", "both"]).optional(), enabled: z.boolean() });

const stop = (value: SpectrumStop) => ({ state: value.state, ...(value.pc === undefined ? {} : { pc: formatAddress(value.pc) }), ...(value.stopReason === undefined ? {} : { stopReason: value.stopReason }), ...(value.pointId === undefined ? {} : { pointId: value.pointId }) });
const point = (value: { id: number; kind: "breakpoint" | "watchpoint"; start: number; end: number; access?: "read" | "write" | "both"; enabled: boolean }) => ({ ...value, start: formatAddress(value.start), end: formatAddress(value.end) });

const REGISTERS = z.object({
  pc: AddressOutput,
  sp: AddressOutput,
  af: z.number().int(),
  bc: z.number().int(),
  de: z.number().int(),
  hl: z.number().int(),
  ix: z.number().int(),
  iy: z.number().int(),
  af2: z.number().int(),
  bc2: z.number().int(),
  de2: z.number().int(),
  hl2: z.number().int(),
  i: z.number().int(),
  r: z.number().int(),
  im: z.number().int(),
  iff1: z.boolean(),
  iff2: z.boolean(),
});
const registers = (value: Z80RegisterValues) => ({ ...value, pc: formatAddress(value.pc), sp: formatAddress(value.sp) });

const reset = defineTool<z.ZodObject, z.ZodObject, Session>({
  name: "reset",
  title: "Reset the Spectrum",
  description: "Reset the Spectrum. The ROM starts again from $0000. With run false, the CPU stops after the reset.",
  inputSchema: z.object({ run: z.boolean().default(false).describe("true: the CPU runs after the reset") }).strict(),
  outputSchema: StopOutput,
  readOnly: false,
  async run(input, session) {
    return stop(await session.reset({ run: input.run as boolean }));
  },
});

const execution = defineTool<z.ZodObject, z.ZodObject, Session>({
  name: "execution",
  title: "Stop, run or step the Z80",
  description:
    "Control the Z80. pause stops it. resume lets it run until a breakpoint or a watchpoint stops it, or until pause. step executes count instructions. " +
    `advance-frames runs count frames of 69888 t-states (48K) or 70908 t-states (128K), up to ${SPECTRUM_MAX_FRAMES}, and stops at the same emulated time on every run. ` +
    "A breakpoint or a watchpoint stops a run before its end: stopReason and pointId tell which. While the CPU runs, only execution, reset and autostart work.",
  inputSchema: z.object({ action: z.enum(["pause", "resume", "step", "advance-frames"]), count: z.number().int().min(1).max(SPECTRUM_MAX_STEPS).optional().describe("instructions for step, frames for advance-frames") }).strict(),
  outputSchema: StopOutput,
  readOnly: false,
  async run(input, session) {
    const { action, count } = input as { action: "pause" | "resume" | "step" | "advance-frames"; count?: number };
    if (action === "advance-frames" && count !== undefined && count > SPECTRUM_MAX_FRAMES) throw new WireFailure("invalid-input", `advance-frames takes at most ${SPECTRUM_MAX_FRAMES} frames.`);
    return stop(await session.execution({ action, ...(count === undefined ? {} : { count }) }));
  },
});

const runUntil = defineTool<z.ZodObject, z.ZodObject, Session>({
  name: "run_until",
  title: "Run the Spectrum to an address",
  description: "Run until the CPU fetches the instruction at an address, then stop. reached false and stopReason timeout: the address did not run in timeoutFrames frames. A breakpoint or a watchpoint can stop the run first.",
  inputSchema: z.object({ address: AddressInput, timeoutFrames: z.number().int().min(1).max(SPECTRUM_MAX_FRAMES).default(250) }).strict(),
  outputSchema: StopOutput.extend({ reached: z.boolean() }),
  readOnly: false,
  async run(input, session) {
    const result = await session.runUntil(input as { address: number; timeoutFrames: number });
    return { ...stop(result), reached: result.reached };
  },
});

const breakpoint = defineTool<z.ZodObject, z.ZodObject, Session>({
  name: "breakpoint",
  title: "Spectrum breakpoints",
  description: "Add, remove or list breakpoints. A breakpoint stops the CPU before the instruction at its address. Each has an id. Up to 90.",
  inputSchema: z.object({ action: z.enum(["add", "remove", "list"]), address: AddressInput.optional(), id: z.number().int().min(1).optional() }).strict(),
  outputSchema: z.object({ points: z.array(Point) }),
  readOnly: false,
  async run(input, session) {
    const { action, ...fields } = input as { action: "add" | "remove" | "list"; address?: number; id?: number };
    if (action === "add") requireFields(action, fields, ["address"], ["address"]);
    if (action === "remove") requireFields(action, fields, ["id"], ["id"]);
    if (action === "list") requireFields(action, fields, []);
    const params = action === "add" ? { action, address: fields.address! } : action === "remove" ? { action, id: fields.id! } : { action };
    return { points: (await session.breakpoint(params)).points.map(point) };
  },
});

const watchpoint = defineTool<z.ZodObject, z.ZodObject, Session>({
  name: "watchpoint",
  title: "Spectrum watchpoints",
  description:
    "Add, remove or list watchpoints. A watchpoint stops the CPU after an instruction that reads or writes memory from start to end. The PC is then after that instruction. " +
    "A write stops the CPU only when its address is not the address of the write before it: a loop that writes only that address stops one time.",
  inputSchema: z.object({ action: z.enum(["add", "remove", "list"]), start: AddressInput.optional(), end: AddressInput.optional(), access: z.enum(["read", "write", "both"]).optional(), id: z.number().int().min(1).optional() }).strict(),
  outputSchema: z.object({ points: z.array(Point) }),
  readOnly: false,
  async run(input, session) {
    const { action, ...fields } = input as { action: "add" | "remove" | "list"; start?: number; end?: number; access?: "read" | "write" | "both"; id?: number };
    if (action === "add") requireFields(action, fields, ["start", "end", "access"], ["start", "access"]);
    if (action === "remove") requireFields(action, fields, ["id"], ["id"]);
    if (action === "list") requireFields(action, fields, []);
    const params = action === "add" ? { action, start: fields.start!, end: fields.end ?? fields.start!, access: fields.access! } : action === "remove" ? { action, id: fields.id! } : { action };
    return { points: (await session.watchpoint(params)).points.map(point) };
  },
});

const memoryRead = defineTool<z.ZodObject, z.ZodObject, Session>({
  name: "memory_read",
  title: "Read Spectrum memory",
  description:
    `Read 1 to ${SPECTRUM_MAX_MEMORY_READ} bytes as the CPU sees them now: the ROM at $0000-$3fff, then RAM (on the 128K, the paged RAM bank at $c000). ` +
    "With out, it reads up to 65536 bytes and writes them as raw bytes to that project file. The CPU must be stopped.",
  inputSchema: z.object({ address: AddressInput, size: z.number().int().min(1).max(0x10000), out: OutInput.optional(), project: ProjectInput.optional() }).strict(),
  outputSchema: z.object({ address: AddressOutput, size: z.number().int(), data: HexData.optional(), ...WrittenOutput }),
  readOnly: true,
  async run(input, session) {
    const { address, size, out, project } = input as { address: number; size: number; out?: string; project?: string };
    if (address + size > 0x10000) throw new WireFailure("invalid-input", "The range must not go past $ffff.");
    if (out === undefined && size > SPECTRUM_MAX_MEMORY_READ) throw new WireFailure("invalid-input", `size can be at most ${SPECTRUM_MAX_MEMORY_READ} without out.`);
    const parts: Buffer[] = [];
    for (let at = address; at < address + size; at += SPECTRUM_MAX_MEMORY_READ) parts.push(Buffer.from((await session.memoryRead({ address: at, size: Math.min(SPECTRUM_MAX_MEMORY_READ, address + size - at) })).data, "hex"));
    const bytes = Buffer.concat(parts);
    if (out !== undefined) return { address: formatAddress(address), size, ...writeOut(out, bytes, project) };
    return { address: formatAddress(address), size, data: bytes.toString("hex") };
  },
});

const memoryWrite = defineTool<z.ZodObject, z.ZodObject, Session>({
  name: "memory_write",
  title: "Write Spectrum memory",
  description: `Write 1 to ${SPECTRUM_MAX_MEMORY_WRITE} bytes from an address. A write to the ROM at $0000-$3fff has no effect. First stop the CPU with execution action pause.`,
  inputSchema: z.object({ address: AddressInput, data: HexData.min(2) }).strict(),
  outputSchema: z.object({ address: AddressOutput, bytesWritten: z.number().int() }),
  readOnly: false,
  async run(input, session) {
    const result = await session.memoryWrite(input as { address: number; data: string });
    return { address: formatAddress(result.address), bytesWritten: result.bytesWritten };
  },
});

const memorySearch = defineTool<z.ZodObject, z.ZodObject, Session>({
  name: "memory_search",
  title: "Search Spectrum memory",
  description: "Find a byte pattern of 1 to 256 bytes from start to end. ?? in the pattern matches any byte. Gives at most maxResults matches. The CPU must be stopped.",
  inputSchema: z.object({ start: AddressInput, end: AddressInput, pattern: z.string().regex(/^(?:[0-9a-f]{2}|\?\?){1,256}$/).describe("hex bytes, ?? for any byte"), maxResults: z.number().int().min(1).max(1000).default(100) }).strict(),
  outputSchema: z.object({ matches: z.array(AddressOutput), truncated: z.boolean() }),
  readOnly: true,
  async run(input, session) {
    const { start, end, pattern, maxResults } = input as { start: number; end: number; pattern: string; maxResults: number };
    if (end < start) throw new WireFailure("invalid-input", "end must not be before start.");
    const parts: Buffer[] = [];
    for (let at = start; at <= end; at += SPECTRUM_MAX_MEMORY_READ) parts.push(Buffer.from((await session.memoryRead({ address: at, size: Math.min(SPECTRUM_MAX_MEMORY_READ, end - at + 1) })).data, "hex"));
    const bytes = Buffer.concat(parts);
    const wanted = (pattern.match(/../g) ?? []).map((item) => (item === "??" ? undefined : Number.parseInt(item, 16)));
    const matches: string[] = [];
    for (let offset = 0; offset + wanted.length <= bytes.length; offset++) {
      if (!wanted.every((value, index) => value === undefined || bytes[offset + index] === value)) continue;
      if (matches.length === maxResults) return { matches, truncated: true };
      matches.push(formatAddress(start + offset));
    }
    return { matches, truncated: false };
  },
});

const registersTool = defineTool<z.ZodObject, z.ZodObject, Session>({
  name: "registers",
  title: "Z80 registers",
  description: `Read or write the Z80 registers. Action write sets the registers in values: ${Z80_WRITABLE.join(", ")} (af2 to hl2 are the other set, AF' to HL'). The CPU must be stopped.`,
  inputSchema: z.object({ action: z.enum(["read", "write"]), values: z.partialRecord(z.enum(Z80_WRITABLE), z.number().int().min(0).max(0xffff)).optional() }).strict(),
  outputSchema: REGISTERS,
  readOnly: false,
  async run(input, session) {
    const { action, values } = input as { action: "read" | "write"; values?: Record<string, number> };
    if (action === "read") return registers(await session.registersGet());
    if (values === undefined) throw new WireFailure("invalid-input", "Action write needs values.");
    return registers(await session.registersSet({ values }));
  },
});

const disassemble = defineTool<z.ZodObject, z.ZodObject, Session>({
  name: "disassemble",
  title: "Disassemble Z80 code",
  description: `Disassemble 1 to ${SPECTRUM_MAX_DISASSEMBLE} Z80 instructions from an address, as the bytes are in memory now. The text is in the Zilog syntax that sjasmplus reads.`,
  inputSchema: z.object({ address: AddressInput, count: z.number().int().min(1).max(SPECTRUM_MAX_DISASSEMBLE).default(16) }).strict(),
  outputSchema: z.object({ instructions: z.array(z.object({ address: AddressOutput, bytes: HexData, text: z.string() })) }),
  readOnly: true,
  async run(input, session) {
    const result = await session.disassemble(input as { address: number; count: number });
    return { instructions: result.instructions.map((item) => ({ ...item, address: formatAddress(item.address) })) };
  },
});

const cpuHistory = defineTool<z.ZodObject, z.ZodObject, Session>({
  name: "cpu_history",
  title: "Z80 instruction history",
  description: `The addresses of the last 1 to ${SPECTRUM_MAX_HISTORY} instructions that the CPU executed, the most recent first. The CPU must be stopped.`,
  inputSchema: z.object({ count: z.number().int().min(1).max(SPECTRUM_MAX_HISTORY).default(32) }).strict(),
  outputSchema: z.object({ pcs: z.array(AddressOutput) }),
  readOnly: true,
  async run(input, session) {
    return { pcs: (await session.cpuHistory(input as { count: number })).pcs.map(formatAddress) };
  },
});

const memmap = defineTool<z.ZodObject, z.ZodObject, Session>({
  name: "memmap",
  title: "Spectrum coverage map",
  description:
    "Which memory the CPU executed, read and wrote since the session started or the last clear. Action read gives ranges with the flags of the coverage byte (1 RAM read, 2 RAM write, 4 RAM execute, 8 ROM read, 16 ROM execute); " +
    "with out it writes the 65536-byte map, which coverage of the retro-knowledge skill takes. Only the first byte of an instruction gets execute. " +
    "The addresses are those of the CPU: on the 128K a range at $c000-$ffff does not tell the RAM bank. The CPU must be stopped.",
  inputSchema: z.object({ action: z.enum(["read", "clear"]), out: OutInput.optional(), project: ProjectInput.optional() }).strict(),
  outputSchema: z.object({ cleared: z.boolean().optional(), ranges: z.array(z.object({ start: AddressOutput, end: AddressOutput, flags: z.number().int() })).optional(), ...WrittenOutput }),
  readOnly: false,
  async run(input, session) {
    const { action, out, project } = input as { action: "read" | "clear"; out?: string; project?: string };
    const result = await session.memmap({ action });
    if (action === "clear") return { cleared: true };
    const ranges = result.ranges ?? [];
    if (out !== undefined) {
      const map = new Uint8Array(0x10000);
      for (const range of ranges) map.fill(range.flags, range.start, range.end + 1);
      return { ...writeOut(out, map, project) };
    }
    return { ranges: ranges.map((range) => ({ start: formatAddress(range.start), end: formatAddress(range.end), flags: range.flags })) };
  },
});

const timing = defineTool<z.ZodObject, z.ZodObject, Session>({
  name: "timing",
  title: "Spectrum stopwatch",
  description: "A stopwatch of Z80 t-states. Action start sets it to zero. Action read gives the t-states since the last start, or since the session started.",
  inputSchema: z.object({ action: z.enum(["start", "read"]) }).strict(),
  outputSchema: z.object({ tstates: z.number().int() }),
  readOnly: false,
  async run(input, session) {
    return session.timing(input as { action: "start" | "read" });
  },
});

const screen = defineTool<z.ZodObject, z.ZodObject, Session>({
  name: "screen",
  title: "Spectrum screen",
  description: "Capture the screen as a PNG: the 256 x 192 picture from the screen memory and its attributes, with the border colour around it. With out, write the PNG to that project file. The CPU must be stopped.",
  inputSchema: z.object({ out: OutInput.optional(), project: ProjectInput.optional() }).strict(),
  outputSchema: z.object({ width: z.number().int(), height: z.number().int(), ...WrittenOutput }),
  readOnly: true,
  async run(input, session) {
    const { out, project } = input as { out?: string; project?: string };
    const shot = await session.screen();
    const result = { width: shot.width, height: shot.height };
    if (out !== undefined) return { ...result, ...writeOut(out, shot.png, project) };
    return new ToolOutput(result, [{ type: "image", data: shot.png.toString("base64"), mimeType: "image/png" }]);
  },
});

const keyboard = defineTool<z.ZodObject, z.ZodObject, Session>({
  name: "keyboard",
  title: "Type on the Spectrum keyboard",
  description:
    `Press keys of the keyboard matrix. With text, type up to ${SPECTRUM_MAX_TEXT} characters one by one: each key stays down 3 frames, then up 3 frames. ` +
    "A capital letter presses CAPS SHIFT too, and a sign presses SYMBOL SHIFT with its key. In BASIC the ROM shows a keyword for a letter in K mode. " +
    "With keys, hold those keys down together for frames frames, then release them: a key is a-z, 0-9, space, enter, caps or symbol. The CPU runs during the keys and stops after them. The CPU must be stopped first.",
  inputSchema: z.object({ text: z.string().min(1).max(SPECTRUM_MAX_TEXT).optional(), keys: z.array(z.string()).min(1).max(8).optional(), frames: z.number().int().min(1).max(SPECTRUM_MAX_FRAMES).default(3) }).strict(),
  outputSchema: z.object({ typed: z.number().int().optional(), ...StopOutput.partial().shape }),
  readOnly: false,
  async run(input, session) {
    const { text, keys, frames } = input as { text?: string; keys?: string[]; frames: number };
    if ((text === undefined) === (keys === undefined)) throw new WireFailure("invalid-input", "Give text or keys.");
    if (text !== undefined) return session.keyboard({ text });
    return stop(await session.keys({ keys: keys!, frames }));
  },
});

const joystick = defineTool<z.ZodObject, z.ZodObject, Session>({
  name: "joystick",
  title: "Spectrum Kempston joystick",
  description: "Set the Kempston joystick (port $1f). The directions and fire stay until the next call. The CPU must be stopped: the next run reads them.",
  inputSchema: z.object({ up: z.boolean().default(false), down: z.boolean().default(false), left: z.boolean().default(false), right: z.boolean().default(false), fire: z.boolean().default(false) }).strict(),
  outputSchema: z.object({ set: z.boolean() }),
  readOnly: false,
  async run(input, session) {
    return session.joystick(input as { up: boolean; down: boolean; left: boolean; right: boolean; fire: boolean });
  },
});

const autostart = defineTool<z.ZodObject, z.ZodObject, Session>({
  name: "autostart",
  title: "Load and start a Spectrum program",
  description: "Load a project file and start it as a user does: a tape (.tap, .tzx) loads with LOAD \"\", a snapshot (.z80, .sna, .zsf) continues at its PC. The CPU runs after it. Stop the CPU with execution action pause before you read memory.",
  inputSchema: z.object({ path: z.string().min(1).describe("the file, relative to the project folder"), project: ProjectInput.optional() }).strict(),
  outputSchema: StopOutput,
  readOnly: false,
  async run(input, session) {
    const { path, project } = input as { path: string; project?: string };
    const type = path.toLowerCase().split(".").at(-1);
    if (!["tap", "tzx", "z80", "sna", "zsf"].includes(type ?? "")) throw new WireFailure("invalid-input", "autostart takes a .tap, .tzx, .z80, .sna or .zsf file.");
    return stop(await session.autostart({ path, ...(project === undefined ? {} : { root: project }) }));
  },
});

const programLoad = defineTool<z.ZodObject, z.ZodObject, Session>({
  name: "program_load",
  title: "Put bytes into Spectrum memory",
  description: "Put the bytes of a project file into memory from an address, with no start. The CPU must be stopped.",
  inputSchema: z.object({ path: z.string().min(1), address: AddressInput, project: ProjectInput.optional() }).strict(),
  outputSchema: z.object({ address: AddressOutput, size: z.number().int() }),
  readOnly: false,
  async run(input, session) {
    const { path, address, project } = input as { path: string; address: number; project?: string };
    const result = await session.programLoad({ path, address, ...(project === undefined ? {} : { root: project }) });
    return { address: formatAddress(result.address), size: result.size };
  },
});

const snapshot = defineTool<z.ZodObject, z.ZodObject, Session>({
  name: "snapshot",
  title: "Spectrum snapshots",
  description:
    "Save, restore, remove or list named snapshots of the machine in this session. Action export writes the machine as a version 3 .z80 file to out: the knowledge takes it as the program, and other emulators load it. The CPU must be stopped.",
  inputSchema: z.object({ action: z.enum(["save", "restore", "remove", "list", "export"]), name: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/).optional(), out: OutInput.optional(), project: ProjectInput.optional() }).strict(),
  outputSchema: z.object({ names: z.array(z.string()).optional(), ...WrittenOutput }),
  readOnly: false,
  async run(input, session) {
    const { action, name, out, project } = input as { action: "save" | "restore" | "remove" | "list" | "export"; name?: string; out?: string; project?: string };
    if (action === "export") {
      if (out === undefined) throw new WireFailure("invalid-input", "Action export needs out.");
      return { ...writeOut(out, await session.snapshotExport(), project) };
    }
    if (action === "list") return session.snapshot({ action });
    if (name === undefined) throw new WireFailure("invalid-input", `Action ${action} needs name.`);
    return session.snapshot({ action, name });
  },
});

const ula = defineTool<z.ZodObject, z.ZodObject, Session>({
  name: "ula",
  title: "Spectrum ULA and paging",
  description: "Get the border colour, and on the 128K the paging of port $7ffd: the RAM bank at $c000, the screen bank (5 or 7), the ROM and the paging lock.",
  inputSchema: z.object({}).strict(),
  outputSchema: z.object({ border: z.number().int(), port7ffd: z.number().int().optional(), pagedBank: z.number().int().optional(), screenBank: z.number().int().optional(), rom: z.number().int().optional(), pagingLocked: z.boolean().optional() }),
  readOnly: true,
  async run(_input, session) {
    return { ...(await session.ula()) };
  },
});

const ay = defineTool<z.ZodObject, z.ZodObject, Session>({
  name: "ay",
  title: "Spectrum AY sound chip",
  description: "Get the 16 registers of the AY-3-8912 sound chip of the 128K and the selected register: tone periods, noise, mixer, volumes and envelope.",
  inputSchema: z.object({}).strict(),
  outputSchema: z.object({ selected: z.number().int(), registers: z.array(z.number().int()) }),
  readOnly: true,
  async run(_input, session) {
    return session.ay();
  },
});

export const spectrumTools = [reset, execution, runUntil, breakpoint, watchpoint, memoryRead, memoryWrite, memorySearch, registersTool, disassemble, cpuHistory, memmap, timing, screen, keyboard, joystick, autostart, programLoad, snapshot, ula, ay];
