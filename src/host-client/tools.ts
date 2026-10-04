// Short-lived typed native-tool requests for skill scripts (04 §4, 16). Each
// request opens its own "tool" connection, sends bytes, and closes.

import {
  DISK_IMAGE_TYPES,
  ProtocolError,
  validateToolResult,
  WireFailure,
  type AcmeResult,
  type C1541Result,
  type DiskAction,
  type DiskImageType,
  type GhidraParams,
  type GhidraResult,
  type PetcatResult,
  type ToolOperation,
  type ToolOperations,
} from "../protocol.ts";
import { HostConnection } from "./connect.ts";
import { readProjectFile, readProjectTree } from "./transfer.ts";

export interface ToolCallOptions {
  env?: NodeJS.ProcessEnv;
}

/** Sends one tool request and returns its validated result and attachments. */
export async function callTool<O extends ToolOperation>(
  op: O,
  params: ToolOperations[O]["params"],
  attachments: readonly Uint8Array[],
  options: ToolCallOptions = {},
): Promise<{ result: ToolOperations[O]["result"]; attachments: Buffer[] }> {
  const connection = await HostConnection.open({ role: "tool", ...(options.env === undefined ? {} : { env: options.env }) });
  try {
    return await new Promise((resolve, reject) => {
      connection.onMessage((message, received) => {
        if (message.type !== "reply" || message.id !== 1) {
          reject(new WireFailure("installation-incomplete", "The c64-re-tools host runtime answered out of turn. Install the same c64-re-tools release on both sides."));
          return;
        }
        if ("error" in message) {
          reject(new WireFailure(message.error.code, message.error.message));
          return;
        }
        try {
          resolve({ result: validateToolResult(op, message.result, received), attachments: received });
        } catch (error) {
          if (!(error instanceof ProtocolError)) throw error;
          reject(new WireFailure("operation-failed", "The c64-re-tools host runtime sent an invalid reply."));
        }
      });
      void connection.closed.then(() =>
        reject(new WireFailure("operation-failed", "The connection to the c64-re-tools host runtime was lost during the request. Check that c64-re-tools-host is running.")),
      );
      connection.send({ type: "request", id: 1, op, params } as never, attachments);
    });
  } finally {
    await connection.close();
  }
}

export interface AssembleRequest {
  /** Project-relative directory staged as a whole. */
  sourceRoot: string;
  /** Relative to sourceRoot. */
  entrySource: string;
  includeDirs?: string[];
  defines?: Record<string, number | boolean>;
  setPc?: number;
}

/** acme.assemble (16 §8): the program bytes come back when assembled is true. */
export async function assemble(request: AssembleRequest, options: ToolCallOptions = {}): Promise<AcmeResult & { program?: Buffer }> {
  const tree = readProjectTree(request.sourceRoot);
  const params: ToolOperations["acme.assemble"]["params"] = {
    files: tree.files,
    entrySource: request.entrySource,
    includeDirs: request.includeDirs ?? [],
    defines: request.defines ?? {},
  };
  if (request.setPc !== undefined) params.setPc = request.setPc;
  const { result, attachments } = await callTool("acme.assemble", params, tree.contents, options);
  return result.assembled ? { ...result, program: attachments[0]! } : result;
}

export interface InspectDiskRequest {
  /** Project-relative disk image; its extension gives the image type. */
  image: string;
  action: DiskAction;
  /** entry, chain and read: the file name as the directory shows it. */
  name?: string;
}

/** c1541.inspect (16 §12): a found read also returns the file's bytes. */
export async function inspectDisk(request: InspectDiskRequest, options: ToolCallOptions = {}): Promise<C1541Result & { data?: Buffer }> {
  const file = readProjectFile(request.image);
  if (!(DISK_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new WireFailure("invalid-input", `${request.image} is no disk image this tool reads; use a .d64, .d71, .d81 or .g64 file.`);
  }
  const params: ToolOperations["c1541.inspect"]["params"] = { action: request.action, imageType: file.type as DiskImageType };
  if (request.name !== undefined) params.name = request.name;
  const { result, attachments } = await callTool("c1541.inspect", params, [file.bytes], options);
  return result.action === "read" && result.found ? { ...result, data: attachments[0]! } : result;
}

/** petcat.decode (16 §13): the C64 BASIC V2 listing of a project program and its machine-code handoffs. */
export async function decodeBasic(request: { program: string }, options: ToolCallOptions = {}): Promise<PetcatResult> {
  const file = readProjectFile(request.program);
  return (await callTool("petcat.decode", {}, [file.bytes], options)).result;
}

/** ghidra.analyze (16 §10): structural analysis of a project PRG or 64 KiB image with knowledge seeds. */
export async function analyzeWithGhidra(request: { image: string } & GhidraParams, options: ToolCallOptions = {}): Promise<GhidraResult> {
  const file = readProjectFile(request.image);
  const { image: _image, ...params } = request;
  return (await callTool("ghidra.analyze", params, [file.bytes], options)).result;
}

/** Skill scripts see failures through the host-client, never the private protocol module. */
export { WireFailure } from "../protocol.ts";
export type { GhidraParams, GhidraResult } from "../protocol.ts";
