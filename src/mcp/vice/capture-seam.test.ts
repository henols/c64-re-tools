// capture-seam.test.ts -- `CAP-03`'s STRUCTURAL bar: the captured 64K is barred
// by SHAPE from becoming a conjunct of the stop-identity oracle.
//
// WHY A STRUCTURAL TEST AND NOT A PARAGRAPH (`D-26`): the oracle certifies a
// STOP, and the captured 64K is the dependent variable that certification
// licenses a claim about. If the capture could reach the oracle, two runs that
// stopped in genuinely different places could be certified "the same stop"
// because their memory happened to agree -- a capture participating in
// certifying itself. That circularity is ONE-WAY: once it has certified a
// capture it cannot be laundered back out of that capture's record. A comment
// asking the next editor not to do it cannot notice when they do. Two
// assertions can:
//
//   1. IMPORT CENSUS, BOTH DIRECTIONS, static and dynamic. The predicate names
//      no specifier resolving to the oracle module, and the oracle names none
//      resolving to the predicate. Both directions, because the circularity is
//      symmetric and a one-directional guard leaves half of it open.
//   2. SIGNATURE CHECK. No exported function of the oracle declares an
//      image-buffer parameter -- `Buffer`, `Uint8Array`, `ArrayBufferView` or
//      `ArrayBuffer`. A signature is the right instrument precisely because the
//      next edit cannot make the capture a conjunct without changing one, and
//      this test reads the signatures rather than trusting them.
//
// WHY THE CENSUS READS FILES RATHER THAN SHELLING OUT TO A TEXT SEARCH. Not
// style: one source file in this tree carries a NUL byte, which makes a plain
// `grep` treat it as binary and skip it silently. A shelled-out census
// therefore UNDER-COVERS while still reporting success, and that exact blind
// spot has already produced one false decision in this project. Reading sources
// with `readFileSync` and stripping them through `codeOnly()` makes the hazard
// unreachable by construction rather than merely avoided by remembering a flag.
// For the same reason the scanned set is `shippedTsModules()` -- derived from
// `package.json`'s `files[]`, and it THROWS on an entry missing from disk --
// never a local `readdirSync`, which cannot tell a shipped module from a
// test-only helper.
//
// EVERY ASSERTION HERE IS PAIRED WITH A PLANTED POSITIVE CONTROL, and every
// plant is paired with a clean control over the real tree. A red with no green
// beside it is not a proof: it could be the fixture, the harness, or an
// unrelated refusal firing first.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { codeOnly, shippedTsModules } from "./shipped-modules.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The two modules the bar sits between. */
const PREDICATE = "capture-predicate.ts";
const ORACLE = "stop-oracle.ts";

/** Their specifier stems, as an import would name them (with or without an
 * extension, with or without a leading `./`). */
const PREDICATE_STEM = "capture-predicate";
const ORACLE_STEM = "stop-oracle";

/** The parameter types that would make the captured 64K reachable from the
 * oracle by SHAPE. `ArrayBuffer` and `ArrayBufferView` are here alongside the
 * two obvious ones because either is a complete route to the same bytes. */
const IMAGE_PARAM_TYPES = ["Buffer", "Uint8Array", "ArrayBufferView", "ArrayBuffer"];

/** The modules this census must be able to see, by name. Asserted below, and
 * checked again inside each census function -- a census that silently scanned
 * neither module would find no violation and PASS. */
const CENSUS_MUST_SEE = [PREDICATE, ORACLE, "vsf-slice.ts"];

/** Thrown when a census is asked to scan a set that does not contain the module
 * it is about. Named rather than an `assert` so it cannot be swallowed by a
 * caller that forgot a message argument, and so a census can never report "no
 * violations" because it read nothing. */
class CensusScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CensusScopeError";
  }
}

// ---------------------------------------------------------------------------
// Census mechanics
// ---------------------------------------------------------------------------

/** Every module specifier a source names.
 *
 * Run with literal bodies KEPT, because an import specifier IS a string literal
 * -- blanking literal bodies would make the very thing under assertion
 * unobservable. Comments are still stripped, so a module name discussed in
 * prose (this file's own header discusses both) cannot satisfy the check.
 *
 * Collecting SPECIFIERS rather than matching import STATEMENTS is deliberate
 * and is what makes the census route-complete: a multi-line static import whose
 * keyword and specifier land on different lines, a dynamic `import()`, a bare
 * side-effect `import "..."`, a `require()` and `process.getBuiltinModule()`
 * all pass the target as a quoted specifier, and a per-statement regex has to
 * enumerate each shape correctly to see them. */
function moduleSpecifiers(src: string): string[] {
  const code = codeOnly(src, true);
  return [...code.matchAll(/["']([^"'\n]*)["']/g)]
    .map((m) => m[1])
    .filter(isModuleSpecifierShaped);
}

/** Whether a string literal is SHAPED like a module specifier at all.
 *
 * Deliberately narrow, and the narrowing was measured rather than guessed: an
 * earlier draft accepted every literal beginning with a letter, which swept in
 * every refusal message and type-guard string in the two modules and made the
 * non-vacuity assertion below unwritable. A specifier is a `node:` builtin, or
 * a path (relative, absolute, or a scoped/bare package subpath) -- and a path
 * never contains whitespace, which is what excludes prose. Both accepted shapes
 * are kept because a cross-module import could in principle be written as a
 * package subpath (`@scope/pkg/stop-oracle.ts`) rather than relatively. */
function isModuleSpecifierShaped(s: string): boolean {
  return /^node:/.test(s) || (s.includes("/") && !/\s/.test(s));
}

/** Whether a specifier resolves to the named module stem -- with or without a
 * `./` prefix, with or without a `.ts`/`.mts`/`.js`/`.mjs` extension, and at
 * any directory depth. Anchored at a path boundary so a longer name that merely
 * ENDS with the stem does not match. */
function isSpecifierFor(specifier: string, stem: string): boolean {
  return new RegExp(`(^|/)${stem}(\\.m?[tj]s)?$`).test(specifier);
}

/** Every cross-reference between the predicate and the oracle, in EITHER
 * direction, over the shipped module set of `dir`.
 *
 * `dir` exists so this exact code path runs against a planted tree with its own
 * synthetic `package.json`, which is how the positive controls below drive the
 * real rule rather than a re-implementation of it. Real callers pass nothing. */
function crossModuleReferences(dir: string = HERE): string[] {
  const scanned = shippedTsModules(dir);
  const hits: string[] = [];
  for (const [file, otherStem] of [
    [PREDICATE, ORACLE_STEM],
    [ORACLE, PREDICATE_STEM],
  ] as const) {
    if (!scanned.includes(file)) {
      throw new CensusScopeError(
        `crossModuleReferences: ${file} is not in the scanned shipped set of ${dir} -- a census that cannot see the module it is about would report no violations and pass`,
      );
    }
    for (const specifier of moduleSpecifiers(readFileSync(join(dir, file), "utf8"))) {
      if (isSpecifierFor(specifier, otherStem)) hits.push(`${file} -> ${specifier}`);
    }
  }
  return hits.sort();
}

/** The parameter list of the function whose opening parenthesis is at `open`,
 * by a balanced-parenthesis walk -- not `[^)]*`, which stops early on a
 * function-typed parameter and would read a truncated signature. */
function paramsAt(code: string, open: number): string {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === "(") depth++;
    else if (code[i] === ")") {
      depth--;
      if (depth === 0) return code.slice(open + 1, i);
    }
  }
  throw new Error("paramsAt: unbalanced parentheses in stripped source");
}

/** Every exported function's name and parameter list, read from STRIPPED code
 * so a type name appearing in a comment or a message string cannot trip the
 * check that consumes this. */
function exportedSignatures(src: string): { name: string; params: string }[] {
  const code = codeOnly(src);
  const out: { name: string; params: string }[] = [];
  const re = /export\s+(?:async\s+)?function\s+(\w+)\s*(?:<[^<>(]*>)?\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const open = m.index + m[0].length - 1;
    out.push({ name: m[1], params: paramsAt(code, open).replace(/\s+/g, " ").trim() });
  }
  return out;
}

/** Every exported oracle function declaring an image-buffer parameter, over the
 * shipped module set of `dir`. Empty is the required result. */
function imageBufferParameters(dir: string = HERE): string[] {
  const scanned = shippedTsModules(dir);
  if (!scanned.includes(ORACLE)) {
    throw new CensusScopeError(
      `imageBufferParameters: ${ORACLE} is not in the scanned shipped set of ${dir} -- a signature census that reads no signatures finds no violations`,
    );
  }
  const signatures = exportedSignatures(readFileSync(join(dir, ORACLE), "utf8"));
  if (signatures.length === 0) {
    throw new CensusScopeError(
      `imageBufferParameters: ${ORACLE} in ${dir} exposes no exported function signatures at all -- refusing to report a clean census over an empty read`,
    );
  }
  const hits: string[] = [];
  for (const sig of signatures) {
    for (const type of IMAGE_PARAM_TYPES) {
      if (new RegExp(`\\b${type}\\b`).test(sig.params)) {
        hits.push(`${sig.name}(${sig.params}) declares ${type}`);
      }
    }
  }
  return hits.sort();
}

// ---------------------------------------------------------------------------
// The planted-tree harness
// ---------------------------------------------------------------------------

/** Sources for a planted tree: filenames to contents. A synthetic
 * `package.json` naming exactly these files is written alongside them, so
 * `shippedTsModules()` -- the real enumerator, with its real existence check --
 * discovers the plant the same way it discovers the real tree.
 *
 * The directory is removed in a `finally`. It lives under the OS temp
 * directory, which on this host is a RAM-backed filesystem that is not aged --
 * so a plant that leaked would consume memory until reboot, and cleaning up is
 * not merely tidy. */
function withPlantedTree(files: Record<string, string>, body: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "capture-seam-planted-"));
  try {
    for (const [name, src] of Object.entries(files)) writeFileSync(join(dir, name), src, "utf8");
    writeFileSync(join(dir, "package.json"), JSON.stringify({ files: Object.keys(files) }, null, 2), "utf8");
    body(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A clean, non-violating predicate stub: it names a builtin specifier and
 * nothing else, so a planted tree's OTHER file cannot be the source of a hit. */
const CLEAN_PREDICATE = [
  'import { createHash } from "node:crypto";',
  "export function compareCaptures(a: Uint8Array, b: Uint8Array) {",
  "  return createHash(String(a.length + b.length));",
  "}",
  "",
].join("\n");

/** A clean, non-violating oracle stub. */
const CLEAN_ORACLE = [
  "export function compareStopIdentity(a: { pc: number }, b: { pc: number }) {",
  "  return a.pc === b.pc;",
  "}",
  "",
].join("\n");

// ---------------------------------------------------------------------------
// 1-2. The two real assertions
// ---------------------------------------------------------------------------

test("CAP-03: the predicate and the oracle name no import specifier for each other, in either direction", () => {
  const hits = crossModuleReferences();
  // The `deepEqual` catches a WRONG name and the length catches a BROKEN scan
  // that returned nothing. Both, always -- a `deepEqual` against `[]` passes
  // for a census that read no files at all, which is why the census functions
  // above also throw rather than returning early.
  assert.deepEqual(
    hits,
    [],
    "the captured 64K is the dependent variable the oracle certifies -- neither module may be able to reach the other, on any route",
  );
});

test("CAP-03: no exported function signature in the oracle declares an image-buffer parameter", () => {
  // A SIGNATURE is the right instrument here, rather than a comment or a
  // review convention: the capture can only become a conjunct of the stop's
  // identity by being passed in, and it can only be passed in through a
  // parameter this test reads. The next edit cannot reintroduce the
  // circularity on this route without changing a signature that reds here.
  assert.deepEqual(imageBufferParameters(), []);

  // Non-vacuity for this census specifically: it DID read real signatures.
  const signatures = exportedSignatures(readFileSync(join(HERE, ORACLE), "utf8"));
  assert.deepEqual(signatures.map((s) => s.name), ["compareStopIdentity"]);
  assert.match(signatures[0].params, /a: StopIdentity, b: StopIdentity/);
});

// ---------------------------------------------------------------------------
// 3-6. Four planted violations, each with a clean control over the real tree
// ---------------------------------------------------------------------------

test("planted violation (a): a MULTI-LINE static import of the oracle from the predicate is reported", () => {
  // The shape a per-line match can never see -- no single line carries both the
  // `import` keyword and the specifier.
  const planted = [
    "import {",
    "  compareStopIdentity,",
    "  ORACLE_TERMS,",
    '} from "./stop-oracle.ts";',
    "export function compareCaptures() {",
    "  return [compareStopIdentity, ORACLE_TERMS];",
    "}",
    "",
  ].join("\n");

  withPlantedTree({ [PREDICATE]: planted, [ORACLE]: CLEAN_ORACLE }, (dir) => {
    assert.deepEqual(
      crossModuleReferences(dir),
      ["capture-predicate.ts -> ./stop-oracle.ts"],
      "if this fails, the real assertion cannot catch a predicate that imports the oracle and is decoration",
    );
  });

  // The clean control: the same census over the REAL tree reports nothing, so
  // the red above is caused by the plant and not by the harness.
  assert.deepEqual(crossModuleReferences(), []);
});

test("planted violation (b): a static import of the predicate from the oracle is reported -- the OTHER direction", () => {
  const planted = [
    'import { compareCaptures } from "./capture-predicate.ts";',
    "export function compareStopIdentity() {",
    "  return compareCaptures;",
    "}",
    "",
  ].join("\n");

  withPlantedTree({ [PREDICATE]: CLEAN_PREDICATE, [ORACLE]: planted }, (dir) => {
    assert.deepEqual(
      crossModuleReferences(dir),
      ["stop-oracle.ts -> ./capture-predicate.ts"],
      "the circularity is symmetric -- a one-directional guard leaves half of it open",
    );
  });

  assert.deepEqual(crossModuleReferences(), []);
});

test("planted violation (c): a DYNAMIC import() of one module from the other is reported", () => {
  const planted = [
    "export async function compareCaptures() {",
    '  const { compareStopIdentity } = await import("./stop-oracle.ts");',
    "  return compareStopIdentity;",
    "}",
    "",
  ].join("\n");

  withPlantedTree({ [PREDICATE]: planted, [ORACLE]: CLEAN_ORACLE }, (dir) => {
    assert.deepEqual(
      crossModuleReferences(dir),
      ["capture-predicate.ts -> ./stop-oracle.ts"],
      "a dynamic import reaches the module with no import statement to match -- the census must see it too",
    );
  });

  assert.deepEqual(crossModuleReferences(), []);
});

test("planted violation (d): an oracle-shaped module whose exported comparison declares a Uint8Array parameter is reported", () => {
  const planted = [
    "export function compareStopIdentity(",
    "  a: { pc: number },",
    "  b: { pc: number },",
    "  image: Uint8Array,",
    ") {",
    "  return a.pc === b.pc && image.length > 0;",
    "}",
    "",
  ].join("\n");

  withPlantedTree({ [PREDICATE]: CLEAN_PREDICATE, [ORACLE]: planted }, (dir) => {
    const hits = imageBufferParameters(dir);
    assert.equal(hits.length, 1, `expected exactly one planted signature violation, got ${JSON.stringify(hits)}`);
    assert.match(hits[0], /^compareStopIdentity\(/);
    assert.match(hits[0], /declares Uint8Array$/);
  });

  assert.deepEqual(imageBufferParameters(), []);
});

test("negative control: an image type named only in a COMMENT or a message string is not reported", () => {
  // The other half of plant (d): the census runs over stripped code, so the
  // oracle's own header -- which discusses `Uint8Array` in prose precisely
  // because it must never take one -- cannot redden the gate. Without this
  // control the signature check could be a whole-file substring search, which
  // would red on the real module's own documentation and be switched off.
  const commentOnly = [
    "// This module must never take a Uint8Array, a Buffer, an ArrayBuffer or",
    "// an ArrayBufferView: the captured 64K is the dependent variable.",
    "export function compareStopIdentity(a: { pc: number }, b: { pc: number }) {",
    '  if (a.pc < 0) throw new Error("a Uint8Array is not accepted here");',
    "  return a.pc === b.pc;",
    "}",
    "",
  ].join("\n");

  withPlantedTree({ [PREDICATE]: CLEAN_PREDICATE, [ORACLE]: commentOnly }, (dir) => {
    assert.deepEqual(
      imageBufferParameters(dir),
      [],
      "the signature check must not turn into a raw whole-file substring search",
    );
  });
});

// ---------------------------------------------------------------------------
// 7-8. Non-vacuity floors
// ---------------------------------------------------------------------------

test("non-vacuity: the scanned shipped set is substantial and contains the census's three modules by name", () => {
  const scanned = shippedTsModules();
  // A COMPARISON and not a pinned count: the shipped set grows every time a
  // module ships, and a pinned number would red for a reason unrelated to this
  // guard. The floor sits below the number actually measured when this file was
  // written (73 `files[]` entries, of which the `.ts`/`.mts` subset is the
  // scanned set) -- never a floor equal to a number that was never measured.
  assert.ok(scanned.length >= 40, `the shipped module set must be substantial, got ${scanned.length}`);
  for (const name of CENSUS_MUST_SEE) {
    assert.ok(scanned.includes(name), `${name} must be in the scanned set, or the assertions above are vacuous`);
  }
});

test("non-vacuity: the specifier extractor finds the real modules' real specifiers", () => {
  // A helper that silently returned an empty list would make every census above
  // report a clean tree. This pins that it does not: the predicate really does
  // name one builtin, and the oracle really does name nothing at all.
  const predicateSpecifiers = moduleSpecifiers(readFileSync(join(HERE, PREDICATE), "utf8"));
  assert.deepEqual(predicateSpecifiers, ["node:crypto"]);
  assert.deepEqual(moduleSpecifiers(readFileSync(join(HERE, ORACLE), "utf8")), []);

  // And the stem matcher discriminates in both directions.
  assert.equal(isSpecifierFor("./stop-oracle.ts", ORACLE_STEM), true);
  assert.equal(isSpecifierFor("../vice/stop-oracle", ORACLE_STEM), true);
  assert.equal(isSpecifierFor("./stop-oracle-helpers.ts", ORACLE_STEM), false);
  assert.equal(isSpecifierFor("node:crypto", ORACLE_STEM), false);
});

test("non-vacuity: a census asked to scan a set that omits its module THROWS rather than reporting clean", () => {
  // The failure mode this closes is the one every guard in this directory
  // carries a note about: a scan that reads nothing finds nothing and passes.
  withPlantedTree({ [ORACLE]: CLEAN_ORACLE }, (dir) => {
    assert.throws(() => crossModuleReferences(dir), CensusScopeError);
  });
  withPlantedTree({ [PREDICATE]: CLEAN_PREDICATE }, (dir) => {
    assert.throws(() => imageBufferParameters(dir), CensusScopeError);
  });
});
