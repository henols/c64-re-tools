// The c64-disk script: inspects a project disk image with c1541 through the
// Host Runtime and extracts files into the project. T64 tape files and CRT
// cartridge files are read locally (D54): no host tool reads them.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";

import { formatC64Address } from "#src/c64.ts";
import { inspectDisk } from "#src/host-client/tools.ts";
import { readProjectFile, writeProjectFile } from "#src/host-client/transfer.ts";
import { resolveProjectPath } from "#src/project.ts";
import { runScript, UsageError } from "#src/script.ts";
import { ContainerError, parseCrt, parseT64, tapeFile } from "./containers.ts";

const USAGE = `disk.ts <action> <image> [name] [--out <file>]

  directory <image>                 disk name, id, free blocks and the files
  bam <image>                       free and used sectors of each track, and the
                                    used sectors that no file holds
  entry <image> <name>              the directory entry of one file
  chain <image> <name>              the track and sector of each block of one file
  read <image> <name> --out <file>  write the bytes of one file into the project
  crt <file.crt> --out <dir>        write each CHIP packet of a cartridge as a PRG

<image> is a .d64, .d71, .d81 or .g64 file, relative to the project folder.
directory and read also take a .t64 tape file, and directory a .crt cartridge
file; the script reads those itself. A CRT can have hardware type 0 (normal
8K, 16K or Ultimax), 5 (Ocean), 19 (Magic Desk) or 32 (EasyFlash).
<name> is the file name as the directory shows it. Write a byte that has no
character as {$xx}, for example {$c1}. The result is one JSON object.`;

const ACTIONS = ["directory", "bam", "entry", "chain", "read", "crt"] as const;
type Action = (typeof ACTIONS)[number];

async function run(argv: string[]): Promise<{ output: unknown; failed: boolean }> {
  const { values, positionals } = parseArgs({ args: argv, strict: true, allowPositionals: true, options: { out: { type: "string" }, help: { type: "boolean" } } });
  if (values.help) throw new UsageError("");
  const [action, image, name, ...extra] = positionals;
  if (!ACTIONS.includes(action as Action)) throw new UsageError(`the action must be one of ${ACTIONS.join(", ")}`);
  if (image === undefined) throw new UsageError("the disk image is necessary");
  const named = action === "entry" || action === "chain" || action === "read";
  if (named && name === undefined) throw new UsageError(`${action} needs a file name`);
  if ((!named && name !== undefined) || extra.length > 0) throw new UsageError("too many arguments");
  if ((action === "read" || action === "crt") && values.out === undefined) throw new UsageError(`${action} needs --out`);
  if (action !== "read" && action !== "crt" && values.out !== undefined) throw new UsageError("only read and crt take --out");
  let outPath: string | undefined;
  if (values.out !== undefined) {
    try {
      outPath = resolveProjectPath(values.out);
    } catch {
      throw new UsageError(`--out must be a path relative to the project folder that stays inside it, not ${values.out}`);
    }
  }

  const kind = image.toLowerCase().endsWith(".t64") ? "t64" : image.toLowerCase().endsWith(".crt") ? "crt" : "disk";
  if (action === "crt" && kind !== "crt") throw new UsageError("crt needs a .crt file");
  if (kind !== "disk") {
    try {
      return local(kind, action as Action, image, name, values.out);
    } catch (error) {
      if (error instanceof ContainerError) throw new UsageError(`${image}: ${error.message}`);
      throw error;
    }
  }
  const result = await inspectDisk({ image, action: action as Exclude<Action, "crt">, ...(name === undefined ? {} : { name }) });
  if ("found" in result && !result.found) return { output: { found: false }, failed: true };
  if (result.action === "read" && result.found) {
    mkdirSync(dirname(outPath!), { recursive: true });
    writeFileSync(outPath!, result.data!);
    return { output: { found: true, name: result.name, bytes: result.bytes, output: values.out }, failed: false };
  }
  const { action: _action, ...output } = result;
  return { output, failed: false };
}

/** A tape or cartridge file, read here (D54). */
function local(kind: "t64" | "crt", action: Action, image: string, name: string | undefined, out: string | undefined): { output: unknown; failed: boolean } {
  const { bytes } = readProjectFile(image);
  if (kind === "t64") {
    if (action !== "directory" && action !== "read") throw new UsageError(`a T64 file has only directory and read, not ${action}`);
    const tape = parseT64(bytes);
    const shown = (entry: (typeof tape.entries)[number]) => ({
      name: entry.name,
      start: formatC64Address(entry.start),
      end: formatC64Address(entry.end),
      bytes: entry.bytes,
      ...(entry.fixedSize ? { fixedSize: true } : {}),
    });
    if (action === "directory") return { output: { name: tape.name, entries: tape.entries.map(shown) }, failed: false };
    const entry = tape.entries.find((candidate) => candidate.name.toLowerCase() === name!.toLowerCase());
    if (entry === undefined) return { output: { found: false }, failed: true };
    const file = tapeFile(bytes, entry);
    writeProjectFile(out!, file, { what: "--out" });
    return { output: { found: true, name: entry.name, bytes: file.length, output: out }, failed: false };
  }
  if (action !== "directory" && action !== "crt") throw new UsageError(`a CRT file has only directory and crt, not ${action}`);
  const crt = parseCrt(bytes);
  const chips = crt.chips.map((chip) => ({
    bank: chip.bank,
    address: formatC64Address(chip.address),
    size: chip.size,
    space: `bank${chip.bank}`,
    file: `bank${chip.bank}-${chip.address.toString(16).padStart(4, "0")}.prg`,
  }));
  const output = { name: crt.name, type: crt.type, typeName: crt.typeName, exrom: crt.exrom, game: crt.game, ...(crt.mode === undefined ? {} : { mode: crt.mode }), chips };
  if (action === "directory") return { output: { ...output, chips: chips.map(({ file: _file, ...chip }) => chip) }, failed: false };
  crt.chips.forEach((chip, index) => writeProjectFile(`${out}/${chips[index]!.file}`, Buffer.concat([Buffer.from([chip.address & 0xff, chip.address >> 8]), chip.data]), { what: "--out" }));
  writeProjectFile(`${out}/crt.json`, Buffer.from(`${JSON.stringify(output, null, 2)}\n`), { what: "--out" });
  return { output: { ...output, out }, failed: false };
}

await runScript(
  async (argv) => {
    const { output, failed } = await run(argv);
    if (failed) process.exitCode = 1;
    return output;
  },
  { usage: USAGE },
);
