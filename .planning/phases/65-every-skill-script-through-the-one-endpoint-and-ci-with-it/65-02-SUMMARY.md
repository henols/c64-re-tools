---
phase: 65-every-skill-script-through-the-one-endpoint-and-ci-with-it
plan: 02
subsystem: mcp-server
tags: [anno, mcp-surface, cli, skills, documentation]

# Dependency graph
requires:
  - phase: 65-01
    provides: the fixed-endpoint host-tool seam this plan does not touch (anno is a separate, unrelated seam)
provides:
  - anno-cli.ts's generic `call <name> (--args JSON | --args-file FILE)` verb, reaching all 28 (MEASURED) former anno_* MCP tools through the unchanged runAnnoTool()
  - an MCP surface with zero anno_* tool names (D-13) -- 48 tools advertised, down from 76 MEASURED
  - every skill instruction reachable through a form that runs today (D-14) -- no npx -y anno line survives
  - the anno_* surface census (evidence/65-anno-surface-census.md), replacing the deleted check-skill-tool-coverage.mjs guard
  - the folded todo closed under todos/completed/
affects: [65-03, 65-04, 65-05, 65-06, 65-07, 65-08, 65-09, phase-66-atomic-cutover]

# Actuals (#2632)
actuals:
  tokens: 43495
  tasks: 3
  commits: 4
  plan_head_before: c4ac2a0c25daed95a8907278de1933143ecc96e8

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A generic dispatch verb (`anno call <name> --args JSON`) added to an existing narrow-verb CLI, reusing the runner (runAnnoTool()) unchanged rather than reimplementing each name."
    - "Evidence census replacing a deleted structural test-file guard, per 260914-poo D-1 (measure, do not assert on document text)."

key-files:
  created:
    - .planning/phases/65-every-skill-script-through-the-one-endpoint-and-ci-with-it/evidence/65-anno-surface-census.md
    - .planning/todos/completed/2026-09-11-remove-anno-from-the-mcp-surface-reach-it-via-a-stateless-br.md
  modified:
    - src/mcp/vice/anno-cli.ts
    - src/mcp/vice/anno-cli.test.ts
    - src/mcp/vice/anno-cli-path-consumers.test.ts
    - src/mcp/vice/vice-proxy.ts
    - src/mcp/vice/vice-proxy.test.ts
    - CLAUDE.md
    - README.md
    - .planning/codebase/ARCHITECTURE.md
    - .planning/codebase/STACK.md
    - .planning/codebase/INTEGRATIONS.md
    - .planning/codebase/STRUCTURE.md
    - .planning/codebase/CONCERNS.md
    - src/skills/c64-memory-mapping/SKILL.md
    - src/skills/c64-program-recon/SKILL.md
    - src/skills/c64-program-recon/references/tool-selection.md
    - src/skills/c64-program-recon/references/reconstruction.md
    - src/skills/c64-program-recon/templates/memory-map.template.md
    - src/skills/routine-queue-walker/SKILL.md
    - src/skills/acme-build/SKILL.md
    - src/skills/c64-provenance-diff/SKILL.md
    - src/skills/c64-ram-capture/SKILL.md

key-decisions:
  - "CURATED_ANNO_TOOLS is MEASURED at 28 names, not the plan's own working estimate of 25 -- the plan's objective and D-13 both undercounted. The same two names (anno_hazard_report, anno_evid_disagreements) are the only ones colliding with a native CLI verb either way; the correction only changes how many of the 28 had zero CLI route before `call` (26, not 23)."
  - "The `call` verb's positional tool name is spelled `NAME`, not `<anno_tool_name>` (the plan's own literal wording), because anno-cli-path-consumers.test.ts's own established convention reads ANY `<...>`-bracketed synopsis token as a caller-supplied path requiring its own confinement call site -- bracketing a non-path argument would have desynced that seam's own count from its inventory."
  - "The wire-level anno path-confinement integration test in vice-proxy.test.ts was retired rather than ported, because the property it proved now has exactly one live surface (the anno CLI), and Task 1's own new `call` Test 5 proves the identical storePathWithinWorkspace() confinement there."
  - "A new test-only fixture tool (vice_test_fixture_result, gated behind VICE_TEST_FIXTURE_TOOL) replaces vice-proxy.test.ts's prior use of anno_get_symbols as its backend-independent, no-emulator chunking/continuation test vehicle -- that property was never about anno itself, and reusing anno after D-13 would have reopened the MCP surface this plan closes."

requirements-completed: [SEAM-01]

coverage:
  - id: D1
    description: "anno call <name> (--args JSON | --args-file FILE) answers all 28 former anno_* MCP tools, statelessly, with no emulator"
    requirement: SEAM-01
    verification:
      - kind: unit
        ref: "anno-cli.test.ts#call, Test 1: write-then-read against a real store with no x64sc on PATH"
        status: pass
      - kind: unit
        ref: "anno-cli.test.ts#call, Test 6: Test 1's write-then-read pair still succeeds with PATH narrowed"
        status: pass
    human_judgment: false
  - id: D2
    description: "tools/list advertises zero anno_* names; the server still boots and lists everything else"
    requirement: SEAM-01
    verification:
      - kind: integration
        ref: "vice-proxy.test.ts#tools/list's full output matches the manifest exactly (name set, order, schema, _meta cap)"
        status: pass
      - kind: integration
        ref: "smoke.mjs (48 tool(s) advertised)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every skill instruction that used to name an anno_* MCP tool now names a CLI form that runs today; no npx -y anno line, no anno_* MCP phrase"
    requirement: SEAM-01
    verification:
      - kind: other
        ref: "grep -a -rn 'npx -y @henols/vice-mcp anno' src/skills (0 hits) and grep -a -rn 'anno_\\* MCP' src/skills (0 hits), recorded in evidence/65-anno-surface-census.md"
        status: pass
    human_judgment: false
  - id: D4
    description: "The census document exists and lists every remaining anno_ occurrence's disposition, plus the vice-wedge-triage residual"
    verification:
      - kind: other
        ref: "evidence/65-anno-surface-census.md (120 occurrences catalogued, 105 in an anno call step, 14 prose-defined, 1 known residual)"
        status: pass
    human_judgment: false

# Metrics
duration: 51min
completed: 2026-09-25
status: complete
---

# Phase 65 Plan 02: Anno Leaves the MCP Surface Summary

**The 28 (MEASURED) `anno_*` MCP tools are gone from `tools/list`; `anno-cli.ts` grew one generic `call <name> --args JSON` verb that answers every one of them through `runAnnoTool()` unchanged, and every skill instruction that used to name one now names that verb.**

## Performance

- **Duration:** ~51 min
- **Started:** 2026-09-25T08:18:43Z (approx, from the prior plan's closing commit)
- **Completed:** 2026-09-25T11:09:13+02:00 (09:09:13Z)
- **Tasks:** 3 (plus one in-flight fix folded into Task 1's own deliverable)
- **Files modified:** 24

## Accomplishments

- `anno-cli.ts` gained a seventh verb, `call <name> (--args JSON | --args-file FILE)`, the one generic route for the 26 of 28 curated `anno_*` names that had no CLI route at all before this plan (the other 2 already had a differently-shaped native verb: `hazard-report`, `evid-disagreements`). Six behaviours proven in `anno-cli.test.ts`, including a real write-then-read with `x64sc` absent from `PATH` entirely.
- `vice-proxy.ts`'s anno registration loop and its `ANNO_TOOL_DEFINITIONS`/`runAnnoTool` imports are deleted outright. A real spawned `tools/list` now advertises 48 tools (measured before/after: 76 → 48), zero of them `anno_*`.
- Every skill that named an `anno_*` tool (`c64-memory-mapping`, `c64-program-recon` plus its two reference docs and its memory-map template, `routine-queue-walker`, `acme-build`, `c64-provenance-diff`) moved to `anno call <name>`, each gaining a short "How to run an anno verb" block naming the plugin and in-repo invocation forms. `c64-ram-capture`'s one ambiguous `vice-mcp anno render-memmap` mention is now a runnable form.
- `evidence/65-anno-surface-census.md` replaces the deleted `check-skill-tool-coverage.mjs` structural guard with a measured census: every remaining `anno_` occurrence under `src/skills/` (120, catalogued with file:line and disposition), the measured tools/list counts, and the one deliberate residual (`vice-wedge-triage/SKILL.md`, not edited this plan — see Deviations).
- README.md, CLAUDE.md and the five `.planning/codebase/*.md` documents (CLAUDE.md's own generated-section sources) no longer describe anno as an MCP tool surface.
- The folded todo (`2026-09-11-remove-anno-from-the-mcp-surface-reach-it-via-a-stateless-br.md`) is closed under `todos/completed/` with D-12's reading recorded verbatim.

## Task Commits

Each task was committed atomically (Task 1 needed a follow-up fix commit, disclosed below):

1. **Task 1: `anno call` answers the 25 (later corrected to 28) verbs with no emulator** — `d6554df6` (feat)
2. **Task 1 fix: the six required behaviour tests were missing from the first commit** — `3f6042ae` (fix)
3. **Task 2: tools/list no longer carries any anno_* tool** — `f0bba850` (feat)
4. **Task 3: every skill and living doc moves to the CLI; the census; the closed todo** — `7a61fe01` (docs)

**Plan metadata:** commit pending (this SUMMARY + STATE.md/ROADMAP.md, sequential mode).

## Files Created/Modified

- `src/mcp/vice/anno-cli.ts` — added `cmdCall()`/`parseCallArgs()`, the `call` verb, VERB_OPTIONS entry, USAGE section, unknown-verb message
- `src/mcp/vice/anno-cli.test.ts` — SURVIVING_VERBS/message updates plus the six `call` behaviour tests
- `src/mcp/vice/anno-cli-path-consumers.test.ts` — `--args-file` added to the path-argument inventory, floor raised 16→17
- `src/mcp/vice/vice-proxy.ts` — anno registration loop and its imports deleted; D-06 comment amended per D-14; a test-only fixture tool added (gated, never wire-visible outside a test process)
- `src/mcp/vice/vice-proxy.test.ts` — every `anno_get_symbols`-driven test rewired onto the fixture tool; `CURATED_ANNO_TOOLS` removed from every tools/list expectation; the wire-level path-confinement test retired (coverage moved to the CLI layer)
- `CLAUDE.md`, `README.md` — anno described as the CLI's `call` verb, not an MCP tool surface; measured tool count
- `.planning/codebase/{ARCHITECTURE,STACK,INTEGRATIONS,STRUCTURE,CONCERNS}.md` — same correction at the generated-section source
- `.planning/phases/58-.../evidence/phase58-declaration-provenance.md` — two citation-ledger entries repaired after this plan's own edit shifted `acme-build/SKILL.md`'s line numbers (see Deviations)
- Nine skill/reference/template files under `src/skills/` — see coverage/key-files above
- `.planning/phases/65-.../evidence/65-anno-surface-census.md` — new
- `.planning/todos/completed/2026-09-11-....md` — moved from `pending/`, `## Resolution` appended

## Decisions Made

See `key-decisions` in the frontmatter. In short: the plan's own "25" estimate for the curated `anno_*` tool count was corrected to the measured 28 everywhere it appeared in code comments and living docs; the `call` verb's positional is spelled without angle brackets to avoid a false match in the path-consumers audit; the one wire-level anno confinement test was retired rather than ported, since its property now has exactly one live surface; and vice-proxy.test.ts's oversized-result test vehicle moved from `anno_get_symbols` to a purpose-built, gated fixture tool.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The plan's own tests for `call` were absent from the first Task 1 commit**
- **Found during:** Post-commit self-review, before starting Task 2.
- **Issue:** Task 1's `<behavior>` block specified six tests for the new `call` verb; the first commit (`d6554df6`) implemented `cmdCall()` itself but never added the tests, so Task 1's own acceptance criterion ("The six behaviours exist as named tests in anno-cli.test.ts and pass") was unmet.
- **Fix:** Added all six tests, discovering along the way that every `anno_*` verb (read or write) REFUSES a store path that does not already exist (`assertStorePresent()`) — there is no implicit bootstrap on first write, contrary to a pre-existing (not-this-plan) doc line in `c64-program-recon/SKILL.md`. Each test creates its store deliberately first.
- **Files modified:** `src/mcp/vice/anno-cli.test.ts`
- **Verification:** All six pass; full Task 1 verify command re-run clean (238/238... counted as 244 tests including the new six, 0 fail).
- **Committed in:** `3f6042ae`

**2. [Rule 1 - Bug] CURATED_ANNO_TOOLS measured at 28, not the plan's own stated 25**
- **Found during:** Writing the surface census (Task 3), cross-checking the plan's own numeric claims against a real measurement.
- **Issue:** The plan's objective and D-13 both state "25 anno_* MCP tools." A direct measurement (`CURATED_ANNO_TOOLS.length` from a running import) returns 28. The "before" tools/list count this discrepancy implies (76 = 47 manifest + 1 synthetic + 28 anno) matches CLAUDE.md's own PRE-EXISTING count exactly, confirming 28 is correct and 25 was the plan's own undercount.
- **Fix:** Corrected every place the "25" (and a derived "19" for the tools with no prior CLI route) had already been written: `anno-cli.ts`'s own header comment and `cmdCall()`'s doc comment, `anno-cli.test.ts`'s `SURVIVING_VERBS` doc comment, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/INTEGRATIONS.md`. The two commit messages for `d6554df6` and `f0bba850` (already pushed to history before the correction was found) still say "25" / "19" — left as-is per this project's own "never amend, create a new commit" git discipline; the in-code and in-doc numbers are now all correct.
- **Files modified:** `src/mcp/vice/anno-cli.ts`, `src/mcp/vice/anno-cli.test.ts`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/INTEGRATIONS.md`
- **Verification:** `node -e 'import("./anno-tools.ts").then(m=>console.log(m.CURATED_ANNO_TOOLS.length))'` → 28, re-checked after every edit.
- **Committed in:** `3f6042ae` (anno-cli.ts/test.ts), `7a61fe01` (the codebase docs)

**3. [Rule 3 - Blocking] Removing anno_get_symbols from tools/list broke ~15 unrelated vice-proxy.test.ts tests**
- **Found during:** Task 2, before running its own verify command.
- **Issue:** The plan's Task 2 action text said only "remove CURATED_ANNO_TOOLS from every expected tools/list set." It did not anticipate that `vice-proxy.test.ts`'s own oversized-result/continuation/never-throw coverage, and its leading tracer, drove all of their real tool calls through `anno_get_symbols` specifically BECAUSE it needed no emulator, no broker and no stand-in server — a property that has nothing to do with anno itself. Deleting the tool broke roughly nine tests.
- **Fix:** Added a test-only synthetic tool (`vice_test_fixture_result`) to `vice-proxy.ts`, gated behind `VICE_TEST_FIXTURE_TOOL` (never set outside a test process, mirroring the file's own pre-existing `VICE_TEST_ANNO_CLI_STDOUT_FILL_BYTES` hatch), with zero dependency on `anno-tools.ts`. Rewired every affected test onto it. Retired the one test that specifically proved anno's OWN path-confinement over the wire, since that property now has exactly one live surface (the CLI), which Task 1's own new `call` Test 5 already proves.
- **Files modified:** `src/mcp/vice/vice-proxy.ts`, `src/mcp/vice/vice-proxy.test.ts`
- **Verification:** Full `vice-proxy.test.ts` suite green in the full-glob run (4469/4384/1/84 — the 1 fail is the pre-existing PROJECT.md:2109 citation-ledger drift, unrelated).
- **Committed in:** `f0bba850`

**4. [Rule 1 - Bug] This plan's own edit broke two citation-ledger entries in a committed phase 58 evidence document**
- **Found during:** Running the full test suite before Task 3's commit.
- **Issue:** Adding the "How to run an anno verb" block to `acme-build/SKILL.md` shifted every line after it by +8. `phase58-declaration-provenance.md`'s own citation ledger (checked by `phase58-citation-ledger.test.ts`) cited two exact line spans in that file (`:211-212`, `:254`) that no longer resolved to their anchor text.
- **Fix:** Recomputed the new line numbers (`:219-220`, `:262`) and updated both the inline citation and the ledger's own JSON entry.
- **Files modified:** `.planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/evidence/phase58-declaration-provenance.md`
- **Verification:** `phase58-citation-ledger.test.ts` re-run clean (back to exactly the one known pre-existing PROJECT.md:2109 failure).
- **Committed in:** `7a61fe01`

---

**Total deviations:** 4 auto-fixed (2 Rule 3 blocking, 2 Rule 1 bug). **Impact:** All four were necessary to make the plan's own verification requirements and this project's existing test suite pass; none expanded scope beyond what D-12/D-13/D-14 already required. No scope creep.

## Known Stubs

None.

## Issues Encountered

A test-suite flake, not a regression: `anno-cli.test.ts`'s "the cross-reference adapter answers over the WHOLE population" test failed once, during the full-glob run, with a SQLite "disk I/O error" against a leaked-then-recreated scratch directory under concurrent load. Re-run alone (`node --test --test-name-pattern "the cross-reference adapter..." anno-cli.test.ts`), it passed cleanly in 16.6s. Confirmed non-regression per this project's own standing guidance (never call a single concurrent-run failure a regression without an isolated re-run). Not present in the final full-glob run, which was clean except the one pre-existing PROJECT.md:2109 failure.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 65-02 is closed; `anno` is fully off the MCP surface and every skill instruction runs today.
- Plans 65-03 through 65-09 continue the host-tool-seam migration this phase's other plans own; none of them depend on anno's own migration, which was folded todo work independent of SEAM-01's host-tool-seam thread.
- `src/skills/vice-wedge-triage/SKILL.md`'s residual "anno_* tool surface" framing (line 185) is recorded in the census and awaits the owner committing their own pending edits to that file before it can be corrected.
- The plan's own commit messages for `d6554df6`/`f0bba850` still cite the stale "25"/"19" counts (see Deviations #2) — a cosmetic, disclosed inaccuracy in already-pushed history, not a code or doc defect.

---
*Phase: 65-every-skill-script-through-the-one-endpoint-and-ci-with-it*
*Completed: 2026-09-25*

## Self-Check: PASSED

- All 9 key-files (5 created/completed + 5 spot-checked modified) confirmed present on disk.
- All 4 task commits (`d6554df6`, `f0bba850`, `3f6042ae`, `7a61fe01`) confirmed in `git log --oneline --all`.
- Full-glob `npm test`: 4469/4384/1/84 (0 new failures; the 1 fail is the pre-existing PROJECT.md:2109 citation-ledger drift).
- `npm run smoke`: exit 0, 48 tool(s) advertised.
- `grep -a -rn 'npx -y @henols/vice-mcp anno' src/skills`: 0 hits.
- `grep -a -rn 'anno_\* MCP' src/skills`: 0 hits.
