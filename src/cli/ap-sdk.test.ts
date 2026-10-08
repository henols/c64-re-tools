import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { isAlive, ProcessSupervisor } from "../native/processes.ts";
import { WireFailure } from "../protocol.ts";
import { runApSdk } from "./ap-sdk.ts";

/** Runs `body` with a supervisor and a directory for stand-in AP SDK programs; both go afterwards. */
async function withStandIns(body: (context: { supervisor: ProcessSupervisor; signal: AbortSignal }, directory: string) => Promise<void>): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), "c64-re-tools-ap-sdk-"));
  const supervisor = new ProcessSupervisor({ graceMs: 1_000 });
  try {
    await body({ supervisor, signal: new AbortController().signal }, directory);
  } finally {
    await supervisor.stopAll();
    rmSync(directory, { recursive: true, force: true });
  }
}

test("an AP SDK run that does not finish in time is stopped and refused by name", { timeout: 30_000 }, async () => {
  await withStandIns(async (context, directory) => {
    const hang = join(directory, "hang.ts");
    const pidFile = join(directory, "pid");
    writeFileSync(hang, `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(pidFile)}, String(process.pid));\nsetInterval(() => {}, 1_000);\n`);
    await assert.rejects(runApSdk("install", ["--target", "claude"], context, { cli: hang, timeoutMs: 2_000 }), (error: unknown) => {
      assert.ok(error instanceof WireFailure);
      assert.equal(error.message, "AP SDK did not finish within 2 seconds.");
      return true;
    });
    assert.equal(isAlive(Number(readFileSync(pidFile, "utf8"))), false, "the stand-in no longer runs");
    assert.equal(context.supervisor.size, 0);
  });
});

test("an AP SDK run returns its exit status and output; install names the plugin, uninstall the id", { timeout: 30_000 }, async () => {
  await withStandIns(async (context, directory) => {
    const echo = join(directory, "echo.ts");
    writeFileSync(echo, `console.log(JSON.stringify(process.argv.slice(2)));\nconsole.error("a warning");\nprocess.exitCode = 3;\n`);
    const installed = await runApSdk("install", ["--target", "claude"], context, { cli: echo });
    assert.equal(installed.code, 3);
    assert.equal(installed.stderr, "a warning\n");
    const [command, plugin, ...flags] = JSON.parse(installed.stdout) as string[];
    assert.equal(command, "install");
    assert.match(plugin!, /[\\/]distribution[\\/]plugin\.ts$/);
    assert.deepEqual(flags, ["--target", "claude"]);

    const removed = await runApSdk("uninstall", ["--global"], context, { cli: echo });
    assert.deepEqual(JSON.parse(removed.stdout), ["uninstall", "c64-re-tools", "--global"]);
  });
});

test("an AP SDK run that a signal ends is refused by name", { timeout: 30_000, skip: process.platform === "win32" ? "Windows has no POSIX signal to end a process with" : false }, async () => {
  await withStandIns(async (context, directory) => {
    const killed = join(directory, "killed.ts");
    writeFileSync(killed, `process.kill(process.pid, "SIGKILL");\n`);
    await assert.rejects(runApSdk("install", [], context, { cli: killed }), /^WireFailure: AP SDK stopped on signal SIGKILL\.$/);
  });
});
