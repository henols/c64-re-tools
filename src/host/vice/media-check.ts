// The first check of a media file before VICE gets it. VICE takes a file that
// is not of its type in another way: a CRT or T64 that it cannot read loads
// as a PRG, and the autostart reports success.

import { WireFailure } from "../../protocol/messages.ts";

/** The signature at the start of each media type that has one. */
const SIGNATURES: Readonly<Record<string, readonly string[]>> = {
  crt: ["C64 CARTRIDGE   "],
  t64: ["C64"],
  tap: ["C64-TAPE-RAW"],
  g64: ["GCR-1541"],
  p00: ["C64File"],
};

/** The file sizes that VICE reads for each disk image type without a signature. */
const SIZES: Readonly<Record<string, readonly number[]>> = {
  d64: [174848, 175531, 196608, 197376, 205312, 206114],
  d71: [349696, 351062],
  d81: [819200, 822400],
};

/** The x64 header: 64 bytes that start with these four, then a d64 image. */
const X64_MAGIC = Buffer.from([0x43, 0x15, 0x41, 0x64]);

/** Refuses a file whose bytes are not of `type` (its extension), with media-error. */
export function checkMedia(type: string, bytes: Buffer): void {
  const refuse = (why: string) => {
    throw new WireFailure("media-error", `The file is not a valid .${type} file: ${why}. Give a file of that type.`);
  };
  const signatures = SIGNATURES[type];
  if (signatures !== undefined && !signatures.some((signature) => bytes.toString("latin1", 0, signature.length) === signature)) {
    refuse(`it does not start with ${signatures.map((signature) => `"${signature.trimEnd()}"`).join(" or ")}`);
  }
  const sizes = SIZES[type];
  if (sizes !== undefined && !sizes.includes(bytes.length)) refuse(`it has ${bytes.length} bytes, and a .${type} image has ${sizes.join(", ")}`);
  if (type === "x64" && (!bytes.subarray(0, 4).equals(X64_MAGIC) || !SIZES.d64!.includes(bytes.length - 64))) refuse("it has no x64 header before a d64 image");
}
