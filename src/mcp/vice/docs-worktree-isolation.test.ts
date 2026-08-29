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
// nothing fails. This test makes the policy a red check instead. The original
// flip was a SIDE CHANGE in a commit about something else -- that is precisely
// the failure mode an assertion catches and review did not.
//
// WHY IT ASSERTS ONLY OVER TRACKED FILES: `.claude/gsd-core/` and its sibling
// installed dirs are a vendored GSD install -- gitignored, machine-path-stamped,
// regenerated wholesale by `/gsd-update`. Nothing in this repo may branch on
// whether that tree exists: CI and fresh clones have no GSD at all, and that is
// a supported state rather than a degraded one. So this guard reads only
// `.planning/` and `CLAUDE.md`, runs identically everywhere, and never skips.
// Keeping the vendored install correct is the job of
// `scripts/gsd-reapply-local.mjs` (SessionStart hook), not of the test suite.
//
// Like the other docs-* guards this verifies planning-facing documentation, not
// shipped runtime, and is excluded from package.json's files[] allow-list.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { repoRoot } from "./repo-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = repoRoot({ from: HERE });

/** The heading that carries the policy in CLAUDE.md. */
const CLAUDE_HEADING = "## GSD Execution Isolation";
/** The rule that carries the full rationale in ENGINEERING_RULES.md. */
const RULES_HEADING = "## 20. GSD Execution Isolation";
/** Closes the installer-managed region; the policy must sit AFTER it. */
const MANAGED_END = "<!-- GSD:workflow-end -->";

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

/** A named section, from its heading to the next h2 or EOF. */
function section(text: string, heading: string, where: string): string {
  const start = text.indexOf(heading);
  assert.notEqual(start, -1, `${where} must carry a "${heading}" section`);
  const next = text.indexOf("\n## ", start + heading.length);
  return next === -1 ? text.slice(start) : text.slice(start, next);
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

test("CLAUDE.md's policy names the three stock constraints", () => {
  const policy = section(read("CLAUDE.md"), CLAUDE_HEADING, "CLAUDE.md");
  for (const [what, pattern] of [
    ["the per-plan carve-out", /USE_WORKTREES_FOR_PLAN/],
    ["the cleanup-wave deletion guard", /cleanup-wave[\s\S]{0,80}deletion/i],
    ["the isolation sentinel", /sentinel/i],
  ] as const) {
    assert.match(
      policy,
      pattern,
      `CLAUDE.md's policy must still describe ${what}. Dropping it removes the ` +
        "reason a future session would honour the constraint instead of " +
        "disabling isolation to avoid it.",
    );
  }
});

test("ENGINEERING_RULES.md carries the full rationale as rule 20", () => {
  const rule = section(read(".planning/ENGINEERING_RULES.md"), RULES_HEADING, "ENGINEERING_RULES.md");
  assert.match(
    rule,
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
