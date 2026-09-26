#!/usr/bin/env node
// anno-call-client.ts
//
// WHY THIS FILE EXISTS: the client half of one `anno call`. It confines every
// path the call names to the workspace, reads those files, and hands the
// engine (`anno-tools.ts`) staged bytes, so the engine never sees a path. It
// also deletes a Ghidra transfer file once the engine reports that the import
// consuming it succeeded.
//
// WHAT NOT TO DO:
//   - Never pass a path to the engine. Every argument its definition marks
//     `clientFile` is replaced by a staged reference before the call leaves.
//   - Never delete a transfer file before the engine has reported that import's
//     success: its rows are durable only once the import has returned.
//   - Never create the store a verb was asked to use. "The annotations are
//     gone" and "there are no annotations" must not read the same.
import { existsSync, readFileSync, statSync, unlinkSync } from "node:fs";

import { closeStore, openStore } from "./anno-store.ts";
import {
  assertAnnoTool,
  clientFileKeys,
  READ_ONLY_ANNO_VERBS,
  runAnnoToolOnHandle,
  toolFailure,
  AnnoToolArgumentError,
  type AnnoInputFile,
  type ToolCallResult,
} from "./anno-tools.ts";
import { AnnoStorePathError, storePathWithinWorkspace } from "./anno-types.ts";
import { repoRoot } from "./repo-root.ts";

/** Side-effecting leaves a test may replace. */
export interface AnnoCallDeps {
  /** Deletes a consumed transfer file. Defaults to the real unlink. */
  deleteFile?: (path: string) => void;
}

/** A transfer file the call consumes, and where its import sits: `[]` for a
 * direct call, else the batch indices down to the import entry. */
interface ConsumedFile {
  path: string;
  locator: number[];
}

interface StagedCall {
  args: Record<string, unknown>;
  inputs: Map<string, AnnoInputFile>;
  consumed: ConsumedFile[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function argBag(args: unknown): Record<string, unknown> {
  return isPlainObject(args) ? args : {};
}

/** Narrows `store` to a non-empty string; containment is `workspacePath()`'s. */
function assertStoreArg(name: string, args: unknown): string {
  const store = argBag(args).store;
  if (typeof store !== "string" || store.trim() === "") {
    throw new AnnoToolArgumentError(
      `${name} refused: "store" must be a non-empty string naming an annotation store -- every anno_* verb names its own store (D-06), ` +
        "because there is no ambient current store to inherit.",
      { toolName: name, argument: "store" },
    );
  }
  return store;
}

/** Confines a caller path to the workspace root, read at call time so one test
 * process can point several roots at this code. */
function workspacePath(raw: string): string {
  return storePathWithinWorkspace(raw, repoRoot());
}

/** Confines and reads one file argument, refusing an absent file by name. */
function readClientFile(name: string, key: string, raw: string): { path: string; bytes: Uint8Array } {
  let path: string;
  try {
    path = workspacePath(raw);
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
  return { path, bytes: new Uint8Array(readFileSync(path)) };
}

/**
 * Replaces every client-file argument -- at the top level and inside every
 * batch entry, at any depth -- with a staged reference, reading each distinct
 * file once. A value that is not a non-empty string is left for the engine's
 * own validator to refuse.
 */
function stageClientFiles(name: string, args: unknown): StagedCall {
  const inputs = new Map<string, AnnoInputFile>();
  const slotByPath = new Map<string, string>();
  const consumed: ConsumedFile[] = [];

  const stage = (toolName: string, key: string, value: unknown, locator: number[]): unknown => {
    if (typeof value !== "string" || value.trim() === "") return value;
    const { path, bytes } = readClientFile(toolName, key, value);
    let slot = slotByPath.get(path);
    if (slot === undefined) {
      slot = `f${inputs.size}`;
      slotByPath.set(path, slot);
      inputs.set(slot, { name: path, bytes });
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

  return { args: walk(name, argBag(args), []), inputs, consumed };
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

/** Refuses an absent store BY NAME, returning the inode the later guard
 * compares against. */
function assertStorePresent(name: string, storePath: string): number {
  if (!existsSync(storePath)) {
    throw new AnnoStorePathError(
      `${name} refused: no annotation store exists at ${JSON.stringify(storePath)} -- refusing to CREATE one, because "the ` +
        'annotations are gone" and "there are no annotations" must not read the same. Create the store deliberately first.',
      { path: storePath },
    );
  }
  return statSync(storePath).ino;
}

/** Closes the window between the existence check and the open: a file
 * unlinked and recreated in between is a different inode. */
function assertSameFile(name: string, storePath: string, inodeBefore: number): void {
  if (statSync(storePath).ino !== inodeBefore) {
    throw new AnnoStorePathError(
      `${name} refused: the file at ${JSON.stringify(storePath)} was replaced between the existence check and the open, so this ` +
        "call would have written into a store it created itself rather than the one it was asked to annotate. Nothing was written.",
      { path: storePath },
    );
  }
}

/**
 * Runs one curated `anno_*` call. THE NEVER-THROW BOUNDARY: every failure --
 * an uncurated name, a malformed argument, a path outside the workspace, a
 * missing file, a corrupt store -- resolves as `{isError:true}` text naming
 * the error CLASS.
 *
 * The arguments are validated before any file is read, so a call that should
 * not have been sent reads nothing. A file the call names that cannot be read
 * refuses the WHOLE call, a batch included: its bytes are sent with the call,
 * so an unreadable one means the call cannot be sent.
 */
export async function runAnnoTool(name: string, args: unknown, deps: AnnoCallDeps = {}): Promise<ToolCallResult> {
  try {
    assertAnnoTool(name, args);
    const storePath = workspacePath(assertStoreArg(name, args));
    const inodeBefore = assertStorePresent(name, storePath);
    const staged = stageClientFiles(name, args);
    delete staged.args.store;
    const handle = openStore(storePath, { workspaceRoot: repoRoot(), mustExist: READ_ONLY_ANNO_VERBS.includes(name) });
    try {
      assertSameFile(name, storePath, inodeBefore);
      const result = await runAnnoToolOnHandle(handle, name, staged.args, staged.inputs);
      return settleConsumedFiles(result, staged.consumed, deps.deleteFile ?? unlinkSync);
    } finally {
      closeStore(handle);
    }
  } catch (err) {
    return toolFailure(name, err);
  }
}
