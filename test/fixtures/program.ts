// Puts a program and coverage into the knowledge of a test project (D83), as
// knowledge.ts image and coverage do, without a script run.

import { prgRange } from "../../src/c64.ts";
import { withWrite } from "../../src/knowledge/database.ts";
import { addCoverage, setImage, type ImageRequest } from "../../src/knowledge/program.ts";

/** A PRG as the program of a space; the write is one revision. */
export function importPrg(root: string, prg: Uint8Array, space = "c64"): void {
  const { start, end, body } = prgRange(prg);
  withWrite((db) => setImage(db, { origin: "user" }, { space, segments: [{ start, end }], byteAt: (address) => body[address - start]! }), root);
}

/** An image of a capture as the program: its segments in a 64 KiB memory, and its entry, state and stages when it has them. */
export function importImage(root: string, memory: Uint8Array, request: Omit<ImageRequest, "byteAt">): void {
  withWrite((db) => setImage(db, { origin: "user" }, { ...request, byteAt: (address) => memory[address]! }), root);
}

/** Coverage maps of 64 KiB, each named as its evidence. */
export function importCoverage(root: string, maps: Record<string, Uint8Array>): void {
  withWrite((db) => addCoverage(db, { origin: "user" }, { maps: Object.entries(maps).map(([name, bytes]) => ({ name, bytes })) }), root);
}
