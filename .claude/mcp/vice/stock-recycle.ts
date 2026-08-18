#!/usr/bin/env node
// stock-recycle.ts
//
// THE stock-backend implementation of `vice_recycle` (TIME-04, D-01). The
// destructive action itself -- `lease.brokerControl.recycle(lease.targetId)`
// -- is a broker control-plane RPC already shared by both backends; the
// thing that was fork-only was the EVIDENCE GATHERER feeding the incident
// record before that RPC runs. The fork's own gatherWedgeEvidence()
// (vice-proxy.ts) calls rewriteArguments()/forwardToVice() to translate a
// screenshot's container path to a host path -- exactly the seam
// stock-derived.ts's own header names as the SECOND consumer of this
// project's "derived tools must be intercepted before forwardToVice()"
// constraint (CLAUDE.md). This file is that fix: a stock-native gatherer
// built entirely on plan 07-06's already-exported primitives
// (resolveStockLiveIrqHandler(), gatherStockCheckpointTrapEvidence(),
// runStockLivenessBracket()), with NO screenshot at all -- SHOT-* was cut
// from this milestone's scope (ROADMAP), and stock has no
// vice_display_screenshot to translate a path for in the first place.
//
// The record-before-request ordering (D-17) is preserved byte-for-byte:
// gather evidence -> write the incident record -> only THEN send the
// recycle RPC. There is no argument, branch or environment read between the
// write and the RPC that can reach the RPC with the write skipped.
//
// WHAT NOT TO DO:
//   - Never import vice-proxy.ts, and never call rewriteArguments() or
//     forwardToVice() -- this is the fix for exactly that coupling, not a
//     second instance of it.
//   - Never build a host path, and never call vice_display_screenshot (it
//     does not exist on stock) -- screenshot/snapshot are left `undefined`
//     on the returned IncidentEvidence, a deliberate scope decision
//     (renderIncidentRecord()'s own documented "undefined = not this
//     record's concern" skip), never an `{ available: false }` placeholder
//     that would read as a failed capture.
//   - Never re-derive the liveness bracket, the checkpoint-trap algorithm or
//     the IRQ-handler resolution here -- reuse resolveStockLiveIrqHandler(),
//     gatherStockCheckpointTrapEvidence() and runStockLivenessBracket()
//     verbatim from stock-diagnose.ts (07-06). A second definition of any of
//     these is the "re-deriving a cross-cutting seam locally" anti-pattern
//     this codebase's own CLAUDE.md names.
//   - Never import clearHeldStockSession() from stock-dispatch.ts.
//     stock-dispatch.ts registers handleRecycleStock into
//     STOCK_DISPATCH_TABLE (plan 07-09), so a runtime back-import here would
//     close the module cycle stock-dispatch.ts -> stock-recycle.ts ->
//     stock-dispatch.ts that load-order.test.ts exists to forbid. Only a
//     type-only import of StockDispatchDeps is permitted (it erases
//     completely under verbatimModuleSyntax).
//   - Never let a single evidence step's failure abort the gather, and
//     never let the gather stall the recycle itself -- every step in
//     gatherStockWedgeEvidence() goes through captureStep(), which races a
//     deadline and always resolves rather than rejecting. A wedged machine
//     that fails every read must still produce a record and still recycle.
//
// Registration into STOCK_DISPATCH_TABLE / tools-manifest.stock.json is
// explicitly plan 07-09's job, matching 07-06's own stated output boundary.
import { writeIncidentRecord, finaliseIncidentRecord, type IncidentEvidence, type EvidenceItem } from "./incident-record.ts";
import {
  resolveStockLiveIrqHandler,
  gatherStockCheckpointTrapEvidence,
  runStockLivenessBracket,
  type StockLivenessBracketResult,
} from "./stock-diagnose.ts";
import { handleRegistersGet } from "./stock-registers.ts";
import { stockAnswer, isErrorText, type StockSessionHandler, type StockToolResult } from "./stock-handler.ts";
import { stockDisconnect, type StockConnectSession } from "./stock-connect.ts";
import type { StockDispatchDeps } from "./stock-dispatch.ts";
import { readEpoch } from "./vice.ts";

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function formatAddress(n: unknown): string {
  return typeof n === "number" ? `$${n.toString(16).toUpperCase().padStart(4, "0")}` : "unknown";
}

// ---------------------------------------------------------------------------
// captureStep() -- ported from vice-proxy.ts's own step wrapper (task 1's
// read_first). Races one evidence-gathering step against a deadline,
// turning any rejection, transport failure or deadline expiry into an
// explicit `{ available: false, reason }` entry rather than letting it
// abort the whole gather. Never throws. Module-local -- the fork's own
// captureStep() is proxy-private too, never exported.
// ---------------------------------------------------------------------------

type CaptureStepResult<T> = { available: true; value: T } | { available: false; reason: string };

const DEFAULT_CAPTURE_STEP_TIMEOUT_MS = 8000;

/** Read fresh on EVERY call -- deliberately NOT a module-level constant the
 * way vice-proxy.ts's own CAPTURE_STEP_TIMEOUT_MS is. Same rationale
 * stock-diagnose.ts's diagnoseSessionTimeoutMs()/diagnoseBracketWindowMs()
 * already documents: under this project's ESM/verbatimModuleSyntax setup, a
 * static `import` is hoisted ahead of any top-level statement in the
 * IMPORTING file, so a test file cannot set `process.env` before a
 * load-time module constant is computed without a dynamic re-import per
 * test case -- and this module's own test suite needs both the generous
 * production default AND a sub-50ms deadline (the never-settles case)
 * within a single process. Overridable via `VICE_RECYCLE_CAPTURE_TIMEOUT_MS`
 * -- the SAME environment variable vice-proxy.ts's own step deadline reads,
 * so one knob governs both backends. Exported so the test file can assert
 * the default directly without reaching into process.env itself. */
export function stockCaptureStepTimeoutMs(): number {
  const raw = process.env.VICE_RECYCLE_CAPTURE_TIMEOUT_MS;
  if (raw === undefined || raw === "") return DEFAULT_CAPTURE_STEP_TIMEOUT_MS;
  const parsed = Number(raw);
  // WR-15 (07-REVIEW.md): `> 0`, not `>= 0`. With 0 every capture step's
  // deadline fires immediately, so a DESTRUCTIVE action (a recycle) writes a
  // permanent, repo-tracked incident record containing no evidence at all --
  // and the record itself gives no hint that a misconfiguration, rather than a
  // wedged emulator, is why every item came back unavailable. A rejected value
  // is logged with the default being used; a silent fallback is how a stray 0
  // in a shell profile stays invisible for a whole session.
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  console.error(
    `VICE_RECYCLE_CAPTURE_TIMEOUT_MS=${JSON.stringify(raw)} is not a positive number of milliseconds -- ignoring it and using the ` +
      `default ${DEFAULT_CAPTURE_STEP_TIMEOUT_MS}ms. A value of 0 would make every evidence-capture step time out instantly, ` +
      `producing an evidence-free incident record for a destructive recycle.`,
  );
  return DEFAULT_CAPTURE_STEP_TIMEOUT_MS;
}

async function captureStep<T>(fn: () => Promise<T>): Promise<CaptureStepResult<T>> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const value = await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        const timeoutMs = stockCaptureStepTimeoutMs();
        timer = setTimeout(() => reject(new Error(`capture step deadline of ${timeoutMs}ms exceeded`)), timeoutMs);
      }),
    ]);
    return { available: true, value };
  } catch (e) {
    return { available: false, reason: e && (e as Error).message ? (e as Error).message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// gatherStockWedgeEvidence() -- the four stock-native evidence items.
// ---------------------------------------------------------------------------

/** Shapes a completed bracket into the value formatEvidenceValue()'s
 * `bracket` branch renders (it reads `cycles`/`elapsedMs`, unchanged from
 * incident-record.ts): on the `cpu_history` route `cycles` is the real
 * numeric delta; on the `frame_position` route `cycles` carries the
 * position delta AND an explicit inline note that it is a within-one-frame
 * figure, not a true cycle count -- folded into the same field because
 * incident-record.ts's own renderer only ever prints `cycles`/`elapsedMs`
 * and this module may not add a third rendered field to it. Only called
 * once the caller has already excluded `advanced === null` (the bracket
 * genuinely ran and genuinely compared two same-route samples). */
function bracketEvidenceValue(bracket: StockLivenessBracketResult): Record<string, unknown> {
  if (bracket.before.route === "cpu_history" && bracket.after.route === "cpu_history") {
    // WR-13 (07-REVIEW.md): this value is written into a PERMANENT,
    // repo-tracked incident record, and it used to be the narrowed
    // `Number(...)` with no exact counterpart at all -- so a delta above
    // Number.MAX_SAFE_INTEGER was silently rounded in the one artifact that
    // outlives the session. `cyclesExact` carries the bigint's exact decimal
    // string alongside it (incident-record.ts's renderer only prints
    // `cycles`/`elapsedMs`, so the string rides in `cycles` itself when the
    // narrowing is lossy -- the record must never present a rounded figure as
    // if it were the measurement).
    const exact = bracket.after.cycle - bracket.before.cycle;
    const narrowed = Number(exact);
    if (exact > BigInt(Number.MAX_SAFE_INTEGER)) {
      return {
        cycles: `${exact.toString()} (exact; exceeds Number.MAX_SAFE_INTEGER, so the narrowed JS number ${narrowed} would be rounded)`,
        cyclesExact: exact.toString(),
        elapsedMs: bracket.elapsedMs,
        route: bracket.route,
      };
    }
    return { cycles: narrowed, cyclesExact: exact.toString(), elapsedMs: bracket.elapsedMs, route: bracket.route };
  }
  if (bracket.before.route === "frame_position" && bracket.after.route === "frame_position") {
    const delta = bracket.after.position - bracket.before.position;
    return {
      cycles: `${delta} (frame_position route -- a within-one-frame position delta, not a true cycle count)`,
      elapsedMs: bracket.elapsedMs,
      route: bracket.route,
    };
  }
  // Unreachable in practice -- the caller only reaches here when
  // `advanced !== null`, which runStockLivenessBracket() only produces when
  // before/after share the same non-"unavailable" route. Kept as an
  // explicit, honest fallback rather than a silent cast.
  return { cycles: "unknown", elapsedMs: bracket.elapsedMs, route: bracket.route };
}

/** The bracket's own "cannot measure at all" reason, mirroring
 * stock-diagnose.ts's inconclusiveBracketText() logic (not imported --
 * that function renders a VERDICT explanation, this one renders an
 * EVIDENCE-ITEM `reason`; duplicating the three-line branch is cheaper and
 * clearer than threading a shared formatter across two different rendering
 * contracts). */
function bracketUnavailableReason(bracket: StockLivenessBracketResult): string {
  if (bracket.before.route === "unavailable") return bracket.before.reason;
  if (bracket.after.route === "unavailable") return bracket.after.reason;
  return `the bracket's route changed mid-measurement (before "${bracket.before.route}", after "${bracket.after.route}")`;
}

/** One `runStockLivenessBracket()` call (07-06, reused verbatim), wrapped in
 * captureStep() so a transport failure or step deadline degrades to
 * unavailable. A bracket that ran but could not measure an advance
 * (`advanced === null`) is ALSO reported unavailable here -- never as a
 * fabricated zero -- matching this plan's own "a wedged machine's honest
 * bracket value is 0 only when the bracket genuinely ran and genuinely
 * observed no advance" requirement. */
async function gatherBracketEvidence(session: StockConnectSession): Promise<EvidenceItem> {
  const stepResult = await captureStep(() => runStockLivenessBracket(session));
  if (!stepResult.available) {
    return stepResult;
  }
  const bracket = stepResult.value;
  if (bracket.advanced === null) {
    return { available: false, reason: bracketUnavailableReason(bracket) };
  }
  return { available: true, value: bracketEvidenceValue(bracket) };
}

/** The full register map via handleRegistersGet()'s own answer -- the SAME
 * handler vice_registers_get itself calls -- so `PC` is present exactly
 * when the connected build enumerates it, satisfying
 * formatEvidenceValue()'s `registers` branch (it reads `value.PC`
 * directly). Wrapped in captureStep(); an `isError` answer becomes a thrown
 * Error so captureStep() converts it into `{ available: false, reason }`
 * rather than a silently empty map. */
async function gatherRegistersEvidence(session: StockConnectSession, deps: StockDispatchDeps): Promise<EvidenceItem> {
  return captureStep(async () => {
    const result = await handleRegistersGet({}, session, deps);
    if (result.isError) {
      throw new Error(result.content[0]?.text ?? "vice_registers_get failed with no message");
    }
    const parsed = JSON.parse(result.content[0]!.text) as { registers?: Record<string, number> };
    return parsed.registers ?? {};
  });
}

interface CheckpointEvidenceEntry {
  checkpoint_num: unknown;
  address: string;
  enabled: boolean;
  flag: "stop" | "continue";
}

/** The full checkpoint enumeration from gatherStockCheckpointTrapEvidence()
 * (07-06, reused verbatim -- this is also where the PC read and the IRQ
 * handler resolution this plan's own `irqHandler` item independently
 * re-resolves come from; reusing the whole trap-evidence gatherer here,
 * rather than calling vice_checkpoint_list directly, means this module
 * never re-derives the checkpoint-trap enumeration's own field mapping),
 * mapped onto the `{ checkpoint_num, address, enabled, flag }` shape
 * formatEvidenceValue()'s `checkpoints` branch already renders. When the
 * underlying vice_checkpoint_list call itself refused
 * (`checkpointsUnavailable` set), that refusal is surfaced as THIS step's
 * own unavailability -- an empty-but-available list would misreport a
 * refusal as "no checkpoints armed". */
async function gatherCheckpointsEvidence(session: StockConnectSession, deps: StockDispatchDeps): Promise<EvidenceItem> {
  return captureStep(async () => {
    const trapEvidence = await gatherStockCheckpointTrapEvidence(session, deps);
    if (trapEvidence.checkpointsUnavailable !== undefined) {
      throw new Error(trapEvidence.checkpointsUnavailable);
    }
    return trapEvidence.checkpoints.map(
      (c): CheckpointEvidenceEntry => ({
        checkpoint_num: c.id,
        address: formatAddress(c.start),
        enabled: c.enabled !== false,
        flag: c.stop === true ? "stop" : "continue",
      }),
    );
  });
}

/**
 * Assembles the stock-native evidence set for an incident record: one
 * liveness bracket, the full register snapshot (PC included), the full
 * checkpoint enumeration, and the resolved live IRQ handler -- each
 * gathered through captureStep() above, so no single step can abort the
 * gather or stall the recycle it feeds. `screenshot` and `snapshot` are
 * deliberately absent from the returned object (never `{ available: false
 * }`): SHOT-* was cut from this milestone's scope, and stock has no
 * vice_display_screenshot to attempt in the first place --
 * renderIncidentRecord()'s own documented `undefined` skip is what makes
 * that absence read as a decision rather than a gap.
 */
export async function gatherStockWedgeEvidence(session: StockConnectSession, deps: StockDispatchDeps): Promise<IncidentEvidence> {
  const bracket = await gatherBracketEvidence(session);
  const registers = await gatherRegistersEvidence(session, deps);
  const checkpoints = await gatherCheckpointsEvidence(session, deps);
  const irqHandler = await captureStep(() => resolveStockLiveIrqHandler(session));

  return { bracket, registers, checkpoints, irqHandler };
}

// ---------------------------------------------------------------------------
// handleRecycleStock() -- reason gate, record-before-RPC, teardown.
// ---------------------------------------------------------------------------

/** Mirrors vice-proxy.ts's own recycleAckOutcomeMessage() wording for a
 * broker ack whose kill stage was NOT a successful kill -- the SAME broker
 * produces this ack shape regardless of which backend asked for the
 * recycle (the control-plane RPC is already transport-independent), so the
 * per-outcome vocabulary is the same one. Redeclared locally rather than
 * imported: importing it would mean importing vice-proxy.ts, which this
 * module must never do. */
function recycleAckOutcomeMessage(ack: { outcome: string; kill_stage: string; reason: string }): string {
  const stage = ack.kill_stage || "unknown";
  const reasonSuffix = ack.reason ? ` (${ack.reason})` : "";
  switch (ack.outcome) {
    case "identity_refused":
      return (
        "the host refused to signal the target -- its process identity did not match the binary recorded in its " +
        `own epoch file (kill stage: ${stage}). The instance was NOT killed and is still running.`
      );
    case "target_lookup_failed":
      return `the host could not resolve this session's own recycle target (kill stage: ${stage})${reasonSuffix}.`;
    case "grant_lookup_failed":
      return `the host found no grant record for this session's target (kill stage: ${stage})${reasonSuffix}.`;
    case "epoch_lookup_failed":
      return `the host could not read the target's epoch file (kill stage: ${stage})${reasonSuffix}.`;
    case "pid_lookup_failed":
      return `the target's own epoch file carries no pid to signal (kill stage: ${stage})${reasonSuffix}.`;
    default:
      return `the host reported outcome "${ack.outcome}" (kill stage: ${stage})${reasonSuffix}.`;
  }
}

/**
 * Handles vice_recycle on the stock backend, in load-bearing order:
 *
 *   1. The reason gate, FIRST, before anything else -- a missing,
 *      non-string or whitespace-only `reason` refuses before any lease
 *      consultation, any gather and any write.
 *   2. Re-consult `deps.ensureLease()` for the `HeldLease` -- the
 *      destructive RPC needs `lease.brokerControl`/`lease.targetId`, which
 *      `session.brokerControl` (the narrowed claim/release-only interface)
 *      does not carry. A non-ok outcome returns its own message verbatim;
 *      `lease === null` (the VICE_MCP_URL override) refuses explicitly.
 *   3. Evidence, then record, then RPC -- in that order and no other
 *      (D-17): gatherStockWedgeEvidence() cannot throw and cannot stall
 *      past its own per-step deadlines; writeIncidentRecord() completes
 *      before `lease.brokerControl.recycle()` is ever called, with no
 *      branch between them that can reach the RPC with the write skipped.
 *   4. Each non-ok recycle outcome finalises the record with a distinct
 *      outcome and returns a well-formed refusal naming the record path and
 *      the instance's now-unknown state -- mirroring vice-proxy.ts's own
 *      three-way `broker_gone`/`deadline`/anything-else mapping, never
 *      inventing a fourth.
 *   5. On a confirmed kill, finalise with the success outcome, build the
 *      answer via stockAnswer() (which stamps runState from the STILL-LIVE
 *      client), and only THEN tear the session down via stockDisconnect()
 *      -- CR-05's discipline: release the socket and the broker-side
 *      monitor claim together, so a leaked client never keeps occupying
 *      stock VICE's single client slot. Never imports
 *      clearHeldStockSession(): the held session's now-disconnected client
 *      makes the next ensureStockSession() reconnect, and the epoch has
 *      moved, so stockReconnect() raises the correct MachineRestartedError
 *      through the existing converter -- do not "fix" this by adding that
 *      forbidden import.
 *
 * Never throws: any unexpected error becomes a well-formed `isError: true`
 * result naming whether a record was written and whether the request was
 * sent.
 */
// Declared as a `function` (hoisted at module INSTANTIATION time), not a
// `const` arrow expression -- REQUIRED, not stylistic, matching
// handleDiagnoseStock's identical fix in stock-diagnose.ts. This module
// already imports resolveStockLiveIrqHandler/gatherStockCheckpointTrapEvidence/
// runStockLivenessBracket (real, runtime) from stock-diagnose.ts, which
// itself imports ensureStockSession (real, runtime) from stock-dispatch.ts,
// which (this plan, 07-09) now imports handleRecycleStock back from THIS
// file -- a genuine multi-node runtime cycle. A `const` binding only
// initialises when module EVALUATION reaches its assignment statement; a
// `function` declaration initialises during module INSTANTIATION, before ANY
// module in the graph starts evaluating, so it survives being entered from
// any node in the cycle. Reproduced live: entering via stock-recycle.test.ts
// (-> this file -> stock-diagnose.ts -> stock-dispatch.ts -> back to this
// file for handleRecycleStock, and to stock-diagnose.ts for
// handleDiagnoseStock) crashed with "ReferenceError: Cannot access
// 'handleDiagnoseStock' before initialization" inside stock-dispatch.ts's own
// STOCK_DISPATCH_TABLE literal.
export async function handleRecycleStock(args: Record<string, unknown>, session: StockConnectSession, deps: StockDispatchDeps): Promise<StockToolResult> {
  const rawReason = args && typeof args.reason === "string" ? args.reason : "";
  const reason = rawReason.trim();
  if (!reason) {
    return isErrorText(
      'vice_recycle requires a non-empty "reason" string naming why this recycle is happening -- it ' +
        "becomes the incident record's own explanation, written before anything is killed. No record " +
        "and no request were written.",
    );
  }

  let recordWritten = false;
  let requestSent = false;
  let recordPath: string | null = null;

  try {
    const leaseOutcome = await deps.ensureLease();
    if (!leaseOutcome.ok) {
      // Verbatim -- ensureBrokerLease()'s own broker-liveness diagnostic,
      // never re-worded here. Nothing has been gathered or written.
      return isErrorText(leaseOutcome.message);
    }

    const lease = leaseOutcome.lease;
    if (lease === null) {
      return isErrorText(
        "vice_recycle: VICE_MCP_URL is set, so there is no broker control session to recycle through -- recycle " +
          "only applies to a broker-managed instance. No record and no request were written.",
      );
    }

    const at = new Date().toISOString();
    const readEpochFn = session.deps.readEpochFn ?? readEpoch;
    const epochResult = lease.epochFile ? readEpochFn(lease.epochFile) : null;
    const epochBefore = epochResult && epochResult.present ? epochResult.epoch : null;
    const sessionId = process.env.CLAUDE_CODE_SESSION_ID || null;

    // Evidence, then record, then RPC -- in that order and no other (D-17).
    // gatherStockWedgeEvidence() cannot throw and cannot stall past its own
    // per-step deadlines, so this line always completes.
    const evidence = await gatherStockWedgeEvidence(session, deps);

    // The record is written BEFORE the request -- capturing is structurally
    // impossible to skip, not a discipline to remember (the fork's own
    // D-17 ordering comment, vice-proxy.ts's handleRecycle()).
    recordPath = writeIncidentRecord({
      at,
      port: lease.port,
      epoch_before: epochBefore,
      reason,
      session_id: sessionId,
      evidence,
    });
    recordWritten = true;

    const recycled = await lease.brokerControl.recycle(lease.targetId);
    requestSent = true;

    if (!recycled.ok) {
      const outcome = recycled.kind === "broker_gone" ? "broker_gone" : recycled.kind === "deadline" ? "timeout" : "internal";
      finaliseIncidentRecord(recordPath, { outcome });
      if (recycled.kind === "broker_gone") {
        return isErrorText(
          `vice_recycle: the broker is no longer reachable (${recycled.message}). Incident record: ${recordPath}. ` +
            "This recycle's own kill request may or may not have reached the broker before the connection dropped -- " +
            "the instance's state is now unknown.",
        );
      }
      if (recycled.kind === "deadline") {
        return isErrorText(
          `vice_recycle: no ack arrived from the host within the timeout (${recycled.message}). Incident record: ` +
            `${recordPath}. The instance's state is now unknown -- treat it as neither confirmed killed nor confirmed alive.`,
        );
      }
      return isErrorText(
        `vice_recycle: the recycle request failed (${recycled.kind}: ${recycled.message}). Incident record: ${recordPath}. ` +
          "The instance's state is now unknown -- treat it as neither confirmed killed nor confirmed alive.",
      );
    }

    const ack = recycled.ack;
    const killStage = ack.kill_stage;
    const successfulKill = killStage === "already_exited" || killStage === "sigterm" || killStage === "sigkill";

    if (!successfulKill) {
      finaliseIncidentRecord(recordPath, { outcome: ack.outcome || "refused", kill_stage: killStage });
      return isErrorText(`vice_recycle: ${recycleAckOutcomeMessage(ack)} Incident record: ${recordPath}.`);
    }

    finaliseIncidentRecord(recordPath, { outcome: "ok", kill_stage: killStage });

    // stockAnswer() stamps runState from session.client -- read BEFORE the
    // teardown below disconnects it, so the answer reports the machine's
    // real last-known state rather than whatever a disconnected client
    // would report.
    const answer = stockAnswer(session.client, { recycled: true, recordPath, killStage });

    await stockDisconnect(session);

    return answer;
  } catch (err) {
    return isErrorText(
      `vice_recycle: an unexpected error occurred (${describeError(err)}). Record written: ${recordWritten}` +
        `${recordPath ? ` (${recordPath})` : ""}. Request sent: ${requestSent}.`,
    );
  }
}

// Compile-time-only check that the function declaration above still
// satisfies StockSessionHandler's shape -- the type annotation moved off the
// declaration itself (a `function` cannot carry a variable's type
// annotation the way a `const` could), so this is where that contract is
// still enforced. Erased entirely at runtime (a type-only reference).
const _handleRecycleStockShapeCheck: StockSessionHandler = handleRecycleStock;
void _handleRecycleStockShapeCheck;
