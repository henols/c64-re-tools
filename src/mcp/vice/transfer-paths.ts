#!/usr/bin/env node
// transfer-paths.ts
//
// Phase 64 (D-13/XFER-03): the CLIENT's refusal of a broker-supplied
// destination name, plus the client-side snapshot name/path owner it lives
// beside. Before this phase, `stock-paths.ts` owned both the snapshot-name
// allow-list rule AND the host/container path-translation wrapper in one
// file; this phase splits the two apart because `stock-machine.ts`'s four
// migrating handlers (Phase 64-06) need the snapshot name/path helpers but
// must stop importing `stock-paths.ts` at all (D-18's convergence metric).
//
// WHY `StockPathError` IS DEFINED HERE, NOT IN `stock-paths.ts`: this
// module's `snapshotPathFor()`/`snapshotMetaPathFor()` must keep throwing
// the SAME class `stock-paths.test.ts`'s existing `instanceof StockPathError`
// assertions check, and `stock-paths.ts` needs to import these two functions
// FROM here (D-13/D-18 -- see that file's own header). If the class stayed
// defined in `stock-paths.ts`, this module would have to import it back FROM
// there, closing an import cycle (`stock-paths.ts` -> `transfer-paths.ts` ->
// `stock-paths.ts`) -- exactly the shape this codebase's own CONVENTIONS
// deliberately avoid elsewhere (`repo-root.ts`/`install-resources.ts`,
// `stock-dispatch.ts`/`stock-*.ts`). Defining the class here instead keeps
// this module a leaf with respect to `stock-paths.ts` (it imports only
// `vice-errors.ts` and `repo-root.ts`, neither of which import back), and
// `stock-paths.ts` re-exports the SAME class value, so every existing
// `instanceof` check keeps passing unchanged.
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

import { ViceError, type ViceErrorOptions } from "./vice-errors.ts";
import { toolsDir } from "./repo-root.ts";
import { validateContainedDestination, type ContainedDestinationResult } from "./transfer-client.mts";

export { validateContainedDestination };
export type { ContainedDestinationResult };

/** The one error type `snapshotPathFor()`/`snapshotMetaPathFor()` throw, and
 * the one `stock-paths.ts`'s own `sanitizeSnapshotName()` and
 * `withEmulatorSidePath()` throw too, via `stock-paths.ts`'s re-export of
 * this SAME class -- see this module's own header for why the definition
 * lives here rather than there. */
export class StockPathError extends ViceError {
  constructor(message: string, options: ViceErrorOptions = {}) {
    super(message, options);
    this.name = "StockPathError";
  }
}

const SNAPSHOT_NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;

export type SnapshotNameResult = { ok: true; name: string } | { ok: false; reason: string };

/**
 * D-13's snapshot-name rule -- moved here verbatim from `stock-paths.ts`'s
 * own `sanitizeSnapshotName()` (the SAME allow-list regular expression, the
 * SAME 1-to-64 length bound, the SAME alphanumeric-underscore-hyphen
 * character class), returning this discriminated result instead of
 * throwing. `stock-paths.ts`'s own `sanitizeSnapshotName()` obtains its
 * verdict by calling this function and throws `StockPathError` itself --
 * one rule, two calling conventions.
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
 * tool-written root `repo-root.ts`'s `toolsDir()` owns (D-33). Moved
 * verbatim from `stock-paths.ts` (D-13/D-18); re-exported, unchanged in
 * behaviour, from `stock-paths.ts` itself so its existing consumers
 * (`stock-paths.test.ts`, `stock-broker-live.test.ts`) keep importing it
 * from where they import it today.
 */
export function snapshotPathFor(name: string): string {
  const verdict = validateSnapshotName(name);
  if (!verdict.ok) {
    throw new StockPathError(`snapshotPathFor: ${verdict.reason}`);
  }
  return join(toolsDir(), "snapshots", `${verdict.name}.vsf`);
}

/** The sidecar metadata path for the same snapshot: same directory, `.json`
 * extension, same sanitisation. Moved verbatim from `stock-paths.ts`. */
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
