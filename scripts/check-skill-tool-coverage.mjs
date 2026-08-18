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
// This script only ever readFileSync()s and regex-matches. It never
// import()s, require()s, eval()s or spawns anything from .claude/skills/ --
// skill content is untrusted input that is matched, never executed.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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

/** @type {Map<string, Set<string>>} */
const extracted = new Map();
for (const f of skillFiles) {
  const raw = readFileSync(f, "utf8");
  const cleaned = raw.replace(MCP_PREFIX_RE, "");
  const matches = cleaned.match(TOOL_NAME_RE) || [];
  const rel = f.slice(ROOT.length + 1);
  for (const name of matches) {
    if (!extracted.has(name)) extracted.set(name, new Set());
    extracted.get(name).add(rel);
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
// here instead of being silently reclassified as a miss.
const PROXY_LOCAL_TOOLS = [
  [
    "vice_result_continue",
    "Served inside vice-proxy.ts itself (paginated/truncated tool-result continuation); present in neither manifest by design.",
  ],
  [
    "vice_recycle",
    "Served inside vice-proxy.ts itself (forces a broker recycle of the current VICE instance); present in neither manifest by design.",
  ],
  [
    "vice_diagnose",
    "Served inside vice-proxy.ts itself (wedge/hang diagnosis, vice-wedge-triage's own entry point); present in neither manifest by design.",
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
// be present in the fork manifest AND absent from the stock manifest. Each
// reason names the Phase 8 route: BACK-05 for the runtime error, SKILL-01
// for the playbook note.
const FORK_ONLY_UNRECOVERABLE = [
  [
    "vice_sid_get_state",
    "SID $D400-$D418 is write-only in hardware and the binary monitor has no SID command; read-back is unrecoverable on stock. Route: BACK-05 (runtime error), SKILL-01 (playbook note), both Phase 8.",
  ],
  [
    "vice_keyboard_matrix",
    "KEYBOARD_FEED (0x72) injects PETSCII buffer text only; it cannot drive the raw keyboard matrix. Route: BACK-05 (runtime error), SKILL-01 (playbook note), both Phase 8.",
  ],
  [
    "vice_keyboard_restore",
    "The RESTORE key pulses the NMI line and is not in the keyboard matrix; KEYBOARD_FEED cannot produce it. Route: BACK-05 (runtime error), SKILL-01 (playbook note), both Phase 8.",
  ],
];

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
for (const [name, reason] of FORK_ONLY_UNRECOVERABLE) {
  need(
    Boolean(reason) && reason.includes("BACK-05") && reason.includes("SKILL-01"),
    `${name}: FORK_ONLY_UNRECOVERABLE reason must name both BACK-05 and SKILL-01`
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

// --- Assertion: the allowlist is LIVE -- every FORK_ONLY_UNRECOVERABLE and
// PENDING_LATER_PHASE entry must actually be referenced by a skill file. A
// stale entry for a reference that no longer exists is dead weight.
for (const [name] of [...FORK_ONLY_UNRECOVERABLE, ...PENDING_LATER_PHASE]) {
  need(
    extracted.has(name),
    `${name}: allowlisted (FORK_ONLY_UNRECOVERABLE/PENDING_LATER_PHASE) but not referenced by any skill file -- stale entry, delete it`
  );
}

// --- The core check ---------------------------------------------------------
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

// --- Report ------------------------------------------------------------
if (errors.length) {
  console.error("check-skill-tool-coverage: FAIL");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

const categoryCount = (set) => [...set].filter(([name]) => extracted.has(name)).length;
console.log(
  `check-skill-tool-coverage: OK -- ${extracted.size} distinct vice_* names extracted from ${skillFiles.length} files across ${topLevelDirs.length} skill directories; ` +
    `${resolvedAdvertisedCount} resolved as advertised on the stock manifest (${stockNames.size} tools total). ` +
    `Classified: ${categoryCount(PROXY_LOCAL_TOOLS)} proxy-local, ${categoryCount(DENY_LISTED_TOOLS)} deny-listed, ` +
    `${categoryCount(NOT_A_TOOL_NAMES)} not-a-tool-name, ${categoryCount(FORK_ONLY_UNRECOVERABLE)} fork-only-unrecoverable, ` +
    `${categoryCount(PENDING_LATER_PHASE)} pending-later-phase.`
);
