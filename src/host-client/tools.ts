// Short-lived typed requests to the Host Runtime for skill scripts:
// VICE's own tools (c1541, petcat) and the host tool status. Each request
// opens its own "tool" connection, sends bytes, and closes. Skill scripts run
// ACME, DXA and Ghidra themselves through src/native.

import {
  DISK_IMAGE_TYPES,
  ProtocolError,
  validateToolResult,
  WireFailure,
  type C1541Result,
  type DiskAction,
  type DiskImageType,
  type PetcatResult,
  type ToolOperation,
  type ToolOperations,
  type ToolStatus,
} from "../protocol.ts";
import { HostConnection } from "./connect.ts";
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
        reject(new WireFailure("operation-failed", "The connection to the c64-re-tools host runtime was lost during the request. Check that the Host Runtime (c64-re-tools-host) is running.")),
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
}

/** c1541.inspect: a found read also returns the file's bytes. */
export async function inspectDisk(request: InspectDiskRequest, options: ToolCallOptions = {}): Promise<C1541Result & { data?: Buffer }> {
  const file = readProjectFile(request.image);
  if (!(DISK_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new WireFailure("invalid-input", `${request.image} is not a disk image that this tool reads. Use a .d64, .d71, .d81 or .g64 file.`);
  }
  const params: ToolOperations["c1541.inspect"]["params"] = { action: request.action, imageType: file.type as DiskImageType };
  if (request.name !== undefined) params.name = request.name;
  const { result, attachments } = await callTool("c1541.inspect", params, [file.bytes], options);
  return result.action === "read" && result.found ? { ...result, data: attachments[0]! } : result;
}

/** petcat.decode: the C64 BASIC V2 listing of a project program and its machine-code handoffs. */
export async function decodeBasic(request: { program: string }, options: ToolCallOptions = {}): Promise<PetcatResult> {
  const file = readProjectFile(request.program);
  return (await callTool("petcat.decode", {}, [file.bytes], options)).result;
}

/** host.status: each native tool on the host, found and run once. */
export async function hostTools(options: ToolCallOptions = {}): Promise<ToolStatus[]> {
  return (await callTool("host.status", {}, [], options)).result.tools;
}

/** Skill scripts see failures and wire limits through the host-client, never the private protocol module. */
export {
  DISK_ACTIONS,
  JOYSTICK_DIRECTIONS,
  MAX_BASELINES,
  MAX_EXECUTION_COUNT,
  MAX_KEYBOARD_BYTES,
  MAX_MEMORY_READ,
  MAX_MEMORY_WRITE,
  MAX_TIMEOUT_FRAMES,
  WireFailure,
} from "../protocol.ts";
