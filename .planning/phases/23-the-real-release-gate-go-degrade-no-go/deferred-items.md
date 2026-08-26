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

## 4. `vice-proxy.test.ts:6382` (`2408`, BACK-05 D-G ordering) fails on a **live-broker host**, not only under load

**Found during:** 23-10, running the `cd src/mcp/vice && npm test` acceptance gate three
times (fail counts 6, 4, 1 — see the run log in this plan's SUMMARY).

**What happens:** the test asserts `vice_diagnose must never be treated as a capability
gap`, and the actual answer is
`vice_diagnose: diagnosis_unavailable (session_refused)` carrying a **backend mismatch**:
*"This process resolved \"stock\" (source: override, binary: /usr/local/bin/x64sc) while the
broker resolved \"fork\" (binary: x64sc)"*. It reproduces **in isolation**
(`node --test vice-proxy.test.ts` → 118 pass / 1 fail, same test), so for this identity the
cause is **host state, not suite parallelism**: a live fork-backend broker owns the port
while the test process resolves the stock binary.

**Why this refines item 3 rather than duplicating it.** Item 3 recorded `2408` as one of four
load-sensitive identities whose failure *identity* varies run to run. That remains true of
`159`, `916` and `2410`. For `2408` specifically, the trigger observed here is a running
broker with a different backend — which is why it was the sole survivor of run 3 and why it
still fails alone. A reader triaging a red `2408` should check for a live broker before
concluding parallelism.

**Not fixed here.** Phase 23 is forbidden from modifying anything under `src/`, and this plan
touched only `.planning/` and `docs/` — no change it made can reach a `vice-proxy` code path.

**Candidate fix for whoever owns it:** have the test pin the resolved backend for its own
subprocess (or skip under a detected live broker of the other backend) rather than inheriting
whatever the host's broker happens to own.

---

## Orchestrator regression-gate reading — the "flake set" was mostly one live broker

**Recorded by the execute-phase orchestrator, 2026-08-26, after 23-10 and before 23-11.**

Items 2, 3 and 4 above characterise a *load-sensitive flake set* of four tests whose
identity varies run to run (`159`, `916`, `2408`, `2410`), with 2592/2638 passing every
run. That characterisation was formed on a host where a VICE broker was deliberately kept
live to drive 23-03's captures. **With the broker stopped, one full `npm test` run is
completely green:**

```
# tests 2638   # pass 2593   # fail 0   # skipped 40   # todo 5
# duration_ms 111329          exit code 0
```

**`2408` is not a flake at all — it is deterministic and broker-caused.** Same commit,
same host, single-test runs: unit active → `# fail 1`; unit stopped → `# pass 1`. The test
forces `VICE_BACKEND=stock` while a live broker owns the emulator as `fork`, so the proxy's
backend-mismatch guard fires correctly and its own advice text trips the `doesNotMatch`
assertion at `vice-proxy.test.ts:6421`. Filed as
`.planning/todos/pending/2026-08-26-back-05-test-fails-deterministically-on-a-live-broker-host.md`.

**What this does and does not settle**, on the timing evidence:

| test | observed during | broker live? | verdict |
|------|-----------------|--------------|---------|
| `2408` | 23-03, 23-10 | yes | **broker-caused, deterministic — proven both directions** |
| `916` | 23-04 | **no** (broker dead since 2026-08-20) | genuinely load-sensitive; item 2 stands |
| `159` | 23-03/23-10 | yes | unresolved — never observed without a live broker |
| `2410` | 23-03/23-10 | yes | unresolved — never observed without a live broker |

One green run does not *prove* `159` and `2410` are broker-caused rather than load-sensitive,
so they are left open rather than reclassified. But the gate result a later phase should
carry forward is **green on a broker-free host**, not "1-4 varying failures" — and any plan
that drives the emulator will re-introduce `2408` for the duration of its run and should
expect exactly that one failure rather than treating it as evidence of a regression.

**Not fixed here.** All of it is test-harness behaviour under `src/`, which phase 23 may not
modify.
