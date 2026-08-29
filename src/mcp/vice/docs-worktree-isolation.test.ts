// docs-worktree-isolation.test.ts
//
// WHY THIS EXISTS: on 2026-08-29 an audit found that `workflow.use_worktrees`
// had been flipped to `false` in 2277885 as a side change inside an unrelated
// audit-closure commit, and that a set of standing instructions had grown up
// around that flip -- a ban on nested `claude -p` whose stated cause was tested
// and refuted, a `--force-isolation none` ritual that only existed because of
// the flip, and per-plan worktree opt-outs. The flip was reverted in 001696d
// and the policy written into CLAUDE.md and ENGINEERING_RULES.md in 305da94.
//
// Every layer of that fix is prose. Prose persuades; it does not block. A later
// session that hits one bad worktree run can flip the flag back, or a pending
// plan can quietly reintroduce "worktrees are disabled" as a premise, and
// nothing fails. This test makes the policy a red check instead.
//
// It also guards its own citations. CLAUDE.md and ENGINEERING_RULES.md cite
// exact line numbers in the INSTALLED GSD source as the evidence that three
// named constraints are stock behaviour rather than local policy. Those numbers
// drift on every `/gsd-update`, exactly as the `vice-proxy.ts` citations drifted
// between Phase 10 and Phase 11 -- see docs-linerefs.test.ts, whose reasoning
// this file reuses: a citation the repo can check mechanically is cheaper than
// a convention asking each future phase to re-check it by hand.
//
// `.claude/gsd-core/` is NOT committed, so it is absent in a fresh CI clone.
// The citation checks therefore skip when it is missing; every assertion over
// committed files runs unconditionally. Like the other docs-* guards this
// verifies planning-facing documentation, not shipped runtime, and is excluded
// from package.json's files[] allow-list.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";

import { repoRoot } from "./repo-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = repoRoot({ from: HERE });

/** The heading that carries the policy in CLAUDE.md. */
const CLAUDE_HEADING = "## GSD Execution Isolation";
/** The rule that carries the full rationale in ENGINEERING_RULES.md. */
const RULES_HEADING = "## 20. GSD Execution Isolation";
/** Closes the installer-managed region; the policy must sit AFTER it. */
const MANAGED_END = "<!-- GSD:workflow-end -->";

/**
 * Each cited GSD source file, and the token the cited line must still contain.
 * Keyed by the basename as it appears in the prose citation.
 */
const CITED_SOURCES: Record<string, { path: string; mustContain: string }> = {
  "execute-phase.md": {
    path: ".claude/gsd-core/workflows/execute-phase.md",
    mustContain: "Do NOT update STATE.md or ROADMAP.md",
  },
  "execute-plan.md": {
    path: ".claude/gsd-core/workflows/execute-plan.md",
    mustContain: "exclude STATE.md and ROADMAP.md",
  },
  "worktree-safety.cjs": {
    path: ".claude/gsd-core/bin/lib/worktree-safety.cjs",
    mustContain: "branch_contains_deletions",
  },
};

/** Matches `<file>:<line>` and `<file>:<start>-<end>` citations in backticks. */
const CITATION = /`([A-Za-z0-9._-]+\.(?:md|cjs|ts)):(\d+)(?:-(\d+))?`/g;

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

/** The policy section of CLAUDE.md, from its heading to the next h2 or EOF. */
function claudeMdPolicySection(): string {
  const md = read("CLAUDE.md");
  const start = md.indexOf(CLAUDE_HEADING);
  assert.notEqual(start, -1, `CLAUDE.md must carry a "${CLAUDE_HEADING}" section`);
  const next = md.indexOf("\n## ", start + CLAUDE_HEADING.length);
  return next === -1 ? md.slice(start) : md.slice(start, next);
}

/** Rule 20 of ENGINEERING_RULES.md, from its heading to the next h2 or EOF. */
function rule20Section(): string {
  const rules = read(".planning/ENGINEERING_RULES.md");
  const start = rules.indexOf(RULES_HEADING);
  assert.notEqual(start, -1, `ENGINEERING_RULES.md must carry "${RULES_HEADING}"`);
  const next = rules.indexOf("\n## ", start + RULES_HEADING.length);
  return next === -1 ? rules.slice(start) : rules.slice(start, next);
}

test("worktree isolation is enabled in the project config", () => {
  const cfg = JSON.parse(read(".planning/config.json"));
  assert.equal(
    cfg.workflow?.use_worktrees,
    true,
    "workflow.use_worktrees must be true -- the stock GSD default for a Claude " +
      "runtime. It was flipped to false once (2277885) as a side change and " +
      "restored in 001696d; see CLAUDE.md and ENGINEERING_RULES.md rule 20 " +
      "before changing it.",
  );
});

test("the policy lives in CLAUDE.md, outside the installer-managed region", () => {
  const md = read("CLAUDE.md");
  const heading = md.indexOf(CLAUDE_HEADING);
  assert.notEqual(heading, -1, `CLAUDE.md must carry a "${CLAUDE_HEADING}" section`);

  const managedEnd = md.indexOf(MANAGED_END);
  assert.notEqual(managedEnd, -1, "CLAUDE.md must still carry the GSD managed-region marker");
  assert.ok(
    heading > managedEnd,
    "The policy must sit AFTER the GSD:workflow-end marker. Inside the managed " +
      "region an installer re-stamp would silently discard it.",
  );
});

test("ENGINEERING_RULES.md carries the full rationale as rule 20", () => {
  const section = rule20Section();
  assert.match(
    section,
    /USE_WORKTREES_FOR_PLAN/,
    "Rule 20 must name the stock per-plan carve-out, since that -- not a " +
      "project-wide opt-out -- is the sanctioned way to run a plan unisolated.",
  );
});

test("no pending plan reintroduces a project-wide worktree opt-out", () => {
  const phasesDir = join(ROOT, ".planning", "phases");
  if (!existsSync(phasesDir)) return;

  const offenders: string[] = [];
  for (const phase of readdirSync(phasesDir)) {
    const dir = join(phasesDir, phase);
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue; // not a directory
    }
    for (const entry of entries) {
      if (!entry.endsWith("-PLAN.md")) continue;
      const id = entry.slice(0, -"-PLAN.md".length);
      // A plan with a SUMMARY has already executed; its text is a historical
      // record and may truthfully describe the era when worktrees were off.
      if (entries.includes(`${id}-SUMMARY.md`)) continue;

      const text = readFileSync(join(dir, entry), "utf8");
      const claimsDisabled =
        /worktree isolation is disabled/i.test(text) ||
        /worktrees (?:are |already )?disabled/i.test(text);
      if (!claimsDisabled) continue;

      // Naming the stock per-plan carve-out is the sanctioned route: that plan
      // runs unisolated via USE_WORKTREES_FOR_PLAN=false while the project
      // keeps isolation on.
      if (!text.includes("USE_WORKTREES_FOR_PLAN")) {
        offenders.push(`${phase}/${entry}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    "These pending plans assume worktree isolation is off without naming the " +
      "stock per-plan carve-out USE_WORKTREES_FOR_PLAN=false. A plan that needs " +
      "to run unisolated must request it per-plan, not assume the project flag.",
  );
});

test("every GSD source citation in the policy still says what is claimed", (t) => {
  const gsdCore = join(ROOT, ".claude", "gsd-core");
  if (!existsSync(gsdCore)) {
    t.skip(".claude/gsd-core is not committed and is absent here (expected in CI)");
    return;
  }

  const prose = `${claudeMdPolicySection()}\n${rule20Section()}`;
  const seen: string[] = [];

  for (const m of prose.matchAll(CITATION)) {
    const [, file, startRaw, endRaw] = m;
    const spec = CITED_SOURCES[basename(file)];
    // Only GSD-source citations are in scope; the policy also cites planning
    // files, which the other assertions above already cover.
    if (!spec) continue;
    seen.push(`${file}:${startRaw}${endRaw ? `-${endRaw}` : ""}`);

    const target = join(ROOT, spec.path);
    assert.ok(existsSync(target), `${spec.path} is cited but missing`);
    const lines = readFileSync(target, "utf8").split("\n");

    const start = Number(startRaw);
    const end = endRaw ? Number(endRaw) : start;
    assert.ok(end <= lines.length, `${file}:${end} is past EOF (${lines.length} lines)`);

    const cited = lines.slice(start - 1, end).join("\n");
    assert.ok(
      cited.includes(spec.mustContain),
      `${file}:${startRaw}${endRaw ? `-${endRaw}` : ""} no longer contains ` +
        `"${spec.mustContain}". GSD was probably updated and the line numbers ` +
        `drifted. Re-verify the constraint still holds, then update the citation ` +
        `in CLAUDE.md and ENGINEERING_RULES.md rule 20.`,
    );
  }

  assert.deepEqual(
    [...new Set(seen.map((s) => basename(s.split(":")[0])))].sort(),
    Object.keys(CITED_SOURCES).sort(),
    "The policy must cite all three stock-behaviour constraints. A missing one " +
      "means the evidence for it was dropped from the prose.",
  );
});
