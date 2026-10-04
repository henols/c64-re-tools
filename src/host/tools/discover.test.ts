import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { WireFailure } from "../../protocol.ts";
import { ACME, findTool } from "./discover.ts";

const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-discover-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

function executable(name: string): string {
  const path = join(scratch, name);
  writeFileSync(path, "");
  chmodSync(path, 0o755);
  return path;
}

const refused = (error: unknown) =>
  error instanceof WireFailure && error.code === "installation-incomplete" && /ACME/.test(error.message) && /C64RT_ACME/.test(error.message);

test("a tool is found through its variable, else on PATH", { skip: process.platform === "win32" }, () => {
  const acme = executable("acme");
  assert.equal(findTool(ACME, { C64RT_ACME: acme, PATH: "" }), acme);
  assert.equal(findTool(ACME, { PATH: scratch }), acme);
});

test("a missing or wrongly configured tool is refused by name with the remedy", () => {
  assert.throws(() => findTool(ACME, { PATH: join(scratch, "empty") }), refused);
  assert.throws(() => findTool(ACME, { C64RT_ACME: "acme", PATH: scratch }), refused);
  assert.throws(() => findTool(ACME, { C64RT_ACME: join(scratch, "missing"), PATH: scratch }), refused);
});
