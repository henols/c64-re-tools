---
phase: 10-adoption-boundaries-automated-bootstrap-and-the-removal
plan: 05
subsystem: infra
tags: [regenerator2000, acme, verify, roundtrip, node-test, cli, exit-code-trap]

# Dependency graph
requires:
  - phase: 10-adoption-boundaries-automated-bootstrap-and-the-removal
    provides: "r2000-launch.ts (10-01)'s buildVerifyArgs/runR2000, r2000-project.ts (10-02)'s synthesizeProject, r2000-cli.ts (10-04)'s bootstrap/export-asm verbs and vice-proxy.ts's r2000 dispatch"
provides:
  - "r2000-verify.ts: parseVerifyOutput()/acmeVerdict()/verifyProject() -- the one place that interprets regenerator2000's --verify output, keyed on the parsed ACME line, never the exit code"
  - "r2000-cli.ts's third verb, `verify`, reachable as `vice-mcp r2000 verify <input-or-project>`"
  - "evidence/10-verify-transcript.txt: live, unedited --verify evidence for both the .prg and flat-64K input shapes R2000-06 names"
affects: ["10-06 (the removal + install-story plan, quotes this plan's verify invocation)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Verdict derivation strictly from parsed structured output, never from a subprocess's own exit code -- proven in both directions on real, unedited transcripts from this host (a genuine ca65 failure with exit 1 that must still read as an ACME pass, and a genuine ACME-skipped exit-0 pass that must still read as a failure)"
    - "Availability-gated, never-silently-skipped CI proof (D-11): probeR2000()/SKIP_REASON/{ skip }, exactly one always-running availability-gate test, mirrored from disasm-roundtrip.test.ts's shape into a new, separate file"

key-files:
  created:
    - .claude/mcp/vice/r2000-verify.ts
    - .claude/mcp/vice/r2000-verify.test.ts
    - .planning/phases/10-adoption-boundaries-automated-bootstrap-and-the-removal/evidence/10-verify-transcript.txt
  modified:
    - .claude/mcp/vice/r2000-cli.ts
    - .claude/mcp/vice/r2000-cli.test.ts
    - .claude/mcp/vice/package.json

key-decisions:
  - "Verdict comes only from acmeVerdict()'s parse of the ACME result line -- grep -c 'status === 0' r2000-verify.ts returns 0, and this was proven non-vacuous live: a genuine flat-64K --verify run on this host exited 1 (ca65 ran out of link-time memory-area space) while ACME reported byte-identical, and verifyProject() correctly returned ok:true anyway"
  - "The gated tests ran for real against the installed regenerator2000 0.9.20 / ACME 0.97 on this host rather than being left to CI's SKIP path, producing the committed evidence transcript"
  - "No VICE_REQUIRE_R2000 added to .github/workflows/ci.yml (D-11) -- confirmed via grep -c returning 0"

patterns-established:
  - "A future caller needing the --verify verdict imports verifyProject() from r2000-verify.ts rather than re-parsing regenerator2000's stdout itself"

requirements-completed: [R2000-06]

# Metrics
duration: ~30min
completed: 2026-08-20
---

# Phase 10 Plan 05: The reassembly proof (`r2000-verify.ts` + the `verify` verb) Summary

**`regenerator2000 --verify`'s own output is now parsed by one seam that keys strictly on ACME's parsed result line -- proven correct in both directions on real, unedited transcripts from this host, including a genuine exit-1 run where ACME still passed and a genuine exit-0 run where ACME never ran at all.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 3/3 completed
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments

- Built `r2000-verify.ts`: `parseVerifyOutput()` turns `--verify` stdout into one `VerifyLine` per per-assembler result line (excluding the aggregate summary line by construction -- it has no separator token to match), `acmeVerdict()` derives `ok` only from an ACME line whose own outcome is `"ok"`, and `verifyProject()` composes `r2000-launch.ts`'s `buildVerifyArgs()`/`runR2000()` with both of the above -- `ok` never comes from the child process's exit status.
- Ran the whole thing live, for real, twice: a `.prg`-shaped illegal-opcode fixture and a full flat-64K image, both synthesised via plan 10-02's `synthesizeProject()`, both fed through a genuine `regenerator2000 0.9.20 --verify --assembler acme` and a genuine ACME 0.97 on this host. Both produced `✓ ACME — byte-identical`. The flat-64K run additionally surfaced a **real, unplanned ca65 failure** (`ld65` ran out of link-time memory-area space trying to place a 64K image) with the whole process exiting 1 -- and `verifyProject()` correctly reported `ok: true` anyway, since only ACME's own line decides the verdict. This is D-10 demonstrated in the direction the plan's own trap transcript does not cover: a non-zero exit must not produce a false *negative*, exactly as a zero exit must not produce a false *positive*.
- Pinned both the honest-pass transcript and the exact D-10 exit-0 false-pass trap (`✗ ACME — ... (skipped)` / `✓ All roundtrip verifications passed.` / `EXIT=0`) as unit fixtures in `r2000-verify.test.ts`, plus a synthetic failed-ACME case, a no-ACME-line case, the summary-line exclusion, and the live ca65-failure transcript above -- 9 test cases, all always-run except the two gated live-`verifyProject()` calls, which also ran green on this host.
- Wired a third CLI verb, `verify <input-or-project>`, into `r2000-cli.ts`: accepts a `.regen2000proj` directly or bootstraps a bare input to a temp project first (mirroring `export-asm`), prints every parsed assembler line, and exits 0 only when `acmeVerdict` is `ok`. Live-verified end to end: `node vice-proxy.ts r2000 verify <a synthesised .prg>` exits 0 and prints `verify: ACME reported: byte-identical (3 bytes)` against the real installed toolchain.
- Recorded `evidence/10-verify-transcript.txt`: the actual, unedited stdout of both live `--verify` runs, both exit codes (`0` and `1`), and both tool versions -- since CI never runs the gated tests (D-11), this file is the durable record criterion 4's "proven by running a real assembler, rather than asserted" claim rests on.

## Task Commits

Each task was committed atomically:

1. **Task 1: r2000-verify.ts -- parse the per-assembler result lines, and make a skipped ACME a failure** - `5832904` (feat)
2. **Task 2: r2000-verify.test.ts -- pin both captured transcripts, then prove it live under the D-11 gate** - `dbd0abb` (test)
3. **Task 3: wire the verify verb into the CLI** - `244107d` (feat)

**Plan metadata:** committed alongside this SUMMARY (docs) -- STATE.md/ROADMAP.md are NOT touched by this worktree agent, per orchestrator instructions.

## Files Created/Modified

- `.claude/mcp/vice/r2000-verify.ts` - `parseVerifyOutput()`, `acmeVerdict()`, `verifyProject()`, `AssemblerOutcome`/`VerifyLine` types
- `.claude/mcp/vice/r2000-verify.test.ts` - 9 test cases: 6 always-run unit tests against fixture transcripts (including a real, unplanned ca65-failure transcript), the D-11 availability gate, and 2 gated live `verifyProject()` calls
- `.claude/mcp/vice/r2000-cli.ts` - added `cmdVerify()`, the `verify` case in `runR2000Cli()`'s switch, and a D-10 explainer above the verb-table usage block
- `.claude/mcp/vice/r2000-cli.test.ts` - added an always-running `--help` test asserting all three verbs are listed, and a gated end-to-end `verify` test
- `.claude/mcp/vice/package.json` - `files[]` now includes `r2000-verify.ts`
- `.planning/phases/10-adoption-boundaries-automated-bootstrap-and-the-removal/evidence/10-verify-transcript.txt` - live, unedited `--verify` evidence for both input shapes named by R2000-06

## Decisions Made

- Kept the exact fixture shape from `r2000-cli.test.ts`'s own `PRG_WITH_ILLEGAL_OPCODE` convention (`lax` zeropage then `rts`) for the `.prg` gated test, and planted the same illegal-opcode marker at offset `$1000` in the flat-64K gated test, so `use_illegal_opcodes: true` is actually exercised in both live runs, not merely written.
- Recorded the genuine ca65 failure the flat-64K live run produced as an explicit unit test (`r2000-verify.test.ts`'s sixth test) rather than discarding it as noise -- it is stronger evidence than a synthetic fixture that the parser derives its verdict from ACME's own line alone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1-adjacent -- grep-gate hygiene] Reworded one header-comment sentence in `r2000-verify.ts` to avoid a literal `status === 0` substring collision**
- **Found during:** Task 1, immediately after writing `r2000-verify.ts` and running its own acceptance-criteria greps.
- **Issue:** The header comment used the literal phrase `` `result.status === 0` `` to describe what the module does NOT do. The plan's own acceptance criterion runs a raw (non-comment-stripped) `grep -c 'status === 0' r2000-verify.ts` expecting 0, so the explanatory prose tripped the gate it was documenting -- the same class of issue plans 10-01 and 10-04's own summaries documented for their respective files.
- **Fix:** Reworded to "a bare zero-exit-status check" -- same meaning, no literal substring collision.
- **Verification:** `grep -c 'status === 0' r2000-verify.ts` returns 0; `npm run typecheck` exits 0; all other Task 1 acceptance-criteria greps return their expected counts.
- **Committed in:** `5832904` (Task 1 commit -- corrected before the file's one commit, not as a separate fix-up).

---

**Total deviations:** 1 auto-fixed (grep-gate hygiene, self-contained within Task 1's single commit -- no separate fix-up commit needed).
**Impact on plan:** Required to make the plan's own specified acceptance criteria pass at all; no scope creep, no behavior beyond what the plan specified.

## Issues Encountered

- `check-npm-packages.mjs`'s transitive-closure walk from `vice-proxy.ts` matches only *static* `import ... from "..."` statements (`scripts/check-npm-packages.mjs`'s own regex, `^\s*import\s[^;]*?from\s+"(\./[^"]+)"`). `vice-proxy.ts`'s `r2000` dispatch (plan 10-04) reaches `r2000-cli.ts` via a **dynamic** `await import("./r2000-cli.ts")`, which this regex does not match at all -- so the reported "43 modules, clean" traversal never actually walks into any of the five `r2000-*.ts` modules, including the new `r2000-verify.ts`. This is a pre-existing gap in the closure-check mechanism itself (introduced structurally by plan 10-04's dynamic-import dispatch design, not by this plan), and it does not cause a false pass in practice only because plan 10-04 and this plan both manually keep `files[]` in sync by hand. Left alone per the scope boundary rule -- it affects a mechanism this plan did not build and does not touch the plan's own acceptance criteria (which only check that `r2000-verify.ts` is *listed* in `files[]`, which it is). Logged here rather than fixed; a future plan tightening `check-npm-packages.mjs`'s regex to also match dynamic imports would close it for the whole r2000 module family at once.
- Full `npm test` (1925 tests, ~85s) surfaced exactly one failure unrelated to this plan's files: `repo-root.test.ts`'s "path agreement" test, the same pre-existing worktree-path artifact documented in plans 10-01 through 10-04's own summaries -- this worktree's checkout path sits under `.claude/worktrees/agent-.../`, which that test's own "must not be under `.claude`" assertion structurally cannot pass from inside any GSD worktree. Neither `r2000-verify.ts` nor `r2000-cli.ts`'s new verb touches `repo-root.ts`.

## Verification

1. `cd .claude/mcp/vice && npm test` -- 1889 pass / 1 fail (known worktree artifact, see above) / 30 skip / 5 todo, no hang. 1925 total (1914 baseline + 11 new: 9 in `r2000-verify.test.ts`, 2 in `r2000-cli.test.ts`).
2. `node scripts/check-npm-packages.mjs` -- OK, `r2000-verify.ts` declared in `files[]`, both tarballs pass (64 files for `@henols/vice-mcp`, 35 files + 6 skills for `@henols/c64-re-tools`).
3. The three env-var permutations, all confirmed live:
   - `node --test r2000-verify.test.ts` -- 9/9 pass, 0 skipped.
   - `R2000_BIN=definitely-not-installed-r2000 node --test r2000-verify.test.ts` -- 7 pass / 2 skip (the gated live tests, both naming the SKIP reason), exit 0.
   - `VICE_REQUIRE_R2000=1 R2000_BIN=definitely-not-installed-r2000 node --test r2000-verify.test.ts` -- exit 1, the availability-gate test fails naming `VICE_REQUIRE_R2000`.
4. `evidence/10-verify-transcript.txt` committed; quoted here: both runs' ACME lines --
   - `.prg` run: `✓ ACME — byte-identical (3 bytes)`, EXIT=0.
   - flat-64K run: `✓ ACME — byte-identical (65536 bytes)`, EXIT=1 (ca65 genuinely failed independently; ACME's own verdict is unaffected).
5. `grep -c 'VICE_REQUIRE_R2000' .github/workflows/ci.yml` returns 0 (D-11 held).
6. `git diff --name-only` across all three commits shows no change to `disasm-roundtrip.test.ts`, `disasm-opcodes.ts`, `disasm-decoder.ts`, `disasm-renderer.ts`, or `stock-disassemble.ts`.

## User Setup Required

None. `regenerator2000` (0.9.20) and `acme` (0.97 "Zem") were already installed on this host from Phase 9 / plan 10-02's environment recheck.

## Next Phase Readiness

- `verifyProject()` and the `verify` CLI verb are live, tested (including against real regenerator2000/ACME on this host), and ready for plan 10-06's removal + install-story work, which should quote the exact invocation string used above (`vice-mcp r2000 verify <input>`).
- The reassembly proof this plan exists to build is now complete for both input shapes `R2000-06` names (`.prg` and flat 64K), earning the deletion plan 10-06 performs.
- No blockers.

## TDD Gate Compliance

Not applicable -- this plan's frontmatter is `type: execute`, not `type: tdd`; none of the three tasks is marked `tdd="true"`.

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/r2000-verify.ts`
- FOUND: `.claude/mcp/vice/r2000-verify.test.ts`
- FOUND: `.claude/mcp/vice/r2000-cli.ts` (modified, verify verb present)
- FOUND: `.claude/mcp/vice/r2000-cli.test.ts` (modified, verify tests present)
- FOUND: `.claude/mcp/vice/package.json` (modified, files[] includes r2000-verify.ts)
- FOUND: `.planning/phases/10-adoption-boundaries-automated-bootstrap-and-the-removal/evidence/10-verify-transcript.txt`
- FOUND commit `5832904` (feat: r2000-verify.ts)
- FOUND commit `dbd0abb` (test: r2000-verify.test.ts + evidence)
- FOUND commit `244107d` (feat: verify verb wiring)

---
*Phase: 10-adoption-boundaries-automated-bootstrap-and-the-removal*
*Plan: 05*
*Completed: 2026-08-20*
