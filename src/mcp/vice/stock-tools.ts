#!/usr/bin/env node
// stock-tools.ts
//
// WHY THIS FILE EXISTS: the one list of stock tools. Each entry names a tool,
// says whether it runs with the binary session and lock ("binary") or
// without them ("pure"), and gives its handler. The advertised schemas stay
// in tools-manifest.stock.json; stockToolDefinitions() pairs the two and
// refuses to start when either side names a tool the other lacks.
//
// WHAT NOT TO DO:
//   - Never make a text-channel tool "binary": it takes the text lock itself,
//     and channel-lock.ts is one non-reentrant mutex across both channels.
//   - Never make a pure client-side tool "binary": every wire touch halts
//     the machine on stock.
import type { ToolInfo } from "./vice-errors.ts";
import { isErrorText, stockAnswer, type StockToolResult, type StockSessionHandler, type DerivedPureHandler } from "./stock-handler.ts";
import { runBinary, runPure, type StockSessionDeps } from "./stock-session.ts";
import { handleMemoryRead, handleMemoryWrite, handleMemoryBanks } from "./stock-memory.ts";
import { handleRegistersGet, handleRegistersSet, handleRegistersAvailable } from "./stock-registers.ts";
import {
  handleCheckpointAdd,
  handleCheckpointDelete,
  handleCheckpointList,
  handleCheckpointToggle,
  handleCheckpointSetCondition,
  handleWatchAdd,
} from "./stock-checkpoints.ts";
import { handleExecutionPause, handleExecutionRun, handleExecutionStep, handleExecutionUntilReturn } from "./stock-execution.ts";
import { handleMachineReset, handleAutostart, handleProgramLoad, handleDiskAttach, handleSnapshotSave, handleSnapshotLoad } from "./stock-machine.ts";
import { handleKeyboardType, handleKeyboardPetscii, handleJoystickSet } from "./stock-input.ts";
import { handleDisassemble } from "./stock-disassemble.ts";
import { handleMemorySearch, handleMemoryCompare } from "./stock-memory-search.ts";
import { handleSymbolsLoad, handleSymbolsLookup } from "./stock-symbols.ts";
import { handleViciiGetState } from "./stock-vicii.ts";
import { handleCiaGetState } from "./stock-cia.ts";
import { handleSpriteGet, handleSpriteInspect } from "./stock-sprites.ts";
import { handleCyclesStopwatch } from "./stock-timing.ts";
import { handleRunUntil } from "./stock-run-until.ts";
import { handleDeviceConsole, handleWarpSet, handleMemmapShow, handleMemmapZap, handleCpuHistory, handleProfileFlat, handleBacktrace, handleIoRegisters } from "./text-tools.ts";

/**
 * The `vice_ping` handler -- BACK-03's answer, on the tool an agent already
 * reaches for first. runBinary() owns the session-acquisition and
 * error-conversion preamble; this function's only job is to build the answer once a live session already exists.
 * Enriches the ordinary ping answer with the three BACK-03 fields: `backend`
 * (always `"stock"` on this path), `viceVersion` (rendered from the
 * handshake's own version quad), and `resolvedBinaryPath` (threaded down
 * from deps, never resolved here -- see StockSessionDeps's own header
 * comment on why). Built through stockAnswer() so the answer now also
 * carries `runState` (D-06: every stock answer, and `vice_ping` is a stock
 * answer) alongside every field that was already there.
 *
 * 2026-08-19 finding (closed Phase 15 plan 15-09): `resolvedBinaryPath` is a
 * ONE-TIME, MCP-server-process-startup `$PATH` probe (see vice-proxy.ts's
 * `ACTIVE_BACKEND` comment) -- it is independent of which binary the broker
 * actually leased for THIS request. `resolvedBinaryPathScope` below is an
 * additive, backward-compatible sibling field (the existing field name and
 * shape are unchanged) that carries that qualification into the answer
 * itself, so a caller reading the response -- not just this source comment --
 * learns not to treat the path as this request's authoritative binary
 * identity.
 */
const RESOLVED_BINARY_PATH_SCOPE =
  "one-time MCP-server-process-startup PATH probe; NOT the binary the broker leased for this " +
  "request -- for the authoritative per-instance binary, read the broker's own launch record " +
  "(epoch.json's vice_bin field)";

const handlePing: StockSessionHandler = async (_args, session, deps) => {
  return stockAnswer(session.client, {
    status: "ok",
    backend: "stock" as const,
    viceVersion: `VICE ${session.versionQuad}`,
    resolvedBinaryPath: deps.resolvedBinaryPath ?? "",
    // WR-05: says outright whether the field above IS a resolved path. Without
    // it, an agent reading `"x64sc"` cannot tell "this is where the binary is"
    // from "this is what we were told to look for, and we could not find it".
    resolvedBinaryPathIsResolved: deps.resolvedBinaryPathIsResolved ?? false,
    // 2026-08-19 finding: names what resolvedBinaryPath actually is (a
    // startup-time probe) and where to look instead for a per-request answer.
    resolvedBinaryPathScope: RESOLVED_BINARY_PATH_SCOPE,
    capabilities: session.capabilities,
  });
};

export type StockTool =
  | { name: string; kind: "binary"; handler: StockSessionHandler }
  | { name: string; kind: "pure"; handler: DerivedPureHandler };

export const STOCK_TOOLS: readonly StockTool[] = Object.freeze([
  { name: "vice_ping", kind: "binary", handler: handlePing },
  { name: "vice_memory_read", kind: "binary", handler: handleMemoryRead },
  { name: "vice_memory_write", kind: "binary", handler: handleMemoryWrite },
  { name: "vice_memory_banks", kind: "binary", handler: handleMemoryBanks },
  { name: "vice_program_load", kind: "binary", handler: handleProgramLoad },
  { name: "vice_registers_get", kind: "binary", handler: handleRegistersGet },
  { name: "vice_registers_set", kind: "binary", handler: handleRegistersSet },
  { name: "vice_registers_available", kind: "binary", handler: handleRegistersAvailable },
  { name: "vice_checkpoint_add", kind: "binary", handler: handleCheckpointAdd },
  { name: "vice_checkpoint_delete", kind: "binary", handler: handleCheckpointDelete },
  { name: "vice_checkpoint_list", kind: "binary", handler: handleCheckpointList },
  { name: "vice_checkpoint_toggle", kind: "binary", handler: handleCheckpointToggle },
  { name: "vice_checkpoint_set_condition", kind: "binary", handler: handleCheckpointSetCondition },
  { name: "vice_watch_add", kind: "binary", handler: handleWatchAdd },
  { name: "vice_execution_pause", kind: "binary", handler: handleExecutionPause },
  { name: "vice_execution_run", kind: "binary", handler: handleExecutionRun },
  { name: "vice_execution_step", kind: "binary", handler: handleExecutionStep },
  { name: "vice_execution_until_return", kind: "binary", handler: handleExecutionUntilReturn },
  { name: "vice_machine_reset", kind: "binary", handler: handleMachineReset },
  { name: "vice_autostart", kind: "binary", handler: handleAutostart },
  { name: "vice_disk_attach", kind: "binary", handler: handleDiskAttach },
  { name: "vice_snapshot_save", kind: "binary", handler: handleSnapshotSave },
  { name: "vice_snapshot_load", kind: "binary", handler: handleSnapshotLoad },
  { name: "vice_keyboard_type", kind: "binary", handler: handleKeyboardType },
  { name: "vice_keyboard_petscii", kind: "binary", handler: handleKeyboardPetscii },
  { name: "vice_joystick_set", kind: "binary", handler: handleJoystickSet },
  { name: "vice_disassemble", kind: "binary", handler: handleDisassemble },
  { name: "vice_memory_search", kind: "binary", handler: handleMemorySearch },
  { name: "vice_memory_compare", kind: "binary", handler: handleMemoryCompare },
  { name: "vice_vicii_get_state", kind: "binary", handler: handleViciiGetState },
  { name: "vice_cia_get_state", kind: "binary", handler: handleCiaGetState },
  { name: "vice_sprite_get", kind: "binary", handler: handleSpriteGet },
  { name: "vice_sprite_inspect", kind: "binary", handler: handleSpriteInspect },
  { name: "vice_cycles_stopwatch", kind: "binary", handler: handleCyclesStopwatch },
  { name: "vice_run_until", kind: "binary", handler: handleRunUntil },
  { name: "vice_symbols_load", kind: "pure", handler: handleSymbolsLoad },
  { name: "vice_symbols_lookup", kind: "pure", handler: handleSymbolsLookup },
  { name: "vice_device_console", kind: "pure", handler: handleDeviceConsole },
  { name: "vice_warp_set", kind: "pure", handler: handleWarpSet },
  { name: "vice_memmap_show", kind: "pure", handler: handleMemmapShow },
  { name: "vice_memmap_zap", kind: "pure", handler: handleMemmapZap },
  { name: "vice_cpu_history", kind: "pure", handler: handleCpuHistory },
  { name: "vice_profile_flat", kind: "pure", handler: handleProfileFlat },
  { name: "vice_backtrace", kind: "pure", handler: handleBacktrace },
  { name: "vice_io_registers", kind: "pure", handler: handleIoRegisters },
]);

/** Runs one tool through the runner its kind names. Never throws. */
export function runStockTool(tool: StockTool, args: Record<string, unknown>, deps: StockSessionDeps): Promise<StockToolResult> {
  return tool.kind === "binary" ? runBinary(tool.name, tool.handler, args, deps) : runPure(tool.name, tool.handler, args, deps);
}

/** Runs the tool named `name`, or refuses by name when no tool has it. */
export async function callStockTool(name: string, args: Record<string, unknown>, deps: StockSessionDeps): Promise<StockToolResult> {
  const tool = STOCK_TOOLS.find((t) => t.name === name);
  if (!tool) {
    return isErrorText(`${name}: no stock tool has this name.`);
  }
  return runStockTool(tool, args, deps);
}

export class StockToolManifestMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockToolManifestMismatchError";
  }
}

/**
 * Pairs each manifest definition with its tool, in manifest order (which is
 * the tools/list order). Throws StockToolManifestMismatchError when a
 * manifest entry has no tool or a tool has no manifest entry -- a broken
 * shipped manifest is a packaging bug, so the server must fail loudly at
 * startup rather than advertise a partial surface.
 */
export function stockToolDefinitions(manifestTools: readonly ToolInfo[]): { def: ToolInfo; tool: StockTool }[] {
  const byName = new Map(STOCK_TOOLS.map((t) => [t.name, t]));
  const manifestNames = new Set(manifestTools.map((d) => d.name));
  const noTool = manifestTools.filter((d) => !byName.has(d.name)).map((d) => d.name);
  const noManifest = STOCK_TOOLS.filter((t) => !manifestNames.has(t.name)).map((t) => t.name);
  if (noTool.length > 0 || noManifest.length > 0) {
    throw new StockToolManifestMismatchError(
      `tools-manifest.stock.json and STOCK_TOOLS disagree -- in the manifest with no tool: ${JSON.stringify(noTool)}; ` +
        `tools with no manifest entry: ${JSON.stringify(noManifest)}.`,
    );
  }
  return manifestTools.map((def) => ({ def, tool: byName.get(def.name)! }));
}
