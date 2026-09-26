// cli.test.ts
//
// Drives the shipped, compiled installer (bin/cli.mjs) as a subprocess. It
// runs from a scratch package root holding a copy of the bin, a package.json
// and a small skills/ tree, so the test never depends on the generated
// installer/skills/ copy. PATH is prefixed with tripwire `npm` and `npx`
// scripts that record any call: the installer must never install anything.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";

const INSTALLER_ROOT = fileURLToPath(new URL(".", import.meta.url));
const SHIPPED_CLI = join(INSTALLER_ROOT, "bin", "cli.mjs");

interface Sandbox {
  root: string;
  pkgRoot: string;
  target: string;
  tripwireLog: string;
}

function withSandbox(fn: (sb: Sandbox) => void): void {
  const root = mkdtempSync(join(tmpdir(), "c64re-installer-"));
  try {
    const pkgRoot = join(root, "pkg");
    mkdirSync(join(pkgRoot, "bin"), { recursive: true });
    copyFileSync(SHIPPED_CLI, join(pkgRoot, "bin", "cli.mjs"));
    writeFileSync(join(pkgRoot, "package.json"), JSON.stringify({ name: "@henols/c64-re-tools", version: "9.9.9", type: "module" }));
    for (const skill of ["alpha", "beta"]) {
      mkdirSync(join(pkgRoot, "skills", skill, "scripts"), { recursive: true });
      writeFileSync(join(pkgRoot, "skills", skill, "SKILL.md"), `# ${skill}\n`);
      writeFileSync(join(pkgRoot, "skills", skill, "scripts", "package.json"), '{"type":"module"}\n');
    }

    const tripwireDir = join(root, "tripwire");
    const tripwireLog = join(root, "tripwire.log");
    mkdirSync(tripwireDir);
    for (const name of ["npm", "npx"]) {
      const p = join(tripwireDir, name);
      writeFileSync(p, `#!/bin/sh\necho "${name} $*" >> "${tripwireLog}"\nexit 97\n`);
      chmodSync(p, 0o755);
    }

    const target = join(root, "project");
    mkdirSync(target);
    fn({ root, pkgRoot, target, tripwireLog });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function runCli(sb: Sandbox, args: string[]) {
  const r = spawnSync(process.execPath, [join(sb.pkgRoot, "bin", "cli.mjs"), ...args], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${join(sb.root, "tripwire")}${delimiter}${process.env.PATH ?? ""}` },
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function assertNoInstallAttempt(sb: Sandbox): void {
  assert.equal(existsSync(sb.tripwireLog), false, `the installer ran npm/npx: ${existsSync(sb.tripwireLog) ? readFileSync(sb.tripwireLog, "utf8") : ""}`);
}

test("a plain run copies every bundled skill, including each scripts/package.json", () => {
  withSandbox((sb) => {
    const r = runCli(sb, [sb.target]);
    assert.equal(r.status, 0, r.stderr);
    for (const skill of ["alpha", "beta"]) {
      assert.equal(readFileSync(join(sb.target, ".claude", "skills", skill, "SKILL.md"), "utf8"), `# ${skill}\n`);
      assert.equal(readFileSync(join(sb.target, ".claude", "skills", skill, "scripts", "package.json"), "utf8"), '{"type":"module"}\n');
    }
    assertNoInstallAttempt(sb);
  });
});

test("a plain run writes no .mcp.json and never mentions npx", () => {
  withSandbox((sb) => {
    const r = runCli(sb, [sb.target]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(existsSync(join(sb.target, ".mcp.json")), false);
    assert.doesNotMatch(r.stdout + r.stderr, /npx/);
    assert.match(r.stderr, /Claude Code plugin/);
    assertNoInstallAttempt(sb);
  });
});

test("an existing .mcp.json is left byte-for-byte untouched, even with --force", () => {
  withSandbox((sb) => {
    const mcpPath = join(sb.target, ".mcp.json");
    const original = '{ "mcpServers": { "other": { "command": "x" } } }';
    writeFileSync(mcpPath, original);
    for (const args of [[sb.target], [sb.target, "--force"]]) {
      const r = runCli(sb, args);
      assert.equal(r.status, 0, r.stderr);
      assert.equal(readFileSync(mcpPath, "utf8"), original);
    }
    assertNoInstallAttempt(sb);
  });
});

test("--vendor is refused by name with the plugin remedy, and nothing is written", () => {
  withSandbox((sb) => {
    const r = runCli(sb, [sb.target, "--vendor"]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /--vendor is removed/);
    assert.match(r.stderr, /Claude Code plugin/);
    assert.equal(existsSync(join(sb.target, ".claude")), false);
    assert.equal(existsSync(join(sb.target, ".mcp.json")), false);
    assertNoInstallAttempt(sb);
  });
});

test("an unknown flag and an extra argument are refused, and nothing is written", () => {
  withSandbox((sb) => {
    for (const args of [[sb.target, "--bogus"], [sb.target, "extra"]]) {
      const r = runCli(sb, args);
      assert.equal(r.status, 2, `args ${JSON.stringify(args)}`);
      assert.equal(existsSync(join(sb.target, ".claude")), false);
    }
  });
});

test("a target named like an Object.prototype key is a directory, not a removed flag", () => {
  withSandbox((sb) => {
    const target = join(sb.root, "toString");
    mkdirSync(target);
    const r = runCli(sb, [target]);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(target, ".claude", "skills", "alpha", "SKILL.md")));
  });
});

test("--dry-run writes nothing", () => {
  withSandbox((sb) => {
    const r = runCli(sb, [sb.target, "--dry-run"]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(existsSync(join(sb.target, ".claude")), false);
    assert.match(r.stderr, /Dry run -- nothing was written/);
  });
});

test("existing skills are kept without --force and replaced with it", () => {
  withSandbox((sb) => {
    const skillMd = join(sb.target, ".claude", "skills", "alpha", "SKILL.md");
    mkdirSync(join(sb.target, ".claude", "skills", "alpha"), { recursive: true });
    writeFileSync(skillMd, "mine\n");
    assert.equal(runCli(sb, [sb.target]).status, 0);
    assert.equal(readFileSync(skillMd, "utf8"), "mine\n");
    assert.equal(runCli(sb, [sb.target, "--force"]).status, 0);
    assert.equal(readFileSync(skillMd, "utf8"), "# alpha\n");
  });
});

test("--help names the plugin as the MCP server's source and offers no install route", () => {
  withSandbox((sb) => {
    const r = runCli(sb, ["--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Claude Code plugin/);
    assert.doesNotMatch(r.stdout, /--vendor|npx -y|npm install/);
  });
});

test("the package declares no dependencies and ships only the compiled bin", () => {
  const pkg = JSON.parse(readFileSync(join(INSTALLER_ROOT, "package.json"), "utf8")) as {
    dependencies?: unknown;
    bin: Record<string, string>;
    files: string[];
  };
  assert.equal(pkg.dependencies, undefined);
  assert.deepEqual(pkg.bin, { "c64-re-tools": "bin/cli.mjs" });
  assert.ok(pkg.files.includes("bin/cli.mjs"));
  assert.ok(!pkg.files.includes("bin/"), "files[] must not ship bin/ wholesale -- that would publish cli.mts too");
});
