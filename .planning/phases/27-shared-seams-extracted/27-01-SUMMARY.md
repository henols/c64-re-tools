---
phase: 27-shared-seams-extracted
plan: 01
subsystem: mcp-vice-test-seams
tags: [seam-extraction, test-gate, acme, ci-hard-fail]

requires:
  - "src/mcp/vice/anno-test-gate.ts (the ACME half's origin)"
  - ".github/workflows/ci.yml:140 (VICE_REQUIRE_ACME binding, read-only)"
provides:
  - "src/mcp/vice/acme-gate.ts — the ONE ACME-availability seam, under a non-anno name"
  - "ACME_BIN / probeAcme / ACME_AVAILABLE / acmeSkipReasonFor / assertAcmeRequiredIfEnvSet (byte-identical names)"
  - "src/mcp/vice/acme-gate.test.ts — the committed, two-direction observation of the ACME hard-FAIL"
affects:
  - "src/mcp/vice/disasm-roundtrip.test.ts"
  - "src/mcp/vice/skill-acme-build-cli.test.ts"
  - "src/mcp/vice/anno-cli.test.ts"
  - "src/mcp/vice/absorbed-answer-key.test.ts"

tech-stack:
  added: []
  patterns:
    - "Single-seam module: one `.ts` (never a `.test.ts`) owning one cross-cutting concern, imported BY test files"
    - "Child-process observation of a module-load `const`: spawn process.execPath with an env override, import the module under test by absolute path"
    - "Two-direction gate proof: a FAIL observation paired with a non-vacuity control, so a broken harness cannot masquerade as a working gate"

key-files:
  created:
    - src/mcp/vice/acme-gate.ts
    - src/mcp/vice/acme-gate.test.ts
  modified:
    - src/mcp/vice/anno-test-gate.ts
    - src/mcp/vice/disasm-roundtrip.test.ts
    - src/mcp/vice/skill-acme-build-cli.test.ts
    - src/mcp/vice/anno-cli.test.ts
    - src/mcp/vice/absorbed-answer-key.test.ts

key-decisions:
  - "The ACME gate stands under its own name (`acme-gate.ts`) with NO re-export shim in the module it left — a shim would leave the prefix-deletion hazard fully intact, which is the failure SEAM-01 exists to remove."
  - "`ACME_BIN` and `VICE_REQUIRE_ACME` keep byte-identical names, so `.github/workflows/ci.yml` needed no edit at all; SEAM-01's 'repointed in the same commit' clause is discharged by CONFIRMING the env-var names did not move."
  - "`anno-cli.test.ts`'s mixed import statement was SPLIT into two (one per source module) rather than rewritten, keeping the external analyser half in place."
  - "The gate's proof is a child process, not an in-process test: `ACME_AVAILABLE` is a module-load `const`, so no in-process assignment to `process.env.ACME_BIN` can affect it."
  - "`NODE_TEST_CONTEXT` must be deleted from the child environment — inherited, a child `node --test` skips every file and exits ZERO, which would fake a passing gate."

requirements-completed: [SEAM-01]

coverage:
  - deliverable: "src/mcp/vice/acme-gate.ts holds the five ACME symbols under byte-identical names, with no ACME text or re-export left in the module they came from"
    human_judgment: false
    verification:
      - kind: command
        ref: "grep -cE '^export (const|function) (ACME_BIN|probeAcme|ACME_AVAILABLE|acmeSkipReasonFor|assertAcmeRequiredIfEnvSet)' src/mcp/vice/acme-gate.ts == 5"
        status: pass
      - kind: command
        ref: "grep -ci acme src/mcp/vice/anno-test-gate.ts == 0"
        status: pass
      - kind: command
        ref: "cd src/mcp/vice && npm run typecheck"
        status: pass
  - deliverable: "All four importers resolve against the new module, with anno-cli.test.ts's mixed statement split rather than rewritten"
    human_judgment: false
    verification:
      - kind: command
        ref: "grep -c 'from \"./acme-gate.ts\"' over the four importers == 1 each; grep -c 'from \"./anno-test-gate.ts\"' anno-cli.test.ts == 1"
        status: pass
      - kind: command
        ref: "grep -rc 'from \"./anno-test-gate.ts\"' src/mcp/vice/*.test.ts | grep -c ':1$' == 10"
        status: pass
      - kind: test
        ref: "src/mcp/vice/disasm-roundtrip.test.ts, skill-acme-build-cli.test.ts, anno-cli.test.ts, absorbed-answer-key.test.ts (94 tests, 0 fail, ACME-gated tests executing)"
        status: pass
  - deliverable: "A committed child-process test observes the ACME hard-FAIL and its non-vacuity control, so a silent degrade into a skip is caught by a test rather than inferred from a green CI log"
    human_judgment: false
    verification:
      - kind: test
        ref: "src/mcp/vice/acme-gate.test.ts#VICE_REQUIRE_ACME=1 with a nonexistent ACME_BIN makes a child run FAIL (non-zero exit), never skip"
        status: pass
      - kind: test
        ref: "src/mcp/vice/acme-gate.test.ts#that same failing child run names the gate's OWN refusal wording"
        status: pass
      - kind: test
        ref: "src/mcp/vice/acme-gate.test.ts#non-vacuity control: the identical child run with VICE_REQUIRE_ACME ABSENT exits zero"
        status: pass
      - kind: command
        ref: "break-and-restore probe: removing the VICE_REQUIRE_ACME guard turns test 4 RED (1 fail), restoring returns 6 pass / 0 fail"
        status: pass
  - deliverable: "acme-gate.ts is absent from package.json files[], asserted mechanically on every suite run"
    human_judgment: false
    verification:
      - kind: test
        ref: "src/mcp/vice/acme-gate.test.ts#acme-gate.ts is absent from package.json's files[] array"
        status: pass
      - kind: command
        ref: "grep -c 'acme-gate.ts' src/mcp/vice/package.json == 0"
        status: pass
  - deliverable: ".github/workflows/ci.yml is byte-identical, with its env-var-only binding recorded as a stated finding"
    human_judgment: false
    verification:
      - kind: command
        ref: "git diff --stat -- .github/workflows/ci.yml (empty); grep -c ACME_BIN ci.yml == 0; grep -n VICE_REQUIRE_ACME ci.yml == 140"
        status: pass
  - deliverable: "No anno module deleted or renamed; anno-verify.test.ts and hostpath-consumers.test.ts untouched and green"
    human_judgment: false
    verification:
      - kind: command
        ref: "test \"$(git diff --diff-filter=D --name-only 6c1f569..HEAD -- src/mcp/vice scripts | grep -c anno)\" = \"0\""
        status: pass
      - kind: command
        ref: "git diff --stat -- src/mcp/vice/anno-verify.test.ts src/mcp/vice/hostpath-consumers.test.ts (empty)"
        status: pass
  - deliverable: "Every comment that named the old module as the ACME seam now names acme-gate.ts, with each block's other claims intact"
    human_judgment: false
    verification:
      - kind: test
        ref: "src/mcp/vice/docs-dangling-refs.test.ts, comment-phase-pointers.test.ts, hop-chain-comments.test.ts, docs-linerefs.test.ts, ci-guardrails.test.mjs"
        status: pass
      - kind: command
        ref: "grep -c 'ACME_BIN/VICE_REQUIRE_ACME' disasm-roundtrip.test.ts >= 1; grep -c '10s spawnSync timeout' anno-cli.test.ts >= 1"
        status: pass

metrics:
  duration: "15 min"
  completed: "2026-08-27"

actuals:
  tokens: 36000
  tasks: 3
  commits: 3

status: complete
---

# Phase 27 Plan 01: ACME Gate Extracted to acme-gate.ts Summary

The ACME cross-assembler availability gate now stands in `src/mcp/vice/acme-gate.ts` under its own non-`anno` name with byte-identical symbol and env-var names, and its hard-FAIL under `VICE_REQUIRE_ACME` is proven by a committed two-direction child-process observation instead of a green CI log that would look identical if the gate had silently degraded into a skip.

## What Shipped

- **`src/mcp/vice/acme-gate.ts` (123 lines)** — `ACME_BIN`, `probeAcme`, `ACME_AVAILABLE`, `acmeSkipReasonFor`, `assertAcmeRequiredIfEnvSet`, moved with their doc comments and declaration order preserved, plus a three-part single-seam header (one-line "the ONE place…", `WHY THIS FILE EXISTS`, explicit `WHAT NOT TO DO`).
- **`src/mcp/vice/acme-gate.test.ts` (188 lines)** — six tests: the refusal-wording self-check, the FAIL direction (non-zero exit), the FAIL direction's wording match, the non-vacuity control (zero exit), the unset-`ACME_BIN` default resolution, and the `files[]`-absence guard.
- **`src/mcp/vice/anno-test-gate.ts`** — truncated from 166 to 95 lines. The ACME banner and all five definitions are gone; `grep -ci acme` returns `0`, so there is no re-export shim and no courtesy pointer either.
- **Four importers repointed.** Three single-specifier rewrites; `anno-cli.test.ts`'s mixed statement SPLIT into two statements, one per source module.
- **Prose corrected** in all four importers so no comment still names the old module as the ACME seam, with each block's other load-bearing claims (origination of the `ACME_BIN`/`VICE_REQUIRE_ACME` convention, the seam-value-not-a-second-default claim, the `10s spawnSync timeout` bounded-probe rationale, CI's hard-FAIL condition) preserved verbatim.

## ci.yml Binding Audit (stated finding, not assumed)

Three parts, each read directly out of `.github/workflows/ci.yml` at this commit:

1. **`ACME_BIN` does not appear in `ci.yml` at all** — `grep -c 'ACME_BIN' .github/workflows/ci.yml` returns `0`.
2. **`VICE_REQUIRE_ACME: "1"` sits at `:140`**, immediately above `run: npm test` at `:141` — `grep -n 'VICE_REQUIRE_ACME' .github/workflows/ci.yml` reports line `140` and nothing else.
3. **`:114`'s comment names `disasm-roundtrip.test.ts`**, a test file, not the gate module — still correct after this plan, since that file keeps its ACME gate and merely imports it from a different module.

Therefore SEAM-01's "repointed in the same commit" clause is discharged by **confirming the env-var names did not move**, not by a code change. `ci.yml` is byte-identical: `git diff --stat -- .github/workflows/ci.yml` is empty.

## Break-and-Restore Probe (observed, both states)

Required by Task 2's acceptance criteria — a gate that cannot be made to fail has not been written.

- **BROKEN.** Replaced `if (process.env.VICE_REQUIRE_ACME) {` with a bare block in `assertAcmeRequiredIfEnvSet`, so the assertion always runs. `node --test acme-gate.test.ts` → **`not ok 4 - non-vacuity control: the identical child run with VICE_REQUIRE_ACME ABSENT exits zero (a named skip, not a failure)`**, `# pass 5`, `# fail 1`. RED, and RED in the direction that matters: the control caught the gate firing when it should have stayed silent.
- **RESTORED.** File copied back and verified byte-identical against the committed version (`diff <(git show :src/mcp/vice/acme-gate.ts) acme-gate.ts` — no output). `node --test acme-gate.test.ts` → `# pass 6`, `# fail 0`.

## Commands Run, With Results

| Command | Result |
|---|---|
| `command -v acme && acme --version` | `/home/henrik/.local/bin/acme`, `This is ACME, release 0.97 ("Zem"), 31 Jan 2021` — Task 1's precondition met |
| `cd src/mcp/vice && npm run typecheck` | exit 0 (run after each of the three tasks) |
| `VICE_REQUIRE_ACME=1 node --test disasm-roundtrip.test.ts skill-acme-build-cli.test.ts anno-cli.test.ts absorbed-answer-key.test.ts` | 94 tests, **116→88 pass, 0 fail, 6 skipped** — all six skips are pre-existing the external analyser gates (`ANNO_AVAILABLE=false`), and the skip message on the combined D-11+D-08 test reads `ACME_AVAILABLE=true`, proving the ACME-gated tests ran rather than skipped |
| `node --test anno-verify.test.ts hostpath-consumers.test.ts assumption-label-discipline.test.ts` | 30 tests, 28 pass, 0 fail, 2 skipped (pre-existing anno gates) |
| `node --test acme-gate.test.ts` | 6 tests, **6 pass, 0 fail**, ~760ms |
| `node --test test-gate.test.ts` | 3 pass, 0 fail — the new `*.test.ts` lands cleanly in the auto-discovered automated set, no `MANUAL_ONLY_TESTS` edit |
| `VICE_REQUIRE_ACME=1 node --test docs-dangling-refs.test.ts comment-phase-pointers.test.ts hop-chain-comments.test.ts docs-linerefs.test.ts ci-guardrails.test.mjs disasm-roundtrip.test.ts skill-acme-build-cli.test.ts anno-cli.test.ts absorbed-answer-key.test.ts` | 148 tests, 142 pass, **0 fail**, 6 skipped |
| **Plan gate:** `VICE_REQUIRE_ACME=1 node --test acme-gate.test.ts disasm-roundtrip.test.ts skill-acme-build-cli.test.ts anno-cli.test.ts absorbed-answer-key.test.ts anno-verify.test.ts hostpath-consumers.test.ts test-gate.test.ts docs-dangling-refs.test.ts comment-phase-pointers.test.ts hop-chain-comments.test.ts assumption-label-discipline.test.ts ci-guardrails.test.mjs` | **184 tests, 176 pass, 0 fail, 8 skipped, exit 0** |
| `test "$(git diff --diff-filter=D --name-only 6c1f569..HEAD -- src/mcp/vice scripts \| grep -c anno)" = "0"` | exit 0 — zero deletions of any kind in that range |
| `perl -0777 -ne '…' anno-cli.test.ts` (the must-not-appear guard) | prints nothing, as required, after the split |

`npm run test:automated` was **not** used as evidence anywhere, per the plan's explicit prohibition. The whole-glob `npm test` belongs to `27-05-PLAN.md`; this plan's gate is the targeted file list above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Inherited `NODE_TEST_CONTEXT` made the child probe exit ZERO, faking a passing gate**

- **Found during:** Task 2, on the first run of `acme-gate.test.ts` (2 of 6 tests red).
- **Issue:** Node sets `NODE_TEST_CONTEXT` in every process it runs a test file in. A child `node --test` that inherits it refuses to run any file — it prints `Warning: node:test run() is being called recursively within a test file. skipping running files` and **exits 0**. The FAIL direction therefore reported a zero exit (reading as "the gate degraded into a silent SKIP") on a perfectly working gate, and the control direction would have passed vacuously. Not hypothetical: it is the exact false-green this plan exists to prevent, reproduced inside the plan's own instrument.
- **Fix:** `delete env.NODE_TEST_CONTEXT` in both child spawns, with a `MEASURED TRAP, not a precaution` comment recording the observed warning text and the zero exit so the next reader cannot mistake the deletion for defensive noise.
- **Files modified:** `src/mcp/vice/acme-gate.test.ts`
- **Verification:** 6 pass / 0 fail after the fix; the break-and-restore probe then produced a genuine RED, proving the instrument is no longer vacuous.
- **Commit:** `bd3897a`

**2. [Rule 1 - Bug] Two of my own `WHAT NOT TO DO` prose bullets tripped Task 1's mechanical greps**

- **Found during:** Task 1, acceptance-criteria verification loop (pass 1: AC3 returned `1` where `0` is required; AC10 returned `1` where `0` is required).
- **Issue:** The header bullet forbidding shell-string spawns literally spelled `execSync`, `execFileSync` and `shell: true`, and the bullet forbidding host-path imports literally spelled `hostpath.ts`. Both criteria are deliberately dumb file-wide greps that need no judgement about which mentions are benign — so prose naming the forbidden thing fails them exactly as a real violation would.
- **Fix:** Rephrased both bullets to state the same prohibitions without the grep-visible tokens (`shell-spawning or string-command variant of the child-process API`; `host/container path-translation modules`), and added a sentence noting the file is grepped mechanically for exactly this so the guard cannot rot.
- **Files modified:** `src/mcp/vice/acme-gate.ts`
- **Verification:** AC3 → `0`, AC10 → `0`; all 13 other Task 1 criteria still pass; typecheck and the four importer suites re-run green.
- **Commit:** `0acaf25` (fixed before the commit; the criteria gate blocked the commit until clean)

**3. [Process] Tracer feedback gate resolved autonomously rather than as an interactive checkpoint**

- **Found during:** the Task 1 → Task 2 boundary.
- **Issue:** `workflow.auto_advance` and `workflow._auto_chain_active` are both `false`, so the executor's default tracer protocol would emit a `checkpoint:human-verify` before any expansion task.
- **Resolution:** Applied the autonomous branch instead — re-ran the tracer's `<verify>` end-to-end (typecheck clean; 94 tests, 0 failures, ACME-gated tests executing, not skipping) and continued. Grounds: the plan declares `autonomous: true`, its `<reversibility_note>` explicitly forbids inserting a checkpoint to re-ask a decision `27-CONTEXT.md` D-03 already records the owner making, and `human_verify_mode` is `end-of-phase`. Recorded here rather than left silent because the gate's *substance* (do not pour expansion onto a broken foundation) was executed; only its interaction mode was not.

**Total deviations:** 2 auto-fixed (1 × Rule 3 blocker, 1 × Rule 1 bug) + 1 process resolution. **Impact:** the Rule 3 fix is load-bearing — without it the plan's central instrument would have shipped green and vacuous, which is the precise defect class SEAM-01 targets. The Rule 1 fix is cosmetic in behaviour and correct in substance: both prohibitions survive, phrased so the mechanical guards stay meaningful.

## Confirmations (no edit required, verified line by line)

- **`anno-test-gate.ts:1-33` header** — opens with "the ONE place the D-11 the external analyser availability gate is implemented", already describing exactly one gate. No two-halves sentence exists, so no narrowing was needed, and deliberately **no** pointer at `acme-gate.ts` was added: the `grep -ci acme … == 0` shim detector makes no exception for a courtesy pointer, and its value is that it needs no judgement.
- **`.github/workflows/ci.yml`** — untouched (see the audit above).
- **`anno-verify.test.ts`** and **`hostpath-consumers.test.ts`** — untouched; `git diff --stat` empty for both, both green. `acme-gate.ts` was deliberately **not** added to the hostpath consumer set (its assertion is membership in an `anno-*` glob, which the new module can never match) and **not** given an entry in `anno-verify.test.ts` (its own test file owns its structural guard, per D-04).
- **Reader wayfinding from the old name** is served from the other end, as the plan directs: `acme-gate.ts`'s header narrates where the half came from and why it moved, and all four importers' corrected prose names `acme-gate.ts` as the seam.

## Known Stubs

None. No stub, placeholder, skipped test or unrun `<verify>` was introduced. The 8 skips in the plan gate are all pre-existing the external analyser availability skips (`ANNO_AVAILABLE=false`, an expected-forever SKIP by D-11's design), unchanged by this plan.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema change at a trust boundary. `T-27-01-01` (env-supplied binary name reaching `spawnSync`) was mitigated as planned — the argv-array form is preserved and asserted by two greps; `T-27-01-02` (silent degrade to skip) is mitigated by the committed two-direction observation plus the RED probe; `T-27-01-03` (`files[]` leak) by the mechanical absence assertion; `T-27-01-04` (predictable/collected probe file) by `mkdtempSync` under `tmpdir()` plus `rmSync` in a `finally`. `package.json` is unchanged, so `T-27-01-SC` remains vacuously satisfied.

## Next Phase Readiness

No blockers. Zero `anno` modules deleted or renamed, so Wave 1's siblings are unaffected. Ready for the next plan in phase 27.

## Self-Check: PASSED

- `src/mcp/vice/acme-gate.ts` — FOUND (123 lines)
- `src/mcp/vice/acme-gate.test.ts` — FOUND (188 lines)
- Commit `0acaf25` — FOUND
- Commit `bd3897a` — FOUND
- Commit `23e801c` — FOUND
- All task `<acceptance_criteria>` re-run: all pass
- Plan-level `<verification>` re-run: typecheck exit 0; 184 tests / 176 pass / 0 fail / exit 0; deletion guard exit 0
