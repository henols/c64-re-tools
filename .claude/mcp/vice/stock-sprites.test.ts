// node:test coverage of stock-sprites.ts -- handleSpriteGet and
// handleSpriteInspect. Every "session" below is built by
// makeSpriteSession(), whose `client` is a real EventEmitter (never a real
// socket) with a `send` spy recording every call as [commandType, body] and
// a sendImpl that DISPATCHES ON THE REQUEST BODY'S `start` FIELD
// (body.readUInt16LE(1)) -- a single shared reply would let a read-order or
// address-computation bug pass, matching stock-disassemble.test.ts's own
// DI-stub convention (assert WIRING, never a real protocol round trip).
//
// The primary fixture reproduces dump-artifacts.mjs's own committed
// docstring exactly: dd00_raw=193 (0xC1), d018_raw=49 (0x31) ->
// screen_base=35840 (vicBank=2, vicBankBase=32768, pointerTableAddress=36856).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import {
  handleSpriteGet,
  handleSpriteInspect,
  vicBank,
  vicBankBase,
  screenBase,
  spriteDataAddress,
  renderSpriteAscii,
  renderSpriteBinary,
  SPRITE_ASCII_LEGEND_HIRES,
  SPRITE_ASCII_LEGEND_MULTICOLOUR,
} from "./stock-sprites.ts";
import { CommandType, ErrorCode } from "./stock-protocol.ts";
import { resetRunStateTrackersForTest } from "./stock-runstate.ts";
import { resetBankCatalogsForTest } from "./stock-memory.ts";
import type { StockConnectSession } from "./stock-connect.ts";
import type { StockDispatchDeps } from "./stock-dispatch.ts";

beforeEach(() => {
  resetRunStateTrackersForTest();
  resetBankCatalogsForTest();
});

type SendCall = [number, Buffer];

const DEPS = {} as unknown as StockDispatchDeps;

function memoryGetReply(bytes: number[], requestId = 1) {
  return { type: "memory_get" as const, requestId, errorCode: ErrorCode.Ok, bytes: Buffer.from(bytes), related: [] };
}

/** The catalog observed live on VICE 3.9 (05-REVIEW.md), with `io` and `ram`
 * deliberately NON-ZERO/non-default ids so a regression back to a
 * hardcoded bank 0x0000 cannot pass. Matches stock-vicii.test.ts's/
 * stock-cia.test.ts's own banksAvailableReply() convention. */
function banksAvailableReply(requestId = 2) {
  return {
    type: "banks_available" as const,
    requestId,
    errorCode: ErrorCode.Ok,
    banks: [
      { id: 0, name: "default" },
      { id: 0, name: "cpu" },
      { id: 1, name: "ram" },
      { id: 2, name: "rom" },
      { id: 3, name: "io" },
      { id: 4, name: "cart" },
    ],
    related: [],
  };
}

/** Catalog with no `ram` entry at all -- for the refusal case (the `io`
 * resolution happens first, so this exercises the SECOND resolveRequiredBank
 * call's refusal path). */
function noRamBanksAvailableReply(requestId = 2) {
  return {
    type: "banks_available" as const,
    requestId,
    errorCode: ErrorCode.Ok,
    banks: [
      { id: 0, name: "default" },
      { id: 3, name: "io" },
    ],
    related: [],
  };
}

function parseAnswer(result: { content: { text: string }[] }): Record<string, unknown> {
  return JSON.parse(result.content[0]!.text);
}

// ---------------------------------------------------------------------------
// The committed dump-artifacts.mjs fixture: dd00_raw=193, d018_raw=49 ->
// screen_base=35840. Reproduced here exactly as the cross-check.
// ---------------------------------------------------------------------------

const DD00 = 193; // 0xC1
const D018 = 0x31; // 49
const VIC_BANK = vicBank(DD00); // 2
const VIC_BANK_BASE = vicBankBase(DD00); // 32768
const SCREEN_BASE = screenBase(D018, DD00); // 35840
const POINTER_TABLE_ADDR = SCREEN_BASE + 0x3f8; // 36856
const POINTERS = [0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87];
const SPRITE0_DATA_ADDR = spriteDataAddress(DD00, POINTERS[0]!); // 40960

/** Builds the 47-byte $D000-$D02E fixture, distinguishable field-by-field. */
function buildViciiBytes(): number[] {
  const bytes = new Array(0x2f).fill(0);
  const xValues = [0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80];
  const yValues = [0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88];
  for (let i = 0; i < 8; i += 1) {
    bytes[i * 2] = xValues[i];
    bytes[1 + i * 2] = yValues[i];
  }
  bytes[0x10] = 0b00000001; // $D010: sprite 0's X bit 8 set
  bytes[0x15] = 0b00000101; // $D015: sprites 0 and 2 enabled
  bytes[0x17] = 0b00000010; // $D017: sprite 1 Y-expand
  bytes[0x18] = D018; // $D018: memory setup register
  bytes[0x1b] = 0b00000100; // $D01B: sprite 2 priority-behind-background
  bytes[0x1c] = 0b00000010; // $D01C: sprite 1 ONLY is multicolour
  bytes[0x1d] = 0b00001000; // $D01D: sprite 3 X-expand
  bytes[0x25] = 0x0a; // $D025: multicolour 1
  bytes[0x26] = 0x0b; // $D026: multicolour 2
  for (let i = 0; i < 8; i += 1) {
    bytes[0x27 + i] = i + 1; // $D027..$D02E: sprite colours 1..8
  }
  return bytes;
}

/** 63 bytes, distinguishable per row: row r = [r, 0xff, 0x00]. */
function buildSpriteDataBytes(): number[] {
  const bytes: number[] = [];
  for (let row = 0; row < 21; row += 1) {
    bytes.push(row, 0xff, 0x00);
  }
  return bytes;
}

const DATA_FIXTURE = buildSpriteDataBytes();

/**
 * Builds a fake StockConnectSession that DISPATCHES per address rather than
 * returning one shared reply -- 0xd000 -> the VIC-II fixture, 0xdd00 -> the
 * single $DD00 byte, the pointer-table address -> pointerBytes, any
 * registered sprite-data address -> its own 63-byte block. CommandType.
 * BanksAvailable answers `banksAvailable` (defaulting to the io=3/ram=1
 * catalog) BEFORE any body.readUInt16LE(1) dispatch, since its body is
 * empty (Buffer.alloc(0)).
 */
function makeSpriteSession(
  opts: {
    dd00?: number;
    viciiBytes?: number[];
    pointerTableAddress?: number;
    pointerBytes?: number[];
    dataAddresses?: Record<number, number[]>;
    banksAvailable?: () => ReturnType<typeof banksAvailableReply>;
  } = {},
): { session: StockConnectSession; calls: SendCall[] } {
  const dd00 = opts.dd00 ?? DD00;
  const viciiBytes = opts.viciiBytes ?? buildViciiBytes();
  const pointerTableAddress = opts.pointerTableAddress ?? POINTER_TABLE_ADDR;
  const pointerBytes = opts.pointerBytes ?? POINTERS;
  const dataAddresses = opts.dataAddresses ?? { [SPRITE0_DATA_ADDR]: DATA_FIXTURE };
  const banksAvailable = opts.banksAvailable ?? banksAvailableReply;

  const calls: SendCall[] = [];
  const client = Object.assign(new EventEmitter(), {
    send: async (commandType: number, body: Buffer = Buffer.alloc(0)) => {
      calls.push([commandType, body]);
      if (commandType === CommandType.BanksAvailable) {
        return banksAvailable();
      }
      const start = body.readUInt16LE(1);
      if (start === 0xd000) {
        return memoryGetReply(viciiBytes);
      }
      if (start === 0xdd00) {
        return memoryGetReply([dd00]);
      }
      if (start === pointerTableAddress) {
        return memoryGetReply(pointerBytes);
      }
      if (dataAddresses[start] !== undefined) {
        return memoryGetReply(dataAddresses[start]!);
      }
      throw new Error(`unexpected MEM_GET start address 0x${start.toString(16)}`);
    },
  });
  const session = { client } as unknown as StockConnectSession;
  return { session, calls };
}

// ---------------------------------------------------------------------------
// vice_sprite_get
// ---------------------------------------------------------------------------

test("handleSpriteGet: reproduces the committed dump-artifacts.mjs fixture exactly", async () => {
  const { session } = makeSpriteSession();
  const result = await handleSpriteGet({}, session, DEPS);
  assert.equal(result.isError, false);
  const parsed = parseAnswer(result);
  assert.equal(parsed.vicBank, 2);
  assert.equal(parsed.vicBankBase, 32768);
  assert.equal(parsed.screenBase, 35840);
  assert.equal(parsed.pointerTableAddress, 36856);
});

test("handleSpriteGet: all eight sprites returned when sprite is omitted", async () => {
  const { session } = makeSpriteSession();
  const result = await handleSpriteGet({}, session, DEPS);
  assert.equal(result.isError, false);
  const parsed = parseAnswer(result);
  assert.equal(parsed.count, 8);
  const sprites = parsed.sprites as Array<Record<string, unknown>>;
  assert.equal(sprites.length, 8);
  assert.equal(sprites[0]!.x, 0x110);
  assert.equal(sprites[1]!.x, 0x20);
  assert.equal(sprites[0]!.enabled, true);
  assert.equal(sprites[1]!.enabled, false);
  assert.equal(sprites[2]!.enabled, true);
});

test("handleSpriteGet: multicolour is decided PER SPRITE from $D01C, not globally", async () => {
  const { session } = makeSpriteSession();
  const result = await handleSpriteGet({}, session, DEPS);
  const sprites = parseAnswer(result).sprites as Array<Record<string, unknown>>;
  assert.equal(sprites[1]!.multicolour, true);
  assert.equal(sprites[0]!.multicolour, false);
});

test("handleSpriteGet: per-sprite colour and the two shared multicolour registers", async () => {
  const { session } = makeSpriteSession();
  const result = await handleSpriteGet({}, session, DEPS);
  const parsed = parseAnswer(result);
  const sprites = parsed.sprites as Array<Record<string, unknown>>;
  for (let i = 0; i < 8; i += 1) {
    assert.equal(sprites[i]!.colour, i + 1);
  }
  assert.equal(parsed.spriteMulticolour1, 0x0a);
  assert.equal(parsed.spriteMulticolour2, 0x0b);
});

test("handleSpriteGet: pointer and dataAddress resolve for sprite 0", async () => {
  const { session } = makeSpriteSession();
  const result = await handleSpriteGet({}, session, DEPS);
  const sprites = parseAnswer(result).sprites as Array<Record<string, unknown>>;
  assert.equal(sprites[0]!.pointer, 0x80);
  assert.equal(sprites[0]!.dataAddress, 40960);
});

test("handleSpriteGet: sprite: 3 returns exactly one element", async () => {
  const { session } = makeSpriteSession();
  const result = await handleSpriteGet({ sprite: 3 }, session, DEPS);
  assert.equal(result.isError, false);
  const parsed = parseAnswer(result);
  assert.equal(parsed.count, 1);
  assert.equal(parsed.sprite, 3);
  const sprites = parsed.sprites as Array<Record<string, unknown>>;
  assert.equal(sprites.length, 1);
  assert.equal(sprites[0]!.index, 3);
});

test("handleSpriteGet: sprite: 0 is accepted -- the parseByteCount-would-refuse-zero trap", async () => {
  const { session } = makeSpriteSession();
  const result = await handleSpriteGet({ sprite: 0 }, session, DEPS);
  assert.equal(result.isError, false);
  const parsed = parseAnswer(result);
  assert.equal(parsed.sprite, 0);
  const sprites = parsed.sprites as Array<Record<string, unknown>>;
  assert.equal(sprites[0]!.index, 0);
});

for (const badIndex of [8, -1, 1.5, "x"]) {
  test(`handleSpriteGet: sprite ${JSON.stringify(badIndex)} is refused naming the value, zero sends`, async () => {
    const { session, calls } = makeSpriteSession();
    const result = await handleSpriteGet({ sprite: badIndex as unknown }, session, DEPS);
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /0\.\.7/);
    assert.equal(calls.length, 0);
  });
}

test("handleSpriteGet: an unexpected key (sprite_number, the other tool's argument) is refused, zero sends", async () => {
  const { session, calls } = makeSpriteSession();
  const result = await handleSpriteGet({ sprite_number: 1 }, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /sprite_number/);
  assert.equal(calls.length, 0);
});

test("handleSpriteGet: read order and sidefx across all three reads, with exactly one BanksAvailable send first", async () => {
  const { session, calls } = makeSpriteSession();
  await handleSpriteGet({}, session, DEPS);
  assert.equal(calls.length, 4);
  assert.equal(calls[0]![0], CommandType.BanksAvailable);
  assert.equal(calls.filter(([commandType]) => commandType === CommandType.BanksAvailable).length, 1, "exactly one BanksAvailable send even though two bank names are resolved");
  assert.equal(calls[1]![1].readUInt16LE(1), 0xd000);
  assert.equal(calls[2]![1].readUInt16LE(1), 0xdd00);
  assert.equal(calls[3]![1].readUInt16LE(1), 36856);
  for (let i = 1; i < 4; i += 1) {
    assert.equal(calls[i]![1][0], 0x00, `call ${i} must be sidefx:false`);
  }
});

test("handleSpriteGet: the VIC-II-block and $DD00 sends carry the resolved io bank (3), the pointer-table send carries the resolved ram bank (1); none carries 0", async () => {
  const { session, calls } = makeSpriteSession();
  await handleSpriteGet({}, session, DEPS);
  const memGetCalls = calls.filter(([commandType]) => commandType === CommandType.MemoryGet);
  assert.equal(memGetCalls.length, 3);
  assert.equal(memGetCalls[0]![1].readUInt16LE(6), 3, "VIC-II block must carry io (3)");
  assert.equal(memGetCalls[1]![1].readUInt16LE(6), 3, "$DD00 must carry io (3)");
  assert.equal(memGetCalls[2]![1].readUInt16LE(6), 1, "the pointer table must carry ram (1)");
  for (const [, body] of memGetCalls) {
    assert.notEqual(body.readUInt16LE(6), 0);
  }
});

test('handleSpriteGet: the answer\'s registerBank deep-equals {id:3,name:"io"} and dataBank deep-equals {id:1,name:"ram"}', async () => {
  const { session } = makeSpriteSession();
  const result = await handleSpriteGet({}, session, DEPS);
  const parsed = parseAnswer(result);
  assert.deepEqual(parsed.registerBank, { id: 3, name: "io" });
  assert.deepEqual(parsed.dataBank, { id: 1, name: "ram" });
});

test("handleSpriteGet: a catalog stub lacking ram refuses both, naming the reported bank names, zero MemoryGet sends", async () => {
  const { session, calls } = makeSpriteSession({ banksAvailable: noRamBanksAvailableReply });
  const result = await handleSpriteGet({}, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /default/);
  assert.match(result.content[0]!.text, /io/);
  assert.ok(!calls.some(([commandType]) => commandType === CommandType.MemoryGet));
});

// WR-04 (2026-08-17 re-review): this used to be ONE case that replaced `send`
// with a function answering "wrong_type" to EVERY call. Once readSpriteContext()
// began resolving banks first (CR-02), the very first send was BANKS_AVAILABLE,
// so the failure came out of bankCatalogFor() and NOT ONE of the three
// memory_get type guards was reached -- a test whose title claimed three code
// paths and covered none. Parameterised over which read fails, answering
// BANKS_AVAILABLE normally throughout, so each guard is genuinely exercised;
// the `memGets === failAt` assertion is what stops it going vacuous again.
for (const failAt of [1, 2, 3] as const) {
  test(`handleSpriteGet: a wrong response type on memory read ${failAt} of 3 is refused by that read's own type guard`, async () => {
    const { session } = makeSpriteSession();
    const real = (session.client as unknown as { send: (commandType: number, body: Buffer) => Promise<unknown> }).send;
    let memGets = 0;
    (session.client as unknown as { send: (commandType: number, body: Buffer) => Promise<unknown> }).send = async (
      commandType: number,
      body: Buffer,
    ) => {
      if (commandType === CommandType.BanksAvailable) {
        return real(commandType, body);
      }
      memGets += 1;
      return memGets === failAt ? { type: "wrong_type" } : real(commandType, body);
    };

    const result = await handleSpriteGet({}, session, DEPS);
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /unexpected response type \("wrong_type"\), expected "memory_get"/);
    assert.equal(memGets, failAt, "the read under test must be the one that failed -- no earlier read may short-circuit it");
  });
}

test("handleSpriteGet: a wrong response type on the BANKS_AVAILABLE read is refused by bankCatalogFor, before any memory read", async () => {
  const { session } = makeSpriteSession();
  // The stub replaces `send` outright, so it records its OWN call log --
  // makeSpriteSession()'s `calls` array is never reached and asserting on it
  // here would be vacuous.
  const seen: number[] = [];
  (session.client as unknown as { send: (commandType: number, body: Buffer) => Promise<unknown> }).send = async (commandType: number) => {
    seen.push(commandType);
    return { type: "wrong_type" };
  };
  const result = await handleSpriteGet({}, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /banks_available/);
  assert.deepEqual(seen, [CommandType.BanksAvailable], "exactly one send, and no memory read once the catalog is unusable");
});

test("handleSpriteGet: a short VIC-II reply (46 bytes) is refused, 'a short read is a wrong answer'", async () => {
  const { session } = makeSpriteSession({ viciiBytes: buildViciiBytes().slice(0, 46) });
  const result = await handleSpriteGet({}, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /a short read is a wrong answer/);
});

test("handleSpriteGet: a 0-byte $DD00 reply is refused, 'a short read is a wrong answer'", async () => {
  const { session, calls } = makeSpriteSession();
  const original = (session.client as unknown as { send: (commandType: number, body: Buffer) => Promise<unknown> }).send;
  (session.client as unknown as { send: (commandType: number, body: Buffer) => Promise<unknown> }).send = async (
    commandType: number,
    body: Buffer,
  ) => {
    calls.push([commandType, body]);
    if (commandType === CommandType.BanksAvailable) return banksAvailableReply();
    const start = body.readUInt16LE(1);
    if (start === 0xd000) return memoryGetReply(buildViciiBytes());
    if (start === 0xdd00) return memoryGetReply([]);
    throw new Error("unexpected call");
  };
  const result = await handleSpriteGet({}, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /a short read is a wrong answer/);
  void original;
});

test("handleSpriteGet: a 7-byte pointer-table reply is refused, 'a short read is a wrong answer'", async () => {
  const { session } = makeSpriteSession({ pointerBytes: POINTERS.slice(0, 7) });
  const result = await handleSpriteGet({}, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /a short read is a wrong answer/);
});

test("handleSpriteGet: the answer carries runState and a notes array", async () => {
  const { session } = makeSpriteSession();
  const result = await handleSpriteGet({}, session, DEPS);
  const parsed = parseAnswer(result);
  assert.ok("runState" in parsed);
  assert.ok(Array.isArray(parsed.notes));
});

// ---------------------------------------------------------------------------
// vice_sprite_inspect
// ---------------------------------------------------------------------------

test("handleSpriteInspect: format omitted defaults to ascii, hi-res sprite 0", async () => {
  const { session } = makeSpriteSession();
  const result = await handleSpriteInspect({ sprite_number: 0 }, session, DEPS);
  assert.equal(result.isError, false);
  const parsed = parseAnswer(result);
  assert.equal(parsed.format, "ascii");
  assert.equal(parsed.width, 24);
  assert.equal(parsed.height, 21);
  assert.equal((parsed.rows as string[]).length, 21);
  assert.equal(((parsed.ascii as string).match(/\n/g) ?? []).length, 20);
  assert.equal(parsed.multicolour, false);
  assert.equal(parsed.legend, SPRITE_ASCII_LEGEND_HIRES);
  // the assertion that actually protects the agent: a hi-res grid never
  // emits '@'/'%', so the legend attached to it must not mention them either
  // (CR-02's live-reproduced defect).
  assert.ok(!(parsed.legend as string).includes("@"));
  assert.ok(!(parsed.legend as string).includes("%"));
});

test("handleSpriteInspect: multicolour sprite 1's legend is SPRITE_ASCII_LEGEND_MULTICOLOUR and mentions both @ and %", async () => {
  const pointer1DataAddr = spriteDataAddress(DD00, POINTERS[1]!);
  const { session } = makeSpriteSession({ dataAddresses: { [pointer1DataAddr]: DATA_FIXTURE } });
  const result = await handleSpriteInspect({ sprite_number: 1 }, session, DEPS);
  assert.equal(result.isError, false);
  const parsed = parseAnswer(result);
  assert.equal(parsed.multicolour, true);
  assert.equal(parsed.legend, SPRITE_ASCII_LEGEND_MULTICOLOUR);
  assert.ok((parsed.legend as string).includes("@"));
  assert.ok((parsed.legend as string).includes("%"));
});

test("handleSpriteInspect: cross-check -- every distinct character in the rendered rows is mentioned in the legend (hi-res and multicolour)", async () => {
  // Data bytes exercising all four bit pairs: 0x1b = %00011011.
  const allPairsData: number[] = new Array(63).fill(0x1b);

  const { session: hiresSession } = makeSpriteSession({ dataAddresses: { [SPRITE0_DATA_ADDR]: allPairsData } });
  const hiresResult = await handleSpriteInspect({ sprite_number: 0 }, hiresSession, DEPS);
  const hiresParsed = parseAnswer(hiresResult);
  const hiresChars = new Set((hiresParsed.rows as string[]).join(""));
  for (const ch of hiresChars) {
    assert.ok((hiresParsed.legend as string).includes(ch), `hi-res legend must mention "${ch}"`);
  }

  const pointer1DataAddr = spriteDataAddress(DD00, POINTERS[1]!);
  const { session: mcSession } = makeSpriteSession({ dataAddresses: { [pointer1DataAddr]: allPairsData } });
  const mcResult = await handleSpriteInspect({ sprite_number: 1 }, mcSession, DEPS);
  const mcParsed = parseAnswer(mcResult);
  const mcChars = new Set((mcParsed.rows as string[]).join(""));
  for (const ch of mcChars) {
    assert.ok((mcParsed.legend as string).includes(ch), `multicolour legend must mention "${ch}"`);
  }
});

test("handleSpriteInspect: rendered rows match the exported renderer exactly (hi-res)", async () => {
  const { session } = makeSpriteSession();
  const result = await handleSpriteInspect({ sprite_number: 0 }, session, DEPS);
  const parsed = parseAnswer(result);
  assert.deepEqual(parsed.rows, renderSpriteAscii(Buffer.from(DATA_FIXTURE), false));
});

test("handleSpriteInspect: multicolour sprite 1 renders at 12 columns via the shared renderer", async () => {
  const pointer1DataAddr = spriteDataAddress(DD00, POINTERS[1]!);
  const { session } = makeSpriteSession({ dataAddresses: { [pointer1DataAddr]: DATA_FIXTURE } });
  const result = await handleSpriteInspect({ sprite_number: 1 }, session, DEPS);
  assert.equal(result.isError, false);
  const parsed = parseAnswer(result);
  assert.equal(parsed.width, 12);
  assert.equal(parsed.multicolour, true);
  assert.deepEqual(parsed.rows, renderSpriteAscii(Buffer.from(DATA_FIXTURE), true));
});

test("handleSpriteInspect: format binary omits ascii/legend and matches renderSpriteBinary", async () => {
  const { session } = makeSpriteSession();
  const result = await handleSpriteInspect({ sprite_number: 0, format: "binary" }, session, DEPS);
  assert.equal(result.isError, false);
  const parsed = parseAnswer(result);
  assert.equal(parsed.format, "binary");
  assert.equal(parsed.width, 24);
  assert.ok(!("ascii" in parsed));
  assert.ok(!("legend" in parsed));
  assert.deepEqual(parsed.rows, renderSpriteBinary(Buffer.from(DATA_FIXTURE)));
});

test("handleSpriteInspect: format png_base64 is refused naming png_base64/ascii/binary/SHOT-01, zero sends", async () => {
  const { session, calls } = makeSpriteSession();
  const result = await handleSpriteInspect({ sprite_number: 0, format: "png_base64" }, session, DEPS);
  assert.equal(result.isError, true);
  const text = result.content[0]!.text;
  assert.match(text, /png_base64/);
  assert.match(text, /ascii/);
  assert.match(text, /binary/);
  assert.match(text, /SHOT-01/);
  assert.equal(calls.length, 0);
});

test("handleSpriteInspect: an unknown format is refused listing served values, zero sends", async () => {
  const { session, calls } = makeSpriteSession();
  const result = await handleSpriteInspect({ sprite_number: 0, format: "kickasm" }, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /ascii/);
  assert.match(result.content[0]!.text, /binary/);
  assert.equal(calls.length, 0);
});

test("handleSpriteInspect: a missing sprite_number is refused by name, zero sends", async () => {
  const { session, calls } = makeSpriteSession();
  const result = await handleSpriteInspect({}, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /sprite_number/);
  assert.equal(calls.length, 0);
});

test("handleSpriteInspect: read order and sidefx across all four reads, with exactly one BanksAvailable send first", async () => {
  const { session, calls } = makeSpriteSession();
  await handleSpriteInspect({ sprite_number: 0 }, session, DEPS);
  assert.equal(calls.length, 5);
  assert.equal(calls[0]![0], CommandType.BanksAvailable);
  assert.equal(calls.filter(([commandType]) => commandType === CommandType.BanksAvailable).length, 1, "exactly one BanksAvailable send even though two bank names are resolved");
  assert.equal(calls[4]![1].readUInt16LE(1), 40960);
  assert.equal(calls[4]![1].readUInt16LE(3), 40960 + 62);
  for (let i = 1; i < 5; i += 1) {
    assert.equal(calls[i]![1][0], 0x00, `call ${i} must be sidefx:false`);
  }
});

test("handleSpriteInspect: the fourth (sprite-data) MemoryGet send carries the resolved ram bank (1)", async () => {
  const { session, calls } = makeSpriteSession();
  await handleSpriteInspect({ sprite_number: 0 }, session, DEPS);
  const memGetCalls = calls.filter(([commandType]) => commandType === CommandType.MemoryGet);
  assert.equal(memGetCalls.length, 4);
  assert.equal(memGetCalls[3]![1].readUInt16LE(6), 1);
});

test('handleSpriteInspect: the answer\'s registerBank deep-equals {id:3,name:"io"} and dataBank deep-equals {id:1,name:"ram"}', async () => {
  const { session } = makeSpriteSession();
  const result = await handleSpriteInspect({ sprite_number: 0 }, session, DEPS);
  const parsed = parseAnswer(result);
  assert.deepEqual(parsed.registerBank, { id: 3, name: "io" });
  assert.deepEqual(parsed.dataBank, { id: 1, name: "ram" });
});

test("handleSpriteInspect: a catalog stub lacking ram refuses, naming the reported bank names, zero MemoryGet sends", async () => {
  const { session, calls } = makeSpriteSession({ banksAvailable: noRamBanksAvailableReply });
  const result = await handleSpriteInspect({ sprite_number: 0 }, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /default/);
  assert.match(result.content[0]!.text, /io/);
  assert.ok(!calls.some(([commandType]) => commandType === CommandType.MemoryGet));
});

test("handleSpriteInspect: a 62-byte data reply is refused, 'a short read is a wrong answer'", async () => {
  const { session } = makeSpriteSession({ dataAddresses: { [SPRITE0_DATA_ADDR]: DATA_FIXTURE.slice(0, 62) } });
  const result = await handleSpriteInspect({ sprite_number: 0 }, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /a short read is a wrong answer/);
});

test("handleSpriteInspect: expansion note present when X/Y expansion is set for the inspected sprite", async () => {
  const pointer1DataAddr = spriteDataAddress(DD00, POINTERS[1]!);
  const { session } = makeSpriteSession({ dataAddresses: { [pointer1DataAddr]: DATA_FIXTURE } });
  // Sprite 1 has $D017 bit 1 set (Y-expand) in the shared VIC-II fixture.
  const result = await handleSpriteInspect({ sprite_number: 1 }, session, DEPS);
  const notes = parseAnswer(result).notes as string[];
  assert.ok(notes.some((n) => n.includes("24x21") && n.toLowerCase().includes("not scaled")));
});

test("handleSpriteInspect: the $ffff bound -- pointer 0xff in bank 3 still fits", async () => {
  const dd00Bank3 = 0xc0; // vicBank(0xc0) === 3, vicBankBase === 49152
  const viciiBytes = buildViciiBytes();
  viciiBytes[0x18] = 0x00; // d018=0 -> screenBase = 49152 + 0 = 49152
  const pointerTableAddress = screenBase(0x00, dd00Bank3) + 0x3f8;
  const pointers = [0xff, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87];
  const dataAddr = spriteDataAddress(dd00Bank3, 0xff); // 49152 + 0xff*64 = 65472
  assert.equal(dataAddr, 65472);
  assert.equal(dataAddr + 62, 65534);
  const { session, calls } = makeSpriteSession({
    dd00: dd00Bank3,
    viciiBytes,
    pointerTableAddress,
    pointerBytes: pointers,
    dataAddresses: { [dataAddr]: DATA_FIXTURE },
  });
  const result = await handleSpriteInspect({ sprite_number: 0 }, session, DEPS);
  assert.equal(result.isError, false);
  assert.equal(calls.length, 5);
});

// ---------------------------------------------------------------------------
// ROM-window note
// ---------------------------------------------------------------------------

test("handleSpriteGet: a ROM-window note is emitted when a resolved address falls in $1000-$1FFF of bank 0 or 2", async () => {
  const dd00Bank0 = 0xc3; // dd00 & 3 === 3 -> vicBank === 0 -> bankBase 0
  const viciiBytes = buildViciiBytes();
  viciiBytes[0x18] = 0x00; // screenBase = 0 + 0 = 0 (not in the ROM window itself)
  const pointerTableAddress = screenBase(0x00, dd00Bank0) + 0x3f8;
  // pointer 0x40 -> dataAddress = 0 + 0x40*64 = 0x1000, inside the ROM window.
  const pointers = [0x40, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87];
  const dataAddr = spriteDataAddress(dd00Bank0, 0x40);
  assert.equal(dataAddr, 0x1000);
  const { session } = makeSpriteSession({
    dd00: dd00Bank0,
    viciiBytes,
    pointerTableAddress,
    pointerBytes: pointers,
  });
  const result = await handleSpriteGet({}, session, DEPS);
  const notes = parseAnswer(result).notes as string[];
  assert.ok(notes.some((n) => n.includes("character-ROM")));
});

// ---------------------------------------------------------------------------
// CR-02 -- the bank-3 I/O-window note (a resolved address landing in
// $D000-$DFFF while VIC bank 3 is selected, read correctly through `ram`).
// ---------------------------------------------------------------------------

test("handleSpriteGet: a bank-3 I/O-window note is emitted when a resolved sprite-data address lands in $D000-$DFFF, and the pointer/data sends still carry the ram id", async () => {
  const dd00Bank3 = 0xc0; // dd00 & 3 === 0 -> vicBank === 3 -> bankBase 49152 (0xc000)
  const viciiBytes = buildViciiBytes();
  viciiBytes[0x18] = 0x00; // screenBase = 49152 + 0 = 49152 (0xc000, NOT in the I/O window itself)
  const pointerTableAddress = screenBase(0x00, dd00Bank3) + 0x3f8;
  // pointer 0x40 -> dataAddress = 49152 + 0x40*64 = 53248 = 0xd000, inside VIC bank 3's I/O window.
  const pointers = [0x40, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87];
  const dataAddr = spriteDataAddress(dd00Bank3, 0x40);
  assert.equal(dataAddr, 0xd000);
  const { session, calls } = makeSpriteSession({
    dd00: dd00Bank3,
    viciiBytes,
    pointerTableAddress,
    pointerBytes: pointers,
  });
  const result = await handleSpriteGet({}, session, DEPS);
  assert.equal(result.isError, false);
  const notes = parseAnswer(result).notes as string[];
  assert.ok(notes.some((n) => /I\/O window/.test(n) && n.includes("0xd000")), `expected an I/O window note naming 0xd000, got: ${JSON.stringify(notes)}`);
  const memGetCalls = calls.filter(([commandType]) => commandType === CommandType.MemoryGet);
  const pointerCall = memGetCalls.find((c) => c[1].readUInt16LE(1) === pointerTableAddress)!;
  assert.equal(pointerCall[1].readUInt16LE(6), 1, "the pointer-table send must still carry the ram id");
});
