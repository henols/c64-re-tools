import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { WireFailure } from "../../protocol.ts";
import { ProcessSupervisor, type SupervisedProcess } from "../../native/processes.ts";
import { checkViceStarts, findVice, freePort, launchVice, viceArguments } from "./process.ts";

const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-test-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

function dir(prefix: string): string {
  return mkdtempSync(join(scratch, prefix));
}

function isInstallationIncomplete(error: unknown): boolean {
  return error instanceof WireFailure && error.code === "installation-incomplete" && /x64sc/.test(error.message);
}

test("findVice prefers C64RT_VICE when it names an executable", { skip: process.platform === "win32" ? "Windows has no executable bit to test" : false }, () => {
  const bin = dir("explicit-");
  const path = join(bin, "x64sc");
  writeFileSync(path, "");
  chmodSync(path, 0o755);
  assert.equal(findVice({ C64RT_VICE: path, PATH: "" }), path);
});

test("findVice refuses a C64RT_VICE that is relative, missing or not executable", { skip: process.platform === "win32" ? "Windows has no executable bit to test" : false }, () => {
  const bin = dir("bad-");
  const notExecutable = join(bin, "x64sc");
  writeFileSync(notExecutable, "");
  chmodSync(notExecutable, 0o644);
  for (const value of ["x64sc", join(bin, "missing"), notExecutable, bin]) {
    assert.throws(() => findVice({ C64RT_VICE: value, PATH: bin }), isInstallationIncomplete);
  }
});

test("findVice searches PATH in order and skips non-executables", { skip: process.platform === "win32" ? "Windows has no executable bit to test" : false }, () => {
  const first = dir("first-");
  const second = dir("second-");
  writeFileSync(join(first, "x64sc"), "");
  chmodSync(join(first, "x64sc"), 0o644);
  writeFileSync(join(second, "x64sc"), "");
  chmodSync(join(second, "x64sc"), 0o755);
  assert.equal(findVice({ PATH: ["", first, second].join(":") }), join(second, "x64sc"));
});

test("a missing VICE is refused by name with the remedy, never installed", () => {
  assert.throws(() => findVice({ PATH: dir("empty-") }), (error: unknown) => {
    assert.ok(isInstallationIncomplete(error));
    assert.match((error as Error).message, /Install VICE/);
    assert.match((error as Error).message, /C64RT_VICE/);
    return true;
  });
});

test("VICE arguments put -default before -binarymonitor and fix the profile", () => {
  const pal = viceArguments({
    binary: "/usr/bin/x64sc",
    port: 6510,
    textPort: 6511,
    configFile: "/s/vicerc",
    logFile: "/s/vice.log",
    videoStandard: "pal",
    mode: "headless",
  });
  assert.equal(pal[pal.indexOf("-logfile") + 1], "/s/vice.log");
  assert.equal(pal[0], "/usr/bin/x64sc");
  assert.ok(pal.indexOf("-default") < pal.indexOf("-binarymonitor"));
  assert.equal(pal[pal.indexOf("-binarymonitoraddress") + 1], "ip4://127.0.0.1:6510");
  assert.ok(pal.indexOf("-default") < pal.indexOf("-remotemonitor"));
  assert.equal(pal[pal.indexOf("-remotemonitoraddress") + 1], "ip4://127.0.0.1:6511");
  assert.equal(pal[pal.indexOf("-model") + 1], "c64");
  assert.equal(pal[pal.indexOf("-drive8type") + 1], "1541");
  const ntsc = viceArguments({ binary: "x", port: 1, textPort: 2, configFile: "c", logFile: "l", videoStandard: "ntsc", mode: "headless" });
  assert.equal(ntsc[ntsc.indexOf("-model") + 1], "ntsc");
});

test("a headless VICE has no window and no sound output; a windowed one has both", () => {
  const common = { binary: "x", port: 1, textPort: 2, configFile: "c", logFile: "l", videoStandard: "pal" } as const;
  const headless = viceArguments({ ...common, mode: "headless" });
  assert.ok(headless.includes("-console"));
  assert.equal(headless[headless.indexOf("-sounddev") + 1], "dummy");
  const window = viceArguments({ ...common, mode: "window" });
  assert.ok(!window.includes("-console"));
  assert.ok(!window.includes("-sounddev"));
});

test("freePort returns a loopback port that can be bound", async () => {
  const port = await freePort();
  assert.ok(port > 0 && port < 65536);
});

test("a VICE that cannot load its ROMs is refused with its own error lines", { skip: process.platform === "win32" ? "the stand-in VICE is a shell script" : false }, async () => {
  const bin = dir("bin-");
  const path = join(bin, "x64sc");
  // Like real VICE: the reason goes to the log file, and the piped output is lost.
  writeFileSync(path, [
    "#!/bin/sh",
    'while [ $# -gt 0 ]; do [ "$1" = -logfile ] && log="$2"; shift; done',
    "echo \"C64MEM: Error - Couldn't load kernal ROM 'kernal-901227-03.bin'.\" > \"$log\"",
    "echo 'Error - Machine initialization failed.' >> \"$log\"",
    "exit 255",
  ].join("\n"));
  chmodSync(path, 0o755);
  const supervisor = new ProcessSupervisor();
  await assert.rejects(checkViceStarts({ supervisor, env: { ...process.env, C64RT_VICE: path } }), (error: unknown) => {
    assert.ok(error instanceof WireFailure && error.code === "installation-incomplete", String(error));
    assert.match(error.message, /does not start:\n  C64MEM: Error - Couldn't load kernal ROM 'kernal-901227-03\.bin'\.\n  Error - Machine initialization failed\.\n.*ROM files/);
    return true;
  });
  await supervisor.stopAll();
});

/**
 * A stand-in x64sc: a shell script that runs a fake VICE on the monitor ports in its arguments.
 * `silent` makes a VICE whose monitors accept connections and never answer.
 */
function fakeViceBinary(options: { silent?: boolean } = {}): string {
  const path = join(dir("fake-vice-"), "x64sc");
  const entry = fileURLToPath(new URL("./fake-vice-process.testkit.ts", import.meta.url));
  const quote = (word: string) => `'${word.replace(/'/g, "'\\''")}'`;
  const command = [process.execPath, ...process.execArgv, entry, ...(options.silent === true ? ["--silent"] : [])];
  writeFileSync(path, ["#!/bin/sh", `exec ${command.map(quote).join(" ")} "$@"`].join("\n"));
  chmodSync(path, 0o755);
  return path;
}

/** A supervisor that records what it spawns and which owned paths are released; `failStop` makes each stop fail after it stopped. */
function watchedSupervisor(real: ProcessSupervisor, options: { failStop?: boolean } = {}) {
  const spawned: SupervisedProcess[] = [];
  const released = new Map<string, boolean>();
  const supervisor = {
    spawn(...args: Parameters<ProcessSupervisor["spawn"]>): SupervisedProcess {
      const child = real.spawn(...args);
      spawned.push(child);
      if (options.failStop !== true) return child;
      return {
        pid: child.pid,
        child: child.child,
        exited: child.exited,
        async stop() {
          await child.stop();
          throw new Error("the process group survived SIGKILL");
        },
      };
    },
    ownPath(path: string): () => void {
      const release = real.ownPath(path);
      released.set(path, false);
      return () => {
        released.set(path, true);
        release();
      };
    },
  } as unknown as ProcessSupervisor;
  return { supervisor, spawned, released };
}

const ended = (child: SupervisedProcess) =>
  Promise.race([child.exited.then(() => true), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000).unref())]);

test("a VICE that does not tell its version is stopped and refused by name", { skip: process.platform === "win32" ? "the stand-in VICE is a shell script" : false }, async () => {
  const real = new ProcessSupervisor();
  const { supervisor, spawned, released } = watchedSupervisor(real);
  try {
    await assert.rejects(checkViceStarts({ supervisor, env: { ...process.env, C64RT_VICE: fakeViceBinary() } }), (error: unknown) => {
      assert.ok(error instanceof WireFailure && error.code === "installation-incomplete", String(error));
      assert.match(error.message, /did not tell its version/);
      return true;
    });
    assert.equal(spawned.length, 1);
    assert.equal(await ended(spawned[0]!), true, "the VICE is stopped");
    assert.deepEqual([...released.values()], [true], "its scratch directory is removed");
  } finally {
    await real.stopAll();
  }
});

test("a VICE stop that fails still removes the scratch directory", { skip: process.platform === "win32" ? "the stand-in VICE is a shell script" : false }, async () => {
  const real = new ProcessSupervisor();
  const { supervisor, released } = watchedSupervisor(real, { failStop: true });
  try {
    const vice = await launchVice({ supervisor, videoStandard: "pal", env: { ...process.env, C64RT_VICE: fakeViceBinary() } });
    await assert.rejects(vice.stop(), /survived SIGKILL/);
    const scratch = [...released.keys()];
    assert.equal(scratch.length, 1);
    assert.equal(existsSync(scratch[0]!), false);
    assert.deepEqual([...released.values()], [true]);
    await assert.rejects(vice.stop(), /survived SIGKILL/, "a later stop reports the same failure");
  } finally {
    await real.stopAll();
  }
});

test("a VICE whose monitor never answers fails at once and is stopped", { skip: process.platform === "win32" ? "the stand-in VICE is a shell script" : false }, async () => {
  const real = new ProcessSupervisor();
  const { supervisor, spawned, released } = watchedSupervisor(real);
  const lines: string[] = [];
  try {
    await assert.rejects(
      launchVice({ supervisor, videoStandard: "pal", readyTimeoutMs: 1000, log: (line) => lines.push(line), env: { ...process.env, C64RT_VICE: fakeViceBinary({ silent: true }) } }),
      (error: unknown) => {
        assert.ok(error instanceof WireFailure && error.code === "machine-unavailable", String(error));
        assert.match(error.message, /did not become ready in time/);
        return true;
      },
    );
    assert.equal(spawned.length, 1, "a ready timeout is not tried again");
    assert.equal(await ended(spawned[0]!), true, "the VICE is stopped");
    assert.deepEqual([...released.values()], [true], "its scratch directory is removed");
    assert.ok(lines.some((line) => line.startsWith("VICE failed to start: The emulator did not become ready in time.")), lines.join("\n"));
  } finally {
    await real.stopAll();
  }
});

test("a VICE that exits while it starts is started again, up to three times", { skip: process.platform === "win32" ? "the stand-in VICE is a shell script" : false }, async () => {
  const path = join(dir("bin-"), "x64sc");
  writeFileSync(path, ["#!/bin/sh", "exit 1"].join("\n"));
  chmodSync(path, 0o755);
  const real = new ProcessSupervisor();
  const { supervisor, spawned, released } = watchedSupervisor(real);
  try {
    await assert.rejects(launchVice({ supervisor, videoStandard: "pal", env: { ...process.env, C64RT_VICE: path } }), (error: unknown) => {
      assert.ok(error instanceof WireFailure && error.code === "machine-unavailable", String(error));
      assert.match(error.message, /exited while it was starting/);
      return true;
    });
    assert.equal(spawned.length, 3);
    assert.deepEqual([...released.values()], [true, true, true], "each scratch directory is removed");
  } finally {
    await real.stopAll();
  }
});
