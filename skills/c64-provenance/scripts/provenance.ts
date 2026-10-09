// The c64-provenance script: compares two or more releases byte by byte at
// their addresses and reports where they differ and which releases agree.

import { parseArgs } from "node:util";

import { formatC64Address, parseC64Address } from "#src/c64.ts";
import { readProjectFile } from "#src/host-client/transfer.ts";
import { runScript, UsageError } from "#src/script.ts";
import { compareReleases, suggestShift, type Release } from "./compare.ts";

const USAGE = `provenance.ts <release.prg> <release.prg> [<release.prg> ...] [options]

  --shift <n>:<bytes>   move release n (1 = the first) by a number of bytes, for example 2:-256
  --from <address>      compare from this address
  --to <address>        compare up to this address

Each release is a PRG file relative to the project directory, placed at its
load address. The result is one JSON object.`;

function address(text: string, option: string): number {
  try {
    return parseC64Address(text);
  } catch {
    throw new UsageError(`${option} must be $ followed by four hex digits, not ${text}`);
  }
}

const hexBytes = (bytes: number[]) => Buffer.from(bytes).toString("hex").replace(/(..)(?!$)/g, "$1 ");

function run(argv: string[]): unknown {
  const { values, positionals } = parseArgs({
    args: argv,
    strict: true,
    allowPositionals: true,
    options: { shift: { type: "string", multiple: true }, from: { type: "string" }, to: { type: "string" }, help: { type: "boolean" } },
  });
  if (values.help) throw new UsageError("");
  if (positionals.length < 2) throw new UsageError("give two or more releases");
  const shifts = new Map<number, number>();
  for (const text of values.shift ?? []) {
    const match = /^(\d+):([+-]?\d+)$/.exec(text);
    if (match === null || Number(match[1]) < 1 || Number(match[1]) > positionals.length) throw new UsageError(`--shift must be <release number>:<bytes>, not ${text}`);
    shifts.set(Number(match[1]), Number(match[2]));
  }
  const releases: Release[] = positionals.map((path, index) => {
    const { bytes } = readProjectFile(path);
    if (bytes.length < 3) throw new UsageError(`${path} is too short for a PRG`);
    const start = bytes.readUInt16LE(0) + (shifts.get(index + 1) ?? 0);
    if (start < 0 || start + bytes.length - 3 > 0xffff) throw new UsageError(`the shift moves ${path} outside $0000-$ffff`);
    return { name: path, start, bytes: bytes.subarray(2) };
  });
  const comparison = compareReleases(releases, {
    ...(values.from === undefined ? {} : { from: address(values.from, "--from") }),
    ...(values.to === undefined ? {} : { to: address(values.to, "--to") }),
  });
  const compared = comparison.identicalBytes + comparison.differingBytes;
  const identicalShare = compared === 0 ? 0 : comparison.identicalBytes / compared;
  // A poor match at the load addresses can mean that the releases are placed differently.
  const suggestions =
    identicalShare < 0.5
      ? releases.slice(1).flatMap((release, index) => {
          const best = suggestShift(releases[0]!, release);
          return best === undefined || best.shift === 0 ? [] : [{ release: index + 2, shift: best.shift, matchingSequences: best.matches }];
        })
      : [];
  return {
    releases: releases.map((release) => ({ name: release.name, start: formatC64Address(release.start), end: formatC64Address(release.start + release.bytes.length - 1) })),
    common: comparison.common === null ? null : { start: formatC64Address(comparison.common.start), end: formatC64Address(comparison.common.end) },
    identicalBytes: comparison.identicalBytes,
    differingBytes: comparison.differingBytes,
    identicalShare: Number(identicalShare.toFixed(3)),
    differences: comparison.differences.map((difference) => ({
      start: formatC64Address(difference.start),
      end: formatC64Address(difference.end),
      values: Object.fromEntries(Object.entries(difference.values).map(([name, bytes]) => [name, hexBytes(bytes.slice(0, 32)) + (bytes.length > 32 ? " ..." : "")])),
      groups: difference.groups,
    })),
    ...(comparison.moreDifferences ? { moreDifferences: true } : {}),
    ...(suggestions.length > 0 ? { suggestedShifts: suggestions } : {}),
  };
}

await runScript(() => run(process.argv.slice(2)), { usage: USAGE });
