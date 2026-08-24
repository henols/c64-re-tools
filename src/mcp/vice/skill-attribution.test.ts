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
