#!/usr/bin/env node
// Validates what `npm publish` would ship for both npm packages, WITHOUT
// publishing: it runs `npm pack --dry-run --json` in each package dir (which
// also runs the installer's prepack skill-sync) and asserts the tarball's file
// list is correct and lean. Run locally or in CI before the publish job.
//
// Phase 4 (04-07, D-07/criterion 5) extended this file with three assertions
// that ALL read `vice.files` -- the actual packed tarball's own file list --
// never a filesystem check against a repo path. A repo-root filesystem check
// would pass even when the published package silently omits the file; that
// is exactly the CR-07-shaped failure 04-RESEARCH.md's Pitfall 2 names, and
// the warning sign it says to watch for:
//   1. THIRD-PARTY-NOTICES.md must be in the tarball (criterion 5's
//      notices-file requirement, closing T-04-07-01).
//   2. The five modules 04-02/04-05 added to files[] under Phase 3's Rule 2
//      must still be there -- a regression guard, not the first listing.
//   3. A transitive-closure walk from vice-proxy.ts's own relative imports
//      asserts every reachable local module is either an exact files[] entry
//      or lives under a directory entry (e.g. resources/) -- the
//      generalisation of Phase 3's Rule 2 (see 6801cf5, 897faf6) into a
//      mechanical gate no future phase has to remember by convention.
// A fourth assertion reads package.json's own `dependencies` (via
// `readFileSync`, not `vice.files`) to enforce DISASM-07: this package's
// runtime dependency set must stay exactly `@mastra/mcp` + `@mastra/core`.
// There are exactly TWO legitimate filesystem checks against a repo path in
// this file, and both are legitimate for the same reason -- there is no
// tarball list that could answer them:
//   1. The repo-root THIRD-PARTY-NOTICES.md pointer check further down --
//      that pointer is a repo-page artefact, deliberately never packed.
//   2. The installer skill-count RELATION (Phase 19, 19-01/ABS-01). Until
//      that plan this file pinned the packed skill count to the literal six
//      with an exact equality -- an equality
//      against a census that legitimately grows: adding the seventh skill
//      directory turned CI red on a correct tree. The project rule it now
//      satisfies is "assert relations, not counts" -- the installer tarball
//      must carry exactly as many `skills/<name>/SKILL.md` entries as
//      `src/skills/` has immediate subdirectories carrying a SKILL.md.
//      That relation CANNOT be derived from a tarball listing alone: the
//      tarball is one side of the equation and the repo tree is the other,
//      and it is precisely a producer that drops a skill on the way into the
//      tarball that this assertion exists to catch. A floor accompanies it so
//      a broken directory read cannot make the equality vacuously true on
//      two zeros.
//
// Phase 16 gap closure (16-08): the leak assertions (no node_modules/, no
// test files, no fixtures/, no test-only helper) used to live ONLY in the
// vice-mcp block below. Phase 16's verification found the installer tarball
// shipping four committed skill test files (*.test.mjs) while this script
// still exited 0, because nothing ever checked the installer's file list for
// the same class of leak -- the assertion was remembered per package, not
// enforced structurally. `assertLeanTarball()` now runs from INSIDE
// `packFiles()`, immediately before it returns, so every packed package is
// checked by construction: a per-package block can be forgotten, a check
// inside the one packing seam cannot be skipped without deleting the seam
// itself. The companion `need()` after both packs pins the packed-package
// set to exactly the two named packages, so a third package added later
// cannot be packed unchecked either -- it has to touch this expectation
// deliberately.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { topLevelSkillDirs } from "./lib/skill-corpus.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const errors = [];
const need = (cond, msg) => {
  if (!cond) errors.push(msg);
};

// The packed package names, recorded by packFiles() in call order. Checked
// after both packs against the expected two-package set (see below).
const packedNames = [];

// Shared per-package leak assertion, invoked from inside packFiles() so no
// packed package can skip it. Every message is prefixed with the package
// name so a failure says which tarball leaked.
function assertLeanTarball(packed) {
  const { name, files } = packed;
  const nodeModulesHits = files.filter((f) => f.includes("node_modules/"));
  need(nodeModulesHits.length === 0, `${name}: node_modules/ leaked into tarball -- ${nodeModulesHits.join(", ")}`);
  const testFileHits = files.filter((f) => /\.test\.(ts|mts|mjs|js)$/.test(f));
  need(testFileHits.length === 0, `${name}: test files leaked into tarball -- ${testFileHits.join(", ")}`);
  const fixturesHits = files.filter((f) => f.startsWith("fixtures/"));
  need(fixturesHits.length === 0, `${name}: fixtures/ leaked into tarball -- ${fixturesHits.join(", ")}`);
  const testCorpusHits = files.filter((f) => f.split("/").pop() === "test-corpus.mjs");
  need(
    testCorpusHits.length === 0,
    `${name}: test-corpus.mjs (test-only helper) leaked into tarball -- ${testCorpusHits.join(", ")}`
  );
}

function packFiles(dir) {
  const out = execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: dir, encoding: "utf8" });
  const parsed = JSON.parse(out);
  const entry = Array.isArray(parsed) ? parsed[0] : parsed;
  const packed = {
    name: entry.name,
    version: entry.version,
    files: (entry.files ?? []).map((f) => f.path),
  };
  assertLeanTarball(packed);
  packedNames.push(packed.name);
  return packed;
}

// --- @henols/vice-mcp -------------------------------------------------------
const vice = packFiles(join(ROOT, "src/mcp/vice"));
need(vice.name === "@henols/vice-mcp", `vice-mcp: name is "${vice.name}", expected "@henols/vice-mcp"`);
need(vice.files.includes("vice-proxy.ts"), "vice-mcp: missing vice-proxy.ts (bin entry)");
need(vice.files.includes("tools-manifest.json"), "vice-mcp: missing tools-manifest.json");
need(vice.files.includes("container-guard.mts"), "vice-mcp: missing container-guard.mts (imported by vice.ts)");
need(vice.files.some((f) => f.startsWith("resources/")), "vice-mcp: missing resources/");
// node_modules/, test-file, fixtures/ and test-corpus.mjs leak checks are
// asserted structurally by assertLeanTarball() from inside packFiles() above.

// --- quick-260819-tsz: the version-resolution script and template must ----
// never ship. scripts/version.mjs is a repo-maintenance CLI (reads npm
// read-only, writes local JSON) with no reason to run inside a published
// tarball, and VERSION is the working-tree-only template (R-1) -- a real
// release never carries it, only the resolved number `npm version` already
// wrote into package.json.
need(!vice.files.some((f) => f.startsWith("scripts/")), "vice-mcp: scripts/ leaked into tarball");
need(!vice.files.includes("VERSION"), "vice-mcp: VERSION template leaked into tarball");

// --- D-07 / criterion 5: the notices file must actually ship ---------------
need(
  vice.files.includes("THIRD-PARTY-NOTICES.md"),
  "vice-mcp: missing THIRD-PARTY-NOTICES.md -- criterion 5 requires the opcode table's zlib provenance to ship with the package (D-07)"
);

// --- Phase 3 Rule 2 regression guard: Phase 4 and Phase 5's derived modules -
// These entries were added to files[] by 04-02 (stock-derived.ts), 04-05
// (stock-disassemble.ts + the three disasm-*.ts), 05-06 (stock-memory-search.ts,
// stock-symbols.ts) and 05-07 (stock-vicii.ts, stock-cia.ts, stock-sprites.ts)
// in the SAME commit that made each reachable from vice-proxy.ts's import
// closure. This loop re-asserts they are still there; the transitive-closure
// walk below is the general form that catches any FUTURE phase repeating the
// same mistake.
const REQUIRED_DERIVED_MODULES = [
  ["stock-derived.ts", "DERIV-07"],
  ["stock-disassemble.ts", "DISASM-01"],
  ["disasm-opcodes.ts", "DISASM-02"],
  ["disasm-decoder.ts", "DISASM-04"],
  ["disasm-renderer.ts", "DISASM-03"],
  ["stock-memory-search.ts", "DERIV-01"],
  ["stock-symbols.ts", "DERIV-04"],
  ["stock-vicii.ts", "DERIV-05"],
  ["stock-cia.ts", "DERIV-05"],
  ["stock-sprites.ts", "DERIV-06"],
  ["capability-registry.ts", "BACK-05"],
  ["version.ts", "D-5"],
  ["r2000-cli.ts", "R2000-09"],
];
for (const [file, req] of REQUIRED_DERIVED_MODULES) {
  need(vice.files.includes(file), `vice-mcp: missing ${file} -- ${req} would ship a package that throws ERR_MODULE_NOT_FOUND`);
}

// --- Transitive-closure check: the generalisation of Phase 3 Rule 2 --------
// Walk every relative import reachable from vice-proxy.ts and assert each
// target resolves to something in vice.files -- either an exact entry or a
// file under a directory entry (e.g. "resources"). This makes Rule 2
// mechanical rather than something each future phase has to remember: Phase
// 3 hit it twice (6801cf5, 897faf6) and an earlier draft of Phase 4's plan
// set would have hit it again.
//
// Folded todo 1 (2026-08-20-npm-closure-walk-blind-to-dynamic-imports.md):
// the walk was STATIC-IMPORT-ONLY, so `vice-proxy.ts:218`'s
// `const { runR2000Cli } = await import("./r2000-cli.ts");` was structurally
// invisible to it -- the whole r2000 family (r2000-cli.ts, r2000-d64.ts,
// r2000-project.ts, r2000-launch.ts, r2000-verify.ts) was reachable at
// runtime through that one dynamic import but NONE of it was ever traversed,
// so `files[]` was correct only by hand. The dynamic-import regex below is
// ADDED alongside the static one (never a replacement) so a module reachable
// only through `await import("./x.ts")` and missing from `files[]` now
// produces the same "is imported by ... but is not in the published
// tarball" failure a missing static import already did.
{
  const viceDir = join(ROOT, "src/mcp/vice");
  const listed = new Set(vice.files);
  const seen = new Set();
  const stack = ["vice-proxy.ts"];
  let closureError = null;
  const STATIC_IMPORT_RE = /^\s*import\s[^;]*?from\s+"(\.\/[^"]+)"/gm;
  const DYNAMIC_IMPORT_RE = /import\s*\(\s*"(\.\/[^"]+)"\s*\)/g;
  while (stack.length && !closureError) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    let src;
    try {
      src = readFileSync(join(viceDir, f), "utf8");
    } catch {
      continue;
    }
    const deps = [
      ...[...src.matchAll(STATIC_IMPORT_RE)].map((m) => m[1]),
      ...[...src.matchAll(DYNAMIC_IMPORT_RE)].map((m) => m[1]),
    ];
    for (const rawDep of deps) {
      const dep = rawDep.slice(2);
      const shipped = listed.has(dep) || vice.files.some((e) => dep.startsWith(e + "/"));
      if (!shipped) {
        closureError = `vice-mcp: ${dep} is imported by ${f} but is not in the published tarball -- Rule 2 (see 6801cf5, 897faf6)`;
        break;
      }
      stack.push(dep);
    }
  }
  need(!closureError, closureError ?? "");
  if (!closureError) {
    console.log(`check-npm-packages: transitive closure from vice-proxy.ts -- ${seen.size} modules, clean`);
  }
}

// --- DISASM-07: no new runtime dependency was added -------------------------
{
  const vicePkg = JSON.parse(readFileSync(join(ROOT, "src/mcp/vice/package.json"), "utf8"));
  const depKeys = Object.keys(vicePkg.dependencies ?? {});
  const expected = ["@mastra/mcp", "@mastra/core"];
  const sameCount = depKeys.length === expected.length;
  const sameSet = expected.every((k) => depKeys.includes(k)) && depKeys.every((k) => expected.includes(k));
  need(
    sameCount && sameSet,
    `vice-mcp: runtime dependencies are [${depKeys.join(", ")}], expected exactly [${expected.join(", ")}] -- DISASM-07 forbids adding a new runtime dependency for the disassembler`
  );
}

// --- Repo-root THIRD-PARTY-NOTICES.md pointer -------------------------------
// The one legitimate filesystem check against a repo path in this file: the
// pointer is a repo-page artefact, deliberately never packed, so there is no
// tarball list to check it against.
{
  const pointerPath = join(ROOT, "THIRD-PARTY-NOTICES.md");
  const pointerExists = existsSync(pointerPath);
  need(pointerExists, "repo root: missing THIRD-PARTY-NOTICES.md pointer file");
  if (pointerExists) {
    const pointerText = readFileSync(pointerPath, "utf8");
    need(
      pointerText.includes("src/mcp/vice/THIRD-PARTY-NOTICES.md"),
      "repo root: THIRD-PARTY-NOTICES.md pointer does not name the canonical src/mcp/vice/THIRD-PARTY-NOTICES.md path"
    );
  }
}

// --- @henols/c64-re-tools (installer) ---------------------------------------
const inst = packFiles(join(ROOT, "installer"));
need(inst.name === "@henols/c64-re-tools", `installer: name is "${inst.name}", expected "@henols/c64-re-tools"`);
need(inst.files.includes("bin/cli.mjs"), "installer: missing bin/cli.mjs (bin entry)");
// --- ABS-02: the package that actually SHIPS the absorbed third-party prose
// must carry a notices document. Mirrors the vice-mcp assertion above, and
// for the same reason it reads `inst.files` -- the installer tarball's own
// packed file list -- rather than a repo path. A repo-path check
// (`existsSync(join(ROOT, "installer/THIRD-PARTY-NOTICES.md"))`) passes even
// when the published package omits the file entirely, because the file can
// sit in the working tree while never being named in `files[]`; that is the
// exact failure class this file's header names, and it is the whole reason
// the two legitimate repo-path checks here are enumerated rather than
// treated as ordinary. The absorbed prose under `skills/` travels to npm
// consumers inside THIS tarball, not vice-mcp's, so vice-mcp's notices file
// does not discharge the obligation for it.
need(
  inst.files.includes("THIRD-PARTY-NOTICES.md"),
  "installer: missing THIRD-PARTY-NOTICES.md -- ABS-02 requires the package that ships the adapted regenerator2000 procedure prose (skills/) to carry its own notices document"
);
const skillMds = inst.files.filter((f) => /^skills\/[^/]+\/SKILL\.md$/.test(f));
// The relation side: `src/skills/` immediate subdirectories that carry a
// SKILL.md. `topLevelSkillDirs()` is the shared corpus primitive (WR-12) --
// do not write a second walker here. See this file's header for why this is
// one of only two legitimate repo-path filesystem checks in this script.
const SRC_SKILLS_DIR = join(ROOT, "src/skills");
const srcSkillDirs = topLevelSkillDirs(SRC_SKILLS_DIR).filter((name) =>
  existsSync(join(SRC_SKILLS_DIR, name, "SKILL.md"))
);
// Non-vacuity floor, deliberately a floor and not an equality: a broken or
// empty directory read must FAIL here rather than make the equality below
// trivially true on 0 === 0.
need(
  srcSkillDirs.length >= 6,
  `installer: only ${srcSkillDirs.length} directories under src/skills/ carry a SKILL.md -- at least 6 expected; the relation below would be vacuous`
);
need(
  skillMds.length === srcSkillDirs.length,
  `installer: tarball carries ${skillMds.length} skills with SKILL.md but src/skills/ has ${srcSkillDirs.length} ` +
    `(${srcSkillDirs.join(", ")}) -- every canonical skill must reach the published tarball`
);
// node_modules/ (and the other leak classes) are asserted structurally by
// assertLeanTarball() from inside packFiles() above.

// --- companion invariant: the packed-package set is pinned -----------------
// A promote decision (Phase 16 gap closure): the leak assertions became
// package-agnostic, so the set of packages actually packed must be pinned
// too, or a third package could be added later and packed unchecked simply
// by never calling packFiles() on it from this file's own review. If this
// fails, a third package must be added to `expectedPackedNames` deliberately.
const expectedPackedNames = ["@henols/vice-mcp", "@henols/c64-re-tools"];
need(
  packedNames.length === expectedPackedNames.length &&
    expectedPackedNames.every((n) => packedNames.includes(n)) &&
    packedNames.every((n) => expectedPackedNames.includes(n)),
  `check-npm-packages: packed package set is [${packedNames.join(", ")}], expected exactly [${expectedPackedNames.join(", ")}] -- a third package must be added to this expectation deliberately, it cannot be packed unchecked`
);

if (errors.length) {
  console.error("check-npm-packages: FAIL");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(
  `check-npm-packages: OK\n` +
    `  ${vice.name}@${vice.version} -- ${vice.files.length} files\n` +
    `  ${inst.name}@${inst.version} -- ${inst.files.length} files, ${skillMds.length} skills`
);
