// Debug tools: c64_breakpoint (15 §12) and c64_watchpoint (15 §13).

import { z } from "zod";

import { formatC64Address } from "../../c64.ts";
import { CHECKPOINT_ACTIONS, MAX_WATCH_SIZE, SPACES, WATCH_ACCESS, WireFailure, type Breakpoint, type Watchpoint } from "../../protocol.ts";
import { AddressInput, AddressOutput, ConditionInput, defineTool, toCondition } from "../server.ts";

/** No default here: a filled-in default would count as a field the other actions refuse. */
const OptionalSpace = z.enum(SPACES).optional().describe("add only: c64 (default) or drive8, the 1541 disk drive CPU");

const Id = z.number().int().min(1).describe("the id that action add returned");

const BreakpointOutput = z.object({ id: z.number().int().min(1), address: AddressOutput, space: z.enum(SPACES), enabled: z.boolean() });
const WatchpointOutput = BreakpointOutput.extend({ size: z.number().int().min(1).max(MAX_WATCH_SIZE), access: z.enum(WATCH_ACCESS) });

/** Checks which fields an action takes, so a wrong mix is an invalid-input error. */
function requireFields(action: string, given: Record<string, unknown>, allowed: string[], required: string[]): void {
  for (const [field, value] of Object.entries(given)) {
    if (value !== undefined && !allowed.includes(field)) throw new WireFailure("invalid-input", `${field} is not used with action ${action}.`);
  }
  for (const field of required) {
    if (given[field] === undefined) throw new WireFailure("invalid-input", `Action ${action} needs ${field}.`);
  }
}

function showBreakpoint(point: Breakpoint) {
  return { ...point, address: formatC64Address(point.address) };
}

function showWatchpoint(point: Watchpoint) {
  return { ...point, address: formatC64Address(point.address) };
}

export const c64Breakpoint = defineTool({
  name: "c64_breakpoint",
  title: "C64 breakpoints",
  description:
    "Manage breakpoints. A breakpoint stops the CPU when it is about to execute the instruction at an address. " +
    "Action add sets one at address (in space c64 or drive8), with an optional condition: then it stops only when the condition is true. " +
    "add returns the new id. Actions remove, enable and disable take that id. Action list gives all breakpoints. " +
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
      requireFields(action, fields, [], []);
      const result = (await session.breakpoint({ action })) as { breakpoints: Breakpoint[] };
      return { breakpoints: result.breakpoints.map(showBreakpoint) };
    }
    if (action !== "add") {
      requireFields(action, fields, ["id"], ["id"]);
      return showBreakpoint((await session.breakpoint({ action, id: fields.id! })) as Breakpoint);
    }
    requireFields(action, fields, ["address", "space", "condition"], ["address"]);
    const added = await session.breakpoint({
      action,
      address: fields.address!,
      space: fields.space ?? "c64",
      ...(fields.condition === undefined ? {} : { condition: toCondition(fields.condition) }),
    });
    return showBreakpoint(added as Breakpoint);
  },
});

export const c64Watchpoint = defineTool({
  name: "c64_watchpoint",
  title: "C64 watchpoints",
  description:
    "Manage watchpoints. A watchpoint stops the CPU when an instruction reads or writes memory in a range. " +
    `Action add sets one at address for size bytes (1 to ${MAX_WATCH_SIZE}, default 1) with access read, write or read-write, ` +
    "and an optional condition: then it stops only when the condition is true. For a write, a memory condition sees the memory after the write. " +
    "add returns the new id. Actions remove, enable and disable take that id. Action list gives all watchpoints.",
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
      requireFields(action, fields, [], []);
      const result = (await session.watchpoint({ action })) as { watchpoints: Watchpoint[] };
      return { watchpoints: result.watchpoints.map(showWatchpoint) };
    }
    if (action !== "add") {
      requireFields(action, fields, ["id"], ["id"]);
      return showWatchpoint((await session.watchpoint({ action, id: fields.id! })) as Watchpoint);
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
    return showWatchpoint(added as Watchpoint);
  },
});

export const debugTools = [c64Breakpoint, c64Watchpoint];
