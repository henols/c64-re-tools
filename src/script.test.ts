// The script envelope, run in a child process so the exit status and the output are real.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const USAGE = "fixture.ts <file> [--out <file>]";

/** Runs `await runScript(<body>, <options>)` in a child node and returns its exit status and output. */
function run(body: string, options = "{ usage: USAGE }"): { status: number | null; stdout: string; stderr: string } {
  const source = [
    `import { parseArgs } from "node:util";`,
    `import { runScript, UsageError } from ${JSON.stringify(pathToFileURL(join(import.meta.dirname, "script.ts")).href)};`,
    `import { WireFailure } from ${JSON.stringify(pathToFileURL(join(import.meta.dirname, "protocol", "messages.ts")).href)};`,
    `class Refused extends Error { code = "not-found"; }`,
    `const USAGE = ${JSON.stringify(USAGE)};`,
    `await runScript(${body}, ${options});`,
  ].join("\n");
  const child = spawnSync(process.execPath, [...process.execArgv, "--input-type=module", "--eval", source], { encoding: "utf8", timeout: 30_000 });
  return { status: child.status, stdout: child.stdout, stderr: child.stderr };
}

test("a returned value is printed as one JSON line with exit status 0", () => {
  const result = run(`async () => ({ found: true, names: ["a", "b"] })`);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `{"found":true,"names":["a","b"]}\n`);
});

test("a body that returns undefined prints nothing", () => {
  const result = run(`() => { process.stdout.write("own output\\n"); }`);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "own output\n");
});

test("an exit status that the body sets stays, and its value is printed", () => {
  const result = run(`() => { process.exitCode = 3; return { result: "INCONCLUSIVE" }; }`);
  assert.equal(result.status, 3, result.stderr);
  assert.equal(result.stdout, `{"result":"INCONCLUSIVE"}\n`);
});

test("a WireFailure is a refusal: its code and message, exit status 1", () => {
  const result = run(`async () => { throw new WireFailure("machine-unavailable", "The Host Runtime does not answer."); }`);
  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { error: { code: "machine-unavailable", message: "The Host Runtime does not answer." } });
  assert.equal(result.stdout.split("\n").length, 2);
});

test("a class in refusals is a refusal too", () => {
  const result = run(`() => { throw new Refused("no symbol at $c000"); }`, "{ usage: USAGE, refusals: [Refused] }");
  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { error: { code: "not-found", message: "no symbol at $c000" } });
});

test("an error with a code that is not in refusals is thrown on", () => {
  const result = run(`() => { throw new Refused("no symbol at $c000"); }`);
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /no symbol at \$c000/);
});

test("any other error is thrown on", () => {
  const result = run(`async () => { throw new RangeError("out of range"); }`);
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /RangeError: out of range/);
});

test("a usage error names the problem, then the usage text, with exit status 2", () => {
  const result = run(`() => { throw new UsageError("give one file"); }`);
  assert.equal(result.status, 2, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { error: { code: "invalid-input", message: `give one file\n\n${USAGE}` } });
});

test("a usage error without a message prints the usage text alone", () => {
  const result = run(`() => { throw new UsageError(""); }`);
  assert.equal(result.status, 2, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { error: { code: "invalid-input", message: USAGE } });
});

test("a parseArgs error is a usage error", () => {
  const result = run(`() => parseArgs({ args: ["--bogus"], strict: true, options: { out: { type: "string" } } })`);
  assert.equal(result.status, 2, result.stderr);
  const { error } = JSON.parse(result.stdout) as { error: { code: string; message: string } };
  assert.equal(error.code, "invalid-input");
  assert.match(error.message, /^Unknown option '--bogus'/);
  assert.ok(error.message.endsWith(`\n\n${USAGE}`), error.message);
});
