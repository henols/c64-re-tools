// Media tools: c64_autostart (15 §33), c64_program_load (15 §34) and
// c64_disk_attach (15 §35). Paths are project-relative; the host-client reads
// the file and the Host Runtime receives only its bytes.

import { z } from "zod";

import { formatC64Address } from "../../c64.ts";
import { AUTOSTART_TYPES, DISK_TYPES, RUN_STATES } from "../../protocol.ts";
import { AddressInput, AddressOutput, defineTool } from "../server.ts";

const ProjectPath = z.string().min(1).describe("path relative to the project directory, for example build/game.prg");

const list = (types: readonly string[]) => types.map((type) => `.${type}`).join(", ");

export const c64Autostart = defineTool({
  name: "c64_autostart",
  title: "Autostart a program or image",
  description:
    `Start a program or a disk, tape or cartridge image from the project, as when you autostart it on a real C64 (${list(AUTOSTART_TYPES)}). ` +
    "The C64 resets, loads the file and, with run true (the default), runs it. A disk image stays in drive 8. " +
    "index selects a file on a disk image (default 0, the first file). The machine is running when this returns; loading continues.",
  inputSchema: z
    .object({
      path: ProjectPath,
      index: z.number().int().min(0).max(0xffff).default(0).describe("file number on a disk image; 0 is the first file"),
      run: z.boolean().default(true).describe("true runs the program after it loads"),
    })
    .strict(),
  outputSchema: z.object({ state: z.enum(RUN_STATES) }),
  readOnly: false,
  async run(input, session) {
    return session.autostart(input);
  },
});

export const c64ProgramLoad = defineTool({
  name: "c64_program_load",
  title: "Load a PRG into memory",
  description:
    "Load a PRG file from the project into memory, with no reset and no start. The CPU stops and stays stopped. " +
    "The bytes go where the CPU would write them. Without address, the program goes to the load address in its first two bytes; " +
    "with address, it goes there instead.",
  inputSchema: z
    .object({
      path: ProjectPath,
      address: AddressInput.optional().describe("load here instead of at the file's own load address"),
    })
    .strict(),
  outputSchema: z.object({ state: z.enum(RUN_STATES), loadAddress: AddressOutput, size: z.number().int().min(1).max(0x10000) }),
  readOnly: false,
  async run(input, session) {
    const result = await session.programLoad(input.address === undefined ? { path: input.path } : { path: input.path, address: input.address });
    return { state: result.state, loadAddress: formatC64Address(result.loadAddress), size: result.size };
  },
});

export const c64DiskAttach = defineTool({
  name: "c64_disk_attach",
  title: "Attach a disk image",
  description:
    `Put a disk image from the project into drive 8 (${list(DISK_TYPES)}). ` +
    "Nothing loads or runs; use LOAD on the C64 or c64_autostart for that. This does not change if the machine is running or stopped.",
  inputSchema: z.object({ path: ProjectPath }).strict(),
  outputSchema: z.object({ attached: z.boolean() }),
  readOnly: false,
  async run(input, session) {
    return session.diskAttach(input);
  },
});

export const mediaTools = [c64Autostart, c64ProgramLoad, c64DiskAttach];
