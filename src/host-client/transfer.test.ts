import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { WireFailure } from "../protocol.ts";
import { readProjectFile } from "./transfer.ts";

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
