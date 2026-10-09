// Debug tools: c64_breakpoint, c64_watchpoint, c64_cpu_history, c64_backtrace,
// c64_profile, c64_memmap and c64_timing.

import { z } from "zod";

import { formatC64Address } from "../../c64.ts";
import {
  CHECKPOINT_ACTIONS,
  MAX_BACKTRACE,
  MAX_HISTORY,
  MAX_MEMMAP_RANGES,
  MAX_PROFILE,
  MAX_WATCH_SIZE,
  SPACES,
  TIMING_ACTIONS,
  WATCH_ACCESS,
  type Breakpoint,
  type Watchpoint,
} from "../../protocol.ts";
import { AddressInput, AddressOutput, Byte, ConditionInput, ConditionOutput, defineTool, HexData, requireFields, showCondition, SpaceInput, toCondition } from "../server.ts";

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
    "add returns the new id. Actions remove, enable and disable take that id. Action list gives all breakpoints. Each breakpoint shows its condition, when it has one. " +
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
  outputSchema: BreakpointOutput.partial().extend({ breakpoints: z.array(BreakpointOutput).optional() }),
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
    "add returns the new id. Actions remove, enable and disable take that id. Action list gives all watchpoints. Each watchpoint shows its condition, when it has one.",
  inputSchema: z
    .object({
      action: z.enum(CHECKPOINT_ACTIONS),
      address: AddressInput.optional().describe("add only"),
      size: z.number().int().min(1).max(MAX_WATCH_SIZE).optional().describe("add only; default 1"),
      access: z.enum(WATCH_ACCESS).optional().describe("add only"),
      space: OptionalSpace,
      condition: ConditionInput.optional().describe("add only: stop only when this is true"),
      id: Id.optional().describe("remove, enable and disable only"),
    })
    .strict(),
  outputSchema: WatchpointOutput.partial().extend({ watchpoints: z.array(WatchpointOutput).optional() }),
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
    `Get the last instructions the CPU executed, oldest first: limit of them (1 to ${MAX_HISTORY}, default 50). ` +
    "Each entry gives the address, the bytes, the instruction and the registers a, x, y and sp. " +
    "In space c64, it also gives the raster line and cycle when the instruction started. This does not change if the machine is running or stopped.",
  inputSchema: z.object({ limit: z.number().int().min(1).max(MAX_HISTORY).default(50), space: SpaceInput }).strict(),
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
    ),
  }),
  readOnly: true,
  async run(input, session) {
    const { entries } = await session.cpuHistory(input);
    return { entries: entries.map((entry) => ({ ...entry, address: formatC64Address(entry.address) })) };
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
    `Get the routines where the C64 CPU spent the most cycles since the session started, at most limit of them (1 to ${MAX_PROFILE}, default 20). ` +
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

export const c64Memmap = defineTool({
  name: "c64_memmap",
  title: "Memory access map",
  description:
    "Get how the C64 CPU used memory since the session started or since the last clear. " +
    "Action read gives ranges of addresses with the same access (execute, read, write) from start to end. " +
    `It gives at most maxRanges ranges (1 to ${MAX_MEMMAP_RANGES}, default 256). Addresses the CPU did not touch are not in the result. ` +
    "Action clear sets all access records to zero.",
  inputSchema: z
    .object({
      action: z.enum(["read", "clear"]),
      start: AddressInput.optional().describe("read only; default $0000"),
      end: AddressInput.optional().describe("read only; default $ffff"),
      maxRanges: z.number().int().min(1).max(MAX_MEMMAP_RANGES).optional().describe("read only; default 256"),
    })
    .strict(),
  outputSchema: z.object({
    ranges: z.array(z.object({ start: AddressOutput, end: AddressOutput, execute: z.boolean(), read: z.boolean(), write: z.boolean() })).optional(),
    cleared: z.boolean().optional(),
  }),
  readOnly: false,
  async run(input, session) {
    if (input.action === "clear") {
      requireFields("clear", { start: input.start, end: input.end, maxRanges: input.maxRanges }, []);
      return session.memmap({ action: "clear" });
    }
    const result = await session.memmap({ action: "read", start: input.start ?? 0x0000, end: input.end ?? 0xffff, maxRanges: input.maxRanges ?? 256 });
    return { ranges: result.ranges.map((range) => ({ ...range, start: formatC64Address(range.start), end: formatC64Address(range.end) })) };
  },
});

export const debugTools = [c64Breakpoint, c64Watchpoint, c64CpuHistory, c64Backtrace, c64Profile, c64Memmap, c64Timing];
