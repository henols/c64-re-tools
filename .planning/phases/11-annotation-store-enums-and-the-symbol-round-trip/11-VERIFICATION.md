---
phase: 11-annotation-store-enums-and-the-symbol-round-trip
verified: 2026-08-21T00:00:00Z
status: passed
score: 4/4 roadmap success criteria verified; 5/5 requirement IDs judged satisfied
overrides_applied: 0
---

# Phase 11: Annotation Store, Enums, and the Symbol Round Trip Verification Report

**Phase Goal:** Recon findings become state a later session can query, register writes read as
names, and symbols flow both ways between the store and the running machine.
**Verified:** 2026-08-21
**Status:** passed
**Re-verification:** No — initial verification

This report is goal-backward: every claim below was checked against the codebase directly (file
reads, live `node --test` runs against a real `regenerator2000 0.9.20`, real ACME 0.97, and — for
criterion 4 — a genuinely unpatched stock `x64sc` VICE 3.9 binary and the fork's VICE 3.10), not
taken from SUMMARY.md prose.

## Goal Achievement

### Observable Truths (ROADMAP.md § Phase 11 Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `c64-program-recon` writes labels/comments/block types/scopes into the store; a **later session** answers by querying the store instead of re-deriving from prose | ✓ VERIFIED | `r2000-tools.ts` (17 curated tools) live-tested (`VICE_REQUIRE_R2000=1 node --test r2000-tools.test.ts` → 70/70 pass incl. cross-session read-back). D-26 two-session proof independently re-verified: `QUESTION.md`'s sealed answer (`ANSWER.sha256`) matches `SESSION-B-ANSWER.md`'s recomputed hash exactly (`e64463d8...`); confirmed the label `border_bump_up` (the leak-sensitive field) appears nowhere in `SESSION-A-TRANSCRIPT.md` (grep, zero hits); `r2000-answer-key.test.ts` 7/7 pass. `c64-program-recon/SKILL.md` rewritten (plan 11-12) to write via `r2000_*` tools and generate the map via `render-memmap` rather than hand-authoring it. |
| 2 | A user can ask which addresses reference a given address, and search labels/comments/instructions | ✓ VERIFIED | `r2000_get_cross_references`/`r2000_search_disassembly` are 2 of the 17 curated tools, live-tested against a real child (non-empty xref list on `$D020`, bounded `search_disassembly` results). Directly exercised in the criterion-1 evidence (`xrefcount=2`, cross-checked by both sessions). |
| 3 | Enums generated from `memmap.json` render per-bit VIC-II/SID/CIA writes with semantic names (`lda #$1b`/`sta $d011` → named bits), re-runnable from `memmap.json` | ✓ VERIFIED | Independently re-ran `VICE_REQUIRE_R2000=1 VICE_REQUIRE_ACME=1 node --test r2000-cli.test.ts` — test 35 ("criterion 3 … renders as `lda #D011_YSCROLL3_ROW25_SCREENON_TEXT` … reassembles under real ACME") passes, with the ACME export operand printed live in the test's own diagnostic output. `r2000-regbits.json` (35 registers) is generated from `memmap.json`'s 29 structured `bits` entries + a documented override table, with a digest-pinned drift guard (`r2000-regbits.test.ts`, 13/13 pass). |
| 4 | A symbol annotated in r2000 resolves live via `vice_symbols_load`; a name discovered against the running machine flows back via `--import_lbl`; demonstrated as ONE closed loop, not two dumps | ✓ VERIFIED | `evidence/criterion4/WALKTHROUGH.md` read in full: 23 ordered steps against genuine unpatched stock `/usr/bin/x64sc` (VICE 3.9, confirmed zero `mcpserver` hits) and real `regenerator2000 0.9.20`. Absence proven (Steps 6-7, both store and exported file) strictly before the live discovery (Steps 14-15, `resolvedTarget: 2118` read off a real `beq`), before the name is written to the store (Step 16), before the whole `.lbl` is regenerated (Step 17), before the single `vice_symbols_load` reload (Step 18) — `vice_symbols_load` occurs exactly twice in the transcript (once per file), never incrementally, matching D-29. The `--import_lbl` leg is separately demonstrated on an independent project copy (Steps 21-23). CI-runnable mechanism test `r2000-symbol-roundtrip.test.ts` also passes (7/7, gated). |

**Score:** 4/4 roadmap success criteria verified.

### Requirement-ID Traceability (the deliberately-deferred decision)

`REQUIREMENTS.md` currently shows all five in-scope IDs unchecked (`[ ]`), because plan 11-03
(wave 1) correctly declined to mark `R2000-13`/`R2000-14` complete while later plans were still
pending, and no later plan owned the bookkeeping step. Having now verified the phase's **complete**
delivered work (all 12 plans, all 7 waves, merged to `main`), each ID is judged individually
against the codebase:

| ID | Requirement (summary) | Verdict | Evidence |
|----|------------------------|---------|----------|
| R2000-10 | Recon writes queryable annotation state (labels/comments/block types/scopes), not only Markdown prose | **SATISFIED** | 17 curated tools exist and are live-tested; `c64-program-recon/SKILL.md` rewritten to be store-first (plan 11-12); D-26 two-session query proof returned a genuine, mechanically-checked MATCH (plans 11-07/11-09), independently re-confirmed above. |
| R2000-11 | Cross-references and search across an analysed program | **SATISFIED** | `r2000_get_cross_references`/`r2000_search_disassembly` implemented, curated, and live-tested; used for real in the criterion-1 evidence. |
| R2000-13 | Enums generated from `memmap.json`, re-runnable, rendering named bits | **SATISFIED** | `r2000-regbits-gen.ts`/`r2000-regbits.json` (digest-pinned, drift-guarded, re-runnable) plus `r2000-enum-gen.ts`'s `gen-enums` verb; criterion 3's pinned literal example passes against a real ACME reassembly (independently re-run above). One known, honestly-recorded limitation (a literal double-run over already-applied addresses is a safe no-op, not true re-derivation) does not defeat the requirement's own wording — re-running the *table* generator from a changed `memmap.json` is exactly what is proven re-runnable, and the "re-runnable" language in R2000-13 is about the table, not about idempotent double-application to the same disassembly. |
| R2000-14 | Symbols annotated in r2000 export as VICE label files and resolve live via `vice_symbols_load` | **SATISFIED** | `exportLabels()`/`vice-mcp r2000 export-lbl` produce a `stock-symbols.ts`-parseable `.lbl`; CI-runnable `r2000-symbol-roundtrip.test.ts` and the live walkthrough (Steps 3-13) both prove resolution against a real emulator. |
| R2000-15 | Names discovered live flow back via `--import_lbl` — a round trip, not a one-way dump | **SATISFIED** | D-28's trap (`--import_lbl` under plain `--headless` discards) is pinned live as a regression test; the fixed path (`--import_lbl` + `--mcp-server-stdio` + `r2000_save_project`, hash-verified) is proven both in CI (11-08) and live against genuine stock (11-11, Steps 21-23), with the absence-before-discovery ordering that distinguishes a loop from two dumps. |

**Recommendation:** run `requirements.mark-complete` for `R2000-10`, `R2000-11`, `R2000-13`,
`R2000-14`, `R2000-15` and check the five boxes in `REQUIREMENTS.md`. This is a bookkeeping gap,
not an implementation gap — the underlying features are built, tested, and (for criteria 1 and 4)
witnessed with recorded, falsifiable, independently-reproducible evidence.

### Required Artifacts (representative sample, not exhaustive — full list cross-checked against all 12 plans' frontmatter)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.claude/mcp/vice/r2000-tools.ts` | 17 curated `R2000_TOOL_DEFINITIONS`, `assertCuratedTool()`, `runR2000Tool()` | ✓ VERIFIED | 769 lines; exactly 17 tool names extracted; `assertCuratedTool()` refuses `r2000_get_address_details` by name (D-32) and recurses into `batch_execute` (D-33), both live-tested. |
| `.claude/mcp/vice/r2000-mcp-client.ts` | The one MCP-client seam, 6 named failure modes | ✓ VERIFIED | 596 lines; `withR2000Session`/`callR2000`/`saveAndVerify` present; `r2000-mcp-client.test.ts` 44+ tests incl. stub-server failure modes and a live-gated real-child test. |
| `.claude/mcp/vice/r2000-regbits-gen.ts` + `r2000-regbits.json` | Generated, digest-pinned address→bit-name table | ✓ VERIFIED | 35 registers; drift guard re-runs the generator and deep-equals the committed file; 13/13 tests pass. |
| `.claude/mcp/vice/r2000-enum-gen.ts` | Value decode, adjacent-pair pass, sanitization, coverage report | ✓ VERIFIED | Criterion 3's pinned literal example independently re-verified against real ACME. |
| `.claude/mcp/vice/r2000-symbols.ts` | `exportLabels`/`importLabels`/`regenerateAndReload` (Rule A20) | ✓ VERIFIED | Reuses `stock-symbols.ts`'s parser (no third copy, confirmed by grep); `r2000-symbol-roundtrip.test.ts` 7/7 live pass. |
| `.claude/mcp/vice/r2000-confidence.ts` + `r2000-memmap-render.ts` | D-25 grade convention; D-24/D-27 generated memory map with drift `--check` | ✓ VERIFIED | 15/15 and 12/12 tests pass; live drift transcripts for both a hand-edit and a store-side change are recorded in 11-10-SUMMARY.md and independently plausible given the code's digest composition (store query results + sidecar bytes + renderer version). |
| `vice-proxy.ts` registration | `r2000_*` family registered proxy-locally, never reaches `forwardToVice()`/manifests | ✓ VERIFIED | `grep -c "r2000_"` on both `tools-manifest.json` and `tools-manifest.stock.json` → 0; registration loop confirmed at `vice-proxy.ts:3287-3288` via `buildViceTool()`, distinct from the manifest loop. |
| `evidence/criterion1/**` | Two-session D-26 proof | ✓ VERIFIED | Read in full; sealed hash matches; no leak of the label field in the transcript. |
| `evidence/criterion4/**` | Live one-loop walkthrough + BACK-02 gate | ✓ VERIFIED | Read in full; ordering invariant holds; `BACK-02-GATE.md` records the standing regression gate plus a live fork-backend (VICE 3.10) reconfirmation. |
| `deferred-items.md` | Genuinely recorded, non-code residual | ✓ VERIFIED | One entry: `repo-root.test.ts`'s worktree-path artifact — confirmed as an environment artifact, not a codebase defect (reproduces identically on an unrelated file). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `vice-proxy.ts` | `r2000-tools.ts` | `buildViceTool()` loop over `R2000_TOOL_DEFINITIONS` | ✓ WIRED | Confirmed at source; never `buildBackendAwareTool()`. |
| `r2000-tools.ts` | `r2000-mcp-client.ts` | dynamic `import()` inside the runner | ✓ WIRED | Confirmed; registration itself spawns no child (dynamic import). |
| `r2000-enum-gen.ts` | `r2000-tools.ts` | `create_project_enum`/`apply_enum_usage`/`save_project` via `runR2000Tool()` | ✓ WIRED | Live-tested end to end via the `gen-enums` CLI verb. |
| `r2000-symbols.ts` | `stock-symbols.ts` | reused `parseViceLabelFile()` (exported for this reuse) | ✓ WIRED | Confirmed: zero second-parser regexes in `r2000-symbols.ts` (grep `al\s` → 0 as the plan's own acceptance criterion requires). |
| `CLAUDE.md` | `vice-proxy.ts` | `rewriteArguments()` line citations, mechanically checked | ✓ WIRED | `docs-linerefs.test.ts` 3/3 pass; citations (`:2950`, `:1429`) verified against live source. |
| `check-skill-tool-coverage.mjs` | `CURATED_R2000_TOOLS` | r2000_* extraction + non-vacuity floor (≥10) | ✓ WIRED | Live run: "r2000_*: 10 distinct names extracted, all curated (CURATED_R2000_TOOLS has 17 entries)." |

### Behavioral Spot-Checks (independently re-run by this verifier, not taken from SUMMARY.md)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Curated surface round-trips a label across a fresh session | `VICE_REQUIRE_R2000=1 node --test r2000-tools.test.ts r2000-enum-gen.test.ts r2000-symbol-roundtrip.test.ts r2000-answer-key.test.ts r2000-memmap-render.test.ts` | 70/70 pass | ✓ PASS |
| Criterion 3's pinned example reassembles under real ACME | `VICE_REQUIRE_R2000=1 VICE_REQUIRE_ACME=1 node --test r2000-cli.test.ts` | 43/43 pass, test 35 named explicitly | ✓ PASS |
| `docs-linerefs.test.ts` citations still match live source | `node --test docs-linerefs.test.ts` | 3/3 pass | ✓ PASS |
| `r2000_*` family absent from both manifests | `grep -c "r2000_" tools-manifest.json tools-manifest.stock.json` | 0, 0 | ✓ PASS |
| npm packaging / skill-coverage / fork-honesty gates | `node scripts/check-npm-packages.mjs && node scripts/check-skill-tool-coverage.mjs && node scripts/check-skill-fork-honesty.mjs` | all OK, counts match SUMMARY claims exactly | ✓ PASS |
| `installer/skills/` is generated, not a second hand-edit site | `git status --porcelain installer/skills` + `git check-ignore -v` | empty status; matched by `.gitignore:43` | ✓ PASS |
| No debt markers in phase-touched source | `grep -rnE '\b(TBD\|FIXME\|XXX)\b' r2000-*.ts` (excluding tests) | no hits | ✓ PASS |

### Evidence-Artifact Judgement (per orchestrator's specific ask)

**Criterion 1 (D-26 two-session falsifiability):** Independently confirmed the seal covers the
canonical answer line (`ANSWER.sha256` recomputed from `ANSWER.md`'s fenced line matches exactly),
that `border_bump_up` (the one field checked for bare-substring leakage) does not appear anywhere
in `SESSION-A-TRANSCRIPT.md`, and that `SESSION-B-ANSWER.md`'s four tool-call/response pairs
genuinely derive the sealed line rather than restating it. **Judgement: this constitutes real
evidence that the store carries knowledge across a session boundary.** The one honest caveat
(recorded by the plan itself, not hidden) is that "session B" is a separate GSD plan-execution
context rather than a separate human — which is exactly what D-26 asked for ("a later session"),
not a stronger claim than that.

**Criterion 4 (the live loop):** Read `WALKTHROUGH.md` end to end. It reads as ONE ordered
transcript, not two independent write-then-read tests bolted together: the ordering itself
(absence → live discovery → naming → regeneration → single reload) is asserted and witnessed at
each step with real tool output, including a genuine defect hit-and-fixed live (missing
`-drive8type 1541`, matching the documented FINDING-C1). `vice_symbols_load` occurs exactly twice,
matching D-29's replace-not-merge semantics. **Judgement: this is one closed loop**, not two
one-way dumps dressed up as one.

### Residual Findings (recorded, assessed, not blocking)

| Finding | Status | Assessment |
|---------|--------|------------|
| **T-11-NAME-INJECT** — `r2000_set_label_name`/`--import_lbl` accept any string as a label name; `assertLegalAcmeIdentifier()` is called only on enum/variant names | Recorded in 11-08-SUMMARY.md and restated (not re-covered) in `WALKTHROUGH.md` | Confirmed genuine by direct source read (`r2000-tools.ts`'s schema has no format constraint on `name`; `assertLegalAcmeIdentifier` calls are confined to `r2000-enum-gen.ts`). Real gap, honestly documented in three places, does not violate any must-have of this phase (D-18/D-33 do not require label-name sanitization) and is explicitly out of scope for the plans that found it. **Non-blocking — WARNING for future hardening, not a phase gap.** |
| **Enum double-run is a safe no-op, not true re-derivation** | Recorded in 11-06-SUMMARY.md's Issues Encountered | Confirmed genuine (applying an enum changes `search_disassembly`'s own operand text from raw immediate to enum-reference form, so a second pass finds nothing to re-pair). Does not defeat R2000-13's "re-runnable from `memmap.json`" claim (that refers to the table generator, independently drift-guarded and verified). **Non-blocking.** |
| **`repo-root.test.ts` worktree-only failure** | Recorded in `deferred-items.md`, referenced consistently across 8 of 12 SUMMARYs | Verified as an environment artifact (worktree checkout path contains `.claude/`), not a codebase defect — passes on the main tree. Consistent with user's own standing memory note on this exact class of failure. **Not a defect.** |
| **Scope creep: 11-05 touched 3 synthetic-tool-name discoverers + CLAUDE.md; 11-08 exported `stock-symbols.ts` internals + added an `argv` override to `r2000-mcp-client.ts`** | Documented in both plans' Deviations sections | Reviewed both diffs' rationale. 11-05's fixes were regressions caused by its own registration-loop shape (necessary, minimal, mechanical). 11-08's exports/override are targeted, single-purpose extensions that avoid a second parser / a second spawn path (the alternative would have been a worse violation of the single-seam rule). **Necessary and in-scope; not a planning defect worth blocking on.** Worth a light planning-process note: both plans' `files_modified` lists under-declared their true footprint, which is a repeated-enough pattern (11-08 alone touched two files outside its list) that a future phase's planner could tighten dependency analysis for modules with structural discoverers. |

### Anti-Patterns Scanned

No blocking anti-patterns found in phase-touched files: no unresolved `TBD`/`FIXME`/`XXX`, no
placeholder returns (`return null`/`return {}`/`=> {}`) in the new r2000 modules, no
misleading-success patterns (the entire client seam is built specifically to avoid this class,
per its own module header and the D-10/T-11-FALSESUCCESS discipline). `saveAndVerify()`'s
hash-based persistence check and the two-session/two-emulator evidence artifacts are the strongest
form of "never trust a misleading success" available in this codebase.

### Human Verification Required

None. Both items ROADMAP-level evidence design flagged as needing a real session boundary /
real emulator (11-VALIDATION.md's "Manual-Only Verifications" table) were executed and their
resulting artifacts were independently read and mechanically re-checked by this verifier
(sha256 comparison re-run, live `node --test` re-run against real regenerator2000/ACME/VICE
binaries). No further human action is needed to confirm the phase goal.

### Gaps Summary

No blocking gaps. The one open item is a bookkeeping omission, not an implementation gap: all
five requirement IDs (`R2000-10`, `R2000-11`, `R2000-13`, `R2000-14`, `R2000-15`) remain unchecked
in `REQUIREMENTS.md` despite being genuinely satisfied by the phase's complete body of work (see
Requirement-ID Traceability above). Recommend running `requirements.mark-complete` for all five
before or during milestone close.

---

_Verified: 2026-08-21_
_Verifier: Claude (gsd-verifier)_
