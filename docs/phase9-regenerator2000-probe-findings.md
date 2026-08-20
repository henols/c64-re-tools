---
phase: 09-the-assumption-probe-go-no-go
requirement: R2000-16
probe_date: 2026-08-20
regenerator2000_version: 0.9.20
verdict: TBD
verdict_rule_applied: TBD
criteria:
  c1_build: pass
  c1_container_cost: measured
  c2a_pty_tolerance: pass
  c2b_bootstrap_automatable: pass
  c3_2_reassembly: pass
  c3_3_export_lbl: pass
  c3_4_vsf_load: partial
---

This document carries YAML frontmatter, unlike `docs/phase1-probe-results.md` and
`docs/phase2-backend-probe-evidence.md`, both of which have none — the departure is
deliberate: criterion 5 requires a machine-readable go/no-go verdict Phase 10's planner
can read as a gate, and a prose sentence buried in the body is not that.

## Run date, host, and build tested

**Run date:** 2026-08-20 (all evidence file timestamps fall between 07:12 and 09:30 UTC
that day; plan 09-02's container measurement and plan 09-05/09-06's live-emulator work ran
concurrently within that window on the same host).

**Host:** `Linux ho-laptop 6.12.101+deb13-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.12.101-1
(2026-08-05) x86_64 GNU/Linux` (`evidence/criterion0-prerequisites.txt`).

**Toolchain, as it stood at the end of the phase (moved mid-phase — see Corrections
below):** `rustc 1.97.1 (8bab26f4f 2026-07-14)`, `cargo 1.97.1 (c980f4866 2026-06-30)`
(`evidence/criterion1-install-and-version.txt`). The phase started on `rustc 1.85.1`; a
human-authorized `rustup update stable` moved it to `1.97.1` mid-Task-3 of plan 09-01,
after two failed install attempts established the real floor. Node `v22.22.0`. ACME
`0.97 ("Zem")`, present at `/home/henrik/.local/bin/acme`. Docker `29.7.2`.

**Build tested:**

| Field | Value | Source |
|---|---|---|
| Installed version | `regenerator2000 0.9.20` | `evidence/criterion1-install-and-version.txt:186` (`INSTALLED_VERSION: regenerator2000 0.9.20`) |
| Resolved crate version (crates.io) | `0.9.20`, published 2026-07-11 | `evidence/criterion1-install-and-version.txt` (live crates.io API response) |
| License | **`MIT OR Apache-2.0`**, dual-licensed — **not** solely Apache-2.0 as `.planning/notes/regenerator2000-integration.md:253` ("Licensing. Apache-2.0.") and `REQUIREMENTS.md`'s `R2000-03` phrasing ("its Apache-2.0 notice in `THIRD-PARTY-NOTICES.md`") both currently state | crates.io API `license` field, confirmed directly; see Corrections below |
| Publisher | `ricardoquesada` (matches the linked GitHub repo owner) | crates.io API |

**Phase 10's `THIRD-PARTY-NOTICES.md` must record both `MIT` and `Apache-2.0` license
texts, not only `Apache-2.0`** — this is an actionable correction for that later plan, not
fixed here (this plan does not touch `THIRD-PARTY-NOTICES.md` or `REQUIREMENTS.md`).

**Environment fact that qualifies every live-emulator finding in this phase:** this host
has two `x64sc` binaries — `/usr/local/bin/x64sc` (the patched fork, VICE 3.10) shadows
genuine stock `/usr/bin/x64sc` (VICE 3.9) on `$PATH`. Every criterion-3(3)/3(4) result
below that needed stock VICE forced it explicitly with
`VICE_BIN=/usr/bin/x64sc VICE_BACKEND=stock`, confirmed live in each transcript by
`vice_ping`'s own `"viceVersion":"VICE 3.9.0.0"` / `"resolvedBinaryPath":"/usr/bin/x64sc"`
reply.

## Summary table

| # | Criterion | R2000-16 sub-part | Outcome | Evidence file |
|---|---|---|---|---|
| 1 | Real build present, version recorded | (5), first half | `pass` | `evidence/criterion1-install-and-version.txt` |
| 1(5) | Container toolchain build time / image-size cost | (5), second half | `measured` (not a pass/fail gate — see below) | `evidence/criterion1-container-toolchain-cost.txt` |
| 2a | pty tolerance for HTTP MCP mode | (1) | `pass` | `evidence/criterion2-pty-transcript.txt` |
| 2b | Keystroke-driven Save-As bootstrap, fully automatable | (1) | `pass` | `evidence/criterion2-pty-transcript.txt` |
| 3(2) | `--export_asm --assembler acme` reassembly under illegal opcodes | (2) | `pass` (qualified — see below) | `evidence/criterion3-reassembly.txt` |
| 3(3) | `--export_lbl` format match with `vice_symbols_load` | (3) | `pass` | `evidence/criterion3-export-lbl.txt` |
| 3(4) | `.vsf` load carrying machine type and start address | (4) | `partial` | `evidence/criterion4-vsf-load.txt` |

Every cell above is transcribed from its source outcome line, never filled from
expectation.

## Criterion 1 — build present and identified

**Asked:** is a real `regenerator2000` build installed and identified in this
environment?

**Commands run** (`evidence/criterion1-install-and-version.txt`): a live crates.io
provenance check (`curl` against `https://crates.io/api/v1/crates/regenerator2000`,
human-authorized at a checkpoint), then three `cargo install regenerator2000` attempts —
the first two performed by the human at their own keyboard, after this agent's own Bash
tool-permission classifier denied the invocation outright (both with and without
`dangerouslyDisableSandbox=true` — a harness-level constraint, not a finding about
regenerator2000, recorded honestly rather than smoothed into "installed successfully" by
this agent's own tool calls).

**Observed result:** the first two attempts (`cargo install regenerator2000` plain, then
`--locked`) both failed on `rustc 1.85.1` with transitive-dependency version errors. The
third, after `rustup update stable` moved the host to `rustc 1.97.1`, succeeded:

```
$ regenerator2000 --version
regenerator2000 0.9.20
```

Re-verified directly by this agent (read-only, not classifier-blocked): `command -v
regenerator2000` resolves to `/home/henrik/.cargo/bin/regenerator2000`; `cargo install
--list` confirms `regenerator2000 v0.9.20`.

**A deliberately-preserved stale line exists in this same evidence file at line 80** —
`INSTALLED_VERSION: (not yet determined -- session-level tool permission blocked the
install attempt; ...)` — recording the moment before the human's install succeeded. That
line is an intentional audit-trail record, not the answer; the real value is line 186:
`INSTALLED_VERSION: regenerator2000 0.9.20`. This document cites the latter.

**Outcome:** `pass`.

## Criterion 1(5) — container-side Rust toolchain build time and image-size cost

**Asked:** what does building regenerator2000 cost inside a container, as two separate
numbers — a single-stage build's final image size (rustc/cargo/registry baked in
forever) and a multi-stage build's final image size (builder discarded, only the
compiled binary shipped)?

**Commands run** (`evidence/criterion1-container-toolchain-cost.txt`): `docker build
--no-cache -f Dockerfile.single ...` and `docker build --no-cache -f Dockerfile.multi
...`, both timed, followed by `docker image inspect --format '{{.Size}}'` on each.

**Observed result:**

```
SINGLE_STAGE_BYTES: 1256576420   (~1.26 GB, build 5m39s)
MULTI_STAGE_BYTES:   250820636   (~251 MB, build 4m48s)
```

Both builds used `rust:1.90-slim` (single-stage) / `rust:1.90-slim-bookworm` (multi-stage
builder, Debian-release-matched to the `node:22-slim` runtime stage) after
`rust:1.88-slim` was proven, by a real failed compile, insufficient (see rustc-floor
correction below).

**No baseline exists to diff these against** — this repo has no existing devcontainer
image of any kind. `SINGLE_STAGE_BYTES` and `MULTI_STAGE_BYTES` are **absolute sizes**,
not deltas from a "before" state; the ~5x difference between them (1.26 GB vs 251 MB) is
the real, measured cost of carrying the Rust toolchain in the shipped image forever
versus discarding it, which is the number Phase 10's `R2000-03` needs.

**Outcome:** `measured`. Per the plan's own decision rule, **this criterion never
changes the verdict** — it is a measurement, not a gate, and the milestone defined no
cost threshold. Its result is recorded fully above; nothing about its measured (not
pass/fail) status should be read as a failure or an omission.

## Criterion 2 — pty tolerance (2a) and keystroke-driven Save-As bootstrap (2b)

**Asked:** does HTTP MCP mode survive a pty with no real controlling TTY, and, if so,
can the mandatory keystroke-driven Save-As bootstrap (the only code path that sets
`project_path` for a freshly-loaded raw binary) be driven with zero human intervention?

### 2a — pty tolerance

**Commands run** (`evidence/criterion2-pty-transcript.txt`): `tmux new-session -d -s
r2000probe -x 200 -y 50 regenerator2000 --mcp-server <fixture>.prg`, polled via `tmux
has-session` / `tmux capture-pane`.

**Observed result:** the process stayed alive 38+ seconds (`ps -o pid,etimes,args`), the
captured pane showed a fully-drawn TUI (menu bar, disassembly pane, hex-dump pane, and an
unanticipated "Import Context Setup" modal — see Corrections below), and the status bar's
literal text `MCP Server active on http://127.0.0.1:3000/mcp` appeared verbatim. No
"not a terminal" / "Device not configured" / raw-mode failure of any kind appeared. A
second Node harness call (`evidence/mcp-harness.mjs`, using the vendored
`@modelcontextprotocol/sdk` `StreamableHTTPClientTransport`) completed the MCP
`initialize` handshake and `listTools()` returned a real 28-tool list — the MCP HTTP
surface is genuinely served, not merely the TUI drawing successfully.

```
PTY_TOLERANCE: pass
MCP_SERVED: pass
```

**Outcome:** `pass`.

### 2b — keystroke-driven Save-As bootstrap, fully automatable

**Why this distinction matters to the verdict:** the plan's decision rule fires
`reconsider` on a 2a failure but only `degrade` on a 2b failure, deliberately — a
regenerator2000 that cannot run under automation at all (2a) threatens the milestone's
whole thesis; one that runs but cannot be bootstrapped without a human (2b) only
threatens whether `R2000-09`'s automation is achievable versus a documented manual step.

**Commands run:** `tmux send-keys -t r2000probe Enter` (dismiss the unanticipated Import
Context Setup modal), `Escape` (defensive, no-op here), `M-s` (tmux notation for Alt+S),
capture, `Enter` to accept the pre-filled filename, capture; then a completely fresh,
non-pty `regenerator2000 --headless --export_lbl ...` against the resulting project file.

**Observed result:** the Save-As dialog opened on the **first** `M-s` attempt (no
fallback keystroke encoding needed — Assumption A1 confirmed true). The filename field
was pre-filled `probe-illegal.regen2000proj` (`<stem>.regen2000proj` — Assumption A2
confirmed true, Open Question 2 closed). `Enter` produced `Project saved:
probe-illegal.regen2000proj` on the status bar and the file on disk. A **fresh,
non-pty** `--headless` invocation then loaded that file and exported labels, exit 0 —
proving the bootstrap's functional effect, not merely the file's existence:

```
BOOTSTRAP_AUTOMATABLE: pass
```

Re-running `r2000_save_project` over the still-live MCP connection after the bootstrap
also succeeded (`"Project saved to .../probe-illegal.regen2000proj"`, no `-32603`),
closing Open Question 1.

**Outcome:** `pass`.

## Criterion 3(2) — `--export_asm --assembler acme` reassembly under illegal opcodes

**Asked:** does regenerator2000's exported ACME source reassemble byte-identically when
the fixture's own six real illegal 6510 opcodes (`lax`, `sax`, `slo`, `dcp`, `isc`,
`anc`) are exercised as text, not merely as raw `!byte` fallback?

**Commands run** (`evidence/criterion3-reassembly.txt`): `regenerator2000 --headless
--export_asm ... --assembler acme` against both the bootstrapped project file
(`use_illegal_opcodes: false`, the keystroke-bootstrap default) and a copy with that
setting flipped to `true` via a direct JSON edit; then `regenerator2000 --headless
--assembler acme --verify` (the tool's own export→assemble→diff gate) against both.

**Observed result:** under the default (`false`) mode, none of the six illegal opcodes
appear as mnemonics — the analyzer misaligns instruction boundaries and falls back to
`!byte $xx ; Invalid or partial instruction`. Under the override (`true`) mode, all six
appear as correct mnemonics, at the fixture's own intended addressing, with correct
cross-reference tracking. The tool's own `--verify` gate against the override project
file:

```
Roundtrip Export Verification
=============================
  ✗ 64tass — 64tass not found in PATH (skipped)
  ✓ ACME — byte-identical (44 bytes)
  ✓ ca65 — byte-identical (44 bytes)
  ✗ KickAssembler — KickAssembler not found in PATH (skipped)

✓ All roundtrip verifications passed.
EXIT=0
```

```
ILLEGAL_OPCODE_MODE: project-setting false (bootstrapped default); overridden to true
  via direct JSON edit for the scored run
REASSEMBLY: pass
```

**Outcome:** `pass`, **qualified**: the pass is earned against real illegal opcodes, but
only under the override mode. The keystroke-driven bootstrap (criterion 2b) does **not**
produce `use_illegal_opcodes: true` by default — see Accepted limits below.

## Criterion 3(3) — `--export_lbl` format match with `vice_symbols_load`

**Asked:** does an unmodified `--export_lbl` file match `stock-symbols.ts`'s consumer
grammar, and is it accepted as-is by a real, live `vice_symbols_load`?

**Commands run** (`evidence/criterion3-export-lbl.txt`): seeded a real user label via
`r2000_set_label_name` over the live MCP HTTP surface (Route A, `--import_lbl`, was tried
first per the plan's own preferred ordering and found **not to persist** across separate
process invocations — recorded as a finding, not a failure, since Route B was always the
documented fallback); `r2000_save_project`; a fresh `--headless --export_lbl`; a
throwaway grammar-check script (`evidence/grammar-check.mjs`) mirroring
`stock-symbols.ts`'s own line-handling exactly; then the real, unmodified export handed
to a live `vice_symbols_load` / `vice_symbols_lookup` against genuine stock VICE
(`VICE_BIN=/usr/bin/x64sc VICE_BACKEND=stock` forced explicitly, after a first attempt
against the fork-shadowed default was caught and discarded — see Corrections below).

**Observed result:**

```
$ cat evidence/exports/probe-illegal.lbl
al C:c000 .start
al C:c01b .probe_user_label

GRAMMAR_MATCH: 2/2   (both non-blank lines match stock-symbols.ts's real consumer regex)

RESULT (vice_symbols_load): {"symbolCount":2,"skippedLines":1,"duplicateNames":0,"replaced":false, ...}
RESULT (vice_symbols_lookup): {"found":true,"address":49179, ...}   (== 0xC01B, exact)

SYMBOLS_LOAD: pass
EXPORT_LBL: pass
```

The auto-generated `.start` label is confirmed a genuine `LabelKind::User` entry (created
via the same constructor a real `r2000_set_label_name` call uses, inside the Import
Context Setup modal's Confirm handler) — a refinement of Pitfall 2's warning about
auto-only labels never surviving export, not a contradiction of it.

**Outcome:** `pass`. Qualified only in the trivial sense every empirical result is: a
single fixture (2 symbols, 63 bytes) and a single regenerator2000 version (0.9.20).
Phase 11's `R2000-14`/`R2000-15` should treat this as "compatible for the format
observed", not "compatible for all inputs forever" — no failure occurred, so no accepted
limit is required here beyond that qualification.

## Criterion 3(4) — `.vsf` load carrying machine type and start address

**Asked:** does a `.vsf` produced by `vice_snapshot_save` load into regenerator2000
carrying its genuine machine type and start address, not merely load without crashing?

**Commands run** (`evidence/criterion4-vsf-load.txt`): live `vice_memory_write` of the
44-byte fixture at `$c000` against genuine stock VICE, `vice_snapshot_save`, then loading
the resulting `.vsf` into regenerator2000 and interrogating it three ways: the Import
Context Setup modal's displayed fields, live MCP queries (`r2000_get_binary_info`,
`r2000_get_disassembly_cursor`) while still running, and a `--headless --export_asm`
against the bootstrapped project file — cross-checked against an **independent,
byte-level parse of the `.vsf`'s own `C64MEM`/`MAINCPU` modules**, per Evidence
Integrity Rule 6 ("it did not crash" is never scored as a pass).

**Observed result — a real mid-task correction, not silently redone:** the first
snapshot, checked independently at the byte level, did **not** actually carry the
fixture bytes at `$c000` — it showed VICE's own uninitialised-RAM pattern, despite an
earlier same-invocation `vice_memory_read` confirming a correct read-back. Root cause:
`vice_memory_write`, `vice_memory_read`, and `vice_snapshot_save` had been issued across
**three separate MCP client connections**, and the write and the snapshot were never
proven to observe the same live machine state. Fixed by reissuing the entire
write-then-snapshot sequence within **one** connection; the corrected snapshot was then
byte-identical to the fixture, independently re-verified.

Against the corrected snapshot:

| Field | Snapshot-carried (independently parsed) | regenerator2000-derived | Verdict |
|---|---|---|---|
| machine type | raw `machine_name` = `"C64SC"` | displayed as `"Commodore 64"` — **correct value, wrong provenance**: `"C64SC"` matches none of `file_io.rs`'s literal `"C64"`/`"C128"`/`"VIC20"`/`"PET"`/`"PLUS4"` arms, so `suggested_system` is `None` and the Import Context modal's `unwrap_or(current_system)` falls through to the tool's own pre-existing default | **MISMATCH** on mechanism |
| start address (entry point / PC) | `$e5d4` (from the `.vsf`'s own `MAINCPU` module, and from a same-session live register read) | `$e5d4` (Import Context modal, live `r2000_get_disassembly_cursor`, export's `start` label) | **MATCH** |
| memory content at `$c000` | 44 fixture bytes, byte-identical | Same 44 bytes, byte-identical, at the correct address in the export | **MATCH** |

```
VSF_LOAD: partial
```

**Outcome:** `partial`. Two of the three things the criterion asks about are genuinely
carried and verified (memory content, start address); the third (machine type) happens
to display the right words but is traced, at the source level, to a coincidental default
that would be wrong for any non-C64 stock-VICE machine snapshot. `pass` is not available
under this plan's Evidence Integrity Rule 6; `fail` would understate the two fields that
genuinely work.

## Accepted limits

Per criterion 4's own wording, every failure and every `could-not-run` is recorded here
naming what it breaks. Two entries apply; a third criterion's qualification is noted for
completeness though it does not rise to an accepted limit.

1. **Criterion 3(2) [reassembly] — `use_illegal_opcodes` is not the keystroke-bootstrap
   default.** `REASSEMBLY: pass` was earned only under a direct-JSON-edit override to
   `true`; the fresh bootstrap criterion 2b produces leaves it `false`, and auto-analysis
   does not flip it. **What this breaks:** any Phase 10 pipeline that wants
   illegal-opcode-correct disassembly out of regenerator2000 (most directly `R2000-09`'s
   automated-bootstrap work, and the deletion decision in Phase 10 criterion 4/`R2000-06`
   that rests on `R2000-16`(2)) must explicitly set `settings.use_illegal_opcodes = true`
   in the generated `.regen2000proj` file before exporting or verifying — it is not a
   reason to withhold the `pass` on R2000-16(2) itself, which was answered directly
   against real illegal opcodes, but it is a required implementation step for whoever
   builds that pipeline.

2. **Criterion 3(4) [`.vsf` load] — machine-type auto-detection does not generalise
   beyond C64.** `file_io.rs`'s `suggested_system` match recognises only the four literal
   strings `"C64"`/`"C128"`/`"VIC20"`/`"PET"`/`"PLUS4"`; a genuine stock-VICE C64 snapshot
   writes `"C64SC"`, which matches none of them, so the displayed system is always a
   fallback default rather than a genuine read. **What this breaks:** the ROADMAP's
   standing "prefer `.vsf` over `.raw` for anything leaving the emulator" constraint is
   **unsupported as worded** for the machine-type field specifically (well-supported for
   RAM content and start address); Phase 10 criterion 3 must say so explicitly if it
   relies on `.vsf` machine-type auto-detection; and any future `.vsf`-based extension of
   the `c64-ram-capture` skill for a non-C64 machine must verify or explicitly set the
   system rather than trust regenerator2000's auto-detection, which would report "Commodore
   64" even for a C128/VIC20/PET/PLUS4 snapshot.

3. **Criterion 3(3) [`--export_lbl`] — qualification, not a limit.** The `pass` is scoped
   to a single fixture (2 symbols) and regenerator2000 0.9.20; Phase 11's `R2000-14`/
   `R2000-15` should treat it as "compatible for the format observed", not "compatible for
   all inputs, forever". No entry needed under the strict "names what it breaks" standard
   since nothing failed — recorded for completeness only.

**Criterion 1(5) [container cost] is explicitly not an accepted limit**, because it was
fully measured (`SINGLE_STAGE_BYTES`/`MULTI_STAGE_BYTES` both numeric) — see its own
section above. Per the plan's decision rule, this criterion never changes the verdict
regardless of its outcome; had it been `could-not-run`, that would have been recorded
here as an accepted limit on `R2000-03`'s install documentation ("the toolchain cost is
unmeasured and must be documented as unknown rather than estimated"), and nothing more.

## Other findings (carried forward, not scored against R2000-16)

These surfaced while answering the five criteria above and have no other home in this
phase's evidence set:

- **A real regenerator2000 defect:** `r2000_get_address_details` always reports
  `OutOfRange` for a full-64K load — a `u16` overflow at `handler.rs:1894`
  (`raw_data.len() as u16` wraps `65536` to `0`). Recorded in
  `evidence/criterion4-vsf-load.txt`. Not scored against any R2000-16 sub-part; worth
  filing upstream or working around in whichever later plan queries address details
  against a full-memory-image project.
- **A broker/MCP session-model gotcha, about this project's own broker, not
  regenerator2000:** splitting `vice_memory_write` and `vice_snapshot_save` across
  separate MCP client connections produced a `.vsf` that did **not** contain the written
  bytes, even though a same-connection read-back had looked correct moments earlier (see
  criterion 3(4) above). Any future skill that pokes state and then snapshots it —
  including a `.vsf`-based extension of `c64-ram-capture` — must issue every step within
  a single MCP connection.
- **A harness constraint, not a regenerator2000 property:** this agent harness's own Bash
  tool-permission classifier denies `cargo install` outright, confirmed twice (with and
  without `dangerouslyDisableSandbox=true`). Both third-party installs in this phase
  (`regenerator2000`, and the `rustup update stable` toolchain move) were performed by
  the human, not this agent. Relevant to Phase 10's automated-bootstrap question only as
  an environment note about *this* agent harness — it says nothing about whether
  regenerator2000 itself can be driven automatically once installed, which criterion 2
  answered separately and affirmatively.
- **Two agents independently discarded their own first live result rather than banking
  it:** plan 09-05 caught itself mid-task on the fork-vs-stock `x64sc` PATH shadowing
  (a first run against the wrong backend was discarded, not scored); plan 09-06 caught
  the cross-connection snapshot gap described above. Recorded here as a line of evidence
  that the live-validation discipline this phase depends on is actually working, not
  merely asserted.

## Corrections to prior documents

Every contradiction the transcripts found against `09-RESEARCH.md` or other prior
documents, applied in full to `09-RESEARCH.md` itself in this plan's Task 3. Listed here
for a reader who only wants this document:

1. **The rustc floor is `>= 1.90`, single source of truth — the earlier `>= 1.88`
   reading is superseded, and the reason is recorded, not silently replaced.** Plan
   09-01 derived `>= 1.88` from the crate's committed `Cargo.lock` pins (`ratatui
   0.30.0`, `image 0.25.10`, `vergen 9.1.0`, `icu_properties 2.2.0`) but did not attempt
   an actual compile against that floor. Plan 09-02 did: `rust:1.88-slim` resolves and
   satisfies those four pins, but fails a real `cargo install regenerator2000` outright
   — `quantette@0.6.0` requires rustc 1.90, `safe_arch@1.2.0` and `wide@1.6.1` require
   1.89. `rust:1.90-slim` builds cleanly. **`>= 1.90` is the verified floor; both the
   original edition-2024 framing (`>= 1.85`) and the Cargo.lock-pin-derived `>= 1.88`
   reading undercounted it.** This is genuine drift discovered by running the thing, not
   a research typo.
2. **License is `MIT OR Apache-2.0`, dual-licensed — `09-RESEARCH.md` already had this
   right (line 55); `.planning/notes/regenerator2000-integration.md:253` and
   `REQUIREMENTS.md`'s `R2000-03` phrasing still say Apache-2.0 only.** Not corrected in
   those two files by this plan (out of scope for `files_modified`); flagged here for
   Phase 10's `THIRD-PARTY-NOTICES.md` work to pick up.
3. **A new, previously-undocumented modal in the bootstrap sequence.**
   `09-RESEARCH.md`'s data-flow diagram showed `auto_analyze()` running unattended
   straight into MCP server start. In fact an "Import Context Setup" confirmation dialog
   holds focus first and must be dismissed (Enter or Escape) before Alt+S can reach the
   Save-As dialog. This is a genuinely new observed behavior, not a `file:line` drift —
   the diagram was a sequence sketch, not a source citation.
4. **Pitfall 3 undersold what `use_illegal_opcodes` controls — a strengthening, not a
   contradiction.** Its text said the setting only gates whether ACME's `--cpu 6510` flag
   is added. Plan 09-04's diff shows it also gates `--export_asm`'s live disassembly
   derivation itself — flipping the setting on a copy of an already-analyzed project and
   re-exporting correctly re-decodes six illegal opcodes the default export rendered as
   unrelated legal instructions plus raw `!byte` fallback. More favorable than the
   pitfall implied, not less.
5. **Assumption A3 (auto-analysis flips `use_illegal_opcodes`) is confirmed FALSE**, by
   both a TUI observation (09-03) and a direct JSON read of the bootstrapped project file
   (09-04). Open Question 3 is closed with a concrete negative answer.
6. **Assumption A1 (`M-s` registers as Alt+S) is confirmed TRUE, first attempt, no
   fallback encoding needed.** Open Questions 1 and 2 are both closed — see criterion 2b
   above.
7. **A new finding about `.vsf` machine-type detection, not previously documented
   anywhere in this phase or in `09-RESEARCH.md`:** `file_io.rs`'s `suggested_system`
   match recognises only four literal machine-name strings; genuine stock VICE writes
   `"C64SC"`, which matches none of them. See criterion 3(4) and Accepted limits above.
8. **A Debian-release mismatch across multi-stage build stages, not anticipated by
   `09-RESEARCH.md`'s Code Examples skeleton (which used unqualified `rust:1.85-slim` /
   `node:24-slim` with no release-pairing note):** `rust:1.90-slim` (Debian 13 trixie)
   and `node:22-slim` (Debian 12 bookworm) produce a binary that fails at runtime with
   `GLIBC_2.38`/`GLIBC_2.39 not found`. `rust:1.90-slim-bookworm` fixes it by matching
   glibc generations across stages. Recorded in `Dockerfile.multi` and
   `evidence/criterion1-container-toolchain-cost.txt`.
9. **`--verify-roundtrip` is not a real flag — the actual flag is bare `--verify`
   (which implies `--headless`).** Already corrected in plan 09-01's evidence; no further
   drift found in this plan's own work, which used the real spelling throughout.
10. **No `file:line` citation in `09-RESEARCH.md` was found to have changed the
    underlying constraint it described** — every specific-line citation this phase
    re-checked against the actually-running 0.9.20 source (not just the upstream git
    clone) matched. Where a citation could not be checked line-for-line (e.g. the
    diagram-shape correction in item 3 above), it is recorded as a new finding, not drift.

## Reproducing this

Every evidence file below is the literal, executed transcript this document was written
from — re-run any of them to re-verify, per criterion 4's "a later session can re-read
this without knowing which evidence file to open" (this document is that re-read; these
are the sources it was built from):

- `.planning/phases/09-the-assumption-probe-go-no-go/evidence/criterion0-prerequisites.txt`
  — host facts, fixture build transcript.
- `.planning/phases/09-the-assumption-probe-go-no-go/evidence/criterion1-install-and-version.txt`
  — `cargo install regenerator2000`, `--version`, `--help`, crates.io provenance.
- `.planning/phases/09-the-assumption-probe-go-no-go/evidence/criterion1-container-toolchain-cost.txt`
  — `docker build` (single-stage, multi-stage), image sizes; `Dockerfile.single`,
  `Dockerfile.multi` alongside it.
- `.planning/phases/09-the-assumption-probe-go-no-go/evidence/criterion2-pty-transcript.txt`
  (plus `criterion2-pane-initial.txt`, `criterion2-pane-after-alt-s.txt`,
  `criterion2-pane-after-enter.txt`) — the tmux keystroke bootstrap.
- `.planning/phases/09-the-assumption-probe-go-no-go/evidence/criterion3-reassembly.txt`
  — the illegal-opcode reassembly gate, both modes.
- `.planning/phases/09-the-assumption-probe-go-no-go/evidence/criterion3-export-lbl.txt`
  — the label export/grammar/live-load round trip.
- `.planning/phases/09-the-assumption-probe-go-no-go/evidence/criterion4-vsf-load.txt`
  (plus `criterion4-vsf-pane.txt`) — the `.vsf` produce/load/interrogate sequence,
  including the cross-connection correction.
- `.planning/phases/09-the-assumption-probe-go-no-go/evidence/mcp-harness.mjs`,
  `grammar-check.mjs`, `vice-tool-harness.mjs` — the throwaway harness scripts, kept as
  evidence apparatus, not deliverables.

To re-run: install `regenerator2000` at `>= 1.90` rustc (`cargo install
regenerator2000`), rebuild the fixture (`node .claude/skills/acme-build/scripts/acme.mjs
build .../fixture/probe-illegal.a`), then repeat each criterion's commands as quoted in
its section above, against a freshly-launched broker (`tools/vice-launcher.sh`) for the
criteria that need a live emulator.
