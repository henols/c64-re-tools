#!/usr/bin/env node
// r2000-spawn-seam.test.ts -- turns R2000-01's spawn-seam invariant into a
// checked property (INT-02, D-11.1-05): every regenerator2000 spawn call
// site in this repo must call `assertNoViceFlag(argv)` before spawning,
// and the set of sites that exist is pinned so a future third site cannot
// appear unguarded and go unnoticed.
//
// WHY THIS FILE EXISTS: `r2000-launch.ts`'s header used to claim it was the
// ONE place in this repo that spawns regenerator2000. That was false --
// `r2000-mcp-client.ts:332` is a second, necessary spawn site (`withR2000-
// Session()` needs a long-lived async child, which `runR2000()`'s blocking
// `spawnSync` cannot provide). `R2000-01` itself was never compromised --
// both sites call `assertNoViceFlag(argv)` first -- but a maintainer
// trusting the wrong header would not know a THIRD site must guard too.
// This file replaces that prose promise with a mechanically checked one.
//
// DISCOVERY, not enumeration (11.1-CONTEXT.md's organising principle): the
// scanned module set is derived from `package.json`'s `files[]` array --
// the SHIPPED production `.ts`/`.mts` module set, the exact
// `shippedTsModules()` idiom `docs-dangling-refs.test.ts` already
// established, copied rather than reinvented (see that function's own
// comment below for why this is `files[]`-derived rather than a raw
// `readdirSync` filtered only on `*.test.*` -- `r2000-test-gate.ts` is a
// real, but non-shipped, spawn call site that the broader directory
// listing would incorrectly catch). Within that derived set, this file
// finds every call to a spawn-family function whose first argument is a
// regenerator2000-binary-shaped expression, and asserts the discovered set
// of FILES equals `EXPECTED_R2000_SPAWN_SITES` exactly, in both directions
// -- a third site appearing, or one of the two disappearing, both FAIL.
//
// GREP-GATE HYGIENE (mandatory, CLAUDE.md): this directory's own headers
// and doc comments discuss `spawnSync`, `spawn(bin, argv, ...)` and the
// regenerator2000 binary constantly in prose -- an unfiltered text scan
// would be self-invalidating. `codeOnly()` below strips BOTH comments
// (`//` and `/* */`, reusing `r2000-launch.test.ts`'s WR-02-fixed
// close-token-by-position algorithm) AND string/template literal bodies
// (adapting `docs-dangling-refs.test.ts`'s character-scanning literal
// extractor to blank literal text instead of collecting it) before any
// spawn-call pattern is matched -- so neither a comment describing a spawn
// call, nor a string literal that merely quotes one, can be discovered as
// a real call site. The planted-violation test below proves both traps are
// closed, not merely asserts they are.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

// -- codeOnly(): strip comments AND string/template literal bodies --------
//
// Real code (including any `${ ... }` interpolation inside a template
// literal) is preserved verbatim; comment text and quoted-literal text are
// dropped entirely. This is deliberately a superset of `r2000-launch.test
// .ts`'s `stripCommentLines()`: that function strips comments only, which
// is not enough here -- a decoy string literal that merely quotes
// `spawnSync(R2000_BIN` as prose text must not be discoverable as a call.
function codeOnly(src: string): string {
  const out: string[] = [];
  const n = src.length;
  let i = 0;
  let inTemplateText = false;
  let inInterp = false;
  let interpBraceDepth = 0;
  const templateStack: { inInterp: boolean; interpBraceDepth: number }[] = [];

  while (i < n) {
    const c = src[i];
    const top = templateStack.length > 0 ? templateStack[templateStack.length - 1] : undefined;
    inTemplateText = top !== undefined && !top.inInterp;
    inInterp = top !== undefined && top.inInterp;

    if (inTemplateText) {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === "`") {
        templateStack.pop();
        i++;
        continue;
      }
      if (c === "$" && src[i + 1] === "{") {
        top!.inInterp = true;
        top!.interpBraceDepth = 1;
        i += 2;
        continue;
      }
      i++; // drop template literal text
      continue;
    }

    // Top-level code, or inside a template literal's `${ ... }`
    // interpolation -- both are real code and both get the same handling
    // below (comments/quoted-literals/nested-templates), only the
    // interpolation-close bookkeeping differs.
    if (c === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\") {
          i += 2;
          continue;
        }
        i++;
      }
      i++; // skip closing quote
      continue; // the entire quoted literal contributes nothing to "code"
    }
    if (c === "`") {
      templateStack.push({ inInterp: false, interpBraceDepth: 0 });
      i++;
      continue;
    }
    if (inInterp) {
      if (c === "{") {
        top!.interpBraceDepth++;
        out.push(c);
        i++;
        continue;
      }
      if (c === "}") {
        top!.interpBraceDepth--;
        i++;
        if (top!.interpBraceDepth === 0) {
          top!.inInterp = false;
        } else {
          out.push(c);
        }
        continue;
      }
    }
    out.push(c);
    i++;
  }
  return out.join("");
}

/** The scanned module set: every `package.json` `files[]` entry ending
 * `.ts`/`.mts` -- the SHIPPED production module set, derived rather than
 * enumerated (`docs-dangling-refs.test.ts`'s `shippedTsModules()` idiom,
 * copied verbatim rather than reinvented). Deliberately NOT a raw
 * `readdirSync` over every non-`*.test.*` file in this directory: that
 * broader set also catches genuinely test-only helpers that merely fail
 * to end in `.test.ts` by name -- `r2000-test-gate.ts` is exactly this
 * shape (its own header states "This module is TEST-ONLY... it must never
 * be imported by a production module", and it is deliberately absent from
 * `files[]` for that reason) and itself calls `spawnSync(R2000_BIN,
 * ["--version"], ...)` as a live-availability probe with a FIXED,
 * hardcoded argv that can never carry `--vice` -- a real call, but not one
 * `R2000-01`'s guard-before-user-facing-argv invariant is about, and not
 * a file a maintainer ships. Scanning `files[]` instead of the raw
 * directory listing is what keeps that probe out of
 * `EXPECTED_R2000_SPAWN_SITES` without an exclusion list -- the same
 * "derive, don't enumerate" principle applied one level up, to WHICH set
 * is scanned rather than only to HOW it is scanned. A `files[]` entry that
 * does not exist on disk FAILS this function rather than letting the
 * scanned set silently shrink (the INT-01 lesson, applied here too). */
function shippedTsModules(): string[] {
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files?: string[] };
  const entries = (pkg.files ?? []).filter((f) => /\.(ts|mts)$/.test(f));
  for (const entry of entries) {
    assert.ok(
      existsSync(join(HERE, entry)),
      `package.json files[] names ${entry} but it does not exist on disk -- update files[] rather than letting the scanned set shrink silently`
    );
  }
  return entries;
}

/** Spawn-family function names this guard watches. `execSync` is
 * deliberately omitted -- it takes a shell command STRING, not an argv
 * array, and no regenerator2000 call site in this repo (or that could pass
 * `assertNoViceFlag`, which scans an argv array) uses it; adding it here
 * would only ever match a false positive. */
const SPAWN_FUNCTION_NAMES = ["spawnSync", "spawn", "execFileSync", "execFile", "exec"] as const;

/** Matches `<spawnFn>(<firstArgToken>` in already-`codeOnly()`-ed source,
 * capturing the function name and the raw first-argument token (an
 * identifier, or a quoted/backtick string -- `codeOnly()` has already
 * blanked literal bodies, so a string-literal first argument surfaces here
 * as an empty pair of quote characters, which `isR2000BinaryExpression()`
 * below treats as "not a literal that names regenerator2000", correctly,
 * since the literal's actual text was never real code to begin with). */
const SPAWN_CALL_RE = new RegExp(`\\b(${SPAWN_FUNCTION_NAMES.join("|")})\\s*\\(\\s*([A-Za-z_$][A-Za-z0-9_$]*)`, "g");

interface SpawnCallSite {
  fn: string;
  arg: string;
  index: number;
}

/** Every spawn-family call in `codeOnlySrc`, with the call's start index
 * (used by the guard-before-spawn ordering check below) and its bare first
 * argument identifier (a quoted-literal first argument does not match this
 * regex at all, since `codeOnly()` already removed its text -- see
 * `SPAWN_CALL_RE`'s own comment). */
function findSpawnCalls(codeOnlySrc: string): SpawnCallSite[] {
  const sites: SpawnCallSite[] = [];
  for (const m of codeOnlySrc.matchAll(SPAWN_CALL_RE)) {
    sites.push({ fn: m[1], arg: m[2], index: m.index ?? -1 });
  }
  return sites;
}

/** True iff `ident` is, anywhere in `codeOnlySrc`, declared/assigned from
 * an expression that resolves to the regenerator2000 binary name --
 * `R2000_BIN` itself, or a local variable whose declaration mentions
 * `process.env.R2000_BIN` or the literal binary name (matched against the
 * FULL raw source, not `codeOnlySrc`, specifically so a literal default
 * like `"regenerator2000"` -- which `codeOnly()` blanks out because it is a
 * string literal -- is still recognised as naming the binary). */
function identNamesR2000Binary(ident: string, codeOnlySrc: string, rawSrc: string): boolean {
  if (ident === "R2000_BIN") return true;
  const declRe = new RegExp(`\\b(?:const|let|var)\\s+${ident}\\b[^;\\n]*`, "g");
  for (const m of rawSrc.matchAll(declRe)) {
    if (/R2000_BIN|regenerator2000/.test(m[0])) return true;
  }
  return false;
}

/** True iff the call's first argument is a regenerator2000-binary-shaped
 * expression -- `R2000_BIN` directly, or a local identifier resolved from
 * it, per `identNamesR2000Binary()`. A bare literal first argument (e.g.
 * `spawn("/usr/bin/x64sc", ...)`) never matches `SPAWN_CALL_RE` in the
 * first place, since `codeOnly()` already blanked its text -- there is
 * nothing here to misidentify as "regenerator2000" from a stripped
 * literal, by construction. */
function isR2000SpawnCall(site: SpawnCallSite, codeOnlySrc: string, rawSrc: string): boolean {
  return identNamesR2000Binary(site.arg, codeOnlySrc, rawSrc);
}

/** The index of the first `assertNoViceFlag(` call in `codeOnlySrc`, or -1
 * if the module never calls it (as either an import or a call). */
function firstAssertNoViceFlagCallIndex(codeOnlySrc: string): number {
  const m = /\bassertNoViceFlag\s*\(/.exec(codeOnlySrc);
  return m ? m.index : -1;
}

/** True iff `codeOnlySrc` imports (or, for the guard's own defining
 * module, defines) `assertNoViceFlag`. */
function importsOrDefinesAssertNoViceFlag(codeOnlySrc: string): boolean {
  return /\bassertNoViceFlag\b/.test(codeOnlySrc);
}

export interface R2000SpawnSiteReport {
  file: string;
  r2000SpawnCalls: SpawnCallSite[];
  guardsBeforeEverySpawn: boolean;
  importsOrDefinesGuard: boolean;
}

/** Scans one module's real source text and reports every regenerator2000
 * spawn call it contains, plus whether the module's guard-before-spawn
 * property holds. Returns `undefined` if the module contains no
 * regenerator2000 spawn call at all -- callers filter on that to build the
 * discovered site SET. */
function scanModuleForR2000SpawnSites(rawSrc: string, file: string): R2000SpawnSiteReport | undefined {
  const codeOnlySrc = codeOnly(rawSrc);
  const allSpawnCalls = findSpawnCalls(codeOnlySrc);
  const r2000SpawnCalls = allSpawnCalls.filter((s) => isR2000SpawnCall(s, codeOnlySrc, rawSrc));
  if (r2000SpawnCalls.length === 0) return undefined;

  const guardIdx = firstAssertNoViceFlagCallIndex(codeOnlySrc);
  const guardsBeforeEverySpawn = guardIdx !== -1 && r2000SpawnCalls.every((s) => guardIdx < s.index);

  return {
    file,
    r2000SpawnCalls,
    guardsBeforeEverySpawn,
    importsOrDefinesGuard: importsOrDefinesAssertNoViceFlag(codeOnlySrc),
  };
}

/** Every top-level production module that contains at least one
 * regenerator2000 spawn call, with its full report. */
function discoverR2000SpawnSites(): R2000SpawnSiteReport[] {
  const reports: R2000SpawnSiteReport[] = [];
  for (const file of shippedTsModules()) {
    const rawSrc = readFileSync(join(HERE, file), "utf8");
    const report = scanModuleForR2000SpawnSites(rawSrc, file);
    if (report) reports.push(report);
  }
  return reports;
}

/** The frozen, exactly-two-entry expected set (INT-02/D-11.1-05). Values
 * name each site's role -- purely documentary, read by the assertion
 * failure messages below, never by the discovery logic itself (which
 * derives the real set independently). */
const EXPECTED_R2000_SPAWN_SITES: Readonly<Record<string, string>> = Object.freeze({
  "r2000-launch.ts": "sync CLI seam -- runR2000()'s blocking spawnSync",
  "r2000-mcp-client.ts": "async MCP session -- withR2000Session()'s long-lived spawn",
});

// -- 1. Set equality, both directions ---------------------------------------

test("the discovered regenerator2000 spawn-site set equals EXPECTED_R2000_SPAWN_SITES exactly, in both directions", () => {
  const discovered = discoverR2000SpawnSites().map((r) => r.file);
  const discoveredSet = new Set(discovered);
  const expectedFiles = Object.keys(EXPECTED_R2000_SPAWN_SITES);

  const missing = expectedFiles.filter((f) => !discoveredSet.has(f));
  const extra = discovered.filter((f) => !(f in EXPECTED_R2000_SPAWN_SITES));

  assert.deepEqual(
    missing,
    [],
    `expected regenerator2000 spawn site(s) not discovered -- either the site no longer spawns it, or the ` +
      `discovery regex regressed: ${missing.join(", ")}`
  );
  assert.deepEqual(
    extra,
    [],
    `a regenerator2000 spawn site was discovered that is NOT in EXPECTED_R2000_SPAWN_SITES -- a third spawn ` +
      `site has appeared and must be added to the frozen set (after confirming it guards with ` +
      `assertNoViceFlag(), per R2000-01): ${extra.join(", ")}`
  );
  assert.equal(Object.keys(EXPECTED_R2000_SPAWN_SITES).length, 2, "EXPECTED_R2000_SPAWN_SITES must have exactly two entries");
});

// -- 2. Guard-before-spawn ---------------------------------------------------

test("every discovered regenerator2000 spawn site calls assertNoViceFlag(argv) before every regenerator2000 spawn in that file", () => {
  const reports = discoverR2000SpawnSites();
  assert.ok(reports.length > 0, "no regenerator2000 spawn site was discovered at all -- see the non-vacuity test below");
  for (const report of reports) {
    assert.ok(
      report.importsOrDefinesGuard,
      `${report.file} spawns regenerator2000 but does not import or define assertNoViceFlag`
    );
    assert.ok(
      report.guardsBeforeEverySpawn,
      `${report.file}: assertNoViceFlag(argv) does not precede every regenerator2000 spawn call in this file ` +
        `(R2000-01's spawn-before-guard invariant is violated)`
    );
  }
});

// -- 3. Non-vacuity floor -----------------------------------------------------

test("non-vacuity: the scanned module set is real, and at least one regenerator2000 spawn call site was discovered", () => {
  const modules = shippedTsModules();
  assert.ok(modules.length >= 40, `expected at least 40 top-level production modules, got ${modules.length}`);

  const reports = discoverR2000SpawnSites();
  assert.ok(
    reports.length >= 1,
    "discoverR2000SpawnSites() found zero regenerator2000 spawn sites -- a discovery pass that finds nothing " +
      "must fail this test, not silently pass a guard-before-spawn check with nothing to check"
  );
});

// -- 4. Planted violation (committed), both directions -----------------------

test("planted violation: a module that spawns R2000_BIN with no assertNoViceFlag anywhere is reported as guard-missing", () => {
  const plantedSource =
    `import { spawnSync } from "node:child_process";\n` +
    `import { R2000_BIN } from "./r2000-launch.ts";\n` +
    `\n` +
    `export function evilRunR2000(argv: readonly string[]) {\n` +
    `  return spawnSync(R2000_BIN, [...argv], { encoding: "utf8" });\n` +
    `}\n`;

  const report = scanModuleForR2000SpawnSites(plantedSource, "scratch-evil-spawn-site.ts");
  assert.ok(report, "the planted violation's spawnSync(R2000_BIN call must be discovered as a real spawn site");
  assert.equal(
    report!.importsOrDefinesGuard,
    false,
    "the planted violation imports R2000_BIN but never assertNoViceFlag -- must be reported guard-missing"
  );
  assert.equal(
    report!.guardsBeforeEverySpawn,
    false,
    "a module with no assertNoViceFlag call at all must never report guardsBeforeEverySpawn: true"
  );
});

test("planted violation: a module whose spawnSync(R2000_BIN call is preceded by assertNoViceFlag reports guarded", () => {
  const guardedSource =
    `import { spawnSync } from "node:child_process";\n` +
    `import { R2000_BIN, assertNoViceFlag } from "./r2000-launch.ts";\n` +
    `\n` +
    `export function goodRunR2000(argv: readonly string[]) {\n` +
    `  assertNoViceFlag(argv);\n` +
    `  return spawnSync(R2000_BIN, [...argv], { encoding: "utf8" });\n` +
    `}\n`;

  const report = scanModuleForR2000SpawnSites(guardedSource, "scratch-good-spawn-site.ts");
  assert.ok(report, "the guarded control's spawnSync(R2000_BIN call must be discovered as a real spawn site");
  assert.equal(report!.guardsBeforeEverySpawn, true, "a genuinely guard-first module must report guardsBeforeEverySpawn: true");
});

test("planted violation control: a spawnSync(R2000_BIN mention that exists ONLY inside a block comment and a string literal is NOT reported", () => {
  const decoySource =
    `import { spawnSync } from "node:child_process";\n` +
    `\n` +
    `/**\n` +
    ` * This module used to call spawnSync(R2000_BIN, argv) directly, before\n` +
    ` * it was refactored to go through runR2000() instead -- see history.\n` +
    ` */\n` +
    `export const HISTORICAL_NOTE =\n` +
    `  "this module used to call spawnSync(R2000_BIN, argv) directly, before it was refactored";\n` +
    `\n` +
    `export function harmless(): void {\n` +
    `  spawnSync("echo", ["not regenerator2000 at all"]);\n` +
    `}\n`;

  const report = scanModuleForR2000SpawnSites(decoySource, "scratch-decoy-spawn-site.ts");
  assert.equal(
    report,
    undefined,
    "a spawnSync(R2000_BIN mention that exists only inside a comment and a string literal must not be " +
      "discovered as a real regenerator2000 spawn call -- codeOnly() must strip both before matching"
  );
});

// -- 5. Real-source sanity: the two named sites individually --------------

test("r2000-launch.ts's own runR2000() spawnSync(R2000_BIN call is discovered and reports guarded", () => {
  const src = readFileSync(join(HERE, "r2000-launch.ts"), "utf8");
  const report = scanModuleForR2000SpawnSites(src, "r2000-launch.ts");
  assert.ok(report, "r2000-launch.ts must be discovered as a regenerator2000 spawn site");
  assert.equal(report!.guardsBeforeEverySpawn, true);
});

test("r2000-mcp-client.ts's withR2000Session() spawn(bin, argv, ...) call is discovered and reports guarded", () => {
  const src = readFileSync(join(HERE, "r2000-mcp-client.ts"), "utf8");
  const report = scanModuleForR2000SpawnSites(src, "r2000-mcp-client.ts");
  assert.ok(report, "r2000-mcp-client.ts must be discovered as a regenerator2000 spawn site");
  assert.equal(report!.guardsBeforeEverySpawn, true);
});
