# Evidence — Phase 23, The Real-Release Gate (Go/Degrade/No-Go), 2026-08-26

This directory holds the pre-committed decision rule and every artifact the phase's
measurements produce, because cross-wave working artifacts live at
`PROBE_DIR=$HOME/.cache/c64-re-tools/phase23` — never inside the checkout, and never in
`/tmp`, which is tmpfs on this host (16 GB, cleared on reboot) and already cost the
dxa+Ghidra pivot its dxa build. Anything that matters is copied in here before the session
ends, so a later wave reads a file that still exists.

| File | What it is | What it proves |
|---|---|---|
| `DECISION-RULE.md` | The binding inputs table, rules `R1`..`R9` first-match-wins, the D-09 pre-mapped degrade narrowing for criteria 2 and 3, the never-a-gate declarations, and the threshold / precision / hold-out contracts | That the verdict was derived and not judged — the rule existed before any number did, and `## Ordering proof` below is the proof |
| `SCHEMA.md` | Every outcome-line name and its value domain, the `corpus.releases[]` list schema, the criterion-1 measurement definitions, the window derivation rule, the dxa flag set, the inventory schema, and the audit disposition vocabulary | That no measuring plan could invent a line name, a window or a flag that flatters its own result |
| `corpus/` | Release identity only — name plus sha256, in tracked `.md` / `.txt` / `.json`. Its `.gitignore` refuses every binary image form | That the corpus image is identified without ever being committed (D-04) |
| `tools/` | *(not written yet — 23-02)* dxa 0.1.5 tarball sha256 and built-binary sha256, Ghidra and Java versions, and the fixture reproduction | That the gate measured a pinned instrument, and the same one `DXA-01` must later vendor |
| `inventory/` | *(not written yet — 23-05)* The D-05 pre-committed corpus inventory: `$01` write timeline, dispatch sites, certain-code and certain-data sets, and the window `W` | That `not-exercised` is earned as a fact about the corpus, recorded ahead of the measurements rather than as a post-hoc excuse |
| `capture/` | *(not written yet — 23-03)* Flat 64K capture sha256 per release, capture equivalence across two runs, chip state and the capture record | That every criterion except 4 was measured on a real depacked release and not on another self-authored fixture |
| `criterion1-*.txt` | *(not written yet — 23-06, 23-07)* dxa command lines, stderr, listings, the provenance hold-out, and the computed numbers | Whether the 279-byte fixture flattered dxa — the new numbers printed *beside* the reproduced 72.46% / 0-FP / 27.5%-FN, not replacing them |
| `criterion2-*.txt` | *(not written yet — 23-08)* Ghidra headless transcripts and the full reference dump, checked site by site against the runtime inventory | Whether Ghidra resolves a *computed*-index dispatch — the case the pivot fixture never exercised |
| `criterion3-*.txt` | *(not written yet — 23-09)* The `$01` timeline, per-site bank states, and the `memmap.json` join outputs | Where a single forward-carried `$01` value stops being correct — established by observation, or its absence recorded as a fact about the corpus |
| `criterion4-*.md` | *(not written yet — 23-04)* The `analyzer.rs` capability audit, read offline, every capability carrying exactly one of three dispositions | What the dropped `analyzer.rs` work did that dxa+Ghidra does not — derived from the real source, not inferred from the fixture |

---

## Evidence conventions

**Binding on every plan in phase 23**, not only on 23-01. Later plans cite this section
rather than restating it.

1. **Transcript convention.** Before running a command, append a line reading
   `$ <the exact command line>` to the named evidence file; then append its real stdout
   and stderr immediately below. A summary written in place of output is not evidence.
   Never reconstruct a transcript afterwards from memory.
2. **Worktree-independent probe directory.** Cross-wave working artifacts live at
   `PROBE_DIR=$HOME/.cache/c64-re-tools/phase23` — never inside the checkout, and never
   in `/tmp` (tmpfs on this host, 16 GB, cleared on reboot; the dxa+Ghidra pivot already
   lost its dxa build to it). Record the absolute `PROBE_DIR` paths in the evidence file
   so later waves can find them. Anything that matters is copied into `evidence/` before
   the session ends.
3. **Argv arrays, never shell strings.** Any spawn from a probe script uses an argv array.
   Never interpolate a path, a filename, or any string recovered from the corpus image
   into a shell command string.
4. **regenerator2000 is never executed** — not the binary, not `r2000-coverage.ts`, not as
   an oracle, a baseline or a screening tool (D-01). Reading `analyzer.rs` source offline
   is permitted and is PROOF-04's subject.
5. **Do NOT spawn a nested `claude` / `claude -p` session.** Nested sessions stall
   indefinitely in this project and the stall reports as success.
6. **Commit early.** Bank each task before starting the next; verify with `git log`.
7. **Outcome lines only.** Every rule input is a bare `NAME: value` at column 0 of a named
   evidence file. If a line is written more than once in a file, **the final occurrence
   wins** — this is stated here because Phase 9's own evidence carried a superseded early
   `INSTALLED_VERSION:` line that was only resolved 106 lines later.
8. **Single-owner file rule.** Measuring plans record `## RESEARCH CORRECTIONS` in their
   **own** evidence files. Exactly one closing plan (23-10) owns `23-RESEARCH.md` and the
   findings document, and collects every correction in one pass. Two parallel plans never
   edit one document.
9. **No product code.** `git diff --name-only <phase-base>..HEAD` must touch only
   `.planning/` and `docs/`. Nothing under `src/` is created or modified. Files under
   `src/` may be **read** (`memmap.json`, the skill scripts, `analyzer.rs` in the cargo
   registry) — reading is not modifying.
10. **The corpus image is never committed.** Identity is release name plus sha256 (D-04).

---

## External inputs

**Ghidra is recorded in evidence by version, never by install path.** The version is
`12.1.3 PUBLIC`, build `2026-Aug-17`. The probe install at `~/dev/_ghidra-probe/` states in
its own README that it is safe to delete and that nothing in the repo depends on that path —
so it is an **undeclared external input to this phase**, and recording its location as a
durable repository fact would create a dependency the install itself disclaims.

The same reasoning applies to `PROBE_DIR`: paths under `$HOME/.cache/c64-re-tools/phase23`
are recorded so a later wave can find a working artifact, never as facts the verdict rests on.

---

## Ordering proof

PROOF-05 rests on commit ordering and nothing else (D-08 declined a test guard).
Banked here, before the first measurement, as **two facts** — so the findings document
can cite the ordering without a reader running git. Captured immediately after the rule
commit landed and before any other path under `evidence/` was created.

**Fact one — the rules are the first thing in the evidence tree.**

```
$ git log --oneline -1 -- .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/DECISION-RULE.md
474c37c docs(23-01): pre-commit the decision rule and the outcome-line schema

$ git log --oneline --reverse -- .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence | head -1
474c37c docs(23-01): pre-commit the decision rule and the outcome-line schema
```

The two commits are the same commit. `README.md` and `corpus/.gitignore` were written
only after the rule commit had landed, so this identity holds by construction rather
than by luck.

**Fact two — no measurement evidence exists anywhere in history at this moment.**

```
$ git log --oneline -- '.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/criterion*' '.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/inventory' '.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/capture'
(no output)
```

Taken together the two facts are the whole of PROOF-05 ordering proof: the rules
provably precede every measurement.

**Scope note — ordering over `evidence/`, never primacy over the phase directory.**
The phase directory already carries four commits made before execution began — the
CONTEXT, RESEARCH, VALIDATION and PLAN documents — so
`git log --oneline --reverse -- <phase dir> | head -1` names the context commit and can
never name this plan commit, whatever this plan does. Every ordering assertion is
therefore scoped to `evidence/`, which is where measurement artifacts land and where
nothing existed before this task. A check scoped to the phase directory is
unsatisfiable by construction and must not be written.
