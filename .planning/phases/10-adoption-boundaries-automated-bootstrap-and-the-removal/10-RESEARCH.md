# Phase 10: Adoption Boundaries, Automated Bootstrap, and the Removal - Research

**Researched:** 2026-08-20
**Domain:** Rust CLI shell-out integration (regenerator2000, Tier 1), Node.js/TypeScript guard seams, skill-script deletion
**Confidence:** HIGH for verified environment/CLI facts and existing-code patterns; MEDIUM for the cross-package-boundary reachability design (flagged as an open question, not a locked decision)

<user_constraints>
## User Constraints (from CONTEXT.md)

**10-CONTEXT.md is unusually thorough for this phase** — it already contains live-evidence-backed decisions (D-01 through D-15) reached during `/gsd-discuss-phase`, several explicitly delegated to "Claude's call" and recorded as locked rather than left open. This research does not re-litigate any of them; it verifies the current repo state each decision will be applied against, and answers the items CONTEXT.md itself flagged as "genuinely open for research."

### Locked Decisions

**Bootstrap mechanism (criterion 3 — R2000-09):**
- **D-01: the bootstrap synthesises the `.regen2000proj` file directly in Node — it does not drive the TUI.** `ProjectState` (`regenerator2000-core-0.9.20/src/state/project.rs:41-96`) has exactly three fields without `#[serde(default)]`: `origin`, `raw_data_base64`, `blocks`. The project file is plain JSON; only `raw_data_base64` is gzip-then-base64. A ~15-line Node function producing `{origin, raw_data_base64: gzip(body), blocks: [], settings: {...}}` was loaded by `regenerator2000 --headless --export_asm out.a --assembler acme`, auto-analysed, and exported all six illegal opcodes correctly. A full 64K image round-tripped in 0.12s. Chosen over the probed keystroke route because that route costs `tmux` as a new declared prerequisite AND still needs a JSON post-edit for `use_illegal_opcodes` — synthesis removes the pty, the modal, the keystroke encoding, the terminal-size assumption, and the post-edit in one move.
- **D-02: `.d64` is first-class input; the file inside it is named explicitly or the bootstrap fails loudly.** No silent auto-pick of a directory entry — with no name given, print the directory listing and exit non-zero.
- **D-03: input set is `.prg`, `.d64` (named entry), and flat 64K `.raw`. `.vsf` is dropped from this phase.** `.prg`/`.d64` are the user's explicit words; flat 64K is kept because `R2000-06` names it and it is what `c64-ram-capture` already produces. `.vsf` is dropped because D-01 never hands r2000 a container format at all, and parsing VICE snapshots ourselves is new work whose only payoff (machine-type/start-address auto-detection) Phase 9 proved unreliable for machine-type anyway. **Planner must reconcile wording:** ROADMAP.md criterion 3 says "a `.prg` or a `.vsf`" and the milestone's standing constraint says "prefer `.vsf` over `.raw`" — both are superseded here; amend criterion-3 wording and mark the `.vsf` preference as not applying to Phase 10.
- **D-04: version tolerance comes from minimality plus a self-check, never a version pin.** Write only the three required fields plus deliberately-forced settings; every other field defaults, so the file is forward-compatible by construction. Prove it loaded by running r2000 once and checking the result. No `--version` allow-list, no known-good range.
- **D-05 (Claude's call): every generated project forces `use_illegal_opcodes: true` and an explicit `system`, pinned by a test.** No flag, no knob. A flag can be added later if a non-C64 target appears — not this milestone.

**Adoption boundaries (criteria 1-2 — R2000-01, R2000-02):**
- **D-06 (Claude's call): the guarded launch seam is a module under `.claude/mcp/vice/`, with a thin skill-side entry point for CLI ergonomics.** Decided because `hostpath-consumers.test.ts` enumerates only top-level modules of `.claude/mcp/vice/` and CI runs `npm test` only inside that directory — no skill-side `*.test.mjs` runs in CI today. A guard test in a skill script would be green-by-absence. Phase 11 puts the `r2000_*` MCP surface in that same directory anyway. **Open for research (see Open Questions below):** exactly how the skill-side entry reaches the seam across the package boundary once `@henols/vice-mcp` is an installed dependency rather than a sibling directory.
- **D-07: `--vice` is unreachable by construction, *and* denied by a scan — both, pinned.** No caller-supplied argv passthrough — argv is built only by fixed per-verb builders. On top, the final argv is scanned for `--vice` immediately before spawn and the launch throws a named error if present, mirroring `vice.ts`'s `DENY_LIST`/`denyListRefusalMessage()`. Never strip the flag silently.
- **D-08: criterion 2's no-translation absence is asserted by extending `hostpath-consumers.test.ts`'s closed consumer set**, adding the r2000 module to the "must be absent" side — the mirror of `DERIV-07`. Do not write a new bespoke test file for this.

**The reassembly proof (criterion 4 — R2000-06):**
- **D-09 (user): lean on regenerator2000's own `--verify`** rather than an independent export-assemble-diff harness. On the synthesised fixture it reported `✓ ACME — byte-identical (44 bytes)` (and ca65 likewise). The caveat (this is r2000 checking its own export) was put to the user and they chose it anyway.
- **D-10: the check keys on the parsed ACME result line, never on the exit code.** Proven live: with ACME absent and ca65 present, `--verify` prints `✗ ACME — ACME not found in PATH (skipped)` followed by `✓ All roundtrip verifications passed.` and **exits 0** — a false pass. Assert the ACME line is `✓` and fail on `skipped`.
- **D-11 (Claude's call): CI does not install regenerator2000.** Named SKIP when r2000 is absent, hard FAIL under `VICE_REQUIRE_R2000` — mirroring `disasm-roundtrip.test.ts`'s `VICE_REQUIRE_ACME` pattern including its "exactly one test always runs, never skipped" availability gate. `cargo install regenerator2000` measured 4m48s-5m39s and needs rustc ≥ 1.90; a 5-minute Rust build on every merge contradicts "cheapest by far".

**The removal (criterion 4 — R2000-05):**
- **D-12 (Claude's call): one implementation, one entry point, verb deleted, no new skill.** `cmdDisasm()` (`.claude/skills/acme-build/scripts/acme.mjs:208-223`) is deleted outright with its dispatch entry and usage line. `acme-build/SKILL.md`'s `## Disassembly` section, `toacme`-on-PATH prerequisite, and the `disasm` synopsis line go with it. `acme.mjs` keeps its stated "assembling only" scope. **No 7th skill** — a new skill costs installer sync, plugin manifest, and `check-skill-tool-coverage.mjs`, and would pre-build Phase 11's home during Phase 10. The replacement route is documented from the skills that need it (`acme-build`, and `c64-program-recon` where static analysis belongs) — both pointing at the single seam from D-06.

**Install story (criterion 5 — R2000-03):**
- **D-13: the CI honesty guard must be inverted, not worked around.** `scripts/check-skill-fork-honesty.mjs:253` currently lists `["regenerator2000", "D-B: ... must stay regenerator2000-free"]` in `FORBIDDEN_README_SUBSTRINGS`. Criterion 5 requires the name **in** README.md. Move it to `REQUIRED_README_SUBSTRINGS` with a `whatIsLost` string, and update the file's header comment (line 14, "the regenerator2000 name Phase 8 removed").
- **D-14: the license is `MIT OR Apache-2.0` (dual), and the notices must say the true thing.** Both `LICENSE-MIT` and `LICENSE-APACHE` ship in the crate. `.planning/notes/regenerator2000-integration.md:253` and `REQUIREMENTS.md`'s `R2000-03` wording still say Apache-2.0 only — correct the requirement text and the note as well as writing the notice.
- **D-15: the documented facts are the measured ones, not the estimated ones.** No upstream release assets exist. Toolchain floor is rustc **≥ 1.90** (verified; both `≥1.85` and `≥1.88` readings undercounted it). Container cost: single-stage ~1.26 GB (build 5m39s), multi-stage ~251 MB (build 4m48s), both absolute with no baseline to diff. The one-project-per-namespace limit is **stated, not detected**. Apache-2.0 **and** MIT notice, in `.claude/mcp/vice/THIRD-PARTY-NOTICES.md` (canonical; root file is a 4-line pointer).

### Claude's Discretion

Delegated by the user, recorded as decisions rather than left open (do not re-litigate): **D-01** (bootstrap mechanism), **D-05** (forced settings), **D-06** (seam location), **D-12** (replacement surface). **D-11** (CI does not install r2000) follows from the `--verify` choice.

Still genuinely open for research (not decided): how the skill-side entry point reaches the D-06 seam across the package boundary; whether `.d64` extraction extends `d64-parse.mjs` in place or lands beside the seam; exact CLI verb names for the new route. **This research's Open Questions section below addresses all three.**

### Folded Todos (in scope for this phase)

1. **Second-binmon-client-as-wedge-lookalike** (`resolves_phase: 10`). Item 3 *is* criterion 1, satisfied by D-07. Items 1-2 land beside criterion 5's doc work: add "another client already holds the binary monitor" to `vice-wedge-triage/SKILL.md`'s diagnosis table, and state the one-holder rule positively in install docs.
2. **acme-build scaffold library missing on both provisioning routes** (priority high). `template.a` `!source`s a `cbm/c64/*.a` library neither documented ACME route supplies. Fits this phase because criterion 4 already edits `acme-build/SKILL.md` and depends on a real ACME being usable; also make CI actually assemble the scaffold instead of probing the binary.

### Deferred Ideas (OUT OF SCOPE for Phase 10)

- `.vsf` as a bootstrap input → Phase 11's `c64-ram-capture` extension (`R2000-14`/`R2000-15`).
- `--mcp-server-stdio` instead of HTTP for Phase 11 — sidesteps the fixed-port collision behind the one-project limit; Phase 11 should evaluate before building against HTTP.
- The `r2000_get_address_details` u16 overflow (`handler.rs:1894`) — upstream report / Phase 11 workaround.
- Non-ACME export formats (`64tass`, `ca65`, `kick`) — not scope.
- Two-project-limit detection — permanently out (`R2000-04` fold).
- `2026-08-20-fully-remove-the-forked-vice-mcp-backend.md` — semver-major, not this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R2000-01 | regenerator2000 never launched with `--vice`, enforced in code and tested | `vice.ts` `DENY_LIST`/`denyListRefusalMessage()` pattern verified at lines 201-243, 693-699 (Architecture Patterns, Code Examples). Confirmed live: `regenerator2000 --help` really does expose `--vice <HOST:PORT>` — the exact flag D-07 must make unreachable. |
| R2000-02 | No path translation applies to any r2000 argument, asserted as an absence | `hostpath-consumers.test.ts` structure verified in full (Architecture Patterns) — its existing "absent from consumer set" test pattern (for `disasm-*.ts` etc.) is the literal template for D-08's new assertion. |
| R2000-03 | regenerator2000 declared prerequisite alongside VICE; toolchain cost + one-project limit stated; Apache-2.0 notice in THIRD-PARTY-NOTICES.md | README.md structure, `check-skill-fork-honesty.mjs` REQUIRED/FORBIDDEN substring gate, and `.claude/mcp/vice/THIRD-PARTY-NOTICES.md`'s existing notice format all verified (Architecture Patterns, Code Examples). Corrected to dual MIT/Apache-2.0 per D-14. |
| R2000-09 | `.prg`/`.d64`/flat-64K bootstrap to `.regen2000proj` without a human | regenerator2000 0.9.20 `--help` output verified live (Standard Stack) confirms `--headless`, `--verify`, `--export_asm`/`--export_lbl`/`--import_lbl`, `--assembler`, `--mcp-server[-stdio]` all exist as documented in CONTEXT.md's D-01 evidence. `d64-parse.mjs`'s exports verified (no file-extraction function yet — a real gap, see Open Questions). |
| R2000-05 | `acme-build`'s `disasm` verb + `toacme` prerequisite removed | `cmdDisasm()` and all SKILL.md caveat text verified byte-for-byte (Code Examples, Don't Hand-Roll). Full blast-radius grep performed (Common Pitfalls / Deletion Blast Radius). |
| R2000-06 | `.prg`/flat-64K reassembles under `!cpu 6510`, verified by running a real assembler | `--verify`'s exact output shape (including the ACME-skipped-but-exit-0 trap) already captured in D-09/D-10; `disasm-roundtrip.test.ts`'s **unrelated** Phase-4 pattern (SKIP_REASON/VICE_REQUIRE_ACME) verified as the structural template for the new gate — **not the same file, must not be edited for this purpose** (see Common Pitfalls). |
</phase_requirements>

## Summary

This phase is unusual: `/gsd-discuss-phase` already produced a CONTEXT.md with live-evidence-backed implementation decisions (D-01 through D-15) rather than open alternatives, because the user delegated every mechanism question ("not sure it's your job to figure that out... you decide") and the deciding agent ran real commands against a real, already-installed `regenerator2000 0.9.20` to settle them. This research's job is therefore narrower than usual: verify the current repo state each decision will land against, resolve the small number of items CONTEXT.md itself left open, and surface anything a planner needs that a discussion transcript would not capture (exact line ranges, exact CLI `--help` output, exact test-file shapes, and one real architectural gap in the "thin skill-side entry point" idea).

Everything CONTEXT.md's D-01 assumed about regenerator2000's CLI surface was independently re-verified live on this host: `regenerator2000 0.9.20` is installed at `~/.cargo/bin/regenerator2000`, and `--help` confirms every flag the decisions depend on — `--headless`, `--verify` (not `--verify-roundtrip`, already corrected in Phase 9), `--export_asm`/`--export_lbl`/`--import_lbl`/`--export_html`, `--assembler <NAME>`, `--mcp-server`/`--mcp-server-stdio`, `--dump-enum-files`, and, critically, `--vice <HOST:PORT>` — the exact flag R2000-01 forbids, confirmed to genuinely exist as a live CLI option, not a hypothetical. `tmux`, `acme` (0.97 "Zem"), `rustc`/`cargo` 1.97.1, and Node 22.22.0 are all present, so nothing in this phase is blocked by environment.

The one genuinely open architectural question this research resolves with a recommendation rather than a locked fact: how does a skill-side `.mjs` script reach the D-06 seam (a module under `.claude/mcp/vice/`) once `@henols/vice-mcp` is consumed as a published npm dependency rather than a sibling checkout directory? Tracing all three install routes (Claude Code plugin, npm installer default, npm installer `--vendor`) shows that `.claude/mcp/vice/*.ts` source files are **not present as plain files on disk in the default npm-installer route at all** — the server is launched purely via `npx -y @henols/vice-mcp@<version>`, which resolves into a temporary npx cache, not a project-relative path. The one thing guaranteed reachable identically across all three routes is the already-published `vice-mcp` bin entry itself. The lowest-risk answer, consistent with the `probe-binmon.mjs`/`smoke.mjs` precedent CONTEXT.md points at, is an argv-subcommand dispatch inside the existing bin (`vice-proxy.ts` or a thin wrapper it imports) rather than a second bin name or a cross-package relative import — detailed in Open Questions below, flagged as a recommendation for the planner to confirm, not a locked decision.

**Primary recommendation:** implement D-06's seam as a new module (or small module family) under `.claude/mcp/vice/`, following the `vice.ts` `DENY_LIST` pattern for the `--vice` guard (D-07) and the `hostpath-consumers.test.ts` "absent from consumer set" pattern for the no-translation proof (D-08); implement D-11's `--verify` gate as a **new, separate** test file (not `disasm-roundtrip.test.ts`, which is Phase 4's unrelated stock-disassembler round-trip test) mirroring only its SKIP/FAIL-gate *shape*; reach the seam from the skill side via an argv-subcommand on the existing `vice-mcp` bin rather than a cross-package file import.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `--vice` guard / argv construction (R2000-01) | Container-side CLI shell-out module (`.claude/mcp/vice/`) | Skill-side thin wrapper (CLI ergonomics only) | This is Tier 1 per ROADMAP: no MCP tool, no lifecycle. The guard must live where the closed-consumer-set test machinery already runs in CI (D-06's own deciding fact), not in the skill layer where nothing is tested in CI today. |
| No host-path translation (R2000-02) | Container-side CLI shell-out module | — | `hostpath.ts`/`containerpath.ts` never touch this module by construction; the absence is what D-08 asserts. Running container-side (D-R4) is what makes devcontainer + two-simultaneous-projects work with no upstream patch. |
| `.regen2000proj` synthesis (R2000-09) | Container-side CLI shell-out module (pure Node transform: gzip + base64 + JSON) | — | No filesystem/network/emulator dependency — pure data transform, belongs beside the guard module, not in a skill script (same D-06 test-reachability argument). |
| `.d64` directory-entry extraction (R2000-09, D-02) | Skill layer (`c64-ram-capture/scripts/d64-parse.mjs` or a sibling) | — | `d64-parse.mjs` already owns BAM/directory parsing and is skill-scoped, offline, emulator-independent — the natural home for "follow this entry's sector chain and return its bytes," a pure-data operation with no MCP/container concern. |
| ACME reassembly gate (R2000-06) | Container-side CLI shell-out module's test suite (`.claude/mcp/vice/*.test.ts`) | — | Only `.claude/mcp/vice/` tests run in CI (`npm test` scope); a skill-side test would be green-by-absence exactly as D-06 found for the guard tests. |
| Verb deletion (R2000-05) | Skill layer (`acme-build/scripts/acme.mjs`, `acme-build/SKILL.md`) | — | Pure removal of skill-local code and docs; no MCP/container surface involved. |
| Install documentation (R2000-03) | Documentation (README.md, THIRD-PARTY-NOTICES.md, check-skill-fork-honesty.mjs) | — | No runtime tier — a CI-enforced documentation-honesty concern. |

## Standard Stack

### Core

| Tool | Version (verified live) | Purpose | Why standard here |
|------|---------|---------|--------------|
| `regenerator2000` | `0.9.20` [VERIFIED: installed at `~/.cargo/bin/regenerator2000`, confirmed via `regenerator2000 --version` and `cargo install --list` on this host] | Static-analysis backend: disassemble, auto-analyse, export ACME source/labels, self-verify roundtrip | Adopted per `.planning/notes/regenerator2000-integration.md` (D-R1..D-R4) and Phase 9's `pass`/`degrade` verdict; this is the one Tier-1 (CLI shell-out) slice of that adoption |
| `tmux` | `3.5a` [VERIFIED: `tmux -V` on this host] | Not used by D-01's synthesis route at all — kept only as a fact-check that the *previously probed* keystroke route remains available if ever needed again; **not a new prerequisite Phase 10 introduces** | D-01 deliberately avoids adding tmux as a declared prerequisite |
| ACME | `0.97 "Zem"` [VERIFIED: `acme --version` on this host, matches `acme-build`'s existing "Verified live" claim] | The one assembler this project's `!cpu 6510` route cares about; `--verify`'s ACME line is what D-10 keys on | Already the project's sole assembler dependency (Phase 4 `disasm-roundtrip.test.ts`, `acme-build` skill) |
| Rust toolchain (`rustc`/`cargo`) | `1.97.1` installed [VERIFIED live]; **floor is `>= 1.90`** per Phase 9's corrected finding (`docs/phase9-regenerator2000-probe-findings.md` Corrections #1) | Only needed to `cargo install regenerator2000` — a host/CI prerequisite, not a project dependency | D-15's install-story facts must state `>= 1.90`, not the superseded `>= 1.85`/`>= 1.88` readings |
| Node.js | `v22.22.0` [VERIFIED live] | Runs the `.claude/mcp/vice/` seam module (native TS type-stripping, no build step) and the skill-side `.mjs` scripts | Existing project runtime; no version change needed for this phase |

**No new npm runtime dependency is added by this phase.** `@henols/vice-mcp`'s `dependencies` stay exactly `@mastra/mcp` + `@mastra/core` (checked mechanically by `scripts/check-npm-packages.mjs`'s dependency-set assertion — see Common Pitfalls). regenerator2000 is consumed exclusively as an external CLI binary via `spawnSync`/`spawn`, the same shape `acme.mjs` already uses for `acme`/`toacme`.

**regenerator2000 `--help`, verified live on this host (`regenerator2000 0.9.20`):**
```
Usage: regenerator2000 [OPTIONS] [FILE]

Arguments:
  [FILE]  File to load (.prg, .crt, .t64, .d64, .d71, .d81, .vsf, .dis65, .bin, .raw, .regen2000proj)

Options:
      --import_lbl <PATH>       Import VICE labels from the specified file
      --export_lbl <PATH>       Export labels to the specified file (after analysis/import)
      --export_asm <PATH>       Export assembly to the specified file (after analysis/import)
      --export_html <PATH>      Export HTML to the specified file (after analysis/import)
      --assembler <NAME>        Override assembler format (64tass, acme, ca65, kick)
      --headless                Run in headless mode (no TUI, only .regen2000proj files supported)
      --verify                  Verify export roundtrip (export -> assemble -> diff). Implies --headless
      --mcp-server               Run MCP server (HTTP port 3000)
      --mcp-server-stdio         Run MCP server (stdio, headless)
      --vice <HOST:PORT>        Auto-connect to VICE binary monitor at HOST:PORT (e.g. localhost:6502)
      --dump-system-config-files <PATH>
      --dump-theme-files <PATH>
      --dump-enum-files <PATH>
  -h, --help
  -V, --version
```
[VERIFIED: live `regenerator2000 --help` output on this host, 2026-08-20] — this confirms every flag CONTEXT.md's D-01/D-09/D-10/D-11 depend on actually exists, spelled exactly as those decisions assume, **and** confirms `--vice <HOST:PORT>` is a real, live option — the flag R2000-01/D-07 must make structurally unreachable.

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| D-01's Node-side JSON synthesis | The keystroke/pty Save-As bootstrap Phase 9 proved | Already rejected in CONTEXT.md (D-01) — costs `tmux` as a new prerequisite and still needs a post-bootstrap JSON edit for `use_illegal_opcodes`. Not revisited here. |
| D-09's reliance on r2000's own `--verify` | A hand-rolled export→assemble→byte-diff harness | Already decided by the user (D-09) with the internal-check caveat explicitly raised and accepted. Not revisited here. |

## Package Legitimacy Audit

**Not applicable in the npm-package sense** — this phase adds no new npm runtime or dev dependency (verified: `@henols/vice-mcp`'s `dependencies` stay `@mastra/mcp`+`@mastra/core`; no `package.json` change to either published package's dependency list is implied by any of D-01 through D-15).

regenerator2000 itself is a Rust crate consumed as an **external CLI binary**, not an npm/PyPI/crates.io dependency of this project's own build. It was already put through registry/provenance verification in Phase 9, source-read (not merely `npm view`-style trust): crates.io API confirmed publisher `ricardoquesada` (matching the linked GitHub repo owner), version `0.9.20` published 2026-07-11, license `MIT OR Apache-2.0` (`docs/phase9-regenerator2000-probe-findings.md`, "Build tested" table). That verification stands; this phase does not re-run it. `slopcheck`/registry-verification of an installed system CLI binary (as opposed to a package this project's manifest declares) is out of scope for the Package Legitimacy Gate as written — flagging this explicitly rather than silently skipping it.

**Disposition:** No packages to audit. The planner does not need a `checkpoint:human-verify` gate for a *new* package install — regenerator2000 is already installed on this development host, and D-11 explicitly keeps it out of CI. Any planner task that assumes a **different** host (e.g. a fresh devcontainer, per criterion 2's "a devcontainer run works with no upstream patch" requirement) must still gate the actual `cargo install regenerator2000` step behind human awareness of the ~5-minute / ~250MB-1.26GB cost D-15 names — that is a cost-disclosure gate, not a legitimacy gate.

## Architecture Patterns

### System Architecture Diagram

```text
                         Skill layer (untouched container filesystem)
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  acme-build/scripts/acme.mjs          c64-program-recon/SKILL.md        │
  │  (disasm verb DELETED — D-12)          (points at new route — D-12)     │
  │             │                                    │                      │
  │             └───────────────┬────────────────────┘                     │
  │                              ▼                                          │
  │                   thin CLI entry point                                 │
  │           (D-06 — reachability mechanism: OPEN, see below)             │
  └──────────────────────────────┼───────────────────────────────────────────┘
                                 ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │           .claude/mcp/vice/  — the D-06 guarded seam module            │
  │                                                                          │
  │   1. .prg/.d64/.raw  ──▶  synthesise .regen2000proj  (D-01, pure Node)  │
  │        (.d64 needs a named directory entry — D-02, fails loudly         │
  │         with a listing if none given)                                  │
  │                                                                          │
  │   2. fixed per-verb argv builders (NO caller passthrough — D-07)       │
  │        └─▶ scan final argv for "--vice" ─▶ throw if present (D-07)     │
  │        └─▶ NEVER imports hostpath.ts/containerpath.ts (D-08,          │
  │             asserted as an absence in hostpath-consumers.test.ts)      │
  │                                                                          │
  │   3. spawnSync/spawn regenerator2000 --headless ...  (Tier 1, no       │
  │        lifecycle, no port, argv array never a shell string)            │
  │        └─▶ --verify path: parse ACME result line, fail on "skipped"    │
  │             not on exit code (D-10)                                    │
  └─────────────────────────────────────────────────────────────────────────┘
                                 ▼
                    regenerator2000 0.9.20 (external binary,
                    container-side, same side as the MCP proxy — D-R4)
```

A reader can trace the primary bootstrap use case end to end: a skill calls the thin entry point with a raw binary path → the seam module synthesises a project file in-process (no TUI, no pty) → builds a fixed argv (no `--vice` ever reachable) → spawns `regenerator2000 --headless` → for the reassembly proof, re-parses the structured `--verify` output rather than trusting its exit code.

### Recommended Project Structure

```
.claude/mcp/vice/
├── r2000-launch.ts          # NEW (D-06): fixed argv builders per verb, --vice
│                             # scan-and-throw (D-07 mirror of vice.ts's DENY_LIST),
│                             # spawnSync wrapper. Deliberately imports NOTHING
│                             # from hostpath.ts/containerpath.ts.
├── r2000-project.ts         # NEW (D-01/D-04/D-05): pure synthesise(bytes, origin,
│                             # system) -> Buffer (gzip+base64+JSON), no I/O.
├── r2000-launch.test.ts     # NEW: --vice unreachable-by-construction AND
│                             # denied-by-scan, both asserted (criterion 1).
├── r2000-verify.test.ts     # NEW (D-11): mirrors disasm-roundtrip.test.ts's
│                             # SKIP/VICE_REQUIRE_R2000 *shape* only — separate
│                             # file, does not touch or import that file.
├── hostpath-consumers.test.ts   # EXTENDED (D-08): add r2000-launch.ts /
│                             # r2000-project.ts to the "must be absent from
│                             # the hostpath.ts consumer set" tests, alongside
│                             # the existing disasm-*.ts / stock-*.ts entries.
└── package.json             # files[] EXTENDED with the two new modules if
                              # vice-proxy.ts's import closure reaches them
                              # (see Common Pitfalls — check-npm-packages.mjs).

.claude/skills/acme-build/
├── scripts/acme.mjs          # cmdDisasm() DELETED (D-12), dispatch + usage
│                             # line removed. Scope comment ("wraps acme and
│                             # toacme") becomes ("wraps acme") — one binary.
└── SKILL.md                  # ## Disassembly section, disasm synopsis line,
                              # toacme-on-PATH prerequisite line all DELETED;
                              # replaced by a short pointer to the new route.

.claude/skills/c64-program-recon/
└── SKILL.md                  # NEW pointer to the same D-06 seam/entry point
                              # (D-12: no duplicated copy of the route).
```

### Pattern 1: Deny-by-construction plus deny-by-scan (D-07, R2000-01)

**What:** Two independent enforcement layers for a permanently forbidden CLI flag: (a) the argv is only ever built by fixed per-verb functions that never accept caller-supplied flags, and (b) the fully-built argv array is scanned for the forbidden string immediately before spawn and throws if found.

**When to use:** Exactly `vice.ts`'s own precedent for `DENY_LIST` — a hazard where a single missed refactor (e.g. someone later adds a generic "extra args" passthrough for convenience) would silently reintroduce the hazard if only construction-time discipline existed.

**Example — the existing precedent to mirror** (verified from `.claude/mcp/vice/vice.ts`):
```typescript
// Source: .claude/mcp/vice/vice.ts:201-243, 693-699 (read live, 2026-08-20)
export const DENY_LIST: readonly string[] = [
  "vice_disk_list",
  "tools_list",
  "tools_call",
  "initialize",
  "notifications_initialized",
];

export function denyListRefusalMessage(toolName: string): string {
  if (toolName === "vice_disk_list") {
    return `${toolName} is permanently forbidden -- ...`;
  }
  return `${toolName} is permanently forbidden -- it is a generic-surface meta-tool ...`;
}

// call()'s guard -- first line of the function body, deliberately, so the
// deny list is enforced even if a future edit reorders the rest:
if (DENY_LIST.includes(toolName)) {
  throw new ViceError(denyListRefusalMessage(toolName));
}
```
The D-07 analog scans a `string[]` argv (not a tool name) for `--vice` (case-sensitive, exact token match — not a substring match against the whole command line, to avoid a false positive on a filename that happens to contain the substring) and throws a named error (e.g. `R2000ViceFlagError`) before `spawnSync`/`spawn` is called.

### Pattern 2: Closed consumer set as an absence proof (D-08, R2000-02)

**What:** `hostpath-consumers.test.ts` already implements exactly the mechanism D-08 needs — walking `.claude/mcp/vice/`'s top-level modules, matching real `import ... from "./hostpath.ts"` statements (comment-stripped, never a raw substring match), and asserting both a **positive** closed set (`EXPECTED_IMPORTERS`, currently 5 modules) and multiple **negative** sets (module families that must never import it).

**When to use:** Any time a phase needs to assert an absence structurally rather than by convention — this is D-08's literal instruction ("do not write a new bespoke test... the closed-consumer-set mechanism already exists and already runs in CI").

**Example — the exact negative-assertion shape to extend** (verified from `.claude/mcp/vice/hostpath-consumers.test.ts`):
```typescript
// Source: .claude/mcp/vice/hostpath-consumers.test.ts (read live, 2026-08-20)
const EXPECTED_IMPORTERS = ["containerpath.ts", "install-resources.ts", "stock-paths.ts", "vice-proxy.ts", "vice-sync.ts"];

test("the disassembler modules (not yet reachable from stock-dispatch.ts in this wave) are absent from the consumer set", () => {
  const importers = hostpathImporters();
  for (const name of [
    "stock-disassemble.ts", "disasm-opcodes.ts", "disasm-decoder.ts", "disasm-renderer.ts",
    "stock-memory-search.ts", "stock-symbols.ts", "stock-vicii.ts", "stock-cia.ts", "stock-sprites.ts",
  ]) {
    assert.equal(importers.includes(name), false, `${name} must not import hostpath.ts, whether or not it exists yet`);
  }
});
```
D-08's new test is a sibling assertion in this same file, naming `r2000-launch.ts`/`r2000-project.ts` (or whatever the seam module is actually called) in an identical `assert.equal(importers.includes(name), false, ...)` list. **`EXPECTED_IMPORTERS` (the positive/must-import set) is not touched** — the r2000 module must never import `hostpath.ts`, so it belongs only on the negative side, never added to the 5-element positive array.

### Pattern 3: Availability-gated, never-silently-skipped CI proof (D-11, R2000-06)

**What:** `disasm-roundtrip.test.ts` (Phase 4's stock-disassembler round-trip test — **unrelated** to acme-build's `disasm` verb, see Common Pitfalls) already implements the exact shape D-11 needs: `SKIP_REASON` computed once at module scope from a live probe, every dependent test skipped via `node:test`'s own `{ skip }` option (never a hand-rolled early return), and exactly one "availability gate" test that always runs and turns a missing dependency into a hard FAIL only when an env var (`VICE_REQUIRE_ACME`) is set.

**Example — the pattern to mirror in a NEW file** (verified from `.claude/mcp/vice/disasm-roundtrip.test.ts`):
```typescript
// Source: .claude/mcp/vice/disasm-roundtrip.test.ts (read live, 2026-08-20)
const SKIP_REASON: string | false = ACME_AVAILABLE
  ? false
  : `... no real ACME cross-assembler was found ... CI's build job installs it ...`;

test("ACME availability gate (D-08)", () => {
  if (process.env.VICE_REQUIRE_ACME) {
    assert.ok(ACME_AVAILABLE, `VICE_REQUIRE_ACME is set but no real ACME was found ...`);
  }
});
```
D-11's new test file (e.g. `r2000-verify.test.ts`) reuses this *shape* with `R2000_AVAILABLE`/`VICE_REQUIRE_R2000`, and — because D-11 says CI never sets `VICE_REQUIRE_R2000` — the availability-gate test will simply pass trivially in CI forever (the `if` body never executes there), while still running unconditionally locally and failing hard for any future maintainer who does set the env var without regenerator2000 present.

### Anti-Patterns to Avoid

- **Editing `disasm-roundtrip.test.ts` to add the r2000 `--verify` check.** That file is Phase 4's stock-disassembler byte-exact round-trip test (`stock-disassemble.ts`/`vice_disassemble`), a **standing-constraint-protected** asset ("Phase 4's disassembler stays... All ~61KB of source and ~55KB of tests are load-bearing" — ROADMAP.md Standing Constraints). It shares only a naming coincidence ("disasm") with the verb this phase deletes. Create a new file.
- **Adding the r2000 seam module to `EXPECTED_IMPORTERS`.** That array is the *positive* closed set of modules that DO import `hostpath.ts`. The r2000 module belongs only in a *negative* absence assertion.
- **Trusting `--verify`'s exit code alone.** D-10's own live finding: exit 0 is produced even when ACME was skipped (not found) and only ca65 ran. Must parse the per-assembler result lines.
- **A hand-rolled `if (!available) return` for the CI gate.** Reports a false PASS, not a SKIP — explicitly named as forbidden in both D-11 and the existing `disasm-roundtrip.test.ts` header comment.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Disassembly with recursive-descent + auto-analysis | A better `toacme` wrapper, or a second in-house disassembler | regenerator2000's `--headless --export_asm --assembler acme` | This is the entire thesis of the milestone; the caveats `toacme`'s flat linear decode imposed (out-of-range labels, illegal-opcode re-indentation, `.dis.a`→`.dis.asm` workaround) are structural to a linear decoder, not fixable by wrapper code |
| Export-roundtrip verification | A custom export→assemble→byte-diff harness | regenerator2000's own `--verify` | D-09's explicit user decision; already spawns a real assembler and diffs |
| `.regen2000proj` version compatibility | A version allow-list / `--version` gate | Minimal-field-only synthesis (D-04) relying on `#[serde(default)]` | A version gate detects a version *change*, not an actual schema break, and blocks users on a newer, working build |
| `--vice` flag suppression | Stripping the flag silently if a caller somehow supplies it | Throw a named error (D-07) | A silent strip hides the very bug class this guard exists to prevent — the caller (or a future refactor) never learns it happened |

**Key insight:** every "don't hand-roll" item in this phase already has an existing, tested precedent in this codebase (`DENY_LIST`, `hostpath-consumers.test.ts`, `disasm-roundtrip.test.ts`'s gate shape) — the work is disciplined reuse of those seams, not new mechanism design, except for the one genuinely new piece: the `.regen2000proj` synthesis function itself (D-01), which has no in-repo precedent and must be written from the `ProjectState` field analysis CONTEXT.md already performed.

## Common Pitfalls

### Pitfall 1: Confusing the two "disasm" surfaces
**What goes wrong:** `disasm-roundtrip.test.ts` (Phase 4, stock in-process disassembler round-trip test) and `acme-build`'s `disasm` verb (`cmdDisasm()` in `acme.mjs`, wraps `toacme`, deleted by this phase) share a name fragment but are otherwise unrelated systems — one is a live-RAM disassembler behind `vice_disassemble`, kept forever per the ROADMAP's standing constraint; the other is a file-based `toacme` wrapper, deleted by R2000-05.
**Why it happens:** both this phase's own CONTEXT.md and the ROADMAP describe D-11 as mirroring "disasm-roundtrip.test.ts's own pattern" for the new `--verify` gate, which reads, on a skim, like an instruction to edit that file.
**How to avoid:** create a new test file for the r2000 `--verify` gate; only borrow the SKIP/FAIL-gate *shape*, never the file itself.
**Warning signs:** a diff touching `disasm-roundtrip.test.ts`, `disasm-opcodes.ts`, `disasm-decoder.ts`, or `disasm-renderer.ts` in a Phase 10 plan is almost certainly a scope error — none of them are named by any of R2000-01/02/03/09/05/06.

### Pitfall 2: `check-npm-packages.mjs`'s transitive-closure walk
**What goes wrong:** if the skill-side entry point resolves via importing the new seam module and `vice-proxy.ts`'s own import closure reaches it (directly or transitively), the new module **must** be added to `.claude/mcp/vice/package.json`'s `files[]` array — verified live: that file lists every top-level module explicitly (no glob), and `scripts/check-npm-packages.mjs` runs "a transitive-closure walk from vice-proxy.ts's own relative imports" asserting every reachable local module is either an exact `files[]` entry or lives under a directory entry.
**Why it happens:** it's easy to add a new `.ts` file under `.claude/mcp/vice/` and forget the packaging manifest, since Node's type-stripping runs it fine locally with no build step.
**How to avoid:** if the new module becomes reachable from `vice-proxy.ts` (e.g. via the argv-subcommand dispatch recommended in Open Questions), add it to `files[]` in the same commit; `check-npm-packages.mjs` will fail loudly (not silently) if forgotten, but this failure surfaces only at pack-time/CI, not at `npm test` time.
**Warning signs:** `npm pack --dry-run --json` in `.claude/mcp/vice` shows a smaller file list than the source directory.

### Pitfall 3: `hostpath-consumers.test.ts`'s `EXPECTED_IMPORTERS` is an exact-five assertion
**What goes wrong:** the test does `assert.deepEqual(importers, EXPECTED_IMPORTERS); assert.equal(importers.length, 5)`. If the new r2000 module accidentally imports `hostpath.ts` (even transitively re-exported), this exact-match test fails loudly — which is the intended behavior, but a planner reading only "extend the closed consumer set" prose might expect to add the new module to `EXPECTED_IMPORTERS` rather than to a negative-absence list. D-08 explicitly requires the negative form.
**How to avoid:** confirmed above in Pattern 2 — mirror the existing negative-assertion test, do not touch the positive five-element array.

### Pitfall 4: `check-skill-fork-honesty.mjs`'s two-array inversion is easy to get half-right
**What goes wrong:** the file currently has `["regenerator2000", "D-B: this phase's install docs must stay regenerator2000-free"]` in `FORBIDDEN_README_SUBSTRINGS` (line 253) **and** a header comment (line 14) still narrating "the regenerator2000 name Phase 8 removed." Moving only the array entry and leaving the header comment stale would leave a self-contradicting file.
**How to avoid:** D-13 requires both edits together — move the entry to `REQUIRED_README_SUBSTRINGS` with a `whatIsLost` string (matching the existing tuple shape `["needle", "whatIsLost"]`), and update the header comment's narrative.

### Pitfall 5: The npm-installer default route has no local `.claude/mcp/vice/` files at all
**What goes wrong:** a design that assumes a skill script can always resolve a relative or `CLAUDE_PLUGIN_ROOT`-based path to `.claude/mcp/vice/<seam-module>.ts` will work under the Claude Code plugin route and the `--vendor` npm-install route, but **silently fail to resolve any path at all** under the npm installer's *default* (non-vendor) route — verified from `installer/bin/cli.mjs`: even with `--vendor`, the `.mcp.json` entry still launches via `command: "npx", args: [MCP_PKG]` (or `["-y", "${MCP_PKG}@${MCP_VERSION}"]` without `--vendor`) — `.claude/mcp/vice/` is never placed as plain files inside the consuming project's tree in either npm-installer mode. Only the Claude Code plugin route ships `.claude/mcp/vice/*.ts` as literal files under `${CLAUDE_PLUGIN_ROOT}`.
**How to avoid:** see Open Questions — route the skill-side call through the already-published `vice-mcp` bin (an argv-subcommand dispatch), which is the one surface guaranteed identical across all three install routes, rather than a filesystem path.

## Deletion Blast Radius (criterion 4, R2000-05)

Full repo grep for `disasm` / `toacme` performed; consumers relevant to the deletion (excluding Phase 4's unrelated stock-disassembler family, and excluding historical `.planning/quick/`, `.planning/phases/04-*`, `.planning/research/` records, which are append-only history and not touched):

| File | What must change |
|------|-------------------|
| `.claude/skills/acme-build/scripts/acme.mjs` | Delete `cmdDisasm()` (verified at the `// toacme ships with ACME...` function, currently the `disasm` case's implementation), its dispatch-table entry, and its usage line. Update the header/scope comment ("wraps `acme` and `toacme` and nothing else") to name only `acme`. |
| `.claude/skills/acme-build/SKILL.md` | Delete the `node $A disasm ...` synopsis line (opening code block), the `## Disassembly` section in full (the entire fenced example + prose about linear decode / out-of-range labels / illegal-opcode indentation / `.dis.a`→`.dis.asm` workaround), and the `toacme`-on-PATH sentence in `## Setup`. Add a short pointer to the new r2000 route in its place. |
| `installer/skills/acme-build/*` | **No manual edit needed** — `installer/skills/` is gitignored and regenerated from `.claude/skills/` by `installer/scripts/sync-skills.mjs`'s `prepack` hook on every `npm pack`/`npm publish`. Confirmed: `git check-ignore -v installer/skills/acme-build/SKILL.md` matches `.gitignore:43`. |
| `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/PROJECT.md` | Historical/requirement-tracking references to the `disasm` verb and `toacme` (e.g. `PROJECT.md:65,247`) are backward-looking requirement statements, not code — they close naturally when R2000-05 is marked satisfied; no separate edit task needed beyond the phase's own closing bookkeeping. |
| `scripts/check-npm-packages.mjs` | No entry there references `acme.mjs`'s `disasm` verb or `toacme` — confirmed by grep; **no change needed** on this file for the deletion itself (only for the seam-module addition, per Pitfall 2). |
| `docs/`, other skills | No other `SKILL.md` or `docs/*.md` file (outside the ones already listed) mentions `disasm`/`toacme` as a live capability — confirmed by grep across `.md`/`.ts`/`.mts`/`.mjs`/`.json`. |

**c64-program-recon/SKILL.md** currently has no mention of `disasm`, `toacme`, or `regenerator2000` — D-12 requires adding a pointer to the new route here (this is new documentation work, not a deletion).

## Code Examples

### regenerator2000's `--verify` output, both the honest pass and the D-10 trap (from Phase 9's live evidence, reproduced here for planner reference)

```
# ACME present, illegal opcodes forced true:
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
# ACME absent, ca65 present -- THE TRAP: exit 0 despite ACME never running
✗ ACME — ACME not found in PATH (skipped)
✓ All roundtrip verifications passed.
EXIT=0
```
[CITED: `docs/phase9-regenerator2000-probe-findings.md` § Criterion 3(2), live transcript] — the new gate (D-10) must therefore parse stdout for a line matching `✓ ACME — byte-identical` (or equivalent success text) and explicitly treat `ACME — ... (skipped)` as a failure, independent of the process exit code.

### `ProjectState`'s minimal-field shape (D-01/D-04), as read from the installed crate source

CONTEXT.md's own citation (`regenerator2000-core-0.9.20/src/state/project.rs:41-96`) was not re-read line-by-line in this research pass (the crate source is present at `~/.cargo/registry/src/index.crates.io-*/regenerator2000-core-0.9.20/`, per CONTEXT.md's own "verified present" note) — this research relied on CONTEXT.md's D-01 citation rather than re-verifying the exact struct fields itself. **Planner note:** if the executing plan needs the exact struct/field list again, re-read that file directly rather than trusting a third-hand paraphrase; CONTEXT.md's own evidence trail (a failed `invalid gzip header` attempt, then a working synthesis exporting all six illegal opcodes) is strong first-hand verification and should be trusted, but the exact JSON shape (field names, whether `settings.system` is a string enum or an object) was not independently re-derived here.

## State of the Art

| Old approach | Current approach | When changed | Impact |
|--------------|------------------|---------------|--------|
| `toacme` flat linear decode (`acme-build`'s `disasm` verb) | `regenerator2000 --headless --export_asm --assembler acme` (recursive-descent + auto-analyzer) | This phase (R2000-05/06) | Strings/tables/BASIC-stub no longer render as fabricated instructions; illegal opcodes decode as real mnemonics once `use_illegal_opcodes: true` is forced (D-05); the `.dis.a`→`.dis.asm` Read-tool workaround and manual out-of-range-label definitions disappear |
| Keystroke/pty Save-As bootstrap (Phase 9's probed, working mechanism) | Direct-in-Node `.regen2000proj` synthesis (D-01) | This phase, decided during `/gsd-discuss-phase` from live evidence | Removes `tmux`/pty/modal/keystroke-encoding entirely and the post-bootstrap JSON edit for `use_illegal_opcodes`; both mechanisms are now proven to work — this is a deliberate choice between two working options, not a fallback |
| `--verify-roundtrip` (documented in early planning/notes) | `--verify` (the real flag name, implies `--headless`) | Corrected in Phase 9 (`docs/phase9-regenerator2000-probe-findings.md` Corrections #9) | Already fixed everywhere current; confirmed again live in this research's own `--help` capture |
| Apache-2.0-only license claim | `MIT OR Apache-2.0` dual license | Corrected in Phase 9, applied in this phase (D-14) | `THIRD-PARTY-NOTICES.md` and `REQUIREMENTS.md`'s R2000-03 wording both still carry the stale claim as of this research pass — this phase is where both get fixed |

**Deprecated/outdated:** `acme-build`'s `toacme`-on-PATH prerequisite is fully retired by this phase (R2000-05) — `acme.mjs` keeps only its `acme` dependency.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ProjectState`'s exact JSON field shape (three required fields, all others `#[serde(default)]`) is as CONTEXT.md's D-01/D-04 describe | Standard Stack / Code Examples | This research did not independently re-read the crate source to confirm field names/types — relied on CONTEXT.md's own live-evidence citation. If the real struct differs subtly (e.g. `settings.system` being an enum discriminant vs. a bare string), the synthesis function's exact shape needs a fresh read of `project.rs` before implementation, not just this research |
| A2 | An argv-subcommand dispatch on the existing `vice-mcp` bin is the right mechanism for the skill-side entry point to reach the D-06 seam across all three install routes | Open Questions | This is a **recommendation**, not a verified fact — it was derived by tracing `installer/bin/cli.mjs`'s `viceServerEntry()` and confirming no local file path exists for the npm-installer default route, but no code was written or tested to confirm the argv-dispatch approach actually works end-to-end through `npx`. If wrong, the planner needs a different mechanism (e.g. a second published `bin` entry, invoked via `npx --package=@henols/vice-mcp <name>`) |
| A3 | `.d64` file-entry extraction is genuinely absent from `d64-parse.mjs` (no `extractFile`/similar export) | Architectural Responsibility Map / Open Questions | Confirmed by direct grep of the file's exports (`readImage`, `sectorsPerTrack`, `tsToOffset`, `parseBam`, `parseDirectory` only) — HIGH confidence, not really an assumption, but flagged since D-02's file-naming-and-extraction logic is new code with no existing test coverage to build on |

**If this table is empty:** N/A — see entries above. A1 and A2 are the two items that most need executor-side re-verification before code is written; A3 is HIGH confidence (direct grep) and listed mainly for completeness.

## Open Questions

1. **How does the skill-side thin entry point reach the D-06 seam across the package boundary?** (CONTEXT.md's own open item)
   - What we know: `.claude/mcp/vice/*.ts` files are present as literal files under `${CLAUDE_PLUGIN_ROOT}` in the Claude Code plugin install route (verified via `.mcp.json` and `scripts/ensure-mcp-deps.sh`'s fallback ladder). In the npm-installer route — **both default and `--vendor`** — `installer/bin/cli.mjs`'s `viceServerEntry()` always launches the server via `npx` (`args: vendor ? [MCP_PKG] : ["-y", "${MCP_PKG}@${MCP_VERSION}"]`), never via a direct file path into a local `node_modules/@henols/vice-mcp/` tree, even under `--vendor` (vendor only pre-installs the package for offline/pinned `npx` resolution, per the installer's own header comment — it does not change how it's launched).
   - What's unclear: whether a skill `.mjs` script can reliably resolve `@henols/vice-mcp`'s installed location via Node's own module resolution (`import.meta.resolve("@henols/vice-mcp/...")` or `require.resolve`) when it IS vendored, and what happens in the un-vendored default case where no local copy exists at all.
   - Recommendation: give the existing `vice-mcp` bin (`vice-proxy.ts`, or a thin wrapper it delegates to at the top of its `main()`) an argv-subcommand branch — e.g. `npx @henols/vice-mcp r2000-bootstrap <file>` — that short-circuits before the Mastra MCP-stdio server starts. This is reachable identically across all three install routes (it's the one thing already proven to resolve everywhere: `npx <pkg>` / `node vice-proxy.ts` under the plugin), requires no new `bin` entry, and mirrors how many npm CLI tools dispatch subcommands from a single published bin. **Not yet verified end-to-end against a real npx-resolved install** — flag for the plan to include a smoke test analogous to `smoke.mjs`'s existing pattern before relying on it.

2. **Should `.d64` extraction extend `d64-parse.mjs` in place, or land beside the D-06 seam?**
   - What we know: `d64-parse.mjs` (`.claude/skills/c64-ram-capture/scripts/d64-parse.mjs`) already exports `readImage`, `sectorsPerTrack`, `tsToOffset`, `parseBam`, `parseDirectory` — pure, offline, no exported file-extraction function. `parseDirectory()` already follows sector chains for directory listing.
   - What's unclear: whether extending this module (adding an `extractFile(buffer, entry)` export) creates an unwanted coupling between `c64-ram-capture` and the new r2000 route, versus a small duplicate helper beside the D-06 seam.
   - Recommendation: extend `d64-parse.mjs` in place — it already owns BAM/sector-chain logic, the alternative duplicates that logic, and the module's documented limits (174848-byte, 35-track images only, no error bytes) are limits D-02's `.d64` support inherits either way, so nothing is gained by a second implementation.

3. **Exact CLI verb names for the new route.**
   - What we know: `acme.mjs`'s existing verb naming convention is a flat single-word dispatch (`new`, `build`, `sym`, and the deleted `disasm`).
   - What's unclear: whether the new route exposes verbs through `acme.mjs` itself (adding a dependency on regenerator2000 to a file whose scope statement says "assembling only" — contradicts D-12's intent that `acme.mjs` end up wrapping `acme` alone) or through a wholly separate skill script/CLI invoked directly.
   - Recommendation: a **separate** thin skill-side script (not inside `acme.mjs`), consistent with D-12's explicit statement that `acme.mjs` "gains no second binary dependency" after the deletion. Exact naming (e.g. `r2000.mjs` under `acme-build/scripts/` or `c64-program-recon/scripts/`) is a planner decision informed by which skill's `SKILL.md` most naturally documents it — CONTEXT.md says both `acme-build` and `c64-program-recon` should point at the single route, suggesting the script itself should not live exclusively "inside" either skill's conceptual ownership. A neutral location (e.g. directly under `.claude/mcp/vice/` as a thin CLI, invoked identically by both skills' documentation) avoids the ownership question entirely and is consistent with D-06's "thin skill-side entry point" wording being about ergonomics, not about which skill owns it.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `regenerator2000` | R2000-09, R2000-06 (whole phase) | ✓ [VERIFIED live] | `0.9.20` | — (already installed on this dev host; D-11 keeps CI from needing it) |
| `tmux` | Not required by D-01's chosen mechanism | ✓ [VERIFIED live] | `3.5a` | N/A — not a new prerequisite this phase introduces |
| `acme` | R2000-06 (`--verify`'s ACME line) | ✓ [VERIFIED live] | `0.97 "Zem"` | Already a project-wide dependency (Phase 4, `acme-build`) |
| `rustc`/`cargo` | Only to (re-)install regenerator2000, not to run this phase's code | ✓ [VERIFIED live] | `1.97.1` (floor `>= 1.90` per Phase 9) | Not needed if regenerator2000 is already installed |
| Node.js | Runs the seam module and skill scripts | ✓ [VERIFIED live] | `v22.22.0` | — |
| Docker | Only relevant to criterion 2's "a devcontainer run works" claim — not tested live in this research pass | Not probed this pass (Phase 9 confirmed `docker` `29.7.2` present when measuring container cost) | — | If a devcontainer smoke test is added to this phase's plan, re-probe `docker info` at execution time |

**Missing dependencies with no fallback:** none identified for this phase's own work — every tool it depends on is present on this development host.

**Missing dependencies with fallback:** none applicable; regenerator2000 install cost (D-15's ~5-minute/~250MB-1.26GB figures) is a documentation concern for R2000-03, not a blocker for writing this phase's code, since the tool is already installed here.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node built-in test runner (`node --test`), no separate framework |
| Config file | none — `.claude/mcp/vice/package.json`'s `scripts.test`: `"node --test '*.test.*'"` |
| Quick run command | `cd .claude/mcp/vice && node --test r2000-launch.test.ts` (or the specific new test file) |
| Full suite command | `cd .claude/mcp/vice && npm test` (runs every `*.test.*` in that directory — the only directory CI executes tests from) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R2000-01 | `--vice` unreachable by construction AND denied by a scan that throws | unit | `cd .claude/mcp/vice && node --test r2000-launch.test.ts` | ❌ Wave 0 (new file) |
| R2000-02 | No argument passed to regenerator2000 is host-translated (structural absence) | unit (extends existing file) | `cd .claude/mcp/vice && node --test hostpath-consumers.test.ts` | ✅ exists, extended not created |
| R2000-09 | `.prg`/`.d64`(named entry)/`.raw` → `.regen2000proj` with no human, `use_illegal_opcodes`+`system` forced | unit (pure synthesis fn) + integration (real r2000 load) | `cd .claude/mcp/vice && node --test r2000-project.test.ts` | ❌ Wave 0 (new file) |
| R2000-05 | `disasm` verb, `## Disassembly` section, `toacme` prerequisite all gone | negative assertion (grep-based, mirrors `check-skill-fork-honesty.mjs`'s own style) or a manual PR-diff check | `grep -n "disasm\|toacme" .claude/skills/acme-build/scripts/acme.mjs .claude/skills/acme-build/SKILL.md` (expect zero matches) | N/A — deletion proof, not a new automated gate unless the planner wants a permanent regression test |
| R2000-06 | `--verify`'s ACME line parsed as `✓`, fails on `skipped`, never trusts exit code alone | integration (subprocess, gated) | `VICE_REQUIRE_R2000=1 node --test r2000-verify.test.ts` (locally, with r2000 installed) / plain `node --test r2000-verify.test.ts` in CI (named SKIP, per D-11) | ❌ Wave 0 (new file) |
| R2000-03 | README names regenerator2000 as required, states cost + limit; THIRD-PARTY-NOTICES.md has dual-license notice | documentation-honesty CI gate | `node scripts/check-skill-fork-honesty.mjs` | ✅ exists, requires the D-13 array-move edit |

### Sampling Rate
- **Per task commit:** the specific new/modified test file's quick command (e.g. `node --test r2000-launch.test.ts`).
- **Per wave merge:** `cd .claude/mcp/vice && npm test` (full suite — this is the only place CI tests run, per D-06's own deciding fact).
- **Phase gate:** full suite green, plus `node scripts/check-skill-fork-honesty.mjs` and `node scripts/check-npm-packages.mjs` (both are existing CI-blocking steps this phase's edits directly touch) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `.claude/mcp/vice/r2000-launch.ts` + `r2000-launch.test.ts` — covers R2000-01 (D-07's construction + scan)
- [ ] `.claude/mcp/vice/r2000-project.ts` + `r2000-project.test.ts` — covers R2000-09 (D-01/D-04/D-05 synthesis, forced settings)
- [ ] `.claude/mcp/vice/r2000-verify.test.ts` — covers R2000-06 (D-09/D-10/D-11's gated `--verify` proof) — **new file, must not edit `disasm-roundtrip.test.ts`**
- [ ] `hostpath-consumers.test.ts` extension — covers R2000-02 (D-08), no new file needed
- [ ] A `.d64`-entry-extraction function in (or beside) `d64-parse.mjs` — covers D-02, currently absent (see Open Questions #2)
- [ ] The skill-side thin entry point / argv-subcommand dispatch itself — covers D-06's reachability question (see Open Questions #1); no test infrastructure exists for this yet because the mechanism itself is undecided

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — no auth surface in this phase |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A — single-user local tool |
| V5 Input Validation | yes | Argv arrays only, never shell-string interpolation (existing project convention, `acme.mjs`/`disasm-roundtrip.test.ts` precedent) — the `.d64` entry name (D-02) and raw file paths are the only untrusted-ish inputs, and both are validated by existence checks before use, never interpolated into a shell string |
| V6 Cryptography | no | The `raw_data_base64` gzip+base64 encoding (D-01) is a data-format transform, not a security cryptographic control — no secret material involved |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A second process contending for stock VICE's single-client binary monitor (the `--vice` hazard R2000-01 exists to prevent) | Denial of Service | D-07's construction-plus-scan guard; this is the entire reason the guard exists — a rogue/legacy `--vice <host:port>` argument would make regenerator2000 itself become that second, unserviced client |
| Command injection via a caller-controlled filename reaching `spawnSync`/`spawn` | Tampering | Argv array, never a shell string — already the established project convention (`disasm-roundtrip.test.ts`'s own explicit "never interpolate ... into a shell command string" rule, `acme.mjs`'s existing `spawnSync` shape); the new seam module must follow the identical rule |
| A malformed/adversarial `.regen2000proj` accepted from an untrusted source and fed back through `--headless` | Tampering / Elevation of Privilege (low severity — local CLI, not a network-facing service) | Not newly introduced by this phase — Phase 10 only ever *writes* project files it synthesised itself (D-01), never loads an externally-supplied `.regen2000proj`; if a future phase adds `--import_lbl`/external-project loading, this becomes relevant then, not here |
| Silent `--vice` flag stripping masking a real bug | Repudiation (a caller cannot tell their request was altered) | D-07 explicitly forbids silent stripping — throw a named, loud error instead |

## Sources

### Primary (HIGH confidence — verified live on this host, 2026-08-20)
- `regenerator2000 --version` / `regenerator2000 --help` — installed version and full CLI surface
- `command -v regenerator2000`, `cargo install --list` — install location and registry record
- `tmux -V`, `acme --version`, `rustc --version`, `cargo --version`, `node --version` — full environment audit
- `.claude/mcp/vice/vice.ts` (`DENY_LIST`, `denyListRefusalMessage`, `call()`'s guard) — read in full at the cited line ranges
- `.claude/mcp/vice/hostpath-consumers.test.ts` — read in full
- `.claude/mcp/vice/disasm-roundtrip.test.ts` — read in full (header + gate logic)
- `.claude/skills/acme-build/scripts/acme.mjs` — read in full (relevant sections)
- `.claude/skills/acme-build/SKILL.md` — read in full
- `.claude/mcp/vice/package.json`, `scripts/check-npm-packages.mjs`, `scripts/check-skill-fork-honesty.mjs`, `scripts/check-skill-tool-coverage.mjs` — read in full or in relevant part
- `.claude/mcp/vice/THIRD-PARTY-NOTICES.md`, root `THIRD-PARTY-NOTICES.md` — read in full
- `README.md`, `installer/bin/cli.mjs`, `installer/scripts/sync-skills.mjs`, `.mcp.json`, `.claude-plugin/plugin.json`, `.gitignore` (installer/skills exclusion) — read in relevant part
- `.claude/skills/c64-ram-capture/scripts/d64-parse.mjs` — exports enumerated by grep
- `.claude/skills/c64-program-recon/SKILL.md` — section headers enumerated
- `.claude/mcp/vice/resources-sync.test.ts` — read in relevant part (confirms r2000 module needs no `resources/*.mjs` build artifact, since it's container-side, not host-bound)
- `.planning/config.json` — `nyquist_validation: true`, `security_enforcement: true` confirmed

### Secondary (HIGH confidence — project-authored evidence documents, not independently re-run this pass)
- `docs/phase9-regenerator2000-probe-findings.md` — Phase 9's full go/no-go verdict, evidence tables, accepted limits, corrections
- `.planning/phases/10-adoption-boundaries-automated-bootstrap-and-the-removal/10-CONTEXT.md` — the phase's own locked decisions
- `.planning/notes/regenerator2000-integration.md` — grounding notes (D-R1..D-R4)

### Tertiary (not verified this pass, flagged in Assumptions Log)
- `regenerator2000-core-0.9.20/src/state/project.rs`'s exact field-level structure (A1) — relied on CONTEXT.md's citation rather than re-reading the crate source directly

## Metadata

**Confidence breakdown:**
- Standard stack (regenerator2000 CLI surface, environment): HIGH — every flag and tool version independently re-verified live on this host
- Architecture (guard seam, absence-test pattern, deletion blast radius): HIGH for what exists today (direct reads); MEDIUM for the cross-package-boundary reachability recommendation (A2), which is a design proposal, not a verified mechanism
- Pitfalls: HIGH — each pitfall is grounded in a direct read of the file it warns about (e.g. `EXPECTED_IMPORTERS`'s exact assertion, `check-skill-fork-honesty.mjs`'s two-array structure)

**Research date:** 2026-08-20
**Valid until:** 30 days, EXCEPT the environment-availability table (regenerator2000/rustc/acme versions), which should be re-checked at execution time if more than a few days pass — regenerator2000 is an eight-month-old, actively-developed project per Phase 9's own maturity note.
