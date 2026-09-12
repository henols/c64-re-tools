---
phase: 52-remove-the-fork-backend
verified: 2026-09-12T11:37:17Z
status: gaps_found
score: 7/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "The decision records retaining the fork backend are gone (Phase 52 Goal clause 4: \"...and the decision records retaining it are gone\")"
    status: failed
    reason: >
      CLAUDE.md -- the single document loaded into every Claude Code session
      for this project, confirmed loaded into this very verification session
      -- retains extensive, mechanically false narrative describing the
      removed fork transport as current architecture. Plan 52-09's own commit
      message scoped its CLAUDE.md edit to "the two falsified CLAUDE.md
      constraints" (the bulleted `## Constraints` list, byte-synced against
      PROJECT.md and covered by docs-constraints-sync.test.ts) and did not
      touch the Architecture / Technology Stack / Platform Requirements /
      Error Handling sections below it, which read as current-state
      documentation, not history. No guard in the repository checks this
      prose: docs-fork-absence.test.ts only scans CLAUDE.md for a fixed list
      of forbidden CODE IDENTIFIERS (VICE_BACKEND, DENY_LIST, etc.) and
      DELETED MODULE FILENAMES appearing as literal path strings -- it does
      not check narrative sentences describing what those files DO, so a
      sentence like "src/mcp/vice/vice.ts ... owns ... deny-list enforcement"
      passes because "vice.ts" alone is not on either forbidden list in the
      exact form scanned. docs-constraints-sync.test.ts only compares the
      `## Constraints` bullet block, not the rest of the document.
    artifacts:
      - path: "CLAUDE.md:87"
        issue: "\"`x64sc` - a **custom/patched build** of the VICE emulator that exposes a non-upstream `-mcpserver` flag ... This is the load-bearing external dependency the whole `vice` MCP tool surface is built on.\" -- false: the fork was removed 2026-09-12 and stock x64sc is the only backend."
      - path: "CLAUDE.md:109"
        issue: "\"A reachable host running VICE (`x64sc`, custom `-mcpserver` build) for any live emulator interaction\" -- same falsehood restated in Platform Requirements."
      - path: "CLAUDE.md:176"
        issue: "Component Responsibilities table row: \"Transport seam | ... owns retry ladder, SSE parsing, deny-list enforcement, epoch/restart detection | `src/mcp/vice/vice.ts`\" -- cites a deleted file (`vice.ts` does not exist on disk) and a deleted mechanism (`DENY_LIST`, required gone by FORKRM-04) as a live component."
      - path: "CLAUDE.md:177"
        issue: "\"Liveness probe | ... (distinct from `vice.ts`'s resilient path) | `src/mcp/vice/vice-probe.ts`\" -- cites two deleted files (`vice.ts`, `vice-probe.ts`; both required gone by FORKRM-01) as a live component row."
      - path: "CLAUDE.md:186"
        issue: "\"Manifest refresh | Regenerates `tools-manifest.json` from the live host server's `tools/list` | `src/mcp/vice/refresh-manifest.ts`\" -- cites a deleted file and a deleted manifest, contradicting FORKRM-06 (\"nothing regenerates a manifest from a live host any more\")."
      - path: "CLAUDE.md:148"
        issue: "\"Base: `class ViceError extends Error` (`src/mcp/vice/vice.ts:250`)\" -- wrong file and wrong line; `ViceError` now lives at `src/mcp/vice/vice-errors.ts:158` (confirmed on disk), and `vice.ts` does not exist."
      - path: "CLAUDE.md:223,248,255,264"
        issue: "Four more citations of `vice.ts` / `refresh-manifest.ts` as live, holding-state or currently-regenerating modules (Data Flow, Entry Points, Architectural Constraints, Error Handling sections)."
      - path: ".planning/PROJECT.md:437,694"
        issue: "Two Key Decisions rows outside the FORK-01/Out-of-Scope pair named by criterion 2 still describe SID read-back as currently \"routes to the fork backend\" / \"Switchability routes SID work to the fork\" -- not historical-tagged, read as live decisions, and now false now that the fork has been removed. Lower-severity than the CLAUDE.md findings (PROJECT.md's own convention is that most of this table is a decision LOG refreshed at milestone-close review, and the adjacent FORK-01 row two lines below IS correctly reversed), but it is the same class of leftover decision-record and was not caught by docs-fork-decision.test.ts, which is scoped only to the FORK-01 row and the Out of Scope bullet."
    missing:
      - "Rewrite CLAUDE.md's Key Dependencies, Component Responsibilities, Layers, Data Flow, Entry Points, Architectural Constraints and Error Handling prose (not just the `## Constraints` bullet list) to describe the single stock backend, `resolvedBackend()`/`backend-detect.mts`, and `vice-errors.ts`, and to drop every reference to `vice.ts`, `vice-probe.ts` and `refresh-manifest.ts` as if they still exist."
      - "Either widen docs-fork-absence.test.ts (or add a sibling guard) to catch a deleted filename appearing as a live citation anywhere in CLAUDE.md/README.md prose, not only the nine forbidden code identifiers -- otherwise this class of drift can recur silently next phase."
      - "Optional, lower priority: reword or historically-tag PROJECT.md lines 437 and 694 so they read as superseded rather than current."
deferred: []
behavior_unverified_items: []
human_verification:
  - test: "Read the three verbatim replacement sentences quoted below (from 52-10-SUMMARY.md's carried-forward human check) in their actual files and judge whether each states a true, useful permanent limitation rather than merely omitting a tool."
    expected: >
      Each of the nine rewritten skill fork-routing sites should name the
      unavailable tool, state it as PERMANENT (not conditional), give the
      hardware/protocol reason, and name an alternative or state plainly that
      none exists -- not merely delete the old fork-routing sentence and leave
      a gap.
    why_human: "A grep can confirm the phrase \"requires the fork\" is absent from skill text (confirmed: 0 hits across src/skills/*.md this session); it cannot judge whether the sentence that replaced it is true and useful to a reader. This is plan 52-10's own stated human check, carried to end-of-phase per workflow.human_verify_mode. Quoted for direct judgment:\n\n> `src/skills/c64-program-recon/references/control-flow.md:85-89`\n> \"experiment is not currently possible: **`vice_keyboard_restore` is permanently unavailable.** The RESTORE key pulses the NMI line directly and is not part of the keyboard matrix, so `KEYBOARD_FEED` (which only injects PETSCII text into the buffer) cannot produce it; calling the tool returns an error naming the reason, rather than pulsing RESTORE. No client-side substitute exists -- see `docs/stock-hard-losses.md`. The reset half of the experiment remains testable: arm the checkpoint, call `vice_machine_reset` soft and hard, and record where the PC actually lands.\"\n\n> `src/skills/c64-program-recon/references/observation-hazards.md:107-110`\n> \"**`vice_keyboard_matrix` is permanently unavailable.** The binary monitor's `KEYBOARD_FEED` (0x72) only injects PETSCII text into the KERNAL keyboard buffer; the emulator recomputes CIA port B from its own keyboard array on every read, so there is no wire command that can drive the raw matrix -- this is unrecoverable, not merely unbuilt. See `docs/stock-hard-losses.md`. Use `vice_keyboard_type` / `vice_keyboard_petscii` when the gate reads the KERNAL buffer, or...\"\n\n> `src/skills/c64-ram-capture/SKILL.md:162-164`\n> \"Press past any \\\"hit any key\\\" gate. **`vice_keyboard_matrix` is permanently unavailable** -- the binary monitor's `KEYBOARD_FEED` only injects PETSCII text into the KERNAL buffer and cannot drive the raw matrix; see `docs/stock-hard-losses.md`. Use `vice_keyboard_type` / `vice_keyboard_petscii` when the gate reads the KERNAL buffer, or `vice_joystick_set` when it polls the matrix directly; buffer injection stays invisible to a program polling `$DC00`/`$DC01` itself.\""
  - test: "Confirm PROJECT.md's FORK-01 row, its `### Out of Scope` bullet, and the completed todo's SUPERSEDED block agree, and that no other currently-read location still states the retain disposition as the answer."
    expected: "All three read consistently reversed; no location a reader would naturally hit still says 'retain' as the current answer."
    why_human: "52-10's own executor read is that no contradiction exists among the three named sources, but this is exactly the kind of self-graded claim this project's own convention treats as needing an independent human read rather than the same executor's say-so. (This verifier independently found two additional Key Decisions rows, PROJECT.md:437 and :694, that were NOT checked by 52-10's three-source read and that DO still describe SID read-back as routing to the fork -- see the gap above.)"
---

# Phase 52: Remove the Fork Backend Verification Report

**Phase Goal:** The `barryw/vice-mcp` fork stops being a supported backend. Its
transport, its manifest, its probe, its per-backend branching and the decision
records retaining it are gone, and stock's three hard losses are recorded as
accepted rather than hedged.
**Verified:** 2026-09-12T11:37:17Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (the seven ROADMAP success criteria, plus one derived from the Goal's own text)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `VICE_BACKEND`, `probeBackend()`, `resolvedBackend()`'s fork branch, `buildBackendAwareTool()` and every `backend === "fork"` test are gone; no module imports a fork transport | ✓ VERIFIED | `grep -rn "VICE_BACKEND\|probeBackend\|buildBackendAwareTool"` across `src/mcp/vice/*.ts`/`*.mts` returns only test-name/comment/regression-guard hits, never a live export or a live branch. `resolvedBackend()` (`backend-detect.mts:308`) has no fork branch; `ViceBackend` is `type ViceBackend = "stock"` (single literal, `backend-detect.mts:58`). `vice.ts` and `vice-probe.ts` are absent from disk. Full census of `"fork"`/`VICE_BACKEND` across all 10 automated-set test files that still mention it (`audit-integrity.test.ts`, `backend-detect.test.ts`, `broker-control.test.ts`, `broker-kill.test.ts`, `host-tool-oracle.test.ts`, `host-tool.test.ts`, `skill-honesty-checks.test.ts`, `spawn-seam.test.ts`, `stock-dispatch.test.ts`, `vice-broker-supervision.test.ts`) shows every hit is a comment/regression-guard/assertion that a fork branch is ABSENT, never a live conditional. `text-capability-probe.ts`'s `LegacyViceBackend = "fork" \| "stock"` is a deliberately retained, explicitly-commented PERMANENT cross-check type (broker-vs-process identity disagreement) that is never assigned `"fork"` anywhere in the codebase (`grep -n "backend:" text-capability-probe.ts` shows no such assignment) — judged not to violate this criterion since it imports no fork transport and encodes no backend-selection branch. |
| 2 | `PROJECT.md`'s `FORK-01` row and `### Out of Scope` fork bullet state the REVERSAL with date/basis; `docs-fork-decision.test.ts` rewritten to pin the new decision | ✓ VERIFIED | `PROJECT.md:710` (Key Decisions): `**REVERSED** (2026-09-12): the forked VICE MCP backend has been removed...` with both withdrawn grounds and a named non-trigger. `PROJECT.md:438` (`### Out of Scope`): "Re-adding the fork backend... was removed on 2026-09-12... See `docs/stock-hard-losses.md`". `node --test docs-fork-decision.test.ts`: 7/7 pass, including non-vacuity, date format, `KEYBOARD_MATRIX_SET` case-sensitivity, reversal-trigger phrase and the `docs/stock-hard-losses.md` cross-citation. |
| 3 | Stock's three hard losses (SID read-back, matrix keyboard, RESTORE/NMI) are ACCEPTED, dated, evidenced; stop being "routed to the fork" in skill text | ✓ VERIFIED | `docs/stock-hard-losses.md` exists, dated 2026-09-12, with a named `## SID read-back — ACCEPTED`, `## Matrix keyboard — ACCEPTED`, `## RESTORE / NMI — ACCEPTED` section each carrying reason/affected-tool/alternative. `grep -rli "fork\|barryw" src/skills/*/SKILL.md src/skills/*/references/*.md` returns zero files. `check-skill-capability-honesty.mjs` exits 0 (9 permanent-limitation mentions, 6 permanently-unavailable names policed, 0 stale phase-deferral prose). Note: this criterion's text is scoped to "skill text"; see the gap above for two adjacent `PROJECT.md` Key Decisions rows (lines 437, 694) that still describe SID read-back as routing to the fork — outside "skill text" so not counted against this specific truth, but flagged as a related residual. |
| 4 | `DENY_LIST`/`denyListRefusalMessage()` gone with their six consumers; `anno-tools.ts`'s inverted allowlist unchanged | ✓ VERIFIED | `grep -rn "DENY_LIST\|denyListRefusalMessage" src/mcp/vice/*.ts src/mcp/vice/*.mts` (excluding test files) returns zero hits outside `docs-fork-absence.test.ts`'s own forbidden-identifier literal strings. `anno-tools.ts` retains `CURATED_ANNO_TOOLS`, `assertAnnoBatch()`, `ANNO_MAX_BATCH_DEPTH = 4` fully intact and still enforced (`git log` shows only a comment-citation edit, `bcc8f6b6`, no logic change). Known, disclosed residual: `vice-proxy.test.ts` (confirmed genuinely `MANUAL_ONLY_TESTS`-excluded via `test-gate.mjs:127`, so never runs in `test:automated`) still contains structural tests reading a deleted `vice.ts` via `readFileSync` that would throw if ever executed — recorded in `.planning/WINDOWS.md` row 60, matches the disclosure exactly. |
| 5 | `capability-registry.ts` resolved by a recorded decision | ✓ VERIFIED | Absent from disk. `52-07-SUMMARY.md` records the decision (deleted, not repurposed) with its precondition check (all six hardware-entry reason strings confirmed present verbatim in `docs/stock-hard-losses.md` before deletion) and names a third undiscovered consumer (`check-skill-tool-coverage.mjs`) it repaired as a Rule-3 deviation. `check-skill-tool-coverage.mjs` runs clean (exit 0) with a hand-maintained literal replacing the derived import. |
| 6 | `tools-manifest.stock.json` the only manifest; `refresh-manifest.ts`/`tools-manifest.json` gone; nothing regenerates from a live host | ✓ VERIFIED | `ls src/mcp/vice/*manifest*.json` → exactly `tools-manifest.stock.json`. `refresh-manifest.ts` absent from disk. `vice-proxy.ts`'s `tools/list` handler is a pure offline read of the committed snapshot (confirmed by reading the handler, no `fetch`/network call). `node scripts/check-npm-packages.mjs` exits 0. Remaining `refresh-manifest`/`refresh-manifest.ts` mentions in `vice-proxy.ts`, `probe-binmon.mjs`, `stock-machine.test.ts` are historical comments, not live regeneration code. |
| 7 | `npm run test:automated` green at the documented floor, fork-conditional branches in 12 test files removed rather than skipped | ✓ VERIFIED (at documented floor, not literally 0-fail) | `npm run test:automated` (`node test-gate.mjs`) exits 1 with exactly 7 failures / 4096 tests / 4080 pass, and the 7 are byte-for-byte the ones named in the task's `<measured_test_state>`: `annoRegisterEntryFor()`, `DIRECTION 5 (basis integrity)`, `planted violation (the negative control)`, `no milestone audit declares a gated status while any docs guard is red (D-12-02)`, `every pending todo has a row in STATE.md's Deferred Items section (AUDIT-04)`, `planted violation: both predicates fire`, and `every REVIEW.md finding id ... has a recorded disposition (AUDIT-01, self-applied)` — 6 unchanged pre-existing plus 1 introduced by this phase's own code-review gate (dispositioned below, which should turn this 7th member green on a subsequent run once this VERIFICATION.md is committed). `test-gate.test.ts` (3/3 pass) confirms `MANUAL_ONLY_TESTS` contains exactly the twelve dispositioned files and the automated+manual partition equals the on-disk set with no overlap. Census of `"fork"`/`VICE_BACKEND` in every automated-set test file (see truth 1) confirms no live conditional branch survives; every hit is a comment or a regression guard proving absence. |
| 8 (derived from the Goal's own text: "...the decision records retaining it are gone") | The documents this project loads into every working session no longer describe the fork transport, deleted files, or per-backend selection as CURRENT architecture | ✗ FAILED | See `gaps` in frontmatter. `CLAUDE.md` — confirmed loaded into this very verification session as project instructions — retains at least 8 falsifiable statements across its Key Dependencies, Component Responsibilities, Layers, Data Flow, Entry Points, Architectural Constraints and Error Handling sections describing `vice.ts`/`vice-probe.ts`/`refresh-manifest.ts` as live files with live responsibilities (including "deny-list enforcement", which criterion 4 requires gone), and describing stock `x64sc` as "a custom/patched build" and "the load-bearing external dependency" (both now false). Plan 52-09 explicitly scoped its CLAUDE.md edit to only the `## Constraints` bullet list (its own commit message: "the two falsified CLAUDE.md constraints"); no plan in this phase touched the Architecture/Technology-Stack sections. No existing guard checks this — `docs-fork-absence.test.ts` only scans for 9 literal forbidden CODE IDENTIFIERS and 6 literal DELETED MODULE FILENAMES, not narrative prose naming those files as live; `docs-constraints-sync.test.ts` only compares the `## Constraints` bullet block. |

**Score:** 7/8 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/mcp/vice/backend-detect.mts` | `ViceBackend` narrowed to `"stock"`, `resolvedBackend()` with no fork branch | ✓ VERIFIED | Confirmed, see truth 1 |
| `src/mcp/vice/vice.ts` | Deleted | ✓ VERIFIED (absent) | `ls` confirms absent |
| `src/mcp/vice/vice-probe.ts` | Deleted | ✓ VERIFIED (absent) | `ls` confirms absent |
| `src/mcp/vice/vice-errors.ts` | Shared error hierarchy split out of `vice.ts` | ✓ VERIFIED | `class ViceError extends Error` at line 158 |
| `src/mcp/vice/refresh-manifest.ts` | Deleted | ✓ VERIFIED (absent) | `ls` confirms absent |
| `src/mcp/vice/tools-manifest.json` | Deleted | ✓ VERIFIED (absent) | `ls` confirms absent |
| `src/mcp/vice/tools-manifest.stock.json` | Sole manifest | ✓ VERIFIED | Present, referenced by `vice-proxy.ts`, `stock-dispatch.ts`, `check-npm-packages.mjs`'s `files[]`, README.md |
| `src/mcp/vice/capability-registry.ts` | Deleted by decision | ✓ VERIFIED (absent) | `ls` confirms absent; decision recorded in `52-07-SUMMARY.md` |
| `docs/stock-hard-losses.md` | New acceptance record | ✓ VERIFIED | Present, dated, three named ACCEPTED sections |
| `src/mcp/vice/docs-fork-decision.test.ts` | Rewritten, not deleted | ✓ VERIFIED | 7/7 tests pass, asserting the reversal, not the retain decision |
| `src/mcp/vice/docs-fork-absence.test.ts` | New, non-vacuous absence guard | ✓ VERIFIED (present, scope-limited) | 13 tests present; scope confirmed limited to literal identifiers/filenames, not narrative prose — see gap above |
| `src/mcp/vice/anno-tools.ts` | Allowlist unchanged | ✓ VERIFIED | `CURATED_ANNO_TOOLS`/`assertAnnoBatch`/`ANNO_MAX_BATCH_DEPTH` all present and enforced |
| `CLAUDE.md` | Reflects the single-backend architecture wherever it describes current state | ✗ STALE (Architecture/Tech-Stack/Platform-Requirements/Error-Handling sections) | See gap above; only the `## Constraints` bullet list was corrected |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `vice-proxy.ts` | `stock-dispatch.ts` | `resolveAdvertisedToolDefinition()` | ✓ WIRED | Called exactly once per `stock-dispatch.test.ts`'s own structural test (`structure/proxy: vice-proxy.ts CALLS resolvedBackend() exactly once`, confirmed passing) |
| `vice-proxy.ts` | `tools-manifest.stock.json` | Offline read at `tools/list` | ✓ WIRED (data-flow confirmed static-file, by design) | Handler reads the committed snapshot only, no network path — this is the INTENDED behavior post-removal, not a stub |
| `broker-launch.mts`'s `buildViceArgs()` | stock argv | `backend === "stock"` branch | ✓ WIRED (but with dead sibling branch) | Live branch correct; the `else` sibling branch producing `-mcpserver` argv is provably unreachable given `ViceBackend`'s single-literal type — recorded as WR-01 disposition below, not blocking |

### Requirements Coverage

| Requirement | Source | Description | Status | Evidence |
|-------------|--------|-------------|--------|----------|
| FORKRM-01 | REQUIREMENTS.md:77 | fork branch/selection code gone | ✓ SATISFIED | Truth 1 |
| FORKRM-02 | REQUIREMENTS.md:78 | PROJECT.md reversal + guard rewrite | ✓ SATISFIED | Truth 2 |
| FORKRM-03 | REQUIREMENTS.md:79 | three hard losses accepted, not routed to fork in skill text | ✓ SATISFIED | Truth 3 |
| FORKRM-04 | REQUIREMENTS.md:80 | DENY_LIST gone, anno-tools.ts unchanged | ✓ SATISFIED | Truth 4 |
| FORKRM-05 | REQUIREMENTS.md:81 | capability-registry.ts resolved by decision | ✓ SATISFIED | Truth 5 |
| FORKRM-06 | REQUIREMENTS.md:82 | single manifest, no live regeneration | ✓ SATISFIED | Truth 6 |
| FORKRM-07 | REQUIREMENTS.md:83 | test:automated green at documented floor | ✓ SATISFIED | Truth 7 |

REQUIREMENTS.md traceability table (lines 156-162) shows all seven as `Complete`, traced to Phase 52. No orphaned Phase-52 requirement ids found in REQUIREMENTS.md beyond these seven.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `CLAUDE.md` | 87, 109, 148, 176, 177, 186, 223, 248, 255, 264 | Stale narrative describing deleted files/mechanisms as current | 🛑 Blocker (see gap) | Misleads every future session working on this codebase |
| `src/mcp/vice/broker-launch.mts` | 382-383, 852-875, 1092-1093 | Dead fork-only argv/probe branch (`WR-01`) | ⚠️ Warning | No functional risk (unreachable); maintenance debt |
| `src/mcp/vice/vice-broker-client.ts` | 626-644, 1084-1109 | `warm_floor: number` field parses to `NaN`, wire never sends it (`WR-02`) | ⚠️ Warning | No live consumer reads `.warmFloor` today; latent trap for a future one |
| `src/mcp/vice/vice-proxy.ts` | 676-678 | Missing semicolon (`WR-03`) | ℹ️ Info | ASI-safe here; style-convention violation only |
| `docs/stock-vice-parity.md` | 26-30 | Legacy "two things lost" count vs. the newer three-loss split (`IN-01`) | ℹ️ Info | Doc's own dated header note already defers to `docs/stock-hard-losses.md` |
| `.planning/PROJECT.md` | 437, 694 | Two Key Decisions rows still describe SID read-back as routing to the fork | ⚠️ Warning | Same class as the CLAUDE.md gap, smaller blast radius; folded into the gap above |

No `TBD`/`FIXME`/`XXX` debt markers found in any file this phase modified (checked against the phase's own commit range).

## Disposition of 52-REVIEW.md findings (WR-01, WR-02, WR-03, IN-01)

Recorded here to satisfy `docs-review-disposition.test.ts` (AUDIT-01), and judged on their merits rather than rubber-stamped, per the task's explicit instruction.

- **WR-01** (`broker-launch.mts`'s dead `-mcpserver`/`defaultHttpProbe()` fork-only code paths): **DEFERRED.** Verified genuinely dead — `ViceBackend` is a single-literal type (`"stock"`), so the `else` branches in `buildViceArgs()` and `probeReady()` can never execute given every real call site threads the same `resolvedBackend()`-derived value. No functional risk today. Already disclosed as a known residual by plan 52-06's SUMMARY and re-confirmed by 52-10. Recommend a small follow-up cleanup (drop the dead branches, or add a one-line comment stating the `backend` parameter is deliberately retained for a hypothetical future backend) — not a phase blocker. No todo currently exists for this; filing one is recommended but is not this verifier's job to create.
- **WR-02** (`vice-broker-client.ts`'s `warm_floor: number` field silently yields `NaN`): **DEFERRED.** Confirmed real — the broker stopped sending this field in phase 41-05, `broker-control.test.ts:347` asserts its absence on the wire, and `Number(undefined)` is `NaN`. Confirmed via code read that no current caller reads `.warmFloor` (only `.backend`/`.vice_bin` are consumed in `text-tools.ts`), so this is inert today. It sits in a file this phase touched but is not caused by this phase's work — it is uncleared debris from phase 41-05's warm-floor removal, only surfaced now because this phase's review touched the same interface. Recommend a follow-up: delete the `warm_floor` field from `ControlHostStateFields` and `hostState()`'s return object. Not a phase-52 blocker.
- **WR-03** (`vice-proxy.ts:678` missing semicolon): **ACCEPTED (trivial, non-blocking).** Confirmed cosmetic — ASI makes this safe here since the next statement cannot be parsed as a continuation, and the review's own analysis agrees. A one-character fix is trivially safe to make in a future pass; not worth a dedicated follow-up on its own.
- **IN-01** (`docs/stock-vice-parity.md`'s legacy "two things lost" line vs. the newer three-loss split): **ACCEPTED (informational only).** Confirmed the document's own dated header note already defers loss-accounting to `docs/stock-hard-losses.md`, so a reader who reads the header first is not misled. The optional parenthetical improvement suggested by the review is a nice-to-have, not required.

## Human Verification Required

See `human_verification` in the frontmatter for the two carried-forward checks (skill-sentence quality with verbatim quotes, and the FORK-01/Out-of-Scope/todo three-way consistency check, now supplemented by this verifier's independent finding of two additional stale PROJECT.md rows the original three-way read did not cover).

## Gaps Summary

All seven of the ROADMAP's explicitly-numbered success criteria are met, verified directly against the tree rather than taken from any SUMMARY's word: the fork's transport, probe, manifest, `DENY_LIST`, and `capability-registry.ts` are genuinely deleted; `anno-tools.ts`'s allowlist is untouched; `PROJECT.md`'s `FORK-01` row and `docs-fork-decision.test.ts` correctly state and pin the reversal; `docs/stock-hard-losses.md` correctly records the three permanent losses; and `npm run test:automated` reproduces exactly the documented 7-member failure floor with no new, unexplained member.

The one gap this verification found is not among the seven numbered criteria, but sits squarely inside the phase's own Goal sentence: "...its per-backend branching and **the decision records retaining it are gone**." `CLAUDE.md` — the project's own root instructions file, confirmed loaded into this very verification session — still describes the deleted fork transport (`vice.ts`, `vice-probe.ts`, `refresh-manifest.ts`, `DENY_LIST`) as live architecture in at least 8 places across its Architecture, Technology Stack, Platform Requirements and Error Handling sections, and still describes stock `x64sc` as "a custom/patched build" that is "the load-bearing external dependency" — precisely backwards from what this phase shipped. This was not caught by any of the phase's own guards because `docs-fork-absence.test.ts` polices a fixed list of code identifiers and deleted-module filenames appearing verbatim, not narrative sentences describing what those files do, and `docs-constraints-sync.test.ts` only covers the much narrower `## Constraints` bullet block that plan 52-09 explicitly and correctly limited its edit to. A smaller, same-class residual survives in `.planning/PROJECT.md`'s Key Decisions table (two rows outside the `FORK-01` pair still describe SID read-back as routing to the fork).

This is exactly the deletion-dominated-phase failure mode this verification was asked to hunt for: not code left behind, but a document's claims about the code left behind and unfalsified by any guard. Recommend a small follow-up plan (or a `--gaps` round) that rewrites CLAUDE.md's non-Constraints prose and, ideally, widens `docs-fork-absence.test.ts` (or adds a sibling guard) so a deleted filename appearing as a live citation in prose is caught mechanically next time, not just a literal forbidden identifier.

---

_Verified: 2026-09-12T11:37:17Z_
_Verifier: Claude (gsd-verifier)_
