// node:test coverage of stock-memory-search.ts -- handleMemorySearch and
// handleMemoryCompare. Every "session" below is built by makeSession(),
// whose `client` is a real EventEmitter (never a real socket) with a `send`
// spy recording every call as [commandType, body] -- matching
// stock-disassemble.test.ts's own DI-stub convention: these tests assert
// WIRING (call order, call count, byte-level body contents, answer shape),
// never a real protocol round trip.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { handleMemorySearch, handleMemoryCompare } from "./stock-memory-search.ts";
import { CommandType, ErrorCode } from "./stock-protocol.ts";
import { resetRunStateTrackersForTest } from "./stock-runstate.ts";
import type { StockConnectSession } from "./stock-connect.ts";
import type { StockDispatchDeps } from "./stock-dispatch.ts";

beforeEach(() => {
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

function parseAnswer(result: { content: { text: string }[] }): Record<string, unknown> {
  return JSON.parse(result.content[0]!.text);
}

// ---------------------------------------------------------------------------
// vice_memory_search -- happy paths
// ---------------------------------------------------------------------------

test("handleMemorySearch: exact single match", async () => {
  const corpus = [0xea, 0xea, 0xea, 0x4c, 0x00, 0xa0, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea];
  const { session } = makeSession(() => memoryGetReply(corpus));
  const result = await handleMemorySearch({ start: "$1000", end: "$100f", pattern: [0x4c, 0x00, 0xa0] }, session, DEPS);
  assert.equal(result.isError, false);
  const parsed = parseAnswer(result);
  assert.deepEqual(parsed.matches, [0x1003]);
  assert.equal(parsed.count, 1);
  assert.equal(parsed.truncated, false);
});

test("handleMemorySearch: multiple overlapping matches advance by 1, not by pattern.length", async () => {
  const corpus = [0xaa, 0xaa, 0xaa, 0xaa];
  const { session } = makeSession(() => memoryGetReply(corpus));
  const result = await handleMemorySearch({ start: "$1000", end: "$1003", pattern: [0xaa, 0xaa] }, session, DEPS);
  assert.equal(result.isError, false);
  const parsed = parseAnswer(result);
  assert.deepEqual(parsed.matches, [0x1000, 0x1001, 0x1002]);
  assert.equal(parsed.count, 3);
});

test("handleMemorySearch: masked match wildcards trailing bytes genuinely, matching sites whose trailing bytes differ", async () => {
  const corpus = [0x4c, 0x11, 0x22, 0xea, 0x4c, 0x33, 0x44, 0xea];
  const { session } = makeSession(() => memoryGetReply(corpus));
  const result = await handleMemorySearch(
    { start: "$1000", end: "$1007", pattern: [0x4c, 0x00, 0x00], mask: [0xff, 0x00, 0x00] },
    session,
    DEPS,
  );
  assert.equal(result.isError, false);
  const parsed = parseAnswer(result);
  assert.deepEqual(parsed.matches, [0x1000, 0x1004]);
  assert.equal(parsed.count, 2);
});

test("handleMemorySearch: max_results truncation stops the scan and flags truncated", async () => {
  const corpus = [0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa];
  const { session } = makeSession(() => memoryGetReply(corpus));
  const result = await handleMemorySearch({ start: "$1000", end: "$1005", pattern: [0xaa], max_results: 2 }, session, DEPS);
  assert.equal(result.isError, false);
  const parsed = parseAnswer(result);
  assert.equal((parsed.matches as number[]).length, 2);
  assert.equal(parsed.truncated, true);
});

test("handleMemorySearch: the answer carries runState and searched equals the range length", async () => {
  const { session } = makeSession(() => memoryGetReply(new Array(16).fill(0xea)));
  const result = await handleMemorySearch({ start: "$1000", end: "$100f", pattern: [0xea] }, session, DEPS);
  assert.equal(result.isError, false);
  const parsed = parseAnswer(result);
  assert.ok("runState" in parsed);
  assert.equal(parsed.searched, 16);
});

// ---------------------------------------------------------------------------
// vice_memory_search -- refusals, each asserting calls.length === 0
// ---------------------------------------------------------------------------

test("handleMemorySearch: non-object args refuses with zero sends", async () => {
  const { session, calls } = makeSession(() => memoryGetReply([0xea]));
  const result = await handleMemorySearch(null as unknown as Record<string, unknown>, session, DEPS);
  assert.equal(result.isError, true);
  assert.equal(calls.length, 0);
});

test("handleMemorySearch: missing start refuses with zero sends", async () => {
  const { session, calls } = makeSession(() => memoryGetReply([0xea]));
  const result = await handleMemorySearch({ end: "$1000", pattern: [0xea] }, session, DEPS);
  assert.equal(result.isError, true);
  assert.equal(calls.length, 0);
});

test("handleMemorySearch: missing end refuses with zero sends", async () => {
  const { session, calls } = makeSession(() => memoryGetReply([0xea]));
  const result = await handleMemorySearch({ start: "$1000", pattern: [0xea] }, session, DEPS);
  assert.equal(result.isError, true);
  assert.equal(calls.length, 0);
});

test("handleMemorySearch: missing pattern refuses with zero sends", async () => {
  const { session, calls } = makeSession(() => memoryGetReply([0xea]));
  const result = await handleMemorySearch({ start: "$1000", end: "$1010" }, session, DEPS);
  assert.equal(result.isError, true);
  assert.equal(calls.length, 0);
});

test("handleMemorySearch: end < start refuses with zero sends", async () => {
  const { session, calls } = makeSession(() => memoryGetReply([0xea]));
  const result = await handleMemorySearch({ start: "$1010", end: "$1000", pattern: [0xea] }, session, DEPS);
  assert.equal(result.isError, true);
  assert.equal(calls.length, 0);
});

test("handleMemorySearch: pattern not an array refuses with zero sends", async () => {
  const { session, calls } = makeSession(() => memoryGetReply([0xea]));
  const result = await handleMemorySearch({ start: "$1000", end: "$1010", pattern: "not-an-array" }, session, DEPS);
  assert.equal(result.isError, true);
  assert.equal(calls.length, 0);
});

test("handleMemorySearch: empty pattern refuses with zero sends", async () => {
  const { session, calls } = makeSession(() => memoryGetReply([0xea]));
  const result = await handleMemorySearch({ start: "$1000", end: "$1010", pattern: [] }, session, DEPS);
  assert.equal(result.isError, true);
  assert.equal(calls.length, 0);
});

test("handleMemorySearch: pattern containing 256 refuses naming the index, zero sends", async () => {
  const { session, calls } = makeSession(() => memoryGetReply([0xea]));
  const result = await handleMemorySearch({ start: "$1000", end: "$1010", pattern: [0x00, 256] }, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /pattern\[1\]/);
  assert.equal(calls.length, 0);
});

test("handleMemorySearch: pattern containing -1 refuses naming the index, zero sends", async () => {
  const { session, calls } = makeSession(() => memoryGetReply([0xea]));
  const result = await handleMemorySearch({ start: "$1000", end: "$1010", pattern: [-1] }, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /pattern\[0\]/);
  assert.equal(calls.length, 0);
});

test('handleMemorySearch: pattern containing "aa" (a string) refuses naming the index, zero sends', async () => {
  const { session, calls } = makeSession(() => memoryGetReply([0xea]));
  const result = await handleMemorySearch({ start: "$1000", end: "$1010", pattern: ["aa"] }, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /pattern\[0\]/);
  assert.equal(calls.length, 0);
});

test("handleMemorySearch: pattern longer than the range searched refuses, zero sends", async () => {
  const { session, calls } = makeSession(() => memoryGetReply([0xea]));
  const result = await handleMemorySearch({ start: "$1000", end: "$1001", pattern: [1, 2, 3] }, session, DEPS);
  assert.equal(result.isError, true);
  assert.equal(calls.length, 0);
});

test("handleMemorySearch: mask length differing from pattern length refuses, zero sends", async () => {
  const { session, calls } = makeSession(() => memoryGetReply([0xea]));
  const result = await handleMemorySearch({ start: "$1000", end: "$1010", pattern: [1, 2], mask: [0xff] }, session, DEPS);
  assert.equal(result.isError, true);
  assert.equal(calls.length, 0);
});

test("handleMemorySearch: max_results of 0 refuses, zero sends", async () => {
  const { session, calls } = makeSession(() => memoryGetReply([0xea]));
  const result = await handleMemorySearch({ start: "$1000", end: "$1010", pattern: [0xea], max_results: 0 }, session, DEPS);
  assert.equal(result.isError, true);
  assert.equal(calls.length, 0);
});

test("handleMemorySearch: max_results of 10001 refuses, zero sends", async () => {
  const { session, calls } = makeSession(() => memoryGetReply([0xea]));
  const result = await handleMemorySearch({ start: "$1000", end: "$1010", pattern: [0xea], max_results: 10001 }, session, DEPS);
  assert.equal(result.isError, true);
  assert.equal(calls.length, 0);
});

test('handleMemorySearch: max_results of "abc" refuses, zero sends', async () => {
  const { session, calls } = makeSession(() => memoryGetReply([0xea]));
  const result = await handleMemorySearch({ start: "$1000", end: "$1010", pattern: [0xea], max_results: "abc" }, session, DEPS);
  assert.equal(result.isError, true);
  assert.equal(calls.length, 0);
});

// ---------------------------------------------------------------------------
// vice_memory_search -- wire-body and failure guards
// ---------------------------------------------------------------------------

test("handleMemorySearch: sidefx regression guard -- one MEM_GET, sidefx byte 0x00, correct start/end", async () => {
  const { session, calls } = makeSession(() => memoryGetReply(new Array(16).fill(0xea)));
  const result = await handleMemorySearch({ start: "$1000", end: "$100f", pattern: [0xea] }, session, DEPS);
  assert.equal(result.isError, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]![0], CommandType.MemoryGet);
  assert.equal(calls[0]![1][0], 0x00);
  assert.equal(calls[0]![1]!.readUInt16LE(1), 0x1000);
  assert.equal(calls[0]![1]!.readUInt16LE(3), 0x100f);
});

test("handleMemorySearch: an unexpected response type refuses naming memory_get", async () => {
  const { session } = makeSession(() => ({ type: "unknown" as const, requestId: 1, errorCode: ErrorCode.Ok, responseType: 99, related: [] }));
  const result = await handleMemorySearch({ start: "$1000", end: "$100f", pattern: [0xea] }, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /memory_get/);
});

test("handleMemorySearch: a short reply refuses naming a short read", async () => {
  const { session } = makeSession(() => memoryGetReply([0xea])); // far short of the 16-byte range
  const result = await handleMemorySearch({ start: "$1000", end: "$100f", pattern: [0xea] }, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /a short read is a wrong answer/);
});

test("handleMemorySearch: a send() rejection is converted, not thrown", async () => {
  const { session } = makeSession(() => {
    throw new Error("boom");
  });
  const result = await handleMemorySearch({ start: "$1000", end: "$100f", pattern: [0xea] }, session, DEPS);
  assert.equal(result.isError, true);
});

// ---------------------------------------------------------------------------
// vice_memory_compare
// ---------------------------------------------------------------------------

test("handleMemoryCompare: mode:'ranges' over two 8-byte ranges differing at two offsets", async () => {
  const range1 = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07];
  const range2 = [0x00, 0x01, 0xff, 0x03, 0x04, 0x05, 0xee, 0x07];
  let call = 0;
  const { session } = makeSession(() => {
    call += 1;
    return memoryGetReply(call === 1 ? range1 : range2);
  });
  const result = await handleMemoryCompare({ mode: "ranges", range1_start: "$2000", range1_end: "$2007", range2_start: "$3000" }, session, DEPS);
  assert.equal(result.isError, false);
  const parsed = parseAnswer(result);
  const differences = parsed.differences as Array<{ offset: number; address1: number; address2: number; value1: number; value2: number }>;
  assert.equal(differences.length, 2);
  assert.equal(differences[0]!.offset, 2);
  assert.equal(differences[0]!.address1, 0x2002);
  assert.equal(differences[0]!.address2, 0x3002);
  assert.equal(differences[0]!.value1, 0x02);
  assert.equal(differences[0]!.value2, 0xff);
  assert.equal(differences[1]!.offset, 6);
  assert.equal(parsed.count, 2);
  assert.equal(parsed.identical, false);
  assert.equal(parsed.range2End, (parsed.range2Start as number) + (parsed.length as number) - 1);
});

test("handleMemoryCompare: identical ranges return count 0, identical true, empty differences", async () => {
  const range = [0x11, 0x22, 0x33, 0x44];
  const { session } = makeSession(() => memoryGetReply(range));
  const result = await handleMemoryCompare({ mode: "ranges", range1_start: "$2000", range1_end: "$2003", range2_start: "$3000" }, session, DEPS);
  assert.equal(result.isError, false);
  const parsed = parseAnswer(result);
  assert.equal(parsed.count, 0);
  assert.equal(parsed.identical, true);
  assert.deepEqual(parsed.differences, []);
});

test("handleMemoryCompare: max_differences truncates and identical is false", async () => {
  const range1 = [0x00, 0x00, 0x00];
  const range2 = [0x01, 0x01, 0x01];
  let call = 0;
  const { session } = makeSession(() => {
    call += 1;
    return memoryGetReply(call === 1 ? range1 : range2);
  });
  const result = await handleMemoryCompare(
    { mode: "ranges", range1_start: "$2000", range1_end: "$2002", range2_start: "$3000", max_differences: 1 },
    session,
    DEPS,
  );
  assert.equal(result.isError, false);
  const parsed = parseAnswer(result);
  assert.equal((parsed.differences as unknown[]).length, 1);
  assert.equal(parsed.truncated, true);
  assert.equal(parsed.identical, false);
});

test("handleMemoryCompare: range2_start so high that range2_end would exceed $ffff refuses with zero sends", async () => {
  const { session, calls } = makeSession(() => memoryGetReply([0x00]));
  const result = await handleMemoryCompare({ mode: "ranges", range1_start: "$0000", range1_end: "$1000", range2_start: "$ff00" }, session, DEPS);
  assert.equal(result.isError, true);
  assert.equal(calls.length, 0);
});

test("handleMemoryCompare: mode:'snapshot' is refused with zero sends and names the alternatives", async () => {
  const { session, calls } = makeSession(() => memoryGetReply([0x00]));
  const result = await handleMemoryCompare({ mode: "snapshot", snapshot_name: "x" }, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /mode:'snapshot' is not implemented/);
  assert.match(result.content[0]!.text, /c64-ram-capture/);
  assert.match(result.content[0]!.text, /mode:'ranges'/);
  assert.equal(calls.length, 0);
});

test("handleMemoryCompare: an unrecognised mode refuses naming both accepted values, zero sends", async () => {
  const { session, calls } = makeSession(() => memoryGetReply([0x00]));
  const result = await handleMemoryCompare({ mode: "sideways" }, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /ranges/);
  assert.match(result.content[0]!.text, /snapshot/);
  assert.equal(calls.length, 0);
});

test("handleMemoryCompare: both reads are sidefx:false", async () => {
  const range = [0x11, 0x22];
  const { session, calls } = makeSession(() => memoryGetReply(range));
  const result = await handleMemoryCompare({ mode: "ranges", range1_start: "$2000", range1_end: "$2001", range2_start: "$3000" }, session, DEPS);
  assert.equal(result.isError, false);
  assert.equal(calls.length, 2);
  assert.equal(calls[0]![1][0], 0x00);
  assert.equal(calls[1]![1][0], 0x00);
});

test("handleMemoryCompare: snapshot_name, start and end passed alongside mode:'ranges' are ignored", async () => {
  const range = [0x11, 0x22];
  const { session } = makeSession(() => memoryGetReply(range));
  const withExtras = await handleMemoryCompare(
    { mode: "ranges", range1_start: "$2000", range1_end: "$2001", range2_start: "$3000", snapshot_name: "ignored", start: "$0000", end: "$ffff" },
    session,
    DEPS,
  );
  const { session: session2 } = makeSession(() => memoryGetReply(range));
  const withoutExtras = await handleMemoryCompare(
    { mode: "ranges", range1_start: "$2000", range1_end: "$2001", range2_start: "$3000" },
    session2,
    DEPS,
  );
  assert.equal(withExtras.isError, false);
  assert.equal(withoutExtras.isError, false);
  assert.deepEqual(parseAnswer(withExtras), parseAnswer(withoutExtras));
});
