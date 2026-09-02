# Evidence — Phase 33, The Reproducible-Run Protocol and the Capture Substrate (Go/Degrade/No-Go), 2026-09-02

This directory holds the pre-committed decision rule and every artifact the phase's
measurements produce, because cross-wave working artifacts live at
`PROBE_DIR=$HOME/.cache/c64-re-tools/phase33` — never inside the checkout, and never in
`/tmp`, which is tmpfs on this host (16 GB, emptied only on reboot) and has already cost
this project a build. Anything that matters is copied in here before the session ends, so a
later wave reads a file that still exists.

**Nothing binary lands here.** No corpus image, no `.vsf` snapshot and no flat 64K capture
is ever committed (`D-27`); identity travels as name plus sha256 and nothing else.

## Files

One row per artifact this phase produces under `evidence/`. The three files at the top exist
as of this commit; every other row is a promise this table makes on the phase's behalf, and
the plan named in it is the single owner of that file.

| File | Owner | What it is | What it proves |
|---|---|---|---|
| `DECISION-RULE.md` | `33-01` | The binding inputs table, rules `R1`..`R9` first-match-wins, the `D-04` pre-mapped `degrade` narrowing for `C0_CAPTURE_PAIR` and `ORACLE_NECESSITY`, the `## Totality` walk over all 108 input tuples, and the `## Never a gate` declarations | That the verdict was derived and not judged — the rules existed before any number did, and `## Ordering proof` below is the proof |
| `SCHEMA.md` | `33-01` | Every outcome-line name, its complete value domain, its single declared source file, and the derivation rule that produces its value from raw measurements; plus the `corpus.releases[]` shape and the findings frontmatter keys | That no measuring plan could invent a line name, a domain or a definition that flatters its own result |
| `README.md` | `33-01` | This file: the artifact table, the numbered evidence conventions binding on every plan in the phase, and the banked ordering proof | That the conventions were stated before the measurements they govern, and that the evidence tree began with the rules |
| `autostart-probe.mjs` | `33-03` | The named, repeatable probe script driving `AUTOSTART` (0xdd) and the anchor-counted stop sequences | That the sequencing result is reproducible by re-running a committed script, not by recalling a session |
| `33-autostart-sequencing.md` | `33-03` | Every attempted sequence with its outcome, two runs at two jitters, the verbatim `CHECKPOINT_LIST` (0x14) reply taken immediately after `AUTOSTART`, and `AUTOSTART_FRAME_EXACT:` / `AUTOSTART_SEQUENCE:` | That checkpoint survival across `AUTOSTART`'s power cycle was settled by **one observed reply** rather than inferred — and that a named non-achievement is recorded rather than hidden |
| `33-wallclock-control.md` | `33-03` | The wall-clock-anchoring negative control and the warp-invalidated bracket, with `WALLCLOCK_CONTROL:` and `WARP_BRACKET_CONTROL:` | That two of the five `D-07` controls were **observed red** rather than asserted red |
| `33-slicer-validation.md` | `33-07` | The `vsf-slice` and `capture-predicate` / `capture-seam` suite transcripts and `SLICER:` | That the flat-64K substrate exists and its predicate can fail — the two conditions `R1` reads |
| `capture-pair.mjs` | `33-10` | The named script that takes the capture pair on a real autostarted release | That the pair is reproducible from a committed script, argv digest included |
| `33-capture-pair.md` | `33-10` | The full identity of each capture (binary sha256, argv digest, seed), every voided run with its reason, and `C0_CAPTURE_PAIR:` / `CAPTURE_FRAME_EXACT:` | That `GATE-01`'s one corpus-dependent input is recorded as a **value** — `pass`, `fail` or `not-obtained` with its reason — and never as an abstention |
| `33-transient-derivation.md` | `33-10` | The `D-23` derivation transcript over three or more runs, `TRANSIENT_COUNT:`, and `DERIVATION: void` on the overflow branch, with the reference points `0` / `300` / `1242` stated | That the cap of 64 is a real gate on frame-exactness: an overflow **voids** the derivation and is not repaired by raising the cap |
| `33-memspace-refusal.md` | `33-10` | The clean control, one deliberate drive-checkpoint hit, and `MEMSPACE_ASSERTION:` | That the main-CPU memspace assertion is **proven able to refuse**, by observation on contaminated state that has no synthetic equivalent worth trusting |
| `determinism-probe.mjs` | `33-11` | The `REPRO-01` probe: two cold boots with and two without the determinism block | That the seed measurement is re-runnable on a bare host with no corpus |
| `33-repro01-determinism.md` | `33-11` | The four-boot transcript, the `$C000-$CFEF` window counts, the whole-64K counts beside them, and `SEED_EFFECT:` | That launch nondeterminism was measured in **both** conditions, so a with-block count of zero means something |
| `reset-removed-probe.mjs` | `33-11` | The `REPRO-02` probe and the reset-removed control, calling the protocol's pieces directly per `D-13` | That the control exists without shipping a "protocol without the reset" argument a caller could reach |
| `33-repro02-reset-removed.md` | `33-11` | The 0 / 1500 / 4000 ms triple, the reset-removed control, `JITTER_IMMUNITY:` and `RESET_REMOVED_CONTROL:` | That the protocol reproduces under jitter, and that removing the reset **breaks** it — the third of the five `D-07` controls, observed red |
| `frame-anchor-probe.mjs` | `33-11` | The `REPRO-03` probe producing two stops exactly one frame apart | That the oracle's necessity control is reproducible rather than anecdotal |
| `33-repro03-frame-anchor.md` | `33-11` | The control in which `(LIN, CYC)` alone **passes** on two genuinely different stops while the full triple reports them different, and `ORACLE_NECESSITY:` | That the frame term's necessity was **observed**, which is the only form the ROADMAP accepts |
| `probeready-probe.mjs` | `33-11` | The `REPRO-05` / `D-18` probe timing `probeReady` under `-warp` and `-console` | That the readiness budget was re-checked by measurement before `profile.headless` shipped |
| `33-probeready-warp-console.md` | `33-11` | `PROBEREADY_BUDGET:`, `WARP_TIME_TO_BIND_MS_MAX:` and `CONSOLE_TIME_TO_BIND_MS_MAX:` with their transcripts | That a wall-clock readiness probe was checked against exactly the launch profiles that make it misjudge — and that the result **never gates** |
| `docs/phase33-reproducible-run-gate-findings.md` *(outside this directory, at the repository root's `docs/`)* | `33-12` | The durable verdict artifact: machine-readable frontmatter, the rule set reproduced verbatim, the derivation walked input by input, one section per input, and the collected accepted limits | That the verdict is **re-derivable from the document alone**, without trusting any summary and without a plan file surviving |

---

## Evidence conventions

**Binding on every plan in phase 33**, not only on `33-01`. Later plans cite this section
rather than restating it.

1. **Transcript convention.** Before running a command, append a line reading
   `$ <the exact command line>` to the named evidence file; then append its real stdout and
   stderr immediately below. A summary written in place of output is not evidence. Never
   reconstruct a transcript afterwards from memory.

2. **Worktree-independent probe directory.** Cross-wave working artifacts live at
   `PROBE_DIR=$HOME/.cache/c64-re-tools/phase33` — never inside the checkout, and never
   under `/tmp`, which is tmpfs on this host (16 GB, emptied only on reboot) and has already
   cost this project a build. Record the **absolute** `PROBE_DIR` paths in the evidence file
   so a later wave can find the artifact, and copy anything that matters into `evidence/`
   before the session ends. `PROBE_DIR` paths are recorded so work can be found again, never
   as facts the verdict rests on.

3. **Broker stopped, recorded (D-11).** Every live run in this phase is taken with the VICE
   broker **stopped**, and each transcript records `BROKER_STATE: inactive` alongside the
   `TEST_AUTOMATED_BASELINE:` line it was taken against. A live broker reddens the `BACK-05`
   assertion **deterministically**, so a measurement taken against a live-broker run reads a
   false baseline and every number in it is suspect. Such a measurement is **discarded and
   re-run**, never repaired. Verify before the run with
   `systemctl --user is-active vice-broker` (expect `inactive`) and `pgrep -af x64sc`
   (expect no output), and paste both.

4. **Baseline stated, never re-derived (33-RESEARCH.md P8).** The measured `test:automated`
   baseline on this tree is **5 failing tests in 3 files** — `anno-register.test.ts`,
   `docs-deferred-ledger.test.ts`, `audit-integrity.test.ts` — from **two** root causes
   Phase 33 did not create. Plan `33-02` repairs one of them, after which the expected
   baseline is **2 failing tests in `anno-register.test.ts` only**. Every transcript records
   the count **it observed** and the file names; **no transcript writes "clean" or "0
   failures"**, and no plan adopts "`test:automated` green" as an acceptance criterion. The
   count is a recorded baseline and never a gate (`DECISION-RULE.md` § *Never a gate*).

5. **Voided runs are recorded, not discarded.** A run that produced no usable stop is
   written into the evidence file **with its reason**. The reported capture pair is the pair
   **taken, in the order taken** — never the two most similar of N. A phase that quietly
   drops its unhelpful runs is selecting its evidence.

6. **Final occurrence wins.** Where an outcome line appears more than once in one file, the
   **last** occurrence is the value.

7. **Values are transcribed, never remembered.** Every value in the findings document comes
   from a literal outcome line at **column 0** of a named evidence file, **cited by path**.
   Nothing is taken from a plan SUMMARY's paraphrase. A numeric or enumerated result with no
   transcript behind it is a restatement wearing a measurement's clothes.

---

## Ordering proof

`GATE-01` rests on commit ordering and nothing else (`D-06` declined a test guard). Banked
here, **before the first measurement**, so the findings document can cite the ordering
without a reader running git. All three facts below were captured at the commit that
introduces this directory — the single commit that lands `DECISION-RULE.md`, `SCHEMA.md` and
this file together (`D-01`).

**Fact one — nothing under `evidence/` exists anywhere in history at the moment these rules
are authored.** Taken with `HEAD` at `543522cd0f62e3052841a0a93d6155c3cc37627d`
(`543522c docs(33): record phase planned — 12 plans in 7 waves`), the commit that becomes
this commit's parent:

```
$ git log --oneline -- .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence
(no output)

$ git rev-list --count HEAD -- .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence
0
```

Zero commits in the whole reachable history touch this path. No measurement artifact can
therefore predate the rules, because no path under `evidence/` has ever existed.

**Fact two — the three files of this plan are the entire evidence tree.** Taken immediately
before staging:

```
$ ls .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence
DECISION-RULE.md
README.md
SCHEMA.md
```

`33-01` touches **nothing else** (`D-01`): git history is the whole mechanism, and a plan
that also shipped code would make the ordering claim ambiguous. `33-02` runs concurrently in
wave 1 but writes nothing under `evidence/`, so it cannot disturb the proof.

**Fact three — the post-commit assertion, and why its sha is not pasted above.** After this
commit lands, the adding commit of `DECISION-RULE.md` is the **only** commit reachable from
itself that touches `evidence/`. Reproduce with:

```
E=.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence
RULES=$(git log --diff-filter=A --format=%H -- "$E/DECISION-RULE.md" | tail -1)
git rev-list --count "$RULES" -- "$E"      # 1
git log --oneline -1 -- "$E/DECISION-RULE.md"
```

The rules commit's own sha is **deliberately not pasted here**: a file cannot carry the hash
of the commit that introduces it, and this plan's `D-01` single-commit requirement forecloses
the route Phase 23 used (it wrote its `README.md` in a *later* commit and could therefore
quote the earlier rules sha). The choice is between an accurate self-referential command and
a stale sha, and a stale sha in an ordering proof is worse than no sha. The sha is recorded
in `33-01-SUMMARY.md`, which lands in the next commit, and `33-12` re-runs the assertion
above after every measurement has landed and records that it still returns `1`.

**Scope note — ordering over `evidence/`, never primacy over the phase directory.** The
phase directory already carries commits made before execution began — the CONTEXT, RESEARCH,
PATTERNS, VALIDATION, DISCUSSION-LOG and twelve PLAN documents — so
`git log --oneline --reverse -- <phase dir> | head -1` names `71ba5f7 docs(33): capture
phase context` and can never name this plan's commit, whatever this plan does. Every
ordering assertion is therefore scoped to `evidence/`, which is where measurement artifacts
land and where nothing existed before this commit. A check scoped to the phase directory is
unsatisfiable by construction and must not be written.
