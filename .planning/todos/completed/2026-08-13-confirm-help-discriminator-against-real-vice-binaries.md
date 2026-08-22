---
title: Confirm the --help backend discriminator against a real stock AND a real fork VICE binary
date: 2026-08-13
priority: high
source: /gsd-execute-phase 2 plan 02-07 — backend detection, no real VICE binary reachable in-environment
resolves_phase: 13
---

# The `-mcpserver`/`-binarymonitor` --help discriminator is unverified against real hardware

`.claude/mcp/vice/backend-detect.mts`'s `classifyHelpOutput()` classifies a
binary as `"fork"` when its `--help` output contains the literal token
`-mcpserver`, `"stock"` when it contains `-binarymonitor` but not
`-mcpserver`, and `"unknown"` otherwise (D-02). `probeBackend()` spawns the
configured binary with `--help`, falling back to `-help` then `-?` only
when a run exits non-zero with empty output, and hands the combined
stdout+stderr text to `classifyHelpOutput()`.

**Neither half of this mechanism has ever been run against a real VICE
binary.** No stock or fork `x64sc` build is reachable in the environment
plan 02-07 executed in (2026-08-13 user scope override: "we can't do tests
with deciding what vice is"). Every test in `backend-detect.test.ts` drives
`classifyHelpOutput()` against author-authored fixture strings explicitly
labelled ASSUMED, and drives `probeBackend()`/`resolvedBackend()` through an
injected `spawnHelp` stub — no `spawnSync` call in that test file ever
touches a real binary.

This is not a new gap: plan 02-02's own Task 3 was written to gather this
exact evidence against a real host with both builds available, and
`docs/phase2-backend-probe-evidence.md` §2 recorded the question as
explicitly **OPEN, not resolved either way** when no real binary was
reachable for that plan either. This todo is plan 02-07's own record of the
same gap, now that a concrete `classifyHelpOutput()`/`probeBackend()`
implementation exists to check the assumption against.

## What is assumed versus what is known

**Known (from RESEARCH.md and the fork's own source):** the fork's binary
advertises a `-mcpserver` flag; stock VICE's binary monitor is invoked via
`-binarymonitor`. Both flag *names* are real and documented.

**Assumed, `[ASSUMED]` in RESEARCH.md, never verified:**

1. That either build's `--help` (or `-help`, or `-?`) output actually
   *lists* the flag in question, in a form containing the literal
   substring `-mcpserver` or `-binarymonitor` — as opposed to, say, a
   collapsed usage line, a paginated/truncated help screen, or a build
   that omits its own custom flags from `--help` entirely.
2. That stock VICE's argument parser exits non-zero (rather than silently
   ignoring an unrecognized flag or printing to a different stream) in the
   scenarios `probeBackend()`'s fallback ladder assumes when it decides
   whether to try `-help` or `-?` next.
3. That neither build's `--help` output contains *both* discriminator
   tokens in some unexpected way that would change which branch
   `classifyHelpOutput()`'s "fork wins when both present" rule actually
   exercises in practice.

## Acceptance check for closing this todo

On a host with both a real stock `x64sc` build (binary-monitor capable,
`-binarymonitor`) and a real fork `x64sc` build (`-mcpserver` capable)
available:

```
cd .claude/mcp/vice
node -e 'import("./backend-detect.mts").then(m => console.log(m.probeBackend(process.argv[1])))' /path/to/stock/x64sc
node -e 'import("./backend-detect.mts").then(m => console.log(m.probeBackend(process.argv[1])))' /path/to/fork/x64sc
```

1. Confirm `probeBackend()` returns `"stock"` for the real stock binary and
   `"fork"` for the real fork binary — not `"unknown"` for either.
2. If either returns `"unknown"`, capture the real `--help`/`-help`/`-?`
   transcript (redacting nothing) and compare it against the ASSUMED
   fixture strings in `backend-detect.test.ts` — update
   `classifyHelpOutput()`'s matching logic (and RESEARCH.md's A1 assumption
   status) to match what a real build actually prints, then re-add a
   fixture-driven regression test using the REAL transcript, clearly
   labelled `capturedFrom: "real hardware"` (never merged with, or
   presented as, the ASSUMED fixtures already in that file).
3. Confirm the exit-code assumption behind the fallback ladder (`--help`
   exits non-zero on an unrecognized-flag scenario is NOT what
   `probeBackend()` relies on here — it relies on `--help` itself being
   recognized; re-verify the fallback ladder still makes sense once a real
   transcript is in hand).
4. Update `docs/phase2-backend-probe-evidence.md` §2's verdict from OPEN to
   either VERIFIED (both builds classify correctly) or a documented
   revision to `classifyHelpOutput()`/`probeBackend()` if they do not.
5. Once verified end-to-end, exercise `resolvedBackend()` itself (not just
   `probeBackend()`) against both real binaries with `VICE_BACKEND` unset
   and no pre-existing cache, confirming the on-disk
   `.vice-supervisor/backend.json` cache round-trips the correct verdict on
   a second call with zero additional probes.

## Related

- `docs/phase2-backend-probe-evidence.md` §2 — the OPEN verdict this todo
  tracks closing.
- `.planning/phases/02-stock-backend-connection/02-02-PLAN.md` — Task 3,
  the original `checkpoint:human-verify` this override bypassed.
- `.planning/phases/02-stock-backend-connection/02-07-PLAN.md` — the plan
  that implemented `classifyHelpOutput()`/`probeBackend()` against this
  unverified assumption.
- `.planning/todos/pending/2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md`
  — the sibling todo for the binmon wire-protocol fixtures (a different,
  independently-scoped gap from the same environment constraint).

## Resolution

Closed by phase 13, plan 13-02 (`f5df0e9`, `803e9a2`, `8f508c8`, `3161e60`)
and closed in the record by plan 13-05 (`ed61f98`). Requirement `EXTV-02`.
Artifacts:
`.planning/phases/13-external-verification/13-HELP-DISCRIMINATOR-EVIDENCE.md`
(the full evidence record), `docs/phase2-backend-probe-evidence.md` §2
(the resolved verdict), and the committed transcripts at
`fixtures/backend-detect/stock-help-transcript.txt` /
`fixtures/backend-detect/fork-help-transcript.txt`.

Answers to this todo's five numbered acceptance steps:

1. **`probeBackend()` returns `"stock"`/`"fork"`, never `"unknown"`.**
   Confirmed live against both real binaries: `/usr/bin/x64sc` (genuine
   stock, VICE 3.9) returned `"stock"`; `/usr/local/bin/x64sc` (fork, VICE
   3.10) returned `"fork"`.
2. **N/A — neither binary classified `"unknown"`,** so no capture/correct/
   re-add cycle was needed.
3. **The fallback-ladder exit-code assumption was re-verified and answered
   honestly as unexercised, not confirmed either way.** Both real builds
   exit 0 with non-empty output on the first attempted flag (`--help`), so
   `probeBackend()`'s `-help`/`-?` fallback branches were never reached on
   this host. This is recorded as a real finding, not silently upgraded to
   "verified."
4. **`docs/phase2-backend-probe-evidence.md` §2's verdict updated** from
   OPEN to a resolved verdict (plan 13-05), citing this evidence document
   and the two committed transcripts.
5. **`resolvedBackend()` exercised end to end against both real binaries.**
   With `VICE_BACKEND` unset and a fresh scratch `.vice-supervisor/`
   directory, each binary's first call sourced `"probe"` and its second
   call (after `resetResolvedBackendForTests()`) sourced `"cache"` with the
   probe count unchanged at 1 — the on-disk cache round-trips the correct
   verdict on a second call with zero additional probes, and the exercise
   wrote nothing into this repo's real `.vice-supervisor/` tree.

The three enumerated "assumed sub-claims" from this todo's own body were
also answered directly (§4 of the evidence document): (1) both builds'
`--help` lists the discriminator flag as a literal substring, confirmed
for both; (2) both builds exit 0 with non-empty output on `--help` alone,
so the fallback ladder's exit-code question above is unexercised rather
than confirmed; (3) the fork transcript genuinely contains both
discriminator tokens, and `classifyHelpOutput()`'s `hasFork`-checked-first
rule is what actually decides its classification — a real, not
theoretical, exercise of that branch.

One honestly-recorded limitation: re-running the recorded `--help`
capture command does not reproduce the committed transcript byte-for-byte
— `x64sc --help`'s own startup diagnostics include a `VSP Bug: safe
channels are: <permutation>` line whose digit ordering is non-deterministic
across runs of the real binary. This does not weaken the discriminator
evidence: the two discriminator substrings (`-mcpserver*`,
`-binarymonitor*`) are part of the binary's static `--help` usage table
and were confirmed stable across every repeated capture in this exercise —
only the unrelated startup-diagnostic line moved. Documented in both
`13-HELP-DISCRIMINATOR-EVIDENCE.md` and `fixtures/backend-detect/README.md`
so a future re-verification attempt does not mistake this for a stale or
corrupted fixture.
