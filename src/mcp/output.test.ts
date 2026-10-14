import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { WireFailure } from "../protocol/messages.ts";
import { writeOut } from "./output.ts";

const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-out-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
const project = join(scratch, "project");
const outside = join(scratch, "outside");
mkdirSync(project);
mkdirSync(outside);

const refused = (error: unknown) => error instanceof WireFailure && error.code === "invalid-input";

test("out writes the bytes to a project file, makes its directories and overwrites", () => {
  const first = writeOut("dumps/ram.bin", Buffer.from([1, 2, 3]), project);
  assert.deepEqual(first, { out: "dumps/ram.bin", bytes: 3, sha256: createHash("sha256").update(Buffer.from([1, 2, 3])).digest("hex") });
  writeOut("dumps/ram.bin", "text\n", project);
  assert.equal(readFileSync(join(project, "dumps", "ram.bin"), "utf8"), "text\n");
});

test("out refuses a path outside the project, also through a symbolic link", { skip: process.platform === "win32" ? "symbolic links need extra rights on Windows" : false }, () => {
  for (const path of ["../escape.bin", join(outside, "abs.bin")]) assert.throws(() => writeOut(path, "x", project), refused, path);
  symlinkSync(outside, join(project, "linked-dir"));
  assert.throws(() => writeOut("linked-dir/x.bin", "x", project), refused);
  symlinkSync(join(outside, "target.bin"), join(project, "linked-file.bin"));
  assert.throws(() => writeOut("linked-file.bin", "x", project), refused);
});
