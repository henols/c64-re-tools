// docs-uat-abstention.test.ts
//
// WHY THIS EXISTS: on 2026-08-29 phase 28's `28-UAT.md` recorded
// `total: 3, passed: 3, issues: 0`. None of the three had been tested. Two
// were carried-forward `behavior_unverified` items that the SAME phase's
// `28-VERIFICATION.md:6` counted (`behavior_unverified: 2`) and whose
// prohibition 28-18 P3 -- "MUST NOT close, silently drop, or re-file as done
// a carried-forward `behavior_unverified` item", verdict `held` at `:349` --
// forbids passing. `.planning/REQUIREMENTS.md:252-257` listed (and still
// lists) both as STILL OPEN. The third asked for review of fourteen
// judgment-tier verdicts, two of them recorded `violated`, and passed them
// unreviewed.
//
// The cause was not carelessness. GSD's UAT gate maps a bare Enter to
// `result: pass` (`gsd-core/workflows/verify-work.md`, `<philosophy>`) and its
// result vocabulary -- `pass | issue | skipped | blocked` -- had no way to say
// "unverifiable by construction". So an item that CANNOT be verified had no
// truthful exit and the untruthful one was the default keypress. That is the
// exact outcome `gsd-core/references/honest-verifier.md` exists to prevent:
// it mandates that an abstained `backstop` truth be "`insufficient_spec`,
// flagged, -> `human_needed` -- **never `passed`**", citing a measured
// 100% -> 17% drop in confident-false-passes. The abstention survived the
// verifier and died at the gate.
//
// WHY THE GUARD LIVES HERE AND NOT ON THE GATE: `.claude/gsd-core/` is a
// vendored install -- untracked (only `.claude/settings.json` is in
// `git ls-files`), and `/gsd-update` overwrites it. A guard asserting on the
// patched workflow file would be unrunnable in CI and on any fresh clone.
// `.planning/` IS tracked, so this guard checks the OUTCOME instead of the
// mechanism: whatever tool wrote the UAT file, and whether or not the gate
// patch survived its next update, a laundered abstention is caught here.
//
// THE RULE, and why it is shaped this way. A UAT entry that is
// abstention-tagged (see ABSTENTION_MARKERS) may be `result: pass` ONLY if it
// also carries a RESOLUTION-SIDE field recording what the human actually
// decided. The discriminator is deliberately NOT the tag alone, because
// phase 27 proves a tagged item can be legitimately passed: all three of
// `27-UAT.md`'s entries carry a substantive `note:` -- item 2 accepts its
// `backstop` concurrency abstention as "not applicable - single-threaded,
// pure, no interruptible path" and shows its work down to
// `r2000-coverage.ts:2173`. That is an earned pass. Phase 28's were
// keypresses. The difference between them is a recorded rationale, so that
// is what this guard requires.
//
// Question-side fields do NOT count. `expected:` and `why_human:` are written
// at file-CREATION time from the verifier's own output -- they state the
// question, not the answer, and both were present on all three of phase 28's
// false passes. Only `note:`, `decision:` or `source: human_decision` are
// accepted, because only those are written at RESOLUTION time.
//
// SCOPE FENCE, following `docs-review-disposition.test.ts`: this guard
// reports, it does not rewrite, and it does not grade rationale QUALITY or
// demand particular wording -- a guard that fought every future reviewer's
// prose would get switched off. "Carries a resolution-side field" is
// deliberately weak. Its job is to catch the SILENT pass, which is the actual
// defect. It also says nothing about items resolved `unverified`, `issue`,
// `skipped` or `blocked`; only `pass` on a tagged item is constrained.
//
// Like the other `docs-*.test.ts` files this verifies planning documents, not
// shipped runtime behaviour, and is kept OUT of `package.json`'s `files[]`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { repoRoot } from "./repo-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = repoRoot({ from: HERE });
const PHASES = join(ROOT, ".planning", "phases");

/** Tokens that mark a UAT entry as an abstention -- an item whose correct
 *  disposition is "cannot be verified here", not "passed". Drawn from the
 *  vocabulary `honest-verifier.md`, `edge-probe.md` and `prohibition-probe.md`
 *  already use, so this list tracks GSD's own tags rather than inventing a
 *  parallel one. Matched case-insensitively against the entry body. */
const ABSTENTION_MARKERS: readonly string[] = [
  "insufficient_spec",
  "behavior_unverified",
  "backstop",
  "judgment-tier",
  "verification: judgment",
  "fault-inject",
  "fault injection",
];

/** Fields written at RESOLUTION time. Presence of any one means a human
 *  recorded a determination rather than pressing Enter. `why_human` and
 *  `expected` are deliberately absent: they are written at file-creation time
 *  and were present on every one of phase 28's false passes. */
const RESOLUTION_FIELDS: readonly string[] = ["note:", "decision:", "source: human_decision"];

interface UatEntry {
  heading: string;
  body: string;
  result: string | null;
}

/** Split a UAT document's `## Tests` section into its `### N. ...` entries.
 *  Tolerant of the heading depth and numbering drift seen across phases: the
 *  parser keys on a heading line followed by field lines, not on an exact
 *  `### {N}. ` shape (the blind spot `docs-review-disposition.test.ts` was
 *  green-for-the-wrong-reason on before plan 15-01 widened its own regex). */
export function parseUatEntries(text: string): UatEntry[] {
  const testsStart = text.search(/^##\s+Tests\s*$/m);
  if (testsStart === -1) return [];
  const after = text.slice(testsStart);
  // Stop at the next level-2 heading (## Summary / ## Gaps / ## Deferred ...).
  const endRel = after.slice(1).search(/^##\s+(?!Tests)/m);
  const section = endRel === -1 ? after : after.slice(0, endRel + 1);

  const entries: UatEntry[] = [];
  const lines = section.split("\n");
  let current: { heading: string; body: string[] } | null = null;
  for (const line of lines) {
    const m = /^#{3,6}\s+(.*\S)\s*$/.exec(line);
    if (m) {
      if (current) entries.push(finish(current));
      current = { heading: m[1], body: [] };
      continue;
    }
    if (current) current.body.push(line);
  }
  if (current) entries.push(finish(current));
  return entries;

  function finish(e: { heading: string; body: string[] }): UatEntry {
    const body = e.body.join("\n");
    // `result:` at column 0 only -- a `result:` nested inside a quoted note
    // belongs to that note's prose, not to the entry.
    const rm = /^result:\s*(\S.*?)\s*$/m.exec(body);
    return { heading: e.heading, body, result: rm ? rm[1] : null };
  }
}

export function isAbstentionTagged(entry: UatEntry): boolean {
  const hay = `${entry.heading}\n${entry.body}`.toLowerCase();
  return ABSTENTION_MARKERS.some((marker) => hay.includes(marker.toLowerCase()));
}

export function hasResolutionRationale(entry: UatEntry): boolean {
  return RESOLUTION_FIELDS.some((field) => {
    // Anchored to line start so `decision:` inside prose does not count.
    const re = new RegExp(`^\\s*${field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\S`, "mi");
    return re.test(entry.body);
  });
}

function uatFiles(): { path: string; phase: string }[] {
  if (!existsSync(PHASES)) return [];
  const out: { path: string; phase: string }[] = [];
  for (const phase of readdirSync(PHASES, { withFileTypes: true })) {
    if (!phase.isDirectory()) continue;
    const dir = join(PHASES, phase.name);
    for (const f of readdirSync(dir)) {
      if (/UAT.*\.md$/.test(f)) out.push({ path: join(dir, f), phase: phase.name });
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

test("no UAT entry launders an abstention into a bare pass (phase-28 defect, 2026-08-29)", () => {
  const violations: string[] = [];
  for (const { path, phase } of uatFiles()) {
    for (const entry of parseUatEntries(readFileSync(path, "utf8"))) {
      if (entry.result !== "pass") continue;
      if (!isAbstentionTagged(entry)) continue;
      if (hasResolutionRationale(entry)) continue;
      violations.push(
        `${phase}/${path.split("/").pop()}: "${entry.heading.slice(0, 90)}" is abstention-tagged and ` +
          `recorded \`result: pass\` with no resolution-side field (${RESOLUTION_FIELDS.join(" / ")}). ` +
          `An item that cannot be verified must be \`result: unverified\` with a reason, or carry the ` +
          `decision a human actually made. See .planning/notes/uat-gate-launders-abstentions.md`,
      );
    }
  }
  assert.deepEqual(violations, [], `\n${violations.join("\n\n")}\n`);
});

test("a phase declaring behavior_unverified: N does not report every UAT item passed", () => {
  // The count-side companion. Phase 28's VERIFICATION.md declared
  // `behavior_unverified: 2` while its UAT summary read `passed: 3` of 3 --
  // an arithmetic impossibility that needed no prose matching to spot.
  const violations: string[] = [];
  if (existsSync(PHASES)) {
    for (const phase of readdirSync(PHASES, { withFileTypes: true })) {
      if (!phase.isDirectory()) continue;
      const dir = join(PHASES, phase.name);
      const files = readdirSync(dir);
      const ver = files.find((f) => /VERIFICATION\.md$/.test(f));
      const uat = files.find((f) => /UAT\.md$/.test(f));
      if (!ver || !uat) continue;
      const vm = /^behavior_unverified:\s*(\d+)\s*$/m.exec(readFileSync(join(dir, ver), "utf8"));
      const declared = vm ? Number(vm[1]) : 0;
      if (declared === 0) continue;
      const uatText = readFileSync(join(dir, uat), "utf8");
      const entries = parseUatEntries(uatText);
      const resolved = entries.filter((e) => e.result !== null);
      if (resolved.length === 0) continue;
      const notPassed = resolved.filter((e) => e.result !== "pass").length;
      if (notPassed < declared) {
        violations.push(
          `${phase.name}: ${ver} declares \`behavior_unverified: ${declared}\` but ${uat} resolves ` +
            `only ${notPassed} of ${resolved.length} entries to something other than \`pass\`. ` +
            `A carried-forward behavior_unverified item may not be re-filed as done.`,
        );
      }
    }
  }
  assert.deepEqual(violations, [], `\n${violations.join("\n\n")}\n`);
});

test("positive control: the parser sees real UAT files and their entries", () => {
  const files = uatFiles();
  assert.ok(files.length >= 8, `expected >= 8 UAT files under .planning/phases/, found ${files.length}`);
  const total = files.reduce((n, f) => n + parseUatEntries(readFileSync(f.path, "utf8")).length, 0);
  assert.ok(total >= 15, `expected >= 15 parsed UAT entries across all files, found ${total}`);
  // A parser that returned [] for everything would pass both violation tests
  // above vacuously; this pins that it does not.
  const withResult = files.reduce(
    (n, f) => n + parseUatEntries(readFileSync(f.path, "utf8")).filter((e) => e.result !== null).length,
    0,
  );
  assert.ok(withResult >= 15, `expected >= 15 entries carrying a \`result:\`, found ${withResult}`);
});

test("positive control: phase 28's corrected entries read as intended", () => {
  const p = join(PHASES, "28-the-store-core", "28-UAT.md");
  assert.ok(existsSync(p), `${p} is missing`);
  const entries = parseUatEntries(readFileSync(p, "utf8"));
  assert.equal(entries.length, 3, "phase 28's UAT has exactly three entries");
  assert.deepEqual(
    entries.map((e) => e.result),
    ["unverified", "unverified", "pass"],
    "the two fault-injection/fsync abstentions are `unverified`; the judgment review was actually decided",
  );
  assert.ok(
    hasResolutionRationale(entries[2]),
    "the one passed entry must carry the decision that earned the pass",
  );
});

test("positive control: phase 27's tagged passes are earned, not laundered", () => {
  // The guard must not red on a legitimately-decided abstention, or it gets
  // switched off. Phase 27 item 2 accepts a `backstop` truth with a detailed
  // `note:` -- exactly the shape that should stay green.
  const p = join(PHASES, "27-shared-seams-extracted", "27-UAT.md");
  assert.ok(existsSync(p), `${p} is missing`);
  const entries = parseUatEntries(readFileSync(p, "utf8"));
  const tagged = entries.filter((e) => e.result === "pass" && isAbstentionTagged(e));
  assert.ok(tagged.length >= 1, "phase 27 must still contain at least one abstention-tagged pass");
  for (const e of tagged) {
    assert.ok(hasResolutionRationale(e), `phase 27 entry "${e.heading.slice(0, 60)}" should read as earned`);
  }
});

test("planted violation: a bare tagged pass is reported", () => {
  const planted = [
    "## Tests",
    "",
    "### 1. Fault-inject so the integrity check itself throws",
    "expected: an error naming the path",
    "why_human: no reachable input without fault injection",
    "result: pass",
    "",
    "## Summary",
  ].join("\n");
  const entries = parseUatEntries(planted);
  assert.equal(entries.length, 1, "the planted entry must parse");
  assert.equal(entries[0].result, "pass");
  assert.ok(isAbstentionTagged(entries[0]), "`fault-inject` must mark the entry abstention-tagged");
  assert.equal(
    hasResolutionRationale(entries[0]),
    false,
    "`why_human` is question-side and must NOT satisfy the resolution requirement -- it was present on every one of phase 28's false passes",
  );
});

test("planted false-negative: the same entry WITH a recorded decision is accepted", () => {
  // Pins that the guard reads the rationale and is not simply always-red on
  // tagged passes -- the failure mode that would make it unusable.
  const planted = [
    "## Tests",
    "",
    "### 1. Fault-inject so the integrity check itself throws",
    "expected: an error naming the path",
    "why_human: no reachable input without fault injection",
    "result: pass",
    "note: \"Accepted - a held-out test now exercises the throw via a truncated file.\"",
    "",
    "## Summary",
  ].join("\n");
  const entries = parseUatEntries(planted);
  assert.equal(entries.length, 1);
  assert.ok(isAbstentionTagged(entries[0]));
  assert.equal(hasResolutionRationale(entries[0]), true, "a resolution-side `note:` must satisfy the requirement");
});

test("planted control: an untagged bare pass is NOT reported", () => {
  // Scope fence: ordinary UAT items are unaffected. A guard that demanded a
  // rationale on every pass would be a different (and much more annoying)
  // policy than the one this file argues for.
  const planted = ["## Tests", "", "### 1. The sidebar collapses at 768px", "expected: hamburger appears", "result: pass", "", "## Summary"].join("\n");
  const entries = parseUatEntries(planted);
  assert.equal(entries.length, 1);
  assert.equal(isAbstentionTagged(entries[0]), false, "a plain visual check carries no abstention marker");
});

test("if gsd-core is installed here, its UAT gate carries the abstention carve-out", (t) => {
  // CONDITIONAL BY DESIGN. `.claude/gsd-core/` is a vendored install: untracked,
  // absent on a fresh clone and in CI, and overwritten wholesale by
  // `/gsd-update`. So this cannot be an unconditional assertion -- it would red
  // every clone that never installed GSD. It skips when the file is absent and
  // fails only when the gate is PRESENT and UNPATCHED, which is exactly the
  // post-`/gsd-update` state where the fix has silently reverted and the next
  // phase's UAT would start laundering abstentions again.
  //
  // The unconditional protection is the outcome guard at the top of this file,
  // which reads tracked `.planning/` artifacts and runs everywhere.
  const gate = join(ROOT, ".claude", "gsd-core", "workflows", "verify-work.md");
  if (!existsSync(gate)) {
    t.skip("gsd-core is not installed in this checkout (expected in CI and on fresh clones)");
    return;
  }
  const text = readFileSync(gate, "utf8");
  assert.ok(
    text.includes("**The abstention carve-out.**"),
    "gsd-core's verify-work.md has lost the abstention carve-out -- almost certainly a `/gsd-update` " +
      "overwrite. Reapply it with:\n\n    node scripts/gsd-patch-uat-abstention.mjs\n\n" +
      "Rationale: .planning/notes/uat-gate-launders-abstentions.md",
  );
  assert.ok(
    text.includes("result: unverified"),
    "gsd-core's verify-work.md carries the carve-out prose but not the `unverified` result value",
  );
});
