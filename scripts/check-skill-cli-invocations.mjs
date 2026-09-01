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
import {
  parseRootArg,
  resolveContainedRoot,
  splitReadRefusalReason,
} from "./lib/audit-root.mjs";

const DEFAULT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** The identifier this gate binds STATICALLY, named here so the split-read
 *  refusal below can print it. A static specifier resolves against this file's
 *  own location and cannot follow `--root`; keeping the list beside the import
 *  is what makes a future second import impossible to add without noticing that
 *  it belongs here too. */
const STATICALLY_BOUND = [
  { name: "VERB_OPTIONS", from: "../src/mcp/vice/anno-cli.ts" },
];

/**
 * Every path this gate reads, derived from ONE root, plus the subset that must
 * EXIST for the run to mean anything.
 *
 * WHY THIS FUNCTION EXISTS (phase 32, D-07): the phase-32 audit has to observe
 * this gate FAILING against a planted violation, and the only safe way to
 * arrange that for some rows is to point the whole gate at a synthetic tree
 * via `--root`. That is only sound if EVERY path comes from the one root.
 *
 * WHAT THIS GATE ACTUALLY DOES WITH `--root`, AND WHY (`CR-03`): every PATH
 * below comes from the one root, but not every INPUT to this gate is a path.
 * `VERB_OPTIONS` -- the declaration table every documented flag, positional and
 * value-kind is checked against -- arrives through a static import at the top
 * of this file, and a static specifier is resolved against this file's own
 * location, so no argument can move it. This gate therefore does NOT support an
 * arbitrary `--root`: a resolved root that is not `DEFAULT_ROOT` is REFUSED
 * outright, below, rather than half-honoured.
 *
 * A sentence forbidding a re-derived `DEFAULT_ROOT` path stood here until
 * 2026-09-01. It was deleted because this file contradicted it twenty-nine
 * lines above itself: the phase-32 verifier reproduced this gate reading a
 * synthetic corpus and reporting `OK -- 18 documented anno CLI invocation(s)
 * ... every flag checked against anno-cli.ts's own VERB_OPTIONS` at exit 0,
 * where the invocations were synthetic and `anno-cli.ts` was the real one. A
 * rule a file breaks in its own text is worse than no rule, because a reader
 * trusts it. The remedy chosen -- of the two the verifier named -- is refusal
 * rather than root-parameterised dynamic imports; the reasoning is recorded in
 * `scripts/lib/audit-root.mjs`'s "THE SPLIT-READ SEAM" block and in plan
 * 32-12's objective.
 *
 * `scripts/check-skill-description-overlap.mjs` still carries that sentence,
 * and correctly: it binds no such import, so it honours an arbitrary contained
 * root for BOTH halves of its comparison.
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
// recorded in `scripts/audit-gate.mjs`'s header). A root that cannot be
// honoured REFUSES; it never degrades into a silent read of the default root.
//
// THIS FILE HAS NO ARGV READER OF ITS OWN, BY DESIGN. It had one, and the
// comment that stood here claimed it was the "same argv shape as
// `scripts/audit-gate.mjs`'s own `parseArgs()`". That claim was accurate, and
// that was precisely the defect: the same nine lines were copy-pasted verbatim
// into six scripts, so ONE bug shipped six times (`IN-06`) -- the loop matched
// only the exact token `--root` and took `argv[i + 1]`, so `--root=<dir>`, a
// valueless `--root` and every typo were SILENTLY DISCARDED and the run fell
// through to the default root while reporting success. `parseRootArg()` in
// `lib/audit-root.mjs` is now the single argv seam, as `resolveContainedRoot()`
// is the single containment seam.
//
// CORRECTION (2026-09-01, phase 32 gap-closure round 2, plan 32-16).
// `scripts/audit-gate.mjs` IS now on the shared strict parser: it reads its
// arguments through `parseRootArg()` too, declaring `--json` and `--hook` as
// `booleanFlags`, and its own hand-rolled reader is gone. The note that stood
// here SAID that file had deliberately not been migrated (`WR-13`), and gave
// as its reason that the file carried five further flags with their own
// exactly-one-selector rule. That reason was FALSE when it was written.
// Measured: `audit-gate.mjs` accepts three flags in total -- `--root`,
// `--json` and `--hook` -- and has no selector rule at all. The description
// belonged to `scripts/audit-mutation-harness.mjs` (RETIRED), which does carry five
// flags (`--root`, `--row`, `--rows`, `--all`, `--out`) and does enforce an
// exactly-one-of-`--row`/`--rows`/`--all` rule. A justification written about
// one file was copied into six, which is `IN-06` one layer up: the same
// copy-a-claim-without-checking-it failure, in the comments rather than in the
// code. It is corrected here rather than deleted, because a note recording how
// a wrong claim spread is the cheapest protection against it spreading again.
//
// `audit-gate.mjs` is on the argv seam but deliberately NOT on the containment
// seam. The measurement behind that asymmetry, and its named reversal trigger,
// are recorded in that file's own header -- once, there, rather than restated
// in each of the six files this correction touches.

// An ARGUMENT REJECTION. Reported before anything is resolved or read, and
// kept at exit 1 like the refusal below: the two are separated by their
// message (`BAD ARGUMENTS --` versus `REFUSED --`), never by their status.
let ROOT_ARG;
try {
  ({ root: ROOT_ARG } = parseRootArg(process.argv.slice(2), {
    script: "check-skill-cli-invocations",
  }));
} catch (err) {
  console.error(`check-skill-cli-invocations: ${err?.message ?? String(err)}`);
  process.exit(1);
}

// A REFUSAL (an out-of-repository --root) and a TYPO (a --root inside the
// repository that does not exist, or a tree missing this gate's inputs) exit
// with the SAME code, so they are separated by their message -- the WR-03
// contract behind audit-gate.mjs's own try/catch, where a mistyped root used
// to surface as an uncaught ENOENT indistinguishable from a refusal.
let RESOLVED_ROOT;
try {
  RESOLVED_ROOT = resolveContainedRoot(ROOT_ARG, {
    repoRoot: DEFAULT_ROOT,
  });
} catch (err) {
  console.error(`check-skill-cli-invocations: REFUSED -- ${err?.message ?? String(err)}`);
  process.exit(1);
}

// A SPLIT-READ REFUSAL (`CR-03`). Third failure class, same exit status as the
// other two, separated by its message prefix. Checked here -- before paths(),
// before the existence sweep, before the first read and before the
// installer/skills regeneration branch below -- so a refused root causes no I/O
// and spawns no child process at all.
//
// Measured at 7206f99, before this landed: `--root <in-repo synthetic tree>`
// exited 0 and printed a full green report ("18 documented anno CLI
// invocation(s) ... 3 verb(s) covered") in which the invocations came from the
// synthetic corpus and the VERB_OPTIONS table they were checked against came
// from the real repository. A planted violation in that corpus would have been
// measured against data the plant never touched.
//
// KNOWN CONSEQUENCE, recorded rather than tidied away: the `else` arm of the
// `P.root === DEFAULT_ROOT` branch below -- the one that SKIPS the
// installer/skills regeneration under a `--root` tree -- is now unreachable,
// because the only roots that get past this point are `DEFAULT_ROOT` itself. It
// is deliberately left in place. It is the correct behaviour for a
// root-honouring version of this gate, its stderr notice is the honest thing to
// print in that case, and deleting it would make a future re-enabling of an
// arbitrary root silently spawn `installer/scripts/sync-skills.mjs` from an
// operator-supplied tree -- which is `T-32-08`, the exact thing that branch
// exists to prevent.
if (RESOLVED_ROOT !== DEFAULT_ROOT) {
  console.error(
    `check-skill-cli-invocations: SPLIT READ REFUSED -- ${splitReadRefusalReason({
      resolvedRoot: RESOLVED_ROOT,
      defaultRoot: DEFAULT_ROOT,
      imports: STATICALLY_BOUND,
    })}`,
  );
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
