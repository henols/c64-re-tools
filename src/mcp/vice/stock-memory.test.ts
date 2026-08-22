// node:test coverage of stock-memory.ts -- handleMemoryRead, handleMemoryWrite,
// bankCatalogFor(), and handleMemoryBanks. Every "session" below is built by
// makeSession(), whose `client` is a real EventEmitter (never a real socket)
// with a `send` spy recording every call as [commandType, body], matching
// stock-dispatch.test.ts's own DI-stub convention: these tests assert WIRING
// (call order, call count, byte-level body contents, answer shape), never a
// real protocol round trip.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { handleMemoryRead, handleMemoryWrite, handleMemoryBanks, bankCatalogFor, resetBankCatalogsForTest, resolveRequiredBank } from "./stock-memory.ts";
import { CommandType, ErrorCode, StockProtocolError } from "./stock-protocol.ts";
import { resetRunStateTrackersForTest } from "./stock-runstate.ts";
import type { StockConnectSession } from "./stock-connect.ts";
import type { StockDispatchDeps } from "./stock-dispatch.ts";

beforeEach(() => {
  resetBankCatalogsForTest();
  resetRunStateTrackersForTest();
});

type SendCall = [number, Buffer];

/** Builds a fake StockConnectSession whose `client` is a real EventEmitter
 * with a `send` spy recording every call as [commandType, body]. `sendImpl`
 * decides what each call resolves (or throws) to. Never a real socket. */
function makeSession(sendImpl: (commandType: number, body: Buffer) => unknown): {
  session: StockConnectSession;
  calls: SendCall[];
} {
  const calls: SendCall[] = [];
  const client = Object.assign(new EventEmitter(), {
    send: async (commandType: number, body: Buffer = Buffer.alloc(0)) => {
      calls.push([commandType, body]);
      return sendImpl(commandType, body);
    },
  });
  const session = { client } as unknown as StockConnectSession;
  return { session, calls };
}

const DEPS = {} as unknown as StockDispatchDeps;

function memoryGetReply(bytes: number[], requestId = 1) {
  return { type: "memory_get" as const, requestId, errorCode: ErrorCode.Ok, bytes: Buffer.from(bytes), related: [] };
}

function banksAvailableReply(banks: Array<{ id: number; name: string }>, requestId = 2) {
  return { type: "banks_available" as const, requestId, errorCode: ErrorCode.Ok, banks, related: [] };
}

function ackReply(requestId = 3) {
  return { type: "unknown" as const, requestId, errorCode: ErrorCode.Ok, responseType: CommandType.MemorySet, related: [] };
}

function twoBankReply() {
  return banksAvailableReply([
    { id: 0x00, name: "default" },
    { id: 0x0c, name: "RAM" },
  ]);
}

// ---------------------------------------------------------------------------
// handleMemoryRead (Task 1)
// ---------------------------------------------------------------------------

test("handleMemoryRead: reading $D019 with no sideEffects argument sends MEM_GET with sidefx byte 0x00", async () => {
  const { session, calls } = makeSession(() => memoryGetReply([0x00]));
  const result = await handleMemoryRead({ address: "$D019", size: 1 }, session, DEPS);
  assert.equal(result.isError, false);
  assert.equal(calls.length, 1);
  const [commandType, body] = calls[0]!;
  assert.equal(commandType, CommandType.MemoryGet);
  assert.equal(body[0], 0x00);
});

test("handleMemoryRead: sideEffects: true sets the MEM_GET sidefx byte to 0x01", async () => {
  const { session, calls } = makeSession(() => memoryGetReply([0x00]));
  await handleMemoryRead({ address: "$D019", size: 1, sideEffects: true }, session, DEPS);
  assert.equal(calls[0]![1][0], 0x01);
});

test("handleMemoryRead: the recorded MEM_GET body is exactly 8 bytes; start and end are both 0xd019 for size: 1", async () => {
  const { session, calls } = makeSession(() => memoryGetReply([0x00]));
  await handleMemoryRead({ address: "$D019", size: 1 }, session, DEPS);
  const body = calls[0]![1];
  assert.equal(body.length, 8);
  assert.equal(body.readUInt16LE(1), 0xd019);
  assert.equal(body.readUInt16LE(3), 0xd019);
});

test('handleMemoryRead: a symbolic address refuses with "no symbol table" and records zero sends', async () => {
  const { session, calls } = makeSession(() => memoryGetReply([0x00]));
  const result = await handleMemoryRead({ address: "SCREEN", size: 1 }, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /no symbol table/);
  assert.equal(calls.length, 0);
});

test("handleMemoryRead: size: 0 refuses with zero sends", async () => {
  const { session, calls } = makeSession(() => memoryGetReply([0x00]));
  const result = await handleMemoryRead({ address: "$1000", size: 0 }, session, DEPS);
  assert.equal(result.isError, true);
  assert.equal(calls.length, 0);
});

test("handleMemoryRead: address $fffe, size 4 refuses (end overflows 0xffff) with zero sends", async () => {
  const { session, calls } = makeSession(() => memoryGetReply([0x00, 0x00, 0x00, 0x00]));
  const result = await handleMemoryRead({ address: "$fffe", size: 4 }, session, DEPS);
  assert.equal(result.isError, true);
  assert.equal(calls.length, 0);
});

test("handleMemoryRead: a short memory_get reply (2 bytes for a size: 4 request) refuses naming both numbers", async () => {
  const { session } = makeSession(() => memoryGetReply([0x01, 0x02]));
  const result = await handleMemoryRead({ address: "$1000", size: 4 }, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /expected 4 byte\(s\), got 2/);
});

test('handleMemoryRead: default encoding is "hex" -- carries a hex string, no bytes key', async () => {
  const { session } = makeSession(() => memoryGetReply([0xde, 0xad]));
  const result = await handleMemoryRead({ address: "$1000", size: 2 }, session, DEPS);
  const parsed = JSON.parse(result.content[0]!.text);
  assert.equal(parsed.hex, "dead");
  assert.equal("bytes" in parsed, false);
});

test('handleMemoryRead: encoding: "array" carries bytes, no hex key', async () => {
  const { session } = makeSession(() => memoryGetReply([0xde, 0xad]));
  const result = await handleMemoryRead({ address: "$1000", size: 2, encoding: "array" }, session, DEPS);
  const parsed = JSON.parse(result.content[0]!.text);
  assert.deepEqual(parsed.bytes, [0xde, 0xad]);
  assert.equal("hex" in parsed, false);
});

test("handleMemoryRead: every ok-answer carries a runState key", async () => {
  const { session } = makeSession(() => memoryGetReply([0x00]));
  const result = await handleMemoryRead({ address: "$1000", size: 1 }, session, DEPS);
  const parsed = JSON.parse(result.content[0]!.text);
  assert.ok("runState" in parsed);
});

test('handleMemoryRead: a send() rejection with StockProtocolError(InvalidMemspace) produces isError: true, no "wedge" text', async () => {
  const { session } = makeSession(() => {
    throw new StockProtocolError("bad memspace", { errorCode: ErrorCode.InvalidMemspace });
  });
  const result = await handleMemoryRead({ address: "$1000", size: 1 }, session, DEPS);
  assert.equal(result.isError, true);
  assert.doesNotMatch(result.content[0]!.text, /wedge/i);
});

// ---------------------------------------------------------------------------
// handleMemoryWrite (Task 1)
// ---------------------------------------------------------------------------

test("handleMemoryWrite: data: [1,2,3] sends MEM_SET with body length 11 and end = start + 2", async () => {
  const { session, calls } = makeSession(() => ackReply());
  const result = await handleMemoryWrite({ address: "$1000", data: [1, 2, 3] }, session, DEPS);
  assert.equal(result.isError, false);
  assert.equal(calls.length, 1);
  const [commandType, body] = calls[0]!;
  assert.equal(commandType, CommandType.MemorySet);
  assert.equal(body.length, 11);
  assert.equal(body.readUInt16LE(3), 0x1000 + 2);
});

test("handleMemoryWrite: data: [256] refuses naming index 0, zero sends", async () => {
  const { session, calls } = makeSession(() => ackReply());
  const result = await handleMemoryWrite({ address: "$1000", data: [256] }, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /data\[0\]/);
  assert.equal(calls.length, 0);
});

test("handleMemoryWrite: data: [] refuses, zero sends", async () => {
  const { session, calls } = makeSession(() => ackReply());
  const result = await handleMemoryWrite({ address: "$1000", data: [] }, session, DEPS);
  assert.equal(result.isError, true);
  assert.equal(calls.length, 0);
});

test("handleMemoryWrite: every ok-answer carries a runState key", async () => {
  const { session } = makeSession(() => ackReply());
  const result = await handleMemoryWrite({ address: "$1000", data: [1] }, session, DEPS);
  const parsed = JSON.parse(result.content[0]!.text);
  assert.ok("runState" in parsed);
  assert.equal(parsed.bytesWritten, 1);
});

// ---------------------------------------------------------------------------
// bankCatalogFor() (Task 2)
// ---------------------------------------------------------------------------

test("bankCatalogFor: a synthetic banks-available reply populates both byName and byId maps", async () => {
  const { session, calls } = makeSession(() => twoBankReply());
  const catalog = await bankCatalogFor(session);
  assert.equal(calls.length, 1);
  assert.equal(catalog.byName.get("default"), 0x00);
  assert.equal(catalog.byName.get("ram"), 0x0c);
  assert.equal(catalog.byId.get(0x0c), "RAM");
});

test("bankCatalogFor: a second call on the SAME session records no second send", async () => {
  const { session, calls } = makeSession(() => twoBankReply());
  await bankCatalogFor(session);
  await bankCatalogFor(session);
  assert.equal(calls.length, 1);
});

test("bankCatalogFor: a DIFFERENT session object triggers a fresh fetch", async () => {
  const { session: sessionA, calls: callsA } = makeSession(() => twoBankReply());
  const { session: sessionB, calls: callsB } = makeSession(() => twoBankReply());
  await bankCatalogFor(sessionA);
  await bankCatalogFor(sessionB);
  assert.equal(callsA.length, 1);
  assert.equal(callsB.length, 1);
});

// ---------------------------------------------------------------------------
// handleMemoryBanks (Task 2)
// ---------------------------------------------------------------------------

test("handleMemoryBanks: answer lists both banks in wire order and carries runState", async () => {
  const { session } = makeSession(() => twoBankReply());
  const result = await handleMemoryBanks({}, session, DEPS);
  assert.equal(result.isError, false);
  const parsed = JSON.parse(result.content[0]!.text);
  assert.deepEqual(parsed.banks, [
    { id: 0x00, name: "default" },
    { id: 0x0c, name: "RAM" },
  ]);
  assert.equal(parsed.count, 2);
  assert.ok("runState" in parsed);
});

test("handleMemoryBanks: an unexpected argument refuses, naming it", async () => {
  const { session } = makeSession(() => twoBankReply());
  const result = await handleMemoryBanks({ bogus: 1 }, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /bogus/);
});

// ---------------------------------------------------------------------------
// Bank resolution wired into handleMemoryRead (Task 2)
// ---------------------------------------------------------------------------

test('handleMemoryRead: bank: "ram" resolves case-insensitively to the catalog\'s id at MEM_GET body offset 6', async () => {
  const { session, calls } = makeSession((commandType) => (commandType === CommandType.BanksAvailable ? twoBankReply() : memoryGetReply([0x00])));
  const result = await handleMemoryRead({ address: "$1000", size: 1, bank: "ram" }, session, DEPS);
  assert.equal(result.isError, false);
  const memGetCall = calls.find(([commandType]) => commandType === CommandType.MemoryGet)!;
  assert.equal(memGetCall[1].readUInt16LE(6), 0x0c);
});

test("handleMemoryRead: an unknown bank name refuses listing available names and records no MemoryGet send", async () => {
  const { session, calls } = makeSession((commandType) => (commandType === CommandType.BanksAvailable ? twoBankReply() : memoryGetReply([0x00])));
  const result = await handleMemoryRead({ address: "$1000", size: 1, bank: "nope" }, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /default/);
  assert.match(result.content[0]!.text, /RAM/);
  assert.ok(!calls.some(([commandType]) => commandType === CommandType.MemoryGet));
});

// ---------------------------------------------------------------------------
// resolveRequiredBank() (05-09 Task 1, CR-01) -- the mandatory-name seam
// chip-state handlers use instead of resolveBank()'s "omitted means 0x0000"
// default.
// ---------------------------------------------------------------------------

/** The real bank catalog observed live on VICE 3.9 (05-REVIEW.md), used as
 * the stub reply for every resolveRequiredBank() case below -- `io` is
 * deliberately a non-zero id (3) so a regression back to a hardcoded 0x0000
 * cannot pass. */
function realCatalogReply(requestId = 2) {
  return banksAvailableReply(
    [
      { id: 0, name: "default" },
      { id: 0, name: "cpu" },
      { id: 1, name: "ram" },
      { id: 2, name: "rom" },
      { id: 3, name: "io" },
      { id: 4, name: "cart" },
    ],
    requestId,
  );
}

test('resolveRequiredBank: "io" against the real VICE 3.9 catalog resolves to { ok: true, id: 3, name: "io" }', async () => {
  const { session } = makeSession(() => realCatalogReply());
  const result = await resolveRequiredBank("t", "io", session);
  assert.deepEqual(result, { ok: true, id: 3, name: "io" });
});

test('resolveRequiredBank: "IO" (uppercase) resolves identically -- case-insensitive lookup', async () => {
  const { session } = makeSession(() => realCatalogReply());
  const result = await resolveRequiredBank("t", "IO", session);
  assert.deepEqual(result, { ok: true, id: 3, name: "io" });
});

test('resolveRequiredBank: a catalog with no "io" bank refuses, naming the reported banks and the refusal phrase', async () => {
  const { session, calls } = makeSession(() => banksAvailableReply([{ id: 0, name: "default" }, { id: 1, name: "ram" }]));
  const result = await resolveRequiredBank("t", "io", session);
  assert.equal(result.ok, false);
  const failure = result as { ok: false; result: { isError: boolean; content: { text: string }[] } };
  assert.equal(failure.result.isError, true);
  const text = failure.result.content[0]!.text;
  assert.match(text, /default/);
  assert.match(text, /ram/);
  assert.match(text, /refusing rather than reading the banking-dependent CPU view/);
  assert.ok(!calls.some(([commandType]) => commandType === CommandType.MemoryGet));
});

test("resolveRequiredBank: two calls on the SAME session record exactly one BanksAvailable send", async () => {
  const { session, calls } = makeSession(() => realCatalogReply());
  await resolveRequiredBank("t", "io", session);
  await resolveRequiredBank("t", "ram", session);
  assert.equal(calls.filter(([commandType]) => commandType === CommandType.BanksAvailable).length, 1);
});

// ---------------------------------------------------------------------------
// WR-01 (2026-08-17 re-review) -- stock VICE 3.9 reports TWO names for wire
// id 0 (`default` and `cpu`), so anything that reports banks out of an
// id-keyed map loses one. These cases all drive realCatalogReply(), the
// verbatim live enumeration, rather than the distinct-id twoBankReply().
// ---------------------------------------------------------------------------

test("WR-01 non-vacuity: realCatalogReply() genuinely carries an aliased id -- 6 pairs over 5 distinct ids", () => {
  const banks = realCatalogReply().banks;
  assert.equal(banks.length, 6);
  assert.equal(new Set(banks.map((b) => b.id)).size, 5, "the fixture must contain a duplicate wire id or these tests prove nothing");
});

test("WR-01 bankCatalogFor: entries keeps all six wire pairs while byId keeps one name per id", async () => {
  const { session } = makeSession(() => realCatalogReply());
  const catalog = await bankCatalogFor(session);
  assert.equal(catalog.entries.length, 6);
  assert.equal(catalog.byId.size, 5);
  // Both aliases resolve, and both survive in entries.
  assert.equal(catalog.byName.get("default"), 0);
  assert.equal(catalog.byName.get("cpu"), 0);
  assert.deepEqual(
    catalog.entries.filter((b) => b.id === 0).map((b) => b.name),
    ["default", "cpu"],
  );
});

test("WR-01 handleMemoryBanks: the real VICE 3.9 catalog answers all 6 banks in wire order, count 6", async () => {
  const { session } = makeSession(() => realCatalogReply());
  const result = await handleMemoryBanks({}, session, DEPS);
  assert.equal(result.isError, false);
  const parsed = JSON.parse(result.content[0]!.text);
  assert.deepEqual(parsed.banks, [
    { id: 0, name: "default" },
    { id: 0, name: "cpu" },
    { id: 1, name: "ram" },
    { id: 2, name: "rom" },
    { id: 3, name: "io" },
    { id: 4, name: "cart" },
  ]);
  assert.equal(parsed.count, 6);
  assert.equal(parsed.count, parsed.banks.length, "count must be the length of the reported list, never a distinct-id count");
});

test('WR-01 resolveRequiredBank: an aliased name echoes the name that was ASKED for, never the other alias', async () => {
  const { session: sessionA } = makeSession(() => realCatalogReply());
  assert.deepEqual(await resolveRequiredBank("t", "default", sessionA), { ok: true, id: 0, name: "default" });
  const { session: sessionB } = makeSession(() => realCatalogReply());
  assert.deepEqual(await resolveRequiredBank("t", "cpu", sessionB), { ok: true, id: 0, name: "cpu" });
  // Case-insensitive lookup still reports the wire's own spelling, not the
  // caller's casing.
  const { session: sessionC } = makeSession(() => realCatalogReply());
  assert.deepEqual(await resolveRequiredBank("t", "DeFaUlT", sessionC), { ok: true, id: 0, name: "default" });
});

test("WR-01 resolveRequiredBank: the refusal's available-banks list names every alias, including one sharing an id", async () => {
  const { session } = makeSession(() =>
    banksAvailableReply([
      { id: 0, name: "default" },
      { id: 0, name: "cpu" },
      { id: 1, name: "ram" },
    ]),
  );
  const result = await resolveRequiredBank("t", "io", session);
  assert.equal(result.ok, false);
  const text = (result as { ok: false; result: { content: { text: string }[] } }).result.content[0]!.text;
  assert.match(text, /default/);
  assert.match(text, /cpu/, "the refusal must not omit an alias -- it would deny a name that resolves");
  assert.match(text, /ram/);
});
