# Evidence — Phase 39, The Dual-Channel Coexistence Gate (Go/Degrade/No-Go), 2026-09-07

This directory holds the pre-committed decision rule and every artifact the phase's
measurements produce, because cross-wave working artifacts live at
`PROBE_DIR=$HOME/.cache/c64-re-tools/phase39` — never inside the checkout, and never in
`/tmp`, which is tmpfs on this host (16 GB, emptied only on reboot) and has already cost this
project a build. Anything that matters is copied in here before the session ends, so a later
wave reads a file that still exists.

**No production module of Phase 41 is written by any plan in this phase**, in any shape —
this directory's text-monitor client is a throwaway probe helper (`D-13`) and does not
survive the phase.

## Files

One row per artifact this phase produces under `evidence/`. The five rows below exist as of
this commit; every other row is a promise this table makes on the phase's behalf, and the
plan named in it is the single owner of that file.

| File | Owner | What it is | What it proves |
|---|---|---|---|
| `DECISION-RULE.md` | `39-01` | The binding inputs table, rules `R1`..`R15` first-match-wins, the `D-10`/`D-11` pre-mapped `degrade` narrowings, the `## Totality` walk over all 3,888 input tuples, the three-shape implication table, and the `## Never a gate` declarations | That the verdict was derived and not judged — the rules existed before any number did, and `## Ordering proof` below is the proof |
| `SCHEMA.md` | `39-01` | Every outcome-line name, its complete value domain, its single declared source file, and the derivation rule that produces its value from raw measurement; plus the findings-frontmatter shape and the `not-yet-transcribed` placeholder rule | That no measuring plan could invent a line name, a domain or a definition that flatters its own result |
| `README.md` | `39-01` | This file: the artifact table, the numbered evidence conventions binding on every plan in the phase, and the banked ordering proof | That the conventions were stated before the measurements they govern, and that the evidence tree began with the rules |
| `totality-walk.mjs` | `39-01` | The executable totality walk over the 3,888-tuple cross-product, asserting exactly one antecedent matches each tuple and emitting the per-rule hit histogram, `TOTALITY`, `TSC_INDEPENDENCE` and `COULD_NOT_RUN_EMITTABLE` | That totality, disjointness and `D-08`'s `TEXT_SINGLE_CLIENT` independence are checkable by re-running a committed script, not by trusting a table |
| `39-totality.md` | `39-01` | The walk's real transcript plus its column-0 outcome lines, banked in the same commit as the rules | That the walk was actually run, and what it actually reported, before any measurement plan started |
| `probe-harness.mjs` | `39-02` | Shared probe scaffolding: binary resolution by absolute path, port allocation, spawn/reap, preflight, `testAutomatedBaseline()` | That every measuring probe shares one launch/preflight seam instead of five hand-rolled copies |
| `textmon-probe-client.mjs` | `39-02` | The throwaway text-monitor client: connect, await banner, send-and-await-prompt on the `(C:$xxxx) ` terminator, close | That the crude text framing this phase needs is reproducible from a committed script (`D-13`) |
| `idle-coexist-probe.mjs` | `39-03` | The `IDLE_COEXIST` probe | That the sole `no-go` trigger is measured, not assumed |
| `39-idle-coexist.md` | `39-03` | `IDLE_COEXIST:`, `IDLE_TEXT_CLIENT_HALTS:`, `REMOTEMONITOR_FLAG_ORDER:`, `TEXT_PROMPT_LITERAL_CONFIRMED:`, `TEXT_BIND_BUDGET_MS_MAX:` and the run transcript | That `R2`'s residual risk (a probe defect reaching the same `no-go` as a genuine incompatibility) is distinguishable after the fact |
| `foreign-halt-probe.mjs` | `39-04` | The `FOREIGN_HALT_VISIBILITY` probe | That cross-channel halt visibility is measured over a real checkpoint, not inferred |
| `39-foreign-halt.md` | `39-04` | `FOREIGN_HALT_VISIBILITY:` and the run transcript | That the `R3`/`R4`/`R5` branch point is grounded in an observed signal |
| `cross-channel-resume-probe.mjs` | `39-05` | The `CROSS_CHANNEL_RESUME` probe, both directions | That halting on one channel and resuming from the other is measured symmetrically |
| `39-cross-channel-resume.md` | `39-05` | `CROSS_CHANNEL_RESUME:` and both direction transcripts | That a disagreement between directions is recorded loudly, never averaged |
| `concurrent-inflight-probe.mjs` | `39-06` | The `CONCURRENT_INFLIGHT` probe | That true concurrent in-flight commands are exercised, not merely sequential ones |
| `39-concurrent-inflight.md` | `39-06` | `CONCURRENT_INFLIGHT:`, `CONCURRENT_WRITE_GAP_MS:` and the run transcript | That the overlap gap is recorded as a caveat rather than a threshold |
| `hitcount-invariant-probe.mjs` | `39-07` | The `HITCOUNT_INVARIANT_HOLDS` probe | That the milestone's other blocking UNVERIFIED item is measured rather than declared sufficient by assumption |
| `39-hitcount-invariant.md` | `39-07` | `HITCOUNT_INVARIANT_HOLDS:` and the run transcript | That `R13`'s pre-mapped narrowing is grounded in an observed foreign-halt/wait interaction |
| `disconnect-recovery-probe.mjs` | `39-08` | The `DISCONNECT_RECOVERY` probe orchestrator | That the victim/parent `SIGKILL` scenario is reproducible from a committed script |
| `textmon-kill-victim.mjs` | `39-08` | The separate child process that holds a text-side halt and is killed, so no client-side cleanup ever runs | That "SIGKILL the text client" is taken literally |
| `39-disconnect-recovery.md` | `39-08` | `DISCONNECT_RECOVERY:` and the run transcript | That `R11`'s pre-mapped narrowing (the broker-lease shape) is grounded in an observed recovery outcome |
| `text-single-client-probe.mjs` | `39-08` | The `TEXT_SINGLE_CLIENT` probe | That the milestone's other blocking UNVERIFIED item is measured live against the text port |
| `39-text-single-client.md` | `39-08` | `TEXT_SINGLE_CLIENT:`, `TEXT_SECOND_CONNECT_OBSERVATION:` and the run transcript | That a second connection's outcome is recorded as an observation, never inferred from a timeout alone |
| `fixture-capture.mjs` | `39-08` | The fixture-capture script producing the first text-channel fixture batch | That `PARSE-03`/`PARSE-04`'s provenance discipline is exercised against real captured text |
| `39-fixture-batch.md` | `39-08` | `FIXTURE_COUNT:`, `FIXTURE_BINARIES:`, `FIXTURE_ENCODING:`, `FIXTURE_DIVERGENCE:`, `FIXTURE_UNSUPPORTED:` and the run transcript | That the fixture batch is captured on two binaries with divergence recorded rather than averaged |
| `docs/phase39-dual-channel-coexistence-gate-findings.md` *(outside this directory, at the repository root's `docs/`)* | `39-08` | The durable verdict artifact: machine-readable frontmatter, the rule set reproduced verbatim, the derivation walked input by input, one section per input | That the verdict is **re-derivable from the document alone**, without trusting any summary and without a plan file surviving |

---

## Evidence conventions

**Binding on every plan in phase 39**, not only on `39-01`. Later plans cite this section
rather than restating it.

1. **Transcript convention.** Before running a command, append a line reading
   `$ <the exact command line>` to the named evidence file; then append its real stdout and
   stderr immediately below. A summary written in place of output is not evidence, and a
   transcript is never reconstructed afterwards from memory.

2. **Worktree-independent probe directory.** Cross-wave working artifacts live at
   `PROBE_DIR=$HOME/.cache/c64-re-tools/phase39` — never inside the checkout, and never under
   `/tmp`, which is tmpfs on this host (16 GB, emptied only on reboot) and has already cost
   this project a build. Record absolute `PROBE_DIR` paths so a later wave can find the
   artifact, and copy anything that matters into `evidence/` before the session ends.

3. **Broker stopped, recorded (D-16).** Every live run in this phase is taken with the VICE
   broker **stopped** and with no other `x64sc` process alive, and each transcript records
   `BROKER_STATE: inactive` alongside the `TEST_AUTOMATED_BASELINE:` line it was taken
   against. A live broker reddens the `BACK-05` assertion deterministically, so a measurement
   taken against a live-broker run reads a false baseline and every number in it is suspect.
   Such a measurement is **discarded and re-run, never repaired.** Verify before the run with
   `systemctl --user is-active vice-broker` (expect `inactive`) and `pgrep -af x64sc` (expect
   no genuine `x64sc` process — note that `pgrep -af x64sc` matches its own invoking command
   line when run from a shell that echoes it, so filter that out before reading "no output" as
   the answer), and paste both. Every probe additionally refuses **in code** rather than by
   habit.

4. **Baseline stated, never re-derived.** The measured `test:automated` baseline on this tree
   is recorded **as observed at the time of the run**, never assumed from a prior phase's
   number. Every transcript records the count **it observed** and the failing file names, in
   the form `TEST_AUTOMATED_BASELINE: tests <n> / pass <n> / fail <n>` plus
   `TEST_AUTOMATED_BASELINE_FILES: <names>`. No transcript writes "clean" or "0 failures", and
   no plan adopts a `test:automated` failure count as an acceptance criterion — the count is a
   recorded baseline and never a gate. `npm test` is not used at all in this phase: the
   whole-glob run does not terminate unaided. Use `npm run test:automated` or a single-file
   `node --test <file>`.

5. **The binary is resolved by absolute path, and which one answered is recorded.**
   `/usr/bin/x64sc` is genuine unpatched stock 3.9 and is the gate baseline (`D-15`); the fork
   3.10 at `/usr/local/bin/x64sc` shadows it on bare `PATH`. Every probe resolves by absolute
   path, never by bare name, and records `VICE_BINARY:` with the `stock:`/`fork:` kind derived
   from the resolved path plus `VICE_VERSION_OBSERVED:` taken from the binary's own
   `--version` output. The VICE version is provenance and never a gate input.

6. **Voided runs are recorded, not discarded.** A run that produced no usable measurement is
   written into the evidence file **with its reason**. A phase that quietly drops its
   unhelpful runs is selecting its evidence.

7. **Final occurrence wins.** Where an outcome line appears more than once in one file, the
   last occurrence is the value.

8. **Values are transcribed, never remembered.** Every value in the findings document comes
   from a literal outcome line at column 0 of a named evidence file, cited by path. Nothing is
   taken from a plan SUMMARY's paraphrase — a numeric or enumerated result with no transcript
   behind it is a restatement wearing a measurement's clothes.

9. **No production module of Phase 41 is written by any plan in this phase.** Not the
   in-process mutex, not the broker lease, not the connect-gate, not in stub form; not
   `CHAN-02`'s port surfacing, `CHAN-03`'s reliable framing, `CHAN-04`'s serialization
   authority, `CHAN-05`'s contention verdict, or any `PARSE-*` parser; and no text-monitor
   client module under `src/`. The text client this phase builds lives in this directory, is
   crude by design, and does not survive the phase (`D-13`).

---

## Ordering proof

`CHAN-01` rests on commit ordering and nothing else (`D-06` declined a test guard). Banked
here, **before the first measurement**, so the findings document can cite the ordering
without a reader running git. All facts below were captured at the commit that introduces
this directory — the single commit that lands `DECISION-RULE.md`, `SCHEMA.md`,
`totality-walk.mjs`, `39-totality.md` and this file together (`D-01`).

**Fact one — nothing under `evidence/` exists anywhere in history at the moment these rules
are authored.** Taken with `HEAD` at `0e06880e8dfcd022835c99813534d3d92fe0ea15`
(`0e06880 docs: refresh state.json derived cache for phase 39 planning`), the commit that
becomes this commit's parent:

```
$ git log --oneline -- .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence
(no output)

$ git rev-list --count HEAD -- .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence
0
```

Zero commits in the whole reachable history touch this path. No measurement artifact can
therefore predate the rules, because no path under `evidence/` has ever existed.

**Fact two — the five files of this plan are the entire evidence tree.** Taken immediately
before staging:

```
$ ls .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence
DECISION-RULE.md
README.md
SCHEMA.md
39-totality.md
totality-walk.mjs
```

`39-01` touches **nothing else** (`D-01`): git history is the whole mechanism, and a plan that
also shipped code would make the ordering claim ambiguous. `39-02` runs concurrently in wave 1
but writes nothing under `evidence/`, so it cannot disturb the proof.

**Fact three — the post-commit assertion, and why its sha is not pasted above.** After this
commit lands, the adding commit of `DECISION-RULE.md` is the **only** commit reachable from
itself that touches `evidence/`. Reproduce with:

```
E=.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence
RULES=$(git log --diff-filter=A --format=%H -- "$E/DECISION-RULE.md" | tail -1)
git rev-list --count "$RULES" -- "$E"      # 1
git log --oneline -1 -- "$E/DECISION-RULE.md"
```

The rules commit's own sha is **deliberately not pasted here**: a file cannot carry the hash
of the commit that introduces it, and this plan's `D-01` single-commit requirement forecloses
quoting an earlier rules sha from a later commit, Phase 23's route. The choice is between an
accurate self-referential command and a stale sha, and a stale sha in an ordering proof is
worse than no sha. The sha is recorded in `39-01-SUMMARY.md`, which lands in the next commit,
and `39-08` re-runs the assertion above after every measurement has landed and records that it
still returns `1`.

**Scope note — ordering over `evidence/`, never primacy over the phase directory.** The phase
directory already carries commits made before execution began — the CONTEXT, RESEARCH,
PATTERNS, VALIDATION, DISCUSSION-LOG and eight PLAN documents — so
`git log --oneline --reverse -- <phase dir> | head -1` cannot name this plan's commit,
whatever this plan does. Every ordering assertion is therefore scoped to `evidence/`, which is
where measurement artifacts land and where nothing existed before this commit. A check scoped
to the phase directory is unsatisfiable by construction and must not be written.
