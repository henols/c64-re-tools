import assert from "node:assert/strict";
import { test } from "node:test";

import { dxaArguments, parseListing } from "./dxa.ts";

// Real dxa 0.1.5 output (-a dump -p all-nmos6502 -d skip-scanning -U, with a
// routine and a label seed) for test/fixtures/prg/analysis-subject.ts.
const LISTING = [
  "              \t.word $0801",
  "              \t* = $0801",
  "",
  "; 12 byte BASIC header.",
  "0801 0b 08 0a \t.byt $0b,$08,$0a",
  "0804 00 9e 32 \t.byt $00,$9e,$32",
  "0807 30 36 31 \t.byt $30,$36,$31",
  "080a 00 00 00 \t.byt $00,$00,$00",
  "080d          l80d:",
  "080d 20 18 08 \tjsr init_result",
  "0810          l810:",
  "0810 ee 20 d0 \tinc $d020",
  "0813 4c 10 08 \tjmp l810",
  "0816 00 00    \t.byt $00,$00",
  "0818          init_result:",
  "0818 a9 01    \tlda #$01",
  "081a 8d 00 c1 \tsta $c100",
  "081d ad 24 08 \tlda l824",
  "0820 18       \tclc",
  "0821 69 05    \tadc #$05",
  "0823 60       \trts",
  "0824          l824:",
  "0824 10 20 30 \t.byt $10,$20,$30",
  "0827 40 00 00 \t.byt $40",
  "",
].join("\n");

test("a dump listing gives the code and data regions and the labels", () => {
  const parsed = parseListing(LISTING, 0x0801, 0x0827);
  assert.deepEqual(parsed.regions, [
    { start: 0x0801, end: 0x080c, classification: "data" },
    { start: 0x080d, end: 0x0815, classification: "code" },
    { start: 0x0816, end: 0x0817, classification: "data" },
    { start: 0x0818, end: 0x0823, classification: "code" },
    { start: 0x0824, end: 0x0827, classification: "data" },
  ]);
  assert.deepEqual(parsed.labels, [
    { address: 0x080d, name: "l80d" },
    { address: 0x0810, name: "l810" },
    { address: 0x0818, name: "init_result" },
    { address: 0x0824, name: "l824" },
  ]);
});

test("a truncated, reordered or misplaced listing is refused", () => {
  const lines = LISTING.trimEnd().split("\n");
  assert.throws(() => parseListing(lines.slice(0, -1).join("\n"), 0x0801, 0x0827), /holds 3 bytes, but the next line is 4 bytes later/);
  assert.throws(() => parseListing(LISTING, 0x0800, 0x0827), /starts at \$0801/);
  const swapped = [...lines];
  [swapped[11], swapped[12]] = [swapped[12]!, swapped[11]!];
  assert.throws(() => parseListing(swapped.join("\n"), 0x0801, 0x0827), Error);
  assert.throws(() => parseListing("; nothing here\n", 0x0801, 0x0827), /no statements/);
  assert.throws(() => parseListing(LISTING.replace("0818          init_result:", "9000          far_away:"), 0x0801, 0x0827), /not usable/);
});

test("argv carries only the fixed options, the seed files that have lines, and the image", () => {
  assert.deepEqual(dxaArguments("/usr/bin/dxa", { imageKind: "prg", entryPoints: [], dataRanges: [], labels: [] }, { image: "input/image.bin" }), [
    "/usr/bin/dxa", "-a", "dump", "-p", "all-nmos6502", "-d", "skip-scanning", "-U", "input/image.bin",
  ]);
  assert.deepEqual(
    dxaArguments("/usr/bin/dxa", { imageKind: "flat64k", entryPoints: [0x1000], dataRanges: [], labels: [] }, { image: "input/image.bin", routines: "routines.txt", labels: "labels.txt" }),
    ["/usr/bin/dxa", "-a", "dump", "-p", "all-nmos6502", "-d", "skip-scanning", "-R", "routines.txt", "-l", "labels.txt", "-g", "0000", "-q", "input/image.bin"],
  );
});
