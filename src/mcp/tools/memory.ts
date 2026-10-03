// Memory and CPU tools: c64_memory_read (15 §14), c64_memory_write (15 §15)
// and c64_registers (15 §18).

import { z } from "zod";

import { formatC64Address } from "../../c64.ts";
import { MAX_MEMORY_READ, MAX_MEMORY_WRITE, WireFailure, type RegisterValues } from "../../protocol.ts";
import { AddressInput, AddressOutput, Byte, defineTool, HexData, HexDataInput, MemoryViewInput, SpaceInput } from "../server.ts";

export const c64MemoryRead = defineTool({
  name: "c64_memory_read",
  title: "Read C64 memory",
  description:
    `Read 1 to ${MAX_MEMORY_READ} bytes of memory, starting at an address. ` +
    "The range must not go past $ffff. Use space drive8 to read the memory of the 1541 disk drive. " +
    "This read does not change if the machine is running or stopped.",
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
    `Write 1 to ${MAX_MEMORY_WRITE} bytes to memory, starting at an address. The CPU must be stopped: ` +
    "use c64_execution action pause first. The range must not go past $ffff. " +
    "With view cpu, the write goes where the CPU writes now (a write to a ROM address goes to the RAM under it; a write to I/O goes to the chip). " +
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
    flags: Flags.partial().strict().optional().describe("any of n, v, b, d, i, z and c; flags not named keep their value"),
  })
  .strict();

export const c64Registers = defineTool({
  name: "c64_registers",
  title: "C64 CPU registers",
  description:
    "Get or set the CPU registers: pc, a, x, y, sp and the status flags n, v, b, d, i, z and c. " +
    "Action get reads them; it does not change if the machine is running or stopped. " +
    "Action set writes the registers named in values and returns all registers; the CPU must be stopped. " +
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
      if (input.values !== undefined) throw new WireFailure("invalid-input", "values is used only with action set.");
      registers = await session.registersGet(input.space);
    } else {
      if (input.values === undefined || Object.keys(input.values).length === 0) {
        throw new WireFailure("invalid-input", "values must name at least one register for action set.");
      }
      const values: RegisterValues = {};
      for (const key of ["pc", "a", "x", "y", "sp"] as const) {
        const value = input.values[key];
        if (value !== undefined) values[key] = value;
      }
      if (input.values.flags !== undefined) {
        values.flags = Object.fromEntries(Object.entries(input.values.flags).filter(([, value]) => value !== undefined));
      }
      registers = await session.registersSet(input.space, values);
    }
    return { ...registers, pc: formatC64Address(registers.pc) };
  },
});

export const memoryTools = [c64MemoryRead, c64MemoryWrite, c64Registers];
