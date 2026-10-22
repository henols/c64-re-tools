// The retro-static-analysis script with a fake dxa that prints a fixed listing:
// how conflicts are shown, and what a refused import leaves behind. No DXA
// or Ghidra needed.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { after, test } from "node:test";

import { openForWrite } from "../../src/knowledge/database.ts";
import { classifyRegion } from "../../src/knowledge/write.ts";
import { addCoverage, setImage } from "../../src/knowledge/program.ts";
import { COVERAGE } from "../../src/cpu/coverage.ts";
import { nthIn } from "../../src/knowledge/revisions.testkit.ts";
import { readEnvelope, type ScriptEnvelope } from "../kit.ts";

const script = resolve(import.meta.dirname, "../../skills/retro-static-analysis/scripts/static-analysis.ts");
const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-fake-dxa-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

// A PRG at $1000: LDA #$00, RTS, then two data bytes.
const prg = Buffer.from([0x00, 0x10, 0xa9, 0x00, 0x60, 0x01, 0x02]);
const LISTING = ["1000 start:", "1000 a9 00 \tlda #$00", "1002 60 \trts", "1003 table:", "1003 01 02 \t.byt $01,$02", ""];

/** A dxa that prints `lines` as its listing. */
function fakeDxa(name: string, lines: string[]): string {
  const fake = join(scratch, `${name}.ts`);
  writeFileSync(fake, `#!/usr/bin/env node\nprocess.stdout.write(${JSON.stringify(lines.join("\n"))});\n`);
  chmodSync(fake, 0o755);
  // Windows starts no script by its shebang: a .cmd file runs it through Node.
  if (process.platform !== "win32") return fake;
  const program = join(scratch, `${name}.cmd`);
  writeFileSync(program, `@"${process.execPath}" "${fake}" %*\r\n`);
  return program;
}

/** A project with the PRG as its program in the knowledge: the image is revision 1. */
function project(name: string, space = "c64"): string {
  const root = join(scratch, name);
  mkdirSync(root);
  const db = openForWrite(root);
  setImage(db, { origin: "user" }, { space, segments: [{ start: 0x1000, end: 0x1004 }], byteAt: (address) => prg[address - 0x1000 + 2]! });
  db.close();
  return root;
}

async function analyze(root: string, dxa: string, ...args: string[]): Promise<{ status: number | null; json: Record<string, unknown>; envelope: ScriptEnvelope }> {
  const child = spawn(process.execPath, [...process.execArgv, script, "analyze", "--analyzer", "dxa", ...args], {
    cwd: root,
    env: { ...process.env, C64RT_DXA: dxa, C64RT_HOST: "127.0.0.1:1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  assert.equal(stderr, "");
  return { status, ...readEnvelope(stdout, status) };
}

test("an accepted DXA import records the findings, writes the listing, and names a conflict with what DXA found under the key dxa", { timeout: 60_000 }, async () => {
  const root = project("conflict");
  const db = openForWrite(root);
  classifyRegion(db, { origin: "user" }, { start: 0x1000, end: 0x1002, type: "bytes" });
  db.close();
  const { status, json, envelope } = await analyze(root, fakeDxa("dxa-ok", LISTING), "--out-listing", "analysis/game.lst");
  assert.equal(status, 0, JSON.stringify(json));
  // The image is revision 1, the user's region revision 2.
  assert.equal(json.revision, nthIn(root, 3));
  assert.equal((json.listing as { out: string }).out, "analysis/game.lst");
  assert.equal(existsSync(join(root, "analysis", "game.lst")), true);
  assert.deepEqual(json.conflicts, [
    { range: { start: "$1000", end: "$1002" }, knowledge: { type: "bytes", origin: "user" }, dxa: { type: "code" }, problem: "code and data disagree" },
  ]);
  // The hint gives the task for a conflict, and names no other script.
  assert.match(envelope.hint ?? "", /^The analysis and the project knowledge disagree at each place in conflicts\. Find the correct answer in the emulator\./);
  assert.equal(envelope.nextAction, undefined);
});

test("a refused DXA import writes no revision and no listing", { timeout: 60_000 }, async () => {
  const root = project("refused");
  const twoNames = ["1000 start:", "1000 a9 00 \tlda #$00", "1002 start:", "1002 60 \trts", "1003 01 02 \t.byt $01,$02", ""];
  const { status, json } = await analyze(root, fakeDxa("dxa-two-names", twoNames), "--out-listing", "analysis/game.lst");
  assert.equal(status, 2, JSON.stringify(json));
  assert.equal((json.error as { code: string }).code, "invalid-input");
  assert.equal(readFileSync(join(root, ".c64-re-tools", "knowledge", "revisions.jsonl"), "utf8").trim().split("\n").length, 1, "only the image");
  assert.equal(existsSync(join(root, "analysis")), false);
});

test("an import refused because knowledge changed during the analysis tells to run the analysis again", { timeout: 60_000 }, async () => {
  const root = project("stale");
  // A dxa that writes knowledge while it runs, then prints its listing.
  const fake = join(scratch, "dxa-writes.ts");
  const module = (path: string) => JSON.stringify(pathToFileURL(resolve(import.meta.dirname, path)).href);
  writeFileSync(
    fake,
    [
      "#!/usr/bin/env node",
      `import { openForWrite } from ${module("../../src/knowledge/database.ts")};`,
      `import { renameSymbol } from ${module("../../src/knowledge/write.ts")};`,
      `const db = openForWrite(${JSON.stringify(root)});`,
      'renameSymbol(db, { origin: "user" }, { address: 0x1000, name: "main" });',
      "db.close();",
      `process.stdout.write(${JSON.stringify(LISTING.join("\n"))});`,
      "",
    ].join("\n"),
  );
  chmodSync(fake, 0o755);
  let program = fake;
  if (process.platform === "win32") {
    program = join(scratch, "dxa-writes.cmd");
    writeFileSync(program, `@"${process.execPath}" "${fake}" %*\r\n`);
  }
  const { status, json } = await analyze(root, program);
  assert.equal(status, 2, JSON.stringify(json));
  const error = json.error as { code: string; message: string };
  assert.equal(error.code, "stale-revision");
  assert.match(error.message, /Run the analysis again\.$/);
});

test("--space imports the findings into that space and leaves the C64 alone", { timeout: 60_000 }, async () => {
  const root = project("space", "drive8");
  const dxa = fakeDxa("dxa-space", LISTING);
  const run = await analyze(root, dxa, "--space", "drive8");
  assert.equal(run.status, 0, JSON.stringify(run.json));
  assert.equal(run.json.space, "drive8");
  const db = openForWrite(root);
  try {
    const spaces = db.prepare("SELECT DISTINCT space FROM current_analyzer_names").all() as Array<{ space: string }>;
    assert.deepEqual(spaces.map((row) => row.space), ["drive8"]);
  } finally {
    db.close();
  }
});

test("a macro candidate names no platform name of a ROM that the program does not use, as retro-source does", { timeout: 60_000 }, async () => {
  // $2000: LDA #$00, STA $7a, LDA #$30, STA $7b, RTS: set16 of TXTPTR ($7a), a name of the BASIC workspace.
  const bytes = [0xa9, 0x00, 0x85, 0x7a, 0xa9, 0x30, 0x85, 0x7b, 0x60];
  const listing = ["2000 start:", "2000 a9 00 \tlda #$00", "2002 85 7a \tsta $7a", "2004 a9 30 \tlda #$30", "2006 85 7b \tsta $7b", "2008 60 \trts", ""];
  const dxa = fakeDxa("dxa-set16", listing);
  const argsOf = async (covered: boolean) => {
    const root = join(scratch, `set16-${covered}`);
    mkdirSync(root);
    const db = openForWrite(root);
    setImage(db, { origin: "user" }, { segments: [{ start: 0x2000, end: 0x2008 }], byteAt: (address) => bytes[address - 0x2000]! });
    // A coverage map where only the program executed: no ROM is in use.
    const map = new Uint8Array(0x10000).fill(COVERAGE.ramExecute, 0x2000, 0x2009);
    if (covered) addCoverage(db, { origin: "user" }, { maps: [{ name: "runs/a/coverage.bin", bytes: map }] });
    db.close();
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
  const none = (skipped.json.idioms as { candidates: { macros: Record<string, unknown> } }).candidates.macros;
  assert.deepEqual([none.writes, none.skipped], [undefined, 1]);
  // An address that starts no candidate is named, and the candidates are written.
  const applied = await analyze(join(scratch, "set16-false"), dxa, "--apply-macros", "--skip", "$2002");
  assert.equal(applied.status, 0, JSON.stringify(applied.json));
  const macros = (applied.json.idioms as { candidates: { macros: Record<string, unknown> } }).candidates.macros;
  assert.deepEqual(macros.notCandidates, ["$2002"]);
  assert.equal(macros.writes, 2);
  assert.equal(typeof macros.revision, "string");
  assert.equal(applied.envelope.hint, "The project knowledge has the macro candidates now. Generate the source again.");
  // The use is in the knowledge now: the next analysis knows it.
  const again = await analyze(join(scratch, "set16-false"), dxa);
  assert.equal((again.json.idioms as { candidates: { macros: { known?: number } } }).candidates.macros.known, 1);
  // The coverage shows no ROM code executed: retro-source leaves TXTPTR out, so the candidate has the number.
  assert.deepEqual((await argsOf(true)).args, ["$7a", "$3000"]);
});
