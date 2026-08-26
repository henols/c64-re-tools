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
| `tools/TOOLS.txt` | The schema-declared single home for the instrument and fixture-baseline outcome lines: `DXA_VERSION: 0.1.5`, `DXA_TARBALL_SHA256`, `DXA_BINARY_SHA256`, `GHIDRA_VERSION: 12.1.3 PUBLIC build 2026-Aug-17`, `JAVA_VERSION`, `VICE_BACKEND: fork 3.10`, and the five `FIXTURE_*` lines | That the gate measured a **pinned** instrument, identified by hash rather than by whatever was on `$PATH` — and that `DXA-01` can vendor the same build from the tarball sha256 alone |
| `tools/instrument-provenance.txt` | The fetch → sha256-verify → build transcript for dxa 0.1.5, the Ghidra and Java version reads, and the two headless Ghidra rehearsals (`FlatVolatile.java`, `ExportAnalysis23.java`) with their real stdout/stderr | That the pin was **verified**, not asserted: the tarball hash was checked against a third-party ports tree before the build, and both Ghidra scripts were proven to run end-to-end before any corpus existed |
| `tools/dxa-0.1.5.tar.gz.sha256` | The pinned tarball hash, alone in a file | That the hash `DXA-01` must vendor survives independently of any prose that quotes it |
| `tools/dxa` | The built binary the gate measured with, sha256 `0e2bf1a5…f0ec8523` | That the recorded numbers came from a binary a later reader can hash and compare, not from "dxa" generically |
| `tools/verify/*.bash` | Each 23-02 task's own automated verify, kept exactly as run | That the plan's own gates were executed rather than paraphrased — including the four that could **not** pass, because `SCHEMA.md`'s frozen domains contradict them |
| `fixture/` | `fixture.a` and `fixture.lbl` (the 279-byte fixture, rebuilt not quoted), `fixture-baseline.mjs` (the classifier), and `fixture-baseline.txt` (the transcript, RC-1..RC-3 and the four accepted schema divergences) | That the pivot's published 141-code / 138-data ground truth is **not source-derivable** — `fixture.a` yields 145/131/3-pad — so `FIXTURE_REPRODUCED: no`, and the apples-to-apples baseline for D-11 is `72.39 (97/134)` / 3 FP / `27.61 (37/134)`, not the published `72.46` / 0 |
| `dxa-listing-parse.mjs` | The `-a dump` listing parser, asserting the accounted byte total equals the image size | That an unseen line shape produces a **refusal by name** rather than a silent under-count — the one failure that would feed phantom code into every stage downstream |
| `FlatVolatile.java` | The Ghidra pre-script: `Memory.split()` at `$0002` / `$D000` / `$E000` **first**, then `setVolatile(true)` on the carved blocks only, with a `getBlock`-null fallback for the `.prg` route | That the pivot's `getBlock()`-first guard is wrong on a flat 64K import — one block `RAM 0000-ffff` means it marks the **entire address space** volatile, with no error and no warning — and that this phase used split-first instead |
| `ExportAnalysis23.java` | The post-script exporting functions, typed cross-references and structural facts | That the criterion-2 route was rehearsed headless and reproducible before any corpus run was attempted |
| `inventory/` | **NEVER PRODUCED.** Plan 23-05 was not dispatched: it reads the depacked flat-64K capture as its substrate (D-03) and 23-03 could not produce one | That `not-exercised` was **never earned** for criteria 2 and 3. Both are `could-not-run`, which is a fact about this phase's execution, not about the corpus |
| `capture/CAPTURE-SUMMARY.txt` | Rule `R1`'s only input, `C0_CORPUS: partial`, with the aggregation rule reproduced and walked; plus `CAPTURE_HANDOFF_PC: $1BC2` and `CAPTURE_PORT01: $35` per release, and `CAPTURE_SIZE` / `CAPTURE_SHA256` / `CAPTURE_EQUIVALENT` recording `could-not-run` / `could-not-run` / `no` | That the verdict input was **derived from the recorded values by a stated rule**, not judged — three of `pass`'s five conjuncts fail, `could-not-run` does not apply because the emulator *was* driven to the handoff four times, so `partial` is the branch and `R1` fires |
| `capture/capture-record-primary.md` | The canonical release's two cold runs, the verbatim `vice_memory_compare` output, and ACCEPTED LIMITs 1 (the 64K image could not be assembled) and 2 (`WarpMode` unavailable) | That capture equivalence was **disproven by measurement**, not assumed: two runs stopping in different game frames gave 231 differing addresses, 100 of them non-volatile and multi-bit |
| `capture/capture-record-secondary.md` | The secondary release's two runs, both voided, and the single disarm-and-resume record for the session | That intra-frame position costs only one-bit drift — both runs stopped in the *same* frame and diverged at exactly one non-volatile multi-bit address (`$00F6`) — which isolates **frame index** as the dominant term |
| `capture/handoff-identification.txt` | How `$1BC2` was identified by disassembling the running machine, and the two voided runs that preceded the recorded ones | That the handoff is a runtime observation (D-06) and not a guess, and that voided runs are recorded rather than discarded |
| `capture/RELEASES.json` | The two-release scratch registry, `danish` flagged canonical, `dumps: []` | That the corpus is modelled as a **list with exactly one canonical element** and that no dump was ever produced |
| `criterion1-*.txt` | **NEVER PRODUCED.** Plans 23-06 and 23-07 were not dispatched, for the same D-03 reason | That criterion 1 is `could-not-run`: there is **no** data-recovery rate, no false-positive count, no window, no denominator and no adjudicated fraction for any release. Whether the fixture flattered dxa remains unanswered against a real release — though `fixture/fixture-baseline.txt` shows the published partition itself flattered it |
| `criterion2-*.txt` | **NEVER PRODUCED.** Plan 23-08 was not dispatched, for the same D-03 reason | That criterion 2 is `could-not-run` and explicitly **not** `not-exercised`: zero sites were enumerated and zero tested, so nothing is known either way about Ghidra on a computed-index dispatch in real code |
| `criterion3-*.txt` | **NEVER PRODUCED.** Plan 23-09 was not dispatched, for the same D-03 reason | That criterion 3 is `could-not-run`. The single-forward-carried-`$01` model is left **unvalidated** — neither confirmed nor broken — at exactly the risk the ROADMAP names as the highest on the pivot's own record |
| `criterion4-analyzer-audit.md` | All 26 `analyzer.rs` capabilities (8 entry points, 11 `LabelType`, 7 `BlockType`), each carrying exactly one disposition: `C4_CAPABILITIES_AUDITED: 26`, `C4_REPLACED: 23`, `C4_LOST_ACCEPTED: 3`, `C4_UNREPLACED_CAPABILITIES: 0`. Three `## ACCEPTED LIMIT` blocks and seven research corrections | That **nothing in `analyzer.rs` blocks the milestone** — `R8`'s input is `0` — derived from the real crate source with no regenerator2000 process started (D-01), and that the one row a re-run could move (E6 `follow_indirect_jumps`) is named with the exact condition that would move it |
| `docs/phase23-real-release-gate-findings.md` *(outside this directory, at the repository root's `docs/`)* | The durable verdict artifact (23-10): machine-readable frontmatter, the derivation, the rule reproduced verbatim, one section per criterion, the collected accepted limits and corrections | That the verdict `no-go` / `R1` is **re-derivable from the document alone**, without trusting any summary and without a plan file surviving |

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

---

## Repo integrity

Evidence convention 9 in full: `git diff --name-only <phase-base>..HEAD` must touch only
`.planning/` and `docs/`. **Nothing under `src/` is created or modified** by any plan in this
phase. Files under `src/` may be *read* (`memmap.json`, the skill scripts, `analyzer.rs` from
the cargo registry); reading is not modifying.

The phase base is `fd1093b` — the commit immediately preceding `d6cf1ba
docs(23): capture phase context`, which is the first commit anywhere under this phase
directory. The output below is the real command's real output, pasted, taken at the commit
that introduces this section.

```
$ git diff --name-only fd1093b..HEAD
.planning/ROADMAP.md
.planning/STATE.md
.planning/WINDOWS.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/23-01-PLAN.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/23-01-SUMMARY.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/23-02-PLAN.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/23-02-SUMMARY.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/23-03-PLAN.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/23-03-SUMMARY.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/23-04-PLAN.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/23-04-SUMMARY.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/23-05-PLAN.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/23-06-PLAN.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/23-07-PLAN.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/23-08-PLAN.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/23-09-PLAN.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/23-10-PLAN.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/23-11-PLAN.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/23-CONTEXT.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/23-DISCUSSION-LOG.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/23-PATTERNS.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/23-RESEARCH.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/23-VALIDATION.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/COVERAGE.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/deferred-items.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/DECISION-RULE.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/ExportAnalysis23.java
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/FlatVolatile.java
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/README.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/SCHEMA.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/capture/CAPTURE-SUMMARY.txt
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/capture/RELEASES.json
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/capture/capture-record-primary.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/capture/capture-record-secondary.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/capture/handoff-identification.txt
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/.gitignore
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/corpus-intake.txt
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/criterion4-analyzer-audit.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/dxa-listing-parse.mjs
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/fixture/fixture-baseline.mjs
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/fixture/fixture-baseline.txt
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/fixture/fixture.a
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/fixture/fixture.lbl
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/tools/TOOLS.txt
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/tools/dxa
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/tools/dxa-0.1.5.tar.gz.sha256
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/tools/instrument-provenance.txt
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/tools/verify/README.md
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/tools/verify/task1-verify-as-planned.bash
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/tools/verify/task1-verify-schema-domains.bash
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/tools/verify/task2-verify-as-planned.bash
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/tools/verify/task3-verify-as-planned.bash
.planning/todos/pending/2026-08-26-extract-flat-64k-from-vice-snapshots-instead-of-transcribing-hex.md
.planning/todos/pending/2026-08-26-run-vice-headless-and-in-warp-mode-when-the-run-allows-it.md
docs/phase23-real-release-gate-findings.md
```

Every path is under `.planning/` or `docs/`. **No line begins with a source-tree path, so the
no-product-code invariant holds and is proven rather than asserted.** Mechanical re-check:

```
$ git diff --name-only fd1093b..HEAD | grep -c '^src/'
0
```

Note on scope: this section's own commit adds `docs/phase23-real-release-gate-findings.md` and
modifies this file and `23-RESEARCH.md`, all three of which already appear in the list above,
so the assertion is stable across the commit that records it. The two `.d64` corpus images are
absent from the list by construction — `corpus/.gitignore` refuses every binary image form and
neither image was ever staged (D-04, convention 10). The one committed binary in the tree,
`evidence/tools/dxa`, is the built probe instrument under `.planning/`, recorded with its
sha256 in `tools/TOOLS.txt`; it is evidence, not a deliverable, and it is registered in no
manifest.
