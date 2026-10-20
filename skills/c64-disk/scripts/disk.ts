// The c64-disk script: inspects a project disk image with c1541 through the
// Host Runtime and extracts files into the project. T64 tape files and CRT
// cartridge files are read locally: no host tool reads them.

import { formatC64Address } from "#src/c64.ts";
import { isRefusal, Refusal } from "#src/errors.ts";
import { DISK_BLOCK_BYTES, DISK_IMAGE_TYPES, inspectDisk, MAX_DISK_SECTORS } from "#src/host-client/tools.ts";
import { readProjectFile, writeReported } from "#src/host-client/transfer.ts";
import { OPTIONS, reply, runScript, type Call, type SubjectSpec } from "#src/script.ts";
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

/** Runs `body` and names the file in a refusal of its content. A CRT of a hardware type that CRT_TYPES does not hold is also a media-error. */
function about<T>(image: string, body: () => T): T {
  try {
    return body();
  } catch (error) {
    if (isRefusal(error) && error.code === "media-error") throw new Refusal(error.code, `${image}: ${error.message}.`, { hint: MEDIA_HINT });
    throw error;
  }
}

const MEDIA_HINT = "The file has a defect, or its content is not of its type. Give this message to the user. Do not change the file.";

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

/** A sector as <track>/<sector> in decimal, for example 18/1. */
function sectorOf(text: string): { track: number; sector: number } {
  const match = /^(\d{1,3})\/(\d{1,3})$/.exec(text);
  const [track, sector] = [Number(match?.[1]), Number(match?.[2])];
  if (match === null || track < 1 || track > 255 || sector > 255) {
    throw new Refusal("invalid-input", `${text} is not a sector. Give <track>/<sector> in decimal, for example 18/1.`);
  }
  return { track, sector };
}

await runScript({
  name: "disk",
  summary: "Inspects a disk image and extracts files into the project. It also reads T64 tape files and CRT cartridge files. A CRT can have hardware type 0 (normal 8K, 16K or Ultimax), 5 (Ocean), 19 (Magic Desk) or 32 (EasyFlash).",
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
        const listing = (await inspect(call, "directory")) as { entries?: Array<{ name: string; closed?: boolean }> };
        const open = (listing.entries ?? []).filter((entry) => entry.closed === false).map((entry) => entry.name);
        if (open.length === 0) return listing;
        return reply(listing, { hint: `The file ${open.join(", ")} is not closed. Its data can be incomplete.` });
      },
    },
    {
      name: "bam",
      summary: "The free and used sectors of each track, and the used sectors that no file holds.",
      subjects: [IMAGE],
      run: async (call) => {
        diskOnly(call, "bam");
        const image = call.subject(0);
        const output = (await inspect(call, "bam")) as { unreferenced: unknown[] };
        if (output.unreferenced.length === 0) return output;
        const base = image.split("/").at(-1)!.replace(/\.[^.]*$/, "");
        return reply(output, {
          hint: "Write the unreferenced sectors to a file to examine their bytes.",
          nextAction: call.next("sectors", image, "--unreferenced", "--out", `.c64-re-tools/local/${base}-unreferenced.bin`),
        });
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
      options: { out: { ...OPTIONS.out, output: "file", value: "<file>", help: "the file to write, relative to the project folder", required: true } },
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
      name: "sectors",
      summary: "Writes the 256 bytes of each given sector into one file, in the given order. It can also write the used sectors that no file holds.",
      subjects: [IMAGE, { name: "<track>/<sector>", help: "a sector in decimal, for example 18/1. Give more sectors to write them in that order", optional: true, list: true }],
      options: {
        unreferenced: { kind: "flag", help: "write also the used sectors that no file holds, as bam lists them, after the given sectors" },
        out: { ...OPTIONS.out, output: "file", value: "<file>", help: "the file to write, relative to the project folder", required: true },
      },
      run: async (call) => {
        diskOnly(call, "sectors");
        const image = call.subject(0);
        const out = call.string("out")!;
        const sectors = call.rest(1).map(sectorOf);
        const unreferenced = call.flag("unreferenced");
        if (sectors.length === 0 && !unreferenced) throw new Refusal("invalid-input", "sectors needs a sector or --unreferenced. Give <track>/<sector>, for example 18/1, or --unreferenced.");
        if (sectors.length > MAX_DISK_SECTORS) throw new Refusal("limit-exceeded", `${sectors.length} sectors are too many. Give at most ${MAX_DISK_SECTORS} sectors.`);
        const result = await inspectDisk({ image, action: "sectors", sectors, ...(unreferenced ? { unreferenced } : {}) });
        if (result.action !== "sectors") throw new Refusal("operation-failed", "The disk inspection gave no sectors.");
        const index = result.sectors.map((at, position) => ({ track: at.track, sector: at.sector, offset: position * DISK_BLOCK_BYTES }));
        if (index.length === 0) return reply({ count: 0, sectors: [] }, { hint: "The disk has no used sectors that no file holds. The script wrote no file." });
        return { count: index.length, sectors: index, ...writeReported(out, result.data!, { what: "--out" }) };
      },
    },
    {
      name: "crt",
      summary: "Writes each CHIP packet of a cartridge as a PRG, and crt.json with the header and the packets.",
      subjects: [{ name: "<file.crt>", help: "a .crt cartridge file, relative to the project folder" }],
      options: { out: { ...OPTIONS.out, output: "folder", value: "<dir>", help: "the folder for the files, relative to the project folder", required: true } },
      run: (call) => {
        const image = call.subject(0);
        kindFor("crt", image, ["crt"]);
        const out = call.string("out")!;
        const { crt, header, chips } = cartridge(image);
        const files = crt.chips.map((chip, index) => writeReported(`${out}/${chips[index]!.file}`, Buffer.concat([Buffer.from([chip.address & 0xff, chip.address >> 8]), chip.data]), { what: "--out" }));
        files.push(writeReported(`${out}/crt.json`, `${JSON.stringify({ ...header, chips }, null, 2)}\n`, { what: "--out" }));
        return reply({ ...header, chips, files }, { hint: "All banks use the same addresses. Analyze each bank PRG in its own knowledge space: the field space of its chip gives the space." });
      },
    },
  ],
});
