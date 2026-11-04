import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { isRefusal } from "../errors.ts";
import { checkOut } from "../host-client/transfer.ts";
import { writeOut } from "./output.ts";

const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-out-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
const project = join(scratch, "project");
const outside = join(scratch, "outside");
mkdirSync(join(project, ".c64-re-tools"), { recursive: true });
mkdirSync(outside);

const refused = (error: unknown) => isRefusal(error) && error.code === "invalid-input";

test("out writes the bytes to the absolute path of a project file, makes its directories, overwrites and gives the absolute path", () => {
  const first = writeOut(checkOut(join(project, "dumps", "..", "dumps", "ram.bin")), Buffer.from([1, 2, 3]));
  assert.deepEqual(first, { out: join(project, "dumps", "ram.bin"), bytes: 3, sha256: createHash("sha256").update(Buffer.from([1, 2, 3])).digest("hex") });
  writeOut(checkOut(join(project, "dumps", "ram.bin")), "text\n");
  assert.equal(readFileSync(join(project, "dumps", "ram.bin"), "utf8"), "text\n");
});

test("out refuses a path that leads out of the project through a symbolic link", { skip: process.platform === "win32" ? "symbolic links need extra rights on Windows" : false }, () => {
  symlinkSync(outside, join(project, "linked-dir"));
  assert.throws(() => writeOut(checkOut(join(project, "linked-dir", "x.bin")), "x"), refused);
  symlinkSync(join(outside, "target.bin"), join(project, "linked-file.bin"));
  assert.throws(() => writeOut(checkOut(join(project, "linked-file.bin")), "x"), refused);
});
