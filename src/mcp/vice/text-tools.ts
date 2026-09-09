#!/usr/bin/env node
// text-tools.ts
//
// THE ONE place a text-channel tool handler lives (plan 41-06, CHAN-03).
// Every handler here takes the text channel's own halt authority through
// withTextChannelLock() (text-protocol.ts, plan 41-02) around its whole
// logical operation and never issues a bare command() outside it --
// command() itself refuses when channel-lock.ts's mutex is not held by the
// text channel, so a handler that forgot to acquire would be refused, not
// silently allowed through.
//
// No handler here accepts a caller-supplied command string, now or later.
// The generic remote-execution seam this project rejected on the record for
// host_tool (a single per-binary run-arbitrary-command op) would be WORSE
// here, over a channel that is unauthenticated and can read and write host
// files -- broker-launch.mts's own bind-widening warning already states
// this for this same channel. Every outbound command below is a fixed
// literal drawn from TEXT_COMMAND_ALLOWLIST; text-protocol.ts's command()
// itself refuses anything else BY NAME (D-01), and neither handler below
// ever builds a command string from an argument.
//
// SESSION LIFECYCLE -- MEASURED, not this plan's assumed default (Rule 1
// deviation, see SUMMARY): StockConnectSession (stock-connect.ts) carries no
// text session at all, and ensureStockSession()/withStockSession() never
// call textConnect() -- as of this plan, textConnect()/textDisconnect() are
// invoked ONLY from test code. So there is no session-lifetime-held text
// session anywhere in production code to reuse. Each call below is its OWN
// textConnect()/textDisconnect() pair -- the ONLY acquisition path these two
// tools have, not a second one competing with a first.
//
// ADAPTER CHOICE -- MEASURED, deviates from this plan's literal instruction
// (Rule 1 deviation, see SUMMARY): withStockSession() and
// withDerivedTool(..., { needsSession: true }, ...) (stock-dispatch.ts) both
// wrap the ENTIRE delegated handler call in withChannelLockHeld(), which
// acquires channel-lock.ts's SINGLE, cross-channel mutex for `channel:
// "binary"` for the whole call. A handler reached through either adapter
// that then called withTextChannelLock() internally would be a SECOND
// acquireChannelLock() call while the first (binary) is still held by the
// very same call stack -- channel-lock.ts is not reentrant and does not
// distinguish "the same logical caller" from "a different one" -- so the
// inner acquire would queue behind itself and could only ever resolve by
// expiring CHANNEL_LOCK_ACQUIRE_TIMEOUT_MS (630s by default) and erroring: a
// de facto deadlock, not a working call. Neither handler below needs a
// binary session or the binary channel's authority at all, so both are
// registered in stock-dispatch.ts with
// `withDerivedTool(toolName, { needsSession: false }, handler)` instead --
// the SAME existing adapter configuration `vice_diagnose`/
// `vice_symbols_load` already use, never a third adapter. Each handler
// resolves the lease through `deps.ensureLease()` itself (free to call
// repeatedly -- ensureStockSession()'s own header comment) and takes ONLY
// the text channel's own lock, via withTextChannelLock(), around its one
// command().
//
// WHAT NOT TO DO:
//   - Never accept a caller-supplied, free-text command string anywhere in
//     this module's public surface (D-01).
//   - Never call TextMonitorClient.command() outside withTextChannelLock().
//   - Never register either handler through withStockSession() or
//     withDerivedTool(..., { needsSession: true }, ...) -- see the ADAPTER
//     CHOICE comment above for the self-deadlock this would cause.
//   - Never dial a raw host/port or open a second broker lease -- both
//     handlers obtain lease coordinates through deps.ensureLease() (the SAME
//     provider ensureStockSession() itself calls) and dial only through
//     textConnect().
//   - Never write a third error converter -- reuse convertHandshakeError()
//     and convertWireError() (stock-handler.ts) exactly as every other stock
//     handler does; a ChannelLockTimeoutError is passed through verbatim
//     (its own `.message` IS channelLockRefusalMessage()'s output), matching
//     withChannelLockHeld()'s own discipline in stock-dispatch.ts.
//   - Never embed a phase number in any string or template literal here.
import { textConnect, textDisconnect } from "./text-connect.ts";
import { withTextChannelLock, buildTextCommand, type TextMonitorClient } from "./text-protocol.ts";
import { MonitorOwnershipError } from "./vice-broker-client.ts";
import { ChannelLockTimeoutError } from "./channel-lock.ts";
import { isErrorText, derivedAnswer, convertHandshakeError, convertWireError, type StockToolResult } from "./stock-handler.ts";
import { parseAccessMap, accessMapRanges, type AccessMap, type AccessMapRangesOptions } from "./textmon-memmap.ts";
import { parseCpuHistory } from "./textmon-cpuhistory.ts";
import { parseBacktrace } from "./textmon-backtrace.ts";
import { parseFlatProfile } from "./textmon-profile.ts";
import { parseIoRegisters } from "./textmon-registers.ts";
import {
  classifyTextCapabilityResponse,
  probeTextCapability,
  textCapabilityRefusalMessage,
  type TextCapabilityIdentity,
  type TextCapabilityBrokerIdentity,
} from "./text-capability-probe.ts";
import type { StockDispatchDeps } from "./stock-dispatch.ts";

/**
 * Shared preamble every handler below runs: resolve the lease
 * (`deps.ensureLease()` -- the SAME provider ensureStockSession() itself
 * calls, never a second acquisition), open a fresh text-monitor session
 * through textConnect(), hold channel-lock.ts's mutex for `channel: "text"`
 * around exactly one command via withTextChannelLock(), and always tear the
 * session down again (textDisconnect()) whether `fn` succeeded or threw.
 */
async function withTextTool(
  toolName: string,
  deps: StockDispatchDeps,
  fn: (client: TextMonitorClient) => Promise<StockToolResult>,
): Promise<StockToolResult> {
  const leaseOutcome = await deps.ensureLease();
  if (!leaseOutcome.ok) {
    return isErrorText(leaseOutcome.message);
  }
  const lease = leaseOutcome.lease;
  if (lease === null) {
    return isErrorText(
      `${toolName}: VICE_MCP_URL is set, so there is no broker-managed instance and no broker control session to ` +
        `claim the text-monitor socket through -- unset VICE_MCP_URL to use the on-demand broker, or connect to a ` +
        `broker-managed instance directly.`,
    );
  }

  let session;
  try {
    session = await textConnect({
      host: lease.host,
      remoteMonitorPort: lease.remoteMonitorPort,
      targetId: lease.targetId,
      brokerControl: lease.brokerControl,
    });
  } catch (err) {
    if (err instanceof MonitorOwnershipError) {
      return convertHandshakeError(toolName, err);
    }
    return convertWireError(toolName, err);
  }

  try {
    return await withTextChannelLock(toolName, () => fn(session.client), { timeoutMs: deps.channelLockTimeoutMs });
  } catch (err) {
    // ChannelLockTimeoutError's own `.message` IS
    // channelLockRefusalMessage()'s output -- passed through verbatim below,
    // never routed through convertWireError(), matching
    // withChannelLockHeld()'s (stock-dispatch.ts) own discipline for the
    // binary side.
    if (err instanceof ChannelLockTimeoutError) {
      return isErrorText(err.message);
    }
    return convertWireError(toolName, err);
  } finally {
    try {
      await textDisconnect(session);
    } catch (releaseErr) {
      console.error(`${toolName}: textDisconnect after use did not complete: ${String(releaseErr)}`);
    }
  }
}

/**
 * `vice_device_console` -- takes NO arguments at all. Issues the single
 * allowlisted verb `device c:` (the colon is required; the spelling without
 * it is a syntax error the monitor rejects) inside withTextChannelLock(),
 * and answers with the framed response plus a statement that the default
 * device (memspace) was reset to the main CPU. This is an explicit tool, not
 * auto-healing on the stepping path (D-03) -- nothing here is called from
 * `ADVANCE_INSTRUCTIONS` or `EXECUTE_UNTIL_RETURN`; no shipped tool can
 * contaminate `default_memspace` today (drive checkpoints are deferred past
 * this milestone), so auto-healing would add a text round trip and a mutex
 * acquisition to the hottest binary-side path to defend a route nothing
 * currently opens.
 */
export async function handleDeviceConsole(_args: Record<string, unknown>, deps: StockDispatchDeps): Promise<StockToolResult> {
  return withTextTool("vice_device_console", deps, async (client) => {
    const response = await client.command("device c:");
    return derivedAnswer({
      response,
      note: "default device (memspace) reset to the main CPU",
    });
  });
}

/**
 * `vice_warp_set` -- takes exactly one parameter, `enabled: boolean`,
 * refused BY NAME (no byte written to the socket, no lease resolved, no
 * connection attempted) whenever it is not a boolean. Selects `warp on` or
 * `warp off` by branch -- never a caller-supplied string concatenated into
 * the command line -- and answers with the framed response, which per the
 * existing measurement reports warp's own state, so the answer carries the
 * OBSERVED state rather than an assumption that the write took. There is no
 * runtime `WarpMode` *resource* on stock; this is a monitor *command*, and
 * warp requested at launch time is a separate mechanism -- this tool changes
 * neither of those facts.
 */
export async function handleWarpSet(args: Record<string, unknown>, deps: StockDispatchDeps): Promise<StockToolResult> {
  const enabled = args.enabled;
  if (typeof enabled !== "boolean") {
    return isErrorText(
      `vice_warp_set: "enabled" must be a boolean (got ${JSON.stringify(enabled)}) -- refusing before any ` +
        `text-monitor byte is written`,
    );
  }
  const command = enabled ? "warp on" : "warp off";
  return withTextTool("vice_warp_set", deps, async (client) => {
    const response = await client.command(command);
    return derivedAnswer({
      requested: enabled,
      response,
      note:
        "there is no runtime WarpMode resource on stock -- this is a monitor command, and warp requested at " +
        "launch time is a separate mechanism; the response above carries warp's OWN observed state, not an " +
        "assumption that this write took",
    });
  });
}

/** True iff `value` is a representable, non-negative whole number bounded
 * to the C64's 16-bit address space -- the shared narrowing for
 * `startAddress`/`endAddress`. Declared locally, per this module tree's
 * own "repeated per file, never centrally imported" convention
 * (disasm-decoder.ts). */
function isValidAddressArg(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 0xffff;
}

/** True iff `value` is a representable integer 1 through 4096 -- the
 * `maxRanges` narrowing. */
function isValidMaxRangesArg(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 4096;
}

/** Per-column execute counts over the WHOLE parsed map (never the
 * `maxRanges`-truncated projection) -- so the counts stay meaningful even
 * when the emitted range list itself is truncated. */
function executeCounts(map: AccessMap): { io: number; rom: number; ram: number } {
  let io = 0;
  let rom = 0;
  let ram = 0;
  for (const entry of map.entries) {
    if (entry.io.execute) io++;
    if (entry.rom.execute) rom++;
    if (entry.ram.execute) ram++;
  }
  return { io, rom, ram };
}

/**
 * `vice_memmap_show` -- dials the single allowlisted, unparameterized verb
 * `memmapshow` (D-42-1: `startAddress`/`endAddress`/`maxRanges` are
 * client-side projection FILTERS applied after parsing; none of the three
 * ever reaches the socket, and the dialed command is the frozen literal,
 * never a built string). Refuses any argument outside its documented
 * bounds BEFORE any lease is resolved or any byte is written, mirroring
 * `handleWarpSet()`'s shape. Retrofitted in plan 42-07 with the same
 * classify-before-parse ordering the four PARSE-02 handlers use: `chis`
 * shares FEATURE_CPUMEMHISTORY with `memmapshow`, so a disabled build is
 * named by capability, command, binary and remedy -- never a parser
 * refusal. Plan 42-01 wrote this handler before text-capability-probe.ts
 * existed, so it originally handed a disabled-stub reply straight to the
 * parser (a parse error that reads like a defect in this project, exactly
 * the outcome PARSE-04 forbids). On a genuine parse refusal, answers
 * `isErrorText` naming the tool, the refusal code, and the offending
 * line/lineNumber -- never a partial or best-effort access map.
 */
export async function handleMemmapShow(args: Record<string, unknown>, deps: StockDispatchDeps): Promise<StockToolResult> {
  const { startAddress, endAddress, maxRanges } = args;

  if (startAddress !== undefined && !isValidAddressArg(startAddress)) {
    return isErrorText(
      `vice_memmap_show: "startAddress" must be an integer 0 through 65535 (got ${JSON.stringify(startAddress)}) -- ` +
        `refusing before any text-monitor byte is written`,
    );
  }
  if (endAddress !== undefined && !isValidAddressArg(endAddress)) {
    return isErrorText(
      `vice_memmap_show: "endAddress" must be an integer 0 through 65535 (got ${JSON.stringify(endAddress)}) -- ` +
        `refusing before any text-monitor byte is written`,
    );
  }
  if (
    startAddress !== undefined &&
    endAddress !== undefined &&
    isValidAddressArg(startAddress) &&
    isValidAddressArg(endAddress) &&
    startAddress > endAddress
  ) {
    return isErrorText(
      `vice_memmap_show: "startAddress" (${JSON.stringify(startAddress)}) must not be greater than "endAddress" ` +
        `(${JSON.stringify(endAddress)}) -- refusing before any text-monitor byte is written`,
    );
  }
  if (maxRanges !== undefined && !isValidMaxRangesArg(maxRanges)) {
    return isErrorText(
      `vice_memmap_show: "maxRanges" must be an integer 1 through 4096 (got ${JSON.stringify(maxRanges)}) -- ` +
        `refusing before any text-monitor byte is written`,
    );
  }

  const { identity, brokerIdentity } = await capabilityIdentityFor(deps);

  return withTextTool("vice_memmap_show", deps, async (client) => {
    const response = await client.command("memmapshow", { timeoutMs: 30000 });

    const classification = classifyTextCapabilityResponse("memmapshow", response);
    if (classification.outcome !== "capable") {
      const verdict = await probeTextCapability({ command: "memmapshow", identity, brokerIdentity, dial: async () => response });
      return isErrorText(`vice_memmap_show: ${textCapabilityRefusalMessage([verdict])}`);
    }

    const parsed = parseAccessMap(response);
    if (!parsed.ok) {
      return isErrorText(
        `vice_memmap_show: memmapshow's response could not be parsed (${parsed.refusal.code} at line ` +
          `${parsed.refusal.lineNumber}: ${JSON.stringify(parsed.refusal.line)}) -- ${parsed.refusal.message}`,
      );
    }

    const rangesOpts: AccessMapRangesOptions = {};
    if (isValidAddressArg(startAddress)) rangesOpts.startAddress = startAddress;
    if (isValidAddressArg(endAddress)) rangesOpts.endAddress = endAddress;
    if (isValidMaxRangesArg(maxRanges)) rangesOpts.maxRanges = maxRanges;
    const projection = accessMapRanges(parsed.value, rangesOpts);

    return derivedAnswer({
      command: "memmapshow",
      ...projection,
      executeCounts: executeCounts(parsed.value),
    });
  });
}

// ---------------------------------------------------------------------------
// Plan 42-07: the four remaining text formats -- chis, prof flat, bt, io --
// plus the shared capability-identity helper every one of the five text
// tools in this file (including handleMemmapShow above, retrofitted) uses to
// classify a raw reply for build capability BEFORE handing it to a parser
// (PARSE-04, D-42-2). See text-capability-probe.ts's own header comment for
// the full three-outcome design this section leans on.
// ---------------------------------------------------------------------------

/** THE ONE place that decides what identity a capability answer is
 * attributed to (D-42-2), used by all five text tools in this file.
 * `identity` comes from `deps.resolvedBinaryPath`/
 * `deps.resolvedBinaryPathIsResolved` -- the SAME single dispatch-layer
 * resolution `stock-dispatch.ts`'s own `StockDispatchDeps` doc comment
 * documents, never re-resolved here. Every tool registered in this file
 * runs ONLY on the stock backend (STOCK_DERIVED_TOOLS), so `backend` is
 * always the "stock" literal -- never invented for a caller this module
 * could not actually be talking to.
 *
 * `brokerIdentity`, when obtainable, is the broker's OWN reported identity
 * (`BrokerControlSession.hostState()`'s `backend`/`vice_bin` fields) for
 * `probeTextCapability()`'s own cross-check (D-42-2). A failed `hostState()`
 * call (a broker predating the field, no lease at all, or a control-plane
 * hiccup) is ABSENT EVIDENCE, never disagreement -- `brokerIdentity` is
 * simply omitted, matching `probeTextCapability()`'s own documented
 * treatment of an omitted broker identity.
 */
async function capabilityIdentityFor(
  deps: StockDispatchDeps,
): Promise<{ identity: TextCapabilityIdentity; brokerIdentity?: TextCapabilityBrokerIdentity }> {
  const identity: TextCapabilityIdentity = {
    backend: "stock",
    binPath: deps.resolvedBinaryPath ?? "",
    resolved: deps.resolvedBinaryPathIsResolved ?? false,
  };

  const leaseOutcome = await deps.ensureLease();
  if (!leaseOutcome.ok || leaseOutcome.lease === null) {
    return { identity };
  }

  try {
    const hostStateResult = await leaseOutcome.lease.brokerControl.hostState();
    if (!hostStateResult.ok) return { identity };
    return {
      identity,
      brokerIdentity: { backend: hostStateResult.hostState.backend, binPath: hostStateResult.hostState.vice_bin },
    };
  } catch {
    return { identity };
  }
}

/**
 * `vice_cpu_history` -- dials `chis`, optionally parameterized with a
 * caller-chosen decimal row count via `buildTextCommand()` (the ONE place
 * such a string is built, D-42-1). An omitted `count` dials the bare frozen
 * verb; a supplied one is validated and rendered by the builder alone --
 * this handler never states or duplicates the builder's own bound.
 * Classifies the raw reply for build capability before parsing (PARSE-04):
 * `chis` shares FEATURE_CPUMEMHISTORY with `memmapshow`, so a disabled build
 * is named by capability, command, binary and remedy -- never a parser
 * refusal.
 */
export async function handleCpuHistory(args: Record<string, unknown>, deps: StockDispatchDeps): Promise<StockToolResult> {
  const { count } = args;
  let command = "chis";
  if (count !== undefined) {
    const built = buildTextCommand("chis", count);
    if (!built.ok) {
      return isErrorText(`vice_cpu_history: ${built.message} -- refusing before any text-monitor byte is written`);
    }
    command = built.command;
  }

  const { identity, brokerIdentity } = await capabilityIdentityFor(deps);

  return withTextTool("vice_cpu_history", deps, async (client) => {
    const response = await client.command(command, { timeoutMs: 30000 });

    const classification = classifyTextCapabilityResponse("chis", response);
    if (classification.outcome !== "capable") {
      const verdict = await probeTextCapability({ command: "chis", identity, brokerIdentity, dial: async () => response });
      return isErrorText(`vice_cpu_history: ${textCapabilityRefusalMessage([verdict])}`);
    }

    const parsed = parseCpuHistory(response);
    if (!parsed.ok) {
      return isErrorText(
        `vice_cpu_history: chis's response could not be parsed (${parsed.refusal.code} at line ` +
          `${parsed.refusal.lineNumber}: ${JSON.stringify(parsed.refusal.line)}) -- ${parsed.refusal.message}`,
      );
    }

    return derivedAnswer({
      command,
      entries: parsed.value.entries,
      count: parsed.value.entries.length,
    });
  });
}

/**
 * `vice_profile_flat` -- dials `prof flat`, optionally parameterized with a
 * caller-chosen decimal row count via `buildTextCommand()`, exactly mirroring
 * `handleCpuHistory()`'s argument shape. `prof flat` carries NO build-time
 * guard at all -- the classifier can only ever return `capable` or
 * `indeterminate` for this verb -- but is still classified before parsing so
 * an indeterminate (empty/unframeable) reply is a named state rather than a
 * silent empty success.
 */
export async function handleProfileFlat(args: Record<string, unknown>, deps: StockDispatchDeps): Promise<StockToolResult> {
  const { count } = args;
  let command = "prof flat";
  if (count !== undefined) {
    const built = buildTextCommand("prof flat", count);
    if (!built.ok) {
      return isErrorText(`vice_profile_flat: ${built.message} -- refusing before any text-monitor byte is written`);
    }
    command = built.command;
  }

  const { identity, brokerIdentity } = await capabilityIdentityFor(deps);

  return withTextTool("vice_profile_flat", deps, async (client) => {
    const response = await client.command(command, { timeoutMs: 30000 });

    const classification = classifyTextCapabilityResponse("prof flat", response);
    if (classification.outcome !== "capable") {
      const verdict = await probeTextCapability({ command: "prof flat", identity, brokerIdentity, dial: async () => response });
      return isErrorText(`vice_profile_flat: ${textCapabilityRefusalMessage([verdict])}`);
    }

    const parsed = parseFlatProfile(response);
    if (!parsed.ok) {
      return isErrorText(
        `vice_profile_flat: prof flat's response could not be parsed (${parsed.refusal.code} at line ` +
          `${parsed.refusal.lineNumber}: ${JSON.stringify(parsed.refusal.line)}) -- ${parsed.refusal.message}`,
      );
    }

    return derivedAnswer({
      command,
      entries: parsed.value.entries,
      count: parsed.value.entries.length,
      decimalSeparator: parsed.value.decimalSeparator,
    });
  });
}

/** True iff `value` is a representable integer 1 through 64 -- the shared
 * bound the fork's own `vice_backtrace` tool description already declares
 * ("Max stack frames to show (default: 16, max: 64)"). This is the ONE
 * exception D-42-1 states explicitly: `depth` is a client-side projection
 * FILTER applied to the PARSED frame list, never part of the "bt" command
 * itself (the verb takes no wire parameter at all), so it is validated
 * locally rather than through `buildTextCommand()`. */
function isValidBacktraceDepthArg(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 64;
}

/**
 * `vice_backtrace` -- takes the name the fork's own tool already advertises
 * (D-42-4): landing the text-monitor implementation under the SAME name,
 * with a backward-compatible argument shape (the fork's optional numeric
 * `depth` stays optional and stays numeric), makes this a SHARED tool
 * rather than a second vocabulary for one capability. Dials the bare,
 * unparameterized `bt` verb -- `depth`, when supplied, truncates the
 * PARSED frames only, and the answer reports both the returned count and
 * the total so truncation is never silently a function of the argument.
 * `bt` carries no build-time guard; classified before parsing anyway so an
 * indeterminate reply is a named state.
 */
export async function handleBacktrace(args: Record<string, unknown>, deps: StockDispatchDeps): Promise<StockToolResult> {
  const { depth } = args;
  if (depth !== undefined && !isValidBacktraceDepthArg(depth)) {
    return isErrorText(
      `vice_backtrace: "depth" must be an integer 1 through 64 (got ${JSON.stringify(depth)}) -- refusing before ` +
        `any text-monitor byte is written`,
    );
  }

  const { identity, brokerIdentity } = await capabilityIdentityFor(deps);

  return withTextTool("vice_backtrace", deps, async (client) => {
    const response = await client.command("bt", { timeoutMs: 30000 });

    const classification = classifyTextCapabilityResponse("bt", response);
    if (classification.outcome !== "capable") {
      const verdict = await probeTextCapability({ command: "bt", identity, brokerIdentity, dial: async () => response });
      return isErrorText(`vice_backtrace: ${textCapabilityRefusalMessage([verdict])}`);
    }

    const parsed = parseBacktrace(response);
    if (!parsed.ok) {
      return isErrorText(
        `vice_backtrace: bt's response could not be parsed (${parsed.refusal.code} at line ` +
          `${parsed.refusal.lineNumber}: ${JSON.stringify(parsed.refusal.line)}) -- ${parsed.refusal.message}`,
      );
    }

    const totalCount = parsed.value.frames.length;
    const truncated = isValidBacktraceDepthArg(depth) && depth < totalCount;
    const frames = isValidBacktraceDepthArg(depth) ? parsed.value.frames.slice(0, depth) : parsed.value.frames;

    return derivedAnswer({
      command: "bt",
      currentPc: parsed.value.currentPc,
      frames,
      returnedCount: frames.length,
      totalCount,
      truncated,
    });
  });
}

/**
 * `vice_io_registers` -- dials `io $aaaa` for a REQUIRED `address` argument:
 * unlike the other three parameterized tools, this one refuses a MISSING
 * address outright, because the bare "io" verb dumps every chip and this
 * tool decodes the chip covering exactly one. `address` is validated and
 * rendered by `buildTextCommand()` alone. `io` carries no build-time guard
 * -- `classifyTextCapabilityResponse()` can only ever return `capable` or
 * `indeterminate` for this verb -- but it still degrades PER-CHIP at
 * runtime with its own two fixed strings, a fact the classifier alone
 * cannot see; the probe module's own renderer (`textCapabilityRefusalMessage()`)
 * is always consulted below, whatever this classification said, since that
 * is the one place the chip-degradation-vs-missing-capability distinction
 * is drawn.
 */
export async function handleIoRegisters(args: Record<string, unknown>, deps: StockDispatchDeps): Promise<StockToolResult> {
  const { address } = args;
  if (address === undefined) {
    return isErrorText(
      `vice_io_registers: "address" is REQUIRED (the bare "io" verb dumps every chip; this tool decodes the chip ` +
        `covering ONE address) -- refusing before any text-monitor byte is written`,
    );
  }
  const built = buildTextCommand("io", address);
  if (!built.ok) {
    return isErrorText(`vice_io_registers: ${built.message} -- refusing before any text-monitor byte is written`);
  }
  const command = built.command;

  const { identity, brokerIdentity } = await capabilityIdentityFor(deps);

  return withTextTool("vice_io_registers", deps, async (client) => {
    const response = await client.command(command, { timeoutMs: 30000 });

    // "io" is never gated behind FEATURE_CPUMEMHISTORY -- classifyTextCapabilityResponse()
    // only ever returns "capable" or "indeterminate" for this verb (see
    // CPUHISTORY_GATED_COMMANDS in text-capability-probe.ts), so "capable" here is
    // not the same as "nothing to refuse": the probe module's own renderer is
    // always consulted below, since it is what additionally catches io's own
    // per-chip runtime degradation.
    const classification = classifyTextCapabilityResponse("io", response);
    void classification;
    const verdict = await probeTextCapability({ command: "io", identity, brokerIdentity, dial: async () => response });
    const refusalMessage = textCapabilityRefusalMessage([verdict]);
    if (refusalMessage !== "") {
      return isErrorText(`vice_io_registers: ${refusalMessage}`);
    }

    const parsed = parseIoRegisters(response);
    if (!parsed.ok) {
      return isErrorText(
        `vice_io_registers: io's response could not be parsed (${parsed.refusal.code} at line ` +
          `${parsed.refusal.lineNumber}: ${JSON.stringify(parsed.refusal.line)}) -- ${parsed.refusal.message}`,
      );
    }

    return derivedAnswer({
      command,
      sections: parsed.value.sections,
      unrecognisedLines: parsed.value.unrecognisedLines,
      unrecognisedLineCount: parsed.value.unrecognisedLines.length,
    });
  });
}
