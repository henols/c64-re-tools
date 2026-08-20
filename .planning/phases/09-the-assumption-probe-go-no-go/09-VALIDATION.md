---
phase: 9
slug: the-assumption-probe-go-no-go
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-20
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> **This phase builds no product code.** "Validation" here does not mean
> "the feature works" — it means **the recorded evidence is real, was actually
> executed, and a later session can re-run it.** Derived from
> `09-RESEARCH.md` → `## Validation Architecture`.

**The governing lesson (Phase 8.1):** a check written by the same pass that made
the claim proves less than it looks like. In Phase 8.1, running the one
unwitnessed claim **falsified it** and exposed a real product defect
(`Drive8Type=0`). `09-RESEARCH.md` is itself a **hypothesis set derived from
source reading**, not evidence — every criterion below must be an executed
command with captured output, and where the transcript contradicts the research,
**the transcript wins and the research document is corrected**.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | **None.** No `node --test` suite is added by this phase. Evidence is captured shell transcripts, not assertions. |
| **Config file** | none |
| **Quick run command** | n/a — per-criterion commands live in `09-RESEARCH.md` → `## Code Examples` |
| **Full suite command** | n/a — but the existing 21-file subset (`.claude/mcp/vice`, 294 tests) must not regress, since this phase should not touch it at all |
| **Estimated runtime** | Dominated by `cargo install` and `docker build` (minutes, unbounded on first run) — not a per-commit gate |

**Why no framework:** every criterion is a **one-time go/no-go observation
against a live third-party binary**. This project's own `CLAUDE.md` already
carves out exactly this category (`vice-sync.ts`'s checkpoint-wait functions —
"their correctness only means anything against a real emulator's timing"). The
reasoning is stronger here: there is no correct behavior to assert in code,
because the whole question is what someone else's binary actually does, once, on
this host.

**Corollary the plan must respect:** a passing unit test would be evidence of
nothing here. Do **not** let a plan satisfy a criterion by adding a test that
asserts what the research predicted.

---

## Sampling Rate

- **After every task commit:** N/A — no automated test exists to run per commit.
  The per-task equivalent is: **the transcript file named in the task's
  acceptance criteria exists, is non-empty, and contains the command line that
  produced it.**
- **After every plan wave:** re-run the commands for any criterion an earlier
  wave already answered if that wave changed the installed build, the test
  fixture, or the project file. **A stale transcript is not evidence of a
  re-verified claim.**
- **Before the verdict is written:** all five criteria have a recorded outcome —
  `pass`, `fail`, or `could-not-run` — in `docs/phase9-regenerator2000-probe-findings.md`.
  `could-not-run` is a **legitimate terminal outcome** and must be recorded as an
  accepted limit naming what it breaks; it is not a reason to retry forever.
- **Max feedback latency:** not meaningful per-commit. Per criterion: the
  transcript must be written in the same task that runs the command, never
  reconstructed afterwards from memory.

---

## Per-Task Verification Map

Task IDs are placeholders until plans exist; the **evidence artifact** column is
the binding part — it is what a later session re-reads.

| Criterion | Req | Wave | Behavior under test | Test Type | Command shape | Evidence artifact | Status |
|---|---|---|---|---|---|---|---|
| 1 — build present | R2000-16(5) | 1 | A real build exists here and identifies itself | manual, transcript | `cargo install regenerator2000` → `regenerator2000 --version` | `evidence/criterion1-install-and-version.txt` | ✅ green — `INSTALLED_VERSION: regenerator2000 0.9.20` (plan 09-01, Task 3) |
| 1 — toolchain cost | R2000-16(5) | 1 | Build time and image-size delta **measured**, both single-stage and multi-stage | manual, transcript | `docker build` with timing → `docker image inspect --format '{{.Size}}'` | `evidence/criterion1-container-toolchain-cost.txt` | ✅ green — `SINGLE_STAGE_BYTES: 1256576420`, `MULTI_STAGE_BYTES: 250820636` (plan 09-02, Task 2); never a verdict gate per the decision rule |
| 2 — pty + bootstrap | R2000-16(1) | 2 | `--mcp-server <raw binary>` survives a pty with no real TTY **and** the Save-As dialog can be driven with no human, producing a `.regen2000proj` a later `--headless` run loads | manual, transcript | `tmux new-session -d` → wait on `capture-pane` → `send-keys` → MCP handshake via vendored `StreamableHTTPClientTransport` | `evidence/criterion2-pty-transcript.txt` | ✅ green — `PTY_TOLERANCE: pass`, `BOOTSTRAP_AUTOMATABLE: pass` (plan 09-03, Tasks 1 & 3) |
| 3(2) — reassembly | R2000-16(2) | 3 | `--export_asm --assembler acme` output reassembles under `!cpu 6510` | manual, but **uses regenerator2000's own gate** | `regenerator2000 --headless --assembler acme --verify <proj>` | `evidence/criterion3-reassembly.txt` | ✅ green (qualified) — `REASSEMBLY: pass` under `use_illegal_opcodes: true` override (plan 09-04, Task 2); accepted limit recorded for the bootstrap default |
| 3(3) — `--export_lbl` | R2000-16(3) | 3 | An **unmodified** `--export_lbl` file is consumed as-is by `vice_symbols_load` | manual + static grammar diff | export, then run `stock-symbols.ts`'s `VICE_LABEL_LINE_RE` over every line | `evidence/criterion3-export-lbl.txt` | ✅ green — `GRAMMAR_MATCH: 2/2`, `SYMBOLS_LOAD: pass`, `EXPORT_LBL: pass` (plan 09-05, Tasks 1-3) |
| 3(4) — `.vsf` load | R2000-16(4) | 3 | A `.vsf` from `vice_snapshot_save` loads carrying machine type and start address | manual, transcript | produce `.vsf` via live VICE → load → **ask what it saw** | `evidence/criterion4-vsf-load.txt` | ⚠️ flaky→recorded as `partial` — `VSF_LOAD: partial` (plan 09-06, Task 3): memory content and start address genuinely carried; machine type traced to a coincidental default, not a real derivation. Recorded as an accepted limit, not left ambiguous |
| 4 — evidence recorded | R2000-16 | 4 | Every answer, including every failure, is in the repo as an accepted limit naming what it breaks | source assertion | `docs/phase9-regenerator2000-probe-findings.md` exists and covers all five | that file | ✅ green (plan 09-07, Task 1) — all five criteria have a section, a summary-table row, and an `## Accepted limits` entry where non-pass |
| 5 — verdict recorded | R2000-16 | 4 | A machine-readable `proceed \| degrade \| reconsider` verdict Phase 10's planner can read as a gate | source assertion | frontmatter field in the findings doc | that file | ✅ green (plan 09-07, Task 2) — `verdict: degrade`, `verdict_rule_applied: R4` |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Evidence Integrity Rules

These are the actual validation controls for this phase. They replace "the tests pass".

1. **Executed, not inferred.** Every criterion's evidence file must contain the
   literal command line and its real stdout/stderr. A summary written from
   memory, or a claim traceable only to `09-RESEARCH.md`, is not evidence.
2. **The transcript outranks the research.** `09-RESEARCH.md` cites upstream
   `file:line` at commit `df4bc94`. Per `CLAUDE.md`'s convention, a mismatch is
   **drift to re-verify**, not evidence the constraint changed. Where observation
   contradicts the research, record the observation and correct the research doc.
3. **Record the version that actually ran.** `cargo install regenerator2000` may
   not fetch code byte-identical to what the research read. The installed
   `--version` (and resolved crate version) is what every other criterion's
   evidence is qualified by.
4. **No false pass on an empty artifact.** `--export_lbl` only emits
   `LabelKind::User` labels (`file_io.rs:732-748`). An auto-analysed-only project
   exports a **syntactically valid empty file** that looks like a pass and proves
   nothing. Either annotate at least one label before exporting, or record
   "empty because no user label was set" as a distinct finding — never as
   criterion 3(3) passing.
5. **Do not confuse an unrelated precondition failure with a probe result.**
   `r2000_save_project` returns `-32603 No active project path` on a
   freshly-loaded raw binary **by design**, regardless of pty behavior. That
   error is not a pty answer in either direction.
6. **`.vsf` must be interrogated, not merely loaded.** "It did not crash" is not
   the criterion. The evidence must show the machine type and start address
   regenerator2000 actually derived, compared against what the snapshot carried.
7. **Prefer the tool's own gate.** `--verify` already exports, shells to a real
   `acme --cpu 6510 --format cbm`, and diffs bytes. Building a second gate is an
   anti-pattern and its result would be less trustworthy, not more.
8. **`could-not-run` is a recordable outcome.** A probe that cannot run is itself
   information. Record what blocked it and what it leaves unanswered, then move
   on — do not convert a blocked probe into an assumption.
9. **Never pass `--vice`.** Standing hard constraint, restated as a validation
   rule because "just to see" is exactly how it would get violated in a probe.
   Stock VICE's binary monitor serves exactly one client; a second `connect()` is
   indistinguishable from a wedge to this project's own triage machinery.

---

## Wave 0 Requirements

All prerequisites below were satisfied over waves 1-4; each is marked complete with the
evidence that closed it.

- [x] `tmux` installed (`expect` as a verified fallback) — installed by the human
      (`sudo apt-get install -y tmux`) at plan 09-01's checkpoint; `tmux 3.5a` confirmed
      on PATH (`evidence/criterion1-install-and-version.txt`)
- [x] `regenerator2000` installed, `--version` and resolved crate version recorded —
      `regenerator2000 0.9.20` (`evidence/criterion1-install-and-version.txt`)
- [x] A real test fixture chosen or built — `evidence/fixture/probe-illegal.a`/`.prg`,
      hand-written, exercising six real illegal 6510 opcodes (`lax`, `sax`, `slo`,
      `dcp`, `isc`, `anc`), built via `node .claude/skills/acme-build/scripts/acme.mjs
      build` (`evidence/criterion0-prerequisites.txt`)
- [x] Throwaway MCP client harness (`evidence/mcp-harness.mjs`) using the vendored
      `@modelcontextprotocol/sdk` `StreamableHTTPClientTransport` — written and used in
      plan 09-03, resolved via a `node_modules` symlink into the main checkout with no
      `npm install`
- [x] Two throwaway Dockerfiles (single-stage vs multi-stage) —
      `evidence/Dockerfile.single`, `evidence/Dockerfile.multi`, both committed as
      measurement apparatus (plan 09-02)
- [x] `docs/phase9-regenerator2000-probe-findings.md` created — this plan (09-07),
      following the shape of `docs/phase1-probe-results.md` and
      `docs/phase2-backend-probe-evidence.md`
- [x] A free `127.0.0.1:3000` confirmed before starting the MCP server — checked with
      `ss -ltn | grep ':3000'` before every launch across plans 09-03/09-04/09-05/09-06,
      confirmed free each time

---

## Manual-Only Verifications

**All of them.** This table is the whole phase, which is why the framework row above is "None".

| Behavior | Requirement | Why Manual | Test Instructions |
|---|---|---|---|
| pty tolerance + keystroke-driven Save-As bootstrap | R2000-16(1) | Requires a real pty and synthesized keystrokes into a third-party TUI; there is no in-process seam to assert against | `09-RESEARCH.md` → Code Examples, criterion 2 |
| Reassembly under `!cpu 6510` | R2000-16(2) | Needs a real assembler binary and a real project file | `--headless --assembler acme --verify` |
| `--export_lbl` consumed as-is | R2000-16(3) | Producer is an external binary; only its real output settles it | export, then match against `VICE_LABEL_LINE_RE` |
| `.vsf` load fidelity | R2000-16(4) | Needs a live emulator to produce the snapshot | `vice_snapshot_save` → load → interrogate |
| Container toolchain cost | R2000-16(5) | A measurement, not a regression test; re-running it in CI would be waste | `docker build` timing + `image inspect` size |

---

## Validation Sign-Off

- [x] Every criterion has an evidence file containing its literal command and real
      output — all six `evidence/criterion*.txt` files, verified by direct read during
      this plan's own execution
- [x] The installed `--version` is recorded (`regenerator2000 0.9.20`) and every other
      finding is qualified by it and by the toolchain that actually built it
      (`rustc 1.97.1`, after the human-authorized `rustup update stable` mid-phase)
- [x] Every research claim contradicted by observation has been corrected in
      `09-RESEARCH.md` — this plan's Task 3 applied all `## RESEARCH CORRECTIONS` blocks
      from the six evidence files in one pass (Assumptions A1-A4, Open Questions 1-3,
      Pitfalls 3-4, the Architecture Patterns diagram, the `.vsf` machine-type claim, and
      the Metadata confidence breakdown)
- [x] Every failure is recorded as an accepted limit **naming what it breaks** —
      `docs/phase9-regenerator2000-probe-findings.md`'s `## Accepted limits` section
      names criterion 3(2)'s `use_illegal_opcodes` bootstrap-default gap (breaks:
      `R2000-09`/Phase 10 criterion 4 unless the pipeline sets it explicitly) and
      criterion 3(4)'s machine-type coincidental-default gap (breaks: the ROADMAP's
      standing "prefer `.vsf` over `.raw`" constraint and Phase 10 criterion 3, for the
      machine-type field specifically)
- [x] `--export_lbl` was not scored as a pass on an empty file — the export carried
      `EXPORT_LBL_LINES: 2` (a real MCP-set user label plus the auto-generated
      `.start`), never zero
- [x] `.vsf` was interrogated for machine type and start address, not just loaded —
      scored `partial`, not `pass`, precisely because "it loaded without crashing" was
      not treated as sufficient (Evidence Integrity Rule 6)
- [x] `--vice` was never passed — confirmed by an explicit grep across every evidence
      transcript and harness script in plans 09-01 through 09-06, and restated in this
      plan's own findings document
- [x] A machine-readable `verdict:` (`proceed` \| `degrade` \| `reconsider`) exists where
      Phase 10's planner will look for it — `docs/phase9-regenerator2000-probe-findings.md`
      frontmatter, `verdict: degrade`, `verdict_rule_applied: R4`
- [x] `nyquist_compliant: true` set in frontmatter — every one of the five criteria has a
      real recorded outcome (four `pass`, one `partial`; none missing or silently
      skipped), which is this phase's own honesty standard, not universal success

**Approval:** signed off 2026-08-20 by plan 09-07 (Task 3), against the evidence
gathered in waves 1-3 and the verdict derived in this plan's Task 2.
