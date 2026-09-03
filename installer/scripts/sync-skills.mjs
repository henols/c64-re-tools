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
import { basename, dirname, join, sep } from "node:path";
import { existsSync, rmSync, mkdirSync, readdirSync, readFileSync, cpSync } from "node:fs";
import { createHash } from "node:crypto";

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
//
// THE RULE IS A PURE PREDICATE, and the counter is layered on top of it. It
// used to be one function that incremented `excluded` as a side effect of
// being asked, which is fine for a single `cpSync` filter pass and wrong the
// moment anything else needs to ask the same question -- the drift check
// below asks it for every candidate, and a counting predicate would have
// reported a number several times too high.
//
// PATH CONTEXT, NOT JUST A BASENAME (33 review CR-01). The rule started out
// as a pure basename test, which cannot express the one exclusion that
// matters most here: a *derived per-release transient allow-list*
// (`<skill>/transients/<release>.json`). Those artifacts are this repository's
// own measurement of its own captures -- 49 addresses derived from three
// jitter runs of one release, on one host, at one argv digest. Shipping one
// installs an INHERITED address set into every consumer project, reachable
// through the command `transients/README.md` itself documents
// (`check --allow-list transients/<id>.json`), and the same README states in
// shipped prose that the installed directory carries "this README and nothing
// else". CAP-02/D-23 are explicit that the derivation METHOD travels and the
// address set never does: "no address set is ever inherited between
// releases", because a borrowed list cannot afterwards be distinguished from
// an honestly derived one. So the predicate takes the parent directory name
// too. The artifacts stay in the repo (they are phase 33's committed
// evidence); they just stop being published.
function isNonShipping(base, parentBase) {
  return (
    base === "fixtures" ||
    base.endsWith(".test.mjs") ||
    base.endsWith(".test.js") ||
    base === "test-corpus.mjs" ||
    (parentBase === "transients" && base.endsWith(".json"))
  );
}

let excluded = 0;

/** The filter `cpSync` drives. Pure predicate, no counting: `excluded` is
 * already known by the time anything is copied. */
function shouldCopy(src) {
  const parts = src.split(sep).filter((part) => part !== "");
  return !isNonShipping(parts[parts.length - 1], parts[parts.length - 2]);
}

// ---------------------------------------------------------------------------
// REBUILD ONLY ON DRIFT  (CR-07, phase 32 review round 4)
// ---------------------------------------------------------------------------
//
// WHY THIS EXISTS. The rebuild below is `rmSync(DEST, { recursive: true })`
// followed by a repopulate, so for the duration of a rebuild `installer/skills/`
// is missing or partial. That is a shared directory: `anno-verb-coverage.test.ts`
// and `audit-root-args.test.ts` read it, and `node --test <files>` runs test
// FILES IN PARALLEL.
//
// 30-REVIEW's WR-11 drew the line at "a CI script may regenerate; a test may
// not" and stopped `anno-verb-coverage.test.ts` regenerating. CR-07 is that
// same defect arriving by a transitive route the line did not cover:
// `audit-root-args.test.ts`'s adjacency loop SPAWNS
// `scripts/check-skill-cli-invocations.mjs` five times -- a baseline run plus
// four `--root` spellings that all RESOLVE to the repository root -- and that
// gate regenerates at module scope. So the suite rebuilt the shipped tree five
// times per run, from inside a parallel test phase, while other tests read it.
//
// The fix is here rather than in either caller because every caller wants the
// same thing: the shipped tree CORRECT, not the shipped tree REWRITTEN. When it
// already matches the source, this script now writes nothing at all, so the
// five spawns become five no-ops and the window never opens. A genuinely stale
// tree is still rebuilt -- correctness is not traded for quiet.
//
// Comparison is by relative path set AND content, because a same-name file with
// different bytes is exactly the drift a path-only check would miss.

/** Walks SRC applying the exclusion rule, counting each rejected entry once --
 * a `fixtures` directory counts once and is not descended into, mirroring how
 * `cpSync`'s filter prunes. Returns relative path -> sha256 of the bytes. */
function plannedFiles() {
  const planned = new Map();
  for (const name of names) {
    walk(join(SRC, name), name);
  }
  return planned;

  function walk(abs, rel) {
    for (const entry of readdirSync(abs, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const childAbs = join(abs, entry.name);
      const childRel = `${rel}/${entry.name}`;
      if (isNonShipping(entry.name, basename(abs))) {
        excluded++;
        continue;
      }
      if (entry.isDirectory()) walk(childAbs, childRel);
      else if (entry.isFile()) planned.set(childRel, createHash("sha256").update(readFileSync(childAbs)).digest("hex"));
    }
  }
}

/** Whatever is on disk under DEST now, in the same shape. */
function presentFiles() {
  const present = new Map();
  if (!existsSync(DEST)) return present;
  walk(DEST, "");
  return present;

  function walk(abs, rel) {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const childAbs = join(abs, entry.name);
      const childRel = rel === "" ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(childAbs, childRel);
      else if (entry.isFile()) present.set(childRel, createHash("sha256").update(readFileSync(childAbs)).digest("hex"));
    }
  }
}

const planned = plannedFiles();
const present = presentFiles();
const inSync =
  planned.size === present.size && [...planned].every(([rel, hash]) => present.get(rel) === hash);

if (inSync) {
  console.error(
    `sync-skills: already in sync -- ${planned.size} file(s) across ${names.length} skill(s) ` +
      `in ${DEST} match src/skills/ byte-for-byte; NOTHING WRITTEN (CR-07: a rebuild here ` +
      `deletes a directory that tests running in parallel read).`,
  );
  process.exit(0);
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
console.error(`sync-skills: excluded ${excluded} non-shipping entr${excluded === 1 ? "y" : "ies"} ` +
    `(test files, fixtures/, test-corpus.mjs, transients/*.json derived allow-lists)`);
