// MCP server creation, tool registration and the one place where failures
// become MCP results. Tool groups live in tools/; nothing here knows VICE.

import { createRequire } from "node:module";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolResult, type Tool as McpTool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { formatC64Address, parseC64Address } from "../c64.ts";
import type { ViceSessionClient } from "../host-client/vice-session.ts";
import { COMPARISONS, CONDITION_REGISTERS, MEMORY_VIEWS, SPACES, WireFailure, type Condition, type WireError } from "../protocol.ts";

/** The session operations tools may call. */
export type ViceSessionApi = Pick<
  ViceSessionClient,
  | "status"
  | "memoryRead"
  | "registersGet"
  | "memoryWrite"
  | "memorySearch"
  | "memoryCompare"
  | "disassemble"
  | "registersSet"
  | "execution"
  | "reset"
  | "warp"
  | "window"
  | "programLoad"
  | "autostart"
  | "diskAttach"
  | "keyboard"
  | "joystick"
  | "screenCapture"
  | "screenCompare"
  | "screenBaselines"
  | "screenDiscard"
  | "snapshot"
  | "cpuHistory"
  | "backtrace"
  | "timing"
  | "profile"
  | "memmap"
  | "vicii"
  | "sprites"
  | "cia"
  | "sid"
  | "observe"
  | "breakpoint"
  | "watchpoint"
  | "runUntil"
>;

/** Resolves the session, opening it on first use when the start-up attempt failed. */
export type SessionSource = () => Promise<ViceSessionApi>;

type JsonObject = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Public schema primitives shared by the tool groups (15 §3)

/** Input address: "$" and four hex digits, either case. Parses to a number. */
export const AddressInput = z
  .string()
  .regex(/^\$[0-9a-fA-F]{4}$/, "must be $ followed by four hex digits, for example $c000")
  .transform((value) => parseC64Address(value) as number)
  .describe("C64 address, $0000 to $ffff");

/** Output address: "$" and four lowercase hex digits. */
export const AddressOutput = z.string().regex(/^\$[0-9a-f]{4}$/).describe("C64 address, $0000 to $ffff");

export const Byte = z.number().int().min(0).max(255);

export const HexData = z.string().regex(/^(?:[0-9a-f]{2})*$/).describe("bytes as lowercase hex, two digits per byte, no separators");

/** Input bytes: hex in either case, two digits per byte, at least one byte. Parses to lowercase. */
export const HexDataInput = z
  .string()
  .regex(/^(?:[0-9a-fA-F]{2})+$/, "must be hex bytes, two digits per byte, no separators, for example a9008d20d0")
  .transform((value) => value.toLowerCase());

export const SpaceInput = z.enum(SPACES).default("c64").describe("c64 is the computer; drive8 is the 1541 disk drive CPU");

export const MemoryViewInput = z
  .enum(MEMORY_VIEWS)
  .default("cpu")
  .describe("cpu reads what the CPU sees now (ROM and I/O where banked in); ram reads the RAM underneath (c64 only)");

/** A name the agent gives to something the session keeps, such as a screen baseline or a snapshot. */
export const TransientName = z
  .string()
  .regex(/^[A-Za-z0-9._-]{1,64}$/, "must be 1 to 64 letters, digits, dots, underscores or hyphens")
  .describe("a name you choose: 1 to 64 letters, digits, dots, underscores or hyphens");

/**
 * Checks the fields of one action of a multi-action tool: a field that the
 * action does not use, or a missing required field, is an invalid-input error.
 */
export function requireFields(action: string, given: Record<string, unknown>, allowed: readonly string[], required: readonly string[] = []): void {
  for (const [field, value] of Object.entries(given)) {
    if (value !== undefined && !allowed.includes(field)) throw new WireFailure("invalid-input", `${field} is not used with action ${action}.`);
  }
  for (const field of required) {
    if (given[field] === undefined) throw new WireFailure("invalid-input", `Action ${action} needs ${field}.`);
  }
}

/** A tool result that carries content blocks (for example an image) beside its structured result. */
export class ToolOutput<T> {
  readonly structured: T;
  readonly content: CallToolResult["content"];

  constructor(structured: T, content: CallToolResult["content"]) {
    this.structured = structured;
    this.content = content;
  }
}

export interface ToolDefinition<I extends z.ZodObject = z.ZodObject, O extends z.ZodObject = z.ZodObject> {
  name: string;
  title: string;
  description: string;
  inputSchema: I;
  outputSchema: O;
  /** True for operations that only observe the machine. */
  readOnly: boolean;
  run(input: z.output<I>, session: ViceSessionApi): Promise<z.input<O> | ToolOutput<z.input<O>>>;
}

/** A typed condition (15 §6): register, memory or raster. No expression language. */
export const ConditionInput = z
  .discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("register"),
        register: z.enum(CONDITION_REGISTERS),
        operator: z.enum(COMPARISONS),
        value: Byte,
      })
      .strict(),
    z
      .object({
        kind: z.literal("memory"),
        address: AddressInput,
        operator: z.enum(COMPARISONS),
        value: Byte,
        space: SpaceInput,
        view: MemoryViewInput,
      })
      .strict(),
    z
      .object({
        kind: z.literal("raster"),
        line: z.number().int().min(0).describe("raster line: PAL 0-311, NTSC 0-262"),
        cycle: z.number().int().min(0).optional().describe("cycle in the line: PAL 0-62, NTSC 0-64; true from this cycle on"),
      })
      .strict(),
  ])
  .describe("register: a CPU register compared to a byte; memory: a byte in memory compared to a byte; raster: the raster position");

/** A condition as a result shows it: the input form, with the memory address as "$xxxx" (D21). */
export const ConditionOutput = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("register"), register: z.enum(CONDITION_REGISTERS), operator: z.enum(COMPARISONS), value: Byte }),
    z.object({ kind: z.literal("memory"), address: AddressOutput, operator: z.enum(COMPARISONS), value: Byte, space: z.enum(SPACES), view: z.enum(MEMORY_VIEWS) }),
    z.object({ kind: z.literal("raster"), line: z.number().int().min(0), cycle: z.number().int().min(0).optional() }),
  ])
  .describe("the condition given at add");

/** A protocol condition in its result form. */
export function showCondition(condition: Condition): z.input<typeof ConditionOutput> {
  return condition.kind === "memory" ? { ...condition, address: formatC64Address(condition.address) } : condition;
}

/** Removes keys whose value is undefined, so optional fields stay absent. */
export function defined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

/** A parsed condition input as the protocol type. */
export function toCondition(input: z.output<typeof ConditionInput>): Condition {
  return defined(input) as Condition;
}

/** Keeps a tool's handler typed against its own schemas. */
export function defineTool<I extends z.ZodObject, O extends z.ZodObject>(tool: ToolDefinition<I, O>): ToolDefinition {
  return tool as unknown as ToolDefinition;
}

function jsonSchema(schema: z.ZodObject, io: "input" | "output"): McpTool["inputSchema"] {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, { io }) as JsonObject;
  return rest as McpTool["inputSchema"];
}

export function toolListing(tool: ToolDefinition): McpTool {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: jsonSchema(tool.inputSchema, "input"),
    outputSchema: jsonSchema(tool.outputSchema, "output"),
    annotations: { title: tool.title, readOnlyHint: tool.readOnly, openWorldHint: false },
  };
}

function errorResult(error: WireError): CallToolResult {
  return { isError: true, content: [{ type: "text", text: JSON.stringify({ code: error.code, message: error.message }) }] };
}

/** "address: Invalid string: must match ..." style messages, one line per problem. */
function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const where = issue.path.length === 0 ? "input" : issue.path.join(".");
      return `${where}: ${issue.message}`;
    })
    .join("; ");
}

const INTERNAL_FAILURE: WireError = { code: "operation-failed", message: "The operation failed inside the c64-re-tools MCP server." };

/** Runs one tool call and translates every outcome into an MCP result. */
export async function callTool(
  tools: ReadonlyMap<string, ToolDefinition>,
  name: string,
  args: unknown,
  session: SessionSource,
  log: (line: string) => void = () => {},
): Promise<CallToolResult> {
  const tool = tools.get(name);
  if (tool === undefined) return errorResult({ code: "invalid-input", message: `There is no tool named ${name}.` });
  const parsed = tool.inputSchema.safeParse(args ?? {});
  if (!parsed.success) return errorResult({ code: "invalid-input", message: describeIssues(parsed.error) });
  try {
    const output = await tool.run(parsed.data, await session());
    // The result goes out in the shape that the tool listing advertises: keys
    // that the output schema does not name are removed, and a result that does
    // not fit the schema is an internal failure.
    const checked = tool.outputSchema.safeParse(output instanceof ToolOutput ? output.structured : output);
    if (!checked.success) {
      log(`${name} gave a result outside its output schema: ${describeIssues(checked.error)}`);
      return errorResult(INTERNAL_FAILURE);
    }
    const result = checked.data as JsonObject;
    const extra = output instanceof ToolOutput ? output.content : [];
    return { content: [{ type: "text", text: JSON.stringify(result) }, ...extra], structuredContent: result };
  } catch (error) {
    if (error instanceof WireFailure) return errorResult(error.toWire());
    log(`${name} failed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    return errorResult(INTERNAL_FAILURE);
  }
}

function packageVersion(): string {
  try {
    return (createRequire(import.meta.url)("../../package.json") as { version: string }).version;
  } catch {
    return "0.0.0";
  }
}

const INSTRUCTIONS =
  "These tools control one live Commodore 64 emulator that belongs to this session. " +
  "Addresses are four hex digits after a dollar sign, for example $c000. " +
  "Memory data is lowercase hex without separators. " +
  "Reads do not change whether the machine is running or stopped.";

export function createMcpServer(options: { tools: readonly ToolDefinition[]; session: SessionSource; log?: (line: string) => void }): Server {
  const tools = new Map(options.tools.map((tool) => [tool.name, tool]));
  const server = new Server(
    { name: "c64-re-tools", version: packageVersion() },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: options.tools.map(toolListing) }));
  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    callTool(tools, request.params.name, request.params.arguments, options.session, options.log),
  );
  return server;
}
