#!/usr/bin/env node
// stock-reproducible-run.ts
//
// THE ONE authoritative place in this repo holding the REPRODUCIBLE-RUN
// PROTOCOL (`REPRO-02`): the ordered sequence that takes an already-open stock
// binary-monitor session to a stop whose four-term identity
// `(PC, hit_count, (LIN, CYC))` is reproducible across pre-protocol jitter.
//
// WHY THIS FILE EXISTS. Measured over `-binarymonitor` on this host, this
// sequence -- connect (which halts the machine) -> arm the frame anchor and the
// target WHILE HALTED -> `RESET` hard -> exactly one `EXIT` -> wait
// event-driven for the target's own `CHECKPOINT_INFO` -> `REGISTERS_GET` --
// produced, at pre-protocol jitter of 0 / 1500 / 4000 ms, ONE identical 64K
// sha256 and ONE identical `(PC=$ea31, hit_count=1, LIN=257, CYC=57)`.
//
// The `RESET` step is what makes that true. The same sequence with the reset
// removed is the CONTROL this phase records red, and that is the whole reason
// the reset lives INSIDE this procedure rather than beside it: `REPRO-02` says
// the protocol must be reached through an optional argument rather than as a
// second route a caller can forget, so there is one procedure, one call site
// (`stock-run-until.ts`'s `handleRunUntil`), and no sub-flags. A caller cannot
// obtain "the protocol without the reset" through any published surface.
//
// WHY THIS SEQUENCE AND NOT THE AUTOSTART ONE. Plan `33-03` measured a SECOND
// ordering for an AUTOSTARTed disk release and settled it as `S3`: arm the
// frame anchor while halted, then `AUTOSTART` (0xdd) -- which is ITSELF the
// power cycle (`autostart.c:1437`), so no `RESET` appears anywhere in it -- then
// `CHECKPOINT_LIST` to assert the anchor survived, then one `EXIT` per observed
// anchor hit to the target count. That ordering is NOT implemented here, and
// deliberately so:
//
//   * `33-03` recorded `AUTOSTART_FRAME_EXACT: not-achieved`. Frame-exactness
//     holds through anchor hit 50 (pre-load) and is LOST from hit 75: the
//     power cycle resets the CPU, VIC-II and CIAs but NOT the absolute emulated
//     clock, and the 1541's rotational phase is a function of that clock.
//   * So the autostarted ordering is UNRESOLVED for a post-load stop, and this
//     module implements the READY-prompt sequence measured green instead --
//     never an ordering the evidence does not support.
//   * The full ordered 11-step `S3` table, its argv, its measured
//     divergence counts, and the withdrawal of the earlier "frame anchoring
//     always fits inside the cap of 64" claim (66 differing addresses at
//     jitter 4000) live in
//     `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-autostart-sequencing.md`.
//     Read that file before adding an autostart path here.
//
// WHAT THIS PROCEDURE REPORTS, AND WHAT IT DOES NOT ASSERT. It REPORTS the stop
// identity it achieved. It does NOT assert frame-exactness -- `33-03`'s
// § "What 33-09 must NOT conclude from this file" is explicit that the right
// sequence is not sufficient for frame-exactness past the start of a disk load,
// and that the honest shape is to report rather than to claim.
//
// WHY `default_memspace` CONTAMINATION CANNOT REACH THIS PROCEDURE. A drive
// checkpoint hit sets `default_memspace` (`monitor.c:3393-3396`) and NO
// binary-monitor command resets it; after that, `ADVANCE_INSTRUCTIONS` and
// `EXECUTE_UNTIL_RETURN` step the DRIVE CPU and `@bank:` conditions fail
// outright. There is no direct remedy over the wire. This procedure is immune
// by CONSTRUCTION, not by luck: every command it sends carries an EXPLICIT
// memspace byte (`0x00` = main, routed through the encoders' own wire-byte
// mapping) or no memspace at all, and it never sends `ADVANCE_INSTRUCTIONS`,
// `EXECUTE_UNTIL_RETURN`, or a `@bank:`-bearing condition. Adding any of those
// three here would make a contaminated `default_memspace` silently retarget
// this procedure at the drive CPU and report a confident stop on the wrong
// processor -- see WHAT NOT TO DO.
//
// WHAT NOT TO DO:
//   - Never wrap the three cleanup paths (hit / timeout / restarted) in one
//     undifferentiated `finally { delete }` -- this design space's documented
//     first-draft mistake, inherited verbatim in substance from
//     `stock-run-until.ts`. Each path takes its OWN action; only the TIMEOUT
//     path deletes the TARGET (the target is temporary, and VICE auto-deletes a
//     temporary checkpoint the instant it fires, `mon_breakpoint.c:605-607`).
//     The ANCHOR is non-temporary, so it is deleted on every path that OWNS it
//     -- hit and timeout -- and on neither the arming-failure nor the
//     machine-restarted path, where there is nothing left to own.
//   - Never call `registerTraceCheckpoint()` here. That guard
//     (`stock-checkpoints.ts`) exists for `stop:false` TRACE checkpoints, and
//     EVERY checkpoint this file arms stops.
//   - Never send a second resume for one wait. Exactly ONE `EXIT` per call,
//     which is `vice-sync.ts`'s own "exactly one resume per wait" invariant
//     ported here in its stock-native (event-driven, not polling) form. The
//     consequence is deliberate and is REPORTED, not papered over: the anchor
//     is armed `stop: true`, so an anchor hit ARRIVING BEFORE the target's
//     halts the machine, no further instructions execute, and the wait bounds
//     out as a TIMEOUT carrying `anchorStoppedFirst: true` and a reason naming
//     it. That is a refusal. Do NOT "fix" it by issuing a second `EXIT` --
//     the multi-resume anchor-COUNTING loop (`33-03`'s `S3` steps 8-10) is an
//     evidence script's job, driving this module's pieces directly, and is not
//     a published tool surface.
//   - Never invent a second wire-error converter. An arming/read failure goes
//     through `convertWireError()` (the established per-handler convention);
//     a failure surfacing from the resume/wait step is left to PROPAGATE
//     uncaught, so the ONE existing converter seam (`withStockSession`'s own
//     `convertHandshakeError`/`convertWireError`) produces the answer.
//   - Never publish a sub-flag that removes a step from this procedure.
//     `D-13`: there is no `skip_reset`, no `no_anchor` and no `reset_only`, so
//     a protocol-without-the-reset is not a shippable option. `RUN_UNTIL_KEYS`
//     in `stock-run-until.ts` is pinned by a single `assert.deepEqual` so a
//     future one reds a test rather than earning a review comment.
//   - Never anchor a stop on a WALL-CLOCK wait. Measured twice: 1242 differing
//     bytes at the READY prompt, and 300 with a differing `LIN` on a real
//     autostarted release. A `setTimeout` is a deadline here, never an anchor.
//   - Never hardcode a wire register id for `PC`, `LIN` or `CYC`. Ids are not
//     stable across builds; `registerCatalogFor()` (`stock-registers.ts`) is
//     the only route from a register NAME to its id, and a build enumerating
//     none of the three is REFUSED by name before anything is armed.
//   - Never add `ADVANCE_INSTRUCTIONS`, `EXECUTE_UNTIL_RETURN` or a `@bank:`
//     condition here -- see the `default_memspace` paragraph above.
//   - Never reuse `readCycleBaseline()` (`stock-timing.ts`) for the triple.
//     On a VICE >= 3.10 build it takes Route A -- `CPUHISTORY_GET` plus a
//     SEPARATE `REGISTERS_GET` for `PC` only -- and never reads `LIN`/`CYC` at
//     all, so it cannot supply the frame term this oracle needs. This module
//     reads all three names out of ONE `REGISTERS_GET` reply unconditionally.
//     That is a different read, not a re-derived seam.
import {
  CommandType,
  CheckpointOperation,
  checkpointSetBody,
  cpNumBody,
  memspaceBody,
  resetBody,
  ResetMode,
  ErrorCode,
  StockProtocolError,
  type ParsedCheckpointInfoResponse,
  type ResolvedResponse,
  type ViceMonitorClient,
} from "./stock-protocol.ts";
import { registerCatalogFor } from "./stock-registers.ts";
import { stockAnswer, isErrorText, convertWireError, type StockToolResult } from "./stock-handler.ts";
import { runStateFor } from "./stock-runstate.ts";
import { compareStopIdentity, ORACLE_TERMS, StopOracleError, type StopIdentity } from "./stop-oracle.ts";
import type { StockConnectSession } from "./stock-connect.ts";

/** The argument name(s) `reproducible: true` cannot run without.
 *
 * `D-14`: the once-per-frame site is RELEASE-SPECIFIC. A cracked release almost
 * always takes over the IRQ, so no KERNAL default (`$EA31` included) is safe to
 * guess -- `33-03` used `$EA31` only because it MEASURED that this particular
 * release leaves it alone, and recorded that as a fact about the release rather
 * than promoting it to a default.
 *
 * Exported so `stock-run-until.ts`'s refusal reads the required name from ONE
 * definition instead of repeating a literal in a second place. */
export const REPRODUCIBLE_RUN_REQUIRED_SIBLINGS = ["frame_anchor"] as const;

/** The register names this procedure must resolve BY NAME before it arms
 * anything. `PC` is the target's stop address; `LIN`/`CYC` are the two halves
 * of the frame term. All three come out of ONE `REGISTERS_GET` reply. */
const REQUIRED_REGISTER_NAMES = ["PC", "LIN", "CYC"] as const;

/** `CHECKPOINT_INFO`'s `hit_count` field offset within the response BODY.
 *
 * THE ONE NUMBER A READER WILL WANT TO SKIP AND MUST NOT: `hit_count` sits at
 * body offset **13** as u32LE. Reading offset 12 instead yields **256** where
 * the truth is **1** -- because offset 12 is the `temporary` flag byte, so a
 * non-temporary checkpoint on its first hit gives `0x00 0x01 0x00 0x00 0x00`
 * and a u32LE read one byte early sees `1 * 256`. That is the worst kind of
 * wrong number: it looks plausible. A frame term of 256 reported as a frame
 * term of 1 would certify two entirely different stops as the same stop.
 *
 * This module does NOT read that offset itself -- `stock-protocol.ts`'s
 * `parseResponse()` CHECKPOINT_INFO branch (`stock-protocol.ts:1370`,
 * `hitCount: body.readUInt32LE(13)`) is the ONE place in this tree that turns
 * those bytes into a number, and duplicating the read here would be a second
 * parse of the same field, which is exactly the drift the single-seam rule
 * exists to prevent (`T-33-32`). The constant is declared and exported so the
 * offset has ONE named definition that `stock-reproducible-run.test.ts` pins
 * end to end: it builds a RAW body whose offset 13 gives 1 and whose offset 12
 * gives 256, runs it through the real `parseResponse()`, and asserts both the
 * parsed value and this procedure's reported frame term are 1. A wrong offset
 * therefore reds with a DISTINGUISHABLE number rather than a plausible one. */
export const CHECKPOINT_INFO_HIT_COUNT_BODY_OFFSET = 13;

/** What `runReproducible()` did, for the caller that wants the record rather
 * than the JSON answer. Returned alongside the answer so `handleRunUntil`
 * stays a one-line branch and tests can assert on structure. */
export interface ReproducibleRunOutcome {
  /** The four-term stop identity, present ONLY on a certified stop. */
  identity?: StopIdentity;
  /** How the wait settled. */
  settled: "hit" | "timeout" | "refused";
  /** The target checkpoint's own hit count -- NOT the frame term. */
  targetHitCount?: number;
}

interface RunReproducibleOptions {
  /** The stop target. Becomes the `pc` term of the stop identity. */
  address: number;
  /** The once-per-frame site whose hit count IS the frame term. */
  frameAnchor: number;
  /** The wait's deadline. A bound, never an anchor. */
  timeoutMs: number;
  /** Passed straight through onto the answer, so the caller's clamp decision
   * is reported by the same handler that made it. */
  timeoutClamped?: boolean;
}

/** True iff `value` is a well-formed, generic JSON object. Matches this module
 * tree's own `isPlainObject()` convention (`vice.ts:310-316`); redeclared
 * privately here, not imported, per the established per-module convention. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Narrows an emitted `event` item to a CHECKPOINT_INFO event -- checked on the
 * PARSED item's own `.type` discriminant, never on response type alone.
 *
 * This matters more here than anywhere else in the tree: FIVE unsolicited
 * message types arrive at request id `0xffffffff` -- `STOPPED` (0x62),
 * `RESUMED` (0x63), `JAM` (0x61), plus `CHECKPOINT_INFO` (0x11) on every
 * checkpoint hit and `REGISTER_INFO` (0x31) on every monitor open -- and the
 * last two SHARE a response type with a legitimate command reply. The demux
 * keys on request id and never resolves a pending request with an event; this
 * predicate is the second half of that discipline, on the listening side. */
function isCheckpointInfoEvent(item: unknown): item is ParsedCheckpointInfoResponse {
  return isPlainObject(item) && item.type === "checkpoint_info" && isPlainObject(item.checkpoint);
}

type ReproducibleWaitOutcome =
  | { status: "hit"; targetHitCount: number; anchorHitsObserved: number; anchorHitCountObserved?: number }
  | { status: "timeout"; anchorHitsObserved: number; anchorHitCountObserved?: number };

/**
 * Installs ONE `event` listener, sends the resume EXACTLY ONCE, and races that
 * against a single timeout deadline and the client's own `close` signal. The
 * listener goes on BEFORE the resume is sent, so a checkpoint firing in the gap
 * between "sent" and "listening" cannot be missed.
 *
 * DISCRIMINATION IS THE POINT (`T-33-31`): status "hit" is reported ONLY on the
 * TARGET's own checkpoint id. An anchor `CHECKPOINT_INFO` never produces a
 * "hit" -- it is counted, so the answer can say the anchor stopped the machine.
 * A wait resolved by the wrong frame would report a confident stop that never
 * happened.
 *
 * `anchorSharesTargetAddress` says whether the two checkpoints were armed at
 * the SAME address, which decides what an anchor frame MEANS:
 *   * different addresses -- the stop:true anchor has halted the machine and
 *     only one resume is ever sent, so the target can never fire. The anchor
 *     frame is TERMINAL, and settles the wait as a timeout at once rather than
 *     burning a deadline whose outcome is already known (33 review WR-01).
 *   * the same address -- one stop emits BOTH checkpoints' frames, so the
 *     target's arrives from that same stop and the wait must CONTINUE
 *     whichever order the monitor emitted them in.
 * Either way, "hit" resolves on the target's id alone.
 *
 * Removes every listener and clears the timer in a `finally` on EVERY path, so
 * a long session never accumulates listeners.
 *
 * Any rejection from the resume send itself (a `MachineRestartedError`, or any
 * other error) propagates OUT of this function uncaught -- see the caller's own
 * comment on why no delete is attempted on that path.
 */
async function waitForReproducibleStop(
  client: ViceMonitorClient,
  targetCheckpointId: number,
  anchorCheckpointId: number,
  timeoutMs: number,
  anchorSharesTargetAddress: boolean,
): Promise<ReproducibleWaitOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onEvent: ((item: unknown) => void) | undefined;
  let onClose: (() => void) | undefined;
  let anchorHitsObserved = 0;
  let anchorHitCountObserved: number | undefined;

  try {
    return await new Promise<ReproducibleWaitOutcome>((resolve, reject) => {
      onEvent = (item: unknown) => {
        if (!isCheckpointInfoEvent(item)) return;
        if (item.checkpoint.id === anchorCheckpointId) {
          // The anchor fired. Count it and record its own hit count -- this
          // frame is not the stop being certified.
          anchorHitsObserved += 1;
          anchorHitCountObserved = item.checkpoint.hitCount;
          // TERMINAL, BUT ONLY WHEN THE TWO SIT AT DIFFERENT ADDRESSES
          // (33 review WR-01).
          //
          // When they differ: the anchor is armed stop:true, so the machine is
          // now HALTED, and this procedure sends exactly ONE resume per wait by
          // design. No further instruction will execute, so the target's frame
          // can never arrive. The outcome is already decided AND already
          // observed -- so settle now instead of waiting out a deadline whose
          // result is known. That deadline runs up to
          // RUN_UNTIL_MAX_TIMEOUT_MS (600 000 ms) while .mcp.json caps a
          // request at 150 000 ms, so burning it meant the carefully written
          // anchorStoppedFirstNote explaining the refusal never reached the
          // caller on any realistic timeout setting -- the request died first.
          //
          // When they are EQUAL this early settle would be WRONG, which is why
          // it is gated. `frameAnchor === address` is a documented legitimate
          // configuration (see step 4: the two differ in their temporary flag
          // and in what they mean, and are deliberately armed as two). At one
          // address BOTH checkpoints match the same instruction, so a single
          // stop emits TWO CHECKPOINT_INFO frames -- the target's arrives from
          // that same stop, needing no further execution, and the order the
          // monitor emits them in is not ours to depend on. Settling on the
          // anchor there would turn the adjacent configuration's successful
          // stop into a spurious refusal.
          //
          // The discrimination invariant (T-33-31) is untouched either way:
          // status "hit" is still only ever reported on the TARGET's id.
          if (!anchorSharesTargetAddress) {
            resolve({ status: "timeout", anchorHitsObserved, anchorHitCountObserved });
          }
          return;
        }
        if (item.checkpoint.id !== targetCheckpointId) return;
        resolve({
          status: "hit",
          targetHitCount: item.checkpoint.hitCount,
          anchorHitsObserved,
          anchorHitCountObserved,
        });
      };
      onClose = () => {
        resolve({ status: "timeout", anchorHitsObserved, anchorHitCountObserved });
      };

      client.on("event", onEvent);
      client.on("close", onClose);
      timer = setTimeout(() => resolve({ status: "timeout", anchorHitsObserved, anchorHitCountObserved }), timeoutMs);

      // THE one resume for this wait. Not in a loop, not retried, not
      // conditional -- see this module's WHAT NOT TO DO.
      client.send(CommandType.Exit).catch(reject);
    });
  } finally {
    if (onEvent) client.off("event", onEvent);
    if (onClose) client.off("close", onClose);
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Arms one stopping exec checkpoint and returns its id, or the refusal.
 *
 * Both `stop: true` and the explicit `memspace: 0x00` are load-bearing:
 *   * `stop: true` -- a NON-stopping checkpoint emits `CHECKPOINT_INFO`
 *     SYNCHRONOUSLY, from inside the CPU loop, on every hit
 *     (`mon_breakpoint.c:557-562` calls `mon_breakpoint_event()` before it
 *     checks `cp->stop`). On a once-per-frame address that stalls the emulator
 *     thread (`T-33-10`).
 *   * `memspace: 0x00` -- routed through `checkpointSetBody`'s own wire-byte
 *     mapping (`0x00` main, `0x01`-`0x04` units 8-11, `0x08` REJECTED), never
 *     by writing `body[8] =` here (`T-33-17`). The wire byte is NOT the
 *     internal enum, and this module never hand-assembles a header or a body.
 */
async function armCheckpoint(
  session: StockConnectSession,
  what: string,
  address: number,
  temporary: boolean,
): Promise<{ ok: true; id: number } | { ok: false; refusal: StockToolResult }> {
  const body = checkpointSetBody({
    start: address,
    end: address,
    stop: true,
    enabled: true,
    operation: CheckpointOperation.Exec,
    temporary,
    memspace: 0x00,
  });

  let response: ResolvedResponse;
  try {
    response = await session.client.send(CommandType.CheckpointSet, body);
  } catch (err) {
    return { ok: false, refusal: convertWireError("vice_run_until", err) };
  }
  if (response.type !== "checkpoint_info") {
    return {
      ok: false,
      refusal: isErrorText(`vice_run_until: unexpected reply type "${response.type}" from the ${what} CHECKPOINT_SET`),
    };
  }
  return { ok: true, id: response.checkpoint.id };
}

type CleanupDisposition = "deleted" | "already_gone" | "delete_failed" | "not_owned";

/** Deletes one checkpoint exactly once. `ObjectMissing` is tolerated as BENIGN
 * (the hit landed between the deadline firing and this delete); any other wire
 * error is RECORDED on the answer, never thrown, so the caller still gets a
 * bounded result. */
async function deleteCheckpoint(
  session: StockConnectSession,
  checkpointId: number,
): Promise<{ disposition: CleanupDisposition; error?: string }> {
  try {
    await session.client.send(CommandType.CheckpointDelete, cpNumBody(checkpointId));
    return { disposition: "deleted" };
  } catch (err) {
    if (err instanceof StockProtocolError && err.errorCode === ErrorCode.ObjectMissing) {
      return { disposition: "already_gone" };
    }
    return { disposition: "delete_failed", error: convertWireError("vice_run_until", err).content[0]!.text };
  }
}

/**
 * THE reproducible-run protocol. One procedure, one call site
 * (`stock-run-until.ts`), the hard reset inside it, no sub-flags.
 *
 * Ordered sequence, and nothing may be inserted between steps 4 and 6:
 *
 *   1. The session ALREADY halted the machine -- connecting opens the monitor,
 *      and `REGISTER_INFO` (0x31) then `STOPPED` (0x62) both arrive at request
 *      id `0xffffffff`. Neither is a command reply and neither is treated as
 *      one. On stock, ANY inbound byte halts the machine.
 *   2. Resolve `PC`, `LIN` and `CYC` BY NAME through `registerCatalogFor()`
 *      (one `REGISTERS_AVAILABLE`, cached per session). Done FIRST, before
 *      anything is armed, so a build that enumerates none of the three is
 *      refused while the machine is still untouched -- refusing beats arming a
 *      run whose frame term could never be read.
 *   3. Arm the FRAME ANCHOR, `temporary: false`. Non-temporary is deliberate:
 *      VICE auto-deletes a temporary checkpoint the instant it fires, and the
 *      anchor must SURVIVE its own hits to keep counting frames.
 *   4. Arm the TARGET, `temporary: true` -- matching `stock-run-until.ts`'s
 *      existing divergence and its cited justification.
 *   5. Issue the monitor-issued HARD RESET (`RESET` 0xcc, `ResetMode.Hard`).
 *      This is the load-bearing step. It is NOT the `RESOURCE_SET`
 *      power-cycle hazard the project's safety constraint names -- a distinct
 *      opcode, needing no deny-list (`resetBody`'s own comment says so
 *      normatively; do not "fix" it by adding one).
 *   6. Issue EXACTLY ONE `EXIT` and wait EVENT-DRIVEN for the TARGET's own
 *      `CHECKPOINT_INFO`, keyed on that checkpoint's id.
 *   7. Read `PC`, `LIN` and `CYC` from ONE `REGISTERS_GET` reply.
 *   8. Read the ANCHOR's hit count -- `CHECKPOINT_GET` (0x11), parsed by the
 *      same one seam, `hit_count` at body offset
 *      `CHECKPOINT_INFO_HIT_COUNT_BODY_OFFSET`. THAT is the frame term. The
 *      target's own hit count is reported separately and is NOT the frame
 *      term; both are named on the answer so a reader never has to infer
 *      which is which.
 *
 * Every refusal below states its REASON. Nothing here degrades: there is no
 * path that reports a stop identity with fewer than four terms, and
 * `compareStopIdentity()` is what enforces that -- it REFUSES a partial record
 * naming the term and the side rather than substituting a zero, a null or a
 * sentinel.
 */
export async function runReproducible(
  session: StockConnectSession,
  { address, frameAnchor, timeoutMs, timeoutClamped = false }: RunReproducibleOptions,
): Promise<{ result: StockToolResult; outcome: ReproducibleRunOutcome }> {
  const refuse = (text: string): { result: StockToolResult; outcome: ReproducibleRunOutcome } => ({
    result: isErrorText(text),
    outcome: { settled: "refused" },
  });

  // --- Step 2: resolve the three register names BEFORE arming anything ------
  let catalog: Awaited<ReturnType<typeof registerCatalogFor>>;
  try {
    catalog = await registerCatalogFor(session);
  } catch (err) {
    return { result: convertWireError("vice_run_until", err), outcome: { settled: "refused" } };
  }
  const resolved = new Map<string, number>();
  const missing: string[] = [];
  for (const name of REQUIRED_REGISTER_NAMES) {
    const entry = catalog.byName.get(name);
    if (entry) resolved.set(name, entry.id);
    else missing.push(name);
  }
  if (missing.length > 0) {
    return refuse(
      `vice_run_until: the reproducible protocol cannot run on this VICE build -- its REGISTERS_AVAILABLE enumeration ` +
        `has no ${missing.join(" and ")} register, and ${missing.length === 1 ? "that name is" : "those names are"} required to read the ` +
        `stop identity's four terms (PC, hit_count, (LIN, CYC)). Register ids are not stable across builds, so no id is ` +
        `guessed here. Refusing before anything is armed beats running to a stop whose frame term could never be read and ` +
        `reporting a two-term identity as if it were the oracle.`,
    );
  }

  // --- Step 3: the frame anchor, non-temporary -----------------------------
  const anchorArm = await armCheckpoint(session, "frame-anchor", frameAnchor, false);
  if (!anchorArm.ok) return { result: anchorArm.refusal, outcome: { settled: "refused" } };
  const anchorCheckpointId = anchorArm.id;

  // --- Step 4: the target, temporary ---------------------------------------
  // Armed as a SECOND, DISTINCT checkpoint even when `frameAnchor === address`:
  // the two differ in their temporary flag and in what they mean, and the wait
  // discriminates on their ids. Adjacency is a legitimate configuration -- the
  // measured green case IS `address === frameAnchor === $ea31` -- not a reason
  // to collapse them into one.
  const targetArm = await armCheckpoint(session, "target", address, true);
  if (!targetArm.ok) {
    await deleteCheckpoint(session, anchorCheckpointId);
    return { result: targetArm.refusal, outcome: { settled: "refused" } };
  }
  const targetCheckpointId = targetArm.id;

  if (targetCheckpointId === anchorCheckpointId) {
    // The monitor handed back the SAME id for two CHECKPOINT_SET calls. The
    // wait discriminates on id, so this state makes the anchor's frames and
    // the target's indistinguishable. Refuse rather than certify a stop that
    // may have been resolved by the wrong frame.
    await deleteCheckpoint(session, targetCheckpointId);
    return refuse(
      `vice_run_until: the binary monitor returned the same checkpoint id (${targetCheckpointId}) for both the frame anchor ` +
        `and the target, so their CHECKPOINT_INFO frames cannot be told apart -- the wait discriminates on checkpoint id. ` +
        `Refusing rather than resolving the wait on a frame that may belong to the anchor and reporting it as the target's stop.`,
    );
  }

  // --- Step 5: the hard reset. The load-bearing step, inside the procedure --
  try {
    await session.client.send(CommandType.Reset, resetBody({ mode: ResetMode.Hard }));
  } catch (err) {
    await deleteCheckpoint(session, targetCheckpointId);
    await deleteCheckpoint(session, anchorCheckpointId);
    return { result: convertWireError("vice_run_until", err), outcome: { settled: "refused" } };
  }

  // --- Step 6: exactly one resume, then the event-driven wait ---------------
  //
  // No try/catch around the wait itself: a MachineRestartedError (or any other
  // failure) surfacing from the resume/wait step propagates straight out,
  // uncaught. This is the THIRD cleanup path, and its correct action is to take
  // NONE -- when the machine has restarted, the instance and every checkpoint
  // on it are already gone, so there is nothing to clean up, and the standard
  // restarted wording is produced by the ONE existing
  // convertHandshakeError()/convertWireError() seam, not a second converter
  // written here.
  const wait = await waitForReproducibleStop(
    session.client,
    targetCheckpointId,
    anchorCheckpointId,
    timeoutMs,
    frameAnchor === address,
  );

  if (wait.status === "timeout") {
    // --- Cleanup path 2 of 3: TIMEOUT. The only path that deletes the -------
    // TARGET (temporary, so it was never auto-deleted -- it never fired). The
    // anchor is non-temporary and is owned here too, so it is deleted as well.
    const targetCleanup = await deleteCheckpoint(session, targetCheckpointId);
    const anchorCleanup = await deleteCheckpoint(session, anchorCheckpointId);

    // machineHalted is DERIVED, never a hand-passed literal: a state flag
    // drifts from reality the moment a call site changes
    // (stock-diagnose.ts:642-656, normative). "delete_failed" is reachable
    // precisely when the socket is already gone, and claiming a halted machine
    // over a dead connection while telling the caller to resume down it is
    // self-contradictory in one JSON body.
    const deleteWasAnswered = targetCleanup.disposition !== "delete_failed";
    const machineHalted = deleteWasAnswered && session.client.connected ? true : runStateFor(session.client) === "stopped";

    const anchorStoppedFirst = wait.anchorHitsObserved > 0;
    const payload: Record<string, unknown> = {
      requested: "run_until",
      protocol: "reproducible",
      reproducibleStop: false,
      reproducibleStopNote:
        "reproducibleStop is false: the target's own CHECKPOINT_INFO did not arrive within the deadline, so NO stop identity " +
        "was established. No term of the four-term oracle (PC, hit_count, (LIN, CYC)) is reported on this answer -- a partial " +
        "stop record would certify two stops as identical on the strength of whichever terms happened to be present.",
      timedOut: true,
      address,
      frameAnchor,
      targetCheckpointId,
      anchorCheckpointId,
      anchorHitsObserved: wait.anchorHitsObserved,
      anchorStoppedFirst,
      anchorStoppedFirstNote: anchorStoppedFirst
        ? "the frame anchor fired BEFORE the target. The anchor is armed stop:true (a non-stopping checkpoint would emit " +
          "CHECKPOINT_INFO synchronously from inside the CPU loop on every hit and stall the emulator thread), so the machine " +
          "HALTED on that hit and no further instructions executed. This procedure sends exactly ONE resume per wait, by " +
          "design, so the wait then bounded out rather than issuing a second EXIT. This is a refusal, not a defect: pick a " +
          "frame_anchor the target is reached from within one resumed run, or drive the multi-resume anchor-counting sequence " +
          "directly (see evidence/33-autostart-sequencing.md) rather than through this tool."
        : "the frame anchor never fired within the deadline, so the anchor did not stop the machine -- the target address " +
          "simply did not execute in time. Verify frame_anchor is a site this release actually executes: a cracked release " +
          "almost always takes over the IRQ, so a KERNAL site such as $EA31 may never run at all.",
      timeoutMs,
      cleanup: targetCleanup.disposition,
      anchorCleanup: anchorCleanup.disposition,
      machineHalted,
      machineHaltedNote: machineHalted
        ? "the cleanup CHECKPOINT_DELETE sent after the timeout halted the emulated machine (on stock, any inbound byte does), " +
          "and nothing here resumed it -- this is expected, not a wedge. Call vice_execution_run to resume."
        : "the machine's run state could NOT be established: the cleanup CHECKPOINT_DELETE did not complete (see cleanupError) " +
          "and/or the connection is gone, so nothing here can claim the machine is halted. Call vice_diagnose before acting.",
      resumes: 1,
      resumesNote:
        "exactly one resume (EXIT) was sent for this wait, which is vice-sync.ts's own invariant in its stock-native " +
        "event-driven form. A second resume is never sent, on any path.",
    };
    if (wait.anchorHitCountObserved !== undefined) payload.anchorHitCountObserved = wait.anchorHitCountObserved;
    if (timeoutClamped) payload.timeoutClamped = true;
    if (targetCleanup.error !== undefined) payload.cleanupError = targetCleanup.error;
    if (anchorCleanup.error !== undefined) payload.anchorCleanupError = anchorCleanup.error;

    return { result: stockAnswer(session.client, payload), outcome: { settled: "timeout" } };
  }

  // --- Cleanup path 1 of 3: HIT. VICE already deleted the TARGET itself -----
  // (temporary; mon_breakpoint.c:605-607), so no delete is issued for it --
  // that would target an object which no longer exists. The ANCHOR is
  // non-temporary and IS owned here, so it is deleted below, after its hit
  // count has been read.

  // --- Step 7: the triple, from ONE REGISTERS_GET reply --------------------
  let registers: ResolvedResponse;
  try {
    registers = await session.client.send(CommandType.RegistersGet, memspaceBody({ memspace: 0x00 }));
  } catch (err) {
    await deleteCheckpoint(session, anchorCheckpointId);
    return { result: convertWireError("vice_run_until", err), outcome: { settled: "refused" } };
  }
  if (registers.type !== "registers") {
    await deleteCheckpoint(session, anchorCheckpointId);
    return refuse(`vice_run_until: expected a registers reply from REGISTERS_GET, got "${registers.type}"`);
  }
  const byId = new Map(registers.registers.map((reg) => [reg.id, reg.value] as const));
  const readByName = (name: string): number | undefined => byId.get(resolved.get(name)!);
  const pc = readByName("PC");
  const line = readByName("LIN");
  const cycle = readByName("CYC");
  // The three `=== undefined` tests are written out rather than folded into
  // `absent.length > 0` so the compiler NARROWS pc/line/cycle to `number` past
  // this guard. That is not a formality: it is what makes it impossible to
  // assemble a StopIdentity from an absent term, which is the same
  // refuse-rather-than-substitute rule stop-oracle.ts enforces at runtime.
  if (pc === undefined || line === undefined || cycle === undefined) {
    const absent = [
      pc === undefined ? "PC" : null,
      line === undefined ? "LIN" : null,
      cycle === undefined ? "CYC" : null,
    ].filter((name): name is string => name !== null);
    await deleteCheckpoint(session, anchorCheckpointId);
    return refuse(
      `vice_run_until: REGISTERS_GET's reply carried no value for ${absent.join(" and ")} despite the build's own ` +
        `REGISTERS_AVAILABLE enumeration listing ${absent.length === 1 ? "it" : "them"}. Refusing rather than reporting a ` +
        `stop identity with ${absent.length === 1 ? "a term" : "terms"} missing.`,
    );
  }

  // --- Step 8: the frame term -- the ANCHOR's own hit count -----------------
  let anchorInfo: ResolvedResponse;
  try {
    anchorInfo = await session.client.send(CommandType.CheckpointGet, cpNumBody(anchorCheckpointId));
  } catch (err) {
    await deleteCheckpoint(session, anchorCheckpointId);
    return { result: convertWireError("vice_run_until", err), outcome: { settled: "refused" } };
  }
  if (anchorInfo.type !== "checkpoint_info") {
    await deleteCheckpoint(session, anchorCheckpointId);
    return refuse(
      `vice_run_until: expected a checkpoint_info reply from the frame anchor's CHECKPOINT_GET, got "${anchorInfo.type}" -- ` +
        `refusing rather than reporting a stop identity whose frame term could not be read.`,
    );
  }
  const anchorHitCount = anchorInfo.checkpoint.hitCount;

  // --- Step 8a: a frame term that counted no frames is NOT a term -----------
  //
  // WHY THIS REFUSAL EXISTS (33 review CR-02). The target can stop before the
  // frame anchor has executed even once -- entirely reachable, and not a
  // pathological case: the anchor is a release-specific once-per-frame site
  // (this module refuses to GUESS one precisely because a cracked release may
  // relocate it or never reach it), while the target may be a loader address
  // hit during boot, before the anchor's frame ever comes round. In that state
  // `anchorHitCount === 0` and `wait.anchorHitsObserved === 0`.
  //
  // Zero is a legal, finite integer, so NOTHING DOWNSTREAM CATCHES IT. The
  // four-term self-check below passes (`requireTerms()` only rejects absent or
  // non-finite terms, and comparing a record against itself is satisfied by
  // any value), and the answer would go out with `reproducibleStop: true` and
  // a complete-looking identity whose frame term carries no frame
  // information. compareStopIdentity() would then report
  // `identical: true, frameTermAsserted: true` for any two such stops HOWEVER
  // MANY FRAMES APART -- which is exactly the confusion this module's own
  // header says the frame term exists to prevent ("two stops one whole frame
  // apart can carry identical (LIN, CYC); PC and hit_count are what
  // distinguish them"). A vacuous frame term is worse than an absent one,
  // because it is indistinguishable from an asserted one.
  //
  // So refuse, in the register the rest of this module uses. The timeout path
  // already sets this precedent: it emits NO oracle term rather than
  // zero-filling one (asserted at stock-reproducible-run.test.ts's
  // no-zero-filled-terms case). This is the hit path's equivalent.
  if (anchorHitCount === 0) {
    await deleteCheckpoint(session, anchorCheckpointId);
    return refuse(
      `vice_run_until: the target stopped at ${anchorHex(address)} before the frame anchor at ` +
        `${anchorHex(frameAnchor)} had executed even once, so the frame term is 0 and carries no frame information -- ` +
        `two stops any number of frames apart would both report hit_count 0 and would certify as the same stop. ` +
        `Refusing rather than reporting a four-term stop identity whose frame term is vacuous. Pick a frame_anchor ` +
        `this release reaches BEFORE the target address.`,
    );
  }

  const anchorCleanup = await deleteCheckpoint(session, anchorCheckpointId);

  // --- The stop identity, and the oracle's own completeness check ----------
  //
  // `hitCount` is the ANCHOR's count (the frame term), and `pc` is the TARGET's
  // stop address. compareStopIdentity() is called against the record itself:
  // that is NOT a tautology, it is the oracle's own four-term VALIDATION --
  // requireTerms() throws a StopOracleError naming the term and the side for
  // any term that is absent or not a finite integer, which is precisely the
  // "refuse rather than silently weaken" property this procedure must have.
  // A three-term answer is unreachable from here by construction.
  const identity: StopIdentity = { pc, hitCount: anchorHitCount, line, cycle };
  try {
    const selfCheck = compareStopIdentity(identity, identity);
    if (!selfCheck.identical || !selfCheck.frameTermAsserted) {
      return refuse(
        `vice_run_until: the assembled stop identity failed its own four-term self-check ` +
          `(differing: ${selfCheck.differingTerms.join(", ") || "none"}, frameTermAsserted: ${selfCheck.frameTermAsserted}) -- refusing.`,
      );
    }
  } catch (err) {
    if (err instanceof StopOracleError) {
      return refuse(
        `vice_run_until: the stop identity is incomplete -- term "${err.term}" could not be established (${err.message}). ` +
          `Refusing rather than reporting a stop certified on fewer than the oracle's four terms.`,
      );
    }
    throw err;
  }

  const payload: Record<string, unknown> = {
    requested: "run_until",
    protocol: "reproducible",
    reproducibleStop: true,
    reached: true,
    address,
    frameAnchor,
    targetCheckpointId,
    anchorCheckpointId,
    targetHitCount: wait.targetHitCount,
    anchorHitsObserved: wait.anchorHitsObserved,
    hitCountNote:
      `hitCount IS the FRAME TERM: the frame anchor's own hit count at ${anchorHex(frameAnchor)}, read from CHECKPOINT_GET. ` +
      `targetHitCount is the TARGET checkpoint's separate count and is NOT a term of the stop identity -- both are named ` +
      `here so neither has to be inferred from the other.`,
    stopIdentityTerms: [...ORACLE_TERMS],
    stopIdentityNote:
      "the four fields named by stopIdentityTerms ARE the stop identity (PC, hit_count, (LIN, CYC)), and all four are " +
      "asserted -- never two. (LIN, CYC) is a WITHIN-FRAME position, not a monotonic clock (stock's binary monitor has no " +
      "monotonic cycle register below VICE 3.10), so two stops one whole frame apart can carry identical (LIN, CYC); the " +
      "frame term is what tells them apart. This procedure REPORTS the identity it achieved and does NOT assert " +
      "frame-exactness: frame-exactness was measured to hold through anchor hit 50 and to be LOST from hit 75, because a " +
      "power cycle resets the CPU/VIC-II/CIAs but not the absolute emulated clock, and the 1541's rotational phase is a " +
      "function of that clock. See evidence/33-autostart-sequencing.md.",
    timeoutMs,
    cleanup: "auto_deleted_by_vice",
    cleanupNote:
      "the target checkpoint was TEMPORARY, and VICE deletes a temporary checkpoint the instant it fires -- no " +
      "CHECKPOINT_DELETE is issued for it on this path. The frame anchor is non-temporary and IS deleted here; see " +
      "anchorCleanup.",
    anchorCleanup: anchorCleanup.disposition,
    machineHalted: true,
    machineHaltedNote:
      "the target checkpoint that just fired STOPPED the emulated machine (it was armed stop:true) and nothing here resumed " +
      "it -- this is expected, not a wedge. Call vice_execution_run to resume. Emitted unconditionally, never only when true, " +
      "so an absent field can never be read as \"not halted\".",
    resumes: 1,
    resumesNote:
      "exactly one resume (EXIT) was sent for this wait -- vice-sync.ts's invariant in its stock-native event-driven form.",
  };
  // The four terms, emitted BY WALKING ORACLE_TERMS rather than as four
  // hand-written keys. This is the assumption-delta `promote` decision made
  // structural: the bare target address is ONE TERM of the stop identity (the
  // `pc` term), not the whole identity alongside it. A future phase
  // reintroducing an address-only certification has to DELETE a field the test
  // reads, and shrinking ORACLE_TERMS shrinks this answer visibly.
  for (const term of ORACLE_TERMS) {
    payload[term] = identity[term];
  }
  if (timeoutClamped) payload.timeoutClamped = true;
  if (anchorCleanup.error !== undefined) payload.anchorCleanupError = anchorCleanup.error;

  return {
    result: stockAnswer(session.client, payload),
    outcome: { identity, settled: "hit", targetHitCount: wait.targetHitCount },
  };
}

/** `$xxxx` for a message. Local, tiny, and deliberately not exported -- this is
 * message formatting, not an address seam; `stock-address.ts` owns PARSING. */
function anchorHex(address: number): string {
  return `$${address.toString(16).padStart(4, "0")}`;
}
