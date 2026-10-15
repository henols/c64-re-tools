// Memory and CPU tools: c64_memory_read, c64_memory_write, c64_memory_search,
// c64_memory_compare, c64_registers and c64_disassemble.

import { z } from "zod";

import { formatC64Address } from "../../c64.ts";
import { WireFailure } from "../../protocol/messages.ts";
import { MAX_COMPARE_DIFFERENCES, MAX_COMPARE_SIZE, MAX_DISASSEMBLE, MAX_MEMORY_READ, MAX_MEMORY_WRITE, MAX_SEARCH_PATTERN, MAX_SEARCH_RESULTS, type RegisterValues } from "../../protocol/vice.ts";
import { OutInput, ProjectInput, writeOut, WrittenOutput } from "../output.ts";
import { AddressInput, AddressOutput, Byte, defineTool, HexData, HexDataInput, MemoryViewInput, requireFields, SpaceInput } from "../server.ts";

/** With out, a read or a disassembly can be larger than one answer of the session: it is read in parts (D39). */
const MAX_MEMORY_READ_OUT = 0x10000;
const MAX_DISASSEMBLE_OUT = 32768;

export const c64MemoryRead = defineTool({
  name: "c64_memory_read",
  title: "Read C64 memory",
  description:
    `Read 1 to ${MAX_MEMORY_READ} bytes of memory, starting at an address. ` +
    "The range must not go past $ffff. Use space drive8 to read the memory of the 1541 disk drive. " +
    `With out, it reads up to ${MAX_MEMORY_READ_OUT} bytes and writes them as raw bytes to that project file. The result then gives the file, the number of bytes and a SHA-256 in place of data. ` +
    "This does not change the run state of the machine.",
  inputSchema: z
    .object({
      address: AddressInput,
      size: z.number().int().min(1).max(MAX_MEMORY_READ_OUT).describe(`number of bytes, 1 to ${MAX_MEMORY_READ}, or to ${MAX_MEMORY_READ_OUT} with out`),
      space: SpaceInput,
      view: MemoryViewInput,
      out: OutInput.optional(),
      project: ProjectInput.optional(),
    })
    .strict(),
  outputSchema: z.object({ address: AddressOutput, size: z.number().int().min(1).max(MAX_MEMORY_READ_OUT), data: HexData.optional(), ...WrittenOutput }),
  readOnly: false,
  async run(input, session) {
    const { out, project, ...read } = input;
    if (out === undefined && project !== undefined) throw new WireFailure("invalid-input", "project is used only with out.");
    if (out === undefined) {
      if (read.size > MAX_MEMORY_READ) throw new WireFailure("invalid-input", `size can be at most ${MAX_MEMORY_READ} without out.`);
      const result = await session.memoryRead(read);
      return { address: formatC64Address(result.address), size: result.data.length / 2, data: result.data };
    }
    if (read.address + read.size > 0x10000) throw new WireFailure("invalid-input", "The range must not go past $ffff.");
    const parts: Buffer[] = [];
    for (let at = read.address; at < read.address + read.size; at += MAX_MEMORY_READ) {
      const part = await session.memoryRead({ ...read, address: at, size: Math.min(MAX_MEMORY_READ, read.address + read.size - at) });
      parts.push(Buffer.from(part.data, "hex"));
    }
    return { address: formatC64Address(read.address), size: read.size, ...writeOut(out, Buffer.concat(parts), project) };
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
    `With out, it disassembles up to ${MAX_DISASSEMBLE_OUT} instructions, or to $ffff, and writes them as a listing to that project file. The result then gives the file in place of the instructions. ` +
    "This does not change the run state of the machine.",
  inputSchema: z
    .object({
      address: AddressInput,
      count: z.number().int().min(1).max(MAX_DISASSEMBLE_OUT).describe(`1 to ${MAX_DISASSEMBLE}, or to ${MAX_DISASSEMBLE_OUT} with out`),
      space: SpaceInput,
      view: MemoryViewInput,
      out: OutInput.optional(),
      project: ProjectInput.optional(),
    })
    .strict(),
  outputSchema: z.object({ instructions: z.array(z.object({ address: AddressOutput, bytes: HexData, text: z.string() })).optional(), count: z.number().int().min(0).optional(), ...WrittenOutput }),
  readOnly: false,
  async run(input, session) {
    const { out, project, ...request } = input;
    if (out === undefined && project !== undefined) throw new WireFailure("invalid-input", "project is used only with out.");
    if (out === undefined) {
      if (request.count > MAX_DISASSEMBLE) throw new WireFailure("invalid-input", `count can be at most ${MAX_DISASSEMBLE} without out.`);
      const result = await session.disassemble(request);
      return { instructions: result.instructions.map((instruction) => ({ ...instruction, address: formatC64Address(instruction.address) })) };
    }
    const lines: string[] = [];
    let address = request.address;
    // Ends at count, or where the disassembly would wrap past $ffff.
    let wrapped = false;
    while (!wrapped && lines.length < request.count && address <= 0xffff) {
      const { instructions } = await session.disassemble({ ...request, address, count: Math.min(MAX_DISASSEMBLE, request.count - lines.length) });
      if (instructions.length === 0) break;
      for (const instruction of instructions) {
        if (lines.length === request.count) break;
        if (instruction.address < address) {
          wrapped = true;
          break;
        }
        lines.push(`${formatC64Address(instruction.address)}  ${spaced(instruction.bytes).padEnd(9)} ${instruction.text}`);
        address = instruction.address + instruction.bytes.length / 2;
      }
    }
    return { count: lines.length, ...writeOut(out, `${lines.join("\n")}\n`, project) };
  },
});

/** Hex bytes as pairs with spaces: "a90a" is "a9 0a". */
export function spaced(hex: string): string {
  return (hex.match(/../g) ?? []).join(" ");
}

export const memoryTools = [c64MemoryRead, c64MemoryWrite, c64MemorySearch, c64MemoryCompare, c64Registers, c64Disassemble];
