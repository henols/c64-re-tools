// The leftovers of c64-provenance: text in PETSCII and screen codes, BASIC
// lines away from the BASIC start, fills, untouched bytes outside code,
// copies, and code that nothing reaches and nothing ran.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { COVERAGE } from "../../src/c64.ts";
import { findBasic, findCopies, findFills, findLeftovers, findText } from "../../skills/c64-provenance/scripts/lib/leftovers.ts";
import { separate } from "../../skills/c64-provenance/scripts/lib/separate.ts";
import { seededBytes } from "../kit.ts";
import { importCoverage, importImage } from "../fixtures/program.ts";

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

const provenance = resolve(import.meta.dirname, "../../skills/c64-provenance/scripts/provenance.ts");
const script = (path: string, args: string[], cwd: string) => spawnSync(process.execPath, [...process.execArgv, path, ...args], { cwd, encoding: "utf8" });

/** PETSCII bytes of upper-case text, as the C64 shows them after a reset. */
const petscii = (text: string) => [...text].map((character) => character.charCodeAt(0));
/** Screen codes of text in the first character set: A-Z are $01-$1a. */
const screen = (text: string) => [...text].map((character) => (character >= "A" && character <= "Z" ? character.charCodeAt(0) - 0x40 : character.charCodeAt(0)));

test("text in PETSCII, in the second character set, in screen codes and reversed, with assembler source marked", () => {
  const memory = new Uint8Array(0x10000);
  memory.set(petscii("CRACKED BY THE GANG"), 0x1000);
  // "Hello World" in the second set: capitals are $c1-$da, small letters $41-$5a.
  memory.set([0xc8, 0x45, 0x4c, 0x4c, 0x4f, 0x20, 0xd7, 0x4f, 0x52, 0x4c, 0x44], 0x1100);
  memory.set(screen("GREETINGS TO ALL"), 0x1200);
  memory.set(screen("PRESS FIRE").map((code) => code | 0x80), 0x1300);
  memory.set(petscii("LDA #$00 STA $D020"), 0x1400);
  // Code: JSR $FFD2, LDA #$41, STA $0400,X, RTS.
  memory.set([0x20, 0xd2, 0xff, 0xa9, 0x41, 0x9d, 0x00, 0x04, 0x60], 0x1500);
  const found = findText(memory, [{ start: 0x1000, end: 0x15ff }]);
  assert.deepEqual(
    found.map((item) => [item.start, item.end, item.encoding, item.text, item.reversed ?? false, item.mnemonics ?? 0]),
    [
      [0x1000, 0x1012, "petscii", "CRACKED BY THE GANG", false, 0],
      [0x1100, 0x110a, "petscii", "Hello World", false, 0],
      [0x1200, 0x120f, "screen", "GREETINGS TO ALL", false, 0],
      [0x1300, 0x1309, "screen", "PRESS FIRE", true, 0],
      [0x1400, 0x1411, "petscii", "LDA #$00 STA $D020", false, 2],
    ],
  );
  assert.deepEqual(findText(memory, [{ start: 0x1000, end: 0x15ff }], 20).map((item) => item.start), [], "--min-text 20 keeps out the shorter texts");
});

test("text of other systems: ASCII, Apple II assembler source with bit 7 set, and PETSCII lines", () => {
  const memory = new Uint8Array(0x10000);
  const ascii = (text: string) => [...text].map((character) => character.charCodeAt(0));
  memory.set(ascii("Written on a PC by Somebody"), 0x1000);
  // Merlin source as the Apple II keeps it: bit 7 set, $8d ends a line, $20 spaces inside a comment.
  const merlin = (text: string) => [...text].map((character) => (character === "\n" ? 0x8d : character === "_" ? 0x20 : character.charCodeAt(0) | 0x80));
  memory.set(merlin("* CHAR_97\n DFB $F0,$C0,$00,$00\n DFB $3F,$FC,$F0,$03\n"), 0x1100);
  // A C64 text in shifted letters with shifted spaces ($a0).
  memory.set([0xd3, 0xc1, 0xc5, 0xc7, 0xc5, 0xd2, 0xa0, 0xd3, 0xcf, 0xc6, 0xd4], 0x1200);
  // PETSCII with RETURN: a line that is no source is a text of its own.
  memory.set([...petscii("FIRST LINE OF TEXT"), 0x0d, ...petscii("SECOND LINE HERE")], 0x1300);
  // Stray small letters at the edge of a PETSCII text do not make it ASCII.
  memory.set([0x76, 0x2d, 0x62, ...petscii("1 PLAYER GAME")], 0x1400);
  const found = findText(memory, [{ start: 0x1000, end: 0x14ff }]);
  assert.deepEqual(
    found.map((item) => [item.start, item.end, item.encoding, item.text, item.source ?? false]),
    [
      [0x1000, 0x101a, "ascii", "Written on a PC by Somebody", false],
      [0x1100, 0x1132, "high-bit", "* CHAR 97\n DFB $F0,$C0,$00,$00\n DFB $3F,$FC,$F0,$03", true],
      [0x1200, 0x120a, "high-bit", "SAEGER SOFT", false],
      [0x1300, 0x1311, "petscii", "FIRST LINE OF TEXT", false],
      [0x1313, 0x1322, "petscii", "SECOND LINE HERE", false],
      [0x1403, 0x140f, "petscii", "1 PLAYER GAME", false],
    ],
  );
});

test("random bytes and words in mixed case give no text", () => {
  const memory = new Uint8Array(0x10000);
  memory.set(seededBytes(0xc64, 0x4000), 0x4000);
  // "HeLLo WoRLd" in the second set: the case changes inside the words.
  memory.set([0xc8, 0x45, 0xcc, 0xcc, 0x4f, 0x20, 0xd7, 0x4f, 0xd2, 0xcc, 0x44], 0x3000);
  assert.deepEqual(findText(memory, [{ start: 0x3000, end: 0x300a }]), []);
  assert.ok(findText(memory, [{ start: 0x4000, end: 0x7fff }]).length <= 2, "16 KiB of random bytes read as text at most two times");
});

/** Two BASIC lines that BASIC linked at `linkedAt`: 10 PRINT"HI" and 20 GOTO 10, with the end mark. */
function basicLines(linkedAt: number): number[] {
  const first = [0x99, 0x22, 0x48, 0x49, 0x22];
  const second = [0x89, 0x31, 0x30];
  const next = linkedAt + 4 + first.length + 1;
  const end = next + 4 + second.length + 1;
  return [next & 0xff, next >> 8, 10, 0, ...first, 0, end & 0xff, end >> 8, 20, 0, ...second, 0, 0, 0];
}

test("BASIC lines away from the BASIC start, with the address where BASIC linked them", () => {
  const memory = new Uint8Array(0x10000);
  const lines = basicLines(0x0801);
  memory.set(lines, 0x0801);
  memory.set(lines, 0xc000);
  const found = findBasic(memory, [{ start: 0x0801, end: 0x08ff }, { start: 0xc000, end: 0xc0ff }], 0x0801);
  assert.deepEqual(found, [{ start: 0xc000, end: 0xc000 + lines.length - 1, linkedAt: 0x0801, lines: ['10 PRINT"HI"', "20 GOTO10"] }]);
  assert.equal(findBasic(memory, [{ start: 0x0801, end: 0x08ff }]).length, 1, "without a BASIC start, the lines at $0801 are a finding too");
});

test("fills of one byte and of a short pattern, copies of earlier bytes", () => {
  const memory = new Uint8Array(0x10000).fill(0x11, 0x2000, 0x3000);
  memory.set(seededBytes(7, 0x100), 0x2000);
  memory.fill(0x00, 0x2100, 0x2114); // 20 bytes
  for (let index = 0; index < 40; index++) memory[0x2200 + index] = index % 2 === 0 ? 0xaa : 0x55;
  memory.fill(0xff, 0x2300, 0x230a); // 10 bytes: too short
  memory.set(seededBytes(7, 0x100), 0x2400);
  const segments = [{ start: 0x2000, end: 0x24ff }];
  const fills = findFills(memory, segments).filter((fill) => fill.pattern[0] !== 0x11);
  assert.deepEqual(fills, [
    { start: 0x2100, end: 0x2113, pattern: [0x00] },
    { start: 0x2200, end: 0x2227, pattern: [0xaa, 0x55] },
  ]);
  assert.deepEqual(findCopies(memory, segments), [{ start: 0x2400, end: 0x24ff, copyOf: 0x2000 }]);
});

test("residue is untouched bytes without text and fill; dead code and the placement come from the separation", () => {
  const memory = new Uint8Array(0x10000);
  memory.set(seededBytes(3, 0x7f), 0x1000); // a zero ends the bytes before the text
  memory.set(petscii("VERSION 1.2 BY ME"), 0x1080);
  memory.fill(0x00, 0x10a0, 0x10c0);
  memory.set(seededBytes(5, 0x40), 0x10c0);
  const coverage = new Uint8Array(0x10000);
  coverage.fill(COVERAGE.ramRead, 0x1000, 0x1040);
  const segments = [{ start: 0x1000, end: 0x10ff }];
  const stages = [{ entry: 0x0810, wrote: [{ start: 0x1000, end: 0x10ff }] }];
  const separation = separate({ segments, memory, entry: 0x1000, stages, coverage, codeRegions: [{ start: 0x1000, end: 0x1003, type: "code" }, { start: 0x10f0, end: 0x10ff, type: "code" }], references: [] });
  const found = findLeftovers({ segments, memory, separation });
  assert.deepEqual(found.text.map((item) => [item.start, item.text, item.stages, item.access]), [[0x1080, "VERSION 1.2 BY ME", [0], ["untouched"]]]);
  // The zeros right after the text belong to the fill.
  assert.deepEqual(found.fill.map((item) => [item.start, item.end]), [[0x1091, 0x10bf]]);
  // The dead code at $10f0 has its own list, so residue stops before it.
  assert.deepEqual(found.residue.map((item) => [item.start, item.end]), [[0x1040, 0x107f], [0x10c0, 0x10ef]]);
  assert.deepEqual(found.deadCode, [{ start: 0x10f0, end: 0x10ff, type: "code", executed: false, stages: [0], access: ["untouched"] }]);
});

test("the leftovers command reads the program, its stages and the coverage from the knowledge and writes all findings to --out", () => {
  const root = mkdtempSync(join(tmpdir(), "c64-re-tools-leftovers-"));
  roots.push(root);
  const memory = new Uint8Array(0x10000);
  memory.set(seededBytes(9, 0x0f), 0x2000); // zeros around the texts, as strings usually have
  memory.set(petscii("CRACKED BY THE GANG"), 0x2010);
  memory.set(screen("GREETINGS TO ALL"), 0x2100);
  memory.set(petscii("VERSION 1.2 BY ME"), 0x2180);
  const stages = [{ stage: 0, entry: "$0810", wrote: [{ start: "$2000", end: "$20ff" }] }, { stage: 1, entry: "$2000", wrote: [{ start: "$2100", end: "$21ff" }] }];
  importImage(root, memory, { segments: [{ start: 0x2000, end: 0x21ff }], entry: 0x2000, stages });
  const coverage = new Uint8Array(0x10000);
  coverage[0x2000] = COVERAGE.ramExecute;
  importCoverage(root, { "cov.bin": coverage });

  const run = script(provenance, ["leftovers", "--out", ".c64-re-tools/local/leftovers.json", "--max-listed", "1"], root);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const result = JSON.parse(run.stdout) as Record<string, any>;
  assert.equal(result.entry, "$2000");
  assert.equal(result.stages, 2);
  assert.equal(result.noCoverage, undefined);
  assert.equal(result.text.count, 3);
  assert.deepEqual(result.text.listed, [{ start: "$2010", end: "$2022", encoding: "petscii", text: "CRACKED BY THE GANG", stages: [0], access: ["untouched"] }]);
  assert.ok(result.fill.count > 0);
  const all = JSON.parse(readFileSync(join(root, ".c64-re-tools/local/leftovers.json"), "utf8")) as Record<string, Array<Record<string, unknown>>>;
  assert.deepEqual(all.text!.map((item) => [item.start, item.encoding, item.stages]), [["$2010", "petscii", [0]], ["$2100", "screen", [1]], ["$2180", "petscii", [1]]]);
  assert.deepEqual(Object.keys(all), ["text", "basic", "fill", "residue", "copies", "deadCode"]);

  assert.equal(script(provenance, ["leftovers", "--min-text", "3"], root).status, 2);
  assert.equal(script(provenance, ["leftovers", "--batch", "x.json"], root).status, 2);
  assert.equal(script(provenance, ["leftovers", "image.json"], root).status, 2, "leftovers takes no release");
  const empty = mkdtempSync(join(tmpdir(), "c64-re-tools-leftovers-"));
  roots.push(empty);
  const none = script(provenance, ["leftovers"], empty);
  assert.equal(none.status, 2, "no program in the knowledge");
  assert.match(none.stdout, /knowledge\.ts image/);
});
