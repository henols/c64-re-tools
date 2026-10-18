// An image.json of the c64-unpacker skill (a 64 KiB memory and its segments)
// or a PRG, read from the project to put it into the knowledge.

import { posix } from "node:path";

import { isRefusal, Refusal } from "../errors.ts";
import { formatC64Address, prgRange } from "../c64.ts";
import { readEntryState, type EntryState } from "./entry-state.ts";
import { readProjectFile } from "./transfer.ts";

export interface Image {
  segments: Array<{ start: number; end: number }>;
  /** The byte at an address inside a segment. */
  byteAt: (address: number) => number;
  /** image.json only: the 64 KiB memory of the capture, also outside the segments. */
  memory?: Uint8Array;
  entry?: number;
  /** The entry state in entry_state.json next to image.json, when the capture wrote one. */
  state?: EntryState;
  /** The stages of the capture in image.json, as the unpacker wrote them. */
  stages?: Array<Record<string, unknown>>;
}

/** The kinds of media files that are no PRG, by extension. */
const MEDIA_KINDS: Record<string, string> = {
  d64: "a disk image",
  d71: "a disk image",
  d81: "a disk image",
  g64: "a disk image",
  x64: "a disk image",
  t64: "a tape file",
  tap: "a tape file",
  crt: "a cartridge file",
};

/** The remedy for a disk, tape or cartridge file where a PRG must be: get the PRG out of it. */
export const MEDIA_REMEDY = "Get the PRG out of it with disk.ts read (or disk.ts crt for a cartridge) of the c64-disk skill";

/** Refuses a disk, tape or cartridge file by its extension (`type`, lowercase, without the dot): invalid-input with `remedy`. */
function refuseMedia(path: string, type: string, remedy: string): void {
  const media = MEDIA_KINDS[type];
  if (media !== undefined) throw new Refusal("invalid-input", `${path} is ${media} (.${type}), not a PRG. ${remedy}.`);
}

/**
 * Reads a PRG of the project: a 2-byte load address, and bytes that end at
 * $ffff or before. Refuses a disk, tape or cartridge file and any other file
 * that is no PRG with invalid-input; `remedy` tells what to do in its place.
 * A file of fewer than 3 bytes is refused as too short: no remedy applies.
 */
export function readPrg(path: string, remedy = MEDIA_REMEDY): { bytes: Buffer; start: number; end: number; body: Uint8Array } {
  const { bytes, type } = readProjectFile(path);
  refuseMedia(path, type, remedy);
  if (bytes.length < 3) {
    throw new Refusal("invalid-input", `${path} is too short for a PRG: it has ${bytes.length} ${bytes.length === 1 ? "byte" : "bytes"}, and a PRG has a 2-byte load address and at least one byte. Give the complete PRG file.`);
  }
  try {
    return { bytes, ...prgRange(bytes) };
  } catch (error) {
    if (isRefusal(error)) throw new Refusal("invalid-input", `${path} is not a PRG: ${error.message} ${remedy}.`);
    throw error;
  }
}

/** Reads an image.json or a PRG, relative to the project folder. Refuses a disk, tape or cartridge file as readPrg does. */
export function readImage(path: string): Image {
  if (!path.endsWith(".json")) {
    const range = readPrg(path);
    return { segments: [{ start: range.start, end: range.end }], byteAt: (address) => range.body[address - range.start]! };
  }
  const { bytes } = readProjectFile(path);
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
  const image: Image = { segments, byteAt: (at) => memory[at]!, memory };
  const state = entryStateNextTo(posix.join(directory, "entry_state.json"));
  if (state !== undefined) image.state = state;
  if (manifest.entry !== undefined) image.entry = address(manifest.entry, "entry");
  if (Array.isArray(manifest.stages)) image.stages = manifest.stages.map((stage, index) => (isObject(stage) ? stage : fail(`stage ${index + 1} is not an object`)));
  return image;
}

/** The entry state of a capture, or undefined when the capture has no entry_state.json. */
function entryStateNextTo(path: string): EntryState | undefined {
  try {
    return readEntryState(path);
  } catch (error) {
    if (isRefusal(error) && error.code === "not-found") return undefined;
    throw error;
  }
}
