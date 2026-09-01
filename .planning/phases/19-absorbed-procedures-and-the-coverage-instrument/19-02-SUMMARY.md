---
phase: 19-absorbed-procedures-and-the-coverage-instrument
plan: 02
subsystem: testing
tags: [skills, licensing, attribution, third-party-notices, npm-packaging, the external analyser, fut-01]

# Dependency graph
requires:
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "plan 19-01's proven absorption chain — the attribution-header shape, skill-attribution.test.ts's frozen registry, the relation-based packaging pin, and the truthful incorporated-material section this plan's four rows flip"
  - phase: 11-anno-annotation-surface
    provides: "CURATED_ANNO_TOOLS / ANNO_TOOL_DEFINITIONS and ANNO_READ_REGION_MAX_BYTES in anno-tools.ts — the surface every absorbed step is written against"
provides:
  - "All five upstream analyze procedures absorbed at one pinned commit: analyze-blocks and analyze-symbol into c64-memory-mapping, analyze-routine and analyze-basic into c64-program-recon, joining 19-01's analyze-program"
  - "Five attribution blocks, one per SOURCE PATH — two skills now carry two blocks each, because two procedures with two digests cannot honestly share one header"
  - "The deferred BASIC capability readable but unfirable: a REFERENCE-ONLY section naming FUT-01, with a named non-empty trigger-phrase set asserted absent from every description and proven to bite"
  - "skill-attribution.test.ts registry length AND path set asserted against manifest.procedures — a forgotten row fails instead of passing silently"
  - "installer/THIRD-PARTY-NOTICES.md — the package that actually ships the absorbed prose to npm consumers now carries notices, asserted against its own packed file list"
affects: [19-03, 19-04, 19-05, phase-20-decompilation, phase-21-rebuild]

actuals:
  tokens: 16886
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "One attribution block per absorbed SOURCE PATH, selected by the source it names — not one per destination file"
    - "A deferred capability is held deferred mechanically by policing descriptions (the trigger mechanism) while leaving the section body free to use the vocabulary"
    - "A packed-payload assertion reads the tarball's own file list, never a repo path — mirrored from the sibling package rather than re-invented"

key-files:
  created:
    - installer/THIRD-PARTY-NOTICES.md
  modified:
    - src/skills/c64-memory-mapping/SKILL.md
    - src/skills/c64-program-recon/SKILL.md
    - src/mcp/vice/skill-attribution.test.ts
    - src/mcp/vice/THIRD-PARTY-NOTICES.md
    - installer/package.json
    - scripts/check-npm-packages.mjs

key-decisions:
  - "All five upstream analyze procedures are now absorbed, so ABS-01 and ABS-02 flip to Complete, reversing 19-01's deliberate rollback"
  - "One attribution block per SOURCE PATH, not per file: c64-memory-mapping and c64-program-recon each absorb two procedures with two different digests, and a single per-file header could only claim one of them"
  - "The bare disasm token is banned corpus-wide by check-skill-fork-honesty.mjs with its exemption count pinned at exactly 1, so absorbed read-region steps omit the view parameter and rely on its documented default rather than growing the exemption"
  - "19-01's resolution of the RESEARCH §5.4 conflict is followed unchanged: headers name the source FILE without the .agent/skills prefix, so all five are consistent and the ABS-01 absence grep stays at zero"
  - "The installer notices document points at the canonical inventory rather than restating it, so the two documents cannot drift into two competing inventories"

patterns-established:
  - "attributionBlockFor(text, row): a registry row resolves to EXACTLY ONE block — zero or two both FAIL, so a misattributed header cannot pass by sitting next to a correct one"
  - "A census assertion over an absorbed corpus is a relation against the manifest's own procedure count AND its path set, since a length check alone admits two rows naming one path"
  - "An omitted upstream call is named by bare verb, marked not-exposed, and pointed at the requirement that would supply its criterion — never left as an aspirational instruction"

requirements-completed: [ABS-01, ABS-02]

coverage:
  - id: D1
    description: "All five upstream analyze procedures are absorbed at the pinned commit into exactly the destinations the manifest records, and no absorbed step names a tool this project does not expose"
    requirement: ABS-01
    verification:
      - kind: integration
        ref: "node scripts/check-skill-tool-coverage.mjs (OK — 17 distinct anno_* names extracted across 7 skill directories, all curated; up from 13 before this plan)"
        status: pass
      - kind: integration
        ref: "node scripts/check-skill-fork-honesty.mjs (OK — 31 files in 7 skill directories, all section-scoped-compliant)"
        status: pass
      - kind: other
        ref: "grep -ro over src/skills/ for each of anno_toggle_splitter, anno_undo, anno_set_immediate_format, anno_unpack_binary, anno_get_disassembly_cursor — all return 0; grep -rl '\\.agent/skills' src/skills/ returns 0 files"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/skill-attribution.test.ts#no file under src/skills/ tells a reader to read an upstream agent-skills path"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every absorbed source path carries its own six-field attribution block whose commit and digest equal the manifest's, and the registry length and path set are asserted against manifest.procedures so a forgotten row fails"
    requirement: ABS-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/skill-attribution.test.ts (8 tests, all pass; deleting the analyze-basic row exits 1 with 'the registry has 4 rows but the manifest lists 5 procedures', then restored)"
        status: pass
      - kind: other
        ref: "grep -c of each of the four new sha256 digests in its own destination file — 3fad6193…/d57d9c2f… in c64-memory-mapping, 6fd26337…/8fc662ce… in c64-program-recon, each exactly 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "The absorbed BASIC-token material is marked REFERENCE-ONLY with its capability deferred under FUT-01, and none of its trigger phrases appear in any skill's description frontmatter, so it can never fire"
    requirement: ABS-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/skill-attribution.test.ts#the deferred BASIC capability cannot fire -- no description carries its trigger vocabulary"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/skill-attribution.test.ts#the BASIC trigger-phrase predicate bites on a planted description"
        status: pass
      - kind: other
        ref: "git diff 87e3dc4 -- src/skills | grep -c '^[+-]description:' returns 0 — every description is byte-identical to its 19-01 state, so 19-05 measures a stable corpus"
        status: pass
    human_judgment: false
  - id: D4
    description: "The @henols/c64-re-tools tarball ships a third-party notices file, asserted against the packed file list rather than a repo path"
    requirement: ABS-02
    verification:
      - kind: integration
        ref: "node scripts/check-npm-packages.mjs (OK — @henols/c64-re-tools 33 files, 7 skills; removing the files[] entry exits 1 with 'installer: missing THIRD-PARTY-NOTICES.md -- ABS-02 …', then restored)"
        status: pass
      - kind: other
        ref: "node -e \"process.exit(require('./installer/package.json').files.includes('THIRD-PARTY-NOTICES.md')?0:1)\" exits 0; git status --porcelain installer/skills is empty"
        status: pass
    human_judgment: false
  - id: D5
    description: "The two notices documents together publish a true, non-competing licence claim for the absorbed prose in both tarballs: MIT elected from the dual licence, all five paths, ADAPTED-NOT-VERBATIM, per-file digests left to the per-file headers"
    requirement: ABS-02
    verification:
      - kind: other
        ref: "All five 'Incorporated as of this commit' rows in src/mcp/vice/THIRD-PARTY-NOTICES.md read yes; installer/THIRD-PARTY-NOTICES.md carries 'MIT OR Apache-2.0', the 40-hex pin and all five source paths"
        status: pass
    human_judgment: true
    rationale: "A licence election published in two npm tarballs is a legal claim, not a test outcome — the same judgment 19-01's D3 reserved for a human. The mechanical checks prove the strings are present and agree with the manifest; whether the election, the adaptation statement and the split between the two documents are the right ones to publish is a human call."

# Metrics
duration: 38 min
completed: 2026-08-24
status: complete
---

# Phase 19 Plan 02: Absorb the Remaining Four Procedures Summary

**All five upstream analyze procedures are now absorbed at one pinned commit — `analyze-blocks` and `analyze-symbol` into `c64-memory-mapping`, `analyze-routine` and a deferred REFERENCE-ONLY `analyze-basic` into `c64-program-recon` — with one attribution block per source path rather than per file, a registry asserted equal to the manifest's own procedure set, a BASIC trigger vocabulary proven absent from every description, and the tarball that actually ships the prose finally carrying a notices document asserted against its own packed payload.**

## Performance

- **Duration:** ~38 min
- **Started:** 2026-08-24T16:20Z (approx.)
- **Completed:** 2026-08-24T16:58Z
- **Tasks:** 2 of 2
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments

- **Four procedures absorbed into the two skills that already own their jobs.** `c64-memory-mapping` gains region classification (the four-pass order, the eight data kinds with their recognition heuristics, and upstream's most-dangerous-mistake rule carried in substance: never disassemble without a `JSR`/`JMP` target, a branch target, a vector-table entry or explicit human confirmation, because random data routinely disassembles into plausible instruction sequences) and symbol-purpose analysis (cross-reference-driven classification, the eight naming conventions, the zero-page rule). `c64-program-recon` gains the per-routine procedure (bounds, range read, callers, data usage, the exact separator comment-block format) and the BASIC material as reference only.
- **Every omitted upstream call is named honestly and pointed at its criterion, never left aspirational.** `undo` collapses to "set the correct type again" (`anno_set_data_type` is idempotent over a range). The table-boundary marker is carried as a *dated limitation* — adjacent same-type tables merge, the block listing respects markers, expect a systematic over-merge bias in any count taken from the store — with the forward pointer to `DECOMP-01`/`BUILD-02`. The low/high-byte immediate formatter is named by bare verb in both procedures that use it, marked not exposed, and tied to `BUILD-03`, with a hand-reconstruction workaround so the pointer is still readable today. Every cursor-based entry route becomes explicit address input.
- **The deferred capability is readable but unfirable.** The BASIC section opens by stating the capability is deferred under `FUT-01` and why (commercial titles captured post-loader reduce to a one-line `SYS` stub). A named, non-empty ten-phrase trigger set is asserted absent from every `description:` under `src/skills/`, the set's own length is asserted non-zero, and the predicate is proven to bite on a planted description held in memory. The section *body* is deliberately free to use the vocabulary — only descriptions are policed, because descriptions are the trigger mechanism.
- **The attribution guard now handles two procedures in one file.** A registry row is keyed on the upstream source path, and `attributionBlockFor()` resolves it to **exactly one** block by the source that block names — zero or two both fail. The registry's length *and* its upstream-path set are asserted equal to `manifest.procedures`, so neither a forgotten row nor two rows naming one path passes.
- **The installer package finally carries notices.** `@henols/c64-re-tools` is the tarball that delivers the absorbed prose to npm consumers and shipped no notices file at all. It now carries one, named in `files[]`, asserted against the tarball's own packed file list, with a comment recording why a repo-path check would pass on a package that omits the file.

## Task Commits

Each task was committed atomically:

1. **Task 1: Absorb the remaining four procedures into the two skills that own their jobs** — `17c4360` (feat)
2. **Task 2: Make the package that ships the absorbed prose carry a notices document** — `6763774` (feat)

## Files Created/Modified

**Created**
- `installer/THIRD-PARTY-NOTICES.md` — the notices document for the package that ships the absorbed prose: MIT host, the 40-hex pin with its date and tag, all five upstream source paths, the dual licence with its copyright line, the MIT election and its reasoning, ADAPTED-NOT-VERBATIM, and a pointer to the canonical inventory

**Modified**
- `src/skills/c64-memory-mapping/SKILL.md` — two attribution blocks and two absorbed sections (region classification; what a symbol in the store represents)
- `src/skills/c64-program-recon/SKILL.md` — two attribution blocks, the per-routine procedure, and the REFERENCE-ONLY BASIC section
- `src/mcp/vice/skill-attribution.test.ts` — five-row registry keyed on source path, per-row block isolation, manifest length/set relation, the BASIC-description guard and its bite proof
- `src/mcp/vice/THIRD-PARTY-NOTICES.md` — all five incorporation rows flipped to yes, plus a note explaining why two destinations appear twice
- `installer/package.json` — `THIRD-PARTY-NOTICES.md` added to `files[]`
- `scripts/check-npm-packages.mjs` — the installer notices assertion, read from the packed list

## Decisions Made

1. **One attribution block per source path, not per file.** Two destination files each absorb two procedures with two different digests. A per-file header would have to claim one digest and be silent about — or wrong about — the other, which is the honesty defect the whole attribution chain exists to prevent. The test was extended to match each row to the block naming its own source, and to fail on zero *or* two matches.
2. **19-01's resolution of the RESEARCH §5.4 conflict is followed unchanged.** RESEARCH's example header spells the literal upstream `.agent/skills/…` path, but the plan's own acceptance criterion requires `grep -c '\.agent/skills' src/skills/` to return 0. As 19-01 recorded, the criterion governs: all five headers name the source *file* (`analyze-blocks/SKILL.md`) and state that it sits in the upstream repository's excluded agent-skills directory, with the full path recorded once in the manifest under `.planning/`, which is not scanned. Following the same resolution keeps all five headers consistent, and the test derives the expected reference *from* the manifest path rather than hand-typing it, so a re-pathed manifest entry cannot drift away from the headers.
3. **ABS-01 and ABS-02 flip to Complete.** 19-01 rolled them back deliberately, because ABS-01 reads "**the five** upstream analyze procedures are absorbed" and one had been. Five now are, all attributed, with the guards green. Leaving them Pending would understate the tree exactly as leaving them Complete overstated it before.
4. **The installer notices document points rather than restates.** It records what ships *in that package* and defers to `src/mcp/vice/THIRD-PARTY-NOTICES.md` for the full inventory, so the two cannot drift into two competing inventories. The cc65 and ACME provenance is deliberately absent — neither ships there. Per-file sha256 digests are also deliberately absent: the per-file header travels with a playbook even when a consumer copies one out of the package, which is the case a notices document cannot cover.
5. **The `disasm` enum value is described rather than named.** See the deviation below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Absorbed prose tripped the corpus-wide `disasm` token ban**

- **Found during:** Task 1, at the acceptance-criteria gate
- **Issue:** `check-skill-fork-honesty.mjs` fails on a bare `disasm` verb token anywhere under `src/skills/` — plan 10-06 deleted `acme.mjs`'s `disasm` dispatch entry, and a playbook advertising it sends an agent into an unknown-verb failure. The absorbed read-region steps wrote `view: "disasm"`, which is a legitimate value of `anno_read_region`'s `view` enum but the same token. Two sites: `c64-memory-mapping/SKILL.md:330` and `c64-program-recon/SKILL.md:338`.
- **Fix:** Reworded both to omit the `view` parameter and name its documented default instead — the tool's own description records that omitting `view` is identical to the disassembly view, confirmed live against the real binary — so the instruction stays fully executable. The checker's single line exemption was **not** grown: its header records the exemption count as pinned at exactly one, and `exemptionHits === 1` is asserted, so adding a second would have weakened a guard to accommodate new prose.
- **Files modified:** `src/skills/c64-memory-mapping/SKILL.md`, `src/skills/c64-program-recon/SKILL.md`
- **Verification:** `node scripts/check-skill-fork-honesty.mjs` exits 0
- **Committed in:** `17c4360` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Flipped four incorporation rows in the canonical notices file**

- **Found during:** Task 1, before committing
- **Issue:** 19-01 added an "Incorporated as of this commit" column so the notices section would be true at every intermediate commit of the phase, with four rows reading "no — scheduled within Phase 19" and the explicit expectation that later plans flip their own. Committing four absorbed procedures while the shipped notices file still said they were not incorporated would have published a claim the tree falsifies — the same defect class the plan's own prohibitions name.
- **Fix:** All five rows now read **yes**, the total line records which plan landed which, and a new paragraph explains why two destinations appear twice in the table (two procedures each, two headers each) so a reader does not read the repeat as a duplicate row.
- **Files modified:** `src/mcp/vice/THIRD-PARTY-NOTICES.md`
- **Verification:** `grep -c 'scheduled within Phase 19'` returns 0; `node scripts/check-npm-packages.mjs` exits 0
- **Committed in:** `17c4360` (Task 1 commit)

**3. [Rule 2 - Missing Critical] Asserted the registry's path SET, not only its length**

- **Found during:** Task 1(e)
- **Issue:** The plan asks for the registry length to equal `manifest.procedures.length`. A length check alone is satisfied by five rows naming four distinct paths with one duplicated — which is exactly the mistake most likely to be made when adding four rows at once, and it would leave one procedure entirely unattributed while the count read correct.
- **Fix:** Added a sorted `deepEqual` between the registry's upstream-path set and the manifest's procedure-path set, alongside the length equality.
- **Files modified:** `src/mcp/vice/skill-attribution.test.ts`
- **Verification:** 8/8 tests pass; deleting a row fails with the length message, and the set assertion covers the duplicate case the length one does not
- **Committed in:** `17c4360` (Task 1 commit)

**4. [Rule 1 - Bug] Corrected stale STATE.md prose**

- **Found during:** State updates
- **Issue:** STATE.md's "Current focus" read "Phase 19 has four plans, and Plan 19-01 has begun". The phase has five plans and two are now executed.
- **Fix:** Rewritten to the true count and position.
- **Files modified:** `.planning/STATE.md`
- **Verification:** Read back
- **Committed in:** the plan-metadata commit

---

**Total deviations:** 4 auto-fixed (1 bug, 1 blocking, 2 missing critical)
**Impact on plan:** All four were needed for the plan's own acceptance criteria or for the honesty of a shipped claim. No scope creep; nothing was added that the plan did not ask for, and no guard was weakened to accommodate new prose.

## Issues Encountered

- The `disasm` token ban (deviation 1) was the only genuine blocker. It is worth recording as a standing constraint for anyone absorbing more upstream prose: `anno_read_region`'s `view` enum contains a value this repository's skill corpus is not allowed to spell, and the correct answer is to describe the default rather than to grow a pinned exemption.
- `gsd-tools query state.add-decision --summary-file` rejects any path outside the repository, so the scratchpad route fails silently-ish (`added: false` with a reason). Repo-local temp files work.
- 19-01's unreproduced one-test flake did **not** recur: the full suite ran once, clean, at 2472/2427/0.

## Baseline vs. final test counts

| | Tests | Pass | Fail | Skipped | Todo |
|---|---|---|---|---|---|
| After plan 19-01 | 2470 | 2425 | 0 | 40 | 5 |
| After this plan | 2472 | 2427 | 0 | 40 | 5 |

The +2 tests are the two new ones in `skill-attribution.test.ts` (the BASIC
description guard and its bite proof). The other new assertions landed inside
existing tests. Verified with the **full** `npm test`, never the automated
subset.

## Known Stubs

None. Both absorbed skills are complete prose with no placeholder sections. The
one section that *reads* like a stub — the REFERENCE-ONLY BASIC material — is
not one: it carries the full line anatomy, the complete V2 keyword token table
and the write sequence, and it is explicitly labelled as deferred capability
rather than unfinished work, with the deferral's requirement ID named in its
first line and enforced mechanically against every description.

Two forward references are prose naming documented future steps, not unwired
code paths: the adjacent-table limitation points at Phase 20/21, and the
pointer-formatting note points at `BUILD-03`. Both name the requirement that
would supply the criterion, per the plan's own `values` prohibition.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema at a
trust boundary. The five surfaces this plan touches are all covered by its own
`<threat_model>`: T-19-07 (four new absorbed sections — mitigated, one block per
source path with the registry length *and* set asserted against the manifest),
T-19-08 (the installer tarball — mitigated, notices added to `files[]` and the
assertion proven to fire by removing the entry), T-19-09 (a step naming an
unexposed tool — mitigated, all five non-curated names verified absent and no
allowlist added to the checker), T-19-10 (the deferred BASIC capability firing —
mitigated, non-empty phrase set asserted absent from every description and
proven to bite), T-19-11 (packed contents — `assertLeanTarball()` still runs
from inside the one packing seam and the packed-package set is still pinned to
two).

## User Setup Required

None — no external service configuration required. `ANNO_UPSTREAM_CLONE`
remains the optional opt-in for the audit test's live re-hash; this plan
re-verified all five digests against `~/.cache/c64-re-tools/external-analyser-pin`
at `493f840418f1450a342bb220c2fe3d2585dd0525` before absorbing anything.

## Next Phase Readiness

- **19-03** (the coverage instrument) is unblocked and independent of this plan.
- **19-04** inherits the adjacent-table limitation as a *named* bias to report
  rather than a surprise: any count taken from the block store systematically
  over-merges adjacent same-type tables, and the absorbed section says so.
- **19-05** (ABS-03 description overlap) measures a **stable corpus**: every
  `description:` under `src/skills/` is byte-identical to its 19-01 state, which
  was this plan's explicit constraint. It also inherits three trigger fights
  already resolved in section headings and bodies — symbol-purpose versus
  address lookup, static versus live code-versus-data, and per-routine work
  versus queue orchestration — so the frontmatter sharpening it owns starts from
  prose that already separates the jobs.
- **Phase 20/21** inherit two now-criterion-bearing future-surface proposals
  named in shipped playbook prose as well as in the manifest: the table splitter
  (`DECOMP-01`, `BUILD-02`) and the immediate formatter (`BUILD-03`).
- **No blockers.**

---
*Phase: 19-absorbed-procedures-and-the-coverage-instrument*
*Completed: 2026-08-24*

## Self-Check: PASSED

Both files named in `key-files.created`/the SUMMARY path exist on disk
(`installer/THIRD-PARTY-NOTICES.md`, `19-02-SUMMARY.md`), and all three commits
resolve in `git log`: `17c4360` (Task 1), `6763774` (Task 2), `5013f39` (plan
metadata). ROADMAP.md's Phase 19 row reads `2/5`.
