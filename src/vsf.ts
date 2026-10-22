// The modules of a VICE snapshot file (.vsf), and the two changes that press
// keys in it: the keyboard matrix and a RESTORE. VICE saves a module as its
// name (16 bytes), its version (major, minor), its size with this header
// (4 bytes) and its data; every number is little-endian.

import { hasSignature, VSF_SIGNATURE } from "./media.ts";

/** The size of the header of a module: the name (16 bytes), the version (2 bytes) and the size (4 bytes). */
const MODULE_HEADER = 22;
const VSF_VERSION = "VICE Version\x1a";

export interface SnapshotModule {
  major: number;
  minor: number;
  /** The data of the module: a view into the file, so a change to it changes the file. */
  data: Buffer;
}

/** The module `name` of a snapshot file. Undefined when the file is no snapshot or has no such module. */
export function snapshotModule(file: Buffer, name: string): SnapshotModule | undefined {
  if (!hasSignature("vsf", file)) return undefined;
  // The magic, the version (2 bytes) and the machine name (16 bytes); a newer VICE adds its own version (8 bytes).
  let at = VSF_SIGNATURE.length + 2 + 16;
  if (file.subarray(at, at + VSF_VERSION.length).toString("latin1") === VSF_VERSION) at += VSF_VERSION.length + 8;
  while (at + MODULE_HEADER <= file.length) {
    const size = file.readUInt32LE(at + 18);
    if (size < MODULE_HEADER || at + size > file.length) return undefined;
    if (file.subarray(at, at + 16).toString("latin1").replace(/\0+$/, "") === name) {
      return { major: file[at + 16]!, minor: file[at + 17]!, data: file.subarray(at + MODULE_HEADER, at + size) };
    }
    at += size;
  }
  return undefined;
}

/** VICE's keyboard module: keyarr (16 rows) and rev_keyarr (8 columns), each a DWORD. */
const KEYBOARD = { name: "KEYBOARD", major: 1, minor: 1, size: (16 + 8) * 4 };

/**
 * The CPU module of x64sc. VICE r46088 renamed MAINCPU 1.4 to MAINC64CPU 1.5;
 * the data is the same: the clock (8 bytes), A, X, Y, SP, PC (2), P, five
 * DWORDs, five clocks (irq_clk, nmi_clk, ...), then nirq, nnmi and
 * global_pending_int, then two clocks.
 */
const CPU = [
  { name: "MAINC64CPU", major: 1, minor: 5 },
  { name: "MAINCPU", major: 1, minor: 4 },
];
const CPU_SIZE = 103;
const NMI_CLK = 43;
const NNMI = 79;
const PENDING = 83;
/** IK_NMI of global_pending_int. */
const PENDING_NMI = 1;

/** A module of a version that the patch knows, or why there is none. */
function known(file: Buffer, versions: Array<{ name: string; major: number; minor: number }>, size: number): Buffer | string {
  for (const version of versions) {
    const module = snapshotModule(file, version.name);
    if (module === undefined) continue;
    if (module.major !== version.major || module.minor !== version.minor || module.data.length < size) {
      return `the snapshot has ${version.name} ${module.major}.${module.minor} with ${module.data.length} bytes, and c64-re-tools knows ${version.major}.${version.minor} with ${size}`;
    }
    return module.data;
  }
  return `the snapshot has no module ${versions.map((version) => version.name).join(" or ")}`;
}

/**
 * Sets the keyboard matrix of a snapshot file: bit n of rows[r] is the key at
 * row r, column n. Gives why it cannot, for a snapshot of another layout.
 */
export function setSnapshotMatrix(file: Buffer, rows: readonly number[]): string | undefined {
  const data = known(file, [KEYBOARD], KEYBOARD.size);
  if (typeof data === "string") return data;
  for (let row = 0; row < 16; row++) data.writeUInt32LE(rows[row] ?? 0, row * 4);
  for (let column = 0; column < 8; column++) {
    let lines = 0;
    for (let row = 0; row < 8; row++) if (((rows[row] ?? 0) >> column) & 1) lines |= 1 << row;
    data.writeUInt32LE(lines, 64 + column * 4);
  }
  return undefined;
}

/**
 * Presses RESTORE in a snapshot file, as VICE does: an NMI from now on, unless
 * another source holds the NMI line or an NMI is pending already, which gives
 * no new edge. Gives why it cannot, for a snapshot of another layout.
 */
export function pressSnapshotRestore(file: Buffer): string | undefined {
  const data = known(file, CPU, CPU_SIZE);
  if (typeof data === "string") return data;
  const pending = data.readUInt32LE(PENDING);
  if (data.readUInt32LE(NNMI) !== 0 || (pending & PENDING_NMI) !== 0) return undefined;
  data.writeUInt32LE(pending | PENDING_NMI, PENDING);
  data.writeBigUInt64LE(data.readBigUInt64LE(0), NMI_CLK);
  return undefined;
}
