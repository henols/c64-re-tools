import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { WireFailure } from "../protocol.ts";
import { readProjectFile, readProjectTree } from "./transfer.ts";

const sandbox = mkdtempSync(join(tmpdir(), "c64-re-tools-transfer-"));
const project = join(sandbox, "project");
mkdirSync(join(project, "original"), { recursive: true });
writeFileSync(join(project, "original", "Game.D64"), Buffer.from([1, 2, 3]));
writeFileSync(join(project, "noext"), Buffer.from([9]));
writeFileSync(join(sandbox, "outside.prg"), Buffer.from([7]));
symlinkSync(join(sandbox, "outside.prg"), join(project, "escape.prg"));
after(() => rmSync(sandbox, { recursive: true, force: true }));

const failsWith = (code: string) => (error: unknown) => error instanceof WireFailure && error.code === code;

test("a project file is read as bytes with its lowercase extension as type", () => {
  assert.deepEqual(readProjectFile("original/Game.D64", { root: project }), { bytes: Buffer.from([1, 2, 3]), type: "d64" });
  assert.deepEqual(readProjectFile("noext", { root: project }), { bytes: Buffer.from([9]), type: "" });
});

test("paths outside the project, missing files, directories and large files are refused", () => {
  assert.throws(() => readProjectFile("missing.prg", { root: project }), failsWith("not-found"));
  assert.throws(() => readProjectFile(join(project, "noext"), { root: project }), failsWith("invalid-input"));
  assert.throws(() => readProjectFile("../outside.prg", { root: project }), failsWith("invalid-input"));
  assert.throws(() => readProjectFile("escape.prg", { root: project }), failsWith("invalid-input"));
  assert.throws(() => readProjectFile("original", { root: project }), failsWith("invalid-input"));
  assert.throws(() => readProjectFile("original/Game.D64", { root: project, maxBytes: 2 }), failsWith("limit-exceeded"));
});

test("a source tree is read with relative paths, inner links followed and VCS directories skipped", () => {
  const tree = join(project, "src");
  mkdirSync(join(tree, "lib"), { recursive: true });
  mkdirSync(join(tree, ".git"), { recursive: true });
  writeFileSync(join(tree, "main.a"), "main");
  writeFileSync(join(tree, "lib", "consts.a"), "consts");
  writeFileSync(join(tree, ".git", "HEAD"), "ref");
  symlinkSync(join(tree, "lib", "consts.a"), join(tree, "alias.a"));
  const read = readProjectTree("src", { root: project });
  assert.deepEqual(read.files, [
    { path: "alias.a", size: 6 },
    { path: "lib/consts.a", size: 6 },
    { path: "main.a", size: 4 },
  ]);
  assert.deepEqual(read.contents.map(String), ["consts", "consts", "main"]);
});

test("a link out of the source root is refused, as is a missing or plain-file root", () => {
  const tree = join(project, "escape");
  mkdirSync(tree);
  symlinkSync(join(project, "noext"), join(tree, "outside.a"));
  assert.throws(() => readProjectTree("escape", { root: project }), failsWith("invalid-input"));
  assert.throws(() => readProjectTree("nope", { root: project }), failsWith("not-found"));
  assert.throws(() => readProjectTree("noext", { root: project }), failsWith("invalid-input"));
});

test("a linked project file takes its type from the given path, not from the link target", () => {
  mkdirSync(join(project, "images"));
  writeFileSync(join(project, "images", "abc"), Buffer.from([4]));
  symlinkSync(join(project, "images", "abc"), join(project, "linked.d64"));
  assert.deepEqual(readProjectFile("linked.d64", { root: project }), { bytes: Buffer.from([4]), type: "d64" });
});

test("a directory link to the source root or to an ancestor in it is refused as a loop", () => {
  const tree = join(project, "loop");
  mkdirSync(join(tree, "inner"), { recursive: true });
  writeFileSync(join(tree, "main.a"), "main");
  symlinkSync(tree, join(tree, "inner", "back"), "junction");
  assert.throws(
    () => readProjectTree("loop", { root: project }),
    (error: unknown) => error instanceof WireFailure && error.code === "invalid-input" && /back points at a directory that contains it/.test(error.message),
  );
  const self = join(project, "self");
  mkdirSync(self);
  symlinkSync(self, join(self, "again"), "junction");
  assert.throws(() => readProjectTree("self", { root: project }), failsWith("invalid-input"));
});

test("a directory link to a sibling directory in the source root is followed", () => {
  const tree = join(project, "shared");
  mkdirSync(join(tree, "common"), { recursive: true });
  writeFileSync(join(tree, "common", "macros.a"), "macros");
  symlinkSync(join(tree, "common"), join(tree, "alias"), "junction");
  assert.deepEqual(readProjectTree("shared", { root: project }).files, [
    { path: "alias/macros.a", size: 6 },
    { path: "common/macros.a", size: 6 },
  ]);
});
