// The c64-disk script: inspects a project disk image with c1541 through the
// Host Runtime and extracts files into the project. T64 tape files and CRT
// cartridge files are read locally: no host tool reads them.

import { formatC64Address } from "#src/c64.ts";
import { isRefusal, Refusal } from "#src/errors.ts";
import { DISK_IMAGE_TYPES, inspectDisk } from "#src/host-client/tools.ts";
import { readProjectFile, writeReported } from "#src/host-client/transfer.ts";
import { OPTIONS, runScript, type Call, type SubjectSpec } from "#src/script.ts";
import { parseCrt, parseT64, tapeFile } from "./lib/containers.ts";

const IMAGE: SubjectSpec = { name: "<image>", help: "a .d64, .d71, .d81 or .g64 disk image, relative to the project folder" };
const NAME: SubjectSpec = { name: "<name>", help: "the file name as the directory shows it. Write a byte that has no character as {$xx}, for example {$c1}" };

type Kind = "disk" | "t64" | "crt";
/** The kind of a file by its extension; undefined for a file that no command takes. */
function kindOf(image: string): Kind | undefined {
  const extension = image.toLowerCase().split(".").at(-1) ?? "";
  if (extension === "t64" || extension === "crt") return extension;
  return (DISK_IMAGE_TYPES as readonly string[]).includes(extension) ? "disk" : undefined;
}

const KIND_TEXT: Record<Kind, string> = { disk: "a .d64, .d71, .d81 or .g64 disk image", t64: "a .t64 tape file", crt: "a .crt cartridge file" };

/** The kind of the image of a command; refuses a file of a kind that the command does not take, and names every kind that it takes. */
function kindFor(command: string, image: string, takes: readonly Kind[]): Kind {
  const kind = kindOf(image);
  if (kind !== undefined && takes.includes(kind)) return kind;
  const kinds = takes.map((item) => KIND_TEXT[item]);
  const list = kinds.length === 1 ? kinds[0]! : `${kinds.slice(0, -1).join(", ")} or ${kinds.at(-1)}`;
  throw new Refusal("invalid-input", `${image} is not a file that ${command} takes. Give ${list}.`);
}

/** Runs `body` and names the file in a refusal of its content. */
function about<T>(image: string, body: () => T): T {
  try {
    return body();
  } catch (error) {
    if (isRefusal(error) && error.code === "media-error") throw new Refusal(error.code, `${image}: ${error.message}`);
    throw error;
  }
}

/** A file that the image does not hold. */
const noFile = (image: string, name: string) => new Refusal("not-found", `${image} has no file ${name}. Give the name as directory shows it.`);

/** directory, bam, entry and chain of a disk image through c1541. */
async function inspect(call: Call, action: "directory" | "bam" | "entry" | "chain"): Promise<unknown> {
  const image = call.subject(0);
  const name = call.subjects[1];
  const result = await inspectDisk({ image, action, ...(name === undefined ? {} : { name }) });
  if ("found" in result && !result.found) throw noFile(image, name!);
  const { action: _action, ...output } = result;
  return output;
}

/** The directory of a T64 tape file. */
function tapeDirectory(image: string) {
  const tape = about(image, () => parseT64(readProjectFile(image).bytes));
  return {
    name: tape.name,
    entries: tape.entries.map((entry) => ({ name: entry.name, start: formatC64Address(entry.start), end: formatC64Address(entry.end), bytes: entry.bytes, ...(entry.fixedSize ? { fixedSize: true } : {}) })),
  };
}

/** A CRT cartridge file: its header and CHIP packets, each with the PRG file name that crt writes. */
function cartridge(image: string) {
  const crt = about(image, () => parseCrt(readProjectFile(image).bytes));
  const chips = crt.chips.map((chip) => ({ bank: chip.bank, address: formatC64Address(chip.address), size: chip.size, space: `bank${chip.bank}`, file: `bank${chip.bank}-${chip.address.toString(16).padStart(4, "0")}.prg` }));
  return { crt, header: { name: crt.name, type: crt.type, typeName: crt.typeName, exrom: crt.exrom, game: crt.game, ...(crt.mode === undefined ? {} : { mode: crt.mode }) }, chips };
}

/** A command that takes only a disk image. */
const diskOnly = (call: Call, action: string) => kindFor(action, call.subject(0), ["disk"]);

await runScript({
  name: "disk",
  summary: "Inspects a disk image with c1541 and extracts files into the project. T64 tape files and CRT cartridge files are read here. A CRT can have hardware type 0 (normal 8K, 16K or Ultimax), 5 (Ocean), 19 (Magic Desk) or 32 (EasyFlash).",
  commands: [
    {
      name: "directory",
      summary: "The disk name, the id, the free blocks and the files. It also reads a .t64 tape file and a .crt cartridge file.",
      subjects: [{ ...IMAGE, help: "a disk image, a .t64 tape file or a .crt cartridge file, relative to the project folder" }],
      run: async (call) => {
        const image = call.subject(0);
        const kind = kindFor("directory", image, ["disk", "t64", "crt"]);
        if (kind === "t64") return tapeDirectory(image);
        if (kind === "crt") {
          const { header, chips } = cartridge(image);
          return { ...header, chips: chips.map(({ file: _file, ...chip }) => chip) };
        }
        return inspect(call, "directory");
      },
    },
    {
      name: "bam",
      summary: "The free and used sectors of each track, and the used sectors that no file holds.",
      subjects: [IMAGE],
      run: (call) => {
        diskOnly(call, "bam");
        return inspect(call, "bam");
      },
    },
    {
      name: "entry",
      summary: "The directory entry of one file.",
      subjects: [IMAGE, NAME],
      run: (call) => {
        diskOnly(call, "entry");
        return inspect(call, "entry");
      },
    },
    {
      name: "chain",
      summary: "The track and the sector of each block of one file.",
      subjects: [IMAGE, NAME],
      run: (call) => {
        diskOnly(call, "chain");
        return inspect(call, "chain");
      },
    },
    {
      name: "read",
      summary: "Writes the bytes of one file into the project. It also reads a .t64 tape file.",
      subjects: [{ ...IMAGE, help: "a disk image or a .t64 tape file, relative to the project folder" }, NAME],
      options: { out: { ...OPTIONS.out, value: "<file>", help: "the file to write, relative to the project folder", required: true } },
      run: async (call) => {
        const [image, name] = [call.subject(0), call.subject(1)];
        const out = call.string("out")!;
        if (kindOf(image) === "crt") throw new Refusal("invalid-input", `read takes a disk image or a .t64 tape file. Use the command crt for the cartridge file ${image}.`);
        const kind = kindFor("read", image, ["disk", "t64"]);
        if (kind === "t64") {
          const { bytes } = readProjectFile(image);
          const tape = about(image, () => parseT64(bytes));
          const entry = tape.entries.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase());
          if (entry === undefined) throw noFile(image, name);
          return { name: entry.name, ...writeReported(out, tapeFile(bytes, entry), { what: "--out" }) };
        }
        const result = await inspectDisk({ image, action: "read", name });
        if (result.action !== "read" || !result.found) throw noFile(image, name);
        return { name: result.name, ...writeReported(out, result.data!, { what: "--out" }) };
      },
    },
    {
      name: "crt",
      summary: "Writes each CHIP packet of a cartridge as a PRG, and crt.json with the header and the packets.",
      subjects: [{ name: "<file.crt>", help: "a .crt cartridge file, relative to the project folder" }],
      options: { out: { ...OPTIONS.out, value: "<dir>", help: "the folder for the files, relative to the project folder", required: true } },
      run: (call) => {
        const image = call.subject(0);
        kindFor("crt", image, ["crt"]);
        const out = call.string("out")!;
        const { crt, header, chips } = cartridge(image);
        const files = crt.chips.map((chip, index) => writeReported(`${out}/${chips[index]!.file}`, Buffer.concat([Buffer.from([chip.address & 0xff, chip.address >> 8]), chip.data]), { what: "--out" }));
        files.push(writeReported(`${out}/crt.json`, `${JSON.stringify({ ...header, chips }, null, 2)}\n`, { what: "--out" }));
        return { ...header, chips, files };
      },
    },
  ],
});
