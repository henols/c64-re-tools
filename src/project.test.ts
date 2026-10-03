import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { resolveProjectFile, resolveProjectPath } from "./project.ts";

const root = process.cwd();

test("project paths stay under the harness working directory", () => {
  assert.equal(resolveProjectPath("src/main.a", root), resolve(root, "src/main.a"));
  assert.throws(() => resolveProjectPath("../outside", root), /escapes/);
  assert.throws(() => resolveProjectPath(resolve(root, "absolute"), root), /relative/);
});

test("project files must really be inside the project, also through symbolic links", () => {
  const sandbox = mkdtempSync(join(tmpdir(), "c64-re-tools-project-"));
  try {
    const project = join(sandbox, "project");
    mkdirSync(join(project, "build"), { recursive: true });
    writeFileSync(join(project, "build", "game.prg"), "x");
    writeFileSync(join(sandbox, "secret"), "x");
    symlinkSync(join(project, "build", "game.prg"), join(project, "inside-link"));
    symlinkSync(join(sandbox, "secret"), join(project, "outside-link"));

    assert.equal(resolveProjectFile("build/game.prg", project), realpathSync(join(project, "build", "game.prg")));
    assert.equal(resolveProjectFile("inside-link", project), realpathSync(join(project, "build", "game.prg")));
    assert.throws(() => resolveProjectFile("outside-link", project), /symbolic link/);
    assert.throws(() => resolveProjectFile("../secret", project), /escapes/);
    assert.throws(() => resolveProjectFile("missing.prg", project), (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT");
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});
