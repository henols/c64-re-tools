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
//   - Never call rewriteArguments() from a stock handler. It lives INSIDE
//     forwardToVice() (vice-proxy.ts, around line 2773) -- the one function
//     Phase 2's D-09 says the stock path must never touch -- and its own
//     comment inverts on stock: what is correct for the fork's derived tools
//     is exactly wrong here.
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
import { dirname, join } from "node:path";

import { ViceError, type ViceErrorOptions } from "./vice.ts";
import { repoRoot } from "./repo-root.ts";
import { isInsideContainer } from "./container-guard.mts";
import { tryHostPaths } from "./hostpath.ts";
import { ErrorCode, StockProtocolError } from "./stock-protocol.ts";

/** The one error type this module ever throws -- never a bare Error,
 * matching vice.ts's established ViceError hierarchy (stock-address.ts's
 * StockAddressError is the sibling precedent). */
export class StockPathError extends ViceError {
  constructor(message: string, options: ViceErrorOptions = {}) {
    super(message, options);
    this.name = "StockPathError";
  }
}

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
// Snapshot name sanitisation and path construction -- T-3-05's mitigation.
// ---------------------------------------------------------------------------

const SNAPSHOT_NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Refuses anything not matching /^[A-Za-z0-9_-]{1,64}$/ -- the name is used
 * to build a filename, so path separators, `..` and absolute paths are
 * rejected outright rather than sanitised. Matches the fork's own documented
 * constraint ("alphanumeric, underscore, hyphen only"). This is the T-3-05
 * control: a snapshot `name` is never treated as a path fragment.
 */
export function sanitizeSnapshotName(name: unknown): string {
  if (typeof name !== "string" || !SNAPSHOT_NAME_RE.test(name)) {
    throw new StockPathError(
      `sanitizeSnapshotName: name must be 1-64 characters of alphanumeric, underscore or hyphen only ` +
        `(matching ${SNAPSHOT_NAME_RE}) -- it is used to build a filename, so path separators, ".." and absolute ` +
        `paths are rejected outright. Got ${JSON.stringify(name)}.`,
    );
  }
  return name;
}

/**
 * The container path a snapshot named `name` lives at:
 * `<repoRoot>/.vice-snapshots/<name>.vsf`. The directory is inside the
 * workspace rather than under `~/.config/vice/` (the fork's own location)
 * because only a workspace path is inside hostpath.ts's bind-mount mapping
 * -- anything outside it cannot be translated for the host at all -- and
 * keeping it inside the workspace makes workspace escape structurally
 * impossible rather than merely checked (T-3-05).
 */
export function snapshotPathFor(name: string): string {
  return join(repoRoot(), ".vice-snapshots", `${sanitizeSnapshotName(name)}.vsf`);
}

/** The sidecar metadata path for the same snapshot: same directory, `.json`
 * extension, same sanitisation. */
export function snapshotMetaPathFor(name: string): string {
  return join(repoRoot(), ".vice-snapshots", `${sanitizeSnapshotName(name)}.json`);
}

// Re-exported so a caller building a directory before translating (Task 3's
// handleSnapshotSave, matching vice-sync.ts's screenshot()'s own
// mkdirSync(dirname(containerPath), { recursive: true })-before-translate
// ordering) never needs a second import specifier for dirname().
export { dirname };
