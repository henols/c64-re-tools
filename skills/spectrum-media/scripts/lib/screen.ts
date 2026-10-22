// The snapshots and screens of the project that the commands read.

import { Refusal } from "#src/errors.ts";
import { readProjectFile } from "#src/host-client/transfer.ts";
import { UsageError } from "#src/script.ts";
import { readSna, readZ80, type SpectrumSnapshot } from "#src/spectrum.ts";

/** The bytes of a screen: the bitmap and the attributes. */
const SCREEN_BYTES = 6912;

/** Reads a .z80 or .sna snapshot of the project. `what` names the argument in a refusal. */
export function snapshotOf(path: string, what: string): SpectrumSnapshot {
  const file = readProjectFile(path, { what });
  if (file.type === "z80") return readZ80(file.bytes);
  if (file.type === "sna") return readSna(file.bytes);
  throw new Refusal("invalid-input", `${path} is no snapshot: give a .z80 or a .sna file.`);
}

/**
 * The screen of a file and its border colour: the screen bank of a snapshot
 * with the border of the snapshot, or a .scr file with `border` (default 7).
 * A snapshot takes no border of the call.
 */
export function screenOf(path: string, border: number | undefined): { screen: Uint8Array; border: number } {
  const file = readProjectFile(path, { what: "<file>" });
  if (file.type === "z80" || file.type === "sna") {
    if (border !== undefined) throw new UsageError("--border works only with a .scr file: a snapshot gives its own border. Remove --border");
    const snapshot = snapshotOf(path, "<file>");
    return { screen: snapshot.banks[snapshot.port7ffd & 0x08 ? 7 : 5]!.subarray(0, SCREEN_BYTES), border: snapshot.border };
  }
  if (file.bytes.length !== SCREEN_BYTES) throw new Refusal("invalid-input", `${path} has ${file.bytes.length} bytes: a .scr screen has ${SCREEN_BYTES} (the bitmap and the attributes).`);
  return { screen: file.bytes, border: border ?? 7 };
}
