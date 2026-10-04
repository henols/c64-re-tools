// Short-lived typed native-tool requests for skill scripts (04 §4, 16). Each
// request opens its own "tool" connection, sends bytes, and closes.

import {
  ProtocolError,
  validateToolResult,
  WireFailure,
  type AcmeResult,
  type ToolOperation,
  type ToolOperations,
} from "../protocol.ts";
import { HostConnection } from "./connect.ts";
import { readProjectTree } from "./transfer.ts";

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
