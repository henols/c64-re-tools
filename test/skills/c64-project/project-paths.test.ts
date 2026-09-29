// project-paths.test.ts -- the project root order and the CLI result.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "..", "..", "..", "skills", "c64-project", "scripts", "project-paths.ts");

/** Runs the script in `cwd` with only the given project variables set. */
function run(cwd: string, env: Record<string, string> = {}) {
  const base = { ...process.env };
  for (const k of ["C64RE_PROJECT_ROOT", "CLAUDE_PROJECT_DIR", "C64RE_DATA_DIR", "C64RE_DISKS_ROOT", "C64RE_REGISTRY"]) delete base[k];
  const r = spawnSync(process.execPath, [SCRIPT, "--json"], { cwd, encoding: "utf8", env: { ...base, ...env }, timeout: 30_000 });
  return { status: r.status, result: JSON.parse(r.stdout.trim().split("\n").pop() ?? "") };
}

function scratch(): string {
  return realpathSync(mkdtempSync(join(tmpdir(), "project-paths-test-")));
}

test("the project root is the nearest .git ancestor of the working directory, not of the script", () => {
  const root = scratch();
  try {
    mkdirSync(join(root, ".git"));
    mkdirSync(join(root, "a", "b"), { recursive: true });
    const { status, result } = run(join(root, "a", "b"));
    assert.equal(status, 0);
    assert.equal(result.projectRoot, root);
    assert.equal(result.dataRoot, join(root, "recovery"));
    assert.equal(result.registry, join(root, "recovery", "RELEASES.json"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("C64RE_PROJECT_ROOT wins over CLAUDE_PROJECT_DIR, which wins over the .git walk", () => {
  const root = scratch();
  try {
    mkdirSync(join(root, ".git"));
    mkdirSync(join(root, "explicit"));
    mkdirSync(join(root, "claude"));
    assert.equal(run(root, { CLAUDE_PROJECT_DIR: join(root, "claude") }).result.projectRoot, join(root, "claude"));
    assert.equal(
      run(root, { CLAUDE_PROJECT_DIR: join(root, "claude"), C64RE_PROJECT_ROOT: join(root, "explicit") }).result.projectRoot,
      join(root, "explicit"),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("with no .git and no variable, the script refuses and names the start directory", () => {
  const root = scratch();
  try {
    const { status, result } = run(root);
    assert.equal(status, 1);
    assert.equal(result.ok, false);
    assert.ok(result.message.includes(root), result.message);
    assert.match(result.message, /C64RE_PROJECT_ROOT/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("importing the module outside any project does no work and does not throw", async () => {
  const root = scratch();
  const cwd = process.cwd();
  const saved = { a: process.env.C64RE_PROJECT_ROOT, b: process.env.CLAUDE_PROJECT_DIR };
  try {
    delete process.env.C64RE_PROJECT_ROOT;
    delete process.env.CLAUDE_PROJECT_DIR;
    process.chdir(root);
    const mod = await import(`../../../skills/c64-project/scripts/project-paths.ts?outside=${Date.now()}`);
    assert.throws(() => mod.projectRoot(), /could not locate the project root/);
  } finally {
    process.chdir(cwd);
    if (saved.a !== undefined) process.env.C64RE_PROJECT_ROOT = saved.a;
    if (saved.b !== undefined) process.env.CLAUDE_PROJECT_DIR = saved.b;
    rmSync(root, { recursive: true, force: true });
  }
});
