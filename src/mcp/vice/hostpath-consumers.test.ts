// node:test coverage of the CLOSED consumer set for host-path logic
// (CLAUDE.md: "Any host-facing path or hostname must go through hostpath.ts
// / containerpath.ts / container-guard.mts. The project maintains a tested
// closed consumer set for host-path logic.").
//
// GROUND TRUTH ESTABLISHED BY THIS PLAN (04-02): the two source comments
// that used to enforce this set by convention both pointed at
// `vice-mcp-selector-docs.test.mjs`'s "assertion 4" -- a file that does not
// exist anywhere in this repo (`find . -name 'vice-mcp-selector-docs*'`
// returns nothing) -- and both said "four production modules" while the
// real count was already FIVE (stock-paths.ts joined in Phase 3 and nobody
// updated them). This file is the first COMMITTED test of that set; before
// it, the set was enforced by comment convention only.
//
// Widening the five-member list below is a REVIEWED DECISION, not a
// mechanical fix for a failing test -- a new tool that genuinely needs
// host-path translation is rare (D-17's own table is exactly four tools,
// all long-lived emulator-side file operations) and each addition should be
// deliberate. A DERIVED module (anything registered in
// STOCK_DERIVED_TOOLS, stock-derived.ts) may NEVER be added to this list at
// all -- see stock-derived.ts's own header for why translating a
// client-side-derived path is exactly the bug DERIV-07's seam exists to
// prevent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { STOCK_DERIVED_TOOLS } from "./stock-derived.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Matches a real ES import statement naming hostpath.ts/.mts/.mjs, after
 * `//`- and `/* ... *\/`-comments have already been stripped -- never a bare
 * `includes("hostpath")` and never a `grep -c` against raw file text. This
 * is mandatory grep-gate hygiene here: stock-paths.ts's own header mentions
 * "hostpath.ts", vice-broker-client.ts's header literally says "MUST NOT
 * import hostpath.ts", and load-order.test.ts embeds the import statement
 * as a string literal -- an unfiltered match against raw text would produce
 * a self-invalidating gate that "passes" by counting comments and string
 * literals as imports.
 *
 * NEWLINE-TOLERANT (Phase 10 IN-02): matched against the WHOLE stripped
 * source with the `m` flag, not per-line, so a multi-line named import --
 * `import {\n  hostPath,\n} from "./hostpath.ts";` -- is caught. `[^;]*`
 * already spans newlines in a JS character class (only `.` excludes `\n`
 * without the `s` flag), so no other change was needed to make this
 * tolerant once matching moved off the per-line array. */
const HOSTPATH_IMPORT_RE = /^\s*import\s[^;]*from\s+"\.\/hostpath\.(ts|mts|mjs)"/m;

/** Matches a dynamic `await import("./hostpath.ts")` (or `.mts`/`.mjs`) --
 * the other shape Phase 10 IN-02 names as invisible to a static-import-only
 * detector. Mirrors `scripts/check-npm-packages.mjs`'s own
 * STATIC_IMPORT_RE/DYNAMIC_IMPORT_RE pairing (added for the identical reason
 * by an earlier plan): the dynamic pattern is ADDED ALONGSIDE the static
 * one above, never a replacement. containerpath.ts is not covered here
 * because HOSTPATH_IMPORT_RE never covered it either -- this file's
 * consumer-set concern is specifically hostpath.ts, not containerpath.ts. */
const HOSTPATH_DYNAMIC_IMPORT_RE = /import\s*\(\s*["'][^"']*\/hostpath\.(ts|mts|mjs)["']\s*\)/;

/** True iff the (already comment-stripped) source imports hostpath.ts,
 * statically or dynamically. Extracted into ONE named predicate -- both the
 * real consumer-set scan below and the planted-violation tests call this
 * same function, so there is exactly one definition of "counts as an
 * import" (the 11-01 discipline: a structural test and its own proof must
 * share the checked logic, not each carry a copy). */
function importsHostpath(strippedSrc: string): boolean {
  return HOSTPATH_IMPORT_RE.test(strippedSrc) || HOSTPATH_DYNAMIC_IMPORT_RE.test(strippedSrc);
}

/** Strips `//` line comments and `/* ... *\/` block comments, returning the
 * comment-stripped source as ONE newline-joined string (not an array of
 * lines) so a multi-line import statement stays intact for a single regex
 * match against the whole thing. This is anno-launch.test.ts's own
 * stripCommentLines(), reused verbatim rather than reinvented: its WR-02 fix
 * (10-REVIEW.md) closes a block comment on the FIRST close-comment token
 * found by position, never by whether the trimmed line happens to END with
 * one, and re-feeds any code trailing a same-line close (`*\/ code();`) back
 * through the same logic -- so code following a closed block comment is
 * never silently dropped. A line that is ENTIRELY a `//` comment (allowing
 * leading whitespace) is dropped; a trailing `//` comment on a real code
 * line is left alone since no import statement in this codebase carries
 * one. */
function stripCommentLines(src: string): string {
  const out: string[] = [];
  let inBlock = false;

  function processSegment(text: string): void {
    if (inBlock) {
      const closeIdx = text.indexOf("*/");
      if (closeIdx === -1) return; // still unterminated -- drop the rest of this line
      inBlock = false;
      processSegment(text.slice(closeIdx + 2));
      return;
    }
    const trimmed = text.trim();
    if (trimmed.startsWith("/*")) {
      const openIdx = text.indexOf("/*");
      const closeIdx = text.indexOf("*/", openIdx + 2);
      if (closeIdx === -1) {
        inBlock = true; // unterminated on this line -- resumes on later lines
        return;
      }
      // Opens and closes on the same line (`/* ... */ code();`) -- the
      // remainder after the closing `*/` is still real code/comment text.
      processSegment(text.slice(closeIdx + 2));
      return;
    }
    if (/^\s*\/\//.test(text)) return; // whole-line `//` comment -- dropped
    out.push(text);
  }

  for (const line of src.split("\n")) {
    processSegment(line);
  }
  return out.join("\n");
}

/** The complete top-level module list this repo ships: every `*.ts`/`*.mts`
 * directly under `src/mcp/vice`, excluding `*.test.*` files. Does NOT
 * walk into `resources/` (compiled `.mjs` artifacts, not source) or
 * `node_modules/`.
 *
 * `dir` is injectable (default `HERE`, the real directory) purely so a
 * SECOND floor (SEAM-06, below) can drive this exact code path against
 * synthetic directories for its emptiness, ordering and disjointness
 * cases -- the `inEnumerationOnDisk(dir)` convention this repo already
 * uses for that purpose (module-classification.test.ts's own helper). */
function topLevelProductionModules(dir: string = HERE): string[] {
  return readdirSync(dir)
    .filter((name) => /\.(ts|mts)$/.test(name))
    .filter((name) => !/\.test\.[a-zA-Z0-9]+$/.test(name));
}

/** The set of production modules whose stripped source contains a real
 * import of hostpath.ts/.mts/.mjs, static or dynamic. */
function hostpathImporters(): string[] {
  const importers: string[] = [];
  for (const name of topLevelProductionModules()) {
    const src = readFileSync(join(HERE, name), "utf8");
    const stripped = stripCommentLines(src);
    if (importsHostpath(stripped)) {
      importers.push(name);
    }
  }
  return importers.sort();
}

// SEAM-06: this phase's new host-tool-execution-seam family (`host-tool.mts`,
// `host-tool-client.ts`, `ghidra-project.mts`, and the `ghidra-*`/`dxa-*`
// members still to come) deliberately did NOT join this list. The family
// reaches host-path logic through `containerpath.ts`, already one of the
// five below, and every request-side path crosses as workspace-relative and
// is resolved server-side (plan 34-01's A-03) -- there was nothing to
// translate on the way in. See HOST_TOOL_FAMILY_FLOOR, further down, for the
// second, independently pinned floor that keeps this family inside the
// closed-consumer discipline without widening this five-member set.
const EXPECTED_IMPORTERS = ["containerpath.ts", "install-resources.ts", "stock-paths.ts", "vice-proxy.ts", "vice-sync.ts"];

test("hostpath.ts's production consumer set is exactly the five declared modules", () => {
  const importers = hostpathImporters();
  assert.deepEqual(importers, EXPECTED_IMPORTERS);
  assert.equal(importers.length, 5);
});

test("stock-derived.ts is absent from the hostpath.ts consumer set", () => {
  assert.equal(hostpathImporters().includes("stock-derived.ts"), false);
});

test("the disassembler modules (not yet reachable from stock-dispatch.ts in this wave) are absent from the consumer set", () => {
  const importers = hostpathImporters();
  for (const name of [
    "stock-disassemble.ts",
    "disasm-opcodes.ts",
    "disasm-decoder.ts",
    "disasm-renderer.ts",
    "stock-memory-search.ts",
    "stock-symbols.ts",
    "stock-vicii.ts",
    "stock-cia.ts",
    "stock-sprites.ts",
  ]) {
    assert.equal(importers.includes(name), false, `${name} must not import hostpath.ts, whether or not it exists yet`);
  }
});

// MCP-02, BY CONSTRUCTION RATHER THAN BY INTERCEPTION (plan 29-01).
//
// CLAUDE.md requires derived tools to be intercepted BEFORE forwardToVice(),
// because rewriteArguments() runs inside it and would hand a host-translated
// path to a runner acting proxy-locally. The anno_* family needs no such
// interception: its runner is registered through buildViceTool() directly and
// can never reach forwardToVice(), call() or ensureViceSession(), so there is
// no interception to forget. What makes that argument SOUND rather than merely
// stated is the five-member EXPECTED_IMPORTERS deepEqual above -- if an anno-*
// module ever imported hostpath.ts, the store path would be translated across
// the container boundary and would open (or refuse) a file on the wrong side
// of it.
//
// The NAMED-ABSENCE form is deliberate and is the whole point of listing files
// that do not exist yet: the five-member set alone goes red only AFTER the
// import lands, and says only "the set changed". This says WHICH module, and
// says it for a module a later plan in this phase has not written yet -- so
// the constraint is asserted before there is anything to violate it.
test("every module this phase adds is absent from the hostpath.ts consumer set (MCP-02), named before it exists", () => {
  const importers = hostpathImporters();
  for (const name of ["anno-tools.ts", "anno-derive.ts", "anno-details.ts", "anno-register.ts", "anno-cli.ts"]) {
    assert.equal(importers.includes(name), false, `${name} must not import hostpath.ts, whether or not it exists yet`);
  }
});

/** The annotation module family, derived from disk rather than typed
 * (INT-01/D-11.1-03): every `anno-*.ts` file `topLevelProductionModules()`
 * already excludes `*.test.*` from. This is the SAME `readdirSync`-based
 * helper the five-member EXPECTED_IMPORTERS test above uses -- reused, not a
 * second directory walk -- filtered down to the family name pattern.
 *
 * RE-EXPRESSED OVER THE `anno-` PREFIX BY PLAN 29-05 (D-05, D-13). The
 * helper this replaces filtered on `/^anno-.*\.ts$/`; nine capability
 * modules moved out from under that prefix in the same commit, so a filter
 * left pointing at it would have kept counting a shrinking family and gone
 * quietly vacuous as the family emptied. The prefix is the one D-05 locks,
 * and the derivation shape -- readdirSync plus a stable prefix regex -- is
 * unchanged, which is the half INT-01 was actually about. */
function annoProductionModules(): string[] {
  return topLevelProductionModules().filter((name) => /^anno-.*\.ts$/.test(name));
}

// MEASURED, NOT COPIED: 15 `anno-*.ts` production modules on disk at this
// commit -- counted with `ls | grep -E '^anno-.*\.ts$' | grep -v '\.test\.'`
// after plan 29-05's three renames landed, not carried over from any planning
// document. This floor must be RAISED, never lowered: an empty or broken glob
// (a typo'd filter regex, or a directory walk that silently resolves to the
// wrong path) must fail THIS test rather than let the absence assertion below
// pass trivially, which is the exact defect INT-01 found in the ten-name
// hard-coded array this whole derivation replaces.
//
// It REPLACES `ANNO_MODULE_FLOOR = 14` over the retired prefix, and D-13's
// "raised, not lowered" is read LITERALLY rather than charitably: 15 is
// strictly greater than the 14 it replaces, so the re-expression is a raise
// on its own terms and needs no interpretation. That is only satisfiable
// because the survivors took the `anno-` prefix (D-05) -- under bare names
// this derivation would not count them at all, which is a lowering by
// construction however it were worded.
// RAISED FROM 15 TO 16 BY PLAN 29-08 (MCP-05), which lands exactly one new
// `anno-*.ts` production module: `anno-register.ts`, the committed record of
// why a surface verb the Phase 19 manifest does not classify exists. The raise
// is expressed as a RELATION -- the value plan 29-05 measured, plus the modules
// this plan adds -- rather than as a fresh measurement, so the arithmetic is
// readable rather than asserted.
//
// THE FLOOR MUST NEVER BE DERIVED FROM DISK, and this is the one number in this
// directory where that matters most. A floor computed from `readdirSync` at test
// time can never fail -- `disk.length >= disk.length` is a guard re-pointed to a
// subject that cannot fail -- and it would silently discard the entire
// non-vacuity this floor exists to provide. Keep it a hand-pinned integer
// literal. `raised, never lowered` (D-13) is read literally: 16 is strictly
// greater than the 15 it replaces.
//
// RAISED FROM 16 TO 17 BY PLAN 30-01 (EXPORT-01), which lands exactly one new
// `anno-*.ts` production module: `anno-export-asm.ts`, the store-driven ACME
// source exporter that replaces the export route Phase 29 withdrew. The raise
// is again expressed as a RELATION -- the value plan 29-08 measured, plus the
// one module this plan adds -- rather than as a fresh measurement, so the
// arithmetic stays readable. The sibling module this plan also creates,
// `acme-verify.ts`, is deliberately NOT counted here and never will be: it
// carries no `anno-` prefix and is TEST-ONLY, absent from `files[]` by
// decision, so it is outside this derivation by construction rather than by
// exclusion. `raised, never lowered` (D-13) again read literally: 17 is
// strictly greater than the 16 it replaces.
const ANNO_MODULE_FLOOR = 16 + 1;

test("the annotation module family (D-08/ANNO-02) is derived from disk with a non-vacuity floor, not a hard-coded list (INT-01/D-11.1-03)", () => {
  const modules = annoProductionModules();
  assert.ok(
    modules.length >= ANNO_MODULE_FLOOR,
    `expected >= ${ANNO_MODULE_FLOOR} anno-*.ts production modules on disk, found ${modules.length} -- ` +
      "an empty or broken glob must fail loudly here rather than let the absence assertion below pass trivially",
  );
});

// THE PINNED-EQUALS-MEASURED RELATION (plan 29-08). The floor above is a
// one-sided guard by design: it catches a glob that broke or narrowed, and it
// deliberately does NOT catch the module set growing underneath it. This
// assertion catches that, and its whole purpose is DIAGNOSIS RATHER THAN
// PROHIBITION.
//
// What it removes is a temporal coupling. Plan 29-07 runs in the same wave as
// 29-08 and does not touch this file; measured at plan time it adds no
// `anno-*.ts` production module and deletes none (it creates `block-class.ts`,
// which does not carry the prefix, and edits `anno-cli.ts` in place), so the
// count 29-08 measures in its own tree is the count after the wave merges. If
// that ever stops being true, this fails HERE, saying the module set moved --
// rather than surfacing two waves later as an intermittent off-by-one attributed
// to whichever plan happened to run last.
//
// WHEN THIS FAILS, RE-DERIVE THE FLOOR DELIBERATELY. Do not nudge the literal
// until the numbers agree: the number is a claim about which modules a plan
// intended to land, and adjusting it to fit unknown files converts a
// deliberate record into a rubber stamp.
test("MCP-05: the hand-pinned annotation module floor equals the measured count -- a same-wave change to the module set fails HERE with the right diagnosis", () => {
  const modules = annoProductionModules();
  assert.equal(
    modules.length,
    ANNO_MODULE_FLOOR,
    `ANNO_MODULE_FLOOR is pinned at ${ANNO_MODULE_FLOOR} but ${modules.length} anno-*.ts production modules are on ` +
      `disk (${modules.join(", ")}) -- the module set moved underneath the plan that pinned this number. Re-derive ` +
      "the floor deliberately, naming the plan that added or removed the module; do NOT adjust the literal to fit, " +
      "and never compute it from disk, which would make it unfailable.",
  );
});

test("INT-01's positive control: the modules the audit found uncovered are present in the derived annotation set", () => {
  // The finding's own reproduction, kept as a permanent test: if a future
  // rename or move drops one of these out of the glob, this says which one
  // -- rather than the absence test below silently stopping short again.
  //
  // THREE of INT-01's four names are here under the prefix plan 29-05 moved
  // them to. The FOURTH -- the availability-gate module -- cannot be named
  // under any prefix: plan 29-10 deletes it outright on D-16's authority
  // (its own registry note says in terms that its verdict must not be read
  // as a claim the module survives, and that what a later phase inherits is
  // the DISCIPLINE, not the route). A name that is about to stop existing is
  // not a positive control; it is a scheduled red. `anno-store.ts` -- the
  // owned annotation store this milestone builds -- is substituted for it,
  // so the control keeps naming four real, current files.
  const modules = annoProductionModules();
  for (const name of ["anno-acme-ident.ts", "anno-regbits-gen.ts", "anno-symbols.ts", "anno-store.ts"]) {
    assert.ok(modules.includes(name), `${name} (INT-01's positive control) must be present in the derived annotation module set`);
  }
});

test("the annotation module family (D-08/ANNO-02) is absent from the consumer set -- the rented analyser ran container-side (D-R4), the mirror image of DERIV-07's wrongly-translated screenshot path", () => {
  const importers = hostpathImporters();
  const annoModules = annoProductionModules();
  // Non-vacuity is asserted separately above; this loop still guards against
  // an empty array silently making every assertion below vacuously true.
  assert.ok(annoModules.length > 0, "annoProductionModules() must not be empty");
  for (const name of annoModules) {
    assert.equal(importers.includes(name), false, `${name} must not import hostpath.ts, whether or not it exists yet`);
  }
});

test("planted violation (INT-01 proof): a synthetic anno-shaped source that DOES import hostpath.ts is reported by the same predicate the real scan uses", () => {
  const plantedViolation = `import { hostPath } from "./hostpath.ts";\nexport function doSomething() {}\n`;
  const plantedClean = `export function doSomething() {}\n`;
  assert.equal(
    importsHostpath(stripCommentLines(plantedViolation)),
    true,
    "the predicate must report a genuine hostpath.ts import -- if this fails, the absence assertion above is not actually capable of catching a real violation",
  );
  assert.equal(importsHostpath(stripCommentLines(plantedClean)), false, "a clean source with no hostpath.ts mention must not be reported");
});

test("planted violation, three import shapes (Phase 10 IN-02 proof): multi-line static and dynamic imports are caught; a comment/string-literal-only mention is not", () => {
  // (a) Multi-line named import -- the shape a per-line array match (the
  // pre-11.1-03 code) could never see, because the `import` keyword, the
  // named binding and the `from "./hostpath.ts"` clause each land on a
  // different line.
  const multiLineStaticImport = ["import {", '  hostPath,', '  SET_ENV_HINT,', '} from "./hostpath.ts";', "", "export function useIt() {}", ""].join("\n");

  // (b) Dynamic import -- the shape vice-proxy.ts's own
  // `await import("./anno-cli.ts")` proves exists in this repo's own style,
  // and the shape the STATIC_IMPORT_RE-only closure walk in
  // check-npm-packages.mjs was measured to miss before that guard grew its
  // own DYNAMIC_IMPORT_RE sibling.
  const dynamicImport = 'export async function useIt() {\n  const { hostPath } = await import("./hostpath.ts");\n  return hostPath;\n}\n';

  // (c) Control: the ONLY two mentions of "hostpath" in this source are
  // inside a `//` line comment and inside a string literal -- never inside a
  // real import statement. This is the half that keeps the widened detector
  // trustworthy: proving it does NOT turn into a substring search. Mirrors
  // vice-broker-client.ts's real header ("MUST NOT import hostpath.ts", a
  // `//` comment) and load-order.test.ts's real embedded import string
  // literal -- both cited in HOSTPATH_IMPORT_RE's own doc comment above as
  // the reason an unfiltered whole-file match would be self-invalidating.
  const commentAndStringLiteralOnly = [
    "// MUST NOT import hostpath.ts -- this module runs container-side.",
    "export const EXAMPLE_IMPORT_TEXT = 'import { hostPath } from \"./hostpath.ts\";';",
    "export function useIt() { return EXAMPLE_IMPORT_TEXT; }",
    "",
  ].join("\n");

  assert.equal(
    importsHostpath(stripCommentLines(multiLineStaticImport)),
    true,
    "a multi-line named import of hostpath.ts must be detected (Phase 10 IN-02, shape 1)",
  );
  assert.equal(
    importsHostpath(stripCommentLines(dynamicImport)),
    true,
    "a dynamic await import(\"./hostpath.ts\") must be detected (Phase 10 IN-02, shape 2)",
  );
  assert.equal(
    importsHostpath(stripCommentLines(commentAndStringLiteralOnly)),
    false,
    "a hostpath.ts mention inside only a // comment and a string literal must NOT be reported -- proves the widening did not become a substring search",
  );
});

// A SECOND, INDEPENDENTLY PINNED FLOOR (SEAM-06). 34-RESEARCH.md's Pitfall 2
// names the blind spot precisely: `annoProductionModules()`'s glob above is
// anchored on `anno-`, so a `ghidra-*`/`dxa-*`/`host-tool-*` family sits
// OUTSIDE its scan entirely -- a family member that wrongly imported
// `hostpath.ts` would produce no red anywhere without a floor pinned over
// ITS own prefix. This is why a second floor exists at all rather than
// widening the first.

/** Matches the union of the three anchored prefixes this family's members
 * carry -- `host-tool`, `ghidra` and `dxa` -- one family across the seam
 * itself and the two engines that reach host binaries through it (A-13,
 * SEAM-06), never three separate floors (a floor per prefix would pin two
 * of them at zero today, which is a floor that cannot fail). Anchored at
 * `^` so `anno-host-tool.ts` matches neither this glob nor is silently
 * absorbed into it -- asserted as a disjointness case below. */
const HOST_TOOL_FAMILY_RE = /^(host-tool|ghidra|dxa)(-[A-Za-z0-9-]*)?\.(ts|mts)$/;

/** The host-tool execution-seam module family, derived from disk via the
 * SAME `topLevelProductionModules()` helper the five-member consumer scan
 * and the `anno-` family both reuse -- never a second directory walk.
 * Returns a SORTED list so every assertion over it is order-independent
 * (asserted below by driving this over a reversed synthetic listing).
 * `dir` is injectable for the same reason `topLevelProductionModules()`'s
 * own `dir` parameter is: so the emptiness, ordering and disjointness
 * cases can drive this exact code path against synthetic inputs. */
function hostToolFamilyProductionModules(dir: string = HERE): string[] {
  return topLevelProductionModules(dir)
    .filter((name) => HOST_TOOL_FAMILY_RE.test(name))
    .sort();
}

// THE VALUE IS A RELATION, not an unexplained measurement: `2 + 1` is the
// two production modules plan 34-01 lands (`host-tool.mts`,
// `host-tool-client.ts`) plus the one plan 34-03 lands (`ghidra-project.mts`);
// `+ 2` is plan 35-01 (Phase 35), which lands `dxa-listing.ts` and
// `dxa-run.ts`; `+ 1` is plan 35-03, which lands `dxa-partition.ts` (the
// `dxa-` prefix matches `HOST_TOOL_FAMILY_RE` the moment it lands, so the
// pinned-equals-measured companion test below is an equality, not a floor).
// Verified against disk at this commit -- see the pinned-equals-measured
// companion test immediately below.
//
// MUST BE RAISED, NEVER LOWERED (D-13, read exactly the way
// `ANNO_MODULE_FLOOR` above reads it), and MUST NEVER BE DERIVED FROM DISK:
// `disk.length >= disk.length` is a guard re-pointed to a subject that
// cannot fail, and it would silently discard the entire non-vacuity this
// floor exists to provide. Keep it a hand-pinned integer literal. Cite
// SEAM-06 and `34-RESEARCH.md`'s Pitfall 2 for why this floor exists at all
// rather than widening `ANNO_MODULE_FLOOR`'s own `anno-` glob.
const HOST_TOOL_FAMILY_FLOOR = 2 + 1 + 2 + 1;

test("the host-tool execution-seam module family (SEAM-06) is derived from disk with a non-vacuity floor, not a hard-coded list", () => {
  const modules = hostToolFamilyProductionModules();
  assert.ok(
    modules.length >= HOST_TOOL_FAMILY_FLOOR,
    `expected >= ${HOST_TOOL_FAMILY_FLOOR} host-tool-family production modules on disk, found ${modules.length} -- ` +
      "an empty or broken glob must fail loudly here rather than let the absence assertions below pass trivially",
  );
});

// THE PINNED-EQUALS-MEASURED RELATION, mirroring MCP-05's own companion
// above. This assertion catches the module set GROWING underneath the
// floor -- something the floor above deliberately does not catch on its
// own -- and its purpose is DIAGNOSIS RATHER THAN PROHIBITION.
//
// What it removes is a temporal coupling. Plan 34-04 runs in the same wave
// as this plan and, measured at plan time, adds no module matching this
// family glob (it creates `mcp-module.mjs` under `src/skills/`, outside
// this directory entirely), so the count measured in this tree is the
// count after the wave merges. If that ever stops being true, this fails
// HERE, saying the module set moved -- rather than surfacing two waves
// later as an intermittent off-by-one attributed to whichever plan
// happened to run last.
//
// WHEN THIS FAILS, RE-DERIVE THE FLOOR DELIBERATELY. Do not nudge the
// literal until the numbers agree.
test("SEAM-06: the hand-pinned host-tool-family floor equals the measured count -- a same-wave change to the module set fails HERE with the right diagnosis", () => {
  const modules = hostToolFamilyProductionModules();
  assert.equal(
    modules.length,
    HOST_TOOL_FAMILY_FLOOR,
    `HOST_TOOL_FAMILY_FLOOR is pinned at ${HOST_TOOL_FAMILY_FLOOR} but ${modules.length} host-tool-family ` +
      `production modules are on disk (${modules.join(", ")}) -- the module set moved underneath the plan that ` +
      "pinned this number. Re-derive the floor deliberately, naming the plan that added or removed the module; " +
      "do NOT adjust the literal to fit, and never compute it from disk, which would make it unfailable.",
  );
});

test("SEAM-06 positive control: the six real family modules plans 34-01, 34-03, 35-01 and 35-03 land are present in the derived set", () => {
  // A control must name real, current files and never a module about to
  // stop existing (anno-store.ts's own role, above, mirrored here).
  const modules = hostToolFamilyProductionModules();
  for (const name of ["host-tool.mts", "host-tool-client.ts", "ghidra-project.mts", "dxa-listing.ts", "dxa-run.ts", "dxa-partition.ts"]) {
    assert.ok(modules.includes(name), `${name} (SEAM-06's positive control) must be present in the derived host-tool-family module set`);
  }
});

test("every DERIVED host-tool-family module is absent from the hostpath.ts consumer set (SEAM-06)", () => {
  const importers = hostpathImporters();
  const familyModules = hostToolFamilyProductionModules();
  // Non-vacuity is asserted separately above; this loop still guards
  // against an empty array silently making every assertion below
  // vacuously true, exactly as the `anno-` family's own absence case does.
  assert.ok(familyModules.length > 0, "hostToolFamilyProductionModules() must not be empty");
  for (const name of familyModules) {
    assert.equal(importers.includes(name), false, `${name} must not import hostpath.ts, whether or not it exists yet`);
  }
});

// NAMED ABSENCE BEFORE EXISTENCE: `ghidra-analyze.ts`/`ghidra-export.ts`
// (Phase 36) do not exist yet. `dxa-listing.ts`/`dxa-run.ts` (Phase 35,
// plan 35-01) DO exist now -- moved to the positive control above, since a
// module that has landed belongs there, not in a "before it exists" list.
// The named-absence form is deliberate, mirroring the `anno-*` family's own
// test above: the derived-set assertion alone goes red only AFTER a bad
// import lands and says only "the set changed" -- this says WHICH module,
// for modules no plan in this phase has written yet, so the constraint is
// asserted before there is anything to violate it.
test("future host-tool-family members are absent from the hostpath.ts consumer set, named before they exist (SEAM-06)", () => {
  const importers = hostpathImporters();
  for (const name of ["ghidra-analyze.ts", "ghidra-export.ts"]) {
    assert.equal(importers.includes(name), false, `${name} must not import hostpath.ts, whether or not it exists yet`);
  }
});

test("SEAM-06 planted violation: a synthetic host-tool-family-shaped source that DOES import hostpath.ts is reported by the same importsHostpath predicate the real scan uses", () => {
  const plantedViolation = `import { hostPath } from "./hostpath.ts";\nexport function ghidraAnalyze() {}\n`;
  assert.equal(
    importsHostpath(stripCommentLines(plantedViolation)),
    true,
    "the predicate must report a genuine hostpath.ts import from a family-shaped module -- if this fails, the " +
      "absence assertions above are not actually capable of catching a real violation",
  );
});

/** Builds a throwaway directory, writes each name in `names` into it as an
 * empty synthetic source file, runs `fn(dir)`, and always cleans up --
 * `shipped-modules.test.ts`'s own `withSyntheticPackage()` shape, reused
 * here for a plain directory rather than a `package.json`-backed one. */
function withSyntheticDirectory<T>(names: string[], fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "hostpath-consumers-family-"));
  try {
    for (const name of names) writeFileSync(join(dir, name), "// synthetic\n", "utf8");
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("SEAM-06, edge: empty -- an empty family glob over a synthetic directory with no family module FAILS the floor loudly rather than passing trivially", () => {
  withSyntheticDirectory(["unrelated.ts", "unrelated.test.ts"], (dir) => {
    const modules = hostToolFamilyProductionModules(dir);
    assert.deepEqual(modules, [], "a synthetic directory with no family-prefixed module must derive to an empty family list");
    assert.throws(
      () => assert.ok(modules.length >= HOST_TOOL_FAMILY_FLOOR),
      "the floor comparison must FAIL over an empty derived list -- proving the floor is capable of failing rather than merely present",
    );
  });
});

test("SEAM-06, edge: ordering -- the family derivation returns the same sorted result regardless of on-disk listing order", () => {
  // Written in REVERSE alphabetical order, to prove sorting is the
  // derivation's own doing rather than an accident of readdirSync's order.
  withSyntheticDirectory(["host-tool.mts", "ghidra-project.mts", "dxa-run.ts"], (dir) => {
    const modules = hostToolFamilyProductionModules(dir);
    assert.deepEqual(modules, ["dxa-run.ts", "ghidra-project.mts", "host-tool.mts"]);
  });
});

test("SEAM-06, edge: adjacency -- the family glob and the anno- glob are disjoint over one synthetic listing, and a module named anno-host-tool.ts matches neither the family glob nor is absorbed into it", () => {
  withSyntheticDirectory(["anno-host-tool.ts", "host-tool.mts", "anno-store.ts"], (dir) => {
    const familyModules = hostToolFamilyProductionModules(dir);
    // The SAME `anno-` derivation shape `annoProductionModules()` uses
    // above, driven over the synthetic dir directly -- `annoProductionModules()`
    // itself is not made dir-injectable, since it needs no synthetic case
    // of its own; this reuses the one shared `topLevelProductionModules(dir)`
    // walk rather than adding a second `readdirSync`.
    const annoModules = topLevelProductionModules(dir).filter((name) => /^anno-.*\.ts$/.test(name));
    assert.equal(familyModules.includes("anno-host-tool.ts"), false, "anno-host-tool.ts must not match the family glob");
    assert.ok(annoModules.includes("anno-host-tool.ts"), "anno-host-tool.ts is a real anno--prefixed synthetic file and must match the anno- glob");
    const intersection = familyModules.filter((name) => annoModules.includes(name));
    assert.deepEqual(intersection, [], "the two derivations' results must have an empty intersection over the same synthetic listing");
  });
});

// D-05-12: the derived-module guess this test used to make -- stripping the
// "vice_" prefix off the tool name and prefixing "stock-" -- produced an
// UNDERSCORE-bearing name for every multi-word tool -- e.g. vice_memory_search
// guessed "stock-memory_search.ts", never matching the real hyphenated
// "stock-memory-search.ts" -- so the absence assertion could never match a
// real file for any multi-word tool name and read as coverage while testing
// nothing (only vice_disassemble's single-word name ever produced a real
// hit). This declared map replaces the guess: every STOCK_DERIVED_TOOLS
// member is named explicitly, and its filename is asserted to exist on disk
// so a typo fails loudly instead of passing vacuously.
const DERIVED_TOOL_MODULES: Record<string, string> = {
  vice_disassemble: "stock-disassemble.ts",
  vice_memory_search: "stock-memory-search.ts",
  vice_memory_compare: "stock-memory-search.ts",
  vice_symbols_load: "stock-symbols.ts",
  vice_symbols_lookup: "stock-symbols.ts",
  vice_vicii_get_state: "stock-vicii.ts",
  vice_cia_get_state: "stock-cia.ts",
  vice_sprite_get: "stock-sprites.ts",
  vice_sprite_inspect: "stock-sprites.ts",
  vice_cycles_stopwatch: "stock-timing.ts",
  vice_run_until: "stock-run-until.ts",
  vice_diagnose: "stock-diagnose.ts",
  vice_recycle: "stock-recycle.ts",
};

test("D-05-12: DERIVED_TOOL_MODULES' key set equals STOCK_DERIVED_TOOLS exactly", () => {
  const mapped = Object.keys(DERIVED_TOOL_MODULES).sort();
  const registered = [...STOCK_DERIVED_TOOLS].sort();
  assert.deepEqual(mapped, registered, "a derived tool with no DERIVED_TOOL_MODULES entry must fail this test rather than escape it");
});

test("D-05-12: every DERIVED_TOOL_MODULES filename exists on disk", () => {
  for (const [toolName, moduleName] of Object.entries(DERIVED_TOOL_MODULES)) {
    assert.equal(existsSync(join(HERE, moduleName)), true, `${moduleName} (implementing derived tool ${toolName}) must exist in src/mcp/vice`);
  }
});

test("D-02 mechanism 2: no module implementing a STOCK_DERIVED_TOOLS entry may ever join the hostpath.ts consumer set", () => {
  // Uses the declared map, not a guess at file names -- a FUTURE derived
  // tool that reaches hostpath.ts fails THIS test rather than shipping,
  // which is the whole point of a second, independent enforcement
  // mechanism (D-02): one structural test alone was rejected because CR-07
  // proved a structural test can pass while the real violation stands.
  const importers = new Set(hostpathImporters());
  const distinctModules = new Set(Object.values(DERIVED_TOOL_MODULES));
  for (const moduleName of distinctModules) {
    assert.equal(importers.has(moduleName), false, `${moduleName} (implementing a STOCK_DERIVED_TOOLS entry) must not import hostpath.ts`);
  }
});
