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

**Confirmed a flake, not a break:** a second full `npm test` at the same commit ran
`# fail 0` (2593 pass / 40 skipped / 5 todo). The failure is non-deterministic under
suite load and does not reproduce reliably.

**Candidate fix for whoever owns it:** await the observable state transition (poll the crash
counter to the expected value with a bounded deadline) rather than sampling it once after a
fixed timeout, so the assertion does not race the suite's scheduler.

## 3. The full `npm test` suite has a load-sensitive flake set, not a single flake

**Found during:** 23-03 Task 3, running the phase regression gate four times in a row
while a VICE instance was live and the broker busy.

**What happens:** the suite's failing set is not stable across runs of the same tree.

| Run | fail count | failing tests |
|---|---|---|
| 1 | 1 | (not captured) |
| 2 | 4 | `159` wired disconnect-while-queued; `916` r2000 call-timeout/crash-counter; `2408` BACK-05 D-G ordering at the wire; `2410` IN-01 bounded drain |
| 3 | 1 | (not captured) |
| 4 | 1 | `2408` BACK-05 D-G ordering at the wire |

2592 of 2638 pass in every run; the variance is 1-4 tests out of 2638 and the *identity*
of the failures changes between runs. Item 2 above already logs `r2000-session.test.ts:615`
(test `916`) as a known load-sensitive flake; this entry records that it is **not the only
one** — `159`, `2408` and `2410` join it, and all four are timing- or concurrency-shaped
(a queued-acquire race, a call-timeout assertion, a wire-ordering assertion, and a
bounded-drain timing assertion).

**Why it matters to this phase:** every plan in phase 23 runs the full suite as its gate.
A gate whose failing set varies run to run cannot distinguish "this plan broke something"
from "the host was busy". This plan's own changes touch only `.planning/`, so no failure
here can be attributed to it — but a later plan needs to know that a single red run is not
evidence, and that the honest gate result is "2592/2638 pass, 1-4 load-sensitive failures
whose identity varies".

**Not fixed here.** Phase 23 is forbidden from modifying anything under `src/`, and these
are pre-existing test-suite defects unrelated to any task in this plan.
