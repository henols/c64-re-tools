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
import { CommandType, memspaceBody } from "./stock-protocol.ts";
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
