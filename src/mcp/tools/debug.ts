// Debug tools: c64_breakpoint, c64_watchpoint, c64_cpu_history, c64_backtrace,
// c64_profile, c64_memmap and c64_timing.

import { z } from "zod";

import { COVERAGE, executedRamCode, EXECUTE, formatC64Address, READ, WRITE, type CodeRange } from "../../c64.ts";
import { WireFailure } from "../../protocol/messages.ts";
import { CHECKPOINT_ACTIONS, MAX_BACKTRACE, MAX_HISTORY, MAX_MEMMAP_RANGES, MAX_MEMORY_READ, MAX_PROFILE, MAX_WATCH_SIZE, SPACES, TIMING_ACTIONS, WATCH_ACCESS, type Breakpoint, type MemmapRange, type Watchpoint } from "../../protocol/vice.ts";
import { OutInput, writeOut, WrittenOutput } from "../output.ts";
import { AddressInput, AddressOutput, Byte, ConditionInput, ConditionOutput, defineTool, HexData, requireFields, showCondition, SpaceInput, toCondition, type ViceSessionApi } from "../server.ts";
import { spaced } from "./memory.ts";

/** No default here: a filled-in default would count as a field the other actions refuse. */
const OptionalSpace = z.enum(SPACES).optional().describe("add only: c64 (default) or drive8, the 1541 disk drive CPU");

const Id = z.number().int().min(1).describe("the id that action add returned");

const BreakpointOutput = z.object({
  id: z.number().int().min(1),
  address: AddressOutput,
  space: z.enum(SPACES),
  enabled: z.boolean(),
  condition: ConditionOutput.optional(),
});
const WatchpointOutput = BreakpointOutput.extend({ size: z.number().int().min(1).max(MAX_WATCH_SIZE), access: z.enum(WATCH_ACCESS) });

function showBreakpoint(point: Breakpoint) {
  const { condition, ...rest } = point;
  return { ...rest, address: formatC64Address(point.address), ...(condition === undefined ? {} : { condition: showCondition(condition) }) };
}

function showWatchpoint(point: Watchpoint) {
  const { condition, ...rest } = point;
  return { ...rest, address: formatC64Address(point.address), ...(condition === undefined ? {} : { condition: showCondition(condition) }) };
}

export const c64Breakpoint = defineTool({
  name: "c64_breakpoint",
  title: "C64 breakpoints",
  description:
    "Manage breakpoints. A breakpoint stops the CPU when it is about to execute the instruction at an address. " +
    "Action add sets one at address in space c64 or drive8. With a condition, it stops only when the condition is true. " +
    "add returns the new id. Actions remove, enable and disable take that id. remove returns removed true and the id. Action list gives all breakpoints. Each breakpoint shows its condition, when it has one. " +
    "Breakpoints stay through a reset.",
  inputSchema: z
    .object({
      action: z.enum(CHECKPOINT_ACTIONS),
      address: AddressInput.optional().describe("add only"),
      space: OptionalSpace,
      condition: ConditionInput.optional().describe("add only: stop only when this is true"),
      id: Id.optional().describe("remove, enable and disable only"),
    })
    .strict(),
  outputSchema: BreakpointOutput.partial().extend({ removed: z.literal(true).optional(), breakpoints: z.array(BreakpointOutput).optional() }),
  readOnly: false,
  async run(input, session) {
    const { action, ...fields } = input;
    if (action === "list") {
      requireFields(action, fields, []);
      const result = await session.breakpoint({ action });
      return { breakpoints: result.breakpoints.map(showBreakpoint) };
    }
    if (action !== "add") {
      requireFields(action, fields, ["id"], ["id"]);
      if (action === "remove") return session.breakpoint({ action, id: fields.id! });
      return showBreakpoint(await session.breakpoint({ action, id: fields.id! }));
    }
    requireFields(action, fields, ["address", "space", "condition"], ["address"]);
    const added = await session.breakpoint({
      action,
      address: fields.address!,
      space: fields.space ?? "c64",
      ...(fields.condition === undefined ? {} : { condition: toCondition(fields.condition) }),
    });
    return showBreakpoint(added);
  },
});

export const c64Watchpoint = defineTool({
  name: "c64_watchpoint",
  title: "C64 watchpoints",
  description:
    "Manage watchpoints. A watchpoint stops the CPU when an instruction reads or writes memory in a range. " +
    `Action add sets one at address for size bytes (1 to ${MAX_WATCH_SIZE}, default 1), with access read, write or read-write. ` +
    "With a condition, it stops only when the condition is true. For a write, a memory condition sees the memory after the write. " +
    "add returns the new id. Actions remove, enable and disable take that id. remove returns removed true and the id. Action list gives all watchpoints. Each watchpoint shows its condition, when it has one.",
  inputSchema: z
    .object({
      action: z.enum(CHECKPOINT_ACTIONS),
      address: AddressInput.optional().describe("add only"),
      size: z.number().int().min(1).max(MAX_WATCH_SIZE).optional().describe("add only. Default 1"),
      access: z.enum(WATCH_ACCESS).optional().describe("add only"),
      space: OptionalSpace,
      condition: ConditionInput.optional().describe("add only: stop only when this is true"),
      id: Id.optional().describe("remove, enable and disable only"),
    })
    .strict(),
  outputSchema: WatchpointOutput.partial().extend({ removed: z.literal(true).optional(), watchpoints: z.array(WatchpointOutput).optional() }),
  readOnly: false,
  async run(input, session) {
    const { action, ...fields } = input;
    if (action === "list") {
      requireFields(action, fields, []);
      const result = await session.watchpoint({ action });
      return { watchpoints: result.watchpoints.map(showWatchpoint) };
    }
    if (action !== "add") {
      requireFields(action, fields, ["id"], ["id"]);
      if (action === "remove") return session.watchpoint({ action, id: fields.id! });
      return showWatchpoint(await session.watchpoint({ action, id: fields.id! }));
    }
    requireFields(action, fields, ["address", "size", "access", "space", "condition"], ["address", "access"]);
    const added = await session.watchpoint({
      action,
      address: fields.address!,
      size: fields.size ?? 1,
      access: fields.access!,
      space: fields.space ?? "c64",
      ...(fields.condition === undefined ? {} : { condition: toCondition(fields.condition) }),
    });
    return showWatchpoint(added);
  },
});

export const c64CpuHistory = defineTool({
  name: "c64_cpu_history",
  title: "CPU history",
  description:
    "Get the last instructions that the CPU executed, oldest first. " +
    `limit is the number of instructions (1 to ${MAX_HISTORY}, default 50). ` +
    "Each entry gives the address, the bytes, the instruction and the registers a, x, y and sp. " +
    "In space c64, it also gives the raster line and cycle when the instruction started. " +
    "With out, it writes the entries as text lines to that project file, and the result gives the file in place of the entries. " +
    "This does not change the run state of the machine.",
  inputSchema: z.object({ limit: z.number().int().min(1).max(MAX_HISTORY).default(50), space: SpaceInput, out: OutInput.optional() }).strict(),
  outputSchema: z.object({
    entries: z.array(
      z.object({
        address: AddressOutput,
        bytes: HexData,
        text: z.string(),
        a: Byte,
        x: Byte,
        y: Byte,
        sp: Byte,
        rasterLine: z.number().int().min(0).optional(),
        rasterCycle: z.number().int().min(0).optional(),
      }),
    ).optional(),
    count: z.number().int().min(0).optional(),
    ...WrittenOutput,
  }),
  readOnly: false,
  async run(input, session) {
    const { out, ...request } = input;
    const { entries } = await session.cpuHistory(request);
    if (out === undefined) return { entries: entries.map((entry) => ({ ...entry, address: formatC64Address(entry.address) })) };
    const byte = (value: number) => value.toString(16).padStart(2, "0");
    const lines = entries.map((entry) => {
      const raster = entry.rasterLine === undefined ? "" : `  line ${entry.rasterLine} cycle ${entry.rasterCycle ?? 0}`;
      return `${formatC64Address(entry.address)}  ${spaced(entry.bytes).padEnd(9)} ${entry.text.padEnd(16)} a=${byte(entry.a)} x=${byte(entry.x)} y=${byte(entry.y)} sp=${byte(entry.sp)}${raster}`;
    });
    return { count: entries.length, ...writeOut(out, `${lines.join("\n")}\n`) };
  },
});

export const c64Backtrace = defineTool({
  name: "c64_backtrace",
  title: "Call backtrace",
  description:
    `Get the chain of subroutine calls that leads to the current instruction, most recent first, at most depth calls (1 to ${MAX_BACKTRACE}, default 16). ` +
    "Each frame gives the entry address of the routine and the address it returns to. " +
    "The chain comes from the JSR return addresses on the stack, so it is a best estimate. Interrupts are not in the chain.",
  inputSchema: z.object({ depth: z.number().int().min(1).max(MAX_BACKTRACE).default(16), space: SpaceInput }).strict(),
  outputSchema: z.object({ frames: z.array(z.object({ address: AddressOutput, returnAddress: AddressOutput.optional() })) }),
  readOnly: true,
  async run(input, session) {
    const { frames } = await session.backtrace(input);
    return {
      frames: frames.map((frame) => ({
        address: formatC64Address(frame.address),
        ...(frame.returnAddress === undefined ? {} : { returnAddress: formatC64Address(frame.returnAddress) }),
      })),
    };
  },
});

export const c64Timing = defineTool({
  name: "c64_timing",
  title: "Cycle stopwatch",
  description:
    "A stopwatch that counts C64 CPU cycles. Action start sets it to zero. Action read gives the cycles since the last start, " +
    "or since the session started, as a decimal string. A PAL frame has 19656 cycles and an NTSC frame 17095.",
  inputSchema: z.object({ action: z.enum(TIMING_ACTIONS) }).strict(),
  outputSchema: z.object({ started: z.boolean().optional(), cycles: z.string().regex(/^\d+$/).optional() }),
  readOnly: false,
  async run(input, session) {
    return session.timing(input.action);
  },
});

export const c64Profile = defineTool({
  name: "c64_profile",
  title: "Cycle profile",
  description:
    "Get the routines where the C64 CPU spent the most cycles since the session started. " +
    `limit is the maximum number of routines (1 to ${MAX_PROFILE}, default 20). ` +
    "Each entry gives the routine address, its total cycles with the routines it calls, and its own cycles. " +
    "percent is the part of all cycles that the routine used itself. " +
    "Cycle counts are decimal strings.",
  inputSchema: z.object({ limit: z.number().int().min(1).max(MAX_PROFILE).default(20) }).strict(),
  outputSchema: z.object({
    entries: z.array(z.object({ address: AddressOutput, totalCycles: z.string(), selfCycles: z.string(), percent: z.number() })),
  }),
  readOnly: true,
  async run(input, session) {
    const { entries } = await session.profile(input.limit);
    return { entries: entries.map((entry) => ({ ...entry, address: formatC64Address(entry.address) })) };
  },
});

/** The most code ranges a memmap summary lists. */
const MAX_SUMMARY_RANGES = 64;

/** The coverage bytes (D40) of start..end, read from the session in parts. */
async function readCoverage(session: ViceSessionApi, start: number, end: number): Promise<Uint8Array> {
  const map = new Uint8Array(end - start + 1);
  for (let from: number | undefined = start; from !== undefined; ) {
    const part: { ranges: MemmapRange[]; next?: number } = await session.memmap({ action: "read", start: from, end, maxRanges: MAX_MEMMAP_RANGES });
    for (const range of part.ranges) map.fill(range.flags, range.start - start, range.end - start + 1);
    from = part.next;
  }
  return map;
}

/** Where an access happened: RAM, ROM or I/O. */
function sources(flags: number): Array<"ram" | "rom" | "io"> {
  const where: Array<"ram" | "rom" | "io"> = [];
  if (flags & (COVERAGE.ramRead | COVERAGE.ramWrite | COVERAGE.ramExecute)) where.push("ram");
  if (flags & (COVERAGE.romRead | COVERAGE.romExecute)) where.push("rom");
  if (flags & (COVERAGE.ioRead | COVERAGE.ioWrite | COVERAGE.ioExecute)) where.push("io");
  return where;
}

const count = (map: Uint8Array, bit: number) => map.reduce((sum, flags) => sum + ((flags & bit) === 0 ? 0 : 1), 0);
const RangeOutput = z.object({ start: AddressOutput, end: AddressOutput });
const showRanges = (ranges: CodeRange[]) => ranges.slice(0, MAX_SUMMARY_RANGES).map((range) => ({ start: formatC64Address(range.start), end: formatC64Address(range.end) }));

export const c64Memmap = defineTool({
  name: "c64_memmap",
  title: "Memory access map",
  description:
    "Get how the C64 CPU used memory since the session started or since the last clear. RAM, ROM and I/O are apart. " +
    "Action read gives ranges of addresses with the same access (execute, read, write) from start to end. Each range also tells if the access was in RAM, ROM or I/O. " +
    `It gives at most maxRanges ranges (1 to ${MAX_MEMMAP_RANGES}, default 256). Addresses the CPU did not touch are not in the result. ` +
    "If more ranges follow, the result also gives truncated: true and next. Read again with start set to next. " +
    "With out, read writes a coverage map to that project file, one byte for each address from start to end. " +
    "Bits 0 to 2 are RAM read, write and execute. Bits 3 and 4 are ROM read and execute. Bits 5 to 7 are I/O read, write and execute. " +
    "Execute is set only on the first byte of each executed instruction. " +
    "Action summary gives the counts for RAM, ROM and I/O. It also gives the executed code in RAM with its operand bytes, and the RAM that was written and executed. " +
    `Each list has at most ${MAX_SUMMARY_RANGES} ranges. ` +
    "Action clear sets all access records to zero.",
  inputSchema: z
    .object({
      action: z.enum(["read", "summary", "clear"]),
      start: AddressInput.optional().describe("read and summary. Default $0000"),
      end: AddressInput.optional().describe("read and summary. Default $ffff"),
      maxRanges: z.number().int().min(1).max(MAX_MEMMAP_RANGES).optional().describe("read without out only. Default 256"),
      out: OutInput.optional().describe("read only: write a coverage map to this project file, one byte for each address. An existing file is overwritten"),
    })
    .strict(),
  outputSchema: z.object({
    ranges: z.array(z.object({ start: AddressOutput, end: AddressOutput, execute: z.boolean(), read: z.boolean(), write: z.boolean(), in: z.array(z.enum(["ram", "rom", "io"])) })).optional(),
    truncated: z.boolean().optional(),
    next: AddressOutput.optional(),
    ram: z.object({ executed: z.number().int(), read: z.number().int(), written: z.number().int() }).optional(),
    rom: z.object({ executed: z.number().int(), read: z.number().int() }).optional(),
    io: z.object({ executed: z.number().int(), read: z.number().int(), written: z.number().int() }).optional(),
    code: z.array(RangeOutput).optional(),
    codeTruncated: z.boolean().optional(),
    writtenAndExecuted: z.array(RangeOutput).optional(),
    writtenAndExecutedTruncated: z.boolean().optional(),
    cleared: z.boolean().optional(),
    ...WrittenOutput,
  }),
  readOnly: false,
  async run(input, session) {
    const { action, ...fields } = input;
    if (action === "clear") {
      requireFields("clear", fields, []);
      return session.memmap({ action: "clear" });
    }
    const start = fields.start ?? 0x0000;
    const end = fields.end ?? 0xffff;
    if (end < start) throw new WireFailure("invalid-input", "end must not be before start.");
    if (action === "summary") {
      requireFields("summary", fields, ["start", "end"]);
      const map = await readCoverage(session, start, end);
      // The opcodes give the instruction lengths: RAM as it is now.
      const parts: Buffer[] = [];
      for (let at = 0; at < 0x10000; at += MAX_MEMORY_READ) parts.push(Buffer.from((await session.memoryRead({ address: at, size: MAX_MEMORY_READ, space: "c64", view: "ram" })).data, "hex"));
      const memory = Buffer.concat(parts);
      const code = executedRamCode(map, start, memory);
      const written = executedRamCode(map.map((flags) => ((flags & COVERAGE.ramWrite) === 0 ? 0 : flags)), start, memory);
      return {
        ram: { executed: count(map, COVERAGE.ramExecute), read: count(map, COVERAGE.ramRead), written: count(map, COVERAGE.ramWrite) },
        rom: { executed: count(map, COVERAGE.romExecute), read: count(map, COVERAGE.romRead) },
        io: { executed: count(map, COVERAGE.ioExecute), read: count(map, COVERAGE.ioRead), written: count(map, COVERAGE.ioWrite) },
        code: showRanges(code),
        ...(code.length > MAX_SUMMARY_RANGES ? { codeTruncated: true } : {}),
        writtenAndExecuted: showRanges(written),
        ...(written.length > MAX_SUMMARY_RANGES ? { writtenAndExecutedTruncated: true } : {}),
      };
    }
    if (fields.out !== undefined) {
      requireFields("read", fields, ["start", "end", "out"]);
      return writeOut(fields.out, await readCoverage(session, start, end));
    }
    requireFields("read", fields, ["start", "end", "maxRanges"]);
    const result = await session.memmap({ action: "read", start, end, maxRanges: fields.maxRanges ?? 256 });
    const ranges = result.ranges.map((range) => ({
      start: formatC64Address(range.start),
      end: formatC64Address(range.end),
      execute: (range.flags & EXECUTE) !== 0,
      read: (range.flags & READ) !== 0,
      write: (range.flags & WRITE) !== 0,
      in: sources(range.flags),
    }));
    return result.next === undefined ? { ranges } : { ranges, truncated: true, next: formatC64Address(result.next) };
  },
});

export const debugTools = [c64Breakpoint, c64Watchpoint, c64CpuHistory, c64Backtrace, c64Profile, c64Memmap, c64Timing];
