// A zip archive of files given as bytes. The same files give the same bytes:
// the entries are in path order, each has the time 1980-01-01 00:00, and no
// field depends on the machine. Each file is deflated, or stored when deflate
// does not make it smaller. No ZIP64: an archive that needs it is refused.

import { crc32, deflateRawSync } from "node:zlib";

import { Refusal } from "./errors.ts";

export interface ZipEntry {
  /** The path in the archive, with / between the parts. */
  path: string;
  bytes: Uint8Array;
}

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;
/** Version 2.0: deflate. */
const VERSION = 20;
/** Bit 11: the path is UTF-8. */
const UTF8_FLAG = 0x0800;
const STORED = 0;
const DEFLATED = 8;
/** 1980-01-01 in MS-DOS date format; the time is 00:00. */
const DOS_DATE = (1 << 5) | 1;
const LIMIT = 0xffffffff;
const MAX_ENTRIES = 0xffff;

/** The archive of the entries, sorted by path. Refuses a duplicate or an unsafe path, and an archive that needs ZIP64. */
export function zipFiles(entries: readonly ZipEntry[]): Buffer {
  const sorted = [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  if (sorted.length > MAX_ENTRIES) throw new Refusal("invalid-input", `A zip archive holds at most ${MAX_ENTRIES} files without ZIP64; this one has ${sorted.length}.`);
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  sorted.forEach((entry, index) => {
    const path = entry.path;
    if (path === "" || path.startsWith("/") || path.includes("\\") || path.split("/").some((part) => part === "" || part === "." || part === "..")) {
      throw new Refusal("invalid-input", `${JSON.stringify(path)} is not a relative path with / between its parts.`);
    }
    if (index > 0 && sorted[index - 1]!.path === path) throw new Refusal("invalid-input", `The zip archive has ${path} two times.`);
    const name = Buffer.from(path, "utf8");
    const deflated = deflateRawSync(entry.bytes, { level: 9 });
    const method = deflated.length < entry.bytes.length ? DEFLATED : STORED;
    const data = method === DEFLATED ? deflated : Buffer.from(entry.bytes);
    if (entry.bytes.length > LIMIT || offset > LIMIT) throw new Refusal("invalid-input", `${path} is too large for a zip archive without ZIP64.`);
    const crc = crc32(entry.bytes);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_SIGNATURE, 0);
    local.writeUInt16LE(VERSION, 4);
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(entry.bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL_SIGNATURE, 0);
    central.writeUInt16LE(VERSION, 4);
    central.writeUInt16LE(VERSION, 6);
    central.writeUInt16LE(UTF8_FLAG, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(entry.bytes.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + data.length;
  });
  const directory = Buffer.concat(centrals);
  if (offset > LIMIT || directory.length > LIMIT) throw new Refusal("invalid-input", "The files are too large for a zip archive without ZIP64.");
  const end = Buffer.alloc(22);
  end.writeUInt32LE(END_SIGNATURE, 0);
  end.writeUInt16LE(sorted.length, 8);
  end.writeUInt16LE(sorted.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
