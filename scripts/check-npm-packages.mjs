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
// The one legitimate filesystem check against a repo path (see the import
// below) is the repo-root THIRD-PARTY-NOTICES.md pointer check further down
// -- that pointer is a repo-page artefact, deliberately never packed, so
// there is no tarball list to check it against.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const errors = [];
const need = (cond, msg) => {
  if (!cond) errors.push(msg);
};

function packFiles(dir) {
  const out = execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: dir, encoding: "utf8" });
  const parsed = JSON.parse(out);
  const entry = Array.isArray(parsed) ? parsed[0] : parsed;
  return {
    name: entry.name,
    version: entry.version,
    files: (entry.files ?? []).map((f) => f.path),
  };
}

// --- @henols/vice-mcp -------------------------------------------------------
const vice = packFiles(join(ROOT, ".claude/mcp/vice"));
need(vice.name === "@henols/vice-mcp", `vice-mcp: name is "${vice.name}", expected "@henols/vice-mcp"`);
need(vice.files.includes("vice-proxy.ts"), "vice-mcp: missing vice-proxy.ts (bin entry)");
need(vice.files.includes("tools-manifest.json"), "vice-mcp: missing tools-manifest.json");
need(vice.files.includes("container-guard.mts"), "vice-mcp: missing container-guard.mts (imported by vice.ts)");
need(vice.files.some((f) => f.startsWith("resources/")), "vice-mcp: missing resources/");
need(!vice.files.some((f) => f.includes("node_modules/")), "vice-mcp: node_modules/ leaked into tarball");
need(
  !vice.files.some((f) => /\.test\.(ts|mts|mjs|js)$/.test(f)),
  "vice-mcp: test files leaked into tarball"
);
need(!vice.files.some((f) => f.startsWith("fixtures/")), "vice-mcp: fixtures/ leaked into tarball");

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
{
  const viceDir = join(ROOT, ".claude/mcp/vice");
  const listed = new Set(vice.files);
  const seen = new Set();
  const stack = ["vice-proxy.ts"];
  let closureError = null;
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
    for (const m of src.matchAll(/^\s*import\s[^;]*?from\s+"(\.\/[^"]+)"/gm)) {
      const dep = m[1].slice(2);
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
  const vicePkg = JSON.parse(readFileSync(join(ROOT, ".claude/mcp/vice/package.json"), "utf8"));
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
      pointerText.includes(".claude/mcp/vice/THIRD-PARTY-NOTICES.md"),
      "repo root: THIRD-PARTY-NOTICES.md pointer does not name the canonical .claude/mcp/vice/THIRD-PARTY-NOTICES.md path"
    );
  }
}

// --- @henols/c64-re-tools (installer) ---------------------------------------
const inst = packFiles(join(ROOT, "installer"));
need(inst.name === "@henols/c64-re-tools", `installer: name is "${inst.name}", expected "@henols/c64-re-tools"`);
need(inst.files.includes("bin/cli.mjs"), "installer: missing bin/cli.mjs (bin entry)");
const skillMds = inst.files.filter((f) => /^skills\/[^/]+\/SKILL\.md$/.test(f));
need(skillMds.length === 6, `installer: expected 6 skills with SKILL.md, found ${skillMds.length}`);
need(!inst.files.some((f) => f.includes("node_modules/")), "installer: node_modules/ leaked into tarball");

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
