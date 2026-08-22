#!/usr/bin/env node
// scripts/lib/skill-corpus.mjs -- the ONE place skill-corpus traversal and
// vice_* tool-name extraction happen.
//
// WR-12 (08-REVIEW.md): `scripts/check-skill-tool-coverage.mjs` and
// `scripts/check-skill-fork-honesty.mjs` are both blocking CI steps
// (.github/workflows/ci.yml) whose entire purpose is to agree about which
// skill text exists and which tool names it contains -- and until this
// module existed, each carried its own byte-for-byte copy of `walkSkills()`,
// `MCP_PREFIX_RE` and `TOOL_NAME_RE`. `check-skill-fork-honesty.mjs`'s own
// comment admitted it: "Copied from scripts/check-skill-tool-coverage.mjs's
// walkSkills()". Two copies of the same seam agree only until one of them
// changes -- a new skill file extension, a new `mcp__*` prefix shape, a
// symlinked reference directory -- and the failure mode of that divergence
// is one CI gate passing while the other should have failed. This is
// CLAUDE.md's own named "re-deriving a cross-cutting seam locally"
// anti-pattern, committed in the very phase (08) that consolidated
// capability data into `capability-registry.ts` to avoid exactly this
// shape.
//
// WHAT NOT TO DO: do not re-derive `walkSkills()` or either regex locally
// in a third script (or a fourth). Import from here. If the corpus-walk
// behaviour needs to change, change it once, here -- both CI gates pick up
// the change on their next run, and neither can silently disagree with the
// other about what "the skill corpus" means.
//
// This module only ever `readFileSync()`/`readdirSync()`s and
// regex-matches. It never `import()`s, `require()`s, `eval()`s, or spawns
// anything under `.claude/skills/` -- skill content remains untrusted
// input that is matched, never executed, matching both consuming scripts'
// own header rules.
import { readdirSync } from "node:fs";
import { join } from "node:path";

// --- Walk a skills directory for *.md and *.mjs files (including
// *.test.mjs) -- never follows a symlink out of the tree; skips any
// node_modules segment defensively even though the directory is small,
// committed, and gitignore keeps node_modules out of it repo-wide.
export function walkSkills(dir) {
  const acc = [];
  walk(dir, acc);
  return acc;
}

function walk(dir, acc) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules") continue;
    const p = join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      walk(p, acc);
    } else if (/\.(md|mjs)$/.test(entry.name)) {
      acc.push(p);
    }
  }
}

// Strip any "mcp__<plugin>_vice__" prefix BEFORE matching, so a call site
// written as mcp__plugin_c64-re-tools_vice__vice_keyboard_restore yields
// the bare tool name vice_keyboard_restore rather than nothing at all (the
// underscore-joined prefix would otherwise defeat a plain \b word
// boundary -- "_vice__vice_x" has no non-word character anywhere near the
// join point).
export const MCP_PREFIX_RE = /mcp__[\w-]+_vice__/g;
export const TOOL_NAME_RE = /\bvice_[a-z0-9_]+/g;

/**
 * Returns every vice_* tool name mentioned in `text`, MCP-prefix stripped,
 * in match order (duplicates included -- a caller that needs a
 * de-duplicated set, or the file each name came from, builds that itself;
 * this function only answers "which names are mentioned").
 */
export function extractToolNames(text) {
  const cleaned = text.replace(MCP_PREFIX_RE, "");
  return cleaned.match(TOOL_NAME_RE) || [];
}

/**
 * Returns the names of `dir`'s immediate subdirectories -- the top-level
 * skill directories a corpus walk could descend into. Callers use this for
 * a non-vacuity control ("at least N skill directories were scanned with
 * at least one file read in each"), not for corpus traversal itself.
 */
export function topLevelSkillDirs(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}
