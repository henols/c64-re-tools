---
phase: 27-shared-seams-extracted
verified: 2026-08-27T09:42:27Z
status: passed
score: 30/33 must-haves verified
behavior_unverified: 0
overrides_applied: 1
prohibition_flags: 3
gaps: []
overrides:

  - must_have: "Full npm test (the whole glob, broker stopped, command named in the evidence) is green with zero r2000 modules deleted"
    reason: "The suite exits 1 with 44 pre-existing failures — 39 in vice-proxy.test.ts (MANUAL_ONLY_TESTS, needs a live host/broker) and 5 in r2000-session.test.ts (regenerator2000 absent from PATH, logged D-27-02-A). Both files were last touched in phase 18 and are in no phase-27 plan's files_modified. Zero failures in any file phase 27 touched; tsc exit 0; tarball closure clean; zero r2000 modules deleted. The criterion's purpose — proving the extraction is a move, not a change — is met."
    accepted_by: "henrik"
    accepted_at: "2026-08-27T09:56:51Z"
deferred:

  - truth: "SEAM-03's second clause: 'COV-01/COV-02's census-versus-store boundary test passes against the NEW store'"
    addressed_in: "Phase 28"
    evidence: "ROADMAP Phase 27 SC-3 scopes the phase contract to 'passes across that boundary' (verified). The 'new store' half is unsatisfiable before a store exists; Phase 28's goal is 'The Store Core' and it declares 'Depends on: Phase 27 (the extracted seams and the capability-or-glue classification)'."
insufficient_spec_items:

  - truth: "block-class.ts declares no module-level mutable binding and its exported lookup is a pure function of its two arguments, so interleaved or repeated calls cannot observe each other's state; there is no concurrent or interruptible execution path in this single-threaded package to exercise the guarantee directly (SEAM-03 probe: concurrency)"
    reason: insufficient_spec
    verification_tag: backstop
    test: "Confirm the concurrency clause is genuinely unexercisable rather than merely unexercised — i.e. that no async, generator, worker-thread or re-entrant path can reach blockClassAt in a state where a future maintainer's memoising cache would matter."
    expected: "Either an accepted 'not applicable — single-threaded, pure, no interruptible path' judgement, or a held-out/property-based test if a future phase introduces one."
    why_human: "The truth is tagged `verification: backstop` and its own second clause concedes there is no execution path to exercise it. The STATIC half is fully and mechanically verified (block-class.test.ts's no-module-level-mutable-binding gate, incl. the WR-04 `const` mutable-container case, and its zero-imports gate — both passing). Presence + wiring never upgrades a backstop truth, so this abstains rather than passes."
prohibition_items:

  - statement: "MUST NOT leave any route by which the ACME hard-FAIL degrades into a silent skip: no re-export shim in the module the half leaves, no rename of ACME_BIN or VICE_REQUIRE_ACME, and no removal or weakening of the committed observation of the FAIL."
    plan: "27-01"
    verification: judgment
    judge_verdict: HOLDS
    judge_evidence: "`grep -in acme src/mcp/vice/r2000-test-gate.ts` returns nothing (no shim, no prose). `ACME_BIN` / `VICE_REQUIRE_ACME` byte-identical to the pre-phase body (diff of the stripped code bodies is a single leading blank line). ci.yml:140 still binds VICE_REQUIRE_ACME by name. The committed observation exists and I reproduced it out-of-band: exit=1 + the gate's own refusal wording under VICE_REQUIRE_ACME=1, exit=0 with it unset."
    flagged: true
    flag_reason: "unverified-prohibition — human review recommended (judgment-tier; enforcement evidence is strong but the disposition is non-authoritative)"

  - statement: "MUST NOT justify any module's capability-or-glue verdict by its name prefix, and MUST NOT leave an in-scope module, a deliberate scope exclusion, or a contested verdict unrecorded."
    plan: "27-05"
    verification: judgment
    judge_verdict: HOLDS_WITH_RESIDUAL
    judge_evidence: "Prefix half: mechanically enforced by Direction 4 over rationale + every consumer path + every symbol + every requirement id, with a planted name-justified entry proving non-vacuity and a clean control proving no false positive. Completeness half: I planted a REAL unclassified r2000-*.ts on disk and Direction 1 went red naming it. Scope exclusions: carried as data (`scope: \"out-of-enumeration\"`, 2 entries) plus four stated exclusions in the header. Contested verdict: r2000-test-gate.ts carries CONTESTED in its note (WR-10). RESIDUAL: `contested` is prose only, not a structured field, and `note` is deliberately exempt from Direction 4 — so a FUTURE contested verdict or a future prefix justification parked in `note` has no mechanical gate."
    flagged: true
    flag_reason: "unverified-prohibition — human review recommended (judgment-tier, plus the two named structural residuals)"

  - statement: "MUST NOT claim the phase's green run from the narrowed automated gate, or from a host with a live emulator broker, or state the result without naming the exact command, the broker state and the pass/fail/skip counts."
    plan: "27-05"
    verification: judgment
    judge_verdict: HOLDS
    judge_evidence: "27-05-SUMMARY.md names the command verbatim (`cd src/mcp/vice && npm test` = `node --test '*.test.*'`), asserts and states the broker/x64sc state with its own pgrep self-match trap recorded, gives 2636/2520/44/67/5 AND `EXIT 1`, dispositions all 44 by file, and explicitly refuses the laundering route: 'An honest red plus its cause is evidence; a green from a [narrowed gate] is not.' It does not claim green."
    flagged: true
    flag_reason: "unverified-prohibition — human review recommended (judgment-tier)"
human_verification:

  - test: "Decide whether ROADMAP Phase 27 SC-4's literal wording ('Full `npm test` ... is green') is accepted as met-in-intent. Re-run `cd src/mcp/vice && npm test` if desired (11+ min; will not terminate unaided — see deferred-items D-27-05-A)."
    expected: "Exit 1 with exactly 44 failures: 39 in vice-proxy.test.ts (MANUAL_ONLY_TESTS entry 2, needs a live host/broker) and 5 in r2000-session.test.ts (regenerator2000 not on PATH). Zero failures in any file phase 27 touched. Both files were last touched in phase 18 and appear in no phase-27 plan's files_modified."
    why_human: "The literal exit-0 reading is NOT met and was not met before this phase began. Whether a pre-existing, fully attributed environmental red is acceptable against a criterion that says 'green' is a scope judgement, not a codebase fact. See the override suggestion in the Gaps Summary."

  - test: "Resolve the backstop-tagged SEAM-03 concurrency abstention (see insufficient_spec_items)."
    expected: "An explicit 'not applicable — single-threaded, pure, no interruptible path' acceptance, or a held-out test."
    why_human: "verification: backstop — abstention is required absent explicit exogenous evidence."

  - test: "Resolve the three judgment-tier prohibitions (see prohibition_items). My verdicts are HOLDS, HOLDS_WITH_RESIDUAL, HOLDS — all non-authoritative."
    expected: "Explicit acceptance, or a decision to promote `contested` to a structured field and/or extend Direction 4 to `note`."
    why_human: "Judgment-tier prohibitions are never silently absorbed into a passing verdict."
---

# Phase 27: Shared Seams Extracted — Verification Report

**Phase Goal:** Every module a prefix-driven deletion would silently take with it stands under a name that does not say `r2000`, its surviving consumers are proven still served, and the classification that decides what may be deleted at all is on the record — before a line of store code exists.

**Verified:** 2026-08-27T09:42:27Z
**Status:** human_needed
**Re-verification:** No — initial verification (no prior `27-VERIFICATION.md`)

**Verification stance:** adversarial. Every claim below was re-derived from the codebase, not read out of a SUMMARY. Where a SUMMARY claim and my own measurement agree, I say so; where they diverge, I say which one the codebase supports. Two guards were proven by **planting the violation they exist to catch** (a real on-disk unclassified module; a real missing-ACME child run), because "the guard is green" is not evidence when the failure mode under test is a guard that is green while blind.

---

## Goal Achievement

### Observable Truths — ROADMAP Success Criteria (the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| R1 | A run with `VICE_REQUIRE_ACME=1` and `ACME_BIN` at a nonexistent path makes the suite **FAIL** — observed — from the extracted gate under its new non-`r2000` name; `ACME_BIN` / `VICE_REQUIRE_ACME` / `assertAcmeRequiredIfEnvSet` keep byte-identical names | ✓ VERIFIED | **Independently reproduced, not read from a report.** I wrote my own probe importing `src/mcp/vice/acme-gate.ts` by absolute path: `VICE_REQUIRE_ACME=1 ACME_BIN=<nonexistent>` → **exit 1, `# fail 1`**, output contains the gate's own wording `VICE_REQUIRE_ACME is set but no real ACME was found at`. Same child with `VICE_REQUIRE_ACME` deleted → **exit 0, `# fail 0`**. The committed observation (`acme-gate.test.ts`) also runs green on demand: 6/6. Names: the stripped code body of `acme-gate.ts:68-123` diffs against the pre-phase `r2000-test-gate.ts:114-170` body with **a single leading blank line** as the only difference. `ci.yml:140` still reads `VICE_REQUIRE_ACME: "1"`. See caveat C-1 below on the "ci.yml is repointed" clause. |
| R2 | Every `r2000-*` module carries a recorded capability-or-glue classification derived from what it does, no classification cites a name prefix, and the ten named capability modules are provably not deletable by prefix | ✓ VERIFIED | `MODULE_CLASSIFICATION` = 19 entries (17 in-enumeration, 2 out-of-enumeration). **All ten ROADMAP-named modules present and verdict `capability`**: `-test-gate`, `-acme-ident`, `-confidence`, `-symbols`, `-verify`, `-memmap-render`, `-d64`, `-regbits-gen`, `-enum-gen`, `-coverage` (plus `r2000-regbits.json`). Prefix prohibition is **mechanical, not promised**: Direction 4 scans rationale + every consumer path + every symbol + every requirement id against six phrase patterns; a planted name-justified entry is reported and a clean control is not. `module-classification.test.ts`: **18/18 pass**. |
| R3 | `r2000-coverage.ts`'s store contact is a named, repointable boundary rather than functions comparing against upstream's Rust `Display` strings, and the `COV-01`/`COV-02` census-versus-store boundary test passes across that boundary | ✓ VERIFIED | `r2000-coverage.ts` imports exactly `block-class.ts`, `disasm-decoder.ts`, `prg-image.ts`, `r2000-confidence.ts`. `grep -n '"Code"\|"Undefined"\|"Data"' r2000-coverage.ts` → **no match**. `R2000BlockEntry` no longer exists anywhere in the tree. The named test — *"independence: rewriting every block entry to one type leaves every census byte count unchanged and moves only the divergence sub-report"* (`r2000-coverage.test.ts:614`) — **runs green when invoked by name**. Whole file: **113/113 pass**. |
| R4 | Full `npm test` (whole glob, broker stopped, command named) is green with **zero** `r2000` modules deleted | ⚠️ PARTIAL — see C-2 | **Zero-deletions half: VERIFIED by my own query.** `git log 0acaf25~1..HEAD --diff-filter=D --name-only` over the whole phase range returns **nothing at all** — not one deletion anywhere, let alone under `src/mcp/vice/r2000*`. Ten files added, zero removed. `package.json` `files[]` diff is **exactly two additions** (`block-class.ts`, `prg-image.ts`). **"Green" half: NOT MET.** The suite exits 1 with 44 failures, and did so before this phase began. Every evidence obligation the criterion attaches (named command, stated broker state, pass/fail/skip counts) IS met, and the SUMMARY does not claim green. Routed to human decision, not counted as verified. |

### Observable Truths — Plan `must_haves`

**Plan 27-01 (SEAM-01 — `acme-gate.ts`)**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| P01-1 | Committed test observes the hard-FAIL by child `node --test` | ✓ VERIFIED | `acme-gate.test.ts:146` + `:157`; memoised via `failRun()` (WR-11). Reproduced independently. |
| P01-2 | The identical child run with `VICE_REQUIRE_ACME` **deleted** exits ZERO — the non-vacuity control | ✓ VERIFIED | `acme-gate.test.ts:167`; `delete env.VICE_REQUIRE_ACME` (deleted, not blanked). Reproduced: exit 0. **The control is not vacuous** — `delete env.NODE_TEST_CONTEXT` at `:121` and `:184` is what stops the child from silently refusing to run and exiting 0 on a broken gate; the header records that as a measured trap. |
| P01-3 | Same `ACME_BIN` default, same `/acme/i` test over combined stdout+stderr, byte-identical env-var names | ✓ VERIFIED | Code-body diff against pre-phase = 1 blank line. `acme-gate.test.ts:178` observes the `"acme"` default in a fresh child with `ACME_BIN` deleted (the only way to read a module-load `const`'s default behaviourally). |
| P01-4 | `r2000-test-gate.ts` retains the regenerator2000 half and all ten importers; no ACME symbol, prose or re-export | ✓ VERIFIED | `grep -in acme r2000-test-gate.ts` → exit 1, zero matches. Exports: `R2000_BIN`, `probeR2000`, `R2000_AVAILABLE`, `skipReasonFor`, `assertR2000RequiredIfEnvSet`. Importers of `./r2000-test-gate.ts`: **exactly 10**. |
| P01-5 | All four ACME-importing test files import from `./acme-gate.ts`; `r2000-cli.test.ts`'s mixed statement SPLIT into two | ✓ VERIFIED | `disasm-roundtrip.test.ts:57`, `skill-acme-build-cli.test.ts:50`, `r2000-answer-key.test.ts:234`, `r2000-cli.test.ts:27`. `r2000-cli.test.ts:22-27` is two statements: `{R2000_AVAILABLE, skipReasonFor, assertR2000RequiredIfEnvSet}` from the r2000 gate, `{ACME_AVAILABLE, assertAcmeRequiredIfEnvSet}` from `acme-gate.ts`. |

**Plan 27-02 (SEAM-03 — `block-class.ts`)**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| P02-1 | `blockClassAt` inclusive at both ends, `null` one step either side | ✓ VERIFIED | `block-class.test.ts:48` and `:53`. 12/12 pass. |
| P02-2 | A zero-overlap second vocabulary through the adapter holds all six structural counts + `classRuns` + every `fromBytes`, while `divergence.censusCodeStoreNotCode` moves | ✓ VERIFIED | `r2000-coverage.test.ts:701`. **The disjointness is itself asserted** (`:688`), not eyeballed: `EXECUTABLE_EXTENT`/`UNCLASSIFIED_EXTENT`/`OPAQUE_EXTENT` vs `Code`/`Undefined`/`Byte`/`Address`. Non-vacuity is stated as a **relation** (`after > before`), not a pinned 0 (WR-08). |
| P02-3 | Two builds over the same fixture are deep-equal | ✓ VERIFIED | `r2000-coverage.test.ts:789` (+ a second at `:1061`). |
| P02-4 | `r2000-coverage.ts` holds no store block-type literal and no reference to the moved store-shape type | ✓ VERIFIED | Grep: zero. `R2000BlockEntry` absent tree-wide. Backed by a committed SUPPLEMENT scan (`:820`) run through `codeOnly()` so a comment quoting the spelling cannot redden it (WR-09), plus WR-12's gate: *no shipped module passes `CoverageOptions.blockClassifier`*, built from `shippedTsModules()` + `codeOnly()` rather than a hand list. |
| P02-5 | The named independence test passes unchanged across the new boundary, incl. its trailing non-vacuity assertion | ✓ VERIFIED | Run by exact name: `ok 1`. |
| P02-6 | No module-level mutable binding; the lookup is pure in its two arguments; no concurrent path exists to exercise the guarantee (`verification: backstop`) | ⚠️ insufficient_spec (abstained) | **Static half fully verified:** `block-class.test.ts:195` rejects `let`/`var` AND a `const` mutable container (`new Map/Set/WeakMap/WeakSet`, `[`, `{`) — the WR-04 memoising-cache shape — scanned on strict `codeOnly()` output. `:136` asserts the import list is **empty**, via `codeOnly(raw, true)` across `from`-less, single-quoted and dynamic import shapes (WR-03), and separately prohibits `import(` entirely. **Concurrency half abstained:** the truth's own wording concedes no path exercises it; a `backstop` tag forbids upgrading on presence + wiring. |

**Plan 27-03 (SEAM-02/03 — `prg-image.ts`)**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| P03-1 | `parsePrg`, `flatImageOrigin`, `decodeRawData` exported from `prg-image.ts` under byte-identical names with byte-identical refusal messages; `r2000-project.ts` exports none | ✓ VERIFIED | **Diffed the moved bodies against pre-phase `r2000-project.ts:165-205`: the only change is one doc-comment sentence reworded.** Both refusal strings byte-identical, incl. the `${bytes.length} byte(s)` interpolation. `grep parsePrg\|flatImageOrigin\|decodeRawData r2000-project.ts` → zero matches (no shim). |
| P03-2 | Correction C-1 closed: the census takes `decodeRawData` from `prg-image.ts`, so deleting the glue module can no longer break it | ✓ VERIFIED | `r2000-coverage.ts:143` and `r2000-coverage.test.ts:64` both import from `./prg-image.ts`. **`r2000-coverage.ts` has no import from `r2000-project.ts` at all**, and `r2000-coverage.test.ts` contains zero occurrences of the string `r2000-project`. |
| P03-3 | `prg-image.ts` in `files[]`, and `check-npm-packages.mjs` validates both tarballs | ✓ VERIFIED | `files[]` includes it (`true`). I ran `node scripts/check-npm-packages.mjs`: *"transitive closure from vice-proxy.ts — 60 modules, clean"*, then **OK** — 77 files / 34 files + 7 skills. The closure walk is what would have caught a reachable-but-unlisted module. |
| P03-4 | The two validators refuse their out-of-range inputs with the original messages; `r2000-cli.ts`'s extension-before-length dispatch order unchanged | ✓ VERIFIED | Messages diffed byte-identical. The full phase-range diff of `r2000-cli.ts` contains **only** import/type lines — no control-flow change, so the `endsWith` → `65536` → `parsePrg` order is untouched. IN-03 additionally anchored the assertions on the message shape so the zero-length case is really pinned. |
| P03-5 | All nine consumer sites resolve: six mixed statements SPLIT, two `decodeRawData`-only rewritten, `r2000-d64.test.ts`'s dynamic path constant repointed | ✓ VERIFIED (with a documented deviation) | Nine consumers on disk: `r2000-cli.ts`, `r2000-coverage.ts`, `r2000-coverage.test.ts`, `r2000-project.test.ts`, `r2000-symbol-roundtrip.test.ts`, `r2000-verify.test.ts`, `r2000-tools.test.ts`, `r2000-mcp-client.test.ts`, `r2000-d64.test.ts`. The `56b7d0d` diff shows six splits and two rewrites, exactly as claimed. **Deviation, in the safe direction:** the last clause no longer applies — WR-07 replaced `r2000-d64.test.ts`'s dynamic import *and* its `existsSync`-gated skip with a **static** import (`r2000-d64.test.ts:11`), because the old form (a) skipped-and-reported-green on a broken checkout and (b) hid the moved symbol's signature from `tsc`. Zero `import(` remain in that file. This exceeds the truth rather than missing it. |

**Plan 27-04 (SEAM-02 — `shipped-modules.ts`)**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| P04-1 | `shippedTsModules()` exists once, in `shipped-modules.ts`; all four guard files import it; the four copies are deleted, not left beside an import | ✓ VERIFIED | Exactly one definition tree-wide (`shipped-modules.ts:151`). Importers: `docs-dangling-refs.test.ts:37`, `comment-phase-pointers.test.ts:74`, `stock-dispatch.test.ts:39`, `r2000-spawn-seam.test.ts:53` (+ two later consumers: `r2000-coverage.test.ts:65`, and `block-class.test.ts` for `codeOnly`). No residual local definitions. |
| P04-2 | A `files[]` entry naming a nonexistent file makes it **throw a named error** rather than shrink the scanned set | ✓ VERIFIED | `shipped-modules.ts:154-158` throws `ShippedFilesEntryMissingError`; `shipped-modules.test.ts:58` asserts the throw against a synthetic package dir driving the same code path. IN-05 corrected the provenance claim and named this as a deliberate assert→throw **upgrade** over the copies it replaced. |
| P04-3 | `codeOnly()` exists once and strips comment text **and** string/template-literal bodies — the property that makes the spawn-site scan trustworthy | ✓ VERIFIED — **and I proved the CR-01 fix is causal** | One definition (`:206`). I ran the current and the pre-`0802894` versions over the same two live modules: `r2000-coverage.ts` **1107 → 1765** visible lines, exported symbols visible **32 → 48**; `incident-record.ts` **89 → 389** lines, **7 → 14** exports. That is +23 previously-invisible exported symbols across the two files (the review named 19), matching the reported truncation figures exactly. `r2000-spawn-seam.test.ts` runs green over the un-truncated source. The regex branch is correctly ordered after `//` and `/*` and before the quote/backtick branches, and refuses an unterminated `/ … EOL` run so a misread division cannot eat the file in the opposite direction. |
| P04-4 | `shipped-modules.ts` absent from `files[]`, and its filename does not match the `*.test.*` glob | ✓ VERIFIED | `files[].includes("shipped-modules.ts")` → `false`. Filename has no `.test.` segment. |
| P04-5 | Both recorded statements of the sharing convention are rewritten, so the record states the scope once and does not contradict itself | ✓ VERIFIED | `93c0e2e` rewrites `comment-phase-pointers.test.ts:50-66` and `hop-chain-comments.test.ts:43-69` to the **same** wording ("a guard test must not import another guard test … importing a neutral non-test helper is permitted"), removes the old "keep duplicating" instruction, and names the one duplication deliberately kept (the comment *extractor*, a different helper, with its reason cited in code). |

**Plan 27-05 (SEAM-02 — `module-classification.ts`)**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| P05-1 | Every in-scope module/data file on disk has an entry; a later module with no entry makes the test FAIL, naming it | ✓ VERIFIED — **behaviourally, by a real plant** | I created a genuine `src/mcp/vice/r2000-verifier-plant-DELETEME.ts` on disk and ran Direction 1: `not ok 1`, error text *"these in-scope files have no capability-or-glue verdict: r2000-verifier-plant-DELETEME.ts"*. Plant removed; `git status` clean. This is the one that could not be trusted from the synthetic planted-violation test alone. |
| P05-2 | The non-vacuity guard is a DERIVED relation, never a pinned total | ✓ VERIFIED | `module-classification.test.ts:288` asserts `disk.length >= entries.length` with the threshold taken from the registry, plus `disk.length > 0`. The comment explicitly supersedes the in-repo `R2000_MODULE_FLOOR = 14` literal and says not to "restore" one. |
| P05-3 | No entry's basis rests on the name prefix; every cited consumer path is asserted to exist on disk | ✓ VERIFIED (with a scoped residual) | Direction 4 (`:349`) + Direction 3 (`:344`), both green over 19 entries. Sampled bases are substantive and behaviour-derived — e.g. `r2000-tools.ts` is `glue` *despite* three unprefixed consumers (`vice-proxy.ts:194`, a structural guard, a CI script), with the rationale naming that as exactly the trap; `r2000-confidence.ts` is `capability` with **no** unprefixed consumer, on requirement basis `COV-01,COV-02`. Residual: `note` is exempt from Direction 4 (documented, load-bearing) — see prohibition item 2. |
| P05-4 | No two entries name the same module; out-of-enumeration entries are excluded from the completeness loop | ✓ VERIFIED | Directions 7a/7b green. The two `scripts/lib/r2000-cli-verbs.*` entries carry `scope: "out-of-enumeration"` and are filtered by that marker, not by a special case. |
| P05-5 | Module values and on-disk filenames compared as exact strings incl. extension | ✓ VERIFIED | Direction 2 (encoding) green: `r2000-regbits.json` resolves, the stem `r2000-regbits` resolves to `undefined`. |
| P05-6 | Every assertion is order-independent — lookup by module key, proven over a reversed copy | ✓ VERIFIED | Direction 8 (`:444`) re-runs Directions 1-5, 7 and 9 over a reversed registry copy and compares results. |
| P05-7 | `consumers[].line` is optional and advisory; where present the cited line is asserted to CONTAIN the cited symbol | ✓ VERIFIED | Direction 9 (`:383`) + its own non-vacuity assertion (`:388`) + a planted-drift test (`:592`). WR-06 additionally extended this to the module's **prose** `path:NN` citations (Direction 9b, `:397`), incl. the bare-`:NN` continuation shape — the guard that was missing while the header called the drift liability "MEASURED, NOT HYPOTHETICAL". IN-07/`d16f923` repaired two real drifts. |
| P05-8 | Full-glob suite green with zero `r2000` modules deleted, evidenced by named command, broker state, counts, and a deletion query returning zero | ⚠️ PARTIAL — same substance as R4 | Zero-deletions + all four evidence obligations verified. "Green" not met. |

**Score:** 30/33 truths verified (0 present-but-behaviour-unverified; 1 abstained `insufficient_spec`; 2 partial — R4 and P05-8 are the same criterion counted once per source).

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | SEAM-03's second clause in REQUIREMENTS.md: "`COV-01`/`COV-02`'s census-versus-store boundary test passes **against the new store**" | Phase 28 | ROADMAP Phase 27 SC-3 scopes the phase contract to *"passes across that boundary"* — verified. The "new store" half is unsatisfiable before a store exists. Phase 28's goal is "The Store Core" and declares *"Depends on: Phase 27 (the extracted seams and the capability-or-glue classification)"*. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/mcp/vice/acme-gate.ts` | The ONE ACME-availability seam, non-`r2000` name, min 60 lines | ✓ VERIFIED | 123 lines. All five exports present. Wired by 4 test files + its own test. Correctly ABSENT from `files[]`. |
| `src/mcp/vice/acme-gate.test.ts` | Observed hard-FAIL + non-vacuity control + `files[]`-absence, contains `mkdtempSync`, min 80 | ✓ VERIFIED | 208 lines, `mkdtempSync` at `:95`, 6/6 pass. |
| `src/mcp/vice/block-class.ts` | The ONE store-block-vocabulary boundary, min 55 | ✓ VERIFIED | 137 lines. `BlockClass`, `BlockEntry`, `BlockClassifier`, `blockClassAt` all exported. **Import list empty**, mechanically asserted. Present in `files[]` (required — reachable from the published closure). |
| `src/mcp/vice/block-class.test.ts` | Boundary tests, vocabulary mapping incl. unknown fallthrough, import purity, min 60 | ✓ VERIFIED | 228 lines, 12/12 pass. |
| `src/mcp/vice/prg-image.ts` | Pure C64 byte-layout parsing, min 55 | ✓ VERIFIED | 102 lines. Three exports, byte-identical bodies. In `files[]`; tarball closure clean. |
| `src/mcp/vice/prg-image.test.ts` | Four relocated unit tests + payload round trip, min 45 | ✓ VERIFIED | 120 lines, pass. |
| `src/mcp/vice/shipped-modules.ts` | The ONE enumerator + the ONE full stripper, test-only, min 70 | ✓ VERIFIED | 393 lines. `shippedTsModules`, `codeOnly` (+ `ShippedFilesEntryMissingError`). Absent from `files[]`. |
| `src/mcp/vice/shipped-modules.test.ts` | `files[]`-absence, planted stale entry, template-literal cases, min 55 | ✓ VERIFIED | 249 lines, pass. WR-01/WR-02 added regex-literal, division-disambiguation and `keepLiteralBodies` cases. |
| `src/mcp/vice/module-classification.ts` | Committed classification with basis and scope exclusions, min 180 | ✓ VERIFIED | 711 lines. All four exports. 19 entries. Absent from `files[]`. |
| `src/mcp/vice/module-classification.test.ts` | The enforcing guard: 9 directions + planted violations, min 130 | ✓ VERIFIED | 633 lines, 18/18 pass, and **red on a real on-disk plant**. |

`gsd-tools query verify.artifacts` reports `all_passed: true` for all five plans (10/10 artifacts).

### Key Link Verification

`gsd-tools query verify.key-links` reports 2/17 verified. **Every one of the 15 "unverified" results is a tool false negative** — the checker looks for the target's full repo-relative path in the source, while the codebase (correctly) uses sibling relative specifiers, which is precisely what each plan's own `pattern` field encodes. Verified manually below.

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `disasm-roundtrip.test.ts` | `acme-gate.ts` | named import | ✓ WIRED | `:57` `import { ACME_BIN, acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./acme-gate.ts"` |
| `skill-acme-build-cli.test.ts` | `acme-gate.ts` | named import | ✓ WIRED | `:50`, same three symbols |
| `r2000-cli.test.ts` | `acme-gate.ts` | split import | ✓ WIRED | `:27`, `ACME_AVAILABLE` + `assertAcmeRequiredIfEnvSet` only; r2000 gate import kept separate at `:22-27` |
| `r2000-answer-key.test.ts` | `acme-gate.ts` | named import | ✓ WIRED | `:229-234` |
| `.github/workflows/ci.yml` | `acme-gate.ts` | env-var name binding only | ✓ WIRED | `ci.yml:140` `VICE_REQUIRE_ACME: "1"`; no module path anywhere in ci.yml (see caveat C-1) |
| `r2000-coverage.ts` | `block-class.ts` | the only store-block route | ✓ WIRED | `:141`; both lookup sites and all three comparison sites now go through it; zero store literals remain |
| `r2000-cli.ts` | `block-class.ts` | type-only import, split out | ✓ WIRED | `:83` `import type { BlockEntry } from "./block-class.ts"` |
| `package.json` | `block-class.ts` | `files[]` entry | ✓ WIRED | present; tarball closure walk clean |
| `r2000-cli.ts` | `prg-image.ts` | named import split out | ✓ WIRED | `:61` |
| `r2000-coverage.ts` | `prg-image.ts` | `decodeRawData` (closes C-1) | ✓ WIRED | `:143` |
| `package.json` | `prg-image.ts` | `files[]` entry | ✓ WIRED | present; closure walk clean |
| `docs-dangling-refs.test.ts` | `shipped-modules.ts` | named import replacing local copy | ✓ WIRED | `:37`; local copy gone (WR-05 removed the orphaned `existsSync` import it left) |
| `r2000-spawn-seam.test.ts` | `shipped-modules.ts` | both helpers | ✓ WIRED | `:53` |
| `stock-dispatch.test.ts` | `shipped-modules.ts` | named import; its own line stripper left alone | ✓ WIRED | `:39`; its line-oriented stripper still local, deliberately |
| `comment-phase-pointers.test.ts` | `shipped-modules.ts` | named import + convention rewrite | ✓ WIRED | `:74`; IN-06 removed the duplicate blank line the deletion left |
| `module-classification.test.ts` | `module-classification.ts` | named import + two-direction relations | ✓ WIRED | `:47-48` |
| `module-classification.ts` | `src/mcp/vice/` | every cited consumer path asserted on disk | ✓ WIRED | Direction 3 green over all 19 entries (the tool's `EISDIR` is a directory-target artefact) |

### Data-Flow Trace (Level 4)

No rendered/dynamic-data surface in this phase — it produces library modules and guard tests, not views. The equivalent trace here is *does the moved symbol's data really flow through the new module*, which is covered above: `blockClassAt` is the sole route from a store block listing into the census (verified by literal-absence + the substitutability proof moving `divergence` while holding every byte count), and `decodeRawData` reaches the census from `prg-image.ts` with no path back to `r2000-project.ts`. No static fallbacks, no hollow props, no mock-terminated chains found.

### Behavioural Spot-Checks

All run by me, in my own process, at HEAD.

| Behaviour | Command | Result | Status |
|-----------|---------|--------|--------|
| ACME hard-FAIL under `VICE_REQUIRE_ACME=1` (own probe, not the committed test) | `env -u NODE_TEST_CONTEXT VICE_REQUIRE_ACME=1 ACME_BIN=<missing> node --test probe.test.mjs` | exit 1, `# fail 1`, refusal wording present (1 match) | ✓ PASS |
| Non-vacuity control, `VICE_REQUIRE_ACME` deleted | same, `-u VICE_REQUIRE_ACME` | exit 0, `# pass 1` | ✓ PASS |
| Committed gate observation | `node --test acme-gate.test.ts` | 6/6 pass | ✓ PASS |
| The four new guard/unit files | `node --test block-class prg-image shipped-modules module-classification` | 51 tests / 51 pass / 0 fail / 0 skipped | ✓ PASS |
| Classification guard alone | `node --test module-classification.test.ts` | 18/18, all nine directions + 3 planted violations | ✓ PASS |
| **Real on-disk plant** → Direction 1 must go red | create `r2000-verifier-plant-DELETEME.ts`, run Direction 1 | `not ok 1`, names the plant | ✓ PASS (red as required) |
| Coverage census incl. the boundary proofs | `node --test r2000-coverage.test.ts` | 113/113 pass | ✓ PASS |
| The named `COV` independence test | `node --test --test-name-pattern "independence: rewriting every block entry" …` | `ok 1` | ✓ PASS |
| CR-01 causality | `codeOnly()` at HEAD vs `0802894~1` over two live modules | 1107→1765 and 89→389 lines; 32→48 and 7→14 exports visible | ✓ PASS |
| Guard trio over the un-truncated source | `node --test r2000-spawn-seam docs-dangling-refs comment-phase-pointers` | 38 tests / 37 pass / 0 fail / 1 skipped | ✓ PASS |
| Remaining phase-touched test files (11) | `node --test disasm-roundtrip skill-acme-build-cli r2000-cli r2000-answer-key r2000-project r2000-symbol-roundtrip r2000-verify r2000-tools r2000-mcp-client r2000-d64 hop-chain-comments` | 231 tests / 216 pass / **0 fail** / 15 skipped | ✓ PASS |
| `stock-dispatch.test.ts` | `node --test stock-dispatch.test.ts` | 130/130 pass | ✓ PASS |
| Docs/audit guards (the ones the review churn could have reddened) | `node --test docs-review-disposition audit-integrity test-gate docs-linerefs` | 57/57 pass | ✓ PASS |
| Typecheck | `npx tsc --noEmit` | exit 0, no output | ✓ PASS |
| Tarball validation, both packages | `node scripts/check-npm-packages.mjs` | closure from `vice-proxy.ts` = 60 modules clean; OK, 77 + 34 files / 7 skills | ✓ PASS |
| Zero `r2000` modules deleted | `git log 0acaf25~1..HEAD --diff-filter=D --name-only` | empty — zero deletions anywhere in the phase range | ✓ PASS |
| Attribution of the 5 non-manual failures | `node --test r2000-session.test.ts` | 25 tests / 14 pass / **5 fail** / 6 skipped, all 5 `R2000SpawnError: regenerator2000 was not found on PATH`; `command -v regenerator2000` → absent; file last touched `6054a40` (phase 18) | ✓ PASS (reproduces the disposition exactly) |
| Decision coverage gate | `gsd-tools query check.decision-coverage-verify` | 17/17 honored, `not_honored: []` | ✓ PASS |

**Full-glob suite:** not re-run. The orchestrator ran `npm test` twice directly (pre-fix 2636/2518/46; post-fix **2644/2528/44**, exit 1, broker stopped), and `deferred-items.md` D-27-05-A documents — with PID-level diagnosis — that the run cannot terminate unaided on this host because `vice-proxy.test.ts` leaks two LISTEN sockets. Re-running it would consume 11+ minutes and yield no evidence I have not obtained more precisely above, where **every file phase 27 touched has zero failures**.

### Probe Execution

No `scripts/*/tests/probe-*.sh` files exist in this repo, and no phase-27 PLAN or SUMMARY declares a probe. **Step 7c: N/A (no probes in this project).** The equivalent contract — *do not accept a narrated PASS, run the thing yourself* — was satisfied by running every check in the two tables above in my own process rather than reading the SUMMARY's numbers.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| SEAM-01 | 27-01 | ACME gate extracted out of `r2000-test-gate.ts` under a non-`r2000` name, keeping `ACME_BIN`/`VICE_REQUIRE_ACME`/`assertAcmeRequiredIfEnvSet` working for `disasm-roundtrip.test.ts` and `skill-acme-build-cli.test.ts`; `ci.yml` repointed in the same commit; proven by observing a missing-ACME run FAIL, not skip | ✓ SATISFIED | R1, P01-1…P01-5. The FAIL was **observed by me**, twice (committed test + my own probe). Both named consumer files import from `./acme-gate.ts`. Caveat C-1 on the `ci.yml` clause. |
| SEAM-02 | 27-03, 27-04, 27-05 | Every capability-rather-than-glue `r2000-*` module identified by what it does, not its prefix, recorded before any deletion; at minimum the ten named modules | ✓ SATISFIED | R2, P03-*, P04-*, P05-1…P05-7. All ten named modules recorded as `capability`; the prefix prohibition and the completeness relation are both mechanically enforced and both proven able to go red. |
| SEAM-03 | 27-02, 27-03 | `r2000-coverage.ts`'s store contact reduced to a named repointable boundary; the coverage census survives the substrate swap; `COV-01`/`COV-02`'s boundary test passes | ✓ SATISFIED for the phase-27 contract | R3, P02-1…P02-5. The "against the new store" clause is deferred to Phase 28 (see Deferred Items) — ROADMAP SC-3 scopes phase 27 to "across that boundary". P02-6's concurrency clause abstains (`backstop`). |

**Orphan check:** `grep -E "Phase 27" .planning/REQUIREMENTS.md` maps exactly `SEAM-01`, `SEAM-02`, `SEAM-03` to this phase. All three are claimed by a plan. **No orphaned requirements.**

### Decision Coverage

`gsd-tools query check.decision-coverage-verify` — **17 of 17** trackable `27-CONTEXT.md` decisions are honored by shipped artifacts. `not_honored: []`. Non-blocking gate; recorded for drift tracking.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `acme-gate.test.ts` | SEAM-01 | 6 | 0 | No | **Behavioural** (child-process exit code + refusal-wording containment, two directions) | ✓ STRONG |
| `block-class.test.ts` | SEAM-03 | 12 | 0 | No | Value + structural | ✓ STRONG |
| `prg-image.test.ts` | SEAM-02/03 | pass | 0 | No | Value (incl. refusal-message shape, IN-03) | ✓ STRONG |
| `shipped-modules.test.ts` | SEAM-02 | pass | 0 | No | Value + throw-assertion | ✓ STRONG |
| `module-classification.test.ts` | SEAM-02 | 18 | 0 | No | Relation + planted violation, **plus a real on-disk red I induced** | ✓ STRONG |
| `r2000-coverage.test.ts` | SEAM-03 / COV-01/02 | 113 | 0 | No | **Behavioural** (byte-exact substitution across a zero-overlap vocabulary, with paired non-vacuity) | ✓ STRONG |

- **Disabled tests on requirements:** 0. No `it.skip` / `test.skip` / `describe.skip` / `.todo` / `xit` / `xdescribe` anywhere in the eleven phase-touched test files. The 15 skips in the r2000 test run are runtime availability gates (`skipReasonFor`) firing because `regenerator2000` is absent, which is the designed behaviour and reports as SKIP, not PASS.
- **Circular patterns detected:** 0. The synthetic `package.json` fixtures in `shipped-modules.test.ts` and the reversed-registry copy in Direction 8 are *inputs*, not expected values captured from the system. No expected value in this phase is generated by the code under test.
- **Insufficient assertions:** 0. Notably, three assertions were *strengthened* out of weaker shapes during review: WR-08 replaced a fixture-derived pinned `0` baseline with a relation; P05-2's non-vacuity guard is derived from the registry rather than a literal floor; WR-07 replaced a green-reporting `existsSync` skip gate with a static import that fails loudly.
- **Non-vacuity discipline:** every guard I examined pairs its assertion with a proof that the held-constant thing CAN move, and the planted-violation tests call **the same named predicates** the real scan calls rather than re-implementing the rule. This is the property that makes the guards worth believing.

**Verdict: no BLOCKER, no WARNING from the test-quality audit.**

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | None found |

- `TBD` / `FIXME` / `XXX` across all ten new files and the five modified production modules: **zero matches**. No unreferenced debt markers, so the debt-marker gate does not fire.
- `TODO` / `HACK` / `PLACEHOLDER` / "not yet implemented" / "coming soon": **zero matches** in the new modules and their tests.
- Empty-implementation and hardcoded-empty-data patterns: none reaching a consumer. `extractables: []` on 18 of 19 registry entries is not a stub — Direction 5 asserts `extractables` is non-empty **iff** the verdict is `glue-with-extractable`, and the header records at length that this verdict currently has **zero instances** *because* `prg-image.ts` absorbed the project builder's three extractables in this same phase. An empty array here is the asserted correct value, and the finding is stated rather than hidden.

### Caveats and Residuals (recorded, not swept)

**C-1 — ROADMAP SC-1's "`ci.yml` is repointed in the same commit" clause is satisfied by *nothing needing to change*.** `.github/workflows/ci.yml` binds `VICE_REQUIRE_ACME` by env-var **name** at `:140` and never names a module path, so moving the code required no workflow edit — which the plan predicted as key-link 5 ("env-var name binding only … never a module path, so no ci.yml code edit") and which I confirmed by grepping the whole file. The criterion's *intent* (CI's hard FAIL still reaches the gate) is verified; its literal *action* ("repointed") had no referent. Flagged so a reader diffing `ci.yml` for this phase and finding nothing does not conclude a step was skipped.

**C-2 — ROADMAP SC-4's literal "green" is NOT met, and was not met before this phase began.** `cd src/mcp/vice && npm test` exits **1** with 44 failures (orchestrator's post-fix full run: 2644 tests / 2528 pass / 44 fail / 67 skipped / 5 todo, broker stopped, no `x64sc`). I did not restate that as green, and neither does the SUMMARY. The 44 split into two groups, both of which I reproduced or attributed myself:

  - **39 in `vice-proxy.test.ts`** — entry 2 of `test-gate.mjs`'s frozen `MANUAL_ONLY_TESTS`, needs a reachable host/broker; a broker could not be started because that deterministically reddens `BACK-05` (a separate pre-existing condition with its own pending todo).
  - **5 in `r2000-session.test.ts`** — I ran the file: 25 tests / 14 pass / 5 fail / 6 skipped, all five `R2000SpawnError: regenerator2000 was not found on PATH`. `command -v regenerator2000` → absent. These five are ungated where every sibling in the same file is gated — a real pre-existing gap, logged as `D-27-02-A`.

  Both files were last touched in **phase 18** (`6054a40`, `ed142ba`) and appear in **no** phase-27 plan's `files_modified`. Zero failures exist in any file phase 27 touched (verified across all thirteen of them plus four docs guards). The criterion's stated *purpose* — "the extraction is demonstrably a move rather than a change, which is what makes every later phase's diff readable" — is achieved and independently confirmed: zero deletions, byte-identical moved bodies, `tsc` exit 0, tarball closure clean. Whether the literal exit-0 wording is waived is a human call, not a codebase fact.

**C-3 — `contested` is prose, not data.** `r2000-test-gate.ts`'s verdict is flagged CONTESTED inside its `note` string (WR-10), and `r2000-verify.ts` similarly. Nothing mechanical requires a future contested verdict to be flagged, and `note` is exempt from Direction 4. Both are documented choices with stated reasons, but they are the two places where this record's guarantees are prose rather than gate. Surfaced in prohibition item 2.

**C-4 — the confidence grades are a second, unmoved store surface.** `classFromStore()` answers from the grade token and returns before consulting the block class, so on a fully-graded store the block vocabulary is not on the answering path at all — which is why 27-02's Test 3 had to be re-stated over an **ungraded** comment set (`r2000-coverage.test.ts:743`). The SUMMARY records this honestly rather than quietly dropping the test. This is **not** a SEAM-03 gap: the grade vocabulary is this project's own (`r2000-confidence.ts`, classified `capability` on requirement basis `COV-01,COV-02`, existing precisely because the store carries no confidence axis), so it is not store contact. Recorded because a Phase 28 reader repointing `block-class.ts` should know the substitutability proof does not cover a grade-spelling change.

**On the three plans whose acceptance criteria were revised during execution** (27-03's whole-project `tsc`, 27-04's pre-deletion `grep -c` counts, 27-02's Test 3): I judged each replacement against what the original was trying to prove. All three replacements prove the same thing or more. 27-02's is the clearest case — the substitution moved the assertion to a comment set where the block class is genuinely on the answering path, which is a *sharper* form of the independence claim than the original could have been, and the SUMMARY explains why the original "was not merely unachievable, it was the wrong claim." 27-03's `tsc --noEmit` runs clean at HEAD (I ran it). 27-04's consolidation is verified by direct enumeration — exactly one definition of each helper tree-wide — which is a stronger check than a before/after count.

### Human Verification Required

This is an infrastructure/foundation phase (pure extraction, guard-test discipline, a bookkeeping record — no user-facing surface), so the UAT auto-pass would normally apply. Three items are carved out of it because they are **evidence** gaps, not invented manual steps.

#### 1. Accept or reject SC-4's literal "green" reading

**Test:** Optionally re-run `cd src/mcp/vice && npm test` (11+ min; budget for terminating the hung `vice-proxy.test.ts` child once its results have emitted — `deferred-items.md` D-27-05-A).
**Expected:** Exit 1, 44 failures, split 39 `vice-proxy.test.ts` / 5 `r2000-session.test.ts`, zero in any phase-27 file.
**Why human:** The literal exit-0 reading is observably not met, for two pre-existing conditions in files this phase never touched. Failing the phase for them would be wrong; silently calling exit 1 "green" would be worse. This needs an explicit decision.

**This looks intentional.** To accept the deviation, add to this file's frontmatter:

```yaml
overrides:

  - must_have: "Full npm test (the whole glob, broker stopped, command named in the evidence) is green with zero r2000 modules deleted"
    reason: "The suite exits 1 with 44 pre-existing failures — 39 in vice-proxy.test.ts (MANUAL_ONLY_TESTS, needs a live host/broker) and 5 in r2000-session.test.ts (regenerator2000 absent from PATH, logged D-27-02-A). Both files were last touched in phase 18 and are in no phase-27 plan's files_modified. Zero failures in any file phase 27 touched; tsc exit 0; tarball closure clean; zero r2000 modules deleted. The criterion's purpose — proving the extraction is a move, not a change — is met."
    accepted_by: "henrik"
    accepted_at: "<ISO timestamp>"
```

#### 2. Resolve the backstop-tagged SEAM-03 concurrency abstention

**Test:** Confirm the concurrency clause is genuinely unexercisable rather than merely unexercised — no async, generator, worker-thread or re-entrant path reaches `blockClassAt` in a state where a memoising cache would matter.
**Expected:** Either an accepted "not applicable — single-threaded, pure, no interruptible path" judgement, or a held-out test if a later phase introduces one.
**Why human:** `verification: backstop`. The static half is fully and mechanically verified; presence + wiring may never upgrade a backstop truth to VERIFIED.

#### 3. Resolve the three judgment-tier prohibitions

**Test:** Review `prohibition_items` in the frontmatter. My verdicts: HOLDS, HOLDS_WITH_RESIDUAL, HOLDS — all non-authoritative LLM-judge dispositions.
**Expected:** Explicit acceptance, or a decision on the two named residuals from item 2 (promote `contested` to a structured field; extend Direction 4's scan to `note`).
**Why human:** Judgment-tier prohibitions are never silently absorbed into a passing verdict.

### Gaps Summary

**No gaps.** Nothing is missing, stubbed, orphaned or unwired. Every artifact exists, is substantive, is imported and is used; every key link resolves; the four ROADMAP success criteria are met on substance; all three requirement IDs are satisfied with no orphans; the anti-pattern and test-quality audits are clean; `tsc` and both tarball validations pass; and zero `r2000` modules were deleted anywhere in the phase range.

The two checks I most expected to catch this phase out both held under direct attack:

- **The gate that must FAIL rather than SKIP.** I did not take `acme-gate.test.ts`'s green as evidence — I wrote my own probe and observed exit 1 with the gate's own refusal wording, then observed exit 0 in the control. The control is not vacuous: `delete env.NODE_TEST_CONTEXT` is what stops an inherited test context from making a child `node --test` refuse to run and exit 0, which would have made a working gate read as "degraded into a skip" and made the control pass for free. That trap is recorded in the file as measured, and it is the difference between a real two-direction observation and a pair of assertions about the harness.
- **The classification guard that must see the tree.** A synthetic planted-violation test proves a predicate works; it does not prove the real scan points at the real directory. I created a genuine `r2000-*.ts` on disk and Direction 1 went red, naming it. It is now removed and `git status` is clean.

The one finding that genuinely mattered was already caught by the code review and is genuinely fixed: `codeOnly()`'s missing regex-literal handling meant a regex containing a backtick or quote silently truncated the scanned source, so `r2000-spawn-seam.test.ts` was enforcing R2000-01 over a 1107-line view of a 2329-line module. I verified the fix is *causal*, not cosmetic, by running the pre-fix and post-fix strippers over the same two live modules: 23 previously-invisible exported symbols across two files. That is exactly the class of defect this phase exists to prevent — a guard that reports green whether or not it works — and it was found and closed inside the phase rather than surviving it.

Status is `human_needed` rather than `passed` for three reasons, none of them a code defect: SC-4's literal "green" wording cannot be honestly reported as met and needs an explicit waiver; one truth carries `verification: backstop` and must abstain; and three prohibitions are judgment-tier and cannot be absorbed into a green verdict without a human on the record. **No blocker prevents Phase 28 from starting** — the boundary it depends on (`block-class.ts`) is in place and proven substitutable, and the classification record it must consult is complete and enforced.

---

_Verified: 2026-08-27T09:42:27Z_
_Verifier: Claude (gsd-verifier)_
