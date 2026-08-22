---
phase: 13-external-verification
reviewed: 2026-08-22T00:56:11Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - .claude/mcp/vice/assumption-label-discipline.test.ts
  - .claude/mcp/vice/backend-detect.test.ts
  - .claude/mcp/vice/binmon-fixtures.test.ts
  - .claude/mcp/vice/binmon-fixtures.ts
  - .claude/mcp/vice/broker-launch.mts
  - .claude/mcp/vice/fixtures/backend-detect/README.md
  - .claude/mcp/vice/fixtures/backend-detect/fork-help-transcript.json
  - .claude/mcp/vice/fixtures/backend-detect/stock-help-transcript.json
  - .claude/mcp/vice/fixtures/binmon/README.md
  - .claude/mcp/vice/fixtures/binmon/checkpoint-list.json
  - .claude/mcp/vice/fixtures/binmon/display-get.json
  - .claude/mcp/vice/fixtures/binmon/event-interleaved.json
  - .claude/mcp/vice/probe-binmon.mjs
  - .claude/mcp/vice/resources/broker-launch.mjs
  - .claude/mcp/vice/stock-execution.ts
  - .claude/mcp/vice/stock-protocol.test.ts
  - .claude/mcp/vice/stock-protocol.ts
  - docs/phase2-backend-probe-evidence.md
  - docs/stock-vice-parity.md
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-08-22T00:56:11Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

This phase is almost entirely an evidence-gathering/reconciliation phase: real
`--help` transcripts and binmon wire captures replace spec-synthesized
fixtures, `[ASSUMED]` labels are updated to match live-probe verdicts (A2
closed CONFIRMED; A3/A5 deliberately left `[ASSUMED]`), and a new mechanical
guard (`assumption-label-discipline.test.ts`) prevents a future half-strip of
a multi-site label. I traced every changed line against the base commit
(`git diff`), decomposed the re-captured `.bin` fixtures byte-by-byte to
verify the sidecars' and tests' claims against the actual wire bytes (not just
against each other), ran `tsc --noEmit`, and ran the full `node --test` suite
(2229 passed / 0 failed / 30 skipped / 5 todo).

**Verified, not just read:**
- `checkpoint-list.bin`'s 11-frame decomposition matches
  `stock-protocol.test.ts`'s claimed `events.length === 8` (2 stray
  `CHECKPOINT_INFO` replies at request ids 2/3, plus two
  `RESUMED`/`REGISTER_INFO`/`STOPPED` broadcast triples) and `related.length
  === 2` exactly.
- `event-interleaved.bin`'s single correlated reply genuinely carries request
  id 2, matching the test's `initialRequestId: 2`.
- The `fork`/`stock` `--help` transcripts' `-mcpserver`/`-binarymonitor` token
  counts match both sidecars' narrative claims and `13-PROBE-RESULTS.md`'s
  independently recorded `grep -c` counts.
- `display-get.bin`'s bytes changed (sha256 differs) between base and HEAD
  despite an unchanged byte count — consistent with "re-recorded from a real
  binary, same geometry" rather than an untouched or corrupted fixture.
- `broker-launch.mts` vs. `resources/broker-launch.mjs`: no drift — confirmed
  both by manual line-for-line comparison of the tail half of the file and by
  running `resources-sync.test.ts`, which passes.
- The one pre-existing provenance inconsistency I found (`cpuhistory-get{,
  -multi}.json` labelling `/usr/local/bin/x64sc` as `"stock:..."` when this
  phase's own newly-captured evidence establishes that path as the **fork**
  build) is **already called out explicitly** in
  `fixtures/binmon/README.md`'s Source paths table as a "known mislabel...
  tracked outside this plan's scope," so it is not reported below as a new
  finding — it is a pre-existing (2026-08-18), disclosed item, not a
  contradiction this phase introduced or silently left standing.

No BLOCKER-level defects were found in the code paths this phase actually
changed. The two WARNING items below are pre-existing-pattern quality/hygiene
observations in `probe-binmon.mjs`, a dev-only probe script (never published
in either npm tarball), not in shipped runtime code.

## Warnings

### WR-01: Shell-interpolated command existence check in probe-binmon.mjs

**File:** `.claude/mcp/vice/probe-binmon.mjs:1486-1489`
**Issue:** `checkCommandAvailable()` builds a shell command string via
template-literal interpolation and executes it through `sh -c`:
```js
function checkCommandAvailable(cmd) {
  const r = spawnSync("sh", ["-c", `command -v ${cmd}`], { encoding: "utf8" });
  return r.status === 0 && r.stdout.trim().length > 0;
}
```
Today this has exactly one call site (`checkCommandAvailable("c1541")`, line
1512) with a hardcoded literal, so it is not currently exploitable. But the
pattern itself — interpolating a caller-supplied string into a shell command
line — is exactly the anti-pattern this project's own review culture
(`security-review` skill, the general "no shell interpolation" convention
used everywhere else in this file, e.g. `spawnSync("c1541", [...])` using an
argv array rather than a shell string two functions below) flags elsewhere.
A future refactor that widens this helper to check for a second binary by a
caller-derived name would silently reintroduce a real command-injection
surface.
**Fix:** Use an argv-array spawn with no shell, and treat any non-zero exit
(including "command not found") as unavailable:
```js
function checkCommandAvailable(cmd) {
  const r = spawnSync(cmd, ["--version"], { encoding: "utf8" });
  return r.error === undefined || r.error.code !== "ENOENT";
}
```
or, to preserve the exact `command -v` semantics, use `spawnSync("which", [cmd])`
(still no shell) rather than `sh -c`.

### WR-02: probe-binmon.mjs has grown into a six-concern, ~2430-line single file

**File:** `.claude/mcp/vice/probe-binmon.mjs` (whole file, now 2429 lines; this
phase alone added ~860 lines to it per `git diff --stat`)
**Issue:** The file now mixes: (1) wire body builders/parsers, (2) an offline
`--selftest` harness, (3) the original 13-check live protocol probe (`main()`),
(4) `--capture` fixture-recording mode, and (5) the new `--probe-assumptions`
mode with four live behavioural probes (A1/A2/A3/A5), each with its own
scratch-resource lifecycle (temp disk images, temp directories, memory
save/restore). Every addition is individually well-tested and documented, but
the file's own header comment already has to enumerate five distinct usage
modes, and a future sixth probe or capture case will land in the same file by
default, compounding the same problem. This does not affect correctness today
(the whole file typechecks, `--selftest` passes, and the full test suite is
green), but it is a real maintainability cost for the next change here.
**Fix:** Consider splitting `--probe-assumptions` (and its per-assumption
probe functions) into a sibling module (e.g. `probe-assumptions.mjs`) that
`probe-binmon.mjs` imports and dispatches to, mirroring the existing
`binmon-fixtures.ts` extraction pattern already used for shared wire-frame
helpers. Not urgent enough to block this phase.

## Info

### IN-01: A3's polarity check does not detect a bit that is simultaneously wrong-signed in one port while correctly-signed in the other

**File:** `.claude/mcp/vice/probe-binmon.mjs:1454-1477` (`probeA3JoyportBits`)
**Issue:** For each direction, the code checks `clearedInDc00 || clearedInDc01`
before falling back to `setInDc00 || setInDc01`. If, hypothetically, a bit
cleared in `$DC00` (matching the active-low expectation) while a *different*
bit unexpectedly also flipped the wrong way in `$DC01` in the same round, the
`clearedInDc00` branch would report a clean match and the conflicting signal
in the other port would never surface in `polarityNotes`. Given A3's real
verdict was recorded INCONCLUSIVE (no clean signal either way), this exact
ambiguity may already have been present in the raw data without being named.
Low impact — this is throwaway diagnostic tooling for evidence-gathering, not
shipped logic — but worth tightening if this probe is ever re-run.
**Fix:** Report both ports' transition state independently in
`polarityNotes` rather than short-circuiting on the first port with a clean
transition, so a genuinely conflicting observation is visible in the printed
evidence rather than silently masked by the first port checked.

### IN-02: `fixtures/backend-detect/*.txt` transcripts are not listed in the reviewed file set

**File:** `.claude/mcp/vice/fixtures/backend-detect/fork-help-transcript.txt`,
`stock-help-transcript.txt`
**Issue:** These two files are part of this phase's actual diff (1920 and
1828 lines added respectively, confirmed via `git diff --stat`) and are the
evidence artifacts the reviewed `.json` sidecars and `backend-detect.test.ts`
depend on byte-for-byte, but they were omitted from the `files:` list this
review was scoped to. I read and cross-checked them anyway (grep counts for
`-mcpserver`/`-binarymonitor` against both the sidecars' narrative claims and
`13-PROBE-RESULTS.md`'s independently recorded counts; both match exactly), so
this had no material effect on this review's conclusions, but a future
`/gsd-code-review` invocation that trusts the `files:` list literally would
review the sidecars without ever reading the transcripts they describe.
**Fix:** No code change needed. When phases add matched `.txt`/`.json`
evidence pairs, ensure the workflow's file-list derivation includes both
halves of the pair.

---

_Reviewed: 2026-08-22T00:56:11Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
