import assert from "node:assert/strict";
import { test } from "node:test";

import { ProcessSupervisor } from "../processes.ts";
import { runTool } from "./run.ts";

const posix = process.platform !== "win32";
const node = (code: string) => [process.execPath, "-e", code];

test("a run returns exit status and output", { skip: !posix }, async () => {
  const run = await runTool({
    argv: node('process.stdout.write("out"); process.stderr.write("err"); process.exit(3)'),
    cwd: process.cwd(),
    supervisor: new ProcessSupervisor(),
    signal: new AbortController().signal,
  });
  assert.deepEqual(
    { code: run.code, stdout: run.stdout, stderr: run.stderr, timedOut: run.timedOut, truncated: run.truncated },
    { code: 3, stdout: "out", stderr: "err", timedOut: false, truncated: false },
  );
});

test("a run past its timeout is stopped and reported", { skip: !posix }, async () => {
  const supervisor = new ProcessSupervisor({ graceMs: 100 });
  const started = Date.now();
  const run = await runTool({ argv: node("setInterval(() => {}, 1000)"), cwd: process.cwd(), supervisor, signal: new AbortController().signal, timeoutMs: 100 });
  assert.equal(run.timedOut, true);
  assert.ok(Date.now() - started < 5000);
  assert.equal(supervisor.size, 0);
});

test("output beyond the limit is dropped and flagged", { skip: !posix }, async () => {
  const run = await runTool({
    argv: node('process.stdout.write("x".repeat(5000))'),
    cwd: process.cwd(),
    supervisor: new ProcessSupervisor(),
    signal: new AbortController().signal,
    outputLimit: 100,
  });
  assert.equal(run.stdout.length, 100);
  assert.equal(run.truncated, true);
});

test("an abort stops the run and its descendants", { skip: !posix }, async () => {
  const supervisor = new ProcessSupervisor({ graceMs: 100 });
  const abort = new AbortController();
  setTimeout(() => abort.abort(), 100);
  const run = await runTool({
    argv: node('require("node:child_process").spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" }); setInterval(() => {}, 1000)'),
    cwd: process.cwd(),
    supervisor,
    signal: abort.signal,
  });
  assert.equal(run.aborted, true);
  assert.equal(supervisor.size, 0);
});
