---
phase: 10-adoption-boundaries-automated-bootstrap-and-the-removal
verified: 2026-08-20T19:45:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 10: Adoption Boundaries, Automated Bootstrap, and the Removal Verification Report

**Phase Goal:** regenerator2000 is a guarded, declared, container-side prerequisite that turns a raw binary into an analysed project without a human — and the one thing it makes obsolete is gone
**Verified:** 2026-08-20T19:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The launch path refuses to pass `--vice`, enforced in code and pinned by a test that fails if the flag is reintroduced | ✓ VERIFIED | `.claude/mcp/vice/r2000-launch.ts`: fixed per-verb argv builders (`buildExportAsmArgs`, `buildVerifyArgs`) with no rest parameter; `assertNoViceFlag()` runs as the first statement of `runR2000()`. `r2000-launch.test.ts` (9/9 pass) pins both halves of D-07. **Mutation-killed independently**: copied the module to a scratch dir, (a) removed the `assertNoViceFlag(argv)` call from `runR2000` — test "runR2000 throws R2000ViceFlagError before spawning" failed as expected; (b) added a `...extraArgs: string[]` rest parameter to `runR2000` — the "no rest-parameter/pass-through identifier" test failed as expected. Both mutations were caught, proving the pin is not vacuous. |
| 2 | No argument passed to regenerator2000 is host-translated, asserted in a test | ✓ VERIFIED | `grep hostpath\|containerpath` across all five `r2000-*.ts` modules returns zero real imports (only comments). `hostpath-consumers.test.ts` line 106 asserts the whole r2000 module family is absent from the `hostpath.ts` consumer set (`EXPECTED_IMPORTERS` — 5 modules, none of them r2000). Full suite green. |
| 3 | A `.prg`, a `.d64` (named entry), or a flat 64K capture becomes a `.regen2000proj` without a human | ✓ VERIFIED | `r2000-project.ts` (`synthesizeProject`, pure Node, gzip+base64, no pty/TUI/tmux) + `r2000-d64.ts` (`listEntries`/`extractEntry`, fail-loud, never auto-picks) + `r2000-cli.ts` (`bootstrap` verb) + `vice-proxy.ts` argv dispatch (`r2000` subcommand before any server/socket side effect). **Live end-to-end run against the real installed `regenerator2000 0.9.20` binary** (not a stub): `vice-proxy.ts r2000 bootstrap test.prg` → wrote a loadable `.regen2000proj` in one command; a synthetic flat-64K `.raw` bootstrapped the same way, no human step in either case. `.d64` fail-loud path (`bootstrap` on `.d64` with no `--entry`) unit-tested in `r2000-cli.test.ts` (D-02) — never guesses. `.vsf` correctly refused with a message pointing to Phase 11 (D-03), matching ROADMAP's amended criterion-3 wording. |
| 4 | `disasm` verb / `## Disassembly` caveats / `toacme` prerequisite gone, replaced by a route proven reassemblable by running a real assembler | ✓ VERIFIED | `acme.mjs`'s `VERBS` is exactly `{ new, build, sym }` — no `cmdDisasm`, no `toacme` reference anywhere in `.claude/skills` (`grep -rn 'toacme\|disasm'` → exactly one hit, the documented `evidence: "disasm"` provenance-string exemption in `diff-images.test.mjs`). `check-skill-fork-honesty.mjs`'s whole-tree deletion pin (scans every `.md`/`.mjs` under `.claude/skills`, not a fixed file list) exits 0. **Live reassembly proof reproduced independently**: `vice-proxy.ts r2000 export-asm` → ACME source; `vice-proxy.ts r2000 verify` → `✓ ACME — byte-identical (6 bytes)`, exit 0, with 64tass/KickAssembler correctly reported `skipped` and ca65 also byte-identical — matching `evidence/10-verify-transcript.txt`'s recorded live run (`.prg` 3 bytes, flat 64K 65536 bytes, including the genuine ca65 exit-1 overflow that still resolves `ok:true` because the verdict is keyed on ACME's own line, never on the process exit code — confirmed by reading `r2000-verify.ts`'s `acmeVerdict()`, which never references `status`). |
| 5 | Install docs name regenerator2000 as a required prerequisite alongside VICE, state the toolchain cost and one-project-per-namespace limit, dual `MIT OR Apache-2.0` notice in `THIRD-PARTY-NOTICES.md` | ✓ VERIFIED | `README.md` § "Installing regenerator2000": required-prerequisite framing, `cargo install regenerator2000` (no upstream release assets), rustc floor `>= 1.90`, both container-cost figures as absolute sizes, one-project-per-network-namespace limit stated (not detected), licence row linking `THIRD-PARTY-NOTICES.md`. `.claude/mcp/vice/THIRD-PARTY-NOTICES.md` records `MIT OR Apache-2.0` (dual) with crate-provenance detail. `check-skill-fork-honesty.mjs`'s `REQUIRED_README_SUBSTRINGS` includes `"regenerator2000"`; exits 0. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.claude/mcp/vice/r2000-launch.ts` | Guarded spawn seam, fixed builders, deny scan | ✓ VERIFIED | Present, substantive, wired into `r2000-cli.ts`/`r2000-verify.ts`; mutation-killed |
| `.claude/mcp/vice/r2000-launch.test.ts` | Pins both D-07 halves | ✓ VERIFIED | 9/9 pass; independently confirmed non-vacuous |
| `.claude/mcp/vice/hostpath-consumers.test.ts` | Absence assertion for r2000 family | ✓ VERIFIED | Line 106 test present and passing |
| `.claude/mcp/vice/r2000-project.ts` | Pure `.regen2000proj` synthesiser | ✓ VERIFIED | `synthesizeProject`/`parsePrg`/`flatImageOrigin`/`decodeRawData` all present; live-proven |
| `.claude/mcp/vice/r2000-project.test.ts` | Unit + gated integration | ✓ VERIFIED | 13/13 pass (gated tests ran for real — `regenerator2000` is installed on this host) |
| `.claude/mcp/vice/r2000-d64.ts` | `.d64` listing + named-entry extraction | ✓ VERIFIED | `extractEntry`/`listEntries`/`assertPlainImage` present; 11/11 tests pass, composition test runs (not skipped) post-merge |
| `.claude/mcp/vice/r2000-d64.test.ts` | Round-trip + failure paths | ✓ VERIFIED | 11/11 pass |
| `.claude/mcp/vice/r2000-cli.ts` | `bootstrap`/`export-asm`/`verify` verbs | ✓ VERIFIED | All three verbs live-tested against the real binary end to end |
| `.claude/mcp/vice/r2000-cli.test.ts` | CLI-level coverage incl. D-02/D-03/D-05/D-11 | ✓ VERIFIED | 11/11 pass |
| `.claude/mcp/vice/r2000-verify.ts` | `--verify` parser, ACME-keyed verdict | ✓ VERIFIED | `acmeVerdict()` never reads `status`; confirmed by source read |
| `.claude/mcp/vice/r2000-verify.test.ts` | Both transcripts (honest pass + false-pass trap) + gated live run | ✓ VERIFIED | 9/9 pass |
| `.claude/mcp/vice/vice-proxy.ts` | argv dispatch before server start | ✓ VERIFIED | `process.argv[2] === "r2000"` branch, dynamic import, `process.exit` before any MCP/backend side effect |
| `.claude/mcp/vice/package.json` | `files[]` includes all five r2000 modules | ✓ VERIFIED | Present; `check-npm-packages.mjs` exits 0 (43-module closure, clean) |
| `.claude/skills/acme-build/scripts/acme.mjs` | `disasm` verb removed | ✓ VERIFIED | `VERBS = { new, build, sym }` only |
| `.claude/skills/acme-build/SKILL.md` | No caveats, pointer to r2000 route | ✓ VERIFIED | `## Disassembly` heading repurposed as a pointer section (caveats gone), `r2000 export-asm`/`r2000 verify` referenced |
| `.claude/skills/c64-program-recon/SKILL.md` + `references/tool-selection.md` | Single static-analysis pointer, no dangling row | ✓ VERIFIED | Both files point at `vice-mcp r2000 export-asm`; the `references/` row (the one a `SKILL.md`-scoped grep couldn't see) is corrected |
| `.claude/skills/acme-build/template.a` | Library-free scaffold | ✓ VERIFIED | Assembles with `ACME=` cleared, 55 bytes, `$0801-$0836`, zero warnings — reproduced live |
| `.github/workflows/ci.yml` | Real scaffold assembly step | ✓ VERIFIED | `new`+`build` invoked for real, checks non-empty `.prg` and load address `0108` |
| `README.md` | Prerequisite section | ✓ VERIFIED | Full § "Installing regenerator2000" with measured facts |
| `.claude/mcp/vice/THIRD-PARTY-NOTICES.md` | Dual-licence notice | ✓ VERIFIED | `MIT OR Apache-2.0`, crate provenance dated |
| `scripts/check-skill-fork-honesty.mjs` | Inverted guard + deletion pin | ✓ VERIFIED | `REQUIRED_README_SUBSTRINGS` includes `regenerator2000`; whole-tree `toacme`/`cmdDisasm`/`disasm` regression scan; exits 0 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `r2000-launch.ts` | regenerator2000 binary | `spawnSync` with argv array | ✓ WIRED | Confirmed by source read and live spawn (no shell, array argv) |
| `r2000-launch.test.ts` | `r2000-launch.ts` | direct import | ✓ WIRED | `from "./r2000-launch.ts"` |
| `r2000-d64.ts` | `r2000-project.ts` | `extractEntry` → `parsePrg`/`synthesizeProject`, via `r2000-cli.ts` | ✓ WIRED | Confirmed in `r2000-cli.ts`'s `bootstrapProject()` |
| `vice-proxy.ts` | `r2000-cli.ts` | dynamic import, argv subcommand, before server start | ✓ WIRED | Line 217-220 of `vice-proxy.ts`; live-confirmed via `node vice-proxy.ts r2000 --help` |
| `r2000-cli.ts` | `r2000-launch.ts` | every spawn via `runR2000`/`buildExportAsmArgs`/`buildVerifyArgs` | ✓ WIRED | No direct `spawnSync` call in `r2000-cli.ts`; all go through the guarded seam |
| `r2000-cli.ts` | `r2000-verify.ts` | `verify` verb → `verifyProject` | ✓ WIRED | Confirmed live: `verify` verb printed parsed ACME line and exited on the parsed verdict |
| `scripts/check-skill-fork-honesty.mjs` | `README.md` | `REQUIRED_README_SUBSTRINGS` | ✓ WIRED | Guard exits 0 with `regenerator2000` present |
| `scripts/check-skill-fork-honesty.mjs` | `.claude/skills/acme-build/` | `toacme`/`disasm` absence regression | ✓ WIRED | Guard exits 0; whole-tree scan confirmed to include `references/` pages |

### Data-Flow Trace (Level 4)

Not applicable in the UI/rendering sense — this phase's artifacts are CLI/library modules, not components rendering state. The equivalent trace here is the live end-to-end pipeline, independently reproduced during this verification (not merely re-running the plan's own tests):

| Step | Command | Real Data | Status |
|------|---------|-----------|--------|
| bootstrap (.prg) | `vice-proxy.ts r2000 bootstrap test.prg` | Wrote a loadable `.regen2000proj` (148 bytes) with real gzip+base64 payload, origin `$0801` | ✓ FLOWING |
| bootstrap (flat 64K) | `vice-proxy.ts r2000 bootstrap flat.raw` | Wrote a `.regen2000proj`, origin `$0000` | ✓ FLOWING |
| export-asm | `vice-proxy.ts r2000 export-asm test.regen2000proj` | Real ACME source emitted by the real `regenerator2000` binary (`lda #$01 / sta $d020 / rts`) | ✓ FLOWING |
| verify | `vice-proxy.ts r2000 verify test.regen2000proj` | Real `--verify` subprocess run; ACME line parsed as `ok`; ca65 also byte-identical; ✓ exit 0 | ✓ FLOWING |
| scaffold assembly | `acme.mjs new/build` with `ACME=` cleared | Real ACME 0.97 assembly, 55-byte `.prg`, `$0801-$0836` | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `--vice` refused by construction (rest-param mutation) | scratch-copy mutation + `node --test r2000-launch.test.ts` | Mutation caught: "D-07 construction half" test fails | ✓ PASS |
| `--vice` refused by scan (guard-removal mutation) | scratch-copy mutation + `node --test r2000-launch.test.ts` | Mutation caught: "runR2000 throws..." test fails | ✓ PASS |
| CLI help/dispatch never touches MCP server path | `node vice-proxy.ts r2000 --help` | Usage text printed, exit 0, no JSON-RPC frame | ✓ PASS |
| Real bootstrap → export-asm → verify pipeline | see Data-Flow Trace above | All four steps succeeded against the real installed `regenerator2000 0.9.20` | ✓ PASS |
| Scaffold assembles library-free | `ACME= node acme.mjs new/build` | 55-byte `.prg`, correct load address | ✓ PASS |
| Full `.claude/mcp/vice` test suite | `npm test` | 1925 tests, 1890 pass, 0 fail, 30 skip, 5 todo (matches orchestrator's prior figure exactly) | ✓ PASS |
| `npx tsc --noEmit` | typecheck | exit 0 | ✓ PASS |
| `check-skill-fork-honesty.mjs` | guard | exit 0 | ✓ PASS |
| `check-skill-tool-coverage.mjs` | guard | exit 0 | ✓ PASS |
| `check-npm-packages.mjs` | guard | exit 0, 43-module closure clean | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files exist in this repository and no plan/summary in this phase declares a probe script. **Step 7c: SKIPPED (no probes declared or found).**

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|--------------|--------|----------|
| R2000-01 | 10-01, 10-09 | `--vice` never launched, enforced and tested | ✓ SATISFIED | `r2000-launch.ts`/`.test.ts`, mutation-killed; `vice-wedge-triage/SKILL.md` states the guarantee at the surface a reader meets |
| R2000-02 | 10-01, 10-03, 10-04 | No host-path translation applied to regenerator2000 arguments | ✓ SATISFIED | `hostpath-consumers.test.ts` absence assertion; no real imports of `hostpath.ts`/`containerpath.ts` in any r2000 module |
| R2000-03 | 10-08, 10-09 | Declared prerequisite, cost stated, dual-licence notice | ✓ SATISFIED | `README.md`, `THIRD-PARTY-NOTICES.md`, `REQUIREMENTS.md` wording corrected |
| R2000-09 | 10-02, 10-03, 10-04 | Automated bootstrap, no human | ✓ SATISFIED | Live end-to-end run against the real binary for `.prg` and flat 64K; `.d64` fail-loud path unit-tested |
| R2000-05 | 10-06, 10-08 | `disasm`/`toacme` removed | ✓ SATISFIED | Zero live hits outside the one documented exemption; whole-tree CI pin |
| R2000-06 | 10-05 | Reassembly proven by running a real assembler | ✓ SATISFIED | Live-reproduced `--verify` run, ACME byte-identical, verdict keyed on the parsed ACME line |

All six requirement IDs declared across the phase's PLAN frontmatter are accounted for in REQUIREMENTS.md (§ "Adoption and boundaries" / "Bootstrap and the removal it earns"), matching the ROADMAP's phase-10 requirement list exactly (`R2000-01, R2000-02, R2000-03, R2000-09, R2000-05, R2000-06`). No orphaned requirements found for this phase.

*Note (non-blocking, informational):* `.planning/REQUIREMENTS.md`'s checkboxes for all six R2000-* items in this phase remain `[ ]` rather than `[x]`, unlike `R2000-16` (`[x]`, Phase 9's own gate). This appears to be a milestone-level bookkeeping convention (checkboxes closed at milestone ship, not per-phase) rather than a functional gap — every requirement has concrete, verified evidence above. Flagging for the human's awareness only.

### Anti-Patterns Found

None blocking. Full scan of every file touched by this phase's nine plans for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/"coming soon"/"not yet implemented" turned up zero hits inside this phase's own new/modified code. The only matches anywhere in the broader grep were:

- Pre-existing `.planning/todos/pending/*.md` path references inside `vice-proxy.ts` and `.github/workflows/ci.yml` — all pre-dating this phase, all pointing at filed, formal todo records (not unresolved markers).
- One stale (but harmless) comment in `.github/workflows/ci.yml:91` still pointing at `.planning/todos/pending/2026-08-19-acme-build-scaffold-library-missing-on-both-provisioning-routes.md`, which plan 10-09 moved to `.planning/todos/completed/`. This is descriptive history-in-a-comment, not a debt marker requiring resolution, and does not affect CI's behavior (the assembly step itself works and was reproduced live). Informational only.
- `c64-program-recon/references/tool-selection.md:38`'s "not yet implemented" refers to the fork's own `cycles` schema field (pre-existing, unrelated to this phase's R2000 work).

### Human Verification Required

None. Every success criterion had either a direct, reproducible programmatic check, a live subprocess run against the actually-installed `regenerator2000 0.9.20` binary and a real ACME 0.97 assembler, or a source-level mutation-kill test performed independently during this verification. ROADMAP criterion 2's "a devcontainer run works with no upstream patch" clause is a structural consequence of the (verified) absence of host-path translation — this repository has no devcontainer to test against live (per project history), and no SUMMARY claims a live devcontainer run was performed; the underlying guarantee it rests on (no translation applied) is independently verified above, so this is not surfaced as an open human-verification item.

### Gaps Summary

No gaps. All five ROADMAP success criteria and all six requirement IDs are independently verified against the actual codebase — not merely against SUMMARY.md claims — using source reads, a live installed `regenerator2000` binary, live ACME assembly, source-level mutation-kill testing of the pinning tests, and the project's own automated guards (all exit 0). The one item worth a human's attention (`.planning/REQUIREMENTS.md` checkbox state) is informational, not a functional gap, and the one stale-but-harmless comment path is likewise informational.

---

_Verified: 2026-08-20T19:45:00Z_
_Verifier: Claude (gsd-verifier)_
