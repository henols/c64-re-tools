// Byte comparison of releases for the c64-provenance script. Each release
// has bytes in one or more segments: a PRG at its load address plus an
// optional shift, or the segments of an unpacker image. The comparison
// covers the addresses where every release has bytes, and reports where the
// releases differ and which releases agree there. It never decides which
// bytes are original: that needs evidence beyond one comparison.

import { type AddressRange, formatC64Address } from "#src/c64.ts";

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

/** The ranges where every release has bytes, inside from..to. */
export function commonRanges(releases: Release[], from = 0x0000, to = 0xffff): AddressRange[] {
  const ranges: AddressRange[] = [];
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

/** Most shifts that suggestShifts gives: data that did not move can outvote code that did. */
export const MAX_SUGGESTED_SHIFTS = 3;

/**
 * The shifts that put `other` over `base` best: the most common address
 * differences between equal 8-byte sequences, most votes first. A shift with
 * less than a tenth of the best one's votes is chance. Empty when nothing matches.
 */
export function suggestShifts(base: Release, other: Release): Array<{ shift: number; matches: number }> {
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
  const ranked = [...votes].map(([shift, matches]) => ({ shift, matches })).sort((a, b) => b.matches - a.matches || Math.abs(a.shift) - Math.abs(b.shift));
  return ranked.filter((found) => found.matches * 10 >= ranked[0]!.matches).slice(0, MAX_SUGGESTED_SHIFTS);
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
    `release ${number} moved by ${by} puts ${formatC64Address(segment.start)}-${formatC64Address(segment.end)} ${segment.start + by < 0 ? "below $0000" : "past $ffff"}`;
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
