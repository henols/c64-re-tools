#!/usr/bin/env node
// acme-seam.test.ts -- turns two standing disciplines about the assembler
// oracle into checked properties: the set of modules under this server tree
// that launch the assembler as a child process is frozen and reasoned, and
// the set of modules that derive a pass-or-fail by comparing assembler-
// produced bytes against an export's expected bytes is frozen the same way.
//
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// The existing child-launch guard (`spawn-seam.test.ts`) scans for the
// EMULATOR binary, over the published `files[]` module set -- it never looks
// at the assembler oracle at all, because that oracle is deliberately
// test-only and therefore never appears in `files[]`. The skills tree carries
// its own launch guard, and that one scans only the skills tree. Neither
// would notice a brand-new raw assembler launch, or a second byte-comparison
// verdict, added to a fresh module anywhere under this directory -- which is
// exactly where a reassembly gate's own supporting modules get added. Until
// this file, the rule "the assembler is only ever launched from these named
// places, and a pass/fail is only ever derived from bytes in one place" was a
// sentence a reviewer had to remember, not something the suite checked.
//
// GREP-GATE HYGIENE (mandatory, project convention): this file's own header
// and doc comments discuss `spawnSync`, `ACME_BIN` and byte comparisons in
// prose constantly -- an unfiltered text scan of this file's own source would
// find itself. Every pattern below runs against `codeOnly()`-blanked source
// (comments AND string/template literal bodies stripped, regex literals kept
// as real code), imported from its one home rather than re-implemented, so a
// mention in prose or inside a synthetic test string can never register as a
// real call site.
//
// SCOPE, DELIBERATELY THE WHOLE SERVER TREE. This guard does not scope itself
// to the modules this reassembly gate happens to add. It walks every
// `.ts`/`.mts` file under this file's own directory, skipping exactly three
// subtrees by name (see `SKIPPED_TREE_DIRS` below) -- because the failure this
// guard exists to catch is a second launch site or a second comparison
// appearing somewhere nobody was looking, and narrowing the walk to "the
// files this gate added" would make the guard blind to exactly that.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

import { codeOnly } from "./shipped-modules.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// 1. The module walk, shared by both scans below.
// ============================================================================

/** The three subtrees this walk skips, and the reason each is excluded --
 * named here rather than left to be inferred from the skip list alone. */
const SKIPPED_TREE_DIRS: Readonly<Record<string, string>> = Object.freeze({
  node_modules: "third-party dependency code, not this project's own modules",
  resources: "generated .mjs build output compiled from committed .mts sources this walk already visits under their own name -- counting both would double-report one launch site",
  fixtures: "subject data (fixture programs, images, JSON, committed transcripts) for tests, never a module",
});

function walkServerTreeModules(dir: string, baseDir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name in SKIPPED_TREE_DIRS) continue;
      out.push(...walkServerTreeModules(join(dir, entry.name), baseDir));
      continue;
    }
    if (/\.(ts|mts)$/.test(entry.name)) {
      out.push(relative(baseDir, join(dir, entry.name)));
    }
  }
  return out;
}

/** Every `.ts`/`.mts` module under this file's own directory, excluding the
 * three named subtrees above. Deliberately NOT `files[]`-derived (unlike
 * `shippedTsModules()`): the assembler oracle and every one of its test-only
 * companions are deliberately absent from the published package, and scoping
 * this walk to the published set would make it blind to the very modules it
 * exists to watch. */
export function serverTreeModules(): string[] {
  return walkServerTreeModules(HERE, HERE);
}

// ============================================================================
// 2. Scan 1: modules that launch the assembler as a child process.
// ============================================================================

const ARGV_SPAWN_NAMES = ["spawnSync", "spawn", "execFileSync", "execFile"] as const;
const SHELL_SPAWN_NAMES = ["execSync", "exec"] as const;

/** Matches `<spawnFn>(<firstArgToken>` in `codeOnly()`-ed source, capturing
 * the function name and the raw first-argument identifier -- mirrors
 * `spawn-seam.test.ts`'s own `ARGV_CALL_RE` exactly, for the same reason: a
 * string-literal first argument is blanked to nothing by `codeOnly()`, so it
 * can never satisfy the identifier group, which is the intended outcome. */
const ARGV_CALL_RE = new RegExp(`\\b(${ARGV_SPAWN_NAMES.join("|")})\\s*\\(\\s*([A-Za-z_$][A-Za-z0-9_$]*)`, "g");

/** The shell-form call pattern, deliberately looser than the argv form for
 * the same reason `spawn-seam.test.ts` states for its own sibling: a shell
 * spawn's danger is in its argument's shape (an interpolated command string),
 * not in a bare identifier, and `codeOnly()` preserves `${ ... }`
 * interpolation while blanking the surrounding literal text -- so an
 * interpolated binary path arrives here as a run-together token with no word
 * boundary a `\b`-anchored pattern could find. */
const SHELL_CALL_RE = new RegExp(`(?<![.\\w$])(${SHELL_SPAWN_NAMES.join("|")})\\s*\\(\\s*([^)]{0,120})`, "g");

/** Every shape this tree spells the assembler binary. `ACME_BIN` is the
 * env-var-backed constant (`acme-gate.ts`); `acmeBin` is the option field a
 * caller may override it with (`AcmeVerifyOptions.acmeBin`); `assemblerBin`
 * is the byte-diff oracle's own local, resolved from `options.acmeBin ??
 * ACME_BIN`; `acmePath` is the typed host-tool op's own local. Word-anchored,
 * for the argv form, where the identifier stands alone. */
const ASSEMBLER_BIN_SHAPE = /\bACME_BIN\b|\bacmeBin\b|\bassemblerBin\b|\bacmePath\b/;

/** The same names, UNANCHORED, for the shell-form call's run-together
 * argument text -- see `SHELL_CALL_RE`'s own doc comment for why. */
const ASSEMBLER_BIN_SUBSTRING = /ACME_BIN|acmeBin|assemblerBin|acmePath/;

/** True iff `ident` is, anywhere in the module, one of the named shapes
 * directly, or a local declared or received as a PARAMETER from an
 * expression that mentions one. The declaration and parameter scans run
 * against the FULL RAW source, not `codeOnlySrc`, so a literal default (a
 * string constant assigned to a shape-named local) is still recognised even
 * though `codeOnly()` would blank the literal text itself.
 *
 * The parameter scan is anchored to a genuine parameter LIST -- a
 * parenthesised group immediately followed by an arrow (`=>`) or an opening
 * brace (`{`), with an optional return-type annotation in between -- rather
 * than any parenthesised text containing `ident` anywhere in the file. An
 * unanchored version would also match an ordinary CALL's argument list, and
 * this tree has a real coincidence that proves the distinction matters: one
 * file spawns `process.execPath` (captured identifier `process`, unrelated to
 * the assembler) and, elsewhere in the same file, asserts
 * `ACME_BIN` against `process.env.ACME_BIN` inside an ordinary call -- an
 * unanchored scan would misread that call's own argument list as a parameter
 * declaration naming `process` after the assembler, which is false. */
function identNamesAssembler(ident: string, rawSrc: string): boolean {
  if (ASSEMBLER_BIN_SHAPE.test(ident)) return true;
  const declRe = new RegExp(`\\b(?:const|let|var)\\s+${ident}\\b[^;\\n]*`, "g");
  for (const m of rawSrc.matchAll(declRe)) {
    if (ASSEMBLER_BIN_SHAPE.test(m[0])) return true;
  }
  const paramRe = new RegExp(`\\(([^)]*\\b${ident}\\b[^)]*)\\)\\s*(?::[^{=]+)?\\s*(?:=>|\\{)`, "g");
  for (const m of rawSrc.matchAll(paramRe)) {
    if (ASSEMBLER_BIN_SHAPE.test(m[1]!)) return true;
  }
  return false;
}

interface AcmeSpawnCallSite {
  /** The launch function used: `spawnSync`, `spawn`, `execFileSync`,
   * `execFile`, `execSync` or `exec`. */
  fn: string;
  /** The identifier (argv form) or the run-together argument text (shell
   * form) that named the assembler. */
  arg: string;
  shellForm: boolean;
}

export interface AcmeSpawnSiteReport {
  file: string;
  calls: AcmeSpawnCallSite[];
}

/** Scans one module's real source text for a call that launches the
 * assembler, in either call shape. Returns `undefined` when the module
 * contains no such call -- callers filter on that to build the discovered
 * site set. */
function scanModuleForAcmeSpawnSites(rawSrc: string, file: string): AcmeSpawnSiteReport | undefined {
  const codeOnlySrc = codeOnly(rawSrc);
  const calls: AcmeSpawnCallSite[] = [];

  for (const m of codeOnlySrc.matchAll(ARGV_CALL_RE)) {
    const fn = m[1]!;
    const arg = m[2]!;
    if (identNamesAssembler(arg, rawSrc)) calls.push({ fn, arg, shellForm: false });
  }
  for (const m of codeOnlySrc.matchAll(SHELL_CALL_RE)) {
    const fn = m[1]!;
    const argText = (m[2] ?? "").trim();
    if (ASSEMBLER_BIN_SUBSTRING.test(argText)) calls.push({ fn, arg: argText, shellForm: true });
  }

  if (calls.length === 0) return undefined;
  return { file, calls };
}

/** Every module under the server tree that launches the assembler, with its
 * full report. Re-derived from disk on every call, deterministically -- see
 * the "two runs produce the same set" case below. */
export function scanAcmeSpawnSites(): AcmeSpawnSiteReport[] {
  const reports: AcmeSpawnSiteReport[] = [];
  for (const file of serverTreeModules()) {
    const rawSrc = readFileSync(join(HERE, file), "utf8");
    const report = scanModuleForAcmeSpawnSites(rawSrc, file);
    if (report) reports.push(report);
  }
  return reports;
}

/** A file this scan's own name-based identifier resolution structurally
 * cannot find -- its launch passes a RESOLVED GENERIC TOOL PATH shared by
 * several different external tools, never an assembler-named identifier.
 * Declared here so its absence from a name-based discovery is never
 * misread as "this file does not launch the assembler", which would be
 * false. */
const NAME_SCAN_BLIND_MEMBERS: ReadonlySet<string> = new Set(["host-tool.mts"]);

/** The frozen declared set. Membership MUST be derived by RUNNING
 * `scanAcmeSpawnSites()` against the real tree and reading what it reports --
 * never assumed. Declared EMPTY here first, deliberately: the two set-
 * equality directions below must fail against the real tree before this set
 * is filled in, so the failure itself is the measurement that drives what
 * gets declared. */
export const ACME_SPAWN_SITES: Readonly<Record<string, string>> = Object.freeze({});

/** Every module name that identifies it as belonging to this gate's own
 * implementation, never a legitimate spawn or comparison site: the gate's
 * verdict must come from the one byte-diff oracle, never from a launch or a
 * comparison minted inside the gate's own modules. */
const GATE_MODULE_NAME_RE = /^reassembly-gate/;

test("acme seam: the module walk returns every source module under the server tree and none from the dependency, compiled-output or fixture directories", () => {
  const modules = serverTreeModules();
  assert.ok(modules.length > 100, `the walk found only ${modules.length} modules -- a walk that broke and returned almost nothing must fail loudly, not pass vacuously`);
  for (const m of modules) {
    assert.ok(!m.startsWith("node_modules/") && m !== "node_modules", `the dependency directory must never appear in the walk: ${m}`);
    assert.ok(!m.startsWith("resources/") && m !== "resources", `the compiled-output directory must never appear in the walk: ${m}`);
    assert.ok(!m.startsWith("fixtures/") && m !== "fixtures", `the fixture directory must never appear in the walk: ${m}`);
  }
});

test("acme seam: the scan reports the launch function and the identifier launched for each flagged module", () => {
  const reports = scanAcmeSpawnSites();
  assert.ok(reports.length > 0, "the real tree must contain at least one discoverable assembler spawn site for this case to mean anything");
  for (const report of reports) {
    assert.ok(report.calls.length > 0, `${report.file} was flagged but its own report carries zero calls`);
    for (const call of report.calls) {
      assert.ok(call.fn.length > 0, `${report.file}: a reported call must name its launch function`);
      assert.ok(call.arg.length > 0, `${report.file}: a reported call must name the identifier (or argument text) that launched the assembler`);
    }
  }
});

test("acme seam: every module the scan flags appears in the frozen declared set", () => {
  const discovered = scanAcmeSpawnSites().map((r) => r.file);
  const extra = discovered.filter((f) => !(f in ACME_SPAWN_SITES));
  assert.deepEqual(
    extra,
    [],
    `an assembler spawn site was discovered that is NOT in ACME_SPAWN_SITES -- a new spawn site has appeared and is a ` +
      `design question to answer (and record a reason for) before the set is edited: ${extra.join(", ")}`
  );
});

test("acme seam: every module in the frozen declared set that the scan is capable of finding is actually found by it", () => {
  const discoveredSet = new Set(scanAcmeSpawnSites().map((r) => r.file));
  const expectedDiscoverable = Object.keys(ACME_SPAWN_SITES).filter((f) => !NAME_SCAN_BLIND_MEMBERS.has(f));
  const missing = expectedDiscoverable.filter((f) => !discoveredSet.has(f));
  assert.deepEqual(
    missing,
    [],
    `declared assembler spawn site(s) no longer discovered -- either the site no longer spawns it, or the declaration ` +
      `is now stale: ${missing.join(", ")}`
  );
});

test("acme seam: a synthetic module source containing a raw assembler launch is flagged", () => {
  const src =
    `import { spawnSync } from "node:child_process";\n` +
    `\n` +
    `export function probe(acmeBin: string) {\n` +
    `  return spawnSync(acmeBin, ["--version"], { encoding: "utf8" });\n` +
    `}\n`;
  const report = scanModuleForAcmeSpawnSites(src, "scratch-acme-spawn-probe.ts");
  assert.ok(report, "a raw assembler launch must be discovered as a real spawn site");
  assert.equal(report!.calls.length, 1);
  assert.equal(report!.calls[0]!.fn, "spawnSync");
});

test("acme seam: a synthetic module source containing a launch of an unrelated binary is not flagged", () => {
  const src =
    `import { spawnSync } from "node:child_process";\n` +
    `\n` +
    `export function probe(binPath: string) {\n` +
    `  return spawnSync(binPath, ["--help"], { encoding: "utf8" });\n` +
    `}\n`;
  const report = scanModuleForAcmeSpawnSites(src, "scratch-unrelated-spawn-probe.ts");
  assert.equal(report, undefined, "a launch of an unrelated binary must never be discovered as an assembler spawn site");
});

test("acme seam: no module whose name identifies it as part of this phase's gate appears in the scan's result or in the frozen spawn-site set", () => {
  const discovered = scanAcmeSpawnSites().map((r) => r.file);
  for (const f of discovered) {
    assert.ok(!GATE_MODULE_NAME_RE.test(f), `a gate module (${f}) was discovered as an assembler spawn site -- the gate's own verdict must come only from the byte-diff oracle`);
  }
  for (const f of Object.keys(ACME_SPAWN_SITES)) {
    assert.ok(!GATE_MODULE_NAME_RE.test(f), `a gate module (${f}) must never be added to ACME_SPAWN_SITES`);
  }
});

// ============================================================================
// 3. The oracle's own shape: exactly one launch, exactly one verdict body.
// ============================================================================

const FUNCTION_DECL_RE = /(?:export\s+)?function\s+(\w+)\s*(\()/g;

/** True-typed brace-matched body extraction for a `function name(` match
 * ending at `openParenIndex` (the index of the opening `(` of its parameter
 * list). Walks past the parameter list (paren-balanced, so a parameter's own
 * parenthesised type is not mistaken for the list's end), past any return
 * type annotation with no braces of its own, to the function's opening `{`,
 * then returns the brace-matched body span. */
function functionBodyRange(codeOnlySrc: string, openParenIndex: number): { start: number; end: number } | undefined {
  if (codeOnlySrc[openParenIndex] !== "(") return undefined;
  let i = openParenIndex;
  let depth = 0;
  for (; i < codeOnlySrc.length; i++) {
    if (codeOnlySrc[i] === "(") depth++;
    else if (codeOnlySrc[i] === ")") {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  while (i < codeOnlySrc.length && codeOnlySrc[i] !== "{") i++;
  if (codeOnlySrc[i] !== "{") return undefined;
  const start = i;
  depth = 0;
  for (; i < codeOnlySrc.length; i++) {
    if (codeOnlySrc[i] === "{") depth++;
    else if (codeOnlySrc[i] === "}") {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  return { start, end: i };
}

/** After `codeOnly()` blanks a quoted literal entirely (quotes included), a
 * return site like `outcome: "ok",` becomes `outcome: ,` -- while the TYPE
 * field `outcome: AcmeOutcome;` is unaffected, because `AcmeOutcome` is an
 * identifier, not a literal. This marker therefore matches only a real
 * *value* assignment to an `outcome` field, never the type declaration. */
const OUTCOME_RETURN_MARKER_RE = /\boutcome\s*:\s*,/;

/** Every top-level `function name(...) { ... }` declaration in `rawSrc` whose
 * body assigns a literal value to an `outcome` field -- i.e. every function
 * that can itself produce one of this module's outcome tokens, as opposed to
 * a function that merely calls one and returns its result unchanged. */
export function functionsReturningOutcomeToken(rawSrc: string): string[] {
  const codeOnlySrc = codeOnly(rawSrc);
  const names: string[] = [];
  for (const m of codeOnlySrc.matchAll(FUNCTION_DECL_RE)) {
    const openParenIndex = m.index! + m[0].length - 1;
    const range = functionBodyRange(codeOnlySrc, openParenIndex);
    if (!range) continue;
    const body = codeOnlySrc.slice(range.start, range.end);
    if (OUTCOME_RETURN_MARKER_RE.test(body)) names.push(m[1]!);
  }
  return names;
}

test("acme seam: the assembler oracle contains exactly one launch call site and exactly one function body returning an outcome token", () => {
  const rawSrc = readFileSync(join(HERE, "acme-verify.ts"), "utf8");

  const report = scanModuleForAcmeSpawnSites(rawSrc, "acme-verify.ts");
  assert.ok(report, "the byte-diff oracle must be discovered as an assembler spawn site");
  assert.equal(report!.calls.length, 1, `the byte-diff oracle must contain exactly one child-launch call site, found ${report!.calls.length}`);

  const outcomeFns = functionsReturningOutcomeToken(rawSrc);
  assert.equal(
    outcomeFns.length,
    1,
    `the byte-diff oracle must contain exactly one function body that returns an outcome token, found: ${outcomeFns.join(", ") || "(none)"}`
  );
});

// ============================================================================
// 4. Determinism backstop.
// ============================================================================

test("acme seam: two runs of the scan over an unchanged tree produce the same set, in the same order", () => {
  const spawnFirst = scanAcmeSpawnSites().map((r) => r.file);
  const spawnSecond = scanAcmeSpawnSites().map((r) => r.file);
  assert.deepEqual(spawnSecond, spawnFirst, "scanAcmeSpawnSites() must be deterministic across repeated runs");
});
