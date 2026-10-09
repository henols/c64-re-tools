import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { delimiter, resolve } from "node:path";
import { test } from "node:test";

// Each program runs as npm links it: the file itself, started through its
// shebang, with tsx on the PATH. Windows has no shebangs, so there Node runs
// the entry point.
const root = resolve(import.meta.dirname, "../..");
const programs = (JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as { bin: Record<string, string> }).bin;
const PATH = [resolve(root, "node_modules", ".bin"), process.env.PATH ?? ""].join(delimiter);

for (const [name, entry] of Object.entries(programs)) {
  test(`${name} --help exits 0 and names the program`, () => {
    const [command, args] = process.platform === "win32" ? [process.execPath, [...process.execArgv, entry, "--help"]] : [resolve(root, entry), ["--help"]];
    const run = spawnSync(command, args, { cwd: root, encoding: "utf8", env: { ...process.env, PATH } });
    assert.equal(run.error, undefined, String(run.error));
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, new RegExp(name));
  });
}
