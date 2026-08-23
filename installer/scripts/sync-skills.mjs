#!/usr/bin/env node
// Copies the canonical skills from the repo's src/skills/ into installer/skills/
// so `npm pack`/`npm publish` bundles them into the @henols/c64-re-tools tarball.
// The canonical source of truth stays src/skills/ (also used by the Claude Code
// plugin); installer/skills/ is a generated, gitignored copy regenerated on every
// pack via the package's `prepack` script.
//
// Phase 16 gap closure (16-08): the copy used to be unfiltered, so the four
// committed skill test suites (*.test.mjs) and their shared test-only helper
// (test-corpus.mjs) reached the published @henols/c64-re-tools tarball with
// nothing to stop them -- Phase 16's own verification found this while
// scripts/check-npm-packages.mjs still exited 0. The exclusion rule below is
// deliberately re-expressed HERE, independently of check-npm-packages.mjs's
// own assertLeanTarball() check, rather than shared from one place: the gate
// must be able to catch this producer being wrong, which it cannot do if it
// shares the producer's own rule. Two narrower fixes were considered and
// rejected:
//   (a) installer/package.json's `files[]` -- rejected because it is
//       include-oriented and directory-level ("skills/" as a whole); to
//       express "skills/ except colocated test files" there would rely on
//       npm's version-dependent negation-pattern behaviour inside `files[]`.
//   (b) an installer/.npmignore -- rejected because its precedence relative
//       to `files[]` is subtle (npm's own docs call the interaction easy to
//       get wrong), and it would put the rule in a second place this copier
//       does not know about, instead of the one place that actually decides
//       what installer/skills/ contains.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, rmSync, mkdirSync, readdirSync, cpSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url)); // installer/scripts
const INSTALLER_ROOT = dirname(HERE); // installer
const REPO_ROOT = dirname(INSTALLER_ROOT); // repo root
const SRC = join(REPO_ROOT, "src", "skills");
const DEST = join(INSTALLER_ROOT, "skills");

if (!existsSync(SRC)) {
  console.error(`sync-skills: FAIL -- skills source not found at ${SRC}`);
  process.exit(1);
}

const names = readdirSync(SRC, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

if (names.length === 0) {
  console.error(`sync-skills: FAIL -- no skill directories under ${SRC}`);
  process.exit(1);
}

// Non-shipping files: colocated test files, test-only helpers and fixtures
// directories. None of these belong in the published tarball -- see the
// header comment for why this rule lives here rather than in package.json's
// `files[]` or a .npmignore.
let excluded = 0;
function shouldCopy(src) {
  const base = src.split("/").pop();
  if (base === "fixtures") {
    excluded++;
    return false;
  }
  if (base.endsWith(".test.mjs") || base.endsWith(".test.js")) {
    excluded++;
    return false;
  }
  if (base === "test-corpus.mjs") {
    excluded++;
    return false;
  }
  return true;
}

// Rebuild DEST from scratch so a removed/renamed skill never lingers in the tarball.
rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });
for (const name of names) {
  const srcPath = join(SRC, name);
  const destPath = join(DEST, name);
  cpSync(srcPath, destPath, { recursive: true, filter: shouldCopy });
}

console.error(`sync-skills: copied ${names.length} skill(s) into ${DEST}: ${names.join(", ")}`);
console.error(`sync-skills: excluded ${excluded} non-shipping entr${excluded === 1 ? "y" : "ies"} (test files, fixtures/, test-corpus.mjs)`);
