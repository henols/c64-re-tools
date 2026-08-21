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
// imports exactly one first-party TypeScript module from .claude/mcp/vice/
// (capability-registry.ts, Node's native type-stripping resolves it with no
// build step and no flag). That one new import does not weaken this script's
// standing rule: it still never import()s, require()s, eval()s or spawns anything from .claude/skills/ --
// skill content remains untrusted input that is matched, never executed.
//
// FLOW-01 (11.1-CONTEXT.md, D-11.1-02): everything above checks `r2000_*`
// MCP TOOL names in skill prose, but nothing checked `r2000` CLI VERBS at
// all -- so `gen-enums`, `export-lbl` and `import-lbl` (R2000-13/-14/-15's
// own delivery path) reached `main` documented in zero skill files, with
// nothing here catching it. The verb-coverage section near the bottom of
// this file closes that gap the same way the rest of this file already
// works: the verb list is PARSED from `r2000-cli.ts`'s own dispatch switch
// (`scripts/lib/r2000-cli-verbs.mjs`), never a hand-typed array -- a
// hard-coded list is exactly how this class of finding arrives.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { CAPABILITY_REGISTRY } from "../.claude/mcp/vice/capability-registry.ts";
import { CURATED_R2000_TOOLS } from "../.claude/mcp/vice/r2000-tools.ts";
import { parseR2000CliVerbs, verbsMissingFromSkills, R2000_CLI_VERB_FLOOR } from "./lib/r2000-cli-verbs.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const VICE_DIR = join(ROOT, ".claude/mcp/vice");
const SKILLS_DIR = join(ROOT, ".claude/skills");

const errors = [];
const need = (cond, msg) => {
  if (!cond) errors.push(msg);
};

// --- Walk .claude/skills/ for *.md and *.mjs files (including *.test.mjs) --
// Never follows a symlink out of the tree; skips any node_modules segment
// defensively even though the directory is small, committed, and gitignore
// keeps node_modules out of it repo-wide.
function walkSkills(dir, acc, dirsSeen) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules") continue;
    const p = join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      walkSkills(p, acc, dirsSeen);
    } else if (/\.(md|mjs)$/.test(entry.name)) {
      acc.push(p);
    }
  }
  return acc;
}

const skillFiles = walkSkills(SKILLS_DIR, [], null);

// Top-level skill directories actually scanned (>=1 file read in each) --
// non-vacuity control 2.
const topLevelDirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);
const dirsWithAFileRead = new Set();
for (const f of skillFiles) {
  const rel = f.slice(SKILLS_DIR.length + 1);
  const top = rel.split("/")[0];
  dirsWithAFileRead.add(top);
}

// --- Extraction --------------------------------------------------------
// Strip any "mcp__<plugin>_vice__" prefix BEFORE matching, so a call site
// written as mcp__plugin_c64-re-tools_vice__vice_keyboard_restore yields the
// bare tool name vice_keyboard_restore rather than nothing at all (the
// underscore-joined prefix would otherwise defeat a plain \b word boundary --
// "_vice__vice_x" has no non-word character anywhere near the join point).
const MCP_PREFIX_RE = /mcp__[\w-]+_vice__/g;
const TOOL_NAME_RE = /\bvice_[a-z0-9_]+/g;
// Plan 11-05, Phase 11: a second, independent extraction pass for the
// curated r2000_* surface (D-16/D-18). Kept in its OWN map rather than
// merged into `extracted` above -- the two families are served through
// completely different gates (stock/fork manifests vs. CURATED_R2000_TOOLS,
// a proxy-local allow-list), so conflating them would blur which gate a
// given name is actually checked against.
const R2000_TOOL_NAME_RE = /\br2000_[a-z0-9_]+/g;

/** @type {Map<string, Set<string>>} */
const extracted = new Map();
/** @type {Map<string, Set<string>>} */
const extractedR2000 = new Map();
for (const f of skillFiles) {
  const raw = readFileSync(f, "utf8");
  const cleaned = raw.replace(MCP_PREFIX_RE, "");
  const matches = cleaned.match(TOOL_NAME_RE) || [];
  const r2000Matches = cleaned.match(R2000_TOOL_NAME_RE) || [];
  const rel = f.slice(ROOT.length + 1);
  for (const name of matches) {
    if (!extracted.has(name)) extracted.set(name, new Set());
    extracted.get(name).add(rel);
  }
  for (const name of r2000Matches) {
    if (!extractedR2000.has(name)) extractedR2000.set(name, new Set());
    extractedR2000.get(name).add(rel);
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
// prose and deliberately carry no planning identifier. Replaced with three
// checks that hold against the registry itself: the reason is non-empty and
// long enough to be a real explanation, and the source entry's own
// category/providedBy are exactly what this classification claims.
for (const [name, reason] of FORK_ONLY_UNRECOVERABLE) {
  need(
    Boolean(reason) && reason.length >= 40,
    `${name}: FORK_ONLY_UNRECOVERABLE reason must be non-empty and at least 40 characters`
  );
  const registryEntry = CAPABILITY_REGISTRY.find((e) => e.name === name);
  need(
    Boolean(registryEntry) && registryEntry.category === "hardware",
    `${name}: FORK_ONLY_UNRECOVERABLE but its capability-registry.ts entry's category is not "hardware"`
  );
  need(
    Boolean(registryEntry) && registryEntry.providedBy === "fork",
    `${name}: FORK_ONLY_UNRECOVERABLE but its capability-registry.ts entry's providedBy is not "fork"`
  );
  need(forkNames.has(name), `${name}: classified as FORK_ONLY_UNRECOVERABLE but absent from the FORK manifest`);
  need(!stockNames.has(name), `${name}: classified as FORK_ONLY_UNRECOVERABLE but present in the STOCK manifest -- it is no longer unrecoverable and this entry must be deleted`);
}

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

// --- Assertion: FORK_ONLY_UNRECOVERABLE's skill-referenced subset is EXACTLY
// the three names ROADMAP.md's Phase 5 criterion 5 names (D-05-08) --------
// D-E consolidation: FORK_ONLY_UNRECOVERABLE now derives all 6 of the
// registry's hardware/fork entries, but only 3 (vice_sid_get_state,
// vice_keyboard_matrix, vice_keyboard_restore) are actually referenced by any
// shipped skill file (vice_keyboard_chord, vice_keyboard_key_press and
// vice_keyboard_key_release appear in no skill). Plain per-entry liveness
// (every allowlisted name must be referenced) is too weak here -- it would
// pass vacuously for 3 unreferenced entries. A set-equality assertion is
// strictly stronger: it pins the corrected three-tool exception list
// mechanically, and fails in BOTH directions -- a new bare skill reference to
// one of the other three hardware tools, or one of the three current three
// ceasing to be referenced.
const EXPECTED_SKILL_REFERENCED_HARDWARE_TOOLS = new Set([
  "vice_sid_get_state",
  "vice_keyboard_matrix",
  "vice_keyboard_restore",
]);
const actualSkillReferencedHardwareTools = new Set(
  FORK_ONLY_UNRECOVERABLE.filter(([name]) => extracted.has(name)).map(([name]) => name)
);
const missingFromSkillReferences = [...EXPECTED_SKILL_REFERENCED_HARDWARE_TOOLS].filter(
  (name) => !actualSkillReferencedHardwareTools.has(name)
);
const unexpectedSkillReferences = [...actualSkillReferencedHardwareTools].filter(
  (name) => !EXPECTED_SKILL_REFERENCED_HARDWARE_TOOLS.has(name)
);
need(
  missingFromSkillReferences.length === 0,
  `FORK_ONLY_UNRECOVERABLE set-equality: expected skill-referenced hardware tool(s) no longer referenced by any skill file -- stale expectation, update EXPECTED_SKILL_REFERENCED_HARDWARE_TOOLS: ${missingFromSkillReferences.join(", ")}`
);
need(
  unexpectedSkillReferences.length === 0,
  `FORK_ONLY_UNRECOVERABLE set-equality: a hardware tool not in EXPECTED_SKILL_REFERENCED_HARDWARE_TOOLS is now referenced by a skill file -- add it to the expected set (and to ROADMAP.md's Phase 5 criterion 5 exception list) or remove the skill reference: ${unexpectedSkillReferences.join(", ")}`
);

// --- The core check ---------------------------------------------------------
// WR-11: PROXY_LOCAL_WITH_STOCK_MANIFEST_ENTRY is deliberately NOT allowlisted.
// Its members ARE in the stock manifest, so they must resolve through the
// normal `stockNames.has(name)` path and count toward
// resolvedAdvertisedCount. Allowlisting them (which is what the old
// PROXY_LOCAL_TOOLS classification did) short-circuited the core check and
// silently excluded them from the count -- shrinking the coverage number the
// script exists to report while claiming they were "present in neither
// manifest by design".
const allowlistedNames = new Set(
  [...PROXY_LOCAL_TOOLS, ...DENY_LISTED_TOOLS, ...NOT_A_TOOL_NAMES, ...FORK_ONLY_UNRECOVERABLE, ...PENDING_LATER_PHASE].map(
    ([n]) => n
  )
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
  `non-vacuity: expected at least 30 distinct vice_* names extracted from .claude/skills/, got ${extracted.size} -- the extraction regex or the skills walk may be broken`
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

// --- r2000_* surface (plan 11-05, D-16/D-18) --------------------------------
// Three assertions, the same shape as the vice_* checks above but against a
// completely different gate (CURATED_R2000_TOOLS, a proxy-local allow-list --
// never either manifest).
//
// 1. Every extracted r2000_* name must be curated -- the same
//    unadvertised-name failure shape as the vice_* core check above, with the
//    same three resolution routes.
for (const [name, files] of extractedR2000) {
  need(
    CURATED_R2000_TOOLS.includes(name),
    `${name}: referenced by ${[...files].join(", ")} but NOT in CURATED_R2000_TOOLS (r2000-tools.ts). ` +
      `Resolve by: (1) implementing it and adding it to R2000_TOOL_DEFINITIONS with a named criterion, (2) removing the skill reference, or (3) recording it as a scope decision.`
  );
}
// 2. Every extracted r2000_* name must be absent from BOTH manifests -- the
//    second committed statement of this plan's manifest decision (D-16's
//    family is served proxy-locally, in neither manifest, by design), in a
//    different file from stock-dispatch.test.ts's own structural assertion
//    of the same fact (the WR-11 lesson: a "present in neither manifest by
//    design" claim must be checked, not merely asserted once).
for (const [name, files] of extractedR2000) {
  need(
    !forkNames.has(name),
    `${name}: referenced by ${[...files].join(", ")} but present in the FORK manifest -- the r2000_* family is served proxy-locally, in neither manifest, by design`
  );
  need(
    !stockNames.has(name),
    `${name}: referenced by ${[...files].join(", ")} but present in the STOCK manifest -- the r2000_* family is served proxy-locally, in neither manifest, by design`
  );
}
// 3. Non-vacuity control (D-32): r2000_get_address_details must NEVER be
//    curated. If it is ever re-added upstream-fix-first (issue #42 lands),
//    this assertion is exactly what forces a deliberate edit here rather
//    than a silent pass.
need(
  !CURATED_R2000_TOOLS.includes("r2000_get_address_details"),
  "non-vacuity: r2000_get_address_details must be absent from CURATED_R2000_TOOLS (D-32, the 64K OutOfRange defect) -- if this fails, D-32's exclusion has been silently reversed"
);
// 4. Non-vacuity FLOOR (plan 11-12): now that skill prose actually names
//    r2000_* tools, the extraction finding none is itself a failure, exactly
//    the way `extracted.size >= 30` guards the vice_* extraction above. The
//    number 10 is not a guess -- it is the exact count plan 11-12 introduced,
//    verified by `grep -oE '\br2000_[a-z0-9_]+' .claude/skills/**` across the
//    three files that plan edited (c64-program-recon's SKILL.md and
//    memory-map.template.md): r2000_add_scope, r2000_batch_execute,
//    r2000_get_blocks, r2000_get_comments, r2000_get_cross_references,
//    r2000_get_symbols, r2000_search_disassembly, r2000_set_comment,
//    r2000_set_data_type, r2000_set_label_name. A future phase that adds a
//    reference should raise this floor to the new true count -- never lower
//    it to make a regression pass.
need(
  extractedR2000.size >= 10,
  `non-vacuity: expected at least 10 distinct r2000_* names extracted from .claude/skills/, got ${extractedR2000.size} -- the extraction regex or plan 11-12's skill edits may have regressed`
);
// 5. The generated-artifact rule (render-memmap) is the one piece of D-24
//    guidance a future session most needs to find -- assert at least one
//    skill file states it, rather than hoping the prose survives edits.
need(
  skillFiles.some((f) => readFileSync(f, "utf8").includes("render-memmap")),
  "non-vacuity: expected at least one skill file to mention render-memmap (the memory map is a GENERATED VIEW, D-24) -- if this fails, the generated-artifact pointer has been lost from skill prose"
);

// --- r2000 CLI verb coverage (FLOW-01, plan 11.1-02) ------------------------
// A fourth, independent section: the two r2000_* checks above are about MCP
// TOOL names; this one is about `r2000 <verb>` CLI invocations, a
// completely separate surface with its own source of truth
// (r2000-cli.ts's dispatch switch, not either manifest and not
// CURATED_R2000_TOOLS).
const r2000CliSrc = readFileSync(join(VICE_DIR, "r2000-cli.ts"), "utf8");
const r2000CliVerbs = parseR2000CliVerbs(r2000CliSrc);

need(
  r2000CliVerbs.length >= R2000_CLI_VERB_FLOOR,
  `non-vacuity: expected at least ${R2000_CLI_VERB_FLOOR} r2000 CLI verbs parsed from r2000-cli.ts's dispatch switch, got ${r2000CliVerbs.length} -- the parser or the switch statement itself may be broken`
);

// The requirement each verb was built to deliver, where the audit named
// one (FLOW-01's own table) -- surfaced in the failure message so a future
// maintainer sees what closing the finding actually unblocks, not merely
// which file to edit.
const VERB_REQUIREMENT = {
  "gen-enums": "R2000-13",
  "export-lbl": "R2000-14",
  "import-lbl": "R2000-15",
};

const skillTexts = skillFiles.map((f) => readFileSync(f, "utf8"));
const missingCliVerbs = verbsMissingFromSkills(r2000CliVerbs, skillTexts);
for (const verb of missingCliVerbs) {
  const req = VERB_REQUIREMENT[verb] ? ` (${VERB_REQUIREMENT[verb]}'s delivery path)` : "";
  need(
    false,
    `r2000 ${verb}: parsed from r2000-cli.ts's dispatch switch but named by NO skill file${req}. ` +
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
    // Floor asserted above (plan 11-12, need() #4): a count of 0 here is now
    // a FAILURE, not a silent pass -- see that assertion's comment for the
    // floor's provenance.
    `r2000_*: ${extractedR2000.size} distinct names extracted, all curated (CURATED_R2000_TOOLS has ${CURATED_R2000_TOOLS.length} entries). ` +
    `r2000 CLI verbs: ${r2000CliVerbs.length} parsed from r2000-cli.ts, ${r2000CliVerbs.length - missingCliVerbs.length}/${r2000CliVerbs.length} resolved (named by at least one skill file).`
);
