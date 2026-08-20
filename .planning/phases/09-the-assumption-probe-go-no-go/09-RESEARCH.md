# Phase 9: The Assumption Probe (Go/No-Go) - Research

**Researched:** 2026-08-19
**Domain:** Rust CLI/TUI interop (regenerator2000), pty automation, VICE label-file and
snapshot-file formats, container toolchain measurement
**Confidence:** MEDIUM-HIGH — every claim below is either source-verified at a recorded
commit/line, or an explicit source-verified correction to the grounding notes. The one
thing that genuinely cannot be verified without running it — whether `enable_raw_mode()`
and the keyboard-enhancement query survive a `script`/`tmux` pty with no controlling
terminal — is flagged LOW and is the phase's entire reason to exist.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R2000-16 | Five load-bearing assumptions checked against a real regenerator2000 build before any further plan is written, each answered in the repo with recorded evidence, any failure recorded as an accepted limit stating what it breaks: (1) pty tolerance for HTTP MCP mode, (2) `--export_asm --assembler acme` reassembly, (3) `--export_lbl` format match with `vice_symbols_load`, (4) `.vsf` load carrying machine type/start address, (5) container-side Rust toolchain build time and image-size cost. | This document's Code Examples give the exact command shape for each sub-assumption; Architecture Patterns' diagram sequences them; the Standard Stack/Package Legitimacy sections cover (5)'s install-cost prerequisite; the State of the Art section records the one correction to the assumed bootstrap mechanic that changes how (1) must actually be tested (keystroke-driven, not MCP-call-driven) |

</phase_requirements>

## Summary

This phase has no code to plan — it has a **sequence of five recorded experiments** and a
**verdict artifact**. The grounding notes
(`.planning/notes/regenerator2000-integration.md`) already did the analysis; this research
re-verified every cited claim against the actual upstream repository at its current `main`
(commit `df4bc94`, 2026-08-09, tag-equivalent to published crate `0.9.20`) and found the
ROADMAP's source citations for `main.rs:710` and `file_io.rs:125-127` to be **still
accurate — no drift**.

It also found one thing the grounding notes got **materially wrong**, and it is the single
most important correction in this document: **`r2000_save_project` cannot create the
first `.regen2000proj` file.** Its own handler refuses with `-32603 No active project
path` unless `app_state.project_path` is already `Some`, and the *only* code path that
ever sets `project_path` for a freshly-loaded raw binary is the TUI's own "Save As" dialog
(`Alt+S`, then a filename prompt, then Enter) — there is no MCP tool and no CLI flag that
performs this. The pty bootstrap the grounding notes described (`pty → auto-analyze →
r2000_save_project → project file exists`) is missing a step: **synthesized keystrokes
through the pty**, not just an MCP call over HTTP. This changes what "the pty question"
even means — it is not "does raw-mode survive a non-tty", it is "can this project drive
a TUI menu action through a pty with no human", which is exactly the shape of problem
`tmux send-keys` (or `expect`) solves and a bare `script -qec '...'` one-shot invocation
does not.

The other four assumptions are more favorable than the grounding notes assumed:
`generate_vice_labels()` in `parser/vice_lbl.rs` emits **exactly** `al C:{addr:04x}
.{name}\n` — lowercase 4-digit hex, literal `al`/`C:` casing — which is a byte-for-byte
match to `stock-symbols.ts`'s `VICE_LABEL_LINE_RE` regex. `parser/vice_vsf.rs` parses a
real "VICE Snapshot File" magic, a `C64MEM` module (CPU port bytes + 64K RAM) and a
`MAINCPU` module (PC at offset 12–13) — comments in that file show it was reverse-engineered
against a real captured `.vsf`, which is exactly what `vice_snapshot_save` produces via
VICE's own `DUMP` (0x41) monitor command.

**[CORRECTED 2026-08-20 by Phase 9 probe (plan 09-06;
`evidence/criterion4-vsf-load.txt`) — the `.vsf`/machine-type half of this claim is
`partial`, not unconditionally favorable:** memory content and start address (PC) are
genuinely carried and verified end-to-end against a real stock-VICE snapshot. Machine
type is not: `file_io.rs`'s `suggested_system` match recognises only the four literal
strings `"C64"`/`"C128"`/`"VIC20"`/`"PET"`/`"PLUS4"`, while a genuine stock VICE C64
snapshot's own `machine_name` is `"C64SC"`, which matches none of them — the displayed
"Commodore 64" is a coincidental fallback default (`dialog_import_context.rs:37`'s
`unwrap_or(current_system)`), not a genuine read of the snapshot. Not previously
documented anywhere in this phase; see `docs/phase9-regenerator2000-probe-findings.md`'s
Accepted limits for what it breaks.]

`--verify-roundtrip` shells out to a **real**
`acme` binary with `--cpu 6510 --format cbm`, compares assembled bytes to the original,
and is a much cheaper gate than building one. And `cargo install regenerator2000` is
**verified published** on crates.io (v0.9.20, 2026-07-11, license `MIT OR Apache-2.0` —
not solely Apache-2.0 as the grounding notes state; correct `THIRD-PARTY-NOTICES.md`
accordingly). **[Note, 2026-08-20: this document already had the dual license right —
`REQUIREMENTS.md`'s own `R2000-03` phrasing still says "Apache-2.0 notice" only. That
correction still needs applying to `REQUIREMENTS.md`/`THIRD-PARTY-NOTICES.md`, out of
scope for this file; flagged in
`docs/phase9-regenerator2000-probe-findings.md`'s Corrections section for Phase 10.]**

**Primary recommendation:** Run criterion 1 (install + version + container cost) and
criterion 2 (pty + **keystroke-driven** Save-As bootstrap, using `tmux` since it is not on
PATH but is one `apt-get install` away) first and in that order; criteria 3's three
downstream assumptions can run in parallel with each other once a `.regen2000proj` exists,
using real source-verified formats to check against rather than building new gates.
Record every outcome — pass, fail, or "could not run" — as evidence in `docs/`, and let the
decision rule in this document's Validation Architecture section pick the verdict rather
than a judgement call at run time.

## Architectural Responsibility Map

This phase builds no product, so there are no capabilities to assign to tiers in the
usual sense. The map instead identifies which **process** the evidence must be gathered
against, since getting this wrong invalidates the finding:

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| pty + TUI bootstrap probe | regenerator2000 process (host, under `tmux`/`script`) | — | The TUI, raw-mode terminal, and MCP HTTP server all live in one Rust process; there is no client/server split to reason about here |
| MCP HTTP handshake probe | Node harness script (throwaway, `.claude/mcp/vice/node_modules`) | regenerator2000 HTTP server (`127.0.0.1:3000/mcp`) | The harness is a genuine MCP **client**; the already-installed `@modelcontextprotocol/sdk`'s `StreamableHTTPClientTransport` is the correct tier to drive it from, not raw curl |
| Reassembly verification | regenerator2000's own `--verify-roundtrip` (in-process, shells to `acme`) | — | Do not build a second gate; the tool already owns this responsibility per D-R... (grounding notes) |
| Symbol format check | Static text comparison (no running process needed) | `stock-symbols.ts`'s regex (already in this repo) | Both sides' formats are now known from source; verification is comparing two known grammars, not running two live systems against each other |
| `.vsf` load check | VICE emulator (produces the `.vsf` via `vice_snapshot_save`) | regenerator2000 (`--headless --export_asm` or an MCP query against the loaded state) | The emulator produces evidence; regenerator2000 consumes and must be asked what it saw (via `--verify` output or an MCP `analysis_tools` query) to prove machine-type/start-address, not just "it didn't crash" |
| Container toolchain cost | Docker (host-invoked, ephemeral) | — | No devcontainer config exists in this repo yet; a throwaway Dockerfile is required, not a modification to a shipped one |

## Standard Stack

This phase installs one external prerequisite (the subject of the probe itself) and,
optionally, one system package to drive the pty. There is no application "stack" being
selected — this table exists to record exactly what was verified and how.

### Core

| Package | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `regenerator2000` | 0.9.20 (crates.io, published 2026-07-11) `[VERIFIED: crates.io registry]` | The subject of the entire probe | It is the milestone's proposed static-analysis backend; there is no alternative to research — R2000-16 exists to validate this exact tool |

### Supporting

| Package | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tmux` | Debian trixie repo version (not pinned by this research) `[ASSUMED]` | Drive keystrokes into the pty to trigger `Alt+S` → filename → Enter | Required because `script -qec '...' /dev/null` runs one fixed command with no way to inject input after launch at a controlled point; `tmux send-keys` can wait for a pane-content signal (e.g. "MCP Server active" in the status line) before sending keys |
| `expect` | not probed | Alternative to `tmux` if it is preferred/already available | Only if `tmux` install is blocked; not verified present on this host |
| `@modelcontextprotocol/sdk` `StreamableHTTPClientTransport` | 1.30.0, already vendored in `.claude/mcp/vice/node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js` `[VERIFIED: local node_modules, already npm-ci'd per SessionStart hook]` | Speak the actual MCP Streamable-HTTP handshake against `127.0.0.1:3000/mcp`, rather than hand-rolling JSON-RPC framing and session-ID header bookkeeping over curl | The probe's throwaway harness script |
| `docker` | 29.7.2 `[VERIFIED: docker --version, this host]` | Measure container-side Rust toolchain build time and image-size delta | Criterion 1(5) |
| ACME | `/home/henrik/.local/bin/acme` present `[VERIFIED: environment probe, pre-session]` | The real assembler `--verify-roundtrip` shells out to (`Command::new("acme")` with `--cpu 6510 --format cbm`) | Criterion 3(2) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `tmux send-keys` for the pty bootstrap | A hand-rolled Node `child_process` + raw pty write (no `node-pty` dependency exists in this repo) | `node-pty` is a native addon not currently a dependency anywhere in this codebase — adding it for a one-time probe is disproportionate. `tmux` is a single `apt-get install tmux`, matches the ROADMAP's own stated tool ("script/tmux"), and is scriptable non-interactively (`tmux new-session -d`, `tmux send-keys`, `tmux capture-pane`) |
| `script -qec` alone | `tmux` | `script` cannot inject input after the child starts (it only replays what you give it up front, or connects your real terminal to it) — it answers "does raw mode survive a pty" but not "can we drive the Save-As dialog", which is now known to be the actual requirement |
| Raw `curl` JSON-RPC against `/mcp` | `@modelcontextprotocol/sdk`'s `StreamableHTTPClientTransport` | `rmcp`'s `LocalSessionManager` expects proper MCP Streamable-HTTP session bookkeeping (an `Mcp-Session-Id` response header echoed on subsequent requests); the official SDK client handles this correctly, curl would have to reimplement it by hand and risks a false negative that is actually a protocol-handshake bug in the harness, not in regenerator2000 |

**Installation:**
```bash
# tmux (system package, not part of this repo's dependency graph)
sudo apt-get install -y tmux

# regenerator2000 itself — the plan's job, not this research's
cargo install regenerator2000
```

**Version verification:** `regenerator2000` was confirmed on crates.io directly (not
merely "training knowledge"):

```
curl -s -A "c64-re-tools-research (contact)" https://crates.io/api/v1/crates/regenerator2000
```

returned `newest_version: "0.9.20"`, `created_at: 2026-01-05`, `license: "MIT OR
Apache-2.0"`, `published_by.login: "ricardoquesada"` (matches the GitHub repo owner
exactly — not a typosquat), `edition: "2024"`, `rust_version: null` (no MSRV pinned in
`Cargo.toml`; edition 2024 itself requires Rust ≥ 1.85, which this host's `rustc 1.85.1`
satisfies exactly at the floor, not with headroom — worth noting as a real toolchain
constraint for whatever container image Phase 9(5) builds).

**[CORRECTED 2026-08-20 by Phase 9 probe (plans 09-01, 09-02;
`evidence/criterion1-install-and-version.txt`, `evidence/criterion1-container-toolchain-cost.txt`):
the binding constraint was never the edition-2024 floor of 1.85.** Plan 09-01 first
derived `rustc >= 1.88` from the crate's own committed `Cargo.lock` pins (`ratatui
0.30.0`, `image 0.25.10`, `vergen 9.1.0`, `icu_properties 2.2.0`), but a real `cargo
install regenerator2000` on `rustc 1.85.1` failed outright — no invocation, plain or
`--locked`, could build this crate on 1.85.1. Plan 09-02 then found `>= 1.88` itself
undercounted the floor: a real cold `docker build` against `rust:1.88-slim` (rustc
1.88.0) also failed to compile, with `quantette@0.6.0 requires rustc 1.90`,
`safe_arch@1.2.0 requires rustc 1.89`, `wide@1.6.1 requires rustc 1.89`. **The verified
floor is `rustc >= 1.90`, single source of truth — both the 1.85 and 1.88 readings above
are superseded, not merely refined.** The host's toolchain was moved mid-phase, by a
human-authorized `rustup update stable` (1.85.1 → 1.97.1), after which every remaining
criterion in this phase is qualified by 1.97.1, not 1.85.1.

**Important caveat for the plan:** the git clone used for *this research's* source
reading is at commit `df4bc94` (pushed 2026-08-09), which is *after* the crates.io
publish date of `0.9.20` (2026-07-11) even though `Cargo.toml` still says version
`0.9.20` at that commit. **`cargo install regenerator2000` may not fetch code
byte-identical to what this research read.** The plan should record the actual installed
`--version` output and, if it's material to a finding, diff against `df4bc94` rather than
assume equivalence. This is exactly why criterion 1 asks for the version to be "recorded",
not assumed.

## Package Legitimacy Audit

`slopcheck` could not be installed in this research session — `pip install` was blocked
by this session's own sandboxing (consistent with the phase's "install nothing" research
constraint, not a tool failure). In its place, the crate was checked directly against the
crates.io registry API (not merely `npm view`-equivalent existence — its publisher
identity, download counts, and linked source repo were all inspected):

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `regenerator2000` | crates.io | Created 2026-01-05 (~7 months); GitHub repo created 2025-12-20 | 869 total / 249 recent (small but real, matches "163 GitHub stars, young project" framing already in the grounding notes) | `https://github.com/ricardoquesada/regenerator2000` (matches `published_by.login: ricardoquesada` exactly) | Not run (see above) | **Approved, `[ASSUMED]`** — manually cross-checked publisher identity against the linked GitHub repo owner rather than trusting registry presence alone (per this document's package-name provenance rule) |
| `tmux` | Debian apt (trixie) | N/A — standard Debian package, not a language-ecosystem install | N/A | N/A | N/A | Approved — a well-known system package, out of scope for slopcheck's npm/PyPI/crates focus |

**Packages removed due to slopcheck `[SLOP]` verdict:** none (slopcheck did not run).
**Packages flagged as suspicious `[SUS]`:** none found by manual check, but the planner
must still gate the `cargo install regenerator2000` step behind a
`checkpoint:human-verify` task per the graceful-degradation rule, since slopcheck itself
never actually ran.

## Architecture Patterns

### System Architecture Diagram — the probe's data flow

```
                    ┌─────────────────────────────────────────┐
                    │  Host shell (tmux session, detached)     │
                    │                                          │
  cargo install ──▶ │  regenerator2000 --mcp-server game.prg   │
                    │  (NOT --headless — this is the           │
                    │   bootstrap-only invocation)              │
                    │                                          │
                    │  ① enable_raw_mode()  ◀── PTY QUESTION   │
                    │  ② EnterAlternateScreen + mouse capture   │
                    │  ③ spawn_input_thread() [crossterm read] │
                    │  ④ initial terminal.draw()                │
                    │  ⑤ auto_analyze() runs (file_io.rs:391)  │
                    │  ⑥ McpStartRequested → HTTP srv :3000/mcp│
                    └───────────────┬──────────────────────────┘
                                    │
                    tmux send-keys "Alt+S" ──▶ opens Save-As dialog
                    tmux send-keys "Enter"  ──▶ commits project_path,
                                                 calls save_project()
                                    │
                                    ▼
                         game.regen2000proj exists on disk
                                    │
                    ┌───────────────┴───────────────────────────┐
                    │  Node harness (StreamableHTTPClientTransport)│
                    │  POST http://127.0.0.1:3000/mcp              │
                    │  initialize → tools/call r2000_save_project  │
                    │  (now succeeds — project_path is Some)       │
                    └───────────────────────────────────────────┘
                                    │
                    regenerator2000 --headless --mcp-server-stdio \
                                    game.regen2000proj  ◀── unlocks
                                    │
              ┌─────────────────────┼─────────────────────────┐
              ▼                     ▼                         ▼

[CORRECTED 2026-08-20 by Phase 9 probe (plan 09-03; `evidence/criterion2-pty-transcript.txt`):
step ⑤ above (`auto_analyze()`) does not run straight into step ⑥ (MCP server start) as
this diagram implies. An unanticipated "Import Context Setup" confirmation modal is
presented first and holds focus — it must be dismissed (`Enter` on its Confirm button, or
`Escape`) before `Alt+S` can reach the Save-As dialog. Not fatal to 2a (the MCP server
started regardless, per the status bar), but it adds one keystroke to the exact sequence
2b needs. This is a genuinely new observed behavior the diagram's sequence sketch did not
anticipate, not a `file:line` drift against a specific citation.]
   --export_asm --assembler   --export_lbl out.lbl      (separately)
   acme out.a                       │                    vice_snapshot_save
   --verify-roundtrip                │                    writes game.vsf
              │                     ▼                         │
   real `acme` process       compare out.lbl's lines           ▼
   assembles out.a  ────▶    against stock-symbols.ts's   regenerator2000
   diff bytes vs raw_data    VICE_LABEL_LINE_RE (static,   game.vsf
   (in-process, no          no running process needed)     --headless
    external gate needed)                                  --export_asm
                                                             (proves machine
                                                              type + start
                                                              address carried
                                                              through)
```

### Recommended Evidence Layout

```
docs/
└── phase9-regenerator2000-probe-findings.md    # durable, re-readable evidence + verdict
                                                  # (normative, like phase0-binmon-findings.md)

.planning/phases/09-the-assumption-probe-go-no-go/
├── 09-RESEARCH.md          # this file
├── 09-PLAN-*.md            # the plan(s), TBD
└── evidence/               # throwaway transcripts, tmux capture-pane output,
                             # harness script, raw stdout/stderr — phase-local,
                             # NOT product code, referenced BY docs/phase9-*.md
    ├── criterion1-install-and-toolchain-cost.txt
    ├── criterion2-pty-transcript.txt
    ├── criterion3-reassembly.txt
    ├── criterion3-export-lbl.txt
    ├── criterion4-vsf-load.txt
    └── mcp-harness.mjs
```

### Pattern: static grammar comparison instead of a live round-trip (Assumption 3)

**What:** Compare two known, source-verified regular grammars rather than running two
live systems against each other and hoping the sample happens to exercise the disagreement.
**When to use:** When both producer and consumer formats are now known from source (this
phase), rather than treated as black boxes (the state the grounding notes were written in).
**Example — the two grammars, both confirmed at their respective current `main`:**

```
# Producer: ricardoquesada/regenerator2000@df4bc94
# crates/regenerator2000-core/src/parser/vice_lbl.rs:36-42 (generate_vice_labels)
al C:{addr:04x} .{name}\n            # e.g. "al C:1000 .start\n"

# Consumer: this repo's stock-symbols.ts:69 (VICE_LABEL_LINE_RE)
/^al\s+C:([0-9a-fA-F]{1,4})\s+\.(\S+)/
```

Both sides agree on: literal lowercase `al`, literal `C:` (uppercase C), a hex address
(producer always emits exactly 4 digits; consumer accepts 1–4, either case), a
mandatory `.` before the name, and the name is `\S+` on the consumer side (no embedded
whitespace tolerated). **The one thing this static comparison cannot settle:** whether
regenerator2000 only emits labels of `LabelKind::User` (confirmed at
`file_io.rs:732-748`'s `export_vice_labels`, which filters `if label.kind ==
LabelKind::User`) — i.e., **auto-analyzer-derived labels are never exported**, only
labels a session explicitly annotated. If the probe's test binary was never annotated
(only auto-analyzed), `--export_lbl` will produce a syntactically valid but **empty**
file, which would look like a pass on format but tells you nothing about the actual
round trip. The plan must annotate at least one label (via an MCP `modification_tools`
call, e.g. `r2000_set_label_name`, before exporting) or explicitly record "the file was
empty because no user label was set" as a separate, non-format-related finding.

### Anti-Patterns to Avoid

- **Building a custom reassembly gate instead of using `--verify-roundtrip`.** The
  grounding notes already say this; source reading confirms `--verify-roundtrip`
  already does exactly export → assemble (real `acme --cpu 6510 --format cbm`) → diff,
  byte-for-byte, against `state.raw_data`, and reports which of the four supported
  assemblers actually ran (skipping ones "not found in PATH" without failing the whole
  check). Do not re-implement this.
- **Testing the pty question with `script -qec` alone and calling it done.** `script`
  answers "does the terminal not crash" but not "can we complete the bootstrap
  without a human", because the bootstrap requires synthesized keystrokes, which
  `script` cannot inject after launch. Use `tmux`.
- **Treating a successful `r2000_save_project` MCP call in isolation as proof the pty
  question is answered.** It will always fail with `-32603` on a freshly-loaded raw
  binary, **by design**, regardless of pty behavior — that failure means nothing about
  raw-mode/pty tolerance; it's an unrelated precondition. Don't let a green herring here
  read as a probe failure or a probe pass.
- **Assuming the git-`main` line numbers this research cites are still current when the
  plan runs.** Per this project's own convention (CLAUDE.md), a mismatch is drift to
  re-verify, not evidence the underlying constraint changed. `cargo install` may in fact
  fetch different code than the git clone this research read (see the Standard Stack
  caveat above).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Export → assemble → diff reassembly gate | A Node script that shells to `acme` and diffs bytes | `regenerator2000 --verify --assembler acme` (`--verify` implies `--headless`) | Already does exactly this, in-process, against all four assemblers with graceful "not found in PATH" skip handling |
| MCP Streamable-HTTP handshake | Raw `curl` + hand-rolled `Mcp-Session-Id` header bookkeeping | `@modelcontextprotocol/sdk`'s `StreamableHTTPClientTransport`, already vendored in `.claude/mcp/vice/node_modules` | The transport's session semantics are non-trivial (rmcp's `LocalSessionManager`); the official client already implements them correctly |
| VICE label-file parsing/generation | A second parser for `al C:xxxx .name` | `stock-symbols.ts`'s existing `VICE_LABEL_LINE_RE` (consumer) and `parser/vice_lbl.rs`'s `generate_vice_labels`/`parse_vice_labels` (producer) — read both, don't write a third | Both already exist and are now confirmed compatible by source; a third implementation is a place for the comparison itself to be wrong |

**Key insight:** every one of this phase's five assumptions already has a real,
maintained implementation to check against on at least one side (this repo's
`stock-symbols.ts`, regenerator2000's own `--verify-roundtrip`, VICE's own `DUMP`
command). The phase's job is comparison and observation, never construction.

## Common Pitfalls

### Pitfall 1: Confusing "the MCP call failed" with "the pty question failed"

**What goes wrong:** Running `r2000_save_project` right after `--mcp-server game.prg`
starts, seeing `-32603 No active project path`, and recording criterion 2 as a hard
failure (→ reconsider).
**Why it happens:** The grounding notes' own bootstrap description implied a single MCP
call would suffice. Source reading (this document) shows it structurally cannot — no
code path sets `project_path` from a raw-binary load except the TUI's Save-As dialog.
**How to avoid:** Treat "does the pty tolerate raw-mode + the input thread + a real
draw" and "can we then drive Alt+S → filename → Enter through the pty" as two separate,
sequential checks. Only the *second* check failing (after the *first* succeeds) is
evidence toward "degrade — needs a documented manual step"; the first failing is what
would actually threaten "reconsider".

### Pitfall 2: Recording a passing `--export_lbl` that is silently empty

**What goes wrong:** `--export_lbl` on an auto-analyzed-only project (no user labels
set) produces a syntactically-valid, zero-line file. A naive "the file parses with our
regex" check reports success on an empty input, which is not evidence of anything.
**Why it happens:** `export_vice_labels` filters to `LabelKind::User` only
(`file_io.rs:732-748`, verified above); auto-analysis produces a different label kind.
**How to avoid:** Annotate at least one label via MCP before exporting (or via the TUI),
and record the exported file's actual line count in the evidence transcript, not just a
regex-match boolean.

### Pitfall 3: `verify-roundtrip`'s illegal-opcode path is a runtime setting, not a flag

**What goes wrong:** Assuming `--verify --assembler acme` automatically exercises illegal
opcodes because the milestone's whole framing is about `!cpu 6510` illegal-opcode
crack code.
**Why it happens:** `run_assembler`'s ACME branch only adds `--cpu 6510` `if
use_illegal_opcodes` — a field on `state.settings`, not something the CLI flags above
set directly. Whether analyzing a binary containing illegal opcodes flips this setting
automatically (via the analyzer) was **not verified in this session** — flagged as an
open question below.
**How to avoid:** After loading the probe's test binary, explicitly check (or set) the
`use_illegal_opcodes` setting before running `--verify`, and record which mode was
actually exercised. A pass under `use_illegal_opcodes=false` on a binary with no illegal
opcodes in it proves nothing about assumption 2 as the milestone actually needs it
proven.

**[CORRECTED 2026-08-20 by Phase 9 probe (plan 09-04; `evidence/criterion3-reassembly.txt`)
— a strengthening, not a contradiction:** this pitfall undersold what
`use_illegal_opcodes` actually controls. It is not only whether ACME's `--cpu 6510` flag
is added — flipping the setting on a copy of an already-analyzed project file and
re-exporting makes `--export_asm` **re-derive the disassembly live from the raw bytes and
the current setting**, correctly decoding illegal opcodes the default export had already
rendered as unrelated legal instructions plus raw `!byte $xx ; Invalid or partial
instruction` fallback. This is **more favorable** than the pitfall implied: the
capability is real and correct on this build, not merely "the right CLI flag gets
added" — it was simply never enabled by the keystroke-bootstrap default (confirmed:
`ILLEGAL_OPCODE_MODE: project-setting false`, and auto-analysis does not flip it — see
Open Question 3 / Assumption A3, now both closed).

### Pitfall 4: Measuring "container-side toolchain cost" with the wrong image boundary

**What goes wrong:** Reporting one number ("the devcontainer image is now N GB larger")
that conflates "the Rust toolchain needed to `cargo install`" with "the toolchain needed
to *run* the resulting binary".
**Why it happens:** A single-stage Dockerfile (`FROM rust:X` then `cargo install
regenerator2000`) keeps `rustc`/`cargo`/`~/.cargo/registry` baked into the final image
forever, when only the compiled binary is actually needed at runtime.
**How to avoid:** Measure **two** numbers explicitly, per the research questions: (a) a
single-stage build's final size (what you'd ship if you never multi-stage it), and (b) a
multi-stage build's final size (builder stage discarded, only the binary `COPY --from=`'d
into a slim runtime image — e.g. `node:24-slim`, since that already matches this
project's actual Node MCP server runtime requirement). These are genuinely different
numbers and the milestone's install-documentation criterion (Phase 10, `R2000-03`) needs
to know which one a real deployment would actually pay.

**[CORRECTED 2026-08-20 by Phase 9 probe (plan 09-02;
`evidence/criterion1-container-toolchain-cost.txt`) — both numbers measured, and one
further pitfall found that this pitfall did not anticipate:** `SINGLE_STAGE_BYTES:
1256576420` (~1.26 GB), `MULTI_STAGE_BYTES: 250820636` (~251 MB) — measured against
`rust:1.90-slim` (single-stage) / `rust:1.90-slim-bookworm` (multi-stage builder) and
`node:22-slim` (runtime), not the `1.85`/`24-slim` tags this document's Code Examples
sketched (see A4's correction above for why). **New finding, not anticipated by this
pitfall's own text:** a multi-stage build crossing Debian releases between its builder
and runtime stages (`rust:1.90-slim` is Debian 13 "trixie"; `node:22-slim` is Debian 12
"bookworm") ships a binary that fails at runtime with `GLIBC_2.38`/`GLIBC_2.39 not
found` — confirmed directly via `/etc/os-release` in both base images. Pinning the
builder to the runtime's Debian release (`rust:1.90-slim-bookworm`) fixes it. This repo
has no existing devcontainer image, so both numbers are absolute, with no baseline to
diff against — recorded explicitly rather than silently treated as deltas.

## Code Examples

### Exact command shape — criterion 1: install + version + registry check

```bash
# Verify publication before installing (already done in this research; reproduce in the plan)
curl -s -A "c64-re-tools-probe (contact-email)" https://crates.io/api/v1/crates/regenerator2000

cargo install regenerator2000
regenerator2000 --version    # record verbatim
```

### Exact command shape — criterion 1(5): container toolchain cost, both numbers

```dockerfile
# Single-stage (what "just cargo install it in the devcontainer" costs forever)
FROM rust:1.85-slim  # or whatever tag actually resolves at plan time -- verify with
                     # `docker manifest inspect rust:1.85-slim-<debian-codename>` first;
                     # this research did not resolve a working tag on this host
RUN cargo install regenerator2000
ENTRYPOINT ["regenerator2000"]
```

```dockerfile
# Multi-stage (what the shipped devcontainer image would actually need)
FROM rust:1.85-slim AS builder
RUN cargo install regenerator2000 --root /out

FROM node:24-slim
COPY --from=builder /out/bin/regenerator2000 /usr/local/bin/regenerator2000
```

```bash
# Time and size, both variants:
time docker build -f Dockerfile.single -t r2000-single .
time docker build -f Dockerfile.multi  -t r2000-multi  .
docker image inspect r2000-single --format '{{.Size}}'
docker image inspect r2000-multi  --format '{{.Size}}'
# Baseline for comparison -- this repo has no existing devcontainer image, so there is
# no "before" size to diff against; report absolute sizes, not a delta, and say so.
```

### Exact command shape — criterion 2: the pty + keystroke bootstrap

```bash
# tmux is not currently on PATH on this host -- install first.
sudo apt-get install -y tmux

tmux new-session -d -s r2000probe "regenerator2000 --mcp-server /path/to/game.prg"

# Wait for the TUI to actually render + the MCP server to report started, by polling
# the captured pane content rather than a fixed sleep:
until tmux capture-pane -t r2000probe -p | grep -q "MCP Server active"; do sleep 0.5; done
tmux capture-pane -t r2000probe -p > evidence/criterion2-pty-transcript-initial.txt

# Drive the Save-As bootstrap. Alt+S is the confirmed global hotkey
# (crates/regenerator2000-tui/src/events/input.rs:239, matches menu_model.rs:28's
# "Save As..." / "Alt+S" binding). The dialog's default filename was NOT observed in
# this research session -- record what it actually shows.
tmux send-keys -t r2000probe Escape  # ensure no other dialog/menu is focused first
tmux send-keys -t r2000probe M-s     # Alt+S in tmux's key notation
sleep 1
tmux capture-pane -t r2000probe -p > evidence/criterion2-pty-transcript-after-alt-s.txt
tmux send-keys -t r2000probe Enter   # accept the (observed) default filename
sleep 1
tmux capture-pane -t r2000probe -p > evidence/criterion2-pty-transcript-after-enter.txt

ls -la /path/to/game.regen2000proj   # the actual go/no-go observable
```

**If the initial pty-tolerance check itself fails** (raw mode refuses, or the process
exits before the "MCP Server active" status line ever appears), stop there — that is
criterion 2's sharper, more fundamental failure mode, and it should be recorded and
reported *before* attempting the keystroke sequence, per the decision rule below.

### Exact command shape — MCP HTTP handshake, using the already-vendored SDK

```javascript
// evidence/mcp-harness.mjs -- throwaway, not a deliverable (per phase notes:
// "if the probe wants throwaway scripts, they are evidence, not deliverables")
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const transport = new StreamableHTTPClientTransport(new URL("http://127.0.0.1:3000/mcp"));
const client = new Client({ name: "r2000-probe", version: "0.0.0" });
await client.connect(transport);

const tools = await client.listTools();
console.log(JSON.stringify(tools, null, 2));

const result = await client.callTool({ name: "r2000_save_project", arguments: {} });
console.log(JSON.stringify(result, null, 2));
```

Run with: `node --experimental-vm-modules evidence/mcp-harness.mjs` from inside
`.claude/mcp/vice/` (or with `NODE_PATH` pointed at its `node_modules`) so the already
`npm ci`'d SDK resolves without a fresh install.

### Exact command shape — criterion 3(2): reassembly, preferring the built-in gate

```bash
regenerator2000 --headless --mcp-server-stdio  game.regen2000proj  # NOT this -- wrong mode
regenerator2000 --headless --assembler acme --verify game.regen2000proj
# stdout: "  ✓ acme — byte-identical (N bytes)"  or  "  ✗ acme — N of M bytes differ"
```

### Exact command shape — criterion 3(3): `--export_lbl`

```bash
regenerator2000 --headless --export_lbl out.lbl game.regen2000proj
cat out.lbl    # expect lines shaped exactly: al C:1000 .somelabel
```

Compare `out.lbl` directly against `stock-symbols.ts`'s regex (no running VICE needed for
the format check itself):

```javascript
const VICE_LABEL_LINE_RE = /^al\s+C:([0-9a-fA-F]{1,4})\s+\.(\S+)/;
// run this against every line of out.lbl and record match/no-match counts
```

Then, separately, actually call `vice_symbols_load` with `out.lbl`'s path against a real
running instance (either backend — DERIV-04 already ships on the fork) to prove the
end-to-end consumption, not only the static grammar match.

### Exact command shape — criterion 3(4): `.vsf` round trip

```
# 1. In a running VICE instance (either backend), after loading/depacking a program:
vice_snapshot_save { name: "probe", description: "R2000-16(4) probe" }
#   -> writes a real VICE snapshot via the emulator's own DUMP (0x41) command

# 2. Hand the resulting .vsf to regenerator2000:
regenerator2000 --mcp-server /path/to/probe.vsf   # under tmux, same bootstrap as above
#   then, once a .regen2000proj exists:
regenerator2000 --headless --export_asm out.a probe.regen2000proj
#   inspect out.a's header comment / origin for the carried machine type and start
#   address, or query it via an MCP `analysis_tools` call against the live process
#   before headless-exporting, to avoid re-deriving from export text alone.
```

## State of the Art

| Old Approach (what the grounding notes assumed) | Current Approach (this research's finding) | When Changed | Impact |
|--------------------------------------------------|----------------------------------------------|---------------|--------|
| `r2000_save_project` alone bootstraps a fresh `.regen2000proj` | `r2000_save_project` requires a pre-existing `project_path`; only the TUI's `Alt+S` Save-As dialog sets it for the first time | Discovered this session, reading `session_tools.rs:185-193` and `dialog_save_as.rs:368` at `df4bc94` | Criterion 2's automation target is "drive one TUI keystroke sequence through a pty", not "make one MCP call" — directly changes what Phase 10's `R2000-09` automated bootstrap has to implement if the verdict is *proceed* |
| Grounding notes said Apache-2.0 | Confirmed dual `MIT OR Apache-2.0` (crates.io API + `LICENSE-MIT`/`LICENSE-APACHE` both present in the repo, `README.md:187`) | Discovered this session | `THIRD-PARTY-NOTICES.md` (Phase 10, `R2000-03`) should record both licenses, not only Apache-2.0 |

**Deprecated/outdated:** none identified — regenerator2000 is 8 months old and actively
maintained (last push 2026-08-09 per the grounding notes, confirmed by this session's
clone).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `tmux`, once installed via `apt-get`, can reliably send `Alt+S` as tmux key notation `M-s` to a crossterm-based TUI and have it register as the Alt+S keybinding | Code Examples / criterion 2 | If crossterm's key-event parsing under a `tmux` pty doesn't recognise `M-s` as Alt+S (terminal-dependent escape sequence quirks are a known crossterm pain point), the plan needs a fallback keystroke encoding (e.g. raw ESC + 's') — this is exactly the kind of thing the probe itself must observe, not assume |
| A2 | The Save-As dialog's default/pre-filled filename is `<stem>.regen2000proj` next to the loaded file | Code Examples / criterion 2 | Not verified in this session (the `initial_filename` construction site was not located before time ran out). If the default is empty or something else, the bootstrap sequence needs an extra "type the filename" step before Enter |
| A3 | Analyzing a binary containing illegal 6510 opcodes automatically flips `state.settings.use_illegal_opcodes` to true | Common Pitfalls / Pitfall 3 | If false, `--verify --assembler acme` would run without `--cpu 6510`, and ACME would likely reject or misassemble illegal-opcode lines the disassembly emitted, producing a false "assumption 2 failed" reading that is actually a settings-default problem, not a format-compatibility problem |
| A4 | `docker manifest inspect rust:1.85-slim-<debian-codename>` resolves to a real tag on the plan's execution host | Code Examples / criterion 1(5) | This research could not resolve a working `rust:*-slim-trixie` tag on this host in the time available; the plan must pick a real tag at execution time rather than trust the Dockerfile skeleton above verbatim |

**If this table is empty:** N/A — see above.

**Resolved by Phase 9 probe (2026-08-20):**

- **A1 [CORRECTED — confirmed TRUE, not merely assumed]:** `tmux send-keys -t r2000probe
  M-s` registered as Alt+S on the **first attempt**, no fallback keystroke encoding
  needed. Source: `evidence/criterion2-pty-transcript.txt` ("The Save-As dialog opened
  on the first attempt -- no retry with an alternative keystroke encoding was needed").
- **A2 [CORRECTED — confirmed TRUE]:** the Save-As dialog's default filename is exactly
  `<stem>.regen2000proj` (observed: `probe-illegal.regen2000proj` for a loaded
  `probe-illegal.prg`), pre-filled and accepted with a bare `Enter`, no typing needed.
  Source: `evidence/criterion2-pty-transcript.txt`
  (`SAVE_AS_DEFAULT_FILENAME: probe-illegal.regen2000proj`).
- **A3 [CORRECTED — confirmed FALSE]:** analyzing a binary containing illegal 6510
  opcodes does **not** automatically flip `state.settings.use_illegal_opcodes` to true.
  Confirmed two independent ways: the TUI rendered the fixture's illegal bytes as raw
  `!byte $xx ; Invalid or partial instruction` rather than as `lax`/`sax`/etc mnemonics
  (`evidence/criterion2-pty-transcript.txt`), and a direct JSON read of the bootstrapped
  `.regen2000proj` file showed `"use_illegal_opcodes": false`
  (`evidence/criterion3-reassembly.txt`). The setting is a fixed bootstrap default, not
  analyzer-derived — see Open Question 3 below, now closed the same way.
- **A4 [CORRECTED — the base image tag that actually resolved]:** not
  `rust:1.85-slim-<codename>` as this document's Code Examples sketched (unresolved at
  research time). `rust:1.90-slim` resolves and (after the rustc-floor correction above)
  is the tag that actually builds regenerator2000; the multi-stage builder additionally
  needed `rust:1.90-slim-bookworm` specifically, to match the `node:22-slim` runtime
  stage's Debian release and avoid a `GLIBC_2.38`/`GLIBC_2.39 not found` runtime failure.
  Source: `evidence/criterion1-container-toolchain-cost.txt`.

## Open Questions

1. **Does `save_project_impl`'s error path get hit even from `--headless --mcp-server`
   mode against a project file that IS already loaded (post-bootstrap), or only against
   a raw binary?**
   - What we know: `project_path` is definitely `None` after `load_file()` on a `.prg`
     (explicit `self.project_path = None` at `file_io.rs:22`), and definitely `Some`
     after loading a `.regen2000proj` (`load_project()` path, not traced line-by-line in
     this session).
   - What's unclear: whether every headless-MCP session against an existing project
     correctly has `project_path` populated on load, or whether there's a second edge
     case where it's cleared.
   - Recommendation: the probe's own transcript will show this directly the first time
     `r2000_save_project` is called post-bootstrap; no separate investigation needed.
   - **[CLOSED 2026-08-20 by Phase 9 probe]:** it is populated, and the error path is not
     hit again. A fresh `r2000_save_project` call over the still-live MCP connection,
     issued after the bootstrap completed, succeeded with `"Project saved to
     .../probe-illegal.regen2000proj"` and no `-32603`. Source:
     `evidence/criterion2-pty-transcript.txt` (`SAVE_PROJECT_POST_BOOTSTRAP: succeeded`).

2. **What does the Save-As dialog's default filename actually read, and does it need
   typing or just Enter?**
   - What we know: the dialog exists (`dialog_save_as.rs`), is reachable via a global
     `Alt+S` hotkey with no menu-opening prerequisite (`events/input.rs:239`).
   - What's unclear: the exact default text in the input field at open time.
   - Recommendation: the pty transcript (`tmux capture-pane`) after sending `Alt+S`
     answers this directly and cheaply — the plan does not need to trace
     `DialogType::SaveAs`'s construction site further; running it is cheaper than
     finishing that trace.
   - **[CLOSED 2026-08-20 by Phase 9 probe]:** the default filename is `<stem>.regen2000proj`
     (`probe-illegal.regen2000proj`), pre-filled correctly, and a bare `Enter` accepts it
     — no typing needed. Source: `evidence/criterion2-pty-transcript.txt`
     (`SAVE_AS_DEFAULT_FILENAME: probe-illegal.regen2000proj -- the field was pre-filled
     exactly as A2 ... predicted`). Same finding as A2 above.

3. **Is `use_illegal_opcodes` analyzer-derived or a fixed default?**
   - What we know: it's a field read at `run_assembler`'s ACME branch
     (`exporter/verify.rs:234-238`), not itself defined in the files this session read.
   - What's unclear: its default value and whether the analyzer flips it.
   - Recommendation: the plan should `--headless` load the test binary and either query
     the setting via an MCP tool, or simply always pass an explicit override if one
     exists (the CLI has `--assembler acme` but this session did not find a matching
     `--illegal-opcodes` flag — search `main.rs`'s full `Cli` struct at plan time if this
     matters).
   - **[CLOSED 2026-08-20 by Phase 9 probe]:** it is a **fixed bootstrap default, `false`**
     — the analyzer does not flip it. No `--illegal-opcodes` CLI flag exists on the real,
     verbatim `--help` surface either (confirmed against 0.9.20's actual output). The
     project file's own JSON settings store is a legitimate, tool-recognized way to
     override it (a direct edit of `use_illegal_opcodes: true` on a copy loads cleanly
     under `--headless`, per Evidence Integrity Rule 1). Source:
     `evidence/criterion3-reassembly.txt`
     (`ILLEGAL_OPCODE_MODE: project-setting false (bootstrapped default; ...)`). This is
     also a **strengthening of Pitfall 3** below, not merely an answer to this question:
     the setting gates `--export_asm`'s live disassembly derivation itself, not only
     whether ACME's `--cpu 6510` flag is added — see Pitfall 3's own correction.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `cargo`/`rustc` | Criterion 1 (install) | Yes `[VERIFIED]` | rustc 1.85.1, cargo 1.85.1 | — |
| `tmux` | Criterion 2 (keystroke bootstrap) | **No** `[VERIFIED: not on PATH]` | — | `apt-get install tmux` (single package, no known blocker); `expect` as a second fallback, unverified present |
| `script` | Criterion 2 (pty-tolerance-only check, if `tmux` install is blocked) | Yes `[VERIFIED]` | `/usr/bin/script` | Cannot drive the keystroke bootstrap on its own — see Common Pitfalls |
| `acme` | Criterion 3(2) | Yes `[VERIFIED]` | `/home/henrik/.local/bin/acme` | — |
| `docker` | Criterion 1(5) | Yes `[VERIFIED]` | 29.7.2 | — |
| `x64sc` (VICE, either backend) | Criterion 3(4) (`.vsf` producer) | Yes, fork build `[VERIFIED]` at `/usr/local/bin/x64sc`; genuine stock at `/usr/bin/x64sc` per prior session memory | — | Either backend works for `vice_snapshot_save` — it ships on the fork today and stock's `DUMP` opcode is standard binary-monitor surface |
| `@modelcontextprotocol/sdk` (Node) | MCP HTTP handshake harness | Yes `[VERIFIED: already npm-ci'd]` | 1.30.0 | Raw curl, with the session-header caveat above |
| A working `rust:*-slim` Docker tag | Criterion 1(5) container measurement | **Not resolved this session** | — | Resolve at plan/execution time with `docker manifest inspect` before committing a Dockerfile to the plan |

**Missing dependencies with no fallback:** none — `tmux`'s only fallback (`script`
alone) cannot fully substitute for it, but installing `tmux` itself is not expected to be
blocked (standard Debian package, no special repo needed).

**Missing dependencies with fallback:** `tmux` (fallback: `expect`, unverified;
`script`-only degrades the probe to answering less of criterion 2).

## Validation Architecture

This phase produces **no product code**, so "validation" here means something different
from the usual Nyquist framing: **how do we know the recorded evidence is real and
reproducible, not that a feature works.** The explicit lesson to carry forward is Phase
8.1's: *a check written by the same pass that made the claim proves less than it looks
like* — running the one unwitnessed claim there **falsified it**. Every criterion below
must be an actually-executed command with captured output, never an inference from
source reading (which is exactly what this research document itself is — a hypothesis
set to be tested, not a substitute for testing).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None — this phase has no `node --test` suite. Evidence is captured shell transcripts, not assertions |
| Config file | none |
| Quick run command | n/a — see per-criterion commands under Code Examples |
| Full suite command | n/a |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R2000-16(5) | Real build present, version recorded, container cost measured | manual-only (a one-time measurement, not a repeatable regression test) | `cargo install regenerator2000 && regenerator2000 --version`; `docker build` timing + `docker image inspect` | ❌ Wave 0 — throwaway Dockerfiles need writing |
| R2000-16(1) | pty tolerance + keystroke-driven bootstrap produces a `.regen2000proj` | manual-only, transcript-captured | `tmux` sequence under Code Examples | ❌ Wave 0 — `tmux` not installed |
| R2000-16(2) | `--export_asm --assembler acme` reassembles | manual-only, but uses regenerator2000's own automated gate | `regenerator2000 --headless --assembler acme --verify game.regen2000proj` | ❌ Wave 0 — needs a `.regen2000proj` from R2000-16(1) first |
| R2000-16(3) | `--export_lbl` format matches `vice_symbols_load` | manual-only + a static grammar diff (scriptable, near-zero cost) | `regenerator2000 --headless --export_lbl out.lbl game.regen2000proj` then run `VICE_LABEL_LINE_RE` against every line | ❌ Wave 0 |
| R2000-16(4) | `.vsf` loads carrying machine type + start address | manual-only, transcript-captured | See Code Examples, criterion 3(4) | ❌ Wave 0 — needs a live VICE session to produce the `.vsf` first |

**Justification for "manual-only" everywhere:** every one of these is a **one-time
go/no-go observation against a live external tool**, exactly the category this project's
own CLAUDE.md already carves out as deliberately not unit-tested (`vice-sync.ts`'s
checkpoint-wait functions — "their correctness only means anything against a real
emulator's timing"). The same reasoning applies here even more strongly: there is no
correct behavior to assert against in code, because the entire question is what a
third-party binary *actually does*, once, on this specific host.

### Sampling Rate

- **Per task commit:** N/A (no automated test to run per commit in this phase)
- **Per wave merge:** re-run the captured commands, don't just re-read old transcripts,
  if any wave touches a criterion already "answered" — a stale transcript is not
  evidence of a re-verified claim
- **Phase gate:** all five criteria have a recorded transcript in `docs/` before the
  verdict is written; the verdict document itself is the gate `/gsd-verify-work` checks

### Wave 0 Gaps

- [ ] `tmux` installed (or `expect` as a verified fallback)
- [ ] `regenerator2000` installed and `--version` recorded
- [ ] A real test `.prg` chosen or built (see Phase Requirements → Test Map; no fixture
      exists in-repo today — the closest candidate is `acme-build`'s own
      `template.a`, assembled via `node .claude/skills/acme-build/scripts/acme.mjs build
      template.a`; for the illegal-opcode-specific stress case, a small hand-written
      `.a` exercising a handful of the mnemonics `.claude/mcp/vice/disasm-opcodes.ts`
      already tables (e.g. `lax`, `sax`, `slo`) is a better fixture than `template.a`,
      which uses no illegal opcodes)
- [ ] A throwaway Node harness script for the MCP HTTP handshake (`evidence/mcp-harness.mjs`
      above)
- [ ] Two throwaway Dockerfiles for the single-stage/multi-stage size comparison
- [ ] `docs/phase9-regenerator2000-probe-findings.md` created (does not exist yet)

## Security Domain

`security_enforcement` is on (ASVS level 1, block on `high`) per
`.planning/config.json`. This phase's actual surface is small — a probe, not a feature —
but three real items apply:

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth surface introduced |
| V3 Session Management | No | The MCP HTTP session is local-loopback-only and single-user by construction (rmcp's `LocalSessionManager`) |
| V4 Access Control | No | N/A |
| V5 Input Validation | Yes | Nothing in this phase writes untrusted input into a shell string — every command shape above uses argv-array invocation (matching this repo's own `disasm-roundtrip.test.ts` convention: "never interpolate ... into a shell command string") |
| V6 Cryptography | No | N/A |

### Known Threat Patterns for this phase's stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Supply-chain risk on `cargo install regenerator2000` (arbitrary code execution via `build.rs` or a malicious crate version) | Tampering | Verified publisher identity matches the GitHub repo owner (crates.io `published_by.login: ricardoquesada`); `slopcheck` unavailable this session — planner must gate the actual install behind `checkpoint:human-verify` per the graceful-degradation rule |
| The MCP HTTP server binds `127.0.0.1:3000` with **no authentication at all** (confirmed: `RegeneratorOps`/`StreamableHttpService` carries no auth middleware in the source read this session) | Elevation of Privilege / Information Disclosure | D-R1/D-R4 already scope this correctly: it is loopback-only, inside a devcontainer's own network namespace, never exposed to a host network interface. The probe must run it on a machine/namespace where nothing else can reach `127.0.0.1:3000` — do not run the probe on a shared or multi-tenant host without checking for port collisions with anything else already bound there |
| `--vice` flag, if ever passed during the probe (even "just to see") | Denial of Service | **Standing hard constraint, repeated here deliberately:** never pass `--vice` to regenerator2000 in this probe, experimentally or otherwise — stock VICE's binary monitor serves exactly one client and a second `connect()` is indistinguishable from a wedge to this project's own broker/wedge-triage machinery |

## Sources

### Primary (HIGH confidence)

- `ricardoquesada/regenerator2000@df4bc94` (main, 2026-08-09) — cloned and read directly
  this session: `src/main.rs` (full CLI dispatch, `setup_terminal`, `spawn_input_thread`,
  `validate_headless_mode`, `run_verify`, `export_labels`), `crates/regenerator2000-core/
  src/mcp/http.rs` (HTTP MCP server, port/bind, rmcp `StreamableHttpService`),
  `crates/regenerator2000-core/src/mcp/handler.rs` (initialize/tools-list/tools-call
  dispatch, protocol version `2024-11-05`), `crates/regenerator2000-core/src/mcp/tools/
  session_tools.rs` (`r2000_save_project`'s precondition and error text),
  `crates/regenerator2000-core/src/state/file_io.rs` (`.prg`/`.vsf`/`.bin` load branches,
  `save_project`, `export_vice_labels`/`import_vice_labels`),
  `crates/regenerator2000-core/src/parser/vice_lbl.rs` (label-file grammar, both
  directions), `crates/regenerator2000-core/src/parser/vice_vsf.rs` (VSF magic, C64MEM/
  MAINCPU module parsing), `crates/regenerator2000-core/src/exporter/verify.rs`
  (`--verify-roundtrip`'s actual `acme`/`64tass`/`cl65`/`java` invocations),
  `crates/regenerator2000-tui/src/events/input.rs` (global `Alt+S` hotkey),
  `crates/regenerator2000-tui/src/ui/menu/menu_model.rs` and `menu_action.rs` (menu
  binding, dialog construction), `crates/regenerator2000-tui/src/ui/dialog_save_as.rs`
  (where `project_path` is first set), `README.md` (install, license), root `Cargo.toml`
  (edition, dependency versions), `LICENSE-MIT`/`LICENSE-APACHE` (both present).
- `https://crates.io/api/v1/crates/regenerator2000` — live registry API call this
  session, confirming publication, version, license string, publisher identity, download
  counts, edition, and `rust_version`.
- This repo, read directly this session: `.claude/mcp/vice/stock-symbols.ts` (VICE label
  file consumer, `VICE_LABEL_LINE_RE`, the "STATED ASSUMPTION, NOT A VERIFIED FACT"
  comment this phase exists to resolve), `.claude/mcp/vice/stock-machine.ts` (
  `vice_snapshot_save`'s real DUMP-command implementation), `.claude/mcp/vice/
  disasm-roundtrip.test.ts` (this repo's own argv-array-never-shell-string convention,
  and confirmation no committed `.prg` fixture exists), `.claude/skills/acme-build/
  SKILL.md` and `scripts/acme.mjs` (the `disasm`/`toacme` verb Phase 10 will delete,
  `!cpu 6510` convention), `.claude/skills/c64-ram-capture/SKILL.md` (confirms the
  *current* capture path is `vice_memory_read`-based `.raw`, not `.vsf` — a real gap the
  probe must bridge manually, not something the existing skill already does),
  `.planning/ROADMAP.md` (Phase 9 success criteria, standing constraints, known upstream
  limits — all cited line numbers cross-checked and found current), `.planning/notes/
  regenerator2000-integration.md` (grounding notes — built on, one correction made),
  `.planning/REQUIREMENTS.md` (`R2000-16`'s five sub-assumptions verbatim),
  `.planning/STATE.md` (deferred items, no conflicting decisions), `./CLAUDE.md`
  (`--vice` prohibition, GSD workflow enforcement), `.planning/config.json`
  (`nyquist_validation: true`, `security_enforcement: true`, `security_asvs_level: 1`,
  `graphify.enabled: false`).

### Secondary (MEDIUM confidence)

- None — every claim in this document traces to a primary source above, with the
  exception of the two items in the Assumptions Log, which are explicitly marked
  `[ASSUMED]` rather than presented as verified.

### Tertiary (LOW confidence)

- Whether `enable_raw_mode()` and the keyboard-enhancement escape-sequence query
  actually succeed/hang/timeout under a `tmux`-provided pty with no controlling
  terminal on this specific host — this is **the one thing this research could not
  determine by reading source**, and is precisely the reason Phase 9 exists as a
  run-it-and-see gate rather than a source-review gate.

**[CLOSED 2026-08-20 by Phase 9 probe (plan 09-03; `evidence/criterion2-pty-transcript.txt`):**
it succeeds. `enable_raw_mode()`, the crossterm input thread, the initial draw, and the
HTTP MCP listener all succeeded under a real `tmux` pty with no controlling terminal —
the process stayed alive 38+ seconds with a fully-drawn TUI and the literal status-bar
text `MCP Server active on http://127.0.0.1:3000/mcp`. `PTY_TOLERANCE: pass`. This item
is no longer LOW confidence or unresolved; it was this phase's entire reason to exist,
and it is now answered by direct observation, not inference.]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — crates.io API confirms publication, version, license, and
  publisher identity directly; no `slopcheck` run, flagged accordingly
- Architecture (the pty/bootstrap mechanic): HIGH on what the code *requires* (verified
  by reading the actual dispatch/dialog code), LOW on what actually *happens* under a
  pty (unrunnable within this research's constraints — that's the phase's job)
- Pitfalls: HIGH — all four are traced to specific source lines, not inferred
- Symbol-format and `.vsf`-format compatibility: HIGH on the grammar/parsing logic
  itself (both sides read directly), MEDIUM on end-to-end behavior since no live run was
  performed this session

**[CORRECTED 2026-08-20 by Phase 9 probe — the LOW/MEDIUM items above are now resolved
by observation, replacing inference:**
- Architecture (the pty/bootstrap mechanic): **now HIGH on both halves.** The LOW-rated
  question ("what actually happens under a pty") is answered directly: `PTY_TOLERANCE:
  pass`, `BOOTSTRAP_AUTOMATABLE: pass`, both against a real tmux pty with no controlling
  terminal (`evidence/criterion2-pty-transcript.txt`). This was the phase's single
  LOW-confidence tertiary source (below) — it is resolved, not merely re-flagged.
- Symbol-format compatibility (criterion 3(3)): **now HIGH end-to-end.** A real,
  unmodified `--export_lbl` export was accepted as-is by a live `vice_symbols_load`
  against genuine stock VICE (`evidence/criterion3-export-lbl.txt`,
  `EXPORT_LBL: pass`).
- `.vsf`-format compatibility (criterion 3(4)): **MEDIUM confirmed correct, not
  upgraded to HIGH.** Memory content and start address are HIGH-confidence (independently
  byte-verified twice, including after a real cross-connection correction); machine type
  is a confirmed coincidental default, not a genuine derivation — see the `.vsf`
  correction above and `docs/phase9-regenerator2000-probe-findings.md`'s criterion 3(4)
  section and Accepted limits.]**

**Research date:** 2026-08-19
**Valid until:** ~14 days for the upstream-source-derived claims (regenerator2000 is
young and active — last push 2026-08-09, prior push cadence suggests re-verification of
line numbers is cheap insurance if planning slips past early September); the crates.io
registry facts (version, license, publisher) are stable until the next upstream release.
