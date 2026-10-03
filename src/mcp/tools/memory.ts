// Memory and CPU tools: c64_memory_read (15 §14) and c64_registers (15 §18).

import { z } from "zod";

import { formatC64Address } from "../../c64.ts";
import { MAX_MEMORY_READ } from "../../protocol.ts";
import { AddressInput, AddressOutput, Byte, defineTool, HexData, MemoryViewInput, SpaceInput } from "../server.ts";

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

const Flags = z.object({
  n: z.boolean(),
  v: z.boolean(),
  b: z.boolean(),
  d: z.boolean(),
  i: z.boolean(),
  z: z.boolean(),
  c: z.boolean(),
});

export const c64Registers = defineTool({
  name: "c64_registers",
  title: "C64 CPU registers",
  description:
    "Get the CPU registers: pc, a, x, y, sp and the status flags n, v, b, d, i, z and c. " +
    "Use space drive8 to get the registers of the 1541 disk drive CPU. " +
    "This read does not change if the machine is running or stopped.",
  inputSchema: z
    .object({
      action: z.enum(["get"]).describe("get reads the registers"),
      space: SpaceInput,
    })
    .strict(),
  outputSchema: z.object({ pc: AddressOutput, a: Byte, x: Byte, y: Byte, sp: Byte, flags: Flags }),
  readOnly: true,
  async run(input, session) {
    const registers = await session.registersGet(input.space);
    return { ...registers, pc: formatC64Address(registers.pc) };
  },
});

export const memoryTools = [c64MemoryRead, c64Registers];
