// skill-consumer-paths.test.ts
//
// WHY THIS EXISTS (16-REVIEW.md CR-01, plan 16-10): plan 16-04's blanket
// `.claude/skills` -> `src/skills` sweep rewrote four literals that name
// where a skill lives ONCE INSTALLED into somebody else's project, not
// where it lives in this repository -- `installer/bin/cli.mjs:153`'s
// `destRoot = join(target, ".claude", "skills")` is the single fact every
// entry below turns on. Three of the four are written into files a
// consumer KEEPS (the generated `recovery/PROVENANCE.md` ledger, the
// generated `recovery/LOADING.md` record, and the `template.a` scaffold
// `acme.mjs new` copies verbatim into a user's own source file); the fourth
// is generic reuse advice in `acme-build/SKILL.md` telling a reader where to
// put a skill in their own project.
//
// Plan 16-01 had explicitly named two of the four sites (the provenance-diff
// generator's literals) as deliberately preserved and added a guarding
// comment at the generation site saying so. Plan 16-04's sweep rewrote the
// comment's OWN example alongside the literals it was guarding against, so
// both halves of "the consumer's installed location, not this repository's
// source-tree location" ended up naming the SAME string -- a self-
// contradiction that survived because the plan's own verification for that
// spot was `grep -c 'c64-provenance-diff/scripts/diff-images.mjs' <file>`
// returning at least 3 -- a substring `.claude/skills/...` and `src/skills/
// ...` satisfy IDENTICALLY, so it could never have caught the regression.
//
// THE RULE THIS GUARD ENCODES: a string that ends up in a file a consumer
// keeps, or that tells a reader where to put a skill in their own project,
// MUST name the installed location, because `installSkills()` deploys
// there and nowhere else.
//
// THE DISCIPLINE EVERY ASSERTION HERE FOLLOWS: presence of the consumer
// form AND absence of the source-tree form, NEVER a substring both forms
// satisfy. A registry entry with only a presence check, or only an absence
// check, is exactly the defect class this file exists to close -- do not
// add one.
//
// REGISTRY, NOT A SCAN: unlike this codebase's corpus-scanning guards
// (`hop-chain-comments.test.ts`, `comment-phase-pointers.test.ts`), the four
// sites here are known, named, and fixed in number -- a frozen four-entry
// registry, each entry naming its file, its required (consumer-form)
// substrings, its forbidden (source-tree-form) substrings, and -- for the
// one file that also legitimately carries the source-tree form elsewhere
// (`acme-build/SKILL.md`'s in-repo developer commands) -- a CONTENT-anchored
// region to scope the absence check to, never a line number (line numbers
// drift; anchor text on the sentence itself does not).
//
// NON-VACUITY: a four-entry floor, a per-entry file-exists check, a
// per-entry required-and-forbidden-non-empty check, and a per-entry
// anchor-must-match check -- so a stale anchor or a renamed file degrades to
// a FAILURE, never to a silently-unchecked entry. Each entry was also
// demonstrated to bite live (planted the source-tree form back in, watched
// this guard fail naming that file, reverted) -- recorded in
// `16-10-SUMMARY.md`, not repeated here as a test (a plant-and-revert test
// would leave the tree dirty between runs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { repoRoot } from "./repo-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = repoRoot({ from: HERE });

// ---------------------------------------------------------------------------
// The registry.
// ---------------------------------------------------------------------------

interface RegionAnchor {
  /** Content the region starts at -- the opening words of the sentence, not
   * a line number. Must appear exactly once in the file. */
  start: string;
  /** How many physical lines from (and including) the anchor line to scope
   * the absence check to. */
  lines: number;
}

interface RegistryEntry {
  /** Repo-root-relative path. */
  file: string;
  /** Human label for failure messages. */
  label: string;
  /** Substrings that must each appear at least once (in the scoped region,
   * if one is declared; otherwise anywhere in the file). */
  required: string[];
  /** Substrings that must appear zero times (same scoping rule). */
  forbidden: string[];
  /** When set, both required and forbidden are checked only within this
   * content-anchored region, not the whole file -- for a file that also
   * legitimately carries the source-tree form elsewhere. */
  region?: RegionAnchor;
}

const REGISTRY: RegistryEntry[] = [
  {
    file: "src/skills/c64-provenance-diff/scripts/diff-images.mjs",
    label: "the provenance-diff generator (renderLedger + anchor-search's method: field)",
    required: [".claude/skills/c64-provenance-diff/scripts/diff-images.mjs"],
    forbidden: ["src/skills/c64-provenance-diff/scripts/diff-images.mjs"],
    // Whole-file: this module's ONLY mentions of its own script path are the
    // three consumer-facing literals plus the guarding comment (which uses
    // the abbreviated `src/skills/...` form, never the full literal path
    // this forbidden substring names).
  },
  {
    file: "src/skills/c64-ram-capture/scripts/watch-loads.mjs",
    label: "the RAM-capture watcher (renderLoading's absence-as-evidence paragraph)",
    required: [
      ".claude/skills/c64-ram-capture/scripts/watch-loads.mjs",
      ".claude/skills/c64-ram-capture/scripts/dump-artifacts.mjs",
    ],
    forbidden: [
      "src/skills/c64-ram-capture/scripts/watch-loads.mjs",
      "src/skills/c64-ram-capture/scripts/dump-artifacts.mjs",
    ],
    // Whole-file: same reasoning as above -- the JSDoc enforcement pointer
    // added alongside this literal names this guard's own filename
    // (skill-consumer-paths.test.ts), never the source-tree script path.
  },
  {
    file: "src/skills/acme-build/template.a",
    label: "the assembly scaffold's `; Build:` line, copied verbatim into every user file by `acme.mjs new`",
    required: [".claude/skills/acme-build/scripts/acme.mjs"],
    forbidden: ["src/skills/acme-build"],
    // Whole-file: template.a carries no other mention of its own skill path.
  },
  {
    file: "src/skills/acme-build/SKILL.md",
    label: "the acme-build playbook's generic reuse advice",
    required: [".claude/skills/acme-build/scripts/", ".claude/skills/acme-build/"],
    forbidden: ["src/skills/acme-build/"],
    // Region-scoped: this file's `# npm install` / `# in-repo/plugin`
    // dual-route block and its `from the repo root` quick-reference
    // assignment are in-repo developer routes plan 16-04 classified
    // deliberately (16-10-PLAN.md's own prohibition names both). Both
    // legitimately name `src/skills/acme-build/` elsewhere in this same
    // file, so the forbidden-substring check must be scoped to the reuse-
    // advice sentence alone, anchored on its own opening words -- never a
    // line number, which drifts.
    region: { start: "Copy `acme.mjs` into any project", lines: 2 },
  },
];

// ---------------------------------------------------------------------------
// Region extraction -- content-anchored, never line-numbered.
// ---------------------------------------------------------------------------

function regionText(content: string, anchor: RegionAnchor): string {
  const idx = content.indexOf(anchor.start);
  assert.notEqual(
    idx,
    -1,
    `region anchor ${JSON.stringify(anchor.start)} did not match -- the anchored sentence moved or was reworded; ` +
      "update the anchor text (never a line number) to match the current wording",
  );
  const fromAnchor = content.slice(idx);
  const lines = fromAnchor.split("\n");
  return lines.slice(0, anchor.lines).join("\n");
}

function scopedText(entry: RegistryEntry, content: string): string {
  return entry.region ? regionText(content, entry.region) : content;
}

// ---------------------------------------------------------------------------
// Non-vacuity floors -- each its own named test, per this codebase's
// established convention (hop-chain-comments.test.ts, comment-phase-
// pointers.test.ts) that "a missing one FAILS rather than silently
// shrinking the scanned set".
// ---------------------------------------------------------------------------

test("non-vacuity: the registry has at least four entries", () => {
  assert.ok(
    REGISTRY.length >= 4,
    `expected at least 4 registry entries, got ${REGISTRY.length} -- an entry may have been silently dropped`,
  );
});

test("non-vacuity: every registry file exists on disk", () => {
  for (const entry of REGISTRY) {
    const abs = join(ROOT, entry.file);
    assert.ok(
      existsSync(abs),
      `registry entry ${JSON.stringify(entry.file)} (${entry.label}) does not exist on disk -- an entry must not ` +
        "outlive a renamed or removed file silently",
    );
  }
});

test("non-vacuity: every entry declares at least one required and at least one forbidden substring", () => {
  for (const entry of REGISTRY) {
    assert.ok(
      entry.required.length >= 1,
      `registry entry ${JSON.stringify(entry.file)} declares zero required substrings -- a half-filled entry must not pass`,
    );
    assert.ok(
      entry.forbidden.length >= 1,
      `registry entry ${JSON.stringify(entry.file)} declares zero forbidden substrings -- a half-filled entry must not pass`,
    );
  }
});

test("non-vacuity: every region anchor actually matches in its file", () => {
  for (const entry of REGISTRY) {
    if (!entry.region) continue;
    const content = readFileSync(join(ROOT, entry.file), "utf8");
    // regionText() itself asserts the anchor matched; calling it here turns
    // a stale anchor into a failure attributed to this floor test, not a
    // silently-skipped entry.
    regionText(content, entry.region);
  }
});

// ---------------------------------------------------------------------------
// The real assertions -- one per entry, presence AND absence, never one
// without the other.
// ---------------------------------------------------------------------------

for (const entry of REGISTRY) {
  test(`${entry.file}: names the consumer-installed location (${entry.label})`, () => {
    const content = readFileSync(join(ROOT, entry.file), "utf8");
    const scoped = scopedText(entry, content);
    for (const needle of entry.required) {
      assert.ok(
        scoped.includes(needle),
        `${entry.file} must name the consumer-installed path ${JSON.stringify(needle)} -- ` +
          "installSkills() deploys skills there, so a command or path a consumer reads must point there too. " +
          "Fix the literal at its generation site; do not relax this registry entry.",
      );
    }
  });

  test(`${entry.file}: never names this repository's source-tree location (${entry.label})`, () => {
    const content = readFileSync(join(ROOT, entry.file), "utf8");
    const scoped = scopedText(entry, content);
    for (const needle of entry.forbidden) {
      assert.ok(
        !scoped.includes(needle),
        `${entry.file} must NOT name this repository's source-tree path ${JSON.stringify(needle)} -- ` +
          "a consumer's own project has no such path; a command or pointer naming it sends a reader (human or " +
          "agent) to a file that does not exist for them. Fix the literal at its generation site; do not relax " +
          "this registry entry.",
      );
    }
  });
}
