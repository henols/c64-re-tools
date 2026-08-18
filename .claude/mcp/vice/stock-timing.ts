#!/usr/bin/env node
// stock-timing.ts
//
// THE stock-backend implementation of `vice_cycles_stopwatch` (TIME-01), plus
// the two shared primitives (readCycleBaseline()/resolveVideoStandard()) that
// a later plan's `stock-diagnose.ts` liveness bracket reuses verbatim.
//
// WHY THIS FILE EXISTS: stock VICE's binary monitor has no monotonic cycle
// register at all (CLAUDE.md's own Protocol constraint) -- the fork's
// in-process `mon_stopwatch_get_elapsed()` has no wire equivalent. Two
// routes exist, chosen from Phase 2's BACK-04 capability resolution
// (`session.capabilities.cpuHistory`, settled once per connect, never
// re-probed here): Route A (VICE >= 3.10) reads CPUHISTORY_GET's newest
// entry's monotonic uint64 `cycle` field and is exact for any bracket
// length; Route B (below 3.10) reconstructs a within-frame position from
// `LIN`/`CYC` and is exact only within one frame, refusing explicitly the
// moment a frame boundary is PROVEN crossed (TIME-03) rather than guessing a
// correction.
//
// WHAT NOT TO DO:
//   - Never assign `cycles: 0` or `cycles: null` for an unmeasurable
//     bracket. `measurable: false` with a `reason` and NO `cycles` key at
//     all is the only honest shape -- see the incident this rule exists to
//     prevent: `.claude/skills/c64-program-recon/references/observation-hazards.md`'s
//     record of the fork's stopwatch reading 258,504,308 cycles and being
//     trusted as fact.
//   - Never hardcode a register id for LIN/CYC/PC. `registerCatalogFor()`
//     (stock-registers.ts) is the only route from a register NAME to its
//     wire id -- ids are not stable across builds.
//   - Never guess a `+ k * cyclesPerFrame` correction for an unknown `k`
//     when Route B proves a frame boundary was crossed. `CPUHISTORY_GET`
//     (VICE >= 3.10) is the only route that can measure that bracket; name
//     it in the refusal rather than approximate past it.
//   - Never add a `resourceSetBody()`/`RESOURCE_SET` call here.
//     `MachineVideoStandard`'s SET side reaches
//     `machine_trigger_reset(POWER_CYCLE)` one call deep (CLAUDE.md's Safety
//     constraint) -- this file only ever sends RESOURCE_GET (0x51), read-side
//     only, and only for this one resource name.
import {
  CommandType,
  memspaceBody,
  resourceGetBody,
  StockConnectionClosedError,
  StockRequestTimeoutError,
  type ParsedCpuHistoryEntry,
  type StockProtocolError,
} from "./stock-protocol.ts";
import { MachineRestartedError } from "./vice.ts";
import { clampCpuHistoryCount, type StockConnectSession } from "./stock-connect.ts";
import { registerCatalogFor } from "./stock-registers.ts";
import { stockAnswer, convertWireError, isErrorText, type StockSessionHandler, type StockOkResult } from "./stock-handler.ts";

// ---------------------------------------------------------------------------
// Video standards -- MachineVideoStandard's OWN integer resource values,
// 1-based (never 0-based). [CITED c64/c64.h:36-58, machine.h:57-60] The
// familiar "PAL is 19656 cycles/frame" figure is 63 * 312 -- documented here
// for orientation only; nothing in this file multiplies cyclesPerLine by
// screenLines and stores the literal product as a constant. Every consumer
// of this table derives that product itself, from these two fields, so a
// wrong PAL-only assumption cannot silently survive a video-standard change.
// ---------------------------------------------------------------------------

export interface VideoStandardEntry {
  cyclesPerLine: number;
  screenLines: number;
  name: string;
}

export const VIDEO_STANDARDS: Record<number, VideoStandardEntry> = {
  1: { cyclesPerLine: 63, screenLines: 312, name: "PAL" }, // MACHINE_SYNC_PAL
  2: { cyclesPerLine: 65, screenLines: 263, name: "NTSC" }, // MACHINE_SYNC_NTSC
  3: { cyclesPerLine: 64, screenLines: 262, name: "NTSC-old" }, // MACHINE_SYNC_NTSCOLD
  4: { cyclesPerLine: 65, screenLines: 312, name: "PAL-N" }, // MACHINE_SYNC_PALN
};

/** MachineVideoStandard's own documented default -- returned when the
 * resource read fails or answers a value outside VIDEO_STANDARDS. [CITED
 * c64/c64-resources.c:438] */
const PAL_STANDARD_VALUE = 1;

export interface VideoStandardResult {
  /** MachineVideoStandard's own integer value -- 1 (the PAL default) when
   * `assumed` is true. */
  value: number;
  cyclesPerLine: number;
  screenLines: number;
  name: string;
  /** True when this result was NOT read from the emulator -- the wire
   * read failed, or it answered something not in VIDEO_STANDARDS. A caller
   * must report this rather than presenting the PAL fallback as an
   * observation (T-07-13). */
  assumed: boolean;
  /** Present only when `assumed` is true -- names why. */
  reason?: string;
}

/** Per-`session.targetId` cache of the resolved video standard -- a
 * SUCCESSFUL read only. A `resolveVideoStandard()` fallback (assumed: true)
 * is deliberately never cached, so a transient wire failure gets a fresh
 * chance to resolve for real on the next call, rather than pinning a
 * degraded answer for the rest of the session.
 *
 * Keyed on `session.targetId` (a plain string), not the session object
 * itself, matching this plan's own instruction -- unlike
 * `bankCatalogFor()`'s/`registerCatalogFor()`'s object-keyed `WeakMap`s. The
 * two caches solve different problems: those cache a per-CONNECTION
 * enumeration that a fresh `stockReconnect()` naturally invalidates by
 * handing back a new session object; this caches a per-TARGET machine
 * property. `MachineVideoStandard`'s only WRITE path
 * (`RESOURCE_SET`) reaches `machine_trigger_reset(POWER_CYCLE)` one call
 * deep (CLAUDE.md), and this file adds no `RESOURCE_SET` encoder at all --
 * so within this codebase's own reach, the value can never change out from
 * under a live target, and a `targetId`-keyed cache cannot go stale for a
 * reason this file itself could cause.
 *
 * WR-14 (07-REVIEW.md) added the EPOCH half. `session.targetId` survives both a
 * `stockReconnect()` and a `vice_recycle` respawn, so a `targetId`-keyed entry
 * outlives the machine it describes -- a respawned instance can be a different
 * build or a different model entirely. Every entry therefore records the
 * `baselineEpoch` of the session that established it, and an entry whose epoch
 * does not match the reading session's is treated as a MISS, not as a value. */
interface CachedVideoStandard {
  result: VideoStandardResult;
  /** The `session.baselineEpoch` in force when this was read. `null` means
   * identity could not be proven at connect time; a `null` entry is only ever
   * reused by another `null`-epoch session on the same target, which is the
   * most this file can honestly claim. */
  epoch: number | null;
}

let videoStandardCache = new Map<string, CachedVideoStandard>();

function palFallback(reason: string): VideoStandardResult {
  const pal = VIDEO_STANDARDS[PAL_STANDARD_VALUE]!;
  return { value: PAL_STANDARD_VALUE, cyclesPerLine: pal.cyclesPerLine, screenLines: pal.screenLines, name: pal.name, assumed: true, reason };
}

/**
 * Resolves the connected target's video standard via RESOURCE_GET (0x51,
 * read-side only -- see this file's header comment), caching a successful
 * read per `session.targetId`. Never throws: a rejecting `send()`, an
 * unexpected reply shape, or a value not in `VIDEO_STANDARDS` all fall back
 * to a PAL result carrying `assumed: true` and a `reason`, so every caller
 * can report the assumption rather than present it as an observation
 * (T-07-13).
 */
export async function resolveVideoStandard(session: StockConnectSession): Promise<VideoStandardResult> {
  const cached = videoStandardCache.get(session.targetId);
  // WR-14: a cache hit must ALSO match the session's epoch -- a targetId alone
  // cannot distinguish this machine from the one that replaced it.
  if (cached && cached.epoch === session.baselineEpoch) {
    return cached.result;
  }
  if (cached) {
    videoStandardCache.delete(session.targetId);
  }

  try {
    const response = await session.client.send(CommandType.ResourceGet, resourceGetBody({ name: "MachineVideoStandard" }));
    if (response.type !== "resource_get" || response.valueType !== "integer") {
      const observedType = response.type === "resource_get" ? `valueType "${response.valueType}"` : `reply type "${response.type}"`;
      return palFallback(`resolveVideoStandard: MachineVideoStandard resource replied with an unexpected shape (${observedType}) -- assuming PAL`);
    }
    const entry = VIDEO_STANDARDS[response.value];
    if (!entry) {
      return palFallback(`resolveVideoStandard: MachineVideoStandard resource returned an unrecognized value (${response.value}) -- assuming PAL`);
    }
    const result: VideoStandardResult = { value: response.value, cyclesPerLine: entry.cyclesPerLine, screenLines: entry.screenLines, name: entry.name, assumed: false };
    videoStandardCache.set(session.targetId, { result, epoch: session.baselineEpoch });
    return result;
  } catch (err) {
    // WR-17 (07-REVIEW.md): a TRANSPORT failure is not a value-shaped failure
    // and must NOT be laundered into "assuming PAL".
    //
    // This is the last wire call inside Route B's readCycleBaseline(), which
    // runStockLivenessBracket() calls -- so a socket that dies HERE used to be
    // swallowed, and 07-15's new `connection_lost` / `request_timeout`
    // diagnosis_unavailable reason classes (which both the stock manifest and
    // vice-wedge-triage/SKILL.md now promise) could never be reached from this
    // path. The failure re-surfaced later, if at all, as
    // `evidence_gathering_failed`. The new classification is only ever as
    // honest as the narrowest catch on the path, and this was it.
    //
    // Rethrow the three typed conditions that mean "the connection or the
    // machine, not the value": handleCyclesStopwatch()'s own
    // convertWireError() and handleDiagnoseStock()'s classifier both know what
    // to do with them. Keep the PAL fallback for value-shaped failures only
    // (an unexpected reply shape, an unrecognised standard, a build with no
    // such resource). Do NOT widen this back to a bare catch.
    if (err instanceof MachineRestartedError || err instanceof StockConnectionClosedError || err instanceof StockRequestTimeoutError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    return palFallback(`resolveVideoStandard: reading the MachineVideoStandard resource failed (${message}) -- assuming PAL`);
  }
}

/** Pure frame-position arithmetic: `lin * cyclesPerLine + cyc`, bounded
 * `0..(screenLines * cyclesPerLine - 1)`. [Pattern 3, 07-RESEARCH.md] */
export function positionWithinFrame(lin: number, cyc: number, cyclesPerLine: number): number {
  return lin * cyclesPerLine + cyc;
}

// ---------------------------------------------------------------------------
// readCycleBaseline() -- the shared, dual-route primitive.
// ---------------------------------------------------------------------------

export interface CpuHistoryBaseline {
  route: "cpu_history";
  cycle: bigint;
  pc: number;
}

export interface FramePositionBaseline {
  route: "frame_position";
  lin: number;
  cyc: number;
  pc: number;
  standard: VideoStandardResult;
  position: number;
}

export interface UnavailableBaseline {
  route: "unavailable";
  reason: string;
}

export type CycleBaseline = CpuHistoryBaseline | FramePositionBaseline | UnavailableBaseline;

/** Route A's one extra REGISTERS_GET for PC -- Route B reads PC out of the
 * SAME REGISTERS_GET reply it already needs for LIN/CYC (see
 * `readCycleBaseline()` below), so this helper exists only for Route A.
 *
 * Exported (07-14) so `stock-run-until.ts` can reuse this one existing
 * PC-read seam to resolve the already_gone cleanup race, rather than
 * re-deriving a second one. No test in this tree asserts these throw
 * messages' exact strings (grep-verified against `readCycleBaseline:` at
 * 07-14 plan time), so they are named for what this function does, not for
 * the caller that historically was its only one. */
export async function readProgramCounter(session: StockConnectSession): Promise<number> {
  const catalog = await registerCatalogFor(session);
  const pcEntry = catalog.byName.get("PC");
  if (!pcEntry) {
    throw new Error("readProgramCounter: the connected VICE build's REGISTERS_AVAILABLE enumeration has no \"PC\" register");
  }
  const response = await session.client.send(CommandType.RegistersGet, memspaceBody({ memspace: 0x00 }));
  if (response.type !== "registers") {
    throw new Error(`readProgramCounter: expected a registers reply, got "${response.type}"`);
  }
  const found = response.registers.find((reg) => reg.id === pcEntry.id);
  if (!found) {
    throw new Error("readProgramCounter: REGISTERS_GET's reply did not include a value for \"PC\" despite the catalog enumerating it");
  }
  return found.value;
}

/**
 * The shared cycle-baseline primitive `handleCyclesStopwatch()` below and
 * (07-06) `stock-diagnose.ts`'s liveness bracket both consume. Route
 * selection is a SINGLE read of `session.capabilities.cpuHistory` -- Phase
 * 2's BACK-04 already settled this once per connect; there is no second
 * probe here (Pattern 2, 07-RESEARCH.md).
 *
 * Returns a `"route"`-discriminated record, never a fabricated figure:
 *   - `"cpu_history"`: Route A. CPUHISTORY_GET's newest entry's exact
 *     bigint `cycle` -- the LAST element of `entries[]`, which arrives
 *     oldest-first (WR-07) -- plus PC via one extra REGISTERS_GET.
 *   - `"frame_position"`: Route B. `LIN`/`CYC`/`PC` all read from ONE
 *     REGISTERS_GET reply, plus the resolved video standard and the
 *     computed within-frame `position`.
 *   - `"unavailable"`: the connected build enumerates neither `LIN` nor
 *     `CYC` by name -- named in `reason`, never a substituted zero.
 */
export async function readCycleBaseline(session: StockConnectSession): Promise<CycleBaseline> {
  if (session.capabilities.cpuHistory === "available") {
    // Route A: CPUHISTORY_GET(count:1) -- NEVER count:0, which real VICE
    // rejects with InvalidParameter (the Wave-0 defect 07-01 fixed).
    const count = clampCpuHistoryCount(1);
    const body = Buffer.alloc(5);
    body[0] = 0x00; // memspace: main
    body.writeUInt32LE(count, 1);
    const response = await session.client.send(CommandType.CpuHistoryGet, body);
    if (response.type !== "cpu_history") {
      throw new Error(`readCycleBaseline: expected a cpu_history reply, got "${response.type}"`);
    }
    if (response.entries.length === 0) {
      throw new Error("readCycleBaseline: CPUHISTORY_GET(count:1) returned zero entries");
    }
    // WR-07 (07-REVIEW.md): entries[] is in WIRE order -- entries[0] is the
    // OLDEST of the returned window, entries[length-1] the NEWEST. 07-12
    // proved this against fixtures/binmon/cpuhistory-get-multi.bin (four
    // entries, strictly ascending cycles) and corrected the parser's own
    // documentation, but this consumer still read entries[0] and named it
    // `newest`. That is correct ONLY while count === 1, and nothing enforces
    // that coupling: the parser returns whatever `count` the server sent, so a
    // future caller -- or a build that returns a full window regardless of the
    // requested count -- would silently sample the OLDEST entry and report a
    // stale baseline with `exactness: "exact"`. Index from the END so this
    // stays correct if the window ever grows, and do not rename this back to a
    // positional read: the misleading identifier is what would make such a
    // change look correct.
    const newest: ParsedCpuHistoryEntry = response.entries[response.entries.length - 1]!;
    const pc = await readProgramCounter(session);
    return { route: "cpu_history", cycle: newest.cycle, pc };
  }

  // Route B: the build's own catalog must enumerate BOTH LIN and CYC by
  // name -- never a hardcoded register id (this file's own WHAT NOT TO DO).
  const catalog = await registerCatalogFor(session);
  const lin = catalog.byName.get("LIN");
  const cyc = catalog.byName.get("CYC");
  if (!lin || !cyc) {
    const missing = [!lin ? "LIN" : null, !cyc ? "CYC" : null].filter((name): name is string => name !== null).join(" and ");
    return {
      route: "unavailable",
      reason: `readCycleBaseline: the connected VICE build's REGISTERS_AVAILABLE enumeration has no ${missing} register -- frame-position reconstruction is impossible without it`,
    };
  }

  const response = await session.client.send(CommandType.RegistersGet, memspaceBody({ memspace: 0x00 }));
  if (response.type !== "registers") {
    throw new Error(`readCycleBaseline: expected a registers reply, got "${response.type}"`);
  }
  const byId = new Map(response.registers.map((reg) => [reg.id, reg.value] as const));
  const linValue = byId.get(lin.id);
  const cycValue = byId.get(cyc.id);
  if (linValue === undefined || cycValue === undefined) {
    return {
      route: "unavailable",
      reason: "readCycleBaseline: REGISTERS_GET's reply did not include a value for LIN and/or CYC despite the catalog enumerating them",
    };
  }
  const pcEntry = catalog.byName.get("PC");
  const pcValue = pcEntry ? byId.get(pcEntry.id) : undefined;
  if (pcValue === undefined) {
    throw new Error("readCycleBaseline: REGISTERS_GET's reply did not include a value for \"PC\"");
  }

  const standard = await resolveVideoStandard(session);
  const position = positionWithinFrame(linValue, cycValue, standard.cyclesPerLine);
  return { route: "frame_position", lin: linValue, cyc: cycValue, pc: pcValue, standard, position };
}

// ---------------------------------------------------------------------------
// resetTimingStateForTest() -- clears BOTH module-level caches this file
// owns (the video-standard cache above, and the stopwatch baseline store
// below), matching resetBankCatalogsForTest()'s / resetCheckpointStateForTest()'s
// per-file, single-call reset convention.
// ---------------------------------------------------------------------------

/** The stopwatch's own per-target baseline store (Task 2) -- declared here,
 * ahead of handleCyclesStopwatch(), so resetTimingStateForTest() can clear
 * both this file's caches from one place.
 *
 * WR-14 (07-REVIEW.md): each entry records the `baselineEpoch` of the session
 * that recorded it. `session.targetId` survives a `stockReconnect()` AND a
 * `vice_recycle` respawn, so keying on it alone let the stopwatch compare a
 * baseline taken on one machine against a sample taken on its replacement.
 * Only Route A had a `delta < 0n` guard to catch that accidentally; Route B
 * compared two unrelated within-frame positions and answered
 * `measurable: true`. An epoch mismatch is now a first-class refusal on BOTH
 * routes, checked before either route's own arithmetic. */
interface StoredBaseline {
  baseline: CycleBaseline;
  epoch: number | null;
}

let stopwatchBaselines = new Map<string, StoredBaseline>();

export function resetTimingStateForTest(): void {
  videoStandardCache = new Map<string, CachedVideoStandard>();
  stopwatchBaselines = new Map<string, StoredBaseline>();
}

/**
 * WR-14: THE per-target eviction seam for both of this file's `targetId`-keyed
 * caches, mirroring stock-checkpoints.ts's `forgetConditionsForOtherTargets()`
 * exactly -- including being called from the SAME place in
 * stock-dispatch.ts's ensureStockSession(), so the two registries can never
 * drift apart on when they forget.
 *
 * Reaching that call site means a fresh handshake just installed a new held
 * session, so every OTHER target this process has seen is an instance that has
 * already been torn down and can never be consulted again. Without this, both
 * maps (strong `Map`s, deliberately, so they survive a `stockReconnect()` to
 * the same machine) grow one entry per distinct instance for the life of the
 * process -- which a broker that recycles/respawns/re-warms routinely makes
 * unbounded.
 *
 * Deliberately does NOT touch the ACTIVE target's entries: a reconnect to the
 * same machine must keep a usable stopwatch baseline, and the epoch check
 * inside handleCyclesStopwatch() is what catches the case where "the same
 * targetId" is not the same machine.
 */
export function forgetTimingForOtherTargets(activeTargetId: string): void {
  for (const targetId of videoStandardCache.keys()) {
    if (targetId !== activeTargetId) videoStandardCache.delete(targetId);
  }
  for (const targetId of stopwatchBaselines.keys()) {
    if (targetId !== activeTargetId) stopwatchBaselines.delete(targetId);
  }
}

// ---------------------------------------------------------------------------
// handleCyclesStopwatch -- vice_cycles_stopwatch (TIME-01/TIME-03).
//
// An unmeasurable bracket emits NO `cycles` key at all -- `0` is a wrong
// answer, not a null answer.
// ---------------------------------------------------------------------------

const VALID_ACTIONS = ["reset", "read", "reset_and_read"] as const;
type StopwatchAction = (typeof VALID_ACTIONS)[number];

function isValidAction(value: unknown): value is StopwatchAction {
  return typeof value === "string" && (VALID_ACTIONS as readonly string[]).includes(value);
}

export const handleCyclesStopwatch: StockSessionHandler = async (args, session) => {
  const unexpectedKeys = Object.keys(args).filter((key) => key !== "action");
  if (unexpectedKeys.length > 0) {
    return isErrorText(`vice_cycles_stopwatch: unexpected argument(s): ${unexpectedKeys.join(", ")} -- this tool takes only "action"`);
  }
  const rawAction = args.action;
  if (!isValidAction(rawAction)) {
    return isErrorText(
      `vice_cycles_stopwatch: "action" is required and must be one of ${VALID_ACTIONS.join(", ")}, got ${JSON.stringify(rawAction)}`,
    );
  }
  const action = rawAction;

  let sample: CycleBaseline;
  try {
    sample = await readCycleBaseline(session);
  } catch (err) {
    return convertWireError("vice_cycles_stopwatch", err as StockProtocolError | Error);
  }

  if (action === "reset") {
    stopwatchBaselines.set(session.targetId, { baseline: sample, epoch: session.baselineEpoch });
    return stockAnswer(session.client, {
      requested: "cycles_stopwatch",
      action: "reset",
      route: sample.route,
      measurable: false,
      reason: "a baseline was recorded; call read to measure elapsed cycles",
    });
  }

  // action is "read" or "reset_and_read" from here on.
  const stored = stopwatchBaselines.get(session.targetId);

  function finish(payload: Record<string, unknown>): StockOkResult {
    // reset_and_read stores the new sample as the NEXT baseline on EVERY
    // path, including the unmeasurable ones -- a failed measurement must
    // not silently leave a stale baseline behind.
    if (action === "reset_and_read") {
      stopwatchBaselines.set(session.targetId, { baseline: sample, epoch: session.baselineEpoch });
    }
    return stockAnswer(session.client, { requested: "cycles_stopwatch", action, ...payload });
  }

  if (!stored) {
    return finish({
      route: sample.route,
      measurable: false,
      reason: `no baseline recorded on this instance -- call vice_cycles_stopwatch with action:"reset" before action:"${action}"`,
    });
  }

  // WR-14: the epoch check, BEFORE either route's arithmetic. `targetId`
  // survives a stockReconnect() and a vice_recycle respawn, so a matching key
  // does not prove the baseline and the sample came from the same machine.
  // Only Route A had a `delta < 0n` guard that caught this by accident; Route B
  // happily subtracted two unrelated within-frame positions and answered
  // `measurable: true`. Refusing here covers both routes for the real reason
  // rather than one route for a coincidental one.
  if (stored.epoch !== session.baselineEpoch) {
    return finish({
      route: sample.route,
      measurable: false,
      reason:
        `the baseline was recorded against restart epoch ${String(stored.epoch)} but this session's epoch is ` +
        `${String(session.baselineEpoch)} -- the emulator was restarted, recycled or respawned in between, so the two samples ` +
        `are from different machines and the elapsed count is meaningless; call action:"reset" again before reading`,
    });
  }
  const baseline = stored.baseline;

  if (sample.route === "unavailable") {
    return finish({ route: "unavailable", measurable: false, reason: sample.reason });
  }

  if (baseline.route !== sample.route) {
    return finish({
      route: sample.route,
      measurable: false,
      reason:
        `the baseline was recorded on route "${baseline.route}" but the current sample is route "${sample.route}" -- ` +
        "this is possible only across a reconnect that changed this build's cpu-history capability; reset again before reading",
    });
  }

  if (sample.route === "cpu_history" && baseline.route === "cpu_history") {
    const delta = sample.cycle - baseline.cycle;
    if (delta < 0n) {
      return finish({
        route: "cpu_history",
        measurable: false,
        reason: `the monotonic CPUHISTORY_GET clock went backwards (baseline cycle ${baseline.cycle}, current cycle ${sample.cycle}) -- the machine restarted or its history was cleared`,
      });
    }
    // WR-13 (07-REVIEW.md): `cycles` is a JS number for the manifest's sake,
    // but a uint64 clock delta does not always fit one. ParsedCpuHistoryEntry's
    // own doc comment says the cycle is "never narrowed to Number, since a
    // uint64 clock does not fit a JS number safely and the stopwatch's whole
    // value is exactness" -- and this is the narrowing site. Above
    // Number.MAX_SAFE_INTEGER, `Number(delta)` silently rounds, so labelling
    // that "exact" is false on its face. `cyclesExact` (the decimal string) is
    // always the authoritative figure; the LABEL is what changes.
    const narrowable = delta <= BigInt(Number.MAX_SAFE_INTEGER);
    const measured: Record<string, unknown> = {
      route: "cpu_history",
      measurable: true,
      cycles: Number(delta),
      cyclesExact: delta.toString(),
      exactness: narrowable ? "exact" : "exact-but-narrowed",
    };
    if (!narrowable) {
      measured.caveat =
        `the elapsed count ${delta} exceeds Number.MAX_SAFE_INTEGER (${Number.MAX_SAFE_INTEGER}), so the "cycles" field has been ` +
        "rounded by the narrowing to a JS number -- read cyclesExact, which is the exact decimal value, for any arithmetic that matters";
    }
    return finish(measured);
  }

  // Route B: frame_position (the only remaining route once cpu_history and
  // unavailable are handled above, and the mismatch check above proved
  // baseline.route === sample.route).
  const before = baseline as FramePositionBaseline;
  const after = sample as FramePositionBaseline;
  if (after.position < before.position) {
    return finish({
      route: "frame_position",
      measurable: false,
      reason:
        "at least one frame boundary was crossed between reset and read -- LIN/CYC's within-frame position went backwards, and the elapsed " +
        "cycle count cannot be reconstructed from LIN/CYC alone on a VICE build below 3.10; CPUHISTORY_GET (VICE >= 3.10) is the route that " +
        "can measure a bracket that may cross a frame boundary",
    });
  }
  return finish({
    route: "frame_position",
    measurable: true,
    cycles: after.position - before.position,
    exactness: "within-one-frame-unverified",
    caveat:
      "LIN/CYC cannot distinguish \"0 frames elapsed\" from \"exactly N whole frames elapsed\" -- this figure is trustworthy only for a " +
      "bracket known to be bounded well under one frame",
    standard: after.standard.name,
    standardAssumed: after.standard.assumed,
  });
};
