// The skill bundles: every script a SKILL.md runs becomes one JavaScript file
// that works without the repository.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { bundleSkills, scriptsOf } from "../../distribution/bundle.ts";

const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-bundle-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

test("the scripts of a skill come from its SKILL.md", () => {
  assert.deepEqual(scriptsOf("node <skill>/scripts/test.ts a\nnode <skill>/scripts/checklist.ts b\nscripts/test.ts again"), ["checklist", "test"]);
  assert.deepEqual(scriptsOf("no scripts here"), []);
});

test("every skill is bundled with its scripts as .js and its references", async () => {
  const output = join(scratch, "skills");
  const skills = await bundleSkills(output);
  assert.deepEqual(skills, readdirSync("skills").sort());
  for (const skill of skills) {
    const markdown = readFileSync(join(output, skill, "SKILL.md"), "utf8");
    assert.doesNotMatch(markdown, /scripts\/[a-z-]+\.ts/, `${skill} still names a .ts script`);
    for (const script of scriptsOf(readFileSync(join("skills", skill, "SKILL.md"), "utf8"))) {
      assert.ok(existsSync(join(output, skill, "scripts", `${script}.js`)), `${skill}/scripts/${script}.js`);
    }
  }
  assert.ok(existsSync(join(output, "c64-testing", "references", "scenario-format.md")));
});

test("a bundled script runs without the repository", async () => {
  const output = join(scratch, "standalone");
  await bundleSkills(output);
  const outside = join(scratch, "elsewhere");
  mkdirSync(join(outside, "project"), { recursive: true });
  cpSync(join(output, "c64-memory-map"), join(outside, "c64-memory-map"), { recursive: true });
  const run = spawnSync(process.execPath, [join(outside, "c64-memory-map", "scripts", "memmap.js"), "at", "$d020"], { cwd: join(outside, "project"), encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.equal((JSON.parse(run.stdout) as { addresses: Array<{ name: string }> }).addresses[0]?.name, "EXTCOL");
  const usage = spawnSync(process.execPath, [join(outside, "c64-memory-map", "scripts", "memmap.js"), "nonsense"], { cwd: join(outside, "project"), encoding: "utf8" });
  const message = (JSON.parse(usage.stdout) as { error: { message: string } }).error.message;
  assert.match(message, /memmap\.js at/);
  assert.doesNotMatch(message, /memmap\.ts/, "the usage names the installed .js script");
  assert.doesNotMatch(readFileSync(join(outside, "c64-memory-map", "scripts", "memmap.js"), "utf8"), /from "\.\.\/\.\.\/\.\.\/src/, "no import into the repository");
});
