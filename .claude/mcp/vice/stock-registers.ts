#!/usr/bin/env node
// stock-registers.ts
//
// THE ONE place that resolves stock VICE's REGISTERS_AVAILABLE (0x83)
// enumeration into a per-session register catalog, plus the three
// vice_registers_* StockSessionHandlers built on it: the stock-only
// vice_registers_available (enumeration) and the fork-compatible
// vice_registers_get / vice_registers_set (value read/write).
//
// WHY THIS FILE EXISTS: REGISTERS_SET's wire body needs a numeric register
// id (stock-protocol.ts's registersSetBody()), while the fork's
// vice_registers_set takes a register NAME (D-03: stock keeps the fork's
// argument shape). VICE enumerates its own register ids through
// REGISTERS_AVAILABLE, and those ids are NOT guaranteed identical across
// builds (docs/phase0-binmon-findings.md) -- so a caller must resolve a
// name through the CONNECTED build's own answer, never a table this
// module wrote down in advance. This file is the one seam that performs
// that resolution, caches it per session (so every call after the first
// is free), and exposes both the enumeration itself (planner decision,
// recorded in 03-07-PLAN.md: a stock-only tool, not a field grafted onto
// vice_registers_get's answer, because enumeration and value-reading are
// different operations with different callers) and the two value
// handlers that consume the resulting catalog.
//
// WHAT NOT TO DO:
//   - Never hardcode VICE's internal register ids (PC/A/X/Y/SP/...) --
//     they are enumerated by the wire, per memspace, and are not
//     guaranteed identical across builds. A hardcoded table here is
//     exactly the class of bug this file exists to make unreachable.
//   - Never construct an ok-answer outside stockAnswer() (D-06) -- every
//     answer this module returns must carry runState, and stockAnswer()
//     is the one place that stamps it.
//   - Never send an EXIT (0xaa) from this module (D-05) -- no handler
//     here may resume a machine the agent did not ask to resume.
//   - Never re-fetch the catalog per call. The catalog is cached on the
//     session object itself (a fresh stockReconnect() hands back a NEW
//     session object, so it naturally gets a fresh catalog with no
//     manual invalidation needed) -- a handler that calls
//     registerCatalogFor() more than once per session for the same
//     enumeration is re-deriving the cache this function already is.
import { CommandType, memspaceBody, registersSetBody, type RegisterSetItem } from "./stock-protocol.ts";
import { stockAnswer, convertWireError, isErrorText, type StockSessionHandler } from "./stock-handler.ts";
import type { StockConnectSession } from "./stock-connect.ts";

// ---------------------------------------------------------------------------
// The per-session register catalog
// ---------------------------------------------------------------------------

export interface RegisterCatalog {
  /** Keyed on the wire's own register NAME, uppercased -- the value keeps
   * the wire's original spelling (`name`) for reporting, so an answer never
   * silently re-cases what the emulator itself called the register. */
  byName: Map<string, { id: number; size: number; name: string }>;
  /** Keyed on the wire's numeric register id -- REGISTERS_GET/SET's own
   * per-item identifier. */
  byId: Map<number, { size: number; name: string }>;
}

/** The one module-level catalog map, keyed on the session object itself --
 * NOT on session.client -- so a fresh stockReconnect() (which returns a
 * brand-new session) is indistinguishable from "never fetched" and simply
 * fetches again, with no manual invalidation path required anywhere. */
// Single-line by design: the ONLY line in this file naming the garbage-
// collectable, session-keyed map primitive directly (grep-gated -- see
// this plan's own acceptance criteria). Every other reference goes
// through this factory, never a second construction call site.
function freshCatalogMap(): WeakMap<StockConnectSession, RegisterCatalog> { return new WeakMap<StockConnectSession, RegisterCatalog>(); }

let catalogs = freshCatalogMap();

/** Test-only: replaces the module-level catalog map with a fresh one,
 * matching stock-runstate.ts's resetRunStateTrackersForTest() / this
 * module tree's own beforeEach()-reset convention. */
export function resetRegisterCatalogsForTest(): void {
  catalogs = freshCatalogMap();
}

/**
 * Resolves `session`'s register catalog, fetching it through
 * REGISTERS_AVAILABLE (0x83) exactly once and caching the result on the
 * session object. Every subsequent call for the SAME session object
 * returns the cached catalog with no further wire traffic.
 *
 * Refuses (throws a plain Error, converted by the caller through
 * convertWireError()) an empty enumeration rather than caching it: a
 * build that enumerates zero registers cannot support
 * vice_registers_set, and that failure must be visible on every call,
 * never silently cached as "zero registers, nothing to resolve".
 */
export async function registerCatalogFor(session: StockConnectSession): Promise<RegisterCatalog> {
  const existing = catalogs.get(session);
  if (existing) {
    return existing;
  }

  const response = await session.client.send(CommandType.RegistersAvailable, memspaceBody({ memspace: 0x00 }));
  if (response.type !== "registers_available") {
    throw new Error(`registerCatalogFor: expected a registers_available reply, got "${response.type}"`);
  }
  if (response.registers.length === 0) {
    throw new Error(
      "registerCatalogFor: the connected VICE build enumerated zero registers via REGISTERS_AVAILABLE -- " +
        "it cannot support vice_registers_set, and this failure must be named rather than cached as an empty catalog",
    );
  }

  const byName = new Map<string, { id: number; size: number; name: string }>();
  const byId = new Map<number, { size: number; name: string }>();
  for (const reg of response.registers) {
    byName.set(reg.name.toUpperCase(), { id: reg.id, size: reg.size, name: reg.name });
    byId.set(reg.id, { size: reg.size, name: reg.name });
  }
  const catalog: RegisterCatalog = { byName, byId };
  catalogs.set(session, catalog);
  return catalog;
}

// ---------------------------------------------------------------------------
// vice_registers_available -- stock-only, no fork counterpart.
// ---------------------------------------------------------------------------

export const handleRegistersAvailable: StockSessionHandler = async (args, session) => {
  const unexpectedKeys = Object.keys(args);
  if (unexpectedKeys.length > 0) {
    return isErrorText(`vice_registers_available: unexpected argument(s): ${unexpectedKeys.join(", ")} -- this tool takes no arguments`);
  }

  let catalog: RegisterCatalog;
  try {
    catalog = await registerCatalogFor(session);
  } catch (err) {
    return convertWireError("vice_registers_available", err);
  }

  // catalog.byId preserves insertion order, which is the order registers
  // were pushed while walking REGISTERS_AVAILABLE's own reply -- i.e. the
  // wire's own order, never re-sorted.
  const registers = [...catalog.byId.entries()].map(([id, reg]) => ({ id, name: reg.name, size: reg.size }));

  return stockAnswer(session.client, { registers, count: registers.length, memspace: "main" });
};

// ---------------------------------------------------------------------------
// vice_registers_get -- fork-compatible, no required arguments.
// ---------------------------------------------------------------------------

export const handleRegistersGet: StockSessionHandler = async (args, session) => {
  const unexpectedKeys = Object.keys(args);
  if (unexpectedKeys.length > 0) {
    return isErrorText(`vice_registers_get: unexpected argument(s): ${unexpectedKeys.join(", ")} -- this tool takes no arguments`);
  }

  let catalog: RegisterCatalog;
  try {
    catalog = await registerCatalogFor(session);
  } catch (err) {
    return convertWireError("vice_registers_get", err);
  }

  let response;
  try {
    response = await session.client.send(CommandType.RegistersGet, memspaceBody({ memspace: 0x00 }));
  } catch (err) {
    return convertWireError("vice_registers_get", err);
  }
  if (response.type !== "registers") {
    return isErrorText(`vice_registers_get: expected a registers reply, got "${response.type}"`);
  }

  // D-01 (stock-native shape): `registers` is name -> value for every id the
  // catalog resolves. The fork's `register` argument enumerates individual
  // status-register flag bits (N|V|B|D|I|Z|C) -- those are NOT separate
  // wire registers; the binary monitor exposes only the whole status
  // register the catalog itself names (typically "FL" or similar). This
  // handler reports that register's raw value as a number; it does not
  // synthesise per-bit fields in Phase 3 (see handleRegistersSet's own
  // flag-bit refusal for the write-side half of the same limitation).
  const registers: Record<string, number> = {};
  const unknownIds: Array<{ id: number; value: number }> = [];
  for (const reg of response.registers) {
    const known = catalog.byId.get(reg.id);
    if (known) {
      registers[known.name] = reg.value;
    } else {
      // Reported, never dropped -- a silently omitted register would be a
      // wrong answer, not merely an incomplete one.
      unknownIds.push({ id: reg.id, value: reg.value });
    }
  }

  return stockAnswer(session.client, { registers, unknownIds, memspace: "main" });
};

// ---------------------------------------------------------------------------
// vice_registers_set -- fork-compatible required arguments (register, value).
// ---------------------------------------------------------------------------

/** The 6502 status-register flag-bit names the fork's own `register`
 * argument enumerates alongside the "real" wire registers. None of these
 * are individually addressable on stock -- REGISTERS_SET can only write
 * the whole status register the catalog itself names. Bit positions are
 * the conventional 6502 layout (bit 7 down to bit 0), used only to make
 * the explanatory refusal concrete, never to perform a read-modify-write. */
const FLAG_BIT_POSITIONS: Record<string, number> = { N: 7, V: 6, B: 4, D: 3, I: 2, Z: 1, C: 0 };

/** Candidate names a connected build might use for the whole processor
 * status register -- checked in order against the resolved catalog so the
 * flag-bit refusal can name the ACTUAL register this build reports,
 * rather than guessing a name that might not exist on this build. */
const STATUS_REGISTER_CANDIDATES = ["FL", "SR", "P", "STATUS", "FLAGS"];

function findStatusRegisterName(catalog: RegisterCatalog): string | null {
  for (const candidate of STATUS_REGISTER_CANDIDATES) {
    const found = catalog.byName.get(candidate);
    if (found) {
      return found.name;
    }
  }
  return null;
}

export const handleRegistersSet: StockSessionHandler = async (args, session) => {
  const rawRegister = args.register;
  const rawValue = args.value;

  if (typeof rawRegister !== "string" || rawRegister.trim().length === 0) {
    return isErrorText(`vice_registers_set: "register" is required and must be a non-empty string, got ${JSON.stringify(rawRegister)}`);
  }
  if (typeof rawValue !== "number" || !Number.isInteger(rawValue)) {
    return isErrorText(`vice_registers_set: "value" is required and must be an integer, got ${JSON.stringify(rawValue)}`);
  }

  let catalog: RegisterCatalog;
  try {
    catalog = await registerCatalogFor(session);
  } catch (err) {
    return convertWireError("vice_registers_set", err);
  }

  const name = rawRegister.trim().toUpperCase();
  const resolved = catalog.byName.get(name);
  if (!resolved) {
    if (name in FLAG_BIT_POSITIONS) {
      const statusName = findStatusRegisterName(catalog);
      const statusDescription = statusName
        ? `reported by this catalog as "${statusName}"`
        : "not identifiable by name in this catalog";
      return isErrorText(
        `vice_registers_set: "${rawRegister}" names an individual processor-status flag bit, not a wire register -- ` +
          `the binary monitor exposes only the WHOLE status register (${statusDescription}), never per-bit access. ` +
          `Read that register's value and test/set bit ${FLAG_BIT_POSITIONS[name]} yourself rather than writing "${rawRegister}" directly ` +
          `(this is an explanatory refusal, not a silent read-modify-write).`,
      );
    }
    const available = [...catalog.byName.keys()].sort().join(", ");
    return isErrorText(`vice_registers_set: unknown register "${rawRegister}" -- available registers: ${available}`);
  }

  const { id, size } = resolved;
  let max: number;
  if (size === 1) {
    max = 0xff;
  } else if (size === 2) {
    max = 0xffff;
  } else {
    return isErrorText(
      `vice_registers_set: register "${resolved.name}" has an unexpected declared size (${size} byte(s)) -- only 1- or 2-byte registers are supported`,
    );
  }
  if (rawValue < 0 || rawValue > max) {
    return isErrorText(
      `vice_registers_set: value ${rawValue} is out of range for register "${resolved.name}" (size ${size} byte(s), valid range 0..0x${max.toString(16)})`,
    );
  }

  const items: RegisterSetItem[] = [{ id, value: rawValue }];
  let body: Buffer;
  try {
    body = registersSetBody({ memspace: 0x00, items });
  } catch (err) {
    return convertWireError("vice_registers_set", err);
  }

  let response;
  try {
    response = await session.client.send(CommandType.RegistersSet, body);
  } catch (err) {
    return convertWireError("vice_registers_set", err);
  }
  if (response.type !== "registers") {
    return isErrorText(`vice_registers_set: expected a registers reply after REGISTERS_SET, got "${response.type}"`);
  }

  // VICE answers REGISTERS_SET with a full RegisterInfo dump -- read the
  // just-written register's value back out of THAT reply, so a write the
  // emulator silently clamped or otherwise altered is visible rather than
  // assumed identical to what was requested.
  const observed = response.registers.find((reg) => reg.id === id);
  const observedValue = observed ? observed.value : null;

  return stockAnswer(session.client, {
    register: resolved.name,
    id,
    requestedValue: rawValue,
    observedValue,
    memspace: "main",
  });
};
