// The c1541 adapter (16 §12). c1541 does all image access: it recognises the
// image, reports free blocks and the BAM, follows sector chains and writes raw
// blocks. File names never go to c1541: its name arguments and its directory
// listing change letter case, so the adapter reads the raw header and
// directory blocks and matches names by their exact PETSCII bytes.
//
// c1541 exits 0 after most errors, so success is decided from its output and
// from the output files it was asked to write.

import { existsSync, readFileSync } from "node:fs";

import { petsciiNameToText, textToPetsciiName } from "../../c64.ts";
import {
  CBM_FILE_TYPES,
  WireFailure,
  type C1541Params,
  type C1541Result,
  type CbmFileType,
  type DiskFile,
  type DiskSector,
} from "../../protocol.ts";
import { Workspace } from "../../native/staging.ts";
import { C1541, findTool } from "../../native/discover.ts";
import { requireMinimumVersion } from "./version.ts";
import { runToolOrFail, type ToolContext } from "../../native/run.ts";

const TIMEOUT_MS = 30_000;
const BLOCK_BYTES = 256;

/** Where a drive format keeps its header block and the header's fields. */
interface Layout {
  header: DiskSector;
  name: number;
  id: number;
  dos: number;
}

const LAYOUTS: Record<string, Layout> = {
  "1541": { header: { track: 18, sector: 0 }, name: 0x90, id: 0xa2, dos: 0xa5 },
  "1571": { header: { track: 18, sector: 0 }, name: 0x90, id: 0xa2, dos: 0xa5 },
  "1581": { header: { track: 40, sector: 0 }, name: 0x04, id: 0x16, dos: 0x19 },
};

export interface DiskEntry extends DiskFile {
  /** The name's PETSCII bytes, up to the first shifted space ($a0). */
  nameBytes: Uint8Array;
  startTrack: number;
  startSector: number;
}

const damaged = (message: string) => new WireFailure("media-error", `The disk image is damaged: ${message}`);

/** The drive format and track count from c1541's info command. */
export function parseInfo(output: string): { format: string; tracks: number } {
  const format = /^disk format\s*:\s*(\S+)/m.exec(output);
  const tracks = /^track count\s*:\s*(\d+)/m.exec(output);
  if (format === null || tracks === null) {
    throw new WireFailure("media-error", "c1541 does not recognise the disk image. Check that the file is a complete disk image of the given type.");
  }
  return { format: format[1]!, tracks: Number(tracks[1]) };
}

export function parseFreeBlocks(output: string): number {
  const match = /^(\d+) blocks free\.$/m.exec(output);
  if (match === null) throw new WireFailure("operation-failed", "c1541 did not report the free blocks of the disk.");
  return Number(match[1]);
}

/** A sector chain as c1541's chain command prints it: "(17, 1) -> (17,11) -> 207". */
export function parseChain(output: string, start: DiskSector): DiskSector[] {
  const where = `the sector chain from track ${start.track} sector ${start.sector}`;
  if (/cyclic reference found/.test(output)) throw damaged(`${where} loops.`);
  const line = /^\(\s*\d+,\s*\d+\).*$/m.exec(output)?.[0];
  if (line === undefined) throw damaged(`${where} cannot be read.`);
  const parts = line.split(" -> ");
  const end = parts.pop()!;
  if (!/^\d+$/.test(end.trim())) throw damaged(`${where} leaves the disk.`);
  return parts.map((part) => {
    const match = /^\(\s*(\d+),\s*(\d+)\)$/.exec(part.trim());
    if (match === null) throw new WireFailure("operation-failed", "c1541 printed a sector chain in an unknown form.");
    return { track: Number(match[1]), sector: Number(match[2]) };
  });
}

/** The BAM grid c1541 prints: one row per track, "*" for a used sector, "." for a free one. */
export function parseBam(output: string, tracks: number): Array<{ track: number; freeSectors: number[]; usedSectors: number[] }> {
  const rows: Array<{ track: number; freeSectors: number[]; usedSectors: number[] }> = [];
  for (const line of output.split(/\r?\n/)) {
    const match = /^\s*(\d+)\s+([.*]{1,8}(?: [.*]{1,8})*)\s*$/.exec(line);
    if (match === null) continue;
    const row = { track: Number(match[1]), freeSectors: [] as number[], usedSectors: [] as number[] };
    [...match[2]!.replace(/ /g, "")].forEach((mark, sector) => (mark === "*" ? row.usedSectors : row.freeSectors).push(sector));
    rows.push(row);
  }
  const complete = rows.length === tracks && rows.every((row, index) => row.track === index + 1);
  if (!complete) throw new WireFailure("operation-failed", `c1541 printed a BAM that does not cover the ${tracks} tracks of the disk.`);
  return rows;
}

/** The bytes of a name field up to the first shifted space ($a0). */
function nameField(block: Buffer, offset: number, length: number): Uint8Array {
  const field = block.subarray(offset, offset + length);
  const end = field.indexOf(0xa0);
  return Uint8Array.from(end < 0 ? field : field.subarray(0, end));
}

function fileType(typeByte: number): CbmFileType {
  return CBM_FILE_TYPES[typeByte & 0x07] ?? "unknown";
}

/** The disk header and the directory entries, from the raw header block and the directory blocks after it. */
export function parseDirectory(blocks: Buffer[], layout: Layout): { diskName: string; diskId: string; dosType: string; entries: DiskEntry[] } {
  const [header, ...directory] = blocks;
  const entries: DiskEntry[] = [];
  for (const block of directory) {
    for (let offset = 0; offset < BLOCK_BYTES; offset += 32) {
      const typeByte = block[offset + 2]!;
      // Type 0 is an empty or scratched slot; the DOS lists no file there.
      if (typeByte === 0) continue;
      const nameBytes = nameField(block, offset + 5, 16);
      entries.push({
        name: petsciiNameToText(nameBytes),
        nameBytes,
        type: fileType(typeByte),
        blocks: block.readUInt16LE(offset + 30),
        closed: (typeByte & 0x80) !== 0,
        locked: (typeByte & 0x40) !== 0,
        startTrack: block[offset + 3]!,
        startSector: block[offset + 4]!,
      });
    }
  }
  return {
    diskName: petsciiNameToText(nameField(header!, layout.name, 16)),
    diskId: petsciiNameToText(header!.subarray(layout.id, layout.id + 2)),
    dosType: petsciiNameToText(header!.subarray(layout.dos, layout.dos + 2)),
    entries,
  };
}

/** A file's data from its blocks in chain order: 254 bytes per block, the last block up to its end index. */
export function fileData(blocks: Buffer[], chain: DiskSector[]): Buffer {
  const parts: Buffer[] = [];
  blocks.forEach((block, index) => {
    const next = chain[index + 1];
    if (next === undefined) {
      if (block[0] !== 0) throw new WireFailure("operation-failed", "c1541 returned a last file block that links further.");
      parts.push(block.subarray(2, Math.max(2, block[1]! + 1)));
    } else {
      if (block[0] !== next.track || block[1] !== next.sector) throw new WireFailure("operation-failed", "c1541 returned file blocks that do not match the sector chain.");
      parts.push(block.subarray(2));
    }
  });
  return Buffer.concat(parts);
}

const toFile = (entry: DiskEntry): DiskFile => ({ name: entry.name, type: entry.type, blocks: entry.blocks, closed: entry.closed, locked: entry.locked });

const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((byte, index) => byte === b[index]);

/** Runs c1541 commands on the staged image and returns all its output. */
class C1541Session {
  readonly #executable: string;
  readonly #workspace: Workspace;
  readonly #image: string;
  readonly #context: ToolContext;
  #reads = 0;

  constructor(executable: string, workspace: Workspace, image: string, context: ToolContext) {
    this.#executable = executable;
    this.#workspace = workspace;
    this.#image = image;
    this.#context = context;
  }

  async run(commands: string[]): Promise<string> {
    const run = await runToolOrFail(
      "c1541",
      "The disk inspection",
      {
        argv: [this.#executable, "-attach", this.#image, ...commands],
        cwd: this.#workspace.root,
        timeoutMs: TIMEOUT_MS,
        truncated: "c1541 printed more output than the host accepts.",
      },
      this.#context,
    );
    return `${run.stdout}\n${run.stderr}`;
  }

  async chain(start: DiskSector): Promise<DiskSector[]> {
    return parseChain(await this.run(["-chain", String(start.track), String(start.sector)]), start);
  }

  /** Raw blocks, in the given order, through c1541's block read. */
  async blocks(sectors: DiskSector[]): Promise<Buffer[]> {
    if (sectors.length === 0) return [];
    const directory = `blocks-${this.#reads++}`;
    this.#workspace.directory(directory);
    const files = sectors.map((_, index) => `${directory}/${index}.bin`);
    const output = await this.run(sectors.flatMap((at, index) => ["-bread", files[index]!, String(at.track), String(at.sector)]));
    return files.map((file, index) => {
      const path = this.#workspace.path(file);
      const block = existsSync(path) ? readFileSync(path) : undefined;
      if (block?.length === BLOCK_BYTES) return block;
      const at = sectors[index]!;
      if (/cannot read track|out of bounds/.test(output)) throw damaged(`track ${at.track} sector ${at.sector} cannot be read.`);
      throw new WireFailure("operation-failed", `c1541 did not write track ${at.track} sector ${at.sector}.`);
    });
  }
}

export async function inspect(params: C1541Params, image: Buffer, context: ToolContext): Promise<{ result: C1541Result; attachments?: Buffer[] }> {
  const executable = findTool(C1541, context.env);
  await requireMinimumVersion(C1541, executable, context);
  const workspace = Workspace.create(context.supervisor);
  try {
    const file = `image.${params.imageType}`;
    workspace.materialize("input", [{ path: file, size: image.length }], [image]);
    const c1541 = new C1541Session(executable, workspace, `input/${file}`, context);
    const overview = await c1541.run(["-info", "-dir"]);
    const info = parseInfo(overview);
    const layout = LAYOUTS[info.format];
    if (layout === undefined) throw new WireFailure("media-error", `The disk image has the drive format ${info.format}; only 1541, 1571 and 1581 disks are supported.`);

    if (params.action === "bam") {
      return { result: { action: "bam", tracks: parseBam(await c1541.run(["-bam"]), info.tracks) } };
    }
    const headerChain = await c1541.chain(layout.header);
    const directory = parseDirectory(await c1541.blocks(headerChain), layout);
    if (params.action === "directory") {
      const { diskName, diskId, dosType, entries } = directory;
      return { result: { action: "directory", diskName, diskId, dosType, freeBlocks: parseFreeBlocks(overview), entries: entries.map(toFile) } };
    }

    const wanted = textToPetsciiName(params.name!);
    const entry = directory.entries.find((candidate) => sameBytes(candidate.nameBytes, wanted));
    if (entry === undefined) return { result: { action: params.action, found: false } };
    if (params.action === "entry") {
      return { result: { action: "entry", found: true, entry: { ...toFile(entry), startTrack: entry.startTrack, startSector: entry.startSector } } };
    }
    // A file without blocks (a DEL entry, for example) has no chain.
    const start = { track: entry.startTrack, sector: entry.startSector };
    const chain = start.track === 0 ? [] : await c1541.chain(start);
    if (params.action === "chain") return { result: { action: "chain", found: true, sectors: chain } };
    const data = fileData(await c1541.blocks(chain), chain);
    return { result: { action: "read", found: true, name: entry.name, bytes: data.length }, attachments: [data] };
  } finally {
    workspace.remove();
  }
}
