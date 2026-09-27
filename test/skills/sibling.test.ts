// sibling.test.ts
//
// `npx skills add` can install one skill alone. Every skill that uses the
// c64-project skill's modules must then refuse by name -- naming the
// missing skill and the command that installs it -- instead of crashing with
// ERR_MODULE_NOT_FOUND. Each case copies ONE consuming skill into a scratch
// skills/ tree (no c64-project beside it) and runs it as a user would.
// The per-skill sibling.ts copies must also stay byte-identical.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILLS = join(HERE, "..", "..", "skills");
const SIBLING = "c64-project";
const INSTALL_HINT = `npx skills add henols/c64-re-tools --skill ${SIBLING}`;

interface Case {
  skill: string;
  script: string;
  args: (scratch: string) => string[];
}

const CASES: Case[] = [
  { skill: "c64-assembler", script: "acme.ts", args: (d) => ["build", join(d, "x.a")] },
  { skill: "c64-disk", script: "c1541.ts", args: (d) => ["dir", "--image", join(d, "x.d64")] },
  { skill: "c64-basic", script: "petcat.ts", args: (d) => ["decode", "--image", join(d, "x.prg")] },
  { skill: "c64-disassembler", script: "disassemble.ts", args: (d) => ["listing", "--image", join(d, "x.prg"), "--kind", "prg"] },
  { skill: "c64-unpacker", script: "packer-finding.ts", args: (d) => [join(d, "x.prg")] },
  { skill: "c64-provenance", script: "diff-images.ts", args: () => ["list"] },
  { skill: "c64-provenance", script: "recovery-schema.ts", args: () => [] },
  { skill: "c64-annotations", script: "completeness-report.ts", args: () => [] },
  { skill: "c64-ram-capture", script: "dump-artifacts.ts", args: () => [] },
  { skill: "c64-ram-capture", script: "vsf-slice.ts", args: () => [] },
  { skill: "c64-ram-capture", script: "watch-loads.ts", args: () => [] },
];

for (const c of CASES) {
  test(`${c.skill}/${c.script} installed without ${SIBLING} refuses by name`, () => {
    const scratch = mkdtempSync(join(tmpdir(), "sibling-test-"));
    try {
      // A project root (.git) so scripts that resolve one get past that step.
      mkdirSync(join(scratch, ".git"));
      writeFileSync(join(scratch, "x.a"), "\t!to \"x.prg\", cbm\n\t* = $0801\n\trts\n");
      writeFileSync(join(scratch, "x.d64"), Buffer.alloc(174848));
      writeFileSync(join(scratch, "x.prg"), Buffer.from([0x01, 0x08, 0x60]));
      cpSync(join(SKILLS, c.skill), join(scratch, "skills", c.skill), { recursive: true });
      assert.equal(existsSync(join(scratch, "skills", SIBLING)), false);

      const r = spawnSync(process.execPath, [join(scratch, "skills", c.skill, "scripts", c.script), ...c.args(scratch)], {
        cwd: scratch,
        encoding: "utf8",
        env: { ...process.env, C64RE_PROJECT_ROOT: scratch, VICE_MCP_DIR: "" },
        timeout: 30_000,
      });
      const out = `${r.stdout}\n${r.stderr}`;
      assert.doesNotMatch(out, /ERR_MODULE_NOT_FOUND/, `a crash, not a refusal:\n${out}`);
      // packer-finding carries the refusal inside its JSON finding, so quotes may be escaped.
      assert.match(out, new RegExp(`\\\\?"${SIBLING}\\\\?" skill`), `the refusal must name the missing skill:\n${out}`);
      assert.ok(out.includes(INSTALL_HINT), `the refusal must give the install command:\n${out}`);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
}

// The other half of separation: with ONLY c64-project beside it, each script
// loads and runs without reaching into any other skill. A script may still
// refuse (no broker, no input file), but never over a missing sibling.
const ALL_SKILLS = readdirSync(SKILLS).filter((s) => existsSync(join(SKILLS, s, "SKILL.md")));

for (const c of CASES) {
  test(`${c.skill}/${c.script} runs with only ${SIBLING} beside it`, () => {
    const scratch = mkdtempSync(join(tmpdir(), "sibling-test-"));
    try {
      mkdirSync(join(scratch, ".git"));
      writeFileSync(join(scratch, "x.a"), "\t!to \"x.prg\", cbm\n\t* = $0801\n\trts\n");
      writeFileSync(join(scratch, "x.d64"), Buffer.alloc(174848));
      writeFileSync(join(scratch, "x.prg"), Buffer.from([0x01, 0x08, 0x60]));
      mkdirSync(join(scratch, "recovery"));
      writeFileSync(join(scratch, "recovery", "RELEASES.json"), JSON.stringify({ schema_version: "1.0", releases: [] }));
      cpSync(join(SKILLS, c.skill), join(scratch, "skills", c.skill), { recursive: true });
      cpSync(join(SKILLS, SIBLING), join(scratch, "skills", SIBLING), { recursive: true });

      const r = spawnSync(process.execPath, [join(scratch, "skills", c.skill, "scripts", c.script), ...c.args(scratch)], {
        cwd: scratch,
        encoding: "utf8",
        env: { ...process.env, C64RE_PROJECT_ROOT: scratch, CLAUDE_PROJECT_DIR: scratch, VICE_MCP_DIR: "" },
        timeout: 30_000,
      });
      const out = `${r.stdout}\n${r.stderr}`;
      assert.doesNotMatch(out, /ERR_MODULE_NOT_FOUND/, `a crash on a missing module:\n${out}`);
      assert.doesNotMatch(out, /needs the "[^"]+" skill/, `a refusal over a missing sibling:\n${out}`);
      for (const other of ALL_SKILLS.filter((s) => s !== c.skill && s !== SIBLING)) {
        assert.ok(!out.includes(join(scratch, "skills", other)), `${c.skill}/${c.script} reached into ${other}:\n${out}`);
      }
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
}

test("recovery-schema's parameterisation gate runs with only c64-project beside it and scans every installed skill", () => {
  const scratch = mkdtempSync(join(tmpdir(), "sibling-test-"));
  try {
    mkdirSync(join(scratch, ".git"));
    mkdirSync(join(scratch, "recovery"));
    writeFileSync(join(scratch, "recovery", "RELEASES.json"), JSON.stringify({ schema_version: "1.0", releases: [] }));
    cpSync(join(SKILLS, "c64-provenance"), join(scratch, "skills", "c64-provenance"), { recursive: true });
    cpSync(join(SKILLS, SIBLING), join(scratch, "skills", SIBLING), { recursive: true });
    const run = () => spawnSync(process.execPath, [join(scratch, "skills", "c64-provenance", "scripts", "recovery-schema.ts"), "check-parameterisation", "--json"], {
      cwd: scratch,
      encoding: "utf8",
      env: { ...process.env, C64RE_PROJECT_ROOT: scratch },
      timeout: 30_000,
    });
    const alone = run();
    assert.equal(alone.status, 0, `the gate must pass with only c64-project installed:\n${alone.stdout}\n${alone.stderr}`);
    const aloneScanned = JSON.parse(alone.stdout).filesScanned as number;
    assert.ok(aloneScanned > 0, "the gate must scan at least its own scripts");

    // A skill installed later is covered without any code change.
    cpSync(join(SKILLS, "c64-ram-capture"), join(scratch, "skills", "c64-ram-capture"), { recursive: true });
    const withCapture = run();
    assert.equal(withCapture.status, 0, `${withCapture.stdout}\n${withCapture.stderr}`);
    assert.ok(JSON.parse(withCapture.stdout).filesScanned > aloneScanned, "an added skill's scripts must be scanned too");
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("every consuming skill's sibling.ts is byte-identical", () => {
  const copies = readdirSync(SKILLS)
    .map((s) => join(SKILLS, s, "scripts", "sibling.ts"))
    .filter((p) => existsSync(p));
  const consumers = new Set(CASES.map((c) => c.skill));
  assert.equal(copies.length, consumers.size, `expected one sibling.ts per consuming skill (${[...consumers].join(", ")})`);
  const first = readFileSync(copies[0]);
  for (const p of copies.slice(1)) {
    assert.ok(readFileSync(p).equals(first), `${p} differs from ${copies[0]}`);
  }
});
