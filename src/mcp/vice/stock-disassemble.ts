#!/usr/bin/env node
// stock-disassemble.ts
//
// vice_disassemble -- a DERIVED tool (DERIV-07, DISASM-01): its answer is
// computed CLIENT-SIDE from bytes MEM_GET returned (disasm-decoder.ts's
// decode() + disasm-renderer.ts's render()), never answered by one
// binary-monitor opcode the way a direct tool's answer is. Registered
// through withDerivedTool() in stock-dispatch.ts, never withStockSession()
// (D-01/D-03) -- this is the first and largest consumer of the derived-tool
// seam 04-02 built.
//
// WHY THIS FILE EXISTS: DISASM-01 is criterion 2's own sentence -- "a user
// can disassemble a memory range on the stock backend" -- and the binary
// monitor has no disassemble opcode at all. `address`/`count`/`show_symbols`
// keep the fork's own names, types and defaults (Phase 3 D-03); `end` is a
// stock-only optional extra, mutually exclusive with `count` (D-12, never
// silently resolved -- a caller that gets a silently-different range than it
// asked for reads the wrong code).
//
// WHAT NOT TO DO:
//   - Never import hostpath.ts or vice-proxy.ts, and never call the
//     fork-forwarding function's rewriteArguments() -- hostpath-consumers.test.ts
//     gates this file's absence from the closed host-path consumer set
//     (D-02). This tool takes no path argument at all; the surface is empty
//     by construction.
//   - Never issue an unrequested resume (Phase 3 D-05) -- this handler sends
//     MEM_GET and nothing else. `runState` on the answer (via stockAnswer())
//     reports the halt honestly.
//   - Never turn the MEM_GET body's side-effect flag on -- disassembling
//     $D000-$DFFF must never clear a pending VIC-II IRQ flag or otherwise
//     mutate emulator state as a side effect of reading it. `sidefx` is
//     hardcoded `false` below with no argument to override it.
//   - Never build the answer outside stockAnswer() (D-06) -- that is exactly
//     how an answer ships without `runState`.
//   - Never re-derive address/byte-count parsing locally (D-04) --
//     stock-address.ts's parseAddress()/parseByteCount() are the only seam.
import { CommandType, memGetBody } from "./stock-protocol.ts";
import { parseAddress, parseByteCount, symbolNameFor, hasSymbolStore } from "./stock-address.ts";
import { convertWireError, isErrorText, stockAnswer, type StockSessionHandler } from "./stock-handler.ts";
import { decode, type Instruction } from "./disasm-decoder.ts";
import { render } from "./disasm-renderer.ts";

/** True iff `value` is a well-formed, generic JSON object -- not null, not
 * an array. Matches this module tree's own isPlainObject() convention
 * (stock-memory.ts, disasm-decoder.ts et al.). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** D-13's answer bound: at most this many instructions are ever returned in
 * one answer, regardless of which form (`count` or `end`) requested the
 * range. `count` itself is already capped at this same value (the fork's own
 * documented max), but the `end` form has no natural cap of its own -- an
 * unbounded answer is the DoS surface (T-04-05-03). */
const MAX_INSTRUCTIONS = 100;

/** Renders an 8-bit value as ACME hex syntax, e.g. `$0f`. Duplicated from
 * disasm-renderer.ts's own private helper of the same shape -- that module
 * exports no per-operand text primitive, and this file's `instructions[]`
 * answer field is a distinct concern from `listing` (D-13's structured
 * per-instruction fields are plain numeric text, never symbol-substituted;
 * `listing` is the one place a substituted symbol name appears). */
function hex2(value: number): string {
  return `$${(value & 0xff).toString(16).padStart(2, "0")}`;
}

/** Renders a 16-bit value as ACME hex syntax, e.g. `$d020`. */
function hex4(value: number): string {
  return `$${(value & 0xffff).toString(16).padStart(4, "0")}`;
}

/**
 * Renders just the operand text for one decoded, non-truncated instruction
 * -- the per-instruction `operand` field (D-13), always numeric (never
 * symbol-substituted; that substitution belongs to `listing` alone).
 * Returns `""` for a mode with no operand at all. Must never be called on a
 * truncated instruction (its `operand`/`resolvedTarget` keys are absent by
 * construction, DISASM-05) -- callers guard on `notes.includes("truncated")`
 * first and use `""` directly instead.
 */
function operandTextFor(instr: Instruction): string {
  switch (instr.mode) {
    case "implicit":
    case "accumulator":
      return "";
    case "immediate":
      return `#${hex2(instr.operand!.value)}`;
    case "zeropage":
      return hex2(instr.operand!.value);
    case "zeropage_x":
      return `${hex2(instr.operand!.value)},x`;
    case "zeropage_y":
      return `${hex2(instr.operand!.value)},y`;
    case "indirect_x":
      return `(${hex2(instr.operand!.value)},x)`;
    case "indirect_y":
      return `(${hex2(instr.operand!.value)}),y`;
    case "indirect":
      return `(${hex4(instr.operand!.value)})`;
    case "relative":
      return hex4(instr.resolvedTarget!);
    case "absolute":
      return hex4(instr.operand!.value);
    case "absolute_x":
      return `${hex4(instr.operand!.value)},x`;
    case "absolute_y":
      return `${hex4(instr.operand!.value)},y`;
  }
}

export const handleDisassemble: StockSessionHandler = async (args, session, _deps) => {
  if (!isPlainObject(args)) {
    return isErrorText("vice_disassemble: arguments must be an object");
  }

  // --------------------------------------------------------- address (required)

  let address: number;
  try {
    address = parseAddress(args.address, { what: "address" });
  } catch (err) {
    return isErrorText(`vice_disassemble: ${err instanceof Error ? err.message : String(err)}`);
  }

  // --------------------------------------------------------- D-12: mutual exclusion, refused outright
  //
  // Gated on args.count !== undefined -- explicitly supplied -- never on the
  // resolved default, so an `end`-only call is never refused because of
  // count's own default of 10.
  if (args.count !== undefined && args.end !== undefined) {
    return isErrorText(
      `vice_disassemble: count and end are mutually exclusive -- supply one or the other, not both ` +
        `(got count=${JSON.stringify(args.count)}, end=${JSON.stringify(args.end)})`,
    );
  }

  // --------------------------------------------------------- count (optional, default 10, max 100)

  let count: number | undefined;
  if (args.count !== undefined) {
    try {
      count = parseByteCount(args.count, { max: MAX_INSTRUCTIONS, what: "count" });
    } catch (err) {
      return isErrorText(`vice_disassemble: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const effectiveCount = count ?? 10;

  // --------------------------------------------------------- end (optional, stock-only extra)

  let end: number | undefined;
  if (args.end !== undefined) {
    try {
      end = parseAddress(args.end, { what: "end" });
    } catch (err) {
      return isErrorText(`vice_disassemble: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (end < address) {
      return isErrorText(
        `vice_disassemble: end (0x${end.toString(16)}) must be >= address (0x${address.toString(16)})`,
      );
    }
  }

  // --------------------------------------------------------- show_symbols (optional, default true)

  let showSymbols = true;
  if (args.show_symbols !== undefined) {
    if (typeof args.show_symbols !== "boolean") {
      return isErrorText(`vice_disassemble: show_symbols must be a boolean, got ${typeof args.show_symbols}`);
    }
    showSymbols = args.show_symbols;
  }

  // --------------------------------------------------------- bounded memory read (Phase 3 D-05: halts, never resumes)
  //
  // `end` form: over-read by two bytes so the last instruction that STARTS
  // at or before `end` has its full length available; `count` form:
  // over-read by up to two extra bytes per instruction (three is the
  // maximum instruction length) so `count` instructions can always be
  // decoded. Both clamped at $ffff -- a genuine memspace boundary, not a
  // client bug.
  const readEnd = end !== undefined ? Math.min(end + 2, 0xffff) : Math.min(address + effectiveCount * 3 - 1, 0xffff);

  const body = memGetBody({ sidefx: false, start: address, end: readEnd, memspace: 0x00, bank: 0x0000 });

  let response;
  try {
    response = await session.client.send(CommandType.MemoryGet, body);
  } catch (err) {
    return convertWireError("vice_disassemble", err);
  }

  if (response.type !== "memory_get") {
    return isErrorText(
      `vice_disassemble: the binary monitor replied with an unexpected response type ("${response.type}"), expected "memory_get"`,
    );
  }

  const expectedLength = readEnd - address + 1;
  if (response.bytes.length !== expectedLength) {
    return isErrorText(
      `vice_disassemble: expected ${expectedLength} byte(s), got ${response.bytes.length} -- a short read is a wrong answer, not a partial success`,
    );
  }

  // --------------------------------------------------------- decode and render

  const decoded = decode(response.bytes, address, end !== undefined ? { end } : { count: effectiveCount });

  let limitReached = false;
  let nextAddress: number | undefined;
  let kept = decoded;
  if (decoded.length > MAX_INSTRUCTIONS) {
    kept = decoded.slice(0, MAX_INSTRUCTIONS);
    limitReached = true;
    nextAddress = decoded[MAX_INSTRUCTIONS]!.address;
  }

  // D-14: show_symbols with no store installed is a successful no-op that
  // SAYS SO -- never an error.
  const symbolsApplied = showSymbols && hasSymbolStore();
  const listing = render(kept, { showSymbols: symbolsApplied, symbolFor: symbolNameFor, origin: address });

  const instructions = kept.map((instr) => {
    const truncated = instr.notes.includes("truncated");
    return {
      address: instr.address,
      bytes: instr.bytes,
      mnemonic: truncated ? "" : instr.mnemonic,
      operand: truncated ? "" : operandTextFor(instr),
      ...(instr.resolvedTarget !== undefined ? { resolvedTarget: instr.resolvedTarget } : {}),
      notes: instr.notes,
    };
  });

  const payload: Record<string, unknown> = {
    address,
    ...(end !== undefined ? { end } : {}),
    count: kept.length,
    instructions,
    listing,
    symbolsApplied,
    ...(showSymbols && !symbolsApplied
      ? { symbolNote: "no symbol table is loaded -- addresses are rendered numerically. Load one to see symbol names." }
      : {}),
    limitReached,
    ...(limitReached ? { nextAddress } : {}),
  };

  return stockAnswer(session.client, payload);
};
