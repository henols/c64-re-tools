// Media tools: c64_autostart, c64_program_load, c64_disk_attach and
// c64_snapshot. Paths are project-relative; the host-client reads the file and
// the Host Runtime receives only its bytes.

import { z } from "zod";

import { formatC64Address } from "../../c64.ts";
import { readProjectFile } from "../../host-client/transfer.ts";
import { AUTOSTART_TYPES, DISK_TYPES, MAX_SNAPSHOTS, RUN_STATES } from "../../protocol/vice.ts";
import { OutInput, writeOut, WrittenOutput } from "../output.ts";
import { AddressInput, AddressOutput, defineTool, requireFields, TransientName } from "../server.ts";

const ProjectPath = z.string().min(1).describe("path relative to the project directory, for example build/game.prg");

const list = (types: readonly string[]) => types.map((type) => `.${type}`).join(", ");

export const c64Autostart = defineTool({
  name: "c64_autostart",
  title: "Autostart a program or image",
  description:
    `Start a program, or a disk, tape or cartridge image, from the project (${list(AUTOSTART_TYPES)}). ` +
    "The C64 resets and loads the file. With run true (the default), it also runs the file. A disk image stays in drive 8. " +
    "A cartridge stays in the C64 through every reset, as on a real C64. An autostart of a file that is not a cartridge detaches it first. " +
    "Without index, a disk image loads like LOAD\"*\",8,1. index selects one directory entry by its number in the c64-disk directory list (0 is the first entry). " +
    "The machine runs when this tool returns, and the load continues.",
  inputSchema: z
    .object({
      path: ProjectPath,
      index: z.number().int().min(0).max(0xfffe).optional().describe("directory entry of a disk image, 0 is the first entry. Without it, the first file loads as with LOAD\"*\""),
      run: z.boolean().default(true).describe("true runs the program after it loads"),
    })
    .strict(),
  outputSchema: z.object({
    state: z.enum(RUN_STATES),
    emulatorFlaw: z.string().optional().describe("for a tape image: a known flaw of this VICE version that stops a tape load"),
  }),
  readOnly: false,
  async run(input, session) {
    // VICE numbers the directory entries from 1, and its 0 loads "*".
    return session.autostart({ path: input.path, index: input.index === undefined ? 0 : input.index + 1, run: input.run });
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
    "With out, save also writes it to that project file as a snapshot file (.vsf), so a later session can use it. " +
    "Action restore puts the machine back in that state and stops the CPU. Give name for a snapshot of this session, or file for a .vsf in the project. " +
    "A file restores only in the emulator version and with the machine settings that saved it. The c64_timing stopwatch keeps its reading. " +
    `Action list gives the names, and action discard removes one. A session keeps at most ${MAX_SNAPSHOTS} snapshots until it ends.`,
  inputSchema: z
    .object({
      action: z.enum(["save", "restore", "list", "discard"]),
      name: TransientName.optional().describe("save and discard, and restore without file: 1 to 64 letters, digits, dots, underscores or hyphens"),
      out: OutInput.optional().describe("save only: also write the snapshot to this project file, for example snapshots/room0.vsf. An existing file is overwritten"),
      file: ProjectPath.optional().describe("restore only: a .vsf file in the project, in place of name"),
    })
    .strict(),
  outputSchema: z.object({
    saved: z.boolean().optional(),
    name: z.string().optional(),
    restored: z.boolean().optional(),
    state: z.enum(RUN_STATES).optional(),
    snapshots: z.array(z.string()).optional(),
    discarded: z.boolean().optional(),
    ...WrittenOutput,
  }),
  readOnly: false,
  async run(input, session) {
    const { action, ...fields } = input;
    if (action === "list") {
      requireFields(action, fields, []);
      return session.snapshot({ action });
    }
    if (action === "restore" && fields.file !== undefined) {
      requireFields(action, fields, ["file"], ["file"]);
      return session.snapshotRestore(readProjectFile(fields.file).bytes);
    }
    if (action === "save") {
      requireFields(action, fields, ["name", "out"], ["name"]);
      const saved = await session.snapshot({ action, name: fields.name! });
      return fields.out === undefined ? saved : { ...saved, ...writeOut(fields.out, await session.snapshotExport(fields.name!)) };
    }
    requireFields(action, fields, ["name"], ["name"]);
    return session.snapshot({ action, name: fields.name! });
  },
});

export const mediaTools = [c64Autostart, c64ProgramLoad, c64DiskAttach, c64Snapshot];
