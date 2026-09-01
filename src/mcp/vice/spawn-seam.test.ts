#!/usr/bin/env node
// spawn-seam.test.ts -- turns the spawn-seam invariant into a checked
// property (INT-02, D-11.1-05): every shipped module that spawns the EMULATOR
// binary must do it in the safe form -- an argv ARRAY, never a shell command
// string and never a string-interpolated binary path -- and the set of sites
// that exist is pinned, so a future second site cannot appear unguarded and
// go unnoticed.
//
// ============================================================================
// RE-POINTED BY PLAN 29-10 (2026-08-30). READ THIS BEFORE CHANGING ANYTHING.
// ============================================================================
//
// THE FOUNDING INCIDENT, kept verbatim in substance because it is the reason
// this file exists at all and stays true in the past tense:
//
//   `anno-launch.ts`'s header used to claim it was the ONE place in this
//   repo that spawned the external analyser. That was FALSE -- `anno-mcp-client.ts`
//   held a second, necessary spawn site, because a long-lived async child is
//   not something a blocking `spawnSync` can provide. The invariant itself
//   was never actually compromised (both sites did guard their argv first),
//   but a maintainer trusting the wrong header would not have known that a
//   THIRD site had to guard too. That is the whole lesson: A PROSE PROMISE
//   ABOUT WHERE SPAWNS LIVE IS WORTH NOTHING; only a discovery pass over the
//   real shipped module set is worth anything. Everything below is the
//   mechanically checked replacement for that prose promise.
//
// WHAT MOVED, AND WHY IT HAD TO. Plan 29-10 deleted the retired
// static-analysis integration, and with it BOTH of the spawn sites this
// guard was originally measured against. That does NOT retire the guard:
// the DISCIPLINE -- no shipped module spawns a child in an injectable form,
// and the set of modules that spawn at all is pinned rather than assumed --
// outlives the substrate it was first measured on. So the SUBJECT was
// re-pointed, not the machinery:
//
//   BEFORE                                   AFTER
//   ------                                   -----
//   the analyser binary (ANNO_BIN)          the emulator binary (VICE_BIN /
//                                            "x64sc" / a resolved binPath)
//   assertNoViceFlag(argv) precedes          the call uses the argv-ARRAY
//   every spawn                              form, and the module builds no
//                                            shell command string from the
//                                            binary path
//   2 expected sites                         1 expected site
//
// The `assertNoViceFlag` half could not be carried across and is not
// pretended to be: its entire subject was "never hand a VICE flag to the
// ANALYSER", and there is no analyser to hand anything to. What replaced it
// is the property that still has a subject and still has teeth -- the
// command-injection form of the emulator spawn, which `backend-detect.mts`
// already states as a rule in its own header ("spawnSync only, argv array,
// shell: false, never a shell string and never string interpolation of
// binPath") and which nothing was mechanically checking until now.
//
// THE RE-POINT WAS PROVEN, NOT ASSERTED. A guard whose planted violation no
// longer reddens has not been re-pointed -- this phase's standing
// prohibition. The plants in section 4 below are committed, they run on every
// invocation, and plan 29-10 re-ran them against the post-deletion tree.
//
// WHAT WAS DELETED RATHER THAN RE-POINTED, stated so it is not looked for:
// the environment-gated live session-reuse transcript (D18-02) and the
// committed-fixture existence check that partnered it. Their subject was a
// held analyser child process being reused across two calls; there is no such
// child. Under D-01 a gated block whose subject is gone is still a test that
// includes it, so both were removed outright rather than skipped or left as a
// `todo`.
//
// DISCOVERY, not enumeration: the scanned module set is derived from
// `package.json`'s `files[]` array -- the SHIPPED production `.ts`/`.mts`
// module set -- via the shared enumerator in `shipped-modules.ts`, its one
// home, imported rather than copied. See that module for why the set is
// `files[]`-derived rather than a raw `readdirSync` filtered only on
// `*.test.*`: `acme-gate.ts` is a real, but non-shipped, spawn call site that
// the broader directory listing would incorrectly catch, so it is not a
// special case here.
//
// GREP-GATE HYGIENE (mandatory, CLAUDE.md): this directory's own headers and
// doc comments discuss `spawnSync`, `spawn(bin, argv, ...)` and the emulator
// binary constantly in prose -- an unfiltered text scan would be
// self-invalidating. `codeOnly()` strips BOTH comments (`//` and `/* */`,
// reusing the WR-02-fixed close-token-by-position algorithm) AND
// string/template literal bodies (adapting `docs-dangling-refs.test.ts`'s
// character-scanning literal extractor to blank literal text instead of
// collecting it) before any spawn-call pattern is matched -- so neither a
// comment describing a spawn call, nor a string literal that merely quotes
// one, can be discovered as a real call site. The planted-violation control
// in section 4 proves both traps are closed, not merely asserts they are.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { codeOnly, shippedTsModules } from "./shipped-modules.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Spawn-family function names this guard watches. Unlike the pre-29-10
 * version, `exec`/`execSync` are INCLUDED and are the dangerous ones: they
 * take a shell command STRING rather than an argv array, which is exactly the
 * form this guard now exists to forbid at an emulator spawn site. */
const ARGV_SPAWN_NAMES = ["spawnSync", "spawn", "execFileSync", "execFile"] as const;
const SHELL_SPAWN_NAMES = ["execSync", "exec"] as const;

/** Matches `<spawnFn>(<firstArgToken>` in already-`codeOnly()`-ed source,
 * capturing the function name and the raw first-argument token, which can
 * only ever be an identifier. `codeOnly()` removes a quoted literal
 * ENTIRELY -- quote characters included -- so a string-literal first argument
 * contributes nothing at all and surfaces as `spawnSync(, ...)`. The
 * identifier group therefore cannot match it, which is the intended outcome:
 * the literal's text was never real code to begin with.
 * `identNamesEmulatorBinary()` is what then decides whether a matched
 * identifier names the emulator binary. */
const ARGV_CALL_RE = new RegExp(`\\b(${ARGV_SPAWN_NAMES.join("|")})\\s*\\(\\s*([A-Za-z_$][A-Za-z0-9_$]*)`, "g");

/** The SHELL-form call pattern. Deliberately captures the whole call opening
 * INCLUDING any interpolation marker, because a shell spawn's danger is in
 * its argument's shape rather than in a bare identifier: `exec(`+"`"+`${bin} -help`+"`"+`)`
 * is the violation, and `codeOnly()` preserves `${ ... }` interpolation
 * expressions while blanking the surrounding literal text. */
const SHELL_CALL_RE = new RegExp(`(?<![.\\w$])(${SHELL_SPAWN_NAMES.join("|")})\\s*\\(\\s*([^)]{0,120})`, "g");

interface SpawnCallSite {
  fn: string;
  arg: string;
  index: number;
  /** True when the call is a shell-command-string form rather than the argv
   * array form -- the shape this guard forbids at an emulator spawn site. */
  shellForm: boolean;
}

/** Every argv-form spawn call in `codeOnlySrc`, with the call's start index
 * and its bare first-argument identifier. */
function findArgvSpawnCalls(codeOnlySrc: string): SpawnCallSite[] {
  const sites: SpawnCallSite[] = [];
  for (const m of codeOnlySrc.matchAll(ARGV_CALL_RE)) {
    sites.push({ fn: m[1], arg: m[2], index: m.index ?? -1, shellForm: false });
  }
  return sites;
}

/** Every shell-form spawn call in `codeOnlySrc` whose argument mentions an
 * emulator-binary-shaped name.
 *
 * TWO SUBTLETIES, both load-bearing, both pinned by a control in section 4:
 *
 *   1. A `RegExp.prototype.exec(...)` call is NOT one of these. This
 *      directory legitimately calls `.exec()` on regexes in a dozen modules,
 *      and every one of them must stay invisible here or this guard is red on
 *      a correct tree -- whose cheapest "fix" under pressure is to weaken it.
 *      `SHELL_CALL_RE`'s lookbehind rejects any `exec` preceded by a dot or
 *      an identifier character, so only a bare `exec(`/`execSync(` -- the
 *      form `node:child_process` is actually imported as -- can match.
 *
 *   2. The name test here is DELIBERATELY LOOSER than `EMULATOR_BIN_SHAPE`,
 *      and must be. `codeOnly()` blanks a template literal's TEXT while
 *      keeping its interpolated expressions, so the violation
 *      `execSync(<backtick>${binPath} ${flag}<backtick>)` arrives here as the
 *      run-together token `binPathflag` -- with no word boundary after
 *      `binPath` for a `\b`-anchored pattern to find. That run-together shape
 *      IS the signature of interpolating the binary into a command string,
 *      which is precisely the violation, so an unanchored substring test is
 *      the correct instrument rather than a sloppy one. */
function findShellSpawnCalls(codeOnlySrc: string): SpawnCallSite[] {
  const sites: SpawnCallSite[] = [];
  for (const m of codeOnlySrc.matchAll(SHELL_CALL_RE)) {
    const argText = m[2] ?? "";
    if (!EMULATOR_BIN_SUBSTRING.test(argText)) continue;
    sites.push({ fn: m[1], arg: argText.trim(), index: m.index ?? -1, shellForm: true });
  }
  return sites;
}

/** The emulator binary, in every shape this repo spells it. `VICE_BIN` is the
 * env var and the constant; `x64sc` is the default value; `binPath`/`viceBin`
 * are the two resolved-path locals `backend-detect.mts` carries. Never a bare
 * `bin`, which is too generic to mean anything.
 *
 * Word-anchored, for the argv form, where the identifier stands alone. */
const EMULATOR_BIN_SHAPE = /\bVICE_BIN\b|\bx64sc\b|\bbinPath\b|\bviceBin\b/;

/** The same names, UNANCHORED -- see `findShellSpawnCalls()`'s subtlety 2 for
 * why the shell form needs a substring test rather than a word-boundary one. */
const EMULATOR_BIN_SUBSTRING = /VICE_BIN|x64sc|binPath|viceBin/;

/** True iff `ident` is, anywhere in the module, declared or assigned from an
 * expression that resolves to the emulator binary name -- one of the shapes
 * above directly, or a local whose declaration mentions one. The declaration
 * scan runs against the FULL RAW source, not `codeOnlySrc`, specifically so a
 * literal default like `"x64sc"` -- which `codeOnly()` blanks out because it
 * is a string literal -- is still recognised as naming the binary. */
function identNamesEmulatorBinary(ident: string, rawSrc: string): boolean {
  if (EMULATOR_BIN_SHAPE.test(ident)) return true;
  const declRe = new RegExp(`\\b(?:const|let|var)\\s+${ident}\\b[^;\\n]*`, "g");
  for (const m of rawSrc.matchAll(declRe)) {
    if (EMULATOR_BIN_SHAPE.test(m[0])) return true;
  }
  // A function PARAMETER named for the binary counts too -- backend-detect's
  // own probe takes `binPath: string` and spawns it, which is the real site.
  const paramRe = new RegExp(`\\(([^)]*\\b${ident}\\b[^)]*)\\)`, "g");
  for (const m of rawSrc.matchAll(paramRe)) {
    if (EMULATOR_BIN_SHAPE.test(m[1])) return true;
  }
  return false;
}

/** True iff the argv-form call's SECOND argument is an array literal -- the
 * safe form. Looked for immediately after the first-argument identifier and
 * its comma, so `spawnSync(binPath, [flag], {...})` passes and
 * `spawnSync(binPath, someString)` does not. */
function usesArgvArray(codeOnlySrc: string, site: SpawnCallSite): boolean {
  const after = codeOnlySrc.slice(site.index, site.index + 200);
  const idx = after.indexOf(site.arg);
  if (idx === -1) return false;
  const rest = after.slice(idx + site.arg.length);
  return /^\s*,\s*\[/.test(rest);
}

export interface EmulatorSpawnSiteReport {
  file: string;
  emulatorSpawnCalls: SpawnCallSite[];
  /** True when EVERY discovered call in this module uses the argv-array form
   * and none uses a shell command string. */
  allCallsUseSafeForm: boolean;
  shellFormCalls: SpawnCallSite[];
}

/** Scans one module's real source text and reports every emulator spawn call
 * it contains, plus whether the module's safe-form property holds. Returns
 * `undefined` if the module contains no emulator spawn call at all -- callers
 * filter on that to build the discovered site SET. */
function scanModuleForEmulatorSpawnSites(rawSrc: string, file: string): EmulatorSpawnSiteReport | undefined {
  const codeOnlySrc = codeOnly(rawSrc);
  const argvCalls = findArgvSpawnCalls(codeOnlySrc).filter((s) => identNamesEmulatorBinary(s.arg, rawSrc));
  const shellCalls = findShellSpawnCalls(codeOnlySrc);
  const emulatorSpawnCalls = [...argvCalls, ...shellCalls];
  if (emulatorSpawnCalls.length === 0) return undefined;

  const allCallsUseSafeForm = shellCalls.length === 0 && argvCalls.every((s) => usesArgvArray(codeOnlySrc, s));

  return { file, emulatorSpawnCalls, allCallsUseSafeForm, shellFormCalls: shellCalls };
}

/** Every top-level shipped module that contains at least one emulator spawn
 * call, with its full report. */
function discoverEmulatorSpawnSites(): EmulatorSpawnSiteReport[] {
  const reports: EmulatorSpawnSiteReport[] = [];
  for (const file of shippedTsModules()) {
    const rawSrc = readFileSync(join(HERE, file), "utf8");
    const report = scanModuleForEmulatorSpawnSites(rawSrc, file);
    if (report) reports.push(report);
  }
  return reports;
}

/** The frozen expected set. Values name each site's role -- purely
 * documentary, read by the assertion failure messages below, never by the
 * discovery logic itself (which derives the real set independently).
 *
 * ONE entry today, where there were two before plan 29-10. That is not a
 * weakening: the two it replaced both spawned a binary that no longer exists,
 * and this one spawns a binary that does. The set-equality test below still
 * fails in BOTH directions. */
const EXPECTED_EMULATOR_SPAWN_SITES: Readonly<Record<string, string>> = Object.freeze({
  "backend-detect.mts":
    "the --help probe -- probeBackend() runs one candidate flag against the resolved VICE binary to " +
    "classify it as the fork or stock upstream, argv array and shell:false, bounded by a timeout",
});

// -- 1. Set equality, both directions ---------------------------------------

test("the discovered emulator spawn-site set equals EXPECTED_EMULATOR_SPAWN_SITES exactly, in both directions", () => {
  const discovered = discoverEmulatorSpawnSites().map((r) => r.file);
  const discoveredSet = new Set(discovered);
  const expectedFiles = Object.keys(EXPECTED_EMULATOR_SPAWN_SITES);

  const missing = expectedFiles.filter((f) => !discoveredSet.has(f));
  const extra = discovered.filter((f) => !(f in EXPECTED_EMULATOR_SPAWN_SITES));

  assert.deepEqual(
    missing,
    [],
    `expected emulator spawn site(s) not discovered -- either the site no longer spawns it, or the ` +
      `discovery regex regressed: ${missing.join(", ")}`
  );
  assert.deepEqual(
    extra,
    [],
    `an emulator spawn site was discovered that is NOT in EXPECTED_EMULATOR_SPAWN_SITES -- a second spawn ` +
      `site has appeared and must be added to the frozen set (after confirming it uses the argv-array form ` +
      `with no shell string): ${extra.join(", ")}`
  );
  assert.equal(
    Object.keys(EXPECTED_EMULATOR_SPAWN_SITES).length,
    1,
    "EXPECTED_EMULATOR_SPAWN_SITES must have exactly one entry"
  );
});

// -- 2. The safe form at every discovered site -------------------------------

test("every discovered emulator spawn site uses the argv-array form and builds no shell command string", () => {
  const reports = discoverEmulatorSpawnSites();
  assert.ok(reports.length > 0, "no emulator spawn site was discovered at all -- see the non-vacuity test below");
  for (const report of reports) {
    assert.deepEqual(
      report.shellFormCalls.map((c) => `${c.fn}(${c.arg}`),
      [],
      `${report.file} spawns the emulator through a SHELL COMMAND STRING -- an argv array is mandatory here, ` +
        `because a shell string makes the binary path injectable`
    );
    assert.ok(
      report.allCallsUseSafeForm,
      `${report.file}: not every emulator spawn call passes an argv ARRAY as its second argument ` +
        `(the command-injection invariant this seam exists to hold)`
    );
  }
});

// -- 3. Non-vacuity floor -----------------------------------------------------

test("non-vacuity: the scanned module set is real, and at least one emulator spawn call site was discovered", () => {
  const modules = shippedTsModules();
  assert.ok(modules.length >= 40, `expected at least 40 top-level production modules, got ${modules.length}`);

  const reports = discoverEmulatorSpawnSites();
  assert.ok(
    reports.length >= 1,
    "discoverEmulatorSpawnSites() found zero emulator spawn sites -- a discovery pass that finds nothing " +
      "must fail this test, not silently pass a safe-form check with nothing to check"
  );
});

// -- 4. Planted violations (committed), both directions ----------------------

test("planted violation: a module that spawns the emulator through a shell command string is reported unsafe", () => {
  const plantedSource =
    `import { execSync } from "node:child_process";\n` +
    `\n` +
    `export function evilProbe(binPath: string, flag: string) {\n` +
    "  return execSync(`${binPath} ${flag}`, { encoding: \"utf8\" });\n" +
    `}\n`;

  const report = scanModuleForEmulatorSpawnSites(plantedSource, "scratch-evil-spawn-site.ts");
  assert.ok(report, "the planted violation's shell-string spawn must be discovered as a real spawn site");
  assert.equal(
    report!.shellFormCalls.length,
    1,
    "the planted violation interpolates the binary path into a shell command string -- must be reported as a shell-form call"
  );
  assert.equal(
    report!.allCallsUseSafeForm,
    false,
    "a module that spawns the emulator through a shell string must never report allCallsUseSafeForm: true"
  );
});

test("planted violation: a module whose emulator spawn passes an argv array reports safe", () => {
  const guardedSource =
    `import { spawnSync } from "node:child_process";\n` +
    `\n` +
    `export function goodProbe(binPath: string, flag: string) {\n` +
    `  return spawnSync(binPath, [flag], { encoding: "utf8", timeout: 2000 });\n` +
    `}\n`;

  const report = scanModuleForEmulatorSpawnSites(guardedSource, "scratch-good-spawn-site.ts");
  assert.ok(report, "the safe control's spawnSync(binPath, [flag] call must be discovered as a real spawn site");
  assert.equal(report!.shellFormCalls.length, 0);
  assert.equal(report!.allCallsUseSafeForm, true, "a genuinely argv-array module must report allCallsUseSafeForm: true");
});

test("planted violation: an argv-form emulator spawn whose second argument is a bare string, not an array, is reported unsafe", () => {
  const sloppySource =
    `import { spawnSync } from "node:child_process";\n` +
    `\n` +
    `export function sloppyProbe(binPath: string, joinedArgs: string) {\n` +
    `  return spawnSync(binPath, joinedArgs, { shell: true });\n` +
    `}\n`;

  const report = scanModuleForEmulatorSpawnSites(sloppySource, "scratch-sloppy-spawn-site.ts");
  assert.ok(report, "the sloppy control's spawnSync(binPath call must still be discovered as a real spawn site");
  assert.equal(
    report!.allCallsUseSafeForm,
    false,
    "passing a joined string where an argv array belongs must never report allCallsUseSafeForm: true"
  );
});

test("planted violation control: an emulator spawn mention that exists ONLY inside a block comment and a string literal is NOT reported", () => {
  const decoySource =
    `import { spawnSync } from "node:child_process";\n` +
    `\n` +
    `/**\n` +
    ` * This module used to call spawnSync(binPath, argv) directly, before\n` +
    ` * it was refactored to go through probeBackend() instead -- see history.\n` +
    ` */\n` +
    `export const HISTORICAL_NOTE =\n` +
    `  "this module used to call spawnSync(binPath, argv) directly, before it was refactored";\n` +
    `\n` +
    `export function harmless(): void {\n` +
    `  spawnSync("echo", ["not the emulator at all"]);\n` +
    `}\n`;

  const report = scanModuleForEmulatorSpawnSites(decoySource, "scratch-decoy-spawn-site.ts");
  assert.equal(
    report,
    undefined,
    "a spawnSync(binPath mention that exists only inside a comment and a string literal must not be " +
      "discovered as a real emulator spawn call -- codeOnly() must strip both before matching"
  );
});

test("planted violation control: a RegExp.prototype.exec() call is never mistaken for a shell spawn", () => {
  // This directory calls `.exec()` on regexes in a dozen modules. If any of
  // them were discovered as shell spawns, this guard would be red on a
  // correct tree and would be "fixed" by weakening it -- so the negative is
  // pinned here rather than left to luck.
  const regexSource =
    `const RE = /\\bVICE_BIN\\b/g;\n` +
    `export function findIt(text: string) {\n` +
    `  return RE.exec(text);\n` +
    `}\n`;

  const report = scanModuleForEmulatorSpawnSites(regexSource, "scratch-regex-exec.ts");
  assert.equal(report, undefined, "a regex .exec(text) call must never be discovered as an emulator shell spawn");
});

// -- 5. Real-source sanity: the one named site individually ------------------

test("backend-detect.mts's own probeBackend() spawnSync(binPath, [flag] call is discovered and reports safe", () => {
  const src = readFileSync(join(HERE, "backend-detect.mts"), "utf8");
  const report = scanModuleForEmulatorSpawnSites(src, "backend-detect.mts");
  assert.ok(report, "backend-detect.mts must be discovered as an emulator spawn site");
  assert.equal(report!.shellFormCalls.length, 0, "backend-detect.mts must build no shell command string");
  assert.equal(report!.allCallsUseSafeForm, true);
});

test("the one-spawn-site invariant: backend-detect.mts contains exactly ONE emulator spawn call -- a second path means a probe was added without re-running the decision", () => {
  const src = readFileSync(join(HERE, "backend-detect.mts"), "utf8");
  const report = scanModuleForEmulatorSpawnSites(src, "backend-detect.mts");
  assert.ok(report);
  assert.equal(
    report!.emulatorSpawnCalls.length,
    1,
    `expected exactly ONE emulator spawn call in backend-detect.mts -- found ` +
      `${report!.emulatorSpawnCalls.length}. A second spawn path appearing means a probe was added without ` +
      `re-running the single-probe decision, and it must be confirmed safe-form before this number moves.`
  );
});

test("planted violation: duplicating backend-detect.mts's spawn statement into a second function makes the one-spawn-site invariant fail", () => {
  const src = readFileSync(join(HERE, "backend-detect.mts"), "utf8");
  // Reuses the SAME local identifier name ("binPath") the real spawn call
  // uses, so identNamesEmulatorBinary() resolves it exactly the way it
  // resolves the real call's own argument -- a faithful duplicate, not a
  // decoy the detector would ignore for an unrelated reason.
  const duplicated =
    src +
    `\nexport function __scratchSecondProbePath(binPath: string, flag: string) {\n` +
    `  return spawnSync(binPath, [flag], { encoding: "utf8" });\n` +
    `}\n`;
  const before = scanModuleForEmulatorSpawnSites(src, "backend-detect.mts");
  const after = scanModuleForEmulatorSpawnSites(duplicated, "backend-detect.mts");
  assert.equal(before!.emulatorSpawnCalls.length, 1, "sanity: the real file must report exactly one spawn call before duplication");
  assert.notEqual(
    after!.emulatorSpawnCalls.length,
    1,
    "expected the duplicated spawn statement to be discovered as a SECOND emulator spawn site, flipping the " +
      "one-spawn-site invariant to fail -- if this assertion itself fails, the test above is vacuous"
  );
});
