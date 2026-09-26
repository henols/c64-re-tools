#!/usr/bin/env node
// transfer-paths.ts
//
// Phase 64 (D-13/XFER-03): the CLIENT's refusal of a broker-supplied
// destination name, plus the client-side snapshot name/path owner it lives
// beside. This module is a leaf: it imports only `vice-errors.mts`,
// `repo-root.ts` and `transfer-client.mts`, none of which import back.
//
// WHAT NOT TO DO:
//   - Never re-implement `validateContainedDestination()` here. Phase 65
//     (SEAM-01) moved its OWN definition to `transfer-client.mts` -- this
//     module re-exports it unchanged below, because `host-tool-endpoint.mts`
//     (Phase 65) must not import `repo-root.ts` at all (see
//     `transfer-client.mts`'s own header for the full reason), and this
//     module imports `repo-root.ts` transitively via `toolsDir()` two lines
//     down. `transfer-client.mts` is this validator's ONE authoritative
//     definition now; this file's own re-export is what keeps every
//     pre-Phase-65 importer of `transfer-paths.ts` unchanged.
import { join } from "node:path";

import { ViceError, type ViceErrorOptions } from "./vice-errors.mts";
import { toolsDir } from "./repo-root.ts";
import { validateContainedDestination, type ContainedDestinationResult } from "./transfer-client.mts";

export { validateContainedDestination };
export type { ContainedDestinationResult };

/** The one error type `snapshotPathFor()`/`snapshotMetaPathFor()` throw. */
export class StockPathError extends ViceError {
  constructor(message: string, options: ViceErrorOptions = {}) {
    super(message, options);
    this.name = "StockPathError";
  }
}

const SNAPSHOT_NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;

export type SnapshotNameResult = { ok: true; name: string } | { ok: false; reason: string };

/**
 * D-13's snapshot-name rule (an allow-list regular expression: 1 to 64
 * alphanumeric, underscore or hyphen characters), returning this
 * discriminated result instead of throwing.
 */
export function validateSnapshotName(name: unknown): SnapshotNameResult {
  if (typeof name !== "string" || !SNAPSHOT_NAME_RE.test(name)) {
    return {
      ok: false,
      reason:
        `name must be 1-64 characters of alphanumeric, underscore or hyphen only ` +
        `(matching ${SNAPSHOT_NAME_RE}) -- it is used to build a filename, so path separators, ".." and absolute ` +
        `paths are rejected outright. Got ${JSON.stringify(name)}.`,
    };
  }
  return { ok: true, name };
}

/**
 * The container path a snapshot named `name` lives at:
 * `<toolsDir>/snapshots/<name>.vsf` -- a subdirectory of the single
 * tool-written root `repo-root.ts`'s `toolsDir()` owns (D-33).
 */
export function snapshotPathFor(name: string): string {
  const verdict = validateSnapshotName(name);
  if (!verdict.ok) {
    throw new StockPathError(`snapshotPathFor: ${verdict.reason}`);
  }
  return join(toolsDir(), "snapshots", `${verdict.name}.vsf`);
}

/** The sidecar metadata path for the same snapshot: same directory, `.json`
 * extension, same sanitisation. */
export function snapshotMetaPathFor(name: string): string {
  const verdict = validateSnapshotName(name);
  if (!verdict.ok) {
    throw new StockPathError(`snapshotMetaPathFor: ${verdict.reason}`);
  }
  return join(toolsDir(), "snapshots", `${verdict.name}.json`);
}

/**
 * Resolves a per-kind subdirectory under `toolsDir()` -- the ONE place a
 * later plan in this phase (64-02..64-07) asks for a destination directory,
 * matching the ROADMAP's own cross-cutting constraint that a downloaded
 * file lands in an EXISTING per-kind subdirectory, never one new inbox
 * folder. This function has NO live caller in this phase (D-13): the
 * broker never calls it yet. Its first real caller is Phase 65, where the
 * broker genuinely names host-tool output artifacts.
 */
export function transferKindDir(kind: string): string {
  return join(toolsDir(), kind);
}
