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

---

## Flaky under load: `r2000-session.test.ts:615` timeout/crash-counter test

**Found during:** 23-04 Task 1, running the `cd src/mcp/vice && npm test` acceptance gate.

**What happens:** `stub: a child that answers nothing within the call timeout rejects with
R2000TimeoutError, is killed, and the crash counter increases by 1` fails under the full
parallel suite with `Expected values to be strictly equal: 0 !== 1` at
`r2000-session.test.ts:631` — the crash counter reads `0` where the test expects `1`. Run
in isolation (`node --test r2000-session.test.ts`) the same file is **25/25 green**. It is a
load-sensitive timing assertion: under the full suite's parallelism the child's kill and the
counter increment do not land inside the window the test samples.

**Why it matters to this phase specifically:** phase 23 plans run the full suite as a
per-task acceptance gate, so a load-sensitive failure here reads as a red gate on a plan
that changed one markdown file under `.planning/`.

**Not fixed here:** it is pre-existing, timing-dependent test behaviour with no connection to
anything 23-04 changed (this plan touches exactly one file, under `.planning/evidence/`), and
evidence convention 9 forbids phase 23 from modifying anything under `src/`. There is also a
standing project instruction that r2000 test surface is not this milestone's to verify or
extend.

**Candidate fix for whoever owns it:** await the observable state transition (poll the crash
counter to the expected value with a bounded deadline) rather than sampling it once after a
fixed timeout, so the assertion does not race the suite's scheduler.
