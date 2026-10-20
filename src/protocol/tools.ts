// The native-tool operations of the Host Runtime wire ("tool" connections): their shapes and validators.

import { textToPetsciiName, type BasicHandoff } from "../c64.ts";
import { type Fields, invalid, isInteger, isObject, isOneOf, onlyFields, ProtocolError } from "./messages.ts";

// ---------------------------------------------------------------------------
// Native-tool operations. Short-lived requests on "tool" connections; they
// never touch an emulator or the knowledge.

/** A transferred source tree: relative POSIX paths, one attachment per file in this order. */
export type SourceTree = Array<{ path: string; size: number }>;
export const MAX_TREE_FILES = 4096;

export const DISK_IMAGE_TYPES = ["d64", "d71", "d81", "g64"] as const;
export type DiskImageType = (typeof DISK_IMAGE_TYPES)[number];
export const DISK_ACTIONS = ["directory", "bam", "entry", "chain", "read", "sectors"] as const;
export type DiskAction = (typeof DISK_ACTIONS)[number];
export const CBM_FILE_TYPES = ["del", "seq", "prg", "usr", "rel", "unknown"] as const;
export type CbmFileType = (typeof CBM_FILE_TYPES)[number];

/** c1541.inspect. The image bytes are the request's one attachment. */
export interface C1541Params {
  action: DiskAction;
  imageType: DiskImageType;
  /** entry, chain and read only: the file name as petsciiNameToText shows it. */
  name?: string;
  /** sectors only: the blocks to read, in this order; with unreferenced, then each used sector that no file holds (see bam). */
  sectors?: DiskSector[];
  unreferenced?: boolean;
}

/** The most blocks of one sectors request, more than a disk image holds: a D81 has 3200. */
export const MAX_DISK_SECTORS = 4096;
/** The size of a disk block. */
export const DISK_BLOCK_BYTES = 256;

export interface DiskFile {
  name: string;
  type: CbmFileType;
  blocks: number;
  closed: boolean;
  locked: boolean;
}

export interface DiskSector {
  track: number;
  sector: number;
}

export type C1541Result =
  | { action: "directory"; diskName: string; diskId: string; dosType: string; freeBlocks: number; entries: DiskFile[] }
  /** unreferenced: the used sectors that no file, the header, the directory or the BAM holds. */
  | { action: "bam"; tracks: Array<{ track: number; freeSectors: number[]; usedSectors: number[] }>; unreferenced: DiskSector[] }
  | { action: "entry"; found: false }
  | { action: "entry"; found: true; entry: DiskFile & { startTrack: number; startSector: number } }
  | { action: "chain"; found: false }
  | { action: "chain"; found: true; sectors: DiskSector[] }
  | { action: "read"; found: false }
  /** The file's bytes are the reply's attachment. */
  | { action: "read"; found: true; name: string; bytes: number }
  /** The blocks of the sectors, 256 bytes each in this order, are the reply's attachment. */
  | { action: "sectors"; sectors: DiskSector[]; bytes: number };

/** petcat.decode takes no fields: the program bytes are the request's one attachment. */
export type PetcatParams = Record<string, never>;

/** A machine-code handoff: SYS with a constant address, or SYS/USR whose target is computed at run time. */
export type { BasicHandoff };

export type PetcatResult =
  | { decoded: false; reason: string }
  | {
      decoded: true;
      loadAddress: number;
      /** The first address that holds no BASIC: after a 00 00 end marker, or at a link whose high byte only is zero. */
      basicEnd: number;
      listing: string;
      lines: Array<{ number: number; text: string }>;
      handoffs: BasicHandoff[];
    };

/** One native tool on the host, as host.status found and ran it. */
export interface ToolStatus {
  name: string;
  found: boolean;
  /** Where it is, when found. */
  path?: string;
  /** Its version text, when it ran. */
  version?: string;
  runs: boolean;
  /** What is wrong and what to do, when it is missing or does not run. */
  problem?: string;
  /** Known flaws of this version, each with the version that fixes it. The tool still runs. */
  flaws?: string[];
}

/** The Host Runtime itself: its package version and the system it runs on. */
export interface HostInfo {
  version: string;
  /** Node's name of the operating system: linux, darwin or win32. */
  platform: string;
  /** The release of the operating system. */
  release: string;
  arch: string;
}

export interface ToolOperations {
  "host.status": { params: Record<string, never>; result: { host: HostInfo; tools: ToolStatus[] } };
  "c1541.inspect": { params: C1541Params; result: C1541Result };
  "petcat.decode": { params: PetcatParams; result: PetcatResult };
}
export type ToolOperation = keyof ToolOperations;
export const TOOL_OPERATIONS = ["host.status", "c1541.inspect", "petcat.decode"] as const satisfies readonly ToolOperation[];

const RELATIVE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.?(?:\/|$))[^\0\\]+$/;

/** A relative POSIX path with no empty, "." or ".." segment and no backslash. */
export function isRelativePath(value: unknown): value is string {
  return typeof value === "string" && value.length <= 1024 && RELATIVE_PATH.test(value) && !value.includes("//") && !value.endsWith("/");
}

/** Refuses anything but exactly one attachment with at least one byte, named by what it must hold. */
function oneFile(attachments: readonly Uint8Array[], what: string): void {
  if (attachments.length !== 1 || attachments[0]!.length === 0) invalid(`${what} must be the one attachment, and it must not be empty`);
}

/** Validates tool request parameters on the host. Throws WireFailure(invalid-input). */
export function validateToolParams<O extends ToolOperation>(op: O, params: unknown, attachments: readonly Uint8Array[]): ToolOperations[O]["params"] {
  if (!isObject(params)) invalid("parameters must be an object");
  switch (op) {
    case "c1541.inspect": {
      onlyFields(params, ["action", "imageType", "name", "sectors", "unreferenced"]);
      if (!isOneOf(DISK_ACTIONS, params.action)) invalid(`action must be one of ${DISK_ACTIONS.join(", ")}`);
      if (!isOneOf(DISK_IMAGE_TYPES, params.imageType)) invalid(`imageType must be one of ${DISK_IMAGE_TYPES.join(", ")}`);
      oneFile(attachments, "the disk image");
      const result: C1541Params = { action: params.action, imageType: params.imageType };
      if (params.action === "sectors") {
        const { sectors, unreferenced } = params;
        if (sectors !== undefined && (!Array.isArray(sectors) || !sectors.every(isTrackSector))) invalid("sectors must be a list of track and sector numbers from 0 to 255");
        if (sectors !== undefined && sectors.length > MAX_DISK_SECTORS) invalid(`sectors holds at most ${MAX_DISK_SECTORS} sectors`);
        if (unreferenced !== undefined && typeof unreferenced !== "boolean") invalid("unreferenced must be true or false");
        if ((sectors === undefined || sectors.length === 0) && unreferenced !== true) invalid("action sectors needs sectors, unreferenced, or both");
        if (sectors !== undefined) result.sectors = sectors.map((at) => ({ track: at.track, sector: at.sector }));
        if (unreferenced === true) result.unreferenced = true;
      } else if (params.sectors !== undefined || params.unreferenced !== undefined) {
        invalid(`action ${params.action} takes no sectors`);
      }
      const named = params.action === "entry" || params.action === "chain" || params.action === "read";
      if (!named) {
        if (params.name !== undefined) invalid(`action ${params.action} takes no name`);
      } else {
        if (typeof params.name !== "string" || params.name.length === 0) invalid(`action ${params.action} needs a file name`);
        let bytes: Uint8Array;
        try {
          bytes = textToPetsciiName(params.name);
        } catch (error) {
          return invalid(`name: ${(error as Error).message}`);
        }
        if (bytes.length > 16) invalid("a CBM file name has at most 16 characters");
        result.name = params.name;
      }
      return result as ToolOperations[O]["params"];
    }
    case "petcat.decode": {
      onlyFields(params, []);
      oneFile(attachments, "the program");
      return {} as ToolOperations[O]["params"];
    }
    case "host.status":
      onlyFields(params, []);
      if (attachments.length !== 0) invalid("host.status takes no attachment");
      return {} as ToolOperations[O]["params"];
  }
  return invalid(`unknown tool operation: ${String(op)}`);
}

/** Validates a tool result on the client. Throws ProtocolError. */
export function validateToolResult<O extends ToolOperation>(op: O, value: unknown, attachments: readonly Uint8Array[]): ToolOperations[O]["result"] {
  if (!isObject(value)) throw new ProtocolError(`${op} result is not an object`);
  switch (op) {
    case "c1541.inspect": {
      if (!isC1541Result(value, attachments)) throw new ProtocolError("c1541.inspect result is malformed");
      return value as unknown as ToolOperations[O]["result"];
    }
    case "petcat.decode": {
      if (!isPetcatResult(value) || attachments.length !== 0) throw new ProtocolError("petcat.decode result is malformed");
      return value as unknown as ToolOperations[O]["result"];
    }
    case "host.status": {
      const tools = value.tools;
      const isStatus = (tool: unknown) =>
        isObject(tool) &&
        typeof tool.name === "string" &&
        typeof tool.found === "boolean" &&
        typeof tool.runs === "boolean" &&
        [tool.path, tool.version, tool.problem].every((field) => field === undefined || typeof field === "string") &&
        (tool.flaws === undefined || (Array.isArray(tool.flaws) && tool.flaws.every((flaw: unknown) => typeof flaw === "string")));
      const host = value.host;
      const isHost = isObject(host) && [host.version, host.platform, host.release, host.arch].every((field) => typeof field === "string");
      if (!isHost || !Array.isArray(tools) || !tools.every(isStatus) || attachments.length !== 0) throw new ProtocolError("host.status result is malformed");
      return value as unknown as ToolOperations[O]["result"];
    }
  }
  throw new ProtocolError(`unknown tool operation: ${String(op)}`);
}

const isTrackSector = (value: unknown): boolean => isObject(value) && isInteger(value.track, 0, 255) && isInteger(value.sector, 0, 255);
const isSectorList = (value: unknown): boolean => Array.isArray(value) && value.every((item) => isInteger(item, 0, 255));

function isDiskFile(value: unknown): value is DiskFile {
  return (
    isObject(value) &&
    typeof value.name === "string" &&
    isOneOf(CBM_FILE_TYPES, value.type) &&
    isInteger(value.blocks, 0, 0xffff) &&
    typeof value.closed === "boolean" &&
    typeof value.locked === "boolean"
  );
}

function isC1541Result(value: Fields, attachments: readonly Uint8Array[]): boolean {
  const carries = (value.action === "read" && value.found === true) || value.action === "sectors" ? 1 : 0;
  if (attachments.length !== carries) return false;
  switch (value.action) {
    case "directory":
      return (
        typeof value.diskName === "string" &&
        typeof value.diskId === "string" &&
        typeof value.dosType === "string" &&
        isInteger(value.freeBlocks, 0, 0xffff) &&
        Array.isArray(value.entries) &&
        value.entries.every(isDiskFile)
      );
    case "bam":
      return (
        Array.isArray(value.tracks) &&
        value.tracks.every((track) => isObject(track) && isInteger(track.track, 1, 255) && isSectorList(track.freeSectors) && isSectorList(track.usedSectors)) &&
        Array.isArray(value.unreferenced) &&
        value.unreferenced.every(isTrackSector)
      );
    case "entry":
      return (
        value.found === false ||
        (value.found === true && isObject(value.entry) && isDiskFile(value.entry) && isTrackSector({ track: value.entry.startTrack, sector: value.entry.startSector }))
      );
    case "chain":
      return value.found === false || (value.found === true && Array.isArray(value.sectors) && value.sectors.every(isTrackSector));
    case "read":
      return value.found === false || (value.found === true && typeof value.name === "string" && value.bytes === attachments[0]!.length);
    case "sectors":
      return (
        Array.isArray(value.sectors) &&
        value.sectors.length <= MAX_DISK_SECTORS &&
        value.sectors.every(isTrackSector) &&
        value.bytes === value.sectors.length * DISK_BLOCK_BYTES &&
        value.bytes === attachments[0]!.length
      );
  }
  return false;
}

function isPetcatResult(value: Fields): boolean {
  if (value.decoded === false) return typeof value.reason === "string";
  const isLine = (line: unknown) => isObject(line) && isInteger(line.number, 0, 0xffff) && typeof line.text === "string";
  const isHandoff = (handoff: unknown) =>
    isObject(handoff) &&
    isInteger(handoff.line, 0, 0xffff) &&
    ((handoff.kind === "sys" && isInteger(handoff.address, 0, 0xffff) && handoff.computed === undefined) ||
      (handoff.kind === "sys" && handoff.computed === true && handoff.address === undefined && typeof handoff.expression === "string") ||
      (handoff.kind === "usr" && handoff.computed === true && handoff.address === undefined));
  return (
    value.decoded === true &&
    isInteger(value.loadAddress, 0, 0xffff) &&
    isInteger(value.basicEnd, 0, 0x10000) &&
    typeof value.listing === "string" &&
    Array.isArray(value.lines) &&
    value.lines.every(isLine) &&
    Array.isArray(value.handoffs) &&
    value.handoffs.every(isHandoff)
  );
}
