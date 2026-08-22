// node:test coverage of stock-disassemble.ts -- handleDisassemble. Every
// "session" below is built by makeSession(), whose `client` is a real
// EventEmitter (never a real socket) with a `send` spy recording every call
// as [commandType, body] -- matching stock-memory.test.ts's own DI-stub
// convention: these tests assert WIRING (call order, call count, byte-level
// body contents, answer shape), never a real protocol round trip.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { handleDisassemble } from "./stock-disassemble.ts";
import { CommandType, ErrorCode } from "./stock-protocol.ts";
import { setSymbolResolver } from "./stock-address.ts";
import { resetRunStateTrackersForTest } from "./stock-runstate.ts";
import type { StockConnectSession } from "./stock-connect.ts";
import type { StockDispatchDeps } from "./stock-dispatch.ts";

beforeEach(() => {
  resetRunStateTrackersForTest();
});

afterEach(() => {
  setSymbolResolver(null);
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

function nops(count: number): number[] {
  return new Array(count).fill(0xea);
}

function parseAnswer(result: { content: { text: string }[] }): Record<string, unknown> {
  return JSON.parse(result.content[0]!.text);
}

// ---------------------------------------------------------------------------
// D-12: mutual exclusion and argument refusals -- zero sends for every case.
// ---------------------------------------------------------------------------

test("handleDisassemble: count and end together refuses, naming both and 'mutually exclusive'", async () => {
  const { session, calls } = makeSession(() => memoryGetReply(nops(30)));
  const result = await handleDisassemble({ address: "$1000", count: 5, end: "$1010" }, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /count/);
  assert.match(result.content[0]!.text, /end/);
  assert.match(result.content[0]!.text, /mutually exclusive/);
  assert.equal(calls.length, 0);
});

test("handleDisassemble: end < address refuses, naming both", async () => {
  const { session, calls } = makeSession(() => memoryGetReply(nops(30)));
  const result = await handleDisassemble({ address: "$1010", end: "$1000" }, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /end/);
  assert.match(result.content[0]!.text, /address/);
  assert.equal(calls.length, 0);
});

test("handleDisassemble: a non-boolean show_symbols refuses naming the argument", async () => {
  const { session, calls } = makeSession(() => memoryGetReply(nops(30)));
  const result = await handleDisassemble({ address: "$1000", show_symbols: "yes" }, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /show_symbols/);
  assert.equal(calls.length, 0);
});

for (const badCount of [0, 101, "abc"]) {
  test(`handleDisassemble: count ${JSON.stringify(badCount)} refuses, never sending`, async () => {
    const { session, calls } = makeSession(() => memoryGetReply(nops(30)));
    const result = await handleDisassemble({ address: "$1000", count: badCount as unknown }, session, DEPS);
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /count/);
    assert.equal(calls.length, 0);
  });
}

test("handleDisassemble: a malformed address refuses, naming vice_disassemble and address, never sending", async () => {
  const { session, calls } = makeSession(() => memoryGetReply(nops(30)));
  const result = await handleDisassemble({ address: "0xzz" }, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /vice_disassemble/);
  assert.match(result.content[0]!.text, /address/);
  assert.equal(calls.length, 0);
});

test("handleDisassemble: end supplied alone (default count) does NOT trigger the mutual-exclusion refusal", async () => {
  // address=$1000, end=$1010: readEnd = min($1010+2, $ffff) = $1012;
  // expected byte length = $1012-$1000+1 = 19.
  const { session, calls } = makeSession(() => memoryGetReply(nops(19)));
  const result = await handleDisassemble({ address: "$1000", end: "$1010" }, session, DEPS);
  assert.equal(result.isError, false);
  assert.equal(calls.length, 1);
});

// ---------------------------------------------------------------------------
// The over-read rules (Phase 3 D-05 halts the machine; never resumes).
// ---------------------------------------------------------------------------

test("handleDisassemble: the end form requests end+2 (over-read-by-two), clamped at $ffff", async () => {
  const { session, calls } = makeSession(() => memoryGetReply(nops(19)));
  await handleDisassemble({ address: "$1000", end: "$1010" }, session, DEPS);
  assert.equal(calls.length, 1);
  const [commandType, body] = calls[0]!;
  assert.equal(commandType, CommandType.MemoryGet);
  assert.equal(body.length, 8);
  assert.equal(body[0], 0x00, "sidefx must always be 0x00 -- never side-effecting");
  assert.equal(body.readUInt16LE(1), 0x1000);
  assert.equal(body.readUInt16LE(3), 0x1012);
});

test("handleDisassemble: the count form requests address + count*3 - 1 (three is the max instruction length)", async () => {
  // address=$1000, count=5: readEnd = $1000 + 5*3 - 1 = $100e; length = 15.
  const { session, calls } = makeSession(() => memoryGetReply(nops(15)));
  await handleDisassemble({ address: "$1000", count: 5 }, session, DEPS);
  assert.equal(calls.length, 1);
  const body = calls[0]![1];
  assert.equal(body.readUInt16LE(1), 0x1000);
  assert.equal(body.readUInt16LE(3), 0x100e);
});

test("handleDisassemble: the default count (10) requests address + 29 when count/end are both omitted", async () => {
  const { session, calls } = makeSession(() => memoryGetReply(nops(30)));
  await handleDisassemble({ address: "$1000" }, session, DEPS);
  const body = calls[0]![1];
  assert.equal(body.readUInt16LE(3), 0x101d);
});

test("handleDisassemble: end=$fffe does not request past $ffff, and an instruction running off the top is reported truncated", async () => {
  // address=$fff0, end=$fffe: readEnd = min($fffe+2, $ffff) = $ffff;
  // length = $ffff-$fff0+1 = 16. Bytes 0..13 are 14 NOPs (addresses
  // $fff0..$fffd); byte 14 ($fffe) starts a 3-byte "lda absolute" ($ad) with
  // only 2 bytes available in the buffer -- truncated, never fabricated.
  const bytes = [...nops(14), 0xad, 0x34];
  const { session, calls } = makeSession(() => memoryGetReply(bytes));
  const result = await handleDisassemble({ address: "$fff0", end: "$fffe" }, session, DEPS);
  assert.equal(result.isError, false);
  const body = calls[0]![1];
  assert.equal(body.readUInt16LE(3), 0xffff, "must never request past $ffff");
  const parsed = parseAnswer(result);
  const instructions = parsed.instructions as Array<{ address: number; notes: string[] }>;
  const last = instructions[instructions.length - 1]!;
  assert.equal(last.address, 0xfffe);
  assert.ok(last.notes.includes("truncated"), "the instruction running off the top of memory must be reported truncated");
});

// ---------------------------------------------------------------------------
// D-14: show_symbols with no store installed is a successful no-op that
// SAYS SO; with a store installed, the listing substitutes the real name.
// ---------------------------------------------------------------------------

test("handleDisassemble: show_symbols true with no store installed is a successful no-op with an explanatory symbolNote", async () => {
  const { session } = makeSession(() => memoryGetReply(nops(30)));
  const result = await handleDisassemble({ address: "$1000" }, session, DEPS);
  assert.equal(result.isError, false);
  const parsed = parseAnswer(result);
  assert.equal(parsed.symbolsApplied, false);
  assert.match(parsed.symbolNote as string, /no symbol table is loaded/);
});

test("handleDisassemble: show_symbols false never sets symbolNote, even with no store installed", async () => {
  const { session } = makeSession(() => memoryGetReply(nops(30)));
  const result = await handleDisassemble({ address: "$1000", show_symbols: false }, session, DEPS);
  assert.equal(result.isError, false);
  const parsed = parseAnswer(result);
  assert.equal(parsed.symbolsApplied, false);
  assert.equal("symbolNote" in parsed, false);
});

test("handleDisassemble: with an injected resolver, symbolsApplied is true and the listing substitutes the name plus its own definition line", async () => {
  setSymbolResolver({ resolve: () => undefined, nameFor: (a) => (a === 0x1000 ? "start" : undefined) });
  // jmp $1000 (3 bytes: $4c $00 $10) at address $2000, followed by 27 NOPs so
  // decode()'s default count (10) has enough bytes for 9 more instructions.
  const bytes = [0x4c, 0x00, 0x10, ...nops(27)];
  const { session } = makeSession(() => memoryGetReply(bytes));
  const result = await handleDisassemble({ address: "$2000" }, session, DEPS);
  assert.equal(result.isError, false);
  const parsed = parseAnswer(result);
  assert.equal(parsed.symbolsApplied, true);
  assert.equal("symbolNote" in parsed, false);
  assert.match(parsed.listing as string, /start = \$1000/);
  assert.match(parsed.listing as string, /jmp start/);
});

// ---------------------------------------------------------------------------
// D-13: the answer bound -- at most 100 instructions, with limitReached and
// nextAddress when the range holds more. The `end` form has no natural cap
// of its own (count is already capped at 100 by parseByteCount).
// ---------------------------------------------------------------------------

test("handleDisassemble: an end-form range decoding to more than 100 instructions returns exactly 100 with limitReached and the 101st's address", async () => {
  const address = 0x1000;
  const end = 0x10c7; // 200 one-byte NOP addresses: $1000..$10c7
  const readEnd = Math.min(end + 2, 0xffff); // $10c9
  const length = readEnd - address + 1; // 202
  const { session } = makeSession(() => memoryGetReply(nops(length)));
  const result = await handleDisassemble({ address: "$1000", end: "$10c7" }, session, DEPS);
  assert.equal(result.isError, false);
  const parsed = parseAnswer(result);
  const instructions = parsed.instructions as unknown[];
  assert.equal(instructions.length, 100);
  assert.equal(parsed.count, 100);
  assert.equal(parsed.limitReached, true);
  assert.equal(parsed.nextAddress, address + 100);
});

test("handleDisassemble: limitReached is false and nextAddress is absent when the range holds 100 or fewer instructions", async () => {
  const { session } = makeSession(() => memoryGetReply(nops(30)));
  const result = await handleDisassemble({ address: "$1000" }, session, DEPS);
  const parsed = parseAnswer(result);
  assert.equal(parsed.limitReached, false);
  assert.equal("nextAddress" in parsed, false);
});

// ---------------------------------------------------------------------------
// Short-read and wrong-response-type guards -- each a refusal, never a crash.
// ---------------------------------------------------------------------------

test("handleDisassemble: a short MEM_GET reply refuses, naming a short read, rather than crashing", async () => {
  const { session } = makeSession(() => memoryGetReply([0xea])); // far short of the expected 30 bytes
  const result = await handleDisassemble({ address: "$1000" }, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /short read/);
});

test("handleDisassemble: an unexpected response type refuses rather than crashing", async () => {
  const { session } = makeSession(() => ({ type: "unknown" as const, requestId: 1, errorCode: ErrorCode.Ok, responseType: 99, related: [] }));
  const result = await handleDisassemble({ address: "$1000" }, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /unexpected response type/);
});

// ---------------------------------------------------------------------------
// Never issues an unrequested resume; never mutates emulator state as a
// side effect of reading it.
// ---------------------------------------------------------------------------

test("handleDisassemble: sends exactly one MEM_GET and nothing else", async () => {
  const { session, calls } = makeSession(() => memoryGetReply(nops(30)));
  await handleDisassemble({ address: "$1000" }, session, DEPS);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]![0], CommandType.MemoryGet);
});
