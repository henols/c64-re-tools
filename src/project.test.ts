import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { Refusal } from "./errors.ts";
import { ensureLocal, fileProject, findProject, groupAt, groupOf, namedProject, newProjectFolder, projectRelative, projectRoot, readRelative, resolveProjectFile, resolveProjectPath, resolveReadFile, resolveReadPath } from "./project.ts";

const root = process.cwd();

test("a project path is relative to the project folder or absolute, and stays inside it", () => {
  assert.equal(resolveProjectPath("src/main.a", root), resolve(root, "src/main.a"));
  assert.equal(resolveProjectPath(resolve(root, "src", "main.a"), root), resolve(root, "src/main.a"));
  assert.throws(() => resolveProjectPath("../outside", root), /leads out of the project folder/);
  assert.throws(() => resolveProjectPath(resolve(root, "..", "outside"), root), /leads out of the project folder/);
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

    const plain = join(home, "plain");
    mkdirSync(join(plain, "src"), { recursive: true });
    assert.equal(findProject(plain), plain);
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
    ensureLocal(game);
    assert.match(readFileSync(join(game, ".c64-re-tools", "local", ".gitignore"), "utf8"), /^\*$/m);
    writeFileSync(join(game, ".c64-re-tools", "local", ".gitignore"), "kept\n");
    ensureLocal(game);
    assert.equal(readFileSync(join(game, ".c64-re-tools", "local", ".gitignore"), "utf8"), "kept\n", "an existing .gitignore stays");

    const plain = join(home, "plain");
    mkdirSync(plain);
    ensureLocal(plain);
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
    // One project alone is no group: the repository with the game and one other project.
    mkdirSync(join(repository, "bruce", ".c64-re-tools"), { recursive: true });
    assert.equal(groupAt(repository), undefined, "one project in the folder");
    assert.equal(groupOf(join(repository, "bruce")), undefined);
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
    assert.equal(findProject(join(game, "v1")), join(game, "v1"));

    // A read of a version reaches the group folder; a write does not.
    const v2 = join(game, "v2");
    assert.equal(resolveReadPath("../v1/game.prg", v2), join(game, "v1", "game.prg"));
    assert.equal(resolveReadPath(join(game, "v1", "game.prg"), v2), join(game, "v1", "game.prg"));
    assert.equal(readRelative(join(game, "v1", "game.prg"), v2), "../v1/game.prg");
    assert.equal(resolveReadFile("../v1/game.prg", v2), realpathSync(join(game, "v1", "game.prg")));
    assert.throws(() => resolveReadPath("../../other.prg", v2), /leads out of the group folder .*fist of the project/);
    assert.throws(() => resolveReadFile("outside-link", v2), /leads out of the group folder of the project through a symbolic link/);
    assert.throws(() => resolveProjectPath("../v1/game.prg", v2), /leads out of the project folder/);
    // A project in no group reads only in its folder.
    assert.throws(() => resolveReadPath("../games/other.prg", join(home, "alone")), /leads out of the project folder/);
  });
});

test("the project of a file of an MCP tool is the project at or above it by the project rules", () => {
  withHome((home) => {
    // The field run: the agent starts in a folder that holds several projects.
    const games = join(home, "games");
    const bruce = join(games, "bruce");
    mkdirSync(join(bruce, ".c64-re-tools"), { recursive: true });
    mkdirSync(join(bruce, "build"));
    mkdirSync(join(games, "fist", ".c64-re-tools"), { recursive: true });
    assert.equal(fileProject(join(bruce, "build", "game.prg"), "read"), bruce);
    // A new file in a new folder: the lookup starts at the first folder above it that exists.
    assert.equal(fileProject(join(bruce, "dumps", "new", "mem.bin"), "write"), bruce);
    assert.equal(existsSync(join(bruce, ".c64-re-tools", "local", ".gitignore")), true);
    // A project inside a project is a project of its own.
    const disk2 = join(bruce, "disk2");
    mkdirSync(join(disk2, ".c64-re-tools"), { recursive: true });
    assert.equal(fileProject(join(disk2, "game.d64"), "read"), disk2);

    assert.throws(() => fileProject(join(games, "notes.bin"), "write"), refusal("invalid-input", /games, and it is not a project folder\. These folders below it are projects: bruce, fist\. Give a file in one of them\.$/));
    assert.throws(() => fileProject(join(home, "x.bin"), "write"), refusal("invalid-input", /the home folder is not a project folder\. Give a file in a project folder\.$/));
  });
});

test("for an MCP tool, a folder without .c64-re-tools/ is a project only in the folder where the server started, when the project rules make that folder a project", () => {
  withHome((home) => {
    const start = join(home, "start");
    mkdirSync(join(start, "dev", "build"), { recursive: true });
    const elsewhere = join(home, "elsewhere");
    mkdirSync(elsewhere);
    mkdirSync(join(home, ".ssh"));
    const marked = join(home, "marked");
    mkdirSync(join(marked, ".c64-re-tools"), { recursive: true });
    const workspace = join(home, "workspace");
    for (const name of ["a", "b"]) mkdirSync(join(workspace, name, ".c64-re-tools"), { recursive: true });
    mkdirSync(join(workspace, "notes"));
    const notInProject = refusal("invalid-input", /is not in a project folder\. A project folder has \.c64-re-tools\//);
    const saved = process.cwd();
    try {
      process.chdir(start);
      assert.equal(fileProject(join(start, "dev", "build", "game.prg"), "read"), start);
      for (const access of ["read", "write"] as const) assert.throws(() => fileProject(join(elsewhere, "x.bin"), access), notInProject, access);
      assert.equal(fileProject(join(marked, "x.bin"), "write"), marked);
      // The home folder and a folder with projects below it are no project, and no plain folder in them is one.
      process.chdir(home);
      assert.throws(() => fileProject(join(home, ".ssh", "authorized_keys"), "write"), notInProject);
      process.chdir(workspace);
      assert.throws(() => fileProject(join(workspace, "notes", "x.bin"), "write"), notInProject);
      assert.equal(fileProject(join(workspace, "a", "x.bin"), "write"), join(workspace, "a"));
    } finally {
      process.chdir(saved);
    }
  });
});

test("an absolute path through a symbolic link to the project folder is inside it, in the spelling of the project folder", { skip: process.platform === "win32" ? "symbolic links need extra rights on Windows" : false }, () => {
  withHome((home) => {
    const game = join(home, "game");
    mkdirSync(join(game, "build"), { recursive: true });
    const link = join(home, "linked");
    symlinkSync(game, link);
    assert.equal(resolveProjectPath(join(link, "build", "game.prg"), game), join(game, "build", "game.prg"));
    assert.equal(resolveProjectPath(join(link, "new", "deep", "x.bin"), game), join(game, "new", "deep", "x.bin"));
    assert.throws(() => resolveProjectPath(join(home, "x.bin"), game), /leads out of the project folder/);
    const saved = process.cwd();
    try {
      process.chdir(game);
      assert.equal(fileProject(join(link, "build", "game.prg"), "read"), game);
    } finally {
      process.chdir(saved);
    }
  });
});

test("an MCP tool reads in the group folder of a project, and writes only in a project", () => {
  withHome((home) => {
    const repository = join(home, "games");
    const game = join(repository, "fist");
    for (const version of ["v1", "v2"]) mkdirSync(join(game, version, ".c64-re-tools"), { recursive: true });
    mkdirSync(join(repository, ".git"));
    mkdirSync(join(game, "shared"));
    writeFileSync(join(game, "shared", "game.prg"), "x");
    const root = fileProject(join(game, "shared", "game.prg"), "read");
    assert.equal(resolveReadFile(join(game, "shared", "game.prg"), root), realpathSync(join(game, "shared", "game.prg")));
    assert.equal(fileProject(join(game, "notes.prg"), "read"), join(game, "v1"));
    assert.throws(() => fileProject(join(game, "shared", "out.bin"), "write"), refusal("invalid-input", /is in the group folder .*fist, and not in a project of the group\. The projects of the group are \.\.\/v1, \.\.\/v2\. Give a file in one of them\.$/));
  });
});
