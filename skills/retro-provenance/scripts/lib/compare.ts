// Byte comparison of releases for the retro-provenance script. Each release
// has bytes in one or more segments: a PRG at its load address plus an
// optional shift, or the segments of an unpacker image. The comparison
// covers the addresses where every release has bytes, and reports where the
// releases differ and which releases agree there. For two releases with
// moved code, align maps the bytes of one to the other in blocks of equal
// bytes. It never decides which bytes are original: that needs evidence
// beyond one comparison.

import { type AddressRange, formatAddress } from "#src/address.ts";

export interface Release {
  name: string;
  /** Where the release has bytes, after the shift, in address order. */
  segments: AddressRange[];
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
  common: AddressRange[];
  identicalBytes: number;
  differingBytes: number;
  differences: DifferingRange[];
  /** True when more differing ranges exist than the limit allowed. */
  moreDifferences: boolean;
}

/** Joins differing addresses that are at most this far apart into one range. */
const JOIN_GAP = 4;

export const covers = (release: Release, address: number) => release.segments.some((segment) => address >= segment.start && address <= segment.end);

/**
 * The share of identical bytes with 3 decimals. It is 1 only when no byte
 * differs, and 0 only when no byte is identical: a rounded share must not hide
 * one differing or one identical byte.
 */
export function identicalShare(identical: number, differing: number): number {
  const compared = identical + differing;
  if (compared === 0 || identical === 0) return 0;
  if (differing === 0) return 1;
  return Math.min(0.999, Math.max(0.001, Number((identical / compared).toFixed(3))));
}

/** The ranges where every release has bytes, inside from..to. */
export function commonRanges(releases: Release[], from = 0x0000, to = 0xffff): AddressRange[] {
  return rangesOf(Array.from({ length: to - from + 1 }, (_, offset) => from + offset).filter((address) => releases.every((release) => covers(release, address))));
}

/** Consecutive addresses in order as ranges. */
function rangesOf(addresses: number[]): AddressRange[] {
  const ranges: AddressRange[] = [];
  for (const address of addresses) {
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
  const ranges: AddressRange[] = [];
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

/** The length of the byte sequences that find equal bytes in two releases. */
const WINDOW = 8;

const windowKey = (release: Release, addresses: number[], at: number) => String.fromCharCode(...addresses.slice(at, at + WINDOW).map((address) => release.byteAt(address)));

/** The addresses where each 8-byte sequence of `addresses` starts, at most 8 for each sequence. */
function indexWindows(release: Release, addresses: number[]): Map<string, number[]> {
  const positions = new Map<string, number[]>();
  for (let at = 0; at + WINDOW <= addresses.length; at++) {
    const key = windowKey(release, addresses, at);
    const found = positions.get(key);
    // Very common sequences (fill bytes) say nothing about the alignment.
    if (found === undefined) positions.set(key, [addresses[at]!]);
    else if (found.length < 8) found.push(addresses[at]!);
  }
  return positions;
}

/** Most shifts that suggestShifts gives: data that did not move can outvote code that did. */
export const MAX_SUGGESTED_SHIFTS = 3;

/**
 * The shifts that put `other` over `base` best: the most common address
 * differences between equal 8-byte sequences, most votes first. A shift with
 * less than a tenth of the best one's votes is chance. Empty when nothing matches.
 */
export function suggestShifts(base: Release, other: Release): Array<{ shift: number; matches: number }> {
  const positions = indexWindows(base, addressesOf(base));
  const otherAddresses = addressesOf(other);
  const votes = new Map<number, number>();
  for (let at = 0; at + WINDOW <= otherAddresses.length; at++) {
    for (const address of positions.get(windowKey(other, otherAddresses, at)) ?? []) {
      const shift = address - otherAddresses[at]!;
      votes.set(shift, (votes.get(shift) ?? 0) + 1);
    }
  }
  const ranked = [...votes].map(([shift, matches]) => ({ shift, matches })).sort((a, b) => b.matches - a.matches || Math.abs(a.shift) - Math.abs(b.shift));
  return ranked.filter((found) => found.matches * 10 >= ranked[0]!.matches).slice(0, MAX_SUGGESTED_SHIFTS);
}

export interface Block {
  a: AddressRange;
  b: AddressRange;
  /** The address in b minus the address in a. */
  shift: number;
  bytes: number;
}

export interface Alignment {
  /** In the order of their addresses in a. */
  blocks: Block[];
  /** The bytes of a that no block holds: removed in b. */
  onlyInA: AddressRange[];
  /** The bytes of b that no block holds: inserted in b. */
  onlyInB: AddressRange[];
  /** The share of the bytes of a and b in the range that a block holds, as identicalShare gives it. */
  alignedShare: number;
}

/**
 * Maps the bytes of `a` to the bytes of `b` in blocks of equal bytes, at least
 * `minBlock` long, for releases with added code and moved data, where no one
 * shift fits. Only the bytes inside `range` and the segments count. Each
 * address of a that no block holds yet gets the longest block through it:
 * from each address of b with the same 8 bytes, and from the shift of the
 * block before. Then the longest blocks are kept with no byte of a or b in two
 * blocks; a block that overlaps a kept one keeps its free parts. Blocks can
 * cross: moved code changes the order.
 */
export function align(a: Release, b: Release, range: AddressRange, minBlock: number): Alignment {
  const inRange = (address: number) => address >= range.start && address <= range.end;
  const aAddresses = addressesOf(a).filter(inRange);
  const bAddresses = addressesOf(b).filter(inRange);
  // -1 where the release has no byte; an index outside $0000-$ffff gives undefined.
  const bytesOf = (release: Release, addresses: number[]) => {
    const bytes = new Int16Array(0x10000).fill(-1);
    for (const address of addresses) bytes[address] = release.byteAt(address);
    return bytes;
  };
  const bytesA = bytesOf(a, aAddresses);
  const bytesB = bytesOf(b, bAddresses);
  const equal = (x: number, y: number) => {
    const value = bytesA[x];
    return value !== undefined && value >= 0 && value === bytesB[y];
  };

  type Found = { a: number; b: number; bytes: number };
  const index = indexWindows(b, bAddresses);
  const found: Found[] = [];
  let covered = -1;
  let lastShift: number | undefined;
  for (let at = 0; at < aAddresses.length; at++) {
    const p = aAddresses[at]!;
    if (p <= covered) continue;
    const candidates = at + WINDOW <= aAddresses.length ? [...(index.get(windowKey(a, aAddresses, at)) ?? [])] : [];
    if (lastShift !== undefined) candidates.push(p + lastShift);
    let best: Found | undefined;
    for (const q of candidates) {
      if (!equal(p, q)) continue;
      let back = 0;
      while (equal(p - back - 1, q - back - 1)) back++;
      let forward = 1;
      while (equal(p + forward, q + forward)) forward++;
      if (best === undefined || back + forward > best.bytes) best = { a: p - back, b: q - back, bytes: back + forward };
    }
    if (best === undefined || best.bytes < minBlock) continue;
    found.push(best);
    covered = best.a + best.bytes - 1;
    lastShift = best.b - best.a;
  }

  // The longest first; a piece that is left of an overlapping block goes back in its place in that order.
  const before = (x: Found, y: Found) => y.bytes - x.bytes || Math.abs(x.b - x.a) - Math.abs(y.b - y.a) || x.a - y.a;
  const queue = found.sort(before);
  const usedA = new Uint8Array(0x10000);
  const usedB = new Uint8Array(0x10000);
  const kept: Found[] = [];
  for (let next = 0; next < queue.length; next++) {
    const block = queue[next]!;
    const pieces: Found[] = [];
    let start: number | undefined;
    for (let offset = 0; offset <= block.bytes; offset++) {
      if (offset < block.bytes && usedA[block.a + offset] === 0 && usedB[block.b + offset] === 0) start ??= offset;
      else if (start !== undefined) {
        pieces.push({ a: block.a + start, b: block.b + start, bytes: offset - start });
        start = undefined;
      }
    }
    if (pieces.length === 1 && pieces[0]!.bytes === block.bytes) {
      kept.push(block);
      usedA.fill(1, block.a, block.a + block.bytes);
      usedB.fill(1, block.b, block.b + block.bytes);
      continue;
    }
    for (const piece of pieces.filter((item) => item.bytes >= minBlock)) {
      let place = next + 1;
      while (place < queue.length && before(queue[place]!, piece) <= 0) place++;
      queue.splice(place, 0, piece);
    }
  }

  const alignedBytes = kept.reduce((sum, block) => sum + block.bytes, 0);
  const onlyInA = rangesOf(aAddresses.filter((address) => usedA[address] === 0));
  const onlyInB = rangesOf(bAddresses.filter((address) => usedB[address] === 0));
  return {
    blocks: kept
      .sort((x, y) => x.a - y.a)
      .map((block) => ({ a: { start: block.a, end: block.a + block.bytes - 1 }, b: { start: block.b, end: block.b + block.bytes - 1 }, shift: block.b - block.a, bytes: block.bytes })),
    onlyInA,
    onlyInB,
    alignedShare: identicalShare(2 * alignedBytes, aAddresses.length + bAddresses.length - 2 * alignedBytes),
  };
}

export type ShiftSuggestion = { release: number; shift: number; matchingSequences: number } | { release: number; matchingSequences: number; reason: string };

/**
 * The --shift to suggest for release `index` (0 = the first) from `found`,
 * the best shift of that release over the first one. The shift is the
 * full value for --shift: `applied` holds the shifts already given. A shift
 * that moves a segment out of $0000-$ffff is not suggested: with two releases,
 * the opposite shift of the first release is suggested when it fits, else the
 * result gives the reason.
 */
export function shiftSuggestion(releases: Release[], applied: number[], index: number, found: { shift: number; matches: number }): ShiftSuggestion {
  const outside = (release: Release, by: number) => release.segments.find((segment) => segment.start + by < 0 || segment.end + by > 0xffff);
  const why = (number: number, by: number, segment: AddressRange) =>
    `release ${number} moved by ${by} puts ${formatAddress(segment.start)}-${formatAddress(segment.end)} ${segment.start + by < 0 ? "below $0000" : "past $ffff"}`;
  const own = outside(releases[index]!, found.shift);
  if (own === undefined) return { release: index + 1, shift: applied[index]! + found.shift, matchingSequences: found.matches };
  const reasons = [why(index + 1, found.shift, own)];
  if (releases.length === 2) {
    const base = outside(releases[0]!, -found.shift);
    if (base === undefined) return { release: 1, shift: applied[0]! - found.shift, matchingSequences: found.matches };
    reasons.push(why(1, -found.shift, base));
  }
  return { release: index + 1, matchingSequences: found.matches, reason: `No shift fits: ${reasons.join(", and ")}.` };
}
