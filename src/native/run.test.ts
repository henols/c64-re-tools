import assert from "node:assert/strict";
import { test } from "node:test";

import { WireFailure } from "../protocol/messages.ts";
import { isAlive, ProcessSupervisor, type SpawnOptions } from "./processes.ts";
import { runTool, runToolOrFail } from "./run.ts";

const node = (code: string) => [process.execPath, "-e", code];

test("a run returns exit status and output", { timeout: 30_000 }, async () => {
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

test("a run past its timeout is stopped and reported", { timeout: 30_000 }, async () => {
  const supervisor = new ProcessSupervisor({ graceMs: 100 });
  const started = Date.now();
  const run = await runTool({ argv: node("setInterval(() => {}, 1000)"), cwd: process.cwd(), supervisor, signal: new AbortController().signal, timeoutMs: 100 });
  assert.equal(run.timedOut, true);
  assert.ok(Date.now() - started < 5000);
  assert.equal(supervisor.size, 0);
});

test("output beyond the limit is dropped and flagged", { timeout: 30_000 }, async () => {
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

test("an abort stops the run and its descendants", { timeout: 30_000 }, async () => {
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

test("a stop that fails during a timeout rejects the run instead of an unhandled rejection", { timeout: 30_000 }, async () => {
  const real = new ProcessSupervisor({ graceMs: 100 });
  // A supervisor whose stop ends the process but then reports that the group survived.
  const supervisor = {
    spawn: (argv: readonly string[], options: SpawnOptions) => {
      const child = real.spawn(argv, options);
      return { ...child, stop: async () => {
        await child.stop();
        throw new Error("process group survived SIGKILL");
      } };
    },
  } as unknown as ProcessSupervisor;
  const unhandled: unknown[] = [];
  const record = (reason: unknown) => unhandled.push(reason);
  process.on("unhandledRejection", record);
  try {
    await assert.rejects(
      runTool({ argv: node("setInterval(() => {}, 1000)"), cwd: process.cwd(), supervisor, signal: new AbortController().signal, timeoutMs: 100 }),
      /survived SIGKILL/,
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.deepEqual(unhandled, []);
  } finally {
    process.off("unhandledRejection", record);
    await real.stopAll();
  }
});

test("a tool that exits while a descendant holds its output finishes without a timeout", { skip: process.platform === "win32" ? "Windows cannot find the descendants of a process that has ended" : false, timeout: 30_000 }, async () => {
  const supervisor = new ProcessSupervisor({ graceMs: 100 });
  const started = Date.now();
  const run = await runTool({
    argv: node('const d = require("node:child_process").spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "inherit" }); console.log(d.pid); process.exit(0)'),
    cwd: process.cwd(),
    supervisor,
    signal: new AbortController().signal,
    timeoutMs: 5_000,
  });
  assert.deepEqual({ code: run.code, timedOut: run.timedOut }, { code: 0, timedOut: false });
  assert.ok(Date.now() - started < 4_000, "the run waited for the timeout");
  assert.equal(isAlive(Number(run.stdout.trim())), false, "the descendant survived");
  assert.equal(supervisor.size, 0);
});

test("a character split between two output chunks stays whole", { timeout: 30_000 }, async () => {
  // The two bytes of "é" arrive as two writes with a pause between them.
  const run = await runTool({
    argv: node("process.stdout.write(Buffer.from([0xc3])); setTimeout(() => process.stdout.write(Buffer.from([0xa9])), 100)"),
    cwd: process.cwd(),
    supervisor: new ProcessSupervisor(),
    signal: new AbortController().signal,
  });
  assert.equal(run.stdout, "é");
});

test("the output limit counts bytes, not characters", { timeout: 30_000 }, async () => {
  // "€" is three bytes in UTF-8: nine bytes hold three of them.
  const run = await runTool({
    argv: node('process.stdout.write("€".repeat(10))'),
    cwd: process.cwd(),
    supervisor: new ProcessSupervisor(),
    signal: new AbortController().signal,
    outputLimit: 9,
  });
  assert.equal(run.stdout, "€".repeat(3));
  assert.equal(run.truncated, true);
});

const context = () => ({ supervisor: new ProcessSupervisor({ graceMs: 100 }), signal: new AbortController().signal });
const failsWith = (code: string, message: RegExp) => (error: unknown) => error instanceof WireFailure && error.code === code && message.test(error.message);

test("a tool that does not start is refused by name with the cause", { timeout: 30_000 }, async () => {
  await assert.rejects(
    runToolOrFail("ACME", "The assembly", { argv: ["/nonexistent/c64-re-tools-test-binary"], cwd: process.cwd(), timeoutMs: 5_000 }, context()),
    failsWith("installation-incomplete", /^ACME is not a program that this system can start \(ENOENT\)/),
  );
});

test("a tool that a signal stops has failed and quotes its last output", { skip: process.platform === "win32" ? "a Windows process does not end by a signal" : false, timeout: 30_000 }, async () => {
  await assert.rejects(
    runToolOrFail("ACME", "The assembly", { argv: node('console.log("pass 1"); process.kill(process.pid, "SIGKILL")'), cwd: process.cwd(), timeoutMs: 5_000 }, context()),
    failsWith("operation-failed", /^ACME stopped on the signal SIGKILL\.\nThe last output of ACME:\n {2}pass 1$/),
  );
});
