// Cartridge and tape containers that c64-disk reads locally: no host
// tool reads them. A CRT file holds CHIP packets, each a bank of ROM at a
// load address; a T64 file holds a directory of PRG files. TAP files hold
// raw pulses and go through the emulator only.

import { formatC64Address, petsciiNameToText } from "#src/c64.ts";
import { Refusal } from "#src/errors.ts";

/** The CRT hardware types this toolkit reads, by type number. */
export const CRT_TYPES: Record<number, string> = { 0: "normal", 5: "Ocean", 19: "Magic Desk", 32: "EasyFlash" };

export interface CrtChip {
  bank: number;
  address: number;
  size: number;
  /** 0 ROM, 1 RAM, 2 flash. */
  chipType: number;
  data: Uint8Array;
}

export interface Crt {
  name: string;
  type: number;
  typeName: string;
  /** The EXROM and GAME lines at start: 0 is active. */
  exrom: number;
  game: number;
  /** For type 0: 8K, 16K or Ultimax by the EXROM and GAME lines. */
  mode?: "8k" | "16k" | "ultimax";
  chips: CrtChip[];
}

const SIGNATURE = "C64 CARTRIDGE   ";

export function parseCrt(bytes: Uint8Array): Crt {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (buffer.length < 0x40 || buffer.toString("latin1", 0, 16) !== SIGNATURE) throw new Refusal("invalid-input", "the file is not a CRT: it does not start with C64 CARTRIDGE");
  const headerLength = buffer.readUInt32BE(0x10);
  const type = buffer.readUInt16BE(0x16);
  const exrom = buffer[0x18]!;
  const game = buffer[0x19]!;
  const typeName = CRT_TYPES[type];
  if (typeName === undefined) {
    throw new Refusal("invalid-input", `the CRT has hardware type ${type}; this toolkit reads types ${Object.entries(CRT_TYPES).map(([number, name]) => `${number} (${name})`).join(", ")}`);
  }
  const name = buffer.toString("latin1", 0x20, 0x40).replace(/\0+$/, "");
  const chips: CrtChip[] = [];
  let offset = Math.max(headerLength, 0x40);
  while (offset + 0x10 <= buffer.length) {
    if (buffer.toString("latin1", offset, offset + 4) !== "CHIP") throw new Refusal("invalid-input", `the CRT has no CHIP packet at offset ${offset}`);
    const packetLength = buffer.readUInt32BE(offset + 4);
    const chipType = buffer.readUInt16BE(offset + 8);
    const bank = buffer.readUInt16BE(offset + 10);
    const address = buffer.readUInt16BE(offset + 12);
    const size = buffer.readUInt16BE(offset + 14);
    if (packetLength < 0x10 || offset + packetLength > buffer.length) throw new Refusal("invalid-input", `the CHIP packet at offset ${offset} runs past the end of the file`);
    if (bank > 255) throw new Refusal("invalid-input", `the CHIP packet at offset ${offset} has bank ${bank}; banks go up to 255`);
    if (size > packetLength - 0x10 || address + size > 0x10000) throw new Refusal("invalid-input", `the CHIP packet at offset ${offset} has a wrong size ${size} at ${formatC64Address(address)}`);
    if (size > 0) chips.push({ bank, address, size, chipType, data: buffer.subarray(offset + 0x10, offset + 0x10 + size) });
    offset += packetLength;
  }
  if (chips.length === 0) throw new Refusal("invalid-input", "the CRT has no CHIP packet with data");
  const crt: Crt = { name, type, typeName, exrom, game, chips };
  if (type === 0) crt.mode = exrom === 0 && game === 1 ? "8k" : exrom === 0 && game === 0 ? "16k" : "ultimax";
  return crt;
}

export interface TapeEntry {
  name: string;
  nameBytes: number[];
  /** The C64 file type byte of the entry. */
  fileType: number;
  start: number;
  end: number;
  bytes: number;
  offset: number;
  /** True when the end address in the directory was wrong and the size comes from the file layout. */
  fixedSize?: boolean;
}

export interface Tape {
  name: string;
  entries: TapeEntry[];
}

export function parseT64(bytes: Uint8Array): Tape {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (buffer.length < 0x40 || !buffer.toString("latin1", 0, 32).startsWith("C64")) throw new Refusal("invalid-input", "the file is not a T64: it does not start with C64");
  const maxEntries = buffer.readUInt16LE(0x22);
  const name = buffer.toString("latin1", 0x28, 0x40).replace(/[\0 ]+$/, "");
  const raw: Array<Omit<TapeEntry, "bytes" | "end"> & { end: number }> = [];
  for (let index = 0; index < maxEntries; index++) {
    const at = 0x40 + index * 0x20;
    if (at + 0x20 > buffer.length) break;
    if (buffer[at] !== 1) continue;
    const nameField = [...buffer.subarray(at + 0x10, at + 0x20)];
    while (nameField.length > 0 && (nameField.at(-1) === 0x20 || nameField.at(-1) === 0xa0 || nameField.at(-1) === 0x00)) nameField.pop();
    raw.push({
      name: petsciiNameToText(Uint8Array.from(nameField)),
      nameBytes: nameField,
      fileType: buffer[at + 1]!,
      start: buffer.readUInt16LE(at + 2),
      end: buffer.readUInt16LE(at + 4),
      offset: buffer.readUInt32LE(at + 8),
    });
  }
  // Many T64 files have a wrong end address: the next file or the end of the file bounds each one.
  const offsets = [...raw.map((entry) => entry.offset), buffer.length].sort((a, b) => a - b);
  const entries = raw.map((entry): TapeEntry => {
    if (entry.offset >= buffer.length) throw new Refusal("invalid-input", `the T64 entry ${entry.name} starts past the end of the file`);
    const available = offsets.find((offset) => offset > entry.offset)! - entry.offset;
    const stated = entry.end - entry.start;
    const bytes = stated > 0 && stated <= available ? stated : Math.min(available, 0x10000 - entry.start);
    return { ...entry, end: entry.start + bytes - 1, bytes, ...(bytes === stated ? {} : { fixedSize: true }) };
  });
  return { name, entries };
}

/** The PRG of a tape entry: its start address, then its bytes. */
export function tapeFile(bytes: Uint8Array, entry: TapeEntry): Buffer {
  return Buffer.concat([Buffer.from([entry.start & 0xff, entry.start >> 8]), Buffer.from(bytes.subarray(entry.offset, entry.offset + entry.bytes))]);
}
