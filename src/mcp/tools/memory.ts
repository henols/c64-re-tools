// Memory and CPU tools: c64_memory_read, c64_memory_write, c64_memory_search,
// c64_memory_compare, c64_registers and c64_disassemble.

import { z } from "zod";

import { formatC64Address } from "../../c64.ts";
import { WireFailure } from "../../protocol/messages.ts";
import { MAX_COMPARE_DIFFERENCES, MAX_COMPARE_SIZE, MAX_DISASSEMBLE, MAX_MEMORY_READ, MAX_MEMORY_WRITE, MAX_SEARCH_PATTERN, MAX_SEARCH_RESULTS, type RegisterValues } from "../../protocol/vice.ts";
import { AddressInput, AddressOutput, Byte, defineTool, HexData, HexDataInput, MemoryViewInput, requireFields, SpaceInput } from "../server.ts";

export const c64MemoryRead = defineTool({
  name: "c64_memory_read",
  title: "Read C64 memory",
  description:
    `Read 1 to ${MAX_MEMORY_READ} bytes of memory, starting at an address. ` +
    "The range must not go past $ffff. Use space drive8 to read the memory of the 1541 disk drive. " +
    "This does not change the run state of the machine.",
  inputSchema: z
    .object({
      address: AddressInput,
      size: z.number().int().min(1).max(MAX_MEMORY_READ).describe(`number of bytes, 1 to ${MAX_MEMORY_READ}`),
      space: SpaceInput,
      view: MemoryViewInput,
    })
    .strict(),
  outputSchema: z.object({ address: AddressOutput, size: z.number().int().min(1).max(MAX_MEMORY_READ), data: HexData }),
  readOnly: true,
  async run(input, session) {
    const result = await session.memoryRead(input);
    return { address: formatC64Address(result.address), size: result.data.length / 2, data: result.data };
  },
});

export const c64MemoryWrite = defineTool({
  name: "c64_memory_write",
  title: "Write C64 memory",
  description:
    `Write 1 to ${MAX_MEMORY_WRITE} bytes to memory, starting at an address. First stop the CPU with c64_execution action pause. ` +
    "The range must not go past $ffff. With view cpu, the write goes where the CPU writes now. " +
    "A write to a ROM address goes to the RAM under it, and a write to I/O goes to the chip. " +
    "With view ram, the write goes to RAM (c64 only).",
  inputSchema: z
    .object({
      address: AddressInput,
      data: HexDataInput.describe("bytes as hex, two digits per byte, no separators, for example a9008d20d0"),
      space: SpaceInput,
      view: MemoryViewInput,
    })
    .strict(),
  outputSchema: z.object({ address: AddressOutput, bytesWritten: z.number().int().min(1).max(MAX_MEMORY_WRITE) }),
  readOnly: false,
  async run(input, session) {
    const result = await session.memoryWrite(input);
    return { address: formatC64Address(result.address), bytesWritten: result.bytesWritten };
  },
});

const Flags = z.object({
  n: z.boolean(),
  v: z.boolean(),
  b: z.boolean(),
  d: z.boolean(),
  i: z.boolean(),
  z: z.boolean(),
  c: z.boolean(),
});

const RegisterValuesInput = z
  .object({
    pc: AddressInput.optional(),
    a: Byte.optional(),
    x: Byte.optional(),
    y: Byte.optional(),
    sp: Byte.optional(),
    flags: Flags.partial().strict().optional().describe("any of n, v, b, d, i, z and c. Flags that you do not name keep their value"),
  })
  .strict();

export const c64Registers = defineTool({
  name: "c64_registers",
  title: "C64 CPU registers",
  description:
    "Get or set the CPU registers: pc, a, x, y, sp and the status flags n, v, b, d, i, z and c. " +
    "Action get reads them. This does not change the run state of the machine. " +
    "Action set writes the registers that values names and returns all registers. Stop the CPU before you use set. " +
    "Use space drive8 for the CPU of the 1541 disk drive.",
  inputSchema: z
    .object({
      action: z.enum(["get", "set"]),
      space: SpaceInput,
      values: RegisterValuesInput.optional().describe("set only: the registers to write"),
    })
    .strict(),
  outputSchema: z.object({ pc: AddressOutput, a: Byte, x: Byte, y: Byte, sp: Byte, flags: Flags }),
  readOnly: false,
  async run(input, session) {
    let registers;
    if (input.action === "get") {
      requireFields(input.action, { values: input.values }, []);
      registers = await session.registersGet(input.space);
    } else {
      requireFields(input.action, { values: input.values }, ["values"], ["values"]);
      const values: RegisterValues = {};
      for (const key of ["pc", "a", "x", "y", "sp"] as const) {
        const value = input.values?.[key];
        if (value !== undefined) values[key] = value;
      }
      const flags = Object.fromEntries(Object.entries(input.values?.flags ?? {}).filter(([, value]) => value !== undefined));
      if (Object.keys(flags).length > 0) values.flags = flags;
      if (Object.keys(values).length === 0) {
        throw new WireFailure("invalid-input", "values must name at least one register for action set.");
      }
      registers = await session.registersSet(input.space, values);
    }
    return { ...registers, pc: formatC64Address(registers.pc) };
  },
});

/** "a9 ?? 8d 20 d0": hex bytes and ?? wildcards, separated by spaces. */
const SearchPattern = z
  .string()
  .regex(/^\s*(?:[0-9a-fA-F]{2}|\?\?)(?:\s+(?:[0-9a-fA-F]{2}|\?\?))*\s*$/, "must be hex bytes and ?? wildcards separated by spaces, for example a9 ?? 8d")
  .transform((value) => value.trim().split(/\s+/).map((token) => (token === "??" ? null : Number.parseInt(token, 16))))
  .describe("hex bytes and ?? (any byte), separated by spaces, for example a9 ?? 8d 20 d0");

export const c64MemorySearch = defineTool({
  name: "c64_memory_search",
  title: "Search C64 memory",
  description:
    `Find a byte pattern of 1 to ${MAX_SEARCH_PATTERN} bytes in memory from start to end. ?? matches any byte. ` +
    `The result gives the start address of each match, at most maxResults (1 to ${MAX_SEARCH_RESULTS}, default 100). ` +
    "This does not change the run state of the machine.",
  inputSchema: z
    .object({
      start: AddressInput,
      end: AddressInput.optional().describe("last address to search. Default $ffff"),
      pattern: SearchPattern,
      space: SpaceInput,
      view: MemoryViewInput,
      maxResults: z.number().int().min(1).max(MAX_SEARCH_RESULTS).default(100),
    })
    .strict(),
  outputSchema: z.object({ matches: z.array(AddressOutput) }),
  readOnly: true,
  async run(input, session) {
    if (input.pattern.length > MAX_SEARCH_PATTERN) {
      throw new WireFailure("invalid-input", `pattern has ${input.pattern.length} bytes. The limit is ${MAX_SEARCH_PATTERN}.`);
    }
    if (input.pattern.every((token) => token === null)) throw new WireFailure("invalid-input", "pattern needs at least one byte that is not ??.");
    const result = await session.memorySearch({ ...input, end: input.end ?? 0xffff });
    return { matches: result.matches.map(formatC64Address) };
  },
});

const Location = z
  .object({ address: AddressInput, space: SpaceInput, view: MemoryViewInput })
  .strict();

export const c64MemoryCompare = defineTool({
  name: "c64_memory_compare",
  title: "Compare C64 memory",
  description:
    `Compare two memory ranges of size bytes (1 to ${MAX_COMPARE_SIZE}). Each range has its own address, space and view. ` +
    `The result tells if they are equal, how many bytes differ, and the first ${MAX_COMPARE_DIFFERENCES} differences with their offset. ` +
    "This does not change the run state of the machine.",
  inputSchema: z
    .object({ left: Location, right: Location, size: z.number().int().min(1).max(MAX_COMPARE_SIZE) })
    .strict(),
  outputSchema: z.object({
    equal: z.boolean(),
    differentBytes: z.number().int().min(0),
    firstDifferences: z.array(z.object({ offset: z.number().int().min(0), left: Byte, right: Byte })),
  }),
  readOnly: true,
  async run(input, session) {
    return session.memoryCompare(input);
  },
});

export const c64Disassemble = defineTool({
  name: "c64_disassemble",
  title: "Disassemble live C64 memory",
  description:
    `Disassemble count instructions (1 to ${MAX_DISASSEMBLE}) from an address, as the bytes are in the live machine now. ` +
    "Use it to read code that a program changed or unpacked at run time. It includes the undocumented opcodes. " +
    "This does not change the run state of the machine.",
  inputSchema: z
    .object({
      address: AddressInput,
      count: z.number().int().min(1).max(MAX_DISASSEMBLE),
      space: SpaceInput,
      view: MemoryViewInput,
    })
    .strict(),
  outputSchema: z.object({ instructions: z.array(z.object({ address: AddressOutput, bytes: HexData, text: z.string() })) }),
  readOnly: true,
  async run(input, session) {
    const result = await session.disassemble(input);
    return { instructions: result.instructions.map((instruction) => ({ ...instruction, address: formatC64Address(instruction.address) })) };
  },
});

export const memoryTools = [c64MemoryRead, c64MemoryWrite, c64MemorySearch, c64MemoryCompare, c64Registers, c64Disassemble];
