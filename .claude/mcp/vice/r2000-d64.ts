#!/usr/bin/env node
// Pure, offline `.d64` directory listing and named-entry byte extraction --
// the container-side half of D-02's ".d64 is a first-class bootstrap input"
// requirement.
//
// WHY THIS FILE EXISTS HERE, AND NOT AS AN EXTENSION OF
// `.claude/skills/c64-ram-capture/scripts/d64-parse.mjs`: the researcher's
// own recommendation (RESEARCH.md Open Question #2) was to extend
// `d64-parse.mjs` in place, since it already walks the directory chain. That
// is not reachable in practice: this MCP server ships as `@henols/vice-mcp`,
// whose `files[]` in `package.json` lists only `.claude/mcp/vice/` contents,
// while `.claude/skills/**` ships in the *other* package
// (`@henols/c64-re-tools`). An import from this seam into a skill script
// cannot resolve on either npm-installer route (neither copies the sibling
// package's source tree onto disk next to it), and
// `scripts/check-npm-packages.mjs`'s transitive-closure walk over `files[]`
// would fail the pack the moment a reachable module sat outside the listed
// set. So this is a SECOND, independent copy of the sector-chain-walk
// algorithm, container-side, scoped to exactly what the r2000 bootstrap
// needs -- not a shared library and not an import of the skill-side module.
//
// `d64-parse.mjs` REMAINS the skill-side owner of the algorithm and is left
// entirely untouched by this phase; this module's job is not to grow beyond
// the bootstrap's needs, and neither copy should silently drift into a
// general-purpose disk-image library. If the two ever need to diverge in
// behaviour, that is a deliberate, documented decision, not an accident of
// two files existing.
//
// WHAT NOT TO DO:
//   - Never auto-pick a directory entry when the caller does not name one
//     (D-02). A silent auto-pick would happily hand a cracktro or loader
//     stub's bytes to the analyser instead of the actual game -- precisely
//     the failure `c64-provenance-diff` exists to prevent elsewhere in this
//     project. Zero matches and multiple matches both throw here; neither
//     returns a guess.
//   - Never walk a sector chain (the directory's own, or an entry's) without
//     the visited-set cycle guard below. A corrupt or adversarial
//     next-track/next-sector pointer must be caught, not looped on.
//   - Never call the process's exit hook or any console-printing function
//     from this module. The fail-loud "no name given -> print the directory
//     listing -> exit non-zero" CLI contract belongs to the caller (plan
//     10-04's CLI seam),
//     not here -- this module is a pure, offline byte transform with no
//     process-level side effects.
//
// Inherited, documented limits (from `d64-parse.mjs`'s own header, carried
// forward unchanged): plain 174848-byte, 35-track 1541 images only. No
// error-info-byte variant (175531 bytes) and no 40-track variant are
// supported -- `assertPlainImage()` below enforces the 174848-byte length
// and throws naming the actual length otherwise.

/** The four sector-count zones of a standard 35-track 1541 image. */
export function sectorsPerTrack(track: number): number {
  if (!Number.isInteger(track) || track < 1 || track > 35) {
    throw new Error(`sectorsPerTrack: track ${track} out of range 1-35`);
  }
  if (track <= 17) return 21;
  if (track <= 24) return 19;
  if (track <= 30) return 18;
  return 17;
}

/** Byte offset of the start of {track, sector} in a flat 35-track image. */
export function tsToOffset(track: number, sector: number): number {
  if (!Number.isInteger(track) || track < 1 || track > 35) {
    throw new Error(`tsToOffset: track ${track} out of range 1-35`);
  }
  const spt = sectorsPerTrack(track);
  if (!Number.isInteger(sector) || sector < 0 || sector >= spt) {
    throw new Error(
      `tsToOffset: sector ${sector} out of range for track ${track} (0-${spt - 1}, this track has ${spt} sectors)`,
    );
  }
  let offset = 0;
  for (let t = 1; t < track; t++) offset += sectorsPerTrack(t) * 256;
  return offset + sector * 256;
}

function isInImage(track: number, sector: number): boolean {
  if (!Number.isInteger(track) || track < 1 || track > 35) return false;
  if (!Number.isInteger(sector) || sector < 0) return false;
  return sector < sectorsPerTrack(track);
}

/**
 * Directory/disk-name bytes are PETSCII, padded with $A0. As in
 * `d64-parse.mjs`, every byte this project's disks actually use in a name
 * (A-Z, digits, space, parens) sits at the same code point in PETSCII as in
 * ASCII/Latin-1, so only the $A0 padding needs stripping -- there is no
 * general PETSCII<->ASCII table here, deliberately, since one is not needed
 * for what these disks contain.
 */
function petsciiName(bytes: Uint8Array): string {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0xa0) end--;
  return Buffer.from(bytes.subarray(0, end)).toString("latin1");
}

const FILE_TYPES: Record<number, string> = { 0: "DEL", 1: "SEQ", 2: "PRG", 3: "USR", 4: "REL" };

export interface D64Entry {
  name: string;
  type: string;
  track: number;
  sector: number;
  sizeBlocks: number;
}

/**
 * Walk the directory chain from track 18 sector 1, exactly as
 * `d64-parse.mjs`'s `parseDirectory()` does, returning the flat listing the
 * caller can print. Never picks a "best" or "likely" entry -- that decision
 * belongs to the caller and to `extractEntry()`'s exact-name match below.
 */
export function listEntries(image: Uint8Array): D64Entry[] {
  const entries: D64Entry[] = [];
  const visited = new Set<string>();
  let track = 18;
  let sector = 1;

  for (;;) {
    const key = `${track}/${sector}`;
    if (visited.has(key)) {
      throw new Error(
        `listEntries: directory chain revisited ${key} -- stopped to avoid an infinite loop (self-referential or cyclic next-sector pointer)`,
      );
    }
    visited.add(key);
    if (!isInImage(track, sector)) {
      throw new Error(`listEntries: directory chain pointer ${key} is outside the image -- stopped`);
    }

    const off = tsToOffset(track, sector);
    const sec = image.subarray(off, off + 256);
    const nextTrack = sec[0];
    const nextSector = sec[1];

    for (let i = 0; i < 8; i++) {
      const e = sec.subarray(i * 32, i * 32 + 32);
      const typeByte = e[2];
      const firstTrack = e[3];
      const firstSector = e[4];
      const nameBytes = e.subarray(5, 21);
      const blocks = e[30] | (e[31] << 8);

      // An all-zero type byte with a blank/padded name is an unused slot,
      // not a file -- never listed as an entry.
      const isEmptySlot =
        typeByte === 0 && firstTrack === 0 && firstSector === 0 &&
        [...nameBytes].every((b) => b === 0xa0 || b === 0x00);
      if (isEmptySlot) continue;

      entries.push({
        name: petsciiName(nameBytes),
        type: FILE_TYPES[typeByte & 0x0f] ?? `unknown(0x${(typeByte & 0x0f).toString(16)})`,
        track: firstTrack,
        sector: firstSector,
        sizeBlocks: blocks,
      });
    }

    if (nextTrack === 0) break; // end of chain, by DOS convention
    track = nextTrack;
    sector = nextSector;
  }

  return entries;
}

/**
 * Resolve `entryName` against `listEntries(image)` by exact,
 * case-insensitive match. Zero matches and multiple matches both throw --
 * D-02's whole point is that this function never guesses. On success,
 * follows that entry's OWN sector chain (starting at its own
 * first_track/first_sector, NOT the fixed directory-chain start) and
 * concatenates each sector's 254 payload bytes, honouring the 1541 DOS
 * end-of-chain convention: when a sector's next-track byte is 0, its
 * next-sector byte instead holds the count of USED bytes in that final
 * sector (so the last sector contributes `usedByte - 1` payload bytes, not
 * 254 -- byte 1 itself is a count, and the payload runs from byte 2 up to,
 * but not including, byte `usedByte`).
 *
 * The returned bytes are the file's RAW content INCLUDING its leading 2-byte
 * PRG load address, unmodified -- that is deliberate, since the whole point
 * of this module is to hand bytes straight to `parsePrg()` in
 * `r2000-project.ts`, which expects that same 2-byte header.
 */
export function extractEntry(image: Uint8Array, entryName: string): Uint8Array {
  const entries = listEntries(image);
  const needle = entryName.toLowerCase();
  const matches = entries.filter((e) => e.name.toLowerCase() === needle);

  if (matches.length === 0) {
    const available = entries.map((e) => e.name).join(", ") || "(no entries)";
    throw new Error(
      `extractEntry: no entry named "${entryName}" found. Available entries: ${available}`,
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `extractEntry: entry name "${entryName}" is ambiguous -- ${matches.length} entries share this name (at ` +
        `${matches.map((m) => `${m.track}/${m.sector}`).join(", ")}). Refusing to pick one; rename or disambiguate on disk.`,
    );
  }

  const entry = matches[0];
  const chunks: Uint8Array[] = [];
  const visited = new Set<string>();
  let track = entry.track;
  let sector = entry.sector;

  for (;;) {
    const key = `${track}/${sector}`;
    if (visited.has(key)) {
      throw new Error(
        `extractEntry: sector chain for "${entryName}" revisited ${key} -- stopped to avoid an infinite loop (self-referential or cyclic next-sector pointer)`,
      );
    }
    visited.add(key);
    if (!isInImage(track, sector)) {
      throw new Error(`extractEntry: sector chain for "${entryName}" points to ${key}, which is outside the image`);
    }

    const off = tsToOffset(track, sector);
    const sec = image.subarray(off, off + 256);
    const nextTrack = sec[0];
    const nextSector = sec[1];

    if (nextTrack === 0) {
      // Last sector: byte 1 is the count of used bytes in this sector, not
      // a next-sector pointer. Payload runs from byte 2 up to (usedByte).
      const usedByte = nextSector;
      chunks.push(sec.subarray(2, Math.max(2, usedByte)));
      break;
    }

    chunks.push(sec.subarray(2, 256));
    track = nextTrack;
    sector = nextSector;
  }

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

/**
 * Enforce the inherited, documented limits: plain 174848-byte, 35-track
 * images only. 40-track and error-info-byte (175531-byte) variants are
 * deliberately out of scope for this phase, exactly as `d64-parse.mjs`
 * documents for the skill-side reader.
 */
export function assertPlainImage(image: Uint8Array): void {
  if (image.length !== 174848) {
    throw new Error(
      `assertPlainImage: expected a plain 174848-byte, 35-track .d64 image with no error-info bytes, got ${image.length} bytes`,
    );
  }
}
