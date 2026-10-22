// Two versions of one program in a group folder: v2 is v1 with a fix that
// makes a routine longer, so the routines after it move. The scripts run from
// the group folder with --project and from inside a version. v2 reads v1 to
// compare the versions, gets the names of v1 from the library of the group,
// and records a second release with a one-byte fix at the same layout. No
// script makes a project of the group folder.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { readEnvelope } from "../kit.ts";

const skills = resolve(import.meta.dirname, "../../skills");
const repository = realpathSync(mkdtempSync(join(tmpdir(), "c64-re-tools-versions-")));
after(() => rmSync(repository, { recursive: true, force: true }));
const group = join(repository, "game");

/** Runs a skill script in `cwd` (the group folder by default), as the agent does, and gives its exit status and its JSON line. */
function script(skill: string, file: string, args: readonly string[], cwd = group): { status: number | null; json: Record<string, any> } {
  const run = spawnSync(process.execPath, [...process.execArgv, join(skills, skill, "scripts", file), ...args], { cwd, encoding: "utf8", env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });
  assert.equal(run.stderr, "", run.stderr);
  const { json } = readEnvelope(run.stdout, run.status);
  return { status: run.status, json: json as Record<string, any> };
}

function ok(skill: string, file: string, args: readonly string[], cwd = group): Record<string, any> {
  const run = script(skill, file, args, cwd);
  assert.equal(run.status, 0, `${file} ${args.join(" ")}: ${JSON.stringify(run.json)}`);
  return run.json;
}

function refused(skill: string, file: string, args: readonly string[], message: RegExp, cwd = group): void {
  const run = script(skill, file, args, cwd);
  assert.equal(run.status, 2, JSON.stringify(run.json));
  assert.equal(run.json.error.code, "invalid-input");
  assert.match(run.json.error.message, message);
}

/** The routine at `base`: a loop to the SID over a table of the routine, a call, and the table address as two immediates. */
function routineBytes(base: number): number[] {
  const table = base + 0x20;
  const pointer = base + 0x14;
  return [
    0xa2, 0x00, 0xbd, table & 0xff, table >> 8, 0x9d, 0x00, 0xd4, 0xe8, 0xe0, 0x07, 0xd0, 0xf5,
    0x20, pointer & 0xff, pointer >> 8, 0xa5, 0xfb, 0x60, 0xea,
    0xa9, table & 0xff, 0xa0, table >> 8, 0x60,
    0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea,
    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
  ];
}

/** The program at $1000: a start that calls the routine, filler, then the routine. The fix of v2 also sets the border colour: 5 bytes more. */
function program(fixed: boolean, border = 0x01): Uint8Array {
  const play = fixed ? 0x1015 : 0x1010;
  const start = [0x20, play & 0xff, play >> 8, ...(fixed ? [0xa9, border, 0x8d, 0x20, 0xd0] : []), 0x60];
  const bytes = [...start, ...Array.from({ length: play - 0x1000 - start.length }, () => 0xea), ...routineBytes(play)];
  return Uint8Array.from([0x00, 0x10, ...bytes]);
}

test("two versions in a group folder: each script runs on its version, v2 reads v1, and the library of the group carries the names", () => {
  mkdirSync(join(repository, ".git"));
  for (const version of ["v1", "v2"]) mkdirSync(join(group, version), { recursive: true });
  writeFileSync(join(group, "v1", "game.prg"), program(false));
  writeFileSync(join(group, "v2", "game.prg"), program(true));
  writeFileSync(join(group, "v2", "game_fix.prg"), program(true, 0x02));

  // v1: the folder becomes a project at its first write, from the group folder.
  ok("c64-knowledge", "knowledge.ts", ["image", "game.prg", "--project", "v1"]);
  const named = [
    { op: "classify", start: "$1010", end: "$1023", type: "code" },
    { op: "classify", start: "$1024", end: "$1028", type: "code" },
    { op: "rename", address: "$1010", name: "play", kind: "routine" },
    { op: "rename", address: "$1024", name: "set_pointer", kind: "routine" },
    { op: "rename", address: "$1030", name: "voice_table", kind: "data" },
    { op: "operand", address: "$1024", select: "lo", symbol: "voice_table" },
    { op: "operand", address: "$1026", select: "hi", symbol: "voice_table" },
    { op: "module", start: "$1010", file: "sound.asm", title: "The sound driver" },
  ];
  writeFileSync(join(group, "v1", "named.json"), JSON.stringify(named));
  ok("c64-knowledge", "knowledge.ts", ["apply", "named.json", "--reason", "the sound driver", "--project", "v1"]);

  // The library of the group is beside the versions. --library is relative to the project folder: "library" names a folder in v1.
  refused("c64-provenance", "provenance.ts", ["routine", "$1010", "--library", "library", "--project", "v1"], /there is no library folder library in the project folder.*Give a library folder beside the projects, for example \.\.\/library\./);
  assert.equal(existsSync(join(group, "v1", "library")), false);
  ok("c64-provenance", "provenance.ts", ["routine", "$1010", "--library", "../library", "--project", "v1"]);
  assert.deepEqual(readdirSync(join(group, "library")), ["play.json"]);

  // v2, from inside its folder: the program and its second release with the one-byte fix.
  ok("c64-knowledge", "knowledge.ts", ["image", "game.prg", "--project", "."], join(group, "v2"));
  ok("c64-knowledge", "knowledge.ts", ["release", "BASE", "--file", "game.prg", "--base"], join(group, "v2"));
  ok("c64-knowledge", "knowledge.ts", ["release", "FIX", "--file", "game_fix.prg"], join(group, "v2"));
  const releases = ok("c64-provenance", "provenance.ts", ["compare", "game.prg", "game_fix.prg", "--project", "v2"]);
  assert.deepEqual({ differing: releases.differingBytes, at: releases.differences[0].start }, { differing: 1, at: "$1004" });

  // v2 reads v1 in the group folder: the versions differ from the fix on, and the routine moved by 5 bytes.
  const versions = ok("c64-provenance", "provenance.ts", ["compare", "../v1/game.prg", "game.prg", "--project", "v2"]);
  assert.equal(versions.releases[0].name, "../v1/game.prg");
  assert.ok(versions.differingBytes > 1);
  // A release stays in its project: the knowledge does not name a file of another version.
  refused("c64-knowledge", "knowledge.ts", ["release", "V1", "--file", "../v1/game.prg", "--project", "v2"], /--file must be a path relative to the project folder that stays inside it/);

  // The names of v1 go to v2 through the library, at the moved addresses.
  const matched = ok("c64-provenance", "provenance.ts", ["match", "--library", "../library", "--apply", "--project", "v2"]);
  assert.deepEqual(matched.matches.listed.map((match: Record<string, unknown>) => ({ routine: match.routine, start: match.start, shift: match.shift })), [{ routine: "play", start: "$1015", shift: 5 }]);
  assert.equal(ok("c64-knowledge", "knowledge.ts", ["at", "$1029", "--project", "v2"]).symbol.name, "set_pointer");
  assert.equal(ok("c64-knowledge", "knowledge.ts", ["at", "$1024"], join(group, "v1")).symbol.name, "set_pointer");

  // The scripts ran from the group folder, and none of them made it a project.
  assert.equal(existsSync(join(group, ".c64-re-tools")), false);
});
