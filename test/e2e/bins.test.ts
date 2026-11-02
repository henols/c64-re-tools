import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { delimiter, resolve } from "node:path";
import { test } from "node:test";

// Each program runs as npm links it: the file itself, started through its
// shebang, with tsx on the PATH. Windows has no shebangs, so there Node runs
// the entry point.
const root = resolve(import.meta.dirname, "../..");
const programs = (JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as { bin: Record<string, string> }).bin;
const PATH = [resolve(root, "node_modules", ".bin"), process.env.PATH ?? ""].join(delimiter);

/** Runs `<entry> --help` and gives the spawn error, or the exit status and the output. */
function help(entry: string): Promise<{ error?: Error; status: number | null; stdout: string; stderr: string }> {
  const [command, args] = process.platform === "win32" ? [process.execPath, [...process.execArgv, entry, "--help"]] : [resolve(root, entry), ["--help"]];
  const child = spawn(command, args, { cwd: root, env: { ...process.env, PATH } });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => (stdout += chunk));
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));
  return new Promise((done) => {
    child.on("error", (error) => done({ error, status: null, stdout, stderr }));
    child.on("close", (status) => done({ status, stdout, stderr }));
  });
}

// The programs start together; each test waits for its own.
for (const [name, run] of Object.entries(programs).map(([name, entry]) => [name, help(entry)] as const)) {
  test(`${name} --help exits 0 and names the program`, async () => {
    const { error, status, stdout, stderr } = await run;
    assert.equal(error, undefined, String(error));
    assert.equal(status, 0, stderr);
    assert.match(stdout, new RegExp(name));
  });
}
