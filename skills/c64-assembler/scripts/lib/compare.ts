// The byte check of a build (D47): the assembled program against the image
// of the unpacker (image.json with image.bin), a reference PRG, or 64 KiB of
// memory, segment by segment.

import { posix } from "node:path";

import { formatC64Address, prgRange } from "#src/c64.ts";
import { readProjectFile } from "#src/host-client/transfer.ts";
import { UsageError } from "#src/script.ts";

export interface SegmentCheck {
  start: string;
  end: string;
  result: "identical" | "different" | "not covered";
  /** Bytes of the segment that the build does not hold. */
  uncovered?: number;
  differences?: number;
  firstDifference?: { address: string; built: number; reference: number };
}

const FULL = 0x10000;

/** The reference as memory and the ranges to check in it. */
function reference(path: string, built: { start: number; end: number }): { memory: (address: number) => number | undefined; segments: Array<{ start: number; end: number }> } {
  const { bytes } = readProjectFile(path);
  if (path.endsWith(".json")) {
    let manifest: { image?: unknown; segments?: unknown };
    try {
      manifest = JSON.parse(bytes.toString("utf8")) as typeof manifest;
    } catch (error) {
      throw new UsageError(`--compare ${path} is not JSON: ${(error as Error).message}`);
    }
    const segments = manifest.segments;
    if (typeof manifest.image !== "string" || !Array.isArray(segments) || segments.length === 0) throw new UsageError(`--compare ${path} is not an image.json: it needs image and segments`);
    const image = readProjectFile(posix.join(posix.dirname(path), manifest.image)).bytes;
    if (image.length !== FULL) throw new UsageError(`the image of ${path} has ${image.length} bytes, not 65536`);
    return {
      memory: (address) => image[address],
      segments: segments.map((segment: { start?: unknown; end?: unknown }) => {
        const parse = (value: unknown) => (typeof value === "string" && /^\$[0-9a-f]{4}$/i.test(value) ? Number.parseInt(value.slice(1), 16) : NaN);
        const range = { start: parse(segment.start), end: parse(segment.end) };
        if (!(range.start <= range.end)) throw new UsageError(`--compare ${path}: a segment needs start and end as $ addresses`);
        return range;
      }),
    };
  }
  if (bytes.length === FULL && !path.endsWith(".prg")) return { memory: (address) => bytes[address], segments: [built] };
  let range: ReturnType<typeof prgRange>;
  try {
    range = prgRange(bytes);
  } catch (error) {
    throw new UsageError(`--compare ${path}: ${(error as Error).message}`);
  }
  return { memory: (address) => (address >= range.start && address <= range.end ? range.body[address - range.start] : undefined), segments: [{ start: range.start, end: range.end }] };
}

/** Compares the assembled PRG with the reference, segment by segment. */
export function compareBuild(prg: Uint8Array, path: string): { against: string; identical: boolean; segments: SegmentCheck[] } {
  const built = prgRange(prg);
  const { memory, segments } = reference(path, built);
  const checks = segments.map((segment): SegmentCheck => {
    const from = Math.max(segment.start, built.start);
    const to = Math.min(segment.end, built.end);
    const shown = { start: formatC64Address(segment.start), end: formatC64Address(segment.end) };
    if (from > to) return { ...shown, result: "not covered", uncovered: segment.end - segment.start + 1 };
    let differences = 0;
    let first: SegmentCheck["firstDifference"];
    for (let address = from; address <= to; address++) {
      const builtByte = built.body[address - built.start]!;
      const referenceByte = memory(address);
      if (referenceByte === undefined || builtByte === referenceByte) continue;
      differences++;
      first ??= { address: formatC64Address(address), built: builtByte, reference: referenceByte };
    }
    const uncovered = segment.end - segment.start + 1 - (to - from + 1);
    return {
      ...shown,
      result: differences > 0 ? "different" : uncovered > 0 ? "not covered" : "identical",
      ...(uncovered > 0 ? { uncovered } : {}),
      ...(differences > 0 ? { differences, firstDifference: first! } : {}),
    };
  });
  return { against: path, identical: checks.every((check) => check.result === "identical"), segments: checks };
}
