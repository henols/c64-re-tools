import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { WireFailure } from "../protocol.ts";
import { ACME, environmentValue, findOnPath, findTool, pathSuffixes } from "./discover.ts";

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

test("a tool is found through its variable, else on PATH", () => {
  // Windows starts only a file with a startable extension; elsewhere the bare name is the program.
  const acme = executable(process.platform === "win32" ? "acme.exe" : "acme");
  assert.equal(findTool(ACME, { C64RT_ACME: acme, PATH: "" }), acme);
  assert.equal(findTool(ACME, { PATH: scratch, PATHEXT: ".COM;.EXE;.BAT;.CMD" }), acme);
});

test("Windows looks for the startable PATHEXT extensions in their order, never for the bare name", () => {
  assert.deepEqual(pathSuffixes({ PATHEXT: ".COM;.EXE;.BAT;.CMD;.VBS;.JS" }, "win32"), [".com", ".exe", ".bat", ".cmd"]);
  assert.deepEqual(pathSuffixes({ PATHEXT: ".CMD;.EXE" }, "win32"), [".cmd", ".exe"]);
  assert.deepEqual(pathSuffixes({}, "win32"), [".com", ".exe", ".bat", ".cmd"]);
  assert.deepEqual(pathSuffixes({ PATHEXT: ".CMD" }, "linux"), [""]);

  const directory = join(scratch, "windows");
  mkdirSync(directory);
  executable(join("windows", "dxa"));
  const suffixes = pathSuffixes({}, "win32");
  assert.equal(findOnPath(["dxa"], { PATH: directory }, suffixes), undefined, "a file without an extension is not a Windows program");
  const shim = executable(join("windows", "dxa.cmd"));
  assert.equal(findOnPath(["dxa"], { PATH: directory }, suffixes), shim);
});

test("Windows reads PATH and PATHEXT whatever the case of their names", () => {
  assert.equal(environmentValue({ Path: "C:\\Tools" }, "PATH", "win32"), "C:\\Tools");
  assert.equal(environmentValue({ Path: "/opt/tools" }, "PATH", "linux"), undefined, "elsewhere the case of a name counts");
  assert.deepEqual(pathSuffixes({ PathExt: ".CMD;.EXE" }, "win32"), [".cmd", ".exe"]);

  const directory = join(scratch, "windows-path");
  mkdirSync(directory);
  const shim = executable(join("windows-path", "acme.cmd"));
  const env = { Path: directory, PathExt: ".CMD" };
  assert.equal(findOnPath(["acme"], env, pathSuffixes(env, "win32"), "win32"), shim);
});

test("a missing or wrongly configured tool is refused by name with the remedy", () => {
  assert.throws(() => findTool(ACME, { PATH: join(scratch, "empty") }), refused);
  assert.throws(() => findTool(ACME, { C64RT_ACME: "acme", PATH: scratch }), refused);
  assert.throws(() => findTool(ACME, { C64RT_ACME: join(scratch, "missing"), PATH: scratch }), refused);
});
