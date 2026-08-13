---
title: Confirm the --help backend discriminator against a real stock AND a real fork VICE binary
date: 2026-08-13
priority: high
source: /gsd-execute-phase 2 plan 02-07 — backend detection, no real VICE binary reachable in-environment
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
