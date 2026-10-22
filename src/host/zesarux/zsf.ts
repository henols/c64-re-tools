// The blocks of a ZEsarUX snapshot file (.zsf) that a session reads and
// patches: after the 26-byte magic, each block is an id (2 bytes), a length
// (4 bytes) and the data, little-endian. Block 2 holds the Z80 registers,
// block 43 the HALT state (1 while the CPU waits in a HALT; ZEsarUX keeps the
// PC after the HALT instruction then).
//
// ZEsarUX 13.0 writes only "IM 2 or not" into the register block: it loads
// IM 1 as IM 0. On the Spectrum both take RST $38, but the registers and an
// exported file then give the wrong mode, so a session sets the mode again
// after a load.

const MAGIC = "ZSF ZEsarUX Snapshot File.";
const REGISTERS = 2;
const HALT = 43;
/** The PC in the register block: BC DE HL, F A, IX IY, the other set, R, I, SP, then PC. */
const PC_OFFSET = 24;

interface Block {
  id: number;
  /** The offset of the block data in the file. */
  at: number;
  length: number;
}

function blocks(file: Uint8Array): Block[] {
  if (Buffer.from(file.subarray(0, MAGIC.length)).toString("latin1") !== MAGIC) throw new Error("not a ZEsarUX snapshot file");
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

/**
 * A copy of a snapshot of a halted CPU that is not halted, with the PC on the
 * HALT instruction: a step of that instruction makes the state of the file
 * again. The file is unchanged when the CPU was not halted.
 */
export function zsfOnHaltInstruction(file: Uint8Array): Uint8Array {
  const copy = Uint8Array.from(file);
  if (!zsfHalted(file)) return copy;
  const all = blocks(copy);
  const halt = all.find((item) => item.id === HALT)!;
  const registers = all.find((item) => item.id === REGISTERS);
  if (registers === undefined || registers.length < PC_OFFSET + 2) throw new Error("the snapshot file has no Z80 registers");
  copy[halt.at] = 0;
  const view = new DataView(copy.buffer);
  view.setUint16(registers.at + PC_OFFSET, (view.getUint16(registers.at + PC_OFFSET, true) - 1) & 0xffff, true);
  return copy;
}
