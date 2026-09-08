---
phase: 40-the-three-preprocessing-host-tools
plan: 03
subsystem: host-tool-seam
tags: [petcat, basic-detokenize, host-tool-seam, vice-mcp, skill]

requires:
  - phase: 40-02
    provides: "findSiblingBinary() generalised to any binary name; HostToolOutputClassifier oracle and HOST_TOOL_OUTPUT_CLASSIFIERS total table; the seven-synchronized-edit-sites pattern proven end to end"
provides:
  - "petcat.decode: one new HostToolId with all seven synchronized edit sites, resolved via findSiblingBinary(), BASIC dialect fixed server-side (-2, D-24), no wire dialect field"
  - "classifyPetcatDecodeOutput(): declared-success-shape classifier on the ';<path> ==<hex>==' banner"
  - "derivePetcatEntrypoint(): the host-side handover verdict -- literal SYS resolves to a number named by its source line, a computed SYS declines with the expression quoted verbatim, no SYS token declines by name -- all three ok:true, ok:false reserved for the shape oracle"
  - "The two verdict fields (entrypoint/entrypointReason) attach ONLY to petcat.decode's response; every other tool id's response key set is unchanged"
  - "A committed computed-SYS fixture pair (fixtures/petcat/computed-sys.bas/.prg) authored with petcat -w2 itself, alongside the already-committed literal-SYS fixture"
  - "The c64-petcat skill (SKILL.md + scripts/petcat.mjs) -- one decode subcommand, reaches the seam only, never guesses an entry point"
  - "FUT-01 (deferred hand-written BASIC-token decoding) formally lifted for c64-petcat only, in skill-basic-trigger.test.ts, since this skill delivers the same capability via the real petcat host tool"
affects: [40-05]

actuals:
  tokens: 19300
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Host-side handover verdict: a positive field pair (entrypoint/entrypointReason) attached ONLY to one tool id's response, computed from the SAME classifier-accepted text the shape oracle already validated -- never a second spawn, never a client-side re-parse"
    - "Named skill exemption from a corpus-wide trigger-phrase gate: an exact skill-directory allowlist with a non-vacuity existence check and a positive-control test proving the exemption fires for real, rather than widening or deleting the gate"

key-files:
  created:
    - src/mcp/vice/fixtures/petcat/computed-sys.bas
    - src/mcp/vice/fixtures/petcat/computed-sys.prg
    - src/mcp/vice/fixtures/petcat/README.md
    - src/skills/c64-petcat/SKILL.md
    - src/skills/c64-petcat/scripts/petcat.mjs
  modified:
    - src/mcp/vice/host-tool.mts
    - src/mcp/vice/resources/host-tool.mjs
    - src/mcp/vice/host-tool.test.ts
    - src/mcp/vice/skill-basic-trigger.test.ts
    - CLAUDE.md

key-decisions:
  - "derivePetcatEntrypoint() matches the FIRST BASIC line whose statement (immediately after the line number) is the sys keyword, case-insensitively -- sufficient for every fixture and worked example this phase names; a SYS appearing mid-statement after a colon, or inside a REM comment, is out of scope and not claimed as covered (the plan's own flagged_assumptions section already routes PREP-02's manual-review edge to human_needed at verify time)."
  - "In-process host-tool.test.ts coverage for petcat.decode uses a fake stand-in binary (driven by the requested image's own basename), exactly mirroring 40-02's fake c1541 -- CI has no petcat install (confirmed against .github/workflows/ci.yml, which apt-installs only acme). The real petcat binary (VICE 3.10, /usr/local/bin/petcat) was used LIVE this session to author the computed-SYS fixture, verify all three verdict branches end to end via runHostTool() against resources/host-tool.mjs, and confirm the exact wire response shape -- recorded in fixtures/petcat/README.md."
  - "FUT-01 (deferred hand-written BASIC-token decoding, c64-program-recon's own REFERENCE-ONLY section) is lifted for c64-petcat by name, in skill-basic-trigger.test.ts's own LIFTED_FOR_SKILLS set -- discovered as a genuine deviation only after running the full automated suite past Task 3, since neither this plan's own read_first list nor 40-CONTEXT.md/40-RESEARCH.md mention FUT-01 at all. Every other skill's description stays policed unchanged."

patterns-established:
  - "Host-side positive-verdict fields on a per-tool basis: a response can carry extra fields beyond the shared five-field envelope for exactly one tool id, via an early-return branch keyed on the SAME discriminant already used for classifier dispatch -- never a widened shared type."

requirements-completed: [PREP-02]

coverage:
  - id: D1
    description: "petcat.decode wired end-to-end over the host-tool seam with all seven synchronized edit sites, a declared success-shape classifier on the petcat banner, and a response whose own key set is exactly the five base fields plus entrypoint/entrypointReason"
    requirement: PREP-02
    verification:
      - kind: unit
        ref: "host-tool.test.ts#HOST_TOOL_PATH_ARG_KEYS census (both-directions, total 29); host-tool.test.ts#HOST_TOOL_OUTPUT_CLASSIFIERS completeness (both directions); host-tool.test.ts#petcat.decode response-key-set and no-dialect-key cases"
        status: pass
      - kind: manual_procedural
        ref: "node src/skills/c64-petcat/scripts/petcat.mjs decode against fixtures/dxa/basic-stub.prg and fixtures/petcat/computed-sys.prg, run live against the real petcat binary during execution -- CI has no petcat install, per 40-02's own precedent for c1541"
        status: pass
    human_judgment: false
  - id: D2
    description: "A literal SYS argument resolves to its exact numeric entry point, named by the BASIC line it came from"
    requirement: PREP-02
    verification:
      - kind: unit
        ref: "host-tool.test.ts#petcat.decode: a literal SYS argument resolves to a numeric entry point named by its source line"
        status: pass
    human_judgment: false
  - id: D3
    description: "A computed SYS argument produces a NAMED DECLINE -- ok:true, entrypoint:null, reason quoting the expression verbatim -- never a guessed entry point"
    requirement: PREP-02
    verification:
      - kind: unit
        ref: "host-tool.test.ts#petcat.decode: a computed SYS argument declines by name; c64-petcat skill's own CLI verify command against fixtures/petcat/computed-sys.prg"
        status: pass
    human_judgment: false
  - id: D4
    description: "ok:false stays reserved for the shape oracle (not-a-BASIC-program), distinct from the decline verdict"
    requirement: PREP-02
    verification:
      - kind: unit
        ref: "host-tool.test.ts#petcat.decode: a file with no recognised banner fails the shape oracle"
        status: pass
    human_judgment: false
  - id: D5
    description: "The BASIC dialect is fixed server-side with no wire field, no validation, and no route for a caller to request a different one"
    requirement: PREP-02
    verification:
      - kind: unit
        ref: "host-tool.test.ts#petcat.decode: no wire-selectable BASIC dialect field"
        status: pass
    human_judgment: false
  - id: D6
    description: "The c64-petcat skill (SKILL.md + scripts/petcat.mjs) owns both halves -- conversion and the decline logic -- reaches petcat only through the seam, adds no description collision, and CLAUDE.md's row is byte-identical to the SKILL.md frontmatter description"
    requirement: PREP-02
    verification:
      - kind: unit
        ref: "grep -ac spawnSync src/skills/c64-petcat/scripts/petcat.mjs (0); skill-description-overlap.test.ts#CLAUDE.md's project-skills table is byte-identical to every SKILL.md frontmatter description; skill-description-overlap.test.ts#the real inventory is clean at the threshold; check-no-skill-external-spawn.mjs exit 0"
        status: pass
    human_judgment: false
  - id: D7
    description: "PREP-02's own flagged, unclassified edge (whether a human reviewer would find an edge this plan's three covered cases -- literal resolves, computed declines, non-BASIC-fails -- do not cover) is surfaced for manual review, never silently resolved"
    verification: []
    human_judgment: true
    rationale: "This plan's own flagged_assumptions section states the deterministic edge probe could not classify PREP-02 and this must surface as human_needed at verify time, never a silent pass. No backstop truth was invented here; carried forward unchanged."

duration: 40min
completed: 2026-09-08
status: complete
---

# Phase 40 Plan 03: petcat.decode + the c64-petcat skill Summary

**One `petcat.decode` tool id detokenizes a BASIC stub over the host-tool seam and resolves its `SYS` handover address when literal, declining by name with the unresolved expression quoted verbatim when it isn't -- backed by a new `c64-petcat` skill and an authored computed-`SYS` fixture.**

## Performance

- **Duration:** ~40 min
- **Started:** ~2026-09-08T09:35:00Z
- **Completed:** ~2026-09-08T10:13:00Z
- **Tasks:** 3
- **Files modified:** 10 (across 4 commits)

## Accomplishments

- `fixtures/petcat/computed-sys.bas`/`.prg` (Task 1): authored with `petcat -w2` itself -- the simplest authoring tool, no `acme.build` seam call and no hand-assembled tokenized bytes needed -- 26 bytes, round-trip verified to echo the source line verbatim (proving the lowercase-keyword tokenization actually happened, not landed as literal text). `README.md` records the exact command, sha256 of both files, an annotated byte breakdown, and the keyword-case hazard.
- `petcat.decode` (Task 2): all seven synchronized edit sites in `host-tool.mts` -- `HostToolId`/`HOST_TOOL_IDS`, `HOST_TOOL_ARG_KEYS`, `HOST_TOOL_PATH_ARG_KEYS`, `PetcatDecodeArgs`/`HostToolRequest`, `ResolvedPetcatDecodePaths` + its `runHostTool()` narrowing arm, the `buildHostToolArgv()` branch (dialect `-2` fixed first, image path last), and a `HOST_TOOL_TIMEOUT_MS` entry justified from a real ~1-2ms measured invocation. Resolved via `findSiblingBinary()`, exactly like `c1541.*`. `classifyPetcatDecodeOutput()` and `derivePetcatEntrypoint()` add the declared-success-shape oracle and the host-side handover verdict, MEASURED against both committed fixtures and 64 random bytes (confirmed the banner-absent shape genuinely fires on garbage input). The two verdict fields attach only to this id's response via an early-return branch; every pre-existing tool's response key set is untouched (`dxa-seam.test.ts`'s own exact-key-set assertion still passes unmodified).
- `c64-petcat` skill (Task 3): one `decode` subcommand (`--image`, `--out-dir`, `--json`), mirrors `c64-disk-access`'s `invokeSeam()` shape verbatim, reaches `petcat` only through the seam, never guesses an entry point. `SKILL.md`'s description covers both halves (PETSCII/BASIC conversion and the handover-address read) without colliding with any existing skill's description (clean at the 0.35 threshold, no allowlist entry). `CLAUDE.md` gained one row, byte-identical to the frontmatter description (now 9 rows).
- **Deviation, discovered post-Task-3:** `skill-basic-trigger.test.ts`'s corpus-wide FUT-01 trigger-phrase gate failed on `c64-petcat`'s own use of "detokenize" -- FUT-01 deferred a *hand-written* BASIC decoder, and Phase 40's `PREP-02` delivers exactly that capability via the real `petcat` binary instead. Fixed by naming `c64-petcat` in a new `LIFTED_FOR_SKILLS` set, with a non-vacuity existence check and a new positive-control test proving the exemption is real. Every other skill (in particular `c64-program-recon`, whose own reference section stays deferred) is still policed unchanged.

## Task Commits

1. **Task 1: Author and commit the computed-`SYS` fixture pair** - `51148247` (test)
2. **Task 2: The `petcat.decode` tool id, its shape oracle, and the handover verdict** - `b1d2ac9c` (feat)
3. **Task 3: The `c64-petcat` skill** - `2c621960` (feat)
4. **Deviation fix: lift FUT-01 for `c64-petcat`** - `564f44d9` (fix)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP)

## Files Created/Modified

- `src/mcp/vice/fixtures/petcat/computed-sys.bas`, `computed-sys.prg`, `README.md` - the authored computed-`SYS` fixture and its provenance
- `src/mcp/vice/host-tool.mts` - `petcat.decode`'s seven synchronized edit sites, `classifyPetcatDecodeOutput()`, `derivePetcatEntrypoint()`, and the response-envelope branch that attaches the two verdict fields only to this id
- `src/mcp/vice/resources/host-tool.mjs` - regenerated via `node build.ts`
- `src/mcp/vice/host-tool.test.ts` - recomputed census (27 -> 29), classifier-completeness update, response-key-set/no-dialect-key/four-verdict-branch coverage via a fake petcat stand-in
- `src/skills/c64-petcat/SKILL.md`, `scripts/petcat.mjs` - new skill, one subcommand
- `src/mcp/vice/skill-basic-trigger.test.ts` - `LIFTED_FOR_SKILLS` exemption + positive-control test (deviation fix)
- `CLAUDE.md` - one new project-skills table row

## Decisions Made

See `key-decisions` in the frontmatter. Most consequential: lifting FUT-01 for `c64-petcat` specifically, since it changes a pre-existing, cross-cutting project invariant (a corpus-wide trigger-phrase gate) rather than only this plan's own new files -- scoped as narrowly as possible (one named skill, one exemption, every other skill still policed, a positive-control test proving the exemption is real rather than a silent widening).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, discovered post-Task-3] `skill-basic-trigger.test.ts`'s FUT-01 gate failed on `c64-petcat`'s legitimate use of "detokenize"**
- **Found during:** running the full `npm run test:automated` suite after Task 3 completed, as this executor's own baseline-confirmation step
- **Issue:** `skill-basic-trigger.test.ts` polices every skill's `description:` frontmatter for ten BASIC-token trigger phrases, asserting none appear anywhere, because `FUT-01` deferred BASIC-token decoding as a capability (a hand-written decoder, specifically -- see `c64-program-recon`'s own `REFERENCE-ONLY` section, which states "if a future milestone lifts `FUT-01`, this section is the starting point"). `c64-petcat`'s description legitimately says "detokenize" because Phase 40's `PREP-02` requirement text itself commits to delivering exactly this capability, via the real `petcat` host tool -- not a hand-written decoder, the specific thing `FUT-01` deferred. Neither this plan's own `<read_first>` lists nor `40-CONTEXT.md`/`40-RESEARCH.md` mention `FUT-01` at all, so the collision was invisible until the full suite ran.
- **Fix:** Added a `LIFTED_FOR_SKILLS` set naming `c64-petcat` explicitly (never a substring/pattern match), skipped in the corpus scan with a non-vacuity assertion that the named skill actually exists in the corpus, and a new positive-control test proving `c64-petcat`'s description genuinely carries the trigger vocabulary the exemption skips (so the exemption cannot silently become a no-op if the description is later reworded). Every other skill's description -- in particular `c64-program-recon`'s own, whose reference section stays deferred and unclaimed -- is still policed exactly as before.
- **Files modified:** `src/mcp/vice/skill-basic-trigger.test.ts`
- **Verification:** `node --test skill-basic-trigger.test.ts` (3/3 pass); `npm run test:automated` settles at the confirmed pre-existing floor of 3 failures (2 in `anno-register.test.ts`, 1 in `anno-import.test.ts`), both unrelated to this phase.
- **Committed in:** `564f44d9`

---

**Total deviations:** 1 auto-fixed (1 bug fix). **Impact:** necessary for the newly-delivered `PREP-02` capability to coexist with a pre-existing project-wide invariant; the fix is scoped to exactly one named skill and leaves every other skill's own policing unchanged. No scope creep.

## Issues Encountered

- A transient, non-deterministic 4th failure (`check-skill-fork-honesty: every spelling that RESOLVES to the repository root is accepted`) appeared in one intermediate `npm run test:automated` run and was absent from two subsequent stable re-runs, settling back to the confirmed floor of 3 -- consistent with this project's own documented test-suite scratch-file race (unrelated to this plan's changes). Not fixed (out of scope, pre-existing, and self-resolved on re-run).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `40-05`'s pointer from `c64-program-recon` to `c64-petcat` (a documentation link, not new logic) can now target a real, shipped skill.
- The interface contract this plan fixed (`petcat.decode`'s accepted keys, path-bearing keys, response shape) is stable for any later plan reading `entrypoint`/`entrypointReason`.
- One flagged gap for a human to weigh at `/gsd-verify-work`: `PREP-02`'s own deterministic edge probe could not classify it into any edge family (recorded in this plan's own `flagged_assumptions`) -- the three covered cases (literal resolves, computed declines, non-BASIC fails) are stated so a manual review has something concrete to check against, but whether a human reviewer would find an uncovered edge is not resolved here.
- No blockers for `40-04`, `40-05`, `40-06` or `40-07`.

---
*Phase: 40-the-three-preprocessing-host-tools*
*Completed: 2026-09-08*

## Self-Check: PASSED

- FOUND: src/mcp/vice/fixtures/petcat/computed-sys.bas
- FOUND: src/mcp/vice/fixtures/petcat/computed-sys.prg
- FOUND: src/mcp/vice/fixtures/petcat/README.md
- FOUND: src/mcp/vice/host-tool.mts
- FOUND: src/mcp/vice/resources/host-tool.mjs
- FOUND: src/mcp/vice/host-tool.test.ts
- FOUND: src/skills/c64-petcat/SKILL.md
- FOUND: src/skills/c64-petcat/scripts/petcat.mjs
- FOUND: src/mcp/vice/skill-basic-trigger.test.ts
- FOUND: CLAUDE.md (new c64-petcat row)
- FOUND commit: 51148247
- FOUND commit: b1d2ac9c
- FOUND commit: 2c621960
- FOUND commit: 564f44d9
- Acceptance criteria re-verified: `npm run typecheck` exits 0; `node --test host-tool.test.ts dxa-seam.test.ts resources-sync.test.ts skill-description-overlap.test.ts skill-honesty-checks.test.ts skill-basic-trigger.test.ts` reports 158/158 pass; `grep -ac 'totalDeclared, 29' host-tool.test.ts` is 2; `grep -ac spawnSync src/skills/c64-petcat/scripts/petcat.mjs` is 0; `node scripts/check-no-skill-external-spawn.mjs` exits 0; `node build.ts` leaves `git status --porcelain resources/` empty; `npm run test:automated` settles at 3 failing (2 in anno-register.test.ts, 1 in anno-import.test.ts), the confirmed pre-existing floor per 40-01/40-02's own SUMMARYs.
