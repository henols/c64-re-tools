import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { findProject, namedProject, ProjectError, resolveProject, resolveProjectFile, resolveProjectPath } from "./project.ts";

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

/** Runs `check` with a sandbox that holds a home folder, and with HOME (USERPROFILE on Windows) set to it. */
function withHome(check: (home: string) => void): void {
  const sandbox = realpathSync(mkdtempSync(join(tmpdir(), "c64-re-tools-lookup-")));
  const home = join(sandbox, "home");
  mkdirSync(home);
  const saved = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  try {
    check(home);
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    rmSync(sandbox, { recursive: true, force: true });
  }
}

const refusal = (code: string, pattern: RegExp) => (error: unknown) => error instanceof ProjectError && error.code === code && pattern.test(error.message);

test("the project is the nearest folder at or above the working directory with .c64-re-tools/", () => {
  withHome((home) => {
    const game = join(home, "work", "game");
    mkdirSync(join(game, ".c64-re-tools"), { recursive: true });
    mkdirSync(join(game, "src", "parts"), { recursive: true });
    assert.equal(findProject(game), game);
    assert.equal(findProject(join(game, "src", "parts")), game);
  });
});

test("the lookup stops below the home folder: a .c64-re-tools/ in home makes no project", () => {
  withHome((home) => {
    mkdirSync(join(home, ".c64-re-tools"));
    const plain = join(home, "work", "plain");
    mkdirSync(plain, { recursive: true });
    assert.equal(findProject(plain), plain);
    assert.throws(() => findProject(home), refusal("invalid-input", /home folder is not a project folder/));
  });
});

test("a folder with projects below it refuses and lists them; a plain folder is the project", () => {
  withHome((home) => {
    const workspace = join(home, "workspace");
    for (const project of ["hover-bovver", join("more", "boulder-dash")]) mkdirSync(join(workspace, project, ".c64-re-tools"), { recursive: true });
    mkdirSync(join(workspace, ".hidden", ".c64-re-tools"), { recursive: true });
    mkdirSync(join(workspace, "node_modules", "x", ".c64-re-tools"), { recursive: true });
    assert.throws(
      () => findProject(workspace),
      refusal("invalid-input", new RegExp(`These folders below it are projects: hover-bovver, ${join("more", "boulder-dash").replaceAll("\\", "\\\\")}\\. Give --project <folder>`)),
    );
    assert.throws(() => findProject(workspace, { remedy: "Give project: <folder>" }), refusal("invalid-input", /Give project: <folder> with one of them/));
    assert.equal(resolveProject("hover-bovver", workspace), join(workspace, "hover-bovver"));

    const plain = join(home, "plain");
    mkdirSync(join(plain, "src"), { recursive: true });
    assert.equal(findProject(plain), plain);
    assert.equal(resolveProject(undefined, plain), plain);
  });
});

test("a named project must be a folder, not the home folder and not inside another project", () => {
  withHome((home) => {
    const workspace = join(home, "workspace");
    mkdirSync(join(workspace, "game", ".c64-re-tools"), { recursive: true });
    mkdirSync(join(workspace, "game", "src"), { recursive: true });
    mkdirSync(join(workspace, "new"));
    writeFileSync(join(workspace, "file"), "x");
    assert.equal(namedProject("new", workspace), join(workspace, "new"));
    assert.equal(namedProject(join(workspace, "game"), "/"), join(workspace, "game"));
    assert.throws(() => namedProject("missing", workspace), refusal("not-found", /There is no folder missing/));
    assert.throws(() => namedProject("file", workspace), refusal("invalid-input", /is not a folder/));
    assert.throws(() => namedProject(home, workspace), refusal("invalid-input", /home folder/));
    assert.throws(() => namedProject(join("game", "src"), workspace), refusal("invalid-input", /inside the project game\. Give that project folder/));
  });
});
