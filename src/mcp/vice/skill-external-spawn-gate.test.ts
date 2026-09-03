// skill-external-spawn-gate.test.ts -- the non-vacuity / planted-violation
// proof for SEAM-05's whole-tree gate
// (scripts/check-no-skill-external-spawn.mjs).
//
// This file imports the SAME module the gate's own driver imports -- never a
// second copy of the predicate -- so proving it here proves the predicate
// the CI step actually runs. It calls the exported functions in ISOLATION
// rather than importing the gate as its own entry point, exactly like
// anno-cli-invocations.test.ts's own header states for its sibling shape
// (`scripts/lib/anno-cli-invocations.mjs`, imported the same three-levels-up
// way from this directory).
//
// DISCIPLINE (spawn-seam.test.ts's and hostpath-consumers.test.ts's own
// standing rule, both cited in this plan): every planted violation and every
// negative control below drives the SHIPPED `skillScriptSpawnViolations()`
// over a SYNTHETIC `{ name, source }` record. This file declares no regular
// expression matching a child-process call shape of its own -- a planted
// violation that re-derives the rule instead of calling the real predicate
// proves nothing about the rule the real scan applies.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  skillScriptSpawnViolations,
  skillScriptFilesFromTrackedTree,
  skillScriptFilesFromPackedTarball,
} from "../../../scripts/check-no-skill-external-spawn.mjs";

const HERE = dirname(fileURLToPath(import.meta.url)); // <root>/src/mcp/vice
const ROOT = join(HERE, "..", "..", ".."); // <root>
const INSTALLER_DIR = join(ROOT, "installer");

// ---------------------------------------------------------------------------
// Real scopes, computed ONCE (never per-test): the packed-tarball route re-
// runs the installer's `prepack` hook every call, and this gate's own header
// states that must not race a concurrent caller of the same helper -- the
// cheapest way to honour that inside one test file is to call it exactly
// once and share the result.
// ---------------------------------------------------------------------------

const TRACKED_SCOPE = skillScriptFilesFromTrackedTree(ROOT);

let PACKED_SCOPE: { name: string; source: string }[] | null = null;
let PACKED_SCOPE_ERROR: string | null = null;
try {
  PACKED_SCOPE = skillScriptFilesFromPackedTarball(INSTALLER_DIR);
} catch (e) {
  PACKED_SCOPE_ERROR = e instanceof Error ? e.message : String(e);
}

/** Opt-in env var mirroring `VICE_REQUIRE_ACME`/`VICE_REQUIRE_UNP64`'s own
 * convention (acme-gate.ts, packer-finding.mjs): when set, an unavailable
 * packed-tarball route is a hard FAIL, not a silent skip. CI's own `npm pack
 * --dry-run` always succeeds, so this never fires there; it exists so a
 * broken local environment cannot read as "route not tested" quietly. */
const REQUIRE_PACKED_SCOPE_ENV_VAR = "VICE_REQUIRE_PACKED_SKILL_SCOPE";

const packedSkip = PACKED_SCOPE === null ? `packed-tarball route unavailable: ${PACKED_SCOPE_ERROR}` : false;

test("packed-tarball route availability gate -- always runs, never silently skips", () => {
  if (PACKED_SCOPE !== null) return;
  if (process.env[REQUIRE_PACKED_SCOPE_ENV_VAR]) {
    assert.fail(
      `${REQUIRE_PACKED_SCOPE_ENV_VAR} is set but the packed-tarball route is unavailable ` +
        `(${PACKED_SCOPE_ERROR}) -- CI's own condition requires this route to work`,
    );
  }
});

// ---------------------------------------------------------------------------
// Non-vacuity floors. HAND-PINNED integer literals, never derived from the
// scope's own length (which would make them unfailable) -- MEASURED against
// this commit by plan 34-05: the tracked-tree route currently enumerates 16
// skill scripts and the packed-tarball route 15. Both floors below are
// pinned conservatively at the number this plan's own <behavior> text
// specifies (6), which is comfortably below either measured count. Raise
// this floor as the skill-script set grows; never lower it to paper over a
// shrinking scope.
// ---------------------------------------------------------------------------

const TRACKED_SCOPE_FLOOR = 6;
const PACKED_SCOPE_FLOOR = 6;

test("SEAM-05, non-vacuity: the tracked-tree scope is real and at least TRACKED_SCOPE_FLOOR skill scripts", () => {
  assert.ok(
    TRACKED_SCOPE.length >= TRACKED_SCOPE_FLOOR,
    `expected at least ${TRACKED_SCOPE_FLOOR} tracked skill scripts, got ${TRACKED_SCOPE.length}`,
  );
});

test("SEAM-05, non-vacuity: the packed-tarball scope is real and at least PACKED_SCOPE_FLOOR skill scripts", { skip: packedSkip }, () => {
  assert.ok(
    (PACKED_SCOPE as { name: string; source: string }[]).length >= PACKED_SCOPE_FLOOR,
    `expected at least ${PACKED_SCOPE_FLOOR} packed skill scripts, got ${(PACKED_SCOPE as unknown[]).length}`,
  );
});

test("SEAM-05, edge: empty -- calling the predicate over an empty file list returns a distinguished non-vacuity failure, not an empty array", () => {
  const result = skillScriptSpawnViolations([]);
  assert.equal(Array.isArray(result), false, "an empty scope must never read as Array.isArray() true (which would mean 'clean scan')");
  assert.ok(
    (result as { nonVacuityFailure?: boolean }).nonVacuityFailure,
    "the returned sentinel must name itself a non-vacuity failure",
  );
});

// ---------------------------------------------------------------------------
// PLANTED VIOLATIONS -- three shapes, all through skillScriptSpawnViolations()
// ---------------------------------------------------------------------------

test("SEAM-05 planted violation, argv form: a bare command-name string literal is reported, naming the file and the command", () => {
  const source = `import { spawnSync } from "node:child_process";\n` + `export function build() {\n` + `  return spawnSync("acme", ["--version"]);\n` + `}\n`;
  const violations = skillScriptSpawnViolations([{ name: "scratch/planted-argv.mjs", source }]);
  assert.ok(Array.isArray(violations), "a non-empty file list must never trip the non-vacuity sentinel");
  assert.equal(violations.length, 1, "exactly one violation expected");
  assert.equal(violations[0].file, "scratch/planted-argv.mjs");
  assert.equal(violations[0].command, "acme");
});

test("SEAM-05 planted violation, indirect form: a local variable declared from a banned command literal is reported", () => {
  const source =
    `import { spawn } from "node:child_process";\n` +
    `export function run() {\n` +
    `  const oracleBin = "unp64";\n` +
    `  return spawn(oracleBin, ["--version"]);\n` +
    `}\n`;
  const violations = skillScriptSpawnViolations([{ name: "scratch/planted-indirect.mjs", source }]);
  assert.ok(Array.isArray(violations));
  assert.equal(violations.length, 1);
  assert.equal(violations[0].command, "unp64");
});

test("SEAM-05 planted violation, shell form: interpolating a banned command into a shell command string is reported", () => {
  const source =
    `import { execSync } from "node:child_process";\n` +
    `export function convert() {\n` +
    `  const bin = "cartconv";\n` +
    "  return execSync(`${bin} -i in.crt -o out.crt`, { encoding: \"utf8\" });\n" +
    `}\n`;
  const violations = skillScriptSpawnViolations([{ name: "scratch/planted-shell.mjs", source }]);
  assert.ok(Array.isArray(violations));
  assert.equal(violations.length, 1);
  assert.equal(violations[0].command, "cartconv");
});

// ---------------------------------------------------------------------------
// NEGATIVE CONTROLS, synthetic: the interpreter exemption
// ---------------------------------------------------------------------------

test("SEAM-05 negative control, synthetic: a call whose first argument is the running interpreter directly is NOT reported", () => {
  const source =
    `import { spawnSync } from "node:child_process";\n` +
    `export function forward(argv) {\n` +
    `  return spawnSync(process.execPath, [".../target.mjs", ...argv]);\n` +
    `}\n`;
  const violations = skillScriptSpawnViolations([{ name: "scratch/interpreter-direct.mjs", source }]);
  assert.ok(Array.isArray(violations));
  assert.equal(violations.length, 0);
});

test("SEAM-05 negative control, synthetic indirect: a local variable declared from the running interpreter is NOT reported", () => {
  const source =
    `import { spawnSync } from "node:child_process";\n` +
    `export function forward(argv) {\n` +
    `  const node = process.execPath;\n` +
    `  return spawnSync(node, [".../target.mjs", ...argv]);\n` +
    `}\n`;
  const violations = skillScriptSpawnViolations([{ name: "scratch/interpreter-indirect.mjs", source }]);
  assert.ok(Array.isArray(violations));
  assert.equal(violations.length, 0);
});

// ---------------------------------------------------------------------------
// FALSE-POSITIVE CONTROLS
// ---------------------------------------------------------------------------

test("SEAM-05 false-positive control: a banned name inside a comment or a non-first-argument string is NOT reported", () => {
  const source =
    `import { spawnSync } from "node:child_process";\n` +
    `\n` +
    `// This module used to call spawnSync("acme", args) directly, before it\n` +
    `// was migrated onto the host-tool execution seam.\n` +
    `export function harmless() {\n` +
    `  return spawnSync("echo", ["acme is only mentioned in this string"]);\n` +
    `}\n`;
  const violations = skillScriptSpawnViolations([{ name: "scratch/decoy.mjs", source }]);
  assert.ok(Array.isArray(violations));
  assert.equal(
    violations.length,
    0,
    "a banned name mentioned only in a comment, or only in a string that is not a call's first argument, must not be reported",
  );
});

test("SEAM-05 false-positive control: a RegExp.prototype.exec() call is never mistaken for a shell spawn", () => {
  const source = `const RE = /\\bacme\\b/;\n` + `export function findIt(text) {\n` + `  return RE.exec(text);\n` + `}\n`;
  const violations = skillScriptSpawnViolations([{ name: "scratch/regex-exec.mjs", source }]);
  assert.ok(Array.isArray(violations));
  assert.equal(violations.length, 0, "RE.exec(text) must never be discovered as a shell-form spawn call");
});

// ---------------------------------------------------------------------------
// NEGATIVE CONTROL, real and on disk: vsf-slice.mjs
// ---------------------------------------------------------------------------

test("SEAM-05 negative control, real and on disk: vsf-slice.mjs IS in the tracked-tree scope", () => {
  assert.ok(
    TRACKED_SCOPE.some((f) => f.name.endsWith("vsf-slice.mjs")),
    "vsf-slice.mjs must be present in the tracked-tree scope -- otherwise the control below would pass by having fallen out of scope, not by being correctly exempted",
  );
});

test("SEAM-05 negative control, real and on disk: vsf-slice.mjs is NOT in the violation list", () => {
  const violations = skillScriptSpawnViolations(TRACKED_SCOPE);
  assert.ok(Array.isArray(violations));
  assert.ok(
    !violations.some((v) => v.file.endsWith("vsf-slice.mjs")),
    "vsf-slice.mjs spawns process.execPath by design and must be exempted, not reported",
  );
});

// ---------------------------------------------------------------------------
// ORDERING
// ---------------------------------------------------------------------------

test("SEAM-05, edge: ordering -- the predicate over the tracked-tree scope reversed returns a byte-identical result", () => {
  const forward = skillScriptSpawnViolations(TRACKED_SCOPE);
  const reversed = skillScriptSpawnViolations([...TRACKED_SCOPE].reverse());
  assert.ok(Array.isArray(forward) && Array.isArray(reversed));
  assert.deepEqual(reversed, forward, "reversing the input file order must not change the sorted output");
});

test("SEAM-05: the predicate is idempotent -- called twice with the same input it returns equal results", () => {
  const first = skillScriptSpawnViolations(TRACKED_SCOPE);
  const second = skillScriptSpawnViolations(TRACKED_SCOPE);
  assert.deepEqual(second, first);
});

// ---------------------------------------------------------------------------
// THE REPOSITORY AS COMMITTED PASSES
// ---------------------------------------------------------------------------

test("SEAM-05: the repository as committed passes -- the tracked-tree scope produces an empty violation list", () => {
  const violations = skillScriptSpawnViolations(TRACKED_SCOPE);
  assert.ok(Array.isArray(violations));
  assert.deepEqual(violations, [], `tracked-tree route must scan clean; found: ${JSON.stringify(violations)}`);
});

test("SEAM-05: the repository as committed passes -- the packed-tarball scope produces an empty violation list", { skip: packedSkip }, () => {
  const violations = skillScriptSpawnViolations(PACKED_SCOPE as { name: string; source: string }[]);
  assert.ok(Array.isArray(violations));
  assert.deepEqual(violations, [], `packed-tarball route must scan clean; found: ${JSON.stringify(violations)}`);
});

// ---------------------------------------------------------------------------
// Sanity: the two migrated scripts scan clean individually (plan 34-04's own
// migration targets), read directly off disk rather than through the scope
// enumerators, so this case does not depend on either scope function.
// ---------------------------------------------------------------------------

test("SEAM-05 sanity: acme.mjs and packer-finding.mjs, read directly, scan clean", () => {
  const files = [
    { name: "acme.mjs", path: join(ROOT, "src/skills/acme-build/scripts/acme.mjs") },
    { name: "packer-finding.mjs", path: join(ROOT, "src/skills/c64-program-recon/scripts/packer-finding.mjs") },
  ].map((f) => ({ name: f.name, source: readFileSync(f.path, "utf8") }));
  const violations = skillScriptSpawnViolations(files);
  assert.ok(Array.isArray(violations));
  assert.deepEqual(violations, []);
});
