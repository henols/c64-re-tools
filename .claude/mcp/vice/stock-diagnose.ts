#!/usr/bin/env node
// stock-diagnose.ts
//
// THE stock-backend implementation of `vice_diagnose` (TIME-04) --
// vice-wedge-triage's documented opening move, today refused by name on the
// stock backend because dispatchStock()'s miss branch has no entry for it.
// This file ports the fork's already-live-tested checkpoint-trap algorithm
// (transport swapped, logic unchanged) and replaces its ping-poll-while-
// running cycle bracket -- which stock cannot do, since every inbound byte
// halts the machine (monitor_binary.c:281) -- with the snapshot-resume-
// wait-halt-compare bracket built on 07-05's readCycleBaseline() (Task 2,
// added on top of this task's own IRQ-handler/checkpoint-trap port).
//
// THIS TASK (1 of 3): resolveStockLiveIrqHandler() and
// gatherStockCheckpointTrapEvidence() -- the fork's resolveLiveIrqHandler()/
// gatherCheckpointTrapEvidence() ported onto stock's own MEM_GET/
// REGISTERS_GET/CHECKPOINT_LIST primitives. Logic unchanged; only the three
// call("vice_...", ...) invocations are replaced. Makes NO resume and NO
// stopwatch call -- checking this before any liveness bracket is the whole
// point (matching the fork's own D-14/T-01.3-08 ordering). Task 2 (a later
// commit in this same file) adds the liveness bracket and the five-verdict
// handleDiagnoseStock() built on top of these two exports.
//
// WHAT NOT TO DO:
//   - Never import vice-proxy.ts, and never call rewriteArguments() or
//     forwardToVice() -- port the fork's algorithm, do not reach for it
//     (stock-derived.ts's own WHAT NOT TO DO list).
//   - Never send CommandType.Exit (or any resume) from either function in
//     this file -- a checkpoint-trap verdict must never be reached by way
//     of a resume, or it stops being distinguishable from a verdict a
//     liveness bracket actually had to run to establish.
//   - Never hardcode HIRAM_MASK as an inline literal at the comparison site
//     -- it is a named constant (below) for exactly this reason.
import {
  CommandType,
  memGetBody,
  StockFramingError,
  StockDesyncError,
  StockResponseMismatchError,
  StockConnectionClosedError,
  StockRequestTimeoutError,
} from "./stock-protocol.ts";
import { handleCheckpointList } from "./stock-checkpoints.ts";
import { handleRegistersGet } from "./stock-registers.ts";
import { readCycleBaseline, type CycleBaseline } from "./stock-timing.ts";
import { stockAnswer, derivedAnswer, isErrorText, type StockToolResult } from "./stock-handler.ts";
import { ensureStockSession, type StockDispatchDeps, type EnsureStockSessionOutcome } from "./stock-dispatch.ts";
import type { DerivedPureHandler } from "./stock-derived.ts";
import type { StockConnectSession } from "./stock-connect.ts";
import { runStateFor } from "./stock-runstate.ts";
import { MachineRestartedError, readEpoch, type EpochResult } from "./vice.ts";
import { MonitorOwnershipError } from "./vice-broker-client.ts";

/** True iff `value` is a well-formed, generic JSON object -- not null, not
 * an array. Matches this module tree's own isPlainObject() convention,
 * redeclared privately here per the established per-module precedent. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatAddress(n: number | null | undefined): string {
  return n === null || n === undefined ? "unknown" : `$${n.toString(16).toUpperCase().padStart(4, "0")}`;
}

function formatByte(n: number | null | undefined): string {
  return n === null || n === undefined ? "unknown" : `$${n.toString(16).toUpperCase().padStart(2, "0")}`;
}

// Bit 1 (HIRAM) of the 6510 processor port at $01. SET -- the KERNAL ROM is
// banked in, and the RAM IRQ vector pair ($0314/$0315) is what the KERNAL's
// own dispatch actually reads. CLEAR -- the KERNAL is replaced by RAM and
// the CPU reads the hardware IRQ/BRK vector pair ($FFFE/$FFFF) directly,
// with no ROM indirection. Named constant, never an inline magic number at
// the comparison site (07-06-PLAN.md's own acceptance criterion).
const HIRAM_MASK = 0x02;

/** The live-IRQ-handler lookup's own return shape -- shared by
 * gatherStockCheckpointTrapEvidence() below and, per this plan's own
 * key_links, reused verbatim by plan 07-07's stock evidence gatherer. */
export interface StockIrqHandlerResolution {
  target: number | null;
  pairLabel: string;
  explanation: string;
}

function wordFromBytes(bytes: Uint8Array): number | null {
  return bytes.length >= 2 ? bytes[0]! | (bytes[1]! << 8) : null;
}

/**
 * The single definition of the live-IRQ-handler lookup on the stock backend:
 * three reads through session.client.send() directly -- $01, the RAM vector
 * pair, and (only when $01 says the ROMs are banked out) the hardware vector
 * pair. Leaves the bank argument at memGetBody()'s default (0x0000, the CPU
 * view) -- Phase 5's CR-01 banking discipline applies to I/O-space registers
 * ($D000-$DFFF); $01, $0314 and $FFFE are the processor port, RAM and ROM in
 * the CPU's own view, which is exactly what the IRQ dispatch itself reads.
 * Do NOT "fix" this into an io-bank read.
 *
 * Memoises NOTHING: a disk swap, a reset or a different game retargets the
 * handler, so a cached address would silently resolve the wrong pair.
 */
export async function resolveStockLiveIrqHandler(session: StockConnectSession): Promise<StockIrqHandlerResolution> {
  const portResponse = await session.client.send(CommandType.MemoryGet, memGetBody({ sidefx: false, start: 0x01, end: 0x01, memspace: 0x00 }));
  if (portResponse.type !== "memory_get") {
    throw new Error(`resolveStockLiveIrqHandler: expected a memory_get reply for $01, got "${portResponse.type}"`);
  }
  const port01 = portResponse.bytes.length > 0 ? portResponse.bytes[0]! : null;
  const bankedOut = port01 !== null && (port01 & HIRAM_MASK) === 0;

  const ramResponse = await session.client.send(CommandType.MemoryGet, memGetBody({ sidefx: false, start: 0x0314, end: 0x0315, memspace: 0x00 }));
  if (ramResponse.type !== "memory_get") {
    throw new Error(`resolveStockLiveIrqHandler: expected a memory_get reply for $0314, got "${ramResponse.type}"`);
  }
  const ramTarget = wordFromBytes(ramResponse.bytes);

  if (!bankedOut) {
    return {
      target: ramTarget,
      pairLabel: "the RAM KERNAL IRQ vector pair ($0314/$0315)",
      explanation:
        `$01 read as ${formatByte(port01)} -- the KERNAL ROM is banked in, so the RAM IRQ vector pair ` +
        `($0314/$0315) is the pair this session's IRQ dispatch actually reads; it resolves to ${formatAddress(ramTarget)}.`,
    };
  }

  const hwResponse = await session.client.send(CommandType.MemoryGet, memGetBody({ sidefx: false, start: 0xfffe, end: 0xffff, memspace: 0x00 }));
  if (hwResponse.type !== "memory_get") {
    throw new Error(`resolveStockLiveIrqHandler: expected a memory_get reply for $FFFE, got "${hwResponse.type}"`);
  }
  const hwTarget = wordFromBytes(hwResponse.bytes);
  return {
    target: hwTarget,
    pairLabel: "the hardware IRQ/BRK vector pair ($FFFE/$FFFF)",
    explanation:
      `$01 read as ${formatByte(port01)} -- the KERNAL ROM is banked OUT, so the CPU dispatches directly through ` +
      `the hardware IRQ/BRK vector pair ($FFFE/$FFFF) with no ROM indirection; it resolves to ${formatAddress(hwTarget)}.`,
  };
}

/** A single vice_checkpoint_list entry, as handleCheckpointList's own JSON
 * answer shapes it (stock-checkpoints.ts) -- typed loosely and read
 * defensively, matching the fork's own CheckpointInfo precedent. Field names
 * are stock's OWN spelling (`id`, `hitCount`, `operation.flags`), never the
 * fork's `checkpoint_num`/`hit_count`. */
interface StockCheckpointEntry {
  id?: unknown;
  start?: unknown;
  end?: unknown;
  stop?: unknown;
  enabled?: unknown;
  operation?: { value?: unknown; flags?: unknown };
  hitCount?: unknown;
  [key: string]: unknown;
}

export interface StockCheckpointTrapEvidence {
  isTrap: boolean;
  checkpoints: StockCheckpointEntry[];
  /** Set (and checkpoints left []) when vice_checkpoint_list itself refused
   * -- the gather continues rather than aborting, per this plan's own
   * "does not abort the gather" instruction. */
  checkpointsUnavailable?: string;
  pc: number | null;
  handler: StockIrqHandlerResolution;
  trapCheckpoint: StockCheckpointEntry | null;
  trapReason: "pc" | "handler" | null;
}

/** Reads PC through the register catalog (handleRegistersGet, the same
 * handler vice_registers_get itself calls) -- `null` on any refusal, never
 * thrown, since a missing PC must not abort the trap-evidence gather. */
async function readStockPc(session: StockConnectSession, deps: StockDispatchDeps): Promise<number | null> {
  const result = await handleRegistersGet({}, session, deps);
  if (result.isError) {
    return null;
  }
  const parsed = JSON.parse(result.content[0]!.text) as { registers?: unknown };
  const registers = isPlainObject(parsed.registers) ? parsed.registers : undefined;
  const pc = registers ? registers.PC : undefined;
  return typeof pc === "number" ? pc : null;
}

function hasExecFlag(operation: StockCheckpointEntry["operation"]): boolean {
  return isPlainObject(operation) && Array.isArray(operation.flags) && (operation.flags as unknown[]).includes("exec");
}

/**
 * Enumerate armed checkpoints, read the current PC, resolve the live IRQ
 * handler, and decide the checkpoint-trap verdict on the same two named
 * shapes the fork's gatherCheckpointTrapEvidence() uses: an enabled,
 * stopping, exec checkpoint sitting exactly at the current PC; or one
 * sitting at the resolved handler entry with a hit count of exactly zero
 * (the corroborating tell that it has never actually fired). Makes NO
 * resume and NO stopwatch call -- checking this before any liveness bracket
 * is the whole point (matching the fork's own D-14/T-01.3-08 ordering).
 *
 * Exported: plan 07-07's stock evidence gatherer reuses this verbatim.
 */
export async function gatherStockCheckpointTrapEvidence(
  session: StockConnectSession,
  deps: StockDispatchDeps,
): Promise<StockCheckpointTrapEvidence> {
  let checkpoints: StockCheckpointEntry[] = [];
  let checkpointsUnavailable: string | undefined;

  const checkpointsResult = await handleCheckpointList({}, session, deps);
  if (checkpointsResult.isError) {
    checkpointsUnavailable = checkpointsResult.content[0]?.text ?? "vice_checkpoint_list failed with no message";
  } else {
    const parsed = JSON.parse(checkpointsResult.content[0]!.text) as { checkpoints?: unknown };
    checkpoints = Array.isArray(parsed.checkpoints) ? (parsed.checkpoints as StockCheckpointEntry[]) : [];
  }

  const pc = await readStockPc(session, deps);
  const handler = await resolveStockLiveIrqHandler(session);

  const armedStopping = checkpoints.filter((c) => c.enabled !== false && c.stop === true && hasExecFlag(c.operation));

  const atPc = pc !== null ? armedStopping.find((c) => c.start === pc) : undefined;
  const atHandler =
    !atPc && handler.target !== null && handler.target !== undefined
      ? armedStopping.find((c) => c.start === handler.target && c.hitCount === 0)
      : undefined;

  const trapCheckpoint = atPc ?? atHandler ?? null;
  return {
    isTrap: Boolean(trapCheckpoint),
    checkpoints,
    ...(checkpointsUnavailable !== undefined ? { checkpointsUnavailable } : {}),
    pc,
    handler,
    trapCheckpoint,
    trapReason: atPc ? "pc" : atHandler ? "handler" : null,
  };
}

const CHECKPOINT_TRAP_INCIDENT_REF =
  ".planning/todos/pending/2026-08-01-vice-registers-frozen-after-reset-during-01-04-task2.md";

/** Renders the checkpoint_trap verdict's report -- an explanation, never a
 * remedy: names the armed checkpoints, the resolved handler, the PC's
 * relation to the trap, states plainly this is self-inflicted and not a
 * wedge, names the agent's own next moves without performing any of them,
 * and closes with the not-guaranteed paragraph (matching the fork's own
 * renderCheckpointTrapReport()). Consumed by Task 2's handleDiagnoseStock. */
export function renderStockCheckpointTrapReport(evidence: StockCheckpointTrapEvidence): string {
  const { checkpoints, checkpointsUnavailable, pc, handler, trapCheckpoint, trapReason } = evidence;
  const checkpointList = checkpointsUnavailable
    ? `checkpoints could not be enumerated (${checkpointsUnavailable})`
    : checkpoints.length === 0
      ? "none armed"
      : checkpoints
          .map((c) => {
            const addr = formatAddress(typeof c.start === "number" ? c.start : null);
            const flag = c.stop ? "stop" : "trace";
            const enabled = c.enabled === false ? "disabled" : "enabled";
            const hitCount = typeof c.hitCount === "number" ? c.hitCount : "unknown";
            return `#${String(c.id)} ${addr} (${flag}, ${enabled}, hitCount ${hitCount})`;
          })
          .join("; ");

  const pcRelation =
    trapReason === "pc"
      ? `exactly at armed checkpoint #${String(trapCheckpoint!.id)} -- that is why the machine is stopped here`
      : trapReason === "handler"
        ? `not at the armed checkpoint's own address, but checkpoint #${String(trapCheckpoint!.id)} sits at the ` +
          "resolved live IRQ handler entry with hitCount 0 -- the corroborating tell that this checkpoint has " +
          "never actually fired, not merely that it fired between reads"
        : "no relation established";

  return [
    "vice_diagnose verdict: checkpoint_trap",
    "",
    `Armed checkpoints: ${checkpointList}.`,
    `Resolved live IRQ handler: ${handler.explanation}`,
    `Current PC: ${formatAddress(pc)} -- ${pcRelation}.`,
    "",
    "This is a self-inflicted stop, not a wedge: the machine paused because an armed checkpoint fired or sits " +
      "exactly here, not because it stopped retiring cycles on its own. Recycling now would destroy a healthy " +
      "instance -- no liveness bracket was run to reach this verdict.",
    "",
    "Next moves available to you (this report performs none of them): vice_checkpoint_delete the offending " +
      "checkpoint, or vice_checkpoint_toggle it disabled; vice_execution_step past it; then re-run vice_diagnose.",
    "",
    "Not guaranteed: deleting the checkpoint is not guaranteed to unfreeze the machine. The recorded incident " +
      `(${CHECKPOINT_TRAP_INCIDENT_REF}) shows checkpoint delete, then a soft reset, then a hard reset, then an ` +
      "explicit single step ALL leaving the machine frozen in sequence -- a checkpoint trap may be the onset " +
      "without being the whole story. If a liveness bracket still shows no advance after the checkpoint is gone, " +
      "the verdict becomes wedged and recycle is the fallback after all.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Task 2 (this commit): runStockLivenessBracket() and the five-verdict
// handleDiagnoseStock().
//
// WHY THE HANDLER OWNS ITS OWN SESSION ACQUISITION: this tool is registered
// (07-09) with withDerivedTool("vice_diagnose", { needsSession: false }, ...)
// yet calls ensureStockSession(deps) itself, inside its own try/catch --
// the ONE declared exception to DerivedPureHandler's doc comment in
// stock-derived.ts ("a needsSession:false handler structurally cannot reach
// the wire"). The reason: the fork's handleDiagnose() never throws past its
// own boundary and always answers isError:false with a verdict, but
// withDerivedTool({ needsSession: true })'s own preamble would convert a
// thrown MonitorOwnershipError into refusal TEXT before this handler's own
// return value ever existed -- turning the fifth verdict into exactly the
// generic error string it exists to replace. Amending stock-derived.ts's
// doc comment for this exception is plan 07-09's job (the registration
// plan), not this one's.
//
// Because this handler owns its own acquisition, it also owns constructing
// its own answer: when a session was actually obtained, every answer goes
// through stockAnswer(session.client, payload) (D-06 -- a real client
// exists, so a real runState is knowable). When acquisition itself failed
// or timed out -- monitor_held_elsewhere, restarted from a thrown
// MachineRestartedError, or the bounded-acquisition timeout -- there IS no
// client (stockConnect() rejected before or while building one), so those
// paths go through derivedAnswer() instead, whose honest "unknown" runState
// is exactly right: this handler genuinely never observed the machine.
//
// WHAT NOT TO DO (Task 2's own additions to this file's list):
//   - Never invent a sixth verdict, and never report one of the five
//     STOCK_DIAGNOSE_VERDICTS the evidence did not actually establish. The
//     bounded-acquisition timeout and the bracket's "unavailable" route both
//     answer isError:true refusal text naming what could not be
//     established, never a verdict field.
//   - Never resume the machine (send CommandType.Exit) anywhere except
//     inside runStockLivenessBracket().
//   - Never cache DIAGNOSE_SESSION_TIMEOUT_MS/DIAGNOSE_BRACKET_WINDOW_MS as a
//     module-level constant the way vice-proxy.ts's CAPTURE_STEP_TIMEOUT_MS
//     is -- this file's own test drives many distinct timeout/window values
//     within ONE process, and a value frozen at import time could never be
//     overridden per test without a dynamic re-import for every case. Read
//     the environment variable fresh on every call instead (below).
//   - Never let a raw bigint (CycleBaseline's cpu_history `cycle` field)
//     reach JSON.stringify() -- stockAnswer()/derivedAnswer() both
//     serialize the payload, and JSON.stringify() throws on a bigint.
//     serializeCycleBaseline()/serializeBracket() below are the ONE place a
//     CycleBaseline is converted to a JSON-safe shape.
// ---------------------------------------------------------------------------

function describeStockError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const DEFAULT_DIAGNOSE_SESSION_TIMEOUT_MS = 10000;
const DEFAULT_DIAGNOSE_BRACKET_WINDOW_MS = 250;

function envMs(envVar: string, fallback: number): number {
  const raw = process.env[envVar];
  if (raw === undefined || raw === "") {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/** Read fresh on EVERY call -- deliberately not a module-level constant the
 * way vice-proxy.ts's CAPTURE_STEP_TIMEOUT_MS is (see this file's own
 * WHAT NOT TO DO). Defaults to 10000ms; overridable via
 * VICE_STOCK_DIAGNOSE_SESSION_TIMEOUT_MS. */
export function diagnoseSessionTimeoutMs(): number {
  return envMs("VICE_STOCK_DIAGNOSE_SESSION_TIMEOUT_MS", DEFAULT_DIAGNOSE_SESSION_TIMEOUT_MS);
}

/** Read fresh on EVERY call, same rationale as diagnoseSessionTimeoutMs()
 * above. Defaults to 250ms; overridable via VICE_STOCK_DIAGNOSE_BRACKET_MS. */
export function diagnoseBracketWindowMs(): number {
  return envMs("VICE_STOCK_DIAGNOSE_BRACKET_MS", DEFAULT_DIAGNOSE_BRACKET_WINDOW_MS);
}

/** The verdict set is EXACTLY the five of D-03.
 * `stale_read_path` is deliberately absent: it exists on the fork only
 * because the fork mixes a non-pausing vice_ping with pausing reads, and on
 * stock every read pauses uniformly, so that state is unreachable by
 * construction. Frozen so the manifest enum (plan 07-09) and this file's
 * own tests both drive one list. */
export const STOCK_DIAGNOSE_VERDICTS = Object.freeze([
  "restarted",
  "checkpoint_trap",
  "wedged",
  "monitor_held_elsewhere",
  "live",
] as const);

export type StockDiagnoseVerdict = (typeof STOCK_DIAGNOSE_VERDICTS)[number];

// ---------------------------------------------------------------------------
// diagnosis_unavailable -- the named, classified non-verdict outcome (Gap 3 /
// Gap 4 / CR-01). D-03 locks STOCK_DIAGNOSE_VERDICTS at exactly the five
// above; this is NOT a sixth verdict -- it is a named outcome on the existing
// `isError: true` channel, the only shape the manifest's
// `required: ["verdict", ...]` output schema permits when no verdict could be
// established. `diagnosis_unavailable` must never be added to
// STOCK_DIAGNOSE_VERDICTS above.
// ---------------------------------------------------------------------------

/** Frozen outcome name, exported so tests and documentation (07-16, 07-18)
 * can name it without re-deriving the literal string. */
export const STOCK_DIAGNOSE_UNAVAILABLE_OUTCOME = "diagnosis_unavailable" as const;

/** Frozen reason-class list -- every classification `classifyDiagnoseUnavailable()`
 * and the route table below can produce. */
export const STOCK_DIAGNOSE_UNAVAILABLE_REASONS = Object.freeze([
  "protocol_decode_failure",
  "connection_lost",
  "request_timeout",
  "monitor_acquisition_timeout",
  "session_refused",
  "evidence_gathering_failed",
  "unknown",
] as const);

export type StockDiagnoseUnavailableReason = (typeof STOCK_DIAGNOSE_UNAVAILABLE_REASONS)[number];

/**
 * Maps an error's class to a reason class. `MonitorOwnershipError` and
 * `MachineRestartedError` must NEVER reach this classifier -- they carry real
 * verdicts (`monitor_held_elsewhere`/`restarted`) and are handled by their own
 * branches in handleDiagnoseStock() before this function is ever called.
 */
export function classifyDiagnoseUnavailable(err: unknown): StockDiagnoseUnavailableReason {
  if (err instanceof StockFramingError || err instanceof StockDesyncError || err instanceof StockResponseMismatchError) {
    return "protocol_decode_failure";
  }
  if (err instanceof StockConnectionClosedError) {
    return "connection_lost";
  }
  if (err instanceof StockRequestTimeoutError) {
    return "request_timeout";
  }
  return "unknown";
}

/** Per-reason-class guidance text: the concrete next step a triage agent
 * should take, in the exact terms vice-wedge-triage/SKILL.md's verdict table
 * already uses. */
function diagnoseUnavailableGuidance(reason: StockDiagnoseUnavailableReason, detail: string): string {
  switch (reason) {
    case "protocol_decode_failure":
      return (
        "the connected build answered a frame this client could not decode " +
        `(${detail}) -- see docs/stock-vice-parity.md for known decode gaps.`
      );
    case "connection_lost":
    case "request_timeout":
      return "retry once, and if the same failure recurs, check the broker (a crashed or recycled instance can look like this).";
    case "monitor_acquisition_timeout":
      return (
        "this is behaviourally indistinguishable from a second client already holding the monitor socket (stock " +
        "VICE services exactly one binary-monitor client) -- if a second client is not the cause, retry once the " +
        "current holder releases."
      );
    case "session_refused":
      return `the upstream session refused with: ${detail}`;
    case "evidence_gathering_failed":
      return "a read failed mid-diagnosis -- the machine is very likely halted, so vice_execution_run may be needed.";
    case "unknown":
    default:
      return `an unclassified failure occurred (${detail}).`;
  }
}

/**
 * Builds the diagnosis_unavailable outcome text -- structured and greppable,
 * opening with a stable, machine-parseable prefix. States, in order: (1) no
 * verdict was established and this is deliberately not one of the five
 * documented verdicts; (2) the machine's state is therefore unknown -- never
 * `live`, never a wedge; (3) recycling on this answer alone is wrong,
 * `vice_recycle` is destructive and `wedged` was not established; (4) the
 * concrete next step for this reason class; (5) the raw detail string last,
 * for stable machine-readable prefix parsing.
 */
export function diagnoseUnavailableResult(reason: StockDiagnoseUnavailableReason, detail: string): StockToolResult {
  const text = [
    `vice_diagnose: ${STOCK_DIAGNOSE_UNAVAILABLE_OUTCOME} (${reason}) -- no verdict could be established. This is ` +
      `deliberately NOT one of the five documented verdicts (${STOCK_DIAGNOSE_VERDICTS.join(", ")}).`,
    "The emulated machine's state is therefore UNKNOWN -- do not read this as live and do not treat it as a wedge.",
    "Recycling on this answer alone is wrong: vice_recycle is destructive and wedged was not established.",
    diagnoseUnavailableGuidance(reason, detail),
    detail,
  ].join(" ");
  return isErrorText(text);
}

export interface StockLivenessBracketResult {
  route: CycleBaseline["route"];
  before: CycleBaseline;
  after: CycleBaseline;
  /** null when either sample's route is "unavailable" (or the route changed
   * mid-bracket, e.g. a reconnect) -- the verdict path must then report the
   * bracket as inconclusive rather than as wedged (never fabricate a false
   * "no advance"). */
  advanced: boolean | null;
  elapsedMs: number;
}

/**
 * Pattern 5 (07-RESEARCH.md), exported for plan 07-07. Exactly: one
 * readCycleBaseline() (a halting read), one CommandType.Exit (resume), one
 * await on a real wall-clock setTimeout of diagnoseBracketWindowMs() with
 * ZERO socket traffic inside the wait, then one more readCycleBaseline()
 * (a halting read which both re-pauses and samples).
 *
 * This deliberately uses wall-clock time, unlike vice-sync.ts's standing
 * "poll on hit_count, never on paused state" rule -- that rule's rationale
 * depended on a non-pausing vice_ping, and stock has no non-pausing
 * observation of any kind (monitor_binary.c:281 halts on any inbound byte),
 * so there is nothing to poll without itself perturbing the machine.
 */
export async function runStockLivenessBracket(session: StockConnectSession): Promise<StockLivenessBracketResult> {
  const before = await readCycleBaseline(session);
  const startedAt = Date.now();
  await session.client.send(CommandType.Exit);
  const windowMs = diagnoseBracketWindowMs();
  await new Promise<void>((resolve) => {
    setTimeout(resolve, windowMs);
  });
  const after = await readCycleBaseline(session);
  const elapsedMs = Date.now() - startedAt;

  let advanced: boolean | null;
  if (before.route === "unavailable" || after.route === "unavailable" || before.route !== after.route) {
    advanced = null;
  } else if (before.route === "cpu_history" && after.route === "cpu_history") {
    advanced = after.cycle > before.cycle;
  } else if (before.route === "frame_position" && after.route === "frame_position") {
    advanced = after.position !== before.position || after.pc !== before.pc;
  } else {
    advanced = null;
  }

  return { route: after.route, before, after, advanced, elapsedMs };
}

/** Converts a CycleBaseline to a JSON-safe shape -- the ONE place a raw
 * bigint (`cycle`) is turned into a string before it can reach
 * JSON.stringify() inside stockAnswer()/derivedAnswer(). */
function serializeCycleBaseline(baseline: CycleBaseline): Record<string, unknown> {
  if (baseline.route === "cpu_history") {
    return { route: baseline.route, cycle: baseline.cycle.toString(), pc: baseline.pc };
  }
  if (baseline.route === "frame_position") {
    return {
      route: baseline.route,
      lin: baseline.lin,
      cyc: baseline.cyc,
      pc: baseline.pc,
      position: baseline.position,
      standard: baseline.standard.name,
      standardAssumed: baseline.standard.assumed,
    };
  }
  return { route: baseline.route, reason: baseline.reason };
}

function serializeBracket(bracket: StockLivenessBracketResult): Record<string, unknown> {
  return {
    route: bracket.route,
    before: serializeCycleBaseline(bracket.before),
    after: serializeCycleBaseline(bracket.after),
    advanced: bracket.advanced,
    elapsedMs: bracket.elapsedMs,
  };
}

function renderStockRestartedReport(baselineEpoch: number | null | undefined, currentEpoch: number | null | undefined): string {
  return (
    "vice_diagnose verdict: restarted\n\n" +
    `The instance's epoch changed from ${baselineEpoch ?? "unknown"} to ${currentEpoch ?? "unknown"} -- the emulator ` +
    "behind this session restarted (or its identity across a reconnect could not be proven at all, which is " +
    "treated the same way, per D-3's own posture). This is answered at zero-to-minimal emulator cost; no " +
    "checkpoint enumeration and no liveness bracket were attempted. Any run in flight before this point is void."
  );
}

function renderMonitorHeldElsewhereReport(err: MonitorOwnershipError): string {
  return (
    "vice_diagnose verdict: monitor_held_elsewhere\n\n" +
    `This instance's monitor socket is already claimed by a different grant (grant ${err.holderGrantId ?? "unknown"}, ` +
    `claimed at ${err.holderClaimedAt ?? "unknown"}, port ${err.port ?? "unknown"}). Stock VICE services exactly ` +
    "one binary-monitor client, so this session could not open its own connection at all -- at zero emulator " +
    "calls. This is not a wedge and recycling would not help: the instance is healthy, just claimed elsewhere."
  );
}

function renderStockLiveReport(bracket: StockLivenessBracketResult): string {
  return (
    "vice_diagnose verdict: live\n\n" +
    `The liveness bracket measured an advance on route "${bracket.route}" in ~${bracket.elapsedMs}ms. Load-bearing ` +
    "evidence: the bracket's own before/after sample -- one resume call, one wall-clock wait with zero socket " +
    "traffic, one halting read. Machine state left: paused, after the bracket that reached this verdict -- " +
    "resuming is your own deliberate next call."
  );
}

function renderStockWedgedReport(bracket1: StockLivenessBracketResult, bracket2: StockLivenessBracketResult): string {
  return (
    "vice_diagnose verdict: wedged\n\n" +
    `Two consecutive liveness brackets showed no advance (bracket 1: route "${bracket1.route}", ~${bracket1.elapsedMs}ms; ` +
    `bracket 2: route "${bracket2.route}", ~${bracket2.elapsedMs}ms). This is the definitive liveness test on ` +
    "stock -- every read pauses the machine uniformly, so there is no separate stale-read-path state to " +
    "distinguish here (unlike the fork). Machine state left: paused, after two zero-advance brackets. Capture " +
    "evidence before recovering, then vice_recycle with a real reason as a last resort."
  );
}

function inconclusiveBracketText(bracket: StockLivenessBracketResult): string {
  const reason =
    bracket.before.route === "unavailable"
      ? bracket.before.reason
      : bracket.after.route === "unavailable"
        ? bracket.after.reason
        : `the bracket's route changed mid-measurement (before "${bracket.before.route}", after "${bracket.after.route}")`;
  return (
    `vice_diagnose: the liveness bracket could not be measured (${reason}). This is reported as inconclusive, ` +
    "never as wedged -- a bracket that cannot measure at all must not be mistaken for one that measured zero " +
    "advance. Establishing liveness needs CPUHISTORY_GET (VICE >= 3.10) or a build enumerating LIN/CYC by name."
  );
}

/** The source label carried alongside `machinePaused`, so a caller can tell
 * an observation from an inference:
 *   - "no_session" -- no session was ever obtained (the two pre-session
 *     verdicts, `monitor_held_elsewhere` and the thrown-`MachineRestartedError`
 *     acquisition path). Nothing in this process touched the machine, so no
 *     claim about a pause is being made; `machinePaused` is `false`.
 *   - "observed" -- `runStateFor(session.client)` reported `"stopped"` or
 *     `"running"` directly from the wire's own stopped/resumed/jam events.
 *   - "structural" -- the tracker reported `"unknown"`. See
 *     deriveMachinePaused()'s own comment for why "not observed running" is
 *     still treated as paused in this specific case. */
export type MachinePausedSource = "no_session" | "observed" | "structural";

/**
 * WR-03: `machinePaused` is derived HERE, from the observed run state, and
 * NEVER hand-passed by a call site again -- a hand-passed flag drifts from
 * reality the moment a call site changes (exactly what happened before this
 * fix: the `checkpoint_trap` verdict hardcoded `false` even though every
 * evidence-gathering read that got it there halts the machine on stock).
 *
 * `session === null` -> `false`/"no_session": no session was ever obtained,
 * so no claim about a pause is being made.
 *
 * `session !== null` -> read `runStateFor(session.client)`:
 *   - "stopped" -> `true`/"observed".
 *   - "running" -> `false`/"observed".
 *   - "unknown" -> `true`/"structural". By the time ANY verdict is built,
 *     this file's own path has already sent at least one wire read, every
 *     inbound byte halts the machine on stock (`monitor_binary.c:281`,
 *     CLAUDE.md's Protocol constraint), and no function in this file ever
 *     sends a resume except runStockLivenessBracket(), which itself ends
 *     with a read. So "not observed running" after this path's reads means
 *     paused -- but the tracker's own event-driven update can still lag a
 *     command reply, so this is an inference, never an observation, and the
 *     "structural" label is what keeps it honest.
 */
function deriveMachinePaused(session: StockConnectSession | null): { machinePaused: boolean; machinePausedSource: MachinePausedSource } {
  if (session === null) {
    return { machinePaused: false, machinePausedSource: "no_session" };
  }
  const runState = runStateFor(session.client);
  if (runState === "stopped") {
    return { machinePaused: true, machinePausedSource: "observed" };
  }
  if (runState === "running") {
    return { machinePaused: false, machinePausedSource: "observed" };
  }
  return { machinePaused: true, machinePausedSource: "structural" };
}

function diagnoseVerdictResult(
  session: StockConnectSession | null,
  verdict: StockDiagnoseVerdict,
  evidence: Record<string, unknown>,
  report: string,
): StockToolResult {
  const { machinePaused, machinePausedSource } = deriveMachinePaused(session);
  const payload: Record<string, unknown> = { verdict, evidence, report, machinePaused, machinePausedSource };
  return session ? stockAnswer(session.client, payload) : derivedAnswer(payload);
}

function diagnoseErrorResult(message: string): StockToolResult {
  return isErrorText(message);
}

/**
 * Handles vice_diagnose on the stock backend. Fixed check order, cheap to
 * expensive, mirroring the fork's own D-14 ordering:
 *   1. Bounded session acquisition (finding 4) -- MonitorOwnershipError ->
 *      monitor_held_elsewhere; MachineRestartedError -> restarted; a
 *      deadline expiry -> a plain refusal naming the bound, never a sixth
 *      verdict and never one of the five unestablished.
 *   2. Epoch comparison -- zero emulator calls.
 *   3. gatherStockCheckpointTrapEvidence() -- several reads, no resume.
 *   4. The liveness bracket(s) -- the only step that resumes.
 * Never throws past this point -- every branch is a well-formed isError:false
 * (carrying a verdict) or isError:true (naming what could not be established)
 * result.
 */
// Declared as a `function` (hoisted at module INSTANTIATION time), not a
// `const` arrow expression -- REQUIRED, not stylistic, given this plan's own
// registration (07-09): stock-dispatch.ts now imports this name AND
// stock-diagnose.ts imports ensureStockSession (a real, non-type-only
// runtime import) FROM stock-dispatch.ts, so the two modules form a genuine
// two-node runtime cycle. A `const` binding is only initialised when module
// EVALUATION reaches its assignment statement; a `function` declaration is
// initialised during module INSTANTIATION, before ANY module in the whole
// graph starts evaluating -- so it is immune to which module the cycle is
// entered through. Reproduced live: entering the cycle via stock-recycle.ts
// (which also imports resolveStockLiveIrqHandler et al. from this file)
// crashed with "ReferenceError: Cannot access 'handleDiagnoseStock' before
// initialization" at stock-dispatch.ts's own STOCK_DISPATCH_TABLE literal,
// while entering via stock-dispatch.ts itself did not -- an entry-point-
// order-dependent crash is exactly the hazard a `function` declaration
// avoids structurally, matching ensureStockSession's OWN `function`
// declaration in stock-dispatch.ts (never a `const`, for the identical
// reason). See also handleRecycleStock's identical fix in stock-recycle.ts.
// The `DerivedPureHandler` type is still enforced -- see the `satisfies`
// check just below this function.
export async function handleDiagnoseStock(_args: Record<string, unknown>, deps: StockDispatchDeps): Promise<StockToolResult> {
  try {
    const timeoutMs = diagnoseSessionTimeoutMs();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeoutSignal = new Promise<{ timedOut: true }>((resolve) => {
      timeoutHandle = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
    });

    let outcome: EnsureStockSessionOutcome;
    try {
      const raced = await Promise.race([
        ensureStockSession(deps).then((o) => ({ timedOut: false as const, outcome: o })),
        timeoutSignal,
      ]);
      if (raced.timedOut) {
        return diagnoseUnavailableResult(
          "monitor_acquisition_timeout",
          `session acquisition did not complete within ${timeoutMs}ms.`,
        );
      }
      outcome = raced.outcome;
    } catch (err) {
      if (err instanceof MonitorOwnershipError) {
        return diagnoseVerdictResult(
          null,
          "monitor_held_elsewhere",
          { holderGrantId: err.holderGrantId ?? null, holderClaimedAt: err.holderClaimedAt ?? null, port: err.port ?? null },
          renderMonitorHeldElsewhereReport(err),
        );
      }
      if (err instanceof MachineRestartedError) {
        return diagnoseVerdictResult(
          null,
          "restarted",
          { baselineEpoch: err.baselineEpoch ?? null, currentEpoch: err.currentEpoch ?? null },
          renderStockRestartedReport(err.baselineEpoch, err.currentEpoch),
        );
      }
      return diagnoseUnavailableResult(classifyDiagnoseUnavailable(err), describeStockError(err));
    } finally {
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }
    }

    if (!outcome.ok) {
      return diagnoseUnavailableResult("session_refused", outcome.message);
    }
    const session = outcome.session;

    // Step 2: epoch comparison, zero emulator calls.
    const readEpochFn = session.deps.readEpochFn ?? readEpoch;
    const currentRecord: EpochResult | null = session.deps.epochPath ? readEpochFn(session.deps.epochPath) : null;
    if (session.baselineEpoch !== null && currentRecord?.present && currentRecord.epoch !== session.baselineEpoch) {
      return diagnoseVerdictResult(
        session,
        "restarted",
        { baselineEpoch: session.baselineEpoch, currentEpoch: currentRecord.epoch },
        renderStockRestartedReport(session.baselineEpoch, currentRecord.epoch),
      );
    }

    // Step 3: checkpoint-trap evidence, no resume.
    let trapEvidence: StockCheckpointTrapEvidence;
    try {
      trapEvidence = await gatherStockCheckpointTrapEvidence(session, deps);
    } catch (err) {
      return diagnoseUnavailableResult("evidence_gathering_failed", `gathering checkpoint-trap evidence failed (${describeStockError(err)}).`);
    }
    if (trapEvidence.isTrap) {
      return diagnoseVerdictResult(
        session,
        "checkpoint_trap",
        trapEvidence as unknown as Record<string, unknown>,
        renderStockCheckpointTrapReport(trapEvidence),
      );
    }

    // Step 4: the liveness bracket -- the only step that resumes.
    let bracket1: StockLivenessBracketResult;
    try {
      bracket1 = await runStockLivenessBracket(session);
    } catch (err) {
      return diagnoseUnavailableResult("evidence_gathering_failed", `the liveness bracket failed (${describeStockError(err)}).`);
    }

    if (bracket1.advanced === null) {
      return diagnoseErrorResult(inconclusiveBracketText(bracket1));
    }
    if (bracket1.advanced) {
      return diagnoseVerdictResult(session, "live", { bracketsRun: 1, bracket: serializeBracket(bracket1) }, renderStockLiveReport(bracket1));
    }

    // Run a second bracket only when the first shows no advance -- mirroring
    // the fork's own short-circuit.
    let bracket2: StockLivenessBracketResult;
    try {
      bracket2 = await runStockLivenessBracket(session);
    } catch (err) {
      return diagnoseUnavailableResult("evidence_gathering_failed", `the second liveness bracket failed (${describeStockError(err)}).`);
    }

    if (bracket2.advanced === null) {
      return diagnoseErrorResult(inconclusiveBracketText(bracket2));
    }
    if (bracket2.advanced) {
      return diagnoseVerdictResult(
        session,
        "live",
        { bracketsRun: 2, bracket1: serializeBracket(bracket1), bracket2: serializeBracket(bracket2) },
        renderStockLiveReport(bracket2),
      );
    }

    return diagnoseVerdictResult(
      session,
      "wedged",
      { bracketsRun: 2, bracket1: serializeBracket(bracket1), bracket2: serializeBracket(bracket2) },
      renderStockWedgedReport(bracket1, bracket2),
    );
  } catch (err) {
    return diagnoseErrorResult(`vice_diagnose: an unexpected error occurred (${describeStockError(err)}).`);
  }
}

// Compile-time-only check that the function declaration above still
// satisfies DerivedPureHandler's shape -- the type annotation moved off the
// declaration itself (a `function` cannot carry a variable's type
// annotation the way a `const` could), so this is where that contract is
// still enforced. Erased entirely at runtime (a type-only reference).
const _handleDiagnoseStockShapeCheck: DerivedPureHandler = handleDiagnoseStock;
void _handleDiagnoseStockShapeCheck;
