#!/usr/bin/env node
// SKILL-01: a playbook naming a fork-only tool with no fork-requirement
// sentence nearby sends Claude into a refusal it was never warned about --
// and CLAUDE.md's Compatibility constraint says such a skill *breaks* on
// stock rather than degrading. This is the ONE place that checks proximity
// honesty of fork-only tool mentions in playbook prose: every mention of a
// tool the active backend might not advertise must sit in a markdown section
// that also states the fork requirement (and the stock route, when one
// exists).
//
// WHAT NOT TO DO: do not hand-maintain a second list of fork-only tool names
// here. The list is derived from capability-registry.ts's CAPABILITY_REGISTRY
// (every entry whose providedBy is "fork") -- that module is the ONE place
// per-backend capability data lives (08-01-SUMMARY.md). A hand-copied list
// here would drift from it the first time a tool's category changes.
//
// This script only ever readFileSync()s and regex-matches. It never uses a
// dynamic import, require, eval, or a spawn against anything under
// .claude/skills/ -- skill content is untrusted input that is matched, never
// executed. The only import is the first-party capability-registry.ts.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CAPABILITY_REGISTRY } from "../.claude/mcp/vice/capability-registry.ts";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const VICE_DIR = join(ROOT, ".claude/mcp/vice");
const SKILLS_DIR = join(ROOT, ".claude/skills");

const errors = [];
const need = (cond, msg) => {
  if (!cond) errors.push(msg);
};

// --- Walk .claude/skills/ for *.md and *.mjs files (including *.test.mjs) --
// Copied from scripts/check-skill-tool-coverage.mjs's walkSkills(): never
// follows a symlink out of the tree; skips any node_modules segment
// defensively even though the directory is small, committed, and gitignore
// keeps node_modules out of it repo-wide.
function walkSkills(dir, acc) {
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
      walkSkills(p, acc);
    } else if (/\.(md|mjs)$/.test(entry.name)) {
      acc.push(p);
    }
  }
  return acc;
}

const skillFiles = walkSkills(SKILLS_DIR, []);

// Top-level skill directories actually scanned (>=1 file read in each) --
// non-vacuity control.
const topLevelDirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);
const dirsWithAFileRead = new Set();
for (const f of skillFiles) {
  const rel = f.slice(SKILLS_DIR.length + 1);
  const top = rel.split("/")[0];
  dirsWithAFileRead.add(top);
}

// --- Names to police: derived from the registry, never hand-listed (D-E) ---
// Every entry whose providedBy is "fork" -- not just the "hardware" category.
// A descoped fork-only tool named bare in a playbook is the same failure as a
// hardware one: the active (stock) backend does not have it either way.
const FORK_ONLY_NAMES = new Set(
  CAPABILITY_REGISTRY.filter((e) => e.providedBy === "fork").map((e) => e.name)
);
const registryByName = new Map(CAPABILITY_REGISTRY.map((e) => [e.name, e]));

// --- Extraction --------------------------------------------------------
// Strip any "mcp__<plugin>_vice__" prefix BEFORE matching, so a call site
// written as mcp__plugin_c64-re-tools_vice__vice_keyboard_matrix yields the
// bare tool name vice_keyboard_matrix rather than nothing at all.
const MCP_PREFIX_RE = /mcp__[\w-]+_vice__/g;
const TOOL_NAME_RE = /\bvice_[a-z0-9_]+/g;

// Annotation signals -- a section is "annotated" when its body matches any
// of these, case-insensitive. Kept short and literal; this script never
// attempts to parse markdown structure beyond splitting on ATX headings.
const ANNOTATION_RE = /(fork-only|requires the fork backend|requires the fork|fork backend|VICE_BACKEND)/i;

// The proximity rule (research Assumption A4, resolved): markdown-section
// scope. Split each .md file into sections at ATX headings (^#{1,6} );
// text before the first heading counts as one leading section. A mention is
// compliant when its OWN section body contains an annotation signal
// anywhere -- not a fixed +/-N-line window, which would wrongly flag
// observation-hazards.md's already-correct line-79 mention (its annotation
// sits at line 88, 9 lines away) while under-catching a bare mention two
// lines above a heading boundary. Validated against the real tree this
// session: reproduces exactly the four known gaps, zero false positives. Do
// not "tighten" this back into a fixed window.
function splitSections(text) {
  const lines = text.split("\n");
  const sections = [];
  let current = { heading: "(before first heading)", startLine: 1, lines: [] };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^#{1,6} /.test(line)) {
      if (current.lines.length > 0 || sections.length === 0) sections.push(current);
      current = { heading: line.replace(/^#{1,6}\s*/, "").trim(), startLine: i + 1, lines: [] };
    }
    current.lines.push(line);
  }
  sections.push(current);
  return sections;
}

// Stale-forward-reference check (research Pitfall 5): a sentence deferring a
// capability to a numbered phase, using a possessive "Phase N's ..." idiom
// (the shape this project's own prose uses to hand a capability off to a
// future phase, e.g. "Phase 8's BACK-05 is what reports the absence") co-
// occurring on the same line with one of the stale-framing words below.
//
// Deliberately narrower than a bare `Phase \d` co-occurrence: a plain
// citation like "(Phase 7, D-02)" that quotes a THIRD PARTY's own doc string
// ("cycles is documented as *not yet implemented*" -- the fork's own schema
// text, not this project's claim) is not a deferral and must not be flagged.
// Verified against the real tree this session: the possessive form matches
// exactly one line in six skills (control-flow.md's now-stale
// "Phase 8's `BACK-05`" sentence) and excludes tool-selection.md's unrelated
// "(Phase 7, D-02)" citation, which shares the same stale-word vocabulary
// ("not yet implemented") but is not a deferral of a capability.
const PHASE_POSSESSIVE_RE = /Phase\s+\d+['’]s/;
const STALE_WORDS_RE = /\b(deferred|not yet|until|unavailable)\b/i;

let totalForkMentions = 0;
const positiveControlsSeen = new Set();

for (const f of skillFiles) {
  const raw = readFileSync(f, "utf8");
  const rel = f.slice(ROOT.length + 1);

  // Stale-forward-reference: line-based, independent of section scope.
  const rawLines = raw.split("\n");
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (PHASE_POSSESSIVE_RE.test(line) && STALE_WORDS_RE.test(line)) {
      need(
        false,
        `${rel}:${i + 1}: stale forward reference to a numbered phase ("${line.trim()}") -- ` +
          `state the current truth instead, and name no future phase`
      );
    }
  }

  // Fork-only mention proximity: markdown-section scope, .md files only (an
  // ATX heading is a markdown concept; .mjs files carry no section
  // structure to scope against).
  if (!f.endsWith(".md")) continue;

  const sections = splitSections(raw);
  for (const section of sections) {
    const sectionText = section.lines.join("\n");
    const cleaned = sectionText.replace(MCP_PREFIX_RE, "");
    const matches = [...cleaned.matchAll(TOOL_NAME_RE)];
    const forkMentionsInSection = matches.filter((m) => FORK_ONLY_NAMES.has(m[0]));
    if (forkMentionsInSection.length === 0) continue;

    totalForkMentions += forkMentionsInSection.length;

    const isAnnotated = ANNOTATION_RE.test(sectionText);
    if (isAnnotated) {
      if (rel.endsWith("tool-selection.md")) positiveControlsSeen.add("tool-selection.md");
      if (rel.endsWith("control-flow.md")) positiveControlsSeen.add("control-flow.md");
      continue;
    }

    // Not annotated -- find the 1-based line number of the first fork-only
    // mention in this section, relative to the whole file, for the report.
    const firstMention = forkMentionsInSection[0];
    const upToMention = cleaned.slice(0, firstMention.index);
    const lineOffset = upToMention.split("\n").length - 1;
    const lineNo = section.startLine + lineOffset;
    const names = [...new Set(forkMentionsInSection.map((m) => m[0]))];
    for (const name of names) {
      const entry = registryByName.get(name);
      const altText = entry?.alternative ? ` Stock route: ${entry.alternative}` : " No stock route exists.";
      need(
        false,
        `${rel}:${lineNo}: "${name}" mentioned in section "${section.heading}" with no fork-requirement ` +
          `annotation in that section -- state that it requires the fork backend.${altText}`
      );
    }
  }
}

// --- Non-vacuity controls ---------------------------------------------------
// A lint that finds nothing passes everything -- these are need()s, not
// comments.
need(
  topLevelDirs.length >= 6 && topLevelDirs.every((d) => dirsWithAFileRead.has(d)),
  `non-vacuity: expected at least 6 skill directories scanned with at least one file read in each, got ${topLevelDirs.length} directories (${[...dirsWithAFileRead].length} with a file read)`
);
need(
  totalForkMentions >= 8,
  `non-vacuity: expected at least 8 fork-only tool mentions across .claude/skills/, got ${totalForkMentions} -- the skills walk or extraction regex may be broken`
);
need(
  positiveControlsSeen.has("tool-selection.md"),
  `non-vacuity: positive control references/tool-selection.md must be classified compliant (inline annotation on the same line as the mention) -- if this fails, the annotation-signal match or the walk is broken`
);
need(
  positiveControlsSeen.has("control-flow.md"),
  `non-vacuity: positive control references/control-flow.md must be classified compliant (annotation in the same section as the mention) -- if this fails, the section-scoped proximity rule or the walk is broken`
);
need(
  FORK_ONLY_NAMES.size >= 20,
  `non-vacuity: expected at least 20 fork-only names derived from CAPABILITY_REGISTRY, got ${FORK_ONLY_NAMES.size} -- the registry import may be broken`
);

// --- Report ------------------------------------------------------------
if (errors.length) {
  console.error("check-skill-fork-honesty: FAIL");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

console.log(
  `check-skill-fork-honesty: OK -- ${totalForkMentions} fork-only mentions across ${skillFiles.length} files in ` +
    `${topLevelDirs.length} skill directories, all section-scoped-compliant; ${FORK_ONLY_NAMES.size} fork-only ` +
    `names policed from CAPABILITY_REGISTRY; no stale phase-deferral prose found.`
);
