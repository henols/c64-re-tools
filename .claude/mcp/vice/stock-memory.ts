#!/usr/bin/env node
// stock-memory.ts
//
// THE memory half of Family A on the stock backend (D-03/DIRECT-01/
// DIRECT-09): vice_memory_read, vice_memory_write, and vice_memory_banks,
// as StockSessionHandler-shaped exports, plus the per-session bank catalog
// all three share.
//
// WHY THIS FILE EXISTS: this is the first half of phase success criterion
// 1 -- reads must be side-effect-free by default and must not force a
// pause/resume round trip. On stock there is no round trip at all: the
// command halts the machine (D-05) and the answer reports `runState`
// (D-06) via stock-handler.ts's stockAnswer(). A named `bank` argument
// (the fork's own "e.g. 'ram' to read RAM under ROM" convention) must
// resolve to a wire bank id through the emulator's own BANKS_AVAILABLE
// enumeration -- RESEARCH.md's "reading them beats hardcoding a guess" --
// never a hardcoded table, since bank ids are build- and machine-specific.
//
// WHAT NOT TO DO:
//   - Never build a MEM_GET/MEM_SET body by hand -- stock-protocol.ts's
//     memGetBody()/memSetBody() are the only encoders used here.
//   - Never re-derive address parsing locally (D-04) -- stock-address.ts's
//     parseAddress()/parseByteCount() are the only seam.
//   - Never construct an ok-answer outside stockAnswer() (D-06) -- that is
//     exactly how an answer ships without `runState`.
//   - Never send an EXIT to "restore" the machine after a read (D-05) -- a
//     read leaves the machine halted, and the answer says so via runState.
import { CommandType, memGetBody, memSetBody } from "./stock-protocol.ts";
import { parseAddress, parseByteCount } from "./stock-address.ts";
import { convertWireError, isErrorText, stockAnswer, type StockSessionHandler, type StockToolResult } from "./stock-handler.ts";
import type { StockConnectSession } from "./stock-connect.ts";

/** True iff `value` is a well-formed, generic JSON object -- not null, not
 * an array. Matches vice.ts's own isPlainObject() predicate exactly -- the
 * same narrowing discipline this module tree uses everywhere a parsed JSON
 * value's fields are touched (03-PATTERNS.md). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// The bank catalog (Task 2) -- a per-session, lazily-fetched map between a
// bank's wire id and its name, backed by ONE module-level cache keyed on
// the session object (see freshCatalogCache() below for the single
// definition of that cache's storage). A stockReconnect() builds a fresh
// session and therefore naturally gets a fresh catalog, with no manual
// invalidation. Never a module-level singleton, and never a persisted
// record: this is in-memory, per-connection state, unlike
// stock-connect.ts's resolveCapabilities() (settle-once, cache-on-disk).
// ---------------------------------------------------------------------------

export interface BankCatalog {
  byName: Map<string, number>;
  byId: Map<number, string>;
}

/** The one place this file's per-session cache storage is defined -- an
 * object-keyed cache that never prevents a dropped session from being
 * garbage-collected. Both the module-level holder below and
 * resetBankCatalogsForTest() call this rather than repeating the
 * constructor inline. */
function freshCatalogCache(): WeakMap<object, BankCatalog> { return new WeakMap(); }

let bankCatalogs = freshCatalogCache();

/** Test-only: replaces the module-level cache with a fresh one, matching
 * clearHeldStockSession()'s / resetRunStateTrackersForTest()'s role in this
 * module tree's beforeEach() convention. */
export function resetBankCatalogsForTest(): void {
  bankCatalogs = freshCatalogCache();
}

/**
 * Resolves (and caches, per session) the emulator's own bank enumeration.
 * On a cache miss, sends BANKS_AVAILABLE (0x82) with no body -- the opcode
 * takes an empty body, and client.send() already defaults to
 * Buffer.alloc(0), so there is no dedicated wire-body encoder to invent for
 * this command. Bank names are matched case-insensitively on lookup (the
 * lowercased name is the map key; the wire's own spelling is kept in
 * `byId` for reporting), because the fork's own tool description uses
 * lowercase 'ram'.
 */
export async function bankCatalogFor(session: StockConnectSession): Promise<BankCatalog> {
  const existing = bankCatalogs.get(session);
  if (existing) {
    return existing;
  }

  const response = await session.client.send(CommandType.BanksAvailable);
  if (response.type !== "banks_available") {
    throw new Error(`bankCatalogFor: expected a "banks_available" reply, got "${response.type}"`);
  }

  const byName = new Map<string, number>();
  const byId = new Map<number, string>();
  for (const bank of response.banks) {
    byName.set(bank.name.toLowerCase(), bank.id);
    byId.set(bank.id, bank.name);
  }

  const catalog: BankCatalog = { byName, byId };
  bankCatalogs.set(session, catalog);
  return catalog;
}

/** Shared bank-argument resolution for both memory handlers below: omitted
 * `bank` resolves to wire id 0x0000, a non-string `bank` refuses, and an
 * unknown name refuses listing the names the catalog actually returned --
 * never a hardcoded table. Factored once so handleMemoryRead/Write do not
 * each re-derive the same three branches. */
async function resolveBank(
  toolName: string,
  bankArg: unknown,
  session: StockConnectSession,
): Promise<{ ok: true; id: number; name?: string } | { ok: false; result: StockToolResult }> {
  if (bankArg === undefined) {
    return { ok: true, id: 0x0000 };
  }
  if (typeof bankArg !== "string") {
    return { ok: false, result: isErrorText(`${toolName}: bank must be a string, got ${typeof bankArg}`) };
  }

  let catalog: BankCatalog;
  try {
    catalog = await bankCatalogFor(session);
  } catch (err) {
    return { ok: false, result: convertWireError(toolName, err) };
  }

  const resolved = catalog.byName.get(bankArg.toLowerCase());
  if (resolved === undefined) {
    const names = [...catalog.byId.values()].join(", ") || "(none reported)";
    return { ok: false, result: isErrorText(`${toolName}: unknown bank "${bankArg}" -- available banks: ${names}`) };
  }
  return { ok: true, id: resolved, name: bankArg };
}

// ---------------------------------------------------------------------------
// vice_memory_banks (Task 2)
// ---------------------------------------------------------------------------

export const handleMemoryBanks: StockSessionHandler = async (args, session, _deps) => {
  if (!isPlainObject(args)) {
    return isErrorText("vice_memory_banks: arguments must be an object");
  }
  const unexpected = Object.keys(args);
  if (unexpected.length > 0) {
    return isErrorText(`vice_memory_banks: unexpected argument(s): ${unexpected.join(", ")} -- this tool takes no arguments`);
  }

  let catalog: BankCatalog;
  try {
    catalog = await bankCatalogFor(session);
  } catch (err) {
    return convertWireError("vice_memory_banks", err);
  }

  const banks = [...catalog.byId.entries()].map(([id, name]) => ({ id, name }));
  return stockAnswer(session.client, { banks, count: banks.length });
};

// ---------------------------------------------------------------------------
// vice_memory_read (Task 1)
// ---------------------------------------------------------------------------

export const handleMemoryRead: StockSessionHandler = async (args, session, _deps) => {
  if (!isPlainObject(args)) {
    return isErrorText("vice_memory_read: arguments must be an object");
  }

  let address: number;
  try {
    address = parseAddress(args.address, { what: "address" });
  } catch (err) {
    return isErrorText(`vice_memory_read: ${err instanceof Error ? err.message : String(err)}`);
  }

  let size: number;
  try {
    size = parseByteCount(args.size, { max: 0xffff, what: "size" });
  } catch (err) {
    return isErrorText(`vice_memory_read: ${err instanceof Error ? err.message : String(err)}`);
  }

  const end = address + size - 1;
  if (end > 0xffff) {
    return isErrorText(
      `vice_memory_read: address 0x${address.toString(16)} + size ${size} exceeds the 16-bit address space (end would be 0x${end.toString(16)})`,
    );
  }

  let encoding: "hex" | "array" = "hex";
  if (args.encoding !== undefined) {
    if (args.encoding !== "hex" && args.encoding !== "array") {
      return isErrorText(`vice_memory_read: encoding must be "hex" or "array", got ${JSON.stringify(args.encoding)}`);
    }
    encoding = args.encoding;
  }

  let sideEffects = false;
  if (args.sideEffects !== undefined) {
    if (typeof args.sideEffects !== "boolean") {
      return isErrorText(`vice_memory_read: sideEffects must be a boolean, got ${typeof args.sideEffects}`);
    }
    sideEffects = args.sideEffects;
  }

  const bankResolution = await resolveBank("vice_memory_read", args.bank, session);
  if (!bankResolution.ok) {
    return bankResolution.result;
  }

  // Memspace is fixed to 0x00 (main) in Phase 3 -- drive memspace is Phase
  // 6's GAIN-03; there is deliberately no argument for it here.
  const body = memGetBody({ sidefx: sideEffects, start: address, end, memspace: 0x00, bank: bankResolution.id });

  let response;
  try {
    response = await session.client.send(CommandType.MemoryGet, body);
  } catch (err) {
    return convertWireError("vice_memory_read", err);
  }

  if (response.type !== "memory_get") {
    return isErrorText(
      `vice_memory_read: the binary monitor replied with an unexpected response type ("${response.type}"), expected "memory_get"`,
    );
  }

  if (response.bytes.length !== size) {
    return isErrorText(`vice_memory_read: expected ${size} byte(s), got ${response.bytes.length} -- a short read is a wrong answer, not a partial success`);
  }

  const payload: Record<string, unknown> = {
    address,
    size,
    encoding,
    sideEffects,
    bank: bankResolution.name !== undefined ? { id: bankResolution.id, name: bankResolution.name } : bankResolution.id,
    memspace: "main",
  };
  if (encoding === "hex") {
    payload.hex = Buffer.from(response.bytes).toString("hex");
  } else {
    payload.bytes = Array.from(response.bytes);
  }

  return stockAnswer(session.client, payload);
};

// ---------------------------------------------------------------------------
// vice_memory_write (Task 1)
// ---------------------------------------------------------------------------

export const handleMemoryWrite: StockSessionHandler = async (args, session, _deps) => {
  if (!isPlainObject(args)) {
    return isErrorText("vice_memory_write: arguments must be an object");
  }

  let address: number;
  try {
    address = parseAddress(args.address, { what: "address" });
  } catch (err) {
    return isErrorText(`vice_memory_write: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!Array.isArray(args.data)) {
    return isErrorText(`vice_memory_write: data must be an array of integers 0..255, got ${typeof args.data}`);
  }
  if (args.data.length === 0) {
    return isErrorText("vice_memory_write: data must not be empty");
  }
  const data: number[] = [];
  for (let index = 0; index < args.data.length; index += 1) {
    const value: unknown = args.data[index];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 0xff) {
      return isErrorText(`vice_memory_write: data[${index}] must be an integer 0..255, got ${JSON.stringify(value)}`);
    }
    data.push(value);
  }

  const end = address + data.length - 1;
  if (end > 0xffff) {
    return isErrorText(
      `vice_memory_write: address 0x${address.toString(16)} + data.length ${data.length} exceeds the 16-bit address space (end would be 0x${end.toString(16)})`,
    );
  }

  const bankResolution = await resolveBank("vice_memory_write", args.bank, session);
  if (!bankResolution.ok) {
    return bankResolution.result;
  }

  // memSetBody() forces sidefx to 0x00 on the wire -- a write is not a read
  // and takes no sideEffects argument.
  const body = memSetBody({ start: address, end, memspace: 0x00, bank: bankResolution.id, data: Buffer.from(data) });

  let response;
  try {
    response = await session.client.send(CommandType.MemorySet, body);
  } catch (err) {
    return convertWireError("vice_memory_write", err);
  }

  // MEM_SET's acknowledgement carries no useful body -- stock-protocol.ts
  // has no named parsed shape for it (matching several other ack-only
  // commands in that file's switch), so the "unknown" fallback IS the
  // expected reply shape here, not an error. Anything else would mean a
  // future parser change gave MEM_SET a real shape without this handler
  // noticing.
  if (response.type !== "unknown") {
    return isErrorText(
      `vice_memory_write: the binary monitor replied with an unexpected response type ("${response.type}"), expected an acknowledgement`,
    );
  }

  return stockAnswer(session.client, {
    address,
    bytesWritten: data.length,
    bank: bankResolution.name !== undefined ? { id: bankResolution.id, name: bankResolution.name } : bankResolution.id,
    memspace: "main",
  });
};
