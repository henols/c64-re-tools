#!/usr/bin/env node
// stock-machine.ts
//
// Family D: the machine-control half of Phase 3's stock tool surface --
// `vice_machine_reset`, `vice_autostart`, `vice_disk_attach`,
// `vice_snapshot_save` and `vice_snapshot_load`. Five tools that either
// restart the machine (RESET, AUTOSTART) or hand VICE a filename THE HOST
// opens (AUTOSTART, DUMP, UNDUMP) -- every filename-carrying send in this
// file routes through stock-paths.ts's one translation wrapper (imported
// below), never a local path heuristic.
//
// WHAT NOT TO DO:
//   - Never gate or deny vice_machine_reset's hard mode. CLAUDE.md's
//     power-cycle warning is about RESOURCE_SET (0x52) writes to
//     MachineVideoStandard/VICIIModel/MachinePowerFrequency -- Phase 6
//     territory, a DIFFERENT opcode entirely. RESET (0xcc) is a distinct
//     command, and an agent-requested hard reset via RESET is exactly what
//     DIRECT-06 asks for. It needs no deny-list (RESEARCH.md Pitfall 1).
//   - Never look for a per-unit disk-attach route mid-implementation.
//     AUTOSTART (0xdd) has NO drive-unit field on the wire at all -- this is
//     a protocol gap, not a code bug you can fix by looking harder
//     (RESEARCH.md Pitfall 2).
//   - Never add a disk-detach handler here. D-13 ships that tool in Phase 7
//     through the text monitor -- grep-gated to zero occurrences of its name
//     in this file's own acceptance criteria.
//   - Never build a host path outside stock-paths.ts. Every filename this
//     file sends through the wire goes through that same one wrapper --
//     grep-gated to zero direct hostPath()/hostPathCandidates() calls here.
//   - Never construct an ok-answer outside stockAnswer(). D-06 requires
//     every stock tool answer to carry runState, and stockAnswer() is the
//     one place that is stamped.
import { resolve, dirname } from "node:path";
import { mkdirSync, existsSync, readdirSync, writeFileSync, readFileSync } from "node:fs";

import { CommandType, ResetMode, resetBody, autostartBody, dumpBody, undumpBody } from "./stock-protocol.ts";
import { stockAnswer, convertWireError, isErrorText, type StockSessionHandler } from "./stock-handler.ts";
import { withEmulatorSidePath, snapshotPathFor, snapshotMetaPathFor, sanitizeSnapshotName } from "./stock-paths.ts";

/** True iff `value` is a well-formed, generic JSON object -- not null, not
 * an array. Matches this module tree's own isPlainObject() convention
 * (vice.ts:314, stock-condition.ts:228) -- redeclared privately here, not
 * imported, per the established per-module convention. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// handleMachineReset -- RESET (0xcc), with an OPTIONAL follow-up EXIT (0xaa).
// ---------------------------------------------------------------------------

/**
 * `mode` defaults to "soft"; `run_after` defaults to **false** on stock --
 * the divergence docs/stock-vice-parity.md records. RESET has no run-after
 * field on the wire at all, so honouring `run_after: true` means sending a
 * follow-up EXIT -- fine when the agent explicitly asked for it (D-05
 * licenses this: the agent's own argument IS the request, not an
 * auto-resume), but a *default* of true would resume a machine nobody asked
 * to resume, which D-05's absolute no-unrequested-resume policy forbids.
 * This is one of only two EXIT call sites in this phase -- the other is
 * vice_execution_run.
 */
export const handleMachineReset: StockSessionHandler = async (args, session) => {
  const a = isPlainObject(args) ? args : {};

  const modeArg = a.mode;
  if (modeArg !== undefined && modeArg !== "soft" && modeArg !== "hard") {
    return isErrorText(`vice_machine_reset: mode must be "soft" or "hard", got ${JSON.stringify(modeArg)}`);
  }
  const mode: "soft" | "hard" = modeArg === "hard" ? "hard" : "soft";

  const runAfterArg = a.run_after;
  if (runAfterArg !== undefined && typeof runAfterArg !== "boolean") {
    return isErrorText(`vice_machine_reset: run_after must be a boolean, got ${typeof runAfterArg}`);
  }
  const runAfter = runAfterArg === true; // default false on stock (D-03/D-05)

  try {
    await session.client.send(CommandType.Reset, resetBody({ mode: mode === "hard" ? ResetMode.Hard : ResetMode.Soft }));

    let resumed = false;
    if (runAfter) {
      // Licensed by D-05: run_after: true is the AGENT's own explicit
      // request, not an auto-resume -- one of only two EXIT sites in this
      // phase (the other is vice_execution_run).
      await session.client.send(CommandType.Exit);
      resumed = true;
    }

    return stockAnswer(session.client, { mode, runAfter, resumed });
  } catch (err) {
    return convertWireError("vice_machine_reset", err);
  }
};

// ---------------------------------------------------------------------------
// handleAutostart -- AUTOSTART (0xdd), run flag honoured, path translated.
// ---------------------------------------------------------------------------

/**
 * `program` is refused when supplied (D-03): AUTOSTART supports only a
 * numeric `fileIndex` and has no load-by-name field, so an argument stock
 * cannot honour is refused rather than silently dropped.
 */
export const handleAutostart: StockSessionHandler = async (args, session) => {
  const a = isPlainObject(args) ? args : {};

  const path = a.path;
  if (typeof path !== "string" || path.length === 0) {
    return isErrorText("vice_autostart: path is required and must be a non-empty string");
  }

  if (a.program !== undefined) {
    return isErrorText(
      "vice_autostart: program is not supported on the stock backend -- AUTOSTART (0xdd) supports only a numeric " +
        "fileIndex field and has no load-by-name field. Use index to select a program by position instead.",
    );
  }

  const runArg = a.run;
  if (runArg !== undefined && typeof runArg !== "boolean") {
    return isErrorText(`vice_autostart: run must be a boolean, got ${typeof runArg}`);
  }
  const run = runArg === undefined ? true : runArg; // matches the fork's own default

  const indexArg = a.index;
  if (indexArg !== undefined && (typeof indexArg !== "number" || !Number.isInteger(indexArg) || indexArg < 0 || indexArg > 0xffff)) {
    return isErrorText(`vice_autostart: index must be an integer in 0..0xffff, got ${JSON.stringify(indexArg)}`);
  }
  const index = indexArg === undefined ? 0 : indexArg;

  const containerPath = resolve(path);
  try {
    const { sentPath } = await withEmulatorSidePath("vice_autostart", containerPath, (hostPath) =>
      session.client.send(CommandType.AutoStart, autostartBody({ runAfter: run, fileIndex: index, filename: hostPath })),
    );
    return stockAnswer(session.client, { path: containerPath, sentPath, run, index });
  } catch (err) {
    return convertWireError("vice_autostart", err);
  }
};

// ---------------------------------------------------------------------------
// handleDiskAttach -- AUTOSTART (0xdd) again, the D-14 approximation.
// ---------------------------------------------------------------------------

/**
 * Kept the fork's exact `unit`+`path` argument shape (D-03). Units 9-11 are
 * refused, never silently retargeted to unit 8 -- AUTOSTART is the only wire
 * route to attaching an image and its request body has NO drive-unit field
 * at all, so an agent told "attached to unit 9" when the image landed on
 * unit 8 would debug the wrong drive. See docs/stock-vice-parity.md's D-14
 * entry.
 */
export const handleDiskAttach: StockSessionHandler = async (args, session) => {
  const a = isPlainObject(args) ? args : {};

  const unit = a.unit;
  if (typeof unit !== "number" || !Number.isInteger(unit) || unit < 8 || unit > 11) {
    return isErrorText(`vice_disk_attach: unit must be an integer in 8..11, got ${JSON.stringify(a.unit)}`);
  }

  const path = a.path;
  if (typeof path !== "string" || path.length === 0) {
    return isErrorText("vice_disk_attach: path is required and must be a non-empty string");
  }

  if (unit !== 8) {
    return isErrorText(
      `vice_disk_attach: unit ${unit} cannot be targeted on the stock backend -- AUTOSTART (0xdd) is the only wire ` +
        "route to attaching a disk image on the stock binary monitor and its request body has no drive-unit field at " +
        "all, so units 9-11 cannot be targeted. Only unit 8 is reachable; the call was refused rather than silently " +
        "retargeted to unit 8 so you do not debug the wrong drive. See docs/stock-vice-parity.md's D-14 entry.",
    );
  }

  const containerPath = resolve(path);
  try {
    const { sentPath } = await withEmulatorSidePath("vice_disk_attach", containerPath, (hostPath) =>
      session.client.send(CommandType.AutoStart, autostartBody({ runAfter: false, fileIndex: 0, filename: hostPath })),
    );
    return stockAnswer(session.client, {
      unit: 8,
      path: containerPath,
      sentPath,
      approximation: "AUTOSTART with the run flag clear (D-14)",
    });
  } catch (err) {
    return convertWireError("vice_disk_attach", err);
  }
};

// ---------------------------------------------------------------------------
// handleSnapshotSave / handleSnapshotLoad -- DUMP (0x41) / UNDUMP (0x42).
// ---------------------------------------------------------------------------

const MAX_DESCRIPTION_LENGTH = 512;

/**
 * `name` is sanitised through stock-paths.ts's sanitizeSnapshotName() into a
 * workspace-internal path -- never treated as a path fragment. The client-
 * side metadata sidecar (docs/stock-vice-parity.md item 6: "DUMP writes
 * state; JSON metadata is our own bookkeeping") is written ONLY after a
 * successful DUMP, so a failed save never leaves a sidecar claiming a
 * snapshot that does not exist; a sidecar WRITE failure is reported in the
 * answer as `metadataWritten: false` with a reason, never thrown -- the
 * snapshot itself succeeded and the agent must be told exactly that (T-3-10).
 */
export const handleSnapshotSave: StockSessionHandler = async (args, session) => {
  const a = isPlainObject(args) ? args : {};

  let name: string;
  try {
    name = sanitizeSnapshotName(a.name);
  } catch (err) {
    return isErrorText(`vice_snapshot_save: ${err instanceof Error ? err.message : String(err)}`);
  }

  const descriptionArg = a.description;
  if (descriptionArg !== undefined && typeof descriptionArg !== "string") {
    return isErrorText(`vice_snapshot_save: description must be a string, got ${typeof descriptionArg}`);
  }
  if (typeof descriptionArg === "string" && descriptionArg.length > MAX_DESCRIPTION_LENGTH) {
    return isErrorText(`vice_snapshot_save: description exceeds ${MAX_DESCRIPTION_LENGTH} characters (${descriptionArg.length})`);
  }
  const description: string | null = typeof descriptionArg === "string" ? descriptionArg : null;

  const includeRomsArg = a.include_roms;
  if (includeRomsArg !== undefined && typeof includeRomsArg !== "boolean") {
    return isErrorText(`vice_snapshot_save: include_roms must be a boolean, got ${typeof includeRomsArg}`);
  }
  const includeRoms = includeRomsArg === true;

  const includeDisksArg = a.include_disks;
  if (includeDisksArg !== undefined && typeof includeDisksArg !== "boolean") {
    return isErrorText(`vice_snapshot_save: include_disks must be a boolean, got ${typeof includeDisksArg}`);
  }
  const includeDisks = includeDisksArg === true;

  const containerPath = snapshotPathFor(name);
  // VICE opens the file for writing and will not create the directory --
  // the same mkdirSync-before-translate ordering vice-sync.ts's screenshot()
  // already uses.
  mkdirSync(dirname(containerPath), { recursive: true });

  let sentPath: string;
  try {
    const result = await withEmulatorSidePath("vice_snapshot_save", containerPath, (hostPath) =>
      session.client.send(CommandType.Dump, dumpBody({ saveRoms: includeRoms, saveDisks: includeDisks, filename: hostPath })),
    );
    sentPath = result.sentPath;
  } catch (err) {
    return convertWireError("vice_snapshot_save", err);
  }

  // DUMP succeeded -- write the metadata sidecar. A write failure here is
  // reported, never thrown: the snapshot itself is good.
  const metadataPath = snapshotMetaPathFor(name);
  let metadataWritten = true;
  let metadataFailureReason: string | null = null;
  try {
    const metadata = {
      name,
      description,
      createdAt: new Date().toISOString(),
      includeRoms,
      includeDisks,
      viceVersion: session.versionQuad,
      backend: "stock" as const,
      snapshotPath: containerPath,
    };
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  } catch (err) {
    metadataWritten = false;
    metadataFailureReason = err instanceof Error ? err.message : String(err);
  }

  return stockAnswer(session.client, {
    name,
    path: containerPath,
    sentPath,
    includeRoms,
    includeDisks,
    metadataWritten,
    ...(metadataFailureReason !== null ? { metadataFailureReason } : {}),
    metadataPath,
  });
};

/**
 * Refuses with an explanatory message, listing the `.vsf` basenames present
 * in the snapshot directory, when the named snapshot file does not exist --
 * the useful half of what the deleted `vice_snapshot_list` used to provide
 * (D-16 deleted the tool because it had no consumer), delivered at the point
 * of failure rather than as its own tool.
 *
 * Loading a snapshot REPLACES THE ENTIRE MACHINE STATE, so this handler's
 * `runState` reflects whatever the event stream reports after UNDUMP and
 * nothing is asserted about it here.
 */
export const handleSnapshotLoad: StockSessionHandler = async (args, session) => {
  const a = isPlainObject(args) ? args : {};

  let name: string;
  try {
    name = sanitizeSnapshotName(a.name);
  } catch (err) {
    return isErrorText(`vice_snapshot_load: ${err instanceof Error ? err.message : String(err)}`);
  }

  const containerPath = snapshotPathFor(name);
  if (!existsSync(containerPath)) {
    const dir = dirname(containerPath);
    let available: string[] = [];
    try {
      available = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".vsf")) : [];
    } catch {
      available = [];
    }
    return isErrorText(
      `vice_snapshot_load: no snapshot named "${name}" exists at ${containerPath}. ` +
        (available.length > 0 ? `Available snapshots: ${available.join(", ")}` : "No snapshots exist yet."),
    );
  }

  let sentPath: string;
  let programCounter: number | null = null;
  try {
    const result = await withEmulatorSidePath("vice_snapshot_load", containerPath, (hostPath) =>
      session.client.send(CommandType.Undump, undumpBody({ filename: hostPath })),
    );
    sentPath = result.sentPath;
    const reply = result.result;
    if (reply && typeof reply === "object" && "type" in reply && (reply as { type: unknown }).type === "undump") {
      programCounter = (reply as { programCounter: number }).programCounter;
    }
  } catch (err) {
    return convertWireError("vice_snapshot_load", err);
  }

  const metadataPath = snapshotMetaPathFor(name);
  let metadata: { description?: string | null; createdAt?: string } | null = null;
  try {
    if (existsSync(metadataPath)) {
      const parsed: unknown = JSON.parse(readFileSync(metadataPath, "utf8"));
      if (isPlainObject(parsed)) {
        metadata = {
          description: typeof parsed.description === "string" ? parsed.description : null,
          createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : undefined,
        };
      }
    }
  } catch {
    metadata = null; // a missing or unparsable sidecar is reported as null, never an error
  }

  return stockAnswer(session.client, { name, path: containerPath, sentPath, programCounter, metadata });
};
