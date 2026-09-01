#!/usr/bin/env node
// Mechanical check behind Phase 5's success criterion 5: "running each of the
// six skills' documented tool calls against the stock backend produces no
// unadvertised-tool failure except for the tools proven unrecoverable."
//
// Before this script existed, the skills-versus-manifest analysis behind the
// 2026-08-17 scope cut (see ROADMAP.md "Cut from scope") was done BY HAND --
// nothing in this repo could re-run it. This is the one authoritative place
// that answers "does every vice_* tool a skill documents actually exist on
// the active stock backend, or is its absence explained?" Phase 8's DIST-01
// (a support table DERIVED from the shipped manifests, not maintained by
// hand) is expected to reuse this same extraction rather than re-deriving it.
//
// The allowlist below is designed to SHRINK BY FAILING, not grow silently:
// every FORK_ONLY_UNRECOVERABLE and PENDING_LATER_PHASE entry is asserted
// ABSENT from the stock manifest, so the day a later phase lands one of them
// (e.g. Phase 7's vice_cycles_stopwatch/vice_run_until), this script fails
// until the stale entry is deleted. An allowlist that can only ever grow is
// how a coverage check rots into a permanent exemption (see the plan's own
// D-05-05/T-05-08-02).
//
// D-E, ONE SOURCE OF TRUTH (Phase 8, plan 08-06): FORK_ONLY_UNRECOVERABLE
// below is a PROJECTION of capability-registry.ts's CAPABILITY_REGISTRY
// (the hardware-category, fork-provided entries), never a second
// hand-maintained copy of the same three-tool set. If a reason reads wrong,
// the fix is always in capability-registry.ts, never here.
//
// This script only ever readFileSync()s and regex-matches skill content, and
// imports exactly one first-party TypeScript module from src/mcp/vice/
// (capability-registry.ts, Node's native type-stripping resolves it with no
// build step and no flag). That one new import does not weaken this script's
// standing rule: it still never import()s, require()s, eval()s or spawns anything from src/skills/ --
// skill content remains untrusted input that is matched, never executed.
//
// FLOW-01 (11.1-CONTEXT.md, D-11.1-02): everything above checks MCP TOOL
// names in skill prose, but nothing checked CLI VERBS at all -- so
// `gen-enums`, `export-lbl` and `import-lbl` (ANNO-13/-14/-15's own delivery
// path) reached `main` documented in zero skill files, with nothing here
// catching it. The verb-coverage section near the bottom of this file closes
// that gap the same way the rest of this file already works: the verb list is
// PARSED from `anno-cli.ts`'s own dispatch switch
// (`scripts/lib/anno-cli-verbs.mjs`), never a hand-typed array -- a
// hard-coded list is exactly how this class of finding arrives. The
// subcommand those verbs are invoked under was renamed `anno` -> `anno` on
// 2026-08-29 (plan 29-09); the literal lives once, in that module.
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { CAPABILITY_REGISTRY } from "../src/mcp/vice/capability-registry.ts";
import { CURATED_ANNO_TOOLS } from "../src/mcp/vice/anno-tools.ts";
import { parseAnnoCliVerbs, verbsMissingFromSkills, ANNO_CLI_VERB_FLOOR } from "./lib/anno-cli-verbs.mjs";
import { walkSkills, MCP_PREFIX_RE, extractToolNames, topLevelSkillDirs } from "./lib/skill-corpus.mjs";
import {
  parseRootArg,
  resolveContainedRoot,
  splitReadRefusalReason,
} from "./lib/audit-root.mjs";

const DEFAULT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** The identifiers this gate binds STATICALLY, named here so the split-read
 *  refusal below can print them. A static specifier resolves against this
 *  file's own location and cannot follow `--root`; keeping the list beside the
 *  imports is what makes a future third import impossible to add without
 *  noticing that it belongs here too. */
const STATICALLY_BOUND = [
  { name: "CAPABILITY_REGISTRY", from: "../src/mcp/vice/capability-registry.ts" },
  { name: "CURATED_ANNO_TOOLS", from: "../src/mcp/vice/anno-tools.ts" },
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
 * `CAPABILITY_REGISTRY` and `CURATED_ANNO_TOOLS` -- the two tables the corpus
 * is measured AGAINST -- arrive through static imports at the top of this file,
 * and a static specifier is resolved against this file's own location, so no
 * argument can move them. This gate therefore does NOT support an arbitrary
 * `--root`: a resolved root that is not `DEFAULT_ROOT` is REFUSED outright,
 * below, rather than half-honoured.
 *
 * A sentence forbidding a re-derived `DEFAULT_ROOT` path stood here until
 * 2026-09-01. It was deleted because this file contradicted it two lines above
 * itself: the phase-32 verifier reproduced this gate reading a synthetic corpus
 * and reporting `OK` against the real registry, at exit 0. A rule a file breaks
 * in its own text is worse than no rule, because a reader trusts it. The remedy
 * chosen -- of the two the verifier named -- is refusal rather than
 * root-parameterised dynamic imports; the reasoning is recorded in
 * `scripts/lib/audit-root.mjs`'s "THE SPLIT-READ SEAM" block and in plan
 * 32-12's objective.
 *
 * `scripts/check-skill-description-overlap.mjs` still carries that sentence,
 * and correctly: it binds no such import, so it honours an arbitrary contained
 * root for BOTH halves of its comparison.
 */
function paths(root) {
  const viceDir = join(root, "src/mcp/vice");
  const skillsDir = join(root, "src/skills");
  return {
    root,
    viceDir,
    skillsDir,
    // Every file this gate readFileSync()s at a FIXED path. `topLevelSkillDirs()`
    // throws on a missing skillsDir and the four source reads throw ENOENT, so
    // all of them are asserted present up front instead.
    required: [
      skillsDir,
      join(viceDir, "tools-manifest.json"),
      join(viceDir, "tools-manifest.stock.json"),
      join(viceDir, "vice-proxy.ts"),
      join(viceDir, "vice.ts"),
      join(viceDir, "anno-cli.ts"),
    ],
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
// belonged to `scripts/audit-mutation-harness.mjs`, which does carry five
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
    script: "check-skill-tool-coverage",
  }));
} catch (err) {
  console.error(`check-skill-tool-coverage: ${err?.message ?? String(err)}`);
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
  console.error(`check-skill-tool-coverage: REFUSED -- ${err?.message ?? String(err)}`);
  process.exit(1);
}

// A SPLIT-READ REFUSAL (`CR-03`). Third failure class, same exit status as the
// other two, separated by its message prefix. Checked here -- before paths(),
// before the existence sweep and before the first read -- so a refused root
// causes no I/O at all.
//
// Measured at 7206f99, before this landed: `--root <in-repo synthetic tree>`
// exited 0 and printed a full green report ("37 distinct vice_* names ... all
// curated") in which the NAMES came from the synthetic corpus and the two
// tables they were checked against came from the real repository. A planted
// violation in that corpus would have been measured against data the plant
// never touched. That is the false green this refusal removes.
if (RESOLVED_ROOT !== DEFAULT_ROOT) {
  console.error(
    `check-skill-tool-coverage: SPLIT READ REFUSED -- ${splitReadRefusalReason({
      resolvedRoot: RESOLVED_ROOT,
      defaultRoot: DEFAULT_ROOT,
      imports: STATICALLY_BOUND,
    })}`,
  );
  process.exit(1);
}

const P = paths(RESOLVED_ROOT);

// The ONE try/catch around every call below that can throw on a bad root.
// `P.required` enumerates them: topLevelSkillDirs() throws on a missing skills
// directory, and the four fixed-path readFileSync() calls below throw ENOENT.
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
  console.error(`check-skill-tool-coverage: FAIL (--root) -- ${err?.message ?? String(err)}`);
  process.exit(1);
}

// ROOT/VICE_DIR/SKILLS_DIR below are the RESOLVED root's paths, never
// DEFAULT_ROOT's. Any new path this gate needs goes inside paths() above.
const { root: ROOT, viceDir: VICE_DIR, skillsDir: SKILLS_DIR } = P;

const errors = [];
const need = (cond, msg) => {
  if (!cond) errors.push(msg);
};

// walkSkills(), MCP_PREFIX_RE, TOOL_NAME_RE and topLevelSkillDirs() now
// live in ./lib/skill-corpus.mjs (WR-12, 08-REVIEW.md) -- this script no
// longer carries its own copy; see that module's header for why.
const skillFiles = walkSkills(SKILLS_DIR);

// Top-level skill directories actually scanned (>=1 file read in each) --
// non-vacuity control 2. This assertion is about THIS run's traversal, not
// a corpus primitive, so it stays local rather than moving into the shared
// module.
const topLevelDirs = topLevelSkillDirs(SKILLS_DIR);
const dirsWithAFileRead = new Set();
for (const f of skillFiles) {
  const rel = f.slice(SKILLS_DIR.length + 1);
  const top = rel.split("/")[0];
  dirsWithAFileRead.add(top);
}

// --- Extraction --------------------------------------------------------
// MCP_PREFIX_RE/TOOL_NAME_RE/extractToolNames() now live in
// ./lib/skill-corpus.mjs (WR-12) -- imported above, not re-derived here.
// Plan 11-05, Phase 11: a second, independent extraction pass for the
// curated annotation surface (D-16/D-18), RE-POINTED onto that surface's own
// `anno_*` prefix by plan 29-09 (2026-08-29). Kept in its OWN map rather than
// merged into `extracted` above -- the two families are served through
// completely different gates (stock/fork manifests vs. CURATED_ANNO_TOOLS,
// a proxy-local allow-list), so conflating them would blur which gate a
// given name is actually checked against.
const ANNO_TOOL_NAME_RE = /\banno_[a-z0-9_]+/g;

/** @type {Map<string, Set<string>>} */
const extracted = new Map();
/** @type {Map<string, Set<string>>} */
const extractedAnno = new Map();
for (const f of skillFiles) {
  const raw = readFileSync(f, "utf8");
  const matches = extractToolNames(raw);
  // anno_* is a separate family with its own gate (CURATED_ANNO_TOOLS,
  // never either manifest) -- not part of the shared skill-corpus module,
  // but it still needs the same MCP-prefix strip before matching.
  const cleaned = raw.replace(MCP_PREFIX_RE, "");
  const annoMatches = cleaned.match(ANNO_TOOL_NAME_RE) || [];
  const rel = f.slice(ROOT.length + 1);
  for (const name of matches) {
    if (!extracted.has(name)) extracted.set(name, new Set());
    extracted.get(name).add(rel);
  }
  for (const name of annoMatches) {
    if (!extractedAnno.has(name)) extractedAnno.set(name, new Set());
    extractedAnno.get(name).add(rel);
  }
}

// --- Manifests -----------------------------------------------------------
const forkManifest = JSON.parse(readFileSync(join(VICE_DIR, "tools-manifest.json"), "utf8"));
const stockManifest = JSON.parse(readFileSync(join(VICE_DIR, "tools-manifest.stock.json"), "utf8"));
const forkNames = new Set(forkManifest.tools.map((t) => t.name));
const stockNames = new Set(stockManifest.tools.map((t) => t.name));

// --- Classification --------------------------------------------------------
// Five committed sets, each an array of [toolName, reasonString]. Every
// member carries a non-empty reason and, for sets 4/5, a route.

// 1. Served inside vice-proxy.ts itself as synthetic proxy-local tools --
// present in NEITHER manifest by design. Asserted below to still be declared
// as `name: "<tool>"` literals in vice-proxy.ts, so a rename upstream fails
// here instead of being silently reclassified as a miss, AND to be genuinely
// absent from both manifests (07-REVIEW.md WR-11: this was the ONE
// classification with no manifest-presence assertion, which is how it kept
// claiming "present in neither manifest by design" for two tools Phase 7 had
// added to the stock manifest -- while stock-dispatch.test.ts:186-190 asserts
// they MUST be there. Two committed sources of truth stating opposite facts,
// with only one of them failing on drift).
const PROXY_LOCAL_TOOLS = [
  [
    "vice_result_continue",
    "Served inside vice-proxy.ts itself (paginated/truncated tool-result continuation); present in neither manifest by design.",
  ],
];

// 1b. Served proxy-locally BUT advertised from the stock manifest (Phase 7,
// WR-07). These are the hybrid case set 1 above used to mis-file: the handler
// lives in vice-proxy.ts (so they are not forwarded to any emulator), while
// their advertised tool DEFINITION comes from tools-manifest.stock.json on the
// stock backend, because a proxy-local tool still has to be described to the
// client with backend-correct schemas. Asserted below to be declared in
// vice-proxy.ts AND present in the stock manifest -- the exact inverse of set
// 1's assertion, so neither list can absorb the other's members silently.
const PROXY_LOCAL_WITH_STOCK_MANIFEST_ENTRY = [
  [
    "vice_recycle",
    "Served inside vice-proxy.ts (forces a broker recycle of the current VICE instance); advertised from tools-manifest.stock.json on the stock backend (Phase 7, WR-07).",
  ],
  [
    "vice_diagnose",
    "Served inside vice-proxy.ts (wedge/hang diagnosis, vice-wedge-triage's own entry point); advertised from tools-manifest.stock.json on the stock backend (Phase 7, WR-07).",
  ],
];

// 2. Referenced by skills only to FORBID it. Asserted below to appear in
// vice.ts's DENY_LIST and to be absent from both manifests.
const DENY_LISTED_TOOLS = [
  [
    "vice_disk_list",
    "Referenced by skills only to forbid it -- vice_disk_list crashes the shared host VICE MCP server directly and is permanently refused via vice.ts's DENY_LIST.",
  ],
];

// 3. Not actually tool names. Asserted below to be absent from BOTH
// manifests -- if one ever becomes a real tool, this classification is wrong
// and the script must fail so it gets revisited.
const NOT_A_TOOL_NAMES = [
  [
    "vice_version",
    "A JSON field name in c64-ram-capture's own capture logs (the recorded VICE version string), not a tool name.",
  ],
  [
    "vice_epoch_get",
    "Named in observation-hazards.md only to state that no such tool exists -- referenced to be disclaimed, not to be called.",
  ],
];

// 4. Present on the fork, provably unrecoverable on stock. Asserted below to
// be present in the fork manifest AND absent from the stock manifest.
//
// D-E consolidation (Phase 8, plan 08-06): this array is DERIVED from
// capability-registry.ts's CAPABILITY_REGISTRY -- filtered to the "hardware"
// category entries whose providedBy is "fork" -- rather than a second,
// hand-typed copy of the same three-tool set. The registry's hardware set
// currently has 6 members (only 3 of which any shipped skill references; see
// the set-equality liveness assertion below), so this array now has 6
// entries, up from the 3 it used to carry literally. Each reason is
// capability-registry.ts's own user-facing refusal text: it deliberately
// carries NO planning identifier (no BACK-05, no SKILL-01) -- those routing
// annotations moved out of the reason text when the registry became the
// source of truth. capability-registry.ts is now where a reason is edited,
// never this file.
const FORK_ONLY_UNRECOVERABLE = CAPABILITY_REGISTRY.filter(
  (entry) => entry.category === "hardware" && entry.providedBy === "fork"
).map((entry) => [entry.name, entry.reason]);

// 5. Not yet built on stock, scheduled for a later phase. Asserted below to
// be ABSENT from the stock manifest -- the drift guard: when Phase 7 lands
// one of these, this script fails until the entry is deleted (D-05-05).
//
// Phase 7 landed both of the entries this list used to carry
// (`vice_cycles_stopwatch` in 07-08, `vice_run_until` also in 07-08) -- the
// drift guard below caught it exactly as designed (07-10), and both entries
// were deleted rather than left stale. Empty is the correct steady state
// until a future phase defers a tool here again.
const PENDING_LATER_PHASE = [];

// --- Assertion: PROXY_LOCAL_TOOLS still declared in vice-proxy.ts ----------
const viceProxySrc = readFileSync(join(VICE_DIR, "vice-proxy.ts"), "utf8");
for (const [name, reason] of PROXY_LOCAL_TOOLS) {
  need(Boolean(reason) && reason.length > 0, `${name}: PROXY_LOCAL_TOOLS reason must not be empty`);
  need(
    viceProxySrc.includes(`name: "${name}"`),
    `${name}: classified as PROXY_LOCAL_TOOLS but no longer declared as \`name: "${name}"\` in vice-proxy.ts -- a rename upstream must not be silently reclassified as a miss`
  );
  // WR-11: the missing half. "Present in neither manifest by design" is a
  // claim, so check it. Without this, a tool added to the stock manifest kept
  // its "neither manifest" reason string forever AND was silently excluded
  // from resolvedAdvertisedCount, because allowlistedNames short-circuits the
  // core check below.
  need(
    !forkNames.has(name),
    `${name}: classified as PROXY_LOCAL_TOOLS ("present in neither manifest by design") but present in the FORK manifest -- reclassify rather than leaving two sources of truth disagreeing`
  );
  need(
    !stockNames.has(name),
    `${name}: classified as PROXY_LOCAL_TOOLS ("present in neither manifest by design") but present in the STOCK manifest -- move it to PROXY_LOCAL_WITH_STOCK_MANIFEST_ENTRY`
  );
}

// --- Assertion: PROXY_LOCAL_WITH_STOCK_MANIFEST_ENTRY declared in
// vice-proxy.ts AND present in the stock manifest (WR-11) -------------------
for (const [name, reason] of PROXY_LOCAL_WITH_STOCK_MANIFEST_ENTRY) {
  need(Boolean(reason) && reason.length > 0, `${name}: PROXY_LOCAL_WITH_STOCK_MANIFEST_ENTRY reason must not be empty`);
  need(
    viceProxySrc.includes(`name: "${name}"`),
    `${name}: classified as PROXY_LOCAL_WITH_STOCK_MANIFEST_ENTRY but no longer declared as \`name: "${name}"\` in vice-proxy.ts`
  );
  need(
    stockNames.has(name),
    `${name}: classified as advertised-from-the-stock-manifest but ABSENT from tools-manifest.stock.json -- either it moved back to PROXY_LOCAL_TOOLS or the manifest entry was dropped (stock-dispatch.test.ts asserts it must be present)`
  );
}

// --- Assertion: DENY_LISTED_TOOLS still in vice.ts's DENY_LIST, absent from
// both manifests ------------------------------------------------------------
const viceTsSrc = readFileSync(join(VICE_DIR, "vice.ts"), "utf8");
const denyListMatch = viceTsSrc.match(/DENY_LIST:\s*readonly string\[\]\s*=\s*\[([\s\S]*?)\];/);
const denyListBody = denyListMatch ? denyListMatch[1] : "";
for (const [name, reason] of DENY_LISTED_TOOLS) {
  need(Boolean(reason) && reason.length > 0, `${name}: DENY_LISTED_TOOLS reason must not be empty`);
  need(
    denyListBody.includes(`"${name}"`),
    `${name}: classified as DENY_LISTED_TOOLS but not found in vice.ts's DENY_LIST array`
  );
  need(!forkNames.has(name), `${name}: classified as DENY_LISTED_TOOLS but present in the FORK manifest`);
  need(!stockNames.has(name), `${name}: classified as DENY_LISTED_TOOLS but present in the STOCK manifest`);
}

// --- Assertion: NOT_A_TOOL_NAMES absent from both manifests ----------------
for (const [name, reason] of NOT_A_TOOL_NAMES) {
  need(Boolean(reason) && reason.length > 0, `${name}: NOT_A_TOOL_NAMES reason must not be empty`);
  need(!forkNames.has(name), `${name}: classified as NOT_A_TOOL_NAMES but present in the FORK manifest -- this classification is now wrong and must be revisited`);
  need(!stockNames.has(name), `${name}: classified as NOT_A_TOOL_NAMES but present in the STOCK manifest -- this classification is now wrong and must be revisited`);
}

// --- Assertion: FORK_ONLY_UNRECOVERABLE present in fork, absent from stock -
// D-E consolidation: the old reason assertion required both "BACK-05" and
// "SKILL-01" to appear in the reason text -- a check that can never hold
// against capability-registry.ts's reasons, which are user-facing refusal
// prose and deliberately carry no planning identifier. Replaced with two
// checks that hold against the registry itself: the reason is non-empty and
// long enough to be a real explanation, and (below, WR-06) a cardinality
// assertion that the projection captured the registry's whole hardware/fork
// set -- not the two per-member category/providedBy echoes this comment
// used to claim as "three checks", which re-asserted the exact predicates
// FORK_ONLY_UNRECOVERABLE was filtered on and so could never fail
// (08-REVIEW.md WR-06).
for (const [name, reason] of FORK_ONLY_UNRECOVERABLE) {
  need(
    Boolean(reason) && reason.length >= 40,
    `${name}: FORK_ONLY_UNRECOVERABLE reason must be non-empty and at least 40 characters`
  );
  need(forkNames.has(name), `${name}: classified as FORK_ONLY_UNRECOVERABLE but absent from the FORK manifest`);
  need(!stockNames.has(name), `${name}: classified as FORK_ONLY_UNRECOVERABLE but present in the STOCK manifest -- it is no longer unrecoverable and this entry must be deleted`);
}
// Non-vacuous (WR-06): pins that the projection actually selected the
// registry's whole hardware/fork set, so a category retag in
// capability-registry.ts is visible here rather than silently shrinking
// (or growing) this classification without this script noticing. The
// floor is the actual measured count as of this fix, not an unchecked
// import of a prior review's literal -- re-verify against
// capability-registry.ts before raising or lowering it.
const registryHardwareForkCount = CAPABILITY_REGISTRY.filter(
  (e) => e.category === "hardware" && e.providedBy === "fork"
).length;
need(
  FORK_ONLY_UNRECOVERABLE.length === registryHardwareForkCount && registryHardwareForkCount >= 6,
  `FORK_ONLY_UNRECOVERABLE must project every hardware/fork registry entry (got ${FORK_ONLY_UNRECOVERABLE.length} of ${registryHardwareForkCount}, expected >= 6)`
);

// --- Assertion: PENDING_LATER_PHASE absent from stock (the drift guard) ---
for (const [name, reason] of PENDING_LATER_PHASE) {
  need(Boolean(reason) && reason.length > 0, `${name}: PENDING_LATER_PHASE reason must not be empty`);
  need(
    !stockNames.has(name),
    `${name}: classified as PENDING_LATER_PHASE but now present in the STOCK manifest -- the phase that built it has landed; delete this allowlist entry (this is the drift guard working as intended)`
  );
}

// --- Assertion: the allowlist is LIVE -- every PENDING_LATER_PHASE entry
// must actually be referenced by a skill file. A stale entry for a reference
// that no longer exists is dead weight.
for (const [name] of PENDING_LATER_PHASE) {
  need(
    extracted.has(name),
    `${name}: allowlisted (PENDING_LATER_PHASE) but not referenced by any skill file -- stale entry, delete it`
  );
}

// --- The core check ---------------------------------------------------------
// WR-11: PROXY_LOCAL_WITH_STOCK_MANIFEST_ENTRY is deliberately NOT allowlisted.
// Its members ARE in the stock manifest, so they must resolve through the
// normal `stockNames.has(name)` path and count toward
// resolvedAdvertisedCount. Allowlisting them (which is what the old
// PROXY_LOCAL_TOOLS classification did) short-circuited the core check and
// silently excluded them from the count -- shrinking the coverage number the
// script exists to report while claiming they were "present in neither
// manifest by design".
//
// WR-07: the D-E consolidation grew FORK_ONLY_UNRECOVERABLE from 3
// hand-typed names to all 6 of the registry's hardware/fork entries, and
// allowlisting it whole (as this used to do) silently made
// vice_keyboard_chord/vice_keyboard_key_press/vice_keyboard_key_release
// core-check-exempt as a refactor side effect, not a decision anyone made
// -- no shipped skill references those three. Only the hardware/fork
// entries a skill ACTUALLY mentions are allowlisted here, so the other
// three stay under the core check below: a bare, unannotated mention of
// one of them now fails exactly like an unclassified name would, instead
// of being silently exempted. This also replaces the hand-typed set of
// expected skill-referenced hardware tool names that used to live here (a
// THIRD copy of the same three-tool fact, after capability-registry.ts and
// ROADMAP.md's criterion-5 parenthetical) -- the exemption is now derived
// from actual skill references, never re-typed.
const allowlistedNames = new Set(
  [
    ...PROXY_LOCAL_TOOLS,
    ...DENY_LISTED_TOOLS,
    ...NOT_A_TOOL_NAMES,
    ...FORK_ONLY_UNRECOVERABLE.filter(([n]) => extracted.has(n)),
    ...PENDING_LATER_PHASE,
  ].map(([n]) => n)
);
let resolvedAdvertisedCount = 0;
for (const [name, files] of extracted) {
  if (allowlistedNames.has(name)) continue;
  if (stockNames.has(name)) {
    resolvedAdvertisedCount += 1;
    continue;
  }
  need(
    false,
    `${name}: referenced by ${[...files].join(", ")} but NOT advertised in tools-manifest.stock.json and NOT classified in any allowlist. ` +
      `Resolve by: (1) implementing it on stock, (2) adding it to a classified set with a reason and a route, (3) removing the skill reference, or (4) recording it as a scope decision.`
  );
}

// --- Non-vacuity controls ---------------------------------------------------
// A coverage script that finds nothing passes everything -- these are
// need()s, not comments.
need(
  extracted.size >= 30,
  `non-vacuity: expected at least 30 distinct vice_* names extracted from src/skills/, got ${extracted.size} -- the extraction regex or the skills walk may be broken`
);
need(
  topLevelDirs.length >= 6 && topLevelDirs.every((d) => dirsWithAFileRead.has(d)),
  `non-vacuity: expected at least 6 skill directories scanned with at least one file read in each, got ${topLevelDirs.length} directories (${[...dirsWithAFileRead].length} with a file read)`
);
need(
  stockNames.has("vice_memory_search"),
  "non-vacuity: positive control vice_memory_search must resolve as advertised on tools-manifest.stock.json -- if this fails, the manifest read is broken"
);
need(
  stockNames.has("vice_vicii_get_state"),
  "non-vacuity: positive control vice_vicii_get_state must resolve as advertised on tools-manifest.stock.json -- if this fails, the manifest read is broken"
);

// --- anno_* surface (plan 11-05, D-16/D-18; re-pointed by plan 29-09) -------
// Three assertions, the same shape as the vice_* checks above but against a
// completely different gate (CURATED_ANNO_TOOLS, a proxy-local allow-list --
// never either manifest).
//
// 1. Every extracted anno_* name must be curated -- the same
//    unadvertised-name failure shape as the vice_* core check above, with the
//    same three resolution routes.
for (const [name, files] of extractedAnno) {
  need(
    CURATED_ANNO_TOOLS.includes(name),
    `${name}: referenced by ${[...files].join(", ")} but NOT in CURATED_ANNO_TOOLS (anno-tools.ts). ` +
      `Resolve by: (1) implementing it and adding it to ANNO_TOOL_DEFINITIONS with a named criterion, (2) removing the skill reference, or (3) recording it as a scope decision.`
  );
}
// 2. Every extracted anno_* name must be absent from BOTH manifests -- the
//    second committed statement of this plan's manifest decision (D-16's
//    family is served proxy-locally, in neither manifest, by design), in a
//    different file from stock-dispatch.test.ts's own structural assertion
//    of the same fact (the WR-11 lesson: a "present in neither manifest by
//    design" claim must be checked, not merely asserted once).
for (const [name, files] of extractedAnno) {
  need(
    !forkNames.has(name),
    `${name}: referenced by ${[...files].join(", ")} but present in the FORK manifest -- the anno_* family is served proxy-locally, in neither manifest, by design`
  );
  need(
    !stockNames.has(name),
    `${name}: referenced by ${[...files].join(", ")} but present in the STOCK manifest -- the anno_* family is served proxy-locally, in neither manifest, by design`
  );
}
// 3. Non-vacuity control -- AND NOTE WHAT CHANGED STRUCTURALLY UNDERNEATH IT
//    (plan 29-09, 2026-08-29). The retired family had a curated allow-list
//    AND was checkable against two shipped manifests it was absent from. The
//    surviving `anno_*` family HAS NO MANIFEST AT ALL: it is served
//    proxy-locally, it is in neither tools-manifest.json nor
//    tools-manifest.stock.json, and nothing generates one for it. So check 2
//    above -- "absent from BOTH manifests" -- is the ONLY structural check
//    these names get, and it can only ever pass. That makes this control
//    LOAD-BEARING rather than decorative: it is the one assertion here that
//    fails when a real name leaves the surface, and its SUBJECT has to be
//    chosen for that job rather than picked as a convenient example.
//
//    THE SUBJECT IS THE SEARCH VERB (C-5). It was `anno_get_address_details`,
//    a verb of a family this phase retires, so the control had to be
//    re-pointed regardless. `anno_search` is chosen because a disappearance
//    fires TWO independent checks rather than neither: it is `STORE-06`'s own
//    named requirement, and it is the headline entry of
//    `src/mcp/vice/anno-register.ts`, whose guard asserts the register and the
//    live surface agree in both directions. A control whose subject can vanish
//    unnoticed is not a control.
need(
  CURATED_ANNO_TOOLS.includes("anno_search"),
  "non-vacuity: anno_search must be curated -- it is STORE-06's named requirement and anno-register.ts's headline entry, and this is the only assertion in this section that fails when a real name leaves the surface (the anno_* family has no manifest to check against)"
);
// 4. Non-vacuity FLOOR (plan 11-12), RAISED FROM 10 TO 18 by plan 29-09 on
//    2026-08-29, and it is a RAISE, not a replacement -- which is the whole
//    point of saying so here rather than just editing the number.
//
//    The floor it replaces was 10: the exact count plan 11-12 introduced, over
//    the retired `anno_*` family, across the three files that plan edited.
//    Plan 29-09 re-pointed every one of those references onto the surviving
//    `anno_*` surface and, in doing so, MEASURED what the skill tree actually
//    carries afterwards: 18 distinct names, spread over
//    c64-program-recon's SKILL.md and memory-map.template.md,
//    c64-memory-mapping's SKILL.md, routine-queue-walker's SKILL.md and
//    packer-finding.mjs. 18 is that measurement and not a target -- the
//    re-pointing was done first and counted second.
//
//    Two things make this a raise rather than the lowering the sibling
//    CLI-verb floor had to record as a REPLACEMENT (see ANNO_CLI_VERB_FLOOR's
//    own paragraph in scripts/lib/anno-cli-verbs.mjs, where a verb set really
//    did shrink underneath its floor). First, the number went UP: 10 -> 18.
//    Second, the population did not shrink -- every one of the 17 distinct
//    old-family names the skill tree carried resolves to a verb that exists,
//    so nothing was dropped to reach this figure; the surplus is prose that
//    now names verbs the old surface had no equivalent for.
//
//    THE RAISE-NEVER-LOWER DISCIPLINE RUNS FORWARD FROM 18, unchanged in
//    force. A future phase that documents another verb raises this to the new
//    true count in the commit that adds the reference. Nothing lowers it to
//    make a regression pass; a genuine narrowing of the surface is a decision
//    of the same weight as the one recorded above, written down the same way.
need(
  extractedAnno.size >= 18,
  `non-vacuity: expected at least 18 distinct anno_* names extracted from src/skills/, got ${extractedAnno.size} -- the extraction regex or the skill playbooks' tool references may have regressed`
);
// 5. The generated-artifact rule (render-memmap) is the one piece of D-24
//    guidance a future session most needs to find -- assert at least one
//    skill file states it, rather than hoping the prose survives edits.
need(
  skillFiles.some((f) => readFileSync(f, "utf8").includes("render-memmap")),
  "non-vacuity: expected at least one skill file to mention render-memmap (the memory map is a GENERATED VIEW, D-24) -- if this fails, the generated-artifact pointer has been lost from skill prose"
);

// --- anno CLI verb coverage (FLOW-01, plan 11.1-02) -------------------------
// A fifth, independent section: the checks above are about MCP TOOL names;
// this one is about `anno <verb>` CLI invocations, a completely separate
// surface with its own source of truth (anno-cli.ts's dispatch switch, not
// either manifest and not CURATED_ANNO_TOOLS). The subcommand token itself
// was renamed `anno` -> `anno` by plan 29-09, in ONE commit spanning the
// skill prose, `scripts/lib/anno-cli-verbs.mjs`'s invocation literal and
// `vice-proxy.ts`'s dispatch token -- moving any one alone reds this section
// from the wrong side.
const annoCliSrc = readFileSync(join(VICE_DIR, "anno-cli.ts"), "utf8");
const annoCliVerbs = parseAnnoCliVerbs(annoCliSrc);

need(
  annoCliVerbs.length >= ANNO_CLI_VERB_FLOOR,
  `non-vacuity: expected at least ${ANNO_CLI_VERB_FLOOR} anno CLI verbs parsed from anno-cli.ts's dispatch switch, got ${annoCliVerbs.length} -- the parser or the switch statement itself may be broken`
);

// The requirement each verb was built to deliver, where the audit named
// one (FLOW-01's own table) -- surfaced in the failure message so a future
// maintainer sees what closing the finding actually unblocks, not merely
// which file to edit.
//
// ALL THREE KEYS NAME VERBS THE CLI NO LONGER HAS, as of 2026-08-29 (plan
// 29-07, D-14), and the map is kept rather than emptied ON PURPOSE. An earlier
// version of this paragraph forecast that all three would come back as a
// rebuild over the annotation store in a numbered phase. That forecast was
// WRONG and is corrected here rather than deleted: the phase it named rebuilt
// `export-asm` only -- which is why `export-asm` is NOT a key here -- and
// no phase currently owns the return of these three. The day any one of them
// lands undocumented is still exactly the day this message needs to name its
// requirement. An empty map would have to be rebuilt from the audit table by
// whoever notices; a map with three inert keys costs nothing and is right again
// the moment a verb is back. Nothing reads it unless a verb is BOTH parsed from
// the dispatch switch AND missing from every skill file, so an inert key can
// never fire on its own.
const VERB_REQUIREMENT = {
  "gen-enums": "ANNO-13",
  "export-lbl": "ANNO-14",
  "import-lbl": "ANNO-15",
};

const skillTexts = skillFiles.map((f) => readFileSync(f, "utf8"));
const missingCliVerbs = verbsMissingFromSkills(annoCliVerbs, skillTexts);
for (const verb of missingCliVerbs) {
  const req = VERB_REQUIREMENT[verb] ? ` (${VERB_REQUIREMENT[verb]}'s delivery path)` : "";
  need(
    false,
    `anno ${verb}: parsed from anno-cli.ts's dispatch switch but named by NO skill file${req}. ` +
      `Resolve by: (1) documenting it in a playbook, (2) removing the verb, or (3) recording it as a scope decision.`
  );
}

// --- Report ------------------------------------------------------------
if (errors.length) {
  console.error("check-skill-tool-coverage: FAIL");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

const categoryCount = (set) => [...set].filter(([name]) => extracted.has(name)).length;
// FORK_ONLY_UNRECOVERABLE is reported by its full length, not categoryCount()'s
// extracted-filtered count: since the D-E consolidation this array is the
// registry's complete hardware/fork set (6), not only the subset a skill
// happens to reference (3) -- the report now answers "how many entries does
// this classification hold", matching what the other 5 non-liveness-checked
// registry entries would report too, rather than conflating classification
// size with skill-reference liveness (that is what the set-equality
// assertion above already checks, precisely).
console.log(
  `check-skill-tool-coverage: OK -- ${extracted.size} distinct vice_* names extracted from ${skillFiles.length} files across ${topLevelDirs.length} skill directories; ` +
    `${resolvedAdvertisedCount} resolved as advertised on the stock manifest (${stockNames.size} tools total). ` +
    `Classified: ${categoryCount(PROXY_LOCAL_TOOLS)} proxy-local (neither manifest), ` +
    `${categoryCount(PROXY_LOCAL_WITH_STOCK_MANIFEST_ENTRY)} proxy-local-with-stock-manifest-entry, ${categoryCount(DENY_LISTED_TOOLS)} deny-listed, ` +
    `${categoryCount(NOT_A_TOOL_NAMES)} not-a-tool-name, ${FORK_ONLY_UNRECOVERABLE.length} fork-only-unrecoverable, ` +
    `${categoryCount(PENDING_LATER_PHASE)} pending-later-phase. ` +
    // Floor asserted above (plan 11-12, need() #4, raised by 29-09): a count
    // of 0 here is now a FAILURE, not a silent pass -- see that assertion's
    // comment for the floor's provenance.
    `anno_*: ${extractedAnno.size} distinct names extracted, all curated (CURATED_ANNO_TOOLS has ${CURATED_ANNO_TOOLS.length} entries). ` +
    `anno CLI verbs: ${annoCliVerbs.length} parsed from anno-cli.ts, ${annoCliVerbs.length - missingCliVerbs.length}/${annoCliVerbs.length} resolved (named by at least one skill file).`
);
