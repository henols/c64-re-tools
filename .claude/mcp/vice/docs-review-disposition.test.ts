// docs-review-disposition.test.ts
//
// WHY THIS EXISTS: AUDIT-01's own defect, applied to itself. The v0.3.0
// audit's AUDIT-01 finding was not "these four warnings are wrong" -- it was
// "these four warnings have no disposition anywhere." Plan 11.1-07's
// disposition ledger (`.planning/todos/completed/2026-08-21-phase-10-and-11-
// review-residual-dispositions.md`) is the fix for the ELEVEN Phase 10/11
// findings the audit named -- but that ledger is assembled by prose
// instruction ("read every SUMMARY and cross-reference the callouts"), which
// means the exact same defect can recur INSIDE the plan that exists to close
// it, for any of the other ~100 review findings this repo has accumulated
// across every phase. This file is the guard-first answer: it derives the
// full finding set from every `*-REVIEW.md` in `.planning/phases/`, rather
// than listing it, and asserts every one is accounted for SOMEWHERE.
//
// SCOPE FENCE: this guard reports; it does not rewrite, and it does not
// require any PARTICULAR disposition wording -- only that the finding id is
// mentioned in at least one recognised disposition source. A guard that
// demanded specific phrasing would fight every future reviewer's prose and
// get switched off. "Mentioned" is deliberately weak; this guard's job is to
// catch SILENCE (AUDIT-01's actual defect), not to grade disposition quality.
//
// DISPOSITION SOURCES (five, not the four originally sketched in planning --
// see the extra source below): for a given (phase, id) pair, at least one of:
//   1. a *-SUMMARY.md in that phase's own directory naming the id;
//   2. that phase's own *-VERIFICATION.md naming the id;
//   3. a *.planning/todos/{pending,completed}/*.md file naming the id AND
//      identifiably about that phase (see todoMentionsPhase() below);
//   4. a top-level `.planning/v*-MILESTONE-AUDIT.md`'s `tech_debt:` block,
//      in the entry whose own `phase:` field matches this phase, naming the
//      id;
//   5. that phase's own *-REVIEW-FIX.md (the established convention in this
//      repo for "this review's findings were fixed, here are the commits" --
//      e.g. `02-REVIEW-FIX.md`, `07-REVIEW-FIX.md`) naming the id.
// Source 5 is not one of the four sketched during planning, but is required
// for the guard to be usable at all: several phases (02, 03, 05, 07) predate
// this phase's SUMMARY/todo-ledger convention entirely and record their
// findings' fixes ONLY in a `*-REVIEW-FIX.md`. Without treating that as a
// disposition source, this guard would report dozens of long-fixed findings
// as undispositioned -- a guard that cries wolf gets disabled, which is the
// opposite of AUDIT-01's lesson.
//
// `.planning/v*-MILESTONE-AUDIT.md` is deliberately a TOP-LEVEL-ONLY glob --
// it does not reach into `.planning/milestones/` where superseded/archived
// audit rounds (e.g. `v0.2.0-MILESTONE-AUDIT.md` and its dated `-round*`
// siblings) live. Those are historical snapshots of a closed milestone, not
// a live disposition source a maintainer would think to check today.
//
// Like `docs-dangling-refs.test.ts` and `docs-deferred-ledger.test.ts`, this
// file verifies planning documents, not shipped runtime behaviour, and is
// deliberately kept OUT of `package.json`'s `files[]`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { repoRoot } from "./repo-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = repoRoot({ from: HERE });
const PHASES_DIR = join(ROOT, ".planning/phases");
const TODOS_PENDING_DIR = join(ROOT, ".planning/todos/pending");
const TODOS_COMPLETED_DIR = join(ROOT, ".planning/todos/completed");

interface Finding {
  phaseDir: string;
  phaseNum: string;
  reviewFile: string;
  id: string;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The leading numeric (optionally dotted, e.g. "08.2") token a phase
 * directory name starts with -- "10" from "10-adoption-boundaries-...",
 * "08.2" from "08.2-close-v0-2-0-blockers-...". Phase directories in this
 * repo are always named this way; a directory that does not match is not a
 * phase directory at all. */
function phaseNumToken(phaseDirName: string): string | null {
  const m = /^(\d+(?:\.\d+)?)/.exec(phaseDirName);
  return m ? m[1] : null;
}

/** Every `### WR-09:` / `### IN-03:` / `### CR-01:` style finding heading in
 * a REVIEW.md's raw text, returned as `"WR-09"` etc. */
function parseFindingIds(reviewContent: string): string[] {
  const ids: string[] = [];
  const re = /^### (WR|IN|CR)-(\d+):/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(reviewContent)) !== null) {
    ids.push(`${m[1]}-${m[2]}`);
  }
  return ids;
}

/** Every finding, from every `<num>-REVIEW.md` under every phase directory.
 * Derived via `readdirSync`, never enumerated -- a phase directory or a
 * REVIEW.md added later is picked up with no edit here. Excludes
 * `*-REVIEW-FIX.md` (a fix REPORT, not a review) by requiring the filename
 * end exactly in `REVIEW.md`. */
function scanAllReviewFindings(): Finding[] {
  assert.ok(existsSync(PHASES_DIR), `${PHASES_DIR} does not exist`);
  const findings: Finding[] = [];
  for (const phaseDir of readdirSync(PHASES_DIR)) {
    const phaseDirPath = join(PHASES_DIR, phaseDir);
    let entries: string[];
    try {
      entries = readdirSync(phaseDirPath);
    } catch {
      continue; // not a directory (defensive; every entry here is one today)
    }
    const num = phaseNumToken(phaseDir);
    if (num === null) continue;
    for (const file of entries) {
      if (!/^[0-9][0-9.]*-REVIEW\.md$/.test(file)) continue;
      const content = readFileSync(join(phaseDirPath, file), "utf8");
      for (const id of parseFindingIds(content)) {
        findings.push({ phaseDir, phaseNum: num, reviewFile: file, id });
      }
    }
  }
  return findings;
}

/** All `*.md` files under a todos directory, as `{ path, content }`. */
function readTodoFiles(dir: string): { path: string; content: string }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ path: join(dir, f), content: readFileSync(join(dir, f), "utf8") }));
}

/** True if a todo's content is identifiably ABOUT the given phase -- either
 * it names the phase's own REVIEW.md file directly (this repo's established
 * `source: phase-N code review (N-REVIEW.md)` convention), or it mentions
 * "Phase N" / "phase-N" as a word-bounded token. Without this check, a
 * bare id like "WR-01" would match almost every phase's disposition
 * (nearly every phase has its own WR-01), making the guard vacuous in the
 * OTHER direction -- everything would look dispositioned. */
function todoMentionsPhase(content: string, phaseNum: string, reviewFile: string): boolean {
  if (content.includes(reviewFile)) return true;
  const re = new RegExp(`\\bphase[\\s-]*${escapeRe(phaseNum)}\\b`, "i");
  return re.test(content);
}

/** Top-level `.planning/v*-MILESTONE-AUDIT.md` files only (never
 * `.planning/milestones/**`, which holds archived/superseded rounds of a
 * CLOSED milestone -- see this file's header). */
function topLevelMilestoneAuditFiles(): string[] {
  const planningDir = join(ROOT, ".planning");
  return readdirSync(planningDir)
    .filter((f) => /^v.*-MILESTONE-AUDIT\.md$/.test(f))
    .map((f) => readFileSync(join(planningDir, f), "utf8"));
}

/** Extracts the raw text of the `tech_debt:` top-level YAML key from a
 * milestone audit file, as the lines between it and the next COLUMN-ZERO
 * key (or the closing frontmatter `---`). A line-scan, not a single regex:
 * an earlier regex-lookahead version anchored its end-of-block alternative
 * on bare `$`, which under the `/m` flag matches at the end of EVERY line
 * -- including the very first `- phase: ...` line -- silently truncating
 * the block to one line and making every phase's tech_debt items
 * invisible to this guard. Measured directly against this repo's own
 * `v0.3.0-MILESTONE-AUDIT.md` while building this guard: the regex version
 * returned a 43-character block containing only the first `- phase:` line.
 * A column-zero check on each line is unambiguous where a lookahead-based
 * end-of-line test is not. */
function extractTechDebtBlock(auditContent: string): string {
  const lines = auditContent.split("\n");
  const startIdx = lines.findIndex((l) => l === "tech_debt:");
  if (startIdx === -1) return "";
  const blockLines: string[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === "---") break; // end of frontmatter
    if (/^[a-zA-Z_]/.test(line)) break; // next column-zero (top-level) key
    blockLines.push(line);
  }
  return blockLines.join("\n");
}

/** Returns only the `tech_debt:` sub-chunks whose own `- phase: <value>`
 * field's leading numeric token matches `phaseNum` exactly (never a prefix
 * match -- "08" must not match "08.2"'s block). Chunk boundaries are lines
 * matching exactly two-space-indented `- phase:` (this repo's tech_debt
 * items are always list entries at that one indentation level; deeper
 * `items:` sub-lists indent further and never match this boundary). */
function phaseScopedTechDebtText(auditContent: string, phaseNum: string): string {
  const body = extractTechDebtBlock(auditContent);
  if (body.trim().length === 0) return "";
  const chunks = body.split(/\n(?=  - phase:)/);
  const tokenRe = new RegExp(`^${escapeRe(phaseNum)}(?:[^0-9.]|$)`);
  return chunks
    .filter((chunk) => {
      const m = /^\s*-\s*phase:\s*(.+)/.exec(chunk);
      if (!m) return false;
      const value = m[1].trim();
      const valueToken = phaseNumToken(value);
      return valueToken !== null && tokenRe.test(valueToken) && valueToken === phaseNum;
    })
    .join("\n");
}

/** True if `id` (e.g. `"WR-09"`) appears, word-bounded, anywhere in
 * `dispositionText`. The one predicate shared by the real-source scan and
 * every planted-violation/false-negative test below. */
function isDispositioned(id: string, dispositionText: string): boolean {
  return new RegExp(`\\b${escapeRe(id)}\\b`).test(dispositionText);
}

/** Builds the full disposition-source text for one phase: every
 * *-SUMMARY.md, *-VERIFICATION.md and *-REVIEW-FIX.md in that phase's own
 * directory, every todo (pending or completed) identifiably about that
 * phase, and the milestone audit's phase-scoped tech_debt text. */
function dispositionTextForPhase(
  phaseDir: string,
  phaseNum: string,
  reviewFile: string,
  todos: { path: string; content: string }[],
  milestoneAudits: string[],
): string {
  const phaseDirPath = join(PHASES_DIR, phaseDir);
  const entries = readdirSync(phaseDirPath);
  const phaseDocsText = entries
    .filter((f) => /SUMMARY\.md$/i.test(f) || /VERIFICATION\.md$/i.test(f) || /REVIEW-FIX\.md$/i.test(f))
    .map((f) => readFileSync(join(phaseDirPath, f), "utf8"))
    .join("\n");
  const todosText = todos
    .filter((t) => todoMentionsPhase(t.content, phaseNum, reviewFile))
    .map((t) => t.content)
    .join("\n");
  const milestoneText = milestoneAudits.map((a) => phaseScopedTechDebtText(a, phaseNum)).join("\n");
  return `${phaseDocsText}\n${todosText}\n${milestoneText}`;
}

/** Every (phase, id) pair with no disposition anywhere -- AUDIT-01's defect,
 * expressed as an assertion. Caches the per-phase disposition text so each
 * phase's directory/todo/audit set is only read once regardless of how many
 * findings it has. */
function undispositionedFindings(): Finding[] {
  const findings = scanAllReviewFindings();
  const todos = [...readTodoFiles(TODOS_PENDING_DIR), ...readTodoFiles(TODOS_COMPLETED_DIR)];
  const milestoneAudits = topLevelMilestoneAuditFiles();
  const textByPhase = new Map<string, string>();
  const undispositioned: Finding[] = [];
  for (const finding of findings) {
    const cacheKey = `${finding.phaseDir}::${finding.reviewFile}`;
    let text = textByPhase.get(cacheKey);
    if (text === undefined) {
      text = dispositionTextForPhase(finding.phaseDir, finding.phaseNum, finding.reviewFile, todos, milestoneAudits);
      textByPhase.set(cacheKey, text);
    }
    if (!isDispositioned(finding.id, text)) undispositioned.push(finding);
  }
  return undispositioned;
}

test("every REVIEW.md finding id anywhere in .planning/phases/ has a recorded disposition (AUDIT-01, self-applied)", () => {
  const undispositioned = undispositionedFindings();
  assert.deepEqual(
    undispositioned,
    [],
    "finding(s) with no disposition anywhere -- fix them and cite the plan/SUMMARY, or file a todo naming the reason:\n" +
      undispositioned.map((f) => `  ${f.reviewFile} (${f.phaseDir}): ${f.id}`).join("\n"),
  );
});

test("positive control: the parser sees known-present anchors, and the total clears a floor of >= 100", () => {
  const findings = scanAllReviewFindings();
  assert.ok(findings.length >= 100, `expected at least 100 findings across all REVIEW.md files, got ${findings.length}`);

  const hasAnchor = (phaseDir: string, id: string) =>
    findings.some((f) => f.phaseDir === phaseDir && f.id === id);
  assert.ok(
    hasAnchor("10-adoption-boundaries-automated-bootstrap-and-the-removal", "WR-09"),
    "expected 10-REVIEW.md -> WR-09 to be discovered",
  );
  assert.ok(
    hasAnchor("11-annotation-store-enums-and-the-symbol-round-trip", "IN-02"),
    "expected 11-REVIEW.md -> IN-02 to be discovered",
  );
  assert.ok(
    hasAnchor("09-the-assumption-probe-go-no-go", "WR-01"),
    "expected 09-REVIEW.md -> WR-01 to be discovered",
  );
});

test("planted violation: a synthetic finding id mentioned nowhere is reported undispositioned", () => {
  // Exercises the real predicate (isDispositioned()) against synthetic
  // disposition text that deliberately does not mention the synthetic id --
  // the fixture file below (fixtures/planted-review-fixture.md) is the
  // committed proof that a REAL parse of a REVIEW.md-shaped file finds it;
  // this test proves the disposition HALF of the guard separately.
  const realPhaseDispositionText = readFileSync(
    join(
      PHASES_DIR,
      "10-adoption-boundaries-automated-bootstrap-and-the-removal",
      "10-VERIFICATION.md",
    ),
    "utf8",
  );
  assert.equal(
    isDispositioned("WR-99", realPhaseDispositionText),
    false,
    "a synthetic id that appears nowhere in a real phase's disposition text must be reported undispositioned",
  );

  // And the parser itself: the committed fixture carries a genuine
  // `### WR-99:` heading, so parseFindingIds() must find it.
  const fixturePath = join(HERE, "fixtures", "planted-review-fixture.md");
  assert.ok(existsSync(fixturePath), `${fixturePath} is missing -- the planted-violation fixture must be committed`);
  const fixtureIds = parseFindingIds(readFileSync(fixturePath, "utf8"));
  assert.ok(fixtureIds.includes("WR-99"), "the committed fixture's synthetic WR-99 heading was not parsed");
});

test("planted false-negative: the same synthetic id WITH a disposition source present is reported dispositioned", () => {
  // Pins that the guard reads disposition SOURCES, not merely counts
  // headings -- a checker that always returned "undispositioned" would
  // pass the previous test but fail this one.
  const dispositionFixturePath = join(HERE, "fixtures", "planted-disposition-fixture.md");
  assert.ok(
    existsSync(dispositionFixturePath),
    `${dispositionFixturePath} is missing -- the planted-disposition fixture must be committed`,
  );
  const dispositionText = readFileSync(dispositionFixturePath, "utf8");
  assert.equal(
    isDispositioned("WR-99", dispositionText),
    true,
    "a synthetic id WITH a disposition source naming it must be reported dispositioned",
  );
});
