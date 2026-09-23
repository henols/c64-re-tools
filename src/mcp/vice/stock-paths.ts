#!/usr/bin/env node
// stock-paths.ts
//
// D-17's ONE declared table and the ONE translation wrapper: this file is the
// single place a stock handler turns a container-side path into the
// host-side path stock VICE's binary monitor itself opens. Four tools --
// `vice_autostart` (AUTOSTART's filename), `vice_disk_attach` (AUTOSTART's
// filename, the D-14 approximation), `vice_snapshot_save` (DUMP's filename,
// client-constructed from `name`), `vice_snapshot_load` (UNDUMP's filename,
// also client-constructed) -- carry a filename VICE opens ON THE HOST, so
// those four, and only those four, translate through here.
//
// WHY THIS FILE EXISTS: this is the MIRROR IMAGE of Phase 4's DERIV-07
// hazard -- there, translating a client-side-derived path is the bug; here,
// NOT translating an emulator-side path is the bug. D-17 puts both
// directions in one legible place so a future implementer working either
// side finds this comment.
//
// WHAT NOT TO DO:
//   - Never merge this file's emulator-side translation with, or replace it
//     by, a general argument-rewriting pass applied before dispatch. Stock
//     tool calls no longer go through any such pass -- vice-proxy.ts's own
//     fork-only per-call path-rewriter (and the generic forwarding function
//     that ran it) is deleted outright -- and reintroducing one would
//     re-create exactly the inversion this file's header names: what a
//     general rewriter does for a client-side-derived path is precisely
//     wrong for the four emulator-side filenames this file translates.
//   - Never build a host path with a local heuristic (a hand-rolled prefix
//     swap, a hardcoded mount guess, anything not routed through
//     hostpath.ts's own hostPathCandidates()/tryHostPaths()). hostpath.ts is
//     the one seam that owns bind-mount discovery.
//   - Never add a CLIENT-SIDE derivation to STOCK_EMULATOR_SIDE_PATH_TOOLS.
//     Phase 5's screenshots are decoded client-side (the INDEXED8 framebuffer
//     arrives over the wire and is encoded to PNG in this process) and must
//     NEVER be translated -- adding a client-side-derived tool to this table
//     would be the exact mirror-image bug this file's header exists to name.
//     A future Phase 5 implementer who is tempted to route a screenshot path
//     through withEmulatorSidePath() should stop and re-read this paragraph.
import { dirname } from "node:path";

import { repoRoot } from "./repo-root.ts";
import { isInsideContainer } from "./container-guard.mts";
import { tryHostPaths } from "./hostpath.ts";
import { ErrorCode, StockProtocolError } from "./stock-protocol.ts";
// Phase 64 (D-13/D-18): the snapshot-name rule and the client-side
// snapshot path builders moved to transfer-paths.ts, so stock-machine.ts's
// four migrating handlers (Plan 64-06) can import them without reaching
// this module's host/container translation seam at all. StockPathError's
// own class DEFINITION moved there too -- see transfer-paths.ts's own
// header comment for why (avoiding an import cycle back to this file).
// Every re-export below keeps this module's PUBLIC SURFACE unchanged for
// its current consumers (stock-paths.test.ts, stock-broker-live.test.ts):
// nothing is deleted from stock-paths.ts, per D-13 and the phase boundary
// (RM-01, Phase 66, is what eventually deletes this file).
import { StockPathError, validateSnapshotName, snapshotPathFor, snapshotMetaPathFor } from "./transfer-paths.ts";

export { StockPathError, snapshotPathFor, snapshotMetaPathFor };

// ---------------------------------------------------------------------------
// D-17's declared table -- the complete Phase 3 set. Exactly four entries;
// a test asserts the size and membership so a future addition (or removal)
// is a deliberate, reviewed edit to this literal, not a silent drift.
// ---------------------------------------------------------------------------

export const STOCK_EMULATOR_SIDE_PATH_TOOLS: ReadonlySet<string> = new Set([
  "vice_autostart", // AUTOSTART (0xdd) request body's filename field
  "vice_disk_attach", // AUTOSTART (0xdd) again -- the D-14 approximation
  "vice_snapshot_save", // DUMP (0x41) request body's filename field
  "vice_snapshot_load", // UNDUMP (0x42) request body's filename field
]);

// ---------------------------------------------------------------------------
// withEmulatorSidePath() -- the one translation wrapper.
// ---------------------------------------------------------------------------

/**
 * Translates `containerPath` to a host path and calls `send(hostPath)`,
 * returning both the callee's result and the path actually put on the wire.
 *
 * Refuses any `toolName` not in STOCK_EMULATOR_SIDE_PATH_TOOLS -- a handler
 * cannot opt itself into translation without being declared in the table
 * above, so the declared set and the actual behaviour can never drift apart.
 *
 * On a bare host (`isInsideContainer()` false), `containerPath` already IS
 * the host path -- calling hostPathCandidates()'s mountinfo guesser there
 * would fabricate a wrong path (with only a stderr warning to show for it),
 * so this branch calls `send(containerPath)` directly and reports
 * `sentPath: containerPath` unchanged.
 *
 * Inside a container, translates via `tryHostPaths()` with
 * `workspaceRoot: repoRoot()` and a `fatal` predicate that returns `false`
 * ONLY for a StockProtocolError whose errorCode is ErrorCode.CmdFailure
 * (0x8f) -- "the monitor could not open that file", the one genuine
 * wrong-path signal that licenses retrying the next candidate host path.
 * Every other rejection (a framing error, a connection failure, a timeout)
 * returns `true` (fatal), stopping probing immediately rather than retrying
 * five more candidates against a connection that is not coming back.
 */
export async function withEmulatorSidePath<T>(
  toolName: string,
  containerPath: string,
  send: (path: string) => Promise<T>,
): Promise<{ result: T; sentPath: string }> {
  if (!STOCK_EMULATOR_SIDE_PATH_TOOLS.has(toolName)) {
    throw new StockPathError(
      `withEmulatorSidePath: ${toolName} is not declared in STOCK_EMULATOR_SIDE_PATH_TOOLS -- only vice_autostart, ` +
        `vice_disk_attach, vice_snapshot_save and vice_snapshot_load carry an emulator-side path argument (D-17).`,
    );
  }

  if (!isInsideContainerFn()) {
    // On a bare host, containerPath already IS the host path -- see this
    // function's own header comment above for why the mountinfo guesser
    // must not run here.
    const result = await send(containerPath);
    return { result, sentPath: containerPath };
  }

  const fatal = (err: unknown): boolean => {
    if (err instanceof StockProtocolError && err.errorCode === ErrorCode.CmdFailure) {
      return false; // the one genuine wrong-path signal -- keep probing
    }
    return true; // anything else stops probing immediately
  };

  const { result, hostPath } = await tryHostPaths(containerPath, send, { workspaceRoot: repoRoot(), fatal });
  return { result, sentPath: hostPath };
}

// ---------------------------------------------------------------------------
// Test-only injection point for isInsideContainer(), following
// stock-address.ts's setSymbolResolver() / stock-runstate.ts's
// resetRunStateTrackersForTest() precedent: a module-level setter rather than
// widening withEmulatorSidePath()'s own public signature (which the plan
// fixes at exactly three parameters). Production code never calls this;
// the default below is the real isInsideContainer() from container-guard.mts.
// ---------------------------------------------------------------------------

let isInsideContainerFn: () => boolean = () => isInsideContainer();

/** Test-only: overrides the isInsideContainer() check withEmulatorSidePath()
 * consults, without touching container-guard.mts's own memoised verdict or
 * widening withEmulatorSidePath()'s public signature. Pass `null` to restore
 * the real check. */
export function setIsInsideContainerForTest(fn: (() => boolean) | null): void {
  isInsideContainerFn = fn ?? (() => isInsideContainer());
}

// ---------------------------------------------------------------------------
// Snapshot name sanitisation -- T-3-05's mitigation. The RULE itself now
// lives in transfer-paths.ts's validateSnapshotName() (D-13/D-18); this
// function keeps its EXISTING throwing calling convention and message text
// unchanged for its current callers, obtaining its verdict from that one
// shared definition rather than re-testing the pattern here. snapshotPathFor()
// and snapshotMetaPathFor() are no longer defined in this file at all --
// see the re-export at this module's top, from transfer-paths.ts directly.
// ---------------------------------------------------------------------------

/**
 * Refuses anything not matching the shared snapshot-name allow-list -- the
 * name is used to build a filename, so path separators, `..` and absolute
 * paths are rejected outright rather than sanitised. Matches the fork's own
 * documented constraint ("alphanumeric, underscore, hyphen only"). This is
 * the T-3-05 control: a snapshot `name` is never treated as a path fragment.
 */
export function sanitizeSnapshotName(name: unknown): string {
  const verdict = validateSnapshotName(name);
  if (!verdict.ok) {
    throw new StockPathError(`sanitizeSnapshotName: ${verdict.reason}`);
  }
  return verdict.name;
}

// Re-exported so a caller building a directory before translating (Task 3's
// handleSnapshotSave, matching vice-sync.ts's screenshot()'s own
// mkdirSync(dirname(containerPath), { recursive: true })-before-translate
// ordering) never needs a second import specifier for dirname().
export { dirname };
