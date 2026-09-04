#!/usr/bin/env node
// dxa-listing.test.ts
//
// Phase 35, plan 35-02, task 1 (DXA-02): every case in dxa-listing.ts's own
// five-measured-shape table, its named refusal (never dxa's own exit
// status), and the CRLF/ordering/adjacency/degenerate-input contracts.
// Task 2 (same file) adds the overlapping-decode / `unclassified`
// disposition below the task-1 section marker.
//
// Imports the UNBUILT `.ts` source directly -- this module has no
// child_process dependency and no filesystem/network I/O of its own (see
// dxa-listing.ts's own header), so every case here runs with no host
// process, no vendored dxa binary, and no VICE broker required.
//
// FIXTURE PROVENANCE. Every real dxa-output line below was extracted
// VERBATIM, via a shell script reading the committed transcript, from
// .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/
// fixture/fixture-baseline.txt -- never retyped by hand. Line numbers cited
// in each fixture's own comment are that file's own line numbers. This
// mirrors the previous (interrupted) executor's own stated approach for
// this task: "use a generator script to embed exact fixture bytes safely."
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseDumpListing } from "./dxa-listing.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// Fixtures -- the five measured shapes and both preamble lines
// ============================================================================

/** Shape 1: tab-separated byte-emitting instruction line, 2 bytes.
 * fixture-baseline.txt:61 */
const SHAPE1_INSTRUCTION_PRECEDING = "0810 a9 00    \tlda #$00";
/** Shape 1: tab-separated byte-emitting instruction line, 3 bytes, the
 * table's own example. fixture-baseline.txt:62 */
const SHAPE1_INSTRUCTION = "0812 8d 20 d0 \tsta $d020";
/** Shape 2: tab-separated byte-emitting `.byt` line, 1 byte.
 * fixture-baseline.txt:169 */
const SHAPE2_BYT = "08bf 00       \t.byt $00";
/** Shape 3: SPACE-separated (not tab) byte-emitting `.word` line, 2 bytes --
 * the whitespace class, not a literal tab, is what makes this shape match.
 * fixture-baseline.txt:164 */
const SHAPE3_WORD = "08b7 92 08      .word l892";
/** Shape 4: label-only line, blank byte column -- correctly does NOT match
 * DUMP_LINE_RE (no hex-byte column to satisfy the required group).
 * fixture-baseline.txt:60 */
const SHAPE4_LABEL_ONLY = "0810          l810:";
/** Shape 5: mid-instruction `= * + n` continuation line, blank byte column,
 * and no address column at position 0 at all (a leading tab) -- correctly
 * does NOT match DUMP_LINE_RE. fixture-baseline.txt:152 */
const SHAPE5_MID_INSTRUCTION = "\t08a6          l8a6 = * + 1";
/** Preamble line 1: no address column at position 0. fixture-baseline.txt:51 */
const PREAMBLE_WORD_DIRECTIVE = "              \t.word $0801";
/** Preamble line 2: no address column at position 0. fixture-baseline.txt:52 */
const PREAMBLE_ORIGIN_DIRECTIVE = "              \t* = $0801";

/** An invented SIXTH line shape (dash-separated byte column) that this
 * project's ported regex correctly does not recognize -- a stand-in for an
 * unseen future dxa format, not a claim about a real one (that claim is
 * plan 35-05's, from an actual run; see this file's own header and
 * dxa-listing.ts's own header for why a synthetic sixth shape here proves
 * only the MECHANISM, not the real-world provocation). */
const SIXTH_SHAPE_UNSEEN_FORMAT = "0900-aa-bb  .word $aabb";

/** The full 163-line, 279-byte `-a dump` transcript of Phase 23's rebuilt
 * fixture -- extracted VERBATIM via a script reading the committed
 * transcript (fixture-baseline.txt:51-213), never retyped. Phase 23's own
 * parser run against this exact text reported PARSE_ACCOUNTED_BYTES: 279,
 * PARSE_MATCHED_LINES: 125, PARSE_CODE_BYTES: 179, PARSE_DATA_BYTES: 100,
 * PARSE_ADDRESS_RANGE: $0801-$0917 (fixture-baseline.txt:227-236). */
const PHASE23_279_BYTE_FIXTURE =
  "              \t.word $0801\n              \t* = $0801\n\n; 12 byte BASIC header.\n0801 0b 08 0a \t.byt $0b,$08,$0a\n0804 00 9e 32 \t.byt $00,$9e,$32\n0807 30 36 34 \t.byt $30,$36,$34\n080a 00 00 00 \t.byt $00,$00,$00\n080d 00 00 00 \t.byt $00,$00,$00\n0810          l810:\n0810 a9 00    \tlda #$00\n0812 8d 20 d0 \tsta $d020\n0815 a2 00    \tldx #$00\n0817          l817:\n0817 bd bf 08 \tlda l8bf,x\n081a 9d df 08 \tsta l8df,x\n081d e8       \tinx\n081e e0 20    \tcpx #$20\n0820 d0 f5    \tbne l817\n0822 a2 02    \tldx #$02\n0824 bd ab 08 \tlda l8ab,x\n0827 85 fb    \tsta $fb\n0829 bd ae 08 \tlda l8ae,x\n082c 85 fc    \tsta $fc\n082e 6c fb 00 \tjmp ($00fb)\n0831          l831:\n0831 a2 01    \tldx #$01\n0833 bd b4 08 \tlda l8b4,x\n0836 48       \tpha\n0837 bd b1 08 \tlda l8b1,x\n083a 48       \tpha\n083b 60       \trts\n083c          l83c:\n083c a2 00    \tldx #$00\n083e          l83e:\n083e bd ff 08 \tlda l8ff,x\n0841 f0 13    \tbeq l856\n0843          l843:\n0843 bd 00 09 \tlda l900,x\n0846 18       \tclc\n0847 7d 02 09 \tadc l902,x\n084a 9d 00 09 \tsta l900,x\n084d bd 01 09 \tlda l901,x\n0850 7d 03 09 \tadc l903,x\n0853 9d 01 09 \tsta l901,x\n0856          l856:\n0856 8a       \ttxa\n0857 18       \tclc\n0858 69 05    \tadc #$05\n085a aa       \ttax\n085b e0 19    \tcpx #$19\n085d d0 df    \tbne l83e\n085f          l85f:\n085f 60       \trts\n0860          l860:\n0860 20 71 08 \tjsr l871\n0863 48       \tpha\n0864 45 4c    \teor $4c\n0866 4c 4f 00 \tjmp $004f\n0869 20 71 08 \t.byt $20,$71,$08\n086c 42       \t.byt $42\n086d          l86d:\n086d 59 45 00 \teor !$0045,y\n0870 60       \trts\n0871          l871:\n0871 68       \tpla\n0872 85 fd    \tsta $fd\n0874 68       \tpla\n0875 85 fe    \tsta $fe\n0877 a0 01    \tldy #$01\n0879          l879:\n0879 b1 fd    \tlda ($fd),y\n087b f0 06    \tbeq l883\n087d          l87d:\n087d 20 d2 ff \tjsr $ffd2\n0880 c8       \tiny\n0881 d0 f6    \tbne l879\n0883          l883:\n0883 98       \ttya\n0884 18       \tclc\n0885 65 fd    \tadc $fd\n0887 85 fd    \tsta $fd\n0889 a5 fe    \tlda $fe\n088b 69 00    \tadc #$00\n088d 48       \tpha\n088e a5 fd    \tlda $fd\n0890 48       \tpha\n0891 60       \trts\n0892          l892:\n0892 ee 21 d0 \tinc $d021\n0895 60       \trts\n0896          l896:\n0896 ce 21 d0 \tdec $d021\n0899 60       \trts\n089a          l89a:\n089a a9 07    \tlda #$07\n089c 8d 21 d0 \tsta $d021\n089f 60       \trts\n08a0          l8a0:\n08a0 a9 aa    \tlda #$aa\n08a2 8d a6 08 \tsta l8a6\n\t08a6          l8a6 = * + 1\n08a5 a9 00    \tlda #$00\n08a7 8d 00 04 \tsta $0400\n08aa 60       \trts\n08ab          l8ab:\n08ab 92 96 9a \t.byt $92,$96,$9a\n08ae          l8ae:\n08ae 08 08 08 \t.byt $08,$08,$08\n08b1          l8b1:\n08b1 91 95 99 \t.byt $91,$95,$99\n08b4          l8b4:\n08b4 08 08 08 \t.byt $08,$08,$08\n08b7 92 08      .word l892\n08b9 96 08      .word l896\n08bb 9a 08      .word l89a\n08bd 71 08      .word l871\n08bf          l8bf:\n08bf 00       \t.byt $00\n08c0          l8c0:\n08c0 01 02    \tora ($02,x)\n08c2 03 04    \tslor ($04,x)\n08c4 05 06    \tora $06\n08c6 07 08    \tslor $08\n08c8 09 0a    \tora #$0a\n08ca 0b 0c    \tanc #$0c\n08cc 0d 0e 0f \tora $0f0e\n08cf 10 11    \tbpl l8e2\n08d1 12 13 14 \t.byt $12,$13,$14\n08d4 15 16 17 \t.byt $15,$16,$17\n08d7 18 19 1a \t.byt $18,$19,$1a\n08da 1b 1c 1d \t.byt $1b,$1c,$1d\n08df          l8df = * + 2\n08dd 1e 1f 00 \t.byt $1e,$1f,$00\n08e2          l8e2 = * + 2\n08e0 00 00 00 \t.byt $00,$00,$00\n08e3 00 00 00 \t.byt $00,$00,$00\n08e6 00 00 00 \t.byt $00,$00,$00\n08e9 00 00 00 \t.byt $00,$00,$00\n08ec 00 00 00 \t.byt $00,$00,$00\n08ef 00 00 00 \t.byt $00,$00,$00\n08f2 00 00 00 \t.byt $00,$00,$00\n08f5 00 00 00 \t.byt $00,$00,$00\n08f8 00 00 00 \t.byt $00,$00,$00\n08fb 00 00 00 \t.byt $00,$00,$00\n08ff          l8ff = * + 1\n08fe 00 01    \t.byt $00,$01\n0900          l900:\n\t0901          l901 = * + 1\n0900 10 00    \tbpl l902\n0902          l902:\n\t0903          l903 = * + 1\n0902 01 00    \tora ($00,x)\n0904 01 20    \tora ($20,x)\n0906 00       \t.byt $00\n0907          l907:\n0907 ff ff 01 \tisbc $01ff,x\n090a 30 00    \tbmi l90c\n090c          l90c:\n090c 02 00 00 \t.byt $02,$00,$00\n090f 00 00 00 \t.byt $00,$00,$00\n0912 00 00 00 \t.byt $00,$00,$00\n0915 00 00 00 \t.byt $00,$00,$00";

/** Asserts `fn()` throws an `Error` whose message contains every string in
 * `substrings` -- used throughout instead of a regex match so each
 * assertion failure prints exactly which expected substring was missing. */
function assertThrowsContaining(fn: () => unknown, substrings: string[]): void {
  let threw = false;
  try {
    fn();
  } catch (err) {
    threw = true;
    assert.ok(err instanceof Error, `expected an Error, got ${String(err)}`);
    for (const s of substrings) {
      assert.ok(err.message.includes(s), `expected message to include "${s}", got: ${err.message}`);
    }
  }
  assert.ok(threw, "expected fn() to throw, but it did not");
}

// ============================================================================
// Task 1: the five shapes, the named refusal, CRLF/ordering/adjacency
// ============================================================================

test("shape 1 (tab-separated instruction) classifies its hex-column bytes as code", () => {
  const map = parseDumpListing(SHAPE1_INSTRUCTION, { origin: 0x0812, imageSize: 3 });
  assert.deepEqual([...map.code].sort((a, b) => a - b), [0x0812, 0x0813, 0x0814]);
  assert.equal(map.data.size, 0);
  assert.equal(map.codeBytes, 3);
  assert.equal(map.matchedLines, 1);
});

test("shape 2 (tab-separated .byt) classifies its hex-column bytes as data", () => {
  const map = parseDumpListing(SHAPE2_BYT, { origin: 0x08bf, imageSize: 1 });
  assert.deepEqual([...map.data], [0x08bf]);
  assert.equal(map.code.size, 0);
  assert.equal(map.dataBytes, 1);
  assert.equal(map.matchedLines, 1);
});

test("shape 3 (space-separated .word) classifies its hex-column bytes as data via the whitespace class, not a literal tab", () => {
  const map = parseDumpListing(SHAPE3_WORD, { origin: 0x08b7, imageSize: 2 });
  assert.deepEqual([...map.data].sort((a, b) => a - b), [0x08b7, 0x08b8]);
  assert.equal(map.code.size, 0);
  assert.equal(map.dataBytes, 2);
  assert.equal(map.matchedLines, 1);
});

test("shape 4 (label-only line, blank byte column) contributes zero bytes and is never matched", () => {
  const listing = `${SHAPE4_LABEL_ONLY}\n${SHAPE1_INSTRUCTION}`;
  const map = parseDumpListing(listing, { origin: 0x0812, imageSize: 3 });
  assert.equal(map.matchedLines, 1, "only the real instruction line matched -- the label-only line contributed nothing");
  assert.equal(map.codeBytes, 3);
  assert.equal(map.covered.size, 3);
});

test("shape 5 (mid-instruction '= * + n' continuation line, blank byte column) contributes zero bytes and is never matched", () => {
  const listing = `${SHAPE1_INSTRUCTION}\n${SHAPE5_MID_INSTRUCTION}`;
  const map = parseDumpListing(listing, { origin: 0x0812, imageSize: 3 });
  assert.equal(map.matchedLines, 1);
  assert.equal(map.codeBytes, 3);
  assert.equal(map.covered.size, 3);
});

test("preamble line 1 ('.word $0801', no address column) contributes zero bytes and is never matched", () => {
  const listing = `${PREAMBLE_WORD_DIRECTIVE}\n${SHAPE1_INSTRUCTION}`;
  const map = parseDumpListing(listing, { origin: 0x0812, imageSize: 3 });
  assert.equal(map.matchedLines, 1);
  assert.equal(map.covered.size, 3);
});

test("preamble line 2 ('* = $0801', no address column) contributes zero bytes and is never matched", () => {
  const listing = `${PREAMBLE_ORIGIN_DIRECTIVE}\n${SHAPE1_INSTRUCTION}`;
  const map = parseDumpListing(listing, { origin: 0x0812, imageSize: 3 });
  assert.equal(map.matchedLines, 1);
  assert.equal(map.covered.size, 3);
});

test("an invented sixth line shape that emits fewer bytes than the declared image size throws this project's own named refusal, never dxa's exit status", () => {
  const listing = `${SHAPE1_INSTRUCTION}\n${SIXTH_SHAPE_UNSEEN_FORMAT}`;
  // shape1 alone accounts for 3 bytes; declaring imageSize=5 represents the
  // 2 bytes the sixth shape WOULD have contributed had this parser
  // recognized it -- it does not, so the total falls short and the parser
  // refuses by name.
  assertThrowsContaining(() => parseDumpListing(listing, { origin: 0x0812, imageSize: 5 }), [
    "covered=3",
    "expected=5",
    "matched 1 byte-emitting lines",
  ]);
});

test("an empty listing with a positive declared image size refuses by name", () => {
  assertThrowsContaining(() => parseDumpListing("", { origin: 0x0801, imageSize: 279 }), ["covered=0", "expected=279"]);
});

test("a single-line listing whose span exactly equals imageSize succeeds and returns that one classification", () => {
  const map = parseDumpListing(SHAPE1_INSTRUCTION, { origin: 0x0812, imageSize: 3 });
  assert.deepEqual([...map.code].sort((a, b) => a - b), [0x0812, 0x0813, 0x0814]);
  assert.equal(map.matchedLines, 1);
  assert.equal(map.covered.size, 3);
});

test("a non-positive or non-integer imageSize refuses BEFORE any line is read", () => {
  for (const bad of [0, -1, 1.5, Number.NaN]) {
    assertThrowsContaining(() => parseDumpListing(SHAPE1_INSTRUCTION, { origin: 0x0812, imageSize: bad }), [
      "imageSize must be a positive integer",
      `got ${bad}`,
    ]);
  }
});

test("CRLF line endings produce byte-identical results to LF endings, with no raw line carrying a trailing carriage return", () => {
  const window = { origin: 0x0801, imageSize: 279 };
  const lf = parseDumpListing(PHASE23_279_BYTE_FIXTURE, window);
  const crlf = parseDumpListing(PHASE23_279_BYTE_FIXTURE.split("\n").join("\r\n"), window);
  assert.deepEqual(crlf, lf);
  for (const line of crlf.lines) {
    assert.equal(line.raw.endsWith("\r"), false, `raw line carried a trailing CR: ${JSON.stringify(line.raw)}`);
  }
});

test("classification is independent of line order: the same lines fed in reverse produce identical code and data sets", () => {
  const window = { origin: 0x0801, imageSize: 279 };
  const forward = parseDumpListing(PHASE23_279_BYTE_FIXTURE, window);
  const reversedText = PHASE23_279_BYTE_FIXTURE.split("\n").reverse().join("\n");
  const reversed = parseDumpListing(reversedText, window);
  assert.deepEqual(reversed.code, forward.code);
  assert.deepEqual(reversed.data, forward.data);
  assert.equal(reversed.covered.size, forward.covered.size);
});

test("two touching same-class spans from different lines stay two separate rendered range entries, sorted ascending", () => {
  // 0x0810-0x0811 (SHAPE1_INSTRUCTION_PRECEDING) touches 0x0812-0x0814
  // (SHAPE1_INSTRUCTION) exactly -- one line ends where the next begins.
  const listing = `${SHAPE1_INSTRUCTION_PRECEDING}\n${SHAPE1_INSTRUCTION}`;
  const map = parseDumpListing(listing, { origin: 0x0810, imageSize: 5 });
  assert.equal(map.ranges.length, 2, JSON.stringify(map.ranges));
  assert.deepEqual(map.ranges[0], { class: "code", start: 0x0810, end: 0x0811 });
  assert.deepEqual(map.ranges[1], { class: "code", start: 0x0812, end: 0x0814 });
});

test("two same-class spans separated by one address stay two entries -- the address between them is never bridged", () => {
  // codeA (0x0810-0x0811) .. 1 data byte at 0x0812 .. codeB (0x0813-0x0814).
  // The single data byte in between proves range building cannot "close" a
  // one-address gap: doing so would require crossing the data/code
  // boundary, which the algorithm never does.
  const middleData = "0812 00       \t.byt $00";
  const codeB = "0813 a9 00    \tlda #$00";
  const listing = `${SHAPE1_INSTRUCTION_PRECEDING}\n${middleData}\n${codeB}`;
  const map = parseDumpListing(listing, { origin: 0x0810, imageSize: 5 });
  assert.equal(map.ranges.length, 3, JSON.stringify(map.ranges));
  const codeRanges = map.ranges.filter((r) => r.class === "code");
  assert.equal(codeRanges.length, 2, "the two code spans must stay two entries, not merge across the data byte");
  assert.deepEqual(codeRanges[0], { class: "code", start: 0x0810, end: 0x0811 });
  assert.deepEqual(codeRanges[1], { class: "code", start: 0x0813, end: 0x0814 });
});

test("Phase 23's rebuilt 279-byte fixture parses to the literal MEASURED totals from that phase's own committed transcript", () => {
  const map = parseDumpListing(PHASE23_279_BYTE_FIXTURE, { origin: 0x0801, imageSize: 279 });
  assert.equal(map.covered.size, 279, "PARSE_ACCOUNTED_BYTES (fixture-baseline.txt:230)");
  assert.equal(map.matchedLines, 125, "PARSE_MATCHED_LINES (fixture-baseline.txt:229)");
  assert.equal(map.codeBytes, 179, "PARSE_CODE_BYTES (fixture-baseline.txt:231)");
  assert.equal(map.dataBytes, 100, "PARSE_DATA_BYTES (fixture-baseline.txt:232)");
  assert.equal(map.firstAddress, 0x0801);
  assert.equal(map.lastAddress, 0x0917, "PARSE_ADDRESS_RANGE $0801-$0917 (fixture-baseline.txt:235)");
});

test("the module's source never uses a child process's exit status as the refusal signal, and never imports node:child_process", () => {
  const source = readFileSync(join(HERE, "dxa-listing.ts"), "utf8");
  assert.equal(/child_process/.test(source), false, "must never import or reference node:child_process");
  assert.equal(/exitStatus|exitCode/.test(source), false, "the refusal has one source -- the byte total -- never a spawned process's exit code");
});

// ============================================================================
// Task 2: the overlapping decode -- `unclassified` with a stated reason,
// never a winner
// ============================================================================

/** Two lines that DISAGREE on class, fully overlapping at one address
 * (0x3000): a 2-byte instruction (code, 0x3000-0x3001) and a 1-byte `.byt`
 * (data, 0x3000 only). 0x3001 stays code, non-overlapping. */
const OVERLAP_DISAGREE_CODE = "3000 a9 00    \tlda #$00";
const OVERLAP_DISAGREE_DATA = "3000 00       \t.byt $00";

/** Two lines that AGREE on class (both data), fully overlapping at one
 * address (0x4000). Different byte VALUES, same claimed class -- proves
 * agreement is not resolution. */
const OVERLAP_AGREE_A = "4000 11       \t.byt $11";
const OVERLAP_AGREE_B = "4000 22       \t.byt $22";

/** The `jsr`-into-a-mid-instruction-target case, built as two REAL `-a dump`
 * shaped lines with genuinely overlapping spans (not an abstract pair of
 * address ranges), so the test exercises the same regex and hex-column
 * length reading the production path uses. `jmpA` (3 bytes, code,
 * 0x5000-0x5002) and `jsrB` (3 bytes, code, one byte into jmpA,
 * 0x5001-0x5003): 0x5001 and 0x5002 overlap (unclassified), 0x5000 (jmpA
 * only) and 0x5003 (jsrB only) keep their own code classification. */
const JSR_MID_INSTRUCTION_JMP = "5000 4c 00 20 \tjmp $2000";
const JSR_MID_INSTRUCTION_JSR = "5001 20 71 08 \tjsr $0871";

test("two byte-emitting lines claiming the same address with DIFFERENT classes: neither class set gets it, unclassified gets it exactly once", () => {
  const listing = `${OVERLAP_DISAGREE_CODE}\n${OVERLAP_DISAGREE_DATA}`;
  const map = parseDumpListing(listing, { origin: 0x3000, imageSize: 2 });
  assert.equal(map.code.has(0x3000), false);
  assert.equal(map.data.has(0x3000), false);
  assert.equal(map.unclassified.size, 1);
  assert.ok(map.unclassified.has(0x3000));
  // The non-overlapping byte keeps its own classification.
  assert.ok(map.code.has(0x3001));
});

test("an unclassified entry's reason names both source lines verbatim and both claimed classes", () => {
  const listing = `${OVERLAP_DISAGREE_CODE}\n${OVERLAP_DISAGREE_DATA}`;
  const map = parseDumpListing(listing, { origin: 0x3000, imageSize: 2 });
  const entry = map.unclassified.get(0x3000)!;
  assert.ok(entry.reason.includes(OVERLAP_DISAGREE_CODE), entry.reason);
  assert.ok(entry.reason.includes(OVERLAP_DISAGREE_DATA), entry.reason);
  assert.ok(entry.reason.includes("code"), entry.reason);
  assert.ok(entry.reason.includes("data"), entry.reason);
  assert.equal(entry.claims.length, 2);
});

test("two byte-emitting lines claiming the same address with the SAME class are STILL unclassified -- agreement is not resolution", () => {
  const listing = `${OVERLAP_AGREE_A}\n${OVERLAP_AGREE_B}`;
  const map = parseDumpListing(listing, { origin: 0x4000, imageSize: 1 });
  assert.equal(map.data.has(0x4000), false);
  assert.equal(map.code.has(0x4000), false);
  assert.ok(map.unclassified.has(0x4000));
  const entry = map.unclassified.get(0x4000)!;
  assert.ok(entry.reason.includes(OVERLAP_AGREE_A), entry.reason);
  assert.ok(entry.reason.includes(OVERLAP_AGREE_B), entry.reason);
});

test("an overlapping listing whose distinct in-window coverage equals the declared image size does NOT throw -- unclassified counts toward coverage exactly once", () => {
  const listing = `${OVERLAP_DISAGREE_CODE}\n${OVERLAP_DISAGREE_DATA}`;
  // Distinct addresses: 0x3000 (unclassified) + 0x3001 (code) = 2, matching
  // imageSize exactly, even though codeBytes+dataBytes (raw emissions) sum
  // to 3 (2 from the instruction, 1 from the .byt).
  const map = parseDumpListing(listing, { origin: 0x3000, imageSize: 2 });
  assert.equal(map.covered.size, 2);
  assert.equal(map.codeBytes + map.dataBytes, 3, "raw emission counts may exceed distinct coverage under an overlap");
});

test("a short overlapping listing still throws, reporting the unclassified count alongside the accounted total", () => {
  const listing = `${OVERLAP_DISAGREE_CODE}\n${OVERLAP_DISAGREE_DATA}`;
  assertThrowsContaining(() => parseDumpListing(listing, { origin: 0x3000, imageSize: 5 }), [
    "covered=2",
    "expected=5",
    "unclassified=1",
  ]);
});

test("the unclassified class participates in the rendered range list as its own class, sorted with the others and never merged into an adjacent code or data run", () => {
  const listing = `${OVERLAP_DISAGREE_CODE}\n${OVERLAP_DISAGREE_DATA}`;
  const map = parseDumpListing(listing, { origin: 0x3000, imageSize: 2 });
  assert.equal(map.ranges.length, 2, JSON.stringify(map.ranges));
  assert.deepEqual(map.ranges[0], { class: "unclassified", start: 0x3000, end: 0x3000 });
  assert.deepEqual(map.ranges[1], { class: "code", start: 0x3001, end: 0x3001 });
});

test("jsr landing one byte into a three-byte instruction: the overlapping bytes are unclassified and each line's non-overlapping bytes keep their own classification", () => {
  const listing = `${JSR_MID_INSTRUCTION_JMP}\n${JSR_MID_INSTRUCTION_JSR}`;
  const map = parseDumpListing(listing, { origin: 0x5000, imageSize: 4 });
  // jmpA: 0x5000-0x5002. jsrB: 0x5001-0x5003. Overlap: 0x5001, 0x5002.
  assert.equal(map.unclassified.size, 2, JSON.stringify([...map.unclassified.keys()]));
  assert.ok(map.unclassified.has(0x5001));
  assert.ok(map.unclassified.has(0x5002));
  // Non-overlapping bytes of each line keep their own code classification --
  // a disposition that swallowed the whole line would fail this.
  assert.ok(map.code.has(0x5000), "jmpA's own non-overlapping byte must stay code");
  assert.ok(map.code.has(0x5003), "jsrB's own non-overlapping byte must stay code");
  assert.equal(map.code.size, 2);
  assert.equal(map.covered.size, 4);
});

test("source contains no sorting, comparison or precedence rule between the code and data classes -- no tie-break of any kind", () => {
  // Comment lines are excluded -- this module's own DOCS name the absence
  // of a tie-break rule explicitly (the word "tie-break" legitimately
  // appears in prose saying there isn't one). The check is about actual
  // CODE: an executable comparison, priority table or first/last-wins rule
  // between the two classes, which would appear outside a `//`/`*` line.
  const source = readFileSync(join(HERE, "dxa-listing.ts"), "utf8");
  const codeOnly = source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n")
    .toLowerCase();
  for (const forbidden of ["codebeatsdata", "firstwins", "lastwins", "longestspanwins", "tie-break", "tiebreak", "priority"]) {
    assert.equal(codeOnly.includes(forbidden), false, `must not contain a tie-break signal in executable code: ${forbidden}`);
  }
});

test("the unclassified disposition reaches the returned structure and the range renderer, not only an internal variable", () => {
  const source = readFileSync(join(HERE, "dxa-listing.ts"), "utf8");
  assert.ok(/return \{[^}]*unclassified/s.test(source), "unclassified must appear in the return statement");
  assert.ok(/unclassified["']/.test(source), "unclassified must appear as a range class literal");
});
