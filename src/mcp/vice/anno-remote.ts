#!/usr/bin/env node
// anno-remote.ts
//
// WHY THIS FILE EXISTS: the client half of one annotation call over the
// broker's fixed endpoint. It stages the call's arguments and input files,
// runs the call for one project id, and downloads the files a report
// produced. The broker's annotation worker does the rest.
//
// WHAT NOT TO DO:
//   - Never send a path. A staged file travels under its basename only, and
//     the arguments name files by slot.
//   - Never leave the call's scratch directory behind: /tmp here is RAM with
//     cleanup disabled, so it is removed in a `finally` on every path.
//   - Never start a broker. An endpoint nobody answers is refused by name,
//     with the command that starts one.
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { dialAnnoSession } from "./broker-endpoint.mts";
import { transferFileOverEndpoint } from "./transfer-client.mts";
import type { ToolCallResult } from "./anno-tools.mts";

/** How long a staging round trip may take. */
const ANNO_STAGE_REPLY_TIMEOUT_MS = 30_000;
/** How long the call itself may take: a large import or report is minutes,
 * never hours. */
const ANNO_RUN_REPLY_TIMEOUT_MS = 600_000;

/** One annotation call. \`args\` names each input file by slot (\`{ $file }\`);
 * \`files\` maps each slot to the local path it stages, already confined. */
export interface AnnoRemoteCall {
  projectId: string;
  kind: "register" | "tool" | "report";
  name: string;
  args: Record<string, unknown>;
  files: Record<string, string>;
}

/** A report's output file. */
export interface AnnoRemoteFile {
  name: string;
  bytes: Uint8Array;
}

/** The call's answer. \`code\` on a refusal: \`unreachable\` (no broker
 * answered), \`unknown_project\`, \`refused\` (a complete message), \`failed\` (a
 * message to name after the verb) or \`internal\`. */
export type AnnoRemoteResult =
  | { ok: true; type: "register" }
  | { ok: true; type: "tool"; result: ToolCallResult }
  | { ok: true; type: "report"; json: unknown; files: AnnoRemoteFile[] }
  | { ok: false; code: string; message: string };

/** Where the endpoint is, and where scratch goes; tests point both
 * elsewhere. */
export interface AnnoRemoteOptions {
  port?: number;
  candidates?: readonly string[];
  tmpRoot?: string;
}

/** Runs one annotation call through the broker. Never throws. */
export async function runAnnoRemote(call: AnnoRemoteCall, options: AnnoRemoteOptions = {}): Promise<AnnoRemoteResult> {
  const endpoint = { port: options.port, candidates: options.candidates };
  const dialed = await dialAnnoSession(endpoint);
  if (!dialed.ok) return { ok: false, code: "unreachable", message: dialed.reason };
  const session = dialed.session;
  const scratch = mkdtempSync(join(options.tmpRoot ?? tmpdir(), "anno-call-"));
  try {
    const argsPath = join(scratch, "args.json");
    writeFileSync(argsPath, JSON.stringify(call.args));

    // Tree 0 holds args.json; each input gets a tree of its own, so two
    // inputs that share a basename never collide.
    const slots = Object.entries(call.files);
    const localPaths = [argsPath, ...slots.map(([, path]) => path)];
    const manifest = localPaths.map((path, tree) => ({ tree, rel: tree === 0 ? "args.json" : basename(path), byteLength: statSync(path).size }));
    const staged = await session.stage(manifest, ANNO_STAGE_REPLY_TIMEOUT_MS);
    if (!staged.ok) return { ok: false, code: "failed", message: staged.reason };
    for (let i = 0; i < localPaths.length; i++) {
      const upload = await transferFileOverEndpoint({ direction: "upload", handle: staged.files[i]!, sourcePath: localPaths[i]! }, endpoint);
      if (!upload.ok) return { ok: false, code: "failed", message: upload.reason };
    }

    const reply = await session.run(
      {
        request: staged.request,
        project_id: call.projectId,
        kind: call.kind,
        name: call.name,
        args_file: staged.files[0],
        inputs: slots.map(([slot], i) => ({ slot, handle: staged.files[i + 1] })),
      },
      ANNO_RUN_REPLY_TIMEOUT_MS,
    );
    if (!reply.ok) return { ok: false, code: reply.code ?? "failed", message: reply.reason };
    const answer = reply.response;
    if (answer.ok !== true) {
      return { ok: false, code: typeof answer.code === "string" ? answer.code : "failed", message: typeof answer.message === "string" ? answer.message : "the broker refused the call" };
    }
    if (answer.type === "register") return { ok: true, type: "register" };
    if (answer.type === "tool") return { ok: true, type: "tool", result: answer.result as ToolCallResult };

    const files: AnnoRemoteFile[] = [];
    const listed = Array.isArray(answer.files) ? (answer.files as { name: string; handle: string }[]) : [];
    for (const [i, file] of listed.entries()) {
      const destPath = join(scratch, `out-${i}`);
      const download = await transferFileOverEndpoint({ direction: "download", handle: file.handle, destPath }, endpoint);
      if (!download.ok) return { ok: false, code: "failed", message: download.reason };
      files.push({ name: file.name, bytes: new Uint8Array(readFileSync(destPath)) });
    }
    return { ok: true, type: "report", json: answer.json, files };
  } finally {
    session.close();
    rmSync(scratch, { recursive: true, force: true });
  }
}
