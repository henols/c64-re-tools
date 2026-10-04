import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { WireFailure } from "../../protocol.ts";
import { Workspace } from "../staging.ts";
import { findGhidra, prepareSettings } from "./index.ts";

const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-ghidra-"));
const workspace = Workspace.create();
after(() => {
  rmSync(scratch, { recursive: true, force: true });
  workspace.remove();
});

/** Ghidra's launcher: a shell script, and a batch file on Windows. */
const LAUNCHER = process.platform === "win32" ? "analyzeHeadless.bat" : "analyzeHeadless";

/** A directory that looks like a Ghidra installation. */
function fakeInstallation(name: string): string {
  const root = join(scratch, name);
  mkdirSync(join(root, "support"), { recursive: true });
  mkdirSync(join(root, "Ghidra"));
  writeFileSync(join(root, "support", LAUNCHER), "#!/bin/sh\n");
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
  const extension = join(env.XDG_CONFIG_HOME!, `${userInfo().username}-ghidra`, "ghidra_12.1.3_PUBLIC", "Extensions", "C64RT");
  assert.match(readFileSync(join(extension, "extension.properties"), "utf8"), /^version=12\.1\.3$/m);
  for (const file of ["c64rt_6510.ldefs", "c64rt_6510.pspec", "c64rt_6510.cspec", "c64rt_6510.slaspec"]) {
    assert.ok(existsSync(join(extension, "data", "languages", file)), file);
  }
});
