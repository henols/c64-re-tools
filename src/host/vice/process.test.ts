import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { WireFailure } from "../../protocol.ts";
import { ProcessSupervisor } from "../../native/processes.ts";
import { checkViceStarts, findVice, freePort, viceArguments } from "./process.ts";

const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-test-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

function dir(prefix: string): string {
  return mkdtempSync(join(scratch, prefix));
}

function isInstallationIncomplete(error: unknown): boolean {
  return error instanceof WireFailure && error.code === "installation-incomplete" && /x64sc/.test(error.message);
}

test("findVice prefers C64RT_VICE when it names an executable", { skip: process.platform === "win32" }, () => {
  const bin = dir("explicit-");
  const path = join(bin, "x64sc");
  writeFileSync(path, "");
  chmodSync(path, 0o755);
  assert.equal(findVice({ C64RT_VICE: path, PATH: "" }), path);
});

test("findVice refuses a C64RT_VICE that is relative, missing or not executable", { skip: process.platform === "win32" }, () => {
  const bin = dir("bad-");
  const notExecutable = join(bin, "x64sc");
  writeFileSync(notExecutable, "");
  chmodSync(notExecutable, 0o644);
  for (const value of ["x64sc", join(bin, "missing"), notExecutable, bin]) {
    assert.throws(() => findVice({ C64RT_VICE: value, PATH: bin }), isInstallationIncomplete);
  }
});

test("findVice searches PATH in order and skips non-executables", { skip: process.platform === "win32" }, () => {
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
  const pal = viceArguments({ binary: "/usr/bin/x64sc", port: 6510, textPort: 6511, configFile: "/s/vicerc", logFile: "/s/vice.log", videoStandard: "pal" });
  assert.equal(pal[pal.indexOf("-logfile") + 1], "/s/vice.log");
  assert.equal(pal[0], "/usr/bin/x64sc");
  assert.ok(pal.indexOf("-default") < pal.indexOf("-binarymonitor"));
  assert.equal(pal[pal.indexOf("-binarymonitoraddress") + 1], "ip4://127.0.0.1:6510");
  assert.ok(pal.indexOf("-default") < pal.indexOf("-remotemonitor"));
  assert.equal(pal[pal.indexOf("-remotemonitoraddress") + 1], "ip4://127.0.0.1:6511");
  assert.equal(pal[pal.indexOf("-model") + 1], "c64");
  assert.equal(pal[pal.indexOf("-drive8type") + 1], "1541");
  const ntsc = viceArguments({ binary: "x", port: 1, textPort: 2, configFile: "c", logFile: "l", videoStandard: "ntsc" });
  assert.equal(ntsc[ntsc.indexOf("-model") + 1], "ntsc");
});

test("freePort returns a loopback port that can be bound", async () => {
  const port = await freePort();
  assert.ok(port > 0 && port < 65536);
});

test("a VICE that cannot load its ROMs is refused with its own error lines", { skip: process.platform === "win32" }, async () => {
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
