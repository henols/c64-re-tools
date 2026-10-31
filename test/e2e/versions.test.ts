// Two versions of one program in a group folder: v2 is v1 with a fix that
// makes a routine longer, so the routines after it move. The scripts run from
// the group folder with --project and from inside a version. v2 reads v1 to
// compare the versions, gets the names of v1 from the library of the group,
// and records a second release with a one-byte fix at the same layout.

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { prg } from "../../src/c64.testkit.ts";
import { routineBytes } from "../fixtures/prg/routine.ts";
import { runScriptSync, scratchDir, skillScript } from "../kit.ts";
import { scriptBody } from "./kit.ts";

const repository = scratchDir("versions");
const group = join(repository, "game");

/** Runs a skill script in `cwd` (the group folder by default), as the agent does, and gives its body. */
const ok = (skill: string, file: string, args: readonly string[], cwd = group) => scriptBody(skill, file, args, { cwd });

/** Runs a skill script that must refuse the call as invalid-input with a message that matches `message`. */
function refused(skill: string, file: string, args: readonly string[], message: RegExp, cwd = group): void {
  const { json } = runScriptSync(skillScript(skill, file), args, { cwd });
  assert.equal(json.error?.code, "invalid-input", JSON.stringify(json));
  assert.match(json.error.message, message);
}

/** The program at $1000: a start that calls the routine, filler, then the routine. The fix of v2 also sets the border colour: 5 bytes more. */
function program(fixed: boolean, border = 0x01): Uint8Array {
  const play = fixed ? 0x1015 : 0x1010;
  const start = [0x20, play & 0xff, play >> 8, ...(fixed ? [0xa9, border, 0x8d, 0x20, 0xd0] : []), 0x60];
  return prg(0x1000, start, Array.from({ length: play - 0x1000 - start.length }, () => 0xea), routineBytes(play));
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
  assert.equal(ok("c64-knowledge", "knowledge.ts", ["at", "$1029", "--project", "v2"]).addresses[0].symbol.name, "set_pointer");
  assert.equal(ok("c64-knowledge", "knowledge.ts", ["at", "$1024"], join(group, "v1")).addresses[0].symbol.name, "set_pointer");
});
