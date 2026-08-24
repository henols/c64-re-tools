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
// "this file legitimately has nothing to attribute". Plan 19-01 seeds the
// registry with the one file it lands; plans 19-02 and 19-03 ADD ROWS as they
// absorb the remaining four procedures. Adding a row is the point of the
// registry, not a workaround.
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
// NON-VACUITY, three ways, because each covers a different way this file
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

/** FROZEN REGISTRY. One row per file in `src/skills/` that carries absorbed
 * upstream prose. Plan 19-01 seeds it with the routine-queue-walker; plans
 * 19-02 and 19-03 add a row each as they absorb the remaining four
 * procedures into `c64-program-recon` and `c64-memory-mapping`. A skill with
 * no absorbed content does NOT belong here and is NOT required to carry an
 * attribution header. */
const ABSORBED_FILES: readonly AbsorbedFile[] = [
  {
    destination: "src/skills/routine-queue-walker/SKILL.md",
    upstreamPath: ".agent/skills/r2000-analyze-program/SKILL.md",
  },
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

/** Isolates the attribution block: from the `ATTRIBUTION (ABS-02)` anchor up
 * to the closing HTML comment marker. CONTENT-anchored, never a line number.
 * Returns `null` when the anchor is absent, so a stripped or renamed header
 * FAILS the tests that depend on it rather than scanning an empty string. */
function attributionBlock(text: string): string | null {
  const m = text.match(/ATTRIBUTION \(ABS-02\)([\s\S]*?)-->/);
  return m ? m[1] : null;
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

test("the absorbed-file registry is non-empty and every row resolves", () => {
  // Rot guard 1: an emptied registry must FAIL, not pass vacuously.
  assert.ok(ABSORBED_FILES.length >= 1, "ABSORBED_FILES is empty -- an emptied registry cannot be allowed to pass");
  assert.ok(REQUIRED_HEADER_FIELDS.length === 6, "ABS-02 requires exactly six provenance fields");
  // Rot guard 2: a renamed file or a re-pathed manifest entry must FAIL.
  for (const row of ABSORBED_FILES) {
    assert.ok(existsSync(join(ROOT, row.destination)), `${row.destination}: registry row names a file that does not exist`);
    assert.ok(
      manifestEntryFor(row),
      `${row.destination}: registry row names upstream path "${row.upstreamPath}", which the manifest does not list`
    );
  }
});

test("every absorbed file carries all six provenance fields", () => {
  for (const row of ABSORBED_FILES) {
    const block = attributionBlock(readDestination(row));
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
    const block = attributionBlock(readDestination(row));
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
    const block = attributionBlock(readDestination(row));
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
