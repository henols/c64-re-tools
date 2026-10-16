import assert from "node:assert/strict";
import { test } from "node:test";

import { mermaidGraph, ownerOf, routineEdges, routineHeads, type GraphReference } from "./graph.ts";

const symbols = [
  { address: 0x1000, name: "main", kind: "routine" as const },
  { address: 0x1010, name: "loop", kind: "label" as const },
  { address: 0x2000, name: "draw", kind: "routine" as const },
];
const references: GraphReference[] = [
  { from: 0x1003, to: 0x2000, kind: "call" },
  { from: 0x1012, to: 0x1010, kind: "jump" }, // inside main: no edge
  { from: 0x1015, to: 0x2004, kind: "jump" }, // into the middle of draw
  { from: 0x1018, to: 0x2000, kind: "jump" }, // a second reference: the call stays the kind
  { from: 0x2003, to: 0x3000, kind: "table" }, // a table entry: its target is a head without a name
  { from: 0x2006, to: 0x0400, kind: "read" },
];

test("the heads are the routines and every call or table target; an address belongs to the nearest head below it", () => {
  const heads = routineHeads(symbols, references, (address) => `l_${address.toString(16)}`);
  assert.deepEqual(heads.map((head) => head.name), ["main", "draw", "l_3000"]);
  assert.equal(ownerOf(heads, [], 0x1fff)?.name, "main");
  assert.equal(ownerOf(heads, [0x1800], 0x1fff), undefined, "a module start between them ends the routine");
  assert.equal(ownerOf(heads, [], 0x0fff), undefined);
});

test("the edges join routines with the strongest kind of their references, and mermaid draws each kind", () => {
  const heads = routineHeads(symbols, references, (address) => `l_${address.toString(16)}`);
  const edges = routineEdges(heads, [], references);
  assert.deepEqual(edges, [
    { from: 0x1000, to: 0x2000, kind: "call", count: 3 },
    { from: 0x2000, to: 0x3000, kind: "table", count: 1 },
  ]);
  assert.equal(
    mermaidGraph(heads, edges, new Set([0x2000])),
    ['flowchart LR', '  n1000["main<br/>$1000"]', '  n2000("draw<br/>$2000")', '  n3000["l_3000<br/>$3000"]', "  n1000 --> n2000", "  n2000 ==> n3000"].join("\n"),
  );
});
