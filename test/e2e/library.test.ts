// A library of routines beside two projects of one workspace (D71). A
// routine is saved from program A, found in program B at another address with
// its own outside addresses, its names applied there, and the source of B is
// generated with those names and is identical to B.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { ACME, findTool } from "../../src/native/discover.ts";
import { readEnvelope, type ScriptEnvelope } from "../kit.ts";

let generateSkip: string | false = false;
try {
  findTool(ACME);
} catch {
  generateSkip = "ACME is not installed: the source of program B is not generated";
}

const skills = resolve(import.meta.dirname, "../../skills");
const workspace = realpathSync(mkdtempSync(join(tmpdir(), "c64-re-tools-library-")));
after(() => rmSync(workspace, { recursive: true, force: true }));

/** Runs a skill script at the workspace root, as the agent does, and gives its exit status and its JSON line. */
function script(skill: string, file: string, args: readonly string[]): { status: number | null; json: Record<string, any>; envelope: ScriptEnvelope } {
  const run = spawnSync(process.execPath, [...process.execArgv, join(skills, skill, "scripts", file), ...args], { cwd: workspace, encoding: "utf8", env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });
  assert.equal(run.stderr, "", run.stderr);
  const { envelope, json } = readEnvelope(run.stdout, run.status);
  return { status: run.status, json: json as Record<string, any>, envelope };
}

function ok(skill: string, file: string, args: readonly string[]): Record<string, any> {
  const run = script(skill, file, args);
  assert.equal(run.status, 0, `${file} ${args.join(" ")}: ${JSON.stringify(run.json)}`);
  return run.json;
}

/** The routine at `base`: a loop to the SID over a table of the routine, a call, a zero-page read, and the table address as two immediates. */
function routineBytes(base: number, sid: number): number[] {
  const table = base + 0x20;
  const pointer = base + 0x14;
  return [
    0xa2, 0x00, 0xbd, table & 0xff, table >> 8, 0x9d, sid & 0xff, sid >> 8, 0xe8, 0xe0, 0x07, 0xd0, 0xf5,
    0x20, pointer & 0xff, pointer >> 8, 0xa5, 0xfb, 0x60, 0xea,
    0xa9, table & 0xff, 0xa0, table >> 8, 0x60,
    0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea,
    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
  ];
}

const prg = (load: number, bytes: number[]) => Uint8Array.from([load & 0xff, load >> 8, ...bytes]);

test("a routine saved from program A is found in program B at another address, and its names make the source of B", { timeout: 600_000 }, (t) => {
  for (const name of ["game-a", "game-b"]) mkdirSync(join(workspace, name));
  writeFileSync(join(workspace, "game-a", "a.prg"), prg(0x1000, routineBytes(0x1000, 0xd400)));
  // Program B: 16 bytes of data, then the routine at $3000 with another SID register.
  writeFileSync(join(workspace, "game-b", "b.prg"), prg(0x2ff0, [...Array.from({ length: 16 }, (_, index) => index), ...routineBytes(0x3000, 0xd407)]));

  // Program A: the agent names the routine.
  const named = [
    { op: "classify", start: "$1000", end: "$1013", type: "code" },
    { op: "classify", start: "$1014", end: "$1018", type: "code" },
    { op: "classify", start: "$1020", end: "$1026", type: "bytes" },
    { op: "rename", address: "$1000", name: "play", kind: "routine" },
    { op: "rename", address: "$1014", name: "set_pointer", kind: "routine" },
    { op: "rename", address: "$1020", name: "voice_table", kind: "data" },
    { op: "comment", address: "$1014", placement: "line", text: "Point A/Y at the voice table at $1020 for the copy to $d400." },
    { op: "operand", address: "$1014", select: "lo", symbol: "voice_table" },
    { op: "operand", address: "$1016", select: "hi", symbol: "voice_table" },
    { op: "module", start: "$1000", file: "sound.asm", title: "The sound driver" },
  ];
  writeFileSync(join(workspace, "game-a", "named.json"), JSON.stringify(named));
  ok("c64-knowledge", "knowledge.ts", ["image", "a.prg", "--project", "game-a"]);
  ok("c64-knowledge", "knowledge.ts", ["apply", "named.json", "--reason", "the sound driver", "--project", "game-a"]);

  // The routine goes to the library beside the projects; --library is relative to the project folder.
  const saved = ok("c64-provenance", "provenance.ts", ["routine", "$1000", "--library", "../library", "--project", "game-a"]);
  assert.deepEqual({ routine: saved.routine, out: saved.out, start: saved.start, end: saved.end, length: saved.length }, { routine: "play", out: "../library/play.json", start: "$1000", end: "$1026", length: 39 });
  // The routine file shows as a written file: its size and SHA-256 are those of the file.
  const file = readFileSync(join(workspace, "library", "play.json"));
  assert.deepEqual({ bytes: saved.bytes, sha256: saved.sha256, file: saved.file }, { bytes: file.length, sha256: createHash("sha256").update(file).digest("hex"), file: undefined });
  assert.deepEqual(saved.counts, { symbols: 3, regions: 3, comments: 1, references: 0, operands: 2 });
  assert.match(readFileSync(join(workspace, "library", "play.json"), "utf8"), /"title": "The sound driver"/);
  assert.equal(script("c64-provenance", "provenance.ts", ["routine", "$1000", "--library", "../library", "--project", "game-a"]).json.error.code, "conflict");
  // The library is no project, and nothing is written at the workspace root.
  assert.deepEqual(readdirSync(join(workspace, "library")), ["play.json"]);
  assert.ok(!existsSync(join(workspace, ".c64-re-tools")));
  assert.equal(script("c64-provenance", "provenance.ts", ["match", "--library", "../game-a", "--project", "game-b"]).json.error.code, "invalid-input");

  // Program B: match finds the routine $2000 bytes higher, with the other SID register listed.
  ok("c64-knowledge", "knowledge.ts", ["image", "b.prg", "--project", "game-b"]);
  const matchRun = script("c64-provenance", "provenance.ts", ["match", "--library", "../library", "--project", "game-b"]);
  assert.equal(matchRun.status, 0, JSON.stringify(matchRun.json));
  const matched = matchRun.json;
  assert.deepEqual(matched.matches, { count: 1, listed: [{ routine: "play", start: "$3000", end: "$3026", shift: 0x2000, differing: [{ address: "$3005", library: "$d400", program: "$d407" }] }] });
  assert.deepEqual({ ...matched.changes, writes: matched.changes.writes.count }, { writes: 9, known: 0, leftOut: { count: 0, listed: [] }, check: { count: 1, listed: [{ routine: "play", address: "$3014", comment: "Point A/Y at the voice table at $3020 for the copy to $d400.", outside: ["$d400"] }] } });
  assert.deepEqual(matched.changes.writes.listed[0], { op: "rename", address: "$3000", name: "play", kind: "routine" });
  assert.match(matchRun.envelope.hint!, /Then nextAction writes the changes to the project knowledge\. Then examine changes\.check:/);
  assert.match(matchRun.envelope.nextAction!, / match --library \.\.\/library --apply /);
  assert.equal(ok("c64-knowledge", "knowledge.ts", ["at", "$3014", "--project", "game-b"]).symbol, undefined, "without --apply, match writes nothing");

  // With --apply, match writes the changes as one revision of the LLM.
  const applied = ok("c64-provenance", "provenance.ts", ["match", "--library", "../library", "--apply", "--project", "game-b"]);
  assert.equal(typeof applied.changes.revision, "string");
  const at = ok("c64-knowledge", "knowledge.ts", ["at", "$3014", "--project", "game-b"]);
  assert.equal(at.symbol.name, "set_pointer");
  assert.equal(at.symbol.origin, "llm");
  // The address in the comment moved with the routine.
  assert.deepEqual(at.comments.map((comment: { text: string }) => comment.text), ["Point A/Y at the voice table at $3020 for the copy to $d400."]);
  // A second match finds that B already has every name.
  const again = ok("c64-provenance", "provenance.ts", ["match", "--library", "../library", "--project", "game-b"]);
  assert.deepEqual(again.changes, { writes: { count: 0, listed: [] }, known: 9, leftOut: { count: 0, listed: [] }, check: { count: 0, listed: [] } });

  if (generateSkip !== false) {
    t.diagnostic(generateSkip);
    return;
  }
  const generated = ok("c64-source", "source.ts", ["generate", "--out", ".c64-re-tools/local/src", "--project", "game-b"]);
  assert.equal(generated.check.identical, true, JSON.stringify(generated.check));
  const source = (readdirSync(join(workspace, "game-b", ".c64-re-tools", "local", "src"), { recursive: true }) as string[])
    .filter((file) => file.endsWith(".asm"))
    .map((file) => readFileSync(join(workspace, "game-b", ".c64-re-tools", "local", "src", file), "utf8"))
    .join("\n");
  for (const line of [/^play$/m, /^set_pointer$/m, /^voice_table$/m, /lda #<voice_table/, /ldy #>voice_table/, /jsr set_pointer/, /Point A\/Y at the voice table at \$3020 for the copy to \$d400\./]) assert.match(source, line);
});
