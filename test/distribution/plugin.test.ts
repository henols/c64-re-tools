// The AP SDK plugin: every skill with its TypeScript scripts, the src/
// modules they reach, its references and its package.json, and the VICE MCP
// declaration. An installed skill runs without this repository.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import plugin, { closureOf, MCP_SERVER, mcpServerFor, scriptsOf, SKILL_PACKAGE } from "../../distribution/plugin.ts";

const root = resolve(import.meta.dirname, "../..");
const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-plugin-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

test("the scripts of a skill come from its SKILL.md", () => {
  assert.deepEqual(scriptsOf("node <skill>/scripts/test.ts a\nnode <skill>/scripts/checklist.ts b\nscripts/test.ts again"), ["checklist", "test"]);
  assert.deepEqual(scriptsOf("no scripts here"), []);
});

test("the plugin holds every skill with its scripts, their src/ modules, references and package.json", () => {
  assert.equal(plugin.id, "c64-re-tools");
  const names = plugin.skills!.map((skill) => skill.name);
  assert.deepEqual(names, readdirSync(resolve(root, "skills")).sort());
  const testing = plugin.skills!.find((skill) => skill.name === "c64-testing")!;
  const paths = testing.resources!.map((resource) => resource.path);
  assert.deepEqual(
    testing.resources!.filter((resource) => resource.executable === true).map((resource) => resource.path),
    ["scripts/checklist.ts", "scripts/test.ts"],
  );
  for (const path of ["scripts/scenario.ts", "src/host-client/tools.ts", "src/c64.ts", "references/scenario-format.md", "package.json"]) assert.ok(paths.includes(path), path);
  assert.ok(!paths.some((path) => path.endsWith(".js") || path.endsWith(".test.ts")), "TypeScript only, no tests");
  assert.ok(!paths.some((path) => path.startsWith("src/mcp/") || path.startsWith("src/host/")), "only what the scripts reach");
  assert.equal(testing.resources!.find((resource) => resource.path === "package.json")!.content, SKILL_PACKAGE);

  const analysis = plugin.skills!.find((skill) => skill.name === "c64-static-analysis")!.resources!.map((resource) => resource.path);
  for (const path of ["src/native/watchdog.ts", "src/native/ghidra/language/c64rt_6510.slaspec", "src/native/ghidra/scripts/C64Export.java"]) assert.ok(analysis.includes(path), path);

  for (const skill of plugin.skills!) {
    assert.ok(skill.description.length > 40, skill.name);
    assert.doesNotMatch(skill.instructions, /^---/, `${skill.name}: the body has no frontmatter`);
  }
});

test("a reach out of the skill and src/ is refused", () => {
  const skill = join(scratch, "bad-skill");
  mkdirSync(join(skill, "scripts"), { recursive: true });
  writeFileSync(join(skill, "scripts", "bad.ts"), 'import "../../../package.json";\n');
  assert.throws(() => closureOf(skill, [join(skill, "scripts", "bad.ts")]), /outside the skill and src/);
});

test("every installed script runs without the repository", () => {
  const skills = join(scratch, "installed");
  for (const skill of plugin.skills!) {
    for (const resource of skill.resources ?? []) {
      const path = join(skills, skill.name, resource.path);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, resource.content);
      if (resource.executable === true) chmodSync(path, 0o755);
    }
  }
  const project = join(scratch, "project");
  mkdirSync(project);
  // A project package.json that would make bare .ts files CommonJS; the skill's own package.json wins.
  writeFileSync(join(project, "package.json"), '{ "type": "commonjs" }\n');
  for (const skill of plugin.skills!) {
    for (const resource of (skill.resources ?? []).filter((resource) => resource.executable === true)) {
      // An unknown command loads every module of the script and stops at its usage text.
      const run = spawnSync(process.execPath, [join(skills, skill.name, resource.path), "--no-such-option"], { cwd: project, encoding: "utf8" });
      const output = run.stdout + run.stderr;
      assert.doesNotMatch(output, /ERR_MODULE_NOT_FOUND|ERR_PACKAGE_IMPORT_NOT_DEFINED|SyntaxError|ERR_UNKNOWN_FILE_EXTENSION/, `${skill.name}/${resource.path}: ${output}`);
      assert.notEqual(run.status, 0, `${skill.name}/${resource.path} refuses an unknown option`);
    }
  }
  const memmap = spawnSync(process.execPath, [join(skills, "c64-memory-map", "scripts", "memmap.ts"), "at", "$d020"], { cwd: project, encoding: "utf8" });
  assert.equal(memmap.status, 0, memmap.stderr);
  assert.equal((JSON.parse(memmap.stdout) as { addresses: Array<{ name: string }> }).addresses[0]?.name, "EXTCOL");
});

test("the agent starts the latest published MCP server through npx", () => {
  assert.deepEqual(plugin.mcpServers, { "c64-re-tools": MCP_SERVER });
  assert.deepEqual(mcpServerFor("linux"), { command: "npx", args: ["-y", "--package=@henols/c64-re-tools@latest", "c64-re-tools-mcp"] });
  assert.deepEqual(mcpServerFor("darwin"), mcpServerFor("linux"));
  assert.deepEqual(mcpServerFor("win32"), { command: "cmd", args: ["/c", "npx", "-y", "--package=@henols/c64-re-tools@latest", "c64-re-tools-mcp"] }, "npx is a .cmd shim on Windows");
  assert.deepEqual(MCP_SERVER, mcpServerFor(process.platform));
});

test("AP SDK accepts the plugin module", () => {
  // The CLI module itself, through node: the .bin shim is a shell script that Windows cannot run.
  const cli = resolve(dirname(fileURLToPath(import.meta.resolve("@jalco/ap-sdk"))), "cli.js");
  const check = spawnSync(process.execPath, [cli, "check", "distribution/plugin.ts"], { cwd: root, encoding: "utf8" });
  assert.equal(check.status, 0, check.stdout + check.stderr);
  assert.match(check.stdout, /is valid \(\d+ skill\(s\)/);
  assert.equal(readFileSync(resolve(root, "distribution", "plugin.ts"), "utf8").includes("dist/"), false);
});
