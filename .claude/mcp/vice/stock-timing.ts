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
import { CommandType, memspaceBody, resourceGetBody, type ParsedCpuHistoryEntry } from "./stock-protocol.ts";
import { clampCpuHistoryCount, type StockConnectSession } from "./stock-connect.ts";
import { registerCatalogFor } from "./stock-registers.ts";

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
 * reason this file itself could cause. */
let videoStandardCache = new Map<string, VideoStandardResult>();

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
  if (cached) {
    return cached;
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
    videoStandardCache.set(session.targetId, result);
    return result;
  } catch (err) {
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
 * `readCycleBaseline()` below), so this helper exists only for Route A. */
async function readProgramCounter(session: StockConnectSession): Promise<number> {
  const catalog = await registerCatalogFor(session);
  const pcEntry = catalog.byName.get("PC");
  if (!pcEntry) {
    throw new Error("readCycleBaseline: the connected VICE build's REGISTERS_AVAILABLE enumeration has no \"PC\" register");
  }
  const response = await session.client.send(CommandType.RegistersGet, memspaceBody({ memspace: 0x00 }));
  if (response.type !== "registers") {
    throw new Error(`readCycleBaseline: expected a registers reply, got "${response.type}"`);
  }
  const found = response.registers.find((reg) => reg.id === pcEntry.id);
  if (!found) {
    throw new Error("readCycleBaseline: REGISTERS_GET's reply did not include a value for \"PC\" despite the catalog enumerating it");
  }
  return found.value;
}

/**
 * The shared cycle-baseline primitive `handleCyclesStopwatch()` (Task 2)
 * and (07-06) `stock-diagnose.ts`'s liveness bracket both consume. Route
 * selection is a SINGLE read of `session.capabilities.cpuHistory` -- Phase
 * 2's BACK-04 already settled this once per connect; there is no second
 * probe here (Pattern 2, 07-RESEARCH.md).
 *
 * Returns a `"route"`-discriminated record, never a fabricated figure:
 *   - `"cpu_history"`: Route A. CPUHISTORY_GET's newest entry's exact
 *     bigint `cycle`, plus PC via one extra REGISTERS_GET.
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
    const newest: ParsedCpuHistoryEntry = response.entries[0]!;
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
 * both this file's caches from one place. */
let stopwatchBaselines = new Map<string, CycleBaseline>();

export function resetTimingStateForTest(): void {
  videoStandardCache = new Map<string, VideoStandardResult>();
  stopwatchBaselines = new Map<string, CycleBaseline>();
}
