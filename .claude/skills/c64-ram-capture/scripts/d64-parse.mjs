#!/usr/bin/env node
// Direct byte-level .d64 parser -- the permanent, sanctioned replacement for
// the forbidden vice_disk_list tool (T-01-03). Never calls any vice_* tool
// or touches the emulator at all: this is pure Node over the disk-image
// bytes, which is why it works whether or not VICE happens to be up.
//
// Standard 35-track 1541 layout: BAM at track 18 sector 0, directory chain
// from track 18 sector 1, four sector-count zones (21/19/18/17 sectors per
// track). Plain 174848-byte, 35-track, no-error-info images are assumed
// are plain 174848-byte, 35-track, no-error-info images -- no extended
// (40-track) or error-byte variants to handle.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const die = (m) => { console.error(`error: ${m}`); process.exit(1); };

export function readImage(path) {
  return readFileSync(path);
}

/** The four sector-count zones of a standard 35-track 1541 image. */
export function sectorsPerTrack(track) {
  if (!Number.isInteger(track) || track < 1 || track > 35) {
    throw new Error(`sectorsPerTrack: track ${track} out of range 1-35`);
  }
  if (track <= 17) return 21;
  if (track <= 24) return 19;
  if (track <= 30) return 18;
  return 17;
}

/** Byte offset of the start of {track, sector} in a flat 35-track image. */
export function tsToOffset(track, sector) {
  if (!Number.isInteger(track) || track < 1 || track > 35) {
    throw new Error(`tsToOffset: track ${track} out of range 1-35`);
  }
  const spt = sectorsPerTrack(track);
  if (!Number.isInteger(sector) || sector < 0 || sector >= spt) {
    throw new Error(`tsToOffset: sector ${sector} out of range for track ${track} (0-${spt - 1}, this track has ${spt} sectors)`);
  }
  let offset = 0;
  for (let t = 1; t < track; t++) offset += sectorsPerTrack(t) * 256;
  return offset + sector * 256;
}

function isInImage(track, sector) {
  if (!Number.isInteger(track) || track < 1 || track > 35) return false;
  if (!Number.isInteger(sector) || sector < 0) return false;
  return sector < sectorsPerTrack(track);
}

/**
 * Directory/disk-name bytes are PETSCII, padded with $A0. Every byte this
 * project's two disks actually use in a name (A-Z, digits, space, parens)
 * sits at the same code point in PETSCII as in ASCII/Latin-1, so only the
 * $A0 padding needs stripping -- there is no general PETSCII<->ASCII table
 * here, on purpose, since one is not needed for what these disks contain.
 */
function petsciiName(bytes) {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0xa0) end--;
  return Buffer.from(bytes.subarray(0, end)).toString("latin1");
}

const FILE_TYPES = { 0: "DEL", 1: "SEQ", 2: "PRG", 3: "USR", 4: "REL" };

/** Read track 18 sector 0: disk name/id, DOS type, and per-track free counts. */
export function parseBam(buffer) {
  const off = tsToOffset(18, 0);
  const bam = buffer.subarray(off, off + 256);

  const perTrack = [];
  for (let t = 1; t <= 35; t++) {
    const eoff = 4 + (t - 1) * 4;
    perTrack.push({
      track: t,
      free: bam[eoff],
      sectors_per_track: sectorsPerTrack(t),
      bitmap: [bam[eoff + 1], bam[eoff + 2], bam[eoff + 3]],
    });
  }

  const occupiedTracks = perTrack.filter((t) => t.free < t.sectors_per_track).map((t) => t.track);
  const occupiedRanges = [];
  for (const t of occupiedTracks) {
    const last = occupiedRanges[occupiedRanges.length - 1];
    if (last && last.end === t - 1) last.end = t;
    else occupiedRanges.push({ start: t, end: t });
  }

  return {
    first_dir_track: bam[0],
    first_dir_sector: bam[1],
    dos_version: bam[2],
    disk_name: petsciiName(bam.subarray(0x90, 0x90 + 16)),
    disk_id: Buffer.from(bam.subarray(0xa2, 0xa2 + 2)).toString("latin1"),
    dos_type: Buffer.from(bam.subarray(0xa5, 0xa5 + 2)).toString("latin1"),
    per_track: perTrack,
    occupied_tracks: occupiedTracks,
    occupied_ranges: occupiedRanges,
  };
}

function isTrackFullyFree(bam, track) {
  const entry = bam.per_track.find((t) => t.track === track);
  return !!entry && entry.free === entry.sectors_per_track;
}

/**
 * Walk the directory chain from track 18 sector 1 (by default). Guards
 * against a malicious or corrupt next-sector pointer with a visited set: a
 * sector, once processed, can never be re-entered, so even a
 * self-referential or cyclic pointer stops the walk (reported in
 * `chain_error`) rather than looping forever.
 *
 * Each entry is flagged `suspicious` -- with the specific reason(s) named,
 * never a bare boolean -- when its block count is 0, when its first
 * track/sector falls outside the image, or when its first track/sector
 * points into a track the BAM reports as entirely free (0 sectors
 * allocated): exactly the signature of a faked directory entry that claims
 * a file that was never actually written to disk.
 */
export function parseDirectory(buffer, { startTrack = 18, startSector = 1 } = {}) {
  const bam = parseBam(buffer);
  const entries = [];
  const visited = new Set();
  let track = startTrack;
  let sector = startSector;
  let chainError = null;

  for (;;) {
    const key = `${track}/${sector}`;
    if (visited.has(key)) {
      chainError = `directory chain revisited ${key} -- stopped to avoid an infinite loop (self-referential or cyclic next-sector pointer)`;
      break;
    }
    visited.add(key);
    if (!isInImage(track, sector)) {
      chainError = `directory chain pointer ${key} is outside the image -- stopped`;
      break;
    }

    const off = tsToOffset(track, sector);
    const sec = buffer.subarray(off, off + 256);
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

      const reasons = [];
      if (blocks === 0) reasons.push("block count is 0");
      if (!isInImage(firstTrack, firstSector)) {
        reasons.push(`first track/sector ${firstTrack}/${firstSector} is outside the image`);
      } else if (isTrackFullyFree(bam, firstTrack)) {
        reasons.push(`first track ${firstTrack} is reported entirely free by the BAM (0 sectors allocated) -- the file cannot really start there`);
      }

      entries.push({
        dir_track: track,
        dir_sector: sector,
        entry_index: i,
        type: FILE_TYPES[typeByte & 0x0f] ?? `unknown(0x${(typeByte & 0x0f).toString(16)})`,
        closed: !!(typeByte & 0x80),
        locked: !!(typeByte & 0x40),
        name: petsciiName(nameBytes),
        first_track: firstTrack,
        first_sector: firstSector,
        blocks,
        suspicious: reasons.length > 0,
        suspicious_reasons: reasons,
      });
    }

    if (nextTrack === 0) break; // end of chain, by DOS convention
    track = nextTrack;
    sector = nextSector;
  }

  return { entries, chain_error: chainError };
}

// -------------------------------------------------------------------- CLI

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const opt = (name, fallback) => {
    const i = rest.indexOf(`--${name}`);
    return i === -1 ? fallback : rest[i + 1];
  };
  const jsonFlag = rest.includes("--json");

  function run() {
    if (cmd !== "directory" && cmd !== "bam") {
      console.log(`usage: node ${fileURLToPath(import.meta.url)} <directory|bam> --image <path.d64> [--json]`);
      process.exitCode = cmd ? 1 : 0;
      return;
    }
    const imagePath = opt("image");
    if (!imagePath) die(`usage: ${cmd} --image <path.d64> [--json]`);
    const buffer = readImage(resolve(imagePath));

    if (cmd === "directory") {
      const result = parseDirectory(buffer);
      if (jsonFlag) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        for (const e of result.entries) {
          const flag = e.suspicious ? ` SUSPICIOUS: ${e.suspicious_reasons.join("; ")}` : "";
          console.log(`${e.type} "${e.name}" first=${e.first_track}/${e.first_sector} blocks=${e.blocks}${flag}`);
        }
        if (result.chain_error) console.log(`chain error: ${result.chain_error}`);
      }
      return;
    }

    const bam = parseBam(buffer);
    if (jsonFlag) {
      console.log(JSON.stringify(bam, null, 2));
    } else {
      console.log(`disk name: "${bam.disk_name}"  id: ${bam.disk_id}  dos type: ${bam.dos_type}`);
      console.log(`first dir sector: ${bam.first_dir_track}/${bam.first_dir_sector}`);
      console.log(
        `occupied track ranges: ${bam.occupied_ranges.map((r) => (r.start === r.end ? `${r.start}` : `${r.start}-${r.end}`)).join(", ")}`
      );
    }
  }

  run();
}
