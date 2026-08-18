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
import { CommandType, memGetBody } from "./stock-protocol.ts";
import { handleCheckpointList } from "./stock-checkpoints.ts";
import { handleRegistersGet } from "./stock-registers.ts";
import type { StockDispatchDeps } from "./stock-dispatch.ts";
import type { StockConnectSession } from "./stock-connect.ts";

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
