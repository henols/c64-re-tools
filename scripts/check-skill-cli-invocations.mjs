#!/usr/bin/env node
// Mechanical check behind REPOINT-01 and REPOINT-02: every documented
// `anno <verb> ...` invocation in BOTH skill trees is ARGUMENT-CHECKED --
// every flag against the verb's real accepted option set, every positional
// against the file kinds that verb actually reads, every flag the verb
// REQUIRES for its presence (added 2026-08-30, WR-01: without it this gate
// reported OK for a documented command that exits 1), and every value-taking
// flag for BOTH a value and that value's kind (added 2026-08-30, WR-18: kinds
// were checked for the positional SLOT and for nothing else, so CR-04's
// artefact-kind mistake was invisible one token to the right, in
// `--store game.prg`).
//
// WHY A SECOND SKILL GATE (29-VERIFICATION.md gap 2, review ids CR-04/CR-05).
// `scripts/check-skill-tool-coverage.mjs` resolves tool and verb NAMES. It is
// correct at that, and it is also why two documented commands shipped DEAD
// while it was green: `anno render-memmap game.regen2000proj --provenance ...`
// (the positional named a file the store opener refuses, exit 1) and
// `anno coverage game.prg --store ...` (the positional was decoded as the same
// retired format, printing a report of zeros, exit 1). Right verb, wrong
// argument, invisible to a name-only floor. A gate that cannot see a dead
// command is the structural reason the next re-pointing would ship the same
// way, so this is the sibling that checks the arguments.
//
// This script only ever `readFileSync()`s and matches skill content, and
// imports exactly one first-party TypeScript module from `src/mcp/vice/`
// (`anno-cli.ts`, for its own exported `VERB_OPTIONS` -- Node's native
// type-stripping resolves it with no build step and no flag, exactly as the
// sibling gate already imports `capability-registry.ts`). It never
// `import()`s, `require()`s, `eval()`s or spawns anything from either skill
// tree: skill content is untrusted input that is MATCHED, never executed
// (T-29-16-03).
//
// The one child process it does start is FIRST-PARTY and is not skill content:
// `installer/scripts/sync-skills.mjs`, run first so the SHIPPED copy scanned is
// current rather than stale. `installer/skills/` is generated and gitignored;
// without the sync this gate would silently check half the corpus and still
// clear its floor.
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { VERB_OPTIONS } from "../src/mcp/vice/anno-cli.ts";
// The per-verb declaration tables are imported, not declared here. They
// lived in this file until 2026-08-30, which meant the committed test could
// not read them -- this script runs its whole check at import time -- so the
// test declared a private COPY and proved a fixture while CI ran the shipped
// map. Moving them into the import-safe lib makes the table the test asserts
// against the table this gate uses (WR-01).
import {
  parseDocumentedInvocations,
  checkInvocation,
  ANNO_INVOCATION_FLOOR,
  POSITIONAL_KINDS,
  REQUIRED_FLAGS,
  FLAG_KINDS,
} from "./lib/anno-cli-invocations.mjs";
import { walkSkills } from "./lib/skill-corpus.mjs";
import { resolveContainedRoot } from "./lib/audit-root.mjs";

const DEFAULT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Every path this gate reads, derived from ONE root, plus the subset that must
 * EXIST for the run to mean anything.
 *
 * WHY THIS FUNCTION EXISTS (phase 32, D-07): the phase-32 audit has to observe
 * this gate FAILING against a planted violation, and the only safe way to
 * arrange that for some rows is to point the whole gate at a synthetic tree
 * via `--root`. That is only sound if EVERY path comes from the one root.
 *
 * WHAT NOT TO DO: do not re-derive a path from `DEFAULT_ROOT` anywhere below.
 * A root threaded through only SOME of the paths reads the synthetic tree for
 * one input and the real repository for another, and a planted violation in
 * the synthetic tree then goes silently unobserved -- a false green, which is
 * the exact failure mode this whole phase exists to rule out.
 */
function paths(root) {
  const srcSkillsDir = join(root, "src/skills");
  return {
    root,
    srcSkillsDir,
    installerSkillsDir: join(root, "installer/skills"),
    syncScript: join(root, "installer/scripts/sync-skills.mjs"),
    required: [srcSkillsDir],
  };
}

// `--root <dir>` is the ONLY new surface, and it is this gate's only
// testability seam: there is deliberately no environment-variable override, no
// skip flag and no waiver file anywhere in it (the no-relaxation-hatch rule
// recorded in `scripts/audit-gate.mjs`'s header). Same argv shape as that
// file's own `parseArgs()`.
function parseArgs(argv) {
  let root;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--root") {
      root = argv[i + 1];
      i += 1;
    }
  }
  return { root };
}

// A REFUSAL (an out-of-repository --root) and a TYPO (a --root inside the
// repository that does not exist, or a tree missing this gate's inputs) exit
// with the SAME code, so they are separated by their message -- the WR-03
// contract behind audit-gate.mjs's own try/catch, where a mistyped root used
// to surface as an uncaught ENOENT indistinguishable from a refusal.
let RESOLVED_ROOT;
try {
  RESOLVED_ROOT = resolveContainedRoot(parseArgs(process.argv.slice(2)).root, {
    repoRoot: DEFAULT_ROOT,
  });
} catch (err) {
  console.error(`check-skill-cli-invocations: REFUSED -- ${err?.message ?? String(err)}`);
  process.exit(1);
}

const P = paths(RESOLVED_ROOT);

// The ONE try/catch around every call below that can throw on a bad root.
// `P.required` holds only src/skills: installer/skills is GENERATED, so under
// the default root it may legitimately not exist yet (the sync below creates
// it), and the corpus walk's own non-vacuity floor is what reports its absence.
try {
  for (const required of [P.root, ...P.required]) {
    if (!existsSync(required)) {
      throw new Error(
        `--root resolves to ${P.root}, but ${required} does not exist. This is a TYPO or an ` +
          "incomplete synthetic tree, NOT a containment refusal: the path is inside the " +
          "repository root. Reported here rather than left to surface as an uncaught ENOENT (or, " +
          "worse, as one of this gate's own non-vacuity failures pointing at the corpus).",
      );
    }
  }
} catch (err) {
  console.error(`check-skill-cli-invocations: FAIL (--root) -- ${err?.message ?? String(err)}`);
  process.exit(1);
}

// ROOT below is the RESOLVED root, never DEFAULT_ROOT. Any new path this gate
// needs goes inside paths() above.
const ROOT = P.root;

const errors = [];
const need = (cond, msg) => {
  if (!cond) errors.push(msg);
};

// ---------------------------------------------------------------------------
// The corpus: BOTH trees.
// ---------------------------------------------------------------------------
// T-32-08: the sync is a FIRST-PARTY child process, and it stays that way. It
// runs only when the resolved root IS this repository; under a `--root` tree it
// is SKIPPED with a visible stderr notice rather than executed, because
// `installer/scripts/sync-skills.mjs` inside an operator-supplied tree is not
// first-party code and this gate must never implicitly run it. The consequence
// for a `--root` fixture is stated, not implied: it has to carry BOTH skill
// trees itself, since nothing regenerates the shipped one for it.
//
// The notice goes to stderr and only on the skip path, so an unflagged run's
// stdout report is byte-identical to its pre-flag self.
if (P.root === DEFAULT_ROOT) {
  try {
    execFileSync(process.execPath, [P.syncScript], { cwd: P.root, stdio: "pipe" });
  } catch (err) {
    errors.push(`could not regenerate installer/skills/ -- the shipped copy cannot be checked: ${err instanceof Error ? err.message : String(err)}`);
  }
} else {
  process.stderr.write(
    `check-skill-cli-invocations: SKIPPED the installer/skills/ regeneration -- --root is ${P.root}, ` +
      `not this repository, and installer/scripts/sync-skills.mjs is only run as first-party code. ` +
      `The --root tree must carry both skill trees itself; the scan below reads them as they are on disk.\n`,
  );
}

const TREES = [
  { name: "src/skills", dir: P.srcSkillsDir },
  { name: "installer/skills", dir: P.installerSkillsDir },
];

const invocations = [];
const filesWithFences = new Set();
let filesScanned = 0;

for (const tree of TREES) {
  const files = walkSkills(tree.dir);
  need(files.length > 0, `non-vacuity: no skill files found under ${tree.name} -- the corpus walk or the tree itself has regressed`);
  for (const file of files) {
    filesScanned++;
    const parsed = parseDocumentedInvocations(readFileSync(file, "utf8"));
    // `null` means "no fenced block at all", which is a legitimate state for a
    // prose-only file. It is NOT the same as an empty array, and conflating
    // them is how a broken extractor reads as a clean tree.
    if (parsed === null) continue;
    filesWithFences.add(file);
    for (const invocation of parsed) invocations.push({ file: file.slice(ROOT.length + 1), invocation });
  }
}

// ---------------------------------------------------------------------------
// The non-vacuity floor, asserted BEFORE any per-invocation result.
//
// Order is load-bearing: a broken extractor must fail LOUDLY here rather than
// report a clean run over zero invocations (T-29-16-05).
// ---------------------------------------------------------------------------
need(
  invocations.length >= ANNO_INVOCATION_FLOOR,
  `non-vacuity: expected at least ${ANNO_INVOCATION_FLOOR} documented anno CLI invocations across both skill trees, got ${invocations.length} -- ` +
    "the extractor, the skill playbooks or installer/skills/'s regeneration may have regressed. Do NOT lower the floor to make this pass.",
);

// The predicate is called inside a try/catch as DEFENCE IN DEPTH, not as the
// fix for anything (WR-19, 2026-08-30). The real fix is `own()` in the lib: a
// verb taken from skill text used to reach a prototype lookup, so
// `anno constructor ...` killed this gate with an unhandled TypeError and a
// stack trace instead of the named problem message every line below is built
// around. That hole is closed at the source. This wrapper exists so that if a
// FUTURE verb-keyed read is added without going through `own()`, the gate
// still fails as a reported problem naming the file and the invocation --
// never as a bare stack trace, and never as a silent pass.
for (const { file, invocation } of invocations) {
  let problems;
  try {
    problems = checkInvocation(invocation, VERB_OPTIONS, POSITIONAL_KINDS, REQUIRED_FLAGS, FLAG_KINDS);
  } catch (err) {
    need(false, `${file}: the invocation checker THREW on ${JSON.stringify(invocation.raw)} -- ${err instanceof Error ? err.message : String(err)}`);
    continue;
  }
  for (const problem of problems) {
    need(false, `${file}: ${problem}`);
  }
}

// --- Report ----------------------------------------------------------------
if (errors.length) {
  console.error("check-skill-cli-invocations: FAIL");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

const verbsCovered = [...new Set(invocations.map((i) => i.invocation.verb))].sort();
console.log(
  `check-skill-cli-invocations: OK -- ${invocations.length} documented anno CLI invocation(s) extracted from ` +
    `${filesWithFences.size} of ${filesScanned} skill file(s) across ${TREES.length} trees (${TREES.map((t) => t.name).join(", ")}); ` +
    `${verbsCovered.length} verb(s) covered (${verbsCovered.join(", ")}); ` +
    `every flag checked against anno-cli.ts's own VERB_OPTIONS, every positional against the kinds its loader reads, ` +
    `every REQUIRED flag for its presence, and every value-taking flag for both a value and that value's kind.`,
);
