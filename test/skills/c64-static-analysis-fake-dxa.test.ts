// The c64-static-analysis script with a fake dxa that prints a fixed listing:
// how conflicts are shown, and what a refused import leaves behind. No real DXA
// needed.

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";

import { withWrite } from "../../src/knowledge/database.ts";
import { classifyRegion } from "../../src/knowledge/write.ts";
import { addCoverage, setImage } from "../../src/knowledge/program.ts";
import { COVERAGE } from "../../src/c64.ts";
import { nthIn } from "../../src/knowledge/revisions.testkit.ts";
import { importPrg } from "../fixtures/program.ts";
import { runScript, scratchDir, skillScript } from "../kit.ts";
import { nodeStandIn } from "./node-stand-in.ts";

const script = skillScript("c64-static-analysis", "static-analysis.ts");
const scratch = scratchDir("fake-dxa");

// A PRG at $1000: LDA #$00, RTS, then two data bytes.
const prg = Buffer.from([0x00, 0x10, 0xa9, 0x00, 0x60, 0x01, 0x02]);
const LISTING = ["1000 start:", "1000 a9 00 \tlda #$00", "1002 60 \trts", "1003 table:", "1003 01 02 \t.byt $01,$02", ""];

/** A dxa that prints `lines` as its listing. */
function fakeDxa(name: string, lines: string[]): string {
  return nodeStandIn(scratch, name, `process.stdout.write(${JSON.stringify(lines.join("\n"))});\n`);
}

/** A project with the PRG as its program in the knowledge: the image is revision 1. */
function project(name: string, space = "c64"): string {
  const root = join(scratch, name);
  mkdirSync(root);
  importPrg(root, prg, space);
  return root;
}

function analyze(root: string, dxa: string, ...args: string[]) {
  return runScript(script, ["analyze", "--analyzer", "dxa", ...args], { cwd: root, env: { C64RT_DXA: dxa } });
}

test("an accepted DXA import records the findings, writes the listing, and names a conflict with what DXA found under the key dxa and the facts of its range", { timeout: 60_000 }, async () => {
  const root = project("conflict");
  withWrite((db) => classifyRegion(db, { origin: "user" }, { start: 0x1000, end: 0x1002, type: "bytes" }), root);
  // A run executed the LDA at $1000 and read $1001.
  const map = new Uint8Array(0x10000);
  map[0x1000] = COVERAGE.ramExecute;
  map[0x1001] = COVERAGE.ramRead;
  withWrite((db) => addCoverage(db, { origin: "user" }, { maps: [{ name: "runs/a/coverage.bin", bytes: map }] }), root);
  const { status, json, envelope } = await analyze(root, fakeDxa("dxa-ok", LISTING), "--out-listing", "analysis/game.lst");
  assert.equal(status, 0, JSON.stringify(json));
  // The image is revision 1, the user's region revision 2, the coverage revision 3.
  assert.equal(json.revision, nthIn(root, 4));
  assert.equal(json.listing.out, "analysis/game.lst");
  assert.equal(existsSync(join(root, "analysis", "game.lst")), true);
  assert.deepEqual(json.conflicts, [
    {
      range: { start: "$1000", end: "$1002" },
      knowledge: { type: "bytes", origin: "user" },
      dxa: { type: "code" },
      problem: "code and data disagree",
      access: { executed: 1, read: 1, written: 0 },
      references: { count: 0, listed: [] },
      reachable: true,
    },
  ]);
  // The hint gives the task for a conflict, and names no other script.
  assert.match(envelope.hint ?? "", /^The analysis and the project knowledge disagree at each place in conflicts\. Use access, references and reachable of each conflict\./);
  assert.equal(envelope.nextAction, undefined);
});

test("a refused DXA import writes no revision and no listing", { timeout: 60_000 }, async () => {
  const root = project("refused");
  const twoNames = ["1000 start:", "1000 a9 00 \tlda #$00", "1002 start:", "1002 60 \trts", "1003 01 02 \t.byt $01,$02", ""];
  const { status, json } = await analyze(root, fakeDxa("dxa-two-names", twoNames), "--out-listing", "analysis/game.lst");
  assert.equal(status, 2, JSON.stringify(json));
  assert.equal(json.error.code, "invalid-input");
  assert.equal(readFileSync(join(root, ".c64-re-tools", "knowledge", "revisions.jsonl"), "utf8").trim().split("\n").length, 1, "only the image");
  assert.equal(existsSync(join(root, "analysis")), false);
});

test("an import refused because knowledge changed during the analysis tells to run the analysis again", { timeout: 60_000 }, async () => {
  const root = project("stale");
  // A dxa that writes knowledge while it runs, then prints its listing.
  const module = (path: string) => JSON.stringify(pathToFileURL(resolve(import.meta.dirname, path)).href);
  const program = nodeStandIn(
    scratch,
    "dxa-writes",
    [
      `import { openForWrite } from ${module("../../src/knowledge/database.ts")};`,
      `import { renameSymbol } from ${module("../../src/knowledge/write.ts")};`,
      `const db = openForWrite(${JSON.stringify(root)});`,
      'renameSymbol(db, { origin: "user" }, { address: 0x1000, name: "main" });',
      "db.close();",
      `process.stdout.write(${JSON.stringify(LISTING.join("\n"))});`,
      "",
    ].join("\n"),
  );
  const { status, json } = await analyze(root, program);
  assert.equal(status, 2, JSON.stringify(json));
  assert.equal(json.error.code, "stale-revision");
  assert.match(json.error.message, /Run the analysis again\.$/);
});

test("--space imports the findings into that space and leaves the C64 alone", { timeout: 60_000 }, async () => {
  const root = project("space", "drive8");
  const dxa = fakeDxa("dxa-space", LISTING);
  const run = await analyze(root, dxa, "--space", "drive8");
  assert.equal(run.status, 0, JSON.stringify(run.json));
  assert.equal(run.json.space, "drive8");
  const spaces = withWrite((db) => db.prepare("SELECT DISTINCT space FROM current_analyzer_names").all() as Array<{ space: string }>, root);
  assert.deepEqual(spaces.map((row) => row.space), ["drive8"]);
});

test("a macro candidate names no platform name of a ROM that the program does not use, as c64-source does", { timeout: 60_000 }, async () => {
  // $2000: LDA #$00, STA $7a, LDA #$30, STA $7b, RTS: set16 of TXTPTR ($7a), a name of the BASIC workspace.
  const bytes = [0xa9, 0x00, 0x85, 0x7a, 0xa9, 0x30, 0x85, 0x7b, 0x60];
  const listing = ["2000 start:", "2000 a9 00 \tlda #$00", "2002 85 7a \tsta $7a", "2004 a9 30 \tlda #$30", "2006 85 7b \tsta $7b", "2008 60 \trts", ""];
  const dxa = fakeDxa("dxa-set16", listing);
  const argsOf = async (covered: boolean) => {
    const root = join(scratch, `set16-${covered}`);
    mkdirSync(root);
    withWrite((db) => {
      setImage(db, { origin: "user" }, { segments: [{ start: 0x2000, end: 0x2008 }], byteAt: (address) => bytes[address - 0x2000]! });
      // A coverage map where only the program executed: no ROM is in use.
      const map = new Uint8Array(0x10000).fill(COVERAGE.ramExecute, 0x2000, 0x2009);
      if (covered) addCoverage(db, { origin: "user" }, { maps: [{ name: "runs/a/coverage.bin", bytes: map }] });
    }, root);
    const { status, json, envelope } = await analyze(root, dxa);
    assert.equal(status, 0, JSON.stringify(json));
    const found = JSON.stringify(json).match(/"macro":"set16","start":"\$2000","end":"\$2007","args":(\[[^\]]*\])/);
    return { args: found === null ? undefined : (JSON.parse(found[1]!) as string[]), hint: envelope.hint };
  };
  // Without coverage or entry state, the program uses both ROMs: TXTPTR names the address.
  const shown = await argsOf(false);
  assert.deepEqual(shown.args, ["TXTPTR", "$3000"]);
  // Without --apply-macros, the hint tells how to write the candidates; with it, the macro and its use are one revision.
  assert.equal(shown.hint, "Examine idioms.candidates.macros. To write them to the project knowledge, run the analysis again with --apply-macros.");
  // --skip leaves a wrong candidate out: no use and no macro is written.
  const skipped = await analyze(join(scratch, "set16-false"), dxa, "--apply-macros", "--skip", "$2000");
  const none = skipped.json.idioms.candidates.macros;
  assert.deepEqual([none.writes, none.skipped], [undefined, 1]);
  // An address that starts no candidate is named, and the candidates are written.
  const applied = await analyze(join(scratch, "set16-false"), dxa, "--apply-macros", "--skip", "$2002");
  assert.equal(applied.status, 0, JSON.stringify(applied.json));
  const macros = applied.json.idioms.candidates.macros;
  assert.deepEqual(macros.notCandidates, ["$2002"]);
  assert.equal(macros.writes, 2);
  assert.equal(typeof macros.revision, "string");
  assert.equal(applied.envelope.hint, "The project knowledge has the macro candidates now. Generate the source again.");
  // The use is in the knowledge now: the next analysis knows it.
  const again = await analyze(join(scratch, "set16-false"), dxa);
  assert.equal(again.json.idioms.candidates.macros.known, 1);
  // The coverage shows no ROM code executed: c64-source leaves TXTPTR out, so the candidate has the number.
  assert.deepEqual((await argsOf(true)).args, ["$7a", "$3000"]);
});
