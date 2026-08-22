---
phase: 15-debt-and-review-disposition
plan: 06
subsystem: docs
tags: [c64-ram-capture, skill-playbook, releases-json, project-paths, drive-type, debt-disposition]

requires:
  - phase: 15-debt-and-review-disposition
    provides: "plan 15-05's disposition work and the phase's shared docs-deferred-ledger.test.ts / docs-review-disposition.test.ts guards"
provides:
  - "c64-ram-capture/SKILL.md documents, at the point of use: the broker's automatic drive-type configuration (closing note inside '## Boot a disk'), the C64RE_PROJECT_ROOT-then-.git project-root resolution order (prerequisite paragraph before '## The order', plus a Troubleshooting row), and RELEASES.json's full schema (new '## Release registry shape' section before '## References')"
  - "RELEASES.json.example ships in the skill's own directory, parses as JSON, and is present in the published @henols/c64-re-tools tarball"
  - "Three of DEBT-02's five named behaviours closed with cited, file-and-heading Resolutions; the other two (vice_ping's misleading resolvedBinaryPath, the warp-over-resource_set claim) remain for plan 15-09"
affects: [15-09, 15-11, 15-12]

actuals:
  tokens: 4250
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Point-of-use documentation placement verified by a first-time-reader walk (Task 3): rather than assuming a prerequisite/closing-note/reference-table lands correctly once written, the plan's own acceptance criteria and this task re-read the file as three concrete user journeys and cite the line number each lands on, before declaring the placement correct."
    - "Grep-verified doc claims in both directions: every field named in the new '## Release registry shape' table was confirmed present in releases.mjs's own source before being written down, and every field releases.mjs consumes (schema_version, schema_notes, releases, id, canonical, disk_image, dumps) is confirmed present in the doc — same bidirectional-grep discipline this phase's code-level pins (plan 15-05) already established for source claims."

key-files:
  created:
    - .claude/skills/c64-ram-capture/RELEASES.json.example
  modified:
    - .claude/skills/c64-ram-capture/SKILL.md
    - .planning/todos/completed/2026-08-19-drive-type-prerequisite-undocumented-in-readme-and-skill.md (moved from pending/)
    - .planning/todos/completed/2026-08-19-project-paths-git-marker-requirement-undocumented.md (moved from pending/)
    - .planning/todos/completed/2026-08-19-releases-json-schema-undocumented.md (moved from pending/)
    - .planning/STATE.md

key-decisions:
  - "Re-verified the plan's own premise before writing anything: a grep for every one of the three gaps' key terms (drive/drive8type, C64RE_PROJECT_ROOT/project root/git init, RELEASES.json/schema_version/schema_notes) across both README.md and SKILL.md returned nothing in all three cases, confirming the plan's 'silent in both files' claim rather than assuming it."
  - "Confirmed buildViceArgs()'s stock branch (broker-launch.mts:202) sets -drive8type 1541 unconditionally for every stock launch, not gated on disk-vs-bare-.prg -- the one narrowing caveat is the pre-existing VICE_ARGS/viceArgsEnv full-argv override (broker-launch.mts:163-166), which is an operator override of the whole launch line, not a drive-setup condition, and does not weaken the todo's claim."
  - "dumps' per-entry shape (label, range_manifest) is documented as informational, sourced from scripts/watch-loads.mjs -- a different reader than releases.mjs -- rather than claimed as part of releases.mjs's own contract, since releases.mjs itself imposes no per-entry schema beyond reading .length."
  - "Troubleshooting row for the project-root throw quotes the message's real prefix as a plain grep-matchable substring rather than the literal backtick-delimited fragment, since embedding raw backticks inside an inline-code-span table cell breaks CommonMark; the exact substring 'could not locate the project root -- no `.git` found above' is verified present in both SKILL.md and project-paths.mjs by direct grep -qF."

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "DEBT-02 item 1: the broker's automatic drive-type configuration is documented inside c64-ram-capture/SKILL.md's '## Boot a disk' procedure (line 87-88), not a README changelog entry -- a user following the disk-boot steps reads it before the keyboard-typed fallback paragraph."
    requirement: null
    verification:
      - kind: other
        ref: "grep -c 'drive' inside '## Boot a disk' section (awk range) returns 1; buildViceArgs() stock branch confirmed unconditional at broker-launch.mts:202"
        status: pass
    human_judgment: true
    rationale: "Placement (whether a user 'would actually look' here) is a judgment call named explicitly as manual-only in 15-VALIDATION.md; Task 3's first-time-reader walk records the citation but is not itself an automated assertion."
  - id: D2
    description: "DEBT-02 item 2: a prerequisite paragraph before '## The order' states the real C64RE_PROJECT_ROOT-then-.git resolution order, plus a Troubleshooting row quoting the real throw text verbatim from project-paths.mjs."
    requirement: null
    verification:
      - kind: other
        ref: "grep -c 'C64RE_PROJECT_ROOT' SKILL.md >= 2; grep -c 'git init' SKILL.md >= 1; line(C64RE_PROJECT_ROOT) < line('## The order'); grep -qF of the shared throw-message substring passes in both SKILL.md and project-paths.mjs"
        status: pass
    human_judgment: true
    rationale: "Same placement-is-a-judgment-call reasoning as D1; the automated checks prove the text exists and precedes the heading, not that a first-time reader would actually stop there before failing."
  - id: D3
    description: "DEBT-02 item 3: RELEASES.json's full schema documented in a new '## Release registry shape' section before '## References', with a copyable RELEASES.json.example shipped in the skill's own directory."
    requirement: null
    verification:
      - kind: unit
        ref: "node --input-type=module JSON.parse of RELEASES.json.example"
        status: pass
      - kind: other
        ref: "bidirectional field grep: all 7 documented fields (schema_version, schema_notes, releases, id, canonical, disk_image, dumps) confirmed present in releases.mjs by grep, and all 7 confirmed present in SKILL.md by grep"
        status: pass
      - kind: unit
        ref: "node scripts/check-npm-packages.mjs (36 files in @henols/c64-re-tools tarball, up from 35 -- example file confirmed shipped)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both closed todos (drive-type, project-root) and the newly closed releases-json todo moved pending/ -> completed/ with cited ## Resolution sections naming the file, heading, and (for drive-type) the verifying source line."
    requirement: null
    verification:
      - kind: unit
        ref: "test -f completed/<name> for all three; test ! -f pending/<name> for all three; grep -c '^## Resolution' == 1 for all three"
        status: pass
      - kind: unit
        ref: "cd .claude/mcp/vice && node --test docs-deferred-ledger.test.ts (4/4 pass, both directions)"
        status: pass
    human_judgment: false

duration: 35min (approx.)
completed: 2026-08-22
status: complete
---

# Phase 15 Plan 6: Document Drive-Type, Project-Root, and RELEASES.json Gaps in c64-ram-capture Summary

**Closed three of DEBT-02's five documentation gaps directly in `c64-ram-capture/SKILL.md` — a drive-type closing note inside the disk-boot procedure, a project-root prerequisite before the first procedure heading, and a new "Release registry shape" section with a copyable `RELEASES.json.example` — each claim grep-verified against the module that implements it, and all three tracked todos closed with cited Resolutions.**

## Performance

- **Duration:** 35 min (approx.)
- **Started:** 2026-08-22T16:30:00Z (approx.)
- **Completed:** 2026-08-22T17:05:00Z (approx.)
- **Tasks:** 3 completed
- **Files modified:** 6 (1 created, 2 modified across tasks, 3 todos renamed+modified)

## Accomplishments

- **Re-verified the plan's own "silent in both files" premise before writing anything.** A grep for every key term of all three gaps (`drive`/`drive8type`, `C64RE_PROJECT_ROOT`/`project root`/`git init`, `RELEASES.json`/`schema_version`/`schema_notes`) across both `README.md` and `SKILL.md` returned nothing in all three cases — the plan's claim held, no correction needed.
- **DEBT-02 item 1 (drive-type):** confirmed `buildViceArgs()`'s stock branch (`broker-launch.mts:202`) sets `-drive8type 1541` unconditionally for every stock launch — not conditioned on disk-vs-bare-`.prg` — then added a one-sentence closing note inside `## Boot a disk`, between the program-counter-moved step and the keyboard-typed fallback paragraph, stating no drive setup is needed before attaching.
- **DEBT-02 item 2 (project-root prerequisite):** confirmed the real resolution order in `project-paths.mjs`'s `projectRoot()` (`C64RE_PROJECT_ROOT` checked FIRST at `:28`, `.git` walk only if unset at `:29-35`, throw at `:36-39` naming both) — the reverse of the order the todo's own wording used — and documented the corrected order in a new prerequisite paragraph immediately before `## The order` (the file's first procedure heading, and the first point a scratch project would throw). Added a matching `## Troubleshooting` row quoting the throw's real message fragment.
- **DEBT-02 item 3 (RELEASES.json schema):** added a new `## Release registry shape` section immediately before `## References`, documenting all seven fields (`schema_version`, `schema_notes`, `releases`, `id`, `canonical`, `disk_image`, `dumps`) in a two-column table, each verified against `releases.mjs`'s own source by grep in both directions. `dumps`'s required-as-an-array rationale cites the exact unguarded read (`releases.mjs:98`'s `list` command reads `r.dumps.length` with no nullish guard). Shipped `RELEASES.json.example` in the skill's own directory — one release entry with every field populated with obviously-placeholder values (`example-release`, `example-label`), parses as valid JSON, and confirmed present in the published `@henols/c64-re-tools` tarball (36 files, up from 35 — the installer's `skills/` `files[]` glob picked it up automatically, no pattern widening needed).
- **Task 3 — first-time-reader walk, three user journeys** (all three land above the point they'd otherwise fail, none in a changelog):
  1. **Scratch-directory user capturing RAM:** the project-root prerequisite (line 37, before `## The order` at line 42) precedes the first point `project-paths.mjs` is actually invoked — `## Capture at a trigger address`'s `write-set` step (line ~112), since `## Read the disk first` and `## Boot a disk` touch only `d64-parse.mjs` and MCP tool calls, neither of which resolves the project root. **Yes.**
  2. **User booting a `.d64` who's heard about drive types:** the closing note (lines 87-88) sits inside `## Boot a disk` (heading at line 80), between the PC-moved step and the keyboard fallback — inside the procedure being followed, not a `README.md` changelog. **Yes.**
  3. **User adding a second release:** the `## Release registry shape` table (heading at line 299, before `## References` at line 321) is the only place in the file `RELEASES.json`'s fields are documented at all — nothing earlier in the file describes the schema, so any reader reaches this section before hand-writing a registry entry. **Yes.**
  No existing passage was found to contradict or need updating for the new prose — the only other `drive`-mentioning line in the file (`## Find an entry point`'s "cannot drive the raw matrix") is an unrelated verb use, not a conflicting claim.
- All three DEBT-02 doc todos moved `pending/` → `completed/` with cited `## Resolution` sections naming the file, heading, and (for drive-type) the verifying source line. `STATE.md`'s Deferred Items ledger reconciled across both commits: pending count 18 → 16 (Task 1) → 15 (Task 2); table row count and prose counts kept in sync (15 `todo` rows + 1 `uat_gap` = 16 total items).
- **DEBT-02 is NOT marked complete** — it names five behaviours total; this plan closes three (drive-type, project-root, RELEASES.json schema). The remaining two (`vice_ping`'s misleading `resolvedBinaryPath`, the warp-over-`resource_set` claim) are plan 15-09's, per `REQUIREMENTS.md:84` and the shared-ID gate (#2388): DEBT-02 is also declared by plans 15-09, 15-11 and 15-12, so `requirements.ready-ids` correctly withholds it until the last declaring plan finishes.

## Task Commits

1. **Task 1: Document the drive-type closing note and the project-root prerequisite** - `99564e7` (docs)
2. **Task 2: Document RELEASES.json's shape and ship a copyable example** - `1cd9477` (docs)
3. **Task 3: Re-read all three additions as a first-time user** - no code changes; all three placements verified correct on the first walk, so nothing needed fixing. Recorded here and folded into this plan's metadata commit.

_No plan-metadata commit follows this file per the atomic close-out invariant — this SUMMARY, STATE.md, and ROADMAP.md are committed together in the standard `git_commit_metadata` step immediately after this file is written._

## Files Created/Modified

- `.claude/skills/c64-ram-capture/SKILL.md` - prerequisite paragraph before `## The order`; closing sentence inside `## Boot a disk`; new `## Release registry shape` section before `## References`; two new `## Troubleshooting` / `## References` rows
- `.claude/skills/c64-ram-capture/RELEASES.json.example` - new copyable registry example, one release entry with every documented field populated
- `.planning/todos/completed/2026-08-19-drive-type-prerequisite-undocumented-in-readme-and-skill.md` - moved from `pending/`; `## Resolution` added citing `broker-launch.mts:202` and the new closing sentence
- `.planning/todos/completed/2026-08-19-project-paths-git-marker-requirement-undocumented.md` - moved from `pending/`; `## Resolution` added citing `project-paths.mjs:27-40` and the new prerequisite paragraph
- `.planning/todos/completed/2026-08-19-releases-json-schema-undocumented.md` - moved from `pending/`; `## Resolution` added citing the new section and example file
- `.planning/STATE.md` - Deferred Items ledger reconciled (three rows removed, prose counts corrected 18 → 15 pending / 19 → 16 total)

## Decisions Made

See `key-decisions` in frontmatter. In summary: (1) re-verified the plan's "silent in both files" premise by direct grep before writing, rather than trusting the plan's research-time claim; (2) confirmed `buildViceArgs()`'s drive-type flag is genuinely unconditional on the disk-vs-bare-`.prg` axis, noting the separate `VICE_ARGS` full-argv override does not narrow that claim; (3) documented `dumps`' per-entry shape (`label`/`range_manifest`) as informational sourced from a different reader (`watch-loads.mjs`), not claimed as part of `releases.mjs`'s own contract; (4) used a grep-matchable plain-text substring for the Troubleshooting row's quoted throw fragment rather than embedding raw backticks that would break CommonMark table rendering.

## Deviations from Plan

None - plan executed exactly as written. The plan's own request to re-verify the "silent in both files" premise and the `buildViceArgs()` unconditional-flag claim before writing was executed as instructed, not discovered as a deviation.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Three of DEBT-02's five named behaviours are now documented at the point of use, each with a cited Resolution. `docs-deferred-ledger.test.ts` and `docs-review-disposition.test.ts` both run green. `npm run test:automated` reconfirmed at 2110 tests / 2105 pass / 0 fail / 5 pre-existing todo, unchanged from before this plan. Plan 15-09 owns DEBT-02's remaining two behaviours (`vice_ping`'s `resolvedBinaryPath` misleading claim, the warp-over-`resource_set` refutation) and will close DEBT-02 fully once it lands. No blockers for the remaining phase 15 plans.

---
*Phase: 15-debt-and-review-disposition*
*Completed: 2026-08-22*

## Self-Check: PASSED

All created/modified files confirmed present on disk (`SKILL.md`, `RELEASES.json.example`, all three completed todos, `STATE.md`, this SUMMARY). Both commits confirmed in `git log` (`99564e7`, `1cd9477`). Plan-level `<verification>` re-run: `node scripts/check-skill-tool-coverage.mjs`, `node scripts/check-skill-fork-honesty.mjs`, `node scripts/check-npm-packages.mjs` all exit 0; `cd .claude/mcp/vice && npm run test:automated` exits 0 (2110 tests, 2105 pass, 0 fail, 5 pre-existing todo); `node --test docs-deferred-ledger.test.ts docs-review-disposition.test.ts` exits 0 (4/4 and 11/11 pass); `RELEASES.json.example` parses as JSON; `git status --porcelain installer/skills/` is empty; `ls .planning/todos/pending/ | wc -l` is 15, exactly 3 lower than the plan's starting 18; all three completed todos each contain exactly one `## Resolution` heading naming the file and heading the behaviour is documented at.
