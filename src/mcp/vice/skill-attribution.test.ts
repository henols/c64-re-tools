// skill-attribution.test.ts -- ABS-02's mechanical half: the attribution
// chain from an absorbed skill file back to the pinned upstream commit.
//
// WHY THIS EXISTS: Phase 19 absorbs third-party prose (regenerator2000's
// analysis procedures, dual-licensed `MIT OR Apache-2.0`) into `src/skills/`,
// and those files ship inside the `@henols/c64-re-tools` tarball. The
// attribution therefore travels INSIDE each file -- a per-file header is the
// only mechanism that survives a consumer copying one playbook out of the
// package. A stripped, drifted or falsified header is a downstream licence
// defect, and prose defects do not announce themselves: nothing else in this
// repository would notice a header whose commit or digest quietly stopped
// matching the manifest it claims to come from.
//
// REGISTRY, NOT A SCAN (the `skill-consumer-paths.test.ts` discipline): the
// absorbed files are known, named and fixed in number at any given moment.
// A scan over `src/skills/` would say nothing, because a skill carrying NO
// absorbed content is not required to carry an attribution header at all --
// only a named registry can distinguish "this file must be attributed" from
// "this file legitimately has nothing to attribute". Plan 19-01 seeded the
// registry with the one file it landed; plan 19-02 ADDED ROWS for the
// remaining four procedures. Adding a row is the point of the registry, not a
// workaround.
//
// ONE ROW PER SOURCE PATH, NOT PER FILE (plan 19-02): two destination files
// each absorb TWO upstream procedures, with two different digests. A per-file
// header would have to claim one digest and be silent about — or wrong about —
// the other, so each absorbed procedure carries its own attribution block and
// each block is matched to its row by the source it names.
//
// PRESENCE **AND** ABSENCE, the two halves this file's analog insists on:
//   - PRESENCE, per registry row: all six header fields, the commit and
//     digest agreeing with the manifest by lowercase-hex string equality, and
//     the adaptation statement.
//   - ABSENCE, over the WHOLE `src/skills/` corpus: not one file may instruct
//     a reader to read a file inside the upstream repository's excluded
//     agent-skills directory. Those paths do not exist for anyone who
//     installed regenerator2000 from the crate (its `Cargo.toml` excludes
//     `.agent/**/*`), so an absorbed instruction to read one is a dangling
//     runtime dependency -- exactly what ABS-01 forbids.
//
// A THIRD HALF, added by plan 19-02: the DEFERRED-CAPABILITY check. FUT-01
// defers BASIC token decoding, and this project absorbed that procedure's
// text as reference-only material. A `description:` IS the trigger mechanism
// (ABS-03), so the deferral only holds mechanically if none of the deferred
// capability's trigger vocabulary reaches one. The section body may -- must --
// use those words; only descriptions are policed.
//
// NON-VACUITY, five ways, because each covers a different way this file
// could rot into a no-op:
//   1. The registry's own length is asserted non-zero, so an emptied registry
//      FAILS rather than passing with nothing to check.
//   2. Every registry row's destination file must exist and its manifest
//      entry must resolve -- a renamed file or a re-pathed manifest entry
//      degrades to a FAILURE, never to a silently-unchecked row.
//   3. The absence predicate is proven to BITE, on a planted violation held
//      in memory as a string. It is never written into `src/skills/` -- a
//      plant-and-revert against the real tree would leave the working tree
//      dirty between runs, and `skill-consumer-paths.test.ts` records that
//      same reasoning for the same reason.
//   4. The registry's length and its upstream-path SET are asserted equal to
//      the manifest's, so absorbing a sixth procedure without adding its row
//      FAILS instead of leaving an unattributed file unchecked.
//   5. The deferred-BASIC phrase set is asserted non-empty AND proven to bite
//      on a planted description, also held only in memory.
//
// WHAT NOT TO DO, named concretely:
//   - Do not replace the registry with a corpus scan for "files containing an
//     ATTRIBUTION block". That check is circular: a file whose header was
//     deleted stops matching and silently stops being checked.
//   - Do not import `hostpath.ts` or `containerpath.ts`. Every path here is
//     repo-side; `hostpath-consumers.test.ts` asserts the r2000-side modules
//     stay out of that tested consumer set.
//   - Do not `import()`, `require()`, `eval()` or spawn anything under
//     `src/skills/`. Skill content is untrusted first-party prose: it is read
//     as a string and matched, never executed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";

import { repoRoot } from "./repo-root.ts";
import { walkSkills } from "../../../scripts/lib/skill-corpus.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = repoRoot({ from: HERE });
const SKILLS_DIR = join(ROOT, "src/skills");
const MANIFEST_PATH = resolve(
  HERE,
  "../../../.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json"
);
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

interface AbsorbedFile {
  /** Repo-relative destination that carries the absorbed prose. */
  readonly destination: string;
  /** The upstream path it was absorbed from, as the manifest spells it. */
  readonly upstreamPath: string;
}

/** FROZEN REGISTRY. One row per ABSORBED SOURCE PATH -- NOT one row per
 * destination file. Plan 19-01 seeded it with the routine-queue-walker; plan
 * 19-02 added the remaining four, and two destination files now each carry
 * TWO absorbed procedures. That is why the row is keyed on the upstream path
 * and why `attributionBlockFor()` below selects a file's blocks by the source
 * they name: one attribution block per source path is the only honest shape
 * when one file incorporates two independently-digested upstream files, and a
 * per-file block would have to claim one of the two digests and lie about the
 * other. A skill with no absorbed content does NOT belong here and is NOT
 * required to carry an attribution header.
 *
 * The registry's LENGTH is asserted equal to the manifest's
 * `procedures.length` below, so a forgotten row fails instead of passing
 * silently. NOTE what that assertion is and is not: it is a RELATION against
 * the manifest, and nothing more. "Five procedures absorbed" is an exact
 * count fixed by ABS-01's own text and by the pinned manifest -- it is not a
 * growing census, and the equality cannot tell a right count from a merely
 * self-consistent one. Judging the count means reading the five destinations
 * in the manifest, which is a human's job, not this assertion's. */
const ABSORBED_FILES: readonly AbsorbedFile[] = [
  {
    destination: "src/skills/routine-queue-walker/SKILL.md",
    upstreamPath: ".agent/skills/r2000-analyze-program/SKILL.md",
  },
  {
    destination: "src/skills/c64-memory-mapping/SKILL.md",
    upstreamPath: ".agent/skills/r2000-analyze-blocks/SKILL.md",
  },
  {
    destination: "src/skills/c64-memory-mapping/SKILL.md",
    upstreamPath: ".agent/skills/r2000-analyze-symbol/SKILL.md",
  },
  {
    destination: "src/skills/c64-program-recon/SKILL.md",
    upstreamPath: ".agent/skills/r2000-analyze-routine/SKILL.md",
  },
  {
    destination: "src/skills/c64-program-recon/SKILL.md",
    upstreamPath: ".agent/skills/r2000-analyze-basic/SKILL.md",
  },
];

/** The BASIC-token trigger vocabulary, from upstream's own
 * `r2000-analyze-basic` description and its four "use this skill when the
 * user asks to" phrases. FUT-01 DEFERS that capability, and this project
 * absorbed the procedure text as reference-only material. A description is
 * literally the trigger mechanism (ABS-03), so the deferral only holds if
 * none of this vocabulary reaches one -- otherwise the deferred capability
 * fires and the skill claims something the milestone does not deliver.
 *
 * Matched case-insensitively against every `description:` frontmatter value
 * under `src/skills/`, and ONLY against those: the reference-only section's
 * BODY is allowed -- required, even -- to use these words, because a reader
 * consulting it needs them. The set's own length is asserted non-zero so an
 * emptied set cannot make the check vacuous. */
const DEFERRED_BASIC_TRIGGER_PHRASES: readonly string[] = [
  "basic token",
  "basic command",
  "basic line",
  "basic code",
  "basic pointer",
  "decode basic",
  "tokenised basic",
  "tokenized basic",
  "detokenise",
  "detokenize",
];

/** The six provenance fields ABS-02 requires, by their header label. Each
 * must be present in the attribution block, followed by a non-empty value.
 * The set's own length is asserted below so an emptied set cannot make the
 * per-field loop vacuous. */
const REQUIRED_HEADER_FIELDS: readonly string[] = [
  "Source repository:",
  "Source path:",
  "Pinned commit:",
  "Source sha256:",
  "Upstream licence:",
  "This project elects:",
];

/** The modification notice. Its presence is what makes the header's claim
 * honest for text that was adapted rather than copied verbatim -- and it is
 * the Apache-2.0 section 4(b) obligation discharged in-file, whichever of the
 * two dual-licence options a downstream reader takes this under. */
const ADAPTATION_STATEMENT = "ADAPTED, NOT VERBATIM.";

/** Every attribution block in a file: from each `ATTRIBUTION (ABS-02)` anchor
 * up to that block's own closing HTML comment marker. CONTENT-anchored, never
 * a line number. */
function attributionBlocks(text: string): string[] {
  return [...text.matchAll(/ATTRIBUTION \(ABS-02\)([\s\S]*?)-->/g)].map((m) => m[1]);
}

/** How a header names its own upstream source: the source FILE, without the
 * upstream repository's excluded agent-skills directory prefix. That prefix is
 * deliberately absent from every shipped skill file (see the ABSENCE half of
 * this file's header and the corpus test below); the full path lives once, in
 * the manifest under `.planning/`, which is not scanned. Derived FROM the
 * manifest path rather than hand-typed, so a re-pathed manifest entry cannot
 * drift away from what the headers say. */
function upstreamFileRef(upstreamPath: string): string {
  return upstreamPath.replace(/^.*[/\\]skills[/\\]/, "");
}

/** Isolates the ONE attribution block that names this row's upstream source.
 * Returns `null` when no block -- or more than one block -- names it, so a
 * stripped, renamed or ambiguous header FAILS the tests that depend on it
 * rather than being silently checked against a sibling procedure's digest.
 * This is what makes two absorbed procedures in ONE file safe: each row is
 * matched to its own header, and a header claiming the wrong source digest
 * cannot pass by sitting next to a correct one. */
function attributionBlockFor(text: string, row: AbsorbedFile): string | null {
  const ref = upstreamFileRef(row.upstreamPath);
  const matching = attributionBlocks(text).filter((b) => b.includes(ref));
  return matching.length === 1 ? matching[0] : null;
}

/** The ABSENCE predicate, pulled out as a named function so it can be handed
 * a planted string and proven to bite. True when `text` names a path inside
 * the upstream repository's excluded agent-skills directory. */
function namesUpstreamAgentSkillsPath(text: string): boolean {
  return /\.agent[/\\]skills/.test(text);
}

function readDestination(row: AbsorbedFile): string {
  return readFileSync(join(ROOT, row.destination), "utf8");
}

function manifestEntryFor(row: AbsorbedFile): { path: string; sha256: string } {
  return manifest.procedures.find((p: { path: string }) => p.path === row.upstreamPath);
}

// ===========================================================================
// THE NOTICES GUARD (plan 19-07) -- ABS-02's OTHER mechanical half: the
// elected licence's own inclusion condition, discharged by shipped text.
//
// WHY THIS EXISTS, and why it is a SEPARATE guard from everything above:
// the per-file `ATTRIBUTION (ABS-02)` headers policed above name the licence;
// they do not REPRODUCE it. MIT's own condition is that "the above copyright
// notice and this permission notice shall be included in all copies or
// substantial portions of the Software", and until 19-07 that condition was
// discharged nowhere -- the permission-notice text appeared in no shipped
// file. Worse, `src/mcp/vice/THIRD-PARTY-NOTICES.md` ASSERTED that the notice
// travelled inside every absorbed header and shipped in both published
// tarballs. Three independent falsifications: the text was absent; the
// headers carry the licence NAME only; and `@henols/vice-mcp` packs zero
// skill files, so no absorbed header ships in that tarball at all -- while
// the false claim itself did, packed, to consumers.
//
// So the obligation now lives in prose inside two published documents, and
// prose defects do not announce themselves. Nothing else in this repository
// would notice that notice text being deleted, re-wrapped, paraphrased, or
// transcribed from a secondary source. This guard is what notices.
//
// FOUR PROPERTIES, mirroring this file's presence-AND-absence discipline:
//   1. PRESENCE, per named file: every notices file that CLAIMS to
//      incorporate regenerator2000 prose reproduces the notice, and the
//      reproduction is byte-exact against the pinned upstream digest.
//   2. NON-VACUITY: the extraction predicate is proven to bite on planted
//      strings held ONLY in memory -- one that claims incorporation and
//      carries no notice, and one whose notice has a single word altered.
//   3. ABSENCE, scoped to the notices files: the falsified sentence cannot
//      return silently.
//   4. NON-VACUITY for the absence half: the forbidden set is non-empty and
//      its predicate is proven to bite on a planted string.
//
// EQUALITY IS BYTES, NOT PROSE. The presence check is a sha256 over the
// extracted fence content, not a substring match. That is the deliberate
// answer to "whose definition of equality applies": a notice that reads
// correctly but was re-wrapped, smart-quoted, or copied from `19-REVIEW.md`
// (whose own copy is ELIDED -- it literally contains a `... [full verbatim
// LICENSE-MIT text] ...` placeholder) FAILS here. Transcribing from the
// review document is the specific defect this digest catches.
//
// A NAMED LIST, NOT A GLOB, for the same reason the registry above is a
// registry: a notices file that claims nothing is not required to carry a
// notice, and only a named set can tell "must carry" from "legitimately has
// nothing to carry".
//
// THE ABSENCE CHECK IS SCOPED TO `NOTICES_FILES` AND MUST STAY SO. This test
// file necessarily contains the forbidden phrases as constants. A repo-wide
// grep would therefore either fail on its own guard or be weakened -- with a
// self-exclusion, a fuzzier pattern -- until it proved nothing. That
// weakening IS the rot; scoping is what prevents it.
//
// CONCURRENCY: this guard performs NO WRITE. It reads three files and hashes
// strings, so two concurrent runs cannot interleave into a false pass and an
// interrupted run leaves no partial state. The planted violations are
// in-memory strings, never a plant-and-revert against the real tree, so the
// working tree is never dirty between runs (the same reasoning the absence
// proof above records).

/** The notices files that ship or point at incorporated regenerator2000
 * prose. Repo-relative and resolved through `ROOT`, deliberately NOT a
 * `.planning/` path (WR-11 is deferred, and this plan must not add a new
 * instance of the archival fragility it names).
 *   - `src/mcp/vice/THIRD-PARTY-NOTICES.md` -- packed by `@henols/vice-mcp`.
 *   - `installer/THIRD-PARTY-NOTICES.md`    -- packed by `@henols/c64-re-tools`,
 *     the tarball that actually carries the absorbed `skills/` prose.
 *   - `THIRD-PARTY-NOTICES.md`              -- the repo-root pointer, never
 *     packed, but it makes the same incorporation claim on the repo page. */
const NOTICES_FILES: readonly string[] = [
  "src/mcp/vice/THIRD-PARTY-NOTICES.md",
  "installer/THIRD-PARTY-NOTICES.md",
  "THIRD-PARTY-NOTICES.md",
];

/** sha256 of regenerator2000's `LICENSE-MIT` at the pinned commit
 * `493f840418f1450a342bb220c2fe3d2585dd0525` -- 1072 bytes, LF line endings,
 * trailing newline included. Independently confirmed against the upstream
 * repository at authoring time (19-07 Task 1) by fetching the raw blob at
 * that immutable SHA, never at a branch. This constant is the transcription
 * check: it is what makes a paraphrased, re-wrapped or review-sourced notice
 * FAIL rather than read plausibly. */
const UPSTREAM_MIT_NOTICE_SHA256 = "e2579ce7a10784ea205270fc7775e75c07b283f7a5f6e1fdd31f20f8b8a4973b";

/** The byte count that accompanies the digest. A second, independent handle
 * on the same bytes: a truncated extraction that somehow collided on a prefix
 * still reports the wrong length, and the failure message can say so. */
const UPSTREAM_MIT_NOTICE_BYTES = 1072;

/** The heading under which every notices file reproduces the notice, and the
 * fence language it uses. Identical in all three files by construction, so
 * ONE extraction rule serves all three -- which is why Task 1 was required to
 * use the same heading and the same fence marker everywhere. */
const NOTICE_SECTION_HEADING = "## Upstream MIT permission notice (regenerator2000)";
const NOTICE_FENCE_OPEN = "```text";

/** How a notices file DECLARES that it incorporates regenerator2000 prose.
 *
 * Derived from the wording the incorporated-material heading already carries
 * (`## Incorporated material -- regenerator2000 analysis procedures (MIT OR
 * Apache-2.0)`) rather than from a marker invented here. The repo-root
 * pointer states the same claim as a bullet rather than a heading, so the
 * pattern is the shared PHRASE, not the whole heading.
 *
 * Deliberately NOT derived from `NOTICE_SECTION_HEADING`: keying the claim on
 * the notice section itself would make the presence test tautological -- a
 * file would "claim incorporation" exactly when it already carried the
 * notice, and deleting the notice would delete the obligation with it. The
 * claim and its discharge must be independent strings or the guard proves
 * nothing. */
const INCORPORATION_CLAIM_PATTERN = /regenerator2000 analysis procedures/;

/** Phrases from the sentence 19-07 Task 1 DELETED, transcribed from the real
 * prior text via `git show HEAD~1:src/mcp/vice/THIRD-PARTY-NOTICES.md` and
 * `git show HEAD~1:THIRD-PARTY-NOTICES.md`, not retyped from the plan.
 *
 * Each was false of the commit that shipped it. The first three come from
 * `src/mcp/vice/THIRD-PARTY-NOTICES.md`: the permission notice did not travel
 * inside any absorbed header (the headers name the licence, they do not
 * reproduce it), and it did not ship in BOTH tarballs, because `@henols/
 * vice-mcp` packs no skill file at all. The fourth is the repo-root pointer's
 * singular, unnamed version of the same claim -- unnamed being the defect:
 * only ONE of the two published tarballs packs the skill playbooks, and the
 * sentence has to say which.
 *
 * Listing them here converts "do not reintroduce this claim" from a review
 * comment into a test failure. Matched after whitespace normalisation so
 * re-wrapping the paragraph cannot smuggle a claim past the check. */
const FORBIDDEN_NOTICE_CLAIMS: readonly string[] = [
  "The MIT permission notice and copyright above travel inside every absorbed file's header, which is what ships in both published tarballs.",
  "travel inside every absorbed file's header",
  "ships in both published tarballs",
  "which travels inside the published tarball.",
];

/** Collapses every whitespace run to a single space, so a claim that is true
 * of the prose is caught however the paragraph happens to be wrapped. Applied
 * to the HAYSTACK and to the needles alike. */
function normaliseProse(text: string): string {
  return text.replace(/\s+/g, " ");
}

/** PREDICATE 1, pulled out as a named function so it can be handed a planted
 * string. True when `text` declares that it incorporates regenerator2000
 * analysis prose, and therefore owes the permission notice. */
function claimsIncorporation(text: string): boolean {
  return INCORPORATION_CLAIM_PATTERN.test(text);
}

/** PREDICATE 2. Returns the EXACT bytes of the reproduced notice -- the fence
 * body with its trailing newline restored -- or `null` when the section or
 * its fence is absent.
 *
 * CONTENT-anchored, never a line number, the same discipline
 * `attributionBlocks()` above follows. The search is bounded to the notice
 * section (up to the next `## ` heading) so a fence belonging to some LATER
 * section cannot be mistaken for the notice: a file with the heading but no
 * fence returns `null` rather than borrowing a neighbour's code block. */
function extractPermissionNotice(text: string): string | null {
  const headingAt = text.indexOf(NOTICE_SECTION_HEADING);
  if (headingAt === -1) return null;
  const after = text.slice(headingAt + NOTICE_SECTION_HEADING.length);
  const nextHeading = after.indexOf("\n## ");
  const section = nextHeading === -1 ? after : after.slice(0, nextHeading);
  const fenceAt = section.indexOf(`${NOTICE_FENCE_OPEN}\n`);
  if (fenceAt === -1) return null;
  const body = section.slice(fenceAt + NOTICE_FENCE_OPEN.length + 1);
  const closeAt = body.indexOf("\n```");
  if (closeAt === -1) return null;
  return `${body.slice(0, closeAt)}\n`;
}

/** PREDICATE 3, the absence half. Returns every forbidden claim `text`
 * carries, so the failure message can name which one came back rather than
 * only that one did. */
function forbiddenClaimsIn(text: string): string[] {
  const flat = normaliseProse(text);
  return FORBIDDEN_NOTICE_CLAIMS.filter((claim) => flat.includes(normaliseProse(claim)));
}

function readNotices(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf8");
}

test("the absorbed-file registry covers every manifest procedure and every row resolves", () => {
  // Rot guard 1: an emptied registry must FAIL, not pass vacuously.
  assert.ok(ABSORBED_FILES.length >= 1, "ABSORBED_FILES is empty -- an emptied registry cannot be allowed to pass");
  assert.ok(REQUIRED_HEADER_FIELDS.length === 6, "ABS-02 requires exactly six provenance fields");
  // Rot guard 4 (plan 19-02): the registry's length is a RELATION against the
  // manifest's own procedure count, so absorbing a procedure and forgetting
  // its row FAILS here instead of leaving an unattributed file unchecked.
  // Deliberately not a literal 5 -- see the registry's own comment for what
  // this equality does and does not prove.
  assert.equal(
    ABSORBED_FILES.length,
    manifest.procedures.length,
    `the registry has ${ABSORBED_FILES.length} rows but the manifest lists ${manifest.procedures.length} ` +
      `procedures -- every absorbed source path needs its own row and its own attribution block`
  );
  // ... and the row set must be the manifest's path set, not merely the same
  // size as it: two rows naming one path would satisfy a length check alone.
  assert.deepEqual(
    [...ABSORBED_FILES.map((r) => r.upstreamPath)].sort(),
    manifest.procedures.map((p: { path: string }) => p.path).sort(),
    "the registry's upstream-path set is not the manifest's procedure set"
  );
  // Rot guard 2: a renamed file or a re-pathed manifest entry must FAIL.
  for (const row of ABSORBED_FILES) {
    assert.ok(existsSync(join(ROOT, row.destination)), `${row.destination}: registry row names a file that does not exist`);
    assert.ok(
      manifestEntryFor(row),
      `${row.destination}: registry row names upstream path "${row.upstreamPath}", which the manifest does not list`
    );
    // Rot guard 5 (plan 19-02): with two absorbed procedures in one file, a
    // row must resolve to EXACTLY ONE block -- the one naming its own source.
    // Zero means a missing or misnamed header; more than one means two blocks
    // claim the same source and the digest check below would be ambiguous.
    const blocks = attributionBlocks(readDestination(row)).filter((b) => b.includes(upstreamFileRef(row.upstreamPath)));
    assert.equal(
      blocks.length,
      1,
      `${row.destination}: ${blocks.length} attribution blocks name "${upstreamFileRef(row.upstreamPath)}", expected exactly 1`
    );
  }
});

test("every absorbed file carries all six provenance fields", () => {
  for (const row of ABSORBED_FILES) {
    const block = attributionBlockFor(readDestination(row), row);
    assert.ok(block, `${row.destination}: no ATTRIBUTION (ABS-02) block found`);
    for (const field of REQUIRED_HEADER_FIELDS) {
      const idx = block.indexOf(field);
      assert.ok(idx >= 0, `${row.destination}: attribution header is missing the "${field}" field`);
      const rest = block.slice(idx + field.length);
      const value = rest.slice(0, rest.indexOf("\n") === -1 ? rest.length : rest.indexOf("\n")).trim();
      assert.ok(value.length > 0, `${row.destination}: attribution field "${field}" has an empty value`);
    }
  }
});

test("every absorbed file's commit and digest equal the manifest's, as lowercase hex", () => {
  for (const row of ABSORBED_FILES) {
    const block = attributionBlockFor(readDestination(row), row);
    assert.ok(block, `${row.destination}: no ATTRIBUTION (ABS-02) block found`);
    const entry = manifestEntryFor(row);

    const commits = block.match(/\b[0-9a-f]{40}\b/g) ?? [];
    assert.ok(commits.length > 0, `${row.destination}: attribution header carries no 40-hex commit`);
    for (const c of commits) {
      assert.equal(c, manifest.commit, `${row.destination}: header commit ${c} does not equal the manifest's ${manifest.commit}`);
    }

    const digests = block.match(/\b[0-9a-f]{64}\b/g) ?? [];
    assert.ok(digests.length > 0, `${row.destination}: attribution header carries no sha256 digest`);
    for (const d of digests) {
      assert.equal(
        d,
        entry.sha256,
        `${row.destination}: header digest ${d} does not equal the manifest's ${entry.sha256} for ${row.upstreamPath}`
      );
    }

    assert.ok(
      block.includes(manifest.repository),
      `${row.destination}: attribution header does not name the source repository ${manifest.repository}`
    );
    assert.ok(block.includes(manifest.licence), `${row.destination}: attribution header does not carry the upstream licence string`);
    assert.ok(
      block.includes(manifest.elected_licence),
      `${row.destination}: attribution header does not name the elected licence ${manifest.elected_licence}`
    );
  }
});

test("every absorbed file states that the text is adapted, not verbatim", () => {
  for (const row of ABSORBED_FILES) {
    const block = attributionBlockFor(readDestination(row), row);
    assert.ok(block, `${row.destination}: no ATTRIBUTION (ABS-02) block found`);
    assert.ok(
      block.includes(ADAPTATION_STATEMENT),
      `${row.destination}: attribution header omits "${ADAPTATION_STATEMENT}" -- claiming verbatim provenance for adapted text is its own honesty defect`
    );
    // A modification notice with no named modifications is decoration. The
    // deviations list must actually say something.
    const idx = block.indexOf(ADAPTATION_STATEMENT);
    assert.ok(
      block.slice(idx + ADAPTATION_STATEMENT.length).trim().length > 80,
      `${row.destination}: the adaptation statement names no deviations`
    );
  }
});

/** Pulls the `description:` value out of a SKILL.md's YAML frontmatter. The
 * frontmatter is the first `---`-delimited block and `description:` is a
 * single logical line in this repository's skills (asserted below by the
 * non-vacuity floor on how many descriptions were found at all). */
function skillDescription(text: string): string | null {
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return null;
  const m = fm[1].match(/^description:[ \t]*(.*)$/m);
  return m ? m[1].trim() : null;
}

test("the deferred BASIC capability cannot fire -- no description carries its trigger vocabulary", () => {
  // Non-vacuity for the phrase set itself: an emptied set must FAIL rather
  // than make the loop below check nothing.
  assert.ok(
    DEFERRED_BASIC_TRIGGER_PHRASES.length > 0,
    "DEFERRED_BASIC_TRIGGER_PHRASES is empty -- an emptied phrase set cannot be allowed to pass"
  );
  const skillMds = walkSkills(SKILLS_DIR).filter((f) => f.endsWith("SKILL.md"));
  // Non-vacuity for the corpus walk: a broken traversal must not read as a
  // clean inventory. A floor, never an equality -- the skill count grows.
  assert.ok(skillMds.length >= 6, `expected at least 6 SKILL.md files, found ${skillMds.length}`);
  const offenders: string[] = [];
  let described = 0;
  for (const file of skillMds) {
    const description = skillDescription(readFileSync(file, "utf8"));
    assert.ok(description, `${relative(ROOT, file)}: no description: value found in frontmatter`);
    described += 1;
    const lower = description.toLowerCase();
    for (const phrase of DEFERRED_BASIC_TRIGGER_PHRASES) {
      if (lower.includes(phrase)) offenders.push(`${relative(ROOT, file)}: "${phrase}"`);
    }
  }
  assert.equal(described, skillMds.length, "not every SKILL.md yielded a description to check");
  assert.deepEqual(
    offenders,
    [],
    `these descriptions carry BASIC-token trigger vocabulary for a capability FUT-01 defers, so the ` +
      `deferred capability would fire as a trigger: ${offenders.join(", ")}`
  );
});

test("the BASIC trigger-phrase predicate bites on a planted description", () => {
  // Rot guard: the check above passes on a clean corpus either because the
  // corpus is clean or because the predicate is broken. Plant the phrase in a
  // real description, IN MEMORY, and confirm it is caught. Nothing is written
  // under src/skills/ -- the working tree is never left dirty by this test.
  const reconPath = join(ROOT, "src/skills/c64-program-recon/SKILL.md");
  const clean = skillDescription(readFileSync(reconPath, "utf8"));
  assert.ok(clean, "c64-program-recon has no description to plant into");
  const planted = `${clean} Use when asked to decode basic commands from memory.`;
  const hits = DEFERRED_BASIC_TRIGGER_PHRASES.filter((p) => planted.toLowerCase().includes(p));
  assert.ok(hits.length > 0, "the planted BASIC trigger phrase was NOT reported -- this proof is vacuous");
  assert.equal(
    DEFERRED_BASIC_TRIGGER_PHRASES.filter((p) => clean.toLowerCase().includes(p)).length,
    0,
    "the real c64-program-recon description already carries BASIC trigger vocabulary"
  );
});

test("no file under src/skills/ tells a reader to read an upstream agent-skills path", () => {
  const files = walkSkills(SKILLS_DIR);
  // Non-vacuity for the walk itself: a broken traversal must not read as a
  // clean corpus.
  assert.ok(files.length >= 20, `expected the skills corpus walk to find at least 20 files, found ${files.length}`);
  const offenders: string[] = [];
  for (const file of files) {
    if (namesUpstreamAgentSkillsPath(readFileSync(file, "utf8"))) offenders.push(relative(ROOT, file));
  }
  assert.deepEqual(
    offenders,
    [],
    `these skill files name a path inside the upstream repository's excluded agent-skills directory, which no ` +
      `crate-installed reader has: ${offenders.join(", ")}`
  );
});

test("the absence predicate bites on a planted re-insertion", () => {
  // Rot guard 3: take the real absorbed file's text, plant the exact
  // instruction the absorption removed, and confirm the predicate reports
  // it. The plant lives only in memory -- nothing is written under
  // src/skills/, so the working tree is never left dirty by this test.
  const clean = readDestination(ABSORBED_FILES[0]);
  assert.equal(namesUpstreamAgentSkillsPath(clean), false, "the real file already names an upstream agent-skills path");
  const planted = clean.replace(
    "## Phase 1 — make sure blocks are classified",
    "## Phase 1 — make sure blocks are classified\n\n1. Read the skill file at `.agent/skills/r2000-analyze-blocks/SKILL.md`."
  );
  assert.notEqual(planted, clean, "the plant anchor was not found -- this proof would otherwise be vacuous");
  assert.equal(namesUpstreamAgentSkillsPath(planted), true, "the absence predicate did NOT report a planted upstream agent-skills path");
});

// --- THE NOTICES GUARD, tests (plan 19-07) ---------------------------------
// See the block comment beside `NOTICES_FILES` above for why this section
// exists, why the list is named rather than globbed, why equality is bytes,
// and why the absence half is scoped to `NOTICES_FILES` and must stay so.

test("every notices file that claims incorporation reproduces the upstream MIT permission notice byte-exactly", () => {
  // Rot guard: an emptied list must FAIL, not pass with nothing to check.
  assert.ok(
    NOTICES_FILES.length >= 1,
    "NOTICES_FILES is empty -- an emptied list cannot be allowed to pass vacuously"
  );

  const claiming: string[] = [];
  for (const relPath of NOTICES_FILES) {
    const full = join(ROOT, relPath);
    // A renamed or moved notices file must FAIL here, never degrade to a
    // silently-unchecked row.
    assert.ok(existsSync(full), `notices file ${relPath} does not exist -- the guard cannot check a missing file`);
    const text = readNotices(relPath);
    if (!claimsIncorporation(text)) continue;
    claiming.push(relPath);

    const notice = extractPermissionNotice(text);
    assert.ok(
      notice !== null,
      `${relPath} claims to incorporate regenerator2000 analysis procedures but carries no ` +
        `"${NOTICE_SECTION_HEADING}" section with a ${NOTICE_FENCE_OPEN} fence -- MIT's inclusion condition ` +
        `is asserted there and discharged nowhere`
    );
    const bytes = Buffer.byteLength(notice, "utf8");
    const digest = createHash("sha256").update(notice, "utf8").digest("hex");
    assert.equal(
      digest,
      UPSTREAM_MIT_NOTICE_SHA256,
      `${relPath}: the reproduced permission notice is ${bytes} bytes with sha256 ${digest}, expected ` +
        `${UPSTREAM_MIT_NOTICE_BYTES} bytes with sha256 ${UPSTREAM_MIT_NOTICE_SHA256} -- the notice must be the ` +
        `upstream LICENSE-MIT bytes at commit 493f840418f1450a342bb220c2fe3d2585dd0525, not a re-wrapped, ` +
        `paraphrased or review-sourced copy (19-REVIEW.md's own copy is ELIDED -- do not transcribe from it)`
    );
    assert.equal(bytes, UPSTREAM_MIT_NOTICE_BYTES, `${relPath}: notice is ${bytes} bytes, expected ${UPSTREAM_MIT_NOTICE_BYTES}`);
  }

  // A notices file quietly dropping its incorporation section must FAIL here
  // rather than remove itself from the check -- the failure mode a
  // claim-conditioned guard would otherwise have.
  assert.deepEqual(
    claiming,
    [...NOTICES_FILES],
    `expected all ${NOTICES_FILES.length} notices files to claim incorporation, got [${claiming.join(", ")}] -- ` +
      `a file that dropped its incorporation claim would otherwise exempt itself from the notice requirement`
  );
});

test("the permission-notice guard bites on a planted claiming file with no notice, and on a one-word-altered notice", () => {
  // Rot guard: both plants live ONLY in memory. Nothing is written to a real
  // notices file, so the working tree is never left dirty between runs and a
  // crashed run leaves no partial state to clean up.
  const real = readNotices(NOTICES_FILES[0]);
  assert.equal(claimsIncorporation(real), true, "the real notices file does not claim incorporation -- this proof would be vacuous");

  // Plant A: claims incorporation, carries no notice section at all.
  const withoutNotice = real.slice(0, real.indexOf(NOTICE_SECTION_HEADING));
  assert.notEqual(withoutNotice, real, "the notice-section anchor was not found -- this proof would otherwise be vacuous");
  assert.equal(claimsIncorporation(withoutNotice), true, "the plant must still claim incorporation, or it proves nothing");
  assert.equal(
    extractPermissionNotice(withoutNotice),
    null,
    "the extraction predicate did NOT report a claiming notices file with no permission-notice section"
  );

  // Plant B: the notice is present but ONE word differs. Byte equality is the
  // point -- a plausible-reading paraphrase must fail exactly as a missing
  // notice does.
  const altered = real.replace("Permission is hereby granted, free of charge", "Permission is hereby granted, free of cost");
  assert.notEqual(altered, real, "the one-word plant anchor was not found -- this proof would otherwise be vacuous");
  const alteredNotice = extractPermissionNotice(altered);
  assert.ok(alteredNotice !== null, "the altered plant should still yield a block; only its digest may differ");
  assert.notEqual(
    createHash("sha256").update(alteredNotice, "utf8").digest("hex"),
    UPSTREAM_MIT_NOTICE_SHA256,
    "a one-word-altered permission notice still matched the pinned upstream digest -- the transcription check is vacuous"
  );
});

test("no notices file carries a claim about the notice that this commit falsifies", () => {
  // SCOPED TO NOTICES_FILES, NEVER REPO-WIDE. This very file holds the
  // forbidden phrases as constants; a repo-wide scan would fail on its own
  // guard, and the reflex fix -- excluding this file, or fuzzing the pattern
  // -- weakens the check until it proves nothing. See the section comment.
  const offenders: string[] = [];
  for (const relPath of NOTICES_FILES) {
    for (const claim of forbiddenClaimsIn(readNotices(relPath))) {
      offenders.push(`${relPath}: "${claim}"`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `these notices files carry a claim about the permission notice that the repository falsifies -- the notice ` +
      `does NOT travel inside an absorbed file's header (headers name the licence, they do not reproduce it), and ` +
      `absorbed headers do NOT ship in both tarballs (@henols/vice-mcp packs zero skill files): ${offenders.join("; ")}`
  );
});

test("the forbidden-claim set is non-empty and its predicate bites on a planted string", () => {
  assert.ok(
    FORBIDDEN_NOTICE_CLAIMS.length >= 1,
    "FORBIDDEN_NOTICE_CLAIMS is empty -- an emptied set would make the absence test above vacuous"
  );
  // The plant is an in-memory string, and it is deliberately RE-WRAPPED
  // across lines: normalisation is what stops a reflowed paragraph from
  // smuggling the claim back in.
  const planted =
    "## Incorporated material -- regenerator2000 analysis procedures (MIT OR Apache-2.0)\n\n" +
    "The MIT permission notice and copyright above travel inside every\nabsorbed file's header, which is what\nships in both published tarballs.\n";
  const bites = forbiddenClaimsIn(planted);
  assert.ok(
    bites.length >= 1,
    "the forbidden-claim predicate did NOT report a planted re-wrapped copy of the deleted sentence"
  );
  assert.ok(
    bites.includes(FORBIDDEN_NOTICE_CLAIMS[0]),
    `the planted full sentence was not matched; predicate reported [${bites.join(", ")}]`
  );
  // ... and it must not fire on text that carries no claim, or "no offenders"
  // above would mean nothing.
  assert.deepEqual(forbiddenClaimsIn("nothing forbidden here"), [], "the predicate fired on innocent text");
});
