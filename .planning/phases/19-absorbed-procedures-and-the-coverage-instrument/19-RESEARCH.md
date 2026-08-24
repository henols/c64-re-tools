---
phase: 19
slug: absorbed-procedures-and-the-coverage-instrument
date: 2026-08-24
status: complete
supersedes: the 2026-08-24 first pass, which left both research-flagged questions open
upstream_pin: 493f840418f1450a342bb220c2fe3d2585dd0525
upstream_version: 0.9.20
---

# Phase 19: Absorbed Procedures and the Coverage Instrument — Research

**Researched:** 2026-08-24
**Domain:** third-party procedure absorption + licence attribution; annotation-store
coverage measurement; 6502 reachability analysis; skill-trigger disambiguation
**Confidence:** HIGH on every question this re-run was commissioned to close.

## Why this file was rewritten

The first pass shipped its two highest-risk questions as *Risks* instead of
findings. Both are now **closed with evidence**, and one of them **reverses** a
planning assumption:

| First pass said | This pass establishes |
|---|---|
| "The five upstream procedure paths and exact tool names must be fetched from the pinned source before copying." | Fetched. `upstream-procedure-manifest.json`'s five paths, five sha256 digests and all 41 tool references **verify byte-exact** against the pin. |
| "`detect_packer()` being internal means a new MCP tool may be required." | **No read-only route to packer identity exists anywhere on the 0.9.20 MCP *or* CLI surface** — not in `r2000_get_binary_info`, not in `r2000_unpack_binary`'s result, not in the saved project file. Every consumer of `packer_name` is TUI-only. A "new MCP tool" is not the answer either; see §2. |
| (silent) | **The deferred reader-writer question is not merely unmeasured — it is answerable and answered NO.** `--mcp-server-stdio` is a strictly serial loop. A reader-writer lock would buy exactly zero parallelism. Measured live, three runs. |
| (silent) | Two "no criterion" tool exclusions (`r2000_toggle_splitter`, `r2000_set_immediate_format`) **acquire a criterion** from this diff, and they are needed by Phase 20/21, not Phase 19. |
| (silent) | `scripts/check-npm-packages.mjs:235` pins `skillMds.length === 6`. Adding the routine-queue-walker **breaks CI** until it is changed. |

---

## User Constraints

No `19-CONTEXT.md` exists. Per the phase brief, the ROADMAP §19 `Notes:` block is
the binding decision record. Reproduced verbatim:

### Locked Decisions (ROADMAP §19 Notes)

- **Needs research at plan-time (research flag).** The packer-identification mechanism is only MEDIUM confidence — no dedicated read-only "identify packer" tool was confirmed in the live 28-tool surface; resolve with a live-source spike against 0.9.20's `packer_signatures.rs` before committing to an approach.
- **Needs research at plan-time (research flag).** The exact upstream commit/tag to pin for the five absorbed procedures, and whether their tool-call surface matches the curated list, must be diffed explicitly during absorption rather than assumed compatible.
- **2026-08-24 (inherited from Phase 18 / plan 18-06):** The concurrency model is a coarse mutex at the `r2000-session.ts` seam: exactly one logical operation per session is in flight at a time, and contention is answered by a bounded FIFO wait rather than a refuse-while-busy error. Phase 19 must not copy upstream's 7-way concurrent-subagent orchestration unchanged; read-only fan-out is the sanctioned orchestration pattern, while the seam quietly queues whatever reaches it.
- **2026-08-24 (deferred, not rejected):** A reader-writer upgrade remains deferred pending measurement of whether regenerator2000's stdio handler actually multiplexes concurrent requests rather than reading stdin serially. Before considering any concurrent-read / exclusive-write lock, Phase 19 must run and record that measurement as evidence, the same way Phase 18 recorded the stdin-EOF measurement; see `18-06-SUMMARY.md` for the observed outcome of the lock-bypassed lost-update proof that motivated the current answer.
- Coverage-instrument design constraint: walk the raw byte range and instruction stream independently of what regenerator2000's own block-type table already claims — a derived-from-bytes census, not a report generated from the store's own bookkeeping. Widen it specifically to cover what `follow_indirect_jumps` does not walk (multi-entry indexed dispatch tables) — Phase 21's hazard report needs this same widened scan.
- Do not copy upstream's 7-way concurrent-subagent orchestration unchanged (decided in Phase 18, criterion 4) — absorb the procedures' sequencing, not their concurrency model.
- Validate the coverage instrument against a real, previously-unseen fixture before trusting it, not only against the fixture the same pass wrote it against.

### Already-landed ground truth (do not re-derive)

Committed in `58d8c14` `test(19-01): pin upstream procedure audit`:

- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json`
- `src/mcp/vice/r2000-upstream-audit.test.ts`
- Upstream pin `ricardoquesada/regenerator2000@493f840` (= release 0.9.20, 2026-07-11).

**Verdict on the manifest: it holds. No contradiction found.** See §1.

### Claude's Discretion

Everything not fixed above: the shape of the packer bridge, the coverage
instrument's algorithm and file layout, the description-collision metric and its
threshold, the attribution-header wording, and the measurement driver's form.

### Deferred Ideas (OUT OF SCOPE)

- **FUT-01** BASIC token decoding as a *capability* (see the ABS-01/FUT-01 tension in §1.6 — the *text* is still absorbed).
- **FUT-02** concurrent multi-project sessions (upstream hardcodes HTTP port 3000, `main.rs:397`).
- **FUT-03** write-capable concurrent subagent fan-out as upstream authors it.
- Upstream contributions (`KEYBOARD_MATRIX_SET`, `--mcp-port`/`--mcp-bind`) — PRs against a repo this project does not own.
- HTTP MCP transport for the session; routing the session through `vice-broker.mts`; any copyrighted game image.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ABS-01 | Five upstream analyze procedures absorbed at a pinned commit, tool calls diffed against the curated surface, no runtime dependency on `.agent/skills/` | §1.1 (pin verified two ways), §1.2 (41 tool refs enumerated), §1.3 (three-way disposition table), §1.4 (the `.agent/skills/` runtime reads found — 3 sites), §1.5 (the gate **already exists**: `check-skill-tool-coverage.mjs`) |
| ABS-02 | Per-file attribution + `THIRD-PARTY-NOTICES.md` records the dual `MIT OR Apache-2.0` for absorbed text specifically | §5 (the existing notices file contains a claim that absorption makes **false**; exact copyright line and licence string verified) |
| ABS-03 | No two skills contend for the same trigger, checked pairwise across the whole inventory | §4 (measured baseline: project ceiling 0.250; upstream's own worst sibling pair 0.261 — *above* it), precedent to reuse |
| ABS-04 | Snapshot-vs-drift is a dated decision with a named re-sync trigger | §1.7 (the drift surface is real and enumerable; two concrete triggers named) |
| COV-01 | Three distinct numbers, never one aggregate | §3.2 / §3.3 / §3.4 — data source, algorithm and report shape per number |
| COV-02 | Vacuous pass detectable; multi-caller labels need cross-reference-backed documentation | §3.5 (five negative controls, incl. the false-positive control), §3.6 (the multi-caller rule, mechanically) |
| SURF-03 | Packer identity surfaced as a recon finding | §2 (no route exists — proven four ways; the smallest read-only bridge specified, with the boundary held) |

---

## Summary

Three of the six research questions resolved into **higher-confidence, more
prescriptive answers than the phase brief anticipated**, and one resolved into a
*reversal*.

**Question 1 (upstream procedures) is fully closed and the existing manifest is
vindicated.** The upstream repo is present at the pin on this machine
(`/tmp/regenerator2000-phase19`, `git log` head `493f840 v0.9.20`). All five
`.agent/skills/r2000-analyze-*/SKILL.md` files hash byte-identically to the
manifest's `sha256` values, and a `grep -oE '\br2000_[a-z0-9_]+'` over each file
reproduces the manifest's per-procedure tool sets exactly — 41 references, 5
non-curated names, and every one of the manifest's three dispositions lands on
the right name. The pin is corroborated *independently of the git tag*: the
installed crate's own `.cargo_vcs_info.json` records `sha1:
493f840418f1450a342bb220c2fe3d2585dd0525`, so crates.io 0.9.20 was published
from exactly this commit. What the manifest does *not* yet carry, and what the
plan needs, is the **justification** per disposition — §1.3 supplies it, and two
of the five turn out to be Phase 20/21 surface requirements rather than
Phase 19 omissions.

**Question 2 (packer identity) is closed negatively, and the honest answer is
not a new MCP tool.** `AppState::file_info()` computes `packer_name` at load
time via `detect_packer()`, but every single consumer of that field is in the
TUI crate. `r2000_get_binary_info` emits exactly seven fields and none is
packer-related (verified in source *and* by a live call through
`vice-proxy.ts`). `UnpackResult` has no name field. `LoadedProjectData.detected_packer`
is an in-memory struct the TUI reads; `load_project()` sets it to `None` and it is
never serialised. `regenerator2000 --help` at 0.9.20 offers no flag for it.
Therefore SURF-03 cannot be satisfied by *reading* upstream. Since copying
`packer_signatures.rs` is out of bounds and a project-invented `r2000_*` name
would be a fake upstream tool that this repo's own CI forbids, the smallest
boundary-respecting bridge is a **project-owned recon finding with a pluggable
external oracle and a hard `unknown` default** (§2.4) — plus the observation that
a two-line upstream change would make it trivial, which is exactly what ABS-04's
re-sync trigger should watch for.

**Question 6 (the deferred measurement) does not need deferring any further.**
`--mcp-server-stdio` dispatches to `run_headless_stdio_loop()`, a blocking
`read_line` loop that calls `handle_request(&request, &mut app_state, ...)`
*synchronously* in the loop body. Rust's borrow rules make concurrent handling
of `&mut AppState` impossible by construction. Measured live three times: a
trivial `r2000_get_binary_info` sitting in the child's stdin pipe since t≈410ms
received no reply until 2ms after a 6–14 second batch ahead of it finished.
**D18-16's reader-writer upgrade is not merely deferred — it is pointless for a
single session, and the coarse FIFO mutex is an exact model of the child's own
behaviour.** Phase 19 should close D18-16 rather than re-defer it.

**Primary recommendation:** Do not build new checkers where this repo already has
them. ABS-01's tool-diff gate is `scripts/check-skill-tool-coverage.mjs` (it
already fails on any non-curated `r2000_*` token anywhere under `src/skills/`);
COV-01's third number is the Phase 11 sealed-answer-key mechanism
(`r2000-answer-key.test.ts`); COV-01's first number is this repo's own
`decode()` in `disasm-decoder.ts`, which is the "independent instruction stream"
the ROADMAP note demands and is already import-free of transport code. Build
exactly three genuinely new things: the description-collision checker, the
coverage report itself, and the packer finding.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Absorbed procedure text (playbooks) | Skills layer (`src/skills/*/SKILL.md`) | — | Descriptions *are* the trigger mechanism; prose belongs where Claude Code matches it. Ships in the installer tarball (`installer/skills/`, synced). |
| Attribution headers | Skills layer (per file) | Repo docs (`THIRD-PARTY-NOTICES.md`) | The header travels inside the published tarball; the notices file is the repo-level statement. Both needed — the installer package currently ships **no** notices file at all (§5.3). |
| Trigger-uniqueness check | Build/CI layer (`scripts/check-*.mjs` + `scripts/lib/*.mjs`) | Test layer (planted-violation proof in `src/mcp/vice/*.test.ts`) | Exact precedent: `check-skill-fork-honesty.mjs` / `skill-honesty-checks.mjs` / `skill-honesty-checks.test.ts`. |
| Derived-from-bytes census | MCP-server layer (`src/mcp/vice/`), reusing `disasm-decoder.ts` | On-disk project reader (`r2000-project.ts`) | The census must not depend on the session at all; reading `raw_data_base64` off disk means zero FIFO contention and total independence from r2000's analysis. |
| Auto-vs-User ratio | MCP-server layer, via curated `r2000_get_symbols` | — | The label store is only reachable through the curated surface; the FIFO mutex serialises it. |
| Sampled reproducibility | Planning-evidence layer (`.planning/phases/19-.../evidence/`) + test guard | MCP-server layer for the re-derivation | Mirrors Phase 11 D-26's sealed key: the answer lives in evidence, the guard lives in `src/mcp/vice/`. |
| Packer finding | Skills layer script (`src/skills/c64-program-recon/scripts/`) | External oracle process (`unp64`, optional) | It is a *finding*, not an emulator capability. A new `r2000_*` tool would be a fabricated upstream name (§2.5). |
| Concurrency | `r2000-session.ts` seam (unchanged) | — | Measured: the child is serial. Nothing to change. |

---

## Project Constraints (from CLAUDE.md)

Extracted directives that bear on this phase. Treat with the same authority as
locked decisions.

| Directive | Bearing on Phase 19 |
|---|---|
| **Derived tools must be intercepted before `forwardToVice()`, not behind `call()`.** The `r2000_*` family is registered through `buildViceTool()` and never reaches `forwardToVice()` — "satisfied by construction for that family, not by an interception." | If a packer route were added as an `r2000_*` tool it inherits this by construction. But §2.5 recommends *not* adding a tool. If one is added anyway it must be `vice_*`-family and must be interception-checked. |
| **Tech stack: Node ≥ 22.18 native type-stripping; the shipped server has no build step.** Host-bound `.mts` must be compiled by `build.ts` into committed `resources/*.mjs`; `resources-sync.test.ts` fails CI on drift. | The coverage instrument and packer script must be plain `.ts`/`.mjs` runnable directly. **No Rust toolchain, no compiled helper, no linking `regenerator2000-core` as a library** — that alone disqualifies "call `detect_packer` through FFI". |
| **Any host-facing path or hostname must go through `hostpath.ts`/`containerpath.ts`/`container-guard.mts`; tested closed consumer set.** | `r2000-cli.ts`'s header states the opposite for r2000: *"Import nothing from `hostpath.ts` or `containerpath.ts`. Every path this CLI handles is already container-side"*, asserted structurally by `hostpath-consumers.test.ts` (D-08). New coverage/packer code on the r2000 side must **not** import either. |
| **The broker's single-owner `inFlight` guard must stay a synchronous check-and-set with no `await` between.** | Untouched by this phase; the r2000 FIFO mutex is a separate seam (`r2000-session.ts`). Do not conflate them — REQUIREMENTS "Out of Scope" already forbids routing the session through the broker. |
| **`vice-sync.ts`'s checkpoint-wait functions are deliberately not unit-tested.** | If the packer finding ever runs a depack in VICE (`c64-ram-capture` route), preserve "exactly one resume per wait; poll on `hit_count`, never on paused state". |
| **Testing: `test:automated` skips `MANUAL_ONLY_TESTS`** (project memory, corroborated by `test-gate.mjs`). | Phase-gate evidence must be the full `npm test`, not `test:automated`. |
| GSD workflow enforcement: no direct repo edits outside a GSD workflow. | This research writes only `19-RESEARCH.md`. |

---

## 1. The five upstream procedures — verified, enumerated, disposed

### 1.1 The pin, corroborated two independent ways [VERIFIED]

| Fact | Evidence |
|---|---|
| Upstream repo present at pin on this machine | `/tmp/regenerator2000-phase19`, `git log --oneline -3` → `493f840 v0.9.20` [VERIFIED: local clone, this session] |
| Full SHA and date | `git log -1 --format='%H %ci %an' 493f840` → `493f840418f1450a342bb220c2fe3d2585dd0525 2026-07-11 07:06:45 -0700 Ricardo Quesada` [VERIFIED] |
| Tag | `git tag --points-at 493f840` → `v0.9.20` [VERIFIED] |
| **The installed crate was published from exactly this commit** | `~/.cargo/registry/src/index.crates.io-*/regenerator2000-0.9.20/.cargo_vcs_info.json` → `{"git":{"sha1":"493f840418f1450a342bb220c2fe3d2585dd0525"},"path_in_vcs":""}` [VERIFIED: installed crate, this session] |
| Installed binary version | `regenerator2000 --help` runs; `18-STDIN-EOF-EVIDENCE.md` records `regenerator2000 0.9.20` [VERIFIED] |

The `.cargo_vcs_info.json` corroboration matters: it means the pin is not merely
"a tag someone typed" but the commit the *binary this project actually drives*
was built from. Recommend the plan quote it — it is a stronger provenance claim
than the tag.

**`.agent/skills/` is excluded from the published crate — verbatim proof.**
`Cargo.toml.orig` lines 31-42 of the installed crate:

```toml
exclude = [
    "docs/**/*",
    "tests/**/*",
    "examples/**/*",
    ".agent/**/*",
    ".github/**/*",
    "mkdocs.yml",
    ".readthedocs.yaml",
    ".pre-commit-config.yaml",
    "AGENTS.md",
    "CLAUDE.md"
]
```

[VERIFIED: `~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/regenerator2000-0.9.20/Cargo.toml.orig:31-42`, read this session]

And `ls -a` of that crate directory contains no `.agent` entry; `find` for
`.agent` or `*analyze-blocks*` across all three installed 0.9.20 crates returns
nothing. [VERIFIED] So ABS-01's premise is exactly right, and the *only* route to
the procedure text is the GitHub repo at the pin — which is precisely what makes
ABS-04's snapshot-vs-drift trade real.

Same file, line 28: `license = "MIT OR Apache-2.0"` [VERIFIED — verbatim]. The
repo at pin ships `LICENSE-MIT` and `LICENSE-APACHE`; `LICENSE-MIT:3` reads
verbatim `Copyright (c) 2026 Ricardo Quesada` [VERIFIED].

### 1.2 The manifest verifies byte-exact [VERIFIED]

Computed this session with `sha256sum` against the clone at the pin:

| Path (at `493f840`) | sha256 | Bytes | Manifest match |
|---|---|---|---|
| `.agent/skills/r2000-analyze-basic/SKILL.md` | `8fc662ce52a1c947e0b57b92a8efb8e2f387a4cdad117de2b5300f50d44c23a2` | 4457 | ✅ |
| `.agent/skills/r2000-analyze-blocks/SKILL.md` | `3fad6193466a20fa0d2f56a7e38a740fa7218b920aa36e348bc65273c987aa1b` | 14674 | ✅ |
| `.agent/skills/r2000-analyze-program/SKILL.md` | `2d1c91bcc612c00ce71b7def08917b59ca7e495aa61f9075cbb0795e935f6955` | 15308 | ✅ |
| `.agent/skills/r2000-analyze-routine/SKILL.md` | `6fd26337de42b2d8f7da570ec7c5aa47072818f4cede675d8189930cadbe2730` | 9248 | ✅ |
| `.agent/skills/r2000-analyze-symbol/SKILL.md` | `d57d9c2fdfa1c3e2f8a6384a881378ad1e3e371114c3b0b8d15ec1c71b3b4da8` | 9705 | ✅ |

**Total absorbed corpus: 53,392 bytes across five files.**

Tool references, extracted with the *same regex this repo's CI uses*
(`/\br2000_[a-z0-9_]+/g`, `scripts/check-skill-tool-coverage.mjs:88`):

| Procedure | Tools referenced (verbatim, sorted) | Non-curated |
|---|---|---|
| basic | `r2000_batch_execute`, `r2000_read_region`, `r2000_save_project`, `r2000_set_comment`, `r2000_set_data_type` | — none |
| blocks | `r2000_batch_execute`, `r2000_disassemble`, `r2000_get_binary_info`, `r2000_get_blocks`, `r2000_get_cross_references`, `r2000_read_region`, `r2000_save_project`, `r2000_set_comment`, `r2000_set_data_type`, `r2000_set_label_name`, `r2000_toggle_splitter`, `r2000_undo` | `toggle_splitter`, `undo` |
| program | `r2000_get_binary_info`, `r2000_get_comments`, `r2000_get_symbols`, `r2000_save_project`, `r2000_set_immediate_format`, `r2000_unpack_binary` | `set_immediate_format`, `unpack_binary` |
| routine | `r2000_apply_enum_usage`, `r2000_create_project_enum`, `r2000_get_binary_info`, `r2000_get_cross_references`, `r2000_get_disassembly_cursor`, `r2000_read_region`, `r2000_set_comment`, `r2000_set_immediate_format`, `r2000_set_label_name` | `get_disassembly_cursor`, `set_immediate_format` |
| symbol | `r2000_apply_enum_usage`, `r2000_create_project_enum`, `r2000_get_address_details`, `r2000_get_binary_info`, `r2000_get_cross_references`, `r2000_get_disassembly_cursor`, `r2000_set_comment`, `r2000_set_immediate_format`, `r2000_set_label_name` | `get_disassembly_cursor`, `set_immediate_format` |

[VERIFIED: `grep -oE '\br2000_[a-z0-9_]+' <each file> | sort -u`, this session]

Every one of these sets is **identical** to the corresponding `tools` object in
`upstream-procedure-manifest.json`. **The manifest is correct. Nothing to
contradict.**

Curated surface, cross-checked three ways [VERIFIED]:
- `grep -oE '"r2000_[a-z0-9_]+"' src/mcp/vice/r2000-tools.ts | sort -u` → **19** names.
- Upstream handler `grep -oE '"name": "r2000_[a-z0-9_]+"' crates/regenerator2000-core/src/mcp/handler.rs` → **28** names.
- **Live**: `tools/list` through `node src/mcp/vice/vice-proxy.ts` → 80 tools total, **19** with the `r2000_` prefix, matching the static list exactly.

The nine upstream tools the project does **not** expose:
`r2000_get_disassembly_cursor`, `r2000_jump_to_address`, `r2000_read_selected`,
`r2000_redo`, `r2000_search_memory`, `r2000_set_immediate_format`,
`r2000_toggle_splitter`, `r2000_undo`, `r2000_unpack_binary`. Five of them are
touched by the absorbed procedures; four are not touched at all.

### 1.3 Disposition table, with the justification the manifest lacks

The three dispositions ABS-01 demands, resolved per call, each with evidence:

| Upstream call | Sites | Disposition | Justification |
|---|---|---|---|
| `r2000_get_disassembly_cursor` | routine:20, symbol:12 | **Project-owned adaptation** — the caller always supplies an explicit address | Upstream's *own* text forbids the cursor route in exactly the situation this project uses: *"**CRITICAL**: Always launch each subagent with an explicit target address … **NEVER** use the 'current cursor address' or rely on the active cursor location in the editor, as the cursor will change dynamically when running parallel subagents"* (`r2000-analyze-program/SKILL.md:74` and `:128`) [VERIFIED — verbatim]. This project also has no TUI, and `r2000_read_region` (SURF-01, D18-24/D18-25) answers "read this routine" by range. `r2000-tools.ts`'s header records the trio as **HELD, not unproven** (D18-26) and says *"a real caller appearing in Phase 19's absorption diff is what would justify adding one, additively"* — the diff produced a caller **whose own upstream text says not to use it**. Recommend: keep HELD, record this as the reason, do not add the tool. |
| `r2000_undo` | blocks:85 ("if a conversion was wrong, use `r2000_undo` to revert") | **Project-owned adaptation** — re-set the correct type | `r2000_set_data_type` is idempotent over a range, so "undo then redo correctly" collapses to "set correctly". `r2000-tools.ts` records undo/redo as earning no place *under this surface's own discipline* even now that a session persists. Cheap, no surface change. |
| `r2000_toggle_splitter` | blocks:86, :158, :223 | **Separately-justified future-surface proposal — and it is Phase 20/21's blocker, not Phase 19's** | Not cosmetic. Upstream Pitfall 5 verbatim: *"**Forgetting splitters**: Two adjacent byte tables will auto-merge into one. Use `r2000_toggle_splitter` at the boundary."* And line 158: *"When two split halves are in adjacent memory, use `r2000_toggle_splitter` at the boundary between the lo …"* [VERIFIED]. `r2000_get_blocks`'s own description says *"Respects splitters."* [VERIFIED: `handler.rs:188`]. Without it, DECOMP-01's "every byte is code, byte, word, address, PETSCII, screencode **or table**" cannot distinguish two adjacent tables, and BUILD-02's "data tables extracted to their own files" has no boundary to cut on. **This also biases COV-01's structural census** (§3.2). Recommend: propose it explicitly, with SURF-01's additive pattern, sequenced so Phase 20 has it. |
| `r2000_set_immediate_format` | program:84, :140; routine:66, :67, :103; symbol:57, :58, :113 (8 sites) | **Separately-justified future-surface proposal — Phase 21's blocker** | It is the low/high-byte pointer-readability step: `"format": "low_byte"` / `"high_byte"` plus `"target_address"` turns a split immediate load into a *symbol reference*. That is literally **BUILD-03** ("every branch, `JSR`/`JMP` and data reference goes through a symbol, so code can move"). `r2000-tools.ts` currently records "no criterion in this phase" — BUILD-03 is the criterion. Upstream impl is mutating (`set_immediate_format_impl` applies a Command, calls `perform_analysis()` and `disassemble()`, pushes a Batch — `handler.rs:1645-1695`), so it must go through the FIFO mutex if added. Recommend: propose, do not build in Phase 19. |
| `r2000_unpack_binary` | program:31-36 (Phase 0 entropy gate) | **Explicit omission** — destructive, and this project has its own depack route | Upstream's own words: *"`r2000_unpack_binary` is a destructive action (clears existing comments/labels/blocks) and may take up to 10 seconds or more"* [VERIFIED: `r2000-analyze-program/SKILL.md:31`]. Confirmed in source: the handler calls `app_state.load_unpacked_binary(...)`, replacing the binary in place (`handler.rs:844-852`). This project's route is `c64-ram-capture` (run-and-capture) plus the SURF-03 packer finding. The **entropy gate itself survives** — `entropy` is in `r2000_get_binary_info`'s live response and the 7.5 threshold is written into the curated tool description (`r2000-tools.ts:441`). |

Note the shape of the finding: **the absorption diff, run properly, is a
requirements discovery instrument, not a compliance checkbox.** Two exclusions
that were honestly recorded as "no criterion" in Phase 11/18 acquire criteria
from Phase 20 and Phase 21 requirements. The plan should record that as a dated
decision, not silently add tools.

### 1.4 The `.agent/skills/` runtime dependency — three concrete sites [VERIFIED]

`r2000-analyze-program/SKILL.md` instructs the agent to **read files at
`.agent/skills/...` paths at runtime** — exactly what ABS-01 forbids:

- `:42` — "Read the skill file at `.agent/skills/r2000-analyze-blocks/SKILL.md`."
- `:78` — subagent prompt: "Read the skill file at `.agent/skills/r2000-analyze-routine/SKILL.md` and follow its workflow."
- `:134` — subagent prompt: "Read the skill file at `.agent/skills/r2000-analyze-symbol/SKILL.md` and follow its workflow."

Plus one soft cross-reference in `r2000-analyze-blocks/SKILL.md:94` ("using conventions from the **r2000-analyze-routine**…").

[VERIFIED: `grep -nE '\.agent/skills|subagent|Task tool' <files>`, this session]

Since the crate excludes `.agent/**/*` (§1.1), these paths do not exist for any
`cargo install` user — the procedure is *broken as published*, which is
independent justification for absorbing rather than referencing. **Every one of
these three must be rewritten to the project-owned skill name/path.** A
mechanical guard is cheap: assert zero occurrences of the literal `.agent/skills`
anywhere under `src/skills/` and `installer/skills/`.

### 1.5 The ABS-01 tool-diff gate ALREADY EXISTS — do not build a second one [VERIFIED]

`scripts/check-skill-tool-coverage.mjs` already:

- walks the whole `src/skills/` tree (`walkSkills`, `scripts/lib/skill-corpus.mjs`);
- extracts every `r2000_*` token with `/\br2000_[a-z0-9_]+/g` after stripping the MCP prefix (`:88`, `:101-102`);
- imports `CURATED_R2000_TOOLS` from `src/mcp/vice/r2000-tools.ts` (`:50`);
- **fails** if any extracted name is not curated (`:400-406`), with a three-route resolution message;
- **also** fails if an extracted `r2000_*` name appears in either `tools-manifest.json` (`:413-421`) — the family is proxy-local by design;
- carries a non-vacuity floor: `extractedR2000.size >= 10` (`:446`).

Live run this session: `check-skill-tool-coverage: OK -- 37 distinct vice_* names
… r2000_*: 10 distinct names extracted, all curated (CURATED_R2000_TOOLS has 19
entries). r2000 CLI verbs: 7 parsed from r2000-cli.ts, 7/7 resolved` — exit 0.
[VERIFIED: executed this session]

**Two load-bearing consequences the plan must design around:**

1. **The absorbed text cannot even *mention* a non-curated `r2000_*` name — not
   in prose, not in a table, not inside a "we deliberately omit this" note.** The
   check is a plain token grep with no comment/context awareness. Escape hatches,
   in preference order: (a) name it without the prefix — "upstream's
   `toggle_splitter`"; (b) record the omission in `.planning/` (not scanned;
   `SKILLS_DIR` is `src/skills` only, `:55`); (c) add it to the curated surface.
   **Do not add an exemption list to this checker** — it currently has no
   `r2000_*` allowlist at all, and introducing one is how the gate rots.
2. **The `r2000_*` extraction floor is `>= 10`, a floor not an equality** (`:446`) —
   safe to grow. Likewise `topLevelDirs.length >= 6` (`:380`) and
   `R2000_CLI_VERB_FLOOR = 7` (`scripts/lib/r2000-cli-verbs.mjs:40`, used as
   `>=` at `:467`). Adding skills and verbs is safe *here*.

### 1.6 The ABS-01 ↔ FUT-01 tension — flag it, do not paper over it

ABS-01 says "**the five** upstream analyze procedures are absorbed."
REQUIREMENTS "Future Requirements → Deferred" says **FUT-01**: "BASIC token
decoding (upstream's `r2000-analyze-basic`) — commercial C64 games captured
post-loader almost universally reduce to a one-line `SYS` stub." The manifest
routes `basic` → `src/skills/c64-program-recon`.

These are reconcilable but only if stated deliberately. Recommended resolution
for the planner to lock:

> Absorb all five as **attributed text** (satisfying ABS-01's count and ABS-02's
> attribution). Mark `r2000-analyze-basic`'s content as **reference material,
> capability deferred per FUT-01** — its trigger phrases must not enter any
> skill's `description:` frontmatter, so it can never fire (ABS-03) and never
> claims a capability the milestone deferred.

This is cheap: all five of `basic`'s tool references are curated, so it passes
§1.5's gate untouched.

### 1.7 ABS-04 — the drift surface is enumerable; two triggers named

The snapshot-vs-drift trade is real and its surface is now measurable rather than
rhetorical:

- The absorbed corpus is **53,392 bytes across five paths** at one commit (§1.2). A future upstream edit is invisible to this repo unless something re-fetches.
- The text is only obtainable from GitHub (crate excludes it, §1.1), so there is **no version-pinned package** to diff against automatically.
- The manifest already carries `sha256` per file — so re-sync is a *hash comparison*, not a read-and-judge. That is the cheap part, and it should be stated as the mechanism.

Two concrete re-sync triggers to name in the dated decision:

1. **Any bump of the installed `regenerator2000` past `0.9.20`.** At that point re-fetch the five paths at the new commit (obtainable from the new crate's own `.cargo_vcs_info.json` — no guessing) and diff the five sha256 values. Existing text: `upstream-procedure-manifest.json`'s `resync_trigger` already says "Review the upstream procedure diff before upgrading regenerator2000 from 0.9.20." Keep it, and make it checkable.
2. **Any change to `r2000_get_binary_info`'s field set.** This is the SURF-03 trigger (§2.6): `AppState::file_info()` already computes `packer_name`, so the day upstream adds it to the handler's `json!` block, the packer bridge becomes a one-line read and the fallback oracle becomes unnecessary. Watching a *specific tool's response shape* is a much sharper trigger than "watch for a new release".

A mechanical assertion is available and cheap: `r2000-upstream-audit.test.ts`
can additionally assert that the installed binary's `--version` still reports
`0.9.20` **or** that the manifest's `commit` has been updated — a live-gated
check in the `r2000-test-gate.ts` (D-11) style, skipping cleanly when
regenerator2000 is absent (as it is in CI, by design).

---

## 2. SURF-03 — packer identity: no read-only route exists

### 2.1 The internal API [VERIFIED — verbatim]

`crates/regenerator2000-core/src/packer_signatures.rs`:

```rust
/// Information about a detected packer.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PackerInfo {          // :3
    pub name: &'static str,
    pub dep_addr: Option<u16>,
    pub start_addr: Option<u16>,
    pub end_addr: Option<u16>,
    pub entry_point: Option<u16>,
    pub end_addr_ptr: Option<u16>,
}

/// Scans memory for known packer signatures and returns info if found.
#[must_use]
pub fn detect_packer(mem: &[u8], load_addr: u16, load_end: u16) -> Option<PackerInfo> {  // :14
```

[VERIFIED: `crates/regenerator2000-core/src/packer_signatures.rs:1-14` at pin, read this session]

`FileInfo` in `crates/regenerator2000-core/src/state/app_state.rs:27-42`, verbatim:

```rust
    /// Calculated Shannon entropy (0.0 to 8.0).
    pub entropy: f32,
    /// Whether the file is detected as packed.
    pub is_packed: bool,
    /// Name of the detected packer, if any.
    pub packer_name: Option<&'static str>,
```

`AppState::file_info()` calls `detect_packer(...)` at `app_state.rs:310-314` and
sets `(is_packed, packer_name, entry_point)` at `:316-338`.

### 2.2 Four independent proofs that nothing surfaces it

**(a) `r2000_get_binary_info` emits exactly seven fields, none packer-related.**
Source, `handler.rs:814-820`, verbatim:

```rust
                        "origin": origin,
                        "size": size,
                        "system": system,
                        "filename": filename,
                        "description": app_state.settings.description,
                        "may_contain_undocumented_opcodes": app_state.settings.use_illegal_opcodes,
                        "entropy": app_state.entropy()
```

Live confirmation through this project's own proxy, this session — a real
`tools/call` against a committed fixture project:

```
{"result":{"content":[{"type":"text","text":"{\n  \"description\": \"\",\n
  \"entropy\": 5.0042572021484375,\n  \"filename\": \"recon-subject.regen2000proj\",\n
  \"may_contain_undocumented_opcodes\": true,\n  \"origin\": 2064,\n
  \"size\": 100,\n  \"system\": \"Commodore 64\"\n}"}],"isError":false},"jsonrpc":"2.0","id":3}
```

[VERIFIED: live `node src/mcp/vice/vice-proxy.ts` stdio call, this session. The
`json!` block is static, so a packed input cannot change the field set.]

**(b) `UnpackResult` has no packer-name field.** `unpacker.rs:57-69`, verbatim
field list: `data`, `start_addr`, `end_addr`, `entry_point`, `dep_addr`,
`instructions_executed`. `detect_packer()` is called at `unpacker.rs:1042` and
`packer_info` is used only to apply an `"ALZ64/Kabuto"` memory patch
(`:1044-1050`) and as a progress-callback argument (`:1364`); the MCP handler
passes `None` for that callback (`handler.rs:844`). The success message text
(`handler.rs:888-897`) reports start/end/entry/dep/instructions — **no name**.
[VERIFIED]

**(c) It is not persisted.** `detected_packer: Option<String>` exists only on
`LoadedProjectData` (`state/project.rs:114`), an in-memory return value. It is
populated in three load paths (`state/file_io.rs:159`, `:228`, `:574`) and set to
`None` in `load_project()` (`:403`). It does not appear in `ProjectState` (the
serialised shape written by `save_project()`, `file_io.rs:582+`). So
`r2000_save_project` followed by reading the `.regen2000proj` yields nothing.
[VERIFIED]

**(d) Every consumer is TUI-only.** `grep -rn "packer_name|is_packed|file_info()"`
across the whole workspace at pin returns, outside `app_state.rs` itself and the
three `file_io.rs` sites: `regenerator2000-tui/src/ui/menu/menu_action.rs:201`,
`ui_state.rs:302`, `ui/dialog_unpack.rs:208-209`,
`ui/dialog_import_context.rs:22-78,519,535`, `ui/dialog_file_info.rs:52,99`.
**Zero non-TUI, non-internal consumers.** [VERIFIED]

**(e) The CLI has no flag for it.** `regenerator2000 --help` run live this
session lists 13 options: `--import_lbl`, `--export_lbl`, `--export_asm`,
`--export_html`, `--assembler`, `--headless`, `--verify`, `--mcp-server`,
`--mcp-server-stdio`, `--vice`, `--dump-system-config-files`,
`--dump-theme-files`, `--dump-enum-files`, plus `-h`/`-V`. None reports file
info. `grep -n "packer|file_info|is_packed" src/main.rs` → no matches.
[VERIFIED: live `--help` + source at pin]

**Conclusion (HIGH):** packer identity is computed on every load and thrown away
before reaching any machine-readable surface. SURF-03 cannot be satisfied by
reading upstream at 0.9.20.

### 2.3 Options considered and rejected, each with its reason

| Option | Rejected because |
|---|---|
| Copy `packer_signatures.rs` (or transcribe its signature bytes into `r2000_search_memory`/`r2000_search_disassembly` patterns) | **Out of bounds by the phase brief.** Transcribing the byte signatures into search patterns is the same copy wearing a hat — and `r2000_search_memory` is not even curated. |
| Link `regenerator2000-core` as a library / FFI / build a tiny Rust helper | Violates CLAUDE.md's **no-build-step** rule and would add a Rust toolchain to the runtime requirements. `regenerator2000-core` ships exactly one bin target, `src/bin/unpacker_compare_all.rs`, and it is **not installed** (`ls ~/.cargo/bin` → only `regenerator2000`). [VERIFIED] |
| Upstream PR adding `packer_name`/`is_packed` to `r2000_get_binary_info` | Correct engineering (`file_info()` already computes both; it is a two-line change at `handler.rs:814-820`) but REQUIREMENTS "Out of Scope" excludes upstream contributions, and a PR cannot be this milestone's delivery route. **Keep it as ABS-04's re-sync trigger** (§1.7 trigger 2). |
| `r2000_unpack_binary` on a throwaway copy | Destructive (clears comments/labels/blocks), not curated, and yields `dep_addr`/`entry_point`/range but **still no name**. Mapping `dep_addr` → packer name would be a weaker re-implementation of the signature table. |
| Infer the name from entropy or `dep_addr` | This is exactly "guessing", which SURF-03's own framing and this project's culture forbid. Must be structurally impossible in the design, not merely discouraged. |

### 2.4 Recommended design — the smallest read-only bridge

A **project-owned recon finding** with a three-valued verdict and an ordered,
named oracle chain. Every step read-only; the name can only ever come from an
oracle that reports one.

**Oracle chain (evaluated in order, first hit wins for the name):**

1. **`unp64`, if present.** An independent, external packer identifier (not
   upstream r2000 code, so no boundary crossing). Upstream itself uses it as its
   own comparison oracle: `crates/regenerator2000-core/src/bin/unpacker_compare_all.rs:6-8`
   reads `UNP64` then `UNP64_PATH` from the environment [VERIFIED — the same env
   convention this project should adopt]. Invoked read-only: input file
   unmodified, output to a scratch temp path, identification parsed from stdout.
   **Not installed on this machine** (`command -v unp64` → nothing; not in
   `/usr/local/bin` alongside the VICE tools) [VERIFIED], so it must be gated,
   never assumed.
2. **Entropy gate — packedness only, never a name.** `r2000_get_binary_info`'s
   `entropy` against the 7.5 threshold already written into the curated tool
   description (`r2000-tools.ts:441-442`).
3. **Explicit `unknown`.**

**Response shape (project-owned, stable):**

```json
{
  "packer": null,
  "verdict": "identified" | "packed-unidentified" | "unpacked" | "unknown",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "route": "unp64" | "entropy-only" | "none",
  "evidence": [
    { "source": "unp64", "version": "<--version output>", "raw": "<stdout line>" },
    { "source": "r2000_get_binary_info", "entropy": 7.83, "threshold": 7.5 }
  ],
  "checkedAt": "2026-08-24T00:00:00.000Z",
  "unavailableReason": "no packer-identity route on the pinned regenerator2000 0.9.20 MCP or CLI surface; unp64 oracle absent"
}
```

**The four rules that make it non-guessing** (belong in the module header's
"WHAT NOT TO DO" block, this repo's own convention):

1. `packer` is non-`null` **only** when an oracle reported a name verbatim. No code path may write it from entropy, `dep_addr`, or a byte pattern.
2. `confidence: "HIGH"` **only** for `route: "unp64"`. Entropy-only ⇒ `MEDIUM` and `verdict` ∈ {`packed-unidentified`, `unpacked`}. `route: "none"` ⇒ `LOW` + `verdict: "unknown"`.
3. `verdict: "unknown"` must carry a non-empty `unavailableReason`. A silent `null` with no reason is the failure mode.
4. Never emit a percentage or a "probably Exomizer" style hedge. The vocabulary is the four verdicts and nothing else.

**Live-gating**, mirroring `r2000-test-gate.ts`'s D-11 pattern exactly: probe
`unp64 --version` (or `$UNP64`/`$UNP64_PATH`), treat ENOENT as *not available →
expected SKIP*, and hard-**FAIL** when an opt-in env var (`VICE_REQUIRE_UNP64`,
by the `VICE_REQUIRE_R2000` precedent) is set. Never let absence read as a pass.

### 2.5 Where it lives — a skill script, NOT a new `r2000_*` tool

Do **not** add `r2000_detect_packer` (or similar) to `CURATED_R2000_TOOLS`. Two
mechanical reasons, both already enforced in this repo:

- `check-skill-tool-coverage.mjs:400-421` requires every skill-mentioned `r2000_*` name to be curated **and absent from both manifests**. A project-invented name would pass those checks while being a **fabricated upstream tool name** — the `r2000_` prefix means "regenerator2000 serves this", and no such tool exists upstream. That is precisely the class of dishonest surface `check-skill-fork-honesty.mjs` exists to prevent elsewhere.
- Adding an MCP tool moves the tool-count pin, `docs/tool-support.md` and the manifest wiring for zero gain — SURF-01's own lesson.

**Recommended home:** a script under `src/skills/c64-program-recon/scripts/`
(the `derive.mjs` precedent, already CI-covered by
`ci-suite-coverage.test.ts`'s `src/skills/*/scripts/*.test.mjs` glob) plus a
documented step in that skill's playbook, reported as a recon finding.
If a *tool* is later judged necessary, it must be `vice_*`-family and must
satisfy CLAUDE.md's interception rule.

### 2.6 What would raise this to a positive result

`confidence: HIGH` on the *negative* claim is already established. The open
positive is "can we ever report a name?" Two experiments:

- **E1 (cheap, decisive for the oracle):** install `unp64`, build a genuinely Exomizer-packed synthetic fixture, and confirm the oracle route reports a name and the finding's `confidence` flips to `HIGH`. Until E1 runs, the `route: "unp64"` branch is `[ASSUMED]` in its output *format* (the env-var convention is verified; the stdout parse shape is not).
- **E2 (watch, don't do):** re-run `r2000_get_binary_info` after any upgrade past 0.9.20 and diff the field set (§1.7 trigger 2).

---

## 3. The coverage instrument — three numbers, and what makes each non-gameable

### 3.1 What is and is not available to read [VERIFIED]

| Data | Route | Notes |
|---|---|---|
| Raw bytes | `.regen2000proj`'s `raw_data_base64` (gzip+base64) read **off disk**, or curated `r2000_read_region` | `synthesizeProject()` (`r2000-project.ts:135-152`) writes exactly this field, so an on-disk reader is symmetric with an existing, tested writer. **Prefer on disk for the census**: zero session contention, total independence from r2000's analysis. |
| Independent instruction stream | **`decode(bytes, startAddress, opts)`** — `src/mcp/vice/disasm-decoder.ts:148` | This repo's own 6502/6510 decoder. Import-free of `stock-*.ts`/`vice*.ts`/`node:` builtins by design (D-05); bounded by construction, never throws, returns `[]` on malformed input. Yields per instruction: `address`, `bytes`, `opcode`, `mnemonic`, `mode`, `illegal`, `acmeExpressible`, `operand: {role, value, width}`, `resolvedTarget`, `notes`. **This is the "independent of r2000's block-type table" source the ROADMAP note demands, and it already exists.** |
| r2000's own classification | `r2000_get_blocks` → `[{start_address, end_address, type}]` | `type` is `BlockType`'s `Display` string (`types.rs:333+`): `Code`, `Byte`, `Word`, `Address`, `PETSCII Text`, `Screencode Text`, `Lo/Hi Address`, `Hi/Lo Address`, `Lo/Hi Word`, … Description says "Respects splitters." **Use only for the divergence sub-report, never as the census.** |
| Labels + kind | `r2000_get_symbols` → `[{address, name, kind, type}]` (`handler.rs:1747-1752`) | `kind` is `Debug`-formatted `LabelKind`. Verbatim (`types.rs:353-358`): `User`, `Auto`, `System` (with `#[serde(alias = "Platform")]`). `type` is `Debug`-formatted `LabelType`, verbatim (`types.rs:361-378`): `ZeroPageField`, `Field`, `ZeroPageAbsoluteAddress`, `AbsoluteAddress`, `Pointer`, `ZeroPagePointer`, `Branch`, `Jump`, `Subroutine`, `ExternalJump`, `Predefined`, `UserDefined`, `LocalUserDefined`, `Return`. Filter arg `kind` accepts `"user"`, `"system"`/`"platform"`, `"auto"`. |
| Auto-name prefixes | derived from `LabelType::prefix()` | Verbatim (`types.rs:384-397`): `zpf_`, `f_`, `zpa_`, `a_`, `p_`, `zpp_`, `e_`, `j_`, `s_`, `b_`, `r_`, and `L_` for `Predefined`/`UserDefined`/`LocalUserDefined`. |
| Comments | `r2000_get_comments` → `[{address, type, comment}]`, `type` ∈ `"line"`/`"side"` | Read from `app_state.user_line_comments` / `user_side_comments` (`handler.rs:1858-1866`) — **user-authored only**; there is no auto-comment noise to filter. |
| Callers | `r2000_get_cross_references(address)` → sorted, deduped `Vec<Addr>` (`handler.rs:1636-1645`) | Exactly what COV-02's multi-caller rule needs. |
| Confidence grades | `src/mcp/vice/r2000-confidence.ts` | Five grades, verbatim tokens: `confirmed-code`, `probable-code`, `confirmed-data`, `probable-data`, `unknown`. Parser throws on a near-miss rather than silently degrading. Already built, already tested. |

### 3.2 Number 1 — structural completeness (derived from bytes)

**Source:** raw bytes + `decode()`. **Never** `r2000_get_blocks`.

Algorithm:

1. **Seeds** = program origin, plus every `User`-kind label address from `r2000_get_symbols`, plus any entry point recorded by the project.
2. **Recursive descent** with `decode()`: follow `resolvedTarget` for `relative`-role operands (branches) and for absolute `JSR`/`JMP`; terminate a trace at `RTS`/`RTI`/unconditional `JMP`/`BRK`.
3. **Widened indirect scan** — the part `follow_indirect_jumps` does not do (§3.7), four classes:
   - `0x6C` `JMP ($nnnn)` with the pointer **anywhere**, including zero page.
   - **Multi-entry tables**: at a table base, read successive little-endian 16-bit entries while each resolves in range, and record the run length.
   - **Split lo/hi tables**: paired indexed loads (`operand.role` `absolute`/`zeropage` with `mode` `absoluteX`/`absoluteY`/`zeropageX`) whose two bases are N apart; reconstruct N targets.
   - **RTS-trick**: sliding-window match on the decoded stream for the `LDA hi,X : PHA : LDA lo,X : PHA : RTS` idiom. Contains **no** `0x6C`, so it is completely invisible upstream — and it is BUILD-04's own named class, so Phase 21 reuses this scan (satisfying the ROADMAP note).
4. **Classify every byte** in `[origin, origin+size)` into disjoint classes:
   `reached-as-instruction` (recursive descent from a seed), `table-entry`
   (inside a reconstructed table), `referenced-as-data` (target of an indexed or
   absolute load/store), `unreached`.
5. **Divergence sub-report:** byte counts where the census and `r2000_get_blocks`
   disagree, broken out by direction (census says code / store says
   `Undefined`|`Byte`, and vice versa).

**Why it cannot be gamed:** the census is a pure function of the bytes and the
seed set. Mass `r2000_set_data_type` calls move `get_blocks` and therefore
`divergence`, but cannot move `reached-as-instruction` by a single byte.

**Two design constraints, both sourced from upstream's own text:**

- **Decodability is not evidence of code.** Upstream Pitfall 1, verbatim: *"**Speculative code conversion / disassembly**: This is the **most dangerous mistake**. Never trigger `r2000_disassemble` at a region unless you have concrete proof it is executed (JSR/JMP/branch target, vector table entry, or user confirmation). Random data routinely disassembles into plausible-looking instruction sequences — this does NOT make it code."* [VERIFIED: `r2000-analyze-blocks/SKILL.md:213-217`]. So `reached-as-instruction` must mean *reached by recursive descent from a seed*, and a separate, clearly-labelled `linear-sweep-decodable` count may be reported but must never be summed into completeness.
- **Splitter absence biases the census's peer.** Upstream Pitfall 5 (§1.3): two adjacent same-type tables auto-merge, and `r2000_get_blocks` "respects splitters". Since `r2000_toggle_splitter` is not curated, the divergence sub-report will show a systematic over-merge on the store side. Report it as a known, named bias rather than as instrument error.

### 3.3 Number 2 — the Auto-versus-User label ratio

**Source:** `r2000_get_symbols`.

Report **two** independent figures, because one is gameable and the other is not:

- `kindRatio`: `{ user, auto, userFraction: user/(user+auto) }` over **non-`System`** labels only. `System` labels are platform-provided; counting them would let a large KERNAL symbol set inflate the ratio for free.
- `autoPrefixNamesRemaining`: count of labels whose **name** still matches `^(zpf_|f_|zpa_|a_|p_|zpp_|e_|j_|s_|b_|r_)` — regardless of `kind`. This catches the game "call `r2000_set_label_name` with the same string so `kind` flips to `User` while the name stays `p_1234`". It also maps directly onto DECOMP-02's own bar ("no `p_XXXX` or `l_XXXX` left").

Note `L_` is *both* `Predefined` and `UserDefined`/`LocalUserDefined`
(`types.rs:394-396`), so `L_` must **not** be in the auto-prefix regex — it
cannot distinguish auto from user. That is a real trap; the prefix list above
excludes it deliberately.

### 3.4 Number 3 — sampled independent reproducibility

**Reuse the Phase 11 sealed-answer-key mechanism (D-26).** It already exists,
already has a non-vacuity guard, and already solves the hard part.

`src/mcp/vice/r2000-answer-key.test.ts` guards three failure classes, verbatim
from its header: `T-11-SEAL-DRIFT` (hash stops matching the answer's canonical
line), `T-11-LEAK` (the question file contains the answer, so a second session
could answer without querying the store), and `T-11-RETROFIT / T-11-VACUOUS-CHECK`
(the check **must FAIL, never skip**, when the second session's answer file is
missing or its fenced block is empty). Evidence lives at
`.planning/phases/11-.../evidence/criterion1/{QUESTION.md, ANSWER.md, ANSWER.sha256, SESSION-B-ANSWER.md}`.

Applied to COV-01:

1. **Deterministic sample**, never cherry-picked: sort documented labels by address, take every `⌈N/K⌉`-th. Record the rule *and* the resulting address list in the report so the sample is reproducible and auditable.
2. **Seal** each sampled item's existing documentation in canonical form; commit only the hash.
3. **Independent re-derivation**: a second pass derives the documentation **from the bytes alone** — no access to the store's comments (that is the `T-11-LEAK` condition, generalised).
4. **Report** `{ sampled: K, agreed: A, disagreed: D, agreementRate: A/K, sampleRule: "...", addresses: [...] }`.
5. **Fail, never skip**, on a missing or empty second answer.

### 3.5 COV-02's negative controls — five fixtures, four that must FAIL

| # | Control | Must produce | Which number catches it |
|---|---|---|---|
| NC1 | **All-Auto**: every label `kind: Auto`, auto names intact | FAIL | #2 — `userFraction` = 0 **and** `autoPrefixNamesRemaining` = N |
| NC1b | **Auto-renamed-in-place**: `kind` flipped to `User`, name still `p_XXXX` | FAIL | #2 — `kindRatio` looks perfect, `autoPrefixNamesRemaining` = N. *This is the control that proves the second figure earns its place.* |
| NC2 | **"handles data" everywhere**: every line comment identical | FAIL | comment-vacuity measure (below) — `distinctCommentRatio` ≈ 1/N |
| NC3 | **Mass block-type set**: every byte `DataByte` | FAIL | #1 — census unmoved, `divergence` explodes |
| NC4 | **Multi-caller, no cross-reference**: a label with 3 callers, documented without naming any | FAIL | §3.6's rule — the label does not count toward #2 |
| NC5 | **False-positive control**: a genuinely well-documented fixture | **PASS** | all three. Without NC5 the whole instrument is vacuous. |

**Comment-vacuity measure** (needed for NC2; no existing measure covers it):

- Normalise: lowercase, strip backticks/markdown, collapse whitespace.
- `distinctCommentRatio = distinctNormalisedComments / commentedAddresses`.
- A committed banned-generic set (`"handles data"`, `"does stuff"`, `"routine"`, `"data"`, `"unknown"`, …) whose members never count as documentation.
- A **duplicate-comment** rule: the same normalised text at ≥ V addresses counts once, not V times.
- A **confidence-grade** requirement, reusing `r2000-confidence.ts`: report `gradedFraction`, and treat `[unknown]`-graded comments as *not yet documented*. Already-built, already-tested machinery — do not write a second grade vocabulary (that module's header explicitly forbids it).
- DECOMP-02's four-part purpose bar (function, inputs, outputs, side effects) is the eventual semantic bar; Phase 19 should implement the *mechanical* subset (length floor, distinctness, grade presence) and name the semantic part as human-judgment.

### 3.6 The multi-caller rule, mechanically

> "any label reached from more than one call site requires cross-reference-backed documentation to count"

Mechanically, per label `L`:

1. `callers = r2000_get_cross_references(L.address)` — verified to return a sorted, deduped list (`handler.rs:1636-1645`).
2. If `callers.length <= 1`, the ordinary documentation rules apply.
3. If `callers.length > 1`, `L` counts as documented **only if** its line comment (a) exists, (b) is non-vacuous per §3.5, **and** (c) literally names at least one caller — either as `$XXXX` matching a caller address, or as the user label name at a caller address.
4. Otherwise `L` is `multi-caller-undocumented` and is excluded from #2's `user` tally. Report the count and the offending addresses.

This is a purely textual, checkable rule over data the curated surface already
returns. No new tool needed.

### 3.7 What `follow_indirect_jumps` does NOT walk [VERIFIED — source at pin]

`crates/regenerator2000-core/src/analyzer.rs:445-540`, called once from `:280`.
Read this session. It walks a linear sweep over bytes whose `block_types` entry is
already `Code`, and acts **only** on opcode `0x6C`:

- `if opcode_byte != 0x6C { … continue; }` — indirect `JMP` only.
- `is_internal` requires the pointer address to be inside `[origin, origin+len)` — a **zero-page vector** (the overwhelmingly common C64 idiom, `JMP ($xx)` with the vector in ZP) is therefore **never followed** for any program loaded above ZP.
- `:505-506`: `let is_address_block = ptr_offset + 1 < data_len && state.block_types.get(ptr_offset) == Some(&BlockType::Address);` — the pointer location must **already** be classified `Address`.
- It then reads **exactly one** 16-bit entry (`data[ptr_offset]`, `data[ptr_offset+1]`), adds one label and one cross-ref.

Concretely unwalked, each a census-widening requirement:

| Gap | Consequence |
|---|---|
| **Multi-entry dispatch tables** — one entry read per `JMP ($nnnn)` | An N-entry table yields N−1 unwalked targets. This is the ROADMAP note's named gap, confirmed at source. |
| **Zero-page vectors** — `is_internal` false | The most common indirect-dispatch idiom on the C64 is invisible. |
| **Split lo/hi tables** — only `BlockType::Address` gates the walk | `LoHiAddress`/`HiLoAddress`/`LoHiWord`/`HiLoWord` all exist as block types (`types.rs:314-331`) and none of them opens the gate. |
| **The RTS trick** — `LDA hi,X : PHA : LDA lo,X : PHA : RTS` | No `0x6C` anywhere; completely invisible. BUILD-04's named class. |
| **Circular dependency on prior classification** | It skips non-`Code` bytes and requires the pointer to already be `Address`. On an under-classified binary — exactly the state coverage measures — it finds nothing. **This is the single strongest argument for the derived-from-bytes census: upstream's own reachability walk cannot be a coverage oracle because it depends on the thing being measured.** |

### 3.8 Where the instrument lives, and the CI constraints on that choice

Recommended: a new `coverage` verb on `r2000-cli.ts`'s dispatch switch, plus the
census/report modules in `src/mcp/vice/`.

**Three mechanical constraints on that choice, all verified:**

1. **A new CLI verb must be documented in a skill file or CI goes red.** `scripts/lib/r2000-cli-verbs.mjs` parses the verb list from `r2000-cli.ts`'s own dispatch switch (never a hand-typed array); `check-skill-tool-coverage.mjs:481-491` fails for any verb "parsed from r2000-cli.ts's dispatch switch but named by NO skill file". Current state, live: 7 verbs — `bootstrap`, `export-asm`, `export-lbl`, `gen-enums`, `import-lbl`, `render-memmap`, `verify` — 7/7 resolved. [VERIFIED]
2. **`R2000_CLI_VERB_FLOOR = 7` is a floor** (`>=` at `:467`), so 8 verbs is fine. [VERIFIED]
3. **Any test file outside `src/mcp/vice/` must be covered by a `.github/workflows/ci.yml` `build`-job step**, or `ci-suite-coverage.test.ts` fails — it derives the set of directories holding committed test files from the repo itself, because `npm test` in `src/mcp/vice` is `node --test '*.test.*'`, cwd-only and non-recursive. [VERIFIED: that file's header and `SKILLS_GLOB_PROOF = "src/skills/*/scripts/*.test.mjs"`]

### 3.9 The previously-unseen fixture — concrete candidates

The ROADMAP note requires validation against a fixture the instrument was not
written against. Two are already in the repo and were authored for entirely
different phases:

- `.planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion1/recon-subject.regen2000proj` (+ `recon-subject.prg`) — origin `$0810`, 100 bytes, entropy 5.004 (live-read this session).
- `.planning/phases/11-.../evidence/criterion4/subject.regen2000proj` (+ `subject.prg`, `subject-copy.regen2000proj`).

Recommend authoring the rules against a **new** synthetic fixture (needed anyway
for NC1–NC5) and validating against these two. Also note the milestone bar:
committed synthetic fixtures only, no copyrighted image.

---

## 4. ABS-03 — inventory-wide trigger uniqueness

### 4.1 The precedent to reuse (three-file shape)

Exactly mirrored on `check-skill-fork-honesty.mjs`:

| File | Role |
|---|---|
| `scripts/lib/skill-descriptions.mjs` (new) | Pure, exported predicates: frontmatter parse, normalisation, clause split, similarity, collision detection. |
| `scripts/check-skill-description-overlap.mjs` (new) | Top-level CI script; prints one `check-skill-description-overlap: OK -- …` line; `process.exit(1)` on failure. |
| `src/mcp/vice/skill-description-overlap.test.ts` (new) | Planted-violation proof importing **the same module the CI script imports**, plus a live-execution control asserting the script exits 0 and matches `/check-skill-description-overlap: OK/`. |

That last point is load-bearing and is stated in `skill-honesty-checks.test.ts`'s
own header: the CI script runs at import time, so only a test importing the same
predicate module can prove the predicate is non-vacuous. Reuse
`scripts/lib/skill-corpus.mjs`'s `walkSkills()` / `topLevelSkillDirs()` rather
than a second walker (the WR-12 lesson).

### 4.2 Normalisation and the metric

Descriptions are the trigger mechanism, and they are structured — every existing
description is a *capability sentence* followed by `Use when asked to …` /
`Use when …` trigger clauses. Compare **clauses**, not whole descriptions.

1. Parse frontmatter `name:` and `description:`.
2. Split at the first `Use when` (case-insensitive): head = capability sentence; tail = trigger clauses split on `,`, ` or `, `. `, `;`.
3. Per clause: lowercase; strip backticks/`*`/`_`; map `—`/`–` → `-`; drop non-`[a-z0-9$ -]`; split on whitespace/hyphen; crude stem (tokens > 4 chars: `ies`→`y`, strip trailing `es|s|ing|ed`); drop a **function stop-list** (`the a an to of for and or when asked use in on at is it this that any every its as with by from what which how do does not`) and a **domain stop-list** (`c64 commodore 6502 6510 vice address memory program code byte bytes`) — otherwise every C64 skill collides with every other on shared vocabulary.
4. Similarity = **max pairwise Jaccard over clause token-sets**, ignoring clauses with fewer than 2 surviving tokens.
5. **Contention** = any pair scoring ≥ T, **or** any pair with an identical normalised token set regardless of T.

### 4.3 Measured baseline — pick T from data, not taste

Computed this session over all 6 project skills plus all 5 upstream procedures
(11 descriptions, 55 pairs):

| Pair | Score | Worst-matching clauses |
|---|---|---|
| `r2000-analyze-routine` :: `r2000-analyze-symbol` (both upstream) | **0.261** | "Analyzes a disassembly subroutine to determine its function by examining code, cross-references, and memory usage…" :: "Analyzes a specific memory address or label to determine its purpose … by examining its cross-references and usage patterns" |
| `c64-program-recon` :: `c64-provenance-diff` (both project) | **0.250** | "reverse engineer a C64 game" :: "cracktro code from game code" |
| `acme-build` :: `c64-memory-mapping` | 0.200 | "list the symbols a program uses" :: "document a disassembly listing" |
| `c64-ram-capture` :: `vice-wedge-triage` | 0.200 | "capture a memory image at a checkpoint" :: "when a checkpoint never fires" |
| `r2000-analyze-blocks` :: `r2000-analyze-routine` | 0.138 | (capability sentences) |

[VERIFIED: computed this session with the normalisation above over
`src/skills/*/SKILL.md` and `/tmp/regenerator2000-phase19/.agent/skills/r2000-analyze-*/SKILL.md`]

**Two findings that shape the plan:**

- The clean project inventory's **ceiling is 0.250**. A threshold of 0.5 would be vacuous on this corpus; `T = 0.35` sits comfortably above the ceiling with headroom and well below what a genuine near-duplicate produces.
- **Upstream's own two most-similar siblings (0.261) score *above* the project's clean ceiling.** Carrying `analyze-routine` and `analyze-symbol` descriptions verbatim would immediately breach the measured baseline. The manifest's routing already separates them (routine → `c64-program-recon`, symbol → `c64-memory-mapping`), but their **descriptions must be rewritten on absorption, not carried** — and only ONE new skill directory (`routine-queue-walker`, from `analyze-program`) adds a new description at all, which is the cheapest possible collision surface.

Additional qualitative collisions to resolve during rewriting (each is a real
trigger fight, not a metric artefact):
`analyze-symbol` vs `c64-memory-mapping` ("look up an address like $D020" vs
"determine its purpose"); `analyze-blocks` vs `c64-program-recon` ("which memory
regions are code versus data" is *literally* in the existing description);
`analyze-program` vs `c64-program-recon` (both are whole-program orchestration).

### 4.4 How an allowlist entry justifies itself

Follow the **shrink-by-failing** discipline `check-skill-tool-coverage.mjs`
already uses for `FORK_ONLY_UNRECOVERABLE`/`PENDING_LATER_PHASE` (its header:
*"The allowlist below is designed to SHRINK BY FAILING, not grow silently … An
allowlist that can only ever grow is how a coverage check rots into a permanent
exemption"*).

An entry is `{ a, b, clause, reason, decidedOn }` and must:

1. name **both** skills;
2. quote the colliding clause **verbatim**;
3. give a reason and an ISO date;
4. **be asserted live** — if the collision no longer occurs, the entry is stale and the check **FAILS** until it is deleted.

### 4.5 Report and non-vacuity

The `OK` line must carry: skills scanned, `pairsCompared`, the observed max score
with the pair that produced it, the threshold, and allowlist size. Assertions:

- `pairsCompared === n*(n-1)/2` (the traversal actually happened);
- `n >= 6` — a **floor**, never equality (project memory: "Census assertions go red on a correct tree — assert relations, not counts");
- non-vacuity: a synthetic exact-duplicate pair must score 1.0 and be reported as a collision;
- false-positive control: the two real 0.200 pairs above must **not** collide at T.

### 4.6 Scope of the check

Scan canonical `src/skills/*/SKILL.md` only. `installer/skills/` is a synced copy
(`installer/scripts/sync-skills.mjs`, run by `prepack`) — assert the copies match
rather than scanning both. Do not forget the three *other* places a description
is duplicated by hand and can drift: `CLAUDE.md`'s "Project Skills" table,
`README.md`, and (for the plugin route) whatever the plugin manifest surfaces.

---

## 5. ABS-02 — attribution mechanics

### 5.1 The exact licence facts [VERIFIED — verbatim]

| Fact | Source |
|---|---|
| `license = "MIT OR Apache-2.0"` | `regenerator2000-0.9.20/Cargo.toml.orig:28` (installed crate) — and `crates/regenerator2000-core/Cargo.toml:5` at pin |
| `Copyright (c) 2026 Ricardo Quesada` | `LICENSE-MIT:3` at pin |
| Both licence files ship | `ls LICENSE*` at pin → `LICENSE-APACHE`, `LICENSE-MIT` |
| Repository | `https://github.com/ricardoquesada/regenerator2000` |
| Commit | `493f840418f1450a342bb220c2fe3d2585dd0525`, 2026-07-11 |

### 5.2 The existing notices file contains a claim absorption makes FALSE

`src/mcp/vice/THIRD-PARTY-NOTICES.md` currently says, under
**"## Build/CI tools — not incorporated: regenerator2000"**:

> **No regenerator2000 source, data table, or output is included in this repository or in either published package**, so its licence does not attach to anything shipped.

And in its opening paragraph:

> Every source named below is either zlib-licensed (incorporated), reference-only (nothing copied), or a build/test-time subprocess whose licence therefore never attaches to anything shipped.

**Both become false the moment 53KB of `.agent/skills/*/SKILL.md` prose is
absorbed into `src/skills/`.** This is not a paperwork nit: the file's own
strongest claim is a *checkable* one, and the phase would land a contradiction
into shipped documentation — exactly the defect class
`assumption-label-discipline.test.ts` exists to prevent elsewhere.

Required edits:

1. **New section**, alongside the existing cc65 one:
   `## Incorporated material — regenerator2000 analysis procedures (MIT OR Apache-2.0)` — naming the five source paths, the pinned commit, the five sha256 digests, the byte counts, "adapted, not verbatim" where adapted, and the dual-licence election this project makes (state which: MIT is the natural match to this repo's own MIT licence).
2. **Narrow** the existing "not incorporated: regenerator2000" section to the *subprocess* claim only — it remains true that no regenerator2000 **source code, data table or program output** is incorporated. Keep the correction note about the stale Apache-2.0-alone claim; it is still valuable.
3. **Widen** the opening enumeration to include "MIT-OR-Apache-2.0 (incorporated)". The "No GPL-licensed material" claim is unaffected and stays.

### 5.3 The installer package ships the absorbed text with NO notices file [VERIFIED]

`installer/package.json` `files[]` is `["bin/", "skills/", "README.md"]`. There is
**no** `THIRD-PARTY-NOTICES.md` and **no** `LICENSE` under `installer/`
(`ls installer/LICENSE*` → No such file). Meanwhile
`src/mcp/vice/package.json` `files[]` **does** include
`THIRD-PARTY-NOTICES.md` (`:75`), and `scripts/check-npm-packages.mjs:112-113`
asserts it.

So the package that will actually ship the absorbed MIT-OR-Apache-2.0 prose
(`@henols/c64-re-tools`, via `installer/skills/`) currently carries no notices
document at all. Two complementary fixes:

- **Per-file attribution headers** (ABS-02's own requirement) travel *inside* each `SKILL.md`, so they ship regardless. This is the primary mechanism and it is sufficient for attribution.
- **Add a notices file to `installer/files[]`** and assert it in `check-npm-packages.mjs`, mirroring the existing vice-mcp assertion. Belt and braces, and it makes the obligation checkable rather than prose.

### 5.4 Recommended per-file attribution header shape

An HTML comment block immediately **after** the YAML frontmatter (frontmatter
must stay first for skill discovery; a comment is invisible to rendered prose but
present in the shipped file):

```markdown
---
name: routine-queue-walker
description: …
---

<!--
ATTRIBUTION (ABS-02)
Adapted from regenerator2000.
  Source repository: https://github.com/ricardoquesada/regenerator2000
  Source path:       .agent/skills/r2000-analyze-program/SKILL.md
  Pinned commit:     493f840418f1450a342bb220c2fe3d2585dd0525  (v0.9.20, 2026-07-11)
  Source sha256:     2d1c91bcc612c00ce71b7def08917b59ca7e495aa61f9075cbb0795e935f6955
  Upstream licence:  MIT OR Apache-2.0 — Copyright (c) 2026 Ricardo Quesada
  This project elects: MIT
  ADAPTED, NOT VERBATIM. Named deviations:
    - the seven-way concurrent-subagent rolling window is NOT carried
      (Phase 18 criterion 4; the session seam is a coarse FIFO mutex)
    - runtime reads of `.agent/skills/...` are replaced with this project's
      own skill paths (that directory is excluded from the published crate)
    - the cursor-based entry route is replaced by explicit address input
    - upstream's `set_immediate_format` / `toggle_splitter` / `undo` /
      `unpack_binary` steps are omitted or re-routed; see
      .planning/phases/19-.../upstream-procedure-manifest.json
  Re-sync trigger: see ABS-04's dated decision.
  See THIRD-PARTY-NOTICES.md.
-->
```

The "ADAPTED, NOT VERBATIM" line plus the named deviations is not decoration: it
is the Apache-2.0 §4(b) modification-notice obligation and the honest statement
that upstream's concurrency model was deliberately dropped. A header claiming
verbatim provenance for adapted text would be its own honesty defect.

Mechanical guards worth adding (all cheap greps over `src/skills/**`):
every absorbed file carries all six header fields; the commit string matches the
manifest's `commit`; the sha256 matches the manifest entry for that source path;
zero occurrences of the literal `.agent/skills`; and the notices file names all
five source paths.

### 5.5 The skill-count pin that WILL break [VERIFIED]

`scripts/check-npm-packages.mjs:235`:

```js
need(skillMds.length === 6, `installer: expected 6 skills with SKILL.md, found ${skillMds.length}`);
```

**Exact equality.** Adding `routine-queue-walker` makes this fail. This is
precisely the project-memory trap ("Census assertions go red on a correct
tree — assert relations, not counts"). Recommended fix, not merely bumping 6→7:
assert the installer's copied skill count **equals** the count of top-level
directories under `src/skills/` containing a `SKILL.md` — a *relation* that
cannot go stale. Repo-wide search found no other exact skill-count pin;
`check-skill-tool-coverage.mjs:380` is `>= 6` and safe.

Also required for a new skill: run `installer/scripts/sync-skills.mjs` and commit
`installer/skills/routine-queue-walker/`, and update `CLAUDE.md`'s Project Skills
table.

---

## 6. The deferred measurement (D18-16) — run, recorded, and it CLOSES the deferral

### 6.1 Source answer: strictly serial, by construction [VERIFIED — verbatim]

`--mcp-server-stdio` dispatches to `run_headless_stdio_loop()`:
`src/main.rs:710-711` sets `headless`/`mcp_server` from the flag, `:811` returns
`run_headless_mcp(core.state, mcp_server_stdio)`, and `:388` calls
`regenerator2000_core::mcp::stdio::run_headless_stdio_loop(app_state, view_state)`.

`crates/regenerator2000-core/src/mcp/stdio.rs:67-72, 98`:

```rust
pub async fn run_headless_stdio_loop(mut app_state: AppState, mut view_state: CoreViewState) {
    let stdin = io::stdin();
    let mut reader = stdin.lock();
    let mut line = String::new();

    while reader.read_line(&mut line).unwrap_or(0) > 0 {
        …
            let response = handle_request(&request, &mut app_state, &mut view_state);
```

One blocking `read_line` at a time; `handle_request` called **synchronously** in
the loop body on `&mut AppState`. No `tokio::spawn`, no `select!`, no join. Rust's
borrow rules make concurrent handling of `&mut AppState` impossible by
construction. Responses are emitted with `println!` + explicit flush, so they
always come out in arrival order.

Two incidental hazards worth recording for session robustness:

- A line that fails `serde_json::from_str` is silently `continue`d with **no response at all** (`stdio.rs:73-77`) — a malformed request hangs a naive client forever rather than erroring.
- A request with no `method` field likewise produces no response.
- Requests must be **single-line** JSON; `read_line` cannot span a pretty-printed payload.

### 6.2 Live measurement — three runs, all consistent [VERIFIED]

**Method** (mirrors `18-STDIN-EOF-EVIDENCE.md`'s shape: isolate the child's own
behaviour at the OS level, not through `vice-proxy.ts`):

1. Synthesize a scratch `.regen2000proj` with the real, shipped `synthesizeProject()` (8192 bytes of `$EA` NOPs terminated by `$60 RTS`, origin `$0810`).
2. Spawn `regenerator2000 --mcp-server-stdio <project>` with `stdio: ["pipe","pipe","pipe"]` — the exact shape `openR2000Session()` uses.
3. `initialize`, then after 400ms write **one single burst** containing two requests back to back, so both sit in the child's stdin pipe simultaneously:
   - `id: "SLOW-BATCH"` — `r2000_batch_execute` with N × `r2000_set_comment` (each inner call triggers `perform_analysis()` + `disassemble()` inside r2000);
   - `id: "FAST-INFO"` — `r2000_get_binary_info`, trivial.
4. Timestamp every response line's arrival relative to spawn.

**If the handler multiplexed, `FAST-INFO` would return in single-digit
milliseconds. If it is serial, `FAST-INFO` cannot return until `SLOW-BATCH`
finishes.**

| Run | N inner calls | Burst written at | `SLOW-BATCH` reply | `FAST-INFO` reply | FAST waited |
|---|---|---|---|---|---|
| 1 | 6000 | 410ms | 14201ms | **14203ms** | ~13.8s |
| 2 | 3000 | 405ms | 6329ms | **6329ms** | ~5.9s |
| 3 | 3000 | 410ms | 11679ms | **11679ms** | ~11.3s |

[VERIFIED: live, three runs this session, `regenerator2000` at
`/home/henrik/.cargo/bin/regenerator2000`, version 0.9.20. Driver retained at
the session scratchpad, `serial-probe.mjs`.]

**Conclusion (HIGH — source + live, two independent methods agreeing):**
regenerator2000 0.9.20's `--mcp-server-stdio` handler **reads stdin serially and
processes exactly one request at a time, in arrival order.** It does not
multiplex.

### 6.3 What this means for D18-16

- A reader-writer lock at `r2000-session.ts` would buy **zero** parallelism: concurrent reads would immediately re-serialise inside the child.
- The **coarse FIFO mutex is not a compromise — it is an exact model of the child's own behaviour**, and its bounded-FIFO-wait contention answer is the right shape (a refuse-while-busy error would surface the child's serialism as a caller-visible failure for no benefit).
- **Recommendation: Phase 19 CLOSES D18-16 as "measured, answered NO, not needed" rather than re-deferring it.** The precondition the deferral named has been met and the answer removes the motivation.
- Read-only fan-out remains the sanctioned *orchestration* pattern (multiple agents thinking in parallel), but the plan must state plainly that fan-out buys **no I/O parallelism at the session** — its value is agent reasoning concurrency, not throughput. Absorbed procedure text must not promise otherwise. `r2000-analyze-program`'s 7-way rolling window (`:75`, `:89-93`, `:129`, `:145`) must therefore be rewritten, not carried — and the attribution header must name that deviation (§5.4).

### 6.4 The artifact that records it

Mirror `18-STDIN-EOF-EVIDENCE.md` exactly — it is the established template and
it worked:

- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-STDIO-MULTIPLEXING-EVIDENCE.md` with sections: Question / Method / Exact command sequence / Observed outcome (the run table + raw JSON from one representative run) / Decision / Reproducing this measurement.
- Committed driver under `.planning/phases/19-.../evidence/measure-stdio-multiplexing.mjs`, self-contained, exiting non-zero with `{"ok": false, "reason": …}` when the binary cannot be spawned — so a future re-run can never record an assumed result.
- Include the **source citation** alongside the measurement (`stdio.rs:67-98`, `main.rs:388`): the source proof is what makes the measurement's answer *general* rather than one machine's timing.
- Not a test file (no `.test.` in the name), so `ci-suite-coverage.test.ts` is unaffected — same as Phase 18's two drivers.

---

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** Verified: the
coverage instrument, the description checker, the attribution guards and the
packer finding are all authored TypeScript/`.mjs` using only Node built-ins and
this repository's own sibling modules. `src/mcp/vice/package.json`'s runtime
dependency set is pinned to exactly `@mastra/mcp` + `@mastra/core` and asserted
by `scripts/check-npm-packages.mjs`; nothing here changes it.

The one new external dependency is `unp64` — an **optional, OS-level CLI oracle**
invoked as a subprocess, gated on presence, never an npm/PyPI/crates package and
never added to any `dependencies` block. Its licence therefore does not attach to
anything shipped, exactly as recorded for ACME and regenerator2000 in
`src/mcp/vice/THIRD-PARTY-NOTICES.md`'s "Build/CI tools — not incorporated"
sections. It is **not installed on this machine** (§Environment Availability) —
treat it as a scope decision, not a silent install.

**Packages removed due to [SLOP] verdict:** none — none proposed.
**Packages flagged as suspicious [SUS]:** none — none proposed.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| "Does absorbed text call an uncurated `r2000_*` tool?" | A new tool-diff checker | **`scripts/check-skill-tool-coverage.mjs`** (already imports `CURATED_R2000_TOOLS`, already greps `src/skills/**`, already fails, already has a non-vacuity floor) | A second checker would diverge from the first. Verified running green this session. |
| An independent 6502 instruction stream for the census | A new decoder | **`decode()` in `src/mcp/vice/disasm-decoder.ts:148`** | Already bounded-by-construction, never-throws, import-free of transport code (D-05), and gives `resolvedTarget` + `mode` + `operand.role` — everything the reachability walk needs. |
| Reading the raw bytes out of a project | A new format parser | **`r2000-project.ts`'s `synthesizeProject()` shape** (`raw_data_base64`, gzip+base64) read symmetrically, or curated `r2000_read_region` | A tested writer already defines the format. |
| "Independent reproducibility, provably not retrofitted" | A fresh seal/hash scheme | **Phase 11's sealed answer key** (`r2000-answer-key.test.ts` + `evidence/criterion1/`) | Already guards seal-drift, answer-leak **and** the vacuous-check case (missing/empty second answer must FAIL, not skip). |
| A confidence vocabulary for comments | A sixth grade, or a second spelling | **`r2000-confidence.ts`'s `CONFIDENCE_GRADES`** | Its header explicitly forbids a second copy; its parser throws on near-misses so a typo can't silently degrade. |
| Walking the skills tree / extracting tool names | A local copy | **`scripts/lib/skill-corpus.mjs`** (`walkSkills`, `topLevelSkillDirs`, `extractToolNames`, `MCP_PREFIX_RE`) | The WR-12 lesson; four scripts already share it. |
| A CI-visible predicate that can't be proven non-vacuous | Logic inline in a top-level script | **The three-file pattern**: `scripts/lib/*.mjs` predicate + `scripts/check-*.mjs` runner + `src/mcp/vice/*.test.ts` planted-violation proof | `skill-honesty-checks.test.ts`'s header states exactly why: a top-level script's exit code says nothing about whether the predicate distinguishes a violation from a clean file. |
| An ever-growing exemption list | A plain allowlist | **The shrink-by-failing allowlist** (`FORK_ONLY_UNRECOVERABLE` pattern): every entry asserted still-live, stale entries fail the build | Named in `check-skill-tool-coverage.mjs`'s own header as how a coverage check rots. |
| Packer signature detection | A transcribed signature table | An **external oracle** (`unp64`, env-gated) with a hard `unknown` default | Out of bounds by the brief, and a transcribed table is the same copy in different clothing. |

**Key insight:** this repo has spent four milestones building exactly the guard
machinery Phase 19 needs. The failure mode to avoid is not "missing
infrastructure" — it is **building a second copy of infrastructure that already
exists**, which is the one defect class every one of those guards was written to
catch.

---

## Common Pitfalls

### Pitfall 1: mentioning a non-curated tool name in absorbed prose
**What goes wrong:** CI fails with `r2000_toggle_splitter: referenced by src/skills/… but NOT in CURATED_R2000_TOOLS`.
**Why:** `check-skill-tool-coverage.mjs:88` is a plain token grep (`/\br2000_[a-z0-9_]+/g`) with no comment or context awareness. Even a "we deliberately omit this" note trips it.
**How to avoid:** name it without the prefix, or record the omission in `.planning/` (not scanned).
**Warning sign:** the phrase "we do not use `r2000_…`" anywhere under `src/skills/`.

### Pitfall 2: adding the 7th skill and breaking the packaging check
**What goes wrong:** `check-npm-packages.mjs:235` fails — `installer: expected 6 skills with SKILL.md, found 7`.
**Why:** exact equality against a count that legitimately grows.
**How to avoid:** convert to a relation (installer copy count == `src/skills` SKILL.md count). Also run `installer/scripts/sync-skills.mjs` and commit the copy, and update `CLAUDE.md`'s Project Skills table.
**Warning sign:** any `=== <number>` on a census in a guard you are about to make grow.

### Pitfall 3: building the census from `r2000_get_blocks`
**What goes wrong:** the instrument becomes trivially gameable — mass `r2000_set_data_type` makes the number look perfect.
**Why:** it reads the store's own bookkeeping, which is the thing being audited. Circularly, upstream's own `follow_indirect_jumps` has the same defect: it requires the pointer to already be `BlockType::Address` (`analyzer.rs:505-506`) and skips non-`Code` bytes, so on an under-classified binary it finds nothing.
**How to avoid:** census from bytes via `decode()`; use `get_blocks` **only** for the divergence sub-report.
**Warning sign:** any coverage figure that changes when only block types change.

### Pitfall 4: treating decodability as evidence of code
**What goes wrong:** near-100% "structural completeness" on a binary that is mostly data.
**Why:** upstream's own Pitfall 1: "Random data routinely disassembles into plausible-looking instruction sequences — this does NOT make it code."
**How to avoid:** `reached-as-instruction` means *reached by recursive descent from a seed*. Report `linear-sweep-decodable` separately and never sum it in.
**Warning sign:** the census's code fraction barely moves when you remove seeds.

### Pitfall 5: the auto-name/auto-kind gap
**What goes wrong:** `userFraction` reads 1.00 while every label is still called `p_1234`.
**Why:** `r2000_set_label_name` with the same string flips `kind` to `User`; the name is unchanged.
**How to avoid:** report `autoPrefixNamesRemaining` as an independent figure. Exclude `L_` from the prefix regex — it is used by `Predefined` **and** `UserDefined` (`types.rs:394-396`) and cannot distinguish them.
**Warning sign:** DECOMP-02's own bar ("no `p_XXXX` or `l_XXXX` left") passing while names are unchanged.

### Pitfall 6: carrying upstream's concurrency model with the sequencing
**What goes wrong:** absorbed text promises 7-way parallel throughput the seam cannot deliver.
**Why:** `r2000-analyze-program/SKILL.md:75, 89-93, 129, 145` prescribes a 7-slot rolling window. §6 proves the child is serial; Phase 18 criterion 4 already forbade copying it.
**How to avoid:** absorb the *sequencing* (queue construction, refresh points, no-premature-halting rule) and drop the concurrency; name the deviation in the attribution header.
**Warning sign:** the words "concurrent", "rolling window" or "7" surviving into an absorbed step.

### Pitfall 7: shipping a notices claim that absorption falsified
**What goes wrong:** `src/mcp/vice/THIRD-PARTY-NOTICES.md` continues to assert "No regenerator2000 source … is included in this repository or in either published package" while 53KB of it is.
**How to avoid:** split the section as in §5.2 *in the same commit* that lands the first absorbed file.
**Warning sign:** the absorbed text landing before the notices edit.

### Pitfall 8: a live-dependency check that silently skips
**What goes wrong:** `unp64` absent ⇒ the packer test skips ⇒ SURF-03 reads green with no evidence.
**How to avoid:** the `r2000-test-gate.ts` D-11 pattern — expected SKIP by default, hard FAIL under an opt-in env var, and the finding itself must emit `verdict: "unknown"` with a non-empty `unavailableReason`, never a silent `null`.

### Pitfall 9: a test file outside `src/mcp/vice/` with no CI step
**What goes wrong:** `ci-suite-coverage.test.ts` fails, naming the uncovered directory.
**Why:** `npm test` in `src/mcp/vice` is `node --test '*.test.*'` — cwd-only, non-recursive.
**How to avoid:** put new test files in `src/mcp/vice/`, or add a `build`-job step. Note the existing skills glob is `src/skills/*/scripts/*.test.mjs`.

### Pitfall 10: using `test:automated` as the phase gate
**What goes wrong:** a red suite reads green because `test-gate.mjs` skips `MANUAL_ONLY_TESTS`.
**How to avoid:** the phase gate is the full `npm test` (plus `tsc --noEmit`). Note `18-06-SUMMARY.md` already records pre-existing unrelated failures in `audit-integrity.test.ts`, `binmon-fixtures.test.ts` and broker tests — establish the baseline before adding to it.

---

## Runtime State Inventory

Phase 19 absorbs text and adds measurement; it renames nothing. Included because
absorption *moves* content across a package boundary.

| Category | Items Found | Action Required |
|---|---|---|
| Stored data | **None** — the coverage instrument is read-only over `.regen2000proj` files and adds no store of its own. Verified: `detected_packer` is not serialised (`file_io.rs:403`, and absent from `ProjectState`), so no existing project file carries stale packer state to migrate. | none |
| Live service config | **None** — no external service holds skill descriptions or procedure text. The plugin manifest points at `./src/skills/` as a directory (`.claude-plugin/plugin.json`), not at an enumerated list, so a 7th skill needs no manifest edit. | none |
| OS-registered state | **None** — no OS registration names a skill or procedure. | none |
| Secrets / env vars | **New, optional, no secret:** `UNP64` / `UNP64_PATH` (oracle path, upstream's own convention at `unpacker_compare_all.rs:6-8`) and `VICE_REQUIRE_UNP64` (opt-in hard-fail gate). No existing env var is renamed. | document in the env table |
| Build artifacts / synced copies | **`installer/skills/` is a synced copy** of `src/skills/` (`installer/scripts/sync-skills.mjs`, run by `prepack`). Currently 6 directories. A new skill or an edited description leaves it stale until synced and committed. `scripts/check-npm-packages.mjs:235` pins the count at **exactly 6**. | run `sync-skills.mjs`, commit `installer/skills/`, and fix the `=== 6` pin (§5.5) |

---

## Environment Availability

Probed this session.

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| `regenerator2000` | every r2000 route; the §6 measurement | ✓ | 0.9.20 at `/home/henrik/.cargo/bin/regenerator2000` | none needed; D-11 gate handles absence (expected SKIP in CI, by design) |
| regenerator2000 crate source | source-level verification | ✓ | 0.9.20 in `~/.cargo/registry/src/index.crates.io-*/` (3 crates) | — |
| upstream git clone at pin | the five procedure files (**excluded from the crate**) | ✓ | `/tmp/regenerator2000-phase19` @ `493f840` | re-clone/fetch from GitHub. **NB: `/tmp` is RAM and empties on reboot** (project memory) — the plan must not assume this clone persists |
| Node | everything | ✓ | v22.22.0 (engines: `>=22.18.0`) | — |
| `x64sc` (fork) | unrelated to this phase | ✓ | `/usr/local/bin/x64sc`, backend detected "fork" | — |
| `/usr/bin/x64sc` (genuine stock) | unrelated to this phase | ✓ | per project memory | — |
| **`unp64`** | the only known packer-name oracle | ✗ | — | **no fallback for the name.** The finding degrades to `verdict: "unknown"` with a reason. Test must SKIP-by-default / FAIL-under-`VICE_REQUIRE_UNP64` |
| `exomizer` / `pucrunch` | producing a genuinely packed fixture for E1 | ✗ | — | a pre-packed synthetic fixture could be committed instead, but authoring one without a packer is itself blocked |
| `unpacker_compare_all` (upstream bin) | — | ✗ | not installed (`ls ~/.cargo/bin` → only `regenerator2000`) | needs `cargo build`; **rejected** (no-build-step rule) |

**Missing with no fallback:**
- `unp64` → SURF-03 can report *packedness* and an explicit `unknown`, but cannot report a *name* on this machine today. **The plan must decide whether SURF-03's bar is "a route exists and is exercised when the oracle is present" or "a name is actually reported here".** These are different acceptance bars and the difference is not resolvable by more research — it is a scope decision.

**Missing with fallback:**
- `exomizer`/`pucrunch` → commit a synthetic packed fixture, or scope E1 out.

---

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Node's built-in test runner (`node --test`), no external framework |
| Config file | none — `src/mcp/vice/package.json` `"test": "node --test '*.test.*'"` (cwd-only, non-recursive by construction) |
| Quick run command | `cd src/mcp/vice && node --experimental-strip-types --test <file>.test.ts` |
| Full suite command | `cd src/mcp/vice && npm test` **plus** `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` **plus** `node scripts/check-skill-tool-coverage.mjs`, `node scripts/check-skill-fork-honesty.mjs`, `node scripts/check-npm-packages.mjs` from the repo root |
| Node | v22.22.0 installed; engines `>=22.18.0`. Native type-stripping; **no build step for the shipped server** |
| Live gate | `src/mcp/vice/r2000-test-gate.ts` (D-11). Absence of `regenerator2000` in CI is an **expected SKIP, forever, by design**; `VICE_REQUIRE_R2000` makes it a hard FAIL locally |
| **Do not** use as the gate | `npm run test:automated` (`test-gate.mjs`) — it skips `MANUAL_ONLY_TESTS` and hides CI failures |

### Phase Requirements → Test Map

| Req | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| ABS-01 | Pin + five paths + five sha256 + dispositions | unit | `node --experimental-strip-types --test r2000-upstream-audit.test.ts` | ✅ exists — **extend** with sha256-vs-clone and disposition-justification assertions |
| ABS-01 | No absorbed step calls an uncurated tool | integration (CI script) | `node scripts/check-skill-tool-coverage.mjs` | ✅ exists — no change needed, just must stay green |
| ABS-01 | Zero runtime `.agent/skills` dependency | unit | grep guard over `src/skills/**` + `installer/skills/**` | ❌ Wave 0 |
| ABS-02 | Per-file attribution header complete + matches manifest | unit | new `skill-attribution.test.ts` | ❌ Wave 0 |
| ABS-02 | Notices file records incorporated MIT-OR-Apache-2.0 and no longer claims "nothing incorporated" | unit | assertion over `src/mcp/vice/THIRD-PARTY-NOTICES.md` (planted-violation: the old sentence must fail) | ❌ Wave 0 |
| ABS-02 | Installer tarball carries notices | integration | `node scripts/check-npm-packages.mjs` | ✅ exists — **extend** (`installer/files[]`), and **fix** the `=== 6` pin at `:235` |
| ABS-03 | Pairwise description check clean across the whole inventory | unit + CI script | `node scripts/check-skill-description-overlap.mjs`; `node --experimental-strip-types --test skill-description-overlap.test.ts` | ❌ Wave 0 (three files) |
| ABS-04 | Dated decision + named re-sync trigger, mechanically pinned | unit | extend `r2000-upstream-audit.test.ts` (resync_trigger present; pin-vs-installed-version live check) | ✅ exists — extend |
| COV-01 | Three separately-addressable numbers, never one aggregate | unit | new `r2000-coverage.test.ts` — assert three distinct fields **and** assert no aggregate field exists | ❌ Wave 0 |
| COV-01 | Census independent of `get_blocks` | unit | mutate block types in a fixture, assert census bytes unchanged and only `divergence` moves | ❌ Wave 0 |
| COV-02 | NC1, NC1b, NC2, NC3, NC4 each FAIL; NC5 PASSES | unit | `r2000-coverage.test.ts` negative controls | ❌ Wave 0 |
| COV-01/02 | Previously-unseen fixture | integration (live-gated) | run against `.planning/phases/11-.../evidence/criterion1/recon-subject.regen2000proj` | ❌ Wave 0 |
| SURF-03 | Packer finding emits a valid verdict; `unknown` when no oracle; never guesses a name from entropy | unit | new `packer-finding.test.ts` — planted violation: an entropy-only input must never set `packer` | ❌ Wave 0 |
| SURF-03 | Oracle route live | integration (live-gated) | gated on `unp64`; SKIP-by-default, FAIL under `VICE_REQUIRE_UNP64` | ❌ Wave 0 (**oracle absent — see Environment Availability**) |
| D18-16 | stdio serialism measured and recorded | measurement + doc | `node .planning/phases/19-.../evidence/measure-stdio-multiplexing.mjs` | ❌ Wave 0 (method + observed results already in §6) |

### Sampling Rate

- **Per task commit:** the focused `node --experimental-strip-types --test <file>` for files touched, plus `node scripts/check-skill-tool-coverage.mjs` whenever any `src/skills/**` file changed (it is fast and it is the ABS-01 gate).
- **Per wave merge:** full `npm test` in `src/mcp/vice` + `tsc --noEmit` + all three `scripts/check-*.mjs`.
- **Phase gate:** full `npm test` (never `test:automated`), `tsc --noEmit`, all CI scripts, plus the live coverage run against the previously-unseen fixture and the recorded §6 measurement artifact.

### Wave 0 Gaps

- [ ] `scripts/lib/skill-descriptions.mjs` — ABS-03 predicates
- [ ] `scripts/check-skill-description-overlap.mjs` — ABS-03 CI runner
- [ ] `src/mcp/vice/skill-description-overlap.test.ts` — ABS-03 planted-violation proof
- [ ] `src/mcp/vice/skill-attribution.test.ts` — ABS-02 headers + `.agent/skills` absence + notices content
- [ ] `src/mcp/vice/r2000-coverage.test.ts` — COV-01/COV-02, incl. NC1/NC1b/NC2/NC3/NC4/NC5
- [ ] `src/mcp/vice/packer-finding.test.ts` — SURF-03, incl. the "never infer a name" planted violation
- [ ] Synthetic coverage fixtures for NC1–NC5 (committed; synthetic only, per the milestone bar)
- [ ] `.planning/phases/19-.../evidence/measure-stdio-multiplexing.mjs` + `19-STDIO-MULTIPLEXING-EVIDENCE.md`
- [ ] **Fix** `scripts/check-npm-packages.mjs:235`'s `=== 6` before adding the 7th skill
- [ ] **Extend** `r2000-upstream-audit.test.ts` (sha256-vs-source, disposition justification, resync trigger)
- Framework install: none — Node's built-in runner is already in use.

---

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1`.

### Applicable ASVS categories

| ASVS Category | Applies | Standard control |
|---|---|---|
| V2 Authentication | no | No authentication surface: local CLI/stdio only, no network listener added |
| V3 Session Management | no | The "session" is a child process on a pipe, not an authenticated session |
| V4 Access Control | **yes (narrow)** | Project-path validation stays in `resolveStorePath()` (`r2000-tools.ts`) — the one authoritative place. New coverage/packer code must reuse it, never hand-validate a path. Skill content remains **untrusted input that is matched, never executed** (`scripts/lib/skill-corpus.mjs` header, and `check-skill-tool-coverage.mjs:32`: "it still never `import()`s, `require()`s, `eval()`s or spawns anything from `src/skills/`") |
| V5 Input Validation | **yes** | Three untrusted inputs: (a) absorbed upstream prose — parsed/grepped, never executed; (b) `.regen2000proj` / `.prg` bytes — `decode()` is bounded by construction and never throws (T-04-03-01), and `synthesizeProject()` already validates origin range; (c) the `unp64` oracle's stdout — parse defensively, cap length, never `eval`, never interpolate into a shell (spawn with an argv array, never a shell string) |
| V6 Cryptography | **yes (integrity only)** | sha256 via `node:crypto`'s `createHash` for the manifest digests and the sealed answer key — the `r2000-answer-key.test.ts` precedent. Never hand-roll a digest or a comparison |
| V12 Files & Resources | **yes** | Absorbed files land under `src/skills/` and ship in a tarball; `check-npm-packages.mjs` already validates tarball contents (no `node_modules/`, no test files, no fixtures leaked). Scratch/temp paths for the oracle must be created safely and cleaned up |
| V14 Configuration | **yes (narrow)** | New env vars (`UNP64`, `UNP64_PATH`, `VICE_REQUIRE_UNP64`) are paths/flags, not secrets. `UNP64` is an **attacker-influenceable executable path** if the environment is hostile — resolve and spawn without a shell, and treat a non-existent path as "oracle absent", never as an error to interpolate |

### Known threat patterns for this stack

| Pattern | STRIDE | Standard mitigation |
|---|---|---|
| Command injection via the `unp64` path or the target filename | Tampering / Elevation | `spawnSync(bin, [args…])` with an argv array, never a shell string; never `shell: true` |
| Malicious/malformed `.prg` driving the census into a hang or crash | Denial of Service | `decode()` is bounded by construction: one `while` loop, every iteration consumes ≥1 byte, no recursion in the file (D-05/T-04-03-01). The widened table scan **must inherit the same discipline** — bound every table walk by an explicit maximum entry count, never "walk while plausible" without a cap |
| Absorbed prose executed rather than read | Elevation of Privilege | Standing rule, already asserted: nothing under `src/skills/` is ever imported, required, eval'd or spawned |
| A false "documented" verdict (integrity of the measurement itself) | Repudiation | The whole COV-02 negative-control set; plus the sealed-key `T-11-VACUOUS-CHECK` rule that a missing answer must FAIL, never skip |
| Attribution stripped or falsified in a downstream copy | Repudiation | Per-file headers (they travel inside the tarball) + notices file + mechanical guards asserting header/manifest agreement |
| Path traversal via a caller-supplied project path | Tampering | Reuse `resolveStorePath()`; do not add a second validator |

---

## State of the Art

| Old approach | Current approach | When changed | Impact |
|---|---|---|---|
| One regenerator2000 process per tool call (D-17/D-18) | One long-lived session per project, owned by `r2000-session.ts` (Rule A21) | Phase 18, plan 18-03 | Coverage and absorbed procedures can make many calls cheaply — but all of them serialise (§6) |
| Concurrency unknown; reader-writer upgrade deferred (D18-16) | **Measured: the child is strictly serial. Coarse FIFO mutex is exact, not a compromise** | Phase 19 (this research) | D18-16 should be **closed**, not re-deferred |
| Export the whole program to read a routine | `r2000_read_region` at a range (SURF-01, D18-24/D18-25) | Phase 18, plan 18-05 | Makes the absorbed `analyze-routine` flow viable, and makes the cursor trio largely redundant (D18-26) |
| `r2000_get_address_details` refused (D-32) | Curated as a client-side composition that never calls upstream's defective same-named tool (D-36 supersedes D-32) | Phase 18, plan 18-01 | `analyze-symbol` can be absorbed without hitting the `u16` overflow at `handler.rs:1894` |
| `toggle_splitter` / `set_immediate_format`: "no criterion" | **Criteria found**: DECOMP-01/BUILD-02 and BUILD-03 respectively | Phase 19 (this research) | Propose additively; needed by Phase 20/21, not 19 |
| regenerator2000 licence recorded as Apache-2.0 alone | `MIT OR Apache-2.0`, dual at the user's option | Phase 10 correction, in the notices file | ABS-02 must use the dual form; the correction note is already there and should be kept |

**Deprecated / no longer true:**
- "No regenerator2000 source … is included in this repository" (`src/mcp/vice/THIRD-PARTY-NOTICES.md`) — **becomes false with absorption**; must be split in the same commit.
- "a real caller appearing in Phase 19's absorption diff is what would justify adding [a cursor tool]" (`r2000-tools.ts` header) — a caller appeared, **and its own upstream text forbids using it**. Update the header to record that outcome rather than leaving the invitation open.
- FUT-02's blocker is unchanged: HTTP mode hardcodes port 3000 (`main.rs:397` region, confirmed at `run_headless_mcp`'s `else` branch this session).

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | `unp64`'s stdout carries a parseable packer-name line in a stable format | §2.4 | The oracle route's parse is wrong; the finding always reports `unknown`. **Raise to VERIFIED by E1** (install `unp64`, run against a packed fixture). Upstream's `parse_unp64_entry()` (`unpacker_compare_all.rs:190`) parses an *entry address*, not a name — evidence the stdout is structured, but not proof about the name line |
| A2 | `T = 0.35` is the right collision threshold | §4.3 | Too low ⇒ false positives on the two measured 0.200 pairs; too high ⇒ vacuous. Mitigated by reporting the observed max and asserting both a real-collision and a no-false-positive control; **raise to VERIFIED** once the absorbed descriptions are written and the real max is measured |
| A3 | The `.regen2000proj` `raw_data_base64` field is gzip+base64 of the raw payload and readable symmetrically | §3.1 | The census cannot read bytes off disk and must go through `r2000_read_region` (slower, contends on the mutex, still correct). Inferred from `synthesizeProject()`'s **writer** (`gzipSync(bytes).toString("base64")`, `r2000-project.ts:147`), not from a read-back test. **Raise to VERIFIED** by round-tripping one committed fixture |
| A4 | The RTS-trick window match (`LDA hi,X : PHA : LDA lo,X : PHA : RTS`) covers the idiom as it appears in real code | §3.2 | The widened scan misses dispatch tables; BUILD-04 inherits the gap. Variants (operand order, `TAX`/`TAY` interleaves, `JMP` instead of `RTS`) are likely. **Raise to VERIFIED** against a real fixture in Phase 21 |
| A5 | Adding an 8th CLI verb and a 7th skill breaks nothing beyond `check-npm-packages.mjs:235` | §3.8, §5.5 | Another pinned count fails late. Searched `scripts/`, `installer/`, `.claude-plugin/`, `src/mcp/vice/*.test.ts` and found only that one exact pin, but the search was pattern-based, not exhaustive |
| A6 | The `/tmp/regenerator2000-phase19` clone is present when the plan executes | §1, Environment | Every source citation in §1–§3 becomes unverifiable mid-execution. **`/tmp` is RAM in this environment and only empties on reboot** (project memory) — the plan should re-clone at a stable path, or fetch by the pinned SHA, as its first task |
| A7 | The three `.agent/skills` runtime-read sites and one soft cross-reference are the complete set | §1.4 | An absorbed file retains a runtime dependency. Found by `grep -nE '\.agent/skills\|subagent\|Task tool\|Skill('` across all five files; a differently-worded reference could hide |

---

## Open Questions

1. **Is SURF-03's acceptance bar "a route exists" or "a name is reported here"?**
   - What we know: no read-only route exists at 0.9.20 (HIGH, four proofs). The only oracle that can name a packer (`unp64`) is not installed. The finding can honestly report `packed`/`unpacked`/`unknown` today.
   - What's unclear: whether the phase closes with `verdict: "unknown"` on every fixture, or whether installing `unp64` is in scope.
   - Recommendation: **decide this explicitly in the plan, not at verification.** Cheapest satisfying answer: implement the finding with the oracle chain, live-gate the oracle branch, and record a dated decision that the *named* identity is unavailable through the pinned surface with §1.7's trigger 2 as the watch. If the user wants a name reported, installing `unp64` becomes an explicit prerequisite task.

2. **Should `r2000_toggle_splitter` and `r2000_set_immediate_format` be added in Phase 19 or Phase 20/21?**
   - What we know: both acquired criteria from this diff (DECOMP-01/BUILD-02 and BUILD-03). Both are mutating. Both are additive under SURF-01's precedent.
   - What's unclear: adding them here widens Phase 19; deferring them means Phase 20 opens with a surface change.
   - Recommendation: **propose in Phase 19 (a dated decision naming the requirement each serves), implement at the start of Phase 20.** Phase 19's job is the diff; acting on it is the next phase's. But the *decision* must be dated here so it is not "a consequence discovered at the next milestone close" — the exact failure ABS-04 exists to prevent.

3. **How is ABS-01's "five procedures absorbed" reconciled with FUT-01's deferral of BASIC decoding?**
   - Recommendation in §1.6: absorb all five as attributed text; mark `analyze-basic` as reference-only with its trigger phrases kept out of every `description:`. **The planner should lock this, not leave it implicit** — it is the difference between ABS-01 reading complete and reading fudged.

4. **Which dual-licence option does this project elect for the absorbed text?**
   - What we know: `MIT OR Apache-2.0`, at the user's option; this repo is MIT.
   - Recommendation: elect **MIT** (matches the repo, simplest notice) and say so explicitly in both the per-file header and the notices file. Note that Apache-2.0 §4(b)'s modification-notice obligation is satisfied anyway by the "ADAPTED, NOT VERBATIM" block, so electing MIT loses nothing and the header is honest under either.

5. **Does the coverage report get a stable machine-readable schema now, or later?**
   - Phase 20 runs the instrument "throughout this phase, not only once at the end" (ROADMAP §20 note), and Phase 21's hazard report reuses the widened scan.
   - Recommendation: define and pin the JSON schema in Phase 19, with a schema test — two downstream consumers already exist. Retrofitting a schema after Phase 20 has been reading it is the expensive order.

---

## Sources

### Primary (HIGH confidence — read or executed this session)

**Upstream at pin `493f840418f1450a342bb220c2fe3d2585dd0525` (`/tmp/regenerator2000-phase19`):**
- `.agent/skills/r2000-analyze-{basic,blocks,program,routine,symbol}/SKILL.md` — all five read; sha256 and byte counts computed; tool references extracted with this repo's own CI regex
- `crates/regenerator2000-core/src/mcp/handler.rs` — `:182-184` (get_binary_info schema), `:188` (get_blocks "Respects splitters"), `:798-826` (get_binary_info impl, 7 fields), `:826-900` (unpack_binary impl), `:1106-1160` (xref/symbols/comments dispatch), `:1636-1645` (`get_cross_references_impl`), `:1645-1695` (`set_immediate_format_impl`), `:1697-1788` (`get_symbols_impl`), `:1790-1870` (`get_comments_impl`)
- `crates/regenerator2000-core/src/mcp/stdio.rs` — `:67-98` (`run_headless_stdio_loop`, the serial loop)
- `crates/regenerator2000-core/src/packer_signatures.rs` — `:1-14` (`PackerInfo`, `detect_packer`)
- `crates/regenerator2000-core/src/unpacker.rs` — `:50-70` (`UnpackResult`), `:1035-1075` (`detect_packer` call site)
- `crates/regenerator2000-core/src/state/app_state.rs` — `:27-42` (`FileInfo`), `:295-345` (`file_info()`)
- `crates/regenerator2000-core/src/state/project.rs` — `:98-115` (`LoadedProjectData.detected_packer`)
- `crates/regenerator2000-core/src/state/file_io.rs` — `:140-175`, `:403`, `:550-590` (load paths; `save_project`)
- `crates/regenerator2000-core/src/state/types.rs` — `:314-331` (`BlockType`), `:333-345` (`Display`), `:353-358` (`LabelKind`), `:361-378` (`LabelType`), `:382-398` (`prefix()`)
- `crates/regenerator2000-core/src/analyzer.rs` — `:280`, `:445-540` (`follow_indirect_jumps`)
- `crates/regenerator2000-core/src/bin/unpacker_compare_all.rs` — `:6-8` (`UNP64`/`UNP64_PATH` convention), `:190` (`parse_unp64_entry`)
- `src/main.rs` — `:68`, `:375-400` (`run_headless_mcp`), `:709-711`, `:811`
- `crates/regenerator2000-core/Cargo.toml:5` (`license = "MIT OR Apache-2.0"`), `LICENSE-MIT:3`

**Installed crate (independent corroboration):**
- `~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/regenerator2000-0.9.20/.cargo_vcs_info.json` — sha1 == the pin
- `.../Cargo.toml.orig:28` (licence), `:31-42` (`exclude`, incl. `.agent/**/*`)
- `ls -a` of the crate root — no `.agent/`

**Live executions this session:**
- `regenerator2000 --help` — 13 options, none reports file info or packer
- `node src/mcp/vice/vice-proxy.ts` `tools/list` — 80 tools, 19 `r2000_*`
- `node src/mcp/vice/vice-proxy.ts` `tools/call r2000_get_binary_info` against `recon-subject.regen2000proj` — 7-field response, verbatim above
- `node scripts/check-skill-tool-coverage.mjs` — exit 0, full OK line captured
- `sha256sum` over the five upstream SKILL.md files
- Custom pipelined-request driver, 3 runs — the §6.2 serialisation measurement
- Custom description-overlap driver — the §4.3 baseline table
- `node --version` → v22.22.0; `command -v unp64 exomizer pucrunch` → all absent

**This repository:**
- `src/mcp/vice/r2000-tools.ts` (header + `CURATED_R2000_TOOLS` + `:438-449` get_binary_info definition)
- `src/mcp/vice/disasm-decoder.ts` (`:51-148` types + `decode()`)
- `src/mcp/vice/r2000-confidence.ts` (`:64-113` `CONFIDENCE_GRADES`)
- `src/mcp/vice/r2000-project.ts` (`:135-155` `synthesizeProject()`)
- `src/mcp/vice/r2000-cli.ts` (header; dispatch verbs), `r2000-launch.ts` (`:77` `FORBIDDEN_R2000_FLAGS`, arg builders)
- `src/mcp/vice/r2000-test-gate.ts` (the D-11 live gate pattern)
- `src/mcp/vice/r2000-answer-key.test.ts` (the sealed-key mechanism)
- `src/mcp/vice/r2000-upstream-audit.test.ts`, `.planning/phases/19-.../upstream-procedure-manifest.json`
- `src/mcp/vice/skill-honesty-checks.test.ts`, `scripts/lib/skill-honesty-checks.mjs`, `scripts/check-skill-fork-honesty.mjs`
- `scripts/check-skill-tool-coverage.mjs` (`:32`, `:49-51`, `:55`, `:85-112`, `:302`, `:377-381`, `:394-421`, `:446`, `:465-491`, `:509-520`)
- `scripts/lib/skill-corpus.mjs`, `scripts/lib/r2000-cli-verbs.mjs` (`:40`)
- `scripts/check-npm-packages.mjs` (`:13-26`, `:112-113`, `:213-225`, **`:235`**)
- `src/mcp/vice/ci-suite-coverage.test.ts` (header, `:167`)
- `src/mcp/vice/THIRD-PARTY-NOTICES.md`, root `THIRD-PARTY-NOTICES.md`, `installer/package.json`, `src/mcp/vice/package.json`
- All six `src/skills/*/SKILL.md` frontmatter
- `.planning/phases/18-.../18-STDIN-EOF-EVIDENCE.md`, `18-06-SUMMARY.md`, `18-CONTEXT.md` (D18-16)
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` §19, `.planning/STATE.md`, `./CLAUDE.md`, `.planning/config.json`

### Secondary (MEDIUM confidence)
- `src/mcp/vice/r2000-tools.ts`'s header narrative about D18-26/D-33 — first-party prose, load-bearing and self-consistent, but not independently re-derived this session beyond the parts checked above.

### Tertiary (LOW confidence)
- `unp64`'s stdout format for packer names (A1) — not installed, not observed. Inferred only from upstream's use of it as a comparison oracle.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|---|---|---|
| Upstream pin, paths, hashes, tool sets (Q1) | **HIGH** | Clone at pin + `sha256sum` + CI-identical regex + `.cargo_vcs_info.json` corroboration + `Cargo.toml.orig` exclude list. Manifest verified byte-exact. |
| Disposition justifications (Q1) | **HIGH** | Every justification quotes upstream's own text verbatim with a line number, or a requirement ID from `REQUIREMENTS.md`. |
| No read-only packer route (Q2, negative) | **HIGH** | Four independent proofs (handler `json!`, `UnpackResult`, non-serialisation, TUI-only consumer set) plus live `--help` and a live `tools/call`. |
| Packer bridge design (Q2, positive) | **MEDIUM** | The boundary and the oracle chain are sound; the `unp64` stdout parse is unverified (A1). Raise via E1. |
| Coverage data sources and enum values (Q3) | **HIGH** | Every enum, field name and prefix quoted verbatim from source at pin with line numbers, cross-checked against a live response. |
| Coverage algorithm and non-gameability (Q3) | **MEDIUM-HIGH** | The `follow_indirect_jumps` gap analysis is HIGH (source-read). The widened scan's completeness against real code is A4. |
| ABS-03 mechanism and threshold (Q4) | **HIGH** on the measured baseline and the reuse pattern; **MEDIUM** on `T = 0.35` (A2). |
| ABS-02 attribution facts and the false-claim finding (Q5) | **HIGH** | Licence string, copyright line, `files[]` contents, and the contradicted sentence all read verbatim. |
| stdio serialism (Q6) | **HIGH** | Source (`&mut AppState` synchronous call, no spawn) plus three live runs agreeing. Two independent methods. |
| CI/packaging constraints | **HIGH** for the four cited assertions (read + one executed); **MEDIUM** on exhaustiveness (A5). |

**Research date:** 2026-08-24
**Valid until:** the earlier of (a) the installed `regenerator2000` moving off 0.9.20, or (b) 2026-09-23. The upstream-source findings are pinned to a commit and do not decay; the *live* findings (installed version, curated tool count, `unp64` absence, CI green) are machine state and should be re-probed if the plan executes more than a few days out — as should A6's clone, since `/tmp` is RAM here.
