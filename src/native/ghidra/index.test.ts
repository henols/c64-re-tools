import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { WireFailure } from "../../protocol.ts";
import { ProcessSupervisor } from "../processes.ts";
import { Workspace } from "../staging.ts";
import { analyze } from "./analyze.ts";
import { findGhidra, ghidraUserName, prepareSettings, runHeadless } from "./index.ts";

const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-ghidra-"));
const workspace = Workspace.create();
after(() => {
  rmSync(scratch, { recursive: true, force: true });
  workspace.remove();
});

/** Ghidra's launcher: a shell script, and a batch file on Windows. */
const LAUNCHER = process.platform === "win32" ? "analyzeHeadless.bat" : "analyzeHeadless";

/** A directory that looks like a Ghidra installation; its launcher runs `body` as a shell script. */
function fakeInstallation(name: string, body = ""): string {
  const root = join(scratch, name);
  mkdirSync(join(root, "support"), { recursive: true });
  mkdirSync(join(root, "Ghidra"));
  writeFileSync(join(root, "support", LAUNCHER), `#!/bin/sh\n${body}\n`);
  chmodSync(join(root, "support", LAUNCHER), 0o755);
  writeFileSync(join(root, "Ghidra", "application.properties"), "application.name=Ghidra\napplication.version=12.1.3\napplication.release.name=PUBLIC\n");
  return root;
}

const failsWith = (code: string) => (error: unknown) => error instanceof WireFailure && error.code === code;

test("C64RT_GHIDRA names the installation; its version names the settings directory", () => {
  const root = fakeInstallation("ghidra");
  const found = findGhidra({ C64RT_GHIDRA: root, PATH: "" });
  assert.equal(found.root, root);
  assert.equal(found.settingsName, "ghidra_12.1.3_PUBLIC");
  assert.equal(found.analyzeHeadless, join(root, "support", LAUNCHER));
});

test("analyzeHeadless on PATH finds its installation", () => {
  const root = fakeInstallation("on-path");
  assert.equal(findGhidra({ PATH: join(root, "support") }).root, realpathSync(root));
});

test("a missing or wrong Ghidra is refused by name with the remedy", () => {
  assert.throws(() => findGhidra({ PATH: "" }), (error: unknown) => failsWith("installation-incomplete")(error) && /Ghidra is not installed.*C64RT_GHIDRA/.test((error as Error).message));
  assert.throws(() => findGhidra({ C64RT_GHIDRA: scratch, PATH: "" }), failsWith("installation-incomplete"));
  assert.throws(() => findGhidra({ C64RT_GHIDRA: "relative/ghidra", PATH: "" }), failsWith("installation-incomplete"));
});

test("the request settings directory holds the language as an extension", () => {
  const ghidra = findGhidra({ C64RT_GHIDRA: fakeInstallation("settings"), PATH: "" });
  const env = prepareSettings(workspace, ghidra, { PATH: "/usr/bin" });
  assert.equal(env.PATH, "/usr/bin");
  assert.ok(env.XDG_CONFIG_HOME!.startsWith(workspace.root));
  // Ghidra adds the user name only for a settings directory outside the home (Windows keeps temp inside it).
  for (const application of [`${ghidraUserName()}-ghidra`, "ghidra"]) {
    const extension = join(env.XDG_CONFIG_HOME!, application, "ghidra_12.1.3_PUBLIC", "Extensions", "C64RT");
    assert.match(readFileSync(join(extension, "extension.properties"), "utf8"), /^version=12\.1\.3$/m);
    for (const file of ["c64rt_6510.ldefs", "c64rt_6510.pspec", "c64rt_6510.cspec", "c64rt_6510.slaspec"]) {
      assert.ok(existsSync(join(extension, "data", "languages", file)), `${application}: ${file}`);
    }
  }
});

test("the settings user name is the one Ghidra uses, also for a user without a password entry", () => {
  assert.equal(ghidraUserName(() => "henrik"), "henrik");
  assert.equal(ghidraUserName(() => "MyDomain\\John Doe"), "JohnDoe");
  assert.equal(ghidraUserName(() => {
    throw new Error("uv_os_get_passwd returned ENOENT");
  }), "?");
});

const posixOnly = process.platform === "win32" ? "the stand-in Ghidra is a shell script" : false;
const context = () => ({ supervisor: new ProcessSupervisor(), signal: new AbortController().signal });
const refusedWith = (message: string) => (error: unknown) => error instanceof WireFailure && error.code === "operation-failed" && error.message === message;
const PRG = Buffer.from([0x01, 0x08, 0x60]);
const SEEDS = { imageKind: "prg" as const, entryPoints: [0x0801], dataRanges: [], labels: [], decompile: [] };

test("a Ghidra error quotes the error lines of Ghidra without the workspace path", { skip: posixOnly }, async () => {
  const ghidra = findGhidra({ C64RT_GHIDRA: fakeInstallation("fails", 'echo "INFO starting"\necho "ERROR cannot open $PWD/ghidra-project" >&2\nexit 1'), PATH: "" });
  const own = Workspace.create();
  try {
    await assert.rejects(
      runHeadless({ ghidra, workspace: own, file: "input/image.bin", baseAddress: 0x0801, scriptDirectories: [], analyze: false, timeoutMs: 20_000, ...context() }),
      refusedWith("Ghidra stopped with an error.\nThe last output of Ghidra:\n  ERROR cannot open ghidra-project"),
    );
  } finally {
    own.remove();
  }
});

test("a Ghidra run without a result quotes the warnings of Ghidra", { skip: posixOnly }, async () => {
  const root = fakeInstallation("no-result", 'echo "INFO done"\necho "WARN script C64Export.java not found"');
  await assert.rejects(
    analyze(SEEDS, PRG, { ...context(), env: { ...process.env, C64RT_GHIDRA: root } }),
    refusedWith("Ghidra finished without a result.\nThe last output of Ghidra:\n  WARN script C64Export.java not found"),
  );
});

test("a rejected Ghidra result says what the check found", { skip: posixOnly }, async () => {
  // The export script's last argument is the result file.
  const root = fakeInstallation("bad-result", 'for last; do :; done\necho "{}" > "$last"');
  await assert.rejects(
    analyze(SEEDS, PRG, { ...context(), env: { ...process.env, C64RT_GHIDRA: root } }),
    refusedWith("Ghidra returned an incomplete or inconsistent result. Nothing was imported. The check found: no coverage."),
  );
});

test("a Ghidra result carries the version of the installation that made it", { skip: posixOnly }, async () => {
  const exported = {
    coverage: [{ start: 0x0801, end: 0x0801 }],
    functions: [{ entry: 0x0801, name: "FUN_0801", nameSource: "generated" }],
    regions: [{ start: 0x0801, end: 0x0801, classification: "code" }],
    references: [],
    decompilations: [],
    completeness: { functions: true, regions: true, references: true },
  };
  // The export script's last argument is the result file.
  const root = fakeInstallation("good-result", `for last; do :; done\necho '${JSON.stringify(exported)}' > "$last"`);
  const { result } = await analyze(SEEDS, PRG, { ...context(), env: { ...process.env, C64RT_GHIDRA: root } });
  assert.deepEqual(result, { ...exported, toolVersion: "Ghidra 12.1.3" });
});

test("a request for more than 32 decompilations is refused by name before Ghidra runs", async () => {
  await assert.rejects(
    analyze({ ...SEEDS, decompile: Array.from({ length: 33 }, () => 0x0801) }, PRG, { ...context(), env: { PATH: "" } }),
    (error: unknown) => error instanceof WireFailure && error.code === "invalid-input" && error.message === "The request has 33 routines to decompile. Give at most 32 routines to decompile.",
  );
});
