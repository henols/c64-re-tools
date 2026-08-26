# Phase 23 — Deferred items

Out-of-scope discoveries logged during execution. Per the executor scope boundary these
are **not** fixed by the plan that found them.

## 1. `npm test` rewrites a committed Phase 18 evidence file on every run

**Found during:** 23-01, running the phase regression gate (`cd src/mcp/vice && npm test`).

**What happens:** the live r2000 spawn-seam test re-records
`.planning/phases/18-persistent-session-and-tool-surface/evidence/18-session-reuse-transcript.json`
on every run, rewriting `recordedAt`, the `.r2000-spawn-seam-test-live-*` temp path inside
`argv`, and `pidAfterCall1` / `pidAfterCall2`. The suite passes; the file is left dirty.

**Why it matters to this phase specifically:** every plan in phase 23 runs the full suite
after each task commit, so this file will be dirty at every commit point. Evidence
convention 9 still holds — the path is under `.planning/`, not `src/` — but a plan that
stages with a broad pathspec would sweep an unrelated Phase 18 artifact into a phase-23
evidence commit. **Stage evidence files individually**, as 23-01 did, and
`git checkout -- <that path>` after the gate if it comes back dirty.

**Not fixed here:** it is pre-existing test behaviour, unrelated to anything 23-01 changed,
and phase 23 is forbidden from modifying anything under `src/`. 23-01 restored the file to
its committed state and moved on.

**Candidate fix for whoever owns it:** have the test write its transcript to a gitignored
path (or `PROBE_DIR`) and assert against it there, rather than overwriting a committed
evidence artifact.
