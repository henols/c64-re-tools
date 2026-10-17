import assert from "node:assert/strict";
import { test } from "node:test";

import { joinBatches, type Batch } from "./join.ts";

// The Bruce Lee field run: seven agents each named one range, and a hand-written merge.py joined their batches.
const a: Batch = {
  file: "batch_a.json",
  owner: { start: 0x0200, end: 0x0fff },
  ops: [
    { op: "rename", address: 0x0400, name: "cold_start", kind: "routine" },
    { op: "rename", address: 0x1000, name: "draw_room_a" },
    { op: "comment", address: 0x1000, placement: "line", text: "From batch a." },
    { op: "operand", address: 0x0410, select: "lo", symbol: "draw_room_a" },
    { op: "classify", start: 0x0f00, end: 0x10ff, type: "bytes" },
    { op: "reference", from: 0x0400, to: 0x1000, kind: "call" },
    { op: "module", start: 0x0400, file: "main.asm" },
  ],
};
const b: Batch = {
  file: "batch_b.json",
  owner: { start: 0x1000, end: 0x1fff },
  ops: [
    { op: "rename", address: 0x1000, name: "draw_room", kind: "routine" },
    { op: "comment", address: 0x1000, placement: "line", text: "Draws the room." },
    { op: "classify", start: 0x1000, end: 0x10ff, type: "code" },
    { op: "reference", from: 0x0400, to: 0x1000, kind: "call" },
    { op: "remove-symbol", address: 0x1000 },
    { op: "remove-symbol", address: 0x1800 },
    { op: "use", start: 0x1100, end: 0x1105, macro: "inc16", args: ["draw_room"] },
  ],
};

test("join keeps the owner's name and comment, follows replaced names into operands, and puts the owner's regions last", () => {
  const joined = joinBatches([a, b]);
  assert.deepEqual(joined.clashes, []);
  const of = (op: string) => joined.ops.filter((write) => write.op === op);
  assert.deepEqual(of("rename"), [
    { op: "rename", address: 0x0400, name: "cold_start", kind: "routine" },
    { op: "rename", address: 0x1000, name: "draw_room", kind: "routine" },
  ]);
  assert.deepEqual(of("comment"), [{ op: "comment", address: 0x1000, placement: "line", text: "Draws the room." }]);
  assert.deepEqual(of("operand"), [{ op: "operand", address: 0x0410, select: "lo", symbol: "draw_room" }], "batch a's name follows the owner's name");
  assert.deepEqual(of("reference").length, 1, "the same reference once");
  assert.equal(joined.repeated, 1);
  assert.deepEqual(of("remove-symbol"), [{ op: "remove-symbol", address: 0x1800 }], "a name wins over a removal at its address");
  assert.deepEqual(
    joined.ops.filter((write) => write.op === "classify").map((write) => (write as { type: string }).type),
    ["bytes", "code"],
    "batch b owns $1000: its region comes later, so it wins where they overlap",
  );
  assert.deepEqual(joined.ops.map((write) => write.op).indexOf("remove-symbol") < joined.ops.map((write) => write.op).indexOf("rename"), true);
  assert.deepEqual(joined.choices, [
    { what: "name", space: "c64", at: 0x1000, kept: { file: "batch_b.json", value: "draw_room (routine)" }, left: [{ file: "batch_a.json", value: "draw_room_a" }] },
    { what: "comment", space: "c64", at: 0x1000, kept: { file: "batch_b.json", value: "Draws the room." }, left: [{ file: "batch_a.json", value: "From batch a." }] },
  ]);
});

test("join takes the first batch's write at an address that no batch owns, and refuses one name or one file at two addresses", () => {
  const first: Batch = { file: "one.json", ops: [{ op: "rename", address: 0x9000, name: "buffer" }, { op: "module", start: 0x9000, file: "data.asm" }] };
  const second: Batch = { file: "two.json", ops: [{ op: "rename", address: 0x9000, name: "screen_copy" }, { op: "rename", address: 0x9100, name: "buffer" }, { op: "module", start: 0x9100, file: "data.asm" }] };
  const joined = joinBatches([first, second]);
  assert.deepEqual(joined.clashes, [
    { what: "name", value: "buffer", space: "c64", places: [{ address: 0x9000, file: "one.json" }, { address: 0x9100, file: "two.json" }] },
    { what: "file", value: "data.asm", space: "c64", places: [{ address: 0x9000, file: "one.json" }, { address: 0x9100, file: "two.json" }] },
  ]);
  assert.equal(joined.choices[0]?.kept.file, "one.json");
});

test("join follows a replaced name into an expression and a macro arg, and keeps each space apart", () => {
  const owner: Batch = { file: "owner.json", owner: { start: 0x2000, end: 0x2fff }, ops: [{ op: "rename", address: 0x2000, name: "sprite_table" }] };
  const other: Batch = {
    file: "other.json",
    ops: [
      { op: "rename", address: 0x2000, name: "sprites" },
      { op: "operand", address: 0x0810, select: "expr", expression: ">(sprites+$40)" },
      { op: "use", start: 0x0820, end: 0x0825, macro: "set16", args: ["sprites", "$fb"] },
      { op: "rename", space: "drive8", address: 0x2000, name: "sprites" },
    ],
  };
  const joined = joinBatches([owner, other]);
  assert.deepEqual(joined.ops.find((write) => write.op === "operand"), { op: "operand", address: 0x0810, select: "expr", expression: ">(sprite_table+$40)" });
  assert.deepEqual(joined.ops.find((write) => write.op === "use"), { op: "use", start: 0x0820, end: 0x0825, macro: "set16", args: ["sprite_table", "$fb"] });
  assert.deepEqual(
    joined.ops.filter((write) => write.op === "rename").map((write) => [(write as { space?: string }).space ?? "c64", (write as { name: string }).name]),
    [
      ["c64", "sprite_table"],
      ["drive8", "sprites"],
    ],
  );
});
