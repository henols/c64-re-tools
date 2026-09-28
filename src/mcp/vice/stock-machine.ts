#!/usr/bin/env node
// stock-machine.ts
//
// Family D: the machine-control half of Phase 3's stock tool surface --
// `vice_machine_reset`, `vice_autostart`, `vice_disk_attach`,
// `vice_snapshot_save` and `vice_snapshot_load`. Five tools that either
// restart the machine (RESET, AUTOSTART) or hand VICE a filename THE HOST
// opens (AUTOSTART, DUMP, UNDUMP). Phase 64 (XFER-01/XFER-02/XFER-08) moved
// all four file-carrying tools onto the broker's own file-transfer protocol:
// the filename each send carries is a broker-MINTED name from
// `session.brokerControl.stageFile()`, never a path this client translated
// or constructed, and the bytes themselves cross the socket through
// `session.deps.transferFile` rather than a shared bind mount.
//
// WHAT NOT TO DO:
//   - Never gate or deny vice_machine_reset's hard mode. CLAUDE.md's
//     power-cycle warning is about RESOURCE_SET (0x52) writes to
//     MachineVideoStandard/VICIIModel/MachinePowerFrequency -- the CUT
//     vice_machine_config_get/set pair's resources, a DIFFERENT opcode entirely. RESET (0xcc) is a distinct
//     command, and an agent-requested hard reset via RESET is exactly what
//     DIRECT-06 asks for. It needs no deny-list (RESEARCH.md Pitfall 1).
//   - Never look for a per-unit disk-attach route mid-implementation.
//     AUTOSTART (0xdd) has NO drive-unit field on the wire at all -- this is
//     a protocol gap, not a code bug you can fix by looking harder
//     (RESEARCH.md Pitfall 2).
//   - Never add a disk-detach handler here. D-13's vice_disk_detach was
//     CUT from scope 2026-08-17 -- grep-gated
//     to zero occurrences of its name in this file's own acceptance criteria.
//   - Never build a broker-side path inside ANY handler in this file
//     (handleAutostart/handleDiskAttach/handleSnapshotSave/
//     handleSnapshotLoad). The broker mints the handle and the emulator
//     filename via `stageFile()`; every handler here only relays what the
//     reply names, verbatim, into the AUTOSTART/DUMP/UNDUMP request body,
//     and never opens it. Never fall back to a shared-filesystem route
//     when a stage or transfer call fails -- a retained fallback would falsify this milestone's own exit
//     hypothesis; refuse by name instead.
//   - Never confine vice_autostart's or vice_disk_attach's `path` to the
//     workspace. D-14 is a deliberate, accepted owner decision: this tree's
//     whole purpose is analysing artifacts that live wherever the user put
//     them, and confining the argument was offered and declined as a
//     regression dressed as hardening.
//   - Never construct an ok-answer outside stockAnswer(). D-06 requires
//     every stock tool answer to carry runState, and stockAnswer() is the
//     one place that is stamped.
import { resolve, dirname } from "node:path";
import { mkdirSync, existsSync, readdirSync, writeFileSync, readFileSync, accessSync, constants as fsConstants } from "node:fs";

import { CommandType, ResetMode, resetBody, autostartBody, dumpBody, undumpBody } from "./stock-protocol.ts";
import { stockAnswer, convertWireError, isErrorText, type StockSessionHandler } from "./stock-handler.ts";
import { snapshotPathFor, snapshotMetaPathFor, validateSnapshotName } from "./transfer-paths.ts";

/** True iff `value` is a well-formed, generic JSON object -- not null, not
 * an array. Matches this module tree's own isPlainObject() convention
 * (stock-condition.ts:228) -- redeclared privately here, not
 * imported, per the established per-module convention. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Returns an error message naming `path` when it cannot be read from THIS
 * client's own filesystem, or `null` when it can. A genuine, real filesystem
 * check -- never delegated to the (possibly stubbed) transfer layer -- so an
 * unreadable path is refused with zero staging calls and zero sends,
 * matching handleSnapshotLoad's own existsSync-before-anything-else
 * ordering read in the other direction. Used by handleAutostart and
 * handleDiskAttach, and by text-tools.ts's vice_program_load;
 * handleSnapshotSave/handleSnapshotLoad have their own existing existsSync
 * check for the SAME reason and are unchanged here.
 */
export function checkLocalFileReadable(toolName: string, path: string): string | null {
  try {
    accessSync(path, fsConstants.R_OK);
    return null;
  } catch (err) {
    return `${toolName}: cannot read path ${path} (${err instanceof Error ? err.message : String(err)})`;
  }
}

// ---------------------------------------------------------------------------
// handleMachineReset -- RESET (0xcc), with an OPTIONAL follow-up EXIT (0xaa).
// ---------------------------------------------------------------------------

/**
 * `mode` defaults to "soft"; `run_after` defaults to **false** on stock --
 * stock's recorded divergence. RESET has no run-after
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
// handleAutostart -- AUTOSTART (0xdd), run flag honoured, file streamed.
// ---------------------------------------------------------------------------

/** The `stage_file` slot name `handleAutostart` stages under -- one of the
 * three slot names vice-broker-client.ts's own StageFileOptions header
 * comment already names as "what this phase sends" (`"autostart"`,
 * `"disk8"`, `"snapshot"`). Deliberately DIFFERENT from
 * `DISK_ATTACH_STAGE_SLOT` below: both tools send the same wire command
 * (AUTOSTART), and `slot` is scoped per-grant on the broker's own side
 * (broker-transfer.mts's stageFileSlot()), so calling both tools in one
 * session leaves two staged files, not one tool's upload superseding the
 * other's mid-session (T-64-29). */
const AUTOSTART_STAGE_SLOT = "autostart";

/**
 * `program` is refused when supplied (D-03): AUTOSTART supports only a
 * numeric `fileIndex` and has no load-by-name field, so an argument stock
 * cannot honour is refused rather than silently dropped.
 *
 * Phase 64 (XFER-02/XFER-08): the file AUTOSTART loads is one THIS CLIENT
 * read and streamed to the broker's own staging area, never a path the
 * emulator opens off a shared filesystem. `path` stays resolved to an
 * absolute path and UNRESTRICTED -- not confined to the workspace, by
 * deliberate owner decision (D-14). Confining it was offered and declined:
 * it is a regression dressed as hardening, and this tree's whole purpose is
 * analysing artifacts that live wherever the user put them (`~/Downloads`, a
 * shared ROM library). Named, accepted cost: the broker is now
 * machine-level and shared across every project, so this is a route for
 * reading any client-readable file into broker-owned staging -- bounded by
 * the transfer cap (D-09) and by session-scoped staging (D-06), not
 * eliminated. Recorded here so a later reader does not rediscover it as a
 * defect.
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

  // D-14: resolved to an absolute path, and NOT confined to the workspace --
  // any absolute path the client can read is accepted and uploaded.
  const localPath = resolve(path);

  const readError = checkLocalFileReadable("vice_autostart", localPath);
  if (readError !== null) return isErrorText(readError);

  // Step 1: stage a slot on the broker's own disk for this grant. A refusal
  // sends no AUTOSTART at all.
  const stageOutcome = await session.brokerControl.stageFile({ targetId: session.targetId, slot: AUTOSTART_STAGE_SLOT });
  if (!stageOutcome.ok) {
    return isErrorText(`vice_autostart: staging the autostart slot was refused (${stageOutcome.reason})`);
  }

  // Step 2: upload this client's own local file's bytes. A refusal --
  // including the transfer cap's own refusal, which names the limit -- sends
  // no AUTOSTART.
  //
  // G-64-3 (plan 64-13) closed the race this comment used to document as an
  // accepted risk: transferFile() (session.deps.transferFile) now resolves
  // ok ONLY after the broker has confirmed, on the transfer connection's own
  // completion reply, that it has verified and published the staged file --
  // never on this client's own local write finishing. The AUTOSTART sent
  // below is therefore guaranteed to name a file that already exists at the
  // path the broker chose.
  const transferFile = session.deps.transferFile;
  if (!transferFile) {
    return isErrorText("vice_autostart: internal error -- no transferFile implementation is available on this session");
  }
  const uploadResult = await transferFile({ direction: "upload", handle: stageOutcome.handle, sourcePath: localPath });
  if (!uploadResult.ok) {
    return isErrorText(`vice_autostart: uploading the program failed (${uploadResult.reason})`);
  }

  // Step 3: only after the upload completes, send AUTOSTART with the
  // broker-CHOSEN emulator filename, relayed verbatim -- this client never
  // constructs it and never opens it.
  try {
    await session.client.send(
      CommandType.AutoStart,
      autostartBody({ runAfter: run, fileIndex: index, filename: stageOutcome.emulatorFilename }),
    );
  } catch (err) {
    return convertWireError("vice_autostart", err, { cmdFailureText: AUTOSTART_CMD_FAILURE_TEXT });
  }

  return stockAnswer(session.client, { path: localPath, handle: stageOutcome.handle, run, index });
};

// ---------------------------------------------------------------------------
// handleDiskAttach -- AUTOSTART (0xdd) again, the D-14 approximation.
// ---------------------------------------------------------------------------

/**
 * Kept the fork's exact `unit`+`path` argument shape (D-03). Units 9-11 are
 * refused, never silently retargeted to unit 8 -- AUTOSTART is the only wire
 * route to attaching an image and its request body has NO drive-unit field
 * at all, so an agent told "attached to unit 9" when the image landed on
 * unit 8 would debug the wrong drive.
 *
 * The returned `approximation` string names BOTH real side effects Phase 13
 * plan 13-03's live A5 probe observed against real fork VICE 3.10: a full
 * machine reset AND a program load, not "attach without disturbing machine
 * state." Exported so the pinning test derives its expectation from this
 * constant rather than re-typing the sentence, so the two cannot drift.
 */
export const DISK_ATTACH_APPROXIMATION =
  "AUTOSTART (D-14): performs a full machine reset and loads a program from the image; " +
  "unlike vice_autostart it does not issue a final run step, as far as observed.";

/** The `stage_file` slot name `handleDiskAttach` stages under -- DIFFERENT
 * from `AUTOSTART_STAGE_SLOT` above. See that constant's own doc comment for
 * why: both tools send the same wire command, and sharing a slot would let
 * attaching a disk after autostarting a program supersede and delete the
 * program's staged file mid-session (T-64-29). */
const DISK_ATTACH_STAGE_SLOT = "disk8";

/**
 * D-16: a game's writes to an attached disk image are an ACCEPTED, NAMED
 * LOSS. A disk image attached to unit 8 is writable -- a C64 game can save
 * to it. Under the old shared-filesystem model those writes landed in the
 * user's own file. Under Phase 64's design (D-01 staged transfer + D-06
 * session-scoped staging) the emulator writes to the BROKER's own staged
 * copy, which is deleted once the session closes -- the staged image is
 * write-through-to-nowhere.
 *
 * Why not pull the image back on session close: offered and declined.
 * SIGKILL, a crash and a recycle all produce no clean close, so the
 * guarantee would only be "usually" -- worse to document than a flat loss --
 * and it would make every disk attach a two-way transfer for a tool whose
 * whole point (per DISK_ATTACH_APPROXIMATION above) is a one-way load. A
 * read-only attach that would make this loss visible rather than silent is
 * not reachable on the advertised surface today: no resource-set tool
 * exists (`tools-manifest.stock.json` sets no VICE resource) and AUTOSTART
 * (0xdd) has no read-only flag.
 *
 * Exported, like DISK_ATTACH_APPROXIMATION above, so a pinning test derives
 * its expectation from this constant rather than re-typing the sentence --
 * the two cannot drift. Reported under its OWN result key (`writeLoss`),
 * never appended to DISK_ATTACH_APPROXIMATION's own sentence: that sentence
 * is about reset-and-load behaviour and says nothing about this.
 */
export const DISK_ATTACH_WRITE_LOSS =
  "Writes the running program makes to this attached disk image are not preserved: the emulator writes to a copy " +
  "staged on the broker for this session only, and that copy is deleted once the session closes. Any save made to " +
  "this disk during the session is gone the next time it is attached.";

/**
 * G-64-3 (plan 64-13, Task 3): the CmdFailure (0x8f) text for AUTOSTART,
 * used by BOTH `vice_autostart` and `vice_disk_attach` (D-14's own
 * approximation -- both send the SAME wire command). VICE's own
 * autostart_autodetect() (`autostart.c`) probes the file it was handed as a
 * disk, tape, cartridge, snapshot and program image, in that order, and
 * 0x8f here means it accepted none of them -- never a checkpoint-condition
 * parse failure (that generic gloss, in `stock-handler.ts`'s own
 * `WIRE_ERROR_TEXT`, is what pointed plan 64-11's diagnosis at checkpoints
 * when the real cause was a missing/unpublished file). Exported, like
 * `DISK_ATTACH_APPROXIMATION`/`DISK_ATTACH_WRITE_LOSS` above, so a test
 * derives its own expectation from this constant rather than re-typing the
 * sentence -- the two cannot drift.
 */
export const AUTOSTART_CMD_FAILURE_TEXT =
  "the emulator could not open or load the file it was handed -- AUTOSTART tries the file as a disk, tape, " +
  "cartridge, snapshot and program image, in that order, and accepted none of them";

/** G-64-3 (plan 64-13, Task 3): the CmdFailure (0x8f) text for UNDUMP
 * (`vice_snapshot_load`) -- VICE's own `machine_read_snapshot()` returning
 * < 0 means it could not read the snapshot file it was handed. See
 * `AUTOSTART_CMD_FAILURE_TEXT`'s own header comment for the full reasoning
 * this constant shares. */
export const UNDUMP_CMD_FAILURE_TEXT = "the emulator could not read the snapshot it was handed";

/** G-64-3 (plan 64-13, Task 3): the CmdFailure (0x8f) text for DUMP
 * (`vice_snapshot_save`) -- the write-side counterpart of
 * `UNDUMP_CMD_FAILURE_TEXT` above. */
export const DUMP_CMD_FAILURE_TEXT = "the emulator could not write the snapshot";

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
        "retargeted to unit 8 so you do not debug the wrong drive.",
    );
  }

  // D-14: resolved to an absolute path, and NOT confined to the workspace --
  // any absolute path the client can read is accepted and uploaded.
  const localPath = resolve(path);

  const readError = checkLocalFileReadable("vice_disk_attach", localPath);
  if (readError !== null) return isErrorText(readError);

  // Step 1: stage a slot on the broker's own disk for this grant. A refusal
  // sends no AUTOSTART at all.
  const stageOutcome = await session.brokerControl.stageFile({ targetId: session.targetId, slot: DISK_ATTACH_STAGE_SLOT });
  if (!stageOutcome.ok) {
    return isErrorText(`vice_disk_attach: staging the disk-attach slot was refused (${stageOutcome.reason})`);
  }

  // Step 2: upload this client's own local file's bytes. A refusal --
  // including the transfer cap's own refusal, which names the limit -- sends
  // no AUTOSTART.
  //
  // G-64-3 (plan 64-13) closed the race this comment used to document as an
  // accepted risk: transferFile() (session.deps.transferFile) now resolves
  // ok ONLY after the broker has confirmed, on the transfer connection's own
  // completion reply, that it has verified and published the staged file --
  // never on this client's own local write finishing. The AUTOSTART sent
  // below is therefore guaranteed to name a file that already exists at the
  // path the broker chose.
  const transferFile = session.deps.transferFile;
  if (!transferFile) {
    return isErrorText("vice_disk_attach: internal error -- no transferFile implementation is available on this session");
  }
  const uploadResult = await transferFile({ direction: "upload", handle: stageOutcome.handle, sourcePath: localPath });
  if (!uploadResult.ok) {
    return isErrorText(`vice_disk_attach: uploading the disk image failed (${uploadResult.reason})`);
  }

  // Step 3: only after the upload completes, send AUTOSTART with the
  // broker-CHOSEN emulator filename, relayed verbatim -- this client never
  // constructs it and never opens it.
  try {
    await session.client.send(
      CommandType.AutoStart,
      autostartBody({ runAfter: false, fileIndex: 0, filename: stageOutcome.emulatorFilename }),
    );
  } catch (err) {
    return convertWireError("vice_disk_attach", err, { cmdFailureText: AUTOSTART_CMD_FAILURE_TEXT });
  }

  return stockAnswer(session.client, {
    unit: 8,
    path: localPath,
    handle: stageOutcome.handle,
    approximation: DISK_ATTACH_APPROXIMATION,
    writeLoss: DISK_ATTACH_WRITE_LOSS,
  });
};

// ---------------------------------------------------------------------------
// handleSnapshotSave / handleSnapshotLoad -- DUMP (0x41) / UNDUMP (0x42).
// ---------------------------------------------------------------------------

const MAX_DESCRIPTION_LENGTH = 512;

/** The `stage_file` slot name both snapshot handlers stage under -- one of
 * the three slot names vice-broker-client.ts's own StageFileOptions header
 * comment already names as "what this phase sends" (`"autostart"`,
 * `"disk8"`, `"snapshot"`). `slot` is scoped per-grant on the broker's own
 * side (broker-transfer.mts's stageFileSlot()), so save and load re-using
 * the same slot name never collide with a DIFFERENT grant's own staging. */
const SNAPSHOT_STAGE_SLOT = "snapshot";

/**
 * `name` is sanitised through transfer-paths.ts's validateSnapshotName()
 * directly into a workspace-internal path -- never treated as a path fragment; this rule is
 * UNCHANGED by Phase 64 (D-13). The client-side metadata sidecar
 * ("DUMP writes state; JSON metadata is our own bookkeeping") is written ONLY after the download from the broker
 * succeeds, so a failed save never leaves a sidecar claiming a snapshot that
 * does not exist; a sidecar WRITE failure is reported in the answer as
 * `metadataWritten: false` with a reason, never thrown -- the snapshot
 * itself succeeded and the agent must be told exactly that (T-3-10).
 *
 * Phase 64 (XFER-01, D-15): the bytes DUMP writes now land on the BROKER's
 * own disk, at a filename the broker itself chose -- never a path this
 * client constructed or opened. The order below is load-bearing: stage
 * first (so a refusal sends no DUMP at all), send DUMP with the broker's
 * own filename relayed verbatim, and only THEN download the staged bytes
 * into this client's own snapshots directory -- the emulator must have
 * finished writing the file before a download can read it. The result
 * carries the broker-minted `handle` in place of the old `sentPath`
 * broker-side path (T-64-19): a test enumerates every result key and
 * asserts none of them names the staged path or its containing directory.
 * `handle` preserves the one thing `sentPath` was informally used for --
 * the only correlation thread between a tool result and broker-side
 * diagnostics -- without leaking a path. Its named, accepted cost: an opaque token now appears in a result
 * and an agent may be tempted to reuse it as an argument elsewhere; no tool
 * in this file accepts a handle-shaped argument, so there is nothing here
 * for such a value to be silently accepted by.
 */
export const handleSnapshotSave: StockSessionHandler = async (args, session) => {
  const a = isPlainObject(args) ? args : {};

  const nameVerdict = validateSnapshotName(a.name);
  if (!nameVerdict.ok) {
    return isErrorText(`vice_snapshot_save: ${nameVerdict.reason}`);
  }
  const name = nameVerdict.name;

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

  // Step 1: stage a slot on the broker's own disk for this grant. A refusal
  // sends no DUMP at all.
  const stageOutcome = await session.brokerControl.stageFile({ targetId: session.targetId, slot: SNAPSHOT_STAGE_SLOT });
  if (!stageOutcome.ok) {
    return isErrorText(`vice_snapshot_save: staging the snapshot slot was refused (${stageOutcome.reason})`);
  }

  // Step 2: send DUMP with the broker-CHOSEN emulator filename, relayed
  // verbatim into the request body -- this client never constructs it and
  // never opens it.
  try {
    await session.client.send(
      CommandType.Dump,
      dumpBody({ saveRoms: includeRoms, saveDisks: includeDisks, filename: stageOutcome.emulatorFilename }),
    );
  } catch (err) {
    return convertWireError("vice_snapshot_save", err, { cmdFailureText: DUMP_CMD_FAILURE_TEXT });
  }

  // Step 3: only after DUMP succeeds, download the staged bytes into this
  // client's own snapshots directory. VICE opens the staged file for
  // writing and will not create the destination directory -- the same
  // mkdirSync-before-translate ordering this handler already used before
  // Phase 64, kept here immediately before the download call.
  const localPath = snapshotPathFor(name);
  mkdirSync(dirname(localPath), { recursive: true });

  const transferFile = session.deps.transferFile;
  if (!transferFile) {
    return isErrorText("vice_snapshot_save: internal error -- no transferFile implementation is available on this session");
  }
  const downloadResult = await transferFile({ direction: "download", handle: stageOutcome.handle, destPath: localPath });
  if (!downloadResult.ok) {
    // The atomic publish (temp write, rename only after digest/length
    // verify, temp removed on every failure path) lives entirely inside the
    // transfer layer (plan 64-01) -- nothing here reimplements it, and
    // nothing here falls back to a shared-mount route.
    return isErrorText(`vice_snapshot_save: downloading the saved snapshot failed (${downloadResult.reason})`);
  }

  // Step 4: download succeeded -- write the metadata sidecar. A write
  // failure here is reported, never thrown: the snapshot itself is good.
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
      snapshotPath: localPath,
    };
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  } catch (err) {
    metadataWritten = false;
    metadataFailureReason = err instanceof Error ? err.message : String(err);
  }

  return stockAnswer(session.client, {
    name,
    path: localPath,
    handle: stageOutcome.handle,
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
 * of failure rather than as its own tool. This refusal is UNCHANGED by
 * Phase 64 and runs FIRST, before any staging request or transfer
 * connection is opened -- the cheapest possible refusal, and the one an
 * agent hits most often.
 *
 * Phase 64 (XFER-02, D-15): the `.vsf` is read on THIS client's own side and
 * its bytes are streamed to the broker BEFORE the emulator is asked to open
 * anything -- the reverse of the save handler's order, and load-bearing for
 * the same reason read in the other direction: the emulator must be able to
 * open the staged file the instant UNDUMP names it. The result carries the
 * broker-minted `handle` in place of the old `sentPath` broker-side path,
 * exactly as the save handler's own doc comment explains.
 *
 * Loading a snapshot REPLACES THE ENTIRE MACHINE STATE, so this handler's
 * `runState` reflects whatever the event stream reports after UNDUMP and
 * nothing is asserted about it here.
 */
export const handleSnapshotLoad: StockSessionHandler = async (args, session) => {
  const a = isPlainObject(args) ? args : {};

  const nameVerdict = validateSnapshotName(a.name);
  if (!nameVerdict.ok) {
    return isErrorText(`vice_snapshot_load: ${nameVerdict.reason}`);
  }
  const name = nameVerdict.name;

  // Step 1: resolve the local path and perform the existing existence
  // check. A missing file refuses HERE, before any staging request or
  // transfer connection is opened.
  const localPath = snapshotPathFor(name);
  if (!existsSync(localPath)) {
    const dir = dirname(localPath);
    let available: string[] = [];
    try {
      available = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".vsf")) : [];
    } catch {
      available = [];
    }
    return isErrorText(
      `vice_snapshot_load: no snapshot named "${name}" exists at ${localPath}. ` +
        (available.length > 0 ? `Available snapshots: ${available.join(", ")}` : "No snapshots exist yet."),
    );
  }

  // Step 2: stage a slot on the broker for this grant.
  const stageOutcome = await session.brokerControl.stageFile({ targetId: session.targetId, slot: SNAPSHOT_STAGE_SLOT });
  if (!stageOutcome.ok) {
    return isErrorText(`vice_snapshot_load: staging the snapshot slot was refused (${stageOutcome.reason})`);
  }

  // Step 3: upload this client's own local file's bytes through
  // session.deps.transferFile. A refusal sends no UNDUMP.
  //
  // G-64-3 (plan 64-13) closed the race this comment used to document as an
  // accepted risk: transferFile() (session.deps.transferFile) now resolves
  // ok ONLY after the broker has confirmed, on the transfer connection's own
  // completion reply, that it has verified and published the staged file --
  // never on this client's own local write finishing. The UNDUMP sent below
  // is therefore guaranteed to name a file that already exists at the path
  // the broker chose.
  const transferFile = session.deps.transferFile;
  if (!transferFile) {
    return isErrorText("vice_snapshot_load: internal error -- no transferFile implementation is available on this session");
  }
  const uploadResult = await transferFile({ direction: "upload", handle: stageOutcome.handle, sourcePath: localPath });
  if (!uploadResult.ok) {
    return isErrorText(`vice_snapshot_load: uploading the snapshot failed (${uploadResult.reason})`);
  }

  // Step 4: only after the upload completes, send UNDUMP with the
  // broker-CHOSEN emulator filename, relayed verbatim.
  let programCounter: number | null = null;
  try {
    const reply = await session.client.send(CommandType.Undump, undumpBody({ filename: stageOutcome.emulatorFilename }));
    if (reply && typeof reply === "object" && "type" in reply && (reply as { type: unknown }).type === "undump") {
      programCounter = (reply as { programCounter: number }).programCounter;
    }
  } catch (err) {
    return convertWireError("vice_snapshot_load", err, { cmdFailureText: UNDUMP_CMD_FAILURE_TEXT });
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

  return stockAnswer(session.client, { name, path: localPath, handle: stageOutcome.handle, programCounter, metadata });
};
