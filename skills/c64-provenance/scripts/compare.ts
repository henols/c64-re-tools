// Byte comparison of releases for the c64-provenance script. Each release
// has bytes in one or more segments: a PRG at its load address plus an
// optional shift, or the segments of an unpacker image (D50). The comparison
// covers the addresses where every release has bytes, and reports where the
// releases differ and which releases agree there. It never decides which
// bytes are original: that needs evidence beyond one comparison.

export interface Range {
  start: number;
  end: number;
}

export interface Release {
  name: string;
  /** Where the release has bytes, after the shift, in address order. */
  segments: Range[];
  /** The byte at an address inside a segment. */
  byteAt: (address: number) => number;
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
  /** The addresses where every release has bytes. */
  common: Range[];
  identicalBytes: number;
  differingBytes: number;
  differences: DifferingRange[];
  /** True when more differing ranges exist than the limit allowed. */
  moreDifferences: boolean;
}

/** Joins differing addresses that are at most this far apart into one range. */
const JOIN_GAP = 4;

export const covers = (release: Release, address: number) => release.segments.some((segment) => address >= segment.start && address <= segment.end);

/** The ranges where every release has bytes, inside from..to. */
export function commonRanges(releases: Release[], from = 0x0000, to = 0xffff): Range[] {
  const ranges: Range[] = [];
  for (let address = from; address <= to; address++) {
    if (!releases.every((release) => covers(release, address))) continue;
    const last = ranges.at(-1);
    if (last !== undefined && last.end + 1 === address) last.end = address;
    else ranges.push({ start: address, end: address });
  }
  return ranges;
}

export function compareReleases(releases: Release[], options: { from?: number; to?: number; maxRanges?: number } = {}): Comparison {
  const common = commonRanges(releases, options.from, options.to);
  let identicalBytes = 0;
  const differing: number[] = [];
  for (const range of common) {
    for (let address = range.start; address <= range.end; address++) {
      const first = releases[0]!.byteAt(address);
      if (releases.every((release) => release.byteAt(address) === first)) identicalBytes++;
      else differing.push(address);
    }
  }
  // A joined range stays inside one common range, so every release has all of its bytes.
  const inSameCommon = (a: number, b: number) => common.some((range) => a >= range.start && b <= range.end);
  const ranges: Range[] = [];
  for (const address of differing) {
    const last = ranges.at(-1);
    if (last !== undefined && address - last.end <= JOIN_GAP && inSameCommon(last.start, address)) last.end = address;
    else ranges.push({ start: address, end: address });
  }
  const limit = options.maxRanges ?? 64;
  const differences = ranges.slice(0, limit).map((range) => {
    const values: Record<string, number[]> = {};
    const groups = new Map<string, string[]>();
    for (const release of releases) {
      const bytes = Array.from({ length: range.end - range.start + 1 }, (_, offset) => release.byteAt(range.start + offset));
      values[release.name] = bytes;
      const key = bytes.join(",");
      groups.set(key, [...(groups.get(key) ?? []), release.name]);
    }
    return { ...range, values, groups: [...groups.values()].sort((a, b) => b.length - a.length) };
  });
  return { common, identicalBytes, differingBytes: differing.length, differences, moreDifferences: ranges.length > limit };
}

/** The addresses of a release in order, so that a window of bytes can run over its segments. */
function addressesOf(release: Release): number[] {
  return release.segments.flatMap((segment) => Array.from({ length: segment.end - segment.start + 1 }, (_, offset) => segment.start + offset));
}

/**
 * The shift that puts `other` over `base` best: the most common address
 * difference between equal 8-byte sequences. Undefined when nothing matches.
 */
export function suggestShift(base: Release, other: Release): { shift: number; matches: number } | undefined {
  const WINDOW = 8;
  const key = (release: Release, addresses: number[], at: number) =>
    String.fromCharCode(...addresses.slice(at, at + WINDOW).map((address) => release.byteAt(address)));
  const baseAddresses = addressesOf(base);
  const otherAddresses = addressesOf(other);
  const positions = new Map<string, number[]>();
  for (let at = 0; at + WINDOW <= baseAddresses.length; at++) {
    const found = positions.get(key(base, baseAddresses, at));
    // Very common sequences (fill bytes) say nothing about the alignment.
    if (found === undefined) positions.set(key(base, baseAddresses, at), [baseAddresses[at]!]);
    else if (found.length < 8) found.push(baseAddresses[at]!);
  }
  const votes = new Map<number, number>();
  for (let at = 0; at + WINDOW <= otherAddresses.length; at++) {
    for (const address of positions.get(key(other, otherAddresses, at)) ?? []) {
      const shift = address - otherAddresses[at]!;
      votes.set(shift, (votes.get(shift) ?? 0) + 1);
    }
  }
  let best: { shift: number; matches: number } | undefined;
  for (const [shift, matches] of votes) if (best === undefined || matches > best.matches) best = { shift, matches };
  return best;
}
