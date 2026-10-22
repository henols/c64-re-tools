// The blocks of a ZEsarUX snapshot file (.zsf) that a session reads: after
// the 26-byte magic, each block is an id (2 bytes), a length (4 bytes) and
// the data, little-endian. Block 43 holds the HALT state (1 while the CPU
// waits in a HALT; ZEsarUX keeps the PC after the HALT instruction then).
//
// ZEsarUX 13.0 writes only "IM 2 or not" into the register block (block 2):
// it loads IM 1 as IM 0. On the Spectrum both take RST $38, but the
// registers and an exported file then give the wrong mode, so a session
// keeps the mode beside its .zsf.

const MAGIC = "ZSF ZEsarUX Snapshot File.";
const HALT = 43;

interface Block {
  id: number;
  /** The offset of the block data in the file. */
  at: number;
  length: number;
}

/** True when the bytes start as a ZEsarUX snapshot file does. */
export function isZsf(file: Uint8Array): boolean {
  return Buffer.from(file.subarray(0, MAGIC.length)).toString("latin1") === MAGIC;
}

function blocks(file: Uint8Array): Block[] {
  if (!isZsf(file)) throw new Error("not a ZEsarUX snapshot file");
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const found: Block[] = [];
  for (let at = MAGIC.length; at + 6 <= file.length; ) {
    const id = view.getUint16(at, true);
    const length = view.getUint32(at + 2, true);
    found.push({ id, at: at + 6, length });
    at += 6 + length;
  }
  return found;
}

/** True when the snapshot was saved while the CPU waited in a HALT. */
export function zsfHalted(file: Uint8Array): boolean {
  const block = blocks(file).find((item) => item.id === HALT);
  return block !== undefined && block.length >= 1 && file[block.at] !== 0;
}
