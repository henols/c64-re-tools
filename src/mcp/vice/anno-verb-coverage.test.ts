// anno-verb-coverage.test.ts -- the non-vacuity/planted-violation proof for
// the FLOW-01 guard (11.1-CONTEXT.md, D-11.1-02).
//
// `scripts/check-skill-tool-coverage.mjs` checked `r2000_*` MCP TOOL names
// in skill prose, but nothing checked `r2000` CLI VERBS at all -- so
// `gen-enums`, `export-lbl` and `import-lbl` (R2000-13/-14/-15's own
// delivery path) reached `main` documented in zero skill files, with
// nothing catching it. `scripts/lib/anno-cli-verbs.mjs` closes that gap by
// PARSING the verb list from `anno-cli.ts`'s own dispatch switch, and this
// file is the committed proof that the parser and the CI script that
// imports it both actually work -- a guard is only as good as the evidence
// it was ever awake.
//
// This file imports the SAME module the CI script imports (never a second
// copy of the parser), so proving the predicate here proves the predicate
// the CI script runs in production.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseAnnoCliVerbs, verbsMissingFromSkills, ANNO_CLI_VERB_FLOOR } from "../../../scripts/lib/anno-cli-verbs.mjs";

const HERE = dirname(fileURLToPath(import.meta.url)); // <root>/src/mcp/vice
const ROOT = join(HERE, "..", "..", ".."); // <root>
const SKILLS_DIR = join(ROOT, "src", "skills");
const CI_SCRIPT = join(ROOT, "scripts", "check-skill-tool-coverage.mjs");

/**
 * The verbs `anno-cli.ts`'s dispatch switch really has, hand-maintained on
 * purpose. This is a FROZEN REGISTRY, not a convenience list: the real-source
 * parse test below compares the live parse against it with `deepEqual`, so
 * adding a verb to the switch without adding it here FAILS -- which is the
 * entire point. Deriving this array from `parseAnnoCliVerbs()` (the very
 * function under test) would turn every assertion below into a tautology that
 * passes no matter what the parser does.
 *
 * NARROWED FROM EIGHT TO TWO on 2026-08-29 by plan 29-07 (D-14), together with
 * `ANNO_CLI_VERB_FLOOR`. Both counts move together, deliberately, because they
 * measure the same fact. See that constant's own comment for why a smaller
 * number here is a REPLACEMENT over a new verb set rather than a lowering.
 *
 * RAISED TWO -> THREE on 2026-08-31 by plan 30-05, together with
 * `ANNO_CLI_VERB_FLOOR` again: `export-asm` returned as a rebuild over the
 * annotation store behind a real-ACME byte-diff oracle. That is the event the
 * previous version of this paragraph forecast; it has now happened, and this
 * sentence records it rather than predicting it. `gen-enums`, `export-lbl` and
 * `import-lbl` did NOT return with it and no phase currently owns them, so the
 * next raise has no named date.
 */
const REAL_VERBS = ["coverage", "export-asm", "render-memmap"];

/**
 * The verbs the COMMENT-HYGIENE synthetic source below carries. Deliberately
 * separate from `REAL_VERBS`, and now separate BY CONSTRUCTION rather than by
 * coincidence: its two cases are names no dispatch switch in this tree has and
 * no skill file mentions.
 *
 * That is the correction plan 29-07 made when the real set narrowed to two. The
 * previous separation was accidental -- the two lists happened to differ
 * because the real switch had eight cases and the fixture seven -- and a
 * two-verb real set would have collapsed them onto each other, at which point
 * "editing a fixture to chase the real switch" becomes indistinguishable from
 * leaving it alone. The comment-hygiene fixture proves ONE property (a case
 * inside a comment is never parsed as a verb), and that property needs no real
 * verb name at all.
 */
const SYNTHETIC_FIXTURE_VERBS = ["alpha-verb", "beta-verb"];

/** Same file-set convention as `check-skill-tool-coverage.mjs`'s own
 * `walkSkills()`: every `.md`/`.mjs` file under `src/skills/`,
 * skipping symlinks and `node_modules`. Kept local rather than imported --
 * the CI script executes its whole check at import time, so importing it
 * from a test would re-run the live gate instead of letting this file
 * drive the shared module in isolation. */
function walkSkillFiles(dir: string, acc: string[] = []): string[] {
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
    if (entry.isDirectory()) walkSkillFiles(p, acc);
    else if (/\.(md|mjs)$/.test(entry.name)) acc.push(p);
  }
  return acc;
}

function realSkillTexts(): string[] {
  return walkSkillFiles(SKILLS_DIR).map((f) => readFileSync(f, "utf8"));
}

// A synthetic module carrying the SAME `switch (verb) { case "<verb>": ... }`
// shape `anno-cli.ts` uses, with one extra, real (non-commented) case -- the
// planted violation. `ghost-verb` is a verb name that will never exist in the
// real skill corpus, so `verbsMissingFromSkills()` reporting it is unambiguous
// evidence the guard fires on a genuinely new, undocumented verb.
//
// THE NEGATIVE CONTROL IS `render-memmap`, and it is load-bearing that this
// name is BOTH a verb the CLI still has AND one a real skill file really
// names: `src/skills/c64-program-recon/SKILL.md`, its
// `templates/memory-map.template.md` and `src/skills/c64-ram-capture/SKILL.md`
// all carry the literal `anno render-memmap` (the subcommand was renamed
// from `r2000` by plan 29-09, in the same commit as the skill prose and
// the proxy's own dispatch token). Plan 29-07 re-pointed this
// control off `export-asm`, which the same plan removed -- a control naming a
// verb that no longer exists proves nothing about a guard that only ever fires
// on verbs that do.
const PLANTED_VIOLATION_SRC = `
function dummyDispatch(verb) {
  switch (verb) {
    case "render-memmap":
      return 1;
    case "coverage":
      return 2;
    case "ghost-verb":
      return 3;
    default:
      return 0;
  }
}
`;

// Same shape, but one case is hidden inside a block comment and another
// inside a line comment -- neither must be counted as a verb.
const COMMENTED_OUT_CASE_SRC = `
function dummyDispatch(verb) {
  switch (verb) {
    case "alpha-verb":
      return 1;
    case "beta-verb":
      return 2;
    /* case "block-commented-ghost": return 3; */
    // case "line-commented-ghost":
    default:
      return 0;
  }
}
`;

test("real-source parse: anno-cli.ts's dispatch switch yields exactly the 3 known verbs, never 'default'", () => {
  const src = readFileSync(join(HERE, "anno-cli.ts"), "utf8");
  const verbs = parseAnnoCliVerbs(src);
  assert.deepEqual(verbs, [...REAL_VERBS].sort());
  assert.ok(!verbs.includes("default"), "the switch's own default: branch must never be parsed as a verb");
});

test("positive control: every real verb is named by at least one real skill file (the Task 1 property, restated mechanically)", () => {
  const src = readFileSync(join(HERE, "anno-cli.ts"), "utf8");
  const verbs = parseAnnoCliVerbs(src);
  const missing = verbsMissingFromSkills(verbs, realSkillTexts());
  assert.deepEqual(missing, [], `expected no verb missing from the real skill corpus, got: ${missing.join(", ")}`);
});

test("planted violation: an extra, genuinely new case is parsed and reported missing, while a real, documented verb is not", () => {
  const verbs = parseAnnoCliVerbs(PLANTED_VIOLATION_SRC);
  assert.equal(verbs.length, 3);
  assert.ok(verbs.includes("ghost-verb"), "the planted extra case must be parsed as a verb");

  const missing = verbsMissingFromSkills(verbs, realSkillTexts());
  assert.ok(missing.includes("ghost-verb"), "the guard must fire on a new, undocumented verb");
  assert.ok(!missing.includes("render-memmap"), "the guard must NOT fire on a verb that is genuinely documented");

  // Demonstration that this test is not vacuous itself: if the predicate
  // were stubbed to always report nothing missing, this assertion is what
  // would catch it -- recorded in the SUMMARY as the inversion check.
  const stubbedAlwaysEmpty = () => [] as string[];
  assert.notDeepEqual(stubbedAlwaysEmpty(), missing);
});

test("comment hygiene: a case hidden in a block comment or a line comment is never parsed as a verb", () => {
  const verbs = parseAnnoCliVerbs(COMMENTED_OUT_CASE_SRC);
  assert.deepEqual(verbs, [...SYNTHETIC_FIXTURE_VERBS].sort());
  assert.ok(!verbs.includes("block-commented-ghost"));
  assert.ok(!verbs.includes("line-commented-ghost"));
});

test("non-vacuity floor: ANNO_CLI_VERB_FLOOR matches the measured true count and the real parse meets it", () => {
  assert.equal(ANNO_CLI_VERB_FLOOR, 3);
  const src = readFileSync(join(HERE, "anno-cli.ts"), "utf8");
  const verbs = parseAnnoCliVerbs(src);
  assert.ok(verbs.length >= ANNO_CLI_VERB_FLOOR);
});

test("the CI script's live execution path: `node scripts/check-skill-tool-coverage.mjs` exits 0 with 'OK' in stdout", () => {
  assert.ok(existsSync(CI_SCRIPT), `expected the CI script to exist at ${CI_SCRIPT}`);
  const result = spawnSync(process.execPath, [CI_SCRIPT], { encoding: "utf8", cwd: ROOT });
  assert.equal(result.status, 0, `expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
  assert.match(result.stdout, /OK/);
  assert.match(result.stdout, /anno CLI verbs: \d+ parsed/);
});

// ---------------------------------------------------------------------------
// THE DOCUMENTED-STATUS GUARD (plan 30-06)
// ---------------------------------------------------------------------------
// WHY IT EXISTS. Six shipped files across two skill trees said `anno export-asm`
// was withdrawn and named a numbered phase for its return. The moment the verb
// landed, every one of those sentences was false, and NOTHING failed:
// `comment-phase-pointers.test.ts` scans shipped `.ts`/`.mts` COMMENTS for seven
// assignment shapes and reads no markdown at all, and `docs-dangling-refs.test.ts`'s
// FLOW-02 is deliberately scoped to shipped STRING and TEMPLATE LITERALS. A stale
// withdrawal claim in a `SKILL.md` is invisible to both. The sibling property --
// "a verb the CLI has is NAMED by at least one skill file" -- was already guarded
// above by `verbsMissingFromSkills()`; what was unguarded is the STATUS that
// naming carries. A playbook that names a live verb only to call it unavailable
// is worse than one that never mentions it: it actively stops an agent using a
// route that works.
//
// This guard lives HERE rather than in a new file because this is already the
// file that owns "what the verb set is", and it consumes `parseAnnoCliVerbs()`
// rather than re-listing verbs -- a hand-written verb list in a guard is the
// same defect FLOW-01 recorded, one layer up.

/**
 * Both skill trees. `installer/skills/` is GENERATED and GITIGNORED yet SHIPPED
 * in the published tarball (`git ls-files installer/skills` returns 0), so any
 * gate scoped to tracked files is structurally blind to the copy users actually
 * receive (REPOINT-02). Scanning only `src/skills/` would leave the shipped tree
 * unguarded for exactly as long as it takes someone to forget the sync.
 */
const SKILL_MARKDOWN_ROOTS = [join(ROOT, "src", "skills"), join(ROOT, "installer", "skills")] as const;

/**
 * The phrases that count as "this document says the verb is unavailable".
 * Derived from the wording ACTUALLY used in this tree, not invented:
 * `WITHDRAWN` and `withdrawn` are the dated-notice spelling every skill file
 * uses, and `does not exist` is the second half of the standing formula
 * ("it does not exist, and the invocation fails with an unknown-verb error").
 *
 * DO NOT WIDEN THIS LIST TO CATCH A HYPOTHETICAL PHRASING. Every phrase added
 * for a wording nobody has written yet moves this scan one step closer to a
 * substring search over English, at which point it reports the prose that
 * discusses the hazard as though it were the hazard -- and the first response
 * to that is an allowlist, which is how a guard stops being read.
 */
const WITHDRAWAL_PHRASES = ["WITHDRAWN", "withdrawn", "does not exist"] as const;

/**
 * The phrases that DISCHARGE a withdrawal claim in the same window.
 *
 * This is not a loophole, it is the property being measured. A dated withdrawal
 * notice must never be deleted -- deleting it erases the record that a
 * capability was missing and why -- so the correct state for a verb that WENT
 * AWAY AND CAME BACK is a paragraph that says both things. What is forbidden is
 * a paragraph that says the verb is withdrawn and stops there.
 *
 * All markers are PAST TENSE on purpose. `returns` (the forecast spelling this
 * plan repaired) must NOT discharge anything: "is WITHDRAWN and returns in a
 * later phase" is precisely the claim this guard exists to catch, and it is the
 * sentence the non-vacuity control below reinstates.
 *
 * A MARKER ONLY DISCHARGES A CLAIM ABOUT THE VERB IT IS IN A SENTENCE WITH
 * (30-REVIEW WR-11, fixed 2026-08-31). It used to be enough for a marker to
 * appear ANYWHERE in the paragraph, which made the bare word `returned` a
 * loophole: "the tool returned an error" or "the call returned nothing"
 * discharged a genuinely stale withdrawal claim several lines away. The
 * `WITHDRAWAL_PHRASES` side above is documented as deliberately narrow ("DO NOT
 * WIDEN THIS LIST"); the discharge side had no equivalent discipline, and it is
 * the direction that produces false NEGATIVES -- which is the failure mode this
 * whole guard exists to prevent. See `isDischargedFor()`.
 */
const RETURN_MARKERS = ["returned", "RETURNED", "came back", "has come back"] as const;

/**
 * True when a return marker and the `anno <verb>` mention are in the SAME
 * SENTENCE (30-REVIEW WR-11).
 *
 * "Same sentence" is expressed checkably as: some occurrence of some marker and
 * some occurrence of `anno <verb>` with NO sentence terminator in the text
 * between them. That is what turns the discharge from "this paragraph contains
 * an English word" into "this paragraph says THIS VERB came back", which is the
 * claim the guard actually needs.
 *
 * A CHARACTER RADIUS ALONE WOULD NOT DO. The real discharge in this tree reads
 * "was WITHDRAWN on 2026-08-29 and returned on 2026-08-31 as `anno
 * export-asm`" -- marker and verb about twenty characters apart -- but so
 * would "the call returned nothing. `anno export-asm` is WITHDRAWN", which must
 * NOT discharge. The sentence boundary is what separates them, and it is
 * planted as a control below.
 */
function isDischargedFor(block: string, verb: string): boolean {
  const needle = `anno ${verb}`;
  for (const marker of RETURN_MARKERS) {
    for (let mi = block.indexOf(marker); mi !== -1; mi = block.indexOf(marker, mi + 1)) {
      for (let vi = block.indexOf(needle); vi !== -1; vi = block.indexOf(needle, vi + 1)) {
        const from = mi < vi ? mi + marker.length : vi + needle.length;
        const to = mi < vi ? vi : mi;
        const between = block.slice(from, to);
        // `. ` and `.\n` are sentence ends; a bare `.` is not, so dates and
        // version numbers do not split a sentence.
        if (!/\.[\s]/.test(between)) return true;
      }
    }
  }
  return false;
}

/** A withdrawal claim this scan reports, with everything a reader needs to find it. */
interface WithdrawalClaim {
  readonly verb: string;
  readonly phrase: string;
  readonly excerpt: string;
}

/**
 * THE ONE PREDICATE. The real corpus scan and both planted controls call this
 * and nothing else, so there is exactly one definition of "this document says a
 * live verb is withdrawn" -- if the predicate is wrong, every caller is wrong
 * together and the controls say so.
 *
 * THE WINDOW IS THE MARKDOWN PARAGRAPH (a blank-line-delimited block, capped at
 * `PARAGRAPH_CAP` characters), because that is the unit a human reads a status
 * claim in. A fixed character radius was tried first and is wrong twice over:
 * markdown is hard-wrapped, so a radius large enough to span a wrapped sentence
 * also reaches into the next claim, while one small enough to stay inside a
 * sentence misses a claim split across two lines.
 *
 * A verb is located by the SAME spelling `verbsMissingFromSkills()` uses to
 * decide a skill file names it -- the literal `anno <verb>`. That is deliberate
 * and load-bearing: `coverage` is an ordinary English word this corpus uses
 * constantly ("full gameplay coverage", "byte-coverage census"), and a bare
 * name match would report those paragraphs for containing an unrelated
 * `withdrawn` several lines away.
 */
function withdrawalClaimsFor(markdown: string, verbs: readonly string[]): WithdrawalClaim[] {
  const PARAGRAPH_CAP = 4000;
  const claims: WithdrawalClaim[] = [];
  for (const paragraph of markdown.split(/\n[ \t]*\n/)) {
    const block = paragraph.slice(0, PARAGRAPH_CAP);
    const phrase = WITHDRAWAL_PHRASES.find((p) => block.includes(p));
    if (phrase === undefined) continue;
    for (const verb of verbs) {
      if (!block.includes(`anno ${verb}`)) continue;
      // PER-VERB, NOT PER-PARAGRAPH (30-REVIEW WR-11). The discharge check
      // moved inside this loop because it is a claim ABOUT A VERB: a paragraph
      // recording that `anno export-asm` came back says nothing about a
      // different verb it also mentions as withdrawn.
      if (isDischargedFor(block, verb)) continue;
      claims.push({ verb, phrase, excerpt: block.replace(/\s+/g, " ").trim().slice(0, 200) });
    }
  }
  return claims;
}

/** Every `*.md` under a skill tree. Same walk convention as `walkSkillFiles()`
 * above, narrowed to markdown: this guard is about what a HUMAN reads, and the
 * `.mjs` helper scripts carry no status prose. */
function walkSkillMarkdown(dir: string, acc: string[] = []): string[] {
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
    if (entry.isDirectory()) walkSkillMarkdown(p, acc);
    else if (entry.name.endsWith(".md")) acc.push(p);
  }
  return acc;
}

/** `src/skills/` -- the SOURCE tree, always present, never generated. */
const SKILL_MARKDOWN_SOURCE_ROOT = SKILL_MARKDOWN_ROOTS[0];
/** `installer/skills/` -- the GENERATED, gitignored, but SHIPPED tree. */
const SKILL_MARKDOWN_SHIPPED_ROOT = SKILL_MARKDOWN_ROOTS[1];

test("a verb the CLI actually dispatches is never documented as withdrawn, in either skill tree", () => {
  // THIS TEST NO LONGER REGENERATES `installer/skills/` (30-REVIEW WR-11,
  // fixed 2026-08-31). It used to spawn `sync-skills.mjs` with `cwd: ROOT`,
  // rebuilding the shipped tree as a SIDE EFFECT OF RUNNING THE TEST SUITE.
  // The tree is gitignored so nothing went red, but a test that writes into
  // the repository under test is a surprise for anyone running `npm test` and
  // makes test ordering matter. `scripts/check-skill-cli-invocations.mjs` is a
  // CI SCRIPT and may regenerate; a test may not.
  //
  // The shipped tree is still guarded, by a different route: it is scanned AS
  // IT IS ON DISK, and the companion test below asserts it is byte-identical
  // to the source tree. A stale shipped copy is then reported as a named sync
  // failure rather than silently papered over -- which is strictly more
  // information than regenerating gave.
  const verbs = parseAnnoCliVerbs(readFileSync(join(HERE, "anno-cli.ts"), "utf8"));
  assert.ok(verbs.length >= ANNO_CLI_VERB_FLOOR, "the verb parse itself is broken; this scan would be vacuous");

  const problems: string[] = [];
  let filesScanned = 0;
  for (const root of SKILL_MARKDOWN_ROOTS) {
    const files = walkSkillMarkdown(root);
    if (root === SKILL_MARKDOWN_SHIPPED_ROOT && files.length === 0) {
      // A fresh clone has never run the installer's prepack, so the generated
      // tree legitimately does not exist yet. Skipping it is safe ONLY because
      // it is a pure copy of the source tree, which was just scanned in full.
      continue;
    }
    // Non-vacuity, per root: a scan whose corpus silently shrank to zero
    // passes everything. The SOURCE root must always really have been read.
    assert.ok(files.length > 0, `no markdown found under ${root} -- the scanned set shrank to zero`);
    filesScanned += files.length;
    for (const file of files) {
      for (const claim of withdrawalClaimsFor(readFileSync(file, "utf8"), verbs)) {
        problems.push(
          `${file.slice(ROOT.length + 1)}: describes \`anno ${claim.verb}\` as unavailable ("${claim.phrase}") ` +
            `with no record that it came back -- a verb the CLI dispatches must not be documented as withdrawn. ` +
            `Paragraph: "${claim.excerpt}"`
        );
      }
    }
  }

  assert.ok(filesScanned >= 10, `expected the source skill tree scanned, got only ${filesScanned} markdown file(s)`);
  assert.deepEqual(problems, [], problems.join("\n"));
});

test("the shipped skill tree's markdown is byte-identical to the source tree's -- asserted, never regenerated (30-REVIEW WR-11)", () => {
  // The replacement for the sync-as-a-side-effect the test above used to do.
  // Reporting a stale shipped copy BY NAME is more useful than regenerating
  // it silently: regenerating hides the fact that somebody forgot, and hides
  // it in exactly the tree users receive.
  const shipped = walkSkillMarkdown(SKILL_MARKDOWN_SHIPPED_ROOT);
  if (shipped.length === 0) {
    // Nothing generated yet (fresh clone). Nothing to be out of sync WITH,
    // and the source tree is fully scanned above either way.
    return;
  }

  const source = walkSkillMarkdown(SKILL_MARKDOWN_SOURCE_ROOT);
  assert.ok(source.length > 0, "the source skill tree must exist for this comparison to mean anything");

  const rel = (root: string, p: string) => p.slice(root.length + 1);
  const sourceByRel = new Map(source.map((p) => [rel(SKILL_MARKDOWN_SOURCE_ROOT, p), p]));

  const drift: string[] = [];
  for (const shippedPath of shipped) {
    const key = rel(SKILL_MARKDOWN_SHIPPED_ROOT, shippedPath);
    const sourcePath = sourceByRel.get(key);
    if (sourcePath === undefined) {
      drift.push(`installer/skills/${key} has no counterpart under src/skills/ -- a removed or renamed skill file is lingering in the SHIPPED tree`);
      continue;
    }
    if (readFileSync(shippedPath, "utf8") !== readFileSync(sourcePath, "utf8")) {
      drift.push(`installer/skills/${key} differs from src/skills/${key}`);
    }
    sourceByRel.delete(key);
  }
  for (const key of sourceByRel.keys()) {
    drift.push(`src/skills/${key} is missing from the SHIPPED tree`);
  }

  assert.deepEqual(
    drift,
    [],
    "the shipped skill tree has drifted from its source. Run `node installer/scripts/sync-skills.mjs`.\n" + drift.join("\n"),
  );
});

test("planted violation: the same predicate reports a dispatched verb documented as withdrawn, and stays silent for one the CLI does not dispatch", () => {
  const verbs = parseAnnoCliVerbs(readFileSync(join(HERE, "anno-cli.ts"), "utf8"));

  // POSITIVE CONTROL -- the sentence this plan repaired, reinstated verbatim in
  // a synthetic document. If the predicate ever stops reporting this, the guard
  // has stopped guarding the exact defect it was built for.
  const bad = [
    "## Disassembly",
    "",
    "**Dated withdrawal, 2026-08-29 -- whole-program static disassembly is WITHDRAWN",
    "and returns in a later phase as `anno export-asm`, behind a real-ACME byte-diff",
    "oracle.** Do not reach for it here; it does not exist.",
  ].join("\n");
  const badClaims = withdrawalClaimsFor(bad, verbs);
  assert.equal(badClaims.length, 1, `expected exactly one claim, got ${JSON.stringify(badClaims)}`);
  assert.equal(badClaims[0]?.verb, "export-asm");

  // NEGATIVE CONTROL, DIRECTION 1 -- a verb the CLI does NOT dispatch, described
  // in the same withdrawn shape, is NOT reported. `export-lbl` is real history,
  // not an invented token: it was removed on 2026-08-29 and no phase currently
  // owns its return, so the skills legitimately describe it as withdrawn and
  // this guard must leave that alone. Without this direction the guard would
  // forbid the honest notices it depends on.
  const stillWithdrawn = "The `anno export-lbl` round trip is WITHDRAWN and does not exist on this surface.";
  assert.deepEqual(withdrawalClaimsFor(stillWithdrawn, verbs), []);

  // NEGATIVE CONTROL, DIRECTION 2 -- a dispatched verb whose paragraph records
  // BOTH the withdrawal and the return is not reported. A control that only ever
  // refuses is indistinguishable from one that is broken shut.
  const discharged =
    "Whole-program static disassembly was WITHDRAWN on 2026-08-29 and returned on 2026-08-31 as `anno export-asm`.";
  assert.deepEqual(withdrawalClaimsFor(discharged, verbs), []);
});

test("planted control: an UNRELATED `returned` does not discharge a stale withdrawal claim (30-REVIEW WR-11)", () => {
  const verbs = parseAnnoCliVerbs(readFileSync(join(HERE, "anno-cli.ts"), "utf8"));

  // THE LOOPHOLE, PLANTED. `RETURN_MARKERS` contains the bare word `returned`,
  // and the discharge used to fire if it appeared ANYWHERE in the paragraph.
  // Both of these paragraphs say a live verb is withdrawn and stop there; the
  // `returned` in each is about something else entirely. Before the fix both
  // were silently discharged -- a FALSE NEGATIVE, which is the failure mode
  // this guard exists to prevent.
  const loopholes = [
    "The tool returned an error. Whole-program static disassembly is WITHDRAWN; `anno export-asm` does not exist.",
    "The call returned nothing.\n`anno export-asm` is WITHDRAWN on this surface.",
    "`anno export-asm` is WITHDRAWN and does not exist. The probe returned no rows.",
  ];
  for (const markdown of loopholes) {
    const claims = withdrawalClaimsFor(markdown, verbs);
    assert.equal(
      claims.length,
      1,
      `an unrelated "returned" must not discharge a stale claim about a live verb; got ${JSON.stringify(claims)} for:\n${markdown}`,
    );
    assert.equal(claims[0]?.verb, "export-asm");
  }

  // PAIRED DIRECTION, so the tightening did not simply break the discharge:
  // a marker in the SAME SENTENCE as the verb still discharges. Three real
  // spellings, including one where the marker FOLLOWS the verb.
  const realDischarges = [
    "Whole-program static disassembly was WITHDRAWN on 2026-08-29 and returned on 2026-08-31 as `anno export-asm`.",
    "`anno export-asm` was WITHDRAWN in Phase 29 and came back in Phase 30.",
    "WITHDRAWN 2026-08-29; `anno export-asm` returned behind a real-ACME byte-diff oracle.",
  ];
  for (const markdown of realDischarges) {
    assert.deepEqual(
      withdrawalClaimsFor(markdown, verbs),
      [],
      `a genuine same-sentence discharge must still be honoured:\n${markdown}`,
    );
  }
});
