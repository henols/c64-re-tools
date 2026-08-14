#!/usr/bin/env node
// stock-machine.ts
//
// Family D: the machine-control half of Phase 3's stock tool surface --
// `vice_machine_reset`, `vice_autostart`, `vice_disk_attach`,
// `vice_snapshot_save` and `vice_snapshot_load`. Five tools that either
// restart the machine (RESET, AUTOSTART) or hand VICE a filename THE HOST
// opens (AUTOSTART, DUMP, UNDUMP) -- every filename-carrying send in this
// file routes through stock-paths.ts's withEmulatorSidePath(), never a local
// path heuristic.
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
//     file sends through the wire goes through withEmulatorSidePath() --
//     grep-gated to zero direct hostPath()/hostPathCandidates() calls here.
//   - Never construct an ok-answer outside stockAnswer(). D-06 requires
//     every stock tool answer to carry runState, and stockAnswer() is the
//     one place that is stamped.
import { resolve } from "node:path";

import { CommandType, ResetMode, resetBody, autostartBody } from "./stock-protocol.ts";
import { stockAnswer, convertWireError, isErrorText, type StockSessionHandler } from "./stock-handler.ts";
import { withEmulatorSidePath } from "./stock-paths.ts";

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
