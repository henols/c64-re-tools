// The first access of a range in a run of c64-provenance: the coverage flags
// at a stop, and the instruction that made the access when they show a read
// and a write. A press runs with the points off.

import assert from "node:assert/strict";
import { test } from "node:test";

import { COVERAGE } from "../../src/c64.ts";
import type { EntryState } from "../../src/host-client/entry-state.ts";
import type { ViceSessionClient } from "../../src/host-client/vice-session.ts";
import { accessOf, watchRelease } from "../../skills/c64-provenance/scripts/lib/runtime.ts";

test("a read and a write at one stop are a write for a store and a read for a read-modify-write", () => {
  const both = COVERAGE.ramRead | COVERAGE.ramWrite;
  // Bruce Lee: STA ($06),Y at $4898 makes a dummy read at its target before the write.
  assert.equal(accessOf(both, 0x91), "write", "STA (zp),Y");
  assert.equal(accessOf(both, 0x9d), "write", "STA abs,X");
  assert.equal(accessOf(both, 0x9f), "write", "SHA abs,Y, an undocumented store");
  assert.equal(accessOf(both, 0xee), "read", "INC abs reads first");
  assert.equal(accessOf(both), "read-write", "without the instruction, the order is not known");
  assert.equal(accessOf(both | COVERAGE.ramExecute, 0x91), "execute");
  assert.equal(accessOf(COVERAGE.ramRead, 0x91), "read", "a store decides only a read and a write");
  assert.equal(accessOf(COVERAGE.ioWrite), "write");
  assert.equal(accessOf(0), "none");
});

test("a press runs all of its taps with the points off, and an access in the taps is first", async () => {
  const map = new Uint8Array(0x10000);
  const on = new Map<string, boolean>();
  let ids = 0;
  let pressed: number | undefined;
  const point = (kind: string) => async (params: { action: string; id?: number }) => {
    if (params.action === "add") {
      on.set(`${kind}${++ids}`, true);
      return { id: ids };
    }
    if (params.action === "remove") on.delete(`${kind}${params.id}`);
    else on.set(`${kind}${params.id}`, params.action === "enable");
    return {};
  };
  const watching = () => [...on.values()].some(Boolean);
  const client = {
    reset: async () => ({}),
    status: async () => ({ state: "stopped" }),
    memoryWrite: async () => ({}),
    registersSet: async () => ({}),
    watchpoint: point("watch"),
    breakpoint: point("break"),
    memmap: async (params: { action: string }) => {
      if (params.action === "clear") map.fill(0);
      return { ranges: [...map.entries()].filter(([, flags]) => flags !== 0).map(([address, flags]) => ({ start: address, end: address, flags })) };
    },
    // The key handler reads $a000 in the first tap. A point that is on stops the taps there, as the host does.
    press: async (taps: unknown[]) => {
      map[0xa000]! |= COVERAGE.ramRead;
      pressed = watching() ? 0 : taps.length;
      return { taps: pressed, state: "stopped", ...(watching() ? { stopReason: "watchpoint" } : {}) };
    },
    // After the taps, STA $a000.
    execution: async (params: { action: string; count?: number }) => {
      if (params.action === "advance-frames" && pressed !== undefined && (map[0xa000]! & COVERAGE.ramWrite) === 0) {
        map[0xa000]! |= COVERAGE.ramWrite;
        if (watching()) return { state: "stopped", advancedFrames: 0, stopReason: "watchpoint" };
      }
      return { state: "stopped", advancedFrames: params.count, stopReason: "frames" };
    },
    cpuHistory: async () => ({ entries: [{ bytes: "8d00a0" }] }),
    memoryRead: async (params: { size: number }) => ({ data: "00".repeat(params.size) }),
  } as unknown as ViceSessionClient;
  const state = { pc: 0x1000, a: 0, x: 0, y: 0, sp: 0xff, flags: { n: false, v: false, d: false, i: false, z: false, c: false }, port: [0x2f, 0x37], pages: new Uint8Array(0x400), raw: {} } as EntryState;
  const watched = await watchRelease(client, { kind: "image", segments: [], byteAt: () => 0, state }, [{ start: 0xa000, end: 0xa000 }], () => 0, { frames: 10, steps: [{ press: { keys: "12", frames: 3 } }] });
  assert.deepEqual(watched, { started: true, accesses: [{ first: "read", changed: false }] });
  assert.equal(pressed, 2, "both taps");
});
