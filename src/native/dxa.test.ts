import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { WireFailure } from "../protocol.ts";
import { analyze, dxaArguments, parseListing } from "./dxa.ts";
import { ProcessSupervisor } from "./processes.ts";

const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-dxa-test-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
const posixOnly = process.platform === "win32" ? "the stand-in dxa is a shell script" : false;

/** A stand-in dxa: a shell script with the given body. It runs in the request workspace. */
function standInDxa(name: string, body: string): NodeJS.ProcessEnv {
  const path = join(scratch, name);
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
  return { ...process.env, C64RT_DXA: path };
}

const context = (env: NodeJS.ProcessEnv) => ({ supervisor: new ProcessSupervisor(), signal: new AbortController().signal, env });
const PRG = Buffer.from([0x01, 0x08, 0x60]);
const SEEDS = { imageKind: "prg" as const, entryPoints: [], dataRanges: [], labels: [] };
const refusedWith = (message: string) => (error: unknown) => error instanceof WireFailure && error.code === "operation-failed" && error.message === message;

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

test("a .word line that dxa pads with spaces instead of a tab still counts (real listing)", () => {
  // Lines from dxa 0.1.5 on a 64 KiB image of a real game: the .word lines have no tab.
  const listing = [
    "0018          l18:",
    "0019          l19 = * + 1",
    "0018 00 00 00 	.byt $00,$00,$00",
    "001b          l1b:",
    "001b 02       	.byt $02",
    "001c          l1c:",
    "001d          l1d = * + 1",
    "001c 07 00      .word l7",
    "001e f3 00      .word lf3",
    "0020 a9 00    	lda #$00",
  ].join("\n");
  assert.deepEqual(parseListing(listing, 0x0018, 0x0021).regions, [
    { start: 0x0018, end: 0x001f, classification: "data" },
    { start: 0x0020, end: 0x0021, classification: "code" },
  ]);
});

test("a truncated, reordered or misplaced listing is refused", () => {
  const lines = LISTING.trimEnd().split("\n");
  assert.throws(() => parseListing(lines.slice(0, -1).join("\n"), 0x0801, 0x0827), /holds 3 bytes, but the next line is 4 bytes later/);
  assert.throws(() => parseListing(LISTING, 0x0800, 0x0827), /starts at \$0801/);
  assert.throws(() => parseListing(LISTING.replace("0824          l824:\n", ""), 0x0801, 0x0820), /runs past the end of the program/);
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

test("a dxa failure quotes the last output of dxa without the workspace path", { skip: posixOnly }, async () => {
  const env = standInDxa("dxa-fails", 'echo "dxa: cannot read $PWD/input/image.bin" >&2\nexit 2');
  await assert.rejects(analyze(SEEDS, PRG, context(env)), refusedWith("dxa could not analyze the program.\nThe last output of dxa:\n  dxa: cannot read input/image.bin"));
});

test("a rejected listing says what the check found and quotes the messages of dxa", { skip: posixOnly }, async () => {
  const env = standInDxa("dxa-no-listing", 'echo "; nothing here"\necho "dxa: odd input" >&2');
  await assert.rejects(
    analyze(SEEDS, PRG, context(env)),
    refusedWith("dxa returned an incomplete or inconsistent listing. Nothing was imported. The check found: the listing has no statements.\nThe last output of dxa:\n  dxa: odd input"),
  );
});

test("a label seed with a leading dot reaches dxa and comes back as a label", { skip: posixOnly }, async () => {
  const env = standInDxa("dxa-dot-label", "grep -qxF '.loop, 0x0801, 0x0000' labels.txt || exit 3\nprintf '0801          .loop:\\n0801 60       \\trts\\n'");
  const { result } = await analyze({ ...SEEDS, labels: [{ address: 0x0801, name: ".loop" }] }, PRG, context(env));
  assert.deepEqual(result.labels, [{ address: 0x0801, name: ".loop" }]);
});

test("a listing larger than the limit is refused with the limit", { skip: posixOnly }, async () => {
  const env = standInDxa("dxa-too-much", "head -c 9000000 /dev/zero | tr '\\0' a");
  await assert.rejects(analyze(SEEDS, PRG, context(env)), refusedWith("dxa printed a listing that is larger than 8 MiB. Nothing was imported."));
});

test("a request beyond the seed bounds is refused by name before dxa runs", async () => {
  const many = (count: number) => Array.from({ length: count }, (_, index) => index);
  const env = { PATH: "" };
  const refused = (message: string) => (error: unknown) => error instanceof WireFailure && error.code === "invalid-input" && error.message === message;
  await assert.rejects(analyze({ ...SEEDS, entryPoints: many(1025) }, PRG, context(env)), refused("The request has 1025 entry points. Give at most 1024 entry points."));
  await assert.rejects(analyze({ ...SEEDS, dataRanges: many(1025).map((start) => ({ start, end: start })) }, PRG, context(env)), refused("The request has 1025 data ranges. Give at most 1024 data ranges."));
  await assert.rejects(analyze({ ...SEEDS, labels: many(4097).map((address) => ({ address, name: "x" })) }, PRG, context(env)), refused("The request has 4097 labels. Give at most 4096 labels."));
});
