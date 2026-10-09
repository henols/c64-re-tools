// Media tools: c64_autostart, c64_program_load, c64_disk_attach and
// c64_snapshot. Paths are project-relative; the host-client reads the file and
// the Host Runtime receives only its bytes.

import { z } from "zod";

import { formatC64Address } from "../../c64.ts";
import { AUTOSTART_TYPES, DISK_TYPES, MAX_SNAPSHOTS, RUN_STATES } from "../../protocol/vice.ts";
import { AddressInput, AddressOutput, defineTool, requireFields, TransientName } from "../server.ts";

const ProjectPath = z.string().min(1).describe("path relative to the project directory, for example build/game.prg");

const list = (types: readonly string[]) => types.map((type) => `.${type}`).join(", ");

export const c64Autostart = defineTool({
  name: "c64_autostart",
  title: "Autostart a program or image",
  description:
    `Start a program, or a disk, tape or cartridge image, from the project (${list(AUTOSTART_TYPES)}). ` +
    "The C64 resets and loads the file. With run true (the default), it also runs the file. A disk image stays in drive 8. " +
    "index selects a file on a disk image (default 0, the first file). " +
    "The machine runs when this tool returns, and the load continues.",
  inputSchema: z
    .object({
      path: ProjectPath,
      index: z.number().int().min(0).max(0xffff).default(0).describe("file number on a disk image. 0 is the first file"),
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
    "The bytes go where the CPU writes them. Without address, the program goes to the load address in its first two bytes. " +
    "With address, it goes there instead.",
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
    "Nothing loads or runs. To load from the disk, type LOAD on the C64 or use c64_autostart. " +
    "This does not change the run state of the machine.",
  inputSchema: z.object({ path: ProjectPath }).strict(),
  outputSchema: z.object({ attached: z.boolean() }),
  readOnly: false,
  async run(input, session) {
    return session.diskAttach(input);
  },
});

export const c64Snapshot = defineTool({
  name: "c64_snapshot",
  title: "Machine snapshots",
  description:
    "Save and restore the whole machine state, attached disks included. Action save keeps a snapshot under a name you choose. " +
    "Action restore puts the machine back in that state and stops the CPU. The c64_timing stopwatch keeps its reading. " +
    `Action list gives the names, and action discard removes one. A session keeps at most ${MAX_SNAPSHOTS} snapshots until it ends.`,
  inputSchema: z
    .object({
      action: z.enum(["save", "restore", "list", "discard"]),
      name: TransientName.optional().describe("save, restore and discard: 1 to 64 letters, digits, dots, underscores or hyphens"),
    })
    .strict(),
  outputSchema: z.object({
    saved: z.boolean().optional(),
    name: z.string().optional(),
    restored: z.boolean().optional(),
    state: z.enum(RUN_STATES).optional(),
    snapshots: z.array(z.string()).optional(),
    discarded: z.boolean().optional(),
  }),
  readOnly: false,
  async run(input, session) {
    const { action, name } = input;
    if (action === "list") {
      requireFields(action, { name }, []);
      return session.snapshot({ action });
    }
    requireFields(action, { name }, ["name"], ["name"]);
    return session.snapshot({ action, name: name! });
  },
});

export const mediaTools = [c64Autostart, c64ProgramLoad, c64DiskAttach, c64Snapshot];
