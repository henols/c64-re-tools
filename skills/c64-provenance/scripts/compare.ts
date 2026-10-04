// Byte comparison of releases for the c64-provenance script. Each release is
// placed at its load address plus an optional shift; the comparison reports
// where the releases differ and which releases agree there. It never decides
// which bytes are original: that needs evidence beyond one comparison.

export interface Release {
  name: string;
  /** Address of the first byte after the shift. */
  start: number;
  bytes: Uint8Array;
}

export interface DifferingRange {
  start: number;
  end: number;
  /** The bytes of each release in this range, by release name. */
  values: Record<string, number[]>;
  /** Releases with the same bytes here, largest group first. */
  groups: string[][];
}

export interface Comparison {
  /** The addresses that every release covers. */
  common: { start: number; end: number } | null;
  identicalBytes: number;
  differingBytes: number;
  differences: DifferingRange[];
  /** True when more differing ranges exist than the limit allowed. */
  moreDifferences: boolean;
}

/** Joins differing addresses that are at most this far apart into one range. */
const JOIN_GAP = 4;

export function compareReleases(releases: Release[], options: { from?: number; to?: number; maxRanges?: number } = {}): Comparison {
  const start = Math.max(options.from ?? 0, ...releases.map((release) => release.start));
  const end = Math.min(options.to ?? 0xffff, ...releases.map((release) => release.start + release.bytes.length - 1));
  if (start > end) return { common: null, identicalBytes: 0, differingBytes: 0, differences: [], moreDifferences: false };
  const at = (release: Release, address: number) => release.bytes[address - release.start]!;
  let identicalBytes = 0;
  const differing: number[] = [];
  for (let address = start; address <= end; address++) {
    const first = at(releases[0]!, address);
    if (releases.every((release) => at(release, address) === first)) identicalBytes++;
    else differing.push(address);
  }
  const ranges: Array<{ start: number; end: number }> = [];
  for (const address of differing) {
    const last = ranges.at(-1);
    if (last !== undefined && address - last.end <= JOIN_GAP) last.end = address;
    else ranges.push({ start: address, end: address });
  }
  const limit = options.maxRanges ?? 64;
  const differences = ranges.slice(0, limit).map((range) => {
    const values: Record<string, number[]> = {};
    const groups = new Map<string, string[]>();
    for (const release of releases) {
      const bytes = Array.from(release.bytes.subarray(range.start - release.start, range.end - release.start + 1));
      values[release.name] = bytes;
      const key = bytes.join(",");
      groups.set(key, [...(groups.get(key) ?? []), release.name]);
    }
    return { ...range, values, groups: [...groups.values()].sort((a, b) => b.length - a.length) };
  });
  return { common: { start, end }, identicalBytes, differingBytes: differing.length, differences, moreDifferences: ranges.length > limit };
}

/**
 * The shift that puts `other` over `base` best: the most common address
 * difference between equal 8-byte sequences. Undefined when nothing matches.
 */
export function suggestShift(base: Release, other: Release): { shift: number; matches: number } | undefined {
  const WINDOW = 8;
  const key = (bytes: Uint8Array, at: number) => Buffer.from(bytes.subarray(at, at + WINDOW)).toString("latin1");
  const positions = new Map<string, number[]>();
  for (let at = 0; at + WINDOW <= base.bytes.length; at++) {
    const positionsOfKey = positions.get(key(base.bytes, at));
    // Very common sequences (fill bytes) say nothing about the alignment.
    if (positionsOfKey === undefined) positions.set(key(base.bytes, at), [at]);
    else if (positionsOfKey.length < 8) positionsOfKey.push(at);
  }
  const votes = new Map<number, number>();
  for (let at = 0; at + WINDOW <= other.bytes.length; at++) {
    for (const position of positions.get(key(other.bytes, at)) ?? []) {
      const shift = base.start + position - (other.start + at);
      votes.set(shift, (votes.get(shift) ?? 0) + 1);
    }
  }
  let best: { shift: number; matches: number } | undefined;
  for (const [shift, matches] of votes) if (best === undefined || matches > best.matches) best = { shift, matches };
  return best;
}
