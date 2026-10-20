import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { Refusal } from "./errors.ts";
import { findProject, groupAt, groupOf, namedProject, newProjectFolder, projectRelative, projectRoot, resolveProject, resolveProjectFile, resolveProjectPath, resolveReadFile, resolveReadPath } from "./project.ts";

const root = process.cwd();

test("project paths stay under the harness working directory", () => {
  assert.equal(resolveProjectPath("src/main.a", root), resolve(root, "src/main.a"));
  assert.throws(() => resolveProjectPath("../outside", root), /leads out of the project folder/);
  assert.throws(() => resolveProjectPath(resolve(root, "absolute"), root), /is not relative/);
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
    assert.throws(() => resolveProjectFile("../secret", project), /leads out of the project folder/);
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

const refusal = (code: string, pattern: RegExp) => (error: unknown) => error instanceof Refusal && error.code === code && pattern.test(error.message);

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

test("a folder below the working directory that cannot be read is not a project, and the lookup goes on", { skip: process.platform === "win32" || process.getuid?.() === 0 }, () => {
  withHome((home) => {
    const plain = join(home, "plain");
    const closed = join(plain, "private");
    mkdirSync(join(closed, "inner"), { recursive: true });
    chmodSync(closed, 0o000);
    try {
      assert.equal(findProject(plain), plain);
    } finally {
      chmodSync(closed, 0o755);
    }
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
    // A project inside a project is a project of its own.
    mkdirSync(join(workspace, "game", "disk2", ".c64-re-tools"), { recursive: true });
    assert.equal(namedProject(join("game", "disk2"), workspace), join(workspace, "game", "disk2"));
  });
});

test("a new project folder is new or empty, outside the current project, and in no project; its zip must not exist", () => {
  withHome((home) => {
    const workspace = join(home, "workspace");
    const game = join(workspace, "game");
    mkdirSync(join(game, ".c64-re-tools"), { recursive: true });
    mkdirSync(join(workspace, "empty"));
    mkdirSync(join(workspace, "full"));
    writeFileSync(join(workspace, "full", "x"), "x");
    writeFileSync(join(workspace, "file"), "x");
    assert.deepEqual(newProjectFolder("../new", game), { root: join(workspace, "new"), zip: join(workspace, "new.zip") });
    assert.equal(newProjectFolder(join(workspace, "empty"), game).root, join(workspace, "empty"));
    assert.throws(() => newProjectFolder("out", game), refusal("invalid-input", /inside the project .*Give a folder outside it, for example \.\.\/out/));
    assert.throws(() => newProjectFolder(".", game), refusal("invalid-input", /inside the project/));
    assert.throws(() => newProjectFolder("..", game), refusal("invalid-input", /holds the project/));
    assert.throws(() => newProjectFolder("../full", game), refusal("conflict", /is not empty/));
    assert.throws(() => newProjectFolder("../file", game), refusal("invalid-input", /is not a folder/));
    assert.throws(() => newProjectFolder(home, game), refusal("invalid-input", /home folder/));
    mkdirSync(join(workspace, "other", ".c64-re-tools"), { recursive: true });
    assert.throws(() => newProjectFolder("../other/inner", game), refusal("invalid-input", /is inside the project .*other/));
    writeFileSync(join(workspace, "done.zip"), "x");
    assert.throws(() => newProjectFolder("../done", game), refusal("conflict", /done\.zip exists/));
  });
});

test("a project gets .c64-re-tools/local/ with a .gitignore that ignores everything; a plain folder gets nothing", () => {
  withHome((home) => {
    const game = join(home, "game");
    mkdirSync(join(game, ".c64-re-tools"), { recursive: true });
    assert.equal(resolveProject(undefined, join(game)), game);
    assert.match(readFileSync(join(game, ".c64-re-tools", "local", ".gitignore"), "utf8"), /^\*$/m);
    writeFileSync(join(game, ".c64-re-tools", "local", ".gitignore"), "kept\n");
    resolveProject("game", home);
    assert.equal(readFileSync(join(game, ".c64-re-tools", "local", ".gitignore"), "utf8"), "kept\n", "an existing .gitignore stays");

    const plain = join(home, "plain");
    mkdirSync(plain);
    resolveProject(undefined, plain);
    assert.equal(existsSync(join(plain, ".c64-re-tools")), false);
  });
});

test("projectRoot keeps the lookup for a working directory and looks again after a change of directory", () => {
  withHome((home) => {
    const first = join(home, "first");
    const second = join(home, "second");
    for (const folder of [first, second]) mkdirSync(join(folder, ".c64-re-tools"), { recursive: true });
    mkdirSync(join(first, "src"));
    const saved = process.cwd();
    try {
      process.chdir(join(first, "src"));
      assert.equal(projectRoot(), first);
      assert.equal(projectRoot(), first);
      process.chdir(second);
      assert.equal(projectRoot(), second);
      assert.equal(existsSync(join(second, ".c64-re-tools", "local", ".gitignore")), true);
    } finally {
      process.chdir(saved);
    }
  });
});

test("projectRelative gives one spelling of a project path", () => {
  assert.equal(projectRelative("./runs/a.bin", root), "runs/a.bin");
  assert.equal(projectRelative("runs//x/../a.bin", root), "runs/a.bin");
  assert.equal(projectRelative(join("runs", "a.bin"), root), "runs/a.bin");
  assert.throws(() => projectRelative("../a.bin", root), /leads out of the project folder/);
});

test("a group is a folder of a git repository, in no project, with projects in it; a project with its own .git is no member", () => {
  withHome((home) => {
    const repository = join(home, "games");
    const game = join(repository, "fist");
    for (const version of ["v2", "v1"]) mkdirSync(join(game, version, ".c64-re-tools"), { recursive: true });
    mkdirSync(join(game, "own", ".c64-re-tools"), { recursive: true });
    mkdirSync(join(game, "own", ".git"));
    mkdirSync(join(game, "docs"));
    assert.equal(groupAt(game), undefined, "no git repository");
    mkdirSync(join(repository, ".git"));
    const group = groupAt(game);
    assert.equal(group?.root, game);
    assert.deepEqual([...group!.projects], [["v1", join(game, "v1")], ["v2", join(game, "v2")]]);
    assert.equal(groupOf(join(game, "v1"))?.root, game);
    assert.equal(groupOf(join(game, "own")), undefined);
    assert.equal(groupAt(join(game, "v1")), undefined, "a project is no group");
    assert.equal(groupAt(join(game, "docs")), undefined, "no project in it");
    assert.equal(groupOf(game), undefined, "the repository holds no project");
  });
});

test("in a group, the lookup refuses a folder that is no project, a group folder is no project, and a read reaches the other versions", () => {
  withHome((home) => {
    const repository = join(home, "games");
    const game = join(repository, "fist");
    for (const version of ["v1", "v2"]) mkdirSync(join(game, version, ".c64-re-tools"), { recursive: true });
    mkdirSync(join(repository, ".git"));
    mkdirSync(join(game, "docs", "pages"), { recursive: true });
    mkdirSync(join(game, "v3"));
    writeFileSync(join(game, "v1", "game.prg"), "x");
    writeFileSync(join(repository, "other.prg"), "x");
    symlinkSync(join(repository, "other.prg"), join(game, "v2", "outside-link"));

    // A folder of the group that is no project: a write there would make it a project of the group.
    assert.throws(() => findProject(join(game, "docs", "pages")), refusal("invalid-input", /docs\/pages is in the group folder .*fist, and it is not a project folder\. The projects of the group are \.\.\/\.\.\/v1, \.\.\/\.\.\/v2\. Give --project <folder> with one of them\. To make this folder a new project of the group, give the folder itself: \.$/));
    assert.throws(() => findProject(join(game, "v3")), refusal("invalid-input", /The projects of the group are \.\.\/v1, \.\.\/v2/));
    assert.throws(() => resolveProject(undefined, join(game, "docs"), { remedy: "Give project: <folder>" }), refusal("invalid-input", /Give project: <folder> with one of them/));
    assert.equal(findProject(join(game, "v1")), join(game, "v1"));
    // A new version is named with its folder.
    assert.equal(resolveProject("v3", game), join(game, "v3"));
    // The group folder is no project.
    assert.throws(() => resolveProject(".", game, { remedy: "Give project: <folder>" }), refusal("invalid-input", /fist is a group folder, not a project folder\. These folders in it are projects: v1, v2\. Give project: <folder> with one of them\.$/));
    assert.equal(existsSync(join(game, ".c64-re-tools")), false);

    // A read of a version reaches the group folder; a write does not.
    const v2 = join(game, "v2");
    assert.equal(resolveReadPath("../v1/game.prg", v2), join(game, "v1", "game.prg"));
    assert.equal(resolveReadFile("../v1/game.prg", v2), realpathSync(join(game, "v1", "game.prg")));
    assert.throws(() => resolveReadPath("../../other.prg", v2), /leads out of the group folder of the project/);
    assert.throws(() => resolveReadFile("outside-link", v2), /leads out of the group folder of the project through a symbolic link/);
    assert.throws(() => resolveProjectPath("../v1/game.prg", v2), /leads out of the project folder/);
    // A project in no group reads only in its folder.
    assert.throws(() => resolveReadPath("../games/other.prg", join(home, "alone")), /leads out of the project folder/);
  });
});
