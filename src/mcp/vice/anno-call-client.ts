#!/usr/bin/env node
// anno-call-client.ts
//
// WHY THIS FILE EXISTS: the client half of one `anno call`. It validates the
// call, confines every file it names to the workspace, finds the workspace's
// annotation project, and runs the call through the broker, which owns the
// store. It also deletes a Ghidra transfer file once the broker reports that
// the import consuming it succeeded.
//
// WHAT NOT TO DO:
//   - Never open the store, and never import a module that does: the broker
//     owns the database, and this module only ever reaches it over the
//     endpoint.
//   - Never send a path. Every argument its definition marks `clientFile` is
//     replaced by a staged reference, and the file travels as bytes.
//   - Never create a project on a read. A read in a workspace with no
//     project.json is refused; only a write registers a new project.
//   - Never delete a transfer file before the broker has reported that
//     import's success: its rows are durable only once the import returned.
import { existsSync, unlinkSync } from "node:fs";

import {
  assertAnnoTool,
  clientFileKeys,
  READ_ONLY_ANNO_VERBS,
  toolFailure,
  AnnoToolArgumentError,
  type ToolCallResult,
} from "./anno-tool-defs.mts";
import { AnnoProjectError, AnnoStorePathError, storePathWithinWorkspace } from "./anno-types.mts";
import { mintProjectId, persistProjectId, readProjectId } from "./anno-project.ts";
import { runAnnoRemote, type AnnoRemoteCall, type AnnoRemoteResult } from "./anno-remote.ts";
import { repoRoot } from "./repo-root.ts";

/** One annotation call through the broker. Tests replace it with an
 * in-process runner over a temp database. */
export type RunAnnoRemote = (call: AnnoRemoteCall) => Promise<AnnoRemoteResult>;

/** Side-effecting leaves a test may replace. */
export interface AnnoCallDeps {
  /** Deletes a consumed transfer file. Defaults to the real unlink. */
  deleteFile?: (path: string) => void;
  /** Runs one call. Defaults to the broker's endpoint. */
  runRemote?: RunAnnoRemote;
  /** The workspace root. Defaults to `repoRoot()`, read at call time. */
  workspaceRoot?: string;
}

/** A refusal from the broker or the route to it, named so a caller can tell
 * it from an argument error. */
export class AnnoBrokerError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "AnnoBrokerError";
    this.code = code;
  }
}

/** A transfer file the call consumes, and where its import sits: `[]` for a
 * direct call, else the batch indices down to the import entry. */
interface ConsumedFile {
  path: string;
  locator: number[];
}

interface StagedCall {
  args: Record<string, unknown>;
  files: Record<string, string>;
  consumed: ConsumedFile[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function argBag(args: unknown): Record<string, unknown> {
  return isPlainObject(args) ? args : {};
}

/** Confines one file argument to the workspace and refuses an absent file by
 * name, before anything is sent. */
function confineClientFile(name: string, key: string, raw: string, workspaceRoot: string): string {
  let path: string;
  try {
    path = storePathWithinWorkspace(raw, workspaceRoot);
  } catch (err) {
    if (err instanceof AnnoStorePathError) {
      throw new AnnoStorePathError(`${name} refused: ${key} ${err.message}`, { path: err.path, workspaceRoot: err.workspaceRoot });
    }
    throw err;
  }
  if (!existsSync(path)) {
    const what = key === "image" ? "image" : key === "export_path" ? "transfer file" : `file for "${key}"`;
    throw new AnnoStorePathError(
      `${name} refused: no ${what} exists at ${JSON.stringify(path)} -- a file that is not there is a different fact from a ` +
        "file with nothing in it. Nothing was read, nothing was written.",
      { path },
    );
  }
  return path;
}

/**
 * Replaces every client-file argument -- at the top level and inside every
 * batch entry, at any depth -- with a staged reference, one slot per distinct
 * file. A value that is not a non-empty string is left for the engine's own
 * validator to refuse.
 */
function stageClientFiles(name: string, args: unknown, workspaceRoot: string): StagedCall {
  const files: Record<string, string> = {};
  const slotByPath = new Map<string, string>();
  const consumed: ConsumedFile[] = [];

  const stage = (toolName: string, key: string, value: unknown, locator: number[]): unknown => {
    if (typeof value !== "string" || value.trim() === "") return value;
    const path = confineClientFile(toolName, key, value, workspaceRoot);
    let slot = slotByPath.get(path);
    if (slot === undefined) {
      slot = `f${slotByPath.size}`;
      slotByPath.set(path, slot);
      files[slot] = path;
    }
    if (key === "export_path") consumed.push({ path, locator });
    return { $file: slot };
  };

  const walk = (toolName: string, bag: Record<string, unknown>, locator: number[]): Record<string, unknown> => {
    const out: Record<string, unknown> = { ...bag };
    for (const key of clientFileKeys(toolName)) {
      if (key in out) out[key] = stage(toolName, key, out[key], locator);
    }
    if (toolName === "anno_batch_execute" && Array.isArray(out.calls)) {
      out.calls = out.calls.map((call: unknown, i: number) =>
        isPlainObject(call) && typeof call.name === "string" ? { ...call, arguments: walk(call.name, argBag(call.arguments), [...locator, i]) } : call,
      );
    }
    return out;
  };

  return { args: walk(name, argBag(args), []), files, consumed };
}

/** The import answer a locator names inside a successful result, or undefined
 * when that entry did not succeed. */
function importAnswerAt(value: unknown, locator: number[]): Record<string, unknown> | undefined {
  let node: unknown = value;
  for (const index of locator) {
    if (!isPlainObject(node) || !Array.isArray(node.results)) return undefined;
    const entry = node.results.find((r: unknown) => isPlainObject(r) && r.index === index);
    if (!isPlainObject(entry) || entry.status !== "success") return undefined;
    node = entry.result;
  }
  return isPlainObject(node) ? node : undefined;
}

/** Deletes each transfer file whose import succeeded, recording the outcome on
 * that import's own answer. A failed delete never turns a durable import into
 * a failure; it is reported beside it. */
function settleConsumedFiles(result: ToolCallResult, consumed: readonly ConsumedFile[], deleteFile: (path: string) => void): ToolCallResult {
  if (result.isError || consumed.length === 0) return result;
  const value = JSON.parse(result.content[0]!.text) as unknown;
  for (const file of consumed) {
    const answer = importAnswerAt(value, file.locator);
    if (answer === undefined) continue;
    try {
      deleteFile(file.path);
      answer.transferDeleted = true;
    } catch (err) {
      answer.transferDeleted = false;
      answer.transferDeleteError = err instanceof Error ? err.message : String(err);
    }
  }
  return { content: [{ type: "text", text: JSON.stringify(value) }], isError: false };
}

/** Turns a refusal from the broker or the route to it into the named error it
 * stands for. */
export function brokerRefusal(result: Extract<AnnoRemoteResult, { ok: false }>): Error {
  if (result.code === "unknown_project") {
    return new AnnoProjectError(
      `${result.message}. This workspace's .c64-re-tools/project.json names a project the broker does not hold -- its rows are gone ` +
        "from the broker's database. Import a saved copy with `anno import-project FILE`, or delete project.json to start a new, " +
        "empty project.",
    );
  }
  if (/unknown op: anno_run/.test(result.message)) {
    return new AnnoBrokerError(
      "the broker answering on this endpoint predates the annotation store it now owns (it does not know anno_run) -- stop it and " +
        "start the broker from this checkout.",
      "bad_request",
    );
  }
  return new AnnoBrokerError(result.message, result.code);
}

/**
 * The workspace's project id. A read in a workspace with no project.json is
 * refused and creates nothing. A write registers a new project with the
 * broker FIRST and only then persists its id, so project.json never names a
 * project the broker was never told about; two concurrent first writes agree
 * on the id that reached the file first.
 */
export async function workspaceProject(name: string, mode: "read" | "write", workspaceRoot: string, runRemote: RunAnnoRemote): Promise<string> {
  const read = readProjectId(workspaceRoot);
  if (read.present) return read.projectId;
  if (mode === "read") {
    throw new AnnoProjectError(
      `${name} refused: this workspace has no annotation project yet (${read.path} does not exist) -- nothing has been annotated ` +
        "here, so there is nothing to read. The first write creates the project.",
    );
  }
  const minted = mintProjectId();
  const registered = await runRemote({ projectId: minted, kind: "register", name: "", args: {}, files: {} });
  if (!registered.ok) throw brokerRefusal(registered);
  return persistProjectId(workspaceRoot, minted);
}

/** The runner a call uses: the injected one, or the broker's endpoint. */
export function remoteRunner(deps: { runRemote?: RunAnnoRemote }): RunAnnoRemote {
  return deps.runRemote ?? ((call) => runAnnoRemote(call));
}

/**
 * Runs one curated `anno_*` call. THE NEVER-THROW BOUNDARY: every failure --
 * an uncurated name, a malformed argument, a path outside the workspace, a
 * missing file, a missing project, a broker that does not answer -- resolves
 * as `{isError:true}` text naming the error CLASS.
 *
 * The arguments are validated before any file is read or any project is
 * touched, so a call that should not have been sent does nothing. A file the
 * call names that cannot be read refuses the WHOLE call, a batch included:
 * its bytes travel with the call, so an unreadable one means the call cannot
 * be sent.
 */
export async function runAnnoTool(name: string, args: unknown, deps: AnnoCallDeps = {}): Promise<ToolCallResult> {
  try {
    if (isPlainObject(args) && "store" in args) {
      throw new AnnoToolArgumentError(
        `${name} refused: "store" is not an argument -- the broker owns the annotation store, and a call annotates this ` +
          "workspace's own project, named by .c64-re-tools/project.json. Drop the argument.",
        { toolName: name, argument: "store" },
      );
    }
    assertAnnoTool(name, args);
    const workspaceRoot = deps.workspaceRoot ?? repoRoot();
    const staged = stageClientFiles(name, args, workspaceRoot);
    const runRemote = remoteRunner(deps);
    const projectId = await workspaceProject(name, READ_ONLY_ANNO_VERBS.includes(name) ? "read" : "write", workspaceRoot, runRemote);
    const result = await runRemote({ projectId, kind: "tool", name, args: staged.args, files: staged.files });
    if (!result.ok) throw brokerRefusal(result);
    if (result.type !== "tool") throw new AnnoBrokerError(`the broker answered a tool call with a ${result.type} answer`, "internal");
    return settleConsumedFiles(result.result, staged.consumed, deps.deleteFile ?? unlinkSync);
  } catch (err) {
    return toolFailure(name, err);
  }
}
