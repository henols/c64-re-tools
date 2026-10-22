// Short-lived typed requests to the Host Runtime for skill scripts:
// VICE's own tools (c1541, petcat) and the host tool status. Each request
// opens its own "tool" connection, sends bytes, and closes. Skill scripts run
// ACME, DXA and Ghidra themselves through src/native (Ghidra in process).

import { ProtocolError, WireFailure } from "../protocol/messages.ts";
import { DISK_IMAGE_TYPES, validateToolResult, type C1541Result, type DiskAction, type DiskImageType, type DiskSector, type PetcatResult, type ToolOperation, type ToolOperations } from "../protocol/tools.ts";
import { HostConnection } from "./connect.ts";
import { readPrg } from "./image.ts";
import { readProjectFile } from "./transfer.ts";

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
          reject(
            new WireFailure(
              "operation-failed",
              error instanceof ProtocolError ? "The c64-re-tools host runtime sent an invalid reply." : "The c64-re-tools host-client could not read the reply of the host runtime.",
            ),
          );
        }
      });
      void connection.closed.then(() =>
        reject(new WireFailure("machine-unavailable", "The connection to the c64-re-tools host runtime was lost during the request. Check that the Host Runtime (c64-re-tools-host) is running.")),
      );
      connection.send({ type: "request", id: 1, op, params }, attachments);
    });
  } finally {
    await connection.close();
  }
}

export interface InspectDiskRequest {
  /** Project-relative disk image; its extension gives the image type. */
  image: string;
  action: DiskAction;
  /** entry, chain and read: the file name as the directory shows it. */
  name?: string;
  /** sectors: the blocks to read in this order, then with unreferenced each used sector that no file holds. */
  sectors?: DiskSector[];
  unreferenced?: boolean;
}

/** c1541.inspect: a found read also returns the file's bytes, and sectors the blocks, 256 bytes each. */
export async function inspectDisk(request: InspectDiskRequest, options: ToolCallOptions = {}): Promise<C1541Result & { data?: Buffer }> {
  const file = readProjectFile(request.image);
  if (!(DISK_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new WireFailure("invalid-input", `${request.image} is not a disk image that this tool reads. Use a .d64, .d71, .d81 or .g64 file.`);
  }
  const params: ToolOperations["c1541.inspect"]["params"] = { action: request.action, imageType: file.type as DiskImageType };
  if (request.name !== undefined) params.name = request.name;
  if (request.sectors !== undefined) params.sectors = request.sectors;
  if (request.unreferenced !== undefined) params.unreferenced = request.unreferenced;
  const { result, attachments } = await callTool("c1541.inspect", params, [file.bytes], options);
  return (result.action === "read" && result.found) || result.action === "sectors" ? { ...result, data: attachments[0]! } : result;
}

/** petcat.decode: the C64 BASIC V2 listing of a project program and its machine-code handoffs. Refuses a file that is no PRG as readPrg does. */
export async function decodeBasic(request: { program: string }, options: ToolCallOptions = {}): Promise<PetcatResult> {
  const { bytes } = readPrg(request.program);
  return (await callTool("petcat.decode", {}, [bytes], options)).result;
}

/** Skill scripts see failures and wire limits through the host-client, never the private protocol module. */
export { WireFailure } from "../protocol/messages.ts";
export { DISK_ACTIONS, DISK_BLOCK_BYTES, DISK_IMAGE_TYPES, MAX_DISK_SECTORS } from "../protocol/tools.ts";
export { JOYSTICK_DIRECTIONS, MAX_BASELINES, MAX_EXECUTION_COUNT, MAX_KEYBOARD_BYTES, MAX_MASK_RECTANGLES, MAX_MEMORY_READ, MAX_MEMORY_WRITE, MAX_TIMEOUT_FRAMES, maskCoversFrame } from "../protocol/vice.ts";
export { MAX_TRACE_FRAMES, MAX_TRACE_HITS, MAX_TRACE_POINTS, TRACE_KINDS, type TraceHit, type TraceKind } from "../protocol/vice.ts";
