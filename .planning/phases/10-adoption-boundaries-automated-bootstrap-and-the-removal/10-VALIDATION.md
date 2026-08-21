---
phase: 10
slug: adoption-boundaries-automated-bootstrap-and-the-removal
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-20
audited: 2026-08-21
audit_gaps_found: 0
audit_gaps_resolved: 0
audit_gaps_escalated: 0
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `10-RESEARCH.md` § Validation Architecture. Task IDs are filled in
> by the planner; requirement rows below are fixed and must all be covered.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in test runner (`node --test`) — no separate framework |
| **Config file** | none — `.claude/mcp/vice/package.json` `scripts.test`: `node --test '*.test.*'` |
| **Quick run command** | `cd .claude/mcp/vice && node --test <specific>.test.ts` |
| **Full suite command** | `cd .claude/mcp/vice && npm test` |
| **Estimated runtime** | ~30 seconds (full suite); < 5 seconds per single test file |

**Additional CI-blocking gates this phase directly touches** (run at the phase gate, not per task):

| Gate | Command | Why this phase touches it |
|------|---------|---------------------------|
| Skill/fork honesty | `node scripts/check-skill-fork-honesty.mjs` | R2000-03 / D-13 array-move edit |
| npm package contents | `node scripts/check-npm-packages.mjs` | New seam modules must appear in `files[]` (transitive-closure walk) |
| Resources sync | `cd .claude/mcp/vice && node --test resources-sync.test.ts` | Confirms the r2000 modules stay container-side and need no `resources/*.mjs` artifact |

---

## Sampling Rate

- **After every task commit:** Run the specific new/modified test file's quick command
  (e.g. `cd .claude/mcp/vice && node --test r2000-launch.test.ts`)
- **After every plan wave:** Run `cd .claude/mcp/vice && npm test`
- **Before `/gsd-verify-work`:** Full suite green **plus** `node scripts/check-skill-fork-honesty.mjs`
  and `node scripts/check-npm-packages.mjs` both exit 0
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

Requirement-level rows are authoritative. The planner MUST assign each row a Task ID
and Plan number; no row may be left unassigned.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01 T1+T2 | 10-01 | 1 | R2000-01 | T-10-01 | `--vice` unreachable by construction; a scan throws a named, loud error — never silently strips | unit | `cd .claude/mcp/vice && node --test r2000-launch.test.ts` | ✅ | ✅ green |
| 10-01 T3 | 10-01 | 1 | R2000-02 | — | No argument reaching regenerator2000 is host-translated; absence is structurally asserted | unit (extends existing) | `cd .claude/mcp/vice && node --test hostpath-consumers.test.ts` | ✅ | ✅ green |
| 10-02 T2+T3 | 10-02 | 1 | R2000-09 | T-10-02 | `.prg`/`.d64`(named entry)/`.raw` → `.regen2000proj` with no human; `use_illegal_opcodes` and machine `system` explicitly forced, never inherited from auto-detection | unit (pure synthesis) + integration (real r2000 load) | `cd .claude/mcp/vice && VICE_REQUIRE_R2000=1 node --test r2000-project.test.ts` | ✅ | ✅ green |
| 10-05 T1+T2 | 10-05 | 3 | R2000-06 | — | `--verify`'s ACME result line parsed as `✓`; fails on `skipped`; never trusts exit code alone | integration (subprocess, gated) | `cd .claude/mcp/vice && VICE_REQUIRE_R2000=1 node --test r2000-verify.test.ts` (CI: named SKIP per D-11, and CI never sets the variable) | ✅ | ✅ green |
| 10-06 T1-T3 | 10-06 | 4 | R2000-05 | — | `disasm` verb, `## Disassembly` caveat section, and `toacme` prerequisite are gone from both `acme.mjs` and `SKILL.md` | negative assertion (grep) | `! grep -qn "disasm\|toacme" .claude/skills/acme-build/scripts/acme.mjs .claude/skills/acme-build/SKILL.md` | ✅ → permanent CI regression assertion, `node scripts/check-skill-fork-honesty.mjs` (whole-`.claude/skills`-tree scan, per plan 10-08 task 3) | ✅ green (both the original two-file grep and its whole-tree successor pass) |
| 10-08 T1+T3 | 10-08 | 5 | R2000-03 | — | README names regenerator2000 as required prerequisite, states `cargo install` cost + one-project-per-namespace limit; `THIRD-PARTY-NOTICES.md` carries the dual `MIT OR Apache-2.0` notice (D-14 corrects the Apache-2.0-only wording) | documentation-honesty CI gate | `node scripts/check-skill-fork-honesty.mjs` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Audit note (2026-08-21):** all six declared commands still resolve under their original names —
none were renamed or moved by Phase 11.1's edits to `r2000-cli.ts`, `r2000-launch.ts`,
`r2000-verify.ts`, `hostpath-consumers.test.ts`, `check-skill-fork-honesty.mjs`, or `acme.mjs`.
Every command was re-run live on this host (real `regenerator2000 0.9.20`, real ACME 0.97, so the
`VICE_REQUIRE_R2000=1`-gated legs of R2000-09/R2000-06 genuinely executed rather than skipping) and
observed green. Two commands are corrected from the pre-execution snapshot's text to what they
actually are on this host: R2000-09's row is run with `VICE_REQUIRE_R2000=1` set (its own file
declares a gated integration leg that silently skips without it — running it unset would not have
proven the "real r2000 load" half of the row's own Test Type column); R2000-05's declared
two-file grep still passes standalone, but the row's own text already named
`check-skill-fork-honesty.mjs` as the durable successor, which was also re-run and confirmed green
(see Annotation below for why the successor's scope matters).

**Independent mutation-kill re-confirmation (2026-08-21).** `r2000-launch.test.ts`'s D-07 guard
pin was re-verified non-vacuous on the *current* tree, not merely re-run: `r2000-launch.ts` and
`r2000-launch.test.ts` were copied to a scratch directory outside the repo, the
`assertNoViceFlag(argv)` call was removed from the copy's `runR2000()`, and the copy's own test
suite was re-run against the mutated copy — 25/26 pass, 1 fail, and the failing test is exactly
`"runR2000 throws R2000ViceFlagError before spawning..."`. The live tracked file was never touched
(`git status`/`git diff` confirmed clean throughout — the mutation only ever existed in the scratch
copy). This reproduces 10-VERIFICATION.md's original mutation-kill claim on today's source, after
Phase 11.1 widened the guard's own scope (`r2000-spawn-seam.test.ts` now also polices the second,
async spawn site in `r2000-mcp-client.ts` — a strengthening, not a regression, and outside this
row's own declared command).

**Annotation — 10-02 T2+T3 / R2000-09: the declared command under-covers its own row text, but the
missing half is genuinely tested elsewhere.** The row's Secure Behavior column names three input
shapes — `.prg`, `.d64` (named entry), and `.raw` — but `r2000-project.test.ts` (the row's only
declared command) contains zero `.d64` references; `.d64` named-entry extraction is
`r2000-d64.ts`'s job, and the end-to-end "bootstrap on a `.d64` writes a `.regen2000proj` with no
human" path is exercised in `r2000-cli.test.ts` (e.g. the D-02 fail-loud-without-`--entry` test at
line 201). This is not a coverage gap — both files exist, both pass, and 10-VERIFICATION.md's own
Requirements Coverage table already attributes R2000-09 to plans 10-02/10-03/10-04 jointly, not to
10-02 alone. It is a ledger-precision issue: the row's *declared automated command* names only one
of the three files a full re-run of R2000-09 actually needs. Re-run for completeness during this
audit: `VICE_REQUIRE_R2000=1 node --test r2000-d64.test.ts` → 16/16 pass;
`VICE_REQUIRE_R2000=1 VICE_REQUIRE_ACME=1 node --test r2000-cli.test.ts` → 54/54 pass (both gated
legs ran live, not skipped). No new test was written for this — the behavior the row claims is
already pinned by an existing, passing, non-trivial test, just not the one this row cites by name.
Recorded here rather than silently left for the next reader to rediscover.

**Measured per-command results (2026-08-21):**

| Command | Result |
|---------|--------|
| `node --test r2000-launch.test.ts` | 26 pass |
| `node --test hostpath-consumers.test.ts` | 11 pass |
| `VICE_REQUIRE_R2000=1 node --test r2000-project.test.ts` | 13 pass (gated leg ran live) |
| `VICE_REQUIRE_R2000=1 node --test r2000-verify.test.ts` | 12 pass (both gated legs ran live) |
| `! grep -qn "disasm\|toacme" .claude/skills/acme-build/scripts/acme.mjs .claude/skills/acme-build/SKILL.md` | exit 0 |
| `node scripts/check-skill-fork-honesty.mjs` | exit 0 |
| `VICE_REQUIRE_R2000=1 node --test r2000-d64.test.ts` (completeness re-run, R2000-09) | 16 pass |
| `VICE_REQUIRE_R2000=1 VICE_REQUIRE_ACME=1 node --test r2000-cli.test.ts` (completeness re-run, R2000-09) | 54 pass |
| `cd .claude/mcp/vice && VICE_REQUIRE_R2000=1 VICE_REQUIRE_ACME=1 npm test` (full suite) | 2192 tests, 2157 pass, 0 fail, 30 skipped, 5 todo |
| `npx tsc --noEmit` | exit 0 |
| `node scripts/check-skill-tool-coverage.mjs` | exit 0 |
| `node scripts/check-npm-packages.mjs` | exit 0 (73 files / 35 files, 6 skills) |

---

## Wave 0 Requirements

All Wave 0 gaps are assigned to plans; none is left unowned.

- [x] `.claude/mcp/vice/r2000-launch.ts` + `r2000-launch.test.ts` — R2000-01 (D-07 construction + scan guard) → **plan 10-01, tasks 1-2**
- [x] `.claude/mcp/vice/r2000-project.ts` + `r2000-project.test.ts` — R2000-09 (D-01/D-04/D-05 synthesis, forced settings) → **plan 10-02, tasks 2-3**
- [x] `.claude/mcp/vice/r2000-verify.test.ts` — R2000-06 (D-09/D-10/D-11 gated `--verify` proof) → **plan 10-05, tasks 1-2**.
      **New file. Must NOT edit `disasm-roundtrip.test.ts`** — that is Phase 4's protected
      stock-disassembler test and is unrelated to `acme-build`'s deleted `disasm` verb.
      Plans 10-02, 10-04 and 10-05 each assert in their acceptance criteria that no Phase 4
      disassembler file appears in the diff.
- [x] `hostpath-consumers.test.ts` extension — R2000-02 (D-08) → **plan 10-01, task 3**. No new
      file; `EXPECTED_IMPORTERS` stays a five-element array, and all five future r2000 module
      names are placed on the negative/absence side in one test.
- [x] `.d64` named-entry extraction — D-02 → **plan 10-03**, landing as
      `.claude/mcp/vice/r2000-d64.ts` rather than inside `d64-parse.mjs`. Open Question #2 is
      resolved by the package boundary: `.claude/skills/**` is not in `@henols/vice-mcp`'s
      `files[]`, both npm-installer routes launch via `npx` with no skill files on disk, and
      `check-npm-packages.mjs`'s transitive-closure walk would fail a pack that reached outside
      the package. `d64-parse.mjs` is left untouched and cited as the algorithm's origin.
- [x] Skill-side entry point reaching the D-06 seam — **plan 10-04**, which adopts RESEARCH.md's
      recommendation as the design (an argv subcommand on the existing `vice-mcp` bin, dispatched
      before any server side effect) and verifies it end to end: plan 10-04 task 3 spawns the bin
      exactly as a consumer would and asserts exit 0, usage text, no JSON-RPC frame, and
      termination within a timeout. `files[]` gains the four new modules in plan 10-04 task 2 and
      `r2000-verify.ts` in plan 10-05 task 1, both gated by `check-npm-packages.mjs`.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Audit disposition (2026-08-21) |
|----------|-------------|------------|-------------------|---------------------------------|
| Devcontainer run with no upstream patch | R2000-02 | This repo is host-developed with no devcontainer (see project constraints); a real container run cannot be exercised in CI | Reviewer confirms by inspection that no arg reaching regenerator2000 passes through `hostpath.ts`/`containerpath.ts`, backed by the automated `hostpath-consumers.test.ts` absence assertion | **Still true, recorded honestly — not silently marked green.** `find . -iname "*devcontainer*"` finds no devcontainer config anywhere in this repo, only an unrelated pending todo (`2026-08-12-vice-broker-tests-stall-outside-devcontainer.md`) that names the same absence. This row stays reviewer-inspection-only by construction; the automated half it leans on (`hostpath-consumers.test.ts`, absence assertion) was re-run above and is green. |
| regenerator2000 version drift | all | regenerator2000 0.9.20 is an actively-developed eight-month-old project; the CLI surface is verified as of 2026-08-20 only | **Assigned: plan 10-02, task 1** — re-runs `regenerator2000 --version && regenerator2000 --help` at execution start, writes a PASS/FAIL line per depended-on flag plus one `DRIFT:` verdict to `evidence/10-environment-recheck.txt`, and STOPS the plan on any drift rather than adapting silently | **Confirmed committed and matches the claim.** `evidence/10-environment-recheck.txt` exists, records `regenerator2000 0.9.20`, every depended-on flag as `PASS`, and `DRIFT: none`. Re-run live during this audit (`regenerator2000 --version`) still reports `0.9.20` — no drift since the file was written. |
| Live `--verify` evidence, since CI never runs it | R2000-06 | D-11 keeps regenerator2000 out of CI, so no green tick will ever record this | **Assigned: plan 10-05, task 2** — the raw stdout, exit codes and tool versions of both live runs (`.prg` and flat 64K) are committed to `evidence/10-verify-transcript.txt` | **Confirmed committed and matches the claim.** `evidence/10-verify-transcript.txt` exists and shows both runs verbatim: the `.prg` run (ACME byte-identical, exit 0) and the flat-64K run (ACME byte-identical, exit **1** because ca65's linker overflows on a full 64K image — yet `acmeVerdict()` still reports `ok: true`, demonstrating D-10's exit-code-independence in both directions on real output). This is independently reproduced by the still-passing gated legs of `r2000-verify.test.ts` re-run above. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Every requirement row above has a Task ID and Plan assigned
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned 2026-08-20 — every requirement row carries a Task ID and plan number, every Wave 0 gap is owned, and both manual-only rows are assigned to a task with a committed artifact.

---

## Validation Audit 2026-08-21

**Why this audit exists.** `v0.3.0-MILESTONE-AUDIT.md` § "Nyquist Coverage" found this ledger was
never closed out after execution: frontmatter still read `status: planned`, all six per-task rows
were still `⬜ pending`, and the Validation Sign-Off checklist was entirely unchecked — even though
`10-VERIFICATION.md` (dated the same day) had already independently run the full suite green,
performed source-level mutation-kill testing on the pinning tests, and recorded a live end-to-end
run against the real installed `regenerator2000 0.9.20` and real ACME 0.97. This is a **stale
ledger**, not missing validation. This audit re-runs every declared command live on this host and
records what is actually true now, per Phase 11's audit convention (`11-VALIDATION.md`, 2026-08-21).

Every one of the six rows' declared automated commands was executed on this host. Real
`regenerator2000 0.9.20`, real ACME 0.97 "Zem", genuine unpatched stock `/usr/bin/x64sc` (VICE 3.9)
and the fork's `/usr/local/bin/x64sc` (VICE 3.10) are all present, so no gated leg skipped silently
— the live halves genuinely ran.

| Metric | Count |
|--------|-------|
| Rows audited | 6 |
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Rows green as declared | 6 |
| Annotations (not gaps — see R2000-09 above) | 1 |

**No declared command had moved or been renamed.** Phase 11.1 modified `r2000-cli.ts`,
`r2000-launch.ts`, `r2000-verify.ts`, `hostpath-consumers.test.ts`, `check-skill-fork-honesty.mjs`
and `acme.mjs`, but every test file and CI script this ledger's six rows name by filename still
exists at that name and still passes.

**Full suite (regression baseline, unchanged from the milestone audit's stated figure):**
`cd .claude/mcp/vice && VICE_REQUIRE_R2000=1 VICE_REQUIRE_ACME=1 npm test` → **2192 tests, 2157
pass, 0 fail, 30 skipped, 5 todo** — matches exactly. `npx tsc --noEmit` exit 0.
`check-skill-fork-honesty.mjs`, `check-skill-tool-coverage.mjs`, `check-npm-packages.mjs` all
exit 0.

**Mutation-kill re-confirmation.** `r2000-launch.test.ts`'s D-07 `--vice` guard pin was re-verified
non-vacuous against a scratch copy of the *current* tree (never against the tracked source — this
audit modifies no implementation file): removing `assertNoViceFlag(argv)` from a copy of
`runR2000()` and re-running the copy's own test suite produced 25/26 pass, 1 fail, and the one
failure named exactly the guard behavior R2000-01 claims
(`"runR2000 throws R2000ViceFlagError before spawning..."`). `git status`/`git diff` confirmed the
tracked tree was clean throughout.

**Manual-only rows.** Both were checked against the live filesystem/toolchain rather than trusted
from prose (see the Audit disposition column above): the devcontainer row remains genuinely
reviewer-inspection-only (no devcontainer config exists anywhere in this repo), and both committed
evidence transcripts (`evidence/10-environment-recheck.txt`, `evidence/10-verify-transcript.txt`)
exist and say what the ledger claims — re-confirmed against a live `regenerator2000 --version`
re-run for the first, and against the still-passing gated `r2000-verify.test.ts` legs for the
second.

**No implementation code was modified by this audit.** The one gap-shaped finding surfaced
(R2000-09's declared command under-citing its own `.d64` half) resolved to an **annotation**, not
a BLOCKER or a new test: the behavior it names is already pinned by existing, passing,
non-vacuous tests (`r2000-d64.test.ts`, `r2000-cli.test.ts`), just not the one file the row's
Automated Command column names. Nothing here met the bar for a genuine coverage gap requiring a
new test.

**Sign-off (audit):** closed 2026-08-21 — all six requirement rows independently re-run green on
this host with real tooling, both manual-only rows confirmed honestly (one still reviewer-only by
necessity, one backed by a checked committed transcript), one non-blocking annotation recorded,
zero gaps requiring escalation or a new test. `status: validated` reflects this, matching Phase 9's
(`complete`) and Phase 11's (`validated`) closed-ledger convention.
