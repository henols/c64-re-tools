// The media of an autostart, checked before ZEsarUX loads them: ZEsarUX
// takes the form from the extension and runs any bytes, so a file that is not
// what its extension says is refused here. The check also gives what the
// session must set after the load, because the load of ZEsarUX 13.0 does not
// set it:
//
// - The border of a .z80 or .sna: ZEsarUX keeps it, but the FE port of
//   get-io-ports shows it only after an OUT to port $fe.
// - The AY of a 128K .z80: ZEsarUX turns the AY chip on, and loads its
//   registers, only when bit 2 of byte 37 is set. That bit means "AY on a
//   48K"; a 128K always has the AY. The checked copy of a 128K file has it set.

import { Refusal } from "../../errors.ts";
import { WireFailure } from "../../protocol/messages.ts";
import { readSna, readTap, readTzx, readZ80, type SpectrumSnapshot } from "../../spectrum.ts";
import { isZsf } from "./zsf.ts";

export type MediaType = "tap" | "tzx" | "z80" | "sna" | "zsf";

export interface CheckedMedia {
  /** The bytes that ZEsarUX loads. */
  bytes: Uint8Array;
  /** The border colour of a .z80 or a .sna snapshot. */
  border?: number;
}

const NAME: Record<MediaType, string> = { tap: "a TAP tape", tzx: "a TZX tape", z80: "a .z80 snapshot", sna: "a .sna snapshot", zsf: "a ZEsarUX .zsf snapshot" };
/** The size of the RAM of a version 1 .z80 (a 48K): 48 KiB after the 30-byte header. */
const Z80_V1_RAM = 0xc000;
/** Byte 37 of a version 2 or 3 .z80: bit 2 tells that the AY chip is in use. */
const Z80_FLAGS2 = 37;
const Z80_AY_IN_USE = 0x04;

/** A version 1 .z80 is a 48K: its RAM is 48 KiB, or a compressed block that ends with 00 ED ED 00. */
function checkZ80v1(bytes: Uint8Array): void {
  const flags = bytes[12] === 0xff ? 1 : bytes[12]!;
  if ((flags & 0x20) === 0) {
    if (bytes.length !== 30 + Z80_V1_RAM) throw new Refusal("invalid-input", `An uncompressed version 1 .z80 file has ${30 + Z80_V1_RAM} bytes, not ${bytes.length}.`);
    return;
  }
  const end = [...bytes.subarray(bytes.length - 4)];
  if (end.join(",") !== "0,237,237,0") throw new Refusal("invalid-input", "A compressed version 1 .z80 file ends with the bytes 00 ED ED 00.");
}

/** Checks that the bytes have the form of their type, and gives the bytes for ZEsarUX. Refuses with invalid-input. */
export function checkMedia(type: MediaType, bytes: Uint8Array): CheckedMedia {
  try {
    switch (type) {
      case "tap":
        if (readTap(bytes).length === 0) throw new Refusal("invalid-input", "The TAP file has no block.");
        return { bytes };
      case "tzx":
        if (readTzx(bytes).length === 0) throw new Refusal("invalid-input", "The TZX file has no block.");
        return { bytes };
      case "zsf":
        if (!isZsf(bytes)) throw new Refusal("invalid-input", 'A .zsf file starts with "ZSF ZEsarUX Snapshot File.".');
        return { bytes };
      case "sna":
        return { bytes, border: readSna(bytes).border };
      case "z80": {
        const snapshot: SpectrumSnapshot = readZ80(bytes);
        const version1 = (bytes[6]! | (bytes[7]! << 8)) !== 0;
        if (version1) checkZ80v1(bytes);
        if (version1 || snapshot.model !== "128k") return { bytes, border: snapshot.border };
        const copy = Uint8Array.from(bytes);
        copy[Z80_FLAGS2] = copy[Z80_FLAGS2]! | Z80_AY_IN_USE;
        return { bytes: copy, border: snapshot.border };
      }
    }
  } catch (error) {
    if (!(error instanceof Refusal)) throw error;
    throw new WireFailure("invalid-input", `The file is not ${NAME[type]}: ${error.message} Give a file whose contents agree with its extension.`);
  }
}
