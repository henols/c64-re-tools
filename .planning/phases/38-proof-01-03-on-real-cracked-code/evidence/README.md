# Evidence — Phase 38, PROOF-01..03 on Real Cracked Code, 2026-09-05

This directory holds every artifact this phase's measurements produce. Cross-wave
working artifacts (extracted `.prg` bytes, Ghidra project directories, flat-64K
captures) live at `PROBE_DIR=$HOME/.cache/c64-re-tools/phase38` — never inside
the checkout, and never under `/tmp`, which is tmpfs on this host (16 GB,
emptied only on reboot) and has already cost this project a build.

**Nothing binary lands here.** No corpus `.d64` image, no extracted `.prg`, no
`.vsf` snapshot and no flat 64K capture is ever committed; identity travels as
name plus sha256 and nothing else.

## Files

One row per artifact this phase produces under `evidence/`. The four files this
plan (`38-01`) commits exist as of this commit; every other row is a promise
this table makes on the phase's behalf, and the plan named in it is the single
owner of that file.

| File | Owner | What it is | What it proves |
|---|---|---|---|
| `SCHEMA.md` | `38-01` | Every `PROOF01_`/`PROOF02_`/`PROOF03_` outcome-line name, its value domain, and its single declared source file | That no measuring plan could invent a line name or a domain that flatters its own result |
| `README.md` | `38-01` | This file: the artifact table, the numbered evidence conventions binding on every plan in the phase, and the recorded `test:automated` floor | That the conventions and the floor were stated before the measurements they govern |
| `proof01-dxa-real-release.mjs` | `38-01` | The repeatable driver: corpus extraction, `runDxaDisassemble()` over the Phase 34 host-tool seam, `partitionByteDerived()` ground truth, the comparator's join | That PROOF-01's number is reproducible by re-running a committed script, not by recalling a session |
| `proof01-dxa-real-release.md` | `38-01` | The real-release numbers against `danish.d64`'s `BRUCE LEE   (DC)`, the fixture figures beside them, the pivot's published figures beside those, and the two named weaknesses | That PROOF-01's data-recovery rate and false-positive disposition were measured end to end on a named real binary, not asserted |
| `proof02-enumerate-sites.mjs` | `38-03` | The independent, non-Ghidra site enumerator (raw-byte / dxa-listing route), reused unchanged by `38-04` at the depacked depth | That PROOF-02's site list never comes from Ghidra's own export — the D-06 circularity guard |
| `proof02-loader-stage.md` | `38-03` | The loader/depacker-depth search result, citing Phase 36's earlier search alongside it | That the shallow, already-mostly-done answer is recorded honestly scoped, independent of whether the deeper capture below is obtained |
| `proof02-depacked-capture.md` | `38-04` | The depacked flat-64K capture (Phase 33's substrate) and the site search run over it | That PROOF-02's search reached the actual game code, not only the statically extracted loader/depacker bytes |
| `proof02-computed-dispatch.md` | `38-04` | The roll-up verdict across whichever depth(s) were actually searched | PROOF-02's single, honestly-scoped final answer: `resolved` / `unresolved` / `not-exercised`, never `pass`, never `could-not-run` |
| `proof03-bank-boundary.mjs` | `38-02` | The driver re-running Phase 37's `37-06` scratch-copy technique against the same committed fixture, fresh and self-contained | That PROOF-03's claim is verifiable from this phase's own evidence directory alone |
| `proof03-bank-boundary.md` | `38-02` | Both directions of the `$01` boundary: an address annotating differently under two bank states, and the disagreeing-values point where forward-carrying goes wrong | That the highest-risk item on the pivot's own record was measured, not assumed |

## Evidence conventions

**Binding on every plan in phase 38**, not only on `38-01`. Later plans cite
this section rather than restating it.

1. **Transcript convention.** Before running a command, append a line reading
   `$ <the exact command line>` to the named evidence file; then append its
   real stdout and stderr immediately below. A summary written in place of
   output is not evidence. Never reconstruct a transcript afterwards from
   memory.

2. **Worktree-independent probe directory.** Cross-wave working artifacts live
   at `PROBE_DIR=$HOME/.cache/c64-re-tools/phase38` — never inside the
   checkout, and never under `/tmp`. Record the **absolute** `PROBE_DIR` paths
   in the evidence file so a later wave can find the artifact, and copy
   anything that matters into `evidence/` before the session ends.
   `PROBE_DIR` paths are recorded so work can be found again, never as facts
   a claim rests on.

3. **Broker stopped, recorded.** Every live run in this phase is taken with
   the VICE broker **stopped**, and each transcript records
   `BROKER_STATE: inactive` alongside the `TEST_AUTOMATED_BASELINE:` line it
   is compared against. A live broker reddens the `BACK-05` assertion
   **deterministically**, so a measurement taken against a live-broker run
   reads a false baseline and every number in it is suspect. Such a
   measurement is **discarded and re-run**, never repaired. Verify before the
   run with `systemctl --user is-active vice-broker` (expect `inactive`) and
   `pgrep -x x64sc` (expect no output — **`-x`, exact-name match; never
   `-af`**, which matches the checking shell's own command line when that
   line contains the literal string `x64sc`, exactly as Phase 33's
   `33-capture-pair.md` and `capture-pair.mjs` document, and exactly as
   reproduced live in this plan's own Wave-0 measurement below), and paste
   both.

4. **Baseline stated, never re-derived.** The measured `test:automated` floor
   on this tree, taken at Wave 0 of this phase with the broker confirmed
   stopped, is recorded below as `TEST_AUTOMATED_BASELINE:`. Every later
   transcript in this phase records the count **it observed** and compares it
   against this recorded relation (at or below this floor) — no transcript
   writes "clean" or "0 failures", and no plan adopts "`test:automated` green"
   as an acceptance criterion. The floor is a recorded baseline, is never
   re-derived, and never gates (per `SCHEMA.md` § 6).

5. **Corpus resolution.** The corpus `.d64` images (`danish.d64`, `saeger.d64`)
   are gitignored, operator-supplied material — absent from a fresh clone and
   absent from a git worktree. Every script in this phase resolves them from
   `$C64_CORPUS_DIR` if that environment variable is set, else from
   `<repo-root>/.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/`,
   and fails loudly, naming **both** attempted absolute paths, when neither
   holds the named file. Every script asserts the resolved file's sha256
   against its recorded value **before reading a byte for any other
   purpose** — a mismatch refuses outright, never silently substituting a
   synthetic or stand-in image.

6. **Voided runs are recorded, not discarded.** A run that produced no usable
   result is written into the evidence file **with its reason**, never
   silently dropped.

---

## `TEST_AUTOMATED_BASELINE` — measured at Wave 0, broker stopped

Verified before the run, per convention 3 above:

```
$ systemctl --user is-active vice-broker
inactive

$ pgrep -x x64sc; echo "exit=$?"
exit=1
```

`pgrep -x x64sc` exits `1` with no output, and `systemctl --user is-active
vice-broker` reads `inactive` — the required precondition for a trusted
`test:automated` result.

```
$ cd src/mcp/vice && npm run test:automated

> @henols/vice-mcp@0.1.0 test:automated
> node test-gate.mjs

[... 3519 individual test lines omitted from this transcript; the full run
took 47.6 seconds and its final summary block, reproduced verbatim below, is
what this baseline is taken from ...]

ℹ tests 3519
ℹ suites 24
ℹ pass 3506
ℹ fail 2
ℹ cancelled 0
ℹ skipped 6
ℹ todo 5
ℹ duration_ms 47576.167792

✖ failing tests:

test at anno-register.test.ts:385:1
✖ DIRECTION 5 (basis integrity): every entry cites at least one consumer AND at
  least one requirement id, every path exists, and every id is declared in
  .planning/REQUIREMENTS.md -- basis problems named: anno_add_scope
  (STORE-01), anno_remove_scope (STORE-01), anno_search (STORE-06),
  anno_update_project_enum (STORE-01), anno_save_project (STORE-04,
  MCP-04) -- six well-shaped but undeclared requirement ids

test at anno-register.test.ts:479:1
✖ planted violation (the negative control): a CLEAN synthetic entry is
  reported by NONE of the predicates -- reported anno_search: STORE-06 (same
  undeclared-id root cause as above)
```

TEST_AUTOMATED_BASELINE: tests 3519 / pass 3506 / fail 2

This differs from `38-VALIDATION.md`'s stated "Phase 37's closing baseline"
figure of `tests 3519 / pass 3517 / fail 2` (same `tests`/`fail` counts, a
different `pass` count — `3506` vs `3517`, an 11-test gap not accounted for by
anything this phase changed). Per this phase's own convention 4 and the
project's standing "a number differing from Phase 37's closing baseline is a
fact to record rather than a discrepancy to fix" rule: the number above is
recorded as-observed, not reconciled against the prior document. Both failing
tests are `anno-register.test.ts`'s own pre-existing `STORE-*`/`MCP-04`
undeclared-requirement-id findings — unrelated to this phase's own
`PROOF-01`..`03` work, and not repaired here. Every later suite result in this
phase is compared against `tests 3519 / pass 3506 / fail 2` as a **relation**
(at or below this fail count), never against a literal re-derivation of it.

BROKER_STATE: inactive
