// The image that a skill script works on: an image.json of the c64-unpacker
// skill (a 64 KiB memory and its segments) or a PRG, read from the project.

import { posix } from "node:path";

import { formatC64Address, prgRange } from "../c64.ts";
import { readProjectFile } from "./transfer.ts";

/** A file that is no image: the scripts report it as a bad call. */
export class ImageError extends Error {
  override name = "ImageError";
}

export interface Image {
  path: string;
  segments: Array<{ start: number; end: number }>;
  /** The byte at an address inside a segment. */
  byteAt: (address: number) => number;
  /** The bytes that Ghidra analyzes, and how. */
  analyzed: { bytes: Buffer; kind: "prg" | "flat64k" };
  entry?: number;
  /** entry_state.json next to image.json. */
  statePath?: string;
}

/** Reads an image.json or a PRG, relative to the project directory. */
export function readImage(path: string): Image {
  const { bytes } = readProjectFile(path);
  if (!path.endsWith(".json")) {
    let range: ReturnType<typeof prgRange>;
    try {
      range = prgRange(bytes);
    } catch (error) {
      throw new ImageError(`${path}: ${(error as Error).message}`);
    }
    return { path, segments: [{ start: range.start, end: range.end }], byteAt: (address) => range.body[address - range.start]!, analyzed: { bytes, kind: "prg" } };
  }
  const fail = (what: string): never => {
    throw new ImageError(`${path} is not an image.json of the c64-unpacker skill: ${what}`);
  };
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
  } catch (error) {
    return fail((error as Error).message);
  }
  const address = (value: unknown, what: string) => (typeof value === "string" && /^\$[0-9a-f]{4}$/i.test(value) ? Number.parseInt(value.slice(1), 16) : fail(`${what} is not a $ address`));
  if (typeof manifest.image !== "string") fail("it has no image");
  if (!Array.isArray(manifest.segments) || manifest.segments.length === 0) fail("it has no segments");
  const segments = (manifest.segments as Array<Record<string, unknown>>)
    .map((segment, index) => ({ start: address(segment.start, `segment ${index + 1} start`), end: address(segment.end, `segment ${index + 1} end`) }))
    .sort((a, b) => a.start - b.start);
  segments.forEach((segment, index) => {
    if (segment.end < segment.start) fail(`the segment at ${formatC64Address(segment.start)} ends before it starts`);
    if (index > 0 && segment.start <= segments[index - 1]!.end) fail(`the segments at ${formatC64Address(segments[index - 1]!.start)} and ${formatC64Address(segment.start)} overlap`);
  });
  const directory = posix.dirname(path);
  const memory = readProjectFile(posix.join(directory, manifest.image as string)).bytes;
  if (memory.length !== 0x10000) fail(`its image has ${memory.length} bytes, not 65536`);
  const image: Image = { path, segments, byteAt: (at) => memory[at]!, analyzed: { bytes: memory, kind: "flat64k" }, statePath: posix.join(directory, "entry_state.json") };
  if (manifest.entry !== undefined) image.entry = address(manifest.entry, "entry");
  return image;
}
