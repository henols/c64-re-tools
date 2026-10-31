// The summary of a c64_trace result: the hits counted by address and by pc.

import assert from "node:assert/strict";
import { test } from "node:test";

import type { TraceHit } from "../../protocol/vice.ts";
import { traceSummary } from "./debug.ts";

/** A hit of point 0 by the instruction at pc, with the address and the value when it has them. */
const hit = (pc: number, text: string, address?: number, value?: number, point = 0): TraceHit => ({
  point,
  pc,
  bytes: "",
  text,
  a: 0,
  x: 0,
  y: 0,
  sp: 0xff,
  frame: 0,
  rasterLine: 0,
  rasterCycle: 0,
  ...(address === undefined ? {} : { address }),
  ...(value === undefined ? {} : { value }),
});

test("a trace summary counts the hits of each address with its values and pcs, and the hits of each pc, most hits first", () => {
  const hits = [hit(0x1000, "STA $d020", 0xd020, 1), hit(0x1003, "STA $d020", 0xd020, 0), hit(0x1000, "STA $d020", 0xd020, 1), hit(0x1006, "STA $d021", 0xd021, 6), hit(0x2000, "RTS", undefined, undefined, 1)];
  assert.deepEqual(traceSummary(hits, ["write", "exec"]), {
    addresses: 2,
    byAddress: [
      { address: "$d020", kind: "write", hits: 3, values: [0, 1], pcs: [{ pc: "$1000", hits: 2 }, { pc: "$1003", hits: 1 }] },
      { address: "$d021", kind: "write", hits: 1, values: [6], pcs: [{ pc: "$1006", hits: 1 }] },
    ],
    pcs: 4,
    byPc: [
      { pc: "$1000", text: "STA $d020", hits: 2, firstHit: 0, lastHit: 2 },
      { pc: "$1003", text: "STA $d020", hits: 1, firstHit: 1, lastHit: 1 },
      { pc: "$1006", text: "STA $d021", hits: 1, firstHit: 3, lastHit: 3 },
      { pc: "$2000", text: "RTS", hits: 1, firstHit: 4, lastHit: 4 },
    ],
  });
});

test("a trace summary lists at most 20 addresses and pcs, 16 values and 4 pcs of an address", () => {
  const hits = Array.from({ length: 25 }, (_, index) => hit(0x1000 + index, "STA $0400,X", 0x0400 + index, index));
  hits.push(...Array.from({ length: 20 }, (_, index) => hit(0x2000 + (index % 5), "STA $d020", 0xd020, index)));
  const summary = traceSummary(hits, ["write"]);
  assert.deepEqual([summary.addresses, summary.byAddress.length, summary.pcs, summary.byPc.length], [26, 20, 30, 20]);
  const [most] = summary.byAddress;
  assert.deepEqual([most!.address, most!.hits, most!.values, most!.moreValues, most!.pcs.length], ["$d020", 20, Array.from({ length: 16 }, (_, index) => index), 4, 4]);
});
