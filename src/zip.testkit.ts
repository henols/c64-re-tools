// Reads a zip archive of zipFiles back: the entries of the central directory
// with their bytes, inflated and checked against their CRC-32.

import { crc32, inflateRawSync } from "node:zlib";

export interface ReadEntry {
  path: string;
  method: number;
  bytes: Buffer;
}

export function readZip(archive: Buffer): ReadEntry[] {
  const end = archive.length - 22;
  if (archive.readUInt32LE(end) !== 0x06054b50) throw new Error("no end of central directory record");
  const count = archive.readUInt16LE(end + 10);
  let at = archive.readUInt32LE(end + 16);
  const entries: ReadEntry[] = [];
  for (let index = 0; index < count; index++) {
    if (archive.readUInt32LE(at) !== 0x02014b50) throw new Error(`no central directory entry at ${at}`);
    const method = archive.readUInt16LE(at + 10);
    const crc = archive.readUInt32LE(at + 16);
    const size = archive.readUInt32LE(at + 20);
    const nameLength = archive.readUInt16LE(at + 28);
    const offset = archive.readUInt32LE(at + 42);
    const path = archive.toString("utf8", at + 46, at + 46 + nameLength);
    const localName = archive.readUInt16LE(offset + 26);
    const localExtra = archive.readUInt16LE(offset + 28);
    const data = archive.subarray(offset + 30 + localName + localExtra, offset + 30 + localName + localExtra + size);
    const bytes = method === 8 ? inflateRawSync(data) : Buffer.from(data);
    if (crc32(bytes) !== crc) throw new Error(`${path}: the CRC-32 does not match`);
    entries.push({ path, method, bytes });
    at += 46 + nameLength;
  }
  return entries;
}
