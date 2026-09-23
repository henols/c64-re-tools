#!/usr/bin/env node
// transfer-paths.ts
//
// STUB -- RED phase only. Real implementation lands in the GREEN commit
// that follows. This stub exists solely so transfer-paths.test.mts loads
// successfully and its assertions fail as REAL per-test failures (per
// gsd_run check tdd-red-evidence's fixture_or_load_failure classification --
// a module that does not exist at all produces a file-named load crash,
// not a target-test assertion failure, which is INVALID_RED).
import { ViceError, type ViceErrorOptions } from "./vice-errors.ts";

export class StockPathError extends ViceError {
  constructor(message: string, options: ViceErrorOptions = {}) {
    super(message, options);
    this.name = "StockPathError";
  }
}

export type ContainedDestinationResult = { ok: true; resolved: string } | { ok: false; reason: string };

export function validateContainedDestination(_candidate: string, _rootDir: string): ContainedDestinationResult {
  throw new Error("not implemented");
}

export type SnapshotNameResult = { ok: true; name: string } | { ok: false; reason: string };

export function validateSnapshotName(_name: unknown): SnapshotNameResult {
  throw new Error("not implemented");
}

export function snapshotPathFor(_name: string): string {
  throw new Error("not implemented");
}

export function snapshotMetaPathFor(_name: string): string {
  throw new Error("not implemented");
}

export function transferKindDir(_kind: string): string {
  throw new Error("not implemented");
}
