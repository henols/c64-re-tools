// Builds a minimal valid D64 (35 tracks, no error bytes) holding PRG files,
// so tests need no committed binary images and no c1541.

const D64_SIZE = 174_848;

function sectorsPerTrack(track: number): number {
  return track <= 17 ? 21 : track <= 24 ? 19 : track <= 30 ? 18 : 17;
}

function offsetOf(track: number, sector: number): number {
  let offset = 0;
  for (let earlier = 1; earlier < track; earlier++) offset += sectorsPerTrack(earlier) * 256;
  return offset + sector * 256;
}

/** PETSCII name padded with shifted spaces ($a0) to 16 bytes. */
function padded(name: string): Buffer {
  const field = Buffer.alloc(16, 0xa0);
  Buffer.from(name.toUpperCase(), "latin1").copy(field, 0, 0, 16);
  return field;
}

/**
 * Returns a D64 with the given PRG files (load address included in `bytes`),
 * stored from track 17 downwards and listed in one directory sector.
 */
export function buildD64(files: Array<{ name: string; bytes: Uint8Array }>, label = "FIXTURE"): Buffer {
  if (files.length > 8) throw new Error("one directory sector holds 8 files");
  const image = Buffer.alloc(D64_SIZE);
  const used = new Map<number, Set<number>>([[18, new Set([0, 1])]]);
  const directory = offsetOf(18, 1);
  let track = 17;
  let sector = 0;

  files.forEach((file, index) => {
    const chunks: Uint8Array[] = [];
    for (let at = 0; at < file.bytes.length; at += 254) chunks.push(file.bytes.subarray(at, at + 254));
    const start = { track, sector };
    chunks.forEach((chunk, chunkIndex) => {
      const offset = offsetOf(track, sector);
      if (!used.has(track)) used.set(track, new Set());
      used.get(track)!.add(sector);
      const last = chunkIndex === chunks.length - 1;
      let nextTrack = track;
      let nextSector = sector + 1;
      if (nextSector >= sectorsPerTrack(track)) {
        nextTrack = track - 1;
        nextSector = 0;
        if (nextTrack < 1) throw new Error("fixture files do not fit");
      }
      image[offset] = last ? 0 : nextTrack;
      image[offset + 1] = last ? chunk.length + 1 : nextSector;
      Buffer.from(chunk).copy(image, offset + 2);
      track = nextTrack;
      sector = nextSector;
    });
    const entry = directory + index * 32;
    if (index === 0) {
      image[entry] = 0; // no next directory sector
      image[entry + 1] = 0xff;
    }
    image[entry + 2] = 0x82; // closed PRG
    image[entry + 3] = start.track;
    image[entry + 4] = start.sector;
    padded(file.name).copy(image, entry + 5);
    image.writeUInt16LE(chunks.length, entry + 0x1e);
  });

  const bam = offsetOf(18, 0);
  image[bam] = 18;
  image[bam + 1] = 1;
  image[bam + 2] = 0x41; // DOS version "A"
  for (let t = 1; t <= 35; t++) {
    const taken = used.get(t) ?? new Set<number>();
    let bits = 0;
    for (let s = 0; s < sectorsPerTrack(t); s++) if (!taken.has(s)) bits |= 1 << s;
    const entry = bam + 4 * t;
    image[entry] = sectorsPerTrack(t) - taken.size;
    image[entry + 1] = bits & 0xff;
    image[entry + 2] = (bits >> 8) & 0xff;
    image[entry + 3] = (bits >> 16) & 0xff;
  }
  padded(label).copy(image, bam + 0x90);
  Buffer.from([0xa0, 0xa0, 0x30, 0x31, 0xa0, 0x32, 0x41, 0xa0, 0xa0, 0xa0, 0xa0]).copy(image, bam + 0xa0);
  return image;
}
