// An image.json of the c64-unpacker skill (a 64 KiB memory and its segments)
// or a PRG, read from the project to put it into the knowledge.

import { posix } from "node:path";

import { Refusal } from "../errors.ts";
import { formatC64Address, prgRange } from "../c64.ts";
import { readProjectFile } from "./transfer.ts";

export interface Image {
  segments: Array<{ start: number; end: number }>;
  /** The byte at an address inside a segment. */
  byteAt: (address: number) => number;
  entry?: number;
  /** entry_state.json next to image.json. */
  statePath?: string;
  /** The stages of the capture in image.json, as the unpacker wrote them. */
  stages?: Array<Record<string, unknown>>;
}

/** Reads an image.json or a PRG, relative to the project folder. */
export function readImage(path: string): Image {
  const { bytes } = readProjectFile(path);
  if (!path.endsWith(".json")) {
    let range: ReturnType<typeof prgRange>;
    try {
      range = prgRange(bytes);
    } catch (error) {
      throw new Refusal("invalid-input", `${path}: ${(error as Error).message}`);
    }
    return { segments: [{ start: range.start, end: range.end }], byteAt: (address) => range.body[address - range.start]! };
  }
  const fail = (what: string): never => {
    throw new Refusal("invalid-input", `${path} is not an image.json of the c64-unpacker skill: ${what}`);
  };
  const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    return fail((error as Error).message);
  }
  const manifest = isObject(parsed) ? parsed : fail("it is not a JSON object");
  const address = (value: unknown, what: string) => (typeof value === "string" && /^\$[0-9a-f]{4}$/i.test(value) ? Number.parseInt(value.slice(1), 16) : fail(`${what} is not a $ address`));
  if (typeof manifest.image !== "string") fail("it has no image");
  if (!Array.isArray(manifest.segments) || manifest.segments.length === 0) fail("it has no segments");
  const segments = (manifest.segments as unknown[])
    .map((segment, index) => (isObject(segment) ? segment : fail(`segment ${index + 1} is not an object`)))
    .map((segment, index) => ({ start: address(segment.start, `segment ${index + 1} start`), end: address(segment.end, `segment ${index + 1} end`) }))
    .sort((a, b) => a.start - b.start);
  segments.forEach((segment, index) => {
    if (segment.end < segment.start) fail(`the segment at ${formatC64Address(segment.start)} ends before it starts`);
    if (index > 0 && segment.start <= segments[index - 1]!.end) fail(`the segments at ${formatC64Address(segments[index - 1]!.start)} and ${formatC64Address(segment.start)} overlap`);
  });
  const directory = posix.dirname(path);
  const memory = readProjectFile(posix.join(directory, manifest.image as string)).bytes;
  if (memory.length !== 0x10000) fail(`its image has ${memory.length} bytes, not 65536`);
  const image: Image = { segments, byteAt: (at) => memory[at]!, statePath: posix.join(directory, "entry_state.json") };
  if (manifest.entry !== undefined) image.entry = address(manifest.entry, "entry");
  if (Array.isArray(manifest.stages)) image.stages = manifest.stages.map((stage, index) => (isObject(stage) ? stage : fail(`stage ${index + 1} is not an object`)));
  return image;
}
